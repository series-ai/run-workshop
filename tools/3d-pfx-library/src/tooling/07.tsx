import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { PFX_CERTIFIED_EFFECTS, roundMetric } from '../constants/03'
import { PFX_PARTICLE_BASE_SIZE, createReducedMotionControls, getPfxSharedGeometry, getPfxSharedParticleTexture } from '../constants/04'
import { PFX_MESH_BEAT_WINDOWS, PFX_MOBILE_DEVICE_BENCHMARKS, computedMobileSafetyCache, createPfxEmitterPhysicsFindings } from '../constants/07'
import { getPfxCycleScale } from '../effects/cycleScale'
import { PFX_COMPONENT_DEFINITIONS, PFX_TAXONOMY, createPfxParticleEmission, createPfxPreset, getPfxComponentDefinition, getPfxRenderPlan, summarizePfxPerformance } from './01'
import { PfxSurface } from '../PfxSurface'
import type { MobileSafety, PfxPreset, PfxPresetOverrides } from '../types/01'
import type { GamePfxProps, PfxChoreographyAudit, PfxChoreographyBeat, PfxDropInComponent, PfxDropInComponentProps, PfxGroupReadinessReport, PfxGroupReadinessRow, PfxMobileBenchmarkRow, PfxRenderPlan } from '../types/02'

export function GamePfx({ preset, position = [0, 0, 0], reducedMotion = false, previewTimeSeconds, recipeOverride, screenAnchor = true }: GamePfxProps) {
  const group = useRef<THREE.Group>(null)
  const runtimePreset = useMemo(
    () =>
      reducedMotion
        ? {
            ...preset,
            controls: createReducedMotionControls(preset.controls),
          }
        : preset,
    [preset, reducedMotion],
  )
  const plan = useMemo(() => getPfxRenderPlan(runtimePreset, { recipeOverride }), [recipeOverride, runtimePreset])
  // v2 recipes extend the master cycle so every particle completes
  // birth->death before the wrap; legacy recipes keep the old cut behavior.
  const planCycleScale = useMemo(
    () => (plan.feelVersion >= 2 ? getPfxCycleScale(plan.surfaces) : 1),
    [plan],
  )
  const material = useMemo(() => {
    const texture = getPfxSharedParticleTexture(runtimePreset.controls.texture)
    return new THREE.PointsMaterial({
      color: runtimePreset.controls.color[0] ?? '#ffffff',
      size: PFX_PARTICLE_BASE_SIZE * runtimePreset.controls.scale * (1 + runtimePreset.controls.emissiveBloom * 0.22),
      transparent: true,
      opacity: Math.min(1, 0.72 + runtimePreset.controls.emissiveBloom * 0.18),
      map: texture,
      blending: runtimePreset.controls.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    })
  }, [
    runtimePreset.controls.blendMode,
    runtimePreset.controls.color,
    runtimePreset.controls.emissiveBloom,
    runtimePreset.controls.scale,
    runtimePreset.controls.texture,
  ])
  const geometry = useMemo(() => getPfxSharedGeometry(runtimePreset), [runtimePreset])
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: runtimePreset.controls.color[0] ?? '#ffffff',
        transparent: true,
        opacity: 0.46,
        blending: runtimePreset.controls.blendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
        depthWrite: false,
      }),
    [runtimePreset.controls.blendMode, runtimePreset.controls.color],
  )
  const accentMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: runtimePreset.controls.color[1] ?? runtimePreset.controls.color[0] ?? '#ffffff',
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        blending: runtimePreset.controls.blendMode === 'multiply' ? THREE.MultiplyBlending : THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [runtimePreset.controls.blendMode, runtimePreset.controls.color],
  )

  // Motion lives in the per-surface shaders/animations; a legacy group-level
  // rotation wobble here made whole systems drift sideways (rising motes
  // migrating down-right read as poison, not healing).

  // Screen-space effects (space 'ui': vignettes, screen flashes, HUD bursts)
  // annotate the FRAME, not a world spot — pin the group to the camera every
  // frame at a fixed depth so it survives orbit/camera movement.
  const effectSpace = useMemo(
    () => PFX_TAXONOMY.find((effect) => effect.id === runtimePreset.effectId)?.space ?? 'world',
    [runtimePreset.effectId],
  )
  const screenAnchorForward = useRef(new THREE.Vector3())
  const screenAnchorParentQuaternion = useRef(new THREE.Quaternion())
  useFrame(({ camera }) => {
    if (effectSpace !== 'ui' || !group.current) return
    // Work in WORLD space, then convert into the parent's frame — stages
    // nest effects inside transformed groups, and a raw local copy of the
    // camera transform leaves the overlay tilted (gallery-tile review).
    if (screenAnchor) {
      screenAnchorForward.current.set(0, 0, -1).applyQuaternion(camera.quaternion)
      group.current.position.copy(camera.position).addScaledVector(screenAnchorForward.current, 6)
      if (group.current.parent) {
        group.current.parent.updateWorldMatrix(true, false)
        group.current.parent.worldToLocal(group.current.position)
      }
    }
    group.current.quaternion.copy(camera.quaternion)
    if (group.current.parent) {
      group.current.parent.updateWorldMatrix(true, false)
      screenAnchorParentQuaternion.current.setFromRotationMatrix(group.current.parent.matrixWorld).invert()
      group.current.quaternion.premultiply(screenAnchorParentQuaternion.current)
    }
  })

  return (
    <group ref={group} position={position} userData={{ testid: `pfx-${runtimePreset.effectId}` }}>
      {plan.surfaces.map((surface, index) => (
        <PfxSurface
          key={`${surface.kind}-${index}`}
          surface={surface}
          geometry={geometry}
          particleMaterial={material}
          coreMaterial={coreMaterial}
          accentMaterial={accentMaterial}
          controls={runtimePreset.controls}
          effectId={runtimePreset.effectId}
          profile={runtimePreset.implementationProfile}
          previewTimeSeconds={previewTimeSeconds}
          feelVersion={plan.feelVersion}
          cycleScale={planCycleScale}
          tempo={plan.tempo}
          parentCameraPinned={effectSpace === 'ui'}
        />
      ))}
    </group>
  )
}

