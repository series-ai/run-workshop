import { describe, expect, it } from 'vitest'
import {
  BACK_CORNERS,
  BACK_FRAMES,
  BACK_LAYOUTS,
  BACK_ORNAMENTS,
  BACK_PATTERNS,
  BACK_PRESETS,
  BACK_SEALS,
  getBackPreset,
} from './backThemes'

const HEX = /^#[0-9a-f]{6}$/i


describe('BACK_PRESETS', () => {
  it('have unique ids and well-formed fields', () => {
    expect(BACK_PRESETS.length).toBeGreaterThanOrEqual(24)
    expect(new Set(BACK_PRESETS.map((p) => p.id)).size).toBe(BACK_PRESETS.length)
    for (const p of BACK_PRESETS) {
      expect(HEX.test(p.base)).toBe(true)
      expect(HEX.test(p.patternColor)).toBe(true)
      expect(HEX.test(p.borderColor)).toBe(true)
      expect(HEX.test(p.accent)).toBe(true)
      expect(BACK_PATTERNS).toContain(p.pattern)
      if (p.ornament) expect(BACK_ORNAMENTS).toContain(p.ornament)
      if (p.layout) expect(BACK_LAYOUTS).toContain(p.layout)
      if (p.frame) expect(BACK_FRAMES).toContain(p.frame)
      if (p.corner) expect(BACK_CORNERS).toContain(p.corner)
      if (p.seal) expect(BACK_SEALS).toContain(p.seal)
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

describe('structural variety', () => {
  it('uses every layout, frame, corner, and seal at least once', () => {
    const layouts = new Set(BACK_PRESETS.map((p) => p.layout ?? 'centered'))
    const frames = new Set(BACK_PRESETS.map((p) => p.frame ?? 'keyline'))
    const corners = new Set(BACK_PRESETS.map((p) => p.corner ?? 'rosette'))
    const seals = new Set(BACK_PRESETS.map((p) => p.seal ?? 'circle'))
    for (const v of BACK_LAYOUTS) expect(layouts).toContain(v)
    for (const v of BACK_FRAMES) expect(frames).toContain(v)
    for (const v of BACK_CORNERS) expect(corners).toContain(v)
    for (const v of BACK_SEALS) expect(seals).toContain(v)
  })

  it('gives no two presets the same combination', () => {
    const shape = BACK_PRESETS.map((p) =>
      [
        p.pattern,
        p.ornament ?? 'band',
        p.layout ?? 'centered',
        p.frame ?? 'keyline',
        p.corner ?? 'rosette',
        p.seal ?? 'circle',
        p.medallion ?? true,
      ].join('|'),
    )
    expect(new Set(shape).size).toBe(shape.length)
  })
})
