import { describe, expect, it } from 'vitest'
import { BACK_PRESETS, getBackPreset } from './backThemes'

const HEX = /^#[0-9a-f]{6}$/i
const PATTERNS = ['guilloche', 'rosette', 'lattice']

describe('BACK_PRESETS', () => {
  it('have unique ids and well-formed fields', () => {
    expect(BACK_PRESETS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(BACK_PRESETS.map((p) => p.id)).size).toBe(BACK_PRESETS.length)
    for (const p of BACK_PRESETS) {
      expect(HEX.test(p.base)).toBe(true)
      expect(HEX.test(p.patternColor)).toBe(true)
      expect(HEX.test(p.borderColor)).toBe(true)
      expect(HEX.test(p.accent)).toBe(true)
      expect(PATTERNS).toContain(p.pattern)
    }
  })
})

describe('getBackPreset', () => {
  it('finds presets by id and misses unknowns', () => {
    expect(getBackPreset(BACK_PRESETS[0].id)).toEqual(BACK_PRESETS[0])
    expect(getBackPreset('nope')).toBeUndefined()
  })
})
