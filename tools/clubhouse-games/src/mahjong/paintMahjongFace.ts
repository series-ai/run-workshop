import { darken, lighten, roundRectPath } from '../canvasUtils'
import { TILE_CJK_FONT } from './fonts'
import { MahjongTile } from './types'

export const MAHJONG_W = 256
export const MAHJONG_H = 360

const IVORY = '#f4eedd'
const INK = '#20202a'
const RED = '#bf1424'
const GREEN = '#166b3b'
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
  2: [[0, -0.62], [0, 0.62]],
  3: [[0, -0.9], [0, 0], [0, 0.9]],
  4: [[-1, -0.62], [1, -0.62], [-1, 0.62], [1, 0.62]],
  5: [[-1, -0.9], [1, -0.9], [0, 0], [-1, 0.9], [1, 0.9]],
  6: [[-1, -0.9], [1, -0.9], [-1, 0], [1, 0], [-1, 0.9], [1, 0.9]],
  7: [[-1, -0.9], [0, -0.9], [1, -0.9], [-1, 0], [0, 0], [1, 0], [0, 0.9]],
  8: [[-1, -0.9], [0, -0.9], [1, -0.9], [-1, 0], [1, 0], [-1, 0.9], [0, 0.9], [1, 0.9]],
  9: [[-1, -0.9], [0, -0.9], [1, -0.9], [-1, 0], [0, 0], [1, 0], [-1, 0.9], [0, 0.9], [1, 0.9]],
}

export function paintMahjongFace(tile: MahjongTile, opts: { scale?: number } = {}): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const W = Math.round(MAHJONG_W * s)
  const H = Math.round(MAHJONG_H * s)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, W, H)
  drawTileBody(ctx, W, H, s)

  switch (tile.kind) {
    case 'suit':
      if (tile.suit === 'characters') paintCharacterFace(ctx, tile.value, W, H, s)
      else paintSuitPips(ctx, tile.suit, tile.value, W, H, s)
      break
    case 'wind':
      paintGlyph(ctx, WIND_GLYPH[tile.wind], INK, W / 2, H / 2, 152 * s, s)
      break
    case 'dragon':
      if (tile.dragon === 'white') paintWhiteDragon(ctx, W, H, s)
      else paintGlyph(ctx, DRAGON_GLYPH[tile.dragon], tile.dragon === 'red' ? RED : GREEN, W / 2, H / 2, 170 * s, s)
      break
    case 'bonus':
      paintGlyph(
        ctx,
        BONUS_GLYPH[tile.bonus],
        tile.bonus === 'bamboo' || tile.bonus === 'summer' ? GREEN : RED,
        W / 2,
        H / 2,
        150 * s,
        s,
      )
      break
  }
  return canvas
}

// The ivory face is set into the tile, so it carries a bevel and a recessed
// panel rather than being a flat rectangle of color.
function drawTileBody(ctx: CanvasRenderingContext2D, W: number, H: number, s: number): void {
  const r = 18 * s
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  const grad = ctx.createLinearGradient(0, 0, W * 0.6, H)
  grad.addColorStop(0, lighten(IVORY, 0.06))
  grad.addColorStop(0.55, IVORY)
  grad.addColorStop(1, darken(IVORY, 0.1))
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  ctx.clip()
  ctx.lineWidth = 5 * s
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.moveTo(4 * s, H - r)
  ctx.lineTo(4 * s, r)
  ctx.quadraticCurveTo(4 * s, 4 * s, r, 4 * s)
  ctx.lineTo(W - r, 4 * s)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(96,80,48,0.28)'
  ctx.beginPath()
  ctx.moveTo(W - 4 * s, r)
  ctx.lineTo(W - 4 * s, H - r)
  ctx.quadraticCurveTo(W - 4 * s, H - 4 * s, W - r, H - 4 * s)
  ctx.lineTo(r, H - 4 * s)
  ctx.stroke()
  ctx.restore()

  // Recessed panel the design sits in.
  roundRectPath(ctx, 12 * s, 12 * s, W - 24 * s, H - 24 * s, r - 7 * s)
  ctx.strokeStyle = 'rgba(112,94,58,0.35)'
  ctx.lineWidth = 1.6 * s
  ctx.stroke()
}

