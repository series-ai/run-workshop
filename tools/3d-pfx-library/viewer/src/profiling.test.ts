import { describe, expect, it } from 'vitest'
import * as profiling from './profiling'
import {
  PFX_MOBILE_RUNTIME_POLICY,
  PFX_PRESETS,
  createPfxProductionImplementationTemplate,
  createPfxRedTeamReviewTemplate,
  createPfxTaxonomyReviewTemplate,
} from '@pfx'
import {
  AUTHORED_PROFILE_SCENARIOS,
  CATALOG_STRESS_PROFILE_SCENARIOS,
  PROFILE_BACKED_PROFILE_SCENARIOS,
  PROFILE_SCENARIOS,
  collectInvalidPfxProductionApprovalProfileEvidence,
  countPfxDeltaPixels,
  collectInvalidPfxProductionApprovalRows,
  collectInvalidPfxProductionApprovalTextEvidence,
  collectMissingPfxProductionApprovalEvidencePaths,
  createPfxBrowserAcceptanceEvidence,
  createPfxEffectPerformanceEvidenceMatrix,
  createPfxRealDeviceCaptureAudit,
  createPfxRealDeviceCaptureBatchPlan,
  createPfxRealDeviceCaptureBatchSheet,
  createPfxRealDeviceCaptureBatchSheetIndex,
  createPfxRealDeviceCaptureBatchProgress,
  createPfxRedTeamBlockingReviewManifestFromRealDeviceAudit,
  createPfxTaxonomyReviewEvidence,
  validatePfxDefinitionOfDoneSmokeEvidence,
  exportPfxRealDeviceCaptureBatchSheetMarkdown,
  exportPfxRealDeviceCaptureBatchSheetIndexMarkdown,
  exportPfxRealDeviceCaptureBatchProgressMarkdown,
  exportPfxRealDeviceProfileCapturePlanMarkdown,
  createBrowserProfileReport,
  createExplicitEffectProfileScenarios,
  createPfxRealDeviceProfileCapturePlan,
  profileArtifactFileNameForScenario,
  profileCanvasFromScreenshot,
  normalizePfxProductionApprovals,
  resolveProfileScenarios,
  summarizeFrameSamples,
  validatePfxRealDeviceCaptureBatchSheetIndex,
  validatePfxRealDeviceCaptureAudit,
  verifyPfxMeasuredProfileEvidence,
  type BrowserProfileInput,
  type BrowserProfileReport,
  type ProfileScenarioDefinition,
} from './profiling'

