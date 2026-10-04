/**
 * Z-fighting detector. Two triangles fight when they lie in the same plane
 * (within `tolerance`) and their areas overlap: the depth buffer cannot order
 * them, so the picture flickers between their colours as the camera moves.
 * World materials are double-sided, so facing does not protect either:
 *
 * - `same`: both face the same way. Always visible where not covered, e.g. two
 *   parts whose flush tops overlap. This is the defect to fix.
 * - `opposite`: back to back. Usually two solids touching face to face, hidden
 *   inside the joined volume; reported, but it rarely shows.
 *
 * Positions are taken at rest (node world matrices; skinned meshes in bind
 * space). Pure: no rendering, deterministic.
 */
import type { Document } from '@gltf-transform/core'
import { PNG } from 'pngjs'

export interface Overlap {
  facing: 'same' | 'opposite'
  /** Overlap area in model units². */
  area: number
  /** Node names of the two triangles (equal when one mesh overlaps itself). */
  nodes: [string, string]
  /** A point in the overlap (model units), to find it in a viewer. */
  at: [number, number, number]
  /** Plane normal (unit) of the first triangle. */
  normal: [number, number, number]
  /** Atlas colours at the two triangles' centres, as #rrggbb (null without a texture). */
  colors: [string | null, string | null]
  /**
   * Share of sample points in the overlap where the fight can be seen: the
   * two faces show different atlas colours there (1 when untextured), and the
   * point is not buried inside another solid. 0 = invisible.
   */
  mismatch: number
}

interface Tri {
  p: number[][]
  n: number[]
  d: number
  node: string
  color: string | null
  uv: number[][] | null
  png: PNG | null
}

type Vec = number[]
const sub = (a: Vec, b: Vec) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
const dot = (a: Vec, b: Vec) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!
const cross = (a: Vec, b: Vec) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!]

function texel(png: PNG, u: number, v: number): number[] {
  const x = Math.min(png.width - 1, Math.max(0, Math.floor(u * png.width)))
  const y = Math.min(png.height - 1, Math.max(0, Math.floor(v * png.height)))
  const o = (y * png.width + x) * 4
  return [png.data[o]!, png.data[o + 1]!, png.data[o + 2]!]
}

function hex(png: PNG, u: number, v: number): string {
  return '#' + texel(png, u, v).map((c) => c.toString(16).padStart(2, '0')).join('')
}

function triangles(doc: Document): Tri[] {
  const out: Tri[] = []
  const decoded = new Map<unknown, PNG>()
  const a = [0, 0, 0]
  const e = [0, 0]
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    // A skinned mesh ignores its node transform: its vertices are in bind space.
    const m = node.getSkin() ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : node.getWorldMatrix()
    const world = (v: number[]) => [0, 1, 2].map((r) => m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]!)
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const idx = prim.getIndices()
      const uv = prim.getAttribute('TEXCOORD_0')
      const texture = prim.getMaterial()?.getBaseColorTexture()
      let png: PNG | null = null
      if (texture && texture.getMimeType() === 'image/png') {
        png = decoded.get(texture) ?? PNG.sync.read(Buffer.from(texture.getImage()!))
        decoded.set(texture, png)
      }
      const count = idx ? idx.getCount() : pos.getCount()
      for (let i = 0; i + 2 < count; i += 3) {
        const p: number[][] = []
        const t: number[][] = []
        for (let k = 0; k < 3; k += 1) {
          const j = idx ? idx.getScalar(i + k) : i + k
          p.push(world(pos.getElement(j, a)))
          if (uv) t.push([...uv.getElement(j, e)])
        }
        const su = t.length === 3 ? (t[0]![0]! + t[1]![0]! + t[2]![0]!) / 3 : 0
        const sv = t.length === 3 ? (t[0]![1]! + t[1]![1]! + t[2]![1]!) / 3 : 0
        const c = cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!))
        const len = Math.hypot(c[0]!, c[1]!, c[2]!)
        if (len < 1e-9) continue
        const n = c.map((x) => x / len)
        out.push({ p, n, d: dot(n, p[0]!), node: node.getName(), color: png && uv ? hex(png, su, sv) : null, uv: t.length === 3 ? t : null, png })
      }
    }
  }
  return out
}

