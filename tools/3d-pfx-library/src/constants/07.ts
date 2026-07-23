import * as THREE from 'three'
import { PfxSpriteName } from '../particleSprites'
import { roundMetric } from './03'
import { PFX_BURST_CYCLE_MULTIPLIER } from './04'
import { isPfxOmniLightRead } from './05'
import { createPfxExhaustTelegraphLifecycle } from './06'
import { getPfxSurfacePositionOffset } from '../effects/surfacePositionOffset'
import { getPfxSurfaceSpatialPolicy } from '../effects/surfaceSpatialPolicy'
import type { MobileSafety, PfxControls } from '../types/01'
import type { PfxComboRingRuntimeState, PfxEmitterPhysicsFinding, PfxExhaustTelegraphRuntimeState, PfxMeteorBurstRuntimeState, PfxMobileDeviceBenchmark, PfxParticleSimulation, PfxRenderPlan, PfxRenderSurface, PfxSurfaceTuning, PfxTargetSpawnRuntimeState, PfxUiPickupRuntimeState } from '../types/02'

function buildPfxSimulationGeometry(
  simulation: PfxParticleSimulation,
  controls: PfxControls,
): THREE.BufferGeometry {
  const positions = new Float32Array(simulation.count * 3)
  const colors = new Float32Array(simulation.count * 3)
  updatePfxParticleSimulation(simulation, controls, 0, positions, colors)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

export function createPfxComboRingLifecycle(cycle: number): {
  progress: number
  opacity: number
  stage: 'confirm' | 'hold' | 'decay' | 'rest'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.08) return { progress, opacity: roundMetric(progress / 0.08), stage: 'confirm' }
  if (progress < 0.38) return { progress, opacity: 1, stage: 'hold' }
  if (progress < 0.72) return { progress, opacity: roundMetric(1 - (progress - 0.38) / 0.34), stage: 'decay' }
  return { progress: 1, opacity: 0, stage: 'rest' }
}

export function createPfxComboRingRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxComboRingRuntimeState,
): PfxComboRingRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.16 * Math.max(0.25, lifetime)
  const cycle = ((Math.max(0, elapsedSeconds) * rate) % periodSeconds) / periodSeconds
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, stage: 'rest' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = cycle
  if (cycle < 0.08) {
    state.opacity = roundMetric(cycle / 0.08)
    state.stage = 'confirm'
  } else if (cycle < 0.38) {
    state.opacity = 1
    state.stage = 'hold'
  } else if (cycle < 0.72) {
    state.opacity = roundMetric(1 - (cycle - 0.38) / 0.34)
    state.stage = 'decay'
  } else {
    state.progress = 1
    state.opacity = 0
    state.stage = 'rest'
  }
  return state
}

export function createPfxUiPickupLifecycle(cycle: number): {
  progress: number
  opacity: number
  stage: 'collect' | 'rise' | 'deposit' | 'decay' | 'rest'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.08) return { progress, opacity: roundMetric(progress / 0.08), stage: 'collect' }
  if (progress < 0.32) return { progress, opacity: 1, stage: 'rise' }
  if (progress < 0.56) return { progress, opacity: 1, stage: 'deposit' }
  if (progress < 0.78) return { progress, opacity: roundMetric(1 - (progress - 0.56) / 0.22), stage: 'decay' }
  return { progress: 1, opacity: 0, stage: 'rest' }
}

export function createPfxUiPickupRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxUiPickupRuntimeState,
): PfxUiPickupRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.08 * Math.max(0.25, lifetime)
  const cycle = ((Math.max(0, elapsedSeconds) * rate) % periodSeconds) / periodSeconds
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, rise: 0, stage: 'rest' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = cycle
  state.rise = THREE.MathUtils.clamp((cycle - 0.08) / 0.24, 0, 1)
  if (cycle < 0.08) {
    state.opacity = roundMetric(cycle / 0.08)
    state.stage = 'collect'
  } else if (cycle < 0.32) {
    state.opacity = 1
    state.stage = 'rise'
  } else if (cycle < 0.56) {
    state.opacity = 1
    state.stage = 'deposit'
  } else if (cycle < 0.78) {
    state.opacity = roundMetric(1 - (cycle - 0.56) / 0.22)
    state.stage = 'decay'
  } else {
    state.progress = 1
    state.opacity = 0
    state.rise = 1
    state.stage = 'rest'
  }
  return state
}

