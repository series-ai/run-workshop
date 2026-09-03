import { describe, expect, it } from 'vitest'
import { riffle, riffleShuffle, riffleTraced } from './shuffle'

// Deterministic stand-in for Math.random.
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const DECK = Array.from({ length: 52 }, (_, i) => i)

describe('riffle', () => {
  it('keeps every card exactly once', () => {
    const out = riffle(DECK, { rng: seeded(7) })
    expect(out).toHaveLength(52)
    expect([...out].sort((a, b) => a - b)).toEqual(DECK)
  })

  it('leaves short packets alone', () => {
    expect(riffle([])).toEqual([])
    expect(riffle(['a'])).toEqual(['a'])
  })

  it('interleaves rather than just cutting', () => {
    const out = riffle(DECK, { rng: seeded(3) })
    expect(out).not.toEqual(DECK)
    // A plain cut would leave both halves in unbroken runs.
    let breaks = 0
    for (let i = 1; i < out.length; i++) if (out[i] !== out[i - 1] + 1) breaks += 1
    expect(breaks).toBeGreaterThan(5)
  })
})

describe('riffleTraced', () => {
  it('reports a cut near the middle and one origin per card', () => {
    const t = riffleTraced(DECK, { rng: seeded(11) })
    expect(t.cards).toHaveLength(52)
    expect(t.fromLeft).toHaveLength(52)
    expect(t.cut).toBeGreaterThan(52 * 0.3)
    expect(t.cut).toBeLessThan(52 * 0.7)
    expect(t.fromLeft.filter(Boolean)).toHaveLength(t.cut)
  })
})

describe('riffleShuffle', () => {
  it('rejects a pass count below one', () => {
    expect(() => riffleShuffle(DECK, 0)).toThrow(/at least one/)
  })

  it('keeps the deck intact and moves most cards', () => {
    const out = riffleShuffle(DECK, 7, { rng: seeded(23) })
    expect([...out].sort((a, b) => a - b)).toEqual(DECK)
    const fixed = out.filter((c, i) => c === i).length
    expect(fixed).toBeLessThan(5)
  })
})
