import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { smoothPfxWaterColumnNormals } from '../constants/04'

export function createPfxWaterColumnLifecycle(cycle: number): {
  energy: number
  foam: number
  height: number
  stage: 'gather' | 'surge' | 'crest' | 'collapse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const gather = smooth(phase / 0.1)
    return {
      energy: roundMetric(0.5 + gather * 0.3),
      foam: roundMetric(0.22 + gather * 0.2),
      height: roundMetric(0.5 + gather * 0.18),
      stage: 'gather',
    }
  }
  if (phase < 0.44) {
    const surge = smooth((phase - 0.1) / 0.34)
    return {
      energy: roundMetric(0.8 + surge * 0.2),
      foam: roundMetric(0.42 + surge * 0.58),
      height: roundMetric(0.68 + surge * 0.32),
      stage: 'surge',
    }
  }
  if (phase < 0.56) {
    const crest = (phase - 0.44) / 0.12
    return {
      energy: roundMetric(0.94 + Math.sin(crest * Math.PI) * 0.06),
      foam: roundMetric(0.9 + Math.sin(crest * Math.PI) * 0.1),
      height: roundMetric(0.97 + Math.sin(crest * Math.PI) * 0.03),
      stage: 'crest',
    }
  }
  if (phase < 0.94) {
    const collapse = smooth(Math.pow((phase - 0.56) / 0.38, 0.35))
    return {
      energy: roundMetric(1 - collapse * 0.95),
      foam: roundMetric(0.92 * (1 - collapse)),
      height: roundMetric(1 - collapse * 0.86),
      stage: 'collapse',
    }
  }
  return { energy: 0, foam: 0, height: 0, stage: 'rest' }
}

