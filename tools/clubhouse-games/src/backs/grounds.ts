import { BackPattern, BackTheme } from './backThemes'

export interface GroundArea {
  x: number
  y: number
  w: number
  h: number
  scale: number
}

type Ground = (ctx: CanvasRenderingContext2D, theme: BackTheme, a: GroundArea) => void

// Interlaced sine rules running both ways: the engraved wave ground.
const waves: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const step = 12 * s
  const amp = 6 * s
  const wave = 44 * s
  ctx.globalAlpha = 0.68
  for (let gy = y - amp; gy < y + h + amp; gy += step) {
    ctx.beginPath()
    for (let gx = x; gx <= x + w; gx += 3 * s) {
      const yy = gy + Math.sin((gx / wave) * Math.PI) * amp
      if (gx === x) ctx.moveTo(gx, yy)
      else ctx.lineTo(gx, yy)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 0.4
  for (let gx = x - amp; gx < x + w + amp; gx += step * 1.5) {
    ctx.beginPath()
    for (let gy = y; gy <= y + h; gy += 3 * s) {
      const xx = gx + Math.sin((gy / wave) * Math.PI) * amp
      if (gy === y) ctx.moveTo(xx, gy)
      else ctx.lineTo(xx, gy)
    }
    ctx.stroke()
  }
}

// Diagonal net, weighted every fourth line.
const lattice: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const step = 14 * s
  let i = 0
  for (let gx = x - h; gx < x + w + h; gx += step, i++) {
    const heavy = i % 4 === 0
    ctx.globalAlpha = heavy ? 0.8 : 0.42
    ctx.lineWidth = heavy ? 2.2 * s : Math.max(0.7, 1 * s)
    ctx.beginPath()
    ctx.moveTo(gx, y)
    ctx.lineTo(gx + h, y + h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gx + h, y)
    ctx.lineTo(gx, y + h)
    ctx.stroke()
  }
}

// Plain fine horizontal rules.
const rules: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  ctx.globalAlpha = 0.4
  for (let gy = y; gy < y + h; gy += 10 * s) {
    ctx.beginPath()
    ctx.moveTo(x, gy)
    ctx.lineTo(x + w, gy)
    ctx.stroke()
  }
}

// Overlapping arcs, offset row to row: fish scale.
const scales: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const r = 22 * s
  ctx.globalAlpha = 0.62
  let row = 0
  for (let gy = y; gy < y + h + r; gy += r, row++) {
    const offset = row % 2 === 0 ? 0 : r
    for (let gx = x - r; gx < x + w + r; gx += r * 2) {
      ctx.beginPath()
      ctx.arc(gx + offset, gy, r, Math.PI, 0)
      ctx.stroke()
    }
  }
}

// Basket weave: alternating blocks of hatching.
const weave: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const cell = 26 * s
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(0.7, 1.2 * s)
  let row = 0
  for (let gy = y; gy < y + h; gy += cell, row++) {
    let col = 0
    for (let gx = x; gx < x + w; gx += cell, col++) {
      const vertical = (row + col) % 2 === 0
      for (let k = 3 * s; k < cell; k += 5 * s) {
        ctx.beginPath()
        if (vertical) {
          ctx.moveTo(gx + k, gy)
          ctx.lineTo(gx + k, gy + cell)
        } else {
          ctx.moveTo(gx, gy + k)
          ctx.lineTo(gx + cell, gy + k)
        }
        ctx.stroke()
      }
    }
  }
}

// Nested chevrons marching down the panel.
const chevron: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const step = 11 * s
  const rise = 26 * s
  ctx.globalAlpha = 0.55
  for (let gy = y - rise; gy < y + h + rise; gy += step) {
    ctx.beginPath()
    for (let gx = x; gx <= x + w; gx += 4 * s) {
      const t = ((gx - x) % (rise * 2)) / rise
      const yy = gy + (t < 1 ? t : 2 - t) * rise
      if (gx === x) ctx.moveTo(gx, yy)
      else ctx.lineTo(gx, yy)
    }
    ctx.stroke()
  }
}

