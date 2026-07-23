import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHolyReleaseLifecycle(cycle: number): {
  energy: number
  radiance: number
  cleanse: number
  residue: number
  stage: 'ignite' | 'release' | 'cleanse' | 'resolve' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const ignite = smooth(phase / 0.1)
    return { energy: roundMetric(0.58 + ignite * 0.34), radiance: roundMetric(0.2 + ignite * 0.44), cleanse: 0, residue: 0, stage: 'ignite' }
  }
  if (phase < 0.34) {
    const release = smooth((phase - 0.1) / 0.24)
    return { energy: roundMetric(0.92 + release * 0.08), radiance: roundMetric(0.74 + release * 0.26), cleanse: roundMetric(0.18 + release * 0.42), residue: 0, stage: 'release' }
  }
  if (phase < 0.7) {
    const cleanse = smooth((phase - 0.34) / 0.36)
    return { energy: roundMetric(1 - cleanse * 0.18), radiance: roundMetric(1 - cleanse * 0.22), cleanse: roundMetric(0.64 + cleanse * 0.36), residue: roundMetric(0.18 + cleanse * 0.42), stage: 'cleanse' }
  }
  if (phase < 0.86) {
    const resolve = smooth((phase - 0.7) / 0.16)
    return { energy: roundMetric(0.58 - resolve * 0.46), radiance: roundMetric(0.56 - resolve * 0.48), cleanse: roundMetric(1 - resolve * 0.62), residue: roundMetric(0.48 + resolve * 0.2), stage: 'resolve' }
  }
  return { energy: 0, radiance: 0, cleanse: 0, residue: 0, stage: 'rest' }
}

