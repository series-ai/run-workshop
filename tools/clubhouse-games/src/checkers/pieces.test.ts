import { describe, expect, it } from 'vitest'
import {
  CHECKER_COLORS,
  CHECKER_PALETTES,
  checkerId,
  parseCheckerColor,
  playableSquares,
  startingCheckers,
} from './pieces'

const HEX = /^#[0-9a-f]{6}$/i

describe('checker palettes', () => {
  it('cover every color with well-formed values', () => {
    for (const color of CHECKER_COLORS) {
      const pal = CHECKER_PALETTES[color]
      expect(HEX.test(pal.base)).toBe(true)
      expect(HEX.test(pal.accent)).toBe(true)
    }
  })
})

describe('checkerId', () => {
  it('distinguishes crowned pieces', () => {
    expect(checkerId({ color: 'red', king: false })).toBe('red')
    expect(checkerId({ color: 'red', king: true })).toBe('red-king')
  })
})

describe('parseCheckerColor', () => {
  it('rejects an unknown color', () => {
    expect(parseCheckerColor('black')).toBe('black')
    expect(() => parseCheckerColor('blue')).toThrow(/Unknown checker color/)
  })
})

describe('startingCheckers', () => {
  it('gives each side twelve uncrowned pieces', () => {
    const side = startingCheckers('red')
    expect(side).toHaveLength(12)
    expect(side.every((p) => p.color === 'red' && !p.king)).toBe(true)
  })
})

describe('playableSquares', () => {
  it('returns the 32 same-colored squares of an 8x8 board', () => {
    const squares = playableSquares()
    expect(squares).toHaveLength(32)
    expect(squares.every((s) => (s.file + s.rank) % 2 === 0)).toBe(true)
    expect(new Set(squares.map((s) => `${s.file},${s.rank}`)).size).toBe(32)
  })
})
