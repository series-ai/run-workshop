import { ART_STYLE_CLUSTERS, EFFECT_TYPE_FILTERS, PFX_MARKET_SOURCE_REFERENCES, PFX_PRODUCTION_IMPLEMENTATION_CANDIDATE_PREREQUISITES, PFX_PRODUCTION_IMPLEMENTATION_CRITERIA, PFX_QUALITY_RUBRIC_KEYS, PFX_RED_TEAM_CRITERIA, PFX_TAXONOMY_REVIEW_CRITERIA } from '../constants/01'
import type { PfxImplementationProfile } from './02'

export type ArtStyleCluster = (typeof ART_STYLE_CLUSTERS)[number]

export type EffectType = (typeof EFFECT_TYPE_FILTERS)[number]

export type PerformanceTier = 'low' | 'medium' | 'high' | 'cinematic'

export type LoopMode = 'burst' | 'loop'

export type EffectSpace = 'world' | 'ui'

export type MobileSafety = 'safe' | 'caution' | 'cinematic-only'

export type LodLevel = 'low' | 'medium' | 'high'

export type SpawnShape = 'point' | 'cone' | 'sphere' | 'ring' | 'box' | 'line' | 'mesh'

export type BlendMode = 'additive' | 'alpha' | 'multiply' | 'screen'

export type PfxAcceptanceStatus = 'authored-preview' | 'profile-backed' | 'implemented' | 'deferred'

export type PfxTextureKind = 'soft-disc' | 'spark' | 'streak' | 'ring' | 'square' | 'bubble'

export type PfxMarketSourceFamily = keyof typeof PFX_MARKET_SOURCE_REFERENCES

