import { darken, lighten, roundRectPath } from '../canvasUtils'
import { DIE_PALETTES, DieColorway } from './colorways'
import { DieStyle } from './kinds'
import { DIE_PIP_LAYOUTS, DieValue } from './pipFaces'

export const DIE_FACE_PX = 256

export interface PaintDieFaceOptions {
  scale?: number
  // Overrides for the colorway. Both must be #rrggbb: the shading derives
  // lighter and darker tints from them.
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
  const faceColor = opts.faceColor ?? pal.face
  roundRectPath(ctx, 2 * scale, 2 * scale, S - 4 * scale, S - 4 * scale, 28 * scale)
  const body = ctx.createLinearGradient(0, 0, S * 0.7, S)
  body.addColorStop(0, lighten(faceColor, 0.12))
  body.addColorStop(0.55, faceColor)
  body.addColorStop(1, darken(faceColor, 0.12))
  ctx.fillStyle = body
  ctx.fill()

  // Bevelled rim, so the face reads as a moulded surface under the lighting.
  ctx.save()
  roundRectPath(ctx, 2 * scale, 2 * scale, S - 4 * scale, S - 4 * scale, 28 * scale)
  ctx.clip()
  ctx.lineWidth = 7 * scale
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.moveTo(5 * scale, S - 28 * scale)
  ctx.lineTo(5 * scale, 28 * scale)
  ctx.quadraticCurveTo(5 * scale, 5 * scale, 28 * scale, 5 * scale)
  ctx.lineTo(S - 28 * scale, 5 * scale)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.moveTo(S - 5 * scale, 28 * scale)
  ctx.lineTo(S - 5 * scale, S - 28 * scale)
  ctx.quadraticCurveTo(S - 5 * scale, S - 5 * scale, S - 28 * scale, S - 5 * scale)
  ctx.lineTo(28 * scale, S - 5 * scale)
  ctx.stroke()
  ctx.restore()

  if (style === 'ornate') {
    ctx.strokeStyle = pal.accent
    ctx.lineWidth = 4.5 * scale
    roundRectPath(ctx, 18 * scale, 18 * scale, S - 36 * scale, S - 36 * scale, 28 * scale)
    ctx.stroke()
    drawCornerTicks(ctx, S, scale, pal.accent)
  }

  const pipColor = opts.pipColor ?? pal.pip
  const r = (style === 'ornate' ? 16 : 18) * scale
  for (const [nx, ny] of DIE_PIP_LAYOUTS[value]) {
    const x = S / 2 + nx * S * 0.26
    const y = S / 2 + ny * S * 0.26
    // Pips are drilled: a countersunk ring, a dark hole shaded from the
    // upper left, and a lit rim on the far side.
    ctx.beginPath()
    ctx.arc(x, y, r * 1.13, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,0,0,0.14)'
    ctx.lineWidth = 2.4 * scale
    ctx.stroke()

    const hole = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
    hole.addColorStop(0, lighten(pipColor, 0.1))
    hole.addColorStop(0.6, pipColor)
    hole.addColorStop(1, darken(pipColor, 0.4))
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = hole
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, y, r * 0.82, Math.PI * 0.12, Math.PI * 0.78)
    ctx.strokeStyle = 'rgba(255,255,255,0.24)'
    ctx.lineWidth = 2.6 * scale
    ctx.stroke()

    if (style === 'ornate') {
      // Brass grommet around the drilled hole.
      ctx.beginPath()
      ctx.arc(x, y, r * 1.09, 0, Math.PI * 2)
      ctx.strokeStyle = pal.accent
      ctx.lineWidth = r * 0.16
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
