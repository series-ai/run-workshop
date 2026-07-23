import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxDespawnImpactLifecycle(cycle: number): {
  energy: number
  mark: number
  collapse: number
  lift: number
  erase: number
  stage: 'mark' | 'collapse' | 'lift' | 'erase' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const mark = smooth(phase / 0.12)
    return { energy: roundMetric(0.44 + mark * 0.46), mark: roundMetric(0.34 + mark * 0.66), collapse: roundMetric(mark * 0.12), lift: 0, erase: 0, stage: 'mark' }
  }
  if (phase < 0.46) {
    const collapse = smooth((phase - 0.12) / 0.34)
    return { energy: roundMetric(0.9 + collapse * 0.1), mark: 1, collapse: roundMetric(0.24 + collapse * 0.76), lift: roundMetric(collapse * 0.36), erase: 0, stage: 'collapse' }
  }
  if (phase < 0.74) {
    const lift = smooth((phase - 0.46) / 0.28)
    return { energy: roundMetric(1 - lift * 0.24), mark: roundMetric(1 - lift * 0.2), collapse: 1, lift: roundMetric(0.68 + lift * 0.32), erase: roundMetric(lift * 0.22), stage: 'lift' }
  }
  if (phase < 0.92) {
    const erase = smooth((phase - 0.74) / 0.18)
    return { energy: roundMetric(0.72 - erase * 0.66), mark: roundMetric(0.76 - erase * 0.56), collapse: 1, lift: 1, erase: roundMetric(0.68 + erase * 0.32), stage: 'erase' }
  }
  return { energy: 0, mark: 0, collapse: 1, lift: 1, erase: 1, stage: 'rest' }
}

export function createPfxDespawnImpactGeometry(): THREE.BufferGeometry {
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

  const groundSeal = new THREE.TorusGeometry(0.7, 0.045, 4, 16)
  appendPrimitive(
    groundSeal,
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.035, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5, 0, -0.08)),
      new THREE.Vector3(1.08, 1, 0.82),
    ),
    new THREE.Vector3(0, 0.035, 0),
    0,
    0.5,
    1,
  )
  groundSeal.dispose()

  const contourBand = new THREE.TorusGeometry(1, 0.045, 3, 12)
  const contourLayout = [
    { origin: [0.02, 0.28, -0.02], radius: [0.58, 0.58, 0.42], tilt: -0.08, seed: 0.18, palette: 1 },
    { origin: [-0.04, 0.74, 0.04], radius: [0.5, 0.5, 0.37], tilt: 0.12, seed: 0.5, palette: 2 },
    { origin: [0.03, 1.16, -0.03], radius: [0.36, 0.36, 0.29], tilt: -0.16, seed: 0.82, palette: 1 },
  ] as const
  for (const contour of contourLayout) {
    const origin = new THREE.Vector3(...contour.origin)
    appendPrimitive(
      contourBand,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI * 0.5 + contour.tilt, contour.tilt * 0.6, contour.tilt)),
        new THREE.Vector3(...contour.radius),
      ),
      origin,
      1,
      contour.seed,
      contour.palette,
    )
  }
  contourBand.dispose()

  const fragment = new THREE.TetrahedronGeometry(1, 0)
  const depthLanes = [-0.52, -0.26, 0, 0.26, 0.52] as const
  for (let fragmentIndex = 0; fragmentIndex < 10; fragmentIndex += 1) {
    const side = fragmentIndex % 2 === 0 ? -1 : 1
    const row = Math.floor(fragmentIndex / 2)
    const y = 0.2 + row * 0.25
    const origin = new THREE.Vector3(
      side * (0.48 - row * 0.035),
      y,
      depthLanes[fragmentIndex % depthLanes.length]!,
    )
    appendPrimitive(
      fragment,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22 * row, side * 0.34, side * (0.48 + row * 0.13))),
        new THREE.Vector3(0.12 + (row % 2) * 0.035, 0.06, 0.09),
      ),
      origin,
      2,
      fragmentIndex / 10,
      fragmentIndex % 4 === 0 ? 3 : 2,
    )
  }
  fragment.dispose()

  const voidCore = new THREE.OctahedronGeometry(1, 0)
  const coreOrigin = new THREE.Vector3(0, 0.7, 0)
  appendPrimitive(
    voidCore,
    new THREE.Matrix4().compose(
      coreOrigin,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.32, -0.12)),
      new THREE.Vector3(0.18, 0.42, 0.15),
    ),
    coreOrigin,
    3,
    0.5,
    0,
  )
  voidCore.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxDespawnImpactOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxDespawnImpactForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxDespawnImpactSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxDespawnImpactPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.computeBoundingBox()
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.62, 0), 1.22)
  geometry.userData['pfxDespawnImpactDrawCalls'] = 1
  geometry.userData['pfxDespawnImpactClosedFaces'] = true
  geometry.userData['pfxDespawnImpactBillboardCount'] = 0
  geometry.userData['pfxDespawnImpactGroundSealCount'] = 1
  geometry.userData['pfxDespawnImpactContourBandCount'] = contourLayout.length
  geometry.userData['pfxDespawnImpactInwardFragmentCount'] = 10
  geometry.userData['pfxDespawnImpactVoidCoreCount'] = 1
  geometry.userData['pfxDespawnImpactDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxDespawnImpactMotionAxis'] = 'inward-and-positive-y-erase'
  geometry.userData['pfxDespawnImpactSilhouetteProfile'] = 'ground-seal-beneath-three-collapsing-body-contours-ten-inward-fragments-and-one-void-core'
  geometry.userData['pfxDespawnImpactPalette'] = 'absence-navy-cold-blue-pale-cyan-void-ivory'
  geometry.userData['pfxDespawnImpactAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxDespawnImpactTriangleCount'] = positions.length / 9
  geometry.userData['pfxDespawnImpactWidthSpan'] = 1.62
  geometry.userData['pfxDespawnImpactHeightSpan'] = 1.56
  geometry.userData['pfxDespawnImpactDepthSpan'] = 1.28
  return geometry
}

