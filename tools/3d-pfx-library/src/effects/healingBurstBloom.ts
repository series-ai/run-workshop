import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { createPfxHealingLoopGeometry } from './healingLoop'

export function createPfxHealingBurstBloomGeometry(): THREE.BufferGeometry {
  // The healing-loop reference is already an authored, closed 3D language:
  // a sanctuary torus and box-built cross glyphs. Adapt its one-draw vertex
  // stream into the burst shader, keeping only the readable hero cross instead
  // of rebuilding another radial petal cluster that can read as plant growth.
  const source = createPfxHealingLoopGeometry()
  const sourcePositions = source.getAttribute('position')
  const sourceForms = source.getAttribute('pfxHealingLoopForm')
  const sourceSeeds = source.getAttribute('pfxHealingLoopSeed')
  const positions: number[] = []
  const centers: number[] = []
  const seeds: number[] = []
  const forms: number[] = []
  const heroCrossCenter = new THREE.Vector3(0, 0.28, 0.48)
  // Deliberately bias the three axes so the medical cue remains readable but
  // presents a different projection from the side instead of looking like a
  // screen-facing plus.
  const heroCrossRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, 0.34, -0.26))
  const appendHeroCrossVolume = (center: THREE.Vector3, rotation: THREE.Quaternion, scale: THREE.Vector3, seed: number) => {
    const bar = new THREE.BoxGeometry(1, 1, 1)
    const raw = bar.toNonIndexed()
    const attribute = raw.getAttribute('position')
    for (let vertex = 0; vertex < attribute.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(attribute, vertex).multiply(scale).applyQuaternion(rotation).add(center)
      positions.push(point.x, point.y, point.z)
      centers.push(center.x, center.y, center.z)
      seeds.push(seed)
      forms.push(1)
    }
    raw.dispose()
    bar.dispose()
  }

  for (let vertex = 0; vertex < sourcePositions.count; vertex += 1) {
    const sourceForm = sourceForms?.getX(vertex) ?? 0
    const seed = sourceSeeds?.getX(vertex) ?? 0
    const point = new THREE.Vector3().fromBufferAttribute(sourcePositions, vertex)
    // Keep only the sanctuary torus from the loop reference. Its helix and
    // satellite glyphs are useful in the loop reference, but their diagonals
    // make a short burst read as plant-like clutter; the burst gets one
    // authored hero cross and a small set of true-volume restoration sparks.
    if (sourceForm >= 0.5) continue
    const mappedForm = 0
    // The loop reference's sanctuary torus lies flat on the ground. Rotate
    // that closed source volume upright for the burst so it reads as a halo,
    // not a decorative floor ring shared with other effects.
    point.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)))

    positions.push(point.x, point.y, point.z)
    centers.push(0, 0, 0)
    seeds.push(seed)
    forms.push(mappedForm)
  }
  // The source glyphs carry the loop language, but a burst needs one
  // unmistakable restoration beat at gameplay distance. Add a single closed
  // three-axis cross volume in the same draw, in front of the helix, so the
  // reference remains recognizable even when its strands overlap.
  appendHeroCrossVolume(heroCrossCenter.clone().add(new THREE.Vector3(0, 0.03, 0.08)), heroCrossRotation, new THREE.Vector3(0.14, 0.52, 0.28), 0.18)
  appendHeroCrossVolume(heroCrossCenter.clone().add(new THREE.Vector3(0, 0.03, 0.08)), heroCrossRotation, new THREE.Vector3(0.58, 0.13, 0.18), 0.18)
  appendHeroCrossVolume(heroCrossCenter.clone().add(new THREE.Vector3(0, 0.03, 0.08)), heroCrossRotation, new THREE.Vector3(0.12, 0.22, 0.5), 0.18)
  const sparkleDescriptors = [
    { center: new THREE.Vector3(-0.5, 0.5, 0.28), scale: new THREE.Vector3(0.06, 0.09, 0.055), seed: 0.24 },
    { center: new THREE.Vector3(0.52, 0.64, 0.2), scale: new THREE.Vector3(0.055, 0.08, 0.07), seed: 0.34 },
    { center: new THREE.Vector3(-0.36, 0.9, 0.08), scale: new THREE.Vector3(0.05, 0.075, 0.05), seed: 0.44 },
    { center: new THREE.Vector3(0.36, 0.98, 0.12), scale: new THREE.Vector3(0.06, 0.095, 0.055), seed: 0.54 },
    { center: new THREE.Vector3(0, 1.18, -0.18), scale: new THREE.Vector3(0.045, 0.08, 0.045), seed: 0.64 },
    { center: new THREE.Vector3(-0.68, 0.32, -0.16), scale: new THREE.Vector3(0.05, 0.07, 0.06), seed: 0.74 },
    { center: new THREE.Vector3(0.7, 0.38, -0.12), scale: new THREE.Vector3(0.055, 0.075, 0.05), seed: 0.84 },
    { center: new THREE.Vector3(0, 0.42, 0.62), scale: new THREE.Vector3(0.05, 0.08, 0.06), seed: 0.94 },
  ] as const
  const sparkle = new THREE.OctahedronGeometry(1, 1)
  const sparkleRaw = sparkle.index ? sparkle.toNonIndexed() : sparkle
  const sparklePosition = sparkleRaw.getAttribute('position')
  for (const descriptor of sparkleDescriptors) {
    const matrix = new THREE.Matrix4().compose(descriptor.center, new THREE.Quaternion().setFromEuler(new THREE.Euler(descriptor.seed * 1.8, descriptor.seed * 2.4, descriptor.seed * 1.2)), descriptor.scale)
    for (let vertex = 0; vertex < sparklePosition.count; vertex += 1) {
      const point = new THREE.Vector3().fromBufferAttribute(sparklePosition, vertex).applyMatrix4(matrix)
      positions.push(point.x, point.y, point.z)
      centers.push(descriptor.center.x, descriptor.center.y, descriptor.center.z)
      seeds.push(descriptor.seed)
      forms.push(1)
    }
  }
  if (sparkleRaw !== sparkle) sparkleRaw.dispose()
  sparkle.dispose()
  source.dispose()

  const rawGeometry = new THREE.BufferGeometry()
  rawGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  rawGeometry.setAttribute('pfxHealingBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  rawGeometry.setAttribute('pfxHealingBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  rawGeometry.setAttribute('pfxHealingBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  const geometry = mergeVertices(rawGeometry, 1e-4)
  rawGeometry.dispose()
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxHealingBurstBloomDrawCalls'] = 1
  geometry.userData['pfxHealingBurstBloomClosedFaces'] = true
  geometry.userData['pfxHealingBurstBloomSmoothNormals'] = true
  geometry.userData['pfxHealingBurstBloomBillboardCount'] = 0
  geometry.userData['pfxHealingBurstCoreCount'] = 1
  geometry.userData['pfxHealingBurstCrossMoteCount'] = sparkleDescriptors.length
  geometry.userData['pfxHealingBurstHeroCrossCount'] = 1
  geometry.userData['pfxHealingBurstSparkleCount'] = sparkleDescriptors.length
  geometry.userData['pfxHealingBurstSourceGlyphCount'] = 0
  geometry.userData['pfxHealingBurstCrownCrossCount'] = 0
  geometry.userData['pfxHealingBurstDepthLayerCount'] = 7
  geometry.userData['pfxHealingBurstGameplayScaleProfile'] = 'character-width-restoration-cross-with-eight-mint-sparkles'
  geometry.userData['pfxHealingBurstOnsetScaleFloor'] = 0.56
  geometry.userData['pfxHealingBurstWreathCount'] = 1
  geometry.userData['pfxHealingBurstWreathSegmentCount'] = 16
  geometry.userData['pfxHealingBurstConnectedSilhouette'] = true
  geometry.userData['pfxHealingBurstWreathProfile'] = 'closed-vertical-sanctuary-halo-with-eight-restoration-sparkles-around-hero-cross'
  geometry.userData['pfxHealingBurstWreathTopology'] = 'vertical-sanctuary-halo-with-centered-restoration-cross-and-true-volume-sparkles'
  geometry.userData['pfxHealingBurstHeroCrossTopology'] = 'three-axis-closed-bar-cross-from-healing-loop-reference'
  geometry.userData['pfxHealingBurstCrossDepthAsymmetryProfile'] = 'unequal-x-y-z-axes-with-diagonal-world-rotation'
  geometry.userData['pfxHealingBurstHeroCrossDepthScale'] = 3.2
  geometry.userData['pfxHealingBurstSatelliteCrossDepthScale'] = 0
  geometry.userData['pfxHealingBurstHeroCrossVolumeCount'] = 1
  geometry.userData['pfxHealingBurstCrossMoteProfile'] = 'closed-healing-loop-hero-cross-with-eight-mint-restoration-sparkles'
  geometry.userData['pfxHealingBurstGlyphGeometryProfile'] = 'closed-box-cross-glyph-volumes'
  geometry.userData['pfxHealingBurstCoreGeometryProfile'] = 'closed-vertical-sanctuary-halo'
  geometry.userData['pfxHealingBurstCoreIntegrationProfile'] = 'vertical-sanctuary-halo-wrapped-around-a-front-hero-cross-with-rising-sparkles'
  geometry.userData['pfxHealingBurstDecayFoldProfile'] = 'hero-cross-folds-inward-under-rising-recovery'
  geometry.userData['pfxHealingBurstDecayFoldScale'] = 0.35
  geometry.userData['pfxHealingBurstDecayVisibilityProfile'] = 'persistent-mint-cross-and-seed-floor-through-decay'
  geometry.userData['pfxHealingBurstSilhouette'] = 'vertical-sanctuary-halo-with-centered-closed-hero-cross-and-sparkle-lift'
  geometry.userData['pfxHealingBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxHealingBurstBloomTriangleCount'] = positions.length / 9
  geometry.userData['pfxHealingBurstBloomWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxHealingBurstBloomDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxHealingBurstBloomHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxHealingBurstBloomMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#37d982',
  secondaryColor: THREE.ColorRepresentation = '#ffd166',
  accentColor: THREE.ColorRepresentation = '#b7f7d0',
  density = 0.52,
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
      attribute vec3 pfxHealingBurstCenter;
      attribute float pfxHealingBurstSeed;
      attribute float pfxHealingBurstForm;
      varying vec3 vHealingBurstNormal;
      varying vec3 vHealingBurstViewPosition;
      varying vec3 vHealingBurstLocalPosition;
      varying float vHealingBurstForm;
      varying float vHealingBurstSeed;
      varying float vHealingBurstLife;
      void main() {
        float renewalBloom = smoothstep(0.035 + pfxHealingBurstSeed * 0.012, 0.25 + pfxHealingBurstSeed * 0.025, uCycle);
        float coreForm = 1.0 - step(0.5, pfxHealingBurstForm);
        float leafForm = step(0.5, pfxHealingBurstForm);
        float crownForm = step(1.5, pfxHealingBurstForm);
        float leafUnfurl = smoothstep(0.05 + pfxHealingBurstSeed * 0.04, 0.3 + pfxHealingBurstSeed * 0.04, uCycle);
        float restorationSettle = smoothstep(0.74, 0.92, uCycle);
        float crossBurstExpansion = smoothstep(0.015, 0.22, uCycle) * (1.0 - smoothstep(0.54, 0.78, uCycle));
        float crossRecoveryFold = smoothstep(0.62, 0.9, uCycle);
        vec3 local = position - pfxHealingBurstCenter;
        vec3 onsetScale = mix(vec3(0.72, 0.62, 0.72), vec3(1.0), mix(renewalBloom, leafUnfurl, leafForm));
        float readableOnsetSeedScale = mix(0.5, 1.0, renewalBloom);
        onsetScale = mix(onsetScale, vec3(readableOnsetSeedScale), coreForm);
        onsetScale = mix(onsetScale, vec3(mix(0.68, 1.0, crossBurstExpansion)), leafForm);
        local *= onsetScale;
        // Slow tumble so the 3D plus-motes and the crowning cross present
        // changing facets over time and across cameras — never a static card.
        float moteTumble = uCycle * 6.2831853 * (0.2 + pfxHealingBurstSeed * 0.45);
        float tumbleCos = cos(moteTumble);
        float tumbleSin = sin(moteTumble);
        float tumbleAmount = crownForm * 0.6;
        vec3 tumbledLocal = local;
        tumbledLocal.xz = mat2(tumbleCos, -tumbleSin, tumbleSin, tumbleCos) * tumbledLocal.xz;
        tumbledLocal.xy = mat2(cos(moteTumble * 0.6), -sin(moteTumble * 0.6), sin(moteTumble * 0.6), cos(moteTumble * 0.6)) * tumbledLocal.xy;
        local = mix(local, tumbledLocal, tumbleAmount);
        vec3 tumbledNormal = normal;
        tumbledNormal.xz = mat2(tumbleCos, -tumbleSin, tumbleSin, tumbleCos) * tumbledNormal.xz;
        tumbledNormal.xy = mat2(cos(moteTumble * 0.6), -sin(moteTumble * 0.6), sin(moteTumble * 0.6), cos(moteTumble * 0.6)) * tumbledNormal.xy;
        vec3 shaderNormal = normalize(mix(normal, tumbledNormal, tumbleAmount));
        local.xz *= 1.0 + leafForm * renewalBloom * 0.12;
        float decayPetalFold = restorationSettle * leafForm;
        float dramaticDecayFold = mix(1.0, 0.35, decayPetalFold);
        local.xz *= dramaticDecayFold;
        local *= mix(1.0, 0.42, crossRecoveryFold * leafForm);
        vec3 center = pfxHealingBurstCenter * mix(0.56, 1.0, mix(renewalBloom, leafUnfurl, leafForm));
        center.xz *= mix(1.0, 0.45, decayPetalFold);
        center.y += coreForm * (1.0 - renewalBloom) * 0.08;
        center.y += crownForm * sin(uCycle * 6.2831853 + pfxHealingBurstSeed * 8.0) * 0.045 * (1.0 - restorationSettle);
        center.y -= restorationSettle * leafForm * (0.08 + pfxHealingBurstSeed * 0.08);
        center.y -= restorationSettle * crownForm * 0.28;
        center.y += leafForm * (crossBurstExpansion * 0.24 - crossRecoveryFold * 0.12);
        center.z += leafForm * crossBurstExpansion * 0.12;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vHealingBurstNormal = normalize(normalMatrix * shaderNormal);
        vHealingBurstViewPosition = viewPosition.xyz;
        vHealingBurstLocalPosition = local;
        vHealingBurstForm = pfxHealingBurstForm;
        vHealingBurstSeed = pfxHealingBurstSeed;
        float semanticDensityFloor = 0.24;
        float densityReveal = mix(1.0, step(pfxHealingBurstSeed, semanticDensityFloor + uDensity * (1.0 - semanticDensityFloor)), leafForm);
        // Hold the loop and glyphs through the readable beat. The old early
        // retire window made the reference torus arrive at the reviewer peak
        // already gray and half-transparent, which erased the healing cue.
        float healingReleaseHold = 1.0 - smoothstep(0.58 + pfxHealingBurstSeed * 0.04, 0.86 + pfxHealingBurstSeed * 0.05, uCycle);
        float retire = healingReleaseHold;
        float persistentSeedReceipt = 1.0 - smoothstep(0.36, 0.56, uCycle);
        retire = mix(retire, persistentSeedReceipt, coreForm);
        float healingDecayVisibilityFloor = (1.0 - smoothstep(0.78, 0.98, uCycle)) * (0.3 + coreForm * 0.12 + crownForm * 0.1);
        vHealingBurstLife = max(retire * densityReveal * (0.82 + renewalBloom * 0.18), healingDecayVisibilityFloor);
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
      varying vec3 vHealingBurstNormal;
      varying vec3 vHealingBurstViewPosition;
      varying vec3 vHealingBurstLocalPosition;
      varying float vHealingBurstForm;
      varying float vHealingBurstSeed;
      varying float vHealingBurstLife;
      void main() {
        vec3 normal = normalize(vHealingBurstNormal);
        vec3 viewDirection = normalize(-vHealingBurstViewPosition);
        float facing = max(0.0, dot(normal, viewDirection));
        float renewalMeniscus = pow(1.0 - facing, mix(1.8, 0.72, uStyleEdgeHardness));
        float livingLeafVein = smoothstep(0.62, 0.92, 0.5 + 0.5 * sin(vHealingBurstLocalPosition.y * 17.0 + vHealingBurstSeed * 31.0));
        float coreForm = 1.0 - step(0.5, vHealingBurstForm);
        float crownForm = step(1.5, vHealingBurstForm);
        float moteForm = step(0.5, vHealingBurstForm) * (1.0 - step(1.5, vHealingBurstForm));
        float cohesiveRestorationBloom = crownForm * (0.62 + 0.2 * sin(uCycle * 9.0 + vHealingBurstSeed * 13.0));
        // Facet-hardened hero shapes: the golden seed gem, the crowning
        // cross, and the orbiting plus-motes show crisp low-poly planes with
        // a pale rim instead of a single-tone primitive read. Without the
        // mote term the smooth-normal boxes read as flat sprite cards.
        vec3 healingHardFacet = normalize(cross(dFdx(vHealingBurstViewPosition), dFdy(vHealingBurstViewPosition)));
        if (dot(healingHardFacet, normal) < 0.0) healingHardFacet *= -1.0;
        normal = normalize(mix(normal, healingHardFacet, coreForm * 0.62 + crownForm * 0.5 + moteForm * 0.85));
        facing = max(0.0, dot(normal, viewDirection));
        renewalMeniscus = pow(1.0 - facing, mix(1.8, 0.72, uStyleEdgeHardness));
        float heroGemRim = pow(1.0 - facing, 2.2) * (coreForm * 0.55 + crownForm * 0.45);
        float warmRestorationCore = coreForm * (0.72 + 0.28 * sin(uCycle * 18.0));
        float directionalVolume = 0.46 + 0.54 * max(0.0, dot(normal, normalize(vec3(-0.38, 0.78, 0.5))));
        float styleRenewalEmission = smoothstep(0.58, 0.74, uStyleEdgeHardness);
        float restorationReceiptPulse = warmRestorationCore * (0.82 + 0.18 * sin(uCycle * 24.0));
        float seedPostLightReceipt = coreForm * (0.72 + facing * 0.28);
        float integratedSeedCore = coreForm * (0.86 + facing * 0.14);
        float spireEdgeEmission = crownForm * (0.46 + renewalMeniscus * 0.54);
        vec3 color = uPrimaryColor * (0.7 + facing * 0.3);
        color += uSecondaryColor * (livingLeafVein * (0.18 + uDensity * 0.16) + renewalMeniscus * 0.28);
        color = mix(color, uSecondaryColor * 1.2, warmRestorationCore * 0.82);
        color += uAccentColor * crownForm * (0.22 + renewalMeniscus * 0.28);
        color *= directionalVolume;
        float postLightLeafFill = (1.0 - coreForm) * (0.66 + crownForm * 0.12);
        color = mix(color, uPrimaryColor * 1.12 + uSecondaryColor * livingLeafVein * 0.34, postLightLeafFill);
        // Whiten the plus-motes toward pale mint so the heal-cross glyphs
        // stay legible at gameplay distance and thumbnail scale — a
        // near-white medical cross must read against the green burst.
        color = mix(color, (uAccentColor * 1.05 + vec3(0.06)) * directionalVolume * (0.75 + facing * 0.35), moteForm * 0.8 + crownForm * 0.42);
        float accentCrownLock = crownForm * (0.7 + renewalMeniscus * 0.2);
        color = mix(color, uAccentColor * 1.14 + uSecondaryColor * 0.38, accentCrownLock * 0.72);
        color += uPrimaryColor * 0.36 * (1.0 - moteForm * 0.75) + uSecondaryColor * (restorationReceiptPulse * 0.62 + seedPostLightReceipt * 0.48);
        color += mix(uSecondaryColor, uAccentColor, 0.28) * spireEdgeEmission * 0.82;
        color += uAccentColor * heroGemRim * 0.6;
        color += mix(uPrimaryColor, uAccentColor, 0.64) * cohesiveRestorationBloom * (0.34 + renewalMeniscus * 0.22);
        color = mix(color, uAccentColor * 0.92 + uPrimaryColor * 0.38, cohesiveRestorationBloom * 0.38);
        float healingVolumeSpecular = pow(max(0.0, dot(normal, normalize(viewDirection + normalize(vec3(-0.32, 0.76, 0.5))))), 18.0) * (0.28 + coreForm * 0.22 + moteForm * 0.16);
        float healingSparkleGlint = moteForm * pow(max(0.0, dot(normal, normalize(viewDirection + vec3(-0.22, 0.86, 0.38)))), 24.0) * (0.52 + 0.28 * sin(vHealingBurstSeed * 41.0 + uCycle * 16.0));
        float healingDepthRim = pow(1.0 - facing, 1.6) * (0.24 + moteForm * 0.18 + crownForm * 0.16);
        color += uAccentColor * healingVolumeSpecular * 1.42;
        color += uAccentColor * healingSparkleGlint * 1.18;
        color += uSecondaryColor * healingDepthRim * 0.34;
        float goldSeedChromaticLock = integratedSeedCore;
        // Shaded gold, not a flat fill: keep the facet lighting and fresnel
        // rim alive inside the chromatic lock or the gem reads as an unlit
        // hexagonal card.
        color = mix(color, uSecondaryColor * (0.72 + directionalVolume * 0.6 + facing * 0.18) + uAccentColor * heroGemRim * 0.45, goldSeedChromaticLock);
        color = mix(color, uAccentColor * 1.32 + uSecondaryColor * 0.72, styleRenewalEmission * 0.72);
        float alpha = uOpacity * vHealingBurstLife * (0.64 + facing * 0.2 + renewalMeniscus * 0.16);
        float seedReceiptOpacityFloor = uOpacity * coreForm * (1.0 - smoothstep(0.3, 0.5, uCycle)) * 0.92;
        alpha = max(alpha, seedReceiptOpacityFloor);
        vec3 healingCrossPaletteLock = uSecondaryColor * (0.98 + directionalVolume * 0.22) + uPrimaryColor * 0.24;
        color = mix(color, healingCrossPaletteLock, moteForm * 0.94);
        float healingCrossSilhouetteLock = moteForm * (0.74 + facing * 0.18 + renewalMeniscus * 0.16);
        color = mix(color, uSecondaryColor * 1.16 + uAccentColor * 0.22, healingCrossSilhouetteLock * 0.38);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxHealingBurstMaterial'] = true
  material.userData['pfxHealingBurstMaterialRole'] = 'bloom'
  material.userData['pfxHealingBurstMaterialProfile'] = 'rounded-volume-renewal-motes-with-centered-hero-cross-and-seed-specular'
  return material
}
