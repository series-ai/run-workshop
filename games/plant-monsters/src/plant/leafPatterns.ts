import * as THREE from 'three'
import { bladeAxes } from './stalk'
import { assembleSpec, paintVariegation, profileColor, randomSpec, type ProfileName } from './pothosVariegation'

/**
 * Leaf pattern layer. Base leaves are plain (a kit gradient, lighter toward the tip); patterns are drawn on top as a
 * separate overlay in leaf space, so any pattern can go on any leaf (ours or the kit's):
 *
 *   leaf-space UV (uv1):  u = 0 left edge, 0.5 midrib, 1 right edge (relative to the local width)
 *                         v = 0 base, 1 tip
 *
 * Patterns are flat, two-colour designs: the leaf's own colour plus ONE solid pattern colour with crisp edges (no blur,
 * no alpha ramps), modelled on the real cultivar of each leaf type:
 *
 *   golden      Golden pothos (Epipremnum aureum): long yellow streaks running out from the midrib toward the tip
 *   orbifolia   Calathea orbifolia (Goeppertia orbifolia): broad pale chevron bands from midrib to edge
 *   polly       Alocasia x amazonica 'Polly': thick white midrib and veins, white rim
 *   trifasciata Snake plant (Dracaena trifasciata): crisp zigzag cross-bands
 *   masoniana   Whale fin (Dracaena masoniana): scattered pale spots
 *   rings       Cylindrical snake plant (Dracaena angolensis): dark rings around the leaf
 *   vittatum    Spider plant 'Vittatum' (Chlorophytum comosum): wide cream centre stripe
 *   flecks      Young aloe vera: sparse white flecks
 *
 * Plain leaf types (monstera, ZZ, peace lily, bird of paradise, echeveria, fern) get no pattern.
 */

/** `pothos:<seed>` = a procedural two-halves pothos variegation (see pothosVariegation.ts). */
export type PatternName = `pothos:${number}` | `var:${ProfileName}:${number}` | `var:${ProfileName}:${number}:${number}` | 'njoy' | 'pearls' | 'marble' | 'golden' | 'orbifolia' | 'polly' | 'trifasciata' | 'masoniana' | 'rings' | 'vittatum' | 'flecks' | 'laurentii'

/** Pattern colour for each design (the second of the two colours). */
export const PATTERN_COLOR: Record<PatternName, string> = {
  njoy: '#f3efd6',
  pearls: '#f0ecd0',
  marble: '#f1edd2',
  golden: '#ead46b',
  orbifolia: '#cfe2b2',
  polly: '#eef4e4',
  trifasciata: '#3e6b47', // dark zigzags on the pale kit leaf, like the photo
  masoniana: '#5f9a6c',
  rings: '#5b8a4f',
  vittatum: '#f2edc8',
  flecks: '#e6efe2',
  laurentii: '#e4d35e',
}

type Painter = (ctx: CanvasRenderingContext2D, W: number, H: number) => void

/** Leaf space -> canvas: a in [-1, 1] across (0 = midrib), s in [0, 1] base -> tip. */
const X = (W: number, a: number) => W * (0.5 + 0.5 * a)
const Y = (H: number, s: number) => H * (1 - s)

/** Deterministic random for stable patterns. */
function rng(seed: number) {
  let x = seed
  return () => ((x = (x * 16807) % 2147483647) / 2147483647)
}

/** A filled band from the midrib out to the edge, following a curve that rises toward the tip. */
function band(ctx: CanvasRenderingContext2D, W: number, H: number, side: number, s0: number, rise: number, w0: number, w1: number, reach = 1) {
  const N = 16
  const upper: [number, number][] = []
  const lower: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const a = side * t * reach
    const sc = s0 + rise * Math.pow(t, 1.3)
    const w = w0 + (w1 - w0) * t
    upper.push([X(W, a), Y(H, sc + w / 2)])
    lower.push([X(W, a), Y(H, sc - w / 2)])
  }
  ctx.beginPath()
  ctx.moveTo(...upper[0])
  upper.forEach((p) => ctx.lineTo(...p))
  lower.reverse().forEach((p) => ctx.lineTo(...p))
  ctx.closePath()
  ctx.fill()
}