export function createGamePfxComponent(
  effectId: string,
  defaultOverrides: PfxPresetOverrides = {},
): PfxDropInComponent {
  const definition = getPfxComponentDefinition(effectId)
  if (!definition) {
    throw new Error(`Unknown PFX effect id for component: ${effectId}`)
  }

  const DropInPfx = ({ overrides, position, reducedMotion }: PfxDropInComponentProps) => {
    const preset = useMemo(
      () =>
        createPfxPreset(effectId, {
          ...defaultOverrides,
          ...overrides,
        }),
      [overrides],
    )
    return <GamePfx preset={preset} position={position} reducedMotion={reducedMotion} />
  }
  DropInPfx.displayName = definition.componentName
  DropInPfx.effectId = effectId
  return DropInPfx
}

export const PFX_COMPONENTS: Record<string, PfxDropInComponent> = Object.fromEntries(
  PFX_COMPONENT_DEFINITIONS.map((definition) => [
    definition.effectId,
    createGamePfxComponent(definition.effectId),
  ]),
)

export function createPfxChoreographyAudit(
  plan: Pick<PfxRenderPlan, 'effectId' | 'surfaces'>,
): PfxChoreographyAudit {
  const beats: PfxChoreographyBeat[] = []
  let burstLayerCount = 0
  for (const surface of plan.surfaces) {
    const tuning = surface.tuning ?? {}
    // arc-sweep owns its own choreography in-shader: the racing leading
    // edge is a sharp opening and the erosion tail is the resolver. Model
    // both so a slash needs no extra layers to satisfy the beat grammar.
    if (tuning.meshShader === 'arc-sweep') {
      beats.push({ phase: (surface.phase ?? surface.kind) + ':edge', role: surface.role, kind: surface.kind, startFraction: 0, spawnEndFraction: 0.1, lifeScale: 1 })
      beats.push({ phase: (surface.phase ?? surface.kind) + ':erosion', role: surface.role, kind: surface.kind, startFraction: 0.16, spawnEndFraction: 0.45, lifeScale: 1 })
      burstLayerCount += 1
      continue
    }
    const meshBeat = tuning.meshMotion ? PFX_MESH_BEAT_WINDOWS[tuning.meshMotion] : undefined
    if (meshBeat) {
      // flash/shockwave renderers honor tuning.delay — the audit models the
      // staged window, not the base one.
      const meshDelay = tuning.meshMotion === 'flash' || tuning.meshMotion === 'shockwave' ? tuning.delay ?? 0 : 0
      beats.push({
        phase: surface.phase ?? surface.kind,
        role: surface.role,
        kind: surface.kind,
        startFraction: meshBeat[0] + meshDelay,
        spawnEndFraction: meshBeat[1] + meshDelay,
        lifeScale: 1,
      })
      burstLayerCount += 1
      continue
    }
    const window = tuning.window ?? 1
    const isBurst = window < 1
    if (isBurst) burstLayerCount += 1
    beats.push({
      phase: surface.phase ?? surface.kind,
      role: surface.role,
      kind: surface.kind,
      startFraction: tuning.delay ?? 0,
      spawnEndFraction: (tuning.delay ?? 0) + window,
      lifeScale: tuning.lifeScale ?? 1,
    })
  }
  // Ties at the same start resolve to the longer envelope first — at t=0 the
  // hero pop (mesh flash) owns the instant over its accent sparks.
  beats.sort((left, right) => left.startFraction - right.startFraction || right.spawnEndFraction - left.spawnEndFraction)

  if (burstLayerCount === 0) {
    return { effectId: plan.effectId, kind: 'loop', beats, findings: [], passed: true }
  }

  // Archetype awareness: staged-beat rules apply to IMPULSE effects only.
  // - sharp beats: short-window particles or impulse mesh beats
  //   (flash/shockwave); bloom/break are soft.
  // - no sharp beats at all -> continuous/soft archetype (traveling bodies,
  //   soft blooms): no staging demands.
  // - micro-burst: every sharp beat lives inside the first instant — the
  //   effect IS one beat (muzzle flash); staggering it would be wrong.
  const sharpBeats = beats.filter(
    (beat) =>
      beat.spawnEndFraction - beat.startFraction < 0.35 &&
      (beat.spawnEndFraction - beat.startFraction > 0 || beat.startFraction > 0),
  )
  if (sharpBeats.length === 0) {
    return { effectId: plan.effectId, kind: 'loop', beats, findings: [], passed: true }
  }
  const microBurst = sharpBeats.every((beat) => beat.startFraction <= 0.03 && beat.spawnEndFraction <= 0.18)

  const findings: string[] = []
  const burstBeats = beats.filter((beat) => beat.spawnEndFraction - beat.startFraction < 1)
  const starts = burstBeats.map((beat) => beat.startFraction)
  const spread = Math.max(...starts) - Math.min(...starts)
  if (!microBurst && burstBeats.length >= 3 && spread < 0.12) {
    findings.push(
      `co-firing: all ${burstBeats.length} burst layers start within the first ${Math.round((Math.min(...starts) + spread) * 100)}% of the cycle — no staged handoff`,
    )
  }
  const hasOpeningBeat = burstBeats.some(
    (beat) => beat.startFraction <= 0.02 && beat.spawnEndFraction - beat.startFraction <= 0.3,
  )
  // Anticipation-first archetype (spawn/telegraph spec): a continuous
  // anchor layer (ring/aura, window 1) opens the effect quietly and the
  // sharp climax lands LATE by design — Riot doctrine leads anticipation,
  // then overloads. Demanding a t=0 pop there would break the grammar.
  const hasAnticipationOpen =
    beats.some((beat) => beat.spawnEndFraction - beat.startFraction >= 1 && beat.startFraction === 0) &&
    sharpBeats.some((beat) => beat.startFraction >= 0.3)
  if (!microBurst && !hasOpeningBeat && !hasAnticipationOpen) {
    findings.push('no opening beat: nothing short and sharp owns the first instant (flash/spark pop)')
  }
  // Resolution must LINGER: a beat that starts meaningfully after the
  // opening AND whose particles die late (using the shader's real duration
  // math), so the event hands off instead of just stopping. Absolute
  // window/life thresholds mis-graded honest small-effect resolutions.
  const hasResolutionBeat = beats.some((beat) => {
    const window = Math.min(1, Math.max(0, beat.spawnEndFraction - beat.startFraction))
    // Continuous emission (long spawn window) inherently lingers — trails
    // and streams resolve by construction.
    if (window >= 0.35 && window < 1) return true
    const deathFraction = beat.spawnEndFraction + 0.85 * 1.3 * beat.lifeScale * (1 - window)
    return beat.startFraction >= 0.1 && deathFraction >= 0.75
  })
  if (!hasResolutionBeat) {
    findings.push('no resolution beat: nothing inherits the energy late (smoke/residue handoff) — the event just stops')
  }
  return { effectId: plan.effectId, kind: 'burst', beats, findings, passed: findings.length === 0 }
}

