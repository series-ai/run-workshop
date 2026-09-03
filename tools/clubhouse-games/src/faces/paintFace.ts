import { CARD_H, CARD_RADIUS, CARD_W } from '../constants'
import { roundRectPath } from '../canvasUtils'
import { Card, suitColor } from '../types'
import { isSpotRank, pipLayout } from './pipLayouts'
import { drawSuitPath } from './suitPaths'

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

  // Card body: off-white with rounded corners; transparent outside.
  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, CARD_RADIUS * scale)
  ctx.fillStyle = opts.background ?? '#f8f6f0'
  ctx.fill()
  ctx.lineWidth = 3 * scale
  ctx.strokeStyle = opts.borderColor ?? '#c9c4b8'
  ctx.stroke()

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
    ctx.font = `700 ${64 * scale}px Georgia, "Times New Roman", serif`
    ctx.fillText(card.rank, 0, 0)
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
    ctx.save()
    ctx.translate(W / 2, H / 2)
    drawSuitPath(ctx, card.suit, 150 * scale)
    ctx.restore()
    return
  }
  if (isSpotRank(card.rank)) {
    // Pip grid over the inner field between the corner indices.
    const fieldW = W * 0.62
    const fieldH = H * 0.62
    for (const pip of pipLayout(card.rank)) {
      ctx.save()
      ctx.translate(W / 2 + pip.x * fieldW, H / 2 + pip.y * fieldH)
      if (pip.inverted) ctx.rotate(Math.PI)
      drawSuitPath(ctx, card.suit, 40 * scale)
      ctx.restore()
    }
    return
  }
  // Court cards (J/Q/K): two-headed geometric style — the rank letter in
  // each half (bottom rotated 180°, like a real deck), suit pip at center.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${130 * scale}px Georgia, "Times New Roman", serif`
  for (const [y, rot] of [[-H * 0.24, 0], [H * 0.24, Math.PI]] as const) {
    ctx.save()
    ctx.translate(W / 2, H / 2 + y)
    ctx.rotate(rot)
    ctx.fillText(card.rank, 0, 0)
    ctx.restore()
  }
  ctx.save()
  ctx.translate(W / 2, H / 2)
  drawSuitPath(ctx, card.suit, 55 * scale)
  ctx.restore()
}
