import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxTeleportHitLifecycle(cycle: number): {
  energy: number
  ground: number
  fracture: number
  afterimage: number
  dissolve: number
  stage: 'land' | 'fracture' | 'afterimage' | 'dissolve' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const land = smooth(phase / 0.12)
    return { energy: roundMetric(0.5 + land * 0.5), ground: roundMetric(0.3 + land * 0.7), fracture: roundMetric(land * 0.16), afterimage: roundMetric(land * 0.28), dissolve: 0, stage: 'land' }
  }
  if (phase < 0.42) {
    const fracture = smooth((phase - 0.12) / 0.3)
    return { energy: roundMetric(1 - fracture * 0.08), ground: 1, fracture: roundMetric(0.28 + fracture * 0.72), afterimage: roundMetric(0.34 + fracture * 0.5), dissolve: 0, stage: 'fracture' }
  }
  if (phase < 0.72) {
    const afterimage = smooth((phase - 0.42) / 0.3)
    return { energy: roundMetric(0.92 - afterimage * 0.18), ground: roundMetric(1 - afterimage * 0.18), fracture: 1, afterimage: roundMetric(0.68 + afterimage * 0.32), dissolve: roundMetric(afterimage * 0.18), stage: 'afterimage' }
  }
  if (phase < 0.9) {
    const dissolve = smooth((phase - 0.72) / 0.18)
    return { energy: roundMetric(0.7 - dissolve * 0.62), ground: roundMetric(0.78 - dissolve * 0.48), fracture: roundMetric(1 - dissolve * 0.62), afterimage: roundMetric(1 - dissolve * 0.5), dissolve: roundMetric(0.68 + dissolve * 0.32), stage: 'dissolve' }
  }
  return { energy: 0, ground: 0, fracture: 0, afterimage: 0, dissolve: 1, stage: 'rest' }
}

