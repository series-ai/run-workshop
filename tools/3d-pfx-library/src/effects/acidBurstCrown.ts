import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export function createPfxAcidBurstCrownGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const appendGeometry = (source: THREE.BufferGeometry, center: THREE.Vector3, seed: number, form: number) => {
    const nonIndexed = source.index ? source.toNonIndexed() : source
    const sourcePositions = nonIndexed.getAttribute('position')
    for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(form)
    }
    if (nonIndexed !== source) nonIndexed.dispose()
    source.dispose()
  }

  const pool = new THREE.SphereGeometry(1, 14, 6)
  pool.scale(0.96, 1.08, 0.94)
  pool.translate(0, 0.46, 0)
  appendGeometry(pool, new THREE.Vector3(0, 0.46, 0), 0.5, 0)

  const groundLobeCount = 9
  const groundLobeRadii = [0.48, 0.98, 0.64, 1.14, 0.54, 0.9, 0.61, 1.06, 0.73] as const
  for (let lobe = 0; lobe < groundLobeCount; lobe += 1) {
    const seed = ((lobe * 31 + 7) % 97) / 97
    const angle = lobe / groundLobeCount * Math.PI * 2 + (seed - 0.5) * 0.4
    const radius = groundLobeRadii[lobe]!
    const center = new THREE.Vector3(Math.cos(angle) * radius * 1.18, 0.3 + (lobe % 3) * 0.09, Math.sin(angle) * radius * 1.08)
    const lobeGeometry = new THREE.SphereGeometry(1, 9, 4)
    lobeGeometry.scale(0.56 + (lobe % 3) * 0.055, 0.68 + (lobe % 3) * 0.11, 0.52 + ((lobe + 2) % 3) * 0.055)
    lobeGeometry.rotateY(-angle * 0.42)
    lobeGeometry.translate(center.x, center.y, center.z)
    appendGeometry(lobeGeometry, center, seed, 1)
  }

  const edgeSpillLobeCount = 4
  for (let spill = 0; spill < edgeSpillLobeCount; spill += 1) {
    const seed = 0.16 + spill * 0.21
    const angle = spill / edgeSpillLobeCount * Math.PI * 2 + 0.24
    const radius = 0.92 + (spill % 2) * 0.14
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.035, Math.sin(angle) * radius * 0.86)
    const spillGeometry = new THREE.IcosahedronGeometry(1, 0)
    spillGeometry.scale(0.3 + (spill % 2) * 0.07, 0.24, 0.2 + ((spill + 1) % 2) * 0.06)
    spillGeometry.rotateY(-angle * 0.46)
    spillGeometry.translate(center.x, center.y, center.z)
    appendGeometry(spillGeometry, center, seed, 0)
  }

  const raisedBlisterCount = 5
  for (let blister = 0; blister < raisedBlisterCount; blister += 1) {
    const seed = ((blister * 37 + 19) % 101) / 101
    const angle = blister / raisedBlisterCount * Math.PI * 2 + seed * 0.5
    const radius = 0.18 + (blister % 3) * 0.16
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.4 + (blister % 3) * 0.15, Math.sin(angle) * radius * 0.9)
    const blisterGeometry = new THREE.SphereGeometry(1, 9, 5)
    blisterGeometry.scale(0.2 + (blister % 2) * 0.055, 0.3 + (blister % 3) * 0.08, 0.18 + ((blister + 1) % 2) * 0.05)
    blisterGeometry.translate(center.x, center.y, center.z)
    appendGeometry(blisterGeometry, center, seed, 1)
  }

  const sizzlingFoamLobeCount = 7
  for (let foam = 0; foam < sizzlingFoamLobeCount; foam += 1) {
    const seed = ((foam * 29 + 23) % 103) / 103
    const angle = foam / sizzlingFoamLobeCount * Math.PI * 2 + seed * 0.36
    const radius = 0.2 + (foam % 3) * 0.13
    const center = new THREE.Vector3(Math.cos(angle) * radius, 0.31 + (foam % 4) * 0.11, Math.sin(angle) * radius * 1.12)
    const foamGeometry = new THREE.DodecahedronGeometry(1, 0)
    const size = 0.12 + (foam % 3) * 0.025
    foamGeometry.scale(size * 1.08, size * (1.18 + (foam % 2) * 0.18), size)
    foamGeometry.translate(center.x, center.y, center.z)
    appendGeometry(foamGeometry, center, seed, 1.25)
  }

  const contactFlashCoreCount = 1
  const contactFlashCenter = new THREE.Vector3(0, 0.34, 0)
  const contactFlashGeometry = new THREE.IcosahedronGeometry(1, 0)
  contactFlashGeometry.scale(0.34, 0.42, 0.34)
  contactFlashGeometry.translate(contactFlashCenter.x, contactFlashCenter.y, contactFlashCenter.z)
  appendGeometry(contactFlashGeometry, contactFlashCenter, 0.42, 3)
  const onsetFlashJetCount = 3
  for (let jet = 0; jet < onsetFlashJetCount; jet += 1) {
    const center = new THREE.Vector3((jet - 1) * 0.24, 0.56 + (jet === 1 ? 0.18 : jet * 0.04), jet === 1 ? 0.16 : -0.05)
    const flashJetGeometry = new THREE.ConeGeometry(0.18 + jet * 0.025, 1.16 + jet * 0.14, 6, 1, false)
    flashJetGeometry.rotateZ((jet - 1) * 0.18)
    flashJetGeometry.rotateX((jet - 1) * -0.1)
    flashJetGeometry.translate(center.x, center.y, center.z)
    appendGeometry(flashJetGeometry, center, 0.26 + jet * 0.19, 3)
  }

  const tendrilCount = 13
  const tendrilLengths = [1.34, 1.84, 1.52, 2.18, 1.66, 1.42, 2.02, 1.6, 2.12, 1.48, 1.8, 1.64, 1.94] as const
  for (let tendril = 0; tendril < tendrilCount; tendril += 1) {
    const seed = ((tendril * 43 + 11) % 101) / 101
    const angle = tendril / tendrilCount * Math.PI * 2 + (seed - 0.5) * 0.46
    const direction = new THREE.Vector3(
      Math.cos(angle) * (0.74 + (tendril % 4) * 0.12),
      0.58 + ((tendril * 3) % 5) * 0.065,
      Math.sin(angle) * (0.76 + ((tendril + 2) % 4) * 0.11),
    ).normalize()
    const center = new THREE.Vector3(
      Math.cos(angle) * (0.46 + (tendril % 3) * 0.065),
      0.55 + ((tendril * 2) % 5) * 0.06,
      Math.sin(angle) * (0.43 + ((tendril + 1) % 3) * 0.07),
    )
    const tendrilGeometry = new THREE.ConeGeometry(0.085 + (tendril % 5) * 0.012, tendrilLengths[tendril]!, 7, 3, false)
    tendrilGeometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    tendrilGeometry.rotateY((seed - 0.5) * 0.8)
    tendrilGeometry.translate(center.x, center.y, center.z)
    appendGeometry(tendrilGeometry, center, seed, 2)
    const tipCenter = center.clone().add(direction.clone().multiplyScalar(tendrilLengths[tendril]! * 0.5))
    const tipBulbGeometry = new THREE.SphereGeometry(1, 10, 5)
    const tipRadius = 0.09 + (tendril % 4) * 0.011
    tipBulbGeometry.scale(tipRadius * 0.86, tipRadius * 1.28, tipRadius)
    tipBulbGeometry.translate(tipCenter.x, tipCenter.y, tipCenter.z)
    appendGeometry(tipBulbGeometry, tipCenter, seed, 2)
  }

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxAcidBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxAcidBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxAcidBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxAcidBurstCrownDrawCalls'] = 1
  geometry.userData['pfxAcidBurstCrownClosedFaces'] = true
  geometry.userData['pfxAcidBurstCrownSmoothNormals'] = true
  geometry.userData['pfxAcidBurstCrownWorldSpaceVolume'] = true
  geometry.userData['pfxAcidBurstCrownBillboardCount'] = 0
  geometry.userData['pfxAcidBurstFilledPoolCount'] = 1
  geometry.userData['pfxAcidBurstPoolVerticalThickness'] = 1.08
  geometry.userData['pfxAcidBurstGroundLobeCount'] = groundLobeCount
  geometry.userData['pfxAcidBurstGroundLobeHeightRange'] = [0.68, 0.9]
  geometry.userData['pfxAcidBurstPeakVerticalExtensionRatio'] = 1.4
  geometry.userData['pfxAcidBurstEdgeSpillLobeCount'] = edgeSpillLobeCount
  geometry.userData['pfxAcidBurstRaisedBlisterCount'] = raisedBlisterCount
  geometry.userData['pfxAcidBurstRaisedBlisterHeightRange'] = [0.4, 0.7]
  geometry.userData['pfxAcidBurstSizzlingFoamLobeCount'] = sizzlingFoamLobeCount
  geometry.userData['pfxAcidBurstDecayBubbleCount'] = sizzlingFoamLobeCount
  geometry.userData['pfxAcidBurstDecayBubbleRiseRange'] = [0.03, 0.08]
  geometry.userData['pfxAcidBurstDecayDetachedGeometryCount'] = 0
  geometry.userData['pfxAcidBurstResidualSpatterTrailCount'] = 0
  geometry.userData['pfxAcidBurstContactFlashCoreCount'] = contactFlashCoreCount
  geometry.userData['pfxAcidBurstOnsetFlashJetCount'] = onsetFlashJetCount
  geometry.userData['pfxAcidBurstOnsetPlumeTopology'] = 'three-closed-tapered-liquid-plumes'
  geometry.userData['pfxAcidBurstOnsetPlumeColorProfile'] = 'acid-secondary-not-neutral-white'
  geometry.userData['pfxAcidBurstOnsetPlumeSpreadRadius'] = 0.24
  geometry.userData['pfxAcidBurstOnsetPlumeLayout'] = 'front-readable-asymmetric-trident'
  geometry.userData['pfxAcidBurstOnsetVerticalProfile'] = 'raised-pool-with-tall-contact-plume'
  geometry.userData['pfxAcidBurstOnsetFootprintProfile'] = 'asymmetric-broken-lobe-splat'
  geometry.userData['pfxAcidBurstTendrilCount'] = tendrilCount
  geometry.userData['pfxAcidBurstTendrilTipBulbCount'] = tendrilCount
  geometry.userData['pfxAcidBurstAsymmetricFootprint'] = true
  geometry.userData['pfxAcidBurstSilhouette'] = 'wide-radial-corrosive-crown-with-whip-tendrils'
  geometry.userData['pfxAcidBurstOnsetProfile'] = 'bright-contact-flash-from-filled-acid-seed'
  geometry.userData['pfxAcidBurstOnsetVisibility'] = 'readable-from-first-sampled-frame'
  geometry.userData['pfxAcidBurstOnsetFootprintScale'] = 0.98
  geometry.userData['pfxAcidBurstDecayProfile'] = 'clean-attached-basin-after-complete-tendril-retirement'
  geometry.userData['pfxAcidBurstDecayContrastProfile'] = 'luminous-active-corrosion-residue'
  geometry.userData['pfxAcidBurstDensityProfile'] = 'continuous-low-default-max-element-population'
  geometry.userData['pfxAcidBurstDensityRevealRange'] = [0.18, 1]
  geometry.userData['pfxAcidBurstResidueProfile'] = 'overlapping-scalloped-pool-not-ring'
  geometry.userData['pfxAcidBurstPoolThicknessProfile'] = 'raised-irregular-caustic-basin'
  geometry.userData['pfxAcidBurstVerticalBasinProfile'] = 'five-level-faceted-central-mass'
  geometry.userData['pfxAcidBurstTopology'] = 'filled-pool-overlapping-ground-lobes-and-curved-closed-tendrils'
  geometry.userData['pfxAcidBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxAcidBurstCrownTriangleCount'] = positions.length / 9
  geometry.userData['pfxAcidBurstCrownWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxAcidBurstCrownDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxAcidBurstCrownHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxAcidBurstCrownMaterial(
  opacity: number,
  primaryColor = '#3f9f2f',
  secondaryColor = '#d9ff47',
  density = 0.58,
  styleEdgeHardness = 0.52,
  accentColor = '#67e8f9',
): THREE.ShaderMaterial {
  const isNeonEmissive = styleEdgeHardness >= 0.72
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
      uAccentColor: { value: new THREE.Color(accentColor) },
    },
    transparent: true,
    blending: isNeonEmissive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      uniform float uDensity;
      attribute vec3 pfxAcidBurstCenter;
      attribute float pfxAcidBurstSeed;
      attribute float pfxAcidBurstForm;
      varying vec3 vAcidBurstNormal;
      varying vec3 vAcidBurstViewPosition;
      varying vec3 vAcidBurstLocalPosition;
      varying float vAcidBurstSeed;
      varying float vAcidBurstForm;
      varying float vAcidBurstLife;
      void main() {
        float causticEruption = smoothstep(0.04 + pfxAcidBurstSeed * 0.012, 0.28 + pfxAcidBurstSeed * 0.025, uCycle);
        float gravityCollapse = smoothstep(0.43, 0.8, uCycle);
        float impactFlashForm = step(2.5, pfxAcidBurstForm);
        float tendrilForm = step(1.5, pfxAcidBurstForm) * (1.0 - impactFlashForm);
        float groundForm = step(0.5, pfxAcidBurstForm) * (1.0 - tendrilForm) * (1.0 - impactFlashForm);
        float groundResidueForm = 1.0 - max(tendrilForm, impactFlashForm);
        float decayBubbleForm = step(1.1, pfxAcidBurstForm) * (1.0 - step(1.5, pfxAcidBurstForm));
        vec3 local = position - pfxAcidBurstCenter;
        float onsetExpansion = smoothstep(0.0, 0.14, uCycle);
        float volumetricOnsetThickness = mix(0.82, 1.0, causticEruption);
        local.y *= volumetricOnsetThickness;
        local.xz *= mix(0.98, 1.0, onsetExpansion);
        float tendrilWhip = sin(pfxAcidBurstSeed * 31.0 + uCycle * 9.0) * causticEruption * (1.0 - gravityCollapse);
        float viscousTendrilCurl = local.y * local.y * (0.08 + pfxAcidBurstSeed * 0.1);
        local.x += (local.y * tendrilWhip * 0.18 + viscousTendrilCurl) * tendrilForm;
        local.z += (local.y * cos(pfxAcidBurstSeed * 23.0 + uCycle * 8.0) * 0.14 - viscousTendrilCurl * 0.72) * tendrilForm;
        float residueContraction = mix(1.0, 0.56, gravityCollapse);
        local.xz *= mix(residueContraction, 1.0, tendrilForm);
        float tendrilGroundCollapse = mix(1.0, 0.16, gravityCollapse);
        local.y *= mix(1.0, tendrilGroundCollapse, tendrilForm);
        float groundResidueSettle = smoothstep(0.48, 0.78, uCycle);
        float decayVolumeRetention = mix(1.0, 0.84, groundResidueSettle * groundResidueForm);
        local.y *= decayVolumeRetention;
        float onsetBasinContinuity = 0.96;
        vec3 center = pfxAcidBurstCenter * mix(tendrilForm > 0.5 ? 0.24 : onsetBasinContinuity, 1.0, causticEruption);
        float onsetGroundLift = (1.0 - smoothstep(0.08, 0.22, uCycle)) * groundResidueForm;
        center.y += onsetGroundLift * 0.14;
        float attachedDecayBubbleRise = smoothstep(0.42, 0.64, uCycle) * (1.0 - smoothstep(0.72, 0.84, uCycle));
        center.y += decayBubbleForm * attachedDecayBubbleRise * (0.03 + pfxAcidBurstSeed * 0.05);
        center.y -= gravityCollapse * gravityCollapse * (0.08 + pfxAcidBurstSeed * 0.22) * tendrilForm;
        center.y -= groundResidueSettle * 0.11 * groundResidueForm;
        center.xz *= 1.0 + gravityCollapse * 0.08 * groundForm;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vAcidBurstNormal = normalize(normalMatrix * normal);
        vAcidBurstViewPosition = viewPosition.xyz;
        vAcidBurstLocalPosition = local;
        vAcidBurstSeed = pfxAcidBurstSeed;
        vAcidBurstForm = pfxAcidBurstForm;
        float corrosionRetire = 1.0 - smoothstep(0.54 + pfxAcidBurstSeed * 0.025, 0.78 + pfxAcidBurstSeed * 0.045, uCycle);
        float poolRetire = 1.0 - smoothstep(0.74, 0.86, uCycle);
        float completeTendrilRetirement = 1.0 - smoothstep(0.48 + pfxAcidBurstSeed * 0.015, 0.62 + pfxAcidBurstSeed * 0.025, uCycle);
        float persistentAcidResidue = 1.0 - tendrilForm;
        float onsetBirth = 0.62 + smoothstep(0.004, 0.085, uCycle) * 0.38;
        float tendrilDelayedBirth = smoothstep(0.035, 0.11, uCycle);
        float authoredDensityReveal = mix(1.0, step(pfxAcidBurstSeed, 0.18 + uDensity * 0.82), step(0.5, pfxAcidBurstForm));
        float impactFlashLife = 1.0 - smoothstep(0.09, 0.23, uCycle);
        float baseLife = mix(corrosionRetire, poolRetire, persistentAcidResidue) * onsetBirth * authoredDensityReveal * mix(1.0, tendrilDelayedBirth, tendrilForm) * mix(1.0, completeTendrilRetirement, tendrilForm);
        vAcidBurstLife = mix(baseLife, impactFlashLife, impactFlashForm);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform float uCycle;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      uniform vec3 uAccentColor;
      varying vec3 vAcidBurstNormal;
      varying vec3 vAcidBurstViewPosition;
      varying vec3 vAcidBurstLocalPosition;
      varying float vAcidBurstSeed;
      varying float vAcidBurstForm;
      varying float vAcidBurstLife;
      void main() {
        vec3 normal = normalize(vAcidBurstNormal);
        vec3 viewDirection = normalize(-vAcidBurstViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float acidThickness = 0.5 + facing * 0.5;
        float corrosiveMeniscus = pow(1.0 - facing, mix(1.6, 0.72, uStyleEdgeHardness));
        float causticCore = pow(facing, 2.2) * (0.38 + uDensity * 0.42);
        float etchedPigmentBands = 0.5 + 0.5 * sin(vAcidBurstLocalPosition.y * 13.0 + vAcidBurstSeed * 29.0);
        float onsetContactFlash = 1.0 - smoothstep(0.0, 0.11, uCycle);
        float wetSurfaceSheen = pow(max(0.0, dot(normal, normalize(vec3(-0.32, 0.84, 0.44)))), 10.0);
        float subsurfaceAcidGlow = pow(1.0 - facing, 2.0) * (0.36 + uDensity * 0.34);
        float emissiveAcidTip = step(1.5, vAcidBurstForm) * smoothstep(0.18, 0.7, vAcidBurstLocalPosition.y);
        float liquidTransmission = pow(1.0 - abs(dot(normal, viewDirection)), 2.4);
        float directionalVolumeShading = 0.42 + 0.58 * max(0.0, dot(normal, normalize(vec3(-0.4, 0.72, 0.56))));
        float styleEmissiveBoost = smoothstep(0.58, 0.72, uStyleEdgeHardness);
        float neonAccentIsolation = styleEmissiveBoost * 0.82;
        float chemicalShimmer = 0.5 + 0.5 * sin(vAcidBurstLocalPosition.y * 21.0 + vAcidBurstSeed * 37.0 + uCycle * 18.0);
        float corrosionDissolve = smoothstep(0.55, 0.86, uCycle);
        float poolForm = 1.0 - step(1.5, vAcidBurstForm);
        float poolCausticFlow = 0.5 + 0.5 * sin((vAcidBurstLocalPosition.x + vAcidBurstLocalPosition.z) * 18.0 - uCycle * 14.0 + vAcidBurstSeed * 11.0);
        float poolFresnel = poolForm * pow(1.0 - facing, 1.4);
        float impactFlashCore = step(2.5, vAcidBurstForm) * (1.0 - smoothstep(0.0, 0.2, uCycle));
        float liquidPlumeChromaticLock = impactFlashCore * (0.86 + corrosiveMeniscus * 0.14);
        float groundResidueVisibility = poolForm * (1.0 - smoothstep(0.86, 0.98, uCycle));
        float cozyLegibilityBoost = 1.0 - smoothstep(0.32, 0.58, uStyleEdgeHardness);
        float neonEmissionHalo = styleEmissiveBoost * (0.42 + corrosiveMeniscus * 0.58);
        float residueHazardPulse = groundResidueVisibility * (0.72 + 0.28 * sin(uCycle * 24.0 + vAcidBurstSeed * 19.0));
        float activeResidueEmission = residueHazardPulse * (0.58 + poolFresnel * 0.42);
        float activeResidueContrast = smoothstep(0.36, 0.72, uCycle) * groundResidueVisibility;
        float facetedResidueContinuity = activeResidueContrast * (0.78 + etchedPigmentBands * 0.22);
        float facetedResidueBanding = facetedResidueContinuity * smoothstep(0.42, 0.68, etchedPigmentBands);
        float decayFacetQuantization = floor(directionalVolumeShading * 4.0) / 4.0;
        float tendrilSurfaceChromaticFill = step(1.5, vAcidBurstForm) * (1.0 - step(2.5, vAcidBurstForm));
        float translucentInternalCrossingSuppression = tendrilSurfaceChromaticFill * (0.88 + facing * 0.12);
        float bubblingResidueHighlight = step(1.1, vAcidBurstForm) * (1.0 - step(1.5, vAcidBurstForm)) * smoothstep(0.42, 0.7, uCycle) * (1.0 - smoothstep(0.84, 0.98, uCycle));
        float toxicBubbleChromaticLock = bubblingResidueHighlight * (0.82 + chemicalShimmer * 0.18);
        float microCausticRipples = poolForm * smoothstep(0.62, 0.94, 0.5 + 0.5 * sin(vAcidBurstLocalPosition.x * 29.0 + vAcidBurstLocalPosition.z * 23.0 - uCycle * 21.0));
        vec3 acidColor = uPrimaryColor * (0.58 + acidThickness * 0.42);
        acidColor += uSecondaryColor * (causticCore * 0.36 + etchedPigmentBands * 0.065);
        acidColor += uSecondaryColor * corrosiveMeniscus * (0.22 + uDensity * 0.28);
        acidColor += uSecondaryColor * subsurfaceAcidGlow * 0.24;
        acidColor += uSecondaryColor * liquidTransmission * 0.3;
        acidColor += vec3(0.92, 1.0, 0.52) * emissiveAcidTip * 0.38;
        acidColor += vec3(0.96, 1.0, 0.72) * wetSurfaceSheen * 0.68;
        acidColor += uAccentColor * styleEmissiveBoost * (0.82 + corrosiveMeniscus * 0.54);
        acidColor += uSecondaryColor * chemicalShimmer * (0.06 + styleEmissiveBoost * 0.12);
        acidColor += uSecondaryColor * poolForm * smoothstep(0.62, 0.94, poolCausticFlow) * 0.42;
        acidColor += uAccentColor * poolFresnel * (0.24 + styleEmissiveBoost * 0.36);
        acidColor += mix(uSecondaryColor, uPrimaryColor, 0.14) * liquidPlumeChromaticLock * 1.34;
        acidColor += mix(uPrimaryColor, uSecondaryColor, 0.58) * cozyLegibilityBoost * (0.24 + poolForm * 0.18);
        acidColor = mix(acidColor, uAccentColor * (1.12 + poolFresnel * 0.28), neonAccentIsolation);
        acidColor *= directionalVolumeShading;
        float primaryColorPostLightLock = (1.0 - styleEmissiveBoost) * (0.58 + poolForm * 0.17);
        acidColor = mix(acidColor, uPrimaryColor * 1.18, primaryColorPostLightLock);
        acidColor = mix(acidColor, uSecondaryColor * (1.18 + chemicalShimmer * 0.14), translucentInternalCrossingSuppression * 0.92);
        float neonOuterShellEmission = styleEmissiveBoost * (0.68 + facing * 0.32);
        acidColor += uAccentColor * (neonEmissionHalo * 1.35 + neonOuterShellEmission * 1.42);
        acidColor += uSecondaryColor * activeResidueEmission * (0.48 + styleEmissiveBoost * 0.24);
        float decayPrimaryContinuity = activeResidueContrast * (1.0 - step(1.1, vAcidBurstForm));
        acidColor = mix(acidColor, mix(uPrimaryColor, uSecondaryColor, 0.34) * (0.98 + poolFresnel * 0.28), activeResidueContrast * 0.72);
        acidColor += uPrimaryColor * decayPrimaryContinuity * 0.48;
        acidColor += mix(uPrimaryColor, uSecondaryColor, 0.62) * facetedResidueContinuity * 0.44;
        acidColor += uPrimaryColor * facetedResidueBanding * 0.34;
        acidColor *= mix(1.0, 0.82 + decayFacetQuantization * 0.28, activeResidueContrast);
        float cleanDecayBasinEmission = activeResidueContrast * (1.0 - step(1.1, vAcidBurstForm));
        acidColor += mix(uPrimaryColor, uSecondaryColor, 0.44) * cleanDecayBasinEmission * 0.72;
        acidColor += uSecondaryColor * microCausticRipples * 0.38;
        acidColor += uSecondaryColor * toxicBubbleChromaticLock * 1.08;
        acidColor += uSecondaryColor * onsetContactFlash * (0.28 + facing * 0.34);
        float alpha = uOpacity * vAcidBurstLife * (0.54 + facing * 0.18 + corrosiveMeniscus * 0.12);
        alpha = max(alpha, impactFlashCore * 0.86);
        alpha = max(alpha, uOpacity * groundResidueVisibility * (0.34 + facing * 0.12));
        alpha = max(alpha, facetedResidueContinuity * 0.8);
        alpha = max(alpha, bubblingResidueHighlight * 0.72);
        alpha = max(alpha, neonEmissionHalo * (0.24 + poolFresnel * 0.18));
        alpha *= 1.0 - corrosionDissolve * (0.18 + chemicalShimmer * 0.24);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(acidColor, clamp(alpha, 0.0, 0.82));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxAcidBurstMaterial'] = true
  material.userData['pfxAcidBurstMaterialRole'] = 'crown'
  material.userData['pfxAcidBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxAcidBurstMaterialProfile'] = 'translucent-corrosive-splash-with-flowing-caustic-meniscus'
  material.userData['pfxAcidBurstNeonMaterialProfile'] = isNeonEmissive ? 'additive-emissive-neon' : 'not-active'
  return material
}
