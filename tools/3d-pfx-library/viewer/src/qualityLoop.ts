export type PfxQualityTargetGrade = 'A+' | 'A'
export type PfxObservedGrade = PfxQualityTargetGrade | 'B' | 'C' | 'D' | 'F' | null
export type PfxQualityAction =
  | 'refine-primitive'
  | 'refine-recipe'
  | 'request-review'
  | 'request-device-evidence'
  | 'adjudicate-review'
  | 'stop'

export interface PfxQualityActionRoute {
  action: PfxQualityAction
  ownerPath: string | null
  docAnchor: string
  reason: string
}

export interface PfxQualityActionRouteInput {
  effectIds: readonly string[]
  defectKey: string | null
  targetPassed: boolean
  reviewerDisagreement: boolean
}

export interface PfxQualityLoopEffect {
  effectId: string
  rank: number
  currentGrade: PfxObservedGrade
  worstVisualScore: number | null
  visualScores?: Record<string, number> | null
  weightedScore: number | null
  visualBlockers: string[]
  systemicDefectKeys: string[]
  performancePassed: boolean
  performanceHeadroomMs: number | null
}

export interface PfxQualityImprovementWorkItem {
  kind: 'systemic' | 'effect'
  defectKey: string | null
  effectIds: string[]
  priority: number
  action: PfxQualityAction
  ownerPath: string | null
  docAnchor: string
  reason: string
}

export interface PfxQualityLoopSnapshot {
  iteration: number
  targetPasses: number
  blockerCount: number
  visualEvidenceCount: number
  performanceEvidenceCount: number
  worstVisualScore: number
  weightedScore: number
  systemicDefectsRemaining: number
  minimumPerformanceHeadroomMs: number
  regressedEffectIds: string[]
}

export interface PfxQualityConvergenceVerdict {
  converging: boolean
  reason: string
}

export interface PfxQualityImprovementLedger {
  schema: 'game-bot.r3f-pfx-quality-improvement-ledger.v1'
  iteration: number
  summary: PfxQualityLoopSnapshot
  convergence: PfxQualityConvergenceVerdict | null
  queue: PfxQualityImprovementWorkItem[]
  effects: PfxQualityLoopEffect[]
}

export interface CreatePfxQualityImprovementLedgerInput {
  iteration: number
  effects: readonly PfxQualityLoopEffect[]
  previous?: PfxQualityImprovementLedger
}

export function routePfxQualityAction(input: PfxQualityActionRouteInput): PfxQualityAction {
  return createPfxQualityActionRoute(input).action
}

export function createPfxQualityActionRoute(input: PfxQualityActionRouteInput): PfxQualityActionRoute {
  const effectIds = [...new Set(input.effectIds)]
  const effectId = effectIds[0]
  if (input.reviewerDisagreement) {
    return {
      action: 'adjudicate-review',
      ownerPath: null,
      docAnchor: 'docs/quality-review-workflow.md#reviewer-disagreement',
      reason: `Independent reviewers disagree on ${summarizePfxEffectIds(effectIds)}`,
    }
  }
  if (input.targetPassed) {
    return {
      action: 'stop',
      ownerPath: null,
      docAnchor: 'docs/production-pfx-standard.md#acceptance',
      reason: `The assigned quality target is met for ${summarizePfxEffectIds(effectIds)}`,
    }
  }
  if (input.defectKey === 'evidence:independent-visual-review' || input.defectKey == null) {
    return {
      action: 'request-review',
      ownerPath: null,
      docAnchor: 'docs/quality-review-workflow.md#independent-review',
      reason: `Independent visual review is missing for ${summarizePfxEffectIds(effectIds)}`,
    }
  }
  if (input.defectKey === 'performance:real-device') {
    return {
      action: 'request-device-evidence',
      ownerPath: null,
      docAnchor: 'docs/quality-review-workflow.md#real-device-evidence',
      reason: `Physical mobile Safari and Chrome Android evidence is missing for ${summarizePfxEffectIds(effectIds)}`,
    }
  }
  if (effectIds.length >= 2) {
    return {
      action: 'refine-primitive',
      ownerPath: 'src/PfxSurface.tsx',
      docAnchor: `docs/pfx-craft-guide.md#${defectAnchor(input.defectKey)}`,
      reason: `${input.defectKey} affects ${effectIds.length} effects and belongs to a shared renderer/runtime surface`,
    }
  }
  return {
    action: 'refine-recipe',
    ownerPath: effectId ? `src/recipes/${effectId}.ts` : null,
    docAnchor: `docs/pfx-craft-guide.md#${defectAnchor(input.defectKey)}`,
    reason: `${input.defectKey} is isolated to ${effectId ?? 'one effect'}`,
  }
}

