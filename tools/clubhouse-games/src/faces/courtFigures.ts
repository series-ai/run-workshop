import { darken, lighten } from '../canvasUtils'
import { Suit } from '../types'
import { drawSuitPath } from './suitPaths'

// Courts print from one fixed plate set, so the figure keeps the same regal
// colors in every suit. Only the pips and indices take the suit color.
export const COURT_INK = '#231e24'
export const COURT_GOLD = '#c9a049'
export const COURT_GOLD_DEEP = '#8e6d26'
export const COURT_SKIN = '#f0d5b6'
export const COURT_BLUE = '#33518f'
export const COURT_RED = '#9d2130'
export const COURT_LINEN = '#f7f1e3'
export const COURT_HAIR_DARK = '#4a3526'
export const COURT_HAIR_FAIR = '#8a5f30'

// Real decks dress each court differently. Keeping one palette for all three
// was most of why they read as the same figure in three hats.
interface Costume {
  body: string
  sleeve: string
  hair: string
}

const COSTUMES: Record<'J' | 'Q' | 'K', Costume> = {
  K: { body: COURT_RED, sleeve: COURT_BLUE, hair: COURT_HAIR_DARK },
  Q: { body: COURT_BLUE, sleeve: COURT_RED, hair: COURT_HAIR_FAIR },
  J: { body: '#1f6b46', sleeve: COURT_BLUE, hair: COURT_HAIR_DARK },
}

export interface CourtBox {
  x: number
  y: number
  w: number
  h: number
}

type UX = (u: number) => number
type VY = (v: number) => number

interface Frame {
  ux: UX
  vy: VY
  un: UX
  vn: VY
  scale: number
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
  const f: Frame = {
    ux: (u) => box.x + box.w / 2 + (u * box.w) / 2,
    vy: (v) => box.y + v * box.h,
    un: (u) => (u * box.w) / 2,
    vn: (v) => v * box.h,
    scale,
  }

  const costume = COSTUMES[rank]
  drawRobe(ctx, suit, suitColor, costume, f)
  drawCollar(ctx, rank, f)
  if (rank === 'Q') drawCarcanet(ctx, f)
  drawHead(ctx, rank, costume, f)
  drawHeadwear(ctx, rank, costume, f)
  // The prop crosses in front of the body, held in a visible hand. Behind the
  // robe it would be a floating hilt with nothing attached to it.
  drawRegalia(ctx, rank, suit, f)
}

