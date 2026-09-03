import { Suit } from '../types'
import { drawSuitPath } from './suitPaths'

// Courts print from one fixed plate set, so the figure keeps the same regal
// colors in every suit. Only the pips carry the suit color.
export const COURT_INK = '#241f26'
export const COURT_GOLD = '#d0a54a'
export const COURT_GOLD_DEEP = '#a97f2e'
export const COURT_SKIN = '#f4dcc1'
export const COURT_BLUE = '#2f4d8f'
export const COURT_RED = '#a92130'
export const COURT_LINEN = '#fbf7ee'

export interface CourtBox {
  x: number
  y: number
  w: number
  h: number
}

// Draws one half of a two-headed court, filling `box` top-down. The caller
// draws it twice: upright, then rotated 180 degrees about the card center.
export function drawCourtHalf(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  suit: Suit,
  suitColor: string,
  box: CourtBox,
  scale: number,
): void {
  // Normalized helpers: u spans [-1, 1] across the box, v spans [0, 1] down it.
  const ux = (u: number) => box.x + box.w / 2 + (u * box.w) / 2
  const vy = (v: number) => box.y + v * box.h
  const un = (u: number) => (u * box.w) / 2
  const vn = (v: number) => v * box.h

  drawRegaliaBehind(ctx, rank, suit, ux, vy, un, scale)
  drawRobe(ctx, suit, suitColor, ux, vy, un, vn, scale)
  drawCollar(ctx, rank, ux, vy, un, scale)
  drawHead(ctx, rank, ux, vy, un, scale)
  drawHeadwear(ctx, rank, ux, vy, un, scale)
  drawRegaliaFront(ctx, rank, ux, vy, un, vn, scale)
}

type UX = (u: number) => number
type VY = (v: number) => number

