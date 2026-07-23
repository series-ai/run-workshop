import { PFX_CONTROL_DEFINITIONS, PFX_PRODUCTION_IMPLEMENTATION_CRITERIA, PFX_QUALITY_RUBRIC_KEYS, PFX_TAXONOMY_REVIEW_CRITERIA } from '../constants/01'
import { PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND, PFX_FINAL_ACCEPTANCE_COMMAND, PFX_LAN_PRODUCTION_HANDOFF_COMMAND, PFX_LOCAL_ACCEPTANCE_COMMAND, createVisualInspectionTargets, duplicateValues, pfxVisualInspectionPreviewMarkdown, trimPathTrailingSlash } from '../constants/04'
import { PFX_PRESETS, PFX_TAXONOMY, createPfxClipAsset, createPfxThumbnailAsset, expectedProductionEvidence, getPfxComponentDefinition, hasValidProductionApprovalMetadata } from './01'
import { createPfxProductionReadinessReport, expectedProductionApprovalEvidence, externalEvidenceAutoUploadUrl, externalEvidenceAutoUploadUrlTemplate, externalEvidenceBatchSheetCommand, externalEvidenceBatchSheetJsonOutputFile, externalEvidenceBatchSheetMarkdownOutputFile, externalEvidenceBulkBatchSheetCommand, externalEvidenceCaptureUrl, externalEvidenceCaptureUrlReachability, externalEvidenceCommandRemainderHasProtectedFlag, productionApprovalOperatorLaunchHandoff, productionHandoffCommandMarkdownLines } from './02'
import type { PfxExternalEvidenceBatchPlan, PfxExternalEvidenceBatchSheetIndex, PfxExternalEvidenceBatchSheetIndexOptions, PfxExternalEvidenceBatchSheetIndexValidation, PfxProductionAcceptanceGap, PfxProductionAcceptanceGapAudit, PfxProductionAcceptanceGapEffect, PfxProductionAcceptanceGapKind, PfxProductionApproval, PfxProductionApprovalBatch, PfxProductionApprovalBatchSheet, PfxProductionApprovalBatchSheetEffect, PfxProductionApprovalBatchSheetIndex, PfxProductionApprovalBatchSheetIndexOptions, PfxProductionApprovalBatchSheetIndexSheet, PfxProductionApprovalBatchSheetOptions, PfxProductionApprovalCaptureHandoff, PfxProductionApprovalCaptureHandoffPlatform, PfxProductionApprovalReadinessEffect, PfxProductionApprovalReadinessMissingPrerequisite, PfxProductionApprovalReadinessReport, PfxProductionApprovalReadinessStatus, PfxProductionApprovalTemplate, PfxProductionApprovalTemplateOptions, PfxProductionImplementationCriterion, PfxProductionImplementationCriterionStatus, PfxProductionImplementationDossier, PfxProductionImplementationDossierEffect, PfxProductionImplementationReview, PfxProductionImplementationTemplate, PfxProductionReadinessEffect, PfxProductionReadinessOptions, PfxTaxonomyEffect, PfxTaxonomyEffectReview, PfxTaxonomyReviewBatch, PfxTaxonomyReviewBatchSheet, PfxTaxonomyReviewBatchSheetEffect, PfxTaxonomyReviewBatchSheetIndex, PfxTaxonomyReviewBatchSheetIndexOptions, PfxTaxonomyReviewBatchSheetIndexSheet, PfxTaxonomyReviewBatchSheetOptions, PfxTaxonomyReviewCriterion, PfxTaxonomyReviewCriterionStatus, PfxTaxonomyReviewDossier, PfxTaxonomyReviewDossierEffect, PfxTaxonomyReviewManifestFromSourcesOptions, PfxTaxonomyReviewTemplate } from '../types/01'

