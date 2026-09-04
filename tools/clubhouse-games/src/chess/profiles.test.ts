import { describe, expect, it } from 'vitest'
import { CHESS_COUNTS, CHESS_HEIGHTS, CHESS_TYPES, startingChessSide } from './pieces'
import { chessProfile, profileTop } from './profiles'

describe('chessProfile', () => {
  it('covers every piece', () => {
    for (const type of CHESS_TYPES) {
      expect(chessProfile(type).length).toBeGreaterThan(4)
    }
  })

  it('starts on the axis at the foot and never dips below it', () => {
    for (const type of CHESS_TYPES) {
      const profile = chessProfile(type)
      expect(profile[0]).toEqual([0, 0])
      for (const [radius, y] of profile) {
        expect(radius).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(1)
      }
    }
  })

  it('rises monotonically, so the lathe cannot fold back on itself', () => {
    for (const type of CHESS_TYPES) {
      const profile = chessProfile(type)
      for (let i = 1; i < profile.length; i++) {
        expect(profile[i][1]).toBeGreaterThanOrEqual(profile[i - 1][1])
      }
    }
  })

  it('gives the widest point to the base, so a piece stands up', () => {
    for (const type of CHESS_TYPES) {
      const profile = chessProfile(type)
      const widest = Math.max(...profile.map(([r]) => r))
      const baseRadius = Math.max(
        ...profile.filter(([, y]) => y <= 0.1).map(([r]) => r),
      )
      expect(baseRadius).toBeCloseTo(widest, 5)
    }
  })
})

describe('profileTop', () => {
  it('is where the carved parts get mounted', () => {
    // The knight's lathe stops early: its head is carved, not turned.
    expect(profileTop('knight')).toBeLessThan(0.6)
    expect(profileTop('pawn')).toBe(1)
  })
})

describe('chess piece set', () => {
  it('ranks the heights the way a Staunton set does', () => {
    const order = [...CHESS_TYPES].sort((a, b) => CHESS_HEIGHTS[a] - CHESS_HEIGHTS[b])
    expect(order).toEqual(['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'])
    expect(CHESS_HEIGHTS.king).toBe(1)
  })

  it('starts a side with sixteen pieces in the right counts', () => {
    const side = startingChessSide('white')
    expect(side).toHaveLength(16)
    for (const type of CHESS_TYPES) {
      expect(side.filter((p) => p.type === type)).toHaveLength(CHESS_COUNTS[type])
    }
    expect(side.every((p) => p.color === 'white')).toBe(true)
  })
})
