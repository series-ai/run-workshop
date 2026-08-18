import { BURGER_SHOP_RECIPES } from '../burger-shop/recipes'
import { matchesPfxSearchQuery, overlaps } from '../constants/04'
import { PFX_PRESETS } from '../tooling/01'
import type { PfxCatalogItem, PfxFilterQuery, PfxPreset, PfxTaxonomyEffect } from '../types/01'
import {
  BURGER_SHOP_INSPECT_IDS,
  burgerShopInspectId,
  expandInspectSheetMarkIds,
  INSPECT_PACK_IDS,
  INSPECT_SHEETS_MARK_ID,
  isInspectPackId,
} from './ids'
import { PIRATE_RECIPES } from './pirateRecipes'
import { DUELYST_SHEET_DEFS } from './textures'

function inspectPreset(effect: PfxTaxonomyEffect): PfxPreset {
  const base = PFX_PRESETS[0]
  if (!base) throw new Error('PFX catalog is empty')
  return {
    ...base,
    id: `${effect.id}-inspect`,
    effectId: effect.id,
    name: effect.name,
    tags: [...effect.gameplayUseCases, ...effect.assetRequirements],
    acceptanceStatus: effect.acceptanceStatus,
    mobileSafety: effect.mobileSafety,
    implementationProfile: effect.implementationProfile,
    seed: 1,
  }
}

function inspectEffect(input: {
  id: string
  name: string
  rank: number
  effectType: PfxTaxonomyEffect['effectType']
  role: PfxTaxonomyEffect['role']
  loopMode: PfxTaxonomyEffect['loopMode']
  notes: string
  assetRequirements: string[]
}): PfxTaxonomyEffect {
  return {
    id: input.id,
    rank: input.rank,
    name: input.name,
    effectType: input.effectType,
    role: input.role,
    gameplayUseCases: ['inspect', 'sheet-review'],
    styleAffinity: input.assetRequirements.includes('duelyst') ? ['pixel-retro', 'arcade'] : ['toon', 'arcade'],
    emotionMood: ['review'],
    colorFamily: ['mixed'],
    assetRequirements: input.assetRequirements,
    loopMode: input.loopMode,
    space: 'world',
    mobileSafety: 'safe',
    acceptanceStatus: 'authored-preview',
    implementationProfile: 'radial-burst',
    marketSourceFamilies: [],
    marketSourceUrls: input.assetRequirements.includes('duelyst')
      ? ['https://github.com/open-duelyst/duelyst']
      : input.assetRequirements.includes('pirate-nation')
        ? ['https://github.com/proofofplay/piratenation-game']
        : [],
    notes: input.notes,
  }
}

function burgerShopInspectItems(): PfxCatalogItem[] {
  return BURGER_SHOP_RECIPES.map((recipe, index) => {
    const effect = inspectEffect({
      id: burgerShopInspectId(recipe.id),
      name: `BurgerTime ${recipe.label}`,
      rank: 9000 + index,
      effectType: 'environment',
      role: recipe.looping ? 'loop' : 'burst',
      loopMode: recipe.looping ? 'loop' : 'burst',
      notes: 'BurgerTime shop sheet.',
      assetRequirements: ['inspect-sheet', 'burger-shop', 'burgertime'],
    })
    return { effect, preset: inspectPreset(effect) }
  })
}

function duelystInspectItems(): PfxCatalogItem[] {
  return DUELYST_SHEET_DEFS.map((sheet, index) => {
    const effect = inspectEffect({
      id: sheet.id,
      name: sheet.label,
      rank: 9100 + index,
      effectType: sheet.type,
      role: sheet.role,
      loopMode: sheet.role === 'loop' ? 'loop' : 'burst',
      notes: `Duelyst CC0 sheet ${sheet.file}.`,
      assetRequirements: ['inspect-sheet', 'duelyst', 'cc0'],
    })
    return { effect, preset: inspectPreset(effect) }
  })
}

function pirateInspectItems(): PfxCatalogItem[] {
  return PIRATE_RECIPES.map((recipe, index) => {
    const effect = inspectEffect({
      id: recipe.id,
      name: recipe.label,
      rank: 9200 + index,
      effectType: recipe.effectType,
      role: recipe.role,
      loopMode: recipe.looping ? 'loop' : 'burst',
      notes: 'Pirate Nation MIT stamp pack.',
      assetRequirements: ['inspect-sheet', 'pirate-nation', 'mit'],
    })
    return { effect, preset: inspectPreset(effect) }
  })
}

export const INSPECT_PACK_ITEMS: PfxCatalogItem[] = [
  ...burgerShopInspectItems(),
  ...duelystInspectItems(),
  ...pirateInspectItems(),
]

export function getInspectPackItem(id: string): PfxCatalogItem | undefined {
  return INSPECT_PACK_ITEMS.find((item) => item.effect.id === id)
}

function inspectItemMatchesQuery(item: PfxCatalogItem, query: string): boolean {
  const haystack = [
    item.effect.id,
    item.effect.name,
    item.effect.notes,
    ...item.effect.assetRequirements,
    ...item.effect.gameplayUseCases,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function selectInspectPackItems(
  options: PfxFilterQuery & { markIds?: readonly string[] } = {},
): PfxCatalogItem[] {
  const query = options.query?.trim().toLowerCase() ?? ''
  return INSPECT_PACK_ITEMS.filter(({ effect, preset }) => {
    if (query && !matchesPfxSearchQuery(query, effect, preset) && !inspectItemMatchesQuery({ effect, preset }, query)) {
      return false
    }
    if (options.effectType?.length && !options.effectType.includes(effect.effectType)) return false
    if (options.gameplayUseCase?.length && !overlaps(options.gameplayUseCase, effect.gameplayUseCases)) return false
    if (options.style?.length && !overlaps(options.style, effect.styleAffinity)) return false
    if (options.performanceTier?.length && !options.performanceTier.includes(preset.performance.tier)) return false
    if (options.emotionMood?.length && !overlaps(options.emotionMood, effect.emotionMood)) return false
    if (options.colorFamily?.length && !overlaps(options.colorFamily, effect.colorFamily)) return false
    if (options.assetRequirements?.length && !overlaps(options.assetRequirements, effect.assetRequirements)) {
      return false
    }
    if (options.loopMode?.length && !options.loopMode.includes(effect.loopMode)) return false
    if (options.space?.length && !options.space.includes(effect.space)) return false
    if (options.mobileSafeOnly && effect.mobileSafety !== 'safe') return false
    if (options.coverage?.length && !options.coverage.includes(effect.acceptanceStatus)) return false
    return true
  })
}

export {
  BURGER_SHOP_INSPECT_IDS,
  expandInspectSheetMarkIds,
  INSPECT_PACK_IDS,
  INSPECT_SHEETS_MARK_ID,
  isInspectPackId,
}
