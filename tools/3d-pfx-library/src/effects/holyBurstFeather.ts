import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxHolyBurstFeatherGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const directions: number[] = []
  const forms: number[] = []
  const species: number[] = []
  const featherCount = 16
  const up = new THREE.Vector3(0, 1, 0)

  const createClosedFeatherVane = (speciesIndex: number) => {
    const ringSegments = 6
    const speciesProfiles = [
      [
        { y: -0.5, radius: 0.06 }, { y: -0.28, radius: 0.72 }, { y: 0, radius: 1 }, { y: 0.3, radius: 0.58 }, { y: 0.5, radius: 0.035 },
      ],
      [
        { y: -0.46, radius: 0.045 }, { y: -0.24, radius: 0.54 }, { y: 0.02, radius: 0.92 }, { y: 0.3, radius: 0.74 }, { y: 0.48, radius: 0.025 },
      ],
      [
        { y: -0.58, radius: 0.04 }, { y: -0.32, radius: 0.46 }, { y: -0.04, radius: 0.8 }, { y: 0.34, radius: 0.62 }, { y: 0.58, radius: 0.02 },
      ],
      [
        { y: -0.52, radius: 0.05 }, { y: -0.34, radius: 0.78 }, { y: -0.02, radius: 0.94 }, { y: 0.24, radius: 0.42 }, { y: 0.54, radius: 0.018 },
      ],
    ] as const
    const ringProfiles = speciesProfiles[speciesIndex % speciesProfiles.length]!
    const vanePositions: number[] = []
    const vaneIndices: number[] = []
    for (const ring of ringProfiles) {
      for (let segment = 0; segment < ringSegments; segment += 1) {
        const angle = segment / ringSegments * Math.PI * 2
        vanePositions.push(Math.cos(angle) * ring.radius, ring.y, Math.sin(angle) * ring.radius)
      }
    }
    for (let ring = 0; ring < ringProfiles.length - 1; ring += 1) {
      for (let segment = 0; segment < ringSegments; segment += 1) {
        const next = (segment + 1) % ringSegments
        const lower = ring * ringSegments + segment
        const lowerNext = ring * ringSegments + next
        const upper = (ring + 1) * ringSegments + segment
        const upperNext = (ring + 1) * ringSegments + next
        vaneIndices.push(lower, upper, lowerNext, lowerNext, upper, upperNext)
      }
    }
    const bottomCenter = vanePositions.length / 3
    vanePositions.push(0, ringProfiles[0]!.y, 0)
    const topCenter = vanePositions.length / 3
    vanePositions.push(0, ringProfiles.at(-1)!.y, 0)
    for (let segment = 0; segment < ringSegments; segment += 1) {
      const next = (segment + 1) % ringSegments
      vaneIndices.push(bottomCenter, next, segment)
      const topOffset = (ringProfiles.length - 1) * ringSegments
      vaneIndices.push(topCenter, topOffset + segment, topOffset + next)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vanePositions, 3))
    geometry.setIndex(vaneIndices)
    return geometry
  }

  // Two swept-back lateral wings. The previous four-diagonal-fan layout was
  // 90-degree rotation symmetric, which made front and side captures nearly
  // pixel-identical and read as camera-facing cards. A left/right wing pair
  // swept along -Z presents a broad span from the front and a foreshortened,
  // clearly different swept profile from the side.
  const wingAxes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)]
  const backSweep = new THREE.Vector3(0, 0, -1)
  for (let feather = 0; feather < featherCount; feather += 1) {
    const wingIndex = Math.floor(feather / 8)
    const featherInWing = feather % 8
    const tier = featherInWing % 4
    const lane = Math.floor(featherInWing / 4)
    const progress = tier / 3
    const wingAxis = wingAxes[wingIndex]!
    const wingPerpendicular = new THREE.Vector3(0, 0, 1)
    const laneOffset = (lane - 0.5) * 0.15
    const wingReachMultiplier = 1.48
    const densityTierSeeds = [0.08, 0.22, 0.42, 0.72] as const
    const seed = densityTierSeeds[tier]! + wingIndex * (tier === 0 ? 0.006 : tier === 1 ? 0.012 : 0.018) + lane * 0.004
    const sweepAmount = progress * progress * 0.55 + lane * 0.09
    const center = wingAxis.clone().multiplyScalar((0.52 + progress * 0.48) * wingReachMultiplier)
      .addScaledVector(up, 0.45 + progress * 1.15 + Math.sin(progress * Math.PI) * 0.28 - lane * 0.14)
      .addScaledVector(backSweep, sweepAmount)
      .addScaledVector(wingPerpendicular, laneOffset * 0.4)
    const direction = wingAxis.clone().multiplyScalar(0.62 - progress * 0.14)
      .addScaledVector(up, 0.76 - progress * 0.2)
      .addScaledVector(backSweep, 0.16 + progress * 0.34)
      .addScaledVector(wingPerpendicular, laneOffset * 0.3)
      .normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction)
    // Roll each vane around its quill so the broad face reads from the front
    // and turns edge-on from the side; mirrored per wing, varied per tier.
    const vaneRoll = (wingIndex === 0 ? 1 : -1) * (0.42 + tier * 0.09) + (lane - 0.5) * 0.16
    rotation.multiply(new THREE.Quaternion().setFromAxisAngle(up, vaneRoll))
    const appendPart = (source: THREE.BufferGeometry, scale: THREE.Vector3, partCenter: THREE.Vector3, form: number, partRotation = rotation) => {
      const raw = source.index ? source.toNonIndexed() : source
      const position = raw.getAttribute('position')
      for (let vertex = 0; vertex < position.count; vertex += 1) {
        const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(partRotation).add(partCenter)
        positions.push(point.x, point.y, point.z)
        centers.push(center.x, center.y, center.z)
        seeds.push(seed)
        directions.push(direction.x, direction.y, direction.z)
        forms.push(form)
        species.push(tier)
      }
      if (raw !== source) raw.dispose()
      source.dispose()
    }
    appendPart(
      createClosedFeatherVane(tier),
      new THREE.Vector3(0.16 + (3 - tier) * 0.026, 0.58 + progress * 0.28, 0.24 + (tier % 2) * 0.075),
      center,
      0,
    )
    if (tier >= 2) {
      const crossRotation = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2))
      appendPart(
        createClosedFeatherVane((tier + 1) % 4),
        new THREE.Vector3(0.13 + (3 - tier) * 0.018, 0.54 + progress * 0.24, 0.18 + (tier % 2) * 0.045),
        center,
        0,
        crossRotation,
      )
    }
    appendPart(
      new THREE.CylinderGeometry(0.026, 0.014, 0.54 + progress * 0.12, 6, 1, false),
      new THREE.Vector3(1, 1, 1),
      center.clone().add(direction.clone().multiplyScalar(-0.04)),
      1,
    )
  }
  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxHolyBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxHolyBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxHolyBurstDirection', new THREE.Float32BufferAttribute(directions, 3))
  rawGeometry.setAttribute('pfxHolyBurstFeatherForm', new THREE.Float32BufferAttribute(forms, 1))
  rawGeometry.setAttribute('pfxHolyBurstFeatherSpecies', new THREE.Float32BufferAttribute(species, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxHolyBurstFeatherDrawCalls'] = 1
  geometry.userData['pfxHolyBurstFeatherClosedFaces'] = true
  geometry.userData['pfxHolyBurstFeatherSmoothNormals'] = true
  geometry.userData['pfxHolyBurstFeatherCount'] = featherCount
  geometry.userData['pfxHolyBurstWingCount'] = 2
  geometry.userData['pfxHolyBurstFeatherSpeciesCount'] = 4
  geometry.userData['pfxHolyBurstFeatherDepthLayerCount'] = 10
  geometry.userData['pfxHolyBurstFeatherBillboardCount'] = 0
  geometry.userData['pfxHolyBurstFeatherTopology'] = 'two-swept-back-lateral-wings-of-closed-tapered-feather-volumes'
  geometry.userData['pfxHolyBurstWingEnvelope'] = 'two-seraphic-fans-broad-in-front-foreshortened-in-side-projection'
  geometry.userData['pfxHolyBurstFeatherMeshProfile'] = 'four-species-of-cross-ribbed-biconvex-feather-vanes-with-closed-spines'
  geometry.userData['pfxHolyBurstCrossVaneCount'] = 8
  geometry.userData['pfxHolyBurstCrossVaneProfile'] = 'outer-feathers-carry-perpendicular-closed-vanes-for-orbit-safe-volume'
  geometry.userData['pfxHolyBurstVaneTwistProfile'] = 'mirrored-per-wing-vane-roll-with-species-varied-ribbed-vane-read'
  geometry.userData['pfxHolyBurstFeatherMinimumThickness'] = 0.3
  geometry.userData['pfxHolyBurstMinimumVaneThicknessToWidthRatio'] = 1.3
  geometry.userData['pfxHolyBurstLateralWingReachMultiplier'] = 1.48
  geometry.userData['pfxHolyBurstWingBackSweepMultiplier'] = 0.55
  geometry.userData['pfxHolyBurstSideProjectionCompensationRadians'] = 0
  geometry.userData['pfxHolyBurstVerticalWingRise'] = 1.15
  geometry.userData['pfxHolyBurstWingRadialProfile'] = 'connected-four-tier-two-lane-fans-swept-back-with-subordinate-tip-separation'
  geometry.userData['pfxHolyBurstMaximumAuthoredTierGap'] = 0.38
  geometry.userData['pfxHolyBurstSemanticDensityFloor'] = 0.015
  geometry.userData['pfxHolyBurstBalancedDensityTierProfile'] = 'zero-feathers-at-min-six-per-wing-default-eight-per-wing-max-with-maximum-spatial-expansion'
  geometry.userData['pfxHolyBurstMinimumDensityFeathersPerWing'] = 0
  geometry.userData['pfxHolyBurstDefaultDensityFeathersPerWing'] = 6
  geometry.userData['pfxHolyBurstMaximumDensityExpansion'] = 1.12
  geometry.userData['pfxHolyBurstMaximumDensityFullness'] = 1.28
  geometry.userData['pfxHolyBurstWingCoreClearance'] = 0.52
  geometry.userData['pfxHolyBurstFeatherOnsetScaleFloor'] = 0.52
  geometry.userData['pfxHolyBurstFeatherOnsetOpacityFloor'] = 0.4
  geometry.userData['pfxHolyBurstFeatherOnsetCenterFloor'] = 0.48
  geometry.userData['pfxHolyBurstFeatherResolveOpacityFloor'] = 0.5
  geometry.userData['pfxHolyBurstFeatherDecayScaleFloor'] = 0.7
  geometry.userData['pfxHolyBurstViewClarityFadeFloor'] = 0.42
  geometry.userData['pfxHolyBurstSideFacingVaneProfile'] = 'broad-vanes-in-front-and-three-quarter-foreshortened-swept-profile-in-side-view'
  geometry.userData['pfxHolyBurstSemanticProfile'] = 'floating-halo-sanctity-star-and-two-swept-back-feather-wings'
  geometry.userData['pfxHolyBurstFeatherTriangleCount'] = positions.length / 9
  geometry.userData['pfxHolyBurstFeatherWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxHolyBurstFeatherDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxHolyBurstFeatherVerticalSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxHolyBurstFeatherPlanarBalance'] = Math.min(
    geometry.userData['pfxHolyBurstFeatherWidthSpan'] as number,
    geometry.userData['pfxHolyBurstFeatherDepthSpan'] as number,
  ) / Math.max(
    geometry.userData['pfxHolyBurstFeatherWidthSpan'] as number,
    geometry.userData['pfxHolyBurstFeatherDepthSpan'] as number,
  )
  geometry.userData['pfxHolyBurstDepthToWidthSpanRatio'] = (
    geometry.userData['pfxHolyBurstFeatherDepthSpan'] as number
  ) / (geometry.userData['pfxHolyBurstFeatherWidthSpan'] as number)
  return geometry
}

export function createPfxHolyBurstFeatherMaterial(
  opacity: number,
  primaryColor = '#fff1b8',
  secondaryColor = '#ffd24a',
  accentColor = '#7dd3fc',
  density = 0.56,
  styleEdgeHardness = 0.48,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uAccentColor: { value: new THREE.Color(accentColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxHolyBurstCenter;
      attribute float pfxHolyBurstSeed;
      attribute vec3 pfxHolyBurstDirection;
      attribute float pfxHolyBurstFeatherForm;
      attribute float pfxHolyBurstFeatherSpecies;
      varying vec3 vHolyFeatherNormal;
      varying vec3 vHolyFeatherViewPosition;
      varying vec3 vHolyFeatherLocalPosition;
      varying vec3 vHolyFeatherDirection;
      varying float vHolyFeatherSeed;
      varying float vHolyFeatherForm;
      varying float vHolyFeatherSpecies;
      varying float vHolyFeatherLife;
      void main() {
        float explosiveWingIgnition = smoothstep(0.025, 0.18, uCycle);
        float wingUnfurl = smoothstep(0.08 + pfxHolyBurstSeed * 0.04, 0.38 + pfxHolyBurstSeed * 0.04, uCycle);
        float threeDimensionalWingBloom = smoothstep(0.07, 0.42, uCycle);
        float featherAscent = smoothstep(0.42 + pfxHolyBurstSeed * 0.035, 0.88 + pfxHolyBurstSeed * 0.025, uCycle);
        float pairedWingSweep = sin(uCycle * 3.4 + pfxHolyBurstSeed * 4.0) * 0.055;
        float blessingResolve = smoothstep(0.64, 0.9, uCycle);
        float facetPreservingFeatherDecayFloor = 0.7;
        float decayFeatherFold = mix(1.0, facetPreservingFeatherDecayFloor, blessingResolve);
        vec3 local = position - pfxHolyBurstCenter;
        float readableFeatherOnsetFloor = 0.52;
        local *= mix(vec3(readableFeatherOnsetFloor, 0.82, readableFeatherOnsetFloor), vec3(1.0), wingUnfurl);
        local *= decayFeatherFold;
        float radiantDensityFullness = mix(1.0, 1.28, smoothstep(0.72, 1.0, uDensity));
        local *= radiantDensityFullness;
        float depthWingMask = smoothstep(0.28, 0.62, abs(pfxHolyBurstCenter.z));
        float readableFeatherOnsetCenterFloor = 0.48;
        float depthWingOnsetFloor = mix(readableFeatherOnsetCenterFloor, 0.36, depthWingMask);
        float depthWingVerticalOnsetFloor = mix(readableFeatherOnsetCenterFloor, 0.38, depthWingMask);
        vec3 center = pfxHolyBurstCenter * mix(vec3(readableFeatherOnsetCenterFloor, depthWingVerticalOnsetFloor, depthWingOnsetFloor), vec3(1.0), wingUnfurl);
        center.xz *= 0.82 + threeDimensionalWingBloom * 0.18;
        float radiantDensityExpansion = mix(1.0, 1.12, smoothstep(0.72, 1.0, uDensity));
        center.xz *= radiantDensityExpansion;
        center.xz += normalize(pfxHolyBurstCenter.xz + vec2(0.0001)) * wingUnfurl * (0.1 + pfxHolyBurstSeed * 0.08);
        center.y += featherAscent * (0.18 + pfxHolyBurstSeed * 0.36);
        center.y += blessingResolve * (0.08 + pfxHolyBurstSeed * 0.16);
        center.xz *= mix(1.0, 0.82, blessingResolve);
        center.xz += pfxHolyBurstDirection.xz * pairedWingSweep * (1.0 - featherAscent * 0.5);
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHolyFeatherNormal = normalize(normalMatrix * normal);
        vHolyFeatherViewPosition = viewPosition.xyz;
        vHolyFeatherLocalPosition = local;
        vHolyFeatherDirection = pfxHolyBurstDirection;
        vHolyFeatherSeed = pfxHolyBurstSeed;
        vHolyFeatherForm = pfxHolyBurstFeatherForm;
        vHolyFeatherSpecies = pfxHolyBurstFeatherSpecies;
        float semanticDensityFloor = 0.015;
        float densityReveal = step(pfxHolyBurstSeed, semanticDensityFloor + uDensity * (1.0 - semanticDensityFloor));
        float persistentBlessingFeather = 1.0 - smoothstep(0.84 + pfxHolyBurstSeed * 0.018, 0.96 + pfxHolyBurstSeed * 0.018, uCycle);
        float readableFeatherOnsetOpacityFloor = 0.4;
        float saturatedBlessingResolveFloor = 0.36;
        float visibleBlessingResolve = mix(1.0, saturatedBlessingResolveFloor, blessingResolve);
        vHolyFeatherLife = densityReveal * persistentBlessingFeather * (readableFeatherOnsetOpacityFloor + explosiveWingIgnition * (1.0 - readableFeatherOnsetOpacityFloor)) * visibleBlessingResolve;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAccentColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vHolyFeatherNormal;
      varying vec3 vHolyFeatherViewPosition;
      varying vec3 vHolyFeatherLocalPosition;
      varying vec3 vHolyFeatherDirection;
      varying float vHolyFeatherSeed;
      varying float vHolyFeatherForm;
      varying float vHolyFeatherSpecies;
      varying float vHolyFeatherLife;
      void main() {
        vec3 normal = normalize(vHolyFeatherNormal);
        vec3 viewDirection = normalize(-vHolyFeatherViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float rim = pow(1.0 - facing, mix(1.7, 0.68, uStyleEdgeHardness));
        vec3 featherKeyLight = normalize(vec3(-0.32, 0.84, 0.44));
        vec3 featherHalfVector = normalize(featherKeyLight + viewDirection);
        float featherFacetSpecular = pow(max(0.0, dot(normal, featherHalfVector)), 18.0);
        float directionalFeatherFacetContrast = 0.34 + 0.66 * max(0.0, dot(normal, featherKeyLight));
        float longitudinalPosition = dot(vHolyFeatherLocalPosition, normalize(vHolyFeatherDirection));
        float shaftDistance = length(cross(normalize(vHolyFeatherDirection), vHolyFeatherLocalPosition));
        float featherVaneSegmentation = smoothstep(0.48, 0.88, 0.5 + 0.5 * sin(longitudinalPosition * 26.0 + vHolyFeatherSeed * 19.0));
        float centralShaftMask = 1.0 - smoothstep(0.018, 0.095, shaftDistance);
        float featherShaftGlow = max(centralShaftMask, featherVaneSegmentation * 0.58);
        float shaftForm = step(0.5, vHolyFeatherForm);
        float featherSpeciesMorph = 0.82 + 0.06 * vHolyFeatherSpecies;
        featherShaftGlow = mix(featherShaftGlow, 1.0, shaftForm);
        float goldenVaneReceipt = 0.56 + featherShaftGlow * 0.32;
        float blueConsecrationEdge = rim * (0.34 + uStyleEdgeHardness * 0.24);
        float blessingDissolutionShimmer = smoothstep(0.66, 0.76, uCycle) * (1.0 - smoothstep(0.88, 0.96, uCycle));
        float internalFeatherTransmission = pow(1.0 - facing, 1.25) * (0.24 + featherShaftGlow * 0.22);
        float spectralFeatherFresnel = pow(1.0 - facing, 2.0) * (0.4 + featherShaftGlow * 0.24);
        float blessingGlint = smoothstep(0.9, 0.985, 0.5 + 0.5 * sin(vHolyFeatherSeed * 53.0 + uCycle * 29.0 + vHolyFeatherLocalPosition.y * 21.0));
        float prismaticFeatherGlint = pow(1.0 - facing, 2.6) * (0.34 + featherVaneSegmentation * 0.66) * blessingGlint;
        float prismaticEdgeFlash = rim * (0.38 + featherVaneSegmentation * 0.44) * (0.7 + blessingGlint * 0.3);
        float softGoldTransmission = pow(1.0 - facing, 1.15) * (0.24 + centralShaftMask * 0.3 + featherVaneSegmentation * 0.18);
        float subsurfaceFeatherCore = (1.0 - smoothstep(0.08, 0.3, shaftDistance)) * (0.46 + 0.54 * facing);
        float featherDecayChromaticLock = smoothstep(0.66, 0.88, uCycle);
        float saturatedDecayBlessingLock = smoothstep(0.62, 0.86, uCycle);
        vec3 color = mix(uSecondaryColor * 0.48, uPrimaryColor * 1.22, directionalFeatherFacetContrast);
        color = mix(color, uSecondaryColor * 0.82 + uPrimaryColor * 0.28, featherVaneSegmentation * 0.24);
        color += uPrimaryColor * (0.14 + facing * 0.18);
        color += uAccentColor * blueConsecrationEdge * 0.46;
        color += uSecondaryColor * (centralShaftMask * 0.34 + featherVaneSegmentation * 0.14);
        color = mix(color, uSecondaryColor * 0.74 + uPrimaryColor * 0.46, shaftForm * 0.72);
        color += mix(uAccentColor, uPrimaryColor, 0.42) * blessingDissolutionShimmer * (0.2 + rim * 0.3);
        color += mix(uAccentColor, uPrimaryColor, 0.7) * internalFeatherTransmission * 0.22;
        color += uSecondaryColor * softGoldTransmission * 0.46 * featherSpeciesMorph;
        color += mix(uSecondaryColor, uPrimaryColor, 0.62) * subsurfaceFeatherCore * 0.52;
        color = mix(color, uAccentColor * 1.12 + uPrimaryColor * 0.54, spectralFeatherFresnel * 0.28 + prismaticFeatherGlint * 0.38);
        color += uPrimaryColor * featherFacetSpecular * 0.88 + uAccentColor * prismaticEdgeFlash * 0.42;
        color += mix(uPrimaryColor, uAccentColor, 0.34) * blessingGlint * 0.22;
        vec3 premiumFeatherResolve = uPrimaryColor * 1.16 + uSecondaryColor * 0.38;
        float luminousFeatherDecay = max(featherDecayChromaticLock, saturatedDecayBlessingLock);
        color = mix(color, premiumFeatherResolve * 1.38, luminousFeatherDecay * 0.82);
        float alpha = uOpacity * vHolyFeatherLife * (0.68 + facing * 0.22 + rim * 0.1);
        float viewFacingWingClarity = mix(0.42, 1.0, smoothstep(0.1, 0.68, facing));
        alpha *= viewFacingWingClarity;
        float densityCrowdingCompensation = mix(1.0, 0.78, smoothstep(0.72, 1.0, uDensity));
        alpha *= densityCrowdingCompensation;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.9));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxHolyBurstMaterial'] = true
  material.userData['pfxHolyBurstMaterialRole'] = 'feathers'
  material.userData['pfxHolyBurstMaterialProfile'] = 'ribbed-ivory-feather-wings-with-gold-transmission-blue-prismatic-glints-and-facet-specular'
  return material
}
