import { PFX_SPRITE_SLICES } from '../particleSprites'
import { exportPfxComponentSnippet, exportPfxPresetJson, pushEffect } from '../build'
import { ART_STYLE_CLUSTERS, PFX_CONTROL_DEFINITIONS, PFX_MOBILE_RUNTIME_POLICY, PFX_PRODUCTION_IMPLEMENTATION_CRITERIA, PFX_QUALITY_RUBRIC_KEYS, PFX_RED_TEAM_CRITERIA, PFX_TEXTURE_ATLAS, getPfxTextureAtlasSlice } from '../constants/01'
import { AUTHORED_EFFECT_RECIPES } from '../constants/02'
import { PFX_CC0_ASSET_SOURCES, SEED_EFFECTS, createPerformanceMetadata, createPfxStyleRender, createPresetFromEffect, createProfileBackedPhase, createQualityScore, derivePfxBehaviorRole, generatedPairQueue, generatedSeed, normalizePfxRenderSurfaces, previewForEffect, roundMetric, slug } from '../constants/03'
import { PFX_BUDGET_AFFECTING_CONTROL_KEYS, PFX_FORBIDDEN_EXPORT_TERMS, PFX_PRODUCTION_IMPLEMENTATION_NOTE_TERMS, PFX_RED_TEAM_NOTE_ACTION_TERMS, PFX_RENDER_AFFECTING_CONTROL_KEYS, PFX_STRUCTURAL_SURFACE_KINDS, applyStyleVariant, clipMotionPath, controlDefaultWithinBounds, controlDefinitionIsBounded, createControlVariantOverride, createReducedMotionControls, developerDocsIntegrationChecklist, developerDocsProductionCaveat, developerDocsQualityLabel, duplicateValues, escapeXml, getPfxParticleMotionKind, getPfxSharedGeometry, getPfxSharedParticleTexture, hashPfxSurfaceKey, matchesPfxSearchQuery, normalizeThumbnailColors, overlaps, parseExportedPreset, redTeamNoteDimensionCoverage, roundSvg, seededRandom, validatePfxPreset, withoutSeed } from '../constants/04'
import { createPfxMobileRuntimePolicy } from '../effects/mobileRuntimePolicy'
import { createPfxParticleSimulation } from '../effects/particleSimulation'
import { getPfxSpriteForSurface } from '../effects/spriteForSurface'
import type { ArtStyleCluster, ExportSnippetOptions, LoopMode, PerformanceTier, PfxCatalogItem, PfxClipAsset, PfxComponentDefinition, PfxContactSheetAsset, PfxControlDefinition, PfxControlSafetyControlEvidence, PfxControlSafetyEffectEvidence, PfxControlSafetyMatrix, PfxControls, PfxDeveloperDocsEffect, PfxDeveloperDocsManifest, PfxExportCleanlinessAudit, PfxExportCleanlinessAuditEffect, PfxFilterQuery, PfxPerformanceSummary, PfxPreset, PfxPresetOverrides, PfxPreviewAssetAudit, PfxPreviewAssetAuditEffect, PfxPreviewManifest, PfxPreviewManifestEntry, PfxProductionAcceptanceGapKind, PfxProductionApproval, PfxProductionApprovalDecision, PfxProductionImplementationReview, PfxProductionReadinessStatus, PfxRedTeamEffectReview, PfxRuntimeOptimizationAudit, PfxRuntimeOptimizationAuditEffect, PfxStressScenario, PfxStressScenarioOptions, PfxStyleDifferentiationEffectEvidence, PfxStyleDifferentiationMatrix, PfxStyleDifferentiationVariantEvidence, PfxTaxonomyEffect, PfxThumbnailAsset } from '../types/01'
import type { PfxParticleEmission, PfxRenderPlan, PfxRenderPlanOptions, PfxRenderSurface, PfxStructuralQualityAudit, PfxStructuralQualityAuditEffect } from '../types/02'

export const PFX_TAXONOMY: PfxTaxonomyEffect[] = buildTaxonomy()

export const PFX_PRESETS: PfxPreset[] = PFX_TAXONOMY.map((effect) => createPresetFromEffect(effect))

export function createPfxStructuralQualityAudit(): PfxStructuralQualityAudit {
  const thresholds = {
    maximumRingEffectRatio: 0.5,
    minimumStructuredWorldEffectRatio: 0.8,
    minimumMeshSpawnEffectRatio: 0.3,
    minimumCc0AssetBackedEffectRatio: 0.7,
  }
  const effects = PFX_PRESETS.map<PfxStructuralQualityAuditEffect>((preset) => {
    const taxonomy = PFX_TAXONOMY.find((effect) => effect.id === preset.effectId)!
    const plan = getPfxRenderPlan(preset)
    const ringSurfaces = plan.surfaces.filter(
      (surface) => surface.kind === 'ring-field' || surface.kind === 'shockwave-ring',
    )
    const decorativeRings = ringSurfaces.filter((surface) => !surface.tuning?.ringPurpose)
    const particleSurfaces = plan.surfaces.filter(
      (surface) => surface.kind === 'particles' || surface.kind === 'impact-sparks',
    )
    // Code-authored mesh effects have no external asset licensing surface;
    // particle-backed effects must resolve at least one bundled CC0 sprite.
    const cc0AssetBacked = particleSurfaces.length === 0 || particleSurfaces.some((surface) => {
      const motion = getPfxParticleMotionKind(surface, preset)
      const sprite = getPfxSpriteForSurface(preset, surface, motion)
      return PFX_SPRITE_SLICES[sprite].source.startsWith('kenney-particle-pack/')
    })
    const structuredMesh = plan.surfaces.some((surface) => PFX_STRUCTURAL_SURFACE_KINDS.has(surface.kind))
    const findings = decorativeRings.map((surface) => `decorative-ring:${surface.phase ?? surface.kind}`)
    return {
      effectId: preset.effectId,
      space: taxonomy.space,
      ringSurfaceCount: ringSurfaces.length,
      structuredMesh,
      meshSpawnSource: preset.controls.spawnShape === 'mesh',
      cc0AssetBacked,
      findings,
    }
  })
  const worldEffects = effects.filter((effect) => effect.space === 'world')
  const ringEffects = effects.filter((effect) => effect.ringSurfaceCount > 0).length
  const decorativeRingSurfaces = effects.reduce(
    (total, effect) => total + effect.findings.filter((finding) => finding.startsWith('decorative-ring:')).length,
    0,
  )
  const structuredWorldEffects = worldEffects.filter((effect) => effect.structuredMesh).length
  const meshSpawnEffects = effects.filter((effect) => effect.meshSpawnSource).length
  const cc0AssetBackedEffects = effects.filter((effect) => effect.cc0AssetBacked).length
  const ratio = (value: number, total: number) => roundMetric(total === 0 ? 0 : value / total)
  const summary = {
    totalEffects: effects.length,
    worldEffects: worldEffects.length,
    ringEffects,
    ringEffectRatio: ratio(ringEffects, effects.length),
    decorativeRingSurfaces,
    structuredWorldEffects,
    structuredWorldEffectRatio: ratio(structuredWorldEffects, worldEffects.length),
    meshSpawnEffects,
    meshSpawnEffectRatio: ratio(meshSpawnEffects, effects.length),
    cc0AssetBackedEffects,
    cc0AssetBackedEffectRatio: ratio(cc0AssetBackedEffects, effects.length),
  }
  return {
    schema: 'game-bot.r3f-pfx-structural-quality-audit.v1',
    passed:
      summary.decorativeRingSurfaces === 0 &&
      summary.ringEffectRatio <= thresholds.maximumRingEffectRatio &&
      summary.structuredWorldEffectRatio >= thresholds.minimumStructuredWorldEffectRatio &&
      summary.meshSpawnEffectRatio >= thresholds.minimumMeshSpawnEffectRatio &&
      summary.cc0AssetBackedEffectRatio >= thresholds.minimumCc0AssetBackedEffectRatio,
    thresholds,
    summary,
    cc0Sources: PFX_CC0_ASSET_SOURCES.map((source) => ({ ...source })),
    effects,
  }
}

export const PFX_COMPONENT_DEFINITIONS: PfxComponentDefinition[] = PFX_TAXONOMY.map((effect, index) => {
  const preset = requirePreset(index)
  return {
    effectId: effect.id,
    componentName: preset.componentName,
    importName: preset.componentName,
    rank: effect.rank,
    acceptanceStatus: effect.acceptanceStatus,
    mobileSafety: effect.mobileSafety,
    performanceTier: preset.performance.tier,
    styleAffinity: effect.styleAffinity,
  }
})

export function getPfxComponentDefinition(effectId: string): PfxComponentDefinition | undefined {
  return PFX_COMPONENT_DEFINITIONS.find((definition) => definition.effectId === effectId)
}

export function createPfxPreset(effectId: string, overrides: PfxPresetOverrides = {}): PfxPreset {
  const base = PFX_PRESETS.find((preset) => preset.effectId === effectId)
  const effect = PFX_TAXONOMY.find((item) => item.id === effectId)
  if (!base) {
    throw new Error(`Unknown PFX effect id: ${effectId}`)
  }
  if (!effect) {
    throw new Error(`Missing PFX taxonomy effect for preset: ${effectId}`)
  }
  const mergedControls = {
    ...base.controls,
    ...withoutSeed(overrides),
    seed: overrides.seed ?? base.controls.seed,
  }
  const styledControls = overrides.style
    ? applyStyleVariant(mergedControls, overrides.style)
    : mergedControls
  const controls = {
    ...styledControls,
    ...(overrides.color ? { color: overrides.color } : {}),
    ...(overrides.texture ? { texture: overrides.texture } : {}),
    ...(overrides.blendMode ? { blendMode: overrides.blendMode } : {}),
    ...(overrides.emissiveBloom != null ? { emissiveBloom: overrides.emissiveBloom } : {}),
    ...(overrides.turbulence != null ? { turbulence: overrides.turbulence } : {}),
    ...(overrides.density != null ? { density: overrides.density } : {}),
  }
  const performance = createPerformanceMetadata(effect, controls)
  const quality = createQualityScore(effect, performance)

  return {
    ...base,
    id: `${base.effectId}-custom`,
    seed: overrides.seed ?? base.seed,
    controls,
    textureAtlas: getPfxTextureAtlasSlice(controls.texture),
    styleRender: createPfxStyleRender(controls),
    performance,
    quality,
    preview: previewForEffect(effect, controls),
  }
}

export function createReducedMotionPfxPreset(preset: PfxPreset): PfxPreset {
  const effect = PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  if (!effect) {
    throw new Error(`Missing PFX taxonomy effect for reduced-motion preset: ${preset.effectId}`)
  }
  const controls = createReducedMotionControls(preset.controls)
  const performance = createPerformanceMetadata(effect, controls)
  const quality = createQualityScore(effect, performance)

  return {
    ...preset,
    id: `${preset.id}-reduced-motion`,
    name: `${preset.name} Reduced Motion`,
    controls,
    textureAtlas: getPfxTextureAtlasSlice(controls.texture),
    styleRender: createPfxStyleRender(controls),
    performance: {
      ...performance,
      evidence: `${performance.evidence} reduced motion fallback: low LOD, no flipbook animation, reduced density, velocity, turbulence, trail length, and emissive intensity.`,
    },
    quality,
    preview: previewForEffect(effect, controls),
    reducedMotion: true,
  }
}