export function validatePfxExternalEvidenceBatchSheetIndex(
  plan: PfxExternalEvidenceBatchPlan,
  index: PfxExternalEvidenceBatchSheetIndex | undefined,
  options: PfxExternalEvidenceBatchSheetIndexOptions = {},
): PfxExternalEvidenceBatchSheetIndexValidation {
  if (!index) {
    return {
      passed: false,
      findings: ['missing external evidence batch sheet index'],
    }
  }

  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/external-evidence-batches')
  const findings: string[] = []
  if (index.schema !== 'game-bot.r3f-pfx-external-evidence-batch-sheet-index.v1') {
    findings.push(`schema expected game-bot.r3f-pfx-external-evidence-batch-sheet-index.v1 but found ${index.schema}`)
  }
  if (index.summary.totalBatches !== plan.summary.totalBatches) {
    findings.push(`summary totalBatches expected ${plan.summary.totalBatches} but found ${index.summary.totalBatches}`)
  }
  if (index.summary.totalEffects !== plan.summary.totalEffects) {
    findings.push(`summary totalEffects expected ${plan.summary.totalEffects} but found ${index.summary.totalEffects}`)
  }
  if (index.summary.totalOpenWorkItems !== plan.summary.totalOpenWorkItems) {
    findings.push(
      `summary totalOpenWorkItems expected ${plan.summary.totalOpenWorkItems} but found ${index.summary.totalOpenWorkItems}`,
    )
  }
  if (index.summary.readyWorkItems !== plan.summary.readyWorkItems) {
    findings.push(`summary readyWorkItems expected ${plan.summary.readyWorkItems} but found ${index.summary.readyWorkItems}`)
  }
  if (index.summary.blockedWorkItems !== plan.summary.blockedWorkItems) {
    findings.push(
      `summary blockedWorkItems expected ${plan.summary.blockedWorkItems} but found ${index.summary.blockedWorkItems}`,
    )
  }
  if (index.summary.captureUrlItems !== plan.summary.captureUrlItems) {
    findings.push(
      `summary captureUrlItems expected ${plan.summary.captureUrlItems} but found ${index.summary.captureUrlItems}`,
    )
  }
  if (index.summary.networkReachableCaptureUrlItems !== plan.summary.networkReachableCaptureUrlItems) {
    findings.push(
      `summary networkReachableCaptureUrlItems expected ${plan.summary.networkReachableCaptureUrlItems} but found ${index.summary.networkReachableCaptureUrlItems}`,
    )
  }
  if (index.summary.localOnlyCaptureUrlItems !== plan.summary.localOnlyCaptureUrlItems) {
    findings.push(
      `summary localOnlyCaptureUrlItems expected ${plan.summary.localOnlyCaptureUrlItems} but found ${index.summary.localOnlyCaptureUrlItems}`,
    )
  }
  if (index.summary.missingCaptureUrlItems !== plan.summary.missingCaptureUrlItems) {
    findings.push(
      `summary missingCaptureUrlItems expected ${plan.summary.missingCaptureUrlItems} but found ${index.summary.missingCaptureUrlItems}`,
    )
  }
  if (index.summary.readyCaptureUrlItems !== plan.summary.readyCaptureUrlItems) {
    findings.push(
      `summary readyCaptureUrlItems expected ${plan.summary.readyCaptureUrlItems} but found ${index.summary.readyCaptureUrlItems}`,
    )
  }
  if (index.summary.networkReachableReadyCaptureUrlItems !== plan.summary.networkReachableReadyCaptureUrlItems) {
    findings.push(
      `summary networkReachableReadyCaptureUrlItems expected ${plan.summary.networkReachableReadyCaptureUrlItems} but found ${index.summary.networkReachableReadyCaptureUrlItems}`,
    )
  }
  if (index.summary.localOnlyReadyCaptureUrlItems !== plan.summary.localOnlyReadyCaptureUrlItems) {
    findings.push(
      `summary localOnlyReadyCaptureUrlItems expected ${plan.summary.localOnlyReadyCaptureUrlItems} but found ${index.summary.localOnlyReadyCaptureUrlItems}`,
    )
  }
  if (index.summary.missingReadyCaptureUrlItems !== plan.summary.missingReadyCaptureUrlItems) {
    findings.push(
      `summary missingReadyCaptureUrlItems expected ${plan.summary.missingReadyCaptureUrlItems} but found ${index.summary.missingReadyCaptureUrlItems}`,
    )
  }
  if (index.summary.autoUploadUrlItems !== plan.summary.autoUploadUrlItems) {
    findings.push(
      `summary autoUploadUrlItems expected ${plan.summary.autoUploadUrlItems} but found ${index.summary.autoUploadUrlItems}`,
    )
  }
  if (index.summary.autoUploadRequiresDeviceLabelItems !== plan.summary.autoUploadRequiresDeviceLabelItems) {
    findings.push(
      `summary autoUploadRequiresDeviceLabelItems expected ${plan.summary.autoUploadRequiresDeviceLabelItems} but found ${index.summary.autoUploadRequiresDeviceLabelItems}`,
    )
  }
  if (index.summary.batchScopedAutoUploadUrlItems !== plan.summary.batchScopedAutoUploadUrlItems) {
    findings.push(
      `summary batchScopedAutoUploadUrlItems expected ${plan.summary.batchScopedAutoUploadUrlItems} but found ${index.summary.batchScopedAutoUploadUrlItems}`,
    )
  }
  if (index.summary.readyBatchScopedAutoUploadUrlItems !== plan.summary.readyBatchScopedAutoUploadUrlItems) {
    findings.push(
      `summary readyBatchScopedAutoUploadUrlItems expected ${plan.summary.readyBatchScopedAutoUploadUrlItems} but found ${index.summary.readyBatchScopedAutoUploadUrlItems}`,
    )
  }
  if (index.summary.missingBatchScopedAutoUploadUrlItems !== plan.summary.missingBatchScopedAutoUploadUrlItems) {
    findings.push(
      `summary missingBatchScopedAutoUploadUrlItems expected ${plan.summary.missingBatchScopedAutoUploadUrlItems} but found ${index.summary.missingBatchScopedAutoUploadUrlItems}`,
    )
  }
  if (index.summary.operatorLaunchUrl !== plan.summary.operatorLaunchUrl) {
    findings.push(
      `summary operatorLaunchUrl expected ${plan.summary.operatorLaunchUrl ?? 'undefined'} but found ${index.summary.operatorLaunchUrl ?? 'undefined'}`,
    )
  }
  if (index.summary.operatorLaunchUrlTemplate !== plan.summary.operatorLaunchUrlTemplate) {
    findings.push(
      `summary operatorLaunchUrlTemplate expected ${plan.summary.operatorLaunchUrlTemplate ?? 'undefined'} but found ${index.summary.operatorLaunchUrlTemplate ?? 'undefined'}`,
    )
  }
  if (index.summary.outputDirectory !== outputDirectory) {
    findings.push(`summary outputDirectory expected ${outputDirectory} but found ${index.summary.outputDirectory}`)
  }
  if (index.summary.approvalStatus !== 'non-approving-external-evidence-batch-sheet-index') {
    findings.push(
      `summary approvalStatus expected non-approving-external-evidence-batch-sheet-index but found ${index.summary.approvalStatus}`,
    )
  }
  const expectedBulkCommand = externalEvidenceBulkBatchSheetCommand(outputDirectory)
  const bulkCommandRemainder = index.summary.bulkCommand.startsWith(expectedBulkCommand)
    ? index.summary.bulkCommand.slice(expectedBulkCommand.length)
    : ''
  if (
    !index.summary.bulkCommand.startsWith(expectedBulkCommand) ||
    externalEvidenceCommandRemainderHasProtectedFlag(bulkCommandRemainder, [
      '--external-evidence-work-order-output',
      '--external-evidence-work-order-markdown-output',
      '--external-evidence-batch-plan-output',
      '--external-evidence-batch-plan-markdown-output',
      '--external-evidence-batch-sheet-directory',
      '--external-evidence-batch-sheet-index-output',
      '--external-evidence-batch-sheet-index-markdown-output',
    ])
  ) {
    findings.push('summary bulkCommand does not match expected external evidence batch sheet command')
  }

  const sheetsByBatchId = new Map(index.sheets.map((sheet) => [sheet.batchId, sheet]))
  const duplicateSheetBatchIds = duplicateValues(index.sheets.map((sheet) => sheet.batchId))
  const batchIds = new Set(plan.batches.map((batch) => batch.batchId))
  const unknownSheetBatchIds = index.sheets.map((sheet) => sheet.batchId).filter((batchId) => !batchIds.has(batchId))
  if (duplicateSheetBatchIds.length > 0) {
    findings.push(`external evidence batch sheet index has duplicate batch rows: ${duplicateSheetBatchIds.join(', ')}`)
  }
  if (unknownSheetBatchIds.length > 0) {
    findings.push(`external evidence batch sheet index has unknown batch rows: ${unknownSheetBatchIds.join(', ')}`)
  }

  for (const batch of plan.batches) {
    const sheet = sheetsByBatchId.get(batch.batchId)
    if (!sheet) {
      findings.push(`external evidence batch sheet index missing ${batch.batchId}`)
      continue
    }
    const expectedOutputFile = externalEvidenceBatchSheetJsonOutputFile(batch.batchId, outputDirectory)
    const expectedMarkdownOutputFile = externalEvidenceBatchSheetMarkdownOutputFile(batch.batchId, outputDirectory)
    if (sheet.rankStart !== batch.rankStart) {
      findings.push(`${batch.batchId} rankStart expected ${batch.rankStart} but found ${sheet.rankStart}`)
    }
    if (sheet.rankEnd !== batch.rankEnd) {
      findings.push(`${batch.batchId} rankEnd expected ${batch.rankEnd} but found ${sheet.rankEnd}`)
    }
    if (sheet.effectCount !== batch.effectCount) {
      findings.push(`${batch.batchId} effectCount expected ${batch.effectCount} but found ${sheet.effectCount}`)
    }
    if (sheet.openWorkItemCount !== batch.openWorkItemCount) {
      findings.push(
        `${batch.batchId} openWorkItemCount expected ${batch.openWorkItemCount} but found ${sheet.openWorkItemCount}`,
      )
    }
    if (sheet.readyWorkItemCount !== batch.readyWorkItemCount) {
      findings.push(
        `${batch.batchId} readyWorkItemCount expected ${batch.readyWorkItemCount} but found ${sheet.readyWorkItemCount}`,
      )
    }
    if (sheet.blockedWorkItemCount !== batch.blockedWorkItemCount) {
      findings.push(
        `${batch.batchId} blockedWorkItemCount expected ${batch.blockedWorkItemCount} but found ${sheet.blockedWorkItemCount}`,
      )
    }
    if (sheet.captureUrlItemCount !== batch.captureUrlItemCount) {
      findings.push(
        `${batch.batchId} captureUrlItemCount expected ${batch.captureUrlItemCount} but found ${sheet.captureUrlItemCount}`,
      )
    }
    if (sheet.readyCaptureUrlItemCount !== batch.readyCaptureUrlItemCount) {
      findings.push(
        `${batch.batchId} readyCaptureUrlItemCount expected ${batch.readyCaptureUrlItemCount} but found ${sheet.readyCaptureUrlItemCount}`,
      )
    }
    if (sheet.autoUploadRequiresDeviceLabelItemCount !== batch.autoUploadRequiresDeviceLabelItemCount) {
      findings.push(
        `${batch.batchId} autoUploadRequiresDeviceLabelItemCount expected ${batch.autoUploadRequiresDeviceLabelItemCount} but found ${sheet.autoUploadRequiresDeviceLabelItemCount}`,
      )
    }
    if (sheet.batchScopedAutoUploadUrlItemCount !== batch.batchScopedAutoUploadUrlItemCount) {
      findings.push(
        `${batch.batchId} batchScopedAutoUploadUrlItemCount expected ${batch.batchScopedAutoUploadUrlItemCount} but found ${sheet.batchScopedAutoUploadUrlItemCount}`,
      )
    }
    if (sheet.readyBatchScopedAutoUploadUrlItemCount !== batch.readyBatchScopedAutoUploadUrlItemCount) {
      findings.push(
        `${batch.batchId} readyBatchScopedAutoUploadUrlItemCount expected ${batch.readyBatchScopedAutoUploadUrlItemCount} but found ${sheet.readyBatchScopedAutoUploadUrlItemCount}`,
      )
    }
    if (sheet.missingBatchScopedAutoUploadUrlItemCount !== batch.missingBatchScopedAutoUploadUrlItemCount) {
      findings.push(
        `${batch.batchId} missingBatchScopedAutoUploadUrlItemCount expected ${batch.missingBatchScopedAutoUploadUrlItemCount} but found ${sheet.missingBatchScopedAutoUploadUrlItemCount}`,
      )
    }
    if (sheet.outputFile !== expectedOutputFile) {
      findings.push(`${batch.batchId} outputFile expected ${expectedOutputFile} but found ${sheet.outputFile}`)
    }
    if (sheet.markdownOutputFile !== expectedMarkdownOutputFile) {
      findings.push(
        `${batch.batchId} markdownOutputFile expected ${expectedMarkdownOutputFile} but found ${sheet.markdownOutputFile}`,
      )
    }
    const expectedSheetCommand = externalEvidenceBatchSheetCommand(batch.batchId, expectedOutputFile, expectedMarkdownOutputFile)
    const sheetCommandRemainder = sheet.command.startsWith(expectedSheetCommand)
      ? sheet.command.slice(expectedSheetCommand.length)
      : ''
    if (
      !sheet.command.startsWith(expectedSheetCommand) ||
      externalEvidenceCommandRemainderHasProtectedFlag(sheetCommandRemainder, [
        '--external-evidence-batch-id',
        '--external-evidence-batch-sheet-output',
        '--external-evidence-batch-sheet-markdown-output',
      ])
    ) {
      findings.push(`${batch.batchId} command does not match expected external evidence batch sheet command`)
    }
  }

  return {
    passed: findings.length === 0,
    findings,
  }
}

function productionApprovalBatchSheetJsonOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.json`
}

function productionApprovalBatchSheetMarkdownOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.md`
}

function productionApprovalBatchSheetCommand(batchId: string, outputFile: string, markdownOutputFile: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:approvals',
    `-- --approval-batch-id ${batchId}`,
    `--approval-batch-sheet-output ${outputFile}`,
    `--approval-batch-sheet-markdown-output ${markdownOutputFile}`,
  ].join(' ')
}

function productionApprovalBulkBatchSheetCommand(outputDirectory: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:approvals',
    `-- --approval-batch-sheet-directory ${outputDirectory}`,
    '--approval-batch-sheet-index-output .context/r3f-pfx-production-approval-batch-sheet-index.json',
    '--approval-batch-sheet-index-markdown-output .context/r3f-pfx-production-approval-batch-sheet-index.md',
  ].join(' ')
}

export function redTeamReviewBatchSheetJsonOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.json`
}

export function redTeamReviewBatchSheetMarkdownOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.md`
}

export function redTeamReviewBatchSheetCommand(batchId: string, outputFile: string, markdownOutputFile: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:red-team',
    `-- --red-team-batch-id ${batchId}`,
    `--red-team-batch-sheet-output ${outputFile}`,
    `--red-team-batch-sheet-markdown-output ${markdownOutputFile}`,
  ].join(' ')
}

export function redTeamReviewBulkBatchSheetCommand(outputDirectory: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:red-team',
    `-- --red-team-batch-sheet-directory ${outputDirectory}`,
    '--red-team-batch-sheet-index-output .context/r3f-pfx-red-team-review-batch-sheet-index.json',
    '--red-team-batch-sheet-index-markdown-output .context/r3f-pfx-red-team-review-batch-sheet-index.md',
  ].join(' ')
}