export function createPfxTargetSpawnLifecycle(cycle: number): {
  progress: number
  opacity: number
  stage: 'acquire' | 'lock' | 'confirm' | 'release' | 'rest'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.12) return { progress, opacity: roundMetric(0.28 + (progress / 0.12) * 0.72), stage: 'acquire' }
  if (progress < 0.42) return { progress, opacity: 1, stage: 'lock' }
  if (progress < 0.62) return { progress, opacity: 1, stage: 'confirm' }
  if (progress < 0.82) return { progress, opacity: roundMetric(1 - (progress - 0.62) / 0.2), stage: 'release' }
  return { progress: 1, opacity: 0, stage: 'rest' }
}

export function createPfxTargetSpawnRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxTargetSpawnRuntimeState,
): PfxTargetSpawnRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.08 * Math.max(0.25, lifetime)
  const cycle = ((Math.max(0, elapsedSeconds) * rate) % periodSeconds) / periodSeconds
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, lift: 0, stage: 'rest' }
  const lifecycle = createPfxTargetSpawnLifecycle(cycle)
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.lift = THREE.MathUtils.clamp((cycle - 0.1) / 0.32, 0, 1)
  state.stage = lifecycle.stage
  return state
}

export function createPfxExhaustTelegraphRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxExhaustTelegraphRuntimeState,
): PfxExhaustTelegraphRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.2 * Math.max(0.25, lifetime)
  const cycle = THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1)
  const lifecycle = createPfxExhaustTelegraphLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, urgency: 0, ventOpen: 0, release: 0, stage: 'arm' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.urgency = lifecycle.urgency
  state.ventOpen = lifecycle.ventOpen
  state.release = lifecycle.release
  state.stage = lifecycle.stage
  return state
}

export function createPfxMeteorBurstLifecycle(cycle: number): {
  progress: number
  opacity: number
  impact: number
  flash: number
  scatter: number
  cool: number
  head: number
  stage: 'descent' | 'collision' | 'ballistic-cool'
} {
  const progress = THREE.MathUtils.clamp(cycle, 0, 1)
  if (progress < 0.22) {
    const descent = THREE.MathUtils.clamp(progress / 0.22, 0, 1)
    return {
      progress,
      opacity: roundMetric(0.42 + descent * 0.58),
      impact: 0,
      flash: roundMetric(0.18 + descent * 0.28),
      scatter: 0,
      cool: 0,
      head: 1,
      stage: 'descent',
    }
  }
  if (progress < 0.56) {
    const collision = (progress - 0.22) / 0.34
    return {
      progress,
      opacity: 1,
      impact: 1,
      flash: roundMetric(1 - collision * 0.55),
      scatter: roundMetric(collision * 0.46),
      cool: 0,
      head: roundMetric(0.72 * (1 - THREE.MathUtils.smoothstep(collision, 0.001, 0.16))),
      stage: 'collision',
    }
  }
  const decay = (progress - 0.56) / 0.44
  return {
    progress,
    opacity: Math.max(0, roundMetric(1 - Math.pow(decay, 0.62))),
    impact: 1,
    flash: roundMetric(0.45 - decay * 0.37),
    scatter: roundMetric(0.46 + decay * 0.54),
    cool: roundMetric(decay),
    head: 0,
    stage: 'ballistic-cool',
  }
}