// A queen wears a jewelled carcanet over the ruff.
function drawCarcanet(ctx: CanvasRenderingContext2D, { ux, vy, un, scale }: Frame): void {
  ctx.beginPath()
  ctx.moveTo(ux(-0.3), vy(0.52))
  ctx.quadraticCurveTo(ux(0), vy(0.62), ux(0.3), vy(0.52))
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 4 * scale
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.2 * scale
  ctx.stroke()
  for (let i = -2; i <= 2; i++) {
    const u = i * 0.11
    const v = 0.545 + (1 - Math.abs(i) / 2.6) * 0.035
    ctx.beginPath()
    ctx.arc(ux(u), vy(v), un(i === 0 ? 0.045 : 0.03), 0, Math.PI * 2)
    ctx.fillStyle = i === 0 ? COURT_RED : COURT_BLUE
    ctx.fill()
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- costume --

function drawRobe(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  suitColor: string,
  costume: Costume,
  { ux, vy, un, vn, scale }: Frame,
): void {
  const shoulders = () => {
    ctx.beginPath()
    ctx.moveTo(ux(-0.26), vy(0.47))
    ctx.lineTo(ux(-0.66), vy(0.52))
    ctx.quadraticCurveTo(ux(-0.97), vy(0.58), ux(-1.0), vy(0.72))
    ctx.lineTo(ux(-1.0), vy(1.0))
    ctx.lineTo(ux(1.0), vy(1.0))
    ctx.lineTo(ux(1.0), vy(0.72))
    ctx.quadraticCurveTo(ux(0.97), vy(0.58), ux(0.66), vy(0.52))
    ctx.lineTo(ux(0.26), vy(0.47))
    ctx.closePath()
  }

  shoulders()
  ctx.fillStyle = costume.body
  ctx.fill()

  ctx.save()
  shoulders()
  ctx.clip()

  // Blue sleeves either side of the crimson body.
  for (const side of [-1, 1]) {
    ctx.fillStyle = costume.sleeve
    ctx.beginPath()
    ctx.moveTo(ux(side * 0.4), vy(0.5))
    ctx.quadraticCurveTo(ux(side * 0.7), vy(0.56), ux(side * 1.05), vy(0.63))
    ctx.lineTo(ux(side * 1.05), vy(1.0))
    ctx.lineTo(ux(side * 0.48), vy(1.0))
    ctx.closePath()
    ctx.fill()
  }

  // Diaper: a diamond net with a fleuron at every node, the standard filler
  // on engraved court robes. It replaces flat blocks of color with texture.
  drawDiaper(ctx, ux(-1.05), vy(0.45), un(2.1), vn(0.58), 26 * scale, scale)

  // Fold shading down the body and along each sleeve.
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = COURT_INK
  ctx.lineCap = 'round'
  for (const [u0, u1, w] of [
    [-0.34, -0.3, 3],
    [0.34, 0.3, 3],
    [-0.78, -0.7, 2.2],
    [0.78, 0.7, 2.2],
  ] as const) {
    ctx.lineWidth = w * scale
    ctx.beginPath()
    ctx.moveTo(ux(u0), vy(0.56))
    ctx.quadraticCurveTo(ux((u0 + u1) / 2), vy(0.78), ux(u1), vy(1.0))
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2.6 * scale
  shoulders()
  ctx.stroke()

  // Ermine placket down the middle, carrying the suit mark.
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(ux(-0.15), vy(0.5))
  ctx.lineTo(ux(0.15), vy(0.5))
  ctx.lineTo(ux(0.19), vy(1.0))
  ctx.lineTo(ux(-0.19), vy(1.0))
  ctx.closePath()
  ctx.fillStyle = COURT_LINEN
  ctx.fill()
  ctx.clip()
  drawErmine(ctx, ux, vy, un, scale)
  ctx.restore()
  ctx.beginPath()
  ctx.moveTo(ux(-0.15), vy(0.5))
  ctx.lineTo(ux(-0.19), vy(1.0))
  ctx.moveTo(ux(0.15), vy(0.5))
  ctx.lineTo(ux(0.19), vy(1.0))
  ctx.strokeStyle = COURT_GOLD_DEEP
  ctx.lineWidth = 2.4 * scale
  ctx.stroke()

  // Suit mark on the breast.
  ctx.save()
  ctx.translate(ux(0), vy(0.66))
  ctx.fillStyle = suitColor
  drawSuitPath(ctx, suit, un(0.125))
  ctx.restore()

  // Gold shoulder cord, and a cuff at each sleeve opening.
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 3.2 * scale
  ctx.beginPath()
  ctx.moveTo(ux(-0.46), vy(0.52))
  ctx.quadraticCurveTo(ux(0), vy(0.62), ux(0.46), vy(0.52))
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1 * scale
  ctx.stroke()
}

// Diamond net with a small four-petal fleuron at each crossing.
function drawDiaper(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  step: number,
  scale: number,
): void {
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.1 * scale
  for (let i = -1; i * step < w + h; i++) {
    const x = x0 + i * step
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x + h, y0 + h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y0)
    ctx.lineTo(x - h, y0 + h)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.45
  ctx.fillStyle = COURT_GOLD
  for (let gy = y0 + step; gy < y0 + h; gy += step) {
    const offset = Math.round((gy - y0) / step) % 2 === 0 ? 0 : step / 2
    for (let gx = x0 + offset; gx < x0 + w; gx += step) {
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2
        ctx.beginPath()
        ctx.ellipse(
          gx + Math.cos(a) * 2.6 * scale,
          gy + Math.sin(a) * 2.6 * scale,
          2.4 * scale,
          1.5 * scale,
          a,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
    }
  }
  ctx.restore()
}

// Ermine: the heraldic three-tick tail mark, scattered in rows.
function drawErmine(
  ctx: CanvasRenderingContext2D,
  ux: UX,
  vy: VY,
  un: UX,
  scale: number,
): void {
  ctx.fillStyle = COURT_INK
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.4 * scale
  for (let i = 0; i < 3; i++) {
    const v = 0.6 + i * 0.14
    for (const u of i % 2 === 0 ? [-0.075, 0.075] : [0]) {
      const x = ux(u)
      const y = vy(v)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 4.4 * scale, y + 11 * scale)
      ctx.lineTo(x - 4.4 * scale, y + 11 * scale)
      ctx.closePath()
      ctx.fill()
      for (const d of [-1, 0, 1]) {
        ctx.beginPath()
        ctx.moveTo(x + d * 4.4 * scale, y - 2 * scale)
        ctx.lineTo(x + d * 6.6 * scale, y - 7 * scale)
        ctx.stroke()
      }
    }
  }
  void un
}

function drawCollar(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  { ux, vy, un, scale }: Frame,
): void {
  // A ruff is a pleated band standing off the neck, so it is drawn in polar
  // coordinates about the throat with a scalloped outer edge.
  const cx = ux(0)
  const cy = vy(0.35)
  const inner = un(0.3)
  const outer = un(0.54)
  const from = Math.PI * 0.04
  const to = Math.PI * 0.96
  const pleats = rank === 'Q' ? 13 : 11
  const steps = pleats * 8

  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps
    const r = outer + Math.sin(((i / steps) * pleats + 0.5) * Math.PI * 2) * un(0.028)
    const x = cx + Math.cos(t) * r
    const y = cy + Math.sin(t) * r * 0.86
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = steps; i >= 0; i--) {
    const t = from + ((to - from) * i) / steps
    ctx.lineTo(cx + Math.cos(t) * inner, cy + Math.sin(t) * inner * 0.86)
  }
  ctx.closePath()
  ctx.fillStyle = COURT_LINEN
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  // Pleat folds running from the neck to the edge.
  ctx.save()
  ctx.globalAlpha = 0.45
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.4 * scale
  for (let i = 0; i <= pleats; i++) {
    const t = from + ((to - from) * i) / pleats
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(t) * inner, cy + Math.sin(t) * inner * 0.86)
    ctx.lineTo(cx + Math.cos(t) * outer, cy + Math.sin(t) * outer * 0.86)
    ctx.stroke()
  }
  ctx.restore()
}

// -------------------------------------------------------------------- head --

function drawHead(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  costume: Costume,
  { ux, vy, un, scale }: Frame,
): void {
  const hair = costume.hair
  const cx = ux(0)
  const cy = vy(0.31)
  const rx = un(0.215)
  const ry = un(0.265)

  // Hair mass, then locks drawn as strokes rather than one flat shape.
  ctx.beginPath()
  ctx.ellipse(cx, cy + un(0.01), rx * 1.26, ry * 1.16, 0, 0, Math.PI * 2)
  ctx.fillStyle = hair
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.8 * scale
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.ellipse(cx, cy + un(0.01), rx * 1.26, ry * 1.16, 0, 0, Math.PI * 2)
  ctx.clip()
  ctx.strokeStyle = darken(hair, 0.4)
  ctx.lineWidth = 1.6 * scale
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath()
    ctx.moveTo(cx + i * rx * 0.24, cy - ry * 1.2)
    ctx.quadraticCurveTo(cx + i * rx * 0.42, cy, cx + i * rx * 0.34, cy + ry * 1.4)
    ctx.stroke()
  }
  ctx.restore()

  // Face.
  ctx.beginPath()
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  const skin = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry)
  skin.addColorStop(0, lighten(COURT_SKIN, 0.25))
  skin.addColorStop(1, darken(COURT_SKIN, 0.1))
  ctx.fillStyle = skin
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.9 * scale
  ctx.stroke()

  drawFeatures(ctx, rank, cx, cy, rx, ry, hair, scale)
}

