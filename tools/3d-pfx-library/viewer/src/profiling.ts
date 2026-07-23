import {
  createPfxProductionAcceptanceGapAudit,
  createPfxProductionApprovalReadinessReport,
  createPfxProductionReadinessReport,
  filterPfxCatalog,
  PFX_MOBILE_RUNTIME_POLICY,
  PFX_TAXONOMY,
  PFX_TAXONOMY_REVIEW_CRITERIA,
  PFX_PRODUCTION_IMPLEMENTATION_CRITERIA,
  PFX_RED_TEAM_CRITERIA,
  type PfxMobileRuntimePolicy,
  type PerformanceTier,
  type PfxProductionApproval,
  type PfxProductionApprovalReadinessReport,
  type PfxProductionAcceptanceGapAudit,
  type PfxProductionImplementationReview,
  type PfxProductionReadinessReport,
  type PfxRedTeamReviewTemplate,
  type PfxTaxonomyEffectReview,
  type PfxTaxonomyReviewTemplate,
} from '@pfx'
import {
  createPfxQualityImprovementLedger,
  pfxTargetGradeForRank,
  type PfxQualityImprovementLedger,
  type PfxQualityTargetGrade,
} from './qualityLoop'

const PFX_LAN_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:lan'

const PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix kits/juice/r3f-pfx-browser run verify:production-handoff:base-url'

function productionHandoffCommandMarkdownLines(): string[] {
  return [
    `LAN handoff command: \`${PFX_LAN_PRODUCTION_HANDOFF_COMMAND}\``,
    `Tunnel/base URL handoff command: \`${PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\``,
  ]
}

export type BrowserProfileCapturePlatform = 'local-chromium' | 'mobile-safari' | 'chrome-android'

export interface BrowserProfileCapture {
  deviceClass: 'local-playwright' | 'real-device'
  platform: BrowserProfileCapturePlatform
  deviceLabel: string
  runner: string
  notes: string[]
}

export interface BrowserProfileInput {
  capturedAt: string
  url: string
  userAgent: string
  capture?: BrowserProfileCapture
  runtimePolicy?: PfxMobileRuntimePolicy
  device?: BrowserDeviceProfile
  viewport: {
    width: number
    height: number
    deviceScaleFactor: number
    isMobile: boolean
  }
  scenario: {
    id: string
    mode: 'single' | 'stress'
    effectCount: number
    totalParticles: number
    totalDrawCalls: number
    textureMemoryKb: number
  }
  frameSamplesMs: number[]
  webgl?: WebglProfile
  canvas: {
    width: number
    height: number
    nonBackgroundPixels: number
    measurementSource?: PfxOverdrawMeasurementSource
  }
}

export interface BrowserDeviceProfile {
  maxTouchPoints: number
  pointerCoarse: boolean
  hoverNone: boolean
}

export type PfxOverdrawMeasurementSource = 'screenshot-readback' | 'browser-estimate'

export type GpuTimerStatus = 'measured' | 'unsupported' | 'disjoint' | 'timeout' | 'error'

export interface WebglProfile {
  context: 'webgl2' | 'webgl' | 'unavailable'
  vendor: string
  renderer: string
  version: string
  shadingLanguageVersion: string
  timerQueryExtension: 'EXT_disjoint_timer_query_webgl2' | 'EXT_disjoint_timer_query' | 'unavailable'
  gpuTimerStatus: GpuTimerStatus
  gpuTimerMs: number | null
  notes: string[]
}

export interface ProfileScenarioDefinition {
  id: string
  mode: 'single' | 'stress'
  search: string
  effectIds?: string[]
  stressCount?: number
  mobileSafeOnly?: boolean
}

export type RealDeviceProfileCapturePlatform = Extract<BrowserProfileCapturePlatform, 'mobile-safari' | 'chrome-android'>

export const REAL_DEVICE_AUDIT_COMMAND = 'npm --prefix kits/juice/r3f-pfx-browser run verify:real-device'

export function isMobileSafariRealDeviceUserAgent(userAgent: string): boolean {
  return /(iphone|ipad|ipod)/i.test(userAgent) && /version\/[^ ]+ mobile\/[^ ]+ safari\//i.test(userAgent)
}

export function isChromeAndroidRealDeviceUserAgent(userAgent: string): boolean {
  return (
    /android/i.test(userAgent) &&
    /chrome\/\d/i.test(userAgent) &&
    /mobile safari\//i.test(userAgent) &&
    !/(samsungbrowser|edga|opr|firefox|fxios|crios)/i.test(userAgent)
  )
}

export function inferRealDeviceCapturePlatformFromUserAgent(userAgent: string): RealDeviceProfileCapturePlatform | null {
  if (isChromeAndroidRealDeviceUserAgent(userAgent)) return 'chrome-android'
  if (isMobileSafariRealDeviceUserAgent(userAgent)) return 'mobile-safari'
  return null
}

export interface PfxRealDeviceProfileCapturePlanOptions {
  baseUrl: string
  outputRoot?: string
}

export interface PfxRealDeviceProfileCapturePlanEntry {
  effectId: string
  platform: RealDeviceProfileCapturePlatform
  scenarioId: string
  profileUrl: string
  outputFile: string
  requiredCapture: {
    deviceClass: 'real-device'
    platform: RealDeviceProfileCapturePlatform
    runner: 'manual-real-device-browser'
    performanceTier: PerformanceTier
    concurrency: number
    sustainedDurationSeconds: 180
  }
  verifierEvidence: string
  operatorChecklist: string[]
}

export type PfxRealDeviceCaptureBaseUrlReachability = 'network-reachable' | 'local-only'

export interface PfxRealDeviceCapturePlanInstructions {
  baseUrl: string
  baseUrlReachability: PfxRealDeviceCaptureBaseUrlReachability
  baseUrlRemediationCommand?: string
  devServerCommand: string
  profileJsonSelector: '[data-profile-json="r3f-pfx-real-device"]'
  auditCommand: string
  operatorChecklist: string[]
  platformRequirements: Record<
    RealDeviceProfileCapturePlatform,
    {
      browser: string
      deviceClass: string
    }
  >
}

export interface PfxRealDeviceProfileCapturePlan {
  schema: 'game-bot.r3f-pfx-real-device-capture-plan.v2'
  summary: {
    totalEffects: number
    totalCaptures: number
    platforms: RealDeviceProfileCapturePlatform[]
    requiredDeviceClass: 'real-device'
  }
  instructions: PfxRealDeviceCapturePlanInstructions
  captures: PfxRealDeviceProfileCapturePlanEntry[]
}

export interface PfxRealDeviceCaptureBatchPlanOptions {
  batchSize?: number
}

export interface PfxRealDeviceCaptureBatch {
  batchId: string
  platform: RealDeviceProfileCapturePlatform
  startIndex: number
  endIndex: number
  captureCount: number
  effectIds: string[]
  profileUrls: string[]
  outputFiles: string[]
  resumeCommand: string
}

export interface PfxRealDeviceCaptureBatchSheetOptions {
  batchId?: string
}

export interface PfxRealDeviceCaptureBatchSheetCapture {
  effectId: string
  name: string
  platform: RealDeviceProfileCapturePlatform
  scenarioId: string
  profileUrl: string
  autoUploadUrl: string
  autoUploadUrlTemplate: string
  autoUploadRequiresDeviceLabel: boolean
  outputFile: string
  requiredCapture: PfxRealDeviceProfileCapturePlanEntry['requiredCapture']
  verifierEvidence: string
  operatorChecklist: string[]
  captured: false
}

export interface PfxRealDeviceCaptureBatchSheet {
  schema: 'game-bot.r3f-pfx-real-device-capture-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-real-device-capture-batch-sheet'
    sourceBatchPlanSchema: 'game-bot.r3f-pfx-real-device-capture-batches.v1'
    profileJsonSelector: '[data-profile-json="r3f-pfx-real-device"]'
    auditCommand: string
    operatorChecklist: string[]
  }
  batch: PfxRealDeviceCaptureBatch
  captures: PfxRealDeviceCaptureBatchSheetCapture[]
}

export interface PfxRealDeviceCaptureBatchPlan {
  schema: 'game-bot.r3f-pfx-real-device-capture-batches.v1'
  summary: {
    totalCaptures: number
    totalBatches: number
    batchSize: number
    platforms: RealDeviceProfileCapturePlatform[]
  }
  instructions: {
    sourcePlanSchema: 'game-bot.r3f-pfx-real-device-capture-plan.v2'
    approvalStatus: 'non-approving-capture-execution-worklist'
    operatorChecklist: string[]
  }
  batches: PfxRealDeviceCaptureBatch[]
}

export interface PfxRealDeviceCaptureBatchSheetIndexOptions {
  outputDirectory?: string
}

export interface PfxRealDeviceCaptureBatchSheetIndexSheet {
  batchId: string
  platform: RealDeviceProfileCapturePlatform
  startIndex: number
  endIndex: number
  captureCount: number
  firstEffectId: string
  lastEffectId: string
  outputFile: string
  autoUploadQueueUrl: string
  autoUploadQueueUrlTemplate: string
  autoUploadRequiresDeviceLabel: boolean
  command: string
}

export interface PfxRealDeviceCaptureBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-real-device-capture-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalCaptures: number
    outputDirectory: string
    approvalStatus: 'non-approving-batch-sheet-index'
    bulkCommand: string
  }
  sheets: PfxRealDeviceCaptureBatchSheetIndexSheet[]
}

export interface PfxRealDeviceCaptureBatchSheetIndexValidation {
  passed: boolean
  findings: string[]
}

export type PfxRealDeviceCaptureBatchProgressStatus = 'complete' | 'partial' | 'missing'

export interface PfxRealDeviceCaptureBatchProgressRow {
  batchId: string
  platform: RealDeviceProfileCapturePlatform
  captureCount: number
  autoUploadQueueUrl: string | null
  autoUploadQueueUrlTemplate: string | null
  autoUploadRequiresDeviceLabel: boolean
  validCaptures: number
  missingCaptures: number
  invalidCaptures: number
  complete: boolean
  status: PfxRealDeviceCaptureBatchProgressStatus
  validOutputFiles: string[]
  remainingOutputFiles: string[]
  invalidOutputFiles: string[]
  invalidCaptureFindings: Array<{
    outputFile: string
    reason: string
    findings: string[]
  }>
}

export interface PfxRealDeviceCaptureBatchProgress {
  schema: 'game-bot.r3f-pfx-real-device-capture-batch-progress.v1'
  summary: {
    totalBatches: number
    completeBatches: number
    partialBatches: number
    missingBatches: number
    totalCaptures: number
    validCaptures: number
    missingCaptures: number
    invalidCaptures: number
    platformProgress: Record<
      RealDeviceProfileCapturePlatform,
      {
        totalCaptures: number
        validCaptures: number
        missingCaptures: number
        invalidCaptures: number
        nextCaptureEffectId: string | null
        nextCaptureName: string | null
        nextCaptureProfileUrl: string | null
        nextCaptureAutoUploadUrl: string | null
        nextCaptureAutoUploadUrlTemplate: string | null
        nextBatchId: string | null
        nextBatchAutoUploadQueueUrl: string | null
        nextBatchAutoUploadQueueUrlTemplate: string | null
        autoUploadQueueUrl: string | null
        autoUploadQueueUrlTemplate: string | null
        autoUploadRequiresDeviceLabel: boolean
        nextCaptureOutputFile: string | null
      }
    >
    approvalStatus: 'non-approving-progress-summary'
    nextBatchId: string | null
    nextBatchPlatform: RealDeviceProfileCapturePlatform | null
    nextBatchSheetOutput: string | null
    nextBatchSheetCommand: string | null
    nextBatchAutoUploadQueueUrl: string | null
    nextBatchAutoUploadQueueUrlTemplate: string | null
    nextCaptureEffectId: string | null
    nextCaptureName: string | null
    nextCapturePlatform: RealDeviceProfileCapturePlatform | null
    nextCaptureProfileUrl: string | null
    nextCaptureAutoUploadUrl: string | null
    nextCaptureAutoUploadUrlTemplate: string | null
    nextCaptureUrlReachability: PfxRealDeviceCaptureBaseUrlReachability | 'unknown'
    nextCaptureOutputFile: string | null
    nextCaptureEvidence: string | null
    baseUrl: string | null
    baseUrlReachability: PfxRealDeviceCaptureBaseUrlReachability | 'unknown'
    readyForPhoneCapture: boolean
    operatorLaunchUrl: string | null
    operatorLaunchUrlTemplate: string | null
    autoDetectAutoUploadQueueUrl: string | null
    autoDetectAutoUploadQueueUrlTemplate: string | null
    autoUploadRequiresDeviceLabel: boolean
    baseUrlRemediationCommand: string | null
    lanProductionHandoffCommand: string | null
    baseUrlProductionHandoffCommand: string | null
    devServerCommand: string
  }
  batches: PfxRealDeviceCaptureBatchProgressRow[]
}

export interface PfxRealDeviceCaptureAuditOptions {
  outputRoot?: string
  effectIds?: string[]
  readCapture: (outputFile: string) => unknown
}

export interface PfxRealDeviceCapturePlatformStatus {
  valid: boolean
  outputFile: string
  reason: string
  findings: string[]
}

export interface PfxRealDeviceCaptureAuditEffect {
  effectId: string
  rank: number
  fullyCaptured: boolean
  platformStatus: Record<RealDeviceProfileCapturePlatform, PfxRealDeviceCapturePlatformStatus>
}

export interface PfxRealDeviceCaptureAudit {
  schema: 'game-bot.r3f-pfx-real-device-capture-audit.v1'
  passed: boolean
  summary: {
    totalEffects: number
    requiredCaptures: number
    validCaptures: number
    missingCaptures: number
    invalidCaptures: number
    fullyCapturedEffects: number
    platforms: RealDeviceProfileCapturePlatform[]
  }
  effects: PfxRealDeviceCaptureAuditEffect[]
}

export interface PfxRealDeviceCaptureAuditValidation {
  passed: boolean
  findings: string[]
  creditedEffectIds: string[]
}

export interface PfxRedTeamBlockingReviewManifestFromRealDeviceAuditOptions {
  reviewer?: string
  reviewedAt?: string
}

export const PROFILE_SCENARIOS: ProfileScenarioDefinition[] = [
  {
    id: 'mobile-force-field-single',
    mode: 'single',
    search: 'force field',
    mobileSafeOnly: true,
  },
  {
    id: 'mobile-explosion-caution-single',
    mode: 'single',
    search: 'explosion',
    mobileSafeOnly: false,
  },
  {
    id: 'mobile-smoke-puff-single',
    mode: 'single',
    search: 'smoke puff',
    mobileSafeOnly: true,
  },
  {
    id: 'mobile-ui-reward-burst-single',
    mode: 'single',
    search: 'ui reward burst',
    mobileSafeOnly: true,
  },
  {
    id: 'mobile-portal-idle-loop-caution-single',
    mode: 'single',
    search: 'portal idle loop',
    mobileSafeOnly: false,
  },
  {
    id: 'mobile-low-tier-stress-20',
    mode: 'stress',
    search: '',
    stressCount: 20,
    mobileSafeOnly: true,
  },
]

function scenarioForEffect(prefix: string, effectId: string, mobileSafe: boolean): ProfileScenarioDefinition {
  return {
    id: `${prefix}-${effectId}-single`,
    mode: 'single',
    search: effectId,
    mobileSafeOnly: mobileSafe,
  }
}

export const AUTHORED_PROFILE_SCENARIOS: ProfileScenarioDefinition[] = filterPfxCatalog({
  coverage: ['authored-preview'],
}).map(({ effect }) => scenarioForEffect('authored', effect.id, effect.mobileSafety === 'safe'))

export const PROFILE_BACKED_PROFILE_SCENARIOS: ProfileScenarioDefinition[] = filterPfxCatalog({
  coverage: ['profile-backed'],
}).map(({ effect }) => scenarioForEffect('profile-backed', effect.id, effect.mobileSafety === 'safe'))

export const CATALOG_PROFILE_SCENARIOS: ProfileScenarioDefinition[] = filterPfxCatalog({}).map(({ effect }) =>
  scenarioForEffect('catalog', effect.id, effect.mobileSafety === 'safe'),
)

export const CATALOG_STRESS_PROFILE_SCENARIOS: ProfileScenarioDefinition[] = createCatalogStressScenarios()

const REAL_DEVICE_PROFILE_PLATFORMS: RealDeviceProfileCapturePlatform[] = ['mobile-safari', 'chrome-android']

export type ProfileScenarioSuite = 'representative' | 'authored' | 'profile-backed' | 'catalog' | 'catalog-stress' | 'all'

export function createPfxRealDeviceProfileCapturePlan(
  options: PfxRealDeviceProfileCapturePlanOptions,
): PfxRealDeviceProfileCapturePlan {
  const outputRoot = trimTrailingSlash(options.outputRoot ?? '.context')
  const presetByEffectId = new Map(filterPfxCatalog({}).map((item) => [item.effect.id, item.preset]))
  const captures = AUTHORED_PROFILE_SCENARIOS.flatMap((scenario) =>
    REAL_DEVICE_PROFILE_PLATFORMS.map((platform): PfxRealDeviceProfileCapturePlanEntry => {
      const effectId = scenario.search
      const performanceTier = presetByEffectId.get(effectId)?.performance.tier
      if (!performanceTier) throw new Error(`Missing performance tier for real-device capture effect ${effectId}`)
      const concurrency = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[performanceTier]
      const outputFile = `${outputRoot}/${platform}/${profileArtifactFileNameForScenario(scenario)}`
      return {
        effectId,
        platform,
        scenarioId: scenario.id,
        profileUrl: profileUrlForEffect(options.baseUrl, effectId, platform, concurrency),
        outputFile,
        requiredCapture: {
          deviceClass: 'real-device',
          platform,
          runner: 'manual-real-device-browser',
          performanceTier,
          concurrency,
          sustainedDurationSeconds: 180,
        },
        verifierEvidence: `${platform}-profile:${outputFile}`,
        operatorChecklist: createRealDeviceCaptureChecklist(platform, effectId, outputFile, performanceTier, concurrency),
      }
    }),
  )

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-plan.v2',
    summary: {
      totalEffects: AUTHORED_PROFILE_SCENARIOS.length,
      totalCaptures: captures.length,
      platforms: [...REAL_DEVICE_PROFILE_PLATFORMS],
      requiredDeviceClass: 'real-device',
    },
    instructions: createRealDeviceCapturePlanInstructions(options.baseUrl),
    captures,
  }
}

export function exportPfxRealDeviceProfileCapturePlanMarkdown(plan: PfxRealDeviceProfileCapturePlan): string {
  const lines = [
    '# R3F PFX Real-Device Capture Plan',
    '',
    'Treat this handoff as non-approving capture execution input.',
    '',
    `Total effects: ${plan.summary.totalEffects}`,
    `Total captures: ${plan.summary.totalCaptures}`,
    `Required device class: \`${plan.summary.requiredDeviceClass}\``,
    `Platforms: ${plan.summary.platforms.map((platform) => `\`${platform}\``).join(', ')}`,
    '',
    '## Operator Instructions',
    '',
    `Base URL: \`${plan.instructions.baseUrl}\``,
    `Reachability: \`${plan.instructions.baseUrlReachability}\``,
    ...(plan.instructions.baseUrlRemediationCommand
      ? [`Regenerate command: \`${plan.instructions.baseUrlRemediationCommand}\``]
      : []),
    `Dev server command: \`${plan.instructions.devServerCommand}\``,
    `Profile JSON selector: \`${plan.instructions.profileJsonSelector}\``,
    `Audit command: \`${plan.instructions.auditCommand}\``,
    '',
    '### Platform Requirements',
    '',
    ...plan.summary.platforms.map((platform) => {
      const requirement = plan.instructions.platformRequirements[platform]
      return `- ${platform}: ${requirement.browser} on ${requirement.deviceClass}`
    }),
    '',
    '### Checklist',
    '',
    ...plan.instructions.operatorChecklist.map((item) => `- ${item}`),
    '',
    'Final approval still requires the strict regenerated real-device audit.',
    '',
  ]

  const capturesByEffect = new Map<string, PfxRealDeviceProfileCapturePlanEntry[]>()
  for (const capture of plan.captures) {
    capturesByEffect.set(capture.effectId, [...(capturesByEffect.get(capture.effectId) ?? []), capture])
  }

  for (const effect of PFX_TAXONOMY) {
    const captures = capturesByEffect.get(effect.id)
    if (!captures) continue

    lines.push(`## ${effect.name} (\`${effect.id}\`)`, '')
    for (const platform of plan.summary.platforms) {
      const capture = captures.find((candidate) => candidate.platform === platform)
      if (!capture) continue
      const platformLabel = platform === 'mobile-safari' ? 'Mobile Safari' : 'Chrome Android'
      lines.push(
        `- ${platformLabel}: [open capture URL](${capture.profileUrl})`,
        `  - Save to: \`${capture.outputFile}\``,
        `  - Downloaded filename: \`${profileArtifactFileNameForScenario({ id: capture.scenarioId, mode: 'single', search: capture.effectId })}\``,
        `  - Evidence: \`${capture.verifierEvidence}\``,
        `  - Scenario: \`${capture.scenarioId}\``,
      )
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function createPfxRealDeviceCaptureBatchPlan(
  plan: PfxRealDeviceProfileCapturePlan,
  options: PfxRealDeviceCaptureBatchPlanOptions = {},
): PfxRealDeviceCaptureBatchPlan {
  const batchSize = options.batchSize ?? 50
  const orderedCaptures = REAL_DEVICE_PROFILE_PLATFORMS.flatMap((platform) =>
    plan.captures.filter((capture) => capture.platform === platform),
  )
  const batches: PfxRealDeviceCaptureBatch[] = []
  for (let start = 0; start < orderedCaptures.length; start += batchSize) {
    const captures = orderedCaptures.slice(start, start + batchSize)
    const batchIndex = batches.length + 1
    const baseUrl = realDeviceBaseUrlFromProfileUrls(captures.map((capture) => capture.profileUrl))
    batches.push({
      batchId: `real-device-batch-${String(batchIndex).padStart(3, '0')}`,
      platform: captures[0]?.platform ?? 'mobile-safari',
      startIndex: start + 1,
      endIndex: start + captures.length,
      captureCount: captures.length,
      effectIds: captures.map((capture) => capture.effectId),
      profileUrls: captures.map((capture) => capture.profileUrl),
      outputFiles: captures.map((capture) => capture.outputFile),
      resumeCommand: realDeviceBatchPlanCommand(baseUrl),
    })
  }

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-batches.v1',
    summary: {
      totalCaptures: orderedCaptures.length,
      totalBatches: batches.length,
      batchSize,
      platforms: [...REAL_DEVICE_PROFILE_PLATFORMS],
    },
    instructions: {
      sourcePlanSchema: 'game-bot.r3f-pfx-real-device-capture-plan.v2',
      approvalStatus: 'non-approving-capture-execution-worklist',
      operatorChecklist: [
        'Run one batch at a time on the named real device platform.',
        'Save every listed outputFile before moving to the next batch.',
        'After each batch, run the real-device audit and regenerate the external evidence work order.',
      ],
    },
    batches,
  }
}

export function createPfxRealDeviceCaptureBatchSheetIndex(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  options: PfxRealDeviceCaptureBatchSheetIndexOptions = {},
): PfxRealDeviceCaptureBatchSheetIndex {
  const outputDirectory = trimTrailingSlash(options.outputDirectory ?? '.context/real-device-capture-batches')
  const baseUrl = realDeviceBaseUrlFromBatchPlan(batchPlan)
  const sheets = batchPlan.batches.map((batch): PfxRealDeviceCaptureBatchSheetIndexSheet => {
    const outputFile = `${outputDirectory}/${batch.batchId}.md`
    return {
      batchId: batch.batchId,
      platform: batch.platform,
      startIndex: batch.startIndex,
      endIndex: batch.endIndex,
      captureCount: batch.captureCount,
      firstEffectId: batch.effectIds[0] ?? '',
      lastEffectId: batch.effectIds[batch.effectIds.length - 1] ?? '',
      outputFile,
      autoUploadQueueUrl: realDeviceAutoUploadQueueUrl(baseUrl, batch.platform, batch.batchId),
      autoUploadQueueUrlTemplate: realDeviceAutoUploadQueueUrlTemplate(baseUrl, batch.platform, batch.batchId),
      autoUploadRequiresDeviceLabel: true,
      command: realDeviceBatchSheetCommand(batch.batchId, outputFile, baseUrl),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-batch-sheet-index.v1',
    summary: {
      totalBatches: sheets.length,
      totalCaptures: batchPlan.summary.totalCaptures,
      outputDirectory,
      approvalStatus: 'non-approving-batch-sheet-index',
      bulkCommand: realDeviceBulkBatchSheetCommand(outputDirectory, baseUrl),
    },
    sheets,
  }
}

export function exportPfxRealDeviceCaptureBatchSheetIndexMarkdown(
  index: PfxRealDeviceCaptureBatchSheetIndex,
): string {
  const operatorBaseUrl = index.sheets[0]?.autoUploadQueueUrl
    ? new URL(index.sheets[0].autoUploadQueueUrl).origin
    : null
  const lines = [
    '# R3F PFX Real-Device Capture Batch Sheet Index',
    '',
    'Treat this index as capture execution help only; final acceptance credits only strict audit-valid capture files.',
    '',
    `Total batches: ${index.summary.totalBatches}`,
    `Total captures: ${index.summary.totalCaptures}`,
    `Output directory: \`${index.summary.outputDirectory}\``,
    `Bulk command: \`${index.summary.bulkCommand}\``,
    ...(operatorBaseUrl
      ? [
          `Operator launch page: ${realDeviceOperatorLaunchUrl(operatorBaseUrl)}`,
          `Operator launch template: ${realDeviceOperatorLaunchUrlTemplate(operatorBaseUrl)}`,
          'Use the operator launch page on the target phone to enter a concrete device label before starting auto-run capture.',
        ]
      : []),
    ...productionHandoffCommandMarkdownLines(),
    '',
    '## Batch Sheets',
    '',
  ]

  for (const sheet of index.sheets) {
    lines.push(
      `- \`${sheet.batchId}\` (\`${sheet.platform}\`, captures ${sheet.startIndex}-${sheet.endIndex}, ${sheet.captureCount} captures, \`${sheet.firstEffectId}\` to \`${sheet.lastEffectId}\`): \`${sheet.outputFile}\``,
      `  - Auto-run: ${sheet.autoUploadQueueUrl}`,
      `  - Auto-run template: ${sheet.autoUploadQueueUrlTemplate}`,
      ...(sheet.autoUploadRequiresDeviceLabel ? ['  - Auto-run device label: required (`profileDeviceLabel`)'] : []),
      `  - \`${sheet.command}\``,
    )
  }

  return `${lines.join('\n').trimEnd()}\n`
}

export function validatePfxRealDeviceCaptureBatchSheetIndex(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  index: PfxRealDeviceCaptureBatchSheetIndex | undefined,
  options: PfxRealDeviceCaptureBatchSheetIndexOptions = {},
): PfxRealDeviceCaptureBatchSheetIndexValidation {
  if (!index) {
    return {
      passed: false,
      findings: ['missing real-device capture batch sheet index'],
    }
  }

  const outputDirectory = trimTrailingSlash(options.outputDirectory ?? '.context/real-device-capture-batches')
  const findings: string[] = []
  if (index.schema !== 'game-bot.r3f-pfx-real-device-capture-batch-sheet-index.v1') {
    findings.push(`schema expected game-bot.r3f-pfx-real-device-capture-batch-sheet-index.v1 but found ${index.schema}`)
  }
  if (index.summary.totalBatches !== batchPlan.summary.totalBatches) {
    findings.push(`summary totalBatches expected ${batchPlan.summary.totalBatches} but found ${index.summary.totalBatches}`)
  }
  if (index.summary.totalCaptures !== batchPlan.summary.totalCaptures) {
    findings.push(`summary totalCaptures expected ${batchPlan.summary.totalCaptures} but found ${index.summary.totalCaptures}`)
  }
  if (index.summary.outputDirectory !== outputDirectory) {
    findings.push(`summary outputDirectory expected ${outputDirectory} but found ${index.summary.outputDirectory}`)
  }
  if (index.summary.approvalStatus !== 'non-approving-batch-sheet-index') {
    findings.push(`summary approvalStatus expected non-approving-batch-sheet-index but found ${index.summary.approvalStatus}`)
  }
  const baseUrl = realDeviceBaseUrlFromBatchPlan(batchPlan)
  if (index.summary.bulkCommand !== realDeviceBulkBatchSheetCommand(outputDirectory, baseUrl)) {
    findings.push('summary bulkCommand does not match expected batch sheet index command')
  }

  const sheetsByBatchId = new Map(index.sheets.map((sheet) => [sheet.batchId, sheet]))
  const duplicateSheetBatchIds = duplicateValues(index.sheets.map((sheet) => sheet.batchId))
  const batchIds = new Set(batchPlan.batches.map((batch) => batch.batchId))
  const unknownSheetBatchIds = index.sheets.map((sheet) => sheet.batchId).filter((batchId) => !batchIds.has(batchId))
  if (duplicateSheetBatchIds.length > 0) {
    findings.push(`batch sheet index has duplicate batch rows: ${duplicateSheetBatchIds.join(', ')}`)
  }
  if (unknownSheetBatchIds.length > 0) {
    findings.push(`batch sheet index has unknown batch rows: ${unknownSheetBatchIds.join(', ')}`)
  }

  for (const batch of batchPlan.batches) {
    const sheet = sheetsByBatchId.get(batch.batchId)
    if (!sheet) {
      findings.push(`batch sheet index missing ${batch.batchId}`)
      continue
    }
    const expectedOutputFile = `${outputDirectory}/${batch.batchId}.md`
    if (sheet.platform !== batch.platform) {
      findings.push(`${batch.batchId} platform expected ${batch.platform} but found ${sheet.platform}`)
    }
    if (sheet.startIndex !== batch.startIndex) {
      findings.push(`${batch.batchId} startIndex expected ${batch.startIndex} but found ${sheet.startIndex}`)
    }
    if (sheet.endIndex !== batch.endIndex) {
      findings.push(`${batch.batchId} endIndex expected ${batch.endIndex} but found ${sheet.endIndex}`)
    }
    if (sheet.captureCount !== batch.captureCount) {
      findings.push(`${batch.batchId} captureCount expected ${batch.captureCount} but found ${sheet.captureCount}`)
    }
    const firstEffectId = batch.effectIds[0] ?? ''
    const lastEffectId = batch.effectIds[batch.effectIds.length - 1] ?? ''
    if (sheet.firstEffectId !== firstEffectId) {
      findings.push(`${batch.batchId} firstEffectId expected ${firstEffectId} but found ${sheet.firstEffectId}`)
    }
    if (sheet.lastEffectId !== lastEffectId) {
      findings.push(`${batch.batchId} lastEffectId expected ${lastEffectId} but found ${sheet.lastEffectId}`)
    }
    if (sheet.outputFile !== expectedOutputFile) {
      findings.push(`${batch.batchId} outputFile expected ${expectedOutputFile} but found ${sheet.outputFile}`)
    }
    if (sheet.autoUploadQueueUrl !== realDeviceAutoUploadQueueUrl(baseUrl, batch.platform, batch.batchId)) {
      findings.push(`${batch.batchId} autoUploadQueueUrl does not match expected batch-scoped queue URL`)
    }
    if (sheet.autoUploadQueueUrlTemplate !== realDeviceAutoUploadQueueUrlTemplate(baseUrl, batch.platform, batch.batchId)) {
      findings.push(`${batch.batchId} autoUploadQueueUrlTemplate does not match expected labeled queue URL template`)
    }
    if (sheet.autoUploadRequiresDeviceLabel !== true) {
      findings.push(`${batch.batchId} autoUploadRequiresDeviceLabel must be true`)
    }
    if (sheet.command !== realDeviceBatchSheetCommand(batch.batchId, expectedOutputFile, baseUrl)) {
      findings.push(`${batch.batchId} command does not match expected batch sheet command`)
    }
  }

  return {
    passed: findings.length === 0,
    findings,
  }
}

function realDeviceBatchPlanCommand(baseUrl: string | undefined): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan',
    baseUrl ? `-- --base-url ${baseUrl}` : '--',
    '--batch-output .context/r3f-pfx-real-device-capture-batches.json',
  ].join(' ')
}

function realDeviceBulkBatchSheetCommand(outputDirectory: string, baseUrl: string | undefined): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan',
    baseUrl ? `-- --base-url ${baseUrl}` : '--',
    '--batch-output .context/r3f-pfx-real-device-capture-batches.json',
    `--batch-sheet-directory ${outputDirectory}`,
    '--batch-sheet-index-output .context/r3f-pfx-real-device-capture-batch-sheet-index.json',
    '--batch-sheet-index-markdown-output .context/r3f-pfx-real-device-capture-batch-sheet-index.md',
  ].join(' ')
}

