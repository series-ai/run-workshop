import { darken, lighten, roundRectPath } from '../canvasUtils'
import { MAHJONG_H, MAHJONG_W } from './paintMahjongFace'

const BAMBOO = '#1a6b3c'

export function paintMahjongBack(opts: { scale?: number } = {}): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const W = Math.round(MAHJONG_W * s)
  const H = Math.round(MAHJONG_H * s)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const r = 18 * s

  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  const grad = ctx.createLinearGradient(0, 0, W * 0.6, H)
  grad.addColorStop(0, lighten(BAMBOO, 0.12))
  grad.addColorStop(0.55, BAMBOO)
  grad.addColorStop(1, darken(BAMBOO, 0.22))
  ctx.fillStyle = grad
  ctx.fill()

  ctx.save()
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, r)
  ctx.clip()

  // Bamboo grain: paired striations with a highlight down each rib.
  for (let x = 10 * s; x < W; x += 22 * s) {
    ctx.strokeStyle = darken(BAMBOO, 0.3)
    ctx.lineWidth = 6 * s
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
    ctx.strokeStyle = lighten(BAMBOO, 0.16)
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.moveTo(x + 6 * s, 0)
    ctx.lineTo(x + 6 * s, H)
    ctx.stroke()
  }

  // Node bands across the ribs, as on a length of cane.
  ctx.strokeStyle = darken(BAMBOO, 0.42)
  ctx.lineWidth = 3 * s
  for (const t of [0.28, 0.72]) {
    ctx.beginPath()
    ctx.moveTo(0, H * t)
    ctx.lineTo(W, H * t)
    ctx.stroke()
  }

  // Bevel.
  ctx.lineWidth = 5 * s
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.beginPath()
  ctx.moveTo(4 * s, H - r)
  ctx.lineTo(4 * s, r)
  ctx.quadraticCurveTo(4 * s, 4 * s, r, 4 * s)
  ctx.lineTo(W - r, 4 * s)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.beginPath()
  ctx.moveTo(W - 4 * s, r)
  ctx.lineTo(W - 4 * s, H - r)
  ctx.quadraticCurveTo(W - 4 * s, H - 4 * s, W - r, H - 4 * s)
  ctx.lineTo(r, H - 4 * s)
  ctx.stroke()
  ctx.restore()

  return canvas
}
