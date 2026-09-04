import { Rank } from '../types'

// A pip position normalized over the card's inner field: x in [-0.5, 0.5],
// y in [-0.7, 0.7] (negative y = top half). `inverted` pips are rotated 180°
// so two-headed reading works from either end of the card.
export interface Pip {
  x: number
  y: number
  inverted: boolean
}

export const SPOT_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'] as const
export type SpotRank = (typeof SPOT_RANKS)[number]

const COL = 0.5
const TOP = -0.6
const BOT = 0.6
const MID_TOP = -0.2
const MID_BOT = 0.2

const up = (x: number, y: number): Pip => ({ x, y, inverted: false })
const down = (x: number, y: number): Pip => ({ x, y, inverted: true })

const LAYOUTS: Record<SpotRank, Pip[]> = {
  '2': [up(0, TOP), down(0, BOT)],
  '3': [up(0, TOP), up(0, 0), down(0, BOT)],
  '4': [up(-COL, TOP), up(COL, TOP), down(-COL, BOT), down(COL, BOT)],
  '5': [
    up(-COL, TOP), up(COL, TOP), up(0, 0), down(-COL, BOT), down(COL, BOT),
  ],
  '6': [
    up(-COL, TOP), up(COL, TOP), up(-COL, 0), up(COL, 0),
    down(-COL, BOT), down(COL, BOT),
  ],
  '7': [
    up(-COL, TOP), up(COL, TOP), up(0, -0.3),
    up(-COL, 0), up(COL, 0),
    down(-COL, BOT), down(COL, BOT),
  ],
  '8': [
    up(-COL, TOP), up(COL, TOP), up(0, -0.3),
    up(-COL, 0), up(COL, 0),
    down(0, 0.3), down(-COL, BOT), down(COL, BOT),
  ],
  '9': [
    up(-COL, TOP), up(COL, TOP),
    up(-COL, MID_TOP), up(COL, MID_TOP),
    up(0, 0),
    down(-COL, MID_BOT), down(COL, MID_BOT),
    down(-COL, BOT), down(COL, BOT),
  ],
  '10': [
    up(-COL, TOP), up(COL, TOP), up(0, -0.42),
    up(-COL, MID_TOP), up(COL, MID_TOP),
    down(-COL, MID_BOT), down(COL, MID_BOT),
    down(0, 0.42), down(-COL, BOT), down(COL, BOT),
  ],
}

export function pipLayout(rank: SpotRank): Pip[] {
  return LAYOUTS[rank]
}

export function isSpotRank(rank: Rank): rank is SpotRank {
  return (SPOT_RANKS as readonly string[]).includes(rank)
}