describe('PFX browser profiling helpers', () => {
  it('exposes a unified per-effect quality matrix builder', () => {
    expect(profiling.createPfxQualityMatrix).toBeTypeOf('function')
  })

  it('exposes a human-readable quality matrix exporter', () => {
    expect(profiling.exportPfxQualityMatrixMarkdown).toBeTypeOf('function')
  })

  it('exposes a fail-closed catalog quality matrix baseline', () => {
    expect(profiling.createPfxQualityMatrixBaseline).toBeTypeOf('function')
  })

  it('exposes a deterministic visual lifecycle schedule builder', () => {
    expect(profiling.createPfxVisualLifecycleSchedule).toBeTypeOf('function')
  })

  it('makes uncapped simulation opt-in and labels its scheduling overrides deterministically', () => {
    expect(profiling.createPfxUncappedSimulationLaunchArgs(false)).toEqual([])
    expect(profiling.createPfxUncappedSimulationLaunchArgs(true)).toEqual([
      '--disable-frame-rate-limit',
      '--disable-gpu-vsync',
    ])
    expect(profiling.createPfxSimulationWarmupFrameCount(false)).toBe(30)
    expect(profiling.createPfxSimulationWarmupFrameCount(true)).toBe(120)
    expect(profiling.createPfxSimulationScenarioWarmupPasses(false)).toBe(0)
    expect(profiling.createPfxSimulationScenarioWarmupPasses(true)).toBe(1)
  })

  it('uses the available contact-sheet width for small visual-review batches', () => {
    expect(profiling.pfxQualityReviewContactSheetColumns(1)).toBe(1)
    expect(profiling.pfxQualityReviewContactSheetColumns(3)).toBe(3)
    expect(profiling.pfxQualityReviewContactSheetColumns(25)).toBe(5)
  })

  it('derives one bounded isolated-review camera distance from effect-only foreground pixels', () => {
    const pixels = new Uint8Array(100 * 100 * 4)
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 17
      pixels[index + 1] = 24
      pixels[index + 2] = 39
      pixels[index + 3] = 255
    }
    for (let y = 45; y < 55; y += 1) {
      for (let x = 40; x < 60; x += 1) {
        const index = (y * 100 + x) * 4
        pixels[index] = 255
        pixels[index + 1] = 150
        pixels[index + 2] = 20
      }
    }

    expect(profiling.createPfxReviewCameraDistance(pixels, 100, 100)).toBeCloseTo(2.31, 2)
    expect(profiling.createPfxReviewCameraDistance(new Uint8Array(100 * 100 * 4), 100, 100)).toBe(5.2)

    const tinyPixels = new Uint8Array(pixels.length)
    for (let y = 49; y < 51; y += 1) {
      for (let x = 49; x < 51; x += 1) {
        const index = (y * 100 + x) * 4
        tinyPixels[index] = 255
        tinyPixels[index + 1] = 150
        tinyPixels[index + 2] = 20
        tinyPixels[index + 3] = 255
      }
    }
    expect(profiling.createPfxReviewCameraDistance(tinyPixels, 100, 100)).toBe(1.2)

    const offCenterPixels = new Uint8Array(pixels.length)
    for (let y = 4; y < 14; y += 1) {
      for (let x = 45; x < 55; x += 1) {
        const index = (y * 100 + x) * 4
        offCenterPixels[index] = 255
        offCenterPixels[index + 1] = 150
        offCenterPixels[index + 2] = 20
        offCenterPixels[index + 3] = 255
      }
    }
    expect(profiling.createPfxReviewCameraDistance(offCenterPixels, 100, 100)).toBeGreaterThan(8 * 0.8)
  })

  it('counts visible dark smoke by background delta instead of a bright-pixel cutoff', () => {
    const pixels = new Uint8Array(10 * 10 * 4)
    for (let index = 0; index < pixels.length; index += 4) {
      pixels[index] = 17
      pixels[index + 1] = 24
      pixels[index + 2] = 39
      pixels[index + 3] = 255
    }
    for (let pixel = 0; pixel < 12; pixel += 1) {
      const index = pixel * 4
      pixels[index] = 42
      pixels[index + 1] = 48
      pixels[index + 2] = 61
    }

    expect(profiling.countPfxReviewActivePixels(pixels, 10, 10)).toBe(12)
    expect(profiling.countPfxReviewActivePixels(new Uint8Array(pixels.length), 10, 10)).toBe(0)
  })

  it('selects distinct onset, peak, and decay moments from aggregate multi-angle activity', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 120, aggregateActivePixels: 900 },
      { sampleMs: 320, aggregateActivePixels: 1_200 },
      { sampleMs: 620, aggregateActivePixels: 2_400 },
      { sampleMs: 920, aggregateActivePixels: 300 },
    ])

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 120, aggregateActivePixels: 900 },
      { phase: 'peak', sampleMs: 620, aggregateActivePixels: 2_400 },
      { phase: 'decay', sampleMs: 920, aggregateActivePixels: 300 },
    ])
    expect(new Set(schedule.map((sample) => sample.sampleMs)).size).toBe(3)
  })

  it('captures a persistent loop baseline, first alarm crest, and recovered trough instead of adjacent one-shot frames', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { persistentLoop?: boolean; burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 13_019 },
      { sampleMs: 40, aggregateActivePixels: 14_135 },
      { sampleMs: 80, aggregateActivePixels: 20_060 },
      { sampleMs: 120, aggregateActivePixels: 21_847 },
      { sampleMs: 200, aggregateActivePixels: 21_374 },
      { sampleMs: 320, aggregateActivePixels: 18_263 },
      { sampleMs: 620, aggregateActivePixels: 13_040 },
      { sampleMs: 920, aggregateActivePixels: 22_032 },
    ], { persistentLoop: true, burstCycleMs: 3_471 })

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 13_019 },
      { phase: 'peak', sampleMs: 120, aggregateActivePixels: 21_847 },
      { phase: 'decay', sampleMs: 620, aggregateActivePixels: 13_040 },
    ])
  })

  it('does not mistake a descending high-coverage loop shoulder for the next crest', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { persistentLoop?: boolean; burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 18_123 },
      { sampleMs: 40, aggregateActivePixels: 19_048 },
      { sampleMs: 80, aggregateActivePixels: 21_934 },
      { sampleMs: 120, aggregateActivePixels: 22_397 },
      { sampleMs: 200, aggregateActivePixels: 21_950 },
      { sampleMs: 320, aggregateActivePixels: 21_442 },
      { sampleMs: 620, aggregateActivePixels: 18_193 },
      { sampleMs: 920, aggregateActivePixels: 22_629 },
    ], { persistentLoop: true, burstCycleMs: 3_471 })

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 18_123 },
      { phase: 'peak', sampleMs: 120, aggregateActivePixels: 22_397 },
      { phase: 'decay', sampleMs: 620, aggregateActivePixels: 18_193 },
    ])
  })

  it('ignores sub-percent capture noise before a persistent loop reaches its authored crest', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { persistentLoop?: boolean; burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 61_275 },
      { sampleMs: 40, aggregateActivePixels: 61_330 },
      { sampleMs: 80, aggregateActivePixels: 61_321 },
      { sampleMs: 120, aggregateActivePixels: 61_400 },
      { sampleMs: 200, aggregateActivePixels: 61_500 },
      { sampleMs: 320, aggregateActivePixels: 61_700 },
      { sampleMs: 620, aggregateActivePixels: 62_000 },
      { sampleMs: 920, aggregateActivePixels: 62_500 },
      { sampleMs: 3_186, aggregateActivePixels: 66_000 },
      { sampleMs: 3_753, aggregateActivePixels: 66_500 },
      { sampleMs: 4_036, aggregateActivePixels: 67_500 },
      { sampleMs: 4_319, aggregateActivePixels: 65_000 },
      { sampleMs: 5_452, aggregateActivePixels: 64_000 },
    ], { persistentLoop: true, burstCycleMs: 6_990 })

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 61_275 },
      { phase: 'peak', sampleMs: 4_036, aggregateActivePixels: 67_500 },
      { phase: 'decay', sampleMs: 5_452, aggregateActivePixels: 64_000 },
    ])
  })

  it('ignores an early minor local crest when a persistent loop has a much stronger authored swell later', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { persistentLoop?: boolean; burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 17_416 },
      { sampleMs: 40, aggregateActivePixels: 17_390 },
      { sampleMs: 80, aggregateActivePixels: 17_417 },
      { sampleMs: 120, aggregateActivePixels: 17_157 },
      { sampleMs: 200, aggregateActivePixels: 17_425 },
      { sampleMs: 320, aggregateActivePixels: 18_241 },
      { sampleMs: 620, aggregateActivePixels: 21_412 },
      { sampleMs: 920, aggregateActivePixels: 20_103 },
    ], { persistentLoop: true, burstCycleMs: 7_741 })

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 120, aggregateActivePixels: 17_157 },
      { phase: 'peak', sampleMs: 620, aggregateActivePixels: 21_412 },
      { phase: 'decay', sampleMs: 920, aggregateActivePixels: 20_103 },
    ])
  })

  it('retries a zero-coverage sample only for a persistent loop capture', () => {
    expect(profiling.shouldRetryPfxPersistentLoopSample('loop', 0)).toBe(true)
    expect(profiling.shouldRetryPfxPersistentLoopSample('loop', 1)).toBe(false)
    expect(profiling.shouldRetryPfxPersistentLoopSample('burst', 0)).toBe(false)
  })

  it('samples decay while a short-lived burst still has visible residue instead of an empty stage', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    // Muzzle-flash-like arc: dead by 320ms, ambient floor ~2000. A decay cell
    // at 920ms photographs an empty stage and fails the temporal-arc review.
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 2_000 },
      { sampleMs: 40, aggregateActivePixels: 9_000 },
      { sampleMs: 120, aggregateActivePixels: 2_800 },
      { sampleMs: 320, aggregateActivePixels: 2_100 },
      { sampleMs: 620, aggregateActivePixels: 2_000 },
      { sampleMs: 920, aggregateActivePixels: 2_000 },
    ])
    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 2_000 },
      { phase: 'peak', sampleMs: 40, aggregateActivePixels: 9_000 },
      { phase: 'decay', sampleMs: 120, aggregateActivePixels: 2_800 },
    ])
  })

  it('keeps decay temporally distinct from a refined peak shoulder', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    // A refinement pass can find 50ms and 60ms samples immediately after a
    // 40ms peak. Those are still the peak shoulder, not a readable decay beat.
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 2_763 },
      { sampleMs: 40, aggregateActivePixels: 6_329 },
      { sampleMs: 50, aggregateActivePixels: 4_070 },
      { sampleMs: 60, aggregateActivePixels: 2_218 },
      { sampleMs: 80, aggregateActivePixels: 2_233 },
      { sampleMs: 120, aggregateActivePixels: 2_158 },
      { sampleMs: 200, aggregateActivePixels: 2_123 },
      { sampleMs: 320, aggregateActivePixels: 2_123 },
    ])

    expect(schedule.find((sample) => sample.phase === 'decay')).toEqual({
      phase: 'decay',
      sampleMs: 80,
      aggregateActivePixels: 2_233,
    })
  })

  it('selects decay before the next repeated burst cycle', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 900 },
      { sampleMs: 40, aggregateActivePixels: 4_887 },
      { sampleMs: 120, aggregateActivePixels: 1_464 },
      { sampleMs: 320, aggregateActivePixels: 694 },
      { sampleMs: 620, aggregateActivePixels: 4_500 },
      { sampleMs: 920, aggregateActivePixels: 694 },
    ])

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 900 },
      { phase: 'peak', sampleMs: 40, aggregateActivePixels: 4_887 },
      { phase: 'decay', sampleMs: 120, aggregateActivePixels: 1_464 },
    ])
  })

  it('bounds decay selection to the declared burst cycle when residue never reaches the ambient floor', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 363 },
      { sampleMs: 40, aggregateActivePixels: 5_362 },
      { sampleMs: 80, aggregateActivePixels: 5_100 },
      { sampleMs: 120, aggregateActivePixels: 4_900 },
      { sampleMs: 200, aggregateActivePixels: 4_700 },
      { sampleMs: 320, aggregateActivePixels: 4_497 },
      { sampleMs: 620, aggregateActivePixels: 5_200 },
      { sampleMs: 920, aggregateActivePixels: 4_497 },
    ], { burstCycleMs: 545 })

    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 0, aggregateActivePixels: 363 },
      { phase: 'peak', sampleMs: 40, aggregateActivePixels: 5_362 },
      { phase: 'decay', sampleMs: 320, aggregateActivePixels: 4_497 },
    ])
  })

  it('selects the first readable post-peak descent instead of the last near-extinguished residue', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    // Hit-spark-like arc: 200ms is the authored recovery beat at ~18% of
    // peak; 320ms is merely the last barely-active tail before extinction.
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 273 },
      { sampleMs: 40, aggregateActivePixels: 2_285 },
      { sampleMs: 80, aggregateActivePixels: 2_418 },
      { sampleMs: 120, aggregateActivePixels: 1_844 },
      { sampleMs: 200, aggregateActivePixels: 436 },
      { sampleMs: 320, aggregateActivePixels: 250 },
      { sampleMs: 482, aggregateActivePixels: 9 },
      { sampleMs: 620, aggregateActivePixels: 327 },
    ], { burstCycleMs: 619 })

    expect(schedule.find((sample) => sample.phase === 'decay')).toEqual({
      phase: 'decay',
      sampleMs: 200,
      aggregateActivePixels: 436,
    })
  })

  it('captures the authored handoff while a shrinking afterglow still connects peak to residue', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 637 },
      { sampleMs: 40, aggregateActivePixels: 1_353 },
      { sampleMs: 80, aggregateActivePixels: 2_371 },
      { sampleMs: 120, aggregateActivePixels: 2_511 },
      { sampleMs: 200, aggregateActivePixels: 1_503 },
      { sampleMs: 320, aggregateActivePixels: 202 },
      { sampleMs: 418, aggregateActivePixels: 0 },
    ], { burstCycleMs: 536 })

    expect(schedule.find((sample) => sample.phase === 'decay')).toEqual({
      phase: 'decay',
      sampleMs: 200,
      aggregateActivePixels: 1_503,
    })
  })

  it('keeps a structured particle handoff when it remains just under seventy percent of peak', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { burstCycleMs?: number },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 1_758 },
      { sampleMs: 40, aggregateActivePixels: 3_862 },
      { sampleMs: 80, aggregateActivePixels: 6_233 },
      { sampleMs: 120, aggregateActivePixels: 6_051 },
      { sampleMs: 200, aggregateActivePixels: 4_244 },
      { sampleMs: 320, aggregateActivePixels: 555 },
      { sampleMs: 418, aggregateActivePixels: 0 },
    ], { burstCycleMs: 536 })

    expect(schedule.find((sample) => sample.phase === 'decay')).toEqual({
      phase: 'decay',
      sampleMs: 200,
      aggregateActivePixels: 4_244,
    })
  })

  it('keeps an early decisive flash as peak when a larger smoke lobe follows', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { preferEarlyImpulse?: boolean },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    // Muzzle-flash-like arc after dark smoke became visible to the activity
    // detector: the sharp 40ms impulse is the semantic peak. The broader,
    // higher-area smoke lobe at 200ms belongs to the handoff/decay beat.
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 492 },
      { sampleMs: 40, aggregateActivePixels: 1_689 },
      { sampleMs: 80, aggregateActivePixels: 1_358 },
      { sampleMs: 120, aggregateActivePixels: 2_766 },
      { sampleMs: 200, aggregateActivePixels: 4_302 },
      { sampleMs: 320, aggregateActivePixels: 3_027 },
      { sampleMs: 620, aggregateActivePixels: 731 },
      { sampleMs: 920, aggregateActivePixels: 104 },
    ], { preferEarlyImpulse: true })

    expect(schedule.find((sample) => sample.phase === 'peak')).toEqual({
      phase: 'peak',
      sampleMs: 40,
      aggregateActivePixels: 1_689,
    })
  })

  it('selects a partial-break action frame for destructive effects instead of the intact maximum-area frame', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
      options?: { preferDestructiveTransition?: boolean },
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 13_000 },
      { sampleMs: 40, aggregateActivePixels: 16_500 },
      { sampleMs: 80, aggregateActivePixels: 16_000 },
      { sampleMs: 120, aggregateActivePixels: 15_000 },
      { sampleMs: 200, aggregateActivePixels: 13_000 },
      { sampleMs: 320, aggregateActivePixels: 9_000 },
      { sampleMs: 620, aggregateActivePixels: 500 },
    ], { preferDestructiveTransition: true })
    expect(schedule.map(({ phase, sampleMs }) => ({ phase, sampleMs }))).toEqual([
      { phase: 'onset', sampleMs: 0 },
      { phase: 'peak', sampleMs: 200 },
      { phase: 'decay', sampleMs: 320 },
    ])
  })

  it('requests an adaptive sample between a late burst peak and the first quiet frame', () => {
    const selectRefinement = profiling.selectPfxVisualLifecycleRefinementTime as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => number | null
    const coarse = [
      { sampleMs: 0, aggregateActivePixels: 2_000 },
      { sampleMs: 40, aggregateActivePixels: 6_000 },
      { sampleMs: 80, aggregateActivePixels: 9_000 },
      { sampleMs: 120, aggregateActivePixels: 12_000 },
      { sampleMs: 200, aggregateActivePixels: 2_000 },
      { sampleMs: 320, aggregateActivePixels: 2_000 },
    ]

    expect(selectRefinement(coarse)).toBe(160)
    expect(selectRefinement([...coarse, { sampleMs: 160, aggregateActivePixels: 2_100 }])).toBe(140)
    expect(selectRefinement([
      ...coarse,
      { sampleMs: 140, aggregateActivePixels: 4_000 },
      { sampleMs: 160, aggregateActivePixels: 2_100 },
    ])).toBeNull()
  })

  it('samples onset after spawn for slow-building effects instead of an empty stage', () => {
    const createSchedule = profiling.createPfxVisualLifecycleSchedule as unknown as (
      samples: Array<{ sampleMs: number; aggregateActivePixels: number }>,
    ) => Array<{ phase: string; sampleMs: number; aggregateActivePixels: number }>
    // Smoke-puff-like arc: nothing spawned at 0ms; onset must show the build.
    const schedule = createSchedule([
      { sampleMs: 0, aggregateActivePixels: 700 },
      { sampleMs: 40, aggregateActivePixels: 1_500 },
      { sampleMs: 120, aggregateActivePixels: 2_600 },
      { sampleMs: 320, aggregateActivePixels: 2_743 },
      { sampleMs: 620, aggregateActivePixels: 1_400 },
      { sampleMs: 920, aggregateActivePixels: 700 },
    ])
    expect(schedule).toEqual([
      { phase: 'onset', sampleMs: 40, aggregateActivePixels: 1_500 },
      { phase: 'peak', sampleMs: 320, aggregateActivePixels: 2_743 },
      { phase: 'decay', sampleMs: 620, aggregateActivePixels: 1_400 },
    ])
  })

  it('exposes a fail-closed capture DOM health validator', () => {
    expect(profiling.collectPfxCaptureDomDefects).toBeTypeOf('function')
  })

  it('rejects capture frames whose DOM has broken images, unloaded images, or an error overlay', () => {
    const collect = profiling.collectPfxCaptureDomDefects as unknown as (snapshot: {
      images: Array<{ src: string; complete: boolean; naturalWidth: number }>
      errorOverlayCount: number
    }) => string[]

    expect(collect({ images: [], errorOverlayCount: 0 })).toEqual([])
    expect(
      collect({ images: [{ src: 'http://127.0.0.1:4765/sprite.png', complete: true, naturalWidth: 128 }], errorOverlayCount: 0 }),
    ).toEqual([])
    expect(
      collect({ images: [{ src: 'http://127.0.0.1:4765/broken.png', complete: true, naturalWidth: 0 }], errorOverlayCount: 0 }),
    ).toEqual(['broken image in capture DOM: http://127.0.0.1:4765/broken.png'])
    expect(
      collect({ images: [{ src: 'http://127.0.0.1:4765/pending.png', complete: false, naturalWidth: 0 }], errorOverlayCount: 0 }),
    ).toEqual(['image still loading in capture DOM: http://127.0.0.1:4765/pending.png'])
    expect(collect({ images: [], errorOverlayCount: 2 })).toEqual(['dev-server error overlay visible in capture DOM (2)'])
  })

  it('assembles accepted peer reviews and capture references into visual review inputs deterministically', () => {
    const assembleRaw = profiling.assemblePfxQualityMatrixVisualReviews as unknown as (
      sources: Array<{ review: unknown; manifest: unknown }>,
      options?: {
        reducedMotionReadableEffectIds?: readonly string[]
        currentSourceFingerprint?: string
        currentSourceFingerprints?: Readonly<Record<string, string>>
      },
    ) => Array<Record<string, unknown>>
    const assemble = (
      sources: Array<{ review: unknown; manifest: unknown }>,
      options: { reducedMotionReadableEffectIds?: readonly string[]; currentSourceFingerprint?: string } = {},
    ) => assembleRaw(sources, { currentSourceFingerprint: 'sha256:current-render-source', ...options })

    const manifest = {
      schema: 'game-bot.r3f-pfx-visual-capture-batch.v3',
      batchId: 'quality-review-test',
      sourceFingerprint: 'sha256:current-render-source',
      effects: [
        {
          effectId: 'fireball',
          lifecycleCaptures: (['front', 'three-quarter', 'side'] as const).flatMap((angle) =>
            (['onset', 'peak', 'decay'] as const).map((phase) => ({
              angle,
              phase,
              file: `.context/r3f-pfx-quality-review/quality-review-test/001-fireball-${phase}-${angle}.png`,
            })),
          ),
          gameplayContextCaptures: [{
            angle: 'three-quarter' as const,
            phase: 'peak' as const,
            file: '.context/r3f-pfx-quality-review/quality-review-test/001-fireball-gameplay-context-peak-three-quarter.png',
          }],
        },
      ],
    }
    const review = {
      schema: 'game-bot.r3f-pfx-peer-visual-review.v1',
      batchId: 'quality-review-test',
      peerRuntime: 'claude',
      independentRuntime: true,
      effects: [
        {
          effectId: 'fireball',
          scores: {
            SEMANTIC_IDENTITY: 5,
            GAMEPLAY_READABILITY: 5,
            VOLUME_AND_DEPTH: 5,
            MULTI_ANGLE_RESILIENCE: 5,
            SILHOUETTE_AND_COMPOSITION: 5,
            TEMPORAL_ARC_AND_DECAY: 5,
            MATERIAL_AND_SHADER_QUALITY: 5,
            MESH_STRUCTURE_AND_EMITTER_QUALITY: 5,
            CC0_ASSET_INTEGRATION: 5,
            DISTINCTIVENESS_AND_RING_DISCIPLINE: 5,
            SCALE_AND_VISUAL_HIERARCHY: 5,
            OVERALL_PRODUCTION_POLISH: 5,
          },
          reviewerConfidence: 0.9,
          grade: 'A+',
          verdict: 'pass',
          findings: [],
        },
      ],
    }

    const rows = assemble([{ review, manifest }], { currentSourceFingerprint: 'sha256:current-render-source' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      effectId: 'fireball',
      reviewer: 'peer:claude',
      reviewerConfidence: 0.9,
      reducedMotionReadable: false,
      scores: { semanticIdentity: 5, overallProductionPolish: 5 },
    })
    expect((rows[0]!['cameraEvidence'] as Record<string, string[]>)['threeQuarter']).toHaveLength(3)
    expect((rows[0]!['lifecycleEvidence'] as Record<string, string[]>)['decay']).toHaveLength(3)
    expect(rows[0]!['gameplayContextEvidence']).toEqual([
      '.context/r3f-pfx-quality-review/quality-review-test/001-fireball-gameplay-context-peak-three-quarter.png',
    ])
    // Reduced-motion readability is separate evidence; without it the row must
    // stay fail-closed with an explicit blocker.
    expect(rows[0]!['blockers']).toEqual(['reduced-motion readability unverified'])

    const perEffectManifest = {
      ...manifest,
      sourceFingerprint: 'sha256:stale-global-source',
      effects: [{ ...manifest.effects[0]!, sourceFingerprint: 'sha256:current-fireball-source' }],
    }
    expect(assembleRaw([{ review, manifest: perEffectManifest }], {
      currentSourceFingerprints: { fireball: 'sha256:current-fireball-source' },
    })).toHaveLength(1)
    expect(() => assembleRaw([{ review, manifest: perEffectManifest }], {
      currentSourceFingerprints: { fireball: 'sha256:newer-fireball-source' },
    })).toThrow(/stale|fingerprint/i)

    const readableRows = assemble([{ review, manifest }], {
      reducedMotionReadableEffectIds: ['fireball'],
      currentSourceFingerprint: 'sha256:current-render-source',
    })
    expect(readableRows[0]).toMatchObject({ reducedMotionReadable: true, blockers: [] })

    const reworkReview = {
      ...review,
      effects: [{ ...review.effects[0]!, grade: 'C', verdict: 'rework', findings: ['flat fin'] }],
    }
    expect(assemble([{ review: reworkReview, manifest }])[0]!['blockers']).toEqual([
      'peer verdict: rework',
      'flat fin',
      'reduced-motion readability unverified',
    ])

    expect(() => assemble([{ review: { ...review, independentRuntime: false }, manifest }])).toThrow(
      /independent/i,
    )
    expect(() => assemble([{ review: { ...review, batchId: 'other-batch' }, manifest }])).toThrow(/batchId/i)
    expect(() =>
      assemble([
        { review, manifest },
        { review, manifest },
      ]),
    ).toThrow(/duplicate/i)
    const missingCell = {
      ...manifest,
      effects: [{ effectId: 'fireball', lifecycleCaptures: manifest.effects[0]!.lifecycleCaptures.slice(0, 8) }],
    }
    expect(() => assemble([{ review, manifest: missingCell }])).toThrow(/capture/i)
    const missingGameplayContext = {
      ...manifest,
      effects: [{ ...manifest.effects[0]!, gameplayContextCaptures: [] }],
    }
    expect(() => assemble([{ review, manifest: missingGameplayContext }])).toThrow(/gameplay.context/i)
  })

  it('rejects stale visual evidence captured from a different render-source fingerprint', () => {
    const assemble = profiling.assemblePfxQualityMatrixVisualReviews as unknown as (
      sources: Array<{ review: unknown; manifest: unknown }>,
      options: { currentSourceFingerprint: string },
    ) => unknown
    const manifest = {
      schema: 'game-bot.r3f-pfx-visual-capture-batch.v3',
      batchId: 'stale-review',
      sourceFingerprint: 'sha256:old-render-source',
      effects: [],
    }
    const review = {
      schema: 'game-bot.r3f-pfx-peer-visual-review.v1',
      batchId: 'stale-review',
      peerRuntime: 'claude',
      independentRuntime: true,
      effects: [],
    }

    expect(() => assemble([{ review, manifest }], {
      currentSourceFingerprint: 'sha256:current-render-source',
    })).toThrow(/stale|fingerprint/i)
  })

  it('requires three fresh peer reviews and uses a median consensus without hiding material disagreement', () => {
    const assembleConsensus = profiling.assemblePfxQualityMatrixVisualReviewConsensus as unknown as (
      sources: Array<{ review: unknown; manifest: unknown }>,
      options: { currentSourceFingerprint: string },
    ) => Array<Record<string, any>>
    const dimensions = [
      'SEMANTIC_IDENTITY',
      'GAMEPLAY_READABILITY',
      'VOLUME_AND_DEPTH',
      'MULTI_ANGLE_RESILIENCE',
      'SILHOUETTE_AND_COMPOSITION',
      'TEMPORAL_ARC_AND_DECAY',
      'MATERIAL_AND_SHADER_QUALITY',
      'MESH_STRUCTURE_AND_EMITTER_QUALITY',
      'CC0_ASSET_INTEGRATION',
      'DISTINCTIVENESS_AND_RING_DISCIPLINE',
      'SCALE_AND_VISUAL_HIERARCHY',
      'OVERALL_PRODUCTION_POLISH',
    ]
    const source = (batchId: string, score: number, verdict: 'pass' | 'rework' = 'pass') => ({
      review: {
        schema: 'game-bot.r3f-pfx-peer-visual-review.v1',
        batchId,
        peerRuntime: 'claude',
        independentRuntime: true,
        effects: [{
          effectId: 'muzzle-flash',
          scores: Object.fromEntries(dimensions.map((dimension) => [dimension, score])),
          reviewerConfidence: score / 5,
          grade: score >= 5 ? 'A+' : score >= 4 ? 'A' : score >= 3 ? 'B' : 'D',
          verdict,
          findings: verdict === 'rework' ? [`${batchId} needs rework`] : [],
        }],
      },
      manifest: {
        schema: 'game-bot.r3f-pfx-visual-capture-batch.v3',
        batchId,
        sourceFingerprint: 'sha256:current-muzzle',
        effects: [{
          effectId: 'muzzle-flash',
          lifecycleCaptures: (['front', 'three-quarter', 'side'] as const).flatMap((angle) =>
            (['onset', 'peak', 'decay'] as const).map((phase) => ({
              angle,
              phase,
              file: `${batchId}-${phase}-${angle}.png`,
            })),
          ),
          gameplayContextCaptures: [{
            angle: 'three-quarter' as const,
            phase: 'peak' as const,
            file: `${batchId}-gameplay-context-peak-three-quarter.png`,
          }],
        }],
      },
    })
    const options = { currentSourceFingerprint: 'sha256:current-muzzle' }

    expect(assembleConsensus([source('review-1', 4)], options)).toEqual([])
    const stable = assembleConsensus([
      source('review-3', 5),
      source('review-1', 4),
      source('review-2', 4),
    ], options)
    expect(stable).toHaveLength(1)
    expect(stable[0]).toMatchObject({
      effectId: 'muzzle-flash',
      reviewer: 'peer-consensus:claude',
      reviewerConfidence: 0.8,
      scores: { semanticIdentity: 4, overallProductionPolish: 4 },
    })
    expect(stable[0]!.blockers).not.toContainEqual(expect.stringMatching(/disagreement/i))
    expect(stable[0]!.cameraEvidence.front[0]).toContain('review-3')

    const disputed = assembleConsensus([
      source('review-1', 3, 'rework'),
      source('review-2', 4),
      source('review-3', 5),
    ], options)
    expect(disputed[0]!.scores.semanticIdentity).toBe(4)
    expect(disputed[0]!.blockers).toContainEqual(expect.stringMatching(/consensus disagreement/i))

    const majorityRework = assembleConsensus([
      source('review-1', 3, 'rework'),
      source('review-2', 3, 'rework'),
      source('review-3', 4),
    ], options)
    expect(majorityRework[0]!.blockers).toContain('peer consensus verdict: rework')
  })

  it('assembles paired real-device reports into scored matrix performance evidence', () => {
    const assemble = profiling.assemblePfxQualityMatrixPerformanceReviews as unknown as (
      sources: Array<{ report: BrowserProfileReport; evidence: string }>,
      devices: unknown,
    ) => Array<Record<string, any>>
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safari = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const android = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const expectedConcurrency = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[
      PFX_PRESETS.find((preset) => preset.effectId === 'fireball')!.performance.tier
    ]

    const rows = assemble([
      { report: safari, evidence: '.context/mobile-safari/fireball.json' },
      { report: android, evidence: '.context/chrome-android/fireball.json' },
    ], {
      schema: 'game-bot.r3f-pfx-quality-device-registry.v1',
      platforms: {
        'mobile-safari': { deviceLabel: safari.capture.deviceLabel, modelYear: 2023 },
        'chrome-android': { deviceLabel: android.capture.deviceLabel, modelYear: 2023 },
      },
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      effectId: 'fireball',
      mobileSafari: {
        platform: 'mobile-safari',
        modelYear: 2023,
        concurrency: expectedConcurrency,
        sustainedDurationSeconds: 180,
        evidence: '.context/mobile-safari/fireball.json',
      },
      chromeAndroid: {
        platform: 'chrome-android',
        modelYear: 2023,
        concurrency: expectedConcurrency,
        sustainedDurationSeconds: 180,
        evidence: '.context/chrome-android/fireball.json',
      },
      blockers: [],
    })
    expect(Object.values(rows[0].scores).every((score) => Number(score) >= 3)).toBe(true)
  })

  it('builds baseline rows for all 500 effects without fabricating grades, reviews, or device results', () => {
    const matrix = profiling.createPfxQualityMatrixBaseline()

    expect(matrix.summary).toEqual({ totalEffects: 500, visualPasses: 0, performancePasses: 0, finalPasses: 0 })
    expect(matrix.effects).toHaveLength(500)
    expect(matrix.effects[0]).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      originalGrade: null,
      afterGrade: null,
      performanceTier: PFX_PRESETS[0].performance.tier,
      scores: {},
      weightedScore: null,
      visualPass: false,
      performancePass: false,
      finalPass: false,
    })
    expect(matrix.effects[0].blockers).toEqual(expect.arrayContaining([
      'missing isolated visual review',
      'missing measured mobile Safari and Chrome Android review',
      'one or more of the 16 required quality scores are missing or invalid',
    ]))
    expect(matrix.effects[0].blockers).not.toContain('missing independently reviewed before grade')
    expect(new Set(matrix.effects.map((effect) => effect.effectId)).size).toBe(500)
  })

  it('assigns A+ to ranks 1-50 and A to ranks 51-500 as non-negotiable acceptance targets', () => {
    const matrix = profiling.createPfxQualityMatrixBaseline()
    const effects = matrix.effects as Array<{
      targetGrade: string
      requiredQualityThreshold: {
        minimumVisualDimension: number
        minimumWeightedScore: number
        performanceHeadroomRequired: boolean
      }
    }>

    expect(effects[0]).toMatchObject({
      targetGrade: 'A+',
      requiredQualityThreshold: {
        minimumVisualDimension: 4,
        minimumWeightedScore: 4.7,
        performanceHeadroomRequired: true,
      },
    })
    expect(effects[49].targetGrade).toBe('A+')
    expect(effects[50]).toMatchObject({
      targetGrade: 'A',
      requiredQualityThreshold: {
        minimumVisualDimension: 4,
        minimumWeightedScore: 4,
        performanceHeadroomRequired: true,
      },
    })
    expect(effects[499].targetGrade).toBe('A')
  })

  it('derives the 500-effect improvement ledger from the fail-closed quality matrix', () => {
    const ledger = profiling.createPfxQualityImprovementLedgerFromMatrix(
      profiling.createPfxQualityMatrixBaseline(),
      1,
    )

    expect(ledger.effects).toHaveLength(500)
    expect(ledger.summary).toMatchObject({
      iteration: 1,
      targetPasses: 0,
      worstVisualScore: 0,
      weightedScore: 0,
      minimumPerformanceHeadroomMs: 0,
      regressedEffectIds: [],
    })
    expect(ledger.summary.blockerCount).toBeGreaterThanOrEqual(500)
    expect(ledger.summary.systemicDefectsRemaining).toBe(2)
    expect(ledger.queue[0]).toMatchObject({
      kind: 'systemic',
      defectKey: 'evidence:independent-visual-review',
    })
    expect(ledger.queue.some((item) => item.defectKey === 'performance:real-device')).toBe(true)
    expect(ledger.effects[0]).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      currentGrade: null,
      worstVisualScore: null,
      weightedScore: null,
      performancePassed: false,
      performanceHeadroomMs: null,
    })
  })

  it('tracks visual-only weighted progress before real-device evidence exists', () => {
    const input = createPassingQualityMatrixInput() as { performanceReviews: unknown[] }
    input.performanceReviews = []
    const matrix = profiling.createPfxQualityMatrix(input as never)
    const ledger = profiling.createPfxQualityImprovementLedgerFromMatrix(matrix, 1)

    expect(matrix.effects[0]!.weightedScore).toBeNull()
    expect(ledger.effects[0]!.weightedScore).toBe(4)
    expect(ledger.summary.weightedScore).toBe(4)
  })

  it('exports the quality gate summary and separate pass fields as Markdown', () => {
    const matrix = profiling.createPfxQualityMatrix({
      effects: [{ effectId: 'fireball', rank: 1, name: 'Fireball', originalGrade: 'C', performanceTier: 'low' }],
      visualReviews: [],
      performanceReviews: [],
    })
    const markdown = profiling.exportPfxQualityMatrixMarkdown(matrix)

    expect(markdown).toContain('# R3F PFX Per-Effect Quality Matrix')
    expect(markdown).toContain('Mobile readiness weight: 30% (non-compensable)')
    expect(markdown).toContain('| Rank | Effect | Before | After | Weighted | Visual | Performance | Final | Confidence | Blockers |')
    expect(markdown).toContain('| 1 | `fireball` | C | — | — | FAIL | FAIL | FAIL | — |')
    expect(markdown).toContain('missing isolated visual review')
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain('Required visual floor: 4/5')
    expect(markdown).toContain('Mobile Safari: missing')
    expect(markdown).toContain('Chrome Android: missing')
  })

  it('builds a passing quality row only when all visual dimensions and both real-device profiles pass', () => {
    const buildMatrix = profiling.createPfxQualityMatrix as unknown as (input: unknown) => any
    const visualScores = {
      semanticIdentity: 4,
      gameplayReadability: 4,
      volumeAndDepth: 4,
      multiAngleResilience: 4,
      silhouetteAndComposition: 4,
      temporalArcAndDecay: 4,
      materialAndShaderQuality: 4,
      meshStructureAndEmitterQuality: 4,
      cc0AssetIntegration: 4,
      distinctivenessAndRingDiscipline: 4,
      scaleAndVisualHierarchy: 4,
      overallProductionPolish: 4,
    }
    const performanceScores = {
      mobileFrameRateStability: 4,
      cpuAndGpuCost: 4,
      drawCallsParticlesAndOverdraw: 4,
      memoryAndThermalSuitability: 4,
    }
    const deviceMetrics = (platform: 'mobile-safari' | 'chrome-android') => ({
      platform,
      deviceLabel: platform === 'mobile-safari' ? 'iPhone 15 Pro' : 'Pixel 8 Pro',
      modelYear: 2023,
      measured: true,
      concurrency: 20,
      fps: 61.2,
      p95FrameMs: 14.1,
      worstFrameMs: 18.4,
      drawCalls: 24,
      particles: 480,
      overdrawRatio: 0.34,
      memoryMb: 92,
      memoryGrowthMb: 0.4,
      cpuMainThreadMs: 4.2,
      gpuTimeMs: 7.8,
      shaderCompilationStalls: 0,
      materialFrameHitches: 0,
      thermalStatus: 'nominal',
      sustainedDurationSeconds: 180,
      evidence: `.context/${platform}/fireball.json`,
    })

    const matrix = buildMatrix({
      effects: [{ effectId: 'fireball', rank: 51, name: 'Fireball', originalGrade: 'C', performanceTier: 'low' }],
      visualReviews: [{
        effectId: 'fireball',
        reviewer: 'isolated-peer-runtime',
        reviewerConfidence: 0.92,
        scores: visualScores,
        cameraEvidence: {
          front: ['front-onset.png', 'front-peak.png', 'front-decay.png'],
          threeQuarter: ['three-quarter-onset.png', 'three-quarter-peak.png', 'three-quarter-decay.png'],
          side: ['side-onset.png', 'side-peak.png', 'side-decay.png'],
        },
        lifecycleEvidence: {
          onset: ['front-onset.png', 'three-quarter-onset.png', 'side-onset.png'],
          peak: ['front-peak.png', 'three-quarter-peak.png', 'side-peak.png'],
          decay: ['front-decay.png', 'three-quarter-decay.png', 'side-decay.png'],
        },
        gameplayContextEvidence: ['gameplay-context-peak-three-quarter.png'],
        reducedMotionReadable: true,
        blockers: [],
      }],
      performanceReviews: [{
        effectId: 'fireball',
        scores: performanceScores,
        mobileSafari: deviceMetrics('mobile-safari'),
        chromeAndroid: deviceMetrics('chrome-android'),
        blockers: [],
      }],
    })

    expect(matrix.schema).toBe('game-bot.r3f-pfx-quality-matrix.v1')
    expect(matrix.weights.mobileReadiness).toBeGreaterThanOrEqual(0.3)
    expect(matrix.summary).toMatchObject({ totalEffects: 1, visualPasses: 1, performancePasses: 1, finalPasses: 1 })
    expect(matrix.effects[0]).toMatchObject({
      effectId: 'fireball',
      targetGrade: 'A',
      originalGrade: 'C',
      afterGrade: 'A',
      weightedScore: 4,
      requiredQualityThreshold: {
        minimumVisualDimension: 4,
        minimumWeightedScore: 4,
        performanceHeadroomRequired: true,
      },
      visualPass: true,
      performancePass: true,
      finalPass: true,
      reviewerConfidence: 0.92,
      blockers: [],
    })
    expect(matrix.effects[0].scores).toEqual({ ...visualScores, ...performanceScores })
    expect(matrix.effects[0].cameraEvidence.side).toHaveLength(3)
    expect(matrix.effects[0].lifecycleEvidence.decay).toHaveLength(3)
    expect(matrix.effects[0].mobileSafari).toMatchObject({ concurrency: 20, fps: 61.2, p95FrameMs: 14.1 })
    expect(matrix.effects[0].chromeAndroid).toMatchObject({ concurrency: 20, fps: 61.2, p95FrameMs: 14.1 })
  })

  it('rejects performance evidence from phone models older than the 2022 floor', () => {
    const buildMatrix = profiling.createPfxQualityMatrix as unknown as (input: unknown) => any
    const matrix = buildMatrix(createPassingQualityMatrixInput({ mobileSafariModelYear: 2021 }))

    expect(matrix.effects[0].visualPass).toBe(true)
    expect(matrix.effects[0].performancePass).toBe(false)
    expect(matrix.effects[0].finalPass).toBe(false)
    expect(matrix.effects[0].blockers).toContain('real-device model-year floor failed; iOS and Android must be 2022 or newer')
  })

  it('keeps mobile readiness non-compensable when a visually perfect effect misses canonical concurrency', () => {
    const buildMatrix = profiling.createPfxQualityMatrix as unknown as (input: unknown) => any
    const visualScores = Object.fromEntries(PFX_MATRIX_VISUAL_KEYS.map((key) => [key, 5]))
    const performanceScores = Object.fromEntries(PFX_MATRIX_PERFORMANCE_KEYS.map((key) => [key, 5]))
    const deviceMetrics = (platform: 'mobile-safari' | 'chrome-android', concurrency: number) => ({
      platform,
      deviceLabel: platform === 'mobile-safari' ? 'iPhone 15 Pro' : 'Pixel 8 Pro',
      modelYear: 2023,
      measured: true,
      concurrency,
      fps: 62,
      p95FrameMs: 15.4,
      worstFrameMs: 20,
      drawCalls: 24,
      particles: 480,
      overdrawRatio: 0.3,
      memoryMb: 90,
      memoryGrowthMb: 0,
      cpuMainThreadMs: 4,
      gpuTimeMs: 7,
      shaderCompilationStalls: 0,
      materialFrameHitches: 0,
      thermalStatus: 'nominal',
      sustainedDurationSeconds: 180,
      evidence: `.context/${platform}/fireball.json`,
    })
    const matrix = buildMatrix({
      effects: [{ effectId: 'fireball', rank: 1, name: 'Fireball', originalGrade: 'C', performanceTier: 'low' }],
      visualReviews: [{
        effectId: 'fireball',
        reviewer: 'isolated-peer-runtime',
        reviewerConfidence: 1,
        scores: visualScores,
        cameraEvidence: {
          front: ['front-onset.png', 'front-peak.png', 'front-decay.png'],
          threeQuarter: ['three-quarter-onset.png', 'three-quarter-peak.png', 'three-quarter-decay.png'],
          side: ['side-onset.png', 'side-peak.png', 'side-decay.png'],
        },
        lifecycleEvidence: {
          onset: ['front-onset.png', 'three-quarter-onset.png', 'side-onset.png'],
          peak: ['front-peak.png', 'three-quarter-peak.png', 'side-peak.png'],
          decay: ['front-decay.png', 'three-quarter-decay.png', 'side-decay.png'],
        },
        gameplayContextEvidence: ['gameplay-context-peak-three-quarter.png'],
        reducedMotionReadable: true,
        blockers: [],
      }],
      performanceReviews: [{
        effectId: 'fireball',
        scores: performanceScores,
        mobileSafari: deviceMetrics('mobile-safari', 1),
        chromeAndroid: deviceMetrics('chrome-android', 20),
        blockers: [],
      }],
    })

    expect(matrix.effects[0]).toMatchObject({ weightedScore: 5, afterGrade: 'A+', visualPass: true })
    expect(matrix.effects[0].performancePass).toBe(false)
    expect(matrix.effects[0].finalPass).toBe(false)
    expect(matrix.effects[0].blockers).toContain('real-device high-frame-rate or canonical-concurrency gate failed')
  })

  it('keeps an absent historical before grade as metadata rather than a permanent acceptance blocker', () => {
    const buildMatrix = profiling.createPfxQualityMatrix as unknown as (input: unknown) => any
    const matrix = buildMatrix({
      effects: [{ effectId: 'fireball', rank: 1, name: 'Fireball', originalGrade: null, performanceTier: 'low' }],
      visualReviews: [],
      performanceReviews: [],
    })

    expect(matrix.effects[0].originalGrade).toBeNull()
    expect(matrix.effects[0].requiredQualityThreshold).toEqual({
      minimumVisualDimension: 4,
      minimumWeightedScore: 4.7,
      performanceHeadroomRequired: true,
    })
    expect(matrix.effects[0].finalPass).toBe(false)
    expect(matrix.effects[0].blockers).not.toContain('missing independently reviewed before grade')
    expect(matrix.effects[0].blockers).toContain('missing isolated visual review')
  })

  it('defines a representative profile scenario suite across core effect profiles', () => {
    expect(PROFILE_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'mobile-force-field-single',
      'mobile-explosion-caution-single',
      'mobile-smoke-puff-single',
      'mobile-ui-reward-burst-single',
      'mobile-portal-idle-loop-caution-single',
      'mobile-low-tier-stress-20',
    ])
    expect(PROFILE_SCENARIOS.some((scenario) => scenario.mode === 'stress' && scenario.stressCount === 20)).toBe(true)
    expect(PROFILE_SCENARIOS.filter((scenario) => scenario.mobileSafeOnly === false)).toHaveLength(2)
  })

  it('defines an authored profile suite for every authored-preview effect', () => {
    expect(AUTHORED_PROFILE_SCENARIOS).toHaveLength(500)
    expect(AUTHORED_PROFILE_SCENARIOS[0]).toMatchObject({
      id: 'authored-fireball-single',
      search: 'fireball',
      mode: 'single',
    })
    expect(AUTHORED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).toEqual(
      expect.arrayContaining([
        'force-field',
        'embers-burst',
        'electric-trail',
        'portal-charge',
        'spawn-screen',
        'barrier-low-health',
        'flame-charge',
        'meteor-ring',
        'water-column',
        'shadow-break',
        'blood-death',
        'portal-telegraph',
        'pickup-burst',
        'blast-burst',
        'shockwave-burst',
        'beam-burst',
        'healing-burst',
        'holy-burst',
        'portal-burst',
        'scan-burst',
        'hologram-burst',
        'engine-burst',
        'flame-loop',
        'rune-loop',
        'beam-loop',
        'mud-loop',
        'slime-loop',
        'poison-loop',
        'portal-loop',
        'shield-loop',
        'dash-loop',
        'pickup-loop',
        'ui-loop',
        'target-loop',
        'scan-loop',
        'hologram-loop',
        'flame-trail',
        'rune-trail',
        'plasma-trail',
        'rain-trail',
        'snow-trail',
        'poison-trail',
        'portal-trail',
        'shield-trail',
        'jump-trail',
        'landing-trail',
        'scan-trail',
        'embers-impact',
        'meteor-impact',
        'plasma-impact',
        'frost-impact',
        'water-impact',
        'snow-impact',
        'portal-impact',
        'shield-impact',
        'dash-impact',
        'footstep-impact',
        'target-impact',
        'warning-impact',
        'hologram-impact',
        'thruster-impact',
        'embers-idle',
        'flame-idle',
        'rune-idle',
        'beam-idle',
        'plasma-idle',
        'rain-idle',
        'wind-idle',
        'leaf-idle',
        'poison-idle',
        'healing-idle',
        'portal-idle',
        'shield-idle',
        'parry-idle',
        'footstep-idle',
        'pickup-idle',
        'reward-idle',
        'target-idle',
        'hologram-idle',
        'embers-charge',
        'blast-charge',
        'spark-charge',
        'rune-charge',
        'beam-charge',
        'plasma-charge',
        'electric-charge',
        'ice-charge',
        'water-charge',
        'poison-charge',
        'healing-charge',
        'holy-charge',
        'warp-charge',
        'shield-charge',
        'parry-charge',
        'dash-charge',
        'jump-charge',
        'target-charge',
        'embers-release',
        'ice-release',
        'water-release',
        'portal-release',
        'spawn-release',
        'shield-release',
        'barrier-release',
        'dash-release',
        'embers-telegraph',
        'spark-telegraph',
        'laser-telegraph',
        'plasma-telegraph',
        'electric-telegraph',
        'spawn-telegraph',
        'beam-release',
        'electric-release',
      ]),
    )
    expect(new Set(AUTHORED_PROFILE_SCENARIOS.map((scenario) => scenario.id)).size).toBe(500)
  })

  it('defines an empty profile-backed suite after all catalog targets receive authored previews', () => {
    expect(PROFILE_BACKED_PROFILE_SCENARIOS).toHaveLength(0)
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('blood-death')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('shockwave-burst')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('holy-burst')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('hologram-burst')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('slime-loop')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('ui-loop')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('target-loop')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('rain-trail')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('snow-trail')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('jump-trail')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('landing-trail')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('frost-impact')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('water-impact')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('shield-impact')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('target-impact')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('flame-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('rain-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('wind-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('portal-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('footstep-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('pickup-idle')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('embers-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('plasma-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('electric-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('healing-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('dash-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('jump-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('target-charge')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('electric-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('ice-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('water-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('portal-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('shield-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('barrier-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('dash-release')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('spark-telegraph')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('laser-telegraph')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('plasma-telegraph')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('electric-telegraph')
    expect(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search)).not.toContain('spawn-telegraph')
    expect(new Set(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.id)).size).toBe(0)
  })

  it('defines catalog stress chunks that cover every effect without exceeding mobile low-tier thresholds', () => {
    const ids = CATALOG_STRESS_PROFILE_SCENARIOS.flatMap((scenario) => scenario.effectIds ?? [])
    expect(new Set(ids).size).toBe(500)
    expect(ids).toEqual(expect.arrayContaining(['fireball', 'shadow-break', 'blood-death', 'spark-telegraph']))
    for (const scenario of CATALOG_STRESS_PROFILE_SCENARIOS) {
      expect(scenario.mode).toBe('stress')
      expect(scenario.effectIds?.length).toBeGreaterThan(0)
      expect(scenario.effectIds?.length).toBeLessThanOrEqual(8)
      expect(scenario.stressCount).toBe(scenario.effectIds?.length)
      const presets = (scenario.effectIds ?? []).map((id) => PFX_PRESETS.find((preset) => preset.effectId === id)!)
      expect(presets.reduce((total, preset) => total + preset.performance.maxParticles, 0)).toBeLessThanOrEqual(768)
      expect(presets.length * 3).toBeLessThanOrEqual(64)
    }
  })

  it('derives deterministic profile artifact filenames that match approval template paths', () => {
    expect(profileArtifactFileNameForScenario(AUTHORED_PROFILE_SCENARIOS[0])).toBe('fireball.json')
    expect(
      profileArtifactFileNameForScenario(
        AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!,
      ),
    ).toBe('force-field.json')
    expect(profileArtifactFileNameForScenario(CATALOG_STRESS_PROFILE_SCENARIOS[0])).toBe('catalog-stress-01.json')
    expect(
      profileArtifactFileNameForScenario({
        id: 'custom multi effect',
        mode: 'stress',
        search: '',
        effectIds: ['force-field', 'fireball'],
      }),
    ).toBe('custom-multi-effect.json')
  })

  it('creates a real-device mobile capture plan for every effect and required platform', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })

    expect(plan.schema).toBe('game-bot.r3f-pfx-real-device-capture-plan.v2')
    expect(plan.summary).toEqual({
      totalEffects: 500,
      totalCaptures: 1000,
      platforms: ['mobile-safari', 'chrome-android'],
      requiredDeviceClass: 'real-device',
    })
    expect(plan.instructions).toMatchObject({
      baseUrl: 'https://preview.example.test/pfx',
      baseUrlReachability: 'network-reachable',
      devServerCommand: 'npm --prefix kits/juice/r3f-pfx-browser run serve:real-device',
      profileJsonSelector: '[data-profile-json="r3f-pfx-real-device"]',
      auditCommand: 'npm --prefix kits/juice/r3f-pfx-browser run verify:real-device',
      operatorChecklist: expect.arrayContaining([
        'Start the LAN dev server before phone capture: npm --prefix kits/juice/r3f-pfx-browser run serve:real-device',
        'Open each profileUrl on the named real device and platform, not desktop emulation.',
        'Final approval captures must keep the original report.url with matching profileEffectIds, profilePlatform, and profileConcurrency query params.',
        'Final approval captures must render one effect identity repeated at its canonical tier concurrency in scenario.mode: "stress".',
        'Each capture must sustain measurement for at least 180 seconds and report memory growth, shader stalls, frame hitches, and thermal status.',
        'Final approval captures must include device.maxTouchPoints > 0, device.pointerCoarse: true, and device.hoverNone: true.',
        'Final approval captures must include overdraw.measurementSource: "screenshot-readback"; browser-estimate panel JSON is diagnostic only.',
        'Use the Real-device capture panel Download JSON link; it must download the exact effect .json file named in outputFile.',
        'If the browser blocks downloads, copy the JSON from the visible Real-device capture panel or the profileJsonSelector script node as a fallback.',
        'Save the downloaded JSON exactly to outputFile before running the audit command.',
      ]),
      platformRequirements: {
        'mobile-safari': {
          browser: 'Mobile Safari',
          deviceClass: 'iPhone or iPad hardware',
        },
        'chrome-android': {
          browser: 'Chrome Android',
          deviceClass: 'Android phone or tablet hardware',
        },
      },
    })
    expect(plan.instructions.baseUrlRemediationCommand).toBeUndefined()
    expect(plan.captures).toHaveLength(1000)
    expect(plan.captures[0]).toMatchObject({
      effectId: 'fireball',
      platform: 'mobile-safari',
      scenarioId: 'authored-fireball-single',
      profileUrl: 'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&profileConcurrency=10',
      outputFile: '.context/mobile-safari/fireball.json',
      requiredCapture: {
        deviceClass: 'real-device',
        platform: 'mobile-safari',
        runner: 'manual-real-device-browser',
        performanceTier: 'medium',
        concurrency: 10,
        sustainedDurationSeconds: 180,
      },
      verifierEvidence: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
      operatorChecklist: [
        'Open profileUrl on Mobile Safari running on iPhone or iPad hardware.',
        'Confirm the Real-device capture panel shows mobile-safari / fireball.json.',
        'Tap Download JSON in the Real-device capture panel; the download filename must be fireball.json.',
        'Fallback only if downloads are blocked: copy profile JSON from [data-profile-json="r3f-pfx-real-device"].',
        'Verify saved JSON url includes profileEffectIds=fireball, profilePlatform=mobile-safari, and profileConcurrency=10.',
        'Verify saved JSON repeats only fireball at the medium tier canonical concurrency 10 with scenario.mode "stress" and scenario.effectCount 10.',
        'Verify the sustained measurement duration is at least 180 seconds and includes memory growth, shader stalls, frame hitches, and thermal status.',
        'Verify saved JSON includes touch evidence: device.maxTouchPoints > 0, device.pointerCoarse true, and device.hoverNone true.',
        'Verify saved JSON includes overdraw.measurementSource: "screenshot-readback"; browser-estimate is rejected by the audit.',
        'Save the downloaded JSON exactly to .context/mobile-safari/fireball.json.',
        'Run the real-device audit before using this evidence in production approvals.',
      ],
    })
    expect(plan.captures[1]).toMatchObject({
      effectId: 'fireball',
      platform: 'chrome-android',
      outputFile: '.context/chrome-android/fireball.json',
      verifierEvidence: 'chrome-android-profile:.context/chrome-android/fireball.json',
    })
    expect(plan.captures.find((capture) => capture.effectId === 'force-field' && capture.platform === 'mobile-safari')).toMatchObject({
      profileUrl: 'https://preview.example.test/pfx?profileEffectIds=force-field&profilePlatform=mobile-safari&profileConcurrency=20',
      outputFile: '.context/mobile-safari/force-field.json',
    })
  })

  it('marks loopback real-device capture URLs as local-only with a regeneration command', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'http://127.0.0.1:4765/',
      outputRoot: '.context',
    })
    const markdown = exportPfxRealDeviceProfileCapturePlanMarkdown(plan)

    expect(plan.instructions).toMatchObject({
      baseUrl: 'http://127.0.0.1:4765/',
      baseUrlReachability: 'local-only',
      baseUrlRemediationCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url http://<LAN-IP>:4765/',
      operatorChecklist: expect.arrayContaining([
        'Base URL is local-only; phones cannot reach loopback/localhost. Regenerate with the remediation command before collecting real-device captures.',
      ]),
    })
    expect(markdown).toContain('Base URL: `http://127.0.0.1:4765/`')
    expect(markdown).toContain('Reachability: `local-only`')
    expect(markdown).toContain(
      'Regenerate command: `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url http://<LAN-IP>:4765/`',
    )
  })

  it('creates deterministic real-device capture batches for resumable mobile profiling', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })

    expect(batchPlan.schema).toBe('game-bot.r3f-pfx-real-device-capture-batches.v1')
    expect(batchPlan.summary).toEqual({
      totalCaptures: 1000,
      totalBatches: 20,
      batchSize: 50,
      platforms: ['mobile-safari', 'chrome-android'],
    })
    expect(batchPlan.instructions).toMatchObject({
      sourcePlanSchema: 'game-bot.r3f-pfx-real-device-capture-plan.v2',
      approvalStatus: 'non-approving-capture-execution-worklist',
      operatorChecklist: expect.arrayContaining([
        'Run one batch at a time on the named real device platform.',
        'After each batch, run the real-device audit and regenerate the external evidence work order.',
      ]),
    })
    expect(batchPlan.batches).toHaveLength(20)
    expect(batchPlan.batches[0]).toMatchObject({
      batchId: 'real-device-batch-001',
      platform: 'mobile-safari',
      startIndex: 1,
      endIndex: 50,
      captureCount: 50,
      outputFiles: expect.arrayContaining(['.context/mobile-safari/fireball.json']),
      resumeCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json',
    })
    expect(batchPlan.batches[10]).toMatchObject({
      batchId: 'real-device-batch-011',
      platform: 'chrome-android',
      startIndex: 501,
      endIndex: 550,
      captureCount: 50,
      outputFiles: expect.arrayContaining(['.context/chrome-android/fireball.json']),
    })
  })

  it('exports an all-batch real-device capture sheet index with exact generation commands', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const index = createPfxRealDeviceCaptureBatchSheetIndex(batchPlan)
    const markdown = exportPfxRealDeviceCaptureBatchSheetIndexMarkdown(index)

    expect(index.schema).toBe('game-bot.r3f-pfx-real-device-capture-batch-sheet-index.v1')
    expect(index.summary).toEqual({
      totalBatches: 20,
      totalCaptures: 1000,
      outputDirectory: '.context/real-device-capture-batches',
      approvalStatus: 'non-approving-batch-sheet-index',
      bulkCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-directory .context/real-device-capture-batches --batch-sheet-index-output .context/r3f-pfx-real-device-capture-batch-sheet-index.json --batch-sheet-index-markdown-output .context/r3f-pfx-real-device-capture-batch-sheet-index.md',
    })
    expect(index.sheets[0]).toEqual({
      batchId: 'real-device-batch-001',
      platform: 'mobile-safari',
      startIndex: 1,
      endIndex: 50,
      captureCount: 50,
      firstEffectId: 'fireball',
      lastEffectId: 'flame-charge',
      outputFile: '.context/real-device-capture-batches/real-device-batch-001.md',
      autoUploadQueueUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
      autoUploadQueueUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
      autoUploadRequiresDeviceLabel: true,
      command:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-output .context/real-device-capture-batches/real-device-batch-001.md --batch-id real-device-batch-001',
    })
    expect(index.sheets[10]).toMatchObject({
      batchId: 'real-device-batch-011',
      platform: 'chrome-android',
      outputFile: '.context/real-device-capture-batches/real-device-batch-011.md',
    })
    expect(markdown).toContain('# R3F PFX Real-Device Capture Batch Sheet Index')
    expect(markdown).toContain('Total batches: 20')
    expect(markdown).toContain(
      'Bulk command: `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-directory .context/real-device-capture-batches --batch-sheet-index-output .context/r3f-pfx-real-device-capture-batch-sheet-index.json --batch-sheet-index-markdown-output .context/r3f-pfx-real-device-capture-batch-sheet-index.md`',
    )
    expect(markdown).toContain(
      'LAN handoff command: `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:lan`',
    )
    expect(markdown).toContain(
      'Tunnel/base URL handoff command: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:base-url`',
    )
    expect(markdown).toContain(
      '- `real-device-batch-001` (`mobile-safari`, captures 1-50, 50 captures, `fireball` to `flame-charge`): `.context/real-device-capture-batches/real-device-batch-001.md`',
    )
    expect(markdown).toContain(
      '  - `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-output .context/real-device-capture-batches/real-device-batch-001.md --batch-id real-device-batch-001`',
    )
    expect(markdown).toContain(
      '  - Auto-run: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
    )
    expect(markdown).toContain(
      '  - Auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).toContain('  - Auto-run device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain('Treat this index as capture execution help only; final acceptance credits only strict audit-valid capture files.')
  })

  it('validates real-device capture batch sheet indexes against the batch plan', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const index = createPfxRealDeviceCaptureBatchSheetIndex(batchPlan)
    const forgedIndex = {
      ...index,
      sheets: index.sheets.map((sheet) =>
        sheet.batchId === 'real-device-batch-001'
          ? {
              ...sheet,
              startIndex: 2,
              firstEffectId: 'wrong-effect',
              outputFile: '.context/wrong/real-device-batch-001.md',
              autoUploadQueueUrl: 'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari',
              command: 'npm run wrong',
            }
          : sheet,
      ),
    }

    expect(validatePfxRealDeviceCaptureBatchSheetIndex(batchPlan, index)).toEqual({
      passed: true,
      findings: [],
    })
    expect(validatePfxRealDeviceCaptureBatchSheetIndex(batchPlan, forgedIndex).findings).toEqual(
      expect.arrayContaining([
        'real-device-batch-001 startIndex expected 1 but found 2',
        'real-device-batch-001 firstEffectId expected fireball but found wrong-effect',
        'real-device-batch-001 outputFile expected .context/real-device-capture-batches/real-device-batch-001.md but found .context/wrong/real-device-batch-001.md',
        'real-device-batch-001 autoUploadQueueUrl does not match expected batch-scoped queue URL',
        'real-device-batch-001 command does not match expected batch sheet command',
      ]),
    )
  })

  it('exports a single-batch real-device operator sheet with exact capture paths', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 3 })
    const markdown = exportPfxRealDeviceCaptureBatchSheetMarkdown(batchPlan, 'real-device-batch-001')

    expect(markdown).toContain('# R3F PFX Real-Device Capture Batch real-device-batch-001')
    expect(markdown).toContain('Treat this sheet as non-approving capture execution input.')
    expect(markdown).toContain('Platform: `mobile-safari`')
    expect(markdown).toContain('Captures: 3')
    expect(markdown).toContain(
      'Audit command: `npm --prefix kits/juice/r3f-pfx-browser run verify:real-device`',
    )
    expect(markdown).not.toContain('verify:evidence -- --real-device-audit-output')
    expect(markdown).toContain(
      'Ingest downloads command: `npm --prefix kits/juice/r3f-pfx-browser run ingest:real-device -- --batch-id real-device-batch-001`',
    )
    expect(markdown).toContain(
      'Put downloaded JSON files in `.context/real-device-downloads`, run the ingest command, then run the audit command.',
    )
    expect(markdown).toContain(
      'Platform auto-run URL: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
    )
    expect(markdown).toContain('Open the platform auto-run URL from Mobile Safari to measure, upload, and advance through this batch.')
    expect(markdown).toContain('- [ ] Fireball (`fireball`)')
    expect(markdown).toContain('Open: https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari')
    expect(markdown).toContain(
      'Auto-upload: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
    )
    expect(markdown).toContain(
      'Auto-upload template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).toContain('Auto-upload device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain('Save: `.context/mobile-safari/fireball.json`')
    expect(markdown).toContain('Evidence: `mobile-safari-profile:.context/mobile-safari/fireball.json`')
    expect(markdown).toContain('Confirm screenshot-readback overdraw and real-device touch metadata before checking this row.')
    expect(markdown).toContain('- [ ] Explosion (`explosion`)')
    expect(markdown).toContain('- [ ] Smoke Puff (`smoke-puff`)')
    expect(markdown).toContain(
      'Final approval still requires the strict regenerated real-device audit and independent final approval metadata.',
    )
  })

  it('creates a structured single-batch real-device capture sheet for automation handoff', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 3 })
    const sheet = createPfxRealDeviceCaptureBatchSheet(batchPlan, { batchId: 'real-device-batch-001' })

    expect(sheet.schema).toBe('game-bot.r3f-pfx-real-device-capture-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-real-device-capture-batch-sheet',
      sourceBatchPlanSchema: 'game-bot.r3f-pfx-real-device-capture-batches.v1',
      auditCommand: 'npm --prefix kits/juice/r3f-pfx-browser run verify:real-device',
    })
    expect(sheet.batch).toMatchObject({
      batchId: 'real-device-batch-001',
      platform: 'mobile-safari',
      captureCount: 3,
      startIndex: 1,
      endIndex: 3,
    })
    expect(sheet.captures).toHaveLength(3)
    expect(sheet.captures[0]).toMatchObject({
      effectId: 'fireball',
      name: 'Fireball',
      platform: 'mobile-safari',
      profileUrl:
        'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&profileConcurrency=10',
      autoUploadUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
      autoUploadUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
      autoUploadRequiresDeviceLabel: true,
      outputFile: '.context/mobile-safari/fireball.json',
      verifierEvidence: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
      requiredCapture: {
        deviceClass: 'real-device',
        platform: 'mobile-safari',
        runner: 'manual-real-device-browser',
        performanceTier: 'medium',
        concurrency: 10,
        sustainedDurationSeconds: 180,
      },
      captured: false,
    })
  })

  it('exports a reviewer-readable Markdown handoff for real-device capture operators', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const markdown = exportPfxRealDeviceProfileCapturePlanMarkdown(plan)

    expect(markdown).toContain('# R3F PFX Real-Device Capture Plan')
    expect(markdown).toContain('Treat this handoff as non-approving capture execution input.')
    expect(markdown).toContain('Total captures: 1000')
    expect(markdown).toContain('Required device class: `real-device`')
    expect(markdown).toContain('Dev server command: `npm --prefix kits/juice/r3f-pfx-browser run serve:real-device`')
    expect(markdown).toContain('Profile JSON selector: `[data-profile-json="r3f-pfx-real-device"]`')
    expect(markdown).toContain(
      'Use the Real-device capture panel Download JSON link; it must download the exact effect .json file named in outputFile.',
    )
    expect(markdown).toContain(
      'Audit command: `npm --prefix kits/juice/r3f-pfx-browser run verify:real-device`',
    )
    expect(markdown).not.toContain('verify:evidence -- --real-device-audit-output')
    expect(markdown).toContain('mobile-safari: Mobile Safari on iPhone or iPad hardware')
    expect(markdown).toContain('chrome-android: Chrome Android on Android phone or tablet hardware')
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain(
      'Mobile Safari: [open capture URL](https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&profileConcurrency=10)',
    )
    expect(markdown).toContain('Save to: `.context/mobile-safari/fireball.json`')
    expect(markdown).toContain('Downloaded filename: `fireball.json`')
    expect(markdown).toContain('Evidence: `mobile-safari-profile:.context/mobile-safari/fireball.json`')
    expect(markdown).toContain(
      'Chrome Android: [open capture URL](https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=chrome-android&profileConcurrency=10)',
    )
    expect(markdown).toContain('Save to: `.context/chrome-android/fireball.json`')
    expect(markdown).toContain('Evidence: `chrome-android-profile:.context/chrome-android/fireball.json`')
    expect(markdown).toContain('Final approval still requires the strict regenerated real-device audit.')
  })

  it('summarizes real-device capture progress by batch without granting approval', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const allMissingProgress = createPfxRealDeviceCaptureBatchProgress(
      batchPlan,
      createPfxRealDeviceCaptureAudit({
        readCapture: () => undefined,
      }),
    )
    const partialProgress = createPfxRealDeviceCaptureBatchProgress(
      batchPlan,
      createPfxRealDeviceCaptureAudit({
        readCapture: (outputFile) => (outputFile === '.context/mobile-safari/fireball.json' ? safariReport : undefined),
      }),
    )

    expect(allMissingProgress.schema).toBe('game-bot.r3f-pfx-real-device-capture-batch-progress.v1')
    expect(allMissingProgress.summary).toEqual({
      totalBatches: 20,
      completeBatches: 0,
      partialBatches: 0,
      missingBatches: 20,
      totalCaptures: 1000,
      validCaptures: 0,
      missingCaptures: 1000,
      invalidCaptures: 0,
      platformProgress: {
        'mobile-safari': {
          totalCaptures: 500,
          validCaptures: 0,
          missingCaptures: 500,
          invalidCaptures: 0,
          nextCaptureEffectId: 'fireball',
          nextCaptureName: 'Fireball',
          nextCaptureProfileUrl:
            'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&profileConcurrency=10',
          nextCaptureAutoUploadUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
          nextCaptureAutoUploadUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
          nextBatchId: 'real-device-batch-001',
          nextBatchAutoUploadQueueUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
          nextBatchAutoUploadQueueUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
          autoUploadQueueUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1',
          autoUploadQueueUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
          autoUploadRequiresDeviceLabel: true,
          nextCaptureOutputFile: '.context/mobile-safari/fireball.json',
        },
        'chrome-android': {
          totalCaptures: 500,
          validCaptures: 0,
          missingCaptures: 500,
          invalidCaptures: 0,
          nextCaptureEffectId: 'fireball',
          nextCaptureName: 'Fireball',
          nextCaptureProfileUrl:
            'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=chrome-android&profileConcurrency=10',
          nextCaptureAutoUploadUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
          nextCaptureAutoUploadUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
          nextBatchId: 'real-device-batch-011',
          nextBatchAutoUploadQueueUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011',
          nextBatchAutoUploadQueueUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&profileDeviceLabel={profileDeviceLabel}',
          autoUploadQueueUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1',
          autoUploadQueueUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
          autoUploadRequiresDeviceLabel: true,
          nextCaptureOutputFile: '.context/chrome-android/fireball.json',
        },
      },
      operatorLaunchUrl: 'https://preview.example.test/__r3f-pfx-capture-operator',
      operatorLaunchUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
      approvalStatus: 'non-approving-progress-summary',
      nextBatchId: 'real-device-batch-001',
      nextBatchPlatform: 'mobile-safari',
      nextBatchSheetOutput: '.context/r3f-pfx-real-device-capture-batch-001.md',
      nextBatchSheetCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-output .context/r3f-pfx-real-device-capture-batch-001.md --batch-id real-device-batch-001',
      nextBatchAutoUploadQueueUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
      nextBatchAutoUploadQueueUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
      nextCaptureEffectId: 'fireball',
      nextCaptureName: 'Fireball',
      nextCapturePlatform: 'mobile-safari',
      nextCaptureProfileUrl:
        'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&profileConcurrency=10',
      nextCaptureAutoUploadUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
      nextCaptureAutoUploadUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
      nextCaptureUrlReachability: 'network-reachable',
      nextCaptureOutputFile: '.context/mobile-safari/fireball.json',
      nextCaptureEvidence: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
      baseUrl: 'https://preview.example.test/pfx',
      baseUrlReachability: 'network-reachable',
      readyForPhoneCapture: true,
      autoDetectAutoUploadQueueUrl: 'https://preview.example.test/__r3f-pfx-capture-next?platform=auto&profileAutoUpload=1',
      autoDetectAutoUploadQueueUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=auto&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
      autoUploadRequiresDeviceLabel: true,
      baseUrlRemediationCommand: null,
      lanProductionHandoffCommand: null,
      baseUrlProductionHandoffCommand: null,
      devServerCommand: 'npm --prefix kits/juice/r3f-pfx-browser run serve:real-device',
    })
    expect(allMissingProgress.batches[0]).toMatchObject({
      batchId: 'real-device-batch-001',
      platform: 'mobile-safari',
      captureCount: 50,
      autoUploadQueueUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001',
      autoUploadQueueUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
      autoUploadRequiresDeviceLabel: true,
      validCaptures: 0,
      missingCaptures: 50,
      invalidCaptures: 0,
      complete: false,
      status: 'missing',
      remainingOutputFiles: expect.arrayContaining(['.context/mobile-safari/fireball.json']),
      invalidOutputFiles: [],
    })
    expect(partialProgress.summary).toMatchObject({
      completeBatches: 0,
      partialBatches: 1,
      missingBatches: 19,
      validCaptures: 1,
      missingCaptures: 999,
      invalidCaptures: 0,
      platformProgress: {
        'mobile-safari': {
          totalCaptures: 500,
          validCaptures: 1,
          missingCaptures: 499,
          invalidCaptures: 0,
          nextCaptureEffectId: 'explosion',
          nextCaptureName: 'Explosion',
          nextCaptureProfileUrl:
            'https://preview.example.test/pfx?profileEffectIds=explosion&profilePlatform=mobile-safari&profileConcurrency=4',
          nextCaptureAutoUploadUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=explosion',
          nextCaptureAutoUploadUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=explosion&profileDeviceLabel={profileDeviceLabel}',
          nextCaptureOutputFile: '.context/mobile-safari/explosion.json',
        },
        'chrome-android': {
          totalCaptures: 500,
          validCaptures: 0,
          missingCaptures: 500,
          invalidCaptures: 0,
          nextCaptureEffectId: 'fireball',
          nextCaptureName: 'Fireball',
          nextCaptureProfileUrl:
            'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=chrome-android&profileConcurrency=10',
          nextCaptureAutoUploadUrl:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
          nextCaptureAutoUploadUrlTemplate:
            'https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
          nextCaptureOutputFile: '.context/chrome-android/fireball.json',
        },
      },
      nextCaptureEffectId: 'explosion',
      nextCaptureName: 'Explosion',
      nextCapturePlatform: 'mobile-safari',
      nextCaptureProfileUrl:
        'https://preview.example.test/pfx?profileEffectIds=explosion&profilePlatform=mobile-safari&profileConcurrency=4',
      nextCaptureAutoUploadUrl:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=explosion',
      nextCaptureAutoUploadUrlTemplate:
        'https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=explosion&profileDeviceLabel={profileDeviceLabel}',
      nextCaptureUrlReachability: 'network-reachable',
      nextCaptureOutputFile: '.context/mobile-safari/explosion.json',
      nextCaptureEvidence: 'mobile-safari-profile:.context/mobile-safari/explosion.json',
    })
    expect(partialProgress.batches[0]).toMatchObject({
      batchId: 'real-device-batch-001',
      validCaptures: 1,
      missingCaptures: 49,
      complete: false,
      status: 'partial',
      validOutputFiles: ['.context/mobile-safari/fireball.json'],
    })
  })

  it('marks local-only real-device batch progress as not ready for phone capture', () => {
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'http://127.0.0.1:4765/',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const progress = createPfxRealDeviceCaptureBatchProgress(
      batchPlan,
      createPfxRealDeviceCaptureAudit({
        readCapture: () => undefined,
      }),
    )
    const markdown = exportPfxRealDeviceCaptureBatchProgressMarkdown(progress)

    expect(progress.summary).toMatchObject({
      baseUrl: 'http://127.0.0.1:4765/',
      baseUrlReachability: 'local-only',
      readyForPhoneCapture: false,
      nextCaptureUrlReachability: 'local-only',
      baseUrlRemediationCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url http://<LAN-IP>:4765/',
      lanProductionHandoffCommand:
        'PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:lan',
      baseUrlProductionHandoffCommand:
        'PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:base-url',
      devServerCommand: 'npm --prefix kits/juice/r3f-pfx-browser run serve:real-device',
    })
    expect(markdown).toContain('Base URL: `http://127.0.0.1:4765/`')
    expect(markdown).toContain('Reachability: `local-only`')
    expect(markdown).toContain('Ready for phone capture: no')
    expect(markdown).toContain('Next capture URL reachability: `local-only`')
    expect(markdown).toContain(
      'Regenerate command: `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url http://<LAN-IP>:4765/`',
    )
    expect(markdown).toContain(
      'LAN handoff command: `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:lan`',
    )
    expect(markdown).toContain(
      'Tunnel/base URL handoff command: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:base-url`',
    )
    expect(markdown).toContain('Dev server command: `npm --prefix kits/juice/r3f-pfx-browser run serve:real-device`')
  })

  it('exports real-device batch progress as a non-approving Markdown resume handoff', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const progress = createPfxRealDeviceCaptureBatchProgress(
      batchPlan,
      createPfxRealDeviceCaptureAudit({
        readCapture: (outputFile) => (outputFile === '.context/mobile-safari/fireball.json' ? safariReport : undefined),
      }),
    )
    const markdown = exportPfxRealDeviceCaptureBatchProgressMarkdown(progress)

    expect(markdown).toContain('# R3F PFX Real-Device Batch Progress')
    expect(markdown).toContain('Treat this handoff as non-approving capture resume input.')
    expect(markdown).toContain('Total batches: 20')
    expect(markdown).toContain('Complete batches: 0')
    expect(markdown).toContain('Partial batches: 1')
    expect(markdown).toContain('Missing batches: 19')
    expect(markdown).toContain('Valid captures: 1 / 1000')
    expect(markdown).toContain('Invalid captures: 0')
    expect(markdown).toContain('Next batch: `real-device-batch-001` (`mobile-safari`)')
    expect(markdown).toContain('Next capture: Explosion (`explosion`) on `mobile-safari`')
    expect(markdown).toContain(
      'Next capture URL: https://preview.example.test/pfx?profileEffectIds=explosion&profilePlatform=mobile-safari',
    )
    expect(markdown).toContain(
      'Next capture auto-upload template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=explosion&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Next capture auto-upload URL:')
    expect(markdown).toContain(
      'Next batch auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Next batch auto-run URL:')
    expect(markdown).toContain(
      'Auto-detect auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=auto&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Auto-detect auto-run URL:')
    expect(markdown).toContain(
      'Mobile Safari auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Mobile Safari auto-run URL:')
    expect(markdown).toContain(
      'Mobile Safari next batch auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Mobile Safari next batch auto-run URL:')
    expect(markdown).toContain(
      'Chrome Android auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Chrome Android auto-run URL:')
    expect(markdown).toContain(
      'Chrome Android next batch auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Chrome Android next batch auto-run URL:')
    expect(markdown).toContain('Next capture output: `.context/mobile-safari/explosion.json`')
    expect(markdown).toContain('Next capture evidence: `mobile-safari-profile:.context/mobile-safari/explosion.json`')
    expect(markdown).toContain(
      'Next batch sheet command: `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url https://preview.example.test/pfx --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-output .context/r3f-pfx-real-device-capture-batch-001.md --batch-id real-device-batch-001`',
    )
    expect(markdown).toContain('## real-device-batch-001 (`partial`)')
    expect(markdown).toContain(
      'Batch auto-run template: https://preview.example.test/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).not.toContain('Batch auto-run URL:')
    expect(markdown).toContain('Platform: `mobile-safari`')
    expect(markdown).toContain('Valid captures: 1 / 50')
    expect(markdown).toContain('Remaining output files: 49')
    expect(markdown).toContain('`.context/mobile-safari/explosion.json`')
    expect(markdown).toContain('Final acceptance still requires the strict regenerated real-device audit and final approval metadata.')
  })

  it('carries invalid real-device capture findings into batch progress handoffs', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const invalidSafariReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      overdraw: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').overdraw,
        measurementSource: 'browser-estimate' as const,
      },
    }
    const plan = createPfxRealDeviceProfileCapturePlan({
      baseUrl: 'https://preview.example.test/pfx',
      outputRoot: '.context',
    })
    const batchPlan = createPfxRealDeviceCaptureBatchPlan(plan, { batchSize: 50 })
    const progress = createPfxRealDeviceCaptureBatchProgress(
      batchPlan,
      createPfxRealDeviceCaptureAudit({
        readCapture: (outputFile) =>
          outputFile === '.context/mobile-safari/fireball.json' ? invalidSafariReport : undefined,
      }),
    )
    const markdown = exportPfxRealDeviceCaptureBatchProgressMarkdown(progress)

    expect(progress.batches[0]).toMatchObject({
      batchId: 'real-device-batch-001',
      invalidOutputFiles: ['.context/mobile-safari/fireball.json'],
      invalidCaptureFindings: [
        {
          outputFile: '.context/mobile-safari/fireball.json',
          reason: 'invalid capture report for fireball on mobile-safari',
          findings: ['overdraw.measurementSource must be screenshot-readback'],
        },
      ],
    })
    expect(markdown).toContain('### Invalid Capture Findings')
    expect(markdown).toContain('`.context/mobile-safari/fireball.json` - invalid capture report for fireball on mobile-safari')
    expect(markdown).toContain('- overdraw.measurementSource must be screenshot-readback')
  })

  it('audits real-device capture folders against every required effect and platform', () => {
    const audit = createPfxRealDeviceCaptureAudit({
      readCapture: () => undefined,
    })

    expect(audit.schema).toBe('game-bot.r3f-pfx-real-device-capture-audit.v1')
    expect(audit.summary).toEqual({
      totalEffects: 500,
      requiredCaptures: 1000,
      validCaptures: 0,
      missingCaptures: 1000,
      invalidCaptures: 0,
      fullyCapturedEffects: 0,
      platforms: ['mobile-safari', 'chrome-android'],
    })
    expect(audit.passed).toBe(false)
    expect(audit.effects[0]).toMatchObject({
      effectId: 'fireball',
      platformStatus: {
        'mobile-safari': {
          valid: false,
          outputFile: '.context/mobile-safari/fireball.json',
          reason: 'missing capture file',
        },
        'chrome-android': {
          valid: false,
          outputFile: '.context/chrome-android/fireball.json',
          reason: 'missing capture file',
        },
      },
    })
  })

  it('rejects forged real-device audit statuses with missing or stale findings', () => {
    const missingAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: () => undefined,
    })
    missingAudit.effects[0].platformStatus['mobile-safari'].findings = []

    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const validAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') {
          return makeRealDeviceReport(fireballScenario, 'mobile-safari')
        }
        if (outputFile === '.context/chrome-android/fireball.json') {
          return makeRealDeviceReport(fireballScenario, 'chrome-android')
        }
        return undefined
      },
    })
    validAudit.effects[0].platformStatus['mobile-safari'].findings = ['stale invalid finding']

    expect(validatePfxRealDeviceCaptureAudit(missingAudit).findings).toEqual(
      expect.arrayContaining(['fireball mobile-safari invalid status must include at least one finding']),
    )
    expect(validatePfxRealDeviceCaptureAudit(validAudit).findings).toEqual(
      expect.arrayContaining(['fireball mobile-safari valid status must not include findings']),
    )
  })

  it('credits only strict real-device captures that match effect, platform, user agent, and thresholds', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball', 'force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        if (outputFile === '.context/mobile-safari/force-field.json') return {
          ...safariReport,
          scenario: { ...safariReport.scenario, id: 'mobile-fireball-plus-single' },
        }
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      totalEffects: 2,
      requiredCaptures: 4,
      validCaptures: 2,
      missingCaptures: 1,
      invalidCaptures: 1,
      fullyCapturedEffects: 1,
    })
    expect(audit.effects.find((effect) => effect.effectId === 'fireball')?.fullyCaptured).toBe(true)
    expect(audit.effects.find((effect) => effect.effectId === 'force-field')?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for force-field on mobile-safari',
    })
  })

  it('rejects canonical-concurrency captures without sustained memory, hitch, shader, and thermal telemetry', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const missingTelemetryReport = { ...makeRealDeviceReport(fireballScenario, 'mobile-safari') } as BrowserProfileReport & {
      sustained?: unknown
    }
    delete missingTelemetryReport.sustained

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => outputFile === '.context/mobile-safari/fireball.json' ? missingTelemetryReport : undefined,
    })

    expect(audit.summary).toMatchObject({ validCaptures: 0, invalidCaptures: 1, fullyCapturedEffects: 0 })
    expect(audit.effects[0].platformStatus['mobile-safari'].findings).toEqual(expect.arrayContaining([
      'sustained telemetry must measure at least 180 seconds with memory, CPU/GPU, hitch, shader-stall, and thermal suitability evidence',
    ]))
  })

  it('rejects unsupported Chromium-derived Android browsers as Chrome Android real-device captures', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const unsupportedUserAgents = [
      'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0',
    ]

    for (const userAgent of unsupportedUserAgents) {
      const audit = createPfxRealDeviceCaptureAudit({
        effectIds: ['fireball'],
        readCapture: (outputFile) => {
          if (outputFile === '.context/chrome-android/fireball.json') {
            return {
              ...makeRealDeviceReport(fireballScenario, 'chrome-android'),
              userAgent,
            }
          }
          return undefined
        },
      })

      expect(audit.summary).toMatchObject({
        validCaptures: 0,
        invalidCaptures: 1,
        missingCaptures: 1,
        fullyCapturedEffects: 0,
      })
      expect(audit.effects[0].platformStatus['chrome-android']).toMatchObject({
        valid: false,
        reason: 'invalid capture report for fireball on chrome-android',
        findings: expect.arrayContaining(['userAgent must be Chrome Android on Android hardware']),
      })
    }
  })

  it('embeds the shared mobile runtime policy in every browser profile report', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const report = makePassingReport(fireballScenario) as BrowserProfileReport & {
      runtimePolicy?: unknown
    }

    expect(report.runtimePolicy).toEqual(PFX_MOBILE_RUNTIME_POLICY)
  })

  it('rejects real-device captures whose embedded runtime policy does not match the capped-DPR policy', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = {
      ...makePassingReport(fireballScenario),
      runtimePolicy: {
        ...PFX_MOBILE_RUNTIME_POLICY,
        maxDevicePixelRatio: 3,
        canvasDprRange: [1, 3],
      },
      scenario: {
        ...makePassingReport(fireballScenario).scenario,
        id: 'mobile-fireball-single',
      },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      capture: {
        deviceClass: 'real-device' as const,
        platform: 'mobile-safari' as const,
        deviceLabel: 'iPhone 15 Pro',
        runner: 'manual-real-device-browser',
        notes: [],
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        return undefined
      },
    })

    expect(audit.effects[0].platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
    })
  })

  it('rejects real-device captures whose overdraw evidence is only browser-estimated', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const baseInput = profileInputForScenario(fireballScenario)
    const estimatedReport = {
      ...createBrowserProfileReport({
        ...baseInput,
        canvas: {
          ...baseInput.canvas,
          measurementSource: 'browser-estimate',
        },
      }),
      scenario: {
        ...makePassingReport(fireballScenario).scenario,
        id: 'mobile-fireball-single',
      },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      capture: {
        deviceClass: 'real-device' as const,
        platform: 'mobile-safari' as const,
        deviceLabel: 'iPhone 15 Pro',
        runner: 'manual-real-device-browser',
        notes: [],
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return estimatedReport
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      missingCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
    })
  })

  it('rejects real-device captures that were not emitted from the matching capture URL', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithoutCaptureUrl = {
      ...makePassingReport(fireballScenario),
      scenario: {
        ...makePassingReport(fireballScenario).scenario,
        id: 'mobile-fireball-single',
      },
      url: 'https://preview.example.test/pfx',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      capture: {
        deviceClass: 'real-device' as const,
        platform: 'mobile-safari' as const,
        deviceLabel: 'iPhone 15 Pro',
        runner: 'manual-real-device-browser',
        notes: [],
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithoutCaptureUrl
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
    })
  })

  it('rejects real-device captures whose URL still points at localhost or loopback', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const loopbackReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      url: 'http://127.0.0.1:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return loopbackReport
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining(['url host must be network-reachable, not localhost, 0.0.0.0, or loopback']),
    })
  })

  it('rejects real-device captures whose URL includes extra query params beyond capture intent', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const extraQueryReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      url: 'https://preview.example.test/pfx?profileEffectIds=fireball&profilePlatform=mobile-safari&debug=true',
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return extraQueryReport
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining([
        'url must include exactly profileEffectIds=fireball, profilePlatform=mobile-safari, and profileConcurrency=10',
      ]),
    })
  })

  it('rejects real-device captures whose URL duplicates capture intent query params', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const duplicateIntentReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      url: 'https://preview.example.test/pfx?profileEffectIds=fireball&profileEffectIds=force-field&profilePlatform=mobile-safari',
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return duplicateIntentReport
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining([
        'url must include exactly profileEffectIds=fireball, profilePlatform=mobile-safari, and profileConcurrency=10',
      ]),
    })
  })

  it('records actionable findings for invalid real-device captures', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const wrongPlatformReport = {
      ...makeRealDeviceReport(fireballScenario, 'chrome-android'),
      runtimePolicy: {
        ...PFX_MOBILE_RUNTIME_POLICY,
        maxDevicePixelRatio: 3,
      },
      device: {
        maxTouchPoints: 0,
        pointerCoarse: false,
        hoverNone: false,
      },
      overdraw: {
        ...makeRealDeviceReport(fireballScenario, 'chrome-android').overdraw,
        measurementSource: 'browser-estimate' as const,
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return wrongPlatformReport
        return undefined
      },
    })

    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining([
        'url must include exactly profileEffectIds=fireball, profilePlatform=mobile-safari, and profileConcurrency=10',
        'capture must be real-device mobile-safari from manual-real-device-browser',
        'runtimePolicy must exactly match PFX_MOBILE_RUNTIME_POLICY',
        'device must prove real touch hardware: maxTouchPoints > 0, pointerCoarse true, hoverNone true',
        'overdraw.measurementSource must be screenshot-readback',
        'userAgent must be Mobile Safari on iPhone or iPad hardware',
      ]),
    })
  })

  it('builds red-team blocking review rows from real-device audit findings', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const invalidSafariReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      overdraw: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').overdraw,
        measurementSource: 'browser-estimate' as const,
      },
    }
    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return invalidSafariReport
        return undefined
      },
    })
    const manifest = createPfxRedTeamBlockingReviewManifestFromRealDeviceAudit(audit, {
      reviewer: 'red-team-mobile-gate',
      reviewedAt: '2026-07-03T12:00:00.000Z',
    })
    const fireball = manifest.reviews.find((review) => review.effectId === 'fireball')

    expect(manifest.schema).toBe('game-bot.r3f-pfx-red-team-review.v1')
    expect(manifest.summary).toMatchObject({
      totalEffects: 500,
      signedOffEffects: 0,
      approvedDeferrals: 0,
      mobileSafariBlockedEffects: 500,
      chromeAndroidBlockedEffects: 500,
    })
    expect(fireball).toMatchObject({
      effectId: 'fireball',
      status: 'blocked',
      reviewer: 'red-team-mobile-gate',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      criteria: {
        'mobile-performance-proven': 'fail',
      },
      blockerFindings: [
        'Invalid mobile Safari real-device capture: .context/mobile-safari/fireball.json - invalid capture report for fireball on mobile-safari',
        'mobile-safari: overdraw.measurementSource must be screenshot-readback',
        'Missing valid Chrome Android real-device capture: .context/chrome-android/fireball.json',
      ],
    })
    expect(manifest.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'This adversarial manifest records blocking red-team findings from the real-device audit; it is not red-team signoff.',
        'Rows without mobile blockers remain pending until an independent red-team reviewer attacks the implementation and evidence.',
      ]),
    )
    expect(manifest.instructions.completionCommand).toBe('npm --prefix kits/juice/r3f-pfx-browser run verify:acceptance')
    expect(manifest.instructions.completionCommand).not.toContain('--final-acceptance')
  })

  it('rejects real-device captures without touch-capable browser evidence', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithoutTouchEvidence = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      device: {
        maxTouchPoints: 0,
        pointerCoarse: false,
        hoverNone: false,
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithoutTouchEvidence
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
    })
  })

  it('rejects real-device captures whose device label was left unspecified', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithoutConcreteDeviceLabel = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      capture: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').capture!,
        deviceLabel: 'Unspecified real device',
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithoutConcreteDeviceLabel
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining(['capture.deviceLabel must identify the concrete real device used for profiling']),
    })
  })

  it('rejects real-device captures whose device label still contains the auto-upload template placeholder', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithPlaceholderDeviceLabel = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      capture: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').capture!,
        deviceLabel: '{profileDeviceLabel}',
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithPlaceholderDeviceLabel
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining(['capture.deviceLabel must identify the concrete real device used for profiling']),
    })
  })

  it('rejects real-device captures whose device label is the operator launch placeholder', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithOperatorPlaceholderDeviceLabel = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      capture: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').capture!,
        deviceLabel: 'REPLACE_WITH_DEVICE_LABEL',
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithOperatorPlaceholderDeviceLabel
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining(['capture.deviceLabel must identify the concrete real device used for profiling']),
    })
  })

  it('rejects real-device captures whose device label embeds the auto-upload template placeholder', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const reportWithEmbeddedPlaceholderDeviceLabel = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      capture: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').capture!,
        deviceLabel: 'QA iPhone {profileDeviceLabel}',
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return reportWithEmbeddedPlaceholderDeviceLabel
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
      findings: expect.arrayContaining(['capture.deviceLabel must identify the concrete real device used for profiling']),
    })
  })

  it('rejects real-device captures whose report is not a single-effect measurement', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const multiEffectReport = {
      ...makeRealDeviceReport(fireballScenario, 'mobile-safari'),
      scenario: {
        ...makeRealDeviceReport(fireballScenario, 'mobile-safari').scenario,
        mode: 'stress' as const,
        effectCount: 2,
      },
    }

    const audit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return multiEffectReport
        return undefined
      },
    })

    expect(audit.summary).toMatchObject({
      validCaptures: 0,
      invalidCaptures: 1,
      fullyCapturedEffects: 0,
    })
    expect(audit.effects[0]?.platformStatus['mobile-safari']).toMatchObject({
      valid: false,
      reason: 'invalid capture report for fireball on mobile-safari',
    })
  })

  it('resolves profile suites for representative, authored, profile-backed, and full-catalog runs', () => {
    expect(resolveProfileScenarios('representative')).toHaveLength(6)
    expect(resolveProfileScenarios('authored')).toHaveLength(500)
    expect(resolveProfileScenarios('profile-backed')).toHaveLength(0)
    expect(resolveProfileScenarios('catalog-stress')).toHaveLength(CATALOG_STRESS_PROFILE_SCENARIOS.length)
    expect(resolveProfileScenarios('catalog')).toHaveLength(500)
    expect(resolveProfileScenarios('all')).toHaveLength(506 + CATALOG_STRESS_PROFILE_SCENARIOS.length)
    expect(() => resolveProfileScenarios('unknown')).toThrow(/Unknown profile suite/)
  })

  it('builds targeted single and repeated stress scenarios without suite overrides', () => {
    expect(createExplicitEffectProfileScenarios(['laser-spray'], 20)).toEqual([
      {
        id: 'explicit-laser-spray-single',
        mode: 'single',
        search: 'laser-spray',
        effectIds: ['laser-spray'],
        mobileSafeOnly: false,
      },
      {
        id: 'explicit-laser-spray-stress-20',
        mode: 'stress',
        search: 'laser-spray',
        effectIds: ['laser-spray'],
        stressCount: 20,
        mobileSafeOnly: false,
      },
    ])
    expect(() => createExplicitEffectProfileScenarios(['not-a-real-effect'], 20)).toThrow(/Unknown effect id/)
    expect(() => createExplicitEffectProfileScenarios(['laser-spray'], 0)).toThrow(/positive integer/)
  })

  it('measures effect coverage against a clean stage baseline instead of counting the grid', () => {
    const baseline = new Uint8Array([
      17, 24, 39, 255, 50, 50, 50, 255,
      17, 24, 39, 255, 60, 60, 60, 255,
    ])
    const effect = baseline.slice()
    effect.set([255, 120, 10, 255], 0)
    expect(countPfxDeltaPixels(effect, baseline, 2, 2)).toBe(1)
    expect(countPfxDeltaPixels(baseline, baseline, 2, 2)).toBe(0)
    expect(() => countPfxDeltaPixels(effect, baseline.subarray(0, 8), 2, 2)).toThrow(/dimensions/)
  })

  it('summarizes RAF frame samples with average, p95, fps, and worst frame metrics', () => {
    const summary = summarizeFrameSamples([16, 17, 15, 18, 20, 14, 16, 19, 22, 16])

    expect(summary.samples).toBe(10)
    expect(summary.averageFrameMs).toBe(17.3)
    expect(summary.p95FrameMs).toBe(22)
    expect(summary.worstFrameMs).toBe(22)
    expect(summary.fps).toBe(57.8)
  })

  it('creates a measured browser profile report with pass/fail thresholds', () => {
    const input: BrowserProfileInput = {
      capturedAt: '2026-07-03T00:00:00.000Z',
      url: 'http://127.0.0.1:4765/',
      userAgent: 'Playwright Chromium',
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
      scenario: {
        id: 'mobile-low-tier-20',
        mode: 'stress',
        effectCount: 20,
        totalParticles: 480,
        totalDrawCalls: 20,
        textureMemoryKb: 2048,
      },
      frameSamplesMs: [15, 16, 16, 16, 16, 16, 15, 15, 16, 16, 16, 16],
      webgl: {
        context: 'webgl2',
        vendor: 'Test Vendor',
        renderer: 'Test Renderer',
        version: 'WebGL 2.0',
        shadingLanguageVersion: 'WebGL GLSL ES 3.00',
        timerQueryExtension: 'EXT_disjoint_timer_query_webgl2',
        gpuTimerStatus: 'measured',
        gpuTimerMs: 0.42,
        notes: [],
      },
      canvas: {
        width: 390,
        height: 340,
        nonBackgroundPixels: 1600,
      },
    }

    const report = createBrowserProfileReport(input)

    expect(report.schema).toBe('game-bot.r3f-pfx-browser-profile.v1')
    expect(report.capture).toMatchObject({
      deviceClass: 'local-playwright',
      platform: 'local-chromium',
    })
    expect(report.frame.fps).toBeGreaterThanOrEqual(60)
    expect(report.frame.p95FrameMs).toBeLessThanOrEqual(16.7)
    expect(report.webgl).toMatchObject({
      context: 'webgl2',
      renderer: 'Test Renderer',
      timerQueryExtension: 'EXT_disjoint_timer_query_webgl2',
      gpuTimerStatus: 'measured',
      gpuTimerMs: 0.42,
    })
    expect(report.overdraw.nonBackgroundRatio).toBeCloseTo(0.012, 3)
    expect(report.thresholds.mobileLowTier.pass).toBe(true)
    expect(report.thresholds.mobileLowTier.failures).toEqual([])
  })

  it('fails mobile low-tier threshold when p95 or overdraw exceeds target', () => {
    const report = createBrowserProfileReport({
      capturedAt: '2026-07-03T00:00:00.000Z',
      url: 'http://127.0.0.1:4765/',
      userAgent: 'Playwright Chromium',
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
      scenario: {
        id: 'mobile-low-tier-40',
        mode: 'stress',
        effectCount: 40,
        totalParticles: 2560,
        totalDrawCalls: 80,
        textureMemoryKb: 4096,
      },
      frameSamplesMs: [16, 18, 30, 38, 42, 22],
      webgl: {
        context: 'webgl',
        vendor: 'Test Vendor',
        renderer: 'Fallback Renderer',
        version: 'WebGL 1.0',
        shadingLanguageVersion: 'WebGL GLSL ES 1.00',
        timerQueryExtension: 'unavailable',
        gpuTimerStatus: 'unsupported',
        gpuTimerMs: null,
        notes: ['timer query extension unavailable'],
      },
      canvas: {
        width: 390,
        height: 340,
        nonBackgroundPixels: 90000,
      },
    })

    expect(report.thresholds.mobileLowTier.pass).toBe(false)
    expect(report.thresholds.mobileLowTier.failures).toEqual(
      expect.arrayContaining([
        'p95 frame time exceeds 16.7ms',
        'non-background canvas ratio exceeds 0.6',
        'draw calls exceed mobile low-tier target',
      ]),
    )
    expect(report.webgl.gpuTimerStatus).toBe('unsupported')
    expect(report.webgl.gpuTimerMs).toBeNull()
  })

  it('caps single-effect canvas coverage at 0.35 while stress scenes allow 0.6', () => {
    const makeCoverageReport = (mode: 'single' | 'stress', nonBackgroundPixels: number) =>
      createBrowserProfileReport({
        capturedAt: '2026-07-09T00:00:00.000Z',
        url: 'http://127.0.0.1:4765/',
        userAgent: 'test-agent',
        viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
        scenario: {
          id: `coverage-${mode}`,
          mode,
          effectCount: mode === 'stress' ? 20 : 1,
          totalParticles: 480,
          totalDrawCalls: 40,
          textureMemoryKb: 1024,
        },
        frameSamplesMs: [8, 8, 9, 8, 9, 8],
        canvas: { width: 390, height: 340, nonBackgroundPixels },
      })

    // 0.459 ratio: fails the single-effect cap, passes the stress cap.
    const pixels = Math.round(390 * 340 * 0.459)
    expect(makeCoverageReport('single', pixels).thresholds.mobileLowTier.failures).toEqual([
      'non-background canvas ratio exceeds 0.35',
    ])
    expect(makeCoverageReport('stress', pixels).thresholds.mobileLowTier.pass).toBe(true)
  })

  it('uses screenshot pixel dimensions for canvas profiling so DPR does not skew ratios', () => {
    expect(
      profileCanvasFromScreenshot({
        screenshotWidth: 780,
        screenshotHeight: 680,
        nonBackgroundPixels: 15680,
      }),
    ).toEqual({
      width: 780,
      height: 680,
      nonBackgroundPixels: 15680,
      measurementSource: 'screenshot-readback',
    })
  })

  it('records whether overdraw evidence came from screenshot readback or browser-side estimates', () => {
    const report = createBrowserProfileReport({
      ...profileInputForScenario(PROFILE_SCENARIOS[0]),
      canvas: profileCanvasFromScreenshot({
        screenshotWidth: 200,
        screenshotHeight: 100,
        nonBackgroundPixels: 1000,
      }),
    })

    expect(report.overdraw).toMatchObject({
      measurementSource: 'screenshot-readback',
      nonBackgroundPixels: 1000,
      nonBackgroundRatio: 0.05,
    })
  })

  it('verifies measured evidence covers every accepted effect and catalog stress chunk', () => {
    const evidence = verifyPfxMeasuredProfileEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
    })

    expect(evidence.passed).toBe(true)
    expect(evidence.failures).toEqual([])
    expect(evidence.singleEffectCoverage).toMatchObject({
      authoredPreviewEffects: 500,
      profileBackedEffects: 0,
      totalEffects: 500,
      missingEffectIds: [],
    })
    expect(evidence.catalogStressCoverage).toMatchObject({
      chunks: CATALOG_STRESS_PROFILE_SCENARIOS.length,
      totalEffects: 500,
      missingEffectIds: [],
    })
    expect(evidence.thresholdFailures).toHaveLength(0)
    expect(evidence.worstP95FrameMs).toBeGreaterThan(0)
  })

  it('rejects malformed threshold reports even when failure details are empty', () => {
    const malformedScenario = AUTHORED_PROFILE_SCENARIOS[0]
    const malformedReport = {
      ...makePassingReport(malformedScenario),
      thresholds: {
        mobileLowTier: {
          pass: false,
          failures: [],
        },
      },
    }
    const authoredReports = AUTHORED_PROFILE_SCENARIOS.map((scenario) =>
      scenario.id === malformedScenario.id ? malformedReport : makePassingReport(scenario),
    )

    const evidence = verifyPfxMeasuredProfileEvidence({
      authoredReports,
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
    })

    expect(evidence.passed).toBe(false)
    expect(evidence.thresholdFailures).toEqual([
      {
        suite: 'authored',
        scenarioId: malformedScenario.id,
        failures: ['mobileLowTier threshold marked failed without failure details'],
      },
    ])
    expect(evidence.failures).toContain(
      `threshold failure in authored report: ${malformedScenario.id} (mobileLowTier threshold marked failed without failure details)`,
    )
  })

  it('builds a per-effect performance evidence matrix from authored and stress reports', () => {
    const matrix = createPfxEffectPerformanceEvidenceMatrix({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
    })

    expect(matrix.schema).toBe('game-bot.r3f-pfx-effect-performance-matrix.v1')
    expect(matrix.summary).toMatchObject({
      totalEffects: 500,
      effectsWithSingleEffectProfile: 500,
      effectsWithCatalogStressProfile: 500,
      effectsPassingLocalThresholds: 500,
      effectsRequiringRealDeviceProfiles: 500,
    })
    const fireball = matrix.effects.find((effect) => effect.effectId === 'fireball')
    expect(fireball).toMatchObject({
      effectId: 'fireball',
      status: 'local-profiled-requires-real-device',
      singleEffect: {
        suite: 'authored',
        scenarioId: 'authored-fireball-single',
        thresholdPassed: true,
      },
      catalogStress: {
        thresholdPassed: true,
      },
      realDevice: {
        mobileSafari: 'missing',
        chromeAndroid: 'missing',
      },
    })
    expect(fireball?.metrics.p95FrameMs).toBeGreaterThan(0)
    expect(fireball?.metrics.overdrawRatio).toBeGreaterThanOrEqual(0)
    expect(fireball?.metrics.singleEffect).toMatchObject({
      p95FrameMs: expect.any(Number),
      overdrawRatio: expect.any(Number),
      drawCalls: expect.any(Number),
      particles: expect.any(Number),
    })
    expect(fireball?.metrics.catalogStress).toMatchObject({
      p95FrameMs: expect.any(Number),
      overdrawRatio: expect.any(Number),
      drawCalls: expect.any(Number),
      particles: expect.any(Number),
    })
    expect(fireball?.metrics.singleEffect.particles).toBeLessThan(fireball?.metrics.catalogStress.particles ?? 0)
    expect(fireball?.profileEvidence).toEqual(
      expect.arrayContaining([
        'authored-profile:.context/r3f-pfx-authored-profile.json#authored-fireball-single',
        expect.stringMatching(/^catalog-stress-profile:\.context\/r3f-pfx-catalog-stress-profile\.json#catalog-stress-/),
        'mobile-safari-profile:.context/mobile-safari/fireball.json',
        'chrome-android-profile:.context/chrome-android/fireball.json',
      ]),
    )
  })

  it('fails the mobile low-tier threshold when p95 exceeds the 16.7ms 60fps budget', () => {
    const report = createBrowserProfileReport({
      capturedAt: '2026-07-03T00:00:00.000Z',
      url: 'http://127.0.0.1:4765/',
      userAgent: 'Playwright Chromium',
      viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
      scenario: {
        id: 'mobile-low-tier-20',
        mode: 'stress',
        effectCount: 20,
        totalParticles: 480,
        totalDrawCalls: 20,
        textureMemoryKb: 2048,
      },
      frameSamplesMs: [16, 16, 16, 17, 17, 17],
      webgl: {
        context: 'webgl2',
        vendor: 'Test Vendor',
        renderer: 'Test Renderer',
        version: 'WebGL 2.0',
        shadingLanguageVersion: 'WebGL GLSL ES 3.00',
        timerQueryExtension: 'EXT_disjoint_timer_query_webgl2',
        gpuTimerStatus: 'measured',
        gpuTimerMs: 0.42,
        notes: [],
      },
      canvas: {
        width: 390,
        height: 340,
        nonBackgroundPixels: 1600,
      },
    })

    expect(report.frame.p95FrameMs).toBe(17)
    expect(report.thresholds.mobileLowTier.pass).toBe(false)
    expect(report.thresholds.mobileLowTier.failures).toContain('p95 frame time exceeds 16.7ms')
  })

  it('combines measured profile evidence with the production-readiness gate for final acceptance', () => {
    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })

    expect(acceptance.schema).toBe('game-bot.r3f-pfx-browser-acceptance-evidence.v1')
    expect(acceptance.passed).toBe(false)
    expect(acceptance.measuredProfileEvidence.passed).toBe(true)
    expect(acceptance.productionReadiness.passed).toBe(false)
    expect(acceptance.productionReadiness.summary.effectsRequiringDecision).toBe(500)
    expect(acceptance.taxonomyReview).toMatchObject({
      schema: 'game-bot.r3f-pfx-taxonomy-review-evidence.v1',
      passed: false,
      summary: {
        totalEffects: 500,
        marketReviewedEffects: 0,
        pendingEffects: 500,
      },
    })
    expect(acceptance.productionGapAudit).toMatchObject({
      schema: 'game-bot.r3f-pfx-production-gap-audit.v1',
      summary: {
        effectsWithOpenGaps: 500,
        missingMobileSafariProfiles: 500,
        missingChromeAndroidProfiles: 500,
      },
    })
    expect(acceptance.productionGapAudit.effects[0]).toMatchObject({
      effectId: 'fireball',
      openGapCount: 5,
      gaps: expect.arrayContaining([
        {
          kind: 'approval-metadata',
          label: 'Final approval metadata',
          evidence: 'production-approval:.context/r3f-pfx-production-approvals.json#fireball',
          filePath: '.context/r3f-pfx-production-approvals.json',
        },
        {
          kind: 'mobile-safari-profile',
          label: 'Real-device mobile Safari profile',
          evidence: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
          filePath: '.context/mobile-safari/fireball.json',
          captureHandoff: {
            captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
            autoUploadUrl:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
            autoUploadUrlTemplate:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
            autoUploadRequiresDeviceLabel: true,
            outputFile: '.context/mobile-safari/fireball.json',
            evidenceReference: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
            captureUrlReachability: 'network-reachable',
          },
        },
        {
          kind: 'chrome-android-profile',
          label: 'Real-device Chrome Android profile',
          evidence: 'chrome-android-profile:.context/chrome-android/fireball.json',
          filePath: '.context/chrome-android/fireball.json',
          captureHandoff: {
            captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
            autoUploadUrl:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
            autoUploadUrlTemplate:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
            autoUploadRequiresDeviceLabel: true,
            outputFile: '.context/chrome-android/fireball.json',
            evidenceReference: 'chrome-android-profile:.context/chrome-android/fireball.json',
            captureUrlReachability: 'network-reachable',
          },
        },
      ]),
    })
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'taxonomy-review: 500 effects lack market-reviewed taxonomy approval',
        'production-readiness: 500 effects lack production implementation or approved deferral',
      ]),
    )
  })

  it('validates rendered Definition-of-Done smoke evidence before objective readiness cites it', () => {
    const validation = validatePfxDefinitionOfDoneSmokeEvidence(makeDefinitionOfDoneSmokeEvidence())

    expect(validation).toEqual({
      passed: true,
      findings: [],
    })

    const forgedValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      definitionOfDoneSearches: [],
      customizationEvidence: {
        editedControls: ['density'],
        fullControlSurfaceCovered: false,
        jsonPresetIncludesCustomizedControls: true,
        performanceRecomputedAfterCustomization: false,
      },
      exportEvidence: {
        componentSnippetIncludesFactory: false,
      },
      externalEvidenceHandoffHealth: undefined,
      realDeviceHandoffHealth: undefined,
      redTeamReviewHandoffHealth: undefined,
      productionApprovalHandoffHealth: undefined,
    })

    expect(forgedValidation.passed).toBe(false)
    expect(forgedValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: missing search proof for force field',
        'definition-of-done-smoke: missing customization proof for color',
        'definition-of-done-smoke: fullControlSurfaceCovered must be true',
        'definition-of-done-smoke: performanceRecomputedAfterCustomization must be true',
        'definition-of-done-smoke: componentSnippetIncludesFactory must be true',
        'definition-of-done-smoke: external evidence handoff health must be rendered and phone-ready',
        'definition-of-done-smoke: real-device handoff health must be rendered with valid batch files and command',
        'definition-of-done-smoke: red-team review handoff health must be rendered with valid batch files and command',
        'definition-of-done-smoke: production approval handoff health must be rendered with valid batch files and command',
      ]),
    )

    const weakCustomizationValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      customizationEvidence: {
        editedControls: [
          'color',
          'style',
          'scale',
          'density',
          'timing',
          'lifetime',
          'velocity',
          'gravity',
          'turbulence',
          'spawnShape',
          'texture',
          'flipbook',
          'blendMode',
          'emissiveBloom',
          'trailLength',
          'seed',
          'lod',
        ],
        fullControlSurfaceCovered: true,
        jsonPresetIncludesCustomizedControls: true,
        performanceRecomputedAfterCustomization: true,
      },
    })

    expect(weakCustomizationValidation.passed).toBe(false)
    expect(weakCustomizationValidation.findings).toContain(
      'definition-of-done-smoke: customization evidence must include the tuned JSON export values',
    )

    const missingFinalBlockerStatusValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceFinalAcceptanceStatus: 'Final acceptance ready.',
    })

    expect(missingFinalBlockerStatusValidation.passed).toBe(false)
    expect(missingFinalBlockerStatusValidation.findings).toContain(
      'definition-of-done-smoke: final blocker status must render real-device, red-team, and approval requirements',
    )

    const missingFinalBlockerCountsValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceFinalAcceptanceBlockerCounts: undefined,
    })

    expect(missingFinalBlockerCountsValidation.passed).toBe(false)
    expect(missingFinalBlockerCountsValidation.findings).toContain(
      'definition-of-done-smoke: final blocker counts must render Safari, Android, red-team, and approval blockers',
    )

    const staleFinalBlockerCountsValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceFinalAcceptanceBlockerCounts: {
        rendered: true,
        text: 'Final blockers: Safari 0; Android 0; red-team 0; approvals 0',
        missingMobileSafariProfiles: 0,
        missingChromeAndroidProfiles: 0,
        missingRedTeamSignoff: 0,
        pendingMetadataApprovals: 0,
      },
    })

    expect(staleFinalBlockerCountsValidation.passed).toBe(false)
    expect(staleFinalBlockerCountsValidation.findings).toContain(
      'definition-of-done-smoke: final blocker counts must show all four 500-count external blockers',
    )

    const staleProductionApprovalBlockersValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      productionApprovalHandoffHealth: {
        ...(makeDefinitionOfDoneSmokeEvidence().productionApprovalHandoffHealth as Record<string, unknown>),
        approvalBlockers: {
          missingMobileSafariProfiles: 0,
          missingChromeAndroidProfiles: 0,
          missingRedTeamSignoff: 0,
          pendingFinalApprovals: 0,
        },
      },
    })

    expect(staleProductionApprovalBlockersValidation.passed).toBe(false)
    expect(staleProductionApprovalBlockersValidation.findings).toContain(
      'definition-of-done-smoke: production approval handoff blockers must show all four 500-count external blockers',
    )

    const missingFullCatalogCountValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      countText: 'SHOWING 73 OF 73 MATCHES',
    })

    expect(missingFullCatalogCountValidation.passed).toBe(false)
    expect(missingFullCatalogCountValidation.findings).toContain(
      'definition-of-done-smoke: initial browser count must show all 500 effects',
    )

    const desktopViewportValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      viewport: { width: 1280, height: 720, deviceScaleFactor: 1, isMobile: false },
    })

    expect(desktopViewportValidation.passed).toBe(false)
    expect(desktopViewportValidation.findings).toContain(
      'definition-of-done-smoke: browser smoke must run in the mobile viewport',
    )

    const stalePreviewValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      manifest: {
        schema: 'game-bot.r3f-pfx-preview-manifest.v1',
        totalEffects: 500,
        forceFieldHasThumbnail: true,
        forceFieldHasAnimatedClip: true,
        forceFieldHasMarketSources: true,
      },
    })

    expect(stalePreviewValidation.passed).toBe(false)
    expect(stalePreviewValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: missing force field style contact sheet proof',
        'definition-of-done-smoke: missing force field control extremes contact sheet proof',
        'definition-of-done-smoke: force field preview assets must include concrete file names and animated frame count',
      ]),
    )

    const staleSearchValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      definitionOfDoneSearches: [
        { query: 'force field', expectedResultText: 'Fireball', resultCountText: 'SHOWING 1 OF 1 MATCHES' },
        { query: 'fireball', expectedResultText: 'Fireball', resultCountText: 'SHOWING 1 OF 1 MATCHES' },
        {
          query: 'cozy pickup sparkle',
          expectedResultText: 'Coin Pickup Sparkle',
          resultCountText: 'SHOWING 1 OF 1 MATCHES',
        },
        {
          query: 'mobile-safe hit impact',
          expectedResultText: 'Hit Spark',
          resultCountText: 'SHOWING 73 OF 73 MATCHES',
          mobileSafeFilter: false,
        },
      ],
    })

    expect(staleSearchValidation.passed).toBe(false)
    expect(staleSearchValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: search proof for force field must target Force Field',
        'definition-of-done-smoke: search proof for force field must target effect force-field',
        'definition-of-done-smoke: mobile-safe hit impact must prove the mobile-safe filter was enabled',
      ]),
    )

    const zeroResultSearchValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      definitionOfDoneSearches: [
        { query: 'force field', expectedResultText: 'Force Field', resultCountText: 'SHOWING 0 OF 0 MATCHES' },
        { query: 'fireball', expectedResultText: 'Fireball', resultCountText: 'SHOWING 1 OF 1 MATCHES' },
        {
          query: 'cozy pickup sparkle',
          expectedResultText: 'Coin Pickup Sparkle',
          resultCountText: 'SHOWING 1 OF 1 MATCHES',
        },
        {
          query: 'mobile-safe hit impact',
          expectedResultText: 'Hit Spark',
          resultCountText: 'SHOWING 73 OF 73 MATCHES',
          mobileSafeFilter: true,
        },
      ],
    })

    expect(zeroResultSearchValidation.passed).toBe(false)
    expect(zeroResultSearchValidation.findings).toContain(
      'definition-of-done-smoke: search proof for force field must show at least one rendered match',
    )

    const missingInvalidDesktopBlockValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      realDeviceCapturePanel: {
        effectId: 'fireball',
        platform: 'chrome-android',
        scenarioId: 'mobile-fireball-single',
        deviceClass: 'real-device',
        overdrawMeasurementSource: 'screenshot-readback',
        downloadFileName: 'fireball.json',
        downloadPayloadMatchesJson: true,
      },
    })

    expect(missingInvalidDesktopBlockValidation.passed).toBe(false)
    expect(missingInvalidDesktopBlockValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: capture panel must disable invalid desktop upload',
        'definition-of-done-smoke: capture panel must disable invalid desktop upload-and-continue',
        'definition-of-done-smoke: capture panel must render invalid desktop capture blocking finding',
      ]),
    )

    const missingCaptureScenarioValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      realDeviceCapturePanel: {
        effectId: 'fireball',
        platform: 'chrome-android',
        deviceClass: 'real-device',
        overdrawMeasurementSource: 'screenshot-readback',
        downloadFileName: 'fireball.json',
        downloadPayloadMatchesJson: true,
        uploadDisabledForInvalidDesktopCapture: true,
        continueDisabledForInvalidDesktopCapture: true,
        blockingFindingText:
          'This browser capture is not valid final real-device evidence: device touch metadata must prove real touch hardware',
      },
    })

    expect(missingCaptureScenarioValidation.passed).toBe(false)
    expect(missingCaptureScenarioValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: capture panel must use mobile-fireball-single scenario',
        'definition-of-done-smoke: capture panel must prove a single fireball effect with particles',
      ]),
    )

    const missingCaptureUrlReachabilityValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceHandoffHealth: {
        rendered: true,
        readyForPhoneCapture: true,
        batchScopedAutoUploadUrlItems: 1000,
        readyBatchScopedAutoUploadUrlItems: 1000,
        missingBatchScopedAutoUploadUrlItems: 0,
      },
    })

    expect(missingCaptureUrlReachabilityValidation.passed).toBe(false)
    expect(missingCaptureUrlReachabilityValidation.findings).toContain(
      'definition-of-done-smoke: external evidence handoff health must prove network-reachable capture URLs',
    )

    const missingPlatformLinksValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceHandoffHealth: {
        rendered: true,
        readyForPhoneCapture: true,
        captureUrlItems: 1000,
        networkReachableCaptureUrlItems: 1000,
        batchScopedAutoUploadUrlItems: 1000,
        readyBatchScopedAutoUploadUrlItems: 1000,
        missingBatchScopedAutoUploadUrlItems: 0,
      },
    })

    expect(missingPlatformLinksValidation.passed).toBe(false)
    expect(missingPlatformLinksValidation.findings).toContain(
      'definition-of-done-smoke: external evidence handoff health must render next mobile Safari and Chrome Android capture links',
    )

    const missingExternalWorkItemBreakdownValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceHandoffHealth: {
        rendered: true,
        readyForPhoneCapture: true,
        captureUrlItems: 1000,
        networkReachableCaptureUrlItems: 1000,
        batchScopedAutoUploadUrlItems: 1000,
        readyBatchScopedAutoUploadUrlItems: 1000,
        missingBatchScopedAutoUploadUrlItems: 0,
        autoUploadRequiresDeviceLabelItems: 1000,
        nextMobileSafariCaptureHref:
          'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
        nextMobileSafariAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel=Codex%20Smoke%20Phone',
        nextChromeAndroidCaptureHref:
          'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
        nextChromeAndroidAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel=Codex%20Smoke%20Phone',
        indexPath: '.context/r3f-pfx-external-evidence-batch-sheet-index.json',
        bulkCommand:
          'npm --prefix kits/juice/r3f-pfx-browser run export:external-evidence -- --external-evidence-batch-sheet-directory .context/external-evidence-batches',
      },
    })

    expect(missingExternalWorkItemBreakdownValidation.passed).toBe(false)
    expect(missingExternalWorkItemBreakdownValidation.findings).toContain(
      'definition-of-done-smoke: external evidence handoff must render exact remaining work item counts',
    )

    const missingDeviceLabelHandoffValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceHandoffHealth: {
        rendered: true,
        readyForPhoneCapture: true,
        captureUrlItems: 1000,
        networkReachableCaptureUrlItems: 1000,
        batchScopedAutoUploadUrlItems: 1000,
        readyBatchScopedAutoUploadUrlItems: 1000,
        missingBatchScopedAutoUploadUrlItems: 0,
        autoUploadRequiresDeviceLabelItems: 999,
        nextMobileSafariCaptureHref: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
        nextMobileSafariAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
        nextChromeAndroidCaptureHref: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
        nextChromeAndroidAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
        indexPath: '.context/r3f-pfx-external-evidence-batch-sheet-index.json',
        bulkCommand:
          'npm --prefix kits/juice/r3f-pfx-browser run export:external-evidence -- --external-evidence-batch-sheet-directory .context/external-evidence-batches',
      },
    })

    expect(missingDeviceLabelHandoffValidation.passed).toBe(false)
    expect(missingDeviceLabelHandoffValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: external evidence handoff must require device labels for every auto-upload item',
        'definition-of-done-smoke: external evidence handoff next auto-upload links must include a concrete profileDeviceLabel',
      ]),
    )

    const embeddedPlaceholderDeviceLabelValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      externalEvidenceHandoffHealth: {
        rendered: true,
        readyForPhoneCapture: true,
        captureUrlItems: 1000,
        networkReachableCaptureUrlItems: 1000,
        batchScopedAutoUploadUrlItems: 1000,
        readyBatchScopedAutoUploadUrlItems: 1000,
        missingBatchScopedAutoUploadUrlItems: 0,
        autoUploadRequiresDeviceLabelItems: 1000,
        taxonomyReviewItems: 0,
        productionImplementationItems: 0,
        mobileSafariCaptureItems: 500,
        chromeAndroidCaptureItems: 500,
        redTeamReviewItems: 500,
        finalApprovalItems: 500,
        nextMobileSafariCaptureHref:
          'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
        nextMobileSafariAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel=QA%20iPhone%20%7BprofileDeviceLabel%7D',
        nextChromeAndroidCaptureHref:
          'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
        nextChromeAndroidAutoUploadHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel=Codex%20Smoke%20Phone',
        indexPath: '.context/r3f-pfx-external-evidence-batch-sheet-index.json',
        bulkCommand:
          'npm --prefix kits/juice/r3f-pfx-browser run export:external-evidence -- --external-evidence-batch-sheet-directory .context/external-evidence-batches',
      },
    })

    expect(embeddedPlaceholderDeviceLabelValidation.passed).toBe(false)
    expect(embeddedPlaceholderDeviceLabelValidation.findings).toContain(
      'definition-of-done-smoke: external evidence handoff next auto-upload links must include a concrete profileDeviceLabel',
    )

    const weakExportEvidenceValidation = validatePfxDefinitionOfDoneSmokeEvidence({
      ...makeDefinitionOfDoneSmokeEvidence(),
      exportEvidence: {
        effectId: 'force-field',
        componentSnippetIncludesFactory: true,
        docsIncludeQualityRubric: true,
        docsIncludeProductionCaveat: true,
        jsonPresetIncludesQualityScores: true,
        jsonPresetIncludesStyleRender: true,
      },
    })

    expect(weakExportEvidenceValidation.passed).toBe(false)
    expect(weakExportEvidenceValidation.findings).toEqual(
      expect.arrayContaining([
        'definition-of-done-smoke: componentSnippetExportsNamedComponent must be true',
        'definition-of-done-smoke: componentSnippetUsesTypedProps must be true',
        'definition-of-done-smoke: docsIncludeComponentSnippet must be true',
      ]),
    )
  })

  it('rejects taxonomy review entries with spoofed criteria or non-URL market sources', () => {
    const incompleteCriteriaTemplate = createPfxTaxonomyReviewTemplate()
    incompleteCriteriaTemplate.reviews = incompleteCriteriaTemplate.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      marketSources: ['https://assetstore.unity.com/vfx'],
      criteria: { anything: 'pass' } as never,
      blockerFindings: [],
    }))

    const nonUrlSourcesTemplate = createPfxTaxonomyReviewTemplate()
    nonUrlSourcesTemplate.reviews = nonUrlSourcesTemplate.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      marketSources: ['source'],
      criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
      blockerFindings: [],
    }))

    expect(createPfxTaxonomyReviewEvidence(incompleteCriteriaTemplate).passed).toBe(false)
    expect(createPfxTaxonomyReviewEvidence(incompleteCriteriaTemplate).effects[0].blockers).toContain(
      'not all taxonomy review criteria pass',
    )
    expect(createPfxTaxonomyReviewEvidence(nonUrlSourcesTemplate).passed).toBe(false)
    expect(createPfxTaxonomyReviewEvidence(nonUrlSourcesTemplate).effects[0].blockers).toContain(
      'market source links are missing',
    )
  })

  it('rejects taxonomy review entries with non-ISO review timestamps', () => {
    const template = createPfxTaxonomyReviewTemplate()
    template.reviews = template.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: 'yesterday',
      marketSources: ['https://assetstore.unity.com/vfx'],
      criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
      blockerFindings: [],
    }))

    const evidence = createPfxTaxonomyReviewEvidence(template)

    expect(evidence.passed).toBe(false)
    expect(evidence.effects[0].blockers).toContain('reviewer metadata is not final')
  })

  it('rejects taxonomy review entries with generic review notes', () => {
    const template = createPfxTaxonomyReviewTemplate()
    template.reviews = template.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      marketSources: ['https://assetstore.unity.com/vfx'],
      criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
      blockerFindings: [],
      notes: 'Review complete.',
    }))

    const evidence = createPfxTaxonomyReviewEvidence(template)

    expect(evidence.passed).toBe(false)
    expect(evidence.effects[0].blockers).toContain('taxonomy review notes are not substantive')
  })

  it('rejects taxonomy review manifests with duplicate or unknown effect rows', () => {
    const validTemplate = createPfxTaxonomyReviewTemplate()
    validTemplate.reviews = validTemplate.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      marketSources: ['https://assetstore.unity.com/vfx'],
      criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
      blockerFindings: [],
    }))

    const duplicateTemplate = {
      ...validTemplate,
      reviews: [...validTemplate.reviews, { ...validTemplate.reviews[0] }],
    }
    const unknownTemplate = {
      ...validTemplate,
      reviews: [
        ...validTemplate.reviews,
        {
          ...validTemplate.reviews[0],
          effectId: 'not-in-taxonomy',
        },
      ],
    }

    expect(createPfxTaxonomyReviewEvidence(duplicateTemplate).passed).toBe(false)
    expect(createPfxTaxonomyReviewEvidence(duplicateTemplate).blockingFindings).toContain(
      'taxonomy review manifest has duplicate effect rows: fireball',
    )
    expect(createPfxTaxonomyReviewEvidence(unknownTemplate).passed).toBe(false)
    expect(createPfxTaxonomyReviewEvidence(unknownTemplate).blockingFindings).toContain(
      'taxonomy review manifest has unknown effect rows: not-in-taxonomy',
    )
  })

  it('does not use failed taxonomy review manifests to unlock production readiness', () => {
    const taxonomyReview = createPfxTaxonomyReviewTemplate()
    taxonomyReview.reviews = taxonomyReview.reviews.map((review) => ({
      ...review,
      status: 'market-reviewed',
      reviewer: 'taxonomy-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      marketSources: ['https://assetstore.unity.com/vfx'],
      criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
      blockerFindings: [],
    }))
    taxonomyReview.reviews = [...taxonomyReview.reviews, { ...taxonomyReview.reviews[0] }]

    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'fireball'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'fireball production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'fireball'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes: 'fireball adversarial review accepted implementation, mobile evidence, export, and documentation coverage.',
          }
        : review,
    )
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      taxonomyReview,
      productionImplementations: implementationTemplate.implementations,
      realDeviceCaptureAudit,
      redTeamReview: redTeamTemplate,
      productionApprovals: [
        {
          effectId: 'fireball',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for fireball.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#fireball',
            'production-implementation:.context/r3f-pfx-production-implementation.json#fireball',
            'mobile-safari-profile:.context/mobile-safari/fireball.json',
            'chrome-android-profile:.context/chrome-android/fireball.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#fireball',
          ],
        },
      ],
    })

    expect(acceptance.taxonomyReview.passed).toBe(false)
    expect(acceptance.productionReadiness.effects.find((effect) => effect.effectId === 'fireball')).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: expect.arrayContaining([
        'Record market-reviewed taxonomy evidence before final production approval.',
      ]),
    })
    expect(acceptance.productionReadiness.summary.productionReadyEffects).toBe(0)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'taxonomy-review: taxonomy review manifest has duplicate effect rows: fireball',
        'production-readiness: 500 effects lack market-reviewed taxonomy approval',
      ]),
    )
  })

  it('does not credit noncanonical production approval references as final approval evidence', () => {
    const approvals = normalizePfxProductionApprovals({
      schema: 'game-bot.r3f-pfx-production-approvals.v1',
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'red-team-lead',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale: 'Representative approval fixture for a production-ready PFX implementation.',
          evidence: [
            'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
          ],
        },
      ],
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionApprovals: approvals,
    })

    expect(approvals).toHaveLength(1)
    expect(acceptance.productionReadiness.summary).toMatchObject({
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(acceptance.productionGapAudit.effects.find((effect) => effect.effectId === 'force-field')?.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'production-implementation',
          evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        }),
        expect.objectContaining({
          kind: 'red-team-signoff',
          evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        }),
      ]),
    )
    expect(acceptance.productionReadiness.blockingFindings).toEqual(
      expect.arrayContaining([
        '500 effects lack production implementation or approved deferral',
        '500 effects lack red-team sign-off',
      ]),
    )
  })

  it('rejects production approval evidence files with placeholder metadata', () => {
    expect(() =>
      normalizePfxProductionApprovals([
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'TODO:red-team-reviewer',
          approvedAt: 'TODO:ISO-8601',
          rationale: 'TODO:describe production implementation, measured mobile performance, and red-team signoff.',
          evidence: [
            'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
          ],
        },
      ]),
    ).toThrow(/must include final approvedBy/i)
  })

  it('rejects production approval evidence files with rubber-stamped rationales', () => {
    expect(() =>
      normalizePfxProductionApprovals([
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale: 'Looks good.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ]),
    ).toThrow(/must include final rationale/i)
  })

  it('reports production approval rows whose rationale does not cite the reviewed evidence basis', () => {
    const approvals = normalizePfxProductionApprovals([
      ...PFX_PRESETS.map((preset, index) => ({
        effectId: preset.effectId,
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: `2026-07-03T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
        rationale:
          preset.effectId === 'force-field'
            ? 'Reviewed and approved for release.'
            : 'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for this effect.',
        evidence: [
          `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${preset.effectId}`,
          `production-implementation:.context/r3f-pfx-production-implementation.json#${preset.effectId}`,
          `mobile-safari-profile:.context/mobile-safari/${preset.effectId}.json`,
          `chrome-android-profile:.context/chrome-android/${preset.effectId}.json`,
          `red-team-signoff:.context/r3f-pfx-red-team-review.json#${preset.effectId}`,
        ],
      })),
    ])

    expect(collectInvalidPfxProductionApprovalRows(approvals)).toEqual([
      'force-field production-ready approval rationale must cite reviewed evidence basis',
    ])
  })

  it('reports production approval rationales that omit required evidence dimensions', () => {
    const approvals = normalizePfxProductionApprovals([
      ...PFX_PRESETS.map((preset, index) => ({
        effectId: preset.effectId,
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: `2026-07-03T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
        rationale:
          preset.effectId === 'force-field'
            ? 'Final approval reviewed implementation evidence and confirms the exported component is ready for production use.'
            : 'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for this effect.',
        evidence: [
          `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${preset.effectId}`,
          `production-implementation:.context/r3f-pfx-production-implementation.json#${preset.effectId}`,
          `mobile-safari-profile:.context/mobile-safari/${preset.effectId}.json`,
          `chrome-android-profile:.context/chrome-android/${preset.effectId}.json`,
          `red-team-signoff:.context/r3f-pfx-red-team-review.json#${preset.effectId}`,
        ],
      })),
    ])

    expect(collectInvalidPfxProductionApprovalRows(approvals)).toEqual([
      'force-field production-ready approval rationale must cite reviewed evidence basis',
    ])
  })

  it('rejects production approval manifest objects with noncanonical schemas', () => {
    expect(() =>
      normalizePfxProductionApprovals({
        schema: 'game-bot.r3f-pfx-external-evidence-work-order.v1',
        approvals: [
          {
            effectId: 'force-field',
            decision: 'production-ready',
            approvedBy: 'production-approver',
            approvedAt: '2026-07-03T12:00:00.000Z',
            rationale: 'Representative approval fixture.',
            evidence: ['taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field'],
          },
        ],
      }),
    ).toThrow(/production approval manifest schema/i)
  })

  it('rejects production approval evidence files with non-ISO approval timestamps', () => {
    expect(() =>
      normalizePfxProductionApprovals([
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: 'July 3 2026 noon',
          rationale: 'Representative approval fixture with a human-readable timestamp.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ]),
    ).toThrow(/must include ISO approvedAt/i)
  })

  it('feeds structured production implementation evidence into acceptance gap accounting', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionImplementations: implementationTemplate.implementations,
    })

    expect(acceptance.passed).toBe(false)
    expect(acceptance.productionReadiness.summary).toMatchObject({
      productionImplementedEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(acceptance.productionGapAudit.summary.missingProductionImplementation).toBe(499)
    expect(acceptance.productionReadiness.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack production implementation or approved deferral',
        '500 effects lack mobile Safari and Chrome Android profiling evidence',
        '500 effects lack red-team sign-off',
        '500 effects lack final production approval or approved deferral',
      ]),
    )
  })

  it('feeds structured red-team review evidence into acceptance gap accounting', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes: 'force-field adversarial review accepted implementation evidence, mobile profile evidence, export cleanliness, and documentation coverage.',
          }
        : review,
    )
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(forceFieldScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/force-field.json') return safariReport
        if (outputFile === '.context/chrome-android/force-field.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })
    const taxonomyReview = createPfxTaxonomyReviewTemplate()
    taxonomyReview.reviews = taxonomyReview.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'market-reviewed',
            reviewer: 'taxonomy-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            marketSources: ['https://assetstore.unity.com/vfx'],
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes: 'force-field market taxonomy fixture.',
          }
        : review,
    )

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionImplementations: implementationTemplate.implementations,
      redTeamReview: redTeamTemplate,
      realDeviceCaptureAudit,
      taxonomyReview,
    })

    expect(acceptance.passed).toBe(false)
    expect(acceptance.productionReadiness.summary).toMatchObject({
      productionImplementedEffects: 1,
      redTeamSignedOffEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(acceptance.productionGapAudit.summary).toMatchObject({
      missingProductionImplementation: 499,
      missingRedTeamSignoff: 499,
    })
  })

  it('feeds strict real-device capture audit evidence into acceptance gap accounting', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball', 'force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit,
    })

    expect(acceptance.passed).toBe(false)
    expect(acceptance.productionReadiness.summary).toMatchObject({
      realDeviceProfiledEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(acceptance.productionGapAudit.summary).toMatchObject({
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 499,
    })
  })

  it('feeds one-platform real-device capture audit evidence into platform-specific gaps', () => {
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/force-field.json') return safariReport
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit,
    })

    const forceFieldGaps = acceptance.productionGapAudit.effects
      .find((effect) => effect.effectId === 'force-field')
      ?.gaps.map((gap) => gap.kind)
    expect(acceptance.productionReadiness.summary.realDeviceProfiledEffects).toBe(0)
    expect(forceFieldGaps).not.toContain('mobile-safari-profile')
    expect(forceFieldGaps).toContain('chrome-android-profile')
    expect(acceptance.productionGapAudit.summary).toMatchObject({
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 500,
    })
    expect(acceptance.productionReadiness.blockingFindings).toEqual(
      expect.arrayContaining([
        'real-device profile evidence for force-field must include both mobile Safari and Chrome Android profiles',
      ]),
    )
  })

  it('does not credit real-device capture files that bundle extra reports', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const bundledReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return makeProfileRun([safariReport, bundledReport])
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit,
    })

    expect(realDeviceCaptureAudit.effects[0].fullyCaptured).toBe(false)
    expect(acceptance.productionReadiness.summary.realDeviceProfiledEffects).toBe(0)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'production-readiness: 500 effects lack mobile Safari profiling evidence',
        'production-readiness: 499 effects lack Chrome Android profiling evidence',
      ]),
    )
    expect(realDeviceCaptureAudit.effects[0].platformStatus['mobile-safari'].findings).toContain(
      'capture file must contain exactly one profile report for fireball',
    )
  })

  it('does not credit real-device capture audits with noncanonical schemas', () => {
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return chromeReport
        return undefined
      },
    })
    ;(realDeviceCaptureAudit as { schema: string }).schema = 'game-bot.r3f-pfx-external-evidence-work-order.v1'

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit,
    })

    expect(acceptance.productionReadiness.summary.realDeviceProfiledEffects).toBe(0)
    expect(acceptance.blockingFindings).toContain(
      'real-device-audit: schema expected game-bot.r3f-pfx-real-device-capture-audit.v1 but found game-bot.r3f-pfx-external-evidence-work-order.v1',
    )
  })

  it('reports malformed real-device capture audit objects without throwing', () => {
    const realDeviceCaptureAudit = {
      schema: 'game-bot.r3f-pfx-real-device-capture-audit.v1',
      passed: true,
      summary: {},
    } as unknown as ReturnType<typeof createPfxRealDeviceCaptureAudit>

    expect(() =>
      createPfxBrowserAcceptanceEvidence({
        authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
        profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
        catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
        representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
        realDeviceCaptureAudit,
      }),
    ).not.toThrow()

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit,
    })

    expect(acceptance.productionReadiness.summary.realDeviceProfiledEffects).toBe(0)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'real-device-audit: effects must be an array',
        'real-device-audit: summary platforms expected mobile-safari, chrome-android but found missing',
      ]),
    )
  })

  it('does not approve production-ready rows that omit canonical evidence references even when side-channel evidence exists', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale:
          'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
        evidence: [],
      },
    ])
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted real-device mobile performance evidence, export cleanliness, control safety, and documentation coverage while final approval remains blocked.',
          }
        : review,
    )
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(forceFieldScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/force-field.json') return safariReport
        if (outputFile === '.context/chrome-android/force-field.json') return chromeReport
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionApprovals: approvals,
      productionImplementations: implementationTemplate.implementations,
      redTeamReview: redTeamTemplate,
      realDeviceCaptureAudit,
    })

    expect(acceptance.productionReadiness.summary).toMatchObject({
      productionImplementedEffects: 1,
      realDeviceProfiledEffects: 1,
      redTeamSignedOffEffects: 1,
      productionReadyEffects: 0,
    })
    expect(acceptance.productionGapAudit.effects.find((effect) => effect.effectId === 'force-field')?.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'production-implementation' }),
        expect.objectContaining({ kind: 'mobile-safari-profile' }),
        expect.objectContaining({ kind: 'chrome-android-profile' }),
        expect.objectContaining({ kind: 'red-team-signoff' }),
      ]),
    )
  })

  it('does not credit forged real-device audit rows that are not structurally valid', () => {
    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      realDeviceCaptureAudit: {
        schema: 'game-bot.r3f-pfx-real-device-capture-audit.v1',
        passed: true,
        summary: {
          totalEffects: 1,
          requiredCaptures: 2,
          validCaptures: 2,
          missingCaptures: 0,
          invalidCaptures: 0,
          fullyCapturedEffects: 1,
          platforms: ['mobile-safari', 'chrome-android'],
        },
        effects: [
          {
            effectId: 'fireball',
            rank: 1,
            fullyCaptured: true,
            platformStatus: {
              'mobile-safari': {
                valid: true,
                outputFile: '.context/mobile-safari/fireball.json',
                reason: 'valid',
                findings: [],
              },
              'chrome-android': {
                valid: false,
                outputFile: '.context/chrome-android/fireball.json',
                reason: 'missing capture file',
                findings: ['missing capture file'],
              },
            },
          },
        ],
      },
    })

    expect(acceptance.productionReadiness.summary.realDeviceProfiledEffects).toBe(0)
    expect(acceptance.productionGapAudit.summary.missingMobileSafariProfiles).toBe(500)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'real-device-audit: fireball fullyCaptured does not match platform validity',
        'real-device-audit: summary validCaptures expected 1 but found 2',
      ]),
    )
  })

  it('exposes approval-readiness worklist for effects with all prerequisite evidence', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'fireball'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'fireball production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'fireball'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes: 'fireball adversarial review accepted implementation, mobile evidence, export, and documentation coverage.',
          }
        : review,
    )
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })
    const taxonomyReview = createPfxTaxonomyReviewTemplate()
    taxonomyReview.reviews = taxonomyReview.reviews.map((review) =>
      review.effectId === 'fireball'
        ? {
            ...review,
            status: 'market-reviewed',
            reviewer: 'taxonomy-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            marketSources: ['https://assetstore.unity.com/vfx'],
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'fireball taxonomy review accepted source-observed need, rank rationale, family balance, duplicate risk, and market-source linkage.',
          }
        : review,
    )

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionImplementations: implementationTemplate.implementations,
      redTeamReview: redTeamTemplate,
      realDeviceCaptureAudit,
      taxonomyReview,
    })

    expect(acceptance.productionApprovalReadiness.summary).toMatchObject({
      readyForApprovalEffects: 1,
      missingPrerequisiteEffects: 499,
    })
    expect(acceptance.productionApprovalReadiness.effects.find((effect) => effect.effectId === 'fireball')).toMatchObject({
      status: 'ready-for-approval',
      missingPrerequisites: [],
    })
  })

  it('does not report a malformed production approval manifest when local acceptance has no approval file', () => {
    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
    })

    expect(acceptance.passed).toBe(false)
    expect(acceptance.blockingFindings).not.toEqual(
      expect.arrayContaining([expect.stringContaining('production approval manifest is missing effect rows')]),
    )
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'production-readiness: 500 effects lack final production approval or approved deferral',
      ]),
    )
  })

  it('rejects red-team signoff from the same actor who approved the implementation', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'fireball'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'same-reviewer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'fireball production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'fireball'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'same-reviewer',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'fireball adversarial review accepted mobile performance evidence, implementation coverage, export cleanliness, and control safety before independence validation rejected the shared actor.',
          }
        : review,
    )
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const safariReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(fireballScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['fireball'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/fireball.json') return safariReport
        if (outputFile === '.context/chrome-android/fireball.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionImplementations: implementationTemplate.implementations,
      redTeamReview: redTeamTemplate,
      realDeviceCaptureAudit,
    })

    expect(acceptance.productionReadiness.summary.redTeamSignedOffEffects).toBe(0)
    expect(acceptance.productionApprovalReadiness.summary.readyForApprovalEffects).toBe(0)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'production-readiness: red-team reviewer same-reviewer also approved implementation for fireball',
      ]),
    )
  })

  it('rejects final production approval from the same actor who approved implementation or red-team review', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'pfx-implementer',
        approvedAt: '2026-07-03T12:30:00.000Z',
        rationale:
          'Final approval fixture reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff while retaining a non-independent final approver.',
        evidence: [
          'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
          'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
          'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        ],
      },
    ])
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:10:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted mobile performance evidence, implementation coverage, export cleanliness, and control safety before final approver independence validation.',
          }
        : review,
    )
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const chromeReport = makeRealDeviceReport(forceFieldScenario, 'chrome-android')
    const realDeviceCaptureAudit = createPfxRealDeviceCaptureAudit({
      effectIds: ['force-field'],
      readCapture: (outputFile) => {
        if (outputFile === '.context/mobile-safari/force-field.json') return safariReport
        if (outputFile === '.context/chrome-android/force-field.json') return makeProfileRun([chromeReport])
        return undefined
      },
    })

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionApprovals: approvals,
      productionImplementations: implementationTemplate.implementations,
      redTeamReview: redTeamTemplate,
      realDeviceCaptureAudit,
    })

    expect(acceptance.productionReadiness.summary.productionReadyEffects).toBe(0)
    expect(acceptance.productionReadiness.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
    })
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'production-readiness: final approver pfx-implementer also approved implementation for force-field',
      ]),
    )
  })

  it('rejects production approval manifests with duplicate or unknown effect rows', () => {
    const approvals = normalizePfxProductionApprovals([
      ...PFX_PRESETS.filter((preset) => preset.effectId !== 'force-field').map((preset, index) => ({
        effectId: preset.effectId,
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: `2026-07-03T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
        rationale: 'Representative approval fixture.',
        evidence: [],
      })),
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: [],
      },
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:01:00.000Z',
        rationale: 'Duplicate approval fixture.',
        evidence: [],
      },
      {
        effectId: 'not-in-taxonomy',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:02:00.000Z',
        rationale: 'Unknown approval fixture.',
        evidence: [],
      },
    ])

    expect(collectInvalidPfxProductionApprovalRows(approvals)).toEqual(
      expect.arrayContaining([
        'production approval manifest has duplicate effect rows: force-field',
        'production approval manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('rejects production approval rows whose evidence is not the exact canonical set for the decision', () => {
    const approvals = normalizePfxProductionApprovals([
      ...PFX_PRESETS.map((preset, index) => ({
        effectId: preset.effectId,
        decision: 'production-ready',
        approvedBy: 'final-production-approver',
        approvedAt: `2026-07-03T12:${String(index % 60).padStart(2, '0')}:00.000Z`,
        rationale:
          'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for this effect.',
        evidence: [
          `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${preset.effectId}`,
          `production-implementation:.context/r3f-pfx-production-implementation.json#${preset.effectId}`,
          `mobile-safari-profile:.context/mobile-safari/${preset.effectId}.json`,
          `chrome-android-profile:.context/chrome-android/${preset.effectId}.json`,
          `red-team-signoff:.context/r3f-pfx-red-team-review.json#${preset.effectId}`,
          ...(preset.effectId === 'fireball' ? ['manual-note:non-canonical-extra-evidence'] : []),
        ],
      })),
    ])

    expect(collectInvalidPfxProductionApprovalRows(approvals)).toEqual([
      'fireball production-ready approval evidence must exactly match canonical references',
    ])
  })

  it('includes invalid production approval rows in the final acceptance blockers', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: [
          'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
          'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        ],
      },
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:01:00.000Z',
        rationale: 'Duplicate approval fixture.',
        evidence: [],
      },
      {
        effectId: 'not-in-taxonomy',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:02:00.000Z',
        rationale: 'Unknown approval fixture.',
        evidence: [],
      },
    ])

    const acceptance = createPfxBrowserAcceptanceEvidence({
      authoredReports: AUTHORED_PROFILE_SCENARIOS.map(makePassingReport),
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.map(makePassingReport),
      representativeReports: PROFILE_SCENARIOS.map(makePassingReport),
      productionApprovals: approvals,
    })

    expect(acceptance.passed).toBe(false)
    expect(acceptance.blockingFindings).toEqual(
      expect.arrayContaining([
        'production-approvals: production approval manifest has duplicate effect rows: force-field',
        'production-approvals: production approval manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('reports missing local production approval evidence references before final acceptance', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: [
          'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
          'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
        ],
      },
    ])

    const missing = collectMissingPfxProductionApprovalEvidencePaths(
      approvals,
      (filePath) =>
        filePath === 'modules/juice/r3f-pfx-library/src/index.tsx' ||
        filePath === 'docs/r3f-pfx-library-red-team.md',
    )

    expect(missing).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
      },
      {
        effectId: 'force-field',
        evidence: 'chrome-android-profile:.context/chrome-android/force-field.json',
        filePath: '.context/chrome-android/force-field.json',
      },
    ])
  })

  it('reports unprobeable local production approval evidence references instead of throwing', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field'],
      },
    ])

    expect(() =>
      collectMissingPfxProductionApprovalEvidencePaths(approvals, () => {
        throw new Error('permission denied')
      }),
    ).not.toThrow()
    expect(
      collectMissingPfxProductionApprovalEvidencePaths(approvals, () => {
        throw new Error('permission denied')
      }),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
        filePath: 'modules/juice/r3f-pfx-library/src/index.tsx',
      },
    ])
  })

  it('reports unreadable profile evidence instead of throwing', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    expect(() =>
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => {
        throw new Error('permission denied')
      }),
    ).not.toThrow()
    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => {
        throw new Error('permission denied')
      }),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'invalid mobile Safari profile evidence file: permission denied',
      },
    ])
  })

  it('rejects approval profile evidence from the wrong platform or effect target', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: [
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
        ],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const issues = collectInvalidPfxProductionApprovalProfileEvidence(approvals, (filePath) => {
      if (filePath === '.context/mobile-safari/force-field.json') {
        return makePassingReport(forceFieldScenario)
      }
      if (filePath === '.context/chrome-android/force-field.json') {
        return {
          ...makePassingReport(fireballScenario),
          userAgent:
            'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        }
      }
      throw new Error(`unexpected path ${filePath}`)
    })

    expect(issues).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
      {
        effectId: 'force-field',
        evidence: 'chrome-android-profile:.context/chrome-android/force-field.json',
        filePath: '.context/chrome-android/force-field.json',
        reason: 'missing Chrome Android profile report for force-field',
      },
    ])
  })

  it('rejects approval profile evidence that only substring-matches the effect id', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])
    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const spoofedScenario = {
      ...forceFieldScenario,
      id: 'authored-force-field-plus-single',
      search: 'force-field-plus',
    }

    const issues = collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => ({
      ...makePassingReport(spoofedScenario),
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      capture: {
        deviceClass: 'real-device' as const,
        platform: 'mobile-safari' as const,
        deviceLabel: 'iPhone 15 Pro',
        runner: 'manual-real-device-browser',
        notes: [],
      },
    }))

    expect(issues).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
    ])
  })

  it('accepts approval profile evidence when both mobile platforms match the approved effect', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: [
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
        ],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const chromeAndroidReport = makeRealDeviceReport(forceFieldScenario, 'chrome-android')

    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, (filePath) => {
        if (filePath === '.context/mobile-safari/force-field.json') return safariReport
        if (filePath === '.context/chrome-android/force-field.json') return makeProfileRun([chromeAndroidReport])
        throw new Error(`unexpected path ${filePath}`)
      }),
    ).toEqual([])
  })

  it('rejects approval profile evidence files with extra bundled reports', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const fireballScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'fireball')!
    const forceFieldReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')
    const fireballReport = makeRealDeviceReport(fireballScenario, 'mobile-safari')

    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => makeProfileRun([forceFieldReport, fireballReport])),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'invalid mobile Safari profile evidence file: expected exactly one profile report for force-field',
      },
    ])
  })

  it('rejects profile run wrappers with noncanonical schemas', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')

    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => ({
        schema: 'game-bot.r3f-pfx-external-evidence-work-order.v1',
        reports: [safariReport],
      })),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason:
          'invalid mobile Safari profile evidence file: expected a browser profile report or canonical profile run with reports',
      },
    ])
  })

  it('rejects schema-less profile run wrappers for production approval evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')

    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => ({
        reports: [safariReport],
      })),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason:
          'invalid mobile Safari profile evidence file: expected a browser profile report or canonical profile run with reports',
      },
    ])
  })

  it('rejects raw profile report arrays for production approval evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const safariReport = makeRealDeviceReport(forceFieldScenario, 'mobile-safari')

    expect(collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => [safariReport])).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason:
          'invalid mobile Safari profile evidence file: expected a browser profile report or canonical profile run with reports',
      },
    ])
  })

  it('rejects malformed profile reports without throwing through evidence validation', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const malformedReport = {
      ...makeRealDeviceReport(AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!, 'mobile-safari'),
      scenario: undefined,
    }

    expect(() => collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => malformedReport)).not.toThrow()
    expect(collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => malformedReport)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
    ])
  })

  it('rejects approval profile evidence with malformed failed threshold details', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const report = {
      ...makeRealDeviceReport(forceFieldScenario, 'mobile-safari'),
      thresholds: {
        mobileLowTier: {
          pass: false,
          failures: [404],
        },
      },
    }

    expect(collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => report)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
    ])
  })

  it('rejects approval profile evidence with non-ISO capture timestamps', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const report = {
      ...makeRealDeviceReport(forceFieldScenario, 'mobile-safari'),
      capturedAt: 'yesterday',
    }

    expect(collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => report)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
    ])
  })

  it('rejects approval profile evidence with spoofed mobile user agents but no real-device capture metadata', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['mobile-safari-profile:.context/mobile-safari/force-field.json'],
      },
    ])

    const forceFieldScenario = AUTHORED_PROFILE_SCENARIOS.find((scenario) => scenario.search === 'force-field')!
    const spoofedSafariReport = {
      ...makePassingReport(forceFieldScenario),
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    }

    expect(
      collectInvalidPfxProductionApprovalProfileEvidence(approvals, () => spoofedSafariReport),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        filePath: '.context/mobile-safari/force-field.json',
        reason: 'missing mobile Safari profile report for force-field',
      },
    ])
  })

  it('rejects red-team signoff and implementation evidence when referenced text does not support the approval', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: [
          'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
        ],
      },
    ])

    const issues = collectInvalidPfxProductionApprovalTextEvidence(approvals, (filePath) => {
      if (filePath === 'modules/juice/r3f-pfx-library/src/index.tsx') return "export const forceField = 'force-field'"
      if (filePath === 'docs/r3f-pfx-library-red-team.md') {
        return '# R3F PFX Library Red-Team Gate\n\nStatus: **not signed off**.\n'
      }
      throw new Error(`unexpected path ${filePath}`)
    })

    expect(issues).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
        filePath: 'modules/juice/r3f-pfx-library/src/index.tsx',
        reason: 'production implementation evidence does not reference force-field',
      },
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects loose prose as production implementation or red-team signoff evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: [
          'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
        ],
      },
    ])

    expect(
      collectInvalidPfxProductionApprovalTextEvidence(approvals, (filePath) => {
        if (filePath === 'modules/juice/r3f-pfx-library/src/index.tsx') {
          return "export const forceFieldProductionImplementation = 'force-field'"
        }
        if (filePath === 'docs/r3f-pfx-library-red-team.md') {
          return '# R3F PFX Library Red-Team Gate\n\nStatus: **signed off**.\n\nforce-field production-ready signoff.\n'
        }
        throw new Error(`unexpected path ${filePath}`)
      }),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:modules/juice/r3f-pfx-library/src/index.tsx#force-field',
        filePath: 'modules/juice/r3f-pfx-library/src/index.tsx',
        reason: 'production implementation evidence does not reference force-field',
      },
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('reports unreadable structured text evidence instead of throwing', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture for a production-ready PFX implementation.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])

    expect(() =>
      collectInvalidPfxProductionApprovalTextEvidence(approvals, () => {
        throw new Error('permission denied')
      }),
    ).not.toThrow()
    expect(
      collectInvalidPfxProductionApprovalTextEvidence(approvals, () => {
        throw new Error('permission denied')
      }),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence file is unreadable: permission denied',
      },
    ])
  })

  it('accepts structured production implementation manifests for implementation evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'production-ready',
          implementedBy: 'pfx-implementer',
          implementedAt: '2026-07-03T12:00:00.000Z',
          sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'pass',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: [],
          notes:
            'force-field production implementation exports the typed R3F component, authored recipe, safe controls, preview evidence, and documentation.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([])
  })

  it('rejects structured production implementation manifests with non-ISO implementation timestamps', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'production-ready',
          implementedBy: 'pfx-implementer',
          implementedAt: 'last Friday',
          sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'pass',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: [],
          notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence does not reference force-field',
      },
    ])
  })

  it('rejects structured production implementation manifests with non-canonical source paths', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'production-ready',
          implementedBy: 'pfx-implementer',
          implementedAt: '2026-07-03T12:00:00.000Z',
          sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#fireball',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'pass',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: [],
          notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence does not reference force-field',
      },
    ])
  })

  it('requires final approval taxonomy evidence to be a structured market-reviewed taxonomy manifest', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field'],
      },
    ])
    const makeTaxonomyManifest = (status: 'market-reviewed' | 'pending') => {
      const template = createPfxTaxonomyReviewTemplate()
      return JSON.stringify({
        ...template,
        reviews: template.reviews.map((review) =>
          review.effectId === 'force-field'
            ? {
                ...review,
                status,
                reviewer: 'taxonomy-lead',
                reviewedAt: '2026-07-03T12:00:00.000Z',
                marketSources: ['https://assetstore.unity.com/vfx'],
                criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])),
                blockerFindings: [],
                notes:
                  'force-field taxonomy review accepted source-observed need, rank rationale, family balance, duplicate risk, and market-source linkage.',
              }
            : review,
        ),
      })
    }

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => makeTaxonomyManifest('market-reviewed'))).toEqual([])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => makeTaxonomyManifest('pending'))).toEqual([
      {
        effectId: 'force-field',
        evidence: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        filePath: '.context/r3f-pfx-taxonomy-review.json',
        reason: 'taxonomy review evidence is not market-reviewed for force-field',
      },
    ])

    const marketReviewedManifest = JSON.parse(makeTaxonomyManifest('market-reviewed'))
    const forceFieldReview = marketReviewedManifest.reviews.find(
      (review: { effectId: string }) => review.effectId === 'force-field',
    )
    const duplicateManifest = JSON.stringify({
      ...marketReviewedManifest,
      reviews: [...marketReviewedManifest.reviews, forceFieldReview],
    })
    const unknownManifest = JSON.stringify({
      ...marketReviewedManifest,
      reviews: [...marketReviewedManifest.reviews, { ...forceFieldReview, effectId: 'not-in-taxonomy' }],
    })
    const partialManifest = JSON.stringify({
      ...marketReviewedManifest,
      reviews: [forceFieldReview],
    })
    const malformedManifest = JSON.stringify({
      ...marketReviewedManifest,
      reviews: [...marketReviewedManifest.reviews, { status: 'market-reviewed' }],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => duplicateManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        filePath: '.context/r3f-pfx-taxonomy-review.json',
        reason: 'taxonomy review evidence manifest has duplicate effect rows: force-field',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => unknownManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        filePath: '.context/r3f-pfx-taxonomy-review.json',
        reason: 'taxonomy review evidence manifest has unknown effect rows: not-in-taxonomy',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => partialManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        filePath: '.context/r3f-pfx-taxonomy-review.json',
        reason:
          'taxonomy review evidence manifest is missing effect rows: fireball, explosion, smoke-puff, muzzle-flash, hit-spark, healing-aura, slash-trail, loot-beam, footstep-dust, shield-break, poison-cloud, ui-reward-burst, charge-telegraph, spawn-marker, dissolve, portal-idle-loop, projectile-trail, underwater-bubbles, snow-gust, low-health-screen-particles ... 479 more',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => malformedManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        filePath: '.context/r3f-pfx-taxonomy-review.json',
        reason: 'taxonomy review evidence manifest has malformed effect rows',
      },
    ])
  })

  it('rejects structured production implementation manifests with placeholder implementation notes', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'production-ready',
          implementedBy: 'pfx-implementer',
          implementedAt: '2026-07-03T12:00:00.000Z',
          sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'pass',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: [],
          notes: 'TODO:record production implementation notes, exported component evidence, and safe customization decisions.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence does not reference force-field',
      },
    ])
  })

  it('rejects structured production implementation manifests with generic implementation notes', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'production-ready',
          implementedBy: 'pfx-implementer',
          implementedAt: '2026-07-03T12:00:00.000Z',
          sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#force-field',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'pass',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: [],
          notes: 'Implementation complete.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence does not reference force-field',
      },
    ])
  })

  it('rejects non-approving external evidence batch sheets as final approval evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: [
          'production-implementation:.context/r3f-pfx-external-evidence-batch-001.json#force-field',
          'red-team-signoff:.context/r3f-pfx-external-evidence-batch-001.json#force-field',
        ],
      },
    ])
    const batchSheet = JSON.stringify({
      schema: 'game-bot.r3f-pfx-external-evidence-batch-sheet.v1',
      instructions: {
        approvalStatus: 'non-approving-external-evidence-batch-sheet',
      },
      batch: {
        batchId: 'external-evidence-batch-001',
      },
      effects: [
        {
          effectId: 'force-field',
          workItems: [
            { id: 'production-implementation', evidenceReference: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field' },
            { id: 'red-team-review', evidenceReference: '.context/r3f-pfx-red-team-review.json#force-field' },
          ],
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => batchSheet)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-external-evidence-batch-001.json#force-field',
        filePath: '.context/r3f-pfx-external-evidence-batch-001.json',
        reason: 'production implementation evidence points to non-approving external evidence batch sheet',
      },
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-external-evidence-batch-001.json#force-field',
        filePath: '.context/r3f-pfx-external-evidence-batch-001.json',
        reason: 'red-team signoff evidence points to non-approving external evidence batch sheet',
      },
    ])
  })

  it('rejects structured production implementation manifests with blocked or incomplete entries', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [
        {
          effectId: 'force-field',
          status: 'blocked',
          implementedBy: 'pfx-implementer',
          implementedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'drop-in-r3f-component': 'pass',
            'authored-render-recipe': 'pass',
            'all-controls-safe': 'fail',
            'mobile-budget-declared': 'pass',
            'preview-asset-exported': 'pass',
            'documentation-export-clean': 'pass',
          },
          blockerFindings: ['Customization controls can break the effect.'],
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence does not reference force-field',
      },
    ])
  })

  it('rejects structured production implementation manifests with duplicate or unknown rows', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['production-implementation:.context/r3f-pfx-production-implementation.json#force-field'],
      },
    ])
    const readyImplementation = {
      effectId: 'force-field',
      status: 'production-ready',
      implementedBy: 'pfx-implementer',
      implementedAt: '2026-07-03T12:00:00.000Z',
      sourcePath: 'modules/juice/r3f-pfx-library/src/index.tsx#force-field',
      criteria: {
        'drop-in-r3f-component': 'pass',
        'authored-render-recipe': 'pass',
        'all-controls-safe': 'pass',
        'mobile-budget-declared': 'pass',
        'preview-asset-exported': 'pass',
        'documentation-export-clean': 'pass',
      },
      blockerFindings: [],
      notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
    }
    const duplicateManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [readyImplementation, readyImplementation],
    })
    const unknownManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [readyImplementation, { ...readyImplementation, effectId: 'not-in-taxonomy' }],
    })
    const malformedManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-production-implementation.v1',
      implementations: [readyImplementation, { status: 'production-ready' }],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => duplicateManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence manifest has duplicate effect rows: force-field',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => unknownManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence manifest has unknown effect rows: not-in-taxonomy',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => malformedManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        filePath: '.context/r3f-pfx-production-implementation.json',
        reason: 'production implementation evidence manifest has malformed effect rows',
      },
    ])
  })

  it('accepts structured red-team review manifests for signoff evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'signed-off',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes:
            'Adversarial review accepted force-field after mobile performance evidence, customization safety, export cleanliness, and documentation coverage were checked.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([])
  })

  it('rejects approved-deferral red-team rows as production-ready signoff evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale:
          'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'approved-deferral',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes:
            'force-field adversarial approved-deferral review accepted documented mobile performance risk and explicit deferral evidence.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects structured red-team signoff manifests with rubber-stamped notes', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'signed-off',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes: 'Looks good.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects structured red-team signoff manifests with vague evidence-only notes', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'signed-off',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes: 'Adversarial review completed after checking the supplied evidence.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects structured red-team signoff manifests with non-ISO review timestamps', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'production-approver',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'signed-off',
          reviewer: 'red-team-lead',
          reviewedAt: 'yesterday',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes:
            'Adversarial approved-deferral review accepted force-field with documented mobile performance risk and explicit deferral evidence.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects structured red-team manifests with blocked or incomplete reviews', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'blocked',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'fail',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: ['Mobile performance remains unproven.'],
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects structured red-team manifests with duplicate or unknown review rows', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'production-ready',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative approval fixture.',
        evidence: ['red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field'],
      },
    ])
    const signedOffReview = {
      effectId: 'force-field',
      status: 'signed-off',
      reviewer: 'red-team-lead',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      criteria: {
        'taxonomy-comprehensive': 'pass',
        'game-ready-not-decorative': 'pass',
        'mobile-performance-proven': 'pass',
        'style-clusters-distinct': 'pass',
        'customization-safe': 'pass',
        'export-clean': 'pass',
        'documentation-sufficient': 'pass',
      },
      blockerFindings: [],
    }
    const duplicateManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [signedOffReview, signedOffReview],
    })
    const unknownManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [signedOffReview, { ...signedOffReview, effectId: 'not-in-taxonomy' }],
    })
    const malformedManifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [signedOffReview, { status: 'signed-off' }],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => duplicateManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence manifest has duplicate effect rows: force-field',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => unknownManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence manifest has unknown effect rows: not-in-taxonomy',
      },
    ])
    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => malformedManifest)).toEqual([
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        filePath: '.context/r3f-pfx-red-team-review.json',
        reason: 'red-team signoff evidence manifest has malformed effect rows',
      },
    ])
  })

  it('rejects approved deferral evidence when referenced text does not support the deferral', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'approved-deferral',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative deferral fixture.',
        evidence: [
          'approved-deferral:docs/r3f-pfx-library-red-team.md#force-field-deferral',
          'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        ],
      },
    ])

    const issues = collectInvalidPfxProductionApprovalTextEvidence(approvals, () =>
      '# R3F PFX Library Red-Team Gate\n\nStatus: **signed off**.\n\nforce-field production-ready signoff.\n',
    )

    expect(issues).toEqual([
      {
        effectId: 'force-field',
        evidence: 'approved-deferral:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'approved deferral evidence does not record a deferral for force-field',
      },
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('rejects loose prose as approved deferral evidence', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'approved-deferral',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative deferral fixture.',
        evidence: [
          'approved-deferral:docs/r3f-pfx-library-red-team.md#force-field-deferral',
          'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        ],
      },
    ])

    expect(
      collectInvalidPfxProductionApprovalTextEvidence(approvals, () =>
        '# R3F PFX Library Red-Team Gate\n\nStatus: **signed off**.\n\nforce-field approved-deferral recorded after adversarial review.\n',
      ),
    ).toEqual([
      {
        effectId: 'force-field',
        evidence: 'approved-deferral:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'approved deferral evidence does not record a deferral for force-field',
      },
      {
        effectId: 'force-field',
        evidence: 'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field-deferral',
        filePath: 'docs/r3f-pfx-library-red-team.md',
        reason: 'red-team signoff evidence is not signed off for force-field',
      },
    ])
  })

  it('accepts structured red-team review manifests for approved deferrals', () => {
    const approvals = normalizePfxProductionApprovals([
      {
        effectId: 'force-field',
        decision: 'approved-deferral',
        approvedBy: 'red-team-lead',
        approvedAt: '2026-07-03T12:00:00.000Z',
        rationale: 'Representative deferral fixture.',
        evidence: [
          'approved-deferral:.context/r3f-pfx-red-team-review.json#force-field',
          'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        ],
      },
    ])
    const manifest = JSON.stringify({
      schema: 'game-bot.r3f-pfx-red-team-review.v1',
      reviews: [
        {
          effectId: 'force-field',
          status: 'approved-deferral',
          reviewer: 'red-team-lead',
          reviewedAt: '2026-07-03T12:00:00.000Z',
          criteria: {
            'taxonomy-comprehensive': 'pass',
            'game-ready-not-decorative': 'pass',
            'mobile-performance-proven': 'pass',
            'style-clusters-distinct': 'pass',
            'customization-safe': 'pass',
            'export-clean': 'pass',
            'documentation-sufficient': 'pass',
          },
          blockerFindings: [],
          notes:
            'force-field adversarial approved-deferral review accepted taxonomy coverage, mobile performance risk, export cleanliness, and documentation evidence for the deferral.',
        },
      ],
    })

    expect(collectInvalidPfxProductionApprovalTextEvidence(approvals, () => manifest)).toEqual([])
  })

  it('fails measured evidence verification on missing reports or threshold failures', () => {
    const failingAuthored = AUTHORED_PROFILE_SCENARIOS.slice(0, -1).map(makePassingReport)
    failingAuthored[0] = createBrowserProfileReport({
      ...profileInputForScenario(AUTHORED_PROFILE_SCENARIOS[0]),
      frameSamplesMs: [16, 22, 24, 31],
    })

    const evidence = verifyPfxMeasuredProfileEvidence({
      authoredReports: failingAuthored,
      profileBackedReports: PROFILE_BACKED_PROFILE_SCENARIOS.map(makePassingReport),
      catalogStressReports: CATALOG_STRESS_PROFILE_SCENARIOS.slice(0, -1).map(makePassingReport),
    })

    expect(evidence.passed).toBe(false)
    expect(evidence.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing authored report'),
        expect.stringContaining('missing catalog-stress report'),
        expect.stringContaining('threshold failure'),
      ]),
    )
    expect(evidence.singleEffectCoverage.missingEffectIds).toContain(
      AUTHORED_PROFILE_SCENARIOS[AUTHORED_PROFILE_SCENARIOS.length - 1].search,
    )
    expect(evidence.catalogStressCoverage.missingEffectIds.length).toBeGreaterThan(0)
    expect(evidence.thresholdFailures[0]).toMatchObject({
      scenarioId: 'authored-fireball-single',
    })
  })
})

