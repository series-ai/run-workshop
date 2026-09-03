export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export type Rank =
  | 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export interface Card {
  rank: Rank
  suit: Suit
}

export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export const RANKS: readonly Rank[] = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
]

const RED = '#c01525'
const BLACK = '#1a1a1a'

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds'
}

export function suitColor(suit: Suit): string {
  return isRedSuit(suit) ? RED : BLACK
}
