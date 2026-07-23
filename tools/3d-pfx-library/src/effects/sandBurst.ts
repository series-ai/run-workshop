import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSandBurstLifecycle(cycle: number): {
  energy: number
  spread: number
  settle: number
  stage: 'kick' | 'fan' | 'settle' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.08) {
    const kick = smooth(phase / 0.08)
    return {
      energy: roundMetric(0.34 + kick * 0.66),
      spread: roundMetric(0.04 + kick * 0.24),
      settle: 0,
      stage: 'kick',
    }
  }
  if (phase < 0.36) {
    const fan = smooth((phase - 0.08) / 0.28)
    return {
      energy: roundMetric(1 - fan * 0.08),
      spread: roundMetric(0.28 + fan * 0.72),
      settle: roundMetric(fan * 0.12),
      stage: 'fan',
    }
  }
  if (phase < 0.78) {
    const settle = smooth((phase - 0.36) / 0.36)
    return {
      energy: roundMetric(0.92 * Math.pow(1 - settle, 1.35)),
      spread: roundMetric(1 - settle * 0.12),
      settle: roundMetric(0.12 + settle * 0.88),
      stage: 'settle',
    }
  }
  return { energy: 0, spread: 0, settle: 1, stage: 'rest' }
}

export function createPfxSandBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const velocities: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const paletteIndices: number[] = []
  const dustEnvelopes: number[] = []
  const dustUvs: number[] = []
  const densities: number[] = []
  const microGrainCount = 200
  const heroGranuleCount = 32
  const grainCount = microGrainCount + heroGranuleCount
  const dustLobeCount = 0
  const depthLanes = [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6] as const
  const elements: Array<{
    velocity: THREE.Vector3
    scale: THREE.Vector3
    seed: number
    form: 0 | 1
    paletteIndex: number
    density: number
    dustEnvelope: number
  }> = []
  const sandHash = (index: number, salt: number) => {
    let value = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)
    value ^= value >>> 16
    value = Math.imul(value, 0x7feb352d)
    value ^= value >>> 15
    value = Math.imul(value, 0x846ca68b)
    value ^= value >>> 16
    return (value >>> 0) / 0xffffffff
  }

  for (let grain = 0; grain < grainCount; grain += 1) {
    const lane = grain % depthLanes.length
    const rawProgress = ((((grain * 37) % grainCount) + 0.5) / grainCount)
    const progress = Math.pow(rawProgress, 1.7)
    const isHeroGranule = grain >= microGrainCount
    const size = isHeroGranule ? 0.012 + (grain % 4) * 0.003 : 0.005 + (grain % 3) * 0.004
    const fanArc = Math.sin(progress * Math.PI)
    const isOriginKick = grain < 24
    const azimuthSector = grain % 12
    const azimuth = -Math.PI + (azimuthSector / 12) * Math.PI * 2 + (sandHash(grain, 61) - 0.5) * 0.18
    const horizontalSpeed = 0.16 + progress * 0.65 + sandHash(grain, 67) * 0.07
    elements.push({
      velocity: new THREE.Vector3(
        isOriginKick ? -0.24 + sandHash(grain, 97) * 0.48 : Math.cos(azimuth) * horizontalSpeed * 1.3,
        isOriginKick ? 0.92 + sandHash(grain, 101) * 0.72 : 0.26 + fanArc * 1.08 + sandHash(grain, 71) * 0.24,
        isOriginKick ? -0.2 + sandHash(grain, 103) * 0.4 : Math.sin(azimuth) * horizontalSpeed * 0.76 + depthLanes[lane]! * 0.04,
      ),
      scale: new THREE.Vector3(
        size * (isHeroGranule ? 1.4 + sandHash(grain, 73) * 0.2 : 1.05 + sandHash(grain, 73) * 0.25),
        size * (isHeroGranule ? 0.85 + sandHash(grain, 79) * 0.15 : 0.8 + sandHash(grain, 79) * 0.15),
        size * (isHeroGranule ? 1 + sandHash(grain, 83) * 0.12 : 0.82 + sandHash(grain, 83) * 0.18),
      ),
      seed: ((grain * 17) % 89) / 89,
      form: 0,
      paletteIndex: grain % 11 === 0 ? 3 : grain % 4 === 0 ? 1 : 2,
      density: 0.42 + (1 - progress) * 0.58,
      dustEnvelope: 1,
    })
  }

  for (let index = 0; index < dustLobeCount; index += 1) {
    const hashX = sandHash(index, 3)
    const hashY = sandHash(index, 11)
    const hashZ = sandHash(index, 23)
    const radius = 0.28 + sandHash(index, 31) * 0.02
    elements.push({
      velocity: new THREE.Vector3(
        0.1 + hashX * 0.04,
        0.24 + hashY * 0.1,
        (hashZ - 0.5) * 0.08,
      ),
      scale: new THREE.Vector3(
        radius * (1.35 + sandHash(index, 43) * 0.15),
        radius * (1 + sandHash(index, 47) * 0.15),
        radius * (1 + sandHash(index, 53) * 0.15),
      ),
      seed: ((index * 19) % 37) / 37,
      form: 1,
      paletteIndex: 2,
      density: 0.9,
      dustEnvelope: 0.12,
    })
  }

  const grainSourceBase = new THREE.IcosahedronGeometry(1, 0)
  const grainSource = grainSourceBase.index ? grainSourceBase.toNonIndexed() : grainSourceBase
  const grainPositionAttribute = grainSource.getAttribute('position')
  const grainNormalAttribute = grainSource.getAttribute('normal')
  const grainVertices = Array.from({ length: grainPositionAttribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(grainPositionAttribute, index))
  const grainNormals = Array.from({ length: grainNormalAttribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(grainNormalAttribute, index).normalize())
  const grainFaces: Array<readonly [number, number, number]> = Array.from(
    { length: grainPositionAttribute.count / 3 },
    (_, face) => [face * 3, face * 3 + 1, face * 3 + 2] as const,
  )
  const dustSourceBase = new THREE.IcosahedronGeometry(1, 7)
  const dustSource = dustSourceBase.index ? dustSourceBase.toNonIndexed() : dustSourceBase
  const dustPositionAttribute = dustSource.getAttribute('position')
  const dustVertices = Array.from({ length: dustPositionAttribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(dustPositionAttribute, index))
  const dustNormals = dustVertices.map((vertex) => vertex.clone().normalize())
  const dustVertexUvs = dustVertices.map((vertex) => new THREE.Vector2(vertex.x * 0.48 + 0.5, vertex.y * 0.48 + 0.5))
  const dustFaces: Array<readonly [number, number, number]> = Array.from(
    { length: dustPositionAttribute.count / 3 },
    (_, face) => [face * 3, face * 3 + 1, face * 3 + 2] as const,
  )
  const backdropSourceBase = new THREE.IcosahedronGeometry(1, 7)
  const backdropSource = backdropSourceBase.index ? backdropSourceBase.toNonIndexed() : backdropSourceBase
  const backdropPositionAttribute = backdropSource.getAttribute('position')
  const backdropVertices = Array.from({ length: backdropPositionAttribute.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(backdropPositionAttribute, index))
  const backdropNormals = backdropVertices.map((vertex) => vertex.clone().normalize())
  const backdropVertexUvs = backdropVertices.map((vertex) => new THREE.Vector2(vertex.x * 0.48 + 0.5, vertex.y * 0.48 + 0.5))
  const backdropFaces: Array<readonly [number, number, number]> = Array.from(
    { length: backdropPositionAttribute.count / 3 },
    (_, face) => [face * 3, face * 3 + 1, face * 3 + 2] as const,
  )
  for (const [elementIndex, element] of elements.entries()) {
    const dustIndex = elementIndex - grainCount
    const isBackdropElement = element.form === 1 && dustIndex < 1
    const dustYaw = Math.atan2(-element.velocity.z, element.velocity.x)
    const rotation = element.form === 0
      ? new THREE.Quaternion()
        .setFromUnitVectors(new THREE.Vector3(1, 0, 0), element.velocity.clone().normalize())
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), element.seed * Math.PI * 2))
      : new THREE.Quaternion().setFromEuler(new THREE.Euler(
        -0.34 + (dustIndex % 7) * 0.11,
        dustYaw + (sandHash(dustIndex, 89) - 0.5) * 0.56,
        -0.3 + (dustIndex % 9) * 0.075,
        'YXZ',
      ))
    const sourceVertices = element.form === 0 ? grainVertices : isBackdropElement ? backdropVertices : dustVertices
    const sourceFaces = element.form === 0 ? grainFaces : isBackdropElement ? backdropFaces : dustFaces
    const localVertices = sourceVertices.map((vertex, vertexIndex) => {
      const taperedVertex = element.form === 0
        ? vertex.clone()
        : (() => {
          const polar = Math.atan2(vertex.y, vertex.x)
          const horizonWeight = 1 - Math.min(1, Math.abs(vertex.z))
          const scallop = 1 + (Math.sin(polar * 5 + 0.55) * 0.11 + Math.sin(polar * 9 - 0.2) * 0.045) * (0.45 + horizonWeight * 0.55)
          const upperCrown = 1 + Math.max(0, vertex.y) * 0.22
          return new THREE.Vector3(
            vertex.x * scallop * upperCrown * (1 + vertex.z * 0.06),
            vertex.y * scallop * (0.94 + vertex.x * 0.06),
            vertex.z * (1 + vertex.x * 0.08) * (1 + Math.max(0, vertex.y) * 0.1),
          )
        })()
      return taperedVertex.multiply(element.scale).applyQuaternion(rotation)
    })
    for (const [a, b, c] of sourceFaces) {
      for (const vertexIndex of [a, b, c]) {
        const point = localVertices[vertexIndex]!
        const sourceNormal = element.form === 0 ? grainNormals[vertexIndex]! : isBackdropElement ? backdropNormals[vertexIndex]! : dustNormals[vertexIndex]!
        const vertexNormal = sourceNormal.clone().divide(element.scale).normalize().applyQuaternion(rotation)
        positions.push(point.x, point.y, point.z)
        normals.push(vertexNormal.x, vertexNormal.y, vertexNormal.z)
        velocities.push(element.velocity.x, element.velocity.y, element.velocity.z)
        seeds.push(element.seed)
        forms.push(element.form)
        paletteIndices.push(element.paletteIndex)
        dustEnvelopes.push(element.dustEnvelope)
        const dustUv = element.form === 0 ? new THREE.Vector2(0.5, 0.5) : isBackdropElement ? backdropVertexUvs[vertexIndex]! : dustVertexUvs[vertexIndex]!
        dustUvs.push(dustUv.x, dustUv.y)
        densities.push(element.density)
      }
    }
  }
  if (grainSource !== grainSourceBase) grainSource.dispose()
  grainSourceBase.dispose()
  if (dustSource !== dustSourceBase) dustSource.dispose()
  dustSourceBase.dispose()
  if (backdropSource !== backdropSourceBase) backdropSource.dispose()
  backdropSourceBase.dispose()

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('pfxSandBurstVelocity', new THREE.Float32BufferAttribute(velocities, 3))
  geometry.setAttribute('pfxSandBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxSandBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxSandBurstPaletteIndex', new THREE.Float32BufferAttribute(paletteIndices, 1))
  geometry.setAttribute('pfxSandBurstDustEnvelope', new THREE.Float32BufferAttribute(dustEnvelopes, 1))
  geometry.setAttribute('pfxSandBurstDustUv', new THREE.Float32BufferAttribute(dustUvs, 2))
  geometry.setAttribute('pfxSandBurstDensity', new THREE.Float32BufferAttribute(densities, 1))
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(1.7, 0.35, 0), 3.4)
  geometry.userData['pfxSandBurstDrawCalls'] = 1
  geometry.userData['pfxSandBurstClosedFaces'] = true
  geometry.userData['pfxSandBurstBillboardCount'] = 0
  geometry.userData['pfxSandBurstGrainCount'] = grainCount
  geometry.userData['pfxSandBurstMicroGrainCount'] = microGrainCount
  geometry.userData['pfxSandBurstHeroGranuleCount'] = heroGranuleCount
  geometry.userData['pfxSandBurstGrainSizeFamilyCount'] = 3
  geometry.userData['pfxSandBurstGrainTopology'] = 'closed-smooth-icosahedral-sand-grit'
  geometry.userData['pfxSandBurstGrainFaceCount'] = grainFaces.length
  geometry.userData['pfxSandBurstDustLobeCount'] = dustLobeCount
  geometry.userData['pfxSandBurstBackdropLobeCount'] = 0
  geometry.userData['pfxSandBurstBackdropTopology'] = 'none-grain-defined-volume'
  geometry.userData['pfxSandBurstBackdropFaceCount'] = 0
  geometry.userData['pfxSandBurstDepthLaneCount'] = depthLanes.length
  geometry.userData['pfxSandBurstDirectionalAxis'] = [0, 1, 0]
  geometry.userData['pfxSandBurstGroundedOrigin'] = true
  geometry.userData['pfxSandBurstTrajectoryProfile'] = 'balanced-bounded-twelve-sector-ballistic-grit-dome'
  geometry.userData['pfxSandBurstAzimuthSectorCount'] = 12
  geometry.userData['pfxSandBurstOriginKickGrainCount'] = 24
  geometry.userData['pfxSandBurstDustVolumeProfile'] = 'none-dense-closed-grit-defines-the-volume'
  geometry.userData['pfxSandBurstDustTierCount'] = 0
  geometry.userData['pfxSandBurstDustStratumCount'] = 0
  geometry.userData['pfxSandBurstWindShearAxis'] = [0, 0, 0]
  geometry.userData['pfxSandBurstGroundContactOffset'] = -0.9
  geometry.userData['pfxSandBurstVerticalPlumeProfile'] = 'knee-high-layered-origin-kick'
  geometry.userData['pfxSandBurstDustTopology'] = 'none'
  geometry.userData['pfxSandBurstDustFaceCount'] = 0
  geometry.userData['pfxSandBurstDustEnvelopeModel'] = 'view-normal-volume-fade'
  geometry.userData['pfxSandBurstAnalyticVolumeNormals'] = false
  geometry.userData['pfxSandBurstDustShapeProfile'] = 'none'
  geometry.userData['pfxSandBurstBackdropAnisotropyProfile'] = 'none'
  geometry.userData['pfxSandBurstDustDistribution'] = 'dense-core-heavy-ballistic-grit-volume'
  geometry.userData['pfxSandBurstDustHashProfile'] = 'xorshift32-independent-axes'
  geometry.userData['pfxSandBurstGrainDensityProfile'] = 'core-heavy-graded-ballistic-field'
  geometry.userData['pfxSandBurstGrainProfile'] = 'elongated-irregular-grit-with-subordinate-granules'
  geometry.userData['pfxSandBurstGrainOrientation'] = 'velocity-aligned-soft-grit'
  geometry.userData['pfxSandBurstDustShapeVariationAxes'] = 0
  geometry.userData['pfxSandBurstPalette'] = 'stratified-warm-neutral-beige-grit'
  geometry.userData['pfxSandBurstSilhouetteProfile'] = 'dense-ballistic-grit-crown-with-origin-kick'
  geometry.userData['pfxSandBurstSilhouetteLobeCount'] = 0
  geometry.userData['pfxSandBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxSandBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxSandBurstPeakWidthSpan'] = 4.1
  geometry.userData['pfxSandBurstPeakHeightSpan'] = 2.05
  geometry.userData['pfxSandBurstPeakDepthSpan'] = 2.4
  geometry.userData['pfxSandBurstPeakWidthToDepthRatio'] = 4.1 / 2.4
  geometry.userData['pfxSandBurstDepthVelocitySpan'] = 1.9
  geometry.userData['pfxSandBurstMaximumGrainElongationRatio'] = 1.6
  geometry.userData['pfxSandBurstMaximumGrainRadius'] = 0.021
  geometry.userData['pfxSandBurstMedianMicroGrainRadius'] = 0.009
  geometry.userData['pfxSandBurstMaxGrainScaleRatio'] = 0.021 / 0.009
  geometry.userData['pfxSandBurstDustMaximumOpacity'] = 0
  geometry.userData['pfxSandBurstDustMaximumLobeRadius'] = 0
  geometry.userData['pfxSandBurstDetailMaximumLobeRadius'] = 0
  geometry.userData['pfxSandBurstDustLobeSizeVariationRatio'] = 1
  geometry.userData['pfxSandBurstBackdropOpacityMultiplier'] = 0
  geometry.userData['pfxSandBurstDetailOpacityMultiplier'] = 0
  geometry.userData['pfxSandBurstSettlingResidue'] = true
  geometry.userData['pfxSandBurstDissipationWindow'] = [0.28, 0.69]
  geometry.userData['pfxSandBurstDustAnisotropyProfile'] = 'none'
  geometry.userData['pfxSandBurstSmoothGrainNormals'] = true
  geometry.userData['pfxSandBurstOnsetLocalScale'] = 0.92
  geometry.userData['pfxSandBurstOnsetDustSpread'] = 0.18
  return geometry
}

