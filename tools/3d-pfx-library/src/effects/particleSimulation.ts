import * as THREE from 'three'
import {
  PFX_MATERIALIZE_GATHER_TARGET_HEIGHT_FLOOR,
  PFX_MATERIALIZE_GATHER_TARGET_HEIGHT_RANGE,
  getPfxParticleMotionKind,
  hashPfxSurfaceKey,
  parsePfxHexColor,
  samplePfxMeshEmitter,
  seededRandom,
} from '../constants/04'
import { getPfxSurfaceColorIndex } from './surfaceColorIndex'
import type { PfxPreset } from '../types/01'
import type { PfxParticleSimulation, PfxRenderSurface } from '../types/02'

// Keep enough particles on the gameplay-authoritative perimeter for an
// unbroken first-frame warning, while reserving a sparse cohort for inward
// particle currents. The support accents add spawn-specific radial direction
// without becoming a second bright center or a mesh proxy.
export const PFX_TELEGRAPH_BOUNDARY_OUTER_FRACTION = 0.92
export const PFX_MATERIALIZE_GATHER_COHORT_FRACTION = 0.18
export const PFX_MATERIALIZE_RELEASE_CONTACT_FRACTION = 0.64
export const PFX_MATERIALIZE_RELEASE_GROUND_FRACTION = 0.69
export const PFX_MATERIALIZE_GROUND_STREAM_LANES = 6
export const PFX_MATERIALIZE_GATHER_FLOW_LANES = 16
export const PFX_MATERIALIZE_GATHER_SOURCE_RADIUS_MIN = 0.54
export const PFX_MATERIALIZE_GATHER_SOURCE_RADIUS_MAX = 0.9

