import { useMemo } from 'react'
import { BurgerShopEffect, getBurgerShopRecipe } from '../burger-shop/BurgerShopEffect'
import type { BurgerShopRecipe } from '../burger-shop/types'
import { getDuelystSpriteRecipe } from './duelystRecipes'
import { burgerShopRecipeIdFromInspectId } from './ids'
import { DuelystSheetEffect } from './DuelystSheetEffect'
import { getPirateUnityRecipe, isPirateUnityId } from './pirateRecipes'
import { PIRATE_TEXTURE_URLS } from './pirateTextures'
import { DUELYST_SHEET_URLS, type DuelystSheetId } from './textures'

function loopingInspectRecipe(recipe: BurgerShopRecipe): BurgerShopRecipe {
  return {
    ...recipe,
    looping: true,
    emitters: recipe.emitters.map((emitter) => ({ ...emitter, looping: true })),
  }
}

function BurgerInspect({ recipeId }: { recipeId: string }) {
  const recipe = useMemo(() => loopingInspectRecipe(getBurgerShopRecipe(recipeId)), [recipeId])
  return (
    <group scale={4.2} position={[0, -1.05, 0]}>
      <BurgerShopEffect recipe={recipe} />
    </group>
  )
}

function PirateInspect({ id }: { id: string }) {
  const recipe = useMemo(() => loopingInspectRecipe(getPirateUnityRecipe(id)), [id])
  return (
    <group scale={4.2} position={[0, -1.05, 0]}>
      <BurgerShopEffect recipe={recipe} textureUrls={PIRATE_TEXTURE_URLS} />
    </group>
  )
}

function DuelystInspect({ id }: { id: DuelystSheetId }) {
  const recipe = useMemo(() => getDuelystSpriteRecipe(id), [id])
  const ground = recipe.emitters.every((emitter) => emitter.anchor === 'ground')
  return (
    <group position={[0, ground ? -1.05 : 0, 0]}>
      <DuelystSheetEffect id={id} />
    </group>
  )
}

export function InspectPackEffect({ id }: { id: string }) {
  const burgerRecipeId = burgerShopRecipeIdFromInspectId(id)
  if (burgerRecipeId) return <BurgerInspect recipeId={burgerRecipeId} />
  if (id in DUELYST_SHEET_URLS) return <DuelystInspect id={id as DuelystSheetId} />
  if (isPirateUnityId(id)) return <PirateInspect id={id} />
  throw new Error(`Unknown inspect pack effect: ${id}`)
}
