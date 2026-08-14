import { describe, expect, it } from 'vitest'
import {
  assemblePfxQualityIteration,
  collectPfxCapturePixelDefects,
  createPfxFingerprintAuditEffectIds,
  createPfxQualityActionRoute,
  createPfxQualityStatus,
  createPfxVisualCaptureManifest,
  isPfxRenderSourceForEffect,
  parsePfxPeerVisualReviewReport,
  routePfxQualityAction,
  shouldAcceptPfxEmptyProbe,
  type PfxQualityActionRouteInput,
} from './qualityWorkflow'

function route(overrides: Partial<PfxQualityActionRouteInput> = {}): PfxQualityActionRouteInput {
  return {
    effectIds: ['fireball'],
    defectKey: 'visual:semanticIdentity',
    targetPassed: false,
    reviewerDisagreement: false,
    ...overrides,
  }
}

const reviewDimensions = [
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
] as const

describe('peer visual-review input validation', () => {
  it('rejects a malformed single-effect object before resolving its capture manifest', () => {
    expect(() => parsePfxPeerVisualReviewReport({
      schema: 'game-bot.r3f-pfx-peer-visual-review.v1',
      effectId: 'spawn-telegraph',
      independentRuntime: true,
      scores: Object.fromEntries(reviewDimensions.map((dimension) => [dimension, 4])),
    })).toThrow(/batchId/i)
  })
})

describe('PFX quality fingerprint audit scope', () => {
  it('audits reviewed effects and every previously fingerprinted row', () => {
    expect(createPfxFingerprintAuditEffectIds(
      ['spawn-telegraph'],
      {
        effects: [
          { effectId: 'spawn-telegraph', sourceFingerprint: 'pfx-source-v1:old-spawn' },
          { effectId: 'teleport-telegraph', sourceFingerprint: 'pfx-source-v1:old-teleport' },
          { effectId: 'fireball', sourceFingerprint: null },
        ],
      },
    )).toEqual(['spawn-telegraph', 'teleport-telegraph'])
  })
})

function reviewSource(
  batchId: string,
  effectInput: string | readonly string[],
  fingerprint = 'pfx-source-v1:current',
  score = 4,
  verdict: 'pass' | 'rework' = 'pass',
  reviewedAt?: string,
) {
  const effectIds = typeof effectInput === 'string' ? [effectInput] : effectInput
  return {
    review: {
      schema: 'game-bot.r3f-pfx-peer-visual-review.v1',
      batchId,
      peerRuntime: batchId,
      independentRuntime: true,
      reviewedAt,
      effects: effectIds.map((effectId) => ({
        effectId,
        scores: Object.fromEntries(reviewDimensions.map((dimension) => [dimension, score])),
        reviewerConfidence: 0.9,
        grade: (score >= 4 ? 'A' : 'B') as 'A' | 'B',
        verdict,
        findings: verdict === 'rework' ? [`${batchId} requires rework`] : [],
        reducedMotionReadable: true,
      })),
    },
    manifest: {
      schema: 'game-bot.r3f-pfx-visual-capture-batch.v3',
      batchId,
      effects: effectIds.map((effectId) => ({
        effectId,
        sourceFingerprint: fingerprint,
        lifecycleCaptures: (['front', 'three-quarter', 'side'] as const).flatMap((angle) =>
          (['onset', 'peak', 'decay'] as const).map((phase) => ({
            angle,
            phase,
            file: `.context/quality/${batchId}/${effectId}-${phase}-${angle}.png`,
          }))),
        gameplayContextCaptures: [{
          angle: 'three-quarter' as const,
          phase: 'peak' as const,
          file: `.context/quality/${batchId}/${effectId}-gameplay-peak-three-quarter.png`,
        }],
        reducedMotionCapture: {
          angle: 'three-quarter' as const,
          phase: 'peak' as const,
          file: `.context/quality/${batchId}/${effectId}-reduced-motion-peak-three-quarter.png`,
        },
      })),
    },
  }
}

