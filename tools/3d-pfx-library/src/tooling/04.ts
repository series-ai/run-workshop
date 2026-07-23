import { PFX_PRODUCTION_IMPLEMENTATION_CANDIDATE_PREREQUISITES, PFX_PRODUCTION_IMPLEMENTATION_CRITERIA, PFX_QUALITY_RUBRIC_KEYS, PFX_RED_TEAM_CRITERIA } from '../constants/01'
import { roundMetric } from '../constants/03'
import { PFX_LOCAL_ACCEPTANCE_COMMAND, createVisualInspectionTargets, pfxVisualInspectionPreviewMarkdown, trimPathTrailingSlash, validatePfxPreset } from '../constants/04'
import { PFX_PRESETS, PFX_TAXONOMY, createPfxClipAsset, createPfxThumbnailAsset, exportPfxDeveloperDocsMarkdown, getPfxComponentDefinition, getPfxRenderPlan } from './01'
import { productionApprovalOperatorLaunchHandoff, productionHandoffCommandMarkdownLines } from './02'
import { createPfxProductionImplementationDossier, productionApprovalCaptureHandoff, productionApprovalCaptureHandoffMarkdown, redTeamReviewBatchSheetCommand, redTeamReviewBatchSheetJsonOutputFile, redTeamReviewBatchSheetMarkdownOutputFile, redTeamReviewBulkBatchSheetCommand } from './03'
import type { PfxPreset, PfxProductionImplementationBatch, PfxProductionImplementationBatchSheet, PfxProductionImplementationBatchSheetEffect, PfxProductionImplementationBatchSheetIndex, PfxProductionImplementationBatchSheetIndexOptions, PfxProductionImplementationBatchSheetIndexSheet, PfxProductionImplementationBatchSheetOptions, PfxProductionImplementationCandidateEffect, PfxProductionImplementationCandidatePrerequisite, PfxProductionImplementationCandidateReport, PfxProductionImplementationCriterion, PfxProductionImplementationCriterionStatus, PfxProductionImplementationDossier, PfxProductionImplementationManifestFromCandidatesOptions, PfxProductionImplementationReview, PfxProductionImplementationTemplate, PfxRedTeamBlockingReviewManifestOptions, PfxRedTeamCriterion, PfxRedTeamCriterionStatus, PfxRedTeamEffectReview, PfxRedTeamReviewBatch, PfxRedTeamReviewBatchSheet, PfxRedTeamReviewBatchSheetEffect, PfxRedTeamReviewBatchSheetIndex, PfxRedTeamReviewBatchSheetIndexOptions, PfxRedTeamReviewBatchSheetIndexSheet, PfxRedTeamReviewBatchSheetOptions, PfxRedTeamReviewDossier, PfxRedTeamReviewDossierEffect, PfxRedTeamReviewDossierOptions, PfxRedTeamReviewTemplate, PfxTaxonomyEffect } from '../types/01'