export function createPfxTeleportHitGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    origin: THREE.Vector3,
    form: 0 | 1 | 2 | 3,
    seed: number,
    paletteIndex: number,
  ) => {
    const raw = primitive.index ? primitive.toNonIndexed() : primitive
    const rawPositions = raw.getAttribute('position')
    const rawNormals = raw.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < rawPositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(rawPositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(rawNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      origins.push(origin.x, origin.y, origin.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const aperture = new THREE.TorusGeometry(0.78, 0.065, 4, 16)
  appendPrimitive(
    aperture,
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.045, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, 0.08)),
      new THREE.Vector3(1.12, 1, 0.88),
    ),
    new THREE.Vector3(0, 0.045, 0),
    0,
    0.5,
    0,
  )
  aperture.dispose()

  const spine = new THREE.OctahedronGeometry(1, 0)
  const spineLayout = [
    { position: [-0.14, 0.78, -0.1], rotation: -0.16, scale: [0.2, 0.76, 0.13], seed: 0.22, palette: 1 },
    { position: [0.18, 0.62, 0.16], rotation: 0.2, scale: [0.14, 0.58, 0.11], seed: 0.76, palette: 2 },
  ] as const
  for (const item of spineLayout) {
    const origin = new THREE.Vector3(...item.position)
    appendPrimitive(
      spine,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, item.rotation, item.rotation)),
        new THREE.Vector3(...item.scale),
      ),
      origin,
      1,
      item.seed,
      item.palette,
    )
  }
  spine.dispose()

  const fracture = new THREE.TetrahedronGeometry(1, 0)
  const depthLanes = [-0.42, 0.18, -0.16, 0.42] as const
  for (let fractureIndex = 0; fractureIndex < 8; fractureIndex += 1) {
    const angle = (fractureIndex / 8) * Math.PI * 2 + 0.12
    const radius = fractureIndex % 2 === 0 ? 0.7 : 0.82
    const origin = new THREE.Vector3(
      Math.cos(angle) * radius,
      0.12 + (fractureIndex % 3) * 0.035,
      Math.sin(angle) * radius + depthLanes[fractureIndex % depthLanes.length]! * 0.16,
    )
    appendPrimitive(
      fracture,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.18 * (fractureIndex % 2), -angle, angle + Math.PI * 0.5)),
        new THREE.Vector3(0.24 + (fractureIndex % 3) * 0.035, 0.065, 0.11),
      ),
      origin,
      2,
      fractureIndex / 8,
      fractureIndex % 3 === 0 ? 3 : 1,
    )
  }
  fracture.dispose()

  const pylon = new THREE.CylinderGeometry(0.035, 0.085, 0.46, 3, 1, false)
  for (let pylonIndex = 0; pylonIndex < 4; pylonIndex += 1) {
    const angle = (pylonIndex / 4) * Math.PI * 2 + 0.08
    const origin = new THREE.Vector3(Math.cos(angle) * 0.98, 0.24, Math.sin(angle) * 0.86)
    appendPrimitive(
      pylon,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(angle) * 0.12, angle, Math.sin(angle) * -0.12)),
        new THREE.Vector3(1, 1, 1),
      ),
      origin,
      3,
      pylonIndex / 4,
      pylonIndex % 2 === 0 ? 2 : 1,
    )
  }
  pylon.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxTeleportHitOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxTeleportHitForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxTeleportHitSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxTeleportHitPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.55, 0), 1.52)
  geometry.userData['pfxTeleportHitDrawCalls'] = 1
  geometry.userData['pfxTeleportHitClosedFaces'] = true
  geometry.userData['pfxTeleportHitBillboardCount'] = 0
  geometry.userData['pfxTeleportHitGroundApertureCount'] = 1
  geometry.userData['pfxTeleportHitAfterimageSpineCount'] = spineLayout.length
  geometry.userData['pfxTeleportHitRadialFractureCount'] = 8
  geometry.userData['pfxTeleportHitCardinalPylonCount'] = 4
  geometry.userData['pfxTeleportHitDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxTeleportHitWorldPlane'] = 'xz-ground-plane-with-y-axis-afterimage'
  geometry.userData['pfxTeleportHitSilhouetteProfile'] = 'grounded-broken-aperture-with-twin-vertical-afterimage-spines-eight-radial-fractures-and-four-cardinal-pylons'
  geometry.userData['pfxTeleportHitPalette'] = 'deep-warp-blue-electric-cyan-cold-lilac-arrival-ivory'
  geometry.userData['pfxTeleportHitAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxTeleportHitTriangleCount'] = positions.length / 9
  geometry.userData['pfxTeleportHitWidthSpan'] = 2.16
  geometry.userData['pfxTeleportHitHeightSpan'] = 1.58
  geometry.userData['pfxTeleportHitDepthSpan'] = 2.06
  return geometry
}