export interface PfxTextureAtlasSlice {
  atlasId: string
  kind: PfxTextureKind
  uvOffset: [number, number]
  uvScale: [number, number]
  pixelRect: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface PfxTextureAtlasDescriptor {
  id: string
  tileSize: number
  columns: number
  rows: number
  width: number
  height: number
  slices: Record<PfxTextureKind, PfxTextureAtlasSlice>
}

export type PfxQualityRubricKey = (typeof PFX_QUALITY_RUBRIC_KEYS)[number]

export type PfxQualityScores = Record<PfxQualityRubricKey, number>

export interface StyleVariantProfile {
  palette: string[]
  texture?: PfxControls['texture']
  blendMode?: BlendMode
  emissiveMultiplier: number
  turbulenceMultiplier: number
  densityMultiplier: number
}

export type PfxStyleSilhouette =
  | 'natural-plume'
  | 'chunky-symbolic'
  | 'speed-line'
  | 'blocky-pixel'
  | 'rounded-soft'
  | 'precision-rings'
  | 'arcane-orbit'
  | 'ragged-shadow'
  | 'targeting-reticle'
  | 'pop-burst'
  | 'faceted-lowpoly'
  | 'brush-stroke'
  | 'tube-glow'
  | 'ink-outline'
  | 'crest-rune'
  | 'elemental-swarm'
  | 'procedural-glyph'

export type PfxStyleMaterialTreatment =
  | 'subtle-alpha'
  | 'bold-cel'
  | 'high-key-streak'
  | 'crisp-indexed'
  | 'warm-screen'
  | 'holographic-add'
  | 'arcane-add'
  | 'shadow-multiply'
  | 'matte-tactical'
  | 'arcade-glow'
  | 'flat-faceted'
  | 'pigment-screen'
  | 'neon-bloom'
  | 'outlined-toon'
  | 'enchanted-gold'
  | 'elemental-glow'
  | 'prismatic-screen'

export type PfxStyleMotionTreatment =
  | 'physical-drift'
  | 'snappy-pop'
  | 'anime-smear'
  | 'stepped-flicker'
  | 'gentle-float'
  | 'scanline-sweep'
  | 'orbital-magic'
  | 'uneasy-crawl'
  | 'tight-pulse'
  | 'bouncy-arcade'
  | 'angular-step'
  | 'brush-wobble'
  | 'electric-pulse'
  | 'squash-pop'
  | 'rune-breathe'
  | 'element-cycle'
  | 'chaos-morph'

export type PfxStyleParticleShape = 'soft' | 'spark' | 'streak' | 'square' | 'bubble' | 'ring'

export interface PfxStyleRenderProfile {
  style: ArtStyleCluster
  silhouette: PfxStyleSilhouette
  materialTreatment: PfxStyleMaterialTreatment
  motionTreatment: PfxStyleMotionTreatment
  particleShape: PfxStyleParticleShape
  geometrySegments: number
  opacityMultiplier: number
  particleSizeMultiplier: number
  motionMultiplier: number
  edgeHardness: number
  signature: string
}

export type PfxBehaviorRole =
  | 'projectile'
  | 'burst'
  | 'impact'
  | 'charge'
  | 'release'
  | 'telegraph'
  | 'beam'
  | 'trail'
  | 'spawn'
  | 'despawn'
  | 'reward'
  | 'loop'
  | 'screen'

export interface PfxTaxonomyEffect {
  id: string
  rank: number
  name: string
  effectType: EffectType
  /** Behavioral review role (behavior-derived, not name-theme-derived). */
  role: PfxBehaviorRole
  gameplayUseCases: string[]
  styleAffinity: ArtStyleCluster[]
  emotionMood: string[]
  colorFamily: string[]
  assetRequirements: string[]
  loopMode: LoopMode
  space: EffectSpace
  mobileSafety: MobileSafety
  acceptanceStatus: PfxAcceptanceStatus
  implementationProfile: PfxImplementationProfile
  marketSourceFamilies: PfxMarketSourceFamily[]
  marketSourceUrls: string[]
  notes: string
}

export interface PfxPerformanceBudget {
  maxParticles: number
  maxDrawCalls: number
  textureMemoryKb: number
  expectedFrameCostMs: number
  overdrawRisk: 'low' | 'medium' | 'high'
}

export interface PfxPerformanceMetadata extends PfxPerformanceBudget {
  tier: PerformanceTier
  evidence: string
}

export interface PfxMobileRuntimePolicy {
  schema: 'game-bot.r3f-pfx-mobile-runtime-policy.v1'
  maxDevicePixelRatio: number
  canvasDprRange: [number, number]
  webgl: {
    antialias: boolean
    alpha: boolean
    powerPreference: 'default' | 'high-performance' | 'low-power'
  }
  tierConcurrencyCaps: Record<PerformanceTier, number>
  requiredOptimizations: string[]
  finalAcceptanceRequiresRealDevices: boolean
}

export interface PfxRuntimeOptimizationAuditEffect {
  effectId: string
  rank: number
  name: string
  safe: boolean
  performanceTier: PerformanceTier
  textureAtlasKind: PfxTextureKind
  atlasBacked: boolean
  sharedTextureBacked: boolean
  sharedGeometryBacked: boolean
  reducedMotionBacked: boolean
  lodBacked: boolean
  deterministicSeed: boolean
  tierConcurrencyCap: number
  failureReasons: string[]
}

export interface PfxRuntimeOptimizationAudit {
  schema: 'game-bot.r3f-pfx-runtime-optimization-audit.v1'
  summary: {
    totalEffects: number
    atlasBackedEffects: number
    sharedTextureEffects: number
    sharedGeometryEffects: number
    reducedMotionEffects: number
    lodBackedEffects: number
    deterministicSeedEffects: number
    effectsPassingOptimizationAudit: number
  }
  instructions: {
    approvalStatus: 'non-approving-mobile-runtime-optimization-evidence'
    runtimePolicyFile: string
    operatorChecklist: string[]
  }
  policy: PfxMobileRuntimePolicy
  effects: PfxRuntimeOptimizationAuditEffect[]
}

export interface PfxQualityScore {
  scores: PfxQualityScores
  total: number
  max: number
  summary: string
  evidence: string[]
}

export interface PfxControls {
  color: string[]
  style: ArtStyleCluster
  scale: number
  density: number
  timing: number
  lifetime: number
  velocity: number
  gravity: number
  turbulence: number
  spawnShape: SpawnShape
  texture: PfxTextureKind
  flipbook: 'none' | 'smoke-8' | 'flame-8' | 'magic-12' | 'impact-6'
  blendMode: BlendMode
  emissiveBloom: number
  trailLength: number
  seed: number
  lod: LodLevel[]
}

export interface PfxPreviewDescriptor {
  thumbnail: {
    kind: 'procedural-gradient'
    css: string
    alt: string
  }
  clip: {
    kind: 'procedural-loop'
    frames: number
    durationMs: number
    motion: 'pulse' | 'rise' | 'burst' | 'orbit' | 'drift' | 'streak'
  }
  camera: {
    position: [number, number, number]
    fov: number
  }
}

export interface PfxPreset {
  id: string
  effectId: string
  name: string
  tags: string[]
  controls: PfxControls
  preview: PfxPreviewDescriptor
  performance: PfxPerformanceMetadata
  quality: PfxQualityScore
  implementationProfile: PfxImplementationProfile
  acceptanceStatus: PfxAcceptanceStatus
  authoredRecipeId?: string
  mobileSafety: MobileSafety
  componentName: string
  seed: number
  textureAtlas: PfxTextureAtlasSlice
  styleRender: PfxStyleRenderProfile
  reducedMotion?: boolean
}

export interface PfxCatalogItem {
  effect: PfxTaxonomyEffect
  preset: PfxPreset
}

export interface PfxPreviewManifestEntry {
  effectId: string
  presetId: string
  rank: number
  name: string
  effectType: EffectType
  gameplayUseCases: string[]
  styleAffinity: ArtStyleCluster[]
  marketSourceFamilies: PfxMarketSourceFamily[]
  marketSourceUrls: string[]
  thumbnail: PfxPreviewDescriptor['thumbnail']
  thumbnailAsset: PfxThumbnailAsset
  clip: PfxPreviewDescriptor['clip']
  clipAsset: PfxClipAsset
  styleContactSheetAsset: PfxContactSheetAsset
  controlExtremesContactSheetAsset: PfxContactSheetAsset
  camera: PfxPreviewDescriptor['camera']
  performance: PfxPerformanceMetadata
  mobileSafety: MobileSafety
  acceptanceStatus: PfxAcceptanceStatus
  authoredRecipeId?: string
  styleRender: PfxStyleRenderProfile
}

export interface PfxComponentDefinition {
  effectId: string
  componentName: string
  importName: string
  rank: number
  acceptanceStatus: PfxAcceptanceStatus
  mobileSafety: MobileSafety
  performanceTier: PerformanceTier
  styleAffinity: ArtStyleCluster[]
}

export interface PfxThumbnailAsset {
  kind: 'svg'
  fileName: string
  mimeType: 'image/svg+xml'
  width: number
  height: number
  svg: string
  dataUri: string
}

export interface PfxClipAsset {
  kind: 'animated-svg'
  fileName: string
  mimeType: 'image/svg+xml'
  width: number
  height: number
  frames: number
  durationMs: number
  svg: string
  dataUri: string
}

export interface PfxContactSheetAsset {
  kind: 'contact-sheet-svg'
  fileName: string
  mimeType: 'image/svg+xml'
  width: number
  height: number
  sheetType: 'style-variants' | 'control-extremes'
  svg: string
  dataUri: string
}

export interface PfxPreviewManifest {
  schema: 'game-bot.r3f-pfx-preview-manifest.v1'
  summary: {
    totalEffects: number
    authoredPreviewEffects: number
    profileBackedEffects: number
    mobileSafeEffects: number
    tiers: Record<PerformanceTier, number>
  }
  effects: PfxPreviewManifestEntry[]
}

export interface PfxPreviewAssetAuditEffect {
  effectId: string
  rank: number
  name: string
  safe: boolean
  thumbnailFileName: string
  clipFileName: string
  styleContactSheetFileName: string
  controlExtremesContactSheetFileName: string
  thumbnailValid: boolean
  clipValid: boolean
  styleContactSheetValid: boolean
  controlExtremesContactSheetValid: boolean
  dataUriValid: boolean
  accessible: boolean
  animated: boolean
  width: number
  height: number
  clipFrames: number
  clipDurationMs: number
  failureReasons: string[]
}

export interface PfxPreviewAssetAudit {
  schema: 'game-bot.r3f-pfx-preview-asset-audit.v1'
  summary: {
    totalEffects: number
    thumbnailAssets: number
    clipAssets: number
    styleContactSheetAssets: number
    controlExtremesContactSheetAssets: number
    animatedClipAssets: number
    accessibleAssets: number
    effectsPassingPreviewAudit: number
  }
  instructions: {
    approvalStatus: 'non-approving-preview-asset-evidence'
    previewManifestFile: string
    operatorChecklist: string[]
  }
  effects: PfxPreviewAssetAuditEffect[]
}

export interface PfxDeveloperDocsEffect {
  effectId: string
  rank: number
  name: string
  componentName: string
  documentationFileName: string
  gameplayUseCases: string[]
  mobileSafety: MobileSafety
  acceptanceStatus: PfxAcceptanceStatus
  productionCaveat: string
  integrationChecklist: string[]
  performanceBudget: PfxPerformanceMetadata
  quality: PfxQualityScore
  componentSnippet: string
  jsonPreset: string
  markdown: string
}

export interface PfxDeveloperDocsManifest {
  schema: 'game-bot.r3f-pfx-developer-docs.v1'
  summary: {
    totalEffects: number
    docsWithComponentSnippet: number
    docsWithJsonPreset: number
    docsWithPerformanceBudget: number
    docsWithProductionCaveat: number
  }
  effects: PfxDeveloperDocsEffect[]
}

export interface PfxExportCleanlinessAuditEffect {
  effectId: string
  rank: number
  name: string
  safe: boolean
  componentName: string
  componentSnippetValid: boolean
  jsonPresetValid: boolean
  docsValid: boolean
  registryEntryValid: boolean
  forbiddenTermsAbsent: boolean
  componentSnippetEvidence: string[]
  jsonPresetEvidence: string[]
  docsEvidence: string[]
  failureReasons: string[]
}

export interface PfxExportCleanlinessAudit {
  schema: 'game-bot.r3f-pfx-export-cleanliness-audit.v1'
  summary: {
    totalEffects: number
    componentSnippetsValid: number
    jsonPresetsValid: number
    docsValid: number
    registryEntriesValid: number
    effectsPassingExportAudit: number
  }
  instructions: {
    approvalStatus: 'non-approving-export-cleanliness-evidence'
    developerDocsFile: string
    operatorChecklist: string[]
  }
  effects: PfxExportCleanlinessAuditEffect[]
}

export type PfxProductionApprovalDecision = 'production-ready' | 'approved-deferral'

export interface PfxProductionApproval {
  effectId: string
  decision: PfxProductionApprovalDecision
  approvedBy: string
  approvedAt: string
  rationale: string
  evidence: string[]
  captureHandoff?: PfxProductionApprovalCaptureHandoff
}

export type PfxTaxonomyReviewCriterion = (typeof PFX_TAXONOMY_REVIEW_CRITERIA)[number]

export type PfxTaxonomyReviewCriterionStatus = 'pending' | 'pass' | 'fail'

export type PfxTaxonomyReviewStatus = 'pending' | 'market-reviewed' | 'blocked'

export interface PfxTaxonomyEffectReview {
  effectId: string
  rank: number
  status: PfxTaxonomyReviewStatus
  reviewer: string
  reviewedAt: string
  marketSources: string[]
  criteria: Record<PfxTaxonomyReviewCriterion, PfxTaxonomyReviewCriterionStatus>
  blockerFindings: string[]
  notes: string
}

export interface PfxTaxonomyReviewTemplate {
  schema: 'game-bot.r3f-pfx-taxonomy-review.v1'
  approvalStatus: 'pending-taxonomy-review' | 'source-derived-taxonomy-evidence'
  summary: {
    totalEffects: number
    marketReviewedEffects: number
    marketReviewScope: 'pending-human-review' | 'source-traceability-evidence-only'
    pendingEffects: number
    requiredCriteria: PfxTaxonomyReviewCriterion[]
  }
  instructions: {
    dossierFile: string
    completionCommand: string
    operatorChecklist: string[]
  }
  reviews: PfxTaxonomyEffectReview[]
}

export type PfxTaxonomyReviewRankBand = 'top-25-production-staple' | 'generated-coverage-target'

export interface PfxTaxonomyReviewDossierEffect {
  effectId: string
  rank: number
  name: string
  reviewStatus: 'needs-review'
  marketReviewed: false
  reviewAnchor: string
  rankBand: PfxTaxonomyReviewRankBand
  nearbyEffectIds: string[]
  marketSourceFamilies: PfxMarketSourceFamily[]
  marketSourceUrls: string[]
  operatorChecklist: string[]
  reviewPrompts: Record<PfxTaxonomyReviewCriterion, string>
}

export interface PfxTaxonomyReviewDossier {
  schema: 'game-bot.r3f-pfx-taxonomy-review-dossier.v1'
  summary: {
    totalEffects: number
    effectsNeedingMarketReview: number
    requiredCriteria: PfxTaxonomyReviewCriterion[]
  }
  instructions: {
    reviewTemplateFile: string
    approvalStatus: 'non-approving-review-input'
    operatorChecklist: string[]
  }
  effects: PfxTaxonomyReviewDossierEffect[]
}

export interface PfxTaxonomyReviewBatch {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  outputFile: string
  effectIds: string[]
}

export interface PfxTaxonomyReviewBatchSheetEffect {
  effectId: string
  rank: number
  name: string
  marketReviewed: false
  reviewAnchor: string
  rankBand: PfxTaxonomyReviewRankBand
  requiredCriteria: PfxTaxonomyReviewCriterion[]
  nearbyEffectIds: string[]
  marketSourceFamilies: PfxMarketSourceFamily[]
  marketSourceUrls: string[]
  reviewPrompts: Record<PfxTaxonomyReviewCriterion, string>
  reviewerChecklist: string[]
}

export interface PfxTaxonomyReviewBatchSheet {
  schema: 'game-bot.r3f-pfx-taxonomy-review-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-taxonomy-review-batch-sheet'
    sourceDossierSchema: 'game-bot.r3f-pfx-taxonomy-review-dossier.v1'
    outputFile: string
    operatorChecklist: string[]
  }
  batch: PfxTaxonomyReviewBatch
  effects: PfxTaxonomyReviewBatchSheetEffect[]
}

