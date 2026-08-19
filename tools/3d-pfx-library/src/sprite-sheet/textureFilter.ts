import { ClampToEdgeWrapping, NearestFilter, type Texture } from 'three'

/** Match Cocos `setAliasTexParameters` when `pixelated` is true. */
export function configureSpriteSheetTexture(texture: Texture, pixelated: boolean): Texture {
  texture.flipY = true
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  if (pixelated) {
    texture.generateMipmaps = false
    texture.minFilter = NearestFilter
    texture.magFilter = NearestFilter
    texture.anisotropy = 1
  }
  return texture
}
