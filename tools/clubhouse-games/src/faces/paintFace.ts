import { CARD_H, CARD_RADIUS, CARD_W } from '../constants'
import { drawGuillocheBand, roundRectPath } from '../canvasUtils'
import { Card, suitColor } from '../types'
import { isSpotRank, pipLayout } from './pipLayouts'
import { drawSuitPath } from './suitPaths'
import { COURT_GOLD, COURT_INK, drawCourtHalf } from './courtFigures'

export interface PaintFaceOptions {
  // Resolution multiplier. 1 = 512x716; use 0.5 for dense grids.
  scale?: number
  // Card body fill.
  background?: string
  // Thin outline around the card body.
  borderColor?: string
}

export function paintFace(card: Card, opts: PaintFaceOptions = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(CARD_W * scale)
  const H = Math.round(CARD_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const color = suitColor(card.suit)

  // Card body: warm stock with rounded corners; transparent outside.
  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, CARD_RADIUS * scale)
  ctx.fillStyle = opts.background ?? '#faf8f2'
  ctx.fill()
  ctx.lineWidth = 2.5 * scale
  ctx.strokeStyle = opts.borderColor ?? '#c9c4b8'
  ctx.stroke()

  // Hairline keyline just inside the trim, as printed decks carry.
  roundRectPath(ctx, 10 * scale, 10 * scale, W - 20 * scale, H - 20 * scale, (CARD_RADIUS - 8) * scale)
  ctx.lineWidth = 1 * scale
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'
  ctx.stroke()

  ctx.save()
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, CARD_RADIUS * scale)
  ctx.clip()
  const shade = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, H * 0.72)
  shade.addColorStop(0, 'rgba(255,255,255,0)')
  shade.addColorStop(1, 'rgba(120,104,74,0.13)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  drawCornerIndices(ctx, card, color, W, H, scale)
  drawCenter(ctx, card, color, W, H, scale)
  return canvas
}

function drawCornerIndices(
  ctx: CanvasRenderingContext2D,
  card: Card,
  color: string,
  W: number,
  H: number,
  scale: number,
): void {
  const draw = (x: number, y: number, rotate: boolean) => {
    ctx.save()
    ctx.translate(x, y)
    if (rotate) ctx.rotate(Math.PI)
    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    // '10' is two glyphs wide, so it gets condensed to hold the column width.
    const wide = card.rank === '10'
    ctx.font = `700 ${(wide ? 56 : 64) * scale}px Georgia, "Times New Roman", serif`
    if (wide) {
      ctx.save()
      ctx.scale(0.82, 1)
      ctx.fillText(card.rank, 0, 0)
      ctx.restore()
    } else {
      ctx.fillText(card.rank, 0, 0)
    }
    // Path-drawn pip under the rank (never a font glyph — emoji risk).
    ctx.save()
    ctx.translate(0, 100 * scale)
    drawSuitPath(ctx, card.suit, 26 * scale)
    ctx.restore()
    ctx.restore()
  }
  draw(52 * scale, 18 * scale, false)
  draw(W - 52 * scale, H - 18 * scale, true)
}

function drawCenter(
  ctx: CanvasRenderingContext2D,
  card: Card,
  color: string,
  W: number,
  H: number,
  scale: number,
): void {
  ctx.fillStyle = color
  if (card.rank === 'A') {
    drawAce(ctx, card, color, W, H, scale)
    return
  }
  if (isSpotRank(card.rank)) {
    // Pip grid over the inner field between the corner indices.
    const fieldW = W * 0.6
    const fieldH = H * 0.6
    for (const pip of pipLayout(card.rank)) {
      ctx.save()
      ctx.translate(W / 2 + pip.x * fieldW, H / 2 + pip.y * fieldH)
      if (pip.inverted) ctx.rotate(Math.PI)
      drawSuitPath(ctx, card.suit, 44 * scale)
      ctx.restore()
    }
    return
  }
  drawCourt(ctx, card.rank as 'J' | 'Q' | 'K', card, color, W, H, scale)
}