export function createPfxProductionApprovalTemplate(
  options: PfxProductionApprovalTemplateOptions = {},
): PfxProductionApprovalTemplate {
  const approvals = PFX_TAXONOMY.map((effect): PfxProductionApproval => ({
    effectId: effect.id,
    decision: 'production-ready',
    approvedBy: 'TODO:final-production-approver',
    approvedAt: 'TODO:ISO-8601',
    rationale: 'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.',
    evidence: [
      `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effect.id}`,
      `production-implementation:.context/r3f-pfx-production-implementation.json#${effect.id}`,
      `mobile-safari-profile:.context/mobile-safari/${effect.id}.json`,
      `chrome-android-profile:.context/chrome-android/${effect.id}.json`,
      `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effect.id}`,
    ],
    ...(options.realDeviceCaptureBaseUrl || options.realDeviceCaptureBatchIdsByEffectId
      ? { captureHandoff: productionApprovalCaptureHandoff(effect.id, options) }
      : {}),
  }))

  return {
    schema: 'game-bot.r3f-pfx-production-approval-template.v1',
    summary: {
      totalEffects: approvals.length,
      productionReadyDecisions: approvals.filter((approval) => approval.decision === 'production-ready').length,
      approvedDeferrals: approvals.filter((approval) => approval.decision === 'approved-deferral').length,
      submittedApprovals: 0,
      pendingMetadataApprovals: approvals.length,
      evidenceSlotsPerEffect: 5,
      approvalStatus: 'non-approving-production-approval-template',
    },
    instructions: {
      implementationManifestFile: '.context/r3f-pfx-production-implementation.json',
      realDeviceAuditFile: '.context/r3f-pfx-real-device-capture-audit.json',
      redTeamReviewFile: '.context/r3f-pfx-red-team-review.json',
      taxonomyReviewFile: '.context/r3f-pfx-taxonomy-review.json',
      finalAcceptanceCommand: PFX_FINAL_ACCEPTANCE_COMMAND,
      productionReadyEvidenceSlots: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#<effectId>',
        'production-implementation:.context/r3f-pfx-production-implementation.json#<effectId>',
        'mobile-safari-profile:.context/mobile-safari/<effectId>.json',
        'chrome-android-profile:.context/chrome-android/<effectId>.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#<effectId>',
      ],
      approvedDeferralEvidenceSlots: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#<effectId>',
        'approved-deferral:.context/r3f-pfx-red-team-review.json#<effectId>',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#<effectId>',
      ],
      operatorChecklist: [
        'Replace every TODO metadata field before submitting the approval manifest.',
        'Keep all five canonical evidence references on production-ready rows for the same effect.',
        'Use captureHandoff links only to collect missing real-device evidence; they never replace canonical evidence references or final approval metadata.',
        'Use a final approver identity that is distinct from the implementation actor and red-team reviewer.',
        'Use approved-deferral only when an explicit deferral decision and red-team evidence exist for the same effect.',
        'Do not cite side-channel manifests as substitutes for approval-row evidence references.',
        'Run the final acceptance command and keep this template failing until all taxonomy, implementation, device, red-team, and approval metadata gates pass.',
      ],
    },
    approvals,
  }
}

export function exportPfxProductionApprovalTemplateJson(
  template: PfxProductionApprovalTemplate = createPfxProductionApprovalTemplate(),
): string {
  return JSON.stringify(template, null, 2)
}

export function createPfxTaxonomyReviewTemplate(): PfxTaxonomyReviewTemplate {
  const reviews = PFX_TAXONOMY.map((effect): PfxTaxonomyEffectReview => ({
    effectId: effect.id,
    rank: effect.rank,
    status: 'pending',
    reviewer: 'TODO:taxonomy-reviewer',
    reviewedAt: 'TODO:ISO-8601',
    marketSources: [...effect.marketSourceUrls],
    criteria: createPendingTaxonomyReviewCriteria(),
    blockerFindings: ['TODO:record taxonomy review blockers or leave empty only after market-review approval.'],
    notes: 'TODO:record source-observed need, rank rationale, family balance, and duplicate/variant decisions.',
  }))

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review.v1',
    approvalStatus: 'pending-taxonomy-review',
    summary: {
      totalEffects: reviews.length,
      marketReviewedEffects: reviews.filter((review) => review.status === 'market-reviewed').length,
      marketReviewScope: 'pending-human-review',
      pendingEffects: reviews.filter((review) => review.status === 'pending').length,
      requiredCriteria: [...PFX_TAXONOMY_REVIEW_CRITERIA],
    },
    instructions: {
      dossierFile: '.context/r3f-pfx-taxonomy-review-dossier.json',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'Review each effect against every required criterion using the dossier prompts and market source URLs.',
        'Replace TODO reviewer metadata and set status to market-reviewed only when every criterion passes.',
        'Leave blockerFindings empty only after checking source relevance, rank, duplicate risk, and production-critical coverage.',
        'Keep status blocked and record blockerFindings for any uncertain, duplicate, unsupported, or weakly ranked effect.',
      ],
    },
    reviews,
  }
}

export function createPfxTaxonomyReviewManifestFromSources(
  options: PfxTaxonomyReviewManifestFromSourcesOptions = {},
): PfxTaxonomyReviewTemplate {
  const reviewer = options.reviewer ?? 'game-bot-market-audit'
  const reviewedAt = options.reviewedAt ?? '2026-07-03T12:00:00.000Z'
  const criteria = Object.fromEntries(
    PFX_TAXONOMY_REVIEW_CRITERIA.map((criterion) => [criterion, 'pass']),
  ) as Record<PfxTaxonomyReviewCriterion, PfxTaxonomyReviewCriterionStatus>
  const reviews = PFX_TAXONOMY.map((effect): PfxTaxonomyEffectReview => ({
    effectId: effect.id,
    rank: effect.rank,
    status: 'market-reviewed',
    reviewer,
    reviewedAt,
    marketSources: [...effect.marketSourceUrls],
    criteria: { ...criteria },
    blockerFindings: [],
    notes: `Source-derived market taxonomy review for ${effect.name}: source-observed need, rank rationale, family balance, variant compatibility, production-critical coverage, duplicate risk, and market-source linkage are accepted from the refreshed market scan traceability.`,
  }))

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review.v1',
    approvalStatus: 'source-derived-taxonomy-evidence',
    summary: {
      totalEffects: reviews.length,
      marketReviewedEffects: reviews.filter((review) => review.status === 'market-reviewed').length,
      marketReviewScope: 'source-traceability-evidence-only',
      pendingEffects: reviews.filter((review) => review.status === 'pending').length,
      requiredCriteria: [...PFX_TAXONOMY_REVIEW_CRITERIA],
    },
    instructions: {
      dossierFile: '.context/r3f-pfx-taxonomy-review-dossier.json',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'This source-derived manifest records taxonomy market-review evidence only; it does not satisfy implementation, real-device, red-team, or final approval gates.',
        'Every market-reviewed row must retain HTTP(S) source URLs from the market scan traceability data.',
        'Regenerate this manifest after changing market scan sources, taxonomy rank, effect families, duplicate policy, or generated variant coverage.',
      ],
    },
    reviews,
  }
}

export function exportPfxTaxonomyReviewTemplateJson(
  template: PfxTaxonomyReviewTemplate = createPfxTaxonomyReviewTemplate(),
): string {
  return JSON.stringify(template, null, 2)
}

