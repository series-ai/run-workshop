import { roundRectPath } from '../canvasUtils'
import { PIP_LAYOUTS } from './set'
import { Domino } from './types'

export const DOMINO_W = 256
export const DOMINO_H = 512

export interface PaintDominoOptions {
  scale?: number
  // Face (ivory) and pip/divider colors.
  faceColor?: string
  pipColor?: string
}

export function paintDomino(domino: Domino, opts: PaintDominoOptions = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(DOMINO_W * scale)
  const H = Math.round(DOMINO_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const pipColor = opts.pipColor ?? '#1c1c22'

  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, 24 * scale)
  ctx.fillStyle = opts.faceColor ?? '#f0ead8'
  ctx.fill()
  ctx.lineWidth = 2 * scale
  ctx.strokeStyle = '#c9c0a8'
  ctx.stroke()

  // Divider.
  ctx.strokeStyle = pipColor
  ctx.lineWidth = 3 * scale
  ctx.beginPath()
  ctx.moveTo(W * 0.15, H / 2)
  ctx.lineTo(W * 0.85, H / 2)
  ctx.stroke()

  drawHalf(ctx, PIP_LAYOUTS[domino.left], W, H / 2, 0, pipColor, scale)
  drawHalf(ctx, PIP_LAYOUTS[domino.right], W, H / 2, H / 2, pipColor, scale)
  return canvas
}

function drawHalf(
  ctx: CanvasRenderingContext2D,
  layout: readonly (readonly [number, number])[],
  W: number,
  halfH: number,
  offsetY: number,
  pipColor: string,
  scale: number,
): void {
  ctx.fillStyle = pipColor
  const r = 16 * scale
  for (const [nx, ny] of layout) {
    ctx.beginPath()
    ctx.arc(W / 2 + nx * W * 0.28, offsetY + halfH / 2 + ny * halfH * 0.3, r, 0, Math.PI * 2)
    ctx.fill()
  }
}
