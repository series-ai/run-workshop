import { describe, expect, it } from 'vitest'
import { RVX_RECIPES, RVX_TEXTURE_URLS } from '../rvxRecipes'
import { theme } from './common'

/** Most particles alive at once: bursts plus rate × life, per emitter. */
function peakParticles(recipe: (typeof RVX_RECIPES)[number]): number {
  return recipe.emitters.reduce((sum, e) => sum + (e.burst?.max ?? 0) + Math.ceil(e.rate * Math.min(e.life.max, recipe.looping ? e.life.max : e.duration)), 0)
}

describe('RUN voxel effects', () => {
  it('have unique pack-prefixed ids', () => {
    const ids = RVX_RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^rvx-(fantasy|space|monster|apocalypse)-[a-z0-9-]+$/)
  })

  it('loop every layer of a loop, and end every one-shot within 2 seconds', () => {
    for (const r of RVX_RECIPES) {
      if (r.looping) expect(r.emitters.every((e) => e.looping && e.duration === r.duration), r.id).toBe(true)
      else {
        expect(r.emitters.some((e) => e.looping), r.id).toBe(false)
        expect(r.duration, r.id).toBeLessThanOrEqual(2)
      }
    }
  })

  it('use known textures and colours in 0..1', () => {
    for (const r of RVX_RECIPES)
      for (const e of r.emitters) {
        expect(RVX_TEXTURE_URLS[e.texture], `${r.id}/${e.name}: ${e.texture}`).toBeDefined()
        for (const c of [...e.color, ...(e.colorOverLife ?? []).map((k) => k.c)]) for (const v of c) expect(v >= 0 && v <= 1, `${r.id}/${e.name}`).toBe(true)
      }
  })

  it('keep to the particle budget (craft guide: 60 for a hero effect)', () => {
    const over = RVX_RECIPES.filter((r) => peakParticles(r) > 60).map((r) => `${r.id}: ${peakParticles(r)}`)
    expect(over).toEqual([])
  })

  it('read theme colours with the same OKLab ramps as the models', () => {
    // Shade 4 is the anchor itself; themes.json monster purple mid is #5a3e6c.
    const [r, g, b] = theme('monster')('purple', 4)
    expect([r, g, b].map((v) => Math.round(v * 255))).toEqual([0x5a, 0x3e, 0x6c])
    expect(() => theme('fantasy')('nope', 3)).toThrow(/unknown palette ramp/)
    expect(() => theme('fantasy')('gold', 8)).toThrow(/outside/)
  })
})