/** A tapered stripe along the midrib from s0 to s1 with half-widths (in a units) h0 -> h1. */
function midStripe(ctx: CanvasRenderingContext2D, W: number, H: number, s0: number, s1: number, h0: number, h1: number) {
  const N = 20
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const h = (h0 + (h1 - h0) * t) * Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.05)) * 3)
    const p: [number, number] = [X(W, h), Y(H, s0 + (s1 - s0) * t)]
    if (i === 0) ctx.moveTo(...p)
    else ctx.lineTo(...p)
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N
    const h = (h0 + (h1 - h0) * t) * Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.05)) * 3)
    ctx.lineTo(X(W, -h), Y(H, s0 + (s1 - s0) * t))
  }
  ctx.closePath()
  ctx.fill()
}

/** Cream from one leaf edge inward between s0..s1, reaching `depth` of the half-width, with a lumpy inner edge. */
function edgeCream(ctx: CanvasRenderingContext2D, W: number, H: number, side: number, s0: number, s1: number, depth: number, r: () => number) {
  ctx.save()
  ctx.beginPath()
  if (side > 0) ctx.rect(W / 2, 0, W / 2, H)
  else ctx.rect(0, 0, W / 2, H)
  ctx.clip()
  const N = 14
  for (let i = 0; i <= N; i++) {
    const sv = s0 + (s1 - s0) * (i / N)
    const taper = Math.sin(Math.PI * (i / N)) // fuller in the middle of the run
    const reach = depth * (0.5 + 0.5 * taper) * (0.8 + 0.4 * r())
    // a fat circle centred beyond the edge so its inner rim sits at (1 - reach)
    const R = W * 0.5 * (0.2 + 0.25 * r())
    blob(ctx, X(W, side * (1 - reach)) + side * R, Y(H, sv), R * 1.05)
    blob(ctx, X(W, side * 1.0), Y(H, sv), W * 0.5 * reach)
  }
  ctx.restore()
}

/** A round daub. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rad: number) {
  ctx.beginPath()
  ctx.arc(x, y, rad, 0, Math.PI * 2)
  ctx.fill()
}

/** A half-moon patch against the midrib on one side, with a lumpy outer edge (overlapping circles, clipped). */
function halfMoon(ctx: CanvasRenderingContext2D, W: number, H: number, side: number, s: number, size: number) {
  ctx.save()
  ctx.beginPath()
  if (side > 0) ctx.rect(W / 2, 0, W / 2, H)
  else ctx.rect(0, 0, W / 2, H)
  ctx.clip()
  const cx = W / 2
  const cy = Y(H, s)
  const R = W * 0.5 * size * 2
  blob(ctx, cx, cy, R)
  // lumps around the rim
  for (let k = 0; k < 7; k++) {
    const t = (k / 6) * Math.PI - Math.PI / 2
    blob(ctx, cx + side * Math.cos(t) * R * 0.95, cy + Math.sin(t) * R * 0.95, R * (0.22 + 0.1 * ((k * 37) % 3)))
  }
  ctx.restore()
}

/** Scattered round daubs of mixed sizes (radius as a fraction of W). */
function daubs(ctx: CanvasRenderingContext2D, W: number, H: number, r: () => number, n: number, rmin: number, rmax: number) {
  for (let i = 0; i < n; i++) blob(ctx, X(W, (r() * 2 - 1) * 0.9), Y(H, 0.06 + r() * 0.88), W * (rmin + r() * (rmax - rmin)))
}