export function createPfxHolyReleaseGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const anchors: number[] = []
  const forms: number[] = []
  const seeds: number[] = []
  const paletteIndices: number[] = []
  const primaryRayCount = 10
  const wingRayCount = 4
  const crownFacetCount = 3
  const appendPrimitive = (
    primitive: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    anchor: THREE.Vector3,
    form: 0 | 1 | 2 | 3,
    seed: number,
    paletteIndex: number,
  ) => {
    const source = primitive.index ? primitive.toNonIndexed() : primitive
    const sourcePositions = source.getAttribute('position')
    const sourceNormals = source.getAttribute('normal')
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    for (let vertexIndex = 0; vertexIndex < sourcePositions.count; vertexIndex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertexIndex).applyMatrix4(matrix)
      const normal = new THREE.Vector3().fromBufferAttribute(sourceNormals, vertexIndex).applyMatrix3(normalMatrix).normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      anchors.push(anchor.x, anchor.y, anchor.z)
      forms.push(form)
      seeds.push(seed)
      paletteIndices.push(paletteIndex)
    }
    if (source !== primitive) source.dispose()
  }

  const core = new THREE.OctahedronGeometry(1, 0)
  appendPrimitive(core, new THREE.Matrix4().makeScale(0.25, 0.29, 0.25), new THREE.Vector3(), 0, 0.5, 3)
  core.dispose()

  // A true closed mandorla is the holy tell that keeps this release from
  // reading as a generic starburst. It stands in the XY plane around the
  // seed, with a deliberately thin but volumetric torus section for honest
  // side-view depth.
  const mandorla = new THREE.TorusGeometry(0.48, 0.045, 6, 24)
  appendPrimitive(
    mandorla,
    new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.08, 0),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)),
      new THREE.Vector3(1, 1.28, 1),
    ),
    new THREE.Vector3(0, 0.08, 0),
    3,
    0.62,
    2,
  )
  mandorla.dispose()

  const primaryDirections = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(1, 1, 0.25), new THREE.Vector3(-1, 1, -0.25),
    new THREE.Vector3(1, -1, -0.25), new THREE.Vector3(-1, -1, 0.25),
  ].map((direction) => direction.normalize())
  const appendRay = (
    direction: THREE.Vector3,
    length: number,
    startRadius: number,
    endRadius: number,
    form: 1 | 2,
    seed: number,
    paletteIndex: number,
  ) => {
    const start = direction.clone().multiplyScalar(0.18)
    const end = direction.clone().multiplyScalar(length)
    const rayDirection = end.clone().sub(start)
    const primitive = new THREE.CylinderGeometry(endRadius, startRadius, rayDirection.length(), 4, 1, false)
    const matrix = new THREE.Matrix4().compose(
      start.clone().add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rayDirection.normalize()),
      new THREE.Vector3(1, 1, 1),
    )
    appendPrimitive(primitive, matrix, start, form, seed, paletteIndex)
    primitive.dispose()
  }
  primaryDirections.forEach((direction, rayIndex) => {
    const cardinalDepth = rayIndex === 4 || rayIndex === 5
    const cardinalVertical = rayIndex === 2 || rayIndex === 3
    const length = cardinalDepth ? 0.7 : cardinalVertical ? 0.94 : rayIndex < 6 ? 0.88 : 0.84
    appendRay(direction, length, 0.082, 0.016, 1, rayIndex / primaryRayCount, rayIndex % 3 === 0 ? 2 : 1)
  })

  const wingDirections = [
    new THREE.Vector3(0.72, 0.82, 0.32), new THREE.Vector3(-0.72, 0.82, -0.32),
    new THREE.Vector3(0.78, 0.48, -0.38), new THREE.Vector3(-0.78, 0.48, 0.38),
  ].map((direction) => direction.normalize())
  wingDirections.forEach((direction, wingIndex) => {
    appendRay(direction, 1.03 - wingIndex * 0.035, 0.105, 0.024, 2, 0.14 + wingIndex * 0.21, 2)
  })

  const crown = new THREE.OctahedronGeometry(1, 0)
  const crownCenters = [
    new THREE.Vector3(-0.22, 0.84, 0.06),
    new THREE.Vector3(0, 1.03, -0.05),
    new THREE.Vector3(0.22, 0.84, 0.06),
  ] as const
  crownCenters.forEach((center, crownIndex) => {
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, crownIndex * 0.42, -0.2 + crownIndex * 0.2))
    appendPrimitive(
      crown,
      new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(0.07, 0.18 - crownIndex * 0.015, 0.06)),
      center,
      3,
      0.28 + crownIndex * 0.22,
      3,
    )
  })
  crown.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxHolyReleaseAnchor', new THREE.Float32BufferAttribute(anchors, 3))
  geometry.setAttribute('pfxHolyReleaseForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxHolyReleaseSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxHolyReleasePaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.08, 0), 1.32)
  geometry.userData['pfxHolyReleaseDrawCalls'] = 1
  geometry.userData['pfxHolyReleaseClosedFaces'] = true
  geometry.userData['pfxHolyReleaseBillboardCount'] = 0
  geometry.userData['pfxHolyReleaseCoreCount'] = 1
  geometry.userData['pfxHolyReleaseMandorlaRingCount'] = 1
  geometry.userData['pfxHolyReleasePrimaryRayCount'] = primaryRayCount
  geometry.userData['pfxHolyReleaseWingRayCount'] = wingRayCount
  geometry.userData['pfxHolyReleaseCrownFacetCount'] = crownFacetCount
  geometry.userData['pfxHolyReleaseSilhouetteProfile'] = 'faceted-mandorla-with-cross-axis-rays-wing-pair-and-cleansing-crown'
  geometry.userData['pfxHolyReleasePalette'] = 'warm-gold-ivory-celestial-blue'
  geometry.userData['pfxHolyReleaseAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxHolyReleaseTriangleCount'] = positions.length / 9
  geometry.userData['pfxHolyReleaseWidthSpan'] = 1.96
  geometry.userData['pfxHolyReleaseDepthSpan'] = 1.4
  geometry.userData['pfxHolyReleaseHeightSpan'] = 2.04
  return geometry
}

