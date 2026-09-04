export const CHECKER_COLORS = ['red', 'black'] as const
export type CheckerColor = (typeof CHECKER_COLORS)[number]

export interface CheckerPalette {
  base: string
  // Crown and the turned rings on the face.
  accent: string
}

export const CHECKER_PALETTES: Record<CheckerColor, CheckerPalette> = {
  red: { base: '#9d1f24', accent: '#e8c274' },
  black: { base: '#33323c', accent: '#c9b487' },
}

export interface Checker {
  color: CheckerColor
  // A crowned piece is two discs stacked, and moves in both directions.
  king: boolean
}

export function checkerId(piece: Checker): string {
  return `${piece.color}${piece.king ? '-king' : ''}`
}

export function parseCheckerColor(s: string): CheckerColor {
  if (!(CHECKER_COLORS as readonly string[]).includes(s)) {
    throw new Error(`Unknown checker color: ${JSON.stringify(s)}`)
  }
  return s as CheckerColor
}

// The twelve pieces one side starts with, all uncrowned.
export function startingCheckers(color: CheckerColor): Checker[] {
  return Array.from({ length: 12 }, () => ({ color, king: false }))
}

// Dark squares only, numbered the way a draughts board is: 1..32 from the
// far side. Returns board coordinates with the origin at the near-left.
export interface CheckerSquare {
  file: number
  rank: number
}

export function playableSquares(): CheckerSquare[] {
  const out: CheckerSquare[] = []
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      if ((file + rank) % 2 === 0) out.push({ file, rank })
    }
  }
  return out
}
