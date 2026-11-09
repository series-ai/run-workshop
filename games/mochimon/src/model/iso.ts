// A tiny isometric renderer for one-bit sprites: build a piece of sushi from
// signed-distance primitives, ray-march it through a 2:1 isometric camera,
// and turn each hit into ink or paper. Faces pick a tone by which way they
// point (top white, left light, right darker), materials add their own
// darkness and patterns, and edges get a crisp ink outline.

import { Bitmap, INK, PAPER } from './bitmap.ts'
import { bayer } from './bitmap.ts'

export type V3 = [number, number, number]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s]
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2])
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1))

/** A shape: signed distance at p, and which material it is. */
export interface Sdf { d: (p: V3) => number; mat: string }

export const box = (c: V3, half: V3, r = 0, mat = ''): Sdf => ({
  mat,
  d: (p) => {
    const q: V3 = [Math.abs(p[0] - c[0]) - half[0] + r, Math.abs(p[1] - c[1]) - half[1] + r, Math.abs(p[2] - c[2]) - half[2] + r]
    return len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r
  },
})

export const ellipsoid = (c: V3, rad: V3, mat = ''): Sdf => ({
  mat,
  d: (p) => {
    const q: V3 = [(p[0] - c[0]) / rad[0], (p[1] - c[1]) / rad[1], (p[2] - c[2]) / rad[2]]
    const k = len(q)
    return (k - 1) * Math.min(rad[0], rad[1], rad[2])
  },
})

/** Vertical cylinder (axis z) with rounded rim. */
export const cylinder = (c: V3, r: number, halfH: number, round = 0.6, mat = ''): Sdf => ({
  mat,
  d: (p) => {
    const dx = Math.hypot(p[0] - c[0], p[1] - c[1]) - r + round
    const dz = Math.abs(p[2] - c[2]) - halfH + round
    return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) - round
  },
})

/** Triangular prism: an isoceles triangle in the x-z plane, extruded along y. */
export const prism = (c: V3, halfBase: number, height: number, halfDepth: number, round = 1, mat = ''): Sdf => ({
  mat,
  d: (p) => {
    const x = Math.abs(p[0] - c[0])
    const z = p[2] - c[2]
    // distance to the triangle's sloped side and its base, rounded
    const slope = Math.hypot(height, halfBase)
    const side = (x * height + z * halfBase - halfBase * height) / slope
    const tri = Math.max(side, -z) + round
    const dy = Math.abs(p[1] - c[1]) - halfDepth + round
    return Math.min(Math.max(tri, dy), 0) + Math.hypot(Math.max(tri, 0), Math.max(dy, 0)) - round
  },
})

/** Bend a shape so its ends droop: like a slice of fish draped over rice. */
export const droop = (s: Sdf, k: number, cy = 0): Sdf => ({ mat: s.mat, d: (p) => s.d([p[0], p[1], p[2] + k * (p[1] - cy) ** 2]) })

export function scene(...parts: Sdf[]): (p: V3) => { d: number; mat: string } {
  return (p) => {
    let best = Infinity
    let mat = ''
    for (const s of parts) { const d = s.d(p); if (d < best) { best = d; mat = s.mat } }
    return { d: best, mat }
  }
}

export interface Hit { p: V3; n: V3; mat: string; depth: number }

/** How a material looks: base darkness 0..1, plus an optional surface pattern returning extra darkness. */
/** `soft` (0..1) scales the face shading down, for pale materials like rice that should stay mostly white. */
export interface Material { dark: number; side?: number; soft?: number; pattern?: (p: V3, n: V3) => number | null }

/**
 * Render `sdf` into a w x h bitmap. `scale` is world units per pixel; the
 * object is centred on `center`. Light comes from the upper left, so the
 * top is white, the left (+y) face takes a light halftone, the right (+x)
 * face a darker one.
 */
/** Face darkness for: facing the light, top-ish, turning away, facing away. */
export type Faces = [number, number, number, number]

/** The light direction every render uses (upper left, toward the viewer). */
export const LIGHT: V3 = norm([0.35, 1, 1.7])