export function createPfxMeteorBurstRuntimeState(
  elapsedSeconds: number,
  timing: number,
  lifetime: number,
  tempo: number,
  motionMultiplier: number,
  target?: PfxMeteorBurstRuntimeState,
): PfxMeteorBurstRuntimeState {
  const rate = Math.max(0.05, timing) * Math.max(0.1, tempo) * Math.max(0.1, motionMultiplier)
  const periodSeconds = 1.42 * Math.max(0.25, lifetime)
  const cycle = roundMetric(THREE.MathUtils.clamp((Math.max(0, elapsedSeconds) * rate) / periodSeconds, 0, 1))
  const lifecycle = createPfxMeteorBurstLifecycle(cycle)
  const state = target ?? { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, impact: 0, flash: 0, scatter: 0, cool: 0, head: 0, stage: 'descent' }
  state.cycle = cycle
  state.periodSeconds = periodSeconds
  state.progress = lifecycle.progress
  state.opacity = lifecycle.opacity
  state.impact = lifecycle.impact
  state.flash = lifecycle.flash
  state.scatter = lifecycle.scatter
  state.cool = lifecycle.cool
  state.head = lifecycle.head
  state.stage = lifecycle.stage
  return state
}

export const PFX_MESH_BEAT_WINDOWS: Partial<Record<NonNullable<PfxSurfaceTuning['meshMotion']>, [number, number]>> = {
  flash: [0, 0.12],
  shockwave: [0, 0.3],
  bloom: [0, 0.55],
  break: [0, 0.68],
}

export const PFX_MOBILE_DEVICE_BENCHMARKS: PfxMobileDeviceBenchmark[] = [
  {
    deviceClass: 'low-end',
    hardware: 'Adreno 610 / Mali-G52 MC2 (SD 665/680, Helio G85), 720p, Chrome Android',
    targetFps: 30,
    vfxGpuBudgetMs: 2,
    maxLiveParticles: 150,
    maxVfxDrawCalls: 8,
    maxTextureMemoryKb: 4096,
    concurrentLargeEffects: 3,
  },
  {
    deviceClass: 'mid',
    hardware: 'Adreno 619 / Mali-G57 MC2 / Apple A13-A15, Mobile Safari + Chrome Android',
    targetFps: 60,
    vfxGpuBudgetMs: 2,
    maxLiveParticles: 400,
    maxVfxDrawCalls: 15,
    maxTextureMemoryKb: 8192,
    concurrentLargeEffects: 6,
  },
]

export const computedMobileSafetyCache = new Map<string, MobileSafety>()

const PFX_BALLISTIC_SPRITES = new Set<PfxSpriteName>(['spark', 'debris', 'streak', 'ember'])

const PFX_SOFT_MATTER_SPRITES = new Set<PfxSpriteName>(['smoke', 'puff'])

const PFX_GLOW_BODY_SPRITES = new Set<PfxSpriteName>(['fire', 'flame'])