export interface PfxTaxonomyReviewBatchSheetOptions {
  batchId?: string
  batchSize?: number
}

export interface PfxTaxonomyReviewBatchSheetIndexSheet {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  firstEffectId: string
  lastEffectId: string
  outputFile: string
  markdownOutputFile: string
  command: string
}

export interface PfxTaxonomyReviewBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-taxonomy-review-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalEffects: number
    outputDirectory: string
    approvalStatus: 'non-approving-taxonomy-review-batch-sheet-index'
    bulkCommand: string
  }
  sheets: PfxTaxonomyReviewBatchSheetIndexSheet[]
}

export interface PfxTaxonomyReviewBatchSheetIndexOptions {
  outputDirectory?: string
  batchSize?: number
}

export interface PfxTaxonomyReviewManifestFromSourcesOptions {
  reviewer?: string
  reviewedAt?: string
}

export type PfxProductionImplementationCriterion = (typeof PFX_PRODUCTION_IMPLEMENTATION_CRITERIA)[number]

export type PfxProductionImplementationCriterionStatus = 'pending' | 'pass' | 'fail'

export type PfxProductionImplementationStatus = 'pending' | 'production-ready' | 'blocked'

export interface PfxProductionImplementationReview {
  effectId: string
  status: PfxProductionImplementationStatus
  implementedBy: string
  implementedAt: string
  sourcePath: string
  criteria: Record<PfxProductionImplementationCriterion, PfxProductionImplementationCriterionStatus>
  blockerFindings: string[]
  notes: string
}

export interface PfxProductionImplementationTemplate {
  schema: 'game-bot.r3f-pfx-production-implementation.v1'
  summary: {
    totalEffects: number
    productionReadyEffects: number
    productionReadyScope: 'implementation-code-evidence-only'
    pendingEffects: number
    requiredCriteria: PfxProductionImplementationCriterion[]
  }
  instructions: {
    approvalStatus: 'non-final-implementation-evidence'
    dossierFile: string
    candidateReportFile: string
    completionCommand: string
    operatorChecklist: string[]
  }
  implementations: PfxProductionImplementationReview[]
}

