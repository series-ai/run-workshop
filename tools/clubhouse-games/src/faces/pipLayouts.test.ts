import { describe, expect, it } from 'vitest'
import { pipLayout, SPOT_RANKS } from './pipLayouts'

describe('pipLayout', () => {
  it('returns exactly N pips for rank N', () => {
    for (const rank of SPOT_RANKS) {
      expect(pipLayout(rank)).toHaveLength(Number(rank))
    }
  })

  it('keeps every pip inside the inner field', () => {
    for (const rank of SPOT_RANKS) {
      for (const pip of pipLayout(rank)) {
        expect(Math.abs(pip.x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(pip.y)).toBeLessThanOrEqual(0.7)
      }
    }
  })

  it('flags bottom-half pips inverted and top-half upright', () => {
    for (const rank of SPOT_RANKS) {
      for (const pip of pipLayout(rank)) {
        if (pip.y > 0.01) expect(pip.inverted).toBe(true)
        if (pip.y < -0.01) expect(pip.inverted).toBe(false)
      }
    }
  })
})