export function createPfxEmitterPhysicsFindings(
  plan: Pick<PfxRenderPlan, 'surfaces'> & Partial<Pick<PfxRenderPlan, 'feelVersion'>>,
): PfxEmitterPhysicsFinding[] {
  const findings: PfxEmitterPhysicsFinding[] = []
  const feelVersion = plan.feelVersion ?? 2
  let stretchedLayers = 0
  for (const surface of plan.surfaces) {
    const tuning = surface.tuning ?? {}
    const phase = surface.phase ?? surface.kind
    if (
      feelVersion >= 2 &&
      (surface.kind === 'particles' || surface.kind === 'impact-sparks') &&
      tuning.turbulenceScale === undefined
    ) {
      findings.push({
        phase,
        rule: 'implicit-wobble',
        detail: 'v2 particle layer inherits the default group wobble — declare turbulenceScale explicitly (0 for directed/ballistic verbs)',
      })
    }
    const sprite = tuning.sprite
    const stretch = tuning.stretch ?? 0
    // Ground-space arcs (motion ground-scuff) are the SAME line language in
    // a different plane — lightning in the air + lightning crawling the
    // ground don't compete (electric-burst review). Only same-space pairs do.
    if (stretch > 0.5 && tuning.motion !== 'ground-scuff') {
      stretchedLayers += 1
      if ((tuning.gravity ?? 0) < 0) {
        findings.push({
          phase,
          rule: 'stretched-streak-gravity',
          detail: 'velocity-stretched streak with gravity rotates in place as drag kills speed — set gravity 0 or stretch 0',
        })
      }
    }
    if (sprite === 'spark' && stretch === 0 && (tuning.spinScale ?? 1) === 0) {
      findings.push({
        phase,
        rule: 'jagged-line-sprite',
        detail: "the 'spark' atlas asset is an elongated jagged line — roll-locked unstretched dots render as parallel bolts; use 'glow' for dots or 'streak' for motion lines",
      })
    }
    if (sprite && PFX_BALLISTIC_SPRITES.has(sprite) && (tuning.gravity ?? 0) !== 0 && tuning.turbulenceScale === undefined) {
      findings.push({
        phase,
        rule: 'ballistic-wobble',
        detail: 'ballistic ejecta inherits turbulence wobble (particle + group) — set turbulenceScale 0',
      })
    }
    if (tuning.bands && sprite && PFX_SOFT_MATTER_SPRITES.has(sprite)) {
      findings.push({
        phase,
        rule: 'banded-soft-matter',
        detail: 'cel banding crushes soft alpha falloff into hard rims — remove bands from smoke/puff matter',
      })
    }
    if (tuning.bands && sprite && PFX_GLOW_BODY_SPRITES.has(sprite) && tuning.blend !== 'alpha') {
      findings.push({
        phase,
        rule: 'banded-glow-body',
        detail: 'additive glow IS the fire read — banding a glow body kills it; bands are for drawn hot shapes',
      })
    }
    const midSize = Array.isArray(tuning.size) ? tuning.size[1] : undefined
    if ((tuning.spinScale ?? 0) > 1.5 && midSize !== undefined && midSize <= 0.4) {
      findings.push({
        phase,
        rule: 'pinwheel-dots',
        detail: 'high spinScale on small sprites reads as pinwheeling dots — cap tumble near 1.1',
      })
    }
    // Render-read rules (impact review round 1): these three raw geometries
    // reached user review as visual defects — fail them at authoring time.
    if (
      feelVersion >= 2 &&
      surface.kind === 'screen-plane' &&
      tuning.meshMotion !== 'flash' &&
      tuning.meshMotion !== 'glow' &&
      tuning.meshMotion !== 'pulse'
    ) {
      findings.push({
        phase,
        rule: 'square-screen-plane',
        detail: "screen-plane without a flash/glow read renders the square vignette card — declare meshMotion 'flash' or 'glow' for the radial camera-facing card",
      })
    }
    if (
      feelVersion >= 2 &&
      surface.kind === 'ring-field' &&
      !tuning.meshShader &&
      tuning.meshMotion !== 'shockwave' &&
      tuning.ringPurpose !== 'reticle' &&
      tuning.ringPurpose !== 'glyph' &&
      tuning.ringPurpose !== 'boundary'
    ) {
      findings.push({
        phase,
        rule: 'bare-torus-ring',
        detail: 'ring-field without a drawn ringPurpose/meshShader renders the legacy torus tube — set ringPurpose (reticle/boundary/glyph) or a meshShader',
      })
    }
    // sprite tunings are IGNORED on mesh kinds — a trail-ribbon without a
    // meshShader always renders the legacy box, sprite or not (user round:
    // 'they are a box shape and it is not working').
    if (feelVersion >= 2 && surface.kind === 'trail-ribbon' && !tuning.meshShader) {
      findings.push({
        phase,
        rule: 'box-trail-ribbon',
        detail: 'bare trail-ribbon renders a tilted box slab — give the wake a real read (streak/twirl particles, arc-sweep shader) or cut it',
      })
    }
    if (
      feelVersion >= 2 &&
      (surface.kind === 'cloud-volume' || surface.kind === 'smoke-billows') &&
      surface.opacity < 0.3
    ) {
      findings.push({
        phase,
        rule: 'faint-cloud',
        detail: 'cloud mesh under 0.3 opacity only reads where faces stack — it vanishes at most angles; floor at ~0.32 or cut the layer',
      })
    }
    if (feelVersion >= 2) {
      // Origin-semantics rule (beam review: user caught misplaced origins
      // three times): a phase whose NAME says floor must anchor at the
      // ground; crown/apex names must anchor at the column top; point-source
      // fans/jets/vents need a tight spawn origin.
      const offset = getPfxSurfacePositionOffset({ role: surface.role, phase })
      if (/(foot-ring|base-ring|pad|ripple|eddy|scuff|grit|vent)/.test(phase) && offset[1] !== -0.88) {
        findings.push({ phase, rule: 'misplaced-origin', detail: 'floor-semantic phase does not resolve to the ground anchor — add a ground token to the phase name' })
      }
      if (/(crown|apex)/.test(phase) && offset[1] < 1) {
        findings.push({ phase, rule: 'misplaced-origin', detail: 'crown/apex-semantic phase does not resolve to the column-top anchor — use the column-crown token' })
      }
      if (
        /(fan|jet|vent|bolt)/.test(phase) &&
        (surface.kind === 'particles' || surface.kind === 'impact-sparks') &&
        (tuning.motion === 'radial-burst' || tuning.motion === 'cone-fountain') &&
        (tuning.spawnScale ?? 1) > 0.5
      ) {
        findings.push({ phase, rule: 'misplaced-origin', detail: 'point-source fan/jet spawns across the default radius — set spawnScale <= 0.5 so it emits from the nozzle' })
      }
    }
    if (
      feelVersion >= 2 &&
      surface.kind === 'core-sphere' &&
      !tuning.meshShader &&
      tuning.meshMotion !== undefined &&
      !isPfxOmniLightRead(tuning)
    ) {
      findings.push({
        phase,
        rule: 'angle-dependent-core',
        detail: 'core-sphere light reads outside the omni card class (flash/glow/charge) render a texture-mapped sphere whose glow faces one direction — move the read into the card class or give it a mesh shader',
      })
    }
  }
  if (stretchedLayers > 1) {
    findings.push({
      phase: '*',
      rule: 'multiple-line-languages',
      detail: `${stretchedLayers} velocity-stretched layers — one line language per effect; secondary layers become dots`,
    })
  }
  return findings
}

