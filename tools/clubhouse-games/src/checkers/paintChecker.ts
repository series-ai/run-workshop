import { darken, lighten } from '../canvasUtils'
import { CheckerPalette } from './pieces'

export const CHECKER_FACE_PX = 512
export const CHECKER_EDGE_W = 1024
export const CHECKER_EDGE_H = 96

export interface PaintCheckerOptions {
  scale?: number
  king?: boolean
}

// The face of a draught: a turned disc with concentric rings, and a crown
// stamped on it once the piece is kinged.
export function paintCheckerFace(
  pal: CheckerPalette,
  opts: PaintCheckerOptions = {},
): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const S = Math.round(CHECKER_FACE_PX * s)
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  const c = S / 2
  const r = S / 2

  ctx.clearRect(0, 0, S, S)
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  const body = ctx.createLinearGradient(0, 0, S * 0.8, S)
  body.addColorStop(0, lighten(pal.base, 0.2))
  body.addColorStop(0.55, pal.base)
  body.addColorStop(1, darken(pal.base, 0.22))
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.clip()

  // Turned rings, cut into the face on a lathe.
  for (const [t, w, alpha] of [
    [0.86, 5, 0.35],
    [0.8, 2, 0.22],
    [0.66, 4, 0.3],
  ] as const) {
    ctx.beginPath()
    ctx.arc(c, c, r * t, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`
    ctx.lineWidth = w * s
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, r * t + w * s, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'
    ctx.lineWidth = 1.6 * s
    ctx.stroke()
  }

  // Recessed centre.
  ctx.beginPath()
  ctx.arc(c, c, r * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = darken(pal.base, 0.1)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 3 * s
  ctx.stroke()

  if (opts.king) drawCrown(ctx, pal, c, r * 0.44, s)
  ctx.restore()

  ctx.beginPath()
  ctx.arc(c, c, r - 2 * s, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.34)'
  ctx.lineWidth = 5 * s
  ctx.stroke()
  return canvas
}

function drawCrown(
  ctx: CanvasRenderingContext2D,
  pal: CheckerPalette,
  c: number,
  r: number,
  s: number,
): void {
  const w = r * 1.5
  const h = r * 1.05
  const top = c - h * 0.55
  const bottom = c + h * 0.5
  ctx.beginPath()
  ctx.moveTo(c - w / 2, bottom)
  ctx.lineTo(c - w / 2, c - h * 0.1)
  for (let i = 0; i < 3; i++) {
    const x0 = c - w / 2 + (i * w) / 3
    const xm = x0 + w / 6
    const x1 = x0 + w / 3
    ctx.lineTo(xm, top)
    ctx.lineTo(x1, c - h * 0.1)
  }
  ctx.lineTo(c + w / 2, bottom)
  ctx.closePath()
  const gold = ctx.createLinearGradient(c - w / 2, top, c + w / 2, bottom)
  gold.addColorStop(0, lighten(pal.accent, 0.3))
  gold.addColorStop(1, darken(pal.accent, 0.25))
  ctx.fillStyle = gold
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 3 * s
  ctx.stroke()

  // Pearls on the points and a band across the base.
  ctx.fillStyle = lighten(pal.accent, 0.5)
  for (let i = 0; i < 3; i++) {
    const xm = c - w / 2 + (i * w) / 3 + w / 6
    ctx.beginPath()
    ctx.arc(xm, top, r * 0.11, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'
    ctx.lineWidth = 2 * s
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(c - w / 2, bottom - h * 0.16)
  ctx.lineTo(c + w / 2, bottom - h * 0.16)
  ctx.strokeStyle = darken(pal.accent, 0.35)
  ctx.lineWidth = 5 * s
  ctx.stroke()
}

// The rim: a band of fine reeding, as moulded draughts carry so they can be
// picked off a stack.
export function paintCheckerEdge(
  pal: CheckerPalette,
  opts: PaintCheckerOptions = {},
): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const W = Math.round(CHECKER_EDGE_W * s)
  const H = Math.round(CHECKER_EDGE_H * s)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const body = ctx.createLinearGradient(0, 0, 0, H)
  body.addColorStop(0, darken(pal.base, 0.28))
  body.addColorStop(0.45, pal.base)
  body.addColorStop(1, darken(pal.base, 0.36))
  ctx.fillStyle = body
  ctx.fillRect(0, 0, W, H)

  const step = 10 * s
  for (let x = 0; x < W; x += step) {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 3 * s
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.lineWidth = 1.6 * s
    ctx.beginPath()
    ctx.moveTo(x + step * 0.4, 0)
    ctx.lineTo(x + step * 0.4, H)
    ctx.stroke()
  }
  return canvas
}