function defectAnchor(defectKey: string): string {
  const dimension = defectKey.slice('visual:'.length)
  if (dimension === 'temporalArcAndDecay') return '2-timing-the-temporal-sentence'
  if (dimension === 'materialAndShaderQuality') return '3-blend-modes-have-opposite-death-rules'
  if (dimension === 'cc0AssetIntegration') return '4-color-ramps-not-tints'
  if ([
    'volumeAndDepth',
    'multiAngleResilience',
    'silhouetteAndComposition',
    'distinctivenessAndRingDiscipline',
    'scaleAndVisualHierarchy',
  ].includes(dimension)) return '5-shape-and-silhouette'
  if (dimension === 'meshStructureAndEmitterQuality') return '1-anatomy-effects-are-stacks-not-emitters'
  if (dimension === 'semanticIdentity' || dimension === 'gameplayReadability') {
    return '8-readability-and-restraint'
  }
  return '9-verify-with-instruments-and-hostile-eyes'
}

function summarizePfxEffectIds(effectIds: readonly string[]): string {
  if (effectIds.length === 0) return 'the effect'
  if (effectIds.length <= 5) return effectIds.join(', ')
  return `${effectIds.slice(0, 5).join(', ')}, and ${effectIds.length - 5} more effects`
}

export function pfxTargetGradeForRank(rank: number): PfxQualityTargetGrade {
  if (!Number.isInteger(rank) || rank < 1 || rank > 500) throw new Error(`Invalid PFX taxonomy rank: ${rank}`)
  return rank <= 50 ? 'A+' : 'A'
}

export function createPfxQualityImprovementLedger(
  input: CreatePfxQualityImprovementLedgerInput,
): PfxQualityImprovementLedger {
  if (!Number.isInteger(input.iteration) || input.iteration < 1) {
    throw new Error(`Invalid PFX quality iteration: ${input.iteration}`)
  }
  if (input.previous && input.previous.iteration >= input.iteration) {
    throw new Error('PFX quality ledger iteration must increase')
  }

  const effects = input.effects
    .map((effect) => ({
      ...effect,
      visualBlockers: [...new Set(effect.visualBlockers)].sort(),
      systemicDefectKeys: [...new Set(effect.systemicDefectKeys)].sort(),
    }))
    .sort((left, right) => right.rank - left.rank || left.effectId.localeCompare(right.effectId))
  const effectIds = new Set<string>()
  for (const effect of effects) {
    pfxTargetGradeForRank(effect.rank)
    if (effectIds.has(effect.effectId)) throw new Error(`Duplicate PFX quality effect: ${effect.effectId}`)
    effectIds.add(effect.effectId)
  }

  const queue = createPfxQualityImprovementQueue(effects)
  const previousEffects = new Map(input.previous?.effects.map((effect) => [effect.effectId, effect]) ?? [])
  const regressedEffectIds = effects
    .filter((effect) => {
      const previous = previousEffects.get(effect.effectId)
      if (!previous) return false
      return (pfxEffectMeetsTarget(previous) && !pfxEffectMeetsTarget(effect)) ||
        observedGradeRegressed(previous.currentGrade, effect.currentGrade) ||
        nullableMetricRegressed(previous.worstVisualScore, effect.worstVisualScore) ||
        visualDimensionRegressed(previous.visualScores, effect.visualScores) ||
        nullableMetricRegressed(previous.weightedScore, effect.weightedScore) ||
        nullableMetricRegressed(previous.performanceHeadroomMs, effect.performanceHeadroomMs)
    })
    .map((effect) => effect.effectId)
    .sort()

  const visualScores = effects.flatMap((effect) => effect.worstVisualScore == null ? [] : [effect.worstVisualScore])
  const weightedScores = effects.flatMap((effect) => effect.weightedScore == null ? [] : [effect.weightedScore])
  const performanceHeadroom = effects.flatMap((effect) => effect.performanceHeadroomMs == null ? [] : [effect.performanceHeadroomMs])
  const summary: PfxQualityLoopSnapshot = {
    iteration: input.iteration,
    targetPasses: effects.filter(pfxEffectMeetsTarget).length,
    // Reviewer prose is evidence, not a stable convergence unit: reviewers may
    // combine or split the same finding between iterations. Count canonical
    // defect keys so wording changes cannot manufacture apparent progress.
    blockerCount: effects.reduce((total, effect) => total + effect.systemicDefectKeys.length, 0),
    visualEvidenceCount: effects.filter((effect) => effect.worstVisualScore != null).length,
    performanceEvidenceCount: effects.filter((effect) => effect.performanceHeadroomMs != null).length,
    worstVisualScore: visualScores.length > 0 ? Math.min(...visualScores) : 0,
    weightedScore: roundQualityMetric(
      weightedScores.length > 0
        ? weightedScores.reduce((total, score) => total + score, 0) / weightedScores.length
        : 0,
    ),
    systemicDefectsRemaining: queue.filter((item) => item.kind === 'systemic').length,
    minimumPerformanceHeadroomMs: performanceHeadroom.length > 0 ? Math.min(...performanceHeadroom) : 0,
    regressedEffectIds,
  }

  return {
    schema: 'game-bot.r3f-pfx-quality-improvement-ledger.v1',
    iteration: input.iteration,
    summary,
    convergence: input.previous
      ? evaluatePfxQualityConvergence(normalizePfxQualityLoopSnapshot(input.previous), summary)
      : null,
    queue,
    effects,
  }
}