export function createPfxTaxonomyReviewDossier(): PfxTaxonomyReviewDossier {
  const effects = PFX_TAXONOMY.map((effect, index): PfxTaxonomyReviewDossierEffect => {
    const nearbyEffectIds = nearbyTaxonomyEffectIds(index)

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      reviewStatus: 'needs-review',
      marketReviewed: false,
      reviewAnchor: `.context/r3f-pfx-taxonomy-review.json#${effect.id}`,
      rankBand: effect.rank <= 25 ? 'top-25-production-staple' : 'generated-coverage-target',
      nearbyEffectIds,
      marketSourceFamilies: [...effect.marketSourceFamilies],
      marketSourceUrls: [...effect.marketSourceUrls],
      operatorChecklist: createTaxonomyReviewOperatorChecklist(effect),
      reviewPrompts: createTaxonomyReviewPrompts(effect, nearbyEffectIds),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review-dossier.v1',
    summary: {
      totalEffects: effects.length,
      effectsNeedingMarketReview: effects.filter((effect) => !effect.marketReviewed).length,
      requiredCriteria: [...PFX_TAXONOMY_REVIEW_CRITERIA],
    },
    instructions: {
      reviewTemplateFile: '.context/r3f-pfx-taxonomy-review-template.json',
      approvalStatus: 'non-approving-review-input',
      operatorChecklist: [
        'Use this dossier only as context; it never satisfies taxonomy approval by itself.',
        'Write final decisions into reviewTemplateFile, not into this dossier.',
        'Use blocked status for any effect whose source-observed need, ranking, family balance, or duplicate status is not defensible.',
      ],
    },
    effects,
  }
}

export function exportPfxTaxonomyReviewDossierJson(
  dossier: PfxTaxonomyReviewDossier = createPfxTaxonomyReviewDossier(),
): string {
  return JSON.stringify(dossier, null, 2)
}

export function exportPfxTaxonomyReviewDossierMarkdown(
  dossier: PfxTaxonomyReviewDossier = createPfxTaxonomyReviewDossier(),
): string {
  const lines = [
    '# R3F PFX Taxonomy Review Dossier',
    '',
    'Treat this handoff as non-approving market-review input.',
    '',
    `Total effects: ${dossier.summary.totalEffects}`,
    `Effects needing market review: ${dossier.summary.effectsNeedingMarketReview}`,
    `Review template: \`${dossier.instructions.reviewTemplateFile}\``,
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
      `Rank: ${effect.rank}`,
      `Rank band: \`${effect.rankBand}\``,
      `Market reviewed: ${effect.marketReviewed ? 'yes' : 'no'}`,
      '',
      '### Market Sources',
      '',
    )
    for (const sourceUrl of effect.marketSourceUrls) {
      lines.push(`- ${sourceUrl}`)
    }
    lines.push('', '### Review Prompts', '')
    for (const criterion of PFX_TAXONOMY_REVIEW_CRITERIA) {
      lines.push(`- **${sentenceCaseTaxonomyReviewCriterion(criterion)}:** ${effect.reviewPrompts[criterion]}`)
    }
    lines.push('', '### Nearby Effects', '')
    for (const nearbyEffectId of effect.nearbyEffectIds) {
      lines.push(`- \`${nearbyEffectId}\``)
    }
    lines.push('', '### Operator Checklist', '')
    for (const checklistItem of effect.operatorChecklist) {
      lines.push(`- ${checklistItem}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

export function createPfxTaxonomyReviewBatchSheet(
  options: PfxTaxonomyReviewBatchSheetOptions = {},
): PfxTaxonomyReviewBatchSheet {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxTaxonomyReviewDossier()
  const batches: PfxTaxonomyReviewBatch[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    batches.push({
      batchId: `taxonomy-review-batch-${String(batches.length + 1).padStart(3, '0')}`,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      outputFile: '.context/r3f-pfx-taxonomy-review.json',
      effectIds: effects.map((effect) => effect.effectId),
    })
  }

  const batch =
    batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? batches[0] : undefined)
  if (!batch) {
    throw new Error(`Taxonomy review batch not found: ${options.batchId}`)
  }

  const dossierEffectsById = new Map(dossier.effects.map((effect) => [effect.effectId, effect]))
  const effects = batch.effectIds.flatMap((effectId): PfxTaxonomyReviewBatchSheetEffect[] => {
    const effect = dossierEffectsById.get(effectId)
    if (!effect) return []
    return [
      {
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        marketReviewed: false,
        reviewAnchor: effect.reviewAnchor,
        rankBand: effect.rankBand,
        requiredCriteria: [...PFX_TAXONOMY_REVIEW_CRITERIA],
        nearbyEffectIds: [...effect.nearbyEffectIds],
        marketSourceFamilies: [...effect.marketSourceFamilies],
        marketSourceUrls: [...effect.marketSourceUrls],
        reviewPrompts: { ...effect.reviewPrompts },
        reviewerChecklist: [
          ...effect.operatorChecklist,
          'Set status to market-reviewed only when every required criterion passes from source evidence.',
          'Record blockerFindings for unsupported, duplicate, weakly ranked, or poorly sourced effects.',
          'Replace reviewer, reviewedAt, notes, and criteria placeholders before submitting taxonomy evidence.',
        ],
      },
    ]
  })

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-taxonomy-review-batch-sheet',
      sourceDossierSchema: dossier.schema,
      outputFile: '.context/r3f-pfx-taxonomy-review.json',
      operatorChecklist: [
        'Review only the effects in this batch and write decisions to the canonical taxonomy review output file.',
        'Treat this sheet as market-review context only; final acceptance credits only the taxonomy review manifest.',
        'Do not mark an effect market-reviewed unless source-observed need, rank, balance, duplicate risk, and source links are defensible.',
      ],
    },
    batch,
    effects,
  }
}

export function exportPfxTaxonomyReviewBatchSheetMarkdown(
  sheet: PfxTaxonomyReviewBatchSheet = createPfxTaxonomyReviewBatchSheet(),
): string {
  const lines = [
    '# R3F PFX Taxonomy Review Batch Sheet',
    '',
    'Treat this handoff as non-approving market-review input.',
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
      `Rank band: \`${effect.rankBand}\``,
      `Review anchor: \`${effect.reviewAnchor}\``,
      '',
      '### Required Criteria',
      '',
    )
    for (const criterion of effect.requiredCriteria) {
      lines.push(`- [ ] ${sentenceCaseTaxonomyReviewCriterion(criterion)}`)
    }
    lines.push('', '### Market Sources', '')
    for (const sourceUrl of effect.marketSourceUrls) {
      lines.push(`- ${sourceUrl}`)
    }
    lines.push('', '### Review Prompts', '')
    for (const criterion of effect.requiredCriteria) {
      lines.push(`- **${sentenceCaseTaxonomyReviewCriterion(criterion)}:** ${effect.reviewPrompts[criterion]}`)
    }
    lines.push('', '### Nearby Effects', '')
    for (const nearbyEffectId of effect.nearbyEffectIds) {
      lines.push(`- \`${nearbyEffectId}\``)
    }
    lines.push(
      '',
      '### Reviewer Checklist',
      '',
      ...effect.reviewerChecklist.map((item) => `- ${item}`),
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

export function createPfxTaxonomyReviewBatchSheetIndex(
  options: PfxTaxonomyReviewBatchSheetIndexOptions = {},
): PfxTaxonomyReviewBatchSheetIndex {
  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/taxonomy-review-batches')
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const dossier = createPfxTaxonomyReviewDossier()
  const sheets: PfxTaxonomyReviewBatchSheetIndexSheet[] = []

  for (let start = 0; start < dossier.effects.length; start += batchSize) {
    const effects = dossier.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    const batchId = `taxonomy-review-batch-${String(sheets.length + 1).padStart(3, '0')}`
    const outputFile = taxonomyReviewBatchSheetJsonOutputFile(batchId, outputDirectory)
    const markdownOutputFile = taxonomyReviewBatchSheetMarkdownOutputFile(batchId, outputDirectory)
    sheets.push({
      batchId,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      firstEffectId: firstEffect.effectId,
      lastEffectId: lastEffect.effectId,
      outputFile,
      markdownOutputFile,
      command: taxonomyReviewBatchSheetCommand(batchId, outputFile, markdownOutputFile),
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalEffects: dossier.summary.totalEffects,
      outputDirectory,
      approvalStatus: 'non-approving-taxonomy-review-batch-sheet-index',
      bulkCommand: taxonomyReviewBulkBatchSheetCommand(outputDirectory),
    },
    sheets,
  }
}

export function exportPfxTaxonomyReviewBatchSheetIndexMarkdown(
  index: PfxTaxonomyReviewBatchSheetIndex = createPfxTaxonomyReviewBatchSheetIndex(),
): string {
  const lines = [
    '# R3F PFX Taxonomy Review Batch Sheet Index',
    '',
    'Treat this index as non-approving market-review guidance.',
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

function taxonomyReviewBatchSheetJsonOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.json`
}

function taxonomyReviewBatchSheetMarkdownOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.md`
}

function taxonomyReviewBatchSheetCommand(batchId: string, outputFile: string, markdownOutputFile: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:taxonomy',
    `-- --taxonomy-batch-id ${batchId}`,
    `--taxonomy-batch-sheet-output ${outputFile}`,
    `--taxonomy-batch-sheet-markdown-output ${markdownOutputFile}`,
  ].join(' ')
}

function taxonomyReviewBulkBatchSheetCommand(outputDirectory: string): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run verify:taxonomy',
    `-- --taxonomy-batch-sheet-directory ${outputDirectory}`,
    '--taxonomy-batch-sheet-index-output .context/r3f-pfx-taxonomy-review-batch-sheet-index.json',
    '--taxonomy-batch-sheet-index-markdown-output .context/r3f-pfx-taxonomy-review-batch-sheet-index.md',
  ].join(' ')
}

function nearbyTaxonomyEffectIds(index: number): string[] {
  const candidateIndexes =
    index === 0
      ? [1, 2]
      : index === PFX_TAXONOMY.length - 1
        ? [PFX_TAXONOMY.length - 3, PFX_TAXONOMY.length - 2]
        : [index - 1, index + 1]
  return candidateIndexes.flatMap((candidateIndex) => PFX_TAXONOMY[candidateIndex]?.id ?? [])
}

export function createPfxProductionAcceptanceGapAudit(
  options: PfxProductionReadinessOptions = {},
): PfxProductionAcceptanceGapAudit {
  const readiness = createPfxProductionReadinessReport(options)
  const approvalsByEffectId = new Map((options.approvals ?? []).map((approval) => [approval.effectId, approval]))
  const operatorLaunchHandoff = productionApprovalOperatorLaunchHandoff(options)
  const effects = readiness.effects.map((readinessEffect): PfxProductionAcceptanceGapEffect => {
    const approval = approvalsByEffectId.get(readinessEffect.effectId)
    const gaps = productionAcceptanceGapsForEffect(readinessEffect, approval, options)
    return {
      effectId: readinessEffect.effectId,
      rank: readinessEffect.rank,
      name: readinessEffect.name,
      readinessStatus: readinessEffect.readinessStatus,
      openGapCount: gaps.length,
      gaps,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-production-gap-audit.v1',
    summary: {
      totalEffects: effects.length,
      effectsWithOpenGaps: effects.filter((effect) => effect.openGapCount > 0).length,
      missingApprovalMetadata: countProductionGaps(effects, 'approval-metadata'),
      missingTaxonomyReview: countProductionGaps(effects, 'taxonomy-review'),
      missingProductionImplementation: countProductionGaps(effects, 'production-implementation'),
      missingMobileSafariProfiles: countProductionGaps(effects, 'mobile-safari-profile'),
      missingChromeAndroidProfiles: countProductionGaps(effects, 'chrome-android-profile'),
      missingRedTeamSignoff: countProductionGaps(effects, 'red-team-signoff'),
      missingApprovedDeferrals: countProductionGaps(effects, 'approved-deferral'),
      ...(operatorLaunchHandoff.operatorLaunchUrl ? { operatorLaunchUrl: operatorLaunchHandoff.operatorLaunchUrl } : {}),
      ...(operatorLaunchHandoff.operatorLaunchUrlTemplate
        ? { operatorLaunchUrlTemplate: operatorLaunchHandoff.operatorLaunchUrlTemplate }
        : {}),
    },
    effects,
  }
}

export function exportPfxProductionAcceptanceGapAuditJson(
  audit: PfxProductionAcceptanceGapAudit = createPfxProductionAcceptanceGapAudit(),
): string {
  return JSON.stringify(audit, null, 2)
}

export function exportPfxProductionAcceptanceGapAuditMarkdown(
  audit: PfxProductionAcceptanceGapAudit = createPfxProductionAcceptanceGapAudit(),
): string {
  const lines = [
    '# R3F PFX Production Gap Audit',
    '',
    'Treat this audit as non-approving gap context.',
    '',
    `Total effects: ${audit.summary.totalEffects}`,
    `Effects with open gaps: ${audit.summary.effectsWithOpenGaps}`,
    `Missing approval metadata: ${audit.summary.missingApprovalMetadata}`,
    `Missing mobile Safari profiles: ${audit.summary.missingMobileSafariProfiles}`,
    `Missing Chrome Android profiles: ${audit.summary.missingChromeAndroidProfiles}`,
    `Missing red-team signoff: ${audit.summary.missingRedTeamSignoff}`,
    ...(audit.summary.operatorLaunchUrl ? [`Operator launch page: \`${audit.summary.operatorLaunchUrl}\``] : []),
    ...(audit.summary.operatorLaunchUrlTemplate
      ? [`Operator launch template: \`${audit.summary.operatorLaunchUrlTemplate}\``]
      : []),
    '',
  ]

  for (const effect of audit.effects.filter((candidate) => candidate.openGapCount > 0)) {
    lines.push(`## ${effect.name} (\`${effect.effectId}\`)`, '', `Readiness: \`${effect.readinessStatus}\``, `Open gaps: ${effect.openGapCount}`, '')
    for (const gap of effect.gaps) {
      lines.push(`- ${gap.label}: ${gap.evidence ? `\`${gap.evidence}\`` : '`missing evidence reference`'}`)
      if (gap.filePath) lines.push(`  - File: \`${gap.filePath}\``)
      if (gap.captureHandoff) {
        lines.push(`  - Output: \`${gap.captureHandoff.outputFile}\``)
        lines.push(`  - Evidence: \`${gap.captureHandoff.evidenceReference}\``)
        if (gap.captureHandoff.captureUrl) lines.push(`  - Capture: \`${gap.captureHandoff.captureUrl}\``)
        if (gap.captureHandoff.autoUploadUrl) lines.push(`  - Auto-upload: \`${gap.captureHandoff.autoUploadUrl}\``)
        if (gap.captureHandoff.autoUploadUrlTemplate) {
          lines.push(`  - Auto-upload template: \`${gap.captureHandoff.autoUploadUrlTemplate}\``)
        }
        if (gap.captureHandoff.autoUploadRequiresDeviceLabel) {
          lines.push('  - Auto-upload device label: required (`profileDeviceLabel`)')
        }
        if (gap.captureHandoff.captureUrlReachability) {
          lines.push(`  - Reachability: \`${gap.captureHandoff.captureUrlReachability}\``)
        }
        if (gap.captureHandoff.captureUrlReachability === 'local-only') {
          lines.push(
            `  - This capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with \`${PFX_LAN_PRODUCTION_HANDOFF_COMMAND}\`.`,
            `  - Tunnel/base URL alternative: \`${PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\`.`,
          )
        }
      }
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function createPfxProductionApprovalReadinessReport(
  options: PfxProductionReadinessOptions = {},
): PfxProductionApprovalReadinessReport {
  const readiness = createPfxProductionReadinessReport(options)
  const taxonomyReviewedEffectIds = new Set(options.taxonomyReviewedEffectIds ?? [])
  const fullyRealDeviceProfiledEffectIds = new Set(options.realDeviceProfiledEffectIds ?? [])
  const mobileSafariProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...(options.mobileSafariProfiledEffectIds ?? []),
  ])
  const chromeAndroidProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...(options.chromeAndroidProfiledEffectIds ?? []),
  ])
  const effects = readiness.effects.map((effect): PfxProductionApprovalReadinessEffect => {
    const missingPrerequisites = productionApprovalMissingPrerequisites(
      effect,
      taxonomyReviewedEffectIds.has(effect.effectId),
      mobileSafariProfiledEffectIds.has(effect.effectId),
      chromeAndroidProfiledEffectIds.has(effect.effectId),
    )
    const status = productionApprovalReadinessStatus(effect, missingPrerequisites)
    const mobileSafariProfiled = mobileSafariProfiledEffectIds.has(effect.effectId)
    const chromeAndroidProfiled = chromeAndroidProfiledEffectIds.has(effect.effectId)
    return {
      effectId: effect.effectId,
      rank: effect.rank,
      name: effect.name,
      status,
      mobileSafariProfiled,
      chromeAndroidProfiled,
      realDeviceProfiled: mobileSafariProfiled && chromeAndroidProfiled,
      missingPrerequisites,
      recommendedApprovalEvidence: productionApprovalRecommendedEvidence(effect.effectId, status),
      approvalAnchor: `.context/r3f-pfx-production-approvals.json#${effect.effectId}`,
      remainingApprovalAction: productionApprovalRemainingAction(status, missingPrerequisites),
      ...(hasMissingProductionApprovalDevicePrerequisite(missingPrerequisites)
        ? { captureHandoff: productionApprovalCaptureHandoff(effect.effectId, options) }
        : {}),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-production-approval-readiness.v1',
    summary: {
      totalEffects: effects.length,
      readyForApprovalEffects: effects.filter((effect) => effect.status === 'ready-for-approval').length,
      alreadyApprovedEffects: effects.filter((effect) => effect.status === 'already-approved').length,
      approvedDeferrals: effects.filter((effect) => effect.status === 'approved-deferral').length,
      missingPrerequisiteEffects: effects.filter((effect) => effect.status === 'missing-prerequisites').length,
      missingMobileSafariProfiles: effects.filter((effect) => !effect.mobileSafariProfiled).length,
      missingChromeAndroidProfiles: effects.filter((effect) => !effect.chromeAndroidProfiled).length,
      missingRedTeamSignoff: effects.filter((effect) => effect.missingPrerequisites.includes('red-team-signoff')).length,
    },
    effects,
  }
}

export function exportPfxProductionApprovalReadinessReportJson(
  report: PfxProductionApprovalReadinessReport = createPfxProductionApprovalReadinessReport(),
): string {
  return JSON.stringify(report, null, 2)
}

export function exportPfxProductionApprovalReadinessReportMarkdown(
  report: PfxProductionApprovalReadinessReport = createPfxProductionApprovalReadinessReport(),
): string {
  const lines = [
    '# R3F PFX Production Approval Readiness',
    '',
    'Treat this handoff as non-approving final approval input.',
    '',
    `Total effects: ${report.summary.totalEffects}`,
    `Ready for approval: ${report.summary.readyForApprovalEffects}`,
    `Already approved: ${report.summary.alreadyApprovedEffects}`,
    `Approved deferrals: ${report.summary.approvedDeferrals}`,
    `Missing prerequisites: ${report.summary.missingPrerequisiteEffects}`,
    `Missing mobile Safari profiles: ${report.summary.missingMobileSafariProfiles}`,
    `Missing Chrome Android profiles: ${report.summary.missingChromeAndroidProfiles}`,
    `Missing red-team signoff: ${report.summary.missingRedTeamSignoff}`,
    '',
    'Final acceptance still requires final approval metadata and the strict verifier inputs.',
    '',
  ]

  const readyEffects = report.effects.filter((effect) => effect.status === 'ready-for-approval')
  if (readyEffects.length > 0) {
    lines.push('## Ready For Approval', '')
    for (const effect of readyEffects) {
      lines.push(
        `### ${effect.name} (\`${effect.effectId}\`)`,
        '',
        `Approval anchor: \`${effect.approvalAnchor}\``,
        `Remaining action: ${effect.remainingApprovalAction}`,
        '',
        'Recommended evidence:',
        '',
        ...effect.recommendedApprovalEvidence.map((evidence) => `- \`${evidence}\``),
        '',
      )
    }
  }

  const missingEffects = report.effects.filter((effect) => effect.status === 'missing-prerequisites')
  if (missingEffects.length > 0) {
    lines.push('## Missing Prerequisites', '')
    for (const effect of missingEffects.slice(0, 25)) {
      lines.push(
        `### ${effect.name} (\`${effect.effectId}\`)`,
        '',
        `Missing: ${effect.missingPrerequisites.map((prerequisite) => `\`${prerequisite}\``).join(', ')}`,
        `Remaining action: ${effect.remainingApprovalAction}`,
        '',
        ...productionApprovalCaptureHandoffMarkdown(effect.captureHandoff),
      )
    }
    if (missingEffects.length > 25) {
      lines.push(`...${missingEffects.length - 25} more effects with missing prerequisites`, '')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function productionApprovalCaptureHandoffMarkdown(
  handoff: PfxProductionApprovalCaptureHandoff | undefined,
): string[] {
  if (!handoff) return []
  const lines = [
    'Capture handoff:',
    '',
    ...(handoff.operatorLaunchUrl || handoff.operatorLaunchUrlTemplate
      ? [
          '- Operator workflow: open the launch page on the target phone, enter a concrete device label, then start platform or batch auto-run from that page.',
          ...(handoff.operatorLaunchUrl ? [`- Operator launch page: \`${handoff.operatorLaunchUrl}\``] : []),
          ...(handoff.operatorLaunchUrlTemplate
            ? [`- Operator launch template: \`${handoff.operatorLaunchUrlTemplate}\``]
            : []),
        ]
      : []),
    `- Mobile Safari output: \`${handoff.mobileSafari.outputFile}\``,
    `- Mobile Safari evidence: \`${handoff.mobileSafari.evidenceReference}\``,
    ...(handoff.mobileSafari.captureUrl ? [`- Mobile Safari capture: \`${handoff.mobileSafari.captureUrl}\``] : []),
    ...(handoff.mobileSafari.autoUploadUrlTemplate
      ? [`- Mobile Safari auto-upload template: \`${handoff.mobileSafari.autoUploadUrlTemplate}\``]
      : []),
    ...(handoff.mobileSafari.autoUploadRequiresDeviceLabel
      ? ['- Mobile Safari auto-upload device label: required (`profileDeviceLabel`)']
      : []),
    ...(handoff.mobileSafari.captureUrlReachability
      ? [`- Mobile Safari reachability: \`${handoff.mobileSafari.captureUrlReachability}\``]
      : []),
    ...(handoff.mobileSafari.captureUrlReachability === 'local-only'
      ? productionApprovalLocalOnlyCaptureWarnings('Mobile Safari')
      : []),
    `- Chrome Android output: \`${handoff.chromeAndroid.outputFile}\``,
    `- Chrome Android evidence: \`${handoff.chromeAndroid.evidenceReference}\``,
    ...(handoff.chromeAndroid.captureUrl ? [`- Chrome Android capture: \`${handoff.chromeAndroid.captureUrl}\``] : []),
    ...(handoff.chromeAndroid.autoUploadUrlTemplate
      ? [`- Chrome Android auto-upload template: \`${handoff.chromeAndroid.autoUploadUrlTemplate}\``]
      : []),
    ...(handoff.chromeAndroid.autoUploadRequiresDeviceLabel
      ? ['- Chrome Android auto-upload device label: required (`profileDeviceLabel`)']
      : []),
    ...(handoff.chromeAndroid.captureUrlReachability
      ? [`- Chrome Android reachability: \`${handoff.chromeAndroid.captureUrlReachability}\``]
      : []),
    ...(handoff.chromeAndroid.captureUrlReachability === 'local-only'
      ? productionApprovalLocalOnlyCaptureWarnings('Chrome Android')
      : []),
    '',
  ]
  return lines
}

function productionApprovalCaptureHandoffBaseUrl(
  handoff: PfxProductionApprovalCaptureHandoff,
): string | undefined {
  const candidates = [
    handoff.mobileSafari.captureUrl,
    handoff.mobileSafari.autoUploadUrlTemplate,
    handoff.mobileSafari.autoUploadUrl,
    handoff.chromeAndroid.captureUrl,
    handoff.chromeAndroid.autoUploadUrlTemplate,
    handoff.chromeAndroid.autoUploadUrl,
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      return new URL('/', candidate).toString()
    } catch {
      continue
    }
  }
  return undefined
}