export function createPfxDespawnImpactMaterial(opacity: number): THREE.ShaderMaterial {
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
      attribute vec3 pfxDespawnImpactOrigin;
      attribute float pfxDespawnImpactForm;
      attribute float pfxDespawnImpactSeed;
      attribute float pfxDespawnImpactPaletteIndex;
      varying vec3 vDespawnNormal;
      varying vec3 vDespawnViewPosition;
      varying float vDespawnForm;
      varying float vDespawnPaletteIndex;
      varying float vDespawnLife;
      varying float vDespawnSeed;
      void main() {
        float sealForm = 1.0 - step(0.5, pfxDespawnImpactForm);
        float contourForm = step(0.5, pfxDespawnImpactForm) * (1.0 - step(1.5, pfxDespawnImpactForm));
        float fragmentForm = step(1.5, pfxDespawnImpactForm) * (1.0 - step(2.5, pfxDespawnImpactForm));
        float coreForm = step(2.5, pfxDespawnImpactForm);
        float mark = smoothstep(0.005, 0.1, uCycle);
        float inwardCollapse = smoothstep(0.1 + pfxDespawnImpactSeed * 0.025, 0.52, uCycle);
        float liftErase = smoothstep(0.46 + pfxDespawnImpactSeed * 0.025, 0.86, uCycle);
        float retire = 1.0 - smoothstep(0.78, 0.93, uCycle);
        vec3 local = position - pfxDespawnImpactOrigin;
        float sealScale = mix(1.0, 0.54, inwardCollapse);
        vec3 sealPosition = pfxDespawnImpactOrigin + local * vec3(sealScale, 1.0, sealScale);
        vec3 contourOrigin = pfxDespawnImpactOrigin * vec3(mix(1.0, 0.35, inwardCollapse), 1.0, mix(1.0, 0.35, inwardCollapse));
        contourOrigin.y += liftErase * (0.22 + pfxDespawnImpactSeed * 0.28);
        vec3 contourPosition = contourOrigin + local * vec3(mix(1.0, 0.58, inwardCollapse), mix(1.0, 0.72, liftErase), mix(1.0, 0.58, inwardCollapse));
        vec3 fragmentOrigin = pfxDespawnImpactOrigin * vec3(mix(1.0, 0.42, inwardCollapse), 1.0, mix(1.0, 0.42, inwardCollapse));
        fragmentOrigin.y += liftErase * (0.42 + pfxDespawnImpactSeed * 0.46);
        vec3 fragmentPosition = fragmentOrigin + local * vec3(mix(1.0, 0.58, inwardCollapse));
        vec3 coreOrigin = pfxDespawnImpactOrigin + vec3(0.0, liftErase * 0.76, 0.0);
        vec3 corePosition = coreOrigin + local * vec3(mix(1.0, 0.16, liftErase));
        vec3 transformed = sealPosition * sealForm + contourPosition * contourForm + fragmentPosition * fragmentForm + corePosition * coreForm;
        vDespawnLife = mark * (1.0 - smoothstep(0.62, 0.9, uCycle)) * sealForm
          + mark * retire * contourForm
          + max(mark * 0.62, inwardCollapse) * retire * fragmentForm
          + mark * retire * coreForm;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vDespawnNormal = normalize(normalMatrix * normal);
        vDespawnViewPosition = viewPosition.xyz;
        vDespawnForm = pfxDespawnImpactForm;
        vDespawnPaletteIndex = pfxDespawnImpactPaletteIndex;
        vDespawnSeed = pfxDespawnImpactSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vDespawnNormal;
      varying vec3 vDespawnViewPosition;
      varying float vDespawnForm;
      varying float vDespawnPaletteIndex;
      varying float vDespawnLife;
      varying float vDespawnSeed;
      void main() {
        vec3 normal = normalize(vDespawnNormal);
        vec3 viewDirection = normalize(-vDespawnViewPosition);
        vec3 keyLight = normalize(vec3(-0.28, 0.84, 0.46));
        float diffuse = 0.36 + max(0.0, dot(normal, keyLight)) * 0.56;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float erasureRim = rim * rim;
        float glint = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        glint *= glint;
        glint *= glint;
        vec3 absenceNavy = vec3(0.025, 0.075, 0.16);
        vec3 coldBlue = vec3(0.22, 0.52, 0.78);
        vec3 paleCyan = vec3(0.58, 0.86, 1.0);
        vec3 voidIvory = vec3(0.9, 0.96, 1.0);
        vec3 absencePalette = mix(absenceNavy, coldBlue, step(0.5, vDespawnPaletteIndex));
        absencePalette = mix(absencePalette, paleCyan, step(1.5, vDespawnPaletteIndex));
        absencePalette = mix(absencePalette, voidIvory, step(2.5, vDespawnPaletteIndex));
        float coreForm = step(2.5, vDespawnForm);
        vec3 pigment = absencePalette * diffuse * (0.92 + vDespawnSeed * 0.14);
        pigment += absencePalette * 0.12;
        pigment += paleCyan * erasureRim * mix(0.34, 0.2, coreForm);
        pigment += voidIvory * glint * mix(0.22, 0.5, coreForm);
        float coverage = vDespawnLife * mix(0.92, 1.0, coreForm);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxDespawnImpactMaterial'] = true
  material.userData['pfxDespawnImpactMaterialProfile'] = 'cold-blue-body-contours-collapsing-through-pale-fragments-into-a-lifted-void-core'
  material.userData['pfxDespawnImpactFragmentTranscendentalOps'] = 0
  material.userData['pfxDespawnImpactAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