export function createPfxControlSafetyMatrix(): PfxControlSafetyMatrix {
  const effects = PFX_TAXONOMY.map((effect): PfxControlSafetyEffectEvidence => {
    const preset = createPfxPreset(effect.id)
    const defaultValidation = validatePfxPreset(preset)
    const controls = PFX_CONTROL_DEFINITIONS.map((definition) =>
      createPfxControlSafetyControlEvidence(effect.id, preset, definition),
    )
    const failureReasons = [
      ...defaultValidation.errors.map((error) => `default:${error}`),
      ...controls.flatMap((control) =>
        control.failureReasons.map((reason) => `${control.key}:${reason}`),
      ),
    ]

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      safe: defaultValidation.valid && controls.every((control) =>
        control.bounded &&
        control.defaultWithinBounds &&
        control.minVariantValid &&
        control.maxVariantValid
      ),
      controlCount: controls.length,
      defaultPresetValid: defaultValidation.valid,
      failureReasons,
      controls,
    }
  })

  const controlSummary = PFX_CONTROL_DEFINITIONS.map((definition) =>
    createPfxControlSafetyControlEvidence('fireball', createPfxPreset('fireball'), definition),
  )

  return {
    schema: 'game-bot.r3f-pfx-control-safety-matrix.v1',
    summary: {
      totalEffects: effects.length,
      controlCount: PFX_CONTROL_DEFINITIONS.length,
      effectsPassingControlSafety: effects.filter((effect) => effect.safe).length,
      controlsWithBudgetImpact: controlSummary.filter((control) => control.affectsBudget).length,
      controlsWithRenderImpact: controlSummary.filter((control) => control.affectsRenderSignature).length,
    },
    instructions: {
      approvalStatus: 'non-approving-customization-safety-evidence',
      browserSurface: 'tools/3d-pfx-library/viewer',
      operatorChecklist: [
        'Use this matrix to verify browser customization ranges before production implementation approval.',
        'Treat passing min/default/max variants as safety evidence, not final art-direction approval.',
        'Investigate any failureReasons before marking all-controls-safe in the implementation manifest.',
      ],
    },
    controls: controlSummary,
    effects,
  }
}

export function createPfxStyleDifferentiationMatrix(): PfxStyleDifferentiationMatrix {
  const effects = PFX_TAXONOMY.map((effect): PfxStyleDifferentiationEffectEvidence => {
    const variants = ART_STYLE_CLUSTERS.map((style) => createPfxStyleDifferentiationVariant(effect.id, style))
    const distinctNonColorSignatures = new Set(variants.map((variant) => variant.nonColorSignature)).size
    const failureReasons = [
      ...(variants.length === ART_STYLE_CLUSTERS.length ? [] : ['missing style variants']),
      ...(distinctNonColorSignatures === ART_STYLE_CLUSTERS.length
        ? []
        : ['style variants collapse to duplicate non-color signatures']),
    ]

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      safe: failureReasons.length === 0,
      styleCount: variants.length,
      distinctNonColorSignatures,
      failureReasons,
      variants,
    }
  })
  const styles = ART_STYLE_CLUSTERS.map((style) => createPfxStyleDifferentiationVariant('force-field', style))

  return {
    schema: 'game-bot.r3f-pfx-style-differentiation-matrix.v1',
    summary: {
      totalEffects: effects.length,
      styleCount: ART_STYLE_CLUSTERS.length,
      effectsPassingStyleDifferentiation: effects.filter((effect) => effect.safe).length,
      minimumDistinctNonColorSignatures: Math.min(
        ...effects.map((effect) => effect.distinctNonColorSignatures),
      ),
    },
    instructions: {
      approvalStatus: 'non-approving-style-differentiation-evidence',
      browserSurface: 'tools/3d-pfx-library/viewer',
      operatorChecklist: [
        'Use this matrix to verify style variants change render treatment beyond palette swaps.',
        'Treat distinct non-color signatures as implementation evidence, not final art-direction approval.',
        'Investigate duplicate signatures before claiming style-cluster differentiation in red-team review.',
      ],
    },
    styles,
    effects,
  }
}

function createPfxStyleDifferentiationVariant(
  effectId: string,
  style: ArtStyleCluster,
): PfxStyleDifferentiationVariantEvidence {
  const preset = createPfxPreset(effectId, { style })
  const profile = preset.styleRender

  return {
    style,
    nonColorSignature: profile.signature,
    texture: preset.controls.texture,
    blendMode: preset.controls.blendMode,
    silhouette: profile.silhouette,
    materialTreatment: profile.materialTreatment,
    motionTreatment: profile.motionTreatment,
    particleShape: profile.particleShape,
    geometrySegments: profile.geometrySegments,
    edgeHardness: profile.edgeHardness,
    particleSizeMultiplier: profile.particleSizeMultiplier,
  }
}

function createPfxControlSafetyControlEvidence(
  effectId: string,
  preset: PfxPreset,
  definition: PfxControlDefinition,
): PfxControlSafetyControlEvidence {
  const minPreset = createPfxPreset(effectId, createControlVariantOverride(definition, 'min'))
  const maxPreset = createPfxPreset(effectId, createControlVariantOverride(definition, 'max'))
  const minValidation = validatePfxPreset(minPreset)
  const maxValidation = validatePfxPreset(maxPreset)
  const defaultWithinBounds = controlDefaultWithinBounds(preset.controls[definition.key], definition)
  const bounded = controlDefinitionIsBounded(definition)
  const failureReasons = [
    ...(bounded ? [] : ['control has no bounded browser-safe option set or min/max range']),
    ...(defaultWithinBounds ? [] : ['default value is outside the declared browser-safe bounds']),
    ...minValidation.errors.map((error) => `min:${error}`),
    ...maxValidation.errors.map((error) => `max:${error}`),
  ]

  return {
    key: definition.key,
    label: definition.label,
    kind: definition.kind,
    bounded,
    defaultWithinBounds,
    minVariantValid: minValidation.valid,
    maxVariantValid: maxValidation.valid,
    affectsBudget: PFX_BUDGET_AFFECTING_CONTROL_KEYS.has(definition.key),
    affectsRenderSignature: PFX_RENDER_AFFECTING_CONTROL_KEYS.has(definition.key),
    failureReasons,
  }
}

export function filterPfxCatalog(filters: PfxFilterQuery = {}): PfxCatalogItem[] {
  const query = filters.query?.trim().toLowerCase()
  return PFX_TAXONOMY.map((effect, index) => ({ effect, preset: requirePreset(index) })).filter(({ effect, preset }) => {
    if (query && !matchesPfxSearchQuery(query, effect, preset)) return false
    if (filters.effectType?.length && !filters.effectType.includes(effect.effectType)) return false
    if (filters.gameplayUseCase?.length && !overlaps(filters.gameplayUseCase, effect.gameplayUseCases)) return false
    if (filters.style?.length && !overlaps(filters.style, effect.styleAffinity)) return false
    if (filters.performanceTier?.length && !filters.performanceTier.includes(preset.performance.tier)) return false
    if (filters.emotionMood?.length && !overlaps(filters.emotionMood, effect.emotionMood)) return false
    if (filters.colorFamily?.length && !overlaps(filters.colorFamily, effect.colorFamily)) return false
    if (filters.assetRequirements?.length && !overlaps(filters.assetRequirements, effect.assetRequirements)) return false
    if (filters.loopMode?.length && !filters.loopMode.includes(effect.loopMode)) return false
    if (filters.space?.length && !filters.space.includes(effect.space)) return false
    if (filters.mobileSafeOnly && effect.mobileSafety !== 'safe') return false
    if (filters.coverage?.length && !filters.coverage.includes(effect.acceptanceStatus)) return false
    return true
  })
}

export function summarizePfxPerformance(presets: readonly PfxPreset[]): PfxPerformanceSummary {
  const riskScore = { low: 0, medium: 1, high: 2 } as const
  const topRisk = presets.reduce<'low' | 'medium' | 'high'>((risk, preset) => {
    return riskScore[preset.performance.overdrawRisk] > riskScore[risk]
      ? preset.performance.overdrawRisk
      : risk
  }, 'low')

  return {
    effectCount: presets.length,
    totalParticles: presets.reduce((total, preset) => total + createPfxSimParticleCount(preset), 0),
    totalDrawCalls: presets.reduce((total, preset) => total + getPfxRenderPlan(preset).estimatedDrawCalls, 0),
    textureMemoryKb: presets.reduce((total, preset) => total + preset.performance.textureMemoryKb, 0),
    expectedFrameCostMs: roundMetric(
      presets.reduce((total, preset) => total + preset.performance.expectedFrameCostMs, 0),
    ),
    overdrawRisk: topRisk,
    mobileSafe: presets.every(
      (preset) =>
        preset.mobileSafety === 'safe' &&
        preset.performance.tier !== 'cinematic',
    ),
  }
}

export function createPfxSimParticleCount(preset: PfxPreset): number {
  return getPfxRenderPlan(preset).surfaces.reduce((total, surface) => {
    if (surface.kind !== 'particles' && surface.kind !== 'impact-sparks') return total
    return total + createPfxParticleEmission(preset, surface).count
  }, 0)
}

export function createPfxStressScenario(options: PfxStressScenarioOptions): PfxStressScenario {
  const explicitEffectIds = options.effectIds && options.repeatExplicitEffects && options.effectIds.length > 0
    ? Array.from(
        { length: options.concurrentEffects },
        (_, index) => options.effectIds![index % options.effectIds!.length]!,
      )
    : options.effectIds
  const presets = options.effectIds
    ? explicitEffectIds!.map((effectId) => createPfxPreset(effectId))
    : filterPfxCatalog(options.query)
      .map((item) => item.preset)
      .slice(0, options.concurrentEffects)
  const columns = Math.ceil(Math.sqrt(Math.max(1, presets.length)))
  const positions = presets.map((_, index): [number, number, number] => {
    const col = index % columns
    const row = Math.floor(index / columns)
    return [(col - (columns - 1) / 2) * 0.62, (row - (columns - 1) / 2) * -0.46, 0]
  })

  return {
    id: options.id,
    presets,
    positions,
    summary: summarizePfxPerformance(presets),
  }
}

