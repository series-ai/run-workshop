import { BurgerShopEffect, getBurgerShopRecipe } from '../burger-shop/BurgerShopEffect'
import { getDuelystSpriteRecipe } from './duelystRecipes'
import { burgerShopRecipeIdFromInspectId } from './ids'
import { DuelystSheetEffect } from './DuelystSheetEffect'
import { getPirateUnityRecipe, isPirateUnityId } from './pirateRecipes'
import { PIRATE_TEXTURE_URLS } from './pirateTextures'
import { DUELYST_SHEET_URLS, type DuelystSheetId } from './textures'

export function InspectPackEffect({ id }: { id: string }) {
  const burgerRecipeId = burgerShopRecipeIdFromInspectId(id)
  if (burgerRecipeId) {
    const recipe = getBurgerShopRecipe(burgerRecipeId)
    const loopingRecipe = {
      ...recipe,
      looping: true,
      emitters: recipe.emitters.map((emitter) => ({ ...emitter, looping: true })),
    }
    return (
      <group scale={4.2} position={[0, -1.05, 0]}>
        <BurgerShopEffect recipe={loopingRecipe} />
      </group>
    )
  }
  if (id in DUELYST_SHEET_URLS) {
    const recipe = getDuelystSpriteRecipe(id as DuelystSheetId)
    const ground = recipe.emitters.every((emitter) => emitter.anchor === 'ground')
    return (
      <group position={[0, ground ? -1.05 : 0, 0]}>
        <DuelystSheetEffect id={id as DuelystSheetId} />
      </group>
    )
  }
  if (isPirateUnityId(id)) {
    const recipe = getPirateUnityRecipe(id)
    const loopingRecipe = {
      ...recipe,
      looping: true,
      emitters: recipe.emitters.map((emitter) => ({ ...emitter, looping: true })),
    }
    return (
      <group scale={4.2} position={[0, -1.05, 0]}>
        <BurgerShopEffect recipe={loopingRecipe} textureUrls={PIRATE_TEXTURE_URLS} />
      </group>
    )
  }
  throw new Error(`Unknown inspect pack effect: ${id}`)
}