export function exportPfxProductionImplementationDossierMarkdown(
  dossier: PfxProductionImplementationDossier = createPfxProductionImplementationDossier(),
): string {
  const lines = [
    '# R3F PFX Production Implementation Dossier',
    '',
    'Treat this handoff as non-approving implementation review input.',
    '',
    `Total effects: ${dossier.summary.totalEffects}`,
    `Effects needing production approval: ${dossier.summary.effectsNeedingProductionApproval}`,
    `Implementation template: \`${dossier.instructions.implementationTemplateFile}\``,
    `Candidate report: \`${dossier.instructions.candidateReportFile}\``,
    '',
    '## Operator Checklist',
    '',
    ...dossier.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of dossier.effects) {
    lines.push(
      `## ${effect.name} (\`${effect.effectId}\`)`,
      '',
      `Review anchor: \`${effect.reviewAnchor}\``,
      `Source path: \`${effect.sourcePath}\``,
      `Component: \`${effect.component.componentName}\``,
      `Authored recipe: \`${effect.authoredRecipeId}\``,
      `Preview assets: \`${effect.previewAssets.thumbnailFileName}\`, \`${effect.previewAssets.clipFileName}\``,
      '',
      '### Mobile Budget',
      '',
      `- Tier: \`${effect.mobileBudget.performanceTier}\``,
      `- Mobile safety: \`${effect.mobileBudget.mobileSafety}\``,
      `- Max particles: ${effect.mobileBudget.maxParticles}`,
      `- Max draw calls: ${effect.mobileBudget.maxDrawCalls}`,
      `- Texture memory KB: ${effect.mobileBudget.textureMemoryKb}`,
      `- Expected frame cost MS: ${effect.mobileBudget.expectedFrameCostMs}`,
      `- Overdraw risk: \`${effect.mobileBudget.overdrawRisk}\``,
      '',
      '### Quality Scores',
      '',
    )
    for (const key of PFX_QUALITY_RUBRIC_KEYS) {
      lines.push(`- ${key}: ${effect.qualityScores[key]}`)
    }
    lines.push('', '### Implementation Facts', '')
    for (const [key, value] of Object.entries(effect.implementationFacts)) {
      lines.push(`- ${key}: ${value ? 'yes' : 'no'}`)
    }
    lines.push('', '### Operator Checklist', '')
    for (const item of effect.operatorChecklist) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function createPfxProductionImplementationCandidateReport(
  presets: readonly PfxPreset[] = PFX_PRESETS,
): PfxProductionImplementationCandidateReport {
  const presetsByEffectId = new Map(presets.map((preset) => [preset.effectId, preset]))
  const effects = PFX_TAXONOMY.map((effect): PfxProductionImplementationCandidateEffect => {
    const preset = presetsByEffectId.get(effect.id)
    if (!preset) {
      throw new Error(`Cannot create production implementation candidate report for missing preset "${effect.id}"`)
    }
    const component = getPfxComponentDefinition(effect.id)
    const thumbnailAsset = createPfxThumbnailAsset(preset, effect)
    const clipAsset = createPfxClipAsset(preset, effect)
    const renderPlan = getPfxRenderPlan(preset)
    const docsMarkdown = exportPfxDeveloperDocsMarkdown(preset)
    const distinctRenderSurfaces = new Set(
      renderPlan.surfaces.map((surface) => `${surface.kind}:${surface.role}:${surface.phase ?? 'base'}`),
    ).size
    const hasSingleDrawSemanticMesh =
      renderPlan.surfaces.length === 1 &&
      renderPlan.estimatedDrawCalls === 1 &&
      Boolean(renderPlan.surfaces[0]?.tuning?.meshGeometry)
    const codeFacts = {
      hasDropInComponent: component != null,
      hasAuthoredRecipe: Boolean(preset.authoredRecipeId),
      controlsValidate: validatePfxPreset(preset).valid,
      hasMobileBudget:
        preset.performance.maxParticles > 0 &&
        preset.performance.maxDrawCalls > 0 &&
        preset.performance.textureMemoryKb > 0 &&
        preset.performance.expectedFrameCostMs > 0,
      hasPreviewAssets:
        thumbnailAsset.fileName.endsWith('.svg') &&
        clipAsset.fileName.endsWith('-clip.svg') &&
        thumbnailAsset.svg.includes('<svg') &&
        clipAsset.svg.includes('<animate'),
      hasDeveloperDocs:
        docsMarkdown.includes('## Component') &&
        docsMarkdown.includes('## JSON Preset') &&
        docsMarkdown.includes('## Production caveat'),
      hasRenderPlanDepth:
        renderPlan.estimatedDrawCalls <= preset.performance.maxDrawCalls &&
        (distinctRenderSurfaces >= 2 || hasSingleDrawSemanticMesh),
    }
    const missingPrerequisites = productionImplementationCandidateMissingPrerequisites(codeFacts)

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      status:
        missingPrerequisites.length === 0
          ? 'ready-for-implementation-review'
          : 'missing-code-prerequisites',
      productionApproved: false,
      missingPrerequisites,
      reviewAnchor: `.context/r3f-pfx-production-implementation.json#${effect.id}`,
      implementationEvidence: [
        `component:${component?.componentName ?? 'missing-component'}`,
        `authored-recipe:${preset.authoredRecipeId ?? 'missing-authored-recipe'}`,
        `preview:${thumbnailAsset.fileName}`,
        `clip:${clipAsset.fileName}`,
        `docs:.context/r3f-pfx-developer-docs.json#${effect.id}`,
        `render-plan:${renderPlan.signature}`,
      ],
      codeFacts,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-production-implementation-candidates.v1',
    summary: {
      totalEffects: effects.length,
      readyForImplementationReview: effects.filter((effect) => effect.status === 'ready-for-implementation-review')
        .length,
      effectsWithMissingCodePrerequisites: effects.filter((effect) => effect.status === 'missing-code-prerequisites')
        .length,
      productionApprovedEffects: effects.filter((effect) => effect.productionApproved).length,
      requiredPrerequisites: [...PFX_PRODUCTION_IMPLEMENTATION_CANDIDATE_PREREQUISITES],
    },
    instructions: {
      implementationTemplateFile: '.context/r3f-pfx-production-implementation-template.json',
      implementationDossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      approvalStatus: 'non-approving-code-prerequisite-report',
      operatorChecklist: [
        'Treat ready-for-implementation-review as a code prerequisite signal, not production approval.',
        'Resolve any missing code prerequisites before asking a reviewer to approve production implementation.',
        'Use implementationEvidence links to inspect component, recipe, preview, docs, and render-plan artifacts.',
      ],
    },
    effects,
  }
}

export function exportPfxProductionImplementationCandidateReportJson(
  report: PfxProductionImplementationCandidateReport = createPfxProductionImplementationCandidateReport(),
): string {
  return JSON.stringify(report, null, 2)
}

export function createPfxProductionImplementationManifestFromCandidates(
  options: PfxProductionImplementationManifestFromCandidatesOptions = {},
): PfxProductionImplementationTemplate {
  const implementedBy = options.implementedBy ?? 'game-bot-code-audit'
  const implementedAt = options.implementedAt ?? '2026-07-03T12:00:00.000Z'
  const candidateReport = createPfxProductionImplementationCandidateReport()
  const dossier = createPfxProductionImplementationDossier()
  const dossierByEffectId = new Map(dossier.effects.map((effect) => [effect.effectId, effect]))

  const implementations = candidateReport.effects.map((candidate): PfxProductionImplementationReview => {
    const dossierEffect = dossierByEffectId.get(candidate.effectId)
    const criteria = Object.fromEntries(
      PFX_PRODUCTION_IMPLEMENTATION_CRITERIA.map((criterion) => [
        criterion,
        candidate.status === 'ready-for-implementation-review' ? 'pass' : 'fail',
      ]),
    ) as Record<PfxProductionImplementationCriterion, PfxProductionImplementationCriterionStatus>
    const ready = candidate.status === 'ready-for-implementation-review'

    return {
      effectId: candidate.effectId,
      status: ready ? 'production-ready' : 'blocked',
      implementedBy,
      implementedAt,
      sourcePath: dossierEffect?.sourcePath ?? `tools/3d-pfx-library/src/index.tsx#${candidate.effectId}`,
      criteria,
      blockerFindings: ready
        ? []
        : candidate.missingPrerequisites.map((prerequisite) => `missing code prerequisite: ${prerequisite}`),
      notes: ready
        ? `Code-derived production implementation evidence for ${candidate.name}: component, authored recipe, safe controls, mobile budget, preview assets, docs, and render-plan depth are present.`
        : `Code-derived production implementation evidence for ${candidate.name} is blocked by missing code prerequisites: ${candidate.missingPrerequisites.join(', ')}.`,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-production-implementation.v1',
    summary: {
      totalEffects: implementations.length,
      productionReadyEffects: implementations.filter((implementation) => implementation.status === 'production-ready')
        .length,
      productionReadyScope: 'implementation-code-evidence-only',
      pendingEffects: implementations.filter((implementation) => implementation.status !== 'production-ready').length,
      requiredCriteria: [...PFX_PRODUCTION_IMPLEMENTATION_CRITERIA],
    },
    instructions: {
      approvalStatus: 'non-final-implementation-evidence',
      dossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'This manifest is code-derived implementation evidence; it does not satisfy taxonomy review, real-device profiling, red-team signoff, or final production approval.',
        'Every production-ready row must correspond to a ready-for-implementation-review candidate with no missing code prerequisites.',
        'Regenerate this manifest after changing component exports, authored recipes, control validation, preview assets, docs, mobile budgets, or render plans.',
      ],
    },
    implementations,
  }
}

export function createPfxProductionImplementationBatchSheet(
  options: PfxProductionImplementationBatchSheetOptions = {},
): PfxProductionImplementationBatchSheet {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxProductionImplementationDossier()
  const candidateReport = createPfxProductionImplementationCandidateReport()
  const candidatesByEffectId = new Map(candidateReport.effects.map((effect) => [effect.effectId, effect]))
  const batches: PfxProductionImplementationBatch[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    batches.push({
      batchId: `production-implementation-batch-${String(batches.length + 1).padStart(3, '0')}`,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      outputFile: '.context/r3f-pfx-production-implementation.json',
      effectIds: effects.map((effect) => effect.effectId),
    })
  }

  const batch =
    batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? batches[0] : undefined)
  if (!batch) {
    throw new Error(`Production implementation batch not found: ${options.batchId}`)
  }

  const dossierEffectsById = new Map(dossier.effects.map((effect) => [effect.effectId, effect]))
  const effects = batch.effectIds.flatMap((effectId): PfxProductionImplementationBatchSheetEffect[] => {
    const effect = dossierEffectsById.get(effectId)
    if (!effect) return []
    const candidate = candidatesByEffectId.get(effectId)
    return [
      {
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        productionApproved: false,
        reviewAnchor: effect.reviewAnchor,
        sourcePath: effect.sourcePath,
        componentName: effect.component.componentName,
        authoredRecipeId: effect.authoredRecipeId,
        mobileBudget: effect.mobileBudget,
        qualityScores: effect.qualityScores,
        requiredCriteria: [...PFX_PRODUCTION_IMPLEMENTATION_CRITERIA],
        evidenceReferences: Array.from(new Set([
          ...(candidate?.implementationEvidence ?? []),
          `source:${effect.sourcePath}`,
          `preview:${effect.previewAssets.thumbnailFileName}`,
          `clip:${effect.previewAssets.clipFileName}`,
        ])),
        reviewerChecklist: [
          ...effect.operatorChecklist,
          'Set status to production-ready only when all required criteria pass from concrete evidence.',
          'Record final implementedBy, implementedAt, sourcePath, and notes; placeholder metadata is rejected.',
          'Leave blockerFindings empty only for production-ready rows.',
        ],
      },
    ]
  })

  return {
    schema: 'game-bot.r3f-pfx-production-implementation-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-production-implementation-batch-sheet',
      sourceDossierSchema: dossier.schema,
      outputFile: '.context/r3f-pfx-production-implementation.json',
      operatorChecklist: [
        'Review only the effects in this batch and write decisions to the canonical implementation output file.',
        'Treat this sheet as non-approving context; final acceptance credits only the production implementation manifest.',
        'Do not set production-ready unless every required criterion passes and final implementation metadata is present.',
      ],
    },
    batch,
    effects,
  }
}

export function exportPfxProductionImplementationBatchSheetMarkdown(
  sheet: PfxProductionImplementationBatchSheet = createPfxProductionImplementationBatchSheet(),
): string {
  const lines = [
    '# R3F PFX Production Implementation Batch Sheet',
    '',
    'Treat this handoff as non-approving implementation review input.',
    '',
    `Batch: \`${sheet.batch.batchId}\``,
    `Ranks: ${sheet.batch.rankStart}-${sheet.batch.rankEnd}`,
    `Effects: ${sheet.batch.effectCount}`,
    `Output file: \`${sheet.instructions.outputFile}\``,
    '',
    '## Operator Checklist',
    '',
    ...sheet.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of sheet.effects) {
    lines.push(
      `## ${effect.name} (\`${effect.effectId}\`)`,
      '',
      `Rank: ${effect.rank}`,
      `Review anchor: \`${effect.reviewAnchor}\``,
      `Source path: \`${effect.sourcePath}\``,
      `Component: \`${effect.componentName}\``,
      `Authored recipe: \`${effect.authoredRecipeId}\``,
      '',
      '### Required Criteria',
      '',
    )
    for (const criterion of effect.requiredCriteria) {
      lines.push(`- [ ] ${sentenceCaseProductionImplementationCriterion(criterion)}`)
    }
    lines.push(
      '',
      '### Evidence References',
      '',
      ...effect.evidenceReferences.map((reference) => `- \`${reference}\``),
      '',
      '### Mobile Budget',
      '',
      `- Tier: \`${effect.mobileBudget.performanceTier}\``,
      `- Mobile safety: \`${effect.mobileBudget.mobileSafety}\``,
      `- Max particles: ${effect.mobileBudget.maxParticles}`,
      `- Max draw calls: ${effect.mobileBudget.maxDrawCalls}`,
      `- Expected frame cost MS: ${effect.mobileBudget.expectedFrameCostMs}`,
      `- Overdraw risk: \`${effect.mobileBudget.overdrawRisk}\``,
      '',
      '### Reviewer Checklist',
      '',
      ...effect.reviewerChecklist.map((item) => `- ${item}`),
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

export function createPfxProductionImplementationBatchSheetIndex(
  options: PfxProductionImplementationBatchSheetIndexOptions = {},
): PfxProductionImplementationBatchSheetIndex {
  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/production-implementation-batches')
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxProductionImplementationDossier()
  const sheets: PfxProductionImplementationBatchSheetIndexSheet[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    const batchId = `production-implementation-batch-${String(sheets.length + 1).padStart(3, '0')}`
    const outputFile = productionImplementationBatchSheetJsonOutputFile(batchId, outputDirectory)
    const markdownOutputFile = productionImplementationBatchSheetMarkdownOutputFile(batchId, outputDirectory)
    sheets.push({
      batchId,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      firstEffectId: firstEffect.effectId,
      lastEffectId: lastEffect.effectId,
      outputFile,
      markdownOutputFile,
      command: productionImplementationBatchSheetCommand(batchId, outputFile, markdownOutputFile),
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-production-implementation-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalEffects: dossier.summary.totalEffects,
      outputDirectory,
      approvalStatus: 'non-approving-production-implementation-batch-sheet-index',
      bulkCommand: productionImplementationBulkBatchSheetCommand(outputDirectory),
    },
    sheets,
  }
}

export function exportPfxProductionImplementationBatchSheetIndexMarkdown(
  index: PfxProductionImplementationBatchSheetIndex = createPfxProductionImplementationBatchSheetIndex(),
): string {
  const lines = [
    '# R3F PFX Production Implementation Batch Sheet Index',
    '',
    'Treat this index as non-approving implementation review guidance.',
    '',
    `Total batches: ${index.summary.totalBatches}`,
    `Total effects: ${index.summary.totalEffects}`,
    `Output directory: \`${index.summary.outputDirectory}\``,
    `Bulk command: \`${index.summary.bulkCommand}\``,
    '',
    '## Batch Sheets',
    '',
  ]

  for (const sheet of index.sheets) {
    lines.push(
      `- \`${sheet.batchId}\` (ranks ${sheet.rankStart}-${sheet.rankEnd}, ${sheet.effectCount} effects, \`${sheet.firstEffectId}\` to \`${sheet.lastEffectId}\`): \`${sheet.markdownOutputFile}\``,
      `  - JSON: \`${sheet.outputFile}\``,
      `  - \`${sheet.command}\``,
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function productionImplementationBatchSheetJsonOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.json`
}

function productionImplementationBatchSheetMarkdownOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.md`
}

function productionImplementationBatchSheetCommand(
  batchId: string,
  outputFile: string,
  markdownOutputFile: string,
): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:implementation',
    `-- --implementation-batch-id ${batchId}`,
    `--implementation-batch-sheet-output ${outputFile}`,
    `--implementation-batch-sheet-markdown-output ${markdownOutputFile}`,
  ].join(' ')
}

function productionImplementationBulkBatchSheetCommand(outputDirectory: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:implementation',
    `-- --implementation-batch-sheet-directory ${outputDirectory}`,
    '--implementation-batch-sheet-index-output .context/r3f-pfx-production-implementation-batch-sheet-index.json',
    '--implementation-batch-sheet-index-markdown-output .context/r3f-pfx-production-implementation-batch-sheet-index.md',
  ].join(' ')
}

export function createPfxRedTeamReviewTemplate(): PfxRedTeamReviewTemplate {
  const reviews = PFX_TAXONOMY.map((effect): PfxRedTeamEffectReview => createPfxRedTeamEffectReviewTemplate(effect.id))

  return {
    schema: 'game-bot.r3f-pfx-red-team-review.v1',
    summary: {
      totalEffects: reviews.length,
      signedOffEffects: reviews.filter((review) => review.status === 'signed-off').length,
      approvedDeferrals: reviews.filter((review) => review.status === 'approved-deferral').length,
      pendingEffects: reviews.filter((review) => review.status === 'pending').length,
      blockedEffects: reviews.filter((review) => review.status === 'blocked').length,
      mobileSafariBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'mobile Safari'),
      chromeAndroidBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'Chrome Android'),
      requiredCriteria: [...PFX_RED_TEAM_CRITERIA],
    },
    instructions: {
      implementationTemplateFile: '.context/r3f-pfx-production-implementation.json',
      approvalStatus: 'adversarial-review-required',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'Reviewers must be independent from the actor recorded in the matching production implementation row.',
        'Same-actor implementation approval and red-team signoff is rejected by production readiness.',
        'Set every red-team criterion to pass, clear blockerFindings, and use signed-off or approved-deferral only after adversarial review.',
      ],
    },
    reviews,
  }
}

export function createPfxRedTeamBlockingReviewManifest(
  options: PfxRedTeamBlockingReviewManifestOptions = {},
): PfxRedTeamReviewTemplate {
  const reviewer = options.reviewer ?? 'red-team-mobile-gate'
  const reviewedAt = options.reviewedAt ?? '2026-07-03T12:00:00.000Z'
  const reviews = PFX_TAXONOMY.map((effect): PfxRedTeamEffectReview => ({
    effectId: effect.id,
    status: 'blocked',
    reviewer,
    reviewedAt,
    anchor: effect.id,
    criteria: {
      'taxonomy-comprehensive': 'pass',
      'game-ready-not-decorative': 'pass',
      'mobile-performance-proven': 'fail',
      'style-clusters-distinct': 'pass',
      'customization-safe': 'pass',
      'export-clean': 'pass',
      'documentation-sufficient': 'pass',
    },
    blockerFindings: [
      `Missing valid mobile Safari real-device capture: .context/mobile-safari/${effect.id}.json`,
      `Missing valid Chrome Android real-device capture: .context/chrome-android/${effect.id}.json`,
    ],
    notes: `Adversarial red-team draft blocks ${effect.name} because mobile browser performance is not proven by valid real-device captures yet.`,
  }))

  return {
    schema: 'game-bot.r3f-pfx-red-team-review.v1',
    summary: {
      totalEffects: reviews.length,
      signedOffEffects: reviews.filter((review) => review.status === 'signed-off').length,
      approvedDeferrals: reviews.filter((review) => review.status === 'approved-deferral').length,
      pendingEffects: reviews.filter((review) => review.status === 'pending').length,
      blockedEffects: reviews.filter((review) => review.status === 'blocked').length,
      mobileSafariBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'mobile Safari'),
      chromeAndroidBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'Chrome Android'),
      requiredCriteria: [...PFX_RED_TEAM_CRITERIA],
    },
    instructions: {
      implementationTemplateFile: '.context/r3f-pfx-production-implementation.json',
      approvalStatus: 'adversarial-review-required',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'This adversarial manifest records blocking red-team findings; it is not red-team signoff.',
        'Do not change blocked rows to signed-off until the missing real-device capture evidence exists and has been attacked.',
        'Regenerate this manifest after capture evidence changes so blockers reflect current mobile proof.',
      ],
    },
    reviews,
  }
}