export function isPfxSurfaceCameraFacing(
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase' | 'tuning'>,
  feelVersion = 2,
): boolean {
  const policy = getPfxSurfaceSpatialPolicy(surface)
  const authoredPortalSurface = surface.phase === 'vortex-rim' || surface.phase === 'aperture-depth' || surface.phase?.startsWith('portal-charge-aperture')
  const authoredVolume =
    (surface.kind === 'muzzle-cone' && !surface.phase?.includes('crown')) ||
    surface.kind === 'impact-core' ||
    surface.kind === 'impact-shards' ||
    surface.kind === 'coin-reward-burst' ||
    surface.kind === 'shield-fragments' ||
    surface.kind === 'wind-streaks' ||
    surface.kind === 'acid-pool' ||
    surface.kind === 'shield-shell' ||
    (surface.tuning?.meshGeometry as string | undefined) === 'dust-burst-grounded-crown' ||
    (surface.tuning?.meshGeometry as string | undefined) === 'debris-burst-fractured-mass' ||
    surface.tuning?.meshGeometry === 'flame-charge-trefoil-crucible' ||
    surface.tuning?.meshGeometry === 'curse-twisted-spire' ||
    surface.tuning?.meshGeometry === 'curse-binding-seal'
  return policy.cameraFacing || (!authoredPortalSurface && (
    feelVersion >= 2 && !authoredVolume && (
      isPfxOmniLightRead(surface.tuning) ||
      surface.kind === 'cloud-volume' ||
      surface.tuning?.meshShader === 'vortex-swirl' ||
      surface.tuning?.meshShader === 'portal-throat'
    )
  ))
}

export function shouldApplyPfxSurfaceCameraFacing(
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase' | 'tuning'>,
  feelVersion = 2,
  parentCameraPinned = false,
): boolean {
  return !parentCameraPinned && isPfxSurfaceCameraFacing(surface, feelVersion)
}

export function shouldRotatePfxBurstPattern(
  surface: Pick<PfxRenderSurface, 'kind' | 'tuning'>,
  feelVersion = 2,
): boolean {
  return feelVersion >= 2 &&
    (surface.kind === 'particles' || surface.kind === 'impact-sparks') &&
    (surface.tuning?.window ?? 1) < 1 &&
    surface.tuning?.impactVector == null
}

