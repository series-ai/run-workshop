import { PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND, PFX_FINAL_ACCEPTANCE_COMMAND, PFX_LAN_PRODUCTION_HANDOFF_COMMAND, createProductionBlockingFindings, createVisualInspectionTargets, duplicateValues, objectiveRequirement, requiredProductionActions, sentenceCaseWorkItem, trimPathTrailingSlash, valuesOutsideAcceptedEffectIds } from '../constants/04'
import { PFX_TAXONOMY, approvalSharesActorWithImplementationOrRedTeam, createEmptyReadinessStatusCounts, createFinalApprovalIndependenceFindings, createPartialRealDeviceProfileEvidenceFindings, createProductionApprovalRowFindings, createProductionImplementationRowFindings, createRedTeamReviewRowFindings, createRedTeamReviewerIndependenceFindings, createStandaloneEvidenceDuplicateFindings, createStandaloneEvidenceIdFindings, hasRequiredDeferralApprovalEvidence, hasRequiredProductionReadyApprovalEvidence, hasValidProductionApprovalMetadata, implementationAndReviewShareActor, isProductionImplementationReady, isRedTeamReviewComplete, resolveProductionReadinessStatus } from './01'
import type { PfxExternalEvidenceBatch, PfxExternalEvidenceBatchPlan, PfxExternalEvidenceBatchPlanOptions, PfxExternalEvidenceBatchSheet, PfxExternalEvidenceBatchSheetEffect, PfxExternalEvidenceBatchSheetIndex, PfxExternalEvidenceBatchSheetIndexOptions, PfxExternalEvidenceBatchSheetIndexSheet, PfxExternalEvidenceBatchSheetOptions, PfxExternalEvidenceNextReadyWorkItem, PfxExternalEvidenceWorkItem, PfxExternalEvidenceWorkItemCounts, PfxExternalEvidenceWorkItemId, PfxExternalEvidenceWorkOrder, PfxExternalEvidenceWorkOrderEffect, PfxExternalEvidenceWorkOrderOptions, PfxObjectiveReadinessReport, PfxObjectiveReadinessRequirement, PfxProductionApproval, PfxProductionApprovalCaptureHandoff, PfxProductionReadinessEffect, PfxProductionReadinessOptions, PfxProductionReadinessReport } from '../types/01'

export function createPfxProductionReadinessReport(
  options: PfxProductionReadinessOptions = {},
): PfxProductionReadinessReport {
  const approvals = options.approvals ?? []
  const approvalRowFindings = createProductionApprovalRowFindings(approvals)
  const implementations = options.implementations ?? []
  const implementationRowFindings = createProductionImplementationRowFindings(implementations)
  const redTeamReviews = options.redTeamReviews ?? []
  const redTeamReviewRowFindings = createRedTeamReviewRowFindings(redTeamReviews)
  const reviewerIndependenceFindings = createRedTeamReviewerIndependenceFindings(implementations, redTeamReviews)
  const finalApprovalIndependenceFindings = createFinalApprovalIndependenceFindings(
    approvals,
    implementations,
    redTeamReviews,
  )
  const duplicateApprovalEffectIds = new Set(duplicateValues(approvals.map((approval) => approval.effectId)))
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const approvalManifestHasUnknownRows = approvals.some((approval) => !acceptedEffectIds.has(approval.effectId))
  const approvalsByEffectId = approvalManifestHasUnknownRows
    ? new Map<string, PfxProductionApproval>()
    : new Map(approvals.map((approval) => [approval.effectId, approval]))
  const implementationsByEffectId = new Map(implementations.map((implementation) => [implementation.effectId, implementation]))
  const redTeamReviewsByEffectId = new Map(redTeamReviews.map((review) => [review.effectId, review]))
  const fullyRealDeviceProfiledEffectIds = new Set(options.realDeviceProfiledEffectIds ?? [])
  const mobileSafariProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...(options.mobileSafariProfiledEffectIds ?? []),
  ])
  const chromeAndroidProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...(options.chromeAndroidProfiledEffectIds ?? []),
  ])
  const taxonomyReviewedEffectIds = new Set(options.taxonomyReviewedEffectIds ?? [])
  const duplicateImplementationEffectIds = new Set(duplicateValues(implementations.map((implementation) => implementation.effectId)))
  const implementationManifestHasUnknownRows = implementations.some(
    (implementation) => !acceptedEffectIds.has(implementation.effectId),
  )
  const duplicateRedTeamReviewEffectIds = new Set(duplicateValues(redTeamReviews.map((review) => review.effectId)))
  const redTeamReviewManifestHasUnknownRows = redTeamReviews.some((review) => !acceptedEffectIds.has(review.effectId))
  const unknownTaxonomyReviewedEffectIds = valuesOutsideAcceptedEffectIds(
    options.taxonomyReviewedEffectIds ?? [],
    acceptedEffectIds,
  )
  const unknownRealDeviceProfiledEffectIds = valuesOutsideAcceptedEffectIds(
    options.realDeviceProfiledEffectIds ?? [],
    acceptedEffectIds,
  )
  const unknownMobileSafariProfiledEffectIds = valuesOutsideAcceptedEffectIds(
    options.mobileSafariProfiledEffectIds ?? [],
    acceptedEffectIds,
  )
  const unknownChromeAndroidProfiledEffectIds = valuesOutsideAcceptedEffectIds(
    options.chromeAndroidProfiledEffectIds ?? [],
    acceptedEffectIds,
  )
  const duplicateTaxonomyReviewedEffectIds = duplicateValues(options.taxonomyReviewedEffectIds ?? [])
  const duplicateRealDeviceProfiledEffectIds = duplicateValues(options.realDeviceProfiledEffectIds ?? [])
  const duplicateMobileSafariProfiledEffectIds = duplicateValues(options.mobileSafariProfiledEffectIds ?? [])
  const duplicateChromeAndroidProfiledEffectIds = duplicateValues(options.chromeAndroidProfiledEffectIds ?? [])
  const implementedEffectIds = new Set(
    implementationManifestHasUnknownRows
      ? []
      : implementations
          .filter(
            (implementation) =>
              !duplicateImplementationEffectIds.has(implementation.effectId) &&
              isProductionImplementationReady(implementation),
          )
          .map((implementation) => implementation.effectId),
  )
  const byReadinessStatus = createEmptyReadinessStatusCounts()
  const effects = PFX_TAXONOMY.map((effect): PfxProductionReadinessEffect => {
    const approval = duplicateApprovalEffectIds.has(effect.id) ? undefined : approvalsByEffectId.get(effect.id)
    const implementation = implementationsByEffectId.get(effect.id)
    const redTeamReview =
      redTeamReviewManifestHasUnknownRows || duplicateRedTeamReviewEffectIds.has(effect.id)
        ? undefined
        : redTeamReviewsByEffectId.get(effect.id)
    const independentRedTeamReview =
      redTeamReview != null &&
      isRedTeamReviewComplete(redTeamReview) &&
      !implementationAndReviewShareActor(implementation, redTeamReview)
    const mobileSafariProfiled = mobileSafariProfiledEffectIds.has(effect.id)
    const chromeAndroidProfiled = chromeAndroidProfiledEffectIds.has(effect.id)
    const realDeviceProfiled = mobileSafariProfiled && chromeAndroidProfiled
    const taxonomyReviewed = taxonomyReviewedEffectIds.has(effect.id)
    const redTeamSignedOff = independentRedTeamReview && redTeamReview.status === 'signed-off' && realDeviceProfiled
    const redTeamApprovedDeferral = independentRedTeamReview && redTeamReview.status === 'approved-deferral'
    const hasProductionImplementation = implementedEffectIds.has(effect.id)
    const hasFinalApprovalMetadata = hasValidProductionApprovalMetadata(approval)
    const hasProductionReadyApprovalEvidence = hasRequiredProductionReadyApprovalEvidence(approval)
    const hasDeferralApprovalEvidence = hasRequiredDeferralApprovalEvidence(approval)
    const hasIndependentFinalApproval =
      hasFinalApprovalMetadata && !approvalSharesActorWithImplementationOrRedTeam(approval, implementation, redTeamReview)
    const approvedDeferral =
      approval?.decision === 'approved-deferral' &&
      taxonomyReviewed &&
      hasIndependentFinalApproval &&
      hasDeferralApprovalEvidence &&
      redTeamApprovedDeferral
    const productionReady =
      approval?.decision === 'production-ready' &&
      taxonomyReviewed &&
      hasIndependentFinalApproval &&
      hasProductionReadyApprovalEvidence &&
      hasProductionImplementation &&
      realDeviceProfiled &&
      redTeamSignedOff
    const readinessStatus = resolveProductionReadinessStatus({
      productionReady,
      approvedDeferral,
      hasProductionImplementation,
      realDeviceProfiled,
      redTeamSignedOff,
      hasFinalApprovalMetadata,
      approval,
    })
    byReadinessStatus[readinessStatus] += 1

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      acceptanceStatus: effect.acceptanceStatus,
      readinessStatus,
      productionImplemented: hasProductionImplementation,
      productionReady,
      approvedDeferral,
      realDeviceProfiled,
      mobileSafariProfiled,
      chromeAndroidProfiled,
      redTeamSignedOff,
      redTeamApprovedDeferral,
      approval,
      requiredActions: requiredProductionActions({
        productionReady,
        approvedDeferral,
        hasProductionImplementation,
        realDeviceProfiled,
        mobileSafariProfiled,
        chromeAndroidProfiled,
        redTeamSignedOff,
        hasFinalApprovalMetadata,
        hasRequiredApprovalEvidence:
          approval == null ||
          (approval.decision === 'production-ready'
            ? hasProductionReadyApprovalEvidence
            : hasDeferralApprovalEvidence),
        taxonomyReviewed,
      }),
    }
  })
  const taxonomyReviewedEffects = effects.filter((effect) => taxonomyReviewedEffectIds.has(effect.effectId)).length
  const productionImplementedEffects = effects.filter((effect) => effect.productionImplemented).length
  const productionReadyEffects = effects.filter((effect) => effect.productionReady).length
  const approvedDeferrals = effects.filter((effect) => effect.approvedDeferral).length
  const realDeviceProfiledEffects = effects.filter((effect) => effect.realDeviceProfiled).length
  const missingMobileSafariProfiles = effects.filter((effect) => !mobileSafariProfiledEffectIds.has(effect.effectId)).length
  const missingChromeAndroidProfiles = effects.filter((effect) => !chromeAndroidProfiledEffectIds.has(effect.effectId)).length
  const redTeamSignedOffEffects = effects.filter((effect) => effect.redTeamSignedOff).length
  const effectsRequiringDecision = effects.length - productionReadyEffects - approvedDeferrals
  const blockingFindings = [
    ...approvalRowFindings,
    ...implementationRowFindings,
    ...redTeamReviewRowFindings,
    ...reviewerIndependenceFindings,
    ...finalApprovalIndependenceFindings,
    ...createStandaloneEvidenceIdFindings('taxonomy review evidence', unknownTaxonomyReviewedEffectIds),
    ...createStandaloneEvidenceIdFindings('real-device profile evidence', unknownRealDeviceProfiledEffectIds),
    ...createStandaloneEvidenceIdFindings('mobile Safari profile evidence', unknownMobileSafariProfiledEffectIds),
    ...createStandaloneEvidenceIdFindings('Chrome Android profile evidence', unknownChromeAndroidProfiledEffectIds),
    ...createStandaloneEvidenceDuplicateFindings('taxonomy review evidence', duplicateTaxonomyReviewedEffectIds),
    ...createStandaloneEvidenceDuplicateFindings('real-device profile evidence', duplicateRealDeviceProfiledEffectIds),
    ...createStandaloneEvidenceDuplicateFindings(
      'mobile Safari profile evidence',
      duplicateMobileSafariProfiledEffectIds,
    ),
    ...createStandaloneEvidenceDuplicateFindings(
      'Chrome Android profile evidence',
      duplicateChromeAndroidProfiledEffectIds,
    ),
    ...createPartialRealDeviceProfileEvidenceFindings(
      mobileSafariProfiledEffectIds,
      chromeAndroidProfiledEffectIds,
      acceptedEffectIds,
    ),
    ...createProductionBlockingFindings({
      effectsRequiringDecision,
      missingTaxonomyReview: effects.length - taxonomyReviewedEffects,
      missingProductionImplementations: effects.length - productionImplementedEffects - approvedDeferrals,
      missingDeviceProfiles: effects.length - realDeviceProfiledEffects,
      missingMobileSafariProfiles,
      missingChromeAndroidProfiles,
      missingRedTeamSignoff: effects.length - redTeamSignedOffEffects - approvedDeferrals,
    }),
  ]

  return {
    schema: 'game-bot.r3f-pfx-production-readiness.v1',
    passed: effectsRequiringDecision === 0 && blockingFindings.length === 0,
    summary: {
      totalEffects: effects.length,
      productionImplementedEffects,
      productionReadyEffects,
      approvedDeferrals,
      effectsRequiringDecision,
      realDeviceProfiledEffects,
      missingMobileSafariProfiles,
      missingChromeAndroidProfiles,
      redTeamSignedOffEffects,
      byReadinessStatus,
    },
    blockingFindings,
    effects,
  }
}