function countRedTeamPlatformBlockedEffects(
  reviews: readonly PfxRedTeamEffectReview[],
  platformLabel: 'mobile Safari' | 'Chrome Android',
): number {
  const normalizedPlatformLabel = platformLabel.toLowerCase()
  return reviews.filter(
    (review) =>
      review.status === 'blocked' &&
      review.blockerFindings.some((finding) => finding.toLowerCase().includes(normalizedPlatformLabel)),
  ).length
}

export function exportPfxRedTeamReviewTemplateJson(
  template: PfxRedTeamReviewTemplate = createPfxRedTeamReviewTemplate(),
): string {
  return JSON.stringify(template, null, 2)
}

export function createPfxRedTeamReviewDossier(
  options: PfxRedTeamReviewDossierOptions = {},
): PfxRedTeamReviewDossier {
  const effects = PFX_TAXONOMY.map((effect): PfxRedTeamReviewDossierEffect => {
    const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effect.id)
    if (!preset) {
      throw new Error(`Cannot create red-team dossier for missing preset "${effect.id}"`)
    }

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      reviewStatus: 'needs-adversarial-review',
      redTeamSignedOff: false,
      reviewAnchor: `.context/r3f-pfx-red-team-review.json#${effect.id}`,
      implementationAnchor: `.context/r3f-pfx-production-implementation.json#${effect.id}`,
      realDeviceEvidence: {
        mobileSafari: `.context/mobile-safari/${effect.id}.json`,
        chromeAndroid: `.context/chrome-android/${effect.id}.json`,
      },
      ...(options.realDeviceCaptureBaseUrl || options.realDeviceCaptureBatchIdsByEffectId
        ? { captureHandoff: productionApprovalCaptureHandoff(effect.id, options) }
        : {}),
      visualInspectionTargets: createRedTeamVisualInspectionTargets(effect.id),
      evidenceToAttack: [
        `implementation:.context/r3f-pfx-production-implementation.json#${effect.id}`,
        `mobile-safari:.context/mobile-safari/${effect.id}.json`,
        `chrome-android:.context/chrome-android/${effect.id}.json`,
        `developer-docs:.context/r3f-pfx-developer-docs.json#${effect.id}`,
        `style-differentiation:.context/r3f-pfx-style-differentiation-matrix.json#${effect.id}`,
        `export-cleanliness:.context/r3f-pfx-export-cleanliness-audit.json#${effect.id}`,
        `control-safety:.context/r3f-pfx-control-safety-matrix.json#${effect.id}`,
        `runtime-optimization:.context/r3f-pfx-runtime-optimization-audit.json#${effect.id}`,
      ],
      attackPrompts: createRedTeamAttackPrompts(effect, preset),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-red-team-dossier.v1',
    summary: {
      totalEffects: effects.length,
      effectsNeedingAdversarialReview: effects.length,
      requiredCriteria: [...PFX_RED_TEAM_CRITERIA],
    },
    instructions: {
      reviewTemplateFile: '.context/r3f-pfx-red-team-review-template.json',
      implementationManifestFile: '.context/r3f-pfx-production-implementation.json',
      realDeviceAuditFile: '.context/r3f-pfx-real-device-capture-audit.json',
      approvalStatus: 'non-approving-adversarial-review-input',
      operatorChecklist: [
        'Use this dossier to attack the effect; it is reviewer context only and never satisfies red-team signoff.',
        'Open every evidenceToAttack reference that exists before filling the matching red-team review row.',
        'Record blocker findings instead of approving when taxonomy coverage, gameplay utility, device evidence, style differentiation, controls, exports, or docs are weak.',
        'Use a reviewer identity distinct from the production implementation actor; same-actor signoff is rejected.',
      ],
    },
    effects,
  }
}

