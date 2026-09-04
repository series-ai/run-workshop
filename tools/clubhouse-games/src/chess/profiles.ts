import { ChessType } from './pieces'

// A turned piece is a body of revolution, so each one is described by the
// profile a lathe would cut: [radius, height] pairs running from the foot up
// to the tip. Both are fractions of the piece's own height.
export type ProfilePoint = readonly [number, number]

const PAWN: ProfilePoint[] = [
  [0, 0], [0.42, 0], [0.42, 0.05], [0.39, 0.09], [0.28, 0.15],
  [0.17, 0.24], [0.14, 0.42], [0.17, 0.5], [0.26, 0.56], [0.26, 0.6],
  [0.16, 0.64], [0.15, 0.68], [0.24, 0.74], [0.27, 0.83],
  [0.22, 0.92], [0.13, 0.98], [0, 1],
]

const ROOK: ProfilePoint[] = [
  [0, 0], [0.42, 0], [0.42, 0.06], [0.39, 0.11], [0.3, 0.18],
  [0.27, 0.28], [0.27, 0.62], [0.3, 0.68], [0.36, 0.72], [0.36, 0.78],
  [0.33, 0.82], [0.33, 1], [0, 1],
]

const KNIGHT: ProfilePoint[] = [
  [0, 0], [0.42, 0], [0.42, 0.06], [0.39, 0.11], [0.3, 0.18],
  [0.26, 0.26], [0.24, 0.34], [0.26, 0.4], [0.22, 0.44], [0, 0.44],
]

const BISHOP: ProfilePoint[] = [
  [0, 0], [0.4, 0], [0.4, 0.05], [0.37, 0.09], [0.27, 0.15],
  [0.16, 0.23], [0.13, 0.36], [0.16, 0.43], [0.25, 0.48], [0.25, 0.52],
  [0.15, 0.56], [0.19, 0.62], [0.24, 0.72], [0.21, 0.82], [0.13, 0.88],
  [0.09, 0.9], [0.11, 0.94], [0.08, 0.97], [0, 1],
]

const QUEEN: ProfilePoint[] = [
  [0, 0], [0.42, 0], [0.42, 0.05], [0.39, 0.09], [0.28, 0.14],
  [0.17, 0.22], [0.14, 0.38], [0.17, 0.45], [0.27, 0.5], [0.27, 0.54],
  [0.16, 0.58], [0.2, 0.64], [0.25, 0.74], [0.22, 0.82], [0.26, 0.86],
  [0.26, 0.9], [0.2, 0.93], [0.1, 0.96], [0, 0.97],
]

const KING: ProfilePoint[] = [
  [0, 0], [0.42, 0], [0.42, 0.05], [0.39, 0.09], [0.29, 0.14],
  [0.17, 0.22], [0.14, 0.38], [0.17, 0.45], [0.27, 0.5], [0.27, 0.54],
  [0.16, 0.58], [0.2, 0.64], [0.25, 0.74], [0.22, 0.8], [0.26, 0.84],
  [0.26, 0.88], [0.18, 0.91], [0.12, 0.92], [0, 0.92],
]

const PROFILES: Record<ChessType, ProfilePoint[]> = {
  pawn: PAWN,
  rook: ROOK,
  knight: KNIGHT,
  bishop: BISHOP,
  queen: QUEEN,
  king: KING,
}

export function chessProfile(type: ChessType): ProfilePoint[] {
  const profile = PROFILES[type]
  if (!profile) throw new Error(`No lathe profile for ${JSON.stringify(type)}`)
  return profile
}

// The knight's head and the finials on the other pieces are carved, not
// turned, so they are built separately and sit on top of the lathe.
export function profileTop(type: ChessType): number {
  const profile = chessProfile(type)
  return profile[profile.length - 1][1]
}