export function createPfxRealDeviceCaptureBatchSheet(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  options: PfxRealDeviceCaptureBatchSheetOptions = {},
): PfxRealDeviceCaptureBatchSheet {
  const batch =
    batchPlan.batches.find((candidate) => candidate.batchId === options.batchId) ??
    (options.batchId == null ? batchPlan.batches[0] : undefined)
  if (!batch) {
    throw new Error(`Unknown real-device capture batch "${options.batchId}"`)
  }

  const effectNamesById = new Map(PFX_TAXONOMY.map((effect) => [effect.id, effect.name]))
  const baseUrl = realDeviceBaseUrlFromBatchPlan(batchPlan)
  if (!baseUrl) {
    throw new Error('Real-device capture batch plan is missing profile URLs')
  }
  const planInstructions = createRealDeviceCapturePlanInstructions(baseUrl)
  const captures = batch.effectIds.map((effectId, index): PfxRealDeviceCaptureBatchSheetCapture => {
    const outputFile = batch.outputFiles[index]
    const performanceTier = canonicalPerformanceTierForEffect(effectId)
    const concurrency = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[performanceTier]
    return {
      effectId,
      name: effectNamesById.get(effectId) ?? effectId,
      platform: batch.platform,
      scenarioId: `authored-${effectId}-single`,
      profileUrl: batch.profileUrls[index],
      autoUploadUrl: realDeviceCaptureAutoUploadUrl(baseUrl, batch.platform, batch.batchId, effectId),
      autoUploadUrlTemplate: realDeviceCaptureAutoUploadUrlTemplate(baseUrl, batch.platform, batch.batchId, effectId),
      autoUploadRequiresDeviceLabel: true,
      outputFile,
      requiredCapture: {
        deviceClass: 'real-device',
        platform: batch.platform,
        runner: 'manual-real-device-browser',
        performanceTier,
        concurrency,
        sustainedDurationSeconds: 180,
      },
      verifierEvidence: `${batch.platform}-profile:${outputFile}`,
      operatorChecklist: createRealDeviceCaptureChecklist(
        batch.platform,
        effectId,
        outputFile,
        performanceTier,
        concurrency,
      ),
      captured: false,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-batch-sheet.v1',
    instructions: {
      approvalStatus: 'non-approving-real-device-capture-batch-sheet',
      sourceBatchPlanSchema: batchPlan.schema,
      profileJsonSelector: planInstructions.profileJsonSelector,
      auditCommand: planInstructions.auditCommand,
      operatorChecklist: [
        ...batchPlan.instructions.operatorChecklist,
        'Use this sheet as execution input only; final acceptance credits only the regenerated real-device audit.',
        'Leave captured false in generated sheets; capture completion is proven by audit-valid output files.',
      ],
    },
    batch,
    captures,
  }
}

export function exportPfxRealDeviceCaptureBatchSheetMarkdown(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  batchId: string,
): string {
  const sheet = createPfxRealDeviceCaptureBatchSheet(batchPlan, { batchId })
  const { batch } = sheet
  const baseUrl = realDeviceBaseUrlFromBatchPlan(batchPlan)
  if (!baseUrl) {
    throw new Error('Real-device capture batch plan is missing profile URLs')
  }
  const platformAutoRunUrl = realDeviceAutoUploadQueueUrl(baseUrl, batch.platform, batch.batchId)
  const operatorLaunchUrl = realDeviceOperatorLaunchUrl(baseUrl)
  const operatorLaunchUrlTemplate = realDeviceOperatorLaunchUrlTemplate(baseUrl)
  const lines = [
    `# R3F PFX Real-Device Capture Batch ${batch.batchId}`,
    '',
    'Treat this sheet as non-approving capture execution input.',
    '',
    `Platform: \`${batch.platform}\``,
    `Captures: ${batch.captureCount}`,
    `Index range: ${batch.startIndex}-${batch.endIndex}`,
    `Audit command: \`${sheet.instructions.auditCommand}\``,
    `Ingest downloads command: \`${realDeviceCaptureIngestCommand(batch.batchId)}\``,
    'Put downloaded JSON files in `.context/real-device-downloads`, run the ingest command, then run the audit command.',
    `Operator launch page: ${operatorLaunchUrl}`,
    `Operator launch template: ${operatorLaunchUrlTemplate}`,
    `Open the operator launch page from ${realDeviceCapturePlatformBrowserName(batch.platform)}, enter a concrete device label, then start this batch auto-run.`,
    `Platform auto-run URL: ${platformAutoRunUrl}`,
    `Open the platform auto-run URL from ${realDeviceCapturePlatformBrowserName(batch.platform)} to measure, upload, and advance through this batch.`,
    '',
    '## Operator Checklist',
    '',
    ...sheet.captures.map((capture) => {
      return [
        `- [ ] ${capture.name} (\`${capture.effectId}\`)`,
        `  - Open: ${capture.profileUrl}`,
        `  - Auto-upload: ${capture.autoUploadUrl}`,
        `  - Auto-upload template: ${capture.autoUploadUrlTemplate}`,
        '  - Auto-upload device label: required (`profileDeviceLabel`)',
        `  - Download JSON filename: \`${profileArtifactFileNameForScenario({ id: capture.scenarioId, mode: 'single', search: capture.effectId })}\``,
        `  - Save: \`${capture.outputFile}\``,
        `  - Evidence: \`${capture.verifierEvidence}\``,
        '  - Confirm screenshot-readback overdraw and real-device touch metadata before checking this row.',
      ].join('\n')
    }),
    '',
    'Final approval still requires the strict regenerated real-device audit and independent final approval metadata.',
    '',
  ]

  return `${lines.join('\n').trimEnd()}\n`
}

export function createPfxRealDeviceCaptureBatchProgress(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  audit: PfxRealDeviceCaptureAudit,
): PfxRealDeviceCaptureBatchProgress {
  const baseUrl = realDeviceBaseUrlFromBatchPlan(batchPlan)
  const statusByOutputFile = new Map<string, PfxRealDeviceCapturePlatformStatus>()
  for (const effect of audit.effects) {
    for (const platform of REAL_DEVICE_PROFILE_PLATFORMS) {
      const status = effect.platformStatus[platform]
      statusByOutputFile.set(status.outputFile, status)
    }
  }

  const batches = batchPlan.batches.map((batch): PfxRealDeviceCaptureBatchProgressRow => {
    const validOutputFiles: string[] = []
    const remainingOutputFiles: string[] = []
    const invalidOutputFiles: string[] = []
    const invalidCaptureFindings: PfxRealDeviceCaptureBatchProgressRow['invalidCaptureFindings'] = []

    for (const outputFile of batch.outputFiles) {
      const status = statusByOutputFile.get(outputFile)
      if (status?.valid) {
        validOutputFiles.push(outputFile)
      } else if (!status || status.reason === 'missing capture file') {
        remainingOutputFiles.push(outputFile)
      } else {
        invalidOutputFiles.push(outputFile)
        invalidCaptureFindings.push({
          outputFile,
          reason: status.reason,
          findings: status.findings,
        })
      }
    }

    const validCaptures = validOutputFiles.length
    const missingCaptures = remainingOutputFiles.length
    const invalidCaptures = invalidOutputFiles.length
    const complete = validCaptures === batch.captureCount && missingCaptures === 0 && invalidCaptures === 0
    const status: PfxRealDeviceCaptureBatchProgressStatus = complete
      ? 'complete'
      : validCaptures === 0 && invalidCaptures === 0
        ? 'missing'
        : 'partial'

    return {
      batchId: batch.batchId,
      platform: batch.platform,
      captureCount: batch.captureCount,
      autoUploadQueueUrl: baseUrl ? realDeviceAutoUploadQueueUrl(baseUrl, batch.platform, batch.batchId) : null,
      autoUploadQueueUrlTemplate: baseUrl ? realDeviceAutoUploadQueueUrlTemplate(baseUrl, batch.platform, batch.batchId) : null,
      autoUploadRequiresDeviceLabel: true,
      validCaptures,
      missingCaptures,
      invalidCaptures,
      complete,
      status,
      validOutputFiles,
      remainingOutputFiles,
      invalidOutputFiles,
      invalidCaptureFindings,
    }
  })

  const nextBatch = batches.find((batch) => !batch.complete)
  const nextBatchPlan = nextBatch ? batchPlan.batches.find((batch) => batch.batchId === nextBatch.batchId) : undefined
  const nextCaptureIndex = nextBatchPlan
    ? nextBatchPlan.outputFiles.findIndex((outputFile) => !statusByOutputFile.get(outputFile)?.valid)
    : -1
  const nextCaptureEffectId =
    nextBatchPlan && nextCaptureIndex >= 0 ? nextBatchPlan.effectIds[nextCaptureIndex] : null
  const nextCaptureOutputFile =
    nextBatchPlan && nextCaptureIndex >= 0 ? nextBatchPlan.outputFiles[nextCaptureIndex] : null
  const nextCaptureProfileUrl =
    nextBatchPlan && nextCaptureIndex >= 0 ? nextBatchPlan.profileUrls[nextCaptureIndex] : null
  const nextCaptureAutoUploadUrl =
    baseUrl && nextBatchPlan && nextCaptureEffectId
      ? realDeviceCaptureAutoUploadUrl(baseUrl, nextBatchPlan.platform, nextBatchPlan.batchId, nextCaptureEffectId)
      : null
  const nextCaptureAutoUploadUrlTemplate =
    baseUrl && nextBatchPlan && nextCaptureEffectId
      ? realDeviceCaptureAutoUploadUrlTemplate(baseUrl, nextBatchPlan.platform, nextBatchPlan.batchId, nextCaptureEffectId)
      : null
  const nextBatchAutoUploadQueueUrl =
    baseUrl && nextBatchPlan ? realDeviceAutoUploadQueueUrl(baseUrl, nextBatchPlan.platform, nextBatchPlan.batchId) : null
  const nextBatchAutoUploadQueueUrlTemplate =
    baseUrl && nextBatchPlan ? realDeviceAutoUploadQueueUrlTemplate(baseUrl, nextBatchPlan.platform, nextBatchPlan.batchId) : null
  const nextBatchSheetOutput = nextBatch ? realDeviceBatchSheetOutputFile(nextBatch.batchId) : null
  const baseUrlReachability = baseUrl ? classifyRealDeviceCaptureBaseUrl(baseUrl) : 'unknown'
  const platformProgress = Object.fromEntries(
    REAL_DEVICE_PROFILE_PLATFORMS.map((platform) => {
      const platformBatches = batches.filter((batch) => batch.platform === platform)
      const platformNext = nextRealDeviceCaptureForPlatform(batchPlan, platform, statusByOutputFile)
      const platformNextBatch = platformNext
        ? batchPlan.batches.find((batch) => batch.batchId === platformNext.batchId)
        : undefined
      return [
        platform,
        {
          totalCaptures: platformBatches.reduce((total, batch) => total + batch.captureCount, 0),
          validCaptures: platformBatches.reduce((total, batch) => total + batch.validCaptures, 0),
          missingCaptures: platformBatches.reduce((total, batch) => total + batch.missingCaptures, 0),
          invalidCaptures: platformBatches.reduce((total, batch) => total + batch.invalidCaptures, 0),
          nextCaptureEffectId: platformNext?.effectId ?? null,
          nextCaptureName: platformNext?.name ?? null,
          nextCaptureProfileUrl: platformNext?.profileUrl ?? null,
          nextCaptureAutoUploadUrl:
            baseUrl && platformNext
              ? realDeviceCaptureAutoUploadUrl(baseUrl, platform, platformNext.batchId, platformNext.effectId)
              : null,
          nextCaptureAutoUploadUrlTemplate:
            baseUrl && platformNext
              ? realDeviceCaptureAutoUploadUrlTemplate(baseUrl, platform, platformNext.batchId, platformNext.effectId)
              : null,
          nextBatchId: platformNext?.batchId ?? null,
          nextBatchAutoUploadQueueUrl:
            baseUrl && platformNextBatch
              ? realDeviceAutoUploadQueueUrl(baseUrl, platformNextBatch.platform, platformNextBatch.batchId)
              : null,
          nextBatchAutoUploadQueueUrlTemplate:
            baseUrl && platformNextBatch
              ? realDeviceAutoUploadQueueUrlTemplate(baseUrl, platformNextBatch.platform, platformNextBatch.batchId)
              : null,
          autoUploadQueueUrl: baseUrl ? realDeviceAutoUploadQueueUrl(baseUrl, platform) : null,
          autoUploadQueueUrlTemplate: baseUrl ? realDeviceAutoUploadQueueUrlTemplate(baseUrl, platform) : null,
          autoUploadRequiresDeviceLabel: true,
          nextCaptureOutputFile: platformNext?.outputFile ?? null,
        },
      ]
    }),
  ) as PfxRealDeviceCaptureBatchProgress['summary']['platformProgress']

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-batch-progress.v1',
    summary: {
      totalBatches: batches.length,
      completeBatches: batches.filter((batch) => batch.status === 'complete').length,
      partialBatches: batches.filter((batch) => batch.status === 'partial').length,
      missingBatches: batches.filter((batch) => batch.status === 'missing').length,
      totalCaptures: batches.reduce((total, batch) => total + batch.captureCount, 0),
      validCaptures: batches.reduce((total, batch) => total + batch.validCaptures, 0),
      missingCaptures: batches.reduce((total, batch) => total + batch.missingCaptures, 0),
      invalidCaptures: batches.reduce((total, batch) => total + batch.invalidCaptures, 0),
      platformProgress,
      approvalStatus: 'non-approving-progress-summary',
      nextBatchId: nextBatch?.batchId ?? null,
      nextBatchPlatform: nextBatch?.platform ?? null,
      nextBatchSheetOutput,
      nextBatchSheetCommand:
        nextBatch && nextBatchSheetOutput
          ? realDeviceBatchSheetCommand(nextBatch.batchId, nextBatchSheetOutput, baseUrl)
          : null,
      nextBatchAutoUploadQueueUrl,
      nextBatchAutoUploadQueueUrlTemplate,
      nextCaptureEffectId,
      nextCaptureName: nextCaptureEffectId
        ? PFX_TAXONOMY.find((effect) => effect.id === nextCaptureEffectId)?.name ?? nextCaptureEffectId
        : null,
      nextCapturePlatform: nextBatchPlan && nextCaptureIndex >= 0 ? nextBatchPlan.platform : null,
      nextCaptureProfileUrl,
      nextCaptureAutoUploadUrl,
      nextCaptureAutoUploadUrlTemplate,
      nextCaptureUrlReachability: nextCaptureProfileUrl
        ? classifyRealDeviceCaptureBaseUrl(nextCaptureProfileUrl)
        : 'unknown',
      nextCaptureOutputFile,
      nextCaptureEvidence:
        nextBatchPlan && nextCaptureOutputFile ? `${nextBatchPlan.platform}-profile:${nextCaptureOutputFile}` : null,
      baseUrl,
      baseUrlReachability,
      readyForPhoneCapture: baseUrlReachability === 'network-reachable',
      operatorLaunchUrl: baseUrl ? realDeviceOperatorLaunchUrl(baseUrl) : null,
      operatorLaunchUrlTemplate: baseUrl ? realDeviceOperatorLaunchUrlTemplate(baseUrl) : null,
      autoDetectAutoUploadQueueUrl: baseUrl ? realDeviceAutoUploadQueueUrl(baseUrl, 'auto') : null,
      autoDetectAutoUploadQueueUrlTemplate: baseUrl ? realDeviceAutoUploadQueueUrlTemplate(baseUrl, 'auto') : null,
      autoUploadRequiresDeviceLabel: true,
      baseUrlRemediationCommand:
        baseUrl && baseUrlReachability === 'local-only' ? realDeviceCaptureBaseUrlRemediationCommand(baseUrl) : null,
      lanProductionHandoffCommand:
        baseUrlReachability === 'local-only' ? PFX_LAN_PRODUCTION_HANDOFF_COMMAND : null,
      baseUrlProductionHandoffCommand:
        baseUrlReachability === 'local-only' ? PFX_BASE_URL_PRODUCTION_HANDOFF_COMMAND : null,
      devServerCommand: REAL_DEVICE_DEV_SERVER_COMMAND,
    },
    batches,
  }
}

function nextRealDeviceCaptureForPlatform(
  batchPlan: PfxRealDeviceCaptureBatchPlan,
  platform: RealDeviceProfileCapturePlatform,
  statusByOutputFile: Map<string, PfxRealDeviceCapturePlatformStatus>,
): { batchId: string; effectId: string; name: string; profileUrl: string; outputFile: string } | null {
  for (const batch of batchPlan.batches) {
    if (batch.platform !== platform) continue
    const index = batch.outputFiles.findIndex((outputFile) => !statusByOutputFile.get(outputFile)?.valid)
    if (index < 0) continue
    const effectId = batch.effectIds[index]
    return {
      batchId: batch.batchId,
      effectId,
      name: PFX_TAXONOMY.find((effect) => effect.id === effectId)?.name ?? effectId,
      profileUrl: batch.profileUrls[index],
      outputFile: batch.outputFiles[index],
    }
  }
  return null
}

function realDeviceAutoUploadQueueUrl(
  baseUrl: string,
  platform: RealDeviceProfileCapturePlatform | 'auto',
  batchId?: string,
): string {
  const url = new URL('/__r3f-pfx-capture-next', baseUrl)
  url.searchParams.set('platform', platform)
  url.searchParams.set('profileAutoUpload', '1')
  if (batchId) url.searchParams.set('batchId', batchId)
  return url.toString()
}

function realDeviceAutoUploadQueueUrlTemplate(
  baseUrl: string,
  platform: RealDeviceProfileCapturePlatform | 'auto',
  batchId?: string,
): string {
  return `${realDeviceAutoUploadQueueUrl(baseUrl, platform, batchId)}&profileDeviceLabel={profileDeviceLabel}`
}

function realDeviceOperatorLaunchUrl(baseUrl: string): string {
  return new URL('/__r3f-pfx-capture-operator', baseUrl).toString()
}

function realDeviceOperatorLaunchUrlTemplate(baseUrl: string): string {
  return `${realDeviceOperatorLaunchUrl(baseUrl)}?profileDeviceLabel={profileDeviceLabel}`
}

function realDeviceCaptureAutoUploadUrl(
  baseUrl: string,
  platform: RealDeviceProfileCapturePlatform,
  batchId: string,
  effectId: string,
): string {
  const url = new URL(realDeviceAutoUploadQueueUrl(baseUrl, platform, batchId))
  url.searchParams.set('effectId', effectId)
  return url.toString()
}

function realDeviceCaptureAutoUploadUrlTemplate(
  baseUrl: string,
  platform: RealDeviceProfileCapturePlatform,
  batchId: string,
  effectId: string,
): string {
  return `${realDeviceCaptureAutoUploadUrl(baseUrl, platform, batchId, effectId)}&profileDeviceLabel={profileDeviceLabel}`
}

function realDeviceCapturePlatformBrowserName(platform: RealDeviceProfileCapturePlatform): string {
  return platform === 'mobile-safari' ? 'Mobile Safari' : 'Chrome Android'
}

export function exportPfxRealDeviceCaptureBatchProgressMarkdown(progress: PfxRealDeviceCaptureBatchProgress): string {
  const lines = [
    '# R3F PFX Real-Device Batch Progress',
    '',
    'Treat this handoff as non-approving capture resume input.',
    '',
    ...(progress.summary.operatorLaunchUrl || progress.summary.operatorLaunchUrlTemplate
      ? [
          'Operator workflow: open the launch page on the target phone, enter a concrete device label, then start platform or batch auto-run from that page.',
          ...(progress.summary.operatorLaunchUrl
            ? [`Operator launch page: \`${progress.summary.operatorLaunchUrl}\``]
            : []),
          ...(progress.summary.operatorLaunchUrlTemplate
            ? [`Operator launch template: \`${progress.summary.operatorLaunchUrlTemplate}\``]
            : []),
          '',
        ]
      : []),
    `Total batches: ${progress.summary.totalBatches}`,
    `Complete batches: ${progress.summary.completeBatches}`,
    `Partial batches: ${progress.summary.partialBatches}`,
    `Missing batches: ${progress.summary.missingBatches}`,
    `Valid captures: ${progress.summary.validCaptures} / ${progress.summary.totalCaptures}`,
    `Missing captures: ${progress.summary.missingCaptures}`,
    `Invalid captures: ${progress.summary.invalidCaptures}`,
    `Mobile Safari captures: ${progress.summary.platformProgress['mobile-safari'].validCaptures} / ${progress.summary.platformProgress['mobile-safari'].totalCaptures}; missing ${progress.summary.platformProgress['mobile-safari'].missingCaptures}; invalid ${progress.summary.platformProgress['mobile-safari'].invalidCaptures}`,
    ...(progress.summary.platformProgress['mobile-safari'].nextCaptureEffectId
      ? [
          `Mobile Safari next: ${progress.summary.platformProgress['mobile-safari'].nextCaptureName} (\`${progress.summary.platformProgress['mobile-safari'].nextCaptureEffectId}\`)`,
          realDeviceProgressUrlLine(
            'Mobile Safari next URL',
            progress.summary.platformProgress['mobile-safari'].nextCaptureProfileUrl,
          ),
          ...(progress.summary.platformProgress['mobile-safari'].nextCaptureAutoUploadUrlTemplate
            ? [
                `Mobile Safari next auto-upload template: ${progress.summary.platformProgress['mobile-safari'].nextCaptureAutoUploadUrlTemplate}`,
              ]
            : []),
          ...(progress.summary.platformProgress['mobile-safari'].autoUploadQueueUrlTemplate
            ? [`Mobile Safari auto-run template: ${progress.summary.platformProgress['mobile-safari'].autoUploadQueueUrlTemplate}`]
            : []),
          ...(progress.summary.platformProgress['mobile-safari'].nextBatchAutoUploadQueueUrlTemplate
            ? [
                `Mobile Safari next batch auto-run template: ${progress.summary.platformProgress['mobile-safari'].nextBatchAutoUploadQueueUrlTemplate}`,
              ]
            : []),
          `Mobile Safari next output: \`${progress.summary.platformProgress['mobile-safari'].nextCaptureOutputFile}\``,
        ]
      : ['Mobile Safari next: `complete`']),
    `Chrome Android captures: ${progress.summary.platformProgress['chrome-android'].validCaptures} / ${progress.summary.platformProgress['chrome-android'].totalCaptures}; missing ${progress.summary.platformProgress['chrome-android'].missingCaptures}; invalid ${progress.summary.platformProgress['chrome-android'].invalidCaptures}`,
    ...(progress.summary.platformProgress['chrome-android'].nextCaptureEffectId
      ? [
          `Chrome Android next: ${progress.summary.platformProgress['chrome-android'].nextCaptureName} (\`${progress.summary.platformProgress['chrome-android'].nextCaptureEffectId}\`)`,
          realDeviceProgressUrlLine(
            'Chrome Android next URL',
            progress.summary.platformProgress['chrome-android'].nextCaptureProfileUrl,
          ),
          ...(progress.summary.platformProgress['chrome-android'].nextCaptureAutoUploadUrlTemplate
            ? [
                `Chrome Android next auto-upload template: ${progress.summary.platformProgress['chrome-android'].nextCaptureAutoUploadUrlTemplate}`,
              ]
            : []),
          ...(progress.summary.platformProgress['chrome-android'].autoUploadQueueUrlTemplate
            ? [
                `Chrome Android auto-run template: ${progress.summary.platformProgress['chrome-android'].autoUploadQueueUrlTemplate}`,
              ]
            : []),
          ...(progress.summary.platformProgress['chrome-android'].nextBatchAutoUploadQueueUrlTemplate
            ? [
                `Chrome Android next batch auto-run template: ${progress.summary.platformProgress['chrome-android'].nextBatchAutoUploadQueueUrlTemplate}`,
              ]
            : []),
          `Chrome Android next output: \`${progress.summary.platformProgress['chrome-android'].nextCaptureOutputFile}\``,
        ]
      : ['Chrome Android next: `complete`']),
    ...(progress.summary.nextBatchId
      ? [
          `Next batch: \`${progress.summary.nextBatchId}\` (\`${progress.summary.nextBatchPlatform}\`)`,
          ...(progress.summary.nextCaptureEffectId
            ? [
                `Next capture: ${progress.summary.nextCaptureName} (\`${progress.summary.nextCaptureEffectId}\`) on \`${progress.summary.nextCapturePlatform}\``,
                realDeviceProgressUrlLine('Next capture URL', progress.summary.nextCaptureProfileUrl),
          ...(progress.summary.nextCaptureAutoUploadUrlTemplate
            ? [`Next capture auto-upload template: ${progress.summary.nextCaptureAutoUploadUrlTemplate}`]
            : []),
          ...(progress.summary.nextBatchAutoUploadQueueUrlTemplate
            ? [`Next batch auto-run template: ${progress.summary.nextBatchAutoUploadQueueUrlTemplate}`]
            : []),
          `Next capture URL reachability: \`${progress.summary.nextCaptureUrlReachability}\``,
                `Next capture output: \`${progress.summary.nextCaptureOutputFile}\``,
                `Next capture evidence: \`${progress.summary.nextCaptureEvidence}\``,
              ]
            : []),
          `Next batch sheet command: \`${progress.summary.nextBatchSheetCommand}\``,
        ]
      : ['Next batch: `complete`']),
    ...(progress.summary.baseUrl ? [`Base URL: \`${progress.summary.baseUrl}\``] : []),
    `Reachability: \`${progress.summary.baseUrlReachability}\``,
    `Ready for phone capture: ${progress.summary.readyForPhoneCapture ? 'yes' : 'no'}`,
    ...(progress.summary.autoDetectAutoUploadQueueUrlTemplate
      ? [`Auto-detect auto-run template: ${progress.summary.autoDetectAutoUploadQueueUrlTemplate}`]
      : []),
    ...(progress.summary.baseUrlRemediationCommand
      ? [`Regenerate command: \`${progress.summary.baseUrlRemediationCommand}\``]
      : []),
    ...(progress.summary.lanProductionHandoffCommand
      ? [`LAN handoff command: \`${progress.summary.lanProductionHandoffCommand}\``]
      : []),
    ...(progress.summary.baseUrlProductionHandoffCommand
      ? [`Tunnel/base URL handoff command: \`${progress.summary.baseUrlProductionHandoffCommand}\``]
      : []),
    `Dev server command: \`${progress.summary.devServerCommand}\``,
    '',
    'Final acceptance still requires the strict regenerated real-device audit and final approval metadata.',
    '',
  ]

  for (const batch of progress.batches.filter((candidate) => candidate.status !== 'complete')) {
    lines.push(
      `## ${batch.batchId} (\`${batch.status}\`)`,
      '',
      `Platform: \`${batch.platform}\``,
      ...(batch.autoUploadQueueUrlTemplate ? [`Batch auto-run template: ${batch.autoUploadQueueUrlTemplate}`] : []),
      `Valid captures: ${batch.validCaptures} / ${batch.captureCount}`,
      `Remaining output files: ${batch.remainingOutputFiles.length}`,
      `Invalid output files: ${batch.invalidOutputFiles.length}`,
      '',
    )

    if (batch.remainingOutputFiles.length > 0) {
      lines.push('### Next Remaining Files', '')
      for (const outputFile of batch.remainingOutputFiles.slice(0, 10)) {
        lines.push(`- \`${outputFile}\``)
      }
      if (batch.remainingOutputFiles.length > 10) {
        lines.push(`- ...${batch.remainingOutputFiles.length - 10} more`)
      }
      lines.push('')
    }

    if (batch.invalidOutputFiles.length > 0) {
      lines.push('### Invalid Files To Re-Capture', '')
      for (const outputFile of batch.invalidOutputFiles.slice(0, 10)) {
        lines.push(`- \`${outputFile}\``)
      }
      if (batch.invalidOutputFiles.length > 10) {
        lines.push(`- ...${batch.invalidOutputFiles.length - 10} more`)
      }
      lines.push('')
    }

    if (batch.invalidCaptureFindings.length > 0) {
      lines.push('### Invalid Capture Findings', '')
      for (const invalid of batch.invalidCaptureFindings.slice(0, 10)) {
        lines.push(`- \`${invalid.outputFile}\` - ${invalid.reason}`)
        for (const finding of invalid.findings) {
          lines.push(`  - ${finding}`)
        }
      }
      if (batch.invalidCaptureFindings.length > 10) {
        lines.push(`- ...${batch.invalidCaptureFindings.length - 10} more invalid capture finding sets`)
      }
      lines.push('')
    }
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function realDeviceProgressUrlLine(label: string, url: string): string {
  return `${label}: ${url} ([open](${url}))`
}

function realDeviceBatchSheetOutputFile(batchId: string): string {
  return `.context/r3f-pfx-real-device-capture-${batchId.replace(/^real-device-/, '')}.md`
}

function realDeviceBatchSheetCommand(batchId: string, outputFile: string, baseUrl: string | undefined): string {
  return [
    'npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan',
    baseUrl ? `-- --base-url ${baseUrl}` : '--',
    '--batch-output .context/r3f-pfx-real-device-capture-batches.json',
    `--batch-sheet-output ${outputFile}`,
    `--batch-id ${batchId}`,
  ].join(' ')
}

function realDeviceBaseUrlFromBatchPlan(batchPlan: PfxRealDeviceCaptureBatchPlan): string | undefined {
  return realDeviceBaseUrlFromProfileUrls(batchPlan.batches.flatMap((batch) => batch.profileUrls))
}

function realDeviceBaseUrlFromProfileUrls(profileUrls: string[]): string | undefined {
  const firstProfileUrl = profileUrls[0]
  if (!firstProfileUrl) return undefined
  try {
    const url = new URL(firstProfileUrl)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return undefined
  }
}

function createRealDeviceCapturePlanInstructions(baseUrl: string): PfxRealDeviceCapturePlanInstructions {
  const baseUrlReachability = classifyRealDeviceCaptureBaseUrl(baseUrl)
  const baseUrlRemediationCommand =
    baseUrlReachability === 'local-only' ? realDeviceCaptureBaseUrlRemediationCommand(baseUrl) : undefined
  const localOnlyChecklist =
    baseUrlReachability === 'local-only'
      ? [
          'Base URL is local-only; phones cannot reach loopback/localhost. Regenerate with the remediation command before collecting real-device captures.',
        ]
      : []

  return {
    baseUrl,
    baseUrlReachability,
    ...(baseUrlRemediationCommand ? { baseUrlRemediationCommand } : {}),
    devServerCommand: REAL_DEVICE_DEV_SERVER_COMMAND,
    profileJsonSelector: '[data-profile-json="r3f-pfx-real-device"]',
    auditCommand: REAL_DEVICE_AUDIT_COMMAND,
    operatorChecklist: [
      ...localOnlyChecklist,
      `Start the LAN dev server before phone capture: ${REAL_DEVICE_DEV_SERVER_COMMAND}`,
      'Open each profileUrl on the named real device and platform, not desktop emulation.',
      'Confirm the browser reports the expected real-device platform in the Real-device capture panel.',
      'Final approval captures must keep the original report.url with matching profileEffectIds, profilePlatform, and profileConcurrency query params.',
      'Final approval captures must render one effect identity repeated at its canonical tier concurrency in scenario.mode: "stress".',
      'Each capture must sustain measurement for at least 180 seconds and report memory growth, shader stalls, frame hitches, and thermal status.',
      'Final approval captures must include device.maxTouchPoints > 0, device.pointerCoarse: true, and device.hoverNone: true.',
      'Final approval captures must include overdraw.measurementSource: "screenshot-readback"; browser-estimate panel JSON is diagnostic only.',
      'Use the Real-device capture panel Download JSON link; it must download the exact effect .json file named in outputFile.',
      'If the browser blocks downloads, copy the JSON from the visible Real-device capture panel or the profileJsonSelector script node as a fallback.',
      'Save the downloaded JSON exactly to outputFile before running the audit command.',
      'Run the audit command and use only captures that pass the strict audit.',
    ],
    platformRequirements: REAL_DEVICE_PLATFORM_REQUIREMENTS,
  }
}

function createRealDeviceCaptureChecklist(
  platform: RealDeviceProfileCapturePlatform,
  effectId: string,
  outputFile: string,
  performanceTier: PerformanceTier,
  concurrency: number,
): string[] {
  const requirement = REAL_DEVICE_PLATFORM_REQUIREMENTS[platform]
  return [
    `Open profileUrl on ${requirement.browser} running on ${requirement.deviceClass}.`,
    `Confirm the Real-device capture panel shows ${platform} / ${effectId}.json.`,
    `Tap Download JSON in the Real-device capture panel; the download filename must be ${effectId}.json.`,
    'Fallback only if downloads are blocked: copy profile JSON from [data-profile-json="r3f-pfx-real-device"].',
    `Verify saved JSON url includes profileEffectIds=${effectId}, profilePlatform=${platform}, and profileConcurrency=${concurrency}.`,
    `Verify saved JSON repeats only ${effectId} at the ${performanceTier} tier canonical concurrency ${concurrency} with scenario.mode "stress" and scenario.effectCount ${concurrency}.`,
    'Verify the sustained measurement duration is at least 180 seconds and includes memory growth, shader stalls, frame hitches, and thermal status.',
    'Verify saved JSON includes touch evidence: device.maxTouchPoints > 0, device.pointerCoarse true, and device.hoverNone true.',
    'Verify saved JSON includes overdraw.measurementSource: "screenshot-readback"; browser-estimate is rejected by the audit.',
    `Save the downloaded JSON exactly to ${outputFile}.`,
    'Run the real-device audit before using this evidence in production approvals.',
  ]
}

const REAL_DEVICE_PLATFORM_REQUIREMENTS: PfxRealDeviceCapturePlanInstructions['platformRequirements'] = {
  'mobile-safari': {
    browser: 'Mobile Safari',
    deviceClass: 'iPhone or iPad hardware',
  },
  'chrome-android': {
    browser: 'Chrome Android',
    deviceClass: 'Android phone or tablet hardware',
  },
}

export const REAL_DEVICE_DEV_SERVER_COMMAND = 'npm --prefix kits/juice/r3f-pfx-browser run serve:real-device'
export const REAL_DEVICE_CAPTURE_INGEST_COMMAND =
  'npm --prefix kits/juice/r3f-pfx-browser run ingest:real-device'

function realDeviceCaptureIngestCommand(batchId: string): string {
  return `${REAL_DEVICE_CAPTURE_INGEST_COMMAND} -- --batch-id ${batchId}`
}

function classifyRealDeviceCaptureBaseUrl(baseUrl: string): PfxRealDeviceCaptureBaseUrlReachability {
  const hostname = new URL(baseUrl).hostname.toLowerCase()
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.')
  ) {
    return 'local-only'
  }
  return 'network-reachable'
}

function realDeviceCaptureBaseUrlRemediationCommand(baseUrl: string): string {
  const url = new URL(baseUrl)
  const port = url.port ? `:${url.port}` : ''
  const pathname = url.pathname || '/'
  return `npm --prefix kits/juice/r3f-pfx-browser run export:capture-plan -- --base-url ${url.protocol}//<LAN-IP>${port}${pathname}`
}

export function createPfxRealDeviceCaptureAudit(
  options: PfxRealDeviceCaptureAuditOptions,
): PfxRealDeviceCaptureAudit {
  const outputRoot = trimTrailingSlash(options.outputRoot ?? '.context')
  const requestedEffectIds = new Set(options.effectIds ?? PFX_TAXONOMY.map((effect) => effect.id))
  const effects = PFX_TAXONOMY.filter((effect) => requestedEffectIds.has(effect.id)).map(
    (effect): PfxRealDeviceCaptureAuditEffect => {
      const platformStatus = Object.fromEntries(
        REAL_DEVICE_PROFILE_PLATFORMS.map((platform) => {
          const outputFile = `${outputRoot}/${platform}/${sanitizeProfileArtifactName(effect.id)}.json`
          return [platform, auditRealDeviceCaptureForPlatform(effect.id, platform, outputFile, options.readCapture)]
        }),
      ) as Record<RealDeviceProfileCapturePlatform, PfxRealDeviceCapturePlatformStatus>
      const fullyCaptured = REAL_DEVICE_PROFILE_PLATFORMS.every((platform) => platformStatus[platform].valid)
      return {
        effectId: effect.id,
        rank: effect.rank,
        fullyCaptured,
        platformStatus,
      }
    },
  )
  const statuses = effects.flatMap((effect) => REAL_DEVICE_PROFILE_PLATFORMS.map((platform) => effect.platformStatus[platform]))
  const validCaptures = statuses.filter((status) => status.valid).length
  const missingCaptures = statuses.filter((status) => status.reason === 'missing capture file').length
  const invalidCaptures = statuses.length - validCaptures - missingCaptures

  return {
    schema: 'game-bot.r3f-pfx-real-device-capture-audit.v1',
    passed: validCaptures === statuses.length,
    summary: {
      totalEffects: effects.length,
      requiredCaptures: statuses.length,
      validCaptures,
      missingCaptures,
      invalidCaptures,
      fullyCapturedEffects: effects.filter((effect) => effect.fullyCaptured).length,
      platforms: [...REAL_DEVICE_PROFILE_PLATFORMS],
    },
    effects,
  }
}

export function validatePfxRealDeviceCaptureAudit(
  audit: PfxRealDeviceCaptureAudit | undefined,
  options: { outputRoot?: string; requireCompleteTaxonomy?: boolean } = {},
): PfxRealDeviceCaptureAuditValidation {
  if (!audit) {
    return {
      passed: true,
      findings: [],
      creditedEffectIds: [],
    }
  }

  const outputRoot = trimTrailingSlash(options.outputRoot ?? '.context')
  const findings: string[] = []
  const acceptedById = new Map(PFX_TAXONOMY.map((effect) => [effect.id, effect]))
  const auditRecord = audit as unknown
  const auditObject = isRecord(auditRecord) ? auditRecord : {}
  const auditEffects = Array.isArray(auditObject.effects)
    ? (auditObject.effects as PfxRealDeviceCaptureAuditEffect[])
    : []
  const auditSummary = isRecord(auditObject.summary)
    ? (auditObject.summary as Partial<PfxRealDeviceCaptureAudit['summary']>)
    : {}
  if (!Array.isArray(auditObject.effects)) {
    findings.push('effects must be an array')
  }
  if (!isRecord(auditObject.summary)) {
    findings.push('summary must be an object')
  }

  const effectIds = auditEffects.map((effect) => effect.effectId)
  const duplicateEffectIds = duplicateValues(effectIds)
  const unknownEffectIds = effectIds.filter((effectId) => !acceptedById.has(effectId))
  const missingEffectIds = options.requireCompleteTaxonomy
    ? PFX_TAXONOMY.map((effect) => effect.id).filter((effectId) => !effectIds.includes(effectId))
    : []

  if (auditObject.schema !== 'game-bot.r3f-pfx-real-device-capture-audit.v1') {
    findings.push(`schema expected game-bot.r3f-pfx-real-device-capture-audit.v1 but found ${auditObject.schema}`)
  }
  if (duplicateEffectIds.length > 0) {
    findings.push(`real-device audit has duplicate effect rows: ${duplicateEffectIds.join(', ')}`)
  }
  if (unknownEffectIds.length > 0) {
    findings.push(`real-device audit has unknown effect rows: ${unknownEffectIds.join(', ')}`)
  }
  if (missingEffectIds.length > 0) {
    findings.push(`real-device audit is missing ${missingEffectIds.length} taxonomy effect rows`)
  }

  let validCaptures = 0
  let missingCaptures = 0
  let invalidCaptures = 0
  let fullyCapturedEffects = 0
  const creditedEffectIds: string[] = []

  for (const effect of auditEffects) {
    const acceptedEffect = acceptedById.get(effect.effectId)
    const effectFindingsBefore = findings.length
    if (acceptedEffect && effect.rank !== acceptedEffect.rank) {
      findings.push(`${effect.effectId} rank expected ${acceptedEffect.rank} but found ${effect.rank}`)
    }

    const platformStatuses = REAL_DEVICE_PROFILE_PLATFORMS.map((platform) => {
      const status = effect.platformStatus?.[platform]
      if (!status) {
        findings.push(`${effect.effectId} missing ${platform} platform status`)
        invalidCaptures += 1
        return { platform, valid: false }
      }

      const expectedOutputFile = `${outputRoot}/${platform}/${sanitizeProfileArtifactName(effect.effectId)}.json`
      if (status.outputFile !== expectedOutputFile) {
        findings.push(`${effect.effectId} ${platform} outputFile expected ${expectedOutputFile} but found ${status.outputFile}`)
      }
      if (status.valid && status.reason !== 'valid') {
        findings.push(`${effect.effectId} ${platform} valid status must use reason "valid"`)
      }
      if (!status.valid && status.reason === 'valid') {
        findings.push(`${effect.effectId} ${platform} invalid status cannot use reason "valid"`)
      }
      if (!Array.isArray(status.findings)) {
        findings.push(`${effect.effectId} ${platform} status findings must be an array`)
      } else {
        if (status.findings.some((finding) => typeof finding !== 'string' || finding.trim().length === 0)) {
          findings.push(`${effect.effectId} ${platform} status findings must be non-empty strings`)
        }
        if (status.valid && status.findings.length > 0) {
          findings.push(`${effect.effectId} ${platform} valid status must not include findings`)
        }
        if (!status.valid && status.findings.length === 0) {
          findings.push(`${effect.effectId} ${platform} invalid status must include at least one finding`)
        }
      }

      if (status.valid) validCaptures += 1
      else if (status.reason === 'missing capture file') missingCaptures += 1
      else invalidCaptures += 1

      return { platform, valid: status.valid }
    })

    const fullyCaptured = platformStatuses.every((status) => status.valid)
    if (effect.fullyCaptured !== fullyCaptured) {
      findings.push(`${effect.effectId} fullyCaptured does not match platform validity`)
    }
    if (fullyCaptured) fullyCapturedEffects += 1
    if (fullyCaptured && findings.length === effectFindingsBefore) creditedEffectIds.push(effect.effectId)
  }

  const requiredCaptures = auditEffects.length * REAL_DEVICE_PROFILE_PLATFORMS.length
  const expectedPassed = validCaptures === requiredCaptures
  const expectedSummary = {
    totalEffects: auditEffects.length,
    requiredCaptures,
    validCaptures,
    missingCaptures,
    invalidCaptures,
    fullyCapturedEffects,
  }
  for (const [key, expected] of Object.entries(expectedSummary)) {
    const actual = auditSummary[key as keyof typeof expectedSummary]
    if (actual !== expected) {
      findings.push(`summary ${key} expected ${expected} but found ${actual}`)
    }
  }
  if (auditObject.passed !== expectedPassed) {
    findings.push(`passed expected ${expectedPassed} but found ${auditObject.passed}`)
  }
  const summaryPlatforms = auditSummary.platforms
  if (JSON.stringify(summaryPlatforms) !== JSON.stringify(REAL_DEVICE_PROFILE_PLATFORMS)) {
    findings.push(
      `summary platforms expected ${REAL_DEVICE_PROFILE_PLATFORMS.join(', ')} but found ${
        Array.isArray(summaryPlatforms) ? summaryPlatforms.join(', ') : 'missing'
      }`,
    )
  }

  return {
    passed: findings.length === 0,
    findings,
    creditedEffectIds: findings.length === 0 ? creditedEffectIds : [],
  }
}

export function createPfxRedTeamBlockingReviewManifestFromRealDeviceAudit(
  audit: PfxRealDeviceCaptureAudit,
  options: PfxRedTeamBlockingReviewManifestFromRealDeviceAuditOptions = {},
): PfxRedTeamReviewTemplate {
  const reviewer = options.reviewer ?? 'red-team-mobile-gate'
  const reviewedAt = options.reviewedAt ?? '2026-07-03T12:00:00.000Z'
  const auditEffectsById = new Map(audit.effects.map((effect) => [effect.effectId, effect]))
  const reviews = PFX_TAXONOMY.map((effect): PfxRedTeamReviewTemplate['reviews'][number] => {
    const auditEffect = auditEffectsById.get(effect.id)
    const blockerFindings = auditEffect
      ? REAL_DEVICE_PROFILE_PLATFORMS.flatMap((platform) =>
          redTeamMobileBlockersForStatus(effect.id, platform, auditEffect.platformStatus[platform]),
        )
      : [
          `Missing valid mobile Safari real-device capture: .context/mobile-safari/${effect.id}.json`,
          `Missing valid Chrome Android real-device capture: .context/chrome-android/${effect.id}.json`,
          `Missing real-device audit row for ${effect.id}`,
        ]
    const blocked = blockerFindings.length > 0

    return {
      effectId: effect.id,
      status: blocked ? 'blocked' : 'pending',
      reviewer,
      reviewedAt,
      anchor: effect.id,
      criteria: blocked ? createRealDeviceBlockedRedTeamCriteria() : createPendingRedTeamCriteriaForAudit(),
      blockerFindings,
      notes: blocked
        ? `Adversarial red-team draft blocks ${effect.name} based on real-device audit blockers.`
        : `Real-device audit has valid mobile captures for ${effect.name}; independent red-team review is still pending.`,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-red-team-review.v1',
    summary: {
      totalEffects: reviews.length,
      signedOffEffects: 0,
      approvedDeferrals: 0,
      pendingEffects: reviews.filter((review) => review.status === 'pending').length,
      blockedEffects: reviews.filter((review) => review.status === 'blocked').length,
      mobileSafariBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'mobile Safari'),
      chromeAndroidBlockedEffects: countRedTeamPlatformBlockedEffects(reviews, 'Chrome Android'),
      requiredCriteria: [...PFX_RED_TEAM_CRITERIA],
    },
    instructions: {
      implementationTemplateFile: '.context/r3f-pfx-production-implementation.json',
      approvalStatus: 'adversarial-review-required',
      completionCommand: 'npm --prefix kits/juice/r3f-pfx-browser run verify:acceptance',
      operatorChecklist: [
        'This adversarial manifest records blocking red-team findings from the real-device audit; it is not red-team signoff.',
        'Rows without mobile blockers remain pending until an independent red-team reviewer attacks the implementation and evidence.',
        'Do not change blocked rows to signed-off until all listed real-device capture blockers are resolved.',
      ],
    },
    reviews,
  }
}

export function resolveProfileScenarios(suite: string = 'representative'): ProfileScenarioDefinition[] {
  if (suite === 'representative') return PROFILE_SCENARIOS
  if (suite === 'authored') return AUTHORED_PROFILE_SCENARIOS
  if (suite === 'profile-backed') return PROFILE_BACKED_PROFILE_SCENARIOS
  if (suite === 'catalog') return CATALOG_PROFILE_SCENARIOS
  if (suite === 'catalog-stress') return CATALOG_STRESS_PROFILE_SCENARIOS
  if (suite === 'all') return [...PROFILE_SCENARIOS, ...CATALOG_PROFILE_SCENARIOS, ...CATALOG_STRESS_PROFILE_SCENARIOS]
  throw new Error(`Unknown profile suite: ${suite}`)
}

export function createExplicitEffectProfileScenarios(
  effectIds: readonly string[],
  stressCount?: number,
): ProfileScenarioDefinition[] {
  if (effectIds.length === 0) throw new Error('Explicit effect profiling requires at least one effect id')
  if (stressCount != null && (!Number.isInteger(stressCount) || stressCount <= 0)) {
    throw new Error('Explicit profile stress count must be a positive integer')
  }
  const catalogIds = new Set(filterPfxCatalog({}).map(({ effect }) => effect.id))
  const uniqueEffectIds = [...new Set(effectIds)]
  for (const effectId of uniqueEffectIds) {
    if (!catalogIds.has(effectId)) throw new Error(`Unknown effect id for explicit profiling: ${effectId}`)
  }
  return uniqueEffectIds.flatMap((effectId): ProfileScenarioDefinition[] => {
    const single: ProfileScenarioDefinition = {
      id: `explicit-${effectId}-single`,
      mode: 'single',
      search: effectId,
      effectIds: [effectId],
      mobileSafeOnly: false,
    }
    if (stressCount == null) return [single]
    return [
      single,
      {
        id: `explicit-${effectId}-stress-${stressCount}`,
        mode: 'stress',
        search: effectId,
        effectIds: [effectId],
        stressCount,
        mobileSafeOnly: false,
      },
    ]
  })
}

export function profileArtifactFileNameForScenario(scenario: ProfileScenarioDefinition): string {
  const singleEffectId =
    scenario.effectIds?.length === 1
      ? scenario.effectIds[0]
      : scenario.mode === 'single' && scenario.search.trim().length > 0
        ? scenario.search
        : null
  return `${sanitizeProfileArtifactName(singleEffectId ?? scenario.id)}.json`
}

function profileUrlForEffect(
  baseUrl: string,
  effectId: string,
  platform: RealDeviceProfileCapturePlatform,
  concurrency: number,
): string {
  const url = new URL(baseUrl)
  url.searchParams.set('profileEffectIds', effectId)
  url.searchParams.set('profilePlatform', platform)
  url.searchParams.set('profileConcurrency', String(concurrency))
  return url.toString()
}

function auditRealDeviceCaptureForPlatform(
  effectId: string,
  platform: RealDeviceProfileCapturePlatform,
  outputFile: string,
  readCapture: (outputFile: string) => unknown,
): PfxRealDeviceCapturePlatformStatus {
  let rawCapture: unknown
  try {
    rawCapture = readCapture(outputFile)
  } catch (error) {
    return {
      valid: false,
      outputFile,
      reason: error instanceof Error ? error.message : 'failed to read capture file',
      findings: [error instanceof Error ? error.message : 'failed to read capture file'],
    }
  }
  if (rawCapture == null) {
    return {
      valid: false,
      outputFile,
      reason: 'missing capture file',
      findings: ['capture file is missing'],
    }
  }

  let reports: BrowserProfileReport[]
  try {
    reports = normalizeProfileEvidenceFile(rawCapture)
  } catch {
    return {
      valid: false,
      outputFile,
      reason: `invalid capture report for ${effectId} on ${platform}`,
      findings: ['capture file must be a browser profile report or canonical profile run with reports'],
    }
  }

  if (reports.length !== 1) {
    return {
      valid: false,
      outputFile,
      reason: `invalid capture report for ${effectId} on ${platform}`,
      findings: [`capture file must contain exactly one profile report for ${effectId}`],
    }
  }

  const platformEvidence =
    platform === 'mobile-safari'
      ? ({ kind: 'mobile-safari-profile', label: 'mobile Safari' } as const)
      : ({ kind: 'chrome-android-profile', label: 'Chrome Android' } as const)
  const reportFindings = reports.map((report) => profileReportApprovalFindings(report, effectId, platformEvidence))
  const valid = reportFindings.some((findings) => findings.length === 0)
  return {
    valid,
    outputFile,
    reason: valid ? 'valid' : `invalid capture report for ${effectId} on ${platform}`,
    findings: valid
      ? []
      : reportFindings.flatMap((findings, index) =>
          reports.length === 1 ? findings : findings.map((finding) => `report ${index + 1}: ${finding}`),
        ),
  }
}

function countRedTeamPlatformBlockedEffects(
  reviews: readonly PfxRedTeamReviewTemplate['reviews'][number][],
  platformLabel: 'mobile Safari' | 'Chrome Android',
): number {
  const normalizedPlatformLabel = platformLabel.toLowerCase()
  return reviews.filter(
    (review) =>
      review.status === 'blocked' &&
      review.blockerFindings.some((finding) => finding.toLowerCase().includes(normalizedPlatformLabel)),
  ).length
}

function redTeamMobileBlockersForStatus(
  effectId: string,
  platform: RealDeviceProfileCapturePlatform,
  status: PfxRealDeviceCapturePlatformStatus | undefined,
): string[] {
  const outputFile = status?.outputFile ?? `.context/${platform}/${sanitizeProfileArtifactName(effectId)}.json`
  if (!status || status.reason === 'missing capture file') {
    return [`Missing valid ${redTeamPlatformLabel(platform)} real-device capture: ${outputFile}`]
  }
  if (status.valid) return []
  return [
    `Invalid ${redTeamPlatformLabel(platform)} real-device capture: ${outputFile} - ${status.reason}`,
    ...(status.findings ?? []).map((finding) => `${platform}: ${finding}`),
  ]
}

function redTeamPlatformLabel(platform: RealDeviceProfileCapturePlatform): string {
  return platform === 'mobile-safari' ? 'mobile Safari' : 'Chrome Android'
}

function createRealDeviceBlockedRedTeamCriteria(): PfxRedTeamReviewTemplate['reviews'][number]['criteria'] {
  return Object.fromEntries(
    PFX_RED_TEAM_CRITERIA.map((criterion) => [criterion, criterion === 'mobile-performance-proven' ? 'fail' : 'pass']),
  ) as PfxRedTeamReviewTemplate['reviews'][number]['criteria']
}

function createPendingRedTeamCriteriaForAudit(): PfxRedTeamReviewTemplate['reviews'][number]['criteria'] {
  return Object.fromEntries(PFX_RED_TEAM_CRITERIA.map((criterion) => [criterion, 'pending'])) as PfxRedTeamReviewTemplate['reviews'][number]['criteria']
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function createCatalogStressScenarios(): ProfileScenarioDefinition[] {
  const maxEffectsPerChunk = 8
  const maxParticlesPerChunk = 768
  const maxDrawCallsPerChunk = 64
  const chunks: Array<{ ids: string[]; particles: number; drawCalls: number }> = []
  let current = { ids: [] as string[], particles: 0, drawCalls: 0 }

  for (const { effect, preset } of filterPfxCatalog({})) {
    const particles = preset.performance.maxParticles
    const drawCalls = 3
    const wouldExceed =
      current.ids.length > 0 &&
      (current.ids.length + 1 > maxEffectsPerChunk ||
        current.particles + particles > maxParticlesPerChunk ||
        current.drawCalls + drawCalls > maxDrawCallsPerChunk)

    if (wouldExceed) {
      chunks.push(current)
      current = { ids: [], particles: 0, drawCalls: 0 }
    }

    current.ids.push(effect.id)
    current.particles += particles
    current.drawCalls += drawCalls
  }

  if (current.ids.length > 0) chunks.push(current)

  return chunks.map((chunk, index) => ({
    id: `catalog-stress-${String(index + 1).padStart(2, '0')}`,
    mode: 'stress',
    search: '',
    effectIds: chunk.ids,
    stressCount: chunk.ids.length,
    mobileSafeOnly: false,
  }))
}

export interface CanvasScreenshotProfileInput {
  screenshotWidth: number
  screenshotHeight: number
  nonBackgroundPixels: number
}

export interface FrameProfileSummary {
  samples: number
  averageFrameMs: number
  p95FrameMs: number
  worstFrameMs: number
  fps: number
}

export function createPfxUncappedSimulationLaunchArgs(enabled: boolean): string[] {
  return enabled
    ? ['--disable-frame-rate-limit', '--disable-gpu-vsync']
    : []
}

export function createPfxSimulationWarmupFrameCount(enabled: boolean): number {
  return enabled ? 120 : 30
}

export function createPfxSimulationScenarioWarmupPasses(enabled: boolean): number {
  return enabled ? 1 : 0
}

export interface PfxSustainedDeviceTelemetry {
  measurementSource: 'external-device-profiler'
  durationSeconds: number
  memoryStartMb: number
  memoryEndMb: number
  memoryGrowthMb: number
  cpuMainThreadP95Ms: number
  gpuP95Ms: number
  materialFrameHitches: number
  shaderCompilationStalls: number
  thermalStatus: 'nominal' | 'fair' | 'serious' | 'critical'
  frameTimeDegradationPercent: number
}

export interface BrowserProfileReport {
  schema: 'game-bot.r3f-pfx-browser-profile.v1'
  capturedAt: string
  url: string
  userAgent: string
  capture: BrowserProfileCapture
  runtimePolicy: PfxMobileRuntimePolicy
  device: BrowserDeviceProfile
  viewport: BrowserProfileInput['viewport']
  scenario: BrowserProfileInput['scenario']
  frame: FrameProfileSummary
  sustained?: PfxSustainedDeviceTelemetry
  overdraw: {
    canvasPixels: number
    nonBackgroundPixels: number
    nonBackgroundRatio: number
    measurementSource: PfxOverdrawMeasurementSource
  }
  webgl: WebglProfile
  thresholds: {
    mobileLowTier: {
      pass: boolean
      failures: string[]
    }
  }
}

export interface PfxMeasuredProfileEvidenceInput {
  authoredReports: BrowserProfileReport[]
  profileBackedReports: BrowserProfileReport[]
  catalogStressReports: BrowserProfileReport[]
  representativeReports?: BrowserProfileReport[]
}

export interface PfxMeasuredProfileThresholdFailure {
  suite: 'representative' | 'authored' | 'profile-backed' | 'catalog-stress'
  scenarioId: string
  failures: string[]
}

export interface PfxMeasuredProfileEvidenceSummary {
  schema: 'game-bot.r3f-pfx-measured-profile-evidence.v1'
  passed: boolean
  failures: string[]
  singleEffectCoverage: {
    authoredPreviewEffects: number
    profileBackedEffects: number
    totalEffects: number
    missingEffectIds: string[]
    unexpectedScenarioIds: string[]
    duplicateScenarioIds: string[]
  }
  catalogStressCoverage: {
    chunks: number
    totalEffects: number
    missingEffectIds: string[]
    unexpectedScenarioIds: string[]
    duplicateScenarioIds: string[]
  }
  representativeScenarios: {
    reports: number
    missingScenarioIds: string[]
  }
  thresholdFailures: PfxMeasuredProfileThresholdFailure[]
  worstP95FrameMs: number
  worstOverdrawRatio: number
  maxDrawCalls: number
  maxParticles: number
}

export type PfxEffectPerformanceEvidenceStatus =
  | 'local-profiled-requires-real-device'
  | 'missing-local-profile'
  | 'local-threshold-failed'

export interface PfxEffectPerformanceEvidenceMatrixEffect {
  effectId: string
  rank: number
  name: string
  status: PfxEffectPerformanceEvidenceStatus
  singleEffect: {
    suite: 'authored' | 'profile-backed' | 'missing'
    scenarioId: string | null
    thresholdPassed: boolean
  }
  catalogStress: {
    scenarioId: string | null
    thresholdPassed: boolean
  }
  realDevice: {
    mobileSafari: 'missing'
    chromeAndroid: 'missing'
  }
  metrics: {
    p95FrameMs: number
    overdrawRatio: number
    drawCalls: number
    particles: number
    singleEffect: {
      p95FrameMs: number
      overdrawRatio: number
      drawCalls: number
      particles: number
    }
    catalogStress: {
      p95FrameMs: number
      overdrawRatio: number
      drawCalls: number
      particles: number
    }
  }
  profileEvidence: string[]
}

export interface PfxEffectPerformanceEvidenceMatrix {
  schema: 'game-bot.r3f-pfx-effect-performance-matrix.v1'
  summary: {
    totalEffects: number
    effectsWithSingleEffectProfile: number
    effectsWithCatalogStressProfile: number
    effectsPassingLocalThresholds: number
    effectsRequiringRealDeviceProfiles: number
  }
  effects: PfxEffectPerformanceEvidenceMatrixEffect[]
}

export const PFX_VISUAL_QUALITY_DIMENSIONS = [
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
] as const

export const PFX_MOBILE_QUALITY_DIMENSIONS = [
  'mobileFrameRateStability',
  'cpuAndGpuCost',
  'drawCallsParticlesAndOverdraw',
  'memoryAndThermalSuitability',
] as const

export type PfxVisualQualityDimension = (typeof PFX_VISUAL_QUALITY_DIMENSIONS)[number]
export type PfxMobileQualityDimension = (typeof PFX_MOBILE_QUALITY_DIMENSIONS)[number]
export type PfxMatrixQualityScores = Record<PfxVisualQualityDimension | PfxMobileQualityDimension, number>
export type PfxMatrixGrade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F'

export interface PfxMatrixEffectInput {
  effectId: string
  rank: number
  name: string
  originalGrade: PfxMatrixGrade | null
  performanceTier: PerformanceTier
}

export interface PfxMatrixVisualReviewInput {
  effectId: string
  reviewer: string
  reviewerConfidence: number
  scores: Record<PfxVisualQualityDimension, number>
  cameraEvidence: Record<'front' | 'threeQuarter' | 'side', string[]>
  lifecycleEvidence: Record<'onset' | 'peak' | 'decay', string[]>
  gameplayContextEvidence: string[]
  reducedMotionReadable: boolean
  blockers: string[]
}

export interface PfxMatrixDeviceMetrics {
  platform: RealDeviceProfileCapturePlatform
  deviceLabel: string
  modelYear: number
  measured: boolean
  concurrency: number
  fps: number
  p95FrameMs: number
  worstFrameMs: number
  drawCalls: number
  particles: number
  overdrawRatio: number
  memoryMb: number
  memoryGrowthMb: number
  cpuMainThreadMs: number
  gpuTimeMs: number
  shaderCompilationStalls: number
  materialFrameHitches: number
  thermalStatus: 'nominal' | 'fair' | 'serious' | 'critical'
  sustainedDurationSeconds: number
  evidence: string
}

export interface PfxMatrixPerformanceReviewInput {
  effectId: string
  scores: Record<PfxMobileQualityDimension, number>
  mobileSafari: PfxMatrixDeviceMetrics
  chromeAndroid: PfxMatrixDeviceMetrics
  blockers: string[]
}

export interface PfxQualityMatrixInput {
  effects: PfxMatrixEffectInput[]
  visualReviews: PfxMatrixVisualReviewInput[]
  performanceReviews: PfxMatrixPerformanceReviewInput[]
}

export interface PfxMatrixDeviceRegistry {
  schema: 'game-bot.r3f-pfx-quality-device-registry.v1'
  platforms: Record<RealDeviceProfileCapturePlatform, {
    deviceLabel: string
    modelYear: number
  }>
}

export interface PfxMatrixPerformanceReportSource {
  report: BrowserProfileReport
  evidence: string
}

export interface PfxQualityMatrixEffect {
  effectId: string
  rank: number
  name: string
  performanceTier: PerformanceTier
  targetGrade: PfxQualityTargetGrade
  originalGrade: PfxMatrixGrade | null
  afterGrade: PfxMatrixGrade | null
  scores: Partial<PfxMatrixQualityScores>
  weightedScore: number | null
  requiredQualityThreshold: {
    minimumVisualDimension: number
    minimumWeightedScore: number
    performanceHeadroomRequired: boolean
  }
  cameraEvidence: Partial<Record<'front' | 'threeQuarter' | 'side', string[]>>
  lifecycleEvidence: Partial<Record<'onset' | 'peak' | 'decay', string[]>>
  gameplayContextEvidence: string[]
  mobileSafari: PfxMatrixDeviceMetrics | null
  chromeAndroid: PfxMatrixDeviceMetrics | null
  reviewer: string | null
  reviewerConfidence: number | null
  reducedMotionReadable: boolean | null
  visualPass: boolean
  performancePass: boolean
  finalPass: boolean
  blockers: string[]
}

export interface PfxQualityMatrix {
  schema: 'game-bot.r3f-pfx-quality-matrix.v1'
  weights: {
    dimensions: Record<PfxVisualQualityDimension | PfxMobileQualityDimension, number>
    visualQuality: number
    mobileReadiness: number
  }
  thresholds: {
    targetFps: number
    maximumP95FrameMs: number
    maximumWorstFrameMs: number
    minimumSustainedDurationSeconds: number
    tierConcurrency: Record<PerformanceTier, number>
  }
  summary: {
    totalEffects: number
    visualPasses: number
    performancePasses: number
    finalPasses: number
  }
  effects: PfxQualityMatrixEffect[]
}

export type PfxVisualLifecyclePhase = 'onset' | 'peak' | 'decay'

export interface PfxVisualLifecycleSample {
  phase: PfxVisualLifecyclePhase
  sampleMs: number
  aggregateActivePixels: number
}

const PFX_VISUAL_LIFECYCLE_MINIMUM_PHASE_SEPARATION_MS = 40

export function pfxQualityReviewContactSheetColumns(effectCount: number): number {
  if (!Number.isFinite(effectCount) || effectCount < 1) {
    throw new Error('Quality-review contact sheets require at least one effect')
  }
  return Math.min(5, Math.floor(effectCount))
}

/** Counts pixels visibly different from the canonical isolated-review stage.
 * Absolute luminance alone misses grey smoke, shadow magic, and dark matter;
 * background delta measures what a reviewer can actually see. */
export function countPfxReviewActivePixels(
  pixels: Uint8Array,
  width: number,
  height: number,
): number {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return 0
  let count = 0
  for (let index = 0; index < width * height * 4; index += 4) {
    if ((pixels[index + 3] ?? 0) === 0) continue
    const red = pixels[index] ?? 17
    const green = pixels[index + 1] ?? 24
    const blue = pixels[index + 2] ?? 39
    const backgroundDelta = Math.max(
      Math.abs(red - 17),
      Math.abs(green - 24),
      Math.abs(blue - 39),
    )
    const brightness = Math.max(red, green, blue)
    const chroma = brightness - Math.min(red, green, blue)
    if (backgroundDelta > 10 || brightness > 150 || (brightness > 80 && chroma > 48)) count += 1
  }
  return count
}

/** Persistent effects should always retain a visible baseline. A single
 * zero-coverage sample immediately after navigation is therefore a cold
 * shader/render transient worth one retry; bursts may legitimately be dark. */
export function shouldRetryPfxPersistentLoopSample(
  loopMode: 'loop' | 'burst',
  activePixels: number,
): boolean {
  return loopMode === 'loop' && activePixels === 0
}

/** Detects the cold-transform blank-frame race in burst sampling. A burst
 * sample that reads as empty while both adjacent samples are clearly active
 * is a capture artifact (the same race gotoWithHealthyDom guards on the DOM
 * side), not a lifecycle gap: authored bursts cannot vanish for one isolated
 * sampling window mid-cycle and return at full strength. Blank bursts at the
 * cycle tail are legitimate, so both neighbors must be clearly active before
 * a sample qualifies for repair. Persistent loops keep the stricter
 * shouldRetryPfxPersistentLoopSample contract instead. */
export function shouldRepairPfxBlankSample(
  previousActivePixels: number,
  activePixels: number,
  nextActivePixels: number,
): boolean {
  return activePixels < 50 && previousActivePixels >= 500 && nextActivePixels >= 500
}

/** Display-only gamma lift for peer review of dark-palette effects. Brightens
 * RGB channels in place (exponent < 1) so shadow detail survives contact-sheet
 * downscaling; alpha is untouched and the original captures stay
 * authoritative. */
export function liftPfxReviewImageExposure(
  pixels: Uint8Array,
  exponent = 0.55,
): void {
  for (let index = 0; index + 2 < pixels.length; index += 4) {
    pixels[index] = Math.round(255 * ((pixels[index] ?? 0) / 255) ** exponent)
    pixels[index + 1] = Math.round(255 * ((pixels[index + 1] ?? 0) / 255) ** exponent)
    pixels[index + 2] = Math.round(255 * ((pixels[index + 2] ?? 0) / 255) ** exponent)
  }
}

/** Fits effect-only review frames without altering image pixels. One returned
 * distance is shared by all lifecycle/angle cells so comparisons stay honest. */
export function createPfxReviewCameraDistance(
  pixels: Uint8Array,
  width: number,
  height: number,
  baseDistance = 5.2,
  targetCoverage = 0.45,
): number {
  if (width < 1 || height < 1 || pixels.length < width * height * 4) return baseDistance
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if ((pixels[index + 3] ?? 0) === 0) continue
      const delta = Math.max(
        Math.abs((pixels[index] ?? 17) - 17),
        Math.abs((pixels[index + 1] ?? 24) - 24),
        Math.abs((pixels[index + 2] ?? 39) - 39),
      )
      if (delta <= 18) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return baseDistance
  // Fit the union against the frame CENTER, not only its width/height. A
  // compact pickup that arcs toward the top can have tiny bbox coverage yet
  // still be cropped after an aggressive zoom. Doubling the farthest extent
  // from center preserves asymmetric travel while matching the old result
  // for centered effects.
  const centerX = (width - 1) / 2
  const centerY = (height - 1) / 2
  const centeredWidth = Math.max(Math.abs(minX - centerX), Math.abs(maxX - centerX)) * 2 + 1
  const centeredHeight = Math.max(Math.abs(minY - centerY), Math.abs(maxY - centerY)) * 2 + 1
  const centeredCoverage = Math.max(centeredWidth / width, centeredHeight / height)
  return Math.min(8, Math.max(1.2, baseDistance * centeredCoverage / targetCoverage))
}

export function createPfxVisualLifecycleSchedule(
  samples: readonly { sampleMs: number; aggregateActivePixels: number }[],
  options: { preferEarlyImpulse?: boolean; preferDestructiveTransition?: boolean; persistentLoop?: boolean; burstCycleMs?: number } = {},
): PfxVisualLifecycleSample[] {
  const burstCycleMs = Number.isFinite(options.burstCycleMs) && (options.burstCycleMs ?? 0) > 0
    ? options.burstCycleMs
    : undefined
  const ordered = [...samples]
    .filter((sample) =>
      Number.isFinite(sample.sampleMs) &&
      sample.sampleMs >= 0 &&
      (burstCycleMs == null || sample.sampleMs < burstCycleMs) &&
      Number.isFinite(sample.aggregateActivePixels),
    )
    .sort((left, right) => left.sampleMs - right.sampleMs)
  if (ordered.length < 3 || new Set(ordered.map((sample) => sample.sampleMs)).size !== ordered.length) {
    throw new Error('Visual lifecycle scheduling requires at least three distinct, finite sample times')
  }
  if (options.persistentLoop) {
    const globalPeak = ordered.reduce((best, sample) =>
      sample.aggregateActivePixels > best.aggregateActivePixels ? sample : best,
    )
    const persistentFloor = Math.min(...ordered.map((sample) => sample.aggregateActivePixels))
    const meaningfulCrestFloor = persistentFloor + Math.max(150, persistentFloor * 0.05)
    // Review the first complete authored cadence, not a later repeat that is
    // a few pixels larger. Baseline, first local crest, and recovered trough
    // make persistent status modulation legible without pretending it is a
    // one-shot event that must disappear.
    const firstCrest = ordered.slice(1, -1).find((sample, index) => {
      const orderedIndex = index + 1
      return sample.aggregateActivePixels >= meaningfulCrestFloor
        && sample.aggregateActivePixels >= globalPeak.aggregateActivePixels * 0.72
        && sample.aggregateActivePixels >= ordered[orderedIndex - 1]!.aggregateActivePixels
        && sample.aggregateActivePixels > ordered[orderedIndex + 1]!.aggregateActivePixels
    })
    const peak = firstCrest ?? globalPeak
    const peakIndex = ordered.indexOf(peak)
    const onsetCandidates = ordered.slice(0, peakIndex)
    const onset = onsetCandidates.reduce(
      (quietest, sample) => sample.aggregateActivePixels < quietest.aggregateActivePixels ? sample : quietest,
      onsetCandidates[0] ?? ordered[0]!,
    )
    const afterPeak = ordered.slice(peakIndex + 1).filter(
      (sample) => sample.sampleMs - peak.sampleMs >= PFX_VISUAL_LIFECYCLE_MINIMUM_PHASE_SEPARATION_MS,
    )
    const nextCrestIndex = afterPeak.findIndex((sample, index) =>
      index > 0
        && sample.aggregateActivePixels >= peak.aggregateActivePixels * 0.9
        && sample.aggregateActivePixels > afterPeak[index - 1]!.aggregateActivePixels,
    )
    const recoveryWindow = nextCrestIndex > 0 ? afterPeak.slice(0, nextCrestIndex) : afterPeak
    const decay = recoveryWindow.reduce(
      (quietest, sample) => sample.aggregateActivePixels < quietest.aggregateActivePixels ? sample : quietest,
      recoveryWindow[0] ?? ordered.at(-1)!,
    )
    return [
      { phase: 'onset', ...onset },
      { phase: 'peak', ...peak },
      { phase: 'decay', ...decay },
    ]
  }
  // The quietest candidate approximates the empty stage; anything meaningfully
  // above it counts as visible effect activity. Round-20 review failed
  // short-lived bursts whose decay cell blindly used the last candidate
  // (an empty stage at 920ms) and slow builders whose onset cell photographed
  // the pre-spawn stage at 0ms.
  const ambientFloor = Math.min(...ordered.map((sample) => sample.aggregateActivePixels))
  const activityThreshold = ambientFloor + Math.max(150, ambientFloor * 0.15)
  const globalPeak = ordered.slice(1, -1).reduce((best, sample) =>
    sample.aggregateActivePixels > best.aggregateActivePixels ? sample : best,
  )
  // Screen coverage alone cannot distinguish a decisive emissive impulse
  // from a broader alpha-blended smoke handoff. Preserve the first strong
  // local crest when it carries at least 40% of global activity; this keeps
  // muzzle flashes and similar authored micro-bursts centered on their actual
  // gameplay event while monotonic cloud builds still use their global peak.
  const prominentImpulseMinimum = options.preferEarlyImpulse ? 0.25 : 0.4
  const prominentImpulse = ordered.slice(1, -1).find((sample, index) => {
    const orderedIndex = index + 1
    return sample.aggregateActivePixels > activityThreshold &&
      sample.aggregateActivePixels >= globalPeak.aggregateActivePixels * prominentImpulseMinimum &&
      sample.aggregateActivePixels >= ordered[orderedIndex - 1]!.aggregateActivePixels &&
      sample.aggregateActivePixels > ordered[orderedIndex + 1]!.aggregateActivePixels
  })
  // Destructive effects communicate their action while coverage is being
  // removed. Maximum active area is the intact subject, not the dissolve
  // peak; select the first readable partial-break frame instead.
  const destructiveTransition = options.preferDestructiveTransition
    ? ordered.slice(ordered.indexOf(globalPeak) + 1).find((sample) =>
      sample.aggregateActivePixels > activityThreshold &&
      sample.aggregateActivePixels <= globalPeak.aggregateActivePixels * 0.8,
    )
    : undefined
  const peak = destructiveTransition ?? prominentImpulse ?? globalPeak
  const peakIndex = ordered.indexOf(peak)
  const firstActive = ordered.find(
    (sample, index) => index < peakIndex && sample.aggregateActivePixels > activityThreshold,
  )
  const onset = firstActive ?? ordered[peakIndex - 1] ?? ordered[0]!
  const afterPeak = ordered.slice(peakIndex + 1)
  // Adaptive refinement may add samples only 10-20ms after the peak. Those
  // frames describe the same impulse shoulder and cannot prove a distinct
  // decay beat. Prefer the first samples at least 40ms later; if a caller
  // supplies only tighter samples, retain the old fail-soft fallback.
  const separatedAfterPeak = afterPeak.filter(
    (sample) => sample.sampleMs - peak.sampleMs >= PFX_VISUAL_LIFECYCLE_MINIMUM_PHASE_SEPARATION_MS,
  )
  const decayCandidates = separatedAfterPeak.length > 0 ? separatedAfterPeak : afterPeak
  const firstQuietIndex = decayCandidates.findIndex((sample) => sample.aggregateActivePixels <= activityThreshold)
  const firstCycleTail = firstQuietIndex < 0 ? decayCandidates : decayCandidates.slice(0, firstQuietIndex)
  const visibleDecayCandidates = firstCycleTail.filter((sample) => sample.aggregateActivePixels > activityThreshold)
  // A review decay cell should show the first clearly separated recovery
  // beat, not the last near-extinguished fleck. Seventy percent of peak captures
  // the first authored handoff: far enough down the curve to prove recovery,
  // while enough structure remains to inspect continuity. Effects that never descend that
  // far retain the latest visible pre-cycle sample as a fail-soft fallback.
  const readableDecayThreshold = Math.max(activityThreshold, peak.aggregateActivePixels * 0.7)
  const firstReadableDescent = visibleDecayCandidates.find(
    (sample) => sample.aggregateActivePixels <= readableDecayThreshold,
  )
  const decay = firstReadableDescent ?? visibleDecayCandidates.at(-1) ??
    decayCandidates[0] ??
    ordered.at(-1)!
  return [
    { phase: 'onset', ...onset },
    { phase: 'peak', ...peak },
    { phase: 'decay', ...decay },
  ]
}

/** Returns one deterministic midpoint to probe when the coarse lifecycle
 * schedule jumps directly from its peak to an ambient-only frame. Repeating
 * this bounded refinement gives short bursts a real decay frame without
 * making every catalog capture sample at video-frame density. */
export function selectPfxVisualLifecycleRefinementTime(
  samples: readonly { sampleMs: number; aggregateActivePixels: number }[],
  minimumGapMs = 16,
): number | null {
  const ordered = [...samples]
    .filter((sample) => Number.isFinite(sample.sampleMs) && sample.sampleMs >= 0 && Number.isFinite(sample.aggregateActivePixels))
    .sort((left, right) => left.sampleMs - right.sampleMs)
  if (ordered.length < 3) return null
  const ambientFloor = Math.min(...ordered.map((sample) => sample.aggregateActivePixels))
  const activityThreshold = ambientFloor + Math.max(150, ambientFloor * 0.15)
  const peak = ordered.slice(1, -1).reduce((best, sample) =>
    sample.aggregateActivePixels > best.aggregateActivePixels ? sample : best,
  )
  const peakIndex = ordered.indexOf(peak)
  const afterPeak = ordered.slice(peakIndex + 1)
  const firstQuietIndex = afterPeak.findIndex((sample) => sample.aggregateActivePixels <= activityThreshold)
  if (firstQuietIndex < 0) return null
  if (afterPeak.slice(0, firstQuietIndex).some((sample) => sample.aggregateActivePixels > activityThreshold)) return null
  const firstQuiet = afterPeak[firstQuietIndex]!
  if (firstQuiet.sampleMs - peak.sampleMs <= minimumGapMs) return null
  const midpoint = Math.round((peak.sampleMs + firstQuiet.sampleMs) / 2)
  return midpoint > peak.sampleMs && midpoint < firstQuiet.sampleMs ? midpoint : null
}

const PFX_PEER_REVIEW_DIMENSION_MAP: Record<string, PfxVisualQualityDimension> = {
  SEMANTIC_IDENTITY: 'semanticIdentity',
  GAMEPLAY_READABILITY: 'gameplayReadability',
  VOLUME_AND_DEPTH: 'volumeAndDepth',
  MULTI_ANGLE_RESILIENCE: 'multiAngleResilience',
  SILHOUETTE_AND_COMPOSITION: 'silhouetteAndComposition',
  TEMPORAL_ARC_AND_DECAY: 'temporalArcAndDecay',
  MATERIAL_AND_SHADER_QUALITY: 'materialAndShaderQuality',
  MESH_STRUCTURE_AND_EMITTER_QUALITY: 'meshStructureAndEmitterQuality',
  CC0_ASSET_INTEGRATION: 'cc0AssetIntegration',
  DISTINCTIVENESS_AND_RING_DISCIPLINE: 'distinctivenessAndRingDiscipline',
  SCALE_AND_VISUAL_HIERARCHY: 'scaleAndVisualHierarchy',
  OVERALL_PRODUCTION_POLISH: 'overallProductionPolish',
}

export interface PfxPeerVisualReviewEffectRow {
  effectId: string
  scores: Record<string, number>
  reviewerConfidence: number
  grade: PfxMatrixGrade
  verdict: 'pass' | 'rework'
  findings: string[]
}

export interface PfxPeerVisualReviewReport {
  schema: string
  batchId: string
  peerRuntime: string
  independentRuntime: boolean
  reviewedAt?: string
  effects: PfxPeerVisualReviewEffectRow[]
}

export interface PfxVisualCaptureManifest {
  schema: string
  batchId: string
  sourceFingerprint?: string
  effects: Array<{
    effectId: string
    sourceFingerprint?: string
    lifecycleCaptures: Array<{ angle: 'front' | 'three-quarter' | 'side'; phase: PfxVisualLifecyclePhase; file: string }>
    gameplayContextCaptures: Array<{ angle: 'front' | 'three-quarter' | 'side'; phase: PfxVisualLifecyclePhase; file: string }>
  }>
}

export interface PfxPeerReviewAssemblySource {
  review: PfxPeerVisualReviewReport
  manifest: PfxVisualCaptureManifest
}

export interface PfxPeerReviewAssemblyOptions {
  /** Effects with separately verified reduced-motion readability evidence. */
  reducedMotionReadableEffectIds?: readonly string[]
  /** Current render-source fingerprint used to reject stale captures. */
  currentSourceFingerprint?: string
  /** Per-effect fingerprints let one recipe change without invalidating all 499 unrelated captures. */
  currentSourceFingerprints?: Readonly<Record<string, string>>
}

// Deterministic bridge from accepted peer-review reports + capture manifests
// to quality-matrix visual review rows. Fail-closed: schema, batch, runtime
// independence, full 12-dimension scores, and all nine camera×phase capture
// cells are required; reduced-motion readability never defaults to true.
export function assemblePfxQualityMatrixVisualReviews(
  sources: readonly PfxPeerReviewAssemblySource[],
  options: PfxPeerReviewAssemblyOptions = {},
): PfxMatrixVisualReviewInput[] {
  if (!options.currentSourceFingerprint && !options.currentSourceFingerprints) {
    throw new Error('Current render-source fingerprint is required to assemble visual evidence')
  }
  const reducedMotionReadable = new Set(options.reducedMotionReadableEffectIds ?? [])
  const rows: PfxMatrixVisualReviewInput[] = []
  const seenEffectIds = new Set<string>()
  for (const { review, manifest } of sources) {
    if (
      !options.currentSourceFingerprints &&
      (!manifest.sourceFingerprint || manifest.sourceFingerprint !== options.currentSourceFingerprint)
    ) {
      throw new Error(`Visual evidence for ${manifest.batchId} is stale or has no matching render-source fingerprint`)
    }
    if (review.schema !== 'game-bot.r3f-pfx-peer-visual-review.v1') {
      throw new Error(`Peer review schema mismatch: ${review.schema}`)
    }
    if (manifest.schema !== 'game-bot.r3f-pfx-visual-capture-batch.v3') {
      throw new Error(`Capture manifest schema mismatch: ${manifest.schema}`)
    }
    if (review.batchId !== manifest.batchId) {
      throw new Error(`Peer review batchId ${review.batchId} does not match capture manifest batchId ${manifest.batchId}`)
    }
    if (!review.independentRuntime) {
      throw new Error(`Peer review for ${review.batchId} is not from an independent runtime`)
    }
    const manifestEffects = new Map(manifest.effects.map((effect) => [effect.effectId, effect]))
    for (const effect of review.effects) {
      if (seenEffectIds.has(effect.effectId)) {
        throw new Error(`Duplicate peer-review rows for effect ${effect.effectId}`)
      }
      seenEffectIds.add(effect.effectId)
      const captures = manifestEffects.get(effect.effectId)
      if (!captures) throw new Error(`Peer review effect ${effect.effectId} has no capture manifest entry`)
      const expectedSourceFingerprint = options.currentSourceFingerprints?.[effect.effectId] ?? options.currentSourceFingerprint
      const capturedSourceFingerprint = captures.sourceFingerprint ?? manifest.sourceFingerprint
      if (!expectedSourceFingerprint || capturedSourceFingerprint !== expectedSourceFingerprint) {
        throw new Error(`Visual evidence for ${effect.effectId} in ${manifest.batchId} is stale or has no matching render-source fingerprint`)
      }
      const scores = {} as Record<PfxVisualQualityDimension, number>
      for (const [rawDimension, dimension] of Object.entries(PFX_PEER_REVIEW_DIMENSION_MAP)) {
        const score = effect.scores[rawDimension]
        if (!Number.isFinite(score) || Number(score) < 1 || Number(score) > 5) {
          throw new Error(`Peer review for ${effect.effectId} has invalid ${rawDimension} score`)
        }
        scores[dimension] = Number(score)
      }
      const cameraEvidence: Record<'front' | 'threeQuarter' | 'side', string[]> = { front: [], threeQuarter: [], side: [] }
      const lifecycleEvidence: Record<PfxVisualLifecyclePhase, string[]> = { onset: [], peak: [], decay: [] }
      for (const capture of captures.lifecycleCaptures) {
        cameraEvidence[capture.angle === 'three-quarter' ? 'threeQuarter' : capture.angle].push(capture.file)
        lifecycleEvidence[capture.phase].push(capture.file)
      }
      for (const [angle, files] of Object.entries(cameraEvidence)) {
        if (files.length < 3) throw new Error(`Effect ${effect.effectId} is missing ${angle} capture cells`)
      }
      for (const [phase, files] of Object.entries(lifecycleEvidence)) {
        if (files.length < 3) throw new Error(`Effect ${effect.effectId} is missing ${phase} capture cells`)
      }
      const gameplayContextEvidence = captures.gameplayContextCaptures
        ?.filter((capture) => capture.angle === 'three-quarter' && capture.phase === 'peak')
        .map((capture) => capture.file) ?? []
      if (gameplayContextEvidence.length < 1) {
        throw new Error(`Effect ${effect.effectId} is missing a peak three-quarter gameplay-context capture`)
      }
      const blockers: string[] = []
      if (effect.verdict !== 'pass') {
        blockers.push('peer verdict: rework', ...effect.findings)
      }
      const hasReducedMotionEvidence = reducedMotionReadable.has(effect.effectId)
      if (!hasReducedMotionEvidence) blockers.push('reduced-motion readability unverified')
      rows.push({
        effectId: effect.effectId,
        reviewer: `peer:${review.peerRuntime}`,
        reviewerConfidence: effect.reviewerConfidence,
        scores,
        cameraEvidence,
        lifecycleEvidence,
        gameplayContextEvidence,
        reducedMotionReadable: hasReducedMotionEvidence,
        blockers,
      })
    }
  }
  return rows
}

export const PFX_VISUAL_REVIEW_CONSENSUS_COUNT = 3

/**
 * Converts repeated independent reviews of the same fresh render source into
 * one deterministic matrix row. A lone stochastic reviewer can neither grant
 * nor revoke a catalog grade: three distinct review batches are required, the
 * score is the median, and a spread greater than one point remains an explicit
 * adjudication blocker.
 */
export function assemblePfxQualityMatrixVisualReviewConsensus(
  sources: readonly PfxPeerReviewAssemblySource[],
  options: PfxPeerReviewAssemblyOptions = {},
): PfxMatrixVisualReviewInput[] {
  const grouped = new Map<string, Array<{
    batchId: string
    reviewedAt: string
    peerRuntime: string
    row: PfxMatrixVisualReviewInput
  }>>()
  for (const source of sources) {
    const rows = assemblePfxQualityMatrixVisualReviews([source], options)
    for (const row of rows) {
      const entries = grouped.get(row.effectId) ?? []
      if (entries.some((entry) => entry.batchId === source.review.batchId)) {
        throw new Error(`Duplicate peer-review consensus batch ${source.review.batchId} for effect ${row.effectId}`)
      }
      entries.push({
        batchId: source.review.batchId,
        reviewedAt: source.review.reviewedAt ?? source.review.batchId,
        peerRuntime: source.review.peerRuntime,
        row,
      })
      grouped.set(row.effectId, entries)
    }
  }

  const consensus: PfxMatrixVisualReviewInput[] = []
  for (const [effectId, allEntries] of [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const entries = [...allEntries]
      .sort((left, right) => left.reviewedAt.localeCompare(right.reviewedAt) || left.batchId.localeCompare(right.batchId))
      .slice(-PFX_VISUAL_REVIEW_CONSENSUS_COUNT)
    if (entries.length < PFX_VISUAL_REVIEW_CONSENSUS_COUNT) continue
    const latest = entries[entries.length - 1]!.row
    const scores = {} as Record<PfxVisualQualityDimension, number>
    const disputedDimensions: PfxVisualQualityDimension[] = []
    for (const dimension of PFX_VISUAL_QUALITY_DIMENSIONS) {
      const values = entries.map((entry) => entry.row.scores[dimension]).sort((left, right) => left - right)
      scores[dimension] = values[Math.floor(values.length / 2)]!
      if (values[values.length - 1]! - values[0]! > 1) disputedDimensions.push(dimension)
    }
    const reworkEntries = entries.filter((entry) => entry.row.blockers.includes('peer verdict: rework'))
    const blockers: string[] = []
    if (reworkEntries.length >= Math.floor(entries.length / 2) + 1) {
      blockers.push('peer consensus verdict: rework')
      blockers.push(...new Set(reworkEntries.flatMap((entry) =>
        entry.row.blockers.filter((blocker) => blocker !== 'peer verdict: rework' && blocker !== 'reduced-motion readability unverified'),
      )))
    }
    if (disputedDimensions.length > 0) {
      blockers.push(`peer consensus disagreement exceeds one point: ${disputedDimensions.join(', ')}`)
    }
    if (!latest.reducedMotionReadable) blockers.push('reduced-motion readability unverified')
    const runtimes = [...new Set(entries.map((entry) => entry.peerRuntime))].sort().join('+')
    const confidences = entries.map((entry) => entry.row.reviewerConfidence).sort((left, right) => left - right)
    consensus.push({
      effectId,
      reviewer: `peer-consensus:${runtimes}`,
      reviewerConfidence: confidences[Math.floor(confidences.length / 2)]!,
      scores,
      cameraEvidence: latest.cameraEvidence,
      lifecycleEvidence: latest.lifecycleEvidence,
      gameplayContextEvidence: latest.gameplayContextEvidence,
      reducedMotionReadable: latest.reducedMotionReadable,
      blockers,
    })
  }
  return consensus
}

export function assemblePfxQualityMatrixPerformanceReviews(
  sources: readonly PfxMatrixPerformanceReportSource[],
  devices: PfxMatrixDeviceRegistry,
): PfxMatrixPerformanceReviewInput[] {
  if (devices.schema !== 'game-bot.r3f-pfx-quality-device-registry.v1') {
    throw new Error(`Quality device registry schema mismatch: ${devices.schema}`)
  }
  for (const platform of ['mobile-safari', 'chrome-android'] as const) {
    const device = devices.platforms[platform]
    if (!device || device.deviceLabel.trim().length === 0) {
      throw new Error(`Quality device registry is missing a concrete ${platform} device label`)
    }
    if (!Number.isInteger(device.modelYear) || device.modelYear < 2022) {
      throw new Error(`Quality device registry ${platform} modelYear must be 2022 or newer`)
    }
  }

  const reports = new Map<string, Partial<Record<RealDeviceProfileCapturePlatform, PfxMatrixPerformanceReportSource>>>()
  for (const source of sources) {
    const { report } = source
    if (report.schema !== 'game-bot.r3f-pfx-browser-profile.v1') {
      throw new Error(`Real-device performance report schema mismatch: ${report.schema}`)
    }
    if (report.capture.deviceClass !== 'real-device' ||
      (report.capture.platform !== 'mobile-safari' && report.capture.platform !== 'chrome-android')) {
      throw new Error(`Performance evidence ${source.evidence} is not a required real-device capture`)
    }
    const platform = report.capture.platform
    const registeredDevice = devices.platforms[platform]
    if (report.capture.deviceLabel !== registeredDevice.deviceLabel) {
      throw new Error(`Performance evidence ${source.evidence} device label does not match the ${platform} registry`)
    }
    if (!report.sustained) {
      throw new Error(`Performance evidence ${source.evidence} has no sustained device telemetry`)
    }
    const effectId = pfxMatrixReportEffectId(report, source.evidence)
    const byPlatform = reports.get(effectId) ?? {}
    if (byPlatform[platform]) throw new Error(`Duplicate ${platform} performance evidence for ${effectId}`)
    byPlatform[platform] = source
    reports.set(effectId, byPlatform)
  }

  const rankByEffectId = new Map(PFX_TAXONOMY.map((effect) => [effect.id, effect.rank]))
  return [...reports.entries()]
    .filter(([, byPlatform]) => byPlatform['mobile-safari'] && byPlatform['chrome-android'])
    .map(([effectId, byPlatform]): PfxMatrixPerformanceReviewInput => {
      const safariSource = byPlatform['mobile-safari']!
      const androidSource = byPlatform['chrome-android']!
      const mobileSafari = pfxMatrixDeviceMetricsFromReport(safariSource, devices)
      const chromeAndroid = pfxMatrixDeviceMetricsFromReport(androidSource, devices)
      const blockers = [safariSource, androidSource].flatMap(({ report, evidence }) =>
        report.thresholds.mobileLowTier.pass
          ? []
          : report.thresholds.mobileLowTier.failures.map((failure) => `${evidence}: ${failure}`),
      )
      return {
        effectId,
        scores: {
          mobileFrameRateStability: Math.min(
            pfxMatrixFrameScore(mobileSafari),
            pfxMatrixFrameScore(chromeAndroid),
          ),
          cpuAndGpuCost: Math.min(
            pfxMatrixCpuGpuScore(mobileSafari),
            pfxMatrixCpuGpuScore(chromeAndroid),
          ),
          drawCallsParticlesAndOverdraw: Math.min(
            pfxMatrixRenderCostScore(mobileSafari),
            pfxMatrixRenderCostScore(chromeAndroid),
          ),
          memoryAndThermalSuitability: Math.min(
            pfxMatrixMemoryThermalScore(mobileSafari),
            pfxMatrixMemoryThermalScore(chromeAndroid),
          ),
        },
        mobileSafari,
        chromeAndroid,
        blockers,
      }
    })
    .sort((left, right) =>
      (rankByEffectId.get(left.effectId) ?? Number.MAX_SAFE_INTEGER) -
        (rankByEffectId.get(right.effectId) ?? Number.MAX_SAFE_INTEGER) ||
      left.effectId.localeCompare(right.effectId),
    )
}

function pfxMatrixReportEffectId(report: BrowserProfileReport, evidence: string): string {
  const values = new URL(report.url).searchParams.getAll('profileEffectIds')
  if (values.length !== 1 || !PFX_TAXONOMY.some((effect) => effect.id === values[0])) {
    throw new Error(`Performance evidence ${evidence} does not identify exactly one catalog effect`)
  }
  return values[0]!
}

function pfxMatrixDeviceMetricsFromReport(
  source: PfxMatrixPerformanceReportSource,
  devices: PfxMatrixDeviceRegistry,
): PfxMatrixDeviceMetrics {
  const { report } = source
  const platform = report.capture.platform as RealDeviceProfileCapturePlatform
  const sustained = report.sustained!
  return {
    platform,
    deviceLabel: report.capture.deviceLabel,
    modelYear: devices.platforms[platform].modelYear,
    measured: true,
    concurrency: report.scenario.effectCount,
    fps: report.frame.fps,
    p95FrameMs: report.frame.p95FrameMs,
    worstFrameMs: report.frame.worstFrameMs,
    drawCalls: report.scenario.totalDrawCalls,
    particles: report.scenario.totalParticles,
    overdrawRatio: report.overdraw.nonBackgroundRatio,
    memoryMb: sustained.memoryEndMb,
    memoryGrowthMb: sustained.memoryGrowthMb,
    cpuMainThreadMs: sustained.cpuMainThreadP95Ms,
    gpuTimeMs: sustained.gpuP95Ms,
    shaderCompilationStalls: sustained.shaderCompilationStalls,
    materialFrameHitches: sustained.materialFrameHitches,
    thermalStatus: sustained.thermalStatus,
    sustainedDurationSeconds: sustained.durationSeconds,
    evidence: source.evidence,
  }
}

function pfxMatrixFrameScore(device: PfxMatrixDeviceMetrics): number {
  if (device.p95FrameMs <= 10 && device.worstFrameMs <= 16.7) return 5
  if (device.p95FrameMs <= 12.5 && device.worstFrameMs <= 20) return 4
  if (device.p95FrameMs <= 15 && device.worstFrameMs <= 25) return 3
  if (device.p95FrameMs <= 16.7 && device.worstFrameMs <= 33.4) return 2
  return 1
}

function pfxMatrixCpuGpuScore(device: PfxMatrixDeviceMetrics): number {
  if (device.cpuMainThreadMs <= 3 && device.gpuTimeMs <= 5) return 5
  if (device.cpuMainThreadMs <= 5 && device.gpuTimeMs <= 8) return 4
  if (device.cpuMainThreadMs <= 7 && device.gpuTimeMs <= 11) return 3
  if (device.cpuMainThreadMs <= 9 && device.gpuTimeMs <= 14) return 2
  return 1
}

function pfxMatrixRenderCostScore(device: PfxMatrixDeviceMetrics): number {
  if (device.overdrawRatio <= 0.2) return 5
  if (device.overdrawRatio <= 0.3) return 4
  if (device.overdrawRatio <= 0.45) return 3
  if (device.overdrawRatio <= 0.6) return 2
  return 1
}

function pfxMatrixMemoryThermalScore(device: PfxMatrixDeviceMetrics): number {
  if (device.thermalStatus !== 'nominal' || device.shaderCompilationStalls > 0 || device.materialFrameHitches > 0) return 1
  if (device.memoryGrowthMb <= 0.25) return 5
  if (device.memoryGrowthMb <= 0.5) return 4
  if (device.memoryGrowthMb <= 1) return 3
  if (device.memoryGrowthMb <= 2) return 2
  return 1
}

export interface PfxCaptureDomImageState {
  src: string
  complete: boolean
  naturalWidth: number
}

export interface PfxCaptureDomSnapshot {
  images: readonly PfxCaptureDomImageState[]
  errorOverlayCount: number
}

// Visual-evidence captures are fail-closed: a frame whose DOM still contains a
// loading image, a broken image (Chromium paints these as a white rectangle
// with a missing-image glyph over the stage), or a dev-server error overlay is
// not rendered evidence and must never enter a review manifest.
export function collectPfxCaptureDomDefects(snapshot: PfxCaptureDomSnapshot): string[] {
  const defects: string[] = []
  for (const image of snapshot.images) {
    if (!image.complete) defects.push(`image still loading in capture DOM: ${image.src}`)
    else if (image.naturalWidth === 0) defects.push(`broken image in capture DOM: ${image.src}`)
  }
  if (snapshot.errorOverlayCount > 0) {
    defects.push(`dev-server error overlay visible in capture DOM (${snapshot.errorOverlayCount})`)
  }
  return defects
}

const PFX_MATRIX_DIMENSION_WEIGHTS: Record<PfxVisualQualityDimension | PfxMobileQualityDimension, number> = {
  semanticIdentity: 0.7 / 12,
  gameplayReadability: 0.7 / 12,
  volumeAndDepth: 0.7 / 12,
  multiAngleResilience: 0.7 / 12,
  silhouetteAndComposition: 0.7 / 12,
  temporalArcAndDecay: 0.7 / 12,
  materialAndShaderQuality: 0.7 / 12,
  meshStructureAndEmitterQuality: 0.7 / 12,
  cc0AssetIntegration: 0.7 / 12,
  distinctivenessAndRingDiscipline: 0.7 / 12,
  scaleAndVisualHierarchy: 0.7 / 12,
  overallProductionPolish: 0.7 / 12,
  mobileFrameRateStability: 0.1,
  cpuAndGpuCost: 0.075,
  drawCallsParticlesAndOverdraw: 0.075,
  memoryAndThermalSuitability: 0.05,
}

export function createPfxQualityMatrix(input: PfxQualityMatrixInput): PfxQualityMatrix {
  const visualReviews = new Map(input.visualReviews.map((review) => [review.effectId, review]))
  const performanceReviews = new Map(input.performanceReviews.map((review) => [review.effectId, review]))
  const effects = input.effects.map((effect): PfxQualityMatrixEffect => {
    const visual = visualReviews.get(effect.effectId)
    const performance = performanceReviews.get(effect.effectId)
    const targetGrade = pfxTargetGradeForRank(effect.rank)
    const threshold = pfxMatrixQualityThreshold(targetGrade)
    const scores: Partial<PfxMatrixQualityScores> = {
      ...(visual?.scores ?? {}),
      ...(performance?.scores ?? {}),
    }
    const allScoresPresent = [...PFX_VISUAL_QUALITY_DIMENSIONS, ...PFX_MOBILE_QUALITY_DIMENSIONS]
      .every((dimension) => validPfxMatrixScore(scores[dimension]))
    const weightedScore = allScoresPresent
      ? round(Object.entries(PFX_MATRIX_DIMENSION_WEIGHTS).reduce(
          (total, [dimension, weight]) => total + (scores[dimension as keyof PfxMatrixQualityScores] ?? 0) * weight,
          0,
        ))
      : null
    const visualEvidenceComplete = visual != null &&
      Object.values(visual.cameraEvidence).every((references) => references.length >= 3) &&
      Object.values(visual.lifecycleEvidence).every((references) => references.length >= 3) &&
      visual.gameplayContextEvidence.length >= 1
    const visualScoresPass = visual != null && PFX_VISUAL_QUALITY_DIMENSIONS.every(
      (dimension) => visual.scores[dimension] >= threshold.minimumVisualDimension,
    )
    const visualPass = Boolean(
      visual &&
      visualScoresPass &&
      visualEvidenceComplete &&
      visual.reducedMotionReadable &&
      visual.reviewer.trim().length > 0 &&
      visual.reviewerConfidence >= 0 &&
      visual.reviewerConfidence <= 1 &&
      visual.blockers.length === 0,
    )
    const expectedConcurrency = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[effect.performanceTier]
    const modelYearPasses = performance != null && [performance.mobileSafari, performance.chromeAndroid].every((device) =>
      Number.isInteger(device.modelYear) && device.modelYear >= 2022,
    )
    const devicePasses = performance != null && [performance.mobileSafari, performance.chromeAndroid].every((device) =>
      pfxMatrixDevicePasses(device, expectedConcurrency, threshold.performanceHeadroomRequired),
    )
    const performanceScoresPass = performance != null && PFX_MOBILE_QUALITY_DIMENSIONS.every(
      (dimension) => performance.scores[dimension] >= 3,
    )
    const performancePass = Boolean(performance && devicePasses && performanceScoresPass && performance.blockers.length === 0)
    const weightedPass = weightedScore != null && weightedScore >= threshold.minimumWeightedScore
    const finalPass = visualPass && performancePass && weightedPass
    const blockers = [
      ...(!visual ? ['missing isolated visual review'] : []),
      ...(visual && !visualScoresPass ? ['one or more visual dimensions are below the assigned threshold'] : []),
      ...(visual && !visualEvidenceComplete ? ['isolated front, three-quarter, side, onset, peak, decay, or gameplay-context evidence is incomplete'] : []),
      ...(visual && !visual.reducedMotionReadable ? ['reduced-motion presentation is not gameplay-readable'] : []),
      ...(visual?.blockers ?? []),
      ...(!performance ? ['missing measured mobile Safari and Chrome Android review'] : []),
      ...(performance && !modelYearPasses ? ['real-device model-year floor failed; iOS and Android must be 2022 or newer'] : []),
      ...(performance && !devicePasses ? ['real-device high-frame-rate or canonical-concurrency gate failed'] : []),
      ...(performance && !performanceScoresPass ? ['one or more performance dimensions are below 3'] : []),
      ...(performance?.blockers ?? []),
      ...(weightedScore != null && !weightedPass ? [`weighted score ${weightedScore} is below ${threshold.minimumWeightedScore}`] : []),
      ...(!allScoresPresent ? ['one or more of the 16 required quality scores are missing or invalid'] : []),
    ]

    return {
      effectId: effect.effectId,
      rank: effect.rank,
      name: effect.name,
      performanceTier: effect.performanceTier,
      targetGrade,
      originalGrade: effect.originalGrade,
      afterGrade: weightedScore == null ? null : pfxMatrixGrade(weightedScore),
      scores,
      weightedScore,
      requiredQualityThreshold: threshold,
      cameraEvidence: visual?.cameraEvidence ?? {},
      lifecycleEvidence: visual?.lifecycleEvidence ?? {},
      gameplayContextEvidence: visual?.gameplayContextEvidence ?? [],
      mobileSafari: performance?.mobileSafari ?? null,
      chromeAndroid: performance?.chromeAndroid ?? null,
      reviewer: visual?.reviewer ?? null,
      reviewerConfidence: visual?.reviewerConfidence ?? null,
      reducedMotionReadable: visual?.reducedMotionReadable ?? null,
      visualPass,
      performancePass,
      finalPass,
      blockers: [...new Set(blockers)],
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-quality-matrix.v1',
    weights: {
      dimensions: { ...PFX_MATRIX_DIMENSION_WEIGHTS },
      visualQuality: 0.7,
      mobileReadiness: 0.3,
    },
    thresholds: {
      targetFps: 60,
      maximumP95FrameMs: 16.7,
      maximumWorstFrameMs: 33.4,
      minimumSustainedDurationSeconds: 180,
      tierConcurrency: { ...PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps },
    },
    summary: {
      totalEffects: effects.length,
      visualPasses: effects.filter((effect) => effect.visualPass).length,
      performancePasses: effects.filter((effect) => effect.performancePass).length,
      finalPasses: effects.filter((effect) => effect.finalPass).length,
    },
    effects,
  }
}

// Historical before-grades are optional progress metadata. Acceptance is
// determined only by current independent evidence; otherwise an already-great
// effect could never pass merely because no earlier review snapshot existed.
export function createPfxQualityMatrixEffectRows(): PfxMatrixEffectInput[] {
  const presetByEffectId = new Map(filterPfxCatalog({}).map((item) => [item.effect.id, item.preset]))
  return PFX_TAXONOMY.map((effect) => ({
    effectId: effect.id,
    rank: effect.rank,
    name: effect.name,
    originalGrade: null,
    performanceTier: presetByEffectId.get(effect.id)?.performance.tier ?? 'cinematic',
  }))
}

export function createPfxQualityMatrixBaseline(): PfxQualityMatrix {
  return createPfxQualityMatrix({
    effects: createPfxQualityMatrixEffectRows(),
    visualReviews: [],
    performanceReviews: [],
  })
}

export function createPfxQualityImprovementLedgerFromMatrix(
  matrix: PfxQualityMatrix,
  iteration: number,
  previous?: PfxQualityImprovementLedger,
): PfxQualityImprovementLedger {
  return createPfxQualityImprovementLedger({
    iteration,
    previous,
    effects: matrix.effects.map((effect) => {
      const visualScores = PFX_VISUAL_QUALITY_DIMENSIONS.map((dimension) => effect.scores[dimension])
      const completeVisualScores = visualScores.every(validPfxMatrixScore)
      const visualWeightedScore = completeVisualScores
        ? round(visualScores.reduce((total, score) => total + score!, 0) / visualScores.length)
        : null
      const performanceHeadroom = pfxMatrixPerformanceHeadroom(effect)
      return {
        effectId: effect.effectId,
        rank: effect.rank,
        currentGrade: effect.afterGrade,
        worstVisualScore: completeVisualScores ? Math.min(...visualScores) : null,
        // Final matrix weighting still fails closed until mobile evidence is
        // complete. The loop keeps the visual-only mean so art iterations can
        // demonstrate strict progress before physical-device profiling.
        weightedScore: effect.weightedScore ?? visualWeightedScore,
        visualBlockers: [...effect.blockers],
        systemicDefectKeys: [
          ...(completeVisualScores
            ? PFX_VISUAL_QUALITY_DIMENSIONS
                .filter((dimension) => effect.scores[dimension]! < effect.requiredQualityThreshold.minimumVisualDimension)
                .map((dimension) => `visual:${dimension}`)
            : ['evidence:independent-visual-review']),
          ...(!effect.performancePass ? ['performance:real-device'] : []),
        ],
        performancePassed: effect.performancePass,
        performanceHeadroomMs: performanceHeadroom,
      }
    }),
  })
}

function pfxMatrixPerformanceHeadroom(effect: PfxQualityMatrixEffect): number | null {
  if (!effect.mobileSafari || !effect.chromeAndroid) return null
  const p95Limit = effect.requiredQualityThreshold.performanceHeadroomRequired ? 15 : 16.7
  const worstFrameLimit = effect.requiredQualityThreshold.performanceHeadroomRequired ? 25 : 33.4
  return round(Math.min(
    p95Limit - effect.mobileSafari.p95FrameMs,
    worstFrameLimit - effect.mobileSafari.worstFrameMs,
    p95Limit - effect.chromeAndroid.p95FrameMs,
    worstFrameLimit - effect.chromeAndroid.worstFrameMs,
  ))
}

export function exportPfxQualityMatrixMarkdown(matrix: PfxQualityMatrix): string {
  const lines = [
    '# R3F PFX Per-Effect Quality Matrix',
    '',
    `Effects: ${matrix.summary.totalEffects}`,
    `Visual passes: ${matrix.summary.visualPasses}`,
    `Performance passes: ${matrix.summary.performancePasses}`,
    `Final passes: ${matrix.summary.finalPasses}`,
    `Mobile readiness weight: ${Math.round(matrix.weights.mobileReadiness * 100)}% (non-compensable)`,
    `Target: ${matrix.thresholds.targetFps} FPS, p95 <= ${matrix.thresholds.maximumP95FrameMs} ms at canonical tier concurrency.`,
    '',
    '| Rank | Effect | Before | After | Weighted | Visual | Performance | Final | Confidence | Blockers |',
    '| ---: | --- | :---: | :---: | ---: | :---: | :---: | :---: | ---: | --- |',
    ...matrix.effects.map((effect) =>
      `| ${effect.rank} | \`${effect.effectId}\` | ${effect.originalGrade ?? '—'} | ${effect.afterGrade ?? '—'} | ${effect.weightedScore ?? '—'} | ${pfxMatrixPassLabel(effect.visualPass)} | ${pfxMatrixPassLabel(effect.performancePass)} | ${pfxMatrixPassLabel(effect.finalPass)} | ${effect.reviewerConfidence ?? '—'} | ${effect.blockers.join('; ') || '—'} |`,
    ),
    '',
    '## Per-effect evidence',
    '',
  ]

  for (const effect of matrix.effects) {
    lines.push(
      `## ${effect.name} (\`${effect.effectId}\`)`,
      '',
      `Before/after grade: ${effect.originalGrade ?? '—'} / ${effect.afterGrade ?? '—'}`,
      `Weighted score: ${effect.weightedScore ?? '—'}`,
      `Required visual floor: ${effect.requiredQualityThreshold.minimumVisualDimension}/5`,
      `Required weighted score: ${effect.requiredQualityThreshold.minimumWeightedScore}/5`,
      `Performance headroom required: ${effect.requiredQualityThreshold.performanceHeadroomRequired ? 'yes' : 'no'}`,
      `Visual / performance / final: ${pfxMatrixPassLabel(effect.visualPass)} / ${pfxMatrixPassLabel(effect.performancePass)} / ${pfxMatrixPassLabel(effect.finalPass)}`,
      `Reviewer: ${effect.reviewer ?? '—'} (confidence ${effect.reviewerConfidence ?? '—'})`,
      `Reduced-motion readability: ${effect.reducedMotionReadable == null ? 'unreviewed' : effect.reducedMotionReadable ? 'pass' : 'fail'}`,
      '',
      '| Dimension | Score | Weight |',
      '| --- | ---: | ---: |',
      ...[...PFX_VISUAL_QUALITY_DIMENSIONS, ...PFX_MOBILE_QUALITY_DIMENSIONS].map((dimension) =>
        `| ${dimension} | ${effect.scores[dimension] ?? '—'} | ${round(matrix.weights.dimensions[dimension] * 100)}% |`,
      ),
      '',
      `Front evidence: ${pfxMatrixEvidenceList(effect.cameraEvidence.front)}`,
      `Three-quarter evidence: ${pfxMatrixEvidenceList(effect.cameraEvidence.threeQuarter)}`,
      `Side evidence: ${pfxMatrixEvidenceList(effect.cameraEvidence.side)}`,
      `Onset evidence: ${pfxMatrixEvidenceList(effect.lifecycleEvidence.onset)}`,
      `Peak evidence: ${pfxMatrixEvidenceList(effect.lifecycleEvidence.peak)}`,
      `Decay evidence: ${pfxMatrixEvidenceList(effect.lifecycleEvidence.decay)}`,
      `Gameplay-context evidence: ${pfxMatrixEvidenceList(effect.gameplayContextEvidence)}`,
      `Mobile Safari: ${pfxMatrixDeviceMarkdown(effect.mobileSafari)}`,
      `Chrome Android: ${pfxMatrixDeviceMarkdown(effect.chromeAndroid)}`,
      '',
      'Blockers:',
      '',
      ...(effect.blockers.length > 0 ? effect.blockers.map((blocker) => `- ${blocker}`) : ['- None']),
      '',
    )
  }

  return `${lines.join('\n')}\n`
}

function pfxMatrixPassLabel(pass: boolean): 'PASS' | 'FAIL' {
  return pass ? 'PASS' : 'FAIL'
}

function pfxMatrixEvidenceList(references: string[] | undefined): string {
  return references?.length ? references.map((reference) => `\`${reference}\``).join(', ') : 'missing'
}

function pfxMatrixDeviceMarkdown(device: PfxMatrixDeviceMetrics | null): string {
  if (!device) return 'missing'
  return [
    device.deviceLabel,
    `${device.fps} FPS`,
    `p95 ${device.p95FrameMs} ms`,
    `worst ${device.worstFrameMs} ms`,
    `${device.drawCalls} draws`,
    `${device.particles} particles`,
    `${device.overdrawRatio} overdraw`,
    `${device.memoryMb} MB`,
    `concurrency ${device.concurrency}`,
    `thermal ${device.thermalStatus}`,
    `evidence \`${device.evidence}\``,
  ].join(', ')
}

function pfxMatrixQualityThreshold(targetGrade: PfxQualityTargetGrade): PfxQualityMatrixEffect['requiredQualityThreshold'] {
  return {
    minimumVisualDimension: 4,
    minimumWeightedScore: targetGrade === 'A+' ? 4.7 : 4,
    performanceHeadroomRequired: true,
  }
}

function pfxMatrixDevicePasses(
  device: PfxMatrixDeviceMetrics,
  expectedConcurrency: number,
  headroomRequired: boolean,
): boolean {
  return device.measured &&
    Number.isInteger(device.modelYear) &&
    device.modelYear >= 2022 &&
    device.concurrency === expectedConcurrency &&
    device.fps >= 60 &&
    device.p95FrameMs <= (headroomRequired ? 15 : 16.7) &&
    device.worstFrameMs <= (headroomRequired ? 25 : 33.4) &&
    device.memoryGrowthMb <= 1 &&
    device.shaderCompilationStalls === 0 &&
    device.materialFrameHitches === 0 &&
    device.thermalStatus === 'nominal' &&
    device.sustainedDurationSeconds >= 180 &&
    device.evidence.trim().length > 0
}

function validPfxMatrixScore(score: number | undefined): score is number {
  return Number.isFinite(score) && score! >= 1 && score! <= 5
}

function pfxMatrixGrade(score: number): PfxMatrixGrade {
  if (score >= 4.7) return 'A+'
  if (score >= 4) return 'A'
  if (score >= 3) return 'B'
  if (score >= 2) return 'C'
  if (score >= 1) return 'D'
  return 'F'
}

export interface PfxBrowserAcceptanceEvidenceInput extends PfxMeasuredProfileEvidenceInput {
  productionApprovals?: readonly PfxProductionApproval[]
  productionImplementations?: readonly PfxProductionImplementationReview[]
  redTeamReview?: PfxRedTeamReviewTemplate
  realDeviceCaptureAudit?: PfxRealDeviceCaptureAudit
  realDeviceCaptureBaseUrl?: string
  realDeviceCaptureBatchIdsByEffectId?: Readonly<
    Record<string, Partial<Record<'mobile-safari' | 'chrome-android', string>>>
  >
  taxonomyReview?: PfxTaxonomyReviewTemplate
}

export interface PfxTaxonomyReviewEvidenceSummary {
  schema: 'game-bot.r3f-pfx-taxonomy-review-evidence.v1'
  passed: boolean
  summary: {
    totalEffects: number
    marketReviewedEffects: number
    pendingEffects: number
    blockedEffects: number
  }
  blockingFindings: string[]
  effects: Array<{
    effectId: string
    rank: number
    marketReviewed: boolean
    blockers: string[]
  }>
}

export interface PfxBrowserAcceptanceEvidenceSummary {
  schema: 'game-bot.r3f-pfx-browser-acceptance-evidence.v1'
  passed: boolean
  measuredProfileEvidence: PfxMeasuredProfileEvidenceSummary
  taxonomyReview: PfxTaxonomyReviewEvidenceSummary
  productionReadiness: PfxProductionReadinessReport
  productionGapAudit: PfxProductionAcceptanceGapAudit
  productionApprovalReadiness: PfxProductionApprovalReadinessReport
  blockingFindings: string[]
}

export interface PfxDefinitionOfDoneSmokeValidation {
  passed: boolean
  findings: string[]
}

const REQUIRED_DEFINITION_OF_DONE_SEARCHES = [
  'force field',
  'fireball',
  'cozy pickup sparkle',
  'mobile-safe hit impact',
] as const

const REQUIRED_DEFINITION_OF_DONE_SEARCH_RESULTS: Record<(typeof REQUIRED_DEFINITION_OF_DONE_SEARCHES)[number], string> = {
  'force field': 'Force Field',
  fireball: 'Fireball',
  'cozy pickup sparkle': 'Coin Pickup Sparkle',
  'mobile-safe hit impact': 'Hit Spark',
}

const REQUIRED_DEFINITION_OF_DONE_SEARCH_EFFECT_IDS: Record<(typeof REQUIRED_DEFINITION_OF_DONE_SEARCHES)[number], string> = {
  'force field': 'force-field',
  fireball: 'fireball',
  'cozy pickup sparkle': 'coin-pickup-sparkle',
  'mobile-safe hit impact': 'hit-spark',
}

const REQUIRED_DEFINITION_OF_DONE_CONTROLS = [
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
] as const

export interface PfxProductionApprovalMissingEvidencePath {
  effectId: string
  evidence: string
  filePath: string
}

export interface PfxProductionApprovalInvalidProfileEvidence {
  effectId: string
  evidence: string
  filePath: string
  reason: string
}

export interface PfxProductionApprovalInvalidTextEvidence {
  effectId: string
  evidence: string
  filePath: string
  reason: string
}

export function summarizeFrameSamples(samples: readonly number[]): FrameProfileSummary {
  if (samples.length === 0) {
    return {
      samples: 0,
      averageFrameMs: 0,
      p95FrameMs: 0,
      worstFrameMs: 0,
      fps: 0,
    }
  }

  const sorted = [...samples].sort((a, b) => a - b)
  const total = samples.reduce((sum, sample) => sum + sample, 0)
  const averageFrameMs = round(total / samples.length)
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
  const p95FrameMs = round(sorted[p95Index] ?? 0)
  const worstFrameMs = round(sorted[sorted.length - 1] ?? 0)

  return {
    samples: samples.length,
    averageFrameMs,
    p95FrameMs,
    worstFrameMs,
    fps: averageFrameMs > 0 ? round(1000 / averageFrameMs) : 0,
  }
}

export function normalizeBrowserProfileReports(input: BrowserProfileReport[] | { reports: BrowserProfileReport[] }): BrowserProfileReport[] {
  return Array.isArray(input) ? input : input.reports
}

export function normalizePfxProductionApprovals(input: unknown): PfxProductionApproval[] {
  const approvals = Array.isArray(input)
    ? input
    : isRecord(input) && input.schema === 'game-bot.r3f-pfx-production-approvals.v1' && Array.isArray(input.approvals)
      ? input.approvals
      : null

  if (!approvals) {
    throw new Error(
      'Production approval evidence must be an array or an object with production approval manifest schema game-bot.r3f-pfx-production-approvals.v1.',
    )
  }

  return approvals.map((approval, index) => normalizePfxProductionApproval(approval, index))
}

export function collectInvalidPfxProductionApprovalRows(approvals: readonly PfxProductionApproval[]): string[] {
  const effectIds = approvals.map((approval) => approval.effectId)
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const duplicateApprovalEffectIds = duplicateValues(effectIds)
  const unknownApprovalEffectIds = effectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  const approvalEffectIds = new Set(effectIds)
  const missingApprovalEffectIds = PFX_TAXONOMY.map((effect) => effect.id).filter((effectId) => !approvalEffectIds.has(effectId))
  const invalidEvidenceRows = approvals.filter((approval) => !productionApprovalEvidenceMatchesDecision(approval))
  const invalidRationaleRows = approvals.filter((approval) => !productionApprovalRationaleCitesEvidenceBasis(approval))
  return [
    ...(duplicateApprovalEffectIds.length > 0
      ? [`production approval manifest has duplicate effect rows: ${duplicateApprovalEffectIds.join(', ')}`]
      : []),
    ...(unknownApprovalEffectIds.length > 0
      ? [`production approval manifest has unknown effect rows: ${unknownApprovalEffectIds.join(', ')}`]
      : []),
    ...(missingApprovalEffectIds.length > 0
      ? [`production approval manifest is missing effect rows: ${formatEffectIdList(missingApprovalEffectIds)}`]
      : []),
    ...invalidEvidenceRows.map(
      (approval) => `${approval.effectId} ${approval.decision} approval evidence must exactly match canonical references`,
    ),
    ...invalidRationaleRows.map(
      (approval) => `${approval.effectId} ${approval.decision} approval rationale must cite reviewed evidence basis`,
    ),
  ]
}

function productionApprovalEvidenceMatchesDecision(approval: PfxProductionApproval): boolean {
  const expectedEvidence =
    approval.decision === 'production-ready'
      ? expectedProductionReadyApprovalEvidence(approval.effectId)
      : expectedApprovedDeferralEvidence(approval.effectId)
  return approval.evidence.length === expectedEvidence.length && expectedEvidence.every((expected, index) => approval.evidence[index] === expected)
}

function productionApprovalRationaleCitesEvidenceBasis(approval: PfxProductionApproval): boolean {
  const normalized = approval.rationale.trim().toLowerCase()
  if (normalized.length < 40) return false
  if (approval.decision === 'approved-deferral') {
    return (
      /\b(taxonomy|taxonomy slot|accepted taxonomy)\b/.test(normalized) &&
      /\b(deferral|deferred|defer)\b/.test(normalized) &&
      /\b(red-team|red team|adversarial)\b/.test(normalized)
    )
  }
  return (
    /\btaxonomy\b/.test(normalized) &&
    /\bimplementation\b/.test(normalized) &&
    /\b(mobile|profile|profiling|performance)\b/.test(normalized) &&
    /\b(red-team|red team)\b/.test(normalized)
  )
}

function expectedProductionReadyApprovalEvidence(effectId: string): string[] {
  return [
    `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effectId}`,
    `production-implementation:.context/r3f-pfx-production-implementation.json#${effectId}`,
    `mobile-safari-profile:.context/mobile-safari/${effectId}.json`,
    `chrome-android-profile:.context/chrome-android/${effectId}.json`,
    `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effectId}`,
  ]
}

function expectedApprovedDeferralEvidence(effectId: string): string[] {
  return [
    `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effectId}`,
    `approved-deferral:.context/r3f-pfx-red-team-review.json#${effectId}`,
    `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effectId}`,
  ]
}

function formatEffectIdList(effectIds: readonly string[]): string {
  const visibleEffectIds = effectIds.slice(0, 20)
  const omittedCount = effectIds.length - visibleEffectIds.length
  return omittedCount > 0
    ? `${visibleEffectIds.join(', ')} ... ${omittedCount} more`
    : visibleEffectIds.join(', ')
}

export function collectMissingPfxProductionApprovalEvidencePaths(
  approvals: readonly PfxProductionApproval[],
  exists: (filePath: string) => boolean,
): PfxProductionApprovalMissingEvidencePath[] {
  return approvals.flatMap((approval) =>
    approval.evidence.flatMap((evidence) => {
      const filePath = localEvidenceFilePath(evidence)
      if (!filePath || safelyPathExists(filePath, exists)) return []
      return [{ effectId: approval.effectId, evidence, filePath }]
    }),
  )
}

function safelyPathExists(filePath: string, exists: (filePath: string) => boolean): boolean {
  try {
    return exists(filePath)
  } catch {
    return false
  }
}

export function collectInvalidPfxProductionApprovalProfileEvidence(
  approvals: readonly PfxProductionApproval[],
  readProfileEvidence: (filePath: string) => unknown,
): PfxProductionApprovalInvalidProfileEvidence[] {
  return approvals.flatMap((approval) =>
    approval.evidence.flatMap((evidence) => {
      const platform = profileEvidencePlatform(evidence)
      if (!platform) return []

      const filePath = localEvidenceFilePath(evidence)
      if (!filePath) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath: '',
            reason: `missing ${platform.label} profile evidence file path`,
          },
        ]
      }

      let reports: BrowserProfileReport[]
      try {
        reports = normalizeProfileEvidenceFile(readProfileEvidence(filePath))
      } catch (error) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `invalid ${platform.label} profile evidence file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ]
      }

      if (reports.length !== 1) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `invalid ${platform.label} profile evidence file: expected exactly one profile report for ${approval.effectId}`,
          },
        ]
      }

      const hasMatchingReport = reports.some((report) => profileReportMatchesApproval(report, approval.effectId, platform))
      if (hasMatchingReport) return []
      return [
        {
          effectId: approval.effectId,
          evidence,
          filePath,
          reason: `missing ${platform.label} profile report for ${approval.effectId}`,
        },
      ]
    }),
  )
}

export function collectInvalidPfxProductionApprovalTextEvidence(
  approvals: readonly PfxProductionApproval[],
  readTextEvidence: (filePath: string) => string,
): PfxProductionApprovalInvalidTextEvidence[] {
  return approvals.flatMap((approval) =>
    approval.evidence.flatMap((evidence) => {
      const kind = evidenceKind(evidence)
      if (
        kind !== 'taxonomy-review' &&
        kind !== 'production-implementation' &&
        kind !== 'red-team-signoff' &&
        kind !== 'approved-deferral'
      ) {
        return []
      }

      const filePath = localEvidenceFilePath(evidence)
      if (!filePath) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath: '',
            reason: `${kind} evidence is missing a local file path for ${approval.effectId}`,
          },
        ]
      }

      let text: string
      try {
        text = readTextEvidence(filePath)
      } catch (error) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `${productionApprovalEvidenceKindLabel(kind)} evidence file is unreadable: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ]
      }
      const nonApprovingEvidenceLabel = nonApprovingProductionApprovalEvidenceLabel(text)
      if (nonApprovingEvidenceLabel) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `${productionApprovalEvidenceKindLabel(kind)} evidence points to non-approving ${nonApprovingEvidenceLabel}`,
          },
        ]
      }

      if (kind === 'taxonomy-review') {
        const integrityFinding = taxonomyReviewManifestIntegrityFinding(text)
        if (integrityFinding) {
          return [
            {
              effectId: approval.effectId,
              evidence,
              filePath,
              reason: `taxonomy review evidence ${integrityFinding}`,
            },
          ]
        }
      }

      if (kind === 'taxonomy-review' && !taxonomyReviewTextSupportsEffect(text, approval.effectId)) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `taxonomy review evidence is not market-reviewed for ${approval.effectId}`,
          },
        ]
      }

      if (kind === 'production-implementation') {
        const integrityFinding = productionImplementationManifestIntegrityFinding(text)
        if (integrityFinding) {
          return [
            {
              effectId: approval.effectId,
              evidence,
              filePath,
              reason: `production implementation evidence ${integrityFinding}`,
            },
          ]
        }
      }

      if (kind === 'production-implementation' && !productionImplementationTextSupportsEffect(text, approval.effectId)) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `production implementation evidence does not reference ${approval.effectId}`,
          },
        ]
      }

      if (kind === 'red-team-signoff' || kind === 'approved-deferral') {
        const integrityFinding = redTeamReviewManifestIntegrityFinding(text)
        if (integrityFinding) {
          return [
            {
              effectId: approval.effectId,
              evidence,
              filePath,
              reason: `${productionApprovalEvidenceKindLabel(kind)} evidence ${integrityFinding}`,
            },
          ]
        }
      }

      if (kind === 'approved-deferral' && !textRecordsApprovedDeferral(text, approval.effectId)) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `approved deferral evidence does not record a deferral for ${approval.effectId}`,
          },
        ]
      }

      const redTeamEvidenceSupportsApproval =
        approval.decision === 'approved-deferral'
          ? textRecordsApprovedDeferral(text, approval.effectId)
          : redTeamTextSignsOffEffect(text, approval.effectId)
      if (kind === 'red-team-signoff' && !redTeamEvidenceSupportsApproval) {
        return [
          {
            effectId: approval.effectId,
            evidence,
            filePath,
            reason: `red-team signoff evidence is not signed off for ${approval.effectId}`,
          },
        ]
      }

      return []
    }),
  )
}

