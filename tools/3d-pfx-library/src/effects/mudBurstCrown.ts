import * as THREE from 'three'

export function createPfxMudBurstCrownGeometry(): THREE.BufferGeometry {
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
  const core = new THREE.SphereGeometry(1, 12, 6)
  core.scale(0.85, 0.36, 0.85)
  core.translate(0, 0.08, 0)
  appendGeometry(core, new THREE.Vector3(0, 0.08, 0), 0.5, 0)
  const puddleLobeCount = 10
  for (let lobe = 0; lobe < puddleLobeCount; lobe += 1) {
    const seed = ((lobe * 31 + 9) % 97) / 97
    const angle = lobe / puddleLobeCount * Math.PI * 2 + (seed - 0.5) * 0.28
    const radius = 0.68 + (lobe % 4) * 0.11
    const center = new THREE.Vector3(Math.cos(angle) * radius * 1.21, 0.03 + (lobe % 3) * 0.018, Math.sin(angle) * radius * 1.08)
    const lobeGeometry = new THREE.SphereGeometry(1, 8, 4)
    lobeGeometry.scale(0.44 + (lobe % 3) * 0.075, 0.12 + (lobe % 2) * 0.035, 0.38 + ((lobe + 1) % 3) * 0.055)
    lobeGeometry.rotateY(-angle * 0.6)
    lobeGeometry.translate(center.x, center.y, center.z)
    appendGeometry(lobeGeometry, center, seed, 1)
  }
  const splashTongueCount = 12
  const splashTongueLengths = [1.22, 1.7, 1.38, 1.98, 1.5, 1.3, 1.82, 1.42, 1.9, 1.26, 1.62, 1.46] as const
  for (let tongue = 0; tongue < splashTongueCount; tongue += 1) {
    const seed = ((tongue * 37 + 13) % 101) / 101
    const angle = tongue / splashTongueCount * Math.PI * 2 + (seed - 0.5) * 0.34
    const direction = new THREE.Vector3(Math.cos(angle) * (0.48 + (tongue % 4) * 0.1), 0.62 + ((tongue * 3) % 5) * 0.1, Math.sin(angle) * (0.6 + ((tongue + 2) % 4) * 0.11)).normalize()
    const center = new THREE.Vector3(Math.cos(angle) * (0.46 + (tongue % 3) * 0.06), 0.48 + ((tongue * 2) % 5) * 0.065, Math.sin(angle) * (0.5 + ((tongue + 1) % 3) * 0.08))
    const tongueGeometry = new THREE.ConeGeometry(0.1 + ((tongue * 2) % 5) * 0.014, splashTongueLengths[tongue]!, 6, 2, false)
    tongueGeometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction))
    tongueGeometry.translate(center.x, center.y, center.z)
    appendGeometry(tongueGeometry, center, seed, 2)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('pfxMudBurstCenter', new THREE.Float32BufferAttribute(centers, 3))
  geometry.setAttribute('pfxMudBurstSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxMudBurstForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxMudBurstCrownDrawCalls'] = 1
  geometry.userData['pfxMudBurstCrownClosedFaces'] = true
  geometry.userData['pfxMudBurstCrownWorldSpaceVolume'] = true
  geometry.userData['pfxMudBurstCrownBillboardCount'] = 0
  geometry.userData['pfxMudBurstFilledCoreCount'] = 1
  geometry.userData['pfxMudBurstPuddleLobeCount'] = puddleLobeCount
  geometry.userData['pfxMudBurstSplashTongueCount'] = splashTongueCount
  geometry.userData['pfxMudBurstSplashTongueMinLength'] = Math.min(...splashTongueLengths)
  geometry.userData['pfxMudBurstSplashTongueMaxLength'] = Math.max(...splashTongueLengths)
  geometry.userData['pfxMudBurstAsymmetricFootprint'] = true
  geometry.userData['pfxMudBurstTopology'] = 'filled-core-overlapping-puddle-lobes-and-closed-splash-tongues'
  geometry.userData['pfxMudBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxMudBurstCrownTriangleCount'] = positions.length / 9
  geometry.userData['pfxMudBurstCrownWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxMudBurstCrownDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxMudBurstCrownHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxMudBurstCrownMaterial(
  opacity: number,
  primaryColor = '#2a170c',
  secondaryColor = '#6f4526',
  density = 0.58,
  styleEdgeHardness = 0.52,
  paletteProfile: 'standard' | 'reference-earth' = 'standard',
): THREE.ShaderMaterial {
  const referenceEarthPaletteLockShader = paletteProfile === 'reference-earth'
    ? /* glsl */ `
        float earthCrownPigmentLock = clamp(0.22 + earthStrata * 0.28 + wetMudSheen * 0.18 + crownWetSpec * 0.2, 0.0, 0.86);
        float mudCrownWetEdge = wetMudSheen * 0.5 + crownWetSpec * 0.34 + wetFresnelGloss * 0.22;
        vec3 earthCrownPigment = mix(uPrimaryColor * 0.72, uSecondaryColor * 0.82, earthCrownPigmentLock);
        vec3 neutralEarthBrown = mix(vec3(0.15, 0.105, 0.07), uSecondaryColor * 0.68, 0.42 + earthStrata * 0.24);
        controlledMudColor = mix(controlledMudColor, mix(earthCrownPigment, neutralEarthBrown, 0.34), 0.82);
        controlledMudColor += uSecondaryColor * mudCrownWetEdge * 0.3;
        float mudCrownValueCeiling = 0.68 + mudCrownWetEdge * 0.14;
        controlledMudColor = min(controlledMudColor, vec3(mudCrownValueCeiling, mudCrownValueCeiling * 0.76, mudCrownValueCeiling * 0.56));
      `
    : ''
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
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
      attribute vec3 pfxMudBurstCenter;
      attribute float pfxMudBurstSeed;
      attribute float pfxMudBurstForm;
      varying vec3 vMudNormal;
      varying vec3 vMudViewPosition;
      varying vec3 vMudLocalPosition;
      varying float vMudSeed;
      varying float vMudForm;
      varying float vMudLife;
      void main() {
        float impactCompression = 1.0 - smoothstep(0.04, 0.22, uCycle);
        float crownEruption = smoothstep(0.045 + pfxMudBurstSeed * 0.012, 0.3 + pfxMudBurstSeed * 0.025, uCycle);
        float onsetGroundSwell = impactCompression * (0.7 + pfxMudBurstSeed * 0.14);
        float settle = smoothstep(0.46, 0.82, uCycle);
        vec3 local = position - pfxMudBurstCenter;
        float formLift = pfxMudBurstForm > 1.5 ? mix(0.7 + onsetGroundSwell * 0.16, 1.0, crownEruption) : mix(0.82, 1.0, crownEruption);
        local.y *= formLift;
        local.xz *= mix(0.86, 1.0, crownEruption);
        vec3 center = pfxMudBurstCenter * mix(pfxMudBurstForm > 1.5 ? 0.82 : 0.9, 1.0, crownEruption);
        center.y -= settle * settle * (pfxMudBurstForm > 1.5 ? 0.34 + pfxMudBurstSeed * 0.18 : 0.06);
        center.x += (pfxMudBurstSeed - 0.5) * settle * 0.08;
        vec3 transformed = center + local;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vMudNormal = normalize(normalMatrix * normal);
        vMudViewPosition = viewPosition.xyz;
        vMudLocalPosition = local;
        vMudSeed = pfxMudBurstSeed;
        vMudForm = pfxMudBurstForm;
        float groundRetire = 1.0 - smoothstep(0.52 + pfxMudBurstSeed * 0.02, 0.8 + pfxMudBurstSeed * 0.03, uCycle);
        float rapidCrownRetire = pfxMudBurstForm > 1.5
          ? 1.0 - smoothstep(0.54 + pfxMudBurstSeed * 0.02, 0.84 + pfxMudBurstSeed * 0.03, uCycle)
          : groundRetire;
        vMudLife = (0.78 + crownEruption * 0.22) * rapidCrownRetire;
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
      varying vec3 vMudNormal;
      varying vec3 vMudViewPosition;
      varying vec3 vMudLocalPosition;
      varying float vMudSeed;
      varying float vMudForm;
      varying float vMudLife;
      void main() {
        vec3 normal = normalize(vMudNormal);
        vec3 viewDirection = normalize(-vMudViewPosition);
        // Partial facet hardening so the closed splash tongues read as wet 3D
        // blades instead of flat matte fins next to the faceted clods.
        vec3 crownHardFacet = normalize(cross(dFdx(vMudViewPosition), dFdy(vMudViewPosition)));
        if (dot(crownHardFacet, normal) < 0.0) crownHardFacet *= -1.0;
        normal = normalize(mix(normal, crownHardFacet, 0.42));
        float facing = abs(dot(normal, viewDirection));
        float wetMudSheen = pow(max(0.0, dot(normal, normalize(vec3(0.34, 0.9, 0.26)))), mix(6.0, 14.0, uStyleEdgeHardness));
        float crownWetSpec = pow(max(0.0, dot(normal, normalize(viewDirection + normalize(vec3(0.34, 0.9, 0.26))))), 26.0);
        float wetFresnelGloss = pow(1.0 - facing, 2.2) * (vMudForm < 1.5 ? 0.66 : 0.3);
        float earthStrata = 0.5 + 0.5 * sin(vMudLocalPosition.x * 13.0 + vMudLocalPosition.z * 17.0 + vMudSeed * 19.0);
        vec3 earthPigment = vMudForm < 0.5 ? vec3(0.12, 0.07, 0.035) : vMudForm < 1.5 ? vec3(0.18, 0.105, 0.05) : vec3(0.24, 0.14, 0.07);
        vec3 paleWetSpecular = mix(uSecondaryColor, vec3(0.9, 0.94, 0.98), 0.75);
        vec3 controlledMudColor = mix(uPrimaryColor * 0.76, uSecondaryColor, facing * 0.2 + wetMudSheen * 0.34);
        controlledMudColor = mix(controlledMudColor, earthPigment, 0.38 + earthStrata * 0.12);
        controlledMudColor *= 0.78 + facing * 0.34;
        controlledMudColor *= 0.84 + vMudSeed * 0.32;
        controlledMudColor += paleWetSpecular * wetMudSheen * mix(1.0, 1.6, uDensity);
        controlledMudColor += paleWetSpecular * crownWetSpec * mix(0.8, 1.3, uDensity);
        controlledMudColor += paleWetSpecular * wetFresnelGloss * mix(0.5, 0.85, uDensity);
        controlledMudColor += mix(uPrimaryColor, uSecondaryColor, earthStrata) * pow(1.0 - facing, 1.4) * 0.14;
        float impactWetFlash = 1.0 - smoothstep(0.0, 0.16, uCycle);
        float settlingWetHold = smoothstep(0.45, 0.58, uCycle) * (1.0 - smoothstep(0.7, 0.8, uCycle));
        controlledMudColor = mix(controlledMudColor, uSecondaryColor * 0.92, impactWetFlash * 0.22);
        controlledMudColor = mix(controlledMudColor, earthPigment * 1.12, settlingWetHold * 0.42);
        controlledMudColor *= 1.0 + impactWetFlash * 0.14 + settlingWetHold * 0.22;
        ${referenceEarthPaletteLockShader}
        float alpha = uOpacity * vMudLife * (0.76 + facing * 0.22 + impactWetFlash * 0.2 + settlingWetHold * 0.22);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(controlledMudColor, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxMudBurstMaterial'] = true
  material.userData['pfxMudBurstMaterialRole'] = 'crown'
  material.userData['pfxMudBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxMudBurstMaterialProfile'] = paletteProfile === 'reference-earth'
    ? 'wet-umber-filled-earth-crown-with-faceted-splash-tongues'
    : 'wet-filled-crown-with-earth-strata'
  return material
}