function normalizePfxQualityLoopSnapshot(ledger: PfxQualityImprovementLedger): PfxQualityLoopSnapshot {
  return {
    ...ledger.summary,
    // Early v1 ledgers counted free-form reviewer findings. Recompute from
    // canonical defect keys so those ledgers compare on the current metric.
    blockerCount: ledger.effects.reduce(
      (total, effect) => total + effect.systemicDefectKeys.length,
      0,
    ),
    // v1 ledgers written before evidence-coverage tracking remain resumable.
    visualEvidenceCount: ledger.summary.visualEvidenceCount ?? ledger.effects.filter((effect) => effect.worstVisualScore != null).length,
    performanceEvidenceCount: ledger.summary.performanceEvidenceCount ?? ledger.effects.filter((effect) => effect.performanceHeadroomMs != null).length,
  }
}

function nullableMetricRegressed(previous: number | null, current: number | null): boolean {
  return previous != null && (current == null || current < previous)
}

function visualDimensionRegressed(
  previous: Readonly<Record<string, number>> | null | undefined,
  current: Readonly<Record<string, number>> | null | undefined,
): boolean {
  if (!previous) return false
  if (!current) return true
  return Object.entries(previous).some(
    ([dimension, score]) =>
      !Number.isFinite(current[dimension]) ||
      current[dimension]! < score,
  )
}

function observedGradeRegressed(previous: PfxObservedGrade, current: PfxObservedGrade): boolean {
  return previous != null && (current == null || PFX_GRADE_ORDER[current] < PFX_GRADE_ORDER[previous])
}

function roundQualityMetric(value: number): number {
  return Math.round(value * 100) / 100
}

export function createPfxQualityImprovementQueue(
  effects: readonly PfxQualityLoopEffect[],
): PfxQualityImprovementWorkItem[] {
  const openEffects = effects.filter((effect) => !pfxEffectMeetsTarget(effect))
  const effectsByDefect = new Map<string, PfxQualityLoopEffect[]>()
  for (const effect of openEffects) {
    for (const defectKey of new Set(effect.systemicDefectKeys)) {
      effectsByDefect.set(defectKey, [...(effectsByDefect.get(defectKey) ?? []), effect])
    }
  }

  const systemicEffectIds = new Set<string>()
  const systemicItems = [...effectsByDefect.entries()]
    .filter(([, affected]) => affected.length >= 2)
    .map(([defectKey, affected]): PfxQualityImprovementWorkItem => {
      const ordered = [...affected].sort((left, right) => right.rank - left.rank || left.effectId.localeCompare(right.effectId))
      ordered.forEach((effect) => systemicEffectIds.add(effect.effectId))
      return {
        kind: 'systemic',
        defectKey,
        effectIds: ordered.map((effect) => effect.effectId),
        priority: pfxSystemicDefectPriorityBase(defectKey) +
          ordered.length * 1_000 -
          (500 - Math.max(...ordered.map((effect) => effect.rank))),
        ...createPfxQualityActionRoute({
          effectIds: ordered.map((effect) => effect.effectId),
          defectKey,
          targetPassed: false,
          reviewerDisagreement: defectKey === 'evidence:peer-review-disagreement',
        }),
      }
    })
  const systemicDefectKeys = new Set(systemicItems.map((item) => item.defectKey).filter((key): key is string => key != null))

  const effectItems = openEffects
    .map((effect): PfxQualityImprovementWorkItem | null => {
      const uniqueDefectKey = effect.systemicDefectKeys
        .filter((defectKey) => !systemicDefectKeys.has(defectKey))
        .sort((left, right) => pfxSystemicDefectPriorityBase(right) - pfxSystemicDefectPriorityBase(left) || left.localeCompare(right))[0]
      if (!uniqueDefectKey && systemicEffectIds.has(effect.effectId)) return null
      return {
        kind: 'effect',
        defectKey: uniqueDefectKey ?? null,
        effectIds: [effect.effectId],
        priority: (uniqueDefectKey ? pfxSystemicDefectPriorityBase(uniqueDefectKey) : 10_000) +
          effect.visualBlockers.length * 100 - (500 - effect.rank),
        ...createPfxQualityActionRoute({
          effectIds: [effect.effectId],
          defectKey: uniqueDefectKey ?? null,
          targetPassed: false,
          reviewerDisagreement: uniqueDefectKey === 'evidence:peer-review-disagreement',
        }),
      }
    })
    .filter((item): item is PfxQualityImprovementWorkItem => item != null)

  return [...systemicItems, ...effectItems].sort(
    (left, right) => right.priority - left.priority || left.effectIds[0]!.localeCompare(right.effectIds[0]!),
  )
}

