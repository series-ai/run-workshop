import { CARD_H, CARD_RADIUS, CARD_W } from '../constants'
import { roundRectPath } from '../canvasUtils'
import { BackTheme } from './backThemes'

export interface PaintBackOptions {
  scale?: number
}

export function paintBack(theme: BackTheme, opts: PaintBackOptions = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(CARD_W * scale)
  const H = Math.round(CARD_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, CARD_RADIUS * scale)
  ctx.fillStyle = theme.base
  ctx.fill()

  // Clip to the card body so the pattern respects the rounded corners.
  ctx.save()
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, CARD_RADIUS * scale)
  ctx.clip()
  drawPattern(ctx, theme, W, H, scale)

  // Double border inset.
  roundRectPath(ctx, 24 * scale, 24 * scale, W - 48 * scale, H - 48 * scale, 22 * scale)
  ctx.strokeStyle = theme.borderColor
  ctx.lineWidth = 6 * scale
  ctx.stroke()
  roundRectPath(ctx, 36 * scale, 36 * scale, W - 72 * scale, H - 72 * scale, 14 * scale)
  ctx.lineWidth = 2 * scale
  ctx.stroke()
  ctx.restore()

  return canvas
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  W: number,
  H: number,
  scale: number,
): void {
  switch (theme.pattern) {
    case 'lattice': {
      ctx.strokeStyle = theme.patternColor
      ctx.lineWidth = 4 * scale
      const step = 44 * scale
      for (let x = -H; x < W + H; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x + H, H)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(x + H, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      break
    }
    case 'stripes': {
      ctx.strokeStyle = theme.patternColor
      ctx.lineWidth = 6 * scale
      const step = 36 * scale
      for (let x = step / 2; x < W; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      break
    }
    case 'dots': {
      ctx.fillStyle = theme.patternColor
      const step = 40 * scale
      const r = 5 * scale
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
  }
}
