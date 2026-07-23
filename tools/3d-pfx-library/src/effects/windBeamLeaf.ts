import * as THREE from 'three'

export function createPfxWindBeamLeafGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const progresses: number[] = []
  const seeds: number[] = []
  const leafUvs: number[] = []
  const leafLocals: number[] = []
  const leafCenters: number[] = []
  const leafCount = 10
  const flowRise = 0.05
  const flowDepth = 0.08
  const arcHeight = 0.12
  let maxAxialDeviationDegrees = 0
  let maxLaneRadius = 0
  for (let leaf = 0; leaf < leafCount; leaf += 1) {
    const progress = (leaf + 1) / (leafCount + 1)
    const seed = ((leaf * 7) % leafCount) / leafCount
    const lane = leaf < 8 ? leaf % 2 : 2 + (leaf % 2)
    const laneOffsets = [[-0.08, -0.05], [0.1, 0.06], [-0.18, 0.1], [0.18, -0.11]] as const
    const lanePhase = progress * Math.PI * 1.5 + lane * Math.PI * 0.55
    const centerX = -1.88 + progress * 3.76
    const center = new THREE.Vector3(
      centerX,
      laneOffsets[lane]![0] + Math.sin(lanePhase) * 0.03 + centerX * flowRise + Math.sin(progress * Math.PI) * arcHeight,
      laneOffsets[lane]![1] + Math.cos(lanePhase) * 0.05 + centerX * flowDepth,
    )
    maxLaneRadius = Math.max(
      maxLaneRadius,
      Math.hypot(
        laneOffsets[lane]![0] + Math.sin(lanePhase) * 0.03,
        laneOffsets[lane]![1] + Math.cos(lanePhase) * 0.05,
      ),
    )
    const tangent = new THREE.Vector3(
      1,
      Math.cos(lanePhase) * 0.03 * 1.5 * Math.PI / 3.76 + flowRise + Math.cos(progress * Math.PI) * arcHeight * Math.PI / 3.76,
      -Math.sin(lanePhase) * 0.05 * 1.5 * Math.PI / 3.76 + flowDepth,
    ).normalize()
    maxAxialDeviationDegrees = Math.max(
      maxAxialDeviationDegrees,
      THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(tangent.x, -1, 1))),
    )
    const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), seed * Math.PI))
    const length = 0.1 + (leaf % 4) * 0.055
    const silhouetteVariant = leaf % 3
    const width = silhouetteVariant === 0
      ? 0.1 + (leaf % 2) * 0.018
      : silhouetteVariant === 1
        ? 0.034 + (leaf % 3) * 0.006
        : 0.09 + (leaf % 2) * 0.016
    const depth = 0.018 + (leaf % 3) * 0.002
    const outline = silhouetteVariant === 0
      ? [[1, 0], [0.46, 0.38], [0.02, 0.54], [-0.48, 0.34], [-0.76, 0.08], [-0.58, -0.12], [-0.18, -0.46], [0.44, -0.34]]
      : silhouetteVariant === 1
        ? [[1, 0], [0.34, 0.22], [-0.76, 0.1], [-1, 0], [-0.7, -0.12], [0.38, -0.2]]
        : [[1, 0], [0.46, 0.38], [0.04, 0.3], [-0.42, 0.52], [-0.78, 0.12], [-0.66, -0.28], [-0.08, -0.34], [0.42, -0.46]]
    const curlDirection = leaf % 2 === 0 ? 1 : -1
    const localPoints = [
      ...outline.map(([x, y]) => new THREE.Vector3(
        length * x!,
        width * y!,
        depth * (Math.abs(y!) * 0.46 + x! * 0.16) * curlDirection,
      )),
      new THREE.Vector3(-length * 0.02, 0, depth * 1.25),
      new THREE.Vector3(-length * 0.02, 0, -depth * 1.25),
    ]
    const localUv = localPoints.map((point) => new THREE.Vector2(
      THREE.MathUtils.clamp((point.x / length + 0.8) / 1.8, 0, 1),
      THREE.MathUtils.clamp(point.y / Math.max(0.001, width), -1, 1),
    ))
    const points = localPoints.map((point) => point.clone().applyQuaternion(rotation).add(center))
    const faces: Array<[number, number, number]> = []
    const outlineVertexCount = outline.length
    const topCenterIndex = outlineVertexCount
    const bottomCenterIndex = outlineVertexCount + 1
    for (let edge = 0; edge < outlineVertexCount; edge += 1) {
      const next = (edge + 1) % outlineVertexCount
      faces.push([topCenterIndex, edge, next], [bottomCenterIndex, next, edge])
    }
    for (const [a, b, c] of faces) {
      const faceNormal = new THREE.Vector3()
        .subVectors(points[b]!, points[a]!)
        .cross(new THREE.Vector3().subVectors(points[c]!, points[a]!))
        .normalize()
      const faceDirection = a === topCenterIndex ? 1 : -1
      const shade = 0.62 + ((a + b + c + leaf) % 4) * 0.095
      for (const vertexIndex of [a, b, c]) {
        const point = points[vertexIndex]!
        const localPoint = localPoints[vertexIndex]!
        const sculptedNormal = new THREE.Vector3(
          (localPoint.x / Math.max(length, 0.001)) * 0.28,
          (localPoint.y / Math.max(width, 0.001)) * 0.22,
          faceDirection,
        ).normalize().applyQuaternion(rotation)
        sculptedNormal.lerp(faceNormal, 0.18).normalize()
        positions.push(point.x, point.y, point.z)
        normals.push(sculptedNormal.x, sculptedNormal.y, sculptedNormal.z)
        colors.push(shade * 0.54, shade, shade * 0.78)
        progresses.push(progress)
        seeds.push(seed)
        leafUvs.push(localUv[vertexIndex]!.x, localUv[vertexIndex]!.y)
        const localOffset = point.clone().sub(center)
        leafLocals.push(localOffset.x, localOffset.y, localOffset.z)
        leafCenters.push(center.x, center.y, center.z)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxWindBeamProgress', new THREE.Float32BufferAttribute(progresses, 1))
  geometry.setAttribute('pfxWindBeamSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geometry.setAttribute('pfxWindBeamLeafUv', new THREE.Float32BufferAttribute(leafUvs, 2))
  geometry.setAttribute('pfxWindBeamLeafLocal', new THREE.Float32BufferAttribute(leafLocals, 3))
  geometry.setAttribute('pfxWindBeamLeafCenter', new THREE.Float32BufferAttribute(leafCenters, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWindBeamLeafDrawCalls'] = 1
  geometry.userData['pfxWindBeamLeafClosedFaces'] = true
  geometry.userData['pfxWindBeamLeafCount'] = leafCount
  geometry.userData['pfxWindBeamLeafBillboardCount'] = 0
  geometry.userData['pfxWindBeamLeafFlowAligned'] = true
  geometry.userData['pfxWindBeamLeafFlowLaneCount'] = 4
  geometry.userData['pfxWindBeamLeafPrimaryFlowLaneCount'] = 2
  geometry.userData['pfxWindBeamLeafPrimaryFlowLeafCount'] = 8
  geometry.userData['pfxWindBeamLeafProgressRange'] = [0.091, 0.909]
  geometry.userData['pfxWindBeamLeafBotanicalSilhouetteCue'] = 'notched-tapered-lobed'
  geometry.userData['pfxWindBeamLeafAsymmetricSilhouette'] = true
  geometry.userData['pfxWindBeamLeafSilhouetteVariantCount'] = 3
  geometry.userData['pfxWindBeamLeafOutlineVertexRange'] = [6, 8]
  geometry.userData['pfxWindBeamLeafCuratedSilhouettes'] = ['aspen-heart', 'willow-lance', 'oak-round']
  geometry.userData['pfxWindBeamLeafAdvectionPath'] = 'progressive-four-lane'
  geometry.userData['pfxWindBeamLeafPalette'] = 'olive-sage-rust-foliage'
  geometry.userData['pfxWindBeamLeafSculptedNormals'] = true
  geometry.userData['pfxWindBeamLeafIntegratedContourShading'] = true
  geometry.userData['pfxWindBeamLeafCurledVolume'] = true
  geometry.userData['pfxWindBeamLeafMaxLength'] = 0.265
  geometry.userData['pfxWindBeamLeafTurbulencePhaseCount'] = leafCount
  geometry.userData['pfxWindBeamLeafColorVariantCount'] = 3
  geometry.userData['pfxWindBeamLeafMaxAxialDeviationDegrees'] = maxAxialDeviationDegrees
  geometry.userData['pfxWindBeamLeafMaxLaneRadius'] = maxLaneRadius
  geometry.userData['pfxWindBeamLeafScaleRatio'] = 0.265 / 0.1
  geometry.userData['pfxWindBeamLeafThicknessRatio'] = (2.5 * 0.022) / (0.1 * 1.78)
  geometry.userData['pfxWindBeamLeafTriangleCount'] = positions.length / 9
  geometry.userData['pfxWindBeamLeafLengthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxWindBeamLeafHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  geometry.userData['pfxWindBeamLeafDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  return geometry
}

export function createPfxWindBeamLeafMaterial(
  opacity: number,
  primaryColor: THREE.ColorRepresentation = '#d8fff4',
  secondaryColor: THREE.ColorRepresentation = '#b8e6ff',
  density = 0.58,
  styleEdgeHardness = 0.52,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute float pfxWindBeamProgress;
      attribute float pfxWindBeamSeed;
      attribute vec2 pfxWindBeamLeafUv;
      attribute vec3 pfxWindBeamLeafLocal;
      attribute vec3 pfxWindBeamLeafCenter;
      varying vec3 vLeafColor;
      varying vec3 vLeafNormal;
      varying vec3 vLeafViewPosition;
      varying float vLeafSeed;
      varying float vLeafProgress;
      varying vec2 vLeafUv;
      vec3 rotateAroundAxis(vec3 value, vec3 axis, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return value * cosine + cross(axis, value) * sine + axis * dot(axis, value) * (1.0 - cosine);
      }
      void main() {
        float leafCompressReach = mix(0.28, 0.78, smoothstep(0.0, 0.06, uCycle));
        float leafSurgeRelease = smoothstep(0.06, 0.08, uCycle);
        float leafTravelFront = mix(leafCompressReach, 1.0, leafSurgeRelease);
        float leafRecoveryScatter = smoothstep(0.14, 0.34, uCycle) * (1.0 - smoothstep(0.4, 0.42, uCycle));
        float turbulencePhaseOffset = pfxWindBeamSeed * 9.7 + pfxWindBeamProgress * 3.4;
        float helicalDrift = sin(uCycle * 12.5663706 + pfxWindBeamProgress * 10.681415 + turbulencePhaseOffset);
        float crossDrift = cos(uCycle * 10.9955743 + pfxWindBeamProgress * 8.796459 + turbulencePhaseOffset * 0.73);
        vec3 flowAxisTumble = normalize(vec3(1.0, 0.08 + pfxWindBeamSeed * 0.08, 0.06 + pfxWindBeamProgress * 0.08));
        vec3 tumbleAxis = flowAxisTumble;
        float tumbleAngle = uCycle * 6.2831853 * (0.48 + pfxWindBeamSeed * 0.32) + pfxWindBeamSeed * 2.4;
        vec3 animatedCenter = pfxWindBeamLeafCenter;
        animatedCenter.x = -1.9 + (animatedCenter.x + 1.9) * leafTravelFront;
        animatedCenter.x += leafRecoveryScatter * (0.12 + pfxWindBeamProgress * 0.3);
        animatedCenter.y += leafRecoveryScatter * sin(turbulencePhaseOffset * 1.31) * (0.12 + pfxWindBeamProgress * 0.26);
        animatedCenter.z += leafRecoveryScatter * cos(turbulencePhaseOffset * 1.17) * (0.1 + pfxWindBeamProgress * 0.22);
        vec3 transformed = animatedCenter + rotateAroundAxis(pfxWindBeamLeafLocal, tumbleAxis, tumbleAngle);
        float flowAdvection = sin(uCycle * 3.1415927) * (0.16 + pfxWindBeamProgress * 0.28);
        transformed.x += flowAdvection;
        transformed.y += helicalDrift * (0.045 + leafRecoveryScatter * 0.08);
        transformed.z += crossDrift * (0.04 + leafRecoveryScatter * 0.07);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vLeafColor = color;
        vLeafNormal = normalize(normalMatrix * rotateAroundAxis(normal, tumbleAxis, tumbleAngle));
        vLeafViewPosition = viewPosition.xyz;
        vLeafSeed = pfxWindBeamSeed;
        vLeafProgress = pfxWindBeamProgress;
        vLeafUv = pfxWindBeamLeafUv;
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
      varying vec3 vLeafColor;
      varying vec3 vLeafNormal;
      varying vec3 vLeafViewPosition;
      varying float vLeafSeed;
      varying float vLeafProgress;
      varying vec2 vLeafUv;
      void main() {
        vec3 normal = normalize(vLeafNormal);
        vec3 viewDirection = normalize(-vLeafViewPosition);
        float leafFacet = 0.38 + 0.62 * max(0.0, dot(normal, normalize(vec3(0.42, 0.82, 0.38))));
        float leafFacetBand = smoothstep(0.36, 0.92, leafFacet);
        float centerVein = 1.0 - smoothstep(0.035, 0.12, abs(vLeafUv.y));
        float branchVein = 1.0 - smoothstep(0.02, 0.075, abs(abs(vLeafUv.y) - (0.18 + vLeafUv.x * 0.38)));
        float leafVein = max(centerVein, branchVein * smoothstep(0.12, 0.82, vLeafUv.x) * 0.62);
        float botanicalVeinCue = max(centerVein, branchVein * 0.72) * smoothstep(0.04, 0.92, vLeafUv.x);
        float rim = pow(1.0 - abs(dot(normal, viewDirection)), 2.0);
        float glint = pow(max(0.0, sin(uCycle * 12.5663706 + vLeafSeed * 29.0)), 12.0);
        float leafVariation = 0.82 + 0.18 * sin(vLeafSeed * 31.0 + 0.7);
        float windIllumination = 0.52 + 0.48 * abs(dot(normal, normalize(vec3(0.22, 0.72, 0.66))));
        float leafInteriorShade = 0.7 + 0.3 * smoothstep(0.02, 0.56, vLeafUv.x);
        float leafEdgeShade = 0.62 + 0.38 * (1.0 - smoothstep(0.56, 0.98, abs(vLeafUv.y)));
        float leafEdgeDetail = smoothstep(0.48, 0.94, abs(vLeafUv.y));
        float veinHighlight = centerVein * (0.42 + branchVein * 0.58);
        float airLightCoupling = 0.12 + 0.24 * rim + 0.12 * glint;
        float leafAtmosphericBlend = 0.025 + 0.055 * windIllumination + 0.035 * rim;
        float leafRimTranslucency = 0.08 + rim * 0.22;
        float leafSubsurface = pow(max(0.0, dot(-normal, normalize(vec3(0.28, 0.76, 0.58)))), 2.0);
        float leafGloss = pow(max(0.0, dot(normal, normalize(vec3(0.18, 0.9, 0.4)))), 10.0) * (0.35 + rim * 0.65);
        float curatedLeafContrast = 0.88 + leafFacetBand * 0.28 + veinHighlight * 0.08;
        float organicLeafGradient = mix(0.72, 1.08, smoothstep(0.04, 0.82, vLeafUv.x)) * (0.92 + 0.08 * (1.0 - abs(vLeafUv.y)));
        float softLeafColorTransition = smoothstep(0.08, 0.72, vLeafUv.x) * (1.0 - smoothstep(0.74, 0.98, abs(vLeafUv.y)));
        float flowLaneCoupling = 0.9 + 0.1 * sin(vLeafProgress * 12.5663706 + vLeafSeed * 4.0);
        float leafSilhouetteSoftness = smoothstep(0.02, 0.16, vLeafUv.x) * (1.0 - smoothstep(0.86, 1.0, vLeafUv.x)) * (1.0 - smoothstep(0.78, 1.0, abs(vLeafUv.y)));
        float windCoupledEdgeGlow = (1.0 - leafSilhouetteSoftness) * (0.18 + rim * 0.32);
        float leafColorVariety = floor(fract(vLeafSeed * 1.031) * 3.0);
        vec3 oliveDebris = mix(vec3(0.16, 0.2, 0.055), vec3(0.48, 0.59, 0.18), leafFacetBand * windIllumination);
        vec3 sageDebris = mix(vec3(0.18, 0.21, 0.12), vec3(0.5, 0.61, 0.34), leafFacetBand * windIllumination);
        vec3 rustDebris = mix(vec3(0.2, 0.065, 0.025), vec3(0.52, 0.2, 0.055), leafFacetBand * windIllumination);
        vec3 seasonalDebrisPalette = mix(oliveDebris, sageDebris, step(0.5, leafColorVariety));
        seasonalDebrisPalette = mix(seasonalDebrisPalette, rustDebris, step(1.5, leafColorVariety));
        vec3 controlledLeafAirColor = mix(uSecondaryColor, uPrimaryColor, windIllumination);
        vec3 matchedWindPalette = mix(seasonalDebrisPalette, controlledLeafAirColor, 0.52 + rim * 0.12);
        vec3 leaf = matchedWindPalette * leafInteriorShade * leafEdgeShade * curatedLeafContrast * organicLeafGradient * flowLaneCoupling * (0.72 + leafVariation * 0.3) * (0.68 + leafFacet * 0.58);
        leaf = mix(leaf * vec3(0.88, 0.94, 0.8), leaf * vec3(1.06, 1.02, 0.88), softLeafColorTransition * 0.34);
        leaf += mix(vec3(0.38, 0.58, 0.55), controlledLeafAirColor, 0.62) * airLightCoupling;
        leaf = mix(leaf, mix(vec3(0.4, 0.59, 0.6), controlledLeafAirColor, 0.7) * (0.66 + leafFacet * 0.2), leafAtmosphericBlend);
        leaf += vec3(0.72, 0.66, 0.3) * leafSubsurface * 0.46;
        leaf += vec3(0.82, 0.84, 0.64) * leafRimTranslucency * 1.24;
        leaf += vec3(0.96, 0.9, 0.58) * leafGloss * 0.42;
        leaf += controlledLeafAirColor * windCoupledEdgeGlow * mix(0.78, 1.08, uStyleEdgeHardness);
        leaf += vec3(0.34, 0.27, 0.08) * veinHighlight * 0.18;
        leaf += vec3(0.72, 0.82, 0.42) * botanicalVeinCue * 0.42;
        leaf -= vec3(0.1, 0.12, 0.035) * leafVein * 0.52;
        leaf -= matchedWindPalette * leafEdgeDetail * 0.22;
        gl_FragColor = vec4(leaf * (0.9 + vLeafColor.g * 0.1) * mix(0.92, 1.06, uDensity), uOpacity * (0.68 + leafFacet * 0.18 + leafSilhouetteSoftness * 0.12));
      }
    `,
  })
  material.forceSinglePass = true
  material.userData['pfxWindBeamLeafMaterial'] = true
  material.userData['pfxWindBeamLeafMaterialProfile'] = 'sculpted-organic-gradient-debris'
  material.userData['pfxWindBeamLeafAssetProvenance'] = 'original-procedural-closed-mesh'
  material.userData['pfxWindBeamLeafRuntimeMaxAxialDeviationDegrees'] = 12
  material.userData['pfxWindBeamLeafControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxWindBeamLeafControlTintStrength'] = 0.52
  return material
}
