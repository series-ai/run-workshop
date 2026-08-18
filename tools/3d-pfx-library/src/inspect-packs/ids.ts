import { BURGER_SHOP_RECIPES } from '../burger-shop/recipes'
import { PIRATE_IDS } from './pirateRecipes'
import { DUELYST_SHEET_DEFS } from './textures'

export const INSPECT_SHEETS_MARK_ID = 'inspect-sheets'

export const BURGER_SHOP_INSPECT_PREFIX = 'burger-shop-'

export function burgerShopInspectId(recipeId: string): string {
  return `${BURGER_SHOP_INSPECT_PREFIX}${recipeId}`
}

export function burgerShopRecipeIdFromInspectId(inspectId: string): string | null {
  if (!inspectId.startsWith(BURGER_SHOP_INSPECT_PREFIX)) return null
  return inspectId.slice(BURGER_SHOP_INSPECT_PREFIX.length)
}

export const BURGER_SHOP_INSPECT_IDS = BURGER_SHOP_RECIPES.map((recipe) => burgerShopInspectId(recipe.id))

export const DUELYST_INSPECT_IDS = DUELYST_SHEET_DEFS.map((sheet) => sheet.id)

export const PIRATE_INSPECT_IDS = PIRATE_IDS

export const INSPECT_PACK_IDS = [...BURGER_SHOP_INSPECT_IDS, ...DUELYST_INSPECT_IDS, ...PIRATE_INSPECT_IDS]

export function isInspectPackId(id: string): boolean {
  return INSPECT_PACK_IDS.includes(id)
}

export function expandInspectSheetMarkIds(ids: readonly string[]): string[] {
  const expanded = new Set<string>()
  for (const id of ids) {
    if (id === INSPECT_SHEETS_MARK_ID) {
      for (const packId of INSPECT_PACK_IDS) expanded.add(packId)
      continue
    }
    expanded.add(id)
  }
  return [...expanded]
}