export function createPfxTeleportHitMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) }, uCycle: { value: 0 } },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxTeleportHitOrigin;
      attribute float pfxTeleportHitForm;
      attribute float pfxTeleportHitSeed;
      attribute float pfxTeleportHitPaletteIndex;
      varying vec3 vTeleportNormal;
      varying vec3 vTeleportViewPosition;
      varying float vTeleportForm;
      varying float vTeleportPaletteIndex;
      varying float vTeleportLife;
      varying float vTeleportSeed;
      void main() {
        float groundForm = 1.0 - step(0.5, pfxTeleportHitForm);
        float afterimageForm = step(0.5, pfxTeleportHitForm) * (1.0 - step(1.5, pfxTeleportHitForm));
        float fractureForm = step(1.5, pfxTeleportHitForm) * (1.0 - step(2.5, pfxTeleportHitForm));
        float pylonForm = step(2.5, pfxTeleportHitForm);
        float groundImpact = smoothstep(0.005, 0.11, uCycle);
        float afterimageResolve = smoothstep(0.015 + pfxTeleportHitSeed * 0.025, 0.3, uCycle);
        float radialFracture = smoothstep(0.08 + pfxTeleportHitSeed * 0.04, 0.4, uCycle);
        float retire = 1.0 - smoothstep(0.76, 0.92, uCycle);
        vec3 local = position - pfxTeleportHitOrigin;
        float groundScale = mix(0.42, 1.08, groundImpact);
        vec3 groundPosition = pfxTeleportHitOrigin + local * vec3(groundScale, mix(0.3, 1.0, groundImpact), groundScale);
        vec3 afterimagePosition = pfxTeleportHitOrigin + local * vec3(mix(0.38, 1.0, afterimageResolve), mix(0.06, 1.0, afterimageResolve), mix(0.38, 1.0, afterimageResolve));
        vec3 fractureOrigin = pfxTeleportHitOrigin * vec3(mix(0.24, 1.0, radialFracture), 1.0, mix(0.24, 1.0, radialFracture));
        vec3 fracturePosition = fractureOrigin + local * vec3(mix(0.2, 1.0, radialFracture));
        vec3 pylonPosition = pfxTeleportHitOrigin + local * vec3(1.0, mix(0.12, 1.0, radialFracture), 1.0);
        vec3 transformed = groundPosition * groundForm + afterimagePosition * afterimageForm + fracturePosition * fractureForm + pylonPosition * pylonForm;
        vTeleportLife = groundImpact * retire * groundForm
          + afterimageResolve * (1.0 - smoothstep(0.72, 0.91, uCycle)) * afterimageForm
          + radialFracture * retire * fractureForm
          + radialFracture * retire * pylonForm;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vTeleportNormal = normalize(normalMatrix * normal);
        vTeleportViewPosition = viewPosition.xyz;
        vTeleportForm = pfxTeleportHitForm;
        vTeleportPaletteIndex = pfxTeleportHitPaletteIndex;
        vTeleportSeed = pfxTeleportHitSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vTeleportNormal;
      varying vec3 vTeleportViewPosition;
      varying float vTeleportForm;
      varying float vTeleportPaletteIndex;
      varying float vTeleportLife;
      varying float vTeleportSeed;
      void main() {
        vec3 normal = normalize(vTeleportNormal);
        vec3 viewDirection = normalize(-vTeleportViewPosition);
        vec3 keyLight = normalize(vec3(-0.32, 0.82, 0.46));
        float diffuse = 0.38 + max(0.0, dot(normal, keyLight)) * 0.58;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float arrivalRim = rim * rim;
        float glint = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        glint *= glint;
        glint *= glint;
        vec3 deepWarpBlue = vec3(0.025, 0.12, 0.34);
        vec3 electricCyan = vec3(0.12, 0.68, 1.0);
        vec3 coldLilac = vec3(0.62, 0.48, 1.0);
        vec3 arrivalIvory = vec3(0.9, 0.98, 1.0);
        vec3 teleportPalette = mix(deepWarpBlue, electricCyan, step(0.5, vTeleportPaletteIndex));
        teleportPalette = mix(teleportPalette, coldLilac, step(1.5, vTeleportPaletteIndex));
        teleportPalette = mix(teleportPalette, arrivalIvory, step(2.5, vTeleportPaletteIndex));
        float groundForm = 1.0 - step(0.5, vTeleportForm);
        float afterimageForm = step(0.5, vTeleportForm) * (1.0 - step(1.5, vTeleportForm));
        vec3 pigment = teleportPalette * diffuse * (0.9 + vTeleportSeed * 0.16);
        pigment += electricCyan * arrivalRim * mix(0.34, 0.18, groundForm);
        pigment += arrivalIvory * glint * mix(0.28, 0.5, afterimageForm);
        float coverage = vTeleportLife * mix(0.92, 1.0, afterimageForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxTeleportHitMaterial'] = true
  material.userData['pfxTeleportHitMaterialProfile'] = 'cold-blue-ground-aperture-with-vertical-lilac-afterimage-and-ivory-fracture-glints'
  material.userData['pfxTeleportHitFragmentTranscendentalOps'] = 0
  material.userData['pfxTeleportHitAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
