import { darken, lighten, roundRectPath } from '../canvasUtils'
import { PIP_LAYOUTS } from './set'
import { Domino } from './types'

export const DOMINO_W = 256
export const DOMINO_H = 512

export interface PaintDominoOptions {
  scale?: number
  // Face (bone) and pip colors. Both must be #rrggbb: the bevel and the
  // drilled pips derive lighter and darker tints from them.
  faceColor?: string
  pipColor?: string
  // Brass pivot at the middle of the divider. Real sets carry one.
  spinner?: boolean
}

export function paintDomino(domino: Domino, opts: PaintDominoOptions = {}): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const W = Math.round(DOMINO_W * s)
  const H = Math.round(DOMINO_H * s)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const pipColor = opts.pipColor ?? '#20202a'
  const faceColor = opts.faceColor ?? '#f2ecda'

  ctx.clearRect(0, 0, W, H)
  drawBody(ctx, W, H, faceColor, s)
  drawDivider(ctx, W, H, pipColor, opts.spinner ?? true, s)
  drawHalf(ctx, PIP_LAYOUTS[domino.left], W, H / 2, 0, pipColor, s)
  drawHalf(ctx, PIP_LAYOUTS[domino.right], W, H / 2, H / 2, pipColor, s)
  return canvas
}

// Bone tile: warm gradient, a bevelled rim, and an inset rule.
function drawBody(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  faceColor: string,
  s: number,
): void {
  const r = 24 * s
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  const grad = ctx.createLinearGradient(0, 0, W * 0.7, H)
  grad.addColorStop(0, lighten(faceColor, 0.05))
  grad.addColorStop(0.5, faceColor)
  grad.addColorStop(1, darken(faceColor, 0.09))
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  ctx.clip()
  // Bevel: a light rim at the top-left, a darker one at the bottom-right.
  ctx.lineWidth = 5 * s
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.beginPath()
  ctx.moveTo(4 * s, H - r)
  ctx.lineTo(4 * s, r)
  ctx.quadraticCurveTo(4 * s, 4 * s, r, 4 * s)
  ctx.lineTo(W - r, 4 * s)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(90,74,44,0.3)'
  ctx.beginPath()
  ctx.moveTo(W - 4 * s, r)
  ctx.lineTo(W - 4 * s, H - r)
  ctx.quadraticCurveTo(W - 4 * s, H - 4 * s, W - r, H - 4 * s)
  ctx.lineTo(r, H - 4 * s)
  ctx.stroke()
  ctx.restore()

  ctx.lineWidth = 1.5 * s
  ctx.strokeStyle = 'rgba(120,102,66,0.45)'
  roundRectPath(ctx, 11 * s, 11 * s, W - 22 * s, H - 22 * s, r - 8 * s)
  ctx.stroke()
}

// The divider is cut into the tile, so it gets a dark groove with a lit lip
// under it.
function drawDivider(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pipColor: string,
  spinner: boolean,
  s: number,
): void {
  const x0 = W * 0.17
  const x1 = W * 0.83
  ctx.lineCap = 'round'
  ctx.strokeStyle = pipColor
  ctx.globalAlpha = 0.85
  ctx.lineWidth = 3.5 * s
  ctx.beginPath()
  ctx.moveTo(x0, H / 2)
  ctx.lineTo(x1, H / 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.globalAlpha = 1
  ctx.lineWidth = 1.6 * s
  ctx.beginPath()
  ctx.moveTo(x0, H / 2 + 3.2 * s)
  ctx.lineTo(x1, H / 2 + 3.2 * s)
  ctx.stroke()

  if (!spinner) return
  const r = 11 * s
  const g = ctx.createRadialGradient(W / 2 - r * 0.4, H / 2 - r * 0.4, r * 0.15, W / 2, H / 2, r)
  g.addColorStop(0, '#f6e4b0')
  g.addColorStop(0.55, '#c9a24e')
  g.addColorStop(1, '#8a6a25')
  ctx.beginPath()
  ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 1.6 * s
  ctx.strokeStyle = 'rgba(50,38,12,0.55)'
  ctx.stroke()
}

// Pips are drilled, not painted: a countersunk ring on the tile, a dark hole,
// and a lit rim on the side away from the light.
function drawHalf(
  ctx: CanvasRenderingContext2D,
  layout: readonly (readonly [number, number])[],
  W: number,
  halfH: number,
  offsetY: number,
  pipColor: string,
  s: number,
): void {
  const r = 17 * s
  for (const [nx, ny] of layout) {
    const x = W / 2 + nx * W * 0.28
    const y = offsetY + halfH / 2 + ny * halfH * 0.3

    ctx.beginPath()
    ctx.arc(x, y, r * 1.16, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(96,80,48,0.22)'
    ctx.lineWidth = 2.4 * s
    ctx.stroke()

    const hole = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
    hole.addColorStop(0, lighten(pipColor, 0.08))
    hole.addColorStop(0.6, pipColor)
    hole.addColorStop(1, darken(pipColor, 0.35))
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = hole
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, r * 0.82, Math.PI * 0.12, Math.PI * 0.78)
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 2.6 * s
    ctx.stroke()
  }
}