function pfxSystemicDefectPriorityBase(defectKey: string): number {
  if (defectKey === 'evidence:peer-review-disagreement') return 2_000_000
  if (defectKey.startsWith('visual:')) return 1_000_000 + pfxVisualDefectPriorityBonus(defectKey)
  if (defectKey.startsWith('evidence:')) return 100_000
  if (defectKey === 'performance:real-device') return 50_000
  return 500_000
}

function pfxVisualDefectPriorityBonus(defectKey: string): number {
  const dimension = defectKey.slice('visual:'.length)
  return {
    gameplayReadability: 700_000,
    semanticIdentity: 650_000,
    temporalArcAndDecay: 600_000,
    silhouetteAndComposition: 550_000,
    scaleAndVisualHierarchy: 500_000,
    volumeAndDepth: 450_000,
    multiAngleResilience: 400_000,
    distinctivenessAndRingDiscipline: 350_000,
    overallProductionPolish: 300_000,
    materialAndShaderQuality: 200_000,
    meshStructureAndEmitterQuality: 150_000,
    cc0AssetIntegration: 50_000,
  }[dimension] ?? 250_000
}

const PFX_GRADE_ORDER: Record<Exclude<PfxObservedGrade, null>, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
  'A+': 5,
}

function pfxEffectMeetsTarget(effect: PfxQualityLoopEffect): boolean {
  if (effect.currentGrade == null) return false
  return PFX_GRADE_ORDER[effect.currentGrade] >= PFX_GRADE_ORDER[pfxTargetGradeForRank(effect.rank)] &&
    effect.visualBlockers.length === 0 &&
    effect.performancePassed
}

export function evaluatePfxQualityConvergence(
  previous: PfxQualityLoopSnapshot,
  current: PfxQualityLoopSnapshot,
): PfxQualityConvergenceVerdict {
  const regressedEffectIds = [...current.regressedEffectIds].sort()
  if (regressedEffectIds.length > 0) {
    return {
      converging: false,
      reason: `quality-regression:${regressedEffectIds.join(',')}`,
    }
  }

  if (current.visualEvidenceCount < previous.visualEvidenceCount) {
    return { converging: false, reason: 'evidence-coverage-regressed:visual' }
  }

  if (current.performanceEvidenceCount < previous.performanceEvidenceCount) {
    return { converging: false, reason: 'evidence-coverage-regressed:performance' }
  }

  if (current.targetPasses > previous.targetPasses) {
    return { converging: true, reason: 'target-passes-increased' }
  }

  if (current.blockerCount < previous.blockerCount) {
    return { converging: true, reason: 'blocker-count-decreased' }
  }

  if (current.worstVisualScore > previous.worstVisualScore) {
    return { converging: true, reason: 'worst-visual-score-increased' }
  }

  if (current.weightedScore > previous.weightedScore) {
    return { converging: true, reason: 'weighted-score-increased' }
  }

  if (current.systemicDefectsRemaining < previous.systemicDefectsRemaining) {
    return { converging: true, reason: 'systemic-defects-decreased' }
  }

  if (
    current.minimumPerformanceHeadroomMs >
    previous.minimumPerformanceHeadroomMs
  ) {
    return { converging: true, reason: 'performance-headroom-increased' }
  }

  if (current.visualEvidenceCount > previous.visualEvidenceCount) {
    return { converging: true, reason: 'visual-evidence-coverage-increased' }
  }

  if (current.performanceEvidenceCount > previous.performanceEvidenceCount) {
    return { converging: true, reason: 'performance-evidence-coverage-increased' }
  }

  return { converging: false, reason: 'quality-plateau' }
}
