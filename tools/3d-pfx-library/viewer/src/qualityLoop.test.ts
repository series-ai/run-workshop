import { describe, expect, it } from 'vitest'
import {
  createPfxQualityImprovementLedger,
  createPfxQualityImprovementQueue,
  evaluatePfxQualityConvergence,
  pfxTargetGradeForRank,
  type PfxQualityLoopEffect,
  type PfxQualityLoopSnapshot,
} from './qualityLoop'

function effect(overrides: Partial<PfxQualityLoopEffect> = {}): PfxQualityLoopEffect {
  return {
    effectId: 'effect',
    rank: 100,
    currentGrade: 'C',
    worstVisualScore: 3,
    weightedScore: 3,
    visualBlockers: ['generic-silhouette'],
    systemicDefectKeys: [],
    performancePassed: false,
    performanceHeadroomMs: 0,
    ...overrides,
  }
}

function snapshot(overrides: Partial<PfxQualityLoopSnapshot> = {}): PfxQualityLoopSnapshot {
  return {
    iteration: 1,
    targetPasses: 0,
    blockerCount: 10,
    visualEvidenceCount: 10,
    performanceEvidenceCount: 10,
    worstVisualScore: 2,
    weightedScore: 2.5,
    systemicDefectsRemaining: 5,
    minimumPerformanceHeadroomMs: 0,
    regressedEffectIds: [],
    ...overrides,
  }
}