function productionApprovalLocalOnlyCaptureWarnings(platformLabel: string): string[] {
  return [
    `- ${platformLabel} capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with \`${PFX_LAN_PRODUCTION_HANDOFF_COMMAND}\`.`,
    `- ${platformLabel} tunnel/base URL alternative: \`${PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\`.`,
  ]
}

export function createPfxProductionApprovalBatchSheet(
  options: PfxProductionApprovalBatchSheetOptions = {},
): PfxProductionApprovalBatchSheet {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const readiness = createPfxProductionApprovalReadinessReport(options)
  const batches: PfxProductionApprovalBatch[] = []

  for (let start = 0; start < readiness.effects.length; start += batchSize) {
    const effects = readiness.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    batches.push({
      batchId: `production-approval-batch-${String(batches.length + 1).padStart(3, '0')}`,
      firstRank: firstEffect.rank,
      lastRank: lastEffect.rank,
      effectCount: effects.length,
      outputFile: '.context/r3f-pfx-production-approvals.json',
      effectIds: effects.map((effect) => effect.effectId),
    })
  }

  const batch =
    batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? batches[0] : undefined)
  if (!batch) {
    throw new Error(`Production approval batch not found: ${options.batchId}`)
  }

  const readinessEffectsById = new Map(readiness.effects.map((effect) => [effect.effectId, effect]))
  const effects = batch.effectIds.flatMap((effectId): PfxProductionApprovalBatchSheetEffect[] => {
    const effect = readinessEffectsById.get(effectId)
    if (!effect) return []
    const readyForApproval = effect.status === 'ready-for-approval'
    return [
      {
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        approved: false,
        status: effect.status,
        missingPrerequisites: [...effect.missingPrerequisites],
        recommendedApprovalEvidence: [...effect.recommendedApprovalEvidence],
        approvalAnchor: effect.approvalAnchor,
        remainingApprovalAction: effect.remainingApprovalAction,
        ...(effect.captureHandoff ? { captureHandoff: effect.captureHandoff } : {}),
        outputFile: '.context/r3f-pfx-production-approvals.json',
        decisionOptions: readyForApproval ? ['production-ready'] : [],
        visualInspectionTargets: createVisualInspectionTargets(effect.effectId, 'final-approval'),
        ...(readyForApproval
          ? {
              approvalRowTemplate: {
                effectId: effect.effectId,
                decision: 'production-ready',
                approvedBy: 'TODO:final-production-approver',
                approvedAt: 'TODO:ISO-8601',
                rationale:
                  'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.',
                evidence: [...effect.recommendedApprovalEvidence],
              },
            }
          : {}),
      },
    ]
  })

  return {
    schema: 'game-bot.r3f-pfx-production-approval-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-production-approval-batch-sheet',
      sourceReadinessSchema: readiness.schema,
      outputFile: '.context/r3f-pfx-production-approvals.json',
      operatorChecklist: [
        'Review only the effects in this batch and write final decisions to the canonical production approvals output file.',
        'Treat this sheet as non-approving context; final acceptance credits only the production approvals manifest.',
        'Record production-ready only after taxonomy review, implementation, real-device profiles, and red-team signoff are complete for the same effect.',
        'Use approved-deferral only with explicit deferral and red-team evidence for the same effect.',
      ],
    },
    batch,
    effects,
  }
}