function productionApprovalEvidenceKindLabel(
  kind: 'taxonomy-review' | 'production-implementation' | 'red-team-signoff' | 'approved-deferral',
): string {
  if (kind === 'taxonomy-review') return 'taxonomy review'
  if (kind === 'production-implementation') return 'production implementation'
  if (kind === 'red-team-signoff') return 'red-team signoff'
  return 'approved deferral'
}

function nonApprovingProductionApprovalEvidenceLabel(text: string): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!parsed || typeof parsed !== 'object') return undefined

  const record = parsed as { schema?: unknown; instructions?: { approvalStatus?: unknown } }
  const schema = typeof record.schema === 'string' ? record.schema : ''
  const approvalStatus =
    record.instructions && typeof record.instructions.approvalStatus === 'string'
      ? record.instructions.approvalStatus
      : ''
  if (!schema.includes('external-evidence') && !approvalStatus.includes('non-approving')) return undefined
  if (!approvalStatus.includes('non-approving')) return undefined
  if (schema === 'game-bot.r3f-pfx-external-evidence-batch-sheet.v1') return 'external evidence batch sheet'
  if (schema === 'game-bot.r3f-pfx-external-evidence-batch-plan.v1') return 'external evidence batch plan'
  if (schema === 'game-bot.r3f-pfx-external-evidence-work-order.v1') return 'external evidence work order'
  return 'external evidence artifact'
}

