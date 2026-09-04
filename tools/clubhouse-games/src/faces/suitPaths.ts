import { Suit } from '../types'

// Path-drawn suit pips (no font dependency — unicode glyphs render as color
// emoji on macOS). Fills a box centered at (0,0) spanning roughly [-s, s] in
// both axes. Drawn pointing up; caller applies fillStyle and rotation.
export function drawSuitPath(
  ctx: CanvasRenderingContext2D,
  suit: Suit,
  s: number,
): void {
  ctx.beginPath()
  switch (suit) {
    case 'spades': {
      // Upside-down heart + stem.
      ctx.moveTo(0, -s)
      ctx.bezierCurveTo(0.9 * s, -0.25 * s, 0.95 * s, 0.35 * s, 0.45 * s, 0.55 * s)
      ctx.bezierCurveTo(0.2 * s, 0.65 * s, 0.05 * s, 0.55 * s, 0, 0.4 * s)
      ctx.bezierCurveTo(-0.05 * s, 0.55 * s, -0.2 * s, 0.65 * s, -0.45 * s, 0.55 * s)
      ctx.bezierCurveTo(-0.95 * s, 0.35 * s, -0.9 * s, -0.25 * s, 0, -s)
      ctx.closePath()
      ctx.moveTo(-0.18 * s, s)
      ctx.quadraticCurveTo(-0.05 * s, 0.45 * s, -0.06 * s, 0.35 * s)
      ctx.lineTo(0.06 * s, 0.35 * s)
      ctx.quadraticCurveTo(0.05 * s, 0.45 * s, 0.18 * s, s)
      ctx.closePath()
      break
    }
    case 'hearts': {
      ctx.moveTo(0, 0.85 * s)
      ctx.bezierCurveTo(-1.05 * s, -0.05 * s, -0.55 * s, -0.95 * s, 0, -0.45 * s)
      ctx.bezierCurveTo(0.55 * s, -0.95 * s, 1.05 * s, -0.05 * s, 0, 0.85 * s)
      ctx.closePath()
      break
    }
    case 'diamonds': {
      ctx.moveTo(0, -s)
      ctx.lineTo(0.62 * s, 0)
      ctx.lineTo(0, s)
      ctx.lineTo(-0.62 * s, 0)
      ctx.closePath()
      break
    }
    case 'clubs': {
      const r = 0.42 * s
      ctx.arc(0, -0.45 * s, r, 0, Math.PI * 2)
      ctx.moveTo(-0.42 * s + r, 0.15 * s)
      ctx.arc(-0.42 * s, 0.15 * s, r, 0, Math.PI * 2)
      ctx.moveTo(0.42 * s + r, 0.15 * s)
      ctx.arc(0.42 * s, 0.15 * s, r, 0, Math.PI * 2)
      ctx.moveTo(-0.18 * s, s)
      ctx.quadraticCurveTo(-0.05 * s, 0.3 * s, -0.06 * s, 0.2 * s)
      ctx.lineTo(0.06 * s, 0.2 * s)
      ctx.quadraticCurveTo(0.05 * s, 0.3 * s, 0.18 * s, s)
      ctx.closePath()
      break
    }
  }
  ctx.fill()
}
