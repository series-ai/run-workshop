import { PFX_MARKET_SOURCE_REFERENCES } from './constants/01'
import { AUTHORED_EFFECT_RECIPES } from './constants/02'
import { inferMarketSourceFamilies } from './constants/03'
import { presetControlsToOverrides, sanitizeComponentName } from './constants/04'
import type { ExportSnippetOptions, PfxAcceptanceStatus, PfxPreset, PfxTaxonomyEffect } from './types/01'
import type { SeedEffect } from './types/02'

export function exportPfxComponentSnippet(
  preset: PfxPreset,
  options: ExportSnippetOptions = {},
): string {
  const componentName = sanitizeComponentName(options.componentName ?? preset.componentName)
  const importPath = options.importPath ?? 'game-bot-pfx'
  const overrides = JSON.stringify(presetControlsToOverrides(preset), null, 2).replace(/^/gm, '  ')

  return `import { createGamePfxComponent } from "${importPath}"

const ${componentName}Base = createGamePfxComponent("${preset.effectId}", ${overrides.trim()})

export function ${componentName}(props: Parameters<typeof ${componentName}Base>[0]) {
  return <${componentName}Base {...props} />
}
`
}

export function exportPfxPresetJson(preset: PfxPreset): string {
  return JSON.stringify(
    {
      schema: 'game-bot.r3f-pfx-preset.v1',
      effectId: preset.effectId,
      id: preset.id,
      name: preset.name,
      seed: preset.seed,
      controls: preset.controls,
      textureAtlas: preset.textureAtlas,
      styleRender: preset.styleRender,
      preview: preset.preview,
      performance: preset.performance,
      quality: preset.quality,
      implementationProfile: preset.implementationProfile,
      acceptanceStatus: preset.acceptanceStatus,
      authoredRecipeId: preset.authoredRecipeId,
      mobileSafety: preset.mobileSafety,
      componentName: preset.componentName,
      tags: preset.tags,
      reducedMotion: preset.reducedMotion === true,
    },
    null,
    2,
  )
}

export function pushEffect(effects: Array<Omit<PfxTaxonomyEffect, 'role'>>, seen: Set<string>, source: SeedEffect): void {
  if (seen.has(source.id)) return
  seen.add(source.id)
  const recipe = AUTHORED_EFFECT_RECIPES[source.id]
  const acceptanceStatus: PfxAcceptanceStatus = recipe ? 'authored-preview' : 'profile-backed'
  const marketSourceFamilies = source.marketSourceFamilies ?? inferMarketSourceFamilies(source)
  effects.push({
    ...source,
    rank: effects.length + 1,
    assetRequirements: source.effectType === 'ui' ? ['none'] : ['runtime-atlas-optional'],
    acceptanceStatus,
    marketSourceFamilies,
    marketSourceUrls: marketSourceFamilies.map((family) => PFX_MARKET_SOURCE_REFERENCES[family]),
    notes: recipe
      ? `${source.name} has authored preview recipe ${recipe.id} layered on the ${source.implementationProfile} runtime profile. It still requires real-device profiling before final production acceptance.`
      : `${source.name} is covered by the ${source.implementationProfile} R3F implementation profile with deterministic presets and tier metadata. It still requires effect-specific production art direction before final acceptance.`,
  })
}
