import { Card, RANKS, Rank, SUITS, Suit } from './types'

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })))
}

const SUIT_LETTER: Record<Suit, string> = {
  spades: 'S',
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
}

export function cardId(card: Card): string {
  return `${card.rank}${SUIT_LETTER[card.suit]}`
}

export function parseCardId(id: string): Card {
  const suitLetter = id.slice(-1)
  const suit = SUITS.find((s) => SUIT_LETTER[s] === suitLetter)
  const rank = RANKS.find((r) => r === id.slice(0, -1))
  if (!suit || !rank) {
    throw new Error(`Invalid card id: ${JSON.stringify(id)}`)
  }
  return { rank: rank as Rank, suit }
}
