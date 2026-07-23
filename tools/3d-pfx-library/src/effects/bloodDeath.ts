import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxBloodDeathLifecycle(cycle: number): {
  energy: number
  rupture: number
  fall: number
  pool: number
  stage: 'wound' | 'rupture' | 'fall' | 'pool' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const wound = smooth(phase / 0.1)
    return { energy: roundMetric(0.5 + wound * 0.4), rupture: roundMetric(wound * 0.1), fall: 0, pool: 0, stage: 'wound' }
  }
  if (phase < 0.34) {
    const rupture = smooth((phase - 0.1) / 0.24)
    return { energy: roundMetric(0.9 + rupture * 0.1), rupture: roundMetric(0.2 + rupture * 0.8), fall: roundMetric(rupture * 0.24), pool: 0, stage: 'rupture' }
  }
  if (phase < 0.7) {
    const fall = smooth((phase - 0.34) / 0.36)
    return { energy: roundMetric(1 - fall * 0.48), rupture: 1, fall: roundMetric(0.64 + fall * 0.36), pool: roundMetric(fall * 0.5), stage: 'fall' }
  }
  if (phase < 0.88) {
    const pool = smooth((phase - 0.7) / 0.18)
    return { energy: roundMetric(0.46 - pool * 0.38), rupture: roundMetric(1 - pool * 0.62), fall: 1, pool: roundMetric(0.68 + pool * 0.32), stage: 'pool' }
  }
  return { energy: 0, rupture: 0, fall: 1, pool: 1, stage: 'rest' }
}

export function createPfxBloodDeathGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const origins: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const splashJetCount = 6
  const clotCount = 12
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    origin: THREE.Vector3,
    direction: THREE.Vector3,
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
      directions.push(direction.x, direction.y, direction.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (raw !== primitive) raw.dispose()
  }

  const woundOrigin = new THREE.Vector3(0, 0.06, 0)
  const wound = new THREE.OctahedronGeometry(1, 0)
  appendPrimitive(
    wound,
    new THREE.Matrix4().compose(woundOrigin, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.36, -0.12)), new THREE.Vector3(0.28, 0.38, 0.26)),
    woundOrigin,
    new THREE.Vector3(),
    0,
    0.5,
    2,
  )
  wound.dispose()

  const jetDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.82, 0.72, -0.34], [0.76, 0.86, 0.38], [-0.92, 0.22, 0.64],
    [0.88, 0.34, -0.62], [-0.58, -0.16, -0.78], [0.62, -0.08, 0.82],
  ]
  const jet = new THREE.CylinderGeometry(0.018, 0.075, 1, 3, 1, false)
  jetDirections.forEach(([x, y, z], jetIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const length = 0.42 + jetIndex * 0.035
    const center = woundOrigin.clone().add(direction.clone().multiplyScalar(length * 0.5))
    appendPrimitive(
      jet,
      new THREE.Matrix4().compose(
        center,
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        new THREE.Vector3(1, length, 1),
      ),
      woundOrigin,
      direction,
      1,
      jetIndex / splashJetCount,
      jetIndex % 3 === 0 ? 3 : 1,
    )
  })
  jet.dispose()

  const clotDirections: ReadonlyArray<readonly [number, number, number]> = [
    [-0.9, 0.62, -0.18], [0.86, 0.7, 0.24], [-0.7, 0.4, 0.78], [0.74, 0.46, -0.72],
    [-1, 0.05, -0.46], [0.94, 0.1, 0.54], [-0.54, -0.34, 0.82], [0.58, -0.28, -0.86],
    [-0.24, 0.86, -0.9], [0.3, 0.92, 0.86], [-0.78, -0.18, 0.2], [0.82, -0.14, -0.16],
  ]
  const depthLanes = [-0.58, -0.29, 0, 0.29, 0.58] as const
  const clot = new THREE.BufferGeometry()
  const clotPositions: number[] = [0, 1, 0]
  for (let side = 0; side < 5; side += 1) {
    const angle = (side / 5) * Math.PI * 2
    clotPositions.push(Math.cos(angle) * 0.72, -0.08, Math.sin(angle) * 0.72)
  }
  clotPositions.push(0, -0.68, 0)
  const clotIndices: number[] = []
  for (let side = 0; side < 5; side += 1) {
    const current = 1 + side
    const next = 1 + ((side + 1) % 5)
    clotIndices.push(0, current, next, 6, next, current)
  }
  clot.setAttribute('position', new THREE.Float32BufferAttribute(clotPositions, 3))
  clot.setIndex(clotIndices)
  clot.computeVertexNormals()
  clotDirections.forEach(([x, y, z], clotIndex) => {
    const direction = new THREE.Vector3(x, y, z).normalize()
    const origin = woundOrigin.clone().add(direction.clone().multiplyScalar(0.18 + (clotIndex % 3) * 0.025))
    origin.z = depthLanes[clotIndex % depthLanes.length]
    appendPrimitive(
      clot,
      new THREE.Matrix4().compose(
        origin,
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction),
        new THREE.Vector3(0.1 + (clotIndex % 2) * 0.035, 0.19 + (clotIndex % 4) * 0.034, 0.09 + (clotIndex % 3) * 0.022),
      ),
      origin,
      direction,
      2,
      clotIndex / clotCount,
      clotIndex % 4 === 0 ? 0 : 1,
    )
  })
  clot.dispose()

  const poolOrigin = new THREE.Vector3(0, -0.58, 0)
  const pool = new THREE.CylinderGeometry(0.62, 0.68, 0.055, 12, 1, false)
  appendPrimitive(pool, new THREE.Matrix4().makeTranslation(poolOrigin.x, poolOrigin.y, poolOrigin.z), poolOrigin, new THREE.Vector3(), 3, 0.5, 0)
  pool.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxBloodDeathOrigin', new THREE.Float32BufferAttribute(origins, 3))
  geometry.setAttribute('pfxBloodDeathDirection', new THREE.Float32BufferAttribute(directions, 3))
  geometry.setAttribute('pfxBloodDeathForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxBloodDeathSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxBloodDeathPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.05, 0), 1.7)
  geometry.userData['pfxBloodDeathDrawCalls'] = 1
  geometry.userData['pfxBloodDeathClosedFaces'] = true
  geometry.userData['pfxBloodDeathBillboardCount'] = 0
  geometry.userData['pfxBloodDeathWoundCoreCount'] = 1
  geometry.userData['pfxBloodDeathSplashJetCount'] = splashJetCount
  geometry.userData['pfxBloodDeathClotCount'] = clotCount
  geometry.userData['pfxBloodDeathClotProfile'] = 'twelve-direction-aligned-closed-five-sided-teardrops'
  geometry.userData['pfxBloodDeathPoolCount'] = 1
  geometry.userData['pfxBloodDeathPoolGroundOffset'] = -0.58
  geometry.userData['pfxBloodDeathDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxBloodDeathSilhouetteProfile'] = 'compact-wound-core-to-asymmetric-arterial-fan-and-grounded-pigment-pool'
  geometry.userData['pfxBloodDeathPalette'] = 'coagulated-crimson-arterial-red-oxblood-black-wet-highlight'
  geometry.userData['pfxBloodDeathAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxBloodDeathTriangleCount'] = positions.length / 9
  geometry.userData['pfxBloodDeathWidthSpan'] = 2.14
  geometry.userData['pfxBloodDeathHeightSpan'] = 2.02
  geometry.userData['pfxBloodDeathDepthSpan'] = 1.62
  return geometry
}

