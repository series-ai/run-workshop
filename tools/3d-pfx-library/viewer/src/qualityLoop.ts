export type PfxQualityTargetGrade = 'A+' | 'A'
export type PfxObservedGrade = PfxQualityTargetGrade | 'B' | 'C' | 'D' | 'F' | null

export interface PfxQualityLoopEffect {
  effectId: string
  rank: number
  currentGrade: PfxObservedGrade
  worstVisualScore: number | null
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
    .sort((left, right) => left.rank - right.rank || left.effectId.localeCompare(right.effectId))
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
      if (!previous || !pfxEffectMeetsTarget(previous)) return false
      return !pfxEffectMeetsTarget(effect) ||
        nullableMetricRegressed(previous.worstVisualScore, effect.worstVisualScore) ||
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
    blockerCount: effects.reduce((total, effect) => total + effect.visualBlockers.length, 0),
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
    // v1 ledgers written before evidence-coverage tracking remain resumable.
    visualEvidenceCount: ledger.summary.visualEvidenceCount ?? ledger.effects.filter((effect) => effect.worstVisualScore != null).length,
    performanceEvidenceCount: ledger.summary.performanceEvidenceCount ?? ledger.effects.filter((effect) => effect.performanceHeadroomMs != null).length,
  }
}

function nullableMetricRegressed(previous: number | null, current: number | null): boolean {
  return previous != null && (current == null || current < previous)
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
      const ordered = [...affected].sort((left, right) => left.rank - right.rank || left.effectId.localeCompare(right.effectId))
      ordered.forEach((effect) => systemicEffectIds.add(effect.effectId))
      return {
        kind: 'systemic',
        defectKey,
        effectIds: ordered.map((effect) => effect.effectId),
        priority: pfxSystemicDefectPriorityBase(defectKey) +
          ordered.length * 1_000 -
          Math.min(...ordered.map((effect) => effect.rank)),
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
          effect.visualBlockers.length * 100 - effect.rank,
      }
    })
    .filter((item): item is PfxQualityImprovementWorkItem => item != null)

  return [...systemicItems, ...effectItems].sort(
    (left, right) => right.priority - left.priority || left.effectIds[0]!.localeCompare(right.effectIds[0]!),
  )
}

function pfxSystemicDefectPriorityBase(defectKey: string): number {
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

  return { converging: false, reason: 'quality-plateau' }
}