function drawRobe(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  suitColor: string,
  ux: UX,
  vy: VY,
  un: UX,
  vn: VY,
  scale: number,
): void {
  const shoulders = () => {
    ctx.beginPath()
    ctx.moveTo(ux(-0.3), vy(0.49))
    ctx.lineTo(ux(-0.78), vy(0.57))
    ctx.quadraticCurveTo(ux(-0.99), vy(0.62), ux(-1.0), vy(0.74))
    ctx.lineTo(ux(-1.0), vy(1.0))
    ctx.lineTo(ux(1.0), vy(1.0))
    ctx.lineTo(ux(1.0), vy(0.74))
    ctx.quadraticCurveTo(ux(0.99), vy(0.62), ux(0.78), vy(0.57))
    ctx.closePath()
  }

  // Body in crimson, then blue sleeve panels either side.
  shoulders()
  ctx.fillStyle = COURT_RED
  ctx.fill()

  ctx.save()
  shoulders()
  ctx.clip()
  for (const side of [-1, 1]) {
    ctx.fillStyle = COURT_BLUE
    ctx.beginPath()
    ctx.moveTo(ux(side * 0.42), vy(0.53))
    ctx.quadraticCurveTo(ux(side * 0.72), vy(0.6), ux(side * 1.05), vy(0.66))
    ctx.lineTo(ux(side * 1.05), vy(1.0))
    ctx.lineTo(ux(side * 0.5), vy(1.0))
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 2 * scale
    ctx.stroke()
    // Cuff band.
    ctx.beginPath()
    ctx.moveTo(ux(side * 0.8), vy(0.88))
    ctx.lineTo(ux(side * 1.05), vy(0.9))
    ctx.strokeStyle = COURT_GOLD
    ctx.lineWidth = 6 * scale
    ctx.stroke()
  }

  // Diaper hatch over the crimson, the way engraved courts fill flat cloth.
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.4 * scale
  for (let i = -14; i < 22; i++) {
    const x0 = ux(-1) + i * 16 * scale
    ctx.beginPath()
    ctx.moveTo(x0, vy(0.5))
    ctx.lineTo(x0 + vn(0.5), vy(1.0))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x0, vy(0.5))
    ctx.lineTo(x0 - vn(0.5), vy(1.0))
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2.5 * scale
  shoulders()
  ctx.stroke()

  // Ermine placket down the middle, carrying the suit mark.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(ux(-0.17), vy(0.52))
  ctx.lineTo(ux(0.17), vy(0.52))
  ctx.lineTo(ux(0.21), vy(1.0))
  ctx.lineTo(ux(-0.21), vy(1.0))
  ctx.closePath()
  ctx.fillStyle = COURT_LINEN
  ctx.fill()
  ctx.strokeStyle = COURT_GOLD_DEEP
  ctx.lineWidth = 2.5 * scale
  ctx.stroke()
  ctx.clip()
  // Ermine ticks.
  ctx.fillStyle = COURT_INK
  for (let i = 0; i < 3; i++) {
    for (const u of [-0.1, 0.1]) {
      const v = 0.62 + i * 0.13
      ctx.beginPath()
      ctx.moveTo(ux(u), vy(v))
      ctx.lineTo(ux(u) + 4 * scale, vy(v) + 9 * scale)
      ctx.lineTo(ux(u) - 4 * scale, vy(v) + 9 * scale)
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.save()
  ctx.translate(ux(0), vy(0.58))
  ctx.fillStyle = suitColor
  drawSuitPath(ctx, suit, un(0.11))
  ctx.restore()
  ctx.restore()

  // Gold shoulder cord; the queen also gets a mantle line.
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 3 * scale
  ctx.beginPath()
  ctx.moveTo(ux(-0.44), vy(0.53))
  ctx.quadraticCurveTo(ux(0), vy(0.64), ux(0.44), vy(0.53))
  ctx.stroke()
}

function drawCollar(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  ux: UX,
  vy: VY,
  un: UX,
  scale: number,
): void {
  // Scalloped ruff sitting on the shoulders.
  const lobes = rank === 'Q' ? 9 : 7
  const r = un(0.08)
  ctx.beginPath()
  for (let i = 0; i < lobes; i++) {
    const u = -0.4 + (i / (lobes - 1)) * 0.8
    ctx.moveTo(ux(u) + r, vy(0.5))
    ctx.arc(ux(u), vy(0.5), r, 0, Math.PI * 2)
  }
  ctx.fillStyle = COURT_LINEN
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  ux: UX,
  vy: VY,
  un: UX,
  scale: number,
): void {
  const hair = rank === 'Q' ? '#8a5a2b' : '#4a3526'

  // Hair mass behind the face.
  ctx.beginPath()
  ctx.ellipse(ux(0), vy(0.34), un(0.34), un(0.4), 0, 0, Math.PI * 2)
  ctx.fillStyle = hair
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  // Face.
  ctx.beginPath()
  ctx.ellipse(ux(0), vy(0.335), un(0.235), un(0.3), 0, 0, Math.PI * 2)
  ctx.fillStyle = COURT_SKIN
  ctx.fill()
  ctx.lineWidth = 2.2 * scale
  ctx.stroke()

  // Eyes: lidded almonds with a pupil.
  ctx.lineWidth = 2 * scale
  for (const side of [-1, 1]) {
    const ex = ux(side * 0.095)
    const ey = vy(0.315)
    ctx.beginPath()
    ctx.ellipse(ex, ey, un(0.055), un(0.03), 0, 0, Math.PI * 2)
    ctx.fillStyle = COURT_LINEN
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ex, ey, un(0.022), 0, Math.PI * 2)
    ctx.fillStyle = COURT_INK
    ctx.fill()
    // Brow.
    ctx.beginPath()
    ctx.arc(ex, vy(0.293), un(0.075), Math.PI * 1.12, Math.PI * 1.88)
    ctx.stroke()
  }

  // Nose.
  ctx.beginPath()
  ctx.moveTo(ux(0.01), vy(0.315))
  ctx.quadraticCurveTo(ux(-0.045), vy(0.372), ux(0.015), vy(0.378))
  ctx.stroke()

  if (rank === 'K') {
    // Mustache over a squared beard.
    ctx.beginPath()
    ctx.moveTo(ux(-0.2), vy(0.4))
    ctx.quadraticCurveTo(ux(0), vy(0.61), ux(0.2), vy(0.4))
    ctx.quadraticCurveTo(ux(0), vy(0.44), ux(-0.2), vy(0.4))
    ctx.closePath()
    ctx.fillStyle = hair
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ux(-0.19), vy(0.398))
    ctx.quadraticCurveTo(ux(-0.06), vy(0.44), ux(0), vy(0.412))
    ctx.quadraticCurveTo(ux(0.06), vy(0.44), ux(0.19), vy(0.398))
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.moveTo(ux(-0.055), vy(0.4))
    ctx.quadraticCurveTo(ux(0), vy(0.422), ux(0.055), vy(0.4))
    ctx.stroke()
  }
}