export function verifyPfxMeasuredProfileEvidence(
  input: PfxMeasuredProfileEvidenceInput,
): PfxMeasuredProfileEvidenceSummary {
  const failures: string[] = []
  const thresholdFailures: PfxMeasuredProfileThresholdFailure[] = []

  const authoredCoverage = collectSuiteCoverage({
    suiteLabel: 'authored',
    expectedScenarios: AUTHORED_PROFILE_SCENARIOS,
    reports: input.authoredReports,
    failures,
    thresholdFailures,
  })
  const profileBackedCoverage = collectSuiteCoverage({
    suiteLabel: 'profile-backed',
    expectedScenarios: PROFILE_BACKED_PROFILE_SCENARIOS,
    reports: input.profileBackedReports,
    failures,
    thresholdFailures,
  })
  const catalogStressCoverage = collectSuiteCoverage({
    suiteLabel: 'catalog-stress',
    expectedScenarios: CATALOG_STRESS_PROFILE_SCENARIOS,
    reports: input.catalogStressReports,
    failures,
    thresholdFailures,
  })

  const representativeMissing = input.representativeReports
    ? missingScenarioIds(PROFILE_SCENARIOS, input.representativeReports)
    : []
  if (input.representativeReports) {
    collectThresholdFailures('representative', input.representativeReports, failures, thresholdFailures)
    for (const scenarioId of representativeMissing) failures.push(`missing representative report: ${scenarioId}`)
  }

  const singleEffectIds = [
    ...AUTHORED_PROFILE_SCENARIOS.map((scenario) => scenario.search),
    ...PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => scenario.search),
  ]
  const presentSingleEffectIds = [
    ...effectIdsForReports(AUTHORED_PROFILE_SCENARIOS, input.authoredReports),
    ...effectIdsForReports(PROFILE_BACKED_PROFILE_SCENARIOS, input.profileBackedReports),
  ]
  const missingSingleEffectIds = singleEffectIds.filter((id) => !presentSingleEffectIds.includes(id))
  for (const effectId of missingSingleEffectIds) failures.push(`missing single-effect measured evidence: ${effectId}`)

  const expectedStressEffectIds = CATALOG_STRESS_PROFILE_SCENARIOS.flatMap((scenario) => scenario.effectIds ?? [])
  const presentStressEffectIds = effectIdsForReports(CATALOG_STRESS_PROFILE_SCENARIOS, input.catalogStressReports)
  const missingStressEffectIds = expectedStressEffectIds.filter((id) => !presentStressEffectIds.includes(id))
  for (const effectId of missingStressEffectIds) failures.push(`missing catalog-stress measured evidence: ${effectId}`)

  const allReports = [
    ...(input.representativeReports ?? []),
    ...input.authoredReports,
    ...input.profileBackedReports,
    ...input.catalogStressReports,
  ]

  return {
    schema: 'game-bot.r3f-pfx-measured-profile-evidence.v1',
    passed: failures.length === 0,
    failures,
    singleEffectCoverage: {
      authoredPreviewEffects: AUTHORED_PROFILE_SCENARIOS.length - authoredCoverage.missingScenarioIds.length,
      profileBackedEffects: PROFILE_BACKED_PROFILE_SCENARIOS.length - profileBackedCoverage.missingScenarioIds.length,
      totalEffects: new Set(presentSingleEffectIds).size,
      missingEffectIds: missingSingleEffectIds,
      unexpectedScenarioIds: [...authoredCoverage.unexpectedScenarioIds, ...profileBackedCoverage.unexpectedScenarioIds],
      duplicateScenarioIds: [...authoredCoverage.duplicateScenarioIds, ...profileBackedCoverage.duplicateScenarioIds],
    },
    catalogStressCoverage: {
      chunks: CATALOG_STRESS_PROFILE_SCENARIOS.length - catalogStressCoverage.missingScenarioIds.length,
      totalEffects: new Set(presentStressEffectIds).size,
      missingEffectIds: missingStressEffectIds,
      unexpectedScenarioIds: catalogStressCoverage.unexpectedScenarioIds,
      duplicateScenarioIds: catalogStressCoverage.duplicateScenarioIds,
    },
    representativeScenarios: {
      reports: input.representativeReports?.length ?? 0,
      missingScenarioIds: representativeMissing,
    },
    thresholdFailures,
    worstP95FrameMs: maxReportMetric(allReports, (report) => report.frame.p95FrameMs),
    worstOverdrawRatio: maxReportMetric(allReports, (report) => report.overdraw.nonBackgroundRatio),
    maxDrawCalls: maxReportMetric(allReports, (report) => report.scenario.totalDrawCalls),
    maxParticles: maxReportMetric(allReports, (report) => report.scenario.totalParticles),
  }
}