export function exportPfxDeveloperDocsMarkdown(
  preset: PfxPreset,
  options: ExportSnippetOptions = {},
): string {
  const effect = PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  if (!effect) {
    throw new Error(`Cannot export developer docs for unknown effect "${preset.effectId}"`)
  }
  const snippet = exportPfxComponentSnippet(preset, options)
  const jsonPreset = exportPfxPresetJson(preset)
  const renderPlan = getPfxRenderPlan(preset)
  const qualityRows = PFX_QUALITY_RUBRIC_KEYS.map(
    (key) => `- ${developerDocsQualityLabel(key)}: ${preset.quality.scores[key]}/5`,
  ).join('\n')
  const controls = [
    `color ${preset.controls.color.join(', ')}`,
    `scale ${preset.controls.scale}`,
    `density ${preset.controls.density}`,
    `timing ${preset.controls.timing}`,
    `lifetime ${preset.controls.lifetime}`,
    `velocity ${preset.controls.velocity}`,
    `gravity ${preset.controls.gravity}`,
    `turbulence ${preset.controls.turbulence}`,
    `spawn ${preset.controls.spawnShape}`,
    `texture ${preset.controls.texture}`,
    `blend ${preset.controls.blendMode}`,
    `LOD ${preset.controls.lod.join('/')}`,
  ].join('; ')

  return `# ${preset.name}

${effect.notes}

## When To Use

${effect.gameplayUseCases.map((useCase) => `- ${useCase}`).join('\n')}

## Integration Checklist

${developerDocsIntegrationChecklist().map((item) => `- ${item}`).join('\n')}

## Component

\`\`\`tsx
${snippet.trim()}
\`\`\`

## JSON Preset

\`\`\`json
${jsonPreset}
\`\`\`

## Controls

${controls}

## Performance budget

- Tier: ${preset.performance.tier}
- Max particles: ${preset.performance.maxParticles}
- Max draw calls: ${preset.performance.maxDrawCalls}
- Texture memory: ${preset.performance.textureMemoryKb} KB
- Expected frame cost: ${preset.performance.expectedFrameCostMs} ms
- Overdraw risk: ${preset.performance.overdrawRisk}
- Render plan: ${renderPlan.profile}, ${renderPlan.estimatedDrawCalls} draw calls

## Quality rubric

${qualityRows}

## Preview Evidence

- Thumbnail: ${preset.preview.thumbnail.alt}
- Clip: ${preset.preview.clip.motion}, ${preset.preview.clip.frames} frames, ${preset.preview.clip.durationMs} ms
- Authored recipe: ${preset.authoredRecipeId ?? 'none'}

## Production caveat

${developerDocsProductionCaveat(preset)}
`
}