// Engraved faces are built from a few fine strokes. Anything rounder reads as
// a cartoon at this size.
function drawFeatures(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  hair: string,
  scale: number,
): void {
  ctx.strokeStyle = COURT_INK
  ctx.lineCap = 'round'

  for (const side of [-1, 1]) {
    const ex = cx + side * rx * 0.42
    const ey = cy - ry * 0.08
    // Upper lid.
    ctx.lineWidth = 2 * scale
    ctx.beginPath()
    ctx.moveTo(ex - rx * 0.2, ey)
    ctx.quadraticCurveTo(ex, ey - ry * 0.11, ex + rx * 0.2, ey)
    ctx.stroke()
    // Pupil, sitting under the lid.
    ctx.beginPath()
    ctx.arc(ex, ey + ry * 0.035, rx * 0.075, 0, Math.PI * 2)
    ctx.fillStyle = COURT_INK
    ctx.fill()
    // Brow.
    ctx.lineWidth = 2.2 * scale
    ctx.beginPath()
    ctx.moveTo(ex - rx * 0.26, ey - ry * 0.3)
    ctx.quadraticCurveTo(ex, ey - ry * 0.4, ex + rx * 0.24, ey - ry * 0.26)
    ctx.stroke()
  }

  // Nose: a bridge line with a hooked nostril.
  ctx.lineWidth = 1.9 * scale
  ctx.beginPath()
  ctx.moveTo(cx + rx * 0.04, cy - ry * 0.06)
  ctx.lineTo(cx - rx * 0.06, cy + ry * 0.3)
  ctx.quadraticCurveTo(cx + rx * 0.02, cy + ry * 0.38, cx + rx * 0.12, cy + ry * 0.28)
  ctx.stroke()

  // Cheek hatching.
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.lineWidth = 1.3 * scale
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + side * rx * (0.5 + i * 0.11), cy + ry * 0.1)
      ctx.lineTo(cx + side * rx * (0.42 + i * 0.11), cy + ry * 0.42)
      ctx.stroke()
    }
  }
  ctx.restore()

  if (rank === 'K') {
    // Moustache and a beard of separate strokes.
    ctx.lineWidth = 2.6 * scale
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx + side * rx * 0.04, cy + ry * 0.44)
      ctx.quadraticCurveTo(
        cx + side * rx * 0.42,
        cy + ry * 0.46,
        cx + side * rx * 0.52,
        cy + ry * 0.7,
      )
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(cx - rx * 0.58, cy + ry * 0.52)
    ctx.quadraticCurveTo(cx, cy + ry * 1.3, cx + rx * 0.58, cy + ry * 0.52)
    ctx.quadraticCurveTo(cx, cy + ry * 0.8, cx - rx * 0.58, cy + ry * 0.52)
    ctx.closePath()
    ctx.fillStyle = hair
    ctx.fill()
    ctx.lineWidth = 1.8 * scale
    ctx.strokeStyle = COURT_INK
    ctx.stroke()
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.strokeStyle = darken(hair, 0.45)
    ctx.lineWidth = 1.4 * scale
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + i * rx * 0.14, cy + ry * 0.66)
      ctx.lineTo(cx + i * rx * 0.09, cy + ry * 1.1)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  ctx.lineWidth = 2 * scale
  ctx.beginPath()
  ctx.moveTo(cx - rx * 0.16, cy + ry * 0.52)
  ctx.quadraticCurveTo(cx, cy + ry * 0.62, cx + rx * 0.16, cy + ry * 0.52)
  ctx.stroke()
}

