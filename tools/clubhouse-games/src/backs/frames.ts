import { roundRectPath } from '../canvasUtils'
import { BackCorner, BackTheme } from './backThemes'

export interface FrameArea {
  x: number
  y: number
  w: number
  h: number
  radius: number
  scale: number
}

// Border treatment drawn just inside the panel edge.
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  a: FrameArea,
): void {
  const { x, y, w, h, radius: r, scale: s } = a
  ctx.save()
  ctx.strokeStyle = theme.borderColor
  ctx.fillStyle = theme.borderColor

  switch (theme.frame ?? 'keyline') {
    case 'keyline': {
      roundRectPath(ctx, x + 5 * s, y + 5 * s, w - 10 * s, h - 10 * s, Math.max(0, r - 5 * s))
      ctx.lineWidth = 3 * s
      ctx.stroke()
      roundRectPath(ctx, x + 12 * s, y + 12 * s, w - 24 * s, h - 24 * s, Math.max(0, r - 12 * s))
      ctx.lineWidth = 1 * s
      ctx.globalAlpha = 0.75
      ctx.stroke()
      break
    }
    case 'rope': {
      // A ring of beads following the panel edge.
      roundRectPath(ctx, x + 6 * s, y + 6 * s, w - 12 * s, h - 12 * s, Math.max(0, r - 6 * s))
      ctx.lineWidth = 1.6 * s
      ctx.stroke()
      const inset = 14 * s
      const bx = x + inset
      const by = y + inset
      const bw = w - inset * 2
      const bh = h - inset * 2
      const step = 13 * s
      const bead = (px: number, py: number) => {
        ctx.beginPath()
        ctx.arc(px, py, 3.2 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      for (let px = bx; px <= bx + bw; px += step) {
        bead(px, by)
        bead(px, by + bh)
      }
      for (let py = by + step; py < by + bh; py += step) {
        bead(bx, py)
        bead(bx + bw, py)
      }
      break
    }
    case 'meander': {
      // Greek key running around the panel.
      roundRectPath(ctx, x + 5 * s, y + 5 * s, w - 10 * s, h - 10 * s, Math.max(0, r - 5 * s))
      ctx.lineWidth = 2.4 * s
      ctx.stroke()
      const inset = 16 * s
      const size = 13 * s
      ctx.lineWidth = 2 * s
      ctx.lineJoin = 'miter'
      const key = (px: number, py: number, rot: number) => {
        ctx.save()
        ctx.translate(px, py)
        ctx.rotate(rot)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(size, 0)
        ctx.lineTo(size, -size * 0.62)
        ctx.lineTo(size * 0.32, -size * 0.62)
        ctx.lineTo(size * 0.32, -size * 0.28)
        ctx.stroke()
        ctx.restore()
      }
      for (let px = x + inset; px < x + w - inset - size; px += size * 1.25) {
        key(px, y + inset, 0)
        key(px + size, y + h - inset, Math.PI)
      }
      for (let py = y + inset; py < y + h - inset - size; py += size * 1.25) {
        key(x + inset, py + size, -Math.PI / 2)
        key(x + w - inset, py, Math.PI / 2)
      }
      break
    }
    case 'notched': {
      // A rule whose corners are cut across, like a printed plate mark.
      const inset = 10 * s
      const cut = 26 * s
      const px = x + inset
      const py = y + inset
      const pw = w - inset * 2
      const ph = h - inset * 2
      ctx.beginPath()
      ctx.moveTo(px + cut, py)
      ctx.lineTo(px + pw - cut, py)
      ctx.lineTo(px + pw, py + cut)
      ctx.lineTo(px + pw, py + ph - cut)
      ctx.lineTo(px + pw - cut, py + ph)
      ctx.lineTo(px + cut, py + ph)
      ctx.lineTo(px, py + ph - cut)
      ctx.lineTo(px, py + cut)
      ctx.closePath()
      ctx.lineWidth = 3 * s
      ctx.stroke()
      ctx.globalAlpha = 0.7
      ctx.lineWidth = 1 * s
      ctx.beginPath()
      const g = 6 * s
      ctx.moveTo(px + cut + g, py + g)
      ctx.lineTo(px + pw - cut - g, py + g)
      ctx.lineTo(px + pw - g, py + cut + g)
      ctx.lineTo(px + pw - g, py + ph - cut - g)
      ctx.lineTo(px + pw - cut - g, py + ph - g)
      ctx.lineTo(px + cut + g, py + ph - g)
      ctx.lineTo(px + g, py + ph - cut - g)
      ctx.lineTo(px + g, py + cut + g)
      ctx.closePath()
      ctx.stroke()
      break
    }
  }
  ctx.restore()
}

// Ornament tucked into each of the four panel corners.
export function drawCorners(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  a: FrameArea,
  drawRosette: (cx: number, cy: number) => void,
): void {
  const style: BackCorner = theme.corner ?? 'rosette'
  if (style === 'none') return
  const { x, y, w, h, scale: s } = a
  const inset = 44 * s
  // A back has to look the same turned around, so the two upper corners are
  // upright and the two lower ones are turned through 180 degrees. A bracket
  // is the exception: it has to point into its own corner.
  const quarter = style === 'bracket'
  const spots: [number, number, number][] = [
    [x + inset, y + inset, 0],
    [x + w - inset, y + inset, quarter ? Math.PI / 2 : 0],
    [x + w - inset, y + h - inset, Math.PI],
    [x + inset, y + h - inset, quarter ? -Math.PI / 2 : Math.PI],
  ]
  ctx.save()
  ctx.strokeStyle = theme.accent
  ctx.fillStyle = theme.accent
  for (const [cx, cy, rot] of spots) {
    if (style === 'rosette') {
      drawRosette(cx, cy)
      continue
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rot)
    if (style === 'bracket') {
      ctx.lineWidth = 3 * s
      const len = 22 * s
      ctx.beginPath()
      ctx.moveTo(-len, len * 0.4)
      ctx.lineTo(-len, -len)
      ctx.lineTo(len * 0.4, -len)
      ctx.stroke()
      ctx.lineWidth = 1.2 * s
      ctx.beginPath()
      ctx.moveTo(-len * 0.6, len * 0.4)
      ctx.lineTo(-len * 0.6, -len * 0.6)
      ctx.lineTo(len * 0.4, -len * 0.6)
      ctx.stroke()
    } else {
      // Fleur-de-lis: a central lobe with a leaf either side, over a band.
      const u = 13 * s
      ctx.beginPath()
      ctx.moveTo(0, -1.5 * u)
      ctx.bezierCurveTo(0.7 * u, -0.5 * u, 0.5 * u, 0.4 * u, 0, 0.7 * u)
      ctx.bezierCurveTo(-0.5 * u, 0.4 * u, -0.7 * u, -0.5 * u, 0, -1.5 * u)
      ctx.fill()
      for (const side of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(side * 0.15 * u, 0.1 * u)
        ctx.quadraticCurveTo(side * 1.5 * u, -0.5 * u, side * 1.15 * u, 0.75 * u)
        ctx.quadraticCurveTo(side * 0.7 * u, 0.35 * u, side * 0.15 * u, 0.4 * u)
        ctx.fill()
      }
      ctx.lineWidth = 3 * s
      ctx.beginPath()
      ctx.moveTo(-0.9 * u, 0.75 * u)
      ctx.lineTo(0.9 * u, 0.75 * u)
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.restore()
}