// Ace: one oversized pip over a gold guilloche rose.
function drawAce(
  ctx: CanvasRenderingContext2D,
  card: Card,
  color: string,
  W: number,
  H: number,
  scale: number,
): void {
  const cx = W / 2
  const cy = H / 2
  const r = 138 * scale

  ctx.save()
  ctx.translate(cx, cy)

  ctx.strokeStyle = COURT_GOLD
  ctx.globalAlpha = 0.75
  ctx.lineWidth = 1.1 * scale
  drawGuillocheBand(ctx, {
    cx: 0,
    cy: 0,
    radius: r * 1.22,
    amplitude: r * 0.18,
    waves: 12,
    amplitude2: r * 0.04,
    waves2: 24,
    lines: 16,
  })
  ctx.globalAlpha = 1

  // Ring rules bracketing the rose.
  ctx.lineWidth = 2.5 * scale
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.56, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1 * scale
  ctx.beginPath()
  ctx.arc(0, 0, r * 1.62, 0, Math.PI * 2)
  ctx.stroke()

  // Pearls on the vertical axis.
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(0, dir * r * 1.59, 8 * scale, 0, Math.PI * 2)
    ctx.fillStyle = COURT_GOLD
    ctx.fill()
    ctx.strokeStyle = '#8f6f2c'
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
    ctx.strokeStyle = COURT_GOLD
  }

  // The pip itself, with a soft inked shadow behind it.
  ctx.save()
  ctx.translate(3 * scale, 4 * scale)
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  drawSuitPath(ctx, card.suit, r)
  ctx.restore()
  ctx.fillStyle = color
  drawSuitPath(ctx, card.suit, r)
  ctx.restore()
}

// Court: a framed panel holding the same figure twice, the lower copy turned
// 180 degrees, as a real deck prints them.
function drawCourt(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  card: Card,
  color: string,
  W: number,
  H: number,
  scale: number,
): void {
  const fx = 96 * scale
  const fy = 62 * scale
  const fw = W - 192 * scale
  const fh = H - 124 * scale

  ctx.save()
  roundRectPath(ctx, fx, fy, fw, fh, 8 * scale)
  ctx.fillStyle = '#fdfbf5'
  ctx.fill()
  ctx.save()
  ctx.clip()

  // A faint ground under the figure. Printed courts leave no dead white in
  // the panel, and the empty corners were most of what read as thin.
  ctx.save()
  ctx.strokeStyle = 'rgba(120,102,66,0.16)'
  ctx.lineWidth = 1 * scale
  const step = 20 * scale
  for (let x = fx - fh; x < fx + fw + fh; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, fy)
    ctx.lineTo(x + fh, fy + fh)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + fh, fy)
    ctx.lineTo(x, fy + fh)
    ctx.stroke()
  }
  ctx.restore()

  const half = { x: fx, y: fy, w: fw, h: fh / 2 }
  drawCourtHalf(ctx, rank, card.suit, color, half, scale)

  ctx.save()
  ctx.translate(fx + fw / 2, fy + fh / 2)
  ctx.rotate(Math.PI)
  ctx.translate(-(fx + fw / 2), -(fy + fh / 2))
  drawCourtHalf(ctx, rank, card.suit, color, half, scale)
  ctx.restore()

  ctx.restore()

  // Suit marks in opposite panel corners, as printed courts carry.
  for (const [cx, cy, rot] of [
    [fx + 26 * scale, fy + 30 * scale, 0],
    [fx + fw - 26 * scale, fy + fh - 30 * scale, Math.PI],
  ] as const) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    ctx.fillStyle = color
    drawSuitPath(ctx, card.suit, 17 * scale)
    ctx.restore()
  }

  // Divider between the halves, then the panel frame.
  ctx.beginPath()
  ctx.moveTo(fx, fy + fh / 2)
  ctx.lineTo(fx + fw, fy + fh / 2)
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  roundRectPath(ctx, fx, fy, fw, fh, 8 * scale)
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 3 * scale
  ctx.stroke()
  roundRectPath(ctx, fx + 6 * scale, fy + 6 * scale, fw - 12 * scale, fh - 12 * scale, 5 * scale)
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 1.5 * scale
  ctx.stroke()
  ctx.restore()
}