export function exportPfxProductionReadinessReportJson(
  report: PfxProductionReadinessReport = createPfxProductionReadinessReport(),
): string {
  return JSON.stringify(report, null, 2)
}

export function productionHandoffCommandMarkdownLines(): string[] {
  return [
    `LAN handoff command: \`${PFX_LAN_PRODUCTION_HANDOFF_COMMAND}\``,
    `Tunnel/base URL handoff command: \`${PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\``,
  ]
}

export function createPfxObjectiveReadinessReport(
  options: PfxProductionReadinessOptions & { taxonomyMarketReviewedEffects?: number } = {},
): PfxObjectiveReadinessReport {
  const readiness = createPfxProductionReadinessReport(options)
  const operatorLaunchActions = objectiveRealDeviceOperatorLaunchActions(options)
  const taxonomyReviewed = options.taxonomyMarketReviewedEffects === PFX_TAXONOMY.length
  const productionImplementationReady =
    readiness.summary.productionImplementedEffects + readiness.summary.approvedDeferrals === readiness.summary.totalEffects
  const realDeviceProfiled = readiness.summary.realDeviceProfiledEffects === readiness.summary.totalEffects
  const redTeamSignedOff = readiness.summary.redTeamSignedOffEffects === readiness.summary.totalEffects
  const finalAccepted = taxonomyReviewed && readiness.passed

  const requirements: PfxObjectiveReadinessRequirement[] = [
    localObjectiveRequirement(
      'research-scan',
      'Research Foundation',
      'Market and quality scan covers major VFX systems, asset libraries, Unity packs, and acceptance rubric inputs.',
      ['docs/r3f-pfx-library-market-scan.md'],
    ),
    objectiveRequirement({
      id: 'taxonomy-500',
      category: 'Research Foundation',
      requirement: 'The accepted taxonomy covers the 500 most common game PFX needs and has market-review approval.',
      evidence: [
        'docs/r3f-pfx-library-market-scan.md',
        '.context/r3f-pfx-taxonomy-review-template.json',
        '.context/r3f-pfx-taxonomy-review-dossier.json',
      ],
      complete: taxonomyReviewed,
      blockers: taxonomyReviewed ? [] : [`${PFX_TAXONOMY.length} effects lack market-reviewed taxonomy approval`],
      nextActions: taxonomyReviewed
        ? []
        : [
            'Fill .context/r3f-pfx-taxonomy-review.json, then run `npm --prefix tools/3d-pfx-library/viewer run verify:taxonomy` and `npm --prefix tools/3d-pfx-library/viewer run verify:acceptance`.',
          ],
    }),
    localObjectiveRequirement(
      'visual-browser-search-preview',
      'Core Product',
      'Developers can search and preview effects in a visual browser.',
      [
        'tools/3d-pfx-library/viewer/src/PfxBrowserApp.tsx',
        '.context/r3f-pfx-acceptance-evidence.json',
        '.context/r3f-pfx-definition-of-done-smoke.json',
      ],
    ),
    localObjectiveRequirement(
      'catalog-filters',
      'Core Product',
      'The browser exposes filters for type, use case, style, tier, mood, color, asset requirements, loop mode, space, and mobile safety.',
      ['tools/3d-pfx-library/viewer/src/PfxBrowserApp.tsx', 'tools/3d-pfx-library/viewer/scripts/smoke-browser.ts'],
    ),
    localObjectiveRequirement(
      'customization-ui',
      'Core Product',
      'The browser exposes the full live customization control surface with bounded validation evidence.',
      [
        '.context/r3f-pfx-control-safety-matrix.json',
        '.context/r3f-pfx-definition-of-done-smoke.json',
        'tools/3d-pfx-library/src/index.tsx',
      ],
    ),
    localObjectiveRequirement(
      'style-clusters',
      'Core Product',
      'All required art-style clusters are represented and backed by non-color render signatures.',
      ['.context/r3f-pfx-style-differentiation-matrix.json', 'tools/3d-pfx-library/src/index.tsx'],
    ),
    localObjectiveRequirement(
      'typed-r3f-components',
      'Core Product',
      'Every catalog effect has a typed drop-in R3F component definition and export path.',
      ['.context/r3f-pfx-export-cleanliness-audit.json', 'tools/3d-pfx-library/src/index.tsx'],
    ),
    localObjectiveRequirement(
      'json-and-snippet-export',
      'Core Product',
      'Developers can export JSON presets and copy-paste component snippets.',
      [
        '.context/r3f-pfx-export-cleanliness-audit.json',
        '.context/r3f-pfx-definition-of-done-smoke.json',
        'tools/3d-pfx-library/viewer/src/PfxBrowserApp.tsx',
      ],
    ),
    localObjectiveRequirement(
      'preview-assets',
      'Core Product',
      'Every effect has generated thumbnail, animated preview clip, style contact sheet, and control-extremes contact sheet evidence.',
      ['.context/r3f-pfx-preview-asset-audit.json', 'tools/3d-pfx-library/viewer/scripts/export-preview-assets.ts'],
    ),
    localObjectiveRequirement(
      'performance-metadata',
      'Performance Requirements',
      'Every preset declares tier, budgets, particle counts, frame-cost estimates, and overdraw risk.',
      ['.context/r3f-pfx-effect-performance-matrix.json', 'tools/3d-pfx-library/src/index.tsx'],
    ),
    localObjectiveRequirement(
      'runtime-optimization-contract',
      'Performance Requirements',
      'Runtime policy and per-effect audit cover capped DPR, atlas use, geometry reuse, LOD, deterministic seeds, tier caps, and reduced motion.',
      ['.context/r3f-pfx-mobile-runtime-policy.json', '.context/r3f-pfx-runtime-optimization-audit.json'],
    ),
    localObjectiveRequirement(
      'stress-and-local-profiling',
      'Performance Requirements',
      'Local browser profiling and deterministic stress scenarios exist for catalog-wide measurement.',
      ['.context/r3f-pfx-effect-performance-matrix.json', 'tools/3d-pfx-library/viewer/scripts/profile-browser.ts'],
    ),
    objectiveRequirement({
      id: 'mobile-real-device-performance',
      category: 'Performance Requirements',
      requirement: 'Effects have measured mobile Safari and Chrome Android WebGL evidence before production acceptance.',
      evidence: ['.context/r3f-pfx-real-device-capture-plan.json', '.context/r3f-pfx-real-device-capture-audit.json'],
      complete: realDeviceProfiled,
      blockers: realDeviceProfiled
        ? []
        : mobileProfileObjectiveBlockers(readiness.summary),
      nextActions: realDeviceProfiled
        ? []
        : [
            'Review real-device capture progress: .context/r3f-pfx-real-device-capture-batch-progress.md',
            'Review real-device capture batch sheet index: .context/r3f-pfx-real-device-capture-batch-sheet-index.md',
            'Start real-device capture server: npm --prefix tools/3d-pfx-library/viewer run serve:real-device',
            ...operatorLaunchActions,
            'Rerun real-device capture audit: npm --prefix tools/3d-pfx-library/viewer run verify:real-device',
          ],
    }),
    localObjectiveRequirement(
      'quality-rubric',
      'Quality Rubric',
      'Every effect is scored against the full game-readiness, performance, integration, customization, style, docs, export, and red-team rubric.',
      ['tools/3d-pfx-library/src/index.tsx', '.context/r3f-pfx-developer-docs.json'],
    ),
    localObjectiveRequirement(
      'developer-documentation',
      'Core Product',
      'Every effect has developer documentation with snippets, JSON, budgets, quality scores, and production caveats.',
      ['.context/r3f-pfx-developer-docs.json'],
    ),
    objectiveRequirement({
      id: 'production-implementation-approval',
      category: 'Definition of Done',
      requirement: 'Every accepted taxonomy effect has production-quality implementation approval or an explicitly approved deferral.',
      evidence: [
        '.context/r3f-pfx-production-implementation-template.json',
        '.context/r3f-pfx-production-implementation-dossier.json',
        '.context/r3f-pfx-production-implementation-candidates.json',
      ],
      complete: productionImplementationReady,
      blockers: productionImplementationReady
        ? []
        : [
            `${PFX_TAXONOMY.length - readiness.summary.productionImplementedEffects - readiness.summary.approvedDeferrals} effects lack production implementation or approved deferral`,
          ],
      nextActions: productionImplementationReady
        ? []
        : ['Fill .context/r3f-pfx-production-implementation.json with final criterion decisions.'],
    }),
    objectiveRequirement({
      id: 'adversarial-red-team-signoff',
      category: 'Adversarial Red Team',
      requirement: 'The adversarial red team signs off or all blocking findings are resolved for every effect.',
      evidence: ['docs/r3f-pfx-library-red-team.md', '.context/r3f-pfx-red-team-review-template.json'],
      complete: redTeamSignedOff,
      blockers: redTeamSignedOff
        ? []
        : [`${PFX_TAXONOMY.length - readiness.summary.redTeamSignedOffEffects} effects lack red-team sign-off`],
      nextActions: redTeamSignedOff
        ? []
        : [
            'Review red-team dossier: .context/r3f-pfx-red-team-dossier.md',
            'Review red-team batch sheet index: .context/r3f-pfx-red-team-review-batch-sheet-index.md',
            'Complete red-team signoff in .context/r3f-pfx-red-team-review.json',
            'Rerun red-team verifier: npm --prefix tools/3d-pfx-library/viewer run verify:red-team',
            'Rerun acceptance verifier: npm --prefix tools/3d-pfx-library/viewer run verify:acceptance',
          ],
    }),
    objectiveRequirement({
      id: 'definition-of-done',
      category: 'Definition of Done',
      requirement:
        'A developer can browse, tune, export, drop effects into a game, and trust production mobile-browser performance.',
      evidence: [
        '.context/r3f-pfx-definition-of-done-smoke.json',
        '.context/r3f-pfx-production-gap-audit.json',
        '.context/r3f-pfx-production-approval-template.json',
        '.context/r3f-pfx-production-approval-readiness.json',
      ],
      complete: finalAccepted,
      blockers: finalAccepted
        ? []
        : [
            'Final acceptance remains false until taxonomy, implementation, real-device, red-team, and approval metadata gates pass.',
          ],
      nextActions: finalAccepted
        ? []
        : [
            'Review production approval readiness: .context/r3f-pfx-production-approval-readiness.md',
            'Review production approval batch sheet index: .context/r3f-pfx-production-approval-batch-sheet-index.md',
            'Complete final production approvals in .context/r3f-pfx-production-approvals.json',
            'Rerun final acceptance: npm --prefix tools/3d-pfx-library/viewer run verify:final-acceptance',
          ],
    }),
  ]

  const locallySatisfiedRequirements = requirements.filter((requirement) => requirement.status === 'locally-satisfied').length
  const externalEvidenceRequiredRequirements = requirements.filter(
    (requirement) => requirement.status === 'external-evidence-required',
  ).length
  const blockedRequirements = requirements.filter((requirement) => requirement.blockers.length > 0).length

  return {
    schema: 'game-bot.r3f-pfx-objective-readiness.v1',
    approvalStatus: 'non-approving-objective-readiness',
    passed: externalEvidenceRequiredRequirements === 0 && blockedRequirements === 0,
    summary: {
      totalEffects: PFX_TAXONOMY.length,
      totalRequirements: requirements.length,
      locallySatisfiedRequirements,
      externalEvidenceRequiredRequirements,
      blockedRequirements,
    },
    finalAcceptanceCommand: PFX_FINAL_ACCEPTANCE_COMMAND,
    requirements,
  }
}

