export const CHESS_TYPES = ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'] as const
export type ChessType = (typeof CHESS_TYPES)[number]

export const CHESS_COLORS = ['white', 'black'] as const
export type ChessColor = (typeof CHESS_COLORS)[number]

export interface ChessPalette {
  body: string
  // Felted base and the shadowed cuts.
  base: string
  roughness: number
}

export const CHESS_PALETTES: Record<ChessColor, ChessPalette> = {
  white: { body: '#efe6d2', base: '#c9bda2', roughness: 0.52 },
  black: { body: '#2a2730', base: '#15131a', roughness: 0.46 },
}

// Height of each piece relative to the king, following Staunton proportions.
export const CHESS_HEIGHTS: Record<ChessType, number> = {
  pawn: 0.5,
  rook: 0.56,
  knight: 0.62,
  bishop: 0.72,
  queen: 0.86,
  king: 1,
}

// How many of each a side starts with.
export const CHESS_COUNTS: Record<ChessType, number> = {
  pawn: 8,
  rook: 2,
  knight: 2,
  bishop: 2,
  queen: 1,
  king: 1,
}

export interface ChessPieceModel {
  type: ChessType
  color: ChessColor
}

export function chessPieceId(piece: ChessPieceModel): string {
  return `${piece.color}-${piece.type}`
}

export function parseChessType(s: string): ChessType {
  if (!(CHESS_TYPES as readonly string[]).includes(s)) {
    throw new Error(`Unknown chess piece: ${JSON.stringify(s)}`)
  }
  return s as ChessType
}

// One side's sixteen pieces, back rank first in file order.
export function startingChessSide(color: ChessColor): ChessPieceModel[] {
  const back: ChessType[] = [
    'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook',
  ]
  return [
    ...back.map((type) => ({ type, color })),
    ...Array.from({ length: 8 }, () => ({ type: 'pawn' as ChessType, color })),
  ]
}