function drawHeadwear(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  ux: UX,
  vy: VY,
  un: UX,
  scale: number,
): void {
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2.2 * scale

  if (rank === 'J') {
    // Soft cap with a feather.
    ctx.beginPath()
    ctx.moveTo(ux(-0.33), vy(0.26))
    ctx.quadraticCurveTo(ux(-0.36), vy(0.08), ux(0.0), vy(0.09))
    ctx.quadraticCurveTo(ux(0.36), vy(0.1), ux(0.33), vy(0.26))
    ctx.closePath()
    ctx.fillStyle = COURT_RED
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ux(-0.34), vy(0.24))
    ctx.lineTo(ux(0.34), vy(0.24))
    ctx.strokeStyle = COURT_GOLD
    ctx.lineWidth = 5 * scale
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(ux(0.22), vy(0.12))
    ctx.quadraticCurveTo(ux(0.66), vy(-0.01), ux(0.78), vy(0.14))
    ctx.strokeStyle = COURT_LINEN
    ctx.lineWidth = 6 * scale
    ctx.stroke()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
    return
  }

  // Crown: trefoil points for a king, pearled arches for a queen.
  const points = rank === 'K' ? 5 : 3
  const top = rank === 'K' ? 0.05 : 0.09
  const left = -0.34
  const span = 0.68
  ctx.beginPath()
  ctx.moveTo(ux(left), vy(0.27))
  ctx.lineTo(ux(left), vy(0.2))
  for (let i = 0; i < points; i++) {
    const uMid = left + ((i + 0.5) / points) * span
    const uEnd = left + ((i + 1) / points) * span
    ctx.quadraticCurveTo(ux(uMid), vy(top + 0.01), ux(uMid), vy(top + 0.02))
    ctx.quadraticCurveTo(ux(uMid), vy(top + 0.01), ux(uEnd), vy(0.2))
  }
  ctx.lineTo(ux(left + span), vy(0.27))
  ctx.closePath()
  ctx.fillStyle = COURT_GOLD
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.stroke()

  // Pearls on the points.
  for (let i = 0; i < points; i++) {
    const uMid = left + ((i + 0.5) / points) * span
    ctx.beginPath()
    ctx.arc(ux(uMid), vy(top), un(0.036), 0, Math.PI * 2)
    ctx.fillStyle = COURT_LINEN
    ctx.fill()
    ctx.lineWidth = 1.6 * scale
    ctx.stroke()
  }

  // Jewel band.
  ctx.beginPath()
  ctx.moveTo(ux(left), vy(0.235))
  ctx.lineTo(ux(left + span), vy(0.235))
  ctx.lineWidth = 3.5 * scale
  ctx.strokeStyle = COURT_GOLD_DEEP
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(ux(-0.17 + i * 0.17), vy(0.235), un(0.032), 0, Math.PI * 2)
    ctx.fillStyle = i === 1 ? COURT_RED : COURT_BLUE
    ctx.fill()
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
  }
}