export function createPfxEffectPerformanceEvidenceMatrix(
  input: PfxMeasuredProfileEvidenceInput,
): PfxEffectPerformanceEvidenceMatrix {
  const authoredReportsByScenarioId = new Map(input.authoredReports.map((report) => [report.scenario.id, report]))
  const profileBackedReportsByScenarioId = new Map(input.profileBackedReports.map((report) => [report.scenario.id, report]))
  const stressReportsByScenarioId = new Map(input.catalogStressReports.map((report) => [report.scenario.id, report]))
  const authoredScenarioByEffectId = new Map(AUTHORED_PROFILE_SCENARIOS.map((scenario) => [scenario.search, scenario]))
  const profileBackedScenarioByEffectId = new Map(PROFILE_BACKED_PROFILE_SCENARIOS.map((scenario) => [scenario.search, scenario]))
  const stressScenarioByEffectId = new Map<string, ProfileScenarioDefinition>()
  for (const scenario of CATALOG_STRESS_PROFILE_SCENARIOS) {
    for (const effectId of scenario.effectIds ?? []) {
      stressScenarioByEffectId.set(effectId, scenario)
    }
  }

  const effects = PFX_TAXONOMY.map((effect): PfxEffectPerformanceEvidenceMatrixEffect => {
    const authoredScenario = authoredScenarioByEffectId.get(effect.id)
    const profileBackedScenario = profileBackedScenarioByEffectId.get(effect.id)
    const singleScenario = authoredScenario ?? profileBackedScenario
    const singleReport = authoredScenario
      ? authoredReportsByScenarioId.get(authoredScenario.id)
      : profileBackedScenario
        ? profileBackedReportsByScenarioId.get(profileBackedScenario.id)
        : undefined
    const stressScenario = stressScenarioByEffectId.get(effect.id)
    const stressReport = stressScenario ? stressReportsByScenarioId.get(stressScenario.id) : undefined
    const singleThresholdPassed = singleReport ? reportThresholdPassed(singleReport) : false
    const stressThresholdPassed = stressReport ? reportThresholdPassed(stressReport) : false
    const hasLocalProfiles = singleReport != null && stressReport != null
    const localThresholdPassed = hasLocalProfiles && singleThresholdPassed && stressThresholdPassed
    const status: PfxEffectPerformanceEvidenceStatus = !hasLocalProfiles
      ? 'missing-local-profile'
      : localThresholdPassed
        ? 'local-profiled-requires-real-device'
        : 'local-threshold-failed'

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      status,
      singleEffect: {
        suite: authoredScenario ? 'authored' : profileBackedScenario ? 'profile-backed' : 'missing',
        scenarioId: singleScenario?.id ?? null,
        thresholdPassed: singleThresholdPassed,
      },
      catalogStress: {
        scenarioId: stressScenario?.id ?? null,
        thresholdPassed: stressThresholdPassed,
      },
      realDevice: {
        mobileSafari: 'missing',
        chromeAndroid: 'missing',
      },
      metrics: {
        p95FrameMs: round(Math.max(singleReport?.frame.p95FrameMs ?? 0, stressReport?.frame.p95FrameMs ?? 0)),
        overdrawRatio: round(Math.max(singleReport?.overdraw.nonBackgroundRatio ?? 0, stressReport?.overdraw.nonBackgroundRatio ?? 0)),
        drawCalls: Math.max(singleReport?.scenario.totalDrawCalls ?? 0, stressReport?.scenario.totalDrawCalls ?? 0),
        particles: Math.max(singleReport?.scenario.totalParticles ?? 0, stressReport?.scenario.totalParticles ?? 0),
        singleEffect: profileReportMetricSnapshot(singleReport),
        catalogStress: profileReportMetricSnapshot(stressReport),
      },
      profileEvidence: [
        singleScenario
          ? `${authoredScenario ? 'authored-profile' : 'profile-backed-profile'}:.context/${authoredScenario ? 'r3f-pfx-authored-profile.json' : 'r3f-pfx-profile-backed-profile.json'}#${singleScenario.id}`
          : `missing-single-effect-profile:${effect.id}`,
        stressScenario
          ? `catalog-stress-profile:.context/r3f-pfx-catalog-stress-profile.json#${stressScenario.id}`
          : `missing-catalog-stress-profile:${effect.id}`,
        `mobile-safari-profile:.context/mobile-safari/${effect.id}.json`,
        `chrome-android-profile:.context/chrome-android/${effect.id}.json`,
      ],
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-effect-performance-matrix.v1',
    summary: {
      totalEffects: effects.length,
      effectsWithSingleEffectProfile: effects.filter((effect) => effect.singleEffect.scenarioId != null).length,
      effectsWithCatalogStressProfile: effects.filter((effect) => effect.catalogStress.scenarioId != null).length,
      effectsPassingLocalThresholds: effects.filter(
        (effect) => effect.singleEffect.thresholdPassed && effect.catalogStress.thresholdPassed,
      ).length,
      effectsRequiringRealDeviceProfiles: effects.filter(
        (effect) => effect.realDevice.mobileSafari === 'missing' || effect.realDevice.chromeAndroid === 'missing',
      ).length,
    },
    effects,
  }
}

export function createPfxBrowserAcceptanceEvidence(
  input: PfxBrowserAcceptanceEvidenceInput,
): PfxBrowserAcceptanceEvidenceSummary {
  const measuredProfileEvidence = verifyPfxMeasuredProfileEvidence(input)
  const taxonomyReview = createPfxTaxonomyReviewEvidence(input.taxonomyReview)
  const productionApprovalRowFindings =
    input.productionApprovals === undefined ? [] : collectInvalidPfxProductionApprovalRows(input.productionApprovals)
  const realDeviceAuditValidation = validatePfxRealDeviceCaptureAudit(input.realDeviceCaptureAudit)
  const realDeviceProfiledEffectIds = realDeviceAuditValidation.creditedEffectIds
  const mobileSafariProfiledEffectIds = realDeviceAuditValidation.findings.length
    ? []
    : (input.realDeviceCaptureAudit?.effects
        .filter((effect) => effect.platformStatus['mobile-safari'].valid)
        .map((effect) => effect.effectId) ?? [])
  const chromeAndroidProfiledEffectIds = realDeviceAuditValidation.findings.length
    ? []
    : (input.realDeviceCaptureAudit?.effects
        .filter((effect) => effect.platformStatus['chrome-android'].valid)
        .map((effect) => effect.effectId) ?? [])
  const taxonomyManifestIntegrityFailed = taxonomyReview.blockingFindings.some((finding) =>
    finding.startsWith('taxonomy review manifest'),
  )
  const taxonomyReviewedEffectIds = taxonomyManifestIntegrityFailed
    ? []
    : taxonomyReview.effects.filter((effect) => effect.marketReviewed).map((effect) => effect.effectId)
  const productionReadiness = createPfxProductionReadinessReport({
    approvals: input.productionApprovals,
    implementations: input.productionImplementations,
    redTeamReviews: input.redTeamReview?.reviews,
    realDeviceProfiledEffectIds,
    mobileSafariProfiledEffectIds,
    chromeAndroidProfiledEffectIds,
    taxonomyReviewedEffectIds,
  })
  const productionGapAudit = createPfxProductionAcceptanceGapAudit({
    approvals: input.productionApprovals,
    implementations: input.productionImplementations,
    redTeamReviews: input.redTeamReview?.reviews,
    realDeviceProfiledEffectIds,
    mobileSafariProfiledEffectIds,
    chromeAndroidProfiledEffectIds,
    taxonomyReviewedEffectIds,
    realDeviceCaptureBaseUrl: input.realDeviceCaptureBaseUrl,
    realDeviceCaptureBatchIdsByEffectId: input.realDeviceCaptureBatchIdsByEffectId,
  })
  const productionApprovalReadiness = createPfxProductionApprovalReadinessReport({
    approvals: input.productionApprovals,
    implementations: input.productionImplementations,
    redTeamReviews: input.redTeamReview?.reviews,
    realDeviceProfiledEffectIds,
    mobileSafariProfiledEffectIds,
    chromeAndroidProfiledEffectIds,
    realDeviceCaptureBaseUrl: input.realDeviceCaptureBaseUrl,
    realDeviceCaptureBatchIdsByEffectId: input.realDeviceCaptureBatchIdsByEffectId,
    taxonomyReviewedEffectIds,
  })
  const blockingFindings = [
    ...measuredProfileEvidence.failures.map((failure) => `measured-profile: ${failure}`),
    ...taxonomyReview.blockingFindings.map((finding) => `taxonomy-review: ${finding}`),
    ...productionApprovalRowFindings.map((finding) => `production-approvals: ${finding}`),
    ...realDeviceAuditValidation.findings.map((finding) => `real-device-audit: ${finding}`),
    ...productionReadiness.blockingFindings.map((finding) => `production-readiness: ${finding}`),
  ]

  return {
    schema: 'game-bot.r3f-pfx-browser-acceptance-evidence.v1',
    passed:
      measuredProfileEvidence.passed &&
      taxonomyReview.passed &&
      productionApprovalRowFindings.length === 0 &&
      realDeviceAuditValidation.passed &&
      productionReadiness.passed,
    measuredProfileEvidence,
    taxonomyReview,
    productionReadiness,
    productionGapAudit,
    productionApprovalReadiness,
    blockingFindings,
  }
}

export function validatePfxDefinitionOfDoneSmokeEvidence(input: unknown): PfxDefinitionOfDoneSmokeValidation {
	  const evidence = input as {
	    schema?: unknown
	    externalEvidenceFinalAcceptanceStatus?: unknown
	    externalEvidenceFinalAcceptanceBlockerCounts?: unknown
	    viewport?: unknown
	    countText?: unknown
    definitionOfDoneSearches?: unknown
    manifest?: {
      schema?: unknown
      totalEffects?: unknown
      forceFieldHasThumbnail?: unknown
      forceFieldHasAnimatedClip?: unknown
      forceFieldHasStyleContactSheet?: unknown
      forceFieldHasControlExtremesContactSheet?: unknown
      forceFieldHasMarketSources?: unknown
      forceFieldThumbnailFileName?: unknown
      forceFieldAnimatedClipFileName?: unknown
      forceFieldStyleContactSheetFileName?: unknown
      forceFieldControlExtremesContactSheetFileName?: unknown
      forceFieldAnimatedClipFrames?: unknown
    }
    customizationEvidence?: {
      editedControls?: unknown
      before?: unknown
      after?: unknown
      fullControlSurfaceCovered?: unknown
      jsonPresetIncludesCustomizedControls?: unknown
      performanceRecomputedAfterCustomization?: unknown
    }
    realDeviceCapturePanel?: {
      effectId?: unknown
      platform?: unknown
      scenarioId?: unknown
      effectCount?: unknown
      totalParticles?: unknown
      deviceClass?: unknown
      overdrawMeasurementSource?: unknown
      downloadFileName?: unknown
      downloadPayloadMatchesJson?: unknown
      uploadDisabledForInvalidDesktopCapture?: unknown
      continueDisabledForInvalidDesktopCapture?: unknown
      blockingFindingText?: unknown
      validMobileUploadContinuation?: unknown
    }
    exportEvidence?: {
      effectId?: unknown
      componentSnippetIncludesFactory?: unknown
      componentSnippetExportsNamedComponent?: unknown
      componentSnippetUsesTypedProps?: unknown
      docsIncludeComponentSnippet?: unknown
      docsIncludeQualityRubric?: unknown
      docsIncludeProductionCaveat?: unknown
      jsonPresetIncludesQualityScores?: unknown
      jsonPresetIncludesStyleRender?: unknown
    }
    realDeviceHandoffHealth?: {
      rendered?: unknown
      totalItems?: unknown
      totalBatches?: unknown
      indexPassed?: unknown
      filesPassed?: unknown
      indexPath?: unknown
      bulkCommand?: unknown
    }
    objectiveReadinessHandoffHealth?: {
      rendered?: unknown
      locallySatisfiedRequirements?: unknown
      totalRequirements?: unknown
      externalEvidenceRequiredRequirements?: unknown
      blockedRequirements?: unknown
      operatorLaunchHref?: unknown
      operatorStatusHref?: unknown
    }
    operatorStatusWorkQueue?: unknown
    redTeamReviewHandoffHealth?: {
      rendered?: unknown
      totalItems?: unknown
      totalBatches?: unknown
      indexPassed?: unknown
      filesPassed?: unknown
      indexPath?: unknown
      bulkCommand?: unknown
      operatorLaunchHref?: unknown
      operatorStatusHref?: unknown
    }
    productionApprovalHandoffHealth?: {
      rendered?: unknown
      totalItems?: unknown
      totalBatches?: unknown
      indexPassed?: unknown
      filesPassed?: unknown
      indexPath?: unknown
      bulkCommand?: unknown
      operatorLaunchHref?: unknown
      operatorStatusHref?: unknown
      approvalBlockers?: unknown
    }
    externalEvidenceHandoffHealth?: {
      rendered?: unknown
      readyForPhoneCapture?: unknown
      captureUrlItems?: unknown
      networkReachableCaptureUrlItems?: unknown
      batchScopedAutoUploadUrlItems?: unknown
      readyBatchScopedAutoUploadUrlItems?: unknown
      missingBatchScopedAutoUploadUrlItems?: unknown
      autoUploadRequiresDeviceLabelItems?: unknown
      taxonomyReviewItems?: unknown
      productionImplementationItems?: unknown
      mobileSafariCaptureItems?: unknown
      chromeAndroidCaptureItems?: unknown
      redTeamReviewItems?: unknown
      finalApprovalItems?: unknown
      nextMobileSafariCaptureHref?: unknown
      nextMobileSafariAutoUploadHref?: unknown
      nextChromeAndroidCaptureHref?: unknown
      nextChromeAndroidAutoUploadHref?: unknown
      indexPath?: unknown
      bulkCommand?: unknown
    }
  }
  const findings: string[] = []

  if (evidence?.schema !== 'game-bot.r3f-pfx-definition-of-done-smoke.v1') {
    findings.push('definition-of-done-smoke: invalid schema')
  }
  if (!definitionOfDoneFinalBlockerStatusIsRendered(evidence?.externalEvidenceFinalAcceptanceStatus)) {
    findings.push('definition-of-done-smoke: final blocker status must render real-device, red-team, and approval requirements')
  }
  if (!definitionOfDoneFinalBlockerCountsAreRendered(evidence?.externalEvidenceFinalAcceptanceBlockerCounts)) {
    findings.push(
      'definition-of-done-smoke: final blocker counts must render Safari, Android, red-team, and approval blockers',
    )
  } else if (!definitionOfDoneFinalBlockerCountsMatchGoal(evidence.externalEvidenceFinalAcceptanceBlockerCounts)) {
    findings.push('definition-of-done-smoke: final blocker counts must show all four 500-count external blockers')
  }
  if (!definitionOfDoneViewportIsMobile(evidence?.viewport)) {
    findings.push('definition-of-done-smoke: browser smoke must run in the mobile viewport')
  }
  if (!initialBrowserCountShowsFullCatalog(evidence?.countText)) {
    findings.push('definition-of-done-smoke: initial browser count must show all 500 effects')
  }

  const searches = Array.isArray(evidence?.definitionOfDoneSearches) ? evidence.definitionOfDoneSearches : []
  for (const query of REQUIRED_DEFINITION_OF_DONE_SEARCHES) {
    const matchingSearches = searches.filter((candidate) => {
      const search = candidate as { query?: unknown; resultCountText?: unknown }
      return search.query === query && typeof search.resultCountText === 'string' && search.resultCountText.includes('SHOWING')
    })
    const hasSearchProof = matchingSearches.length > 0
    if (!hasSearchProof) findings.push(`definition-of-done-smoke: missing search proof for ${query}`)
    if (
      hasSearchProof &&
      !matchingSearches.some((candidate) => {
        const search = candidate as { expectedResultText?: unknown }
        return search.expectedResultText === REQUIRED_DEFINITION_OF_DONE_SEARCH_RESULTS[query]
      })
    ) {
      findings.push(
        `definition-of-done-smoke: search proof for ${query} must target ${REQUIRED_DEFINITION_OF_DONE_SEARCH_RESULTS[query]}`,
      )
    }
    if (
      hasSearchProof &&
      !matchingSearches.some((candidate) => {
        const search = candidate as { expectedEffectId?: unknown }
        return search.expectedEffectId === REQUIRED_DEFINITION_OF_DONE_SEARCH_EFFECT_IDS[query]
      })
    ) {
      findings.push(
        `definition-of-done-smoke: search proof for ${query} must target effect ${REQUIRED_DEFINITION_OF_DONE_SEARCH_EFFECT_IDS[query]}`,
      )
    }
    if (
      query === 'mobile-safe hit impact' &&
      hasSearchProof &&
      !matchingSearches.some((candidate) => (candidate as { mobileSafeFilter?: unknown }).mobileSafeFilter === true)
    ) {
      findings.push('definition-of-done-smoke: mobile-safe hit impact must prove the mobile-safe filter was enabled')
    }
    if (
      hasSearchProof &&
      !matchingSearches.some((candidate) => {
        const search = candidate as { resultCountText?: unknown }
        return typeof search.resultCountText === 'string' && renderedResultCountIsPositive(search.resultCountText)
      })
    ) {
      findings.push(`definition-of-done-smoke: search proof for ${query} must show at least one rendered match`)
    }
  }

  if (evidence?.manifest?.schema !== 'game-bot.r3f-pfx-preview-manifest.v1') {
    findings.push('definition-of-done-smoke: preview manifest schema is missing')
  }
  if (evidence?.manifest?.totalEffects !== PFX_TAXONOMY.length) {
    findings.push(`definition-of-done-smoke: preview manifest totalEffects must be ${PFX_TAXONOMY.length}`)
  }
  for (const [key, label] of [
    ['forceFieldHasThumbnail', 'force field thumbnail'],
    ['forceFieldHasAnimatedClip', 'force field animated clip'],
    ['forceFieldHasStyleContactSheet', 'force field style contact sheet'],
    ['forceFieldHasControlExtremesContactSheet', 'force field control extremes contact sheet'],
    ['forceFieldHasMarketSources', 'force field market sources'],
  ] as const) {
    if (evidence?.manifest?.[key] !== true) findings.push(`definition-of-done-smoke: missing ${label} proof`)
  }
  if (!forceFieldPreviewAssetFilesAreConcrete(evidence?.manifest)) {
    findings.push('definition-of-done-smoke: force field preview assets must include concrete file names and animated frame count')
  }

  const editedControls = Array.isArray(evidence?.customizationEvidence?.editedControls)
    ? evidence.customizationEvidence.editedControls.map(String)
    : []
  for (const control of REQUIRED_DEFINITION_OF_DONE_CONTROLS) {
    if (!editedControls.includes(control)) findings.push(`definition-of-done-smoke: missing customization proof for ${control}`)
  }
  if (evidence?.customizationEvidence?.fullControlSurfaceCovered !== true) {
    findings.push('definition-of-done-smoke: fullControlSurfaceCovered must be true')
  }
  if (evidence?.customizationEvidence?.jsonPresetIncludesCustomizedControls !== true) {
    findings.push('definition-of-done-smoke: jsonPresetIncludesCustomizedControls must be true')
  }
  if (!customizationEvidenceIncludesTunedJsonExportValues(evidence?.customizationEvidence)) {
    findings.push('definition-of-done-smoke: customization evidence must include the tuned JSON export values')
  }
  if (evidence?.customizationEvidence?.performanceRecomputedAfterCustomization !== true) {
    findings.push('definition-of-done-smoke: performanceRecomputedAfterCustomization must be true')
  }

  for (const [key, label] of [
    ['componentSnippetIncludesFactory', 'componentSnippetIncludesFactory'],
    ['componentSnippetExportsNamedComponent', 'componentSnippetExportsNamedComponent'],
    ['componentSnippetUsesTypedProps', 'componentSnippetUsesTypedProps'],
    ['docsIncludeComponentSnippet', 'docsIncludeComponentSnippet'],
    ['docsIncludeQualityRubric', 'docsIncludeQualityRubric'],
    ['docsIncludeProductionCaveat', 'docsIncludeProductionCaveat'],
    ['jsonPresetIncludesQualityScores', 'jsonPresetIncludesQualityScores'],
    ['jsonPresetIncludesStyleRender', 'jsonPresetIncludesStyleRender'],
  ] as const) {
    if (evidence?.exportEvidence?.[key] !== true) findings.push(`definition-of-done-smoke: ${label} must be true`)
  }
  if (evidence?.exportEvidence?.effectId !== 'force-field') {
    findings.push('definition-of-done-smoke: export evidence must target force-field')
  }

  if (evidence?.realDeviceCapturePanel?.effectId !== 'fireball') {
    findings.push('definition-of-done-smoke: capture panel must target fireball')
  }
  if (evidence?.realDeviceCapturePanel?.platform !== 'chrome-android') {
    findings.push('definition-of-done-smoke: capture panel must use chrome-android profile intent')
  }
  if (evidence?.realDeviceCapturePanel?.scenarioId !== 'mobile-fireball-single') {
    findings.push('definition-of-done-smoke: capture panel must use mobile-fireball-single scenario')
  }
  if (
    evidence?.realDeviceCapturePanel?.effectCount !== 1 ||
    typeof evidence?.realDeviceCapturePanel?.totalParticles !== 'number' ||
    evidence.realDeviceCapturePanel.totalParticles <= 0
  ) {
    findings.push('definition-of-done-smoke: capture panel must prove a single fireball effect with particles')
  }
  if (evidence?.realDeviceCapturePanel?.deviceClass !== 'real-device') {
    findings.push('definition-of-done-smoke: capture panel must expose real-device capture metadata')
  }
  if (evidence?.realDeviceCapturePanel?.overdrawMeasurementSource !== 'screenshot-readback') {
    findings.push('definition-of-done-smoke: capture panel must expose screenshot-readback overdraw evidence')
  }
  if (evidence?.realDeviceCapturePanel?.downloadFileName !== 'fireball.json') {
    findings.push('definition-of-done-smoke: capture panel download filename must be fireball.json')
  }
  if (evidence?.realDeviceCapturePanel?.downloadPayloadMatchesJson !== true) {
    findings.push('definition-of-done-smoke: capture panel download payload must match JSON')
  }
  if (evidence?.realDeviceCapturePanel?.uploadDisabledForInvalidDesktopCapture !== true) {
    findings.push('definition-of-done-smoke: capture panel must disable invalid desktop upload')
  }
  if (evidence?.realDeviceCapturePanel?.continueDisabledForInvalidDesktopCapture !== true) {
    findings.push('definition-of-done-smoke: capture panel must disable invalid desktop upload-and-continue')
  }
  if (
    typeof evidence?.realDeviceCapturePanel?.blockingFindingText !== 'string' ||
    !evidence.realDeviceCapturePanel.blockingFindingText.includes('not valid final real-device evidence')
  ) {
    findings.push('definition-of-done-smoke: capture panel must render invalid desktop capture blocking finding')
  }
  if (!validMobileUploadContinuationIsProven(evidence?.realDeviceCapturePanel?.validMobileUploadContinuation)) {
    findings.push('definition-of-done-smoke: capture panel must prove a valid emulated mobile upload continuation')
  }
  if (!operatorStatusWorkQueueProvesDeviceLabelGuard(evidence?.operatorStatusWorkQueue)) {
    findings.push('definition-of-done-smoke: operator status must prove device-label guardrails for auto-upload URLs')
  }
  if (!operatorStatusWorkQueueProvesPlatformQueueGuard(evidence?.operatorStatusWorkQueue)) {
    findings.push(
      'definition-of-done-smoke: operator status must prove mobile Safari and Chrome Android platform queue guardrails',
    )
  }
  if (!operatorStatusWorkQueueProvesChecklistCommands(evidence?.operatorStatusWorkQueue)) {
    findings.push('definition-of-done-smoke: operator status must prove capture-to-acceptance checklist commands')
  }
  if (!operatorStatusWorkQueueProvesDeviceCaptureSummary(evidence?.operatorStatusWorkQueue)) {
    findings.push('definition-of-done-smoke: operator status must prove device-scoped capture summary')
  }
  if (!operatorStatusWorkQueueProvesFinalBlockers(evidence?.operatorStatusWorkQueue)) {
    findings.push('definition-of-done-smoke: operator status must prove all four 500-count final blockers')
  }
  if (!operatorLaunchPageRendersChecklist(evidence?.operatorStatusWorkQueue)) {
    findings.push('definition-of-done-smoke: operator launch page must render the capture-to-acceptance checklist')
  }

  const handoffHealth = evidence?.externalEvidenceHandoffHealth
  if (
    typeof handoffHealth?.captureUrlItems !== 'number' ||
    handoffHealth.captureUrlItems <= 0 ||
    handoffHealth?.networkReachableCaptureUrlItems !== handoffHealth.captureUrlItems
  ) {
    findings.push('definition-of-done-smoke: external evidence handoff health must prove network-reachable capture URLs')
  }
  if (
    handoffHealth?.rendered !== true ||
    handoffHealth?.readyForPhoneCapture !== true ||
    typeof handoffHealth?.batchScopedAutoUploadUrlItems !== 'number' ||
    handoffHealth.batchScopedAutoUploadUrlItems <= 0 ||
    handoffHealth?.readyBatchScopedAutoUploadUrlItems !== handoffHealth.batchScopedAutoUploadUrlItems ||
    handoffHealth?.missingBatchScopedAutoUploadUrlItems !== 0
  ) {
    findings.push('definition-of-done-smoke: external evidence handoff health must be rendered and phone-ready')
  }
  if (
    typeof handoffHealth?.autoUploadRequiresDeviceLabelItems !== 'number' ||
    typeof handoffHealth?.batchScopedAutoUploadUrlItems !== 'number' ||
    handoffHealth.autoUploadRequiresDeviceLabelItems !== handoffHealth.batchScopedAutoUploadUrlItems
  ) {
    findings.push('definition-of-done-smoke: external evidence handoff must require device labels for every auto-upload item')
  }
  if (!externalEvidenceWorkItemBreakdownMatchesGoal(handoffHealth)) {
    findings.push('definition-of-done-smoke: external evidence handoff must render exact remaining work item counts')
  }
  if (
    typeof handoffHealth?.nextMobileSafariCaptureHref !== 'string' ||
    !handoffHealth.nextMobileSafariCaptureHref.includes('profilePlatform=mobile-safari') ||
    typeof handoffHealth?.nextMobileSafariAutoUploadHref !== 'string' ||
    !handoffHealth.nextMobileSafariAutoUploadHref.includes('platform=mobile-safari') ||
    !handoffHealth.nextMobileSafariAutoUploadHref.includes('profileAutoUpload=1') ||
    typeof handoffHealth?.nextChromeAndroidCaptureHref !== 'string' ||
    !handoffHealth.nextChromeAndroidCaptureHref.includes('profilePlatform=chrome-android') ||
    typeof handoffHealth?.nextChromeAndroidAutoUploadHref !== 'string' ||
    !handoffHealth.nextChromeAndroidAutoUploadHref.includes('platform=chrome-android') ||
    !handoffHealth.nextChromeAndroidAutoUploadHref.includes('profileAutoUpload=1')
  ) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff health must render next mobile Safari and Chrome Android capture links',
    )
  }
  if (
    !urlHasConcreteProfileDeviceLabel(handoffHealth?.nextMobileSafariAutoUploadHref) ||
    !urlHasConcreteProfileDeviceLabel(handoffHealth?.nextChromeAndroidAutoUploadHref)
  ) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff next auto-upload links must include a concrete profileDeviceLabel',
    )
  }
  if (
    typeof handoffHealth?.indexPath !== 'string' ||
    !handoffHealth.indexPath.includes('external-evidence-batch-sheet-index') ||
    typeof handoffHealth?.bulkCommand !== 'string' ||
    !handoffHealth.bulkCommand.includes('export:external-evidence')
  ) {
    findings.push('definition-of-done-smoke: external evidence handoff health must render batch index and command')
  }
  if (!externalEvidenceBulkCommandIncludesSourceInputs(handoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must include all source evidence inputs',
    )
  }
  if (!externalEvidenceBulkCommandTargetsCanonicalSourceInputs(handoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must target canonical source evidence inputs',
    )
  }
  if (!externalEvidenceBulkCommandTargetsCanonicalBatchOutputs(handoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must target canonical evidence batch outputs',
    )
  }
  if (!externalEvidenceBulkCommandTargetsCanonicalWorkOrderOutputs(handoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must target canonical work-order outputs',
    )
  }
  if (!externalEvidenceBulkCommandIncludesReadableBatchPlanMarkdownOutput(handoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must include readable batch plan Markdown output',
    )
  }
  if (
    !bulkCommandTargetsRenderedIndexPath(
      handoffHealth?.bulkCommand,
      '--external-evidence-batch-sheet-index-output',
      handoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must target the rendered evidence batch index',
    )
  }
  if (
    !bulkCommandTargetsRenderedMarkdownIndexPath(
      handoffHealth?.bulkCommand,
      '--external-evidence-batch-sheet-index-markdown-output',
      handoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: external evidence handoff bulk command must target the rendered evidence Markdown index',
    )
  }
  const realDeviceHandoffHealth = evidence?.realDeviceHandoffHealth
  if (
    realDeviceHandoffHealth?.rendered !== true ||
    typeof realDeviceHandoffHealth?.totalItems !== 'number' ||
    realDeviceHandoffHealth.totalItems <= 0 ||
    typeof realDeviceHandoffHealth?.totalBatches !== 'number' ||
    realDeviceHandoffHealth.totalBatches <= 0 ||
    realDeviceHandoffHealth?.indexPassed !== true ||
    realDeviceHandoffHealth?.filesPassed !== true ||
    typeof realDeviceHandoffHealth?.indexPath !== 'string' ||
    !realDeviceHandoffHealth.indexPath.includes('real-device-capture-batch-sheet-index') ||
    typeof realDeviceHandoffHealth?.bulkCommand !== 'string' ||
    !realDeviceHandoffHealth.bulkCommand.includes('export:capture-plan')
  ) {
    findings.push('definition-of-done-smoke: real-device handoff health must be rendered with valid batch files and command')
  }
  if (!realDeviceBulkCommandIncludesProductionHandoffOutputs(realDeviceHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: real-device handoff bulk command must include base URL and batch output flags',
    )
  }
  if (!realDeviceBulkCommandTargetsCanonicalProductionHandoffOutputs(realDeviceHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: real-device handoff bulk command must target canonical capture batch outputs',
    )
  }
  if (
    !bulkCommandTargetsRenderedIndexPath(
      realDeviceHandoffHealth?.bulkCommand,
      '--batch-sheet-index-output',
      realDeviceHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: real-device handoff bulk command must target the rendered capture batch index',
    )
  }
  if (
    !bulkCommandTargetsRenderedMarkdownIndexPath(
      realDeviceHandoffHealth?.bulkCommand,
      '--batch-sheet-index-markdown-output',
      realDeviceHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: real-device handoff bulk command must target the rendered capture Markdown index',
    )
  }
  if (!objectiveReadinessHandoffMatchesExternalGateState(evidence?.objectiveReadinessHandoffHealth)) {
    findings.push(
      'definition-of-done-smoke: objective readiness handoff must show 15/18 local, 3 external blockers, and concrete operator links',
    )
  }
  const redTeamReviewHandoffHealth = evidence?.redTeamReviewHandoffHealth
  if (
    redTeamReviewHandoffHealth?.rendered !== true ||
    typeof redTeamReviewHandoffHealth?.totalItems !== 'number' ||
    redTeamReviewHandoffHealth.totalItems <= 0 ||
    typeof redTeamReviewHandoffHealth?.totalBatches !== 'number' ||
    redTeamReviewHandoffHealth.totalBatches <= 0 ||
    redTeamReviewHandoffHealth?.indexPassed !== true ||
    redTeamReviewHandoffHealth?.filesPassed !== true ||
    typeof redTeamReviewHandoffHealth?.indexPath !== 'string' ||
    !redTeamReviewHandoffHealth.indexPath.includes('red-team-review-batch-sheet-index') ||
    typeof redTeamReviewHandoffHealth?.bulkCommand !== 'string' ||
    !redTeamReviewHandoffHealth.bulkCommand.includes('verify:red-team')
  ) {
    findings.push('definition-of-done-smoke: red-team review handoff health must be rendered with valid batch files and command')
  }
  if (!redTeamBulkCommandIncludesRealDeviceInputs(redTeamReviewHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must include real-device evidence inputs',
    )
  }
  if (!redTeamBulkCommandTargetsCanonicalRealDeviceInputs(redTeamReviewHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must target canonical real-device evidence inputs',
    )
  }
  if (!redTeamBulkCommandIncludesReviewBatchOutputs(redTeamReviewHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must include review batch output flags',
    )
  }
  if (!redTeamBulkCommandTargetsCanonicalReviewBatchOutputs(redTeamReviewHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must target canonical review batch outputs',
    )
  }
  if (
    !bulkCommandTargetsRenderedIndexPath(
      redTeamReviewHandoffHealth?.bulkCommand,
      '--red-team-batch-sheet-index-output',
      redTeamReviewHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must target the rendered review batch index',
    )
  }
  if (
    !bulkCommandTargetsRenderedMarkdownIndexPath(
      redTeamReviewHandoffHealth?.bulkCommand,
      '--red-team-batch-sheet-index-markdown-output',
      redTeamReviewHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: red-team handoff bulk command must target the rendered review Markdown index',
    )
  }
  const productionApprovalHandoffHealth = evidence?.productionApprovalHandoffHealth
  if (
    productionApprovalHandoffHealth?.rendered !== true ||
    typeof productionApprovalHandoffHealth?.totalItems !== 'number' ||
    productionApprovalHandoffHealth.totalItems <= 0 ||
    typeof productionApprovalHandoffHealth?.totalBatches !== 'number' ||
    productionApprovalHandoffHealth.totalBatches <= 0 ||
    productionApprovalHandoffHealth?.indexPassed !== true ||
    productionApprovalHandoffHealth?.filesPassed !== true ||
    typeof productionApprovalHandoffHealth?.indexPath !== 'string' ||
    !productionApprovalHandoffHealth.indexPath.includes('production-approval-batch-sheet-index') ||
    typeof productionApprovalHandoffHealth?.bulkCommand !== 'string' ||
    !productionApprovalHandoffHealth.bulkCommand.includes('verify:approvals')
  ) {
    findings.push('definition-of-done-smoke: production approval handoff health must be rendered with valid batch files and command')
  }
  if (!productionApprovalBulkCommandIncludesPrerequisiteInputs(productionApprovalHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must include all prerequisite evidence inputs',
    )
  }
  if (!productionApprovalBulkCommandTargetsCanonicalPrerequisiteInputs(productionApprovalHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must target canonical prerequisite evidence inputs',
    )
  }
  if (!productionApprovalBulkCommandIncludesApprovalBatchOutputs(productionApprovalHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must include approval batch output flags',
    )
  }
  if (!productionApprovalBulkCommandTargetsCanonicalApprovalBatchOutputs(productionApprovalHandoffHealth?.bulkCommand)) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must target canonical approval batch outputs',
    )
  }
  if (
    !bulkCommandTargetsRenderedIndexPath(
      productionApprovalHandoffHealth?.bulkCommand,
      '--approval-batch-sheet-index-output',
      productionApprovalHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must target the rendered approval batch index',
    )
  }
  if (
    !bulkCommandTargetsRenderedMarkdownIndexPath(
      productionApprovalHandoffHealth?.bulkCommand,
      '--approval-batch-sheet-index-markdown-output',
      productionApprovalHandoffHealth?.indexPath,
    )
  ) {
    findings.push(
      'definition-of-done-smoke: production approval handoff bulk command must target the rendered approval Markdown index',
    )
  }
  if (
    !externalReviewHandoffExposesConcreteOperatorLinks(redTeamReviewHandoffHealth) ||
    !externalReviewHandoffExposesConcreteOperatorLinks(productionApprovalHandoffHealth)
  ) {
    findings.push(
      'definition-of-done-smoke: red-team and production approval handoffs must expose concrete operator launch/status links',
    )
  }
  if (!handoffQueueTotalsMatchGoal(realDeviceHandoffHealth, redTeamReviewHandoffHealth, productionApprovalHandoffHealth)) {
    findings.push(
      'definition-of-done-smoke: handoff queues must show exact 1000 real-device and 500 review/approval items across 20 batches',
    )
  }
  if (!definitionOfDoneApprovalBlockersMatchGoal(productionApprovalHandoffHealth?.approvalBlockers)) {
    findings.push(
      'definition-of-done-smoke: production approval handoff blockers must show all four 500-count external blockers',
    )
  }

  return {
    passed: findings.length === 0,
    findings,
  }
}