/** Area of the intersection of two convex 2D polygons (Sutherland–Hodgman). */
function overlapArea(subject: number[][], clip: number[][]): { area: number; centre: number[]; poly: number[][] } {
  const orient = (poly: number[][]) => {
    let s = 0
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]!
      const b = poly[(i + 1) % poly.length]!
      s += a[0]! * b[1]! - b[0]! * a[1]!
    }
    return s >= 0 ? poly : [...poly].reverse()
  }
  let out = orient(subject)
  const c = orient(clip)
  for (let i = 0; i < c.length && out.length > 0; i += 1) {
    const a = c[i]!
    const b = c[(i + 1) % c.length]!
    const inside = (p: number[]) => (b[0]! - a[0]!) * (p[1]! - a[1]!) - (b[1]! - a[1]!) * (p[0]! - a[0]!) >= -1e-9
    const cut = (p: number[], q: number[]) => {
      const dx1 = q[0]! - p[0]!, dy1 = q[1]! - p[1]!
      const dx2 = b[0]! - a[0]!, dy2 = b[1]! - a[1]!
      const den = dx1 * dy2 - dy1 * dx2
      const t = den === 0 ? 0 : ((a[0]! - p[0]!) * dy2 - (a[1]! - p[1]!) * dx2) / den
      return [p[0]! + t * dx1, p[1]! + t * dy1]
    }
    const input = out
    out = []
    for (let k = 0; k < input.length; k += 1) {
      const p = input[k]!
      const q = input[(k + 1) % input.length]!
      if (inside(q)) {
        if (!inside(p)) out.push(cut(p, q))
        out.push(q)
      } else if (inside(p)) out.push(cut(p, q))
    }
  }
  if (out.length < 3) return { area: 0, centre: [0, 0], poly: [] }
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < out.length; i += 1) {
    const a = out[i]!
    const b = out[(i + 1) % out.length]!
    const w = a[0]! * b[1]! - b[0]! * a[1]!
    area += w
    cx += (a[0]! + b[0]!) * w
    cy += (a[1]! + b[1]!) * w
  }
  if (Math.abs(area) < 1e-12) return { area: 0, centre: [0, 0], poly: [] }
  return { area: Math.abs(area) / 2, centre: [cx / (3 * area), cy / (3 * area)], poly: out }
}