const PAINTERS: Record<PatternName, Painter> = {
  // Illustrative pothos variegation, built from round daubs. Half-circles clipped at the midrib give the
  // "hemispheric" patches of N'Joy / Pearls and Jade; loose dots give the speckle.
  njoy: (ctx, W, H) => {
    // N'Joy: one half of the leaf goes cream from the edge inward, its inner edge lumpy; a few daubs elsewhere
    const r = rng(41)
    edgeCream(ctx, W, H, 1, 0.05, 0.98, 0.95, r)
    edgeCream(ctx, W, H, -1, 0.55, 0.98, 0.7, r)
    daubs(ctx, W, H, r, 8, 0.015, 0.035)
  },
  pearls: (ctx, W, H) => {
    // Pearls and Jade: cream everywhere except a lobed green 'tree' along the midrib, plus cream flecks on it
    const r = rng(17)
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 26; i++) {
      const sv = 0.04 + (i / 26) * 0.86
      const spread = 0.35 + 0.35 * Math.sin(Math.PI * sv)
      blob(ctx, X(W, (r() * 2 - 1) * spread * 0.6), Y(H, sv), W * (0.1 + r() * 0.12) * (0.6 + 0.6 * Math.sin(Math.PI * sv)))
    }
    ctx.globalCompositeOperation = 'source-over'
    daubs(ctx, W, H, r, 10, 0.012, 0.028)
  },
  marble: (ctx, W, H) => {
    // Marble Queen: crowds of small daubs and dashes in clusters, one cream half-edge
    const r = rng(29)
    edgeCream(ctx, W, H, -1, 0.25, 0.85, 0.75, r)
    for (let c = 0; c < 10; c++) {
      const ca = (r() * 2 - 1) * 0.7
      const cs = 0.1 + r() * 0.8
      for (let i = 0; i < 9; i++) blob(ctx, X(W, ca + (r() - 0.5) * 0.35), Y(H, cs + (r() - 0.5) * 0.12), W * (0.012 + r() * 0.03))
    }
  },
  golden: (ctx, W, H) => {
    // Golden pothos: soft gold daubs clustered in a couple of patches
    const r = rng(23)
    edgeCream(ctx, W, H, 1, 0.3, 0.8, 0.6, r)
    daubs(ctx, W, H, r, 14, 0.02, 0.05)
  },
  orbifolia: (ctx, W, H) => {
    // pale chevrons angling up and out from a pale midrib; stripes narrower than the green between them
    const n = 8
    const step = 0.84 / n
    for (let k = 0; k < n; k++) {
      const s0 = 0.08 + step * k
      for (const side of [1, -1]) band(ctx, W, H, side, s0, 0.2, step * 0.5, step * 0.32, 0.9)
    }
    midStripe(ctx, W, H, -0.02, 0.97, 0.035, 0.015)
  },
  polly: (ctx, W, H) => {
    midStripe(ctx, W, H, -0.02, 0.97, 0.09, 0.025) // thick white midrib
    for (let k = 0; k < 5; k++) for (const side of [1, -1]) band(ctx, W, H, side, 0.28 + 0.13 * k, 0.1, 0.03, 0.012, 0.9)
  },
  laurentii: (ctx, W, H) => {
    // Sansevieria 'Laurentii': a golden margin down both edges, slightly wavy on the inside, narrowing at the tip
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(X(W, side * 1.05), Y(H, -0.02))
      for (let i = 0; i <= 40; i++) {
        const s = i / 40
        const w = (0.2 + 0.03 * Math.sin(s * 37)) * (s > 0.85 ? Math.max(0.3, 1 - (s - 0.85) * 4) : 1)
        ctx.lineTo(X(W, side * (1 - w)), Y(H, s))
      }
      ctx.lineTo(X(W, side * 1.05), Y(H, 1.02))
      ctx.closePath()
      ctx.fill()
    }
  },
  trifasciata: (ctx, W, H) => {
    // bold, slightly irregular zigzag cross-bands (pale bands dominate, like the real leaf)
    const r = rng(9)
    const n = 8
    for (let k = 0; k < n; k++) {
      const s = 0.05 + (0.92 * k) / n
      const h = 0.022 + r() * 0.01
      const teeth = 3 + Math.floor(r() * 2)
      const tilt = (r() - 0.5) * 0.03
      const amp = 0.03 + r() * 0.012
      ctx.beginPath()
      for (let i = 0; i <= teeth * 2; i++) {
        const a = -1.02 + (2.04 * i) / (teeth * 2)
        ctx.lineTo(X(W, a), Y(H, s + h + tilt * a + (i % 2 ? amp : -amp * 0.4)))
      }
      for (let i = teeth * 2; i >= 0; i--) {
        const a = -1.02 + (2.04 * i) / (teeth * 2)
        ctx.lineTo(X(W, a), Y(H, s - h + tilt * a + (i % 2 ? amp : -amp * 0.4)))
      }
      ctx.closePath()
      ctx.fill()
    }
  },
  masoniana: (ctx, W, H) => {
    // fine, dense pale-green mottling
    const r = rng(5)
    for (let i = 0; i < 45; i++) {
      const a = (r() * 2 - 1) * 0.95
      const s = 0.03 + r() * 0.92
      const rad = W * (0.025 + r() * 0.035)
      ctx.beginPath()
      ctx.ellipse(X(W, a), Y(H, s), rad, rad * (1.3 + r()), r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  rings: (ctx, W, H) => {
    for (let k = 0; k < 9; k++) ctx.fillRect(0, Y(H, 0.08 + k * 0.1) - H * 0.007, W, H * 0.014)
  },
  vittatum: (ctx, W, H) => {
    midStripe(ctx, W, H, 0.0, 0.98, 0.34, 0.14)
  },
  flecks: (ctx, W, H) => {
    const r = rng(3)
    for (let i = 0; i < 26; i++) {
      ctx.beginPath()
      ctx.ellipse(X(W, (r() * 2 - 1) * 0.75), Y(H, 0.08 + r() * 0.8), W * 0.018, H * 0.012, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  },
}

const textures = new Map<PatternName, THREE.Texture>()

export function patternTexture(name: PatternName): THREE.Texture {
  const hit = textures.get(name)
  if (hit) return hit
  const W = 256
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.filter = 'none'
  if (name.startsWith('pothos:')) {
    paintVariegation(ctx, W, H, randomSpec(Number(name.slice(7))), [243, 239, 214])
  } else if (name.startsWith('var:')) {
    // var:<profile>:<n>[:<scale>] (scale > 1 on small leaves keeps freckles a readable size)
    const [, prof, n, sc] = name.split(':') as [string, ProfileName, string, string?]
    paintVariegation(ctx, W, H, assembleSpec(prof, Number(n), sc ? Number(sc) : 1), profileColor(prof))
  } else {
    const fixed = name as Exclude<PatternName, `pothos:${number}` | `var:${string}`>
    ctx.fillStyle = PATTERN_COLOR[fixed] // one solid pattern colour, fully opaque
    PAINTERS[fixed](ctx, W, H)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.channel = 1 // read the leaf-space UVs
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  textures.set(name, tex)
  return tex
}

const materials = new Map<string, THREE.Material>()

function patternMaterial(name: PatternName, bothFaces = false): THREE.Material {
  const hit = materials.get(`${name}|${bothFaces}`)
  if (hit) return hit
  const m = new THREE.MeshStandardMaterial({
    map: patternTexture(name),
    alphaTest: 0.5, // crisp two-colour edges
    emissive: new THREE.Color(0xffffff),
    emissiveMap: patternTexture(name), // a little self-light so pale patches stay pale in shade, like painted colour
    emissiveIntensity: 0.18,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    roughness: 0.9,
    side: bothFaces ? THREE.DoubleSide : THREE.FrontSide,
  })
  materials.set(`${name}|${bothFaces}`, m)
  return m
}

/**
 * Give every mesh in a blade leaf-space UVs (uv1), measured from the blade's own midrib and width.
 * Geometries are cloned so the source blade is left untouched. Returns the blade (modified copy).
 */
/** Midrib for pattern mapping: from the stalk end of the leaf to its tip (the point far from both the centre and the
 *  attach point). More robust than "farthest from the attach point" for hearts, where a basal lobe can win. */
function patternMidrib(blade: THREE.Object3D, normal: THREE.Vector3): THREE.Vector3 {
  blade.updateMatrixWorld(true)
  const inv = blade.matrixWorld.clone().invert()
  const pts: THREE.Vector3[] = []
  blade.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    const m = inv.clone().multiply(mesh.matrixWorld)
    for (let i = 0; i < pos.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m))
  })
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length)
  const tip = pts.reduce((best, p) => (p.distanceTo(c) + 0.6 * p.length() > best.distanceTo(c) + 0.6 * best.length() ? p : best))
  const base = pts.reduce((best, p) => (p.lengthSq() < best.lengthSq() ? p : best))
  const d = tip.clone().sub(base)
  return d.addScaledVector(normal, -d.dot(normal)).normalize()
}

/**
 * contour: u follows each slice's own edges (pattern edges meet the leaf edge) - for our dense pillow leaves.
 * planar:  a flat projection across a fitted midrib line - linear, so it stays clean on coarse kit meshes.
 */
export type LeafMapping = 'contour' | 'planar'

export function addLeafSpaceUV(blade: THREE.Object3D, mapping: LeafMapping = 'contour'): THREE.Object3D {
  const { normal } = bladeAxes(blade)
  const midrib = patternMidrib(blade, normal)
  const across = new THREE.Vector3().crossVectors(normal, midrib).normalize()
  const copy = blade.clone()
  copy.updateMatrixWorld(true)
  const inv = copy.matrixWorld.clone().invert()
  const meshes: THREE.Mesh[] = []
  copy.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  // leaf length and local half-width by bins along the midrib
  const BINS = 24
  let L = 1e-6
  let s0 = Infinity
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position')
    const m = inv.clone().multiply(mesh.matrixWorld)
    for (let i = 0; i < pos.count; i++) s0 = Math.min(s0, new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m).dot(midrib))
  }
  const pts = meshes.map((mesh) => {
    mesh.geometry = mesh.geometry.clone()
    const pos = mesh.geometry.getAttribute('position')
    const m = inv.clone().multiply(mesh.matrixWorld)
    const out: { s: number; x: number }[] = []
    for (let i = 0; i < pos.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m)
      const s = p.dot(midrib) - s0
      L = Math.max(L, s)
      out.push({ s, x: p.dot(across) })
    }
    return out
  })
  // per slice along the leaf: the span from its left edge to its right edge (centred, so lopsided leaves still work)
  const lo = new Array(BINS).fill(Infinity)
  const hi = new Array(BINS).fill(-Infinity)
  const bin = (s: number) => Math.min(BINS - 1, Math.max(0, Math.floor((s / L) * BINS)))
  for (const list of pts)
    for (const p of list) {
      const b = bin(p.s)
      lo[b] = Math.min(lo[b], p.x)
      hi[b] = Math.max(hi[b], p.x)
    }
  // fill empty slices from neighbours
  for (let b = 0; b < BINS; b++)
    if (!isFinite(lo[b])) {
      const n = [b - 1, b + 1].find((k) => k >= 0 && k < BINS && isFinite(lo[k]))
      if (n !== undefined) ((lo[b] = lo[n]), (hi[b] = hi[n]))
      else ((lo[b] = -1), (hi[b] = 1))
    }
  // contour: symmetric half-width per slice (our leaves are symmetric), smoothly interpolated between slices
  let centre = (_b: number) => 0
  let half = lo.map((l, b) => Math.max(1e-6, Math.abs(l), Math.abs(hi[b])))
  const halfAt = (s: number) => {
    const f = THREE.MathUtils.clamp((s / L) * BINS - 0.5, 0, BINS - 1)
    const i = Math.min(BINS - 2, Math.floor(f))
    return THREE.MathUtils.lerp(half[i], half[i + 1], f - i)
  }
  if (mapping === 'planar') {
    // fit the midrib line c(s) = c0 + c1 s through the slice centres (weighted by width), one global half-width
    let sw = 0, ss = 0, sc = 0, sss = 0, ssc = 0
    for (let b = 0; b < BINS; b++) {
      const w = hi[b] - lo[b]
      const sb = (b + 0.5) / BINS
      const cb = (lo[b] + hi[b]) / 2
      sw += w; ss += w * sb; sc += w * cb; sss += w * sb * sb; ssc += w * sb * cb
    }
    const det = sw * sss - ss * ss || 1e-9
    const c1 = (sw * ssc - ss * sc) / det
    const c0 = (sc - c1 * ss) / sw
    let hmax = 1e-6
    for (let b = 0; b < BINS; b++) {
      const cb = c0 + c1 * ((b + 0.5) / BINS)
      hmax = Math.max(hmax, Math.abs(hi[b] - cb), Math.abs(lo[b] - cb))
    }
    centre = () => 0
    half = half.map(() => hmax)
    for (const list of pts) for (const p of list) p.x -= c0 + c1 * THREE.MathUtils.clamp(p.s / L, 0, 1)
  }
  meshes.forEach((mesh, k) => {
    const uv1 = new Float32Array(pts[k].length * 2)
    pts[k].forEach((p, i) => {
      const s = THREE.MathUtils.clamp(p.s / L, 0, 1)
      const b = bin(p.s)
      const a = THREE.MathUtils.clamp((p.x - centre(b)) / (mapping === 'planar' ? half[b] : halfAt(p.s)), -1, 1)
      uv1[i * 2] = 0.5 + 0.5 * a
      uv1[i * 2 + 1] = s
    })
    mesh.geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2))
  })
  return copy
}

