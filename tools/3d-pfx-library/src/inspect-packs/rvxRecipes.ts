/**
 * RUN voxel pack effects (tools/run-voxel-packs). Themed recipes on the
 * inspect-pack emitter system, next to the Pirate Nation pack, so the locked
 * 500-effect catalog does not change. One file per pack in ./rvx/, built
 * from the archetypes in ./rvx/kit.ts; voxel debris uses `geometry: 'cube'`;
 * the faceted shapes come from scripts/make-rvx-textures.py (RUN License)
 * and the soft glow reuses the Pirate Nation VFX texture (MIT); colours come from each
 * pack's world theme. See docs/rvx-pfx-style.md.
 */
import bat from '../../assets/run-voxel/bat.png'
import beam from '../../assets/run-voxel/beam.png'
import bubble from '../../assets/run-voxel/bubble.png'
import drop from '../../assets/run-voxel/drop.png'
import flame from '../../assets/run-voxel/flame.png'
import leaf from '../../assets/run-voxel/leaf.png'
import puff from '../../assets/run-voxel/puff.png'
import ring from '../../assets/run-voxel/ring.png'
import runes from '../../assets/run-voxel/runes.png'
import shard from '../../assets/run-voxel/shard.png'
import skull from '../../assets/run-voxel/skull.png'
import slash from '../../assets/run-voxel/slash.png'
import star from '../../assets/run-voxel/star.png'
import streak from '../../assets/run-voxel/streak.png'
import trail from '../../assets/run-voxel/trail.png'
import voxel from '../../assets/run-voxel/voxel.png'
import type { PirateRecipe } from './pirateRecipes'
import { PIRATE_TEXTURE_URLS } from './pirateTextures'
import { APOCALYPSE_RECIPES } from './rvx/apocalypse'
import { FANTASY_RECIPES } from './rvx/fantasy'
import { MONSTER_RECIPES } from './rvx/monster'
import { SPACE_RECIPES } from './rvx/space'

export const RVX_TEXTURE_URLS: Record<string, string> = {
  ...PIRATE_TEXTURE_URLS,
  voxel,
  'rvx-bat': bat,
  'rvx-beam': beam,
  'rvx-bubble': bubble,
  'rvx-drop': drop,
  'rvx-flame': flame,
  'rvx-leaf': leaf,
  'rvx-puff': puff,
  'rvx-ring': ring,
  'rvx-runes': runes,
  'rvx-shard': shard,
  'rvx-skull': skull,
  'rvx-slash': slash,
  'rvx-star': star,
  'rvx-streak': streak,
  'rvx-trail': trail,
}

export const RVX_RECIPES: PirateRecipe[] = [...FANTASY_RECIPES, ...SPACE_RECIPES, ...MONSTER_RECIPES, ...APOCALYPSE_RECIPES]

export const RVX_IDS = RVX_RECIPES.map((recipe) => recipe.id)

export function isRvxId(id: string): boolean {
  return RVX_IDS.includes(id)
}

export function getRvxRecipe(id: string): PirateRecipe {
  const recipe = RVX_RECIPES.find((entry) => entry.id === id)
  if (!recipe) throw new Error(`Unknown RUN voxel effect: ${id}`)
  return recipe
}