function renderedResultCountIsPositive(resultCountText: string): boolean {
  const match = resultCountText.match(/SHOWING\s+(\d+)\s+OF\s+(\d+)/i)
  return Boolean(match && Number(match[1]) > 0 && Number(match[2]) > 0)
}

function initialBrowserCountShowsFullCatalog(input: unknown): boolean {
  if (typeof input !== 'string') return false
  const match = input.match(/SHOWING\s+(\d+)\s+OF\s+(\d+)/i)
  return Boolean(match && Number(match[1]) === PFX_TAXONOMY.length && Number(match[2]) === PFX_TAXONOMY.length)
}

function definitionOfDoneViewportIsMobile(input: unknown): boolean {
  const viewport = input as
    | {
        width?: unknown
        height?: unknown
        deviceScaleFactor?: unknown
        isMobile?: unknown
      }
    | undefined
  return (
    viewport?.width === 390 &&
    viewport?.height === 844 &&
    viewport?.deviceScaleFactor === 2 &&
    viewport?.isMobile === true
  )
}

function definitionOfDoneFinalBlockerStatusIsRendered(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return (
    input.includes('Final acceptance blocked until') &&
    input.includes('real-device profiling') &&
    input.includes('red-team signoff') &&
    input.includes('final production approvals')
  )
}