describe('PFX quality workflow action routing', () => {
  it('keeps render fingerprints per-effect while retaining shared runtime sources', () => {
    expect(isPfxRenderSourceForEffect('fireball', 'src/recipes/fireball.ts')).toBe(true)
    expect(isPfxRenderSourceForEffect('fireball', 'src/recipes/explosion.ts')).toBe(false)
    expect(isPfxRenderSourceForEffect('fireball', 'src/PfxSurface.tsx')).toBe(true)
  })

  it('routes shared and isolated art defects to their canonical owners', () => {
    const sharedVolume = route({
      effectIds: ['fireball', 'explosion'],
      defectKey: 'visual:volumeAndDepth',
    })
    const isolatedIdentity = route({
      effectIds: ['fireball'],
      defectKey: 'visual:semanticIdentity',
    })

    expect(routePfxQualityAction(sharedVolume)).toBe('refine-primitive')
    expect(createPfxQualityActionRoute(sharedVolume)).toMatchObject({
      action: 'refine-primitive',
      ownerPath: 'src/PfxSurface.tsx',
    })
    expect(routePfxQualityAction(isolatedIdentity)).toBe('refine-recipe')
    expect(createPfxQualityActionRoute(isolatedIdentity)).toMatchObject({
      action: 'refine-recipe',
      ownerPath: 'src/recipes/fireball.ts',
    })
  })

  it('routes missing evidence without mislabeling it as an art defect', () => {
    const unreviewed = route({ defectKey: 'evidence:independent-visual-review' })
    const deviceBlocked = route({ defectKey: 'performance:real-device' })

    expect(routePfxQualityAction(unreviewed)).toBe('request-review')
    expect(createPfxQualityActionRoute(unreviewed).ownerPath).toBeNull()
    expect(routePfxQualityAction(deviceBlocked)).toBe('request-device-evidence')
    expect(createPfxQualityActionRoute(deviceBlocked).ownerPath).toBeNull()
  })

  it('routes reviewer disagreement to adjudication before any remediation', () => {
    const disputed = route({
      defectKey: 'visual:semanticIdentity',
      reviewerDisagreement: true,
    })

    expect(routePfxQualityAction(disputed)).toBe('adjudicate-review')
    expect(createPfxQualityActionRoute(disputed).ownerPath).toBeNull()
  })

  it('stops when the effect meets its assigned target', () => {
    const accepted = route({
      defectKey: null,
      targetPassed: true,
    })

    expect(routePfxQualityAction(accepted)).toBe('stop')
    expect(createPfxQualityActionRoute(accepted)).toMatchObject({
      action: 'stop',
      ownerPath: null,
    })
  })
})

