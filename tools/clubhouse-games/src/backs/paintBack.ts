import { CARD_H, CARD_RADIUS, CARD_W } from '../constants'
import { drawCircleRosette, drawGuillocheBand, roundRectPath } from '../canvasUtils'
import { BackTheme } from './backThemes'
import { drawGround } from './grounds'

export interface PaintBackOptions {
  scale?: number
}

// Every preset gets its own rose by deriving the ripple counts from its id,
// so two backs in the same palette still differ in the middle.
function idHash(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// Ivory margin around the printed panel, in unscaled canvas units. Real decks
// leave this white border, and it is most of what makes a back look printed
// instead of drawn.
const MARGIN = 26
const PANEL_RADIUS = 22

export function paintBack(theme: BackTheme, opts: PaintBackOptions = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 1
  const W = Math.round(CARD_W * scale)
  const H = Math.round(CARD_H * scale)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const s = scale

  ctx.clearRect(0, 0, W, H)

  // Ivory card body.
  roundRectPath(ctx, 2 * s, 2 * s, W - 4 * s, H - 4 * s, CARD_RADIUS * s)
  ctx.fillStyle = '#f7f4ec'
  ctx.fill()
  ctx.lineWidth = 2 * s
  ctx.strokeStyle = '#cfc9ba'
  ctx.stroke()

  const px = MARGIN * s
  const py = MARGIN * s
  const pw = W - 2 * MARGIN * s
  const ph = H - 2 * MARGIN * s
  const cx = px + pw / 2
  const cy = py + ph / 2

  ctx.save()
  roundRectPath(ctx, px, py, pw, ph, PANEL_RADIUS * s)
  ctx.clip()
  ctx.fillStyle = theme.base
  ctx.fillRect(px, py, pw, ph)
  ctx.lineJoin = 'round'

  drawGround(ctx, theme, { x: px, y: py, w: pw, h: ph, scale: s })
  drawFieldOrnament(ctx, theme, cx, cy, pw, ph, s)
  drawVignette(ctx, px, py, pw, ph)
  if (theme.medallion ?? true) drawMedallion(ctx, theme, cx, cy, Math.min(pw, ph) * 0.25, s)
  drawFleurons(ctx, theme, px, py, pw, ph, s)
  ctx.restore()

  // Keylines: a weighted outer rule with a hairline companion inside it.
  ctx.strokeStyle = theme.borderColor
  roundRectPath(ctx, px + 5 * s, py + 5 * s, pw - 10 * s, ph - 10 * s, (PANEL_RADIUS - 5) * s)
  ctx.lineWidth = 3 * s
  ctx.stroke()
  roundRectPath(ctx, px + 12 * s, py + 12 * s, pw - 24 * s, ph - 24 * s, (PANEL_RADIUS - 12) * s)
  ctx.lineWidth = 1 * s
  ctx.globalAlpha = 0.75
  ctx.stroke()
  ctx.globalAlpha = 1

  return canvas
}

// The large motif over the middle of the panel.
function drawFieldOrnament(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  cx: number,
  cy: number,
  pw: number,
  ph: number,
  s: number,
): void {
  const ornament = theme.ornament ?? 'band'
  if (ornament === 'none') return
  const R = Math.min(pw, ph) * 0.47
  const h = idHash(theme.id)
  ctx.save()
  ctx.lineWidth = Math.max(0.7, 1.1 * s)

  if (ornament === 'rosette') {
    ctx.strokeStyle = theme.patternColor
    ctx.globalAlpha = 0.9
    drawCircleRosette(ctx, cx, cy, R * 0.62, 24, 0.72)
    ctx.strokeStyle = theme.accent
    ctx.globalAlpha = 0.4
    drawCircleRosette(ctx, cx, cy, R * 0.94, 18, 0.5)
    ctx.restore()
    return
  }

  if (ornament === 'star') {
    // A star polygon: every vertex joined to one several steps around.
    for (const [points, skip, radius, alpha, color] of [
      [16, 7, R * 0.92, 0.5, theme.patternColor],
      [12, 5, R * 0.62, 0.45, theme.accent],
    ] as const) {
      ctx.strokeStyle = color
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (let i = 0; i <= points; i++) {
        const a = ((i * skip) / points) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(a) * radius
        const y = cy + Math.sin(a) * radius
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
    return
  }

  // Copies at evenly spread phases cross each other and read as lacework.
  ctx.strokeStyle = theme.patternColor
  ctx.globalAlpha = 0.45
  drawGuillocheBand(ctx, {
    cx,
    cy,
    radius: R * 0.72,
    amplitude: R * 0.22,
    waves: 7 + (h % 6),
    amplitude2: R * 0.05,
    waves2: (7 + (h % 6)) * 2,
    lines: 18,
  })
  ctx.globalAlpha = 0.34
  drawGuillocheBand(ctx, {
    cx,
    cy,
    radius: R * 0.44,
    amplitude: R * 0.13,
    waves: 12 + ((h >> 3) % 7),
    amplitude2: R * 0.035,
    waves2: (12 + ((h >> 3) % 7)) * 2,
    lines: 14,
  })
  ctx.strokeStyle = theme.accent
  ctx.globalAlpha = 0.28
  drawGuillocheBand(ctx, {
    cx,
    cy,
    radius: R * 1.02,
    amplitude: R * 0.05,
    waves: 22,
    amplitude2: R * 0.015,
    waves2: 44,
    lines: 10,
  })
  ctx.restore()
}

// Darkens the panel edges so the print reads as inked rather than flat.
function drawVignette(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  pw: number,
  ph: number,
): void {
  const cx = px + pw / 2
  const cy = py + ph / 2
  const grad = ctx.createRadialGradient(cx, cy, Math.min(pw, ph) * 0.15, cx, cy, Math.max(pw, ph) * 0.72)
  grad.addColorStop(0, 'rgba(255,255,255,0.08)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.34)')
  ctx.fillStyle = grad
  ctx.fillRect(px, py, pw, ph)
}

// Central seal: a ringed disc carrying its own small band of lacework.
function drawMedallion(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  cx: number,
  cy: number,
  r: number,
  s: number,
): void {
  const waves = 5 + (idHash(theme.id) % 7)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = theme.base
  ctx.fill()

  ctx.save()
  ctx.clip()
  ctx.strokeStyle = theme.accent
  ctx.globalAlpha = 0.6
  ctx.lineWidth = Math.max(0.7, 1 * s)
  drawGuillocheBand(ctx, {
    cx,
    cy,
    radius: r * 0.44,
    amplitude: r * 0.32,
    waves,
    amplitude2: r * 0.07,
    waves2: waves * 2,
    lines: 14,
  })
  ctx.restore()

  ctx.globalAlpha = 1
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 3.5 * s
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1.2 * s
  ctx.beginPath()
  ctx.arc(cx, cy, r - 8 * s, 0, Math.PI * 2)
  ctx.stroke()

  // Beading around the outer ring.
  ctx.fillStyle = theme.accent
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * (r + 8 * s), cy + Math.sin(a) * (r + 8 * s), 2.4 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// Quarter rosettes tucked into the four panel corners.
function drawFleurons(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  px: number,
  py: number,
  pw: number,
  ph: number,
  s: number,
): void {
  const inset = 44 * s
  const r = 20 * s
  const corners: [number, number][] = [
    [px + inset, py + inset],
    [px + pw - inset, py + inset],
    [px + pw - inset, py + ph - inset],
    [px + inset, py + ph - inset],
  ]
  ctx.save()
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 1.4 * s
  ctx.globalAlpha = 0.9
  for (const [x, y] of corners) {
    drawCircleRosette(ctx, x, y, r, 8, 0.66)
    ctx.beginPath()
    ctx.arc(x, y, 4 * s, 0, Math.PI * 2)
    ctx.fillStyle = theme.accent
    ctx.fill()
  }
  ctx.restore()
}
