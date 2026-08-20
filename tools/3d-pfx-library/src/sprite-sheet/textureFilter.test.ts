import { ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, NearestFilter, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { configureSpriteSheetTexture } from './textureFilter'

describe('configureSpriteSheetTexture', () => {
  it('keeps linear sampling when pixelated is off', () => {
    const texture = configureSpriteSheetTexture(new Texture(), false)
    expect(texture.flipY).toBe(true)
    expect(texture.wrapS).toBe(ClampToEdgeWrapping)
    expect(texture.wrapT).toBe(ClampToEdgeWrapping)
    expect(texture.minFilter).toBe(LinearMipmapLinearFilter)
    expect(texture.magFilter).toBe(LinearFilter)
    expect(texture.generateMipmaps).toBe(true)
  })

  it('uses nearest sampling when pixelated is on', () => {
    const texture = configureSpriteSheetTexture(new Texture(), true)
    expect(texture.minFilter).toBe(NearestFilter)
    expect(texture.magFilter).toBe(NearestFilter)
    expect(texture.generateMipmaps).toBe(false)
    expect(texture.anisotropy).toBe(1)
  })
})