describe('PFX quality iteration assembly', () => {
  it('requires three independent peer-review batches', () => {
    expect(() => assemblePfxQualityIteration({
      iteration: 1,
      effects: [],
      reviews: [],
      currentSourceFingerprints: {},
      reducedMotionReadableEffectIds: [],
      performanceReviews: [],
    })).toThrow(/three independent reviews/i)
  })

  it('rejects duplicate peer-review batch identities', () => {
    const duplicateSource = (batchId: string) => ({
      review: { batchId },
      manifest: { batchId },
    })
    expect(() => assemblePfxQualityIteration({
      iteration: 1,
      effects: [],
      reviews: [
        duplicateSource('review-a'),
        duplicateSource('review-a'),
        duplicateSource('review-c'),
      ] as never,
      currentSourceFingerprints: {},
      reducedMotionReadableEffectIds: [],
      performanceReviews: [],
    })).toThrow(/independent review batch/i)
  })

  it('rejects stale per-effect capture fingerprints', () => {
    expect(() => assemblePfxQualityIteration({
      iteration: 1,
      effects: [{
        effectId: 'fireball',
        rank: 1,
        name: 'Fireball',
        originalGrade: null,
        performanceTier: 'low',
      }],
      reviews: [
        reviewSource('review-a', 'fireball', 'pfx-source-v1:stale'),
        reviewSource('review-b', 'fireball', 'pfx-source-v1:stale'),
        reviewSource('review-c', 'fireball', 'pfx-source-v1:stale'),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })).toThrow(/stale/i)
  })

  it('records a reviewer-rejected reduced-motion proof as rework instead of discarding the review', () => {
    const disputedSource = reviewSource('review-c', 'fireball')
    disputedSource.review.effects[0]!.reducedMotionReadable = false

    const result = assemblePfxQualityIteration({
      iteration: 1,
      effects: [{
        effectId: 'fireball',
        rank: 1,
        name: 'Fireball',
        originalGrade: null,
        performanceTier: 'low',
      }],
      reviews: [
        reviewSource('review-a', 'fireball'),
        reviewSource('review-b', 'fireball'),
        disputedSource,
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })

    expect(result.matrix.effects[0]).toMatchObject({
      effectId: 'fireball',
      finalPass: false,
      reducedMotionReadable: false,
    })
    expect(result.matrix.effects[0]!.blockers).toContain('reduced-motion readability unverified')
    expect(result.effectStates[0]!.action).toBe('refine-recipe')
  })

  it('assembles a canonical matrix and routes shared visual defects first', () => {
    const effects = [
      { effectId: 'fireball', rank: 500, name: 'Fireball', originalGrade: null, performanceTier: 'low' as const },
      { effectId: 'explosion', rank: 499, name: 'Explosion', originalGrade: null, performanceTier: 'low' as const },
    ]
    const result = assemblePfxQualityIteration({
      iteration: 1,
      effects,
      reviews: [
        reviewSource('review-a', ['fireball', 'explosion'], 'pfx-source-v1:current', 3),
        reviewSource('review-b', ['fireball', 'explosion'], 'pfx-source-v1:current', 3),
        reviewSource('review-c', ['fireball', 'explosion'], 'pfx-source-v1:current', 3),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:current',
        explosion: 'pfx-source-v1:current',
      },
      reducedMotionReadableEffectIds: ['fireball', 'explosion'],
      performanceReviews: [],
    })

    expect(result.matrix.effects).toHaveLength(2)
    expect(result.effectStates).toHaveLength(2)
    expect(result.effectStates.every((effect) => effect.action === 'refine-primitive')).toBe(true)
    expect(result.next).toMatchObject({
      action: 'refine-primitive',
      ownerPath: 'src/PfxSurface.tsx',
      effectIds: ['fireball', 'explosion'],
    })
    const status = createPfxQualityStatus(
      result.matrix,
      result.ledger,
      {
        fireball: 'pfx-source-v1:current',
        explosion: 'pfx-source-v1:current',
      },
    )
    expect(status.categories['reviewed-rework']).toBe(2)
    expect(status.firstAction).toMatchObject({
      action: 'refine-primitive',
      effectIds: ['fireball', 'explosion'],
    })
    expect(status.markdown).toContain('Reviewed / rework: 2')
    const staleStatus = createPfxQualityStatus(
      result.matrix,
      result.ledger,
      {
        fireball: 'pfx-source-v1:newer-fireball',
        explosion: 'pfx-source-v1:current',
      },
    )
    expect(staleStatus.categories['stale-evidence']).toBe(1)
    expect(staleStatus.firstAction).toMatchObject({
      action: 'request-review',
      effectIds: ['fireball'],
    })
  })

  it('preserves a rank-500 reviewer disagreement ahead of the unreviewed backlog', () => {
    const result = assemblePfxQualityIteration({
      iteration: 1,
      effects: [
        {
          effectId: 'fireball',
          rank: 500,
          name: 'Fireball',
          originalGrade: null,
          performanceTier: 'low',
        },
        {
          effectId: 'explosion',
          rank: 499,
          name: 'Explosion',
          originalGrade: null,
          performanceTier: 'low',
        },
        {
          effectId: 'smoke-puff',
          rank: 498,
          name: 'Smoke Puff',
          originalGrade: null,
          performanceTier: 'low',
        },
      ],
      reviews: [
        reviewSource('review-a', 'fireball', 'pfx-source-v1:current', 2),
        reviewSource('review-b', 'fireball', 'pfx-source-v1:current', 4),
        reviewSource('review-c', 'fireball', 'pfx-source-v1:current', 5),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })

    expect(result.matrix.effects[0]!.finalPass).toBe(false)
    expect(result.next).toMatchObject({
      action: 'adjudicate-review',
      effectIds: ['fireball'],
    })
  })

  it('persists a newly disputed row as non-approving even when its median regresses', () => {
    const effect = {
      effectId: 'fireball',
      rank: 500,
      name: 'Fireball',
      originalGrade: null,
      performanceTier: 'low' as const,
    }
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects: [effect],
      reviews: [
        reviewSource('before-a', 'fireball', 'pfx-source-v1:before', 5),
        reviewSource('before-b', 'fireball', 'pfx-source-v1:before', 5),
        reviewSource('before-c', 'fireball', 'pfx-source-v1:before', 5),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:before' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    }).ledger

    const disputed = assemblePfxQualityIteration({
      iteration: 2,
      effects: [effect],
      reviews: [
        reviewSource('after-pass-a', 'fireball', 'pfx-source-v1:after', 4, 'pass'),
        reviewSource('after-pass-b', 'fireball', 'pfx-source-v1:after', 4, 'pass'),
        reviewSource('after-dissent', 'fireball', 'pfx-source-v1:after', 3, 'rework'),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:after' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous,
      decision: {
        hypothesis: 'A revised shell will improve the visual result.',
        defectKey: 'visual:volumeAndDepth',
        affectedEffects: ['fireball'],
        changedPaths: ['src/recipes/fireball.ts'],
        beforeFingerprints: { fireball: 'pfx-source-v1:before' },
        result: 'The new output produced a reviewer disagreement.',
        validator: 'npm test',
        craftGuideAnchor: 'pfx-craft-guide.md#1-anatomy-effects-are-stacks-not-emitters',
      },
    })

    expect(disputed.matrix.effects[0]).toMatchObject({
      effectId: 'fireball',
      finalPass: false,
    })
    expect(disputed.ledger.effects[0]!.systemicDefectKeys).toContain(
      'evidence:peer-review-disagreement',
    )
    expect(disputed.next).toMatchObject({
      action: 'adjudicate-review',
      effectIds: ['fireball'],
    })
    expect(disputed.decisionRecord).toBeNull()
  })

  it('does not record implementation convergence when a newly disputed row reduces blocker count', () => {
    const effect = {
      effectId: 'fireball',
      rank: 500,
      name: 'Fireball',
      originalGrade: null,
      performanceTier: 'low' as const,
    }
    const previousResult = assemblePfxQualityIteration({
      iteration: 1,
      effects: [effect],
      reviews: [
        reviewSource('before-a', 'fireball', 'pfx-source-v1:before', 3, 'rework'),
        reviewSource('before-b', 'fireball', 'pfx-source-v1:before', 3, 'rework'),
        reviewSource('before-c', 'fireball', 'pfx-source-v1:before', 3, 'rework'),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:before' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })

    const disputed = assemblePfxQualityIteration({
      iteration: 2,
      effects: [effect],
      reviews: [
        reviewSource('after-pass-a', 'fireball', 'pfx-source-v1:after', 4, 'pass'),
        reviewSource('after-pass-b', 'fireball', 'pfx-source-v1:after', 4, 'pass'),
        reviewSource('after-dissent', 'fireball', 'pfx-source-v1:after', 3, 'rework'),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:after' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous: previousResult.ledger,
      previousMatrix: previousResult.matrix,
      decision: {
        hypothesis: 'A revised shell will improve the visual result.',
        defectKey: 'visual:volumeAndDepth',
        affectedEffects: ['fireball'],
        changedPaths: ['src/recipes/fireball.ts'],
        beforeFingerprints: { fireball: 'pfx-source-v1:before' },
        result: 'The median improved but the verdict remains disputed.',
        validator: 'npm test',
        craftGuideAnchor: 'pfx-craft-guide.md#1-anatomy-effects-are-stacks-not-emitters',
      },
    })

    expect(disputed.ledger.convergence).toMatchObject({
      converging: true,
      reason: 'blocker-count-decreased',
    })
    expect(disputed.next).toMatchObject({
      action: 'adjudicate-review',
      effectIds: ['fireball'],
    })
    expect(disputed.decisionRecord).toBeNull()
  })

  it('accepts a resolved blind adjudication downgrade without treating it as implementation convergence', () => {
    const effect = {
      effectId: 'fireball',
      rank: 500,
      name: 'Fireball',
      originalGrade: null,
      performanceTier: 'low' as const,
    }
    const originalReviews = [
      reviewSource('original-pass-4', 'fireball', 'pfx-source-v1:current', 4, 'pass', '2026-01-01T00:00:01Z'),
      reviewSource('original-pass-5', 'fireball', 'pfx-source-v1:current', 5, 'pass', '2026-01-01T00:00:02Z'),
      reviewSource('original-dissent', 'fireball', 'pfx-source-v1:current', 3, 'rework', '2026-01-01T00:00:03Z'),
    ]
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects: [effect],
      reviews: originalReviews,
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })
    const adjudicatedReviews = [
      ...originalReviews,
      reviewSource('adjudication-rework-a', 'fireball', 'pfx-source-v1:current', 3, 'rework', '2026-01-01T00:00:04Z'),
      reviewSource('adjudication-rework-b', 'fireball', 'pfx-source-v1:current', 3, 'rework', '2026-01-01T00:00:05Z'),
    ]
    const input = {
      iteration: 2,
      effects: [effect],
      reviews: adjudicatedReviews,
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous: previous.ledger,
    }

    expect(() => assemblePfxQualityIteration(input)).toThrow(/quality-regression/i)
    const resolved = assemblePfxQualityIteration({
      ...input,
      adjudicationEffectIds: ['fireball'],
    })

    expect(resolved.decisionRecord).toBeNull()
    expect(resolved.matrix.effects[0]!.blockers).not.toContainEqual(expect.stringMatching(/disagreement/i))
    expect(resolved.next).toMatchObject({
      action: 'refine-recipe',
      effectIds: ['fireball'],
    })
  })

  it('preserves unrelated reviewed rows when assembling a partial disputed batch', () => {
    const effects = [
      {
        effectId: 'fireball',
        rank: 500,
        name: 'Fireball',
        originalGrade: null,
        performanceTier: 'low' as const,
      },
      {
        effectId: 'explosion',
        rank: 499,
        name: 'Explosion',
        originalGrade: null,
        performanceTier: 'low' as const,
      },
    ]
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects,
      reviews: [
        reviewSource('fireball-before-a', 'fireball', 'pfx-source-v1:fireball-before', 5),
        reviewSource('fireball-before-b', 'fireball', 'pfx-source-v1:fireball-before', 5),
        reviewSource('fireball-before-c', 'fireball', 'pfx-source-v1:fireball-before', 5),
        reviewSource('explosion-before-a', 'explosion', 'pfx-source-v1:explosion', 5, 'rework'),
        reviewSource('explosion-before-b', 'explosion', 'pfx-source-v1:explosion', 3, 'rework'),
        reviewSource('explosion-before-c', 'explosion', 'pfx-source-v1:explosion', 4, 'rework'),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:fireball-before',
        explosion: 'pfx-source-v1:explosion',
      },
      reducedMotionReadableEffectIds: ['fireball', 'explosion'],
      performanceReviews: [],
    })

    const disputed = assemblePfxQualityIteration({
      iteration: 2,
      effects,
      reviews: [
        reviewSource('fireball-after-a', 'fireball', 'pfx-source-v1:fireball-after', 5, 'rework'),
        reviewSource('fireball-after-b', 'fireball', 'pfx-source-v1:fireball-after', 3, 'rework'),
        reviewSource('fireball-after-c', 'fireball', 'pfx-source-v1:fireball-after', 4, 'rework'),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:fireball-after',
        explosion: 'pfx-source-v1:explosion',
      },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous: previous.ledger,
      previousMatrix: previous.matrix,
    })

    expect(disputed.matrix.effects.find((effect) => effect.effectId === 'explosion'))
      .toEqual(previous.matrix.effects.find((effect) => effect.effectId === 'explosion'))
    expect(disputed.ledger.summary.regressedEffectIds).toEqual(['fireball'])
    expect(disputed.next).toMatchObject({
      action: 'adjudicate-review',
      effectIds: ['fireball', 'explosion'],
    })
    const status = createPfxQualityStatus(
      disputed.matrix,
      disputed.ledger,
      {
        fireball: 'pfx-source-v1:fireball-after',
        explosion: 'pfx-source-v1:explosion-newer',
      },
    )
    expect(status.categories['stale-evidence']).toBe(1)
    expect(status.firstAction).toMatchObject({
      action: 'adjudicate-review',
      effectIds: ['fireball'],
    })

    const resolved = assemblePfxQualityIteration({
      iteration: 3,
      effects,
      reviews: [
        reviewSource('fireball-resolved-a', 'fireball', 'pfx-source-v1:fireball-after', 3, 'rework'),
        reviewSource('fireball-resolved-b', 'fireball', 'pfx-source-v1:fireball-after', 3, 'rework'),
        reviewSource('fireball-resolved-c', 'fireball', 'pfx-source-v1:fireball-after', 3, 'rework'),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:fireball-after',
        explosion: 'pfx-source-v1:explosion-newer',
      },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous: disputed.ledger,
      previousMatrix: disputed.matrix,
      adjudicationEffectIds: ['fireball'],
    })
    const resolvedStatus = createPfxQualityStatus(
      resolved.matrix,
      resolved.ledger,
      {
        fireball: 'pfx-source-v1:fireball-after',
        explosion: 'pfx-source-v1:explosion-newer',
      },
    )
    expect(resolvedStatus.firstAction).toMatchObject({
      action: 'refine-recipe',
      effectIds: ['fireball'],
      ownerPath: 'src/recipes/fireball.ts',
    })
  })

  it('fails closed instead of replacing canonical output on a quality plateau', () => {
    const input = {
      effects: [{
        effectId: 'fireball',
        rank: 1,
        name: 'Fireball',
        originalGrade: null,
        performanceTier: 'low' as const,
      }],
      reviews: [
        reviewSource('review-a', 'fireball', 'pfx-source-v1:current', 3),
        reviewSource('review-b', 'fireball', 'pfx-source-v1:current', 3),
        reviewSource('review-c', 'fireball', 'pfx-source-v1:current', 3),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:current' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    }
    const previous = assemblePfxQualityIteration({ iteration: 1, ...input }).ledger

    expect(() => assemblePfxQualityIteration({
      iteration: 2,
      ...input,
      previous,
    })).toThrow(/plateau/i)
  })

  it('accepts first-time visual evidence without misclassifying review intake as an implementation plateau', () => {
    const effects = [
      {
        effectId: 'fireball',
        rank: 500,
        name: 'Fireball',
        originalGrade: null,
        performanceTier: 'low' as const,
      },
      {
        effectId: 'explosion',
        rank: 499,
        name: 'Explosion',
        originalGrade: null,
        performanceTier: 'low' as const,
      },
    ]
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects,
      reviews: [
        reviewSource('fireball-a', 'fireball', 'pfx-source-v1:fireball', 4),
        reviewSource('fireball-b', 'fireball', 'pfx-source-v1:fireball', 4),
        reviewSource('fireball-c', 'fireball', 'pfx-source-v1:fireball', 4),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:fireball',
        explosion: 'pfx-source-v1:explosion',
      },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })

    const reviewed = assemblePfxQualityIteration({
      iteration: 2,
      effects,
      reviews: [
        reviewSource('explosion-a', 'explosion', 'pfx-source-v1:explosion', 2),
        reviewSource('explosion-b', 'explosion', 'pfx-source-v1:explosion', 2),
        reviewSource('explosion-c', 'explosion', 'pfx-source-v1:explosion', 2),
      ],
      currentSourceFingerprints: {
        fireball: 'pfx-source-v1:fireball',
        explosion: 'pfx-source-v1:explosion',
      },
      reducedMotionReadableEffectIds: ['explosion'],
      performanceReviews: [],
      previous: previous.ledger,
      previousMatrix: previous.matrix,
    })

    expect(reviewed.matrix.effects.find((effect) => effect.effectId === 'explosion'))
      .toMatchObject({
        sourceFingerprint: 'pfx-source-v1:explosion',
        scores: { overallProductionPolish: 2 },
        visualPass: false,
      })
    expect(reviewed.ledger.convergence).toEqual({
      converging: true,
      reason: 'visual-evidence-coverage-increased',
    })
    expect(reviewed.decisionRecord).toBeNull()
  })

  it('accepts an equal-quality refresh that resolves stale source evidence without recording convergence', () => {
    const effect = {
      effectId: 'fireball',
      rank: 500,
      name: 'Fireball',
      originalGrade: null,
      performanceTier: 'low' as const,
    }
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects: [effect],
      reviews: [
        reviewSource('before-a', 'fireball', 'pfx-source-v1:before', 4),
        reviewSource('before-b', 'fireball', 'pfx-source-v1:before', 4),
        reviewSource('before-c', 'fireball', 'pfx-source-v1:before', 4),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:before' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    })
    const refreshed = assemblePfxQualityIteration({
      iteration: 2,
      effects: [effect],
      reviews: [
        reviewSource('after-a', 'fireball', 'pfx-source-v1:after', 4),
        reviewSource('after-b', 'fireball', 'pfx-source-v1:after', 4),
        reviewSource('after-c', 'fireball', 'pfx-source-v1:after', 4),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:after' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous: previous.ledger,
      previousMatrix: previous.matrix,
    })

    expect(refreshed.ledger.convergence).toEqual({
      converging: false,
      reason: 'quality-plateau',
    })
    expect(refreshed.matrix.effects[0]!.sourceFingerprint)
      .toBe('pfx-source-v1:after')
    expect(refreshed.decisionRecord).toBeNull()
  })

  it('creates one compact decision record only for a converging iteration', () => {
    const effect = {
      effectId: 'fireball',
      rank: 1,
      name: 'Fireball',
      originalGrade: null,
      performanceTier: 'low' as const,
    }
    const previous = assemblePfxQualityIteration({
      iteration: 1,
      effects: [effect],
      reviews: [
        reviewSource('before-a', 'fireball', 'pfx-source-v1:before', 3),
        reviewSource('before-b', 'fireball', 'pfx-source-v1:before', 3),
        reviewSource('before-c', 'fireball', 'pfx-source-v1:before', 3),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:before' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
    }).ledger
    const result = assemblePfxQualityIteration({
      iteration: 2,
      effects: [effect],
      reviews: [
        reviewSource('after-a', 'fireball', 'pfx-source-v1:after', 4),
        reviewSource('after-b', 'fireball', 'pfx-source-v1:after', 4),
        reviewSource('after-c', 'fireball', 'pfx-source-v1:after', 4),
      ],
      currentSourceFingerprints: { fireball: 'pfx-source-v1:after' },
      reducedMotionReadableEffectIds: ['fireball'],
      performanceReviews: [],
      previous,
      decision: {
        hypothesis: 'A more volumetric core will improve depth.',
        defectKey: 'visual:volumeAndDepth',
        affectedEffects: ['fireball'],
        changedPaths: ['src/recipes/fireball.ts'],
        beforeFingerprints: { fireball: 'pfx-source-v1:before' },
        result: 'Median visual score increased.',
        validator: 'viewer/src/qualityWorkflow.test.ts',
        craftGuideAnchor: 'docs/pfx-craft-guide.md#defect-visual-volumeanddepth',
      },
    })

    expect(result.decisionRecord).toMatchObject({
      iteration: 2,
      defectKey: 'visual:volumeAndDepth',
      afterFingerprints: { fireball: 'pfx-source-v1:after' },
      convergenceVerdict: 'blocker-count-decreased',
    })
  })
})

describe('PFX quality capture manifest', () => {
  it('rejects blank WebGL readbacks before a capture batch can be published', () => {
    expect(collectPfxCapturePixelDefects(0)).toEqual([
      'capture contains no review-active pixels',
    ])
    expect(collectPfxCapturePixelDefects(64)).toEqual([])
    expect(shouldAcceptPfxEmptyProbe(0, 0, 60, true)).toBe(false)
    expect(shouldAcceptPfxEmptyProbe(0, 59, 60, true)).toBe(true)
    expect(shouldAcceptPfxEmptyProbe(0, 59, 60, false)).toBe(false)
    expect(shouldAcceptPfxEmptyProbe(12, 59, 60, true)).toBe(true)
  })

  it('packages nine lifecycle cells, gameplay context, and reduced motion under one honest distance', () => {
    const lifecycleCaptures = (['front', 'three-quarter', 'side'] as const).flatMap((angle) =>
      (['onset', 'peak', 'decay'] as const).map((phase) => ({
        angle,
        phase,
        file: `.context/quality/capture-a/fireball-${phase}-${angle}.png`,
      })))
    const manifest = createPfxVisualCaptureManifest({
      batchId: 'capture-a',
      effects: [{
        effectId: 'fireball',
        sourceFingerprint: 'pfx-source-v1:current',
        cameraDistance: 4.25,
        lifecycleSamples: [
          { phase: 'onset', sampleMs: 120 },
          { phase: 'peak', sampleMs: 320 },
          { phase: 'decay', sampleMs: 620 },
        ],
        lifecycleCaptures,
        gameplayContextCaptures: [{
          angle: 'three-quarter',
          phase: 'peak',
          file: '.context/quality/capture-a/fireball-gameplay-peak-three-quarter.png',
        }],
        reducedMotionCapture: {
          angle: 'three-quarter',
          phase: 'peak',
          file: '.context/quality/capture-a/fireball-reduced-motion-peak-three-quarter.png',
        },
      }],
    })

    expect(manifest.schema).toBe('game-bot.r3f-pfx-visual-capture-batch.v3')
    expect(manifest.effects[0]).toMatchObject({
      effectId: 'fireball',
      sourceFingerprint: 'pfx-source-v1:current',
      cameraDistance: 4.25,
    })
    expect(manifest.effects[0]!.lifecycleCaptures).toHaveLength(9)
    expect(manifest.effects[0]!.reducedMotionCapture.file).toContain('reduced-motion')
  })
})