export interface PfxProductionImplementationDossierEffect {
  effectId: string
  rank: number
  name: string
  approvalStatus: 'needs-review'
  productionReady: false
  sourcePath: string
  reviewAnchor: string
  component: {
    componentName: string
    importName: string
  }
  authoredRecipeId: string
  controlKeys: (keyof PfxControls)[]
  previewAssets: {
    thumbnailFileName: string
    clipFileName: string
  }
  mobileBudget: {
    performanceTier: PerformanceTier
    mobileSafety: MobileSafety
    maxParticles: number
    maxDrawCalls: number
    textureMemoryKb: number
    expectedFrameCostMs: number
    overdrawRisk: PfxPerformanceBudget['overdrawRisk']
  }
  qualityScores: PfxQualityScores
  marketSourceFamilies: PfxMarketSourceFamily[]
  marketSourceUrls: string[]
  implementationFacts: Record<
    | 'hasDropInComponent'
    | 'hasAuthoredRecipe'
    | 'hasPreviewAssets'
    | 'hasMobileBudget'
    | 'hasQualityScores',
    boolean
  >
  operatorChecklist: string[]
}

export interface PfxProductionImplementationDossier {
  schema: 'game-bot.r3f-pfx-production-implementation-dossier.v1'
  summary: {
    totalEffects: number
    effectsNeedingProductionApproval: number
    requiredCriteria: PfxProductionImplementationCriterion[]
  }
  instructions: {
    implementationTemplateFile: string
    candidateReportFile: string
    approvalStatus: 'non-approving-review-input'
    operatorChecklist: string[]
  }
  effects: PfxProductionImplementationDossierEffect[]
}

export type PfxProductionImplementationCandidatePrerequisite =
  (typeof PFX_PRODUCTION_IMPLEMENTATION_CANDIDATE_PREREQUISITES)[number]

export type PfxProductionImplementationCandidateStatus =
  | 'ready-for-implementation-review'
  | 'missing-code-prerequisites'

export interface PfxProductionImplementationCandidateEffect {
  effectId: string
  rank: number
  name: string
  status: PfxProductionImplementationCandidateStatus
  productionApproved: false
  missingPrerequisites: PfxProductionImplementationCandidatePrerequisite[]
  reviewAnchor: string
  implementationEvidence: string[]
  codeFacts: {
    hasDropInComponent: boolean
    hasAuthoredRecipe: boolean
    controlsValidate: boolean
    hasMobileBudget: boolean
    hasPreviewAssets: boolean
    hasDeveloperDocs: boolean
    hasRenderPlanDepth: boolean
  }
}

export interface PfxProductionImplementationCandidateReport {
  schema: 'game-bot.r3f-pfx-production-implementation-candidates.v1'
  summary: {
    totalEffects: number
    readyForImplementationReview: number
    effectsWithMissingCodePrerequisites: number
    productionApprovedEffects: number
    requiredPrerequisites: PfxProductionImplementationCandidatePrerequisite[]
  }
  instructions: {
    implementationTemplateFile: string
    implementationDossierFile: string
    approvalStatus: 'non-approving-code-prerequisite-report'
    operatorChecklist: string[]
  }
  effects: PfxProductionImplementationCandidateEffect[]
}

export interface PfxProductionImplementationBatch {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  outputFile: string
  effectIds: string[]
}

export interface PfxProductionImplementationBatchSheetEffect {
  effectId: string
  rank: number
  name: string
  productionApproved: false
  reviewAnchor: string
  sourcePath: string
  componentName: string
  authoredRecipeId: string
  mobileBudget: PfxProductionImplementationDossierEffect['mobileBudget']
  qualityScores: PfxQualityScores
  requiredCriteria: PfxProductionImplementationCriterion[]
  evidenceReferences: string[]
  reviewerChecklist: string[]
}

export interface PfxProductionImplementationBatchSheet {
  schema: 'game-bot.r3f-pfx-production-implementation-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-production-implementation-batch-sheet'
    sourceDossierSchema: 'game-bot.r3f-pfx-production-implementation-dossier.v1'
    outputFile: string
    operatorChecklist: string[]
  }
  batch: PfxProductionImplementationBatch
  effects: PfxProductionImplementationBatchSheetEffect[]
}

export interface PfxProductionImplementationBatchSheetOptions {
  batchId?: string
  batchSize?: number
}

export interface PfxProductionImplementationBatchSheetIndexSheet {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  firstEffectId: string
  lastEffectId: string
  outputFile: string
  markdownOutputFile: string
  command: string
}

export interface PfxProductionImplementationBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-production-implementation-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalEffects: number
    outputDirectory: string
    approvalStatus: 'non-approving-production-implementation-batch-sheet-index'
    bulkCommand: string
  }
  sheets: PfxProductionImplementationBatchSheetIndexSheet[]
}

export interface PfxProductionImplementationBatchSheetIndexOptions {
  outputDirectory?: string
  batchSize?: number
}

export interface PfxProductionImplementationManifestFromCandidatesOptions {
  implementedBy?: string
  implementedAt?: string
}

export type PfxRedTeamCriterion = (typeof PFX_RED_TEAM_CRITERIA)[number]

export type PfxRedTeamCriterionStatus = 'pending' | 'pass' | 'fail'

export type PfxRedTeamReviewStatus = 'pending' | 'signed-off' | 'approved-deferral' | 'blocked'

export interface PfxRedTeamEffectReview {
  effectId: string
  status: PfxRedTeamReviewStatus
  reviewer: string
  reviewedAt: string
  anchor: string
  criteria: Record<PfxRedTeamCriterion, PfxRedTeamCriterionStatus>
  blockerFindings: string[]
  notes: string
}

export interface PfxRedTeamReviewTemplate {
  schema: 'game-bot.r3f-pfx-red-team-review.v1'
  summary: {
    totalEffects: number
    signedOffEffects: number
    approvedDeferrals: number
    pendingEffects: number
    blockedEffects: number
    mobileSafariBlockedEffects?: number
    chromeAndroidBlockedEffects?: number
    requiredCriteria: PfxRedTeamCriterion[]
  }
  instructions: {
    implementationTemplateFile: string
    approvalStatus: 'adversarial-review-required'
    completionCommand: string
    operatorChecklist: string[]
  }
  reviews: PfxRedTeamEffectReview[]
}

export interface PfxVisualInspectionTargets {
  thumbnailAsset: string
  animatedClipAsset: string
  styleContactSheetAsset: string
  controlExtremesContactSheetAsset: string
  styleDifferentiationAnchor: string
  controlSafetyAnchor: string
  requiredChecks: string[]
}

export interface PfxRedTeamReviewDossierEffect {
  effectId: string
  rank: number
  name: string
  reviewStatus: 'needs-adversarial-review'
  redTeamSignedOff: false
  reviewAnchor: string
  implementationAnchor: string
  realDeviceEvidence: {
    mobileSafari: string
    chromeAndroid: string
  }
  captureHandoff?: PfxProductionApprovalCaptureHandoff
  visualInspectionTargets: PfxVisualInspectionTargets
  evidenceToAttack: string[]
  attackPrompts: Record<PfxRedTeamCriterion, string>
}