export function createPfxBloodDeathMaterial(
  opacity: number,
  darkColor = '#210305',
  middleColor = '#520507',
  brightColor = '#c6070b',
  highlightColor = '#ffa38f',
  paletteProfile: 'blood' | 'mud' = 'blood',
): THREE.ShaderMaterial {
  const mudPigmentLockShader = paletteProfile === 'mud' ? /* glsl */ `
        float mudClotPigmentLock = clamp(0.32 + coagulatedEdge * 0.38 + wetHighlight * 0.22, 0.0, 0.86);
        vec3 wetUmberBody = mix(uDarkColor, uMiddleColor, 0.42 + coagulatedEdge * 0.2);
        vec3 wetUmberFacet = mix(uMiddleColor, uBrightColor, 0.18 + wetHighlight * 0.3);
        pigment = mix(pigment, wetUmberBody * diffuse, mudClotPigmentLock * 0.86);
        pigment += wetUmberFacet * (0.05 + wetHighlight * 0.16);
        float mudClotValueCeiling = 0.74;
        pigment = min(pigment, vec3(mudClotValueCeiling, mudClotValueCeiling * 0.78, mudClotValueCeiling * 0.6));
        float mudWetSurfaceSpecular = pow(max(0.0, wetHighlight), 18.0) * (0.42 + coagulatedEdge * 0.28);
        pigment += uHighlightColor * mudWetSurfaceSpecular * 0.58;
        float mudGroundContactVisibility = poolMask * (0.16 + wetHighlight * 0.2 + coagulatedEdge * 0.12);
        pigment += uMiddleColor * mudGroundContactVisibility;
` : ''
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uDarkColor: { value: new THREE.Color(darkColor) },
      uMiddleColor: { value: new THREE.Color(middleColor) },
      uBrightColor: { value: new THREE.Color(brightColor) },
      uHighlightColor: { value: new THREE.Color(highlightColor) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxBloodDeathOrigin;
      attribute vec3 pfxBloodDeathDirection;
      attribute float pfxBloodDeathForm;
      attribute float pfxBloodDeathSeed;
      attribute float pfxBloodDeathPaletteIndex;
      varying vec3 vBloodNormal;
      varying vec3 vBloodViewPosition;
      varying float vBloodForm;
      varying float vBloodPaletteIndex;
      varying float vBloodLife;
      varying float vBloodSeed;
      void main() {
        float woundMask = 1.0 - step(0.5, pfxBloodDeathForm);
        float jetMask = step(0.5, pfxBloodDeathForm) * (1.0 - step(1.5, pfxBloodDeathForm));
        float clotMask = step(1.5, pfxBloodDeathForm) * (1.0 - step(2.5, pfxBloodDeathForm));
        float poolMask = step(2.5, pfxBloodDeathForm);
        float woundContraction = smoothstep(0.004, 0.035, uCycle);
        float ballisticRupture = smoothstep(0.012 + pfxBloodDeathSeed * 0.004, 0.075, uCycle);
        float ballisticFall = smoothstep(0.3, 0.72, uCycle);
        float poolSettle = smoothstep(0.28, 0.72, uCycle);
        vec3 local = position - pfxBloodDeathOrigin;
        vec3 woundPosition = pfxBloodDeathOrigin + local * mix(0.72, 1.0, woundContraction) * (1.0 - ballisticRupture * 0.16);
        vec3 jetPosition = pfxBloodDeathOrigin + local * vec3(mix(0.08, 1.0, ballisticRupture), mix(0.06, 1.0, ballisticRupture), mix(0.08, 1.0, ballisticRupture));
        jetPosition += pfxBloodDeathDirection * ballisticRupture * (0.18 + pfxBloodDeathSeed * 0.18);
        vec3 clotPosition = pfxBloodDeathOrigin + local * mix(0.08, 1.0, ballisticRupture);
        clotPosition += pfxBloodDeathDirection * ballisticRupture * (0.42 + pfxBloodDeathSeed * 0.62);
        clotPosition.y -= ballisticFall * ballisticFall * (0.38 + pfxBloodDeathSeed * 0.48);
        vec3 poolPosition = pfxBloodDeathOrigin + local * vec3(mix(0.12, 1.0, poolSettle), mix(0.18, 1.0, poolSettle), mix(0.12, 1.0, poolSettle));
        vec3 transformed = woundPosition * woundMask + jetPosition * jetMask + clotPosition * clotMask + poolPosition * poolMask;
        float woundLife = woundContraction * (1.0 - smoothstep(0.18, 0.42, uCycle));
        float ruptureLife = smoothstep(0.008, 0.045, uCycle) * (1.0 - smoothstep(0.7, 0.88, uCycle));
        float poolLife = smoothstep(0.22, 0.48, uCycle) * (1.0 - smoothstep(0.79, 0.9, uCycle));
        vBloodLife = woundLife * woundMask + ruptureLife * (jetMask + clotMask) + poolLife * poolMask;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vBloodNormal = normalize(normalMatrix * normal);
        vBloodViewPosition = viewPosition.xyz;
        vBloodForm = pfxBloodDeathForm;
        vBloodPaletteIndex = pfxBloodDeathPaletteIndex;
        vBloodSeed = pfxBloodDeathSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uDarkColor;
      uniform vec3 uMiddleColor;
      uniform vec3 uBrightColor;
      uniform vec3 uHighlightColor;
      varying vec3 vBloodNormal;
      varying vec3 vBloodViewPosition;
      varying float vBloodForm;
      varying float vBloodPaletteIndex;
      varying float vBloodLife;
      varying float vBloodSeed;
      void main() {
        vec3 normal = normalize(vBloodNormal);
        vec3 viewDirection = normalize(-vBloodViewPosition);
        vec3 keyLight = normalize(vec3(-0.34, 0.8, 0.48));
        float poolMask = step(2.5, vBloodForm);
        float diffuse = 0.42 + max(0.0, dot(normal, keyLight)) * 0.54;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float coagulatedEdge = rim * rim;
        float wetHighlight = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        wetHighlight *= wetHighlight;
        wetHighlight *= wetHighlight;
        vec3 oxbloodBlack = uDarkColor;
        vec3 coagulatedCrimson = uMiddleColor;
        vec3 arterialRed = uBrightColor;
        vec3 wetIvory = uHighlightColor;
        vec3 bloodPalette = mix(coagulatedCrimson, arterialRed, step(1.5, vBloodPaletteIndex));
        bloodPalette = mix(bloodPalette, oxbloodBlack, poolMask * 0.38);
        vec3 pigment = bloodPalette * diffuse * (0.9 + vBloodSeed * 0.16);
        pigment += arterialRed * coagulatedEdge * mix(0.2, 0.08, poolMask);
        pigment += wetIvory * wetHighlight * mix(0.28, 0.16, poolMask);
${mudPigmentLockShader}
        float coverage = vBloodLife * mix(0.98, 0.96, poolMask);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxBloodDeathMaterial'] = true
  material.userData['pfxBloodDeathMaterialProfile'] = paletteProfile === 'mud'
    ? 'opaque-wet-umber-clot-volume-with-faceted-earth-depth-and-wet-silt-glints'
    : 'opaque-pigment-volume-with-arterial-red-facets-oxblood-depth-and-wet-ivory-glints'
  material.userData['pfxBloodDeathPaletteProfile'] = paletteProfile
  material.userData['pfxBloodDeathFragmentTranscendentalOps'] = 0
  material.userData['pfxBloodDeathAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