/** Atlas colour of a triangle at a 2D point of its plane (barycentric UV). */
function colourAt(pts: number[][], tri: Tri, q: number[]): number[] | null {
  if (!tri.uv || !tri.png) return null
  const [a, b, c] = pts as [number[], number[], number[]]
  const den = (b[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[1]! - c[1]!)
  if (Math.abs(den) < 1e-12) return null
  const w0 = ((b[1]! - c[1]!) * (q[0]! - c[0]!) + (c[0]! - b[0]!) * (q[1]! - c[1]!)) / den
  const w1 = ((c[1]! - a[1]!) * (q[0]! - c[0]!) + (a[0]! - c[0]!) * (q[1]! - c[1]!)) / den
  const w2 = 1 - w0 - w1
  const [ta, tb, tc] = tri.uv as [number[], number[], number[]]
  return texel(tri.png, w0 * ta[0]! + w1 * tb[0]! + w2 * tc[0]!, w0 * ta[1]! + w1 * tb[1]! + w2 * tc[1]!)
}

/** Ray/triangle hit distance (Möller–Trumbore), or -1. */
function hit(o: number[], d: number[], t: Tri): number {
  const [a, b, c] = t.p as [number[], number[], number[]]
  const e1 = sub(b, a)
  const e2 = sub(c, a)
  const pv = cross(d, e2)
  const det = dot(e1, pv)
  if (Math.abs(det) < 1e-12) return -1
  const tv = sub(o, a)
  const u = dot(tv, pv) / det
  if (u < 0 || u > 1) return -1
  const qv = cross(tv, e1)
  const v = dot(d, qv) / det
  if (v < 0 || u + v > 1) return -1
  const dist = dot(e2, qv) / det
  return dist > 1e-9 ? dist : -1
}

/** A skew direction, so rays do not run along the voxel axes or faces. */
const RAY = (() => {
  const v = [0.539, 0.7196, 0.4379]
  const l = Math.hypot(...v)
  return v.map((x) => x / l)
})()

/** True when a point lies inside a closed solid of any node (odd ray crossings with that node's surface). */
function buried(point: number[], byNode: Map<string, Tri[]>): boolean {
  for (const list of byNode.values()) {
    let crossings = 0
    for (const t of list) if (hit(point, RAY, t) > 0) crossings += 1
    if (crossings % 2 === 1) return true
  }
  return false
}

/**
 * Every pair of overlapping coplanar triangles. `unit` is the model's voxel
 * size (1 for world assets, 0.01 for avatar space): planes closer than
 * 0.02 unit count as one plane, and overlaps under 0.01 unit² (touching
 * edges, rounding) are ignored.
 */
export function coplanarOverlaps(
  doc: Document,
  unit: number,
  options: {
    /** Only a node overlapping itself counts (avatar part files: parts of one slot overlap by design). */
    sameNodeOnly?: boolean
  } = {},
): Overlap[] {
  return sweep(triangles(doc), unit, { sameNodeOnly: options.sameNodeOnly, tolerance: 0.02 })
}

/**
 * Coplanar overlaps between nodes of several files placed in one space (all
 * at rest; skinned meshes in bind space), for parts that are worn together:
 * avatar parts of every pack on the Pirate Nation bodies. Only pairs with a
 * `subject` node (the parts under test) are checked, and only those `pair`
 * accepts (parts that can be seen together). `tolerance` (voxels) is how
 * close two planes must be to fight. No ground or buried-point exemption:
 * which parts cover a spot depends on the outfit. Triangles are indexed by
 * plane and by a 2D grid, so thousands of parts on one body stay fast.
 */
export function coplanarOverlapsAcross(
  docs: Document[],
  unit: number,
  options: { tolerance: number; subject: (node: string) => boolean; pair: (a: string, b: string) => boolean },
): Overlap[] {
  const tolerance = options.tolerance * unit
  const minArea = 0.01 * unit * unit
  const cell = 8 * unit
  interface Entry { id: number; tri: Tri; sign: number; d: number; pts: number[][]; box: number[]; n: number[]; U: number[]; V: number[]; subject: boolean }
  const planes = new Map<string, Map<string, Entry[]>>()
  const subjects: Entry[] = []
  const basis = new Map<string, { n: number[]; U: number[]; V: number[] }>()
  let id = 0
  for (const doc of docs) {
    for (const tri of triangles(doc)) {
      const first = tri.n.find((x) => Math.abs(x) > 1e-6)!
      const sign = first > 0 ? 1 : -1
      const nc = tri.n.map((x) => x * sign)
      const nk = nc.map((x) => Math.round(x * 1000)).join(',')
      let frame = basis.get(nk)
      if (!frame) {
        const helper = Math.abs(nc[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0]
        const u = cross(nc, helper)
        const ul = Math.hypot(u[0]!, u[1]!, u[2]!)
        const U = u.map((x) => x / ul)
        frame = { n: nc, U, V: cross(nc, U) }
        basis.set(nk, frame)
      }
      const pts = tri.p.map((q) => [dot(q, frame!.U), dot(q, frame!.V)])
      const xs = pts.map((q) => q[0]!)
      const ys = pts.map((q) => q[1]!)
      const d = tri.d * sign
      const entry: Entry = { id: id++, tri, sign, d, pts, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], ...frame, subject: options.subject(tri.node) }
      const planeKey = `${nk}|${Math.floor(d / tolerance)}`
      let grid = planes.get(planeKey)
      if (!grid) planes.set(planeKey, (grid = new Map()))
      for (let gx = Math.floor(entry.box[0]! / cell); gx <= Math.floor(entry.box[2]! / cell); gx += 1) {
        for (let gy = Math.floor(entry.box[1]! / cell); gy <= Math.floor(entry.box[3]! / cell); gy += 1) {
          const key = `${gx},${gy}`
          const list = grid.get(key)
          if (list) list.push(entry)
          else grid.set(key, [entry])
        }
      }
      if (entry.subject) subjects.push(entry)
    }
  }
  const found: Overlap[] = []
  for (const a of subjects) {
    const nk = a.n.map((x) => Math.round(x * 1000)).join(',')
    const seen = new Set<number>()
    const k = Math.floor(a.d / tolerance)
    for (let dk = -1; dk <= 1; dk += 1) {
      const grid = planes.get(`${nk}|${k + dk}`)
      if (!grid) continue
      for (let gx = Math.floor(a.box[0]! / cell); gx <= Math.floor(a.box[2]! / cell); gx += 1) {
        for (let gy = Math.floor(a.box[1]! / cell); gy <= Math.floor(a.box[3]! / cell); gy += 1) {
          for (const b of grid.get(`${gx},${gy}`) ?? []) {
            // Each pair once: a subject meets another subject only from the lower id.
            if (b.id === a.id || seen.has(b.id) || (b.subject && b.id < a.id)) continue
            seen.add(b.id)
            if (Math.abs(b.d - a.d) > tolerance || a.tri.node === b.tri.node || !options.pair(a.tri.node, b.tri.node)) continue
            if (b.box[0]! >= a.box[2]! || a.box[0]! >= b.box[2]! || b.box[1]! >= a.box[3]! || a.box[1]! >= b.box[3]!) continue
            const overlap = overlapArea(a.pts, b.pts)
            if (overlap.area < minArea) continue
            const samples = [overlap.centre, ...overlap.poly.map((v) => [0.7 * v[0]! + 0.3 * overlap.centre[0]!, 0.7 * v[1]! + 0.3 * overlap.centre[1]!])]
            let differ = 0
            for (const q of samples) {
              const ca = colourAt(a.pts, a.tri, q)
              const cb = colourAt(b.pts, b.tri, q)
              if (!(ca && cb && !ca.some((x, i) => Math.abs(x - cb[i]!) > 12))) differ += 1
            }
            found.push({
              facing: a.sign === b.sign ? 'same' : 'opposite',
              area: overlap.area,
              nodes: [a.tri.node, b.tri.node],
              at: [0, 1, 2].map((r) => a.U[r]! * overlap.centre[0]! + a.V[r]! * overlap.centre[1]! + a.n[r]! * a.d) as [number, number, number],
              normal: a.tri.n as [number, number, number],
              colors: [a.tri.color, b.tri.color],
              mismatch: differ / samples.length,
            })
          }
        }
      }
    }
  }
  return found
}

function sweep(
  tris: Tri[],
  unit: number,
  options: { sameNodeOnly?: boolean; tolerance: number },
): Overlap[] {
  const tolerance = options.tolerance * unit
  const minArea = 0.01 * unit * unit
  // Down-facing faces on the model's lowest plane sit on the ground: never seen.
  let floor = Infinity
  for (const t of tris) for (const p of t.p) floor = Math.min(floor, p[1]!)
  const onFloor = (t: Tri) => t.n[1]! < -0.999 && Math.abs(t.p[0]![1]! - floor) <= tolerance
  const byNode = new Map<string, Tri[]>()
  for (const t of tris) {
    const list = byNode.get(t.node)
    if (list) list.push(t)
    else byNode.set(t.node, [t])
  }
  // Group by the unsigned normal direction (rounded), then sweep by plane offset.
  const groups = new Map<string, { tri: Tri; sign: number; d: number }[]>()
  for (const tri of tris) {
    const first = tri.n.find((x) => Math.abs(x) > 1e-6)!
    const sign = first > 0 ? 1 : -1
    const nc = tri.n.map((x) => x * sign)
    const key = nc.map((x) => Math.round(x * 1000)).join(',') + (options.sameNodeOnly ? `@${tri.node}` : '')
    const list = groups.get(key) ?? []
    list.push({ tri, sign, d: tri.d * sign })
    groups.set(key, list)
  }
  const found: Overlap[] = []
  for (const list of groups.values()) {
    if (list.length < 2) continue
    list.sort((x, y) => x.d - y.d)
    const n = list[0]!.tri.n.map((x) => x * list[0]!.sign)
    // An orthonormal basis of the plane, for 2D overlap tests.
    const helper = Math.abs(n[0]!) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const u = cross(n, helper)
    const ul = Math.hypot(u[0]!, u[1]!, u[2]!)
    const U = u.map((x) => x / ul)
    const V = cross(n, U)
    const flat = list.map((entry) => {
      const pts = entry.tri.p.map((p) => [dot(p, U), dot(p, V)])
      const xs = pts.map((p) => p[0]!)
      const ys = pts.map((p) => p[1]!)
      return { ...entry, pts, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
    })
    for (let i = 0; i < flat.length; i += 1) {
      const a = flat[i]!
      for (let j = i + 1; j < flat.length && flat[j]!.d - a.d <= tolerance; j += 1) {
        const b = flat[j]!
        if (options.sameNodeOnly && a.tri.node !== b.tri.node) continue
        if (onFloor(a.tri) && onFloor(b.tri)) continue
        if (b.box[0]! >= a.box[2]! || a.box[0]! >= b.box[2]! || b.box[1]! >= a.box[3]! || a.box[1]! >= b.box[3]!) continue
        const overlap = overlapArea(a.pts, b.pts)
        if (overlap.area < minArea) continue
        const at = [0, 1, 2].map((r) => U[r]! * overlap.centre[0]! + V[r]! * overlap.centre[1]! + n[r]! * a.d) as [number, number, number]
        // Sample the centre and each corner pulled 30% in. A point shows the
        // fight when the colours step by more than 12 in a channel and the
        // point, just in front of the faces, is not inside another solid.
        const samples = [overlap.centre, ...overlap.poly.map((v) => [0.7 * v[0]! + 0.3 * overlap.centre[0]!, 0.7 * v[1]! + 0.3 * overlap.centre[1]!])]
        const front = a.tri.n.map((x) => x * 0.05 * unit)
        let differ = 0
        for (const q of samples) {
          const ca = colourAt(a.pts, a.tri, q)
          const cb = colourAt(b.pts, b.tri, q)
          if (ca && cb && !ca.some((x, k) => Math.abs(x - cb[k]!) > 12)) continue
          const world = [0, 1, 2].map((r) => U[r]! * q[0]! + V[r]! * q[1]! + n[r]! * a.d + front[r]!)
          if (a.sign === b.sign && buried(world, byNode)) continue
          differ += 1
        }
        found.push({
          facing: a.sign === b.sign ? 'same' : 'opposite',
          area: overlap.area,
          nodes: [a.tri.node, b.tri.node],
          at,
          normal: a.tri.n as [number, number, number],
          colors: [a.tri.color, b.tri.color],
          mismatch: differ / samples.length,
        })
      }
    }
  }
  return found
}

/**
 * Whether a point (model units, rest pose) lies inside a closed solid of the
 * model, and if so how far it is to the surface along `dir` (model units).
 */
export function insideSolid(doc: Document, point: number[], dir: number[]): { inside: boolean; exit: number } {
  const tris = triangles(doc)
  const byNode = new Map<string, Tri[]>()
  for (const t of tris) {
    const list = byNode.get(t.node)
    if (list) list.push(t)
    else byNode.set(t.node, [t])
  }
  if (!buried(point, byNode)) return { inside: false, exit: 0 }
  const l = Math.hypot(dir[0]!, dir[1]!, dir[2]!) || 1
  const d = dir.map((x) => x / l)
  let exit = Infinity
  for (const t of tris) {
    const h = hit(point, d, t)
    if (h > 0) exit = Math.min(exit, h)
  }
  return { inside: true, exit }
}

/**
 * Avatar part layers: each face of a part node must sit its slot's layer
 * (`layerOf(node)`, voxels) out from a voxel grid plane, along its normal, so
 * parts that cover one another never share a plane. A face left on the grid
 * is fine only when a back-to-back face of the same node shares its plane
 * (two bone blocks of one part touching inside it: never seen). Returns the
 * misplaced area per node, in voxel².
 */
export function layerMisfits(doc: Document, unit: number, layerOf: (node: string) => number): Map<string, { area: number; offset: number }> {
  const tris = triangles(doc)
  const planes = new Set(tris.map((t) => `${t.node}|${t.n.map((x) => Math.round(x)).join(',')}|${Math.round((t.d / unit) * 1e4)}`))
  const out = new Map<string, { area: number; offset: number }>()
  for (const t of tris) {
    const steps = t.d / unit
    const offset = steps - Math.round(steps)
    const layer = layerOf(t.node)
    if (Math.abs(offset - layer) < 1e-3) continue
    const twin = `${t.node}|${t.n.map((x) => -Math.round(x) || 0).join(',')}|${Math.round((-t.d / unit) * 1e4)}`
    if (Math.abs(offset) < 1e-3 && planes.has(twin)) continue
    const c = cross(sub(t.p[1]!, t.p[0]!), sub(t.p[2]!, t.p[0]!))
    const area = Math.hypot(c[0]!, c[1]!, c[2]!) / 2 / unit / unit
    const entry = out.get(t.node) ?? { area: 0, offset }
    entry.area += area
    out.set(t.node, entry)
  }
  return out
}