function drawHeadwear(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  costume: Costume,
  { ux, vy, un, scale }: Frame,
): void {
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2.2 * scale

  if (rank === 'J') {
    // Soft cap with a turned brim and a feather.
    ctx.beginPath()
    ctx.moveTo(ux(-0.36), vy(0.24))
    ctx.bezierCurveTo(ux(-0.44), vy(0.05), ux(0.1), vy(0.02), ux(0.3), vy(0.13))
    ctx.quadraticCurveTo(ux(0.4), vy(0.19), ux(0.36), vy(0.24))
    ctx.closePath()
    ctx.fillStyle = costume.body
    ctx.fill()
    ctx.stroke()
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = 0.3
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.4 * scale
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(ux(i * 0.09), vy(0.02))
      ctx.quadraticCurveTo(ux(i * 0.13), vy(0.14), ux(i * 0.1), vy(0.25))
      ctx.stroke()
    }
    ctx.restore()
    // Brim.
    ctx.beginPath()
    ctx.moveTo(ux(-0.4), vy(0.25))
    ctx.quadraticCurveTo(ux(0), vy(0.19), ux(0.4), vy(0.25))
    ctx.quadraticCurveTo(ux(0), vy(0.3), ux(-0.4), vy(0.25))
    ctx.closePath()
    ctx.fillStyle = COURT_GOLD
    ctx.fill()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.8 * scale
    ctx.stroke()
    // Plume: a filled vane with a quill through it, so it reads against the
    // pale panel instead of vanishing into it.
    const spine = (tt: number) => ({
      x: ux(0.18 + tt * 0.46),
      y: vy(0.11 - Math.sin(tt * Math.PI) * 0.055),
    })
    ctx.beginPath()
    for (let i = 0; i <= 12; i++) {
      const s0 = spine(i / 12)
      const w = Math.sin((i / 12) * Math.PI) * 8 * scale + 1.5 * scale
      if (i === 0) ctx.moveTo(s0.x, s0.y - w)
      else ctx.lineTo(s0.x, s0.y - w)
    }
    for (let i = 12; i >= 0; i--) {
      const s0 = spine(i / 12)
      const w = Math.sin((i / 12) * Math.PI) * 5 * scale + 1.5 * scale
      ctx.lineTo(s0.x, s0.y + w)
    }
    ctx.closePath()
    ctx.fillStyle = COURT_LINEN
    ctx.fill()
    ctx.strokeStyle = COURT_INK
    ctx.lineWidth = 1.6 * scale
    ctx.stroke()
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 1.2 * scale
    for (let i = 1; i < 10; i++) {
      const s0 = spine(i / 12)
      const w = Math.sin((i / 12) * Math.PI) * 10 * scale
      ctx.beginPath()
      ctx.moveTo(s0.x, s0.y)
      ctx.lineTo(s0.x + 3 * scale, s0.y - w)
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // Crown: five points for a king, three arches for a queen. The band sits on
  // the brow so the crown reads as worn, not floating.
  const points = rank === 'K' ? 5 : 3
  const top = rank === 'K' ? 0.03 : 0.07
  const left = -0.38
  const span = 0.76
  ctx.beginPath()
  ctx.moveTo(ux(left), vy(0.26))
  ctx.lineTo(ux(left), vy(0.185))
  for (let i = 0; i < points; i++) {
    const uMid = left + ((i + 0.5) / points) * span
    const uEnd = left + ((i + 1) / points) * span
    ctx.quadraticCurveTo(ux(uMid), vy(top + 0.012), ux(uMid), vy(top + 0.022))
    ctx.quadraticCurveTo(ux(uMid), vy(top + 0.012), ux(uEnd), vy(0.185))
  }
  ctx.lineTo(ux(left + span), vy(0.26))
  ctx.closePath()
  const gold = ctx.createLinearGradient(ux(left), vy(top), ux(left + span), vy(0.26))
  gold.addColorStop(0, lighten(COURT_GOLD, 0.3))
  gold.addColorStop(0.5, COURT_GOLD)
  gold.addColorStop(1, COURT_GOLD_DEEP)
  ctx.fillStyle = gold
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  // Pearls on the points.
  for (let i = 0; i < points; i++) {
    const uMid = left + ((i + 0.5) / points) * span
    ctx.beginPath()
    ctx.arc(ux(uMid), vy(top + 0.008), un(0.036), 0, Math.PI * 2)
    ctx.fillStyle = COURT_LINEN
    ctx.fill()
    ctx.lineWidth = 1.6 * scale
    ctx.stroke()
  }

  // Jewelled band.
  ctx.beginPath()
  ctx.rect(ux(left), vy(0.195), ux(left + span) - ux(left), vy(0.245) - vy(0.195))
  ctx.fillStyle = COURT_GOLD_DEEP
  ctx.fill()
  ctx.lineWidth = 1.8 * scale
  ctx.strokeStyle = COURT_INK
  ctx.stroke()
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(ux(-0.19 + i * 0.19), vy(0.22), un(0.033), 0, Math.PI * 2)
    ctx.fillStyle = i === 1 ? COURT_RED : COURT_BLUE
    ctx.fill()
    ctx.lineWidth = 1.4 * scale
    ctx.stroke()
  }
}