// Long props sit behind the body so the robe overlaps the shaft.
function drawRegaliaBehind(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  suit: Suit,
  ux: UX,
  vy: VY,
  un: UX,
  scale: number,
): void {
  if (rank === 'K') {
    // Upright sword: blade above the shoulder, hilt buried in the robe.
    const wid = un(0.055)
    ctx.beginPath()
    ctx.moveTo(ux(0.73), vy(0.08))
    ctx.lineTo(ux(0.73) + wid, vy(0.17))
    ctx.lineTo(ux(0.79) + wid, vy(0.92))
    ctx.lineTo(ux(0.79) - wid, vy(0.92))
    ctx.lineTo(ux(0.73) - wid, vy(0.17))
    ctx.closePath()
    ctx.fillStyle = '#c9ced7'
    ctx.fill()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 2 * scale
    ctx.stroke()
    // Fuller down the middle of the blade.
    ctx.beginPath()
    ctx.moveTo(ux(0.735), vy(0.2))
    ctx.lineTo(ux(0.785), vy(0.88))
    ctx.strokeStyle = '#9aa1ad'
    ctx.lineWidth = 2 * scale
    ctx.stroke()
    return
  }
  if (rank === 'J') {
    // Halberd staff topped with the suit mark.
    ctx.beginPath()
    ctx.moveTo(ux(0.74), vy(0.2))
    ctx.lineTo(ux(0.8), vy(0.92))
    ctx.strokeStyle = '#8a6a44'
    ctx.lineWidth = 7 * scale
    ctx.stroke()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
    ctx.save()
    ctx.translate(ux(0.74), vy(0.14))
    ctx.fillStyle = COURT_GOLD
    drawSuitPath(ctx, suit, un(0.14))
    ctx.strokeStyle = COURT_INK
    ctx.restore()
    return
  }
  // Queen: a stem for the flower drawn in front.
  ctx.beginPath()
  ctx.moveTo(ux(0.78), vy(0.9))
  ctx.quadraticCurveTo(ux(0.86), vy(0.55), ux(0.76), vy(0.34))
  ctx.strokeStyle = '#3f7a45'
  ctx.lineWidth = 4.5 * scale
  ctx.stroke()
}

// Small details that must sit over the robe.
function drawRegaliaFront(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  ux: UX,
  vy: VY,
  un: UX,
  vn: VY,
  scale: number,
): void {
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale

  if (rank === 'K') {
    // Crossguard and pommel where the hand would grip.
    ctx.beginPath()
    ctx.moveTo(ux(0.57), vy(0.73))
    ctx.lineTo(ux(0.97), vy(0.75))
    ctx.strokeStyle = COURT_GOLD
    ctx.lineWidth = 7 * scale
    ctx.stroke()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.6 * scale
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ux(0.76), vy(0.88), un(0.05), 0, Math.PI * 2)
    ctx.fillStyle = COURT_GOLD
    ctx.fill()
    ctx.stroke()
    return
  }

  if (rank === 'Q') {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ctx.beginPath()
      ctx.ellipse(
        ux(0.76) + Math.cos(a) * un(0.085),
        vy(0.3) + Math.sin(a) * vn(0.042),
        un(0.08),
        vn(0.038),
        a,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = COURT_LINEN
      ctx.fill()
      ctx.lineWidth = 1.6 * scale
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(ux(0.76), vy(0.3), un(0.05), 0, Math.PI * 2)
    ctx.fillStyle = COURT_GOLD
    ctx.fill()
    ctx.stroke()
    return
  }

  // Jack: a gloved grip band on the staff.
  ctx.beginPath()
  ctx.moveTo(ux(0.68), vy(0.66))
  ctx.lineTo(ux(0.9), vy(0.7))
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 7 * scale
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.6 * scale
  ctx.stroke()
}
