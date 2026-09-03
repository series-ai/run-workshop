import { roundRectPath } from '../canvasUtils'
import { MAHJONG_H, MAHJONG_W } from './paintMahjongFace'

export function paintMahjongBack(opts: { scale?: number } = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(MAHJONG_W * scale)
  const H = Math.round(MAHJONG_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, W, H)
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, 18 * scale)
  ctx.fillStyle = '#1a6b3c'
  ctx.fill()

  // Bamboo-rib texture: vertical striations clipped to the face.
  ctx.save()
  roundRectPath(ctx, 2 * scale, 2 * scale, W - 4 * scale, H - 4 * scale, 18 * scale)
  ctx.clip()
  ctx.strokeStyle = '#145a32'
  ctx.lineWidth = 3 * scale
  for (let x = 8 * scale; x < W; x += 16 * scale) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  ctx.restore()
  return canvas
}