export function exportPfxRedTeamReviewDossierJson(
  dossier: PfxRedTeamReviewDossier = createPfxRedTeamReviewDossier(),
): string {
  return JSON.stringify(dossier, null, 2)
}

export function exportPfxRedTeamReviewDossierMarkdown(
  dossier: PfxRedTeamReviewDossier = createPfxRedTeamReviewDossier(),
): string {
  const lines = [
    '# R3F PFX Red-Team Review Dossier',
    '',
    'Treat this handoff as non-approving adversarial review input.',
    '',
    `Total effects: ${dossier.summary.totalEffects}`,
    `Effects needing adversarial review: ${dossier.summary.effectsNeedingAdversarialReview}`,
    `Review template: \`${dossier.instructions.reviewTemplateFile}\``,
    `Implementation manifest: \`${dossier.instructions.implementationManifestFile}\``,
    `Real-device audit: \`${dossier.instructions.realDeviceAuditFile}\``,
    '',
    '## Operator Checklist',
    '',
    ...dossier.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of dossier.effects) {
    lines.push(
      `## ${effect.name} (\`${effect.effectId}\`)`,
      '',
      `Review anchor: \`${effect.reviewAnchor}\``,
      `Implementation anchor: \`${effect.implementationAnchor}\``,
      `Mobile Safari: \`${effect.realDeviceEvidence.mobileSafari}\``,
      `Chrome Android: \`${effect.realDeviceEvidence.chromeAndroid}\``,
      ...productionApprovalCaptureHandoffMarkdown(effect.captureHandoff),
      '',
      '### Visual Inspection Targets',
      '',
      `- Thumbnail: \`${effect.visualInspectionTargets.thumbnailAsset}\``,
      `- Animated clip: \`${effect.visualInspectionTargets.animatedClipAsset}\``,
      `- Style contact sheet: \`${effect.visualInspectionTargets.styleContactSheetAsset}\``,
      `- Control extremes contact sheet: \`${effect.visualInspectionTargets.controlExtremesContactSheetAsset}\``,
      ...pfxVisualInspectionPreviewMarkdown(effect.name, effect.visualInspectionTargets),
      `- Style matrix: \`${effect.visualInspectionTargets.styleDifferentiationAnchor}\``,
      `- Control matrix: \`${effect.visualInspectionTargets.controlSafetyAnchor}\``,
      ...effect.visualInspectionTargets.requiredChecks.map((check) => `- ${check}`),
      '',
      '### Attack Prompts',
      '',
    )
    for (const criterion of PFX_RED_TEAM_CRITERIA) {
      lines.push(`- **${sentenceCaseRedTeamCriterion(criterion)}:** ${effect.attackPrompts[criterion]}`)
    }
    lines.push('', '### Evidence To Attack', '')
    for (const evidence of effect.evidenceToAttack) {
      lines.push(`- \`${evidence}\``)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function createPfxRedTeamReviewBatchSheet(
  options: PfxRedTeamReviewBatchSheetOptions = {},
): PfxRedTeamReviewBatchSheet {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxRedTeamReviewDossier(options)
  const batches: PfxRedTeamReviewBatch[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    batches.push({
      batchId: `red-team-review-batch-${String(batches.length + 1).padStart(3, '0')}`,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      outputFile: '.context/r3f-pfx-red-team-review.json',
      effectIds: effects.map((effect) => effect.effectId),
    })
  }

  const batch =
    batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? batches[0] : undefined)
  if (!batch) {
    throw new Error(`Red-team review batch not found: ${options.batchId}`)
  }

  const dossierEffectsById = new Map(dossier.effects.map((effect) => [effect.effectId, effect]))
  const effects = batch.effectIds.flatMap((effectId): PfxRedTeamReviewBatchSheetEffect[] => {
    const effect = dossierEffectsById.get(effectId)
    if (!effect) return []
    const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effect.effectId)
    if (!preset) return []
    return [
      {
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        redTeamSignedOff: false,
        reviewAnchor: effect.reviewAnchor,
        implementationAnchor: effect.implementationAnchor,
        realDeviceEvidence: effect.realDeviceEvidence,
        mobileEvidenceGate: {
          status: 'blocked-until-real-device-captures',
          blockers: [
            `Requires valid mobile Safari real-device capture at ${effect.realDeviceEvidence.mobileSafari}`,
            `Requires valid Chrome Android real-device capture at ${effect.realDeviceEvidence.chromeAndroid}`,
          ],
        },
        ...(effect.captureHandoff ? { captureHandoff: effect.captureHandoff } : {}),
        reviewerRisk: createRedTeamReviewerRisk(preset),
        visualInspectionTargets: createRedTeamVisualInspectionTargets(effect.effectId),
        requiredCriteria: [...PFX_RED_TEAM_CRITERIA],
        evidenceToAttack: [...effect.evidenceToAttack],
        attackPrompts: { ...effect.attackPrompts },
        reviewerChecklist: [
          'Open every listed evidence reference before recording the red-team row.',
          'Try to fail the effect against every required adversarial criterion before signing off.',
          'Record blockerFindings for any unresolved issue; leave blockerFindings empty only after signoff.',
          'Use a reviewer identity distinct from the implementation actor.',
        ],
        reviewRowTemplate: createPfxRedTeamMobileBlockedReviewTemplate(
          effect.effectId,
          effect.name,
          effect.realDeviceEvidence,
        ),
      },
    ]
  })

  return {
    schema: 'game-bot.r3f-pfx-red-team-review-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-red-team-review-batch-sheet',
      sourceDossierSchema: dossier.schema,
      outputFile: '.context/r3f-pfx-red-team-review.json',
      operatorChecklist: [
        'Review only the effects in this batch and write decisions to the canonical red-team review output file.',
        'Treat this sheet as adversarial review context only; final acceptance credits only the red-team review manifest.',
        'Do not sign off unless taxonomy coverage, gameplay utility, mobile evidence, style differentiation, controls, exports, and docs withstand attack.',
      ],
    },
    batch,
    effects,
  }
}