function definitionOfDoneFinalBlockerCountsAreRendered(input: unknown): boolean {
  const evidence = input as
    | {
        rendered?: unknown
        text?: unknown
        missingMobileSafariProfiles?: unknown
        missingChromeAndroidProfiles?: unknown
        missingRedTeamSignoff?: unknown
        pendingMetadataApprovals?: unknown
      }
    | undefined
  if (evidence?.rendered !== true || typeof evidence.text !== 'string') return false
  return (
    evidence.text.includes('Final blockers:') &&
    evidence.text.includes('Safari') &&
    evidence.text.includes('Android') &&
    evidence.text.includes('red-team') &&
    evidence.text.includes('approvals') &&
    typeof evidence.missingMobileSafariProfiles === 'number' &&
    typeof evidence.missingChromeAndroidProfiles === 'number' &&
    typeof evidence.missingRedTeamSignoff === 'number' &&
    typeof evidence.pendingMetadataApprovals === 'number'
  )
}

function definitionOfDoneFinalBlockerCountsMatchGoal(input: unknown): boolean {
  const evidence = input as
    | {
        missingMobileSafariProfiles?: unknown
        missingChromeAndroidProfiles?: unknown
        missingRedTeamSignoff?: unknown
        pendingMetadataApprovals?: unknown
      }
    | undefined
  return (
    evidence?.missingMobileSafariProfiles === PFX_TAXONOMY.length &&
    evidence?.missingChromeAndroidProfiles === PFX_TAXONOMY.length &&
    evidence?.missingRedTeamSignoff === PFX_TAXONOMY.length &&
    evidence?.pendingMetadataApprovals === PFX_TAXONOMY.length
  )
}

function definitionOfDoneApprovalBlockersMatchGoal(input: unknown): boolean {
  const evidence = input as
    | {
        missingMobileSafariProfiles?: unknown
        missingChromeAndroidProfiles?: unknown
        missingRedTeamSignoff?: unknown
        pendingFinalApprovals?: unknown
      }
    | undefined
  return (
    evidence?.missingMobileSafariProfiles === PFX_TAXONOMY.length &&
    evidence?.missingChromeAndroidProfiles === PFX_TAXONOMY.length &&
    evidence?.missingRedTeamSignoff === PFX_TAXONOMY.length &&
    evidence?.pendingFinalApprovals === PFX_TAXONOMY.length
  )
}

function forceFieldPreviewAssetFilesAreConcrete(manifest: unknown): boolean {
  const evidence = manifest as
    | {
        forceFieldThumbnailFileName?: unknown
        forceFieldAnimatedClipFileName?: unknown
        forceFieldStyleContactSheetFileName?: unknown
        forceFieldControlExtremesContactSheetFileName?: unknown
        forceFieldAnimatedClipFrames?: unknown
      }
    | undefined
  return (
    evidence?.forceFieldThumbnailFileName === 'force-field.svg' &&
    evidence?.forceFieldAnimatedClipFileName === 'force-field-clip.svg' &&
    evidence?.forceFieldStyleContactSheetFileName === 'force-field-style-contact-sheet.svg' &&
    evidence?.forceFieldControlExtremesContactSheetFileName === 'force-field-control-extremes-contact-sheet.svg' &&
    typeof evidence?.forceFieldAnimatedClipFrames === 'number' &&
    evidence.forceFieldAnimatedClipFrames >= 12
  )
}

function externalEvidenceWorkItemBreakdownMatchesGoal(handoffHealth: unknown): boolean {
  const evidence = handoffHealth as
    | {
        taxonomyReviewItems?: unknown
        productionImplementationItems?: unknown
        mobileSafariCaptureItems?: unknown
        chromeAndroidCaptureItems?: unknown
        redTeamReviewItems?: unknown
        finalApprovalItems?: unknown
      }
    | undefined
  return (
    evidence?.taxonomyReviewItems === 0 &&
    evidence?.productionImplementationItems === 0 &&
    evidence?.mobileSafariCaptureItems === PFX_TAXONOMY.length &&
    evidence?.chromeAndroidCaptureItems === PFX_TAXONOMY.length &&
    evidence?.redTeamReviewItems === PFX_TAXONOMY.length &&
    evidence?.finalApprovalItems === PFX_TAXONOMY.length
  )
}

function externalEvidenceBulkCommandIncludesSourceInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--taxonomy-review',
    '--production-implementations',
    '--real-device-audit',
    '--real-device-batches',
    '--red-team-review',
    '--production-approvals',
  ].every((flag) => input.includes(flag))
}

function externalEvidenceBulkCommandTargetsCanonicalSourceInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--taxonomy-review .context/r3f-pfx-taxonomy-review.json',
    '--production-implementations .context/r3f-pfx-production-implementation.json',
    '--real-device-audit .context/r3f-pfx-real-device-capture-audit.json',
    '--real-device-batches .context/r3f-pfx-real-device-capture-batches.json',
    '--red-team-review .context/r3f-pfx-red-team-review.json',
    '--production-approvals .context/r3f-pfx-production-approvals.json',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function externalEvidenceBulkCommandTargetsCanonicalBatchOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--external-evidence-batch-plan-output .context/r3f-pfx-external-evidence-batch-plan.json',
    '--external-evidence-batch-sheet-directory .context/external-evidence-batches',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function externalEvidenceBulkCommandTargetsCanonicalWorkOrderOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--external-evidence-work-order-output .context/r3f-pfx-external-evidence-work-order.json',
    '--external-evidence-work-order-markdown-output .context/r3f-pfx-external-evidence-work-order.md',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function externalEvidenceBulkCommandIncludesReadableBatchPlanMarkdownOutput(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return input.includes(
    '--external-evidence-batch-plan-markdown-output .context/r3f-pfx-external-evidence-batch-plan.md',
  )
}

function realDeviceBulkCommandIncludesProductionHandoffOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--base-url',
    '--batch-output',
    '--batch-sheet-directory',
    '--batch-sheet-index-output',
    '--batch-sheet-index-markdown-output',
  ].every((flag) => input.includes(flag))
}

function realDeviceBulkCommandTargetsCanonicalProductionHandoffOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--batch-output .context/r3f-pfx-real-device-capture-batches.json',
    '--batch-sheet-directory .context/real-device-capture-batches',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function redTeamBulkCommandIncludesRealDeviceInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return ['--real-device-audit', '--real-device-batches'].every((flag) => input.includes(flag))
}

function redTeamBulkCommandTargetsCanonicalRealDeviceInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--real-device-audit .context/r3f-pfx-real-device-capture-audit.json',
    '--real-device-batches .context/r3f-pfx-real-device-capture-batches.json',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function redTeamBulkCommandIncludesReviewBatchOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--red-team-batch-sheet-directory',
    '--red-team-batch-sheet-index-output',
    '--red-team-batch-sheet-index-markdown-output',
  ].every((flag) => input.includes(flag))
}

function redTeamBulkCommandTargetsCanonicalReviewBatchOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return ['--red-team-batch-sheet-directory .context/red-team-review-batches'].every((flagAndPath) =>
    input.includes(flagAndPath),
  )
}

function productionApprovalBulkCommandIncludesPrerequisiteInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--taxonomy-review',
    '--production-implementations',
    '--real-device-audit',
    '--real-device-batches',
    '--red-team-review',
  ].every((flag) => input.includes(flag))
}

function productionApprovalBulkCommandTargetsCanonicalPrerequisiteInputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--taxonomy-review .context/r3f-pfx-taxonomy-review.json',
    '--production-implementations .context/r3f-pfx-production-implementation.json',
    '--real-device-audit .context/r3f-pfx-real-device-capture-audit.json',
    '--real-device-batches .context/r3f-pfx-real-device-capture-batches.json',
    '--red-team-review .context/r3f-pfx-red-team-review.json',
  ].every((flagAndPath) => input.includes(flagAndPath))
}

function productionApprovalBulkCommandIncludesApprovalBatchOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return [
    '--approval-batch-sheet-directory',
    '--approval-batch-sheet-index-output',
    '--approval-batch-sheet-index-markdown-output',
  ].every((flag) => input.includes(flag))
}

function productionApprovalBulkCommandTargetsCanonicalApprovalBatchOutputs(input: unknown): boolean {
  if (typeof input !== 'string') return false
  return ['--approval-batch-sheet-directory .context/production-approval-batches'].every((flagAndPath) =>
    input.includes(flagAndPath),
  )
}

function bulkCommandTargetsRenderedIndexPath(command: unknown, flag: string, indexPath: unknown): boolean {
  if (typeof command !== 'string' || typeof indexPath !== 'string') return false
  return command.includes(`${flag} ${indexPath}`)
}

function bulkCommandTargetsRenderedMarkdownIndexPath(command: unknown, flag: string, indexPath: unknown): boolean {
  if (typeof command !== 'string' || typeof indexPath !== 'string' || !indexPath.endsWith('.json')) return false
  const markdownPath = indexPath.replace(/\.json$/, '.md')
  return command.includes(`${flag} ${markdownPath}`)
}

function externalReviewHandoffExposesConcreteOperatorLinks(input: unknown): boolean {
  const evidence = input as
    | {
        operatorLaunchHref?: unknown
        operatorStatusHref?: unknown
      }
    | undefined
  return (
    typeof evidence?.operatorLaunchHref === 'string' &&
    evidence.operatorLaunchHref.includes('/__r3f-pfx-capture-operator') &&
    urlHasConcreteProfileDeviceLabel(evidence.operatorLaunchHref) &&
    typeof evidence?.operatorStatusHref === 'string' &&
    evidence.operatorStatusHref.includes('/__r3f-pfx-capture-operator-status') &&
    urlHasConcreteProfileDeviceLabel(evidence.operatorStatusHref)
  )
}

function handoffQueueTotalsMatchGoal(realDevice: unknown, redTeamReview: unknown, productionApproval: unknown): boolean {
  const realDeviceEvidence = realDevice as { totalItems?: unknown; totalBatches?: unknown } | undefined
  const redTeamEvidence = redTeamReview as { totalItems?: unknown; totalBatches?: unknown } | undefined
  const approvalEvidence = productionApproval as { totalItems?: unknown; totalBatches?: unknown } | undefined
  return (
    realDeviceEvidence?.totalItems === PFX_TAXONOMY.length * 2 &&
    realDeviceEvidence?.totalBatches === 20 &&
    redTeamEvidence?.totalItems === PFX_TAXONOMY.length &&
    redTeamEvidence?.totalBatches === 20 &&
    approvalEvidence?.totalItems === PFX_TAXONOMY.length &&
    approvalEvidence?.totalBatches === 20
  )
}

function objectiveReadinessHandoffMatchesExternalGateState(input: unknown): boolean {
  const evidence = input as
    | {
        rendered?: unknown
        locallySatisfiedRequirements?: unknown
        totalRequirements?: unknown
        externalEvidenceRequiredRequirements?: unknown
        blockedRequirements?: unknown
        operatorLaunchHref?: unknown
        operatorStatusHref?: unknown
      }
    | undefined
  return (
    evidence?.rendered === true &&
    evidence?.locallySatisfiedRequirements === 15 &&
    evidence?.totalRequirements === 18 &&
    evidence?.externalEvidenceRequiredRequirements === 3 &&
    evidence?.blockedRequirements === 3 &&
    externalReviewHandoffExposesConcreteOperatorLinks(evidence)
  )
}

function validMobileUploadContinuationIsProven(input: unknown): boolean {
  const evidence = input as
    | {
        uploadResultStatus?: unknown
        runCompleteRendered?: unknown
        nextBatchAutoUploadQueueReadyHref?: unknown
        readyHrefHasDeviceLabel?: unknown
        readyHrefBatchId?: unknown
      }
    | undefined
  return (
    evidence?.uploadResultStatus === 'imported' &&
    evidence?.runCompleteRendered === true &&
    evidence?.readyHrefHasDeviceLabel === true &&
    evidence?.readyHrefBatchId === 'real-device-batch-012' &&
    urlHasConcreteProfileDeviceLabel(evidence?.nextBatchAutoUploadQueueReadyHref) &&
    typeof evidence?.nextBatchAutoUploadQueueReadyHref === 'string' &&
    evidence.nextBatchAutoUploadQueueReadyHref.includes('/__r3f-pfx-capture-next') &&
    evidence.nextBatchAutoUploadQueueReadyHref.includes('profileAutoUpload=1')
  )
}

function operatorStatusWorkQueueProvesDeviceLabelGuard(input: unknown): boolean {
  const evidence = input as
    | {
        fetched?: unknown
        totalOpenWorkItems?: unknown
        readyWorkItems?: unknown
        blockedWorkItems?: unknown
        nextReadyEffectId?: unknown
        nextReadyWorkItemId?: unknown
        nextReadyAutoUploadHasDeviceLabel?: unknown
        nextReadyMobileSafariEffectId?: unknown
        nextReadyChromeAndroidEffectId?: unknown
        nextReadyMobileSafariAutoUploadHasDeviceLabel?: unknown
        nextReadyChromeAndroidAutoUploadHasDeviceLabel?: unknown
        nextBlockedRedTeamEffectId?: unknown
        nextBlockedFinalApprovalEffectId?: unknown
        labeledDeviceLabelRequirementReady?: unknown
        placeholderDeviceLabelRejected?: unknown
        placeholderAutoUploadUrlsSuppressed?: unknown
        placeholderRequirementFinding?: unknown
      }
    | undefined
  return (
    evidence?.fetched === true &&
    evidence?.totalOpenWorkItems === 2000 &&
    evidence?.readyWorkItems === 1000 &&
    evidence?.blockedWorkItems === 1000 &&
    evidence?.nextReadyEffectId === 'fireball' &&
    evidence?.nextReadyWorkItemId === 'mobile-safari-capture' &&
    evidence?.nextReadyAutoUploadHasDeviceLabel === true &&
    evidence?.nextReadyMobileSafariEffectId === 'fireball' &&
    evidence?.nextReadyChromeAndroidEffectId === 'fireball' &&
    evidence?.nextReadyMobileSafariAutoUploadHasDeviceLabel === true &&
    evidence?.nextReadyChromeAndroidAutoUploadHasDeviceLabel === true &&
    evidence?.nextBlockedRedTeamEffectId === 'fireball' &&
    evidence?.nextBlockedFinalApprovalEffectId === 'fireball' &&
    evidence?.labeledDeviceLabelRequirementReady === true &&
    evidence?.placeholderDeviceLabelRejected === true &&
    evidence?.placeholderAutoUploadUrlsSuppressed === true &&
    typeof evidence?.placeholderRequirementFinding === 'string' &&
    evidence.placeholderRequirementFinding.includes('concrete real device') &&
    evidence.placeholderRequirementFinding.includes('auto-upload URLs')
  )
}

function operatorStatusWorkQueueProvesPlatformQueueGuard(input: unknown): boolean {
  const evidence = input as
    | {
        labeledPlatformAutoUploadUrlsHaveDeviceLabel?: unknown
        placeholderPlatformAutoUploadUrlsSuppressed?: unknown
        nextMobileSafariBatchId?: unknown
        nextChromeAndroidBatchId?: unknown
        nextMobileSafariEffectId?: unknown
        nextChromeAndroidEffectId?: unknown
      }
    | undefined
  return (
    evidence?.labeledPlatformAutoUploadUrlsHaveDeviceLabel === true &&
    evidence?.placeholderPlatformAutoUploadUrlsSuppressed === true &&
    evidence?.nextMobileSafariBatchId === 'real-device-batch-001' &&
    evidence?.nextChromeAndroidBatchId === 'real-device-batch-011' &&
    evidence?.nextMobileSafariEffectId === 'fireball' &&
    evidence?.nextChromeAndroidEffectId === 'fireball'
  )
}

function operatorStatusWorkQueueProvesChecklistCommands(input: unknown): boolean {
  const evidence = input as
    | {
        operatorChecklistIncludesDeviceLabelStep?: unknown
        operatorChecklistIncludesPlatformAutoRunSteps?: unknown
        operatorChecklistIncludesVerifierCommands?: unknown
      }
    | undefined
  return (
    evidence?.operatorChecklistIncludesDeviceLabelStep === true &&
    evidence?.operatorChecklistIncludesPlatformAutoRunSteps === true &&
    evidence?.operatorChecklistIncludesVerifierCommands === true
  )
}

function operatorStatusWorkQueueProvesDeviceCaptureSummary(input: unknown): boolean {
  const evidence = input as
    | {
        deviceCaptureSummaryMatchesLabel?: unknown
        deviceCaptureSummaryTotalForLabel?: unknown
        deviceCaptureSummaryMobileSafariForLabel?: unknown
        deviceCaptureSummaryChromeAndroidForLabel?: unknown
      }
    | undefined
  return (
    evidence?.deviceCaptureSummaryMatchesLabel === true &&
    evidence?.deviceCaptureSummaryTotalForLabel === 0 &&
    evidence?.deviceCaptureSummaryMobileSafariForLabel === 0 &&
    evidence?.deviceCaptureSummaryChromeAndroidForLabel === 0
  )
}

function operatorStatusWorkQueueProvesFinalBlockers(input: unknown): boolean {
  const evidence = input as
    | {
        operatorStatusFinalBlockersMatchGoal?: unknown
        operatorStatusMobileSafariProfiles?: unknown
        operatorStatusChromeAndroidProfiles?: unknown
        operatorStatusRedTeamReviews?: unknown
        operatorStatusFinalApprovals?: unknown
      }
    | undefined
  return (
    evidence?.operatorStatusFinalBlockersMatchGoal === true &&
    evidence?.operatorStatusMobileSafariProfiles === PFX_TAXONOMY.length &&
    evidence?.operatorStatusChromeAndroidProfiles === PFX_TAXONOMY.length &&
    evidence?.operatorStatusRedTeamReviews === PFX_TAXONOMY.length &&
    evidence?.operatorStatusFinalApprovals === PFX_TAXONOMY.length
  )
}

function operatorLaunchPageRendersChecklist(input: unknown): boolean {
  const evidence = input as
    | {
        operatorLaunchPageChecklistRendered?: unknown
        operatorLaunchPageChecklistIncludesVerifierCommands?: unknown
      }
    | undefined
  return (
    evidence?.operatorLaunchPageChecklistRendered === true &&
    evidence?.operatorLaunchPageChecklistIncludesVerifierCommands === true
  )
}

function urlHasConcreteProfileDeviceLabel(input: unknown): boolean {
  if (typeof input !== 'string') return false
  try {
    const label = new URL(input, 'http://example.test').searchParams.get('profileDeviceLabel')?.trim().toLowerCase()
    return Boolean(
      label &&
        label !== 'unspecified real device' &&
        label !== 'unknown device' &&
        label !== 'unknown' &&
        label !== '{profiledevicelabel}' &&
        label !== 'profiledevicelabel' &&
        !label.includes('profiledevicelabel'),
    )
  } catch {
    return false
  }
}

function customizationEvidenceIncludesTunedJsonExportValues(customizationEvidence: unknown): boolean {
  const evidence = customizationEvidence as { before?: unknown; after?: unknown } | undefined
  const before = evidence?.before as Record<string, unknown> | undefined
  const after = evidence?.after as Record<string, unknown> | undefined
  const lod = Array.isArray(after?.lod) ? after.lod.map(String) : []
  const color = Array.isArray(after?.color) ? after.color.map(String) : []
  return (
    before?.density === 0.38 &&
    before?.maxParticles === 24 &&
    color[0] === '#44ccff' &&
    color[1] === '#22d3ee' &&
    after?.style === 'neon' &&
    after?.scale === 1.35 &&
    after?.density === 1 &&
    after?.timing === 1.4 &&
    after?.lifetime === 2.25 &&
    after?.velocity === 1.15 &&
    after?.gravity === -0.35 &&
    after?.turbulence === 0.65 &&
    after?.spawnShape === 'ring' &&
    after?.texture === 'ring' &&
    after?.flipbook === 'magic-12' &&
    after?.blendMode === 'screen' &&
    after?.emissiveBloom === 1.1 &&
    after?.trailLength === 1.7 &&
    after?.seed === 4242 &&
    lod.join(',') === 'low,medium' &&
    after?.maxParticles === 46
  )
}

export function createPfxTaxonomyReviewEvidence(
  reviewTemplate?: PfxTaxonomyReviewTemplate,
): PfxTaxonomyReviewEvidenceSummary {
  const reviewEffectIds = reviewTemplate?.reviews.map((review) => review.effectId) ?? []
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const duplicateReviewEffectIds = duplicateValues(reviewEffectIds)
  const unknownReviewEffectIds = reviewEffectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  const reviewsByEffectId = new Map((reviewTemplate?.reviews ?? []).map((review) => [review.effectId, review]))
  const effects = PFX_TAXONOMY.map((effect) => {
    const review = reviewsByEffectId.get(effect.id)
    const blockers = taxonomyReviewBlockers(effect.id, review)
    return {
      effectId: effect.id,
      rank: effect.rank,
      marketReviewed: blockers.length === 0,
      blockers,
    }
  })
  const marketReviewedEffects = effects.filter((effect) => effect.marketReviewed).length
  const pendingEffects = effects.length - marketReviewedEffects
  const blockedEffects = effects.filter((effect) => effect.blockers.some((blocker) => blocker !== 'missing review')).length
  const blockingFindings = [
    ...createTaxonomyManifestFindings(duplicateReviewEffectIds, unknownReviewEffectIds),
    ...(pendingEffects > 0 ? [`${pendingEffects} effects lack market-reviewed taxonomy approval`] : []),
  ]

  return {
    schema: 'game-bot.r3f-pfx-taxonomy-review-evidence.v1',
    passed: blockingFindings.length === 0,
    summary: {
      totalEffects: effects.length,
      marketReviewedEffects,
      pendingEffects,
      blockedEffects,
    },
    blockingFindings,
    effects,
  }
}

export function createBrowserProfileReport(input: BrowserProfileInput): BrowserProfileReport {
  const frame = summarizeFrameSamples(input.frameSamplesMs)
  const canvasPixels = Math.max(1, Math.round(input.canvas.width * input.canvas.height))
  const nonBackgroundPixels = Math.max(0, Math.round(input.canvas.nonBackgroundPixels))
  const nonBackgroundRatio = round(nonBackgroundPixels / canvasPixels, 3)
  const failures: string[] = []

  // Coverage caps are scenario-aware: a single effect must stay compact, while
  // a stress scene deliberately overlaps many glowing effects across the
  // canvas. Frame time remains the hard perf gate for both.
  const nonBackgroundRatioCap = input.scenario.mode === 'stress' ? 0.6 : 0.35
  if (frame.p95FrameMs > 16.7) failures.push('p95 frame time exceeds 16.7ms')
  if (nonBackgroundRatio > nonBackgroundRatioCap) {
    failures.push(`non-background canvas ratio exceeds ${nonBackgroundRatioCap}`)
  }
  if (input.scenario.totalDrawCalls > 64) failures.push('draw calls exceed mobile low-tier target')
  if (input.scenario.totalParticles > 1536) failures.push('particle count exceeds mobile low-tier target')

  return {
    schema: 'game-bot.r3f-pfx-browser-profile.v1',
    capturedAt: input.capturedAt,
    url: input.url,
    userAgent: input.userAgent,
    capture: input.capture ?? createLocalPlaywrightCapture(),
    runtimePolicy: input.runtimePolicy ?? cloneMobileRuntimePolicy(),
    device: input.device ?? createUnknownBrowserDeviceProfile(),
    viewport: input.viewport,
    scenario: input.scenario,
    frame,
    overdraw: {
      canvasPixels,
      nonBackgroundPixels,
      nonBackgroundRatio,
      measurementSource: input.canvas.measurementSource ?? 'browser-estimate',
    },
    webgl: input.webgl ?? createUnavailableWebglProfile('not captured by caller'),
    thresholds: {
      mobileLowTier: {
        pass: failures.length === 0,
        failures,
      },
    },
  }
}