/** Ray-march the scene: what's under each pixel (material, surface point and normal, depth), or null. */
export function traceIso(sdf: (p: V3) => { d: number; mat: string }, w: number, h: number, scale: number, center: V3): (Hit | null)[] {
  const e = Math.PI / 6
  const a = Math.cos(e) / Math.SQRT2
  const bz = Math.sin(e)
  const d: V3 = [-a, -a, -bz]
  const r: V3 = [Math.SQRT1_2, -Math.SQRT1_2, 0]
  const u: V3 = [-Math.SQRT1_2 * bz, -Math.SQRT1_2 * bz, 2 * Math.SQRT1_2 * a]
  const hits: (Hit | null)[] = []
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const sx = (px + 0.5 - w / 2) * scale
      const sy = (py + 0.5 - h / 2) * scale
      const P = add(add(center, mul(r, sx)), mul(u, -sy))
      const o = add(P, mul(d, -60))
      let t = 0
      let hit: Hit | null = null
      for (let i = 0; i < 160 && t < 120; i++) {
        const q = add(o, mul(d, t))
        const s = sdf(q)
        if (s.d < 0.02) {
          const eps = 0.05
          const n = norm([
            sdf([q[0] + eps, q[1], q[2]]).d - sdf([q[0] - eps, q[1], q[2]]).d,
            sdf([q[0], q[1] + eps, q[2]]).d - sdf([q[0], q[1] - eps, q[2]]).d,
            sdf([q[0], q[1], q[2] + eps]).d - sdf([q[0], q[1], q[2] - eps]).d,
          ])
          hit = { p: q, n, mat: s.mat, depth: t }
          break
        }
        t += Math.max(s.d * 0.8, 0.01)
      }
      hits.push(hit)
    }
  }
  return hits
}

export function renderIso(sdf: (p: V3) => { d: number; mat: string }, mats: Record<string, Material>, w: number, h: number, scale: number, center: V3, faces: Faces = [0, 0.26, 0.5, 0.76], edges = true, thin = false): Bitmap {
  return shadeHits(traceIso(sdf, w, h, scale, center), w, h, scale, mats, faces, edges, thin)
}

/**
 * Is there a line between a hit and its neighbour (dx, dy) (null = nothing there)? The silhouette, material borders and
 * steep depth jumps. With `thin`, an inner line goes on one side only: the pixel behind the jump, or for a border at
 * the same depth the one with its neighbour to the right or below. Otherwise both sides take it and inner lines come
 * out two pixels thick: fine for art that's halved afterwards (the cats), heavy for art drawn at its final size (food).
 */
export function edgeAt(hit: Hit, o: Hit | null, dx: number, dy: number, scale: number, thin = false): boolean {
  if (o === null) return true
  const jump = Math.abs(o.depth - hit.depth) > 3.2 * Math.max(scale, 0.62)
  if (!jump && o.mat === hit.mat) return false
  if (!thin) return true
  if (jump) return hit.depth > o.depth
  return dx > 0 || dy > 0
}

/**
 * Turn traced hits into a one-bit image with a given set of materials. Tracing is the
 * expensive part, so callers that need several looks at the same geometry (line art, fills,
 * masks) trace once and shade the same hits several times.
 */
export function shadeHits(hits: (Hit | null)[], w: number, h: number, scale: number, mats: Record<string, Material>, faces: Faces = [0, 0.26, 0.5, 0.76], edges = true, thin = false): Bitmap {
  const L = LIGHT
  const b = new Bitmap(w, h)
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : hits[y * w + x])
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hit = at(x, y)
      if (hit === null) continue
      // outline: the silhouette, material borders, and steep depth jumps (creases between parts)
      let edge = false
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (edgeAt(hit, at(x + dx, y + dy), dx, dy, scale, thin)) { edge = true; break }
      if (edge && edges) { b.set(x, y, INK); continue }
      const m = mats[hit.mat] ?? { dark: 0 }
      const lit = hit.n[0] * L[0] + hit.n[1] * L[1] + hit.n[2] * L[2]
      // faces: lit from the upper left; keep the top white and only darken as it turns
      let dark = lit > 0.75 ? faces[0] : lit > 0.45 ? faces[1] : lit > 0.15 ? faces[2] : faces[3]
      if (m.soft !== undefined) dark *= m.soft
      if (m.side !== undefined && hit.n[2] < 0.6) dark = Math.max(dark, m.side)
      dark = Math.min(1, dark + m.dark)
      const extra = m.pattern?.(hit.p, hit.n)
      if (extra !== null && extra !== undefined) dark = extra
      b.set(x, y, dark > bayer(x, y) ? INK : PAPER)
    }
  }
  return b
}