function makeDefinitionOfDoneSmokeEvidence(): Record<string, unknown> {
  return {
    schema: 'game-bot.r3f-pfx-definition-of-done-smoke.v1',
    externalEvidenceFinalAcceptanceStatus:
      'Final acceptance blocked until real-device profiling, red-team signoff, and final production approvals are complete.',
    externalEvidenceFinalAcceptanceBlockerCounts: {
      rendered: true,
      text: 'Final blockers: Safari 500; Android 500; red-team 500; approvals 500',
      missingMobileSafariProfiles: 500,
      missingChromeAndroidProfiles: 500,
      missingRedTeamSignoff: 500,
      pendingMetadataApprovals: 500,
    },
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
    countText: 'SHOWING 500 OF 500 MATCHES',
    definitionOfDoneSearches: [
      {
        query: 'force field',
        expectedResultText: 'Force Field',
        expectedEffectId: 'force-field',
        resultCountText: 'SHOWING 1 OF 1 MATCHES',
      },
      {
        query: 'fireball',
        expectedResultText: 'Fireball',
        expectedEffectId: 'fireball',
        resultCountText: 'SHOWING 1 OF 1 MATCHES',
      },
      {
        query: 'cozy pickup sparkle',
        expectedResultText: 'Coin Pickup Sparkle',
        expectedEffectId: 'coin-pickup-sparkle',
        resultCountText: 'SHOWING 1 OF 1 MATCHES',
      },
      {
        query: 'mobile-safe hit impact',
        expectedResultText: 'Hit Spark',
        expectedEffectId: 'hit-spark',
        resultCountText: 'SHOWING 73 OF 73 MATCHES',
        mobileSafeFilter: true,
      },
    ],
    manifest: {
      schema: 'game-bot.r3f-pfx-preview-manifest.v1',
      totalEffects: 500,
      forceFieldHasThumbnail: true,
      forceFieldHasAnimatedClip: true,
      forceFieldHasStyleContactSheet: true,
      forceFieldHasControlExtremesContactSheet: true,
      forceFieldHasMarketSources: true,
      forceFieldThumbnailFileName: 'force-field.svg',
      forceFieldAnimatedClipFileName: 'force-field-clip.svg',
      forceFieldStyleContactSheetFileName: 'force-field-style-contact-sheet.svg',
      forceFieldControlExtremesContactSheetFileName: 'force-field-control-extremes-contact-sheet.svg',
      forceFieldAnimatedClipFrames: 24,
    },
    customizationEvidence: {
      editedControls: [
        'color',
        'style',
        'scale',
        'density',
        'timing',
        'lifetime',
        'velocity',
        'gravity',
        'turbulence',
        'spawnShape',
        'texture',
        'flipbook',
        'blendMode',
        'emissiveBloom',
        'trailLength',
        'seed',
        'lod',
      ],
      before: {
        density: 0.38,
        maxParticles: 24,
      },
      after: {
        color: ['#44ccff', '#22d3ee'],
        style: 'neon',
        scale: 1.35,
        density: 1,
        timing: 1.4,
        lifetime: 2.25,
        velocity: 1.15,
        gravity: -0.35,
        turbulence: 0.65,
        spawnShape: 'ring',
        texture: 'ring',
        flipbook: 'magic-12',
        blendMode: 'screen',
        emissiveBloom: 1.1,
        trailLength: 1.7,
        seed: 4242,
        lod: ['low', 'medium'],
        maxParticles: 46,
      },
      fullControlSurfaceCovered: true,
      jsonPresetIncludesCustomizedControls: true,
      performanceRecomputedAfterCustomization: true,
    },
    realDeviceCapturePanel: {
      effectId: 'fireball',
      platform: 'chrome-android',
      scenarioId: 'mobile-fireball-single',
      effectCount: 1,
      totalParticles: 32,
      deviceClass: 'real-device',
      overdrawMeasurementSource: 'screenshot-readback',
      downloadFileName: 'fireball.json',
      downloadPayloadMatchesJson: true,
      uploadDisabledForInvalidDesktopCapture: true,
      continueDisabledForInvalidDesktopCapture: true,
      blockingFindingText:
        'This browser capture is not valid final real-device evidence: device touch metadata must prove real touch hardware',
      validMobileUploadContinuation: {
        uploadResultStatus: 'imported',
        runCompleteRendered: true,
        readyHrefHasDeviceLabel: true,
        readyHrefBatchId: 'real-device-batch-012',
        nextBatchAutoUploadQueueReadyHref:
          'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-012&effectId=explosion&profileDeviceLabel=Codex%20Smoke%20Phone',
      },
    },
    operatorStatusWorkQueue: {
      fetched: true,
      totalOpenWorkItems: 2000,
      readyWorkItems: 1000,
      blockedWorkItems: 1000,
      nextReadyEffectId: 'fireball',
      nextReadyWorkItemId: 'mobile-safari-capture',
      nextReadyAutoUploadHasDeviceLabel: true,
      nextReadyMobileSafariEffectId: 'fireball',
      nextReadyChromeAndroidEffectId: 'fireball',
      nextReadyMobileSafariAutoUploadHasDeviceLabel: true,
      nextReadyChromeAndroidAutoUploadHasDeviceLabel: true,
      nextBlockedRedTeamEffectId: 'fireball',
      nextBlockedFinalApprovalEffectId: 'fireball',
      labeledDeviceLabelRequirementReady: true,
      placeholderDeviceLabelRejected: true,
      placeholderAutoUploadUrlsSuppressed: true,
      placeholderRequirementFinding:
        'Provide a concrete real device profileDeviceLabel to enable auto-upload URLs.',
      labeledPlatformAutoUploadUrlsHaveDeviceLabel: true,
      placeholderPlatformAutoUploadUrlsSuppressed: true,
      nextMobileSafariBatchId: 'real-device-batch-001',
      nextChromeAndroidBatchId: 'real-device-batch-011',
      nextMobileSafariEffectId: 'fireball',
      nextChromeAndroidEffectId: 'fireball',
      operatorChecklistIncludesDeviceLabelStep: true,
      operatorChecklistIncludesPlatformAutoRunSteps: true,
      operatorChecklistIncludesVerifierCommands: true,
      operatorLaunchPageChecklistRendered: true,
      operatorLaunchPageChecklistIncludesVerifierCommands: true,
      deviceCaptureSummaryMatchesLabel: true,
      deviceCaptureSummaryTotalForLabel: 0,
      deviceCaptureSummaryMobileSafariForLabel: 0,
      deviceCaptureSummaryChromeAndroidForLabel: 0,
      operatorStatusFinalBlockersMatchGoal: true,
      operatorStatusMobileSafariProfiles: 500,
      operatorStatusChromeAndroidProfiles: 500,
      operatorStatusRedTeamReviews: 500,
      operatorStatusFinalApprovals: 500,
    },
    externalEvidenceHandoffHealth: {
      rendered: true,
      readyForPhoneCapture: true,
      captureUrlItems: 1000,
      networkReachableCaptureUrlItems: 1000,
      batchScopedAutoUploadUrlItems: 1000,
      readyBatchScopedAutoUploadUrlItems: 1000,
      missingBatchScopedAutoUploadUrlItems: 0,
      autoUploadRequiresDeviceLabelItems: 1000,
      taxonomyReviewItems: 0,
      productionImplementationItems: 0,
      mobileSafariCaptureItems: 500,
      chromeAndroidCaptureItems: 500,
      redTeamReviewItems: 500,
      finalApprovalItems: 500,
      nextMobileSafariCaptureHref: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
      nextMobileSafariAutoUploadHref:
        'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel=Codex%20Smoke%20Phone',
      nextChromeAndroidCaptureHref: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
      nextChromeAndroidAutoUploadHref:
        'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel=Codex%20Smoke%20Phone',
      indexPath: '.context/r3f-pfx-external-evidence-batch-sheet-index.json',
      bulkCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:external-evidence -- --taxonomy-review .context/r3f-pfx-taxonomy-review.json --production-implementations .context/r3f-pfx-production-implementation.json --real-device-audit .context/r3f-pfx-real-device-capture-audit.json --real-device-batches .context/r3f-pfx-real-device-capture-batches.json --red-team-review .context/r3f-pfx-red-team-review.json --production-approvals .context/r3f-pfx-production-approvals.json --external-evidence-work-order-output .context/r3f-pfx-external-evidence-work-order.json --external-evidence-work-order-markdown-output .context/r3f-pfx-external-evidence-work-order.md --external-evidence-batch-plan-output .context/r3f-pfx-external-evidence-batch-plan.json --external-evidence-batch-plan-markdown-output .context/r3f-pfx-external-evidence-batch-plan.md --external-evidence-batch-sheet-directory .context/external-evidence-batches --external-evidence-batch-sheet-index-output .context/r3f-pfx-external-evidence-batch-sheet-index.json --external-evidence-batch-sheet-index-markdown-output .context/r3f-pfx-external-evidence-batch-sheet-index.md',
    },
    objectiveReadinessHandoffHealth: {
      rendered: true,
      locallySatisfiedRequirements: 15,
      totalRequirements: 18,
      externalEvidenceRequiredRequirements: 3,
      blockedRequirements: 3,
      operatorLaunchHref: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel=Codex%20Smoke%20Phone',
      operatorStatusHref:
        'http://192.0.2.55:4765/__r3f-pfx-capture-operator-status?profileDeviceLabel=Codex%20Smoke%20Phone',
    },
    realDeviceHandoffHealth: {
      rendered: true,
      totalItems: 1000,
      totalBatches: 20,
      indexPassed: true,
      filesPassed: true,
      indexPath: '.context/r3f-pfx-real-device-capture-batch-sheet-index.json',
      bulkCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url http://192.0.2.55:4765/ --batch-output .context/r3f-pfx-real-device-capture-batches.json --batch-sheet-directory .context/real-device-capture-batches --batch-sheet-index-output .context/r3f-pfx-real-device-capture-batch-sheet-index.json --batch-sheet-index-markdown-output .context/r3f-pfx-real-device-capture-batch-sheet-index.md',
    },
    redTeamReviewHandoffHealth: {
      rendered: true,
      totalItems: 500,
      totalBatches: 20,
      indexPassed: true,
      filesPassed: true,
      indexPath: '.context/r3f-pfx-red-team-review-batch-sheet-index.json',
      bulkCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run verify:red-team -- --real-device-audit .context/r3f-pfx-real-device-capture-audit.json --real-device-batches .context/r3f-pfx-real-device-capture-batches.json --red-team-batch-sheet-directory .context/red-team-review-batches --red-team-batch-sheet-index-output .context/r3f-pfx-red-team-review-batch-sheet-index.json --red-team-batch-sheet-index-markdown-output .context/r3f-pfx-red-team-review-batch-sheet-index.md',
      operatorLaunchHref: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel=Codex%20Smoke%20Phone',
      operatorStatusHref:
        'http://192.0.2.55:4765/__r3f-pfx-capture-operator-status?profileDeviceLabel=Codex%20Smoke%20Phone',
    },
    productionApprovalHandoffHealth: {
      rendered: true,
      totalItems: 500,
      totalBatches: 20,
      indexPassed: true,
      filesPassed: true,
      indexPath: '.context/r3f-pfx-production-approval-batch-sheet-index.json',
      bulkCommand:
        'npm --prefix kits/juice/r3f-pfx-browser run verify:approvals -- --taxonomy-review .context/r3f-pfx-taxonomy-review.json --production-implementations .context/r3f-pfx-production-implementation.json --real-device-audit .context/r3f-pfx-real-device-capture-audit.json --real-device-batches .context/r3f-pfx-real-device-capture-batches.json --red-team-review .context/r3f-pfx-red-team-review.json --approval-batch-sheet-directory .context/production-approval-batches --approval-batch-sheet-index-output .context/r3f-pfx-production-approval-batch-sheet-index.json --approval-batch-sheet-index-markdown-output .context/r3f-pfx-production-approval-batch-sheet-index.md',
      operatorLaunchHref: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel=Codex%20Smoke%20Phone',
      operatorStatusHref:
        'http://192.0.2.55:4765/__r3f-pfx-capture-operator-status?profileDeviceLabel=Codex%20Smoke%20Phone',
      approvalBlockers: {
        missingMobileSafariProfiles: 500,
        missingChromeAndroidProfiles: 500,
        missingRedTeamSignoff: 500,
        pendingFinalApprovals: 500,
      },
    },
    exportEvidence: {
      effectId: 'force-field',
      componentSnippetIncludesFactory: true,
      componentSnippetExportsNamedComponent: true,
      componentSnippetUsesTypedProps: true,
      docsIncludeComponentSnippet: true,
      docsIncludeQualityRubric: true,
      docsIncludeProductionCaveat: true,
      jsonPresetIncludesQualityScores: true,
      jsonPresetIncludesStyleRender: true,
    },
  }
}