export function createPfxParticleSimulation(
  preset: Pick<PfxPreset, 'effectId' | 'controls' | 'implementationProfile' | 'reducedMotion'>,
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase' | 'tuning'>,
): PfxParticleSimulation {
  const controls = preset.controls
  const tuning = surface.tuning
  const lodMultiplier = controls.lod.includes('high') ? 1 : controls.lod.includes('medium') ? 0.72 : 0.45
  const reducedMotionCountScale = preset.reducedMotion
    ? tuning?.reducedMotionCountScale ?? 1
    : 1
  const count = Math.max(2, Math.floor(
    64 * controls.density * lodMultiplier * (tuning?.countScale ?? 1) * reducedMotionCountScale,
  ))
  const motionKind = getPfxParticleMotionKind(surface, preset)
  const rand = seededRandom((controls.seed || 1) * 31 + hashPfxSurfaceKey(surface))
  const scale = controls.scale
  const speedScale = tuning?.speedScale ?? 1

  const spawn = new Float32Array(count * 3)
  const direction = new Float32Array(count * 3)
  const speed = new Float32Array(count)
  const lifeOffset = new Float32Array(count)
  const wobblePhase = new Float32Array(count)
  const wobbleFrequency = new Float32Array(count)
  const orbitRadius = new Float32Array(count)
  const orbitAngle = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const index = i * 3
    // Golden-angle stratification: burst clocks keep only a consecutive slice
    // of indices alive at once, so pure-random angles can leave whole
    // hemispheres empty per burst. Golden-angle spacing makes ANY consecutive
    // subset near-uniform around the circle.
    const angle = tuning?.randomizeAzimuth
      ? rand() * Math.PI * 2
      : (i * 2.3999632297286533 + rand() * 0.9) % (Math.PI * 2)
    const baseSpeed = (0.55 + rand() * 0.9) * Math.max(0.15, controls.velocity) * 0.5 * scale * speedScale
    lifeOffset[i] = i / count
    wobblePhase[i] = rand() * Math.PI * 2
    wobbleFrequency[i] = 1.2 + rand() * 2.4
    speed[i] = baseSpeed
    orbitAngle[i] = angle
    // spawnScale reaches orbit radii too — shield-surface arcs must ride the
    // shell rim, not orbit outside it.
    orbitRadius[i] = (0.62 + rand() * 0.34) * scale * (tuning?.spawnScale ?? 1)

    switch (motionKind) {
      case 'cone-fountain': {
        const spread = 0.32 + rand() * 0.3
        spawn[index] = (rand() - 0.5) * 0.12 * scale
        spawn[index + 1] = 0
        spawn[index + 2] = (rand() - 0.5) * 0.12 * scale
        direction[index] = Math.cos(angle) * spread
        direction[index + 1] = 1
        direction[index + 2] = Math.sin(angle) * spread * 0.4
        break
      }
      case 'column-rise': {
        const depthScale = tuning?.depthScale ?? 1
        const chargePlume = surface.phase === 'flame-charge-rear-plume'
        const chargeCrown = surface.phase === 'flame-charge-lick-crown'
        const fireballVolume = chargePlume && tuning?.flipbookAtlas === 'unity-fireball-64'
        const chargeFireLayer = chargePlume || chargeCrown
        const chargeSpread = chargeFireLayer ? tuning?.spawnScale ?? 1 : 1
        spawn[index] = (rand() - 0.5) * (chargeCrown ? 0.2 * chargeSpread : chargePlume ? 0.26 * chargeSpread : 0.2) * scale
        spawn[index + 1] = (chargeCrown ? 0.12 + rand() * 0.2 : fireballVolume ? -0.05 + rand() * 0.1 : chargePlume ? -0.12 + rand() * 0.26 : -0.35 + rand() * 0.55) * scale
        spawn[index + 2] = (rand() - 0.5)
          * (chargeCrown ? 0.2 * Math.sqrt(depthScale) * chargeSpread : chargePlume ? 0.25 * Math.sqrt(depthScale) * chargeSpread : 0.2 * depthScale)
          * scale
        // Lateral jitter: perfectly parallel up-vectors turned rising motes
        // into a single-file conveyor.
        direction[index] = (rand() - 0.5) * (chargeFireLayer ? 0.15 : 0.4)
        direction[index + 1] = 1
        direction[index + 2] = (rand() - 0.5) * (chargeFireLayer ? 0.12 : 0.25) * Math.sqrt(depthScale)
        speed[i] = baseSpeed * 1.35
        break
      }
      case 'jump-launch': {
        const radius = (0.16 + rand() * 0.18) * scale
        const depthScale = tuning?.depthScale ?? 1
        spawn[index] = Math.cos(angle) * radius
        spawn[index + 1] = (0.01 + rand() * 0.28) * scale
        spawn[index + 2] = Math.sin(angle) * radius * Math.min(1.35, Math.sqrt(depthScale))
        direction[index] = Math.cos(angle) * (0.36 + rand() * 0.18)
        direction[index + 1] = 0.88 + rand() * 0.24
        direction[index + 2] = Math.sin(angle) * (0.36 + rand() * 0.18) * Math.min(1.3, Math.sqrt(depthScale))
        speed[i] = baseSpeed * (1.45 + rand() * 0.35)
        break
      }
      case 'trail-stream': {
        const streamSpread = tuning?.streamSpread ?? 1
        const depthScale = tuning?.depthScale ?? 1
        const streamOffset = tuning?.spawnOffset ?? [0, 0, 0]
        // spawnScale (default 0 here) spreads births back along the travel
        // axis so the stream covers the BODY, not just one emission point —
        // fire licks must burn on the head before they shed into the wake.
        const bodySpan = tuning?.spawnScale ?? 0
        spawn[index] = (0.1 + streamOffset[0] - rand() * bodySpan) * scale
        spawn[index + 1] = ((rand() - 0.5) * 0.16 + streamOffset[1]) * scale
        spawn[index + 2] = ((rand() - 0.5) * 0.1 * depthScale + streamOffset[2]) * scale
        direction[index] = -1
        direction[index + 1] = (rand() - 0.5) * 0.5 * streamSpread
        direction[index + 2] = (rand() - 0.5) * 0.3 * streamSpread * depthScale
        speed[i] = baseSpeed * (1 + controls.trailLength * 0.7) * (1 - (tuning?.speedJitter ?? 0) * rand())
        break
      }
      case 'beam-telegraph-flow': {
        const progress = (i + 0.5) / count
        const laneSpread = Math.max(1, tuning?.spawnScale ?? 1)
        const halfWidth = (0.1 + progress * 0.34) * laneSpread
        spawn[index] = (-2.4 + progress * 5.0) * scale
        spawn[index + 1] = (0.05 + rand() * 0.08) * scale
        spawn[index + 2] = (rand() - 0.5) * halfWidth * scale
        direction[index] = -1
        direction[index + 1] = 0
        direction[index + 2] = 0
        speed[i] = baseSpeed * 0.18
        break
      }
      case 'laser-spray-ricochet': {
        const endpoints = [
          [1.78, 0.5, -0.54],
          [1.58, 0.25, 0.66],
          [1.86, 0, 0.16],
          [1.64, -0.25, -0.68],
          [1.74, -0.5, 0.56],
        ] as const
        const endpoint = endpoints[i % endpoints.length]!
        spawn[index] = (endpoint[0] + (rand() - 0.5) * 0.06) * scale
        spawn[index + 1] = (endpoint[1] + (rand() - 0.5) * 0.06) * scale
        spawn[index + 2] = (endpoint[2] + (rand() - 0.5) * 0.08) * scale
        const side = i % 2 === 0 ? 1 : -1
        direction[index] = 0.32 + rand() * 0.18
        direction[index + 1] = 0.72 + rand() * 0.28
        direction[index + 2] = side * (0.18 + rand() * 0.28)
        speed[i] = baseSpeed * (0.48 + rand() * 0.22)
        break
      }
      case 'screen-fall': {
        spawn[index] = (rand() - 0.5) * 1.7 * scale
        spawn[index + 1] = 0.6 * scale + rand() * 0.5 * scale
        spawn[index + 2] = (rand() - 0.5) * 0.1
        direction[index] = (rand() - 0.5) * 0.3
        direction[index + 1] = -1
        direction[index + 2] = 0
        break
      }
      case 'danger-pulse': {
        // Screen flecks are authored directly on the rectangular clip-space
        // perimeter. A radial world-space ring pulled the wide viewport's
        // flecks into the gameplay interior and left its corners empty.
        const side = i % 4
        const slot = Math.floor(i / 4)
        const slotsOnSide = Math.ceil((count - side) / 4)
        const edge = 0.88 + rand() * 0.1
        // Stratified slots give every edge a designed rhythm; a small jitter
        // keeps it organic without creating long accidental empty runs.
        const along = -0.78 + ((slot + 0.5) / slotsOnSide) * 1.56 + (rand() - 0.5) * 0.12
        spawn[index] = side === 0 ? -edge : side === 1 ? edge : along
        spawn[index + 1] = side === 2 ? -edge : side === 3 ? edge : along
        spawn[index + 2] = 0
        direction[index] = side < 2 ? -spawn[index] * 0.16 : 0
        direction[index + 1] = side === 2 ? 0 : -1
        direction[index + 2] = 0
        speed[i] = baseSpeed * 0.026
        break
      }
      case 'drift-cloud': {
        const depthScale = tuning?.depthScale ?? 1
        const phi = Math.acos(2 * rand() - 1)
        const radius = Math.pow(rand(), 0.5) * 0.5 * scale
        spawn[index] = Math.sin(phi) * Math.cos(angle) * radius * 1.4
        spawn[index + 1] = Math.sin(phi) * Math.sin(angle) * radius * 0.7
        spawn[index + 2] = Math.cos(phi) * radius * 0.5 * depthScale
        direction[index] = (rand() - 0.5) * 0.6
        direction[index + 1] = 0.2 + rand() * 0.4
        direction[index + 2] = (rand() - 0.5) * 0.25 * depthScale
        speed[i] = baseSpeed * 0.35
        break
      }
      case 'dust-loop': {
        const depthScale = tuning?.depthScale ?? 1
        const bodySpan = tuning?.spawnScale ?? 1
        // A low-discrepancy tapered ribbon keeps every index cohort spread
        // through the same volume. The former five fixed S-curve lanes were
        // visible as emitter rows in gameplay captures even at 89 particles.
        const rawProgress = ((i + 0.5) * 0.61803398875 + rand() * 0.035) % 1
        // Compress only the leading cap so low-count secondary layers cannot
        // strand one smoke cell beyond the wake. The long tail remains
        // uniformly stratified; the cap gains enough overlap to stay joined.
        const goldenProgress = rawProgress > 0.86 ? 0.86 + (rawProgress - 0.86) * 0.7 : rawProgress
        const crossAngle = i * 2.399963229728653 + rand() * 0.42
        const crossRadius = Math.sqrt(((i + 1) * 0.754877666 + rand() * 0.08) % 1)
        const ribbonEnvelope = 0.08 + Math.pow(goldenProgress, 1.08) * 0.92
        const crossSection = crossRadius * ribbonEnvelope
        const depthSpan = depthScale / 2.4
        spawn[index] = (-0.84 + goldenProgress * 1.68 + (rand() - 0.5) * 0.03) * bodySpan * scale
        const ridge = Math.pow(goldenProgress, 1.25) * 0.12
        spawn[index + 1] = (
          0.02 + ridge + Math.abs(Math.sin(crossAngle)) * crossSection * 0.075 + rand() * 0.01
        ) * scale
        spawn[index + 2] = (
          Math.sin(goldenProgress * Math.PI * 1.4 - 0.3) * 0.08
          + Math.cos(crossAngle) * crossSection * 0.31
        ) * depthSpan * scale
        direction[index] = 0.72 + rand() * 0.14
        direction[index + 1] = 0.012 + rand() * 0.045
        direction[index + 2] = Math.sin(goldenProgress * Math.PI * 2 + crossAngle) * 0.035
        speed[i] = baseSpeed * (0.24 + rand() * 0.13)
        break
      }
      case 'snow-gust': {
        const depthScale = tuning?.depthScale ?? 1
        const bodySpan = tuning?.spawnScale ?? 1
        // A squall occupies a moving field, not one projectile emission
        // point: births are stratified along the wind axis and through depth.
        spawn[index] = (0.85 - rand() * 1.9 * bodySpan) * scale
        // Births fill a floor-to-waist band. Keeping the bottom near zero
        // lets the authored positionOffset anchor the squall to terrain,
        // while the positive height range prevents a flat ground scratch.
        spawn[index + 1] = (0.02 + rand() * 0.75) * scale
        spawn[index + 2] = (rand() - 0.5) * 0.72 * depthScale * scale
        direction[index] = -1
        direction[index + 1] = (rand() - 0.5) * 0.06
        direction[index + 2] = (rand() - 0.5) * 0.16 * Math.sqrt(depthScale)
        speed[i] = baseSpeed * (0.7 + rand() * 0.6)
        break
      }
      case 'impact-burst': {
        spawn[index] = 0
        spawn[index + 1] = 0
        spawn[index + 2] = 0
        const upBias = 0.25 + rand() * 0.65
        // Screen-plane radial: the browser/game camera is frontal (+Z), so a
        // world X/Z dome hides half its energy in depth and the constant +Y
        // bias renders near-parallel diagonal streaks (rounds 8-10). Full
        // circle in X/Y with slight lift + depth jitter reads 360-radial.
        direction[index] = Math.cos(angle)
        direction[index + 1] = Math.sin(angle) * 0.9 + upBias * 0.35
        direction[index + 2] = (rand() - 0.5) * 0.5
        speed[i] = baseSpeed * 1.9
        break
      }
      case 'meteor-impact': {
        const incomingCount = Math.max(2, Math.floor(count * 0.28))
        if (i < incomingCount) {
          const progress = i / Math.max(1, incomingCount - 1)
          spawn[index] = (-0.92 + progress * 0.58) * scale
          spawn[index + 1] = (1.18 - progress * 0.58) * scale
          spawn[index + 2] = (-0.22 + progress * 0.2 + (rand() - 0.5) * 0.08) * scale
          direction[index] = 0.58
          direction[index + 1] = -0.8
          direction[index + 2] = 0.16
          lifeOffset[i] = progress * 0.18
          speed[i] = baseSpeed * 1.05
        } else {
          const ejectaProgress = (i - incomingCount) / Math.max(1, count - incomingCount)
          const ejectaAngle = ejectaProgress * Math.PI * 2 + (rand() - 0.5) * 0.18
          spawn[index] = (rand() - 0.5) * 0.12 * scale
          spawn[index + 1] = 0.04 * scale
          spawn[index + 2] = (rand() - 0.5) * 0.12 * scale
          direction[index] = Math.cos(ejectaAngle) * (0.72 + rand() * 0.22)
          direction[index + 1] = 0.28 + rand() * 0.72
          direction[index + 2] = Math.sin(ejectaAngle) * (0.72 + rand() * 0.22)
          lifeOffset[i] = ejectaProgress * 0.34
          speed[i] = baseSpeed * (1.25 + rand() * 0.3)
        }
        break
      }
      case 'shockwave-ground-burst': {
        const radialAngle = angle + (rand() - 0.5) * 0.12
        const radius = (0.12 + rand() * 0.12) * scale
        spawn[index] = Math.cos(radialAngle) * radius
        spawn[index + 1] = (0.025 + rand() * 0.035) * scale
        spawn[index + 2] = Math.sin(radialAngle) * radius
        const radialStrength = 0.92 + rand() * 0.08
        direction[index] = Math.cos(radialAngle) * radialStrength
        // Give the otherwise ground-hugging front a sparse upward ejecta
        // volume. The ring owns horizontal displacement; these fragments
        // provide parallax and a readable ballistic secondary arc.
        direction[index + 1] = 0.22 + rand() * 0.34
        direction[index + 2] = Math.sin(radialAngle) * radialStrength
        speed[i] = baseSpeed * (0.9 + rand() * 0.5)
        break
      }
      case 'ground-scuff': {
        spawn[index] = (rand() - 0.5) * 0.18 * scale
        spawn[index + 1] = (rand() - 0.5) * 0.035 * scale
        spawn[index + 2] = (rand() - 0.5) * 0.24 * scale
        direction[index] = -(0.78 + rand() * 0.22)
        direction[index + 1] = 0.08 + rand() * 0.16
        direction[index + 2] = (rand() - 0.5) * 0.55
        speed[i] = baseSpeed * (0.75 + rand() * 0.55)
        break
      }
      case 'converge-center': {
        const radius = (0.68 + rand() * 0.24) * scale
        const screenSpace = surface.role === 'screen'
        spawn[index] = Math.cos(angle) * radius
        spawn[index + 1] = screenSpace ? Math.sin(angle) * radius : (rand() - 0.5) * 0.04 * scale
        spawn[index + 2] = screenSpace ? 0 : Math.sin(angle) * radius
        direction[index] = -Math.cos(angle)
        direction[index + 1] = screenSpace ? -Math.sin(angle) : 0.02 + rand() * 0.08
        direction[index + 2] = screenSpace ? 0 : -Math.sin(angle)
        speed[i] = radius * (0.48 + rand() * 0.18)
        break
      }
      case 'materialize-gather': {
        // A player-height cylindrical reservoir converges from inside the
        // telegraph boundary into the resolved arrival silhouette. Sixteen
        // azimuth lanes preserve a spatial, particle-authored onset without
        // exposing repeated columns. An independent low-discrepancy height
        // sequence prevents head and shoulder bands from clustering on one
        // azimuth/camera side.
        orbitRadius[i] =
          ((i + 0.5) * 0.7320508075688772) % 1
        const depth = Math.min(1.5, Math.sqrt(tuning?.depthScale ?? 1))
        const footprintScale = tuning?.spawnScale ?? 1
        const radialProgress = ((i * 0.6180339887498948 + 0.17) % 1)
        const heightProgress = ((i * 0.7548776662466927 + 0.09) % 1)
        const gatherLane = i % PFX_MATERIALIZE_GATHER_FLOW_LANES
        const gatherLaneIndex = Math.floor(
          i / PFX_MATERIALIZE_GATHER_FLOW_LANES,
        )
        const gatherLaneCount = Math.ceil(
          count / PFX_MATERIALIZE_GATHER_FLOW_LANES,
        )
        const gatherLaneProgress =
          (gatherLaneIndex + 0.5) / gatherLaneCount
        const gatherAngle =
          gatherLane / PFX_MATERIALIZE_GATHER_FLOW_LANES * Math.PI * 2 +
          (gatherLaneProgress - 0.5) * 0.22 +
          Math.sin((gatherLaneIndex + 1) * 2.399963229728653) * 0.035
        const gatherRadius =
          (
            PFX_MATERIALIZE_GATHER_SOURCE_RADIUS_MIN +
            Math.sqrt(radialProgress) *
              (
                PFX_MATERIALIZE_GATHER_SOURCE_RADIUS_MAX -
                PFX_MATERIALIZE_GATHER_SOURCE_RADIUS_MIN
              )
          ) * scale * footprintScale
        const x = Math.cos(gatherAngle) * gatherRadius
        const z = Math.sin(gatherAngle) * gatherRadius * depth
        const sourceHeight =
          0.16 +
          heightProgress * 1.7 +
          (rand() - 0.5) * 0.014
        const y = sourceHeight * scale
        spawn[index] = x
        spawn[index + 1] = y
        spawn[index + 2] = z
        const inward = preset.reducedMotion ? 0.58 : 0.76
        const tangent = preset.reducedMotion ? 0.08 : 0.14
        const horizontalLength = Math.max(0.001, Math.hypot(x, z))
        const radialX = x / horizontalLength
        const radialZ = z / horizontalLength
        const tangentX = -radialZ
        const tangentZ = radialX
        const targetHeight =
          PFX_MATERIALIZE_GATHER_TARGET_HEIGHT_FLOOR +
          Math.pow(orbitRadius[i]!, 1.1) *
            PFX_MATERIALIZE_GATHER_TARGET_HEIGHT_RANGE
        const directionX =
          -radialX * inward +
          tangentX * tangent
        const directionY = THREE.MathUtils.clamp(
          (targetHeight - sourceHeight) * 0.5,
          -0.68,
          0.68,
        )
        const directionZ =
          -radialZ * inward +
          tangentZ * tangent
        const inverseDirectionLength = 1 / Math.hypot(
          directionX,
          directionY,
          directionZ,
        )
        direction[index] = directionX * inverseDirectionLength
        direction[index + 1] = directionY * inverseDirectionLength
        direction[index + 2] = directionZ * inverseDirectionLength
        speed[i] =
          (0.68 + radialProgress * 0.16 + rand() * 0.06) *
          scale *
          speedScale
        break
      }
      case 'materialize-release': {
        // One emitter carries two temporally separate traditional-particle
        // cohorts: early head-tailed lanes travel inward, then later particles
        // launch outward from the compressed reservoir. A single symmetric
        // radial field made onset and decay indistinguishable in stills.
        const depth = Math.min(1.5, Math.sqrt(tuning?.depthScale ?? 1))
        const gatherCount = Math.floor(
          count * PFX_MATERIALIZE_GATHER_COHORT_FRACTION,
        )
        const groundCount = Math.floor(
          count * PFX_MATERIALIZE_RELEASE_GROUND_FRACTION,
        )
        const groundReleaseCount = Math.max(0, groundCount - gatherCount)
        const contactReleaseCount = Math.floor(
          groundReleaseCount * PFX_MATERIALIZE_RELEASE_CONTACT_FRACTION,
        )
        const contactEnd = gatherCount + contactReleaseCount
        const isGather = i < gatherCount
        const isGroundRelease = i >= gatherCount && i < groundCount
        const isContactRelease = i >= gatherCount && i < contactEnd
        const isRisingRelease = i >= contactEnd && i < groundCount
        const isElevatedRelease = i >= groundCount
        const gatherProgress = (i + 0.5) / Math.max(1, gatherCount)
        const gatherLane = i % PFX_MATERIALIZE_GROUND_STREAM_LANES
        const gatherLaneCurve =
          (1 - gatherProgress) * 0.58
        const gatherAngle =
          gatherLane / PFX_MATERIALIZE_GROUND_STREAM_LANES * Math.PI * 2 +
          Math.sin((gatherLane + 1) * 2.399963229728653) * 0.08 +
          gatherLaneCurve
        const releaseIndex = Math.max(0, i - gatherCount)
        const releaseBirthPhase =
          ((i + 0.5) * 0.61803398875 % 1)
        const releaseAngle =
          releaseIndex * 2.399963229728653 +
          Math.sin((releaseIndex + 1) * 1.61803398875) * 0.14
        const radialProgress =
          ((releaseIndex * 0.41421356237309503 + 0.31) % 1)
        const heightProgress = ((i * 0.7548776662466927 + 0.13) % 1)
        const releaseFootprintScale = tuning?.spawnScale ?? 1
        const radius = isGather
          ? (
            0.2 + Math.sqrt(gatherProgress) * 0.4
          ) * scale * releaseFootprintScale
          : isGroundRelease
            ? (
              isContactRelease
                ? 0.035 + Math.pow(radialProgress, 1.8) * 0.285
                : 0.13 + Math.sqrt(radialProgress) * 0.19
            ) * scale * releaseFootprintScale
          : (
            // Late fragments stay inside the peak footprint. They provide a
            // short exhaust handoff without overtaking the broad contact as
            // the largest silhouette in the lifecycle.
            0.05 + Math.sqrt(radialProgress) * 0.08
          ) * scale * releaseFootprintScale
        const radialDirection = isGather
          ? -0.38
          : isContactRelease
            ? 0.05 + radialProgress * 0.04
            : isRisingRelease
              ? 0.28 + radialProgress * 0.22
            : 0.34 + radialProgress * 0.12
        const tangentDirection = isGather
          ? 0.28 + radialProgress * 0.08
          : (0.025 + radialProgress * 0.035) *
            (i % 2 === 0 ? 1 : -1)
        const particleAngle = isGather ? gatherAngle : releaseAngle
        spawn[index] = Math.cos(particleAngle) * radius
        spawn[index + 1] = isGather
          ? (
              0.02 +
              Math.pow(heightProgress, 1.25) * 1.7
            ) * scale
          : isContactRelease
            ? (0.025 + heightProgress * 0.08) * scale
          : isRisingRelease
            ? (0.04 + heightProgress * 0.1) * scale
          : (
            0.08 +
            heightProgress * 0.31 +
            (rand() - 0.5) * 0.012
          ) * scale
        spawn[index + 2] = Math.sin(particleAngle) * radius * depth
        direction[index] =
          Math.cos(particleAngle) * radialDirection -
          Math.sin(particleAngle) * tangentDirection
        direction[index + 1] = isGather
          ? 0.76
          : isContactRelease
            ? 0.03
          : isRisingRelease
            ? 0.14 + heightProgress * 0.18
          : isElevatedRelease
            ? 0.44 + heightProgress * 0.18
            : 0.08
        direction[index + 2] =
          (Math.sin(particleAngle) * radialDirection +
            Math.cos(particleAngle) * tangentDirection) / depth
        speed[i] = isGroundRelease
          ? Math.max(0.15, controls.velocity) *
            0.5 *
            scale *
            speedScale *
            (isContactRelease ? 0.55 : 2.5) *
            (isContactRelease
              ? 0.82 + releaseBirthPhase * 0.3
              : 0.78 + releaseBirthPhase * 0.35) *
            (isRisingRelease ? 0.78 + heightProgress * 0.25 : 1)
          : baseSpeed *
            (0.62 + (1 - radialProgress) * 0.18 + rand() * 0.12) *
            (isGather ? 0.42 : isElevatedRelease ? 0.82 : 1.05)
        if (preset.reducedMotion) {
          if (!isGather) {
            // Reduced motion preserves the peak's broad layered confirmation
            // as a static particle burst. Three radial bands retain the same
            // gameplay footprint and hot-center hierarchy without simulating
            // the standard launch.
            const reducedContactRadius =
              (
                isContactRelease
                  ? 0.035 + Math.pow(radialProgress, 1.8) * 0.285
                  : isGroundRelease
                    ? 0.32 + radialProgress * 0.22
                    : 0.38 + radialProgress * 0.22
              ) * scale
            spawn[index] = Math.cos(particleAngle) * reducedContactRadius
            spawn[index + 1] = 0.04 * scale
            spawn[index + 2] =
              Math.sin(particleAngle) * reducedContactRadius * depth
            direction[index] = Math.cos(particleAngle)
            direction[index + 1] = 0.08
            direction[index + 2] = Math.sin(particleAngle) / depth
            speed[i] = Math.min(0.35, speed[i]! * 0.1)
          } else {
            spawn[index] = spawn[index]! * 0.18
            spawn[index + 1] = Math.min(spawn[index + 1]!, 0.12 * scale)
            spawn[index + 2] = spawn[index + 2]! * 0.18
            direction[index] = 0
            direction[index + 1] = isGather ? -1 : 1
            direction[index + 2] = 0
          }
        }
        break
      }
      case 'spherical-converge': {
        // Three braided feeder lanes make the inward motion readable in a
        // still frame and break the generic symmetric starburst silhouette.
        const lane = i % 3
        const laneSteps = Math.ceil(count / 3)
        const progress = (Math.floor(i / 3) + 0.5) / laneSteps
        const laneAngle = lane / 3 * Math.PI * 2 + progress * Math.PI * 1.35
        const radius = (0.38 + progress * 0.42) * scale * (tuning?.spawnScale ?? 1)
        const depth = Math.min(1.18, Math.sqrt(tuning?.depthScale ?? 1))
        const x = Math.cos(laneAngle) * radius
        const y = (progress - 0.5) * 0.9 * scale
        const z = Math.sin(laneAngle) * radius * depth
        spawn[index] = x
        spawn[index + 1] = y
        spawn[index + 2] = z
        const inverseLength = 1 / Math.max(0.001, Math.hypot(x, y, z))
        direction[index] = -x * inverseLength
        direction[index + 1] = -y * inverseLength
        direction[index + 2] = -z * inverseLength
        speed[i] = radius * (0.62 + rand() * 0.16) * speedScale
        break
      }
      case 'braided-converge': {
        const chargeInflow = surface.phase === 'flame-charge-gather-inflow'
        const lane = i % 3
        const laneSteps = Math.ceil(count / 3)
        const progress = (Math.floor(i / 3) + 0.5) / laneSteps
        const depth = Math.min(1.18, Math.sqrt(tuning?.depthScale ?? 1))
        const laneAngle = lane / 3 * Math.PI * 2 + progress * Math.PI * (chargeInflow ? 1.15 : 0.9)
        const radius = chargeInflow
          ? (0.34 + progress * 0.44) * scale * (tuning?.spawnScale ?? 1)
          : (0.28 + progress * 0.28) * scale * (tuning?.spawnScale ?? 1)
        const x = Math.cos(laneAngle) * radius
        const y = chargeInflow
          ? (-0.28 + progress * 0.72 + (lane - 1) * 0.05) * scale
          : (-0.18 + progress * 0.62) * scale
        const z = Math.sin(laneAngle) * radius * depth
        spawn[index] = x
        spawn[index + 1] = y
        spawn[index + 2] = z
        const targetY = chargeInflow ? 0.02 * scale : -0.04 * scale
        const inverseLength = 1 / Math.max(0.001, Math.hypot(x, y - targetY, z))
        direction[index] = -x * inverseLength
        direction[index + 1] = (targetY - y) * inverseLength
        direction[index + 2] = -z * inverseLength
        speed[i] = (0.44 + progress * 0.3) * scale * speedScale
        break
      }
      case 'phase-transfer-column': {
        // Opposed particle streams compress into a narrow destination plane.
        // The hourglass silhouette and counter-rotating travel make this a
        // transfer event rather than another upward spawn plume, while real
        // depth preserves the read from every review camera without a mesh.
        const laneCount = 7
        const lane = i % laneCount
        const progress = (i + 0.5) / count
        const distanceFromLock = Math.abs(progress * 2 - 1)
        const lowerStream = progress < 0.5
        const depth = Math.min(1.35, Math.sqrt(tuning?.depthScale ?? 1))
        const footprintScale = tuning?.spawnScale ?? 1
        const angle =
          lane / laneCount * Math.PI * 2 +
          progress * Math.PI * 1.45 +
          Math.sin((i + 1) * 2.399963229728653) * 0.045
        const radius = THREE.MathUtils.lerp(
          0.065,
          0.6,
          Math.pow(distanceFromLock, 0.72),
        ) * scale * footprintScale
        const radialX = Math.cos(angle)
        const radialZ = Math.sin(angle)
        spawn[index] = radialX * radius
        spawn[index + 1] = (-0.16 + progress * 1.44) * scale
        spawn[index + 2] = radialZ * radius * depth
        const twist = lowerStream ? 0.27 : -0.27
        direction[index] = -radialX * 0.7 - Math.sin(angle) * twist
        direction[index + 1] = lowerStream ? 0.82 : -0.82
        direction[index + 2] =
          (-radialZ * 0.7 + Math.cos(angle) * twist) * depth
        speed[i] =
          (0.38 + distanceFromLock * 0.24) * scale * speedScale
        break
      }
      case 'asymmetric-converge': {
        // Four deliberately unequal fuel lanes occupy real world-space depth.
        // Uneven phases, sweeps, heights, and radii avoid the screen-facing
        // wreath produced by a uniform radial gather while preserving a clear
        // outer-to-core travel vector for every mote.
        const lane = i % 4
        const laneSteps = Math.ceil(count / 4)
        const progress = (Math.floor(i / 4) + 0.5) / laneSteps
        const lanePhases = [-2.78, -1.04, 0.42, 2.12]
        const laneSweeps = [1.08, -0.72, 0.58, -0.94]
        const laneRadii = [1, 0.78, 0.68, 0.9]
        const laneHeights = [-0.42, 0.46, 0.08, 0.62]
        const laneLifts = [0.16, -0.12, 0.2, -0.18]
        const depth = Math.min(1.28, Math.sqrt(tuning?.depthScale ?? 1))
        const radius = THREE.MathUtils.lerp(laneRadii[lane]! * 0.82, 0.18, progress)
          * scale * (tuning?.spawnScale ?? 1)
        const laneAngle = lanePhases[lane]! + progress * laneSweeps[lane]!
        const x = Math.cos(laneAngle) * radius + 0.04 * scale
        const y = THREE.MathUtils.lerp(laneHeights[lane]!, -0.03, progress) * scale
          + Math.sin(progress * Math.PI) * laneLifts[lane]! * scale
        const z = Math.sin(laneAngle) * radius * depth
        spawn[index] = x
        spawn[index + 1] = y
        spawn[index + 2] = z
        const inverseLength = 1 / Math.max(0.001, Math.hypot(x, y + 0.03 * scale, z))
        direction[index] = -x * inverseLength
        direction[index + 1] = (-0.03 * scale - y) * inverseLength
        direction[index + 2] = -z * inverseLength
        speed[i] = (0.46 + progress * 0.26) * scale * speedScale
        break
      }
      case 'warp-vortex': {
        // Five-arm single-chirality inward spiral funnel. An odd arm count
        // cannot mirror-pair, shared turn geometry keeps the arms legible,
        // and per-particle radius/height jitter prevents card stamping.
        // The funnel narrows to the destination lock at ground level so the
        // vortex visibly roots into the telegraph footprint. The wall rises
        // to a full column so the volume reads as a warp funnel rather than
        // a shallow disc, and the arm envelope stays tight enough that each
        // spiral stream survives as an authored band instead of noise.
        const depth = Math.min(1.28, Math.sqrt(tuning?.depthScale ?? 1))
        const arm = i % 5
        const turns = 1.55
        const startHeight = 0.42 + rand() * 0.78
        const startRadius = (0.52 + rand() * 0.42) * scale * (tuning?.spawnScale ?? 1)
        const progress = rand()
        const radius = THREE.MathUtils.lerp(startRadius, 0.05 * scale, Math.pow(progress, 0.85))
        const y = THREE.MathUtils.lerp(startHeight, -0.14, progress) * scale
        const armAngle = (arm / 5) * Math.PI * 2 + (rand() - 0.5) * 0.09
        const spiralAngle = armAngle + progress * Math.PI * 2 * turns
        const radialX = Math.cos(spiralAngle)
        const radialZ = Math.sin(spiralAngle)
        spawn[index] = radialX * radius
        spawn[index + 1] = y
        spawn[index + 2] = radialZ * radius * depth
        // Inward pull fades as the funnel tightens: near the lock point the
        // flow is mostly tangential, so the core spins into a lock instead
        // of crossing the center and reading as outward radial spokes.
        const inward = 0.72 * Math.min(1, radius / (0.3 * scale))
        direction[index] = -radialX * inward - radialZ * 0.62
        direction[index + 1] = -0.42
        direction[index + 2] = (-radialZ * inward + radialX * 0.62) * depth
        speed[i] = (0.5 + progress * 0.3) * scale * speedScale
        break
      }
      case 'shadow-claw': {
        // Five unequal finger lanes are sampled as particles. Each lane
        // starts at a shared palm and curls toward its own tip, producing a
        // readable claw fan without a closed hand mesh or a front-only card.
        const finger = i % 5
        const step = Math.floor(i / 5)
        const steps = Math.max(1, Math.ceil(count / 5))
        const progress = steps <= 1 ? 0.5 : step / Math.max(1, steps - 1)
        const bases = [-0.5, -0.25, 0, 0.25, 0.5]
        const lengths = [0.42, 0.62, 0.76, 0.64, 0.44]
        const curls = [0.1, 0.16, 0.2, 0.15, 0.09]
        const base = bases[finger]!
        const x = (base * (1 - progress * 0.22) + Math.sin(progress * Math.PI) * (finger - 2) * 0.018) * scale
        const y = (-0.34 + progress * lengths[finger]! - Math.sin(progress * Math.PI) * curls[finger]!) * scale
        const depth = (finger - 2) * 0.065 * Math.sqrt(tuning?.depthScale ?? 1) * scale
        spawn[index] = x + (rand() - 0.5) * 0.035 * scale
        spawn[index + 1] = y + (rand() - 0.5) * 0.035 * scale
        spawn[index + 2] = depth + (rand() - 0.5) * 0.05 * scale
        direction[index] = -base * 0.28 + (rand() - 0.5) * 0.08
        direction[index + 1] = 0.7 + progress * 0.28
        direction[index + 2] = (finger - 2) * 0.08
        speed[i] = baseSpeed * (0.42 + progress * 0.28)
        break
      }
      case 'healing-spiral': {
        const lane = i % 2
        const step = Math.floor(i / 2)
        const stepsPerLane = Math.ceil(count / 2)
        const strandProgress = step / stepsPerLane
        const helixAngle = strandProgress * Math.PI * 4 + lane * Math.PI
        const radius = 0.46 * scale
        lifeOffset[i] = strandProgress
        orbitAngle[i] = helixAngle
        orbitRadius[i] = radius
        spawn[index] = Math.cos(helixAngle) * radius
        spawn[index + 1] = -0.72 * scale
        spawn[index + 2] = Math.sin(helixAngle) * radius
        direction[index] = -Math.sin(helixAngle) * 0.3
        direction[index + 1] = 1
        direction[index + 2] = Math.cos(helixAngle) * 0.3
        speed[i] = baseSpeed * 0.62
        break
      }
      case 'healing-cross': {
        // A sparse three-axis glyph lattice replaces a solid cross mesh. The
        // first two bars remain legible from the front; the third bar is
        // carried through real Z so a side view still sees volume instead of
        // the same billboard silhouette.
        const bar = i % 3
        const step = Math.floor(i / 3)
        const steps = Math.max(1, Math.ceil(count / 3))
        const progress = steps <= 1 ? 0.5 : step / Math.max(1, steps - 1)
        const signed = progress * 2 - 1
        const thickness = (rand() - 0.5) * 0.065 * scale
        const depth = (rand() - 0.5) * 0.18 * Math.sqrt(tuning?.depthScale ?? 1) * scale
        if (bar === 0) {
          spawn[index] = thickness
          spawn[index + 1] = signed * 0.62 * scale
          spawn[index + 2] = depth
          direction[index] = (rand() - 0.5) * 0.08
          direction[index + 1] = signed * 0.28
          direction[index + 2] = 0
        } else if (bar === 1) {
          spawn[index] = signed * 0.62 * scale
          spawn[index + 1] = thickness
          spawn[index + 2] = depth
          direction[index] = signed * 0.28
          direction[index + 1] = (rand() - 0.5) * 0.08
          direction[index + 2] = 0
        } else {
          spawn[index] = thickness * 0.7
          spawn[index + 1] = thickness * 0.7
          spawn[index + 2] = signed * 0.62 * scale
          direction[index] = (rand() - 0.5) * 0.08
          direction[index + 1] = (rand() - 0.5) * 0.08
          direction[index + 2] = signed * 0.28
        }
        speed[i] = baseSpeed * 0.12
        break
      }
      case 'helix-trail': {
        // Twin fire tendrils: opposite phases on the head's equator,
        // unwinding backward into a helix (review-directed signature —
        // "two trails on opposite sides of the head equator, rotating").
        // aOrbit.x = strand phase, aOrbit.y = wrap radius, speed = reach.
        // UNIFORM speed and near-uniform phase: like duration variance,
        // per-lick speed or angle scatter drops phase-neighbors at random
        // depths and the strand disintegrates into beads. Flame character
        // comes from the sprite + spin, not from strand geometry noise.
        orbitAngle[i] = (i % 2) * Math.PI + (rand() - 0.5) * 0.18
        // Strand roots INSIDE the head's silhouette (head radius ~0.55) so
        // the helix reads as part of the fireball, flaring out as it trails.
        orbitRadius[i] = (0.42 + rand() * 0.05) * scale
        spawn[index] = 0.18 * scale
        spawn[index + 1] = 0
        spawn[index + 2] = 0
        direction[index] = -1
        direction[index + 1] = 0
        direction[index + 2] = 0
        speed[i] = 2.1 * scale * speedScale
        break
      }
      case 'shell-flame': {
        // Review-directed: a sphere-shell emitter matching the head, licks
        // burning IN PLACE across the surface (uniform sphere point pick),
        // drifting slowly outward-up as they die.
        const chargeCoat = surface.phase === 'flame-charge-lick-crown'
        const shellPhi = Math.acos(2 * rand() - 1)
        // Radius jitter: a mathematically perfect shell reads as a rigid
        // skin — licks sit at slightly different depths in the fire coat.
        const shellRadius = 0.52 * scale * (tuning?.spawnScale ?? 1) * (0.9 + rand() * 0.22)
        const sy = chargeCoat ? 0.02 + rand() * 0.7 : Math.sin(shellPhi) * Math.sin(angle)
        const radial = chargeCoat ? Math.sqrt(Math.max(0.08, 1 - sy * sy)) : Math.sin(shellPhi)
        const chargeSweep = chargeCoat ? 0.18 + sy * 0.32 : 0
        const sx = radial * Math.cos(angle) * (chargeCoat ? 0.72 : 1) + chargeSweep
        const sz = chargeCoat ? radial * Math.sin(angle) * 0.88 : Math.cos(shellPhi)
        spawn[index] = sx * shellRadius
        spawn[index + 1] = sy * shellRadius
        spawn[index + 2] = sz * shellRadius
        direction[index] = sx * 0.55
        direction[index + 1] = chargeCoat ? sy * 0.25 + 0.65 : sy * 0.55 + 0.45
        direction[index + 2] = sz * 0.55
        speed[i] = baseSpeed * 0.5
        break
      }
      case 'portal-flow': {
        const radius = (0.52 + rand() * 0.2) * scale
        spawn[index] = Math.cos(angle) * radius
        spawn[index + 1] = Math.sin(angle) * radius
        spawn[index + 2] = (rand() - 0.5) * 0.16 * scale * (tuning?.depthScale ?? 1)
        direction[index] = -Math.cos(angle) * 0.28
        direction[index + 1] = -Math.sin(angle) * 0.28
        direction[index + 2] = -1
        speed[i] = baseSpeed * (0.55 + rand() * 0.3)
        break
      }
      case 'orbit-ring': {
        spawn[index] = Math.cos(angle) * orbitRadius[i]!
        spawn[index + 1] = Math.sin(angle) * orbitRadius[i]!
        spawn[index + 2] = (rand() - 0.5) * 0.14 * scale * (tuning?.depthScale ?? 1)
        direction[index] = 0
        direction[index + 1] = 0
        direction[index + 2] = 0
        break
      }
      case 'ground-ring': {
        // Flat circle in the floor plane — ground rune circles, ward rings.
        spawn[index] = Math.cos(angle) * orbitRadius[i]!
        spawn[index + 1] = (rand() - 0.5) * 0.05 * scale
        spawn[index + 2] = Math.sin(angle) * orbitRadius[i]!
        direction[index] = 0
        direction[index + 1] = 0
        direction[index + 2] = 0
        break
      }
      case 'telegraph-boundary-drift': {
        // This emitter owns only the gameplay-authoritative perimeter.
        // Materialization recipes layer their own inward flow separately;
        // mixing it into the boundary exposed large radial bars and made one
        // surface perform two conflicting visual jobs.
        const outerCount = Math.floor(count * PFX_TELEGRAPH_BOUNDARY_OUTER_FRACTION)
        const isOuter = i < outerCount
        const bandIndex = isOuter ? i : i - outerCount
        const bandCount = isOuter ? outerCount : count - outerCount
        const boundaryCell = Math.PI * 2 / bandCount
        const supportProgress = (bandIndex + 0.5) / bandCount
        const supportRadialUnit =
          ((bandIndex + 0.5) * 0.6180339887498948) % 1
        const boundaryAngle = isOuter
          ? (
              (bandIndex + 0.5) * boundaryCell +
              Math.sin((bandIndex + 1) * 2.399963229728653) *
              0.012 *
              boundaryCell
            )
          : (
              bandIndex * 2.3999632297286533 +
              Math.sin((bandIndex + 1) * 1.61803398875) * 0.09
            )
        const footprintScale = tuning?.spawnScale ?? 1
        const radius =
          (isOuter
            ? 0.78 + Math.sin(boundaryAngle * 6) * 0.008
            : (
                0.24 +
                Math.sqrt(supportRadialUnit) * 0.48
              )) * scale * footprintScale
        spawn[index] = Math.cos(boundaryAngle) * radius
        spawn[index + 1] =
          (
            (isOuter ? 0.018 : 0.032) +
            (isOuter
              ? 0.5 + 0.5 * Math.sin(boundaryAngle * 3 + 0.7)
              : supportProgress) *
              (isOuter ? 0.038 : 0.19)
          ) *
          scale
        spawn[index + 2] = Math.sin(boundaryAngle) * radius
        // A tangent-dominant velocity aligns the streak sprites into short
        // perimeter strokes. The small radial/upward component keeps the
        // telegraph retiring naturally instead of becoming a static hoop.
        const radialDrift = isOuter ? 0 : -0.9
        const orbitalDrift = isOuter
          ? 0.8
          : (bandIndex % 2 === 0 ? 1 : -1) *
            (0.18 + supportRadialUnit * 0.22)
        direction[index] =
          Math.cos(boundaryAngle) * radialDrift -
          Math.sin(boundaryAngle) * orbitalDrift
        direction[index + 1] = isOuter
          ? 0.02 + rand() * 0.02
          : 0.18 + supportProgress * 0.1
        direction[index + 2] =
          Math.sin(boundaryAngle) * radialDrift +
          Math.cos(boundaryAngle) * orbitalDrift
        speed[i] = baseSpeed * (
          isOuter
            ? 0.14 + rand() * 0.04
            : 0.72 + rand() * 0.16
        )
        break
      }
      default: {
        spawn[index] = 0
        spawn[index + 1] = 0
        spawn[index + 2] = 0
        direction[index] = Math.cos(angle)
        direction[index + 1] = Math.sin(angle)
        direction[index + 2] = (rand() - 0.5) * 0.35
        break
      }
    }

    if (
      controls.spawnShape === 'mesh' &&
      !tuning?.referenceSource &&
      motionKind !== 'screen-fall' &&
      motionKind !== 'trail-stream' &&
      motionKind !== 'beam-telegraph-flow' &&
      motionKind !== 'laser-spray-ricochet' &&
      motionKind !== 'column-rise' &&
      motionKind !== 'meteor-impact' &&
      motionKind !== 'shockwave-ground-burst' &&
      motionKind !== 'healing-cross' &&
      motionKind !== 'shadow-claw'
    ) {
      const [meshX, meshY, meshZ] = samplePfxMeshEmitter(i, count, rand())
      const meshRadius = scale * (0.28 + rand() * 0.12)
      spawn[index] = meshX * meshRadius
      spawn[index + 1] = meshY * meshRadius
      spawn[index + 2] = meshZ * meshRadius
      if (motionKind === 'radial-burst' || motionKind === 'impact-burst' || motionKind === 'cone-fountain') {
        direction[index] = meshX
        direction[index + 1] = meshY + (motionKind === 'cone-fountain' ? 0.65 : 0.12)
        direction[index + 2] = meshZ
      }
    }

    const spawnScale = tuning?.spawnScale ?? 1
    // These motions consume spawnScale while authoring their footprint or
    // body span. Applying the generic multiplier again makes them scale
    // quadratically.
    if (
      spawnScale !== 1 &&
      motionKind !== 'snow-gust' &&
      motionKind !== 'danger-pulse' &&
      motionKind !== 'meteor-impact' &&
      motionKind !== 'beam-telegraph-flow' &&
      motionKind !== 'telegraph-boundary-drift' &&
      motionKind !== 'materialize-gather' &&
      motionKind !== 'materialize-release' &&
      motionKind !== 'ground-ring' &&
      motionKind !== 'orbit-ring' &&
      motionKind !== 'trail-stream'
    ) {
      spawn[index] = spawn[index]! * spawnScale
      spawn[index + 1] = spawn[index + 1]! * spawnScale
      spawn[index + 2] = spawn[index + 2]! * spawnScale
    }

    const length = Math.hypot(direction[index]!, direction[index + 1]!, direction[index + 2]!)
    if (length > 0.0001) {
      direction[index] = direction[index]! / length
      direction[index + 1] = direction[index + 1]! / length
      direction[index + 2] = direction[index + 2]! / length
    }
  }

  const colorIndex = getPfxSurfaceColorIndex(surface)
  const startHex = controls.color[colorIndex] ?? controls.color[0]
  const colorStart = parsePfxHexColor(startHex)
  const colorEnd = parsePfxHexColor(controls.color[colorIndex + 1] ?? startHex)
  return {
    effectId: preset.effectId,
    motionKind,
    count,
    spawn,
    direction,
    speed,
    lifeOffset,
    wobblePhase,
    wobbleFrequency,
    orbitRadius,
    orbitAngle,
    colorStart,
    colorEnd,
  }
}
