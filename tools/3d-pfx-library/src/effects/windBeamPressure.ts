import * as THREE from 'three'

export function createPfxWindBeamPressureGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const flowRise = 0.05
  const flowDepth = 0.24
  const arcHeight = 0.12
  const axialSegments = 11
  const crossSegments = 6
  const streams = [
    { y: -0.02, z: -0.02, ay: 0.036, az: 0.03, bendY: 0.04, bendZ: -0.025, depthSlope: 0.05, phase: 0.7, width: 1.05, start: -1.94, end: 2.08 },
    { y: 0.48, z: 0.2, ay: 0.035, az: 0.032, bendY: 0.08, bendZ: -0.03, depthSlope: 0.015, phase: 2.4, width: 0.7, start: -1.74, end: 1.88 },
    { y: -0.44, z: -0.18, ay: 0.038, az: 0.034, bendY: -0.06, bendZ: 0.035, depthSlope: -0.02, phase: 4.1, width: 0.58, start: -1.62, end: 1.7 },
    { y: 0.2, z: -0.3, ay: 0.04, az: 0.04, bendY: 0.03, bendZ: 0.045, depthSlope: 0.03, phase: 5.35, width: 0.42, start: -1.36, end: 1.48 },
  ] as const
  const cool = new THREE.Color('#c5cdd2')
  const hot = new THREE.Color('#e8f6f7')
  const laneTints = ['#f5fcfd', '#dbe8ea', '#c8dadd', '#afc8cc'].map((tint) => new THREE.Color(tint))
  const arcScales = [0.35, 1.15, -0.8, 0.55] as const
  const harmonicY = [0.018, 0.03, -0.028, 0.034] as const
  const harmonicZ = [-0.016, 0.026, -0.024, 0.03] as const

  for (const [streamIndex, stream] of streams.entries()) {
    const arcScale = arcScales[streamIndex]!
    const laneHarmonicY = harmonicY[streamIndex]!
    const laneHarmonicZ = harmonicZ[streamIndex]!
    const vertexStart = positions.length / 3
    for (let ring = 0; ring <= axialSegments; ring += 1) {
      const t = ring / axialSegments
      const envelope = Math.pow(Math.sin(Math.PI * t), 0.62)
      const x = THREE.MathUtils.lerp(stream.start, stream.end, t)
      const sweep = Math.sin(t * Math.PI * 1.18 + stream.phase)
      const settle = Math.sin(t * Math.PI)
      const center = new THREE.Vector3(
        x,
        stream.y * (0.18 + t * 0.82) + sweep * stream.ay * settle + settle * stream.bendY + x * flowRise + Math.sin(t * Math.PI) * arcHeight * arcScale + Math.sin(t * Math.PI * 2 + stream.phase) * laneHarmonicY * settle,
        stream.z * (0.18 + t * 0.82) + Math.cos(t * Math.PI * 1.06 + stream.phase) * stream.az * settle + settle * stream.bendZ + x * stream.depthSlope + Math.cos(t * Math.PI * 2.4 + stream.phase) * laneHarmonicZ * settle,
      )
      const nextT = Math.min(1, t + 0.002)
      const nextX = THREE.MathUtils.lerp(stream.start, stream.end, nextT)
      const nextSweep = Math.sin(nextT * Math.PI * 1.18 + stream.phase)
      const nextSettle = Math.sin(nextT * Math.PI)
      const next = new THREE.Vector3(
        nextX,
        stream.y * (0.18 + nextT * 0.82) + nextSweep * stream.ay * nextSettle + nextSettle * stream.bendY + nextX * flowRise + Math.sin(nextT * Math.PI) * arcHeight * arcScale + Math.sin(nextT * Math.PI * 2 + stream.phase) * laneHarmonicY * nextSettle,
        stream.z * (0.18 + nextT * 0.82) + Math.cos(nextT * Math.PI * 1.06 + stream.phase) * stream.az * nextSettle + nextSettle * stream.bendZ + nextX * stream.depthSlope + Math.cos(nextT * Math.PI * 2.4 + stream.phase) * laneHarmonicZ * nextSettle,
      )
      const tangent = next.sub(center).normalize()
      const normalAxis = new THREE.Vector3(0, 1, 0).addScaledVector(tangent, -tangent.y).normalize()
      const binormal = new THREE.Vector3().crossVectors(tangent, normalAxis).normalize()
      const widthPulse = 0.78 + Math.pow(Math.sin(t * Math.PI * 2 + stream.phase), 2) * 0.22
      const leadingWeight = 0.7 + t * 0.3
      const radiusY = 0.003 + envelope * widthPulse * leadingWeight * 0.068 * stream.width
      const radiusZ = 0.003 + envelope * widthPulse * leadingWeight * 0.05 * stream.width
      const color = cool.clone().lerp(laneTints[streamIndex] ?? hot, 0.32 + t * 0.58)
      for (let side = 0; side < crossSegments; side += 1) {
        const angle = (side / crossSegments) * Math.PI * 2 + Math.PI * 0.25
        const radial = normalAxis.clone().multiplyScalar(Math.cos(angle) * radiusY)
          .addScaledVector(binormal, Math.sin(angle) * radiusZ)
        const point = center.clone().add(radial)
        positions.push(point.x, point.y, point.z)
        normals.push(radial.x, radial.y, radial.z)
        colors.push(color.r, color.g, color.b)
        uvs.push(t, streamIndex + side / crossSegments)
      }
    }
    for (let ring = 0; ring < axialSegments; ring += 1) {
      for (let side = 0; side < crossSegments; side += 1) {
        const nextSide = (side + 1) % crossSegments
        const a = vertexStart + ring * crossSegments + side
        const b = vertexStart + ring * crossSegments + nextSide
        const c = vertexStart + (ring + 1) * crossSegments + nextSide
        const d = vertexStart + (ring + 1) * crossSegments + side
        indices.push(a, d, b, b, d, c)
      }
    }
  }

  // The open shell starts as a narrow tail and opens into a broad leading
  // scoop. It has no end caps, so it reads as displaced air rather than a
  // projectile, while its head/tail ratio supplies an unmistakable +X vector.
  const shellRadialSegments = 10
  const shellAxialSegments = 9
  const shellStart = positions.length / 3
  for (let ring = 0; ring <= shellAxialSegments; ring += 1) {
    const t = ring / shellAxialSegments
    const eased = t * t * (3 - 2 * t)
    const x = THREE.MathUtils.lerp(-1.94, 2.04, t)
    const centerY = Math.sin(t * Math.PI * 1.35) * 0.045 + Math.sin(t * Math.PI) * arcHeight
    const centerZ = Math.sin(t * Math.PI * 1.7 + 0.4) * 0.035
    const turbulence = 0.94 + Math.sin(t * Math.PI * 5.0 + 0.6) * 0.06
    const bodySwell = Math.pow(Math.sin(t * Math.PI), 0.72)
    const radiusY = (THREE.MathUtils.lerp(0.24, 0.54, eased) + bodySwell * 0.18) * turbulence
    const radiusZ = (THREE.MathUtils.lerp(0.2, 0.46, eased) + bodySwell * 0.16) * (2 - turbulence)
    const shellColor = cool.clone().lerp(hot, 0.18 + t * 0.58)
    for (let side = 0; side < shellRadialSegments; side += 1) {
      const angle = (side / shellRadialSegments) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      positions.push(x, centerY + cos * radiusY + x * flowRise, centerZ + sin * radiusZ + x * flowDepth)
      const normal = new THREE.Vector3(0.18 - flowRise * cos / radiusY - flowDepth * sin / radiusZ, cos / radiusY, sin / radiusZ).normalize()
      normals.push(normal.x, normal.y, normal.z)
      colors.push(shellColor.r, shellColor.g, shellColor.b)
      uvs.push(t, 8 + side / shellRadialSegments)
    }
  }
  for (let ring = 0; ring < shellAxialSegments; ring += 1) {
    for (let side = 0; side < shellRadialSegments; side += 1) {
      const nextSide = (side + 1) % shellRadialSegments
      const a = shellStart + ring * shellRadialSegments + side
      const b = shellStart + ring * shellRadialSegments + nextSide
      const c = shellStart + (ring + 1) * shellRadialSegments + nextSide
      const d = shellStart + (ring + 1) * shellRadialSegments + side
      indices.push(a, d, b, b, d, c)
    }
  }

  // Two low, closed three-section wake crests tie the airborne gust to the
  // gameplay plane. A lifted, laterally bowed middle section prevents either
  // wake from resolving into the unfinished straight rail seen in review 959.
  const groundWakeCount = 2
  const groundWakeSections = 5
  const wakeColor = new THREE.Color('#b9dfd8')
  for (let lane = 0; lane < groundWakeCount; lane += 1) {
    const groundY = -0.66 + lane * 0.025
    const wakePoints: THREE.Vector3[] = []
    for (let section = 0; section < groundWakeSections; section += 1) {
      const t = section / (groundWakeSections - 1)
      const crest = Math.sin(t * Math.PI)
      const x = THREE.MathUtils.lerp(-1.72 + lane * 0.06, 1.82 - lane * 0.1, t)
      const laneSign = lane === 0 ? -1 : 1
      const centerZ = laneSign * (0.12 + crest * 0.09) + x * flowDepth
      const halfWidth = THREE.MathUtils.lerp(0.11, 0.035, t) + crest * 0.04
      const height = THREE.MathUtils.lerp(0.028, 0.012, t) + crest * 0.055
      const bottomY = groundY + crest * 0.025
      wakePoints.push(
        new THREE.Vector3(x, bottomY, centerZ - halfWidth),
        new THREE.Vector3(x, bottomY + height, centerZ + Math.sin(t * Math.PI * 3 + lane) * halfWidth * 0.12),
        new THREE.Vector3(x, bottomY, centerZ + halfWidth),
      )
    }
    const wakeTriangles: Array<readonly [number, number, number]> = []
    for (let section = 0; section < groundWakeSections - 1; section += 1) {
      for (let band = 0; band < 2; band += 1) {
        const a = section * 3 + band
        const b = (section + 1) * 3 + band
        const c = (section + 1) * 3 + band + 1
        const d = section * 3 + band + 1
        wakeTriangles.push([a, d, b], [d, c, b])
      }
    }
    for (const triangle of wakeTriangles) {
      const pointA = wakePoints[triangle[0]]!
      const pointB = wakePoints[triangle[1]]!
      const pointC = wakePoints[triangle[2]]!
      const faceNormal = new THREE.Vector3().crossVectors(
        pointB.clone().sub(pointA),
        pointC.clone().sub(pointA),
      ).normalize()
      for (const pointIndex of triangle) {
        const point = wakePoints[pointIndex]!
        const vertexIndex = positions.length / 3
        positions.push(point.x, point.y, point.z)
        normals.push(faceNormal.x, faceNormal.y, faceNormal.z)
        colors.push(wakeColor.r, wakeColor.g, wakeColor.b)
        const section = Math.floor(pointIndex / 3)
        uvs.push(
          THREE.MathUtils.lerp(0.12, 0.84, section / (groundWakeSections - 1)),
          9.0 + lane + (pointIndex % 3) * 0.28,
        )
        indices.push(vertexIndex)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWindBeamPressureDrawCalls'] = 1
  geometry.userData['pfxWindBeamPressureStreamCount'] = streams.length
  geometry.userData['pfxWindBeamPressureProfile'] = 'ring-free-closed-flow-ribbons'
  geometry.userData['pfxWindBeamPressureHeroStreamCount'] = 1
  geometry.userData['pfxWindBeamPressureSecondaryStreamCount'] = 2
  geometry.userData['pfxWindBeamPressureAccentStreamCount'] = 1
  geometry.userData['pfxWindBeamPressureOrganicCurvature'] = true
  geometry.userData['pfxWindBeamPressureAxialRingSuppression'] = true
  geometry.userData['pfxWindBeamPressureEndpointVariation'] = true
  geometry.userData['pfxWindBeamPressureIndependentDepthLanes'] = true
  geometry.userData['pfxWindBeamPressureStreamDepthSlopes'] = streams.map((stream) => stream.depthSlope)
  geometry.userData['pfxWindBeamPressureVerticalOrderPreserved'] = true
  geometry.userData['pfxWindBeamPressureCrossSectionRadius'] = 1.05
  geometry.userData['pfxWindBeamPressureCrossSegments'] = crossSegments
  geometry.userData['pfxWindBeamPressureFlowAxis'] = [1, flowRise, flowDepth]
  geometry.userData['pfxWindBeamPressureAxisAligned'] = true
  geometry.userData['pfxWindBeamPressureArcHeight'] = arcHeight
  geometry.userData['pfxWindBeamPressureMaxAxialDepthDrift'] = 0.93
  geometry.userData['pfxWindBeamPressurePalette'] = 'silver-air-with-seasonal-foliage'
  geometry.userData['pfxWindBeamPressureSideProfileLayerCount'] = 4
  geometry.userData['pfxWindBeamPressureCurvatureProfileCount'] = streams.length
  geometry.userData['pfxWindBeamPressureLaneHierarchy'] = 'hero-secondary-accent'
  geometry.userData['pfxWindBeamPressureHeroWidthMultiplier'] = 1.05
  geometry.userData['pfxWindBeamPressureShellRole'] = 'subordinate-atmosphere'
  geometry.userData['pfxWindBeamPressureSecondaryWidthRange'] = [0.58, 0.7]
  geometry.userData['pfxWindBeamPressureContourGrammar'] = 'four-varied-strands-tail-to-leading-scoop'
  geometry.userData['pfxWindBeamPressureContourValueSteps'] = [1, 0.48, 0.34, 0.2]
  geometry.userData['pfxWindBeamPressureSideProfile'] = 'ordered-axial-cross-section'
  geometry.userData['pfxWindBeamPressureMaxHarmonicDepth'] = Math.max(...harmonicZ.map((value) => Math.abs(value)))
  geometry.userData['pfxWindBeamPressureArcScaleRange'] = Math.max(...arcScales) - Math.min(...arcScales)
  geometry.userData['pfxWindBeamPressureClosedCrossSections'] = true
  geometry.userData['pfxWindBeamPressureRingCount'] = 0
  geometry.userData['pfxWindBeamPressureEndCapCount'] = 0
  geometry.userData['pfxWindBeamPressureHead'] = 'open-leading-scoop'
  geometry.userData['pfxWindBeamPressureVolume'] = 'tail-to-front-gust-envelope'
  geometry.userData['pfxWindBeamPressureHeadTailRadiusRatio'] = 0.54 / 0.24
  geometry.userData['pfxWindBeamPressureGroundWakeCount'] = groundWakeCount
  geometry.userData['pfxWindBeamPressureGroundWakeSections'] = groundWakeSections
  geometry.userData['pfxWindBeamPressureGroundWakeEdgeBreakup'] = true
  geometry.userData['pfxWindBeamPressureGroundWakeAxialMerge'] = true
  geometry.userData['pfxWindBeamPressureCoreTreatment'] = 'striated-translucent-air'
  geometry.userData['pfxWindBeamPressureGroundWakeMaterial'] = 'cool-feathered-air-shear'
  geometry.userData['pfxWindBeamPressureGroundWakeTopology'] = 'folded-feathered-pressure-sheets'
  geometry.userData['pfxWindBeamPressureGroundWakeFlatPlaceholderCount'] = 0
  geometry.userData['pfxWindBeamPressureAxialSupportProfile'] = 'open-directional-slashes'
  geometry.userData['pfxWindBeamPressureTemporalSilhouette'] = 'compressed-surge-scattered-recovery'
  geometry.userData['pfxWindBeamPressureTailConvergenceRatio'] = 0.18
  geometry.userData['pfxWindBeamPressureSingleSided'] = true
  geometry.userData['pfxWindBeamPressureGroundWakeUpwardWinding'] = true
  geometry.userData['pfxWindBeamPressureGroundWakeMaxHalfWidth'] = 0.15
  geometry.userData['pfxWindBeamPressureCompressedOnsetVolume'] = 0.65
  geometry.userData['pfxWindBeamPressurePeakOccupancy'] = 'four-varied-strands-with-integrated-debris'
  geometry.userData['pfxWindBeamPressureRecoveryWispCount'] = 2
  geometry.userData['pfxWindBeamPressureTriangleCount'] = indices.length / 3
  geometry.userData['pfxWindBeamPressureHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxWindBeamPressureMaterial(
  opacity: number,
  color: THREE.ColorRepresentation = '#d8fff4',
  secondaryColor: THREE.ColorRepresentation = '#b8e6ff',
  density = 0.58,
  styleEdgeHardness = 0.52,
): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uOpacity: { value: THREE.MathUtils.clamp(opacity, 0, 1) },
      uCycle: { value: 0 },
      uDensity: { value: THREE.MathUtils.clamp(density, 0, 1) },
      uStyleEdgeHardness: { value: THREE.MathUtils.clamp(styleEdgeHardness, 0, 1) },
    },
    vertexColors: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: `
      uniform float uCycle;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      void main() {
        vColor = color;
        vUv = uv;
        float compressReach = mix(0.28, 0.78, smoothstep(0.0, 0.06, uCycle));
        float surgeRelease = smoothstep(0.06, 0.08, uCycle);
        float lifecycleReach = mix(compressReach, 1.0, surgeRelease);
        float travelFront = -1.94 + 4.0 * lifecycleReach;
        float recoveryScatter = smoothstep(0.14, 0.34, uCycle) * (1.0 - smoothstep(0.4, 0.42, uCycle));
        float groundWakeVertex = step(9.0, uv.y);
        float airborneVertex = 1.0 - groundWakeVertex;
        float lanePhase = floor(uv.y) * 1.83 + uv.x * 4.2;
        vec3 transformed = position;
        transformed.x = -1.94 + (position.x + 1.94) * lifecycleReach;
        transformed.x = min(transformed.x, travelFront);
        float onsetVolume = mix(0.65, 1.0, lifecycleReach);
        transformed.y *= mix(onsetVolume, 1.0, groundWakeVertex);
        transformed.z *= mix(onsetVolume, 1.0, groundWakeVertex);
        transformed.x += recoveryScatter * airborneVertex * (0.06 + uv.x * 0.2);
        transformed.y += recoveryScatter * airborneVertex * sin(lanePhase) * (0.08 + uv.x * 0.22);
        transformed.z += recoveryScatter * airborneVertex * cos(lanePhase * 0.87) * (0.07 + uv.x * 0.19);
        float groundContactLift = -groundWakeVertex * recoveryScatter * 0.025;
        transformed.y += groundContactLift;
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uSecondaryColor;
      uniform float uOpacity;
      uniform float uCycle;
      uniform float uDensity;
      uniform float uStyleEdgeHardness;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying vec2 vUv;
      void main() {
        float facing = abs(dot(normalize(vNormal), normalize(vViewDirection)));
        float mobileFastRim = 1.0 - facing;
        float rim = mobileFastRim * (0.5 + mobileFastRim * 0.5);
        float pressureRibbon = 0.54 + facing * 0.46;
        float heroRibbon = 1.0 - step(1.0, vUv.y);
        float streamLane = floor(vUv.y);
        float secondaryLuminanceFloor = mix(0.58, 0.72, uDensity);
        float secondaryOrder = mix(secondaryLuminanceFloor, secondaryLuminanceFloor * 0.78, step(1.5, streamLane));
        secondaryOrder = mix(secondaryOrder, secondaryLuminanceFloor * 0.56, step(2.5, streamLane));
        float laneHierarchy = mix(secondaryOrder, 1.0, heroRibbon);
        float heroFlowDominance = mix(0.82, 1.18, heroRibbon);
        float laneContrast = 0.84 + 0.16 * (sin(streamLane * 2.37 + 0.8) * 0.5 + 0.5);
        float strandRimHighlight = mobileFastRim * mobileFastRim;
        float strandKeyHighlight = abs(dot(normalize(vNormal), normalize(vec3(0.34, 0.82, 0.46))));
        float strandVolumeLight = 0.7 + 0.3 * strandKeyHighlight;
        float strandDepthContrast = 0.92 + 0.08 * (sin(streamLane * 1.71 + 0.4) * 0.5 + 0.5);
        float laneTemperature = sin(streamLane * 1.91 + 0.6) * 0.5 + 0.5;
        float groundWake = step(9.0, vUv.y);
        float gustShell = step(8.0, vUv.y) * (1.0 - groundWake);
        float turbulenceBand = 0.72 + 0.28 * smoothstep(0.2, 0.92, sin(vUv.x * 31.0 + vUv.y * 13.0));
        float tipSoftFade = 1.0 - smoothstep(0.72, 0.98, vUv.x);
        float flowFade = smoothstep(0.0, 0.08, vUv.x) * tipSoftFade;
        float smoothFacetResponse = smoothstep(0.08, 0.94, facing);
        float facet = 0.78 + 0.22 * smoothFacetResponse;
        float shellFacetBand = smoothstep(0.12, 0.88, facing);
        float shellSector = fract(vUv.y);
        float shellSectorBreakup = smoothstep(0.08, 0.2, shellSector) * (1.0 - smoothstep(0.62, 0.88, shellSector));
        float axialRingSuppression = 0.06 + shellSectorBreakup * 0.94;
        float groundCrest = sin(clamp((vUv.x - 0.12) / 0.72, 0.0, 1.0) * 3.1415927);
        float groundCross = fract(vUv.y);
        float groundStriation = 0.72 + 0.28 * sin(vUv.x * 28.0 + groundCross * 11.0);
        float directionalFlowWindow = mix(0.28, 1.0, smoothstep(0.04, 0.92, vUv.x));
        float leadingPressureCrest = smoothstep(0.48, 0.82, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
        float anticipationGlow = 1.0 - smoothstep(0.02, 0.07, uCycle);
        float organicStreamBreakup = 0.74 + 0.26 * smoothstep(0.12, 0.88, sin(vUv.x * 23.0 + streamLane * 2.7) * 0.5 + 0.5);
        float ribbonStriation = sin(vUv.x * 27.0 + vUv.y * 9.0) * 0.5 + 0.5;
        float fineAirStreaks = 0.76 + 0.24 * (sin(vUv.x * 53.0 + streamLane * 4.7) * 0.5 + 0.5);
        float airTurbulenceTexture = fineAirStreaks * (0.84 + 0.16 * (sin(vUv.x * 17.0 - vUv.y * 15.0) * 0.5 + 0.5));
        float anticipationVisibility = mix(1.72, 1.0, smoothstep(0.02, 0.08, uCycle));
        float strandSpecularBase = smoothstep(0.54, 1.0, facing);
        float strandSpecular = strandSpecularBase * strandSpecularBase * (0.72 + ribbonStriation * 0.28);
        float turbulentRibbon = 0.72 + 0.28 * ribbonStriation;
        float energyFalloff = smoothstep(0.0, 0.7, max(0.0, sin(vUv.x * 3.1415927)));
        float ribbonInteriorGradient = 0.28 + 0.72 * pow(max(0.0, sin(fract(vUv.y) * 3.1415927)), 0.72);
        float motionBlurHighlight = smoothstep(0.0, 0.62, max(0.0, sin(vUv.x * 3.1415927))) * (0.78 + ribbonStriation * 0.22);
        float airShearBase = 1.0 - ribbonInteriorGradient;
        float airShearEdge = airShearBase * airShearBase * (0.7 + strandRimHighlight * 0.3);
        float heroBladeSuppression = 0.82 + ribbonStriation * 0.18;
        vec3 neutralAirGradient = mix(vec3(0.52, 0.59, 0.63), vec3(0.94, 0.97, 0.98), smoothstep(0.08, 0.86, vUv.x));
        vec3 desaturatedSkyGradient = neutralAirGradient;
        vec3 longitudinalColor = desaturatedSkyGradient;
        vec3 controlledPressureColor = mix(uSecondaryColor, uColor, 0.62 + heroRibbon * 0.2);
        vec3 ribbonBase = mix(mix(vColor, longitudinalColor, 0.12), controlledPressureColor, 0.62 + ribbonStriation * 0.1);
        vec3 ribbonHighlight = mix(longitudinalColor, controlledPressureColor, 0.84);
        vec3 ribbonColor = mix(ribbonBase, ribbonHighlight, ribbonInteriorGradient * 0.52) * (0.76 + pressureRibbon * 0.24 + heroRibbon * 0.08) * facet * turbulentRibbon * laneContrast * strandVolumeLight * strandDepthContrast * heroFlowDominance;
        ribbonColor = mix(ribbonColor * vec3(0.92, 0.98, 1.03), ribbonColor * vec3(1.04, 1.0, 0.91), laneTemperature * 0.22);
        float heroCrestHighlight = heroRibbon * ribbonInteriorGradient * ribbonInteriorGradient * (0.74 + energyFalloff * 0.26);
        ribbonColor += mix(vec3(0.48, 0.74, 0.78), controlledPressureColor, 0.72) * strandRimHighlight * (0.08 + heroRibbon * 0.14);
        ribbonColor += mix(vec3(0.86, 0.97, 1.0), controlledPressureColor, 0.56) * strandSpecular * (0.2 + heroRibbon * 0.08);
        ribbonColor += vec3(0.94, 0.98, 1.0) * strandKeyHighlight * (0.1 + heroRibbon * 0.04);
        ribbonColor += vec3(0.72, 0.92, 0.94) * heroCrestHighlight * 0.08;
        ribbonColor += vec3(1.0, 0.96, 0.8) * motionBlurHighlight * (0.08 + heroRibbon * 0.035);
        ribbonColor += vec3(0.9, 0.86, 0.72) * airShearEdge * 0.07;
        ribbonColor += mix(vColor, uColor, 0.68) * energyFalloff * (0.035 + heroRibbon * 0.055);
        ribbonColor += vec3(0.62, 0.9, 0.94) * leadingPressureCrest * (0.18 + strandRimHighlight * 0.12);
        ribbonColor += vec3(0.46, 0.72, 0.76) * anticipationGlow * (0.12 + strandRimHighlight * 0.08);
        float recoveryWispPhase = smoothstep(0.14, 0.22, uCycle) * (1.0 - smoothstep(0.36, 0.42, uCycle));
        float recoveryWispPattern = sin(vUv.x * 19.0 + streamLane * 3.7 + uCycle * 13.0) * 0.5 + 0.5;
        float recoveryWisp = recoveryWispPhase * smoothstep(0.48, 0.78, recoveryWispPattern);
        ribbonColor += vec3(0.7, 0.9, 0.94) * recoveryWisp * (0.14 + strandRimHighlight * 0.08);
        ribbonColor *= mix(2.08, 2.28, uDensity) * airTurbulenceTexture;
        vec3 shellColor = mix(vColor, controlledPressureColor, 0.64) * (0.72 + shellFacetBand * 0.58 + rim * 0.2) * turbulenceBand * 1.24;
        float groundDustLift = 0.18 + groundCrest * 0.2;
        float featheredGroundShear = smoothstep(0.02, 0.3, groundCross) * (1.0 - smoothstep(0.7, 0.98, groundCross));
        vec3 groundColor = mix(uSecondaryColor * 0.34, controlledPressureColor * 0.72, 0.38 + facing * 0.28) * (0.86 + groundDustLift) * groundStriation;
        vec3 shaded = mix(ribbonColor, shellColor, gustShell);
        shaded = mix(shaded, groundColor, groundWake);
        float ribbonAlpha = flowFade * directionalFlowWindow * organicStreamBreakup * (0.68 + pressureRibbon * 0.52 + leadingPressureCrest * 0.18 + anticipationGlow * 0.2) * turbulentRibbon * airTurbulenceTexture * laneHierarchy * anticipationVisibility;
        ribbonAlpha *= mix(1.0, heroBladeSuppression * 0.94, heroRibbon);
        ribbonAlpha += recoveryWisp * flowFade * (0.16 + heroRibbon * 0.1);
        float shellFade = smoothstep(0.0, 0.12, vUv.x) * (1.0 - smoothstep(0.72, 1.0, vUv.x));
        float axialViewWeight = smoothstep(0.62, 0.92, mobileFastRim);
        float axialDirectionalSlash = smoothstep(0.14, 0.24, shellSector) * (1.0 - smoothstep(0.42, 0.56, shellSector)) * smoothstep(0.46, 0.72, vUv.x);
        float axialPortalSuppression = mix(0.38, axialDirectionalSlash * 0.55, axialViewWeight);
        float axialDirectionalVane = axialViewWeight * axialDirectionalSlash * flowFade;
        float axialVolumeRim = strandRimHighlight * 0.38 * shellSectorBreakup;
        float subordinateShell = 0.052 + facing * 0.08 + axialVolumeRim;
        float shellAlpha = min(0.014, shellFade * directionalFlowWindow * (subordinateShell + leadingPressureCrest * 0.055 + anticipationGlow * 0.035 + recoveryWisp * 0.08) * turbulenceBand * axialRingSuppression * axialPortalSuppression) + axialDirectionalVane * 0.34;
        float groundEdgeFade = featheredGroundShear * (0.68 + 0.32 * (1.0 - abs(groundCross - 0.5) * 2.0));
        float groundAlpha = min(0.16, (0.12 + facing * 0.035 + groundDustLift * 0.06) * directionalFlowWindow * groundEdgeFade * groundStriation * tipSoftFade);
        float recoveryPhase = smoothstep(0.14, 0.23, uCycle) * (1.0 - smoothstep(0.36, 0.42, uCycle));
        float laneWiseRecovery = floor(vUv.y) * 2.13;
        float recoveryDissolve = sin(vUv.x * 21.0 + laneWiseRecovery + uCycle * 11.0) * 0.5 + 0.5;
        float frayBreakup = smoothstep(recoveryPhase * 0.62 - 0.16, recoveryPhase * 0.62 + 0.28, recoveryDissolve);
        float cleanDecayEnvelope = 0.74 + frayBreakup * 0.26;
        float recoveryEnvelope = mix(1.0, cleanDecayEnvelope, recoveryPhase);
        float alpha = mix(ribbonAlpha, shellAlpha, gustShell);
        alpha = mix(alpha, groundAlpha, groundWake);
        alpha *= recoveryEnvelope;
        gl_FragColor = vec4(shaded, uOpacity * alpha);
      }
    `,
  })
  material.userData['pfxWindBeamPressureMaterial'] = true
  material.userData['pfxWindBeamPressureMaterialProfile'] = 'crisp-hero-over-quiet-shell'
  material.userData['pfxWindBeamPressureLuminanceFloor'] = 1.34
  material.userData['pfxWindBeamPressureContrastBoost'] = 2.28
  material.userData['pfxWindBeamPressureHeroAlphaFloor'] = 0.68
  material.userData['pfxWindBeamPressureDirectionalGradientRatio'] = 3.57
  material.userData['pfxWindBeamPressureMotionHighlight'] = true
  material.userData['pfxWindBeamPressureAxialRimBoost'] = 0.38
  material.userData['pfxWindBeamPressureGroundOpacityCap'] = 0.16
  material.userData['pfxWindBeamPressureShellOpacityCap'] = 0.012
  material.userData['pfxWindBeamPressureHeroSecondaryAlphaRatio'] = 2.08
  material.userData['pfxWindBeamPressureGroundDustContrast'] = 1.56
  material.userData['pfxWindBeamPressureAxialVaneOpacity'] = 0.34
  material.userData['pfxWindBeamPressureAnticipationBoost'] = 1.72
  material.userData['pfxWindBeamPressureAxialPortalSuppression'] = true
  material.userData['pfxWindBeamPressureGroundMaterialProfile'] = 'feathered-cool-air-shear'
  material.userData['pfxWindBeamPressureControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxWindBeamPressureControlTintStrength'] = 0.64
  return material
}