function objectiveRealDeviceOperatorLaunchActions(options: PfxProductionReadinessOptions): string[] {
  const handoff = productionApprovalOperatorLaunchHandoff(options)
  return [
    ...(handoff.operatorLaunchUrl ? [`Open real-device operator launch page: ${handoff.operatorLaunchUrl}`] : []),
    ...(handoff.operatorLaunchUrlTemplate
      ? [`Use operator launch template after replacing {profileDeviceLabel}: ${handoff.operatorLaunchUrlTemplate}`]
      : []),
    ...(handoff.operatorStatusUrlTemplate
      ? [`Poll operator status JSON after replacing {profileDeviceLabel}: ${handoff.operatorStatusUrlTemplate}`]
      : []),
  ]
}

export function exportPfxObjectiveReadinessReportMarkdown(
  report: PfxObjectiveReadinessReport = createPfxObjectiveReadinessReport(),
): string {
  const lines = [
    '# R3F PFX Objective Readiness',
    '',
    'Treat this handoff as non-approving goal readiness input.',
    '',
    `Approval status: \`${report.approvalStatus}\``,
    `Passed: \`${String(report.passed)}\``,
    `Total effects: ${report.summary.totalEffects}`,
    `Total requirements: ${report.summary.totalRequirements}`,
    `Local requirements satisfied: ${report.summary.locallySatisfiedRequirements}`,
    `External evidence required: ${report.summary.externalEvidenceRequiredRequirements}`,
    `Blocked requirements: ${report.summary.blockedRequirements}`,
    '',
    'Final acceptance command:',
    '',
    `\`${report.finalAcceptanceCommand}\``,
    '',
  ]

  appendObjectiveReadinessSection(
    lines,
    'External Evidence Required',
    report.requirements.filter((requirement) => requirement.status === 'external-evidence-required'),
  )
  appendObjectiveReadinessSection(
    lines,
    'Locally Satisfied',
    report.requirements.filter((requirement) => requirement.status === 'locally-satisfied'),
  )

  return `${lines.join('\n').trimEnd()}\n`
}

function appendObjectiveReadinessSection(
  lines: string[],
  title: string,
  requirements: PfxObjectiveReadinessRequirement[],
): void {
  if (requirements.length === 0) return

  lines.push(`## ${title}`, '')
  for (const requirement of requirements) {
    lines.push(
      `### ${requirement.category}: ${requirement.requirement}`,
      '',
      `Requirement ID: \`${requirement.id}\``,
      `Status: \`${requirement.status}\``,
      '',
    )

    if (requirement.evidence.length > 0) {
      lines.push('Evidence:', '', ...requirement.evidence.map((evidence) => `- \`${evidence}\``), '')
    }
    if (requirement.blockers.length > 0) {
      lines.push('Blockers:', '', ...requirement.blockers.map((blocker) => `- ${blocker}`), '')
    }
    if (requirement.nextActions.length > 0) {
      lines.push('Next actions:', '', ...requirement.nextActions.map((action) => `- ${action}`), '')
    }
  }
}

function localObjectiveRequirement(
  id: string,
  category: string,
  requirement: string,
  evidence: string[],
): PfxObjectiveReadinessRequirement {
  return {
    id,
    category,
    requirement,
    status: 'locally-satisfied',
    evidence,
    blockers: [],
    nextActions: [],
  }
}

function mobileProfileObjectiveBlockers(summary: PfxProductionReadinessReport['summary']): string[] {
  const missingDeviceProfiles = summary.totalEffects - summary.realDeviceProfiledEffects
  if (missingDeviceProfiles <= 0) return []
  if (
    summary.missingMobileSafariProfiles === missingDeviceProfiles &&
    summary.missingChromeAndroidProfiles === missingDeviceProfiles
  ) {
    return [`${missingDeviceProfiles} effects lack mobile Safari and Chrome Android profiling evidence`]
  }
  return [
    ...(summary.missingMobileSafariProfiles > 0
      ? [`${summary.missingMobileSafariProfiles} effects lack mobile Safari profiling evidence`]
      : []),
    ...(summary.missingChromeAndroidProfiles > 0
      ? [`${summary.missingChromeAndroidProfiles} effects lack Chrome Android profiling evidence`]
      : []),
  ]
}