export function createPfxDeveloperDocsManifest(
  presets: readonly PfxPreset[] = PFX_PRESETS,
  options: ExportSnippetOptions = {},
): PfxDeveloperDocsManifest {
  const effects = presets.map((preset): PfxDeveloperDocsEffect => {
    const effect = PFX_TAXONOMY.find((item) => item.id === preset.effectId)
    if (!effect) {
      throw new Error(`Cannot export developer docs for unknown effect "${preset.effectId}"`)
    }
    const componentSnippet = exportPfxComponentSnippet(preset, options)
    const jsonPreset = exportPfxPresetJson(preset)
    const productionCaveat = developerDocsProductionCaveat(preset)

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      componentName: preset.componentName,
      documentationFileName: `${effect.id}.md`,
      gameplayUseCases: [...effect.gameplayUseCases],
      mobileSafety: effect.mobileSafety,
      acceptanceStatus: preset.acceptanceStatus,
      productionCaveat,
      integrationChecklist: developerDocsIntegrationChecklist(),
      performanceBudget: preset.performance,
      quality: preset.quality,
      componentSnippet,
      jsonPreset,
      markdown: exportPfxDeveloperDocsMarkdown(preset, options),
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-developer-docs.v1',
    summary: {
      totalEffects: effects.length,
      docsWithComponentSnippet: effects.filter((effect) => effect.componentSnippet.includes('createGamePfxComponent')).length,
      docsWithJsonPreset: effects.filter((effect) => effect.jsonPreset.includes('game-bot.r3f-pfx-preset.v1')).length,
      docsWithPerformanceBudget: effects.filter((effect) => effect.performanceBudget.maxParticles > 0).length,
      docsWithProductionCaveat: effects.filter((effect) => effect.productionCaveat.length > 0).length,
    },
    effects,
  }
}

export function exportPfxDeveloperDocsManifestJson(
  manifest: PfxDeveloperDocsManifest = createPfxDeveloperDocsManifest(),
): string {
  return JSON.stringify(manifest, null, 2)
}

export function createPfxExportCleanlinessAudit(
  presets: readonly PfxPreset[] = PFX_PRESETS,
  options: ExportSnippetOptions = {
    importPath: '@/tools/3d-pfx-library',
  },
): PfxExportCleanlinessAudit {
  const docsManifest = createPfxDeveloperDocsManifest(presets, options)
  const docsByEffectId = new Map(docsManifest.effects.map((effect) => [effect.effectId, effect]))
  const effects = presets.map((preset): PfxExportCleanlinessAuditEffect => {
    const effect = PFX_TAXONOMY.find((item) => item.id === preset.effectId)
    if (!effect) {
      throw new Error(`Cannot audit exports for unknown effect "${preset.effectId}"`)
    }
    const component = getPfxComponentDefinition(effect.id)
    const docs = docsByEffectId.get(effect.id)
    const componentSnippet = exportPfxComponentSnippet(preset, options)
    const jsonPreset = exportPfxPresetJson(preset)
    const parsedPreset = parseExportedPreset(jsonPreset)
    const componentSnippetEvidence = exportSnippetEvidence(componentSnippet, effect.id, preset.componentName)
    const jsonPresetEvidence = exportJsonPresetEvidence(parsedPreset, preset)
    const docsEvidence = exportDocsEvidence(docs, effect.id, preset.componentName)
    const forbiddenTermsAbsent = !PFX_FORBIDDEN_EXPORT_TERMS.test(
      [componentSnippet, jsonPreset, docs?.markdown ?? ''].join('\n'),
    )
    const componentSnippetValid = componentSnippetEvidence.length === 3
    const jsonPresetValid = jsonPresetEvidence.length === 3
    const docsValid = docsEvidence.length === 4
    const registryEntryValid =
      component?.effectId === effect.id &&
      component.componentName === preset.componentName &&
      component.importName === preset.componentName
    const failureReasons = [
      ...(componentSnippetValid ? [] : ['component snippet is missing required copy-paste evidence']),
      ...(jsonPresetValid ? [] : ['JSON preset is missing required schema or validation evidence']),
      ...(docsValid ? [] : ['developer docs are missing required integration evidence']),
      ...(registryEntryValid ? [] : ['component registry entry is missing or mismatched']),
      ...(forbiddenTermsAbsent ? [] : ['export text contains forbidden controlled-name terms']),
    ]

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      safe: failureReasons.length === 0,
      componentName: preset.componentName,
      componentSnippetValid,
      jsonPresetValid,
      docsValid,
      registryEntryValid,
      forbiddenTermsAbsent,
      componentSnippetEvidence,
      jsonPresetEvidence,
      docsEvidence,
      failureReasons,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-export-cleanliness-audit.v1',
    summary: {
      totalEffects: effects.length,
      componentSnippetsValid: effects.filter((effect) => effect.componentSnippetValid).length,
      jsonPresetsValid: effects.filter((effect) => effect.jsonPresetValid).length,
      docsValid: effects.filter((effect) => effect.docsValid).length,
      registryEntriesValid: effects.filter((effect) => effect.registryEntryValid).length,
      effectsPassingExportAudit: effects.filter((effect) => effect.safe).length,
    },
    instructions: {
      approvalStatus: 'non-approving-export-cleanliness-evidence',
      developerDocsFile: '.context/r3f-pfx-developer-docs.json',
      operatorChecklist: [
        'Use this audit to verify copy-paste component snippets, JSON presets, docs, and registry entries before production implementation approval.',
        'Treat passing export cleanliness as integration evidence, not final production implementation approval.',
        'Investigate failureReasons before marking documentation-export-clean or drop-in-r3f-component in the implementation manifest.',
      ],
    },
    effects,
  }
}

export function createPfxRuntimeOptimizationAudit(
  presets: readonly PfxPreset[] = PFX_PRESETS,
): PfxRuntimeOptimizationAudit {
  const effects = presets.map((preset): PfxRuntimeOptimizationAuditEffect => {
    const effect = PFX_TAXONOMY.find((item) => item.id === preset.effectId)
    if (!effect) {
      throw new Error(`Cannot audit runtime optimizations for unknown effect "${preset.effectId}"`)
    }
    const reduced = createReducedMotionPfxPreset(preset)
    const sameGeometryPreset = createPfxPreset(preset.effectId, {
      seed: preset.seed,
      density: preset.controls.density,
      lod: preset.controls.lod,
    })
    const atlasBacked =
      preset.textureAtlas.atlasId === PFX_TEXTURE_ATLAS.id &&
      preset.textureAtlas.kind === preset.controls.texture
    const sharedTextureBacked =
      getPfxSharedParticleTexture(preset.controls.texture) === getPfxSharedParticleTexture(preset.controls.texture)
    const sharedGeometryBacked = getPfxSharedGeometry(preset) === getPfxSharedGeometry(sameGeometryPreset)
    const reducedMotionBacked =
      reduced.reducedMotion === true &&
      reduced.controls.lod.includes('low') &&
      reduced.performance.maxParticles <= preset.performance.maxParticles
    const lodBacked = preset.controls.lod.length > 0 && preset.performance.evidence.includes('LOD')
    const deterministicSeed = Number.isFinite(preset.seed) && preset.performance.evidence.includes(`seed ${preset.seed}`)
    const tierConcurrencyCap = PFX_MOBILE_RUNTIME_POLICY.tierConcurrencyCaps[preset.performance.tier]
    const failureReasons = [
      ...(atlasBacked ? [] : ['texture is not backed by the shared atlas descriptor']),
      ...(sharedTextureBacked ? [] : ['shared texture cache did not reuse texture instance']),
      ...(sharedGeometryBacked ? [] : ['shared geometry cache did not reuse matching geometry']),
      ...(reducedMotionBacked ? [] : ['reduced motion fallback is missing or not cheaper']),
      ...(lodBacked ? [] : ['LOD controls are missing from performance evidence']),
      ...(deterministicSeed ? [] : ['deterministic seed is missing from performance evidence']),
      ...(tierConcurrencyCap > 0 ? [] : ['tier concurrency cap is missing from runtime policy']),
    ]

    return {
      effectId: effect.id,
      rank: effect.rank,
      name: effect.name,
      safe: failureReasons.length === 0,
      performanceTier: preset.performance.tier,
      textureAtlasKind: preset.controls.texture,
      atlasBacked,
      sharedTextureBacked,
      sharedGeometryBacked,
      reducedMotionBacked,
      lodBacked,
      deterministicSeed,
      tierConcurrencyCap,
      failureReasons,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-runtime-optimization-audit.v1',
    summary: {
      totalEffects: effects.length,
      atlasBackedEffects: effects.filter((effect) => effect.atlasBacked).length,
      sharedTextureEffects: effects.filter((effect) => effect.sharedTextureBacked).length,
      sharedGeometryEffects: effects.filter((effect) => effect.sharedGeometryBacked).length,
      reducedMotionEffects: effects.filter((effect) => effect.reducedMotionBacked).length,
      lodBackedEffects: effects.filter((effect) => effect.lodBacked).length,
      deterministicSeedEffects: effects.filter((effect) => effect.deterministicSeed).length,
      effectsPassingOptimizationAudit: effects.filter((effect) => effect.safe).length,
    },
    instructions: {
      approvalStatus: 'non-approving-mobile-runtime-optimization-evidence',
      runtimePolicyFile: '.context/r3f-pfx-mobile-runtime-policy.json',
      operatorChecklist: [
        'Use this audit to verify mobile runtime optimization hooks before production implementation approval.',
        'Treat optimization coverage as local runtime evidence, not real-device performance proof.',
        'Investigate failureReasons before approving mobile-budget-declared in implementation rows.',
      ],
    },
    policy: createPfxMobileRuntimePolicy(),
    effects,
  }
}

function exportSnippetEvidence(snippet: string, effectId: string, componentName: string): string[] {
  return [
    ...(snippet.includes('import { createGamePfxComponent }') ? ['imports createGamePfxComponent'] : []),
    ...(snippet.includes(`export function ${componentName}`) ? ['exports named R3F component'] : []),
    ...(snippet.includes(`createGamePfxComponent("${effectId}"`) ? ['uses canonical effect id'] : []),
  ]
}

function exportJsonPresetEvidence(parsedPreset: Record<string, unknown> | undefined, sourcePreset: PfxPreset): string[] {
  if (!parsedPreset) return []
  const effectId = String(parsedPreset['effectId'])
  const reconstructed = createPfxPreset(effectId, {
    ...(parsedPreset['controls'] as Partial<PfxControls>),
    seed: Number(parsedPreset['seed']),
  })
  const validation = validatePfxPreset(reconstructed)
  return [
    'parses as JSON',
    ...(parsedPreset['schema'] === 'game-bot.r3f-pfx-preset.v1' ? ['uses game-bot.r3f-pfx-preset.v1 schema'] : []),
    ...(effectId === sourcePreset.effectId && validation.valid
      ? ['validates preset controls and budgets']
      : []),
  ]
}

function exportDocsEvidence(docs: PfxDeveloperDocsEffect | undefined, effectId: string, componentName: string): string[] {
  if (!docs) return []
  return [
    ...(docs.effectId === effectId && docs.componentName === componentName ? ['matches effect registry entry'] : []),
    ...(docs.componentSnippet.includes('createGamePfxComponent') ? ['contains component snippet'] : []),
    ...(docs.jsonPreset.includes('game-bot.r3f-pfx-preset.v1') ? ['contains JSON preset'] : []),
    ...(docs.markdown.includes('Production caveat') ? ['documents production caveat'] : []),
  ]
}

export function createPfxPreviewManifest(presets: PfxPreset[] = PFX_PRESETS): PfxPreviewManifest {
  const effectsById = new Map(PFX_TAXONOMY.map((effect) => [effect.id, effect]))
  const tiers = {
    low: 0,
    medium: 0,
    high: 0,
    cinematic: 0,
  } satisfies Record<PerformanceTier, number>

  const effects = presets.map((preset): PfxPreviewManifestEntry => {
    const effect = effectsById.get(preset.effectId)
    if (!effect) {
      throw new Error(`Cannot export preview manifest for unknown effect "${preset.effectId}"`)
    }
    tiers[preset.performance.tier] += 1

    return {
      effectId: preset.effectId,
      presetId: preset.id,
      rank: effect.rank,
      name: effect.name,
      effectType: effect.effectType,
      gameplayUseCases: effect.gameplayUseCases,
      styleAffinity: effect.styleAffinity,
      marketSourceFamilies: effect.marketSourceFamilies,
      marketSourceUrls: effect.marketSourceUrls,
      thumbnail: preset.preview.thumbnail,
      thumbnailAsset: createPfxThumbnailAsset(preset, effect),
      clip: preset.preview.clip,
      clipAsset: createPfxClipAsset(preset, effect),
      styleContactSheetAsset: createPfxStyleContactSheetAsset(preset, effect),
      controlExtremesContactSheetAsset: createPfxControlExtremesContactSheetAsset(preset, effect),
      camera: preset.preview.camera,
      performance: preset.performance,
      mobileSafety: preset.mobileSafety,
      acceptanceStatus: preset.acceptanceStatus,
      authoredRecipeId: preset.authoredRecipeId,
      styleRender: preset.styleRender,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-preview-manifest.v1',
    summary: {
      totalEffects: effects.length,
      authoredPreviewEffects: effects.filter((effect) => effect.acceptanceStatus === 'authored-preview').length,
      profileBackedEffects: effects.filter((effect) => effect.acceptanceStatus === 'profile-backed').length,
      mobileSafeEffects: effects.filter((effect) => effect.mobileSafety === 'safe').length,
      tiers,
    },
    effects,
  }
}

export function exportPfxPreviewManifestJson(presets: PfxPreset[] = PFX_PRESETS): string {
  return JSON.stringify(createPfxPreviewManifest(presets), null, 2)
}

export function createPfxPreviewAssetAudit(
  manifest: PfxPreviewManifest = createPfxPreviewManifest(),
): PfxPreviewAssetAudit {
  const effects = manifest.effects.map((effect): PfxPreviewAssetAuditEffect => {
    const thumbnailValid =
      effect.thumbnailAsset.kind === 'svg' &&
      effect.thumbnailAsset.fileName.endsWith('.svg') &&
      effect.thumbnailAsset.mimeType === 'image/svg+xml' &&
      effect.thumbnailAsset.width === 256 &&
      effect.thumbnailAsset.height === 144 &&
      effect.thumbnailAsset.svg.includes('<svg')
    const clipValid =
      effect.clipAsset.kind === 'animated-svg' &&
      effect.clipAsset.fileName.endsWith('-clip.svg') &&
      effect.clipAsset.mimeType === 'image/svg+xml' &&
      effect.clipAsset.width === 256 &&
      effect.clipAsset.height === 144 &&
      effect.clipAsset.frames >= 12 &&
      effect.clipAsset.durationMs > 0 &&
      effect.clipAsset.svg.includes('<svg')
    const styleContactSheetValid =
      effect.styleContactSheetAsset.kind === 'contact-sheet-svg' &&
      effect.styleContactSheetAsset.fileName.endsWith('-style-contact-sheet.svg') &&
      effect.styleContactSheetAsset.mimeType === 'image/svg+xml' &&
      effect.styleContactSheetAsset.width === 512 &&
      effect.styleContactSheetAsset.height === 288 &&
      effect.styleContactSheetAsset.sheetType === 'style-variants' &&
      effect.styleContactSheetAsset.svg.includes('style variants')
    const controlExtremesContactSheetValid =
      effect.controlExtremesContactSheetAsset.kind === 'contact-sheet-svg' &&
      effect.controlExtremesContactSheetAsset.fileName.endsWith('-control-extremes-contact-sheet.svg') &&
      effect.controlExtremesContactSheetAsset.mimeType === 'image/svg+xml' &&
      effect.controlExtremesContactSheetAsset.width === 512 &&
      effect.controlExtremesContactSheetAsset.height === 288 &&
      effect.controlExtremesContactSheetAsset.sheetType === 'control-extremes' &&
      effect.controlExtremesContactSheetAsset.svg.includes('control extremes')
    const dataUriValid =
      effect.thumbnailAsset.dataUri.startsWith('data:image/svg+xml') &&
      effect.clipAsset.dataUri.startsWith('data:image/svg+xml') &&
      effect.styleContactSheetAsset.dataUri.startsWith('data:image/svg+xml') &&
      effect.controlExtremesContactSheetAsset.dataUri.startsWith('data:image/svg+xml')
    const accessible =
      effect.thumbnail.alt.includes(effect.name) &&
      effect.thumbnailAsset.svg.includes('aria-label') &&
      effect.thumbnailAsset.svg.includes(effect.name) &&
      effect.clipAsset.svg.includes('aria-label') &&
      effect.clipAsset.svg.includes(effect.name) &&
      effect.styleContactSheetAsset.svg.includes('aria-label') &&
      effect.styleContactSheetAsset.svg.includes(effect.name) &&
      effect.controlExtremesContactSheetAsset.svg.includes('aria-label') &&
      effect.controlExtremesContactSheetAsset.svg.includes(effect.name)
    const animated = effect.clipAsset.svg.includes('<animate')
    const failureReasons = [
      ...(thumbnailValid ? [] : ['invalid thumbnail SVG asset']),
      ...(clipValid ? [] : ['invalid animated clip SVG asset']),
      ...(styleContactSheetValid ? [] : ['invalid style contact sheet SVG asset']),
      ...(controlExtremesContactSheetValid ? [] : ['invalid control extremes contact sheet SVG asset']),
      ...(dataUriValid ? [] : ['missing SVG data URI']),
      ...(accessible ? [] : ['missing accessible preview labels']),
      ...(animated ? [] : ['clip asset has no SVG animation']),
    ]

    return {
      effectId: effect.effectId,
      rank: effect.rank,
      name: effect.name,
      safe: failureReasons.length === 0,
      thumbnailFileName: effect.thumbnailAsset.fileName,
      clipFileName: effect.clipAsset.fileName,
      styleContactSheetFileName: effect.styleContactSheetAsset.fileName,
      controlExtremesContactSheetFileName: effect.controlExtremesContactSheetAsset.fileName,
      thumbnailValid,
      clipValid,
      styleContactSheetValid,
      controlExtremesContactSheetValid,
      dataUriValid,
      accessible,
      animated,
      width: effect.thumbnailAsset.width,
      height: effect.thumbnailAsset.height,
      clipFrames: effect.clipAsset.frames,
      clipDurationMs: effect.clipAsset.durationMs,
      failureReasons,
    }
  })

  return {
    schema: 'game-bot.r3f-pfx-preview-asset-audit.v1',
    summary: {
      totalEffects: effects.length,
      thumbnailAssets: effects.filter((effect) => effect.thumbnailValid).length,
      clipAssets: effects.filter((effect) => effect.clipValid).length,
      styleContactSheetAssets: effects.filter((effect) => effect.styleContactSheetValid).length,
      controlExtremesContactSheetAssets: effects.filter((effect) => effect.controlExtremesContactSheetValid).length,
      animatedClipAssets: effects.filter((effect) => effect.animated).length,
      accessibleAssets: effects.filter((effect) => effect.accessible).length,
      effectsPassingPreviewAudit: effects.filter((effect) => effect.safe).length,
    },
    instructions: {
      approvalStatus: 'non-approving-preview-asset-evidence',
      previewManifestFile: '.context/r3f-pfx-preview-assets/preview-manifest.json',
      operatorChecklist: [
        'Use this audit to verify every effect has generated thumbnail, animated clip, style contact sheet, and control-extremes contact sheet evidence before production implementation approval.',
        'Treat passing generated SVG assets and contact sheets as preview coverage, not final captured gameplay footage.',
        'Investigate failureReasons before marking preview-asset-exported in the implementation manifest.',
      ],
    },
    effects,
  }
}

export function createEmptyReadinessStatusCounts(): Record<PfxProductionReadinessStatus, number> {
  return {
    'production-ready': 0,
    'approved-deferral': 0,
    'needs-production-implementation': 0,
    'needs-device-profiling': 0,
    'needs-red-team-signoff': 0,
    'needs-production-approval': 0,
  }
}

export function createProductionApprovalRowFindings(approvals: readonly PfxProductionApproval[]): string[] {
  const approvalEffectIds = approvals.map((approval) => approval.effectId)
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const duplicateApprovalEffectIds = duplicateValues(approvalEffectIds)
  const unknownApprovalEffectIds = approvalEffectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  return [
    ...(duplicateApprovalEffectIds.length > 0
      ? [`production approval manifest has duplicate effect rows: ${duplicateApprovalEffectIds.join(', ')}`]
      : []),
    ...(unknownApprovalEffectIds.length > 0
      ? [`production approval manifest has unknown effect rows: ${unknownApprovalEffectIds.join(', ')}`]
      : []),
    ...approvals
      .filter((approval) => !hasProductionApprovalEvidenceForDecision(approval))
      .map(
        (approval) =>
          `production approval for ${approval.effectId} ${approval.decision} evidence must exactly match canonical references`,
      ),
    ...approvals
      .filter(
        (approval) =>
          !hasValidProductionApprovalMetadata(approval) && !isCanonicalPendingProductionApprovalTemplateRow(approval),
      )
      .map(
        (approval) =>
          `production approval for ${approval.effectId} must include final approvedBy, ISO approvedAt, and substantive rationale`,
      ),
    ...approvals
      .filter((approval) => isFinalApprovalText(approval.rationale) && !hasSubstantiveProductionApprovalRationale(approval))
      .map(
        (approval) =>
          `production approval for ${approval.effectId} must include substantive rationale covering ${productionApprovalRationaleBasisLabel(approval.decision)}`,
      ),
  ]
}

function isCanonicalPendingProductionApprovalTemplateRow(approval: PfxProductionApproval): boolean {
  return (
    approval.decision === 'production-ready' &&
    approval.approvedBy === 'TODO:final-production-approver' &&
    approval.approvedAt === 'TODO:ISO-8601' &&
    approval.rationale ===
      'TODO:describe taxonomy review, production implementation, measured mobile performance, and red-team signoff.' &&
    hasRequiredProductionReadyApprovalEvidence(approval)
  )
}

function hasProductionApprovalEvidenceForDecision(approval: PfxProductionApproval): boolean {
  return approval.decision === 'production-ready'
    ? hasRequiredProductionReadyApprovalEvidence(approval)
    : hasRequiredDeferralApprovalEvidence(approval)
}

export function createProductionImplementationRowFindings(
  implementations: readonly PfxProductionImplementationReview[],
): string[] {
  const implementationEffectIds = implementations.map((implementation) => implementation.effectId)
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const duplicateImplementationEffectIds = duplicateValues(implementationEffectIds)
  const unknownImplementationEffectIds = implementationEffectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  return [
    ...(duplicateImplementationEffectIds.length > 0
      ? [`production implementation manifest has duplicate effect rows: ${duplicateImplementationEffectIds.join(', ')}`]
      : []),
    ...(unknownImplementationEffectIds.length > 0
      ? [`production implementation manifest has unknown effect rows: ${unknownImplementationEffectIds.join(', ')}`]
      : []),
    ...implementations
      .filter(
        (implementation) =>
          implementation.status === 'production-ready' &&
          (!isFinalApprovalText(implementation.implementedBy) || !isIsoTimestamp(implementation.implementedAt)),
      )
      .map(
        (implementation) =>
          `production implementation for ${implementation.effectId} must include final implementedBy and ISO implementedAt`,
      ),
    ...implementations
      .filter(
        (implementation) =>
          implementation.status === 'production-ready' &&
          implementation.blockerFindings.length > 0,
      )
      .map(
        (implementation) =>
          `production implementation for ${implementation.effectId} must clear blockerFindings before production-ready status`,
      ),
    ...implementations
      .filter(
        (implementation) =>
          implementation.status === 'production-ready' &&
          !PFX_PRODUCTION_IMPLEMENTATION_CRITERIA.every(
            (criterion) => implementation.criteria[criterion] === 'pass',
          ),
      )
      .map(
        (implementation) =>
          `production implementation for ${implementation.effectId} must pass every required implementation criterion before production-ready status`,
      ),
    ...implementations
      .filter(
        (implementation) =>
          implementation.status === 'production-ready' &&
          isFinalApprovalText(implementation.sourcePath) &&
          implementation.sourcePath !== canonicalProductionImplementationSourcePath(implementation.effectId),
      )
      .map(
        (implementation) =>
          `production implementation for ${implementation.effectId} sourcePath must be ${canonicalProductionImplementationSourcePath(implementation.effectId)}`,
      ),
    ...implementations
      .filter(
        (implementation) =>
          implementation.status === 'production-ready' &&
          isFinalApprovalText(implementation.notes) &&
          !hasSubstantiveProductionImplementationNotes(implementation.notes),
      )
      .map(
        (implementation) =>
          `production implementation for ${implementation.effectId} must include substantive implementation notes`,
      ),
  ]
}

export function createRedTeamReviewRowFindings(reviews: readonly PfxRedTeamEffectReview[]): string[] {
  const reviewEffectIds = reviews.map((review) => review.effectId)
  const acceptedEffectIds = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const duplicateReviewEffectIds = duplicateValues(reviewEffectIds)
  const unknownReviewEffectIds = reviewEffectIds.filter((effectId) => !acceptedEffectIds.has(effectId))
  const weakSignoffNoteEffectIds = reviews
    .filter(
      (review) =>
        (review.status === 'signed-off' || review.status === 'approved-deferral') &&
        !hasSubstantiveRedTeamReviewNotes(review.notes),
    )
    .map((review) => review.effectId)
  return [
    ...(duplicateReviewEffectIds.length > 0
      ? [`red-team review manifest has duplicate effect rows: ${duplicateReviewEffectIds.join(', ')}`]
      : []),
    ...(unknownReviewEffectIds.length > 0
      ? [`red-team review manifest has unknown effect rows: ${unknownReviewEffectIds.join(', ')}`]
      : []),
    ...reviews
      .filter(
        (review) =>
          (review.status === 'signed-off' || review.status === 'approved-deferral') &&
          (!isFinalApprovalText(review.reviewer) || !isIsoTimestamp(review.reviewedAt)),
      )
      .map((review) => `red-team review for ${review.effectId} must include final reviewer and ISO reviewedAt`),
    ...reviews
      .filter(
        (review) =>
          (review.status === 'signed-off' || review.status === 'approved-deferral') &&
          review.blockerFindings.length > 0,
      )
      .map((review) => `red-team review for ${review.effectId} must clear blockerFindings before signoff`),
    ...reviews
      .filter(
        (review) =>
          (review.status === 'signed-off' || review.status === 'approved-deferral') &&
          !PFX_RED_TEAM_CRITERIA.every((criterion) => review.criteria[criterion] === 'pass'),
      )
      .map(
        (review) =>
          `red-team review for ${review.effectId} must pass every required adversarial criterion before signoff`,
      ),
    ...weakSignoffNoteEffectIds.map(
      (effectId) => `red-team review for ${effectId} must include substantive adversarial notes`,
    ),
  ]
}

export function createRedTeamReviewerIndependenceFindings(
  implementations: readonly PfxProductionImplementationReview[],
  reviews: readonly PfxRedTeamEffectReview[],
): string[] {
  const implementationsByEffectId = new Map(implementations.map((implementation) => [implementation.effectId, implementation]))
  return reviews.flatMap((review) => {
    const implementation = implementationsByEffectId.get(review.effectId)
    if (!implementationAndReviewShareActor(implementation, review)) return []
    return [`red-team reviewer ${review.reviewer} also approved implementation for ${review.effectId}`]
  })
}

export function createFinalApprovalIndependenceFindings(
  approvals: readonly PfxProductionApproval[],
  implementations: readonly PfxProductionImplementationReview[],
  reviews: readonly PfxRedTeamEffectReview[],
): string[] {
  const implementationsByEffectId = new Map(implementations.map((implementation) => [implementation.effectId, implementation]))
  const reviewsByEffectId = new Map(reviews.map((review) => [review.effectId, review]))
  return approvals.flatMap((approval) => {
    if (!hasValidProductionApprovalMetadata(approval)) return []
    const implementation = implementationsByEffectId.get(approval.effectId)
    const review = reviewsByEffectId.get(approval.effectId)
    const findings: string[] = []
    if (approvalAndImplementationShareActor(approval, implementation)) {
      findings.push(`final approver ${approval.approvedBy} also approved implementation for ${approval.effectId}`)
    }
    if (approvalAndReviewShareActor(approval, review)) {
      findings.push(`final approver ${approval.approvedBy} also signed red-team review for ${approval.effectId}`)
    }
    return findings
  })
}

export function implementationAndReviewShareActor(
  implementation: PfxProductionImplementationReview | undefined,
  review: PfxRedTeamEffectReview | undefined,
): boolean {
  if (!implementation || !review) return false
  if (!isProductionImplementationReady(implementation) || !isRedTeamReviewComplete(review)) return false
  return normalizeReviewActor(implementation.implementedBy) === normalizeReviewActor(review.reviewer)
}

export function approvalSharesActorWithImplementationOrRedTeam(
  approval: PfxProductionApproval | undefined,
  implementation: PfxProductionImplementationReview | undefined,
  review: PfxRedTeamEffectReview | undefined,
): boolean {
  return approvalAndImplementationShareActor(approval, implementation) || approvalAndReviewShareActor(approval, review)
}

function approvalAndImplementationShareActor(
  approval: PfxProductionApproval | undefined,
  implementation: PfxProductionImplementationReview | undefined,
): boolean {
  if (!approval || !implementation) return false
  if (!hasValidProductionApprovalMetadata(approval) || !isProductionImplementationReady(implementation)) return false
  return normalizeReviewActor(approval.approvedBy) === normalizeReviewActor(implementation.implementedBy)
}

function approvalAndReviewShareActor(
  approval: PfxProductionApproval | undefined,
  review: PfxRedTeamEffectReview | undefined,
): boolean {
  if (!approval || !review) return false
  if (!hasValidProductionApprovalMetadata(approval) || !isRedTeamReviewComplete(review)) return false
  return normalizeReviewActor(approval.approvedBy) === normalizeReviewActor(review.reviewer)
}

function normalizeReviewActor(value: string): string {
  return value.trim().toLowerCase()
}

export function createStandaloneEvidenceIdFindings(label: string, unknownEffectIds: readonly string[]): string[] {
  return unknownEffectIds.length > 0 ? [`${label} references unknown effect ids: ${unknownEffectIds.join(', ')}`] : []
}

export function createStandaloneEvidenceDuplicateFindings(label: string, duplicateEffectIds: readonly string[]): string[] {
  return duplicateEffectIds.length > 0 ? [`${label} has duplicate effect ids: ${duplicateEffectIds.join(', ')}`] : []
}

export function createPartialRealDeviceProfileEvidenceFindings(
  mobileSafariProfiledEffectIds: ReadonlySet<string>,
  chromeAndroidProfiledEffectIds: ReadonlySet<string>,
  acceptedEffectIds: ReadonlySet<string>,
): string[] {
  return [...acceptedEffectIds]
    .filter(
      (effectId) =>
        mobileSafariProfiledEffectIds.has(effectId) !== chromeAndroidProfiledEffectIds.has(effectId),
    )
    .map(
      (effectId) =>
        `real-device profile evidence for ${effectId} must include both mobile Safari and Chrome Android profiles`,
    )
}

export function expectedProductionEvidence(
  kind: Exclude<PfxProductionAcceptanceGapKind, 'approval-metadata'>,
  effectId: string,
): string {
  if (kind === 'taxonomy-review') {
    return `taxonomy-review:.context/r3f-pfx-taxonomy-review.json#${effectId}`
  }
  if (kind === 'production-implementation') {
    return `production-implementation:.context/r3f-pfx-production-implementation.json#${effectId}`
  }
  if (kind === 'mobile-safari-profile') return `mobile-safari-profile:.context/mobile-safari/${effectId}.json`
  if (kind === 'chrome-android-profile') return `chrome-android-profile:.context/chrome-android/${effectId}.json`
  if (kind === 'approved-deferral') return `approved-deferral:.context/r3f-pfx-red-team-review.json#${effectId}`
  return `red-team-signoff:.context/r3f-pfx-red-team-review.json#${effectId}`
}

export function hasRequiredProductionReadyApprovalEvidence(approval: PfxProductionApproval | undefined): boolean {
  const effectId = approval?.effectId
  if (!effectId) return false
  return approvalEvidenceExactlyMatches(approval, [
    expectedProductionEvidence('taxonomy-review', effectId),
    expectedProductionEvidence('production-implementation', effectId),
    expectedProductionEvidence('mobile-safari-profile', effectId),
    expectedProductionEvidence('chrome-android-profile', effectId),
    expectedProductionEvidence('red-team-signoff', effectId),
  ])
}

export function hasRequiredDeferralApprovalEvidence(approval: PfxProductionApproval | undefined): boolean {
  const effectId = approval?.effectId
  return Boolean(
    effectId &&
      approvalEvidenceExactlyMatches(approval, [
        expectedProductionEvidence('taxonomy-review', effectId),
        expectedProductionEvidence('approved-deferral', effectId),
        expectedProductionEvidence('red-team-signoff', effectId),
      ]),
  )
}

function approvalEvidenceExactlyMatches(approval: PfxProductionApproval | undefined, expectedEvidence: string[]): boolean {
  return (
    approval?.evidence.length === expectedEvidence.length &&
    expectedEvidence.every((expected, index) => approval.evidence[index] === expected)
  )
}

export function hasValidProductionApprovalMetadata(approval: PfxProductionApproval | undefined): boolean {
  return (
    approval != null &&
    isFinalApprovalText(approval.approvedBy) &&
    isIsoTimestamp(approval.approvedAt) &&
    hasSubstantiveProductionApprovalRationale(approval)
  )
}

function isFinalApprovalText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0 && !value.trim().toLowerCase().startsWith('todo:')
}

function hasSubstantiveProductionApprovalRationale(approval: PfxProductionApproval): boolean {
  if (!isFinalApprovalText(approval.rationale)) return false
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

function productionApprovalRationaleBasisLabel(decision: PfxProductionApprovalDecision): string {
  return decision === 'approved-deferral'
    ? 'taxonomy, deferral, and red-team evidence'
    : 'taxonomy, implementation, mobile profile, and red-team evidence'
}

function isIsoTimestamp(value: string | undefined): boolean {
  if (!isFinalApprovalText(value)) return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

export function isProductionImplementationReady(implementation: PfxProductionImplementationReview): boolean {
  return (
    implementation.status === 'production-ready' &&
    isFinalApprovalText(implementation.implementedBy) &&
    isIsoTimestamp(implementation.implementedAt) &&
    implementation.sourcePath === canonicalProductionImplementationSourcePath(implementation.effectId) &&
    hasSubstantiveProductionImplementationNotes(implementation.notes) &&
    PFX_PRODUCTION_IMPLEMENTATION_CRITERIA.every(
      (criterion) => implementation.criteria[criterion] === 'pass',
    ) &&
    implementation.blockerFindings.length === 0
  )
}

function canonicalProductionImplementationSourcePath(effectId: string): string {
  return `tools/3d-pfx-library/src/index.tsx#${effectId}`
}

function hasSubstantiveProductionImplementationNotes(value: string | undefined): boolean {
  if (!isFinalApprovalText(value)) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized.length >= 48 &&
    PFX_PRODUCTION_IMPLEMENTATION_NOTE_TERMS.some((term) => normalized.includes(term))
  )
}

export function isRedTeamReviewComplete(review: PfxRedTeamEffectReview): boolean {
  return (
    (review.status === 'signed-off' || review.status === 'approved-deferral') &&
    isFinalApprovalText(review.reviewer) &&
    isIsoTimestamp(review.reviewedAt) &&
    hasSubstantiveRedTeamReviewNotes(review.notes) &&
    PFX_RED_TEAM_CRITERIA.every((criterion) => review.criteria[criterion] === 'pass') &&
    review.blockerFindings.length === 0
  )
}

function hasSubstantiveRedTeamReviewNotes(value: string | undefined): boolean {
  if (!isFinalApprovalText(value)) return false
  const normalized = value.trim().toLowerCase()
  return (
    normalized.length >= 48 &&
    PFX_RED_TEAM_NOTE_ACTION_TERMS.some((term) => normalized.includes(term)) &&
    redTeamNoteDimensionCoverage(normalized) >= 4
  )
}

export function resolveProductionReadinessStatus(input: {
  productionReady: boolean
  approvedDeferral: boolean
  hasProductionImplementation: boolean
  realDeviceProfiled: boolean
  redTeamSignedOff: boolean
  hasFinalApprovalMetadata: boolean
  approval?: PfxProductionApproval
}): PfxProductionReadinessStatus {
  if (input.productionReady) return 'production-ready'
  if (input.approvedDeferral) return 'approved-deferral'
  if (!input.hasProductionImplementation) return 'needs-production-implementation'
  if (!input.realDeviceProfiled) return 'needs-device-profiling'
  if (!input.redTeamSignedOff) return 'needs-red-team-signoff'
  if (input.approval && !input.hasFinalApprovalMetadata) return 'needs-production-approval'
  if (!input.approval) return 'needs-production-approval'
  return 'needs-production-approval'
}

export function createPfxThumbnailAsset(preset: PfxPreset, effect?: PfxTaxonomyEffect): PfxThumbnailAsset {
  const source = effect ?? PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  const name = source?.name ?? preset.name
  const width = 256
  const height = 144
  const colors = normalizeThumbnailColors(preset.controls.color)
  const [primaryColor, secondaryColor, accentColor] = colors
  const title = escapeXml(name)
  const effectType = escapeXml(source?.effectType ?? preset.implementationProfile)
  const motion = escapeXml(preset.preview.clip.motion)
  const tier = escapeXml(preset.performance.tier)
  const particleCount = Math.max(6, Math.min(18, Math.round(preset.performance.maxParticles / 36)))
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = ((index * 137.5 + preset.seed) % 360) * (Math.PI / 180)
    const radius = 14 + ((index * 19 + preset.seed) % 46)
    const cx = 128 + Math.cos(angle) * radius * (preset.controls.spawnShape === 'line' ? 1.35 : 1)
    const cy = 72 + Math.sin(angle) * radius * (preset.controls.spawnShape === 'ring' ? 0.65 : 1)
    const size = 2.5 + ((index + preset.seed) % 5)
    const color = colors[index % colors.length] ?? primaryColor
    const opacity = 0.36 + ((index % 5) * 0.1)
    return `<circle cx="${roundSvg(cx)}" cy="${roundSvg(cy)}" r="${roundSvg(size)}" fill="${escapeXml(color)}" opacity="${roundSvg(opacity)}" />`
  }).join('')
  const accentStroke = preset.controls.blendMode === 'additive' ? secondaryColor : accentColor
  const densityRing = Math.max(22, Math.min(58, preset.performance.maxParticles / 8))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} ${effectType} particle preview" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${title}</title>
  <desc>${title} ${motion} preview, ${tier} tier, ${preset.performance.maxParticles} particles.</desc>
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="72%">
      <stop offset="0%" stop-color="${escapeXml(primaryColor)}" stop-opacity="0.9" />
      <stop offset="52%" stop-color="${escapeXml(secondaryColor)}" stop-opacity="0.38" />
      <stop offset="100%" stop-color="#0f172a" stop-opacity="1" />
    </radialGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" rx="14" fill="url(#bg)" />
  <circle cx="128" cy="72" r="${roundSvg(densityRing)}" fill="${escapeXml(primaryColor)}" opacity="0.18" filter="url(#soft)" />
  <circle cx="128" cy="72" r="${roundSvg(densityRing * 0.62)}" fill="none" stroke="${escapeXml(accentStroke)}" stroke-width="3" stroke-opacity="0.58" />
  ${particles}
  <path d="M24 113 C68 94 87 126 128 104 C166 83 188 106 232 87" fill="none" stroke="${escapeXml(accentColor)}" stroke-width="2" stroke-linecap="round" stroke-opacity="0.62" />
  <text x="18" y="28" fill="#f8fafc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700">${title}</text>
  <text x="18" y="126" fill="#dbeafe" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10">${effectType} / ${tier}</text>
</svg>`

  return {
    kind: 'svg',
    fileName: `${preset.effectId}.svg`,
    mimeType: 'image/svg+xml',
    width,
    height,
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  }
}

export function createPfxClipAsset(preset: PfxPreset, effect?: PfxTaxonomyEffect): PfxClipAsset {
  const source = effect ?? PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  const name = source?.name ?? preset.name
  const width = 256
  const height = 144
  const colors = normalizeThumbnailColors(preset.controls.color)
  const [primaryColor, secondaryColor, accentColor] = colors
  const title = escapeXml(name)
  const effectType = escapeXml(source?.effectType ?? preset.implementationProfile)
  const durationSeconds = Math.max(0.24, preset.preview.clip.durationMs / 1000)
  const motion = preset.preview.clip.motion
  const motionPath = clipMotionPath(motion)
  const radius = Math.max(18, Math.min(54, preset.performance.maxParticles / 9))
  const pulseScale = motion === 'pulse' || motion === 'burst' ? '0.72;1.18;0.72' : '0.92;1.05;0.92'
  const rotation = motion === 'orbit' ? '0 128 72;360 128 72' : '-12 128 72;12 128 72;-12 128 72'
  const particleCount = Math.max(5, Math.min(12, Math.round(preset.preview.clip.frames / 4)))
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const angle = ((index * 360) / particleCount + preset.seed) * (Math.PI / 180)
    const x = 128 + Math.cos(angle) * radius
    const y = 72 + Math.sin(angle) * radius * 0.7
    const color = colors[index % colors.length] ?? primaryColor
    const begin = roundSvg((index / particleCount) * durationSeconds)
    return `<circle cx="${roundSvg(x)}" cy="${roundSvg(y)}" r="${roundSvg(3 + (index % 4))}" fill="${escapeXml(color)}" opacity="0.75">
      <animate attributeName="opacity" values="0.15;0.9;0.15" dur="${roundSvg(durationSeconds)}s" begin="${begin}s" repeatCount="indefinite" />
      <animateTransform attributeName="transform" type="scale" additive="sum" values="0.65;1.35;0.65" dur="${roundSvg(durationSeconds)}s" begin="${begin}s" repeatCount="indefinite" />
    </circle>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} ${effectType} animated particle clip" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${title} Animated Clip</title>
  <desc>${title} ${escapeXml(motion)} clip, ${preset.preview.clip.frames} frames over ${preset.preview.clip.durationMs} ms.</desc>
  <defs>
    <radialGradient id="clip-bg" cx="50%" cy="45%" r="76%">
      <stop offset="0%" stop-color="${escapeXml(primaryColor)}" stop-opacity="0.68" />
      <stop offset="58%" stop-color="${escapeXml(secondaryColor)}" stop-opacity="0.24" />
      <stop offset="100%" stop-color="#020617" stop-opacity="1" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="14" fill="url(#clip-bg)" />
  <g>
    <animateMotion dur="${roundSvg(durationSeconds)}s" repeatCount="indefinite" path="${motionPath}" />
    <animateTransform attributeName="transform" type="scale" additive="sum" values="${pulseScale}" dur="${roundSvg(durationSeconds)}s" repeatCount="indefinite" />
    <circle cx="128" cy="72" r="${roundSvg(radius * 0.55)}" fill="${escapeXml(primaryColor)}" opacity="0.34" />
    <circle cx="128" cy="72" r="${roundSvg(radius * 0.9)}" fill="none" stroke="${escapeXml(accentColor)}" stroke-width="3" stroke-opacity="0.58" />
    ${particles}
  </g>
  <g>
    <animateTransform attributeName="transform" type="rotate" values="${rotation}" dur="${roundSvg(durationSeconds)}s" repeatCount="indefinite" />
    <path d="M42 100 C77 69 112 119 150 82 C178 55 198 81 224 54" fill="none" stroke="${escapeXml(accentColor)}" stroke-width="2.5" stroke-linecap="round" stroke-opacity="0.68" />
  </g>
  <text x="18" y="28" fill="#f8fafc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="14" font-weight="700">${title}</text>
  <text x="18" y="126" fill="#bfdbfe" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10">${effectType} / ${escapeXml(motion)} / ${preset.preview.clip.frames}f</text>
</svg>`

  return {
    kind: 'animated-svg',
    fileName: `${preset.effectId}-clip.svg`,
    mimeType: 'image/svg+xml',
    width,
    height,
    frames: preset.preview.clip.frames,
    durationMs: preset.preview.clip.durationMs,
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  }
}

export function createPfxStyleContactSheetAsset(
  preset: PfxPreset,
  effect?: PfxTaxonomyEffect,
): PfxContactSheetAsset {
  const source = effect ?? PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  const name = source?.name ?? preset.name
  const width = 512
  const height = 288
  const title = escapeXml(`${name} style variants`)
  const colors = normalizeThumbnailColors(preset.controls.color)
  const cells = ART_STYLE_CLUSTERS.map((style, index) => {
    const variant = createPfxStyleDifferentiationVariant(preset.effectId, style)
    const x = 18 + (index % 6) * 80
    const y = 52 + Math.floor(index / 6) * 68
    const color = colors[index % colors.length] ?? colors[0]
    const accent = colors[(index + 1) % colors.length] ?? color
    const label = escapeXml(style)
    return `<g>
      <rect x="${x}" y="${y}" width="62" height="46" rx="8" fill="#0f172a" stroke="${escapeXml(accent)}" stroke-opacity="0.62" />
      <circle cx="${x + 20}" cy="${y + 20}" r="${roundSvg(7 * variant.particleSizeMultiplier)}" fill="${escapeXml(color)}" opacity="0.78" />
      <path d="M${x + 30} ${y + 29} C${x + 38} ${y + 12} ${x + 45} ${y + 38} ${x + 55} ${y + 18}" fill="none" stroke="${escapeXml(accent)}" stroke-width="2" stroke-linecap="round" opacity="0.72" />
      <text x="${x + 4}" y="${y + 60}" fill="#cbd5e1" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="8">${label}</text>
    </g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} contact sheet" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${title}</title>
  <desc>${title}: rendered preview contact sheet for all ${ART_STYLE_CLUSTERS.length} art-style clusters.</desc>
  <rect width="${width}" height="${height}" rx="18" fill="#020617" />
  <text x="18" y="28" fill="#f8fafc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="700">${title}</text>
  <text x="18" y="274" fill="#94a3b8" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10">style variants / non-color render signatures / reviewer contact sheet</text>
  ${cells}
</svg>`

  return {
    kind: 'contact-sheet-svg',
    fileName: `${preset.effectId}-style-contact-sheet.svg`,
    mimeType: 'image/svg+xml',
    width,
    height,
    sheetType: 'style-variants',
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  }
}

export function createPfxControlExtremesContactSheetAsset(
  preset: PfxPreset,
  effect?: PfxTaxonomyEffect,
): PfxContactSheetAsset {
  const source = effect ?? PFX_TAXONOMY.find((item) => item.id === preset.effectId)
  const name = source?.name ?? preset.name
  const width = 512
  const height = 288
  const title = escapeXml(`${name} control extremes`)
  const colors = normalizeThumbnailColors(preset.controls.color)
  const renderImpactControls = PFX_CONTROL_DEFINITIONS.filter((definition) =>
    PFX_RENDER_AFFECTING_CONTROL_KEYS.has(definition.key),
  ).slice(0, 12)
  const cells = renderImpactControls.map((definition, index) => {
    const x = 18 + (index % 4) * 120
    const y = 54 + Math.floor(index / 4) * 62
    const color = colors[index % colors.length] ?? colors[0]
    const accent = colors[(index + 1) % colors.length] ?? color
    const label = escapeXml(definition.key)
    return `<g>
      <rect x="${x}" y="${y}" width="102" height="44" rx="8" fill="#0f172a" stroke="${escapeXml(accent)}" stroke-opacity="0.58" />
      <circle cx="${x + 20}" cy="${y + 22}" r="5" fill="${escapeXml(color)}" opacity="0.42" />
      <circle cx="${x + 50}" cy="${y + 22}" r="8" fill="${escapeXml(color)}" opacity="0.68" />
      <circle cx="${x + 82}" cy="${y + 22}" r="11" fill="${escapeXml(color)}" opacity="0.9" />
      <text x="${x + 6}" y="${y + 38}" fill="#cbd5e1" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="8">${label}</text>
    </g>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title} contact sheet" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <title>${title}</title>
  <desc>${title}: min/default/max contact sheet for render-impact customization controls.</desc>
  <rect width="${width}" height="${height}" rx="18" fill="#020617" />
  <text x="18" y="28" fill="#f8fafc" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="16" font-weight="700">${title}</text>
  <text x="18" y="274" fill="#94a3b8" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="10">min/default/max render-impact controls / reviewer contact sheet</text>
  ${cells}
</svg>`

  return {
    kind: 'contact-sheet-svg',
    fileName: `${preset.effectId}-control-extremes-contact-sheet.svg`,
    mimeType: 'image/svg+xml',
    width,
    height,
    sheetType: 'control-extremes',
    svg,
    dataUri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  }
}

export function getPfxRenderPlan(
  preset: Pick<PfxPreset, 'effectId' | 'implementationProfile' | 'controls'>,
  options: PfxRenderPlanOptions = {},
): PfxRenderPlan {
  const recipe = options.recipeOverride ?? AUTHORED_EFFECT_RECIPES[preset.effectId]
  if (recipe) {
    const effect = PFX_TAXONOMY.find((entry) => entry.id === preset.effectId)
    const surfaces = normalizePfxRenderSurfaces(effect, recipe.surfaces).map((surface) => ({
      ...surface,
      scale: surface.scale * preset.controls.scale,
    }))
    const signature = surfaces.map((surface) => `${surface.kind}:${surface.role}:${surface.phase ?? 'base'}`).join('|')
    return {
      effectId: preset.effectId,
      profile: preset.implementationProfile,
      authoredRecipeId: recipe.id,
      signature,
      surfaces,
      estimatedDrawCalls: surfaces.length,
      // v2-only landing: every shipped recipe is v2; the v1 look is retired.
      feelVersion: recipe.feelVersion ?? 2,
      tempo: recipe.tempo ?? 1,
    }
  }

  const surfaces: PfxRenderSurface[] = []
  const add = (surface: Omit<PfxRenderSurface, 'phase'> & { phase?: string }) =>
    surfaces.push({
      ...surface,
      phase: surface.phase ?? createProfileBackedPhase(preset.effectId, surface),
    })
  const scale = preset.controls.scale

  if (preset.implementationProfile === 'directional-burst') {
    add({ kind: 'particles', role: 'body', opacity: 0.88, scale })
    add({ kind: 'core-sphere', role: 'body', opacity: 0.72, scale: scale * 0.34 })
    add({ kind: 'trail-ribbon', role: 'trail', opacity: 0.54, scale: scale * Math.max(0.4, preset.controls.trailLength) })
  } else if (preset.implementationProfile === 'radial-burst') {
    add({ kind: 'particles', role: 'impact', opacity: 0.9, scale })
    add({ kind: 'shockwave-ring', role: 'impact', opacity: 0.46, scale: scale * 1.35 })
    add({ kind: 'impact-sparks', role: 'impact', opacity: 0.82, scale: scale * 0.78 })
  } else if (preset.implementationProfile === 'trail-ribbon') {
    add({ kind: 'trail-ribbon', role: 'trail', opacity: 0.82, scale: scale * Math.max(0.5, preset.controls.trailLength) })
    add({ kind: 'impact-sparks', role: 'impact', opacity: 0.68, scale: scale * 0.5 })
  } else if (preset.implementationProfile === 'ring-field') {
    add({ kind: 'shield-shell', role: 'aura', opacity: 0.2, scale: scale * 0.62 })
    add({ kind: 'ring-field', role: 'aura', opacity: 0.76, scale: scale * 0.82 })
    add({ kind: 'particles', role: 'aura', opacity: 0.64, scale: scale * 0.7 })
  } else if (preset.implementationProfile === 'beam-column') {
    add({ kind: 'beam-column', role: 'body', opacity: 0.72, scale })
    add({ kind: 'particles', role: 'aura', opacity: 0.66, scale: scale * 0.8 })
  } else if (preset.implementationProfile === 'volume-cloud') {
    add({ kind: 'cloud-volume', role: 'volume', opacity: 0.32, scale: scale * 0.62 })
    add({ kind: 'particles', role: 'volume', opacity: 0.54, scale: scale * 0.72 })
  } else if (preset.implementationProfile === 'screen-overlay') {
    add({ kind: 'screen-plane', role: 'screen', opacity: 0.24, scale: scale * 0.55 })
    add({ kind: 'particles', role: 'screen', opacity: 0.74, scale: scale * 0.72 })
  } else {
    add({ kind: 'particles', role: 'body', opacity: 0.82, scale })
    add({ kind: 'core-sphere', role: 'body', opacity: 0.36, scale: scale * 0.5 })
  }

  const signature = surfaces.map((surface) => `${surface.kind}:${surface.role}:${surface.phase ?? 'base'}`).join('|')
  return {
    effectId: preset.effectId,
    profile: preset.implementationProfile,
    signature,
    surfaces,
    estimatedDrawCalls: surfaces.length,
    feelVersion: 1,
    tempo: 1,
  }
}

function buildTaxonomy(): PfxTaxonomyEffect[] {
  const effects: Array<Omit<PfxTaxonomyEffect, 'role'>> = []
  const seen = new Set<string>()
  for (const source of SEED_EFFECTS) pushEffect(effects, seen, source)

  for (const [family, variant] of generatedPairQueue()) {
    if (effects.length >= 500) break
    const id = slug(`${family}-${variant}`)
    if (seen.has(id)) continue
    pushEffect(effects, seen, generatedSeed(family, variant, id))
  }

  return effects.map((effect, index) => ({ ...effect, rank: index + 1, role: derivePfxBehaviorRole(effect) }))
}

function getPfxEffectLoopMode(effectId: string): LoopMode {
  const effect = PFX_TAXONOMY.find((entry) => entry.id === effectId)
  return effect?.loopMode ?? 'loop'
}

export function createPfxParticleEmission(
  preset: Pick<PfxPreset, 'effectId' | 'controls' | 'implementationProfile'>,
  surface: Pick<PfxRenderSurface, 'kind' | 'role' | 'phase' | 'tuning'>,
): PfxParticleEmission {
  const simulation = createPfxParticleSimulation(preset, surface)
  const { count, motionKind } = simulation
  const tuning = surface.tuning
  const rand = seededRandom((preset.controls.seed || 1) * 131 + hashPfxSurfaceKey(surface))
  const loopMode = getPfxEffectLoopMode(preset.effectId)
  const emissionWindow =
    tuning?.window ??
    (surface.kind === 'impact-sparks' || motionKind === 'impact-burst'
      ? 0.12
      : loopMode === 'burst' && motionKind === 'radial-burst'
        ? 0.22
        : 1)
  const spinScale = tuning?.spinScale ?? 1
  const lifeScale = tuning?.lifeScale ?? 1
  const lifeRand = seededRandom((preset.controls.seed || 1) * 197 + hashPfxSurfaceKey(surface) * 3 + 17)

  const life = new Float32Array(count * 2)
  const rotation = new Float32Array(count * 2)
  const variance = new Float32Array(count * 2)
  const meteorIncomingCount = Math.max(2, Math.floor(count * 0.28))
  for (let i = 0; i < count; i++) {
    if (motionKind === 'meteor-impact') {
      if (i < meteorIncomingCount) {
        life[i * 2] = 0
        life[i * 2 + 1] = 0.55
      } else {
        const progress = (i - meteorIncomingCount) / Math.max(1, count - meteorIncomingCount - 1)
        life[i * 2] = 0.13 + progress * 0.05
        life[i * 2 + 1] = 1.85
      }
    } else {
      life[i * 2] = motionKind === 'healing-spiral'
        ? simulation.lifeOffset[i]! * emissionWindow
        : motionKind === 'healing-cross' || motionKind === 'shadow-claw'
          ? (i % 3) * 0.004
        : (i / count) * emissionWindow
    }
    // Independently seeded lives: survivors at any life quantile are not an
    // index-modular subset, so late decay cannot collapse into a repeated
    // polygon of stragglers. The sequence remains deterministic for capture,
    // replay, and tests while breaking index/angle correlation.
    // helix-trail: EXACTLY uniform lives. In continuous mode each particle
    // loops at its own rate (fract(t/duration + offset)), so ANY duration
    // variance decorrelates the train over cycles and the braid collapses
    // into clumps — equal durations freeze the relative phases forever.
    if (motionKind !== 'meteor-impact') {
      life[i * 2 + 1] = motionKind === 'helix-trail' || motionKind === 'healing-spiral' || motionKind === 'dust-loop'
        ? lifeScale
        : (0.7 + lifeRand() * 0.6) * lifeScale
    }
    // Explicit spinScale 0 means axis-locked: random initial roll pointed
    // the muzzle flash card in a new direction every shot.
    const lockedRoll = tuning?.spinScale === 0
    rotation[i * 2] = lockedRoll ? 0 : rand() * Math.PI * 2
    rotation[i * 2 + 1] = (rand() - 0.5) * 3.2 * spinScale
    variance[i * 2] = 0.55 + rand() * 0.9
    variance[i * 2 + 1] = 0.75 + rand() * 0.5
    if (motionKind === 'meteor-impact' && i < meteorIncomingCount) {
      const trailProgress = i / Math.max(1, meteorIncomingCount - 1)
      variance[i * 2] = i === meteorIncomingCount - 1 ? 3.2 : 0.42 + trailProgress * 0.34
      variance[i * 2 + 1] = 0.9 + trailProgress * 0.18
    } else if (motionKind === 'meteor-impact') {
      const ejectaIndex = i - meteorIncomingCount
      variance[i * 2] = 0.34 + ((ejectaIndex * 5) % 11) / 10 * 1.42
      variance[i * 2 + 1] = 0.5 + ((ejectaIndex * 7) % 9) / 8 * 0.72
    }
  }

  if (motionKind === 'dust-loop') {
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < count; i++) {
      minX = Math.min(minX, simulation.spawn[i * 3]!)
      maxX = Math.max(maxX, simulation.spawn[i * 3]!)
    }
    const span = Math.max(0.001, maxX - minX)
    for (let i = 0; i < count; i++) {
      const leadingProgress = (simulation.spawn[i * 3]! - minX) / span
      // The wake tapers toward a compact leading roll. Size and value share
      // the same directional gradient, so the silhouette has a focal edge
      // instead of an evenly weighted row of interchangeable puff stamps.
      variance[i * 2] *= 0.6 + leadingProgress * 0.9
      variance[i * 2 + 1] *= 0.84 + leadingProgress * 0.16
    }
  }

  // Impact spec two-vector model: when the recipe declares an attack
  // vector, energy directions are re-sampled into a cone around it instead
  // of full radial — golden-angle azimuth keeps any alive subset uniform.
  if (tuning?.impactVector && (motionKind === 'radial-burst' || motionKind === 'impact-burst' || motionKind === 'cone-fountain')) {
    const [ax, ay, az] = tuning.impactVector
    const len = Math.hypot(ax, ay, az) || 1
    const axis: [number, number, number] = [ax / len, ay / len, az / len]
    const helper = Math.abs(axis[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0]
    const t1: [number, number, number] = [
      axis[1] * helper[2]! - axis[2] * helper[1]!,
      axis[2] * helper[0]! - axis[0] * helper[2]!,
      axis[0] * helper[1]! - axis[1] * helper[0]!,
    ]
    const t1len = Math.hypot(...t1) || 1
    t1[0] /= t1len; t1[1] /= t1len; t1[2] /= t1len
    const t2: [number, number, number] = [
      axis[1] * t1[2] - axis[2] * t1[1],
      axis[2] * t1[0] - axis[0] * t1[2],
      axis[0] * t1[1] - axis[1] * t1[0],
    ]
    const spread = tuning.spreadAngle ?? 0.6
    const coneRand = seededRandom((preset.controls.seed || 1) * 53 + hashPfxSurfaceKey(surface))
    for (let i = 0; i < count; i++) {
      const azimuth = (i * 2.3999632297286533 + coneRand() * 0.9) % (Math.PI * 2)
      const polar = Math.sqrt(coneRand()) * spread
      const sinP = Math.sin(polar)
      const cosP = Math.cos(polar)
      const index = i * 3
      simulation.direction[index] = axis[0] * cosP + (t1[0] * Math.cos(azimuth) + t2[0] * Math.sin(azimuth)) * sinP
      simulation.direction[index + 1] = axis[1] * cosP + (t1[1] * Math.cos(azimuth) + t2[1] * Math.sin(azimuth)) * sinP
      simulation.direction[index + 2] = axis[2] * cosP + (t1[2] * Math.cos(azimuth) + t2[2] * Math.sin(azimuth)) * sinP
    }
  }

  // Convergence must be immune to spawn-shape overrides: the sim pairs
  // directions with ITS spawn angles, but preset spawnShape can replace the
  // spawn positions afterwards, decohering the pair (half the motes flew
  // OUTWARD on sphere-spawn charges). Derive inward directions from the
  // FINAL spawn positions.
  if (motionKind === 'converge-center') {
    for (let i = 0; i < count; i++) {
      const x = simulation.spawn[i * 3]!
      const y = simulation.spawn[i * 3 + 1]!
      const z = simulation.spawn[i * 3 + 2]!
      const length = Math.max(0.001, Math.hypot(x, y, z))
      simulation.direction[i * 3] = -x / length
      simulation.direction[i * 3 + 1] = -y / length + 0.05
      simulation.direction[i * 3 + 2] = -z / length
      simulation.speed[i] = length * (0.5 + (i % 5) * 0.04)
    }
  }

  return {
    count,
    motionKind,
    sprite: tuning?.sprite ?? getPfxSpriteForSurface(preset, surface, motionKind),
    emissionWindow,
    spawn: simulation.spawn,
    direction: simulation.direction,
    speed: simulation.speed,
    life,
    rotation,
    variance,
    wobble: (() => {
      const wobble = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        wobble[i * 2] = simulation.wobblePhase[i]!
        wobble[i * 2 + 1] = simulation.wobbleFrequency[i]!
      }
      return wobble
    })(),
    orbit: (() => {
      const orbit = new Float32Array(count * 2)
      for (let i = 0; i < count; i++) {
        orbit[i * 2] = simulation.orbitAngle[i]!
        orbit[i * 2 + 1] = simulation.orbitRadius[i]!
      }
      return orbit
    })(),
  }
}

function requirePreset(index: number): PfxPreset {
  const preset = PFX_PRESETS[index]
  if (!preset) throw new Error(`Missing PFX preset at index ${index}`)
  return preset
}
