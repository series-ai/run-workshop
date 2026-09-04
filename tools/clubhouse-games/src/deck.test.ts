import { describe, expect, it } from 'vitest'
import { cardId, fullDeck, parseCardId } from './deck'
import { isRedSuit, suitColor } from './types'

describe('fullDeck', () => {
  it('returns 52 cards with unique ids', () => {
    const deck = fullDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck.map(cardId)).size).toBe(52)
  })

  it('round-trips every card through cardId/parseCardId', () => {
    for (const card of fullDeck()) {
      expect(parseCardId(cardId(card))).toEqual(card)
    }
  })
})

describe('parseCardId', () => {
  it('rejects unknown ids', () => {
    expect(() => parseCardId('1S')).toThrow()
    expect(() => parseCardId('AX')).toThrow()
  })
})

describe('suitColor', () => {
  it('is red for hearts/diamonds and black for spades/clubs', () => {
    expect(isRedSuit('hearts')).toBe(true)
    expect(isRedSuit('diamonds')).toBe(true)
    expect(isRedSuit('spades')).toBe(false)
    expect(isRedSuit('clubs')).toBe(false)
    expect(suitColor('hearts')).toBe(suitColor('diamonds'))
    expect(suitColor('spades')).toBe(suitColor('clubs'))
    expect(suitColor('hearts')).not.toBe(suitColor('spades'))
  })
})