export function createPfxExternalEvidenceWorkOrder(
  options: PfxExternalEvidenceWorkOrderOptions = {},
): PfxExternalEvidenceWorkOrder {
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const taxonomyInputEffectIds = options.taxonomyReviewedEffectIds ?? []
  const realDeviceInputEffectIds = options.realDeviceProfiledEffectIds ?? []
  const mobileSafariInputEffectIds = options.mobileSafariProfiledEffectIds ?? []
  const chromeAndroidInputEffectIds = options.chromeAndroidProfiledEffectIds ?? []
  const taxonomyReviewedEffectIds = new Set(taxonomyInputEffectIds)
  const fullyRealDeviceProfiledEffectIds = new Set(realDeviceInputEffectIds)
  const mobileSafariProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...mobileSafariInputEffectIds,
  ])
  const chromeAndroidProfiledEffectIds = new Set([
    ...fullyRealDeviceProfiledEffectIds,
    ...chromeAndroidInputEffectIds,
  ])
  const blockingFindings = [
    ...createStandaloneEvidenceIdFindings(
      'taxonomy review evidence',
      valuesOutsideAcceptedEffectIds(taxonomyInputEffectIds, acceptedEffectIds),
    ),
    ...createStandaloneEvidenceDuplicateFindings('taxonomy review evidence', duplicateValues(taxonomyInputEffectIds)),
    ...createStandaloneEvidenceIdFindings(
      'real-device profile evidence',
      valuesOutsideAcceptedEffectIds(realDeviceInputEffectIds, acceptedEffectIds),
    ),
    ...createStandaloneEvidenceDuplicateFindings(
      'real-device profile evidence',
      duplicateValues(realDeviceInputEffectIds),
    ),
    ...createStandaloneEvidenceIdFindings(
      'mobile Safari profile evidence',
      valuesOutsideAcceptedEffectIds(mobileSafariInputEffectIds, acceptedEffectIds),
    ),
    ...createStandaloneEvidenceDuplicateFindings(
      'mobile Safari profile evidence',
      duplicateValues(mobileSafariInputEffectIds),
    ),
    ...createStandaloneEvidenceIdFindings(
      'Chrome Android profile evidence',
      valuesOutsideAcceptedEffectIds(chromeAndroidInputEffectIds, acceptedEffectIds),
    ),
    ...createStandaloneEvidenceDuplicateFindings(
      'Chrome Android profile evidence',
      duplicateValues(chromeAndroidInputEffectIds),
    ),
    ...createRealDeviceCaptureBatchMapFindings(options.realDeviceCaptureBatchIdsByEffectId ?? {}, acceptedEffectIds),
  ]
  const readiness = createPfxProductionReadinessReport(options)
  const readinessByEffectId = new Map(readiness.effects.map((effect) => [effect.effectId, effect]))

  const effects = PFX_TAXONOMY.map((effect): PfxExternalEvidenceWorkOrderEffect => {
    const readinessEffect = readinessByEffectId.get(effect.id)
    const completedWorkItemIds = new Set<PfxExternalEvidenceWorkItemId>([
      ...(taxonomyReviewedEffectIds.has(effect.id) ? (['taxonomy-review'] as const) : []),
      ...(readinessEffect?.productionImplemented || readinessEffect?.approvedDeferral
        ? (['production-implementation'] as const)
        : []),
      ...(mobileSafariProfiledEffectIds.has(effect.id) ? (['mobile-safari-capture'] as const) : []),
      ...(chromeAndroidProfiledEffectIds.has(effect.id) ? (['chrome-android-capture'] as const) : []),
      ...(readinessEffect?.redTeamSignedOff ? (['red-team-review'] as const) : []),
      ...(readinessEffect?.productionReady || readinessEffect?.approvedDeferral ? (['final-approval'] as const) : []),
    ])
    const allWorkItems: PfxExternalEvidenceWorkItem[] = [
      externalEvidenceWorkItem(
        'taxonomy-review',
        'Market-reviewed taxonomy row',
        '.context/r3f-pfx-taxonomy-review.json',
        `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effect.id}`,
        [
          'Confirm market-source observed need, rank, family balance, variant compatibility, production-critical coverage, duplicate risk, and source links.',
          'Set every taxonomy criterion to pass, clear blockerFindings, and set status to market-reviewed.',
        ],
        completedWorkItemIds,
      ),
      externalEvidenceWorkItem(
        'production-implementation',
        'Production implementation or approved deferral row',
        '.context/r3f-pfx-production-implementation.json',
        `production-implementation:.context/r3f-pfx-production-implementation.json#${effect.id}`,
        [
          'Record final implementer metadata and criterion-level decisions for drop-in component, authored recipe, controls, mobile budget, previews, and docs.',
          'Use approved deferral only when the red-team review records an explicit deferral for the same effect.',
        ],
        completedWorkItemIds,
      ),
      externalEvidenceWorkItem(
        'mobile-safari-capture',
        'Mobile Safari real-device profile',
        `.context/mobile-safari/${effect.id}.json`,
        `mobile-safari-profile:.context/mobile-safari/${effect.id}.json`,
        [
          'Open the matching export:capture-plan URL on a real mobile Safari device.',
          'Save the data-profile-json report with real-device metadata, matching runtime policy, mobile viewport, available WebGL, and passing thresholds.',
        ],
        completedWorkItemIds,
        externalEvidenceCaptureUrl(options.realDeviceCaptureBaseUrl, effect.id, 'mobile-safari'),
        externalEvidenceAutoUploadUrl(
          options.realDeviceCaptureBaseUrl,
          effect.id,
          'mobile-safari',
          options.realDeviceCaptureBatchIdsByEffectId?.[effect.id]?.['mobile-safari'],
        ),
      ),
      externalEvidenceWorkItem(
        'chrome-android-capture',
        'Chrome Android real-device profile',
        `.context/chrome-android/${effect.id}.json`,
        `chrome-android-profile:.context/chrome-android/${effect.id}.json`,
        [
          'Open the matching export:capture-plan URL on a real Chrome Android device.',
          'Save the data-profile-json report with real-device metadata, matching runtime policy, mobile viewport, available WebGL, and passing thresholds.',
        ],
        completedWorkItemIds,
        externalEvidenceCaptureUrl(options.realDeviceCaptureBaseUrl, effect.id, 'chrome-android'),
        externalEvidenceAutoUploadUrl(
          options.realDeviceCaptureBaseUrl,
          effect.id,
          'chrome-android',
          options.realDeviceCaptureBatchIdsByEffectId?.[effect.id]?.['chrome-android'],
        ),
      ),
      externalEvidenceWorkItem(
        'red-team-review',
        'Adversarial red-team signoff',
        '.context/r3f-pfx-red-team-review.json',
        `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effect.id}`,
        [
          'Review taxonomy comprehensiveness, game readiness, mobile evidence, style fidelity, control safety, export cleanliness, and documentation sufficiency.',
          'Use a red-team reviewer identity that is distinct from the matching production implementation actor.',
          'Set every red-team criterion to pass, clear blockerFindings, and set status to signed-off or approved-deferral.',
          'Record substantive adversarial notes covering the evidence attacked, resolved findings, or deferral rationale; rubber-stamp notes are rejected.',
        ],
        completedWorkItemIds,
        undefined,
        undefined,
        createVisualInspectionTargets(effect.id, 'red-team'),
      ),
      externalEvidenceWorkItem(
        'final-approval',
        'Final production approval metadata',
        '.context/r3f-pfx-production-approvals.json',
        expectedProductionApprovalEvidence(effect.id),
        [
          'Record named approver, ISO timestamp, rationale, and canonical evidence references for taxonomy review, implementation, both mobile profiles, and red-team signoff.',
          'Use a final approver identity distinct from the implementation actor and red-team reviewer.',
          'Run the final acceptance command after all rows are complete.',
        ],
        completedWorkItemIds,
        undefined,
        undefined,
        createVisualInspectionTargets(effect.id, 'final-approval'),
      ),
    ]
    const workItems = allWorkItems.filter((item) => !completedWorkItemIds.has(item.id))

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      openWorkItemCount: workItems.length,
      workItems,
    }
  })
  const countWorkItems = (id: PfxExternalEvidenceWorkItemId) =>
    effects.reduce((total, effect) => total + effect.workItems.filter((item) => item.id === id).length, 0)
  const openWorkItems = effects.flatMap((effect) => effect.workItems)
  const statusCounts = countExternalEvidenceWorkItemStatuses(openWorkItems)
  const captureUrlCounts = countExternalEvidenceCaptureUrls(openWorkItems)
  const readyCaptureUrlCounts = countReadyExternalEvidenceCaptureUrls(openWorkItems)
  const autoUploadUrlCounts = countExternalEvidenceAutoUploadUrls(effects)
  const nextReadyWorkItem = findNextReadyExternalEvidenceWorkItem(effects)

  return {
    schema: 'game-bot.r3f-pfx-external-evidence-work-order.v1',
    blockingFindings,
    summary: {
      totalEffects: effects.length,
      totalOpenWorkItems: effects.reduce((total, effect) => total + effect.openWorkItemCount, 0),
      readyWorkItems: statusCounts.readyWorkItems,
      blockedWorkItems: statusCounts.blockedWorkItems,
      taxonomyReviewItems: countWorkItems('taxonomy-review'),
      productionImplementationItems: countWorkItems('production-implementation'),
      mobileSafariCaptureItems: countWorkItems('mobile-safari-capture'),
      chromeAndroidCaptureItems: countWorkItems('chrome-android-capture'),
      captureUrlItems: captureUrlCounts.captureUrlItems,
      networkReachableCaptureUrlItems: captureUrlCounts.networkReachableCaptureUrlItems,
      localOnlyCaptureUrlItems: captureUrlCounts.localOnlyCaptureUrlItems,
      missingCaptureUrlItems: captureUrlCounts.missingCaptureUrlItems,
      readyCaptureUrlItems: readyCaptureUrlCounts.readyCaptureUrlItems,
      networkReachableReadyCaptureUrlItems: readyCaptureUrlCounts.networkReachableReadyCaptureUrlItems,
      localOnlyReadyCaptureUrlItems: readyCaptureUrlCounts.localOnlyReadyCaptureUrlItems,
      missingReadyCaptureUrlItems: readyCaptureUrlCounts.missingReadyCaptureUrlItems,
      autoUploadUrlItems: autoUploadUrlCounts.autoUploadUrlItems,
      autoUploadRequiresDeviceLabelItems: autoUploadUrlCounts.autoUploadRequiresDeviceLabelItems,
      batchScopedAutoUploadUrlItems: autoUploadUrlCounts.batchScopedAutoUploadUrlItems,
      readyBatchScopedAutoUploadUrlItems: autoUploadUrlCounts.readyBatchScopedAutoUploadUrlItems,
      missingBatchScopedAutoUploadUrlItems: autoUploadUrlCounts.missingBatchScopedAutoUploadUrlItems,
      redTeamReviewItems: countWorkItems('red-team-review'),
      finalApprovalItems: countWorkItems('final-approval'),
      nextReadyWorkItem,
    },
    instructions: {
      approvalStatus: 'non-approving-external-evidence-work-order',
      finalAcceptanceCommand: PFX_FINAL_ACCEPTANCE_COMMAND,
      operatorChecklist: [
        'Complete work items in order: taxonomy review, implementation or deferral, real-device capture, red-team review, final approval.',
        'Treat this work order as a queue only; it does not satisfy any final acceptance gate.',
        'Regenerate objective readiness and final acceptance evidence after completing each evidence stream.',
      ],
    },
    effects,
  }
}

function externalEvidenceWorkItem(
  id: PfxExternalEvidenceWorkItemId,
  label: string,
  outputFile: string,
  evidenceReference: string,
  instructions: string[],
  completedWorkItemIds: Set<PfxExternalEvidenceWorkItemId>,
  captureUrl?: string,
  autoUploadUrl?: string,
  visualInspectionTargets?: PfxExternalEvidenceWorkItem['visualInspectionTargets'],
): PfxExternalEvidenceWorkItem {
  const blockedBy = externalEvidencePrerequisites(id).filter((prerequisite) => !completedWorkItemIds.has(prerequisite))
  const captureUrlReachability = captureUrl ? externalEvidenceCaptureUrlReachability(captureUrl) : undefined
  const autoUploadUrlTemplate = autoUploadUrl ? externalEvidenceAutoUploadUrlTemplate(autoUploadUrl) : undefined
  const operatorLaunchUrl = autoUploadUrl
    ? new URL('/__r3f-pfx-capture-operator', autoUploadUrl).toString()
    : captureUrl
      ? new URL('/__r3f-pfx-capture-operator', captureUrl).toString()
      : undefined
  return {
    id,
    label,
    outputFile,
    evidenceReference,
    ...(captureUrl && captureUrlReachability ? { captureUrl, captureUrlReachability } : {}),
    ...(autoUploadUrl ? { autoUploadUrl, autoUploadRequiresDeviceLabel: true, autoUploadUrlTemplate } : {}),
    ...(operatorLaunchUrl
      ? {
          operatorLaunchUrl,
          operatorLaunchUrlTemplate: `${operatorLaunchUrl}?profileDeviceLabel={profileDeviceLabel}`,
        }
      : {}),
    ...(visualInspectionTargets ? { visualInspectionTargets } : {}),
    prerequisiteStatus: blockedBy.length > 0 ? 'blocked' : 'ready',
    blockedBy,
    instructions:
      captureUrlReachability === 'local-only'
        ? [
            ...instructions,
            `This capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with \`${PFX_LAN_PRODUCTION_HANDOFF_COMMAND}\`.`,
            `Tunnel/base URL alternative: \`${PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\`.`,
          ]
        : instructions,
  }
}

export function externalEvidenceCaptureUrl(
  baseUrl: string | undefined,
  effectId: string,
  platform: 'mobile-safari' | 'chrome-android',
): string | undefined {
  if (!baseUrl) return undefined
  const url = new URL(baseUrl)
  url.searchParams.set('profileEffectIds', effectId)
  url.searchParams.set('profilePlatform', platform)
  return url.toString()
}

export function externalEvidenceAutoUploadUrl(
  baseUrl: string | undefined,
  effectId: string,
  platform: 'mobile-safari' | 'chrome-android',
  batchId?: string,
): string | undefined {
  if (!baseUrl) return undefined
  const url = new URL('/__r3f-pfx-capture-next', baseUrl)
  url.searchParams.set('platform', platform)
  url.searchParams.set('profileAutoUpload', '1')
  if (batchId) url.searchParams.set('batchId', batchId)
  url.searchParams.set('effectId', effectId)
  return url.toString()
}

export function externalEvidenceAutoUploadUrlTemplate(autoUploadUrl: string): string {
  return `${autoUploadUrl}${autoUploadUrl.includes('?') ? '&' : '?'}profileDeviceLabel={profileDeviceLabel}`
}

export function externalEvidenceCaptureUrlReachability(captureUrl: string): 'network-reachable' | 'local-only' {
  const hostname = new URL(captureUrl).hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '0.0.0.0' || hostname === '::1' || hostname === '[::1]') {
    return 'local-only'
  }
  if (hostname.startsWith('127.')) return 'local-only'
  return 'network-reachable'
}