function makePassingReport(scenario: ProfileScenarioDefinition): BrowserProfileReport {
  return createBrowserProfileReport(profileInputForScenario(scenario))
}

function makeRealDeviceReport(
  scenario: ProfileScenarioDefinition,
  platform: 'mobile-safari' | 'chrome-android',
): BrowserProfileReport {
  const effectId = scenario.search
  const baseReport = makePassingReport(scenario)
  const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effectId)!
  const concurrency = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]
  return {
    ...baseReport,
    url: `https://preview.example.test/pfx?profileEffectIds=${effectId}&profilePlatform=${platform}&profileConcurrency=${concurrency}`,
    scenario: {
      ...baseReport.scenario,
      id: `mobile-${effectId}-canonical-${concurrency}`,
      mode: 'stress',
      effectCount: concurrency,
      totalParticles: baseReport.scenario.totalParticles * concurrency,
      totalDrawCalls: baseReport.scenario.totalDrawCalls * concurrency,
      textureMemoryKb: baseReport.scenario.textureMemoryKb * concurrency,
    },
    sustained: {
      measurementSource: 'external-device-profiler',
      durationSeconds: 180,
      memoryStartMb: 90,
      memoryEndMb: 90.4,
      memoryGrowthMb: 0.4,
      cpuMainThreadP95Ms: 4.2,
      gpuP95Ms: 7.8,
      materialFrameHitches: 0,
      shaderCompilationStalls: 0,
      thermalStatus: 'nominal',
      frameTimeDegradationPercent: 2,
    },
    userAgent:
      platform === 'mobile-safari'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    capture: {
      deviceClass: 'real-device',
      platform,
      deviceLabel: platform === 'mobile-safari' ? 'iPhone 15 Pro' : 'Pixel 8',
      runner: 'manual-real-device-browser',
      notes: [],
    },
    device: {
      maxTouchPoints: 5,
      pointerCoarse: true,
      hoverNone: true,
    },
  }
}

