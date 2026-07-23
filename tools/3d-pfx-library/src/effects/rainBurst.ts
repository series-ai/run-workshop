import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { smoothPfxWaterColumnNormals } from '../constants/04'

export function createPfxRainBurstLifecycle(cycle: number): {
  energy: number
  rain: number
  splash: number
  ripple: number
  stage: 'descent' | 'crown' | 'ripple' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.14) {
    const descent = smooth(phase / 0.14)
    return {
      energy: roundMetric(0.46 + descent * 0.4),
      rain: roundMetric(1 - descent * 0.12),
      splash: roundMetric(0.08 + descent * 0.54),
      ripple: roundMetric(descent * 0.08),
      stage: 'descent',
    }
  }
  if (phase < 0.42) {
    const crown = smooth((phase - 0.14) / 0.28)
    return {
      energy: roundMetric(0.86 + Math.sin(crown * Math.PI) * 0.14),
      rain: roundMetric(0.88 * (1 - crown * 0.72)),
      splash: roundMetric(0.7 + Math.sin(Math.min(1, crown * 1.8) * Math.PI * 0.5) * 0.3),
      ripple: roundMetric(0.08 + crown * 0.48),
      stage: 'crown',
    }
  }
  if (phase < 0.84) {
    const release = smooth((phase - 0.42) / 0.42)
    const crownRelease = smooth((phase - 0.68) / 0.16)
    return {
      energy: roundMetric(0.88 * (1 - release)),
      rain: roundMetric(0.24 * (1 - release)),
      splash: roundMetric(0.92 * (1 - crownRelease)),
      ripple: roundMetric(0.56 + Math.sin(release * Math.PI) * 0.44),
      stage: 'ripple',
    }
  }
  return { energy: 0, rain: 0, splash: 0, ripple: 0, stage: 'rest' }
}

