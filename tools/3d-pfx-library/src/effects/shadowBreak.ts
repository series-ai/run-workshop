import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxShadowBreakLifecycle(cycle: number): {
  energy: number
  rupture: number
  spread: number
  residue: number
  stage: 'gather' | 'rupture' | 'disperse' | 'residue' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const gather = smooth(phase / 0.12)
    return { energy: roundMetric(0.42 + gather * 0.48), rupture: roundMetric(gather * 0.08), spread: 0, residue: 0, stage: 'gather' }
  }
  if (phase < 0.34) {
    const rupture = smooth((phase - 0.12) / 0.22)
    return { energy: roundMetric(0.9 + rupture * 0.1), rupture: roundMetric(0.18 + rupture * 0.82), spread: roundMetric(rupture * 0.34), residue: 0, stage: 'rupture' }
  }
  if (phase < 0.72) {
    const disperse = smooth((phase - 0.34) / 0.38)
    return { energy: roundMetric(1 - disperse * 0.42), rupture: 1, spread: roundMetric(0.68 + disperse * 0.32), residue: roundMetric(disperse * 0.38), stage: 'disperse' }
  }
  if (phase < 0.88) {
    const residue = smooth((phase - 0.72) / 0.16)
    return { energy: roundMetric(0.48 - residue * 0.4), rupture: roundMetric(1 - residue * 0.46), spread: roundMetric(1 - residue * 0.2), residue: roundMetric(0.58 + residue * 0.42), stage: 'residue' }
  }
  return { energy: 0, rupture: 0, spread: 0, residue: 1, stage: 'rest' }
}

export function createPfxShadowBreakGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const fracturePieceCount = 12
  const voidSeamCount = 3
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    form: 0 | 1 | 2,
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
      directions.push(direction.x, direction.y, direction.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const shell = new THREE.IcosahedronGeometry(1, 0)
  appendPrimitive(
    shell,
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, 0.28, -0.08)),
      new THREE.Vector3(0.62, 0.96, 0.56),
    ),
    new THREE.Vector3(0, 0.02, 0),
    new THREE.Vector3(),
    0,
    0.5,
    0,
  )
  shell.dispose()

  const fragmentDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.9, 0.78, -0.35], [0.72, 0.92, 0.42], [-0.62, 0.34, 0.82], [0.94, 0.18, -0.64],
    [-0.86, -0.2, -0.58], [0.68, -0.42, 0.8], [-0.34, -0.86, 0.28], [0.42, -0.76, -0.78],
    [0.14, 0.62, -0.92], [-0.16, 1, 0.06], [1, -0.04, 0.18], [-0.76, 0.08, 0.72],
  ]
  const depthLanes = [-0.52, -0.26, 0, 0.26, 0.52] as const
  const fragment = new THREE.TetrahedronGeometry(1, 0)
  fragmentDirections.forEach(([x, y, z], fragmentIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const origin = direction.clone().multiplyScalar(0.16 + (fragmentIndex % 3) * 0.025)
    origin.z = depthLanes[fragmentIndex % depthLanes.length]
    const seed = fragmentIndex / fracturePieceCount
    appendPrimitive(
      fragment,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(fragmentIndex * 0.47, fragmentIndex * 0.81, fragmentIndex * 0.33)),
        new THREE.Vector3(0.13 + (fragmentIndex % 3) * 0.025, 0.28 + (fragmentIndex % 4) * 0.055, 0.12 + (fragmentIndex % 2) * 0.04),
      ),
      origin,
      direction,
      1,
      seed,
      fragmentIndex % 4 === 0 ? 3 : 1 + (fragmentIndex % 2),
    )
  })
  fragment.dispose()

  const seam = new THREE.CylinderGeometry(0.012, 0.038, 1, 3, 1, false)
  const seamOrigins = [
    new THREE.Vector3(-0.08, 0.36, -0.04),
    new THREE.Vector3(0.06, 0.02, 0.08),
    new THREE.Vector3(-0.04, -0.34, -0.06),
  ] as const
  seamOrigins.forEach((origin, seamIndex) => {
    appendPrimitive(
      seam,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12 * seamIndex, 0.28 * (seamIndex - 1), seamIndex === 1 ? -0.38 : 0.34)),
        new THREE.Vector3(1, 0.58 + seamIndex * 0.08, 1),
      ),
      origin,
      new THREE.Vector3(0, seamIndex === 1 ? 0.2 : -0.12, (seamIndex - 1) * 0.18),
      2,
      0.25 + seamIndex * 0.25,
      3,
    )
  })
  seam.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxShadowBreakOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxShadowBreakDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxShadowBreakForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxShadowBreakSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxShadowBreakPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.75)
  geometry.userData['pfxShadowBreakDrawCalls'] = 1
  geometry.userData['pfxShadowBreakClosedFaces'] = true
  geometry.userData['pfxShadowBreakBillboardCount'] = 0
  geometry.userData['pfxShadowBreakShellCount'] = 1
  geometry.userData['pfxShadowBreakFracturePieceCount'] = fracturePieceCount
  geometry.userData['pfxShadowBreakVoidSeamCount'] = voidSeamCount
  geometry.userData['pfxShadowBreakVoidSeamProfile'] = 'three-offset-jagged-lilac-fissures'
  geometry.userData['pfxShadowBreakDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxShadowBreakSilhouetteProfile'] = 'faceted-shadow-shell-to-asymmetric-violet-rupture-with-vertical-void-seam'
  geometry.userData['pfxShadowBreakPalette'] = 'ink-black-deep-violet-bruise-magenta-cold-lilac'
  geometry.userData['pfxShadowBreakAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxShadowBreakTriangleCount'] = positions.length / 9
  geometry.userData['pfxShadowBreakWidthSpan'] = 2.08
  geometry.userData['pfxShadowBreakHeightSpan'] = 2.36
  geometry.userData['pfxShadowBreakDepthSpan'] = 1.72
  return geometry
}