function makeProfileRun(reports: BrowserProfileReport[]): { schema: 'game-bot.r3f-pfx-browser-profile-run.v1'; reports: BrowserProfileReport[] } {
  return {
    schema: 'game-bot.r3f-pfx-browser-profile-run.v1',
    reports,
  }
}

function profileInputForScenario(scenario: ProfileScenarioDefinition): BrowserProfileInput {
  const effectCount = scenario.effectIds?.length ?? 1
  return {
    capturedAt: '2026-07-03T00:00:00.000Z',
    url: 'http://127.0.0.1:4765/',
    userAgent: 'Playwright Chromium',
    viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
    scenario: {
      id: scenario.id,
      mode: scenario.mode,
      effectCount,
      totalParticles: effectCount * 24,
      totalDrawCalls: effectCount * 3,
      textureMemoryKb: effectCount * 96,
    },
    frameSamplesMs: [8, 9, 9.4, 9.8, 10, 8.8, 9.2, 9.6],
    webgl: {
      context: 'webgl2',
      vendor: 'Test Vendor',
      renderer: 'Test Renderer',
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.00',
      timerQueryExtension: 'unavailable',
      gpuTimerStatus: 'unsupported',
      gpuTimerMs: null,
      notes: ['timer query extension unavailable'],
    },
    canvas: {
      width: 390,
      height: 340,
      nonBackgroundPixels: effectCount * 180,
      measurementSource: 'screenshot-readback',
    },
  }
}