export function exportPfxRedTeamReviewBatchSheetMarkdown(
  sheet: PfxRedTeamReviewBatchSheet = createPfxRedTeamReviewBatchSheet(),
): string {
  const lines = [
    '# R3F PFX Red-Team Review Batch Sheet',
    '',
    'Treat this handoff as non-approving adversarial review input.',
    '',
    `Batch: \`${sheet.batch.batchId}\``,
    `Ranks: ${sheet.batch.rankStart}-${sheet.batch.rankEnd}`,
    `Effects: ${sheet.batch.effectCount}`,
    `Output file: \`${sheet.instructions.outputFile}\``,
    '',
    '## Operator Checklist',
    '',
    ...sheet.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of sheet.effects) {
    lines.push(
      `## ${effect.name} (\`${effect.effectId}\`)`,
      '',
      `Rank: ${effect.rank}`,
      `Review anchor: \`${effect.reviewAnchor}\``,
      `Implementation anchor: \`${effect.implementationAnchor}\``,
      `Mobile Safari: \`${effect.realDeviceEvidence.mobileSafari}\``,
      `Chrome Android: \`${effect.realDeviceEvidence.chromeAndroid}\``,
      `Mobile evidence gate: \`${effect.mobileEvidenceGate.status}\``,
      ...effect.mobileEvidenceGate.blockers.map((blocker) => `- ${formatMobileEvidenceGateBlocker(blocker)}`),
      ...productionApprovalCaptureHandoffMarkdown(effect.captureHandoff),
      `Reviewer risk: \`${effect.reviewerRisk.level}\` (\`${effect.reviewerRisk.performanceTier}\` tier, \`${effect.reviewerRisk.mobileSafety}\` mobile safety)`,
      ...effect.reviewerRisk.reasons.map((reason) => `- ${reason}`),
      '',
      '### Visual Inspection Targets',
      '',
      `- Thumbnail: \`${effect.visualInspectionTargets.thumbnailAsset}\``,
      `- Animated clip: \`${effect.visualInspectionTargets.animatedClipAsset}\``,
      `- Style contact sheet: \`${effect.visualInspectionTargets.styleContactSheetAsset}\``,
      `- Control extremes contact sheet: \`${effect.visualInspectionTargets.controlExtremesContactSheetAsset}\``,
      ...pfxVisualInspectionPreviewMarkdown(effect.name, effect.visualInspectionTargets),
      `- Style matrix: \`${effect.visualInspectionTargets.styleDifferentiationAnchor}\``,
      `- Control matrix: \`${effect.visualInspectionTargets.controlSafetyAnchor}\``,
      ...effect.visualInspectionTargets.requiredChecks.map((check) => `- ${check}`),
      '',
      '### Required Criteria',
      '',
    )
    for (const criterion of effect.requiredCriteria) {
      lines.push(`- [ ] ${sentenceCaseRedTeamCriterion(criterion)}`)
    }
    lines.push('', '### Attack Prompts', '')
    for (const criterion of effect.requiredCriteria) {
      lines.push(`- **${sentenceCaseRedTeamCriterion(criterion)}:** ${effect.attackPrompts[criterion]}`)
    }
    lines.push(
      '',
      '### Evidence To Attack',
      '',
      ...effect.evidenceToAttack.map((evidence) => `- \`${evidence}\``),
      '',
      '### Reviewer Checklist',
      '',
      ...effect.reviewerChecklist.map((item) => `- ${item}`),
      '',
      '### Review Row Template',
      '',
      '```json',
      JSON.stringify(effect.reviewRowTemplate, null, 2),
      '```',
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

export function createPfxRedTeamReviewBatchSheetIndex(
  options: PfxRedTeamReviewBatchSheetIndexOptions = {},
): PfxRedTeamReviewBatchSheetIndex {
  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/red-team-review-batches')
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxRedTeamReviewDossier(options)
  const operatorLaunchHandoff = productionApprovalOperatorLaunchHandoff(options)
  const sheets: PfxRedTeamReviewBatchSheetIndexSheet[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    const batchId = `red-team-review-batch-${String(sheets.length + 1).padStart(3, '0')}`
    const outputFile = redTeamReviewBatchSheetJsonOutputFile(batchId, outputDirectory)
    const markdownOutputFile = redTeamReviewBatchSheetMarkdownOutputFile(batchId, outputDirectory)
    sheets.push({
      batchId,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      firstEffectId: firstEffect.effectId,
      lastEffectId: lastEffect.effectId,
      outputFile,
      markdownOutputFile,
      command: redTeamReviewBatchSheetCommand(batchId, outputFile, markdownOutputFile),
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-red-team-review-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalEffects: dossier.summary.totalEffects,
      outputDirectory,
      approvalStatus: 'non-approving-red-team-review-batch-sheet-index',
      bulkCommand: redTeamReviewBulkBatchSheetCommand(outputDirectory),
      ...(operatorLaunchHandoff.operatorLaunchUrl ? { operatorLaunchUrl: operatorLaunchHandoff.operatorLaunchUrl } : {}),
      ...(operatorLaunchHandoff.operatorLaunchUrlTemplate
        ? { operatorLaunchUrlTemplate: operatorLaunchHandoff.operatorLaunchUrlTemplate }
        : {}),
    },
    sheets,
  }
}

export function exportPfxRedTeamReviewBatchSheetIndexMarkdown(
  index: PfxRedTeamReviewBatchSheetIndex = createPfxRedTeamReviewBatchSheetIndex(),
): string {
  const lines = [
    '# R3F PFX Red-Team Review Batch Sheet Index',
    '',
    'Treat this index as non-approving adversarial review guidance.',
    '',
    `Total batches: ${index.summary.totalBatches}`,
    `Total effects: ${index.summary.totalEffects}`,
    `Output directory: \`${index.summary.outputDirectory}\``,
    `Bulk command: \`${index.summary.bulkCommand}\``,
    ...(index.summary.operatorLaunchUrl ? [`Operator launch page: \`${index.summary.operatorLaunchUrl}\``] : []),
    ...(index.summary.operatorLaunchUrlTemplate
      ? [`Operator launch template: \`${index.summary.operatorLaunchUrlTemplate}\``]
      : []),
    ...productionHandoffCommandMarkdownLines(),
    '',
    '## Batch Sheets',
    '',
  ]

  for (const sheet of index.sheets) {
    lines.push(
      `- \`${sheet.batchId}\` (ranks ${sheet.rankStart}-${sheet.rankEnd}, ${sheet.effectCount} effects, \`${sheet.firstEffectId}\` to \`${sheet.lastEffectId}\`): \`${sheet.markdownOutputFile}\``,
      `  - JSON: \`${sheet.outputFile}\``,
      `  - \`${sheet.command}\``,
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function createPfxRedTeamEffectReviewTemplate(effectId: string): PfxRedTeamEffectReview {
  return {
    effectId,
    status: 'pending',
    reviewer: 'TODO:red-team-reviewer',
    reviewedAt: 'TODO:ISO-8601',
    anchor: effectId,
    criteria: createPendingRedTeamCriteria(),
    blockerFindings: ['TODO:record blocking red-team findings or leave empty only after signoff.'],
    notes: 'TODO:record adversarial review notes, resolved findings, or deferral rationale.',
  }
}

function createPfxRedTeamMobileBlockedReviewTemplate(
  effectId: string,
  effectName: string,
  realDeviceEvidence: PfxRedTeamReviewDossierEffect['realDeviceEvidence'],
): PfxRedTeamEffectReview {
  return {
    effectId,
    status: 'blocked',
    reviewer: 'red-team-mobile-gate',
    reviewedAt: '2026-07-03T12:00:00.000Z',
    anchor: effectId,
    criteria: {
      'taxonomy-comprehensive': 'pass',
      'game-ready-not-decorative': 'pass',
      'mobile-performance-proven': 'fail',
      'style-clusters-distinct': 'pass',
      'customization-safe': 'pass',
      'export-clean': 'pass',
      'documentation-sufficient': 'pass',
    },
    blockerFindings: [
      `Missing valid mobile Safari real-device capture: ${realDeviceEvidence.mobileSafari}`,
      `Missing valid Chrome Android real-device capture: ${realDeviceEvidence.chromeAndroid}`,
    ],
    notes: `Adversarial red-team draft blocks ${effectName} because mobile browser performance is not proven by valid real-device captures yet.`,
  }
}

function productionImplementationCandidateMissingPrerequisites(
  codeFacts: PfxProductionImplementationCandidateEffect['codeFacts'],
): PfxProductionImplementationCandidatePrerequisite[] {
  const missing: PfxProductionImplementationCandidatePrerequisite[] = []
  if (!codeFacts.hasDropInComponent) missing.push('drop-in-r3f-component')
  if (!codeFacts.hasAuthoredRecipe) missing.push('authored-render-recipe')
  if (!codeFacts.controlsValidate) missing.push('all-controls-safe')
  if (!codeFacts.hasMobileBudget) missing.push('mobile-budget-declared')
  if (!codeFacts.hasPreviewAssets) missing.push('preview-asset-exported')
  if (!codeFacts.hasDeveloperDocs) missing.push('documentation-export-clean')
  if (!codeFacts.hasRenderPlanDepth) missing.push('render-plan-depth')
  return missing
}

function sentenceCaseProductionImplementationCriterion(criterion: PfxProductionImplementationCriterion): string {
  const labels: Record<PfxProductionImplementationCriterion, string> = {
    'drop-in-r3f-component': 'Drop-in R3F component',
    'authored-render-recipe': 'Authored render recipe',
    'all-controls-safe': 'All controls safe',
    'mobile-budget-declared': 'Mobile budget declared',
    'preview-asset-exported': 'Preview asset exported',
    'documentation-export-clean': 'Documentation export clean',
  }
  return labels[criterion]
}

function createPendingRedTeamCriteria(): Record<PfxRedTeamCriterion, PfxRedTeamCriterionStatus> {
  return Object.fromEntries(PFX_RED_TEAM_CRITERIA.map((criterion) => [criterion, 'pending'])) as Record<
    PfxRedTeamCriterion,
    PfxRedTeamCriterionStatus
  >
}

function createRedTeamAttackPrompts(
  effect: PfxTaxonomyEffect,
  preset: PfxPreset,
): Record<PfxRedTeamCriterion, string> {
  return {
    'taxonomy-comprehensive': `Challenge whether ${effect.name} at rank ${effect.rank} reflects a real production need or an easy/showy catalog slot; compare nearby taxonomy entries and market source families ${effect.marketSourceFamilies.join(', ')}.`,
    'game-ready-not-decorative': `Attack whether ${effect.name} has a concrete gameplay role for ${effect.gameplayUseCases.join(', ')} beyond decorative particles, including timing, space, loop/burst fit, and current ${preset.acceptanceStatus} limitations.`,
    'mobile-performance-proven': `Reject signoff unless ${effect.name} has valid mobile Safari and Chrome Android real-device captures with matching runtime policy, WebGL availability, touch evidence, single-effect scope, and screenshot-readback overdraw.`,
    'style-clusters-distinct': `Inspect style differentiation evidence for ${effect.name}; fail if style clusters are simple recolors instead of distinct silhouette, material, motion, particle shape, edge, and size treatments.`,
    'customization-safe': `Try to break ${effect.name} through min/default/max controls for color, scale, density, timing, lifetime, velocity, gravity, turbulence, spawn shape, texture, flipbook, blend mode, emissive, trail length, seed, and LOD.`,
    'export-clean': `Check that ${effect.name} exports clean typed R3F component snippets and JSON presets without forbidden names, missing imports, or game-specific assumptions.`,
    'documentation-sufficient': `Verify a developer can integrate ${effect.name} without asking the author, using docs, caveats, budgets, preview evidence, and copy-paste examples only.`,
  }
}

function sentenceCaseRedTeamCriterion(criterion: PfxRedTeamCriterion): string {
  const labels: Record<PfxRedTeamCriterion, string> = {
    'taxonomy-comprehensive': 'Taxonomy comprehensive',
    'game-ready-not-decorative': 'Game ready not decorative',
    'mobile-performance-proven': 'Mobile performance proven',
    'style-clusters-distinct': 'Style clusters distinct',
    'customization-safe': 'Customization safe',
    'export-clean': 'Export clean',
    'documentation-sufficient': 'Documentation sufficient',
  }
  return labels[criterion]
}

function formatMobileEvidenceGateBlocker(blocker: string): string {
  return blocker.replace(/ at (\.context\/\S+)/, ' at `$1`')
}

function createRedTeamReviewerRisk(preset: PfxPreset): PfxRedTeamReviewBatchSheetEffect['reviewerRisk'] {
  const reasons: string[] = []
  if (preset.performance.tier !== 'low') {
    reasons.push(`performance tier ${preset.performance.tier} needs deeper concurrent-use review`)
  }
  if (preset.mobileSafety !== 'safe') {
    reasons.push(`mobile safety ${preset.mobileSafety} needs stricter real-device review`)
  }
  return {
    level:
      preset.performance.tier === 'cinematic' || preset.mobileSafety === 'cinematic-only'
        ? 'critical'
        : reasons.length > 0
          ? 'heightened'
          : 'standard',
    performanceTier: preset.performance.tier,
    mobileSafety: preset.mobileSafety,
    reasons,
  }
}

function createRedTeamVisualInspectionTargets(
  effectId: string,
): PfxRedTeamReviewBatchSheetEffect['visualInspectionTargets'] {
  return createVisualInspectionTargets(effectId, 'red-team')
}

export function createPfxSparkGapLoopState(elapsedSeconds: number): {
  energy: number
  stage: 'snap' | 'afterglow' | 'rest'
} {
  const beat = ((Math.max(0, elapsedSeconds) % 0.46) + 0.46) % 0.46
  if (beat < 0.07) {
    const p = beat / 0.07
    return { energy: roundMetric(0.94 + Math.sin(p * Math.PI) * 0.06), stage: 'snap' }
  }
  if (beat < 0.22) {
    const p = (beat - 0.07) / 0.15
    return { energy: roundMetric(0.62 * Math.pow(1 - p, 0.7) + 0.08), stage: 'afterglow' }
  }
  return { energy: 0.04, stage: 'rest' }
}