// Carved and painted: a soft dark offset for the cut, then the color, then a
// hairline edge.
function paintGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  color: string,
  cx: number,
  cy: number,
  px: number,
  s: number,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${px}px ${TILE_CJK_FONT}`
  ctx.fillStyle = 'rgba(70,56,30,0.28)'
  ctx.fillText(glyph, cx + 2.5 * s, cy + 3 * s)
  ctx.fillStyle = color
  ctx.fillText(glyph, cx, cy)
  ctx.lineWidth = 1 * s
  ctx.strokeStyle = darken(color, 0.45)
  ctx.strokeText(glyph, cx, cy)
}

function paintWhiteDragon(ctx: CanvasRenderingContext2D, W: number, H: number, s: number): void {
  // White dragon: traditionally blank inside a blue frame.
  ctx.strokeStyle = BLUE
  ctx.lineWidth = 7 * s
  roundRectPath(ctx, W * 0.2, H * 0.24, W * 0.6, H * 0.52, 10 * s)
  ctx.stroke()
  ctx.strokeStyle = lighten(BLUE, 0.35)
  ctx.lineWidth = 2 * s
  roundRectPath(ctx, W * 0.24, H * 0.28, W * 0.52, H * 0.44, 7 * s)
  ctx.stroke()
  // Corner ticks, as the printed frame carries.
  ctx.strokeStyle = BLUE
  ctx.lineWidth = 4 * s
  for (const [x, y, dx, dy] of [
    [W * 0.2, H * 0.24, 1, 1],
    [W * 0.8, H * 0.24, -1, 1],
    [W * 0.8, H * 0.76, -1, -1],
    [W * 0.2, H * 0.76, 1, -1],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x + dx * 16 * s, y + dy * 4 * s)
    ctx.lineTo(x + dx * 4 * s, y + dy * 4 * s)
    ctx.lineTo(x + dx * 4 * s, y + dy * 16 * s)
    ctx.stroke()
  }
}

function paintCharacterFace(
  ctx: CanvasRenderingContext2D,
  value: number,
  W: number,
  H: number,
  s: number,
): void {
  paintGlyph(ctx, NUMERAL[value - 1], INK, W / 2, H * 0.33, 120 * s, s)
  paintGlyph(ctx, '萬', RED, W / 2, H * 0.68, 112 * s, s)
}

function paintSuitPips(
  ctx: CanvasRenderingContext2D,
  suit: 'dots' | 'bamboo',
  value: number,
  W: number,
  H: number,
  s: number,
): void {
  // One bamboo is a bird on every traditional set, not a stick.
  if (suit === 'bamboo' && value === 1) {
    drawBird(ctx, W / 2, H / 2, 78 * s, s)
    return
  }

  const layout = SUIT_LAYOUTS[value]
  const big = value === 1
  layout.forEach(([nx, ny], i) => {
    const x = W / 2 + nx * W * 0.26
    const y = H / 2 + ny * H * 0.28
    if (suit === 'dots') {
      drawDotPip(ctx, x, y, (big ? 2 : 1) * 30 * s, [GREEN, RED, BLUE][i % 3], s)
    } else {
      // Bamboo tiles are green cane; a lone middle stick is printed red.
      const centred = layout.length % 2 === 1 && nx === 0 && ny === 0
      drawBambooPip(ctx, x, y, 80 * s, centred ? RED : GREEN, s)
    }
  })
}

// Concentric rings with a colored core, the way a printed dot tile reads.
function drawDotPip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  s: number,
): void {
  ctx.fillStyle = 'rgba(70,56,30,0.2)'
  ctx.beginPath()
  ctx.arc(x + 2 * s, y + 2.5 * s, r * 0.8, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.8, 0, Math.PI * 2)
  ctx.fillStyle = lighten(color, 0.78)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = r * 0.17
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.48, 0, Math.PI * 2)
  ctx.strokeStyle = darken(color, 0.15)
  ctx.lineWidth = r * 0.1
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, r * 0.24, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

// A jointed stick with nodes and a leaf pair, rather than a plain bar.
function drawBambooPip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  color: string,
  s: number,
): void {
  const w = h * 0.4
  ctx.fillStyle = 'rgba(70,56,30,0.18)'
  roundRectPath(ctx, x - w / 2 + 2 * s, y - h / 2 + 2.5 * s, w, h, w / 2)
  ctx.fill()

  const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
  grad.addColorStop(0, color)
  grad.addColorStop(0.4, lighten(color, 0.35))
  grad.addColorStop(1, darken(color, 0.2))
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, w / 2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = darken(color, 0.4)
  ctx.lineWidth = 1.4 * s
  ctx.stroke()

  // Nodes.
  ctx.beginPath()
  for (const t of [-0.18, 0.18]) {
    ctx.moveTo(x - w / 2, y + h * t)
    ctx.lineTo(x + w / 2, y + h * t)
  }
  ctx.stroke()

  // Leaf pair at the head.
  ctx.fillStyle = darken(color, 0.1)
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(x, y - h / 2)
    ctx.quadraticCurveTo(x + dir * w * 1.1, y - h * 0.62, x + dir * w * 0.35, y - h * 0.78)
    ctx.quadraticCurveTo(x + dir * w * 0.2, y - h * 0.6, x, y - h / 2)
    ctx.fill()
  }
}

// One bamboo: a perched sparrow.
function drawBird(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, s: number): void {
  ctx.save()
  ctx.translate(cx, cy)

  // Tail.
  ctx.fillStyle = GREEN
  ctx.beginPath()
  ctx.moveTo(0.1 * r, 0.35 * r)
  ctx.lineTo(-0.95 * r, 0.95 * r)
  ctx.lineTo(-0.5 * r, 0.3 * r)
  ctx.closePath()
  ctx.fill()

  // Body.
  const body = ctx.createLinearGradient(-0.6 * r, -0.6 * r, 0.6 * r, 0.6 * r)
  body.addColorStop(0, lighten(GREEN, 0.3))
  body.addColorStop(1, darken(GREEN, 0.15))
  ctx.beginPath()
  ctx.ellipse(0, 0, 0.62 * r, 0.5 * r, -0.35, 0, Math.PI * 2)
  ctx.fillStyle = body
  ctx.fill()
  ctx.strokeStyle = darken(GREEN, 0.45)
  ctx.lineWidth = 2 * s
  ctx.stroke()

  // Wing.
  ctx.beginPath()
  ctx.moveTo(-0.42 * r, -0.05 * r)
  ctx.quadraticCurveTo(0.1 * r, -0.1 * r, 0.2 * r, 0.42 * r)
  ctx.quadraticCurveTo(-0.15 * r, 0.35 * r, -0.42 * r, -0.05 * r)
  ctx.fillStyle = RED
  ctx.fill()
  ctx.strokeStyle = darken(RED, 0.4)
  ctx.stroke()

  // Head, beak, eye.
  ctx.beginPath()
  ctx.arc(0.5 * r, -0.5 * r, 0.28 * r, 0, Math.PI * 2)
  ctx.fillStyle = lighten(GREEN, 0.2)
  ctx.fill()
  ctx.strokeStyle = darken(GREEN, 0.45)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0.72 * r, -0.58 * r)
  ctx.lineTo(1.05 * r, -0.44 * r)
  ctx.lineTo(0.72 * r, -0.36 * r)
  ctx.closePath()
  ctx.fillStyle = '#d8a02a'
  ctx.fill()
  ctx.strokeStyle = darken('#d8a02a', 0.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0.55 * r, -0.55 * r, 0.06 * r, 0, Math.PI * 2)
  ctx.fillStyle = INK
  ctx.fill()

  // Perch.
  ctx.strokeStyle = darken(GREEN, 0.3)
  ctx.lineWidth = 5 * s
  ctx.beginPath()
  ctx.moveTo(-0.75 * r, 0.98 * r)
  ctx.lineTo(0.75 * r, 0.98 * r)
  ctx.stroke()
  ctx.lineWidth = 3 * s
  ctx.beginPath()
  ctx.moveTo(0.15 * r, 0.45 * r)
  ctx.lineTo(0.2 * r, 0.95 * r)
  ctx.moveTo(-0.05 * r, 0.45 * r)
  ctx.lineTo(-0.02 * r, 0.95 * r)
  ctx.stroke()

  ctx.restore()
}
