import { describe, expect, it } from 'vitest'
import { doubleSixSet, PIP_LAYOUTS } from './set'
import { dominoId, parseDominoId } from './types'

describe('doubleSixSet', () => {
  it('returns 28 tiles with unique ids', () => {
    const set = doubleSixSet()
    expect(set).toHaveLength(28)
    expect(new Set(set.map(dominoId)).size).toBe(28)
  })

  it('contains every unordered pair exactly once (high side first)', () => {
    for (const d of doubleSixSet()) {
      expect(d.left).toBeGreaterThanOrEqual(d.right)
      expect(d.left).toBeLessThanOrEqual(6)
      expect(d.right).toBeGreaterThanOrEqual(0)
    }
    expect(parseDominoId('6-0')).toEqual({ left: 6, right: 0 })
  })

  it('round-trips every tile', () => {
    for (const d of doubleSixSet()) {
      expect(parseDominoId(dominoId(d))).toEqual(d)
    }
  })
})

describe('PIP_LAYOUTS', () => {
  it('has exactly N pips for value N', () => {
    for (let v = 0; v <= 6; v++) {
      expect(PIP_LAYOUTS[v]).toHaveLength(v)
    }
  })
})
