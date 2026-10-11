/**
 * Tiny pixel-art raster for UI tiles, drawn at voxel resolution and written
 * upscaled with nearest-neighbour, so one voxel = SCALE×SCALE pixels.
 */
import { PNG } from 'pngjs'

export type Rgba = [number, number, number, number]
export const CLEAR: Rgba = [0, 0, 0, 0]

export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [0, 1, 2, 3].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgba
}

export function shade(c: Rgba, amount: number): Rgba {
  return amount >= 0 ? mix(c, [255, 255, 255, c[3]], amount) : mix(c, [0, 0, 0, c[3]], -amount)
}

export function gray(c: Rgba): Rgba {
  const l = Math.round(c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11)
  return [l, l, l, c[3]]
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Raster {
  readonly px: Rgba[]
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array.from({ length: w * h }, () => CLEAR)
  }

  get(x: number, y: number): Rgba {
    return this.px[y * this.w + x] ?? CLEAR
  }

  set(x: number, y: number, c: Rgba): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c
    return this
  }

  rect(x: number, y: number, w: number, h: number, c: Rgba | ((x: number, y: number) => Rgba)): this {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, typeof c === 'function' ? c(i, j) : c)
    return this
  }

  /** Clears `step` voxels of each corner in a staircase (voxel "rounding"). */
  notch(step: number): this {
    for (let k = 0; k < step; k += 1) {
      for (let i = 0; i < step - k; i += 1) {
        for (const [x, y] of [[i, k], [this.w - 1 - i, k], [i, this.h - 1 - k], [this.w - 1 - i, this.h - 1 - k]] as const) this.set(x, y, CLEAR)
      }
    }
    return this
  }

  /** Paints a 1-voxel outline around every opaque pixel's transparent neighbours (inside the canvas). */
  outline(c: Rgba): this {
    const inside = this.px.map((p) => p[3] > 0)
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (!inside[y * this.w + x]) continue
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = x + dx!, ny = y + dy!
          return nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || !inside[ny * this.w + nx]
        })
        if (edge) this.set(x, y, c)
      }
    }
    return this
  }

  /** ±1 shade jitter on a fraction of opaque pixels matching `where`. */
  speckle(seed: number, amount: number, strength = 0.08, where: (x: number, y: number) => boolean = () => true): this {
    const r = rng(seed)
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        const c = this.get(x, y)
        if (c[3] === 0 || !where(x, y)) continue
        const roll = r()
        if (roll < amount) this.set(x, y, shade(c, r() < 0.5 ? strength : -strength))
      }
    }
    return this
  }

  /** Stamps a glyph (rows of '#', '.' = skip) at x, y. */
  glyph(rows: string[], x: number, y: number, c: Rgba): this {
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && this.set(x + i, y + j, c)))
    return this
  }

  map(f: (c: Rgba, x: number, y: number) => Rgba): this {
    for (let y = 0; y < this.h; y += 1) for (let x = 0; x < this.w; x += 1) this.px[y * this.w + x] = f(this.get(x, y), x, y)
    return this
  }

  png(scale: number): Buffer {
    const png = new PNG({ width: this.w * scale, height: this.h * scale })
    for (let y = 0; y < this.h * scale; y += 1) {
      for (let x = 0; x < this.w * scale; x += 1) {
        const c = this.get(Math.floor(x / scale), Math.floor(y / scale))
        const o = (y * this.w * scale + x) * 4
        png.data[o] = c[0]
        png.data[o + 1] = c[1]
        png.data[o + 2] = c[2]
        png.data[o + 3] = c[3]
      }
    }
    return PNG.sync.write(png)
  }
}
