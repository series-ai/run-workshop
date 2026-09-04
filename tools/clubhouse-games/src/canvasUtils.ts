export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// A woven guilloche band: many closed curves whose radius ripples around the
// circle, each rotated a little from the last. This is the engraved lacework
// on banknotes and on the back of a printed deck.
export interface GuillocheBandOptions {
  cx: number
  cy: number
  // Mean radius of the band.
  radius: number
  // Peak deviation from the mean radius, for the rippling term.
  amplitude: number
  // Ripples per revolution for that term.
  waves: number
  // A second, fixed ripple. Without it, shifting the phase of a single
  // frequency only rotates the curve, so the copies would land on top of each
  // other instead of interlacing.
  amplitude2: number
  waves2: number
  // How many curves to lay over each other, at evenly spread phases.
  lines: number
  // Extra rotation spread across those curves.
  spin?: number
}

export function drawGuillocheBand(
  ctx: CanvasRenderingContext2D,
  opts: GuillocheBandOptions,
): void {
  const { cx, cy, radius, amplitude, waves, amplitude2, waves2, lines } = opts
  const spin = opts.spin ?? 0
  if (lines < 1) throw new Error(`drawGuillocheBand needs at least one line, got ${lines}`)
  const steps = 300
  for (let l = 0; l < lines; l++) {
    const f = l / lines
    const phase = f * Math.PI * 2
    const twist = f * spin
    ctx.beginPath()
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2
      const r =
        radius + amplitude * Math.cos(waves * th + phase) + amplitude2 * Math.cos(waves2 * th)
      const a = th + twist
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()
  }
}

// A ring of overlapping circles: the simplest dense rosette, and the one that
// reads as lace at small sizes.
export function drawCircleRosette(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  petals: number,
  // Circle radius as a fraction of the ring radius.
  ratio = 0.62,
): void {
  if (petals < 1) throw new Error(`drawCircleRosette needs at least one petal, got ${petals}`)
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, radius * ratio, 0, Math.PI * 2)
    ctx.stroke()
  }
}

// Splits a #rrggbb string into its three channels.
function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  if (h.length !== 6) throw new Error(`Expected a #rrggbb color, got ${JSON.stringify(hex)}`)
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

export function lighten(hex: string, amount: number): string {
  const [r, g, b] = channels(hex)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

export function darken(hex: string, amount: number): string {
  const [r, g, b] = channels(hex)
  const mix = (c: number) => Math.round(c * (1 - amount))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