export function createPfxPeakLiveParticles(preset: PfxPreset): number {
  const plan = getPfxRenderPlan(preset)
  const cycleScale = plan.feelVersion >= 2 ? getPfxCycleScale(plan.surfaces) : 1
  const steps = 120
  const layers: Array<{ starts: number[]; ends: number[] }> = []
  for (const surface of plan.surfaces) {
    if (surface.kind !== 'particles' && surface.kind !== 'impact-sparks') continue
    const tuning = surface.tuning ?? {}
    const emission = createPfxParticleEmission(preset, surface)
    const window = emission.emissionWindow
    const delay = tuning.delay ?? 0
    const starts: number[] = []
    const ends: number[] = []
    for (let index = 0; index < emission.count; index += 1) {
      const spawnFraction = emission.life[index * 2]! + delay
      if (window >= 1) {
        // Continuous loops: treat as always alive (conservative).
        starts.push(0)
        ends.push(cycleScale)
        continue
      }
      const durationFraction = Math.max(0.1, emission.life[index * 2 + 1]! * (1 - window) * 0.85)
      starts.push(spawnFraction)
      ends.push(spawnFraction + durationFraction)
    }
    layers.push({ starts, ends })
  }
  let peak = 0
  for (let step = 0; step <= steps; step += 1) {
    const t = (step / steps) * cycleScale
    let alive = 0
    for (const layer of layers) {
      for (let index = 0; index < layer.starts.length; index += 1) {
        if (t >= layer.starts[index]! && t <= layer.ends[index]!) alive += 1
      }
    }
    peak = Math.max(peak, alive)
  }
  return peak
}

