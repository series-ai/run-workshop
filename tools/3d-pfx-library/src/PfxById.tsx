/**
 * Plays any effect by id: a ranked catalog effect through `GamePfx`, or an
 * inspect-pack effect (Burger Shop, Duelyst, Pirate Nation, RUN voxel packs).
 * For apps that store effect ids as data (e.g. model → socket bindings).
 */
import { useMemo } from 'react'
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
function RvxEffect({ effectId, playKey, preview = false, prewarm = true }: { effectId: string; playKey?: number | string; preview?: boolean; prewarm?: boolean }) {
  // A ribbon's `sweep` fakes a swing when its socket stands still. That is right for a preview
  // of the effect alone, and wrong on a model: the blade rests between swings, and the fake
  // swing would play after the real one. On sockets, ribbons follow the real motion only.
  const recipe = useMemo(() => (preview ? getRvxRecipe(effectId) : withoutSweep(getRvxRecipe(effectId))), [effectId, preview])
  return (
    <group scale={1 / BURGER_SHOP_WORLD_SCALE}>
      <BurgerShopEffect key={recipe.looping ? 'loop' : String(playKey ?? 0)} recipe={recipe} textureUrls={RVX_TEXTURE_URLS} prewarm={prewarm} />
    </group>
  )
}

/** True for effects that play once per trigger; false for loops. */
export function isPfxOneShot(effectId: string): boolean {
  return isRvxId(effectId) && !getRvxRecipe(effectId).looping
}

/** Drops `ribbon.sweep` from every layer (see RvxEffect). */
function withoutSweep(recipe: ReturnType<typeof getRvxRecipe>): ReturnType<typeof getRvxRecipe> {
  if (!recipe.emitters.some((e) => e.ribbon?.sweep)) return recipe
  return { ...recipe, emitters: recipe.emitters.map((e) => (e.ribbon?.sweep ? { ...e, ribbon: { ...e.ribbon, sweep: undefined } } : e)) }
}

/**
 * `preview`: the effect is shown on its own, not on a moving model (lets ribbons fake a swing).
 * `prewarm` (loops; default true): start a loop as if it had run for a while. False for a loop
 * that a clip starts, such as mist that pours out as a door opens.
 */
export function PfxById({ effectId, playKey, preview = false, prewarm = true }: { effectId: string; playKey?: number | string; preview?: boolean; prewarm?: boolean }) {
  if (isRvxId(effectId)) return <RvxEffect effectId={effectId} playKey={playKey} preview={preview} prewarm={prewarm} />
  if (isInspectPackId(effectId)) return <InspectPackEffect id={effectId} />
  const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effectId)
  if (!preset) throw new Error(`Unknown PFX effect id "${effectId}"`)
  return <GamePfx preset={preset} screenAnchor={false} />
}