// ---------------------------------------------------------------- regalia --

// The prop is drawn over the robe along its whole length and gripped by a
// hand at the sleeve, so nothing floats unattached.
function drawRegalia(
  ctx: CanvasRenderingContext2D,
  rank: 'J' | 'Q' | 'K',
  suit: Suit,
  f: Frame,
): void {
  if (rank === 'K') {
    drawSword(ctx, f)
    drawHand(ctx, f, 0.735, 0.75, -0.12)
    return
  }
  if (rank === 'J') {
    drawStaff(ctx, suit, f)
    drawHand(ctx, f, 0.755, 0.72, -0.1)
    return
  }
  drawRose(ctx, f)
  drawHand(ctx, f, 0.79, 0.74, 0.08)
}

function drawSword(ctx: CanvasRenderingContext2D, { ux, vy, un, scale }: Frame): void {
  const wid = un(0.05)
  // Blade, tapering to a point above the shoulder.
  ctx.beginPath()
  ctx.moveTo(ux(0.7), vy(0.05))
  ctx.lineTo(ux(0.7) + wid, vy(0.14))
  ctx.lineTo(ux(0.76) + wid, vy(0.64))
  ctx.lineTo(ux(0.76) - wid, vy(0.64))
  ctx.lineTo(ux(0.7) - wid, vy(0.14))
  ctx.closePath()
  const steel = ctx.createLinearGradient(ux(0.7) - wid, 0, ux(0.76) + wid, 0)
  steel.addColorStop(0, '#8f96a3')
  steel.addColorStop(0.45, '#e6eaf0')
  steel.addColorStop(1, '#7a828f')
  ctx.fillStyle = steel
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 2 * scale
  ctx.stroke()

  // Crossguard, grip, pommel.
  ctx.beginPath()
  ctx.moveTo(ux(0.62), vy(0.64))
  ctx.lineTo(ux(0.94), vy(0.662))
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 8 * scale
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.6 * scale
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(ux(0.765), vy(0.66))
  ctx.lineTo(ux(0.785), vy(0.9))
  ctx.strokeStyle = '#6b4a2c'
  ctx.lineWidth = 8 * scale
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.5 * scale
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(ux(0.79), vy(0.92), un(0.05), 0, Math.PI * 2)
  ctx.fillStyle = COURT_GOLD
  ctx.fill()
  ctx.stroke()
}

