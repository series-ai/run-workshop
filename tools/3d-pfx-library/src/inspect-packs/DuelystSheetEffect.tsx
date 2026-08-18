import { SpriteSheetParticles } from '../sprite-sheet/SpriteSheetParticles'
import { getDuelystSpriteRecipe } from './duelystRecipes'
import type { DuelystSheetId } from './textures'

export function DuelystSheetEffect({ id }: { id: DuelystSheetId }) {
  const recipe = getDuelystSpriteRecipe(id)
  return (
    <SpriteSheetParticles
      textureUrl={recipe.textureUrl}
      sheet={recipe.sheet}
      emitters={recipe.emitters}
      keyBackground={recipe.keyBackground}
      pixelated
    />
  )
}
