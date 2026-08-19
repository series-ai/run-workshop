import {
  assemblePfxQualityMatrixVisualReviewConsensus,
  createPfxQualityImprovementLedgerFromMatrix,
  createPfxQualityMatrix,
  PFX_VISUAL_QUALITY_DIMENSIONS,
  type PfxMatrixEffectInput,
  type PfxMatrixPerformanceReviewInput,
  type PfxPeerReviewAssemblySource,
  type PfxPeerVisualReviewReport,
  type PfxQualityMatrix,
  type PfxVisualCaptureManifest,
  type PfxVisualLifecyclePhase,
} from './profiling'
export {
  createPfxQualityActionRoute,
  routePfxQualityAction,
  type PfxQualityAction,
  type PfxQualityActionRoute,
  type PfxQualityActionRouteInput,
} from './qualityLoop'
import {
  createPfxQualityActionRoute as createQualityActionRoute,
  type PfxQualityImprovementLedger,
  type PfxQualityImprovementWorkItem,
} from './qualityLoop'

export type PfxQualityStatusCategory =
  | 'approved'
  | 'visually-passing-device-blocked'
  | 'reviewed-rework'
  | 'awaiting-review'
  | 'stale-evidence'

export function createPfxFingerprintAuditEffectIds(
  reviewedEffectIds: readonly string[],
  previousMatrix?: {
    effects?: ReadonlyArray<{
      effectId: string
      sourceFingerprint: string | null
    }>
  },
): string[] {
  return [...new Set([
    ...reviewedEffectIds,
    ...(previousMatrix?.effects ?? [])
      .filter((effect) => effect.sourceFingerprint != null)
      .map((effect) => effect.effectId),
  ])].sort()
}