function drawStaff(ctx: CanvasRenderingContext2D, suit: Suit, { ux, vy, un, scale }: Frame): void {
  ctx.beginPath()
  ctx.moveTo(ux(0.73), vy(0.14))
  ctx.lineTo(ux(0.79), vy(0.94))
  ctx.strokeStyle = '#8a6a44'
  ctx.lineWidth = 8 * scale
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.5 * scale
  ctx.stroke()
  // Head: the suit mark in a gold collar.
  ctx.beginPath()
  ctx.moveTo(ux(0.66), vy(0.19))
  ctx.lineTo(ux(0.81), vy(0.2))
  ctx.strokeStyle = COURT_GOLD
  ctx.lineWidth = 6 * scale
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.4 * scale
  ctx.stroke()
  ctx.save()
  ctx.translate(ux(0.73), vy(0.1))
  ctx.fillStyle = COURT_GOLD
  drawSuitPath(ctx, suit, un(0.13))
  ctx.restore()
}

function drawRose(ctx: CanvasRenderingContext2D, { ux, vy, un, scale }: Frame): void {
  ctx.beginPath()
  ctx.moveTo(ux(0.82), vy(0.94))
  ctx.quadraticCurveTo(ux(0.9), vy(0.6), ux(0.8), vy(0.32))
  ctx.strokeStyle = '#3f7a45'
  ctx.lineWidth = 5 * scale
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.3 * scale
  ctx.stroke()
  // A leaf on the stem.
  ctx.beginPath()
  ctx.moveTo(ux(0.86), vy(0.56))
  ctx.quadraticCurveTo(ux(1.02), vy(0.5), ux(1.0), vy(0.64))
  ctx.quadraticCurveTo(ux(0.92), vy(0.62), ux(0.86), vy(0.56))
  ctx.fillStyle = '#3f7a45'
  ctx.fill()
  ctx.strokeStyle = COURT_INK
  ctx.lineWidth = 1.3 * scale
  ctx.stroke()

  // Layered petals rather than a ring of ellipses.
  const cx = ux(0.8)
  const cy = vy(0.27)
  const r = un(0.145)
  for (const [ring, count, size] of [
    [1, 6, 1],
    [0.62, 5, 0.72],
  ] as const) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ring
      ctx.beginPath()
      ctx.ellipse(
        cx + Math.cos(a) * r * ring * 0.5,
        cy + Math.sin(a) * r * ring * 0.5,
        r * size * 0.62,
        r * size * 0.44,
        a,
        0,
        Math.PI * 2,
      )
      ctx.fillStyle = ring === 1 ? COURT_LINEN : lighten(COURT_RED, 0.6)
      ctx.fill()
      ctx.strokeStyle = COURT_INK
      ctx.lineWidth = 1.5 * scale
      ctx.stroke()
    }
  }
  ctx.beginPath()
  ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2)
  ctx.fillStyle = COURT_GOLD
  ctx.fill()
  ctx.stroke()
}