function cloneMobileRuntimePolicy(): PfxMobileRuntimePolicy {
  return {
    ...PFX_MOBILE_RUNTIME_POLICY,
    canvasDprRange: [...PFX_MOBILE_RUNTIME_POLICY.canvasDprRange],
    webgl: { ...PFX_MOBILE_RUNTIME_POLICY.webgl },
    tierConcurrencyCaps: { ...PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps },
    requiredOptimizations: [...PFX_MOBILE_RUNTIME_POLICY.requiredOptimizations],
  }
}

export function createUnavailableWebglProfile(note: string): WebglProfile {
  return {
    context: 'unavailable',
    vendor: 'unavailable',
    renderer: 'unavailable',
    version: 'unavailable',
    shadingLanguageVersion: 'unavailable',
    timerQueryExtension: 'unavailable',
    gpuTimerStatus: 'unsupported',
    gpuTimerMs: null,
    notes: [note],
  }
}

function createLocalPlaywrightCapture(): BrowserProfileCapture {
  return {
    deviceClass: 'local-playwright',
    platform: 'local-chromium',
    deviceLabel: 'Local Playwright Chromium',
    runner: 'kits/juice/r3f-pfx-browser/scripts/profile-browser.ts',
    notes: ['Local profiling evidence; not accepted as real mobile Safari or Chrome Android approval evidence.'],
  }
}

function createUnknownBrowserDeviceProfile(): BrowserDeviceProfile {
  return {
    maxTouchPoints: 0,
    pointerCoarse: false,
    hoverNone: false,
  }
}

export function profileCanvasFromScreenshot(input: CanvasScreenshotProfileInput): BrowserProfileInput['canvas'] {
  return {
    width: Math.max(1, Math.round(input.screenshotWidth)),
    height: Math.max(1, Math.round(input.screenshotHeight)),
    nonBackgroundPixels: Math.max(0, Math.round(input.nonBackgroundPixels)),
    measurementSource: 'screenshot-readback',
  }
}

export function countPfxDeltaPixels(
  effectPixels: Uint8Array,
  baselinePixels: Uint8Array,
  width: number,
  height: number,
): number {
  const expectedLength = width * height * 4
  if (effectPixels.length !== expectedLength || baselinePixels.length !== expectedLength) {
    throw new Error('PFX delta pixel buffers must match the declared canvas dimensions')
  }
  let changed = 0
  for (let index = 0; index < expectedLength; index += 4) {
    const redDelta = Math.abs(effectPixels[index]! - baselinePixels[index]!)
    const greenDelta = Math.abs(effectPixels[index + 1]! - baselinePixels[index + 1]!)
    const blueDelta = Math.abs(effectPixels[index + 2]! - baselinePixels[index + 2]!)
    if (Math.max(redDelta, greenDelta, blueDelta) > 12) changed += 1
  }
  return changed
}

function collectSuiteCoverage({
  suiteLabel,
  expectedScenarios,
  reports,
  failures,
  thresholdFailures,
}: {
  suiteLabel: PfxMeasuredProfileThresholdFailure['suite']
  expectedScenarios: ProfileScenarioDefinition[]
  reports: BrowserProfileReport[]
  failures: string[]
  thresholdFailures: PfxMeasuredProfileThresholdFailure[]
}): {
  missingScenarioIds: string[]
  unexpectedScenarioIds: string[]
  duplicateScenarioIds: string[]
} {
  const expectedIds = expectedScenarios.map((scenario) => scenario.id)
  const reportIds = reports.map((report) => report.scenario.id)
  const expected = new Set(expectedIds)
  const seen = new Set<string>()
  const duplicateScenarioIds = unique(reportIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false))))
  const missingScenarioIds = expectedIds.filter((id) => !reportIds.includes(id))
  const unexpectedScenarioIds = reportIds.filter((id) => !expected.has(id))

  for (const scenarioId of missingScenarioIds) failures.push(`missing ${suiteLabel} report: ${scenarioId}`)
  for (const scenarioId of unexpectedScenarioIds) failures.push(`unexpected ${suiteLabel} report: ${scenarioId}`)
  for (const scenarioId of duplicateScenarioIds) failures.push(`duplicate ${suiteLabel} report: ${scenarioId}`)
  collectThresholdFailures(suiteLabel, reports, failures, thresholdFailures)

  return {
    missingScenarioIds,
    unexpectedScenarioIds,
    duplicateScenarioIds,
  }
}

function collectThresholdFailures(
  suite: PfxMeasuredProfileThresholdFailure['suite'],
  reports: BrowserProfileReport[],
  failures: string[],
  thresholdFailures: PfxMeasuredProfileThresholdFailure[],
): void {
  for (const report of reports) {
    const reportFailures = Object.entries(report.thresholds).flatMap(([name, threshold]) => {
      if (threshold.pass) return threshold.failures
      return threshold.failures.length > 0 ? threshold.failures : [`${name} threshold marked failed without failure details`]
    })
    if (reportFailures.length === 0) continue
    thresholdFailures.push({
      suite,
      scenarioId: report.scenario.id,
      failures: reportFailures,
    })
    failures.push(`threshold failure in ${suite} report: ${report.scenario.id} (${reportFailures.join(', ')})`)
  }
}

function reportThresholdPassed(report: BrowserProfileReport): boolean {
  return Object.values(report.thresholds).every((threshold) => threshold.pass)
}

function profileReportMetricSnapshot(report: BrowserProfileReport | undefined): {
  p95FrameMs: number
  overdrawRatio: number
  drawCalls: number
  particles: number
} {
  return {
    p95FrameMs: round(report?.frame.p95FrameMs ?? 0),
    overdrawRatio: round(report?.overdraw.nonBackgroundRatio ?? 0),
    drawCalls: report?.scenario.totalDrawCalls ?? 0,
    particles: report?.scenario.totalParticles ?? 0,
  }
}

function missingScenarioIds(expectedScenarios: ProfileScenarioDefinition[], reports: BrowserProfileReport[]): string[] {
  const reportIds = new Set(reports.map((report) => report.scenario.id))
  return expectedScenarios.map((scenario) => scenario.id).filter((id) => !reportIds.has(id))
}

function effectIdsForReports(expectedScenarios: ProfileScenarioDefinition[], reports: BrowserProfileReport[]): string[] {
  const scenariosById = new Map(expectedScenarios.map((scenario) => [scenario.id, scenario]))
  return reports.flatMap((report) => {
    const scenario = scenariosById.get(report.scenario.id)
    if (!scenario) return []
    return scenario.effectIds ?? [scenario.search]
  })
}

function maxReportMetric(reports: BrowserProfileReport[], select: (report: BrowserProfileReport) => number): number {
  if (reports.length === 0) return 0
  return round(Math.max(...reports.map(select)))
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function createTaxonomyManifestFindings(duplicates: string[], unknowns: string[]): string[] {
  return [
    ...(duplicates.length > 0
      ? [`taxonomy review manifest has duplicate effect rows: ${duplicates.join(', ')}`]
      : []),
    ...(unknowns.length > 0 ? [`taxonomy review manifest has unknown effect rows: ${unknowns.join(', ')}`] : []),
  ]
}

function manifestRowsHaveInvalidEffectIds(rows: unknown[]): boolean {
  const effectIds = rows.flatMap((row) => (isRecord(row) && typeof row.effectId === 'string' ? [row.effectId] : []))
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  return duplicateValues(effectIds).length > 0 || effectIds.some((effectId) => !acceptedEffectIds.has(effectId))
}

function taxonomyReviewBlockers(effectId: string, review: PfxTaxonomyEffectReview | undefined): string[] {
  if (!review) return ['missing review']

  const blockers: string[] = []
  if (review.status !== 'market-reviewed') blockers.push(`status is ${review.status}`)
  if (!isFinalReviewString(review.reviewer) || !isIsoTimestamp(review.reviewedAt)) {
    blockers.push('reviewer metadata is not final')
  }
  if (!hasSubstantiveTaxonomyReviewNotes(review.notes)) {
    blockers.push('taxonomy review notes are not substantive')
  }
  if (!allRequiredManifestCriteriaPass(review.criteria, PFX_TAXONOMY_REVIEW_CRITERIA)) {
    blockers.push('not all taxonomy review criteria pass')
  }
  if (!manifestBlockersResolved(review.blockerFindings)) blockers.push('taxonomy blockers are unresolved')
  if (!marketSourcesAreFinal(review.marketSources)) blockers.push('market source links are missing')
  if (review.effectId !== effectId) blockers.push('review effect id mismatch')
  return blockers
}

function marketSourcesAreFinal(marketSources: unknown): boolean {
  return (
    Array.isArray(marketSources) &&
    marketSources.length > 0 &&
    marketSources.every((source) => isFinalReviewString(source) && /^https?:\/\/\S+$/i.test(source))
  )
}

const TAXONOMY_REVIEW_NOTE_TERMS = [
  'source-observed',
  'rank',
  'family',
  'variant',
  'production-critical',
  'duplicate',
  'market-source',
  'market source',
]

function hasSubstantiveTaxonomyReviewNotes(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!isFinalReviewString(value)) return false
  const normalized = value.trim().toLowerCase()
  return normalized.length >= 64 && TAXONOMY_REVIEW_NOTE_TERMS.filter((term) => normalized.includes(term)).length >= 3
}

function sanitizeProfileArtifactName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizePfxProductionApproval(input: unknown, index: number): PfxProductionApproval {
  if (!isRecord(input)) {
    throw new Error(`Production approval at index ${index} must be an object.`)
  }

  const decision = readRequiredString(input, 'decision', index)
  if (decision !== 'production-ready' && decision !== 'approved-deferral') {
    throw new Error(`Production approval at index ${index} has unsupported decision: ${decision}`)
  }

  const evidence = input.evidence
  if (!Array.isArray(evidence) || evidence.some((entry) => typeof entry !== 'string')) {
    throw new Error(`Production approval at index ${index} must include a string evidence array.`)
  }

  return {
    effectId: readRequiredString(input, 'effectId', index),
    decision,
    approvedBy: readRequiredString(input, 'approvedBy', index),
    approvedAt: readRequiredIsoTimestamp(input, 'approvedAt', index),
    rationale: readRequiredProductionApprovalRationale(input, index),
    evidence,
  }
}

function readRequiredString(input: Record<string, unknown>, key: string, index: number): string {
  const value = input[key]
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().toLowerCase().startsWith('todo:')) {
    throw new Error(`Production approval at index ${index} must include final ${key}.`)
  }
  return value
}

function readRequiredIsoTimestamp(input: Record<string, unknown>, key: string, index: number): string {
  const value = readRequiredString(input, key, index)
  if (!isIsoTimestamp(value)) {
    throw new Error(`Production approval at index ${index} must include ISO ${key}.`)
  }
  return value
}

function readRequiredProductionApprovalRationale(input: Record<string, unknown>, index: number): string {
  const value = readRequiredString(input, 'rationale', index)
  if (isRubberStampedProductionApprovalRationale(value)) {
    throw new Error(`Production approval at index ${index} must include final rationale.`)
  }
  return value
}

function isRubberStampedProductionApprovalRationale(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[.!]+$/g, '')
  return [
    'approved',
    'approval granted',
    'good',
    'looks good',
    'looks good to me',
    'lgtm',
    'ok',
    'okay',
    'pass',
    'passed',
    'ship it',
  ].includes(normalized)
}

function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
}

interface ProfileEvidencePlatform {
  kind: 'mobile-safari-profile' | 'chrome-android-profile'
  label: 'mobile Safari' | 'Chrome Android'
}

function profileEvidencePlatform(evidence: string): ProfileEvidencePlatform | null {
  const kind = evidenceKind(evidence)
  if (kind === 'mobile-safari-profile') return { kind, label: 'mobile Safari' }
  if (kind === 'chrome-android-profile') return { kind, label: 'Chrome Android' }
  return null
}

function normalizeProfileEvidenceFile(input: unknown): BrowserProfileReport[] {
  if (isRecord(input) && Array.isArray(input.reports)) {
    if (input.schema !== 'game-bot.r3f-pfx-browser-profile-run.v1') {
      throw new Error('expected a browser profile report or canonical profile run with reports')
    }
    return normalizeBrowserProfileReports(input as BrowserProfileReport[] | { reports: BrowserProfileReport[] })
  }
  if (isRecord(input) && input.schema === 'game-bot.r3f-pfx-browser-profile.v1') {
    return [input as unknown as BrowserProfileReport]
  }
  throw new Error('expected a browser profile report or canonical profile run with reports')
}

function profileReportMatchesApproval(
  report: BrowserProfileReport,
  effectId: string,
  platform: ProfileEvidencePlatform,
): boolean {
  return profileReportApprovalFindings(report, effectId, platform).length === 0
}

function profileReportApprovalFindings(
  report: BrowserProfileReport,
  effectId: string,
  platform: ProfileEvidencePlatform,
): string[] {
  const findings: string[] = []
  const record: Partial<BrowserProfileReport> & Record<string, unknown> = isRecord(report)
    ? (report as Partial<BrowserProfileReport> & Record<string, unknown>)
    : {}
  const scenario = isRecord(record.scenario) ? record.scenario : null
  const viewport = isRecord(record.viewport) ? record.viewport : null
  const webgl = isRecord(record.webgl) ? record.webgl : null
  const overdraw = isRecord(record.overdraw) ? record.overdraw : null
  const sustained = isRecord(record.sustained) ? record.sustained : null
  const thresholds = isRecord(record.thresholds) ? Object.values(record.thresholds) : []
  const expectedConcurrency = canonicalConcurrencyForEffect(effectId)

  if (record.schema !== 'game-bot.r3f-pfx-browser-profile.v1') {
    findings.push('schema must be game-bot.r3f-pfx-browser-profile.v1')
  }
  if (!isIsoTimestamp(record.capturedAt)) {
    findings.push('capturedAt must be a canonical ISO timestamp')
  }
  if (!scenario || typeof scenario.id !== 'string' || !profileScenarioIdMatchesEffect(scenario.id, effectId)) {
    findings.push(`scenario.id must target ${effectId}`)
  }
  if (!scenario || scenario.mode !== 'stress' || scenario.effectCount !== expectedConcurrency) {
    findings.push(
      `scenario must repeat one effect identity at canonical concurrency ${expectedConcurrency} with scenario.mode "stress" and effectCount ${expectedConcurrency}`,
    )
  }
  if (typeof record.url !== 'string' || !profileUrlMatchesCaptureIntent(record.url, effectId, platform)) {
    findings.push(
      `url must include exactly profileEffectIds=${effectId}, profilePlatform=${expectedCapturePlatform(platform)}, and profileConcurrency=${expectedConcurrency}`,
    )
  }
  if (typeof record.url === 'string' && !profileUrlUsesNetworkReachableHost(record.url)) {
    findings.push('url host must be network-reachable, not localhost, 0.0.0.0, or loopback')
  }
  if (!captureMatchesPlatform(record.capture as BrowserProfileCapture | undefined, platform)) {
    findings.push(`capture must be real-device ${expectedCapturePlatform(platform)} from manual-real-device-browser`)
  }
  if (!captureHasConcreteDeviceLabel(record.capture as BrowserProfileCapture | undefined)) {
    findings.push('capture.deviceLabel must identify the concrete real device used for profiling')
  }
  if (!runtimePolicyMatchesMobileContract(record.runtimePolicy as BrowserProfileReport['runtimePolicy'] | undefined)) {
    findings.push('runtimePolicy must exactly match PFX_MOBILE_RUNTIME_POLICY')
  }
  if (!deviceMatchesRealTouchHardware(record.device as BrowserProfileReport['device'] | undefined)) {
    findings.push('device must prove real touch hardware: maxTouchPoints > 0, pointerCoarse true, hoverNone true')
  }
  if (!viewport || viewport.isMobile !== true) {
    findings.push('viewport.isMobile must be true')
  }
  if (!webgl || (webgl.context !== 'webgl' && webgl.context !== 'webgl2')) {
    findings.push('webgl.context must be webgl or webgl2')
  }
  if (!overdraw || overdraw.measurementSource !== 'screenshot-readback') {
    findings.push('overdraw.measurementSource must be screenshot-readback')
  }
  if (!sustainedDeviceTelemetryPasses(sustained)) {
    findings.push(
      'sustained telemetry must measure at least 180 seconds with memory, CPU/GPU, hitch, shader-stall, and thermal suitability evidence',
    )
  }

  const thresholdFailures = thresholds.flatMap((threshold) => {
    if (!isRecord(threshold)) return ['threshold entry is malformed']
    if (threshold.pass) return []
    if (!Array.isArray(threshold.failures) || threshold.failures.length === 0) {
      return ['threshold marked failed without failure details']
    }
    const stringFailures = threshold.failures.filter((failure): failure is string => typeof failure === 'string')
    return stringFailures.length > 0 ? stringFailures : ['threshold marked failed without string failure details']
  })
  if (thresholds.length === 0) thresholdFailures.push('thresholds are missing')
  if (thresholdFailures.length > 0) {
    findings.push(`thresholds must all pass: ${thresholdFailures.join('; ')}`)
  }
  if (typeof record.userAgent !== 'string' || !userAgentMatchesPlatform(record.userAgent, platform)) {
    findings.push(
      platform.kind === 'mobile-safari-profile'
        ? 'userAgent must be Mobile Safari on iPhone or iPad hardware'
        : 'userAgent must be Chrome Android on Android hardware',
    )
  }
  return findings
}

function profileUrlMatchesCaptureIntent(url: string, effectId: string, platform: ProfileEvidencePlatform): boolean {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return false
  }
  const profileEffectIds = parsedUrl.searchParams
    .get('profileEffectIds')
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const profilePlatform = parsedUrl.searchParams.get('profilePlatform')
  const profileConcurrency = parsedUrl.searchParams.get('profileConcurrency')
  const expectedConcurrency = canonicalConcurrencyForEffect(effectId)
  const expectedPlatform = platform.kind === 'mobile-safari-profile' ? 'mobile-safari' : 'chrome-android'
  const queryKeys = [...parsedUrl.searchParams.keys()]
  const allowedKeys = ['profileEffectIds', 'profilePlatform', 'profileConcurrency', 'profileBatchId']
  const queryKeyCounts = new Map<string, number>()
  for (const key of queryKeys) queryKeyCounts.set(key, (queryKeyCounts.get(key) ?? 0) + 1)
  return (
    queryKeys.length >= 3 &&
    queryKeys.every((key) => allowedKeys.includes(key)) &&
    queryKeyCounts.get('profileEffectIds') === 1 &&
    queryKeyCounts.get('profilePlatform') === 1 &&
    queryKeyCounts.get('profileConcurrency') === 1 &&
    (queryKeyCounts.get('profileBatchId') ?? 0) <= 1 &&
    profileEffectIds?.length === 1 &&
    profileEffectIds[0] === effectId &&
    profilePlatform === expectedPlatform &&
    profileConcurrency === String(expectedConcurrency)
  )
}

function canonicalConcurrencyForEffect(effectId: string): number {
  return PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[canonicalPerformanceTierForEffect(effectId)]
}

function canonicalPerformanceTierForEffect(effectId: string): PerformanceTier {
  const item = filterPfxCatalog({}).find((candidate) => candidate.effect.id === effectId)
  if (!item) throw new Error(`Missing performance tier for real-device capture effect ${effectId}`)
  return item.preset.performance.tier
}

export function sustainedDeviceTelemetryPasses(telemetry: unknown): boolean {
  if (typeof telemetry !== 'object' || telemetry == null || Array.isArray(telemetry)) return false
  const record = telemetry as Record<string, unknown>
  if (record.measurementSource !== 'external-device-profiler') return false
  const finite = (key: string): boolean => Number.isFinite(record[key])
  return finite('durationSeconds') && Number(record.durationSeconds) >= 180 &&
    finite('memoryStartMb') && Number(record.memoryStartMb) >= 0 &&
    finite('memoryEndMb') && Number(record.memoryEndMb) >= 0 &&
    finite('memoryGrowthMb') && Number(record.memoryGrowthMb) <= 1 &&
    finite('cpuMainThreadP95Ms') && Number(record.cpuMainThreadP95Ms) >= 0 &&
    finite('gpuP95Ms') && Number(record.gpuP95Ms) >= 0 &&
    record.materialFrameHitches === 0 &&
    record.shaderCompilationStalls === 0 &&
    record.thermalStatus === 'nominal' &&
    finite('frameTimeDegradationPercent') && Number(record.frameTimeDegradationPercent) <= 10
}

function profileUrlUsesNetworkReachableHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return !(
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname.startsWith('127.')
    )
  } catch {
    return true
  }
}

function deviceMatchesRealTouchHardware(device: BrowserProfileReport['device'] | undefined): boolean {
  return Boolean(device && device.maxTouchPoints > 0 && device.pointerCoarse && device.hoverNone)
}

function runtimePolicyMatchesMobileContract(policy: BrowserProfileReport['runtimePolicy'] | undefined): boolean {
  return JSON.stringify(policy) === JSON.stringify(PFX_MOBILE_RUNTIME_POLICY)
}

function captureMatchesPlatform(capture: BrowserProfileCapture | undefined, platform: ProfileEvidencePlatform): boolean {
  return (
    capture?.deviceClass === 'real-device' &&
    capture.runner === 'manual-real-device-browser' &&
    ((platform.kind === 'mobile-safari-profile' && capture.platform === 'mobile-safari') ||
      (platform.kind === 'chrome-android-profile' && capture.platform === 'chrome-android'))
  )
}

function captureHasConcreteDeviceLabel(capture: BrowserProfileCapture | undefined): boolean {
  const label = capture?.deviceLabel?.trim().toLowerCase()
  return Boolean(
    label &&
      label !== 'unspecified real device' &&
      label !== 'unknown device' &&
      label !== 'unknown' &&
      label !== '{profiledevicelabel}' &&
      label !== 'profiledevicelabel' &&
      label !== 'replace_with_device_label' &&
      !label.includes('profiledevicelabel'),
  )
}

function expectedCapturePlatform(platform: ProfileEvidencePlatform): RealDeviceProfileCapturePlatform {
  return platform.kind === 'mobile-safari-profile' ? 'mobile-safari' : 'chrome-android'
}

function userAgentMatchesPlatform(userAgent: string, platform: ProfileEvidencePlatform): boolean {
  if (platform.kind === 'mobile-safari-profile') {
    return isMobileSafariRealDeviceUserAgent(userAgent)
  }
  return isChromeAndroidRealDeviceUserAgent(userAgent)
}

function profileScenarioIdMatchesEffect(scenarioId: string, effectId: string): boolean {
  const canonicalConcurrency = canonicalConcurrencyForEffect(effectId)
  return [
    `authored-${effectId}-single`,
    `catalog-${effectId}-single`,
    `profile-backed-${effectId}-single`,
    `mobile-${effectId}-single`,
    `mobile-${effectId}-canonical-${canonicalConcurrency}`,
  ].includes(scenarioId)
}

function redTeamTextSignsOffEffect(text: string, effectId: string): boolean {
  const review = redTeamReviewForEffect(text, effectId)
  if (review) return redTeamReviewSignsOff(review)
  return false
}

function productionImplementationTextSupportsEffect(text: string, effectId: string): boolean {
  const implementation = productionImplementationForEffect(text, effectId)
  if (implementation) return productionImplementationIsReady(implementation, effectId)
  return false
}

function productionImplementationManifestIntegrityFinding(text: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (
    !isRecord(parsed) ||
    parsed.schema !== 'game-bot.r3f-pfx-production-implementation.v1' ||
    !Array.isArray(parsed.implementations)
  ) {
    return null
  }

  const effectIds = parsed.implementations.flatMap((implementation) =>
    isRecord(implementation) && typeof implementation.effectId === 'string' ? [implementation.effectId] : [],
  )
  if (effectIds.length !== parsed.implementations.length) return 'manifest has malformed effect rows'

  const duplicateEffectIds = duplicateValues(effectIds)
  if (duplicateEffectIds.length > 0) return `manifest has duplicate effect rows: ${duplicateEffectIds.join(', ')}`

  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const unknownEffectIds = effectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  if (unknownEffectIds.length > 0) return `manifest has unknown effect rows: ${unknownEffectIds.join(', ')}`

  return null
}

function taxonomyReviewTextSupportsEffect(text: string, effectId: string): boolean {
  const review = taxonomyReviewForEffect(text, effectId)
  if (review) return taxonomyReviewBlockers(effectId, review as never).length === 0
  return false
}

function taxonomyReviewManifestIntegrityFinding(text: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.schema !== 'game-bot.r3f-pfx-taxonomy-review.v1' || !Array.isArray(parsed.reviews)) {
    return null
  }

  const effectIds = parsed.reviews.flatMap((review) =>
    isRecord(review) && typeof review.effectId === 'string' ? [review.effectId] : [],
  )
  if (effectIds.length !== parsed.reviews.length) return 'manifest has malformed effect rows'

  const duplicateEffectIds = duplicateValues(effectIds)
  if (duplicateEffectIds.length > 0) return `manifest has duplicate effect rows: ${duplicateEffectIds.join(', ')}`

  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const unknownEffectIds = effectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  if (unknownEffectIds.length > 0) return `manifest has unknown effect rows: ${unknownEffectIds.join(', ')}`

  const reviewEffectIds = new Set(effectIds)
  const missingEffectIds = PFX_TAXONOMY.map((effect) => effect.id).filter((effectId) => !reviewEffectIds.has(effectId))
  if (missingEffectIds.length > 0) return `manifest is missing effect rows: ${formatEffectIdList(missingEffectIds)}`

  return null
}

function taxonomyReviewForEffect(text: string, effectId: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.schema !== 'game-bot.r3f-pfx-taxonomy-review.v1' || !Array.isArray(parsed.reviews)) {
    return null
  }
  if (manifestRowsHaveInvalidEffectIds(parsed.reviews)) return null
  return parsed.reviews.find((review) => isRecord(review) && review.effectId === effectId) ?? null
}

function productionImplementationForEffect(text: string, effectId: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (
    !isRecord(parsed) ||
    parsed.schema !== 'game-bot.r3f-pfx-production-implementation.v1' ||
    !Array.isArray(parsed.implementations)
  ) {
    return null
  }
  if (manifestRowsHaveInvalidEffectIds(parsed.implementations)) return null
  return parsed.implementations.find((implementation) => isRecord(implementation) && implementation.effectId === effectId) ?? null
}

function isStructuredProductionImplementationManifest(text: string): boolean {
  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) && parsed.schema === 'game-bot.r3f-pfx-production-implementation.v1'
  } catch {
    return false
  }
}

function productionImplementationIsReady(implementation: Record<string, unknown>, effectId: string): boolean {
  return (
    implementation.status === 'production-ready' &&
    hasFinalImplementationMetadata(implementation) &&
    implementation.sourcePath === productionImplementationSourcePathForEffect(effectId) &&
    hasSubstantiveProductionImplementationNotes(implementation.notes) &&
    allRequiredManifestCriteriaPass(implementation.criteria, PFX_PRODUCTION_IMPLEMENTATION_CRITERIA) &&
    manifestBlockersResolved(implementation.blockerFindings)
  )
}

function productionImplementationSourcePathForEffect(effectId: string): string {
  return `modules/juice/r3f-pfx-library/src/index.tsx#${effectId}`
}

function hasFinalImplementationMetadata(implementation: Record<string, unknown>): boolean {
  return (
    isFinalReviewString(implementation.implementedBy) &&
    isIsoTimestamp(implementation.implementedAt) &&
    isFinalReviewString(implementation.sourcePath) &&
    isFinalReviewString(implementation.notes)
  )
}

const PRODUCTION_IMPLEMENTATION_NOTE_TERMS = [
  'component',
  'control',
  'customization',
  'documentation',
  'export',
  'implementation',
  'mobile',
  'preset',
  'preview',
  'r3f',
  'recipe',
]

function hasSubstantiveProductionImplementationNotes(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!isFinalReviewString(value)) return false
  const normalized = value.trim().toLowerCase()
  return normalized.length >= 48 && PRODUCTION_IMPLEMENTATION_NOTE_TERMS.some((term) => normalized.includes(term))
}

function textRecordsApprovedDeferral(text: string, effectId: string): boolean {
  const review = redTeamReviewForEffect(text, effectId)
  if (review) return redTeamReviewApprovesDeferral(review)
  return false
}

function redTeamReviewManifestIntegrityFinding(text: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.schema !== 'game-bot.r3f-pfx-red-team-review.v1' || !Array.isArray(parsed.reviews)) {
    return null
  }

  const effectIds = parsed.reviews.flatMap((review) =>
    isRecord(review) && typeof review.effectId === 'string' ? [review.effectId] : [],
  )
  if (effectIds.length !== parsed.reviews.length) return 'manifest has malformed effect rows'

  const duplicateEffectIds = duplicateValues(effectIds)
  if (duplicateEffectIds.length > 0) return `manifest has duplicate effect rows: ${duplicateEffectIds.join(', ')}`

  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const unknownEffectIds = effectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  if (unknownEffectIds.length > 0) return `manifest has unknown effect rows: ${unknownEffectIds.join(', ')}`

  return null
}

function redTeamReviewForEffect(text: string, effectId: string): Record<string, unknown> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.schema !== 'game-bot.r3f-pfx-red-team-review.v1' || !Array.isArray(parsed.reviews)) {
    return null
  }
  if (manifestRowsHaveInvalidEffectIds(parsed.reviews)) return null
  return parsed.reviews.find((review) => isRecord(review) && review.effectId === effectId) ?? null
}

function redTeamReviewSignsOff(review: Record<string, unknown>): boolean {
  return (
    review.status === 'signed-off' &&
    hasFinalReviewMetadata(review) &&
    hasSubstantiveRedTeamReviewNotes(review.notes) &&
    allRequiredManifestCriteriaPass(review.criteria, PFX_RED_TEAM_CRITERIA) &&
    manifestBlockersResolved(review.blockerFindings)
  )
}

function redTeamReviewApprovesDeferral(review: Record<string, unknown>): boolean {
  return (
    review.status === 'approved-deferral' &&
    hasFinalReviewMetadata(review) &&
    hasSubstantiveRedTeamReviewNotes(review.notes) &&
    allRequiredManifestCriteriaPass(review.criteria, PFX_RED_TEAM_CRITERIA) &&
    manifestBlockersResolved(review.blockerFindings)
  )
}

function hasFinalReviewMetadata(review: Record<string, unknown>): boolean {
  return isFinalReviewString(review.reviewer) && isIsoTimestamp(review.reviewedAt)
}

function isFinalReviewString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && !value.trim().toLowerCase().startsWith('todo:')
}

const RED_TEAM_NOTE_ACTION_TERMS = [
  'accepted',
  'attacked',
  'blocker',
  'checked',
  'deferral',
  'evidence',
  'rejected',
  'resolved',
  'risk',
]

const RED_TEAM_NOTE_DIMENSION_TERMS = [
  'control',
  'customization',
  'documentation',
  'game-ready',
  'game readiness',
  'implementation',
  'export',
  'mobile',
  'performance',
  'real-device',
  'style',
  'taxonomy',
]

function hasSubstantiveRedTeamReviewNotes(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!isFinalReviewString(value)) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized.length >= 48 &&
    RED_TEAM_NOTE_ACTION_TERMS.some((term) => normalized.includes(term)) &&
    redTeamNoteDimensionCoverage(normalized) >= 4
  )
}

function redTeamNoteDimensionCoverage(normalizedNote: string): number {
  return RED_TEAM_NOTE_DIMENSION_TERMS.filter((term) => normalizedNote.includes(term)).length
}

function allManifestCriteriaPass(criteria: unknown): boolean {
  return (
    isRecord(criteria) &&
    Object.keys(criteria).length > 0 &&
    Object.values(criteria).every((status) => status === 'pass')
  )
}

function allRequiredManifestCriteriaPass(criteria: unknown, requiredCriteria: readonly string[]): boolean {
  if (!allManifestCriteriaPass(criteria)) return false
  const keys = Object.keys(criteria as Record<string, unknown>).sort()
  const required = [...requiredCriteria].sort()
  return keys.length === required.length && keys.every((key, index) => key === required[index])
}

function manifestBlockersResolved(blockerFindings: unknown): boolean {
  return Array.isArray(blockerFindings) && blockerFindings.length === 0
}

function evidenceKind(evidence: string): string {
  const separatorIndex = evidence.indexOf(':')
  return separatorIndex >= 0 ? evidence.slice(0, separatorIndex) : evidence
}

function localEvidenceFilePath(evidence: string): string | null {
  const separatorIndex = evidence.indexOf(':')
  if (separatorIndex < 0) return null
  const reference = evidence.slice(separatorIndex + 1).trim()
  if (!reference || reference.startsWith('http://') || reference.startsWith('https://')) return null
  return reference.split('#')[0] ?? null
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