export function createPfxHolyReleaseMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxHolyReleaseAnchor;
      attribute float pfxHolyReleaseForm;
      attribute float pfxHolyReleaseSeed;
      attribute float pfxHolyReleasePaletteIndex;
      varying vec3 vHolyNormal;
      varying vec3 vHolyViewPosition;
      varying float vHolyForm;
      varying float vHolyPaletteIndex;
      varying float vHolyLife;
      varying float vHolySeed;
      void main() {
        float coreMask = 1.0 - step(0.5, pfxHolyReleaseForm);
        float rayMask = step(0.5, pfxHolyReleaseForm) * (1.0 - step(1.5, pfxHolyReleaseForm));
        float wingMask = step(1.5, pfxHolyReleaseForm) * (1.0 - step(2.5, pfxHolyReleaseForm));
        float crownMask = step(2.5, pfxHolyReleaseForm);
        float releaseIgnition = smoothstep(0.005, 0.075, uCycle);
        float radiantExpansion = smoothstep(0.025 + pfxHolyReleaseSeed * 0.025, 0.27, uCycle);
        float cleansingResolve = smoothstep(0.43, 0.76, uCycle);
        vec3 local = position - pfxHolyReleaseAnchor;
        vec3 corePosition = position * mix(0.18, 1.0, releaseIgnition) * (1.0 - cleansingResolve * 0.16);
        vec3 rayPosition = pfxHolyReleaseAnchor * releaseIgnition + local * mix(0.06, 1.0, radiantExpansion);
        rayPosition += normalize(pfxHolyReleaseAnchor + vec3(0.0001)) * cleansingResolve * pfxHolyReleaseSeed * 0.04;
        vec3 wingPosition = pfxHolyReleaseAnchor * releaseIgnition + local * mix(0.04, 1.0, smoothstep(0.06, 0.32, uCycle));
        wingPosition.y += cleansingResolve * (0.035 + pfxHolyReleaseSeed * 0.045);
        vec3 crownPosition = pfxHolyReleaseAnchor * releaseIgnition + local * mix(0.12, 1.0, smoothstep(0.1, 0.36, uCycle));
        crownPosition.y += radiantExpansion * (0.035 + pfxHolyReleaseSeed * 0.055);
        vec3 transformed = corePosition * coreMask + rayPosition * rayMask + wingPosition * wingMask + crownPosition * crownMask;
        float birth = smoothstep(0.004 + pfxHolyReleaseSeed * 0.012, 0.055 + pfxHolyReleaseSeed * 0.018, uCycle);
        float retire = 1.0 - smoothstep(0.68, 0.84, uCycle);
        vHolyLife = birth * retire;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHolyNormal = normalize(normalMatrix * normal);
        vHolyViewPosition = viewPosition.xyz;
        vHolyForm = pfxHolyReleaseForm;
        vHolyPaletteIndex = pfxHolyReleasePaletteIndex;
        vHolySeed = pfxHolyReleaseSeed;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vHolyNormal;
      varying vec3 vHolyViewPosition;
      varying float vHolyForm;
      varying float vHolyPaletteIndex;
      varying float vHolyLife;
      varying float vHolySeed;
      void main() {
        vec3 normal = normalize(vHolyNormal);
        vec3 viewDirection = normalize(-vHolyViewPosition);
        vec3 keyLight = normalize(vec3(-0.28, 0.9, 0.34));
        float radiantFacet = 0.56 + max(0.0, dot(normal, keyLight)) * 0.52;
        float rim = 1.0 - abs(dot(normal, viewDirection));
        float celestialRim = rim * rim;
        float specular = max(0.0, dot(normal, normalize(keyLight + viewDirection)));
        specular *= specular;
        specular *= specular;
        specular *= specular;
        float coreMask = 1.0 - step(0.5, vHolyForm);
        float rayMask = step(0.5, vHolyForm) * (1.0 - step(1.5, vHolyForm));
        float wingMask = step(1.5, vHolyForm) * (1.0 - step(2.5, vHolyForm));
        float crownMask = step(2.5, vHolyForm);
        vec3 warmGold = vec3(1.0, 0.63, 0.08);
        vec3 paleGold = vec3(1.0, 0.88, 0.38);
        vec3 ivoryCore = vec3(1.0, 0.99, 0.82);
        vec3 celestialBlue = vec3(0.28, 0.72, 1.0);
        vec3 radiantPalette = mix(warmGold, paleGold, step(1.5, vHolyPaletteIndex));
        radiantPalette = mix(radiantPalette, ivoryCore, step(2.5, vHolyPaletteIndex));
        vec3 corePigment = ivoryCore * (0.92 + radiantFacet * 0.22) + paleGold * celestialRim * 0.28;
        vec3 rayPigment = radiantPalette * radiantFacet * (0.94 + vHolySeed * 0.08);
        rayPigment += ivoryCore * specular * 0.56 + celestialBlue * celestialRim * 0.2;
        vec3 wingPigment = mix(warmGold, ivoryCore, 0.46) * radiantFacet + celestialBlue * celestialRim * 0.3;
        vec3 crownPigment = mix(paleGold, ivoryCore, 0.58) * radiantFacet + celestialBlue * celestialRim * 0.42;
        vec3 pigment = corePigment * coreMask + rayPigment * rayMask + wingPigment * wingMask + crownPigment * crownMask;
        float coverage = vHolyLife * mix(0.94, 0.86, wingMask) * (0.96 + coreMask * 0.04);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxHolyReleaseMaterial'] = true
  material.userData['pfxHolyReleaseMaterialProfile'] = 'white-gold-faceted-release-with-blue-cleansing-rim'
  material.userData['pfxHolyReleaseFragmentTranscendentalOps'] = 0
  material.userData['pfxHolyReleaseAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
