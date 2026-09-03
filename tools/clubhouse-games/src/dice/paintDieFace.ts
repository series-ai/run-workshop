import { roundRectPath } from '../canvasUtils'
import { DIE_PALETTES, DieColorway } from './colorways'
import { DieStyle } from './kinds'
import { DIE_PIP_LAYOUTS, DieValue } from './pipFaces'

export const DIE_FACE_PX = 256

export interface PaintDieFaceOptions {
  scale?: number
  faceColor?: string
  pipColor?: string
  style?: DieStyle
  colorway?: DieColorway
}

export function paintDieFace(value: DieValue, opts: PaintDieFaceOptions = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const style = opts.style ?? 'pip'
  if (style === 'numeral') {
    throw new Error('paintDieFace does not paint numerals; use paintDieNumeral')
  }
  const pal = DIE_PALETTES[opts.colorway ?? 'ivory']
  const S = Math.round(DIE_FACE_PX * scale)
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!

  ctx.clearRect(0, 0, S, S)
  // Opaque edge fill first: transparent corners would punch through a cube face
  // and show the felt inside the die.
  ctx.fillStyle = pal.edge
  ctx.fillRect(0, 0, S, S)
  roundRectPath(ctx, 2 * scale, 2 * scale, S - 4 * scale, S - 4 * scale, 28 * scale)
  ctx.fillStyle = opts.faceColor ?? pal.face
  ctx.fill()

  if (style === 'ornate') {
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 3 * scale
    roundRectPath(ctx, 18 * scale, 18 * scale, S - 36 * scale, S - 36 * scale, 28 * scale)
    ctx.stroke()
    drawCornerTicks(ctx, S, scale, pal.accent)
  }

  const pipColor = opts.pipColor ?? pal.pip
  const r = (style === 'ornate' ? 16 : 18) * scale
  for (const [nx, ny] of DIE_PIP_LAYOUTS[value]) {
    const x = S / 2 + nx * S * 0.26
    const y = S / 2 + ny * S * 0.26
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = pipColor
    ctx.fill()
    if (style === 'ornate') {
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = r * 0.28
      ctx.stroke()
    }
  }
  return canvas
}

function drawCornerTicks(
  ctx: CanvasRenderingContext2D,
  S: number,
  scale: number,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 2 * scale
  const m = 32 * scale
  const len = 18 * scale
  const corners: Array<[number, number, number, number, number, number]> = [
    [m, m + len, m, m, m + len, m],
    [S - m, m + len, S - m, m, S - m - len, m],
    [m, S - m - len, m, S - m, m + len, S - m],
    [S - m, S - m - len, S - m, S - m, S - m - len, S - m],
  ]
  for (const [ax, ay, bx, by, cx, cy] of corners) {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.lineTo(cx, cy)
    ctx.stroke()
  }
}