export const PFX_PROJECTILE_COMET_TAIL_LOBES: ReadonlyArray<{ offset: readonly [number, number, number]; size: number }> = [
  { offset: [-0.34, 0.02, 0.05], size: 0.4 },
  { offset: [-0.62, -0.05, -0.09], size: 0.33 },
  { offset: [-0.86, 0.08, 0.11], size: 0.26 },
  { offset: [-1.06, -0.04, -0.06], size: 0.2 },
  { offset: [-1.24, 0.03, 0.04], size: 0.14 },
]

export const PFX_SMOKE_BILLOW_LOBES: ReadonlyArray<{ offset: readonly [number, number, number]; size: number }> = [
  { offset: [-0.05, 0.02, -0.05], size: 0.8 },
  { offset: [-0.1, 0.18, -0.3], size: 0.72 },
  { offset: [0.34, 0.04, 0.22], size: 0.64 },
  { offset: [-0.42, -0.12, 0.34], size: 0.58 },
  { offset: [0.12, 0.48, 0.1], size: 0.48 },
  { offset: [0.05, 0.3, 0.38], size: 0.42 },
  { offset: [0.5, 0.38, -0.26], size: 0.4 },
]

export const PFX_SPAWN_VOXEL_LAYOUT: ReadonlyArray<readonly [number, number, number, number]> = [
  [-0.34, -0.42, 0.18, 0.9], [0.28, -0.28, -0.24, 0.76], [-0.18, -0.08, -0.32, 0.68],
  [0.32, 0.08, 0.16, 0.62], [-0.24, 0.24, 0.24, 0.58], [0.14, 0.4, -0.18, 0.54],
  [-0.3, 0.54, -0.08, 0.5], [0.26, 0.68, 0.12, 0.46], [-0.12, 0.82, 0.26, 0.42],
  [0.2, 0.96, -0.22, 0.38], [-0.18, 1.1, -0.08, 0.34], [0.08, 1.24, 0.14, 0.3],
]

export function getPfxParticleLifeAlpha(life: number): number {
  const fadeIn = Math.min(1, Math.max(0, life / 0.14))
  const fadeOut = Math.min(1, Math.max(0, (1 - life) / 0.35))
  const eased = fadeIn * fadeIn * (3 - 2 * fadeIn) * (fadeOut * fadeOut * (3 - 2 * fadeOut))
  return Math.max(0, Math.min(1, eased))
}

