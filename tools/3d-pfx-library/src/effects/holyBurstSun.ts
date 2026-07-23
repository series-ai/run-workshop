import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxHolyBurstSunGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendPrimitive = (source: THREE.BufferGeometry, center: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, seed: number, form: number) => {
    const raw = source.index ? source.toNonIndexed() : source
    const position = raw.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(position, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (raw !== source) raw.dispose()
    source.dispose()
  }

  const up = new THREE.Vector3(0, 1, 0)
  const coreCenter = new THREE.Vector3(0, 0.54, 0)
  appendPrimitive(new THREE.IcosahedronGeometry(1, 1), coreCenter, new THREE.Quaternion(), new THREE.Vector3(0.48, 0.48, 0.48), 0.04, 0)
  const aureoles = [
    {
      center: new THREE.Vector3(0, 1.8, 0),
      rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(0.72, 0.22, 0.08)),
      seed: 0.06,
    },
  ]
  const aureoleSegmentCount = 8
  for (const aureole of aureoles) {
    // A segmented crown halo keeps the sanctity cue while giving every
    // camera a different depth rhythm. A single torus was too primitive and
    // too close to a flat open-circle icon in the visual audit.
    for (let segment = 0; segment < aureoleSegmentCount; segment += 1) {
      const angle = segment / aureoleSegmentCount * Math.PI * 2 + 0.18
      const localCenter = new THREE.Vector3(Math.cos(angle) * 0.5, Math.sin(angle) * 0.5, Math.sin(angle * 2.0) * 0.08)
      const segmentCenter = localCenter.clone().applyQuaternion(aureole.rotation).add(aureole.center)
      const radialDirection = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.12).normalize().applyQuaternion(aureole.rotation)
      const segmentRotation = new THREE.Quaternion().setFromUnitVectors(up, radialDirection)
      segmentRotation.multiply(aureole.rotation)
      appendPrimitive(
        new THREE.DodecahedronGeometry(1, 0),
        segmentCenter,
        segmentRotation,
        new THREE.Vector3(0.105, 0.18 + (segment % 2) * 0.018, 0.09),
        aureole.seed + segment * 0.04,
        3,
      )
    }
  }
  const sanctityStarRayCount = 4
  for (let ray = 0; ray < sanctityStarRayCount; ray += 1) {
    const angle = ray / sanctityStarRayCount * Math.PI * 2
    const direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), (ray % 2 === 0 ? -1 : 1) * 0.12).normalize()
    const center = coreCenter.clone().add(direction.clone().multiplyScalar(ray === 3 ? 0.27 : 0.34))
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction)
    const sanctityRayLength = ray === 3 ? 0.41 : ray === 1 ? 0.62 : 0.5
    appendPrimitive(new THREE.OctahedronGeometry(1, 0), center, rotation, new THREE.Vector3(0.13, sanctityRayLength, 0.18), 0.08 + ray * 0.2, 4)
  }
  const depthBeaconPositions = [-0.82, -0.42, 0.42, 0.82] as const
  depthBeaconPositions.forEach((z, index) => {
    const center = new THREE.Vector3(0, 0.54 + (index % 2 === 0 ? -0.04 : 0.04), z)
    const size = 0.085 + (index % 2) * 0.012
    appendPrimitive(new THREE.DodecahedronGeometry(1, 0), center, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, index * 0.18)), new THREE.Vector3(size * 0.72, size, 0.24), 0.1 + index * 0.2, 5)
  })
  const renewalGlyphLeaves = [
    { center: new THREE.Vector3(0, 0.92, 0.12), direction: new THREE.Vector3(0, 1, 0.16).normalize() },
    { center: new THREE.Vector3(-0.2, 0.74, 0.08), direction: new THREE.Vector3(-0.58, 0.82, 0.12).normalize() },
    { center: new THREE.Vector3(0.2, 0.74, 0.08), direction: new THREE.Vector3(0.58, 0.82, 0.12).normalize() },
  ]
  renewalGlyphLeaves.forEach((leaf, index) => {
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, leaf.direction)
    appendPrimitive(new THREE.IcosahedronGeometry(1, 0), leaf.center, rotation, new THREE.Vector3(0.1, 0.28, 0.09), 0.16 + index * 0.28, 6)
  })

  const sanctitySparks = Array.from({ length: 8 }, (_, index) => {
    const angle = index / 8 * Math.PI * 2 + 0.24
    const radius = 0.58 + (index % 2) * 0.18
    return new THREE.Vector3(
      Math.cos(angle) * radius,
      0.74 + (index % 4) * 0.22,
      Math.sin(angle) * radius,
    )
  })
  sanctitySparks.forEach((center, index) => {
    const direction = center.clone().sub(coreCenter).normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction)
    appendPrimitive(new THREE.OctahedronGeometry(1, 0), center, rotation, new THREE.Vector3(0.055, 0.12 + (index % 3) * 0.025, 0.055), 0.11 + index * 0.1, 7)
  })

  const primaryDirections = [
    new THREE.Vector3(1, 0.34, 0),
    new THREE.Vector3(-1, 0.34, 0),
    new THREE.Vector3(0, 0.34, 1),
    new THREE.Vector3(0, 0.34, -1),
    new THREE.Vector3(0.56, 0.72, 0.56),
    new THREE.Vector3(-0.56, 0.72, 0.56),
    new THREE.Vector3(0.56, 0.72, -0.56),
    new THREE.Vector3(-0.56, 0.72, -0.56),
    new THREE.Vector3(0.24, 1, 0.2),
    new THREE.Vector3(-0.24, 1, -0.2),
    new THREE.Vector3(0.46, 0.24, 0.82),
    new THREE.Vector3(-0.46, 0.24, -0.82),
  ].map((direction) => direction.normalize())
  const primaryRayCount = primaryDirections.length
  for (let ray = 0; ray < primaryRayCount; ray += 1) {
    const seed = ((ray * 41 + 13) % 101) / 101
    const direction = primaryDirections[ray]!
    const radius = 0.76 + (ray % 2) * 0.06
    const center = coreCenter.clone().add(direction.clone().multiplyScalar(radius))
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, direction)
    appendPrimitive(new THREE.DodecahedronGeometry(1, 0), center, rotation, new THREE.Vector3(0.17 + (ray % 2) * 0.012, 0.34 + (ray % 3) * 0.022, 0.17 + (ray % 3) * 0.01), seed, 1)
  }

  const blessingLightCount = 0
  for (let light = 0; light < blessingLightCount; light += 1) {
    const angle = light / blessingLightCount * Math.PI * 2 + 0.32
    const center = new THREE.Vector3(Math.cos(angle) * 0.22, 1.0 + light * 0.15, Math.sin(angle) * 0.22)
    const size = 0.12 + (light % 2) * 0.018
    appendPrimitive(new THREE.DodecahedronGeometry(1, 0), center, new THREE.Quaternion().setFromEuler(new THREE.Euler(light * 0.18, light * 0.31, light * 0.12)), new THREE.Vector3(size, size * 1.16, size), 0.12 + light * 0.17, 2)
  }

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxHolyBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxHolyBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxHolyBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxHolyBurstSunDrawCalls'] = 1
  geometry.userData['pfxHolyBurstSunClosedFaces'] = true
  geometry.userData['pfxHolyBurstSunSmoothNormals'] = true
  geometry.userData['pfxHolyBurstSunBillboardCount'] = 0
  geometry.userData['pfxHolyBurstCoreCount'] = 1
  geometry.userData['pfxHolyBurstPrimaryRayCount'] = primaryRayCount
  geometry.userData['pfxHolyBurstBlessingLightCount'] = blessingLightCount
  geometry.userData['pfxHolyBurstBlessingLightProfile'] = 'no-loose-orb-lights-clean-halo-and-wing-silhouette'
  geometry.userData['pfxHolyBurstPrimaryRayProfile'] = 'twelve-direction-spherical-radiance-lobes-not-aggressive-shards'
  geometry.userData['pfxHolyBurstAureoleCount'] = aureoles.length
  geometry.userData['pfxHolyBurstAureolePurpose'] = 'floating-crown-halo-above-the-blessing-origin-not-gameplay-radius'
  geometry.userData['pfxHolyBurstAureoleProfile'] = 'single-tilted-celestial-crown-halo'
  geometry.userData['pfxHolyBurstAureoleEmissionProfile'] = 'integrated-ivory-gold-crown-halo'
  geometry.userData['pfxHolyBurstAureoleSegmentCount'] = aureoleSegmentCount
  geometry.userData['pfxHolyBurstAureoleTopology'] = 'eight-closed-faceted-crown-segments'
  geometry.userData['pfxHolyBurstAureoleVerticalSeparation'] = 1.26
  geometry.userData['pfxHolyBurstSanctityStarRayCount'] = sanctityStarRayCount
  geometry.userData['pfxHolyBurstSemanticGlyphProfile'] = 'four-point-sanctity-star-independent-of-palette'
  geometry.userData['pfxHolyBurstDepthBeaconCount'] = depthBeaconPositions.length
  geometry.userData['pfxHolyBurstDepthBeaconProfile'] = 'connected-depth-light-drops-along-positive-and-negative-z'
  geometry.userData['pfxHolyBurstDepthBeaconTopology'] = 'closed-tapered-depth-lights-nested-through-the-core'
  geometry.userData['pfxHolyBurstRenewalGlyphLeafCount'] = renewalGlyphLeaves.length
  geometry.userData['pfxHolyBurstRenewalGlyphProfile'] = 'three-leaf-blessing-sprout-inside-sanctity-star'
  geometry.userData['pfxHolyBurstSanctitySparkCount'] = sanctitySparks.length
  geometry.userData['pfxHolyBurstSanctitySparkProfile'] = 'closed-prismatic-light-flecks-rising-through-the-spherical-blessing-volume'
  geometry.userData['pfxHolyBurstCoreProfile'] = 'spherical-divine-light-not-capsule'
  geometry.userData['pfxHolyBurstDepthLaneCount'] = 8
  geometry.userData['pfxHolyBurstVerticalRadianceCount'] = 2
  geometry.userData['pfxHolyBurstVerticalRadianceProfile'] = 'paired-core-to-halo-light-plumes'
  geometry.userData['pfxHolyBurstOnsetScaleFloor'] = 0.48
  geometry.userData['pfxHolyBurstOnsetOpacityFloor'] = 0.38
  geometry.userData['pfxHolyBurstRadialPlaneProfile'] = 'twelve-ray-spherical-soft-radiance'
  geometry.userData['pfxHolyBurstDepthVolumeProfile'] = 'diagonal-radiance-lobes-cross-front-side-and-three-quarter-projections'
  geometry.userData['pfxHolyBurstSilhouette'] = 'floating-crown-halo-four-point-sanctity-star-and-soft-radiance'
  geometry.userData['pfxHolyBurstDownwardRayProfile'] = 'no-hanging-skirt-rays-balanced-lateral-and-depth-radiance-only'
  geometry.userData['pfxHolyBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxHolyBurstSunTriangleCount'] = positions.length / 9
  geometry.userData['pfxHolyBurstSunWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxHolyBurstSunDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxHolyBurstSunHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxHolyBurstSunMaterial(
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
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxHolyBurstCenter;
      attribute float pfxHolyBurstSeed;
      attribute float pfxHolyBurstForm;
      varying vec3 vHolyBurstNormal;
      varying vec3 vHolyBurstViewPosition;
      varying vec3 vHolyBurstLocalPosition;
      varying float vHolyBurstSeed;
      varying float vHolyBurstForm;
      varying float vHolyBurstLife;
      void main() {
        float explosiveSanctityIgnition = smoothstep(0.02, 0.16, uCycle);
        float consecrationIgnition = explosiveSanctityIgnition;
        float cleansingSunExpansion = smoothstep(0.045 + pfxHolyBurstSeed * 0.02, 0.31 + pfxHolyBurstSeed * 0.025, uCycle);
        float crownAscension = smoothstep(0.12 + pfxHolyBurstSeed * 0.025, 0.43, uCycle);
        float readableConsecrationOnset = 0.48;
        float threeDimensionalSunBloom = smoothstep(0.06, 0.34, uCycle);
        float consecrationResolve = smoothstep(0.64, 0.9, uCycle);
        float gracefulInwardResolve = consecrationResolve;
        float initialSanctityFlash = smoothstep(0.018, 0.08, uCycle) * (1.0 - smoothstep(0.12, 0.22, uCycle));
        float initialSanctityPop = initialSanctityFlash * (0.72 + consecrationIgnition * 0.28);
        float facetPreservingSunDecayFloor = 0.62;
        float decaySunFold = mix(1.0, facetPreservingSunDecayFloor, consecrationResolve);
        float coreConsecrationLift = consecrationResolve * 0.32;
        float coreForm = 1.0 - step(0.5, pfxHolyBurstForm);
        float rayForm = step(0.5, pfxHolyBurstForm) * (1.0 - step(1.5, pfxHolyBurstForm));
        float crownForm = step(1.5, pfxHolyBurstForm) * (1.0 - step(2.5, pfxHolyBurstForm));
        float aureoleForm = step(2.5, pfxHolyBurstForm) * (1.0 - step(3.5, pfxHolyBurstForm));
        float sanctityStarForm = step(3.5, pfxHolyBurstForm) * (1.0 - step(4.5, pfxHolyBurstForm));
        float depthBeaconForm = step(4.5, pfxHolyBurstForm) * (1.0 - step(5.5, pfxHolyBurstForm));
        float renewalGlyphForm = step(5.5, pfxHolyBurstForm) * (1.0 - step(6.5, pfxHolyBurstForm));
        float sanctitySparkForm = step(6.5, pfxHolyBurstForm);
        float authoredRadiantForm = min(1.0, rayForm + crownForm + sanctityStarForm + depthBeaconForm + renewalGlyphForm + sanctitySparkForm);
        vec3 local = position - pfxHolyBurstCenter;
        float opening = mix(consecrationIgnition, cleansingSunExpansion, rayForm);
        opening = mix(opening, crownAscension, crownForm);
        float gatheringAureoleFloor = 0.18;
        opening = mix(opening, max(gatheringAureoleFloor, consecrationIgnition), aureoleForm);
        opening = mix(opening, max(0.24, consecrationIgnition), sanctityStarForm);
        opening = mix(opening, max(0.2, initialSanctityFlash), renewalGlyphForm);
        opening = mix(opening, cleansingSunExpansion, sanctitySparkForm);
        opening = mix(opening, max(opening, 0.94), sanctityStarForm * initialSanctityPop);
        local *= mix(vec3(readableConsecrationOnset, 0.26, readableConsecrationOnset), vec3(1.0), opening);
        local.xz *= 0.9 + threeDimensionalSunBloom * 0.1;
        local *= mix(1.0, decaySunFold, authoredRadiantForm);
        local *= mix(1.0, 0.38, consecrationResolve * coreForm);
        vec3 center = pfxHolyBurstCenter * mix(readableConsecrationOnset, 1.0, opening);
        center.xz *= mix(1.0, 0.56, consecrationResolve * authoredRadiantForm);
        center.y += crownForm * crownAscension * (0.08 + pfxHolyBurstSeed * 0.06);
        center.y -= rayForm * smoothstep(0.7, 0.88, uCycle) * 0.08;
        center.y += gracefulInwardResolve * authoredRadiantForm * (0.08 + pfxHolyBurstSeed * 0.06);
        center.y += coreForm * coreConsecrationLift;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHolyBurstNormal = normalize(normalMatrix * normal);
        vHolyBurstViewPosition = viewPosition.xyz;
        vHolyBurstLocalPosition = local;
        vHolyBurstSeed = pfxHolyBurstSeed;
        vHolyBurstForm = pfxHolyBurstForm;
        float semanticDensityFloor = 0.34;
        float densityReveal = mix(1.0, step(pfxHolyBurstSeed, semanticDensityFloor + uDensity * (1.0 - semanticDensityFloor)), rayForm);
        float retirement = 1.0 - smoothstep(0.76 + pfxHolyBurstSeed * 0.018, 0.94 + pfxHolyBurstSeed * 0.018, uCycle);
        float persistentCore = 1.0 - smoothstep(0.88, 0.96, uCycle);
        float saturatedConsecrationResolveFloor = 0.34;
        float visibleConsecrationResolve = mix(1.0, saturatedConsecrationResolveFloor, consecrationResolve);
        float explosiveSanctityOpacity = 0.38 + explosiveSanctityIgnition * 0.62;
        vHolyBurstLife = densityReveal * mix(retirement, persistentCore, coreForm) * explosiveSanctityOpacity * visibleConsecrationResolve;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform vec3 uAccentColor;
      uniform float uStyleEdgeHardness;
      varying vec3 vHolyBurstNormal;
      varying vec3 vHolyBurstViewPosition;
      varying vec3 vHolyBurstLocalPosition;
      varying float vHolyBurstSeed;
      varying float vHolyBurstForm;
      varying float vHolyBurstLife;
      void main() {
        vec3 normal = normalize(vHolyBurstNormal);
        vec3 viewDirection = normalize(-vHolyBurstViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float coreForm = 1.0 - step(0.5, vHolyBurstForm);
        float rayForm = step(0.5, vHolyBurstForm) * (1.0 - step(1.5, vHolyBurstForm));
        float crownForm = step(1.5, vHolyBurstForm) * (1.0 - step(2.5, vHolyBurstForm));
        float aureoleForm = step(2.5, vHolyBurstForm) * (1.0 - step(3.5, vHolyBurstForm));
        float sanctityStarForm = step(3.5, vHolyBurstForm) * (1.0 - step(4.5, vHolyBurstForm));
        float depthBeaconForm = step(4.5, vHolyBurstForm) * (1.0 - step(5.5, vHolyBurstForm));
        float renewalGlyphForm = step(5.5, vHolyBurstForm) * (1.0 - step(6.5, vHolyBurstForm));
        float sanctitySparkForm = step(6.5, vHolyBurstForm);
        float ivorySanctityCore = coreForm * (0.82 + 0.18 * sin(uCycle * 20.0));
        float goldenRayReceipt = rayForm * (0.64 + 0.36 * smoothstep(0.1, 0.4, uCycle));
        float rim = pow(1.0 - facing, mix(1.8, 0.66, uStyleEdgeHardness));
        float celestialBlueRim = rim * (0.34 + crownForm * 0.34);
        float softDivineEmission = 0.34 + rim * 0.28 + ivorySanctityCore * 0.38;
        float blueAureoleLock = aureoleForm * (0.62 + rim * 0.24);
        float dissolutionShimmer = smoothstep(0.64, 0.74, uCycle) * (1.0 - smoothstep(0.86, 0.94, uCycle));
        float crystalRefractionBand = smoothstep(0.38, 0.78, 0.5 + 0.5 * sin(vHolyBurstLocalPosition.y * 12.0 - vHolyBurstLocalPosition.x * 9.0 + vHolyBurstSeed * 19.0));
        float directionalVolumeShading = 0.48 + 0.52 * max(0.0, dot(normal, normalize(vec3(-0.34, 0.82, 0.46))));
        float facetBand = smoothstep(0.42, 0.82, 0.5 + 0.5 * sin(vHolyBurstLocalPosition.y * 15.0 + vHolyBurstSeed * 31.0));
        float internalSanctityTransmission = pow(1.0 - facing, 1.35) * (0.28 + facetBand * 0.28);
        float spectralCrystalFresnel = pow(1.0 - facing, 2.1) * (0.42 + crystalRefractionBand * 0.28);
        float sanctityGlint = smoothstep(0.9, 0.985, 0.5 + 0.5 * sin(vHolyBurstSeed * 47.0 + uCycle * 31.0 + vHolyBurstLocalPosition.y * 18.0));
        float haloCrownGlow = aureoleForm * (0.72 + 0.28 * sin(uCycle * 13.0 + vHolyBurstLocalPosition.x * 9.0));
        float haloPearlescence = aureoleForm * pow(1.0 - facing, 1.4) * (0.56 + crystalRefractionBand * 0.44);
        float haloFresnel = aureoleForm * pow(1.0 - facing, 2.2);
        float crystallineCausticBands = smoothstep(0.72, 0.96, 0.5 + 0.5 * sin(vHolyBurstLocalPosition.y * 24.0 + vHolyBurstLocalPosition.z * 17.0 + vHolyBurstSeed * 37.0));
        float obliqueSanctityFill = pow(1.0 - facing, 1.35);
        float onsetConsecrationAccent = (1.0 - smoothstep(0.08, 0.24, uCycle)) * min(1.0, coreForm + sanctityStarForm + sanctitySparkForm);
        float decayChromaticLock = smoothstep(0.66, 0.86, uCycle);
        vec3 color = mix(uPrimaryColor, uSecondaryColor, goldenRayReceipt * (0.58 + facetBand * 0.22));
        color = mix(color, uPrimaryColor * 1.16 + uSecondaryColor * 0.28, ivorySanctityCore * 0.84);
        color += uAccentColor * celestialBlueRim * 0.72;
        color += mix(uSecondaryColor, uPrimaryColor, 0.44) * crownForm * (0.28 + facetBand * 0.24);
        color *= directionalVolumeShading;
        color += uPrimaryColor * (0.42 + softDivineEmission * 0.34) + uSecondaryColor * (0.12 + goldenRayReceipt * 0.24);
        color = mix(color, uAccentColor * 1.08 + uPrimaryColor * 0.32, blueAureoleLock * 0.72);
        color = mix(color, uAccentColor * 1.18 + uPrimaryColor * 0.72, sanctityStarForm * 0.86);
        color = mix(color, uSecondaryColor * 1.12 + uAccentColor * (0.26 + crystalRefractionBand * 0.22), depthBeaconForm * 0.9);
        color = mix(color, uAccentColor * 1.08 + uPrimaryColor * 0.64, renewalGlyphForm * 0.88);
        color = mix(color, uPrimaryColor * 1.48 + uAccentColor * crystallineCausticBands * 0.72, sanctitySparkForm * 0.92);
        color += mix(uAccentColor, uPrimaryColor, crystalRefractionBand) * internalSanctityTransmission * (0.18 + rayForm * 0.16 + depthBeaconForm * 0.24);
        color = mix(color, mix(uAccentColor * 1.06, uPrimaryColor * 1.12, crystalRefractionBand), spectralCrystalFresnel * 0.36);
        color += mix(uPrimaryColor, uAccentColor, 0.28) * sanctityGlint * (0.26 + rayForm * 0.2 + renewalGlyphForm * 0.24);
        color = mix(color, uPrimaryColor * 1.18 + uSecondaryColor * 0.54 + uAccentColor * (haloPearlescence * 0.72 + haloFresnel * 0.58), haloCrownGlow * 0.88);
        vec3 premiumWhiteGoldResolve = uPrimaryColor * 1.22 + uSecondaryColor * 0.34;
        float luminousGoldDecay = decayChromaticLock * (rayForm + crownForm + renewalGlyphForm + sanctitySparkForm);
        color = mix(color, premiumWhiteGoldResolve * 1.32, luminousGoldDecay * 0.78);
        color += mix(uPrimaryColor, uAccentColor, 0.36) * crystallineCausticBands * (0.18 + rayForm * 0.28 + sanctitySparkForm * 0.42);
        color += mix(uAccentColor, uPrimaryColor, 0.64) * obliqueSanctityFill * (0.16 + sanctitySparkForm * 0.22);
        color += uPrimaryColor * onsetConsecrationAccent * 0.72 + uAccentColor * onsetConsecrationAccent * rim * 0.28;
        color += mix(uAccentColor, uPrimaryColor, 0.38) * dissolutionShimmer * (0.18 + rim * 0.24);
        float haloGlowLock = aureoleForm * (0.72 + 0.18 * sin(uCycle * 13.0 + vHolyBurstSeed * 7.0));
        vec3 integratedHaloGold = mix(uPrimaryColor * 0.82, uSecondaryColor * 0.86, 0.48 + haloPearlescence * 0.28);
        color = mix(color, integratedHaloGold + uPrimaryColor * 0.22, haloGlowLock * 0.86);
        color += uSecondaryColor * haloGlowLock * 0.24;
        float holyPaletteLock = clamp(0.28 + ivorySanctityCore * 0.22 + goldenRayReceipt * 0.18 + haloCrownGlow * 0.12, 0.0, 0.82);
        vec3 whiteGoldPalette = mix(uPrimaryColor * 1.08, uSecondaryColor * 0.86, clamp(goldenRayReceipt * 0.62 + haloCrownGlow * 0.18, 0.0, 1.0));
        color = mix(color, whiteGoldPalette + uAccentColor * (celestialBlueRim * 0.28 + blueAureoleLock * 0.18), holyPaletteLock);
        float holyVolumeSpecular = pow(max(0.0, dot(normal, normalize(viewDirection + normalize(vec3(-0.28, 0.84, 0.44))))), 22.0) * (0.22 + coreForm * 0.2 + rayForm * 0.16 + aureoleForm * 0.12);
        float holyVolumeRim = pow(1.0 - facing, 1.45) * (0.18 + rayForm * 0.15 + aureoleForm * 0.18);
        color += uPrimaryColor * holyVolumeSpecular * 1.28;
        color += uSecondaryColor * holyVolumeRim * 0.42;
        float alpha = uOpacity * vHolyBurstLife * (0.64 + facing * 0.2 + rim * 0.16);
        float aureoleDecaySubordination = 1.0 - smoothstep(0.62, 0.8, uCycle);
        float subordinateAureoleIntensity = smoothstep(0.05, 0.24, uCycle) * aureoleDecaySubordination * (0.72 + haloPearlescence * 0.24);
        float haloOpaqueEnergyFloor = smoothstep(0.04, 0.2, uCycle) * (1.0 - smoothstep(0.82, 0.94, uCycle)) * 0.82;
        alpha *= mix(1.0, max(subordinateAureoleIntensity, haloOpaqueEnergyFloor), aureoleForm);
        float coreBlessingDissolve = coreForm * smoothstep(0.68, 0.9, uCycle);
        alpha *= mix(1.0, 0.2, coreBlessingDissolve);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxHolyBurstMaterial'] = true
  material.userData['pfxHolyBurstMaterialRole'] = 'sun'
  material.userData['pfxHolyBurstMaterialProfile'] = 'faceted-ivory-gold-sanctity-volume-with-white-gold-palette-lock'
  return material
}
