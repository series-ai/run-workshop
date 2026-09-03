import { roundRectPath } from '../canvasUtils'
import { TILE_CJK_FONT } from './fonts'
import { MahjongTile } from './types'

export const MAHJONG_W = 256
export const MAHJONG_H = 360

const IVORY = '#f2ecdc'
const INK = '#1c1c22'
const RED = '#c01525'
const GREEN = '#1a6b3c'
const BLUE = '#1c4f9c'

// CJK glyphs per face.
const NUMERAL = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
const WIND_GLYPH = { east: '東', south: '南', west: '西', north: '北' } as const
const DRAGON_GLYPH = { red: '中', green: '發', white: '白' } as const
const BONUS_GLYPH = {
  plum: '梅', orchid: '蘭', chrysanthemum: '菊', bamboo: '竹',
  spring: '春', summer: '夏', autumn: '秋', winter: '冬',
} as const

// Suit pip positions on a 3-column grid, normalized to [-1, 1].
type Pos = readonly [number, number]
const SUIT_LAYOUTS: Record<number, readonly Pos[]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  7: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1]],
  8: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1], [0, -1], [0, 1]],
  9: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
}

export function paintMahjongFace(tile: MahjongTile, opts: { scale?: number } = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(MAHJONG_W * scale)
  const H = Math.round(MAHJONG_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, 18 * scale)
  ctx.fillStyle = IVORY
  ctx.fill()

  switch (tile.kind) {
    case 'suit':
      if (tile.suit === 'characters') paintCharacterFace(ctx, tile.value, W, H, scale)
      else paintSuitPips(ctx, tile.suit, tile.value, W, H, scale)
      break
    case 'wind':
      paintGlyph(ctx, WIND_GLYPH[tile.wind], INK, W, H, 150 * scale)
      break
    case 'dragon':
      if (tile.dragon === 'white') paintWhiteDragon(ctx, W, H, scale)
      else paintGlyph(ctx, DRAGON_GLYPH[tile.dragon], tile.dragon === 'red' ? RED : GREEN, W, H, 170 * scale)
      break
    case 'bonus':
      paintGlyph(ctx, BONUS_GLYPH[tile.bonus], tile.bonus === 'bamboo' || tile.bonus === 'summer' ? GREEN : RED, W, H, 150 * scale)
      break
  }
  return canvas
}

function paintGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  color: string,
  W: number,
  H: number,
  px: number,
): void {
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${px}px ${TILE_CJK_FONT}`
  ctx.fillText(glyph, W / 2, H / 2)
}

function paintWhiteDragon(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number): void {
  // White dragon: traditionally blank with a blue frame.
  ctx.strokeStyle = BLUE
  ctx.lineWidth = 6 * scale
  roundRectPath(ctx, W * 0.2, H * 0.25, W * 0.6, H * 0.5, 10 * scale)
  ctx.stroke()
}

function paintCharacterFace(ctx: CanvasRenderingContext2D, value: number, W: number, H: number, scale: number): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  ctx.font = `${120 * scale}px ${TILE_CJK_FONT}`
  ctx.fillText(NUMERAL[value - 1], W / 2, H * 0.34)
  ctx.fillStyle = RED
  ctx.font = `${110 * scale}px ${TILE_CJK_FONT}`
  ctx.fillText('萬', W / 2, H * 0.68)
}

function paintSuitPips(
  ctx: CanvasRenderingContext2D,
  suit: 'dots' | 'bamboo',
  value: number,
  W: number,
  H: number,
  scale: number,
): void {
  const layout = SUIT_LAYOUTS[value]
  const big = value === 1
  layout.forEach(([nx, ny], i) => {
    const x = W / 2 + nx * W * 0.26
    const y = H / 2 + ny * H * 0.28
    const color = [RED, GREEN, BLUE][i % 3]
    if (suit === 'dots') drawDotPip(ctx, x, y, (big ? 3 : 1) * 20 * scale, color)
    else drawBambooPip(ctx, x, y, (big ? 3 : 1) * 22 * scale, color)
  })
}

function drawDotPip(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = r * 0.22
  ctx.beginPath()
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r * 0.3, 0, Math.PI * 2)
  ctx.fill()
}

function drawBambooPip(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string): void {
  const w = h * 0.32
  ctx.fillStyle = color
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, w / 2)
  ctx.fill()
}