function externalEvidencePrerequisites(id: PfxExternalEvidenceWorkItemId): PfxExternalEvidenceWorkItemId[] {
  if (id === 'taxonomy-review') return []
  if (id === 'production-implementation') return ['taxonomy-review']
  if (id === 'mobile-safari-capture' || id === 'chrome-android-capture') {
    return ['taxonomy-review', 'production-implementation']
  }
  if (id === 'red-team-review') {
    return ['taxonomy-review', 'production-implementation', 'mobile-safari-capture', 'chrome-android-capture']
  }
  return [
    'taxonomy-review',
    'production-implementation',
    'mobile-safari-capture',
    'chrome-android-capture',
    'red-team-review',
  ]
}

export function exportPfxExternalEvidenceWorkOrderMarkdown(
  workOrder: PfxExternalEvidenceWorkOrder = createPfxExternalEvidenceWorkOrder(),
): string {
  const lines = [
    '# R3F PFX External Evidence Work Order',
    '',
    'Treat this handoff as non-approving reviewer guidance.',
    '',
    `Total effects: ${workOrder.summary.totalEffects}`,
    `Total open work items: ${workOrder.summary.totalOpenWorkItems}`,
    `Ready work items: ${workOrder.summary.readyWorkItems}`,
    `Blocked work items: ${workOrder.summary.blockedWorkItems}`,
    `Capture URL work items: ${workOrder.summary.captureUrlItems}`,
    `Network-reachable capture URLs: ${workOrder.summary.networkReachableCaptureUrlItems}`,
    `Local-only capture URLs: ${workOrder.summary.localOnlyCaptureUrlItems}`,
    `Missing capture URLs: ${workOrder.summary.missingCaptureUrlItems}`,
    `Ready capture URL work items: ${workOrder.summary.readyCaptureUrlItems}`,
    `Network-reachable ready capture URLs: ${workOrder.summary.networkReachableReadyCaptureUrlItems}`,
    `Local-only ready capture URLs: ${workOrder.summary.localOnlyReadyCaptureUrlItems}`,
    `Missing ready capture URLs: ${workOrder.summary.missingReadyCaptureUrlItems}`,
    ...(workOrder.summary.nextReadyWorkItem
      ? [
          `Next ready item: ${workOrder.summary.nextReadyWorkItem.name} (\`${workOrder.summary.nextReadyWorkItem.effectId}\`) - ${sentenceCaseWorkItem(workOrder.summary.nextReadyWorkItem.workItemId)}`,
          ...(workOrder.summary.nextReadyWorkItem.captureUrl
            ? [`Next ready capture URL: \`${workOrder.summary.nextReadyWorkItem.captureUrl}\``]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.autoUploadUrl
            ? [`Next ready auto-upload URL: \`${workOrder.summary.nextReadyWorkItem.autoUploadUrl}\``]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.autoUploadUrlTemplate
            ? [`Next ready auto-upload URL template: \`${workOrder.summary.nextReadyWorkItem.autoUploadUrlTemplate}\``]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.operatorLaunchUrl
            ? [`Next ready operator launch URL: \`${workOrder.summary.nextReadyWorkItem.operatorLaunchUrl}\``]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.operatorLaunchUrlTemplate
            ? [
                `Next ready operator launch URL template: \`${workOrder.summary.nextReadyWorkItem.operatorLaunchUrlTemplate}\``,
              ]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.autoUploadRequiresDeviceLabel
            ? ['Next ready auto-upload device label: required (`profileDeviceLabel`)']
            : []),
          ...(workOrder.summary.nextReadyWorkItem.captureUrlReachability
            ? [
                `Next ready capture URL reachability: \`${workOrder.summary.nextReadyWorkItem.captureUrlReachability}\``,
              ]
            : []),
          ...(workOrder.summary.nextReadyWorkItem.visualInspectionTargets
            ? [
                'Next ready visual inspection targets:',
                `- Thumbnail: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.thumbnailAsset}\``,
                `- Animated clip: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.animatedClipAsset}\``,
                `- Style contact sheet: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.styleContactSheetAsset}\``,
                `- Control extremes contact sheet: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.controlExtremesContactSheetAsset}\``,
                `- Style matrix: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.styleDifferentiationAnchor}\``,
                `- Control matrix: \`${workOrder.summary.nextReadyWorkItem.visualInspectionTargets.controlSafetyAnchor}\``,
                ...workOrder.summary.nextReadyWorkItem.visualInspectionTargets.requiredChecks.map(
                  (check) => `- ${check}`,
                ),
              ]
            : []),
          `Next ready output: \`${workOrder.summary.nextReadyWorkItem.outputFile}\``,
          `Next ready evidence: \`${workOrder.summary.nextReadyWorkItem.evidenceReference}\``,
        ]
      : ['Next ready item: none']),
    `Final acceptance command: \`${workOrder.instructions.finalAcceptanceCommand}\``,
    '',
    ...(workOrder.blockingFindings.length > 0
      ? ['## Blocking Findings', '', ...workOrder.blockingFindings.map((finding) => `- ${finding}`), '']
      : []),
    '## Operator Checklist',
    '',
    ...workOrder.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of workOrder.effects) {
    lines.push(`## ${effect.name} (\`${effect.effectId}\`)`, '', `Open work items: ${effect.openWorkItemCount}`, '')
    effect.workItems.forEach((item, index) => {
      lines.push(`${index + 1}. ${sentenceCaseWorkItem(item.id)}`)
      lines.push(`   - Output: \`${item.outputFile}\``)
      lines.push(`   - Evidence: \`${item.evidenceReference}\``)
      if (item.captureUrl) lines.push(`   - Capture URL: \`${item.captureUrl}\``)
      if (item.autoUploadUrl) lines.push(`   - Auto-upload URL: \`${item.autoUploadUrl}\``)
      if (item.operatorLaunchUrl) lines.push(`   - Operator launch URL: \`${item.operatorLaunchUrl}\``)
      if (item.operatorLaunchUrlTemplate) {
        lines.push(`   - Operator launch URL template: \`${item.operatorLaunchUrlTemplate}\``)
      }
      if (item.autoUploadUrlTemplate) lines.push(`   - Auto-upload URL template: \`${item.autoUploadUrlTemplate}\``)
      if (item.autoUploadRequiresDeviceLabel) {
        lines.push('   - Auto-upload device label: required (`profileDeviceLabel`)')
      }
      if (item.captureUrlReachability) {
        lines.push(`   - Capture URL reachability: \`${item.captureUrlReachability}\``)
      }
      if (item.visualInspectionTargets) {
        lines.push(
          '   - Visual inspection targets:',
          `     - Thumbnail: \`${item.visualInspectionTargets.thumbnailAsset}\``,
          `     - Animated clip: \`${item.visualInspectionTargets.animatedClipAsset}\``,
          `     - Style contact sheet: \`${item.visualInspectionTargets.styleContactSheetAsset}\``,
          `     - Control extremes contact sheet: \`${item.visualInspectionTargets.controlExtremesContactSheetAsset}\``,
          `     - Style matrix: \`${item.visualInspectionTargets.styleDifferentiationAnchor}\``,
          `     - Control matrix: \`${item.visualInspectionTargets.controlSafetyAnchor}\``,
          ...item.visualInspectionTargets.requiredChecks.map((check) => `     - ${check}`),
        )
      }
      lines.push(`   - ${externalEvidencePrerequisiteMarkdown(item)}`)
      for (const instruction of item.instructions) {
        lines.push(`   - ${instruction}`)
      }
    })
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function findNextReadyExternalEvidenceWorkItem(
  effects: readonly PfxExternalEvidenceWorkOrderEffect[],
): PfxExternalEvidenceNextReadyWorkItem | null {
  for (const effect of effects) {
    const item = effect.workItems.find((candidate) => candidate.prerequisiteStatus === 'ready')
    if (!item) continue
    return {
      effectId: effect.effectId,
      rank: effect.rank,
      name: effect.name,
      workItemId: item.id,
      label: item.label,
      outputFile: item.outputFile,
      evidenceReference: item.evidenceReference,
      ...(item.captureUrl ? { captureUrl: item.captureUrl } : {}),
      ...(item.autoUploadUrl ? { autoUploadUrl: item.autoUploadUrl } : {}),
      ...(item.autoUploadUrlTemplate ? { autoUploadUrlTemplate: item.autoUploadUrlTemplate } : {}),
      ...(item.autoUploadRequiresDeviceLabel
        ? { autoUploadRequiresDeviceLabel: item.autoUploadRequiresDeviceLabel }
        : {}),
      ...(item.operatorLaunchUrl ? { operatorLaunchUrl: item.operatorLaunchUrl } : {}),
      ...(item.operatorLaunchUrlTemplate ? { operatorLaunchUrlTemplate: item.operatorLaunchUrlTemplate } : {}),
      ...(item.captureUrlReachability ? { captureUrlReachability: item.captureUrlReachability } : {}),
      ...(item.visualInspectionTargets ? { visualInspectionTargets: item.visualInspectionTargets } : {}),
    }
  }
  return null
}

export function createPfxExternalEvidenceBatchPlan(
  options: PfxExternalEvidenceBatchPlanOptions = {},
): PfxExternalEvidenceBatchPlan {
  const batchSize = Math.max(1, Math.floor(options.batchSize ?? 25))
  const workOrder = createPfxExternalEvidenceWorkOrder(options)
  const operatorLaunchWorkItem = workOrder.effects
    .flatMap((effect) => effect.workItems)
    .find((item) => item.operatorLaunchUrl || item.operatorLaunchUrlTemplate)
  const openEffects = workOrder.effects.filter((effect) => effect.openWorkItemCount > 0)
  const batches: PfxExternalEvidenceBatch[] = []

  for (let start = 0; start < openEffects.length; start += batchSize) {
    const effects = openEffects.slice(start, start + batchSize)
    const workItems = effects.flatMap((effect) => effect.workItems)
    const statusCounts = countExternalEvidenceWorkItemStatuses(workItems)
    const captureUrlCounts = countExternalEvidenceCaptureUrls(workItems)
    const readyCaptureUrlCounts = countReadyExternalEvidenceCaptureUrls(workItems)
    const autoUploadUrlCounts = countExternalEvidenceAutoUploadUrls(
      effects.map((effect) => ({
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        openWorkItemCount: effect.workItems.length,
        workItems: effect.workItems,
      })),
    )
    const outputFiles = Array.from(new Set(workItems.map((item) => item.outputFile)))
    const firstEffect = effects[0]
    const lastEffect = effects[effects.length - 1]

    batches.push({
      batchId: `external-evidence-batch-${String(batches.length + 1).padStart(3, '0')}`,
      rankStart: firstEffect.rank,
      rankEnd: lastEffect.rank,
      effectCount: effects.length,
      openWorkItemCount: workItems.length,
      readyWorkItemCount: statusCounts.readyWorkItems,
      blockedWorkItemCount: statusCounts.blockedWorkItems,
      captureUrlItemCount: captureUrlCounts.captureUrlItems,
      networkReachableCaptureUrlItemCount: captureUrlCounts.networkReachableCaptureUrlItems,
      localOnlyCaptureUrlItemCount: captureUrlCounts.localOnlyCaptureUrlItems,
      missingCaptureUrlItemCount: captureUrlCounts.missingCaptureUrlItems,
      readyCaptureUrlItemCount: readyCaptureUrlCounts.readyCaptureUrlItems,
      networkReachableReadyCaptureUrlItemCount: readyCaptureUrlCounts.networkReachableReadyCaptureUrlItems,
      localOnlyReadyCaptureUrlItemCount: readyCaptureUrlCounts.localOnlyReadyCaptureUrlItems,
      missingReadyCaptureUrlItemCount: readyCaptureUrlCounts.missingReadyCaptureUrlItems,
      autoUploadUrlItemCount: autoUploadUrlCounts.autoUploadUrlItems,
      autoUploadRequiresDeviceLabelItemCount: autoUploadUrlCounts.autoUploadRequiresDeviceLabelItems,
      batchScopedAutoUploadUrlItemCount: autoUploadUrlCounts.batchScopedAutoUploadUrlItems,
      readyBatchScopedAutoUploadUrlItemCount: autoUploadUrlCounts.readyBatchScopedAutoUploadUrlItems,
      missingBatchScopedAutoUploadUrlItemCount: autoUploadUrlCounts.missingBatchScopedAutoUploadUrlItems,
      workItemsByType: countExternalEvidenceWorkItems(workItems),
      effectIds: effects.map((effect) => effect.effectId),
      outputFiles,
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-external-evidence-batch-plan.v1',
    summary: {
      totalEffects: workOrder.summary.totalEffects,
      totalOpenWorkItems: workOrder.summary.totalOpenWorkItems,
      readyWorkItems: workOrder.summary.readyWorkItems,
      blockedWorkItems: workOrder.summary.blockedWorkItems,
      captureUrlItems: workOrder.summary.captureUrlItems,
      networkReachableCaptureUrlItems: workOrder.summary.networkReachableCaptureUrlItems,
      localOnlyCaptureUrlItems: workOrder.summary.localOnlyCaptureUrlItems,
      missingCaptureUrlItems: workOrder.summary.missingCaptureUrlItems,
      readyCaptureUrlItems: workOrder.summary.readyCaptureUrlItems,
      networkReachableReadyCaptureUrlItems: workOrder.summary.networkReachableReadyCaptureUrlItems,
      localOnlyReadyCaptureUrlItems: workOrder.summary.localOnlyReadyCaptureUrlItems,
      missingReadyCaptureUrlItems: workOrder.summary.missingReadyCaptureUrlItems,
      autoUploadUrlItems: workOrder.summary.autoUploadUrlItems,
      autoUploadRequiresDeviceLabelItems: workOrder.summary.autoUploadRequiresDeviceLabelItems,
      batchScopedAutoUploadUrlItems: workOrder.summary.batchScopedAutoUploadUrlItems,
      readyBatchScopedAutoUploadUrlItems: workOrder.summary.readyBatchScopedAutoUploadUrlItems,
      missingBatchScopedAutoUploadUrlItems: workOrder.summary.missingBatchScopedAutoUploadUrlItems,
      ...(operatorLaunchWorkItem?.operatorLaunchUrl
        ? { operatorLaunchUrl: operatorLaunchWorkItem.operatorLaunchUrl }
        : {}),
      ...(operatorLaunchWorkItem?.operatorLaunchUrlTemplate
        ? { operatorLaunchUrlTemplate: operatorLaunchWorkItem.operatorLaunchUrlTemplate }
        : {}),
      batchSize,
      totalBatches: batches.length,
      nonApproving: true,
    },
    instructions: {
      approvalStatus: 'non-approving-external-evidence-batch-plan',
      sourceWorkOrderSchema: workOrder.schema,
      finalAcceptanceCommand: workOrder.instructions.finalAcceptanceCommand,
      operatorChecklist: [
        'Work one batch at a time and write completed evidence into the canonical files listed by each batch.',
        'Treat this batch plan as a planning artifact only; it never satisfies taxonomy, implementation, device, red-team, or approval evidence.',
        'Regenerate the batch plan after each completed evidence stream so closed work is removed from later batches.',
      ],
    },
    batches,
  }
}

export function exportPfxExternalEvidenceBatchPlanMarkdown(
  plan: PfxExternalEvidenceBatchPlan = createPfxExternalEvidenceBatchPlan(),
): string {
  const lines = [
    '# R3F PFX External Evidence Batch Plan',
    '',
    'Treat this handoff as non-approving reviewer guidance.',
    '',
    `Total effects: ${plan.summary.totalEffects}`,
    `Total open work items: ${plan.summary.totalOpenWorkItems}`,
    `Ready work items: ${plan.summary.readyWorkItems}`,
    `Blocked work items: ${plan.summary.blockedWorkItems}`,
    `Capture URL work items: ${plan.summary.captureUrlItems}`,
    `Network-reachable capture URLs: ${plan.summary.networkReachableCaptureUrlItems}`,
    `Local-only capture URLs: ${plan.summary.localOnlyCaptureUrlItems}`,
    `Missing capture URLs: ${plan.summary.missingCaptureUrlItems}`,
    `Ready capture URL work items: ${plan.summary.readyCaptureUrlItems}`,
    `Network-reachable ready capture URLs: ${plan.summary.networkReachableReadyCaptureUrlItems}`,
    `Local-only ready capture URLs: ${plan.summary.localOnlyReadyCaptureUrlItems}`,
    `Missing ready capture URLs: ${plan.summary.missingReadyCaptureUrlItems}`,
    `Auto-upload URL work items: ${plan.summary.autoUploadUrlItems}`,
    `Auto-upload URLs requiring device label: ${plan.summary.autoUploadRequiresDeviceLabelItems}`,
    `Batch-scoped auto-upload URLs: ${plan.summary.batchScopedAutoUploadUrlItems}`,
    `Ready batch-scoped auto-upload URLs: ${plan.summary.readyBatchScopedAutoUploadUrlItems}`,
    `Missing batch-scoped auto-upload URLs: ${plan.summary.missingBatchScopedAutoUploadUrlItems}`,
    ...(plan.summary.operatorLaunchUrl ? [`Operator launch page: \`${plan.summary.operatorLaunchUrl}\``] : []),
    ...(plan.summary.operatorLaunchUrlTemplate
      ? [`Operator launch template: \`${plan.summary.operatorLaunchUrlTemplate}\``]
      : []),
    `Batch size: ${plan.summary.batchSize}`,
    `Total batches: ${plan.summary.totalBatches}`,
    `Final acceptance command: \`${plan.instructions.finalAcceptanceCommand}\``,
    '',
    '## Operator Checklist',
    '',
    ...plan.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const batch of plan.batches) {
    lines.push(
      `## ${batch.batchId}`,
      '',
      `Ranks: ${batch.rankStart}-${batch.rankEnd}`,
      `Effects: ${batch.effectCount}`,
      `Open work items: ${batch.openWorkItemCount}`,
      `Ready work items: ${batch.readyWorkItemCount}`,
      `Blocked work items: ${batch.blockedWorkItemCount}`,
      `Capture URL work items: ${batch.captureUrlItemCount}`,
      `Network-reachable capture URLs: ${batch.networkReachableCaptureUrlItemCount}`,
      `Local-only capture URLs: ${batch.localOnlyCaptureUrlItemCount}`,
      `Missing capture URLs: ${batch.missingCaptureUrlItemCount}`,
      `Ready capture URL work items: ${batch.readyCaptureUrlItemCount}`,
      `Network-reachable ready capture URLs: ${batch.networkReachableReadyCaptureUrlItemCount}`,
      `Local-only ready capture URLs: ${batch.localOnlyReadyCaptureUrlItemCount}`,
      `Missing ready capture URLs: ${batch.missingReadyCaptureUrlItemCount}`,
      '',
      'Work items:',
      '',
      `- Taxonomy review: ${batch.workItemsByType.taxonomyReviewItems}`,
      `- Production implementation: ${batch.workItemsByType.productionImplementationItems}`,
      `- Mobile Safari capture: ${batch.workItemsByType.mobileSafariCaptureItems}`,
      `- Chrome Android capture: ${batch.workItemsByType.chromeAndroidCaptureItems}`,
      `- Red-team review: ${batch.workItemsByType.redTeamReviewItems}`,
      `- Final approval: ${batch.workItemsByType.finalApprovalItems}`,
      '',
      'Effect IDs:',
      '',
      batch.effectIds.map((effectId) => `\`${effectId}\``).join(', '),
      '',
      'Output files:',
      '',
      ...batch.outputFiles.map((filePath) => `- \`${filePath}\``),
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

export function createPfxExternalEvidenceBatchSheet(
  options: PfxExternalEvidenceBatchSheetOptions = {},
): PfxExternalEvidenceBatchSheet {
  const plan = createPfxExternalEvidenceBatchPlan(options)
  const batch =
    plan.batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? plan.batches[0] : undefined)
  if (!batch) {
    throw new Error(`External evidence batch not found: ${options.batchId}`)
  }

  const workOrder = createPfxExternalEvidenceWorkOrder(options)
  const workOrderEffects = new Map(workOrder.effects.map((effect) => [effect.effectId, effect]))
  const effects = batch.effectIds.flatMap((effectId): PfxExternalEvidenceBatchSheetEffect[] => {
    const effect = workOrderEffects.get(effectId)
    if (!effect) return []
    return [
      {
        effectId: effect.effectId,
        rank: effect.rank,
        name: effect.name,
        openWorkItemCount: effect.openWorkItemCount,
        workItems: effect.workItems,
      },
    ]
  })

  return {
    schema: 'game-bot.r3f-pfx-external-evidence-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-external-evidence-batch-sheet',
      sourceBatchPlanSchema: plan.schema,
      finalAcceptanceCommand: plan.instructions.finalAcceptanceCommand,
      operatorChecklist: [
        'Complete each checkbox by writing the requested evidence to the listed canonical output file.',
        'Do not treat checked boxes, this sheet, or reviewer notes as final acceptance evidence.',
        'Regenerate the work order, batch plan, and sheet after saving completed evidence manifests.',
      ],
    },
    batch,
    effects,
  }
}

export function exportPfxExternalEvidenceBatchSheetMarkdown(
  sheet: PfxExternalEvidenceBatchSheet = createPfxExternalEvidenceBatchSheet(),
): string {
  const lines = [
    '# R3F PFX External Evidence Batch Sheet',
    '',
    'Treat this handoff as non-approving reviewer guidance.',
    '',
    `Batch: \`${sheet.batch.batchId}\``,
    `Ranks: ${sheet.batch.rankStart}-${sheet.batch.rankEnd}`,
    `Effects: ${sheet.batch.effectCount}`,
    `Open work items: ${sheet.batch.openWorkItemCount}`,
    `Capture URL work items: ${sheet.batch.captureUrlItemCount}`,
    `Network-reachable capture URLs: ${sheet.batch.networkReachableCaptureUrlItemCount}`,
    `Local-only capture URLs: ${sheet.batch.localOnlyCaptureUrlItemCount}`,
    `Missing capture URLs: ${sheet.batch.missingCaptureUrlItemCount}`,
    `Ready capture URL work items: ${sheet.batch.readyCaptureUrlItemCount}`,
    `Network-reachable ready capture URLs: ${sheet.batch.networkReachableReadyCaptureUrlItemCount}`,
    `Local-only ready capture URLs: ${sheet.batch.localOnlyReadyCaptureUrlItemCount}`,
    `Missing ready capture URLs: ${sheet.batch.missingReadyCaptureUrlItemCount}`,
    `Auto-upload URL work items: ${sheet.batch.autoUploadUrlItemCount}`,
    `Auto-upload URLs requiring device label: ${sheet.batch.autoUploadRequiresDeviceLabelItemCount}`,
    `Batch-scoped auto-upload URLs: ${sheet.batch.batchScopedAutoUploadUrlItemCount}`,
    `Ready batch-scoped auto-upload URLs: ${sheet.batch.readyBatchScopedAutoUploadUrlItemCount}`,
    `Missing batch-scoped auto-upload URLs: ${sheet.batch.missingBatchScopedAutoUploadUrlItemCount}`,
    `Final acceptance command: \`${sheet.instructions.finalAcceptanceCommand}\``,
    '',
    '## Operator Checklist',
    '',
    ...sheet.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
  ]

  for (const effect of sheet.effects) {
    lines.push(`## ${effect.name} (\`${effect.effectId}\`)`, '', `Rank: ${effect.rank}`, '')
    for (const item of effect.workItems) {
      lines.push(`- [ ] ${sentenceCaseWorkItem(item.id)}`)
      lines.push(`  - Output: \`${item.outputFile}\``)
      lines.push(`  - Evidence: \`${item.evidenceReference}\``)
      if (item.captureUrl) lines.push(`  - Capture URL: \`${item.captureUrl}\``)
      if (item.autoUploadUrl) lines.push(`  - Auto-upload URL: \`${item.autoUploadUrl}\``)
      if (item.operatorLaunchUrl) lines.push(`  - Operator launch URL: \`${item.operatorLaunchUrl}\``)
      if (item.operatorLaunchUrlTemplate) {
        lines.push(`  - Operator launch URL template: \`${item.operatorLaunchUrlTemplate}\``)
      }
      if (item.autoUploadUrlTemplate) lines.push(`  - Auto-upload URL template: \`${item.autoUploadUrlTemplate}\``)
      if (item.autoUploadRequiresDeviceLabel) {
        lines.push('  - Auto-upload device label: required (`profileDeviceLabel`)')
      }
      if (item.captureUrlReachability) {
        lines.push(`  - Capture URL reachability: \`${item.captureUrlReachability}\``)
      }
      if (item.visualInspectionTargets) {
        lines.push(
          '  - Visual inspection targets:',
          `    - Thumbnail: \`${item.visualInspectionTargets.thumbnailAsset}\``,
          `    - Animated clip: \`${item.visualInspectionTargets.animatedClipAsset}\``,
          `    - Style contact sheet: \`${item.visualInspectionTargets.styleContactSheetAsset}\``,
          `    - Control extremes contact sheet: \`${item.visualInspectionTargets.controlExtremesContactSheetAsset}\``,
          `    - Style matrix: \`${item.visualInspectionTargets.styleDifferentiationAnchor}\``,
          `    - Control matrix: \`${item.visualInspectionTargets.controlSafetyAnchor}\``,
          ...item.visualInspectionTargets.requiredChecks.map((check) => `    - ${check}`),
        )
      }
      lines.push(`  - ${externalEvidencePrerequisiteMarkdown(item)}`)
      for (const instruction of item.instructions) {
        lines.push(`  - ${instruction}`)
      }
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function externalEvidencePrerequisiteMarkdown(item: PfxExternalEvidenceWorkItem): string {
  if (item.prerequisiteStatus === 'ready') return 'Prerequisite status: `ready`'
  return `Prerequisite status: \`blocked\` by ${item.blockedBy.map((id) => `\`${id}\``).join(', ')}`
}

function countExternalEvidenceWorkItemStatuses(workItems: readonly PfxExternalEvidenceWorkItem[]): {
  readyWorkItems: number
  blockedWorkItems: number
} {
  return {
    readyWorkItems: workItems.filter((item) => item.prerequisiteStatus === 'ready').length,
    blockedWorkItems: workItems.filter((item) => item.prerequisiteStatus === 'blocked').length,
  }
}

function countExternalEvidenceCaptureUrls(workItems: readonly PfxExternalEvidenceWorkItem[]): {
  captureUrlItems: number
  networkReachableCaptureUrlItems: number
  localOnlyCaptureUrlItems: number
  missingCaptureUrlItems: number
} {
  const captureWorkItems = workItems.filter(
    (item) => item.id === 'mobile-safari-capture' || item.id === 'chrome-android-capture',
  )
  return {
    captureUrlItems: captureWorkItems.filter((item) => Boolean(item.captureUrl)).length,
    networkReachableCaptureUrlItems: captureWorkItems.filter(
      (item) => item.captureUrlReachability === 'network-reachable',
    ).length,
    localOnlyCaptureUrlItems: captureWorkItems.filter((item) => item.captureUrlReachability === 'local-only').length,
    missingCaptureUrlItems: captureWorkItems.filter((item) => !item.captureUrl).length,
  }
}

function countReadyExternalEvidenceCaptureUrls(workItems: readonly PfxExternalEvidenceWorkItem[]): {
  readyCaptureUrlItems: number
  networkReachableReadyCaptureUrlItems: number
  localOnlyReadyCaptureUrlItems: number
  missingReadyCaptureUrlItems: number
} {
  const readyCaptureWorkItems = workItems.filter(
    (item) =>
      item.prerequisiteStatus === 'ready' &&
      (item.id === 'mobile-safari-capture' || item.id === 'chrome-android-capture'),
  )
  return {
    readyCaptureUrlItems: readyCaptureWorkItems.length,
    networkReachableReadyCaptureUrlItems: readyCaptureWorkItems.filter(
      (item) => item.captureUrlReachability === 'network-reachable',
    ).length,
    localOnlyReadyCaptureUrlItems: readyCaptureWorkItems.filter((item) => item.captureUrlReachability === 'local-only')
      .length,
    missingReadyCaptureUrlItems: readyCaptureWorkItems.filter((item) => !item.captureUrl).length,
  }
}

function countExternalEvidenceAutoUploadUrls(effects: readonly PfxExternalEvidenceWorkOrderEffect[]): {
  autoUploadUrlItems: number
  autoUploadRequiresDeviceLabelItems: number
  batchScopedAutoUploadUrlItems: number
  readyBatchScopedAutoUploadUrlItems: number
  missingBatchScopedAutoUploadUrlItems: number
} {
  const captureWorkItems = effects.flatMap((effect) =>
    effect.workItems
      .filter(
        (
          item,
        ): item is PfxExternalEvidenceWorkItem & {
          id: 'mobile-safari-capture' | 'chrome-android-capture'
        } => isExternalEvidenceCaptureWorkItemId(item.id),
      )
      .map((item) => ({ effectId: effect.effectId, item })),
  )
  const batchScopedAutoUploadUrlItems = captureWorkItems.filter(({ effectId, item }) =>
    isBatchScopedExternalEvidenceAutoUploadUrl(effectId, item.id, item.autoUploadUrl),
  ).length
  const readyBatchScopedAutoUploadUrlItems = captureWorkItems.filter(
    ({ effectId, item }) =>
      item.prerequisiteStatus === 'ready' && isBatchScopedExternalEvidenceAutoUploadUrl(effectId, item.id, item.autoUploadUrl),
  ).length
  return {
    autoUploadUrlItems: captureWorkItems.filter(({ item }) => item.autoUploadUrl).length,
    autoUploadRequiresDeviceLabelItems: captureWorkItems.filter(({ item }) => item.autoUploadRequiresDeviceLabel).length,
    batchScopedAutoUploadUrlItems,
    readyBatchScopedAutoUploadUrlItems,
    missingBatchScopedAutoUploadUrlItems: captureWorkItems.length - batchScopedAutoUploadUrlItems,
  }
}

function isExternalEvidenceCaptureWorkItemId(
  workItemId: PfxExternalEvidenceWorkItemId,
): workItemId is 'mobile-safari-capture' | 'chrome-android-capture' {
  return workItemId === 'mobile-safari-capture' || workItemId === 'chrome-android-capture'
}

function isBatchScopedExternalEvidenceAutoUploadUrl(
  effectId: string,
  workItemId: 'mobile-safari-capture' | 'chrome-android-capture',
  autoUploadUrl: string | undefined,
): boolean {
  if (!autoUploadUrl) return false
  try {
    const url = new URL(autoUploadUrl)
    const expectedPlatform = workItemId === 'mobile-safari-capture' ? 'mobile-safari' : 'chrome-android'
    return (
      url.pathname === '/__r3f-pfx-capture-next' &&
      url.searchParams.get('platform') === expectedPlatform &&
      url.searchParams.get('profileAutoUpload') === '1' &&
      url.searchParams.get('effectId') === effectId &&
      Boolean(url.searchParams.get('batchId'))
    )
  } catch {
    return false
  }
}

export function createPfxExternalEvidenceBatchSheetIndex(
  plan: PfxExternalEvidenceBatchPlan = createPfxExternalEvidenceBatchPlan(),
  options: PfxExternalEvidenceBatchSheetIndexOptions = {},
): PfxExternalEvidenceBatchSheetIndex {
  const outputDirectory = trimPathTrailingSlash(options.outputDirectory ?? '.context/external-evidence-batches')
  const sheets = plan.batches.map((batch): PfxExternalEvidenceBatchSheetIndexSheet => {
    const outputFile = externalEvidenceBatchSheetJsonOutputFile(batch.batchId, outputDirectory)
    const markdownOutputFile = externalEvidenceBatchSheetMarkdownOutputFile(batch.batchId, outputDirectory)
    return {
      batchId: batch.batchId,
      rankStart: batch.rankStart,
      rankEnd: batch.rankEnd,
      effectCount: batch.effectCount,
      openWorkItemCount: batch.openWorkItemCount,
      readyWorkItemCount: batch.readyWorkItemCount,
      blockedWorkItemCount: batch.blockedWorkItemCount,
      captureUrlItemCount: batch.captureUrlItemCount,
      readyCaptureUrlItemCount: batch.readyCaptureUrlItemCount,
      autoUploadRequiresDeviceLabelItemCount: batch.autoUploadRequiresDeviceLabelItemCount,
      batchScopedAutoUploadUrlItemCount: batch.batchScopedAutoUploadUrlItemCount,
      readyBatchScopedAutoUploadUrlItemCount: batch.readyBatchScopedAutoUploadUrlItemCount,
      missingBatchScopedAutoUploadUrlItemCount: batch.missingBatchScopedAutoUploadUrlItemCount,
      outputFile,
      markdownOutputFile,
      command: externalEvidenceBatchSheetCommand(batch.batchId, outputFile, markdownOutputFile),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-external-evidence-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalEffects: plan.summary.totalEffects,
      totalOpenWorkItems: plan.summary.totalOpenWorkItems,
      readyWorkItems: plan.summary.readyWorkItems,
      blockedWorkItems: plan.summary.blockedWorkItems,
      captureUrlItems: plan.summary.captureUrlItems,
      networkReachableCaptureUrlItems: plan.summary.networkReachableCaptureUrlItems,
      localOnlyCaptureUrlItems: plan.summary.localOnlyCaptureUrlItems,
      missingCaptureUrlItems: plan.summary.missingCaptureUrlItems,
      readyCaptureUrlItems: plan.summary.readyCaptureUrlItems,
      networkReachableReadyCaptureUrlItems: plan.summary.networkReachableReadyCaptureUrlItems,
      localOnlyReadyCaptureUrlItems: plan.summary.localOnlyReadyCaptureUrlItems,
      missingReadyCaptureUrlItems: plan.summary.missingReadyCaptureUrlItems,
      autoUploadUrlItems: plan.summary.autoUploadUrlItems,
      autoUploadRequiresDeviceLabelItems: plan.summary.autoUploadRequiresDeviceLabelItems,
      batchScopedAutoUploadUrlItems: plan.summary.batchScopedAutoUploadUrlItems,
      readyBatchScopedAutoUploadUrlItems: plan.summary.readyBatchScopedAutoUploadUrlItems,
      missingBatchScopedAutoUploadUrlItems: plan.summary.missingBatchScopedAutoUploadUrlItems,
      ...(plan.summary.operatorLaunchUrl ? { operatorLaunchUrl: plan.summary.operatorLaunchUrl } : {}),
      ...(plan.summary.operatorLaunchUrlTemplate
        ? { operatorLaunchUrlTemplate: plan.summary.operatorLaunchUrlTemplate }
        : {}),
      outputDirectory,
      approvalStatus: 'non-approving-external-evidence-batch-sheet-index',
      bulkCommand: externalEvidenceBulkBatchSheetCommand(outputDirectory),
    },
    sheets,
  }
}

export function exportPfxExternalEvidenceBatchSheetIndexMarkdown(
  index: PfxExternalEvidenceBatchSheetIndex = createPfxExternalEvidenceBatchSheetIndex(),
): string {
  const lines = [
    '# R3F PFX External Evidence Batch Sheet Index',
    '',
    'Treat this index as non-approving reviewer guidance.',
    '',
    `Total batches: ${index.summary.totalBatches}`,
    `Total effects: ${index.summary.totalEffects}`,
    `Total open work items: ${index.summary.totalOpenWorkItems}`,
    `Ready work items: ${index.summary.readyWorkItems}`,
    `Blocked work items: ${index.summary.blockedWorkItems}`,
    `Capture URL work items: ${index.summary.captureUrlItems}`,
    `Network-reachable capture URLs: ${index.summary.networkReachableCaptureUrlItems}`,
    `Local-only capture URLs: ${index.summary.localOnlyCaptureUrlItems}`,
    `Missing capture URLs: ${index.summary.missingCaptureUrlItems}`,
    `Ready capture URL work items: ${index.summary.readyCaptureUrlItems}`,
    `Network-reachable ready capture URLs: ${index.summary.networkReachableReadyCaptureUrlItems}`,
    `Local-only ready capture URLs: ${index.summary.localOnlyReadyCaptureUrlItems}`,
    `Missing ready capture URLs: ${index.summary.missingReadyCaptureUrlItems}`,
    `Auto-upload URL work items: ${index.summary.autoUploadUrlItems}`,
    `Auto-upload URLs requiring device label: ${index.summary.autoUploadRequiresDeviceLabelItems}`,
    `Batch-scoped auto-upload URLs: ${index.summary.batchScopedAutoUploadUrlItems}`,
    `Ready batch-scoped auto-upload URLs: ${index.summary.readyBatchScopedAutoUploadUrlItems}`,
    `Missing batch-scoped auto-upload URLs: ${index.summary.missingBatchScopedAutoUploadUrlItems}`,
    ...(index.summary.operatorLaunchUrl ? [`Operator launch page: \`${index.summary.operatorLaunchUrl}\``] : []),
    ...(index.summary.operatorLaunchUrlTemplate
      ? [`Operator launch template: \`${index.summary.operatorLaunchUrlTemplate}\``]
      : []),
    `Output directory: \`${index.summary.outputDirectory}\``,
    `Bulk command: \`${index.summary.bulkCommand}\``,
    ...productionHandoffCommandMarkdownLines(),
    '',
    '## Batch Sheets',
    '',
  ]

  for (const sheet of index.sheets) {
    lines.push(
      `- \`${sheet.batchId}\` (ranks ${sheet.rankStart}-${sheet.rankEnd}, ${sheet.effectCount} effects, ${sheet.openWorkItemCount} open items, ${sheet.readyWorkItemCount} ready, ${sheet.blockedWorkItemCount} blocked, ${sheet.batchScopedAutoUploadUrlItemCount} batch-scoped auto-upload URLs, ${sheet.missingBatchScopedAutoUploadUrlItemCount} missing batch-scoped auto-upload URLs): \`${sheet.markdownOutputFile}\``,
      `  - JSON: \`${sheet.outputFile}\``,
      `  - Markdown: \`${sheet.markdownOutputFile}\``,
      `  - \`${sheet.command}\``,
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function externalEvidenceBatchSheetJsonOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.json`
}

export function externalEvidenceBatchSheetMarkdownOutputFile(batchId: string, outputDirectory: string): string {
  return `${outputDirectory}/${batchId}.md`
}

export function externalEvidenceBatchSheetCommand(batchId: string, outputFile: string, markdownOutputFile: string): string {
  return [
    'npm --prefix tools/3d-pfx-library/viewer run export:external-evidence',
    `-- --external-evidence-batch-id ${batchId}`,
    `--external-evidence-batch-sheet-output ${outputFile}`,
    `--external-evidence-batch-sheet-markdown-output ${markdownOutputFile}`,
  ].join(' ')
}

export function externalEvidenceCommandRemainderHasProtectedFlag(remainder: string, protectedFlags: readonly string[]): boolean {
  const tokens = remainder.trim().split(/\s+/).filter(Boolean)
  return tokens.some((token) => protectedFlags.some((flag) => token === flag || token.startsWith(`${flag}=`)))
}

export function externalEvidenceBulkBatchSheetCommand(outputDirectory: string): string {
  return [
    'npm --prefix tools/3d-pfx-library/viewer run export:external-evidence',
    '-- --external-evidence-work-order-output .context/r3f-pfx-external-evidence-work-order.json',
    '--external-evidence-work-order-markdown-output .context/r3f-pfx-external-evidence-work-order.md',
    '--external-evidence-batch-plan-output .context/r3f-pfx-external-evidence-batch-plan.json',
    '--external-evidence-batch-plan-markdown-output .context/r3f-pfx-external-evidence-batch-plan.md',
    `--external-evidence-batch-sheet-directory ${outputDirectory}`,
    '--external-evidence-batch-sheet-index-output .context/r3f-pfx-external-evidence-batch-sheet-index.json',
    '--external-evidence-batch-sheet-index-markdown-output .context/r3f-pfx-external-evidence-batch-sheet-index.md',
  ].join(' ')
}

function countExternalEvidenceWorkItems(
  workItems: readonly PfxExternalEvidenceWorkItem[],
): PfxExternalEvidenceWorkItemCounts {
  const counts: PfxExternalEvidenceWorkItemCounts = {
    taxonomyReviewItems: 0,
    productionImplementationItems: 0,
    mobileSafariCaptureItems: 0,
    chromeAndroidCaptureItems: 0,
    redTeamReviewItems: 0,
    finalApprovalItems: 0,
  }

  for (const item of workItems) {
    if (item.id === 'taxonomy-review') counts.taxonomyReviewItems += 1
    if (item.id === 'production-implementation') counts.productionImplementationItems += 1
    if (item.id === 'mobile-safari-capture') counts.mobileSafariCaptureItems += 1
    if (item.id === 'chrome-android-capture') counts.chromeAndroidCaptureItems += 1
    if (item.id === 'red-team-review') counts.redTeamReviewItems += 1
    if (item.id === 'final-approval') counts.finalApprovalItems += 1
  }

  return counts
}

export function productionApprovalOperatorLaunchHandoff(
  options: Pick<PfxProductionReadinessOptions, 'realDeviceCaptureBaseUrl'>,
): Pick<
  PfxProductionApprovalCaptureHandoff,
  'operatorLaunchUrl' | 'operatorLaunchUrlTemplate' | 'operatorStatusUrl' | 'operatorStatusUrlTemplate'
> {
  if (!options.realDeviceCaptureBaseUrl) return {}
  try {
    const operatorLaunchUrl = new URL('/__r3f-pfx-capture-operator', options.realDeviceCaptureBaseUrl).toString()
    const operatorStatusUrl = new URL(
      '/__r3f-pfx-capture-operator-status',
      options.realDeviceCaptureBaseUrl,
    ).toString()
    return {
      operatorLaunchUrl,
      operatorLaunchUrlTemplate: `${operatorLaunchUrl}?profileDeviceLabel={profileDeviceLabel}`,
      operatorStatusUrl,
      operatorStatusUrlTemplate: `${operatorStatusUrl}?profileDeviceLabel={profileDeviceLabel}`,
    }
  } catch {
    return {}
  }
}

function createRealDeviceCaptureBatchMapFindings(
  batchIdsByEffectId: Readonly<Record<string, Partial<Record<'mobile-safari' | 'chrome-android', string>>>>,
  acceptedEffectIds: ReadonlySet<string>,
): string[] {
  const allowedPlatforms = new Set(['mobile-safari', 'chrome-android'])
  const entries = Object.entries(batchIdsByEffectId)
  const unknownEffectIds = valuesOutsideAcceptedEffectIds(
    entries.map(([effectId]) => effectId),
    acceptedEffectIds,
  )
  const unknownPlatformFindings = entries
    .filter(([effectId]) => acceptedEffectIds.has(effectId))
    .flatMap(([effectId, platformMap]) => {
      const unknownPlatforms = Object.keys(platformMap).filter((platform) => !allowedPlatforms.has(platform))
      return unknownPlatforms.length > 0
        ? [`real-device capture batch map has unknown platform keys for ${effectId}: ${unknownPlatforms.join(', ')}`]
        : []
    })
  const blankBatchIds = entries
    .filter(([effectId]) => acceptedEffectIds.has(effectId))
    .flatMap(([effectId, platformMap]) =>
      (['mobile-safari', 'chrome-android'] as const).flatMap((platform) => {
        const batchId = platformMap[platform]
        return batchId != null && batchId.trim().length === 0 ? [`${effectId} ${platform}`] : []
      }),
    )

  return [
    ...createStandaloneEvidenceIdFindings('real-device capture batch map', unknownEffectIds),
    ...unknownPlatformFindings,
    ...(blankBatchIds.length > 0
      ? [`real-device capture batch map has blank batch ids: ${blankBatchIds.join(', ')}`]
      : []),
  ]
}

export function expectedProductionApprovalEvidence(effectId: string): string {
  return `production-approval:.context/r3f-pfx-production-approvals.json#${effectId}`
}