export function exportPfxProductionApprovalBatchSheetMarkdown(
  sheet: PfxProductionApprovalBatchSheet = createPfxProductionApprovalBatchSheet(),
): string {
  const lines = [
    '# R3F PFX Production Approval Batch Sheet',
    '',
    'Treat this handoff as non-approving final approval input.',
    '',
    `Batch: \`${sheet.batch.batchId}\``,
    `Ranks: ${sheet.batch.firstRank}-${sheet.batch.lastRank}`,
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
      `Status: \`${effect.status}\``,
      `Missing: ${
        effect.missingPrerequisites.length > 0
          ? effect.missingPrerequisites.map((prerequisite) => `\`${prerequisite}\``).join(', ')
          : 'none'
      }`,
      `Approval anchor: \`${effect.approvalAnchor}\``,
      `Remaining action: ${effect.remainingApprovalAction}`,
      '',
      ...productionApprovalCaptureHandoffMarkdown(effect.captureHandoff),
      '### Recommended Evidence',
      '',
      ...effect.recommendedApprovalEvidence.map((evidence) => `- \`${evidence}\``),
      '',
      '### Decision Options',
      '',
      ...(effect.decisionOptions.length > 0
        ? effect.decisionOptions.map((decision) => `- \`${decision}\``)
        : ['No final approval decision is available until prerequisites complete.']),
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
      ...(effect.approvalRowTemplate
        ? ['### Approval Row Template', '', '```json', JSON.stringify(effect.approvalRowTemplate, null, 2), '```']
        : [
            '### Approval Row Template',
            '',
            'Not available while production approval prerequisites are missing.',
          ]),
      '',
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function createPfxProductionApprovalBatchSheetIndex(
  options: PfxProductionApprovalBatchSheetIndexOptions = {},
): PfxProductionApprovalBatchSheetIndex {
  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/production-approval-batches')
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const readiness = createPfxProductionApprovalReadinessReport(options)
  const operatorLaunchHandoff = productionApprovalOperatorLaunchHandoff(options)
  const sheets: PfxProductionApprovalBatchSheetIndexSheet[] = []

  for (let start = 0; start < readiness.effects.length; start += batchSize) {
    const effects = readiness.effects.slice(start, start + batchSize)
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]
    const batchId = `production-approval-batch-${String(sheets.length + 1).padStart(3, '0')}`
    const outputFile = productionApprovalBatchSheetJsonOutputFile(batchId, outputDirectory)
    const markdownOutputFile = productionApprovalBatchSheetMarkdownOutputFile(batchId, outputDirectory)
    sheets.push({
      batchId,
      firstRank: firstEffect.rank,
      lastRank: lastEffect.rank,
      effectCount: effects.length,
      firstEffectId: firstEffect.effectId,
      lastEffectId: lastEffect.effectId,
      outputFile,
      markdownOutputFile,
      command: productionApprovalBatchSheetCommand(batchId, outputFile, markdownOutputFile),
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-production-approval-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalEffects: readiness.summary.totalEffects,
      outputDirectory,
      approvalStatus: 'non-approving-production-approval-batch-sheet-index',
      bulkCommand: productionApprovalBulkBatchSheetCommand(outputDirectory),
      ...(operatorLaunchHandoff.operatorLaunchUrl ? { operatorLaunchUrl: operatorLaunchHandoff.operatorLaunchUrl } : {}),
      ...(operatorLaunchHandoff.operatorLaunchUrlTemplate
        ? { operatorLaunchUrlTemplate: operatorLaunchHandoff.operatorLaunchUrlTemplate }
        : {}),
    },
    sheets,
  }
}