export interface PfxRedTeamReviewDossier {
  schema: 'game-bot.r3f-pfx-red-team-dossier.v1'
  summary: {
    totalEffects: number
    effectsNeedingAdversarialReview: number
    requiredCriteria: PfxRedTeamCriterion[]
  }
  instructions: {
    reviewTemplateFile: string
    implementationManifestFile: string
    realDeviceAuditFile: string
    approvalStatus: 'non-approving-adversarial-review-input'
    operatorChecklist: string[]
  }
  effects: PfxRedTeamReviewDossierEffect[]
}

export interface PfxRedTeamReviewDossierOptions {
  realDeviceCaptureBaseUrl?: string
  realDeviceCaptureBatchIdsByEffectId?: Readonly<
    Record<string, Partial<Record<'mobile-safari' | 'chrome-android', string>>>
  >
}

export interface PfxRedTeamReviewBatch {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  outputFile: string
  effectIds: string[]
}

export interface PfxRedTeamReviewBatchSheetEffect {
  effectId: string
  rank: number
  name: string
  redTeamSignedOff: false
  reviewAnchor: string
  implementationAnchor: string
  realDeviceEvidence: PfxRedTeamReviewDossierEffect['realDeviceEvidence']
  mobileEvidenceGate: {
    status: 'blocked-until-real-device-captures'
    blockers: string[]
  }
  captureHandoff?: PfxProductionApprovalCaptureHandoff
  reviewerRisk: {
    level: 'standard' | 'heightened' | 'critical'
    performanceTier: PerformanceTier
    mobileSafety: MobileSafety
    reasons: string[]
  }
  visualInspectionTargets: PfxVisualInspectionTargets
  requiredCriteria: PfxRedTeamCriterion[]
  evidenceToAttack: string[]
  attackPrompts: Partial<Record<PfxRedTeamCriterion, string>>
  reviewerChecklist: string[]
  reviewRowTemplate: PfxRedTeamEffectReview
}

export interface PfxRedTeamReviewBatchSheet {
  schema: 'game-bot.r3f-pfx-red-team-review-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-red-team-review-batch-sheet'
    sourceDossierSchema: 'game-bot.r3f-pfx-red-team-dossier.v1'
    outputFile: string
    operatorChecklist: string[]
  }
  batch: PfxRedTeamReviewBatch
  effects: PfxRedTeamReviewBatchSheetEffect[]
}

export interface PfxRedTeamReviewBatchSheetOptions extends PfxRedTeamReviewDossierOptions {
  batchId?: string
  batchSize?: number
}

export interface PfxRedTeamReviewBatchSheetIndexOptions extends PfxRedTeamReviewDossierOptions {
  outputDirectory?: string
  batchSize?: number
}

export interface PfxRedTeamReviewBatchSheetIndexSheet {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  firstEffectId: string
  lastEffectId: string
  outputFile: string
  markdownOutputFile: string
  command: string
}

export interface PfxRedTeamReviewBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-red-team-review-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalEffects: number
    outputDirectory: string
    approvalStatus: 'non-approving-red-team-review-batch-sheet-index'
    bulkCommand: string
    operatorLaunchUrl?: string
    operatorLaunchUrlTemplate?: string
  }
  sheets: PfxRedTeamReviewBatchSheetIndexSheet[]
}

export interface PfxRedTeamBlockingReviewManifestOptions {
  reviewer?: string
  reviewedAt?: string
}

export type PfxProductionReadinessStatus =
  | 'production-ready'
  | 'approved-deferral'
  | 'needs-production-implementation'
  | 'needs-device-profiling'
  | 'needs-red-team-signoff'
  | 'needs-production-approval'

export interface PfxProductionReadinessEffect {
  effectId: string
  rank: number
  name: string
  acceptanceStatus: PfxAcceptanceStatus
  readinessStatus: PfxProductionReadinessStatus
  productionImplemented: boolean
  productionReady: boolean
  approvedDeferral: boolean
  realDeviceProfiled: boolean
  mobileSafariProfiled: boolean
  chromeAndroidProfiled: boolean
  redTeamSignedOff: boolean
  redTeamApprovedDeferral: boolean
  approval?: PfxProductionApproval
  requiredActions: string[]
}

export interface PfxProductionReadinessReport {
  schema: 'game-bot.r3f-pfx-production-readiness.v1'
  passed: boolean
  summary: {
    totalEffects: number
    productionImplementedEffects: number
    productionReadyEffects: number
    approvedDeferrals: number
    effectsRequiringDecision: number
    realDeviceProfiledEffects: number
    missingMobileSafariProfiles: number
    missingChromeAndroidProfiles: number
    redTeamSignedOffEffects: number
    byReadinessStatus: Record<PfxProductionReadinessStatus, number>
  }
  blockingFindings: string[]
  effects: PfxProductionReadinessEffect[]
}

export type PfxProductionAcceptanceGapKind =
  | 'approval-metadata'
  | 'taxonomy-review'
  | 'production-implementation'
  | 'mobile-safari-profile'
  | 'chrome-android-profile'
  | 'red-team-signoff'
  | 'approved-deferral'

export interface PfxProductionAcceptanceGap {
  kind: PfxProductionAcceptanceGapKind
  label: string
  evidence: string | null
  filePath: string | null
  captureHandoff?: PfxProductionApprovalCaptureHandoffPlatform
}

export interface PfxProductionAcceptanceGapEffect {
  effectId: string
  rank: number
  name: string
  readinessStatus: PfxProductionReadinessStatus
  openGapCount: number
  gaps: PfxProductionAcceptanceGap[]
}

export interface PfxProductionAcceptanceGapAudit {
  schema: 'game-bot.r3f-pfx-production-gap-audit.v1'
  summary: {
    totalEffects: number
    effectsWithOpenGaps: number
    missingApprovalMetadata: number
    missingTaxonomyReview: number
    missingProductionImplementation: number
    missingMobileSafariProfiles: number
    missingChromeAndroidProfiles: number
    missingRedTeamSignoff: number
    missingApprovedDeferrals: number
    operatorLaunchUrl?: string
    operatorLaunchUrlTemplate?: string
  }
  effects: PfxProductionAcceptanceGapEffect[]
}

export type PfxProductionApprovalReadinessStatus =
  | 'ready-for-approval'
  | 'already-approved'
  | 'approved-deferral'
  | 'missing-prerequisites'

export type PfxProductionApprovalReadinessMissingPrerequisite =
  | 'taxonomy-review'
  | 'production-implementation'
  | 'real-device-profile'
  | 'mobile-safari-profile'
  | 'chrome-android-profile'
  | 'red-team-signoff'

export interface PfxProductionApprovalCaptureHandoffPlatform {
  outputFile: string
  evidenceReference: string
  captureUrl?: string
  autoUploadUrl?: string
  autoUploadUrlTemplate?: string
  autoUploadRequiresDeviceLabel?: boolean
  operatorLaunchUrl?: string
  operatorLaunchUrlTemplate?: string
  captureUrlReachability?: 'network-reachable' | 'local-only'
}

