// A tiny one-bit raster: every pixel is clear, ink or paper. Shapes are filled
// with a tone (solid or an ordered dither / hatch pattern) and outlined in ink,
// so sprites come out crisp with no anti-aliasing. Also writes PNGs.

import { deflateSync } from 'node:zlib'

export const CLEAR = 0
export const INK = 1
export const PAPER = 2

/**
 * Tones: '#' ink, 'o' paper, '-' light dither (1 in 4), '+' checker,
 * '=' dark dither (3 in 4), '/' diagonal hatch, '|' vertical lines.
 */
export type Tone = '#' | 'o' | '-' | '+' | '=' | '/' | '|'

export function toneAt(t: Tone, x: number, y: number): number {
  switch (t) {
    case '#': return INK
    case 'o': return PAPER
    case '-': return x % 2 === 0 && y % 2 === 0 ? INK : PAPER
    case '+': return (x + y) % 2 === 0 ? INK : PAPER
    case '=': return x % 2 === 1 && y % 2 === 1 ? PAPER : INK
    case '/': return (x + y) % 3 === 0 ? INK : PAPER
    case '|': return x % 2 === 0 ? INK : PAPER
  }
}

export type Test = (x: number, y: number) => boolean

export const ellipse = (cx: number, cy: number, rx: number, ry: number): Test =>
  (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

export const rect = (x0: number, y0: number, w: number, h: number): Test =>
  (x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h

export function poly(pts: [number, number][]): Test {
  return (x, y) => {
    const px = x + 0.5
    const py = y + 0.5
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
}

export const union = (...ts: Test[]): Test => (x, y) => ts.some((t) => t(x, y))
export const minus = (a: Test, b: Test): Test => (x, y) => a(x, y) && !b(x, y)
export const and = (a: Test, b: Test): Test => (x, y) => a(x, y) && b(x, y)

export class Bitmap {
  readonly px: Uint8Array
  constructor(readonly w: number, readonly h: number) {
    this.px = new Uint8Array(w * h)
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR
    return this.px[y * this.w + x]
  }

  set(x: number, y: number, v: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = v
    return this
  }

  /** Fill every pixel inside `test` with a tone, no outline. */
  fill(test: Test, t: Tone): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x, y)) this.set(x, y, toneAt(t, x, y))
    return this
  }

  /** Fill with a tone and draw a 1px ink outline just inside the edge. */
  shape(test: Test, t: Tone, line = 1): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!test(x, y)) continue
        let edge = false
        for (let d = 1; d <= line && !edge; d++) edge = !test(x - d, y) || !test(x + d, y) || !test(x, y - d) || !test(x, y + d)
        this.set(x, y, edge ? INK : toneAt(t, x, y))
      }
    }
    return this
  }

  /**
   * White fill with an ink outline, and a dither band only along the shadow
   * side (bottom and right), `w` pixels deep: mostly paper, halftone at the turn.
   */
  shade(test: Test, w = 2, band: Tone = '+', base: Tone = 'o'): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!test(x, y)) continue
        if (!test(x - 1, y) || !test(x + 1, y) || !test(x, y - 1) || !test(x, y + 1)) { this.set(x, y, INK); continue }
        let near = false
        for (let d = 2; d <= w + 1 && !near; d++) near = !test(x + d, y) || !test(x, y + d)
        this.set(x, y, toneAt(near ? band : base, x, y))
      }
    }
    return this
  }

  /** Stamp ASCII art: '.' or ' ' skip, '#' ink, 'o' paper, any other char a tone. `e` maps to ink or paper. */
  stamp(rows: string[], ox: number, oy: number, e: number = INK, flip = false): this {
    rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        const x = flip ? row.length - 1 - i : i
        if (ch === '.' || ch === ' ') continue
        const v = ch === 'e' ? e : ch === 'E' ? (e === INK ? PAPER : INK) : toneAt(ch as Tone, ox + x, oy + y)
        this.set(ox + x, oy + y, v)
      }
    })
    return this
  }

  /** Hard drop shadow, like a print offset: ink behind everything, shifted by (dx, dy). */
  shadow(dx: number, dy: number): this {
    const src = this.px.slice()
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] === CLEAR) continue
        const tx = x + dx
        const ty = y + dy
        if (tx < this.w && ty < this.h && src[ty * this.w + tx] === CLEAR && this.get(tx, ty) === CLEAR) this.set(tx, ty, INK)
      }
    }
    return this
  }

  /** Copy another bitmap onto this one (clear pixels skipped). */
  draw(b: Bitmap, ox: number, oy: number): this {
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const v = b.get(x, y)
      if (v !== CLEAR) this.set(ox + x, oy + y, v)
    }
    return this
  }

  line(x0: number, y0: number, x1: number, y1: number, v = INK): this {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x0, y0, v)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
    return this
  }

  /** Clear any pixel outside `test` (for clipping a finished shape). */
  clip(test: Test): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!test(x, y)) this.set(x, y, CLEAR)
    return this
  }

  png(ink: [number, number, number], paper: [number, number, number], scale = 1): Buffer {
    const W = this.w * scale
    const H = this.h * scale
    const raw = Buffer.alloc((W * 4 + 1) * H)
    for (let y = 0; y < H; y++) {
      raw[y * (W * 4 + 1)] = 0
      for (let x = 0; x < W; x++) {
        const v = this.get(Math.floor(x / scale), Math.floor(y / scale))
        const o = y * (W * 4 + 1) + 1 + x * 4
        const c = v === INK ? ink : paper
        raw[o] = c[0]
        raw[o + 1] = c[1]
        raw[o + 2] = c[2]
        raw[o + 3] = v === CLEAR ? 0 : 255
      }
    }
    return encodePng(W, H, raw)
  }
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(w: number, h: number, raw: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------- volume shading

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
export const bayer = (x: number, y: number): number => BAYER[(y & 3) * 4 + (x & 3)]

export interface VolumeOpts {
  /** How far in from the edge the form keeps curving, in pixels (bigger = rounder). */
  round?: number
  /** Extra darkness for the material, 0 (white) .. 1 (black). */
  dark?: number
  /** Light direction (x right, y down, z toward the viewer). Default: top-left, in front. */
  light?: [number, number, number]
  /** How much of the turn goes to halftone; lower keeps more white. */
  spread?: number
  /** 'dither' shades with ordered halftone; 'line' draws one contour line on the shadow side instead. */
  mode?: 'dither' | 'line' | 'band'
  outline?: boolean
}

/**
 * Fill `test` as a rounded 3D form: a height field from distance-to-edge,
 * lit from the top-left, then ordered-dithered with a bias toward paper so
 * the halftone only shows where the surface turns away from the light.
 */
export function volume(b: Bitmap, test: Test, o: VolumeOpts = {}): void {
  const R = o.round ?? 4
  const dark = o.dark ?? 0
  const spread = o.spread ?? 0.55
  const mode = o.mode ?? 'dither'
  let [lx, ly, lz] = o.light ?? [-0.55, -0.75, 0.55]
  const ll = Math.hypot(lx, ly, lz)
  lx /= ll; ly /= ll; lz /= ll
  const W = b.w
  const H = b.h
  const inside = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) inside[y * W + x] = test(x, y) ? 1 : 0
  // distance to the nearest outside pixel (brute force; sprites are tiny)
  const edge: [number, number][] = []
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    const inn = x >= 0 && y >= 0 && x < W && y < H && inside[y * W + x] === 1
    if (inn) continue
    // only keep outside pixels that touch the shape
    let touch = false
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && inside[ny * W + nx] === 1) touch = true
    }
    if (touch) edge.push([x, y])
  }
  const dist = new Float32Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside[y * W + x]) continue
    let best = Infinity
    for (const [ex, ey] of edge) { const d = (ex - x) ** 2 + (ey - y) ** 2; if (d < best) best = d }
    dist[y * W + x] = Math.sqrt(best)
  }
  const h = (x: number, y: number): number => {
    const xx = Math.max(0, Math.min(W - 1, x))
    const yy = Math.max(0, Math.min(H - 1, y))
    if (!inside[yy * W + xx]) return 0
    const t = Math.min(1, dist[yy * W + xx] / R)
    return Math.sqrt(1 - (1 - t) * (1 - t)) * R
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inside[y * W + x]) continue
    const isEdge = !test(x - 1, y) || !test(x + 1, y) || !test(x, y - 1) || !test(x, y + 1)
    if (isEdge && o.outline !== false) { b.set(x, y, INK); continue }
    const nx = -(h(x + 1, y) - h(x - 1, y)) / 2
    const ny = -(h(x, y + 1) - h(x, y - 1)) / 2
    const nl = Math.hypot(nx, ny, 1)
    const lit = (nx * lx + ny * ly + lz) / nl // -1..1
    // darkness: 0 on any face at least as lit as one facing the viewer,
    // rising only as the surface turns away from the light
    const shadow = Math.max(0, Math.min(1, (lz - lit) / spread)) * (1 - dark) + dark
    if (mode === 'line') {
      // one contour line, a few pixels in, only on the shadow side
      const d = dist[y * W + x]
      const onLine = d >= 2.5 && d < 3.5 && lit < 0.6
      b.set(x, y, onLine || shadow > 0.92 ? INK : PAPER)
    } else if (mode === 'band') {
      b.set(x, y, shadow > 0.5 ? toneAt('+', x, y) : PAPER)
    } else {
      b.set(x, y, shadow > bayer(x, y) ? INK : PAPER)
    }
  }
}