const PFX_PEER_REVIEW_SCORE_KEYS = [
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

export function parsePfxPeerVisualReviewReport(input: unknown): PfxPeerVisualReviewReport {
  if (!input || typeof input !== 'object') {
    throw new Error('Peer visual-review input must be an object')
  }
  const report = input as Record<string, unknown>
  if (report.schema !== 'game-bot.r3f-pfx-peer-visual-review.v1') {
    throw new Error('Peer visual-review input has an invalid schema')
  }
  if (typeof report.batchId !== 'string' || report.batchId.trim() === '') {
    throw new Error('Peer visual-review input requires a non-empty batchId')
  }
  if (typeof report.peerRuntime !== 'string' || report.peerRuntime.trim() === '') {
    throw new Error('Peer visual-review input requires a non-empty peerRuntime')
  }
  if (typeof report.independentRuntime !== 'boolean') {
    throw new Error('Peer visual-review input requires independentRuntime')
  }
  if (!Array.isArray(report.effects) || report.effects.length === 0) {
    throw new Error('Peer visual-review input requires a non-empty effects array')
  }
  for (const [effectIndex, effectInput] of report.effects.entries()) {
    if (!effectInput || typeof effectInput !== 'object') {
      throw new Error(`Peer visual-review effect ${effectIndex} must be an object`)
    }
    const effect = effectInput as Record<string, unknown>
    const label = typeof effect.effectId === 'string' ? effect.effectId : `at index ${effectIndex}`
    if (typeof effect.effectId !== 'string' || effect.effectId.trim() === '') {
      throw new Error(`Peer visual-review effect ${effectIndex} requires an effectId`)
    }
    if (!effect.scores || typeof effect.scores !== 'object') {
      throw new Error(`Peer visual-review effect ${label} requires scores`)
    }
    const scores = effect.scores as Record<string, unknown>
    for (const key of PFX_PEER_REVIEW_SCORE_KEYS) {
      if (!Number.isInteger(scores[key]) || (scores[key] as number) < 1 || (scores[key] as number) > 5) {
        throw new Error(`Peer visual-review effect ${label} requires an integer ${key} score from 1 to 5`)
      }
    }
    if (
      typeof effect.reviewerConfidence !== 'number' ||
      !Number.isFinite(effect.reviewerConfidence) ||
      effect.reviewerConfidence < 0 ||
      effect.reviewerConfidence > 1
    ) {
      throw new Error(`Peer visual-review effect ${label} requires reviewerConfidence from 0 to 1`)
    }
    if (!['A', 'B', 'C', 'D', 'F'].includes(String(effect.grade))) {
      throw new Error(`Peer visual-review effect ${label} has an invalid grade`)
    }
    if (effect.verdict !== 'pass' && effect.verdict !== 'rework') {
      throw new Error(`Peer visual-review effect ${label} has an invalid verdict`)
    }
    if (!Array.isArray(effect.findings) || !effect.findings.every((finding) => typeof finding === 'string')) {
      throw new Error(`Peer visual-review effect ${label} requires string findings`)
    }
    if (
      effect.reducedMotionReadable !== undefined &&
      typeof effect.reducedMotionReadable !== 'boolean'
    ) {
      throw new Error(`Peer visual-review effect ${label} has an invalid reducedMotionReadable value`)
    }
  }
  return input as PfxPeerVisualReviewReport
}

export function isPfxRenderSourceForEffect(effectId: string, sourcePath: string): boolean {
  const normalized = sourcePath.replaceAll('\\', '/').replace(/^\.\//, '')
  return !normalized.startsWith('src/recipes/') || normalized === `src/recipes/${effectId}.ts`
}

export function collectPfxCapturePixelDefects(activePixelCount: number): string[] {
  return Number.isFinite(activePixelCount) && activePixelCount >= 32
    ? []
    : ['capture contains no review-active pixels']
}

export function shouldAcceptPfxEmptyProbe(
  activePixelCount: number,
  attempt: number,
  maximumAttempts: number,
  allowEmptyProbe: boolean,
): boolean {
  return allowEmptyProbe &&
    Number.isFinite(activePixelCount) &&
    activePixelCount >= 0 &&
    activePixelCount < 32 &&
    maximumAttempts > 0 &&
    attempt === maximumAttempts - 1
}

export interface PfxQualityStatus {
  schema: 'game-bot.r3f-pfx-quality-status.v1'
  categories: Record<PfxQualityStatusCategory, number>
  effects: PfxQualityEffectState[]
  firstAction: PfxQualityImprovementWorkItem | null
  markdown: string
}

export interface PfxQualityEffectState {
  effectId: string
  category: PfxQualityStatusCategory
  action: import('./qualityLoop').PfxQualityAction
  ownerPath: string | null
  docAnchor: string
  reason: string
}

export interface CreatePfxVisualCaptureManifestInput {
  batchId: string
  effects: Array<{
    effectId: string
    sourceFingerprint: string
    cameraDistance: number
    lifecycleSamples: Array<{ phase: PfxVisualLifecyclePhase; sampleMs: number }>
    lifecycleCaptures: Array<{
      angle: 'front' | 'three-quarter' | 'side'
      phase: PfxVisualLifecyclePhase
      file: string
    }>
    gameplayContextCaptures: Array<{
      angle: 'front' | 'three-quarter' | 'side'
      phase: PfxVisualLifecyclePhase
      file: string
    }>
    reducedMotionCapture: {
      angle: 'front' | 'three-quarter' | 'side'
      phase: PfxVisualLifecyclePhase
      file: string
    }
  }>
}

export type PfxQualityVisualCaptureManifest = PfxVisualCaptureManifest & {
  effects: Array<PfxVisualCaptureManifest['effects'][number] & {
    sourceFingerprint: string
    cameraDistance: number
    lifecycleSamples: Array<{ phase: PfxVisualLifecyclePhase; sampleMs: number }>
    reducedMotionCapture: {
      angle: 'front' | 'three-quarter' | 'side'
      phase: PfxVisualLifecyclePhase
      file: string
    }
  }>
}

export interface AssemblePfxQualityIterationInput {
  iteration: number
  effects: readonly PfxMatrixEffectInput[]
  reviews: readonly PfxPeerReviewAssemblySource[]
  currentSourceFingerprints: Readonly<Record<string, string>>
  reducedMotionReadableEffectIds: readonly string[]
  performanceReviews: readonly PfxMatrixPerformanceReviewInput[]
  previous?: PfxQualityImprovementLedger
  /** Canonical rows from the prior iteration, used to preserve effects that
   * are not part of this partial review batch. */
  previousMatrix?: PfxQualityMatrix
  /** Evidence-only resolution for effects whose previous state required adjudication. */
  adjudicationEffectIds?: readonly string[]
  decision?: Omit<
    PfxQualityDecisionRecord,
    'schema' | 'iteration' | 'afterFingerprints' | 'convergenceVerdict'
  >
}

export interface PfxQualityIterationResult {
  schema: 'game-bot.r3f-pfx-quality-iteration.v1'
  iteration: number
  matrix: PfxQualityMatrix
  ledger: PfxQualityImprovementLedger
  effectStates: PfxQualityEffectState[]
  next: PfxQualityImprovementWorkItem | null
  decisionRecord: PfxQualityDecisionRecord | null
}

export interface PfxQualityDecisionRecord {
  schema: 'game-bot.r3f-pfx-quality-decision.v1'
  iteration: number
  hypothesis: string
  defectKey: string
  affectedEffects: string[]
  changedPaths: string[]
  beforeFingerprints: Record<string, string>
  afterFingerprints: Record<string, string>
  result: string
  validator: string
  craftGuideAnchor: string
  convergenceVerdict: string
}

export function assemblePfxQualityIteration(input: AssemblePfxQualityIterationInput): PfxQualityIterationResult {
  if (input.reviews.length < 3) {
    throw new Error('PFX quality assembly requires three independent reviews')
  }
  const reviewBatchIds = input.reviews.map((source) => source.review.batchId)
  if (new Set(reviewBatchIds).size !== reviewBatchIds.length) {
    throw new Error('PFX quality assembly requires a distinct independent review batch for every review')
  }
  validateReducedMotionConsensus(input)
  const visualReviews = assemblePfxQualityMatrixVisualReviewConsensus(input.reviews, {
    currentSourceFingerprints: input.currentSourceFingerprints,
    reducedMotionReadableEffectIds: input.reducedMotionReadableEffectIds,
  })
  const assembledMatrix = createPfxQualityMatrix({
    effects: [...input.effects],
    visualReviews,
    performanceReviews: [...input.performanceReviews],
  })
  const matrix = preserveUnreviewedPfxQualityMatrixRows(
    assembledMatrix,
    input.previousMatrix,
    new Set([
      ...visualReviews.map((review) => review.effectId),
      ...input.performanceReviews.map((review) => review.effectId),
    ]),
  )
  const ledger = createPfxQualityImprovementLedgerFromMatrix(matrix, input.iteration, input.previous)
  const resolvedAdjudication = validateResolvedPfxAdjudication(input, ledger)
  const preservedNewDisagreement = shouldPersistNewPfxReviewerDisagreement(input, ledger)
  const resolvedStaleEvidence = shouldAcceptPfxStaleEvidenceRefresh(
    input,
    ledger,
    matrix,
    visualReviews.map((review) => review.effectId),
  )
  const acceptedEvidenceCoverage = Boolean(
    input.previous && (
      ledger.summary.visualEvidenceCount > input.previous.summary.visualEvidenceCount ||
      ledger.summary.performanceEvidenceCount > input.previous.summary.performanceEvidenceCount
    ),
  )
  if (
    ledger.convergence &&
    !ledger.convergence.converging &&
    !resolvedAdjudication &&
    !preservedNewDisagreement &&
    !resolvedStaleEvidence
  ) {
    throw new Error(`PFX quality assembly rejected non-converging iteration: ${ledger.convergence.reason}`)
  }
  const decisionRecord =
    !resolvedAdjudication &&
    !preservedNewDisagreement &&
    !resolvedStaleEvidence &&
    !acceptedEvidenceCoverage &&
    ledger.convergence?.converging
    ? createPfxQualityDecisionRecord(input, ledger.convergence.reason)
    : null
  return {
    schema: 'game-bot.r3f-pfx-quality-iteration.v1',
    iteration: input.iteration,
    matrix,
    ledger,
    effectStates: createPfxQualityEffectStates(matrix, ledger, input.currentSourceFingerprints),
    next: ledger.queue[0] ?? null,
    decisionRecord,
  }
}

function shouldAcceptPfxStaleEvidenceRefresh(
  input: AssemblePfxQualityIterationInput,
  ledger: PfxQualityImprovementLedger,
  matrix: PfxQualityMatrix,
  reviewedEffectIds: readonly string[],
): boolean {
  if (
    !input.previousMatrix ||
    ledger.convergence?.reason !== 'quality-plateau' ||
    reviewedEffectIds.length === 0
  ) return false

  const previousRows = new Map(
    input.previousMatrix.effects.map((effect) => [effect.effectId, effect]),
  )
  const currentRows = new Map(
    matrix.effects.map((effect) => [effect.effectId, effect]),
  )
  return reviewedEffectIds.some((effectId) => {
    const previousFingerprint = previousRows.get(effectId)?.sourceFingerprint
    const currentFingerprint = input.currentSourceFingerprints[effectId]
    return Boolean(
      previousFingerprint &&
      currentFingerprint &&
      previousFingerprint !== currentFingerprint &&
      currentRows.get(effectId)?.sourceFingerprint === currentFingerprint,
    )
  })
}

function preserveUnreviewedPfxQualityMatrixRows(
  current: PfxQualityMatrix,
  previous: PfxQualityMatrix | undefined,
  reviewedEffectIds: ReadonlySet<string>,
): PfxQualityMatrix {
  if (!previous) return current
  const previousRows = new Map(previous.effects.map((effect) => [effect.effectId, effect]))
  const effects = current.effects.map((effect) =>
    reviewedEffectIds.has(effect.effectId)
      ? effect
      : previousRows.get(effect.effectId) ?? effect)
  return {
    ...current,
    effects,
    summary: {
      totalEffects: effects.length,
      visualPasses: effects.filter((effect) => effect.visualPass).length,
      performancePasses: effects.filter((effect) => effect.performancePass).length,
      finalPasses: effects.filter((effect) => effect.finalPass).length,
    },
  }
}

function shouldPersistNewPfxReviewerDisagreement(
  input: AssemblePfxQualityIterationInput,
  ledger: PfxQualityImprovementLedger,
): boolean {
  if (!input.previous || !ledger.convergence) return false
  if (
    ledger.summary.visualEvidenceCount < input.previous.summary.visualEvidenceCount ||
    ledger.summary.performanceEvidenceCount < input.previous.summary.performanceEvidenceCount
  ) {
    return false
  }
  const previouslyDisputed = new Set(
    input.previous.effects
      .filter((effect) =>
        effect.systemicDefectKeys.includes('evidence:peer-review-disagreement'))
      .map((effect) => effect.effectId),
  )
  const newlyDisputed = new Set(
    ledger.effects
      .filter((effect) =>
        effect.systemicDefectKeys.includes('evidence:peer-review-disagreement') &&
        !previouslyDisputed.has(effect.effectId))
      .map((effect) => effect.effectId),
  )
  if (newlyDisputed.size === 0) return false
  // A lower blocker count does not make a split independent verdict a
  // converging implementation decision. Persist the non-approving row so it
  // can be adjudicated, but never append a decision until consensus exists.
  if (ledger.convergence.converging) return true
  if (
    ledger.convergence.reason !== 'quality-plateau' &&
    !ledger.convergence.reason.startsWith('quality-regression:')
  ) {
    return false
  }
  return ledger.summary.regressedEffectIds.every((effectId) => newlyDisputed.has(effectId))
}

function validateResolvedPfxAdjudication(
  input: AssemblePfxQualityIterationInput,
  ledger: PfxQualityImprovementLedger,
): boolean {
  const effectIds = [...new Set(input.adjudicationEffectIds ?? [])].sort()
  if (effectIds.length === 0) return false
  if (!input.previous) {
    throw new Error('PFX quality adjudication requires a previous quality ledger')
  }
  if (input.decision) {
    throw new Error('PFX quality adjudication is evidence-only and cannot append a decision record')
  }
  const previousByEffect = new Map(input.previous.effects.map((effect) => [effect.effectId, effect]))
  const currentByEffect = new Map(ledger.effects.map((effect) => [effect.effectId, effect]))
  for (const effectId of effectIds) {
    const previous = previousByEffect.get(effectId)
    const current = currentByEffect.get(effectId)
    if (!previous || !current) {
      throw new Error(`PFX quality adjudication effect ${effectId} is missing from the quality ledger`)
    }
    if (!previous.systemicDefectKeys.includes('evidence:peer-review-disagreement')) {
      throw new Error(`PFX quality adjudication effect ${effectId} did not previously require adjudication`)
    }
    if (current.systemicDefectKeys.includes('evidence:peer-review-disagreement')) {
      throw new Error(`PFX quality adjudication effect ${effectId} remains disputed`)
    }
  }
  const allowed = new Set(effectIds)
  const unrelatedRegressions = ledger.summary.regressedEffectIds.filter((effectId) => !allowed.has(effectId))
  if (unrelatedRegressions.length > 0) {
    throw new Error(`PFX quality adjudication contains unrelated regressions: ${unrelatedRegressions.join(',')}`)
  }
  return true
}

function validateReducedMotionConsensus(input: AssemblePfxQualityIterationInput): void {
  const readableEffectIds = new Set(input.reducedMotionReadableEffectIds)
  const reviewedEffectIds = new Set(input.reviews.flatMap((source) =>
    source.review.effects.map((effect) => effect.effectId)))
  for (const effectId of reviewedEffectIds) {
    const sources = input.reviews.filter((source) =>
      source.review.effects.some((effect) => effect.effectId === effectId))
    if (sources.length < 3) continue
    const reviewerJudgmentsComplete = sources.every((source) =>
      typeof source.review.effects.find((effect) => effect.effectId === effectId)?.reducedMotionReadable === 'boolean')
    const proofsComplete = sources.every((source) => {
      const capture = source.manifest.effects.find((effect) => effect.effectId === effectId)?.reducedMotionCapture
      return capture?.angle === 'three-quarter' &&
        capture.phase === 'peak' &&
        capture.file.trim().length > 0
    })
    if (!readableEffectIds.has(effectId) || !reviewerJudgmentsComplete || !proofsComplete) {
      throw new Error(`Reduced-motion evidence for ${effectId} is incomplete`)
    }
  }
}

function createPfxQualityDecisionRecord(
  input: AssemblePfxQualityIterationInput,
  convergenceVerdict: string,
): PfxQualityDecisionRecord {
  const decision = input.decision
  if (!decision) {
    throw new Error('A converging PFX quality iteration requires decision metadata')
  }
  const requiredText: Array<[string, string]> = [
    ['hypothesis', decision.hypothesis],
    ['defectKey', decision.defectKey],
    ['result', decision.result],
    ['validator', decision.validator],
    ['craftGuideAnchor', decision.craftGuideAnchor],
  ]
  for (const [field, value] of requiredText) {
    if (value.trim().length === 0) throw new Error(`PFX quality decision ${field} is required`)
  }
  const affectedEffects = [...new Set(decision.affectedEffects)].sort()
  const changedPaths = [...new Set(decision.changedPaths)].sort()
  if (affectedEffects.length === 0) throw new Error('PFX quality decision affectedEffects are required')
  if (changedPaths.length === 0) throw new Error('PFX quality decision changedPaths are required')
  for (const effectId of affectedEffects) {
    if (!decision.beforeFingerprints[effectId] || !input.currentSourceFingerprints[effectId]) {
      throw new Error(`PFX quality decision is missing before/after fingerprints for ${effectId}`)
    }
  }
  return {
    schema: 'game-bot.r3f-pfx-quality-decision.v1',
    iteration: input.iteration,
    hypothesis: decision.hypothesis,
    defectKey: decision.defectKey,
    affectedEffects,
    changedPaths,
    beforeFingerprints: Object.fromEntries(
      affectedEffects.map((effectId) => [effectId, decision.beforeFingerprints[effectId]!]),
    ),
    afterFingerprints: Object.fromEntries(
      affectedEffects.map((effectId) => [effectId, input.currentSourceFingerprints[effectId]!]),
    ),
    result: decision.result,
    validator: decision.validator,
    craftGuideAnchor: decision.craftGuideAnchor,
    convergenceVerdict,
  }
}

export function createPfxQualityStatus(
  matrix: PfxQualityMatrix,
  ledger: PfxQualityImprovementLedger,
  currentSourceFingerprints: Readonly<Record<string, string>> = {},
): PfxQualityStatus {
  const effects = createPfxQualityEffectStates(matrix, ledger, currentSourceFingerprints)
  const categories: Record<PfxQualityStatusCategory, number> = {
    approved: 0,
    'visually-passing-device-blocked': 0,
    'reviewed-rework': 0,
    'awaiting-review': 0,
    'stale-evidence': 0,
  }
  for (const effect of effects) categories[effect.category] += 1
  const staleEffectIds = effects
    .filter((effect) => effect.category === 'stale-evidence')
    .map((effect) => effect.effectId)
  const staleEffectIdSet = new Set(staleEffectIds)
  const stateByEffectId = new Map(effects.map((effect) => [effect.effectId, effect]))
  const firstOpenEffect = [...matrix.effects]
    .filter((effect) => stateByEffectId.get(effect.effectId)?.category !== 'approved')
    .sort((left, right) => right.rank - left.rank || left.effectId.localeCompare(right.effectId))[0]
  let firstAction: PfxQualityImprovementWorkItem | null = null
  if (firstOpenEffect && staleEffectIdSet.has(firstOpenEffect.effectId)) {
    firstAction = {
        kind: 'effect',
        defectKey: 'evidence:independent-visual-review',
        effectIds: [firstOpenEffect.effectId],
        priority: Number.MAX_SAFE_INTEGER,
        ...createQualityActionRoute({
          effectIds: [firstOpenEffect.effectId],
          defectKey: 'evidence:independent-visual-review',
          targetPassed: false,
          reviewerDisagreement: false,
        }),
      }
  } else if (firstOpenEffect) {
    const queued = ledger.queue.find((item) =>
      item.action === 'adjudicate-review' &&
      item.effectIds.includes(firstOpenEffect.effectId)) ??
      ledger.queue.find((item) => item.effectIds.includes(firstOpenEffect.effectId))
    if (queued) {
      const activeEffectIds = queued.defectKey?.startsWith('visual:')
        ? queued.effectIds.filter((effectId) => !staleEffectIdSet.has(effectId))
        : [firstOpenEffect.effectId]
      const reviewerDisagreement = queued.action === 'adjudicate-review'
      firstAction = {
        ...queued,
        kind: queued.defectKey?.startsWith('visual:') && activeEffectIds.length > 1
          ? 'systemic'
          : 'effect',
        effectIds: activeEffectIds,
        ...createQualityActionRoute({
          effectIds: activeEffectIds,
          defectKey: queued.defectKey,
          targetPassed: false,
          reviewerDisagreement,
        }),
      }
    }
  }
  const markdown = [
    '# PFX Quality Review Status',
    '',
    `Iteration: ${ledger.iteration}`,
    `Total effects: ${matrix.effects.length}`,
    `Approved: ${categories.approved}`,
    `Visually passing / device blocked: ${categories['visually-passing-device-blocked']}`,
    `Reviewed / rework: ${categories['reviewed-rework']}`,
    `Awaiting review: ${categories['awaiting-review']}`,
    `Stale evidence: ${categories['stale-evidence']}`,
    '',
    '## First next action',
    '',
    ...(firstAction
      ? [
          `- Action: \`${firstAction.action}\``,
          `- Effects: ${renderStatusEffectIds(firstAction.effectIds)}`,
          `- Owner: ${firstAction.ownerPath ? `\`${firstAction.ownerPath}\`` : 'external evidence owner'}`,
          `- Reason: ${firstAction.reason}`,
          `- Guide: \`${firstAction.docAnchor}\``,
        ]
      : ['- Action: `stop`', '- Reason: no open quality work items']),
    '',
  ].join('\n')
  return {
    schema: 'game-bot.r3f-pfx-quality-status.v1',
    categories,
    effects,
    firstAction,
    markdown,
  }
}

export function createPfxQualityEffectStates(
  matrix: PfxQualityMatrix,
  ledger: PfxQualityImprovementLedger,
  currentSourceFingerprints: Readonly<Record<string, string>> = {},
): PfxQualityEffectState[] {
  return matrix.effects.map((effect) => {
    const currentFingerprint = currentSourceFingerprints[effect.effectId]
    const stale = effect.sourceFingerprint != null &&
      currentFingerprint != null &&
      effect.sourceFingerprint !== currentFingerprint
    const reviewed = PFX_VISUAL_QUALITY_DIMENSIONS.every(
      (dimension) => Number.isFinite(effect.scores[dimension]),
    )
    const category: PfxQualityStatusCategory = stale
      ? 'stale-evidence'
      : effect.finalPass
        ? 'approved'
        : effect.visualPass
          ? 'visually-passing-device-blocked'
          : reviewed
            ? 'reviewed-rework'
            : 'awaiting-review'
    const queued = stale
      ? null
      : ledger.queue.find((item) => item.effectIds.includes(effect.effectId))
    const route = stale
      ? createQualityActionRoute({
          effectIds: [effect.effectId],
          defectKey: 'evidence:independent-visual-review',
          targetPassed: false,
          reviewerDisagreement: false,
        })
      : queued ?? createQualityActionRoute({
          effectIds: [effect.effectId],
          defectKey: null,
          targetPassed: effect.finalPass,
          reviewerDisagreement: false,
        })
    return {
      effectId: effect.effectId,
      category,
      action: route.action,
      ownerPath: route.ownerPath,
      docAnchor: route.docAnchor,
      reason: route.reason,
    }
  })
}

function renderStatusEffectIds(effectIds: readonly string[]): string {
  const shown = effectIds.slice(0, 5).map((effectId) => `\`${effectId}\``).join(', ')
  return effectIds.length <= 5 ? shown : `${shown}, and ${effectIds.length - 5} more`
}

export function createPfxVisualCaptureManifest(
  input: CreatePfxVisualCaptureManifestInput,
): PfxQualityVisualCaptureManifest {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(input.batchId)) {
    throw new Error(`Invalid PFX quality capture batch id: ${input.batchId}`)
  }
  if (input.effects.length === 0) throw new Error('PFX quality capture requires at least one effect')
  const effectIds = new Set<string>()
  const expectedCells = new Set(
    (['front', 'three-quarter', 'side'] as const).flatMap((angle) =>
      (['onset', 'peak', 'decay'] as const).map((phase) => `${angle}:${phase}`)),
  )
  for (const effect of input.effects) {
    if (effectIds.has(effect.effectId)) throw new Error(`Duplicate PFX capture effect: ${effect.effectId}`)
    effectIds.add(effect.effectId)
    if (effect.sourceFingerprint.trim().length === 0) {
      throw new Error(`PFX capture effect ${effect.effectId} is missing its source fingerprint`)
    }
    if (!Number.isFinite(effect.cameraDistance) || effect.cameraDistance < 1.2 || effect.cameraDistance > 8) {
      throw new Error(`PFX capture effect ${effect.effectId} has an invalid camera distance`)
    }
    const cells = new Set(effect.lifecycleCaptures.map((capture) => `${capture.angle}:${capture.phase}`))
    if (cells.size !== expectedCells.size || [...expectedCells].some((cell) => !cells.has(cell))) {
      throw new Error(`PFX capture effect ${effect.effectId} must include all nine lifecycle camera cells`)
    }
    if (effect.lifecycleCaptures.some((capture) => capture.file.trim().length === 0)) {
      throw new Error(`PFX capture effect ${effect.effectId} has an empty lifecycle evidence path`)
    }
    const phases = new Set(effect.lifecycleSamples.map((sample) => sample.phase))
    if (effect.lifecycleSamples.length !== 3 || phases.size !== 3) {
      throw new Error(`PFX capture effect ${effect.effectId} must include onset, peak, and decay sample times`)
    }
    if (!effect.gameplayContextCaptures.some((capture) =>
      capture.angle === 'three-quarter' && capture.phase === 'peak' && capture.file.trim().length > 0)) {
      throw new Error(`PFX capture effect ${effect.effectId} is missing peak three-quarter gameplay context`)
    }
    if (
      effect.reducedMotionCapture.angle !== 'three-quarter' ||
      effect.reducedMotionCapture.phase !== 'peak' ||
      effect.reducedMotionCapture.file.trim().length === 0
    ) {
      throw new Error(`PFX capture effect ${effect.effectId} is missing peak three-quarter reduced-motion proof`)
    }
  }
  return {
    schema: 'game-bot.r3f-pfx-visual-capture-batch.v3',
    batchId: input.batchId,
    effects: input.effects.map((effect) => ({
      ...effect,
      lifecycleSamples: effect.lifecycleSamples.map((sample) => ({ ...sample })),
      lifecycleCaptures: effect.lifecycleCaptures.map((capture) => ({ ...capture })),
      gameplayContextCaptures: effect.gameplayContextCaptures.map((capture) => ({ ...capture })),
      reducedMotionCapture: { ...effect.reducedMotionCapture },
    })),
  }
}