describe('PFX continuous quality loop', () => {
  it('requires A+ for ranks 1-50 and A for ranks 51-500', () => {
    expect(pfxTargetGradeForRank(1)).toBe('A+')
    expect(pfxTargetGradeForRank(50)).toBe('A+')
    expect(pfxTargetGradeForRank(51)).toBe('A')
    expect(pfxTargetGradeForRank(500)).toBe('A')
    expect(() => pfxTargetGradeForRank(0)).toThrow(/rank/i)
    expect(() => pfxTargetGradeForRank(501)).toThrow(/rank/i)
  })

  it('prioritizes high-leverage systemic defects before local recipe polish', () => {
    const queue = createPfxQualityImprovementQueue([
      effect({ effectId: 'local-hero', rank: 4, systemicDefectKeys: [] }),
      effect({ effectId: 'shared-a', rank: 80, systemicDefectKeys: ['flat-card-volume'] }),
      effect({ effectId: 'shared-b', rank: 81, systemicDefectKeys: ['flat-card-volume'] }),
      effect({ effectId: 'shared-c', rank: 82, systemicDefectKeys: ['flat-card-volume'] }),
      effect({ effectId: 'already-great', rank: 10, currentGrade: 'A+', worstVisualScore: 5, visualBlockers: [], performancePassed: true, performanceHeadroomMs: 4 }),
    ])

    expect(queue[0]).toMatchObject({
      kind: 'systemic',
      defectKey: 'flat-card-volume',
      effectIds: ['shared-a', 'shared-b', 'shared-c'],
    })
    expect(queue.some((item) => item.effectIds.includes('already-great'))).toBe(false)
    expect(queue.at(-1)).toMatchObject({ kind: 'effect', effectIds: ['local-hero'] })
  })

  it('does not let missing external device evidence starve actionable visual defects', () => {
    const queue = createPfxQualityImprovementQueue([
      effect({
        effectId: 'shared-a',
        rank: 1,
        systemicDefectKeys: ['performance:real-device', 'visual:volumeAndDepth'],
      }),
      effect({
        effectId: 'shared-b',
        rank: 2,
        systemicDefectKeys: ['performance:real-device', 'visual:volumeAndDepth'],
      }),
    ])

    expect(queue.map((item) => item.defectKey)).toEqual([
      'visual:volumeAndDepth',
      'performance:real-device',
    ])
  })

  it('prioritizes a reviewed shared visual defect over a large unreviewed backlog', () => {
    const unreviewed = Array.from({ length: 495 }, (_, index) => effect({
      effectId: `unreviewed-${String(index + 1).padStart(3, '0')}`,
      rank: index + 6,
      systemicDefectKeys: ['evidence:independent-visual-review'],
    }))
    const queue = createPfxQualityImprovementQueue([
      effect({ effectId: 'reviewed-a', rank: 1, systemicDefectKeys: ['visual:volumeAndDepth'] }),
      effect({ effectId: 'reviewed-b', rank: 2, systemicDefectKeys: ['visual:volumeAndDepth'] }),
      ...unreviewed,
    ])

    expect(queue[0].defectKey).toBe('visual:volumeAndDepth')
  })

  it('keeps a single reviewed visual defect actionable beside shared missing evidence', () => {
    const queue = createPfxQualityImprovementQueue([
      effect({
        effectId: 'reviewed-muzzle',
        rank: 4,
        systemicDefectKeys: ['visual:semanticIdentity', 'performance:real-device'],
      }),
      effect({
        effectId: 'unreviewed-a',
        rank: 5,
        systemicDefectKeys: ['evidence:independent-visual-review', 'performance:real-device'],
      }),
      effect({
        effectId: 'unreviewed-b',
        rank: 6,
        systemicDefectKeys: ['evidence:independent-visual-review', 'performance:real-device'],
      }),
    ])

    expect(queue[0]).toMatchObject({
      kind: 'effect',
      defectKey: 'visual:semanticIdentity',
      effectIds: ['reviewed-muzzle'],
    })
  })

  it('orders reviewed visual defects by gameplay importance before asset polish', () => {
    const queue = createPfxQualityImprovementQueue([
      effect({ effectId: 'readability-a', rank: 1, systemicDefectKeys: ['visual:gameplayReadability'] }),
      effect({ effectId: 'readability-b', rank: 2, systemicDefectKeys: ['visual:gameplayReadability'] }),
      ...Array.from({ length: 5 }, (_, index) => effect({
        effectId: `asset-${index}`,
        rank: index + 10,
        systemicDefectKeys: ['visual:cc0AssetIntegration'],
      })),
    ])

    expect(queue[0].defectKey).toBe('visual:gameplayReadability')
  })

  it('derives a durable ledger summary and queue from evidence rows', () => {
    const ledger = createPfxQualityImprovementLedger({
      iteration: 1,
      effects: [
        effect({
          effectId: 'hero-needs-a-plus',
          rank: 1,
          currentGrade: 'A',
          worstVisualScore: 4,
          weightedScore: 4.3,
          visualBlockers: ['volume is flat'],
          systemicDefectKeys: ['visual:volumeAndDepth'],
          performancePassed: true,
          performanceHeadroomMs: 2,
        }),
        effect({
          effectId: 'accepted-a',
          rank: 60,
          currentGrade: 'A',
          worstVisualScore: 4,
          weightedScore: 4.1,
          visualBlockers: [],
          systemicDefectKeys: [],
          performancePassed: true,
          performanceHeadroomMs: 1.5,
        }),
        effect({
          effectId: 'shared-volume-defect',
          rank: 61,
          currentGrade: 'B',
          worstVisualScore: 3,
          weightedScore: 3.5,
          visualBlockers: ['volume is flat'],
          systemicDefectKeys: ['visual:volumeAndDepth'],
          performancePassed: false,
          performanceHeadroomMs: null,
        }),
      ],
    })

    expect(ledger.schema).toBe('game-bot.r3f-pfx-quality-improvement-ledger.v1')
    expect(ledger.summary).toMatchObject({
      iteration: 1,
      targetPasses: 1,
      blockerCount: 2,
      worstVisualScore: 3,
      weightedScore: 3.97,
      systemicDefectsRemaining: 1,
      minimumPerformanceHeadroomMs: 1.5,
      regressedEffectIds: [],
    })
    expect(ledger.convergence).toBeNull()
    expect(ledger.queue[0]).toMatchObject({
      kind: 'systemic',
      defectKey: 'visual:volumeAndDepth',
      effectIds: ['hero-needs-a-plus', 'shared-volume-defect'],
    })
    expect(ledger.queue.some((item) => item.effectIds.includes('accepted-a'))).toBe(false)
  })

  it('does not dilute reviewed quality metrics with fabricated zeroes for missing evidence', () => {
    const ledger = createPfxQualityImprovementLedger({
      iteration: 1,
      effects: [
        effect({ effectId: 'reviewed', rank: 4, worstVisualScore: 3, weightedScore: 3.5 }),
        effect({ effectId: 'unreviewed', rank: 5, worstVisualScore: null, weightedScore: null }),
      ],
    })

    expect(ledger.summary.visualEvidenceCount).toBe(1)
    expect(ledger.summary.worstVisualScore).toBe(3)
    expect(ledger.summary.weightedScore).toBe(3.5)
  })

  it('continues only on strict improvement and fails closed on regressions', () => {
    const previous = snapshot()

    expect(evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2, blockerCount: 9 }))).toEqual({
      converging: true,
      reason: 'blocker-count-decreased',
    })
    expect(evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2, weightedScore: 2.7 }))).toEqual({
      converging: true,
      reason: 'weighted-score-increased',
    })
    expect(evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2 }))).toEqual({
      converging: false,
      reason: 'quality-plateau',
    })
    expect(
      evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2, blockerCount: 8, regressedEffectIds: ['portal-idle-loop'] })),
    ).toEqual({
      converging: false,
      reason: 'quality-regression:portal-idle-loop',
    })
    expect(
      evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2, blockerCount: 8, visualEvidenceCount: 9 })),
    ).toEqual({
      converging: false,
      reason: 'evidence-coverage-regressed:visual',
    })
    expect(
      evaluatePfxQualityConvergence(previous, snapshot({ iteration: 2, blockerCount: 8, performanceEvidenceCount: 9 })),
    ).toEqual({
      converging: false,
      reason: 'evidence-coverage-regressed:performance',
    })
  })
})