export function createPfxShadowBreakMaterial(
  opacity: number,
  inkColor = '#05030a',
  slateColor = '#290e4a',
  bruiseColor = '#8c1fa6',
  seamColor = '#c294ff',
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uInkColor: { value: new THREE.Color(inkColor) },
      uSlateColor: { value: new THREE.Color(slateColor) },
      uBruiseColor: { value: new THREE.Color(bruiseColor) },
      uSeamColor: { value: new THREE.Color(seamColor) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxShadowBreakOrigin;
      attribute vec3 pfxShadowBreakDirection;
      attribute float pfxShadowBreakForm;
      attribute float pfxShadowBreakSeed;
      attribute float pfxShadowBreakPaletteIndex;
      varying vec3 vShadowNormal;
      varying vec3 vShadowViewPosition;
      varying float vShadowForm;
      varying float vShadowPaletteIndex;
      varying float vShadowLife;
      varying float vShadowSeed;
      void main() {
        float shellMask = 1.0 - step(0.5, pfxShadowBreakForm);
        float fragmentMask = step(0.5, pfxShadowBreakForm) * (1.0 - step(1.5, pfxShadowBreakForm));
        float seamMask = step(1.5, pfxShadowBreakForm);
        float shadowGather = smoothstep(0.002, 0.015, uCycle);
        float shadowRupture = smoothstep(0.008 + pfxShadowBreakSeed * 0.002, 0.04, uCycle);
        float shadowResidue = smoothstep(0.66, 0.86, uCycle);
        vec3 local = position - pfxShadowBreakOrigin;
        vec3 shellPosition = pfxShadowBreakOrigin + local * mix(0.68, 1.0, shadowGather) * (1.0 - shadowRupture * 0.07);
        vec3 fragmentPosition = pfxShadowBreakOrigin
          + pfxShadowBreakDirection * shadowRupture * (0.34 + pfxShadowBreakSeed * 0.58)
          + local * mix(0.08, 1.0, shadowRupture);
        fragmentPosition.y -= shadowResidue * (0.08 + pfxShadowBreakSeed * 0.16);
        vec3 seamPosition = pfxShadowBreakOrigin + local * vec3(mix(0.1, 1.0, shadowRupture), mix(0.18, 1.0, shadowRupture), mix(0.1, 1.0, shadowRupture));
        seamPosition += pfxShadowBreakDirection * shadowResidue * 0.12;
        vec3 transformed = shellPosition * shellMask + fragmentPosition * fragmentMask + seamPosition * seamMask;
        float shellLife = shadowGather * (1.0 - smoothstep(0.018, 0.045, uCycle));
        float fragmentBirth = smoothstep(0.008 + pfxShadowBreakSeed * 0.002, 0.028 + pfxShadowBreakSeed * 0.004, uCycle);
        float fragmentLife = fragmentBirth * (1.0 - smoothstep(0.7, 0.87, uCycle));
        float seamLife = smoothstep(0.006, 0.02, uCycle) * (1.0 - smoothstep(0.73, 0.88, uCycle));
        vShadowLife = shellLife * shellMask + fragmentLife * fragmentMask + seamLife * seamMask;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vShadowNormal = normalize(normalMatrix * normal);
        vShadowViewPosition = viewPosition.xyz;
        vShadowForm = pfxShadowBreakForm;
        vShadowPaletteIndex = pfxShadowBreakPaletteIndex;
        vShadowSeed = pfxShadowBreakSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uInkColor;
      uniform vec3 uSlateColor;
      uniform vec3 uBruiseColor;
      uniform vec3 uSeamColor;
      varying vec3 vShadowNormal;
      varying vec3 vShadowViewPosition;
      varying float vShadowForm;
      varying float vShadowPaletteIndex;
      varying float vShadowLife;
      varying float vShadowSeed;
      void main() {
        vec3 normal = normalize(vShadowNormal);
        vec3 viewDirection = normalize(-vShadowViewPosition);
        vec3 keyLight = normalize(vec3(-0.42, 0.76, 0.5));
        float shellMask = 1.0 - step(0.5, vShadowForm);
        float voidSeam = step(1.5, vShadowForm);
        float diffuse = 0.38 + max(0.0, dot(normal, keyLight)) * 0.56;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float fractureEdge = rim * rim;
        float glint = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        glint *= glint;
        glint *= glint;
        vec3 inkBlack = uInkColor;
        vec3 deepViolet = uSlateColor;
        vec3 bruiseMagenta = uBruiseColor;
        vec3 coldLilac = uSeamColor;
        vec3 shadowPalette = mix(deepViolet, bruiseMagenta, step(1.5, vShadowPaletteIndex));
        shadowPalette = mix(shadowPalette, inkBlack, shellMask);
        shadowPalette = mix(shadowPalette, coldLilac, voidSeam);
        vec3 pigment = shadowPalette * diffuse * (0.9 + vShadowSeed * 0.14);
        pigment += coldLilac * fractureEdge * mix(0.18, 0.48, voidSeam);
        pigment += bruiseMagenta * glint * (1.0 - shellMask) * 0.42;
        float coverage = vShadowLife * mix(0.96, 1.0, voidSeam);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxShadowBreakMaterial'] = true
  material.userData['pfxShadowBreakMaterialProfile'] = 'faceted-ink-shell-with-violet-fracture-planes-and-cold-lilac-seam'
  material.userData['pfxShadowBreakPeakRuptureCycle'] = 0.12
  material.userData['pfxShadowBreakFragmentTranscendentalOps'] = 0
  material.userData['pfxShadowBreakAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