export interface PfxProductionApprovalCaptureHandoff {
  operatorLaunchUrl?: string
  operatorLaunchUrlTemplate?: string
  operatorStatusUrl?: string
  operatorStatusUrlTemplate?: string
  mobileSafari: PfxProductionApprovalCaptureHandoffPlatform
  chromeAndroid: PfxProductionApprovalCaptureHandoffPlatform
}

export interface PfxProductionApprovalReadinessEffect {
  effectId: string
  rank: number
  name: string
  status: PfxProductionApprovalReadinessStatus
  mobileSafariProfiled: boolean
  chromeAndroidProfiled: boolean
  realDeviceProfiled: boolean
  missingPrerequisites: PfxProductionApprovalReadinessMissingPrerequisite[]
  recommendedApprovalEvidence: string[]
  approvalAnchor: string
  remainingApprovalAction: string
  captureHandoff?: PfxProductionApprovalCaptureHandoff
}

export interface PfxProductionApprovalReadinessReport {
  schema: 'game-bot.r3f-pfx-production-approval-readiness.v1'
  summary: {
    totalEffects: number
    readyForApprovalEffects: number
    alreadyApprovedEffects: number
    approvedDeferrals: number
    missingPrerequisiteEffects: number
    missingMobileSafariProfiles: number
    missingChromeAndroidProfiles: number
    missingRedTeamSignoff: number
  }
  effects: PfxProductionApprovalReadinessEffect[]
}

export interface PfxProductionApprovalBatch {
  batchId: string
  firstRank: number
  lastRank: number
  effectCount: number
  outputFile: string
  effectIds: string[]
}

export interface PfxProductionApprovalBatchSheetEffect {
  effectId: string
  rank: number
  name: string
  approved: false
  status: PfxProductionApprovalReadinessStatus
  missingPrerequisites: PfxProductionApprovalReadinessMissingPrerequisite[]
  recommendedApprovalEvidence: string[]
  approvalAnchor: string
  remainingApprovalAction: string
  captureHandoff?: PfxProductionApprovalCaptureHandoff
  outputFile: string
  decisionOptions: PfxProductionApprovalDecision[]
  visualInspectionTargets: PfxVisualInspectionTargets
  approvalRowTemplate?: PfxProductionApproval
}

export interface PfxProductionApprovalBatchSheet {
  schema: 'game-bot.r3f-pfx-production-approval-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-production-approval-batch-sheet'
    sourceReadinessSchema: 'game-bot.r3f-pfx-production-approval-readiness.v1'
    outputFile: string
    operatorChecklist: string[]
  }
  batch: PfxProductionApprovalBatch
  effects: PfxProductionApprovalBatchSheetEffect[]
}

export interface PfxProductionApprovalTemplate {
  schema: 'game-bot.r3f-pfx-production-approval-template.v1'
  summary: {
    totalEffects: number
    productionReadyDecisions: number
    approvedDeferrals: number
    submittedApprovals: number
    pendingMetadataApprovals: number
    evidenceSlotsPerEffect: number
    approvalStatus: 'non-approving-production-approval-template'
  }
  instructions: {
    implementationManifestFile: string
    realDeviceAuditFile: string
    redTeamReviewFile: string
    taxonomyReviewFile: string
    finalAcceptanceCommand: string
    productionReadyEvidenceSlots: string[]
    approvedDeferralEvidenceSlots: string[]
    operatorChecklist: string[]
  }
  approvals: PfxProductionApproval[]
}

export interface PfxProductionApprovalTemplateOptions {
  realDeviceCaptureBaseUrl?: string
  realDeviceCaptureBatchIdsByEffectId?: Readonly<
    Record<string, Partial<Record<'mobile-safari' | 'chrome-android', string>>>
  >
}

export type PfxObjectiveReadinessRequirementStatus = 'locally-satisfied' | 'external-evidence-required'

export interface PfxObjectiveReadinessRequirement {
  id: string
  category: string
  requirement: string
  status: PfxObjectiveReadinessRequirementStatus
  evidence: string[]
  blockers: string[]
  nextActions: string[]
}

export interface PfxObjectiveReadinessReport {
  schema: 'game-bot.r3f-pfx-objective-readiness.v1'
  approvalStatus: 'non-approving-objective-readiness'
  passed: boolean
  summary: {
    totalEffects: number
    totalRequirements: number
    locallySatisfiedRequirements: number
    externalEvidenceRequiredRequirements: number
    blockedRequirements: number
  }
  finalAcceptanceCommand: string
  requirements: PfxObjectiveReadinessRequirement[]
}

export type PfxExternalEvidenceWorkItemId =
  | 'taxonomy-review'
  | 'production-implementation'
  | 'mobile-safari-capture'
  | 'chrome-android-capture'
  | 'red-team-review'
  | 'final-approval'

export interface PfxExternalEvidenceWorkItem {
  id: PfxExternalEvidenceWorkItemId
  label: string
  outputFile: string
  evidenceReference: string
  captureUrl?: string
  autoUploadUrl?: string
  autoUploadUrlTemplate?: string
  autoUploadRequiresDeviceLabel?: boolean
  operatorLaunchUrl?: string
  operatorLaunchUrlTemplate?: string
  captureUrlReachability?: 'network-reachable' | 'local-only'
  visualInspectionTargets?: PfxVisualInspectionTargets
  prerequisiteStatus: 'ready' | 'blocked'
  blockedBy: PfxExternalEvidenceWorkItemId[]
  instructions: string[]
}

export interface PfxExternalEvidenceNextReadyWorkItem {
  effectId: string
  rank: number
  name: string
  workItemId: PfxExternalEvidenceWorkItemId
  label: string
  outputFile: string
  evidenceReference: string
  captureUrl?: string
  autoUploadUrl?: string
  autoUploadUrlTemplate?: string
  autoUploadRequiresDeviceLabel?: boolean
  operatorLaunchUrl?: string
  operatorLaunchUrlTemplate?: string
  captureUrlReachability?: 'network-reachable' | 'local-only'
  visualInspectionTargets?: PfxExternalEvidenceWorkItem['visualInspectionTargets']
}

export interface PfxExternalEvidenceWorkOrderEffect {
  effectId: string
  rank: number
  name: string
  openWorkItemCount: number
  workItems: PfxExternalEvidenceWorkItem[]
}