/** Same attributes, but only the triangles facing the blade's upper side (patterns sit on the top face only). */
function topFaceOnly(mesh: THREE.Mesh, up: THREE.Vector3, root: THREE.Object3D): THREE.BufferGeometry {
  const g = mesh.geometry
  const pos = g.getAttribute('position')
  root.updateMatrixWorld(true)
  const m = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld)
  const nm = new THREE.Matrix3().getNormalMatrix(m)
  const src = g.index ? Array.from(g.index.array) : Array.from({ length: pos.count }, (_, i) => i)
  const keep: number[] = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < src.length; i += 3) {
    a.fromBufferAttribute(pos, src[i])
    b.fromBufferAttribute(pos, src[i + 1])
    c.fromBufferAttribute(pos, src[i + 2])
    const n = b.clone().sub(a).cross(c.clone().sub(a)).applyMatrix3(nm).normalize()
    if (n.dot(up) > -0.3) keep.push(src[i], src[i + 1], src[i + 2]) // folded leaves tilt each half; backs face ~-1
  }
  const out = new THREE.BufferGeometry()
  for (const [k, v] of Object.entries(g.attributes)) out.setAttribute(k, v)
  out.setIndex(keep)
  return out
}

const patterned = new Map<string, THREE.Object3D>()

/** The blade plus a pattern overlay layer (cached per blade + pattern). */
/** `bothFaces` puts the pattern on the underside too (default: only for variegation, which runs through the leaf). */
export function withPattern(blade: THREE.Object3D, name: PatternName | null, cacheKey?: string, mapping: LeafMapping = 'contour', bothFaces?: boolean): THREE.Object3D {
  if (!name) return blade
  const key = cacheKey ? `${cacheKey}|${name}|${mapping}|${bothFaces}` : undefined
  if (key && patterned.has(key)) return patterned.get(key)!
  const base = addLeafSpaceUV(blade, mapping)
  const group = new THREE.Group()
  group.add(base)
  const meshes: THREE.Mesh[] = []
  base.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  const { normal } = bladeAxes(blade)
  // variegation runs through the leaf tissue, so it shows on the underside too; painted patterns stay on top
  const both = bothFaces ?? (name.startsWith('var:') || name.startsWith('pothos:'))
  for (const mesh of meshes) {
    const overlay = new THREE.Mesh(both ? mesh.geometry : topFaceOnly(mesh, normal, base), patternMaterial(name, both))
    overlay.renderOrder = 1
    mesh.add(overlay)
  }
  if (key) patterned.set(key, group)
  return group
}