const PFX_MATRIX_VISUAL_KEYS = [
  'semanticIdentity',
  'gameplayReadability',
  'volumeAndDepth',
  'multiAngleResilience',
  'silhouetteAndComposition',
  'temporalArcAndDecay',
  'materialAndShaderQuality',
  'meshStructureAndEmitterQuality',
  'cc0AssetIntegration',
  'distinctivenessAndRingDiscipline',
  'scaleAndVisualHierarchy',
  'overallProductionPolish',
]

const PFX_MATRIX_PERFORMANCE_KEYS = [
  'mobileFrameRateStability',
  'cpuAndGpuCost',
  'drawCallsParticlesAndOverdraw',
  'memoryAndThermalSuitability',
]

function createPassingQualityMatrixInput(
  options: { mobileSafariModelYear?: number; chromeAndroidModelYear?: number } = {},
): unknown {
  const captures = (angle: string) => [
    `${angle}-onset.png`,
    `${angle}-peak.png`,
    `${angle}-decay.png`,
  ]
  const device = (platform: 'mobile-safari' | 'chrome-android', modelYear: number) => ({
    platform,
    deviceLabel: platform === 'mobile-safari' ? 'iPhone SE (3rd generation)' : 'Pixel 6a',
    modelYear,
    measured: true,
    concurrency: 20,
    fps: 62,
    p95FrameMs: 14,
    worstFrameMs: 20,
    drawCalls: 24,
    particles: 480,
    overdrawRatio: 0.3,
    memoryMb: 90,
    memoryGrowthMb: 0.4,
    cpuMainThreadMs: 4,
    gpuTimeMs: 7,
    shaderCompilationStalls: 0,
    materialFrameHitches: 0,
    thermalStatus: 'nominal',
    sustainedDurationSeconds: 180,
    evidence: `.context/${platform}/rank-51-effect.json`,
  })
  return {
    effects: [{ effectId: 'rank-51-effect', rank: 51, name: 'Rank 51', originalGrade: 'B', performanceTier: 'low' }],
    visualReviews: [{
      effectId: 'rank-51-effect',
      reviewer: 'independent-peer-runtime',
      reviewerConfidence: 0.95,
      scores: Object.fromEntries(PFX_MATRIX_VISUAL_KEYS.map((key) => [key, 4])),
      cameraEvidence: {
        front: captures('front'),
        threeQuarter: captures('three-quarter'),
        side: captures('side'),
      },
      lifecycleEvidence: {
        onset: ['front-onset.png', 'three-quarter-onset.png', 'side-onset.png'],
        peak: ['front-peak.png', 'three-quarter-peak.png', 'side-peak.png'],
        decay: ['front-decay.png', 'three-quarter-decay.png', 'side-decay.png'],
      },
      gameplayContextEvidence: ['gameplay-context-peak-three-quarter.png'],
      reducedMotionReadable: true,
      blockers: [],
    }],
    performanceReviews: [{
      effectId: 'rank-51-effect',
      scores: Object.fromEntries(PFX_MATRIX_PERFORMANCE_KEYS.map((key) => [key, 4])),
      mobileSafari: device('mobile-safari', options.mobileSafariModelYear ?? 2022),
      chromeAndroid: device('chrome-android', options.chromeAndroidModelYear ?? 2022),
      blockers: [],
    }],
  }
}

