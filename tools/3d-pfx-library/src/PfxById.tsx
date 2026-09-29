/**
 * Plays any effect by id: a ranked catalog effect through `GamePfx`, or an
 * inspect-pack effect (Burger Shop, Duelyst, Pirate Nation, RUN voxel packs).
 * For apps that store effect ids as data (e.g. model → socket bindings).
 */
import { BurgerShopEffect } from './burger-shop/BurgerShopEffect'
import { BURGER_SHOP_WORLD_SCALE } from './burger-shop/types'
import { isInspectPackId } from './inspect-packs/ids'
import { InspectPackEffect } from './inspect-packs/InspectPackEffect'
import { getRvxRecipe, isRvxId, RVX_IDS, RVX_TEXTURE_URLS } from './inspect-packs/rvxRecipes'
import { PFX_PRESETS } from './tooling/01'
import { GamePfx } from './tooling/07'

/** Every RUN voxel pack effect id (`rvx-<pack>-<effect>`). */
export const RVX_EFFECT_IDS: readonly string[] = RVX_IDS

/** Human label for any effect id. */
export function pfxLabel(effectId: string): string {
  if (isRvxId(effectId)) return getRvxRecipe(effectId).label
  return PFX_PRESETS.find((preset) => preset.effectId === effectId)?.name ?? effectId
}

export function hasPfxEffect(effectId: string): boolean {
  return isInspectPackId(effectId) || PFX_PRESETS.some((preset) => preset.effectId === effectId)
}

/**
 * RVX recipes are drawn at nominal size 1 (see inspect-packs/rvx/common.ts);
 * undo the Burger Shop world scale so one recipe unit is one world unit.
 * Loops loop; one-shots play once, and a new `playKey` plays them again.
 */
function RvxEffect({ effectId, playKey }: { effectId: string; playKey?: number | string }) {
  const recipe = getRvxRecipe(effectId)
  return (
    <group scale={1 / BURGER_SHOP_WORLD_SCALE}>
      <BurgerShopEffect key={recipe.looping ? 'loop' : String(playKey ?? 0)} recipe={recipe} textureUrls={RVX_TEXTURE_URLS} />
    </group>
  )
}

/** True for effects that play once per trigger; false for loops. */
export function isPfxOneShot(effectId: string): boolean {
  return isRvxId(effectId) && !getRvxRecipe(effectId).looping
}

export function PfxById({ effectId, playKey }: { effectId: string; playKey?: number | string }) {
  if (isRvxId(effectId)) return <RvxEffect effectId={effectId} playKey={playKey} />
  if (isInspectPackId(effectId)) return <InspectPackEffect id={effectId} />
  const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effectId)
  if (!preset) throw new Error(`Unknown PFX effect id "${effectId}"`)
  return <GamePfx preset={preset} screenAnchor={false} />
}