export function createPfxRainBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const forms: number[] = []
  const progresses: number[] = []
  const deep: readonly [number, number, number] = [0.025, 0.29, 0.52]
  const blue: readonly [number, number, number] = [0.05, 0.48, 0.72]
  const cyan: readonly [number, number, number] = [0.2, 0.68, 0.86]
  const pale: readonly [number, number, number] = [0.58, 0.9, 0.98]
  const pushTriangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    colorA: readonly [number, number, number],
    colorB: readonly [number, number, number],
    colorC: readonly [number, number, number],
    form: number,
    progress: number,
  ) => {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    colors.push(...colorA, ...colorB, ...colorC)
    forms.push(form, form, form)
    progresses.push(progress, progress, progress)
  }
  const appendTube = (
    points: readonly THREE.Vector3[],
    radii: readonly number[],
    sides: number,
    form: number,
    colorOffset: number,
  ) => {
    const palette = [deep, blue, cyan, pale] as const
    const rings = points.map((point, station) => {
      const previous = points[Math.max(0, station - 1)]!
      const next = points[Math.min(points.length - 1, station + 1)]!
      const axis = next.clone().sub(previous).normalize()
      const reference = Math.abs(axis.y) > 0.88 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
      const basisA = axis.clone().cross(reference).normalize()
      const basisB = axis.clone().cross(basisA).normalize()
      return Array.from({ length: sides }, (_, side) => {
        const angle = side / sides * Math.PI * 2 + station * 0.14
        return point.clone()
          .addScaledVector(basisA, Math.cos(angle) * radii[station]!)
          .addScaledVector(basisB, Math.sin(angle) * radii[station]!)
      })
    })
    for (let station = 0; station < rings.length - 1; station += 1) {
      const progress = station / Math.max(1, rings.length - 1)
      for (let side = 0; side < sides; side += 1) {
        const next = (side + 1) % sides
        const colorA = palette[(side + colorOffset) % palette.length]!
        const colorB = palette[(side + colorOffset + 1) % palette.length]!
        pushTriangle(rings[station]![side]!, rings[station]![next]!, rings[station + 1]![next]!, colorA, colorB, colorB, form, progress)
        pushTriangle(rings[station]![side]!, rings[station + 1]![next]!, rings[station + 1]![side]!, colorA, colorB, colorA, form, progress)
      }
    }
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides
      pushTriangle(points[0]!, rings[0]![next]!, rings[0]![side]!, deep, blue, cyan, form, 0)
      pushTriangle(points.at(-1)!, rings.at(-1)![side]!, rings.at(-1)![next]!, pale, cyan, blue, form, 1)
    }
  }
  const appendDroplet = (center: THREE.Vector3, radius: number, length: number, progress: number, form = 3) => {
    const source = new THREE.SphereGeometry(1, 8, 6).toNonIndexed()
    const sourcePosition = source.getAttribute('position') as THREE.BufferAttribute
    for (let index = 0; index < sourcePosition.count; index += 3) {
      const localYs: number[] = []
      const vertices = [0, 1, 2].map((offset) => {
        const vertex = new THREE.Vector3().fromBufferAttribute(sourcePosition, index + offset)
        localYs.push(vertex.y)
        const taper = 0.7 + (vertex.y + 1) * 0.15
        return new THREE.Vector3(
          center.x + vertex.x * radius * taper,
          center.y + vertex.y * length,
          center.z + vertex.z * radius * taper,
        )
      })
      const colorForHeight = (height: number): readonly [number, number, number] => (
        height > 0.3 ? pale : height < -0.3 ? blue : cyan
      )
      pushTriangle(
        vertices[0]!,
        vertices[1]!,
        vertices[2]!,
        colorForHeight(localYs[0]!),
        colorForHeight(localYs[1]!),
        colorForHeight(localYs[2]!),
        form,
        progress,
      )
    }
    source.dispose()
  }

  const puddleSegments = 36
  const puddleLobeCount = 5
  const topCenter = new THREE.Vector3(0, 0.078, 0)
  const bottomCenter = new THREE.Vector3(0, -0.035, 0)
  const puddleTop = Array.from({ length: puddleSegments }, (_, segment) => {
    const angle = segment / puddleSegments * Math.PI * 2
    const radius = 0.72 * (1 + Math.sin(angle * puddleLobeCount + 0.45) * 0.035 + Math.cos(angle - 0.3) * 0.025)
    return new THREE.Vector3(Math.cos(angle) * radius * 1.08, 0.018 + Math.sin(angle * 3) * 0.008, Math.sin(angle) * radius * 0.92)
  })
  const puddleMid = puddleTop.map((point, segment) => new THREE.Vector3(
    point.x * 0.56,
    0.056 + Math.sin(segment / puddleSegments * Math.PI * 6 + 0.3) * 0.006,
    point.z * 0.56,
  ))
  const puddleBottom = puddleTop.map((point) => new THREE.Vector3(point.x, -0.035, point.z))
  for (let segment = 0; segment < puddleSegments; segment += 1) {
    const next = (segment + 1) % puddleSegments
    pushTriangle(topCenter, puddleMid[segment]!, puddleMid[next]!, cyan, cyan, cyan, 0, segment / puddleSegments)
    pushTriangle(puddleMid[segment]!, puddleTop[segment]!, puddleTop[next]!, cyan, blue, blue, 0, segment / puddleSegments)
    pushTriangle(puddleMid[segment]!, puddleTop[next]!, puddleMid[next]!, cyan, blue, cyan, 0, segment / puddleSegments)
    pushTriangle(bottomCenter, puddleBottom[next]!, puddleBottom[segment]!, deep, blue, deep, 0, segment / puddleSegments)
    pushTriangle(puddleTop[segment]!, puddleBottom[segment]!, puddleBottom[next]!, blue, deep, blue, 0, segment / puddleSegments)
    pushTriangle(puddleTop[segment]!, puddleBottom[next]!, puddleTop[next]!, cyan, blue, pale, 0, segment / puddleSegments)
  }

  const crownJetCount = 0
  const crownPeakCount = 9
  const crownRingSegments = 72
  const crownFrontRings = Array.from({ length: 3 }, (_, ring) => Array.from({ length: crownRingSegments }, (_, segment) => {
    const angle = segment / crownRingSegments * Math.PI * 2
    const peak = Math.pow(0.5 + Math.sin(angle * crownPeakCount + 0.38) * 0.5, 1.5)
    const radius = ring === 0 ? 0.22 : ring === 1 ? 0.62 : 0.9 * (1 + Math.sin(angle * 3 - 0.4) * 0.045)
    const height = ring === 0
      ? 0.025
      : ring === 1
        ? 0.22 + Math.sin(angle * 4 + 0.2) * 0.03
        : 0.38 + peak * (0.18 + (segment % 4) * 0.01) + Math.sin(angle - 0.25) * 0.035
    return new THREE.Vector3(Math.cos(angle) * radius * 1.06, height, Math.sin(angle) * radius * 0.9)
  }))
  const crownBackRings = crownFrontRings.map((ring, ringIndex) => ring.map((point) => {
    const radialScale = ringIndex === 0 ? 0.74 : 0.88
    return new THREE.Vector3(point.x * radialScale, point.y - 0.12, point.z * radialScale)
  }))
  for (let segment = 0; segment < crownRingSegments; segment += 1) {
    const next = (segment + 1) % crownRingSegments
    const progress = segment / crownRingSegments
    for (let ring = 0; ring < crownFrontRings.length - 1; ring += 1) {
      pushTriangle(crownFrontRings[ring]![segment]!, crownFrontRings[ring]![next]!, crownFrontRings[ring + 1]![next]!, blue, cyan, cyan, 1, progress)
      pushTriangle(crownFrontRings[ring]![segment]!, crownFrontRings[ring + 1]![next]!, crownFrontRings[ring + 1]![segment]!, blue, cyan, cyan, 1, progress)
      pushTriangle(crownBackRings[ring]![segment]!, crownBackRings[ring + 1]![next]!, crownBackRings[ring]![next]!, deep, blue, deep, 1, progress)
      pushTriangle(crownBackRings[ring]![segment]!, crownBackRings[ring + 1]![segment]!, crownBackRings[ring + 1]![next]!, deep, blue, blue, 1, progress)
    }
    const rim = crownFrontRings.length - 1
    pushTriangle(crownFrontRings[rim]![segment]!, crownFrontRings[rim]![next]!, crownBackRings[rim]![next]!, pale, cyan, blue, 1, progress)
    pushTriangle(crownFrontRings[rim]![segment]!, crownBackRings[rim]![next]!, crownBackRings[rim]![segment]!, pale, blue, deep, 1, progress)
    pushTriangle(crownFrontRings[0]![segment]!, crownBackRings[0]![next]!, crownFrontRings[0]![next]!, blue, deep, cyan, 1, progress)
    pushTriangle(crownFrontRings[0]![segment]!, crownBackRings[0]![segment]!, crownBackRings[0]![next]!, blue, deep, deep, 1, progress)
  }
  appendDroplet(new THREE.Vector3(0.02, 0.08, -0.015), 0.32, 0.11, 0.46, 1)

  const rippleBandCount = 2
  for (let band = 0; band < rippleBandCount; band += 1) {
    const segments = 30
    const sides = 8
    const radius = 0.92 + band * 0.36
    const tubeRadius = 0.068 - band * 0.016
    const points = Array.from({ length: segments }, (_, segment) => {
      const angle = segment / segments * Math.PI * 2
      return new THREE.Vector3(
        Math.cos(angle) * radius * (1.04 + Math.sin(angle * 3 + band) * 0.065 + Math.sin(angle * 7 - band) * 0.022),
        0.008 + band * 0.008,
        Math.sin(angle) * radius * (0.88 + Math.cos(angle * 4 + band) * 0.035),
      )
    })
    for (let segment = 0; segment < segments; segment += 1) {
      const nextSegment = (segment + 1) % segments
      for (let side = 0; side < sides; side += 1) {
        const nextSide = (side + 1) % sides
        const a0 = side / sides * Math.PI * 2
        const a1 = nextSide / sides * Math.PI * 2
        const point = points[segment]!
        const nextPoint = points[nextSegment]!
        const pointTubeRadius = tubeRadius * (0.72 + (Math.sin(segment * 1.71 + band) * 0.5 + 0.5) * 0.56)
        const nextTubeRadius = tubeRadius * (0.72 + (Math.sin(nextSegment * 1.71 + band) * 0.5 + 0.5) * 0.56)
        const a = new THREE.Vector3(point.x * (1 + Math.cos(a0) * pointTubeRadius / radius), point.y + Math.sin(a0) * pointTubeRadius, point.z * (1 + Math.cos(a0) * pointTubeRadius / radius))
        const b = new THREE.Vector3(nextPoint.x * (1 + Math.cos(a0) * nextTubeRadius / radius), nextPoint.y + Math.sin(a0) * nextTubeRadius, nextPoint.z * (1 + Math.cos(a0) * nextTubeRadius / radius))
        const c = new THREE.Vector3(nextPoint.x * (1 + Math.cos(a1) * nextTubeRadius / radius), nextPoint.y + Math.sin(a1) * nextTubeRadius, nextPoint.z * (1 + Math.cos(a1) * nextTubeRadius / radius))
        const d = new THREE.Vector3(point.x * (1 + Math.cos(a1) * pointTubeRadius / radius), point.y + Math.sin(a1) * pointTubeRadius, point.z * (1 + Math.cos(a1) * pointTubeRadius / radius))
        pushTriangle(a, b, c, blue, cyan, pale, 2, band)
        pushTriangle(a, c, d, blue, pale, cyan, 2, band)
      }
    }
  }

  const detachedDropletCount = 14
  for (let droplet = 0; droplet < detachedDropletCount; droplet += 1) {
    const angle = droplet / detachedDropletCount * Math.PI * 2 + Math.sin(droplet * 2.1) * 0.24
    const reach = 0.5 + (droplet % 4) * 0.15
    const center = new THREE.Vector3(
      Math.cos(angle) * reach * (1.02 + (droplet % 3) * 0.07),
      0.42 + (droplet % 5) * 0.14 + Math.abs(Math.sin(angle * 1.7)) * 0.08,
      Math.sin(angle) * reach * (0.76 + (droplet % 3) * 0.13),
    )
    appendDroplet(center, 0.038 + (droplet % 3) * 0.007, 0.065 + (droplet % 4) * 0.014, droplet / detachedDropletCount)
  }

  const mistVolumeLobeCount = 3
  appendDroplet(new THREE.Vector3(-0.18, 0.3, -0.2), 0.24, 0.14, 0.18, 4)
  appendDroplet(new THREE.Vector3(0.16, 0.36, 0.04), 0.27, 0.17, 0.52, 4)
  appendDroplet(new THREE.Vector3(0.02, 0.28, 0.25), 0.22, 0.13, 0.81, 4)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setAttribute('pfxRainForm', new THREE.Float32BufferAttribute(forms, 1))
  geometry.setAttribute('pfxRainProgress', new THREE.Float32BufferAttribute(progresses, 1))
  smoothPfxWaterColumnNormals(geometry)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxRainBurstGeometry'] = 'closed-continuous-nine-peak-crown-puddle-ripples-and-droplets'
  geometry.userData['pfxRainBurstDrawCalls'] = 1
  geometry.userData['pfxRainBurstClosedFaces'] = true
  geometry.userData['pfxRainBurstWorldSpaceVolume'] = true
  geometry.userData['pfxRainBurstBillboardCount'] = 0
  geometry.userData['pfxRainBurstCrownJetCount'] = crownJetCount
  geometry.userData['pfxRainBurstCrownPeakCount'] = crownPeakCount
  geometry.userData['pfxRainBurstCrownRingSegments'] = crownRingSegments
  geometry.userData['pfxRainBurstContinuousCrownWall'] = true
  geometry.userData['pfxRainBurstCrownTopology'] = 'closed-annular-water-sheet-with-irregular-peaked-rim'
  geometry.userData['pfxRainBurstCrownSurfacePalette'] = 'cohesive-smooth-water-sheet'
  geometry.userData['pfxRainBurstCrownDiameter'] = 1.8
  geometry.userData['pfxRainBurstCrownSheetThickness'] = 0.12
  geometry.userData['pfxRainBurstPuddleLobeCount'] = puddleLobeCount
  geometry.userData['pfxRainBurstDomedPuddleSurface'] = true
  geometry.userData['pfxRainBurstPuddleSurfaceRingCount'] = 2
  geometry.userData['pfxRainBurstRippleBandCount'] = rippleBandCount
  geometry.userData['pfxRainBurstRippleRadialSegments'] = 30
  geometry.userData['pfxRainBurstRippleCrossSectionSides'] = 8
  geometry.userData['pfxRainBurstSmoothContinuousRipples'] = true
  geometry.userData['pfxRainBurstIntegratedGroundRipples'] = true
  geometry.userData['pfxRainBurstRippleTopology'] = 'continuous-organic-variable-width-water-ripples'
  geometry.userData['pfxRainBurstUniformContinuousRippleCount'] = 2
  geometry.userData['pfxRainBurstPuddleAnticipationProfile'] = 'smooth-directional-sheen-without-preimpact-rings'
  geometry.userData['pfxRainBurstPuddleVertexColorProfile'] = 'cohesive-cool-surface-with-shader-caustics'
  geometry.userData['pfxRainBurstDetachedDropletCount'] = detachedDropletCount
  geometry.userData['pfxRainBurstMistVolumeLobeCount'] = mistVolumeLobeCount
  geometry.userData['pfxRainBurstMistVolumeTopology'] = 'closed-translucent-depth-staggered-ellipsoids'
  geometry.userData['pfxRainBurstDropletTopology'] = 'closed-teardrop-volume'
  geometry.userData['pfxRainBurstAsymmetricAzimuths'] = true
  geometry.userData['pfxRainBurstSmoothNormals'] = true
  geometry.userData['pfxRainBurstAssetProvenance'] = 'original-procedural-closed-mesh'
  geometry.userData['pfxRainBurstTriangleCount'] = positions.length / 9
  geometry.userData['pfxRainBurstWidthSpan'] = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
  geometry.userData['pfxRainBurstDepthSpan'] = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
  geometry.userData['pfxRainBurstHeightSpan'] = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
  return geometry
}