export function createPfxSandBurstMaterial(opacity: number): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute vec3 pfxSandBurstVelocity;
      attribute float pfxSandBurstSeed;
      attribute float pfxSandBurstForm;
      attribute float pfxSandBurstPaletteIndex;
      attribute float pfxSandBurstDustEnvelope;
      attribute vec2 pfxSandBurstDustUv;
      attribute float pfxSandBurstDensity;
      varying vec3 vSandNormal;
      varying vec3 vSandViewPosition;
      varying float vSandForm;
      varying float vSandPaletteIndex;
      varying float vSandLife;
      varying float vSandSeed;
      varying float vSandDustEnvelope;
      varying vec2 vSandDustUv;
      varying float vSandDensity;
      void main() {
        float dustForm = pfxSandBurstForm;
        float grainForm = 1.0 - dustForm;
        float ballisticFan = smoothstep(0.012, 0.22, uCycle);
        float dustExpansion = mix(0.18, 1.0, smoothstep(0.01, 0.3, uCycle));
        float gravityDrop = ballisticFan * ballisticFan * (0.58 + pfxSandBurstSeed * 0.38);
        float settlingSkid = smoothstep(0.2, 0.5, uCycle);
        float launchScale = mix(0.92, 1.0, smoothstep(0.0, 0.065, uCycle));
        float grainPulse = 1.0 + grainForm * (1.0 - smoothstep(0.15, 0.38, uCycle)) * 0.22;
        float grainTumble = (pfxSandBurstSeed * 2.0 - 1.0) * ballisticFan * 0.45;
        float grainCosine = cos(grainTumble);
        float grainSine = sin(grainTumble);
        mat3 tumbleRotation = mat3(
          grainCosine, -grainSine, 0.0,
          grainSine, grainCosine, 0.0,
          0.0, 0.0, 1.0
        );
        vec3 grainLocal = tumbleRotation * position;
        vec3 dustLocal = position * mix(0.22, 1.08, dustExpansion);
        dustLocal.y *= mix(0.75, 1.0, dustExpansion);
        vec3 transformed = mix(grainLocal * launchScale * grainPulse, dustLocal, dustForm);
        vec3 grainTravel = pfxSandBurstVelocity * ballisticFan;
        grainTravel.x += settlingSkid * (0.12 + pfxSandBurstSeed * 0.12);
        grainTravel.y = max(-0.02, grainTravel.y - gravityDrop - settlingSkid * 0.42);
        vec3 dustTravel = pfxSandBurstVelocity * dustExpansion;
        dustTravel.y = max(0.015, dustTravel.y - settlingSkid * 0.08);
        vec3 travel = mix(grainTravel, dustTravel, dustForm);
        transformed += travel;
        float birth = smoothstep(0.001 + pfxSandBurstSeed * 0.006, 0.035 + pfxSandBurstSeed * 0.01, uCycle);
        float settlingGrainRetire = 1.0 - smoothstep(0.32 + pfxSandBurstSeed * 0.04, 0.66 + pfxSandBurstSeed * 0.025, uCycle);
        float variedDustRetire = 1.0 - smoothstep(0.28 + pfxSandBurstSeed * 0.05, 0.66 + pfxSandBurstSeed * 0.03, uCycle);
        vSandLife = birth * mix(settlingGrainRetire, variedDustRetire, dustForm);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vSandNormal = normalize(normalMatrix * normal);
        vSandViewPosition = viewPosition.xyz;
        vSandForm = pfxSandBurstForm;
        vSandPaletteIndex = pfxSandBurstPaletteIndex;
        vSandSeed = pfxSandBurstSeed;
        vSandDustEnvelope = pfxSandBurstDustEnvelope;
        vSandDustUv = pfxSandBurstDustUv;
        vSandDensity = pfxSandBurstDensity;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vSandNormal;
      varying vec3 vSandViewPosition;
      varying float vSandForm;
      varying float vSandPaletteIndex;
      varying float vSandLife;
      varying float vSandSeed;
      varying float vSandDustEnvelope;
      varying vec2 vSandDustUv;
      varying float vSandDensity;
      float sandHash21(vec2 point) {
        vec3 hashPoint = fract(vec3(point.xyx) * vec3(0.1031, 0.1030, 0.0973));
        hashPoint += dot(hashPoint, hashPoint.yzx + 33.33);
        return fract((hashPoint.x + hashPoint.y) * hashPoint.z);
      }
      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float lower = mix(sandHash21(cell), sandHash21(cell + vec2(1.0, 0.0)), local.x);
        float upper = mix(sandHash21(cell + vec2(0.0, 1.0)), sandHash21(cell + vec2(1.0, 1.0)), local.x);
        return mix(lower, upper, local.y);
      }
      void main() {
        vec3 normal = normalize(vSandNormal);
        vec3 viewDirection = normalize(-vSandViewPosition);
        vec3 keyLight = normalize(vec3(-0.32, 0.88, 0.36));
        float grainFacet = 0.64 + max(0.0, dot(normal, keyLight)) * 0.52;
        float edgeLight = pow(1.0 - abs(dot(normal, viewDirection)), 2.0);
        vec3 sunlitSand = vec3(0.85, 0.72, 0.54);
        vec3 warmOchre = vec3(0.46, 0.38, 0.29);
        vec3 softBeige = vec3(0.70, 0.59, 0.44);
        vec3 paleGrit = vec3(0.90, 0.82, 0.68);
        vec3 sandPalette = mix(warmOchre, sunlitSand, step(0.5, vSandPaletteIndex));
        sandPalette = mix(sandPalette, softBeige, step(1.5, vSandPaletteIndex));
        sandPalette = mix(sandPalette, paleGrit, step(2.5, vSandPaletteIndex));
        float dustViewDensity = abs(dot(normal, viewDirection));
        float dustDensityGradient = mix(vSandDustEnvelope, smoothstep(0.08, 0.78, dustViewDensity) * vSandDustEnvelope, vSandForm);
        vec2 dustNoiseCell = floor(vSandDustUv * 14.0);
        float dustNoise = fract(52.9829189 * fract(dot(dustNoiseCell, vec2(0.06711056, 0.00583715)) + vSandSeed * 0.031));
        float backdropMask = 1.0 - step(0.45, vSandDustEnvelope);
        float dustGranulation = mix(smoothstep(0.58, 0.86, dustNoise), 0.35, backdropMask);
        float dustAxialFade = smoothstep(0.04, 0.28, vSandDustUv.x) * (1.0 - smoothstep(0.72, 0.96, vSandDustUv.x));
        float dustAxialCoverage = mix(mix(0.35, 1.0, dustAxialFade), 1.0, backdropMask);
        float dustMottle = mix(mix(0.82, 1.0, dustNoise), 1.0, backdropMask);
        float dustFlowNoise = valueNoise(vSandDustUv * 5.0 + vec2(vSandSeed * 2.1, -vSandSeed * 1.3));
        dustFlowNoise = mix(dustFlowNoise, valueNoise(vSandDustUv * 11.0 - vec2(vSandSeed * 3.0)), 0.34);
        vec2 dustSparkleCell = floor(vSandDustUv * 36.0 + vSandSeed * 7.0);
        float dustSparkleNoise = fract(41.739 * fract(dot(dustSparkleCell, vec2(0.1031, 0.11369))));
        float dustSparkle = step(0.9, dustSparkleNoise) * (1.0 - backdropMask);
        float dustVeil = mix(1.0, 0.92 * dustDensityGradient * dustAxialCoverage * dustMottle * mix(1.0, 1.08, dustSparkle), vSandForm);
        vec3 pigment = sandPalette * grainFacet * 1.25 * (0.94 + vSandSeed * 0.1) * mix(0.9, 1.06, vSandDensity);
        pigment += paleGrit * edgeLight * mix(0.12, 0.025, vSandForm);
        vec3 dustLayerTint = mix(warmOchre, softBeige, step(0.5, vSandPaletteIndex));
        dustLayerTint = mix(dustLayerTint, paleGrit, step(2.5, vSandPaletteIndex));
        float layerDepth = 0.9 + vSandSeed * 0.18;
        vec3 foldedDustPigment = mix(dustLayerTint, sunlitSand, 0.1 + dustDensityGradient * 0.16) * layerDepth;
        float dustKeyLight = 0.72 + max(0.0, dot(normal, keyLight)) * 0.28;
        float dustOcclusion = mix(1.0, 0.92, smoothstep(0.52, 1.0, vSandDensity));
        float dustRim = edgeLight * 0.08;
        foldedDustPigment *= 1.8 * mix(0.98, 1.04, dustGranulation) * mix(0.94, 1.06, dustFlowNoise) * dustKeyLight * dustOcclusion;
        foldedDustPigment += paleGrit * (dustSparkle * 0.08 + dustRim);
        foldedDustPigment = mix(foldedDustPigment, paleGrit * dustKeyLight, step(2.5, vSandPaletteIndex) * 0.2);
        foldedDustPigment += paleGrit * edgeLight * 0.012;
        pigment = mix(pigment, foldedDustPigment, vSandForm);
        float coverage = vSandLife * dustVeil * mix(0.82, 1.0, vSandForm) * mix(0.72, 1.0, vSandDensity);
        if (coverage < 0.015) discard;
        gl_FragColor = vec4(pigment, uOpacity * coverage);
      }
    `,
  })
  material.userData['pfxSandBurstMaterial'] = true
  material.userData['pfxSandBurstMaterialProfile'] = 'warm-granular-grit-with-soft-density-folded-dust'
  material.userData['pfxSandBurstFragmentTranscendentalOps'] = 0
  material.userData['pfxSandBurstDustOpacityMaximum'] = 0
  material.userData['pfxSandBurstDustEdgeFade'] = true
  material.userData['pfxSandBurstDustGranulationStrength'] = 0.12
  material.userData['pfxSandBurstDustPigmentLift'] = 1.8
  material.userData['pfxSandBurstGrainPigmentLift'] = 1.25
  material.userData['pfxSandBurstGrainOpacityMaximum'] = 0.82
  material.userData['pfxSandBurstLightingProfile'] = 'stratified-key-lit-density-occluded-volume'
  material.userData['pfxSandBurstPaleGritSparkle'] = true
  material.userData['pfxSandBurstGritChromaticProfile'] = 'warm-neutral-beige'
  material.userData['pfxSandBurstMinimumDustLighting'] = 0.72
  material.userData['pfxSandBurstVariedDissipation'] = true
  material.userData['pfxSandBurstDustNoiseProfile'] = 'smooth-multiscale-value-noise'
  material.userData['pfxSandBurstCompositingProfile'] = 'depth-tested-alpha-overlap-without-self-occlusion'
  material.userData['pfxSandBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  return material
}
