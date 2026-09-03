import { describe, expect, it } from 'vitest'
import { BACK_ORNAMENTS, BACK_PATTERNS, BACK_PRESETS, getBackPreset } from './backThemes'

const HEX = /^#[0-9a-f]{6}$/i


describe('BACK_PRESETS', () => {
  it('have unique ids and well-formed fields', () => {
    expect(BACK_PRESETS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(BACK_PRESETS.map((p) => p.id)).size).toBe(BACK_PRESETS.length)
    for (const p of BACK_PRESETS) {
      expect(HEX.test(p.base)).toBe(true)
      expect(HEX.test(p.patternColor)).toBe(true)
      expect(HEX.test(p.borderColor)).toBe(true)
      expect(HEX.test(p.accent)).toBe(true)
      expect(BACK_PATTERNS).toContain(p.pattern)
      if (p.ornament) expect(BACK_ORNAMENTS).toContain(p.ornament)
    }
  })
})

describe('getBackPreset', () => {
  it('finds presets by id and misses unknowns', () => {
    expect(getBackPreset(BACK_PRESETS[0].id)).toEqual(BACK_PRESETS[0])
    expect(getBackPreset('nope')).toBeUndefined()
  })
})

describe('back pattern coverage', () => {
  it('uses every ground at least once across the presets', () => {
    const used = new Set(BACK_PRESETS.map((p) => p.pattern))
    for (const pattern of BACK_PATTERNS) expect(used).toContain(pattern)
  })

  it('uses every ornament that is worth showing', () => {
    const used = new Set(BACK_PRESETS.map((p) => p.ornament ?? 'band'))
    for (const ornament of ['band', 'rosette', 'star'] as const) {
      expect(used).toContain(ornament)
    }
  })
})