export function updatePfxParticleSimulation(
  simulation: PfxParticleSimulation,
  controls: Pick<PfxControls, 'timing' | 'lifetime' | 'gravity' | 'turbulence' | 'scale' | 'velocity'>,
  elapsedSeconds: number,
  positions: Float32Array,
  colors: Float32Array,
): void {
  const lifetime = Math.max(0.25, controls.lifetime)
  const timeScale = Math.max(0.05, controls.timing)
  const turbulence = Math.max(0, controls.turbulence)
  const wobbleAmplitude = turbulence * 0.055 * controls.scale
  const gravity = controls.gravity * 0.85 * controls.scale
  const [r0, g0, b0] = simulation.colorStart
  const [r1, g1, b1] = simulation.colorEnd
  const meteorPeriod = lifetime * PFX_BURST_CYCLE_MULTIPLIER
  const meteorCycle = ((elapsedSeconds * timeScale) % meteorPeriod) / meteorPeriod
  const meteorIncomingCount = Math.max(2, Math.floor(simulation.count * 0.28))
  const shockwaveCycle = ((elapsedSeconds * timeScale) % meteorPeriod) / meteorPeriod

  for (let i = 0; i < simulation.count; i++) {
    const index = i * 3
    const life = (elapsedSeconds * timeScale / lifetime + simulation.lifeOffset[i]!) % 1
    const age = life * lifetime
    const wobbleT = elapsedSeconds * timeScale * simulation.wobbleFrequency[i]! + simulation.wobblePhase[i]!
    const wobbleX = Math.sin(wobbleT) * wobbleAmplitude
    const wobbleY = Math.cos(wobbleT * 0.83) * wobbleAmplitude * 0.7

    if (simulation.motionKind === 'meteor-impact') {
      if (i < meteorIncomingCount) {
        const trailProgress = i / Math.max(1, meteorIncomingCount - 1)
        const descent = THREE.MathUtils.clamp(meteorCycle / 0.22, 0, 1)
        const headX = THREE.MathUtils.lerp(-0.92 * controls.scale, 0, descent)
        const headY = THREE.MathUtils.lerp(1.18 * controls.scale, 0.08 * controls.scale, descent)
        const headZ =
          THREE.MathUtils.lerp(-0.72 * controls.scale, 0, descent) +
          Math.sin(descent * Math.PI) * 0.12 * controls.scale
        const trailDistance = (1 - trailProgress) * 0.38 * controls.scale
        positions[index] = headX - 0.58 * trailDistance
        positions[index + 1] = headY + 0.8 * trailDistance
        positions[index + 2] = headZ - 1.1 * trailDistance
        const arrivalFade = 1 - THREE.MathUtils.clamp((meteorCycle - 0.13) / 0.055, 0, 1)
        const arrivalAlpha = Math.sin(Math.min(1, meteorCycle / 0.035) * Math.PI / 2) * arrivalFade * (0.42 + trailProgress * 0.58)
        colors[index] = r0 * arrivalAlpha
        colors[index + 1] = g0 * arrivalAlpha
        colors[index + 2] = b0 * arrivalAlpha
      } else {
        const ejectaProgress = THREE.MathUtils.clamp((meteorCycle - 0.1) / 0.69, 0, 1)
        const live = meteorCycle >= 0.1 && meteorCycle < 0.79
        const travelAge = ejectaProgress * 1.12
        const travel = simulation.speed[i]! * travelAge
        const drop = gravity * travelAge * travelAge * 0.5
        positions[index] = simulation.spawn[index]! + simulation.direction[index]! * travel
        positions[index + 1] = simulation.spawn[index + 1]! + simulation.direction[index + 1]! * travel + drop
        positions[index + 2] = simulation.spawn[index + 2]! + simulation.direction[index + 2]! * travel
        const burstIn = THREE.MathUtils.clamp(ejectaProgress / 0.08, 0, 1)
        const burstOut = Math.pow(Math.max(0, 1 - ejectaProgress), 0.58)
        const ejectaAlpha = live ? burstIn * burstOut : 0
        const colorMix = ejectaProgress * 0.72
        colors[index] = (r0 + (r1 - r0) * colorMix) * ejectaAlpha
        colors[index + 1] = (g0 + (g1 - g0) * colorMix) * ejectaAlpha
        colors[index + 2] = (b0 + (b1 - b0) * colorMix) * ejectaAlpha
      }
      continue
    }

    if (simulation.motionKind === 'shockwave-ground-burst') {
      // A spawn shockwave is one coherent displacement front. Per-particle
      // life offsets made the field look like a stationary center puff, so
      // all motes share this burst clock while retaining varied speed/radius.
      const releaseProgress = THREE.MathUtils.clamp((shockwaveCycle - 0.025) / 0.3, 0, 1)
      const travelAge = releaseProgress * 0.72
      const travel = simulation.speed[i]! * travelAge
      const drop = -Math.abs(gravity) * travelAge * travelAge * 0.5
      positions[index] = simulation.spawn[index]! + simulation.direction[index]! * travel + wobbleX * 0.24
      positions[index + 1] = Math.max(
        0,
        simulation.spawn[index + 1]! + simulation.direction[index + 1]! * travel + drop + wobbleY * 0.025,
      )
      positions[index + 2] = simulation.spawn[index + 2]! + simulation.direction[index + 2]! * travel + wobbleX * 0.08
      const burstIn = THREE.MathUtils.clamp(releaseProgress / 0.09, 0, 1)
      const burstOut = 1 - THREE.MathUtils.clamp((shockwaveCycle - 0.34) / 0.24, 0, 1)
      const alpha = burstIn * burstOut
      const mix = releaseProgress * 0.72
      colors[index] = (r0 + (r1 - r0) * mix) * alpha
      colors[index + 1] = (g0 + (g1 - g0) * mix) * alpha
      colors[index + 2] = (b0 + (b1 - b0) * mix) * alpha
      continue
    }

    if (simulation.motionKind === 'beam-telegraph-flow') {
      const laneMin = -1.55 * controls.scale
      const laneMax = 1.55 * controls.scale
      const laneSpan = laneMax - laneMin
      const unwrapped = simulation.spawn[index]! - simulation.speed[i]! * age
      const wrapped = ((unwrapped - laneMin) % laneSpan + laneSpan) % laneSpan
      const laneX = laneMin + wrapped
      const laneProgress = (laneX - laneMin) / laneSpan
      positions[index] = laneX
      positions[index + 1] = simulation.spawn[index + 1]! + wobbleY * 0.12
      positions[index + 2] = simulation.spawn[index + 2]! * (0.42 + laneProgress * 0.58) + wobbleX * 0.08
    } else if (simulation.motionKind === 'dust-loop') {
      const drag = 0.42
      const travel = (1 - Math.exp(-drag * age)) / drag
      const eddy = Math.sin(
        simulation.spawn[index]! * 2.7 +
        simulation.spawn[index + 2]! * 3.1 +
        elapsedSeconds * timeScale * (1.4 + simulation.wobbleFrequency[i]! * 0.15) +
        simulation.wobblePhase[i]!,
      )
      positions[index] = simulation.spawn[index]! + simulation.direction[index]! * simulation.speed[i]! * travel + wobbleX * 0.34
      positions[index + 1] = Math.max(0, simulation.spawn[index + 1]! + eddy * 0.045 + wobbleY * 0.12)
      positions[index + 2] = simulation.spawn[index + 2]! + simulation.direction[index + 2]! * simulation.speed[i]! * travel + wobbleX * 0.084
    } else if (simulation.motionKind === 'healing-spiral') {
      const angle = simulation.orbitAngle[i]! + elapsedSeconds * timeScale * (1.15 + turbulence * 0.3) + life * 1.8
      const radius = simulation.orbitRadius[i]! * (0.82 + Math.sin(wobbleT) * 0.12)
      positions[index] = Math.cos(angle) * radius + wobbleX * 0.45
      positions[index + 1] = simulation.spawn[index + 1]! + life * 1.55 + wobbleY * 0.45
      positions[index + 2] = Math.sin(angle) * radius + Math.sin(wobbleT * 0.6) * 0.03
    } else if (simulation.motionKind === 'orbit-ring') {
      const angle =
        simulation.orbitAngle[i]! + elapsedSeconds * timeScale * (0.45 + turbulence * 0.35) + life * 0.4
      const radius = simulation.orbitRadius[i]! * (1 + Math.sin(wobbleT) * 0.05 * (1 + turbulence * 0.5))
      positions[index] = Math.cos(angle) * radius + wobbleX * 0.4
      positions[index + 1] = Math.sin(angle) * radius + wobbleY * 0.4
      positions[index + 2] = simulation.spawn[index + 2]! + Math.sin(wobbleT * 0.6) * 0.03
    } else {
      const travel = simulation.speed[i]! * age
      const drop = gravity * age * age * 0.5
      positions[index] = simulation.spawn[index]! + simulation.direction[index]! * travel + wobbleX
      positions[index + 1] = simulation.spawn[index + 1]! + simulation.direction[index + 1]! * travel + drop + wobbleY
      positions[index + 2] = simulation.spawn[index + 2]! + simulation.direction[index + 2]! * travel + wobbleX * 0.3
    }

    const alpha = getPfxParticleLifeAlpha(life)
    const mix = life
    colors[index] = (r0 + (r1 - r0) * mix) * alpha
    colors[index + 1] = (g0 + (g1 - g0) * mix) * alpha
    colors[index + 2] = (b0 + (b1 - b0) * mix) * alpha
  }
}

export const pfxHotContext = (import.meta as { hot?: { accept(callback: () => void): void; invalidate(): void } }).hot