export function createPfxRainBurstMaterial(
  opacity: number,
  primaryColor: string,
  secondaryColor: string,
  density: number,
  edgeHardness: number,
  paletteProfile: 'water' | 'mud' = 'water',
): THREE.ShaderMaterial {
  const vertexColorAssignment = paletteProfile === 'mud' ? 'vRainColor = vec3(1.0);' : 'vRainColor = color;'
  const puddlePaletteLockShader = paletteProfile === 'mud'
    ? /* glsl */ `
        float mudSedimentBand = smoothstep(0.18, 0.82, 0.5 + 0.5 * sin(vRainObjectPosition.x * 18.0 + vRainObjectPosition.z * 21.0 + vRainProgress * 4.0));
        vec3 umberPuddleBase = mix(uPrimaryColor * 0.82, uSecondaryColor * 0.92, clamp(0.28 + mudSedimentBand * 0.28 + puddleFresnel * 0.24 + puddleSpecularArc * 0.18, 0.0, 0.92));
        vec3 umberPuddlePaletteLock = mix(umberPuddleBase, uSecondaryColor * 1.08, mudSedimentBand * 0.2);
        umberPuddlePaletteLock += vec3(0.08, 0.035, 0.012) * puddleRefraction;
        color = mix(color, umberPuddlePaletteLock, puddleMask * 0.9);
        color += vec3(0.28, 0.12, 0.035) * coolPuddleSpecularSweep * 0.34;
        color += vec3(0.2, 0.075, 0.02) * puddleSurfaceGloss * 0.38;
        color += vec3(0.16, 0.055, 0.012) * puddleSurfaceDetail * 0.24;
      `
    : /* glsl */ `
        vec3 physicallyCoolPuddleBase = mix(vec3(0.025, 0.29, 0.52), vec3(0.58, 0.9, 0.98), clamp(0.28 + puddleCaustic * 0.18 + puddleFresnel * 0.3 + puddleSpecularArc * 0.16, 0.0, 0.9));
        vec3 coolPuddlePaletteLock = physicallyCoolPuddleBase;
        coolPuddlePaletteLock += vec3(0.42, 0.8, 0.96) * puddleRefraction * 0.1;
        color = mix(color, coolPuddlePaletteLock, puddleMask * 0.88);
        color += vec3(0.56, 0.9, 1.0) * coolPuddleSpecularSweep * 0.58;
        color += vec3(0.18, 0.58, 0.82) * puddleSurfaceGloss * 0.28;
        color += vec3(0.22, 0.68, 0.9) * puddleSurfaceDetail * 0.32;
      `
  const finalMudPaletteLockShader = paletteProfile === 'mud'
    ? /* glsl */ `
        float mudClodForm = step(2.5, vRainForm);
        float mudSiltVariation = 0.5 + 0.5 * sin(vRainObjectPosition.x * 23.0 - vRainObjectPosition.z * 17.0 + vRainProgress * 11.0);
        float mudWetPigmentLock = clamp(0.18 + mudSiltVariation * 0.34 + crownSpecular * 0.18 + dropletRim * 0.16, 0.0, 0.88);
        vec3 mudWetBody = mix(uPrimaryColor * 0.62, uSecondaryColor * 0.74, mudWetPigmentLock);
        vec3 mudNeutralUmber = mix(vec3(0.12, 0.085, 0.06), uSecondaryColor * 0.58, 0.34 + mudSiltVariation * 0.24);
        mudWetBody = mix(mudWetBody, mudNeutralUmber, 0.42);
        vec3 mudWetClodHighlight = mix(uSecondaryColor * 0.68, uSecondaryColor * 0.94, mudClodForm * 0.34 + crownSpecular * 0.38);
        color = mix(color, mudWetBody, 0.9);
        color += mudWetClodHighlight * (0.05 + mudClodForm * 0.1 + crownSpecular * 0.08);
        float mudValueCeiling = 0.46 + mudClodForm * 0.035 + crownSpecular * 0.03;
        color = min(color, vec3(mudValueCeiling, mudValueCeiling * 0.74, mudValueCeiling * 0.52));
      `
    : ''
  const material = new THREE.ShaderMaterial({
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    vertexColors: true,
    uniforms: {
      uOpacity: { value: opacity },
      uCycle: { value: 0 },
      uPrimaryColor: { value: new THREE.Color(primaryColor) },
      uSecondaryColor: { value: new THREE.Color(secondaryColor) },
      uDensity: { value: density },
      uEdgeHardness: { value: edgeHardness },
    },
    vertexShader: /* glsl */ `
      attribute float pfxRainForm;
      attribute float pfxRainProgress;
      varying vec3 vRainColor;
      varying vec3 vRainNormal;
      varying vec3 vRainObjectPosition;
      varying vec3 vRainViewPosition;
      varying float vRainForm;
      varying float vRainProgress;
      varying float vRainVisibility;
      uniform float uCycle;
      void main() {
        float descent = 1.0 - smoothstep(0.1, 0.34, uCycle);
        float splash = smoothstep(0.03, 0.2, uCycle) * (1.0 - smoothstep(0.7, 0.86, uCycle));
        float ripple = smoothstep(0.18, 0.38, uCycle) * (1.0 - smoothstep(0.78, 0.88, uCycle));
        vec3 transformed = position;
        if (pfxRainForm > 0.5 && pfxRainForm < 1.5) {
          transformed.xz *= 0.16 + splash * 0.84;
          transformed.y *= 0.12 + splash * 0.88;
          vRainVisibility = 0.04 + splash * 0.96;
        } else if (pfxRainForm > 1.5 && pfxRainForm < 2.5) {
          transformed.xz *= 0.46 + ripple * (0.5 + pfxRainProgress * 0.08);
          vRainVisibility = ripple;
        } else if (pfxRainForm > 2.5 && pfxRainForm < 3.5) {
          transformed.xz *= 0.3 + splash * 0.7;
          transformed.y *= 0.2 + splash * 0.8;
          transformed.y += splash * (0.08 + pfxRainProgress * 0.06);
          vRainVisibility = splash * (0.76 + pfxRainProgress * 0.24);
        } else if (pfxRainForm > 3.5) {
          transformed.xz *= 0.42 + splash * 0.58;
          transformed.y *= 0.34 + splash * 0.66;
          transformed.y += splash * 0.05;
          vRainVisibility = splash * 0.56;
        } else {
          transformed.xz *= 0.72 + max(splash, ripple) * 0.28;
          float puddleAnticipationVisibility = 0.28 + descent * 0.06 + splash * 0.48 + ripple * 0.2;
          vRainVisibility = puddleAnticipationVisibility;
        }
        ${vertexColorAssignment}
        vRainNormal = normalize(normalMatrix * normal);
        vRainObjectPosition = transformed;
        vec4 rainViewPosition = modelViewMatrix * vec4(transformed, 1.0);
        vRainViewPosition = rainViewPosition.xyz;
        vRainForm = pfxRainForm;
        vRainProgress = pfxRainProgress;
        gl_Position = projectionMatrix * rainViewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uPrimaryColor;
      uniform vec3 uSecondaryColor;
      uniform float uDensity;
      uniform float uEdgeHardness;
      varying vec3 vRainColor;
      varying vec3 vRainNormal;
      varying vec3 vRainObjectPosition;
      varying vec3 vRainViewPosition;
      varying float vRainForm;
      varying float vRainProgress;
      varying float vRainVisibility;
      void main() {
        vec3 normalDirection = normalize(vRainNormal);
        vec3 viewDirection = normalize(-vRainViewPosition);
        float keyLight = 0.5 + max(0.0, dot(normalDirection, normalize(vec3(-0.36, 0.82, 0.44)))) * 0.5;
        float waterTransmission = 0.52 + (1.0 - abs(dot(normalDirection, viewDirection))) * 0.34;
        float crownSpecular = smoothstep(0.56, 0.94, dot(normalDirection, normalize(vec3(-0.22, 0.86, 0.46))));
        float puddleDepth = vRainForm < 0.5 ? 0.78 + smoothstep(0.56, 0.0, length(vRainObjectPosition.xz)) * 0.2 : 1.0;
        float dropletMask = step(2.5, vRainForm) * (1.0 - step(3.5, vRainForm));
        float mistMask = step(3.5, vRainForm);
        float dropletRim = dropletMask * (0.12 + (1.0 - abs(dot(normalDirection, viewDirection))) * 0.28);
        float dropletGlint = dropletMask * smoothstep(0.48, 0.9, dot(normalDirection, normalize(vec3(-0.3, 0.88, 0.36))));
        float sprayDropletSpecular = dropletMask * smoothstep(0.42, 0.88, dot(normalDirection, normalize(vec3(-0.18, 0.94, 0.28))));
        float sprayDropletCaustic = dropletMask * (0.5 + sin(vRainObjectPosition.y * 37.0 + vRainProgress * 19.0) * 0.5);
        float dropletDirectionalShade = 0.8 + max(0.0, dot(normalDirection, normalize(vec3(-0.42, 0.84, 0.34)))) * 0.2;
        float rippleMask = step(1.5, vRainForm) * (1.0 - step(2.5, vRainForm));
        float rippleDistortion = 0.68 + (0.5 + sin(vRainObjectPosition.x * 29.0 + vRainObjectPosition.z * 23.0 + vRainProgress * 4.0) * 0.5) * 0.32;
        float rippleArcMask = smoothstep(0.28, 0.58, sin(atan(vRainObjectPosition.z, vRainObjectPosition.x) * 3.0 + vRainProgress * 2.7) * 0.5 + 0.5);
        float smoothPuddleDirectionalSheen = clamp(0.5 + vRainObjectPosition.x * 0.22 - vRainObjectPosition.z * 0.18, 0.0, 1.0);
        float coolPuddleSpecularSweep = (1.0 - step(0.5, vRainForm)) * (1.0 - smoothstep(0.08, 0.3, length(vRainObjectPosition.xz - vec2(-0.2, 0.14))));
        float puddleCaustic = (1.0 - step(0.5, vRainForm)) * (0.25 + smoothPuddleDirectionalSheen * 0.5);
        float puddleFresnel = (1.0 - step(0.5, vRainForm)) * pow(1.0 - abs(dot(normalDirection, viewDirection)), 2.0);
        float puddleSurfaceGloss = (1.0 - step(0.5, vRainForm)) * (0.24 + smoothPuddleDirectionalSheen * 0.26 + puddleFresnel * 0.32);
        float puddleSurfaceDetail = (1.0 - step(0.5, vRainForm)) * (1.0 - smoothstep(0.16, 0.72, length(vRainObjectPosition.xz - vec2(-0.18, 0.1))));
        float puddleSpecularArc = (1.0 - step(0.5, vRainForm)) * smoothstep(0.72, 0.98, sin(atan(vRainObjectPosition.z, vRainObjectPosition.x) - 0.65) * 0.5 + 0.5);
        float puddleRefraction = (1.0 - step(0.5, vRainForm)) * smoothstep(-0.9, 0.9, vRainObjectPosition.x * 0.8 + vRainObjectPosition.z * 0.35);
        vec3 controlledWaterColor = mix(uPrimaryColor, uSecondaryColor, clamp(vRainColor.b * 0.68 + crownSpecular * 0.28 + dropletRim, 0.0, 1.0));
        float specularBreakup = 0.82 + sin(vRainProgress * 31.0 + vRainObjectPosition.x * 17.0 + vRainObjectPosition.z * 23.0) * 0.18;
        float waterSheetMask = step(0.5, vRainForm) * (1.0 - step(1.5, vRainForm));
        float refractionRibbon = (0.5 + sin(vRainProgress * 23.0 + vRainObjectPosition.y * 19.0) * 0.5) * waterSheetMask;
        float impactContactGlow = exp(-length(vRainObjectPosition.xz) * 3.4) * (1.0 - smoothstep(0.08, 0.52, vRainObjectPosition.y));
        float puddleMask = 1.0 - step(0.5, vRainForm);
        vec3 color = controlledWaterColor * (vec3(0.86) + vRainColor * 0.52) * (0.88 + keyLight * waterTransmission * puddleDepth * 0.72 + crownSpecular * specularBreakup * 0.42);
        color += uSecondaryColor * refractionRibbon * (0.08 + crownSpecular * 0.18);
        color += uSecondaryColor * dropletGlint * 0.32;
        color *= mix(1.0, dropletDirectionalShade, dropletMask);
        vec3 craftedSprayDropletColor = mix(mix(uPrimaryColor, uSecondaryColor, 0.84), uSecondaryColor * 1.34, 0.38 + sprayDropletSpecular * 0.62);
        color = mix(color, craftedSprayDropletColor, dropletMask * 0.74);
        color += uSecondaryColor * sprayDropletSpecular * 0.72;
        color += mix(uPrimaryColor, uSecondaryColor, 0.72) * sprayDropletCaustic * dropletMask * 0.22;
        color += uSecondaryColor * rippleMask * rippleDistortion * 0.2;
        color += uSecondaryColor * impactContactGlow * 0.38;
        color += uSecondaryColor * puddleCaustic * (0.12 + impactContactGlow * 0.16);
        color += mix(uPrimaryColor, uSecondaryColor, puddleCaustic) * puddleMask * 0.2;
        color += uSecondaryColor * puddleFresnel * 0.42;
        color += uSecondaryColor * puddleSpecularArc * (0.2 + puddleFresnel * 0.28);
        color += mix(uPrimaryColor, uSecondaryColor, 0.46) * puddleRefraction * puddleMask * 0.14;
        ${puddlePaletteLockShader}
        vec3 mistVolumeColor = mix(uPrimaryColor * 0.62, uSecondaryColor * 0.78, 0.46 + crownSpecular * 0.24);
        float mistVolumeMass = mistMask * (0.62 + waterTransmission * 0.28);
        color = mix(color, mistVolumeColor, mistVolumeMass);
        float peakImpactValueSeparation = waterSheetMask * (0.34 + crownSpecular * 0.44 + impactContactGlow * 0.22);
        float rippleVisibilityBoost = rippleMask * (0.32 + rippleDistortion * 0.24);
        color += uSecondaryColor * peakImpactValueSeparation;
        color += mix(uPrimaryColor, uSecondaryColor, 0.7) * rippleVisibilityBoost;
        ${finalMudPaletteLockShader}
        float formAlpha = vRainForm > 3.5 ? 0.34 : vRainForm > 2.5 ? 0.96 : vRainForm > 1.5 ? 0.94 : vRainForm < 0.5 ? 0.9 : 0.88;
        float alpha = uOpacity * vRainVisibility * formAlpha * mix(1.0, rippleDistortion, rippleMask) * mix(0.88, 1.08, uDensity) * mix(0.92, 1.04, uEdgeHardness);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.96));
      }
    `,
  })
  material.userData['pfxRainBurstMaterial'] = true
  material.userData['pfxRainBurstMaterialRole'] = 'water'
  material.userData['pfxRainBurstControlBinding'] = 'primary-secondary-density-style'
  material.userData['pfxRainBurstMaterialProfile'] = 'translucent-depth-cued-water-crown-and-puddle'
  return material
}