export interface PfxExternalEvidenceWorkOrder {
  schema: 'game-bot.r3f-pfx-external-evidence-work-order.v1'
  blockingFindings: string[]
  summary: {
    totalEffects: number
    totalOpenWorkItems: number
    readyWorkItems: number
    blockedWorkItems: number
    taxonomyReviewItems: number
    productionImplementationItems: number
    mobileSafariCaptureItems: number
    chromeAndroidCaptureItems: number
    captureUrlItems: number
    networkReachableCaptureUrlItems: number
    localOnlyCaptureUrlItems: number
    missingCaptureUrlItems: number
    readyCaptureUrlItems: number
    networkReachableReadyCaptureUrlItems: number
    localOnlyReadyCaptureUrlItems: number
    missingReadyCaptureUrlItems: number
    autoUploadUrlItems: number
    autoUploadRequiresDeviceLabelItems: number
    batchScopedAutoUploadUrlItems: number
    readyBatchScopedAutoUploadUrlItems: number
    missingBatchScopedAutoUploadUrlItems: number
    redTeamReviewItems: number
    finalApprovalItems: number
    nextReadyWorkItem: PfxExternalEvidenceNextReadyWorkItem | null
  }
  instructions: {
    approvalStatus: 'non-approving-external-evidence-work-order'
    finalAcceptanceCommand: string
    operatorChecklist: string[]
  }
  effects: PfxExternalEvidenceWorkOrderEffect[]
}

export interface PfxExternalEvidenceWorkItemCounts {
  taxonomyReviewItems: number
  productionImplementationItems: number
  mobileSafariCaptureItems: number
  chromeAndroidCaptureItems: number
  redTeamReviewItems: number
  finalApprovalItems: number
}

export interface PfxExternalEvidenceBatch {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  openWorkItemCount: number
  readyWorkItemCount: number
  blockedWorkItemCount: number
  captureUrlItemCount: number
  networkReachableCaptureUrlItemCount: number
  localOnlyCaptureUrlItemCount: number
  missingCaptureUrlItemCount: number
  readyCaptureUrlItemCount: number
  networkReachableReadyCaptureUrlItemCount: number
  localOnlyReadyCaptureUrlItemCount: number
  missingReadyCaptureUrlItemCount: number
  autoUploadUrlItemCount: number
  autoUploadRequiresDeviceLabelItemCount: number
  batchScopedAutoUploadUrlItemCount: number
  readyBatchScopedAutoUploadUrlItemCount: number
  missingBatchScopedAutoUploadUrlItemCount: number
  workItemsByType: PfxExternalEvidenceWorkItemCounts
  effectIds: string[]
  outputFiles: string[]
}

export interface PfxExternalEvidenceBatchPlan {
  schema: 'game-bot.r3f-pfx-external-evidence-batch-plan.v1'
  summary: {
    totalEffects: number
    totalOpenWorkItems: number
    readyWorkItems: number
    blockedWorkItems: number
    captureUrlItems: number
    networkReachableCaptureUrlItems: number
    localOnlyCaptureUrlItems: number
    missingCaptureUrlItems: number
    readyCaptureUrlItems: number
    networkReachableReadyCaptureUrlItems: number
    localOnlyReadyCaptureUrlItems: number
    missingReadyCaptureUrlItems: number
    autoUploadUrlItems: number
    autoUploadRequiresDeviceLabelItems: number
    batchScopedAutoUploadUrlItems: number
    readyBatchScopedAutoUploadUrlItems: number
    missingBatchScopedAutoUploadUrlItems: number
    operatorLaunchUrl?: string
    operatorLaunchUrlTemplate?: string
    batchSize: number
    totalBatches: number
    nonApproving: true
  }
  instructions: {
    approvalStatus: 'non-approving-external-evidence-batch-plan'
    sourceWorkOrderSchema: 'game-bot.r3f-pfx-external-evidence-work-order.v1'
    finalAcceptanceCommand: string
    operatorChecklist: string[]
  }
  batches: PfxExternalEvidenceBatch[]
}

export interface PfxExternalEvidenceBatchSheetEffect {
  effectId: string
  rank: number
  name: string
  openWorkItemCount: number
  workItems: PfxExternalEvidenceWorkItem[]
}

export interface PfxExternalEvidenceBatchSheet {
  schema: 'game-bot.r3f-pfx-external-evidence-batch-sheet.v1'
  instructions: {
    approvalStatus: 'non-approving-external-evidence-batch-sheet'
    sourceBatchPlanSchema: 'game-bot.r3f-pfx-external-evidence-batch-plan.v1'
    finalAcceptanceCommand: string
    operatorChecklist: string[]
  }
  batch: PfxExternalEvidenceBatch
  effects: PfxExternalEvidenceBatchSheetEffect[]
}

export interface PfxExternalEvidenceBatchSheetIndexOptions {
  outputDirectory?: string
}

export interface PfxExternalEvidenceBatchSheetIndexSheet {
  batchId: string
  rankStart: number
  rankEnd: number
  effectCount: number
  openWorkItemCount: number
  readyWorkItemCount: number
  blockedWorkItemCount: number
  captureUrlItemCount: number
  readyCaptureUrlItemCount: number
  batchScopedAutoUploadUrlItemCount: number
  autoUploadRequiresDeviceLabelItemCount: number
  readyBatchScopedAutoUploadUrlItemCount: number
  missingBatchScopedAutoUploadUrlItemCount: number
  outputFile: string
  markdownOutputFile: string
  command: string
}

export interface PfxExternalEvidenceBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-external-evidence-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalEffects: number
    totalOpenWorkItems: number
    readyWorkItems: number
    blockedWorkItems: number
    captureUrlItems: number
    networkReachableCaptureUrlItems: number
    localOnlyCaptureUrlItems: number
    missingCaptureUrlItems: number
    readyCaptureUrlItems: number
    networkReachableReadyCaptureUrlItems: number
    localOnlyReadyCaptureUrlItems: number
    missingReadyCaptureUrlItems: number
    autoUploadUrlItems: number
    autoUploadRequiresDeviceLabelItems: number
    batchScopedAutoUploadUrlItems: number
    readyBatchScopedAutoUploadUrlItems: number
    missingBatchScopedAutoUploadUrlItems: number
    operatorLaunchUrl?: string
    operatorLaunchUrlTemplate?: string
    outputDirectory: string
    approvalStatus: 'non-approving-external-evidence-batch-sheet-index'
    bulkCommand: string
  }
  sheets: PfxExternalEvidenceBatchSheetIndexSheet[]
}

export interface PfxExternalEvidenceBatchSheetIndexValidation {
  passed: boolean
  findings: string[]
}

export interface PfxProductionReadinessOptions {
  approvals?: readonly PfxProductionApproval[]
  implementations?: readonly PfxProductionImplementationReview[]
  redTeamReviews?: readonly PfxRedTeamEffectReview[]
  realDeviceProfiledEffectIds?: readonly string[]
  mobileSafariProfiledEffectIds?: readonly string[]
  chromeAndroidProfiledEffectIds?: readonly string[]
  taxonomyReviewedEffectIds?: readonly string[]
  realDeviceCaptureBaseUrl?: string
  realDeviceCaptureBatchIdsByEffectId?: Readonly<
    Record<string, Partial<Record<'mobile-safari' | 'chrome-android', string>>>
  >
}

export interface PfxProductionApprovalBatchSheetOptions extends PfxProductionReadinessOptions {
  batchId?: string
  batchSize?: number
}

export interface PfxProductionApprovalBatchSheetIndexOptions extends PfxProductionReadinessOptions {
  outputDirectory?: string
  batchSize?: number
}

