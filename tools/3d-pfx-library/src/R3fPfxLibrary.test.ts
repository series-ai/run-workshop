// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import * as PfxLibrary from './index'
import { PFX_SPRITE_SLICES } from './particleSprites'
import {
  ART_STYLE_CLUSTERS,
  EFFECT_TYPE_FILTERS,
  PFX_CONTROL_DEFINITIONS,
  PFX_PRESETS,
  PFX_MARKET_SOURCE_REFERENCES,
  PFX_MOBILE_RUNTIME_POLICY,
  PFX_QUALITY_RUBRIC_KEYS,
  PFX_TEXTURE_ATLAS,
  PFX_TEXTURE_KINDS,
  PFX_TAXONOMY,
  PERFORMANCE_TIER_BUDGETS,
  createPfxMobileRuntimePolicy,
  createPfxPreset,
  createPfxPreviewAssetAudit,
  createPfxPreviewManifest,
  createPfxRuntimeOptimizationAudit,
  createReducedMotionPfxPreset,
  createPfxStressScenario,
  createGamePfxComponent,
  createPfxDeveloperDocsManifest,
  exportPfxComponentSnippet,
  exportPfxDeveloperDocsManifestJson,
  exportPfxDeveloperDocsMarkdown,
  exportPfxPreviewManifestJson,
  exportPfxPresetJson,
  filterPfxCatalog,
  clearPfxRuntimeResourceCache,
  getPfxComponentDefinition,
  getPfxFlipbookFrameProps,
  getPfxRuntimeResourceCacheStats,
  getPfxSharedGeometry,
  getPfxSharedParticleTexture,
  getPfxStyleRenderProfile,
  getPfxStyleRenderSignature,
  getPfxTextureAtlasSlice,
  getPfxSurfaceAnimationProps,
  getPfxSurfaceMaterialProps,
  getPfxRenderPlan,
  summarizePfxPerformance,
  validatePfxPreset,
  PFX_COMPONENT_DEFINITIONS,
  PFX_COMPONENTS,
  createPfxProductionApprovalReadinessReport,
  createPfxProductionReadinessReport,
  createPfxProductionApprovalTemplate,
  createPfxProductionAcceptanceGapAudit,
  createPfxProductionImplementationCandidateReport,
  createPfxProductionImplementationDossier,
  createPfxProductionImplementationManifestFromCandidates,
  createPfxProductionImplementationTemplate,
  createPfxControlSafetyMatrix,
  createPfxExportCleanlinessAudit,
  createPfxStyleDifferentiationMatrix,
  createPfxTaxonomyReviewDossier,
  createPfxTaxonomyReviewManifestFromSources,
  createPfxTaxonomyReviewTemplate,
  createPfxRedTeamBlockingReviewManifest,
  createPfxRedTeamReviewDossier,
  createPfxRedTeamReviewTemplate,
  exportPfxProductionAcceptanceGapAuditMarkdown,
  exportPfxProductionApprovalTemplateJson,
  exportPfxProductionApprovalReadinessReportMarkdown,
  exportPfxProductionReadinessReportJson,
  applyPfxSurfaceRotation,
  createPfxMuzzleFlameGeometry,
  createPfxComboRingVariantRecipe,
  isPfxSurfaceCameraFacing,
} from './index'

const CANONICAL_FINAL_ACCEPTANCE_COMMAND = 'npm --prefix tools/3d-pfx-library/viewer run verify:final-acceptance'
const CANONICAL_LOCAL_ACCEPTANCE_COMMAND = 'npm --prefix tools/3d-pfx-library/viewer run verify:acceptance'
const CANONICAL_LAN_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan'
const CANONICAL_BASE_URL_PRODUCTION_HANDOFF_COMMAND =
  'PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url'

function completedImplementationRows(effectId: string, implementedBy = 'pfx-implementer') {
  const template = createPfxProductionImplementationTemplate()
  return template.implementations.map((implementation) =>
    implementation.effectId === effectId
      ? {
          ...implementation,
          status: 'production-ready' as const,
          implementedBy,
          implementedAt: '2026-07-03T12:00:00.000Z',
          criteria: Object.fromEntries(Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass'])) as never,
          blockerFindings: [],
          notes: `${effectId} production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.`,
        }
      : implementation,
  )
}

function completedRedTeamRows(
  effectId: string,
  reviewer = 'red-team-lead',
  status: 'signed-off' | 'approved-deferral' = 'signed-off',
) {
  const template = createPfxRedTeamReviewTemplate()
  return template.reviews.map((review) =>
    review.effectId === effectId
      ? {
          ...review,
          status,
          reviewer,
          reviewedAt: '2026-07-03T12:10:00.000Z',
          criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
          blockerFindings: [],
          notes: `${effectId} adversarial review accepted mobile performance evidence, export cleanliness, control safety, and documentation coverage.`,
        }
      : review,
  )
}

describe('r3f-pfx-library catalog contracts', () => {
  it('publishes a ranked 500-effect game PFX taxonomy with production-critical staples', () => {
    expect(PFX_TAXONOMY).toHaveLength(500)
    expect(new Set(PFX_TAXONOMY.map((effect) => effect.id)).size).toBe(500)
    expect(PFX_TAXONOMY.map((effect) => effect.rank)).toEqual(
      Array.from({ length: 500 }, (_, index) => index + 1),
    )

    expect(PFX_TAXONOMY.slice(0, 25).map((effect) => effect.id)).toEqual(
      expect.arrayContaining([
        'fireball',
        'explosion',
        'smoke-puff',
        'muzzle-flash',
        'hit-spark',
        'healing-aura',
        'slash-trail',
        'loot-beam',
        'force-field',
        'footstep-dust',
        'shield-break',
        'poison-cloud',
        'ui-reward-burst',
        'charge-telegraph',
        'spawn-marker',
        'dissolve',
        'portal-idle-loop',
        'underwater-bubbles',
        'snow-gust',
        'low-health-screen-particles',
      ]),
    )

    for (const effect of PFX_TAXONOMY) {
      expect(effect.name.length).toBeGreaterThan(2)
      expect(effect.gameplayUseCases.length).toBeGreaterThan(0)
      expect(EFFECT_TYPE_FILTERS).toContain(effect.effectType)
      expect(effect.styleAffinity.length).toBeGreaterThan(0)
      expect(effect.mobileSafety).toMatch(/safe|caution|cinematic-only/)
      expect(effect.acceptanceStatus).toMatch(/authored-preview|profile-backed/)
    }
  })

  it('marks all 500 ranked effects with authored preview recipes instead of generic profile coverage', () => {
    const authoredRankedEffects = PFX_TAXONOMY
    expect(authoredRankedEffects.map((effect) => effect.acceptanceStatus)).toEqual(
      Array.from({ length: 500 }, () => 'authored-preview'),
    )

    const authoredPlans = authoredRankedEffects.map((effect) => getPfxRenderPlan(createPfxPreset(effect.id)))
    expect(authoredPlans.every((plan) => plan.authoredRecipeId?.startsWith(`${plan.effectId}:`))).toBe(true)
    expect(authoredPlans.every((plan) => (
      plan.surfaces.length >= 2 ||
      (plan.surfaces.length === 1 && Boolean(plan.surfaces[0]?.tuning?.meshGeometry))
    ))).toBe(true)
    expect(new Set(authoredPlans.map((plan) => plan.signature)).size).toBeGreaterThanOrEqual(410)
    expect(filterPfxCatalog({ coverage: ['profile-backed'] })).toHaveLength(0)
  })

  it('exports a pending market-review template for the accepted 500-effect taxonomy', () => {
    const template = createPfxTaxonomyReviewTemplate()

    expect(template.schema).toBe('game-bot.r3f-pfx-taxonomy-review.v1')
    expect(template.summary.totalEffects).toBe(500)
    expect(template.summary.marketReviewedEffects).toBe(0)
    expect(template.summary.pendingEffects).toBe(500)
    expect(template.summary.requiredCriteria).toEqual([
      'source-observed-need',
      'rank-justified',
      'family-balanced',
      'variant-compatible',
      'production-critical-coverage',
      'not-duplicate',
      'market-source-linked',
    ])
    expect(template.instructions).toMatchObject({
      dossierFile: '.context/r3f-pfx-taxonomy-review-dossier.json',
      completionCommand: CANONICAL_LOCAL_ACCEPTANCE_COMMAND,
      operatorChecklist: expect.arrayContaining([
        'Review each effect against every required criterion using the dossier prompts and market source URLs.',
        'Replace TODO reviewer metadata and set status to market-reviewed only when every criterion passes.',
        'Leave blockerFindings empty only after checking source relevance, rank, duplicate risk, and production-critical coverage.',
      ]),
    })
    expect(template.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(template.reviews).toHaveLength(500)
    expect(template.reviews[0]).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      status: 'pending',
      reviewer: 'TODO:taxonomy-reviewer',
      marketSources: PFX_TAXONOMY[0].marketSourceUrls,
    })
    expect(template.reviews[0].criteria['source-observed-need']).toBe('pending')
    expect(template.reviews[499].effectId).toBe(PFX_TAXONOMY[499].id)
  })

  it('exports a source-derived market-reviewed taxonomy manifest for every accepted effect', () => {
    const manifest = createPfxTaxonomyReviewManifestFromSources({
      reviewer: 'game-bot-market-audit',
      reviewedAt: '2026-07-03T12:00:00.000Z',
    })

    expect(manifest.schema).toBe('game-bot.r3f-pfx-taxonomy-review.v1')
    expect(manifest.approvalStatus).toBe('source-derived-taxonomy-evidence')
    expect(manifest.summary).toEqual({
      totalEffects: 500,
      marketReviewedEffects: 500,
      marketReviewScope: 'source-traceability-evidence-only',
      pendingEffects: 0,
      requiredCriteria: [
        'source-observed-need',
        'rank-justified',
        'family-balanced',
        'variant-compatible',
        'production-critical-coverage',
        'not-duplicate',
        'market-source-linked',
      ],
    })
    expect(manifest.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'This source-derived manifest records taxonomy market-review evidence only; it does not satisfy implementation, real-device, red-team, or final approval gates.',
        'Every market-reviewed row must retain HTTP(S) source URLs from the market scan traceability data.',
      ]),
    )
    expect(manifest.instructions.completionCommand).toBe(CANONICAL_LOCAL_ACCEPTANCE_COMMAND)
    expect(manifest.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(manifest.reviews).toHaveLength(500)

    const forceField = manifest.reviews.find((review) => review.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      status: 'market-reviewed',
      reviewer: 'game-bot-market-audit',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      blockerFindings: [],
      notes:
        'Source-derived market taxonomy review for Force Field: source-observed need, rank rationale, family balance, variant compatibility, production-critical coverage, duplicate risk, and market-source linkage are accepted from the refreshed market scan traceability.',
    })
    expect(forceField?.criteria).toEqual({
      'source-observed-need': 'pass',
      'rank-justified': 'pass',
      'family-balanced': 'pass',
      'variant-compatible': 'pass',
      'production-critical-coverage': 'pass',
      'not-duplicate': 'pass',
      'market-source-linked': 'pass',
    })
    expect(forceField?.marketSources.length).toBeGreaterThan(0)
    expect(forceField?.marketSources.every((source) => /^https?:\/\//.test(source))).toBe(true)
  })

  it('exports a reviewer-ready taxonomy dossier without market-review self-approval', () => {
    const dossier = createPfxTaxonomyReviewDossier()
    const fireball = dossier.effects[0]

    expect(dossier.schema).toBe('game-bot.r3f-pfx-taxonomy-review-dossier.v1')
    expect(dossier.summary).toEqual({
      totalEffects: 500,
      effectsNeedingMarketReview: 500,
      requiredCriteria: [
        'source-observed-need',
        'rank-justified',
        'family-balanced',
        'variant-compatible',
        'production-critical-coverage',
        'not-duplicate',
        'market-source-linked',
      ],
    })
    expect(dossier.instructions).toMatchObject({
      reviewTemplateFile: '.context/r3f-pfx-taxonomy-review-template.json',
      approvalStatus: 'non-approving-review-input',
      operatorChecklist: expect.arrayContaining([
        'Use this dossier only as context; it never satisfies taxonomy approval by itself.',
        'Write final decisions into reviewTemplateFile, not into this dossier.',
      ]),
    })
    expect(dossier.effects).toHaveLength(500)
    expect(fireball).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      name: 'Fireball',
      reviewStatus: 'needs-review',
      marketReviewed: false,
      reviewAnchor: '.context/r3f-pfx-taxonomy-review.json#fireball',
      rankBand: 'top-25-production-staple',
      nearbyEffectIds: ['explosion', 'smoke-puff'],
      marketSourceFamilies: PFX_TAXONOMY[0].marketSourceFamilies,
      marketSourceUrls: PFX_TAXONOMY[0].marketSourceUrls,
      operatorChecklist: [
        'Open every marketSourceUrl and confirm the effect is a source-observed game PFX need.',
        'Compare rank against nearbyEffectIds and record whether rank is justified.',
        'Check family balance, variant compatibility, production-critical coverage, and duplicate risk.',
        'Copy the final decision into .context/r3f-pfx-taxonomy-review.json#fireball.',
      ],
      reviewPrompts: {
        'source-observed-need': expect.stringContaining('fireball'),
        'market-source-linked': expect.stringContaining(PFX_TAXONOMY[0].marketSourceUrls[0]),
      },
    })
    expect(dossier.effects[24].rankBand).toBe('top-25-production-staple')
    expect(dossier.effects[25].rankBand).toBe('generated-coverage-target')
  })

  it('exports a reviewer-readable Markdown handoff for the taxonomy review dossier', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxTaxonomyReviewDossierMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const markdown = exportMarkdown()

    expect(markdown).toContain('# R3F PFX Taxonomy Review Dossier')
    expect(markdown).toContain('Treat this handoff as non-approving market-review input.')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Effects needing market review: 500')
    expect(markdown).toContain('Review template: `.context/r3f-pfx-taxonomy-review-template.json`')
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-taxonomy-review.json#fireball`')
    expect(markdown).toContain('Rank band: `top-25-production-staple`')
    expect(markdown).toContain('### Market Sources')
    expect(markdown).toContain('### Review Prompts')
    expect(markdown).toContain('- **Source observed need:**')
    expect(markdown).toContain('- **Market source linked:**')
    expect(markdown).toContain('### Nearby Effects')
  })

  it('exports a taxonomy review batch sheet without market-review self-approval', () => {
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxTaxonomyReviewBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxTaxonomyReviewBatchSheetMarkdown
    expect(createSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createSheet({ batchId: 'taxonomy-review-batch-001' })
    const markdown = exportMarkdown(sheet)
    const forceField = sheet.effects.find((effect) => effect.effectId === 'force-field')

    expect(sheet.schema).toBe('game-bot.r3f-pfx-taxonomy-review-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-taxonomy-review-batch-sheet',
      sourceDossierSchema: 'game-bot.r3f-pfx-taxonomy-review-dossier.v1',
      outputFile: '.context/r3f-pfx-taxonomy-review.json',
    })
    expect(sheet.batch).toMatchObject({
      batchId: 'taxonomy-review-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      outputFile: '.context/r3f-pfx-taxonomy-review.json',
    })
    expect(sheet.effects).toHaveLength(25)
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      marketReviewed: false,
      reviewAnchor: '.context/r3f-pfx-taxonomy-review.json#force-field',
      rankBand: 'top-25-production-staple',
      requiredCriteria: [
        'source-observed-need',
        'rank-justified',
        'family-balanced',
        'variant-compatible',
        'production-critical-coverage',
        'not-duplicate',
        'market-source-linked',
      ],
      nearbyEffectIds: expect.arrayContaining(['loot-beam', 'footstep-dust']),
      marketSourceUrls: expect.arrayContaining(PFX_TAXONOMY[8].marketSourceUrls),
      reviewPrompts: {
        'source-observed-need': expect.stringContaining('force-field'),
        'not-duplicate': expect.stringContaining('force-field'),
      },
    })
    expect(markdown).toContain('# R3F PFX Taxonomy Review Batch Sheet')
    expect(markdown).toContain('Batch: `taxonomy-review-batch-001`')
    expect(markdown).toContain('Output file: `.context/r3f-pfx-taxonomy-review.json`')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain('- [ ] Source observed need')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-taxonomy-review.json#force-field`')
    expect(markdown).toContain('Treat this handoff as non-approving market-review input.')
  })

  it('exports a non-approving taxonomy review batch sheet index for all 500 effects', () => {
    const createIndex = (PfxLibrary as Record<string, unknown>).createPfxTaxonomyReviewBatchSheetIndex
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxTaxonomyReviewBatchSheetIndexMarkdown
    expect(createIndex).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createIndex !== 'function' || typeof exportMarkdown !== 'function') return

    const index = createIndex()
    const markdown = exportMarkdown(index)

    expect(index.schema).toBe('game-bot.r3f-pfx-taxonomy-review-batch-sheet-index.v1')
    expect(index.summary).toMatchObject({
      totalBatches: 20,
      totalEffects: 500,
      outputDirectory: '.context/taxonomy-review-batches',
      approvalStatus: 'non-approving-taxonomy-review-batch-sheet-index',
    })
    expect(index.sheets).toHaveLength(20)
    expect(index.sheets[0]).toMatchObject({
      batchId: 'taxonomy-review-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      firstEffectId: 'fireball',
      lastEffectId: 'level-up-flare',
      outputFile: '.context/taxonomy-review-batches/taxonomy-review-batch-001.json',
      markdownOutputFile: '.context/taxonomy-review-batches/taxonomy-review-batch-001.md',
    })
    expect(index.sheets[19]).toMatchObject({
      batchId: 'taxonomy-review-batch-020',
      rankStart: 476,
      rankEnd: 500,
      effectCount: 25,
      firstEffectId: 'plasma-telegraph',
      lastEffectId: 'spawn-telegraph',
    })
    expect(markdown).toContain('# R3F PFX Taxonomy Review Batch Sheet Index')
    expect(markdown).toContain('Treat this index as non-approving market-review guidance.')
    expect(markdown).toContain(
      '- `taxonomy-review-batch-001` (ranks 1-25, 25 effects, `fireball` to `level-up-flare`): `.context/taxonomy-review-batches/taxonomy-review-batch-001.md`',
    )
  })

  it('attaches machine-readable market source traceability to every taxonomy effect', () => {
    expect(Object.keys(PFX_MARKET_SOURCE_REFERENCES)).toEqual(
      expect.arrayContaining([
        'unreal-niagara',
        'unity-vfx-graph',
        'unity-asset-store-vfx',
        'embergen',
        'popcornfx',
        'three-nebula',
        'three-quarks-r3f',
        'drei-r3f',
        'realtimevfx-stylized',
      ]),
    )

    for (const effect of PFX_TAXONOMY) {
      expect(effect.marketSourceFamilies.length).toBeGreaterThan(0)
      expect(effect.marketSourceUrls.length).toBe(effect.marketSourceFamilies.length)
      for (const sourceFamily of effect.marketSourceFamilies) {
        expect(PFX_MARKET_SOURCE_REFERENCES[sourceFamily]).toMatch(/^https?:\/\//)
      }
      for (const sourceUrl of effect.marketSourceUrls) {
        expect(sourceUrl).toMatch(/^https?:\/\//)
      }
    }

    expect(PFX_TAXONOMY.find((effect) => effect.id === 'fireball')?.marketSourceFamilies).toEqual(
      expect.arrayContaining(['unreal-niagara', 'unity-asset-store-vfx', 'embergen']),
    )
    expect(PFX_TAXONOMY.find((effect) => effect.id === 'slash-trail')?.marketSourceFamilies).toEqual(
      expect.arrayContaining(['realtimevfx-stylized', 'drei-r3f']),
    )
    expect(PFX_TAXONOMY.find((effect) => effect.id === 'force-field')?.marketSourceFamilies).toEqual(
      expect.arrayContaining(['popcornfx', 'three-quarks-r3f']),
    )
    expect(createPfxTaxonomyReviewTemplate().reviews[0].marketSources).toEqual(PFX_TAXONOMY[0].marketSourceUrls)
  })

  it('adds authored phase language for generated ranked effects 26-50', () => {
    const generatedAuthoredIds = [
      'embers-burst',
      'spark-loop',
      'electric-trail',
      'wind-impact',
      'acid-idle',
      'portal-charge',
      'reflect-release',
      'reward-telegraph',
      'hologram-aura',
      'blast-beam',
      'glyph-ring',
      'water-cone',
      'sand-spray',
      'curse-column',
      'spawn-screen',
      'jump-pickup',
      'target-break',
      'exhaust-hit',
      'debris-miss',
      'plasma-ambient',
      'snow-spawn',
      'poison-death',
      'ghost-critical',
      'barrier-low-health',
      'flame-charge',
    ]
    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(filterPfxCatalog({ coverage: ['authored-preview'] })).toHaveLength(500)
    expect(phases).toEqual(
      expect.arrayContaining([
        'embers-burst-particle-ignition-pop',
        'electric-trail-wake-stream',
        'acid-idle-corrosive-pool',
        'acid-idle-low-vapor',
        'portal-charge-gather-inflow',
        'reward-telegraph-warning-ring',
        'spawn-screen-avatar-assembly-lattice',
        'barrier-low-health-fractured-shell',
        'flame-charge-gather-inflow',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(45)
  })

  it('adds authored phase language for generated ranked effects 51-75', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(50, 75).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'meteor-ring',
      'shockwave-spawn',
      'dust-loop',
      'debris-release',
      'spark-cone',
      'shard-break',
      'glyph-trail',
      'beam-telegraph',
      'laser-spray',
      'plasma-hit',
      'electric-critical',
      'ice-impact',
      'frost-aura',
      'water-column',
      'snow-idle',
      'wind-beam',
      'petal-ambient',
      'sand-burst',
      'mud-charge',
      'slime-ring',
      'acid-spawn',
      'healing-loop',
      'holy-release',
      'curse-cone',
      'shadow-break',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'meteor-ring-heat-front',
        'shockwave-spawn-ground-arrival-flare',
        'shockwave-spawn-ground-fragments',
        'dust-loop-sculpted-smoke-bed',
        'dust-loop-soft-shear-wisps',
        'dust-loop-fine-suspended-grit',
        'glyph-trail-sequential-inscription-wake',
        'beam-telegraph-raised-warning-lane',
        'water-column-braided-geyser',
        'healing-loop-renewal-helix',
        'shadow-break-rupture-cluster',
      ]),
    )
    // Preserve one or more effect-specific phase names per catalog entry and
    // reject reused vocabulary without rewarding extra draw surfaces.
    expect(phases.length).toBeGreaterThanOrEqual(generatedAuthoredIds.length)
    expect(new Set(phases).size).toBe(phases.length)
  })

  it('adds authored phase language for generated ranked effects 76-100', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(75, 100).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'blood-death',
      'ghost-trail',
      'portal-telegraph',
      'warp-spray',
      'teleport-hit',
      'despawn-impact',
      'shield-aura',
      'barrier-column',
      'dash-idle',
      'jump-beam',
      'footstep-ambient',
      'pickup-burst',
      'reward-charge',
      'combo-ring',
      'ui-pickup',
      'target-spawn',
      'warning-loop',
      'marker-release',
      'scan-cone',
      'hologram-break',
      'thruster-trail',
      'exhaust-telegraph',
      'flame-burst',
      'meteor-burst',
      'blast-burst',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.flatMap((surface) =>
        [surface.phase, surface.tuning?.lifecycle, surface.tuning?.meshShader].filter(Boolean),
      ),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'blood-death-pigment-rupture',
        'ghost-trail-spectral-procession',
        'portal-telegraph-countdown-aperture',
        'shield-aura-defensive-envelope',
        'dash-idle-vector-reservoir',
        'pickup-burst-particle-collect-pop',
        'scan-cone-ground-sector',
        'scan-cone-volumetric-sweep',
        'thruster-trail-volumetric-plume',
        'exhaust-telegraph-danger-lane',
        'flame-burst-particle-upward-licks',
        'meteor-burst-particle-collision',
        'blast-burst-particle-pressure-core',
      ]),
    )
    // Authored merged meshes may deliberately consolidate several lifecycle
    // roles into one phase to keep persistent effects mobile-safe.
    expect(new Set(phases).size).toBeGreaterThanOrEqual(50)
  })

  it('adds authored phase language for generated ranked effects 101-125', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(100, 125).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'shockwave-burst',
      'dust-burst',
      'debris-burst',
      'spark-burst',
      'shard-burst',
      'rune-burst',
      'glyph-burst',
      'beam-burst',
      'laser-burst',
      'plasma-burst',
      'electric-burst',
      'ice-burst',
      'frost-burst',
      'water-burst',
      'bubble-burst',
      'rain-burst',
      'snow-burst',
      'wind-burst',
      'leaf-burst',
      'petal-burst',
      'mud-burst',
      'slime-burst',
      'poison-burst',
      'acid-burst',
      'healing-burst',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'shockwave-burst-bowed-pressure-front',
        'dust-burst-radial-rolling-crown',
        'debris-burst-asymmetric-breakup',
        'rune-burst-script-flash',
        'beam-burst-core-lance',
        'plasma-burst-ion-core',
        'water-burst-splash-ring',
        'snow-burst-radial-crystal-bloom',
        'poison-burst-particle-bruised-cloud',
        'healing-burst-reference-cross-motes',
      ]),
    )
    // Healing burst intentionally uses a small authored particle vocabulary,
    // with the cross, halo, and seed release carrying separate timing jobs.
    expect(new Set(phases).size).toBeGreaterThanOrEqual(57)
  })

  it('adds authored phase language for generated ranked effects 126-150', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(125, 150).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'holy-burst',
      'curse-burst',
      'shadow-burst',
      'blood-burst',
      'ghost-burst',
      'portal-burst',
      'warp-burst',
      'teleport-burst',
      'spawn-burst',
      'despawn-burst',
      'shield-burst',
      'barrier-burst',
      'reflect-burst',
      'parry-burst',
      'dash-burst',
      'jump-burst',
      'landing-burst',
      'footstep-burst',
      'reward-burst',
      'combo-burst',
      'ui-burst',
      'target-burst',
      'warning-burst',
      'marker-burst',
      'scan-burst',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'holy-burst-reference-sun-flare',
        'curse-burst-particle-void-knot',
        'portal-burst-vortex-rim',
        'teleport-burst-arrival-ring',
        'shield-burst-shell-flash',
        'dash-burst-speed-pop',
        'reward-burst-screen-prize',
        'target-burst-reticle-open',
        'warning-burst-alert-ring',
        'scan-burst-data-sweep',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 151-175', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(150, 175).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'hologram-burst',
      'engine-burst',
      'thruster-burst',
      'exhaust-burst',
      'embers-loop',
      'flame-loop',
      'debris-loop',
      'shard-loop',
      'rune-loop',
      'glyph-loop',
      'beam-loop',
      'laser-loop',
      'plasma-loop',
      'electric-loop',
      'ice-loop',
      'frost-loop',
      'water-loop',
      'bubble-loop',
      'rain-loop',
      'snow-loop',
      'wind-loop',
      'leaf-loop',
      'petal-loop',
      'sand-loop',
      'mud-loop',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'hologram-burst-projection-flash',
        'engine-burst-ignition-core',
        'embers-loop-ground-circle',
        'flame-loop-core-licks',
        'rune-loop-ground-circle',
        'beam-loop-ground-circle',
        'plasma-loop-ground-circle',
        'bubble-loop-ambient-haze',
        'rain-loop-ambient-haze',
        'mud-loop-body-cling',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 176-200', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(175, 200).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'slime-loop',
      'poison-loop',
      'acid-loop',
      'holy-loop',
      'curse-loop',
      'shadow-loop',
      'blood-loop',
      'ghost-loop',
      'portal-loop',
      'warp-loop',
      'teleport-loop',
      'spawn-loop',
      'despawn-loop',
      'shield-loop',
      'barrier-loop',
      'reflect-loop',
      'parry-loop',
      'dash-loop',
      'jump-loop',
      'landing-loop',
      'footstep-loop',
      'pickup-loop',
      'reward-loop',
      'combo-loop',
      'ui-loop',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'slime-loop-body-cling',
        'poison-loop-body-cling',
        'acid-loop-body-cling',
        'holy-loop-ground-circle',
        'curse-loop-body-cling',
        'shadow-loop-body-cling',
        'portal-loop-vortex-disc',
        'shield-loop-ground-circle',
        'dash-loop-ground-circle',
        'pickup-loop-ground-circle',
        'ui-loop-ground-circle',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 201-225', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(200, 225).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'target-loop',
      'marker-loop',
      'scan-loop',
      'hologram-loop',
      'engine-loop',
      'thruster-loop',
      'exhaust-loop',
      'embers-trail',
      'flame-trail',
      'meteor-trail',
      'blast-trail',
      'shockwave-trail',
      'dust-trail',
      'debris-trail',
      'spark-trail',
      'shard-trail',
      'rune-trail',
      'beam-trail',
      'laser-trail',
      'plasma-trail',
      'ice-trail',
      'frost-trail',
      'water-trail',
      'bubble-trail',
      'rain-trail',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'target-loop-ground-circle',
        'marker-loop-ground-circle',
        'scan-loop-ground-circle',
        'hologram-loop-ground-circle',
        'engine-loop-ambient-haze',
        'thruster-loop-ground-circle',
        'embers-trail-wake-stream',
        'flame-trail-wake-stream',
        'meteor-trail-wake-stream',
        'shockwave-trail-pressure-body',
        'rune-trail-mote-wake',
        'plasma-trail-wake-stream',
        'rain-trail-wake-stream',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 226-250', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(225, 250).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'snow-trail',
      'wind-trail',
      'leaf-trail',
      'petal-trail',
      'sand-trail',
      'mud-trail',
      'slime-trail',
      'poison-trail',
      'acid-trail',
      'healing-trail',
      'holy-trail',
      'curse-trail',
      'shadow-trail',
      'blood-trail',
      'portal-trail',
      'warp-trail',
      'teleport-trail',
      'spawn-trail',
      'despawn-trail',
      'shield-trail',
      'barrier-trail',
      'reflect-trail',
      'parry-trail',
      'dash-trail',
      'jump-trail',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'snow-trail-wake-stream',
        'wind-trail-wake-stream',
        'leaf-trail-wake-stream',
        'sand-trail-wake-stream',
        'poison-trail-wake-stream',
        'healing-trail-mote-wake',
        'curse-trail-wake-stream',
        'portal-trail-wake-stream',
        'shield-trail-mote-wake',
        'reflect-trail-speed-ribbon',
        'dash-trail-speed-ribbon',
        'jump-trail-speed-ribbon',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 251-275', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(250, 275).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'landing-trail',
      'footstep-trail',
      'target-trail',
      'warning-trail',
      'marker-trail',
      'scan-trail',
      'hologram-trail',
      'engine-trail',
      'exhaust-trail',
      'embers-impact',
      'flame-impact',
      'meteor-impact',
      'blast-impact',
      'shockwave-impact',
      'dust-impact',
      'debris-impact',
      'spark-impact',
      'shard-impact',
      'rune-impact',
      'glyph-impact',
      'beam-impact',
      'laser-impact',
      'plasma-impact',
      'electric-impact',
      'frost-impact',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'landing-trail-ground-footprints',
        'footstep-trail-ground-footprints',
        'target-trail-mote-wake',
        'warning-trail-mote-wake',
        'scan-trail-mote-wake',
        'hologram-trail-mote-wake',
        'engine-trail-wake-stream',
        'embers-impact-cinder-pop',
        'meteor-impact-molten-core',
        'shockwave-impact-radius-front',
        'dust-impact-ground-cloud',
        'rune-impact-script-flash',
        'plasma-impact-ion-core',
        'frost-impact-crystal-mist',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 276-300', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(275, 300).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'water-impact',
      'snow-impact',
      'leaf-impact',
      'petal-impact',
      'sand-impact',
      'mud-impact',
      'slime-impact',
      'poison-impact',
      'acid-impact',
      'holy-impact',
      'curse-impact',
      'shadow-impact',
      'blood-impact',
      'ghost-impact',
      'portal-impact',
      'warp-impact',
      'teleport-impact',
      'shield-impact',
      'barrier-impact',
      'reflect-impact',
      'parry-impact',
      'dash-impact',
      'jump-impact',
      'landing-impact',
      'footstep-impact',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'water-impact-splash-cap',
        'snow-impact-powder-bloom',
        'leaf-impact-leaf-scatter',
        'sand-impact-grain-burst',
        'mud-impact-heavy-splat',
        'poison-impact-toxic-puff',
        'acid-impact-corrosive-spit',
        'holy-impact-sanctified-flare',
        'curse-impact-hex-fracture',
        'shadow-impact-void-smear',
        'portal-impact-vortex-flash',
        'teleport-impact-arrival-ring',
        'shield-impact-shell-wave',
        'parry-impact-counter-spark',
        'dash-impact-speed-pop',
        'footstep-impact-ground-puff',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 301-325', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(300, 325).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'target-impact',
      'warning-impact',
      'marker-impact',
      'scan-impact',
      'hologram-impact',
      'engine-impact',
      'thruster-impact',
      'exhaust-impact',
      'embers-idle',
      'flame-idle',
      'dust-idle',
      'debris-idle',
      'spark-idle',
      'shard-idle',
      'rune-idle',
      'glyph-idle',
      'beam-idle',
      'laser-idle',
      'plasma-idle',
      'electric-idle',
      'ice-idle',
      'frost-idle',
      'water-idle',
      'bubble-idle',
      'rain-idle',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'target-impact-reticle-pop',
        'warning-impact-alert-flash',
        'marker-impact-anchor-ping',
        'scan-impact-data-burst',
        'hologram-impact-projection-glitch',
        'engine-impact-heat-knock',
        'thruster-impact-ignition-pop',
        'exhaust-impact-soot-puff',
        'embers-idle-element-traffic',
        'flame-idle-core-licks',
        'dust-idle-element-traffic',
        'spark-idle-element-traffic',
        'rune-idle-element-traffic',
        'beam-idle-element-traffic',
        'plasma-idle-element-traffic',
        'rain-idle-element-traffic',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(57)
  })

  it('adds authored phase language for generated ranked effects 326-350', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(325, 350).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'wind-idle',
      'leaf-idle',
      'petal-idle',
      'sand-idle',
      'mud-idle',
      'slime-idle',
      'poison-idle',
      'healing-idle',
      'holy-idle',
      'curse-idle',
      'shadow-idle',
      'blood-idle',
      'ghost-idle',
      'portal-idle',
      'warp-idle',
      'teleport-idle',
      'spawn-idle',
      'despawn-idle',
      'shield-idle',
      'barrier-idle',
      'reflect-idle',
      'parry-idle',
      'jump-idle',
      'landing-idle',
      'footstep-idle',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'wind-idle-element-traffic',
        'leaf-idle-element-traffic',
        'petal-idle-element-traffic',
        'sand-idle-element-traffic',
        'mud-idle-element-traffic',
        'slime-idle-element-traffic',
        'poison-idle-element-traffic',
        'healing-idle-element-traffic',
        'holy-idle-element-traffic',
        'curse-idle-element-traffic',
        'shadow-idle-element-traffic',
        'blood-idle-element-traffic',
        'ghost-idle-element-traffic',
        'portal-idle-vortex-disc',
        'warp-idle-element-traffic',
        'teleport-idle-element-traffic',
        'shield-idle-element-traffic',
        'reflect-idle-element-traffic',
        'parry-idle-element-traffic',
        'footstep-idle-element-traffic',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(50) // loop-pass: idles are deliberately 2 layers (strictest budget class)
  })

  it('adds authored phase language for generated ranked effects 351-375', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(350, 375).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'pickup-idle',
      'reward-idle',
      'combo-idle',
      'ui-idle',
      'target-idle',
      'warning-idle',
      'marker-idle',
      'scan-idle',
      'hologram-idle',
      'engine-idle',
      'thruster-idle',
      'exhaust-idle',
      'embers-charge',
      'meteor-charge',
      'blast-charge',
      'shockwave-charge',
      'dust-charge',
      'debris-charge',
      'spark-charge',
      'shard-charge',
      'rune-charge',
      'glyph-charge',
      'beam-charge',
      'laser-charge',
      'plasma-charge',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'pickup-idle-element-traffic',
        'reward-idle-element-traffic',
        'combo-idle-element-traffic',
        'ui-idle-element-traffic',
        'target-idle-element-traffic',
        'warning-idle-element-traffic',
        'marker-idle-element-traffic',
        'scan-idle-element-traffic',
        'hologram-idle-element-traffic',
        'engine-idle-element-traffic',
        'thruster-idle-element-traffic',
        'exhaust-idle-element-traffic',
        'embers-charge-gather-inflow',
        'meteor-charge-gather-inflow',
        'blast-charge-pressure-build',
        'shockwave-charge-radius-load',
        'dust-charge-gather-inflow',
        'spark-charge-ignition-pop',
        'rune-charge-gather-inflow',
        'beam-charge-gather-inflow',
        'plasma-charge-gather-inflow',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 376-400', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(375, 400).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'electric-charge',
      'ice-charge',
      'frost-charge',
      'water-charge',
      'snow-charge',
      'wind-charge',
      'sand-charge',
      'slime-charge',
      'poison-charge',
      'acid-charge',
      'healing-charge',
      'holy-charge',
      'curse-charge',
      'shadow-charge',
      'blood-charge',
      'ghost-charge',
      'warp-charge',
      'teleport-charge',
      'spawn-charge',
      'despawn-charge',
      'shield-charge',
      'barrier-charge',
      'reflect-charge',
      'parry-charge',
      'dash-charge',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'electric-charge-voltage-inflow',
        'ice-charge-gather-inflow',
        'frost-charge-gather-inflow',
        'water-charge-gather-inflow',
        'snow-charge-gather-inflow',
        'wind-charge-gather-inflow',
        'sand-charge-gather-inflow',
        'slime-charge-gather-inflow',
        'poison-charge-gather-inflow',
        'acid-charge-gather-inflow',
        'healing-charge-gather-inflow',
        'holy-charge-gather-inflow',
        'curse-charge-gather-inflow',
        'shadow-charge-gather-inflow',
        'blood-charge-gather-inflow',
        'ghost-charge-gather-inflow',
        'warp-charge-gather-inflow',
        'teleport-charge-gather-inflow',
        'shield-charge-gather-inflow',
        'reflect-charge-ignition-pop',
        'parry-charge-ignition-pop',
        'dash-charge-ignition-pop',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(60)
  })

  it('adds authored phase language for generated ranked effects 401-425', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(400, 425).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'jump-charge',
      'landing-charge',
      'combo-charge',
      'target-charge',
      'warning-charge',
      'marker-charge',
      'scan-charge',
      'hologram-charge',
      'engine-charge',
      'thruster-charge',
      'exhaust-charge',
      'embers-release',
      'flame-release',
      'meteor-release',
      'blast-release',
      'shockwave-release',
      'dust-release',
      'spark-release',
      'shard-release',
      'rune-release',
      'glyph-release',
      'beam-release',
      'laser-release',
      'plasma-release',
      'electric-release',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'jump-charge-ignition-pop',
        'landing-charge-gather-inflow',
        'combo-charge-ignition-pop',
        'target-charge-ignition-pop',
        'warning-charge-ignition-pop',
        'marker-charge-ignition-pop',
        'scan-charge-ignition-pop',
        'hologram-charge-ignition-pop',
        'engine-charge-gather-inflow',
        'thruster-charge-gather-inflow',
        'exhaust-charge-gather-inflow',
        'embers-release-launch-flash',
        'flame-release-launch-flash',
        'meteor-release-launch-flash',
        'blast-release-pressure-front',
        'shockwave-release-radius-front',
        'dust-release-launch-flash',
        'spark-release-launch-flash',
        'rune-release-launch-flash',
        'beam-release-launch-flash',
        'plasma-release-launch-flash',
        'electric-release-arc-fan',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(62)
  })

  it('adds authored phase language for generated ranked effects 426-450', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(425, 450).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'ice-release',
      'frost-release',
      'water-release',
      'bubble-release',
      'rain-release',
      'snow-release',
      'wind-release',
      'leaf-release',
      'petal-release',
      'sand-release',
      'mud-release',
      'slime-release',
      'poison-release',
      'acid-release',
      'healing-release',
      'curse-release',
      'shadow-release',
      'blood-release',
      'ghost-release',
      'portal-release',
      'warp-release',
      'teleport-release',
      'spawn-release',
      'despawn-release',
      'shield-release',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'ice-release-launch-flash',
        'frost-release-launch-flash',
        'water-release-launch-flash',
        'bubble-release-launch-flash',
        'rain-release-launch-flash',
        'snow-release-launch-flash',
        'wind-release-launch-flash',
        'leaf-release-launch-flash',
        'petal-release-launch-flash',
        'sand-release-launch-flash',
        'mud-release-launch-flash',
        'slime-release-launch-flash',
        'poison-release-launch-flash',
        'acid-release-launch-flash',
        'healing-release-launch-flash',
        'curse-release-launch-flash',
        'shadow-release-launch-flash',
        'blood-release-launch-flash',
        'ghost-release-launch-flash',
        'portal-release-launch-flash',
        'warp-release-launch-flash',
        'teleport-release-launch-flash',
        'spawn-release-launch-flash',
        'despawn-release-launch-flash',
        'shield-release-launch-flash',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(62)
  })

  it('adds authored phase language for generated ranked effects 451-475', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(450, 475).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'barrier-release',
      'parry-release',
      'dash-release',
      'jump-release',
      'landing-release',
      'footstep-release',
      'target-release',
      'warning-release',
      'scan-release',
      'hologram-release',
      'engine-release',
      'thruster-release',
      'exhaust-release',
      'embers-telegraph',
      'flame-telegraph',
      'meteor-telegraph',
      'blast-telegraph',
      'shockwave-telegraph',
      'dust-telegraph',
      'debris-telegraph',
      'spark-telegraph',
      'shard-telegraph',
      'rune-telegraph',
      'glyph-telegraph',
      'laser-telegraph',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'barrier-release-launch-flash',
        'parry-release-launch-flash',
        'dash-release-launch-fan',
        'jump-release-launch-fan',
        'landing-release-launch-fan',
        'footstep-release-launch-fan',
        'target-release-launch-flash',
        'warning-release-launch-flash',
        'scan-release-launch-flash',
        'hologram-release-launch-flash',
        'engine-release-launch-flash',
        'thruster-release-launch-flash',
        'exhaust-release-launch-flash',
        'embers-telegraph-warning-ring',
        'flame-telegraph-warning-ring',
        'meteor-telegraph-warning-ring',
        'blast-telegraph-pressure-warning',
        'shockwave-telegraph-radius-warning',
        'dust-telegraph-ground-stamp',
        'debris-telegraph-ground-stamp',
        'spark-telegraph-warning-ring',
        'shard-telegraph-warning-ring',
        'rune-telegraph-warning-ring',
        'glyph-telegraph-warning-ring',
        'laser-telegraph-ground-stamp',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(62)
  })

  it('adds authored phase language for generated ranked effects 476-500', () => {
    const generatedAuthoredIds = PFX_TAXONOMY.slice(475, 500).map((effect) => effect.id)
    expect(generatedAuthoredIds).toEqual([
      'plasma-telegraph',
      'electric-telegraph',
      'ice-telegraph',
      'frost-telegraph',
      'water-telegraph',
      'bubble-telegraph',
      'rain-telegraph',
      'snow-telegraph',
      'wind-telegraph',
      'leaf-telegraph',
      'petal-telegraph',
      'sand-telegraph',
      'mud-telegraph',
      'slime-telegraph',
      'poison-telegraph',
      'acid-telegraph',
      'healing-telegraph',
      'holy-telegraph',
      'curse-telegraph',
      'shadow-telegraph',
      'blood-telegraph',
      'ghost-telegraph',
      'warp-telegraph',
      'teleport-telegraph',
      'spawn-telegraph',
    ])

    const phases = generatedAuthoredIds.flatMap((id) =>
      getPfxRenderPlan(createPfxPreset(id)).surfaces.map((surface) => surface.phase),
    )

    expect(phases).toEqual(
      expect.arrayContaining([
        'plasma-telegraph-ground-stamp',
        'electric-telegraph-warning-ring',
        'ice-telegraph-warning-ring',
        'frost-telegraph-warning-ring',
        'water-telegraph-warning-ring',
        'bubble-telegraph-warning-ring',
        'rain-telegraph-warning-ring',
        'snow-telegraph-warning-ring',
        'wind-telegraph-warning-ring',
        'leaf-telegraph-warning-ring',
        'petal-telegraph-warning-ring',
        'sand-telegraph-warning-ring',
        'mud-telegraph-warning-ring',
        'slime-telegraph-warning-ring',
        'poison-telegraph-warning-ring',
        'acid-telegraph-warning-ring',
        'healing-telegraph-warning-ring',
        'holy-telegraph-warning-ring',
        'curse-telegraph-warning-ring',
        'shadow-telegraph-warning-ring',
        'blood-telegraph-warning-ring',
        'ghost-telegraph-warning-ring',
        'warp-telegraph-ground-stamp',
        'teleport-telegraph-ground-stamp',
        'spawn-telegraph-warning-ring',
      ]),
    )
    expect(new Set(phases).size).toBeGreaterThanOrEqual(62)
  })

  it('uses authored recipe phase and opacity as render material inputs', () => {
    const forceField = createPfxPreset('force-field')
    const plan = getPfxRenderPlan(forceField)

    expect(plan.surfaces.map((surface) => surface.phase)).toEqual(
      expect.arrayContaining(['shield-boundary', 'surface-sparks']),
    )
    // The shield boundary is the dedicated animated energy-scan sphere, not a flat ring.
    expect(plan.surfaces.find((surface) => surface.phase === 'shield-boundary')?.tuning?.meshShader).toBe('force-field-shell')
    expect(new Set(plan.surfaces.map((surface) => surface.opacity)).size).toBeGreaterThan(1)

    const materialProps = plan.surfaces.map((surface) => getPfxSurfaceMaterialProps(surface, forceField.controls))
    expect(materialProps.map((props) => props.opacity)).toEqual(
      plan.surfaces.map((surface) =>
        Math.round(surface.opacity * getPfxStyleRenderProfile(forceField.controls.style).opacityMultiplier * 100) / 100,
      ),
    )
    expect(new Set(materialProps.map((props) => props.color)).size).toBeGreaterThan(1)
  })

  it('uses a dedicated animated energy-scan shader for the hero force field', () => {
    const forceField = getPfxRenderPlan(createPfxPreset('force-field'))
    const shieldBoundary = forceField.surfaces.find((surface) => surface.phase === 'shield-boundary')!
    const shieldAura = getPfxRenderPlan(createPfxPreset('shield-aura'))
      .surfaces.find((surface) => surface.phase === 'shield-aura-defensive-envelope')!

    expect(shieldBoundary.tuning?.meshShader).toBe('force-field-shell')
    expect(shieldAura.tuning?.meshShader).toBe('hex-shell')
  })

  it('gives every art style a runtime render signature beyond palette recoloring', () => {
    const styledPresets = ART_STYLE_CLUSTERS.map((style) => createPfxPreset('force-field', { style }))
    const styleProfiles = styledPresets.map((preset) => getPfxStyleRenderProfile(preset.controls.style))
    const nonColorSignatures = styledPresets.map((preset) => getPfxStyleRenderSignature(preset.controls))

    expect(styleProfiles).toHaveLength(17)
    expect(new Set(styleProfiles.map((profile) => profile.silhouette)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(styleProfiles.map((profile) => profile.materialTreatment)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(styleProfiles.map((profile) => profile.motionTreatment)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(nonColorSignatures).size).toBeGreaterThanOrEqual(15)
    expect(nonColorSignatures.every((signature) => !signature.includes('#'))).toBe(true)

    const pixel = getPfxStyleRenderProfile('pixel-retro')
    expect(pixel).toMatchObject({
      particleShape: 'square',
      materialTreatment: 'crisp-indexed',
      geometrySegments: 8,
    })

    const realistic = getPfxStyleRenderProfile('realistic')
    expect(realistic).toMatchObject({
      particleShape: 'soft',
      materialTreatment: 'subtle-alpha',
      geometrySegments: 24,
    })

    const neon = getPfxStyleRenderProfile('neon')
    expect(neon).toMatchObject({
      materialTreatment: 'neon-bloom',
      motionTreatment: 'electric-pulse',
    })
  })

  it('exports style render signatures through presets and preview manifests', () => {
    const pixelForceField = createPfxPreset('force-field', { style: 'pixel-retro' })
    const presetJson = JSON.parse(exportPfxPresetJson(pixelForceField))
    const manifest = createPfxPreviewManifest([pixelForceField])

    expect(pixelForceField.styleRender).toMatchObject({
      signature: getPfxStyleRenderSignature(pixelForceField.controls),
      particleShape: 'square',
      materialTreatment: 'crisp-indexed',
    })
    expect(presetJson.styleRender.signature).toBe(pixelForceField.styleRender.signature)
    expect(presetJson.styleRender.signature).not.toContain('#')
    expect(manifest.effects[0].styleRender).toMatchObject(pixelForceField.styleRender)
  })

  it('maps flipbook and authored phase controls to runtime animation props', () => {
    const fireball = createPfxPreset('fireball')
    const flameStart = getPfxFlipbookFrameProps({ ...fireball.controls, flipbook: 'flame-8' }, 0)
    const flameLater = getPfxFlipbookFrameProps({ ...fireball.controls, flipbook: 'flame-8' }, 0.42)
    const noFlipbook = getPfxFlipbookFrameProps({ ...fireball.controls, flipbook: 'none' }, 0.42)

    expect(flameStart.frameCount).toBe(8)
    expect(flameLater.frameIndex).not.toBe(flameStart.frameIndex)
    expect(flameLater.uvOffset[0]).toBeGreaterThanOrEqual(0)
    expect(flameLater.opacityMultiplier).not.toBe(noFlipbook.opacityMultiplier)
    expect(noFlipbook.frameCount).toBe(1)

    const firePlan = getPfxRenderPlan(fireball)
    const forceFieldPlan = getPfxRenderPlan(createPfxPreset('force-field'))
    const rewardPlan = getPfxRenderPlan(createPfxPreset('ui-reward-burst'))
    const flameTail = firePlan.surfaces.find((surface) => surface.phase === 'flame-trail')
    const shieldBoundary = forceFieldPlan.surfaces.find((surface) => surface.phase === 'shield-boundary')
    const rewardFlash = rewardPlan.surfaces.find((surface) => surface.phase === 'ui-reward-cascade-flash')
    expect(flameTail).toBeTruthy()
    expect(shieldBoundary).toBeTruthy()
    expect(rewardFlash).toBeTruthy()

    const flameMotion = getPfxSurfaceAnimationProps(flameTail!, fireball.controls, 0.5)
    const shieldMotion = getPfxSurfaceAnimationProps(shieldBoundary!, createPfxPreset('force-field').controls, 0.5)
    const rewardMotion = getPfxSurfaceAnimationProps(rewardFlash!, createPfxPreset('ui-reward-burst').controls, 0.5)

    expect(flameMotion.xOffset).toBe(0)
    expect(flameMotion.signature).toContain('projectile-lifecycle')
    expect(shieldMotion.signature).not.toBe(flameMotion.signature)
    // Cascade flash: a 1-3 frame burst-flash envelope replaced the old
    // persistent screen-pulse plane (screen spec: flashes are brief).
    expect(rewardMotion.signature.startsWith('burst-flash')).toBe(true)
    expect(new Set([flameMotion.signature, shieldMotion.signature, rewardMotion.signature]).size).toBe(3)
  })

  it('shapes the comet tail as a shrinking non-coplanar teardrop instead of coplanar fins', () => {
    const lobes = PfxLibrary.PFX_PROJECTILE_COMET_TAIL_LOBES as Array<{
      offset: [number, number, number]
      size: number
    }>
    expect(lobes.length).toBeGreaterThanOrEqual(5)
    for (let index = 1; index < lobes.length; index += 1) {
      // Strictly shrinking toward the tail: the taper is what sells a comet
      // body; equal-size lobes read as separate blobs.
      expect(lobes[index]!.size).toBeLessThan(lobes[index - 1]!.size)
      // Strictly receding along the travel axis.
      expect(lobes[index]!.offset[0]).toBeLessThan(lobes[index - 1]!.offset[0])
    }
    // Non-coplanar: lobes must occupy depth so the tail survives side cameras.
    expect(Math.max(...lobes.map((lobe) => Math.abs(lobe.offset[2])))).toBeGreaterThanOrEqual(0.08)
    expect(new Set(lobes.map((lobe) => Math.sign(lobe.offset[2]))).size).toBeGreaterThanOrEqual(2)
  })

  it('spreads smoke billow lobes through depth with varied sizes instead of a camera-plane cluster', () => {
    const lobes = PfxLibrary.PFX_SMOKE_BILLOW_LOBES as Array<{
      offset: [number, number, number]
      size: number
    }>
    expect(lobes.length).toBeGreaterThanOrEqual(6)
    const zs = lobes.map((lobe) => lobe.offset[2])
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThanOrEqual(0.6)
    const sizes = lobes.map((lobe) => lobe.size)
    expect(Math.min(...sizes) / Math.max(...sizes)).toBeLessThanOrEqual(0.6)
  })

  it('publishes the original generated muzzle atlas with explicit provenance and eight isolated cells', () => {
    const atlas = PfxLibrary.PFX_MUZZLE_FLASH_ATLAS as unknown as {
      dataUri: string
      sourceSha256: string
      runtimeSha256: string
      slices: Record<string, { u: number; v: number; w: number; h: number; role: string }>
    }

    expect(atlas.dataUri).toMatch(/^data:image\/png;base64,/)
    expect(atlas.sourceSha256).toBe('b3bc72b4d0df30c9b51632a75dc25d0de895b41ecf2003b20e706c2259550f3d')
    expect(atlas.runtimeSha256).toBe('edc0027b2a8c63671de3c4473c8381e9139b4dee37c9dc7eeb7b15af828cdb0c')
    expect(Object.keys(atlas.slices)).toHaveLength(8)
    expect(Object.values(atlas.slices).filter((slice) => slice.role === 'directional')).toHaveLength(4)
    expect(Object.values(atlas.slices).filter((slice) => slice.role === 'radial')).toHaveLength(4)
  })

  it('gives the first-five rework batch decay-phase matter and distinct layer vocabularies', () => {
    // Projectile spec (Notion: Projectile VFX Spec — Traveling Bodies):
    // fireball is a held note at the researched mobile floor — core + trail
    // + glow, exactly the tier-low 3 draw calls. The trail is the dodge read:
    // dominant matter dies fast (~0.25s budget → lifeScale well under 1),
    // alpha-eroded, dark-ramped so its tail end carries the cooled-matter
    // read without a deletable-first smoke/ember layer.
    const fireball = getPfxRenderPlan(createPfxPreset('fireball'))
    expect(fireball.feelVersion).toBe(2)
    // Hero projectile component stack (tier medium): lick trail, red heat
    // glow, burning two-layer core (fire-body + advected fire-erode shell).
    // The shell-flame particle coat was review-cut — the eroded shader IS
    // the head's fire read.
    expect(fireball.surfaces).toHaveLength(3)
    expect(createPfxPreset('fireball').performance.tier).toBe('medium')
    expect(fireball.surfaces.some((surface) => surface.phase === 'head-fire')).toBe(false)
    // Review-directed single trail: a beaded line of authored calligraphic
    // 'lick' sprites (procedural:flame-lick atlas cell) shed from the rear
    // of the body — discrete tongues with gaps, per the hero reference.
    const trail = fireball.surfaces.find((surface) => surface.phase === 'flame-trail')
    expect(trail, 'fireball needs the single lick trail').toBeTruthy()
    expect(trail!.tuning?.motion).toBe('trail-stream')
    expect(trail!.tuning?.sprite).toBe('lick')
    // Redder-orange base than the palette (raw override) so the hot ramp
    // lands yellow -> orange-red -> dark tips per the reference.
    expect(trail!.tuning?.colorOverride).toBe('#f04206')
    // held ramp: additive stacking saturates any tint toward white, so the
    // red-orange survives via controlled overlap, not ramp gymnastics.
    expect(trail!.tuning?.ramp).toBe('held')
    expect(trail!.tuning?.spawnOffset?.[0] ?? 0).toBeLessThan(0)
    expect(trail!.tuning?.speedJitter ?? Infinity).toBeLessThanOrEqual(0.25)
    expect(trail!.tuning?.streamSpread ?? Infinity).toBeLessThanOrEqual(0.34)
    expect(trail!.tuning?.countScale ?? 0).toBeGreaterThanOrEqual(0.88)
    expect(trail!.tuning?.lifeScale ?? Infinity).toBeLessThanOrEqual(0.42)
    expect(PfxLibrary.PFX_SPRITE_SLICES.lick.source).toBe('procedural:flame-lick')
    const glow = fireball.surfaces.find((surface) => surface.phase === 'heat-glow')
    expect(glow, 'fireball needs the persistent value-range glow').toBeTruthy()
    expect(glow!.tuning?.meshMotion).toBe('glow')
    // Review: compact RED halo (raw override — the palette has no red).
    expect(glow!.tuning?.colorOverride).toBe('#e02f10')
    // Compact halo: stays under the old 1.35 wash even after Fer's live
    // tuning bump (plan scale includes the style multiplier).
    expect(glow!.scale).toBeLessThan(1.2)
    const core = fireball.surfaces.find((surface) => surface.phase === 'hot-core')
    expect(core, 'fireball needs the hitbox-honest hot core').toBeTruthy()
    expect(core!.tuning?.meshMotion).toBe('travel')
    // The head itself burns: fire-body shader, not flat paint.
    expect(core!.tuning?.meshShader).toBe('fire-body')
    // Held note, not a burst: ignition rises into one authored peak, settles
    // into a lower sustain, and never slides the hitbox or turns it off.
    const controls = createPfxPreset('fireball').controls
    const coreOnset = getPfxSurfaceAnimationProps(core!, controls, 0.12, 1, 1, 2)
    const corePeak = getPfxSurfaceAnimationProps(core!, controls, 0.2, 1, 1, 2)
    const coreDecay = getPfxSurfaceAnimationProps(core!, controls, 0.32, 1, 1, 2)
    const coreSustain = getPfxSurfaceAnimationProps(core!, controls, 0.62, 1, 1, 2)
    expect(corePeak.signature).toContain('projectile-lifecycle')
    expect(coreOnset.xOffset).toBe(0)
    expect(corePeak.xOffset).toBe(0)
    expect(coreSustain.xOffset).toBe(0)
    expect(corePeak.scaleMultiplier).toBeGreaterThan(coreOnset.scaleMultiplier)
    expect(corePeak.scaleMultiplier - coreDecay.scaleMultiplier).toBeGreaterThan(0.16)
    expect(corePeak.scaleMultiplier).toBeGreaterThan(coreSustain.scaleMultiplier)
    expect(corePeak.opacityMultiplier).toBeGreaterThan(coreOnset.opacityMultiplier)
    expect(coreDecay.opacityMultiplier).toBeLessThanOrEqual(0.68)
    expect(corePeak.opacityMultiplier).toBeGreaterThan(coreSustain.opacityMultiplier)
    expect(coreSustain.opacityMultiplier).toBeGreaterThan(0.55)

    const glowOnset = getPfxSurfaceAnimationProps(glow!, controls, 0.12, 1, 1, 2)
    const glowPeak = getPfxSurfaceAnimationProps(glow!, controls, 0.2, 1, 1, 2)
    const glowDecay = getPfxSurfaceAnimationProps(glow!, controls, 0.32, 1, 1, 2)
    const glowSustain = getPfxSurfaceAnimationProps(glow!, controls, 0.62, 1, 1, 2)
    expect(glowPeak.signature).toContain('projectile-lifecycle')
    expect(glowPeak.opacityMultiplier).toBeGreaterThan(glowOnset.opacityMultiplier)
    expect(glowDecay.opacityMultiplier).toBeLessThanOrEqual(0.64)
    expect(glowPeak.opacityMultiplier).toBeGreaterThan(glowSustain.opacityMultiplier)

    const trailOnset = getPfxSurfaceAnimationProps(trail!, controls, 0.12, 1, 1, 2)
    const trailPeak = getPfxSurfaceAnimationProps(trail!, controls, 0.2, 1, 1, 2)
    const trailDecay = getPfxSurfaceAnimationProps(trail!, controls, 0.32, 1, 1, 2)
    const trailSustain = getPfxSurfaceAnimationProps(trail!, controls, 0.62, 1, 1, 2)
    expect(trailPeak.signature).toContain('projectile-lifecycle')
    expect(trailPeak.scaleMultiplier).toBeGreaterThan(trailOnset.scaleMultiplier)
    expect(trailPeak.scaleMultiplier).toBeGreaterThan(trailSustain.scaleMultiplier)
    expect(trailPeak.opacityMultiplier).toBeGreaterThan(trailOnset.opacityMultiplier)
    expect(trailDecay.opacityMultiplier).toBeLessThanOrEqual(0.72)
    expect(trailPeak.opacityMultiplier).toBeGreaterThan(trailSustain.opacityMultiplier)

    const smokePuff = getPfxRenderPlan(createPfxPreset('smoke-puff'))
    const puffBody = smokePuff.surfaces.find((surface) => surface.phase === 'puff-bloom')
    const wisps = smokePuff.surfaces.find((surface) => surface.phase === 'wisp-breakup')
    expect(smokePuff.estimatedDrawCalls).toBe(3)
    expect(smokePuff.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(smokePuff.surfaces.some((surface) => surface.kind === 'smoke-billows')).toBe(false)
    expect(new Set(smokePuff.surfaces.map((surface) => surface.phase)).size).toBe(3)
    expect(puffBody?.tuning?.sprite).toBe('smoke-variants')
    expect(puffBody?.tuning?.countScale ?? Infinity).toBeLessThanOrEqual(0.24)
    expect(smokePuff.surfaces.every((surface) => surface.tuning?.death === undefined)).toBe(true)
    expect(wisps, 'smoke-puff needs a small-wisp breakup layer').toBeTruthy()
    expect(wisps!.tuning?.blend).toBe('alpha')
    expect(wisps!.tuning?.motion).toBe('column-rise')
    expect(wisps!.tuning?.delay ?? 0).toBeGreaterThanOrEqual(0.14)
    expect(Math.max(...(wisps!.tuning?.size ?? [Infinity, Infinity, Infinity]))).toBeLessThanOrEqual(0.9)
    expect(wisps!.tuning?.spinScale ?? 0).toBeGreaterThanOrEqual(1)

    const smokeVariants = PfxLibrary.getPfxSpriteVariantLayout('smoke-variants')
    expect(smokeVariants).toMatchObject({ count: 8, columns: 4, startIndex: 1, rowDirection: -1 })
    expect(smokeVariants.cellScale.x).toBeCloseTo(0.25)
    expect(smokeVariants.cellScale.y).toBeCloseTo(0.125)
    const resolvedSmokeVariantUvs = Array.from({ length: smokeVariants.count }, (_, index) => {
      const linearIndex = smokeVariants.startIndex + index
      return {
        u: smokeVariants.offset.x + (linearIndex % smokeVariants.columns) * smokeVariants.cellScale.x,
        v: smokeVariants.offset.y
          + Math.floor(linearIndex / smokeVariants.columns) * smokeVariants.cellScale.y * smokeVariants.rowDirection,
      }
    })
    const authoredSmokeVariantUvs = Array.from({ length: 8 }, (_, index) => {
      const slice = PfxLibrary.PFX_SPRITE_SLICES[`smoke-variant-0${index + 1}` as keyof typeof PfxLibrary.PFX_SPRITE_SLICES]
      return { u: slice.u, v: slice.v }
    })
    expect(resolvedSmokeVariantUvs).toEqual(authoredSmokeVariantUvs)
    const smokeVariantSources = Object.values(PfxLibrary.PFX_SPRITE_SLICES)
      .map((slice) => slice.source)
      .filter((source) => /smoke_0[1-8]\.png$/.test(source))
    expect(new Set(smokeVariantSources).size).toBe(8)

    const explosion = getPfxRenderPlan(createPfxPreset('explosion'))
    const afterglow = explosion.surfaces.find((surface) => surface.phase === 'ember-afterglow')
    expect(afterglow, 'explosion needs a curated ember-afterglow layer').toBeTruthy()
    // 'glow' round dot — 'spark' was an elongated line asset that rendered
    // every ember as the same parallel downward line (review verdict).
    expect(afterglow!.tuning?.sprite).toBe('glow')
    expect(afterglow!.tuning?.gravity).toBeLessThan(0)
    // Tempo pass 2026-07-11: embers trimmed to the impulse profile — they
    // still outlive the flash beats but clear the screen by ~1s.
    expect(afterglow!.tuning?.lifeScale ?? 1).toBeGreaterThanOrEqual(0.6)

    // Muzzle rebuild: one low-draw volumetric flame owns the barrel axis and
    // survives side cameras, with ballistic spark chips owning its decay.
    const muzzleFlash = getPfxRenderPlan(createPfxPreset('muzzle-flash'))
    const muzzleCone = muzzleFlash.surfaces.find((surface) => surface.phase === 'directional-flame-cone')
    expect(muzzleCone, 'muzzle-flash keeps a directional side read').toBeTruthy()
    expect(muzzleCone!.kind).toBe('muzzle-cone')
    expect(muzzleCone!.opacity).toBeGreaterThanOrEqual(0.85)
    expect(muzzleFlash.surfaces.some((surface) => surface.phase === 'forward-spark-chips')).toBe(true)

    // Impact exemplar contract (Notion: Impact VFX Spec): contact pop +
    // gold spike star + hot chips arcing under gravity + ember resolution.
    const hitSpark = getPfxRenderPlan(createPfxPreset('hit-spark'))
    expect(hitSpark.feelVersion).toBe(2)
    const chips = hitSpark.surfaces.find((surface) => surface.phase === 'hit-spark-chips')
    expect(chips, 'redundant scratch-line chip emitter should be removed').toBeUndefined()
    const heroStreaks = hitSpark.surfaces.find((surface) => surface.phase === 'hit-spark-particle-random-fan')
    expect(heroStreaks?.kind).toBe('particles')
    expect(heroStreaks?.scale ?? 0).toBeGreaterThanOrEqual(1.1)
    expect(heroStreaks?.scale ?? Infinity).toBeLessThanOrEqual(1.34)
    expect(isPfxSurfaceCameraFacing(heroStreaks!, hitSpark.feelVersion)).toBe(false)
    expect(PfxLibrary.getPfxSurfaceSpatialPolicy(heroStreaks!).crossedVolume).toBe(false)
    expect(PfxLibrary.getPfxSurfaceSpatialPolicy(heroStreaks!).minimumDepth).toBeGreaterThanOrEqual(0.08)
    const createHeroShardGeometry = (PfxLibrary as unknown as {
      createPfxImpactShardBurstGeometry: () => THREE.BufferGeometry
    }).createPfxImpactShardBurstGeometry
    const heroShardGeometry = createHeroShardGeometry()
    expect(heroShardGeometry.userData['pfxImpactShardBurstDrawCalls']).toBe(1)
    expect(heroShardGeometry.userData['pfxImpactShardBurstShardCount']).toBe(8)
    expect(heroShardGeometry.userData['pfxImpactShardBurstSecondaryShardCount']).toBe(3)
    expect(heroShardGeometry.userData['pfxImpactShardBurstClosedFaces']).toBe(true)
    expect(heroShardGeometry.userData['pfxImpactShardBurstExactOppositePairCount']).toBe(0)
    expect(heroShardGeometry.userData['pfxImpactShardBurstMinimumForwardAlignment']).toBeGreaterThanOrEqual(0.45)
    expect(heroShardGeometry.userData['pfxImpactShardBurstLengthRatio']).toBeGreaterThanOrEqual(1.8)
    expect(heroShardGeometry.userData['pfxImpactShardBurstMinimumWidth']).toBeGreaterThanOrEqual(0.055)
    expect(heroShardGeometry.userData['pfxImpactShardBurstMaximumWidth']).toBeGreaterThanOrEqual(0.08)
    expect(heroShardGeometry.userData['pfxImpactShardBurstDepthCrossingCount']).toBeGreaterThanOrEqual(2)
    expect(heroShardGeometry.userData['pfxImpactShardBurstRootDepthSpan']).toBeGreaterThanOrEqual(0.12)
    heroShardGeometry.computeBoundingBox()
    const heroShardBounds = heroShardGeometry.boundingBox!
    expect(heroShardBounds.max.x - heroShardBounds.min.x).toBeGreaterThanOrEqual(0.85)
    expect(heroShardBounds.max.z - heroShardBounds.min.z).toBeGreaterThanOrEqual(0.45)
    const heroShardNormals = heroShardGeometry.getAttribute('normal')
    for (let index = 0; index < heroShardNormals.count; index += 1) {
      expect(new THREE.Vector3().fromBufferAttribute(heroShardNormals, index).length()).toBeCloseTo(1, 4)
    }
    heroShardGeometry.dispose()
    const createHeroShardMaterial = (PfxLibrary as unknown as {
      createPfxImpactShardBurstMaterial: (opacity: number, color: THREE.ColorRepresentation) => THREE.MeshStandardMaterial
    }).createPfxImpactShardBurstMaterial
    const heroShardMaterial = createHeroShardMaterial(0.9, '#fff0a8')
    expect(heroShardMaterial.blending).toBe(THREE.NormalBlending)
    expect(heroShardMaterial.depthWrite).toBe(true)
    expect(heroShardMaterial.side).toBe(THREE.FrontSide)
    expect(heroShardMaterial.vertexColors).toBe(true)
    expect(heroShardMaterial.flatShading).toBe(true)
    expect(heroShardMaterial.transparent).toBe(true)
    expect(heroShardMaterial.userData['pfxImpactShardBurstMaterial']).toBe('solid-faceted-heat-ramp')
    heroShardMaterial.dispose()
    const librarySource = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    expect(librarySource).toContain('createPfxImpactShardBurstGeometry()')
    expect(librarySource).toContain('createPfxImpactShardBurstMaterial(materialProps.opacity, materialProps.color)')
    expect(librarySource).toContain("if (surface.kind === 'impact-shards')")
    expect(heroStreaks?.tuning).toMatchObject({
      motion: 'radial-burst',
      sprite: 'streak',
      lifecycle: 'hit-spark-particle-confirm',
      randomizeAzimuth: true,
      impactVector: [1, 0.18, 0.22],
    })
    expect(heroStreaks?.tuning?.window).toBe(0.28)
    expect(heroStreaks?.tuning?.stretch).toBe(0.42)
    const embers = hitSpark.surfaces.find((surface) => surface.phase === 'hit-spark-particle-ember-resolve')
    expect(embers, 'hit-spark needs the ember resolution beat').toBeTruthy()
    expect(embers!.tuning?.sprite).toBe('ember')
    expect(PFX_SPRITE_SLICES.ember.source).toBe('procedural:ember-chip')
    expect(embers!.tuning?.blend).toBe('alpha')
    expect(embers!.tuning?.ramp).toBe('pigment')
    expect(embers!.tuning?.stretch ?? 0).toBeGreaterThanOrEqual(0.16)
    expect(embers!.tuning?.stretch ?? Infinity).toBeLessThanOrEqual(0.2)
    expect(embers!.tuning?.colorOverride).toBe('#ff9a2f')
    expect(embers!.opacity).toBeGreaterThanOrEqual(0.75)
    expect(embers!.tuning?.countScale ?? 0).toBeGreaterThanOrEqual(0.3)
    expect(embers!.tuning?.countScale ?? Infinity).toBeLessThanOrEqual(0.38)
    expect(embers!.tuning?.lifeScale ?? 0).toBeGreaterThanOrEqual(0.78)
    expect(embers!.tuning?.lifeScale ?? Infinity).toBeLessThanOrEqual(0.86)
    expect(embers!.tuning?.size?.[1] ?? 0).toBeGreaterThanOrEqual(0.2)
    expect(embers!.tuning?.size?.[1] ?? Infinity).toBeLessThanOrEqual(0.24)
    expect(embers!.tuning?.delay ?? 0).toBeGreaterThanOrEqual(0.12)
    expect(embers!.tuning?.delay ?? Infinity).toBeLessThanOrEqual(0.16)
    expect(embers!.tuning?.window ?? 0).toBeGreaterThanOrEqual(0.3)
    expect(embers!.tuning?.window ?? Infinity).toBeLessThanOrEqual(0.36)
    expect(embers!.tuning?.speedScale ?? 0).toBeGreaterThanOrEqual(1.1)
    expect(embers!.tuning?.speedScale ?? Infinity).toBeLessThanOrEqual(1.4)
    expect(embers!.tuning?.gravity ?? -Infinity).toBeGreaterThanOrEqual(-1.6)
    expect(embers!.tuning?.gravity ?? Infinity).toBeLessThanOrEqual(-1.2)
    expect(embers!.tuning?.drag ?? 0).toBeGreaterThanOrEqual(2)
    expect(embers!.tuning?.drag ?? Infinity).toBeLessThanOrEqual(2.4)
    expect(embers!.tuning?.motion).toBe('radial-burst')
    expect(embers!.tuning?.impactVector?.[0] ?? 0).toBeGreaterThanOrEqual(0.9)
    expect(embers!.tuning?.impactVector?.[2] ?? 0).toBeGreaterThanOrEqual(0.2)
    expect(embers!.tuning?.impactVector?.[2] ?? Infinity).toBeLessThanOrEqual(0.35)
    expect(embers!.tuning?.spreadAngle ?? 0).toBeGreaterThanOrEqual(0.7)
    expect(embers!.tuning?.spreadAngle ?? Infinity).toBeLessThanOrEqual(0.9)
    expect(embers!.tuning?.spawnScale ?? Infinity).toBeLessThanOrEqual(0.2)
    const hitPreset = createPfxPreset('hit-spark')
    const recoveryParticleCount = [embers!].reduce(
      (total, surface) => total + PfxLibrary.createPfxParticleEmission(hitPreset, surface).count,
      0,
    )
    expect(recoveryParticleCount).toBeGreaterThanOrEqual(10)
    expect(recoveryParticleCount).toBeLessThanOrEqual(14)
    const contactBloom = hitSpark.surfaces.find((surface) => surface.phase === 'hit-spark-particle-contact-pop')
    expect(contactBloom?.kind).toBe('particles')
    expect(contactBloom?.role).toBe('impact')
    expect(contactBloom?.tuning?.lifecycle).toBe('hit-spark-particle-confirm')
    expect(contactBloom?.tuning?.window).toBe(0.12)
    expect(contactBloom?.opacity ?? 0).toBeGreaterThanOrEqual(0.9)
    expect(contactBloom?.tuning?.blend).toBe('additive')
    expect(hitSpark.surfaces).toHaveLength(3)
    expect(hitSpark.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    const cycleScale = PfxLibrary.getPfxCycleScale(hitSpark.surfaces)
    expect(cycleScale).toBeGreaterThan(0)
    const fanOnset = getPfxSurfaceAnimationProps(heroStreaks!, hitPreset.controls, 0, cycleScale, 1.7, 2)
    const fanPeak = getPfxSurfaceAnimationProps(heroStreaks!, hitPreset.controls, 0.16, cycleScale, 1.7, 2)
    const fanRest = getPfxSurfaceAnimationProps(heroStreaks!, hitPreset.controls, 0.8, cycleScale, 1.7, 2)
    expect(fanOnset.signature).toContain('hit-spark-particle-random-fan')
    expect(fanPeak.opacityMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(fanRest.opacityMultiplier).toBeLessThanOrEqual(fanPeak.opacityMultiplier)
    expect(isPfxSurfaceCameraFacing(contactBloom!, hitSpark.feelVersion)).toBe(false)
    const contactGeometry = PfxLibrary.createPfxImpactCoreGeometry()
    expect(contactGeometry.userData['pfxImpactCoreGeometry']).toBe('single-draw-four-ray-ricochet-knot')
    expect(contactGeometry.userData['pfxImpactCoreSpikeCount']).toBe(4)
    expect(contactGeometry.userData['pfxImpactCoreContactNormal']).toEqual([1, 0, 0])
    expect(contactGeometry.userData['pfxImpactCoreContactDepth']).toBeLessThanOrEqual(0.14)
    expect(contactGeometry.userData['pfxImpactCorePlanarPad']).toBe(false)
    expect(contactGeometry.userData['pfxImpactCoreDepthCompression']).toBe(0.55)
    expect(contactGeometry.userData['pfxImpactCoreOutgoingRayCount']).toBe(3)
    expect(contactGeometry.userData['pfxImpactCoreReboundRayCount']).toBe(1)
    expect(contactGeometry.userData['pfxImpactCoreCompressionMotif']).toBe('none')
    expect(contactGeometry.userData['pfxImpactCoreCompressionArmCount']).toBe(0)
    expect(contactGeometry.userData['pfxImpactCoreNestedHotSpineCount']).toBe(1)
    expect(contactGeometry.userData['pfxImpactCoreFacetRampStopCount']).toBeGreaterThanOrEqual(4)
    expect(contactGeometry.userData['pfxImpactCoreHeroRayCount']).toBe(1)
    expect(contactGeometry.userData['pfxImpactCoreMinimumHeroRayX']).toBeGreaterThanOrEqual(0.7)
    expect(contactGeometry.userData['pfxImpactCoreDepthRayCount']).toBe(2)
    expect(contactGeometry.userData['pfxImpactCoreMinimumDepthRayLength']).toBeGreaterThanOrEqual(0.3)
    expect(contactGeometry.userData['pfxImpactCoreMaximumRayLength']).toBeGreaterThanOrEqual(0.7)
    expect(contactGeometry.userData['pfxImpactCoreMaximumRayWidth']).toBeLessThanOrEqual(0.045)
    expect(contactGeometry.userData['pfxImpactCoreExactOppositePairCount']).toBe(0)
    expect(contactGeometry.userData['pfxImpactCoreDepthLengthImbalance']).toBeGreaterThanOrEqual(0.24)
    expect(contactGeometry.userData['pfxImpactCoreSideSilhouetteImbalance']).toBeGreaterThanOrEqual(0.4)
    expect(contactGeometry.userData['pfxImpactCoreRadialSegments']).toBe(8)
    expect(contactGeometry.userData['pfxImpactCoreClosedFaces']).toBe(true)
    expect(contactGeometry.userData['pfxImpactCoreNormalPolicy']).toBe('smooth-welded-closed-volume')
    expect(contactGeometry.userData['pfxImpactCoreSmoothedNormalWeldEpsilon']).toBeLessThanOrEqual(0.00001)
    expect(contactGeometry.userData['pfxImpactCoreSeedGeometry']).toBe('subdivided-icosahedron')
    expect(contactGeometry.userData['pfxImpactCoreSeedTriangles']).toBeGreaterThanOrEqual(80)
    expect(contactGeometry.userData['pfxImpactCoreSeedRadius']).toBeGreaterThanOrEqual(0.16)
    expect(contactGeometry.userData['pfxImpactCoreSeedRadius']).toBeLessThanOrEqual(0.18)
    expect(contactGeometry.userData['pfxImpactCoreRootSpread']).toBeGreaterThanOrEqual(0.04)
    expect(contactGeometry.userData['pfxImpactCoreRootSpread']).toBeLessThanOrEqual(0.05)
    contactGeometry.computeBoundingBox()
    const bounds = contactGeometry.boundingBox!
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(0.7)
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.32)
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.45)
    expect(bounds.max.z - bounds.min.z).toBeLessThan(0.8)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan((bounds.max.z - bounds.min.z) * 1.05)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan((bounds.max.y - bounds.min.y) * 0.9)
    // The compact contact notch stays subordinate to the directional fan; the
    // independent Z-volume floor prevents it collapsing into a projectile line.
    expect(bounds.max.x - bounds.min.x).toBeLessThan((bounds.max.y - bounds.min.y) * 3)
    const coreNormals = contactGeometry.getAttribute('normal')
    const coreColors = contactGeometry.getAttribute('color')
    const minimumCoreGreen = Math.min(...Array.from({ length: coreColors.count }, (_, index) => coreColors.getY(index)))
    // A controlled ember-orange tip supplies the fourth spatial ramp stop;
    // it may cool below gold, but never into an unlit near-black facet.
    expect(minimumCoreGreen).toBeGreaterThanOrEqual(0.2)
    for (let index = 0; index < coreNormals.count; index += 1) {
      expect(new THREE.Vector3().fromBufferAttribute(coreNormals, index).length()).toBeCloseTo(1, 4)
    }
    contactGeometry.dispose()
    const contactMaterial = PfxLibrary.createPfxImpactCoreMaterial(1, '#fff9dc')
    expect(contactMaterial).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(contactMaterial.blending).toBe(THREE.NormalBlending)
    expect(contactMaterial.vertexColors).toBe(true)
    expect(contactMaterial.transparent).toBe(true)
    expect(contactMaterial.depthWrite).toBe(true)
    expect(contactMaterial.flatShading).toBe(true)
    expect(contactMaterial.roughness).toBeGreaterThanOrEqual(0.38)
    expect(contactMaterial.roughness).toBeLessThanOrEqual(0.5)
    expect(contactMaterial.metalness).toBeGreaterThanOrEqual(0.08)
    expect(contactMaterial.metalness).toBeLessThanOrEqual(0.16)
    expect(contactMaterial.emissive.getHexString()).toBe('fff9dc')
    expect(contactMaterial.emissiveIntensity).toBeGreaterThanOrEqual(0.6)
    expect(contactMaterial.emissiveIntensity).toBeLessThanOrEqual(0.8)
    expect(contactMaterial.userData['pfxImpactCoreShader']).toBe('rim-specular-heat-seams-v1')
    expect(contactMaterial.userData['pfxImpactCoreRimStrength']).toBeGreaterThanOrEqual(0.2)
    expect(contactMaterial.userData['pfxImpactCoreHeatSeamStrength']).toBeGreaterThanOrEqual(0.1)
    expect(contactMaterial.customProgramCacheKey()).toContain('rim-specular-heat-seams-v1')
    contactMaterial.dispose()
  })

  it('gives explosion, muzzle flash, and hit spark distinct gameplay silhouettes', () => {
    const layer = (effectId: string, phase: string) => {
      const surface = getPfxRenderPlan(createPfxPreset(effectId)).surfaces.find((candidate) => candidate.phase === phase)
      expect(surface, `${effectId} needs ${phase}`).toBeTruthy()
      return surface!
    }

    const explosionFire = layer('explosion', 'fire-roil')
    const explosionJets = layer('explosion', 'spark-jets')
    const explosionFlash = layer('explosion', 'detonation-flash')
    const explosionRadius = layer('explosion', 'radius-read')
    expect(explosionFire.scale).toBeGreaterThanOrEqual(1.55)
    expect(explosionFire.tuning?.sprite).toBe('lick')
    expect(explosionFire.tuning?.delay ?? Infinity).toBe(0)
    expect(explosionJets.tuning?.sprite).toBe('streak')
    expect(explosionJets.tuning?.stretch ?? Infinity).toBeLessThanOrEqual(1.6)
    expect(explosionFlash.tuning?.colorOverride).toBe('#fff1c2')
    expect(explosionFlash.scale).toBeGreaterThanOrEqual(1.5)
    expect(explosionRadius.scale).toBeGreaterThanOrEqual(2.5)

    const muzzleSmoke = layer('muzzle-flash', 'smoke-wisp')
    const muzzleTongues = layer('muzzle-flash', 'directional-flame-cone')
    expect(muzzleSmoke.kind).toBe('particles')
    expect(muzzleSmoke.tuning?.blend).toBe('alpha')
    expect(muzzleSmoke.tuning?.delay ?? 0).toBeGreaterThan(0)
    expect(muzzleTongues.kind).toBe('muzzle-cone')
    expect(muzzleTongues.tuning?.meshMotion).toBe('flash')

    expect(getPfxRenderPlan(createPfxPreset('hit-spark')).surfaces.some(
      (surface) => surface.phase === 'impact-body-rays' || surface.kind === 'impact-sparks',
    )).toBe(false)
  })

  it('uses a volumetric muzzle cone and keeps point impacts free of area rings', () => {
    const muzzle = getPfxRenderPlan(createPfxPreset('muzzle-flash'))
    const hit = getPfxRenderPlan(createPfxPreset('hit-spark'))

    expect(muzzle.surfaces.some((surface) =>
      surface.kind === 'muzzle-cone' && surface.phase === 'directional-flame-cone',
    )).toBe(true)
    const heroFlame = muzzle.surfaces.find((surface) => surface.phase === 'directional-flame-cone')!
    expect(heroFlame.tuning?.meshShader).toBeUndefined()
    expect(heroFlame.tuning?.window ?? 1).toBeLessThanOrEqual(0.16)
    expect(heroFlame.tuning?.startScale ?? 0).toBeGreaterThanOrEqual(0.72)
    expect(isPfxSurfaceCameraFacing(heroFlame, 2)).toBe(false)
    expect(getPfxSurfaceAnimationProps(heroFlame, createPfxPreset('muzzle-flash').controls, 0.12, 1, 2.2, 2).opacityMultiplier).toBe(0)
    expect(muzzle.surfaces.some((surface) =>
      surface.phase === 'forward-spark-chips' &&
      surface.tuning?.sprite === 'ember' &&
      surface.tuning?.impactVector?.[0] === 1,
    )).toBe(true)
    expect(PfxLibrary.PFX_SPRITE_SLICES.ember.source).toBe('procedural:ember-chip')
    const muzzleChips = muzzle.surfaces.find((surface) => surface.phase === 'forward-spark-chips')!
    expect(PfxLibrary.shouldRotatePfxBurstPattern(muzzleChips, 2)).toBe(false)
    expect(muzzleChips.tuning?.impactVector).toEqual([1, 0, 0])
    expect(muzzleChips.tuning?.gravity).toBe(0)
    expect(muzzleChips.tuning?.countScale ?? 0).toBeGreaterThanOrEqual(0.55)
    expect(muzzleChips.tuning?.countScale ?? 1).toBeLessThanOrEqual(0.7)
    expect(muzzleChips.tuning?.speedScale ?? Infinity).toBeLessThanOrEqual(2.2)
    expect(muzzleChips.tuning?.spreadAngle ?? 0).toBeGreaterThanOrEqual(0.2)
    expect(muzzleChips.tuning?.spreadAngle ?? Infinity).toBeLessThanOrEqual(0.3)
    expect(muzzleChips.tuning?.delay ?? 0).toBeGreaterThanOrEqual(0.045)
    expect(muzzleChips.tuning?.delay ?? 1).toBeLessThanOrEqual(0.06)
    expect(muzzleChips.tuning?.stretch).toBe(0)
    expect(muzzleChips.tuning?.spinScale ?? 0).toBeGreaterThanOrEqual(0.6)
    expect(muzzleChips.tuning?.spinScale ?? Infinity).toBeLessThanOrEqual(1.4)
    expect(muzzleChips.tuning?.lifeScale ?? 1).toBeLessThanOrEqual(0.26)
    expect(Math.max(...(muzzleChips.tuning?.size ?? [1]))).toBeLessThanOrEqual(0.24)
    const muzzleSmoke = muzzle.surfaces.find((surface) => surface.phase === 'smoke-wisp')!
    expect(muzzleSmoke.tuning?.sprite).toBe('puff')
    expect(PfxLibrary.PFX_SPRITE_SLICES.puff.source).toBe('procedural:billow')
    expect(muzzleSmoke.tuning?.delay ?? 0).toBeGreaterThan(0.04)
    expect(muzzleSmoke.tuning?.delay ?? 1).toBeLessThanOrEqual(0.05)
    expect(muzzleSmoke.opacity).toBeGreaterThanOrEqual(0.65)
    expect(muzzleSmoke.scale).toBeGreaterThanOrEqual(1.2)
    expect(muzzleSmoke.tuning?.countScale ?? 0).toBeGreaterThanOrEqual(0.68)
    expect(muzzleSmoke.tuning?.countScale ?? 1).toBeLessThanOrEqual(0.78)
    expect(muzzleSmoke.tuning?.positionOffset?.[0] ?? 0).toBeGreaterThanOrEqual(0.08)
    expect(muzzleSmoke.tuning?.positionOffset?.[0] ?? 1).toBeLessThanOrEqual(0.12)
    expect(Math.abs(muzzleSmoke.tuning?.positionOffset?.[1] ?? Infinity)).toBeLessThanOrEqual(0.05)
    expect(Math.max(...(muzzleSmoke.tuning?.size ?? [1]))).toBeLessThanOrEqual(0.85)
    expect(heroFlame.scale).toBeLessThanOrEqual(0.9)
    expect(muzzle.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(muzzle.surfaces.some((surface) => surface.tuning?.sprite === 'muzzle')).toBe(false)
    expect(hit.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)

    const hitBursts = hit.surfaces.filter((surface) =>
      (surface.kind === 'particles' || surface.kind === 'impact-sparks') &&
      (surface.tuning?.window ?? 1) < 1,
    )
    expect(hitBursts.length).toBeGreaterThan(0)
    const directedHitBursts = hitBursts.filter((surface) => surface.tuning?.motion === 'radial-burst')
    expect(directedHitBursts.every((surface) => surface.tuning?.impactVector != null)).toBe(true)
    expect(directedHitBursts.every((surface) => !PfxLibrary.shouldRotatePfxBurstPattern(surface, 2))).toBe(true)

    const flameGeometry = createPfxMuzzleFlameGeometry()
    flameGeometry.computeBoundingBox()
    const size = flameGeometry.boundingBox!.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(size.y * 1.2)
    expect(size.x).toBeGreaterThan(size.z * 1.2)
    expect(Math.min(size.y, size.z)).toBeGreaterThanOrEqual(0.4)
    expect(flameGeometry.getAttribute('normal').count).toBeGreaterThan(0)
    expect(flameGeometry.getAttribute('color').count).toBe(flameGeometry.getAttribute('position').count)
    expect(flameGeometry.getAttribute('uv').count).toBe(flameGeometry.getAttribute('position').count)
    expect(flameGeometry.getAttribute('position').count).toBeGreaterThan(240)
    expect(flameGeometry.getAttribute('position').count).toBeLessThanOrEqual(360)
    expect(flameGeometry.userData['pfxMuzzleLayers']).toEqual(['nested-hot-core', 'connected-flame-body', 'radial-front-cap'])
    expect(flameGeometry.userData['pfxMuzzleLobeCount']).toBe(2)
    expect(flameGeometry.userData['pfxMuzzleAxialRingCount']).toBe(4)
    expect(flameGeometry.userData['pfxMuzzleInnerAxialRingCount']).toBe(3)
    expect(flameGeometry.userData['pfxMuzzleAtlasSlices']).toEqual(['directional-1', 'radial-1'])
    expect(flameGeometry.userData['pfxMuzzleBodyProfile']).toBe('short-layered-percussive-shell')
    expect(flameGeometry.userData['pfxMuzzleBodyTip']).toEqual([0.58, 0.1, -0.08])
    expect(flameGeometry.userData['pfxMuzzleBodyMaxRadius']).toBe(0.26)
    expect(flameGeometry.userData['pfxMuzzleInnerTip']).toEqual([0.44, -0.04, 0.06])
    expect(flameGeometry.userData['pfxMuzzleRadialCapUvRadius']).toBe(0.18)
    expect(flameGeometry.userData['pfxMuzzleRadialCapRadius']).toBe(0.16)
    expect(flameGeometry.userData['pfxMuzzleRadialCapProfile']).toBe('offset-soft-ignition-bloom')
    expect(flameGeometry.userData['pfxMuzzleRadialCapCenter']).toEqual([0.03, 0.012, -0.014])
    expect(flameGeometry.userData['pfxMuzzleRadialCapAspect']).toEqual([1.08, 0.86])
    expect(flameGeometry.userData['pfxMuzzleRadialCapSegments']).toBe(16)
    expect(flameGeometry.userData['pfxMuzzleGeometry']).toBe('connected-tapered-volume-with-radial-cap')
    flameGeometry.dispose()
  })

  it('renders the connected muzzle body as one outward-facing translucent shell', () => {
    const material = PfxLibrary.createPfxMuzzleFlameMaterial(0.92)

    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.depthWrite).toBe(false)
    expect(material.alphaTest).toBe(0.01)
    expect(material.opacity).toBeCloseTo(0.92 * 0.92)
    expect(material.userData['pfxMuzzleAxialFade']).toBe('directional-atlas-only@0.82-0.96')
    expect(material.userData['pfxMuzzleHeatRamp']).toBe('tight-yellow-core-to-saturated-orange-edge')
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <project_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>',
    }
    material.onBeforeCompile(shader as never, {} as never)
    expect(shader.fragmentShader).toContain('pfxDirectionalAtlasWeight')
    expect(shader.fragmentShader).toContain('pfxAtlasEnergy')
    expect(shader.fragmentShader).toContain('float pfxAtlasEnergy = max(diffuseColor.g, diffuseColor.b);')
    expect(shader.fragmentShader).toContain('float pfxHeatCore = smoothstep(0.82, 0.99, pfxAtlasEnergy);')
    expect(shader.fragmentShader).toContain('vec3(1.0, 0.06, 0.0)')
    expect(shader.fragmentShader).toContain('vec3(1.0, 0.55, 0.05)')
    expect(shader.fragmentShader).toContain('pfxHeatRamp')
    expect(shader.fragmentShader).toContain('pfxRadialCapAlpha')
    expect(shader.fragmentShader).toContain('float pfxRadialEdge = 0.145')
    expect(shader.fragmentShader).toContain('uPfxAxisView')
    expect(shader.uniforms).toHaveProperty('uPfxAxisView')
    material.dispose()
  })

  it('renders healing glyphs as a luminous life-leaf treatment instead of a stock medical cross', () => {
    const material = PfxLibrary.createPfxHealingGlyphMaterial(0.9, '#9dffc0')

    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(material.transparent).toBe(true)
    expect(material.opacity).toBeCloseTo(0.9)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.side).toBe(THREE.DoubleSide)
    expect(material.toneMapped).toBe(true)
    expect(material.color.getHexString()).toBe('9dffc0')
    expect(material.emissive.getHexString()).toBe('9dffc0')
    expect(material.emissiveIntensity).toBeLessThan(0.8)
    expect(material.roughness).toBeLessThan(0.5)
    expect(material.toneMapped).toBe(true)
    expect(material.userData['pfxHealingGlyph']).toBe('restoration-leaf-bloom')
    expect(material.userData['pfxHealingGlyphGeometry']).toBe('beveled-life-leaf')
    material.dispose()

    const vineMaterial = PfxLibrary.createPfxHealingVineMaterial(0.8, '#7dffad')
    expect(vineMaterial).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(vineMaterial.blending).toBe(THREE.NormalBlending)
    expect(vineMaterial.opacity).toBeCloseTo(0.72)
    expect(vineMaterial.depthWrite).toBe(false)
    expect(vineMaterial.roughness).toBeLessThan(0.5)
    expect(vineMaterial.emissiveIntensity).toBeGreaterThan(0.2)
    expect(vineMaterial.color.getHSL({ h: 0, s: 0, l: 0 }).s).toBeGreaterThan(0.6)
    expect(vineMaterial.userData['pfxHealingVolume']).toBe('single-life-vine')
    vineMaterial.dispose()

    const edgeMaterial = PfxLibrary.createPfxHealingLeafEdgeMaterial(0.9, '#9dffc0')
    expect(edgeMaterial).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(edgeMaterial.color.getHex()).not.toBe(material.color.getHex())
    expect(edgeMaterial.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(material.color.getHSL({ h: 0, s: 0, l: 0 }).l)
    expect(edgeMaterial.userData['pfxHealingLeafLayer']).toBe('extruded-edge')
    edgeMaterial.dispose()

    const vineGeometry = PfxLibrary.createPfxHealingVineGeometry()
    vineGeometry.computeBoundingBox()
    expect(vineGeometry).toBeInstanceOf(THREE.TubeGeometry)
    expect(vineGeometry.boundingBox!.max.y - vineGeometry.boundingBox!.min.y).toBeGreaterThan(1.6)
    const vineWidth = vineGeometry.boundingBox!.max.x - vineGeometry.boundingBox!.min.x
    const vineDepth = vineGeometry.boundingBox!.max.z - vineGeometry.boundingBox!.min.z
    expect(vineWidth).toBeGreaterThan(1.25)
    expect(vineDepth).toBeGreaterThan(0.55)
    expect(vineDepth).toBeLessThan(0.9)
    expect(vineWidth / vineDepth).toBeGreaterThan(1.5)
    expect(vineGeometry.parameters.radius).toBeGreaterThanOrEqual(0.03)
    vineGeometry.dispose()

    const focalMaterial = PfxLibrary.createPfxHealingFocalMaterial(0.9)
    expect(focalMaterial.color.getHexString()).toBe('68ffc0')
    expect(focalMaterial.emissiveIntensity).toBeGreaterThan(0.7)
    expect(focalMaterial.emissiveIntensity).toBeLessThan(1)
    expect(focalMaterial.userData['pfxHealingFocal']).toBe('restorative-star')
    focalMaterial.dispose()

    const focalGeometry = PfxLibrary.createPfxHealingFocalGeometry()
    focalGeometry.computeBoundingBox()
    expect(focalGeometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(focalGeometry.boundingBox!.max.x - focalGeometry.boundingBox!.min.x).toBeGreaterThan(0.3)
    expect(focalGeometry.boundingBox!.max.y - focalGeometry.boundingBox!.min.y).toBeGreaterThan(0.3)
    expect(focalGeometry.boundingBox!.max.z - focalGeometry.boundingBox!.min.z).toBeGreaterThan(0.05)
    focalGeometry.dispose()

    const sparkleGeometry = PfxLibrary.createPfxHealingSparkleGeometry()
    expect(sparkleGeometry).toBeInstanceOf(THREE.OctahedronGeometry)
    sparkleGeometry.dispose()

    const sparkles = PfxLibrary.createPfxHealingSparkleLayout(0.2)
    expect(sparkles).toHaveLength(12)
    expect(new Set(sparkles.map((sparkle) => sparkle.position[1])).size).toBeGreaterThanOrEqual(10)
    expect(Math.max(...sparkles.map((sparkle) => sparkle.position[1])) - Math.min(...sparkles.map((sparkle) => sparkle.position[1]))).toBeGreaterThan(1.2)
  })

  it('authors healing glyphs as a centered restoration beat with ordered rising satellites', () => {
    const onset = PfxLibrary.createPfxHealingGlyphLayout(0.04)
    const peak = PfxLibrary.createPfxHealingGlyphLayout(0.2)
    const recovery = PfxLibrary.createPfxHealingGlyphLayout(0.32)

    expect(peak).toHaveLength(1)
    expect(peak[0]).toMatchObject({ role: 'hero', position: [0, -0.1, 0] })
    expect(peak[0]!.scale).toBeGreaterThan(onset[0]!.scale * 1.7)
    expect(peak[0]!.scale).toBeGreaterThan(recovery[0]!.scale * 1.5)
    expect(onset[0]!.scale).toBeGreaterThan(0.45)
    expect(recovery[0]!.scale).toBeLessThan(0.35)
    expect(peak[0]!.scale).toBeGreaterThan(0.9)
    expect(peak[0]!.scale).toBeLessThanOrEqual(1.1)

    const leafField = PfxLibrary.createPfxHealingLeafHelixLayout(0.2)
    expect(leafField).toHaveLength(22)
    expect(Math.max(...leafField.map((leaf) => leaf.position[1])) - Math.min(...leafField.map((leaf) => leaf.position[1]))).toBeGreaterThan(1.6)
    const leafWidth = Math.max(...leafField.map((leaf) => leaf.position[0])) - Math.min(...leafField.map((leaf) => leaf.position[0]))
    const leafDepth = Math.max(...leafField.map((leaf) => leaf.position[2])) - Math.min(...leafField.map((leaf) => leaf.position[2]))
    expect(leafWidth).toBeGreaterThan(1.2)
    expect(leafDepth).toBeGreaterThan(0.5)
    expect(leafDepth).toBeLessThan(0.85)
    expect(leafWidth / leafDepth).toBeGreaterThan(1.5)
    for (let index = 0; index < leafField.length; index++) {
      const rise = PfxLibrary.createPfxHealingLeafProgress(0.2, index, 22)
      const vinePoint = PfxLibrary.createPfxHealingVinePoint(rise)
      expect(leafField[index]!.position).toEqual(vinePoint)
    }
    expect(new Set(leafField.map((leaf) => leaf.scale)).size).toBeGreaterThan(12)
    const leafGaps = leafField.slice(1).map((leaf, index) => Math.abs(leaf.position[1] - leafField[index]!.position[1]).toFixed(3))
    expect(new Set(leafGaps).size).toBeGreaterThan(5)

    const healingGlyphs = getPfxRenderPlan(createPfxPreset('healing-aura')).surfaces
      .find((surface) => surface.kind === 'healing-glyphs')!
    expect(healingGlyphs.phase).toBe('restoration-leaf-bloom-and-helix')
    expect(healingGlyphs.tuning?.turbulenceScale).toBe(0)
    expect(healingGlyphs.tuning?.positionOffset).toEqual([0, 0.18, 0])
    expect(getPfxRenderPlan(createPfxPreset('healing-aura')).surfaces.some((surface) => surface.phase === 'restoration-helix')).toBe(false)
    expect(getPfxRenderPlan(createPfxPreset('healing-aura')).surfaces.some((surface) => surface.phase === 'ground-runes')).toBe(false)
    const healingMotes = getPfxRenderPlan(createPfxPreset('healing-aura')).surfaces
      .find((surface) => surface.phase === 'restoration-soft-rise')!
    expect(healingMotes.kind).toBe('particles')
    expect(healingMotes.tuning?.motion).toBe('column-rise')
    expect(healingMotes.tuning?.sprite).toBe('glow')
    expect(healingMotes.tuning?.countScale).toBeLessThanOrEqual(0.5)
    expect(healingMotes.tuning?.turbulenceScale).toBeLessThanOrEqual(0.2)
    expect(healingMotes.opacity).toBeGreaterThanOrEqual(0.7)
    expect(healingMotes.tuning?.spawnScale).toBeLessThanOrEqual(0.6)
    expect(healingMotes.tuning?.size?.[1]).toBeGreaterThanOrEqual(0.16)
    const healingBoundary = getPfxRenderPlan(createPfxPreset('healing-aura')).surfaces
      .find((surface) => surface.phase === 'healing-aura-ground-boundary')!
    expect(healingBoundary.opacity).toBeGreaterThanOrEqual(0.9)
    expect(healingBoundary.tuning?.meshMotion).toBe('pulse')
    const boundaryOnset = PfxLibrary.getPfxSurfaceAnimationProps(healingBoundary, createPfxPreset('healing-aura').controls, 0.08)
    const boundaryPeak = PfxLibrary.getPfxSurfaceAnimationProps(healingBoundary, createPfxPreset('healing-aura').controls, 0.2)
    const boundaryDecay = PfxLibrary.getPfxSurfaceAnimationProps(healingBoundary, createPfxPreset('healing-aura').controls, 0.92)
    expect(boundaryPeak.scaleMultiplier).toBeGreaterThan(boundaryOnset.scaleMultiplier)
    expect(boundaryDecay.opacityMultiplier).toBeCloseTo(0.32)
    expect(boundaryDecay.opacityMultiplier).toBeLessThan(boundaryPeak.opacityMultiplier)
  })

  it('preserves authored mesh orientation while applying runtime surface motion', () => {
    const object = new THREE.Object3D()
    object.rotation.set(0, 0, -Math.PI / 2)
    const authored = object.quaternion.clone()

    applyPfxSurfaceRotation(object, new THREE.Quaternion(), false, 0)
    expect(object.quaternion.angleTo(authored)).toBeLessThan(1e-6)

    applyPfxSurfaceRotation(object, new THREE.Quaternion(), false, Math.PI / 4)
    const expected = authored.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4))
    expect(object.quaternion.angleTo(expected)).toBeLessThan(1e-6)
  })

  it('compensates a transformed parent when a surface faces the world camera', () => {
    const parent = new THREE.Object3D()
    parent.rotation.y = Math.PI / 2
    const object = new THREE.Object3D()
    parent.add(object)
    parent.updateWorldMatrix(true, true)
    const parentWorldQuaternion = new THREE.Quaternion()
    parent.getWorldQuaternion(parentWorldQuaternion)
    const cameraQuaternion = new THREE.Quaternion()
    applyPfxSurfaceRotation(object, cameraQuaternion, true, 0, parentWorldQuaternion)
    parent.updateWorldMatrix(true, true)
    const worldQuaternion = new THREE.Quaternion()
    object.getWorldQuaternion(worldQuaternion)
    expect(worldQuaternion.angleTo(cameraQuaternion)).toBeLessThan(1e-6)
  })

  it('audits beat choreography deterministically from per-layer timing data', () => {
    const audit = PfxLibrary.createPfxChoreographyAudit as unknown as (plan: {
      effectId: string
      surfaces: Array<{ kind: string; role: string; phase?: string; tuning?: Record<string, unknown> }>
    }) => {
      effectId: string
      kind: 'burst' | 'loop'
      beats: Array<{ phase: string; startFraction: number }>
      findings: string[]
      passed: boolean
    }
    expect(audit).toBeTypeOf('function')

    // Co-firing burst: every layer starts inside the first 8% of the cycle —
    // "N emitters stacked together", the automatic R17 fail.
    const coFiring = audit({
      effectId: 'co-firing',
      surfaces: [
        { kind: 'particles', role: 'impact', phase: 'a', tuning: { window: 0.2 } },
        { kind: 'particles', role: 'impact', phase: 'b', tuning: { window: 0.2, delay: 0.04 } },
        { kind: 'particles', role: 'volume', phase: 'c', tuning: { window: 0.3, delay: 0.06 } },
        { kind: 'particles', role: 'impact', phase: 'd', tuning: { window: 0.2, delay: 0.08 } },
      ],
    })
    expect(coFiring.kind).toBe('burst')
    expect(coFiring.passed).toBe(false)
    expect(coFiring.findings.join(' ')).toMatch(/co-fir|first/i)

    // Staged burst: opening flash beat, mid fireball, late smoke handoff.
    const staged = audit({
      effectId: 'staged',
      surfaces: [
        { kind: 'core-sphere', role: 'impact', phase: 'flash', tuning: { meshMotion: 'flash' } },
        { kind: 'particles', role: 'impact', phase: 'sparks', tuning: { window: 0.08 } },
        { kind: 'particles', role: 'impact', phase: 'fireball', tuning: { window: 0.14, delay: 0.06 } },
        { kind: 'particles', role: 'volume', phase: 'smoke', tuning: { window: 0.35, delay: 0.22, lifeScale: 1.6 } },
      ],
    })
    expect(staged.passed).toBe(true)
    expect(staged.findings).toEqual([])
    expect(staged.beats.map((beat) => beat.phase)).toEqual(['flash', 'sparks', 'fireball', 'smoke'])

    // Continuous loops (auras, shields) have no burst staging to audit.
    const loop = audit({
      effectId: 'loop',
      surfaces: [
        { kind: 'shield-shell', role: 'aura', phase: 'shell', tuning: {} },
        { kind: 'particles', role: 'aura', phase: 'motes', tuning: {} },
      ],
    })
    expect(loop.kind).toBe('loop')
    expect(loop.passed).toBe(true)

    // Burst with no late resolution beat: the late layer is a short pop
    // (tiny lifeScale) — everything is gone shortly after the peak.
    const noResolution = audit({
      effectId: 'no-resolution',
      surfaces: [
        { kind: 'particles', role: 'impact', phase: 'a', tuning: { window: 0.08 } },
        { kind: 'particles', role: 'impact', phase: 'b', tuning: { window: 0.08, delay: 0.3, lifeScale: 0.2 } },
      ],
    })
    expect(noResolution.passed).toBe(false)
    expect(noResolution.findings.join(' ')).toMatch(/resolution|handoff|late/i)

    // The explosion is the choreography reference implementation: staged
    // beats per the researched spec (flash -> ring -> sparks -> fireball ->
    // debris -> dust -> smoke handoff -> embers), audit-clean.
    const explosion = audit(getPfxRenderPlan(createPfxPreset('explosion')) as never)
    expect(explosion.kind).toBe('burst')
    expect(explosion.findings).toEqual([])
    expect(explosion.passed).toBe(true)
    const explosionStarts = new Set(explosion.beats.map((beat) => beat.startFraction))
    expect(explosionStarts.size).toBeGreaterThanOrEqual(5)
  })

  it('exposes the real burst-cycle duration so a single play ends when the last particle dies', () => {
    const cycleSeconds = PfxLibrary.getPfxBurstCycleSeconds as unknown as (preset: {
      controls: { lifetime: number; timing: number; style: string }
    }) => number
    expect(cycleSeconds).toBeTypeOf('function')

    const preset = createPfxPreset('explosion')
    const styleProfile = getPfxStyleRenderProfile(preset.controls.style)
    const plan = getPfxRenderPlan(preset)
    const base =
      (Math.max(0.3, preset.controls.lifetime) * 1.65) /
      (Math.max(0.05, preset.controls.timing) * styleProfile.motionMultiplier)
    // v2: the cycle extends so long-lived layers finish instead of being
    // hard-cut at the wrap, and the recipe tempo compresses the clock —
    // duration signals significance (impulse profile: total 1-1.5s).
    const expected = (base / plan.tempo) * PfxLibrary.getPfxCycleScale(plan.surfaces)
    expect(cycleSeconds(preset)).toBeCloseTo(expected, 5)
    expect(plan.tempo).toBeGreaterThan(1)
    expect(cycleSeconds(preset)).toBeGreaterThan(1)
    expect(cycleSeconds(preset)).toBeLessThan(1.5)
  })

  it('evaluates every effect against the researched low-end and mid device benchmarks', () => {
    const benchmarks = PfxLibrary.PFX_MOBILE_DEVICE_BENCHMARKS as unknown as Array<{
      deviceClass: string
      maxLiveParticles: number
      maxVfxDrawCalls: number
      vfxGpuBudgetMs: number
      concurrentLargeEffects: number
    }>
    expect(benchmarks.map((row) => row.deviceClass)).toEqual(['low-end', 'mid'])
    const lowEnd = benchmarks[0]!
    // Researched values (Notion: Mobile VFX Performance Benchmark).
    expect(lowEnd.maxLiveParticles).toBe(150)
    expect(lowEnd.maxVfxDrawCalls).toBe(8)
    expect(lowEnd.vfxGpuBudgetMs).toBe(2)
    expect(lowEnd.concurrentLargeEffects).toBe(3)

    const evaluate = PfxLibrary.createPfxMobileBenchmarkReport as unknown as (preset: unknown) => Array<{
      deviceClass: string
      passedSingle: boolean
      passedConcurrent: boolean
      findings: string[]
    }>
    const explosion = evaluate(createPfxPreset('explosion'))
    expect(explosion).toHaveLength(2)
    // Post-diet (intelligent per-layer cuts + size compensation): peak-live
    // fits the low-end screen budget even at x3 concurrency. Remaining
    // concurrent findings are draw-calls/frame-estimate — renderer batching
    // work for the catalog-wide perf pass, not per-effect dieting.
    const explosionLowEnd = explosion[0]!
    expect(explosionLowEnd.passedSingle).toBe(true)
    expect(explosionLowEnd.findings.join(' ')).not.toMatch(/particles/i)
    const peakLive = (PfxLibrary.createPfxPeakLiveParticles as unknown as (preset: unknown) => number)(
      createPfxPreset('explosion'),
    )
    expect(peakLive).toBeLessThanOrEqual(50)
    expect(peakLive * 3).toBeLessThanOrEqual(150)

    // The badge tells the computed truth: post-diet the explosion passes the
    // low-end screen, so the legacy name-based 'caution' tag is stale.
    const computed = PfxLibrary.getPfxComputedMobileSafety as unknown as (effectId: string) => string
    expect(computed('explosion')).toBe('safe')
    // blast-trail's scary '675 particles' was the SIM BUFFER size; its
    // shader-faithful peak-alive is 6. With the content-derived frame-cost
    // estimate (flat tier constants failed a 6-particle telegraph at x3
    // identically to a 38-particle hero) the honest verdict is safe — the
    // whole catalog passes single-instance low-end; concurrency is gated on
    // runtime instance-pooling, not on recipes.
    expect(computed('blast-trail')).toBe('safe')
  })

  it('lints emitter physics deterministically from the batch-01 review learnings', () => {
    const lint = PfxLibrary.createPfxEmitterPhysicsFindings as unknown as (plan: {
      surfaces: Array<{ kind: string; role: string; phase?: string; tuning?: Record<string, unknown> }>
    }) => Array<{ phase: string; rule: string }>
    const rules = (surfaces: Array<Record<string, unknown>>) =>
      lint({ surfaces: surfaces as never }).map((finding) => finding.rule)

    expect(rules([{ kind: 'impact-sparks', role: 'impact', phase: 'a', tuning: { sprite: 'streak', stretch: 2, gravity: -1.5 } }])).toContain('stretched-streak-gravity')
    expect(rules([{ kind: 'impact-sparks', role: 'impact', phase: 'a', tuning: { sprite: 'debris', gravity: -3 } }])).toContain('ballistic-wobble')
    expect(rules([{ kind: 'particles', role: 'volume', phase: 'a', tuning: { sprite: 'smoke', bands: 2 } }])).toContain('banded-soft-matter')
    expect(rules([{ kind: 'particles', role: 'impact', phase: 'a', tuning: { sprite: 'fire', bands: 3 } }])).toContain('banded-glow-body')
    expect(rules([{ kind: 'particles', role: 'impact', phase: 'a', tuning: { sprite: 'debris', spinScale: 3, size: [0.3, 0.25, 0.1], gravity: -1, turbulenceScale: 0 } }])).toContain('pinwheel-dots')
    expect(
      rules([
        { kind: 'impact-sparks', role: 'impact', phase: 'a', tuning: { sprite: 'streak', stretch: 2, gravity: 0, turbulenceScale: 0 } },
        { kind: 'particles', role: 'trail', phase: 'b', tuning: { sprite: 'spark', stretch: 1, gravity: 0, turbulenceScale: 0 } },
      ]),
    ).toContain('multiple-line-languages')

    // The choreographed explosion is lint-clean.
    expect(PfxLibrary.createPfxEmitterPhysicsFindings(getPfxRenderPlan(createPfxPreset('explosion')))).toEqual([])
  })

  it('gives every explosion emitter physically justified motion', () => {
    const surfaces = getPfxRenderPlan(createPfxPreset('explosion')).surfaces
    const layer = (phase: string) => surfaces.find((surface) => surface.phase === phase)!
    // Ballistic ejecta fly straight under drag and gravity — the turbulence
    // wobble made dots visibly orbit their own path, which no explosion does.
    expect(layer('spark-jets').tuning?.turbulenceScale).toBe(0)
    expect(layer('debris-chunks').tuning?.turbulenceScale).toBe(0)
    expect(layer('ember-afterglow').tuning?.turbulenceScale).toBe(0)
    // Embers are falling dots that flicker, not a second line language —
    // spark-jets is the only velocity-stretched layer.
    expect(layer('ember-afterglow').tuning?.stretch).toBe(0)
    const stretched = surfaces.filter((surface) => (surface.tuning?.stretch ?? 0) > 0.5)
    expect(stretched.map((surface) => surface.phase)).toEqual(['spark-jets'])
    // Hot gas churns a little; media layers keep their turbulence.
    expect(layer('fire-roil').tuning?.turbulenceScale).toBeLessThanOrEqual(0.6)
    // Sparks are straight radial lines that shrink out: gravity would keep
    // re-bending the velocity-aligned streak, rotating it in place.
    expect(layer('spark-jets').tuning?.gravity).toBe(0)
    // Embers were CARRIED up by the fireball/smoke: they spawn lifted into
    // the cloud volume, drift weakly (no late outward burst), fall gently
    // under drag, and gutter (flicker) as they cool.
    const embers = layer('ember-afterglow').tuning!
    // Distributed around the explosion's mass — centered in the cloud body,
    // wide spread; not a band floating above it.
    expect(embers.spawnLift ?? 0).toBeGreaterThanOrEqual(0.2)
    expect(embers.spawnLift ?? 0).toBeLessThanOrEqual(0.5)
    expect(embers.spawnScale ?? 1).toBeGreaterThanOrEqual(1.2)
    // Manual review pass 2026-07-11 (values delivered via the emitter
    // inspector): fine near-weightless embers with a hard gutter blink.
    // (Recipe-level scale — the render plan multiplies in controls.scale.)
    expect(
      PfxLibrary.AUTHORED_EFFECT_RECIPES['explosion']!.surfaces.find((surface) => surface.phase === 'ember-afterglow')!.scale,
    ).toBe(0.4)
    expect(embers.gravity).toBe(-0.5)
    expect(embers.flicker).toBe(2)
    expect(Array.isArray(embers.size) ? embers.size[0] : 0).toBe(0.24)
    expect(embers.flicker ?? 0).toBeGreaterThanOrEqual(0.3)
    expect(embers.speedScale ?? 1).toBeLessThanOrEqual(0.5)
    expect(embers.gravity).toBeLessThan(0)
    expect(embers.gravity).toBeGreaterThan(-2)
    // Chunk tumble stays physical, never pinwheel-fast at dot scale.
    expect(layer('debris-chunks').tuning?.spinScale ?? 0).toBeLessThanOrEqual(1.2)
  })

  it('cones emission around a declared attack vector (impact two-vector model)', () => {
    const preset = createPfxPreset('hit-spark')
    const surface = {
      kind: 'particles' as const,
      role: 'impact' as const,
      opacity: 1,
      scale: 1,
      phase: 'vector-test',
      tuning: { impactVector: [1, 0.2, 0] as [number, number, number], spreadAngle: 0.5 },
    }
    const emission = PfxLibrary.createPfxParticleEmission(
      { effectId: 'hit-spark', controls: preset.controls, implementationProfile: preset.implementationProfile },
      surface,
    )
    const axisLen = Math.hypot(1, 0.2, 0)
    const axis = [1 / axisLen, 0.2 / axisLen, 0]
    for (let i = 0; i < emission.count; i++) {
      const dx = emission.direction[i * 3]!
      const dy = emission.direction[i * 3 + 1]!
      const dz = emission.direction[i * 3 + 2]!
      const dot = dx * axis[0]! + dy * axis[1]! + dz * axis[2]!
      // Every direction inside the declared cone (cos 0.5 ~ 0.877).
      expect(dot).toBeGreaterThan(0.87)
    }
  })

  it('locks certified effects out of later group-pass work lists', () => {
    // The role axis overlaps semantic categories: explosion-pass alumni sit
    // inside the burst role. A later group pass must not re-author them.
    const burstIds = PfxLibrary.PFX_TAXONOMY.filter((effect) => effect.role === 'burst').map((effect) => effect.id)
    const workList = PfxLibrary.getPfxGroupWorkList(burstIds)
    expect(burstIds).toContain('explosion')
    expect(workList).not.toContain('explosion')
    expect(workList).not.toContain('blast-burst')
    expect(workList).not.toContain('shockwave-burst')
    expect(workList).not.toContain('critical-hit-burst')
    // Burst group certified 2026-07-11: the whole role group is locked.
    expect(workList.length).toBe(0)
    // Certified effects still run the gate — locked, not exempt.
    expect(PfxLibrary.createPfxGroupReadinessReport(['explosion']).pass).toBe(true)
  })

  it('gates group completion on the full deterministic battery (group readiness report)', () => {
    // Review rule (2026-07-11): a behavior group is DONE only when every
    // effect passes choreography, physics lint, honest single-instance
    // device budgets, and sim-buffer discipline — one report, one verdict.
    const explosionIds = PfxLibrary.PFX_TAXONOMY.filter((effect) => effect.effectType === 'explosion').map(
      (effect) => effect.id,
    )
    const explosion = PfxLibrary.createPfxGroupReadinessReport(explosionIds)
    expect(explosion.rows.length).toBeGreaterThanOrEqual(12)
    expect(explosion.pass, `explosion group blocked: ${explosion.blockedEffectIds.join(',')}`).toBe(true)
    // Buffers stay disciplined: dead sim particles still cost vertex work.
    for (const row of explosion.rows) expect(row.bufferWasteRatio).toBeLessThanOrEqual(3)

    const projectile = PfxLibrary.createPfxGroupReadinessReport(['fireball'])
    expect(projectile.pass, `projectile group blocked: ${projectile.blockedEffectIds.join(',')}`).toBe(true)

    // 2026-07-12: the last known-blocked fixture (coin-pickup-sparkle) was
    // fixed by the reward exemplar — the full 500-effect catalog now gates
    // clean. The gate itself is proven to still gate via the choreography
    // audit on a synthetic beat-less effect (nothing inherits energy late).
    const fixed = PfxLibrary.createPfxGroupReadinessReport(['coin-pickup-sparkle'])
    expect(fixed.pass).toBe(true)
    const synthetic = PfxLibrary.createPfxChoreographyAudit({
      effectId: 'synthetic-blocked',
      surfaces: [
        { kind: 'impact-sparks', role: 'impact', opacity: 1, scale: 0.5, phase: 'lone-burst', tuning: { window: 0.08, lifeScale: 0.2 } },
      ],
    })
    expect(synthetic.findings.length).toBeGreaterThan(0)
  })

  it('applies Octopo-feel banded ramps, erosion deaths, and snap easing across batch-01 recipes', () => {
    const surfacesOf = (effectId: string) => getPfxRenderPlan(createPfxPreset(effectId)).surfaces
    const layer = (effectId: string, phase: string) => {
      const surface = surfacesOf(effectId).find((candidate) => candidate.phase === phase)
      expect(surface, `${effectId} needs layer ${phase}`).toBeTruthy()
      return surface!
    }

    // R4 temperature bands on the drawn hot SHAPES only — glow bodies
    // (fire/flame sprites) never band: additive glow IS the fire read.
    expect(layer('fireball', 'flame-trail').tuning?.bands).toBeUndefined()
    // Review verdict (batch-01): banding the explosion fireball killed the
    // fire read — additive glow is the fire; no bands there.
    expect(layer('explosion', 'fire-roil').tuning?.bands).toBeUndefined()
    // Muzzle rebuild: the flash cards carry the hot read while a late alpha
    // smoke wisp gives the one-frame pop a material resolution beat.
    expect(layer('muzzle-flash', 'smoke-wisp').tuning?.blend).toBe('alpha')
    // Hit-spark's hot structure is particle-authored: a compact glow anchors
    // an irregular streak fan without resurrecting the old mesh star.
    const hitSparkHero = layer('hit-spark', 'hit-spark-particle-random-fan')
    expect(hitSparkHero.kind).toBe('particles')
    expect(hitSparkHero.tuning?.colorOverride).toBe('#ffd45e')

    // R10 erosion deaths on hard-edged matter layers. Soft alpha smoke grows
    // while fading; erosion turns its cards into square/dither holes.
    // (fireball's additive glow wake uses the additive shrink-out instead —
    // erode carved the soft plume into debris chunks; see projectile spec.)
    expect(layer('explosion', 'linger-smoke').tuning?.death).toBe('erode')
    expect(layer('smoke-puff', 'puff-bloom').tuning?.death).toBeUndefined()
    expect(layer('smoke-puff', 'wisp-breakup').tuning?.death).toBeUndefined()
    expect(layer('footstep-dust', 'ground-scuff').tuning?.death).toBeUndefined()

    // R9 snap easing on burst envelopes. The fireball is a held note, not a
    // burst — its trail churns continuously, so no snap ease there (see the
    // projectile-spec pin below); hit-spark carries a dedicated shaped
    // mesh lifecycle instead of generic sprite easing.
    expect(layer('smoke-puff', 'puff-bloom').tuning?.ease).toBe('snap')
    expect(hitSparkHero.tuning?.lifecycle).toBe('hit-spark-particle-confirm')

    // R3 value hierarchy: smoke-puff gets a compact dark condensation seed
    // against the lifted hero body; late wisps stay light enough to read.
    expect(layer('smoke-puff', 'impact-condensation').tuning?.ramp).toBe('dark')

    // R1/R12 force-field must visibly live: an orbiting boundary pulse.
    expect(layer('force-field', 'boundary-pulse').tuning?.motion).toBe('orbit-ring')

    // R16 readability: the hero aura uses one instanced 3D leaf field; the
    // procedural leaf sprite remains available to lower-cost nature effects.
    expect(layer('healing-aura', 'restoration-leaf-bloom-and-helix').kind).toBe('healing-glyphs')
    expect(PfxLibrary.PFX_SPRITE_SLICES.leaf.source).toBe('procedural:life-leaf')
    expect(layer('footstep-dust', 'ground-scuff').opacity).toBeGreaterThanOrEqual(0.8)

    // R3 loot-beam: the gem is the focal element; the column supports.
    const lootBeam = surfacesOf('loot-beam')
    const column = lootBeam.find((surface) => surface.phase === 'locator-column')!
    const gem = lootBeam.find((surface) => surface.phase === 'ground-loot-anchor-gem')!
    const locatorRing = lootBeam.find((surface) => surface.phase === 'ground-loot-locator-reticle')!
    expect(gem.opacity).toBeGreaterThan(column.opacity)
    expect(locatorRing.kind).toBe('ring-field')
    expect(locatorRing.tuning?.ringPurpose).toBe('reticle')
    expect(locatorRing.tuning?.meshMotion).toBe('pulse')
    expect(locatorRing.scale).toBeGreaterThanOrEqual(0.55)
    expect(lootBeam.some((surface) => surface.phase === 'reward-idle-motes')).toBe(false)
  })

  it('renders a plan from an explicit recipe override so frozen baselines can play beside live recipes', () => {
    const preset = createPfxPreset('fireball')
    const live = getPfxRenderPlan(preset)
    const frozen = JSON.parse(JSON.stringify(PfxLibrary.AUTHORED_EFFECT_RECIPES['fireball'])) as {
      id: string
      effectId: string
      label: string
      intent: string
      surfaces: unknown[]
    }
    frozen.id = 'fireball-baseline-snapshot'
    frozen.surfaces = frozen.surfaces.slice(0, 1)

    const overridden = getPfxRenderPlan(preset, { recipeOverride: frozen as never })
    expect(overridden.authoredRecipeId).toBe('fireball-baseline-snapshot')
    expect(overridden.signature).not.toBe(live.signature)
    // Without an override, behavior is byte-identical to before the feature.
    expect(getPfxRenderPlan(preset)).toEqual(live)
  })

  it('balances generated taxonomy coverage across production families instead of truncating early families', () => {
    const ids = new Set(PFX_TAXONOMY.map((effect) => effect.id))
    for (const requiredId of [
      'snow-burst',
      'wind-burst',
      'leaf-burst',
      'poison-burst',
      'healing-burst',
      'holy-burst',
      'curse-burst',
      'shadow-burst',
      'portal-burst',
      'spawn-burst',
      'shield-burst',
      'warning-burst',
      'dash-burst',
      'engine-burst',
    ]) {
      expect(ids.has(requiredId), `missing ${requiredId}`).toBe(true)
    }

    const counts = PFX_TAXONOMY.reduce<Record<string, number>>((acc, effect) => {
      acc[effect.effectType] = (acc[effect.effectType] ?? 0) + 1
      return acc
    }, {})

    expect(counts.status).toBeGreaterThanOrEqual(20)
    expect(counts.spawn).toBeGreaterThanOrEqual(10)
    expect(counts.telegraph).toBeGreaterThanOrEqual(20)
    expect(counts.movement).toBeGreaterThanOrEqual(20)
    expect(counts.weather).toBeGreaterThanOrEqual(35)

    for (const variant of [
      'ring',
      'cone',
      'spray',
      'column',
      'screen',
      'pickup',
      'hit',
      'miss',
      'ambient',
      'spawn',
      'death',
      'critical',
      'low-health',
    ]) {
      expect(
        PFX_TAXONOMY.some((effect) => effect.id.endsWith(`-${variant}`)),
        `missing generated variant ${variant}`,
      ).toBe(true)
    }
  })

  it('rejects incoherent generated family and variant pairs while preserving useful variant coverage', () => {
    const ids = new Set(PFX_TAXONOMY.map((effect) => effect.id))
    const incompatibleFamiliesByVariant: Record<string, string[]> = {
      impact: ['rain', 'bubble', 'healing', 'pickup', 'reward', 'ui'],
      hit: ['rain', 'bubble', 'healing', 'pickup', 'reward', 'ui'],
      trail: ['pickup', 'reward', 'combo', 'ui'],
      loop: ['blast', 'shockwave', 'meteor'],
      idle: ['blast', 'shockwave', 'meteor'],
      charge: ['rain', 'bubble', 'leaf', 'petal', 'pickup', 'ui'],
      release: ['pickup', 'reward', 'combo', 'ui'],
      pickup: ['blast', 'portal', 'blood'],
      miss: ['bubble', 'healing', 'reward'],
      'low-health': ['rain'],
      critical: ['water', 'snow'],
      death: ['ui'],
      screen: ['blast', 'rain'],
    }

    for (const implausibleId of [
      'blast-pickup',
      'bubble-miss',
      'rain-low-health',
      'water-critical',
      'snow-critical',
      'ui-death',
      'healing-miss',
      'reward-miss',
      'portal-pickup',
      'blood-pickup',
    ]) {
      expect(ids.has(implausibleId), `unexpected incoherent taxonomy entry ${implausibleId}`).toBe(false)
    }

    for (const [variant, families] of Object.entries(incompatibleFamiliesByVariant)) {
      for (const family of families) {
        const id = `${family}-${variant}`
        expect(ids.has(id), `unexpected incompatible generated pair ${id}`).toBe(false)
      }
    }

    for (const plausibleId of [
      'blast-impact',
      'bubble-loop',
      'rain-loop',
      'barrier-low-health',
      'debris-miss',
      'electric-critical',
      'poison-death',
      'pickup-burst',
      'ui-pickup',
      'spawn-screen',
    ]) {
      expect(ids.has(plausibleId), `missing plausible taxonomy entry ${plausibleId}`).toBe(true)
    }
  })

  it('ships one validated preset per taxonomy entry with mobile budgets and style clusters', () => {
    expect(ART_STYLE_CLUSTERS).toEqual(
      expect.arrayContaining([
        'realistic',
        'stylized',
        'anime',
        'pixel-retro',
        'cozy',
        'sci-fi',
        'magical',
        'horror',
        'tactical',
        'arcade',
        'low-poly',
        'painterly',
        'neon',
        'toon',
        'fantasy',
        'elemental',
        'abstract',
      ]),
    )
    expect(PFX_PRESETS).toHaveLength(500)
    expect(new Set(PFX_PRESETS.map((preset) => preset.effectId)).size).toBe(500)

    for (const preset of PFX_PRESETS) {
      const budget = PERFORMANCE_TIER_BUDGETS[preset.performance.tier]
      expect(preset.performance.maxParticles).toBeLessThanOrEqual(budget.maxParticles)
      expect(preset.performance.maxDrawCalls).toBeLessThanOrEqual(budget.maxDrawCalls)
      expect(preset.performance.textureMemoryKb).toBeLessThanOrEqual(budget.textureMemoryKb)
      expect(preset.controls.color.length).toBeGreaterThan(0)
      expect(preset.controls.lod).toEqual(expect.arrayContaining(['low', 'medium', 'high']))
      expect(preset.preview.thumbnail.kind).toBe('procedural-gradient')
      expect(preset.preview.clip.frames).toBeGreaterThanOrEqual(12)
      expect(preset.preview.clip.durationMs).toBeGreaterThan(0)
      expect(validatePfxPreset(preset).valid).toBe(true)
    }
  })

  it('exports a complete preview manifest for every catalog effect', () => {
    const manifest = createPfxPreviewManifest()

    expect(manifest.schema).toBe('game-bot.r3f-pfx-preview-manifest.v1')
    expect(manifest.effects).toHaveLength(500)
    expect(new Set(manifest.effects.map((effect) => effect.effectId)).size).toBe(500)
    expect(manifest.summary.totalEffects).toBe(500)
    expect(manifest.summary.authoredPreviewEffects).toBe(500)
    expect(manifest.summary.profileBackedEffects).toBe(0)

    const forceField = manifest.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      name: 'Force Field',
      marketSourceFamilies: PFX_TAXONOMY.find((effect) => effect.id === 'force-field')?.marketSourceFamilies,
      marketSourceUrls: PFX_TAXONOMY.find((effect) => effect.id === 'force-field')?.marketSourceUrls,
      thumbnail: {
        kind: 'procedural-gradient',
        alt: expect.stringContaining('Force Field'),
      },
      clip: {
        kind: 'procedural-loop',
        frames: expect.any(Number),
        durationMs: expect.any(Number),
      },
      mobileSafety: 'safe',
      acceptanceStatus: 'authored-preview',
    })
    expect(forceField?.thumbnail.css).toContain('radial-gradient')
    expect(forceField?.thumbnailAsset).toMatchObject({
      kind: 'svg',
      fileName: 'force-field.svg',
      mimeType: 'image/svg+xml',
      width: 256,
      height: 144,
    })
    expect(forceField?.thumbnailAsset.svg).toContain('<svg')
    expect(forceField?.thumbnailAsset.svg).toContain('Force Field')
    expect(forceField?.thumbnailAsset.svg).toContain('aria-label')
    expect(forceField?.thumbnailAsset.dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(forceField?.clipAsset).toMatchObject({
      kind: 'animated-svg',
      fileName: 'force-field-clip.svg',
      mimeType: 'image/svg+xml',
      width: 256,
      height: 144,
      durationMs: forceField?.clip.durationMs,
      frames: forceField?.clip.frames,
    })
    expect(forceField?.clipAsset.svg).toContain('<animate')
    expect(forceField?.clipAsset.svg).toContain('Force Field')
    expect(forceField?.clipAsset.dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(forceField?.styleContactSheetAsset).toMatchObject({
      kind: 'contact-sheet-svg',
      fileName: 'force-field-style-contact-sheet.svg',
      mimeType: 'image/svg+xml',
      width: 512,
      height: 288,
      sheetType: 'style-variants',
    })
    expect(forceField?.styleContactSheetAsset.svg).toContain('Force Field style variants')
    expect(forceField?.styleContactSheetAsset.svg).toContain('realistic')
    expect(forceField?.styleContactSheetAsset.svg).toContain('abstract')
    expect(forceField?.styleContactSheetAsset.dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(forceField?.controlExtremesContactSheetAsset).toMatchObject({
      kind: 'contact-sheet-svg',
      fileName: 'force-field-control-extremes-contact-sheet.svg',
      mimeType: 'image/svg+xml',
      width: 512,
      height: 288,
      sheetType: 'control-extremes',
    })
    expect(forceField?.controlExtremesContactSheetAsset.svg).toContain('Force Field control extremes')
    expect(forceField?.controlExtremesContactSheetAsset.svg).toContain('density')
    expect(forceField?.controlExtremesContactSheetAsset.svg).toContain('min/default/max')
    expect(forceField?.controlExtremesContactSheetAsset.dataUri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(forceField?.clip.frames).toBeGreaterThanOrEqual(12)
    expect(forceField?.performance.expectedFrameCostMs).toBeGreaterThan(0)

    const exported = JSON.parse(exportPfxPreviewManifestJson())
    expect(exported).toMatchObject({
      schema: 'game-bot.r3f-pfx-preview-manifest.v1',
      effects: expect.any(Array),
      summary: {
        totalEffects: 500,
      },
    })
    expect(exported.effects[0].thumbnailAsset.svg).toContain('<svg')
    expect(exported.effects.every((effect: { thumbnailAsset?: { fileName?: string; dataUri?: string } }) =>
      effect.thumbnailAsset?.fileName?.endsWith('.svg') &&
      effect.thumbnailAsset.dataUri?.startsWith('data:image/svg+xml')
    )).toBe(true)
    expect(exported.effects.every((effect: { clipAsset?: { fileName?: string; svg?: string; dataUri?: string } }) =>
      effect.clipAsset?.fileName?.endsWith('-clip.svg') &&
      effect.clipAsset.svg?.includes('<animate') &&
      effect.clipAsset.dataUri?.startsWith('data:image/svg+xml')
    )).toBe(true)
    expect(exported.effects.every((effect: {
      styleContactSheetAsset?: { fileName?: string; svg?: string; dataUri?: string }
      controlExtremesContactSheetAsset?: { fileName?: string; svg?: string; dataUri?: string }
    }) =>
      effect.styleContactSheetAsset?.fileName?.endsWith('-style-contact-sheet.svg') &&
      effect.styleContactSheetAsset.svg?.includes('style variants') &&
      effect.styleContactSheetAsset.dataUri?.startsWith('data:image/svg+xml') &&
      effect.controlExtremesContactSheetAsset?.fileName?.endsWith('-control-extremes-contact-sheet.svg') &&
      effect.controlExtremesContactSheetAsset.svg?.includes('control extremes') &&
      effect.controlExtremesContactSheetAsset.dataUri?.startsWith('data:image/svg+xml')
    )).toBe(true)
  })

  it('exports an all-effect preview asset audit for thumbnails and animated clips', () => {
    const audit = createPfxPreviewAssetAudit()
    const forceField = audit.effects.find((effect) => effect.effectId === 'force-field')

    expect(audit.schema).toBe('game-bot.r3f-pfx-preview-asset-audit.v1')
    expect(audit.summary).toEqual({
      totalEffects: 500,
      thumbnailAssets: 500,
      clipAssets: 500,
      styleContactSheetAssets: 500,
      controlExtremesContactSheetAssets: 500,
      animatedClipAssets: 500,
      accessibleAssets: 500,
      effectsPassingPreviewAudit: 500,
    })
    expect(audit.instructions).toMatchObject({
      approvalStatus: 'non-approving-preview-asset-evidence',
      previewManifestFile: '.context/r3f-pfx-preview-assets/preview-manifest.json',
    })
    expect(audit.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Use this audit to verify every effect has generated thumbnail, animated clip, style contact sheet, and control-extremes contact sheet evidence before production implementation approval.',
        'Treat passing generated SVG assets and contact sheets as preview coverage, not final captured gameplay footage.',
      ]),
    )
    expect(audit.effects).toHaveLength(500)
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      safe: true,
      thumbnailFileName: 'force-field.svg',
      clipFileName: 'force-field-clip.svg',
      styleContactSheetFileName: 'force-field-style-contact-sheet.svg',
      controlExtremesContactSheetFileName: 'force-field-control-extremes-contact-sheet.svg',
      thumbnailValid: true,
      clipValid: true,
      styleContactSheetValid: true,
      controlExtremesContactSheetValid: true,
      dataUriValid: true,
      accessible: true,
      animated: true,
      width: 256,
      height: 144,
      clipFrames: expect.any(Number),
      clipDurationMs: expect.any(Number),
      failureReasons: [],
    })
    expect(forceField?.clipFrames).toBeGreaterThanOrEqual(12)
    expect(forceField?.clipDurationMs).toBeGreaterThan(0)
  })

  it('uses every performance tier and keeps heavy tiers out of mobile-safe filters', () => {
    for (const tier of Object.keys(PERFORMANCE_TIER_BUDGETS)) {
      expect(
        filterPfxCatalog({ performanceTier: [tier as keyof typeof PERFORMANCE_TIER_BUDGETS] }).length,
        `missing catalog entries for ${tier} tier`,
      ).toBeGreaterThan(0)
    }

    const highTierItems = filterPfxCatalog({ performanceTier: ['high'] })
    const cinematicTierItems = filterPfxCatalog({ performanceTier: ['cinematic'] })
    expect(highTierItems.length).toBeGreaterThan(0)
    expect(cinematicTierItems.length).toBeGreaterThan(0)
    expect(highTierItems.some((item) => item.effect.mobileSafety === 'caution')).toBe(true)
    expect(cinematicTierItems.every((item) => item.effect.mobileSafety === 'cinematic-only')).toBe(true)
    expect(
      filterPfxCatalog({ performanceTier: ['high'], mobileSafeOnly: true }).map((item) => item.effect.id),
    ).toContain('plasma-hit')
    expect(filterPfxCatalog({ performanceTier: ['cinematic'], mobileSafeOnly: true })).toHaveLength(0)
  })

  it('publishes a shared mobile runtime policy with capped DPR and tier concurrency caps', () => {
    const policy = createPfxMobileRuntimePolicy()

    expect(policy).toEqual(PFX_MOBILE_RUNTIME_POLICY)
    expect(policy.schema).toBe('game-bot.r3f-pfx-mobile-runtime-policy.v1')
    expect(policy.maxDevicePixelRatio).toBe(1.5)
    expect(policy.canvasDprRange).toEqual([1, 1.5])
    expect(policy.webgl).toMatchObject({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    expect(policy.tierConcurrencyCaps).toEqual({
      low: 20,
      medium: 10,
      high: 4,
      cinematic: 1,
    })
    expect(policy.requiredOptimizations).toEqual(
      expect.arrayContaining([
        'capped-dpr',
        'deterministic-seeds',
        'lod-controls',
        'reduced-motion-fallback',
        'texture-atlas',
        'shared-geometry-cache',
        'profile-threshold-gate',
      ]),
    )
    expect(policy.finalAcceptanceRequiresRealDevices).toBe(true)
  })

  it('scores every preset against the full production quality rubric', () => {
    expect(PFX_QUALITY_RUBRIC_KEYS).toEqual([
      'gameReadiness',
      'visualProductionQuality',
      'mobilePerformance',
      'r3fIntegrationQuality',
      'customizationRange',
      'artStyleFidelity',
      'catalogCoverage',
      'documentationQuality',
      'exportCleanliness',
      'redTeamApproval',
    ])

    for (const preset of PFX_PRESETS) {
      expect(Object.keys(preset.quality.scores)).toEqual(PFX_QUALITY_RUBRIC_KEYS)
      for (const key of PFX_QUALITY_RUBRIC_KEYS) {
        expect(preset.quality.scores[key]).toBeGreaterThanOrEqual(1)
        expect(preset.quality.scores[key]).toBeLessThanOrEqual(5)
      }
      expect(preset.quality.total).toBeGreaterThanOrEqual(PFX_QUALITY_RUBRIC_KEYS.length)
      expect(preset.quality.max).toBe(PFX_QUALITY_RUBRIC_KEYS.length * 5)
      expect(preset.quality.summary).toContain(preset.acceptanceStatus)
      expect(preset.quality.evidence.length).toBeGreaterThanOrEqual(3)
    }

    const authored = createPfxPreset('force-field').quality
    const tailAuthored = createPfxPreset('spawn-telegraph').quality
    expect(filterPfxCatalog({ coverage: ['profile-backed'] })).toHaveLength(0)
    expect(authored.scores.visualProductionQuality).toBe(tailAuthored.scores.visualProductionQuality)
    expect(authored.scores.redTeamApproval).toBe(tailAuthored.scores.redTeamApproval)
  })

  it('fails closed unless the catalog meets the 3d structure ring discipline and cc0 asset floor', () => {
    const createAudit = (PfxLibrary as typeof PfxLibrary & {
      createPfxStructuralQualityAudit?: () => {
        schema: string
        passed: boolean
        thresholds: Record<string, number>
        summary: Record<string, number>
        effects: Array<{ effectId: string; findings: string[] }>
      }
    }).createPfxStructuralQualityAudit

    expect(createAudit).toBeTypeOf('function')
    const audit = createAudit!()
    expect(audit.schema).toBe('game-bot.r3f-pfx-structural-quality-audit.v1')
    expect(audit.passed).toBe(true)
    expect(audit.thresholds).toMatchObject({
      maximumRingEffectRatio: 0.5,
      minimumStructuredWorldEffectRatio: 0.8,
      minimumMeshSpawnEffectRatio: 0.3,
      minimumCc0AssetBackedEffectRatio: 0.7,
    })
    expect(audit.summary.decorativeRingSurfaces).toBe(0)
    expect(audit.summary.ringEffectRatio).toBeLessThanOrEqual(audit.thresholds.maximumRingEffectRatio)
    expect(audit.summary.structuredWorldEffectRatio).toBeGreaterThanOrEqual(
      audit.thresholds.minimumStructuredWorldEffectRatio,
    )
    expect(audit.summary.meshSpawnEffectRatio).toBeGreaterThanOrEqual(audit.thresholds.minimumMeshSpawnEffectRatio)
    expect(audit.summary.cc0AssetBackedEffectRatio).toBeGreaterThanOrEqual(
      audit.thresholds.minimumCc0AssetBackedEffectRatio,
    )
    expect(audit.effects.filter((effect) => effect.findings.length > 0)).toEqual([])
  })

  it('gives planar, screen, and aperture surfaces explicit multi-angle spatial policies', () => {
    const getSpatialPolicy = (PfxLibrary as typeof PfxLibrary & {
      getPfxSurfaceSpatialPolicy?: (surface: {
        kind: string
        role: string
        tuning?: { meshShader?: string }
      }) => {
        cameraFacing: boolean
        minimumDepth: number
        crossedVolume: boolean
      }
    }).getPfxSurfaceSpatialPolicy

    expect(getSpatialPolicy).toBeTypeOf('function')
    expect(getSpatialPolicy!({ kind: 'screen-plane', role: 'screen' })).toMatchObject({
      cameraFacing: true,
    })
    expect(getSpatialPolicy!({ kind: 'trail-ribbon', role: 'trail' })).toMatchObject({
      minimumDepth: 0.32,
      crossedVolume: true,
    })
    expect(getSpatialPolicy!({ kind: 'ring-field', role: 'aura', tuning: { meshShader: 'vortex-swirl' } })).toMatchObject({
      minimumDepth: 0.45,
      crossedVolume: true,
    })
  })

  it('gives portal motes a tunnel-depth distribution instead of a flat orbit', () => {
    const preset = createPfxPreset('portal-idle-loop')
    const surface = getPfxRenderPlan(preset).surfaces.find((candidate) => candidate.phase === 'depth-flow')
    expect(surface).toBeDefined()
    const emission = PfxLibrary.createPfxParticleEmission(preset, surface!)
    const depth = Array.from(emission.spawn).filter((_, index) => index % 3 === 2)
    expect(Math.max(...depth) - Math.min(...depth)).toBeGreaterThanOrEqual(0.6)
  })

  it('grounds contact and ground-information layers below centered body effects', () => {
    const getPositionOffset = (PfxLibrary as typeof PfxLibrary & {
      getPfxSurfacePositionOffset?: (surface: { role: string; phase?: string }) => [number, number, number]
    }).getPfxSurfacePositionOffset

    expect(getPositionOffset).toBeTypeOf('function')
    expect(getPositionOffset!({ role: 'volume', phase: 'heel-puff' })[1]).toBeLessThanOrEqual(-0.75)
    expect(getPositionOffset!({ role: 'aura', phase: 'ground-runes' })[1]).toBeLessThanOrEqual(-0.75)
    expect(getPositionOffset!({ role: 'aura', phase: 'warning-ring' })[1]).toBeLessThanOrEqual(-0.75)
    expect(getPositionOffset!({ role: 'body', phase: 'hot-core' })).toEqual([0, 0, 0])
  })

  it('authors the weakest seed effects with distinct mesh, motion, and timing verbs', () => {
    const plan = (effectId: string) => getPfxRenderPlan(createPfxPreset(effectId))
    const footstep = plan('footstep-dust')
    const footstepScuff = footstep.surfaces.find((surface) => surface.phase === 'ground-scuff')
    expect(footstepScuff?.tuning?.motion).toBe('ground-scuff')
    expect(footstepScuff?.scale).toBeLessThanOrEqual(0.85)
    // Batch-01 review: 'dark' dust was invisible against the dark arena —
    // the scuff holds a lifted tint and dissipates by alpha instead.
    expect(footstepScuff?.tuning?.ramp).toBe('held')
    expect(footstepScuff?.tuning?.death).toBeUndefined()
    expect(footstep.surfaces.some((surface) => surface.tuning?.sprite === 'debris' && surface.tuning?.motion === 'ground-scuff')).toBe(true)
    expect(footstep.surfaces.some((surface) => surface.kind === 'footprint-decal')).toBe(true)
    const scuffEmission = PfxLibrary.createPfxParticleEmission(createPfxPreset('footstep-dust'), footstepScuff!)
    const averageScuffX = Array.from(scuffEmission.direction).filter((_, index) => index % 3 === 0).reduce((sum, value) => sum + value, 0) / scuffEmission.count
    expect(averageScuffX).toBeLessThan(-0.55)

    const healing = plan('healing-aura')
    expect(healing.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(healing.surfaces.some((surface) => surface.kind === 'shield-shell')).toBe(false)
    expect(healing.surfaces.some((surface) => surface.kind === 'healing-glyphs')).toBe(true)
    expect(healing.surfaces.some((surface) => surface.kind === 'beam-column')).toBe(false)
    expect(healing.surfaces.some((surface) => surface.kind === 'healing-glyphs' && surface.phase === 'restoration-leaf-bloom-and-helix')).toBe(true)
    expect(healing.surfaces.some((surface) => surface.phase === 'restoration-soft-rise' && surface.tuning?.motion === 'column-rise')).toBe(true)
    expect(Math.max(...healing.surfaces.map((surface) => surface.scale))).toBeGreaterThanOrEqual(1.2)

    const charge = plan('charge-telegraph')
    expect(charge.surfaces.some((surface) => surface.tuning?.meshMotion === 'countdown')).toBe(true)
    expect(charge.surfaces.some((surface) => surface.kind === 'telegraph-disc')).toBe(true)
    expect(charge.surfaces.some((surface) => surface.tuning?.motion === 'converge-center')).toBe(true)
    expect(charge.surfaces.some((surface) => surface.kind === 'mesh-fragments')).toBe(false)

    // 2026-07-12 spawn-group pass: grunt-tier anatomy (ring decal that
    // charges, conceal flash, settling dust) replaced the beacon/voxel look.
    const spawn = plan('spawn-marker')
    const spawnRing = spawn.surfaces.find((surface) => surface.kind === 'ring-field')
    // Placement reticles advertise exact gameplay coverage: the radius stays
    // fixed while the interior conceal and settle layers carry the event.
    expect(spawnRing?.tuning?.meshMotion).toBeUndefined()
    expect(spawnRing?.tuning?.ringPurpose).toBe('reticle')
    const conceal = spawn.surfaces.find((surface) => surface.tuning?.meshMotion === 'flash')
    expect(conceal).toBeDefined()
    const settle = spawn.surfaces.find((surface) => surface.phase === 'spawn-marker-settle-dust')
    expect(settle?.tuning?.blend).toBe('alpha')
    expect(settle!.tuning!.delay).toBeGreaterThan(conceal!.tuning!.delay!)
    expect(settle?.tuning?.delay).toBeLessThanOrEqual(0.22)
    expect(PfxLibrary.PFX_SPAWN_VOXEL_LAYOUT).toHaveLength(12)

    const portal = plan('portal-idle-loop')
    expect(portal.surfaces.some((surface) => surface.kind === 'portal-throat' && surface.tuning?.meshShader === 'portal-throat')).toBe(true)
    expect(Math.max(...spawn.surfaces.map((surface) => surface.scale))).toBeGreaterThanOrEqual(1.1)
  })

  it('keeps the footstep hero dust compact and rounded instead of forming an impact star', () => {
    const scuff = getPfxRenderPlan(createPfxPreset('footstep-dust')).surfaces
      .find((surface) => surface.phase === 'ground-scuff')!

    expect(scuff.scale).toBeLessThanOrEqual(0.85)
    expect(scuff.tuning?.speedScale).toBeLessThanOrEqual(1.4)
    expect(scuff.tuning?.spawnScale).toBeLessThanOrEqual(0.7)
    expect(Math.max(...scuff.tuning!.size!)).toBeLessThanOrEqual(0.75)
    expect(scuff.tuning?.death).toBeUndefined()
  })

  it('makes soft footstep dust the volume and keeps hard grit subordinate', () => {
    const preset = createPfxPreset('footstep-dust')
    const surfaces = getPfxRenderPlan(preset).surfaces
    const scuff = surfaces.find((surface) => surface.phase === 'ground-scuff')!
    const grit = surfaces.find((surface) => surface.phase === 'ground-grit')!
    const scuffEmission = PfxLibrary.createPfxParticleEmission(preset, scuff)
    const gritEmission = PfxLibrary.createPfxParticleEmission(preset, grit)

    expect(scuffEmission.count).toBeGreaterThanOrEqual(gritEmission.count * 2)
    expect(grit.scale).toBeLessThanOrEqual(scuff.scale)
  })

  it('keeps the footstep ground mark compact enough to anchor rather than frame the effect', () => {
    const groundMark = getPfxRenderPlan(createPfxPreset('footstep-dust')).surfaces
      .find((surface) => surface.phase === 'ground-footprints')!

    expect(groundMark.scale).toBeLessThanOrEqual(0.45)
    expect(groundMark.opacity).toBeGreaterThanOrEqual(0.65)
  })

  it('builds shield break debris from closed radial facets instead of billboard shard sprites', () => {
    const fragments = getPfxRenderPlan(createPfxPreset('shield-break')).surfaces
      .find((surface) => surface.phase === 'glass-shards')!

    expect(fragments.kind).toBe('shield-fragments')
    expect(fragments.scale).toBeGreaterThanOrEqual(1.15)
    expect(fragments.scale).toBeLessThanOrEqual(1.3)
    expect(fragments.tuning?.sprite).toBeUndefined()
    expect(fragments.tuning?.lifecycle).toBe('impact-shard-burst')
    expect(isPfxSurfaceCameraFacing(fragments, 2)).toBe(false)
    expect(PfxLibrary.getPfxSurfaceSpatialPolicy(fragments)).toMatchObject({
      cameraFacing: false,
      crossedVolume: true,
      minimumDepth: 0.32,
    })
    const createGeometry = (PfxLibrary as unknown as {
      createPfxShieldFragmentGeometry: () => THREE.BufferGeometry
    }).createPfxShieldFragmentGeometry
    const geometry = createGeometry()
    expect(geometry.userData['pfxShieldFragmentDrawCalls']).toBe(1)
    expect(geometry.userData['pfxShieldFragmentCount']).toBeGreaterThanOrEqual(8)
    expect(geometry.userData['pfxShieldFragmentClosedFaces']).toBe(true)
    expect(geometry.userData['pfxShieldFragmentRadialOctants']).toBe(8)
    expect(geometry.userData['pfxShieldFragmentDepthSpan']).toBeGreaterThanOrEqual(1)
    expect(geometry.userData['pfxShieldFragmentMinimumRootRadius']).toBeGreaterThanOrEqual(0.28)
    geometry.dispose()
  })

  it('authors poison cloud as a spatial pigment-gas field instead of wire bubble shells or a hard backing mesh', () => {
    const surfaces = getPfxRenderPlan(createPfxPreset('poison-cloud')).surfaces

    expect(surfaces.some((surface) => surface.kind === 'bubble-shells')).toBe(false)
    expect(surfaces.some((surface) => surface.kind === 'toxic-billows')).toBe(false)
    const pool = surfaces.find((surface) => surface.kind === 'toxic-pool')!
    expect(pool.tuning?.meshMotion).toBeUndefined()

    const drift = surfaces.find((surface) => surface.phase === 'spore-drift')!
    expect(drift.tuning).toMatchObject({ motion: 'drift-cloud', ramp: 'pigment' })
    expect(drift.tuning!.countScale).toBeGreaterThanOrEqual(0.75)
    expect(drift.tuning!.spawnScale).toBeGreaterThanOrEqual(1.5)
    expect(drift.tuning!.depthScale).toBeGreaterThanOrEqual(3)

    const spores = surfaces.find((surface) => surface.phase === 'toxic-spore-motes')!
    expect(spores.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'glow',
      blend: 'additive',
    })
    expect(spores.tuning!.countScale).toBeGreaterThanOrEqual(0.1)
    expect(spores.tuning!.countScale).toBeLessThanOrEqual(0.2)
    expect(spores.tuning!.depthScale).toBeGreaterThanOrEqual(3)
  })

  it('puts the UI reward payout burst on the gem peak instead of after the payoff frame', () => {
    const plan = getPfxRenderPlan(createPfxPreset('ui-reward-burst'))
    const flash = plan.surfaces.find((surface) => surface.phase === 'ui-reward-cascade-flash')!
    const gem = plan.surfaces.find((surface) => surface.kind === 'reward-gem')!
    const confetti = plan.surfaces.find((surface) => surface.phase === 'confetti-sparkle')!

    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(flash.scale).toBeGreaterThanOrEqual(0.65)
    expect(gem.scale).toBeGreaterThanOrEqual(1.3)
    expect(confetti.scale).toBeGreaterThanOrEqual(1.15)
    expect(confetti.tuning).toMatchObject({
      motion: 'radial-burst',
      sprite: 'sparkle',
      blend: 'alpha',
      ramp: 'pigment',
    })
    expect(confetti.tuning!.delay).toBeLessThanOrEqual(0.04)
    expect(confetti.tuning!.window).toBeLessThanOrEqual(0.06)
    expect(confetti.tuning!.countScale).toBeGreaterThanOrEqual(0.75)
    expect(confetti.tuning!.speedScale).toBeGreaterThanOrEqual(7)
    expect(confetti.tuning!.spawnScale).toBeLessThanOrEqual(0.15)
    expect(confetti.tuning!.gravity).toBeLessThanOrEqual(-1.5)
    const cameraFacing = (PfxLibrary as unknown as {
      shouldApplyPfxSurfaceCameraFacing: (
        surface: typeof confetti,
        feelVersion: number,
        parentCameraPinned: boolean,
      ) => boolean
    }).shouldApplyPfxSurfaceCameraFacing
    expect(cameraFacing(confetti, plan.feelVersion, false)).toBe(true)
    expect(cameraFacing(confetti, plan.feelVersion, true)).toBe(false)
  })

  it('keeps the charge telegraph danger radius stable while urgency converges inside it', () => {
    const preset = createPfxPreset('charge-telegraph')
    const plan = getPfxRenderPlan(preset)
    const boundary = plan.surfaces.find((surface) => surface.phase === 'charge-telegraph-warning-ring')!
    const fill = plan.surfaces.find((surface) => surface.phase === 'charge-telegraph-warning-fill')!
    const urgency = plan.surfaces.find((surface) => surface.phase === 'charge-telegraph-ground-urgency')!

    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.tempo).toBeGreaterThanOrEqual(1.4)
    expect(boundary.scale).toBeGreaterThanOrEqual(1)
    expect(boundary.tuning).toMatchObject({ ringPurpose: 'reticle' })
    expect(boundary.tuning?.meshMotion).toBeUndefined()
    expect(fill.scale).toBeGreaterThanOrEqual(0.9)
    expect(fill.opacity).toBeGreaterThanOrEqual(0.45)
    expect(fill.tuning?.meshMotion).toBe('countdown')
    expect(urgency.tuning).toMatchObject({
      motion: 'converge-center',
      sprite: 'glow',
      blend: 'additive',
      delay: 0,
      ramp: 'pinned-hot',
    })
    expect(urgency.tuning!.window).toBeGreaterThanOrEqual(0.75)
    expect(urgency.tuning!.countScale).toBeGreaterThanOrEqual(1.4)
    expect(urgency.tuning!.speedScale).toBeGreaterThanOrEqual(2)
    expect(urgency.tuning!.spawnScale).toBeGreaterThanOrEqual(1.8)
    expect(urgency.tuning!.size![1]).toBeGreaterThanOrEqual(0.6)

    const boundaryEarly = getPfxSurfaceAnimationProps(boundary, preset.controls, 0.1, 1, plan.tempo, 2)
    const boundaryLate = getPfxSurfaceAnimationProps(boundary, preset.controls, 0.75, 1, plan.tempo, 2)
    const fillEarly = getPfxSurfaceAnimationProps(fill, preset.controls, 0.1, 1, plan.tempo, 2)
    const fillLate = getPfxSurfaceAnimationProps(fill, preset.controls, 0.5, 1, plan.tempo, 2)
    expect(boundaryLate.scaleMultiplier).toBe(boundaryEarly.scaleMultiplier)
    expect(boundaryLate.opacityMultiplier).toBe(boundaryEarly.opacityMultiplier)
    expect(fillLate.opacityMultiplier).toBeGreaterThan(fillEarly.opacityMultiplier + 0.5)
    expect(fillLate.scaleMultiplier).toBe(fillEarly.scaleMultiplier)
  })

  it('holds the spawn footprint while an early conceal flash resolves into grounded dust', () => {
    const preset = createPfxPreset('spawn-marker')
    const plan = getPfxRenderPlan(preset)
    const boundary = plan.surfaces.find((surface) => surface.phase === 'spawn-marker-spawn-circle')!
    const flash = plan.surfaces.find((surface) => surface.phase === 'spawn-marker-conceal-flash')!
    const dust = plan.surfaces.find((surface) => surface.phase === 'spawn-marker-settle-dust')!

    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.tempo).toBeGreaterThanOrEqual(1.4)
    expect(boundary.scale).toBeGreaterThanOrEqual(1.1)
    expect(boundary.tuning).toMatchObject({ ringPurpose: 'reticle' })
    expect(boundary.tuning?.meshMotion).toBeUndefined()
    expect(flash.scale).toBeGreaterThanOrEqual(0.7)
    expect(flash.tuning).toMatchObject({ meshMotion: 'flash' })
    expect(flash.tuning!.delay).toBeLessThanOrEqual(0.15)
    expect(flash.tuning!.window).toBeGreaterThanOrEqual(0.12)
    expect(dust.tuning).toMatchObject({ motion: 'cone-fountain', sprite: 'puff', blend: 'alpha', ramp: 'dark' })
    expect(dust.tuning!.delay).toBeLessThanOrEqual(0.22)
    expect(dust.tuning!.window).toBeGreaterThanOrEqual(0.3)
    expect(dust.tuning!.countScale).toBeGreaterThanOrEqual(0.6)
    expect(dust.tuning!.gravity).toBeLessThanOrEqual(-1)

    const boundaryEarly = getPfxSurfaceAnimationProps(boundary, preset.controls, 0.1, 1, plan.tempo, 2)
    const boundaryLate = getPfxSurfaceAnimationProps(boundary, preset.controls, 0.7, 1, plan.tempo, 2)
    expect(boundaryLate.scaleMultiplier).toBe(boundaryEarly.scaleMultiplier)
    expect(boundaryLate.opacityMultiplier).toBe(boundaryEarly.opacityMultiplier)
  })

  it('exposes a progressive dissolve front and synchronizes released essence to it', () => {
    const plan = getPfxRenderPlan(createPfxPreset('dissolve'))
    const body = plan.surfaces.find((surface) => surface.phase === 'dissolve-eroding-subject')!
    const motes = plan.surfaces.find((surface) => surface.phase === 'dissolve-edge-motes')!
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(body.tuning).toMatchObject({ meshShader: 'fresnel-shell', meshMotion: 'break', delay: 0 })
    expect(body.tuning!.window).toBeGreaterThanOrEqual(0.65)
    expect(motes.tuning).toMatchObject({ motion: 'column-rise', delay: 0 })
    expect(motes.tuning!.window).toBeGreaterThanOrEqual(0.65)
    expect(motes.tuning!.countScale).toBeGreaterThanOrEqual(0.5)
    const breakProgress = (PfxLibrary as unknown as {
      getPfxMeshBreakProgress: (surface: typeof body, cycle: number) => number
    }).getPfxMeshBreakProgress
    expect(breakProgress(body, 0)).toBe(0)
    expect(breakProgress(body, 0.2)).toBeGreaterThan(0.2)
    expect(breakProgress(body, 0.55)).toBeLessThan(1)
    expect(breakProgress(body, 0.72)).toBe(1)
  })

  it('keeps the world portal face and rounded aperture rim on their authored plane', () => {
    const plan = getPfxRenderPlan(createPfxPreset('portal-idle-loop'))
    const aperture = plan.surfaces.find((surface) => surface.phase === 'vortex-rim')!
    const throat = plan.surfaces.find((surface) => surface.phase === 'aperture-depth')!
    expect(aperture.tuning?.meshShader).toBe('vortex-swirl')
    expect(throat.tuning?.meshShader).toBe('portal-throat')
    expect(isPfxSurfaceCameraFacing(aperture, plan.feelVersion)).toBe(false)
    expect(isPfxSurfaceCameraFacing(throat, plan.feelVersion)).toBe(false)
  })

  it('shapes portal depth as a rounded aperture rim instead of a frustum or side-view sail', () => {
    const factory = (PfxLibrary as unknown as {
      createPfxPortalThroatGeometry?: () => THREE.BufferGeometry
    }).createPfxPortalThroatGeometry
    expect(factory).toBeTypeOf('function')
    if (!factory) return
    const geometry = factory()
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const radii = new Set<number>()
    for (let index = 0; index < positions.count; index += 1) {
      radii.add(Math.round(Math.hypot(positions.getX(index), positions.getY(index)) * 100) / 100)
    }
    geometry.computeBoundingBox()
    expect(geometry.type).toBe('TorusGeometry')
    expect(geometry.userData['pfxPortalThroatGeometry']).toBe('rounded-aperture-rim')
    expect(radii.size).toBeGreaterThanOrEqual(5)
    expect(geometry.boundingBox!.max.z).toBeGreaterThanOrEqual(0.08)
    expect(geometry.boundingBox!.min.z).toBeLessThanOrEqual(-0.08)
    geometry.dispose()
  })

  it('applies semantic camera-facing rotation inside the shader-surface animation path', () => {
    const source = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    const branchStart = source.indexOf('if (meshShaderMaterial) {')
    const shaderBranch = source.slice(branchStart, source.indexOf('\n      return\n    }\n    const motion =', branchStart))
    expect(shaderBranch).toContain('shouldApplyPfxSurfaceCameraFacing(surface, feelVersion, parentCameraPinned)')
    expect(shaderBranch).toContain('applyPfxSurfaceRotation(')
  })

  it('authors the projectile trail as one tapered volumetric wake instead of disconnected lick cards', () => {
    const plan = getPfxRenderPlan(createPfxPreset('projectile-trail'))
    const wake = plan.surfaces.find((surface) => surface.phase === 'projectile-trail-plasma-wake')
    const head = plan.surfaces.find((surface) => surface.phase === 'projectile-trail-hot-core')
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'lick')).toBe(false)
    expect(wake).toMatchObject({ kind: 'tapered-trail', role: 'trail' })
    expect(wake?.tuning).toMatchObject({ meshShader: 'projectile-wake', meshMotion: 'travel' })
    expect(wake!.scale / head!.scale).toBeGreaterThanOrEqual(1.3)
  })

  it('gives the projectile wake a closed tapered cross-section that survives axial viewing', () => {
    const factory = (PfxLibrary as unknown as {
      createPfxProjectileWakeGeometry?: () => THREE.BufferGeometry
    }).createPfxProjectileWakeGeometry
    expect(factory).toBeTypeOf('function')
    if (!factory) return
    const geometry = factory()
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    expect(geometry.userData['pfxProjectileWakeGeometry']).toBe('closed-tapered-volumetric-plasma-wake')
    expect(geometry.userData['pfxProjectileWakeClosedCaps']).toBe(true)
    expect(geometry.userData['pfxProjectileWakeStrandCount']).toBe(1)
    expect(geometry.userData['pfxProjectileWakeRadialSegments']).toBeGreaterThanOrEqual(16)
    expect(geometry.userData['pfxProjectileWakeHeadLobes']).toBe(3)
    expect(geometry.userData['pfxProjectileWakeHeadRadius']).toBeGreaterThanOrEqual(0.5)
    expect(geometry.userData['pfxProjectileWakeTailRadius']).toBeLessThanOrEqual(0.05)
    expect((PfxLibrary as unknown as { PFX_PROJECTILE_WAKE_HEAD_COLLAR_OPACITY?: number }).PFX_PROJECTILE_WAKE_HEAD_COLLAR_OPACITY).toBeGreaterThanOrEqual(0.5)
    expect(size.x).toBeGreaterThanOrEqual(2)
    expect(size.y).toBeGreaterThanOrEqual(0.45)
    expect(size.z).toBeGreaterThanOrEqual(0.45)
    geometry.dispose()
  })

  it('shapes the held projectile wake through a visible grow crest and recovery loop', () => {
    const envelope = (PfxLibrary as unknown as {
      createPfxProjectileWakeEnvelope?: (cycle: number) => number
    }).createPfxProjectileWakeEnvelope
    expect(envelope).toBeTypeOf('function')
    if (!envelope) return
    expect(envelope(0)).toBeLessThanOrEqual(0.2)
    expect(envelope(0.052)).toBeGreaterThanOrEqual(0.7)
    expect(envelope(0.083)).toBeGreaterThanOrEqual(0.9)
    expect(envelope(0.122)).toBeLessThan(0.6)
    expect(envelope(1)).toBeLessThanOrEqual(0.2)
  })

  it('authors the electric trail as a closed propagating bolt volume with a clean recovery', () => {
    const plan = getPfxRenderPlan(createPfxPreset('electric-trail'))
    const wake = plan.surfaces.find((surface) => surface.phase === 'electric-trail-propagating-bolt')
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'arc')).toBe(false)
    expect(wake).toMatchObject({ kind: 'tapered-trail', role: 'trail' })
    expect(wake?.tuning).toMatchObject({
      meshShader: 'electric-wake',
      meshMotion: 'travel',
      lifecycle: 'electric-trail-propagation',
    })
    const source = plan.surfaces.find((surface) => surface.phase === 'electric-trail-source-contact')!
    expect(source.scale / wake!.scale).toBeLessThanOrEqual(0.14)

    const factory = (PfxLibrary as unknown as {
      createPfxElectricWakeGeometry?: () => THREE.BufferGeometry
    }).createPfxElectricWakeGeometry
    expect(factory).toBeTypeOf('function')
    if (!factory) return
    const geometry = factory()
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    expect(geometry.userData['pfxElectricWakeGeometry']).toBe('closed-forked-directional-bolt-volume')
    expect(geometry.userData['pfxElectricWakeClosedCaps']).toBe(true)
    expect(geometry.userData['pfxElectricWakeFrameTransport']).toBe('parallel-transport')
    expect(geometry.userData['pfxElectricWakeMainDepthDrift']).toBeGreaterThanOrEqual(0.55)
    expect(geometry.userData['pfxElectricWakeMainDepthDrift']).toBeLessThanOrEqual(0.7)
    expect(geometry.userData['pfxElectricWakeMainDepthOscillation']).toBeLessThanOrEqual(0.16)
    expect(geometry.userData['pfxElectricWakeStrandCount']).toBe(3)
    expect(geometry.userData['pfxElectricWakeDrawCalls']).toBe(1)
    expect(geometry.userData['pfxElectricWakeHeadRadius']).toBeGreaterThanOrEqual(0.12)
    expect(geometry.userData['pfxElectricWakeTailRadius']).toBeLessThanOrEqual(0.03)
    expect(size.x).toBeGreaterThanOrEqual(2.8)
    expect(size.y).toBeGreaterThanOrEqual(0.65)
    expect(size.z).toBeGreaterThanOrEqual(1.05)
    geometry.dispose()

    const timeline = (PfxLibrary as unknown as {
      createPfxElectricTrailLifecycle?: (cycle: number) => {
        reach: number
        decay: number
        intensity: number
      }
    }).createPfxElectricTrailLifecycle
    expect(timeline).toBeTypeOf('function')
    if (!timeline) return
    expect(timeline(0)).toMatchObject({ decay: 0 })
    expect(timeline(0).reach).toBeGreaterThanOrEqual(0.28)
    expect(timeline(0).reach).toBeLessThanOrEqual(0.45)
    expect(timeline(0).intensity).toBeGreaterThanOrEqual(0.6)
    expect(timeline(0.06).reach).toBeGreaterThanOrEqual(0.9)
    expect(timeline(0.06).intensity).toBeGreaterThanOrEqual(0.95)
    expect(timeline(0.15).decay).toBeGreaterThanOrEqual(0.45)
    expect(timeline(0.15).intensity).toBeLessThan(0.8)
    expect(timeline(0.25).intensity).toBeLessThanOrEqual(0.05)

    const materialPolicy = (PfxLibrary as unknown as {
      createPfxMeshShaderRenderPolicy?: (shader: string) => {
        blending: THREE.Blending
        depthWrite: boolean
        side: THREE.Side
      }
    }).createPfxMeshShaderRenderPolicy
    expect(materialPolicy).toBeTypeOf('function')
    if (!materialPolicy) return
    expect(materialPolicy('electric-wake')).toEqual({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  })

  it('authors wind impact as a directional pressure volume with a quieter dust handoff', () => {
    const plan = getPfxRenderPlan(createPfxPreset('wind-impact'))
    const pressure = plan.surfaces.find((surface) => surface.phase === 'wind-impact-particle-pressure-fan')
    const dust = plan.surfaces.find((surface) => surface.phase === 'wind-impact-particle-ground-dust')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'puff' || surface.tuning?.sprite === 'smoke')).toBe(false)
    expect(pressure).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(pressure?.tuning).toMatchObject({ motion: 'radial-burst', sprite: 'streak', lifecycle: 'wind-impact-shear' })
    expect(pressure!.scale).toBeGreaterThanOrEqual(1.1)
    expect(isPfxSurfaceCameraFacing(pressure!, plan.feelVersion)).toBe(false)
    expect(dust?.tuning).toMatchObject({
      motion: 'ground-scuff',
      sprite: 'debris',
      blend: 'alpha',
      impactVector: [1, 0.16, 0.18],
    })
    expect(dust!.tuning!.countScale).toBeGreaterThanOrEqual(0.45)
    expect(dust!.tuning!.countScale).toBeLessThanOrEqual(0.75)

    const factory = (PfxLibrary as unknown as {
      createPfxWindPressureGeometry?: () => THREE.BufferGeometry
    }).createPfxWindPressureGeometry
    expect(factory).toBeTypeOf('function')
    if (!factory) return
    const geometry = factory()
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    expect(geometry.userData['pfxWindPressureGeometry']).toBe('single-draw-pressure-wedge-with-swept-streamlines')
    expect(geometry.userData['pfxWindPressureStreamCount']).toBeGreaterThanOrEqual(3)
    expect(geometry.userData['pfxWindPressureStreamProfile']).toBe('parallel-swept-ribbons')
    expect(geometry.userData['pfxWindPressureShell']).toBe('wide-tail-to-contact-wedge')
    expect(geometry.userData['pfxWindPressureFlowAxis']).toEqual([1, 0.08, 0.04])
    expect(geometry.userData['pfxWindPressureTaperedEnds']).toBe(true)
    expect(geometry.userData['pfxWindPressureContactCore']).toBe('open-pressure-crescent')
    expect(geometry.userData['pfxWindPressureCrescentArc']).toBeGreaterThan(Math.PI)
    expect(geometry.userData['pfxWindPressureCrescentArc']).toBeLessThan(Math.PI * 2)
    expect(geometry.userData['pfxWindPressureCrescentTube']).toBeLessThanOrEqual(0.03)
    expect(geometry.userData['pfxWindPressureDrawCalls']).toBe(1)
    expect(geometry.userData['pfxWindPressureTipRadius']).toBeLessThanOrEqual(0.015)
    expect(size.x).toBeGreaterThanOrEqual(2)
    expect(size.y).toBeGreaterThanOrEqual(0.7)
    expect(size.z).toBeGreaterThanOrEqual(0.7)
    geometry.dispose()

    const materialFactory = (PfxLibrary as unknown as {
      createPfxWindPressureMaterial?: (opacity: number, color: THREE.ColorRepresentation) => THREE.Material
    }).createPfxWindPressureMaterial
    expect(materialFactory).toBeTypeOf('function')
    const material = materialFactory?.(0.7, '#a8d2dc')
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material).toMatchObject({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    material?.dispose()

    const lifecycle = (PfxLibrary as unknown as {
      createPfxWindImpactLifecycle?: (cycle: number) => { energy: number; stage: string }
    }).createPfxWindImpactLifecycle
    expect(lifecycle).toBeTypeOf('function')
    if (!lifecycle) return
    expect(lifecycle(0).energy).toBeGreaterThanOrEqual(0.3)
    expect(lifecycle(0).energy).toBeLessThan(0.6)
    expect(lifecycle(0.06).energy).toBeGreaterThanOrEqual(0.95)
    expect(lifecycle(0.16).energy).toBeLessThan(0.7)
    expect(lifecycle(0.4)).toMatchObject({ energy: 0, stage: 'rest' })
  })

  it('authors acid idle as a grounded one-draw corrosive pool with integrated bubble domes', () => {
    const plan = getPfxRenderPlan(createPfxPreset('acid-idle'))
    const pool = plan.surfaces.find((surface) => surface.kind === 'acid-pool')
    const vapor = plan.surfaces.find((surface) => surface.phase === 'acid-idle-low-vapor')

    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.tempo).toBeGreaterThanOrEqual(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'splat')).toBe(false)
    expect(pool).toMatchObject({ role: 'volume' })
    expect(pool?.tuning).toMatchObject({ meshShader: 'acid-pool', meshMotion: 'pulse', blend: 'alpha', lifecycle: 'acid-idle-boil' })
    expect(isPfxSurfaceCameraFacing(pool!, plan.feelVersion)).toBe(false)
    expect(vapor?.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
    })
    expect(vapor!.tuning!.countScale).toBeGreaterThanOrEqual(0.25)
    expect(vapor!.tuning!.countScale).toBeLessThanOrEqual(0.45)
    expect(vapor!.tuning!.spawnScale).toBeGreaterThanOrEqual(1)
    expect(vapor!.tuning!.depthScale).toBeGreaterThanOrEqual(2)

    const geometryFactory = (PfxLibrary as unknown as {
      createPfxAcidPoolGeometry?: () => THREE.BufferGeometry
    }).createPfxAcidPoolGeometry
    expect(geometryFactory).toBeTypeOf('function')
    if (!geometryFactory) return
    const geometry = geometryFactory()
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    expect(geometry.userData['pfxAcidPoolGeometry']).toBe('irregular-skirted-pool-with-integrated-domes')
    expect(geometry.userData['pfxAcidPoolDrawCalls']).toBe(1)
    expect(geometry.userData['pfxAcidPoolBoundarySegments']).toBeGreaterThanOrEqual(40)
    expect(geometry.userData['pfxAcidPoolBubbleCount']).toBeGreaterThanOrEqual(5)
    expect(geometry.userData['pfxAcidPoolClosedSkirt']).toBe(true)
    expect(size.x).toBeGreaterThanOrEqual(2)
    expect(size.y).toBeGreaterThanOrEqual(0.15)
    expect(size.z).toBeGreaterThanOrEqual(1.5)
    geometry.dispose()

    const materialPolicy = PfxLibrary.createPfxMeshShaderRenderPolicy('acid-pool')
    expect(materialPolicy).toEqual({
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    expect(PfxLibrary.createPfxMeshShaderHotColor('acid-pool', '#83e600').getHexString()).toBe('dfff52')

    const lifecycle = (PfxLibrary as unknown as {
      createPfxAcidIdleLifecycle?: (elapsedSeconds: number) => { energy: number; stage: string }
    }).createPfxAcidIdleLifecycle
    expect(lifecycle).toBeTypeOf('function')
    if (!lifecycle) return
    expect(lifecycle(0)).toMatchObject({ stage: 'simmer' })
    expect(lifecycle(0).energy).toBeLessThanOrEqual(0.1)
    expect(lifecycle(0.3).energy).toBeGreaterThanOrEqual(0.9)
    expect(lifecycle(0.6).energy).toBeLessThanOrEqual(0.1)
    expect(lifecycle(0.2).energy).toBeLessThanOrEqual(0.1)
    expect(lifecycle(0.32).energy).toBeGreaterThanOrEqual(0.95)
    expect(lifecycle(0.62).energy).toBeLessThanOrEqual(0.1)
  })

  it('authors portal charge as a world-space aperture with recessed throat and converging inflow', () => {
    const plan = getPfxRenderPlan(createPfxPreset('portal-charge'))
    const face = plan.surfaces.find((surface) => surface.tuning?.meshShader === 'vortex-swirl')
    const throat = plan.surfaces.find((surface) => surface.tuning?.meshShader === 'portal-throat')
    const inflow = plan.surfaces.find((surface) => surface.phase === 'portal-charge-gather-inflow')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(face).toMatchObject({ role: 'aura' })
    expect(face?.tuning).toMatchObject({ meshMotion: 'charge', lifecycle: 'portal-charge-aperture' })
    expect(throat).toMatchObject({ kind: 'portal-throat', role: 'volume' })
    expect(throat?.tuning).toMatchObject({ meshMotion: 'charge', lifecycle: 'portal-charge-aperture' })
    expect(isPfxSurfaceCameraFacing(face!, plan.feelVersion)).toBe(false)
    expect(isPfxSurfaceCameraFacing(throat!, plan.feelVersion)).toBe(false)
    expect(inflow?.tuning).toMatchObject({ motion: 'converge-center', sprite: 'magic', blend: 'additive' })
    expect(inflow!.tuning!.countScale).toBeGreaterThanOrEqual(0.45)
    expect(inflow!.tuning!.spawnScale).toBeGreaterThanOrEqual(2)
    expect(inflow!.tuning!.depthScale).toBeGreaterThanOrEqual(2.5)

    const lifecycle = (PfxLibrary as unknown as {
      createPfxPortalChargeLifecycle?: (cycle: number) => { energy: number; aperture: number; stage: string }
    }).createPfxPortalChargeLifecycle
    expect(lifecycle).toBeTypeOf('function')
    if (!lifecycle) return
    expect(lifecycle(0).energy).toBeLessThanOrEqual(0.3)
    expect(lifecycle(0).aperture).toBeLessThanOrEqual(0.35)
    expect(lifecycle(0.7).energy).toBeGreaterThanOrEqual(0.95)
    expect(lifecycle(0.7).aperture).toBeGreaterThanOrEqual(0.9)
    expect(lifecycle(0.98)).toMatchObject({ energy: 0, aperture: 0, stage: 'rest' })
  })

  it('authors reflect release as a fracturing shield with one returned launch vector', () => {
    const plan = getPfxRenderPlan(createPfxPreset('reflect-release'))
    const shell = plan.surfaces.find((surface) => surface.phase === 'reflect-release-deflection-shell')
    const contact = plan.surfaces.find((surface) => surface.phase === 'reflect-release-contact-core')
    const returned = plan.surfaces.find((surface) => surface.phase === 'reflect-release-return-vector')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'sparkle')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(shell).toMatchObject({ kind: 'shield-shell', role: 'aura' })
    expect(shell?.tuning).toMatchObject({ meshShader: 'hex-shell', meshMotion: 'break' })
    expect(shell!.scale).toBeGreaterThanOrEqual(1)
    expect(shell!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.3)
    expect(isPfxSurfaceCameraFacing(shell!, plan.feelVersion)).toBe(false)
    expect(contact).toMatchObject({ kind: 'impact-core', role: 'impact' })
    expect(contact?.tuning).toMatchObject({ lifecycle: 'impact-core-flash' })
    expect(returned?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'streak',
      blend: 'additive',
      impactVector: [1, 0.18, 0.08],
    })
    expect(returned!.tuning!.spreadAngle).toBeLessThanOrEqual(0.25)
    expect(returned!.tuning!.countScale).toBeGreaterThanOrEqual(0.5)
    expect(returned!.tuning!.countScale).toBeLessThanOrEqual(0.8)

    expect(PfxLibrary.getPfxMeshBreakProgress(shell!, 0)).toBe(0)
    expect(PfxLibrary.getPfxMeshBreakProgress(shell!, 0.25)).toBeGreaterThan(0.1)
    expect(PfxLibrary.getPfxMeshBreakProgress(shell!, 0.65)).toBe(1)
  })

  it('authors reward telegraph around a visible prize beacon instead of a flat empty fill', () => {
    const plan = getPfxRenderPlan(createPfxPreset('reward-telegraph'))
    const ring = plan.surfaces.find((surface) => surface.phase === 'reward-telegraph-warning-ring')
    const prize = plan.surfaces.find((surface) => surface.phase === 'reward-telegraph-prize-beacon')
    const orbit = plan.surfaces.find((surface) => surface.phase === 'reward-telegraph-perimeter-motes')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'telegraph-disc')).toBe(false)
    expect(ring).toMatchObject({ kind: 'ring-field', role: 'screen' })
    expect(ring?.tuning).toMatchObject({ meshMotion: 'countdown', ringPurpose: 'boundary', lifecycle: 'reward-telegraph-beacon' })
    expect(ring!.scale).toBeGreaterThanOrEqual(1.35)
    expect(prize).toMatchObject({ kind: 'reward-gem', role: 'screen' })
    expect(prize?.tuning).toMatchObject({ meshMotion: 'countdown', lifecycle: 'reward-telegraph-beacon' })
    expect(prize!.scale).toBeGreaterThanOrEqual(0.9)
    expect(prize!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(-0.1)
    expect(isPfxSurfaceCameraFacing(prize!, plan.feelVersion)).toBe(true)
    expect(PfxLibrary.getPfxSurfacePositionOffset(ring!)).toEqual([0, 0, 0])
    expect(PfxLibrary.getPfxRingPlaneRotation(ring!)).toEqual([0, 0, 0])
    expect(orbit?.tuning).toMatchObject({
      motion: 'orbit-ring',
      sprite: 'sparkle',
      blend: 'additive',
    })
    expect(orbit).toMatchObject({ role: 'screen' })
    expect(orbit!.tuning!.countScale).toBeGreaterThanOrEqual(0.9)
    expect(orbit!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.6)
    expect(orbit!.tuning!.depthScale).toBeLessThanOrEqual(0.3)

    expect(PfxLibrary.createPfxRewardTelegraphLifecycle(0.06)).toMatchObject({ stage: 'announce' })
    expect(PfxLibrary.createPfxRewardTelegraphLifecycle(0.5)).toMatchObject({ stage: 'charge' })
    expect(PfxLibrary.createPfxRewardTelegraphLifecycle(0.78)).toMatchObject({ stage: 'resolve' })
    expect(PfxLibrary.createPfxRewardTelegraphLifecycle(0.98)).toEqual({ energy: 0, scale: 0, stage: 'rest' })
    expect(PfxLibrary.createPfxRewardTelegraphLifecycle(0.5).energy).toBeGreaterThan(
      PfxLibrary.createPfxRewardTelegraphLifecycle(0.06).energy,
    )

    const facetColors = PfxLibrary.getPfxRewardGemFacetColors('#ffd34f')
    expect(new Set(Object.values(facetColors)).size).toBe(3)
  })

  it('authors hologram aura as an object-local scan volume instead of a glow orb over an orphaned ring', () => {
    const plan = getPfxRenderPlan(createPfxPreset('hologram-aura'))
    const shell = plan.surfaces.find((surface) => surface.phase === 'hologram-aura-scan-shell')
    const interference = plan.surfaces.find((surface) => surface.phase === 'hologram-aura-data-interference')
    const glyphs = plan.surfaces.find((surface) => surface.phase === 'hologram-aura-orbiting-glyphs')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'screen-plane')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(shell).toMatchObject({ kind: 'shield-shell', role: 'aura' })
    expect(shell?.tuning).toMatchObject({
      meshShader: 'hologram-shell',
      lifecycle: 'hologram-aura-loop',
      blend: 'additive',
    })
    expect(shell!.scale).toBeGreaterThanOrEqual(1.2)
    expect(shell!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.1)
    expect(isPfxSurfaceCameraFacing(shell!, plan.feelVersion)).toBe(false)
    expect(PfxLibrary.createPfxMeshShaderRenderPolicy('hologram-shell')).toEqual({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    })

    expect(interference).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(interference?.tuning).toMatchObject({
      motion: 'column-rise',
      sprite: 'streak',
      blend: 'additive',
    })
    expect(interference!.tuning!.countScale).toBeGreaterThanOrEqual(0.55)
    expect(interference!.tuning!.depthScale).toBeGreaterThanOrEqual(1.2)
    expect(glyphs?.tuning).toMatchObject({
      motion: 'shell-flame',
      sprite: 'rune',
      blend: 'additive',
    })
    expect(glyphs!.tuning!.countScale).toBeGreaterThanOrEqual(0.35)

    expect(PfxLibrary.createPfxHologramAuraLifecycle(0.06)).toMatchObject({ stage: 'boot' })
    expect(PfxLibrary.createPfxHologramAuraLifecycle(0.5)).toMatchObject({ stage: 'scan' })
    expect(PfxLibrary.createPfxHologramAuraLifecycle(0.76)).toMatchObject({ stage: 'glitch' })
    expect(PfxLibrary.createPfxHologramAuraLifecycle(0.94)).toMatchObject({ stage: 'recover' })
    expect(PfxLibrary.createPfxHologramAuraLifecycle(0.5).energy).toBeGreaterThan(
      PfxLibrary.createPfxHologramAuraLifecycle(0.06).energy,
    )
  })

  it('authors blast beam as an asymmetric source-anchored attack vector with a hot core and restrained corona', () => {
    const plan = getPfxRenderPlan(createPfxPreset('blast-beam'))
    const corona = plan.surfaces.find((surface) => surface.phase === 'blast-beam-directed-corona')
    const core = plan.surfaces.find((surface) => surface.phase === 'blast-beam-hot-core')

    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere' || surface.kind === 'impact-core')).toBe(false)
    expect(corona).toMatchObject({ kind: 'beam-column', role: 'aura' })
    expect(corona?.tuning).toMatchObject({
      meshShader: 'energy-column',
      meshMotion: 'pulse',
      lifecycle: 'blast-beam-sustain',
    })
    expect(corona!.scale).toBeGreaterThanOrEqual(1)
    expect(corona!.tuning!.widthScale).toBeGreaterThanOrEqual(0.9)
    expect(corona!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.5)
    expect(isPfxSurfaceCameraFacing(corona!, plan.feelVersion)).toBe(false)
    expect(core).toMatchObject({ kind: 'beam-column', role: 'body' })
    expect(core?.tuning).toMatchObject({
      meshShader: 'energy-column',
      lifecycle: 'blast-beam-sustain',
      colorOverride: '#ff9d18',
    })
    expect(core!.tuning!.widthScale).toBeLessThanOrEqual(0.4)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)

    expect(PfxLibrary.createPfxBlastBeamLifecycle(0.06)).toMatchObject({ stage: 'ignite' })
    expect(PfxLibrary.createPfxBlastBeamLifecycle(0.45)).toMatchObject({ stage: 'sustain' })
    expect(PfxLibrary.createPfxBlastBeamLifecycle(0.78)).toMatchObject({ stage: 'collapse' })
    expect(PfxLibrary.createPfxBlastBeamLifecycle(0.95)).toEqual({ energy: 0, reach: 0, stage: 'rest' })
    expect(PfxLibrary.createPfxBlastBeamLifecycle(0.45).reach).toBeGreaterThan(
      PfxLibrary.createPfxBlastBeamLifecycle(0.06).reach,
    )

    const geometry = PfxLibrary.createPfxBlastBeamGeometry()
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(2)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(0.6)
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.6)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan((bounds.max.z - bounds.min.z) * 1.15)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(150)
    geometry.dispose()
  })

  it('authors glyph ring as a mobile-cheap magic circle with a ground seal, lifted runes, and rising energy', () => {
    const plan = getPfxRenderPlan(createPfxPreset('glyph-ring'))
    const circle = plan.surfaces.find((surface) => surface.phase === 'glyph-ring-inscribed-seal')
    const motes = plan.surfaces.find((surface) => surface.phase === 'glyph-ring-rising-script-dust')

    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(circle).toMatchObject({ kind: 'magic-circle', role: 'aura' })
    expect(circle?.tuning).toMatchObject({
      lifecycle: 'glyph-ring-inscription',
      blend: 'additive',
      colorOverride: '#74d7ff',
    })
    expect(circle!.scale).toBeGreaterThanOrEqual(1.4)
    expect(motes).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(motes?.tuning).toMatchObject({
      motion: 'column-rise',
      sprite: 'glow',
      blend: 'additive',
      lifecycle: 'glyph-ring-inscription',
    })
    expect(motes!.tuning!.countScale).toBeLessThanOrEqual(0.6)
    expect(motes!.tuning!.depthScale).toBeGreaterThanOrEqual(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)

    expect(PfxLibrary.createPfxGlyphRingLifecycle(0.04)).toMatchObject({ stage: 'inscribe' })
    expect(PfxLibrary.createPfxGlyphRingLifecycle(0.46)).toMatchObject({ stage: 'seal' })
    expect(PfxLibrary.createPfxGlyphRingLifecycle(0.8)).toMatchObject({ stage: 'release' })
    expect(PfxLibrary.createPfxGlyphRingLifecycle(0.96)).toEqual({ energy: 0, scale: 0, stage: 'rest' })

    const geometry = PfxLibrary.createPfxMagicCircleGeometry()
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(1.6)
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1.6)
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(0.3)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(700)
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('alpha').count).toBe(geometry.getAttribute('position').count)
    geometry.dispose()
  })

  it('authors water cone as a source-anchored liquid sheet with directional droplet breakup', () => {
    const plan = getPfxRenderPlan(createPfxPreset('water-cone'))
    const sheet = plan.surfaces.find((surface) => surface.phase === 'water-cone-connected-sheet')
    const droplets = plan.surfaces.find((surface) => surface.phase === 'water-cone-target-droplets')

    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(sheet).toMatchObject({ kind: 'water-cone-sheet', role: 'body' })
    expect(sheet?.tuning).toMatchObject({
      meshShader: 'water-flow',
      meshMotion: 'travel',
      lifecycle: 'water-cone-surge',
      blend: 'alpha',
    })
    expect(sheet!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.35)
    expect(isPfxSurfaceCameraFacing(sheet!, plan.feelVersion)).toBe(false)
    expect(droplets).toMatchObject({ kind: 'particles', role: 'body' })
    expect(droplets?.tuning).toMatchObject({
      sprite: 'glow',
      blend: 'additive',
      lifecycle: 'water-cone-surge',
      impactVector: [1, 0.18, 0],
    })
    expect(droplets!.tuning!.gravity).toBeLessThan(0)
    expect(droplets!.tuning!.depthScale).toBeGreaterThanOrEqual(1)
    expect(droplets!.tuning!.countScale).toBeGreaterThanOrEqual(0.6)
    expect(droplets!.tuning!.positionOffset?.[0]).toBeGreaterThanOrEqual(1.1)

    expect(PfxLibrary.createPfxWaterConeLifecycle(0.04)).toMatchObject({ stage: 'gather' })
    expect(PfxLibrary.createPfxWaterConeLifecycle(0.46)).toMatchObject({ stage: 'surge' })
    expect(PfxLibrary.createPfxWaterConeLifecycle(0.8)).toMatchObject({ stage: 'breakup' })
    expect(PfxLibrary.createPfxWaterConeLifecycle(0.96)).toEqual({ energy: 0, reach: 0, stage: 'rest' })

    const geometry = PfxLibrary.createPfxWaterConeGeometry()
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox!
    expect(bounds.max.y - bounds.min.y).toBeGreaterThan(2)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(1)
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1)
    expect(geometry.getAttribute('position').count).toBeGreaterThan(200)
    geometry.dispose()
  })

  it('authors sand spray as a grounded lateral fan with grain, dust-sheet, and settling bands', () => {
    const preset = createPfxPreset('sand-spray')
    const plan = getPfxRenderPlan(preset)
    const grains = plan.surfaces.find((surface) => surface.phase === 'sand-spray-fast-grain-fan')
    const dust = plan.surfaces.find((surface) => surface.phase === 'sand-spray-low-dust-fan')
    const settling = plan.surfaces.find((surface) => surface.phase === 'sand-spray-settling-grit')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(grains).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(grains?.tuning).toMatchObject({
      motion: 'radial-burst',
      sprite: 'debris',
      blend: 'alpha',
      lifecycle: 'sand-spray-burst',
      impactVector: [1, 0.22, 0],
    })
    expect(grains!.tuning!.countScale).toBeGreaterThanOrEqual(6)
    expect(grains!.scale).toBeGreaterThanOrEqual(2.2)
    expect(grains!.scale).toBeLessThanOrEqual(2.6)
    expect(grains!.tuning!.speedScale! / grains!.scale).toBeGreaterThanOrEqual(8)
    expect(grains!.tuning!.size?.[1]).toBeLessThanOrEqual(0.16)
    expect(grains!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.86)
    expect(grains!.tuning!.depthScale).toBeGreaterThanOrEqual(1)
    expect(dust).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(dust?.tuning).toMatchObject({
      motion: 'radial-burst',
      sprite: 'smoke',
      blend: 'alpha',
      lifecycle: 'sand-spray-burst',
      impactVector: [1, 0.08, 0],
    })
    expect(dust!.tuning!.countScale).toBeGreaterThanOrEqual(4)
    expect(dust!.scale).toBeGreaterThanOrEqual(2)
    expect(dust!.scale).toBeLessThanOrEqual(2.3)
    expect(dust!.tuning!.speedScale! / dust!.scale).toBeGreaterThanOrEqual(6)
    expect(dust!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.88)
    expect(settling?.tuning).toMatchObject({
      motion: 'radial-burst',
      sprite: 'debris',
      lifecycle: 'sand-spray-burst',
    })
    expect(settling!.tuning!.delay).toBeGreaterThanOrEqual(0.24)
    expect(settling!.tuning!.countScale).toBeGreaterThanOrEqual(1.5)
    expect(settling!.scale).toBeGreaterThanOrEqual(1.25)
    expect(settling!.scale).toBeLessThanOrEqual(1.7)

    expect(PfxLibrary.createPfxSandSprayLifecycle(0.04)).toMatchObject({ stage: 'kick' })
    expect(PfxLibrary.createPfxSandSprayLifecycle(0.4)).toMatchObject({ stage: 'fan' })
    expect(PfxLibrary.createPfxSandSprayLifecycle(0.78)).toMatchObject({ stage: 'settle' })
    const lateSettle = PfxLibrary.createPfxSandSprayLifecycle(0.9)
    expect(lateSettle).toMatchObject({ stage: 'settle' })
    expect(lateSettle.energy).toBeGreaterThan(0.25)
    expect(PfxLibrary.createPfxSandSprayLifecycle(0.96)).toEqual({ energy: 0, spread: 0, stage: 'rest' })

    expect(PfxLibrary.createPfxParticleEmission(preset, grains!).count).toBeGreaterThan(140)
    expect(PfxLibrary.createPfxParticleEmission(preset, dust!).count).toBeGreaterThan(90)
  })

  it('authors curse column as a synchronized binding seal, torment pillar, runic volume, and void crown', () => {
    const plan = getPfxRenderPlan(createPfxPreset('curse-column'))
    const pillar = plan.surfaces.find((surface) => surface.phase === 'curse-column-torment-pillar')
    const seal = plan.surfaces.find((surface) => surface.phase === 'curse-column-binding-seal')
    const witnesses = plan.surfaces.find((surface) => surface.phase === 'curse-column-orbiting-rune-witnesses')
    const falling = plan.surfaces.find((surface) => surface.phase === 'curse-column-falling-rune-volume')
    const crown = plan.surfaces.find((surface) => surface.phase === 'curse-column-crown-void')

    expect(plan.surfaces).toHaveLength(5)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(5)
    expect(plan.tempo).toBeGreaterThanOrEqual(0.95)
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'curse-column-binding')).toBe(true)
    expect(pillar).toMatchObject({ kind: 'beam-column', role: 'body' })
    expect(pillar?.tuning).toMatchObject({
      meshGeometry: 'curse-twisted-spire',
      meshShader: 'energy-column',
      lifecycle: 'curse-column-binding',
      blend: 'additive',
    })
    expect(pillar!.tuning!.widthScale).toBeGreaterThanOrEqual(12)
    expect(pillar!.scale).toBeGreaterThanOrEqual(1.1)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(pillar!, 2)).toBe(false)
    expect(seal).toMatchObject({ kind: 'magic-circle', role: 'aura' })
    expect(seal?.tuning).toMatchObject({
      blend: 'additive',
      lifecycle: 'curse-column-binding',
      meshGeometry: 'curse-binding-seal',
    })
    expect(seal!.scale).toBeGreaterThanOrEqual(1.2)
    expect(seal!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.84)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(seal!, 2)).toBe(false)
    expect(witnesses?.tuning).toMatchObject({
      motion: 'orbit-ring',
      sprite: 'rune',
      blend: 'additive',
      lifecycle: 'curse-column-binding',
    })
    expect(witnesses!.tuning!.depthScale).toBeGreaterThanOrEqual(1.4)
    expect(witnesses!.tuning!.countScale).toBeGreaterThanOrEqual(1.1)
    expect(witnesses!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.5)
    expect(falling?.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'rune',
      blend: 'additive',
      lifecycle: 'curse-column-binding',
    })
    expect(falling!.tuning!.depthScale).toBeGreaterThanOrEqual(1.8)
    expect(falling!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.44)
    expect(crown).toMatchObject({ kind: 'reward-gem', role: 'body' })
    expect(crown?.tuning).toMatchObject({
      meshMotion: 'charge',
      lifecycle: 'curse-column-binding',
      blend: 'additive',
    })
    expect(crown!.scale).toBeLessThanOrEqual(0.4)
    expect(crown!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.25)

    const gather = PfxLibrary.createPfxCurseColumnLifecycle(0)
    expect(gather).toMatchObject({ stage: 'gather' })
    expect(gather.energy).toBeGreaterThanOrEqual(0.62)
    expect(PfxLibrary.createPfxCurseColumnLifecycle(0.4)).toMatchObject({ stage: 'bind' })
    const selectedDecay = PfxLibrary.createPfxCurseColumnLifecycle(0.67)
    expect(selectedDecay).toMatchObject({ stage: 'collapse' })
    expect(selectedDecay.energy).toBeLessThan(0.58)
    expect(selectedDecay.scale).toBeLessThan(0.9)
    expect(PfxLibrary.createPfxCurseColumnLifecycle(0.82).energy).toBeLessThan(0.2)
    expect(PfxLibrary.createPfxCurseColumnLifecycle(0.95)).toEqual({ energy: 0, scale: 0, stage: 'rest' })

    const pillarGeometry = PfxLibrary.createPfxCurseColumnGeometry(12)
    pillarGeometry.computeBoundingBox()
    expect(pillarGeometry.userData).toMatchObject({
      pfxGeometry: 'curse-column-twisted-volume',
      ringCount: 6,
      radialSegments: 7,
      alternatingCrossSection: true,
      thornCount: 1,
      depthSpine: true,
    })
    expect(pillarGeometry.getAttribute('color').count).toBe(pillarGeometry.getAttribute('position').count)
    expect(pillarGeometry.boundingBox!.max.x - pillarGeometry.boundingBox!.min.x).toBeGreaterThan(0.8)
    expect(pillarGeometry.boundingBox!.max.z - pillarGeometry.boundingBox!.min.z).toBeGreaterThan(0.6)

    const sealGeometry = PfxLibrary.createPfxMagicCircleGeometry('#8f4bd8', 'curse-binding')
    sealGeometry.computeBoundingBox()
    expect(sealGeometry.userData).toMatchObject({
      pfxGeometry: 'curse-binding-seal',
      witnessCount: 5,
      asymmetricWitnesses: true,
      leaningWitnessCount: 5,
    })
    expect(sealGeometry.boundingBox!.max.y).toBeGreaterThan(0.55)
    const sealMaterial = PfxLibrary.createPfxMagicCircleMaterial(0.9, 'curse-binding')
    expect(sealMaterial).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect((sealMaterial as THREE.MeshStandardMaterial).flatShading).toBe(true)
    expect(sealMaterial.depthWrite).toBe(true)
    pillarGeometry.dispose()
    sealGeometry.dispose()
    sealMaterial.dispose()
  })

  it('authors spawn screen as a camera-invariant acquisition, materialization, confirmation, and release sequence', () => {
    const preset = createPfxPreset('spawn-screen')
    const plan = getPfxRenderPlan(preset)
    const bloom = plan.surfaces.find((surface) => surface.phase === 'spawn-screen-acquisition-bloom')
    const reticle = plan.surfaces.find((surface) => surface.phase === 'spawn-screen-avatar-assembly-lattice')
    const converge = plan.surfaces.find((surface) => surface.phase === 'spawn-screen-converging-data-fragments')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.tempo).toBeGreaterThanOrEqual(1)
    expect(plan.surfaces.every((surface) => surface.role === 'screen')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'spawn-screen-transition')).toBe(true)
    expect(bloom).toMatchObject({ kind: 'screen-plane', role: 'screen' })
    expect(bloom?.tuning).toMatchObject({ meshMotion: 'charge', blend: 'additive' })
    expect(reticle).toMatchObject({ kind: 'ring-field', role: 'screen' })
    expect(reticle?.tuning).toMatchObject({
      meshGeometry: 'spawn-screen-reticle',
      ringPurpose: 'glyph',
      blend: 'additive',
    })
    expect(reticle!.scale).toBeGreaterThanOrEqual(1)
    expect(converge).toMatchObject({ kind: 'particles', role: 'screen' })
    expect(converge?.tuning).toMatchObject({
      motion: 'converge-center',
      sprite: 'debris',
      blend: 'additive',
    })
    expect(converge!.tuning!.countScale).toBeGreaterThanOrEqual(1)
    expect(converge!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.3)
    expect(plan.surfaces.every((surface) => PfxLibrary.isPfxSurfaceCameraFacing(surface, 2))).toBe(true)

    const acquire = PfxLibrary.createPfxSpawnScreenLifecycle(0)
    expect(acquire).toMatchObject({ stage: 'acquire' })
    expect(acquire.energy).toBeGreaterThanOrEqual(0.4)
    expect(PfxLibrary.createPfxSpawnScreenLifecycle(0.3)).toMatchObject({ stage: 'materialize' })
    expect(PfxLibrary.createPfxSpawnScreenLifecycle(0.56)).toMatchObject({ stage: 'confirm' })
    const release = PfxLibrary.createPfxSpawnScreenLifecycle(0.75)
    expect(release).toMatchObject({ stage: 'release' })
    expect(release.energy).toBeGreaterThan(0.2)
    expect(release.energy).toBeLessThan(0.8)
    expect(PfxLibrary.createPfxSpawnScreenLifecycle(0.95)).toEqual({ energy: 0, aperture: 0, stage: 'rest' })

    const reticleGeometry = PfxLibrary.createPfxSpawnScreenReticleGeometry('#35d8ff')
    reticleGeometry.computeBoundingBox()
    expect(reticleGeometry.userData).toMatchObject({
      pfxGeometry: 'spawn-screen-avatar-assembly-lattice',
      avatarPartCount: 7,
      assemblyRailCount: 2,
      depthBandCount: 3,
      fragmentCount: 12,
      ghostShellCount: 2,
    })
    expect(reticleGeometry.boundingBox!.max.x - reticleGeometry.boundingBox!.min.x).toBeGreaterThan(1.7)
    expect(reticleGeometry.boundingBox!.max.y - reticleGeometry.boundingBox!.min.y).toBeGreaterThan(1.7)
    reticleGeometry.dispose()

    const reticleMaterial = PfxLibrary.createPfxSpawnScreenReticleMaterial(0.9)
    expect(reticleMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(reticleMaterial.userData).toMatchObject({
      pfxMaterial: 'spawn-screen-avatar-scan-gradient',
    })
    expect(reticleMaterial.uniforms).toMatchObject({
      uOpacity: { value: 0.9 },
      uTime: { value: 0 },
    })
    reticleMaterial.dispose()

    const simulation = PfxLibrary.createPfxParticleSimulation(preset, converge!)
    const ys = Array.from(simulation.spawn).filter((_, index) => index % 3 === 1)
    const zs = Array.from(simulation.spawn).filter((_, index) => index % 3 === 2)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.6)
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.001)
  })

  it('authors jump pickup as a grounded 3D launch, rising collection stream, reward apex, and release', () => {
    const preset = createPfxPreset('jump-pickup')
    const plan = getPfxRenderPlan(preset)
    const cradle = plan.surfaces.find((surface) => surface.phase === 'jump-pickup-launch-cradle')
    const stream = plan.surfaces.find((surface) => surface.phase === 'jump-pickup-rising-collection-stream')
    const apex = plan.surfaces.find((surface) => surface.phase === 'jump-pickup-reward-apex')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'jump-pickup-launch')).toBe(true)
    expect(cradle).toMatchObject({ kind: 'ring-field', role: 'aura' })
    expect(cradle?.tuning).toMatchObject({
      meshGeometry: 'jump-pickup-launch-cradle',
      ringPurpose: 'glyph',
    })
    expect(stream).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(stream?.tuning).toMatchObject({
      motion: 'jump-launch',
      sprite: 'sparkle',
      blend: 'additive',
    })
    expect(stream!.tuning!.countScale).toBeGreaterThanOrEqual(1.4)
    expect(stream!.tuning!.depthScale).toBeGreaterThanOrEqual(2)
    expect(apex).toMatchObject({ kind: 'ring-field', role: 'impact' })
    expect(apex?.tuning).toMatchObject({
      meshGeometry: 'jump-pickup-reward-gem',
      meshMotion: 'pickup',
      blend: 'additive',
    })
    expect(apex!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.15)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(cradle!, 2)).toBe(false)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(apex!, 2)).toBe(false)

    const crouch = PfxLibrary.createPfxJumpPickupLifecycle(0)
    expect(crouch).toMatchObject({ stage: 'crouch', height: 0 })
    expect(crouch.energy).toBeGreaterThanOrEqual(0.35)
    const lift = PfxLibrary.createPfxJumpPickupLifecycle(0.25)
    expect(lift.stage).toBe('lift')
    expect(lift.height).toBeGreaterThan(0.3)
    const collect = PfxLibrary.createPfxJumpPickupLifecycle(0.52)
    expect(collect.stage).toBe('collect')
    expect(collect.height).toBeGreaterThanOrEqual(0.9)
    const release = PfxLibrary.createPfxJumpPickupLifecycle(0.75)
    expect(release.stage).toBe('release')
    expect(release.energy).toBeGreaterThan(0.2)
    expect(release.energy).toBeLessThan(0.8)
    expect(PfxLibrary.createPfxJumpPickupLifecycle(0.94)).toEqual({
      energy: 0,
      height: 0,
      compression: 0,
      stage: 'rest',
    })

    const geometry = PfxLibrary.createPfxJumpPickupCradleGeometry('#ffcf4d')
    geometry.computeBoundingBox()
    expect(geometry.userData).toMatchObject({
      pfxGeometry: 'jump-pickup-launch-cradle',
      coilTurns: 2.25,
      coilSegments: 18,
      tubeSides: 5,
    })
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(0.9)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0.3)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(0.6)
    geometry.dispose()

    const material = PfxLibrary.createPfxJumpPickupCradleMaterial('#ffcf4d', 0.92)
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(material.flatShading).toBe(true)
    expect(material.vertexColors).toBe(true)
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(0.9)
    expect(material.roughness).toBeLessThanOrEqual(0.3)
    material.dispose()

    const apexGeometry = PfxLibrary.createPfxJumpPickupRewardGemGeometry('#fff4c2')
    expect(apexGeometry.userData).toMatchObject({
      pfxGeometry: 'jump-pickup-faceted-reward-gem',
      facetCount: 24,
    })
    apexGeometry.dispose()
    const apexMaterial = PfxLibrary.createPfxJumpPickupRewardGemMaterial('#ffd43b', 1)
    expect(apexMaterial.emissiveIntensity).toBeGreaterThanOrEqual(1.2)
    expect(apexMaterial.metalness).toBeGreaterThanOrEqual(0.25)
    expect(apexMaterial.roughness).toBeLessThanOrEqual(0.18)
    apexMaterial.dispose()

    const simulation = PfxLibrary.createPfxParticleSimulation(preset, stream!)
    const ys = Array.from(simulation.spawn).filter((_, index) => index % 3 === 1)
    const zs = Array.from(simulation.spawn).filter((_, index) => index % 3 === 2)
    const directionYs = Array.from(simulation.direction).filter((_, index) => index % 3 === 1)
    const directionXs = Array.from(simulation.direction).filter((_, index) => index % 3 === 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.25)
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.35)
    expect(directionYs.every((value) => value > 0)).toBe(true)
    expect(Math.max(...directionXs) - Math.min(...directionXs)).toBeGreaterThan(0.5)
  })

  it('authors target break as an intact target shell, closed 3D fracture volume, and ground-clear wave', () => {
    const plan = getPfxRenderPlan(createPfxPreset('target-break'))
    const shell = plan.surfaces.find((surface) => surface.phase === 'target-break-fracture-shell')
    const fragments = plan.surfaces.find((surface) => surface.phase === 'target-break-radial-fragments')
    const wave = plan.surfaces.find((surface) => surface.phase === 'target-break-ground-clear-wave')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(shell).toMatchObject({ kind: 'shield-shell', role: 'aura' })
    expect(shell?.tuning).toMatchObject({
      meshGeometry: 'target-break-lock-shell',
      meshShader: 'hex-shell',
      meshMotion: 'break',
    })
    expect(shell!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(0.3)
    expect(shell!.scale).toBeGreaterThanOrEqual(0.8)
    expect(shell!.scale).toBeLessThanOrEqual(0.95)
    expect(fragments).toMatchObject({ kind: 'shield-fragments', role: 'impact' })
    expect(fragments?.tuning).toMatchObject({
      meshMotion: 'flash',
      lifecycle: 'impact-shard-burst',
      meshGeometry: 'target-break-honeycomb-fragments',
    })
    expect(fragments!.scale).toBeGreaterThanOrEqual(1)
    expect(fragments!.scale).toBeLessThanOrEqual(1.15)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(fragments!, 2)).toBe(false)
    expect(wave).toMatchObject({ kind: 'shockwave-ring', role: 'impact' })
    expect(wave?.tuning).toMatchObject({
      meshGeometry: 'target-break-ground-reticle',
      meshMotion: 'shockwave',
      ringPurpose: 'shockwave',
    })
    expect(wave!.tuning!.delay).toBeGreaterThan(0.12)
    expect(wave!.tuning!.delay).toBeLessThanOrEqual(0.2)
    expect(wave!.tuning!.window).toBeUndefined()
    expect(wave!.opacity).toBeGreaterThanOrEqual(0.95)

    const fragmentGeometry = PfxLibrary.createPfxTargetBreakFragmentGeometry()
    fragmentGeometry.computeBoundingBox()
    expect(fragmentGeometry.boundingBox!.max.z - fragmentGeometry.boundingBox!.min.z).toBeGreaterThan(0.45)
    expect(fragmentGeometry.userData['pfxTargetBreakFragmentDrawCalls']).toBe(1)
    expect(fragmentGeometry.userData['pfxTargetBreakFragmentCount']).toBeGreaterThanOrEqual(10)
    expect(fragmentGeometry.userData['pfxTargetBreakClosedHoneycombCells']).toBe(true)
    expect(fragmentGeometry.userData['pfxTargetBreakDepthCrossingCount']).toBeGreaterThanOrEqual(4)
    expect(fragmentGeometry.userData['pfxTargetBreakMaximumRadius']).toBeLessThanOrEqual(0.82)
    fragmentGeometry.dispose()
    const fragmentMaterial = PfxLibrary.createPfxTargetBreakFragmentMaterial(1)
    expect(fragmentMaterial.userData['pfxTargetBreakFragmentMaterial']).toBe('faceted-cyan-crystal-with-controlled-rim')
    expect(fragmentMaterial.metalness).toBeGreaterThanOrEqual(0.2)
    expect(fragmentMaterial.roughness).toBeLessThanOrEqual(0.2)
    expect(fragmentMaterial.emissiveIntensity).toBeLessThanOrEqual(0.36)
    fragmentMaterial.dispose()

    const reticleGeometry = PfxLibrary.createPfxTargetBreakReticleGeometry()
    expect(reticleGeometry.userData['pfxTargetBreakReticleDrawCalls']).toBe(1)
    expect(reticleGeometry.userData['pfxTargetBreakReticleBracketCount']).toBe(4)
    expect(reticleGeometry.userData['pfxTargetBreakReticleRadialSegments']).toBeGreaterThanOrEqual(32)
    expect(reticleGeometry.userData['pfxTargetBreakReticleCancellationBars']).toBe(2)
    reticleGeometry.dispose()

    const lockShellGeometry = PfxLibrary.createPfxTargetLockShellGeometry()
    expect(lockShellGeometry.userData['pfxTargetLockShellDrawCalls']).toBe(1)
    expect(lockShellGeometry.userData['pfxTargetLockShellBracketCount']).toBe(8)
    expect(lockShellGeometry.userData['pfxTargetLockShellClosedGeometry']).toBe(true)
    lockShellGeometry.dispose()
  })

  it('authors exhaust hit as a directional engine jet, mechanical nozzle, and smoky thermal handoff', () => {
    const plan = getPfxRenderPlan(createPfxPreset('exhaust-hit'))
    const jet = plan.surfaces.find((surface) => surface.phase === 'exhaust-hit-compressed-plasma-jet')
    const nozzle = plan.surfaces.find((surface) => surface.phase === 'exhaust-hit-mechanical-nozzle')
    const smoke = plan.surfaces.find((surface) => surface.phase === 'exhaust-hit-smoke-handoff')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'impact-sparks')).toBe(false)
    expect(jet).toMatchObject({ kind: 'muzzle-cone', role: 'impact' })
    expect(jet?.tuning).toMatchObject({ meshMotion: 'flash', lifecycle: 'impact-shard-burst' })
    expect(jet!.tuning!.delay).toBe(0)
    expect(jet!.tuning!.window).toBeLessThanOrEqual(0.42)
    expect(jet!.tuning!.positionOffset?.[0]).toBeLessThanOrEqual(0)
    expect(jet!.scale).toBeGreaterThanOrEqual(0.85)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(jet!, 2)).toBe(false)

    expect(nozzle).toMatchObject({ kind: 'impact-core', role: 'body' })
    expect(nozzle?.tuning).toMatchObject({
      meshGeometry: 'exhaust-hit-mechanical-nozzle',
      meshMotion: 'flash',
      lifecycle: 'impact-afterglow',
    })
    expect(nozzle!.scale).toBeGreaterThanOrEqual(0.8)
    expect(jet!.scale).toBeGreaterThan(nozzle!.scale)
    expect(PfxLibrary.isPfxSurfaceCameraFacing(nozzle!, 2)).toBe(false)

    expect(smoke).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(smoke?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
      impactVector: [1, 0.1, 0.08],
    })
    expect(smoke!.tuning!.delay).toBeGreaterThanOrEqual(0.04)
    expect(smoke!.tuning!.window).toBeGreaterThanOrEqual(0.35)
    expect(smoke!.tuning!.depthScale).toBeGreaterThanOrEqual(1.8)
    expect(smoke!.tuning!.spreadAngle).toBeLessThanOrEqual(0.5)
    expect(smoke!.tuning!.stretch).toBeGreaterThanOrEqual(0.8)
    expect(Math.max(...smoke!.tuning!.size!)).toBeLessThanOrEqual(0.3)
    expect(smoke!.tuning!.positionOffset?.[0]).toBeLessThanOrEqual(0.1)

    const nozzleGeometry = PfxLibrary.createPfxExhaustHitNozzleGeometry()
    expect(nozzleGeometry.userData['pfxExhaustHitNozzleDrawCalls']).toBe(1)
    expect(nozzleGeometry.userData['pfxExhaustHitNozzleClosedGeometry']).toBe(true)
    expect(nozzleGeometry.userData['pfxExhaustHitNozzleAxis']).toEqual([1, 0, 0])
    expect(nozzleGeometry.userData['pfxExhaustHitNozzleFinCount']).toBeGreaterThanOrEqual(3)
    nozzleGeometry.dispose()
  })

  it('authors debris miss as ballistic skip chunks with a grounded directional scuff tail', () => {
    const plan = getPfxRenderPlan(createPfxPreset('debris-miss'))
    const chunks = plan.surfaces.find((surface) => surface.phase === 'debris-miss-ballistic-skip-chunks')
    const scuff = plan.surfaces.find((surface) => surface.phase === 'debris-miss-ground-scuff-tail')

    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(chunks).toMatchObject({ kind: 'impact-shards', role: 'impact' })
    expect(chunks?.tuning).toMatchObject({
      meshGeometry: 'debris-miss-rock-fragments',
      meshMotion: 'flash',
      lifecycle: 'impact-shard-burst',
      blend: 'alpha',
    })
    expect(chunks!.scale).toBeGreaterThanOrEqual(0.9)
    expect(chunks!.scale).toBeLessThanOrEqual(1.15)
    expect(chunks!.tuning!.window).toBeGreaterThanOrEqual(0.42)
    expect(chunks!.tuning!.startScale).toBeGreaterThanOrEqual(0.25)

    const createDebrisGeometry = (PfxLibrary as unknown as {
      createPfxDebrisMissFragmentGeometry: () => THREE.BufferGeometry
    }).createPfxDebrisMissFragmentGeometry
    expect(createDebrisGeometry).toBeTypeOf('function')
    const shardGeometry = createDebrisGeometry()
    expect(shardGeometry.userData['pfxDebrisMissDrawCalls']).toBe(1)
    expect(shardGeometry.userData['pfxDebrisMissClosedFaces']).toBe(true)
    expect(shardGeometry.userData['pfxDebrisMissFragmentCount']).toBeGreaterThanOrEqual(7)
    expect(shardGeometry.userData['pfxDebrisMissShapeVocabulary']).toBeGreaterThanOrEqual(2)
    expect(shardGeometry.userData['pfxDebrisMissTrajectorySpan']).toBeGreaterThanOrEqual(1)
    expect(shardGeometry.userData['pfxDebrisMissDepthSpan']).toBeGreaterThanOrEqual(0.6)
    shardGeometry.dispose()
    const createDebrisMaterial = (PfxLibrary as unknown as {
      createPfxDebrisMissFragmentMaterial: (opacity: number) => THREE.MeshStandardMaterial
    }).createPfxDebrisMissFragmentMaterial
    const shardMaterial = createDebrisMaterial(0.94)
    expect(shardMaterial.vertexColors).toBe(true)
    expect(shardMaterial.flatShading).toBe(true)
    expect(shardMaterial.roughness).toBeGreaterThanOrEqual(0.55)
    expect(shardMaterial.emissiveIntensity).toBeGreaterThanOrEqual(0.3)
    expect(shardMaterial.userData['pfxDebrisMissMaterial']).toBe('rough-faceted-earth-stone')
    shardMaterial.dispose()

    expect(scuff).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(scuff?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
      impactVector: [-1, 0.12, -0.24],
    })
    expect(PfxLibrary.getPfxSurfacePositionOffset(scuff!)[1]).toBeLessThanOrEqual(-0.8)
    expect(scuff!.tuning!.window).toBeGreaterThanOrEqual(0.6)
    expect(scuff!.tuning!.window).toBeLessThanOrEqual(0.68)
    expect(scuff!.tuning!.lifeScale).toBeGreaterThanOrEqual(1)
    expect(scuff!.tuning!.lifeScale).toBeLessThanOrEqual(1.15)
    expect(scuff!.tuning!.depthScale).toBeGreaterThanOrEqual(2)
    expect(scuff!.opacity).toBeGreaterThanOrEqual(0.82)
    expect(scuff!.scale).toBeGreaterThanOrEqual(1.95)
    expect(scuff!.scale).toBeLessThanOrEqual(2.15)
    expect(scuff!.tuning!.countScale).toBeGreaterThanOrEqual(1.7)
    expect(Math.max(...scuff!.tuning!.size!)).toBeGreaterThanOrEqual(0.9)
  })

  it('authors plasma ambient as a faceted breathing nucleus inside broken three-axis containment orbits', () => {
    const plan = getPfxRenderPlan(createPfxPreset('plasma-ambient'))
    const nucleus = plan.surfaces.find((surface) => surface.phase === 'plasma-ambient-faceted-nucleus')
    const arcs = plan.surfaces.find((surface) => surface.phase === 'plasma-ambient-broken-containment-orbits')
    const motes = plan.surfaces.find((surface) => surface.phase === 'plasma-ambient-depth-motes')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(nucleus).toMatchObject({ kind: 'core-sphere', role: 'body' })
    expect(nucleus?.tuning).toMatchObject({
      meshGeometry: 'plasma-ambient-contained-core',
      meshMotion: 'glow',
      lifecycle: 'plasma-ambient-breathing-loop',
      blend: 'alpha',
    })
    expect(nucleus!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(nucleus!.scale).toBeGreaterThanOrEqual(0.55)

    const createNucleusGeometry = (PfxLibrary as unknown as {
      createPfxPlasmaAmbientCoreGeometry: () => THREE.BufferGeometry
    }).createPfxPlasmaAmbientCoreGeometry
    expect(createNucleusGeometry).toBeTypeOf('function')
    const nucleusGeometry = createNucleusGeometry()
    expect(nucleusGeometry.userData['pfxPlasmaAmbientDrawCalls']).toBe(1)
    expect(nucleusGeometry.userData['pfxPlasmaAmbientClosedCore']).toBe(true)
    expect(nucleusGeometry.userData['pfxPlasmaAmbientFacetPaletteSize']).toBeGreaterThanOrEqual(3)
    nucleusGeometry.dispose()

    const createNucleusMaterial = (PfxLibrary as unknown as {
      createPfxPlasmaAmbientCoreMaterial: (opacity: number) => THREE.MeshStandardMaterial
    }).createPfxPlasmaAmbientCoreMaterial
    expect(createNucleusMaterial).toBeTypeOf('function')
    const nucleusMaterial = createNucleusMaterial(0.94)
    expect(nucleusMaterial.vertexColors).toBe(true)
    expect(nucleusMaterial.flatShading).toBe(true)
    expect(nucleusMaterial.emissiveIntensity).toBeGreaterThanOrEqual(1)
    expect(nucleusMaterial.userData['pfxPlasmaAmbientMaterial']).toBe('faceted-contained-plasma')
    nucleusMaterial.dispose()

    expect(arcs).toMatchObject({ kind: 'ring-field', role: 'aura' })
    expect(arcs?.tuning).toMatchObject({
      meshGeometry: 'plasma-ambient-broken-orbits',
      meshMotion: 'pulse',
      lifecycle: 'plasma-ambient-breathing-loop',
      ringPurpose: 'glyph',
      blend: 'additive',
    })
    const createOrbitGeometry = (PfxLibrary as unknown as {
      createPfxPlasmaAmbientOrbitGeometry: () => THREE.BufferGeometry
    }).createPfxPlasmaAmbientOrbitGeometry
    expect(createOrbitGeometry).toBeTypeOf('function')
    const orbitGeometry = createOrbitGeometry()
    expect(orbitGeometry.userData['pfxPlasmaAmbientOrbitDrawCalls']).toBe(1)
    expect(orbitGeometry.userData['pfxPlasmaAmbientBrokenOrbitCount']).toBeGreaterThanOrEqual(3)
    expect(orbitGeometry.userData['pfxPlasmaAmbientAxisCount']).toBeGreaterThanOrEqual(3)
    expect(orbitGeometry.userData['pfxPlasmaAmbientClosedTubes']).toBe(true)
    orbitGeometry.dispose()
    const createOrbitMaterial = (PfxLibrary as unknown as {
      createPfxPlasmaAmbientOrbitMaterial: (opacity: number) => THREE.MeshBasicMaterial
    }).createPfxPlasmaAmbientOrbitMaterial
    expect(createOrbitMaterial).toBeTypeOf('function')
    const orbitMaterial = createOrbitMaterial(0.78)
    expect(orbitMaterial.vertexColors).toBe(true)
    expect(orbitMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(orbitMaterial.depthWrite).toBe(false)
    expect(orbitMaterial.userData['pfxPlasmaAmbientOrbitMaterial']).toBe('broken-three-axis-containment')
    orbitMaterial.dispose()

    expect(motes).toMatchObject({ kind: 'particles', role: 'aura' })
    expect(motes?.tuning).toMatchObject({
      motion: 'orbit-ring',
      sprite: 'spark',
      blend: 'additive',
      gravity: 0,
      spinScale: 0,
    })
    expect(motes!.tuning!.countScale).toBeGreaterThanOrEqual(0.55)
    expect(motes!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(motes!.tuning!.lifeScale).toBeGreaterThanOrEqual(1.1)
    expect(Math.max(...motes!.tuning!.size!)).toBeGreaterThanOrEqual(0.38)
    expect(Math.min(...motes!.tuning!.size!)).toBeLessThanOrEqual(0.12)
  })

  it('authors snow spawn as a frost cradle, compact whiteout, and settling crystal recovery', () => {
    const plan = getPfxRenderPlan(createPfxPreset('snow-spawn'))
    const cradle = plan.surfaces.find((surface) => surface.phase === 'snow-spawn-sixfold-frost-cradle')
    const whiteout = plan.surfaces.find((surface) => surface.phase === 'snow-spawn-compact-whiteout')
    const crystals = plan.surfaces.find((surface) => surface.phase === 'snow-spawn-settling-crystals')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(cradle).toMatchObject({ kind: 'ring-field', role: 'aura' })
    expect(cradle?.tuning).toMatchObject({
      meshGeometry: 'snow-spawn-frost-cradle',
      meshMotion: 'pulse',
      lifecycle: 'snow-spawn-transition',
      ringPurpose: 'glyph',
      blend: 'additive',
    })
    const createCradleGeometry = (PfxLibrary as unknown as {
      createPfxSnowSpawnCradleGeometry: () => THREE.BufferGeometry
    }).createPfxSnowSpawnCradleGeometry
    expect(createCradleGeometry).toBeTypeOf('function')
    const cradleGeometry = createCradleGeometry()
    expect(cradleGeometry.userData['pfxSnowSpawnDrawCalls']).toBe(1)
    expect(cradleGeometry.userData['pfxSnowSpawnRadialShardCount']).toBeGreaterThanOrEqual(12)
    expect(cradleGeometry.userData['pfxSnowSpawnSymmetry']).toBe(6)
    expect(cradleGeometry.userData['pfxSnowSpawnContinuousRing']).toBe(false)
    expect(cradleGeometry.userData['pfxSnowSpawnGrounded']).toBe(true)
    cradleGeometry.dispose()

    expect(whiteout).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(whiteout?.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
    })
    expect(whiteout!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(whiteout!.tuning!.countScale).toBeGreaterThanOrEqual(0.8)
    expect(whiteout!.tuning!.window).toBeGreaterThanOrEqual(0.4)
    expect(whiteout!.opacity).toBeLessThanOrEqual(0.72)

    expect(crystals).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(crystals?.tuning).toMatchObject({
      motion: 'cone-fountain',
      sprite: 'sparkle',
      blend: 'alpha',
      spinScale: 0,
    })
    expect(crystals!.tuning!.gravity).toBeLessThanOrEqual(-1.2)
    expect(crystals!.tuning!.window).toBeGreaterThanOrEqual(0.45)
    expect(crystals!.tuning!.lifeScale).toBeGreaterThanOrEqual(1)
    expect(crystals!.tuning!.countScale).toBeGreaterThanOrEqual(0.8)
    expect(crystals!.tuning!.spreadAngle).toBeGreaterThanOrEqual(0.7)
    expect(Math.max(...crystals!.tuning!.size!)).toBeGreaterThanOrEqual(0.36)
    expect(Math.min(...crystals!.tuning!.size!)).toBeLessThanOrEqual(0.1)
  })

  it('authors poison death as a downward toxic collapse, grounded body cloud, and rising spore recovery', () => {
    const plan = getPfxRenderPlan(createPfxPreset('poison-death'))
    const collapse = plan.surfaces.find((surface) => surface.phase === 'poison-death-downward-collapse')
    const cloud = plan.surfaces.find((surface) => surface.phase === 'poison-death-grounded-body-cloud')
    const spores = plan.surfaces.find((surface) => surface.phase === 'poison-death-rising-spore-recovery')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(collapse?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
      impactVector: [0, -1, 0],
    })
    expect(collapse!.tuning!.spreadAngle).toBeGreaterThanOrEqual(0.55)
    expect(collapse!.tuning!.depthScale).toBeGreaterThanOrEqual(2.5)
    expect(collapse!.tuning!.window).toBeLessThanOrEqual(0.34)

    expect(cloud).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(cloud?.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'smoke',
      blend: 'alpha',
      death: 'erode',
    })
    expect(cloud!.tuning!.countScale).toBeGreaterThanOrEqual(1.2)
    expect(cloud!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(cloud!.tuning!.window).toBeGreaterThanOrEqual(0.52)
    expect(cloud!.opacity).toBeLessThanOrEqual(0.7)

    expect(spores).toMatchObject({ kind: 'particles', role: 'aura' })
    expect(spores?.tuning).toMatchObject({
      motion: 'column-rise',
      sprite: 'bubble',
      blend: 'alpha',
      gravity: 0,
      spinScale: 0,
    })
    expect(spores!.tuning!.countScale).toBeGreaterThanOrEqual(0.55)
    expect(spores!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(spores!.tuning!.lifeScale).toBeGreaterThanOrEqual(1)
    expect(Math.max(...spores!.tuning!.size!)).toBeGreaterThanOrEqual(0.32)
    expect(Math.min(...spores!.tuning!.size!)).toBeLessThanOrEqual(0.1)
  })

  it('authors ghost critical as a particle-first spectral tear, irregular fan, and eroding violet veil', () => {
    const preset = createPfxPreset('ghost-critical')
    const plan = getPfxRenderPlan(preset)
    const talons = plan.surfaces.find((surface) => surface.phase === 'ghost-critical-particle-soul-tear')
    const glint = plan.surfaces.find((surface) => surface.phase === 'ghost-critical-cold-contact-glint')
    const tear = talons
    const spectralFan = plan.surfaces.find((surface) => surface.phase === 'ghost-critical-particle-spectral-fan')
    const veil = plan.surfaces.find((surface) => surface.phase === 'ghost-critical-particle-violet-veil')

    expect(plan.surfaces).toHaveLength(3)
    expect(preset.implementationProfile).toBe('directional-burst')
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)

    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(talons).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(talons?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'twirl',
      lifecycle: 'ghost-critical-particle-haunt',
      blend: 'additive',
      impactVector: [1, 0.12, 0.18],
    })
    expect(spectralFan).toMatchObject({ kind: 'particles', role: 'trail' })
    expect(spectralFan?.tuning).toMatchObject({ motion: 'radial-burst', sprite: 'twinkle', randomizeAzimuth: true, lifecycle: 'ghost-critical-particle-haunt' })
    expect(veil).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(veil?.tuning).toMatchObject({ motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'ghost-critical-particle-haunt' })
    const createTalonsGeometry = (PfxLibrary as unknown as {
      createPfxGhostCriticalTalonGeometry: () => THREE.BufferGeometry
    }).createPfxGhostCriticalTalonGeometry
    expect(createTalonsGeometry).toBeTypeOf('function')
    const talonGeometry = createTalonsGeometry()
    expect(talonGeometry.userData['pfxGhostCriticalDrawCalls']).toBe(1)
    expect(talonGeometry.userData['pfxGhostCriticalClosedFaces']).toBe(true)
    expect(talonGeometry.userData['pfxGhostCriticalTalonCount']).toBeGreaterThanOrEqual(5)
    expect(talonGeometry.userData['pfxGhostCriticalSkullVolume']).toBe(true)
    expect(talonGeometry.userData['pfxGhostCriticalSkullPrimitiveCount']).toBeGreaterThanOrEqual(6)
    expect(talonGeometry.userData['pfxGhostCriticalEyeSocketCount']).toBe(2)
    expect(talonGeometry.userData['pfxGhostCriticalEyeSocketsRecessed']).toBe(true)
    expect(talonGeometry.userData['pfxGhostCriticalEyeSocketFront']).toBeGreaterThanOrEqual(0.26)
    expect(talonGeometry.userData['pfxGhostCriticalEyeSocketFront']).toBeLessThanOrEqual(0.29)
    expect(talonGeometry.userData['pfxGhostCriticalJawProjection']).toBeGreaterThanOrEqual(0.12)
    expect(talonGeometry.userData['pfxGhostCriticalFacingAxis'][0]).toBeGreaterThan(0.3)
    expect(talonGeometry.userData['pfxGhostCriticalFacingAxis'][2]).toBeGreaterThan(0.9)
    expect(talonGeometry.userData['pfxGhostCriticalSkullYaw']).toBeCloseTo(0.36)
    expect(talonGeometry.userData['pfxGhostCriticalProfileEyeSocketOverlap']).toBe(false)
    expect(talonGeometry.userData['pfxGhostCriticalLateralOrbitCount']).toBe(0)
    expect(talonGeometry.userData['pfxGhostCriticalTalonMaximumDepth']).toBeGreaterThanOrEqual(0.2)
    expect(talonGeometry.userData['pfxGhostCriticalTalonMaximumDepth']).toBeLessThanOrEqual(0.35)
    expect(talonGeometry.userData['pfxGhostCriticalTalonMinimumDepth']).toBeGreaterThanOrEqual(-0.55)
    expect(talonGeometry.userData['pfxGhostCriticalTalonMinimumDepth']).toBeLessThanOrEqual(-0.4)
    expect(talonGeometry.userData['pfxGhostCriticalToothShape']).toBe('tapered-fangs')
    expect(talonGeometry.userData['pfxGhostCriticalProfileFaceProjection']).toBeGreaterThanOrEqual(0.38)
    expect(talonGeometry.userData['pfxGhostCriticalCraniumRadius']).toBe(0.32)
    expect(talonGeometry.userData['pfxGhostCriticalFrontBrowCount']).toBe(2)
    expect(talonGeometry.userData['pfxGhostCriticalBrowShape']).toBe('tapered-orbital-ridges')
    expect(talonGeometry.userData['pfxGhostCriticalMinimumTalonWidth']).toBeGreaterThanOrEqual(0.1)
    expect(talonGeometry.userData['pfxGhostCriticalMaximumTalonWidth']).toBeLessThanOrEqual(0.19)
    expect(talonGeometry.userData['pfxGhostCriticalTalonFacetSides']).toBeGreaterThanOrEqual(7)
    expect(talonGeometry.userData['pfxGhostCriticalSideSilhouetteLobeCount']).toBe(3)
    expect(talonGeometry.userData['pfxGhostCriticalTrajectorySpan']).toBeGreaterThanOrEqual(1)
    expect(talonGeometry.userData['pfxGhostCriticalDepthSpan']).toBeGreaterThanOrEqual(0.5)
    expect(talonGeometry.userData['pfxGhostCriticalDepthToTrajectoryRatio']).toBeGreaterThanOrEqual(0.45)
    expect(talonGeometry.userData['pfxGhostCriticalDepthToTrajectoryRatio']).toBeLessThanOrEqual(0.85)
    expect(talonGeometry.userData['pfxGhostCriticalAsymmetric']).toBe(true)
    expect(talonGeometry.getAttribute('color')).toBeDefined()
    expect(talonGeometry.getAttribute('pfxPart')).toBeDefined()
    talonGeometry.dispose()

    const createTalonsMaterial = (PfxLibrary as unknown as {
      createPfxGhostCriticalTalonMaterial: (opacity: number) => THREE.ShaderMaterial
    }).createPfxGhostCriticalTalonMaterial
    expect(createTalonsMaterial).toBeTypeOf('function')
    const talonMaterial = createTalonsMaterial(0.9)
    expect(talonMaterial.vertexColors).toBe(true)
    expect(talonMaterial.transparent).toBe(true)
    expect(talonMaterial.blending).toBe(THREE.NormalBlending)
    expect(talonMaterial.depthWrite).toBe(false)
    expect(talonMaterial.uniforms['uOpacity']!.value).toBe(0.9)
    expect(talonMaterial.uniforms['uFresnelPower']!.value).toBeGreaterThanOrEqual(2)
    expect(talonMaterial.uniforms['uEdgeColor']!.value).toBeInstanceOf(THREE.Color)
    expect(talonMaterial.vertexShader).not.toContain('attribute vec3 color;')
    expect(talonMaterial.vertexShader).toContain('attribute float pfxPart')
    expect(talonMaterial.fragmentShader).toContain('spectralVein')
    expect(talonMaterial.fragmentShader).toContain('spectralFracture')
    expect(talonMaterial.fragmentShader).toContain('valueSeparation')
    expect(talonMaterial.fragmentShader).toContain('facetLight')
    expect(talonMaterial.fragmentShader).toContain('prismaticCrossSection')
    expect(talonMaterial.fragmentShader).toContain('skullMask')
    expect(talonMaterial.fragmentShader).toContain('cleanSkullLight')
    expect(talonMaterial.fragmentShader).toContain('socketFalloff')
    expect(talonMaterial.fragmentShader).toContain('voidMarker')
    expect(talonMaterial.fragmentShader).not.toContain('lateralVoidMarker')
    expect(talonMaterial.fragmentShader).not.toContain('vLateralView')
    expect(talonMaterial.userData['pfxMaterial']).toBe('violet-cyan-spectral-talon')
    talonMaterial.dispose()

    expect(glint).toBeUndefined()
    const createImpactCoreMaterial = (PfxLibrary as unknown as {
      createPfxImpactCoreMaterial: (opacity: number, color: THREE.ColorRepresentation) => THREE.MeshStandardMaterial
    }).createPfxImpactCoreMaterial
    const coldImpactMaterial = createImpactCoreMaterial(0.95, '#e9ffff')
    expect(coldImpactMaterial.emissive.b).toBeGreaterThanOrEqual(coldImpactMaterial.emissive.r)
    expect(coldImpactMaterial.emissive.g).toBeGreaterThanOrEqual(coldImpactMaterial.emissive.r)
    coldImpactMaterial.dispose()
    expect(tear).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(tear!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(tear?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'twirl',
      blend: 'additive',
      colorOverride: '#e8ffff',
      ramp: 'pinned-hot',
      turbulenceScale: 0.02,
      impactVector: [1, 0.12, 0.18],
      positionOffset: [0.02, 0.08, 0.28],
    })
    expect(tear!.tuning!.spreadAngle).toBeLessThanOrEqual(0.45)
    expect(tear!.tuning!.delay).toBe(0)
    expect(tear!.tuning!.countScale).toBeGreaterThanOrEqual(0.35)
    expect(tear!.tuning!.countScale).toBeLessThanOrEqual(0.5)
    expect(tear!.tuning!.window).toBeLessThanOrEqual(0.22)
    expect(tear!.tuning!.lifeScale).toBeLessThanOrEqual(0.5)
    expect(tear!.tuning!.stretch).toBeGreaterThanOrEqual(0.4)
    expect(tear!.tuning!.stretch).toBeLessThanOrEqual(0.6)
    expect(tear!.tuning!.spinScale).toBeGreaterThanOrEqual(0.7)
    expect(Math.max(...tear!.tuning!.size!)).toBeGreaterThanOrEqual(0.3)
    expect(Math.max(...tear!.tuning!.size!)).toBeLessThanOrEqual(0.36)
    expect(tear!.tuning!.window).toBeLessThanOrEqual(0.34)
    expect(tear!.tuning!.depthScale).toBeGreaterThanOrEqual(2.5)
    const tearRamp = PfxLibrary.getPfxParticleColorRamp(preset.controls, tear!)
    expect(tearRamp.tail[2]).toBeGreaterThan(tearRamp.tail[0])
    expect(tearRamp.tail[1]).toBeGreaterThan(tearRamp.tail[0])

    expect(veil).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(veil?.tuning).toMatchObject({
      motion: 'drift-cloud',
      sprite: 'smoke-variants',
      blend: 'alpha',
      ramp: 'dark',
      death: 'erode',
      turbulenceScale: 0.22,
    })
    expect(veil!.tuning!.delay).toBeGreaterThanOrEqual(0.1)
    expect(veil!.tuning!.window).toBeGreaterThanOrEqual(0.5)
    expect(veil!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(veil!.opacity).toBeLessThanOrEqual(0.65)
  })

  it('treats barrier low health as a persistent world-space danger state', () => {
    const effect = PFX_TAXONOMY.find((candidate) => candidate.id === 'barrier-low-health')

    expect(effect).toMatchObject({
      effectType: 'shield',
      space: 'world',
      loopMode: 'loop',
      role: 'loop',
    })
  })

  it('authors barrier low health as an asymmetric breached shield with localized failure matter', () => {
    const preset = createPfxPreset('barrier-low-health')
    const plan = getPfxRenderPlan(preset)
    const shell = plan.surfaces.find((surface) => surface.phase === 'barrier-low-health-fractured-shell')
    const breachRibs = plan.surfaces.find((surface) => surface.phase === 'barrier-low-health-breach-energy-ribs')
    const failingPanels = plan.surfaces.find((surface) => surface.phase === 'barrier-low-health-failing-panels')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(shell).toMatchObject({ kind: 'shield-shell', role: 'body' })
    expect(shell?.tuning).toMatchObject({
      meshGeometry: 'barrier-low-health-fractured-shell',
      meshShader: 'barrier-failure-shell',
      meshMotion: 'pulse',
      lifecycle: 'barrier-low-health-failure-loop',
      blend: 'alpha',
      colorOverride: '#d52b3c',
    })
    expect(shell!.opacity).toBeGreaterThanOrEqual(0.72)

    const createGeometry = (PfxLibrary as unknown as {
      createPfxBarrierLowHealthGeometry: () => THREE.BufferGeometry
    }).createPfxBarrierLowHealthGeometry
    expect(createGeometry).toBeTypeOf('function')
    const geometry = createGeometry()
    expect(geometry.userData['pfxBarrierLowHealthDrawCalls']).toBe(1)
    expect(geometry.userData['pfxBarrierLowHealthOpenShell']).toBe(true)
    expect(geometry.userData['pfxBarrierLowHealthBreachCount']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxBarrierLowHealthMainBreachThreshold']).toBeGreaterThanOrEqual(0.9)
    expect(geometry.userData['pfxBarrierLowHealthAsymmetric']).toBe(true)
    expect(geometry.userData['pfxBarrierLowHealthLiftedPanelCount']).toBeGreaterThanOrEqual(8)
    expect(geometry.userData['pfxBarrierLowHealthLiftedPanelCount']).toBeLessThanOrEqual(16)
    expect(geometry.userData['pfxBarrierLowHealthMaximumPanelLift']).toBeGreaterThanOrEqual(0.18)
    expect(geometry.userData['pfxBarrierLowHealthRetainedTriangleRatio']).toBeGreaterThan(0.94)
    expect(geometry.userData['pfxBarrierLowHealthRetainedTriangleRatio']).toBeLessThan(0.98)
    expect(geometry.userData['pfxBarrierLowHealthDepthSpan']).toBeGreaterThanOrEqual(1.35)
    expect(geometry.userData['pfxBarrierLowHealthMainBreachDirection']).toEqual(expect.arrayContaining([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]))
    geometry.dispose()

    const createMaterial = (PfxLibrary as unknown as {
      createPfxBarrierLowHealthMaterial: (opacity: number, color: THREE.ColorRepresentation) => THREE.ShaderMaterial
    }).createPfxBarrierLowHealthMaterial
    expect(createMaterial).toBeTypeOf('function')
    const material = createMaterial(0.8, '#d52b3c')
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.depthWrite).toBe(false)
    expect(material.fragmentShader).toContain('pfxHexEdge')
    expect(material.fragmentShader).toContain('dangerBeat')
    expect(material.fragmentShader).toContain('breachHeat')
    expect(material.fragmentShader).toContain('fractureBranch')
    expect(material.fragmentShader).toContain('breachRim')
    expect(material.fragmentShader).toContain('fresnelAlarm')
    expect(material.fragmentShader).toContain('localizedFresnel')
    expect(material.fragmentShader).toContain('alarmWaveDistance')
    expect(material.fragmentShader).toContain('alarmSweep')
    expect(material.fragmentShader).toContain('viewSpecular')
    expect(material.fragmentShader).toContain('rimColor')
    expect(material.fragmentShader).toContain('strainColor')
    expect(material.fragmentShader).toContain('hemisphereShade')
    expect(material.fragmentShader).toContain('woundColor')
    expect(material.fragmentShader).toContain('interiorFill')
    expect(material.fragmentShader).toContain('panelValue')
    expect(material.userData['pfxMaterial']).toBe('barrier-low-health-fractured-shell')
    material.dispose()

    expect(breachRibs).toMatchObject({ kind: 'impact-shards', role: 'impact' })
    expect(breachRibs?.tuning).toMatchObject({
      meshGeometry: 'barrier-low-health-breach-ribs',
      meshMotion: 'pulse',
      lifecycle: 'barrier-low-health-failure-loop',
      blend: 'additive',
      positionOffset: [0.56, 0.13, 0.43],
    })
    expect(breachRibs!.scale).toBeGreaterThanOrEqual(0.85)
    const createBreachGeometry = (PfxLibrary as unknown as {
      createPfxBarrierBreachRibGeometry: () => THREE.BufferGeometry
    }).createPfxBarrierBreachRibGeometry
    expect(createBreachGeometry).toBeTypeOf('function')
    const breachGeometry = createBreachGeometry()
    expect(breachGeometry.userData['pfxBarrierBreachDrawCalls']).toBe(1)
    expect(breachGeometry.userData['pfxBarrierBreachClosedFaces']).toBe(true)
    expect(breachGeometry.userData['pfxBarrierBreachRibCount']).toBeGreaterThanOrEqual(4)
    expect(breachGeometry.userData['pfxBarrierBreachFacetSides']).toBeGreaterThanOrEqual(7)
    expect(breachGeometry.userData['pfxBarrierBreachDepthSpan']).toBeGreaterThanOrEqual(0.28)
    expect(breachGeometry.userData['pfxBarrierBreachRootSpan']).toBeGreaterThanOrEqual(0.3)
    expect(breachGeometry.userData['pfxBarrierBreachSharedRoot']).toBe(false)
    expect(breachGeometry.userData['pfxBarrierBreachOutwardAlignment']).toBeGreaterThanOrEqual(0.9)
    expect(breachGeometry.userData['pfxBarrierBreachLengthVariance']).toBeGreaterThanOrEqual(0.15)
    expect(breachGeometry.userData['pfxBarrierBreachTipWidthRatio']).toBeGreaterThanOrEqual(0.25)
    expect(breachGeometry.userData['pfxBarrierBreachCoreVertexCount']).toBe(0)
    expect(breachGeometry.userData['pfxBarrierBreachInteriorStrutCount']).toBe(0)
    expect(breachGeometry.userData['pfxBarrierBreachPalette']).toBe('shield-crimson-strain-violet')
    breachGeometry.dispose()

    const createBreachMaterial = (PfxLibrary as unknown as {
      createPfxBarrierBreachRibMaterial: (opacity: number) => THREE.MeshStandardMaterial
    }).createPfxBarrierBreachRibMaterial
    expect(createBreachMaterial).toBeTypeOf('function')
    const breachMaterial = createBreachMaterial(0.9)
    expect(breachMaterial.vertexColors).toBe(true)
    expect(breachMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(breachMaterial.depthWrite).toBe(false)
    expect(breachMaterial.emissiveIntensity).toBeGreaterThanOrEqual(1)
    expect(breachMaterial.emissiveIntensity).toBeLessThanOrEqual(1.5)
    breachMaterial.dispose()

    const loopSamples = Array.from({ length: 80 }, (_, index) =>
      getPfxSurfaceAnimationProps(shell!, preset.controls, index / 80, 1, 1.45, 2),
    )
    const opacitySamples = loopSamples.map((sample) => sample.opacityMultiplier)
    expect(Math.max(...opacitySamples) - Math.min(...opacitySamples)).toBeGreaterThanOrEqual(0.4)
    expect(Math.min(...opacitySamples)).toBeGreaterThanOrEqual(0.5)
    expect(Math.max(...loopSamples.map((sample) => sample.scaleMultiplier)) - Math.min(...loopSamples.map((sample) => sample.scaleMultiplier))).toBeLessThanOrEqual(0.05)

    const breachLoopSamples = Array.from({ length: 80 }, (_, index) =>
      getPfxSurfaceAnimationProps(breachRibs!, preset.controls, index / 80, 1, 1.45, 2),
    )
    const breachScaleSamples = breachLoopSamples.map((sample) => sample.scaleMultiplier)
    expect(Math.max(...breachScaleSamples) - Math.min(...breachScaleSamples)).toBeGreaterThanOrEqual(0.75)
    expect(Math.max(...breachScaleSamples)).toBeGreaterThanOrEqual(1.5)

    expect(failingPanels).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(failingPanels?.tuning).toMatchObject({
      motion: 'impact-burst',
      sprite: 'debris',
      blend: 'alpha',
      colorOverride: '#d3443f',
      ramp: 'pigment',
      death: 'erode',
      impactVector: [0.78, 0.18, 0.6],
      positionOffset: [0.47, 0.08, 0.36],
    })
    expect(failingPanels!.tuning!.gravity).toBeLessThan(0)
    expect(failingPanels!.tuning!.window).toBeLessThanOrEqual(0.42)
    expect(failingPanels!.tuning!.countScale).toBeGreaterThanOrEqual(0.6)
  })

  it('authors flame charge as a particle-first compressing fire build', () => {
    const preset = createPfxPreset('flame-charge')
    expect(preset.implementationProfile).toBe('continuous-emitter')
    const plan = getPfxRenderPlan(preset)
    const crucible = plan.surfaces.find((surface) => surface.phase === 'flame-charge-particle-core-swell')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(crucible).toMatchObject({ kind: 'particles', role: 'body' })
    expect(crucible?.tuning).toMatchObject({
      motion: 'column-rise',
      sprite: 'fire',
      lifecycle: 'flame-charge-compress',
      blend: 'additive',
      colorOverride: '#ff6a18',
    })
    expect(crucible!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(crucible!.opacity).toBeLessThanOrEqual(0.98)
    expect(crucible!.scale).toBeGreaterThanOrEqual(0.98)
    expect(crucible!.scale).toBeLessThanOrEqual(1.2)

    const createCrucibleGeometry = (PfxLibrary as unknown as {
      createPfxFlameChargeCrucibleGeometry: () => THREE.BufferGeometry
    }).createPfxFlameChargeCrucibleGeometry
    expect(createCrucibleGeometry).toBeTypeOf('function')
    const geometry = createCrucibleGeometry()
    expect(geometry.userData['pfxFlameChargeCrucible']).toBe('single-draw-continuous-bent-flame-volume')
    expect(geometry.userData['pfxFlameChargeDrawCalls']).toBe(1)
    expect(geometry.userData['pfxFlameChargeContinuousSurface']).toBe(true)
    expect(geometry.userData['pfxFlameChargeInterlockingVolumes']).toBe(false)
    expect(geometry.userData['pfxFlameChargeSmoothRadialSegments']).toBeGreaterThanOrEqual(48)
    expect(geometry.userData['pfxFlameChargeSmoothHeightSegments']).toBeGreaterThanOrEqual(32)
    expect(geometry.userData['pfxFlameChargeCoreRadius']).toBeGreaterThanOrEqual(0.4)
    expect(geometry.userData['pfxFlameChargeCoreRadius']).toBeLessThanOrEqual(0.43)
    expect(geometry.userData['pfxFlameChargeBentCrest']).toBe(true)
    expect(geometry.userData['pfxFlameChargeCrestOffset']).toBeGreaterThanOrEqual(0.26)
    expect(geometry.userData['pfxFlameChargeCrestOffset']).toBeLessThanOrEqual(0.34)
    expect(geometry.userData['pfxFlameChargeCrestDepthOffset']).toBeLessThanOrEqual(-0.24)
    expect(geometry.userData['pfxFlameChargeCrestLift']).toBeGreaterThanOrEqual(0.5)
    expect(geometry.userData['pfxFlameChargeCrestLift']).toBeLessThanOrEqual(0.6)
    expect(geometry.userData['pfxFlameChargeSecondaryDepthLobe']).toBe(true)
    expect(geometry.userData['pfxFlameChargeSecondaryLobeDirectionZ']).toBeGreaterThanOrEqual(0.65)
    expect(geometry.userData['pfxFlameChargeCrossSectionAspect']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxFlameChargeCrossSectionAspect']).toBeLessThanOrEqual(3)
    expect(geometry.userData['pfxFlameChargeLargestComponentShare']).toBe(1)
    expect(geometry.userData['pfxFlameChargeConnectedComponents']).toBe(1)
    expect(geometry.userData['pfxFlameChargeVolumeAxis']).toBe('y')
    expect(geometry.userData['pfxFlameChargeForwardSpan']).toBeGreaterThanOrEqual(0.62)
    expect(geometry.userData['pfxFlameChargeDominantContinuousBody']).toBe(true)
    expect(geometry.userData['pfxFlameChargeNonCircularCrossSection']).toBe(true)
    expect(geometry.userData['pfxFlameChargeRadialSymmetry']).toBe(false)
    expect(geometry.userData['pfxFlameChargeHeightSpan']).toBeGreaterThanOrEqual(1.25)
    expect(geometry.userData['pfxFlameChargeClosedCaps']).toBe(true)
    expect(geometry.userData['pfxFlameChargeDepthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(geometry.index).not.toBeNull()
    expect(geometry.index!.count).toBeGreaterThanOrEqual(8_500)
    expect(geometry.index!.count).toBeLessThanOrEqual(9_500)
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(1_600)
    expect(geometry.getAttribute('position').count).toBeLessThan(1_700)
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count)
    geometry.dispose()

    const createCrucibleMaterial = (PfxLibrary as unknown as {
      createPfxFlameChargeCrucibleMaterial: (opacity: number, color: THREE.ColorRepresentation) => THREE.ShaderMaterial
    }).createPfxFlameChargeCrucibleMaterial
    expect(createCrucibleMaterial).toBeTypeOf('function')
    const material = createCrucibleMaterial(0.94, '#ff4a0d')
    expect(material.userData['pfxMaterial']).toBe('flame-charge-additive-crucible')
    expect(material.userData['pfxFlameChargeVolumeAxis']).toBe('y')
    expect(material.userData['pfxFlameChargePalette']).toBe('warm-red-orange-no-green-cast')
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.toneMapped).toBe(false)
    const hotColor = material.uniforms.uColorHot!.value as THREE.Vector3
    const coreColor = material.uniforms.uColorCore?.value as THREE.Vector3 | undefined
    const expectedHotColor = new THREE.Color('#ffb52e')
    expect(hotColor.x).toBeCloseTo(expectedHotColor.r, 5)
    expect(hotColor.y).toBeCloseTo(expectedHotColor.g, 5)
    expect(hotColor.z).toBeCloseTo(expectedHotColor.b, 5)
    const expectedCoreColor = new THREE.Color('#ff790f')
    expect(coreColor?.x).toBeCloseTo(expectedCoreColor.r, 5)
    expect(coreColor?.y).toBeCloseTo(expectedCoreColor.g, 5)
    expect(coreColor?.z).toBeCloseTo(expectedCoreColor.b, 5)
    const heartColor = material.uniforms.uColorHeart?.value as THREE.Vector3 | undefined
    const expectedHeartColor = new THREE.Color('#ff7a12')
    expect(heartColor?.x).toBeCloseTo(expectedHeartColor.r, 5)
    expect(heartColor?.y).toBeCloseTo(expectedHeartColor.g, 5)
    expect(heartColor?.z).toBeCloseTo(expectedHeartColor.b, 5)
    const outerFlame = material.uniforms.uColorOuter?.value as THREE.Vector3 | undefined
    const midFlame = material.uniforms.uColorMid?.value as THREE.Vector3 | undefined
    const expectedOuterFlame = new THREE.Color('#a91604')
    const expectedMidFlame = new THREE.Color('#f03f08')
    expect(outerFlame?.x).toBeCloseTo(expectedOuterFlame.r, 5)
    expect(outerFlame?.y).toBeCloseTo(expectedOuterFlame.g, 5)
    expect(outerFlame?.z).toBeCloseTo(expectedOuterFlame.b, 5)
    expect(midFlame?.x).toBeCloseTo(expectedMidFlame.r, 5)
    expect(midFlame?.y).toBeCloseTo(expectedMidFlame.g, 5)
    expect(midFlame?.z).toBeCloseTo(expectedMidFlame.b, 5)
    expect(material.userData['pfxFlameChargeEdgeErosion']).toBe(false)
    expect(material.userData['pfxFlameChargeClosedVolume']).toBe(true)
    expect(material.uniforms.uCoreGain?.value).toBeGreaterThanOrEqual(1.3)
    expect(material.uniforms.uCoreGain?.value).toBeLessThanOrEqual(1.45)
    expect(material.fragmentShader).toContain('surfaceNoise')
    expect(material.fragmentShader).toContain('crownHeat')
    expect(material.fragmentShader).toContain('tipCooling')
    expect(material.fragmentShader).toContain('softHeat')
    expect(material.fragmentShader).toContain('turbulentBands')
    expect(material.fragmentShader).toContain('emberVein')
    expect(material.fragmentShader).toContain('volumeShade')
    expect(material.fragmentShader).toContain('moltenShellAlpha')
    expect(material.fragmentShader).toContain('rimSeparation')
    expect(material.fragmentShader).toContain('roilContrast')
    expect(material.fragmentShader).toContain('flameCells')
    expect(material.fragmentShader).toContain('thermalBlend')
    expect(material.fragmentShader).toContain('temperatureBands')
    expect(material.fragmentShader).toContain('detailContrast')
    expect(material.fragmentShader).toContain('incandescentHeart')
    expect(material.fragmentShader).toContain('focusedIncandescentHeart')
    expect(material.fragmentShader).toContain('crispEmissiveCore')
    expect(material.fragmentShader).toContain('incandescentFloor')
    expect(material.fragmentShader).not.toContain('smoothstep(0.46, 0.68')
    expect(material.fragmentShader).toContain('rimGlow')
    expect(material.fragmentShader).toContain('specularGlint')
    expect(material.fragmentShader).toContain('uColorCore')
    expect(material.fragmentShader).toContain('pfxValueNoise')
    expect(material.fragmentShader).not.toContain('discard')
    expect(material.vertexShader).toContain('crownMotion')
    expect(material.vertexShader).toContain('chargeShape')
    expect(material.vertexShader).toContain('surfaceRipple')
    expect(material.vertexShader).toContain('uCrownMotionAmplitude')
    expect(material.uniforms.uCrownMotionAmplitude?.value).toBeGreaterThanOrEqual(0.045)
    expect(material.uniforms.uCrownMotionAmplitude?.value).toBeLessThanOrEqual(0.065)
    expect(material.userData['pfxFlameChargeTurbulentBands']).toBe(true)
    material.dispose()
    expect(PfxLibrary.isPfxSurfaceCameraFacing(crucible!, 2)).toBe(false)

    const lightProfile = PfxLibrary.getPfxFlameChargeLightProfile()
    expect(lightProfile).toEqual({ color: '#ff5a16', intensity: 2.4, distance: 2.2, decay: 2 })

    const chargeSamples = [0, 0.2, 0.5, 0.9].map((progress) =>
      getPfxSurfaceAnimationProps(crucible!, preset.controls, progress, 1, 1.1, 2),
    )
    expect(chargeSamples.every((sample) => Number.isFinite(sample.opacityMultiplier))).toBe(true)
    expect(chargeSamples.every((sample) => Number.isFinite(sample.scaleMultiplier))).toBe(true)
    expect(chargeSamples[1]!.yOffset).toBeGreaterThanOrEqual(chargeSamples[0]!.yOffset)
  })

  it('layers flame charge as a particle-first core, inflow, and smoke handoff', () => {
    const preset = createPfxPreset('flame-charge')
    const plan = getPfxRenderPlan(preset)
    const inwardEmbers = plan.surfaces.find((surface) => surface.phase === 'flame-charge-gather-inflow')
    const core = plan.surfaces.find((surface) => surface.phase === 'flame-charge-particle-core-swell')
    const smoke = plan.surfaces.find((surface) => surface.phase === 'flame-charge-particle-char-smoke')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(inwardEmbers).toMatchObject({ kind: 'particles', role: 'aura' })
    expect(inwardEmbers?.tuning).toMatchObject({
      motion: 'braided-converge',
      sprite: 'ember',
      lifecycle: 'flame-charge-compress',
      blend: 'additive',
      colorOverride: '#ff6412',
    })
    expect(core?.tuning).toMatchObject({ motion: 'column-rise', sprite: 'fire', lifecycle: 'flame-charge-compress' })
    expect(smoke?.tuning).toMatchObject({ motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'flame-charge-compress' })
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    const inflowSimulation = PfxLibrary.createPfxParticleSimulation(preset, inwardEmbers!)
    expect(inflowSimulation.motionKind).toBe('braided-converge')
    expect(inflowSimulation.count).toBeGreaterThanOrEqual(20)
    const inwardDots = Array.from({ length: inflowSimulation.count }, (_, index) => {
      const offset = index * 3
      return inflowSimulation.spawn[offset]! * inflowSimulation.direction[offset]!
        + inflowSimulation.spawn[offset + 1]! * inflowSimulation.direction[offset + 1]!
        + inflowSimulation.spawn[offset + 2]! * inflowSimulation.direction[offset + 2]!
    })
    expect(Math.max(...inwardDots)).toBeLessThan(0)
    expect(Math.max(...Array.from(inflowSimulation.speed))).toBeGreaterThanOrEqual(0.25)
  })

  it('builds four narrow asymmetric flame ribbons as one mobile-budget world-space draw', () => {
    const createGeometry = (PfxLibrary as unknown as {
      createPfxFlameChargeTendrilGeometry: () => THREE.BufferGeometry
    }).createPfxFlameChargeTendrilGeometry
    expect(createGeometry).toBeTypeOf('function')

    const geometry = createGeometry()
    const flow = geometry.getAttribute('aFlowProgress')
    const flowValues = Array.from(flow.array as Float32Array)
    expect(geometry.userData['pfxFlameChargeTendrils']).toBe('four-narrow-crossed-inward-fire-ribbons')
    expect(geometry.userData['pfxFlameChargeTendrilCount']).toBe(4)
    expect(geometry.userData['pfxFlameChargeRibbonPlaneCount']).toBe(8)
    expect(geometry.userData['pfxFlameChargeTendrilAsymmetricLanes']).toBe(true)
    expect(geometry.userData['pfxFlameChargeVolumetricCrossedRibbons']).toBe(true)
    expect(geometry.userData['pfxFlameChargeTendrilDrawCalls']).toBe(1)
    expect(geometry.userData['pfxFlameChargeTendrilTapered']).toBe(true)
    expect(geometry.userData['pfxFlameChargeTendrilOuterEndpointScale']).toBe(0)
    expect(geometry.userData['pfxFlameChargeTendrilInnerEndpointScale']).toBeGreaterThanOrEqual(0.3)
    expect(geometry.userData['pfxFlameChargeTendrilInnerEndpointScale']).toBeLessThanOrEqual(0.4)
    expect(geometry.userData['pfxFlameChargeTendrilOuterRadius']).toBeGreaterThanOrEqual(0.78)
    expect(geometry.userData['pfxFlameChargeTendrilOuterRadius']).toBeLessThanOrEqual(0.86)
    expect(geometry.userData['pfxFlameChargeTendrilTerminalRadius']).toBeGreaterThanOrEqual(0.1)
    expect(geometry.userData['pfxFlameChargeTendrilTerminalRadius']).toBeLessThanOrEqual(0.16)
    expect(geometry.userData['pfxFlameChargeTendrilMaximumHalfWidth']).toBeGreaterThanOrEqual(0.075)
    expect(geometry.userData['pfxFlameChargeTendrilMaximumHalfWidth']).toBeLessThanOrEqual(0.095)
    expect(geometry.userData['pfxFlameChargeTendrilArcSweep']).toBeLessThanOrEqual(Math.PI * 0.4)
    expect(geometry.userData['pfxFlameChargeTendrilDepthSpan']).toBeGreaterThanOrEqual(0.72)
    expect(geometry.userData['pfxFlameChargeTendrilHeightSpan']).toBeGreaterThanOrEqual(0.5)
    expect(geometry.index).not.toBeNull()
    expect(geometry.index!.count).toBeGreaterThanOrEqual(2_300)
    expect(geometry.index!.count).toBeLessThanOrEqual(2_350)
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(760)
    expect(geometry.getAttribute('position').count).toBeLessThanOrEqual(800)
    expect(flow.count).toBe(geometry.getAttribute('position').count)
    expect(Math.min(...flowValues)).toBeCloseTo(0, 5)
    expect(Math.max(...flowValues)).toBeCloseTo(1, 5)
    geometry.dispose()
  })

  it('animates flame-charge tendril heat visibly from the outer lanes into the core', () => {
    const createMaterial = (PfxLibrary as unknown as {
      createPfxFlameChargeTendrilMaterial: (
        opacity: number,
        color: THREE.ColorRepresentation,
      ) => THREE.ShaderMaterial
    }).createPfxFlameChargeTendrilMaterial
    expect(createMaterial).toBeTypeOf('function')

    const material = createMaterial(0.74, '#ff6412')
    expect(material.userData['pfxMaterial']).toBe('flame-charge-inward-tendrils')
    expect(material.userData['pfxFlameChargeFlowDirection']).toBe('outer-to-core')
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(THREE.DoubleSide)
    expect(material.uniforms.uOpacity?.value).toBeCloseTo(0.74)
    expect(material.uniforms.uCoreBoost?.value).toBeGreaterThanOrEqual(1.25)
    const hot = material.uniforms.uColorHot?.value as THREE.Vector3
    expect(hot.x).toBeGreaterThanOrEqual(0.95)
    expect(hot.y).toBeGreaterThanOrEqual(0.58)
    expect(hot.y).toBeLessThanOrEqual(0.74)
    expect(hot.z).toBeGreaterThanOrEqual(0.1)
    expect(hot.z).toBeLessThanOrEqual(0.24)
    expect(material.vertexShader).toContain('aFlowProgress')
    expect(material.vertexShader).toContain('tendrilPulse')
    expect(material.fragmentShader).toContain('inwardFlow')
    expect(material.fragmentShader).toContain('travelingCrest')
    expect(material.fragmentShader).toContain('outerBirthFade')
    expect(material.fragmentShader).toContain('coreHotBand')
    expect(material.fragmentShader).toContain('chargeEnvelope')
    expect(material.fragmentShader).toContain('circumferenceLick')
    expect(material.fragmentShader).toContain('surfaceBreakup')
    expect(material.fragmentShader).toContain('ribbonWidthCoordinate')
    expect(material.fragmentShader).toContain('ribbonEdgeFade')
    expect(material.fragmentShader).toContain('coherentFlameBody')
    expect(material.fragmentShader).toContain('readableStrandBody')
    expect(material.fragmentShader).not.toContain('discard')
    material.dispose()
  })

  it('authors meteor ring as a grounded molten strike, ballistic ejecta, and justified heat front', () => {
    const preset = createPfxPreset('meteor-ring')
    const plan = getPfxRenderPlan(preset)
    const crater = plan.surfaces.find((surface) => surface.phase === 'meteor-ring-molten-crater')
    const ejecta = plan.surfaces.find((surface) => surface.phase === 'meteor-ring-ballistic-ejecta')
    const heatFront = plan.surfaces.find((surface) => surface.phase === 'meteor-ring-heat-front')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.filter((surface) => surface.kind === 'shockwave-ring')).toHaveLength(1)
    expect(crater).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      tuning: {
        meshGeometry: 'meteor-ring-impact-crater',
        meshMotion: 'flash',
        lifecycle: 'meteor-impact-settle',
        blend: 'alpha',
        positionOffset: [0, -0.88, 0],
      },
    })
    expect(crater!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(ejecta).toMatchObject({ kind: 'particles', role: 'impact' })
    expect(ejecta?.tuning).toMatchObject({
      motion: 'meteor-impact',
      sprite: 'debris',
      blend: 'alpha',
      colorOverride: '#ff6a16',
      gravity: -2.2,
      impactVector: [0, 1, 0],
    })
    expect(ejecta!.tuning!.countScale).toBeGreaterThanOrEqual(0.6)
    expect(ejecta!.tuning!.countScale).toBeLessThanOrEqual(0.8)
    expect(ejecta!.tuning!.speedScale).toBeGreaterThanOrEqual(2.6)
    expect(ejecta!.tuning!.spreadAngle).toBeGreaterThanOrEqual(1.15)
    expect(heatFront?.tuning).toMatchObject({
      meshGeometry: 'meteor-ring-heat-front',
      meshMotion: 'shockwave',
      ringPurpose: 'shockwave',
      delay: 0.18,
      window: 0.34,
    })
    expect(heatFront!.opacity).toBeLessThan(crater!.opacity)
    expect(heatFront!.opacity).toBeGreaterThanOrEqual(0.62)
    expect(heatFront!.opacity).toBeLessThanOrEqual(0.72)
    expect(heatFront!.scale).toBeGreaterThanOrEqual(1.75)

    const onsetState = PfxLibrary.getPfxSurfaceAnimationProps(crater!, preset.controls, 0.04, 1, 1)
    const peakState = PfxLibrary.getPfxSurfaceAnimationProps(crater!, preset.controls, 0.2, 1, 1)
    const decayState = PfxLibrary.getPfxSurfaceAnimationProps(crater!, preset.controls, 0.62, 1, 1)
    const lateDecayState = PfxLibrary.getPfxSurfaceAnimationProps(crater!, preset.controls, 0.98, 1, 1)
    const restState = PfxLibrary.getPfxSurfaceAnimationProps(crater!, preset.controls, 1.055, 1, 1)
    expect(onsetState.opacityMultiplier).toBeLessThan(0.2)
    expect(peakState.scaleMultiplier).toBeGreaterThanOrEqual(0.85)
    expect(peakState.opacityMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(decayState.signature).toContain('meteor-impact-settle')
    expect(decayState.scaleMultiplier).toBeGreaterThanOrEqual(0.75)
    expect(decayState.opacityMultiplier).toBeGreaterThanOrEqual(0.35)
    expect(lateDecayState.opacityMultiplier).toBeGreaterThan(0.02)
    expect(lateDecayState.opacityMultiplier).toBeLessThan(decayState.opacityMultiplier)
    expect(restState.opacityMultiplier).toBe(0)

    const simulation = PfxLibrary.createPfxParticleSimulation(preset, ejecta!)
    const particles = Array.from({ length: simulation.count }, (_, index) => ({
      spawnY: simulation.spawn[index * 3 + 1]!,
      directionX: simulation.direction[index * 3]!,
      directionY: simulation.direction[index * 3 + 1]!,
      directionZ: simulation.direction[index * 3 + 2]!,
    }))
    expect(simulation.motionKind).toBe('meteor-impact')
    expect(particles.filter((particle) => particle.spawnY > 0.8 && particle.directionY < -0.5).length)
      .toBeGreaterThanOrEqual(Math.floor(simulation.count * 0.2))
    expect(particles.filter((particle) => particle.directionY > 0.15 && Math.abs(particle.directionX) > 0.25).length)
      .toBeGreaterThanOrEqual(Math.floor(simulation.count * 0.35))
    expect(Math.max(...particles.map((particle) => particle.directionZ)) - Math.min(...particles.map((particle) => particle.directionZ)))
      .toBeGreaterThan(0.8)
    const incomingCount = Math.max(2, Math.floor(simulation.count * 0.28))
    const onsetPositions = new Float32Array(simulation.count * 3)
    const onsetColors = new Float32Array(simulation.count * 3)
    const peakPositions = new Float32Array(simulation.count * 3)
    const peakColors = new Float32Array(simulation.count * 3)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 0.04, onsetPositions, onsetColors)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 0.2, peakPositions, peakColors)
    const energy = (colors: Float32Array, start: number, end: number) => Array.from(colors.slice(start * 3, end * 3))
      .reduce((sum, value) => sum + value, 0)
    expect(energy(onsetColors, 0, incomingCount)).toBeGreaterThan(energy(onsetColors, incomingCount, simulation.count) * 2)
    expect(energy(peakColors, incomingCount, simulation.count)).toBeGreaterThan(energy(peakColors, 0, incomingCount) * 2)
    const incomingOnsetDepths = Array.from({ length: incomingCount }, (_, index) => onsetPositions[index * 3 + 2]!)
    expect(Math.max(...incomingOnsetDepths) - Math.min(...incomingOnsetDepths)).toBeGreaterThanOrEqual(0.35)
    const emission = PfxLibrary.createPfxParticleEmission(preset, ejecta!)
    const lifeStarts = Array.from({ length: emission.count }, (_, index) => emission.life[index * 2]!)
    const lifeDurations = Array.from({ length: emission.count }, (_, index) => emission.life[index * 2 + 1]!)
    expect(Math.max(...lifeStarts.slice(0, incomingCount))).toBeLessThanOrEqual(0.001)
    expect(Math.max(...lifeDurations.slice(0, incomingCount))).toBeLessThanOrEqual(0.6)
    expect(Math.min(...lifeStarts.slice(incomingCount))).toBeGreaterThanOrEqual(0.12)
    expect(Math.max(...lifeStarts.slice(incomingCount))).toBeLessThanOrEqual(0.19)
    expect(Math.min(...lifeDurations.slice(incomingCount))).toBeGreaterThanOrEqual(1.7)
    expect(emission.variance[(incomingCount - 1) * 2]).toBeGreaterThanOrEqual(3)
    expect(Math.max(...Array.from(emission.variance).filter((_, index) => index % 2 === 0).slice(0, incomingCount - 1)))
      .toBeLessThanOrEqual(0.9)
    const ejectaSizes = Array.from(emission.variance).filter((_, index) => index % 2 === 0).slice(incomingCount)
    const ejectaBrightness = Array.from(emission.variance).filter((_, index) => index % 2 === 1).slice(incomingCount)
    expect(Math.min(...ejectaSizes)).toBeLessThanOrEqual(0.4)
    expect(Math.max(...ejectaSizes)).toBeGreaterThanOrEqual(1.7)
    expect(Math.max(...ejectaBrightness) - Math.min(...ejectaBrightness)).toBeGreaterThanOrEqual(0.6)

    const createGeometry = (PfxLibrary as unknown as {
      createPfxMeteorImpactGeometry: () => THREE.BufferGeometry
    }).createPfxMeteorImpactGeometry
    expect(createGeometry).toBeTypeOf('function')
    const geometry = createGeometry()
    expect(geometry.userData['pfxMeteorImpactGeometry']).toBe('single-draw-grounded-molten-crater')
    expect(geometry.userData['pfxMeteorImpactDrawCalls']).toBe(1)
    expect(geometry.userData['pfxMeteorImpactCraterFloor']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactEmbeddedCore']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactRimRockCount']).toBeGreaterThanOrEqual(8)
    expect(geometry.userData['pfxMeteorImpactRimRocksEmbedded']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactIrregularRim']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactBoundaryRing']).toBe('continuous-asymmetric-outer-annulus')
    expect(geometry.userData['pfxMeteorImpactBoundaryContinuous']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactBoundaryProfile']).toBe('tapered-crater-ridge')
    expect(geometry.userData['pfxMeteorImpactBoundaryMaximumWidth']).toBeLessThanOrEqual(0.12)
    expect(geometry.userData['pfxMeteorImpactBoundaryOuterWall']).toBe(false)
    expect(geometry.userData['pfxMeteorImpactBowlDepth']).toBeLessThanOrEqual(0.12)
    expect(geometry.userData['pfxMeteorImpactBoundaryHeatNotchCount']).toBeGreaterThanOrEqual(3)
    expect(geometry.userData['pfxMeteorImpactBoundaryInnerHeat']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactBoundaryOuterEdgeCool']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactBoundaryOuterRadius']).toBeGreaterThanOrEqual(1)
    expect(geometry.userData['pfxMeteorImpactBoundaryHeight']).toBeGreaterThanOrEqual(0.08)
    expect(geometry.userData['pfxMeteorImpactBoundaryWalls']).toBe(true)
    expect(geometry.userData['pfxMeteorImpactCoreOffset']).toBeGreaterThanOrEqual(0.14)
    expect(geometry.userData['pfxMeteorImpactCoreRadius']).toBeLessThanOrEqual(0.28)
    expect(geometry.userData['pfxMeteorImpactRimRockArchetypeCount']).toBeGreaterThanOrEqual(3)
    expect(geometry.userData['pfxMeteorImpactUsesGemPrimitives']).toBe(false)
    expect(geometry.userData['pfxMeteorImpactLipSegmentCount']).toBeGreaterThanOrEqual(20)
    expect(geometry.userData['pfxMeteorImpactRadialHeatCrackCount']).toBeGreaterThanOrEqual(8)
    expect(geometry.userData['pfxMeteorImpactDepthSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxMeteorImpactHeightSpan']).toBeGreaterThanOrEqual(0.28)
    expect(geometry.userData['pfxMeteorImpactCenterHeight']).toBeGreaterThanOrEqual(0.08)
    expect(geometry.userData['pfxMeteorImpactCenterHeight']).toBeLessThanOrEqual(0.14)
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('normal').getY(0)).toBeGreaterThan(0)
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(500)
    geometry.dispose()

    const createMaterial = (PfxLibrary as unknown as {
      createPfxMeteorImpactMaterial: (opacity: number) => THREE.MeshStandardMaterial
    }).createPfxMeteorImpactMaterial
    expect(createMaterial).toBeTypeOf('function')
    const material = createMaterial(0.94)
    expect(material.userData['pfxMaterial']).toBe('meteor-ring-molten-impact')
    expect(material.vertexColors).toBe(true)
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(material.metalness).toBeLessThanOrEqual(0.1)
    expect(material.roughness).toBeGreaterThanOrEqual(0.5)
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(0.6)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.transparent).toBe(false)
    expect(material.opacity).toBe(1)
    expect(material.toneMapped).toBe(false)

    const applyAppearance = (PfxLibrary as unknown as {
      applyPfxMeteorImpactAppearance: (
        target: THREE.MeshStandardMaterial,
        heat: number,
      ) => { visible: boolean; emissiveIntensity: number; colorMultiplier: number }
    }).applyPfxMeteorImpactAppearance
    expect(applyAppearance).toBeTypeOf('function')
    const peakAppearance = applyAppearance(material, 1)
    const decayAppearance = applyAppearance(material, 0.4)
    const restAppearance = applyAppearance(material, 0)
    expect(peakAppearance.visible).toBe(true)
    expect(decayAppearance.visible).toBe(true)
    expect(decayAppearance.emissiveIntensity).toBeLessThan(peakAppearance.emissiveIntensity)
    expect(decayAppearance.colorMultiplier).toBeLessThan(peakAppearance.colorMultiplier)
    expect(material.transparent).toBe(false)
    expect(material.opacity).toBe(1)
    expect(restAppearance.visible).toBe(false)
    material.dispose()

    const createChunkGeometry = (PfxLibrary as unknown as {
      createPfxMeteorChunkGeometry: () => THREE.BufferGeometry
    }).createPfxMeteorChunkGeometry
    const createChunkMaterial = (PfxLibrary as unknown as {
      createPfxMeteorChunkMaterial: () => THREE.MeshStandardMaterial
    }).createPfxMeteorChunkMaterial
    const createChunkLayout = (PfxLibrary as unknown as {
      createPfxMeteorChunkLayout: (
        source: typeof emission,
        controls: typeof preset.controls,
        elapsedSeconds: number,
      ) => Array<{
        visible: boolean
        incoming: boolean
        position: [number, number, number]
        scale: [number, number, number]
        rotation: [number, number, number]
      }>
    }).createPfxMeteorChunkLayout
    expect(createChunkGeometry).toBeTypeOf('function')
    expect(createChunkMaterial).toBeTypeOf('function')
    expect(createChunkLayout).toBeTypeOf('function')
    const chunkGeometry = createChunkGeometry()
    expect(chunkGeometry.userData['pfxMeteorChunkGeometry']).toBe('irregular-closed-rock')
    expect(chunkGeometry.userData['pfxMeteorChunkDrawCalls']).toBe(1)
    expect(chunkGeometry.userData['pfxMeteorChunkSurface']).toBe('stratified-heat-fractured-rock')
    expect(chunkGeometry.getAttribute('normal').count).toBe(chunkGeometry.getAttribute('position').count)
    expect(chunkGeometry.getAttribute('position').count).toBeGreaterThanOrEqual(150)
    expect(chunkGeometry.getAttribute('uv')).toBeUndefined()
    const chunkColors = Array.from(chunkGeometry.getAttribute('color').array as ArrayLike<number>)
    expect(Math.max(...chunkColors) - Math.min(...chunkColors)).toBeGreaterThanOrEqual(0.45)
    const chunkMaterial = createChunkMaterial()
    expect(chunkMaterial).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(chunkMaterial.transparent).toBe(false)
    expect(chunkMaterial.roughness).toBeGreaterThanOrEqual(0.65)
    expect(chunkMaterial.emissiveIntensity).toBeLessThanOrEqual(0.2)
    const onsetChunks = createChunkLayout(emission, preset.controls, 0.04)
    const peakChunks = createChunkLayout(emission, preset.controls, 0.2)
    expect(onsetChunks).toHaveLength(emission.count)
    expect(onsetChunks.filter((chunk) => chunk.visible && !chunk.incoming)).toHaveLength(0)
    const leadMeteor = onsetChunks[incomingCount - 1]!
    expect(leadMeteor.visible).toBe(true)
    expect(leadMeteor.scale[2] / leadMeteor.scale[0]).toBeGreaterThanOrEqual(1.4)
    expect(Math.max(...leadMeteor.scale)).toBeLessThanOrEqual(0.24)
    expect(Math.hypot(...leadMeteor.position)).toBeLessThan(Math.hypot(...onsetChunks[0]!.position))
    const leadAxis = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...leadMeteor.rotation)).normalize()
    const trajectoryAxis = new THREE.Vector3(0.92, -1.1, 0.72).normalize()
    expect(Math.abs(leadAxis.dot(trajectoryAxis))).toBeGreaterThanOrEqual(0.9)
    const visibleTrail = onsetChunks.slice(0, incomingCount).filter((chunk) => chunk.visible)
    expect(visibleTrail).toHaveLength(incomingCount)
    expect(visibleTrail.every((chunk) => {
      const axis = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...chunk.rotation)).normalize()
      return Math.abs(axis.dot(trajectoryAxis)) >= 0.9 && chunk.scale[2] / chunk.scale[0] >= 1.6
    })).toBe(true)
    expect(Math.min(...visibleTrail.slice(0, -1).map((chunk) => chunk.scale[2]))).toBeGreaterThanOrEqual(0.055)
    const peakEjecta = peakChunks.filter((chunk) => chunk.visible && !chunk.incoming)
    expect(peakEjecta.length).toBeGreaterThanOrEqual(Math.floor((emission.count - incomingCount) * 0.5))
    expect(new Set(peakEjecta.map((chunk) => chunk.rotation.map((value) => value.toFixed(2)).join(':'))).size)
      .toBeGreaterThanOrEqual(Math.floor(peakEjecta.length * 0.8))
    expect(Math.max(...peakEjecta.map((chunk) => chunk.scale[1])) - Math.min(...peakEjecta.map((chunk) => chunk.scale[1])))
      .toBeGreaterThanOrEqual(0.08)
    const peakEjectaRadii = peakEjecta.map((chunk) => Math.hypot(chunk.position[0], chunk.position[2])).sort((a, b) => a - b)
    expect(peakEjectaRadii[Math.floor(peakEjectaRadii.length / 2)]).toBeGreaterThanOrEqual(0.15)
    expect(Math.max(...peakEjectaRadii)).toBeGreaterThanOrEqual(0.3)
    expect(Math.min(...peakEjecta.map((chunk) => chunk.position[1]))).toBeGreaterThanOrEqual(0.02)
    const earlyEjecta = createChunkLayout(emission, preset.controls, 0.14).filter((chunk) => chunk.visible && !chunk.incoming)
    const laterEjecta = createChunkLayout(emission, preset.controls, 0.24).filter((chunk) => chunk.visible && !chunk.incoming)
    const medianRadius = (chunks: typeof peakEjecta) => chunks
      .map((chunk) => Math.hypot(chunk.position[0], chunk.position[2]))
      .sort((a, b) => a - b)[Math.floor(chunks.length / 2)] ?? 0
    expect(medianRadius(laterEjecta) - medianRadius(earlyEjecta)).toBeGreaterThanOrEqual(0.08)
    const postImpactEjecta = createChunkLayout(emission, preset.controls, 0.62 * plan.tempo)
      .filter((chunk) => chunk.visible && !chunk.incoming)
    expect(postImpactEjecta).toHaveLength(0)
    chunkGeometry.dispose()
    chunkMaterial.dispose()

    const heatFrontGeometry = (PfxLibrary as unknown as {
      createPfxMeteorHeatFrontGeometry: () => THREE.BufferGeometry
    }).createPfxMeteorHeatFrontGeometry()
    expect(heatFrontGeometry.userData['pfxMeteorHeatFrontGeometry']).toBe('open-annular-pressure-front')
    expect(heatFrontGeometry.userData['pfxMeteorHeatFrontCenterFilled']).toBe(false)
    expect(heatFrontGeometry.userData['pfxMeteorHeatFrontInnerRadius']).toBeGreaterThanOrEqual(0.5)
    heatFrontGeometry.dispose()

    const light = (PfxLibrary as unknown as {
      getPfxMeteorImpactLightProfile: () => { color: string; intensity: number; distance: number; decay: number }
    }).getPfxMeteorImpactLightProfile()
    expect(light).toEqual({ color: '#ff5a16', intensity: 1.8, distance: 2.4, decay: 2 })
  })

  it('authors shockwave spawn as a broken pressure collar with animated shards, an expanding front, and delayed upward motes', () => {
    const preset = createPfxPreset('shockwave-spawn')
    const plan = getPfxRenderPlan(preset)
    const crown = plan.surfaces.find((surface) => surface.phase === 'shockwave-spawn-ground-arrival-flare')
    const front = plan.surfaces.find((surface) => surface.phase === 'shockwave-spawn-ground-front')
    const dust = plan.surfaces.find((surface) => surface.phase === 'shockwave-spawn-ground-fragments')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.filter((surface) => surface.kind === 'particles')).toHaveLength(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(crown).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      tuning: {
        meshGeometry: 'shockwave-spawn-arrival-flare',
        lifecycle: 'shockwave-spawn-pressure-release',
        blend: 'additive',
      },
    })
    expect(crown!.opacity).toBeGreaterThanOrEqual(0.86)
    expect(crown!.opacity).toBeLessThanOrEqual(0.94)
    expect(crown!.scale).toBeGreaterThanOrEqual(2)
    expect(crown!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(-0.1)
    expect(PfxLibrary.getPfxSurfacePositionOffset(crown!)).toEqual([0, -0.88, 0])
    expect(PfxLibrary.isPfxSurfaceCameraFacing(crown!, plan.feelVersion)).toBe(false)
    expect(front).toMatchObject({ kind: 'shockwave-ring', role: 'impact' })
    expect(front?.tuning).toMatchObject({
      meshGeometry: 'shockwave-spawn-pressure-front',
      meshMotion: 'shockwave',
      ringPurpose: 'shockwave',
      colorOverride: '#ffd56a',
      delay: 0,
      window: 0.42,
    })
    expect(front!.opacity).toBe(1)
    expect(front!.scale).toBeGreaterThanOrEqual(2.7)
    const frontOnset = PfxLibrary.getPfxSurfaceAnimationProps(front!, preset.controls, 0.12, 1, 1)
    const frontZero = PfxLibrary.getPfxSurfaceAnimationProps(front!, preset.controls, 0, 1, 1)
    const frontPeak = PfxLibrary.getPfxSurfaceAnimationProps(front!, preset.controls, 0.2, 1, 1)
    const frontDecay = PfxLibrary.getPfxSurfaceAnimationProps(front!, preset.controls, 0.32, 1, 1)
    expect(frontPeak.scaleMultiplier).toBeGreaterThan(frontOnset.scaleMultiplier * 1.5)
    expect(frontZero.scaleMultiplier).toBeGreaterThanOrEqual(0.18)
    expect(frontZero.opacityMultiplier).toBe(1)
    expect(frontDecay.scaleMultiplier).toBeGreaterThan(frontPeak.scaleMultiplier * 1.55)
    expect(frontDecay.opacityMultiplier).toBeGreaterThanOrEqual(0.6)
    expect(dust).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(dust?.tuning).toMatchObject({
      motion: 'shockwave-ground-burst',
      sprite: 'puff',
      blend: 'alpha',
      lifecycle: 'shockwave-spawn-arrival',
      ramp: 'dark',
      delay: 0.13,
      colorOverride: '#9b7568',
    })
    expect(dust!.opacity).toBeGreaterThanOrEqual(0.78)
    expect(dust!.tuning!.impactVector).toBeUndefined()
    expect(dust!.tuning!.countScale).toBeGreaterThanOrEqual(1.5)
    expect(dust!.tuning!.speedScale).toBeGreaterThanOrEqual(2.2)
    expect(dust!.tuning!.depthScale).toBeGreaterThanOrEqual(2.5)
    expect(dust!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.2)
    expect(dust!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.08)
    expect(dust!.tuning!.stretch).toBeLessThanOrEqual(0.2)
    expect(dust!.tuning!.gravity).toBeLessThanOrEqual(-0.4)
    expect(dust!.tuning!.spawnLift).toBeGreaterThanOrEqual(0.06)
    expect(dust!.tuning!.size?.[2]).toBeGreaterThanOrEqual(0.45)
    expect(dust!.tuning!.size?.[0]).toBeGreaterThanOrEqual(0.25)
    expect(dust!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.6)
    expect(dust!.tuning!.lifeScale).toBeLessThanOrEqual(0.9)
    const dustDecay = PfxLibrary.getPfxSurfaceAnimationProps(dust!, preset.controls, 0.32, 1, 1)
    expect(dustDecay.opacityMultiplier).toBeLessThanOrEqual(0.35)

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, 0.04, 1, 1)
    const zeroOnset = PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, 0, 1, 1)
    const arrival = PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, 0.18, 1, 1)
    const release = PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, 0.32, 1, 1)
    const rest = PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, 0.52, 1, 1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.35)
    expect(zeroOnset.opacityMultiplier).toBeGreaterThanOrEqual(0.2)
    expect(zeroOnset.scaleMultiplier).toBeGreaterThanOrEqual(0.28)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.45)
    expect(arrival.opacityMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(arrival.scaleMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(release.opacityMultiplier).toBeGreaterThan(0.12)
    expect(release.opacityMultiplier).toBeLessThan(arrival.opacityMultiplier)
    expect(release.scaleMultiplier).toBeGreaterThan(arrival.scaleMultiplier)
    expect(rest.opacityMultiplier).toBe(0)

    const geometry = (PfxLibrary as unknown as {
      createPfxShockwaveSpawnArrivalFlareGeometry: () => THREE.BufferGeometry
    }).createPfxShockwaveSpawnArrivalFlareGeometry()
    expect(geometry.userData['pfxShockwaveSpawnGeometry']).toBe('broken-pressure-collar-and-shards')
    expect(geometry.userData['pfxShockwaveSpawnDrawCalls']).toBe(1)
    expect(geometry.userData['pfxShockwaveSpawnClosedVolume']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnComponentCount']).toBeGreaterThanOrEqual(25)
    expect(geometry.userData['pfxShockwaveSpawnVerticalDominance']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnGroundProfile']).toBe(false)
    expect(geometry.userData['pfxShockwaveSpawnAsymmetricLayout']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnFaceted']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnFragmented']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnAnimatedSeparation']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnVolumetricShards']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnMinShardMinorScale']).toBeGreaterThanOrEqual(0.75)
    expect(geometry.userData['pfxShockwaveSpawnOutwardDecay']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnPressureCollar']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnPressureCollarArcCount']).toBeGreaterThanOrEqual(10)
    expect(geometry.userData['pfxShockwaveSpawnPressureCollarOuterRadius']).toBeGreaterThanOrEqual(0.45)
    expect(geometry.userData['pfxShockwaveSpawnImpactSeed']).toBe(true)
    expect(geometry.userData['pfxShockwaveSpawnCoreRadius']).toBeGreaterThan(0)
    expect(geometry.userData['pfxShockwaveSpawnCoreRadius']).toBeLessThanOrEqual(0.18)
    expect(geometry.userData['pfxShockwaveSpawnPlanarCards']).toBe(false)
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(90)
    expect(geometry.getAttribute('normal').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aEnergy').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aBurstOffset').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aLayer').count).toBe(geometry.getAttribute('position').count)
    geometry.computeBoundingBox()
    const pressureHeight = geometry.boundingBox!.max.y - geometry.boundingBox!.min.y
    const pressureWidth = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x
    const pressureDepth = geometry.boundingBox!.max.z - geometry.boundingBox!.min.z
    expect(pressureHeight).toBeGreaterThanOrEqual(0.45)
    expect(pressureHeight).toBeLessThanOrEqual(0.75)
    expect(geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01)
    expect(pressureWidth).toBeGreaterThanOrEqual(0.5)
    expect(pressureDepth).toBeGreaterThanOrEqual(0.35)
    geometry.dispose()

    const material = (PfxLibrary as unknown as {
      createPfxShockwaveSpawnArrivalFlareMaterial: (opacity: number) => THREE.ShaderMaterial
    }).createPfxShockwaveSpawnArrivalFlareMaterial(0.86)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.transparent).toBe(true)
    expect(material.blending).toBe(THREE.AdditiveBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.side).toBe(THREE.DoubleSide)
    expect(material.uniforms['uOpacity']?.value).toBe(0.86)
    expect(material.uniforms['uTime']?.value).toBe(0)
    expect((material.uniforms['uHotColor']?.value as THREE.Color).getHexString()).toBe('fff3c4')
    expect((material.uniforms['uRimColor']?.value as THREE.Color).getHexString()).toBe('ff3d55')
    expect((material.uniforms['uShardColor']?.value as THREE.Color).getHexString()).toBe('b8ecff')
    expect(material.fragmentShader).toContain('fresnel')
    expect(material.fragmentShader).toContain('facetLight')
    expect(material.fragmentShader).toContain('grain')
    expect(material.vertexShader).toContain('aEnergy')
    expect(material.vertexShader).toContain('burstProgress')
    expect(material.vertexShader).toContain('outwardProgress')
    expect(material.fragmentShader).toContain('vLayer')
    expect(material.userData['pfxShockwaveSpawnArrivalFlare']).toBe(true)
    expect(material.userData['pfxShockwaveSpawnPalette']).toBe('gold-orange-pressure-energy')
    material.dispose()

    const frontGeometry = (PfxLibrary as unknown as {
      createPfxShockwaveSpawnPressureFrontGeometry: () => THREE.BufferGeometry
    }).createPfxShockwaveSpawnPressureFrontGeometry()
    expect(frontGeometry.userData['pfxShockwaveSpawnPressureFront']).toBe('thick-open-annular-wave')
    expect(frontGeometry.userData['pfxShockwaveSpawnPressureFrontCenterFilled']).toBe(false)
    expect(frontGeometry.userData['pfxShockwaveSpawnPressureFrontBandWidth']).toBeGreaterThanOrEqual(0.2)
    expect(frontGeometry.userData['pfxShockwaveSpawnPressureFrontBandWidth']).toBeLessThanOrEqual(0.25)
    expect(frontGeometry.userData['pfxShockwaveSpawnPressureFrontRadialSegments']).toBeGreaterThanOrEqual(3)
    frontGeometry.dispose()

    const frontMaterial = (PfxLibrary as unknown as {
      createPfxShockwaveSpawnPressureFrontMaterial: (opacity: number) => THREE.ShaderMaterial
    }).createPfxShockwaveSpawnPressureFrontMaterial(0.9)
    expect(frontMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(frontMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(frontMaterial.depthWrite).toBe(false)
    expect(frontMaterial.uniforms['uOpacity']?.value).toBe(0.9)
    expect((frontMaterial.uniforms['uAccentColor']?.value as THREE.Color).getHexString()).toBe('ff3d6e')
    expect(frontMaterial.uniforms['uInnerRadius']?.value).toBeLessThan(frontMaterial.uniforms['uOuterRadius']?.value)
    expect(frontMaterial.fragmentShader).toContain('angularModulation')
    expect(frontMaterial.fragmentShader).toContain('accentBand')
    frontMaterial.dispose()

    const dustSimulation = PfxLibrary.createPfxParticleSimulation(preset, dust!)
    expect(dustSimulation.motionKind).toBe('shockwave-ground-burst')
    const directions = Array.from({ length: dustSimulation.count }, (_, index) => ({
      x: dustSimulation.direction[index * 3]!,
      y: dustSimulation.direction[index * 3 + 1]!,
      z: dustSimulation.direction[index * 3 + 2]!,
    }))
    expect(Math.max(...directions.map(({ y }) => y))).toBeGreaterThanOrEqual(0.45)
    expect(Math.max(...directions.map(({ y }) => y))).toBeLessThanOrEqual(0.6)
    expect(directions.some(({ x }) => x > 0.75)).toBe(true)
    expect(directions.some(({ x }) => x < -0.75)).toBe(true)
    expect(directions.some(({ z }) => z > 0.75)).toBe(true)
    expect(directions.some(({ z }) => z < -0.75)).toBe(true)
    const spawnRadii = Array.from(
      { length: dustSimulation.count },
      (_, index) => Math.hypot(dustSimulation.spawn[index * 3]!, dustSimulation.spawn[index * 3 + 2]!),
    )
    expect(spawnRadii.reduce((sum, radius) => sum + radius, 0) / spawnRadii.length).toBeGreaterThanOrEqual(0.18)

    const earlyPositions = new Float32Array(dustSimulation.count * 3)
    const earlyColors = new Float32Array(dustSimulation.count * 3)
    const releasePositions = new Float32Array(dustSimulation.count * 3)
    const releaseColors = new Float32Array(dustSimulation.count * 3)
    PfxLibrary.updatePfxParticleSimulation(dustSimulation, preset.controls, 0.08, earlyPositions, earlyColors)
    PfxLibrary.updatePfxParticleSimulation(dustSimulation, preset.controls, 0.28, releasePositions, releaseColors)
    const averageRadius = (positions: Float32Array) => Array.from(
      { length: dustSimulation.count },
      (_, index) => Math.hypot(positions[index * 3]!, positions[index * 3 + 2]!),
    ).reduce((sum, radius) => sum + radius, 0) / dustSimulation.count
    expect(averageRadius(releasePositions) - averageRadius(earlyPositions)).toBeGreaterThanOrEqual(0.28)
    const peakEjectaHeight = Math.max(...Array.from(
      { length: dustSimulation.count },
      (_, index) => releasePositions[index * 3 + 1]!,
    ))
    expect(peakEjectaHeight).toBeGreaterThanOrEqual(0.2)
    expect(peakEjectaHeight).toBeLessThanOrEqual(1.2)

    const dustEmission = PfxLibrary.createPfxParticleEmission(preset, dust!)
    const dustMaterial = PfxLibrary.createPfxSpriteEmissionMaterial(
      dustEmission,
      preset.controls,
      dust!,
      PfxLibrary.getPfxSurfaceMaterialProps(dust!, preset.controls),
    )
    expect(dustMaterial.defines).toMatchObject({ MOTION_SHOCKWAVE_GROUND: true })
    dustMaterial.dispose()
  })

  it('authors dust loop as a grounded asymmetric wind bed without a glowing center orb', () => {
    const preset = createPfxPreset('dust-loop')
    const plan = getPfxRenderPlan(preset)
    const body = plan.surfaces.find((surface) => surface.phase === 'dust-loop-sculpted-smoke-bed')
    const wisps = plan.surfaces.find((surface) => surface.phase === 'dust-loop-soft-shear-wisps')
    const grit = plan.surfaces.find((surface) => surface.phase === 'dust-loop-fine-suspended-grit')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.filter((surface) => surface.kind === 'particles')).toHaveLength(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(body).toMatchObject({
      kind: 'particles',
      role: 'volume',
      tuning: {
        motion: 'dust-loop',
        sprite: 'smoke-variants',
        lifecycle: 'dust-loop-breathing',
        blend: 'alpha',
        ramp: 'pigment',
      },
    })
    // Review 702: the grounded form was correct, but its body collapsed into
    // the floor value. Keep enough alpha for a readable shaded core without
    // turning the envelope back into a broad fog card.
    expect(body!.opacity).toBeGreaterThanOrEqual(0.72)
    expect(body!.opacity).toBeLessThanOrEqual(0.78)
    expect(body!.scale).toBeGreaterThanOrEqual(1.45)
    expect(body!.scale).toBeLessThanOrEqual(1.55)
    expect(body!.tuning!.countScale).toBeGreaterThanOrEqual(1.55)
    expect(body!.tuning!.countScale).toBeLessThanOrEqual(1.65)
    expect(body!.tuning!.alphaGamma).toBeGreaterThanOrEqual(0.86)
    expect(body!.tuning!.alphaGamma).toBeLessThanOrEqual(0.96)
    expect(body!.tuning!.spriteColorMix).toBeGreaterThanOrEqual(0.5)
    expect(body!.tuning!.spriteColorMix).toBeLessThanOrEqual(0.7)
    expect(body!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.1)
    expect(body!.tuning!.spawnScale).toBeLessThanOrEqual(1.3)
    expect(body!.tuning!.depthScale).toBeGreaterThanOrEqual(2.7)
    expect(body!.tuning!.depthScale).toBeLessThanOrEqual(3)
    expect(body!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.35)
    expect(body!.tuning!.size?.[1]).toBeLessThanOrEqual(0.5)
    expect(wisps).toMatchObject({
      kind: 'particles',
      role: 'aura',
      tuning: { motion: 'dust-loop', sprite: 'smoke-variants', blend: 'alpha', ramp: 'pigment' },
    })
    expect(wisps!.tuning!.countScale).toBeGreaterThanOrEqual(0.95)
    expect(wisps!.tuning!.countScale).toBeLessThanOrEqual(1.05)
    expect(wisps!.opacity).toBeGreaterThanOrEqual(0.44)
    expect(wisps!.opacity).toBeLessThanOrEqual(0.52)
    expect(wisps!.scale).toBeGreaterThanOrEqual(1.15)
    expect(wisps!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.35)
    expect(wisps!.tuning!.size?.[1]).toBeLessThanOrEqual(0.5)
    expect(wisps!.tuning!.alphaGamma).toBeGreaterThanOrEqual(0.58)
    expect(wisps!.tuning!.alphaGamma).toBeLessThanOrEqual(0.7)
    expect(wisps!.tuning!.spriteColorMix).toBeLessThanOrEqual(0.15)
    expect(grit).toMatchObject({
      kind: 'particles',
      role: 'trail',
      tuning: { motion: 'dust-loop', sprite: 'smoke-variants', blend: 'alpha', ramp: 'pigment' },
    })
    expect(grit!.tuning!.countScale).toBeGreaterThanOrEqual(0.12)
    expect(grit!.tuning!.countScale).toBeLessThanOrEqual(0.16)
    expect(grit!.opacity).toBeGreaterThanOrEqual(0.46)
    expect(grit!.opacity).toBeLessThanOrEqual(0.6)
    expect(grit!.scale).toBeGreaterThanOrEqual(0.7)
    expect(grit!.tuning!.size?.[1]).toBeGreaterThanOrEqual(0.35)
    expect(grit!.tuning!.size?.[1]).toBeLessThanOrEqual(0.45)
    expect(grit!.tuning!.stretch).toBeGreaterThanOrEqual(1.4)
    expect(grit!.tuning!.stretch).toBeLessThanOrEqual(2)
    expect(new Set(plan.surfaces.map((surface) => surface.tuning?.colorOverride)).size).toBe(3)
    const coreColor = new THREE.Color(body!.tuning!.colorOverride!)
    const envelopeColor = new THREE.Color(wisps!.tuning!.colorOverride!)
    const coreLightness = coreColor.getHSL({ h: 0, s: 0, l: 0 }).l
    const envelopeLightness = envelopeColor.getHSL({ h: 0, s: 0, l: 0 }).l
    expect(coreLightness).toBeGreaterThanOrEqual(0.34)
    expect(coreLightness).toBeLessThanOrEqual(0.44)
    expect(envelopeLightness).toBeGreaterThan(coreLightness * 1.3)
    expect(envelopeLightness).toBeLessThanOrEqual(0.62)
    expect(body!.tuning!.positionOffset?.[0]).toBeGreaterThanOrEqual(0.18)
    expect(body!.tuning!.positionOffset?.[0]).toBeLessThanOrEqual(0.32)
    expect(body!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.65)
    const layerDepthOffsets = [body, wisps, grit].map((surface) => surface!.tuning!.positionOffset?.[2] ?? 0)
    // Independent review 704 left only volume/depth below A. The layers need
    // distinct world-space depth centroids so camera rotation yields actual
    // parallax instead of three alpha gradients occupying the same plane.
    const layerDepthSpan = Math.max(...layerDepthOffsets) - Math.min(...layerDepthOffsets)
    expect(layerDepthSpan).toBeGreaterThanOrEqual(0.2)
    expect(layerDepthSpan).toBeLessThanOrEqual(0.24)
    expect(Math.abs(layerDepthOffsets[0]! - layerDepthOffsets[1]!)).toBeGreaterThanOrEqual(0.14)
    expect(Math.abs(layerDepthOffsets[0]! - layerDepthOffsets[1]!)).toBeLessThanOrEqual(0.18)

    const bodySimulation = PfxLibrary.createPfxParticleSimulation(preset, body!)
    const bodyXs = Array.from({ length: bodySimulation.count }, (_, index) => bodySimulation.spawn[index * 3]!)
    const bodyYs = Array.from({ length: bodySimulation.count }, (_, index) => bodySimulation.spawn[index * 3 + 1]!)
    const bodyZs = Array.from({ length: bodySimulation.count }, (_, index) => bodySimulation.spawn[index * 3 + 2]!)
    const bodyXSpan = Math.max(...bodyXs) - Math.min(...bodyXs)
    const bodyZSpan = Math.max(...bodyZs) - Math.min(...bodyZs)
    expect(bodyXSpan).toBeGreaterThanOrEqual(2.6)
    expect(bodyXSpan).toBeLessThanOrEqual(3.2)
    expect(bodyZSpan).toBeGreaterThanOrEqual(0.45)
    expect(bodyZSpan).toBeLessThanOrEqual(0.75)
    expect(bodyXSpan / bodyZSpan).toBeGreaterThanOrEqual(3.8)
    expect(Math.min(...bodyYs)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...bodyYs)).toBeLessThanOrEqual(0.38)
    const oldLaneMeans = Array.from({ length: 5 }, (_, lane) => {
      const laneZs = bodyZs.filter((_, index) => index % 5 === lane)
      return laneZs.reduce((sum, z) => sum + z, 0) / laneZs.length
    })
    expect(Math.max(...oldLaneMeans) - Math.min(...oldLaneMeans)).toBeLessThanOrEqual(bodyZSpan * 0.35)
    const zQuartileMeans = Array.from({ length: 4 }, (_, quartile) => {
      const start = Math.floor(bodyXs.length * quartile / 4)
      const end = Math.floor(bodyXs.length * (quartile + 1) / 4)
      const indices = bodyXs
        .map((x, index) => ({ x, index }))
        .sort((a, b) => a.x - b.x)
        .slice(start, end)
      return indices.reduce((sum, item) => sum + bodyZs[item.index]!, 0) / indices.length
    })
    expect(Math.max(...zQuartileMeans) - Math.min(...zQuartileMeans)).toBeGreaterThanOrEqual(0.08)
    const xOrder = bodyXs.map((x, index) => ({ x, y: bodyYs[index]! })).sort((a, b) => a.x - b.x)
    const quartileSize = Math.max(1, Math.floor(xOrder.length / 4))
    const meanY = (points: Array<{ y: number }>) => points.reduce((sum, point) => sum + point.y, 0) / points.length
    const trailingMeanY = meanY(xOrder.slice(0, quartileSize))
    const leadingMeanY = meanY(xOrder.slice(-quartileSize))
    expect(leadingMeanY).toBeGreaterThan(trailingMeanY * 1.25)

    const bodyEmission = PfxLibrary.createPfxParticleEmission(preset, body!)
    const wispEmission = PfxLibrary.createPfxParticleEmission(preset, wisps!)
    const gritEmission = PfxLibrary.createPfxParticleEmission(preset, grit!)
    expect(bodyEmission.count + wispEmission.count + gritEmission.count).toBeLessThanOrEqual(100)
    const maximumSortedGap = (values: number[]) => values
      .sort((left, right) => left - right)
      .slice(1)
      .reduce((largest, value, index, sortedTail) => Math.max(largest, value - (index === 0 ? values[0]! : sortedTail[index - 1]!)), 0)
    const wispXs = Array.from({ length: wispEmission.count }, (_, index) => wispEmission.spawn[index * 3]!)
    // The brighter shear layer may not strand one large atlas cell beyond
    // the cap; that deterministic emitter gap was the satellite puff in 707.
    expect(maximumSortedGap(wispXs)).toBeLessThanOrEqual(0.2)
    const emissionXOrder = Array.from({ length: bodyEmission.count }, (_, index) => ({
      x: bodyEmission.spawn[index * 3]!,
      size: bodyEmission.variance[index * 2]!,
    })).sort((a, b) => a.x - b.x)
    const emissionQuartileSize = Math.max(1, Math.floor(emissionXOrder.length / 4))
    const meanSize = (points: Array<{ size: number }>) => points.reduce((sum, point) => sum + point.size, 0) / points.length
    const trailingMeanSize = meanSize(emissionXOrder.slice(0, emissionQuartileSize))
    const leadingMeanSize = meanSize(emissionXOrder.slice(-emissionQuartileSize))
    // The tail must remain continuous rather than dissolving into isolated
    // pin-dots, while the head still carries the dominant visual weight.
    expect(trailingMeanSize).toBeGreaterThanOrEqual(0.25)
    const headTailSizeRatio = leadingMeanSize / trailingMeanSize
    expect(headTailSizeRatio).toBeGreaterThanOrEqual(1.8)
    expect(headTailSizeRatio).toBeLessThanOrEqual(2.2)
    const bodyMaterial = PfxLibrary.createPfxSpriteEmissionMaterial(
      bodyEmission,
      preset.controls,
      body!,
      PfxLibrary.getPfxSurfaceMaterialProps(body!, preset.controls),
    )
    expect(bodyMaterial.defines).toMatchObject({ MOTION_DUST_LOOP: true })
    expect(bodyMaterial.fragmentShader).toContain('vec3(0.72, 0.68, 0.62)')
    expect(bodyMaterial.fragmentShader).toContain('dustCoreOcclusion')
    expect(bodyMaterial.fragmentShader).toContain('dustTopEdge')
    expect(bodyMaterial.fragmentShader).toContain('dustCrestLight')
    expect(bodyMaterial.fragmentShader).toContain('dustRimLight')
    expect(bodyMaterial.fragmentShader).toContain('dustDirectionalLight')
    expect(bodyMaterial.fragmentShader).toContain('vec3(0.42, 0.36, 0.28)')
    expect(bodyMaterial.uniforms.uAlphaGamma.value).toBeGreaterThanOrEqual(0.86)
    expect(bodyMaterial.uniforms.uAlphaGamma.value).toBeLessThanOrEqual(0.96)
    expect(bodyMaterial.uniforms.uSpriteColorMix.value).toBeGreaterThanOrEqual(0.5)
    expect(bodyMaterial.uniforms.uSpriteColorMix.value).toBeLessThanOrEqual(0.7)
    bodyMaterial.dispose()

    const wispMaterial = PfxLibrary.createPfxSpriteEmissionMaterial(
      wispEmission,
      preset.controls,
      wisps!,
      PfxLibrary.getPfxSurfaceMaterialProps(wisps!, preset.controls),
    )
    expect(wispMaterial.uniforms.uAlphaGamma.value).toBeGreaterThanOrEqual(0.58)
    expect(wispMaterial.uniforms.uAlphaGamma.value).toBeLessThanOrEqual(0.7)
    expect(wispMaterial.uniforms.uSpriteColorMix.value).toBeLessThanOrEqual(0.15)
    wispMaterial.dispose()

    const gritMaterial = PfxLibrary.createPfxSpriteEmissionMaterial(
      gritEmission,
      preset.controls,
      grit!,
      PfxLibrary.getPfxSurfaceMaterialProps(grit!, preset.controls),
    )
    expect(gritMaterial.fragmentShader).toContain('vec3(0.72, 0.68, 0.62)')
    expect(gritMaterial.fragmentShader).not.toContain('vec3(0.78, 0.84, 0.88)')
    gritMaterial.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(body!, preset.controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(body!, preset.controls, 0.32, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(body!, preset.controls, 0.62, 1, 1)
    const wispPeak = PfxLibrary.getPfxSurfaceAnimationProps(wisps!, preset.controls, 0.32, 1, 1)
    const gritPeak = PfxLibrary.getPfxSurfaceAnimationProps(grit!, preset.controls, 0.32, 1, 1)
    expect(peak.opacityMultiplier).toBeGreaterThan(onset.opacityMultiplier * 2.5)
    expect(peak.opacityMultiplier).toBeGreaterThan(decay.opacityMultiplier * 1.25)
    expect(decay.opacityMultiplier).toBeLessThanOrEqual(onset.opacityMultiplier)
    expect(peak.scaleMultiplier).toBeGreaterThan(onset.scaleMultiplier * 1.3)
    expect(decay.opacityMultiplier).toBeGreaterThanOrEqual(0.36)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.36)
    // The crest must reshape the wake, not merely brighten the same blob:
    // the envelope shears upward/back while suspended grit advances.
    expect(wispPeak.yOffset).toBeGreaterThan(peak.yOffset + 0.02)
    expect(wispPeak.xOffset).toBeLessThan(peak.xOffset - 0.025)
    expect(wispPeak.scaleMultiplier).toBeGreaterThan(peak.scaleMultiplier * 1.05)
    expect(gritPeak.xOffset).toBeGreaterThan(peak.xOffset + 0.04)
  })

  it('authors debris release as faceted ballistic rocks, fast chips, and grounded dust instead of a glow blob', () => {
    const preset = createPfxPreset('debris-release')
    const plan = getPfxRenderPlan(preset)
    const hero = plan.surfaces.find((surface) => surface.phase === 'debris-release-hero-rocks')
    const chips = plan.surfaces.find((surface) => surface.phase === 'debris-release-forward-chip-fan')
    const dust = plan.surfaces.find((surface) => surface.phase === 'debris-release-ground-dust-sheet')
    const counter = plan.surfaces.find((surface) => surface.phase === 'debris-release-counter-chips')
    const streaks = plan.surfaces.find((surface) => surface.phase === 'debris-release-launch-streaks')

    expect(plan.surfaces).toHaveLength(5)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(5)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'glow')).toBe(false)
    expect(hero).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'impact-burst',
        sprite: 'debris',
        lifecycle: 'debris-release-ballistic',
        blend: 'alpha',
        randomizeAzimuth: true,
      },
    })
    expect(hero!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(hero!.scale).toBeGreaterThanOrEqual(1.1)
    expect(hero!.scale).toBeLessThanOrEqual(1.38)
    expect(hero!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.62)

    expect(chips).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'radial-burst',
        sprite: 'debris',
        blend: 'alpha',
        ramp: 'pigment',
        death: 'erode',
        lifecycle: 'debris-release-ballistic',
      },
    })
    expect(chips!.tuning!.speedScale).toBeGreaterThanOrEqual(7)
    expect(chips!.tuning!.countScale).toBeGreaterThanOrEqual(0.45)
    expect(chips!.tuning!.lifeScale).toBeGreaterThanOrEqual(0.8)
    expect(chips!.tuning!.spreadAngle).toBeGreaterThanOrEqual(0.55)
    expect(chips!.tuning!.depthScale).toBeGreaterThanOrEqual(2.5)
    expect(chips!.tuning!.impactVector?.[0]).toBeLessThanOrEqual(-0.8)

    expect(dust).toMatchObject({
      kind: 'particles',
      role: 'volume',
      tuning: {
        motion: 'shockwave-ground-burst',
        sprite: 'smoke',
        blend: 'alpha',
        ramp: 'pigment',
        death: 'erode',
        lifecycle: 'debris-release-ballistic',
      },
    })
    expect(dust!.opacity).toBeGreaterThanOrEqual(0.62)
    expect(dust!.opacity).toBeLessThanOrEqual(0.76)
    expect(dust!.scale).toBeGreaterThanOrEqual(1.65)
    expect(dust!.scale).toBeLessThanOrEqual(1.9)
    expect(dust!.tuning!.countScale).toBeGreaterThanOrEqual(0.4)
    expect(dust!.tuning!.speedScale).toBeGreaterThanOrEqual(4)
    expect(dust!.tuning!.spreadAngle).toBeGreaterThanOrEqual(0.75)
    expect(dust!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(dust!.tuning!.positionOffset?.[1]).toBeGreaterThanOrEqual(-0.38)
    expect(dust!.tuning!.positionOffset?.[1]).toBeLessThanOrEqual(-0.26)

    expect(counter).toMatchObject({
      kind: 'particles',
      role: 'trail',
      tuning: { motion: 'radial-burst', sprite: 'debris', blend: 'alpha', ramp: 'dark', lifecycle: 'debris-release-ballistic' },
    })
    expect(counter!.tuning!.impactVector?.[0]).toBeGreaterThanOrEqual(0.8)
    expect(counter!.tuning!.countScale).toBeGreaterThanOrEqual(0.08)
    expect(counter!.tuning!.countScale).toBeLessThanOrEqual(0.14)

    expect(streaks).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'radial-burst',
        sprite: 'streak',
        blend: 'additive',
        ramp: 'pinned-hot',
        lifecycle: 'debris-release-ballistic',
      },
    })
    expect(streaks!.opacity).toBeGreaterThanOrEqual(0.68)
    expect(streaks!.opacity).toBeLessThanOrEqual(0.8)
    expect(streaks!.tuning!.colorOverride).toBe('#e2a15a')
    expect(streaks!.tuning!.stretch).toBeGreaterThanOrEqual(1.8)
    expect(streaks!.tuning!.speedScale).toBeGreaterThanOrEqual(9)
    expect(streaks!.tuning!.countScale).toBeGreaterThanOrEqual(0.45)
    expect(streaks!.tuning!.window).toBeGreaterThanOrEqual(0.2)
    expect(streaks!.tuning!.lifeScale).toBeGreaterThanOrEqual(0.8)
    expect(streaks!.tuning!.impactVector?.[0]).toBeLessThanOrEqual(-0.85)

    const geometry = PfxLibrary.createPfxDebrisReleaseFragmentGeometry()
    expect(geometry.userData).toMatchObject({
      pfxDebrisReleaseDrawCalls: 1,
      pfxDebrisReleaseClosedFaces: true,
      pfxDebrisReleaseFragmentCount: 9,
      pfxDebrisReleaseShapeVocabulary: 4,
    })
    expect(geometry.userData['pfxDebrisReleaseTrajectorySpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxDebrisReleaseDepthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(geometry.userData['pfxDebrisReleaseHeightSpan']).toBeGreaterThanOrEqual(0.7)
    expect(geometry.userData['pfxDebrisReleaseHeroAreaRatio']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxDebrisReleaseDirectionalBias']).toBeGreaterThanOrEqual(0.7)
    expect(geometry.userData['pfxDebrisReleaseValueRange']).toBeGreaterThanOrEqual(0.48)
    expect(geometry.userData['pfxDebrisReleaseWarpAmplitude']).toBeGreaterThanOrEqual(0.18)
    expect(geometry.userData['pfxDebrisReleaseFarthestCenterRadius']).toBeLessThanOrEqual(2.3)
    expect(geometry.userData['pfxDebrisReleaseDirectionalFanRatio']).toBeGreaterThanOrEqual(1.7)
    geometry.dispose()
    const material = PfxLibrary.createPfxDebrisReleaseFragmentMaterial(hero!.opacity)
    expect(material.vertexColors).toBe(true)
    expect(material.flatShading).toBe(true)
    expect(material.roughness).toBeGreaterThanOrEqual(0.62)
    expect(material.roughness).toBeLessThanOrEqual(0.72)
    expect(material.metalness).toBeLessThanOrEqual(0.03)
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(0.16)
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.24)
    material.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(hero!, preset.controls, 0.02, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(hero!, preset.controls, 0.08, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(hero!, preset.controls, 0.3, 1, 1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.1)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.35)
    expect(onset.scaleMultiplier).toBeLessThanOrEqual(0.55)
    expect(peak.scaleMultiplier).toBeGreaterThan(onset.scaleMultiplier * 1.8)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(Math.abs(peak.xOffset)).toBeGreaterThanOrEqual(0.08)
    expect(peak.yOffset).toBeGreaterThan(onset.yOffset + 0.08)
    expect(decay.opacityMultiplier).toBeLessThan(peak.opacityMultiplier * 0.35)
    const recovery = PfxLibrary.getPfxSurfaceAnimationProps(hero!, preset.controls, 0.47, 1, 1)
    expect(recovery.opacityMultiplier).toBe(0)
    expect(decay.yOffset).toBeLessThan(peak.yOffset)
    const streakPeak = PfxLibrary.getPfxSurfaceAnimationProps(streaks!, preset.controls, 0.48, 1, 1)
    const streakDecay = PfxLibrary.getPfxSurfaceAnimationProps(streaks!, preset.controls, 0.62, 1, 1)
    expect(streakPeak.opacityMultiplier).toBeGreaterThanOrEqual(0.65)
    expect(streakDecay.opacityMultiplier).toBeLessThanOrEqual(0.03)
  })

  it('authors spark cone as a particle-first directional fan with cooling smoke and a compact source', () => {
    const preset = createPfxPreset('spark-cone')
    const plan = getPfxRenderPlan(preset)
    const source = plan.surfaces.find((surface) => surface.phase === 'spark-cone-particle-source-pop')
    const streaks = plan.surfaces.find((surface) => surface.phase === 'spark-cone-particle-directional-fan')
    const chips = plan.surfaces.find((surface) => surface.phase === 'spark-cone-particle-cooling-smoke')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'glow')).toBe(false)
    expect(streaks).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'cone-fountain',
        sprite: 'streak',
        lifecycle: 'spark-cone-particle-release',
        blend: 'additive',
      },
    })
    expect(streaks!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(streaks!.scale).toBeGreaterThanOrEqual(1.1)
    expect(streaks!.tuning!.colorOverride).toBe('#ffb33f')

    expect(chips).toMatchObject({
      kind: 'particles',
      role: 'volume',
      tuning: {
        motion: 'drift-cloud',
        sprite: 'smoke-variants',
        blend: 'alpha',
        ramp: 'dark',
        death: 'erode',
        lifecycle: 'spark-cone-particle-release',
      },
    })
    expect(chips!.tuning!.colorOverride).toBe('#76462f')
    expect(chips!.tuning!.countScale).toBeGreaterThanOrEqual(0.3)
    expect(chips!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(chips!.tuning!.window).toBeGreaterThanOrEqual(0.4)

    expect(source).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'impact-burst',
        sprite: 'soft',
        blend: 'additive',
        ramp: 'pinned-hot',
      },
    })
    expect(source!.tuning!.colorOverride).toBe('#fff3c4')
    expect(source!.tuning!.countScale).toBeGreaterThanOrEqual(0.1)
    expect(source!.tuning!.countScale).toBeLessThanOrEqual(0.25)
    expect(source!.tuning!.speedScale).toBeLessThanOrEqual(3)
    expect(source!.tuning!.spawnScale).toBeLessThanOrEqual(0.1)
    expect(source!.tuning!.window).toBeLessThanOrEqual(0.1)
    expect(source!.tuning!.lifeScale).toBeLessThanOrEqual(0.55)

    const chipEmission = PfxLibrary.createPfxParticleEmission(preset, streaks!)
    const allDirections = [chipEmission].flatMap((emission) =>
      Array.from({ length: emission.count }, (_, index) => [
        emission.direction[index * 3]!,
        emission.direction[index * 3 + 1]!,
        emission.direction[index * 3 + 2]!,
      ] as const),
    )
    const axis = new THREE.Vector3(1, 0.18, 0.08).normalize()
    const forwardRatio = allDirections.filter((direction) => axis.dot(new THREE.Vector3(...direction)) > 0.9).length / allDirections.length
    const depthValues = allDirections.map((direction) => direction[2])
    expect(forwardRatio).toBeGreaterThanOrEqual(0.45)
    expect(Math.max(...depthValues) - Math.min(...depthValues)).toBeGreaterThanOrEqual(0.5)
    expect(chipEmission.count + PfxLibrary.createPfxParticleEmission(preset, source!).count).toBeLessThanOrEqual(64)

    const geometry = PfxLibrary.createPfxSparkConeStreakGeometry()
    expect(geometry.userData).toMatchObject({
      pfxSparkConeDrawCalls: 1,
      pfxSparkConeClosedFaces: true,
      pfxSparkConeStreakCount: 18,
      pfxSparkConeHeadCount: 12,
      pfxSparkConeRadialContinuity: true,
      pfxSparkConeCurvedSegments: true,
      pfxSparkConeIgnitionCore: true,
      pfxSparkConeReviewOrientation: 'side-camera-axial-front-camera-lateral',
    })
    expect(geometry.userData['pfxSparkConeTrajectorySpan']).toBeGreaterThanOrEqual(1.15)
    expect(geometry.userData['pfxSparkConeDepthSpan']).toBeGreaterThanOrEqual(0.8)
    expect(geometry.userData['pfxSparkConeCrossSectionSpan']).toBeGreaterThanOrEqual(0.6)
    expect(geometry.userData['pfxSparkConeMaxHeadDistance']).toBeLessThanOrEqual(1.85)
    expect(geometry.userData['pfxSparkConeMinTailDistance']).toBeLessThanOrEqual(0.16)
    expect(geometry.userData['pfxSparkConeMaxTailDistance']).toBeLessThanOrEqual(0.3)
    expect(geometry.userData['pfxSparkConeRootWidth']).toBeGreaterThanOrEqual(0.045)
    expect(geometry.userData['pfxSparkConeMinHeadRadius']).toBeLessThanOrEqual(0.03)
    expect(geometry.userData['pfxSparkConeMaxHeadRadius']).toBeGreaterThanOrEqual(0.06)
    expect(geometry.userData['pfxSparkConeDistinctHeadDistances']).toBeGreaterThanOrEqual(14)
    expect(geometry.userData['pfxSparkConeSideCameraAxisDot']).toBeGreaterThanOrEqual(0.975)
    expect(geometry.userData['pfxSparkConeIgnitionCoreRadius']).toBeGreaterThanOrEqual(0.12)
    geometry.dispose()
    const material = PfxLibrary.createPfxSparkConeStreakMaterial(streaks!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(streaks!.opacity)
    expect(material.vertexShader).toContain('normalMatrix')
    expect(material.fragmentShader).toContain('vSparkColor')
    PfxLibrary.applyPfxSparkConeMaterialOpacity(material, 0.23)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.23)
    material.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(streaks!, preset.controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(streaks!, preset.controls, 0.22, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(streaks!, preset.controls, 0.58, 1, 1)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.52)
    expect(onset.scaleMultiplier).toBeLessThanOrEqual(1.1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.55)
    expect(peak.scaleMultiplier).toBeGreaterThanOrEqual(0.95)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(decay.opacityMultiplier).toBeLessThanOrEqual(0.8)
  })

  it('authors shard break as a peak-timed closed crystal fracture with an ignition core and cooling chips', () => {
    const preset = createPfxPreset('shard-break')
    const plan = getPfxRenderPlan(preset)
    const fragments = plan.surfaces.find((surface) => surface.phase === 'shard-break-crystal-fracture')
    const core = plan.surfaces.find((surface) => surface.phase === 'shard-break-ignition-core')
    const chips = plan.surfaces.find((surface) => surface.phase === 'shard-break-cooling-chips')

    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'glow')).toBe(false)
    expect(fragments).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      tuning: {
        meshGeometry: 'shard-break-crystal-fragments',
        lifecycle: 'shard-break-fracture',
      },
    })
    expect(fragments!.opacity).toBeGreaterThanOrEqual(0.95)
    expect(fragments!.scale).toBeGreaterThanOrEqual(1.25)
    expect(fragments!.tuning!.positionOffset![1]).toBeLessThanOrEqual(-0.6)
    expect(core).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      tuning: {
        meshGeometry: 'shard-break-ignition-core',
        lifecycle: 'shard-break-fracture',
      },
    })
    expect(core!.scale).toBeGreaterThanOrEqual(0.7)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(core!, 2, false)).toBe(false)
    expect(chips).toMatchObject({
      kind: 'particles',
      role: 'trail',
      tuning: {
        motion: 'radial-burst',
        sprite: 'debris',
        blend: 'additive',
        ramp: 'pinned-hot',
        death: 'erode',
      },
    })
    expect(chips!.tuning!.gravity).toBeLessThanOrEqual(-3)
    expect(chips!.tuning!.delay).toBe(0)
    expect(chips!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(PfxLibrary.createPfxParticleEmission(preset, chips!).count).toBeLessThanOrEqual(20)

    const fragmentGeometry = PfxLibrary.createPfxShardBreakFragmentGeometry()
    expect(fragmentGeometry.userData).toMatchObject({
      pfxShardBreakDrawCalls: 1,
      pfxShardBreakFragmentCount: 12,
      pfxShardBreakClosedFaces: true,
      pfxShardBreakWorldSpaceVolume: true,
      pfxShardBreakIrregularTopology: true,
      pfxShardBreakFacetSideMin: 3,
      pfxShardBreakFacetSideMax: 5,
      pfxShardBreakTopologyKinds: 3,
      pfxShardBreakTruncatedChunkCount: 8,
      pfxShardBreakPointedShardCount: 4,
    })
    expect(fragmentGeometry.userData['pfxShardBreakDepthSpan']).toBeGreaterThanOrEqual(1)
    expect(fragmentGeometry.userData['pfxShardBreakWidthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(fragmentGeometry.userData['pfxShardBreakHeightSpan']).toBeGreaterThanOrEqual(0.95)
    expect(fragmentGeometry.userData['pfxShardBreakAspectRatioRange']).toBeGreaterThanOrEqual(1)
    expect(fragmentGeometry.userData['pfxShardBreakHeroVolumeRatio']).toBeGreaterThanOrEqual(1.8)
    expect(fragmentGeometry.userData['pfxShardBreakMaxChunkAspectRatio']).toBeLessThanOrEqual(3.2)
    expect(fragmentGeometry.userData['pfxShardBreakMaxCenterDistance']).toBeLessThanOrEqual(1.05)
    fragmentGeometry.dispose()
    const fragmentMaterial = PfxLibrary.createPfxShardBreakFragmentMaterial(fragments!.opacity)
    expect(fragmentMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(fragmentMaterial.vertexColors).toBe(true)
    expect(fragmentMaterial.blending).toBe(THREE.NormalBlending)
    expect(fragmentMaterial.depthWrite).toBe(true)
    expect(fragmentMaterial.uniforms['uOpacity']!.value).toBeCloseTo(fragments!.opacity)
    expect(fragmentMaterial.fragmentShader).toContain('fresnel')
    expect(fragmentMaterial.fragmentShader).toContain('specular')
    PfxLibrary.applyPfxShardBreakMaterialOpacity(fragmentMaterial, 0.27)
    expect(fragmentMaterial.uniforms['uOpacity']!.value).toBeCloseTo(0.27)
    fragmentMaterial.dispose()

    const coreGeometry = PfxLibrary.createPfxShardBreakIgnitionCoreGeometry()
    expect(coreGeometry.userData).toMatchObject({
      pfxShardBreakCoreDrawCalls: 1,
      pfxShardBreakCoreClosedFaces: true,
      pfxShardBreakCoreFaceCount: 12,
      pfxShardBreakCoreWorldSpaceVolume: true,
    })
    expect(coreGeometry.userData['pfxShardBreakCoreRadius']).toBeGreaterThanOrEqual(0.28)
    coreGeometry.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(fragments!, preset.controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(fragments!, preset.controls, 0.18, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(fragments!, preset.controls, 0.46, 1, 1)
    const capturedPeak = PfxLibrary.getPfxSurfaceAnimationProps(fragments!, preset.controls, 0.2, 1, 1)
    const capturedDecay = PfxLibrary.getPfxSurfaceAnimationProps(fragments!, preset.controls, 0.32, 1, 1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.75)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.3)
    expect(onset.scaleMultiplier).toBeLessThanOrEqual(0.75)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(peak.scaleMultiplier).toBeGreaterThanOrEqual(1)
    expect(decay.opacityMultiplier).toBeLessThanOrEqual(0.35)
    expect(decay.yOffset).toBeLessThan(peak.yOffset - 0.1)
    expect(capturedDecay.opacityMultiplier).toBeLessThanOrEqual(capturedPeak.opacityMultiplier * 0.45)
    expect(capturedDecay.scaleMultiplier).toBeLessThanOrEqual(capturedPeak.scaleMultiplier - 0.12)
    const coreOnset = PfxLibrary.getPfxSurfaceAnimationProps(core!, preset.controls, 0.04, 1, 1)
    const corePeak = PfxLibrary.getPfxSurfaceAnimationProps(core!, preset.controls, 0.2, 1, 1)
    const coreDecay = PfxLibrary.getPfxSurfaceAnimationProps(core!, preset.controls, 0.32, 1, 1)
    expect(coreOnset.opacityMultiplier).toBeGreaterThanOrEqual(0.8)
    expect(coreOnset.scaleMultiplier).toBeGreaterThanOrEqual(0.4)
    expect(corePeak.opacityMultiplier).toBeLessThanOrEqual(0.55)
    expect(coreDecay.opacityMultiplier).toBe(0)
  })

  it('authors ice impact as a grounded asymmetric ice strike with closed splinters and bounded frost debris', () => {
    const preset = createPfxPreset('ice-impact')
    const plan = getPfxRenderPlan(preset)
    const strike = plan.surfaces.find((surface) => surface.phase === 'ice-impact-grounded-strike')

    expect(preset.controls.color).toEqual(['#7ddfff', '#e9fcff'])
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.phase === 'ice-impact-frost-chips')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.phase === 'ice-impact-frost-mist')).toBe(false)
    expect(strike).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      tuning: {
        meshGeometry: 'ice-impact-grounded-splinters',
        lifecycle: 'ice-impact-contact',
        blend: 'alpha',
      },
    })
    expect(strike!.opacity).toBeGreaterThanOrEqual(0.95)
    expect(strike!.scale).toBeGreaterThanOrEqual(1.25)
    expect(strike!.tuning!.positionOffset![1]).toBeLessThanOrEqual(-0.5)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(strike!, 2, false)).toBe(false)
    const geometry = PfxLibrary.createPfxIceImpactGeometry()
    expect(geometry.userData).toMatchObject({
      pfxIceImpactDrawCalls: 1,
      pfxIceImpactClosedFaces: true,
      pfxIceImpactWorldSpaceVolume: true,
      pfxIceImpactGrounded: true,
      pfxIceImpactHeroShardCount: 5,
      pfxIceImpactDetailShardCount: 4,
      pfxIceImpactTruncatedHeroShardCount: 5,
      pfxIceImpactGroundPlateCount: 11,
      pfxIceImpactRimeForkCount: 4,
      pfxIceImpactGroundContactModel: 'seven-primary-plates-four-branch-fissures',
      pfxIceImpactEmbeddedChipCount: 7,
      pfxIceImpactAsymmetric: true,
    })
    expect(geometry.userData['pfxIceImpactDepthSpan']).toBeGreaterThanOrEqual(0.9)
    expect(geometry.userData['pfxIceImpactWidthSpan']).toBeGreaterThanOrEqual(1.3)
    expect(geometry.userData['pfxIceImpactHeightSpan']).toBeGreaterThanOrEqual(1)
    expect(geometry.getAttribute('pfxIcePivot')).toBeDefined()
    expect(geometry.getAttribute('pfxIceRevealOrder')).toBeDefined()
    expect(geometry.getAttribute('pfxIceGroundMask')).toBeDefined()
    expect(geometry.getAttribute('pfxIceRevealOrder')!.count).toBe(geometry.getAttribute('position')!.count)
    expect(geometry.getAttribute('pfxIceGroundMask')!.count).toBe(geometry.getAttribute('position')!.count)
    expect(geometry.userData['pfxIceImpactDirectionalAxisContrast']).toBeGreaterThanOrEqual(1.2)
    geometry.dispose()

    const chipGeometry = PfxLibrary.createPfxIceImpactChipGeometry()
    expect(chipGeometry.userData).toMatchObject({
      pfxIceImpactChipDrawCalls: 1,
      pfxIceImpactChipCount: 7,
      pfxIceImpactChipClosedFaces: true,
      pfxIceImpactChipWorldSpaceVolume: true,
      pfxIceImpactChipAsymmetric: true,
    })
    expect(chipGeometry.userData['pfxIceImpactChipDepthSpan']).toBeGreaterThanOrEqual(0.7)
    chipGeometry.dispose()

    const material = PfxLibrary.createPfxIceImpactMaterial(strike!.opacity, '#7ddfff', '#e9fcff', 0.56, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.uniforms['uPrimaryColor']?.value.getHexString()).toBe('7ddfff')
    expect(material.uniforms['uSecondaryColor']?.value.getHexString()).toBe('e9fcff')
    expect(material.uniforms['uDensity']?.value).toBeCloseTo(0.56)
    expect(material.uniforms['uStyleEdgeHardness']?.value).toBeCloseTo(0.54)
    expect(material.uniforms['uCycle']?.value).toBe(0)
    expect(material.fragmentShader).toContain('fresnel')
    expect(material.fragmentShader).toContain('frost')
    expect(material.fragmentShader).toContain('controlledRimeColor')
    expect(material.fragmentShader).toContain('recoveryFrostHold')
    expect(material.fragmentShader).not.toContain('pow(')
    expect(material.vertexShader).toContain('pfxIcePivot')
    expect(material.vertexShader).toContain('pfxIceRevealOrder')
    expect(material.vertexShader).toContain('uniform float uOpacity')
    expect(material.vertexShader).toContain('uniform float uCycle')
    expect(material.vertexShader).toContain('localFormation')
    expect(material.vertexShader).toContain('recoverySettle')
    expect(material.vertexShader).toContain('driftDirection')
    expect(material.vertexShader).not.toContain('formationSignal = smoothstep(0.18, 1.0, uOpacity)')
    expect(material.uniforms['uFormation']).toBeUndefined()
    expect(material.uniforms['uDissolve']).toBeUndefined()
    PfxLibrary.applyPfxIceImpactAppearance(material, 0.29, 0.62)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.29)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.62)
    expect(material.userData['pfxIceImpactControlBinding']).toBe('primary-secondary-density-style')
    expect(material.userData['pfxIceImpactRecoveryModel']).toBe('cycle-driven-intact-rime-settle')
    material.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(strike!, preset.controls, 0, 1, 2)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(strike!, preset.controls, 0.12, 1, 2)
    const earlyRecovery = PfxLibrary.getPfxSurfaceAnimationProps(strike!, preset.controls, 0.2, 1, 2)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(strike!, preset.controls, 0.32, 1, 2)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.65)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.38)
    expect(onset.scaleMultiplier).toBeLessThanOrEqual(0.45)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(peak.scaleMultiplier).toBeGreaterThanOrEqual(0.95)
    expect(earlyRecovery.opacityMultiplier).toBeGreaterThanOrEqual(0.55)
    expect(decay.opacityMultiplier).toBeLessThanOrEqual(0.28)
    expect(decay.yOffset).toBeLessThanOrEqual(0)
  })

  it('authors frost aura as a persistent two-draw crystalline helix with gem-cut facet bands', () => {
    const preset = createPfxPreset('frost-aura')
    const plan = getPfxRenderPlan(preset)
    const crown = plan.surfaces.find((surface) => surface.phase === 'frost-aura-crystal-crown')
    const glint = plan.surfaces.find((surface) => surface.phase === 'frost-aura-crystal-edge-glint')

    expect(preset.controls.color).toEqual(['#8ee8ff', '#e8fbff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(crown).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      tuning: {
        meshGeometry: 'frost-aura-crystal-crown',
        meshMotion: 'pulse',
        lifecycle: 'frost-aura-breathing-loop',
        blend: 'alpha',
      },
    })
    expect(crown!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(crown!.scale).toBeGreaterThanOrEqual(1)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(crown!, 2, false)).toBe(false)
    expect(glint).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      tuning: {
        meshGeometry: 'frost-aura-crystal-glint',
        meshMotion: 'pulse',
        lifecycle: 'frost-aura-breathing-loop',
        blend: 'additive',
      },
    })
    expect(glint!.opacity).toBeGreaterThanOrEqual(0.55)
    const geometry = PfxLibrary.createPfxFrostAuraGeometry()
    expect(geometry.userData).toMatchObject({
      pfxFrostAuraDrawCalls: 1,
      pfxFrostAuraClosedFaces: true,
      pfxFrostAuraWorldSpaceVolume: true,
      pfxFrostAuraGrounded: true,
      pfxFrostAuraCrystalCount: 0,
      pfxFrostAuraRimePlateCount: 1,
      pfxFrostAuraRimeCrescentSegments: 5,
      pfxFrostAuraSupportLayer: 'broken-ground-rime-crescent',
      pfxFrostAuraAirborneChipCount: 0,
      pfxFrostAuraHelixSegmentCount: 24,
      pfxFrostAuraGlintMoteCount: 0,
      pfxFrostAuraHelicalTurns: 1.25,
      pfxFrostAuraHelixStrands: 2,
      pfxFrostAuraHelixPointedEnds: true,
      pfxFrostAuraHelixCrossSectionFaces: 3,
      pfxFrostAuraHelixLengthClasses: 4,
      pfxFrostAuraHelixAxialFacetBands: 2,
      pfxFrostAuraCrustPieceCount: 6,
      pfxFrostAuraCrustTopologyKinds: 2,
      pfxFrostAuraBranchedClusterCount: 3,
      pfxFrostAuraClusterBranchCount: 9,
      pfxFrostAuraTorsoBanding: true,
      pfxFrostAuraBrokenCrown: true,
      pfxFrostAuraAsymmetric: true,
    })
    expect(geometry.userData['pfxFrostAuraHollowCenterRadius']).toBeGreaterThanOrEqual(0.45)
    expect(geometry.userData['pfxFrostAuraRimeOuterRadius']).toBeGreaterThanOrEqual(0.65)
    expect(geometry.userData['pfxFrostAuraHelixSpanRatio']).toBeGreaterThanOrEqual(2.4)
    expect(geometry.userData['pfxFrostAuraHelixHeightRatio']).toBeGreaterThanOrEqual(2.1)
    expect(geometry.userData['pfxFrostAuraDepthSpan']).toBeGreaterThanOrEqual(1.1)
    expect(geometry.userData['pfxFrostAuraWidthSpan']).toBeGreaterThanOrEqual(1)
    expect(geometry.userData['pfxFrostAuraHeightSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxFrostAuraTorsoMinY']).toBeLessThanOrEqual(0.32)
    expect(geometry.userData['pfxFrostAuraTorsoMaxY']).toBeGreaterThanOrEqual(1.45)
    expect(geometry.userData['pfxFrostAuraMaximumVerticalGap']).toBeLessThanOrEqual(0.16)
    expect(geometry.getAttribute('pfxFrostMotion')).toBeDefined()
    expect(geometry.getAttribute('pfxFrostPhase')).toBeDefined()
    expect(geometry.getAttribute('pfxFrostMotion')!.count).toBe(geometry.getAttribute('position')!.count)
    geometry.dispose()

    const material = PfxLibrary.createPfxFrostAuraMaterial(crown!.opacity, '#8ee8ff', '#e8fbff', 0.56, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.uniforms['uPrimaryColor']?.value.getHexString()).toBe('8ee8ff')
    expect(material.uniforms['uSecondaryColor']?.value.getHexString()).toBe('e8fbff')
    expect(material.fragmentShader).toContain('fresnel')
    expect(material.fragmentShader).toContain('rime')
    expect(material.fragmentShader).toContain('crystalGlint')
    expect(material.fragmentShader).toContain('iceTransmission')
    expect(material.fragmentShader).toContain('internalCaustic')
    expect(material.fragmentShader).toContain('controlledFrostColor')
    expect(material.fragmentShader).toContain('transmissionWindow')
    expect(material.fragmentShader).not.toContain('pow(')
    expect(material.vertexShader).toContain('pfxFrostMotion')
    expect(material.vertexShader).toContain('pfxFrostPhase')
    expect(material.vertexShader).toContain('uCycle')
    expect(material.vertexShader).toContain('vFrostObjectPosition')
    expect(material.vertexShader).toContain('orbitAngle')
    expect(material.vertexShader).toContain('6.2831853')
    PfxLibrary.applyPfxFrostAuraMaterialOpacity(material, 0.31)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.31)
    PfxLibrary.applyPfxFrostAuraMaterialCycle(material, 0.63)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.63)
    expect(material.userData['pfxFrostAuraControlBinding']).toBe('primary-secondary-density-style')
    expect(material.userData['pfxFrostAuraTransmissionModel']).toBe('view-dependent-thin-ice-window')
    material.dispose()

    const glintMaterial = PfxLibrary.createPfxFrostAuraCrystalGlintMaterial(glint!.opacity, '#8ee8ff', '#e8fbff', 0.56, 0.54)
    expect(glintMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(glintMaterial.depthWrite).toBe(false)
    expect(glintMaterial.side).toBe(THREE.FrontSide)
    expect(glintMaterial.fragmentShader).toContain('rimGlint')
    expect(glintMaterial.fragmentShader).toContain('facetFlash')
    expect(glintMaterial.fragmentShader).toContain('controlledGlintColor')
    expect(glintMaterial.vertexShader).toContain('vGlintPulse')
    expect(glintMaterial.fragmentShader).not.toContain('sin(')
    expect(glintMaterial.fragmentShader).not.toContain('pow(')
    expect(glintMaterial.userData['pfxFrostAuraControlBinding']).toBe('primary-secondary-density-style')
    glintMaterial.dispose()

    const samples = [0, 0.32, 0.64].map((elapsed) => (
      PfxLibrary.getPfxSurfaceAnimationProps(crown!, preset.controls, elapsed, 1, plan.tempo)
    ))
    for (const sample of samples) {
      expect(sample.opacityMultiplier).toBeGreaterThanOrEqual(0.68)
      expect(sample.scaleMultiplier).toBeGreaterThanOrEqual(0.78)
      expect(sample.scaleMultiplier).toBeLessThanOrEqual(1.12)
      expect(sample.signature).toContain('frost-aura-breath')
    }
    expect(Math.max(...samples.map((sample) => sample.scaleMultiplier)) - Math.min(...samples.map((sample) => sample.scaleMultiplier))).toBeGreaterThanOrEqual(0.3)
    expect(Math.max(...samples.map((sample) => sample.opacityMultiplier)) - Math.min(...samples.map((sample) => sample.opacityMultiplier))).toBeGreaterThanOrEqual(0.3)
  })

  it('authors water column as a two-draw closed turbulent geyser with radial splash volume and collapse', () => {
    const preset = createPfxPreset('water-column')
    const plan = getPfxRenderPlan(preset)
    const body = plan.surfaces.find((surface) => surface.phase === 'water-column-braided-geyser')
    const foam = plan.surfaces.find((surface) => surface.phase === 'water-column-radial-foam-spray')

    expect(preset.controls.color).toEqual(['#168fd1', '#bdefff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'muzzle-cone')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(body).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      tuning: {
        meshGeometry: 'water-column-churning-body',
        meshMotion: 'charge',
        lifecycle: 'water-column-eruption',
        blend: 'alpha',
      },
    })
    expect(foam).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      tuning: {
        meshGeometry: 'water-column-foam-spray',
        meshMotion: 'bloom',
        lifecycle: 'water-column-eruption',
        blend: 'additive',
      },
    })
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(body!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(foam!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxWaterColumnGeometry()
    expect(geometry.userData).toMatchObject({
      pfxWaterColumnDrawCalls: 1,
      pfxWaterColumnClosedFaces: true,
      pfxWaterColumnWorldSpaceVolume: true,
      pfxWaterColumnBillboardCount: 0,
      pfxWaterColumnBraidedStreamCount: 3,
      pfxWaterColumnCenterlineStations: 17,
      pfxWaterColumnCrossSectionFaces: 16,
      pfxWaterColumnBaseSplashLobeCount: 5,
      pfxWaterColumnConnectedBaseSplash: true,
      pfxWaterColumnCrownJetCount: 9,
      pfxWaterColumnConnectedCrown: true,
      pfxWaterColumnCrownTopology: 'closed-arcing-jets',
      pfxWaterColumnCrownArcStationCount: 8,
      pfxWaterColumnCrownArcCrossSectionFaces: 11,
      pfxWaterColumnCrownJetLengthClasses: 4,
      pfxWaterColumnAttachedDropletBulbCount: 9,
      pfxWaterColumnClosedDropletBulbs: true,
      pfxWaterColumnCrownAngularGaps: true,
      pfxWaterColumnCrownVolumetricDepth: true,
      pfxWaterColumnPlanarCrownPanelCount: 0,
      pfxWaterColumnIrregularJetAzimuths: true,
      pfxWaterColumnSmoothNormals: true,
      pfxWaterColumnAsymmetric: true,
    })
    expect(geometry.userData['pfxWaterColumnCrownReachVariance']).toBeGreaterThanOrEqual(0.2)
    expect(geometry.userData['pfxWaterColumnCrownBallisticDrop']).toBeGreaterThanOrEqual(0.35)
    expect(geometry.userData['pfxWaterColumnDropletLengthClasses']).toBeGreaterThanOrEqual(3)
    expect(geometry.userData['pfxWaterColumnJetGapRatio']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxWaterColumnCrownWidthDepthRatio']).toBeGreaterThanOrEqual(1.45)
    expect(geometry.userData['pfxWaterColumnCrownTipRadius']).toBeLessThanOrEqual(0.02)
    expect(geometry.userData['pfxWaterColumnFrontReachBalance']).toBeGreaterThanOrEqual(0.9)
    expect(geometry.userData['pfxWaterColumnBaseWidthDepthRatio']).toBeGreaterThanOrEqual(1.25)
    expect(geometry.userData['pfxWaterColumnBaseVerticalRelief']).toBeGreaterThanOrEqual(0.18)
    expect(geometry.userData['pfxWaterColumnCrownTriangleCount']).toBeLessThanOrEqual(1_800)
    expect(geometry.userData['pfxWaterColumnWidthSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxWaterColumnDepthSpan']).toBeGreaterThanOrEqual(1.3)
    expect(geometry.userData['pfxWaterColumnHeightSpan']).toBeGreaterThanOrEqual(2.4)
    expect(geometry.getAttribute('pfxWaterProgress')).toBeDefined()
    expect(geometry.getAttribute('pfxWaterFlowLane')).toBeDefined()
    expect(geometry.getAttribute('pfxWaterCrownMask')).toBeDefined()
    expect(geometry.getAttribute('pfxWaterProgress')!.count).toBe(geometry.getAttribute('position')!.count)
    geometry.dispose()

    const bodyMaterial = PfxLibrary.createPfxWaterColumnMaterial(body!.opacity, '#168fd1', '#bdefff', 0.58, 0.52)
    expect(bodyMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(bodyMaterial.blending).toBe(THREE.NormalBlending)
    expect(bodyMaterial.depthWrite).toBe(false)
    expect(bodyMaterial.side).toBe(THREE.FrontSide)
    expect(bodyMaterial.fragmentShader).toContain('rivulet')
    expect(bodyMaterial.fragmentShader).toContain('waterTransmission')
    expect(bodyMaterial.fragmentShader).toContain('internalCaustic')
    expect(bodyMaterial.fragmentShader).toContain('refractionBand')
    expect(bodyMaterial.fragmentShader).toContain('collapseFront')
    expect(bodyMaterial.fragmentShader).toContain('cohesiveHull')
    expect(bodyMaterial.fragmentShader).toContain('specularSheen')
    expect(bodyMaterial.fragmentShader).toContain('cylindricalRoll')
    expect(bodyMaterial.fragmentShader).toContain('directionalVolume')
    expect(bodyMaterial.fragmentShader).toContain('backscatter')
    expect(bodyMaterial.fragmentShader).toContain('controlledWaterColor')
    expect(bodyMaterial.fragmentShader).toContain('smoothCylindricalAlpha')
    expect(bodyMaterial.fragmentShader).toContain('mobileTriWave')
    expect(bodyMaterial.fragmentShader).not.toContain('atan(')
    expect(bodyMaterial.fragmentShader).not.toContain('pow(')
    expect(bodyMaterial.vertexShader).toContain('pfxWaterProgress')
    expect(bodyMaterial.vertexShader).toContain('pfxWaterFlowLane')
    expect(bodyMaterial.vertexShader).toContain('crownEmergence')
    expect(bodyMaterial.uniforms['uPrimaryColor']?.value.getHexString()).toBe('168fd1')
    expect(bodyMaterial.uniforms['uSecondaryColor']?.value.getHexString()).toBe('bdefff')
    expect(bodyMaterial.userData['pfxWaterColumnControlBinding']).toBe('primary-secondary-density-style')
    bodyMaterial.dispose()

    const foamGeometry = PfxLibrary.createPfxWaterColumnFoamGeometry()
    expect(foamGeometry.userData).toMatchObject({
      pfxWaterColumnFoamDrawCalls: 1,
      pfxWaterColumnFoamClosedFaces: true,
      pfxWaterColumnCrownFoamStreakCount: 9,
      pfxWaterColumnDetachedDropletCount: 0,
      pfxWaterColumnFoamAttachedToCrown: true,
      pfxWaterColumnGroundFoamStreakCount: 6,
      pfxWaterColumnFlatFoamCardCount: 0,
      pfxWaterColumnFoamBillboardCount: 0,
      pfxWaterColumnRoundedFoamTopology: true,
      pfxWaterColumnFoamTopology: 'attached-scalloped-caps-and-ground-streaks',
    })
    expect(foamGeometry.userData['pfxWaterColumnCrownFoamCoverageRatio']).toBeLessThanOrEqual(0.62)
    expect(foamGeometry.getAttribute('pfxWaterProgress')).toBeDefined()
    foamGeometry.dispose()

    const foamMaterial = PfxLibrary.createPfxWaterColumnFoamMaterial(foam!.opacity, '#168fd1', '#bdefff', 0.58, 0.52)
    expect(foamMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(foamMaterial.depthWrite).toBe(false)
    expect(foamMaterial.depthTest).toBe(false)
    expect(foamMaterial.side).toBe(THREE.DoubleSide)
    expect(foamMaterial.forceSinglePass).toBe(true)
    expect(foamMaterial.fragmentShader).toContain('foamCrest')
    expect(foamMaterial.fragmentShader).toContain('rimFoam')
    expect(foamMaterial.fragmentShader).toContain('brightFoam')
    expect(foamMaterial.fragmentShader).toContain('foamWhite')
    expect(foamMaterial.fragmentShader).toContain('foamSoftness')
    expect(foamMaterial.fragmentShader).toContain('foamBreakup')
    expect(foamMaterial.fragmentShader).toContain('controlledFoamColor')
    expect(foamMaterial.fragmentShader).toContain('mobileFoamWave')
    expect(foamMaterial.fragmentShader).not.toContain('sin(')
    expect(foamMaterial.userData['pfxWaterColumnControlBinding']).toBe('primary-secondary-density-style')
    foamMaterial.dispose()

    const gather = PfxLibrary.createPfxWaterColumnLifecycle(0.03)
    expect(gather).toMatchObject({ stage: 'gather' })
    expect(gather.height).toBeGreaterThanOrEqual(0.5)
    expect(gather.energy).toBeGreaterThanOrEqual(0.5)
    const surge = PfxLibrary.createPfxWaterColumnLifecycle(0.42)
    expect(surge).toMatchObject({ stage: 'surge' })
    expect(surge.height).toBeGreaterThanOrEqual(0.94)
    expect(surge.energy).toBeGreaterThanOrEqual(0.9)
    const collapse = PfxLibrary.createPfxWaterColumnLifecycle(0.84)
    expect(collapse).toMatchObject({ stage: 'collapse' })
    expect(collapse.height).toBeLessThanOrEqual(0.58)
    expect(collapse.energy).toBeLessThanOrEqual(0.58)
    const earlyDecay = PfxLibrary.createPfxWaterColumnLifecycle(0.64)
    expect(earlyDecay).toMatchObject({ stage: 'collapse' })
    expect(earlyDecay.height).toBeLessThanOrEqual(0.6)
    expect(earlyDecay.energy).toBeLessThanOrEqual(0.55)
    expect(PfxLibrary.createPfxWaterColumnLifecycle(0.97)).toEqual({
      energy: 0,
      foam: 0,
      height: 0,
      stage: 'rest',
    })
  })

  it('authors snow idle as a two-draw volumetric six-arm flurry with a subordinate faceted depth field', () => {
    const preset = createPfxPreset('snow-idle')
    const plan = getPfxRenderPlan(preset)
    const flurry = plan.surfaces.find((surface) => surface.phase === 'snow-idle-volumetric-flurry')
    const granules = plan.surfaces.find((surface) => surface.phase === 'snow-idle-faceted-depth-field')

    expect(preset.controls.color).toEqual(['#edfaff', '#bfeeff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(flurry).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      tuning: {
        meshGeometry: 'snow-idle-flurry-field',
        meshMotion: 'drift',
        lifecycle: 'snow-idle-weather-loop',
        blend: 'alpha',
      },
    })
    expect(granules).toMatchObject({
      kind: 'impact-shards',
      role: 'volume',
      tuning: {
        meshGeometry: 'snow-idle-depth-granules',
        meshMotion: 'drift',
        lifecycle: 'snow-idle-weather-loop',
        blend: 'alpha',
      },
    })
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(flurry!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(granules!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxSnowIdleFlurryGeometry()
    expect(geometry.userData).toMatchObject({
      pfxSnowIdleDrawCalls: 1,
      pfxSnowIdleClosedFaces: true,
      pfxSnowIdleWorldSpaceVolume: true,
      pfxSnowIdleBillboardCount: 0,
      pfxSnowIdleFlakeCount: 12,
      pfxSnowIdleFlakeArmCount: 6,
      pfxSnowIdleDendriteVariantCount: 5,
      pfxSnowIdleBranchedArmPairCount: 12,
      pfxSnowIdleCrystalTierCount: 2,
      pfxSnowIdleDepthBraceCount: 6,
      pfxSnowIdleDepthBranchedArmPairCount: 12,
      pfxSnowIdleOrientationClassCount: 6,
      pfxSnowIdleVolumetricOrientationSpread: true,
      pfxSnowIdleDepthScaleGradient: true,
      pfxSnowIdleReviewAngleSafeOrientations: true,
      pfxSnowIdleDecorrelatedEmitterLayout: true,
      pfxSnowIdleDetachedMagicSparkleCount: 0,
    })
    expect(geometry.userData['pfxSnowIdleTriangleCount']).toBeLessThanOrEqual(5_000)
    expect(geometry.userData['pfxSnowIdleMaximumFlakeRadius']).toBeLessThanOrEqual(0.095)
    expect(geometry.userData['pfxSnowIdleFlakeScaleClassCount']).toBeGreaterThanOrEqual(5)
    expect(geometry.userData['pfxSnowIdleMinimumReviewProjection']).toBeGreaterThanOrEqual(0.4)
    expect(geometry.userData['pfxSnowIdleFacetedRodRadiusRatio']).toBeGreaterThanOrEqual(0.16)
    expect(geometry.userData['pfxSnowIdleWidthSpan']).toBeGreaterThanOrEqual(3)
    expect(geometry.userData['pfxSnowIdleDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxSnowIdleHeightSpan']).toBeGreaterThanOrEqual(3)
    expect(geometry.getAttribute('pfxSnowCenter')).toBeDefined()
    expect(geometry.getAttribute('pfxSnowSeed')).toBeDefined()
    expect(geometry.getAttribute('pfxSnowLayer')).toBeDefined()
    geometry.dispose()

    const material = PfxLibrary.createPfxSnowIdleFlurryMaterial(flurry!.opacity, '#edfaff', '#bfeeff', 0.58, 0.52)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxSnowCenter')
    expect(material.vertexShader).toContain('fallProgress')
    expect(material.vertexShader).toContain('depthScale')
    expect(material.vertexShader).toContain('rotatedNormal')
    expect(material.fragmentShader).toContain('snowCrystal')
    expect(material.fragmentShader).toContain('frostRim')
    expect(material.fragmentShader).toContain('aerialDepthFade')
    expect(material.fragmentShader).toContain('crystalGlint')
    expect(material.fragmentShader).toContain('iceFacet')
    expect(material.fragmentShader).toContain('weatherDensity')
    expect(material.fragmentShader).toContain('controlledSnowColor')
    expect(material.uniforms['uPrimaryColor']?.value.getHexString()).toBe('edfaff')
    expect(material.uniforms['uSecondaryColor']?.value.getHexString()).toBe('bfeeff')
    expect(material.userData['pfxSnowIdleControlBinding']).toBe('primary-secondary-density-style')
    material.dispose()

    const granuleGeometry = PfxLibrary.createPfxSnowIdleGranuleGeometry()
    expect(granuleGeometry.userData).toMatchObject({
      pfxSnowIdleGranuleDrawCalls: 1,
      pfxSnowIdleGranuleClosedFaces: true,
      pfxSnowIdleGranuleCount: 48,
      pfxSnowIdleHazeLobeCount: 3,
      pfxSnowIdleHazeClosedFaces: true,
      pfxSnowIdleHazeSmoothNormals: true,
      pfxSnowIdleGranuleTrailCorrelation: 0,
      pfxSnowIdleGranuleBillboardCount: 0,
      pfxSnowIdleGranuleWorldSpaceVolume: true,
    })
    expect(granuleGeometry.userData['pfxSnowIdleGranuleTriangleCount']).toBeLessThanOrEqual(700)
    expect(granuleGeometry.userData['pfxSnowIdleGranuleWidthSpan']).toBeGreaterThanOrEqual(3.4)
    expect(granuleGeometry.userData['pfxSnowIdleGranuleDepthSpan']).toBeGreaterThanOrEqual(2.8)
    expect(granuleGeometry.userData['pfxSnowIdleGranuleHeightSpan']).toBeGreaterThanOrEqual(3.2)
    expect(granuleGeometry.getAttribute('pfxSnowCenter')).toBeDefined()
    expect(granuleGeometry.getAttribute('pfxSnowSeed')).toBeDefined()
    expect(granuleGeometry.getAttribute('pfxSnowLayer')).toBeDefined()
    expect(granuleGeometry.getAttribute('pfxSnowForm')).toBeDefined()
    expect(granuleGeometry.getAttribute('normal')).toBeDefined()
    granuleGeometry.dispose()

    const granuleMaterial = PfxLibrary.createPfxSnowIdleGranuleMaterial(granules!.opacity, '#edfaff', '#bfeeff', 0.58, 0.52)
    expect(granuleMaterial.blending).toBe(THREE.NormalBlending)
    expect(granuleMaterial.depthWrite).toBe(false)
    expect(granuleMaterial.side).toBe(THREE.DoubleSide)
    expect(granuleMaterial.forceSinglePass).toBe(true)
    expect(granuleMaterial.vertexShader).toContain('pfxSnowForm')
    expect(granuleMaterial.fragmentShader).toContain('softDepth')
    expect(granuleMaterial.fragmentShader).toContain('granuleGlint')
    expect(granuleMaterial.fragmentShader).toContain('volumetricHaze')
    expect(granuleMaterial.fragmentShader).toContain('hazeNoise')
    expect(granuleMaterial.fragmentShader).toContain('hazeEdgeFade')
    expect(granuleMaterial.fragmentShader).toContain('controlledHazeColor')
    expect(granuleMaterial.userData['pfxSnowIdleHazeOpacityFloor']).toBeGreaterThanOrEqual(0.075)
    expect(granuleMaterial.userData['pfxSnowIdleControlBinding']).toBe('primary-secondary-density-style')
    granuleMaterial.dispose()

    const samples = [0.05, 0.32, 0.58, 0.84].map(PfxLibrary.createPfxSnowIdleLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['drift', 'gust', 'settle', 'drift'])
    for (const sample of samples) {
      expect(sample.density).toBeGreaterThanOrEqual(0.68)
      expect(sample.fall).toBeGreaterThanOrEqual(0.2)
      expect(sample.gust).toBeGreaterThanOrEqual(0)
      expect(sample.gust).toBeLessThanOrEqual(1)
    }
    expect(samples[1]!.density - samples[0]!.density).toBeGreaterThanOrEqual(0.12)
    expect(samples[2]!.gust - samples[0]!.gust).toBeGreaterThanOrEqual(0.45)
  })

  it('authors wind beam as a two-draw horizontal pressure surge with closed flow-caught leaves', () => {
    const preset = createPfxPreset('wind-beam')
    const plan = getPfxRenderPlan(preset)
    expect(preset.implementationProfile).toBe('directional-burst')
    expect(preset.performance.tier).toBe('high')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(4)
    const pressure = plan.surfaces.find((surface) => surface.phase === 'wind-beam-pressure-surge')
    const leaves = plan.surfaces.find((surface) => surface.phase === 'wind-beam-flow-caught-leaves')

    expect(preset.controls.color).toEqual(['#d8fff4', '#b8e6ff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(pressure).toMatchObject({
      kind: 'wind-streaks',
      role: 'body',
      opacity: 1,
      tuning: {
        meshGeometry: 'wind-beam-pressure-ribbons',
        meshMotion: 'flash',
        lifecycle: 'wind-beam-surge',
        blend: 'alpha',
        colorOverride: '#ffffff',
        positionOffset: [-1.2, -0.18, 0],
      },
    })
    expect(pressure!.scale).toBeCloseTo(2.0125)
    expect(leaves).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 1,
      tuning: {
        meshGeometry: 'wind-beam-debris-leaves',
        meshMotion: 'drift',
        lifecycle: 'wind-beam-surge',
        blend: 'alpha',
        colorOverride: '#9aaa57',
        positionOffset: [-1.2, -0.18, 0],
      },
    })
    expect(leaves!.scale).toBeCloseTo(1.553)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(pressure!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(leaves!, 2, false)).toBe(false)

    const pressureGeometry = PfxLibrary.createPfxWindBeamPressureGeometry()
    expect(pressureGeometry.userData).toMatchObject({
      pfxWindBeamPressureDrawCalls: 1,
      pfxWindBeamPressureStreamCount: 4,
      pfxWindBeamPressureProfile: 'ring-free-closed-flow-ribbons',
      pfxWindBeamPressureHeroStreamCount: 1,
      pfxWindBeamPressureSecondaryStreamCount: 2,
      pfxWindBeamPressureAccentStreamCount: 1,
      pfxWindBeamPressureOrganicCurvature: true,
      pfxWindBeamPressureAxialRingSuppression: true,
      pfxWindBeamPressureEndpointVariation: true,
      pfxWindBeamPressureIndependentDepthLanes: true,
      pfxWindBeamPressureStreamDepthSlopes: [0.05, 0.015, -0.02, 0.03],
      pfxWindBeamPressureVerticalOrderPreserved: true,
      pfxWindBeamPressureCrossSectionRadius: 1.05,
      pfxWindBeamPressureCrossSegments: 6,
      pfxWindBeamPressureFlowAxis: [1, 0.05, 0.24],
      pfxWindBeamPressureAxisAligned: true,
      pfxWindBeamPressureArcHeight: 0.12,
      pfxWindBeamPressurePalette: 'silver-air-with-seasonal-foliage',
      pfxWindBeamPressureSideProfileLayerCount: 4,
      pfxWindBeamPressureCurvatureProfileCount: 4,
      pfxWindBeamPressureLaneHierarchy: 'hero-secondary-accent',
      pfxWindBeamPressureHeroWidthMultiplier: 1.05,
      pfxWindBeamPressureShellRole: 'subordinate-atmosphere',
      pfxWindBeamPressureSecondaryWidthRange: [0.58, 0.7],
      pfxWindBeamPressureContourGrammar: 'four-varied-strands-tail-to-leading-scoop',
      pfxWindBeamPressureContourValueSteps: [1, 0.48, 0.34, 0.2],
      pfxWindBeamPressureSideProfile: 'ordered-axial-cross-section',
      pfxWindBeamPressureClosedCrossSections: true,
      pfxWindBeamPressureRingCount: 0,
      pfxWindBeamPressureEndCapCount: 0,
      pfxWindBeamPressureHead: 'open-leading-scoop',
      pfxWindBeamPressureVolume: 'tail-to-front-gust-envelope',
      pfxWindBeamPressureGroundWakeCount: 2,
      pfxWindBeamPressureGroundWakeSections: 5,
      pfxWindBeamPressureGroundWakeEdgeBreakup: true,
      pfxWindBeamPressureGroundWakeAxialMerge: true,
      pfxWindBeamPressureCoreTreatment: 'striated-translucent-air',
      pfxWindBeamPressureGroundWakeMaterial: 'cool-feathered-air-shear',
      pfxWindBeamPressureGroundWakeTopology: 'folded-feathered-pressure-sheets',
      pfxWindBeamPressureGroundWakeFlatPlaceholderCount: 0,
      pfxWindBeamPressureAxialSupportProfile: 'open-directional-slashes',
      pfxWindBeamPressureTemporalSilhouette: 'compressed-surge-scattered-recovery',
      pfxWindBeamPressureTailConvergenceRatio: 0.18,
      pfxWindBeamPressureSingleSided: true,
      pfxWindBeamPressureGroundWakeUpwardWinding: true,
      pfxWindBeamPressureGroundWakeMaxHalfWidth: 0.15,
      pfxWindBeamPressureCompressedOnsetVolume: 0.65,
      pfxWindBeamPressurePeakOccupancy: 'four-varied-strands-with-integrated-debris',
      pfxWindBeamPressureRecoveryWispCount: 2,
    })
    expect(pressureGeometry.userData['pfxWindBeamPressureMaxAxialDepthDrift']).toBeGreaterThanOrEqual(0.85)
    expect(pressureGeometry.userData['pfxWindBeamPressureMaxAxialDepthDrift']).toBeLessThanOrEqual(1.05)
    expect(pressureGeometry.boundingBox!.max.x - pressureGeometry.boundingBox!.min.x).toBeGreaterThanOrEqual(3.6)
    expect(pressureGeometry.boundingBox!.max.y - pressureGeometry.boundingBox!.min.y).toBeGreaterThanOrEqual(1.3)
    expect(pressureGeometry.userData['pfxWindBeamPressureHeightSpan']).toBeGreaterThanOrEqual(1.3)
    expect(pressureGeometry.userData['pfxWindBeamPressureArcScaleRange']).toBeGreaterThanOrEqual(1)
    expect(pressureGeometry.userData['pfxWindBeamPressureHeadTailRadiusRatio']).toBeGreaterThanOrEqual(1.5)
    expect(pressureGeometry.userData['pfxWindBeamPressureMaxHarmonicDepth']).toBeGreaterThanOrEqual(0.025)
    expect(pressureGeometry.userData['pfxWindBeamPressureMaxHarmonicDepth']).toBeLessThanOrEqual(0.035)
    expect(pressureGeometry.boundingBox!.max.z - pressureGeometry.boundingBox!.min.z).toBeGreaterThanOrEqual(1.3)
    pressureGeometry.dispose()

    expect(pressureGeometry.userData['pfxWindBeamPressureTriangleCount']).toBeLessThanOrEqual(1200)
    const pressureMaterial = PfxLibrary.createPfxWindBeamPressureMaterial(pressure!.opacity, '#d8fff4', '#b8e6ff', 0.58, 0.52)
    expect(pressureMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(pressureMaterial.blending).toBe(THREE.NormalBlending)
    expect(pressureMaterial.side).toBe(THREE.FrontSide)
    expect(pressureMaterial.fragmentShader).toContain('pressureRibbon')
    expect(pressureMaterial.fragmentShader).toContain('heroRibbon')
    expect(pressureMaterial.fragmentShader).toContain('turbulentRibbon')
    expect(pressureMaterial.fragmentShader).toContain('energyFalloff')
    expect(pressureMaterial.fragmentShader).toContain('smoothFacetResponse')
    expect(pressureMaterial.fragmentShader).toContain('ribbonInteriorGradient')
    expect(pressureMaterial.fragmentShader).toContain('ribbonStriation')
    expect(pressureMaterial.fragmentShader).toContain('longitudinalColor')
    expect(pressureMaterial.fragmentShader).toContain('desaturatedSkyGradient')
    expect(pressureMaterial.fragmentShader).toContain('neutralAirGradient')
    expect(pressureMaterial.fragmentShader).toContain('strandVolumeLight')
    expect(pressureMaterial.fragmentShader).toContain('strandDepthContrast')
    expect(pressureMaterial.fragmentShader).toContain('motionBlurHighlight')
    expect(pressureMaterial.fragmentShader).toContain('airShearEdge')
    expect(pressureMaterial.fragmentShader).toContain('laneTemperature')
    expect(pressureMaterial.fragmentShader).toContain('strandKeyHighlight')
    expect(pressureMaterial.fragmentShader).toContain('laneHierarchy')
    expect(pressureMaterial.fragmentShader).toContain('laneContrast')
    expect(pressureMaterial.fragmentShader).toContain('strandRimHighlight')
    expect(pressureMaterial.fragmentShader).toContain('strandSpecular')
    expect(pressureMaterial.fragmentShader).toContain('heroCrestHighlight')
    expect(pressureMaterial.fragmentShader).toContain('heroBladeSuppression')
    expect(pressureMaterial.fragmentShader).toContain('subordinateShell')
    expect(pressureMaterial.fragmentShader).toContain('controlledPressureColor')
    expect(pressureMaterial.fragmentShader).toContain('secondaryLuminanceFloor')
    expect(pressureMaterial.fragmentShader).toContain('featheredGroundShear')
    expect(pressureMaterial.userData['pfxWindBeamPressureMaterialProfile']).toBe('crisp-hero-over-quiet-shell')
    expect(pressureMaterial.userData['pfxWindBeamPressureLuminanceFloor']).toBeGreaterThanOrEqual(1.18)
    expect(pressureMaterial.userData['pfxWindBeamPressureContrastBoost']).toBeGreaterThanOrEqual(1.7)
    expect(pressureMaterial.userData['pfxWindBeamPressureHeroAlphaFloor']).toBeGreaterThanOrEqual(0.62)
    expect(pressureMaterial.userData['pfxWindBeamPressureMotionHighlight']).toBe(true)
    expect(pressureMaterial.userData['pfxWindBeamPressureAxialRimBoost']).toBeGreaterThanOrEqual(0.35)
    expect(pressureMaterial.userData['pfxWindBeamPressureGroundOpacityCap']).toBeLessThanOrEqual(0.18)
    expect(pressureMaterial.userData['pfxWindBeamPressureShellOpacityCap']).toBeLessThanOrEqual(0.015)
    expect(pressureMaterial.userData['pfxWindBeamPressureHeroSecondaryAlphaRatio']).toBeGreaterThanOrEqual(2)
    expect(pressureMaterial.userData['pfxWindBeamPressureGroundDustContrast']).toBeGreaterThanOrEqual(1.5)
    expect(pressureMaterial.userData['pfxWindBeamPressureAxialVaneOpacity']).toBeGreaterThanOrEqual(0.32)
    expect(pressureMaterial.userData['pfxWindBeamPressureAnticipationBoost']).toBeGreaterThanOrEqual(1.65)
    expect(pressureMaterial.fragmentShader).toContain('tipSoftFade')
    expect(pressureMaterial.fragmentShader).toContain('frayBreakup')
    expect(pressureMaterial.fragmentShader).toContain('recoveryDissolve')
    expect(pressureMaterial.fragmentShader).toContain('laneWiseRecovery')
    expect(pressureMaterial.fragmentShader).toContain('cleanDecayEnvelope')
    expect(pressureMaterial.fragmentShader).toContain('flowFade')
    expect(pressureMaterial.fragmentShader).toContain('gustShell')
    expect(pressureMaterial.fragmentShader).toContain('turbulenceBand')
    expect(pressureMaterial.fragmentShader).toContain('shellFacetBand')
    expect(pressureMaterial.fragmentShader).toContain('shellSectorBreakup')
    expect(pressureMaterial.fragmentShader).toContain('axialRingSuppression')
    expect(pressureMaterial.fragmentShader).toContain('axialVolumeRim')
    expect(pressureMaterial.fragmentShader).toContain('groundWake')
    expect(pressureMaterial.fragmentShader).toContain('groundCrest')
    expect(pressureMaterial.fragmentShader).toContain('groundStriation')
    expect(pressureMaterial.fragmentShader).toContain('groundDustLift')
    expect(pressureMaterial.vertexShader).toContain('lifecycleReach')
    expect(pressureMaterial.vertexShader).toContain('travelFront')
    expect(pressureMaterial.vertexShader).toContain('recoveryScatter')
    expect(pressureMaterial.vertexShader).toContain('groundContactLift')
    expect(pressureMaterial.fragmentShader).toContain('directionalFlowWindow')
    expect(pressureMaterial.fragmentShader).toContain('organicStreamBreakup')
    expect(pressureMaterial.fragmentShader).toContain('mobileFastRim')
    expect(pressureMaterial.fragmentShader).toContain('leadingPressureCrest')
    expect(pressureMaterial.fragmentShader).toContain('anticipationGlow')
    expect(pressureMaterial.fragmentShader).toContain('secondaryOrder')
    expect(pressureMaterial.fragmentShader).toContain('recoveryWisp')
    expect(pressureMaterial.fragmentShader).toContain('axialPortalSuppression')
    expect(pressureMaterial.fragmentShader).toContain('axialDirectionalSlash')
    expect(pressureMaterial.fragmentShader).toContain('heroFlowDominance')
    expect(pressureMaterial.fragmentShader).toContain('axialDirectionalVane')
    expect(pressureMaterial.fragmentShader).toContain('airTurbulenceTexture')
    expect(pressureMaterial.fragmentShader).toContain('fineAirStreaks')
    expect(pressureMaterial.fragmentShader).toContain('anticipationVisibility')
    expect(pressureMaterial.userData['pfxWindBeamPressureAxialPortalSuppression']).toBe(true)
    expect(pressureMaterial.userData['pfxWindBeamPressureGroundMaterialProfile']).toBe('feathered-cool-air-shear')
    expect(pressureMaterial.userData['pfxWindBeamPressureControlBinding']).toBe('primary-secondary-density-style')
    expect(pressureMaterial.userData['pfxWindBeamPressureControlTintStrength']).toBeGreaterThanOrEqual(0.6)
    expect(pressureMaterial.userData['pfxWindBeamPressureDirectionalGradientRatio']).toBeGreaterThanOrEqual(3)
    expect(pressureMaterial.fragmentShader).not.toContain('Crescent')
    PfxLibrary.applyPfxWindBeamPressureMaterialAppearance(pressureMaterial, 0.72, 0.31)
    expect(pressureMaterial.uniforms['uOpacity']!.value).toBeCloseTo(0.72)
    expect(pressureMaterial.uniforms['uCycle']!.value).toBeCloseTo(0.31)
    pressureMaterial.dispose()

    const leafGeometry = PfxLibrary.createPfxWindBeamLeafGeometry()
    expect(leafGeometry.userData).toMatchObject({
      pfxWindBeamLeafDrawCalls: 1,
      pfxWindBeamLeafClosedFaces: true,
      pfxWindBeamLeafCount: 10,
      pfxWindBeamLeafBillboardCount: 0,
      pfxWindBeamLeafFlowAligned: true,
      pfxWindBeamLeafFlowLaneCount: 4,
      pfxWindBeamLeafPrimaryFlowLaneCount: 2,
      pfxWindBeamLeafPrimaryFlowLeafCount: 8,
      pfxWindBeamLeafProgressRange: [0.091, 0.909],
      pfxWindBeamLeafAsymmetricSilhouette: true,
      pfxWindBeamLeafSilhouetteVariantCount: 3,
      pfxWindBeamLeafPalette: 'olive-sage-rust-foliage',
      pfxWindBeamLeafSculptedNormals: true,
      pfxWindBeamLeafIntegratedContourShading: true,
      pfxWindBeamLeafCurledVolume: true,
      pfxWindBeamLeafMaxLength: 0.265,
      pfxWindBeamLeafTurbulencePhaseCount: 10,
      pfxWindBeamLeafColorVariantCount: 3,
      pfxWindBeamLeafOutlineVertexRange: [6, 8],
      pfxWindBeamLeafCuratedSilhouettes: ['aspen-heart', 'willow-lance', 'oak-round'],
      pfxWindBeamLeafAdvectionPath: 'progressive-four-lane',
      pfxWindBeamLeafBotanicalSilhouetteCue: 'notched-tapered-lobed',
    })
    expect(leafGeometry.userData['pfxWindBeamLeafMaxAxialDeviationDegrees']).toBeLessThanOrEqual(45)
    expect(leafGeometry.userData['pfxWindBeamLeafMaxLaneRadius']).toBeGreaterThanOrEqual(0.18)
    expect(leafGeometry.userData['pfxWindBeamLeafMaxLaneRadius']).toBeLessThanOrEqual(0.26)
    expect(leafGeometry.userData['pfxWindBeamLeafScaleRatio']).toBeGreaterThanOrEqual(2.4)
    expect(leafGeometry.userData['pfxWindBeamLeafThicknessRatio']).toBeGreaterThanOrEqual(0.24)
    expect(leafGeometry.userData['pfxWindBeamLeafThicknessRatio']).toBeLessThanOrEqual(0.36)
    expect(leafGeometry.userData['pfxWindBeamLeafTriangleCount']).toBeLessThanOrEqual(180)
    expect(leafGeometry.userData['pfxWindBeamLeafLengthSpan']).toBeGreaterThanOrEqual(2.8)
    expect(leafGeometry.userData['pfxWindBeamLeafHeightSpan']).toBeGreaterThanOrEqual(0.45)
    expect(leafGeometry.userData['pfxWindBeamLeafDepthSpan']).toBeGreaterThanOrEqual(0.4)
    expect(leafGeometry.getAttribute('pfxWindBeamProgress')).toBeDefined()
    expect(leafGeometry.getAttribute('pfxWindBeamSeed')).toBeDefined()
    expect(leafGeometry.getAttribute('pfxWindBeamLeafUv')).toBeDefined()
    expect(leafGeometry.getAttribute('pfxWindBeamLeafLocal')).toBeDefined()
    expect(leafGeometry.getAttribute('pfxWindBeamLeafCenter')).toBeDefined()
    leafGeometry.dispose()

    const leafMaterial = PfxLibrary.createPfxWindBeamLeafMaterial(leaves!.opacity, '#d8fff4', '#b8e6ff', 0.58, 0.52)
    expect(leafMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(leafMaterial.blending).toBe(THREE.NormalBlending)
    expect(leafMaterial.depthWrite).toBe(true)
    expect(leafMaterial.side).toBe(THREE.DoubleSide)
    expect(leafMaterial.forceSinglePass).toBe(true)
    expect(leafMaterial.vertexShader).toContain('pfxWindBeamProgress')
    expect(leafMaterial.vertexShader).toContain('helicalDrift')
    expect(leafMaterial.vertexShader).toContain('tumbleAxis')
    expect(leafMaterial.vertexShader).toContain('flowAxisTumble')
    expect(leafMaterial.vertexShader).toContain('turbulencePhaseOffset')
    expect(leafMaterial.vertexShader).toContain('flowAdvection')
    expect(leafMaterial.vertexShader).toContain('leafTravelFront')
    expect(leafMaterial.vertexShader).toContain('leafRecoveryScatter')
    expect(leafMaterial.vertexShader).toContain('vLeafProgress')
    expect(leafMaterial.fragmentShader).toContain('leafFacet')
    expect(leafMaterial.fragmentShader).toContain('leafFacetBand')
    expect(leafMaterial.fragmentShader).toContain('leafVein')
    expect(leafMaterial.fragmentShader).toContain('windIllumination')
    expect(leafMaterial.fragmentShader).toContain('matchedWindPalette')
    expect(leafMaterial.fragmentShader).toContain('leafInteriorShade')
    expect(leafMaterial.fragmentShader).toContain('leafEdgeShade')
    expect(leafMaterial.fragmentShader).toContain('airLightCoupling')
    expect(leafMaterial.fragmentShader).toContain('leafAtmosphericBlend')
    expect(leafMaterial.fragmentShader).toContain('leafRimTranslucency')
    expect(leafMaterial.fragmentShader).toContain('leafSubsurface')
    expect(leafMaterial.fragmentShader).toContain('leafColorVariety')
    expect(leafMaterial.fragmentShader).toContain('seasonalDebrisPalette')
    expect(leafMaterial.fragmentShader).toContain('leafEdgeDetail')
    expect(leafMaterial.fragmentShader).toContain('veinHighlight')
    expect(leafMaterial.fragmentShader).toContain('leafGloss')
    expect(leafMaterial.fragmentShader).toContain('curatedLeafContrast')
    expect(leafMaterial.fragmentShader).toContain('windCoupledEdgeGlow')
    expect(leafMaterial.fragmentShader).toContain('leafSilhouetteSoftness')
    expect(leafMaterial.fragmentShader).toContain('organicLeafGradient')
    expect(leafMaterial.fragmentShader).toContain('softLeafColorTransition')
    expect(leafMaterial.fragmentShader).toContain('flowLaneCoupling')
    expect(leafMaterial.fragmentShader).toContain('botanicalVeinCue')
    expect(leafMaterial.userData['pfxWindBeamLeafMaterialProfile']).toBe('sculpted-organic-gradient-debris')
    expect(leafMaterial.userData['pfxWindBeamLeafAssetProvenance']).toBe('original-procedural-closed-mesh')
    expect(leafMaterial.userData['pfxWindBeamLeafRuntimeMaxAxialDeviationDegrees']).toBeLessThanOrEqual(20)
    expect(leafMaterial.userData['pfxWindBeamLeafControlBinding']).toBe('primary-secondary-density-style')
    expect(leafMaterial.userData['pfxWindBeamLeafControlTintStrength']).toBeGreaterThanOrEqual(0.48)
    leafMaterial.dispose()

    const samples = [0.02, 0.08, 0.22, 0.5].map(PfxLibrary.createPfxWindBeamLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['compress', 'surge', 'fray', 'rest'])
    expect(samples[0]!.energy).toBeGreaterThanOrEqual(0.75)
    expect(samples[0]!.reach).toBeGreaterThanOrEqual(0.3)
    expect(samples[0]!.reach).toBeLessThanOrEqual(0.45)
    expect(samples[0]!.scatter).toBe(0)
    expect(samples[1]!.energy).toBeGreaterThanOrEqual(0.95)
    expect(samples[1]!.reach).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.energy).toBeGreaterThan(0)
    expect(samples[2]!.energy).toBeGreaterThanOrEqual(0.45)
    expect(samples[2]!.energy).toBeLessThanOrEqual(0.65)
    expect(samples[2]!.reach).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.scatter).toBeGreaterThanOrEqual(0.25)
    expect(samples[3]).toEqual({ energy: 0, reach: 0, twist: 0, scatter: 0, stage: 'rest' })
  })

  it('authors petal ambient as a one-draw field of closed sculpted blossoms with a persistent breeze loop', () => {
    const preset = createPfxPreset('petal-ambient')
    const plan = getPfxRenderPlan(preset)
    const blossoms = plan.surfaces.find((surface) => surface.phase === 'petal-ambient-sculpted-breeze')

    expect(preset.controls.color).toEqual(['#f47cab', '#ffd0c4'])
    expect(preset.controls.density).toBeGreaterThanOrEqual(0.65)
    expect(preset.implementationProfile).toBe('continuous-emitter')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(blossoms).toMatchObject({
      kind: 'impact-shards',
      role: 'volume',
      opacity: 1,
      tuning: {
        meshGeometry: 'petal-ambient-drifting-blossoms',
        meshMotion: 'drift',
        lifecycle: 'petal-ambient-breeze-loop',
        blend: 'alpha',
        colorOverride: '#f47cab',
        positionOffset: [0, -0.08, 0],
      },
    })
    expect(blossoms!.scale).toBeCloseTo(0.943)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(blossoms!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxPetalAmbientGeometry()
    expect(geometry.userData).toMatchObject({
      pfxPetalAmbientDrawCalls: 1,
      pfxPetalAmbientClosedFaces: true,
      pfxPetalAmbientBillboardCount: 0,
      pfxPetalAmbientPetalCount: 180,
      pfxPetalAmbientLoosePetalCount: 168,
      pfxPetalAmbientBlossomClusterCount: 3,
      pfxPetalAmbientClusterPetalCount: 12,
      pfxPetalAmbientBlossomCoreCount: 3,
      pfxPetalAmbientBlossomCoreGeometry: 'closed-octahedral-pollen',
      pfxPetalAmbientSilhouetteVariantCount: 6,
      pfxPetalAmbientOutlineVertexCount: 12,
      pfxPetalAmbientDepthLaneCount: 9,
      pfxPetalAmbientHeroPetalCount: 12,
      pfxPetalAmbientLooseHeroPetalCount: 15,
      pfxPetalAmbientSculptedNormals: true,
      pfxPetalAmbientCurledVolume: true,
      pfxPetalAmbientLoopOccupancy: 'continuous-staggered-fall',
      pfxPetalAmbientVerticalOccupancyBands: 4,
      pfxPetalAmbientClusterRootProfile: 'core-attached-radial-corollas',
      pfxPetalAmbientWindEnvelope: 'feathered-three-lane-swept-gust',
      pfxPetalAmbientFlowDirection: 'upper-left-to-lower-right-swept-descent',
      pfxPetalAmbientFlowLaneCount: 3,
      pfxPetalAmbientFlowLaneAllocation: '42-84-42',
      pfxPetalAmbientDensityGradient: 'connected-feathered-gust-with-dense-center-lane',
      pfxPetalAmbientSceneCoverage: 'one-feathered-swept-gust-with-layered-bands',
      pfxPetalAmbientVisibilityFacingSupport: 'world-oriented-with-limited-view-support',
      pfxPetalAmbientNotchedSilhouetteCount: 3,
      pfxPetalAmbientSilhouetteFamily: 'six-botanical-petal-variants',
      pfxPetalAmbientDistinctSilhouetteFamilyCount: 6,
      pfxPetalAmbientSilhouetteFamilyProfile: 'almond-notched-heart-curled-lobed-folded-ruffled',
      pfxPetalAmbientNotchDepthRatio: 0.28,
      pfxPetalAmbientWorldDepthOcclusion: true,
      pfxPetalAmbientOrientationModel: 'coherent-world-space-tumble',
      pfxPetalAmbientPerspectiveScaleRange: '0.90-1.05',
      pfxPetalAmbientDepthCompensatedPerspective: false,
      pfxPetalAmbientPerspectiveCueProfile: 'moderated-natural-depth-size-cue',
      pfxPetalAmbientNegativeSpaceCorridors: 1,
      pfxPetalAmbientSilhouetteAspectRange: '0.70-1.30',
      pfxPetalAmbientOccupancyScatter: 'phase-jittered-curved-gust-occupancy',
      pfxPetalAmbientFiberProfile: 'subtle-seeded-micro-fiber',
      pfxPetalAmbientBridgePetalCount: 24,
      pfxPetalAmbientBridgeProfile: 'continuous-world-space-sway-strand',
      pfxPetalAmbientPalette: 'blush-coral-cream',
      pfxPetalAmbientAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxPetalAmbientTriangleCount']).toBeLessThanOrEqual(8800)
    expect(geometry.userData['pfxPetalAmbientWidthSpan']).toBeGreaterThanOrEqual(5.2)
    expect(geometry.userData['pfxPetalAmbientHeightSpan']).toBeGreaterThanOrEqual(2.1)
    expect(geometry.userData['pfxPetalAmbientDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxPetalAmbientDepthLaneSpan']).toBeGreaterThanOrEqual(3.2)
    expect(geometry.userData['pfxPetalAmbientMaxLength']).toBeLessThanOrEqual(0.09)
    expect(geometry.userData['pfxPetalAmbientMaximumProjectedHeroLength']).toBeLessThanOrEqual(0.08)
    expect(geometry.userData['pfxPetalAmbientScaleRatio']).toBeGreaterThanOrEqual(1.7)
    expect(geometry.userData['pfxPetalAmbientEffectiveScaleRatio']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxPetalAmbientMinimumBroadPetalAspectRatio']).toBeGreaterThanOrEqual(0.7)
    expect(geometry.userData['pfxPetalAmbientEdgeOnThicknessRatio']).toBeGreaterThanOrEqual(0.1)
    expect(geometry.userData['pfxPetalAmbientEdgeOnThicknessRatio']).toBeLessThanOrEqual(0.18)
    expect(geometry.userData['pfxPetalAmbientSurfaceCurvatureRatio']).toBeGreaterThanOrEqual(0.42)
    expect(geometry.userData['pfxPetalAmbientOrganicScaleMaximum']).toBeLessThanOrEqual(1.1)
    expect(geometry.userData['pfxPetalAmbientSmoothNormalFaceBlend']).toBeLessThanOrEqual(0.08)
    expect(geometry.userData['pfxPetalAmbientMinimumClusterSpacing']).toBeGreaterThanOrEqual(1.1)
    expect(geometry.userData['pfxPetalAmbientClusterPetalMaxLength']).toBeLessThanOrEqual(0.09)
    expect(geometry.userData['pfxPetalAmbientBlossomCoreRadius']).toBeLessThanOrEqual(0.05)
    expect(geometry.userData['pfxPetalAmbientFlowLaneSeparation']).toBeGreaterThanOrEqual(0.9)
    expect(geometry.getAttribute('pfxPetalAmbientFlowLane')).toBeDefined()
    expect(geometry.getAttribute('pfxPetalAmbientSidewall')).toBeDefined()
    expect(geometry.getAttribute('pfxPetalAmbientBridge')).toBeDefined()
    expect(geometry.userData['pfxPetalAmbientOnsetScale']).toBeLessThanOrEqual(0.78)
    expect(geometry.userData['pfxPetalAmbientCrestScale']).toBeGreaterThanOrEqual(1.08)
    expect(geometry.userData['pfxPetalAmbientOnsetOpacity']).toBeLessThanOrEqual(0.56)
    expect(geometry.userData['pfxPetalAmbientCrestOpacity']).toBe(1)
    geometry.dispose()

    const material = PfxLibrary.createPfxPetalAmbientMaterial(blossoms!.opacity, '#f47cab', '#ffd0c4', 0.58, 0.52)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxPetalAmbientCenter')
    expect(material.vertexShader).toContain('pfxPetalAmbientLocal')
    expect(material.vertexShader).toContain('pfxPetalAmbientSeed')
    expect(material.vertexShader).toContain('pfxPetalAmbientCluster')
    expect(material.vertexShader).toContain('staggeredFall')
    expect(material.vertexShader).toContain('breezeArc')
    expect(material.vertexShader).toContain('tumbleAngle')
    expect(material.vertexShader).toContain('blossomEddy')
    expect(material.vertexShader).toContain('densityVisibility')
    expect(material.vertexShader).toContain('wideBreezeArc')
    expect(material.vertexShader).toContain('directionalFallVector')
    expect(material.vertexShader).toContain('semanticFacingBlend')
    expect(material.vertexShader).toContain('viewBiasedPetalLocal')
    expect(material.vertexShader).toContain('organicSizeVariance')
    expect(material.vertexShader).toContain('flowLaneDirection')
    expect(material.vertexShader).toContain('decorrelatedFall')
    expect(material.vertexShader).toContain('perspectiveDepthScale')
    expect(material.vertexShader).toContain('authoredWindArc')
    expect(material.vertexShader).toContain('edgeOnSupport')
    expect(material.vertexShader).toContain('adaptiveFacingBlend')
    expect(material.vertexShader).toContain('lanePhaseOffset')
    expect(material.vertexShader).toContain('featheredPhaseJitter')
    expect(material.vertexShader).toContain('bridgeOccupancy')
    expect(material.vertexShader).toContain('bridgeCenter')
    expect(material.vertexShader).toContain('mix(0.9, 1.05, smoothstep(-9.5, -6.6, centerViewPosition.z))')
    expect(material.fragmentShader).toContain('petalVein')
    expect(material.fragmentShader).toContain('translucentRim')
    expect(material.fragmentShader).toContain('blossomPalette')
    expect(material.fragmentShader).toContain('pollenGold')
    expect(material.fragmentShader).toContain('blossomCore')
    expect(material.fragmentShader).toContain('controlledPetalPalette')
    expect(material.fragmentShader).toContain('secondaryPigmentFloor')
    expect(material.fragmentShader).toContain('depthAtmosphereCue')
    expect(material.fragmentShader).toContain('nearFarPigmentSeparation')
    expect(material.fragmentShader).toContain('softPetalTranslucency')
    expect(material.fragmentShader).toContain('branchVein')
    expect(material.fragmentShader).toContain('backlitPetalRim')
    expect(material.fragmentShader).toContain('centralFold')
    expect(material.fragmentShader).toContain('curlSide')
    expect(material.fragmentShader).toContain('edgeTransmission')
    expect(material.fragmentShader).toContain('sidewallRim')
    expect(material.fragmentShader).toContain('rootToTipGradient')
    expect(material.fragmentShader).toContain('groundContactTint')
    expect(material.fragmentShader).toContain('botanicalGradient')
    expect(material.fragmentShader).toContain('petalFiber')
    expect(material.fragmentShader).toContain('silkyHighlight')
    expect(material.fragmentShader).toContain('accentCrestShimmer')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxPetalAmbientMaterial: true,
      pfxPetalAmbientMaterialProfile: 'sculpted-botanical-pigment',
      pfxPetalAmbientFragmentTranscendentalOps: 0,
      pfxPetalAmbientForceSinglePass: true,
      pfxPetalAmbientLuminanceFloor: 1.22,
      pfxPetalAmbientControlBinding: 'primary-secondary-density-style',
      pfxPetalAmbientControlTintStrength: 0.62,
      pfxPetalAmbientSecondaryPigmentFloor: 0.4,
      pfxPetalAmbientMinimumDensityVisibility: 0.32,
      pfxPetalAmbientGlossHighlightCap: 0.12,
      pfxPetalAmbientSemanticFacingBlend: 0.12,
      pfxPetalAmbientAdaptiveFacingMaximum: 0.42,
      pfxPetalAmbientVeinContrast: 0.16,
      pfxPetalAmbientCentralFoldContrast: 0.18,
      pfxPetalAmbientSidewallShadeStrength: 0.1,
      pfxPetalAmbientBacklightStrength: 0.22,
      pfxPetalAmbientPaperyAlphaMaximum: 0.82,
      pfxPetalAmbientSidewallRimStrength: 0.36,
      pfxPetalAmbientRootToTipGradientStrength: 0.58,
      pfxPetalAmbientEdgeTransmissionStrength: 0.4,
      pfxPetalAmbientFiberStrength: 0.08,
      pfxPetalAmbientSilkyHighlightStrength: 0.1,
      pfxPetalAmbientAccentCrestShimmer: 0.18,
      pfxPetalAmbientTranslucencyProfile: 'soft-fiber-backlight',
      pfxPetalAmbientDepthContrast: 1.8,
      pfxPetalAmbientCoreAccent: 'warm-peach',
    })
    PfxLibrary.applyPfxPetalAmbientMaterialAppearance(material, 0.72, 0.31)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.72)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.31)
    material.dispose()

    const samples = [0.04, 0.29, 0.54, 0.79].map(PfxLibrary.createPfxPetalAmbientLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['settle', 'lift', 'glide', 'turn'])
    expect(samples.every((sample) => sample.energy >= 0.7)).toBe(true)
    expect(samples[0]!.energy).toBeLessThanOrEqual(0.75)
    expect(samples[1]!.energy).toBeGreaterThanOrEqual(0.98)
    expect(samples[1]!.energy - samples[0]!.energy).toBeGreaterThanOrEqual(0.22)
    expect(samples[1]!.energy).toBeGreaterThan(samples[0]!.energy)
    expect(samples[1]!.energy).toBeGreaterThan(samples[2]!.energy)
    expect(new Set(samples.map((sample) => sample.drift)).size).toBe(4)
    expect(new Set(samples.map((sample) => sample.lift)).size).toBe(4)
  })

  it('authors sand burst as a three-draw grounded ballistic fan of layered dust and closed grains', () => {
    const preset = createPfxPreset('sand-burst')
    const plan = getPfxRenderPlan(preset)
    const fan = plan.surfaces.find((surface) => surface.phase === 'sand-burst-ballistic-fan')
    const dustBody = plan.surfaces.find((surface) => surface.phase === 'sand-burst-dense-dust-body')
    const groundWave = plan.surfaces.find((surface) => surface.phase === 'sand-burst-ground-impact-wave')

    expect(preset.implementationProfile).toBe('volume-cloud')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.filter((surface) => surface.kind === 'particles')).toHaveLength(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.filter((surface) => surface.kind === 'shockwave-ring')).toHaveLength(1)
    expect(fan).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 0.82,
      tuning: {
        meshGeometry: 'sand-burst-sculpted-fan',
        meshMotion: 'flash',
        lifecycle: 'sand-burst-ballistic',
        blend: 'alpha',
        colorOverride: '#d6ae6a',
        positionOffset: [0, -0.9, 0],
      },
    })
    expect(fan!.scale).toBeCloseTo(2.7025)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(fan!, 2, false)).toBe(false)
    expect(dustBody).toMatchObject({
      kind: 'particles',
      role: 'volume',
      opacity: 0.84,
      tuning: {
        motion: 'radial-burst',
        sprite: 'smoke-variants',
        blend: 'alpha',
        lifecycle: 'sand-burst-ballistic',
        colorOverride: '#d8b77f',
        ramp: 'pigment',
        positionOffset: [0, -0.9, 0],
      },
    })
    expect(groundWave).toMatchObject({
      kind: 'shockwave-ring',
      role: 'impact',
      opacity: 0.62,
      tuning: {
        meshMotion: 'shockwave',
        ringPurpose: 'shockwave',
        colorOverride: '#d2ae75',
        delay: 0.035,
        window: 0.55,
        positionOffset: [0, -0.89, 0],
      },
    })
    const peakMotion = getPfxSurfaceAnimationProps(dustBody!, preset.controls, 0.2, 1, plan.tempo, 2)
    const decayMotion = getPfxSurfaceAnimationProps(dustBody!, preset.controls, 0.58, 1, plan.tempo, 2)
    expect(decayMotion.opacityMultiplier).toBeLessThan(peakMotion.opacityMultiplier * 0.55)

    const geometry = PfxLibrary.createPfxSandBurstGeometry()
    expect(geometry.userData).toMatchObject({
      pfxSandBurstDrawCalls: 1,
      pfxSandBurstClosedFaces: true,
      pfxSandBurstBillboardCount: 0,
      pfxSandBurstGrainCount: 232,
      pfxSandBurstMicroGrainCount: 200,
      pfxSandBurstHeroGranuleCount: 32,
      pfxSandBurstGrainSizeFamilyCount: 3,
      pfxSandBurstGrainTopology: 'closed-smooth-icosahedral-sand-grit',
      pfxSandBurstGrainFaceCount: 20,
      pfxSandBurstDustLobeCount: 0,
      pfxSandBurstBackdropLobeCount: 0,
      pfxSandBurstBackdropTopology: 'none-grain-defined-volume',
      pfxSandBurstBackdropFaceCount: 0,
      pfxSandBurstDepthLaneCount: 7,
      pfxSandBurstDirectionalAxis: [0, 1, 0],
      pfxSandBurstGroundedOrigin: true,
      pfxSandBurstTrajectoryProfile: 'balanced-bounded-twelve-sector-ballistic-grit-dome',
      pfxSandBurstAzimuthSectorCount: 12,
      pfxSandBurstOriginKickGrainCount: 24,
      pfxSandBurstDustVolumeProfile: 'none-dense-closed-grit-defines-the-volume',
      pfxSandBurstDustTierCount: 0,
      pfxSandBurstDustStratumCount: 0,
      pfxSandBurstWindShearAxis: [0, 0, 0],
      pfxSandBurstGroundContactOffset: -0.9,
      pfxSandBurstVerticalPlumeProfile: 'knee-high-layered-origin-kick',
      pfxSandBurstDustTopology: 'none',
      pfxSandBurstDustFaceCount: 0,
      pfxSandBurstDustEnvelopeModel: 'view-normal-volume-fade',
      pfxSandBurstAnalyticVolumeNormals: false,
      pfxSandBurstDustShapeProfile: 'none',
      pfxSandBurstBackdropAnisotropyProfile: 'none',
      pfxSandBurstDustDistribution: 'dense-core-heavy-ballistic-grit-volume',
      pfxSandBurstDustHashProfile: 'xorshift32-independent-axes',
      pfxSandBurstGrainDensityProfile: 'core-heavy-graded-ballistic-field',
      pfxSandBurstGrainProfile: 'elongated-irregular-grit-with-subordinate-granules',
      pfxSandBurstGrainOrientation: 'velocity-aligned-soft-grit',
      pfxSandBurstDustShapeVariationAxes: 0,
      pfxSandBurstPalette: 'stratified-warm-neutral-beige-grit',
      pfxSandBurstSilhouetteProfile: 'dense-ballistic-grit-crown-with-origin-kick',
      pfxSandBurstSilhouetteLobeCount: 0,
      pfxSandBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxSandBurstTriangleCount']).toBeLessThanOrEqual(4700)
    expect(geometry.userData['pfxSandBurstPeakWidthSpan']).toBeGreaterThanOrEqual(3.6)
    expect(geometry.userData['pfxSandBurstPeakHeightSpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxSandBurstPeakDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxSandBurstMaximumGrainRadius']).toBeLessThanOrEqual(0.021)
    expect(geometry.userData['pfxSandBurstMedianMicroGrainRadius']).toBeLessThanOrEqual(0.009)
    expect(geometry.userData['pfxSandBurstMaxGrainScaleRatio']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxSandBurstDustMaximumOpacity']).toBe(0)
    expect(geometry.userData['pfxSandBurstDustMaximumLobeRadius']).toBe(0)
    expect(geometry.userData['pfxSandBurstDetailMaximumLobeRadius']).toBe(0)
    expect(geometry.userData['pfxSandBurstDustLobeSizeVariationRatio']).toBe(1)
    expect(geometry.userData['pfxSandBurstBackdropOpacityMultiplier']).toBe(0)
    expect(geometry.userData['pfxSandBurstDetailOpacityMultiplier']).toBe(0)
    expect(geometry.userData['pfxSandBurstPeakWidthToDepthRatio']).toBeGreaterThanOrEqual(1.6)
    expect(geometry.userData['pfxSandBurstDepthVelocitySpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxSandBurstSettlingResidue']).toBe(true)
    expect(geometry.userData['pfxSandBurstDissipationWindow']).toEqual([0.28, 0.69])
    expect(geometry.userData['pfxSandBurstMaximumGrainElongationRatio']).toBeLessThanOrEqual(1.6)
    expect(geometry.userData['pfxSandBurstDustAnisotropyProfile']).toBe('none')
    expect(geometry.userData['pfxSandBurstSmoothGrainNormals']).toBe(true)
    expect(geometry.getAttribute('pfxSandBurstDustEnvelope')).toBeDefined()
    expect(geometry.getAttribute('pfxSandBurstDustUv')).toBeDefined()
    expect(geometry.getAttribute('pfxSandBurstDensity')).toBeDefined()
    expect(geometry.userData['pfxSandBurstOnsetLocalScale']).toBeGreaterThanOrEqual(0.9)
    expect(geometry.userData['pfxSandBurstOnsetDustSpread']).toBeGreaterThanOrEqual(0.18)
    geometry.dispose()

    const material = PfxLibrary.createPfxSandBurstMaterial(fan!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxSandBurstVelocity')
    expect(material.vertexShader).toContain('pfxSandBurstSeed')
    expect(material.vertexShader).toContain('pfxSandBurstForm')
    expect(material.vertexShader).toContain('ballisticFan')
    expect(material.vertexShader).toContain('gravityDrop')
    expect(material.vertexShader).toContain('settlingSkid')
    expect(material.vertexShader).toContain('grainTumble')
    expect(material.vertexShader).toContain('variedDustRetire')
    expect(material.vertexShader).toContain('settlingGrainRetire')
    expect(material.vertexShader).toContain('pfxSandBurstDustEnvelope')
    expect(material.vertexShader).toContain('pfxSandBurstDensity')
    expect(material.fragmentShader).toContain('sandPalette')
    expect(material.fragmentShader).toContain('dustVeil')
    expect(material.fragmentShader).toContain('grainFacet')
    expect(material.fragmentShader).toContain('dustDensityGradient')
    expect(material.fragmentShader).toContain('dustViewDensity')
    expect(material.fragmentShader).toContain('dustGranulation')
    expect(material.fragmentShader).toContain('dustNoiseCell')
    expect(material.fragmentShader).toContain('dustAxialFade')
    expect(material.fragmentShader).toContain('dustMottle')
    expect(material.fragmentShader).toContain('dustFlowNoise')
    expect(material.fragmentShader).toContain('valueNoise')
    expect(material.fragmentShader).toContain('backdropMask')
    expect(material.fragmentShader).toContain('dustKeyLight')
    expect(material.fragmentShader).toContain('dustOcclusion')
    expect(material.fragmentShader).toContain('dustRim')
    expect(material.fragmentShader).toContain('dustLayerTint')
    expect(material.fragmentShader).toContain('layerDepth')
    expect(material.fragmentShader).toContain('dustSparkle')
    expect(material.fragmentShader).toContain('dustSparkleCell')
    expect(material.fragmentShader).toContain('vSandDensity')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxSandBurstMaterial: true,
      pfxSandBurstMaterialProfile: 'warm-granular-grit-with-soft-density-folded-dust',
      pfxSandBurstFragmentTranscendentalOps: 0,
      pfxSandBurstDustOpacityMaximum: 0,
      pfxSandBurstDustEdgeFade: true,
      pfxSandBurstDustGranulationStrength: 0.12,
      pfxSandBurstDustPigmentLift: 1.8,
      pfxSandBurstGrainPigmentLift: 1.25,
      pfxSandBurstGrainOpacityMaximum: 0.82,
      pfxSandBurstLightingProfile: 'stratified-key-lit-density-occluded-volume',
      pfxSandBurstPaleGritSparkle: true,
      pfxSandBurstGritChromaticProfile: 'warm-neutral-beige',
      pfxSandBurstMinimumDustLighting: 0.72,
      pfxSandBurstVariedDissipation: true,
      pfxSandBurstDustNoiseProfile: 'smooth-multiscale-value-noise',
      pfxSandBurstCompositingProfile: 'depth-tested-alpha-overlap-without-self-occlusion',
      pfxSandBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxSandBurstMaterialAppearance(material, 0.68, 0.31)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.68)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.31)
    material.dispose()

    const samples = [0.04, 0.18, 0.5, 0.82].map(PfxLibrary.createPfxSandBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['kick', 'fan', 'settle', 'rest'])
    expect(samples[0]!.spread).toBeLessThan(samples[1]!.spread)
    expect(samples[1]!.energy).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.settle).toBeGreaterThanOrEqual(0.35)
    expect(samples[3]).toEqual({ energy: 0, spread: 0, settle: 1, stage: 'rest' })
  })

  it('authors rain burst as a two-draw convergent downpour impact with a continuous nine-peak splash crown and integrated puddle ripples', () => {
    const preset = createPfxPreset('rain-burst')
    const plan = getPfxRenderPlan(preset)
    const water = plan.surfaces.find((surface) => surface.phase === 'rain-burst-grounded-water-crown')
    const foam = plan.surfaces.find((surface) => surface.phase === 'rain-burst-convergent-rain-foam')

    expect(preset.controls.color).toEqual(['#2d8fd3', '#c7f5ff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(water).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 1,
      tuning: {
        meshGeometry: 'rain-burst-water-crown',
        meshMotion: 'flash',
        lifecycle: 'rain-burst-impact',
        blend: 'alpha',
        colorOverride: '#2d8fd3',
        positionOffset: [0, -0.88, 0],
      },
    })
    expect(water!.scale).toBeCloseTo(0.897)
    expect(foam).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 1,
      tuning: {
        meshGeometry: 'rain-burst-rain-foam',
        meshMotion: 'flash',
        lifecycle: 'rain-burst-impact',
        blend: 'additive',
        colorOverride: '#c7f5ff',
        positionOffset: [0, -0.88, 0],
      },
    })
    expect(foam!.scale).toBeCloseTo(0.897)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(water!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(foam!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxRainBurstGeometry()
    expect(geometry.userData).toMatchObject({
      pfxRainBurstDrawCalls: 1,
      pfxRainBurstClosedFaces: true,
      pfxRainBurstWorldSpaceVolume: true,
      pfxRainBurstBillboardCount: 0,
      pfxRainBurstCrownJetCount: 0,
      pfxRainBurstCrownPeakCount: 9,
      pfxRainBurstCrownRingSegments: 72,
      pfxRainBurstContinuousCrownWall: true,
      pfxRainBurstCrownTopology: 'closed-annular-water-sheet-with-irregular-peaked-rim',
      pfxRainBurstCrownSurfacePalette: 'cohesive-smooth-water-sheet',
      pfxRainBurstCrownDiameter: 1.8,
      pfxRainBurstCrownSheetThickness: 0.12,
      pfxRainBurstPuddleLobeCount: 5,
      pfxRainBurstDomedPuddleSurface: true,
      pfxRainBurstPuddleSurfaceRingCount: 2,
      pfxRainBurstRippleBandCount: 2,
      pfxRainBurstRippleRadialSegments: 30,
      pfxRainBurstRippleCrossSectionSides: 8,
      pfxRainBurstSmoothContinuousRipples: true,
      pfxRainBurstIntegratedGroundRipples: true,
      pfxRainBurstRippleTopology: 'continuous-organic-variable-width-water-ripples',
      pfxRainBurstUniformContinuousRippleCount: 2,
      pfxRainBurstPuddleAnticipationProfile: 'smooth-directional-sheen-without-preimpact-rings',
      pfxRainBurstPuddleVertexColorProfile: 'cohesive-cool-surface-with-shader-caustics',
      pfxRainBurstDetachedDropletCount: 14,
      pfxRainBurstMistVolumeLobeCount: 3,
      pfxRainBurstMistVolumeTopology: 'closed-translucent-depth-staggered-ellipsoids',
      pfxRainBurstDropletTopology: 'closed-teardrop-volume',
      pfxRainBurstAsymmetricAzimuths: true,
      pfxRainBurstSmoothNormals: true,
      pfxRainBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxRainBurstTriangleCount']).toBeLessThanOrEqual(3_500)
    expect(geometry.userData['pfxRainBurstWidthSpan']).toBeGreaterThanOrEqual(2.6)
    expect(geometry.userData['pfxRainBurstDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(geometry.userData['pfxRainBurstHeightSpan']).toBeGreaterThanOrEqual(1.05)
    expect(geometry.getAttribute('pfxRainForm')).toBeDefined()
    expect(geometry.getAttribute('pfxRainProgress')).toBeDefined()
    expect(geometry.getAttribute('color')).toBeDefined()
    expect(geometry.getAttribute('normal')).toBeDefined()
    geometry.dispose()

    const foamGeometry = PfxLibrary.createPfxRainBurstFoamGeometry()
    expect(foamGeometry.userData).toMatchObject({
      pfxRainBurstFoamDrawCalls: 1,
      pfxRainBurstFoamClosedFaces: true,
      pfxRainBurstIncomingStreakCount: 24,
      pfxRainBurstIncomingPathStationCount: 6,
      pfxRainBurstIncomingPathProfile: 'gently-bowed-six-station-water-trails',
      pfxRainBurstIncomingParallelFall: true,
      pfxRainBurstIncomingSharedFallVector: [-0.18, -1, 0.06],
      pfxRainBurstIncomingDepthLaneCount: 6,
      pfxRainBurstIncomingConvergesAtImpact: true,
      pfxRainBurstIncomingMinimumRadius: 0.012,
      pfxRainBurstIncomingMaximumRadius: 0.036,
      pfxRainBurstIncomingSilhouetteProfileCount: 4,
      pfxRainBurstImpactContactBridge: true,
      pfxRainBurstCrownFoamStreakCount: 0,
      pfxRainBurstCrownFoamOmittedToAvoidHaloArtifacts: true,
      pfxRainBurstIncomingBulbTipCount: 0,
      pfxRainBurstGroundFoamStreakCount: 5,
      pfxRainBurstAdditiveSprayHighlightCount: 18,
      pfxRainBurstAdditiveSprayTopology: 'closed-pointed-teardrop-highlight-shells',
      pfxRainBurstAdditiveSprayShapeProfileCount: 3,
      pfxRainBurstFoamBillboardCount: 0,
      pfxRainBurstFoamTopology: 'closed-tapered-rain-and-ground-contact-foam',
    })
    expect(foamGeometry.userData['pfxRainBurstFoamTriangleCount']).toBeLessThanOrEqual(2_500)
    expect(foamGeometry.userData['pfxRainBurstIncomingDepthSpan']).toBeGreaterThanOrEqual(3)
    expect(foamGeometry.userData['pfxRainBurstIncomingWidthSpan']).toBeGreaterThanOrEqual(2)
    expect(foamGeometry.getAttribute('pfxRainForm')).toBeDefined()
    expect(foamGeometry.getAttribute('pfxRainProgress')).toBeDefined()
    foamGeometry.dispose()

    const material = PfxLibrary.createPfxRainBurstMaterial(water!.opacity, '#2d8fd3', '#c7f5ff', 0.58, 0.52)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.depthTest).toBe(false)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.fragmentShader).toContain('waterTransmission')
    expect(material.fragmentShader).toContain('crownSpecular')
    expect(material.fragmentShader).toContain('puddleDepth')
    expect(material.fragmentShader).toContain('puddleCaustic')
    expect(material.fragmentShader).toContain('puddleFresnel')
    expect(material.fragmentShader).toContain('puddleSpecularArc')
    expect(material.fragmentShader).toContain('puddleRefraction')
    expect(material.fragmentShader).toContain('coolPuddlePaletteLock')
    expect(material.fragmentShader).toContain('physicallyCoolPuddleBase')
    expect(material.fragmentShader).toContain('smoothPuddleDirectionalSheen')
    expect(material.fragmentShader).toContain('coolPuddleSpecularSweep')
    expect(material.fragmentShader).toContain('puddleSurfaceGloss')
    expect(material.fragmentShader).toContain('puddleSurfaceDetail')
    expect(material.fragmentShader).toContain('mistVolumeMass')
    expect(material.fragmentShader).toContain('peakImpactValueSeparation')
    expect(material.fragmentShader).toContain('rippleVisibilityBoost')
    expect(material.fragmentShader).toContain('dropletRim')
    expect(material.fragmentShader).toContain('sprayDropletSpecular')
    expect(material.fragmentShader).toContain('sprayDropletCaustic')
    expect(material.fragmentShader).toContain('craftedSprayDropletColor')
    expect(material.fragmentShader).toContain('controlledWaterColor')
    expect(material.fragmentShader).toContain('impactContactGlow')
    expect(material.vertexShader).toContain('pfxRainForm')
    expect(material.vertexShader).toContain('pfxRainProgress')
    expect(material.vertexShader).toContain('puddleAnticipationVisibility')
    expect(material.uniforms['uPrimaryColor']?.value.getHexString()).toBe('2d8fd3')
    expect(material.uniforms['uSecondaryColor']?.value.getHexString()).toBe('c7f5ff')
    expect(material.userData['pfxRainBurstControlBinding']).toBe('primary-secondary-density-style')
    material.dispose()

    const foamMaterial = PfxLibrary.createPfxRainBurstFoamMaterial(foam!.opacity, '#2d8fd3', '#c7f5ff', 0.58, 0.52)
    expect(foamMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(foamMaterial.depthWrite).toBe(false)
    expect(foamMaterial.side).toBe(THREE.FrontSide)
    expect(foamMaterial.fragmentShader).toContain('rainStreak')
    expect(foamMaterial.vertexShader).toContain('rainStreakReleaseEnd')
    expect(foamMaterial.fragmentShader).toContain('rainDirectionalSheen')
    expect(foamMaterial.fragmentShader).toContain('rainRefractionBand')
    expect(foamMaterial.fragmentShader).toContain('rainMicroRivulet')
    expect(foamMaterial.fragmentShader).toContain('rainFacetGlint')
    expect(foamMaterial.fragmentShader).toContain('rainDepthTint')
    expect(foamMaterial.fragmentShader).toContain('smoothLongitudinalRefraction')
    expect(foamMaterial.fragmentShader).toContain('rainTailFade')
    expect(foamMaterial.fragmentShader).toContain('rainCordSpecular')
    expect(foamMaterial.fragmentShader).toContain('rainBackscatter')
    expect(foamMaterial.fragmentShader).toContain('rainTransmission')
    expect(foamMaterial.fragmentShader).toContain('rainBurstLuminanceLift')
    expect(foamMaterial.fragmentShader).toContain('foamCrest')
    expect(foamMaterial.fragmentShader).toContain('controlledFoamColor')
    expect(foamMaterial.fragmentShader).toContain('impactContactFlash')
    expect(foamMaterial.userData['pfxRainBurstControlBinding']).toBe('primary-secondary-density-style')
    foamMaterial.dispose()

    const samples = [0.04, 0.24, 0.56, 0.92].map(PfxLibrary.createPfxRainBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['descent', 'crown', 'ripple', 'rest'])
    expect(samples[0]!.rain).toBeGreaterThan(samples[0]!.splash)
    expect(samples[1]!.splash).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.ripple).toBeGreaterThanOrEqual(0.75)
    expect(PfxLibrary.createPfxRainBurstLifecycle(0.63).splash).toBeGreaterThanOrEqual(0.85)
    expect(samples[3]).toEqual({ energy: 0, rain: 0, splash: 0, ripple: 0, stage: 'rest' })
  })

  it('authors snow burst as a two-draw three-shell radial bloom of closed six-arm crystals and crystalline powder', () => {
    const preset = createPfxPreset('snow-burst')
    const plan = getPfxRenderPlan(preset)
    const crystals = plan.surfaces.find((surface) => surface.phase === 'snow-burst-radial-crystal-bloom')
    const powder = plan.surfaces.find((surface) => surface.phase === 'snow-burst-volumetric-powder-drift')

    expect(preset.controls.color).toEqual(['#edfaff', '#5bbde8'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(crystals).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 1,
      tuning: {
        meshGeometry: 'snow-burst-crystal-bloom',
        meshMotion: 'flash',
        lifecycle: 'snow-burst-impact',
        blend: 'alpha',
        colorOverride: '#edfaff',
        positionOffset: [0, -0.28, 0],
      },
    })
    expect(powder).toMatchObject({
      kind: 'impact-shards',
      role: 'volume',
      opacity: 0.92,
      tuning: {
        meshGeometry: 'snow-burst-powder-drift',
        meshMotion: 'flash',
        lifecycle: 'snow-burst-impact',
        blend: 'additive',
        colorOverride: '#5bbde8',
        positionOffset: [0, -0.28, 0],
      },
    })
    expect(crystals!.scale).toBeCloseTo(0.943)
    expect(powder!.scale).toBeCloseTo(0.943)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(crystals!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(powder!, 2, false)).toBe(false)

    const crystalGeometry = PfxLibrary.createPfxSnowBurstCrystalGeometry()
    expect(crystalGeometry.userData).toMatchObject({
      pfxSnowBurstDrawCalls: 1,
      pfxSnowBurstClosedFaces: true,
      pfxSnowBurstWorldSpaceVolume: true,
      pfxSnowBurstBillboardCount: 0,
      pfxSnowBurstCrystalCount: 12,
      pfxSnowBurstCentralNucleusCount: 1,
      pfxSnowBurstCrystalArmCount: 6,
      pfxSnowBurstBranchedArmPairCount: 12,
      pfxSnowBurstDendriteVariantCount: 5,
      pfxSnowBurstArmLengthPatternCount: 5,
      pfxSnowBurstOrientationClassCount: 6,
      pfxSnowBurstPerpendicularDendritePlaneCount: 24,
      pfxSnowBurstSecondaryDendritePlanesPerCrystal: 2,
      pfxSnowBurstPerpendicularDendriteBranchCount: 12,
      pfxSnowBurstSecondaryPlaneScale: 0.72,
      pfxSnowBurstRadialEmitter: true,
      pfxSnowBurstDirectedUpwardFan: false,
      pfxSnowBurstRadialShellCount: 3,
      pfxSnowBurstAngularSectorCount: 12,
      pfxSnowBurstDepthLayerCount: 12,
      pfxSnowBurstOnsetVolumeSpread: 0.68,
      pfxSnowBurstTopology: 'closed-branched-six-arm-crystal-prisms',
      pfxSnowBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(crystalGeometry.userData['pfxSnowBurstTriangleCount']).toBeLessThanOrEqual(5_000)
    expect(crystalGeometry.userData['pfxSnowBurstWidthSpan']).toBeGreaterThanOrEqual(3.2)
    expect(crystalGeometry.userData['pfxSnowBurstDepthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(crystalGeometry.userData['pfxSnowBurstHeightSpan']).toBeGreaterThanOrEqual(2.4)
    expect(crystalGeometry.getAttribute('pfxSnowBurstCenter')).toBeDefined()
    expect(crystalGeometry.getAttribute('pfxSnowBurstSeed')).toBeDefined()
    expect(crystalGeometry.getAttribute('pfxSnowBurstDirection')).toBeDefined()
    expect(crystalGeometry.getAttribute('color')).toBeDefined()
    expect(crystalGeometry.getAttribute('normal')).toBeDefined()
    crystalGeometry.dispose()

    const powderGeometry = PfxLibrary.createPfxSnowBurstPowderGeometry()
    expect(powderGeometry.userData).toMatchObject({
      pfxSnowBurstPowderDrawCalls: 1,
      pfxSnowBurstPowderClosedFaces: true,
      pfxSnowBurstPowderGranuleCount: 18,
      pfxSnowBurstPowderGranuleTopology: 'closed-mini-six-arm-prism-rosettes',
      pfxSnowBurstPowderMiniRosetteArmCount: 6,
      pfxSnowBurstPowderMiniRosetteDepthSpineCount: 1,
      pfxSnowBurstPowderLobeCount: 0,
      pfxSnowBurstPowderCellsPerLobe: 0,
      pfxSnowBurstPowderCellCount: 0,
      pfxSnowBurstPowderCrystalClusterCount: 0,
      pfxSnowBurstPowderCloudLobeCount: 0,
      pfxSnowBurstPowderRadialShellCount: 3,
      pfxSnowBurstPowderAngularSectorCount: 6,
      pfxSnowBurstPowderOnsetVolumeSpread: 0.42,
      pfxSnowBurstGroundContactCount: 6,
      pfxSnowBurstGroundContactTopology: 'six-arm-grounded-prism-rosettes',
      pfxSnowBurstPowderDepthLayerCount: 6,
      pfxSnowBurstPowderBillboardCount: 0,
      pfxSnowBurstPowderTopology: 'closed-mini-rosettes-and-grounded-prism-rosettes',
    })
    expect(powderGeometry.userData['pfxSnowBurstPowderTriangleCount']).toBeLessThanOrEqual(2_000)
    expect(powderGeometry.userData['pfxSnowBurstPowderWidthSpan']).toBeGreaterThanOrEqual(2.5)
    expect(powderGeometry.userData['pfxSnowBurstPowderDepthSpan']).toBeGreaterThanOrEqual(2.6)
    expect(powderGeometry.getAttribute('pfxSnowBurstForm')).toBeDefined()
    expect(powderGeometry.getAttribute('pfxSnowBurstCenter')).toBeDefined()
    expect(powderGeometry.getAttribute('normal')).toBeDefined()
    powderGeometry.dispose()

    const crystalMaterial = PfxLibrary.createPfxSnowBurstCrystalMaterial(crystals!.opacity, '#edfaff', '#5bbde8', 0.58, 0.52)
    expect(crystalMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(crystalMaterial.blending).toBe(THREE.NormalBlending)
    expect(crystalMaterial.depthWrite).toBe(false)
    expect(crystalMaterial.depthTest).toBe(false)
    expect(crystalMaterial.side).toBe(THREE.FrontSide)
    expect(crystalMaterial.vertexShader).toContain('burstExpansion')
    expect(crystalMaterial.vertexShader).toContain('gravityDrift')
    expect(crystalMaterial.vertexShader).toContain('groundSeekingDrift')
    expect(crystalMaterial.fragmentShader).toContain('crystalFacet')
    expect(crystalMaterial.fragmentShader).toContain('frostRim')
    expect(crystalMaterial.fragmentShader).toContain('prismaticGlint')
    expect(crystalMaterial.fragmentShader).toContain('deepIceFacet')
    expect(crystalMaterial.fragmentShader).toContain('prismaticHueShift')
    expect(crystalMaterial.fragmentShader).toContain('accentCrystal')
    expect(crystalMaterial.fragmentShader).toContain('vCrystalDepthCue')
    expect(crystalMaterial.fragmentShader).toContain('heroCrystalHighlight')
    expect(crystalMaterial.fragmentShader).toContain('centralNucleusHighlight')
    expect(crystalMaterial.fragmentShader).toContain('decayIceRadiance')
    expect(crystalMaterial.fragmentShader).toContain('cleanCrystalFade')
    expect(crystalMaterial.fragmentShader).toContain('onsetBrightness')
    expect(crystalMaterial.fragmentShader).toContain('onsetReadability')
    expect(crystalMaterial.fragmentShader).toContain('controlledCrystalColor')
    expect(crystalMaterial.userData['pfxSnowBurstControlBinding']).toBe('primary-secondary-density-style')
    crystalMaterial.dispose()

    const powderMaterial = PfxLibrary.createPfxSnowBurstPowderMaterial(powder!.opacity, '#edfaff', '#5bbde8', 0.58, 0.52)
    expect(powderMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(powderMaterial.depthWrite).toBe(false)
    expect(powderMaterial.depthTest).toBe(false)
    expect(powderMaterial.fragmentShader).toContain('powderVolume')
    expect(powderMaterial.vertexShader).toContain('powderOnsetVolumeSpread')
    expect(powderMaterial.vertexShader).toContain('powderGroundSeekingDrift')
    expect(powderMaterial.fragmentShader).toContain('powderBackscatter')
    expect(powderMaterial.fragmentShader).toContain('granuleGlint')
    expect(powderMaterial.fragmentShader).toContain('groundContactRadiance')
    expect(powderMaterial.fragmentShader).toContain('decayCrystalReadability')
    expect(powderMaterial.fragmentShader).toContain('controlledPowderColor')
    expect(powderMaterial.userData['pfxSnowBurstControlBinding']).toBe('primary-secondary-density-style')
    powderMaterial.dispose()

    const samples = [0.04, 0.22, 0.58, 0.94].map(PfxLibrary.createPfxSnowBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['compress', 'burst', 'drift', 'rest'])
    expect(samples[0]!.compression).toBeGreaterThan(samples[0]!.spread)
    expect(samples[1]!.spread).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.powder).toBeGreaterThanOrEqual(0.55)
    expect(samples[3]).toEqual({ energy: 0, compression: 0, spread: 0, powder: 0, stage: 'rest' })
  })

  it('authors wind burst as a two-draw directional pressure rosette with closed helical gust bodies and vapor wisps', () => {
    const preset = createPfxPreset('wind-burst')
    const plan = getPfxRenderPlan(preset)
    const gust = plan.surfaces.find((surface) => surface.phase === 'wind-burst-helical-pressure-rosette')
    const wake = plan.surfaces.find((surface) => surface.phase === 'wind-burst-curved-vapor-wisps')

    expect(preset.controls.color).toEqual(['#dff9ff', '#72cde8'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(gust).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 1,
      tuning: {
        meshGeometry: 'wind-burst-pressure-rosette',
        meshMotion: 'flash',
        lifecycle: 'wind-burst-release',
        blend: 'alpha',
        colorOverride: '#dff9ff',
        positionOffset: [-1.02, 0, 0],
      },
    })
    expect(wake).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 0.94,
      tuning: {
        meshGeometry: 'wind-burst-wake-wisps',
        meshMotion: 'flash',
        lifecycle: 'wind-burst-release',
        blend: 'additive',
        colorOverride: '#72cde8',
        positionOffset: [-1.02, 0, 0],
      },
    })
    expect(gust!.scale).toBeCloseTo(1.035)
    expect(wake!.scale).toBeCloseTo(1.035)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(gust!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(wake!, 2, false)).toBe(false)

    const gustGeometry = PfxLibrary.createPfxWindBurstPressureGeometry()
    expect(gustGeometry.userData).toMatchObject({
      pfxWindBurstDrawCalls: 1,
      pfxWindBurstClosedFaces: true,
      pfxWindBurstWorldSpaceVolume: true,
      pfxWindBurstBillboardCount: 0,
      pfxWindBurstGustBodyCount: 9,
      pfxWindBurstPathStationCount: 9,
      pfxWindBurstCrossSectionSides: 8,
      pfxWindBurstDepthLaneCount: 9,
      pfxWindBurstAxialPressureCore: true,
      pfxWindBurstDirectionalAxis: [1, 0.08, 0],
      pfxWindBurstTopology: 'closed-tapered-helical-airfoil-tubes',
      pfxWindBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(gustGeometry.userData['pfxWindBurstTriangleCount']).toBeLessThanOrEqual(2_000)
    expect(gustGeometry.userData['pfxWindBurstWidthSpan']).toBeGreaterThanOrEqual(3.5)
    expect(gustGeometry.userData['pfxWindBurstDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(gustGeometry.userData['pfxWindBurstHeightSpan']).toBeGreaterThanOrEqual(2.2)
    expect(gustGeometry.getAttribute('pfxWindBurstAnchor')).toBeDefined()
    expect(gustGeometry.getAttribute('pfxWindBurstSeed')).toBeDefined()
    expect(gustGeometry.getAttribute('pfxWindBurstLane')).toBeDefined()
    expect(gustGeometry.getAttribute('normal')).toBeDefined()
    gustGeometry.dispose()

    const wakeGeometry = PfxLibrary.createPfxWindBurstWakeGeometry()
    expect(wakeGeometry.userData).toMatchObject({
      pfxWindBurstWakeDrawCalls: 1,
      pfxWindBurstWakeClosedFaces: true,
      pfxWindBurstWakeWispCount: 18,
      pfxWindBurstWakeDepthLaneCount: 6,
      pfxWindBurstWakeBillboardCount: 0,
      pfxWindBurstWakePathStationCount: 5,
      pfxWindBurstWakeCrossSectionSides: 6,
      pfxWindBurstWakeTopology: 'closed-tapered-curved-vapor-tubes',
    })
    expect(wakeGeometry.userData['pfxWindBurstWakeTriangleCount']).toBeLessThanOrEqual(1_200)
    expect(wakeGeometry.userData['pfxWindBurstWakeWidthSpan']).toBeGreaterThanOrEqual(3.2)
    expect(wakeGeometry.userData['pfxWindBurstWakeDepthSpan']).toBeGreaterThanOrEqual(2.0)
    expect(wakeGeometry.getAttribute('pfxWindBurstAnchor')).toBeDefined()
    expect(wakeGeometry.getAttribute('pfxWindBurstSeed')).toBeDefined()
    wakeGeometry.dispose()

    const gustMaterial = PfxLibrary.createPfxWindBurstPressureMaterial(gust!.opacity, '#dff9ff', '#72cde8', 0.58, 0.52)
    expect(gustMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(gustMaterial.blending).toBe(THREE.NormalBlending)
    expect(gustMaterial.depthWrite).toBe(false)
    expect(gustMaterial.depthTest).toBe(false)
    expect(gustMaterial.side).toBe(THREE.FrontSide)
    expect(gustMaterial.vertexShader).toContain('pressureRelease')
    expect(gustMaterial.vertexShader).toContain('helicalUnfurl')
    expect(gustMaterial.fragmentShader).toContain('pressureFresnel')
    expect(gustMaterial.fragmentShader).toContain('directionalSheen')
    expect(gustMaterial.fragmentShader).toContain('compressedAirRefraction')
    expect(gustMaterial.fragmentShader).toContain('controlledWindColor')
    expect(gustMaterial.userData['pfxWindBurstControlBinding']).toBe('primary-secondary-density-style')
    gustMaterial.dispose()

    const wakeMaterial = PfxLibrary.createPfxWindBurstWakeMaterial(wake!.opacity, '#dff9ff', '#72cde8', 0.58, 0.52)
    expect(wakeMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(wakeMaterial.depthWrite).toBe(false)
    expect(wakeMaterial.depthTest).toBe(false)
    expect(wakeMaterial.fragmentShader).toContain('wakeEdgeGlint')
    expect(wakeMaterial.fragmentShader).toContain('wakeBackscatter')
    expect(wakeMaterial.fragmentShader).toContain('wakeDepthTint')
    expect(wakeMaterial.fragmentShader).toContain('controlledWakeColor')
    expect(wakeMaterial.userData['pfxWindBurstControlBinding']).toBe('primary-secondary-density-style')
    wakeMaterial.dispose()

    const samples = [0.04, 0.22, 0.56, 0.94].map(PfxLibrary.createPfxWindBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['compress', 'release', 'curl', 'rest'])
    expect(samples[0]!.compression).toBeGreaterThan(samples[0]!.release)
    expect(samples[1]!.release).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.curl).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, compression: 0, release: 0, curl: 0, stage: 'rest' })
  })

  it('authors leaf burst as a two-draw radial canopy of three closed leaf species with integrated vein glints and seed curls', () => {
    const preset = createPfxPreset('leaf-burst')
    const plan = getPfxRenderPlan(preset)
    const canopy = plan.surfaces.find((surface) => surface.phase === 'leaf-burst-three-species-canopy')
    const veins = plan.surfaces.find((surface) => surface.phase === 'leaf-burst-vein-and-seed-curls')

    expect(preset.controls.color).toEqual(['#69a83e', '#d8f29a'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(canopy).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 1,
      tuning: {
        meshGeometry: 'leaf-burst-sculpted-canopy',
        meshMotion: 'flash',
        lifecycle: 'leaf-burst-botanical-release',
        blend: 'alpha',
        colorOverride: '#69a83e',
        positionOffset: [0, -0.34, 0],
      },
    })
    expect(veins).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 0.92,
      tuning: {
        meshGeometry: 'leaf-burst-vein-seed-curls',
        meshMotion: 'flash',
        lifecycle: 'leaf-burst-botanical-release',
        blend: 'additive',
        colorOverride: '#d8f29a',
        positionOffset: [0, -0.34, 0],
      },
    })
    expect(canopy!.scale).toBeCloseTo(0.667)
    expect(veins!.scale).toBeCloseTo(0.667)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(canopy!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(veins!, 2, false)).toBe(false)

    const canopyGeometry = PfxLibrary.createPfxLeafBurstCanopyGeometry()
    expect(canopyGeometry.userData).toMatchObject({
      pfxLeafBurstDrawCalls: 1,
      pfxLeafBurstClosedFaces: true,
      pfxLeafBurstWorldSpaceVolume: true,
      pfxLeafBurstBillboardCount: 0,
      pfxLeafBurstLeafCount: 36,
      pfxLeafBurstSpeciesCount: 3,
      pfxLeafBurstSpeciesProfile: 'ovate-oak-ginkgo',
      pfxLeafBurstStemCount: 36,
      pfxLeafBurstRadialShellCount: 4,
      pfxLeafBurstAngularSectorCount: 9,
      pfxLeafBurstDepthLayerCount: 12,
      pfxLeafBurstRadialEmitter: true,
      pfxLeafBurstTopology: 'closed-sculpted-leaf-prisms-with-integrated-stems',
      pfxLeafBurstAssetProvenance: 'original-procedural-closed-mesh',
      pfxLeafBurstCrownedMidrib: true,
    })
    expect(canopyGeometry.userData['pfxLeafBurstTriangleCount']).toBeLessThanOrEqual(4_000)
    expect(canopyGeometry.userData['pfxLeafBurstWidthSpan']).toBeGreaterThanOrEqual(3.1)
    expect(canopyGeometry.userData['pfxLeafBurstDepthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(canopyGeometry.userData['pfxLeafBurstHeightSpan']).toBeGreaterThanOrEqual(2.4)
    expect(canopyGeometry.getAttribute('pfxLeafBurstCenter')).toBeDefined()
    expect(canopyGeometry.getAttribute('pfxLeafBurstSeed')).toBeDefined()
    expect(canopyGeometry.getAttribute('pfxLeafBurstDirection')).toBeDefined()
    expect(canopyGeometry.getAttribute('pfxLeafBurstForm')).toBeDefined()
    expect(canopyGeometry.getAttribute('pfxLeafBurstShell')).toBeDefined()
    expect(canopyGeometry.getAttribute('normal')).toBeDefined()
    canopyGeometry.dispose()

    const veinGeometry = PfxLibrary.createPfxLeafBurstVeinGeometry()
    expect(veinGeometry.userData).toMatchObject({
      pfxLeafBurstVeinDrawCalls: 1,
      pfxLeafBurstVeinClosedFaces: true,
      pfxLeafBurstVeinSpineCount: 36,
      pfxLeafBurstVeinBranchCount: 72,
      pfxLeafBurstSeedCurlCount: 9,
      pfxLeafBurstSeedCurlPathStationCount: 6,
      pfxLeafBurstSecondarySeedMoteCount: 12,
      pfxLeafBurstSeedPodCoreCount: 1,
      pfxLeafBurstAnticipationCore: true,
      pfxLeafBurstVeinPrimitive: 'closed-tapered-pentagonal-prisms',
      pfxLeafBurstVeinBillboardCount: 0,
      pfxLeafBurstVeinTopology: 'closed-tapered-veins-helical-seed-curls-and-seed-motes',
    })
    expect(veinGeometry.userData['pfxLeafBurstVeinTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(veinGeometry.userData['pfxLeafBurstVeinWidthSpan']).toBeGreaterThanOrEqual(3)
    expect(veinGeometry.userData['pfxLeafBurstVeinDepthSpan']).toBeGreaterThanOrEqual(2.3)
    expect(veinGeometry.getAttribute('pfxLeafBurstCenter')).toBeDefined()
    expect(veinGeometry.getAttribute('pfxLeafBurstSeed')).toBeDefined()
    expect(veinGeometry.getAttribute('pfxLeafBurstForm')).toBeDefined()
    expect(veinGeometry.getAttribute('pfxLeafBurstShell')).toBeDefined()
    veinGeometry.dispose()

    const canopyMaterial = PfxLibrary.createPfxLeafBurstCanopyMaterial(canopy!.opacity, '#69a83e', '#d8f29a', 0.58, 0.52)
    expect(canopyMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(canopyMaterial.blending).toBe(THREE.NormalBlending)
    expect(canopyMaterial.depthWrite).toBe(false)
    expect(canopyMaterial.depthTest).toBe(false)
    expect(canopyMaterial.side).toBe(THREE.FrontSide)
    expect(canopyMaterial.vertexShader).toContain('canopyRelease')
    expect(canopyMaterial.vertexShader).toContain('flutterFall')
    expect(canopyMaterial.vertexShader).toContain('decaySilhouetteLock')
    expect(canopyMaterial.vertexShader).toContain('peakRadialSeparation')
    expect(canopyMaterial.vertexShader).toContain('sustainedPeakEnvelope')
    expect(canopyMaterial.vertexShader).toContain('anticipationShellReveal')
    expect(canopyMaterial.fragmentShader).toContain('leafChlorophyll')
    expect(canopyMaterial.fragmentShader).toContain('waxyLeafSheen')
    expect(canopyMaterial.fragmentShader).toContain('speciesPigment')
    expect(canopyMaterial.fragmentShader).toContain('controlledLeafColor')
    expect(canopyMaterial.fragmentShader).toContain('decayReadabilityHold')
    expect(canopyMaterial.fragmentShader).toContain('warmDecayPigment')
    expect(canopyMaterial.userData['pfxLeafBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(canopyMaterial.userData['pfxLeafBurstMaterialProfile']).toBe('waxy-species-pigment-with-decay-readability-lock')
    canopyMaterial.dispose()

    const veinMaterial = PfxLibrary.createPfxLeafBurstVeinMaterial(veins!.opacity, '#69a83e', '#d8f29a', 0.58, 0.52)
    expect(veinMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(veinMaterial.depthWrite).toBe(false)
    expect(veinMaterial.depthTest).toBe(false)
    expect(veinMaterial.fragmentShader).toContain('veinSapGlow')
    expect(veinMaterial.fragmentShader).toContain('seedCurlGlint')
    expect(veinMaterial.fragmentShader).toContain('botanicalBackscatter')
    expect(veinMaterial.fragmentShader).toContain('controlledVeinColor')
    expect(veinMaterial.fragmentShader).toContain('anticipationCoreGlow')
    expect(veinMaterial.fragmentShader).toContain('burstSeedPodGlow')
    expect(veinMaterial.fragmentShader).toContain('botanicalSeedPodTint')
    expect(veinMaterial.userData['pfxLeafBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(veinMaterial.userData['pfxLeafBurstMaterialProfile']).toBe('additive-veins-seed-curls-and-anticipation-core')
    veinMaterial.dispose()

    const samples = [0.04, 0.22, 0.58, 0.94].map(PfxLibrary.createPfxLeafBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['bud', 'burst', 'flutter', 'rest'])
    expect(samples[0]!.bud).toBeGreaterThan(samples[0]!.spread)
    expect(samples[1]!.spread).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.flutter).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, bud: 0, spread: 0, flutter: 0, stage: 'rest' })
  })

  it('authors petal burst as a two-draw five-shell corolla of three closed petal species with curved stamens and pollen', () => {
    const preset = createPfxPreset('petal-burst')
    const plan = getPfxRenderPlan(preset)
    const corolla = plan.surfaces.find((surface) => surface.phase === 'petal-burst-three-species-corolla')
    const stamens = plan.surfaces.find((surface) => surface.phase === 'petal-burst-stamen-pollen-calyx')

    expect(preset.controls.color).toEqual(['#f48fb1', '#ffe4d6'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'screen-plane')).toBe(false)
    expect(corolla).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 1,
      tuning: {
        meshGeometry: 'petal-burst-sculpted-corolla',
        meshMotion: 'flash',
        lifecycle: 'petal-burst-botanical-bloom',
        blend: 'alpha',
        colorOverride: '#e85d9e',
        positionOffset: [0, -0.24, 0],
      },
    })
    expect(stamens).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 0.9,
      tuning: {
        meshGeometry: 'petal-burst-stamen-pollen-calyx',
        meshMotion: 'flash',
        lifecycle: 'petal-burst-botanical-bloom',
        blend: 'additive',
        colorOverride: '#ffe4d6',
        positionOffset: [0, -0.24, 0],
      },
    })
    expect(corolla!.scale).toBeCloseTo(0.621)
    expect(stamens!.scale).toBeCloseTo(0.621)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(corolla!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(stamens!, 2, false)).toBe(false)

    const corollaGeometry = PfxLibrary.createPfxPetalBurstCanopyGeometry()
    expect(corollaGeometry.userData).toMatchObject({
      pfxPetalBurstDrawCalls: 1,
      pfxPetalBurstClosedFaces: true,
      pfxPetalBurstWorldSpaceVolume: true,
      pfxPetalBurstBillboardCount: 0,
      pfxPetalBurstPetalCount: 40,
      pfxPetalBurstSpeciesCount: 3,
      pfxPetalBurstSpeciesProfile: 'heart-teardrop-ruffled',
      pfxPetalBurstRadialShellCount: 5,
      pfxPetalBurstAngularSectorCount: 8,
      pfxPetalBurstDepthLayerCount: 12,
      pfxPetalBurstCrownedMidrib: true,
      pfxPetalBurstRoundedProfiles: true,
      pfxPetalBurstMinimumDepthRatio: 0.13,
      pfxPetalBurstTopology: 'closed-sculpted-curved-petal-prisms',
      pfxPetalBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(corollaGeometry.userData['pfxPetalBurstTriangleCount']).toBeLessThanOrEqual(4_500)
    expect(corollaGeometry.userData['pfxPetalBurstWidthSpan']).toBeGreaterThanOrEqual(3.3)
    expect(corollaGeometry.userData['pfxPetalBurstDepthSpan']).toBeGreaterThanOrEqual(2.8)
    expect(corollaGeometry.userData['pfxPetalBurstHeightSpan']).toBeGreaterThanOrEqual(2.8)
    expect(corollaGeometry.getAttribute('pfxPetalBurstCenter')).toBeDefined()
    expect(corollaGeometry.getAttribute('pfxPetalBurstSeed')).toBeDefined()
    expect(corollaGeometry.getAttribute('pfxPetalBurstDirection')).toBeDefined()
    expect(corollaGeometry.getAttribute('pfxPetalBurstForm')).toBeDefined()
    expect(corollaGeometry.getAttribute('pfxPetalBurstShell')).toBeDefined()
    expect(corollaGeometry.getAttribute('normal')).toBeDefined()
    corollaGeometry.dispose()

    const stamenGeometry = PfxLibrary.createPfxPetalBurstStamenGeometry()
    expect(stamenGeometry.userData).toMatchObject({
      pfxPetalBurstStamenDrawCalls: 1,
      pfxPetalBurstStamenClosedFaces: true,
      pfxPetalBurstStamenCount: 16,
      pfxPetalBurstStamenPathStationCount: 5,
      pfxPetalBurstPollenCount: 16,
      pfxPetalBurstCalyxCoreCount: 1,
      pfxPetalBurstSepalCount: 5,
      pfxPetalBurstStamenMinimumRadius: 0.022,
      pfxPetalBurstStamenBillboardCount: 0,
      pfxPetalBurstStamenTopology: 'closed-curved-filaments-pollen-and-calyx',
    })
    expect(stamenGeometry.userData['pfxPetalBurstStamenTriangleCount']).toBeLessThanOrEqual(3_500)
    expect(stamenGeometry.getAttribute('pfxPetalBurstCenter')).toBeDefined()
    expect(stamenGeometry.getAttribute('pfxPetalBurstSeed')).toBeDefined()
    expect(stamenGeometry.getAttribute('pfxPetalBurstForm')).toBeDefined()
    expect(stamenGeometry.getAttribute('pfxPetalBurstShell')).toBeDefined()
    stamenGeometry.dispose()

    const corollaMaterial = PfxLibrary.createPfxPetalBurstCanopyMaterial(corolla!.opacity, '#f48fb1', '#ffe4d6', 0.58, 0.52)
    expect(corollaMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(corollaMaterial.blending).toBe(THREE.NormalBlending)
    expect(corollaMaterial.depthWrite).toBe(false)
    expect(corollaMaterial.depthTest).toBe(false)
    expect(corollaMaterial.side).toBe(THREE.FrontSide)
    expect(corollaMaterial.vertexShader).toContain('foldedBud')
    expect(corollaMaterial.vertexShader).toContain('multiShellAnticipation')
    expect(corollaMaterial.vertexShader).toContain('sustainedBloomEnvelope')
    expect(corollaMaterial.vertexShader).toContain('flutterFall')
    expect(corollaMaterial.fragmentShader).toContain('satinPetalSheen')
    expect(corollaMaterial.fragmentShader).toContain('subsurfaceBlush')
    expect(corollaMaterial.fragmentShader).toContain('speciesPigment')
    expect(corollaMaterial.fragmentShader).toContain('warmDecayPigment')
    expect(corollaMaterial.fragmentShader).toContain('persistentPetalPigment')
    expect(corollaMaterial.fragmentShader).toContain('budCorollaTint')
    expect(corollaMaterial.userData['pfxPetalBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(corollaMaterial.userData['pfxPetalBurstMaterialProfile']).toBe('satin-translucent-persistent-pigment-corolla')
    corollaMaterial.dispose()

    const stamenMaterial = PfxLibrary.createPfxPetalBurstStamenMaterial(stamens!.opacity, '#f48fb1', '#ffe4d6', 0.58, 0.52)
    expect(stamenMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(stamenMaterial.depthWrite).toBe(false)
    expect(stamenMaterial.depthTest).toBe(false)
    expect(stamenMaterial.vertexShader).toContain('stamenRetireBeforeDecay')
    expect(stamenMaterial.fragmentShader).toContain('stamenSapGlow')
    expect(stamenMaterial.fragmentShader).toContain('pollenGlint')
    expect(stamenMaterial.fragmentShader).toContain('calyxBloomGlow')
    expect(stamenMaterial.fragmentShader).toContain('calyxBudGlow')
    expect(stamenMaterial.fragmentShader).toContain('roseGoldFilament')
    expect(stamenMaterial.fragmentShader).toContain('controlledStamenColor')
    expect(stamenMaterial.userData['pfxPetalBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(stamenMaterial.userData['pfxPetalBurstMaterialProfile']).toBe('additive-curved-stamens-pollen-and-calyx')
    stamenMaterial.dispose()

    const samples = [0.04, 0.24, 0.62, 0.94].map(PfxLibrary.createPfxPetalBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['bud', 'bloom', 'flutter', 'rest'])
    expect(samples[0]!.bud).toBeGreaterThan(samples[0]!.spread)
    expect(samples[1]!.spread).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.flutter).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, bud: 0, spread: 0, flutter: 0, stage: 'rest' })
  })

  it('authors mud burst as a particle-first wet-clump eruption from CC0/repo references', () => {
    const preset = createPfxPreset('mud-burst')
    const plan = getPfxRenderPlan(preset)
    const sources = plan.surfaces.map((surface) => surface.tuning as Record<string, unknown>)

    expect(preset.controls.color).toEqual(['#4a3127', '#76503b', '#b08462'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.map((surface) => surface.tuning?.sprite)).toEqual(['splat', 'smoke-variants', 'debris'])
    expect(plan.surfaces.map((surface) => surface.tuning?.motion)).toEqual(['impact-burst', 'drift-cloud', 'ground-scuff'])
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'mud-burst-grounded-eruption')).toBe(true)
    expect(sources.every((source) => typeof source.referenceSource === 'string')).toBe(true)
    expect(sources.every((source) => typeof source.referenceAdaptation === 'string')).toBe(true)
    expect(sources.every((source) => ['CC0-1.0', 'repo-original', 'repo-original-and-CC0-1.0'].includes(source.referenceLicense as string))).toBe(true)
    expect(new Set(sources.map((source) => source.referenceSource)).size).toBe(3)
    expect(plan.surfaces.every((surface) => PfxLibrary.shouldApplyPfxSurfaceCameraFacing(surface, 3, false))).toBe(false)
    expect(getPfxSurfaceAnimationProps(plan.surfaces[0]!, preset.controls, 0.2).signature).toContain('mud-burst:')
  })

  it('authors slime burst as a three-layer particle-first elastic splat with bubbles and a trailing ooze cloud', () => {
    const preset = createPfxPreset('slime-burst')
    const plan = getPfxRenderPlan(preset)
    const crown = plan.surfaces.find((surface) => surface.phase === 'slime-burst-particle-sticky-contact')
    const bubbles = plan.surfaces.find((surface) => surface.phase === 'slime-burst-particle-bubble-fountain')
    const ooze = plan.surfaces.find((surface) => surface.phase === 'slime-burst-particle-ooze-cloud')

    expect(preset.controls.color).toEqual(['#2c8f45', '#b8ff75'])
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(crown).toMatchObject({ kind: 'particles', role: 'impact', tuning: { motion: 'impact-burst', sprite: 'splat', lifecycle: 'slime-burst-particle-elasticity', blend: 'alpha', colorOverride: '#3b9f52' } })
    expect(bubbles).toMatchObject({
      kind: 'particles',
      role: 'trail',
      tuning: {
        motion: 'cone-fountain',
        sprite: 'bubble',
        lifecycle: 'slime-burst-particle-elasticity',
        blend: 'alpha',
        colorOverride: '#b8ff75',
      },
    })
    expect(ooze).toMatchObject({ kind: 'particles', role: 'volume', tuning: { motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'slime-burst-particle-elasticity' } })
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(crown!, 3, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(bubbles!, 3, false)).toBe(false)

    const crownGeometry = PfxLibrary.createPfxSlimeBurstCrownGeometry()
    expect(crownGeometry.userData).toMatchObject({
      pfxSlimeBurstCrownDrawCalls: 1,
      pfxSlimeBurstCrownClosedFaces: true,
      pfxSlimeBurstCrownWorldSpaceVolume: true,
      pfxSlimeBurstSmoothNormals: true,
      pfxSlimeBurstCrownBillboardCount: 0,
      pfxSlimeBurstCoreCount: 1,
      pfxSlimeBurstPuddleLobeCount: 9,
      pfxSlimeBurstTentacleCount: 11,
      pfxSlimeBurstTipBulbCount: 11,
      pfxSlimeBurstTipProfile: 'stretched-teardrop-not-round-bulb',
      pfxSlimeBurstOnsetProfile: 'gel-bulge-before-eruption',
      pfxSlimeBurstAsymmetricFootprint: true,
      pfxSlimeBurstTopology: 'filled-gel-core-puddle-lobes-tentacles-and-tip-bulbs',
      pfxSlimeBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(crownGeometry.userData['pfxSlimeBurstCrownTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(crownGeometry.userData['pfxSlimeBurstCrownWidthSpan']).toBeGreaterThanOrEqual(2.5)
    expect(crownGeometry.userData['pfxSlimeBurstCrownDepthSpan']).toBeGreaterThanOrEqual(2.2)
    expect(crownGeometry.userData['pfxSlimeBurstCrownHeightSpan']).toBeGreaterThanOrEqual(1.7)
    expect(crownGeometry.getAttribute('pfxSlimeBurstCenter')).toBeDefined()
    expect(crownGeometry.getAttribute('pfxSlimeBurstSeed')).toBeDefined()
    expect(crownGeometry.getAttribute('pfxSlimeBurstForm')).toBeDefined()
    expect(crownGeometry.getAttribute('normal')).toBeDefined()
    crownGeometry.dispose()

    const bubbleGeometry = PfxLibrary.createPfxSlimeBurstBubbleGeometry()
    expect(bubbleGeometry.userData).toMatchObject({
      pfxSlimeBurstBubbleDrawCalls: 1,
      pfxSlimeBurstBubbleClosedFaces: true,
      pfxSlimeBurstBubbleSmoothNormals: true,
      pfxSlimeBurstBubbleCount: 18,
      pfxSlimeBurstDropletCount: 12,
      pfxSlimeBurstBubbleSizeRange: [0.075, 0.225],
      pfxSlimeBurstDepthLayerCount: 9,
      pfxSlimeBurstBubbleBillboardCount: 0,
      pfxSlimeBurstBubbleTopology: 'closed-wobble-bubbles-and-stretched-droplets',
    })
    expect(bubbleGeometry.userData['pfxSlimeBurstBubbleTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(bubbleGeometry.getAttribute('pfxSlimeBurstCenter')).toBeDefined()
    expect(bubbleGeometry.getAttribute('pfxSlimeBurstSeed')).toBeDefined()
    expect(bubbleGeometry.getAttribute('pfxSlimeBurstDirection')).toBeDefined()
    expect(bubbleGeometry.getAttribute('pfxSlimeBurstForm')).toBeDefined()
    bubbleGeometry.dispose()

    const crownMaterial = PfxLibrary.createPfxSlimeBurstCrownMaterial(crown!.opacity, '#2c8f45', '#b8ff75', 0.58, 0.52)
    expect(crownMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(crownMaterial.blending).toBe(THREE.NormalBlending)
    expect(crownMaterial.depthWrite).toBe(false)
    expect(crownMaterial.depthTest).toBe(false)
    expect(crownMaterial.side).toBe(THREE.FrontSide)
    expect(crownMaterial.vertexShader).toContain('elasticRebound')
    expect(crownMaterial.vertexShader).toContain('viscousSettle')
    expect(crownMaterial.vertexShader).toContain('preBurstBulge')
    expect(crownMaterial.vertexShader).toContain('authoredReveal')
    expect(crownMaterial.vertexShader).toContain('residueRetire')
    expect(crownMaterial.vertexShader).toContain('rapidGelRetire')
    expect(crownMaterial.fragmentShader).toContain('gelThickness')
    expect(crownMaterial.fragmentShader).toContain('wetRim')
    expect(crownMaterial.fragmentShader).toContain('subsurfaceLime')
    expect(crownMaterial.fragmentShader).toContain('tonalLayerSeparation')
    expect(crownMaterial.fragmentShader).toContain('transmissionGlow')
    expect(crownMaterial.fragmentShader).toContain('thinEdgeCaustic')
    expect(crownMaterial.fragmentShader).toContain('viscousDepthTone')
    expect(crownMaterial.userData['pfxSlimeBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(crownMaterial.userData['pfxSlimeBurstMaterialProfile']).toBe('translucent-gel-crown-with-wet-rim')
    crownMaterial.dispose()

    const bubbleMaterial = PfxLibrary.createPfxSlimeBurstBubbleMaterial(bubbles!.opacity, '#2c8f45', '#b8ff75', 0.58, 0.52)
    expect(bubbleMaterial.blending).toBe(THREE.NormalBlending)
    expect(bubbleMaterial.depthWrite).toBe(false)
    expect(bubbleMaterial.depthTest).toBe(false)
    expect(bubbleMaterial.vertexShader).toContain('bubbleRelease')
    expect(bubbleMaterial.vertexShader).toContain('stringSnapback')
    expect(bubbleMaterial.vertexShader).toContain('gravityReturn')
    expect(bubbleMaterial.fragmentShader).toContain('bubbleFresnel')
    expect(bubbleMaterial.fragmentShader).toContain('internalGelHighlight')
    expect(bubbleMaterial.fragmentShader).toContain('hollowGelCenter')
    expect(bubbleMaterial.userData['pfxSlimeBurstControlBinding']).toBe('primary-secondary-density-style')
    expect(bubbleMaterial.userData['pfxSlimeBurstMaterialProfile']).toBe('translucent-bubbles-and-stretched-droplets')
    bubbleMaterial.dispose()

    const samples = [0.04, 0.24, 0.62, 0.94].map(PfxLibrary.createPfxSlimeBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['splat', 'rebound', 'stringing', 'rest'])
    expect(samples[0]!.splat).toBeGreaterThan(samples[0]!.rebound)
    expect(samples[1]!.rebound).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.stringing).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, splat: 0, rebound: 0, stringing: 0, stage: 'rest' })
  })

  it('authors poison burst as a three-layer particle rupture distinct from slime burst', () => {
    const preset = createPfxPreset('poison-burst')
    const plan = getPfxRenderPlan(preset)
    const bloom = plan.surfaces.find((surface) => surface.phase === 'poison-burst-particle-bruised-cloud')
    const spores = plan.surfaces.find((surface) => surface.phase === 'poison-burst-particle-spore-rise')
    const splat = plan.surfaces.find((surface) => surface.phase === 'poison-burst-particle-toxic-splat')

    expect(preset.controls.color).toEqual(['#6b2a8e', '#9cff57'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(bloom).toMatchObject({
      kind: 'particles', role: 'volume', opacity: 0.82,
      tuning: { motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'poison-burst-particle-rupture', blend: 'alpha', colorOverride: '#52285f', positionOffset: [0, -0.18, 0] },
    })
    expect(spores).toMatchObject({
      kind: 'particles', role: 'trail', opacity: 0.88,
      tuning: { motion: 'column-rise', sprite: 'bubble', lifecycle: 'poison-burst-particle-rupture', blend: 'alpha', colorOverride: '#b8f25a', positionOffset: [0, -0.12, 0] },
    })
    expect(splat).toMatchObject({
      kind: 'particles', role: 'impact', opacity: 0.86,
      tuning: { motion: 'impact-burst', sprite: 'splat', lifecycle: 'poison-burst-particle-rupture', blend: 'alpha', colorOverride: '#8dbb36', positionOffset: [0, -0.14, 0] },
    })
    expect(bloom!.scale).toBeCloseTo(1.242)
    expect(spores!.scale).toBeCloseTo(1.173)
    expect(splat!.scale).toBeCloseTo(1.058)
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense)).toBe(true)

    const bloomGeometry = PfxLibrary.createPfxPoisonBurstBloomGeometry()
    expect(bloomGeometry.userData).toMatchObject({
      pfxPoisonBurstBloomDrawCalls: 1,
      pfxPoisonBurstBloomClosedFaces: true,
      pfxPoisonBurstBloomWorldSpaceVolume: true,
      pfxPoisonBurstBloomSmoothNormals: true,
      pfxPoisonBurstBloomBillboardCount: 0,
      pfxPoisonBurstCoreCount: 1,
      pfxPoisonBurstVaporLobeCount: 16,
      pfxPoisonBurstGroundLobeCount: 8,
      pfxPoisonBurstDepthLayerCount: 8,
      pfxPoisonBurstAsymmetricVolume: true,
      pfxPoisonBurstSilhouette: 'balanced-vertical-cauliflower-plume',
      pfxPoisonBurstOnsetProfile: 'readable-swollen-toxin-seed',
      pfxPoisonBurstOnsetCoreScale: 1.12,
      pfxPoisonBurstDecayProfile: 'multi-lobe-dissolution-no-isolated-core',
      pfxPoisonBurstTopology: 'welded-core-and-overlapping-toxic-vapor-lobes',
      pfxPoisonBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(bloomGeometry.userData['pfxPoisonBurstBloomTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(bloomGeometry.userData['pfxPoisonBurstBloomWidthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(bloomGeometry.userData['pfxPoisonBurstBloomDepthSpan']).toBeGreaterThanOrEqual(2.1)
    expect(bloomGeometry.userData['pfxPoisonBurstBloomHeightSpan']).toBeGreaterThanOrEqual(1.8)
    expect(bloomGeometry.getAttribute('pfxPoisonBurstCenter')).toBeDefined()
    expect(bloomGeometry.getAttribute('pfxPoisonBurstSeed')).toBeDefined()
    expect(bloomGeometry.getAttribute('pfxPoisonBurstForm')).toBeDefined()
    bloomGeometry.dispose()

    const sporeGeometry = PfxLibrary.createPfxPoisonBurstSporeGeometry()
    expect(sporeGeometry.userData).toMatchObject({
      pfxPoisonBurstSporeDrawCalls: 1,
      pfxPoisonBurstSporeClosedFaces: true,
      pfxPoisonBurstSporeSmoothNormals: true,
      pfxPoisonBurstSporeCount: 24,
      pfxPoisonBurstNeedleCount: 12,
      pfxPoisonBurstSporeDepthLayerCount: 12,
      pfxPoisonBurstSporeBillboardCount: 0,
      pfxPoisonBurstSporeTopology: 'closed-faceted-pods-and-stretched-toxin-needles',
      pfxPoisonBurstSporeAspectProfile: 'four-organic-pod-species',
    })
    expect(sporeGeometry.userData['pfxPoisonBurstSporeTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(sporeGeometry.getAttribute('pfxPoisonBurstCenter')).toBeDefined()
    expect(sporeGeometry.getAttribute('pfxPoisonBurstSeed')).toBeDefined()
    expect(sporeGeometry.getAttribute('pfxPoisonBurstDirection')).toBeDefined()
    expect(sporeGeometry.getAttribute('pfxPoisonBurstForm')).toBeDefined()
    sporeGeometry.dispose()

    const bloomMaterial = PfxLibrary.createPfxPoisonBurstBloomMaterial(bloom!.opacity, '#6b2a8e', '#9cff57', 0.58, 0.52)
    expect(bloomMaterial.blending).toBe(THREE.NormalBlending)
    expect(bloomMaterial.depthWrite).toBe(false)
    expect(bloomMaterial.depthTest).toBe(false)
    expect(bloomMaterial.side).toBe(THREE.FrontSide)
    expect(bloomMaterial.vertexShader).toContain('toxicRupture')
    expect(bloomMaterial.vertexShader).toContain('vaporDispersal')
    expect(bloomMaterial.vertexShader).toContain('rapidLobeRetire')
    expect(bloomMaterial.vertexShader).toContain('multiLobeDissolution')
    expect(bloomMaterial.fragmentShader).toContain('toxicDensity')
    expect(bloomMaterial.fragmentShader).toContain('bruisePigment')
    expect(bloomMaterial.fragmentShader).toContain('sicklyRim')
    expect(bloomMaterial.fragmentShader).toContain('solidToxicFill')
    expect(bloomMaterial.fragmentShader).toContain('toxicSeedVeins')
    expect(bloomMaterial.fragmentShader).toContain('onsetToxinPulse')
    expect(bloomMaterial.fragmentShader).toContain('filledPoisonResidue')
    expect(bloomMaterial.userData['pfxPoisonBurstMaterialProfile']).toBe('bruised-vapor-volume-with-sickly-rim')
    bloomMaterial.dispose()

    const sporeMaterial = PfxLibrary.createPfxPoisonBurstSporeMaterial(spores!.opacity, '#6b2a8e', '#9cff57', 0.58, 0.52)
    expect(sporeMaterial.blending).toBe(THREE.NormalBlending)
    expect(sporeMaterial.depthWrite).toBe(false)
    expect(sporeMaterial.depthTest).toBe(false)
    expect(sporeMaterial.vertexShader).toContain('sporeExpulsion')
    expect(sporeMaterial.vertexShader).toContain('toxicFalloff')
    expect(sporeMaterial.vertexShader).toContain('depthScatterAmplifier')
    expect(sporeMaterial.fragmentShader).toContain('sporePoreBands')
    expect(sporeMaterial.fragmentShader).toContain('toxinNeedleGlint')
    expect(sporeMaterial.userData['pfxPoisonBurstMaterialProfile']).toBe('faceted-spore-pods-and-toxin-needles')
    sporeMaterial.dispose()

    const samples = [0.04, 0.24, 0.62, 0.94].map(PfxLibrary.createPfxPoisonBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['seed', 'rupture', 'disperse', 'rest'])
    expect(samples[0]!.seed).toBeGreaterThan(samples[0]!.rupture)
    expect(samples[1]!.rupture).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.disperse).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, seed: 0, rupture: 0, disperse: 0, stage: 'rest' })
  })

  it('authors acid burst as a three-layer wet particle eruption instead of rock-like meshes', () => {
    const preset = createPfxPreset('acid-burst')
    const plan = getPfxRenderPlan(preset)
    const crown = plan.surfaces.find((surface) => surface.phase === 'acid-burst-particle-grounded-wet-scuff')
    const vapor = plan.surfaces.find((surface) => surface.phase === 'acid-burst-particle-caustic-vapor')
    const droplets = plan.surfaces.find((surface) => surface.phase === 'acid-burst-particle-droplet-column')

    expect(preset.controls.color).toEqual(['#3f9f2f', '#d9ff47'])
    expect(preset.controls.density).toBe(0.58)
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(crown).toMatchObject({
      kind: 'particles', role: 'impact', opacity: 0.92,
      tuning: { motion: 'ground-scuff', sprite: 'splat', lifecycle: 'acid-burst-particle-eruption', blend: 'alpha', colorOverride: '#557c26', positionOffset: [0, -0.32, 0] },
    })
    expect(vapor).toMatchObject({
      kind: 'particles', role: 'volume', opacity: 0.68,
      tuning: { motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'acid-burst-particle-eruption', blend: 'alpha', colorOverride: '#779b32', positionOffset: [0, -0.18, 0] },
    })
    expect(droplets).toMatchObject({
      kind: 'particles', role: 'trail', opacity: 0.84,
      tuning: { motion: 'column-rise', sprite: 'bubble', lifecycle: 'acid-burst-particle-eruption', blend: 'alpha', colorOverride: '#d3ed5a', positionOffset: [0, -0.12, 0] },
    })
    expect(crown!.scale).toBeCloseTo(1.196)
    expect(vapor!.scale).toBeCloseTo(1.357)
    expect(droplets!.scale).toBeCloseTo(0.966)
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense)).toBe(true)

    const crownGeometry = PfxLibrary.createPfxAcidBurstCrownGeometry()
    expect(crownGeometry.userData).toMatchObject({
      pfxAcidBurstCrownDrawCalls: 1,
      pfxAcidBurstCrownClosedFaces: true,
      pfxAcidBurstCrownSmoothNormals: true,
      pfxAcidBurstCrownWorldSpaceVolume: true,
      pfxAcidBurstCrownBillboardCount: 0,
      pfxAcidBurstFilledPoolCount: 1,
      pfxAcidBurstPoolVerticalThickness: 1.08,
      pfxAcidBurstGroundLobeCount: 9,
      pfxAcidBurstGroundLobeHeightRange: [0.68, 0.9],
      pfxAcidBurstPeakVerticalExtensionRatio: 1.4,
      pfxAcidBurstEdgeSpillLobeCount: 4,
      pfxAcidBurstRaisedBlisterCount: 5,
      pfxAcidBurstRaisedBlisterHeightRange: [0.4, 0.7],
      pfxAcidBurstSizzlingFoamLobeCount: 7,
      pfxAcidBurstDecayBubbleCount: 7,
      pfxAcidBurstDecayBubbleRiseRange: [0.03, 0.08],
      pfxAcidBurstDecayDetachedGeometryCount: 0,
      pfxAcidBurstResidualSpatterTrailCount: 0,
      pfxAcidBurstContactFlashCoreCount: 1,
      pfxAcidBurstOnsetFlashJetCount: 3,
      pfxAcidBurstOnsetPlumeTopology: 'three-closed-tapered-liquid-plumes',
      pfxAcidBurstOnsetPlumeColorProfile: 'acid-secondary-not-neutral-white',
      pfxAcidBurstOnsetPlumeSpreadRadius: 0.24,
      pfxAcidBurstOnsetPlumeLayout: 'front-readable-asymmetric-trident',
      pfxAcidBurstOnsetVerticalProfile: 'raised-pool-with-tall-contact-plume',
      pfxAcidBurstOnsetFootprintProfile: 'asymmetric-broken-lobe-splat',
      pfxAcidBurstTendrilCount: 13,
      pfxAcidBurstTendrilTipBulbCount: 13,
      pfxAcidBurstAsymmetricFootprint: true,
      pfxAcidBurstSilhouette: 'wide-radial-corrosive-crown-with-whip-tendrils',
      pfxAcidBurstOnsetProfile: 'bright-contact-flash-from-filled-acid-seed',
      pfxAcidBurstOnsetVisibility: 'readable-from-first-sampled-frame',
      pfxAcidBurstOnsetFootprintScale: 0.98,
      pfxAcidBurstDecayProfile: 'clean-attached-basin-after-complete-tendril-retirement',
      pfxAcidBurstDecayContrastProfile: 'luminous-active-corrosion-residue',
      pfxAcidBurstDensityProfile: 'continuous-low-default-max-element-population',
      pfxAcidBurstDensityRevealRange: [0.18, 1],
      pfxAcidBurstResidueProfile: 'overlapping-scalloped-pool-not-ring',
      pfxAcidBurstPoolThicknessProfile: 'raised-irregular-caustic-basin',
      pfxAcidBurstVerticalBasinProfile: 'five-level-faceted-central-mass',
      pfxAcidBurstTopology: 'filled-pool-overlapping-ground-lobes-and-curved-closed-tendrils',
      pfxAcidBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(crownGeometry.userData['pfxAcidBurstCrownTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(crownGeometry.userData['pfxAcidBurstCrownWidthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(crownGeometry.userData['pfxAcidBurstCrownDepthSpan']).toBeGreaterThanOrEqual(2)
    expect(crownGeometry.userData['pfxAcidBurstCrownHeightSpan']).toBeGreaterThanOrEqual(1.7)
    expect(crownGeometry.getAttribute('pfxAcidBurstCenter')).toBeDefined()
    expect(crownGeometry.getAttribute('pfxAcidBurstSeed')).toBeDefined()
    expect(crownGeometry.getAttribute('pfxAcidBurstForm')).toBeDefined()
    crownGeometry.dispose()

    const dropletGeometry = PfxLibrary.createPfxAcidBurstDropletGeometry()
    expect(dropletGeometry.userData).toMatchObject({
      pfxAcidBurstDropletDrawCalls: 1,
      pfxAcidBurstDropletClosedFaces: true,
      pfxAcidBurstDropletSmoothNormals: true,
      pfxAcidBurstDropletCount: 28,
      pfxAcidBurstMidZoneDropletCount: 6,
      pfxAcidBurstNeedleCount: 10,
      pfxAcidBurstRadialShellCount: 4,
      pfxAcidBurstDepthLayerCount: 12,
      pfxAcidBurstDropletBillboardCount: 0,
      pfxAcidBurstDropletTopology: 'closed-teardrops-and-stretched-corrosive-needles',
      pfxAcidBurstDropletAspectProfile: 'rounded-volumetric-droplets-not-cards',
    })
    expect(dropletGeometry.userData['pfxAcidBurstDropletTriangleCount']).toBeLessThanOrEqual(3_000)
    expect(dropletGeometry.getAttribute('pfxAcidBurstCenter')).toBeDefined()
    expect(dropletGeometry.getAttribute('pfxAcidBurstSeed')).toBeDefined()
    expect(dropletGeometry.getAttribute('pfxAcidBurstDirection')).toBeDefined()
    expect(dropletGeometry.getAttribute('pfxAcidBurstForm')).toBeDefined()
    dropletGeometry.dispose()

    const crownMaterial = PfxLibrary.createPfxAcidBurstCrownMaterial(crown!.opacity, '#3f9f2f', '#d9ff47', 0.58, 0.52)
    expect(crownMaterial.blending).toBe(THREE.NormalBlending)
    expect(crownMaterial.depthWrite).toBe(false)
    expect(crownMaterial.depthTest).toBe(false)
    expect(crownMaterial.side).toBe(THREE.FrontSide)
    expect(crownMaterial.vertexShader).toContain('causticEruption')
    expect(crownMaterial.vertexShader).toContain('tendrilWhip')
    expect(crownMaterial.vertexShader).toContain('gravityCollapse')
    expect(crownMaterial.vertexShader).toContain('corrosionRetire')
    expect(crownMaterial.vertexShader).toContain('persistentAcidResidue')
    expect(crownMaterial.vertexShader).toContain('completeTendrilRetirement')
    expect(crownMaterial.vertexShader).toContain('onsetExpansion')
    expect(crownMaterial.vertexShader).toContain('onsetBirth')
    expect(crownMaterial.vertexShader).toContain('authoredDensityReveal')
    expect(crownMaterial.vertexShader).toContain('residueContraction')
    expect(crownMaterial.vertexShader).toContain('impactFlashLife')
    expect(crownMaterial.vertexShader).toContain('tendrilGroundCollapse')
    expect(crownMaterial.vertexShader).toContain('groundResidueSettle')
    expect(crownMaterial.vertexShader).toContain('viscousTendrilCurl')
    expect(crownMaterial.vertexShader).toContain('onsetGroundLift')
    expect(crownMaterial.vertexShader).toContain('volumetricOnsetThickness')
    expect(crownMaterial.vertexShader).toContain('decayVolumeRetention')
    expect(crownMaterial.vertexShader).toContain('tendrilDelayedBirth')
    expect(crownMaterial.vertexShader).toContain('onsetBasinContinuity')
    expect(crownMaterial.vertexShader).toContain('attachedDecayBubbleRise')
    expect(crownMaterial.fragmentShader).toContain('acidThickness')
    expect(crownMaterial.fragmentShader).toContain('corrosiveMeniscus')
    expect(crownMaterial.fragmentShader).toContain('causticCore')
    expect(crownMaterial.fragmentShader).toContain('etchedPigmentBands')
    expect(crownMaterial.fragmentShader).toContain('onsetContactFlash')
    expect(crownMaterial.fragmentShader).toContain('wetSurfaceSheen')
    expect(crownMaterial.fragmentShader).toContain('subsurfaceAcidGlow')
    expect(crownMaterial.fragmentShader).toContain('emissiveAcidTip')
    expect(crownMaterial.fragmentShader).toContain('liquidTransmission')
    expect(crownMaterial.fragmentShader).toContain('directionalVolumeShading')
    expect(crownMaterial.fragmentShader).toContain('styleEmissiveBoost')
    expect(crownMaterial.fragmentShader).toContain('uAccentColor')
    expect(crownMaterial.fragmentShader).toContain('chemicalShimmer')
    expect(crownMaterial.fragmentShader).toContain('corrosionDissolve')
    expect(crownMaterial.fragmentShader).toContain('poolCausticFlow')
    expect(crownMaterial.fragmentShader).toContain('poolFresnel')
    expect(crownMaterial.fragmentShader).toContain('neonAccentIsolation')
    expect(crownMaterial.fragmentShader).toContain('impactFlashCore')
    expect(crownMaterial.fragmentShader).toContain('groundResidueVisibility')
    expect(crownMaterial.fragmentShader).toContain('cozyLegibilityBoost')
    expect(crownMaterial.fragmentShader).toContain('neonEmissionHalo')
    expect(crownMaterial.fragmentShader).toContain('residueHazardPulse')
    expect(crownMaterial.fragmentShader).toContain('activeResidueEmission')
    expect(crownMaterial.fragmentShader).toContain('activeResidueContrast')
    expect(crownMaterial.fragmentShader).toContain('bubblingResidueHighlight')
    expect(crownMaterial.fragmentShader).toContain('microCausticRipples')
    expect(crownMaterial.fragmentShader).toContain('toxicBubbleChromaticLock')
    expect(crownMaterial.fragmentShader).toContain('liquidPlumeChromaticLock')
    expect(crownMaterial.fragmentShader).toContain('facetedResidueContinuity')
    expect(crownMaterial.fragmentShader).toContain('facetedResidueBanding')
    expect(crownMaterial.fragmentShader).toContain('decayFacetQuantization')
    expect(crownMaterial.fragmentShader).toContain('primaryColorPostLightLock')
    expect(crownMaterial.fragmentShader).toContain('cleanDecayBasinEmission')
    expect(crownMaterial.fragmentShader).toContain('tendrilSurfaceChromaticFill')
    expect(crownMaterial.fragmentShader).toContain('translucentInternalCrossingSuppression')
    expect(crownMaterial.fragmentShader).toContain('decayPrimaryContinuity')
    expect(crownMaterial.fragmentShader).toContain('neonOuterShellEmission')
    expect(crownMaterial.userData['pfxAcidBurstMaterialProfile']).toBe('translucent-corrosive-splash-with-flowing-caustic-meniscus')
    crownMaterial.dispose()

    const neonCrownMaterial = PfxLibrary.createPfxAcidBurstCrownMaterial(crown!.opacity, '#06b6d4', '#67e8f9', 0.58, 0.9, '#22d3ee')
    expect(neonCrownMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(neonCrownMaterial.toneMapped).toBe(false)
    expect(neonCrownMaterial.userData['pfxAcidBurstNeonMaterialProfile']).toBe('additive-emissive-neon')
    neonCrownMaterial.dispose()

    const dropletMaterial = PfxLibrary.createPfxAcidBurstDropletMaterial(droplets!.opacity, '#3f9f2f', '#d9ff47', 0.58, 0.52)
    expect(dropletMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(dropletMaterial.depthWrite).toBe(false)
    expect(dropletMaterial.depthTest).toBe(false)
    expect(dropletMaterial.vertexShader).toContain('dropletExpulsion')
    expect(dropletMaterial.vertexShader).toContain('ballisticFall')
    expect(dropletMaterial.vertexShader).toContain('radialDepthScatter')
    expect(dropletMaterial.vertexShader).toContain('dropletTumble')
    expect(dropletMaterial.vertexShader).toContain('authoredDensityReveal')
    expect(dropletMaterial.vertexShader).toContain('minimumSemanticDropletFloor')
    expect(dropletMaterial.fragmentShader).toContain('hotAcidCore')
    expect(dropletMaterial.fragmentShader).toContain('dropletMeniscus')
    expect(dropletMaterial.fragmentShader).toContain('liquidTransmission')
    expect(dropletMaterial.fragmentShader).toContain('directionalVolumeShading')
    expect(dropletMaterial.fragmentShader).toContain('styleEmissiveBoost')
    expect(dropletMaterial.fragmentShader).toContain('uAccentColor')
    expect(dropletMaterial.fragmentShader).toContain('chemicalShimmer')
    expect(dropletMaterial.fragmentShader).toContain('corrosionDissolve')
    expect(dropletMaterial.fragmentShader).toContain('neonAccentIsolation')
    expect(dropletMaterial.fragmentShader).toContain('secondaryOverrideSaturation')
    expect(dropletMaterial.fragmentShader).toContain('secondaryColorPostLightLock')
    expect(dropletMaterial.userData['pfxAcidBurstMaterialProfile']).toBe('hot-caustic-teardrops-and-needle-spray')
    dropletMaterial.dispose()

    const samples = [0.04, 0.24, 0.62, 0.94].map(PfxLibrary.createPfxAcidBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['pool', 'eruption', 'collapse', 'rest'])
    expect(samples[0]!.pool).toBeGreaterThan(samples[0]!.eruption)
    expect(samples[1]!.eruption).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.collapse).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, pool: 0, eruption: 0, collapse: 0, stage: 'rest' })
  })

  it('authors healing burst as a particle-first cross and halo from CC0/repo references', () => {
    const preset = createPfxPreset('healing-burst')
    const plan = getPfxRenderPlan(preset)
    const sources = plan.surfaces.map((surface) => surface.tuning as Record<string, unknown>)

    expect(preset.controls.color).toEqual(['#37d982', '#d7f8df', '#fff0b0'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.map((surface) => surface.tuning?.motion)).toEqual(['healing-cross', 'orbit-ring', 'column-rise'])
    expect(plan.surfaces.map((surface) => surface.tuning?.sprite)).toEqual(['glow', 'glow', 'sparkle'])
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'healing-burst-restoration-release')).toBe(true)
    expect(sources.every((source) => typeof source.referenceSource === 'string')).toBe(true)
    expect(sources.every((source) => typeof source.referenceAdaptation === 'string')).toBe(true)
    expect(sources.every((source) => ['CC0-1.0', 'repo-original', 'repo-original-and-CC0-1.0'].includes(source.referenceLicense as string))).toBe(true)
    expect(new Set(sources.map((source) => source.referenceSource)).size).toBe(3)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(plan.surfaces[0]!, 3, false)).toBe(false)
    expect(getPfxSurfaceAnimationProps(plan.surfaces[0]!, preset.controls, 0.2).signature).toContain('healing-burst:')
  })

  it('authors holy burst as particle-first sun, halo, and motes from CC0/repo references', () => {
    const preset = createPfxPreset('holy-burst')
    const plan = getPfxRenderPlan(preset)
    const sources = plan.surfaces.map((surface) => surface.tuning as Record<string, unknown>)

    expect(preset.controls.color).toEqual(['#fff9e6', '#ffc83d', '#9edcff'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.tempo).toBeCloseTo(0.82)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.map((surface) => surface.tuning?.motion)).toEqual(['impact-burst', 'orbit-ring', 'column-rise'])
    expect(plan.surfaces.map((surface) => surface.tuning?.sprite)).toEqual(['sparkle', 'glow', 'sparkle'])
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'holy-burst-consecration-release')).toBe(true)
    expect(sources.every((source) => typeof source.referenceSource === 'string')).toBe(true)
    expect(sources.every((source) => typeof source.referenceAdaptation === 'string')).toBe(true)
    expect(sources.every((source) => ['CC0-1.0', 'repo-original', 'repo-original-and-CC0-1.0'].includes(source.referenceLicense as string))).toBe(true)
    expect(new Set(sources.map((source) => source.referenceSource)).size).toBe(3)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(plan.surfaces[0]!, 3, false)).toBe(false)
    expect(getPfxSurfaceAnimationProps(plan.surfaces[0]!, preset.controls, 0.2).signature).toContain('holy-burst:')
    expect(getPfxSurfaceAnimationProps(plan.surfaces[0]!, preset.controls, 0.02).scaleMultiplier).toBeGreaterThan(0.8)
  })

  it('authors curse burst as a three-layer particle malediction distinct from the curse cone', () => {
    const preset = createPfxPreset('curse-burst')
    const plan = getPfxRenderPlan(preset)
    const effigy = plan.surfaces.find((surface) => surface.phase === 'curse-burst-particle-void-knot')
    const bindings = plan.surfaces.find((surface) => surface.phase === 'curse-burst-particle-toxic-runes')
    const residue = plan.surfaces.find((surface) => surface.phase === 'curse-burst-particle-bruise-cloud')

    expect(preset.controls.color).toEqual(['#2e0249', '#a855f7', '#bef264'])
    expect(preset.controls.density).toBe(0.54)
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.tempo).toBeCloseTo(0.84)
    expect(PfxLibrary.getPfxBurstCycleSeconds(preset)).toBeGreaterThanOrEqual(1.2)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(effigy).toMatchObject({
      kind: 'particles', role: 'impact', opacity: 0.94,
      tuning: { motion: 'impact-burst', sprite: 'twirl', lifecycle: 'curse-burst-particle-malediction', blend: 'alpha', colorOverride: '#2e0249' },
    })
    expect(bindings).toMatchObject({
      kind: 'particles', role: 'trail', opacity: 0.88,
      tuning: { motion: 'radial-burst', sprite: 'rune', lifecycle: 'curse-burst-particle-malediction', blend: 'additive', colorOverride: '#a855f7' },
    })
    expect(residue).toMatchObject({ kind: 'particles', role: 'volume', tuning: { motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'curse-burst-particle-malediction' } })
    expect(effigy!.scale).toBeCloseTo(0.966)
    expect(bindings!.scale).toBeCloseTo(1.173)
    expect(residue!.scale).toBeCloseTo(1.265)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(effigy!, 2, false)).toBe(false)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(bindings!, 2, false)).toBe(false)
    expect(PfxLibrary.getPfxSurfaceAnimationProps(bindings!, preset.controls, 0.2).signature).toContain('curse-burst-particle-toxic-runes')

    const effigyGeometry = PfxLibrary.createPfxCurseBurstEffigyGeometry()
    expect(effigyGeometry.userData).toMatchObject({
      pfxCurseBurstEffigyDrawCalls: 1,
      pfxCurseBurstEffigyClosedFaces: true,
      pfxCurseBurstEffigySmoothNormals: true,
      pfxCurseBurstBillboardCount: 0,
      pfxCurseBurstSkullLobeCount: 7,
      pfxCurseBurstSkullCraniumSubdivision: 2,
      pfxCurseBurstSkullToothCount: 5,
      pfxCurseBurstAuraShellCount: 2,
      pfxCurseBurstSpectralSpineLobeCount: 3,
      pfxCurseBurstSpectralSpineJointGap: 0,
      pfxCurseBurstSpectralSpineProfile: 'connected-three-segment-crooked-taper',
      pfxCurseBurstEyeSocketCount: 4,
      pfxCurseBurstToxicEyeCount: 3,
      pfxCurseBurstCrookedHornSegmentCount: 6,
      pfxCurseBurstMaximumHornJointGap: 0,
      pfxCurseBurstRaisedCurseRunePieceCount: 5,
      pfxCurseBurstEffigyProfile: 'faceted-obsidian-skull-idol-with-seven-lobe-cranium-brow-cheekbone-mandible-silhouette-three-front-and-one-anatomical-side-recessed-sockets-three-toxic-pupils-contiguous-crooked-horns-raised-curse-rune-and-long-negative-z-spectral-spine',
      pfxCurseBurstOnsetScaleFloor: 0.66,
      pfxCurseBurstOnsetOpacityFloor: 0.46,
      pfxCurseBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(effigyGeometry.userData['pfxCurseBurstEffigyTriangleCount']).toBeLessThanOrEqual(2_000)
    expect(effigyGeometry.userData['pfxCurseBurstEffigyWidthSpan']).toBeGreaterThanOrEqual(1.8)
    expect(effigyGeometry.userData['pfxCurseBurstEffigyDepthSpan']).toBeGreaterThanOrEqual(0.8)
    expect(effigyGeometry.userData['pfxCurseBurstEffigyHeightSpan']).toBeGreaterThanOrEqual(1.7)
    expect(effigyGeometry.getAttribute('pfxCurseBurstCenter')).toBeDefined()
    expect(effigyGeometry.getAttribute('pfxCurseBurstSeed')).toBeDefined()
    expect(effigyGeometry.getAttribute('pfxCurseBurstForm')).toBeDefined()
    effigyGeometry.dispose()

    const bindingGeometry = PfxLibrary.createPfxCurseBurstBindingGeometry()
    expect(bindingGeometry.userData).toMatchObject({
      pfxCurseBurstBindingDrawCalls: 1,
      pfxCurseBurstBindingClosedFaces: true,
      pfxCurseBurstBindingSmoothNormals: true,
      pfxCurseBurstBindingBillboardCount: 0,
      pfxCurseBurstBindingAxisCount: 3,
      pfxCurseBurstBindingSegmentCount: 15,
      pfxCurseBurstChainLinkCount: 15,
      pfxCurseBurstBindingLinkInlayCount: 15,
      pfxCurseBurstBindingLinkInlayPieceCount: 30,
      pfxCurseBurstEscapedGlyphCount: 0,
      pfxCurseBurstSkewedArmCount: 3,
      pfxCurseBurstArmLinkCountProfile: '6-5-4',
      pfxCurseBurstDistinctArmLengthCount: 3,
      pfxCurseBurstMinimumVisibleLinkCount: 3,
      pfxCurseBurstDefaultVisibleLinkCount: 13,
      pfxCurseBurstMaximumVisibleLinkCount: 15,
      pfxCurseBurstDefaultVisibleInlayCount: 13,
      pfxCurseBurstCompleteRingCount: 0,
      pfxCurseBurstChainLinkRadialSegments: 5,
      pfxCurseBurstChainLinkTubularSegments: 8,
      pfxCurseBurstChainLinkAspectRatio: 1.941,
      pfxCurseBurstChainLinkTubeRadius: 0.055,
      pfxCurseBurstChainLinkSpacing: 0.28,
      pfxCurseBurstBindingStartDistance: 0.58,
      pfxCurseBurstDefaultFrontLongArmCount: 1,
      pfxCurseBurstMinimumDensityLinksPerArm: 1,
      pfxCurseBurstDefaultDensityLinksPerArm: 4,
      pfxCurseBurstMaximumDensityLinksPerArm: 6,
      pfxCurseBurstBindingProfile: 'three-asymmetric-curved-world-space-snapped-binding-whips-with-six-five-four-discrete-toxic-sigil-links',
      pfxCurseBurstRingDiscipline: 'small-interlocking-slashed-toxic-sigil-links-communicate-snapped-containment-never-gameplay-radius',
    })
    expect(bindingGeometry.userData['pfxCurseBurstBindingTriangleCount']).toBeLessThanOrEqual(2_000)
    expect(bindingGeometry.userData['pfxCurseBurstBindingPlanarBalance']).toBeGreaterThanOrEqual(0.65)
    expect(bindingGeometry.getAttribute('pfxCurseBurstCenter')).toBeDefined()
    expect(bindingGeometry.getAttribute('pfxCurseBurstSeed')).toBeDefined()
    expect(bindingGeometry.getAttribute('pfxCurseBurstDirection')).toBeDefined()
    expect(bindingGeometry.getAttribute('pfxCurseBurstForm')).toBeDefined()
    bindingGeometry.dispose()

    const effigyMaterial = PfxLibrary.createPfxCurseBurstEffigyMaterial(effigy!.opacity, '#2e0249', '#a855f7', '#bef264', 0.54, 0.66)
    expect(effigyMaterial.blending).toBe(THREE.NormalBlending)
    expect(effigyMaterial.depthWrite).toBe(false)
    expect(effigyMaterial.vertexShader).toContain('maledictionIgnition')
    expect(effigyMaterial.vertexShader).toContain('crookedHornUnfurl')
    expect(effigyMaterial.vertexShader).toContain('skullIdolContraction')
    expect(effigyMaterial.vertexShader).toContain('corruptionResolve')
    expect(effigyMaterial.vertexShader).toContain('cleanRecoveryGate')
    expect(effigyMaterial.vertexShader).toContain('curseTriggerFlash')
    expect(effigyMaterial.vertexShader).toContain('auraAnticipationGate')
    expect(effigyMaterial.fragmentShader).toContain('obsidianMalediction')
    expect(effigyMaterial.fragmentShader).toContain('raisedRuneEmission')
    expect(effigyMaterial.fragmentShader).toContain('sicklyRuneGlint')
    expect(effigyMaterial.fragmentShader).toContain('toxicEyeEmission')
    expect(effigyMaterial.fragmentShader).toContain('eyeSocketOcclusion')
    expect(effigyMaterial.fragmentShader).toContain('toxicRuneAccent')
    expect(effigyMaterial.fragmentShader).toContain('spectralSpineRim')
    expect(effigyMaterial.fragmentShader).toContain('curseAuraBloomHalo')
    expect(effigyMaterial.fragmentShader).toContain('auraEdgeFalloff')
    expect(effigyMaterial.fragmentShader).toContain('sculptedSkullSpecular')
    expect(effigyMaterial.fragmentShader).toContain('toxicToothGlint')
    expect(effigyMaterial.fragmentShader).toContain('shellChromaticSeparation')
    expect(effigyMaterial.fragmentShader).toContain('corruptionFresnel')
    effigyMaterial.dispose()

    const bindingMaterial = PfxLibrary.createPfxCurseBurstBindingMaterial(bindings!.opacity, '#2e0249', '#a855f7', '#bef264', 0.54, 0.66)
    expect(bindingMaterial.blending).toBe(THREE.NormalBlending)
    expect(bindingMaterial.depthWrite).toBe(false)
    expect(bindingMaterial.vertexShader).toContain('bindingSnap')
    expect(bindingMaterial.vertexShader).toContain('threeAxisSeparation')
    expect(bindingMaterial.vertexShader).toContain('escapedRuneAscent')
    expect(bindingMaterial.vertexShader).toContain('bindingDensityReveal')
    expect(bindingMaterial.vertexShader).toContain('structuralSlowTimingFloor')
    expect(bindingMaterial.vertexShader).toContain('bindingCleanRecoveryGate')
    expect(bindingMaterial.fragmentShader).toContain('brokenChainPulse')
    expect(bindingMaterial.fragmentShader).toContain('glyphContamination')
    expect(bindingMaterial.fragmentShader).toContain('toxicEdgeReceipt')
    expect(bindingMaterial.fragmentShader).toContain('bindingRimEmission')
    expect(bindingMaterial.fragmentShader).toContain('cursedLinkInlay')
    expect(bindingMaterial.fragmentShader).toContain('toxicTierSeparation')
    expect(bindingMaterial.fragmentShader).toContain('facetedBindingMetal')
    expect(bindingMaterial.fragmentShader).toContain('bindingFillLight')
    expect(bindingMaterial.fragmentShader).toContain('volumetricLinkCore')
    bindingMaterial.dispose()

    const samples = [0.03, 0.2, 0.58, 0.94].map(PfxLibrary.createPfxCurseBurstLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['mark', 'rupture', 'escape', 'rest'])
    expect(samples[0]!.mark).toBeGreaterThan(samples[0]!.rupture)
    expect(samples[1]!.rupture).toBeGreaterThanOrEqual(0.9)
    expect(samples[2]!.escape).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]).toEqual({ energy: 0, mark: 0, rupture: 0, escape: 0, stage: 'rest' })
  })

  it('authors shadow burst as a particle-first claw fan from CC0/repo references', () => {
    const preset = createPfxPreset('shadow-burst')
    const plan = getPfxRenderPlan(preset)
    const sources = plan.surfaces.map((surface) => surface.tuning as Record<string, unknown>)

    expect(preset.controls.color).toEqual(['#0c1019', '#44576a', '#9bb5c4'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.tempo).toBeCloseTo(0.82)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(plan.surfaces.map((surface) => surface.tuning?.motion)).toEqual(['shadow-claw', 'drift-cloud', 'impact-burst'])
    expect(plan.surfaces.map((surface) => surface.tuning?.sprite)).toEqual(['streak', 'smoke-variants', 'spark'])
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'shadow-burst-detonation')).toBe(true)
    expect(sources.every((source) => typeof source.referenceSource === 'string')).toBe(true)
    expect(sources.every((source) => typeof source.referenceAdaptation === 'string')).toBe(true)
    expect(sources.every((source) => ['CC0-1.0', 'repo-original', 'repo-original-and-CC0-1.0'].includes(source.referenceLicense as string))).toBe(true)
    expect(new Set(sources.map((source) => source.referenceSource)).size).toBe(3)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(plan.surfaces[0]!, 3, false)).toBe(false)
    expect(getPfxSurfaceAnimationProps(plan.surfaces[0]!, preset.controls, 0.2).signature).toContain('shadow-burst:')
  })

  it('authors mud charge as a one-draw helical convergence of closed clods into a compressed wet-earth core', () => {
    const preset = createPfxPreset('mud-charge')
    const plan = getPfxRenderPlan(preset)
    const convergence = plan.surfaces.find((surface) => surface.phase === 'mud-charge-particle-clod-convergence')

    expect(preset.implementationProfile).toBe('radial-burst')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(convergence).toMatchObject({
      kind: 'particles',
      role: 'body',
      opacity: 0.92,
      tuning: {
        motion: 'converge-center',
        sprite: 'debris',
        lifecycle: 'mud-charge-convergence',
        blend: 'alpha',
        colorOverride: '#8f4b22',
        randomizeAzimuth: true,
      },
    })
    expect(convergence!.scale).toBeCloseTo(1.242)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(convergence!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxMudChargeGeometry()
    expect(geometry.userData).toMatchObject({
      pfxMudChargeDrawCalls: 1,
      pfxMudChargeClosedFaces: true,
      pfxMudChargeBillboardCount: 0,
      pfxMudChargeClodCount: 14,
      pfxMudChargeCoreLobeCount: 3,
      pfxMudChargeGroundHeaveCount: 3,
      pfxMudChargeDepthLaneCount: 5,
      pfxMudChargeGroundedOrigin: true,
      pfxMudChargeSilhouetteProfile: 'helical-clods-into-compressed-trefoil-core',
      pfxMudChargePalette: 'wet-umber-clay-sunlit-earth',
      pfxMudChargeAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxMudChargeTriangleCount']).toBeLessThanOrEqual(280)
    expect(geometry.userData['pfxMudChargeGatherWidthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(geometry.userData['pfxMudChargeGatherHeightSpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxMudChargeGatherDepthSpan']).toBeGreaterThanOrEqual(1.4)
    geometry.dispose()

    const material = PfxLibrary.createPfxMudChargeMaterial(convergence!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxMudChargeAnchor')
    expect(material.vertexShader).toContain('pfxMudChargeSeed')
    expect(material.vertexShader).toContain('pfxMudChargeForm')
    expect(material.vertexShader).toContain('helicalConvergence')
    expect(material.vertexShader).toContain('compressionPulse')
    expect(material.vertexShader).toContain('groundHeave')
    expect(material.fragmentShader).toContain('clayPalette')
    expect(material.fragmentShader).toContain('wetFacet')
    expect(material.fragmentShader).toContain('packedEarth')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxMudChargeMaterial: true,
      pfxMudChargeMaterialProfile: 'wet-faceted-clods-with-packed-earth-core',
      pfxMudChargeFragmentTranscendentalOps: 0,
      pfxMudChargeAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxMudChargeMaterialAppearance(material, 0.74, 0.42)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.74)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.42)
    material.dispose()

    const samples = [0.04, 0.22, 0.52, 0.82].map(PfxLibrary.createPfxMudChargeLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['gather', 'spiral', 'compress', 'rest'])
    expect(samples[0]!.radius).toBeGreaterThan(samples[1]!.radius)
    expect(samples[1]!.radius).toBeGreaterThan(samples[2]!.radius)
    expect(samples[2]!.compression).toBeGreaterThanOrEqual(0.8)
    expect(samples[2]!.energy).toBeGreaterThanOrEqual(0.9)
    expect(samples[3]).toEqual({ energy: 0, radius: 0, compression: 1, stage: 'rest' })
  })

  it('authors slime ring as a one-draw closed viscous annulus with integrated bubble crowns', () => {
    const preset = createPfxPreset('slime-ring')
    const plan = getPfxRenderPlan(preset)
    const ring = plan.surfaces.find((surface) => surface.phase === 'slime-ring-viscous-hazard-annulus')

    expect(preset.implementationProfile).toBe('volume-cloud')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(ring).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 1,
      tuning: {
        meshGeometry: 'slime-ring-viscous-annulus',
        meshMotion: 'bloom',
        lifecycle: 'slime-ring-adhesion',
        blend: 'alpha',
        colorOverride: '#70d94b',
        positionOffset: [0, -0.72, 0],
      },
    })
    expect(ring!.scale).toBeCloseTo(1.058)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(ring!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxSlimeRingGeometry()
    expect(geometry.userData).toMatchObject({
      pfxSlimeRingDrawCalls: 1,
      pfxSlimeRingClosedFaces: true,
      pfxSlimeRingBillboardCount: 0,
      pfxSlimeRingSegmentCount: 20,
      pfxSlimeRingBubbleCrownCount: 6,
      pfxSlimeRingWorldPlane: 'xz-grounded',
      pfxSlimeRingIrregularInnerBites: true,
      pfxSlimeRingSilhouetteProfile: 'broken-viscous-annulus-with-bubble-crowns',
      pfxSlimeRingPalette: 'lime-chartreuse-deep-teal',
      pfxSlimeRingAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxSlimeRingTriangleCount']).toBeLessThanOrEqual(260)
    expect(geometry.userData['pfxSlimeRingRadialThickness']).toBeGreaterThanOrEqual(0.3)
    expect(geometry.userData['pfxSlimeRingWidthSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxSlimeRingDepthSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxSlimeRingHeightSpan']).toBeGreaterThanOrEqual(0.28)
    geometry.dispose()

    const material = PfxLibrary.createPfxSlimeRingMaterial(ring!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxSlimeRingForm')
    expect(material.vertexShader).toContain('pfxSlimeRingSeed')
    expect(material.vertexShader).toContain('viscousSpread')
    expect(material.vertexShader).toContain('stickyAdhesion')
    expect(material.vertexShader).toContain('bubbleCrown')
    expect(material.fragmentShader).toContain('slimePalette')
    expect(material.fragmentShader).toContain('wetMeniscus')
    expect(material.fragmentShader).toContain('stickyBody')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxSlimeRingMaterial: true,
      pfxSlimeRingMaterialProfile: 'wet-lime-annulus-with-integrated-bubbles',
      pfxSlimeRingFragmentTranscendentalOps: 0,
      pfxSlimeRingAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxSlimeRingMaterialAppearance(material, 0.7, 0.36)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.7)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.36)
    material.dispose()

    const samples = [0.04, 0.22, 0.5, 0.82].map(PfxLibrary.createPfxSlimeRingLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['spread', 'adhere', 'bubble', 'rest'])
    expect(samples[0]!.radius).toBeLessThan(samples[1]!.radius)
    expect(samples[1]!.adhesion).toBeGreaterThanOrEqual(0.7)
    expect(samples[2]!.bubble).toBeGreaterThanOrEqual(0.75)
    expect(samples[3]).toEqual({ energy: 0, radius: 0, adhesion: 1, bubble: 0, stage: 'rest' })
  })

  it('authors acid spawn as a one-draw corrosive aperture with rising closed acid crowns', () => {
    const preset = createPfxPreset('acid-spawn')
    const plan = getPfxRenderPlan(preset)
    const aperture = plan.surfaces.find((surface) => surface.phase === 'acid-spawn-corrosive-aperture-crown')

    expect(preset.implementationProfile).toBe('volume-cloud')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(aperture).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 1,
      tuning: {
        meshGeometry: 'acid-spawn-corrosive-aperture',
        meshMotion: 'bloom',
        lifecycle: 'acid-spawn-eruption',
        blend: 'alpha',
        colorOverride: '#73f22f',
        positionOffset: [0, -0.72, 0],
      },
    })
    expect(aperture!.scale).toBeCloseTo(1.104)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(aperture!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxAcidSpawnGeometry()
    expect(geometry.userData).toMatchObject({
      pfxAcidSpawnDrawCalls: 1,
      pfxAcidSpawnClosedFaces: true,
      pfxAcidSpawnBillboardCount: 0,
      pfxAcidSpawnPoolSegmentCount: 20,
      pfxAcidSpawnRisingCrownCount: 6,
      pfxAcidSpawnWorldPlane: 'xz-grounded',
      pfxAcidSpawnSilhouetteProfile: 'corrosive-aperture-with-asymmetric-rising-crowns',
      pfxAcidSpawnPalette: 'chartreuse-lime-toxic-teal',
      pfxAcidSpawnAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxAcidSpawnTriangleCount']).toBeLessThanOrEqual(260)
    expect(geometry.userData['pfxAcidSpawnWidthSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxAcidSpawnDepthSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxAcidSpawnPeakHeightSpan']).toBeGreaterThanOrEqual(1.1)
    geometry.dispose()

    const material = PfxLibrary.createPfxAcidSpawnMaterial(aperture!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxAcidSpawnForm')
    expect(material.vertexShader).toContain('pfxAcidSpawnSeed')
    expect(material.vertexShader).toContain('corrosiveSpread')
    expect(material.vertexShader).toContain('eruptionCrown')
    expect(material.vertexShader).toContain('drainBack')
    expect(material.fragmentShader).toContain('acidPalette')
    expect(material.fragmentShader).toContain('corrosiveMeniscus')
    expect(material.fragmentShader).toContain('toxicBody')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxAcidSpawnMaterial: true,
      pfxAcidSpawnMaterialProfile: 'corrosive-chartreuse-pool-with-rising-crowns',
      pfxAcidSpawnFragmentTranscendentalOps: 0,
      pfxAcidSpawnAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxAcidSpawnMaterialAppearance(material, 0.76, 0.34)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.76)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.34)
    material.dispose()

    const samples = [0.04, 0.2, 0.5, 0.82].map(PfxLibrary.createPfxAcidSpawnLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['seed', 'erupt', 'drain', 'rest'])
    expect(samples[0]!.aperture).toBeLessThan(samples[1]!.aperture)
    expect(samples[1]!.crown).toBeGreaterThanOrEqual(0.7)
    expect(samples[2]!.drain).toBeGreaterThanOrEqual(0.45)
    expect(samples[3]).toEqual({ energy: 0, aperture: 0, crown: 0, drain: 1, stage: 'rest' })
  })

  it('authors healing loop as a one-draw closed renewal helix with readable healing glyphs', () => {
    const preset = createPfxPreset('healing-loop')
    const plan = getPfxRenderPlan(preset)
    const renewal = plan.surfaces.find((surface) => surface.phase === 'healing-loop-renewal-helix')

    expect(preset.implementationProfile).toBe('continuous-emitter')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(renewal).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 1,
      tuning: {
        meshGeometry: 'healing-loop-renewal-helix',
        meshMotion: 'breathe',
        lifecycle: 'healing-loop-renewal',
        blend: 'alpha',
        colorOverride: '#41e985',
        positionOffset: [0, -0.72, 0],
      },
    })
    expect(renewal!.scale).toBeCloseTo(0.897)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(renewal!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxHealingLoopGeometry()
    expect(geometry.userData).toMatchObject({
      pfxHealingLoopDrawCalls: 1,
      pfxHealingLoopClosedFaces: true,
      pfxHealingLoopBillboardCount: 0,
      pfxHealingLoopBaseSegmentCount: 16,
      pfxHealingLoopStrandCount: 2,
      pfxHealingLoopStrandSegmentCount: 8,
      pfxHealingLoopGlyphCount: 4,
      pfxHealingLoopWorldPlane: 'xz-grounded',
      pfxHealingLoopSilhouetteProfile: 'sanctuary-torus-with-double-renewal-helix-and-cross-glyphs',
      pfxHealingLoopPalette: 'deep-emerald-mint-warm-renewal-gold',
      pfxHealingLoopAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxHealingLoopTriangleCount']).toBeLessThanOrEqual(520)
    expect(geometry.userData['pfxHealingLoopWidthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(geometry.userData['pfxHealingLoopDepthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(geometry.userData['pfxHealingLoopHeightSpan']).toBeGreaterThanOrEqual(1.5)
    geometry.dispose()

    const material = PfxLibrary.createPfxHealingLoopMaterial(renewal!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxHealingLoopForm')
    expect(material.vertexShader).toContain('renewalPulse')
    expect(material.vertexShader).toContain('interwovenRise')
    expect(material.fragmentShader).toContain('healingPalette')
    expect(material.fragmentShader).toContain('sanctuaryMeniscus')
    expect(material.fragmentShader).toContain('renewalBody')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxHealingLoopMaterial: true,
      pfxHealingLoopMaterialProfile: 'faceted-emerald-mint-helix-with-warm-healing-glyphs',
      pfxHealingLoopFragmentTranscendentalOps: 0,
      pfxHealingLoopAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxHealingLoopMaterialAppearance(material, 0.78, 0.43)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.78)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.43)
    material.dispose()

    const samples = [0.08, 0.3, 0.58, 0.86].map(PfxLibrary.createPfxHealingLoopLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['inhale', 'crest', 'release', 'recover'])
    expect(samples[1]!.renewal).toBeGreaterThan(samples[0]!.renewal)
    expect(samples[2]!.rise).toBeGreaterThanOrEqual(0.6)
    expect(samples[3]!.grounding).toBeGreaterThanOrEqual(0.7)
    expect(samples.every((sample) => sample.energy > 0)).toBe(true)
  })

  it('authors holy release as a one-draw closed radiant mandorla with a cleansing crown', () => {
    const preset = createPfxPreset('holy-release')
    const plan = getPfxRenderPlan(preset)
    const mandorla = plan.surfaces.find((surface) => surface.phase === 'holy-release-radiant-mandorla')

    expect(preset.implementationProfile).toBe('radial-burst')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(mandorla).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 1,
      tuning: {
        meshGeometry: 'holy-release-radiant-mandorla',
        meshMotion: 'bloom',
        lifecycle: 'holy-release-cleansing',
        blend: 'alpha',
        colorOverride: '#ffd95a',
      },
    })
    expect(mandorla!.scale).toBeCloseTo(1.035)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(mandorla!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxHolyReleaseGeometry()
    expect(geometry.userData).toMatchObject({
      pfxHolyReleaseDrawCalls: 1,
      pfxHolyReleaseClosedFaces: true,
      pfxHolyReleaseBillboardCount: 0,
      pfxHolyReleaseCoreCount: 1,
      pfxHolyReleasePrimaryRayCount: 10,
      pfxHolyReleaseWingRayCount: 4,
      pfxHolyReleaseCrownFacetCount: 3,
      pfxHolyReleaseSilhouetteProfile: 'faceted-mandorla-with-cross-axis-rays-wing-pair-and-cleansing-crown',
      pfxHolyReleasePalette: 'warm-gold-ivory-celestial-blue',
      pfxHolyReleaseAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxHolyReleaseTriangleCount']).toBeLessThanOrEqual(600)
    expect(geometry.userData['pfxHolyReleaseWidthSpan']).toBeGreaterThanOrEqual(1.6)
    expect(geometry.userData['pfxHolyReleaseDepthSpan']).toBeGreaterThanOrEqual(1)
    expect(geometry.userData['pfxHolyReleaseHeightSpan']).toBeGreaterThanOrEqual(1.6)
    geometry.dispose()

    const material = PfxLibrary.createPfxHolyReleaseMaterial(mandorla!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxHolyReleaseForm')
    expect(material.vertexShader).toContain('releaseIgnition')
    expect(material.vertexShader).toContain('radiantExpansion')
    expect(material.vertexShader).toContain('cleansingResolve')
    expect(material.fragmentShader).toContain('radiantPalette')
    expect(material.fragmentShader).toContain('ivoryCore')
    expect(material.fragmentShader).toContain('celestialRim')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxHolyReleaseMaterial: true,
      pfxHolyReleaseMaterialProfile: 'white-gold-faceted-release-with-blue-cleansing-rim',
      pfxHolyReleaseFragmentTranscendentalOps: 0,
      pfxHolyReleaseAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxHolyReleaseMaterialAppearance(material, 0.82, 0.36)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.82)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.36)
    material.dispose()

    const samples = [0.04, 0.2, 0.5, 0.8].map(PfxLibrary.createPfxHolyReleaseLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['ignite', 'release', 'cleanse', 'resolve'])
    expect(samples[1]!.radiance).toBeGreaterThan(samples[0]!.radiance)
    expect(samples[2]!.cleanse).toBeGreaterThanOrEqual(0.6)
    expect(samples[3]!.residue).toBeGreaterThanOrEqual(0.45)
  })

  it('authors curse cone as a three-layer directional particle propagation', () => {
    const preset = createPfxPreset('curse-cone')
    const plan = getPfxRenderPlan(preset)
    const fan = plan.surfaces.find((surface) => surface.phase === 'curse-cone-particle-thorn-fan')
    const rupture = plan.surfaces.find((surface) => surface.phase === 'curse-cone-particle-void-rupture')
    const runes = plan.surfaces.find((surface) => surface.phase === 'curse-cone-particle-rune-rise')

    expect(preset.implementationProfile).toBe('radial-burst')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(fan).toMatchObject({
      kind: 'particles',
      role: 'trail',
      opacity: 0.92,
      tuning: {
        motion: 'radial-burst',
        sprite: 'streak',
        lifecycle: 'curse-cone-particle-propagation',
        blend: 'alpha',
        colorOverride: '#9d54dc',
      },
    })
    expect(rupture).toMatchObject({ kind: 'particles', role: 'impact', tuning: { motion: 'impact-burst', sprite: 'twirl', lifecycle: 'curse-cone-particle-propagation' } })
    expect(runes).toMatchObject({ kind: 'particles', role: 'aura', tuning: { motion: 'column-rise', sprite: 'rune', lifecycle: 'curse-cone-particle-propagation' } })
    expect(fan!.scale).toBeCloseTo(1.242)
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense)).toBe(true)

    const geometry = PfxLibrary.createPfxCurseConeGeometry()
    expect(geometry.userData).toMatchObject({
      pfxCurseConeDrawCalls: 1,
      pfxCurseConeClosedFaces: true,
      pfxCurseConeBillboardCount: 0,
      pfxCurseConePathCount: 7,
      pfxCurseConeSegmentsPerPath: 3,
      pfxCurseConeEndpointBarbCount: 4,
      pfxCurseConeSourceKnotCount: 1,
      pfxCurseConeDepthLaneCount: 5,
      pfxCurseConeThornBaseRadius: 0.105,
      pfxCurseConeThornTipRadius: 0.026,
      pfxCurseConeSourceKnotSpan: 0.58,
      pfxCurseConeAttackAxis: 'positive-x',
      pfxCurseConeSilhouetteProfile: 'source-knot-to-broad-twisted-seven-thorn-fan',
      pfxCurseConePalette: 'void-violet-curse-magenta-cold-lilac',
      pfxCurseConeAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxCurseConeTriangleCount']).toBeLessThanOrEqual(340)
    expect(geometry.userData['pfxCurseConeWidthSpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxCurseConeHeightSpan']).toBeGreaterThanOrEqual(1.4)
    expect(geometry.userData['pfxCurseConeDepthSpan']).toBeGreaterThanOrEqual(1.3)
    geometry.dispose()

    const material = PfxLibrary.createPfxCurseConeMaterial(fan!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxCurseConeForm')
    expect(material.vertexShader).toContain('cursePropagation')
    expect(material.vertexShader).toContain('thornGrip')
    expect(material.vertexShader).toContain('curseErosion')
    expect(material.fragmentShader).toContain('cursePalette')
    expect(material.fragmentShader).toContain('voidBody')
    expect(material.fragmentShader).toContain('lilacEdge')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxCurseConeMaterial: true,
      pfxCurseConeMaterialProfile: 'void-violet-thorn-fan-with-magenta-grip-and-lilac-edges',
      pfxCurseConeFragmentTranscendentalOps: 0,
      pfxCurseConeAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxCurseConeMaterialAppearance(material, 0.8, 0.41)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.8)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.41)
    material.dispose()

    const samples = [0.04, 0.2, 0.5, 0.8].map(PfxLibrary.createPfxCurseConeLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['seed', 'propagate', 'grip', 'erode'])
    expect(samples[1]!.reach).toBeGreaterThan(samples[0]!.reach)
    expect(samples[2]!.grip).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]!.erosion).toBeGreaterThanOrEqual(0.65)
  })

  it('authors shadow break as a one-draw intact-to-ruptured closed shadow volume', () => {
    const preset = createPfxPreset('shadow-break')
    const plan = getPfxRenderPlan(preset)
    const rupture = plan.surfaces.find((surface) => surface.phase === 'shadow-break-rupture-cluster')

    expect(preset.implementationProfile).toBe('radial-burst')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(rupture).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 1,
      tuning: {
        meshGeometry: 'shadow-break-rupture-cluster',
        meshMotion: 'bloom',
        lifecycle: 'shadow-break-rupture',
        blend: 'alpha',
        colorOverride: '#7a3fc2',
      },
    })
    expect(rupture!.scale).toBeCloseTo(1.15)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(rupture!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxShadowBreakGeometry()
    expect(geometry.userData).toMatchObject({
      pfxShadowBreakDrawCalls: 1,
      pfxShadowBreakClosedFaces: true,
      pfxShadowBreakBillboardCount: 0,
      pfxShadowBreakShellCount: 1,
      pfxShadowBreakFracturePieceCount: 12,
      pfxShadowBreakVoidSeamCount: 3,
      pfxShadowBreakVoidSeamProfile: 'three-offset-jagged-lilac-fissures',
      pfxShadowBreakDepthLaneCount: 5,
      pfxShadowBreakSilhouetteProfile: 'faceted-shadow-shell-to-asymmetric-violet-rupture-with-vertical-void-seam',
      pfxShadowBreakPalette: 'ink-black-deep-violet-bruise-magenta-cold-lilac',
      pfxShadowBreakAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxShadowBreakTriangleCount']).toBeLessThanOrEqual(180)
    expect(geometry.userData['pfxShadowBreakWidthSpan']).toBeGreaterThanOrEqual(1.7)
    expect(geometry.userData['pfxShadowBreakHeightSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxShadowBreakDepthSpan']).toBeGreaterThanOrEqual(1.4)
    geometry.dispose()

    const material = PfxLibrary.createPfxShadowBreakMaterial(rupture!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxShadowBreakForm')
    expect(material.vertexShader).toContain('shadowGather')
    expect(material.vertexShader).toContain('shadowRupture')
    expect(material.vertexShader).toContain('shadowResidue')
    expect(material.fragmentShader).toContain('shadowPalette')
    expect(material.fragmentShader).toContain('fractureEdge')
    expect(material.fragmentShader).toContain('voidSeam')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxShadowBreakMaterial: true,
      pfxShadowBreakMaterialProfile: 'faceted-ink-shell-with-violet-fracture-planes-and-cold-lilac-seam',
      pfxShadowBreakPeakRuptureCycle: 0.12,
      pfxShadowBreakFragmentTranscendentalOps: 0,
      pfxShadowBreakAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxShadowBreakMaterialAppearance(material, 0.76, 0.44)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.76)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.44)
    material.dispose()

    const samples = [0.04, 0.2, 0.48, 0.8].map(PfxLibrary.createPfxShadowBreakLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['gather', 'rupture', 'disperse', 'residue'])
    expect(samples[1]!.rupture).toBeGreaterThan(samples[0]!.rupture)
    expect(samples[2]!.spread).toBeGreaterThanOrEqual(0.65)
    expect(samples[3]!.residue).toBeGreaterThanOrEqual(0.55)
  })

  it('authors blood death as a mobile-safe one-draw ballistic pigment rupture with an integrated pool', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'blood-death')!
    const preset = createPfxPreset('blood-death')
    const plan = getPfxRenderPlan(preset)
    const rupture = plan.surfaces.find((surface) => surface.phase === 'blood-death-pigment-rupture')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(rupture).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 1,
      tuning: {
        meshGeometry: 'blood-death-pigment-rupture',
        meshMotion: 'bloom',
        lifecycle: 'blood-death-ballistic-collapse',
        blend: 'alpha',
        colorOverride: '#b5121f',
      },
    })
    expect(rupture!.scale).toBeCloseTo(1.15)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(rupture!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxBloodDeathGeometry()
    expect(geometry.userData).toMatchObject({
      pfxBloodDeathDrawCalls: 1,
      pfxBloodDeathClosedFaces: true,
      pfxBloodDeathBillboardCount: 0,
      pfxBloodDeathWoundCoreCount: 1,
      pfxBloodDeathSplashJetCount: 6,
      pfxBloodDeathClotCount: 12,
      pfxBloodDeathClotProfile: 'twelve-direction-aligned-closed-five-sided-teardrops',
      pfxBloodDeathPoolCount: 1,
      pfxBloodDeathPoolGroundOffset: -0.58,
      pfxBloodDeathDepthLaneCount: 5,
      pfxBloodDeathSilhouetteProfile: 'compact-wound-core-to-asymmetric-arterial-fan-and-grounded-pigment-pool',
      pfxBloodDeathPalette: 'coagulated-crimson-arterial-red-oxblood-black-wet-highlight',
      pfxBloodDeathAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxBloodDeathTriangleCount']).toBe(248)
    expect(geometry.userData['pfxBloodDeathWidthSpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxBloodDeathHeightSpan']).toBeGreaterThanOrEqual(1.7)
    expect(geometry.userData['pfxBloodDeathDepthSpan']).toBeGreaterThanOrEqual(1.3)
    geometry.dispose()

    const material = PfxLibrary.createPfxBloodDeathMaterial(rupture!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxBloodDeathForm')
    expect(material.vertexShader).toContain('woundContraction')
    expect(material.vertexShader).toContain('ballisticRupture')
    expect(material.vertexShader).toContain('poolSettle')
    expect(material.fragmentShader).toContain('bloodPalette')
    expect(material.fragmentShader).toContain('wetHighlight')
    expect(material.fragmentShader).toContain('coagulatedEdge')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxBloodDeathMaterial: true,
      pfxBloodDeathMaterialProfile: 'opaque-pigment-volume-with-arterial-red-facets-oxblood-depth-and-wet-ivory-glints',
      pfxBloodDeathFragmentTranscendentalOps: 0,
      pfxBloodDeathAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxBloodDeathMaterialAppearance(material, 0.78, 0.46)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.78)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.46)
    material.dispose()

    const samples = [0.04, 0.18, 0.48, 0.8].map(PfxLibrary.createPfxBloodDeathLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['wound', 'rupture', 'fall', 'pool'])
    expect(samples[1]!.rupture).toBeGreaterThan(samples[0]!.rupture)
    expect(samples[2]!.fall).toBeGreaterThanOrEqual(0.6)
    expect(samples[3]!.pool).toBeGreaterThanOrEqual(0.65)
  })

  it('authors ghost trail as a mobile-safe one-draw spectral procession with a volumetric wake', () => {
    const preset = createPfxPreset('ghost-trail')
    const plan = getPfxRenderPlan(preset)
    const procession = plan.surfaces.find((surface) => surface.phase === 'ghost-trail-spectral-procession')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'trail-ribbon' || surface.kind === 'tapered-trail')).toBe(false)
    expect(procession).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      opacity: 1,
      tuning: {
        meshGeometry: 'ghost-trail-spectral-procession',
        meshMotion: 'travel',
        lifecycle: 'ghost-trail-procession',
        blend: 'alpha',
        colorOverride: '#68e8ff',
      },
    })
    expect(procession!.scale).toBeCloseTo(0.828)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(procession!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxGhostTrailGeometry()
    expect(geometry.userData).toMatchObject({
      pfxGhostTrailDrawCalls: 1,
      pfxGhostTrailClosedFaces: true,
      pfxGhostTrailBillboardCount: 0,
      pfxGhostTrailLeadMaskCount: 1,
      pfxGhostTrailJawCount: 1,
      pfxGhostTrailSoulEyeCount: 2,
      pfxGhostTrailVeilStrandCount: 7,
      pfxGhostTrailSegmentsPerStrand: 3,
      pfxGhostTrailSoulMoteCount: 5,
      pfxGhostTrailDepthLaneCount: 5,
      pfxGhostTrailMotionAxis: 'positive-x-with-negative-x-wake',
      pfxGhostTrailSilhouetteProfile: 'faceted-lead-mask-with-seven-tapered-depth-veils-and-five-soul-motes',  // secret-scan: allow (false positive: "mask-with..." slug, not a key)
      pfxGhostTrailPalette: 'abyss-blue-spectral-cyan-cold-lilac-ivory-glint',
      pfxGhostTrailAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxGhostTrailTriangleCount']).toBe(336)
    expect(geometry.userData['pfxGhostTrailLengthSpan']).toBeGreaterThanOrEqual(2.4)
    expect(geometry.userData['pfxGhostTrailHeightSpan']).toBeGreaterThanOrEqual(1.2)
    expect(geometry.userData['pfxGhostTrailDepthSpan']).toBeGreaterThanOrEqual(1.1)
    geometry.dispose()

    const material = PfxLibrary.createPfxGhostTrailMaterial(procession!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxGhostTrailForm')
    expect(material.vertexShader).toContain('spectralSummon')
    expect(material.vertexShader).toContain('processionSurge')
    expect(material.vertexShader).toContain('veilDissolve')
    expect(material.fragmentShader).toContain('spectralPalette')
    expect(material.fragmentShader).toContain('ectoplasmRim')
    expect(material.fragmentShader).toContain('soulGlint')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxGhostTrailMaterial: true,
      pfxGhostTrailMaterialProfile: 'abyssal-faceted-mask-with-cyan-ectoplasm-veils-lilac-edges-and-ivory-soul-glints',  // secret-scan: allow (false positive: "mask-with..." slug, not a key)
      pfxGhostTrailFragmentTranscendentalOps: 0,
      pfxGhostTrailAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxGhostTrailMaterialAppearance(material, 0.8, 0.44)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.8)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.44)
    material.dispose()

    const samples = [0.04, 0.18, 0.5, 0.8].map(PfxLibrary.createPfxGhostTrailLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['summon', 'surge', 'haunt', 'dissolve'])
    expect(samples[1]!.reach).toBeGreaterThan(samples[0]!.reach)
    expect(samples[2]!.haunt).toBeGreaterThanOrEqual(0.7)
    expect(samples[3]!.dissolve).toBeGreaterThanOrEqual(0.65)
  })

  it('authors portal telegraph as a mobile-safe one-draw countdown aperture with a stable danger boundary', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'portal-telegraph')!
    const preset = createPfxPreset('portal-telegraph')
    const plan = getPfxRenderPlan(preset)
    const aperture = plan.surfaces.find((surface) => surface.phase === 'portal-telegraph-countdown-aperture')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(aperture).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 1,
      tuning: {
        meshGeometry: 'portal-telegraph-countdown-aperture',
        meshMotion: 'countdown',
        lifecycle: 'portal-telegraph-countdown',
        blend: 'alpha',
        colorOverride: '#8d46ff',
      },
    })
    expect(aperture!.scale).toBeCloseTo(1.15)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(aperture!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxPortalTelegraphGeometry()
    expect(geometry.userData).toMatchObject({
      pfxPortalTelegraphDrawCalls: 1,
      pfxPortalTelegraphClosedFaces: true,
      pfxPortalTelegraphBillboardCount: 0,
      pfxPortalTelegraphBoundaryCount: 1,
      pfxPortalTelegraphApertureCount: 1,
      pfxPortalTelegraphCountdownWedgeCount: 8,
      pfxPortalTelegraphCardinalPylonCount: 4,
      pfxPortalTelegraphWorldPlane: 'xz-ground-plane',
      pfxPortalTelegraphSilhouetteProfile: 'stable-outer-danger-boundary-recessed-throat-eight-inward-wedges-and-four-raised-pylons',
      pfxPortalTelegraphPalette: 'void-purple-warning-violet-cold-lilac-arrival-ivory',
      pfxPortalTelegraphAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxPortalTelegraphTriangleCount']).toBeLessThanOrEqual(300)
    expect(geometry.userData['pfxPortalTelegraphWidthSpan']).toBeGreaterThanOrEqual(2.1)
    expect(geometry.userData['pfxPortalTelegraphDepthSpan']).toBeGreaterThanOrEqual(2.1)
    expect(geometry.userData['pfxPortalTelegraphHeightSpan']).toBeGreaterThanOrEqual(0.65)
    geometry.dispose()

    const material = PfxLibrary.createPfxPortalTelegraphMaterial(aperture!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxPortalTelegraphForm')
    expect(material.vertexShader).toContain('boundaryHold')
    expect(material.vertexShader).toContain('countdownConvergence')
    expect(material.vertexShader).toContain('apertureBreach')
    expect(material.fragmentShader).toContain('portalPalette')
    expect(material.fragmentShader).toContain('warningEdge')
    expect(material.fragmentShader).toContain('arrivalGlint')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxPortalTelegraphMaterial: true,
      pfxPortalTelegraphMaterialProfile: 'void-purple-aperture-with-warning-violet-boundary-cold-lilac-wedges-and-ivory-arrival-glints',
      pfxPortalTelegraphFragmentTranscendentalOps: 0,
      pfxPortalTelegraphAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxPortalTelegraphMaterialAppearance(material, 0.82, 0.5)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.82)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.5)
    material.dispose()

    const samples = [0.04, 0.25, 0.55, 0.82].map(PfxLibrary.createPfxPortalTelegraphLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['mark', 'countdown', 'breach', 'arrival'])
    expect(samples[1]!.urgency).toBeGreaterThan(samples[0]!.urgency)
    expect(samples[2]!.aperture).toBeGreaterThanOrEqual(0.65)
    expect(samples[3]!.arrival).toBeGreaterThanOrEqual(0.7)
  })

  it('preserves the warp spray hero vortex while consolidating support into a mobile-safe closed-facet batch', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'warp-spray')!
    const preset = createPfxPreset('warp-spray')
    const plan = getPfxRenderPlan(preset)
    const vortex = plan.surfaces.find((surface) => surface.phase === 'warp-spray-hero-vortex')
    const facets = plan.surfaces.find((surface) => surface.phase === 'warp-spray-displaced-facets')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('medium')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(10)
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(vortex).toMatchObject({
      kind: 'core-sphere',
      role: 'body',
      opacity: 0.95,
      tuning: {
        meshShader: 'vortex-swirl',
        meshMotion: 'bloom',
        blend: 'alpha',
        colorOverride: '#7a1fff',
      },
    })
    expect(vortex!.scale).toBeCloseTo(0.943)
    expect(facets).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 0.82,
      tuning: {
        meshGeometry: 'warp-spray-displaced-facets',
        meshMotion: 'travel',
        lifecycle: 'impact-shard-burst',
        blend: 'alpha',
        colorOverride: '#76cfff',
      },
    })
    expect(facets!.scale).toBeCloseTo(0.828)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(vortex!, 2, false)).toBe(true)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(facets!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxWarpSprayFacetGeometry()
    expect(geometry.userData).toMatchObject({
      pfxWarpSprayDrawCalls: 1,
      pfxWarpSprayClosedFaces: true,
      pfxWarpSprayBillboardCount: 0,
      pfxWarpSprayFacetCount: 8,
      pfxWarpSprayDepthLaneCount: 4,
      pfxWarpSpraySilhouetteProfile: 'eight-tangential-space-facets-orbiting-across-four-depth-lanes',
      pfxWarpSprayPalette: 'warp-cyan-cold-lilac-ivory-glint',
      pfxWarpSprayAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxWarpSprayTriangleCount']).toBeLessThanOrEqual(160)
    expect(geometry.userData['pfxWarpSprayWidthSpan']).toBeGreaterThanOrEqual(1.8)
    expect(geometry.userData['pfxWarpSprayHeightSpan']).toBeGreaterThanOrEqual(1.1)
    expect(geometry.userData['pfxWarpSprayDepthSpan']).toBeGreaterThanOrEqual(0.8)
    geometry.dispose()

    const material = PfxLibrary.createPfxWarpSprayFacetMaterial(facets!.opacity)
    expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.emissive.getHexString()).toBe('2f9dff')
    expect(material.userData).toMatchObject({
      pfxWarpSprayFacetMaterial: 'cold-cyan-faceted-space-displacement',
      pfxWarpSprayAssetProvenance: 'original-procedural-closed-mesh',
    })
    material.dispose()
  })

  it('authors teleport hit as a mobile-safe one-draw arrival scar with ground contact and a displaced vertical afterimage', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'teleport-hit')!
    const preset = createPfxPreset('teleport-hit')
    const plan = getPfxRenderPlan(preset)
    const arrival = plan.surfaces.find((surface) => surface.phase === 'teleport-hit-arrival-scar')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'screen-plane' || surface.kind === 'ring-field')).toBe(false)
    expect(arrival).toMatchObject({
      kind: 'impact-shards',
      role: 'impact',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'teleport-hit-arrival-scar',
        meshMotion: 'flash',
        lifecycle: 'teleport-hit-arrival',
        blend: 'alpha',
        colorOverride: '#54bfff',
      },
    })
    expect(arrival!.scale).toBeCloseTo(1.058)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(arrival!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxTeleportHitGeometry()
    expect(geometry.userData).toMatchObject({
      pfxTeleportHitDrawCalls: 1,
      pfxTeleportHitClosedFaces: true,
      pfxTeleportHitBillboardCount: 0,
      pfxTeleportHitGroundApertureCount: 1,
      pfxTeleportHitAfterimageSpineCount: 2,
      pfxTeleportHitRadialFractureCount: 8,
      pfxTeleportHitCardinalPylonCount: 4,
      pfxTeleportHitDepthLaneCount: 4,
      pfxTeleportHitWorldPlane: 'xz-ground-plane-with-y-axis-afterimage',
      pfxTeleportHitSilhouetteProfile: 'grounded-broken-aperture-with-twin-vertical-afterimage-spines-eight-radial-fractures-and-four-cardinal-pylons',
      pfxTeleportHitPalette: 'deep-warp-blue-electric-cyan-cold-lilac-arrival-ivory',
      pfxTeleportHitAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxTeleportHitTriangleCount']).toBeLessThanOrEqual(260)
    expect(geometry.userData['pfxTeleportHitWidthSpan']).toBeGreaterThanOrEqual(2)
    expect(geometry.userData['pfxTeleportHitHeightSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxTeleportHitDepthSpan']).toBeGreaterThanOrEqual(2)
    geometry.dispose()

    const material = PfxLibrary.createPfxTeleportHitMaterial(arrival!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxTeleportHitForm')
    expect(material.vertexShader).toContain('groundImpact')
    expect(material.vertexShader).toContain('afterimageResolve')
    expect(material.vertexShader).toContain('radialFracture')
    expect(material.fragmentShader).toContain('teleportPalette')
    expect(material.fragmentShader).toContain('arrivalRim')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxTeleportHitMaterial: true,
      pfxTeleportHitFragmentTranscendentalOps: 0,
      pfxTeleportHitAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxTeleportHitMaterialAppearance(material, 0.8, 0.5)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.8)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.5)
    material.dispose()

    const samples = [0.04, 0.24, 0.58, 0.84].map(PfxLibrary.createPfxTeleportHitLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['land', 'fracture', 'afterimage', 'dissolve'])
    expect(samples[1]!.fracture).toBeGreaterThan(samples[0]!.fracture)
    expect(samples[2]!.afterimage).toBeGreaterThanOrEqual(0.65)
    expect(samples[3]!.dissolve).toBeGreaterThanOrEqual(0.65)
  })

  it('authors despawn impact as a mobile-safe one-draw absence cage that collapses inward instead of bursting outward', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'despawn-impact')!
    const preset = createPfxPreset('despawn-impact')
    const plan = getPfxRenderPlan(preset)
    const absence = plan.surfaces.find((surface) => surface.phase === 'despawn-impact-absence-collapse')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'cloud-volume' || surface.kind === 'ring-field')).toBe(false)
    expect(absence).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 0.94,
      tuning: {
        meshGeometry: 'despawn-impact-absence-cage',
        meshMotion: 'break',
        lifecycle: 'despawn-impact-collapse',
        blend: 'alpha',
        colorOverride: '#8fc8ef',
      },
    })
    expect(absence!.scale).toBeCloseTo(1.035)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(absence!, 2, false)).toBe(false)

    const geometry = PfxLibrary.createPfxDespawnImpactGeometry()
    expect(geometry.userData).toMatchObject({
      pfxDespawnImpactDrawCalls: 1,
      pfxDespawnImpactClosedFaces: true,
      pfxDespawnImpactBillboardCount: 0,
      pfxDespawnImpactGroundSealCount: 1,
      pfxDespawnImpactContourBandCount: 3,
      pfxDespawnImpactInwardFragmentCount: 10,
      pfxDespawnImpactVoidCoreCount: 1,
      pfxDespawnImpactDepthLaneCount: 5,
      pfxDespawnImpactMotionAxis: 'inward-and-positive-y-erase',
      pfxDespawnImpactSilhouetteProfile: 'ground-seal-beneath-three-collapsing-body-contours-ten-inward-fragments-and-one-void-core',
      pfxDespawnImpactPalette: 'absence-navy-cold-blue-pale-cyan-void-ivory',
      pfxDespawnImpactAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.userData['pfxDespawnImpactTriangleCount']).toBeLessThanOrEqual(420)
    expect(geometry.userData['pfxDespawnImpactWidthSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxDespawnImpactHeightSpan']).toBeGreaterThanOrEqual(1.5)
    expect(geometry.userData['pfxDespawnImpactDepthSpan']).toBeGreaterThanOrEqual(1.2)
    geometry.dispose()

    const material = PfxLibrary.createPfxDespawnImpactMaterial(absence!.opacity)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxDespawnImpactForm')
    expect(material.vertexShader).toContain('inwardCollapse')
    expect(material.vertexShader).toContain('liftErase')
    expect(material.fragmentShader).toContain('absencePalette')
    expect(material.fragmentShader).toContain('erasureRim')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxDespawnImpactMaterial: true,
      pfxDespawnImpactFragmentTranscendentalOps: 0,
      pfxDespawnImpactAssetProvenance: 'original-procedural-closed-mesh',
    })
    PfxLibrary.applyPfxDespawnImpactMaterialAppearance(material, 0.78, 0.5)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.78)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.5)
    material.dispose()

    const samples = [0.04, 0.28, 0.6, 0.84].map(PfxLibrary.createPfxDespawnImpactLifecycle)
    expect(samples.map((sample) => sample.stage)).toEqual(['mark', 'collapse', 'lift', 'erase'])
    expect(samples[1]!.collapse).toBeGreaterThan(samples[0]!.collapse)
    expect(samples[2]!.lift).toBeGreaterThanOrEqual(0.65)
    expect(samples[3]!.erase).toBeGreaterThanOrEqual(0.65)
  })

  it('preserves the shield aura hero hex shell while removing persistent mobile draw and particle redundancy', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'shield-aura')!
    const preset = createPfxPreset('shield-aura')
    const plan = getPfxRenderPlan(preset)
    const shell = plan.surfaces.find((surface) => surface.phase === 'shield-aura-defensive-envelope')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('medium')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(10)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(shell).toMatchObject({
      kind: 'shield-shell',
      role: 'aura',
      opacity: 0.78,
      tuning: {
        meshGeometry: 'shield-aura-defensive-envelope',
        meshShader: 'hex-shell',
        meshMotion: 'glow',
        blend: 'alpha',
        colorOverride: '#3b9dff',
        positionOffset: [0, -0.14, 0],
      },
    })
    expect(shell!.scale).toBeCloseTo(1.012)
    expect(shell!.scale).toBeLessThanOrEqual(1.02)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(shell!, 2, false)).toBe(false)
  })

  it('authors barrier column as one closed fortified pillar instead of a shield bubble with redundant support draws', () => {
    const effect = PfxLibrary.PFX_TAXONOMY.find((entry) => entry.id === 'barrier-column')!
    const preset = createPfxPreset('barrier-column')
    const plan = getPfxRenderPlan(preset)
    const pillar = plan.surfaces.find((surface) => surface.phase === 'barrier-column-fortified-pillar')

    expect(effect.mobileSafety).toBe('safe')
    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'shield-shell' || surface.kind === 'ring-field')).toBe(false)
    expect(pillar).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'barrier-column-fortified-pillar',
        lifecycle: 'barrier-column-sentinel-loop',
        blend: 'alpha',
        colorOverride: '#2f8fe8',
        positionOffset: [0, -0.78, 0],
      },
    })
    expect(pillar!.scale).toBeCloseTo(0.897)
    expect(pillar!.scale).toBeLessThanOrEqual(0.9)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(pillar!, 2, false)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxBarrierColumnGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxBarrierColumnMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxBarrierColumnMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(450)
    expect(geometry.userData).toMatchObject({
      pfxBarrierColumnDrawCalls: 1,
      pfxBarrierColumnClosedFaces: true,
      pfxBarrierColumnBillboardCount: 0,
      pfxBarrierColumnPanelCount: 6,
      pfxBarrierColumnBraceCount: 6,
      pfxBarrierColumnEnergyRailCount: 5,
      pfxBarrierColumnCrownPylonCount: 6,
      pfxBarrierColumnAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(2.35)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(1.35)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(1.35)
    geometry.dispose()

    const material = createMaterial(pillar!.opacity) as THREE.ShaderMaterial
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('pfxBarrierColumnForm')
    expect(material.vertexShader).toContain('sentinelPulse')
    expect(material.fragmentShader).toContain('barrierPalette')
    expect(material.fragmentShader).toContain('ascendingScan')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxBarrierColumnMaterial: true,
      pfxBarrierColumnFragmentTranscendentalOps: 0,
      pfxBarrierColumnAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.72, 0.42)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.72)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.42)
    material.dispose()
  })

  it('authors dash idle as one closed directional vector reservoir instead of an orb with sparse particle traffic', () => {
    const preset = createPfxPreset('dash-idle')
    const plan = getPfxRenderPlan(preset)
    const reservoir = plan.surfaces.find((surface) => surface.phase === 'dash-idle-vector-reservoir')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'core-sphere')).toBe(false)
    expect(reservoir).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      opacity: 0.94,
      tuning: {
        meshGeometry: 'dash-idle-vector-reservoir',
        lifecycle: 'dash-idle-readiness-loop',
        blend: 'alpha',
        colorOverride: '#2f9dff',
        positionOffset: [-0.24, -0.18, 0],
        turbulenceScale: 0,
      },
    })
    expect(reservoir!.scale).toBeCloseTo(0.828)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(reservoir!, 2, false)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxDashIdleGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxDashIdleMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxDashIdleMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(300)
    expect(geometry.userData).toMatchObject({
      pfxDashIdleDrawCalls: 1,
      pfxDashIdleClosedFaces: true,
      pfxDashIdleBillboardCount: 0,
      pfxDashIdleSweptChevronCount: 6,
      pfxDashIdleForwardRailCount: 2,
      pfxDashIdleLaunchCoreCount: 1,
      pfxDashIdleDepthLaneCount: 4,
      pfxDashIdleAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(2.1)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(0.75)
    geometry.dispose()

    const material = createMaterial(reservoir!.opacity) as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('readinessCompression')
    expect(material.fragmentShader).toContain('directionalWake')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxDashIdleMaterial: true,
      pfxDashIdleFragmentTranscendentalOps: 0,
      pfxDashIdleAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.7, 0.36)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.7)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.36)
    material.dispose()
  })

  it('authors jump beam as one closed updraft accelerator instead of a thin beam with particle traffic and a disconnected halo', () => {
    const preset = createPfxPreset('jump-beam')
    const plan = getPfxRenderPlan(preset)
    const accelerator = plan.surfaces.find((surface) => surface.phase === 'jump-beam-updraft-accelerator')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'beam-column' || surface.kind === 'core-sphere')).toBe(false)
    expect(accelerator).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 0.97,
      tuning: {
        meshGeometry: 'jump-beam-updraft-accelerator',
        lifecycle: 'jump-beam-lift-loop',
        blend: 'alpha',
        colorOverride: '#2f9dff',
        positionOffset: [0, -0.52, 0],
        turbulenceScale: 0,
      },
    })
    expect(accelerator!.scale).toBeCloseTo(0.897)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(accelerator!, 2, false)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxJumpBeamGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxJumpBeamMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxJumpBeamMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(600)
    expect(geometry.userData).toMatchObject({
      pfxJumpBeamDrawCalls: 1,
      pfxJumpBeamClosedFaces: true,
      pfxJumpBeamBillboardCount: 0,
      pfxJumpBeamInductionRingCount: 2,
      pfxJumpBeamHelicalVaneCount: 9,
      pfxJumpBeamLiftArrowCount: 3,
      pfxJumpBeamLiftSpineCount: 1,
      pfxJumpBeamCrownApertureCount: 1,
      pfxJumpBeamAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(2.55)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(1.7)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(1.7)
    geometry.dispose()

    const material = createMaterial(accelerator!.opacity) as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('updraftAdvance')
    expect(material.fragmentShader).toContain('ascendingBand')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxJumpBeamMaterial: true,
      pfxJumpBeamFragmentTranscendentalOps: 0,
      pfxJumpBeamAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.72, 0.41)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.72)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.41)
    material.dispose()
  })

  it('authors footstep ambient as one closed alternating ground-cadence wake instead of sub-pixel grit and a floating smudge', () => {
    const preset = createPfxPreset('footstep-ambient')
    const plan = getPfxRenderPlan(preset)
    const wake = plan.surfaces.find((surface) => surface.phase === 'footstep-ambient-cadence-wake')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'cloud-volume')).toBe(false)
    expect(wake).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      opacity: 0.88,
      tuning: {
        meshGeometry: 'footstep-ambient-cadence-wake',
        lifecycle: 'footstep-ambient-cadence-loop',
        blend: 'alpha',
        colorOverride: '#a98a52',
        positionOffset: [0, 0, 0],
        turbulenceScale: 0,
      },
    })
    expect(wake!.scale).toBeCloseTo(0.92)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(wake!, 2, false)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxFootstepAmbientGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxFootstepAmbientMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxFootstepAmbientMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(500)
    expect(geometry.userData).toMatchObject({
      pfxFootstepAmbientDrawCalls: 1,
      pfxFootstepAmbientClosedFaces: true,
      pfxFootstepAmbientBillboardCount: 0,
      pfxFootstepAmbientStepImpressionCount: 4,
      pfxFootstepAmbientHeelToePieceCount: 8,
      pfxFootstepAmbientKickedClodCount: 8,
      pfxFootstepAmbientWakeFinCount: 4,
      pfxFootstepAmbientAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(1.2)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(2.2)
    geometry.dispose()

    const material = createMaterial(wake!.opacity) as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('cadenceAdvance')
    expect(material.fragmentShader).toContain('groundCompression')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxFootstepAmbientMaterial: true,
      pfxFootstepAmbientFragmentTranscendentalOps: 0,
      pfxFootstepAmbientAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.68, 0.29)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.68)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.29)
    material.dispose()
  })

  it('authors pickup burst as a three-layer particle receipt instead of a token slab', () => {
    const preset = createPfxPreset('pickup-burst')
    const plan = getPfxRenderPlan(preset)
    const receipt = plan.surfaces.find((surface) => surface.phase === 'pickup-burst-particle-collect-pop')
    const payout = plan.surfaces.find((surface) => surface.phase === 'pickup-burst-particle-payout-rise')
    const orbit = plan.surfaces.find((surface) => surface.phase === 'pickup-burst-particle-receipt-orbit')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(receipt).toMatchObject({
      kind: 'particles',
      role: 'impact',
      opacity: 0.98,
      tuning: {
        motion: 'impact-burst',
        sprite: 'sparkle',
        lifecycle: 'pickup-burst-particle-receipt',
        blend: 'additive',
        colorOverride: '#fff0a8',
      },
    })
    expect(payout).toMatchObject({ kind: 'particles', role: 'body', tuning: { motion: 'column-rise', sprite: 'sparkle', lifecycle: 'pickup-burst-particle-receipt' } })
    expect(orbit).toMatchObject({ kind: 'particles', role: 'aura', tuning: { motion: 'orbit-ring', sprite: 'glow', lifecycle: 'pickup-burst-particle-receipt' } })
    expect(receipt!.scale).toBeCloseTo(0.943)
    expect(payout!.scale).toBeCloseTo(1.035)
    expect(orbit!.scale).toBeCloseTo(0.966)
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense)).toBe(true)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxPickupBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxPickupBurstMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxPickupBurstMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(400)
    expect(geometry.userData).toMatchObject({
      pfxPickupBurstDrawCalls: 1,
      pfxPickupBurstClosedFaces: true,
      pfxPickupBurstBillboardCount: 0,
      pfxPickupBurstReceiptTokenCount: 1,
      pfxPickupBurstTokenProfile: 'faceted-octahedron',
      pfxPickupBurstPayoutRayCount: 10,
      pfxPickupBurstRewardGemCount: 6,
      pfxPickupBurstDepthLaneCount: 3,
      pfxPickupBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(1.8)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(1.75)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(0.65)
    geometry.dispose()

    const material = createMaterial(receipt!.opacity) as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('payoutLife')
    expect(material.fragmentShader).toContain('rewardReceipt')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxPickupBurstMaterial: true,
      pfxPickupBurstFragmentTranscendentalOps: 0,
      pfxPickupBurstAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.74, 0.37)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.74)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.37)
    material.dispose()
  })

  it('authors reward charge as one closed gilded capacitor instead of sparkles orbiting a gray glow ball', () => {
    const preset = createPfxPreset('reward-charge')
    const plan = getPfxRenderPlan(preset)
    const capacitor = plan.surfaces.find((surface) => surface.phase === 'reward-charge-particle-gather')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(20)
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(capacitor).toMatchObject({
      kind: 'particles',
      role: 'aura',
      opacity: 0.96,
      tuning: {
        motion: 'converge-center',
        sprite: 'sparkle',
        lifecycle: 'reward-charge-gather-release',
        blend: 'additive',
        colorOverride: '#ffc928',
      },
    })
    expect(capacitor!.scale).toBeCloseTo(1.173)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(capacitor!, 2, false)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxRewardChargeGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxRewardChargeMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxRewardChargeMaterialAppearance
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof applyAppearance !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.getAttribute('position').count).toBeGreaterThanOrEqual(900)
    expect(geometry.userData).toMatchObject({
      pfxRewardChargeDrawCalls: 1,
      pfxRewardChargeClosedFaces: true,
      pfxRewardChargeBillboardCount: 0,
      pfxRewardChargeStoredValueCoreCount: 1,
      pfxRewardChargeGimbalCount: 3,
      pfxRewardChargeIntakeArrowCount: 12,
      pfxRewardChargeEscrowGemCount: 4,
      pfxRewardChargeDepthLaneCount: 3,
      pfxRewardChargeAssetProvenance: 'original-procedural-closed-mesh',
    })
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThanOrEqual(1.9)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(1.9)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThanOrEqual(1.2)
    geometry.dispose()

    const material = createMaterial(capacitor!.opacity) as THREE.ShaderMaterial
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.vertexShader).toContain('gatherProgress')
    expect(material.fragmentShader).toContain('storedValue')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.userData).toMatchObject({
      pfxRewardChargeMaterial: true,
      pfxRewardChargeFragmentTranscendentalOps: 0,
      pfxRewardChargeAssetProvenance: 'original-procedural-closed-mesh',
    })
    applyAppearance(material, 0.71, 0.44)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.71)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.44)
    material.dispose()
  })

  it('authors combo ring as one screen-space shader meter instead of a generic mesh ring, flash plane, and confetti emitter', () => {
    const preset = createPfxPreset('combo-ring')
    const plan = getPfxRenderPlan(preset)
    const meter = plan.surfaces.find((surface) => surface.phase === 'combo-ring-streak-meter')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(meter).toMatchObject({
      kind: 'screen-plane',
      role: 'screen',
      opacity: 0.92,
      tuning: {
        meshShader: 'combo-ring-meter',
        lifecycle: 'combo-ring-confirm-hold-decay',
        blend: 'alpha',
        colorOverride: '#ffc928',
        comboMultiplier: 3,
        positionOffset: [0, 0.96, 0],
        turbulenceScale: 0,
      },
    })
    expect(meter!.scale).toBeCloseTo(0.483)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxComboRingMaterial
    const applyAppearance = (PfxLibrary as Record<string, unknown>).applyPfxComboRingMaterialAppearance
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxComboRingLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxComboRingRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(applyAppearance).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof applyAppearance !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0.01)).toMatchObject({ stage: 'confirm' })
    expect(createLifecycle(0.35)).toMatchObject({ stage: 'hold', opacity: 1 })
    expect(createLifecycle(0.55)).toMatchObject({ stage: 'decay' })
    expect(createLifecycle(0.82)).toEqual({ progress: 1, opacity: 0, stage: 'rest' })
    expect(createRuntimeState(0.58, 1, 1, 1, 1)).toMatchObject({ cycle: 0.5, stage: 'decay' })
    expect(createRuntimeState(0.58, 2, 1, 1, 1).cycle).toBeCloseTo(0)
    expect(createRuntimeState(0.58, 1, 2, 1, 1).cycle).toBeCloseTo(0.25)
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, stage: 'rest' }
    expect(createRuntimeState(0.58, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'decay' })

    const material = createMaterial(meter!.opacity) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual([
      'uColor',
      'uComboMask',
      'uComboMultiplier',
      'uComboTwoMask',
      'uCycle',
      'uDensity',
      'uOpacity',
      'uStyleEdgeHardness',
    ])
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.side).toBe(THREE.DoubleSide)
    expect(material.fragmentShader).toContain('float alpha = max(comboMask.r')
    expect(material.fragmentShader).toContain('streakTicks')
    expect(material.fragmentShader).toContain('comboChain')
    expect(material.fragmentShader).toContain('xGlyph = comboMask.b')
    expect(material.fragmentShader).toContain('uComboTwoMask')
    expect(material.fragmentShader).toContain('uComboMultiplier')
    expect(material.fragmentShader).toContain('uniform vec3 uColor')
    expect(material.fragmentShader).toContain('texture2D(uComboMask')
    expect(material.fragmentShader).toContain('clamp((uCycle - 0.38) * 2.9412')
    expect(material.fragmentShader).toContain('decayProgress')
    expect(material.fragmentShader).toContain('uniform float uDensity')
    expect(material.fragmentShader).toContain('uniform float uStyleEdgeHardness')
    expect(material.fragmentShader).toContain('comboMask.a')
    expect(material.fragmentShader).toContain('step(0.35, uDensity)')
    expect(material.fragmentShader).toContain('vec3(1.0, 0.72, 0.08)')
    expect(material.fragmentShader).toContain('uColor, 0.86')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.fragmentShader).not.toContain('length(')
    expect(material.fragmentShader).not.toContain('smoothstep(')
    expect(material.userData).toMatchObject({
      pfxComboRingMaterial: true,
      pfxComboRingDrawCalls: 1,
      pfxComboRingTriangles: 2,
      pfxComboRingParticleCount: 0,
      pfxComboRingFragmentTranscendentalOps: 0,
      pfxComboRingFragmentTextureSamples: 2,
      pfxComboRingTransientAllocationsPerFrame: 0,
      pfxComboRingMeshJustification: 'screen-space-quad-for-analytic-ring-and-ticks',
    })
    const neonMaterial = createMaterial(meter!.opacity, '#22d3ee', 0.4, 0.72) as THREE.ShaderMaterial
    expect(neonMaterial.uniforms['uStyleEdgeHardness']!.value).toBeCloseTo(0.72)
    expect(neonMaterial.uniforms['uComboMask']!.value).toBe(material.uniforms['uComboMask']!.value)
    neonMaterial.dispose()
    const twoXRecipe = createPfxComboRingVariantRecipe(2)
    expect(twoXRecipe.id).toBe('combo-ring:authored-preview-2x')
    expect(twoXRecipe.surfaces[0]!.tuning?.comboMultiplier).toBe(2)
    applyAppearance(material, 0.73, 0.61)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.73)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.61)
    material.dispose()
  })

  it('keeps the remaining mesh-backed queue effects anchored, compact, and semantically layered', () => {
    const planOf = (effectId: string) => getPfxRenderPlan(createPfxPreset(effectId))

    const meteor = planOf('meteor-ring')
    expect(meteor.surfaces.find((surface) => surface.phase === 'meteor-ring-molten-crater')?.tuning?.positionOffset).toEqual([0, -0.88, 0])
    expect(meteor.surfaces.find((surface) => surface.phase === 'meteor-ring-ballistic-ejecta')?.tuning?.positionOffset).toEqual([0, -0.88, 0])
    expect(meteor.surfaces.find((surface) => surface.phase === 'meteor-ring-heat-front')?.tuning?.positionOffset).toEqual([0, -0.88, 0])

    const marker = planOf('marker-burst')
    expect(marker.surfaces).toHaveLength(2)
    expect(marker.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    const markerRing = marker.surfaces.find((surface) => surface.phase === 'marker-burst-open-ring')
    expect(markerRing).toMatchObject({
      kind: 'ring-field',
      opacity: 0.78,
      tuning: {
        ringPurpose: 'reticle',
        colorOverride: '#75b7ff',
        positionOffset: [0, -0.88, 0],
      },
    })
    expect(markerRing!.scale).toBeCloseTo(0.989)
    expect(marker.surfaces.find((surface) => surface.phase === 'marker-burst-confirm-pips')).toMatchObject({
      kind: 'particles',
      opacity: 0.92,
      tuning: {
        sprite: 'sparkle',
        blend: 'additive',
        delay: 0.06,
        window: 0.36,
        lifeScale: 0.7,
        countScale: 0.68,
        positionOffset: [0, -0.84, 0],
      },
    })
    expect(marker.surfaces.find((surface) => surface.phase === 'marker-burst-confirm-pips')!.tuning!.size![1]).toBeGreaterThanOrEqual(0.46)

    const reward = planOf('reward-burst')
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-screen-prize')).toMatchObject({
      kind: 'screen-plane',
      opacity: 0.78,
      tuning: { colorOverride: '#fff0a8' },
    })
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-screen-prize')!.scale).toBeCloseTo(0.529)
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-confetti-motes')).toMatchObject({
      kind: 'particles',
      opacity: 0.96,
      tuning: { sprite: 'sparkle', blend: 'additive', delay: 0.14, window: 0.54, countScale: 1.15, positionOffset: [0, 0.36, 0] },
    })
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-confetti-motes')!.tuning!.size![1]).toBeGreaterThanOrEqual(0.52)
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-celebration-ring')).toMatchObject({
      kind: 'ring-field',
      opacity: 0.46,
      scale: 0.828,
      tuning: { colorOverride: '#ffc928', ringPurpose: 'shockwave' },
    })
    expect(reward.surfaces.find((surface) => surface.phase === 'reward-burst-celebration-ring')!.tuning?.delay ?? 0).toBe(0)

    const scan = planOf('scan-cone')
    expect(scan.surfaces.find((surface) => surface.phase === 'scan-cone-volumetric-sweep')).toMatchObject({
      kind: 'muzzle-cone',
      opacity: 0.72,
      tuning: { positionOffset: [0.18, 0.16, 0] },
    })
    expect(scan.surfaces.find((surface) => surface.phase === 'scan-cone-volumetric-sweep')!.scale).toBeCloseTo(0.8625)

    const levelUp = planOf('level-up-flare')
    expect(levelUp.surfaces.find((surface) => surface.phase === 'level-up-volumetric-surge')).toMatchObject({
      kind: 'beam-column',
      tuning: { widthScale: 3.6, positionOffset: [0, 0.1, 0] },
    })
    expect(levelUp.surfaces.find((surface) => surface.phase === 'level-up-volumetric-surge')!.scale).toBeCloseTo(1.012)
  })

  it('tunes underpowered particle-first queue effects through focal scale and timing without adding mesh draws', () => {
    const planOf = (effectId: string) => getPfxRenderPlan(createPfxPreset(effectId))
    const particlePlanIds = ['wind-impact', 'debris-release', 'acid-charge', 'flame-charge', 'reward-charge']

    for (const effectId of particlePlanIds) {
      const plan = planOf(effectId)
      expect(plan.surfaces.every((surface) => surface.kind === 'particles'), `${effectId} particle-only`).toBe(true)
      expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${effectId} no mesh geometry`).toBe(true)
      expect(plan.estimatedDrawCalls).toBe(plan.surfaces.length)
    }

    const wind = planOf('wind-impact')
    expect(wind.surfaces.find((surface) => surface.phase === 'wind-impact-particle-pressure-fan')).toMatchObject({ opacity: 0.94 })
    expect(wind.surfaces.find((surface) => surface.phase === 'wind-impact-particle-pressure-fan')!.tuning!.size![1]).toBeGreaterThanOrEqual(0.56)
    expect(wind.surfaces.find((surface) => surface.phase === 'wind-impact-particle-release-streaks')).toMatchObject({ opacity: 0.8 })
    expect(wind.surfaces.find((surface) => surface.phase === 'wind-impact-particle-release-streaks')!.tuning!.size![1]).toBeGreaterThanOrEqual(0.5)

    const debris = planOf('debris-release')
    const debrisHero = debris.surfaces.find((surface) => surface.phase === 'debris-release-hero-rocks')!
    const debrisChips = debris.surfaces.find((surface) => surface.phase === 'debris-release-forward-chip-fan')!
    expect(debrisHero).toMatchObject({ opacity: 0.98 })
    expect(debrisHero.tuning!.countScale).toBeGreaterThanOrEqual(0.42)
    expect(debrisHero.tuning!.size![1]).toBeGreaterThanOrEqual(0.4)
    expect(debrisChips).toMatchObject({ opacity: 0.98 })
    expect(debrisChips.tuning).toMatchObject({ countScale: 0.6, randomizeAzimuth: true })
    expect(debrisChips.tuning!.size![1]).toBeGreaterThanOrEqual(0.28)

    const acid = planOf('acid-charge')
    const acidGather = acid.surfaces.find((surface) => surface.phase === 'acid-charge-gather-inflow')!
    const acidVapor = acid.surfaces.find((surface) => surface.phase === 'acid-charge-particle-vapor-thicken')!
    const acidDroplets = acid.surfaces.find((surface) => surface.phase === 'acid-charge-particle-droplet-rise')!
    expect(acidGather).toMatchObject({ opacity: 0.94 })
    expect(acidGather.tuning!.size![1]).toBeGreaterThanOrEqual(0.4)
    expect(acidVapor).toMatchObject({ opacity: 0.64 })
    expect(acidVapor.tuning!.size![1]).toBeGreaterThanOrEqual(0.9)
    expect(acidDroplets).toMatchObject({ opacity: 0.8 })
    expect(acidDroplets.tuning!.size![1]).toBeGreaterThanOrEqual(0.32)

    const flame = planOf('flame-charge')
    const flameGather = flame.surfaces.find((surface) => surface.phase === 'flame-charge-gather-inflow')!
    const flameCore = flame.surfaces.find((surface) => surface.phase === 'flame-charge-particle-core-swell')!
    const flameSmoke = flame.surfaces.find((surface) => surface.phase === 'flame-charge-particle-char-smoke')!
    expect(flameGather).toMatchObject({ opacity: 0.9 })
    expect(flameGather.tuning!.size![1]).toBeGreaterThanOrEqual(0.58)
    expect(flameCore).toMatchObject({ opacity: 0.98, tuning: { sprite: 'fire', colorOverride: '#ff6a18', ramp: 'pinned-hot', countScale: 0.96 } })
    expect(flameCore.tuning!.size![1]).toBeGreaterThanOrEqual(0.88)
    expect(flameSmoke).toMatchObject({ opacity: 0.6 })
    expect(flameSmoke.tuning!.size![1]).toBeGreaterThanOrEqual(0.9)

    const reward = planOf('reward-charge')
    const rewardGather = reward.surfaces.find((surface) => surface.phase === 'reward-charge-particle-gather')!
    const rewardOrbit = reward.surfaces.find((surface) => surface.phase === 'reward-charge-particle-receipt-orbit')!
    const rewardPayout = reward.surfaces.find((surface) => surface.phase === 'reward-charge-particle-payout-column')!
    expect(rewardGather).toMatchObject({ opacity: 0.96 })
    expect(rewardGather.tuning!.size![1]).toBeGreaterThanOrEqual(0.4)
    expect(rewardOrbit).toMatchObject({ opacity: 0.8 })
    expect(rewardOrbit.tuning!.size![1]).toBeGreaterThanOrEqual(0.34)
    expect(rewardPayout).toMatchObject({ opacity: 0.9 })
    expect(rewardPayout.tuning!.size![1]).toBeGreaterThanOrEqual(0.36)
  })

  it('keeps the flagged tuning queue clear under the documented beat and physics gates', () => {
    const flaggedIds = [
      'acid-burst', 'barrier-burst', 'curse-burst', 'blast-burst', 'combo-ring', 'curse-cone',
      'critical-hit-burst', 'electric-critical', 'embers-burst', 'flame-burst', 'ghost-critical',
      'ice-burst', 'landing-burst', 'jump-burst', 'leaf-burst', 'level-up-flare', 'marker-burst',
      'meteor-burst', 'meteor-ring', 'petal-burst', 'pickup-burst', 'poison-burst', 'rain-burst',
      'reward-burst', 'scan-cone', 'slime-burst', 'spark-cone', 'hit-spark', 'wind-impact',
      'acid-charge', 'blood-charge', 'flame-charge', 'mud-charge', 'reward-charge', 'sand-charge',
      'debris-release',
    ]
    const report = PfxLibrary.createPfxGroupReadinessReport(flaggedIds)
    expect(report.pass, `flagged queue blocked: ${report.blockedEffectIds.join(', ')}`).toBe(true)
    expect(report.rows).toHaveLength(flaggedIds.length)
  })

  it('authors ui pickup as one HUD receipt quad with a token, increment, and upward deposit language', () => {
    const preset = createPfxPreset('ui-pickup')
    const plan = getPfxRenderPlan(preset)
    const receipt = plan.surfaces.find((surface) => surface.phase === 'ui-pickup-token-rise-receipt')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(receipt).toMatchObject({
      kind: 'screen-plane',
      role: 'screen',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'screen-space-pickup-receipt-quad',
        meshShader: 'ui-pickup-receipt',
        lifecycle: 'ui-pickup-collect-rise-deposit',
        blend: 'alpha',
        colorOverride: '#ffcf4d',
        positionOffset: [1.35, 1.45, 0],
        turbulenceScale: 0,
      },
    })
    expect(receipt!.scale).toBeCloseTo(0.52)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxUiPickupMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxUiPickupLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxUiPickupRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0.02)).toMatchObject({ stage: 'collect' })
    expect(createLifecycle(0.22)).toMatchObject({ stage: 'rise', opacity: 1 })
    expect(createLifecycle(0.45)).toMatchObject({ stage: 'deposit', opacity: 1 })
    expect(createLifecycle(0.68)).toMatchObject({ stage: 'decay' })
    expect(createLifecycle(0.86)).toEqual({ progress: 1, opacity: 0, stage: 'rest' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, rise: 0, stage: 'rest' }
    expect(createRuntimeState(0.54, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'deposit', rise: 1 })

    const material = createMaterial(receipt!.opacity, '#fbbf24', '#f472b6', 0.38, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual([
      'uColorA',
      'uColorB',
      'uCycle',
      'uDensity',
      'uOpacity',
      'uPickupMask',
      'uStyleEdgeHardness',
    ])
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.fragmentShader).toContain('token = styleMask.g')
    expect(material.fragmentShader).toContain('increment = styleMask.b')
    expect(material.fragmentShader).toContain('chevrons = styleMask.a')
    expect(material.fragmentShader).toContain('upperChevron = step(0.54, vPickupUv.y)')
    expect(material.fragmentShader).toContain('step(0.3, uDensity)')
    expect(material.fragmentShader).toContain('neonStyle = step(0.5, uStyleEdgeHardness)')
    expect(material.fragmentShader).toContain('diagonalFrameGate = step(0.36, abs(vPickupUv.x - vPickupUv.y))')
    expect(material.fragmentShader).toContain('mix(0.1, 0.22, neonStyle)')
    expect(material.fragmentShader).toContain('step(vec4(0.46), pickupMask)')
    expect(material.fragmentShader).toContain('texture2D(uPickupMask')
    expect(material.fragmentShader).not.toContain('sin(')
    expect(material.fragmentShader).not.toContain('length(')
    expect(material.fragmentShader).not.toContain('smoothstep(')
    expect(material.userData).toMatchObject({
      pfxUiPickupMaterial: true,
      pfxUiPickupDrawCalls: 1,
      pfxUiPickupTriangles: 2,
      pfxUiPickupParticleCount: 0,
      pfxUiPickupFragmentTranscendentalOps: 0,
      pfxUiPickupFragmentTextureSamples: 1,
      pfxUiPickupTransientAllocationsPerFrame: 0,
      pfxUiPickupMeshJustification: 'screen-space-quad-for-procedural-pickup-receipt',
    })
    const alternate = createMaterial(receipt!.opacity, '#22d3ee', '#a855f7', 1, 0.8) as THREE.ShaderMaterial
    expect(alternate.uniforms['uPickupMask']!.value).toBe(material.uniforms['uPickupMask']!.value)
    expect(alternate.uniforms['uColorB']!.value).not.toEqual(material.uniforms['uColorB']!.value)
    alternate.dispose()
    material.dispose()
  })

  it('authors target spawn as a grounded acquisition reticle with a vertical confirmation pin', () => {
    const preset = createPfxPreset('target-spawn')
    const plan = getPfxRenderPlan(preset)
    const reticle = plan.surfaces.find((surface) => surface.phase === 'target-spawn-acquisition-reticle')
    const pin = plan.surfaces.find((surface) => surface.phase === 'target-spawn-confirmation-pin')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(reticle).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.94,
      tuning: {
        meshGeometry: 'target-spawn-acquisition-quad',
        meshShader: 'target-spawn-reticle',
        lifecycle: 'target-spawn-acquire-confirm-release',
        blend: 'alpha',
        colorOverride: '#72d7ff',
        positionOffset: [0, 0.03, 0],
        turbulenceScale: 0,
      },
    })
    expect(pin).toMatchObject({
      kind: 'screen-plane',
      role: 'aura',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'target-spawn-confirmation-pin-quad',
        meshShader: 'target-spawn-pin',
        lifecycle: 'target-spawn-acquire-confirm-release',
        blend: 'alpha',
        colorOverride: '#e8f8ff',
        positionOffset: [0, 0.82, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(reticle!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(pin!)).toBe(true)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxTargetSpawnMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxTargetSpawnLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxTargetSpawnRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toMatchObject({ stage: 'acquire', opacity: 0.28 })
    expect(createLifecycle(0.04)).toMatchObject({ stage: 'acquire' })
    expect(createLifecycle(0.28)).toMatchObject({ stage: 'lock', opacity: 1 })
    expect(createLifecycle(0.52)).toMatchObject({ stage: 'confirm', opacity: 1 })
    expect(createLifecycle(0.72)).toMatchObject({ stage: 'release' })
    expect(createLifecycle(0.9)).toEqual({ progress: 1, opacity: 0, stage: 'rest' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, lift: 0, stage: 'rest' }
    expect(createRuntimeState(0.54, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'confirm', lift: 1 })

    const reticleMaterial = createMaterial('reticle', reticle!.opacity, '#72d7ff', '#ffcf4d', 0.42, 0.22) as THREE.ShaderMaterial
    const pinMaterial = createMaterial('pin', pin!.opacity, '#72d7ff', '#ffcf4d', 0.42, 0.78) as THREE.ShaderMaterial
    for (const material of [reticleMaterial, pinMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uCycle',
        'uDensity',
        'uOpacity',
        'uStyleEdgeHardness',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect(material.fragmentShader).not.toContain('smoothstep(')
    }
    expect(reticleMaterial.fragmentShader).toContain('cornerBrackets')
    expect(reticleMaterial.fragmentShader).toContain('lockPips')
    expect(reticleMaterial.fragmentShader).toContain('centerDiamond')
    expect(reticleMaterial.fragmentShader).toContain('step(0.3, uDensity)')
    expect(reticleMaterial.fragmentShader).toContain('neonStyle = step(0.5, uStyleEdgeHardness)')
    expect(reticleMaterial.fragmentShader).toContain('diagonalGate')
    expect(pinMaterial.fragmentShader).toContain('verticalStem')
    expect(pinMaterial.fragmentShader).toContain('targetDiamond')
    expect(pinMaterial.fragmentShader).toContain('confirmBars')
    expect(pinMaterial.userData).toMatchObject({
      pfxTargetSpawnMaterial: true,
      pfxTargetSpawnDrawCalls: 1,
      pfxTargetSpawnTriangles: 2,
      pfxTargetSpawnParticleCount: 0,
      pfxTargetSpawnFragmentTextureSamples: 0,
      pfxTargetSpawnTransientAllocationsPerFrame: 0,
      pfxTargetSpawnMeshJustification: 'crossed-ground-reticle-and-camera-facing-confirmation-pin',
    })
    pinMaterial.dispose()
    reticleMaterial.dispose()
  })

  it('authors warning loop as a persistent hazard boundary with an alert beacon and readable cadence', () => {
    const preset = createPfxPreset('warning-loop')
    const plan = getPfxRenderPlan(preset)
    const panel = plan.surfaces.find((surface) => surface.phase === 'warning-loop-octagonal-boundary')
    const beacon = plan.surfaces.find((surface) => surface.phase === 'warning-loop-alert-beacon')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field' || surface.kind === 'core-sphere')).toBe(false)
    expect(panel).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.9,
      tuning: {
        meshGeometry: 'warning-loop-panel-quad',
        meshShader: 'warning-loop-panel',
        lifecycle: 'warning-loop-inhale-alert-exhale',
        blend: 'alpha',
        colorOverride: '#ff5b35',
        positionOffset: [0, 0.025, 0],
        turbulenceScale: 0,
      },
    })
    expect(beacon).toMatchObject({
      kind: 'screen-plane',
      role: 'aura',
      opacity: 0.88,
      tuning: {
        meshGeometry: 'warning-loop-beacon-quad',
        meshShader: 'warning-loop-beacon',
        lifecycle: 'warning-loop-inhale-alert-exhale',
        blend: 'alpha',
        colorOverride: '#ffd166',
        positionOffset: [0, 0.68, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(panel!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(beacon!)).toBe(true)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxWarningLoopMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxWarningLoopLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxWarningLoopRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.42, pulse: 0, stage: 'inhale' })
    expect(createLifecycle(0.3)).toMatchObject({ stage: 'alert', opacity: 1 })
    expect(createLifecycle(0.52)).toMatchObject({ stage: 'hold', opacity: 0.92, pulse: 1 })
    expect(createLifecycle(0.78)).toMatchObject({ stage: 'exhale' })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0.42, pulse: 0, stage: 'inhale' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, pulse: 0, lift: 0, stage: 'inhale' }
    expect(createRuntimeState(0.54, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'hold', pulse: 1, lift: 1 })

    const panelMaterial = createMaterial('panel', panel!.opacity, '#ff5b35', '#ffd166', 0.42, 0.22) as THREE.ShaderMaterial
    const beaconMaterial = createMaterial('beacon', beacon!.opacity, '#ff5b35', '#ffd166', 0.42, 0.78) as THREE.ShaderMaterial
    for (const material of [panelMaterial, beaconMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uCycle',
        'uDensity',
        'uOpacity',
        'uPulse',
        'uStyleEdgeHardness',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? [])).toHaveLength(2)
    }
    expect(panelMaterial.fragmentShader).toContain('octagonBoundary')
    expect(panelMaterial.fragmentShader).toContain('warningTriangle')
    expect(panelMaterial.fragmentShader).toContain('cadenceBars')
    expect(panelMaterial.fragmentShader).toContain('step(0.3, uDensity)')
    expect(panelMaterial.fragmentShader).toContain('neonStyle = step(0.5, uStyleEdgeHardness)')
    expect(panelMaterial.fragmentShader).toContain('cornerCutGate')
    expect(beaconMaterial.fragmentShader).toContain('exclamationStem')
    expect(beaconMaterial.fragmentShader).toContain('exclamationDot')
    expect(beaconMaterial.fragmentShader).toContain('sideTicks')
    expect(beaconMaterial.userData).toMatchObject({
      pfxWarningLoopMaterial: true,
      pfxWarningLoopDrawCalls: 1,
      pfxWarningLoopTriangles: 2,
      pfxWarningLoopParticleCount: 0,
      pfxWarningLoopFragmentTextureSamples: 0,
      pfxWarningLoopTransientAllocationsPerFrame: 0,
      pfxWarningLoopMeshJustification: 'ground-hazard-panel-with-camera-facing-alert-beacon',
    })
    beaconMaterial.dispose()
    panelMaterial.dispose()
  })

  it('authors marker release as opening ground clamps with a lifted confirmation badge', () => {
    const preset = createPfxPreset('marker-release')
    const plan = getPfxRenderPlan(preset)
    const clamps = plan.surfaces.find((surface) => surface.phase === 'marker-release-opening-clamps')
    const badge = plan.surfaces.find((surface) => surface.phase === 'marker-release-lifted-confirmation')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field' || surface.kind === 'core-sphere')).toBe(false)
    expect(clamps).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.92,
      tuning: {
        meshGeometry: 'marker-release-ground-quad',
        meshShader: 'marker-release-ground',
        lifecycle: 'marker-release-clamp-confirm-lift-settle',
        blend: 'alpha',
        positionOffset: [0, 0.03, 0],
        turbulenceScale: 0,
      },
    })
    expect(badge).toMatchObject({
      kind: 'screen-plane',
      role: 'aura',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'marker-release-badge-quad',
        meshShader: 'marker-release-badge',
        lifecycle: 'marker-release-clamp-confirm-lift-settle',
        blend: 'alpha',
        positionOffset: [0, 0.42, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(clamps!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(badge!)).toBe(true)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxMarkerReleaseMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxMarkerReleaseLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxMarkerReleaseRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.32, expansion: 0, lift: 0, stage: 'clamp' })
    expect(createLifecycle(0.26)).toMatchObject({ stage: 'confirm', opacity: 1 })
    expect(createLifecycle(0.55)).toMatchObject({ stage: 'release' })
    expect(createLifecycle(0.86)).toMatchObject({ stage: 'settle' })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, expansion: 1, lift: 1, stage: 'settle' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, expansion: 0, lift: 0, stage: 'clamp' }
    expect(createRuntimeState(0.46, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'release' })

    const groundMaterial = createMaterial('ground', clamps!.opacity, '#f8fafc', '#60a5fa', 0.4, 0.22) as THREE.ShaderMaterial
    const badgeMaterial = createMaterial('badge', badge!.opacity, '#f8fafc', '#60a5fa', 0.4, 0.78) as THREE.ShaderMaterial
    for (const material of [groundMaterial, badgeMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uDensity',
        'uExpansion',
        'uOpacity',
        'uProgress',
        'uStyleEdgeHardness',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? [])).toHaveLength(2)
    }
    expect(groundMaterial.fragmentShader).toContain('diamondAnchor')
    expect(groundMaterial.fragmentShader).toContain('cornerClamps')
    expect(groundMaterial.fragmentShader).toContain('releaseRails')
    expect(groundMaterial.fragmentShader).toContain('step(0.3, uDensity)')
    expect(badgeMaterial.fragmentShader).toContain('confirmationCheck')
    expect(badgeMaterial.fragmentShader).toContain('diamondBadge')
    expect(badgeMaterial.fragmentShader).toContain('liftTrails')
    expect(badgeMaterial.userData).toMatchObject({
      pfxMarkerReleaseMaterial: true,
      pfxMarkerReleaseDrawCalls: 1,
      pfxMarkerReleaseTriangles: 2,
      pfxMarkerReleaseParticleCount: 0,
      pfxMarkerReleaseFragmentTextureSamples: 0,
      pfxMarkerReleaseTransientAllocationsPerFrame: 0,
      pfxMarkerReleaseMeshJustification: 'ground-clamp-plane-with-camera-facing-release-badge',
    })
    badgeMaterial.dispose()
    groundMaterial.dispose()
  })

  it('authors scan cone as a grounded sector with a volumetric sweeping shell', () => {
    const preset = createPfxPreset('scan-cone')
    const plan = getPfxRenderPlan(preset)
    const footprint = plan.surfaces.find((surface) => surface.phase === 'scan-cone-ground-sector')
    const volume = plan.surfaces.find((surface) => surface.phase === 'scan-cone-volumetric-sweep')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(footprint).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.9,
      tuning: {
        meshGeometry: 'scan-cone-ground-quad',
        meshShader: 'scan-cone-footprint',
        lifecycle: 'scan-cone-acquire-sweep-resolve',
        blend: 'alpha',
        positionOffset: [0, 0.025, 0],
        turbulenceScale: 0,
      },
    })
    expect(volume).toMatchObject({
      kind: 'muzzle-cone',
      role: 'volume',
      opacity: 0.72,
      tuning: {
        meshGeometry: 'scan-cone-volume-sector',
        meshShader: 'scan-cone-volume',
        lifecycle: 'scan-cone-acquire-sweep-resolve',
        blend: 'alpha',
        positionOffset: [0.18, 0.16, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(footprint!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(volume!)).toBe(false)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxScanConeMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxScanConeLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxScanConeRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.3, sweep: 0, range: 0.22, stage: 'acquire' })
    expect(createLifecycle(0.25)).toMatchObject({ stage: 'sweep', opacity: 1 })
    expect(createLifecycle(0.64)).toMatchObject({ stage: 'sweep' })
    expect(createLifecycle(0.84)).toMatchObject({ stage: 'resolve' })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, sweep: 1, range: 1, stage: 'resolve' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, sweep: 0, range: 0, stage: 'acquire' }
    expect(createRuntimeState(0.525, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'sweep' })

    const groundMaterial = createMaterial('footprint', footprint!.opacity, '#f8fafc', '#60a5fa', 0.4, 0.22) as THREE.ShaderMaterial
    const volumeMaterial = createMaterial('volume', volume!.opacity, '#f8fafc', '#60a5fa', 0.4, 0.78) as THREE.ShaderMaterial
    for (const material of [groundMaterial, volumeMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uDensity',
        'uOpacity',
        'uProgress',
        'uStyleEdgeHardness',
        'uSweep',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? [])).toHaveLength(2)
    }
    expect(groundMaterial.fragmentShader).toContain('coneFootprint')
    expect(groundMaterial.fragmentShader).toContain('vec2 p = vec2(0.9 - vScanUv.x, vScanUv.y - 0.5)')
    expect(groundMaterial.fragmentShader).toContain('boundaryRails')
    expect(groundMaterial.fragmentShader).toContain('scanFront')
    expect(groundMaterial.fragmentShader).toContain('step(0.3, uDensity)')
    expect(volumeMaterial.fragmentShader).toContain('coneShell')
    expect(volumeMaterial.fragmentShader).toContain('scanBand')
    expect(volumeMaterial.fragmentShader).toContain('dataRibs')
    expect(volumeMaterial.userData).toMatchObject({
      pfxScanConeMaterial: true,
      pfxScanConeDrawCalls: 1,
      pfxScanConeTriangles: 24,
      pfxScanConeParticleCount: 0,
      pfxScanConeFragmentTextureSamples: 0,
      pfxScanConeTransientAllocationsPerFrame: 0,
      pfxScanConeMeshJustification: 'partial-cone-shell-proves-scan-volume-and-side-view-parallax',
    })
    volumeMaterial.dispose()
    groundMaterial.dispose()
  })

  it('authors hologram break as a sliced figure collapse into a grounded projector residue', () => {
    const preset = createPfxPreset('hologram-break')
    const plan = getPfxRenderPlan(preset)
    const figure = plan.surfaces.find((surface) => surface.phase === 'hologram-break-sliced-figure')
    const projector = plan.surfaces.find((surface) => surface.phase === 'hologram-break-projector-residue')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field')).toBe(false)
    expect(figure).toMatchObject({
      kind: 'screen-plane',
      role: 'body',
      opacity: 0.95,
      tuning: {
        meshGeometry: 'hologram-break-figure-quad',
        meshShader: 'hologram-break-figure',
        lifecycle: 'hologram-break-stabilize-fracture-collapse',
        blend: 'alpha',
        positionOffset: [0, 0.9, 0],
        turbulenceScale: 0,
      },
    })
    expect(projector).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.82,
      tuning: {
        meshGeometry: 'hologram-break-projector-quad',
        meshShader: 'hologram-break-projector',
        lifecycle: 'hologram-break-stabilize-fracture-collapse',
        blend: 'alpha',
        positionOffset: [0, 0.03, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(figure!)).toBe(true)
    expect(isPfxSurfaceCameraFacing(projector!)).toBe(false)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxHologramBreakMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxHologramBreakLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxHologramBreakRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.45, breakAmount: 0, scan: 0.08, collapse: 0, stage: 'stabilize' })
    expect(createLifecycle(0.35)).toMatchObject({ stage: 'fracture', opacity: 1 })
    expect(createLifecycle(0.72)).toMatchObject({ stage: 'collapse' })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, breakAmount: 1, scan: 1, collapse: 1, stage: 'collapse' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, breakAmount: 0, scan: 0, collapse: 0, stage: 'stabilize' }
    expect(createRuntimeState(0.55, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'fracture' })

    const figureMaterial = createMaterial('figure', figure!.opacity, '#8cf5ff', '#eefcff', 0.55, 0.22) as THREE.ShaderMaterial
    const projectorMaterial = createMaterial('projector', projector!.opacity, '#63d8ee', '#d8fbff', 0.55, 0.78) as THREE.ShaderMaterial
    for (const material of [figureMaterial, projectorMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uBreakAmount',
        'uCollapse',
        'uColorA',
        'uColorB',
        'uDensity',
        'uOpacity',
        'uProgress',
        'uScan',
        'uStyleEdgeHardness',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    }
    expect(figureMaterial.fragmentShader).toContain('hologramFigure')
    expect(figureMaterial.fragmentShader).toContain('sliceOffset')
    expect(figureMaterial.fragmentShader).toContain('fragmentCells')
    expect(projectorMaterial.fragmentShader).toContain('projectorDiamond')
    expect(projectorMaterial.fragmentShader).toContain('brokenBrackets')
    expect(projectorMaterial.fragmentShader).toContain('collapseTrace')
    expect(figureMaterial.userData).toMatchObject({
      pfxHologramBreakMaterial: true,
      pfxHologramBreakDrawCalls: 1,
      pfxHologramBreakTriangles: 2,
      pfxHologramBreakParticleCount: 0,
      pfxHologramBreakFragmentTextureSamples: 0,
      pfxHologramBreakTransientAllocationsPerFrame: 0,
      pfxHologramBreakMeshJustification: 'camera-facing-sliced-figure-with-grounded-projector-quad',
    })
    projectorMaterial.dispose()
    figureMaterial.dispose()
  })

  it('authors thruster trail as a closed tapered plume with a source nozzle aperture', () => {
    const preset = createPfxPreset('thruster-trail')
    const plan = getPfxRenderPlan(preset)
    const plume = plan.surfaces.find((surface) => surface.phase === 'thruster-trail-volumetric-plume')
    const nozzle = plan.surfaces.find((surface) => surface.phase === 'thruster-trail-source-nozzle')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'tapered-trail')).toBe(false)
    expect(plume).toMatchObject({
      kind: 'muzzle-cone',
      role: 'trail',
      opacity: 0.92,
      tuning: {
        meshGeometry: 'thruster-trail-closed-plume',
        meshShader: 'thruster-trail-plume',
        lifecycle: 'thruster-trail-ignite-sustain-cutoff',
        blend: 'alpha',
        positionOffset: [-0.4, 0.24, 0],
        turbulenceScale: 0,
      },
    })
    expect(nozzle).toMatchObject({
      kind: 'impact-core',
      role: 'body',
      opacity: 0.96,
      tuning: {
        meshGeometry: 'thruster-trail-nozzle-disc',
        meshShader: 'thruster-trail-nozzle',
        lifecycle: 'thruster-trail-ignite-sustain-cutoff',
        blend: 'alpha',
        positionOffset: [0.86, 0.24, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(plume!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(nozzle!)).toBe(false)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxThrusterTrailMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxThrusterTrailLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxThrusterTrailRuntimeState
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.35, flow: 0, thrust: 0.3, cutoff: 0, stage: 'ignite' })
    expect(createLifecycle(0.4)).toMatchObject({ stage: 'sustain', opacity: 1, thrust: 1 })
    expect(createLifecycle(0.86)).toMatchObject({ stage: 'cutoff' })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, flow: 1, thrust: 0.45, cutoff: 1, stage: 'cutoff' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, flow: 0, thrust: 0, cutoff: 0, stage: 'ignite' }
    expect(createRuntimeState(0.6, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'sustain' })

    const plumeMaterial = createMaterial('plume', plume!.opacity, '#ff5a1f', '#fff2cc', 0.55, 0.22) as THREE.ShaderMaterial
    const nozzleMaterial = createMaterial('nozzle', nozzle!.opacity, '#ff5a1f', '#fff2cc', 0.55, 0.78) as THREE.ShaderMaterial
    for (const material of [plumeMaterial, nozzleMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uCutoff',
        'uDensity',
        'uFlow',
        'uOpacity',
        'uProgress',
        'uStyleEdgeHardness',
        'uThrust',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    }
    expect(plumeMaterial.fragmentShader).toContain('volumetricPlume')
    expect(plumeMaterial.fragmentShader).toContain('travelingCompression')
    expect(plumeMaterial.fragmentShader).toContain('cutoffErosion')
    expect(plumeMaterial.fragmentShader).toContain('arcGate')
    expect(plumeMaterial.fragmentShader).toContain('ignitionMask')
    expect(plumeMaterial.fragmentShader).toContain('directionalCutoff')
    expect(nozzleMaterial.fragmentShader).toContain('nozzleAperture')
    expect(nozzleMaterial.fragmentShader).toContain('hotCore')
    expect(nozzleMaterial.fragmentShader).toContain('triVanes')
    expect(nozzleMaterial.fragmentShader).toContain('outerCollar')
    expect(plumeMaterial.userData).toMatchObject({
      pfxThrusterTrailMaterial: true,
      pfxThrusterTrailDrawCalls: 1,
      pfxThrusterTrailTriangles: 144,
      pfxThrusterTrailParticleCount: 0,
      pfxThrusterTrailFragmentTextureSamples: 0,
      pfxThrusterTrailTransientAllocationsPerFrame: 0,
      pfxThrusterTrailMeshJustification: 'closed-tapered-plume-with-source-nozzle-aperture',
    })
    nozzleMaterial.dispose()
    plumeMaterial.dispose()
  })

  it('authors exhaust telegraph as a stable directional danger lane with a mechanical vent release', () => {
    const preset = createPfxPreset('exhaust-telegraph')
    const plan = getPfxRenderPlan(preset)
    const lane = plan.surfaces.find((surface) => surface.phase === 'exhaust-telegraph-danger-lane')
    const vent = plan.surfaces.find((surface) => surface.phase === 'exhaust-telegraph-source-vent')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(preset.controls.color).toEqual(['#ff8a3d', '#fff0c2'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'ring-field' || surface.kind === 'cloud-volume')).toBe(false)
    expect(lane).toMatchObject({
      kind: 'telegraph-disc',
      role: 'aura',
      opacity: 0.94,
      tuning: {
        meshGeometry: 'exhaust-telegraph-warning-lane',
        meshShader: 'exhaust-telegraph-lane',
        lifecycle: 'exhaust-telegraph-arm-countdown-vent',
        blend: 'alpha',
        positionOffset: [-0.28, 0.025, 0],
        turbulenceScale: 0,
      },
    })
    expect(vent).toMatchObject({
      kind: 'impact-core',
      role: 'body',
      opacity: 0.9,
      tuning: {
        meshGeometry: 'exhaust-telegraph-source-vent',
        meshShader: 'exhaust-telegraph-vent',
        lifecycle: 'exhaust-telegraph-arm-countdown-vent',
        blend: 'alpha',
        positionOffset: [1.05, 0.28, 0],
        turbulenceScale: 0,
      },
    })
    expect(isPfxSurfaceCameraFacing(lane!)).toBe(false)
    expect(isPfxSurfaceCameraFacing(vent!)).toBe(false)

    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxExhaustTelegraphMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxExhaustTelegraphLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxExhaustTelegraphRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxExhaustTelegraphStyleTreatment
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.42, urgency: 0, ventOpen: 0, release: 0, stage: 'arm' })
    expect(createLifecycle(0.4)).toMatchObject({ stage: 'countdown', opacity: 1, ventOpen: 0 })
    expect(createLifecycle(0.84)).toMatchObject({ stage: 'vent', urgency: 1 })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, urgency: 1, ventOpen: 1, release: 1, stage: 'vent' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, urgency: 0, ventOpen: 0, release: 0, stage: 'arm' }
    expect(createRuntimeState(0.6, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'countdown' })

    const laneMaterial = createMaterial('lane', lane!.opacity, '#ff8a3d', '#fff0c2', 0.55, 0.22) as THREE.ShaderMaterial
    const ventMaterial = createMaterial('vent', vent!.opacity, '#6f7782', '#ffcf85', 0.55, 0.78) as THREE.ShaderMaterial
    const magentaGoldMaterial = createMaterial('lane', lane!.opacity, '#f43f8f', '#fbbf24', 0.55, 0.22) as THREE.ShaderMaterial
    const greenWhiteMaterial = createMaterial('lane', lane!.opacity, '#34d399', '#f8fafc', 0.55, 0.22) as THREE.ShaderMaterial
    for (const material of [laneMaterial, ventMaterial]) {
      expect(Object.keys(material.uniforms).sort()).toEqual([
        'uColorA',
        'uColorB',
        'uDensity',
        'uOpacity',
        'uProgress',
        'uRelease',
        'uStyleEdgeHardness',
        'uUrgency',
        'uVentOpen',
      ])
      expect(material.blending).toBe(THREE.NormalBlending)
      expect(material.depthWrite).toBe(false)
      expect(material.fragmentShader).not.toContain('texture2D(')
      expect(material.fragmentShader).not.toContain('sin(')
      expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    }
    expect(laneMaterial.fragmentShader).toContain('stableDangerBoundary')
    expect(laneMaterial.fragmentShader).toContain('directionalLane')
    expect(laneMaterial.fragmentShader).toContain('cautionChevrons')
    expect(laneMaterial.fragmentShader).toContain('countdownSegments')
    expect(laneMaterial.fragmentShader).toContain('sourceLockNotch')
    expect(laneMaterial.fragmentShader).toContain('neonChevronCount')
    expect(laneMaterial.fragmentShader).toContain('cozyFill')
    expect(laneMaterial.fragmentShader).toContain('neonCountdownRails')
    expect(ventMaterial.fragmentShader).toContain('ventAperture')
    expect(ventMaterial.fragmentShader).toContain('mechanicalShutters')
    expect(ventMaterial.fragmentShader).toContain('pressureCore')
    expect(ventMaterial.fragmentShader).toContain('releaseGate')
    expect(ventMaterial.fragmentShader).toContain('cozyDiamondShutters')
    expect(ventMaterial.fragmentShader).toContain('neonCrossShutters')
    expect(createStyleTreatment(0.22)).toEqual({ chevronTopology: 'four-broad', countdownLayout: 'center-bars', fillTreatment: 'matte', shutterTopology: 'diamond' })
    expect(createStyleTreatment(0.78)).toEqual({ chevronTopology: 'six-narrow', countdownLayout: 'edge-rails', fillTreatment: 'outline', shutterTopology: 'cross' })
    expect((magentaGoldMaterial.uniforms.uColorA!.value as THREE.Vector3).toArray()).toEqual(new THREE.Color('#f43f8f').toArray())
    expect((greenWhiteMaterial.uniforms.uColorA!.value as THREE.Vector3).toArray()).toEqual(new THREE.Color('#34d399').toArray())
    expect(laneMaterial.userData).toMatchObject({
      pfxExhaustTelegraphMaterial: true,
      pfxExhaustTelegraphDrawCalls: 1,
      pfxExhaustTelegraphTriangles: 2,
      pfxExhaustTelegraphParticleCount: 0,
      pfxExhaustTelegraphFragmentTextureSamples: 0,
      pfxExhaustTelegraphTransientAllocationsPerFrame: 0,
      pfxExhaustTelegraphMeshJustification: 'stable-directional-danger-lane-with-mechanical-source-vent',
    })
    expect(ventMaterial.userData).toMatchObject({
      pfxExhaustTelegraphTriangles: 48,
    })
    laneMaterial.dispose()
    ventMaterial.dispose()
    magentaGoldMaterial.dispose()
    greenWhiteMaterial.dispose()
  })

  it('authors flame burst as a three-layer particle blossom with peel-and-char decay', () => {
    const preset = createPfxPreset('flame-burst')
    const plan = getPfxRenderPlan(preset)
    const blossom = plan.surfaces.find((surface) => surface.phase === 'flame-burst-particle-upward-licks')
    const cinders = plan.surfaces.find((surface) => surface.phase === 'flame-burst-particle-hot-cinders')
    const smoke = plan.surfaces.find((surface) => surface.phase === 'flame-burst-particle-char-smoke')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(preset.controls.color).toEqual(['#ff7a18', '#ffd166'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(blossom).toMatchObject({
      kind: 'particles',
      role: 'impact',
      opacity: 0.96,
      tuning: {
        motion: 'cone-fountain',
        sprite: 'flame',
        lifecycle: 'flame-burst-particle-ignite',
        blend: 'additive',
        positionOffset: [0, 0.04, 0],
      },
    })
    expect(cinders).toMatchObject({ kind: 'particles', role: 'impact', tuning: { motion: 'radial-burst', sprite: 'ember', lifecycle: 'flame-burst-particle-ignite' } })
    expect(smoke).toMatchObject({ kind: 'particles', role: 'volume', tuning: { motion: 'drift-cloud', sprite: 'smoke-variants', lifecycle: 'flame-burst-particle-ignite' } })
    expect(blossom!.scale).toBeCloseTo(1.081)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxFlameBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxFlameBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxFlameBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxFlameBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxFlameBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('position').count / 3).toBe(480)
    expect(geometry.getAttribute('aTongueId').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({
      pfxFlameBurstGeometry: true,
      pfxFlameBurstTongueCount: 5,
      pfxFlameBurstClosedTongues: true,
      pfxFlameBurstTriangles: 480,
      pfxFlameBurstConnectedComponents: 5,
    })
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1.1)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(0.9)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(0.65)

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.32, bloom: 0.16, heat: 0.42, peel: 0, cool: 0, stage: 'ignite' })
    expect(createLifecycle(0.24)).toMatchObject({ stage: 'ignite', opacity: 1, bloom: 1, heat: 1 })
    expect(createLifecycle(0.45)).toMatchObject({ stage: 'blossom', opacity: 1, heat: 1 })
    expect(createLifecycle(0.82)).toMatchObject({ stage: 'peel', peel: expect.any(Number), cool: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, bloom: 1, heat: 0.18, peel: 1, cool: 1, stage: 'peel' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, bloom: 0, heat: 0, peel: 0, cool: 0, stage: 'ignite' }
    expect(createRuntimeState(0.675, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.5, stage: 'blossom' })

    const cozy = createStyleTreatment(0.22)
    const neon = createStyleTreatment(0.78)
    expect(cozy).toEqual({ tongueTopology: 'three-broad', materialResponse: 'matte-banded', peelCadence: 'sequential', residue: 'char-front' })
    expect(neon).toEqual({ tongueTopology: 'five-narrow', materialResponse: 'edge-veined', peelCadence: 'synchronized', residue: 'cell-erode' })

    const material = createMaterial(blossom!.opacity, '#ff7a18', '#ffd166', 0.55, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual([
      'uBloom',
      'uColorA',
      'uColorB',
      'uCool',
      'uDensity',
      'uHeat',
      'uOpacity',
      'uPeel',
      'uProgress',
      'uStyleEdgeHardness',
    ])
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D(')
    expect(material.fragmentShader).not.toContain('sin(')
    expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.fragmentShader).toContain('threeBroadTongues')
    expect(material.fragmentShader).toContain('fiveNarrowTongues')
    expect(material.fragmentShader).toContain('matteBandedBody')
    expect(material.fragmentShader).toContain('edgeVeinedBody')
    expect(material.fragmentShader).toContain('charFront')
    expect(material.fragmentShader).toContain('cellErode')
    expect(material.vertexShader).toContain('sequentialPeel')
    expect(material.vertexShader).toContain('synchronizedPeel')
    expect(material.userData).toMatchObject({
      pfxFlameBurstMaterial: true,
      pfxFlameBurstDrawCalls: 1,
      pfxFlameBurstTriangles: 480,
      pfxFlameBurstParticleCount: 0,
      pfxFlameBurstFragmentTextureSamples: 0,
      pfxFlameBurstTransientAllocationsPerFrame: 0,
      pfxFlameBurstMeshJustification: 'five-closed-folded-flame-tongues-with-integrated-char-decay',
    })
    geometry.dispose()
    material.dispose()
  })

  it('authors meteor burst as a three-layer particle-first collision with molten ejecta and ash resolve', () => {
    const preset = createPfxPreset('meteor-burst')
    const plan = getPfxRenderPlan(preset)
    const collision = plan.surfaces.find((surface) => surface.phase === 'meteor-burst-particle-descent-contact')
    const ejecta = plan.surfaces.find((surface) => surface.phase === 'meteor-burst-particle-molten-ejecta')
    const ash = plan.surfaces.find((surface) => surface.phase === 'meteor-burst-particle-ash-resolve')

    expect(preset.mobileSafety).toBe('safe')
    expect(preset.performance.tier).toBe('low')
    expect(preset.controls.color).toEqual(['#ff7a18', '#ffd166'])
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshMotion === undefined)).toBe(true)
    expect(collision).toMatchObject({
      kind: 'particles',
      role: 'impact',
      tuning: {
        motion: 'impact-burst',
        sprite: 'glow',
        lifecycle: 'meteor-burst-particle-collision',
        colorOverride: '#fff1b8',
        blend: 'additive',
      },
    })
    expect(ejecta).toMatchObject({ kind: 'particles', role: 'impact', tuning: { motion: 'meteor-impact', sprite: 'ember', lifecycle: 'meteor-burst-particle-collision' } })
    expect(ash).toMatchObject({ kind: 'particles', role: 'volume', tuning: { motion: 'shockwave-ground-burst', sprite: 'smoke-variants', lifecycle: 'meteor-burst-particle-collision' } })
    expect(isPfxSurfaceCameraFacing(collision!)).toBe(false)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxMeteorBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxMeteorBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxMeteorBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxMeteorBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxMeteorBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('aMeteorPart').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aMeteorOrigin').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aMeteorDirection').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aMeteorSeed').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({
      pfxMeteorBurstGeometry: true,
      pfxMeteorBurstClosedComponents: true,
      pfxMeteorBurstIncomingBodyCount: 3,
      pfxMeteorBurstCollisionCrownCount: 5,
      pfxMeteorBurstEjectaCount: 8,
      pfxMeteorBurstGroundFrontCount: 7,
      pfxMeteorBurstConnectedComponents: 23,
      pfxMeteorBurstDrawCalls: 1,
    })
    expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(420)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1.5)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(1.8)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(1.3)

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.42, impact: 0, flash: 0.18, scatter: 0, cool: 0, head: 1, stage: 'descent' })
    expect(createLifecycle(0.22)).toMatchObject({ stage: 'collision', opacity: 1, impact: 1, flash: 1, head: 0.72 })
    expect(createLifecycle(0.5)).toMatchObject({ stage: 'collision', opacity: 1, impact: 1, scatter: expect.any(Number) })
    expect(createLifecycle(0.8)).toMatchObject({ stage: 'ballistic-cool', scatter: expect.any(Number), cool: expect.any(Number), head: 0 })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, impact: 1, flash: 0.08, scatter: 1, cool: 1, head: 0, stage: 'ballistic-cool' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, impact: 0, flash: 0, scatter: 0, cool: 0, head: 0, stage: 'descent' }
    expect(createRuntimeState(0.5822, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.41, stage: 'collision' })

    expect(createStyleTreatment(0.22)).toEqual({ chunkTopology: 'five-broad-ejecta', materialResponse: 'matte-lava-strata', impactCadence: 'staggered-ballistic', groundFront: 'broken-wedge-fan' })
    expect(createStyleTreatment(0.78)).toEqual({ chunkTopology: 'eight-narrow-ejecta', materialResponse: 'edge-hot-fissures', impactCadence: 'synchronized-rail', groundFront: 'split-chevron-front' })

    const material = createMaterial(collision!.opacity, '#ff7a18', '#ffd166', 0.38, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual([
      'uColorA',
      'uColorB',
      'uCool',
      'uDensity',
      'uFlash',
      'uHead',
      'uImpact',
      'uOpacity',
      'uProgress',
      'uScatter',
      'uStyleEdgeHardness',
    ])
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D(')
    expect(material.fragmentShader).not.toContain('sin(')
    expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.vertexShader).toContain('staggeredBallistic')
    expect(material.vertexShader).toContain('synchronizedRail')
    expect(material.fragmentShader).toContain('fiveBroadEjecta')
    expect(material.fragmentShader).toContain('eightNarrowEjecta')
    expect(material.fragmentShader).toContain('matteLavaStrata')
    expect(material.fragmentShader).toContain('edgeHotFissures')
    expect(material.fragmentShader).toContain('brokenWedgeFan')
    expect(material.fragmentShader).toContain('splitChevronFront')
    expect(material.userData).toMatchObject({
      pfxMeteorBurstMaterial: true,
      pfxMeteorBurstDrawCalls: 1,
      pfxMeteorBurstParticleCount: 0,
      pfxMeteorBurstFragmentTextureSamples: 0,
      pfxMeteorBurstTransientAllocationsPerFrame: 0,
      pfxMeteorBurstMeshJustification: 'oblique-meteor-collision-with-integrated-crown-ejecta-and-broken-ground-front',
    })
    geometry.dispose()
    material.dispose()
  })

  it('authors blast burst as a three-layer particle pressure rupture', () => {
    const preset = createPfxPreset('blast-burst')
    const plan = getPfxRenderPlan(preset)
    const rupture = plan.surfaces.find((surface) => surface.phase === 'blast-burst-particle-pressure-core')
    const slugs = plan.surfaces.find((surface) => surface.phase === 'blast-burst-particle-radial-slugs')
    const pressure = plan.surfaces.find((surface) => surface.phase === 'blast-burst-particle-ground-pressure')

    expect(preset.mobileSafety).toBe('caution')
    expect(preset.performance.tier).toBe('high')
    expect(preset.controls.color).toEqual(['#ff7a18', '#ffd166'])
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(rupture).toMatchObject({
      kind: 'particles',
      role: 'impact',
      opacity: 0.98,
      tuning: {
        motion: 'impact-burst',
        sprite: 'glow',
        lifecycle: 'blast-burst-particle-rupture',
        blend: 'additive',
        colorOverride: '#fff0bd',
      },
    })
    expect(slugs).toMatchObject({ kind: 'particles', role: 'impact', tuning: { motion: 'radial-burst', sprite: 'debris', lifecycle: 'blast-burst-particle-rupture' } })
    expect(pressure).toMatchObject({ kind: 'particles', role: 'volume', tuning: { motion: 'shockwave-ground-burst', sprite: 'puff', lifecycle: 'blast-burst-particle-rupture' } })
    expect(rupture!.scale).toBeCloseTo(0.989)
    expect(slugs!.scale).toBeCloseTo(1.173)
    expect(pressure!.scale).toBeCloseTo(1.403)
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense)).toBe(true)

    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxBlastBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxBlastBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxBlastBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxBlastBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxBlastBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function')
    expect(createMaterial).toBeTypeOf('function')
    expect(createLifecycle).toBeTypeOf('function')
    expect(createRuntimeState).toBeTypeOf('function')
    expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return

    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('aBlastPart').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aBlastOrigin').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aBlastDirection').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aBlastSeed').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({
      pfxBlastBurstGeometry: true,
      pfxBlastBurstClosedComponents: true,
      pfxBlastBurstCompressionCoreCount: 1,
      pfxBlastBurstPressurePlateCount: 6,
      pfxBlastBurstSlugCount: 12,
      pfxBlastBurstWakeSpearCount: 6,
      pfxBlastBurstConnectedComponents: 25,
      pfxBlastBurstDrawCalls: 1,
    })
    expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(420)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1.7)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(2)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(1.7)

    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.48, compression: 1, breach: 0, flash: 0.18, scatter: 0, vacuum: 0, stage: 'compression' })
    expect(createLifecycle(0.18)).toMatchObject({ stage: 'breach', opacity: 1, compression: 0, breach: 1, flash: 1 })
    expect(createLifecycle(0.48)).toMatchObject({ stage: 'breach', opacity: 1, breach: 1, scatter: expect.any(Number) })
    expect(createLifecycle(0.78)).toMatchObject({ stage: 'vacuum-tail', scatter: expect.any(Number), vacuum: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, compression: 0, breach: 1, flash: 0.06, scatter: 1, vacuum: 1, stage: 'vacuum-tail' })
    const reusableRuntimeState = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, breach: 0, flash: 0, scatter: 0, vacuum: 0, stage: 'compression' }
    expect(createRuntimeState(0.496, 1, 1, 1, 1, reusableRuntimeState)).toBe(reusableRuntimeState)
    expect(reusableRuntimeState).toMatchObject({ cycle: 0.4, stage: 'breach' })

    expect(createStyleTreatment(0.22)).toEqual({ cageTopology: 'six-broad-pressure-plates', materialResponse: 'matte-compression-strata', launchCadence: 'staggered-tumble', wakeStructure: 'broken-cross-spears' })
    expect(createStyleTreatment(0.78)).toEqual({ cageTopology: 'six-narrow-containment-ribs', materialResponse: 'edge-hot-pressure-facets', launchCadence: 'synchronized-bolt-out', wakeStructure: 'split-octant-spears' })

    const material = createMaterial(rupture!.opacity, '#ff7a18', '#ffd166', 0.72, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual([
      'uBreach',
      'uColorA',
      'uColorB',
      'uCompression',
      'uDensity',
      'uFlash',
      'uOpacity',
      'uProgress',
      'uScatter',
      'uStyleEdgeHardness',
      'uVacuum',
    ])
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.transparent).toBe(false)
    expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D(')
    expect(material.fragmentShader).not.toContain('sin(')
    expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.vertexShader).toContain('staggeredTumble')
    expect(material.vertexShader).toContain('synchronizedBoltOut')
    expect(material.fragmentShader).toContain('sixBroadPressurePlates')
    expect(material.fragmentShader).toContain('sixNarrowContainmentRibs')
    expect(material.fragmentShader).toContain('matteCompressionStrata')
    expect(material.fragmentShader).toContain('edgeHotPressureFacets')
    expect(material.fragmentShader).toContain('brokenCrossSpears')
    expect(material.fragmentShader).toContain('splitOctantSpears')
    expect(material.userData).toMatchObject({
      pfxBlastBurstMaterial: true,
      pfxBlastBurstDrawCalls: 1,
      pfxBlastBurstParticleCount: 0,
      pfxBlastBurstFragmentTextureSamples: 0,
      pfxBlastBurstTransientAllocationsPerFrame: 0,
      pfxBlastBurstMeshJustification: 'airborne-compression-cage-with-integrated-pressure-plates-ballistic-slugs-and-wake-spears',
    })
    geometry.dispose()
    material.dispose()
  })

  it('authors shockwave burst as one bowed segmented pressure front with clean attenuation', () => {
    const preset = createPfxPreset('shockwave-burst')
    const plan = getPfxRenderPlan(preset)
    const front = plan.surfaces.find((surface) => surface.phase === 'shockwave-burst-bowed-pressure-front')
    expect(preset.mobileSafety).toBe('caution')
    expect(preset.performance.tier).toBe('high')
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'cloud-volume')).toBe(false)
    expect(front).toMatchObject({
      kind: 'impact-shards', role: 'impact', opacity: 0.98,
      tuning: { meshGeometry: 'shockwave-burst-broken-pressure-dome', meshShader: 'shockwave-burst-pressure-front', lifecycle: 'shockwave-burst-compress-expand-attenuate', blend: 'alpha', ringPurpose: 'shockwave', positionOffset: [0, 0.18, 0], turbulenceScale: 0 },
    })
    expect(front!.scale).toBeCloseTo(1.104, 8)
    expect(isPfxSurfaceCameraFacing(front!)).toBe(false)
    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxShockwaveBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxShockwaveBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxShockwaveBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxShockwaveBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxShockwaveBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function'); expect(createMaterial).toBeTypeOf('function'); expect(createLifecycle).toBeTypeOf('function'); expect(createRuntimeState).toBeTypeOf('function'); expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return
    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('aShockPart').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aShockOrigin').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aShockDirection').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aShockSeed').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({ pfxShockwaveBurstGeometry: true, pfxShockwaveBurstClosedComponents: true, pfxShockwaveBurstCompressionLensCount: 1, pfxShockwaveBurstPressureArcCount: 14, pfxShockwaveBurstPressureFleckCount: 8, pfxShockwaveBurstConnectedComponents: 23, pfxShockwaveBurstDrawCalls: 1 })
    expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(420)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(2.2)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(2.2)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0.9)
    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.55, compression: 1, expansion: 0, front: 0.08, attenuation: 0, stage: 'compression' })
    expect(createLifecycle(0.16)).toMatchObject({ stage: 'expansion', opacity: 1, compression: 0, expansion: 1, front: expect.any(Number) })
    expect(createLifecycle(0.52)).toMatchObject({ stage: 'expansion', expansion: 1, front: expect.any(Number) })
    expect(createLifecycle(0.8)).toMatchObject({ stage: 'attenuation', front: expect.any(Number), attenuation: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, compression: 0, expansion: 1, front: 1, attenuation: 1, stage: 'attenuation' })
    const reusable = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, expansion: 0, front: 0, attenuation: 0, stage: 'compression' }
    expect(createRuntimeState(0.472, 1, 1, 1, 1, reusable)).toBe(reusable)
    expect(reusable).toMatchObject({ cycle: 0.4, stage: 'expansion' })
    expect(createStyleTreatment(0.22)).toEqual({ arcTopology: 'ten-broad-pressure-arcs', materialResponse: 'matte-air-strata', propagationCadence: 'staggered-front', domeProfile: 'rounded-bow' })
    expect(createStyleTreatment(0.78)).toEqual({ arcTopology: 'fourteen-narrow-pressure-arcs', materialResponse: 'edge-hot-refraction', propagationCadence: 'synchronized-front', domeProfile: 'split-chevron-bow' })
    const material = createMaterial(front!.opacity, '#ff7a18', '#ffd166', 0.72, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual(['uAttenuation', 'uColorA', 'uColorB', 'uCompression', 'uDensity', 'uExpansion', 'uFront', 'uOpacity', 'uProgress', 'uStyleEdgeHardness'])
    expect(material.blending).toBe(THREE.NormalBlending); expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D('); expect(material.fragmentShader).not.toContain('sin('); expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.vertexShader).toContain('staggeredFront'); expect(material.vertexShader).toContain('synchronizedFront')
    expect(material.fragmentShader).toContain('tenBroadPressureArcs'); expect(material.fragmentShader).toContain('fourteenNarrowPressureArcs'); expect(material.fragmentShader).toContain('matteAirStrata'); expect(material.fragmentShader).toContain('edgeHotRefraction'); expect(material.fragmentShader).toContain('roundedBow'); expect(material.fragmentShader).toContain('splitChevronBow')
    expect(material.userData).toMatchObject({ pfxShockwaveBurstMaterial: true, pfxShockwaveBurstDrawCalls: 1, pfxShockwaveBurstParticleCount: 0, pfxShockwaveBurstFragmentTextureSamples: 0, pfxShockwaveBurstTransientAllocationsPerFrame: 0, pfxShockwaveBurstMeshJustification: 'bowed-segmented-pressure-front-with-integrated-compression-lens-and-force-flecks' })
    geometry.dispose(); material.dispose()
  })

  it('authors dust burst as one grounded rolling pigment crown with a clean settle', () => {
    const preset = createPfxPreset('dust-burst')
    const plan = getPfxRenderPlan(preset)
    const crown = plan.surfaces.find((surface) => surface.phase === 'dust-burst-radial-rolling-crown')
    expect(preset.performance.tier).toBe('medium')
    expect(preset.controls.color).toEqual(['#d6a66f', '#e2c99b'])
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'impact-sparks' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(crown).toMatchObject({
      kind: 'cloud-volume', role: 'volume', opacity: 0.94,
      tuning: { meshGeometry: 'dust-burst-grounded-crown', meshShader: 'dust-burst-pigment-roll', lifecycle: 'dust-burst-compress-roll-settle', blend: 'alpha', positionOffset: [0, -0.42, 0], turbulenceScale: 0 },
    })
    expect(crown!.scale).toBeCloseTo(0.966, 8)
    expect(isPfxSurfaceCameraFacing(crown!)).toBe(false)
    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxDustBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxDustBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxDustBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxDustBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxDustBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function'); expect(createMaterial).toBeTypeOf('function'); expect(createLifecycle).toBeTypeOf('function'); expect(createRuntimeState).toBeTypeOf('function'); expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return
    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('aDustPart').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDustOrigin').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDustDirection').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDustSeed').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({ pfxDustBurstGeometry: true, pfxDustBurstClosedComponents: true, pfxDustBurstContactCoreCount: 1, pfxDustBurstRollLobeCount: 12, pfxDustBurstGroundSkirtCount: 10, pfxDustBurstGritChipCount: 8, pfxDustBurstConnectedComponents: 31, pfxDustBurstDrawCalls: 1 })
    expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(1000)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(2.1)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(2.1)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(0.55)
    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.72, compression: 1, roll: 0, loft: 0, settle: 0, stage: 'contact' })
    expect(createLifecycle(0.12)).toMatchObject({ stage: 'roll', opacity: 1, compression: 0, roll: 0, loft: 0 })
    expect(createLifecycle(0.5)).toMatchObject({ stage: 'roll', roll: expect.any(Number), loft: expect.any(Number), settle: 0 })
    expect(createLifecycle(0.8)).toMatchObject({ stage: 'settle', roll: 1, loft: 1, settle: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, compression: 0, roll: 1, loft: 1, settle: 1, stage: 'settle' })
    const reusable = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, compression: 0, roll: 0, loft: 0, settle: 0, stage: 'contact' }
    expect(createRuntimeState(0.54, 1, 1, 1, 1, reusable)).toBe(reusable)
    expect(reusable).toMatchObject({ cycle: 0.4, stage: 'roll' })
    expect(createStyleTreatment(0.22)).toEqual({ crownTopology: 'eight-broad-roll-lobes', materialResponse: 'matte-pigment-bands', rolloutCadence: 'staggered-ground-roll', crownProfile: 'rounded-crown' })
    expect(createStyleTreatment(0.78)).toEqual({ crownTopology: 'twelve-cut-roll-lobes', materialResponse: 'edge-lit-pigment-facets', rolloutCadence: 'synchronized-ground-roll', crownProfile: 'split-crown' })
    const material = createMaterial(crown!.opacity, '#b99764', '#e2c99b', 0.66, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual(['uColorA', 'uColorB', 'uCompression', 'uDensity', 'uLoft', 'uOpacity', 'uProgress', 'uRoll', 'uSettle', 'uStyleEdgeHardness'])
    expect(material.blending).toBe(THREE.NormalBlending); expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D('); expect(material.fragmentShader).not.toContain('sin('); expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.vertexShader).toContain('staggeredGroundRoll'); expect(material.vertexShader).toContain('synchronizedGroundRoll')
    expect(material.fragmentShader).toContain('max(.16,uRoll)')
    expect(material.fragmentShader).toContain('eightBroadRollLobes'); expect(material.fragmentShader).toContain('twelveCutRollLobes'); expect(material.fragmentShader).toContain('mattePigmentBands'); expect(material.fragmentShader).toContain('edgeLitPigmentFacets'); expect(material.fragmentShader).toContain('roundedCrown'); expect(material.fragmentShader).toContain('splitCrown')
    expect(material.userData).toMatchObject({ pfxDustBurstMaterial: true, pfxDustBurstDrawCalls: 1, pfxDustBurstParticleCount: 0, pfxDustBurstFragmentTextureSamples: 0, pfxDustBurstTransientAllocationsPerFrame: 0, pfxDustBurstMeshJustification: 'grounded-radial-pigment-crown-with-integrated-contact-core-roll-lobes-skirt-and-grit' })
    geometry.dispose(); material.dispose()
  })

  it('authors debris burst as one asymmetric ballistic breakup with readable fragment hierarchy', () => {
    const preset = createPfxPreset('debris-burst')
    const plan = getPfxRenderPlan(preset)
    const breakup = plan.surfaces.find((surface) => surface.phase === 'debris-burst-asymmetric-breakup')
    expect(preset.performance.tier).toBe('medium')
    expect(preset.controls.color).toEqual(['#7c8796', '#c7a676'])
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles' || surface.kind === 'cloud-volume' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(breakup).toMatchObject({
      kind: 'impact-shards', role: 'impact', opacity: 0.98,
      tuning: { meshGeometry: 'debris-burst-fractured-mass', meshShader: 'debris-burst-ballistic-breakup', lifecycle: 'debris-burst-fracture-eject-fall', blend: 'alpha', positionOffset: [0, -0.18, 0], turbulenceScale: 0 },
    })
    expect(breakup!.scale).toBeCloseTo(0.9775, 8)
    expect(isPfxSurfaceCameraFacing(breakup!)).toBe(false)
    const createGeometry = (PfxLibrary as Record<string, unknown>).createPfxDebrisBurstGeometry
    const createMaterial = (PfxLibrary as Record<string, unknown>).createPfxDebrisBurstMaterial
    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxDebrisBurstLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxDebrisBurstRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxDebrisBurstStyleTreatment
    expect(createGeometry).toBeTypeOf('function'); expect(createMaterial).toBeTypeOf('function'); expect(createLifecycle).toBeTypeOf('function'); expect(createRuntimeState).toBeTypeOf('function'); expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createGeometry !== 'function' || typeof createMaterial !== 'function' || typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return
    const geometry = createGeometry() as THREE.BufferGeometry
    expect(geometry.index).toBeNull()
    expect(geometry.getAttribute('aDebrisPart').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDebrisOrigin').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDebrisDirection').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDebrisAxis').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.getAttribute('aDebrisSeed').count).toBe(geometry.getAttribute('position').count)
    expect(geometry.userData).toMatchObject({ pfxDebrisBurstGeometry: true, pfxDebrisBurstClosedComponents: true, pfxDebrisBurstHeroSlabCount: 4, pfxDebrisBurstMidChipCount: 7, pfxDebrisBurstSplinterCount: 8, pfxDebrisBurstConnectedComponents: 19, pfxDebrisBurstDrawCalls: 1 })
    expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(600)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(1.3)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(1.1)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1.35)
    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.82, fracture: 0, eject: 0, fall: 0, darken: 0, stage: 'fracture' })
    expect(createLifecycle(0.12)).toMatchObject({ stage: 'eject', opacity: 1, fracture: 1, eject: 0, fall: 0 })
    expect(createLifecycle(0.45)).toMatchObject({ stage: 'eject', fracture: 1, eject: expect.any(Number), fall: 0 })
    expect(createLifecycle(0.72)).toMatchObject({ stage: 'fall', fracture: 1, eject: 1, fall: expect.any(Number), darken: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, fracture: 1, eject: 1, fall: 1, darken: 1, stage: 'fall' })
    const reusable = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, fracture: 0, eject: 0, fall: 0, darken: 0, stage: 'fracture' }
    expect(createRuntimeState(0.56, 1, 1, 1, 1, reusable)).toBe(reusable)
    expect(reusable).toMatchObject({ cycle: 0.4, stage: 'eject' })
    expect(createStyleTreatment(0.22)).toEqual({ fragmentTopology: 'broad-chiseled-slabs', materialResponse: 'soft-stone-facets', breakupCadence: 'staggered-chunk-fan', fractureProfile: 'rounded-break' })
    expect(createStyleTreatment(0.78)).toEqual({ fragmentTopology: 'sharp-cut-fragments', materialResponse: 'edge-lit-fractures', breakupCadence: 'synchronized-shatter', fractureProfile: 'split-break' })
    const material = createMaterial(breakup!.opacity, '#7c8796', '#c7a676', 0.66, 0.22) as THREE.ShaderMaterial
    expect(Object.keys(material.uniforms).sort()).toEqual(['uColorA', 'uColorB', 'uDarken', 'uDensity', 'uEject', 'uFall', 'uFracture', 'uOpacity', 'uProgress', 'uStyleEdgeHardness'])
    expect(material.blending).toBe(THREE.NormalBlending); expect(material.transparent).toBe(false); expect(material.depthWrite).toBe(true)
    expect(material.fragmentShader).not.toContain('texture2D('); expect(material.fragmentShader).not.toContain('sin('); expect((material.fragmentShader.match(/fwidth\(/g) ?? []).length).toBeLessThanOrEqual(2)
    expect(material.vertexShader).toContain('staggeredChunkFan'); expect(material.vertexShader).toContain('synchronizedShatter'); expect(material.vertexShader).toContain('ballisticDrop')
    expect(material.fragmentShader).toContain('broadChiseledSlabs'); expect(material.fragmentShader).toContain('sharpCutFragments'); expect(material.fragmentShader).toContain('softStoneFacets'); expect(material.fragmentShader).toContain('edgeLitFractures'); expect(material.fragmentShader).toContain('roundedBreak'); expect(material.fragmentShader).toContain('splitBreak')
    expect(material.userData).toMatchObject({ pfxDebrisBurstMaterial: true, pfxDebrisBurstDrawCalls: 1, pfxDebrisBurstParticleCount: 0, pfxDebrisBurstFragmentTextureSamples: 0, pfxDebrisBurstTransientAllocationsPerFrame: 0, pfxDebrisBurstMeshJustification: 'asymmetric-ballistic-breakup-with-hero-slabs-mid-chips-and-hard-splinters' })
    geometry.dispose(); material.dispose()
  })

  it('authors glyph trail as a compact sequential inscription wake with an integrated arcane nib', () => {
    const preset = createPfxPreset('glyph-trail')
    const plan = getPfxRenderPlan(preset)
    const chain = plan.surfaces.find((surface) => surface.phase === 'glyph-trail-sequential-inscription-wake')
    const motes = plan.surfaces.find((surface) => surface.phase === 'glyph-trail-ink-cooling-motes')

    expect(preset.controls.color).toEqual(['#61e7ff', '#a78bfa'])
    expect(plan.surfaces).toHaveLength(1)
    expect(plan.estimatedDrawCalls).toBe(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'trail-ribbon')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'tapered-trail')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)
    expect(chain).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      tuning: {
        meshGeometry: 'glyph-trail-rune-chain',
        lifecycle: 'glyph-trail-inscription',
        blend: 'alpha',
      },
    })
    expect(chain!.opacity).toBeGreaterThanOrEqual(0.9)
    expect(chain!.scale).toBeGreaterThanOrEqual(0.68)
    expect(chain!.scale).toBeLessThanOrEqual(0.9)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(chain!, 2, false)).toBe(false)
    expect(motes).toBeUndefined()

    const chainGeometry = PfxLibrary.createPfxGlyphTrailRuneChainGeometry()
    expect(chainGeometry.userData).toMatchObject({
      pfxGlyphTrailDrawCalls: 1,
      pfxGlyphTrailRuneCount: 4,
      pfxGlyphTrailLeadNibCount: 1,
      pfxGlyphTrailClosedVolume: true,
      pfxGlyphTrailWorldSpaceVolume: true,
      pfxGlyphTrailCrossedPlanes: true,
      pfxGlyphTrailGpuWriteOrder: true,
      pfxGlyphTrailIntegratedLeadNib: true,
      pfxGlyphTrailIntegratedCoolingMoteCount: 3,
      pfxGlyphTrailStrokeCrossSectionSides: 3,
    })
    expect(chainGeometry.userData['pfxGlyphTrailStrokeCount']).toBeGreaterThanOrEqual(22)
    expect(chainGeometry.userData['pfxGlyphTrailTriangleCount']).toBeLessThanOrEqual(300)
    expect(chainGeometry.userData['pfxGlyphTrailLengthSpan']).toBeGreaterThanOrEqual(2.8)
    expect(chainGeometry.userData['pfxGlyphTrailHeightSpan']).toBeGreaterThanOrEqual(0.75)
    expect(chainGeometry.userData['pfxGlyphTrailDepthSpan']).toBeGreaterThanOrEqual(1.4)
    expect(chainGeometry.getAttribute('pfxRuneOrder').count).toBe(chainGeometry.getAttribute('position').count)
    expect(new Set(Array.from(chainGeometry.getAttribute('pfxRuneOrder').array))).toEqual(new Set([0, 1, 2, 3, 4]))
    chainGeometry.dispose()

    const createLifecycle = (PfxLibrary as Record<string, unknown>).createPfxGlyphTrailLifecycle
    const createRuntimeState = (PfxLibrary as Record<string, unknown>).createPfxGlyphTrailRuntimeState
    const createStyleTreatment = (PfxLibrary as Record<string, unknown>).createPfxGlyphTrailStyleTreatment
    expect(createLifecycle).toBeTypeOf('function'); expect(createRuntimeState).toBeTypeOf('function'); expect(createStyleTreatment).toBeTypeOf('function')
    if (typeof createLifecycle !== 'function' || typeof createRuntimeState !== 'function' || typeof createStyleTreatment !== 'function') return
    expect(createLifecycle(0)).toEqual({ progress: 0, opacity: 0.65, inscription: 0, hold: 0, erode: 0, stage: 'write' })
    expect(createLifecycle(0.3)).toMatchObject({ opacity: 1, inscription: 1, stage: 'hold' })
    expect(createLifecycle(0.62)).toMatchObject({ inscription: 1, stage: 'erode', erode: expect.any(Number) })
    expect(createLifecycle(1)).toEqual({ progress: 1, opacity: 0, inscription: 1, hold: 1, erode: 1, stage: 'erode' })
    const reusable = { cycle: 0, periodSeconds: 0, progress: 0, opacity: 0, inscription: 0, hold: 0, erode: 0, stage: 'write' }
    expect(createRuntimeState(0.54, 1, 1, 1, 1, reusable)).toBe(reusable)
    expect(reusable).toMatchObject({ cycle: 0.4, stage: 'erode', erode: expect.any(Number) })
    expect(createStyleTreatment(0.22)).toEqual({ strokeTopology: 'rounded-calligraphic-strokes', materialResponse: 'soft-ink-facets', writeCadence: 'staggered-handwriting', erosionProfile: 'feathered-ink-cooling' })
    expect(createStyleTreatment(0.78)).toEqual({ strokeTopology: 'cut-arcane-strokes', materialResponse: 'edge-lit-rune-facets', writeCadence: 'synchronized-inscription', erosionProfile: 'hard-script-dissolve' })

    const material = PfxLibrary.createPfxGlyphTrailMaterial(chain!.opacity, '#61e7ff', '#a78bfa', 0.55, 0.22)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.transparent).toBe(false)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(Object.keys(material.uniforms).sort()).toEqual(['uColorA', 'uColorB', 'uCycle', 'uDensity', 'uOpacity', 'uStyleEdgeHardness'])
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(chain!.opacity)
    expect(material.uniforms['uCycle']!.value).toBe(0)
    expect(material.fragmentShader).toContain('runeGlow')
    expect(material.fragmentShader).toContain('handwrittenReveal')
    expect(material.fragmentShader).toContain('oldestRuneErode')
    expect(material.fragmentShader).toContain('earlyVisibility')
    expect(material.fragmentShader).toContain('discard')
    expect(material.fragmentShader).toContain('softInkFacets')
    expect(material.fragmentShader).toContain('edgeLitRuneFacets')
    expect(material.fragmentShader).not.toContain('viewDirection')
    expect(material.fragmentShader).not.toContain('fresnel')
    expect(material.fragmentShader).not.toContain('texture2D(')
    expect(material.userData).toMatchObject({ pfxGlyphTrailMaterial: true, pfxGlyphTrailDrawCalls: 1, pfxGlyphTrailParticleCount: 0, pfxGlyphTrailFragmentTextureSamples: 0, pfxGlyphTrailFragmentNormalizeOps: 1, pfxGlyphTrailTransientAllocationsPerFrame: 0, pfxGlyphTrailMeshJustification: 'integrated-arcane-nib-with-sequential-closed-prism-handwriting-wake' })
    const librarySource = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    const glyphTrailMaterialMemo = librarySource.slice(librarySource.indexOf('const impactShardMaterial = useMemo('), librarySource.indexOf('useEffect(() => () => impactShardMaterial?.dispose()'))
    expect(glyphTrailMaterialMemo).toContain("controls.color[0], controls.color[1], controls.color[2], controls.density, materialProps.color, materialProps.opacity, styleProfile.edgeHardness")
    PfxLibrary.applyPfxGlyphTrailMaterialOpacity(material, 0.31)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.31)
    PfxLibrary.applyPfxGlyphTrailMaterialCycle(material, 0.18)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.18)
    material.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(chain!, preset.controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(chain!, preset.controls, 0.12, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(chain!, preset.controls, 0.32, 1, 1)
    const rest = PfxLibrary.getPfxSurfaceAnimationProps(chain!, preset.controls, 0.62, 1, 1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.45)
    expect(onset.scaleMultiplier).toBeGreaterThanOrEqual(0.55)
    expect(onset.scaleMultiplier).toBeLessThanOrEqual(0.82)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(peak.scaleMultiplier).toBeGreaterThanOrEqual(0.95)
    expect(decay.opacityMultiplier).toBeGreaterThanOrEqual(0.2)
    expect(decay.opacityMultiplier).toBeLessThan(peak.opacityMultiplier)
    expect(decay.scaleMultiplier).toBeLessThan(peak.scaleMultiplier)
    expect(rest.opacityMultiplier).toBeLessThanOrEqual(0.05)
  })

  it('authors beam telegraph as a two-draw warning lane with mesh-integrated countdown accents', () => {
    const preset = createPfxPreset('beam-telegraph')
    const plan = getPfxRenderPlan(preset)
    const lane = plan.surfaces.find((surface) => surface.phase === 'beam-telegraph-raised-warning-lane')
    const aperture = plan.surfaces.find((surface) => surface.phase === 'beam-telegraph-source-aperture')
    const sparks = plan.surfaces.find((surface) => surface.phase === 'beam-telegraph-countdown-sparks')

    expect(preset.controls.color).toEqual(['#f04418', '#8eefff'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(lane).toMatchObject({
      kind: 'impact-shards',
      role: 'aura',
      tuning: {
        meshGeometry: 'beam-telegraph-warning-lane',
        lifecycle: 'beam-telegraph-countdown',
        blend: 'alpha',
      },
    })
    expect(lane!.scale).toBeGreaterThanOrEqual(1)
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(lane!, 2, false)).toBe(false)
    expect(aperture).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      tuning: {
        meshGeometry: 'beam-telegraph-source-aperture',
        lifecycle: 'beam-telegraph-countdown',
        blend: 'alpha',
      },
    })
    expect(sparks).toBeUndefined()

    const laneGeometry = PfxLibrary.createPfxBeamTelegraphLaneGeometry()
    expect(laneGeometry.userData).toMatchObject({
      pfxBeamTelegraphDrawCalls: 1,
      pfxBeamTelegraphClosedVolume: true,
      pfxBeamTelegraphRailCount: 2,
      pfxBeamTelegraphChevronCount: 4,
      pfxBeamTelegraphDirectionalAxis: 'positive-x',
      pfxBeamTelegraphConstantWidthLane: true,
      pfxBeamTelegraphChevronIntensityGradient: true,
      pfxBeamTelegraphThreatPalette: 'red-amber-white',
      pfxBeamTelegraphIntegratedCountdownAccentCount: 4,
      pfxBeamTelegraphParticleCount: 0,
    })
    expect(laneGeometry.userData['pfxBeamTelegraphLengthSpan']).toBeGreaterThanOrEqual(3.2)
    expect(laneGeometry.userData['pfxBeamTelegraphWidthSpan']).toBeGreaterThanOrEqual(1.15)
    expect(laneGeometry.userData['pfxBeamTelegraphHeightSpan']).toBeLessThanOrEqual(0.3)
    expect(laneGeometry.userData['pfxBeamTelegraphSourceWidth']).toBeGreaterThanOrEqual(0.85)
    expect(laneGeometry.userData['pfxBeamTelegraphTargetWidth']).toBeGreaterThanOrEqual(0.85)
    expect(Math.abs(
      laneGeometry.userData['pfxBeamTelegraphSourceWidth'] - laneGeometry.userData['pfxBeamTelegraphTargetWidth'],
    )).toBeLessThanOrEqual(0.05)
    laneGeometry.dispose()

    const apertureGeometry = PfxLibrary.createPfxBeamTelegraphApertureGeometry()
    expect(apertureGeometry.userData).toMatchObject({
      pfxBeamTelegraphApertureDrawCalls: 1,
      pfxBeamTelegraphApertureClosedVolume: true,
      pfxBeamTelegraphApertureWorldSpaceVolume: true,
      pfxBeamTelegraphApertureSegmentCount: 6,
      pfxBeamTelegraphApertureOpenGate: true,
      pfxBeamTelegraphAperturePurpose: 'muzzle-focus',
      pfxBeamTelegraphApertureThroatRibCount: 2,
    })
    expect(apertureGeometry.userData['pfxBeamTelegraphApertureFaceCount']).toBeGreaterThanOrEqual(96)
    expect(apertureGeometry.userData['pfxBeamTelegraphApertureCrossSection']).toBeGreaterThanOrEqual(1.05)
    expect(apertureGeometry.userData['pfxBeamTelegraphApertureDepthSpan']).toBeGreaterThanOrEqual(0.5)
    apertureGeometry.dispose()
    expect(PfxLibrary.shouldApplyPfxSurfaceCameraFacing(aperture!, 2, false)).toBe(false)

    const material = PfxLibrary.createPfxBeamTelegraphMaterial(lane!.opacity, 'lane', '#f04418', '#8eefff', 0.56, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(lane!.opacity)
    expect(material.uniforms['uCycle']!.value).toBe(0)
    expect(Object.keys(material.uniforms).sort()).toEqual(['uAperture', 'uCycle', 'uDensity', 'uOpacity', 'uPrimaryColor', 'uSecondaryColor', 'uStyleEdgeHardness'])
    expect(material.fragmentShader).toContain('lanePulse')
    expect(material.fragmentShader).toContain('energyNoise')
    expect(material.fragmentShader).toContain('scanRibbon')
    expect(material.fragmentShader).toContain('threatAmber')
    expect(material.fragmentShader).toContain('fieldReveal')
    expect(material.fragmentShader).toContain('dissolveNoise')
    expect(material.fragmentShader).toContain('irisPulse')
    expect(material.fragmentShader).toContain('sourceCyan')
    expect(material.fragmentShader).toContain('uPrimaryColor')
    expect(material.fragmentShader).toContain('uSecondaryColor')
    expect(material.fragmentShader).toContain('uDensity')
    expect(material.fragmentShader).toContain('uStyleEdgeHardness')
    expect(material.fragmentShader).toContain('controlledThreatColor')
    expect(material.userData['pfxBeamTelegraphEnergyTexture']).toBe('procedural-scrolling-multiband-field')
    expect(material.userData['pfxBeamTelegraphPalette']).toBe('warm-threat-with-cool-source-accent')
    expect(material.userData['pfxBeamTelegraphBloomDiscipline']).toBe('crisp-alpha-field-with-additive-soft-current')
    PfxLibrary.applyPfxBeamTelegraphMaterialAppearance(material, 0.28, 0.42)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.28)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.42)
    material.dispose()

    const onset = PfxLibrary.getPfxSurfaceAnimationProps(lane!, preset.controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(lane!, preset.controls, 0.32, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(lane!, preset.controls, 0.58, 1, 1)
    const clear = PfxLibrary.getPfxSurfaceAnimationProps(lane!, preset.controls, 0.86, 1, 1)
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.6)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(peak.scaleMultiplier).toBeGreaterThanOrEqual(0.95)
    expect(decay.opacityMultiplier).toBeGreaterThanOrEqual(0.18)
    expect(decay.opacityMultiplier).toBeLessThan(peak.opacityMultiplier)
    expect(clear.opacityMultiplier).toBe(0)
  })

  it('authors laser spray as a two-draw volumetric salvo with integrated endpoint energy', () => {
    const preset = createPfxPreset('laser-spray')
    const plan = getPfxRenderPlan(preset)
    const nozzle = plan.surfaces.find((surface) => surface.phase === 'laser-spray-volumetric-nozzle')
    const bolts = plan.surfaces.find((surface) => surface.phase === 'laser-spray-sequenced-bolt-rack')
    const ricochets = plan.surfaces.find((surface) => surface.phase === 'laser-spray-anchored-ricochets')

    expect(preset.controls.color).toEqual(['#ff3d1f', '#ffb23c'])
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'core-sphere')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'ring-field')).toBe(false)
    expect(nozzle).toMatchObject({
      kind: 'impact-shards',
      role: 'body',
      tuning: {
        meshGeometry: 'laser-spray-volumetric-nozzle',
        lifecycle: 'laser-spray-salvo',
        blend: 'alpha',
      },
    })
    expect(bolts).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      tuning: {
        meshGeometry: 'laser-spray-bolt-rack',
        lifecycle: 'laser-spray-salvo',
        blend: 'alpha',
      },
    })
    expect(ricochets).toBeUndefined()
  })

  it('builds laser spray from closed multi-depth bolt prisms and an open-bore nozzle', () => {
    const createNozzle = (PfxLibrary as unknown as {
      createPfxLaserSprayNozzleGeometry?: () => THREE.BufferGeometry
    }).createPfxLaserSprayNozzleGeometry
    const createBoltRack = (PfxLibrary as unknown as {
      createPfxLaserSprayBoltRackGeometry?: () => THREE.BufferGeometry
    }).createPfxLaserSprayBoltRackGeometry

    expect(typeof createNozzle).toBe('function')
    expect(typeof createBoltRack).toBe('function')

    const nozzle = createNozzle!()
    expect(nozzle.userData).toMatchObject({
      pfxLaserSprayNozzleDrawCalls: 1,
      pfxLaserSprayNozzleClosedVolume: true,
      pfxLaserSprayNozzleOpenBore: true,
      pfxLaserSprayNozzleFinCount: 6,
      pfxLaserSprayNozzlePurpose: 'salvo-origin',
    })
    expect(nozzle.userData['pfxLaserSprayNozzleFaceCount']).toBeGreaterThanOrEqual(24)
    expect(nozzle.userData['pfxLaserSprayNozzleDepthSpan']).toBeGreaterThanOrEqual(0.35)
    expect(nozzle.userData['pfxLaserSprayNozzleCrossSection']).toBeGreaterThanOrEqual(0.8)
    nozzle.dispose()

    const bolts = createBoltRack!()
    expect(bolts.userData).toMatchObject({
      pfxLaserSprayBoltRackDrawCalls: 1,
      pfxLaserSprayBoltRackClosedVolume: true,
      pfxLaserSprayBoltRackWorldSpaceVolume: true,
      pfxLaserSprayBoltCount: 5,
      pfxLaserSpraySegmentCount: 5,
      pfxLaserSprayEndpointCount: 5,
      pfxLaserSpraySequenceAttribute: true,
      pfxLaserSprayDirectionalAxis: 'positive-x',
      pfxLaserSprayCrossSectionSides: 8,
      pfxLaserSprayIntegratedEndpointEnergyCount: 5,
      pfxLaserSprayParticleCount: 0,
      pfxLaserSprayAsymmetricDepthFan: true,
    })
    expect(bolts.userData['pfxLaserSprayFaceCount']).toBeGreaterThanOrEqual(120)
    expect(bolts.userData['pfxLaserSprayLengthSpan']).toBeGreaterThanOrEqual(3.2)
    expect(bolts.userData['pfxLaserSprayDepthSpan']).toBeGreaterThanOrEqual(1.1)
    expect(bolts.userData['pfxLaserSprayHeightSpan']).toBeGreaterThanOrEqual(0.65)
    const sequence = bolts.getAttribute('spraySequence')
    expect(sequence).toBeInstanceOf(THREE.BufferAttribute)
    expect(sequence.count).toBe(bolts.getAttribute('position').count)
    expect(Math.min(...Array.from(sequence.array as Float32Array))).toBeGreaterThanOrEqual(0)
    expect(Math.max(...Array.from(sequence.array as Float32Array))).toBeLessThanOrEqual(1)
    bolts.dispose()
  })

  it('sequences laser spray bolts through a crisp salvo shader and clean recovery', () => {
    const createMaterial = (PfxLibrary as unknown as {
      createPfxLaserSprayMaterial?: (opacity: number, geometryKind?: 'bolts' | 'nozzle', primaryColor?: THREE.ColorRepresentation, secondaryColor?: THREE.ColorRepresentation, density?: number, styleEdgeHardness?: number) => THREE.ShaderMaterial
    }).createPfxLaserSprayMaterial
    const applyAppearance = (PfxLibrary as unknown as {
      applyPfxLaserSprayMaterialAppearance?: (material: THREE.ShaderMaterial, opacity: number, cycle: number) => void
    }).applyPfxLaserSprayMaterialAppearance

    expect(typeof createMaterial).toBe('function')
    expect(typeof applyAppearance).toBe('function')
    const material = createMaterial!(0.84, 'bolts', '#ff3d1f', '#ffb23c', 0.6, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.vertexColors).toBe(true)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(false)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.84)
    expect(material.uniforms['uCycle']!.value).toBe(0)
    expect(Object.keys(material.uniforms).sort()).toEqual(['uCycle', 'uDensity', 'uNozzle', 'uOpacity', 'uPrimaryColor', 'uSecondaryColor', 'uStyleEdgeHardness'])
    expect(material.vertexShader).toContain('spraySequence')
    expect(material.fragmentShader).toContain('salvoEnvelope')
    expect(material.fragmentShader).toContain('hotCore')
    expect(material.fragmentShader).toContain('nozzleAmber')
    expect(material.fragmentShader).toContain('controlledLaserColor')
    expect(material.userData).toMatchObject({
      pfxLaserSprayMaterial: 'sequenced-world-space-salvo',
      pfxLaserSprayShotCount: 5,
      pfxLaserSprayBlendDiscipline: 'crisp-alpha-bolts-with-additive-endpoint-ricochets',
      pfxLaserSprayPalette: 'unified-red-orange-amber-energy',
    })
    applyAppearance!(material, 0.36, 0.42)
    expect(material.uniforms['uOpacity']!.value).toBeCloseTo(0.36)
    expect(material.uniforms['uCycle']!.value).toBeCloseTo(0.42)
    material.dispose()

    const plan = getPfxRenderPlan(createPfxPreset('laser-spray'))
    const bolts = plan.surfaces.find((surface) => surface.phase === 'laser-spray-sequenced-bolt-rack')!
    const onset = PfxLibrary.getPfxSurfaceAnimationProps(bolts, createPfxPreset('laser-spray').controls, 0.04, 1, 1)
    const peak = PfxLibrary.getPfxSurfaceAnimationProps(bolts, createPfxPreset('laser-spray').controls, 0.3, 1, 1)
    const decay = PfxLibrary.getPfxSurfaceAnimationProps(bolts, createPfxPreset('laser-spray').controls, 0.58, 1, 1)
    const clear = PfxLibrary.getPfxSurfaceAnimationProps(bolts, createPfxPreset('laser-spray').controls, 0.9, 1, 1)
    expect(onset.signature).toContain('laser-spray-salvo')
    expect(onset.opacityMultiplier).toBeGreaterThanOrEqual(0.55)
    expect(peak.opacityMultiplier).toBeGreaterThanOrEqual(0.9)
    expect(decay.opacityMultiplier).toBeGreaterThanOrEqual(0.14)
    expect(decay.opacityMultiplier).toBeLessThan(peak.opacityMultiplier)
    expect(clear.opacityMultiplier).toBe(0)
  })

  it('keeps laser spray endpoint energy inside the authored bolt mesh', () => {
    const preset = createPfxPreset('laser-spray')
    expect(getPfxRenderPlan(preset).surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(PfxLibrary.summarizePfxPerformance([preset]).totalParticles).toBe(0)
  })

  it('holds all five laser strands at the salvo crest and synchronizes ricochet recovery', () => {
    const shotVisibility = (PfxLibrary as unknown as {
      getPfxLaserSprayShotVisibility?: (cycle: number, sequence: number) => number
    }).getPfxLaserSprayShotVisibility
    expect(typeof shotVisibility).toBe('function')
    const sequences = [0, 0.2, 0.4, 0.6, 0.8]
    const onset = sequences.map((sequence) => shotVisibility!(0.04, sequence))
    const peak = sequences.map((sequence) => shotVisibility!(0.32, sequence))
    const decay = sequences.map((sequence) => shotVisibility!(0.58, sequence))
    const clear = sequences.map((sequence) => shotVisibility!(0.82, sequence))
    expect(onset.filter((visibility) => visibility > 0.05)).toHaveLength(1)
    expect(Math.min(...peak)).toBeGreaterThanOrEqual(0.95)
    expect(decay.reduce((sum, visibility) => sum + visibility, 0)).toBeLessThan(
      peak.reduce((sum, visibility) => sum + visibility, 0),
    )
    expect(Math.max(...clear)).toBe(0)

    const material = PfxLibrary.createPfxLaserSprayMaterial(1, 'bolts')
    expect(material.fragmentShader).toContain('filamentBand')
    expect(material.fragmentShader).toContain('microPulse')
    expect(material.userData['pfxLaserSprayPeakStrandCount']).toBe(5)
    material.dispose()

    expect(material.userData['pfxLaserSprayIntegratedEndpointEnergyCount']).toBe(5)
    expect(material.userData['pfxLaserSprayParticleCount']).toBe(0)
  })

  it('varies laser spray source and endpoint silhouettes while preserving readable bookends', () => {
    const nozzle = PfxLibrary.createPfxLaserSprayNozzleGeometry()
    expect(nozzle.userData).toMatchObject({
      pfxLaserSprayNozzleFinCount: 6,
      pfxLaserSprayNozzleFinVariantCount: 6,
      pfxLaserSprayNozzleConnectorCount: 0,
      pfxLaserSprayNozzleConnectedCage: false,
      pfxLaserSprayNozzlePetalGeometry: true,
    })
    nozzle.dispose()

    const bolts = PfxLibrary.createPfxLaserSprayBoltRackGeometry()
    expect(bolts.userData).toMatchObject({
      pfxLaserSprayEndpointCount: 5,
      pfxLaserSprayEndpointAccentVariantCount: 0,
      pfxLaserSprayRepeatedCrossMarkers: false,
    })
    bolts.dispose()

    expect(PfxLibrary.getPfxLaserSprayShotVisibility(0.04, 0)).toBeGreaterThanOrEqual(0.95)
    const recovery = [0, 0.2, 0.4, 0.6, 0.8].map(
      (sequence) => PfxLibrary.getPfxLaserSprayShotVisibility(0.72, sequence),
    )
    expect(Math.max(...recovery)).toBeGreaterThanOrEqual(0.12)
    const clear = [0, 0.2, 0.4, 0.6, 0.8].map(
      (sequence) => PfxLibrary.getPfxLaserSprayShotVisibility(0.82, sequence),
    )
    expect(Math.max(...clear)).toBe(0)
  })

  it('uses open muzzle petals and seamless tapered laser prisms instead of frames and paddles', () => {
    const nozzle = PfxLibrary.createPfxLaserSprayNozzleGeometry()
    expect(nozzle.userData).toMatchObject({
      pfxLaserSprayNozzleFinCount: 6,
      pfxLaserSprayNozzleConnectorCount: 0,
      pfxLaserSprayNozzleConnectedCage: false,
      pfxLaserSprayNozzlePetalGeometry: true,
      pfxLaserSprayNozzleRepeatedRailPrimitives: false,
    })
    nozzle.dispose()

    const bolts = PfxLibrary.createPfxLaserSprayBoltRackGeometry()
    expect(bolts.userData).toMatchObject({
      pfxLaserSprayBoltCount: 5,
      pfxLaserSpraySegmentCount: 5,
      pfxLaserSprayCrossSectionSides: 8,
      pfxLaserSpraySeamlessBoltBodies: true,
      pfxLaserSprayTaperedPointTips: false,
      pfxLaserSprayDiffuseTermini: true,
      pfxLaserSprayFlatPaddleMarkers: false,
    })
    bolts.dispose()

    const material = PfxLibrary.createPfxLaserSprayMaterial(1, 'nozzle')
    expect(material.vertexShader).toContain('nozzleBreath')
    material.dispose()
  })

  it('resolves laser spray as five warm energy lanes with diffuse termini and uniform recovery', () => {
    const nozzle = PfxLibrary.createPfxLaserSprayNozzleGeometry()
    expect(nozzle.userData).toMatchObject({
      pfxLaserSprayNozzleUnifiedWarmPalette: true,
      pfxLaserSprayNozzleCoolCrystalFins: false,
    })
    nozzle.dispose()

    const bolts = PfxLibrary.createPfxLaserSprayBoltRackGeometry()
    expect(bolts.userData).toMatchObject({
      pfxLaserSprayFrontLaneCount: 5,
      pfxLaserSprayEndpointAccentVariantCount: 0,
      pfxLaserSprayTaperedPointTips: false,
      pfxLaserSprayDiffuseTermini: true,
      pfxLaserSprayFlatPaddleMarkers: false,
    })
    bolts.dispose()

    const decay = [0, 0.2, 0.4, 0.6, 0.8].map(
      (sequence) => PfxLibrary.getPfxLaserSprayShotVisibility(0.58, sequence),
    )
    expect(Math.max(...decay) - Math.min(...decay)).toBeLessThanOrEqual(0.001)
    expect(Math.min(...decay)).toBeGreaterThan(0.1)
    const material = PfxLibrary.createPfxLaserSprayMaterial(1, 'bolts')
    expect(material.userData).toMatchObject({
      pfxLaserSprayUniformRecovery: true,
      pfxLaserSprayUnifiedWarmPalette: true,
    })
    expect(material.fragmentShader).toContain('terminalDissolve')
    material.dispose()
  })

  it('finishes laser spray with one-draw core halos, a radial muzzle, and visible retracting recovery', () => {
    const nozzle = PfxLibrary.createPfxLaserSprayNozzleGeometry()
    expect(nozzle.userData).toMatchObject({
      pfxLaserSprayNozzleRadialAperture: true,
      pfxLaserSprayNozzleLongitudinalFins: false,
    })
    expect(nozzle.userData['pfxLaserSprayNozzleDepthSpan']).toBeLessThanOrEqual(0.55)
    nozzle.dispose()

    const bolts = PfxLibrary.createPfxLaserSprayBoltRackGeometry()
    expect(bolts.userData).toMatchObject({
      pfxLaserSprayBoltRackDrawCalls: 1,
      pfxLaserSprayCoreShellCount: 5,
      pfxLaserSprayHaloShellCount: 5,
      pfxLaserSprayMergedCoreHalo: true,
    })
    const shell = bolts.getAttribute('sprayShell')
    expect(shell).toBeInstanceOf(THREE.BufferAttribute)
    expect(shell.count).toBe(bolts.getAttribute('position').count)
    expect(new Set(Array.from(shell.array as Float32Array))).toEqual(new Set([0, 1]))
    bolts.dispose()

    const material = PfxLibrary.createPfxLaserSprayMaterial(1, 'bolts')
    expect(material.vertexShader).toContain('recoveryRetraction')
    expect(material.fragmentShader).toContain('beamHalo')
    expect(material.fragmentShader).toContain('coreEdgeGradient')
    material.dispose()

    const preset = createPfxPreset('laser-spray')
    const boltSurface = getPfxRenderPlan(preset).surfaces.find(
      (surface) => surface.phase === 'laser-spray-sequenced-bolt-rack',
    )!
    const recovery = PfxLibrary.getPfxSurfaceAnimationProps(boltSurface, preset.controls, 0.84, 1, 1)
    expect(recovery.signature).toContain('recovery')
    expect(recovery.opacityMultiplier).toBeGreaterThan(0.05)
    expect(recovery.scaleMultiplier).toBeLessThan(0.9)

    const particleCount = getPfxRenderPlan(preset).surfaces
      .filter((surface) => surface.kind === 'particles' || surface.kind === 'impact-sparks')
      .reduce((total, surface) => total + PfxLibrary.createPfxParticleEmission(preset, surface).count, 0)
    expect(PfxLibrary.summarizePfxPerformance([preset]).totalParticles).toBe(particleCount)
    expect(particleCount).toBe(0)
  })

  it('authors plasma hit as a two-draw directional flipbook volume with an integrated rebound-flux rake', () => {
    const preset = createPfxPreset('plasma-hit')
    const plan = getPfxRenderPlan(preset)
    expect(preset.controls.color).toEqual(['#4ff7ff', '#8a42ff'])
    expect(preset.performance.tier).toBe('high')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(4)
    expect(plan.estimatedDrawCalls).toBe(2)
    expect(plan.surfaces).toHaveLength(2)
    expect(plan.surfaces.some((surface) => surface.kind === 'particles')).toBe(false)
    expect(plan.surfaces.every((surface) => surface.scale <= 0.92)).toBe(true)
    expect(plan.surfaces.every((surface) => (surface.tuning?.positionOffset?.[0] ?? 0) >= 1.1)).toBe(true)
    expect(plan.surfaces.every((surface) => (surface.tuning?.positionOffset?.[1] ?? 0) >= 0.08)).toBe(true)
    expect(plan.surfaces.some((surface) => surface.kind === 'shockwave-ring')).toBe(false)
    expect(plan.surfaces.some((surface) => surface.kind === 'impact-core')).toBe(false)
    expect(plan.surfaces.find((surface) => surface.tuning?.meshShader === 'plasma-impact-flipbook')).toMatchObject({
      kind: 'core-sphere',
      role: 'body',
    })
    expect(plan.surfaces.find((surface) => surface.tuning?.meshGeometry === 'plasma-hit-broken-flux-arcs')).toMatchObject({
      kind: 'impact-shards',
      role: 'trail',
      phase: 'plasma-hit-rebounding-flux-rake',
    })
    expect(plan.surfaces.every((surface) => surface.tuning?.lifecycle === 'plasma-hit-discharge')).toBe(true)

    expect(PfxLibrary.PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS).toMatchObject({
      id: 'original-plasma-impact-16',
      license: 'project-original',
      columns: 4,
      rows: 4,
      frameCount: 16,
      width: 512,
      height: 512,
    })
    expect(PfxLibrary.PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.runtimeBytes).toBeLessThanOrEqual(262_144)
    expect(preset.performance.textureMemoryKb).toBe(
      Math.ceil(PfxLibrary.PFX_PLASMA_IMPACT_FLIPBOOK_ATLAS.runtimeBytes / 1024),
    )
    expect(PfxLibrary.summarizePfxPerformance([preset]).mobileSafe).toBe(true)

    const volume = PfxLibrary.createPfxPlasmaImpactVolumeGeometry()
    expect(volume.userData).toMatchObject({
      pfxPlasmaImpactVolumePlanes: 3,
      pfxPlasmaImpactDirectionalAxis: 'negative-x-projectile-arrival',
      pfxPlasmaImpactCameraFacing: false,
      pfxPlasmaImpactDrawCalls: 1,
    })
    expect(volume.getAttribute('position').count).toBe(18)
    expect(volume.getAttribute('uv').count).toBe(18)
    expect(volume.getAttribute('normal').count).toBe(18)
    volume.dispose()

    const flux = PfxLibrary.createPfxPlasmaHitFluxGeometry()
    expect(flux.userData).toMatchObject({
      pfxPlasmaHitFluxDrawCalls: 1,
      pfxPlasmaHitFluxClosedVolume: true,
      pfxPlasmaHitFluxPrimaryCount: 3,
      pfxPlasmaHitFluxForkCount: 3,
      pfxPlasmaHitFluxCrossSectionSides: 8,
      pfxPlasmaHitFluxDirectionalFan: true,
      pfxPlasmaHitFluxCompactRootNexus: true,
      pfxPlasmaHitFluxRootCenterSpanY: 0.05,
      pfxPlasmaHitFluxRootCenterSpanZ: 0.03,
      pfxPlasmaHitFluxSmoothPeel: true,
      pfxPlasmaHitFluxCompleteRingCount: 0,
    })
    expect(flux.boundingBox!.max.x - flux.boundingBox!.min.x).toBeGreaterThanOrEqual(1.2)
    expect(flux.boundingBox!.max.x - flux.boundingBox!.min.x).toBeLessThanOrEqual(1.45)
    expect(flux.boundingBox!.max.z - flux.boundingBox!.min.z).toBeGreaterThanOrEqual(0.8)
    flux.dispose()

    const flipbookMaterial = PfxLibrary.createPfxPlasmaImpactFlipbookMaterial(1, '#4ff7ff', '#8a42ff', 0.72, 0.54)
    expect(flipbookMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(flipbookMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(flipbookMaterial.depthWrite).toBe(false)
    expect(flipbookMaterial.uniforms['uColumns']?.value).toBe(4)
    expect(flipbookMaterial.uniforms['uRows']?.value).toBe(4)
    expect(flipbookMaterial.uniforms['uFrameCount']?.value).toBe(16)
    expect(flipbookMaterial.userData).toMatchObject({
      pfxPlasmaImpactFlipbook: 'original-plasma-impact-16',
      pfxPlasmaImpactFlipbookLicense: 'project-original',
      pfxPlasmaImpactVolumePlanes: 3,
      pfxPlasmaImpactBillboardCount: 0,
    })
    expect(flipbookMaterial.side).toBe(THREE.DoubleSide)
    expect(flipbookMaterial.fragmentShader).toContain('2.0 + floor(playback * 8.0)')
    expect(flipbookMaterial.fragmentShader).toContain('cardFacing')
    expect(flipbookMaterial.fragmentShader).toContain('smoothstep(0.08, 0.26, cardFacing)')
    expect(flipbookMaterial.fragmentShader).not.toContain('atan(')
    expect(flipbookMaterial.fragmentShader).not.toContain('exp(')
    expect(flipbookMaterial.fragmentShader).toContain('brokenMagneticArc')
    expect(flipbookMaterial.fragmentShader).toContain('controlledPlasmaColor')
    expect(flipbookMaterial.fragmentShader).toContain('crossedCardEnergyBudget')
    expect(flipbookMaterial.userData).toMatchObject({
      pfxPlasmaImpactControlBinding: 'primary-secondary-density-style',
      pfxPlasmaImpactCrossedCardEnergyBudget: 0.64,
    })
    flipbookMaterial.dispose()

    const material = PfxLibrary.createPfxPlasmaHitMaterial(1, 'contact', '#4ff7ff', '#8a42ff', 0.72, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.vertexShader).toContain('contactCompression')
    expect(material.vertexShader).toContain('directionalPeel')
    expect(material.vertexShader).toContain('impactOrigin')
    expect(material.fragmentShader).toContain('plasmaFilament')
    expect(material.fragmentShader).toContain('erosionFront')
    expect(material.fragmentShader).toContain('softCorona')
    expect(material.fragmentShader).toContain('tubeRoundLight')
    expect(material.fragmentShader).toContain('filamentLayer')
    expect(material.fragmentShader).toContain('erosionCutoff')
    expect(material.userData).toMatchObject({
      pfxPlasmaHitMaterial: 'cyan-violet-hot-white-discharge',
      pfxPlasmaHitMaterialLayer: 'volumetric-contact',
      pfxPlasmaHitRingDiscipline: 'three-primary-three-fork-asymmetric-magnetic-streamers',
      pfxPlasmaHitGlowModel: 'controlled-flipbook-contact-additive-closed-flux-corona',
      pfxPlasmaHitControlBinding: 'primary-secondary-density-style',
      pfxPlasmaHitRootWhiteEnergyBudget: 0.16,
    })
    material.dispose()

    const filamentMaterial = PfxLibrary.createPfxPlasmaHitMaterial(1, 'filament', '#4ff7ff', '#8a42ff', 0.72, 0.54)
    expect(filamentMaterial.blending).toBe(THREE.NormalBlending)
    expect(filamentMaterial.userData['pfxPlasmaHitOpaqueClosedFlux']).toBe(true)
    filamentMaterial.dispose()

    expect(PfxLibrary.summarizePfxPerformance([preset]).totalParticles).toBe(0)
  })

  it('authors electric critical as an irregular three-layer particle discharge within its mobile budget', () => {
    const preset = createPfxPreset('electric-critical')
    const plan = getPfxRenderPlan(preset)
    expect(preset.controls.color).toEqual(['#5eeaff', '#ffd45a'])
    expect(preset.performance.tier).toBe('medium')
    expect(PfxLibrary.PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]).toBe(10)
    expect(preset.controls.spawnShape).toBe('point')
    expect(plan.estimatedDrawCalls).toBe(3)
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.meshGeometry === undefined)).toBe(true)
    expect(plan.surfaces.map((surface) => surface.phase)).toEqual([
      'electric-critical-particle-contact-crack',
      'electric-critical-particle-fork-fan',
      'electric-critical-particle-charge-rise',
    ])
    const crackle = plan.surfaces[0]
    expect(crackle?.tuning).toMatchObject({ motion: 'impact-burst', sprite: 'streak', blend: 'additive', ramp: 'pinned-hot', colorOverride: '#eafcff' })
    const forks = plan.surfaces[1]
    expect(forks?.tuning).toMatchObject({ motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#5eeaff' })
    expect(forks?.tuning?.speedJitter).toBeGreaterThanOrEqual(0.5)
    expect(forks?.tuning?.spreadAngle).toBeGreaterThanOrEqual(0.7)
    expect(plan.surfaces[2]?.tuning).toMatchObject({ motion: 'column-rise', sprite: 'glow', colorOverride: '#ffd45a' })
    expect(plan.surfaces.every((surface) => typeof surface.tuning?.referenceSource === 'string')).toBe(true)

    const cage = PfxLibrary.createPfxElectricCriticalVoltageCageGeometry()
    expect(cage.userData).toMatchObject({
      pfxElectricCriticalVoltagePathCount: 18,
      pfxElectricCriticalRadialPathCount: 6,
      pfxElectricCriticalForkPathCount: 12,
      pfxElectricCriticalMicroBranchCount: 12,
      pfxElectricCriticalGroundForkCount: 0,
      pfxElectricCriticalVerticalSpineCount: 0,
      pfxElectricCriticalGroundCrawlCount: 0,
      pfxElectricCriticalContactAccentForkCount: 0,
      pfxElectricCriticalAxisPairCount: 3,
      pfxElectricCriticalCrossedAxisPathCount: 6,
      pfxElectricCriticalImpactCoreCount: 0,
      pfxElectricCriticalCriticalCrownShardCount: 0,
      pfxElectricCriticalDepthNodeCount: 0,
      pfxElectricCriticalSparkShardCount: 0,
      pfxElectricCriticalCrossSectionSides: 8,
      pfxElectricCriticalSegmentPrismCount: 42,
      pfxElectricCriticalJointNodeCount: 0,
      pfxElectricCriticalDominantAxis: 'asymmetric-six-ray-contact-burst',
      pfxElectricCriticalMainBoltRadiusScale: 1,
      pfxElectricCriticalBaseRadius: 0.11,
      pfxElectricCriticalPalette: 'white-gold-electric-cyan-deep-blue-streak-particles',
      pfxElectricCriticalFlashRayCount: 0,
      pfxElectricCriticalBraidedStrandCount: 0,
      pfxElectricCriticalCompanionStrandCount: 0,
      pfxElectricCriticalImpactPointY: 0,
      pfxElectricCriticalImpactCoreRadius: 0.26,
      pfxElectricCriticalDepthForkReach: 1.12,
      pfxElectricCriticalSecondaryForkReach: 0.46,
      pfxElectricCriticalPrimaryDepthStagger: 'alternating-positive-negative',
      pfxElectricCriticalViewSilhouette: 'crossed-critical-x-front-split-depth-rays-side',
      pfxElectricCriticalTopology: 'six-tapered-critical-rays-twelve-y-forks-and-gold-crown-nexus',
      pfxElectricCriticalAxisForkDistribution: 'diagonal4-depth2',
      pfxElectricCriticalGameplayAnchor: 'forward-contact-point',
      pfxElectricCriticalCriticalMark: 'dominant-cyan-slash-gold-crown',
      pfxElectricCriticalCriticalNexus: 'white-hot-gold-diamond',
      pfxElectricCriticalPrimarySilhouette: 'dominant-cyan-slash-with-short-support-rays',
      pfxElectricCriticalTargetEnvelope: 'compact-critical-contact-volume',
      pfxElectricCriticalFilamentWidthProfile: 'high-contrast-root-to-hairline-tip',
      pfxElectricCriticalGrounding: 'none-radial-contact',
      pfxElectricCriticalCoreExposure: 'bounded-white-hot-nexus',
      pfxElectricCriticalCriticalAccent: 'faceted-nexus-plus-white-cyan-streak-scatter',
      pfxElectricCriticalMirroredForkPairCount: 0,
      pfxElectricCriticalAsymmetricCage: true,
      pfxElectricCriticalClosedVolume: true,
      pfxElectricCriticalDrawCalls: 1,
      pfxElectricCriticalWorldSpace: true,
    })
    expect(cage.boundingBox!.max.x - cage.boundingBox!.min.x).toBeGreaterThan(1.6)
    expect(cage.boundingBox!.max.x - cage.boundingBox!.min.x).toBeLessThanOrEqual(1.85)
    expect(cage.boundingBox!.max.y - cage.boundingBox!.min.y).toBeGreaterThan(1.4)
    expect(cage.boundingBox!.max.y - cage.boundingBox!.min.y).toBeLessThanOrEqual(1.7)
    expect(cage.boundingBox!.max.z - cage.boundingBox!.min.z).toBeGreaterThan(2.2)
    expect(cage.boundingBox!.max.z - cage.boundingBox!.min.z).toBeLessThanOrEqual(2.4)
    expect(cage.getAttribute('position').count).toBeLessThanOrEqual(800)
    cage.dispose()

    const nexus = PfxLibrary.createPfxElectricCriticalNexusGeometry()
    expect(nexus.userData).toMatchObject({
      pfxElectricCriticalNexusCoreCount: 1,
      pfxElectricCriticalNexusCrownShardCount: 3,
      pfxElectricCriticalNexusCoreRadius: 0.22,
      pfxElectricCriticalNexusTopology: 'faceted-octa-core-with-three-gold-crown-shards',
      pfxElectricCriticalNexusDrawCalls: 1,
    })
    expect(nexus.getAttribute('position').count).toBeLessThanOrEqual(250)
    nexus.dispose()

    const material = PfxLibrary.createPfxElectricCriticalMaterial(1, 'core', '#5eeaff', '#ffd45a', 0.56, 0.54)
    expect(material).toBeInstanceOf(THREE.ShaderMaterial)
    expect(material.uniforms['uPrimaryColor']?.value.getHexString()).toBe('5eeaff')
    expect(material.uniforms['uSecondaryColor']?.value.getHexString()).toBe('ffd45a')
    expect(material.uniforms['uDensity']?.value).toBeCloseTo(0.56)
    expect(material.uniforms['uStyleEdgeHardness']?.value).toBeCloseTo(0.54)
    expect(material.blending).toBe(THREE.NormalBlending)
    expect(material.depthWrite).toBe(true)
    expect(material.depthTest).toBe(true)
    expect(material.side).toBe(THREE.FrontSide)
    expect(material.userData).toMatchObject({
      pfxElectricCriticalMaterial: 'directional-cyan-violet-voltage',
      pfxElectricCriticalMobileFragmentModel: 'vertex-color-faceted-core',
      pfxElectricCriticalDepthOcclusion: 'closed-volumetric-burst-depth-test',
      pfxElectricCriticalLayering: 'depth-writing-faceted-core-plus-coplanar-additive-energy',
      pfxElectricCriticalTemporalShaping: 'radial-snap-build-and-recovery-flicker',
      pfxElectricCriticalMaterialLayer: 'faceted-core',
      pfxElectricCriticalCrackleModel: 'binary-filament-bands',
      pfxElectricCriticalControlBinding: 'primary-secondary-density-style',
    })
    expect(material.vertexShader).toContain('strikeBuild')
    expect(material.vertexShader).toContain('recoveryFlicker')
    expect(material.vertexShader).toContain('animated = position * mix(0.12, 1.0, strikeBuild)')
    expect(material.vertexShader).toContain('float reachBand = smoothstep(0.1, 1.0, length(position))')
    expect(material.vertexShader).toContain('uHaloLayer * 0.025')
    expect(material.fragmentShader).toContain('surfaceFacing')
    expect(material.fragmentShader).toContain('depthShading')
    expect(material.fragmentShader).toContain('facetLight')
    expect(material.fragmentShader).toContain('0.16 + 0.84')
    expect(material.fragmentShader).toContain('fresnel * 0.32')
    expect(material.fragmentShader).toContain('hotCore * 0.7')
    expect(material.fragmentShader).toContain('float tipExposure = 0.2')
    expect(material.fragmentShader).toContain('filamentCrackle')
    expect(material.fragmentShader).toContain('filamentFlash')
    expect(material.fragmentShader).toContain('controlledVoltageColor')
    expect(material.fragmentShader).toContain('step(0.15, filamentWave)')
    expect(material.fragmentShader).toContain('vec3(0.0)')
    expect(material.fragmentShader).toContain('smoothstep(0.4, 0.82, uCycle)')
    expect(material.fragmentShader).not.toContain('atan(')
    expect(material.fragmentShader).not.toContain('exp(')
    material.dispose()

    const halo = PfxLibrary.createPfxElectricCriticalMaterial(0.3, 'halo', '#5eeaff', '#ffd45a', 0.56, 0.54)
    expect(halo.blending).toBe(THREE.AdditiveBlending)
    expect(halo.depthWrite).toBe(false)
    expect(halo.depthTest).toBe(true)
    expect(halo.side).toBe(THREE.FrontSide)
    expect(halo.uniforms['uHaloLayer']?.value).toBe(1)
    expect(halo.userData['pfxElectricCriticalMaterialLayer']).toBe('coplanar-additive-energy')
    halo.dispose()

    const nexusMaterial = PfxLibrary.createPfxElectricCriticalNexusMaterial(0.98, '#5eeaff', '#ffd45a', 0.56, 0.54)
    expect(nexusMaterial.blending).toBe(THREE.NormalBlending)
    expect(nexusMaterial.depthWrite).toBe(true)
    expect(nexusMaterial.depthTest).toBe(true)
    expect(nexusMaterial.side).toBe(THREE.FrontSide)
    expect(nexusMaterial.uniforms['uPrimaryColor']?.value.getHexString()).toBe('5eeaff')
    expect(nexusMaterial.uniforms['uSecondaryColor']?.value.getHexString()).toBe('ffd45a')
    expect(nexusMaterial.uniforms['uDensity']?.value).toBeCloseTo(0.56)
    expect(nexusMaterial.uniforms['uStyleEdgeHardness']?.value).toBeCloseTo(0.54)
    expect(nexusMaterial.userData).toMatchObject({
      pfxElectricCriticalMaterial: 'faceted-white-gold-critical-nexus',
      pfxElectricCriticalMaterialLayer: 'depth-writing-critical-nexus',
      pfxElectricCriticalNexusFragmentModel: 'normal-lit-gold-core-cyan-rim',
      pfxElectricCriticalControlBinding: 'primary-secondary-density-style',
    })
    expect(nexusMaterial.fragmentShader).toContain('goldCore')
    expect(nexusMaterial.fragmentShader).toContain('cyanRim')
    expect(nexusMaterial.fragmentShader).toContain('controlledCriticalGold')
    nexusMaterial.dispose()

    expect(PfxLibrary.summarizePfxPerformance([preset]).totalParticles).toBeLessThanOrEqual(18)
    expect(PfxLibrary.summarizePfxPerformance([preset]).mobileSafe).toBe(true)
  })

  it('renders underwater bubbles as shaded meniscus spheres instead of neon ring billboards', () => {
    const plan = getPfxRenderPlan(createPfxPreset('underwater-bubbles'))
    const shells = plan.surfaces.find((surface) => surface.kind === 'bubble-shells')
    const microbubbles = plan.surfaces.find((surface) => surface.phase === 'bubble-rise')
    expect(shells?.tuning).toMatchObject({ meshShader: 'bubble-surface' })
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'bubble')).toBe(false)
    expect(microbubbles?.tuning).toMatchObject({ sprite: 'glow', blend: 'alpha' })
    expect(microbubbles!.scale).toBeLessThan(shells!.scale)
    expect(microbubbles!.tuning!.countScale).toBeLessThanOrEqual(0.4)
  })

  it('authors snow gust as a depth-spread wind field instead of a planar sparkle wall', () => {
    const plan = getPfxRenderPlan(createPfxPreset('snow-gust'))
    const haze = plan.surfaces.find((surface) => surface.phase === 'snow-gust-haze')
    const flakes = plan.surfaces.find((surface) => surface.phase === 'snow-drift')
    const needles = plan.surfaces.find((surface) => surface.phase === 'snow-wind-needles')
    expect(plan.surfaces.some((surface) => surface.tuning?.sprite === 'sparkle')).toBe(false)
    expect(haze).toMatchObject({ kind: 'particles', role: 'volume' })
    expect(haze?.tuning).toMatchObject({ motion: 'snow-gust', sprite: 'smoke', blend: 'alpha' })
    expect(haze!.tuning!.stretch).toBe(0)
    expect(flakes?.tuning).toMatchObject({ motion: 'snow-gust', sprite: 'snowflakes', blend: 'alpha' })
    expect(needles?.tuning).toMatchObject({ motion: 'snow-gust', sprite: 'streak', blend: 'alpha' })
    expect((PfxLibrary as unknown as {
      PFX_SPRITE_SLICES: Record<string, { source: string; variantCount?: number }>
    }).PFX_SPRITE_SLICES.snowflakes).toMatchObject({ source: 'procedural:snowflake-variants', variantCount: 3 })
    expect(flakes!.tuning!.stretch).toBeLessThanOrEqual(0.25)
    expect(needles!.tuning!.stretch).toBeGreaterThanOrEqual(1)
    expect(haze!.tuning!.window).toBeLessThanOrEqual(0.6)
    expect(flakes!.tuning!.window).toBeLessThanOrEqual(0.6)
    expect(flakes!.tuning!.delay).toBeGreaterThan(haze!.tuning!.delay ?? 0)
    expect(haze!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.5)
    expect(flakes!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.5)
    expect(flakes!.scale).toBeLessThanOrEqual(1.5)
    expect(flakes!.tuning!.countScale).toBeGreaterThanOrEqual(3.5)
    expect(flakes!.tuning!.positionOffset![1]).toBeGreaterThanOrEqual(-0.85)
    expect(flakes!.tuning!.positionOffset![1]).toBeLessThanOrEqual(-0.7)
    expect(haze!.tuning!.lifeScale).toBeLessThanOrEqual(0.45)
    expect(flakes!.tuning!.lifeScale).toBeLessThanOrEqual(0.45)
    expect(haze!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(flakes!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(haze!.tuning!.positionOffset![1]).toBeLessThan(0)
  })

  it('renders low health as a clip-space edge treatment with legible blood flecks', () => {
    const plan = getPfxRenderPlan(createPfxPreset('low-health-screen-particles'))
    const vignette = plan.surfaces.find((surface) => surface.phase === 'danger-vignette')
    const flecks = plan.surfaces.find((surface) => surface.phase === 'pulse-specks')
    expect(vignette).toMatchObject({
      kind: 'screen-plane',
      role: 'screen',
      scale: 1,
      tuning: { screenShader: 'danger-vignette' },
    })
    expect(vignette?.tuning?.meshMotion).toBeUndefined()
    expect(flecks).toMatchObject({
      kind: 'particles',
      role: 'screen',
      tuning: { motion: 'danger-pulse', sprite: 'splat', blend: 'alpha' },
    })
    expect(flecks!.tuning!.countScale).toBeGreaterThanOrEqual(0.6)
    expect(flecks!.tuning!.spawnScale).toBe(1)
    const source = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    expect(source).toContain('const PFX_SCREEN_VIGNETTE_VERTEX')
    expect(source).toContain('gl_Position = vec4(position.xy, 0.0, 1.0)')
    expect(source).toContain('float edge = max(edgeX, edgeY)')
    expect(source).toContain('float capillary =')
    expect(source).toContain('float innerPulseRim =')
  })

  it('accepts an explicit preview time so multi-angle review shares one simulation instant', () => {
    const source = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    expect(source).toContain('previewTimeSeconds?: number')
    expect(source).toContain('previewTimeSeconds ?? state.clock.elapsedTime')
    expect(source).toContain('const PFX_BURST_CYCLE_MULTIPLIER = 1.65')
    expect(source).toContain('rotationY: 1.15')
    expect(source).toContain("motion: 'portal-flow'")
  })

  it('publishes a fail-loud production readiness gate for final 500-effect acceptance', () => {
    const report = createPfxProductionReadinessReport()

    expect(report.schema).toBe('game-bot.r3f-pfx-production-readiness.v1')
    expect(report.passed).toBe(false)
    expect(report.summary).toMatchObject({
      totalEffects: 500,
      productionReadyEffects: 0,
      approvedDeferrals: 0,
      effectsRequiringDecision: 500,
      realDeviceProfiledEffects: 0,
      missingMobileSafariProfiles: 500,
      missingChromeAndroidProfiles: 500,
      redTeamSignedOffEffects: 0,
    })
    expect(report.summary.byReadinessStatus['needs-production-implementation']).toBe(500)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '500 effects lack production implementation or approved deferral',
        '500 effects lack mobile Safari and Chrome Android profiling evidence',
        '500 effects lack red-team sign-off',
      ]),
    )

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      acceptanceStatus: 'authored-preview',
      readinessStatus: 'needs-production-implementation',
      productionReady: false,
      approvedDeferral: false,
    })
    expect(forceField?.requiredActions).toEqual(
      expect.arrayContaining([
        'Promote authored-preview coverage to a production implementation or record an approved deferral.',
        'Attach measured mobile Safari and Chrome Android profile evidence.',
        'Resolve adversarial red-team blocking findings and record sign-off.',
      ]),
    )

    const exported = JSON.parse(exportPfxProductionReadinessReportJson(report))
    expect(exported.summary.effectsRequiringDecision).toBe(500)
    expect(exported.effects).toHaveLength(500)
  })

  it('exports an objective-level readiness ledger tied to the original PFX goal', () => {
    const createReport = (PfxLibrary as Record<string, unknown>).createPfxObjectiveReadinessReport
    expect(createReport).toBeTypeOf('function')
    if (typeof createReport !== 'function') return

    const report = createReport()
    const byId = new Map(report.requirements.map((requirement) => [requirement.id, requirement]))

    expect(report.schema).toBe('game-bot.r3f-pfx-objective-readiness.v1')
    expect(report.approvalStatus).toBe('non-approving-objective-readiness')
    expect(report.passed).toBe(false)
    expect(report.summary).toMatchObject({
      totalEffects: 500,
      totalRequirements: 18,
      locallySatisfiedRequirements: 13,
      externalEvidenceRequiredRequirements: 5,
      blockedRequirements: 5,
    })
    expect(byId.get('taxonomy-500')).toMatchObject({
      status: 'external-evidence-required',
      evidence: expect.arrayContaining([
        'docs/r3f-pfx-library-market-scan.md',
        '.context/r3f-pfx-taxonomy-review-template.json',
      ]),
      blockers: ['500 effects lack market-reviewed taxonomy approval'],
    })
    expect(byId.get('mobile-real-device-performance')).toMatchObject({
      status: 'external-evidence-required',
      evidence: expect.arrayContaining([
        '.context/r3f-pfx-real-device-capture-plan.json',
        '.context/r3f-pfx-real-device-capture-audit.json',
      ]),
      blockers: ['500 effects lack mobile Safari and Chrome Android profiling evidence'],
    })
    expect(byId.get('runtime-optimization-contract')).toMatchObject({
      status: 'locally-satisfied',
      evidence: expect.arrayContaining([
        '.context/r3f-pfx-mobile-runtime-policy.json',
        '.context/r3f-pfx-runtime-optimization-audit.json',
      ]),
      blockers: [],
    })
    expect(byId.get('visual-browser-search-preview')).toMatchObject({
      status: 'locally-satisfied',
      evidence: expect.arrayContaining(['.context/r3f-pfx-definition-of-done-smoke.json']),
    })
    expect(byId.get('customization-ui')).toMatchObject({
      status: 'locally-satisfied',
      evidence: expect.arrayContaining([
        '.context/r3f-pfx-control-safety-matrix.json',
        '.context/r3f-pfx-definition-of-done-smoke.json',
      ]),
      blockers: [],
    })
    expect(byId.get('json-and-snippet-export')).toMatchObject({
      status: 'locally-satisfied',
      evidence: expect.arrayContaining(['.context/r3f-pfx-definition-of-done-smoke.json']),
    })
    expect(byId.get('preview-assets')).toMatchObject({
      requirement:
        'Every effect has generated thumbnail, animated preview clip, style contact sheet, and control-extremes contact sheet evidence.',
      evidence: expect.arrayContaining(['.context/r3f-pfx-preview-asset-audit.json']),
    })
    expect(byId.get('definition-of-done')).toMatchObject({
      status: 'external-evidence-required',
      evidence: expect.arrayContaining(['.context/r3f-pfx-definition-of-done-smoke.json']),
      blockers: expect.arrayContaining([
        'Final acceptance remains false until taxonomy, implementation, real-device, red-team, and approval metadata gates pass.',
      ]),
    })
    expect(report.finalAcceptanceCommand).toBe(CANONICAL_FINAL_ACCEPTANCE_COMMAND)
    expect(report.finalAcceptanceCommand).not.toContain('verify:evidence --')
  })

  it('keeps platform-specific objective readiness blockers for partial mobile profiling evidence', () => {
    const createReport = (PfxLibrary as Record<string, unknown>).createPfxObjectiveReadinessReport
    expect(createReport).toBeTypeOf('function')
    if (typeof createReport !== 'function') return

    const report = createReport({ mobileSafariProfiledEffectIds: ['force-field'] }) as {
      requirements: Array<{ id: string; blockers: string[] }>
    }
    const mobileRequirement = report.requirements.find((requirement) => requirement.id === 'mobile-real-device-performance')

    expect(mobileRequirement?.blockers).toEqual([
      '499 effects lack mobile Safari profiling evidence',
      '500 effects lack Chrome Android profiling evidence',
    ])
  })

  it('points objective readiness mobile capture actions at the phone operator launch page', () => {
    const createReport = (PfxLibrary as Record<string, unknown>).createPfxObjectiveReadinessReport
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxObjectiveReadinessReportMarkdown
    expect(createReport).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createReport !== 'function' || typeof exportMarkdown !== 'function') return

    const report = createReport({ realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/' }) as {
      requirements: Array<{ id: string; nextActions: string[] }>
    }
    const mobileRequirement = report.requirements.find((requirement) => requirement.id === 'mobile-real-device-performance')
    const launchAction = 'Open real-device operator launch page: http://192.0.2.55:4765/__r3f-pfx-capture-operator'
    const launchTemplateAction =
      'Use operator launch template after replacing {profileDeviceLabel}: http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}'

    expect(mobileRequirement?.nextActions).toEqual(
      expect.arrayContaining([
        launchAction,
        launchTemplateAction,
        'Rerun real-device capture audit: npm --prefix tools/3d-pfx-library/viewer run verify:real-device',
      ]),
    )

    const markdown = exportMarkdown(report)
    expect(markdown).toContain(`- ${launchAction}`)
    expect(markdown).toContain(`- ${launchTemplateAction}`)
  })

  it('exports a reviewer-readable Markdown handoff for objective readiness', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxObjectiveReadinessReportMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const report = (PfxLibrary as { createPfxObjectiveReadinessReport: () => unknown }).createPfxObjectiveReadinessReport()
    const markdown = exportMarkdown(report)

    expect(markdown).toContain('# R3F PFX Objective Readiness')
    expect(markdown).toContain('Treat this handoff as non-approving goal readiness input.')
    expect(markdown).toContain('Approval status: `non-approving-objective-readiness`')
    expect(markdown).toContain('Passed: `false`')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Local requirements satisfied: 13')
    expect(markdown).toContain('External evidence required: 5')
    expect(markdown).toContain('Blocked requirements: 5')
    expect(markdown).toContain('## External Evidence Required')
    expect(markdown).toContain('### Research Foundation: The accepted taxonomy covers the 500 most common game PFX needs and has market-review approval.')
    expect(markdown).toContain('Requirement ID: `taxonomy-500`')
    expect(markdown).toContain('Blockers:')
    expect(markdown).toContain('- 500 effects lack market-reviewed taxonomy approval')
    expect(markdown).toContain('Next actions:')
    expect(markdown).toContain(
      '- Fill .context/r3f-pfx-taxonomy-review.json, then run `npm --prefix tools/3d-pfx-library/viewer run verify:taxonomy` and `npm --prefix tools/3d-pfx-library/viewer run verify:acceptance`.',
    )
    expect(markdown).toContain('- Complete red-team signoff in .context/r3f-pfx-red-team-review.json')
    expect(markdown).toContain('- Rerun red-team verifier: npm --prefix tools/3d-pfx-library/viewer run verify:red-team')
    expect(markdown).toContain('- Rerun acceptance verifier: npm --prefix tools/3d-pfx-library/viewer run verify:acceptance')
    expect(markdown).toContain('## Locally Satisfied')
    expect(markdown).toContain('Requirement ID: `runtime-optimization-contract`')
    expect(markdown).toContain('Final acceptance command:')
    expect(markdown).toContain(`\`${CANONICAL_FINAL_ACCEPTANCE_COMMAND}\``)
    expect(markdown).not.toContain('pass it to verify:evidence --')
    expect(markdown).not.toContain('verify:evidence -- --definition-of-done-smoke')
  })

  it('exports a per-effect external evidence work order for closing final acceptance gates', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    expect(createWorkOrder).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function') return

    const workOrder = createWorkOrder()
    const forceField = workOrder.effects.find((effect) => effect.effectId === 'force-field')

    expect(workOrder.schema).toBe('game-bot.r3f-pfx-external-evidence-work-order.v1')
    expect(workOrder.summary).toEqual({
      totalEffects: 500,
      totalOpenWorkItems: 3000,
      readyWorkItems: 500,
      blockedWorkItems: 2500,
      taxonomyReviewItems: 500,
      productionImplementationItems: 500,
      mobileSafariCaptureItems: 500,
      chromeAndroidCaptureItems: 500,
      captureUrlItems: 0,
      networkReachableCaptureUrlItems: 0,
      localOnlyCaptureUrlItems: 0,
      missingCaptureUrlItems: 1000,
      readyCaptureUrlItems: 0,
      networkReachableReadyCaptureUrlItems: 0,
      localOnlyReadyCaptureUrlItems: 0,
      missingReadyCaptureUrlItems: 0,
      autoUploadUrlItems: 0,
      autoUploadRequiresDeviceLabelItems: 0,
      batchScopedAutoUploadUrlItems: 0,
      readyBatchScopedAutoUploadUrlItems: 0,
      missingBatchScopedAutoUploadUrlItems: 1000,
      redTeamReviewItems: 500,
      finalApprovalItems: 500,
      nextReadyWorkItem: {
        effectId: 'fireball',
        rank: 1,
        name: 'Fireball',
        workItemId: 'taxonomy-review',
        label: 'Market-reviewed taxonomy row',
        outputFile: '.context/r3f-pfx-taxonomy-review.json',
        evidenceReference: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#fireball',
      },
    })
    expect(workOrder.instructions).toMatchObject({
      approvalStatus: 'non-approving-external-evidence-work-order',
      finalAcceptanceCommand: CANONICAL_FINAL_ACCEPTANCE_COMMAND,
    })
    expect(workOrder.instructions.finalAcceptanceCommand).not.toContain('verify:evidence --')
    expect(workOrder.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Complete work items in order: taxonomy review, implementation or deferral, real-device capture, red-team review, final approval.',
        'Treat this work order as a queue only; it does not satisfy any final acceptance gate.',
      ]),
    )
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      openWorkItemCount: 6,
    })
    expect(forceField?.workItems.map((item) => item.id)).toEqual([
      'taxonomy-review',
      'production-implementation',
      'mobile-safari-capture',
      'chrome-android-capture',
      'red-team-review',
      'final-approval',
    ])
    expect(forceField?.workItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'taxonomy-review',
          outputFile: '.context/r3f-pfx-taxonomy-review.json',
          evidenceReference: 'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        }),
        expect.objectContaining({
          id: 'mobile-safari-capture',
          outputFile: '.context/mobile-safari/force-field.json',
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        }),
        expect.objectContaining({
          id: 'chrome-android-capture',
          outputFile: '.context/chrome-android/force-field.json',
          evidenceReference: 'chrome-android-profile:.context/chrome-android/force-field.json',
        }),
        expect.objectContaining({
          id: 'red-team-review',
          outputFile: '.context/r3f-pfx-red-team-review.json',
          evidenceReference: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        }),
        expect.objectContaining({
          id: 'final-approval',
          outputFile: '.context/r3f-pfx-production-approvals.json',
          evidenceReference: 'production-approval:.context/r3f-pfx-production-approvals.json#force-field',
        }),
      ]),
    )
    const finalApproval = forceField?.workItems.find((item) => item.id === 'final-approval')
    const mobileSafariCapture = forceField?.workItems.find((item) => item.id === 'mobile-safari-capture')
    const redTeamReview = forceField?.workItems.find((item) => item.id === 'red-team-review')

    expect(mobileSafariCapture).toMatchObject({
      prerequisiteStatus: 'blocked',
      blockedBy: ['taxonomy-review', 'production-implementation'],
    })
    expect(redTeamReview).toMatchObject({
      prerequisiteStatus: 'blocked',
      blockedBy: ['taxonomy-review', 'production-implementation', 'mobile-safari-capture', 'chrome-android-capture'],
    })
    expect(redTeamReview?.instructions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('substantive adversarial notes'),
      ]),
    )
    expect(finalApproval).toMatchObject({
      prerequisiteStatus: 'blocked',
      blockedBy: [
        'taxonomy-review',
        'production-implementation',
        'mobile-safari-capture',
        'chrome-android-capture',
        'red-team-review',
      ],
    })
    expect(finalApproval?.instructions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('taxonomy review'),
        expect.stringContaining('implementation'),
        expect.stringContaining('mobile profiles'),
        expect.stringContaining('red-team signoff'),
      ]),
    )
  })

  it('adds direct real-device capture URLs to mobile external evidence work items when a capture base URL is provided', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({ realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/' })
    const markdown = exportMarkdown(workOrder)
    const forceField = workOrder.effects.find((effect) => effect.effectId === 'force-field')
    const mobileSafariCapture = forceField?.workItems.find((item) => item.id === 'mobile-safari-capture')
    const chromeAndroidCapture = forceField?.workItems.find((item) => item.id === 'chrome-android-capture')

    expect(mobileSafariCapture).toMatchObject({
      captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari',
      autoUploadUrl:
        'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=force-field',
      captureUrlReachability: 'network-reachable',
    })
    expect(chromeAndroidCapture).toMatchObject({
      captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=chrome-android',
      autoUploadUrl:
        'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&effectId=force-field',
      captureUrlReachability: 'network-reachable',
    })
    expect(workOrder.summary).toMatchObject({
      captureUrlItems: 1000,
      networkReachableCaptureUrlItems: 1000,
      localOnlyCaptureUrlItems: 0,
      missingCaptureUrlItems: 0,
    })
    expect(markdown).toContain(
      'Capture URL: `http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari`',
    )
    expect(markdown).toContain(
      'Auto-upload URL: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=force-field`',
    )
    expect(markdown).toContain('Network-reachable capture URLs: 1000')
    expect(markdown).toContain('Local-only capture URLs: 0')
    expect(markdown).toContain('Capture URL reachability: `network-reachable`')
    expect(markdown).toContain(
      'Capture URL: `http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=chrome-android`',
    )
    expect(markdown).toContain(
      'Auto-upload URL: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&effectId=force-field`',
    )
  })

  it('scopes external evidence auto-upload URLs to the exact real-device capture batch for each effect platform', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      taxonomyReviewedEffectIds: ['fireball'],
      implementations: completedImplementationRows('fireball'),
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const markdown = exportMarkdown(workOrder)
    const fireball = workOrder.effects.find((effect) => effect.effectId === 'fireball')
    const mobileSafariCapture = fireball?.workItems.find((item) => item.id === 'mobile-safari-capture')
    const chromeAndroidCapture = fireball?.workItems.find((item) => item.id === 'chrome-android-capture')

    expect(mobileSafariCapture?.autoUploadUrl).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
    )
    expect(mobileSafariCapture?.autoUploadRequiresDeviceLabel).toBe(true)
    expect(mobileSafariCapture?.autoUploadUrlTemplate).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(chromeAndroidCapture?.autoUploadUrl).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
    )
    expect(workOrder.summary.autoUploadRequiresDeviceLabelItems).toBe(1000)
    expect(workOrder.summary.nextReadyWorkItem?.autoUploadUrl).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
    )
    expect(workOrder.summary.nextReadyWorkItem?.autoUploadRequiresDeviceLabel).toBe(true)
    expect(workOrder.summary.nextReadyWorkItem?.autoUploadUrlTemplate).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
    )
    expect(markdown).toContain(
      'Next ready auto-upload URL: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball`',
    )
    expect(markdown).toContain(
      'Next ready auto-upload URL template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('Next ready auto-upload device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain(
      'Auto-upload URL template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}`',
    )
  })

  it('points operators at the next ready external evidence item with capture reachability', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      taxonomyReviewedEffectIds: ['fireball'],
      implementations: completedImplementationRows('fireball'),
      realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/',
    })
    const markdown = exportMarkdown(workOrder)
    const fireball = workOrder.effects.find((effect) => effect.effectId === 'fireball')
    const mobileSafariCapture = fireball?.workItems.find((item) => item.id === 'mobile-safari-capture')

    expect(workOrder.summary.nextReadyWorkItem).toEqual({
      effectId: 'fireball',
      rank: 1,
      name: 'Fireball',
      workItemId: 'mobile-safari-capture',
      label: 'Mobile Safari real-device profile',
      outputFile: '.context/mobile-safari/fireball.json',
      evidenceReference: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
      captureUrl: 'http://127.0.0.1:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
      autoUploadUrl:
        'http://127.0.0.1:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=fireball',
      autoUploadUrlTemplate:
        'http://127.0.0.1:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=fireball&profileDeviceLabel={profileDeviceLabel}',
      autoUploadRequiresDeviceLabel: true,
      operatorLaunchUrl: 'http://127.0.0.1:4765/__r3f-pfx-capture-operator',
      operatorLaunchUrlTemplate:
        'http://127.0.0.1:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
      captureUrlReachability: 'local-only',
    })
    expect(workOrder.summary).toMatchObject({
      readyCaptureUrlItems: 2,
      networkReachableReadyCaptureUrlItems: 0,
      localOnlyReadyCaptureUrlItems: 2,
      missingReadyCaptureUrlItems: 0,
    })
    expect(mobileSafariCapture?.instructions).toEqual(
      expect.arrayContaining([
        'This capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
        'Tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
      ]),
    )
    expect(markdown).toContain('Next ready item: Fireball (`fireball`) - Mobile Safari capture')
    expect(markdown).toContain('Ready capture URL work items: 2')
    expect(markdown).toContain('Network-reachable ready capture URLs: 0')
    expect(markdown).toContain('Local-only ready capture URLs: 2')
    expect(markdown).toContain('Missing ready capture URLs: 0')
    expect(markdown).toContain(
      'Next ready capture URL: `http://127.0.0.1:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari`',
    )
    expect(markdown).toContain(
      'Next ready auto-upload URL: `http://127.0.0.1:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=fireball`',
    )
    expect(markdown).toContain(
      'Next ready operator launch URL: `http://127.0.0.1:4765/__r3f-pfx-capture-operator`',
    )
    expect(markdown).toContain(
      'Next ready operator launch URL template: `http://127.0.0.1:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('Next ready capture URL reachability: `local-only`')
    expect(markdown).toContain(
      'This capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
    )
    expect(markdown).toContain(
      'Tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
    )
    expect(markdown).toContain('Next ready output: `.context/mobile-safari/fireball.json`')
  })

  it('carries visual inspection targets on the next ready red-team work item', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      taxonomyReviewedEffectIds: ['fireball'],
      implementations: completedImplementationRows('fireball'),
      realDeviceProfiledEffectIds: ['fireball'],
    })
    const markdown = exportMarkdown(workOrder)

    expect(workOrder.summary.nextReadyWorkItem).toMatchObject({
      effectId: 'fireball',
      workItemId: 'red-team-review',
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/fireball.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/fireball-clip.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#fireball',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#fireball',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before visual-quality signoff.',
          'Compare all 17 style variants against rendered browser style controls before style signoff.',
          'Exercise min/default/max states for render-impact and budget-impact controls before customization signoff.',
        ],
      },
    })
    expect(markdown).toContain('Next ready item: Fireball (`fireball`) - Red-team review')
    expect(markdown).toContain('Next ready visual inspection targets:')
    expect(markdown).toContain('- Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/fireball.svg`')
    expect(markdown).toContain('- Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#fireball`')
    expect(markdown).toContain('- Inspect default thumbnail and animated clip before visual-quality signoff.')
  })

  it('propagates ready capture URL reachability into external evidence batches', () => {
    const createBatchPlan = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchPlan
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchSheet
    const exportPlanMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceBatchPlanMarkdown
    const exportSheetMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceBatchSheetMarkdown
    expect(createBatchPlan).toBeTypeOf('function')
    expect(createSheet).toBeTypeOf('function')
    expect(exportPlanMarkdown).toBeTypeOf('function')
    expect(exportSheetMarkdown).toBeTypeOf('function')
    if (
      typeof createBatchPlan !== 'function' ||
      typeof createSheet !== 'function' ||
      typeof exportPlanMarkdown !== 'function' ||
      typeof exportSheetMarkdown !== 'function'
    ) {
      return
    }

    const options = {
      taxonomyReviewedEffectIds: ['fireball'],
      implementations: completedImplementationRows('fireball'),
      realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/',
    }
    const plan = createBatchPlan(options)
    const sheet = createSheet({ ...options, batchId: 'external-evidence-batch-001' })
    const planMarkdown = exportPlanMarkdown(plan)
    const sheetMarkdown = exportSheetMarkdown(sheet)

    expect(plan.summary).toMatchObject({
      readyCaptureUrlItems: 2,
      networkReachableReadyCaptureUrlItems: 0,
      localOnlyReadyCaptureUrlItems: 2,
      missingReadyCaptureUrlItems: 0,
    })
    expect(plan.batches[0]).toMatchObject({
      readyCaptureUrlItemCount: 2,
      networkReachableReadyCaptureUrlItemCount: 0,
      localOnlyReadyCaptureUrlItemCount: 2,
      missingReadyCaptureUrlItemCount: 0,
    })
    expect(sheet.batch).toMatchObject({
      readyCaptureUrlItemCount: 2,
      networkReachableReadyCaptureUrlItemCount: 0,
      localOnlyReadyCaptureUrlItemCount: 2,
      missingReadyCaptureUrlItemCount: 0,
    })
    expect(planMarkdown).toContain('Ready capture URL work items: 2')
    expect(planMarkdown).toContain('Local-only ready capture URLs: 2')
    expect(sheetMarkdown).toContain('Ready capture URL work items: 2')
    expect(sheetMarkdown).toContain('Local-only ready capture URLs: 2')
  })

  it('exports a reviewer-readable Markdown handoff for the external evidence work order', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const markdown = exportMarkdown()

    expect(markdown).toContain('# R3F PFX External Evidence Work Order')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Total open work items: 3000')
    expect(markdown).toContain('Ready work items: 500')
    expect(markdown).toContain('Blocked work items: 2500')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain('1. Taxonomy review')
    expect(markdown).toContain('`taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field`')
    expect(markdown).toContain('3. Mobile Safari capture')
    expect(markdown).toContain('`mobile-safari-profile:.context/mobile-safari/force-field.json`')
    expect(markdown).toContain('4. Chrome Android capture')
    expect(markdown).toContain('`chrome-android-profile:.context/chrome-android/force-field.json`')
    expect(markdown).toContain('5. Red-team review')
    expect(markdown).toContain(
      'Prerequisite status: `blocked` by `taxonomy-review`, `production-implementation`, `mobile-safari-capture`, `chrome-android-capture`',
    )
    expect(markdown).toContain('`red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field`')
    expect(markdown).toContain('6. Final approval')
    expect(markdown).toContain(
      'Prerequisite status: `blocked` by `taxonomy-review`, `production-implementation`, `mobile-safari-capture`, `chrome-android-capture`, `red-team-review`',
    )
    expect(markdown).toContain('`production-approval:.context/r3f-pfx-production-approvals.json#force-field`')
    expect(markdown).toContain('   - Visual inspection targets:')
    expect(markdown).toContain('     - Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/force-field.svg`')
    expect(markdown).toContain('     - Animated clip: `.context/r3f-pfx-preview-assets/clips/force-field-clip.svg`')
    expect(markdown).toContain('     - Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#force-field`')
    expect(markdown).toContain('     - Control matrix: `.context/r3f-pfx-control-safety-matrix.json#force-field`')
    expect(markdown).toContain('     - Inspect default thumbnail and animated clip before visual-quality signoff.')
    expect(markdown).toContain('     - Inspect default thumbnail and animated clip before final approval.')
    expect(markdown).toContain('Treat this handoff as non-approving reviewer guidance.')
  })

  it('exports reviewer-sized external evidence batches without approving any work', () => {
    const createBatchPlan = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchPlan
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceBatchPlanMarkdown
    expect(createBatchPlan).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createBatchPlan !== 'function' || typeof exportMarkdown !== 'function') return

    const plan = createBatchPlan()
    const markdown = exportMarkdown(plan)
    const firstBatch = plan.batches[0]

    expect(plan.schema).toBe('game-bot.r3f-pfx-external-evidence-batch-plan.v1')
    expect(plan.summary).toEqual({
      totalEffects: 500,
      totalOpenWorkItems: 3000,
      readyWorkItems: 500,
      blockedWorkItems: 2500,
      captureUrlItems: 0,
      networkReachableCaptureUrlItems: 0,
      localOnlyCaptureUrlItems: 0,
      missingCaptureUrlItems: 1000,
      readyCaptureUrlItems: 0,
      networkReachableReadyCaptureUrlItems: 0,
      localOnlyReadyCaptureUrlItems: 0,
      missingReadyCaptureUrlItems: 0,
      autoUploadUrlItems: 0,
      autoUploadRequiresDeviceLabelItems: 0,
      batchScopedAutoUploadUrlItems: 0,
      readyBatchScopedAutoUploadUrlItems: 0,
      missingBatchScopedAutoUploadUrlItems: 1000,
      batchSize: 25,
      totalBatches: 20,
      nonApproving: true,
    })
    expect(plan.instructions).toMatchObject({
      approvalStatus: 'non-approving-external-evidence-batch-plan',
      sourceWorkOrderSchema: 'game-bot.r3f-pfx-external-evidence-work-order.v1',
      finalAcceptanceCommand: CANONICAL_FINAL_ACCEPTANCE_COMMAND,
    })
    expect(plan.instructions.finalAcceptanceCommand).not.toContain('verify:evidence --')
    expect(firstBatch).toMatchObject({
      batchId: 'external-evidence-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      openWorkItemCount: 150,
      readyWorkItemCount: 25,
      blockedWorkItemCount: 125,
      captureUrlItemCount: 0,
      networkReachableCaptureUrlItemCount: 0,
      localOnlyCaptureUrlItemCount: 0,
      missingCaptureUrlItemCount: 50,
      readyCaptureUrlItemCount: 0,
      networkReachableReadyCaptureUrlItemCount: 0,
      localOnlyReadyCaptureUrlItemCount: 0,
      missingReadyCaptureUrlItemCount: 0,
      autoUploadRequiresDeviceLabelItemCount: 0,
      workItemsByType: {
        taxonomyReviewItems: 25,
        productionImplementationItems: 25,
        mobileSafariCaptureItems: 25,
        chromeAndroidCaptureItems: 25,
        redTeamReviewItems: 25,
        finalApprovalItems: 25,
      },
    })
    expect(firstBatch.effectIds).toContain('force-field')
    expect(firstBatch.outputFiles).toEqual(
      expect.arrayContaining([
        '.context/r3f-pfx-taxonomy-review.json',
        '.context/r3f-pfx-production-implementation.json',
        '.context/mobile-safari/fireball.json',
        '.context/chrome-android/fireball.json',
        '.context/r3f-pfx-red-team-review.json',
        '.context/r3f-pfx-production-approvals.json',
      ]),
    )
    expect(markdown).toContain('# R3F PFX External Evidence Batch Plan')
    expect(markdown).toContain('Ready work items: 500')
    expect(markdown).toContain('Blocked work items: 2500')
    expect(markdown).toContain('Missing capture URLs: 1000')
    expect(markdown).toContain('Auto-upload URL work items: 0')
    expect(markdown).toContain('Batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Ready batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Missing batch-scoped auto-upload URLs: 1000')
    expect(markdown).toContain('Batch size: 25')
    expect(markdown).toContain('## external-evidence-batch-001')
    expect(markdown).toContain('Ranks: 1-25')
    expect(markdown).toContain('`force-field`')
    expect(markdown).toContain('Treat this handoff as non-approving reviewer guidance.')
  })

  it('exports a single external evidence batch sheet with per-effect work checkboxes', () => {
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceBatchSheetMarkdown
    expect(createSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createSheet({ batchId: 'external-evidence-batch-001', realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/' })
    const markdown = exportMarkdown(sheet)
    const forceField = sheet.effects.find((effect) => effect.effectId === 'force-field')

    expect(sheet.schema).toBe('game-bot.r3f-pfx-external-evidence-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-external-evidence-batch-sheet',
      sourceBatchPlanSchema: 'game-bot.r3f-pfx-external-evidence-batch-plan.v1',
      finalAcceptanceCommand: CANONICAL_FINAL_ACCEPTANCE_COMMAND,
    })
    expect(sheet.instructions.finalAcceptanceCommand).not.toContain('verify:evidence --')
    expect(sheet.batch).toMatchObject({
      batchId: 'external-evidence-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      openWorkItemCount: 150,
      readyWorkItemCount: 25,
      blockedWorkItemCount: 125,
      captureUrlItemCount: 50,
      networkReachableCaptureUrlItemCount: 0,
      localOnlyCaptureUrlItemCount: 50,
      missingCaptureUrlItemCount: 0,
      readyCaptureUrlItemCount: 0,
      networkReachableReadyCaptureUrlItemCount: 0,
      localOnlyReadyCaptureUrlItemCount: 0,
      missingReadyCaptureUrlItemCount: 0,
      autoUploadUrlItemCount: 50,
      autoUploadRequiresDeviceLabelItemCount: 50,
      batchScopedAutoUploadUrlItemCount: 0,
      readyBatchScopedAutoUploadUrlItemCount: 0,
      missingBatchScopedAutoUploadUrlItemCount: 50,
    })
    expect(sheet.effects).toHaveLength(25)
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      openWorkItemCount: 6,
    })
    expect(forceField?.workItems.map((item) => item.id)).toEqual([
      'taxonomy-review',
      'production-implementation',
      'mobile-safari-capture',
      'chrome-android-capture',
      'red-team-review',
      'final-approval',
    ])
    const redTeamReview = forceField?.workItems.find((item) => item.id === 'red-team-review')
    const finalApproval = forceField?.workItems.find((item) => item.id === 'final-approval')
    const mobileSafariCapture = forceField?.workItems.find((item) => item.id === 'mobile-safari-capture')
    expect(mobileSafariCapture).toMatchObject({
      captureUrl: 'http://127.0.0.1:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari',
      autoUploadUrl:
        'http://127.0.0.1:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=force-field',
    })
    expect(redTeamReview).toMatchObject({
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/force-field.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/force-field-clip.svg',
        styleContactSheetAsset: '.context/r3f-pfx-preview-assets/contact-sheets/style-variants/force-field-style-contact-sheet.svg',
        controlExtremesContactSheetAsset:
          '.context/r3f-pfx-preview-assets/contact-sheets/control-extremes/force-field-control-extremes-contact-sheet.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#force-field',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#force-field',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before visual-quality signoff.',
          'Compare all 17 style variants against rendered browser style controls before style signoff.',
          'Exercise min/default/max states for render-impact and budget-impact controls before customization signoff.',
        ],
      },
    })
    expect(finalApproval).toMatchObject({
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/force-field.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/force-field-clip.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#force-field',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#force-field',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before final approval.',
          'Compare all 17 style variants against rendered browser style controls before final approval.',
          'Exercise min/default/max states for render-impact and budget-impact controls before final approval.',
        ],
      },
    })
    expect(markdown).toContain('# R3F PFX External Evidence Batch Sheet')
    expect(markdown).toContain('Batch: `external-evidence-batch-001`')
    expect(markdown).toContain('Auto-upload URL work items: 50')
    expect(markdown).toContain('Auto-upload URLs requiring device label: 50')
    expect(markdown).toContain('Batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Ready batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Missing batch-scoped auto-upload URLs: 50')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain(
      'Auto-upload URL: `http://127.0.0.1:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&effectId=force-field`',
    )
    expect(markdown).toContain('- [ ] Taxonomy review')
    expect(markdown).toContain('`taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field`')
    expect(markdown).toContain('- [ ] Red-team review')
    expect(markdown).toContain('`red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field`')
    expect(markdown).toContain(
      'Record substantive adversarial notes covering the evidence attacked, resolved findings, or deferral rationale; rubber-stamp notes are rejected.',
    )
    expect(markdown).toContain('- [ ] Final approval')
    expect(markdown).toContain('`production-approval:.context/r3f-pfx-production-approvals.json#force-field`')
    expect(markdown).toContain('  - Visual inspection targets:')
    expect(markdown).toContain('    - Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/force-field.svg`')
    expect(markdown).toContain('    - Animated clip: `.context/r3f-pfx-preview-assets/clips/force-field-clip.svg`')
    expect(markdown).toContain('    - Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#force-field`')
    expect(markdown).toContain('    - Control matrix: `.context/r3f-pfx-control-safety-matrix.json#force-field`')
    expect(markdown).toContain('    - Inspect default thumbnail and animated clip before final approval.')
    expect(markdown).toContain('Treat this handoff as non-approving reviewer guidance.')
  })

  it('exports and validates an index for every external evidence batch sheet', () => {
    const createPlan = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchPlan
    const createIndex = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceBatchSheetIndex
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceBatchSheetIndexMarkdown
    const validateIndex = (PfxLibrary as Record<string, unknown>).validatePfxExternalEvidenceBatchSheetIndex
    expect(createPlan).toBeTypeOf('function')
    expect(createIndex).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    expect(validateIndex).toBeTypeOf('function')
    if (
      typeof createPlan !== 'function' ||
      typeof createIndex !== 'function' ||
      typeof exportMarkdown !== 'function' ||
      typeof validateIndex !== 'function'
    ) {
      return
    }

    const plan = createPlan()
    const index = createIndex(plan)
    const markdown = exportMarkdown(index)

    expect(index.schema).toBe('game-bot.r3f-pfx-external-evidence-batch-sheet-index.v1')
    expect(index.summary).toMatchObject({
      totalBatches: 20,
      totalEffects: 500,
      totalOpenWorkItems: 3000,
      readyWorkItems: 500,
      blockedWorkItems: 2500,
      captureUrlItems: 0,
      networkReachableCaptureUrlItems: 0,
      localOnlyCaptureUrlItems: 0,
      missingCaptureUrlItems: 1000,
      readyCaptureUrlItems: 0,
      networkReachableReadyCaptureUrlItems: 0,
      localOnlyReadyCaptureUrlItems: 0,
      missingReadyCaptureUrlItems: 0,
      autoUploadUrlItems: 0,
      batchScopedAutoUploadUrlItems: 0,
      readyBatchScopedAutoUploadUrlItems: 0,
      missingBatchScopedAutoUploadUrlItems: 1000,
      outputDirectory: '.context/external-evidence-batches',
      approvalStatus: 'non-approving-external-evidence-batch-sheet-index',
      bulkCommand: expect.stringContaining('npm --prefix tools/3d-pfx-library/viewer run export:external-evidence'),
    })
    expect(index.summary.bulkCommand).toContain('--external-evidence-batch-sheet-directory .context/external-evidence-batches')
    expect(index.summary.bulkCommand).not.toContain('verify:evidence')
    expect(index.summary.operatorLaunchUrl).toBeUndefined()
    expect(index.summary.operatorLaunchUrlTemplate).toBeUndefined()
    expect(index.sheets).toHaveLength(20)
    expect(index.sheets[0]).toMatchObject({
      batchId: 'external-evidence-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      openWorkItemCount: 150,
      readyWorkItemCount: 25,
      blockedWorkItemCount: 125,
      captureUrlItemCount: 0,
      readyCaptureUrlItemCount: 0,
      batchScopedAutoUploadUrlItemCount: 0,
      readyBatchScopedAutoUploadUrlItemCount: 0,
      missingBatchScopedAutoUploadUrlItemCount: 50,
      outputFile: '.context/external-evidence-batches/external-evidence-batch-001.json',
      markdownOutputFile: '.context/external-evidence-batches/external-evidence-batch-001.md',
      command: expect.stringContaining('--external-evidence-batch-id external-evidence-batch-001'),
    })
    expect(index.sheets[0].command).toContain('npm --prefix tools/3d-pfx-library/viewer run export:external-evidence')
    expect(index.sheets[0].command).not.toContain('verify:evidence')
    expect(markdown).toContain('# R3F PFX External Evidence Batch Sheet Index')
    expect(markdown).toContain('Total open work items: 3000')
    expect(markdown).toContain('Ready work items: 500')
    expect(markdown).toContain('Blocked work items: 2500')
    expect(markdown).toContain('Auto-upload URL work items: 0')
    expect(markdown).toContain('Batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Ready batch-scoped auto-upload URLs: 0')
    expect(markdown).toContain('Missing batch-scoped auto-upload URLs: 1000')
    expect(markdown).toContain(`LAN handoff command: \`${CANONICAL_LAN_PRODUCTION_HANDOFF_COMMAND}\``)
    expect(markdown).toContain(
      `Tunnel/base URL handoff command: \`${CANONICAL_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\``,
    )
    expect(markdown).toContain(
      '`external-evidence-batch-001` (ranks 1-25, 25 effects, 150 open items, 25 ready, 125 blocked, 0 batch-scoped auto-upload URLs, 50 missing batch-scoped auto-upload URLs)',
    )
    expect(markdown).toContain('Treat this index as non-approving reviewer guidance.')
    expect(validateIndex(plan, index)).toEqual({
      passed: true,
      findings: [],
    })

    const forgedIndex = {
      ...index,
      sheets: index.sheets.map((sheet, index) =>
        index === 0 ? { ...sheet, outputFile: '.context/forged/external-evidence-batch-001.md' } : sheet,
      ),
    }
    expect(validateIndex(plan, forgedIndex)).toMatchObject({
      passed: false,
      findings: expect.arrayContaining([
        'external-evidence-batch-001 outputFile expected .context/external-evidence-batches/external-evidence-batch-001.json but found .context/forged/external-evidence-batch-001.md',
      ]),
    })
    const forgedReadyIndex = {
      ...index,
      sheets: index.sheets.map((sheet, index) => (index === 0 ? { ...sheet, readyWorkItemCount: 24 } : sheet)),
    }
    expect(validateIndex(plan, forgedReadyIndex)).toMatchObject({
      passed: false,
      findings: expect.arrayContaining([
        'external-evidence-batch-001 readyWorkItemCount expected 25 but found 24',
      ]),
    })
    const forgedAutoUploadDeviceLabelIndex = {
      ...index,
      sheets: index.sheets.map((sheet, index) =>
        index === 0 ? { ...sheet, autoUploadRequiresDeviceLabelItemCount: 999 } : sheet,
      ),
    }
    expect(validateIndex(plan, forgedAutoUploadDeviceLabelIndex)).toMatchObject({
      passed: false,
      findings: expect.arrayContaining([
        'external-evidence-batch-001 autoUploadRequiresDeviceLabelItemCount expected 0 but found 999',
      ]),
    })
    const forgedAutoUploadSummaryIndex = {
      ...index,
      summary: {
        ...index.summary,
        autoUploadUrlItems: 999,
        autoUploadRequiresDeviceLabelItems: 999,
        batchScopedAutoUploadUrlItems: 999,
        readyBatchScopedAutoUploadUrlItems: 999,
        missingBatchScopedAutoUploadUrlItems: 1,
      },
    }
    expect(validateIndex(plan, forgedAutoUploadSummaryIndex)).toMatchObject({
      passed: false,
      findings: expect.arrayContaining([
        'summary autoUploadUrlItems expected 0 but found 999',
        'summary autoUploadRequiresDeviceLabelItems expected 0 but found 999',
        'summary batchScopedAutoUploadUrlItems expected 0 but found 999',
        'summary readyBatchScopedAutoUploadUrlItems expected 0 but found 999',
        'summary missingBatchScopedAutoUploadUrlItems expected 1000 but found 1',
      ]),
    })

    const capturePlan = createPlan({
      taxonomyReviewedEffectIds: ['fireball'],
      implementations: completedImplementationRows('fireball'),
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const captureIndex = createIndex(capturePlan)
    const captureMarkdown = exportMarkdown(captureIndex)
    expect(captureIndex.summary.operatorLaunchUrl).toBe('http://192.0.2.55:4765/__r3f-pfx-capture-operator')
    expect(captureIndex.summary.operatorLaunchUrlTemplate).toBe(
      'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
    )
    expect(captureMarkdown).toContain('Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`')
    expect(captureMarkdown).toContain(
      'Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
  })

  it('exports a production implementation review batch sheet without approving rows', () => {
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxProductionImplementationBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxProductionImplementationBatchSheetMarkdown
    expect(createSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createSheet({ batchId: 'production-implementation-batch-001' })
    const markdown = exportMarkdown(sheet)
    const forceField = sheet.effects.find((effect) => effect.effectId === 'force-field')

    expect(sheet.schema).toBe('game-bot.r3f-pfx-production-implementation-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-production-implementation-batch-sheet',
      sourceDossierSchema: 'game-bot.r3f-pfx-production-implementation-dossier.v1',
      outputFile: '.context/r3f-pfx-production-implementation.json',
    })
    expect(sheet.batch).toMatchObject({
      batchId: 'production-implementation-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      outputFile: '.context/r3f-pfx-production-implementation.json',
    })
    expect(sheet.effects).toHaveLength(25)
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      productionApproved: false,
      reviewAnchor: '.context/r3f-pfx-production-implementation.json#force-field',
      componentName: 'ForceFieldPfx',
      requiredCriteria: [
        'drop-in-r3f-component',
        'authored-render-recipe',
        'all-controls-safe',
        'mobile-budget-declared',
        'preview-asset-exported',
        'documentation-export-clean',
      ],
      evidenceReferences: expect.arrayContaining([
        'component:ForceFieldPfx',
        'authored-recipe:force-field:authored-preview-v1',
        'docs:.context/r3f-pfx-developer-docs.json#force-field',
      ]),
    })
    expect(markdown).toContain('# R3F PFX Production Implementation Batch Sheet')
    expect(markdown).toContain('Batch: `production-implementation-batch-001`')
    expect(markdown).toContain('Output file: `.context/r3f-pfx-production-implementation.json`')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain('- [ ] Drop-in R3F component')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-production-implementation.json#force-field`')
    expect(markdown).toContain('Treat this handoff as non-approving implementation review input.')
  })

  it('exports a non-approving production implementation batch sheet index for all 500 effects', () => {
    const createIndex = (PfxLibrary as Record<string, unknown>).createPfxProductionImplementationBatchSheetIndex
    const exportMarkdown = (PfxLibrary as Record<string, unknown>)
      .exportPfxProductionImplementationBatchSheetIndexMarkdown
    expect(createIndex).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createIndex !== 'function' || typeof exportMarkdown !== 'function') return

    const index = createIndex({ outputDirectory: '.context/production-implementation-batches' })

    expect(index.schema).toBe('game-bot.r3f-pfx-production-implementation-batch-sheet-index.v1')
    expect(index.summary).toMatchObject({
      totalBatches: 20,
      totalEffects: 500,
      outputDirectory: '.context/production-implementation-batches',
      approvalStatus: 'non-approving-production-implementation-batch-sheet-index',
      bulkCommand: expect.stringContaining(
        '--implementation-batch-sheet-directory .context/production-implementation-batches',
      ),
    })
    expect(index.sheets).toHaveLength(20)
    expect(index.sheets[0]).toMatchObject({
      batchId: 'production-implementation-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      firstEffectId: 'fireball',
      lastEffectId: 'level-up-flare',
      outputFile: '.context/production-implementation-batches/production-implementation-batch-001.json',
      markdownOutputFile: '.context/production-implementation-batches/production-implementation-batch-001.md',
      command: expect.stringContaining('--implementation-batch-id production-implementation-batch-001'),
    })
    expect(index.sheets[19]).toMatchObject({
      batchId: 'production-implementation-batch-020',
      rankStart: 476,
      rankEnd: 500,
      effectCount: 25,
      firstEffectId: 'plasma-telegraph',
      lastEffectId: 'spawn-telegraph',
    })

    const markdown = exportMarkdown(index)
    expect(markdown).toContain('# R3F PFX Production Implementation Batch Sheet Index')
    expect(markdown).toContain('Treat this index as non-approving implementation review guidance.')
    expect(markdown).toContain(
      '- `production-implementation-batch-001` (ranks 1-25, 25 effects, `fireball` to `level-up-flare`): `.context/production-implementation-batches/production-implementation-batch-001.md`',
    )
    expect(markdown).toContain(
      '--implementation-batch-sheet-output .context/production-implementation-batches/production-implementation-batch-001.json',
    )
  })

  it('removes completed per-effect work items from the external evidence work order', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    expect(createWorkOrder).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function') return

    const implementationTemplate = createPfxProductionImplementationTemplate()
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    const implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamReviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted mobile performance evidence, export cleanliness, control safety, and documentation coverage.',
          }
        : review,
    )

    const workOrder = createWorkOrder({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations,
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
    })
    const forceField = workOrder.effects.find((effect) => effect.effectId === 'force-field')

    expect(workOrder.summary).toMatchObject({
      totalOpenWorkItems: 2994,
      taxonomyReviewItems: 499,
      productionImplementationItems: 499,
      mobileSafariCaptureItems: 499,
      chromeAndroidCaptureItems: 499,
      redTeamReviewItems: 499,
      finalApprovalItems: 499,
    })
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      openWorkItemCount: 0,
      workItems: [],
    })
  })

  it('removes mobile capture work items independently by platform', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    expect(createWorkOrder).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function') return

    const workOrder = createWorkOrder({
      mobileSafariProfiledEffectIds: ['force-field'],
    })
    const forceField = workOrder.effects.find((effect) => effect.effectId === 'force-field')

    expect(workOrder.summary).toMatchObject({
      totalOpenWorkItems: 2999,
      mobileSafariCaptureItems: 499,
      chromeAndroidCaptureItems: 500,
    })
    expect(forceField?.workItems.map((item) => item.id)).toEqual([
      'taxonomy-review',
      'production-implementation',
      'chrome-android-capture',
      'red-team-review',
      'final-approval',
    ])
  })

  it('reports invalid platform-specific capture evidence ids in the external evidence work order', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      mobileSafariProfiledEffectIds: ['force-field', 'force-field', 'not-in-taxonomy'],
      chromeAndroidProfiledEffectIds: ['not-in-taxonomy'],
    })
    const markdown = exportMarkdown(workOrder)

    expect(workOrder.blockingFindings).toEqual(
      expect.arrayContaining([
        'mobile Safari profile evidence references unknown effect ids: not-in-taxonomy',
        'mobile Safari profile evidence has duplicate effect ids: force-field',
        'Chrome Android profile evidence references unknown effect ids: not-in-taxonomy',
      ]),
    )
    expect(workOrder.summary).toMatchObject({
      totalOpenWorkItems: 2999,
      mobileSafariCaptureItems: 499,
      chromeAndroidCaptureItems: 500,
    })
    expect(markdown).toContain('## Blocking Findings')
    expect(markdown).toContain('- mobile Safari profile evidence references unknown effect ids: not-in-taxonomy')
    expect(markdown).toContain('- mobile Safari profile evidence has duplicate effect ids: force-field')
    expect(markdown).toContain('- Chrome Android profile evidence references unknown effect ids: not-in-taxonomy')
  })

  it('reports invalid aggregate evidence ids in the external evidence work order', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      taxonomyReviewedEffectIds: ['force-field', 'force-field', 'not-in-taxonomy'],
      realDeviceProfiledEffectIds: ['force-field', 'force-field', 'not-in-taxonomy'],
    })
    const markdown = exportMarkdown(workOrder)

    expect(workOrder.blockingFindings).toEqual(
      expect.arrayContaining([
        'taxonomy review evidence references unknown effect ids: not-in-taxonomy',
        'taxonomy review evidence has duplicate effect ids: force-field',
        'real-device profile evidence references unknown effect ids: not-in-taxonomy',
        'real-device profile evidence has duplicate effect ids: force-field',
      ]),
    )
    expect(workOrder.summary).toMatchObject({
      totalOpenWorkItems: 2997,
      taxonomyReviewItems: 499,
      mobileSafariCaptureItems: 499,
      chromeAndroidCaptureItems: 499,
    })
    expect(markdown).toContain('- taxonomy review evidence references unknown effect ids: not-in-taxonomy')
    expect(markdown).toContain('- taxonomy review evidence has duplicate effect ids: force-field')
    expect(markdown).toContain('- real-device profile evidence references unknown effect ids: not-in-taxonomy')
    expect(markdown).toContain('- real-device profile evidence has duplicate effect ids: force-field')
  })

  it('reports invalid real-device batch auto-upload map entries in the external evidence work order', () => {
    const createWorkOrder = (PfxLibrary as Record<string, unknown>).createPfxExternalEvidenceWorkOrder
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxExternalEvidenceWorkOrderMarkdown
    expect(createWorkOrder).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createWorkOrder !== 'function' || typeof exportMarkdown !== 'function') return

    const workOrder = createWorkOrder({
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        'force-field': {
          'mobile-safari': '',
          'chrome-android': 'real-device-batch-011',
          'ios-safari': 'real-device-batch-ios',
        },
        'not-in-taxonomy': {
          'mobile-safari': 'real-device-batch-999',
        },
      },
    })
    const markdown = exportMarkdown(workOrder)

    expect(workOrder.blockingFindings).toEqual(
      expect.arrayContaining([
        'real-device capture batch map references unknown effect ids: not-in-taxonomy',
        'real-device capture batch map has unknown platform keys for force-field: ios-safari',
        'real-device capture batch map has blank batch ids: force-field mobile-safari',
      ]),
    )
    expect(workOrder.summary).toMatchObject({
      autoUploadUrlItems: 1000,
      batchScopedAutoUploadUrlItems: 1,
      missingBatchScopedAutoUploadUrlItems: 999,
    })
    expect(markdown).toContain('- real-device capture batch map references unknown effect ids: not-in-taxonomy')
    expect(markdown).toContain('- real-device capture batch map has unknown platform keys for force-field: ios-safari')
    expect(markdown).toContain('- real-device capture batch map has blank batch ids: force-field mobile-safari')
  })

  it('credits explicit production approvals with separate real-device and red-team evidence', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
            rationale:
              'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'production-ready',
      productionReady: true,
      realDeviceProfiled: true,
      redTeamSignedOff: true,
      requiredActions: [],
    })
    expect(report.summary).toMatchObject({
      productionReadyEffects: 1,
      effectsRequiringDecision: 499,
      realDeviceProfiledEffects: 1,
      redTeamSignedOffEffects: 1,
    })
    expect(report.summary.byReadinessStatus['production-ready']).toBe(1)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack production implementation or approved deferral',
        '499 effects lack mobile Safari and Chrome Android profiling evidence',
        '499 effects lack red-team sign-off',
      ]),
    )
  })

  it('does not credit production approvals before taxonomy review is market-reviewed', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: [],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-production-approval',
      productionReady: false,
      requiredActions: ['Record market-reviewed taxonomy evidence before final production approval.'],
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining(['500 effects lack market-reviewed taxonomy approval']),
    )
  })

  it('reports unknown standalone taxonomy and real-device evidence ids', () => {
    const report = createPfxProductionReadinessReport({
      taxonomyReviewedEffectIds: ['not-in-taxonomy'],
      realDeviceProfiledEffectIds: ['not-in-taxonomy'],
    })

    expect(report.summary).toMatchObject({
      realDeviceProfiledEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'taxonomy review evidence references unknown effect ids: not-in-taxonomy',
        'real-device profile evidence references unknown effect ids: not-in-taxonomy',
      ]),
    )
  })

  it('reports duplicate standalone taxonomy and real-device evidence ids', () => {
    const report = createPfxProductionReadinessReport({
      taxonomyReviewedEffectIds: ['force-field', 'force-field'],
      realDeviceProfiledEffectIds: ['force-field', 'force-field'],
    })

    expect(report.summary).toMatchObject({
      realDeviceProfiledEffects: 1,
      effectsRequiringDecision: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'taxonomy review evidence has duplicate effect ids: force-field',
        'real-device profile evidence has duplicate effect ids: force-field',
      ]),
    )
  })

  it('does not credit production approvals with extra non-canonical evidence references', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#fireball',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-production-approval',
      productionReady: false,
      requiredActions: ['Attach every required production approval evidence reference for the same effect.'],
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval for force-field production-ready evidence must exactly match canonical references',
      ]),
    )
  })

  it('does not credit rubber-stamped red-team signoff notes', () => {
    const redTeamReviews = completedRedTeamRows('force-field').map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            notes: 'Looks good.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      redTeamSignedOff: false,
      productionReady: false,
      requiredActions: ['Resolve adversarial red-team blocking findings and record sign-off.'],
    })
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review for force-field must include substantive adversarial notes',
      ]),
    )
  })

  it('does not credit vague red-team notes that omit reviewed acceptance dimensions', () => {
    const redTeamReviews = completedRedTeamRows('force-field').map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            notes: 'Adversarial review completed after checking the supplied evidence.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
    })

    expect(report.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      redTeamSignedOff: false,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review for force-field must include substantive adversarial notes',
      ]),
    )
  })

  it('does not credit narrow red-team notes that mention only mobile performance', () => {
    const redTeamReviews = completedRedTeamRows('force-field').map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            notes:
              'force-field adversarial review accepted mobile performance evidence after checking the real-device profile.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
    })

    expect(report.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      redTeamSignedOff: false,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review for force-field must include substantive adversarial notes',
      ]),
    )
  })

  it('does not credit red-team signoff rows with unresolved blocker findings', () => {
    const redTeamReviews = completedRedTeamRows('force-field').map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            blockerFindings: ['Export cleanliness attack found unresolved copy-paste integration risk.'],
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
    })

    expect(report.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      redTeamSignedOff: false,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining(['red-team review for force-field must clear blockerFindings before signoff']),
    )
  })

  it('does not credit red-team signoff rows with failed adversarial criteria', () => {
    const redTeamReviews = completedRedTeamRows('force-field').map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            criteria: {
              ...review.criteria,
              'export-clean': 'fail' as const,
            },
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews,
    })

    expect(report.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      redTeamSignedOff: false,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review for force-field must pass every required adversarial criterion before signoff',
      ]),
    )
  })

  it('does not credit production-ready red-team signoff before real-device profiles exist', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-device-profiling',
      realDeviceProfiled: false,
      redTeamSignedOff: false,
      productionReady: false,
      requiredActions: [
        'Attach measured mobile Safari and Chrome Android profile evidence.',
        'Resolve adversarial red-team blocking findings and record sign-off.',
      ],
    })
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
    expect(report.summary.realDeviceProfiledEffects).toBe(0)
  })

  it('does not credit one-platform real-device profile evidence as mobile-ready', () => {
    const report = createPfxProductionReadinessReport({
      implementations: completedImplementationRows('force-field'),
      mobileSafariProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-device-profiling',
      mobileSafariProfiled: true,
      chromeAndroidProfiled: false,
      realDeviceProfiled: false,
      redTeamSignedOff: false,
    })
    expect(forceField?.requiredActions).toContain('Attach measured Chrome Android profile evidence.')
    expect(forceField?.requiredActions).not.toContain('Attach measured mobile Safari profile evidence.')
    expect(forceField?.requiredActions).not.toContain('Attach measured mobile Safari and Chrome Android profile evidence.')
    expect(report.summary.realDeviceProfiledEffects).toBe(0)
    expect(report.summary).toMatchObject({
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack mobile Safari profiling evidence',
        '500 effects lack Chrome Android profiling evidence',
        'real-device profile evidence for force-field must include both mobile Safari and Chrome Android profiles',
      ]),
    )
    expect(report.blockingFindings).not.toContain('500 effects lack mobile Safari and Chrome Android profiling evidence')
  })

  it('does not credit approved-deferral red-team rows as production-ready signoff', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field', 'red-team-lead', 'approved-deferral'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-red-team-signoff',
      productionReady: false,
      redTeamSignedOff: false,
      requiredActions: ['Resolve adversarial red-team blocking findings and record sign-off.'],
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
  })

  it('does not credit production-ready approvals that omit taxonomy review evidence', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field, but this row intentionally omits the taxonomy evidence reference.',
          evidence: [
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-production-approval',
      productionReady: false,
      requiredActions: ['Attach every required production approval evidence reference for the same effect.'],
    })
    expect(report.summary.productionReadyEffects).toBe(0)
  })

  it('does not credit production approval evidence strings without completed prerequisite streams', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale: 'Approval row points at canonical evidence paths, but no completed prerequisite streams were supplied.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      readinessStatus: 'needs-production-implementation',
      productionImplemented: false,
      realDeviceProfiled: false,
      redTeamSignedOff: false,
      productionReady: false,
    })
    expect(report.summary).toMatchObject({
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
      realDeviceProfiledEffects: 0,
      redTeamSignedOffEffects: 0,
    })
  })

  it('credits structured implementation evidence before final production approval', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )

    const report = createPfxProductionReadinessReport({
      implementations: implementationTemplate.implementations,
    })
    const gapAudit = createPfxProductionAcceptanceGapAudit({
      implementations: implementationTemplate.implementations,
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-device-profiling',
      requiredActions: expect.arrayContaining([
        'Replace approval placeholder metadata with named approver, timestamp, and rationale.',
        'Attach measured mobile Safari and Chrome Android profile evidence.',
        'Resolve adversarial red-team blocking findings and record sign-off.',
      ]),
    })
    expect(forceField?.requiredActions).not.toContain(
      'Promote authored-preview coverage to a production implementation or record an approved deferral.',
    )
    expect(report.summary).toMatchObject({
      productionImplementedEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack production implementation or approved deferral',
        '500 effects lack mobile Safari and Chrome Android profiling evidence',
        '500 effects lack red-team sign-off',
      ]),
    )
    expect(gapAudit.summary.missingProductionImplementation).toBe(499)
    expect(gapAudit.effects.find((effect) => effect.effectId === 'force-field')?.gaps.map((gap) => gap.kind)).not.toContain(
      'production-implementation',
    )
  })

  it('does not let pending approval templates mask missing real-device profiling status', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'TODO:final-production-approver',
          approvedAt: 'TODO:ISO-8601',
          rationale:
            'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
    })

    expect(report.effects.find((effect) => effect.effectId === 'force-field')).toMatchObject({
      readinessStatus: 'needs-device-profiling',
      productionImplemented: true,
      realDeviceProfiled: false,
      redTeamSignedOff: false,
      productionReady: false,
    })
    expect(report.summary.byReadinessStatus['needs-device-profiling']).toBe(1)
    expect(report.summary.byReadinessStatus['needs-production-approval']).toBe(0)
  })

  it('rejects structured implementation evidence with non-ISO implementation timestamps', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: 'last Friday',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation manifest fixture with a non-ISO timestamp.',
          }
        : implementation,
    )

    const report = createPfxProductionReadinessReport({
      implementations: implementationTemplate.implementations,
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
      requiredActions: expect.arrayContaining([
        'Promote authored-preview coverage to a production implementation or record an approved deferral.',
      ]),
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
  })

  it('credits structured red-team signoff before final production approval', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted implementation evidence, export cleanliness, control safety, and documentation coverage.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: implementationTemplate.implementations,
      redTeamReviews: redTeamTemplate.reviews,
      realDeviceProfiledEffectIds: ['force-field'],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const gapAudit = createPfxProductionAcceptanceGapAudit({
      implementations: implementationTemplate.implementations,
      redTeamReviews: redTeamTemplate.reviews,
      realDeviceProfiledEffectIds: ['force-field'],
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      redTeamSignedOff: true,
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: expect.arrayContaining([
        'Replace approval placeholder metadata with named approver, timestamp, and rationale.',
      ]),
    })
    expect(forceField?.requiredActions).not.toContain('Attach measured mobile Safari and Chrome Android profile evidence.')
    expect(forceField?.requiredActions).not.toContain(
      'Resolve adversarial red-team blocking findings and record sign-off.',
    )
    expect(report.summary).toMatchObject({
      productionImplementedEffects: 1,
      realDeviceProfiledEffects: 1,
      redTeamSignedOffEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack production implementation or approved deferral',
        '499 effects lack mobile Safari and Chrome Android profiling evidence',
        '499 effects lack red-team sign-off',
      ]),
    )
    const forceFieldGaps = gapAudit.effects.find((effect) => effect.effectId === 'force-field')?.gaps.map((gap) => gap.kind)
    expect(forceFieldGaps).not.toContain('production-implementation')
    expect(forceFieldGaps).not.toContain('red-team-signoff')
  })

  it('rejects structured red-team signoff with non-ISO review timestamps', () => {
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: 'yesterday',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review attacked taxonomy, implementation, mobile performance, export, and documentation evidence before timestamp validation failed.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      redTeamReviews: redTeamTemplate.reviews,
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      redTeamSignedOff: false,
      readinessStatus: 'needs-production-implementation',
      requiredActions: expect.arrayContaining(['Resolve adversarial red-team blocking findings and record sign-off.']),
    })
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining(['red-team review for force-field must include final reviewer and ISO reviewedAt']),
    )
  })

  it('credits strict real-device profile coverage before final production approval', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted real-device mobile performance evidence, export cleanliness, control safety, and documentation coverage before final approval.',
          }
        : review,
    )

    const report = createPfxProductionReadinessReport({
      implementations: implementationTemplate.implementations,
      redTeamReviews: redTeamTemplate.reviews,
      realDeviceProfiledEffectIds: ['force-field'],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const gapAudit = createPfxProductionAcceptanceGapAudit({
      implementations: implementationTemplate.implementations,
      redTeamReviews: redTeamTemplate.reviews,
      realDeviceProfiledEffectIds: ['force-field'],
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionImplemented: true,
      redTeamSignedOff: true,
      realDeviceProfiled: true,
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: ['Replace approval placeholder metadata with named approver, timestamp, and rationale.'],
    })
    expect(report.summary).toMatchObject({
      productionImplementedEffects: 1,
      realDeviceProfiledEffects: 1,
      redTeamSignedOffEffects: 1,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
    })
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        '499 effects lack production implementation or approved deferral',
        '499 effects lack mobile Safari and Chrome Android profiling evidence',
        '499 effects lack red-team sign-off',
      ]),
    )
    const forceFieldGaps = gapAudit.effects.find((effect) => effect.effectId === 'force-field')?.gaps.map((gap) => gap.kind)
    expect(forceFieldGaps).toEqual(['approval-metadata'])
    expect(gapAudit.summary).toMatchObject({
      missingProductionImplementation: 499,
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 499,
      missingRedTeamSignoff: 499,
    })
  })

  it('reports prerequisite-complete effects that are waiting for final production approval metadata', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    implementationTemplate.implementations = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready',
            implementedBy: 'pfx-implementer',
            implementedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(
              Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass']),
            ) as never,
            blockerFindings: [],
            notes: 'force-field production implementation exported R3F component, mobile preset budget, customization controls, preview assets, and documentation evidence.',
          }
        : implementation,
    )
    const redTeamTemplate = createPfxRedTeamReviewTemplate()
    redTeamTemplate.reviews = redTeamTemplate.reviews.map((review) =>
      review.effectId === 'force-field'
        ? {
            ...review,
            status: 'signed-off',
            reviewer: 'red-team-lead',
            reviewedAt: '2026-07-03T12:00:00.000Z',
            criteria: Object.fromEntries(Object.keys(review.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes:
              'force-field adversarial review accepted implementation, mobile evidence, export cleanliness, controls, and documentation for final approval handoff.',
          }
        : review,
    )

    const report = createPfxProductionApprovalReadinessReport({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: implementationTemplate.implementations,
      redTeamReviews: redTeamTemplate.reviews,
      realDeviceProfiledEffectIds: ['force-field'],
    })

    expect(report.schema).toBe('game-bot.r3f-pfx-production-approval-readiness.v1')
    expect(report.summary).toMatchObject({
      totalEffects: 500,
      readyForApprovalEffects: 1,
      alreadyApprovedEffects: 0,
      approvedDeferrals: 0,
      missingPrerequisiteEffects: 499,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      status: 'ready-for-approval',
      missingPrerequisites: [],
      approvalAnchor: '.context/r3f-pfx-production-approvals.json#force-field',
      remainingApprovalAction: 'Record final production approval metadata after reviewing the recommended evidence.',
      recommendedApprovalEvidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari-profile:.context/mobile-safari/force-field.json',
        'chrome-android-profile:.context/chrome-android/force-field.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
      ],
    })
    const fireball = report.effects.find((effect) => effect.effectId === 'fireball')
    expect(fireball).toMatchObject({
      status: 'missing-prerequisites',
      missingPrerequisites: ['taxonomy-review', 'production-implementation', 'real-device-profile', 'red-team-signoff'],
    })
  })

  it('does not mark effects ready for final approval until taxonomy review is complete', () => {
    const report = createPfxProductionApprovalReadinessReport({
      implementations: completedImplementationRows('force-field'),
      redTeamReviews: completedRedTeamRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(report.summary).toMatchObject({
      readyForApprovalEffects: 0,
      missingPrerequisiteEffects: 500,
    })
    expect(forceField).toMatchObject({
      status: 'missing-prerequisites',
      missingPrerequisites: ['taxonomy-review'],
      remainingApprovalAction: 'Complete missing taxonomy review before approval.',
      recommendedApprovalEvidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari-profile:.context/mobile-safari/force-field.json',
        'chrome-android-profile:.context/chrome-android/force-field.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
      ],
    })
  })

  it('reports only the exact missing approval prerequisites in remaining actions', () => {
    const report = createPfxProductionApprovalReadinessReport({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: completedImplementationRows('force-field'),
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        'force-field': {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    const markdown = exportPfxProductionApprovalReadinessReportMarkdown(report)

    expect(forceField).toMatchObject({
      status: 'missing-prerequisites',
      missingPrerequisites: ['real-device-profile', 'red-team-signoff'],
      remainingApprovalAction: 'Complete missing real-device profile and red-team signoff before approval.',
      captureHandoff: {
        operatorLaunchUrl: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator',
        operatorLaunchUrlTemplate:
          'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
        mobileSafari: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=force-field',
          outputFile: '.context/mobile-safari/force-field.json',
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
          captureUrlReachability: 'network-reachable',
        },
        chromeAndroid: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=chrome-android',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=force-field',
          outputFile: '.context/chrome-android/force-field.json',
          evidenceReference: 'chrome-android-profile:.context/chrome-android/force-field.json',
          captureUrlReachability: 'network-reachable',
        },
      },
    })
    expect(markdown).toContain(
      'Mobile Safari capture: `http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari`',
    )
    expect(markdown).not.toContain('Mobile Safari auto-upload: `')
    expect(markdown).toContain(
      'Mobile Safari auto-upload template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=force-field&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('Mobile Safari auto-upload device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain(
      'Chrome Android capture: `http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=chrome-android`',
    )
    expect(markdown).not.toContain('Chrome Android auto-upload: `')
    expect(markdown).toContain(
      'Chrome Android auto-upload template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=force-field&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('Chrome Android auto-upload device label: required (`profileDeviceLabel`)')

    const onePlatformReport = createPfxProductionApprovalReadinessReport({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: completedImplementationRows('force-field'),
      mobileSafariProfiledEffectIds: ['force-field'],
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        'force-field': {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    expect(onePlatformReport.summary).toMatchObject({
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 500,
    })
    const onePlatformForceField = onePlatformReport.effects.find((effect) => effect.effectId === 'force-field')
    expect(onePlatformForceField).toMatchObject({
      status: 'missing-prerequisites',
      mobileSafariProfiled: true,
      chromeAndroidProfiled: false,
      realDeviceProfiled: false,
      missingPrerequisites: ['chrome-android-profile', 'red-team-signoff'],
      remainingApprovalAction: 'Complete missing Chrome Android profile and red-team signoff before approval.',
      captureHandoff: {
        mobileSafari: {
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
        },
        chromeAndroid: {
          evidenceReference: 'chrome-android-profile:.context/chrome-android/force-field.json',
        },
      },
    })

    const localOnlyReport = createPfxProductionApprovalReadinessReport({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: completedImplementationRows('force-field'),
      realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/',
    })
    const localOnlyMarkdown = exportPfxProductionApprovalReadinessReportMarkdown(localOnlyReport)

    expect(localOnlyMarkdown).toContain('Mobile Safari reachability: `local-only`')
    expect(localOnlyMarkdown).toContain(
      'Mobile Safari capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
    )
    expect(localOnlyMarkdown).toContain(
      'Mobile Safari tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
    )
  })

  it('does not credit production implementation rows with placeholder implementation evidence', () => {
    const implementationTemplate = createPfxProductionImplementationTemplate()
    const implementationRows = implementationTemplate.implementations.map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            status: 'production-ready' as const,
            implementedBy: 'TODO:implementer',
            implementedAt: 'TODO:ISO-8601',
            criteria: Object.fromEntries(Object.keys(implementation.criteria).map((criterion) => [criterion, 'pass'])) as never,
            blockerFindings: [],
            notes: 'TODO:record production implementation notes, exported component evidence, and safe customization decisions.',
          }
        : implementation,
    )
    const report = createPfxProductionReadinessReport({
      implementations: implementationRows,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation for force-field must include final implementedBy and ISO implementedAt',
      ]),
    )
  })

  it('does not credit production implementation rows with generic implementation notes', () => {
    const implementationRows = completedImplementationRows('force-field').map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            notes: 'Implementation complete.',
          }
        : implementation,
    )
    const report = createPfxProductionReadinessReport({
      implementations: implementationRows,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation for force-field must include substantive implementation notes',
      ]),
    )
  })

  it('does not credit production implementation rows with non-canonical source paths', () => {
    const implementationRows = completedImplementationRows('force-field').map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            sourcePath: 'tools/3d-pfx-library/src/index.tsx#fireball',
          }
        : implementation,
    )
    const report = createPfxProductionReadinessReport({
      implementations: implementationRows,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
      requiredActions: expect.arrayContaining([
        'Promote authored-preview coverage to a production implementation or record an approved deferral.',
      ]),
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation for force-field sourcePath must be tools/3d-pfx-library/src/index.tsx#force-field',
      ]),
    )
  })

  it('does not credit production implementation rows with unresolved blocker findings', () => {
    const implementationRows = completedImplementationRows('force-field').map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            blockerFindings: ['Export snippet omits required typed R3F component integration evidence.'],
          }
        : implementation,
    )
    const report = createPfxProductionReadinessReport({
      implementations: implementationRows,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation for force-field must clear blockerFindings before production-ready status',
      ]),
    )
  })

  it('does not credit production implementation rows with failed implementation criteria', () => {
    const implementationRows = completedImplementationRows('force-field').map((implementation) =>
      implementation.effectId === 'force-field'
        ? {
            ...implementation,
            criteria: {
              ...implementation.criteria,
              'drop-in-r3f-component': 'fail' as const,
            },
          }
        : implementation,
    )
    const report = createPfxProductionReadinessReport({
      implementations: implementationRows,
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation for force-field must pass every required implementation criterion before production-ready status',
      ]),
    )
  })

  it('does not credit duplicated production implementation rows', () => {
    const implementationRows = completedImplementationRows('force-field')
    const forceFieldImplementation = implementationRows.find((implementation) => implementation.effectId === 'force-field')!
    const report = createPfxProductionReadinessReport({
      implementations: [
        ...implementationRows,
        {
          ...forceFieldImplementation,
          implementedBy: 'second-implementer',
        },
      ],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation manifest has duplicate effect rows: force-field',
      ]),
    )
  })

  it('does not credit production implementations from manifests with unknown effect rows', () => {
    const implementationRows = completedImplementationRows('force-field')
    const forceFieldImplementation = implementationRows.find((implementation) => implementation.effectId === 'force-field')!
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: [
        ...implementationRows,
        {
          ...forceFieldImplementation,
          effectId: 'not-in-taxonomy',
          sourcePath: 'tools/3d-pfx-library/src/index.tsx#not-in-taxonomy',
        },
      ],
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionImplemented: false,
      productionReady: false,
      readinessStatus: 'needs-production-implementation',
    })
    expect(report.summary.productionImplementedEffects).toBe(0)
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production implementation manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('does not credit duplicated red-team review rows', () => {
    const redTeamRows = completedRedTeamRows('force-field')
    const forceFieldReview = redTeamRows.find((review) => review.effectId === 'force-field')!
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: [
        ...redTeamRows,
        {
          ...forceFieldReview,
          reviewer: 'second-red-team-lead',
        },
      ],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      redTeamSignedOff: false,
      productionReady: false,
      readinessStatus: 'needs-red-team-signoff',
    })
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review manifest has duplicate effect rows: force-field',
      ]),
    )
  })

  it('does not credit red-team reviews from manifests with unknown effect rows', () => {
    const redTeamRows = completedRedTeamRows('force-field')
    const forceFieldReview = redTeamRows.find((review) => review.effectId === 'force-field')!
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: [
        ...redTeamRows,
        {
          ...forceFieldReview,
          effectId: 'not-in-taxonomy',
        },
      ],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      redTeamSignedOff: false,
      productionReady: false,
      readinessStatus: 'needs-red-team-signoff',
    })
    expect(report.summary.redTeamSignedOffEffects).toBe(0)
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'red-team review manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('exports a reviewer-readable Markdown handoff for production approval readiness', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxProductionApprovalReadinessReportMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const report = createPfxProductionApprovalReadinessReport({
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: completedImplementationRows('force-field'),
      redTeamReviews: completedRedTeamRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
    })
    const markdown = exportMarkdown(report)

    expect(markdown).toContain('# R3F PFX Production Approval Readiness')
    expect(markdown).toContain('Treat this handoff as non-approving final approval input.')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Ready for approval: 1')
    expect(markdown).toContain('Missing prerequisites: 499')
    expect(markdown).toContain('Missing mobile Safari profiles: 499')
    expect(markdown).toContain('Missing Chrome Android profiles: 499')
    expect(markdown).toContain('Missing red-team signoff: 499')
    expect(markdown).toContain('## Ready For Approval')
    expect(markdown).toContain('### Force Field (`force-field`)')
    expect(markdown).toContain('Approval anchor: `.context/r3f-pfx-production-approvals.json#force-field`')
    expect(markdown).toContain('`taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field`')
    expect(markdown).toContain('`production-implementation:.context/r3f-pfx-production-implementation.json#force-field`')
    expect(markdown).toContain('`mobile-safari-profile:.context/mobile-safari/force-field.json`')
    expect(markdown).toContain('`chrome-android-profile:.context/chrome-android/force-field.json`')
    expect(markdown).toContain('`red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field`')
    expect(markdown).toContain('## Missing Prerequisites')
    expect(markdown).toContain('### Fireball (`fireball`)')
    expect(markdown).toContain('Missing: `taxonomy-review`, `production-implementation`, `real-device-profile`, `red-team-signoff`')
    expect(markdown).toContain('Final acceptance still requires final approval metadata and the strict verifier inputs.')
  })

  it('exports a non-approving production approval batch sheet for final reviewer handoff', () => {
    const createBatchSheet = (PfxLibrary as Record<string, unknown>).createPfxProductionApprovalBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxProductionApprovalBatchSheetMarkdown
    expect(createBatchSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createBatchSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createBatchSheet({
      batchId: 'production-approval-batch-001',
      realDeviceCaptureBaseUrl: 'http://localhost:4173',
      realDeviceCaptureBatchIdsByEffectId: {
        'force-field': {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })

    expect(sheet.schema).toBe('game-bot.r3f-pfx-production-approval-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-production-approval-batch-sheet',
      sourceReadinessSchema: 'game-bot.r3f-pfx-production-approval-readiness.v1',
      outputFile: '.context/r3f-pfx-production-approvals.json',
    })
    expect(sheet.batch).toMatchObject({
      batchId: 'production-approval-batch-001',
      firstRank: 1,
      lastRank: 25,
      effectCount: 25,
    })
    expect(sheet.effects).toHaveLength(25)

    const forceField = sheet.effects.find((effect: { effectId: string }) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      approved: false,
      approvalAnchor: '.context/r3f-pfx-production-approvals.json#force-field',
      status: 'missing-prerequisites',
      missingPrerequisites: ['taxonomy-review', 'production-implementation', 'real-device-profile', 'red-team-signoff'],
      recommendedApprovalEvidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari-profile:.context/mobile-safari/force-field.json',
        'chrome-android-profile:.context/chrome-android/force-field.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
      ],
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/force-field.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/force-field-clip.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#force-field',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#force-field',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before final approval.',
          'Compare all 17 style variants against rendered browser style controls before final approval.',
          'Exercise min/default/max states for render-impact and budget-impact controls before final approval.',
        ],
      },
      outputFile: '.context/r3f-pfx-production-approvals.json',
    })
    expect(forceField).not.toHaveProperty('approvalRowTemplate')

    const markdown = exportMarkdown(sheet)
    expect(markdown).toContain('# R3F PFX Production Approval Batch Sheet')
    expect(markdown).toContain('Treat this handoff as non-approving final approval input.')
    expect(markdown).toContain('Batch: `production-approval-batch-001`')
    expect(markdown).toContain('Output file: `.context/r3f-pfx-production-approvals.json`')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain('Status: `missing-prerequisites`')
    expect(markdown).toContain('Missing: `taxonomy-review`, `production-implementation`, `real-device-profile`, `red-team-signoff`')
    expect(markdown).toContain('Approval anchor: `.context/r3f-pfx-production-approvals.json#force-field`')
    expect(markdown).toContain('### Visual Inspection Targets')
    expect(markdown).toContain('- Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/force-field.svg`')
    expect(markdown).toContain('- Animated clip: `.context/r3f-pfx-preview-assets/clips/force-field-clip.svg`')
    expect(markdown).toContain('- Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#force-field`')
    expect(markdown).toContain('- Control matrix: `.context/r3f-pfx-control-safety-matrix.json#force-field`')
    expect(markdown).toContain('- Inspect default thumbnail and animated clip before final approval.')
    expect(markdown).toContain('### Approval Row Template')
    expect(markdown).toContain('Not available while production approval prerequisites are missing.')
    expect(markdown).not.toContain('"approvedBy": "TODO:final-production-approver"')
    expect(markdown).not.toContain('- Mobile Safari auto-upload: `')
    expect(markdown).not.toContain('- Chrome Android auto-upload: `')
    expect(markdown).toContain(
      '- Mobile Safari auto-upload template: `http://localhost:4173/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=force-field&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('- Mobile Safari auto-upload device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain(
      '- Chrome Android auto-upload template: `http://localhost:4173/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=force-field&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('- Chrome Android auto-upload device label: required (`profileDeviceLabel`)')
  })

  it('offers only production-ready decisions once production approval prerequisites are complete', () => {
    const createBatchSheet = (PfxLibrary as Record<string, unknown>).createPfxProductionApprovalBatchSheet
    expect(createBatchSheet).toBeTypeOf('function')
    if (typeof createBatchSheet !== 'function') return

    const sheet = createBatchSheet({
      batchId: 'production-approval-batch-001',
      taxonomyReviewedEffectIds: ['force-field'],
      implementations: completedImplementationRows('force-field'),
      redTeamReviews: completedRedTeamRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
    })
    const forceField = sheet.effects.find((effect: { effectId: string }) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      status: 'ready-for-approval',
      missingPrerequisites: [],
      decisionOptions: ['production-ready'],
      approvalRowTemplate: {
        effectId: 'force-field',
        decision: 'production-ready',
        evidence: [
          'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
          'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
          'mobile-safari-profile:.context/mobile-safari/force-field.json',
          'chrome-android-profile:.context/chrome-android/force-field.json',
          'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
        ],
      },
    })
  })

  it('exports a non-approving production approval batch sheet index for all 500 effects', () => {
    const createIndex = (PfxLibrary as Record<string, unknown>).createPfxProductionApprovalBatchSheetIndex
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxProductionApprovalBatchSheetIndexMarkdown
    expect(createIndex).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createIndex !== 'function' || typeof exportMarkdown !== 'function') return

    const index = createIndex({
      outputDirectory: '.context/production-approval-batches',
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
    })

    expect(index.schema).toBe('game-bot.r3f-pfx-production-approval-batch-sheet-index.v1')
    expect(index.summary).toMatchObject({
      totalBatches: 20,
      totalEffects: 500,
      outputDirectory: '.context/production-approval-batches',
      approvalStatus: 'non-approving-production-approval-batch-sheet-index',
      bulkCommand: expect.stringContaining('--approval-batch-sheet-directory .context/production-approval-batches'),
      operatorLaunchUrl: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator',
      operatorLaunchUrlTemplate: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
    })
    expect(index.sheets).toHaveLength(20)
    expect(index.sheets[0]).toMatchObject({
      batchId: 'production-approval-batch-001',
      firstRank: 1,
      lastRank: 25,
      effectCount: 25,
      firstEffectId: 'fireball',
      lastEffectId: 'level-up-flare',
      outputFile: '.context/production-approval-batches/production-approval-batch-001.json',
      markdownOutputFile: '.context/production-approval-batches/production-approval-batch-001.md',
      command: expect.stringContaining('--approval-batch-id production-approval-batch-001'),
    })
    expect(index.sheets[19]).toMatchObject({
      batchId: 'production-approval-batch-020',
      firstRank: 476,
      lastRank: 500,
      effectCount: 25,
      outputFile: '.context/production-approval-batches/production-approval-batch-020.json',
      markdownOutputFile: '.context/production-approval-batches/production-approval-batch-020.md',
    })

    const markdown = exportMarkdown(index)
    expect(markdown).toContain('# R3F PFX Production Approval Batch Sheet Index')
    expect(markdown).toContain('Treat this index as non-approving final approval guidance.')
    expect(markdown).toContain('Total batches: 20')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Output directory: `.context/production-approval-batches`')
    expect(markdown).toContain('Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`')
    expect(markdown).toContain(
      'Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain(`LAN handoff command: \`${CANONICAL_LAN_PRODUCTION_HANDOFF_COMMAND}\``)
    expect(markdown).toContain(
      `Tunnel/base URL handoff command: \`${CANONICAL_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\``,
    )
    expect(markdown).toContain(
      '- `production-approval-batch-001` (ranks 1-25, 25 effects, `fireball` to `level-up-flare`): `.context/production-approval-batches/production-approval-batch-001.md`',
    )
    expect(markdown).toContain(
      '--approval-batch-sheet-output .context/production-approval-batches/production-approval-batch-001.json',
    )
  })

  it('rejects placeholder approval metadata even when evidence keys are present', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'TODO:red-team-reviewer',
          approvedAt: 'TODO:ISO-8601',
          rationale: 'TODO:describe production implementation, measured mobile performance, and red-team signoff.',
          evidence: [
            'production-implementation:tools/3d-pfx-library/src/index.tsx#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:docs/r3f-pfx-library-red-team.md#force-field',
          ],
        },
      ],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-implementation',
      requiredActions: expect.arrayContaining(['Replace approval placeholder metadata with named approver, timestamp, and rationale.']),
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.summary.effectsRequiringDecision).toBe(500)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval for force-field must include final approvedBy, ISO approvedAt, and substantive rationale',
      ]),
    )
  })

  it('keeps canonical pending approval templates on the aggregate approval blocker', () => {
    const report = createPfxProductionReadinessReport({
      approvals: createPfxProductionApprovalTemplate().approvals,
    })

    expect(report.summary.effectsRequiringDecision).toBe(500)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining(['500 effects lack final production approval or approved deferral']),
    )
    expect(report.blockingFindings.filter((finding) => finding.startsWith('production approval for '))).toEqual([])
  })

  it('rejects final production approval metadata with non-ISO approval timestamps', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: 'July 3 2026 noon',
          rationale: 'Representative approval fixture with a non-ISO timestamp.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: expect.arrayContaining(['Replace approval placeholder metadata with named approver, timestamp, and rationale.']),
    })
    expect(report.summary.productionReadyEffects).toBe(0)
  })

  it('does not credit rubber-stamped final production approval rationale', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale: 'Looks good.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: expect.arrayContaining(['Replace approval placeholder metadata with named approver, timestamp, and rationale.']),
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval for force-field must include substantive rationale covering taxonomy, implementation, mobile profile, and red-team evidence',
      ]),
    )
  })

  it('does not credit final production approval rationale that omits required evidence dimensions', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed implementation evidence and confirms the exported component is ready for production use.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
      requiredActions: expect.arrayContaining(['Replace approval placeholder metadata with named approver, timestamp, and rationale.']),
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval for force-field must include substantive rationale covering taxonomy, implementation, mobile profile, and red-team evidence',
      ]),
    )
  })

  it('reports duplicate and unknown production approval rows as blocking findings', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'red-team-lead',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'red-team-lead',
          approvedAt: '2026-07-03T12:01:00.000Z',
          rationale: 'Duplicate approval fixture.',
          evidence: [],
        },
        {
          effectId: 'not-in-taxonomy',
          decision: 'production-ready',
          approvedBy: 'red-team-lead',
          approvedAt: '2026-07-03T12:02:00.000Z',
          rationale: 'Unknown approval fixture.',
          evidence: [],
        },
      ],
    })

    expect(report.passed).toBe(false)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval manifest has duplicate effect rows: force-field',
        'production approval manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('does not credit duplicated production approval rows', () => {
    const approval = {
      effectId: 'force-field',
      decision: 'production-ready' as const,
      approvedBy: 'production-approver',
      approvedAt: '2026-07-03T12:00:00.000Z',
      rationale:
        'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
      evidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari-profile:.context/mobile-safari/force-field.json',
        'chrome-android-profile:.context/chrome-android/force-field.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
      ],
    }
    const report = createPfxProductionReadinessReport({
      approvals: [
        approval,
        {
          ...approval,
          approvedBy: 'second-production-approver',
          approvedAt: '2026-07-03T12:01:00.000Z',
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval manifest has duplicate effect rows: force-field',
      ]),
    )
  })

  it('does not credit production approvals from manifests with unknown effect rows', () => {
    const report = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for force-field.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
            'chrome-android-profile:.context/chrome-android/force-field.json',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
        {
          effectId: 'not-in-taxonomy',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:01:00.000Z',
          rationale:
            'Final approval reviewed taxonomy, implementation, mobile profile evidence, and red-team signoff for an unknown effect.',
          evidence: [],
        },
      ],
      implementations: completedImplementationRows('force-field'),
      realDeviceProfiledEffectIds: ['force-field'],
      redTeamReviews: completedRedTeamRows('force-field'),
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = report.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField).toMatchObject({
      productionReady: false,
      readinessStatus: 'needs-production-approval',
    })
    expect(report.summary.productionReadyEffects).toBe(0)
    expect(report.blockingFindings).toEqual(
      expect.arrayContaining([
        'production approval manifest has unknown effect rows: not-in-taxonomy',
      ]),
    )
  })

  it('requires approved deferrals to include explicit deferral and red-team evidence', () => {
    const bareDeferral = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'approved-deferral',
          approvedBy: 'red-team-lead',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale: 'Representative deferral request without machine-readable evidence.',
          evidence: [],
        },
      ],
    })

    const bareForceField = bareDeferral.effects.find((effect) => effect.effectId === 'force-field')
    expect(bareForceField).toMatchObject({
      approvedDeferral: false,
      readinessStatus: 'needs-production-implementation',
      requiredActions: expect.arrayContaining([
        'Promote authored-preview coverage to a production implementation or record an approved deferral.',
        'Resolve adversarial red-team blocking findings and record sign-off.',
      ]),
    })
    expect(bareDeferral.summary.approvedDeferrals).toBe(0)
    expect(bareDeferral.summary.effectsRequiringDecision).toBe(500)

    const evidenceBackedDeferral = createPfxProductionReadinessReport({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'approved-deferral',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Deferred because this taxonomy slot has explicit adversarial red-team deferral evidence and is intentionally represented by a neighboring production effect.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'approved-deferral:.context/r3f-pfx-red-team-review.json#force-field',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      redTeamReviews: completedRedTeamRows('force-field', 'red-team-lead', 'approved-deferral'),
      taxonomyReviewedEffectIds: ['force-field'],
    })

    const deferredForceField = evidenceBackedDeferral.effects.find((effect) => effect.effectId === 'force-field')
    expect(deferredForceField).toMatchObject({
      approvedDeferral: true,
      readinessStatus: 'approved-deferral',
      requiredActions: [],
    })
    expect(evidenceBackedDeferral.summary).toMatchObject({
      approvedDeferrals: 1,
      effectsRequiringDecision: 499,
      redTeamSignedOffEffects: 0,
    })
    expect(evidenceBackedDeferral.blockingFindings).toEqual(
      expect.arrayContaining(['499 effects lack red-team sign-off']),
    )
  })

  it('exports a production approval template for every accepted taxonomy effect', () => {
    const template = createPfxProductionApprovalTemplate({
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })

    expect(template.schema).toBe('game-bot.r3f-pfx-production-approval-template.v1')
    expect(template.summary).toEqual({
      totalEffects: 500,
      productionReadyDecisions: 500,
      approvedDeferrals: 0,
      submittedApprovals: 0,
      pendingMetadataApprovals: 500,
      evidenceSlotsPerEffect: 5,
      approvalStatus: 'non-approving-production-approval-template',
    })
    expect(template.instructions).toMatchObject({
      implementationManifestFile: '.context/r3f-pfx-production-implementation.json',
      realDeviceAuditFile: '.context/r3f-pfx-real-device-capture-audit.json',
      redTeamReviewFile: '.context/r3f-pfx-red-team-review.json',
      finalAcceptanceCommand: CANONICAL_FINAL_ACCEPTANCE_COMMAND,
    })
    expect(template.instructions.finalAcceptanceCommand).not.toContain('verify:evidence --')
    expect(template.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Replace every TODO metadata field before submitting the approval manifest.',
        'Keep all five canonical evidence references on production-ready rows for the same effect.',
        'Use captureHandoff links only to collect missing real-device evidence; they never replace canonical evidence references or final approval metadata.',
        'Use approved-deferral only when an explicit deferral decision and red-team evidence exist for the same effect.',
      ]),
    )
    expect(template.instructions.productionReadyEvidenceSlots).toEqual([
      'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#<effectId>',
      'production-implementation:.context/r3f-pfx-production-implementation.json#<effectId>',
      'mobile-safari-profile:.context/mobile-safari/<effectId>.json',
      'chrome-android-profile:.context/chrome-android/<effectId>.json',
      'red-team-signoff:.context/r3f-pfx-red-team-review.json#<effectId>',
    ])
    expect(template.instructions.approvedDeferralEvidenceSlots).toEqual([
      'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#<effectId>',
      'approved-deferral:.context/r3f-pfx-red-team-review.json#<effectId>',
      'red-team-signoff:.context/r3f-pfx-red-team-review.json#<effectId>',
    ])
    expect(template.approvals).toHaveLength(500)
    expect(template.approvals[0]).toMatchObject({
      effectId: 'fireball',
      decision: 'production-ready',
      approvedBy: 'TODO:final-production-approver',
      approvedAt: 'TODO:ISO-8601',
      rationale: 'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.',
      evidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#fireball',
        'production-implementation:.context/r3f-pfx-production-implementation.json#fireball',
        'mobile-safari-profile:.context/mobile-safari/fireball.json',
        'chrome-android-profile:.context/chrome-android/fireball.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#fireball',
      ],
      captureHandoff: {
        mobileSafari: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
          outputFile: '.context/mobile-safari/fireball.json',
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
          captureUrlReachability: 'network-reachable',
        },
        chromeAndroid: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
          outputFile: '.context/chrome-android/fireball.json',
          evidenceReference: 'chrome-android-profile:.context/chrome-android/fireball.json',
          captureUrlReachability: 'network-reachable',
        },
      },
    })
    expect(template.approvals.find((approval) => approval.effectId === 'force-field')).toMatchObject({
      approvedBy: 'TODO:final-production-approver',
      evidence: [
        'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
        'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari-profile:.context/mobile-safari/force-field.json',
        'chrome-android-profile:.context/chrome-android/force-field.json',
        'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
      ],
    })

    const exported = JSON.parse(exportPfxProductionApprovalTemplateJson(template))
    expect(exported.approvals).toHaveLength(500)
    expect(exported.summary.evidenceSlotsPerEffect).toBe(5)
    expect(exported.approvals.every((approval: { approvedBy: string }) => approval.approvedBy !== 'TODO:red-team-reviewer')).toBe(
      true,
    )
  })

  it('exports an effect-by-effect final acceptance gap audit with canonical evidence paths', () => {
    const audit = createPfxProductionAcceptanceGapAudit({
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })

    expect(audit.schema).toBe('game-bot.r3f-pfx-production-gap-audit.v1')
    expect(audit.summary).toEqual({
      totalEffects: 500,
      effectsWithOpenGaps: 500,
      missingApprovalMetadata: 500,
      missingProductionImplementation: 500,
      missingTaxonomyReview: 0,
      missingMobileSafariProfiles: 500,
      missingChromeAndroidProfiles: 500,
      missingRedTeamSignoff: 500,
      missingApprovedDeferrals: 0,
      operatorLaunchUrl: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator',
      operatorLaunchUrlTemplate: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
    })
    expect(audit.effects).toHaveLength(500)
    expect(audit.effects[0]).toMatchObject({
      effectId: 'fireball',
      readinessStatus: 'needs-production-implementation',
      openGapCount: 5,
      gaps: [
        {
          kind: 'approval-metadata',
          label: 'Final approval metadata',
          evidence: 'production-approval:.context/r3f-pfx-production-approvals.json#fireball',
          filePath: '.context/r3f-pfx-production-approvals.json',
        },
        {
          kind: 'production-implementation',
          label: 'Production implementation evidence',
          evidence: 'production-implementation:.context/r3f-pfx-production-implementation.json#fireball',
          filePath: '.context/r3f-pfx-production-implementation.json',
        },
        {
          kind: 'mobile-safari-profile',
          label: 'Real-device mobile Safari profile',
          evidence: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
          filePath: '.context/mobile-safari/fireball.json',
          captureHandoff: {
            captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
            autoUploadUrl:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
            outputFile: '.context/mobile-safari/fireball.json',
            evidenceReference: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
            captureUrlReachability: 'network-reachable',
          },
        },
        {
          kind: 'chrome-android-profile',
          label: 'Real-device Chrome Android profile',
          evidence: 'chrome-android-profile:.context/chrome-android/fireball.json',
          filePath: '.context/chrome-android/fireball.json',
          captureHandoff: {
            captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
            autoUploadUrl:
              'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
            outputFile: '.context/chrome-android/fireball.json',
            evidenceReference: 'chrome-android-profile:.context/chrome-android/fireball.json',
            captureUrlReachability: 'network-reachable',
          },
        },
        {
          kind: 'red-team-signoff',
          label: 'Adversarial red-team signoff',
          evidence: 'red-team-signoff:.context/r3f-pfx-red-team-review.json#fireball',
          filePath: '.context/r3f-pfx-red-team-review.json',
        },
      ],
    })
    const markdown = exportPfxProductionAcceptanceGapAuditMarkdown(audit)
    expect(markdown).toContain('# R3F PFX Production Gap Audit')
    expect(markdown).toContain('Effects with open gaps: 500')
    expect(markdown).toContain('Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`')
    expect(markdown).toContain(
      'Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain('- Final approval metadata: `production-approval:.context/r3f-pfx-production-approvals.json#fireball`')
    expect(markdown).toContain('- Real-device mobile Safari profile: `mobile-safari-profile:.context/mobile-safari/fireball.json`')
    expect(markdown).toContain(
      '  - Capture: `http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari`',
    )
    expect(markdown).toContain(
      '  - Auto-upload: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball`',
    )
    expect(markdown).toContain(
      '  - Auto-upload template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('  - Auto-upload device label: required (`profileDeviceLabel`)')
    expect(markdown).toContain('Treat this audit as non-approving gap context.')

    const localOnlyAudit = createPfxProductionAcceptanceGapAudit({
      realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/',
    })
    const localOnlyMarkdown = exportPfxProductionAcceptanceGapAuditMarkdown(localOnlyAudit)
    expect(localOnlyMarkdown).toContain('  - Reachability: `local-only`')
    expect(localOnlyMarkdown).toContain(
      '  - This capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
    )
    expect(localOnlyMarkdown).toContain(
      '  - Tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
    )

    const partiallyApproved = createPfxProductionAcceptanceGapAudit({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'production-ready',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Partial approval fixture records production implementation evidence while taxonomy review, mobile profile evidence, and red-team signoff remain intentionally open.',
          evidence: [
            'production-implementation:.context/r3f-pfx-production-implementation.json#force-field',
            'mobile-safari-profile:.context/mobile-safari/force-field.json',
          ],
        },
      ],
      implementations: completedImplementationRows('force-field'),
    })
    const forceField = partiallyApproved.effects.find((effect) => effect.effectId === 'force-field')
    expect(forceField?.openGapCount).toBe(4)
    expect(forceField?.gaps.map((gap) => gap.kind)).toEqual([
      'taxonomy-review',
      'mobile-safari-profile',
      'chrome-android-profile',
      'red-team-signoff',
    ])
    expect(partiallyApproved.summary).toMatchObject({
      effectsWithOpenGaps: 500,
      missingApprovalMetadata: 499,
      missingProductionImplementation: 499,
      missingMobileSafariProfiles: 500,
      missingChromeAndroidProfiles: 500,
      missingRedTeamSignoff: 500,
    })

    const onePlatformProfiled = createPfxProductionAcceptanceGapAudit({
      implementations: completedImplementationRows('force-field'),
      mobileSafariProfiledEffectIds: ['force-field'],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const onePlatformForceField = onePlatformProfiled.effects.find((effect) => effect.effectId === 'force-field')
    expect(onePlatformForceField?.gaps.map((gap) => gap.kind)).not.toContain('mobile-safari-profile')
    expect(onePlatformForceField?.gaps.map((gap) => gap.kind)).toContain('chrome-android-profile')
    expect(onePlatformProfiled.summary).toMatchObject({
      missingMobileSafariProfiles: 499,
      missingChromeAndroidProfiles: 500,
    })
  })

  it('reports missing approved-deferral review evidence without requesting production-ready red-team signoff', () => {
    const audit = createPfxProductionAcceptanceGapAudit({
      approvals: [
        {
          effectId: 'force-field',
          decision: 'approved-deferral',
          approvedBy: 'production-approver',
          approvedAt: '2026-07-03T12:00:00.000Z',
          rationale:
            'Final deferral approval reviewed taxonomy and red-team deferral evidence for a non-production implementation slot.',
          evidence: [
            'taxonomy-review:.context/r3f-pfx-taxonomy-review.json#force-field',
            'approved-deferral:.context/r3f-pfx-red-team-review.json#force-field',
            'red-team-signoff:.context/r3f-pfx-red-team-review.json#force-field',
          ],
        },
      ],
      taxonomyReviewedEffectIds: ['force-field'],
    })
    const forceField = audit.effects.find((effect) => effect.effectId === 'force-field')

    expect(forceField?.readinessStatus).toBe('needs-production-implementation')
    expect(forceField?.gaps.map((gap) => gap.kind)).toEqual(['approved-deferral'])
    expect(forceField?.gaps[0]).toMatchObject({
      label: 'Approved deferral evidence',
      evidence: 'approved-deferral:.context/r3f-pfx-red-team-review.json#force-field',
      filePath: '.context/r3f-pfx-red-team-review.json',
    })
    expect(audit.summary).toMatchObject({
      missingApprovedDeferrals: 1,
      missingRedTeamSignoff: 499,
    })
  })

  it('keeps real-device profile gaps open when pending approval templates only cite future profile evidence', () => {
    const audit = createPfxProductionAcceptanceGapAudit({
      approvals: PFX_TAXONOMY.map((effect) => ({
        effectId: effect.id,
        decision: 'production-ready',
        approvedBy: 'TODO:final-production-approver',
        approvedAt: 'TODO:ISO-8601',
        rationale:
          'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.',
        evidence: [
          `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effect.id}`,
          `production-implementation:.context/r3f-pfx-production-implementation.json#${effect.id}`,
          `mobile-safari-profile:.context/mobile-safari/${effect.id}.json`,
          `chrome-android-profile:.context/chrome-android/${effect.id}.json`,
          `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effect.id}`,
        ],
      })),
    })

    expect(audit.summary).toMatchObject({
      missingApprovalMetadata: 500,
      missingMobileSafariProfiles: 500,
      missingChromeAndroidProfiles: 500,
      missingRedTeamSignoff: 500,
    })
    expect(audit.effects.find((effect) => effect.effectId === 'fireball')).toMatchObject({
      openGapCount: 5,
      gaps: expect.arrayContaining([
        expect.objectContaining({ kind: 'approval-metadata' }),
        expect.objectContaining({ kind: 'mobile-safari-profile' }),
        expect.objectContaining({ kind: 'chrome-android-profile' }),
        expect.objectContaining({ kind: 'red-team-signoff' }),
        expect.objectContaining({ kind: 'production-implementation' }),
      ]),
    })
  })

  it('exports a structured red-team review template covering every effect and required adversarial criterion', () => {
    const template = createPfxRedTeamReviewTemplate()

    expect(template.schema).toBe('game-bot.r3f-pfx-red-team-review.v1')
    expect(template.summary).toEqual({
      totalEffects: 500,
      signedOffEffects: 0,
      approvedDeferrals: 0,
      pendingEffects: 500,
      blockedEffects: 0,
      mobileSafariBlockedEffects: 0,
      chromeAndroidBlockedEffects: 0,
      requiredCriteria: [
        'taxonomy-comprehensive',
        'game-ready-not-decorative',
        'mobile-performance-proven',
        'style-clusters-distinct',
        'customization-safe',
        'export-clean',
        'documentation-sufficient',
      ],
    })
    expect(template.instructions).toMatchObject({
      completionCommand: CANONICAL_LOCAL_ACCEPTANCE_COMMAND,
    })
    expect(template.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(template.reviews).toHaveLength(500)
    expect(template.reviews[0]).toMatchObject({
      effectId: 'fireball',
      status: 'pending',
      reviewer: 'TODO:red-team-reviewer',
      reviewedAt: 'TODO:ISO-8601',
      anchor: 'fireball',
      criteria: {
        'taxonomy-comprehensive': 'pending',
        'game-ready-not-decorative': 'pending',
        'mobile-performance-proven': 'pending',
        'style-clusters-distinct': 'pending',
        'customization-safe': 'pending',
        'export-clean': 'pending',
        'documentation-sufficient': 'pending',
      },
      blockerFindings: ['TODO:record blocking red-team findings or leave empty only after signoff.'],
    })
  })

  it('exports an adversarial red-team blocking manifest when real-device evidence is missing', () => {
    const manifest = createPfxRedTeamBlockingReviewManifest({
      reviewer: 'red-team-mobile-gate',
      reviewedAt: '2026-07-03T12:00:00.000Z',
    })

    expect(manifest.schema).toBe('game-bot.r3f-pfx-red-team-review.v1')
    expect(manifest.summary).toEqual({
      totalEffects: 500,
      signedOffEffects: 0,
      approvedDeferrals: 0,
      pendingEffects: 0,
      blockedEffects: 500,
      mobileSafariBlockedEffects: 500,
      chromeAndroidBlockedEffects: 500,
      requiredCriteria: [
        'taxonomy-comprehensive',
        'game-ready-not-decorative',
        'mobile-performance-proven',
        'style-clusters-distinct',
        'customization-safe',
        'export-clean',
        'documentation-sufficient',
      ],
    })
    expect(manifest.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'This adversarial manifest records blocking red-team findings; it is not red-team signoff.',
        'Do not change blocked rows to signed-off until the missing real-device capture evidence exists and has been attacked.',
      ]),
    )
    expect(manifest.instructions).toMatchObject({
      completionCommand: CANONICAL_LOCAL_ACCEPTANCE_COMMAND,
    })
    expect(manifest.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(manifest.reviews).toHaveLength(500)

    const forceField = manifest.reviews.find((review) => review.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      status: 'blocked',
      reviewer: 'red-team-mobile-gate',
      reviewedAt: '2026-07-03T12:00:00.000Z',
      anchor: 'force-field',
      blockerFindings: [
        'Missing valid mobile Safari real-device capture: .context/mobile-safari/force-field.json',
        'Missing valid Chrome Android real-device capture: .context/chrome-android/force-field.json',
      ],
      notes:
        'Adversarial red-team draft blocks Force Field because mobile browser performance is not proven by valid real-device captures yet.',
    })
    expect(forceField?.criteria).toEqual({
      'taxonomy-comprehensive': 'pass',
      'game-ready-not-decorative': 'pass',
      'mobile-performance-proven': 'fail',
      'style-clusters-distinct': 'pass',
      'customization-safe': 'pass',
      'export-clean': 'pass',
      'documentation-sufficient': 'pass',
    })

    const readiness = createPfxProductionReadinessReport({
      redTeamReviews: manifest.reviews,
    })
    expect(readiness.summary.redTeamSignedOffEffects).toBe(0)
    expect(readiness.blockingFindings).toEqual(expect.arrayContaining(['500 effects lack red-team sign-off']))
  })

  it('exports a non-approving red-team dossier with adversarial attack prompts for every effect', () => {
    const dossier = createPfxRedTeamReviewDossier({
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })

    expect(dossier.schema).toBe('game-bot.r3f-pfx-red-team-dossier.v1')
    expect(dossier.summary).toEqual({
      totalEffects: 500,
      effectsNeedingAdversarialReview: 500,
      requiredCriteria: [
        'taxonomy-comprehensive',
        'game-ready-not-decorative',
        'mobile-performance-proven',
        'style-clusters-distinct',
        'customization-safe',
        'export-clean',
        'documentation-sufficient',
      ],
    })
    expect(dossier.instructions).toMatchObject({
      reviewTemplateFile: '.context/r3f-pfx-red-team-review-template.json',
      implementationManifestFile: '.context/r3f-pfx-production-implementation.json',
      realDeviceAuditFile: '.context/r3f-pfx-real-device-capture-audit.json',
      approvalStatus: 'non-approving-adversarial-review-input',
    })
    expect(dossier.effects).toHaveLength(500)
    expect(dossier.effects[0]).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      reviewStatus: 'needs-adversarial-review',
      redTeamSignedOff: false,
      reviewAnchor: '.context/r3f-pfx-red-team-review.json#fireball',
      implementationAnchor: '.context/r3f-pfx-production-implementation.json#fireball',
      realDeviceEvidence: {
        mobileSafari: '.context/mobile-safari/fireball.json',
        chromeAndroid: '.context/chrome-android/fireball.json',
      },
      captureHandoff: {
        mobileSafari: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=fireball',
          outputFile: '.context/mobile-safari/fireball.json',
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/fireball.json',
          captureUrlReachability: 'network-reachable',
        },
        chromeAndroid: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=chrome-android',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball',
          outputFile: '.context/chrome-android/fireball.json',
          evidenceReference: 'chrome-android-profile:.context/chrome-android/fireball.json',
          captureUrlReachability: 'network-reachable',
        },
      },
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/fireball.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/fireball-clip.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#fireball',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#fireball',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before visual-quality signoff.',
          'Compare all 17 style variants against rendered browser style controls before style signoff.',
          'Exercise min/default/max states for render-impact and budget-impact controls before customization signoff.',
        ],
      },
      attackPrompts: {
        'taxonomy-comprehensive': expect.stringContaining('easy/showy'),
        'game-ready-not-decorative': expect.stringContaining('gameplay'),
        'mobile-performance-proven': expect.stringContaining('mobile Safari'),
        'style-clusters-distinct': expect.stringContaining('simple recolors'),
        'customization-safe': expect.stringContaining('break'),
        'export-clean': expect.stringContaining('R3F'),
        'documentation-sufficient': expect.stringContaining('without asking'),
      },
    })
    expect(dossier.effects[0].evidenceToAttack).toEqual(
      expect.arrayContaining([
        'implementation:.context/r3f-pfx-production-implementation.json#fireball',
        'mobile-safari:.context/mobile-safari/fireball.json',
        'chrome-android:.context/chrome-android/fireball.json',
        'developer-docs:.context/r3f-pfx-developer-docs.json#fireball',
        'style-differentiation:.context/r3f-pfx-style-differentiation-matrix.json#fireball',
        'export-cleanliness:.context/r3f-pfx-export-cleanliness-audit.json#fireball',
      ]),
    )
  })

  it('exports a reviewer-readable Markdown handoff for the red-team dossier', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxRedTeamReviewDossierMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const dossier = createPfxRedTeamReviewDossier({
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const markdown = exportMarkdown(dossier)

    expect(markdown).toContain('# R3F PFX Red-Team Review Dossier')
    expect(markdown).toContain('Treat this handoff as non-approving adversarial review input.')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Effects needing adversarial review: 500')
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-red-team-review.json#fireball`')
    expect(markdown).toContain('Implementation anchor: `.context/r3f-pfx-production-implementation.json#fireball`')
    expect(markdown).toContain('Mobile Safari: `.context/mobile-safari/fireball.json`')
    expect(markdown).toContain('Chrome Android: `.context/chrome-android/fireball.json`')
    expect(markdown).toContain('Capture handoff:')
    expect(markdown).toContain(
      '- Operator workflow: open the launch page on the target phone, enter a concrete device label, then start platform or batch auto-run from that page.',
    )
    expect(markdown).toContain(
      '- Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`',
    )
    expect(markdown).toContain(
      '- Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown.indexOf('- Operator workflow: open the launch page')).toBeLessThan(
      markdown.indexOf('- Mobile Safari auto-upload template:'),
    )
    expect(markdown).toContain(
      '- Mobile Safari capture: `http://192.0.2.55:4765/?profileEffectIds=fireball&profilePlatform=mobile-safari`',
    )
    expect(markdown).not.toContain('- Chrome Android auto-upload: `')
    expect(markdown).toContain(
      '- Chrome Android auto-upload template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=fireball&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('### Visual Inspection Targets')
    expect(markdown).toContain('- Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/fireball.svg`')
    expect(markdown).toContain('- Animated clip: `.context/r3f-pfx-preview-assets/clips/fireball-clip.svg`')
    expect(markdown).toContain('- Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#fireball`')
    expect(markdown).toContain('- Control matrix: `.context/r3f-pfx-control-safety-matrix.json#fireball`')
    expect(markdown).toContain('- Inspect default thumbnail and animated clip before visual-quality signoff.')
    expect(markdown).toContain('### Attack Prompts')
    expect(markdown).toContain('- **Mobile performance proven:** Reject signoff unless Fireball has valid mobile Safari and Chrome Android')
    expect(markdown).toContain('### Evidence To Attack')
    expect(markdown).toContain('- `style-differentiation:.context/r3f-pfx-style-differentiation-matrix.json#fireball`')
  })

  it('exports a red-team adversarial review batch sheet without signing off rows', () => {
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxRedTeamReviewBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxRedTeamReviewBatchSheetMarkdown
    expect(createSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createSheet({
      batchId: 'red-team-review-batch-001',
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        'force-field': {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const markdown = exportMarkdown(sheet)
    const explosion = sheet.effects.find((effect) => effect.effectId === 'explosion')
    const forceField = sheet.effects.find((effect) => effect.effectId === 'force-field')

    expect(sheet.schema).toBe('game-bot.r3f-pfx-red-team-review-batch-sheet.v1')
    expect(sheet.instructions).toMatchObject({
      approvalStatus: 'non-approving-red-team-review-batch-sheet',
      sourceDossierSchema: 'game-bot.r3f-pfx-red-team-dossier.v1',
      outputFile: '.context/r3f-pfx-red-team-review.json',
    })
    expect(sheet.batch).toMatchObject({
      batchId: 'red-team-review-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      outputFile: '.context/r3f-pfx-red-team-review.json',
    })
    expect(sheet.effects).toHaveLength(25)
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      rank: 9,
      name: 'Force Field',
      redTeamSignedOff: false,
      reviewAnchor: '.context/r3f-pfx-red-team-review.json#force-field',
      implementationAnchor: '.context/r3f-pfx-production-implementation.json#force-field',
      requiredCriteria: [
        'taxonomy-comprehensive',
        'game-ready-not-decorative',
        'mobile-performance-proven',
        'style-clusters-distinct',
        'customization-safe',
        'export-clean',
        'documentation-sufficient',
      ],
      evidenceToAttack: expect.arrayContaining([
        'implementation:.context/r3f-pfx-production-implementation.json#force-field',
        'mobile-safari:.context/mobile-safari/force-field.json',
        'chrome-android:.context/chrome-android/force-field.json',
      ]),
      attackPrompts: {
        'mobile-performance-proven': expect.stringContaining('mobile Safari'),
        'style-clusters-distinct': expect.stringContaining('simple recolors'),
      },
      mobileEvidenceGate: {
        status: 'blocked-until-real-device-captures',
        blockers: [
          'Requires valid mobile Safari real-device capture at .context/mobile-safari/force-field.json',
          'Requires valid Chrome Android real-device capture at .context/chrome-android/force-field.json',
        ],
      },
      captureHandoff: {
        mobileSafari: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=mobile-safari&profileAutoUpload=1&batchId=real-device-batch-001&effectId=force-field',
          outputFile: '.context/mobile-safari/force-field.json',
          evidenceReference: 'mobile-safari-profile:.context/mobile-safari/force-field.json',
          captureUrlReachability: 'network-reachable',
        },
        chromeAndroid: {
          captureUrl: 'http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=chrome-android',
          autoUploadUrl:
            'http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=force-field',
          outputFile: '.context/chrome-android/force-field.json',
          evidenceReference: 'chrome-android-profile:.context/chrome-android/force-field.json',
          captureUrlReachability: 'network-reachable',
        },
      },
      visualInspectionTargets: {
        thumbnailAsset: '.context/r3f-pfx-preview-assets/thumbnails/force-field.svg',
        animatedClipAsset: '.context/r3f-pfx-preview-assets/clips/force-field-clip.svg',
        styleDifferentiationAnchor: '.context/r3f-pfx-style-differentiation-matrix.json#force-field',
        controlSafetyAnchor: '.context/r3f-pfx-control-safety-matrix.json#force-field',
        requiredChecks: [
          'Inspect default thumbnail and animated clip before visual-quality signoff.',
          'Compare all 17 style variants against rendered browser style controls before style signoff.',
          'Exercise min/default/max states for render-impact and budget-impact controls before customization signoff.',
        ],
      },
    })
    expect(explosion).toMatchObject({
      effectId: 'explosion',
      reviewerRisk: {
        level: 'heightened',
        performanceTier: 'high',
        mobileSafety: 'caution',
        reasons: [
          'performance tier high needs deeper concurrent-use review',
          'mobile safety caution needs stricter real-device review',
        ],
      },
    })
    expect(markdown).toContain('# R3F PFX Red-Team Review Batch Sheet')
    expect(markdown).toContain('Batch: `red-team-review-batch-001`')
    expect(markdown).toContain('Output file: `.context/r3f-pfx-red-team-review.json`')
    expect(markdown).toContain('## Force Field (`force-field`)')
    expect(markdown).toContain('## Explosion (`explosion`)')
    expect(markdown).toContain('Reviewer risk: `heightened` (`high` tier, `caution` mobile safety)')
    expect(markdown).toContain('- performance tier high needs deeper concurrent-use review')
    expect(markdown).toContain('- mobile safety caution needs stricter real-device review')
    expect(markdown).toContain('Mobile evidence gate: `blocked-until-real-device-captures`')
    expect(markdown).toContain('Visual Inspection Targets')
    expect(markdown).toContain('- Thumbnail: `.context/r3f-pfx-preview-assets/thumbnails/force-field.svg`')
    expect(markdown).toContain('- Animated clip: `.context/r3f-pfx-preview-assets/clips/force-field-clip.svg`')
    expect(markdown).toContain(
      '- Style contact sheet: `.context/r3f-pfx-preview-assets/contact-sheets/style-variants/force-field-style-contact-sheet.svg`',
    )
    expect(markdown).toContain(
      '- Control extremes contact sheet: `.context/r3f-pfx-preview-assets/contact-sheets/control-extremes/force-field-control-extremes-contact-sheet.svg`',
    )
    expect(markdown).toContain(
      '- Style matrix: `.context/r3f-pfx-style-differentiation-matrix.json#force-field`',
    )
    expect(markdown).toContain('- Control matrix: `.context/r3f-pfx-control-safety-matrix.json#force-field`')
    expect(markdown).toContain(
      '- Inspect default thumbnail and animated clip before visual-quality signoff.',
    )
    expect(markdown).toContain(
      '- Requires valid mobile Safari real-device capture at `.context/mobile-safari/force-field.json`',
    )
    expect(markdown).toContain(
      '- Requires valid Chrome Android real-device capture at `.context/chrome-android/force-field.json`',
    )
    expect(markdown).toContain('Capture handoff:')
    expect(markdown).toContain(
      '- Operator workflow: open the launch page on the target phone, enter a concrete device label, then start platform or batch auto-run from that page.',
    )
    expect(markdown).toContain(
      '- Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`',
    )
    expect(markdown).toContain(
      '- Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown.indexOf('- Operator workflow: open the launch page')).toBeLessThan(
      markdown.indexOf('- Mobile Safari auto-upload template:'),
    )
    expect(markdown).toContain(
      '- Mobile Safari capture: `http://192.0.2.55:4765/?profileEffectIds=force-field&profilePlatform=mobile-safari`',
    )
    expect(markdown).not.toContain('- Chrome Android auto-upload: `')
    expect(markdown).toContain(
      '- Chrome Android auto-upload template: `http://192.0.2.55:4765/__r3f-pfx-capture-next?platform=chrome-android&profileAutoUpload=1&batchId=real-device-batch-011&effectId=force-field&profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain('- [ ] Mobile performance proven')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-red-team-review.json#force-field`')
    expect(markdown).toContain('Treat this handoff as non-approving adversarial review input.')
  })

  it('points red-team batch reviewers at LAN and tunnel capture handoffs for local-only URLs', () => {
    const createSheet = (PfxLibrary as Record<string, unknown>).createPfxRedTeamReviewBatchSheet
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxRedTeamReviewBatchSheetMarkdown
    expect(createSheet).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createSheet !== 'function' || typeof exportMarkdown !== 'function') return

    const sheet = createSheet({
      batchId: 'red-team-review-batch-001',
      realDeviceCaptureBaseUrl: 'http://127.0.0.1:4765/',
      realDeviceCaptureBatchIdsByEffectId: {
        fireball: {
          'mobile-safari': 'real-device-batch-001',
          'chrome-android': 'real-device-batch-011',
        },
      },
    })
    const markdown = exportMarkdown(sheet)

    expect(markdown).toContain(
      '- Mobile Safari capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
    )
    expect(markdown).toContain(
      '- Mobile Safari tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
    )
    expect(markdown).toContain(
      '- Chrome Android capture URL is local-only; do not assign it to a phone operator until the production handoff is regenerated with `PFX_CAPTURE_LAN_HOST=<LAN-IP> npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:lan`.',
    )
    expect(markdown).toContain(
      '- Chrome Android tunnel/base URL alternative: `PFX_CAPTURE_BASE_URL=https://<tunnel-host>/ npm --prefix tools/3d-pfx-library/viewer run verify:production-handoff:base-url`.',
    )
  })

  it('exports a non-approving red-team review batch sheet index for all 500 effects', () => {
    const createIndex = (PfxLibrary as Record<string, unknown>).createPfxRedTeamReviewBatchSheetIndex
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxRedTeamReviewBatchSheetIndexMarkdown
    expect(createIndex).toBeTypeOf('function')
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof createIndex !== 'function' || typeof exportMarkdown !== 'function') return

    const index = createIndex({
      outputDirectory: '.context/red-team-review-batches',
      realDeviceCaptureBaseUrl: 'http://192.0.2.55:4765/',
    })

    expect(index.schema).toBe('game-bot.r3f-pfx-red-team-review-batch-sheet-index.v1')
    expect(index.summary).toMatchObject({
      totalBatches: 20,
      totalEffects: 500,
      outputDirectory: '.context/red-team-review-batches',
      approvalStatus: 'non-approving-red-team-review-batch-sheet-index',
      bulkCommand: expect.stringContaining('--red-team-batch-sheet-directory .context/red-team-review-batches'),
      operatorLaunchUrl: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator',
      operatorLaunchUrlTemplate: 'http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}',
    })
    expect(index.sheets).toHaveLength(20)
    expect(index.sheets[0]).toMatchObject({
      batchId: 'red-team-review-batch-001',
      rankStart: 1,
      rankEnd: 25,
      effectCount: 25,
      firstEffectId: 'fireball',
      lastEffectId: 'level-up-flare',
      outputFile: '.context/red-team-review-batches/red-team-review-batch-001.json',
      markdownOutputFile: '.context/red-team-review-batches/red-team-review-batch-001.md',
      command: expect.stringContaining('--red-team-batch-id red-team-review-batch-001'),
    })
    expect(index.sheets[19]).toMatchObject({
      batchId: 'red-team-review-batch-020',
      rankStart: 476,
      rankEnd: 500,
      effectCount: 25,
      outputFile: '.context/red-team-review-batches/red-team-review-batch-020.json',
      markdownOutputFile: '.context/red-team-review-batches/red-team-review-batch-020.md',
    })

    const markdown = exportMarkdown(index)
    expect(markdown).toContain('# R3F PFX Red-Team Review Batch Sheet Index')
    expect(markdown).toContain('Treat this index as non-approving adversarial review guidance.')
    expect(markdown).toContain('Total batches: 20')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Output directory: `.context/red-team-review-batches`')
    expect(markdown).toContain('Operator launch page: `http://192.0.2.55:4765/__r3f-pfx-capture-operator`')
    expect(markdown).toContain(
      'Operator launch template: `http://192.0.2.55:4765/__r3f-pfx-capture-operator?profileDeviceLabel={profileDeviceLabel}`',
    )
    expect(markdown).toContain(`LAN handoff command: \`${CANONICAL_LAN_PRODUCTION_HANDOFF_COMMAND}\``)
    expect(markdown).toContain(
      `Tunnel/base URL handoff command: \`${CANONICAL_BASE_URL_PRODUCTION_HANDOFF_COMMAND}\``,
    )
    expect(markdown).toContain(
      '- `red-team-review-batch-001` (ranks 1-25, 25 effects, `fireball` to `level-up-flare`): `.context/red-team-review-batches/red-team-review-batch-001.md`',
    )
    expect(markdown).toContain('--red-team-batch-sheet-output .context/red-team-review-batches/red-team-review-batch-001.json')
  })

  it('exports a structured production implementation template covering every effect and implementation criterion', () => {
    const template = createPfxProductionImplementationTemplate()

    expect(template.schema).toBe('game-bot.r3f-pfx-production-implementation.v1')
    expect(template.summary).toEqual({
      totalEffects: 500,
      productionReadyEffects: 0,
      pendingEffects: 500,
      productionReadyScope: 'implementation-code-evidence-only',
      requiredCriteria: [
        'drop-in-r3f-component',
        'authored-render-recipe',
        'all-controls-safe',
        'mobile-budget-declared',
        'preview-asset-exported',
        'documentation-export-clean',
      ],
    })
    expect(template.implementations).toHaveLength(500)
    expect(template.implementations[0]).toMatchObject({
      effectId: 'fireball',
      status: 'pending',
      implementedBy: 'TODO:implementer',
      implementedAt: 'TODO:ISO-8601',
      sourcePath: 'tools/3d-pfx-library/src/index.tsx#fireball',
      criteria: {
        'drop-in-r3f-component': 'pending',
        'authored-render-recipe': 'pending',
        'all-controls-safe': 'pending',
        'mobile-budget-declared': 'pending',
        'preview-asset-exported': 'pending',
        'documentation-export-clean': 'pending',
      },
      blockerFindings: ['TODO:record implementation blockers or leave empty only after production-ready approval.'],
    })
  })

  it('exports production implementation review packets with explicit operator workflow instructions', () => {
    const template = createPfxProductionImplementationTemplate()
    const dossier = createPfxProductionImplementationDossier()
    const candidates = createPfxProductionImplementationCandidateReport()
    const fireballDossier = dossier.effects[0]

    expect(template.instructions).toMatchObject({
      dossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      completionCommand: CANONICAL_LOCAL_ACCEPTANCE_COMMAND,
    })
    expect(template.instructions.completionCommand).not.toContain('verify:evidence --')
    expect(template.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(template.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Open the matching dossier effect and candidate report entry before changing an implementation row.',
        'Mark every production implementation criterion pass/fail from concrete code, preview asset, docs, and budget evidence.',
        'Leave status pending or blocked unless all required criteria pass for this effect.',
      ]),
    )

    expect(dossier.instructions).toMatchObject({
      implementationTemplateFile: '.context/r3f-pfx-production-implementation-template.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      approvalStatus: 'non-approving-review-input',
    })
    expect(dossier.instructions.operatorChecklist).toContain(
      'Use this dossier as reviewer context only; production approval is recorded exclusively in .context/r3f-pfx-production-implementation.json.',
    )
    expect(fireballDossier.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Inspect the drop-in R3F component FireballPfx exported for fireball.',
        'Verify authored recipe fireball:authored-preview-v1 renders the Fireball effect with the declared controls.',
        'Confirm preview assets fireball.svg and fireball-clip.svg exist and match the effect.',
        'Write the final implementation decision to .context/r3f-pfx-production-implementation.json#fireball.',
      ]),
    )

    expect(candidates.instructions).toMatchObject({
      implementationTemplateFile: '.context/r3f-pfx-production-implementation-template.json',
      implementationDossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      approvalStatus: 'non-approving-code-prerequisite-report',
    })
    expect(candidates.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Treat ready-for-implementation-review as a code prerequisite signal, not production approval.',
        'Resolve any missing code prerequisites before asking a reviewer to approve production implementation.',
      ]),
    )
  })

  it('exports a reviewer-ready production implementation dossier without self-approving effects', () => {
    const dossier = createPfxProductionImplementationDossier()
    const fireball = dossier.effects[0]

    expect(dossier.schema).toBe('game-bot.r3f-pfx-production-implementation-dossier.v1')
    expect(dossier.summary).toEqual({
      totalEffects: 500,
      effectsNeedingProductionApproval: 500,
      requiredCriteria: [
        'drop-in-r3f-component',
        'authored-render-recipe',
        'all-controls-safe',
        'mobile-budget-declared',
        'preview-asset-exported',
        'documentation-export-clean',
      ],
    })
    expect(dossier.effects).toHaveLength(500)
    expect(fireball).toMatchObject({
      effectId: 'fireball',
      rank: 1,
      name: 'Fireball',
      approvalStatus: 'needs-review',
      sourcePath: 'tools/3d-pfx-library/src/index.tsx#fireball',
      reviewAnchor: '.context/r3f-pfx-production-implementation.json#fireball',
      component: {
        componentName: 'FireballPfx',
        importName: 'FireballPfx',
      },
      authoredRecipeId: 'fireball:authored-preview-v1',
      controlKeys: PFX_CONTROL_DEFINITIONS.map((definition) => definition.key),
      previewAssets: {
        thumbnailFileName: 'fireball.svg',
        clipFileName: 'fireball-clip.svg',
      },
      implementationFacts: {
        hasDropInComponent: true,
        hasAuthoredRecipe: true,
        hasPreviewAssets: true,
        hasMobileBudget: true,
        hasQualityScores: true,
      },
    })
    expect(fireball.mobileBudget).toMatchObject({
      performanceTier: PFX_PRESETS[0].performance.tier,
      mobileSafety: PFX_PRESETS[0].mobileSafety,
      maxParticles: PFX_PRESETS[0].performance.maxParticles,
    })
    expect(fireball.qualityScores.gameReadiness).toBeGreaterThan(0)
    expect(fireball.marketSourceUrls).toEqual(PFX_TAXONOMY[0].marketSourceUrls)
    expect(fireball.productionReady).toBe(false)
  })

  it('exports a reviewer-readable Markdown handoff for the production implementation dossier', () => {
    const exportMarkdown = (PfxLibrary as Record<string, unknown>).exportPfxProductionImplementationDossierMarkdown
    expect(exportMarkdown).toBeTypeOf('function')
    if (typeof exportMarkdown !== 'function') return

    const markdown = exportMarkdown()

    expect(markdown).toContain('# R3F PFX Production Implementation Dossier')
    expect(markdown).toContain('Treat this handoff as non-approving implementation review input.')
    expect(markdown).toContain('Total effects: 500')
    expect(markdown).toContain('Effects needing production approval: 500')
    expect(markdown).toContain('Implementation template: `.context/r3f-pfx-production-implementation-template.json`')
    expect(markdown).toContain('Candidate report: `.context/r3f-pfx-production-implementation-candidates.json`')
    expect(markdown).toContain('## Fireball (`fireball`)')
    expect(markdown).toContain('Review anchor: `.context/r3f-pfx-production-implementation.json#fireball`')
    expect(markdown).toContain('Source path: `tools/3d-pfx-library/src/index.tsx#fireball`')
    expect(markdown).toContain('Component: `FireballPfx`')
    expect(markdown).toContain('Authored recipe: `fireball:authored-preview-v1`')
    expect(markdown).toContain('Preview assets: `fireball.svg`, `fireball-clip.svg`')
    expect(markdown).toContain('### Mobile Budget')
    expect(markdown).toContain('### Quality Scores')
    expect(markdown).toContain('### Operator Checklist')
  })

  it('exports a non-approving production implementation candidate report with code-level prerequisites', () => {
    const report = createPfxProductionImplementationCandidateReport()

    expect(report.schema).toBe('game-bot.r3f-pfx-production-implementation-candidates.v1')
    expect(report.summary).toMatchObject({
      totalEffects: 500,
      readyForImplementationReview: 500,
      effectsWithMissingCodePrerequisites: 0,
      productionApprovedEffects: 0,
    })
    expect(report.summary.requiredPrerequisites).toEqual([
      'drop-in-r3f-component',
      'authored-render-recipe',
      'all-controls-safe',
      'mobile-budget-declared',
      'preview-asset-exported',
      'documentation-export-clean',
      'render-plan-depth',
    ])
    expect(report.effects[0]).toMatchObject({
      effectId: 'fireball',
      status: 'ready-for-implementation-review',
      productionApproved: false,
      missingPrerequisites: [],
      reviewAnchor: '.context/r3f-pfx-production-implementation.json#fireball',
      implementationEvidence: expect.arrayContaining([
        'component:FireballPfx',
        'authored-recipe:fireball:authored-preview-v1',
        'docs:.context/r3f-pfx-developer-docs.json#fireball',
      ]),
      codeFacts: {
        hasDropInComponent: true,
        hasAuthoredRecipe: true,
        controlsValidate: true,
        hasMobileBudget: true,
        hasPreviewAssets: true,
        hasDeveloperDocs: true,
        hasRenderPlanDepth: true,
      },
    })
  })

  it('exports a code-derived production implementation manifest for every ready candidate', () => {
    const manifest = createPfxProductionImplementationManifestFromCandidates({
      implementedBy: 'game-bot-code-audit',
      implementedAt: '2026-07-03T12:00:00.000Z',
    })

    expect(manifest.schema).toBe('game-bot.r3f-pfx-production-implementation.v1')
    expect(manifest.summary).toEqual({
      totalEffects: 500,
      productionReadyEffects: 500,
      productionReadyScope: 'implementation-code-evidence-only',
      pendingEffects: 0,
      requiredCriteria: [
        'drop-in-r3f-component',
        'authored-render-recipe',
        'all-controls-safe',
        'mobile-budget-declared',
        'preview-asset-exported',
        'documentation-export-clean',
      ],
    })
    expect(manifest.instructions).toMatchObject({
      approvalStatus: 'non-final-implementation-evidence',
      dossierFile: '.context/r3f-pfx-production-implementation-dossier.json',
      candidateReportFile: '.context/r3f-pfx-production-implementation-candidates.json',
      completionCommand: CANONICAL_LOCAL_ACCEPTANCE_COMMAND,
    })
    expect(manifest.instructions.completionCommand).not.toContain('verify:evidence --')
    expect(manifest.instructions.completionCommand).not.toContain('--final-acceptance')
    expect(manifest.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'This manifest is code-derived implementation evidence; it does not satisfy taxonomy review, real-device profiling, red-team signoff, or final production approval.',
        'Every production-ready row must correspond to a ready-for-implementation-review candidate with no missing code prerequisites.',
      ]),
    )
    expect(manifest.implementations).toHaveLength(500)

    const forceField = manifest.implementations.find((implementation) => implementation.effectId === 'force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      status: 'production-ready',
      implementedBy: 'game-bot-code-audit',
      implementedAt: '2026-07-03T12:00:00.000Z',
      sourcePath: 'tools/3d-pfx-library/src/index.tsx#force-field',
      blockerFindings: [],
      notes:
        'Code-derived production implementation evidence for Force Field: component, authored recipe, safe controls, mobile budget, preview assets, docs, and render-plan depth are present.',
    })
    expect(forceField?.criteria).toEqual({
      'drop-in-r3f-component': 'pass',
      'authored-render-recipe': 'pass',
      'all-controls-safe': 'pass',
      'mobile-budget-declared': 'pass',
      'preview-asset-exported': 'pass',
      'documentation-export-clean': 'pass',
    })

    const readiness = createPfxProductionReadinessReport({
      implementations: manifest.implementations,
    })
    expect(readiness.summary).toMatchObject({
      productionImplementedEffects: 500,
      productionReadyEffects: 0,
      effectsRequiringDecision: 500,
      realDeviceProfiledEffects: 0,
      redTeamSignedOffEffects: 0,
    })
    expect(readiness.blockingFindings).not.toContain('500 effects lack production implementation or approved deferral')
    expect(readiness.blockingFindings).toEqual(
      expect.arrayContaining([
        '500 effects lack mobile Safari and Chrome Android profiling evidence',
        '500 effects lack red-team sign-off',
      ]),
    )
  })

  it('filters by search text, style, use case, tier, loop mode, world space, and mobile safety', () => {
    expect(filterPfxCatalog({ query: 'force field' }).map((item) => item.effect.id)).toContain(
      'force-field',
    )
    expect(filterPfxCatalog({ query: 'fireball' }).map((item) => item.effect.id)).toContain('fireball')
    expect(filterPfxCatalog({ query: 'cozy pickup sparkle' }).map((item) => item.effect.id)).toContain(
      'coin-pickup-sparkle',
    )
    const mobileSafeHitImpact = filterPfxCatalog({ query: 'mobile-safe hit impact' })
    expect(mobileSafeHitImpact.length).toBeGreaterThan(0)
    expect(mobileSafeHitImpact.every((item) => item.effect.mobileSafety === 'safe')).toBe(true)
    expect(mobileSafeHitImpact.map((item) => item.effect.id)).toEqual(expect.arrayContaining(['hit-spark']))
    expect(
      filterPfxCatalog({
        style: ['cozy'],
        gameplayUseCase: ['reward'],
        performanceTier: ['low'],
        loopMode: ['burst'],
        space: ['ui'],
        mobileSafeOnly: true,
      }).length,
    ).toBeGreaterThan(0)
    expect(filterPfxCatalog({ coverage: ['authored-preview'] })).toHaveLength(500)
    expect(filterPfxCatalog({ coverage: ['profile-backed'] }).length).toBe(0)
  })

  it('creates typed presets and clean R3F integration snippets', () => {
    const preset = createPfxPreset('fireball', {
      seed: 42,
      color: ['#ff7a18', '#ffd166'],
      density: 0.65,
      scale: 1.4,
    })

    expect(preset.effectId).toBe('fireball')
    expect(preset.seed).toBe(42)
    expect(preset.controls.color).toEqual(['#ff7a18', '#ffd166'])
    expect(preset.controls.density).toBe(0.65)
    expect(preset.controls.scale).toBe(1.4)

    const snippet = exportPfxComponentSnippet(preset, {
      componentName: 'FireballPfx',
      importPath: '@/tools/3d-pfx-library',
    })

    expect(snippet).toContain('import { createGamePfxComponent }')
    expect(snippet).toContain('export function FireballPfx')
    expect(snippet).toContain('createGamePfxComponent("fireball"')
    expect(snippet).toContain('"seed": 42')
    expect(snippet).not.toContain('const preset: PfxPreset')
    expect(snippet).not.toMatch(/Scrabble|Pokemon|Mario|Zelda|Fortnite/i)

    const json = exportPfxPresetJson(preset)
    expect(JSON.parse(json)).toMatchObject({
      schema: 'game-bot.r3f-pfx-preset.v1',
      effectId: 'fireball',
      seed: 42,
      quality: {
        scores: {
          gameReadiness: expect.any(Number),
        },
      },
      controls: {
        density: 0.65,
        scale: 1.4,
      },
    })
  })

  it('exports per-effect developer documentation with copy-paste integration and production caveats', () => {
    const preset = createPfxPreset('force-field', {
      seed: 42,
      density: 0.4,
    })
    const markdown = exportPfxDeveloperDocsMarkdown(preset, {
      importPath: '@/tools/3d-pfx-library',
    })

    expect(markdown).toContain('# Force Field')
    expect(markdown).toContain('```tsx')
    expect(markdown).toContain('createGamePfxComponent("force-field"')
    expect(markdown).toContain('```json')
    expect(markdown).toContain('Performance budget')
    expect(markdown).toContain('Quality rubric')
    expect(markdown).toContain('Production caveat')
    expect(markdown).toContain('authored-preview')
    expect(markdown).not.toMatch(/Scrabble|Pokemon|Mario|Zelda|Fortnite/i)

    const manifest = createPfxDeveloperDocsManifest(PFX_PRESETS)
    expect(manifest.schema).toBe('game-bot.r3f-pfx-developer-docs.v1')
    expect(manifest.summary).toMatchObject({
      totalEffects: 500,
      docsWithComponentSnippet: 500,
      docsWithJsonPreset: 500,
      docsWithPerformanceBudget: 500,
      docsWithProductionCaveat: 500,
    })
    expect(manifest.effects[0]).toMatchObject({
      effectId: 'fireball',
      componentName: 'FireballPfx',
      documentationFileName: 'fireball.md',
      integrationChecklist: expect.arrayContaining([
        'Paste the generated component snippet into a React Three Fiber module.',
        'Pass a stable position/rotation from gameplay state instead of mutating the effect imperatively.',
      ]),
      productionCaveat: expect.stringContaining('authored-preview'),
      markdown: expect.stringContaining('# Fireball'),
    })

    const parsed = JSON.parse(exportPfxDeveloperDocsManifestJson(manifest))
    expect(parsed.summary.totalEffects).toBe(500)
  })

  it('exports an all-effect export cleanliness audit for snippets, JSON presets, and docs', () => {
    const audit = createPfxExportCleanlinessAudit()
    const fireball = audit.effects[0]

    expect(audit.schema).toBe('game-bot.r3f-pfx-export-cleanliness-audit.v1')
    expect(audit.summary).toEqual({
      totalEffects: 500,
      componentSnippetsValid: 500,
      jsonPresetsValid: 500,
      docsValid: 500,
      registryEntriesValid: 500,
      effectsPassingExportAudit: 500,
    })
    expect(audit.instructions).toMatchObject({
      approvalStatus: 'non-approving-export-cleanliness-evidence',
      developerDocsFile: '.context/r3f-pfx-developer-docs.json',
    })
    expect(audit.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Use this audit to verify copy-paste component snippets, JSON presets, docs, and registry entries before production implementation approval.',
        'Treat passing export cleanliness as integration evidence, not final production implementation approval.',
      ]),
    )
    expect(fireball).toMatchObject({
      effectId: 'fireball',
      safe: true,
      componentName: 'FireballPfx',
      componentSnippetValid: true,
      jsonPresetValid: true,
      docsValid: true,
      registryEntryValid: true,
      forbiddenTermsAbsent: true,
      failureReasons: [],
    })
    expect(fireball.componentSnippetEvidence).toEqual(
      expect.arrayContaining([
        'imports createGamePfxComponent',
        'exports named R3F component',
        'uses canonical effect id',
      ]),
    )
    expect(fireball.jsonPresetEvidence).toEqual(
      expect.arrayContaining([
        'parses as JSON',
        'uses game-bot.r3f-pfx-preset.v1 schema',
        'validates preset controls and budgets',
      ]),
    )
  })

  it('exports a typed drop-in component registry for every catalog effect', () => {
    expect(PFX_COMPONENT_DEFINITIONS).toHaveLength(500)
    expect(new Set(PFX_COMPONENT_DEFINITIONS.map((definition) => definition.effectId)).size).toBe(500)
    expect(new Set(PFX_COMPONENT_DEFINITIONS.map((definition) => definition.componentName)).size).toBe(500)
    expect(PFX_COMPONENT_DEFINITIONS[0]).toMatchObject({
      effectId: 'fireball',
      componentName: 'FireballPfx',
      acceptanceStatus: 'authored-preview',
      mobileSafety: expect.any(String),
    })

    const forceField = getPfxComponentDefinition('force-field')
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      componentName: 'ForceFieldPfx',
      importName: 'ForceFieldPfx',
    })
    expect(getPfxComponentDefinition('missing-effect')).toBeUndefined()

    const ForceFieldPfx = createGamePfxComponent('force-field', { density: 0.4 })
    expect(ForceFieldPfx.displayName).toBe('ForceFieldPfx')
    expect(PFX_COMPONENTS['force-field'].displayName).toBe('ForceFieldPfx')
    expect(Object.keys(PFX_COMPONENTS)).toHaveLength(500)
  })

  it('recomputes performance metadata when browser-exported controls change', () => {
    const base = createPfxPreset('force-field')
    const tuned = createPfxPreset('force-field', {
      density: 1,
      lod: ['low'],
      flipbook: 'magic-12',
    })

    expect(tuned.performance.maxParticles).not.toBe(base.performance.maxParticles)
    expect(tuned.performance.textureMemoryKb).toBeGreaterThan(base.performance.textureMemoryKb)
    expect(tuned.performance.evidence).toContain('density 1')
    expect(JSON.parse(exportPfxPresetJson(tuned)).performance.maxParticles).toBe(tuned.performance.maxParticles)
  })

  it('derives a reduced-motion preset with lower motion intensity and recomputed budgets', () => {
    const base = createPfxPreset('force-field', {
      density: 1,
      velocity: 1.4,
      turbulence: 1.2,
      trailLength: 0.9,
      emissiveBloom: 0.8,
      flipbook: 'magic-12',
      lod: ['high'],
    })
    const reduced = createReducedMotionPfxPreset(base)

    expect(reduced.id).toBe(`${base.id}-reduced-motion`)
    expect(reduced.effectId).toBe(base.effectId)
    expect(reduced.controls.density).toBeLessThan(base.controls.density)
    expect(reduced.controls.velocity).toBeLessThan(base.controls.velocity)
    expect(reduced.controls.turbulence).toBeLessThan(base.controls.turbulence)
    expect(reduced.controls.trailLength).toBeLessThan(base.controls.trailLength)
    expect(reduced.controls.emissiveBloom).toBeLessThanOrEqual(base.controls.emissiveBloom)
    expect(reduced.controls.flipbook).toBe('none')
    expect(reduced.controls.lod).toEqual(['low'])
    expect(reduced.performance.maxParticles).toBeLessThan(base.performance.maxParticles)
    expect(reduced.performance.evidence).toContain('reduced motion')
    expect(exportPfxPresetJson(reduced)).toContain('"reducedMotion": true')
  })

  it('assigns every procedural particle texture to a deterministic atlas slice for mobile batching', () => {
    expect(PFX_TEXTURE_KINDS).toEqual(['soft-disc', 'spark', 'streak', 'ring', 'square', 'bubble'])
    expect(PFX_TEXTURE_ATLAS.tileSize).toBe(32)
    expect(PFX_TEXTURE_ATLAS.width).toBe(PFX_TEXTURE_ATLAS.columns * PFX_TEXTURE_ATLAS.tileSize)
    expect(PFX_TEXTURE_ATLAS.height).toBe(PFX_TEXTURE_ATLAS.rows * PFX_TEXTURE_ATLAS.tileSize)

    const slices = PFX_TEXTURE_KINDS.map((kind) => getPfxTextureAtlasSlice(kind))
    expect(new Set(slices.map((slice) => `${slice.pixelRect.x},${slice.pixelRect.y}`)).size).toBe(PFX_TEXTURE_KINDS.length)
    for (const slice of slices) {
      expect(slice.atlasId).toBe(PFX_TEXTURE_ATLAS.id)
      expect(slice.uvOffset[0]).toBeGreaterThanOrEqual(0)
      expect(slice.uvOffset[1]).toBeGreaterThanOrEqual(0)
      expect(slice.uvScale).toEqual([1 / PFX_TEXTURE_ATLAS.columns, 1 / PFX_TEXTURE_ATLAS.rows])
      expect(slice.pixelRect.width).toBe(PFX_TEXTURE_ATLAS.tileSize)
      expect(slice.pixelRect.height).toBe(PFX_TEXTURE_ATLAS.tileSize)
    }

    const base = createPfxPreset('force-field')
    const pixel = createPfxPreset('force-field', { style: 'pixel-retro' })
    expect(base.textureAtlas).toEqual(getPfxTextureAtlasSlice(base.controls.texture))
    expect(pixel.controls.texture).toBe('square')
    expect(pixel.textureAtlas.kind).toBe('square')
    expect(JSON.parse(exportPfxPresetJson(pixel)).textureAtlas.kind).toBe('square')
  })

  it('reuses runtime particle textures and geometry buffers across repeated effect instances', () => {
    clearPfxRuntimeResourceCache()
    const first = createPfxPreset('force-field', { seed: 101, density: 0.7, lod: ['medium'] })
    const matching = createPfxPreset('force-field', { seed: 101, density: 0.7, lod: ['medium'] })
    const differentSeed = createPfxPreset('force-field', { seed: 202, density: 0.7, lod: ['medium'] })
    const ringSlice = getPfxTextureAtlasSlice('ring')
    const sparkSlice = getPfxTextureAtlasSlice('spark')
    const ringTexture = getPfxSharedParticleTexture('ring')
    const sparkTexture = getPfxSharedParticleTexture('spark')

    expect(ringTexture).toBe(getPfxSharedParticleTexture('ring'))
    expect(ringTexture).not.toBe(sparkTexture)
    expect(ringTexture.image).toBe(sparkTexture.image)
    expect(ringTexture.userData).toMatchObject({
      atlasId: PFX_TEXTURE_ATLAS.id,
      atlasKind: 'ring',
    })
    expect(sparkTexture.userData).toMatchObject({
      atlasId: PFX_TEXTURE_ATLAS.id,
      atlasKind: 'spark',
    })
    const halfTexel = [0.5 / PFX_TEXTURE_ATLAS.width, 0.5 / PFX_TEXTURE_ATLAS.height] as const
    const insetOffset = (slice: typeof ringSlice) => [
      slice.uvOffset[0] + halfTexel[0],
      slice.uvOffset[1] + halfTexel[1],
    ]
    const insetScale = (slice: typeof ringSlice) => [
      slice.uvScale[0] - halfTexel[0] * 2,
      slice.uvScale[1] - halfTexel[1] * 2,
    ]
    expect([ringTexture.offset.x, ringTexture.offset.y]).toEqual(insetOffset(ringSlice))
    expect([ringTexture.repeat.x, ringTexture.repeat.y]).toEqual(insetScale(ringSlice))
    expect([sparkTexture.offset.x, sparkTexture.offset.y]).toEqual(insetOffset(sparkSlice))
    expect([sparkTexture.repeat.x, sparkTexture.repeat.y]).toEqual(insetScale(sparkSlice))
    expect(ringTexture.userData['atlasUvInset']).toEqual(halfTexel)
    expect(getPfxSharedGeometry(first)).toBe(getPfxSharedGeometry(matching))
    expect(getPfxSharedGeometry(first)).not.toBe(getPfxSharedGeometry(differentSeed))
    expect(getPfxRuntimeResourceCacheStats()).toMatchObject({
      textures: 2,
      geometries: 2,
    })

    clearPfxRuntimeResourceCache()
    expect(getPfxRuntimeResourceCacheStats()).toEqual({ textures: 0, geometries: 0 })
  })

  it('exports a runtime optimization audit for mobile-safe rendering hooks', () => {
    const audit = createPfxRuntimeOptimizationAudit()
    const forceField = audit.effects.find((effect) => effect.effectId === 'force-field')

    expect(audit.schema).toBe('game-bot.r3f-pfx-runtime-optimization-audit.v1')
    expect(audit.summary).toEqual({
      totalEffects: 500,
      atlasBackedEffects: 500,
      sharedTextureEffects: 500,
      sharedGeometryEffects: 500,
      reducedMotionEffects: 500,
      lodBackedEffects: 500,
      deterministicSeedEffects: 500,
      effectsPassingOptimizationAudit: 500,
    })
    expect(audit.instructions).toMatchObject({
      approvalStatus: 'non-approving-mobile-runtime-optimization-evidence',
      runtimePolicyFile: '.context/r3f-pfx-mobile-runtime-policy.json',
    })
    expect(audit.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Use this audit to verify mobile runtime optimization hooks before production implementation approval.',
        'Treat optimization coverage as local runtime evidence, not real-device performance proof.',
      ]),
    )
    expect(audit.policy).toMatchObject({
      maxDevicePixelRatio: 1.5,
      finalAcceptanceRequiresRealDevices: true,
    })
    expect(forceField).toMatchObject({
      effectId: 'force-field',
      safe: true,
      textureAtlasKind: createPfxPreset('force-field').controls.texture,
      atlasBacked: true,
      sharedTextureBacked: true,
      sharedGeometryBacked: true,
      reducedMotionBacked: true,
      lodBacked: true,
      deterministicSeed: true,
      tierConcurrencyCap: PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps.low,
      failureReasons: [],
    })
  })

  it('defines browser-editable controls for the full exported preset control surface', () => {
    expect(PFX_CONTROL_DEFINITIONS.map((control) => control.key)).toEqual([
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
    ])

    for (const control of PFX_CONTROL_DEFINITIONS) {
      expect(control.label.length).toBeGreaterThan(2)
      expect(control.kind).toMatch(/color-list|select|multi-select|range|number/)
    }
  })

  it('exports per-effect control safety evidence for the full customization surface', () => {
    const matrix = createPfxControlSafetyMatrix()
    const fireball = matrix.effects[0]

    expect(matrix.schema).toBe('game-bot.r3f-pfx-control-safety-matrix.v1')
    expect(matrix.summary).toEqual({
      totalEffects: 500,
      controlCount: PFX_CONTROL_DEFINITIONS.length,
      effectsPassingControlSafety: 500,
      controlsWithBudgetImpact: expect.any(Number),
      controlsWithRenderImpact: expect.any(Number),
    })
    expect(matrix.summary.controlsWithBudgetImpact).toBeGreaterThanOrEqual(8)
    expect(matrix.summary.controlsWithRenderImpact).toBeGreaterThanOrEqual(10)
    expect(matrix.controls.map((control) => control.key)).toEqual(PFX_CONTROL_DEFINITIONS.map((control) => control.key))
    expect(matrix.instructions).toMatchObject({
      approvalStatus: 'non-approving-customization-safety-evidence',
      browserSurface: 'tools/3d-pfx-library/viewer',
    })
    expect(matrix.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Use this matrix to verify browser customization ranges before production implementation approval.',
        'Treat passing min/default/max variants as safety evidence, not final art-direction approval.',
      ]),
    )

    expect(fireball).toMatchObject({
      effectId: 'fireball',
      safe: true,
      controlCount: PFX_CONTROL_DEFINITIONS.length,
      defaultPresetValid: true,
    })
    expect(fireball.controls.find((control) => control.key === 'density')).toMatchObject({
      bounded: true,
      defaultWithinBounds: true,
      minVariantValid: true,
      maxVariantValid: true,
      affectsBudget: true,
      affectsRenderSignature: true,
    })
    expect(fireball.controls.find((control) => control.key === 'color')).toMatchObject({
      bounded: true,
      defaultWithinBounds: true,
      minVariantValid: true,
      maxVariantValid: true,
      affectsBudget: false,
      affectsRenderSignature: true,
    })
    expect(fireball.controls.find((control) => control.key === 'seed')).toMatchObject({
      bounded: true,
      defaultWithinBounds: true,
      minVariantValid: true,
      maxVariantValid: true,
      affectsBudget: false,
      affectsRenderSignature: false,
    })
    expect(fireball.failureReasons).toEqual([])
  })

  it('makes style variants materially different instead of metadata-only filters', () => {
    const defaultFireball = createPfxPreset('fireball')
    const cozy = createPfxPreset('force-field', { style: 'cozy' })
    const horror = createPfxPreset('force-field', { style: 'horror' })
    const pixel = createPfxPreset('force-field', { style: 'pixel-retro' })

    expect(defaultFireball.controls.color.slice(0, 2)).toEqual(['#ff7a18', '#ffd166'])
    expect(cozy.controls.style).toBe('cozy')
    expect(horror.controls.style).toBe('horror')
    expect(pixel.controls.style).toBe('pixel-retro')
    expect(cozy.controls.color).not.toEqual(horror.controls.color)
    expect(cozy.controls.texture).not.toBe(horror.controls.texture)
    expect(pixel.controls.texture).toBe('square')
    expect(cozy.preview.thumbnail.css).not.toBe(horror.preview.thumbnail.css)
    expect(exportPfxPresetJson(horror)).toContain('"style": "horror"')
  })

  it('exports per-effect style differentiation evidence beyond palette swaps', () => {
    const matrix = createPfxStyleDifferentiationMatrix()
    const forceField = matrix.effects.find((effect) => effect.effectId === 'force-field')

    expect(matrix.schema).toBe('game-bot.r3f-pfx-style-differentiation-matrix.v1')
    expect(matrix.summary).toEqual({
      totalEffects: 500,
      styleCount: ART_STYLE_CLUSTERS.length,
      effectsPassingStyleDifferentiation: 500,
      minimumDistinctNonColorSignatures: ART_STYLE_CLUSTERS.length,
    })
    expect(matrix.instructions).toMatchObject({
      approvalStatus: 'non-approving-style-differentiation-evidence',
      browserSurface: 'tools/3d-pfx-library/viewer',
    })
    expect(matrix.instructions.operatorChecklist).toEqual(
      expect.arrayContaining([
        'Use this matrix to verify style variants change render treatment beyond palette swaps.',
        'Treat distinct non-color signatures as implementation evidence, not final art-direction approval.',
      ]),
    )
    expect(matrix.styles.map((style) => style.style)).toEqual(ART_STYLE_CLUSTERS)
    expect(new Set(matrix.styles.map((style) => style.nonColorSignature)).size).toBe(ART_STYLE_CLUSTERS.length)

    expect(forceField).toMatchObject({
      effectId: 'force-field',
      safe: true,
      styleCount: ART_STYLE_CLUSTERS.length,
      distinctNonColorSignatures: ART_STYLE_CLUSTERS.length,
      failureReasons: [],
    })
    expect(forceField?.variants.find((variant) => variant.style === 'pixel-retro')).toMatchObject({
      style: 'pixel-retro',
      texture: 'square',
      particleShape: 'square',
      silhouette: 'blocky-pixel',
      materialTreatment: 'crisp-indexed',
      motionTreatment: 'stepped-flicker',
    })
    expect(forceField?.variants.find((variant) => variant.style === 'sci-fi')).toMatchObject({
      style: 'sci-fi',
      particleShape: 'ring',
      silhouette: 'precision-rings',
      materialTreatment: 'holographic-add',
    })
  })

  it('builds distinct render plans for core production PFX profiles instead of one generic point cloud', () => {
    const fireball = getPfxRenderPlan(createPfxPreset('fireball'))
    const forceField = getPfxRenderPlan(createPfxPreset('force-field'))
    const slashTrail = getPfxRenderPlan(createPfxPreset('slash-trail'))
    const lootBeam = getPfxRenderPlan(createPfxPreset('loot-beam'))
    const smoke = getPfxRenderPlan(createPfxPreset('smoke-puff'))

    expect(fireball.surfaces.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['particles', 'projectile-comet']),
    )
    // The trail is a swept particle layer, not a rigid gradient quad.
    expect(fireball.surfaces.some((surface) => surface.phase === 'flame-trail' && surface.tuning?.motion === 'trail-stream')).toBe(true)
    expect(forceField.surfaces.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['particles', 'shield-shell']),
    )
    expect(slashTrail.surfaces.map((surface) => surface.kind)).toEqual(['trail-ribbon', 'impact-sparks'])
    const slashContactTick = slashTrail.surfaces.find((surface) => surface.phase === 'edge-contact-tick')!
    expect(slashContactTick.tuning?.delay).toBeGreaterThanOrEqual(0.22)
    expect(slashContactTick.tuning?.window).toBeLessThanOrEqual(0.05)
    expect(slashContactTick.tuning?.lifeScale).toBeLessThanOrEqual(0.15)
    expect(slashContactTick.tuning?.countScale).toBeLessThanOrEqual(0.2)
    expect(slashContactTick.tuning?.spawnScale).toBeLessThanOrEqual(0.1)
    expect(slashContactTick.tuning?.bands).toBe(2)
    expect(Math.max(...slashContactTick.tuning!.size!)).toBeLessThanOrEqual(0.2)
    expect(slashContactTick.tuning?.positionOffset).toEqual([-0.95, 0, 0.05])
    // Structural shader surfaces: shield sphere, slash crescent.
    expect(forceField.surfaces.some((surface) => surface.tuning?.meshShader === 'force-field-shell')).toBe(true)
    expect(slashTrail.surfaces.some((surface) => surface.tuning?.meshShader === 'arc-sweep')).toBe(true)
    expect(lootBeam.surfaces.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['beam-column', 'reward-gem', 'ring-field']),
    )
    expect(smoke.surfaces.map((surface) => surface.kind)).toEqual(['particles', 'particles', 'particles'])

    expect(new Set([fireball.signature, forceField.signature, slashTrail.signature, lootBeam.signature, smoke.signature]).size).toBe(5)
    expect(fireball.estimatedDrawCalls).toBeGreaterThan(1)
    expect(forceField.estimatedDrawCalls).toBeGreaterThan(1)
  })

  it('keeps slash-trail erosion out of the readable strike and confines it to recovery', () => {
    expect(PfxLibrary.createPfxArcSweepErosionStrength(0.02)).toBe(0)
    expect(PfxLibrary.createPfxArcSweepErosionStrength(0.1)).toBe(0)
    expect(PfxLibrary.createPfxArcSweepErosionStrength(0.3)).toBeGreaterThan(0.4)
    expect(PfxLibrary.createPfxArcSweepErosionStrength(0.3)).toBeLessThan(0.7)
    expect(PfxLibrary.createPfxArcSweepErosionStrength(0.42)).toBe(1)
    const onset = PfxLibrary.createPfxArcSweepWindow(0.088)
    const peak = PfxLibrary.createPfxArcSweepWindow(0.177)
    const decay = PfxLibrary.createPfxArcSweepWindow(0.441)
    expect(onset.lead).toBeGreaterThan(0.15)
    expect(onset.lead).toBeLessThan(0.3)
    expect(onset.erode).toBe(0)
    expect(peak.lead).toBeGreaterThan(0.6)
    expect(peak.lead).toBeLessThan(0.75)
    expect(peak.erode).toBe(0)
    expect(decay.lead).toBe(1)
    expect(decay.erode).toBeGreaterThan(0.4)
    expect(decay.erode).toBeLessThan(0.6)
    expect(decay.visibleSpan).toBeGreaterThan(0.4)
    const hotEdge = PfxLibrary.createPfxMeshShaderHotColor('arc-sweep', '#4da6ff')
    expect(hotEdge.getHexString()).toBe('ffe0a3')
    expect(hotEdge.r).toBeGreaterThan(hotEdge.g)
    expect(hotEdge.g).toBeGreaterThan(hotEdge.b)
    const geometry = PfxLibrary.createPfxSlashArcGeometry()
    geometry.computeBoundingBox()
    expect(geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeGreaterThan(1.2)
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeGreaterThan(1)
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeGreaterThan(0.18)
    expect(geometry.userData['pfxSlashArcGeometry']).toBe('beveled-extruded-crescent')
    geometry.dispose()
  })

  it('gives the first benchmark batch semantic 3D anchors instead of generic cloud, star, and beam grammar', () => {
    const surfacesOf = (effectId: string) => getPfxRenderPlan(createPfxPreset(effectId)).surfaces
    const kindsOf = (effectId: string) => surfacesOf(effectId).map((surface) => surface.kind)

    expect(kindsOf('fireball')).toContain('projectile-comet')
    expect(surfacesOf('fireball').find((surface) => surface.kind === 'projectile-comet')?.tuning?.meshMotion).toBe('travel')
    expect(kindsOf('smoke-puff')).not.toContain('smoke-billows')
    expect(surfacesOf('smoke-puff')).toHaveLength(3)
    expect(surfacesOf('smoke-puff').find((surface) => surface.phase === 'puff-bloom')?.tuning).toMatchObject({
      spawnScale: expect.any(Number),
      speedScale: expect.any(Number),
    })
    expect(surfacesOf('smoke-puff').find((surface) => surface.phase === 'puff-bloom')!.tuning!.spawnScale).toBeLessThan(1)
    expect(surfacesOf('smoke-puff').find((surface) => surface.phase === 'puff-bloom')!.tuning!.speedScale).toBeLessThan(2)
    expect(kindsOf('muzzle-flash')).toContain('muzzle-cone')
    expect(surfacesOf('muzzle-flash').find((surface) => surface.phase === 'directional-flame-cone')?.tuning?.meshMotion).toBe('flash')
    // Finale-group pass: the loot beam wears the beam group's dissolve
    // treatment (water-flow rivulets + erosion) tinted gold.
    expect(surfacesOf('loot-beam').find((surface) => surface.kind === 'beam-column')?.tuning).toMatchObject({
      widthScale: expect.any(Number),
      meshShader: 'water-flow',
    })
    expect(surfacesOf('loot-beam').find((surface) => surface.kind === 'beam-column')!.tuning!.widthScale).toBeGreaterThanOrEqual(3)

    expect(kindsOf('poison-cloud')).toContain('toxic-pool')
    expect(kindsOf('poison-cloud')).not.toContain('bubble-shells')
    expect(surfacesOf('poison-cloud').find((surface) => surface.kind === 'toxic-pool')?.tuning?.meshShader).toBe('toxic-pool')
    // Element doctrine: ONE dissolve language — the fresnel-shell break
    // (noise-front erosion), not voxel confetti.
    expect(kindsOf('dissolve')).toContain('shield-shell')
    // Element pass: snow is a grounded powder wake plus a lateral flake field,
    // with both layers distributed through depth instead of a billboard wall.
    expect(kindsOf('snow-gust')).not.toContain('cloud-volume')
    expect(kindsOf('snow-gust')).toEqual(['particles', 'particles', 'particles'])
    expect(kindsOf('enemy-death-poof')).toContain('shield-fragments')

    expect(kindsOf('ui-reward-burst')).toContain('reward-gem')
    expect(surfacesOf('ui-reward-burst').find((surface) => surface.kind === 'reward-gem')!.scale).toBeGreaterThanOrEqual(1)
    expect(kindsOf('coin-pickup-sparkle')).toContain('coin-medallion')
    // Level-up rebuild (user round): gather -> pillar -> payout rain; the
    // floating chevrons were cut as nonsense.
    expect(kindsOf('level-up-flare')).toContain('beam-column')
    expect(kindsOf('underwater-bubbles')).toContain('bubble-shells')

    const lowHealth = surfacesOf('low-health-screen-particles')
    expect(lowHealth.find((surface) => surface.kind === 'screen-plane')).toMatchObject({
      scale: 1,
      tuning: { screenShader: 'danger-vignette' },
    })
    expect(lowHealth.find((surface) => surface.kind === 'particles')?.tuning?.motion).toBe('danger-pulse')
    // Clip-space screen effects use a normalized perimeter. World-space
    // magnification here would pull flecks into the gameplay interior.
    expect(lowHealth.find((surface) => surface.kind === 'particles')?.tuning?.spawnScale).toBe(1)

    // Mirror of the certified fireball (user-directed), blue palette.
    expect(kindsOf('projectile-trail')).toContain('projectile-comet')
    expect(surfacesOf('projectile-trail').find((surface) => surface.kind === 'projectile-comet')?.tuning?.meshShader).toBe('fire-body')
    expect(surfacesOf('projectile-trail').find((surface) => surface.kind === 'projectile-comet')?.tuning?.spinScale).toBeGreaterThan(0)
    expect(surfacesOf('projectile-trail').find((surface) => surface.phase === 'projectile-trail-plasma-wake')).toMatchObject({
      kind: 'tapered-trail',
      tuning: { meshShader: 'projectile-wake' },
    })

    expect(surfacesOf('snow-gust').find((surface) => surface.phase === 'snow-drift')?.tuning).toMatchObject({
      countScale: expect.any(Number),
      depthScale: expect.any(Number),
    })
    expect(surfacesOf('snow-gust').find((surface) => surface.phase === 'snow-drift')!.tuning!.countScale).toBeGreaterThanOrEqual(1)
    expect(surfacesOf('snow-gust').find((surface) => surface.phase === 'snow-drift')!.tuning!.depthScale).toBeGreaterThanOrEqual(3)
    expect(surfacesOf('enemy-death-poof').find((surface) => surface.kind === 'shield-fragments')).toMatchObject({
      scale: expect.any(Number),
      tuning: expect.objectContaining({ meshMotion: 'break' }),
    })
    expect(surfacesOf('enemy-death-poof').find((surface) => surface.kind === 'shield-fragments')!.scale).toBeGreaterThan(0.9)
    expect(surfacesOf('level-up-flare').find((surface) => surface.kind === 'beam-column')?.tuning?.meshShader).toBe('energy-column')
  })

  it('stages level-up as a grounded gather, volumetric surge, and depth-spread payout', () => {
    expect(PFX_TAXONOMY.find((effect) => effect.id === 'level-up-flare')?.space).toBe('world')
    const surfaces = getPfxRenderPlan(createPfxPreset('level-up-flare')).surfaces
    expect(surfaces).toHaveLength(3)

    const gather = surfaces.find((surface) => surface.phase === 'level-up-ground-gather')
    expect(gather).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'converge-center',
        sprite: 'glow',
        blend: 'additive',
      }),
    })
    expect(gather!.tuning!.spawnScale).toBeGreaterThanOrEqual(1.5)
    expect(gather!.tuning!.depthScale).toBeGreaterThanOrEqual(2)

    const surge = surfaces.find((surface) => surface.phase === 'level-up-volumetric-surge')
    expect(surge).toMatchObject({
      kind: 'beam-column',
      tuning: expect.objectContaining({
        meshShader: 'energy-column',
        meshMotion: 'charge',
        lifecycle: 'level-up-surge',
      }),
    })
    expect(surge!.tuning!.widthScale).toBeGreaterThanOrEqual(3.6)

    const payout = surfaces.find((surface) => surface.phase === 'level-up-crown-payout')
    expect(payout).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'cone-fountain',
        sprite: 'streak',
        blend: 'alpha',
      }),
    })
    expect(payout!.tuning!.depthScale).toBeGreaterThanOrEqual(2)
    expect(payout!.tuning!.delay).toBeGreaterThan(0.25)

    const onset = PfxLibrary.createPfxLevelUpSurgeLifecycle(0.08)
    const peak = PfxLibrary.createPfxLevelUpSurgeLifecycle(0.34)
    const decay = PfxLibrary.createPfxLevelUpSurgeLifecycle(0.68)
    expect(onset.stage).toBe('gather')
    expect(onset.energy).toBeLessThan(0.3)
    expect(peak.stage).toBe('surge')
    expect(peak.energy).toBeGreaterThan(0.9)
    expect(decay.stage).toBe('payout')
    expect(decay.energy).toBeLessThan(0.5)
  })

  it('renders embers burst as a particle-first ballistic fire breakup', () => {
    const surfaces = getPfxRenderPlan(createPfxPreset('embers-burst')).surfaces
    expect(surfaces).toHaveLength(3)
    expect(surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)

    const ignition = surfaces.find((surface) => surface.phase === 'embers-burst-particle-ignition-pop')
    expect(ignition).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'impact-burst',
        sprite: 'glow',
        lifecycle: 'embers-burst-particle-breakup',
      }),
    })
    expect(ignition?.tuning?.referenceLicense).toBe('repo-original-and-CC0-1.0')
    const ignitionGeometry = PfxLibrary.createPfxEmberIgnitionGeometry()
    ignitionGeometry.computeBoundingBox()
    expect(ignitionGeometry.userData['pfxEmberIgnitionGeometry']).toBe('closed-faceted-self-lit-coal-seed')
    expect(ignitionGeometry.boundingBox!.max.x - ignitionGeometry.boundingBox!.min.x).toBeLessThan(0.5)
    ignitionGeometry.dispose()

    const launch = surfaces.find((surface) => surface.phase === 'embers-burst-particle-ballistic-coals')
    expect(launch).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'cone-fountain',
        sprite: 'ember',
        lifecycle: 'embers-burst-particle-breakup',
      }),
    })
    expect(launch?.tuning?.speedJitter).toBeGreaterThanOrEqual(0.45)
    expect(launch?.tuning?.gravity).toBeLessThan(0)
    expect(launch?.tuning?.referenceLicense).toBe('repo-original-and-CC0-1.0')
    const emberGeometry = PfxLibrary.createPfxEmberFragmentGeometry()
    emberGeometry.computeBoundingBox()
    expect(emberGeometry.userData['pfxEmberFragmentCount']).toBeGreaterThanOrEqual(10)
    expect(emberGeometry.userData['pfxEmberFragmentDepthCrossingCount']).toBeGreaterThanOrEqual(4)
    expect(emberGeometry.userData['pfxEmberFragmentClosedFaces']).toBe(true)
    expect(emberGeometry.boundingBox!.max.z - emberGeometry.boundingBox!.min.z).toBeGreaterThan(0.7)
    emberGeometry.dispose()

    const cooling = surfaces.find((surface) => surface.phase === 'embers-burst-particle-cooling-smoke')
    expect(cooling).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'drift-cloud',
        sprite: 'smoke-variants',
        blend: 'alpha',
        ramp: 'dark',
        lifecycle: 'embers-burst-particle-breakup',
      }),
    })
    expect(cooling!.tuning!.death).toBe('erode')
    expect(cooling!.tuning!.referenceLicense).toBe('repo-original-and-CC0-1.0')
    expect(cooling!.tuning!.depthScale).toBeGreaterThanOrEqual(2)
    expect(cooling!.tuning!.delay).toBeGreaterThan(0)
  })

  it('renders spark loop as a volumetric snap cadence instead of a ring and glow blob', () => {
    const surfaces = getPfxRenderPlan(createPfxPreset('spark-loop')).surfaces
    expect(surfaces).toHaveLength(3)
    expect(surfaces.some((surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring')).toBe(false)

    expect(surfaces.find((surface) => surface.phase === 'spark-gap-fork-volume')).toMatchObject({
      kind: 'impact-shards',
      tuning: expect.objectContaining({
        meshMotion: 'glow',
        lifecycle: 'spark-gap-loop',
      }),
    })
    const arcGeometry = PfxLibrary.createPfxSparkGapGeometry()
    arcGeometry.computeBoundingBox()
    expect(arcGeometry.userData['pfxSparkGapSegmentCount']).toBeGreaterThanOrEqual(10)
    expect(arcGeometry.userData['pfxSparkGapDepthBranchCount']).toBeGreaterThanOrEqual(2)
    expect(arcGeometry.userData['pfxSparkGapClosedFaces']).toBe(true)
    expect(arcGeometry.boundingBox!.max.z - arcGeometry.boundingBox!.min.z).toBeGreaterThan(0.8)
    arcGeometry.dispose()

    const pips = surfaces.find((surface) => surface.phase === 'spark-gap-contact-pips')
    expect(pips).toMatchObject({
      kind: 'particles',
      tuning: expect.objectContaining({
        motion: 'radial-burst',
        sprite: 'glow',
        blend: 'additive',
      }),
    })
    expect(pips!.tuning!.countScale).toBeGreaterThanOrEqual(0.5)
    expect(pips!.tuning!.depthScale).toBeGreaterThanOrEqual(2)
    expect(pips!.tuning!.flicker).toBeGreaterThanOrEqual(2)

    expect(surfaces.find((surface) => surface.phase === 'spark-gap-contact-core')).toMatchObject({
      kind: 'core-sphere',
      scale: expect.any(Number),
      tuning: expect.objectContaining({
        meshMotion: 'glow',
        lifecycle: 'spark-gap-loop',
      }),
    })
    expect(surfaces.find((surface) => surface.phase === 'spark-gap-contact-core')!.scale).toBeGreaterThanOrEqual(0.25)

    const snap = PfxLibrary.createPfxSparkGapLoopState(0.02)
    const afterglow = PfxLibrary.createPfxSparkGapLoopState(0.14)
    const rest = PfxLibrary.createPfxSparkGapLoopState(0.32)
    const repeat = PfxLibrary.createPfxSparkGapLoopState(0.48)
    expect(snap.stage).toBe('snap')
    expect(snap.energy).toBeGreaterThan(0.9)
    expect(afterglow.stage).toBe('afterglow')
    expect(afterglow.energy).toBeGreaterThan(0.25)
    expect(rest.stage).toBe('rest')
    expect(rest.energy).toBeLessThan(0.15)
    expect(repeat.stage).toBe('snap')
  })

  it('has no remaining profile-backed effects after every taxonomy entry receives authored phase language', () => {
    const backedItems = filterPfxCatalog({ coverage: ['profile-backed'] })
    const backedPlans = backedItems.map(({ effect }) => getPfxRenderPlan(createPfxPreset(effect.id)))

    expect(backedItems).toHaveLength(0)
    expect(backedPlans.every((plan) => plan.authoredRecipeId == null)).toBe(true)
    expect(PFX_TAXONOMY.every((effect) => getPfxRenderPlan(createPfxPreset(effect.id)).authoredRecipeId != null)).toBe(true)
  })

  it('summarizes single and concurrent stress-scene performance evidence', () => {
    const lowPresets = filterPfxCatalog({
      performanceTier: ['low'],
      mobileSafeOnly: true,
    }).map((item) => item.preset).slice(0, 20)
    const summary = summarizePfxPerformance(lowPresets)
    const expectedDrawCalls = lowPresets.reduce(
      (total, preset) => total + getPfxRenderPlan(preset).estimatedDrawCalls,
      0,
    )

    expect(summary.effectCount).toBe(20)
    expect(summary.totalParticles).toBeGreaterThan(100)
    expect(summary.totalDrawCalls).toBe(expectedDrawCalls)
    expect(summary.totalDrawCalls).toBeLessThanOrEqual(60)
    expect(summary.mobileSafe).toBe(true)
    expect(summary.overdrawRisk).toMatch(/low|medium|high/)

    const stress = createPfxStressScenario({
      id: 'mobile-combat-20',
      query: { performanceTier: ['low'], mobileSafeOnly: true },
      concurrentEffects: 20,
    })

    expect(stress.id).toBe('mobile-combat-20')
    expect(stress.presets).toHaveLength(20)
    expect(stress.summary.mobileSafe).toBe(true)
    expect(stress.summary.totalParticles).toBe(summary.totalParticles)
    expect(stress.positions).toHaveLength(20)

    expect(summarizePfxPerformance([createPfxPreset('explosion')]).mobileSafe).toBe(false)
  })

  it('builds deterministic explicit-id stress scenes for catalog stress profiling chunks', () => {
    const stress = createPfxStressScenario({
      id: 'explicit-effects',
      effectIds: ['fireball', 'force-field', 'ui-reward-burst'],
      concurrentEffects: 20,
    })

    expect(stress.presets.map((preset) => preset.effectId)).toEqual([
      'fireball',
      'force-field',
      'ui-reward-burst',
    ])
    expect(stress.positions).toHaveLength(3)
    expect(stress.summary.effectCount).toBe(3)
  })

  it('repeats one explicit effect to its requested canonical concurrency for device profiling', () => {
    const stress = createPfxStressScenario({
      id: 'canonical-fireball-low-20',
      effectIds: ['fireball'],
      concurrentEffects: 20,
      repeatExplicitEffects: true,
    })

    expect(stress.presets).toHaveLength(20)
    expect(stress.presets.every((preset) => preset.effectId === 'fireball')).toBe(true)
    expect(stress.positions).toHaveLength(20)
    expect(stress.summary.effectCount).toBe(20)
  })
})

describe('r3f-pfx-library particle simulation', () => {
  const preset = createPfxPreset('fireball')

  it('creates a deterministic simulation for the same preset and surface', () => {
    const surface = { kind: 'particles', role: 'body', phase: 'flame-core' } as const
    const a = PfxLibrary.createPfxParticleSimulation(preset, surface)
    const b = PfxLibrary.createPfxParticleSimulation(preset, surface)
    expect(a.count).toBeGreaterThanOrEqual(8)
    expect(Array.from(a.spawn)).toEqual(Array.from(b.spawn))
    expect(Array.from(a.direction)).toEqual(Array.from(b.direction))
    expect(Array.from(a.speed)).toEqual(Array.from(b.speed))
  })

  it('honors authored depth spread for volumetric drift and trail emitters', () => {
    const volumePreset = createPfxPreset('snow-gust')
    const maxSpawnDepth = (motion: 'drift-cloud' | 'trail-stream', depthScale: number) => {
      const surface = {
        kind: 'particles',
        role: 'volume',
        phase: `depth-${motion}`,
        tuning: { motion, depthScale, spawnScale: 1 },
      } as const
      const simulation = PfxLibrary.createPfxParticleSimulation(volumePreset, surface)
      return Math.max(...Array.from(simulation.spawn).filter((_, index) => index % 3 === 2).map(Math.abs))
    }

    for (const motion of ['drift-cloud', 'trail-stream'] as const) {
      expect(maxSpawnDepth(motion, 4)).toBeGreaterThan(maxSpawnDepth(motion, 1) * 3.5)
    }
  })

  it('builds snow gusts as broad lateral squalls instead of projectile trails', () => {
    const snowPreset = createPfxPreset('snow-gust')
    const authored = getPfxRenderPlan(snowPreset).surfaces.find((surface) => surface.phase === 'snow-drift')!
    const surface = {
      ...authored,
      tuning: { ...authored.tuning, motion: 'snow-gust' },
    } as Parameters<typeof PfxLibrary.createPfxParticleSimulation>[1]
    const simulation = PfxLibrary.createPfxParticleSimulation(snowPreset, surface)
    const axis = (buffer: Float32Array, offset: number) => Array.from(buffer).filter((_, index) => index % 3 === offset)
    const extent = (values: number[]) => Math.max(...values) - Math.min(...values)
    const xDirections = axis(simulation.direction, 0)

    expect(simulation.motionKind).toBe('snow-gust')
    expect(xDirections.filter((value) => value < -0.7)).toHaveLength(simulation.count)
    expect(extent(axis(simulation.spawn, 0))).toBeGreaterThan(1.5)
    expect(extent(axis(simulation.spawn, 1))).toBeGreaterThan(0.6)
    expect(extent(axis(simulation.spawn, 1))).toBeLessThan(1.1)
    expect(extent(axis(simulation.spawn, 2))).toBeGreaterThan(1.8)
    expect(Math.max(...axis(simulation.direction, 1).map(Math.abs))).toBeLessThan(0.1)
  })

  it('places danger-pulse flecks on all four viewport edges without quadratic spawn scaling', () => {
    const dangerPreset = createPfxPreset('low-health-screen-particles')
    const surface = getPfxRenderPlan(dangerPreset).surfaces.find((candidate) => candidate.phase === 'pulse-specks')!
    const simulation = PfxLibrary.createPfxParticleSimulation(dangerPreset, surface)
    const points = Array.from({ length: simulation.count }, (_, index) => ({
      x: simulation.spawn[index * 3]!,
      y: simulation.spawn[index * 3 + 1]!,
    }))
    expect(points.every(({ x, y }) => Math.abs(x) >= 0.86 || Math.abs(y) >= 0.82)).toBe(true)
    expect(points.some(({ x }) => x <= -0.86)).toBe(true)
    expect(points.some(({ x }) => x >= 0.86)).toBe(true)
    expect(points.some(({ y }) => y <= -0.82)).toBe(true)
    expect(points.some(({ y }) => y >= 0.82)).toBe(true)
    expect(Math.max(...points.map(({ x }) => Math.abs(x)))).toBeLessThan(1.01)
    expect(Math.max(...points.map(({ y }) => Math.abs(y)))).toBeLessThan(1.01)
    const edgeRuns = [
      points.filter(({ x }) => x <= -0.86).map(({ y }) => y),
      points.filter(({ x }) => x >= 0.86).map(({ y }) => y),
      points.filter(({ y }) => y <= -0.82).map(({ x }) => x),
      points.filter(({ y }) => y >= 0.82).map(({ x }) => x),
    ]
    for (const run of edgeRuns) {
      const sorted = run.toSorted((left, right) => left - right)
      const gaps = sorted.slice(1).map((value, index) => value - sorted[index]!)
      expect(Math.max(...gaps)).toBeLessThan(0.55)
    }
    const source = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    expect(source).toContain('gl_Position = vec4(worldOffset.xy')
    expect(source).toContain('float bloodBody =')
    expect(source).toContain('float bloodDrip =')
    expect(source).toContain('float dangerLifeFloor =')
  })

  it('stratifies healing-charge motes into an authored twin helix instead of a random cloud', () => {
    const healingCharge = createPfxPreset('healing-charge')
    const healing = {
      ...healingCharge,
      controls: { ...healingCharge.controls, spawnShape: 'point' as const },
    }
    const surface = getPfxRenderPlan(healing).surfaces.find((candidate) => candidate.phase === 'healing-charge-gather-inflow')!
    const simulation = PfxLibrary.createPfxParticleSimulation(healing, surface)

    expect(simulation.motionKind).toBe('healing-spiral')
    expect(simulation.lifeOffset[0]).toBeCloseTo(simulation.lifeOffset[1]!)
    expect(simulation.lifeOffset[2]).toBeGreaterThan(simulation.lifeOffset[0]!)
    expect(Math.abs(simulation.orbitAngle[1]! - simulation.orbitAngle[0]!)).toBeCloseTo(Math.PI)
    expect(simulation.orbitRadius[0]).toBeCloseTo(simulation.orbitRadius[1]!)
    const spawnHeights = Array.from(simulation.spawn).filter((_, index) => index % 3 === 1)
    expect(Math.max(...spawnHeights) - Math.min(...spawnHeights)).toBeLessThan(0.0001)
    expect(spawnHeights[0]).toBeCloseTo(-0.72 * healing.controls.scale * (surface.tuning?.spawnScale ?? 1))

    const emission = PfxLibrary.createPfxParticleEmission(healing, surface)
    expect(emission.life[0]).toBeCloseTo(emission.life[2]!)
    expect(emission.life[1]).toBeCloseTo(emission.life[3]!)
    expect(emission.life[4]).toBeGreaterThan(emission.life[0]!)
  })

  it('writes identical position and color buffers for the same elapsed time', () => {
    const surface = { kind: 'particles', role: 'body', phase: 'flame-core' } as const
    const simulation = PfxLibrary.createPfxParticleSimulation(preset, surface)
    const positionsA = new Float32Array(simulation.count * 3)
    const colorsA = new Float32Array(simulation.count * 3)
    const positionsB = new Float32Array(simulation.count * 3)
    const colorsB = new Float32Array(simulation.count * 3)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 1.37, positionsA, colorsA)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 1.37, positionsB, colorsB)
    expect(Array.from(positionsA)).toEqual(Array.from(positionsB))
    expect(Array.from(colorsA)).toEqual(Array.from(colorsB))
  })

  it('moves particles over time instead of leaving a static cloud', () => {
    const surface = { kind: 'particles', role: 'body', phase: 'flame-core' } as const
    const simulation = PfxLibrary.createPfxParticleSimulation(preset, surface)
    const early = new Float32Array(simulation.count * 3)
    const late = new Float32Array(simulation.count * 3)
    const colors = new Float32Array(simulation.count * 3)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 0.2, early, colors)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 0.45, late, colors)
    let moved = 0
    for (let i = 0; i < simulation.count * 3; i += 3) {
      const delta =
        Math.abs(late[i]! - early[i]!) + Math.abs(late[i + 1]! - early[i + 1]!) + Math.abs(late[i + 2]! - early[i + 2]!)
      if (delta > 0.0005) moved += 1
    }
    expect(moved).toBeGreaterThan(simulation.count * 0.9)
  })

  it('keeps the life alpha envelope inside [0, 1] with fade-in and fade-out', () => {
    expect(PfxLibrary.getPfxParticleLifeAlpha(0)).toBe(0)
    expect(PfxLibrary.getPfxParticleLifeAlpha(1)).toBe(0)
    expect(PfxLibrary.getPfxParticleLifeAlpha(0.4)).toBeGreaterThan(0.9)
    for (let life = 0; life <= 1; life += 0.05) {
      const alpha = PfxLibrary.getPfxParticleLifeAlpha(life)
      expect(alpha).toBeGreaterThanOrEqual(0)
      expect(alpha).toBeLessThanOrEqual(1)
    }
  })

  it('maps surfaces to motion kinds by profile, role, and phase', () => {
    const motionOf = (effectId: string, surface: { kind: string; role: string; phase?: string }) =>
      PfxLibrary.getPfxParticleMotionKind(surface as never, createPfxPreset(effectId))
    expect(motionOf('fireball', { kind: 'impact-sparks', role: 'impact' })).toBe('impact-burst')
    expect(motionOf('force-field', { kind: 'particles', role: 'aura' })).toBe('orbit-ring')
    expect(motionOf('ui-reward-burst', { kind: 'particles', role: 'screen' })).toBe('screen-fall')
    expect(motionOf('smoke-puff', { kind: 'particles', role: 'volume' })).toBe('drift-cloud')
  })

  it('keeps color channels bounded and life-tinted between the preset colors', () => {
    const surface = { kind: 'particles', role: 'body', phase: 'flame-core' } as const
    const simulation = PfxLibrary.createPfxParticleSimulation(preset, surface)
    const positions = new Float32Array(simulation.count * 3)
    const colors = new Float32Array(simulation.count * 3)
    PfxLibrary.updatePfxParticleSimulation(simulation, preset.controls, 2.1, positions, colors)
    for (const channel of colors) {
      expect(channel).toBeGreaterThanOrEqual(0)
      expect(channel).toBeLessThanOrEqual(1)
    }
  })
})

describe('r3f-pfx-library surface tuning (reference-derived recipes)', () => {
  const preset = createPfxPreset('fireball')

  it('applies sprite, window, count, speed, and spin overrides to emissions', () => {
    const plain = { kind: 'particles', role: 'body', phase: 'flame-shell' } as const
    const tuned = {
      ...plain,
      tuning: { sprite: 'debris', window: 0.3, countScale: 0.5, speedScale: 2, spinScale: 3 },
    } as const
    const base = PfxLibrary.createPfxParticleEmission(preset, plain)
    const emission = PfxLibrary.createPfxParticleEmission(preset, tuned)
    expect(emission.sprite).toBe('debris')
    expect(emission.emissionWindow).toBe(0.3)
    expect(emission.count).toBeLessThan(base.count)
    expect(Math.abs(emission.speed[0]! / base.speed[0]! - 2)).toBeLessThan(0.001)
  })

  it('overrides the derived motion kind via tuning', () => {
    const surface = { kind: 'particles', role: 'aura', tuning: { motion: 'column-rise' } } as const
    expect(PfxLibrary.getPfxParticleMotionKind(surface, createPfxPreset('healing-aura'))).toBe('column-rise')
  })

  it('overrides layer blending via tuning so smoke stays alpha-blended in additive effects', () => {
    const surface = { kind: 'particles', role: 'volume', opacity: 0.5, scale: 1, tuning: { blend: 'alpha' } } as const
    const props = getPfxSurfaceMaterialProps(surface, { ...preset.controls, blendMode: 'additive' })
    expect(props.blending).toBe('alpha')
  })

  it('renders the danger texture as a true edge vignette instead of a world-space center glow', () => {
    const texture = PfxLibrary.getPfxSharedGradientTexture('screen-vignette')
    const data = texture.image.data as Uint8Array
    const size = texture.image.width as number
    const alphaAt = (x: number, y: number) => data[(y * size + x) * 4 + 3]!
    const center = alphaAt(Math.floor(size / 2), Math.floor(size / 2))
    const nearEdge = alphaAt(4, Math.floor(size / 2))
    expect(nearEdge).toBeGreaterThan(center)
  })

  it('keeps the coin pickup as staged gold sprites with a rising twinkle and late deposit', () => {
    // A compact metallic medallion rises from a true radial contact twinkle;
    // the late glint resolves at the arc apex.
    const surfaces = getPfxRenderPlan(createPfxPreset('coin-pickup-sparkle')).surfaces
    expect(surfaces).toHaveLength(3)
    const rewardBurst = surfaces.find((surface) => surface.phase === 'coin-pickup-radial-reward-burst')
    expect(rewardBurst).toMatchObject({
      kind: 'coin-reward-burst',
      tuning: { meshMotion: 'flash', lifecycle: 'coin-pickup-reward-burst' },
    })
    expect(rewardBurst?.tuning?.delay).toBeGreaterThanOrEqual(0.06)
    expect(rewardBurst?.tuning?.window).toBeGreaterThanOrEqual(0.34)
    expect(rewardBurst?.tuning?.positionOffset?.[1]).toBeGreaterThanOrEqual(0.3)
    expect(rewardBurst?.scale).toBeLessThanOrEqual(0.4)
    expect(isPfxSurfaceCameraFacing(rewardBurst!, 2)).toBe(false)
    expect(PfxLibrary.getPfxSurfaceSpatialPolicy(rewardBurst!).crossedVolume).toBe(true)
    expect(PfxLibrary.getPfxSurfaceSpatialPolicy(rewardBurst!).minimumDepth).toBeGreaterThanOrEqual(0.3)
    const createRewardBurstGeometry = (PfxLibrary as unknown as {
      createPfxCoinRewardBurstGeometry: () => THREE.BufferGeometry
    }).createPfxCoinRewardBurstGeometry
    const rewardBurstGeometry = createRewardBurstGeometry()
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstDrawCalls']).toBe(1)
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstRayCount']).toBeGreaterThanOrEqual(10)
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstDepthRayCount']).toBeGreaterThanOrEqual(8)
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstLengthRatio']).toBeGreaterThanOrEqual(1.8)
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstSecondaryChipCount']).toBeGreaterThanOrEqual(6)
    expect(rewardBurstGeometry.userData['pfxCoinRewardBurstClosedFaces']).toBe(true)
    rewardBurstGeometry.computeBoundingBox()
    expect(rewardBurstGeometry.boundingBox!.max.z - rewardBurstGeometry.boundingBox!.min.z).toBeGreaterThanOrEqual(1.4)
    rewardBurstGeometry.dispose()
    const createRewardBurstMaterial = (PfxLibrary as unknown as {
      createPfxCoinRewardBurstMaterial: (opacity: number, color: THREE.ColorRepresentation) => THREE.MeshStandardMaterial
    }).createPfxCoinRewardBurstMaterial
    const rewardBurstMaterial = createRewardBurstMaterial(0.98, '#fff0a8')
    expect(rewardBurstMaterial.blending).toBe(THREE.NormalBlending)
    expect(rewardBurstMaterial.depthWrite).toBe(true)
    expect(rewardBurstMaterial.depthTest).toBe(true)
    expect(rewardBurstMaterial.emissive.g).toBeGreaterThanOrEqual(0.85)
    expect(rewardBurstMaterial.emissiveIntensity).toBeGreaterThanOrEqual(0.7)
    rewardBurstMaterial.dispose()
    const medallion = surfaces.find((surface) => surface.kind === 'coin-medallion')
    expect(medallion?.scale).toBeGreaterThanOrEqual(0.4)
    expect(medallion?.scale).toBeLessThanOrEqual(0.55)
    const medallionOnset = getPfxSurfaceAnimationProps(
      medallion!,
      createPfxPreset('coin-pickup-sparkle').controls,
      0,
      2,
      2,
      2,
    )
    expect(medallionOnset.scaleMultiplier).toBeGreaterThanOrEqual(0.88)
    const deposit = surfaces.find((surface) => surface.phase === 'coin-pickup-deposit-glint')
    expect(deposit?.tuning?.delay).toBeGreaterThanOrEqual(0.5)
    expect(deposit?.tuning?.spawnOffset?.[1]).toBeGreaterThan(0.5)
    const source = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'index.tsx'), 'utf8')
    expect(source).toContain('createPfxCoinGoldMaterial')
    expect(source).toContain('metalness: 0.82')
    expect(source).toContain('pfx-coin-crest')
  })

  it('builds the critical hit as a three-layer particle-first combat punctuation', () => {
    const plan = getPfxRenderPlan(createPfxPreset('critical-hit-burst'))
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    expect(plan.surfaces.every((surface) => surface.kind === 'particles')).toBe(true)
    expect(plan.surfaces.every((surface) => surface.tuning?.referenceLicense === 'repo-original-and-CC0-1.0')).toBe(true)
    const contact = plan.surfaces.find((surface) => surface.phase === 'critical-hit-burst-particle-contact-pop')
    expect(contact).toMatchObject({
      kind: 'particles',
      tuning: { motion: 'impact-burst', sprite: 'glow', lifecycle: 'critical-hit-burst-particle-confirm' },
    })
    expect(contact?.tuning?.colorOverride).toBe('#fff9e8')
    expect(contact?.tuning?.window).toBeLessThanOrEqual(0.15)
    expect(contact?.tuning?.positionOffset?.[1]).toBeGreaterThanOrEqual(0.4)
    const splinters = plan.surfaces.find((surface) => surface.phase === 'critical-hit-burst-particle-victory-fan')
    expect(splinters).toMatchObject({
      kind: 'particles',
      tuning: { motion: 'radial-burst', sprite: 'streak', lifecycle: 'critical-hit-burst-particle-confirm' },
    })
    expect(splinters?.tuning?.speedJitter).toBeGreaterThanOrEqual(0.45)
    expect(splinters?.tuning?.spreadAngle).toBeGreaterThanOrEqual(0.7)
    expect(splinters?.tuning?.window).toBeLessThanOrEqual(0.3)
    const pressure = plan.surfaces.find((surface) => surface.phase === 'critical-hit-burst-particle-pressure-resolve')
    expect(pressure).toMatchObject({
      kind: 'particles',
      tuning: { motion: 'shockwave-ground-burst', sprite: 'puff', lifecycle: 'critical-hit-burst-particle-confirm' },
    })
    expect(pressure?.tuning?.delay).toBeGreaterThanOrEqual(0.18)
    expect(pressure?.tuning?.positionOffset?.[1]).toBeLessThan(0)
    expect(pressure?.tuning?.referenceLicense).toBe('repo-original-and-CC0-1.0')
  })

  it('builds enemy death as a three-draw kill receipt, collapse, and smoke resolver', () => {
    const plan = getPfxRenderPlan(createPfxPreset('enemy-death-poof'))
    expect(plan.surfaces).toHaveLength(3)
    expect(plan.estimatedDrawCalls).toBeLessThanOrEqual(3)
    const receipt = plan.surfaces.find((surface) => surface.phase === 'enemy-death-hard-kill-receipt')
    expect(receipt).toMatchObject({
      kind: 'core-sphere',
      tuning: { meshMotion: 'flash', colorOverride: '#ffffff' },
    })
    expect(receipt?.tuning?.positionOffset?.[1]).toBeGreaterThanOrEqual(0.45)
    const collapse = plan.surfaces.find((surface) => surface.phase === 'enemy-death-body-collapse')
    expect(collapse?.kind).toBe('shield-fragments')
    expect(collapse?.scale).toBeGreaterThanOrEqual(0.9)
    expect(collapse?.tuning?.positionOffset?.[1]).toBeGreaterThanOrEqual(0.35)
    expect(isPfxSurfaceCameraFacing(collapse!, 2)).toBe(false)
    const smoke = plan.surfaces.find((surface) => surface.phase === 'enemy-death-smoke-resolver')
    expect(smoke).toMatchObject({ kind: 'particles', tuning: { motion: 'drift-cloud', sprite: 'puff', blend: 'alpha' } })
    expect(smoke?.tuning?.depthScale).toBeGreaterThanOrEqual(2)
    expect(smoke?.tuning?.delay).toBeLessThanOrEqual(0.05)
    expect(smoke?.tuning?.countScale).toBeGreaterThanOrEqual(1)
    expect(smoke?.tuning?.size?.[1]).toBeGreaterThanOrEqual(1)
    expect(plan.surfaces.some((surface) => surface.kind === 'cloud-volume')).toBe(false)
  })

  it('burst-syncs mesh flash layers: bright pop early in the cycle, invisible at rest', () => {
    const surface = {
      kind: 'core-sphere',
      role: 'impact',
      opacity: 0.9,
      scale: 1,
      phase: 'detonation-flash',
      tuning: { meshMotion: 'flash' },
    } as const
    const samples: number[] = []
    for (let t = 0; t <= 3; t += 0.02) {
      samples.push(getPfxSurfaceAnimationProps(surface, preset.controls, t).opacityMultiplier)
    }
    expect(Math.max(...samples)).toBeGreaterThan(0.8)
    const dark = samples.filter((value) => value === 0).length
    expect(dark / samples.length).toBeGreaterThan(0.6)
    expect(getPfxSurfaceAnimationProps(surface, preset.controls, 0.01).signature).toContain('burst-flash')
  })

  it('burst-syncs shockwave rings: expand while fading, then rest', () => {
    const surface = {
      kind: 'shockwave-ring',
      role: 'impact',
      opacity: 0.6,
      scale: 1,
      phase: 'radius-read',
      tuning: { meshMotion: 'shockwave' },
    } as const
    const visible: { scale: number; opacity: number }[] = []
    let dark = 0
    let total = 0
    for (let t = 0; t <= 3; t += 0.02) {
      const motion = getPfxSurfaceAnimationProps(surface, preset.controls, t)
      total += 1
      if (motion.opacityMultiplier === 0) dark += 1
      else visible.push({ scale: motion.scaleMultiplier, opacity: motion.opacityMultiplier })
    }
    expect(visible.length).toBeGreaterThan(3)
    expect(dark / total).toBeGreaterThan(0.4)
    const minScale = Math.min(...visible.map((entry) => entry.scale))
    const maxScale = Math.max(...visible.map((entry) => entry.scale))
    expect(maxScale).toBeGreaterThan(minScale * 1.5)
  })

  it('pulses aura rings on a slow release cadence', () => {
    const surface = {
      kind: 'ring-field',
      role: 'aura',
      opacity: 0.6,
      scale: 1,
      phase: 'ground-runes',
      tuning: { meshMotion: 'pulse' },
    } as const
    const controls = createPfxPreset('healing-aura').controls
    const scales: number[] = []
    for (let t = 0; t <= 4; t += 0.05) {
      scales.push(getPfxSurfaceAnimationProps(surface, controls, t).scaleMultiplier)
    }
    expect(Math.max(...scales)).toBeGreaterThan(1.1)
    expect(Math.min(...scales)).toBeLessThan(0.6)
    expect(getPfxSurfaceAnimationProps(surface, controls, 0.5).signature).toContain('burst-pulse')
  })

  it('keeps every authored recipe within its tier draw-call budget', () => {
    for (const preset of PFX_PRESETS) {
      const recipe = PfxLibrary.AUTHORED_EFFECT_RECIPES[preset.effectId]
      if (!recipe) continue
      const budget = PERFORMANCE_TIER_BUDGETS[preset.performance.tier]
      expect(recipe.surfaces.length, `${preset.effectId} recipe layers`).toBeLessThanOrEqual(budget.maxDrawCalls)
      expect(getPfxRenderPlan(preset).estimatedDrawCalls).toBeLessThanOrEqual(preset.performance.maxDrawCalls)
    }
  })

  it('adapts the four audited bursts from distinct particle reference rigs', () => {
    const referenceAdaptations = [
      { effectId: 'mud-burst', source: 'blood-burst-particle-splash', lifecycle: 'mud-burst-grounded-eruption', motion: 'impact-burst' },
      { effectId: 'healing-burst', source: 'healing-charge-spiral-and-repo-healing-glyph-language', lifecycle: 'healing-burst-restoration-release', motion: 'healing-cross' },
      { effectId: 'holy-burst', source: 'holy-charge-grace-motes-and-repo-critical-hit-spark', lifecycle: 'holy-burst-consecration-release', motion: 'impact-burst' },
      { effectId: 'shadow-burst', source: 'shadow-charge-void-gather-and-kenney-slash', lifecycle: 'shadow-burst-detonation', motion: 'shadow-claw' },
    ] as const

    for (const reference of referenceAdaptations) {
      const plan = getPfxRenderPlan(createPfxPreset(reference.effectId))
      const surfaces = plan.surfaces.filter((surface) => surface.kind === 'particles')
      expect(surfaces, `${reference.effectId} particle surfaces`).toHaveLength(3)
      expect(plan.estimatedDrawCalls, `${reference.effectId} draw calls`).toBe(3)
      expect(surfaces[0]?.phase, `${reference.effectId} phase`).toContain('reference')
      expect(surfaces[0]?.tuning?.lifecycle, `${reference.effectId} lifecycle`).toBe(reference.lifecycle)
      expect(surfaces[0]?.tuning?.motion, `${reference.effectId} motion`).toBe(reference.motion)
      expect(surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${reference.effectId} mesh geometry`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.meshMotion === undefined), `${reference.effectId} mesh motion`).toBe(true)
      expect(surfaces.every((surface) => (surface.tuning as Record<string, unknown>)?.referenceLicense), `${reference.effectId} license`).toBeTruthy()
      expect(surfaces.every((surface) => PfxLibrary.shouldApplyPfxSurfaceCameraFacing(surface, 3, false)), `${reference.effectId} camera facing`).toBe(false)
      expect(reference.source).not.toContain('reference')
      expect((surfaces[0]?.tuning as Record<string, unknown>)?.referenceSource).toBe(reference.source)
    }
    expect(new Set(referenceAdaptations.map((reference) => reference.source)).size).toBe(referenceAdaptations.length)
  })

  it('keeps the next failing burst set particle-first with distinct semantic rigs', () => {
    const references = [
      { effectId: 'acid-burst', lifecycle: 'acid-burst-particle-eruption', motions: ['ground-scuff', 'drift-cloud', 'column-rise'] },
      { effectId: 'barrier-burst', lifecycle: 'barrier-burst-particle-ward', motions: ['orbit-ring', 'impact-burst', 'drift-cloud'] },
      { effectId: 'blast-burst', lifecycle: 'blast-burst-particle-rupture', motions: ['impact-burst', 'radial-burst', 'shockwave-ground-burst'] },
      { effectId: 'curse-cone', lifecycle: 'curse-cone-particle-propagation', motions: ['radial-burst', 'impact-burst', 'column-rise'] },
      { effectId: 'pickup-burst', lifecycle: 'pickup-burst-particle-receipt', motions: ['impact-burst', 'column-rise', 'orbit-ring'] },
      { effectId: 'poison-burst', lifecycle: 'poison-burst-particle-rupture', motions: ['drift-cloud', 'column-rise', 'impact-burst'] },
    ] as const

    for (const reference of references) {
      const preset = createPfxPreset(reference.effectId)
      const surfaces = getPfxRenderPlan(preset).surfaces
      expect(preset.controls.spawnShape, `${reference.effectId} spawn shape`).toBe('point')
      expect(surfaces, `${reference.effectId} layers`).toHaveLength(3)
      expect(surfaces.every((surface) => surface.kind === 'particles'), `${reference.effectId} particle-only`).toBe(true)
      expect(surfaces.map((surface) => surface.tuning?.motion), `${reference.effectId} motions`).toEqual(reference.motions)
      expect(surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${reference.effectId} mesh geometry`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.meshMotion === undefined), `${reference.effectId} mesh motion`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.lifecycle === reference.lifecycle), `${reference.effectId} lifecycle`).toBe(true)
      expect(surfaces.every((surface) => typeof (surface.tuning as Record<string, unknown>)?.referenceSource === 'string'), `${reference.effectId} source`).toBe(true)
      expect(surfaces.every((surface) => (surface.tuning as Record<string, unknown>)?.referenceLicense), `${reference.effectId} license`).toBeTruthy()
      expect(PfxLibrary.createPfxEmitterPhysicsFindings(getPfxRenderPlan(preset)), `${reference.effectId} physics`).toEqual([])
    }
  })

  it('keeps the next hero burst set particle-first with distinct semantic rigs', () => {
    const references = [
      { effectId: 'curse-burst', lifecycle: 'curse-burst-particle-malediction', motions: ['impact-burst', 'radial-burst', 'drift-cloud'] },
      { effectId: 'critical-hit-burst', lifecycle: 'critical-hit-burst-particle-confirm', motions: ['impact-burst', 'radial-burst', 'shockwave-ground-burst'] },
      { effectId: 'electric-critical', lifecycle: 'electric-critical-particle-discharge', motions: ['impact-burst', 'radial-burst', 'column-rise'] },
      { effectId: 'embers-burst', lifecycle: 'embers-burst-particle-breakup', motions: ['impact-burst', 'cone-fountain', 'drift-cloud'] },
      { effectId: 'flame-burst', lifecycle: 'flame-burst-particle-ignite', motions: ['cone-fountain', 'radial-burst', 'drift-cloud'] },
      { effectId: 'ice-burst', lifecycle: 'ice-burst-particle-impact', motions: ['impact-burst', 'cone-fountain', 'drift-cloud'] },
    ] as const

    for (const reference of references) {
      const preset = createPfxPreset(reference.effectId)
      const surfaces = getPfxRenderPlan(preset).surfaces
      expect(preset.controls.spawnShape, `${reference.effectId} spawn shape`).toBe('point')
      expect(surfaces, `${reference.effectId} layers`).toHaveLength(3)
      expect(surfaces.every((surface) => surface.kind === 'particles'), `${reference.effectId} particle-only`).toBe(true)
      expect(surfaces.map((surface) => surface.tuning?.motion), `${reference.effectId} motions`).toEqual(reference.motions)
      expect(surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${reference.effectId} mesh geometry`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.meshMotion === undefined), `${reference.effectId} mesh motion`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.lifecycle === reference.lifecycle), `${reference.effectId} lifecycle`).toBe(true)
      expect(surfaces.every((surface) => typeof (surface.tuning as Record<string, unknown>)?.referenceSource === 'string'), `${reference.effectId} source`).toBe(true)
      expect(surfaces.every((surface) => (surface.tuning as Record<string, unknown>)?.referenceLicense), `${reference.effectId} license`).toBeTruthy()
    }
  })

  it('keeps the next matter-heavy burst set particle-first with distinct semantic rigs', () => {
    const references = [
      { effectId: 'ghost-critical', lifecycle: 'ghost-critical-particle-haunt', motions: ['impact-burst', 'radial-burst', 'drift-cloud'] },
      { effectId: 'jump-burst', lifecycle: 'jump-burst-particle-launch', motions: ['impact-burst', 'jump-launch', 'drift-cloud'] },
      { effectId: 'landing-burst', lifecycle: 'landing-burst-particle-impact', motions: ['impact-burst', 'shockwave-ground-burst', 'ground-scuff'] },
      { effectId: 'meteor-burst', lifecycle: 'meteor-burst-particle-collision', motions: ['impact-burst', 'meteor-impact', 'shockwave-ground-burst'] },
      { effectId: 'slime-burst', lifecycle: 'slime-burst-particle-elasticity', motions: ['impact-burst', 'cone-fountain', 'drift-cloud'] },
      { effectId: 'spark-cone', lifecycle: 'spark-cone-particle-release', motions: ['impact-burst', 'cone-fountain', 'drift-cloud'] },
    ] as const

    for (const reference of references) {
      const preset = createPfxPreset(reference.effectId)
      const surfaces = getPfxRenderPlan(preset).surfaces
      expect(preset.controls.spawnShape, `${reference.effectId} spawn shape`).toBe('point')
      expect(surfaces, `${reference.effectId} layers`).toHaveLength(3)
      expect(surfaces.every((surface) => surface.kind === 'particles'), `${reference.effectId} particle-only`).toBe(true)
      expect(surfaces.map((surface) => surface.tuning?.motion), `${reference.effectId} motions`).toEqual(reference.motions)
      expect(surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${reference.effectId} mesh geometry`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.meshMotion === undefined), `${reference.effectId} mesh motion`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.lifecycle === reference.lifecycle), `${reference.effectId} lifecycle`).toBe(true)
      expect(surfaces.every((surface) => typeof (surface.tuning as Record<string, unknown>)?.referenceSource === 'string'), `${reference.effectId} source`).toBe(true)
      expect(surfaces.every((surface) => (surface.tuning as Record<string, unknown>)?.referenceLicense), `${reference.effectId} license`).toBeTruthy()
      expect(PfxLibrary.createPfxEmitterPhysicsFindings(getPfxRenderPlan(preset)), `${reference.effectId} physics`).toEqual([])
    }
  })

  it('supports seeded azimuth randomization for irregular particle bursts', () => {
    const preset = createPfxPreset('hit-spark')
    const surface = {
      kind: 'particles' as const,
      role: 'impact' as const,
      phase: 'randomized-direction-test',
      tuning: { motion: 'radial-burst' as const, randomizeAzimuth: true, countScale: 0.5, turbulenceScale: 0 },
    }
    const emission = PfxLibrary.createPfxParticleEmission(
      { effectId: 'hit-spark', controls: preset.controls, implementationProfile: preset.implementationProfile },
      surface,
    )
    const angles = Array.from({ length: emission.count }, (_, index) => Math.atan2(emission.direction[index * 3 + 2]!, emission.direction[index * 3]!))
    expect(new Set(angles.map((angle) => angle.toFixed(3))).size).toBeGreaterThanOrEqual(Math.max(3, emission.count - 2))
    const repeat = PfxLibrary.createPfxParticleEmission(
      { effectId: 'hit-spark', controls: preset.controls, implementationProfile: preset.implementationProfile },
      surface,
    )
    expect(Array.from(repeat.direction)).toEqual(Array.from(emission.direction))
  })

  it('keeps the next mesh-heavy queue particle-first with distinct semantic rigs', () => {
    const references = [
      { effectId: 'hit-spark', lifecycle: 'hit-spark-particle-confirm', motions: ['impact-burst', 'radial-burst', 'radial-burst'], layers: 3 },
      { effectId: 'wind-impact', lifecycle: 'wind-impact-shear', motions: ['radial-burst', 'radial-burst', 'ground-scuff'], layers: 3 },
      { effectId: 'debris-release', lifecycle: 'debris-release-ballistic', motions: ['impact-burst', 'radial-burst', 'radial-burst', 'shockwave-ground-burst', 'radial-burst'], layers: 5 },
      { effectId: 'acid-charge', lifecycle: 'acid-charge-particle-convergence', motions: ['converge-center', 'drift-cloud', 'column-rise'], layers: 3 },
      { effectId: 'blood-charge', lifecycle: 'blood-charge-particle-convergence', motions: ['converge-center', 'impact-burst', 'orbit-ring'], layers: 3 },
      { effectId: 'flame-charge', lifecycle: 'flame-charge-compress', motions: ['braided-converge', 'column-rise', 'drift-cloud'], layers: 3 },
      { effectId: 'mud-charge', lifecycle: 'mud-charge-convergence', motions: ['converge-center', 'drift-cloud', 'ground-scuff'], layers: 3 },
      { effectId: 'reward-charge', lifecycle: 'reward-charge-gather-release', motions: ['converge-center', 'orbit-ring', 'column-rise'], layers: 3 },
      { effectId: 'sand-charge', lifecycle: 'sand-burst-ballistic', motions: ['converge-center', 'drift-cloud', 'ground-scuff'], layers: 3 },
    ] as const

    for (const reference of references) {
      const preset = createPfxPreset(reference.effectId)
      const surfaces = getPfxRenderPlan(preset).surfaces
      expect(preset.controls.spawnShape, `${reference.effectId} spawn shape`).toBe('point')
      expect(surfaces, `${reference.effectId} layers`).toHaveLength(reference.layers)
      expect(surfaces.every((surface) => surface.kind === 'particles'), `${reference.effectId} particle-only`).toBe(true)
      expect(surfaces.map((surface) => surface.tuning?.motion), `${reference.effectId} motions`).toEqual(reference.motions)
      expect(surfaces.every((surface) => surface.tuning?.meshGeometry === undefined), `${reference.effectId} mesh geometry`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.meshMotion === undefined), `${reference.effectId} mesh motion`).toBe(true)
      expect(surfaces.every((surface) => surface.tuning?.lifecycle === reference.lifecycle), `${reference.effectId} lifecycle`).toBe(true)
      expect(PfxLibrary.createPfxEmitterPhysicsFindings(getPfxRenderPlan(preset)), `${reference.effectId} physics`).toEqual([])
    }
  })

  it('keeps the audited particle stacks inside the craft-guide hero particle band', () => {
    for (const effectId of ['mud-burst', 'healing-burst', 'holy-burst', 'shadow-burst'] as const) {
      const preset = createPfxPreset(effectId)
      const plan = getPfxRenderPlan(preset)
      const particleCount = plan.surfaces
        .filter((surface) => surface.kind === 'particles')
        .reduce((total, surface) => total + PfxLibrary.createPfxParticleSimulation(preset, surface).count, 0)

      expect(particleCount, `${effectId} live particle budget`).toBeGreaterThanOrEqual(40)
      expect(particleCount, `${effectId} live particle budget`).toBeLessThanOrEqual(60)
    }
  })

  it('keeps mud silt residue unstretched so debris falls instead of smearing', () => {
    const plan = getPfxRenderPlan(createPfxPreset('mud-burst'))
    const silt = plan.surfaces.find((surface) => surface.phase === 'mud-burst-reference-silt-residue')

    expect(silt?.tuning?.sprite).toBe('debris')
    expect(silt?.tuning?.stretch ?? 0).toBe(0)
  })

  it('varies burst lifetimes independently instead of repeating an index-modular survivor pattern', () => {
    const preset = createPfxPreset('holy-burst')
    const surface = getPfxRenderPlan(preset).surfaces[0]!
    const emission = PfxLibrary.createPfxParticleEmission(preset, surface)
    const durations = Array.from({ length: emission.count }, (_, index) => emission.life[index * 2 + 1]!)

    expect(durations.length).toBeGreaterThanOrEqual(16)
    expect(durations.slice(0, 8)).not.toEqual(durations.slice(8, 16))
    expect(new Set(durations.map((duration) => duration.toFixed(4))).size).toBeGreaterThanOrEqual(8)
  })

  it('layers the explosion per the reference recipe: smoke under heat, flash and shockwave burst-synced', () => {
    const plan = getPfxRenderPlan(createPfxPreset('explosion'))
    const [smoke] = plan.surfaces
    expect(smoke?.tuning?.blend).toBe('alpha')
    expect(smoke?.tuning?.window).toBeLessThan(1)
    expect(plan.surfaces.some((surface) => surface.tuning?.meshMotion === 'flash')).toBe(true)
    expect(plan.surfaces.some((surface) => surface.tuning?.meshMotion === 'shockwave')).toBe(true)
    // Physics split (batch-01): stretched sparks fly STRAIGHT (gravity
    // rotated the velocity-aligned streak in place); debris arcs under
    // gravity unstretched. Two layers, two jobs.
    expect(plan.surfaces.some((surface) => (surface.tuning?.stretch ?? 0) > 1 && (surface.tuning?.gravity ?? 0) === 0)).toBe(true)
    expect(plan.surfaces.some((surface) => (surface.tuning?.gravity ?? 0) < 0 && (surface.tuning?.stretch ?? 0) === 0)).toBe(true)
  })
})
