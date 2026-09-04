import { darken, lighten, roundRectPath } from '../canvasUtils'
import { ChipDenomination } from './denominations'

export const CHIP_FACE_PX = 512
// The rim wraps once around the chip, so it is painted as a long strip.
export const CHIP_EDGE_W = 1024
export const CHIP_EDGE_H = 96

export interface PaintChipOptions {
  scale?: number
  // Inserts around the rim. Six is the usual count on a house chip.
  inserts?: number
}

// The face of a chip: clay body, an inset ring, the edge inserts showing at
// the rim, and the denomination in the middle.
export function paintChipFace(
  denom: ChipDenomination,
  opts: PaintChipOptions = {},
): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const inserts = opts.inserts ?? 6
  const S = Math.round(CHIP_FACE_PX * s)
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  const c = S / 2
  const r = S / 2

  ctx.clearRect(0, 0, S, S)

  // Clay body, lit from the upper left.
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  const body = ctx.createLinearGradient(0, 0, S * 0.8, S)
  body.addColorStop(0, lighten(denom.base, 0.14))
  body.addColorStop(0.55, denom.base)
  body.addColorStop(1, darken(denom.base, 0.16))
  ctx.fillStyle = body
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, r, 0, Math.PI * 2)
  ctx.clip()

  // Edge inserts, seen from above as blocks around the rim.
  ctx.fillStyle = denom.accent
  for (let i = 0; i < inserts; i++) {
    const a0 = (i / inserts) * Math.PI * 2
    const a1 = a0 + (Math.PI * 2) / inserts / 2
    ctx.beginPath()
    ctx.arc(c, c, r, a0, a1)
    ctx.arc(c, c, r * 0.76, a1, a0, true)
    ctx.closePath()
    ctx.fill()
  }

  // Recessed centre, where a real chip takes its printed inlay.
  ctx.beginPath()
  ctx.arc(c, c, r * 0.62, 0, Math.PI * 2)
  ctx.fillStyle = darken(denom.base, 0.06)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 4 * s
  ctx.stroke()

  // Fine dashed ring between the inlay and the inserts.
  ctx.strokeStyle = denom.accent
  ctx.lineWidth = 3 * s
  ctx.setLineDash([9 * s, 9 * s])
  ctx.beginPath()
  ctx.arc(c, c, r * 0.7, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  drawLabel(ctx, denom, c, r, s)
  ctx.restore()

  // Rim shading, so the disc does not read as a flat circle.
  ctx.beginPath()
  ctx.arc(c, c, r - 2 * s, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 5 * s
  ctx.stroke()

  return canvas
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  denom: ChipDenomination,
  c: number,
  r: number,
  s: number,
): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Long labels are condensed rather than allowed to run into the ring.
  const size = denom.label.length >= 3 ? 130 : 165
  ctx.font = `700 ${size * s}px Georgia, "Times New Roman", serif`
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillText(denom.label, c + 3 * s, c + 4 * s)
  ctx.fillStyle = denom.ink
  ctx.fillText(denom.label, c, c)

  // Small rules either side of the value.
  ctx.strokeStyle = denom.ink
  ctx.globalAlpha = 0.7
  ctx.lineWidth = 3 * s
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(c + side * r * 0.3, c - r * 0.34)
    ctx.lineTo(c + side * r * 0.46, c - r * 0.34)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(c + side * r * 0.3, c + r * 0.34)
    ctx.lineTo(c + side * r * 0.46, c + r * 0.34)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

// The rim, painted as a strip that wraps once around the chip: the inserts
// plus the fine reeding a moulded chip carries between them.
export function paintChipEdge(
  denom: ChipDenomination,
  opts: PaintChipOptions = {},
): HTMLCanvasElement {
  const s = opts.scale ?? 1
  const inserts = opts.inserts ?? 6
  const W = Math.round(CHIP_EDGE_W * s)
  const H = Math.round(CHIP_EDGE_H * s)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const body = ctx.createLinearGradient(0, 0, 0, H)
  body.addColorStop(0, darken(denom.base, 0.22))
  body.addColorStop(0.45, denom.base)
  body.addColorStop(1, darken(denom.base, 0.3))
  ctx.fillStyle = body
  ctx.fillRect(0, 0, W, H)

  const span = W / inserts
  for (let i = 0; i < inserts; i++) {
    const x = i * span
    ctx.fillStyle = denom.accent
    roundRectPath(ctx, x + span * 0.12, -H, span * 0.5, H * 3, 8 * s)
    ctx.fill()
  }

  // Reeding between the inserts.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 2 * s
  for (let x = 0; x < W; x += 7 * s) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }

  return canvas
}