export function createPfxEstimatedFrameCostMs(preset: PfxPreset): number {
  const plan = getPfxRenderPlan(preset)
  const peakLive = createPfxPeakLiveParticles(preset)
  return roundMetric(0.05 + plan.estimatedDrawCalls * 0.06 + peakLive * 0.007)
}

export function createPfxGroupReadinessReport(effectIds: readonly string[]): PfxGroupReadinessReport {
  const rows = effectIds.map((effectId): PfxGroupReadinessRow => {
    const preset = createPfxPreset(effectId)
    const plan = getPfxRenderPlan(preset)
    const choreography = createPfxChoreographyAudit({ effectId, surfaces: plan.surfaces }).findings
    // Render-read rules landed AFTER some groups were certified. Certified
    // recipes are locked (no re-authoring outside a user-approved pass), so
    // for them these rules report but do not block; they block everything
    // authored from now on.
    const grandfatheredRules = PFX_CERTIFIED_EFFECTS.has(effectId)
      ? new Set(['square-screen-plane', 'box-trail-ribbon', 'faint-cloud', 'angle-dependent-core', 'misplaced-origin'])
      : undefined
    const physics = createPfxEmitterPhysicsFindings(plan)
      .filter((finding) => !grandfatheredRules?.has(finding.rule))
      .map((finding) => `${finding.rule}: ${finding.phase}`)
    let simParticles = 0
    for (const surface of plan.surfaces) {
      if (surface.kind !== 'particles' && surface.kind !== 'impact-sparks') continue
      simParticles += createPfxParticleEmission(
        { effectId, controls: preset.controls, implementationProfile: preset.implementationProfile },
        surface,
      ).count
    }
    const peakLive = createPfxPeakLiveParticles(preset)
    const bufferWasteRatio = roundMetric(simParticles / Math.max(1, peakLive))
    const benchmark = createPfxMobileBenchmarkReport(preset)
    const lowEnd = benchmark.find((row) => row.deviceClass === 'low-end')!
    const mid = benchmark.find((row) => row.deviceClass === 'mid')!
    const blockers: string[] = []
    if (choreography.length > 0) blockers.push('choreography')
    if (physics.length > 0) blockers.push('physics')
    if (!lowEnd.passedSingle) blockers.push('low-end-single')
    if (!mid.passedSingle) blockers.push('mid-single')
    if (bufferWasteRatio > 3) blockers.push(`buffer-waste:${bufferWasteRatio}x`)
    // Particle CONCURRENCY is recipe-owned (unlike draw calls, which gate on
    // runtime instance-pooling): the low-end screen budget must survive x3.
    const lowEndBench = PFX_MOBILE_DEVICE_BENCHMARKS.find((b) => b.deviceClass === 'low-end')!
    if (peakLive * lowEndBench.concurrentLargeEffects > lowEndBench.maxLiveParticles) {
      blockers.push(`concurrent-particles:${peakLive * lowEndBench.concurrentLargeEffects}/${lowEndBench.maxLiveParticles}`)
    }
    return {
      effectId,
      choreographyFindings: choreography,
      physicsFindings: physics,
      simParticles,
      peakLiveParticles: peakLive,
      bufferWasteRatio,
      drawCalls: plan.estimatedDrawCalls,
      estimatedFrameCostMs: createPfxEstimatedFrameCostMs(preset),
      lowEndSingle: lowEnd.passedSingle,
      lowEndConcurrent: lowEnd.passedConcurrent,
      midSingle: mid.passedSingle,
      midConcurrent: mid.passedConcurrent,
      pass: blockers.length === 0,
      blockers,
    }
  })
  const blockedEffectIds = rows.filter((row) => !row.pass).map((row) => row.effectId)
  return {
    effectIds: [...effectIds],
    rows,
    passedCount: rows.length - blockedEffectIds.length,
    blockedEffectIds,
    pass: blockedEffectIds.length === 0,
  }
}