export function createPfxWaterColumnGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const progresses: number[] = []
  const flowLanes: number[] = []
  const crownMasks: number[] = []
  let activeProgress = 0
  let activeLane = 0
  let activeCrown = 0
  const deep: readonly [number, number, number] = [0.025, 0.36, 0.56]
  const blue: readonly [number, number, number] = [0.04, 0.5, 0.72]
  const cyan: readonly [number, number, number] = [0.12, 0.62, 0.8]
  const pale: readonly [number, number, number] = [0.38, 0.76, 0.9]
  const palette = [deep, blue, cyan, pale] as const
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
    progresses.push(activeProgress, activeProgress, activeProgress)
    flowLanes.push(activeLane, activeLane, activeLane)
    crownMasks.push(activeCrown, activeCrown, activeCrown)
  }
  const appendTube = (
    points: readonly THREE.Vector3[],
    radii: readonly number[],
    sides: number,
    lane: number,
  ) => {
    const rings = points.map((point, pointIndex) => {
      const progress = pointIndex / Math.max(1, points.length - 1)
      const next = points[Math.min(points.length - 1, pointIndex + 1)]!
      const previous = points[Math.max(0, pointIndex - 1)]!
      const axis = next.clone().sub(previous).normalize()
      const basisA = axis.clone().cross(Math.abs(axis.y) > 0.86 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize()
      const basisB = axis.clone().cross(basisA).normalize()
      return Array.from({ length: sides }, (_, side) => {
        const angle = side / sides * Math.PI * 2 + lane * 0.37 + progress * 0.28
        const irregular = 0.9 + ((side + pointIndex + lane) % 3) * 0.07
        return point.clone()
          .addScaledVector(basisA, Math.cos(angle) * radii[pointIndex]! * irregular)
          .addScaledVector(basisB, Math.sin(angle) * radii[pointIndex]! * (0.88 + (side % 2) * 0.1))
      })
    })
    for (let station = 0; station < rings.length - 1; station += 1) {
      activeProgress = station / Math.max(1, rings.length - 1)
      for (let side = 0; side < sides; side += 1) {
        activeLane = lane === 0 ? side % 3 : lane
        const nextSide = (side + 1) % sides
        const a = rings[station]![side]!
        const b = rings[station]![nextSide]!
        const c = rings[station + 1]![nextSide]!
        const d = rings[station + 1]![side]!
        const colorA = palette[(side + lane) % palette.length]!
        const colorB = palette[(side + lane + 1) % palette.length]!
        pushTriangle(a, b, c, colorA, colorB, colorB)
        pushTriangle(a, c, d, colorA, colorB, colorA)
      }
    }
    activeProgress = 0
    const root = points[0]!
    const rootRing = rings[0]!
    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides
      pushTriangle(root, rootRing[nextSide]!, rootRing[side]!, deep, blue, cyan)
    }
    activeProgress = 1
    const tip = points.at(-1)!
    const tipRing = rings.at(-1)!
    for (let side = 0; side < sides; side += 1) {
      const nextSide = (side + 1) % sides
      pushTriangle(tip, tipRing[side]!, tipRing[nextSide]!, pale, cyan, blue)
    }
  }

  const appendTeardropBulb = (
    attachment: THREE.Vector3,
    radius: number,
    length: number,
    lane: number,
  ) => {
    activeProgress = 0.94
    activeLane = lane
    activeCrown = 1
    const sides = 8
    const top = attachment.clone().add(new THREE.Vector3(0, radius * 0.3, 0))
    const bottom = attachment.clone().add(new THREE.Vector3(0, -length, 0))
    const shoulder = Array.from({ length: sides }, (_, side) => {
      const angle = side / sides * Math.PI * 2 + lane * 0.19
      return attachment.clone().add(new THREE.Vector3(
        Math.cos(angle) * radius,
        -length * 0.28,
        Math.sin(angle) * radius,
      ))
    })
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides
      pushTriangle(top, shoulder[side]!, shoulder[next]!, pale, cyan, pale)
      pushTriangle(bottom, shoulder[next]!, shoulder[side]!, blue, cyan, deep)
    }
  }

  const braidedStreamCount = 3
  const centerlineStations = 17
  for (let lane = 0; lane < 1; lane += 1) {
    const points = Array.from({ length: centerlineStations }, (_, station) => {
      const progress = station / (centerlineStations - 1)
      const angle = progress * Math.PI * 1.08
      const orbit = 0.065 * Math.sin(progress * Math.PI)
      return new THREE.Vector3(
        Math.cos(angle) * orbit + Math.sin(progress * 7.1 + lane) * 0.025,
        -1.08 + progress * 2.52,
        Math.sin(angle) * orbit + Math.cos(progress * 6.4 + lane * 0.7) * 0.025,
      )
    })
    const radii = points.map((_, station) => {
      const progress = station / (centerlineStations - 1)
      const body = 0.29
      return body * (0.98 - progress * 0.2) * (0.96 + Math.sin(progress * Math.PI * 3.2) * 0.04)
    })
    appendTube(points, radii, 16, lane)
  }

  const baseSplashLobeCount = 5
  const baseSegments = 32
  const baseProfiles = [
    { radius: 0.1, y: -1.04, wave: 0 },
    { radius: 0.3, y: -0.82, wave: 0.045 },
    { radius: 0.54, y: -0.87, wave: 0.09 },
    { radius: 0.76, y: -1.015, wave: 0.14 },
  ] as const
  const baseTop = baseProfiles.map((profile) => Array.from({ length: baseSegments }, (_, segment) => {
    const angle = segment / baseSegments * Math.PI * 2
    const lobeWave = Math.sin(angle * baseSplashLobeCount - 0.48) * profile.wave
    const asymmetry = Math.cos(angle - 0.2) * profile.wave * 0.35
    return new THREE.Vector3(
      Math.cos(angle) * profile.radius * 1.15 * (1 + lobeWave),
      profile.y + lobeWave * 0.45 + asymmetry,
      Math.sin(angle) * profile.radius * (0.9 + Math.cos(angle * 2) * 0.02),
    )
  }))
  const baseBottom = baseTop.map((ring, ringIndex) => ring.map((point) => point.clone().add(new THREE.Vector3(0, -0.045 - ringIndex * 0.008, 0))))
  for (let ring = 0; ring < baseTop.length - 1; ring += 1) {
    activeProgress = ring / baseTop.length * 0.2
    for (let segment = 0; segment < baseSegments; segment += 1) {
      activeLane = segment % 3
      const next = (segment + 1) % baseSegments
      pushTriangle(baseTop[ring]![segment]!, baseTop[ring]![next]!, baseTop[ring + 1]![next]!, blue, cyan, pale)
      pushTriangle(baseTop[ring]![segment]!, baseTop[ring + 1]![next]!, baseTop[ring + 1]![segment]!, blue, pale, cyan)
      pushTriangle(baseBottom[ring]![segment]!, baseBottom[ring + 1]![next]!, baseBottom[ring]![next]!, deep, blue, deep)
      pushTriangle(baseBottom[ring]![segment]!, baseBottom[ring + 1]![segment]!, baseBottom[ring + 1]![next]!, deep, blue, blue)
    }
  }
  for (let segment = 0; segment < baseSegments; segment += 1) {
    const next = (segment + 1) % baseSegments
    const outer = baseTop.length - 1
    pushTriangle(baseTop[outer]![segment]!, baseTop[outer]![next]!, baseBottom[outer]![next]!, cyan, pale, blue)
    pushTriangle(baseTop[outer]![segment]!, baseBottom[outer]![next]!, baseBottom[outer]![segment]!, cyan, blue, deep)
    pushTriangle(baseTop[0]![segment]!, baseBottom[0]![next]!, baseTop[0]![next]!, blue, deep, cyan)
    pushTriangle(baseTop[0]![segment]!, baseBottom[0]![segment]!, baseBottom[0]![next]!, blue, deep, deep)
  }

  const crownJetCount = 9
  const crownReachClasses = [0.7, 0.82, 0.96, 1.08] as const
  const crownArcStationCount = 8
  const crownArcCrossSectionFaces = 11
  const crownTriangleStart = positions.length / 9
  const crownReaches: number[] = []
  const crownPoints: THREE.Vector3[] = []
  const crownAzimuths = [0.05, 0.38, 0.92, 1.58, 2.45, 3.08, 3.62, 4.45, 5.48] as const
  const authoredCrownReaches = [1.28, 0.82, 0.62, 0.7, 0.78, 1.18, 0.62, 0.58, 0.68] as const
  const crownTerminalDrops = [0.52, 0.42, 0.58, 0.46, 0.64, 0.48, 0.56, 0.44, 0.6] as const
  const dropletLengths = [0.11, 0.15, 0.19] as const
  activeCrown = 1
  for (let jet = 0; jet < crownJetCount; jet += 1) {
    const angle = crownAzimuths[jet]!
    const reach = authoredCrownReaches[jet]!
    crownReaches.push(reach)
    const bend = ((jet % 2 === 0 ? 1 : -1) * (0.055 + (jet % 3) * 0.018))
    const points = Array.from({ length: crownArcStationCount }, (_, station) => {
      const progress = station / (crownArcStationCount - 1)
      const radial = reach * Math.sin(progress * Math.PI * 0.5)
      const arcAngle = angle + Math.sin(progress * Math.PI) * bend
      const lift = Math.sin(progress * Math.PI) * (0.28 + (jet % 4) * 0.045)
      return new THREE.Vector3(
        Math.cos(arcAngle) * radial,
        1.29 + lift - progress * crownTerminalDrops[jet]!,
        Math.sin(arcAngle) * radial * (0.88 + Math.cos(angle * 2 - 0.3) * 0.035),
      )
    })
    crownPoints.push(...points)
    const radii = points.map((_, station) => {
      const progress = station / (crownArcStationCount - 1)
      return 0.145 * (1 - progress * 0.9) * (0.94 + Math.sin(progress * Math.PI * 2 + jet) * 0.06)
    })
    appendTube(points, radii, crownArcCrossSectionFaces, jet % 3)
    const dropletLength = dropletLengths[jet % dropletLengths.length]!
    appendTeardropBulb(points.at(-1)!, 0.043 + (jet % 3) * 0.009, dropletLength, jet % 3)
  }
  const crownTriangleCount = positions.length / 9 - crownTriangleStart

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxWaterProgress', new THREE.Float32BufferAttribute(progresses, 1))
  geometry.setAttribute('pfxWaterFlowLane', new THREE.Float32BufferAttribute(flowLanes, 1))
  geometry.setAttribute('pfxWaterCrownMask', new THREE.Float32BufferAttribute(crownMasks, 1))
  smoothPfxWaterColumnNormals(geometry)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxWaterColumnGeometry'] = 'closed-braided-geyser-with-radial-splash-volume'
  geometry.userData['pfxWaterColumnDrawCalls'] = 1
  geometry.userData['pfxWaterColumnClosedFaces'] = true
  geometry.userData['pfxWaterColumnWorldSpaceVolume'] = true
  geometry.userData['pfxWaterColumnBillboardCount'] = 0
  geometry.userData['pfxWaterColumnBraidedStreamCount'] = braidedStreamCount
  geometry.userData['pfxWaterColumnCenterlineStations'] = centerlineStations
  geometry.userData['pfxWaterColumnCrossSectionFaces'] = 16
  geometry.userData['pfxWaterColumnBaseSplashLobeCount'] = baseSplashLobeCount
  geometry.userData['pfxWaterColumnConnectedBaseSplash'] = true
  geometry.userData['pfxWaterColumnCrownJetCount'] = crownJetCount
  geometry.userData['pfxWaterColumnConnectedCrown'] = true
  geometry.userData['pfxWaterColumnCrownTopology'] = 'closed-arcing-jets'
  geometry.userData['pfxWaterColumnCrownArcStationCount'] = crownArcStationCount
  geometry.userData['pfxWaterColumnCrownArcCrossSectionFaces'] = crownArcCrossSectionFaces
  geometry.userData['pfxWaterColumnCrownTriangleCount'] = crownTriangleCount
  geometry.userData['pfxWaterColumnCrownJetLengthClasses'] = crownReachClasses.length
  geometry.userData['pfxWaterColumnAttachedDropletBulbCount'] = crownJetCount
  geometry.userData['pfxWaterColumnClosedDropletBulbs'] = true
  geometry.userData['pfxWaterColumnDropletLengthClasses'] = dropletLengths.length
  geometry.userData['pfxWaterColumnCrownAngularGaps'] = true
  geometry.userData['pfxWaterColumnCrownVolumetricDepth'] = true
  geometry.userData['pfxWaterColumnPlanarCrownPanelCount'] = 0
  geometry.userData['pfxWaterColumnIrregularJetAzimuths'] = true
  geometry.userData['pfxWaterColumnCrownReachVariance'] = Math.max(...crownReaches) - Math.min(...crownReaches)
  geometry.userData['pfxWaterColumnCrownBallisticDrop'] = Math.min(...crownTerminalDrops)
  geometry.userData['pfxWaterColumnCrownTipRadius'] = 0.145 * 0.1
  geometry.userData['pfxWaterColumnFrontReachBalance'] = Math.min(authoredCrownReaches[0], authoredCrownReaches[5]) / Math.max(authoredCrownReaches[0], authoredCrownReaches[5])
  const crownGaps = crownAzimuths.map((angle, index) => {
    const next = crownAzimuths[(index + 1) % crownAzimuths.length]! + (index === crownAzimuths.length - 1 ? Math.PI * 2 : 0)
    return next - angle
  })
  geometry.userData['pfxWaterColumnJetGapRatio'] = Math.max(...crownGaps) / Math.min(...crownGaps)
  const crownXs = crownPoints.map((point) => point.x)
  const crownZs = crownPoints.map((point) => point.z)
  geometry.userData['pfxWaterColumnCrownWidthDepthRatio'] = (Math.max(...crownXs) - Math.min(...crownXs)) / (Math.max(...crownZs) - Math.min(...crownZs))
  const baseYs = baseTop.flat().map((point) => point.y)
  const baseXs = baseTop.flat().map((point) => point.x)
  const baseZs = baseTop.flat().map((point) => point.z)
  geometry.userData['pfxWaterColumnBaseWidthDepthRatio'] = (Math.max(...baseXs) - Math.min(...baseXs)) / (Math.max(...baseZs) - Math.min(...baseZs))
  geometry.userData['pfxWaterColumnBaseVerticalRelief'] = Math.max(...baseYs) - Math.min(...baseYs)
  geometry.userData['pfxWaterColumnSmoothNormals'] = true
  geometry.userData['pfxWaterColumnAsymmetric'] = true
  geometry.userData['pfxWaterColumnWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxWaterColumnDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxWaterColumnHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxWaterColumnMaterial(
  opacity: number,
  primaryColor = '#168fd1',
  secondaryColor = '#bdefff',
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
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
    vertexShader: /* glsl */ `
      uniform float uCycle;
      attribute float pfxWaterProgress;
      attribute float pfxWaterFlowLane;
      attribute float pfxWaterCrownMask;
      varying vec3 vWaterColor;
      varying vec3 vWaterNormal;
      varying vec3 vWaterViewPosition;
      varying vec3 vWaterObjectPosition;
      varying float vWaterProgress;
      varying float vWaterLane;
      float mobileTriWave(float value) {
        return abs(fract(value) - 0.5) * 2.0;
      }
      void main() {
        float swayEnvelope = sin(pfxWaterProgress * 3.14159265);
        float laneWave = sin(uCycle * 18.8495559 + pfxWaterProgress * 12.0 + pfxWaterFlowLane * 1.73);
        vec3 transformed = position;
        transformed.x += laneWave * swayEnvelope * 0.026;
        transformed.z += cos(uCycle * 15.7079633 + pfxWaterProgress * 10.0 + pfxWaterFlowLane) * swayEnvelope * 0.022;
        float crownBuild = smoothstep(0.0, 0.14, uCycle);
        float crownEmergence = smoothstep(pfxWaterProgress * 0.72, pfxWaterProgress * 0.72 + 0.22, crownBuild);
        float crownFactor = mix(1.0, crownEmergence, pfxWaterCrownMask);
        transformed.xz *= crownFactor;
        transformed.y = mix(1.29, transformed.y, crownFactor);
        vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vWaterColor = color;
        vWaterNormal = normalize(normalMatrix * normal);
        vWaterViewPosition = viewPosition.xyz;
        vWaterObjectPosition = transformed;
        vWaterProgress = pfxWaterProgress;
        vWaterLane = pfxWaterFlowLane;
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
      varying vec3 vWaterColor;
      varying vec3 vWaterNormal;
      varying vec3 vWaterViewPosition;
      varying vec3 vWaterObjectPosition;
      varying float vWaterProgress;
      varying float vWaterLane;
      float mobileTriWave(float value) {
        return abs(fract(value) - 0.5) * 2.0;
      }
      void main() {
        vec3 normal = normalize(vWaterNormal);
        vec3 viewDirection = normalize(-vWaterViewPosition);
        float facing = abs(dot(normal, viewDirection));
        float rimBase = 1.0 - facing;
        float rim = rimBase * rimBase;
        float broadFlow = mobileTriWave(vWaterObjectPosition.y * 1.55 - uCycle * 4.0 + vWaterObjectPosition.x * 1.1 + vWaterObjectPosition.z * 0.72);
        float fineFlow = mobileTriWave(vWaterObjectPosition.y * 2.75 - uCycle * 5.8 - vWaterObjectPosition.x * 0.66 + vWaterLane * 0.27);
        float rivulet = smoothstep(0.38, 0.82, broadFlow * 0.68 + fineFlow * 0.32);
        float waterTransmission = smoothstep(0.12, 0.88, rimBase);
        float causticWave = mobileTriWave(dot(vWaterObjectPosition, vec3(1.15, 1.9, 0.86)) - uCycle * 3.6);
        float internalCaustic = smoothstep(0.72, 0.96, causticWave) * (0.34 + waterTransmission * 0.66);
        float refractionBand = smoothstep(0.56, 0.9, broadFlow) * waterTransmission;
        vec3 waterLightDirection = normalize(vec3(-0.35, 0.68, 0.64));
        vec3 waterHalfDirection = normalize(waterLightDirection + viewDirection);
        float specularSheenBase = max(0.0, dot(normal, waterHalfDirection));
        float specularSheenSquared = specularSheenBase * specularSheenBase;
        float specularSheen = specularSheenSquared * specularSheenSquared * specularSheenSquared;
        float cylindricalRoll = 0.56 + max(0.0, dot(normal, waterLightDirection)) * 0.44;
        float directionalVolume = mix(0.42, 1.0, max(0.0, dot(normal, waterLightDirection)));
        float backscatter = smoothstep(0.34, 0.92, max(0.0, dot(-normal, waterLightDirection))) * waterTransmission;
        float collapse = smoothstep(0.56, 0.94, uCycle);
        float collapseFront = 1.0 - collapse;
        float collapseCoverage = 1.0 - smoothstep(collapseFront - 0.08, collapseFront + 0.04, vWaterProgress);
        float smoothCylindricalAlpha = 0.74 + internalCaustic * 0.08 + rim * 0.1;
        vec3 cohesiveHull = mix(uPrimaryColor * 0.62, uPrimaryColor, smoothstep(-1.0, 1.55, vWaterObjectPosition.y));
        vec3 controlledWaterColor = mix(cohesiveHull, uPrimaryColor, 0.24);
        vec3 water = controlledWaterColor * (0.44 + facing * 0.08 + cylindricalRoll * 0.18 + directionalVolume * 0.34);
        water = mix(water, mix(uPrimaryColor, uSecondaryColor, 0.3), waterTransmission * 0.34);
        water += uSecondaryColor * internalCaustic * mix(0.38, 0.58, uDensity);
        water += uPrimaryColor * refractionBand * 0.22;
        water += uPrimaryColor * rivulet * mix(0.025, 0.065, uDensity);
        water += uSecondaryColor * rim * mix(0.24, 0.42, uStyleEdgeHardness);
        water += uSecondaryColor * specularSheen * 0.72;
        water += uSecondaryColor * backscatter * 0.16;
        gl_FragColor = vec4(water, uOpacity * smoothCylindricalAlpha * collapseCoverage * 0.72);
      }
    `,
  })
  material.userData['pfxWaterColumnMaterial'] = 'turbulent-transmissive-rivulet-body'
  material.userData['pfxWaterColumnControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxWaterColumnLightingModel'] = 'directional-cylindrical-volume-with-backscatter'
  return material
}