// Diamond lattice with a pip at every crossing.
const argyle: Ground = (ctx, theme, { x, y, w, h, scale: s }) => {
  const step = 30 * s
  ctx.globalAlpha = 0.55
  for (let gx = x - h; gx < x + w + h; gx += step) {
    ctx.beginPath()
    ctx.moveTo(gx, y)
    ctx.lineTo(gx + h, y + h)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(gx + h, y)
    ctx.lineTo(gx, y + h)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.5
  ctx.fillStyle = theme.accent
  for (let gy = y; gy < y + h + step; gy += step) {
    const offset = Math.round((gy - y) / step) % 2 === 0 ? 0 : step / 2
    for (let gx = x + offset; gx < x + w; gx += step) {
      ctx.beginPath()
      ctx.arc(gx, gy, 2.6 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// Hexagon net.
const honeycomb: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const r = 16 * s
  const dx = r * 1.5
  const dy = r * Math.sqrt(3)
  ctx.globalAlpha = 0.6
  let col = 0
  for (let gx = x - r; gx < x + w + r; gx += dx, col++) {
    const shift = col % 2 === 0 ? 0 : dy / 2
    for (let gy = y - r; gy < y + h + r; gy += dy) {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const px = gx + Math.cos(a) * r
        const py = gy + shift + Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
}

// Rays from the middle, crossed by rings.
const starburst: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const cx = x + w / 2
  const cy = y + h / 2
  const reach = Math.hypot(w, h) / 2
  ctx.globalAlpha = 0.5
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach)
    ctx.stroke()
  }
  ctx.globalAlpha = 0.34
  for (let r = 18 * s; r < reach; r += 18 * s) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// A family of logarithmic spirals turning out of the middle.
const spiral: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const cx = x + w / 2
  const cy = y + h / 2
  const reach = Math.hypot(w, h) / 2
  const arms = 14
  ctx.globalAlpha = 0.5
  for (let k = 0; k < arms; k++) {
    const phase = (k / arms) * Math.PI * 2
    ctx.beginPath()
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 3
      const r = 6 * s * Math.exp(0.36 * t)
      if (r > reach) break
      const px = cx + Math.cos(t + phase) * r
      const py = cy + Math.sin(t + phase) * r
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
}

// Ogee trellis: pointed arches interlocking into a quatrefoil net.
const ogee: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const cw = 42 * s
  const ch = 52 * s
  ctx.globalAlpha = 0.6
  let row = 0
  for (let gy = y - ch; gy < y + h + ch; gy += ch, row++) {
    const offset = row % 2 === 0 ? 0 : cw / 2
    for (let gx = x - cw; gx < x + w + cw; gx += cw) {
      const px = gx + offset
      ctx.beginPath()
      ctx.moveTo(px, gy + ch / 2)
      ctx.quadraticCurveTo(px, gy, px + cw / 2, gy)
      ctx.quadraticCurveTo(px + cw, gy, px + cw, gy + ch / 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(px, gy + ch / 2)
      ctx.quadraticCurveTo(px, gy + ch, px + cw / 2, gy + ch)
      ctx.quadraticCurveTo(px + cw, gy + ch, px + cw, gy + ch / 2)
      ctx.stroke()
    }
  }
}

// Two ring families with slightly different centers, beating against each
// other.
const moire: Ground = (ctx, _theme, { x, y, w, h, scale: s }) => {
  const reach = Math.hypot(w, h)
  ctx.globalAlpha = 0.42
  for (const [ox, oy] of [
    [-w * 0.16, 0],
    [w * 0.16, 0],
  ]) {
    const cx = x + w / 2 + ox
    const cy = y + h / 2 + oy
    for (let r = 9 * s; r < reach; r += 9 * s) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
}

const GROUNDS: Record<BackPattern, Ground> = {
  waves,
  lattice,
  rules,
  scales,
  weave,
  chevron,
  argyle,
  honeycomb,
  starburst,
  spiral,
  ogee,
  moire,
}

export function drawGround(
  ctx: CanvasRenderingContext2D,
  theme: BackTheme,
  area: GroundArea,
): void {
  const ground = GROUNDS[theme.pattern]
  if (!ground) throw new Error(`Unknown back pattern: ${JSON.stringify(theme.pattern)}`)
  ctx.save()
  ctx.strokeStyle = theme.patternColor
  ctx.lineWidth = Math.max(0.7, 1.1 * area.scale)
  ground(ctx, theme, area)
  ctx.restore()
}