export function createPfxMobileBenchmarkReport(preset: PfxPreset): PfxMobileBenchmarkRow[] {
  const single = summarizePfxPerformance([preset])
  // Honest particle accounting: peak simultaneously-alive (shader-faithful),
  // not the crude budget estimate — choreographed beats never have every
  // particle alive at once.
  const peakLive = createPfxPeakLiveParticles(preset)
  const estimatedCostMs = createPfxEstimatedFrameCostMs(preset)
  return PFX_MOBILE_DEVICE_BENCHMARKS.map((benchmark) => {
    const findings: string[] = []
    const concurrency = benchmark.concurrentLargeEffects
    if (peakLive > benchmark.maxLiveParticles) {
      findings.push(`particles: ${peakLive} peak-live single-instance vs ${benchmark.maxLiveParticles} TOTAL screen budget`)
    } else if (peakLive * concurrency > benchmark.maxLiveParticles) {
      findings.push(
        `particles: ${peakLive * concurrency} peak-live at x${concurrency} concurrency vs ${benchmark.maxLiveParticles} budget`,
      )
    }
    if (single.totalDrawCalls > benchmark.maxVfxDrawCalls) {
      findings.push(`draw calls: ${single.totalDrawCalls} single-instance vs ${benchmark.maxVfxDrawCalls} VFX budget`)
    } else if (single.totalDrawCalls * concurrency > benchmark.maxVfxDrawCalls) {
      findings.push(
        `draw calls: ${single.totalDrawCalls * concurrency} at x${concurrency} concurrency vs ${benchmark.maxVfxDrawCalls} budget`,
      )
    }
    if (estimatedCostMs > benchmark.vfxGpuBudgetMs) {
      findings.push(`frame cost: ${estimatedCostMs}ms single-instance vs ${benchmark.vfxGpuBudgetMs}ms VFX budget`)
    } else if (estimatedCostMs * concurrency > benchmark.vfxGpuBudgetMs) {
      findings.push(
        `frame cost: ${roundMetric(estimatedCostMs * concurrency)}ms at x${concurrency} concurrency vs ${benchmark.vfxGpuBudgetMs}ms budget`,
      )
    }
    if (single.textureMemoryKb > benchmark.maxTextureMemoryKb) {
      findings.push(`texture: ${single.textureMemoryKb}KB vs ${benchmark.maxTextureMemoryKb}KB budget`)
    }
    const singleOver =
      peakLive > benchmark.maxLiveParticles ||
      single.totalDrawCalls > benchmark.maxVfxDrawCalls ||
      estimatedCostMs > benchmark.vfxGpuBudgetMs ||
      single.textureMemoryKb > benchmark.maxTextureMemoryKb
    return {
      deviceClass: benchmark.deviceClass,
      passedSingle: !singleOver,
      passedConcurrent: findings.length === 0,
      findings,
    }
  })
}

export function getPfxComputedMobileSafety(effectId: string): MobileSafety {
  const cached = computedMobileSafetyCache.get(effectId)
  if (cached) return cached
  const report = createPfxMobileBenchmarkReport(createPfxPreset(effectId))
  const lowEnd = report.find((row) => row.deviceClass === 'low-end')
  const mid = report.find((row) => row.deviceClass === 'mid')
  const safety: MobileSafety = lowEnd?.passedSingle ? 'safe' : mid?.passedSingle ? 'caution' : 'cinematic-only'
  computedMobileSafetyCache.set(effectId, safety)
  return safety
}