// A closed fist around the shaft. Knuckles and a thumb are what stop it
// reading as a smooth lump of skin.
function drawHand(
  ctx: CanvasRenderingContext2D,
  { ux, vy, un, scale }: Frame,
  u: number,
  v: number,
  tilt: number,
): void {
  const w = un(0.1)
  const h = un(0.105)

  ctx.save()
  ctx.translate(ux(u), vy(v))
  ctx.rotate(tilt)
  ctx.strokeStyle = COURT_INK
  ctx.lineJoin = 'round'

  // Gauntlet cuff below the hand.
  ctx.beginPath()
  ctx.moveTo(-w * 1.25, h * 0.6)
  ctx.lineTo(w * 1.25, h * 0.6)
  ctx.lineTo(w * 1.05, h * 1.5)
  ctx.lineTo(-w * 1.05, h * 1.5)
  ctx.closePath()
  ctx.fillStyle = COURT_GOLD
  ctx.fill()
  ctx.lineWidth = 1.8 * scale
  ctx.stroke()

  const skin = ctx.createLinearGradient(-w, -h, w, h)
  skin.addColorStop(0, lighten(COURT_SKIN, 0.22))
  skin.addColorStop(1, darken(COURT_SKIN, 0.16))

  // Palm block, with the knuckle line bumped along the top.
  ctx.beginPath()
  ctx.moveTo(-w, h * 0.62)
  ctx.lineTo(-w, -h * 0.25)
  for (let i = 0; i < 4; i++) {
    const x0 = -w + (i * 2 * w) / 4
    const x1 = -w + ((i + 1) * 2 * w) / 4
    ctx.quadraticCurveTo((x0 + x1) / 2, -h * 0.72, x1, -h * 0.25)
  }
  ctx.lineTo(w, h * 0.62)
  ctx.closePath()
  ctx.fillStyle = skin
  ctx.fill()
  ctx.lineWidth = 1.9 * scale
  ctx.stroke()

  // Finger creases running down from between the knuckles.
  ctx.lineWidth = 1.2 * scale
  ctx.globalAlpha = 0.35
  for (let i = 1; i < 4; i++) {
    const x = -w + (i * 2 * w) / 4
    ctx.beginPath()
    ctx.moveTo(x, -h * 0.16)
    ctx.lineTo(x, h * 0.06)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Thumb folded across the front.
  ctx.beginPath()
  ctx.moveTo(-w * 1.05, h * 0.1)
  ctx.quadraticCurveTo(-w * 0.2, h * 0.05, w * 0.35, h * 0.34)
  ctx.quadraticCurveTo(-w * 0.2, h * 0.5, -w * 1.05, h * 0.42)
  ctx.closePath()
  ctx.fillStyle = skin
  ctx.fill()
  ctx.lineWidth = 1.7 * scale
  ctx.stroke()

  ctx.restore()
}