describe('shouldRepairPfxBlankSample', () => {
  it('flags an isolated blank sample between clearly active neighbors', () => {
    expect(profiling.shouldRepairPfxBlankSample(11_477, 0, 11_842)).toBe(true)
    expect(profiling.shouldRepairPfxBlankSample(900, 12, 640)).toBe(true)
  })

  it('does not flag a sustained tail-off as a capture artifact', () => {
    expect(profiling.shouldRepairPfxBlankSample(11_477, 0, 0)).toBe(false)
    expect(profiling.shouldRepairPfxBlankSample(0, 0, 11_842)).toBe(false)
    expect(profiling.shouldRepairPfxBlankSample(400, 0, 600)).toBe(false)
    expect(profiling.shouldRepairPfxBlankSample(11_477, 120, 11_842)).toBe(false)
  })
})

describe('liftPfxReviewImageExposure', () => {
  it('brightens dark pixels while preserving black, white, and alpha', () => {
    const pixels = new Uint8Array([
      16, 24, 39, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
      128, 128, 128, 77,
    ])
    profiling.liftPfxReviewImageExposure(pixels)
    expect(pixels[0]).toBeGreaterThan(16)
    expect(pixels[1]).toBeGreaterThan(24)
    expect(pixels[2]).toBeGreaterThan(39)
    expect(pixels[3]).toBe(255)
    expect([pixels[4], pixels[5], pixels[6]]).toEqual([0, 0, 0])
    expect([pixels[8], pixels[9], pixels[10]]).toEqual([255, 255, 255])
    expect(pixels[12]).toBeGreaterThan(128)
    expect(pixels[15]).toBe(77)
  })

  it('is monotonic so dark-on-dark separation survives the lift', () => {
    const pixels = new Uint8Array([20, 20, 20, 255, 40, 40, 40, 255])
    profiling.liftPfxReviewImageExposure(pixels)
    expect(pixels[4]).toBeGreaterThan(pixels[0]!)
  })
})