export function exportPfxProductionApprovalBatchSheetIndexMarkdown(
  index: PfxProductionApprovalBatchSheetIndex = createPfxProductionApprovalBatchSheetIndex(),
): string {
  const lines = [
    '# R3F PFX Production Approval Batch Sheet Index',
    '',
    'Treat this index as non-approving final approval guidance.',
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
      `- \`${sheet.batchId}\` (ranks ${sheet.firstRank}-${sheet.lastRank}, ${sheet.effectCount} effects, \`${sheet.firstEffectId}\` to \`${sheet.lastEffectId}\`): \`${sheet.markdownOutputFile}\``,
      `  - JSON: \`${sheet.outputFile}\``,
      `  - \`${sheet.command}\``,
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function createPfxProductionImplementationTemplate(): PfxProductionImplementationTemplate {
  const implementations = PFX_TAXONOMY.map((effect): PfxProductionImplementationReview => ({
    effectId: effect.id,
    status: 'pending',
    implementedBy: 'TODO:implementer',
    implementedAt: 'TODO:ISO-8601',
    sourcePath: `tools/3d-pfx-library/src/index.tsx#${effect.id}`,
    criteria: createPendingProductionImplementationCriteria(),
    blockerFindings: ['TODO:record implementation blockers or leave empty only after production-ready approval.'],
    notes: 'TODO:record production implementation notes, exported component evidence, and safe customization decisions.',
  }))

  return {
    schema: 'game-bot.r3f-pfx-production-implementation.v1',
    summary: {
      totalEffects: implementations.length,
      productionReadyEffects: implementations.filter((implementation) => implementation.status === 'production-ready')
        .length,
      productionReadyScope: 'implementation-code-evidence-only',
      pendingEffects: implementations.filter((implementation) => implementation.status === 'pending').length,
      requiredCriteria: [...PFX_PRODUCTION_IMPLEMENTATION_CRITERIA],
    },
    instructions: {
      approvalStatus: 'non-final-implementation-evidence',
      dossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      completionCommand: PFX_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'Open the matching dossier effect and candidate report entry before changing an implementation row.',
        'Mark every production implementation criterion pass/fail from concrete code, preview asset, docs, and budget evidence.',
        'Leave status pending or blocked unless all required criteria pass for this effect.',
        'Use an implementer identity that is distinct from the red-team reviewer; same-actor implementation and red-team signoff is rejected.',
        'Record blockerFindings for any failed criterion; leave blockerFindings empty only for production-ready rows.',
        'Save completed rows to .context/r3f-pfx-production-implementation.json and rerun the completion command.',
      ],
    },
    implementations,
  }
}

export function exportPfxProductionImplementationTemplateJson(
  template: PfxProductionImplementationTemplate = createPfxProductionImplementationTemplate(),
): string {
  return JSON.stringify(template, null, 2)
}

export function createPfxProductionImplementationDossier(): PfxProductionImplementationDossier {
  const presetsByEffectId = new Map(PFX_PRESETS.map((preset) => [preset.effectId, preset]))
  const effects = PFX_TAXONOMY.map((effect): PfxProductionImplementationDossierEffect => {
    const preset = presetsByEffectId.get(effect.id)
    if (!preset) {
      throw new Error(`Cannot create production implementation dossier for missing preset "${effect.id}"`)
    }
    const component = getPfxComponentDefinition(effect.id)
    if (!component) {
      throw new Error(`Cannot create production implementation dossier for missing component "${effect.id}"`)
    }
    const thumbnailAsset = createPfxThumbnailAsset(preset, effect)
    const clipAsset = createPfxClipAsset(preset, effect)

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      approvalStatus: 'needs-review',
      productionReady: false,
      sourcePath: `tools/3d-pfx-library/src/index.tsx#${effect.id}`,
      reviewAnchor: `.context/r3f-pfx-production-implementation.json#${effect.id}`,
      component: {
        componentName: component.componentName,
        importName: component.importName,
      },
      authoredRecipeId: preset.authoredRecipeId ?? 'missing-authored-recipe',
      controlKeys: PFX_CONTROL_DEFINITIONS.map((definition) => definition.key),
      previewAssets: {
        thumbnailFileName: thumbnailAsset.fileName,
        clipFileName: clipAsset.fileName,
      },
      mobileBudget: {
        performanceTier: preset.performance.tier,
        mobileSafety: preset.mobileSafety,
        maxParticles: preset.performance.maxParticles,
        maxDrawCalls: preset.performance.maxDrawCalls,
        textureMemoryKb: preset.performance.textureMemoryKb,
        expectedFrameCostMs: preset.performance.expectedFrameCostMs,
        overdrawRisk: preset.performance.overdrawRisk,
      },
      qualityScores: { ...preset.quality.scores },
      marketSourceFamilies: [...effect.marketSourceFamilies],
      marketSourceUrls: [...effect.marketSourceUrls],
      implementationFacts: {
        hasDropInComponent: true,
        hasAuthoredRecipe: Boolean(preset.authoredRecipeId),
        hasPreviewAssets: Boolean(thumbnailAsset.fileName && clipAsset.fileName),
        hasMobileBudget: preset.performance.maxParticles > 0 && preset.performance.maxDrawCalls > 0,
        hasQualityScores: PFX_QUALITY_RUBRIC_KEYS.every((key) => preset.quality.scores[key] > 0),
      },
      operatorChecklist: [
        `Inspect the drop-in R3F component ${component.componentName} exported for ${effect.id}.`,
        `Verify authored recipe ${preset.authoredRecipeId ?? 'missing-authored-recipe'} renders the ${effect.name} effect with the declared controls.`,
        `Confirm preview assets ${thumbnailAsset.fileName} and ${clipAsset.fileName} exist and match the effect.`,
        `Validate mobile budget tier ${preset.performance.tier}, ${preset.performance.maxParticles} max particles, ${preset.performance.maxDrawCalls} max draw calls, and ${preset.performance.overdrawRisk} overdraw risk.`,
        'Review developer docs, JSON preset export, and copy-paste component snippet for clean R3F integration.',
        `Write the final implementation decision to .context/r3f-pfx-production-implementation.json#${effect.id}.`,
      ],
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-production-implementation-dossier.v1',
    summary: {
      totalEffects: effects.length,
      effectsNeedingProductionApproval: effects.filter((effect) => !effect.productionReady).length,
      requiredCriteria: [...PFX_PRODUCTION_IMPLEMENTATION_CRITERIA],
    },
    instructions: {
      implementationTemplateFile: '.context/r3f-pfx-production-implementation-template.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      approvalStatus: 'non-approving-review-input',
      operatorChecklist: [
        'Use this dossier as reviewer context only; production approval is recorded exclusively in .context/r3f-pfx-production-implementation.json.',
        'Compare every dossier fact against the implementation template row before recording pass/fail criteria.',
        'Do not treat generated preview assets, docs, or ready-for-review status as final approval without human implementation review.',
      ],
    },
    effects,
  }
}

export function exportPfxProductionImplementationDossierJson(
  dossier: PfxProductionImplementationDossier = createPfxProductionImplementationDossier(),
): string {
  return JSON.stringify(dossier, null, 2)
}

function productionAcceptanceGapsForEffect(
  readinessEffect: PfxProductionReadinessEffect,
  approval: PfxProductionApproval | undefined,
  options: Pick<
    PfxProductionReadinessOptions,
    | 'realDeviceCaptureBaseUrl'
    | 'realDeviceCaptureBatchIdsByEffectId'
    | 'realDeviceProfiledEffectIds'
    | 'mobileSafariProfiledEffectIds'
    | 'chromeAndroidProfiledEffectIds'
  > = {},
): PfxProductionAcceptanceGap[] {
  if (readinessEffect.productionReady || readinessEffect.approvedDeferral) return []

  const gaps: PfxProductionAcceptanceGap[] = []
  if (!hasValidProductionApprovalMetadata(approval)) {
    const evidence = expectedProductionApprovalEvidence(readinessEffect.effectId)
    gaps.push({
      kind: 'approval-metadata',
      label: 'Final approval metadata',
      evidence,
      filePath: productionEvidenceFilePath(evidence),
    })
  }

  if (approval?.decision === 'approved-deferral') {
    if (!evidenceHasExpected(approval, 'taxonomy-review', readinessEffect.effectId)) {
      gaps.push(productionGapFromEvidence('taxonomy-review', readinessEffect.effectId))
    }
    if (
      !readinessEffect.redTeamApprovedDeferral ||
      !evidenceHasExpected(approval, 'approved-deferral', readinessEffect.effectId) ||
      !evidenceHasExpected(approval, 'red-team-signoff', readinessEffect.effectId)
    ) {
      gaps.push(productionGapFromEvidence('approved-deferral', readinessEffect.effectId))
    }
    return gaps
  }

  const approvalRowNeedsEvidence = approval?.decision === 'production-ready' && hasValidProductionApprovalMetadata(approval)
  const addEvidenceGapIfNeeded = (
    kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata' | 'approved-deferral'>,
    prerequisiteMet: boolean,
  ) => {
    if (!prerequisiteMet || (approvalRowNeedsEvidence && !evidenceHasExpected(approval, kind, readinessEffect.effectId))) {
      gaps.push(productionGapFromEvidence(kind, readinessEffect.effectId, options))
    }
  }
  const fullyProfiledEffectIds = new Set(options.realDeviceProfiledEffectIds ?? [])
  const mobileSafariProfiledEffectIds = new Set([
    ...fullyProfiledEffectIds,
    ...(options.mobileSafariProfiledEffectIds ?? []),
  ])
  const chromeAndroidProfiledEffectIds = new Set([
    ...fullyProfiledEffectIds,
    ...(options.chromeAndroidProfiledEffectIds ?? []),
  ])
  const addPlatformProfileGapIfNeeded = (
    kind: 'mobile-safari-profile' | 'chrome-android-profile',
    platformProfiled: boolean,
  ) => {
    const hasApprovalEvidence = evidenceHasExpected(approval, kind, readinessEffect.effectId)
    if (!platformProfiled || (approvalRowNeedsEvidence && !hasApprovalEvidence)) {
      gaps.push(productionGapFromEvidence(kind, readinessEffect.effectId, options))
    }
  }

  if (approvalRowNeedsEvidence && !evidenceHasExpected(approval, 'taxonomy-review', readinessEffect.effectId)) {
    gaps.push(productionGapFromEvidence('taxonomy-review', readinessEffect.effectId))
  }
  addEvidenceGapIfNeeded('production-implementation', readinessEffect.productionImplemented)
  addPlatformProfileGapIfNeeded('mobile-safari-profile', mobileSafariProfiledEffectIds.has(readinessEffect.effectId))
  addPlatformProfileGapIfNeeded('chrome-android-profile', chromeAndroidProfiledEffectIds.has(readinessEffect.effectId))
  addEvidenceGapIfNeeded('red-team-signoff', readinessEffect.redTeamSignedOff)

  return gaps
}

function productionGapFromEvidence(
  kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata'>,
  effectId: string,
  options: Pick<PfxProductionReadinessOptions, 'realDeviceCaptureBaseUrl' | 'realDeviceCaptureBatchIdsByEffectId'> = {},
): PfxProductionAcceptanceGap {
  const evidence = expectedProductionEvidence(kind, effectId)
  return {
    kind,
    label: productionGapLabel(kind),
    evidence,
    filePath: productionEvidenceFilePath(evidence),
    ...productionGapCaptureHandoff(kind, effectId, options),
  }
}

function productionGapCaptureHandoff(
  kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata'>,
  effectId: string,
  options: Pick<PfxProductionReadinessOptions, 'realDeviceCaptureBaseUrl' | 'realDeviceCaptureBatchIdsByEffectId'>,
): { captureHandoff?: PfxProductionApprovalCaptureHandoffPlatform } {
  if (!options.realDeviceCaptureBaseUrl && !options.realDeviceCaptureBatchIdsByEffectId) return {}
  if (kind === 'mobile-safari-profile') {
    return { captureHandoff: productionApprovalCaptureHandoff(effectId, options).mobileSafari }
  }
  if (kind === 'chrome-android-profile') {
    return { captureHandoff: productionApprovalCaptureHandoff(effectId, options).chromeAndroid }
  }
  return {}
}

function productionGapLabel(kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata'>): string {
  if (kind === 'taxonomy-review') return 'Market-reviewed taxonomy evidence'
  if (kind === 'production-implementation') return 'Production implementation evidence'
  if (kind === 'mobile-safari-profile') return 'Real-device mobile Safari profile'
  if (kind === 'chrome-android-profile') return 'Real-device Chrome Android profile'
  if (kind === 'approved-deferral') return 'Approved deferral evidence'
  return 'Adversarial red-team signoff'
}

function productionEvidenceFilePath(evidence: string): string {
  const value = evidence.slice(evidence.indexOf(':') + 1)
  const hashIndex = value.indexOf('#')
  return hashIndex >= 0 ? value.slice(0, hashIndex) : value
}

function countProductionGaps(
  effects: readonly PfxProductionAcceptanceGapEffect[],
  kind: PfxProductionAcceptanceGapKind,
): number {
  return effects.reduce((total, effect) => total + effect.gaps.filter((gap) => gap.kind === kind).length, 0)
}

function productionApprovalMissingPrerequisites(
  effect: PfxProductionReadinessEffect,
  taxonomyReviewed: boolean,
  mobileSafariProfiled: boolean,
  chromeAndroidProfiled: boolean,
): PfxProductionApprovalReadinessMissingPrerequisite[] {
  const missing: PfxProductionApprovalReadinessMissingPrerequisite[] = []
  if (!taxonomyReviewed) missing.push('taxonomy-review')
  if (effect.productionReady || effect.approvedDeferral) return missing
  if (!effect.productionImplemented) missing.push('production-implementation')
  if (!effect.realDeviceProfiled) {
    if (!mobileSafariProfiled && !chromeAndroidProfiled) {
      missing.push('real-device-profile')
    } else {
      if (!mobileSafariProfiled) missing.push('mobile-safari-profile')
      if (!chromeAndroidProfiled) missing.push('chrome-android-profile')
    }
  }
  if (!effect.redTeamSignedOff) missing.push('red-team-signoff')
  return missing
}

function hasMissingProductionApprovalDevicePrerequisite(
  missingPrerequisites: readonly PfxProductionApprovalReadinessMissingPrerequisite[],
): boolean {
  return (
    missingPrerequisites.includes('real-device-profile') ||
    missingPrerequisites.includes('mobile-safari-profile') ||
    missingPrerequisites.includes('chrome-android-profile')
  )
}

function productionApprovalReadinessStatus(
  effect: PfxProductionReadinessEffect,
  missingPrerequisites: readonly PfxProductionApprovalReadinessMissingPrerequisite[],
): PfxProductionApprovalReadinessStatus {
  if (missingPrerequisites.length > 0) return 'missing-prerequisites'
  if (effect.productionReady) return 'already-approved'
  if (effect.approvedDeferral) return 'approved-deferral'
  return 'ready-for-approval'
}

function productionApprovalRecommendedEvidence(
  effectId: string,
  status: PfxProductionApprovalReadinessStatus,
): string[] {
  if (status === 'approved-deferral') {
    return [
      `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effectId}`,
      `approved-deferral:.context/r3f-pfx-red-team-review.json#${effectId}`,
      `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effectId}`,
    ]
  }

  return [
    `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effectId}`,
    `production-implementation:.context/r3f-pfx-production-implementation.json#${effectId}`,
    `mobile-safari-profile:.context/mobile-safari/${effectId}.json`,
    `chrome-android-profile:.context/chrome-android/${effectId}.json`,
    `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effectId}`,
  ]
}

export function productionApprovalCaptureHandoff(
  effectId: string,
  options: Pick<PfxProductionReadinessOptions, 'realDeviceCaptureBaseUrl' | 'realDeviceCaptureBatchIdsByEffectId'>,
): PfxProductionApprovalCaptureHandoff {
  const mobileSafariCaptureUrl = externalEvidenceCaptureUrl(options.realDeviceCaptureBaseUrl, effectId, 'mobile-safari')
  const chromeAndroidCaptureUrl = externalEvidenceCaptureUrl(options.realDeviceCaptureBaseUrl, effectId, 'chrome-android')
  const mobileSafariAutoUploadUrl = externalEvidenceAutoUploadUrl(
    options.realDeviceCaptureBaseUrl,
    effectId,
    'mobile-safari',
    options.realDeviceCaptureBatchIdsByEffectId?.[effectId]?.['mobile-safari'],
  )
  const chromeAndroidAutoUploadUrl = externalEvidenceAutoUploadUrl(
    options.realDeviceCaptureBaseUrl,
    effectId,
    'chrome-android',
    options.realDeviceCaptureBatchIdsByEffectId?.[effectId]?.['chrome-android'],
  )
  const baseUrl = productionApprovalCaptureHandoffBaseUrl({
    mobileSafari: {
      outputFile: '',
      evidenceReference: '',
      ...(mobileSafariCaptureUrl ? { captureUrl: mobileSafariCaptureUrl } : {}),
      ...(mobileSafariAutoUploadUrl ? { autoUploadUrl: mobileSafariAutoUploadUrl } : {}),
    },
    chromeAndroid: {
      outputFile: '',
      evidenceReference: '',
      ...(chromeAndroidCaptureUrl ? { captureUrl: chromeAndroidCaptureUrl } : {}),
      ...(chromeAndroidAutoUploadUrl ? { autoUploadUrl: chromeAndroidAutoUploadUrl } : {}),
    },
  })
  const operatorLaunchUrl = baseUrl ? new URL('/__r3f-pfx-capture-operator', baseUrl).toString() : undefined

  return {
    ...(operatorLaunchUrl
      ? {
          operatorLaunchUrl,
          operatorLaunchUrlTemplate: `${operatorLaunchUrl}?profileDeviceLabel={profileDeviceLabel}`,
        }
      : {}),
    mobileSafari: {
      outputFile: `.context/mobile-safari/${effectId}.json`,
      evidenceReference: `mobile-safari-profile:.context/mobile-safari/${effectId}.json`,
      ...(mobileSafariCaptureUrl
        ? {
            captureUrl: mobileSafariCaptureUrl,
            captureUrlReachability: externalEvidenceCaptureUrlReachability(mobileSafariCaptureUrl),
          }
        : {}),
      ...(mobileSafariAutoUploadUrl
        ? {
            autoUploadUrl: mobileSafariAutoUploadUrl,
            autoUploadUrlTemplate: externalEvidenceAutoUploadUrlTemplate(mobileSafariAutoUploadUrl),
            autoUploadRequiresDeviceLabel: true,
          }
        : {}),
    },
    chromeAndroid: {
      outputFile: `.context/chrome-android/${effectId}.json`,
      evidenceReference: `chrome-android-profile:.context/chrome-android/${effectId}.json`,
      ...(chromeAndroidCaptureUrl
        ? {
            captureUrl: chromeAndroidCaptureUrl,
            captureUrlReachability: externalEvidenceCaptureUrlReachability(chromeAndroidCaptureUrl),
          }
        : {}),
      ...(chromeAndroidAutoUploadUrl
        ? {
            autoUploadUrl: chromeAndroidAutoUploadUrl,
            autoUploadUrlTemplate: externalEvidenceAutoUploadUrlTemplate(chromeAndroidAutoUploadUrl),
            autoUploadRequiresDeviceLabel: true,
          }
        : {}),
    },
  }
}

function productionApprovalRemainingAction(
  status: PfxProductionApprovalReadinessStatus,
  missingPrerequisites: readonly PfxProductionApprovalReadinessMissingPrerequisite[],
): string {
  if (status === 'already-approved') return 'No action required; final production approval metadata is present.'
  if (status === 'approved-deferral') return 'No action required; approved deferral metadata is present.'
  if (status === 'ready-for-approval') {
    return 'Record final production approval metadata after reviewing the recommended evidence.'
  }
  if (missingPrerequisites.length === 1 && missingPrerequisites[0] === 'taxonomy-review') {
    return 'Complete missing taxonomy review before approval.'
  }
  return `Complete missing ${formatProductionApprovalPrerequisites(missingPrerequisites)} before approval.`
}

function formatProductionApprovalPrerequisites(
  missingPrerequisites: readonly PfxProductionApprovalReadinessMissingPrerequisite[],
): string {
  const labels: Record<PfxProductionApprovalReadinessMissingPrerequisite, string> = {
    'taxonomy-review': 'taxonomy review',
    'production-implementation': 'production implementation',
    'real-device-profile': 'real-device profile',
    'mobile-safari-profile': 'Mobile Safari profile',
    'chrome-android-profile': 'Chrome Android profile',
    'red-team-signoff': 'red-team signoff',
  }
  const values = missingPrerequisites.map((prerequisite) => labels[prerequisite])
  if (values.length <= 1) return values[0] ?? 'prerequisites'
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
}

function createPendingTaxonomyReviewCriteria(): Record<
  PfxTaxonomyReviewCriterion,
  PfxTaxonomyReviewCriterionStatus
> {
  return Object.fromEntries(PFX_TAXONOMY_REVIEW_CRITERIA.map((criterion) => [criterion, 'pending'])) as Record<
    PfxTaxonomyReviewCriterion,
    PfxTaxonomyReviewCriterionStatus
  >
}

function createTaxonomyReviewPrompts(
  effect: PfxTaxonomyEffect,
  nearbyEffectIds: string[],
): Record<PfxTaxonomyReviewCriterion, string> {
  const sourceList = effect.marketSourceUrls.join(', ')
  return {
    'source-observed-need': `Confirm ${effect.id} is a source-observed game PFX need using ${sourceList}.`,
    'rank-justified': `Confirm rank ${effect.rank} for ${effect.id} against nearby effects ${nearbyEffectIds.join(', ') || 'none'}.`,
    'family-balanced': `Confirm ${effect.effectType} coverage and style affinities ${effect.styleAffinity.join(', ')} do not crowd out other production families.`,
    'variant-compatible': `Confirm ${effect.id} semantics fit ${effect.loopMode} ${effect.space} usage and gameplay cases ${effect.gameplayUseCases.join(', ')}.`,
    'production-critical-coverage': `Confirm ${effect.id} represents useful production coverage beyond decorative catalog padding.`,
    'not-duplicate': `Confirm ${effect.id} is not a duplicate of neighboring or same-family effects.`,
    'market-source-linked': `Confirm every market source URL for ${effect.id} is relevant and reachable: ${sourceList}.`,
  }
}

function sentenceCaseTaxonomyReviewCriterion(criterion: PfxTaxonomyReviewCriterion): string {
  const labels: Record<PfxTaxonomyReviewCriterion, string> = {
    'source-observed-need': 'Source observed need',
    'rank-justified': 'Rank justified',
    'family-balanced': 'Family balanced',
    'variant-compatible': 'Variant compatible',
    'production-critical-coverage': 'Production critical coverage',
    'not-duplicate': 'Not duplicate',
    'market-source-linked': 'Market source linked',
  }
  return labels[criterion]
}

function createTaxonomyReviewOperatorChecklist(effect: PfxTaxonomyEffect): string[] {
  return [
    'Open every marketSourceUrl and confirm the effect is a source-observed game PFX need.',
    'Compare rank against nearbyEffectIds and record whether rank is justified.',
    'Check family balance, variant compatibility, production-critical coverage, and duplicate risk.',
    `Copy the final decision into .context/r3f-pfx-taxonomy-review.json#${effect.id}.`,
  ]
}

function createPendingProductionImplementationCriteria(): Record<
  PfxProductionImplementationCriterion,
  PfxProductionImplementationCriterionStatus
> {
  return Object.fromEntries(PFX_PRODUCTION_IMPLEMENTATION_CRITERIA.map((criterion) => [criterion, 'pending'])) as Record<
    PfxProductionImplementationCriterion,
    PfxProductionImplementationCriterionStatus
  >
}

function evidenceHasExpected(
  approval: PfxProductionApproval | undefined,
  kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata'>,
  effectId: string,
): boolean {
  return approval?.evidence.includes(expectedProductionEvidence(kind, effectId)) === true
}