export interface PfxProductionApprovalBatchSheetIndexSheet {
  batchId: string
  firstRank: number
  lastRank: number
  effectCount: number
  firstEffectId: string
  lastEffectId: string
  outputFile: string
  markdownOutputFile: string
  command: string
}

export interface PfxProductionApprovalBatchSheetIndex {
  schema: 'game-bot.r3f-pfx-production-approval-batch-sheet-index.v1'
  summary: {
    totalBatches: number
    totalEffects: number
    outputDirectory: string
    approvalStatus: 'non-approving-production-approval-batch-sheet-index'
    bulkCommand: string
    operatorLaunchUrl?: string
    operatorLaunchUrlTemplate?: string
  }
  sheets: PfxProductionApprovalBatchSheetIndexSheet[]
}

export interface PfxExternalEvidenceWorkOrderOptions extends PfxProductionReadinessOptions {
  mobileSafariProfiledEffectIds?: readonly string[]
  chromeAndroidProfiledEffectIds?: readonly string[]
}

export interface PfxExternalEvidenceBatchPlanOptions extends PfxExternalEvidenceWorkOrderOptions {
  batchSize?: number
}

export interface PfxExternalEvidenceBatchSheetOptions extends PfxExternalEvidenceBatchPlanOptions {
  batchId?: string
}

export interface PfxFilterQuery {
  query?: string
  effectType?: EffectType[]
  gameplayUseCase?: string[]
  style?: ArtStyleCluster[]
  performanceTier?: PerformanceTier[]
  emotionMood?: string[]
  colorFamily?: string[]
  assetRequirements?: string[]
  loopMode?: LoopMode[]
  space?: EffectSpace[]
  mobileSafeOnly?: boolean
  coverage?: PfxAcceptanceStatus[]
}

export interface PfxPresetOverrides {
  color?: string[]
  style?: ArtStyleCluster
  scale?: number
  density?: number
  timing?: number
  lifetime?: number
  velocity?: number
  gravity?: number
  turbulence?: number
  spawnShape?: SpawnShape
  texture?: PfxControls['texture']
  flipbook?: PfxControls['flipbook']
  blendMode?: BlendMode
  emissiveBloom?: number
  trailLength?: number
  seed?: number
  lod?: LodLevel[]
}

export interface ExportSnippetOptions {
  componentName?: string
  importPath?: string
}

export type PfxControlKey = keyof PfxControls

export interface PfxControlDefinition {
  key: PfxControlKey
  label: string
  kind: 'color-list' | 'select' | 'multi-select' | 'range' | 'number'
  min?: number
  max?: number
  step?: number
  options?: readonly string[]
}

export interface PfxControlSafetyControlEvidence {
  key: PfxControlKey
  label: string
  kind: PfxControlDefinition['kind']
  bounded: boolean
  defaultWithinBounds: boolean
  minVariantValid: boolean
  maxVariantValid: boolean
  affectsBudget: boolean
  affectsRenderSignature: boolean
  failureReasons: string[]
}

export interface PfxControlSafetyEffectEvidence {
  effectId: string
  rank: number
  name: string
  safe: boolean
  controlCount: number
  defaultPresetValid: boolean
  failureReasons: string[]
  controls: PfxControlSafetyControlEvidence[]
}

export interface PfxControlSafetyMatrix {
  schema: 'game-bot.r3f-pfx-control-safety-matrix.v1'
  summary: {
    totalEffects: number
    controlCount: number
    effectsPassingControlSafety: number
    controlsWithBudgetImpact: number
    controlsWithRenderImpact: number
  }
  instructions: {
    approvalStatus: 'non-approving-customization-safety-evidence'
    browserSurface: string
    operatorChecklist: string[]
  }
  controls: PfxControlSafetyControlEvidence[]
  effects: PfxControlSafetyEffectEvidence[]
}

export interface PfxStyleDifferentiationVariantEvidence {
  style: ArtStyleCluster
  nonColorSignature: string
  texture: PfxTextureKind
  blendMode: BlendMode
  silhouette: PfxStyleRenderProfile['silhouette']
  materialTreatment: PfxStyleRenderProfile['materialTreatment']
  motionTreatment: PfxStyleRenderProfile['motionTreatment']
  particleShape: PfxStyleRenderProfile['particleShape']
  geometrySegments: number
  edgeHardness: number
  particleSizeMultiplier: number
}

export interface PfxStyleDifferentiationEffectEvidence {
  effectId: string
  rank: number
  name: string
  safe: boolean
  styleCount: number
  distinctNonColorSignatures: number
  failureReasons: string[]
  variants: PfxStyleDifferentiationVariantEvidence[]
}

export interface PfxStyleDifferentiationMatrix {
  schema: 'game-bot.r3f-pfx-style-differentiation-matrix.v1'
  summary: {
    totalEffects: number
    styleCount: number
    effectsPassingStyleDifferentiation: number
    minimumDistinctNonColorSignatures: number
  }
  instructions: {
    approvalStatus: 'non-approving-style-differentiation-evidence'
    browserSurface: string
    operatorChecklist: string[]
  }
  styles: PfxStyleDifferentiationVariantEvidence[]
  effects: PfxStyleDifferentiationEffectEvidence[]
}

export interface PfxPerformanceSummary {
  effectCount: number
  totalParticles: number
  totalDrawCalls: number
  textureMemoryKb: number
  expectedFrameCostMs: number
  overdrawRisk: 'low' | 'medium' | 'high'
  mobileSafe: boolean
}

export interface PfxStressScenarioOptions {
  id: string
  query?: PfxFilterQuery
  effectIds?: string[]
  concurrentEffects: number
  repeatExplicitEffects?: boolean
}

export interface PfxStressScenario {
  id: string
  presets: PfxPreset[]
  positions: [number, number, number][]
  summary: PfxPerformanceSummary
}

export type PfxRenderSurfaceKind =
  | 'particles'
  | 'core-sphere'
  | 'impact-core'
  | 'impact-shards'
  | 'coin-reward-burst'
  | 'shield-fragments'
  | 'mesh-fragments'
  | 'trail-ribbon'
  | 'ring-field'
  | 'magic-circle'
  | 'water-cone-sheet'
  | 'shield-shell'
  | 'beam-column'
  | 'cloud-volume'
  | 'impact-sparks'
  | 'screen-plane'
  | 'shockwave-ring'
  | 'telegraph-disc'
  | 'portal-throat'
  | 'scuff-wedge'
  | 'healing-glyphs'
  | 'spawn-voxels'
  | 'footprint-decal'
  | 'muzzle-cone'
  | 'toxic-pool'
  | 'acid-pool'
  | 'bubble-shells'
  | 'dissolve-voxels'
  | 'wind-streaks'
  | 'reward-gem'
  | 'coin-medallion'
  | 'celebration-chevrons'
  | 'projectile-comet'
  | 'projectile-head'
  | 'smoke-billows'
  | 'toxic-billows'
  | 'tapered-trail'
