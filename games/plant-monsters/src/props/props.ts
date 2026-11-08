import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/**
 * Plant-care props, drawn in code in the same chunky, rounded, matte style as the pots. Units match the pots (the
 * Classic Pot is ~0.66 tall); everything sits on y = 0 and faces +Z. Each builder takes a colourway index.
 *
 *  watering cans · grow lamps · pot hangers (hook, rope, clip/macramé hangers that fit any pot) ·
 *  potting bench · supply bags · hand tools · nursery bits · plant care extras · seed packets · pests · treats
 */

// ------------------------------------------------------------------------------------------------ materials, shapes
const mats = new Map<string, THREE.MeshStandardMaterial>()
export function mat(color: string, rough = 0.75, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`
  let m = mats.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })
    mats.set(key, m)
  }
  return m
}
const M = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.rotation.set(rx, ry, rz)
  o.castShadow = true
  return o
}
const box = (w: number, h: number, d: number, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))
const cyl = (rt: number, rb: number, h: number, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg)
const sph = (r: number, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.6))
const cap = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 6, 18)
const lathe = (pts: [number, number][], seg = 24) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
/** A tube along points (a spout, a handle, a cord). */
function tube(pts: [number, number, number][], r: number, closed = false, seg = 24) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), closed)
  return new THREE.TubeGeometry(c, seg, r, 8, closed)
}
const torus = (R: number, r: number, arc = Math.PI * 2) => new THREE.TorusGeometry(R, r, 8, 24, arc)

/** A canvas texture for labels (bags, packets, cans). */
function labelTex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  draw(cv.getContext('2d')!, w, h)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
const FONT = '"Sniglet", "Arial Rounded MT Bold", sans-serif'

export interface Prop {
  id: string
  name: string
  group: string
  colourways: string[][]
  build: (cw: number) => THREE.Object3D
}

const pick = (list: string[][], cw: number) => list[cw % list.length]

// ------------------------------------------------------------------------------------------------ watering cans
function wateringCan(kind: 'classic' | 'teapot' | 'slim' | 'kids' | 'haws', c: string[]) {
  const g = new THREE.Group()
  const [body, accent] = c
  const metal = kind === 'classic' || kind === 'haws'
  const bm = mat(body, metal ? 0.45 : kind === 'kids' ? 0.5 : 0.4, metal ? 0.35 : 0)
  const am = mat(accent, 0.5, metal ? 0.3 : 0)
  if (kind === 'teapot') {
    g.add(M(lathe([[0, 0], [0.13, 0], [0.2, 0.06], [0.23, 0.16], [0.2, 0.27], [0.12, 0.32], [0.07, 0.33], [0, 0.34]]), bm))
    g.add(M(sph(0.045), am, 0, 0.35, 0))
    g.add(M(tube([[0.18, 0.1, 0], [0.3, 0.16, 0], [0.38, 0.28, 0], [0.42, 0.32, 0]], 0.025), bm))
    g.add(M(torus(0.11, 0.022, Math.PI), am, -0.03, 0.3, 0, 0, 0, 0))
    g.add(M(cyl(0.035, 0.03, 0.03), am, 0.425, 0.33, 0, 0, 0, -0.9))
  } else if (kind === 'slim') {
    g.add(M(lathe([[0, 0], [0.1, 0], [0.12, 0.04], [0.12, 0.34], [0.09, 0.4], [0, 0.41]]), bm))
    g.add(M(tube([[0.1, 0.06, 0], [0.3, 0.22, 0], [0.5, 0.4, 0], [0.62, 0.46, 0]], 0.014), am))
    g.add(M(tube([[-0.11, 0.3, 0], [-0.22, 0.32, 0], [-0.22, 0.12, 0], [-0.11, 0.1, 0]], 0.022), am))
  } else {
    // classic / haws / kids: an oval drum, a long spout with a rose, a top handle
    const w = kind === 'kids' ? 0.26 : 0.3
    const h = kind === 'kids' ? 0.28 : 0.34
    const drum = M(lathe([[0, 0], [w * 0.92, 0], [w, 0.03], [w, h - 0.03], [w * 0.9, h], [0, h]]), bm)
    drum.scale.set(1, 1, kind === 'haws' ? 0.85 : 0.75)
    g.add(drum)
    g.add(M(cyl(w * 0.55, w * 0.55, 0.02), am, 0, h + 0.005, 0))
    const reach = kind === 'haws' ? 0.72 : kind === 'kids' ? 0.48 : 0.62
    g.add(M(tube([[w * 0.8, 0.06, 0], [reach * 0.55, h * 0.55, 0], [reach * 0.85, h * 0.95, 0], [reach, h * 1.12, 0]], kind === 'kids' ? 0.03 : 0.022), bm))
    // the rose
    const rose = M(cyl(kind === 'kids' ? 0.07 : 0.06, 0.025, 0.06), am, reach + 0.02, h * 1.15, 0, 0, 0, -1.0)
    rose.name = 'rose' // the spout head: water comes out here
    g.add(rose)
    g.add(M(cyl(kind === 'kids' ? 0.066 : 0.056, kind === 'kids' ? 0.066 : 0.056, 0.008), mat('#d9d4c8', 0.4, 0.3), reach + 0.045, h * 1.17, 0, 0, 0, -1.0))
    // the handle over the top (and a back grip on the classic)
    g.add(M(tube([[-w * 0.85, h - 0.02, 0], [-w * 0.6, h + 0.2, 0], [w * 0.2, h + 0.22, 0], [w * 0.5, h - 0.02, 0]], 0.022), am))
    if (kind !== 'kids') g.add(M(tube([[-w * 0.98, h * 0.85, 0], [-w * 1.25, h * 0.6, 0], [-w * 0.98, h * 0.2, 0]], 0.02), am))
    if (metal) for (const y of [0.04, h - 0.04]) g.add(M(torus(w * 1.0, 0.012), am, 0, y, 0, Math.PI / 2))
    if (kind === 'kids') g.add(M(sph(0.05), mat('#ffffff', 0.5), 0, h * 0.55, w * 0.74)) // a big daisy dot
  }
  return g
}
function mister(c: string[]) {
  const g = new THREE.Group()
  const [body, accent] = c
  g.add(M(lathe([[0, 0], [0.08, 0], [0.095, 0.02], [0.095, 0.2], [0.07, 0.25], [0.035, 0.27], [0, 0.27]]), mat(body, 0.15, 0, { transparent: true, opacity: 0.8 })))
  g.add(M(cyl(0.04, 0.045, 0.06), mat(accent, 0.5), 0, 0.3, 0))
  g.add(M(box(0.05, 0.05, 0.12, 0.015), mat(accent, 0.5), 0, 0.35, 0.04))
  g.add(M(box(0.03, 0.09, 0.04, 0.012), mat(accent, 0.5), 0, 0.29, 0.07, 0.3))
  return g
}

// ------------------------------------------------------------------------------------------------ grow lamps
const glow = (c = '#fff1c4') => mat(c, 0.3, 0, { emissive: new THREE.Color(c), emissiveIntensity: 1.2 })
function growLamp(kind: 'clip' | 'pendant' | 'tripod' | 'bar' | 'orb', c: string[]) {
  const g = new THREE.Group()
  const [body, accent, light] = c
  const bm = mat(body, 0.45, 0.2)
  const am = mat(accent, 0.5, 0.2)
  const lm = glow(light)
  if (kind === 'clip') {
    g.add(M(box(0.14, 0.05, 0.12, 0.015), am, 0, 0.025, 0)) // the clamp
    g.add(M(tube([[0, 0.05, 0], [0.02, 0.3, 0.02], [0.12, 0.5, 0.06], [0.28, 0.55, 0.1]], 0.016, false, 40), bm)) // gooseneck
    const head = new THREE.Group()
    head.add(M(lathe([[0.03, 0], [0.1, -0.02], [0.13, -0.08], [0.13, -0.1], [0, -0.1]]), am))
    head.add(M(cyl(0.11, 0.11, 0.01), lm, 0, -0.1, 0))
    head.position.set(0.3, 0.57, 0.1)
    head.rotation.z = -0.5
    g.add(head)
  } else if (kind === 'pendant') {
    g.add(M(cyl(0.008, 0.008, 0.6), am, 0, 0.9, 0))
    g.add(M(lathe([[0.03, 0.62], [0.06, 0.6], [0.2, 0.48], [0.24, 0.42], [0.22, 0.41], [0, 0.45]]), bm))
    g.add(M(sph(0.06), lm, 0, 0.44, 0))
  } else if (kind === 'tripod') {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      g.add(M(tube([[0, 0.7, 0], [Math.sin(a) * 0.2, 0.35, Math.cos(a) * 0.2], [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3]], 0.014), am))
    }
    g.add(M(cyl(0.012, 0.012, 0.35), am, 0, 0.87, 0))
    const head = new THREE.Group()
    head.add(M(lathe([[0.03, 0.08], [0.16, 0.0], [0.18, -0.04], [0, -0.03]]), bm))
    head.add(M(cyl(0.15, 0.15, 0.01), lm, 0, -0.03, 0))
    head.position.set(0.05, 1.05, 0.05)
    head.rotation.set(0.3, 0, -0.4)
    g.add(head)
  } else if (kind === 'bar') {
    g.add(M(box(0.3, 0.03, 0.18, 0.015), am, 0, 0.015, 0))
    g.add(M(cyl(0.012, 0.012, 0.6), am, 0, 0.32, 0))
    g.add(M(box(0.62, 0.04, 0.1, 0.02), bm, 0, 0.64, 0.05))
    g.add(M(box(0.58, 0.012, 0.07, 0.006), mat(light, 0.3, 0, { emissive: new THREE.Color(light), emissiveIntensity: 1.4 }), 0, 0.615, 0.05))
  } else {
    // a little "sun": a glowing orb on a wooden base, with a soft ring
    g.add(M(cyl(0.12, 0.14, 0.06), am, 0, 0.03, 0))
    g.add(M(sph(0.15, 24), lm, 0, 0.22, 0))
    g.add(M(torus(0.2, 0.012), bm, 0, 0.22, 0, Math.PI / 2 - 0.3))
  }
  return g
}

// ------------------------------------------------------------------------------------------------ hangers
export type HangerKind = 'clips' | 'macrame'
/** Where the three hanger lines leave the rim (radians round the pot, 0 = front). The arms grab the two front ones. */
export const HANGER_ANGLES = [Math.PI / 3, -Math.PI / 3, Math.PI] // front-left, front-right, back

/**
 * A pot hanger fitted to a pot (rim radius, height): three lines from the rim up to a ring `top` above the rim, and the
 * attachments at the rim (clips over the lip, or a macramé cradle under the pot).
 * Origin at the pot's base; the ring is at (0, height + top, 0). The rope to the ceiling is separate (`rope`).
 */
/** The bits of a pot a hanger needs (BuiltPot fits). */
export interface PotShape { height: number; rimRadius: number; bottomRadius: number; radiusAt: (y: number) => number; group?: THREE.Object3D }

/**
 * How far the pot's outside is from its axis at height y in direction `a` (about y, 0 = +z). Probes the actual pot mesh
 * when we have it (so square, faceted and lipped pots are right), else the round profile.
 */
function surfaceAt(pot: PotShape, a: number, y: number) {
  if (!pot.group) return pot.radiusAt(y)
  const g = pot.group
  g.updateMatrixWorld(true)
  const far = 5
  const o = new THREE.Vector3(Math.sin(a) * far, y, Math.cos(a) * far).applyMatrix4(g.matrixWorld)
  const t = new THREE.Vector3(0, y, 0).applyMatrix4(g.matrixWorld)
  const ray = new THREE.Raycaster(o, t.clone().sub(o).normalize(), 0, o.distanceTo(t))
  const meshes: THREE.Object3D[] = []
  g.traverse((x) => {
    let fx = false
    for (let q: THREE.Object3D | null = x; q && q !== g; q = q.parent) fx ||= !!q.userData.fx || !!q.userData.limb
    if ((x as THREE.Mesh).isMesh && !fx) meshes.push(x)
  })
  const hit = ray.intersectObjects(meshes, false)[0]
  if (!hit) return pot.radiusAt(y)
  const p = g.worldToLocal(hit.point.clone())
  return Math.hypot(p.x, p.z)
}

/**
 * A pot hanger fitted to a pot: three lines from the rim up to a ring `top` above the rim, and the attachments (clips
 * over the lip, a macramé cradle that follows the pot's own wall down and under the base).
 * Origin at the pot's base; the ring is at (0, height + top, 0). The rope to the ceiling is separate (`rope`).
 */
export function hanger(kind: HangerKind, pot: PotShape, top = 0.5, c: string[] = ['#e9dcc4', '#c9a36a']) {
  const g = new THREE.Group()
  const [line, accent] = c
  const { height, rimRadius: rimR } = pot
  const lm = mat(line, 0.9)
  const am = mat(accent, 0.6, kind === 'clips' ? 0.4 : 0)
  const ringY = height + top
  const lineR = kind === 'macrame' ? 0.012 : 0.007
  for (const a of HANGER_ANGLES) {
    const sx = Math.sin(a)
    const sz = Math.cos(a)
    const rimA = Math.max(surfaceAt(pot, a, height - 0.01), surfaceAt(pot, a, height - 0.04)) + 0.012
    const rx = sx * rimA
    const rz = sz * rimA
    g.add(M(tube([[rx, height + 0.02, rz], [rx * 0.5, (height + ringY) / 2 + 0.02, rz * 0.5], [0, ringY, 0]], lineR, false, 12), lm))
    if (kind === 'clips') {
      const clip = M(tube([[0, -0.05, 0.012], [0, 0.0, 0.012], [0, 0.03, -0.004], [0, 0.0, -0.022], [0, -0.03, -0.022]], 0.008, false, 16), am)
      clip.position.set(rx, height, rz)
      clip.rotation.y = a
      g.add(clip)
    } else if (kind === 'macrame') {
      // the cord hugs the pot's own wall down to the base (whatever its shape), then runs under it to the middle
      const pts: [number, number, number][] = []
      for (let k = 0; k <= 8; k++) {
        const y = height + 0.02 - (height + 0.02) * (k / 8)
        const r = surfaceAt(pot, a, Math.max(0.01, y)) + 0.016
        pts.push([sx * r, y, sz * r])
      }
      pts.push([sx * pot.bottomRadius * 0.5, -0.02, sz * pot.bottomRadius * 0.5], [0, -0.035, 0])
      g.add(M(tube(pts, lineR, false, 40), lm))
      // a couple of knots: on the wall and on the line above the rim
      const yk = height * 0.55
      const rk = surfaceAt(pot, a, yk) + 0.018
      g.add(M(sph(0.026), lm, sx * rk, yk, sz * rk))
      const f = 0.3
      g.add(M(sph(0.024), lm, rx * (1 - f), height + 0.02 + (ringY - height - 0.02) * f, rz * (1 - f)))
    }
  }
  if (kind === 'macrame') {
    g.add(M(sph(0.035), lm, 0, -0.04, 0))
    for (let k = 0; k < 7; k++) g.add(M(cyl(0.006, 0.004, 0.16), lm, Math.sin(k) * 0.015, -0.13, Math.cos(k) * 0.015))
  }
  g.add(M(torus(0.04, 0.012), am, 0, ringY, 0))
  g.userData.ringY = ringY
  return g
}
/** A ceiling hook (origin at the ceiling, hangs down -Y). */
export function ceilingHook(c: string[] = ['#3b3b3b']) {
  const g = new THREE.Group()
  const m = mat(c[0], 0.4, 0.5)
  g.add(M(cyl(0.05, 0.05, 0.02), m, 0, -0.01, 0))
  g.add(M(tube([[0, -0.02, 0], [0, -0.1, 0], [0.03, -0.15, 0], [0.0, -0.18, 0], [-0.03, -0.15, 0]], 0.009, false, 16), m))
  return g
}
/** A rope of any length from (0,0,0) down to (0,-len,0). */
/**
 * A rope `len` long hanging from (0,0,0), ending in a little S-hook at (0,-len,0) that clips through a hanger's ring.
 */
export function rope(len: number, c: string[] = ['#d8c49e', '#9aa0a6']) {
  const g = new THREE.Group()
  g.add(M(tube([[0, 0, 0], [0, -len * 0.5, 0], [0, -len + 0.06, 0]], 0.01, false, 6), mat(c[0], 0.95)))
  g.add(M(sph(0.016), mat(c[0], 0.95), 0, -len + 0.06, 0)) // a whipped end
  // the S-hook: up into the rope's end, down through the ring
  g.add(M(tube([[0, -len + 0.07, 0], [0.025, -len + 0.06, 0], [0.02, -len + 0.035, 0], [0, -len + 0.02, 0], [-0.02, -len + 0.005, 0], [-0.018, -len - 0.02, 0], [0, -len - 0.03, 0], [0.012, -len - 0.015, 0]], 0.006, false, 24), mat(c[1] ?? '#9aa0a6', 0.35, 0.6)))
  return g
}

// ------------------------------------------------------------------------------------------------ potting bench + bags
function bench(c: string[]) {
  const g = new THREE.Group()
  const wood = mat(c[0], 0.85)
  const dark = mat(c[1], 0.85)
  g.add(M(box(1.6, 0.06, 0.7, 0.02), wood, 0, 0.78, 0)) // top
  g.add(M(box(1.5, 0.04, 0.6, 0.015), wood, 0, 0.22, 0)) // shelf
  for (const [x, z] of [[-0.74, -0.3], [0.74, -0.3], [-0.74, 0.3], [0.74, 0.3]]) g.add(M(box(0.06, 0.78, 0.06, 0.012), dark, x, 0.39, z))
  g.add(M(box(1.6, 0.6, 0.04, 0.015), mat(c[2] ?? '#e8dcc4', 0.9), 0, 1.11, -0.34)) // pegboard
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) g.add(M(sph(0.012, 6), dark, -0.68 + i * 0.17, 0.9 + j * 0.17, -0.31))
  g.add(M(box(1.6, 0.12, 0.04, 0.015), wood, 0, 0.84, 0.33)) // a lip so the soil stays on
  g.add(M(box(0.3, 0.04, 0.3, 0.012), mat('#6b4a33', 1), -0.45, 0.82, 0.05)) // a little pile of soil
  return g
}
/**
 * A soft sack (flour-sack style), built like a pillow: flat-ish front and back, softly squared sides, full and sagging
 * at the bottom, gathered into a tied neck with a floppy frilled tuft above it, and a little lean so it isn't stiff.
 */
function sackGeo(w: number, h: number, d: number, seed = 0) {
  const geo = new THREE.SphereGeometry(1, 40, 36)
  const p = geo.getAttribute('position') as THREE.BufferAttribute
  const S = THREE.MathUtils.smoothstep
  for (let i = 0; i < p.count; i++) {
    const x0 = p.getX(i)
    const y0 = p.getY(i)
    const z0 = p.getZ(i)
    const th = Math.atan2(z0, x0)
    const u = Math.acos(THREE.MathUtils.clamp(-y0, -1, 1)) / Math.PI // 0 bottom pole .. 1 top pole
    // width profile (half-widths as a fraction of w/2): rounded bottom edge, full low belly, pinched neck, frilled tuft
    let a = Math.sin(Math.min(1, u / 0.1) * Math.PI / 2) * (1 + 0.06 * Math.sin(Math.PI * S(u, 0.05, 0.75)))
    a *= 1 - 0.82 * S(u, 0.62, 0.8) // the neck
    a += 0.38 * S(u, 0.8, 0.88) * (1 - S(u, 0.93, 1)) // the tuft above the tie
    a *= 1 + 0.12 * Math.sin(th * 7 + seed) * S(u, 0.82, 0.9) // ruffles
    // depth: a full bottom where it sits, flatter (pillowy) higher up
    const dd = 1 - 0.35 * S(u, 0.15, 0.6)
    // softly squared cross-section (a superellipse)
    const c = Math.cos(th)
    const sn = Math.sin(th)
    const n = 2.8 - 1.6 * S(u, 0.55, 0.8)
    const k = Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(sn), n), -1 / n)
    let x = c * k * a * (w / 2)
    const z = sn * k * a * dd * (d / 2)
    // height: a flat bottom, then the body, the neck at ~0.8h and the tuft to h
    let y = u < 0.1 ? 0.03 * h * Math.sin((u / 0.1) * Math.PI / 2) : 0.03 * h + (u - 0.1) / 0.9 * 0.97 * h
    // the bulge of the filling makes the middle of the front and back puff out
    const puff = 0.12 * Math.sin(Math.PI * S(u, 0.05, 0.7)) * Math.cos(c * Math.PI / 2)
    const z2 = z * (1 + puff)
    // a lean and a slump, so it looks filled and set down rather than modelled
    x += 0.04 * w * Math.pow(u, 2) * (seed % 2 ? 1 : -1)
    y -= 0.03 * h * S(u, 0.3, 0.75) * Math.abs(c)
    p.setXYZ(i, x, y, z2)
    void z0
  }
  geo.computeVertexNormals()
  return geo
}
type SackIcon = 'soil' | 'food' | 'perlite' | 'bark' | 'sand'
function sackIcon(kind: SackIcon, ink: string) {
  return labelTex(256, 256, (x, w, h) => {
    x.clearRect(0, 0, w, h)
    x.fillStyle = 'rgba(255,248,234,0.92)'
    x.beginPath()
    x.arc(w / 2, h / 2, 118, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = ink
    x.strokeStyle = ink
    x.lineCap = 'round'
    x.lineWidth = 12
    if (kind === 'soil') {
      x.beginPath() // a mound of soil with a sprout
      x.ellipse(128, 170, 80, 38, 0, Math.PI, 0)
      x.fill()
      x.beginPath()
      x.moveTo(128, 140)
      x.lineTo(128, 92)
      x.stroke()
      for (const s of [-1, 1]) {
        x.beginPath()
        x.ellipse(128 + s * 26, 84, 24, 12, s * -0.5, 0, Math.PI * 2)
        x.fill()
      }
    } else if (kind === 'food') {
      x.beginPath() // a leaf with a sparkle
      x.ellipse(120, 140, 64, 34, -0.7, 0, Math.PI * 2)
      x.fill()
      x.strokeStyle = 'rgba(255,248,234,0.9)'
      x.lineWidth = 6
      x.beginPath()
      x.moveTo(80, 185)
      x.lineTo(160, 95)
      x.stroke()
      x.fillStyle = ink
      const star = (cx: number, cy: number, r: number) => {
        x.beginPath()
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          const rr = i % 2 ? r * 0.35 : r
          x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
        }
        x.fill()
      }
      star(185, 75, 26)
      star(205, 135, 14)
    } else if (kind === 'perlite') {
      // little white pebbles in a heap
      x.fillStyle = ink
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4
        const r = 18 + 60 * Math.sqrt(i / 14)
        x.beginPath()
        x.arc(128 + Math.sin(a) * r, 140 + Math.cos(a) * r * 0.6, 17, 0, Math.PI * 2)
        x.fill()
      }
    } else if (kind === 'bark') {
      for (let i = 0; i < 6; i++) {
        x.save()
        x.translate(80 + (i % 3) * 48, 105 + Math.floor(i / 3) * 52)
        x.rotate((i % 2 ? 1 : -1) * 0.4)
        x.beginPath()
        x.roundRect(-30, -14, 60, 28, 10)
        x.fill()
        x.restore()
      }
    } else {
      // sand: a dune and a little sun
      x.beginPath()
      x.moveTo(36, 180)
      x.quadraticCurveTo(110, 100, 220, 180)
      x.closePath()
      x.fill()
      x.beginPath()
      x.arc(180, 85, 22, 0, Math.PI * 2)
      x.fill()
    }
  })
}
function supplyBag(kind: SackIcon, c: string[], h = 0.42) {
  const g = new THREE.Group()
  const [sackCol, ink, tie] = c
  const w = 0.3
  const d = 0.2
  const seed = kind.length
  const sack = M(sackGeo(w, h, d, seed), mat(sackCol, 0.95))
  g.add(sack)
  // the tie round the neck
  const neckY = 0.03 * h + ((0.71 - 0.1) / 0.9) * 0.97 * h
  const tieM = mat(tie ?? '#c9a36a', 0.9)
  const lean = (u: number) => 0.04 * w * u * u * (seed % 2 ? 1 : -1)
  const tieRing = M(torus(w * 0.11, 0.011), tieM, lean(0.71), neckY, 0, Math.PI / 2)
  tieRing.scale.set(1, 0.75, 1)
  g.add(tieRing)
  g.add(pill([lean(0.71) + w * 0.08, neckY, d * 0.06], [lean(0.71) + w * 0.16, neckY - 0.05, d * 0.12], 0.008, tieM)) // the loose ends
  g.add(pill([lean(0.71) + w * 0.08, neckY, d * 0.06], [lean(0.71) + w * 0.19, neckY - 0.02, d * 0.02], 0.008, tieM))
  // the icon, printed on the front: a decal laid on the sack's surface (ray-cast onto it so it follows the puff)
  const decal = new THREE.PlaneGeometry(0.16, 0.16, 10, 10)
  const dp = decal.getAttribute('position') as THREE.BufferAttribute
  const ray = new THREE.Raycaster()
  sack.updateMatrixWorld()
  const cy = h * 0.36
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i)
    const y = dp.getY(i) + cy
    ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(sack)[0]
    dp.setXYZ(i, x, y, (hit ? hit.point.z : d / 2) + 0.003)
  }
  decal.computeVertexNormals()
  g.add(M(decal, new THREE.MeshStandardMaterial({ map: sackIcon(kind, ink), transparent: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 })))
  return g
}

// ------------------------------------------------------------------------------------------------ tools
function shears(c: string[]) {
  const g = new THREE.Group()
  const blade = mat('#c9ccd0', 0.3, 0.7)
  const grip = mat(c[0], 0.5)
  for (const s of [-1, 1]) {
    const half = new THREE.Group()
    half.add(M(box(0.2, 0.012, 0.035, 0.006), blade, 0.1, 0, 0))
    half.add(M(cap(0.022, 0.16), grip, -0.11, 0, 0.0, 0, 0, Math.PI / 2))
    half.rotation.y = s * 0.18
    half.position.y = 0.02 + (s > 0 ? 0.012 : 0)
    g.add(half)
  }
  g.add(M(cyl(0.014, 0.014, 0.04), mat('#8a8d90', 0.3, 0.7), 0, 0.02, 0))
  return g
}
function trowel(c: string[], fork = false) {
  const g = new THREE.Group()
  g.add(M(cap(0.028, 0.14), mat(c[0], 0.6), -0.13, 0.03, 0, 0, 0, Math.PI / 2))
  g.add(M(cyl(0.012, 0.012, 0.08), mat('#b9bcc0', 0.3, 0.6), -0.02, 0.03, 0, 0, 0, Math.PI / 2))
  if (fork) for (const z of [-0.03, 0, 0.03]) g.add(M(cap(0.008, 0.16), mat('#b9bcc0', 0.3, 0.6), 0.1, 0.02, z, 0, 0, Math.PI / 2))
  else {
    const scoop = M(sph(0.07, 16), mat('#b9bcc0', 0.3, 0.6), 0.1, 0.02, 0)
    scoop.scale.set(1.5, 0.25, 0.8)
    g.add(scoop)
  }
  return g
}
function dibber(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.025, 0.006, 0.22), mat(c[0], 0.8), 0, 0.11, 0))
  g.add(M(sph(0.035), mat(c[0], 0.8), 0, 0.24, 0))
  return g
}
function gloves(c: string[]) {
  const g = new THREE.Group()
  const m = mat(c[0], 0.9)
  for (const s of [-1, 1]) {
    const hand = new THREE.Group()
    const palm = M(box(0.12, 0.03, 0.16, 0.014), m, 0, 0.015, 0)
    hand.add(palm)
    for (let i = 0; i < 4; i++) hand.add(M(cap(0.013, 0.07), m, -0.04 + i * 0.027, 0.015, 0.12, Math.PI / 2))
    hand.add(M(cap(0.014, 0.05), m, 0.07, 0.015, 0.03, Math.PI / 2, 0, -0.7))
    hand.add(M(box(0.13, 0.035, 0.05, 0.012), mat(c[1], 0.9), 0, 0.017, -0.09))
    hand.position.set(s * 0.09, s > 0 ? 0.03 : 0, 0)
    hand.rotation.y = s * 0.25
    g.add(hand)
  }
  return g
}

// ------------------------------------------------------------------------------------------------ nursery
function nurseryPot(c: string[], r = 0.13, h = 0.14) {
  return M(lathe([[0, 0], [r * 0.78, 0], [r, h], [r * 1.06, h], [r * 1.06, h + 0.012], [r * 0.95, h + 0.012], [r * 0.74, 0.012], [0, 0.012]]), mat(c[0], 0.6))
}
function potStack(c: string[]) {
  const g = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const p = nurseryPot(c)
    p.position.y = i * 0.035
    p.rotation.z = (i % 2 ? 1 : -1) * 0.02
    g.add(p)
  }
  return g
}
function saucer(c: string[]) {
  return M(lathe([[0, 0], [0.22, 0], [0.26, 0.04], [0.25, 0.045], [0.2, 0.012], [0, 0.012]]), mat(c[0], 0.9))
}
/** A seedling in a little nursery cup: two cotyledons on a stem. */
/** A square nursery cup (tapered, a little rim) with drain slots round the bottom edge and holes in the base. */
function squareCup(col: string, w = 0.16, h = 0.15) {
  const g = new THREE.Group()
  const m = mat(col, 0.6)
  const outer = new THREE.CylinderGeometry((w / 2) * Math.SQRT2, (w * 0.36) * Math.SQRT2, h, 4, 1, true)
  outer.rotateY(Math.PI / 4)
  g.add(M(outer, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }), 0, h / 2, 0))
  g.add(M(box(w * 0.74, 0.012, w * 0.74, 0.004), m, 0, 0.006, 0)) // the base
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    g.add(M(box(w + 0.014, 0.014, 0.014, 0.005), m, Math.sin(a) * (w / 2), h, Math.cos(a) * (w / 2), 0, a, 0)) // the rim: a square lip, open in the middle
  }
  // drain slots at the bottom of each side and holes underneath
  const hole = mat('#5b3d2b', 1) // the soil showing through, so the holes read as open
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2
    const r = w * 0.37 + 0.003
    g.add(M(box(0.04, 0.016, 0.004, 0.002), hole, Math.sin(a) * r, 0.02, Math.cos(a) * r, 0, a, 0))
  }
  for (const [x, z] of [[-0.03, -0.03], [0.03, -0.03], [-0.03, 0.03], [0.03, 0.03], [0, 0]]) g.add(M(cyl(0.008, 0.008, 0.002, 10), hole, x, -0.001, z))
  return g
}
function seedlingCup(c: string[]) {
  const g = new THREE.Group()
  g.add(squareCup(c[0]))
  g.add(M(box(0.15, 0.02, 0.15, 0.006), mat('#5b3d2b', 1), 0, 0.138, 0)) // the soil, just below the rim
  const mound = M(sph(0.03, 12), mat('#5b3d2b', 1), 0, 0.146, 0)
  mound.scale.set(1.6, 0.25, 1.6)
  g.add(mound)
  const leaf = mat('#78b866', 0.7)
  g.add(M(cyl(0.008, 0.01, 0.1), leaf, 0, 0.18, 0))
  for (const s of [-1, 1]) {
    const l = M(sph(0.035, 12), leaf, s * 0.035, 0.235, 0)
    l.scale.set(1.2, 0.35, 0.8)
    l.rotation.z = s * 0.4
    g.add(l)
  }
  return g
}
/** A cutting rooting in a little water jar. */
function cuttingJar(c: string[]) {
  const g = new THREE.Group()
  g.add(M(lathe([[0, 0], [0.07, 0], [0.08, 0.02], [0.08, 0.16], [0.065, 0.19], [0, 0.19]]), mat('#cfe9e6', 0.1, 0, { transparent: true, opacity: 0.45 })))
  g.add(M(cyl(0.072, 0.072, 0.1), mat('#9fd3e6', 0.1, 0, { transparent: true, opacity: 0.5 }), 0, 0.06, 0))
  const stem = mat('#5e9a52', 0.7)
  g.add(M(tube([[0, 0.03, 0], [0.01, 0.15, 0], [0.03, 0.27, 0]], 0.008), stem))
  for (const [x, y, s] of [[0.06, 0.27, 1], [-0.03, 0.24, -1]]) {
    const l = M(sph(0.05, 12), mat(c[0], 0.6), x, y, 0)
    l.scale.set(1.3, 0.3, 0.9)
    l.rotation.z = s * 0.5
    g.add(l)
  }
  for (let k = 0; k < 4; k++) g.add(M(tube([[0, 0.03, 0], [Math.sin(k * 1.7) * 0.025, 0.01, Math.cos(k * 1.7) * 0.025], [Math.sin(k * 1.7) * 0.04, 0.0, Math.cos(k * 1.7) * 0.04]], 0.003), mat('#f1ead2', 0.8)))
  return g
}

// ------------------------------------------------------------------------------------------------ care extras
function plantFoodSpray(c: string[]) {
  const g = mister([c[0], c[1]])
  const tex = labelTex(128, 128, (x, w, h) => {
    x.fillStyle = c[2] ?? '#fff6e6'
    x.fillRect(0, 0, w, h)
    x.font = `800 40px ${FONT}`
    x.textAlign = 'center'
    x.fillText('🌿', w / 2, h * 0.55)
  })
  g.add(M(cyl(0.097, 0.097, 0.1, 20), mat('#ffffff', 0.8, 0, { map: tex }), 0, 0.11, 0))
  return g
}
function labels(c: string[]) {
  const g = new THREE.Group()
  ;[0, 1, 2].forEach((i) => {
    const s = M(box(0.05, 0.16, 0.008, 0.004), mat(c[i % c.length], 0.6), i * 0.06 - 0.06, 0.08, 0, 0, 0, (i - 1) * 0.15)
    g.add(s)
  })
  return g
}
function twine(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.08, 0.08, 0.1, 24), mat(c[0], 0.95), 0, 0.05, 0))
  g.add(M(cyl(0.03, 0.03, 0.105, 12), mat('#8a6a4a', 0.9), 0, 0.05, 0))
  g.add(M(tube([[0.08, 0.05, 0], [0.14, 0.02, 0.04], [0.2, 0.005, 0.02]], 0.004), mat(c[0], 0.95)))
  return g
}
function moistureMeter(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.006, 0.004, 0.2), mat('#c9ccd0', 0.3, 0.7), 0, 0.1, 0))
  g.add(M(cyl(0.06, 0.06, 0.03, 24), mat(c[0], 0.5), 0, 0.23, 0, Math.PI / 2))
  const face = labelTex(128, 128, (x, w, h) => {
    x.fillStyle = '#fff8ea'
    x.fillRect(0, 0, w, h)
    const gr = x.createLinearGradient(20, 0, 108, 0)
    gr.addColorStop(0, '#d9734a')
    gr.addColorStop(0.5, '#7bbf6a')
    gr.addColorStop(1, '#4a8fd9')
    x.strokeStyle = gr
    x.lineWidth = 14
    x.beginPath()
    x.arc(64, 80, 42, Math.PI * 1.1, Math.PI * 1.9)
    x.stroke()
    x.strokeStyle = '#333'
    x.lineWidth = 5
    x.beginPath()
    x.moveTo(64, 80)
    x.lineTo(84, 46)
    x.stroke()
  })
  g.add(M(cyl(0.052, 0.052, 0.005, 24), mat('#ffffff', 0.6, 0, { map: face }), 0, 0.23, 0.016, Math.PI / 2))
  return g
}
function mossPole(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.05, 0.05, 0.9, 12), mat(c[0], 1), 0, 0.45, 0))
  for (let i = 0; i < 18; i++) g.add(M(sph(0.035, 8), mat(c[1], 1), Math.sin(i * 2.3) * 0.045, 0.06 + i * 0.048, Math.cos(i * 2.3) * 0.045))
  return g
}
function bamboo(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.012, 0.014, 0.9), mat(c[0], 0.6), 0, 0.45, 0))
  for (let i = 1; i < 5; i++) g.add(M(cyl(0.016, 0.016, 0.012), mat(c[1], 0.6), 0, i * 0.18, 0))
  return g
}
function pebbleTray(c: string[]) {
  const g = new THREE.Group()
  g.add(M(lathe([[0, 0], [0.3, 0], [0.32, 0.05], [0.3, 0.055], [0.28, 0.01], [0, 0.01]], 32), mat(c[0], 0.5)))
  g.add(M(cyl(0.28, 0.28, 0.02, 32), mat('#a8d8e6', 0.1, 0, { transparent: true, opacity: 0.6 }), 0, 0.02, 0))
  for (let i = 0; i < 30; i++) {
    const a = i * 2.4
    const r = 0.04 + 0.22 * Math.sqrt(i / 30)
    const p = M(sph(0.03, 8), mat(['#d8d2c4', '#bfb8a8', '#e8e2d4', '#a9a294'][i % 4], 0.8), Math.sin(a) * r, 0.03, Math.cos(a) * r)
    p.scale.set(1, 0.6, 0.9)
    g.add(p)
  }
  return g
}
function caddy(c: string[]) {
  const g = new THREE.Group()
  g.add(M(cyl(0.34, 0.34, 0.05, 32), mat(c[0], 0.8), 0, 0.09, 0))
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4
    g.add(M(sph(0.04, 10), mat(c[1], 0.5), Math.sin(a) * 0.26, 0.04, Math.cos(a) * 0.26))
  }
  return g
}
function cloche(c: string[]) {
  const g = new THREE.Group()
  const glass = mat('#e8f6f4', 0.05, 0, { transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  g.add(M(lathe([[0.2, 0], [0.2, 0.25], [0.17, 0.36], [0.1, 0.42], [0, 0.44]], 32), glass))
  g.add(M(sph(0.035), mat(c[0], 0.4, 0.2), 0, 0.46, 0))
  g.add(M(cyl(0.21, 0.22, 0.02, 32), mat(c[1], 0.8), 0, 0.01, 0))
  return g
}
function bugSpray(c: string[]) {
  const g = new THREE.Group()
  const tex = labelTex(128, 128, (x, w, h) => {
    x.fillStyle = c[0]
    x.fillRect(0, 0, w, h)
    x.font = `64px "Apple Color Emoji"`
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText('🐛', w / 2, h / 2)
    x.strokeStyle = '#d8443d'
    x.lineWidth = 10
    x.beginPath()
    x.arc(w / 2, h / 2, 40, 0, Math.PI * 2)
    x.moveTo(w / 2 - 28, h / 2 + 28)
    x.lineTo(w / 2 + 28, h / 2 - 28)
    x.stroke()
  })
  g.add(M(cyl(0.065, 0.065, 0.24, 20), mat('#ffffff', 0.5, 0, { map: tex }), 0, 0.12, 0))
  g.add(M(cyl(0.05, 0.065, 0.05, 20), mat(c[1], 0.4), 0, 0.265, 0))
  g.add(M(cyl(0.022, 0.022, 0.03), mat(c[1], 0.4), 0, 0.3, 0))
  return g
}

// ------------------------------------------------------------------------------------------------ seed packets
const SEEDS: [string, string, string][] = [
  ['Sunflower', '#f6c544', '🌻'], ['Basil', '#7cbf6a', '🌿'], ['Tomato', '#e05a48', '🍅'], ['Strawberry', '#f08a9a', '🍓'],
  ['Pumpkin', '#ec9a3e', '🎃'], ['Cactus', '#9cc78a', '🌵'], ['Mystery', '#a98ad6', '❓'], ['Monstera', '#4f9a6a', '🌱'],
]
function seedPacket(cw: number) {
  const [name, col, emoji] = SEEDS[cw % SEEDS.length]
  const tex = labelTex(192, 256, (x, w, h) => {
    x.fillStyle = '#fff6e6'
    x.fillRect(0, 0, w, h)
    x.fillStyle = col
    x.beginPath()
    x.roundRect(12, 12, w - 24, h * 0.66, 18)
    x.fill()
    x.font = `92px "Apple Color Emoji"`
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.fillText(emoji, w / 2, h * 0.36)
    x.fillStyle = '#4a2c20'
    x.font = `800 ${name.length > 8 ? 26 : 32}px ${FONT}`
    x.fillText(name.toUpperCase(), w / 2, h * 0.84)
  })
  const g = new THREE.Group()
  const p = M(box(0.16, 0.22, 0.02, 0.008), [mat('#fff6e6', 0.8), mat('#fff6e6', 0.8), mat('#fff6e6', 0.8), mat('#fff6e6', 0.8), mat('#ffffff', 0.8, 0, { map: tex }), mat('#fff6e6', 0.8)] as any, 0, 0.11, 0, -0.12)
  g.add(p)
  return g
}

// ------------------------------------------------------------------------------------------------ pests (a bit oversized, cute)
/** A soft pill (capsule) of radius r running from a to b. */
function pill(a: [number, number, number], b: [number, number, number], r: number, m: THREE.Material) {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const o = new THREE.Mesh(cap(r, Math.max(1e-3, A.distanceTo(B))), m)
  o.position.copy(A).add(B).multiplyScalar(0.5)
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize())
  o.castShadow = true
  return o
}
/** A soft blob: a sphere squashed to (x, y, z) radii. */
function blob(rx: number, ry: number, rz: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 24) {
  const o = M(sph(1, seg), m, x, y, z)
  o.scale.set(rx, ry, rz)
  return o
}
/** A flat wing: a polygon outline (in x/z) with every corner rounded off, soft bevelled edges, lying flat. */
function wingGeo(pts: [number, number][], thick = 0.004, round = 0.4) {
  const sh = new THREE.Shape()
  const n = pts.length
  const lerp = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
  for (let i = 0; i < n; i++) {
    const prev = pts[(i + n - 1) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    const a = lerp(cur, prev, round / 2)
    const b = lerp(cur, next, round / 2)
    if (i === 0) sh.moveTo(...a)
    else sh.lineTo(...a)
    sh.quadraticCurveTo(cur[0], cur[1], b[0], b[1])
  }
  sh.closePath()
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick, bevelSize: thick * 1.2, bevelSegments: 4, curveSegments: 10 })
  g.translate(0, 0, -thick / 2)
  g.rotateX(Math.PI / 2) // shape x/y -> x/z, lying flat
  g.computeVertexNormals()
  return g
}
/**
 * Pests: faceless soft toys (the "toy dome" concepts, concepts/pests/C2-1.png), each with its own silhouette so they
 * read at a glance: the aphid a pear on six stubs with antenna and tail nubs, the mite a ball on four stubs, the
 * mealybug a ridged oval with soft spikes, the gnat tall on legs with a V of long wings, the scale a flat button, the
 * thrips a long low capsule with fringed wings, the whitefly a tent of two broad wings. Front is +z.
 */
export type PestKind = 'aphid' | 'mite' | 'mealybug' | 'gnat' | 'scale' | 'thrips' | 'whitefly'
export function pest(kind: PestKind) {
  const g = new THREE.Group()
  if (kind === 'aphid') {
    const m = mat('#9fd68f', 0.7)
    const b = blob(0.045, 0.04, 0.06, m, 0, 0.052, -0.008)
    b.rotation.x = -0.15 // the fat back end lifts
    g.add(b, blob(0.03, 0.028, 0.03, m, 0, 0.046, 0.045)) // the narrower front
    for (const s of [-1, 1]) {
      for (const z of [-0.038, -0.006, 0.026]) g.add(pill([s * 0.03, 0.024, z], [s * 0.04, 0.011, z + 0.004], 0.011, m)) // six stubby legs
      g.add(pill([s * 0.012, 0.066, 0.058], [s * 0.018, 0.078, 0.066], 0.009, m)) // antenna nubs
      g.add(pill([s * 0.016, 0.08, -0.05], [s * 0.02, 0.09, -0.06], 0.009, m)) // tail nubs
    }
  } else if (kind === 'mite') {
    const m = mat('#ec6e58', 0.7)
    g.add(blob(0.042, 0.038, 0.044, m, 0, 0.05, 0))
    for (const s of [-1, 1]) for (const z of [-0.022, 0.022]) g.add(pill([s * 0.026, 0.026, z], [s * 0.034, 0.012, z * 1.25], 0.012, m)) // just four stubs
  } else if (kind === 'mealybug') {
    const m = mat('#f6f2ea', 0.85)
    g.add(blob(0.042, 0.04, 0.065, m, 0, 0.035, 0))
    for (let k = 0; k < 4; k++) g.add(blob(0.04 - Math.abs(k - 1.5) * 0.007, 0.036, 0.014, m, 0, 0.04, -0.036 + k * 0.024)) // the soft ridges
    for (const s of [-1, 1]) {
      for (const z of [-0.035, -0.008, 0.02]) g.add(pill([s * 0.036, 0.018, z], [s * 0.048, 0.012, z + 0.004], 0.009, m)) // little spikes round the edge
      g.add(pill([s * 0.012, 0.045, -0.05], [s * 0.022, 0.075, -0.08], 0.009, m)) // the long tail tufts, flicked up
      g.add(pill([s * 0.014, 0.025, 0.055], [s * 0.03, 0.02, 0.08], 0.008, m)) // the antennae
    }
  } else if (kind === 'gnat') {
    const m = mat('#5d5c5a', 0.7)
    g.add(blob(0.034, 0.032, 0.04, m, 0, 0.075, -0.008), blob(0.022, 0.022, 0.022, m, 0, 0.078, 0.038)) // body and head, up on its legs
    for (const s of [-1, 1]) {
      for (const z of [-0.02, 0.005, 0.03]) {
        g.add(pill([s * 0.02, 0.062, z], [s * 0.045, 0.05, z * 1.5], 0.008, m), pill([s * 0.045, 0.05, z * 1.5], [s * 0.058, 0.009, z * 2], 0.008, m)) // knees up and out, feet splayed
      }
      const w = new THREE.Group() // a V of long rounded wings swept up and back, hinged at the shoulder
      w.add(blob(0.004, 0.05, 0.016, mat('#77756f', 0.6), 0, 0.05, 0))
      w.position.set(s * 0.014, 0.098, -0.01)
      w.rotation.set(-0.55, 0, -s * 0.38)
      g.add(w)
    }
  } else if (kind === 'scale') {
    const m = mat('#a8714f', 0.7)
    g.add(blob(0.058, 0.012, 0.05, m, 0, 0.012, 0), blob(0.038, 0.02, 0.034, m, 0, 0.016, -0.002)) // a flat button: the brim and one low dome
  } else if (kind === 'thrips') {
    const m = mat('#f2cd5e', 0.7)
    g.add(pill([0, 0.026, 0.0], [0, 0.03, 0.05], 0.022, m), pill([0, 0.022, -0.075], [0, 0.026, 0.0], 0.016, m)) // long and low, tapering to the tail
    for (const s of [-1, 1]) {
      g.add(pill([s * 0.012, 0.01, -0.02], [s * 0.026, 0.006, -0.03], 0.005, m), pill([s * 0.012, 0.01, 0.025], [s * 0.026, 0.006, 0.032], 0.005, m))
      const wing = new THREE.Group() // narrow wings with a soft fringe, fanned up and back
      const wm = mat('#f7e1a0', 0.7)
      wing.add(blob(0.004, 0.009, 0.05, wm, 0, 0, -0.05))
      for (let k = 0; k < 5; k++) wing.add(pill([0, 0.006, -0.024 - k * 0.013], [0, 0.014, -0.03 - k * 0.013], 0.0045, wm)) // a soft fringe
      wing.position.set(s * 0.01, 0.048, 0.03)
      wing.rotation.set(0.5, 0, -s * 0.5)
      g.add(wing)
    }
  } else {
    const m = mat('#f8f6f0', 0.8)
    g.add(blob(0.022, 0.024, 0.04, m, 0, 0.03, 0.005), M(sph(0.018), m, 0, 0.034, 0.045))
    for (const s of [-1, 1]) {
      // two broad triangular sails rising from the back in a wide V
      const w = M(wingGeo([[0, 0.035], [0, -0.035], [0.065, -0.055], [0.055, 0.0]], 0.0035, 0.6), m)
      w.position.set(s * 0.01, 0.05, 0)
      w.rotation.set(0, 0, s * 1.15)
      w.scale.x = s
      g.add(w)
    }
    for (const s of [-1, 1]) for (const z of [-0.01, 0.025]) g.add(pill([s * 0.014, 0.014, z], [s * 0.022, 0.006, z], 0.005, m))
  }
  return g
}

// ------------------------------------------------------------------------------------------------ treats
function foodBalls(c: string[]) {
  const g = new THREE.Group()
  g.add(M(lathe([[0, 0], [0.1, 0], [0.11, 0.02], [0.11, 0.2], [0.08, 0.23], [0, 0.23]]), mat('#e8f4f4', 0.1, 0, { transparent: true, opacity: 0.35 })))
  g.add(M(cyl(0.085, 0.085, 0.04, 20), mat(c[1], 0.5), 0, 0.25, 0))
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4
    const r = 0.025 + 0.06 * ((i * 0.37) % 1)
    g.add(M(sph(0.02, 8), mat(c[0], 0.4), Math.sin(a) * r, 0.03 + Math.floor(i / 7) * 0.035, Math.cos(a) * r))
  }
  return g
}
function treat(c: string[]) {
  const g = new THREE.Group()
  g.add(M(sph(0.06, 16), mat(c[0], 0.35), 0, 0.06, 0))
  g.add(M(sph(0.024, 10), mat('#ffffff', 0.3), -0.022, 0.09, 0.03)) // a shine
  return g
}

// ------------------------------------------------------------------------------------------------ catalogue
export const PROPS: Prop[] = [
  // watering cans
  { id: 'can-classic', name: 'Classic can', group: 'watering', colourways: [['#b9bfc2', '#8e969a'], ['#3f7a5a', '#2c5a40'], ['#e3c45a', '#b8952e']], build: (cw) => wateringCan('classic', pick(PROPS[0].colourways, cw)) },
  { id: 'can-teapot', name: 'Teapot can', group: 'watering', colourways: [['#f2ece0', '#d8443d'], ['#7fb5d9', '#f6efe2'], ['#e9a3b5', '#f6efe2']], build: (cw) => wateringCan('teapot', pick(PROPS[1].colourways, cw)) },
  { id: 'can-slim', name: 'Indoor slim can', group: 'watering', colourways: [['#f4efe6', '#2f2f2f'], ['#2f2f2f', '#c9a45a'], ['#a9c9b4', '#f4efe6']], build: (cw) => wateringCan('slim', pick(PROPS[2].colourways, cw)) },
  { id: 'can-kids', name: "Kid's can", group: 'watering', colourways: [['#f2c845', '#e8486a'], ['#4fa8e8', '#f2c845'], ['#e8486a', '#4fd0a0']], build: (cw) => wateringCan('kids', pick(PROPS[3].colourways, cw)) },
  { id: 'can-haws', name: 'Copper can', group: 'watering', colourways: [['#c47a48', '#8e4f2c'], ['#d9b25a', '#9a7a36']], build: (cw) => wateringCan('haws', pick(PROPS[4].colourways, cw)) },
  { id: 'mister', name: 'Mister', group: 'watering', colourways: [['#bfe3e8', '#f4efe6'], ['#f3d6dc', '#2f2f2f'], ['#e8e2d6', '#4f8a68']], build: (cw) => mister(pick(PROPS[5].colourways, cw)) },
  // grow lamps
  { id: 'lamp-clip', name: 'Clip lamp', group: 'lamps', colourways: [['#2f2f2f', '#2f2f2f', '#ffd7f0'], ['#f4efe6', '#f4efe6', '#fff1c4']], build: (cw) => growLamp('clip', pick(PROPS[6].colourways, cw)) },
  { id: 'lamp-pendant', name: 'Pendant grow light', group: 'lamps', colourways: [['#2f2f2f', '#c9a45a', '#fff1c4'], ['#f2ece0', '#2f2f2f', '#ffd7f0']], build: (cw) => growLamp('pendant', pick(PROPS[7].colourways, cw)) },
  { id: 'lamp-tripod', name: 'Tripod lamp', group: 'lamps', colourways: [['#f4efe6', '#7a4f30', '#fff1c4'], ['#e3c45a', '#2f2f2f', '#fff1c4']], build: (cw) => growLamp('tripod', pick(PROPS[8].colourways, cw)) },
  { id: 'lamp-bar', name: 'LED grow bar', group: 'lamps', colourways: [['#e9e6e0', '#9a9a9a', '#ff9ee8'], ['#2f2f2f', '#2f2f2f', '#c8a6ff']], build: (cw) => growLamp('bar', pick(PROPS[9].colourways, cw)) },
  { id: 'lamp-orb', name: 'Sun orb', group: 'lamps', colourways: [['#e3c45a', '#c79a62', '#ffe08a'], ['#f2ece0', '#8a6a4a', '#fff1c4']], build: (cw) => growLamp('orb', pick(PROPS[10].colourways, cw)) },
  // hangers (shown on a stand-in pot rim)
  { id: 'hang-clips', name: 'Clip hanger', group: 'hangers', colourways: [['#e9dcc4', '#9aa0a6'], ['#2f2f2f', '#c9a45a']], build: (cw) => hangerDemo('clips', pick(PROPS[11].colourways, cw)) },
  { id: 'hang-macrame', name: 'Macramé hanger', group: 'hangers', colourways: [['#efe3cc', '#c9a36a'], ['#e9b48f', '#c9a36a'], ['#a9c9b4', '#c9a36a']], build: (cw) => hangerDemo('macrame', pick(PROPS[12].colourways, cw)) },
  { id: 'hook', name: 'Ceiling hook + rope', group: 'hangers', colourways: [['#3b3b3b'], ['#c9a45a']], build: (cw) => { const g = new THREE.Group(); [0.35, 0.6, 0.85].forEach((len, i) => { const h = ceilingHook(pick(PROPS[13].colourways, cw)); h.position.set((i - 1) * 0.2, 1.0, 0); const r = rope(len); r.position.set((i - 1) * 0.2, 1.0 - 0.17, 0); g.add(h, r) }); return g } },
  // potting station + supplies
  { id: 'bench', name: 'Potting bench', group: 'potting', colourways: [['#d6ac74', '#a87d4c', '#efe3cc'], ['#a9c9b4', '#7fa38e', '#f4efe6']], build: (cw) => bench(pick(PROPS[14].colourways, cw)) },
  { id: 'bag-soil', name: 'Potting soil', group: 'potting', colourways: [['#d9c4a0', '#6b4a33', '#8a6a4a'], ['#c9a882', '#3a2418', '#e9dcc4']], build: (cw) => supplyBag('soil', pick(PROPS[15].colourways, cw)) },
  { id: 'bag-food', name: 'Fertiliser', group: 'potting', colourways: [['#e9e1cf', '#4f8a68', '#c9a36a'], ['#cfe0c4', '#2f5a40', '#e9dcc4']], build: (cw) => supplyBag('food', pick(PROPS[16].colourways, cw), 0.38) },
  { id: 'bag-perlite', name: 'Perlite', group: 'potting', colourways: [['#e9e4d8', '#4f86b8', '#9aa0a6'], ['#dfe8ee', '#4f86b8', '#e9dcc4']], build: (cw) => supplyBag('perlite', pick(PROPS[17].colourways, cw), 0.36) },
  { id: 'bag-bark', name: 'Bark mix', group: 'potting', colourways: [['#d8c4a4', '#8a5a34', '#5a3a22']], build: (cw) => supplyBag('bark', pick(PROPS[18].colourways, cw), 0.38) },
  { id: 'bag-sand', name: 'Sand', group: 'potting', colourways: [['#ece0c4', '#c9a050', '#8a6a3a']], build: (cw) => supplyBag('sand', pick(PROPS[19].colourways, cw), 0.32) },
  { id: 'shears', name: 'Shears', group: 'tools', colourways: [['#d8443d'], ['#4f8a68'], ['#f2c845']], build: (cw) => shears(pick(PROPS[20].colourways, cw)) },
  { id: 'trowel', name: 'Trowel', group: 'tools', colourways: [['#d8443d'], ['#4fa8e8'], ['#c79a62']], build: (cw) => trowel(pick(PROPS[21].colourways, cw)) },
  { id: 'fork', name: 'Hand fork', group: 'tools', colourways: [['#d8443d'], ['#4fa8e8'], ['#c79a62']], build: (cw) => trowel(pick(PROPS[22].colourways, cw), true) },
  { id: 'dibber', name: 'Dibber', group: 'tools', colourways: [['#c79a62']], build: (cw) => dibber(pick(PROPS[23].colourways, cw)) },
  { id: 'gloves', name: 'Gloves', group: 'tools', colourways: [['#f2c845', '#4f8a68'], ['#e9a3b5', '#f6efe2'], ['#7fb5d9', '#2f5a80']], build: (cw) => gloves(pick(PROPS[24].colourways, cw)) },
  // nursery
  { id: 'nursery-stack', name: 'Nursery pots', group: 'nursery', colourways: [['#2f2f2f'], ['#4f8a68'], ['#c96f45']], build: (cw) => potStack(pick(PROPS[25].colourways, cw)) },
  { id: 'saucer', name: 'Saucer', group: 'nursery', colourways: [['#c96f45'], ['#e9e1d4']], build: (cw) => saucer(pick(PROPS[26].colourways, cw)) },
  { id: 'seedling', name: 'Seedling cup', group: 'nursery', colourways: [['#262626']], build: (cw) => seedlingCup(pick(PROPS[27].colourways, cw)) },
  { id: 'cutting', name: 'Cutting in water', group: 'nursery', colourways: [['#5e9a52'], ['#7bbf6a']], build: (cw) => cuttingJar(pick(PROPS[28].colourways, cw)) },
  // care extras
  { id: 'food-spray', name: 'Plant food spray', group: 'care', colourways: [['#bfe3a8', '#4f8a68', '#fff6e6']], build: (cw) => plantFoodSpray(pick(PROPS[29].colourways, cw)) },
  { id: 'labels', name: 'Plant labels', group: 'care', colourways: [['#f6efe2', '#f2c845', '#a9c9b4']], build: (cw) => labels(pick(PROPS[30].colourways, cw)) },
  { id: 'twine', name: 'Twine', group: 'care', colourways: [['#d8c49e']], build: (cw) => twine(pick(PROPS[31].colourways, cw)) },
  { id: 'meter', name: 'Moisture meter', group: 'care', colourways: [['#4f8a68'], ['#f2c845']], build: (cw) => moistureMeter(pick(PROPS[32].colourways, cw)) },
  { id: 'moss-pole', name: 'Moss pole', group: 'care', colourways: [['#8a6a4a', '#7a9a52']], build: (cw) => mossPole(pick(PROPS[33].colourways, cw)) },
  { id: 'bamboo', name: 'Bamboo stake', group: 'care', colourways: [['#d9c27a', '#b89a4a']], build: (cw) => bamboo(pick(PROPS[34].colourways, cw)) },
  { id: 'pebble-tray', name: 'Pebble tray', group: 'care', colourways: [['#f4efe6'], ['#9cb3d4']], build: (cw) => pebbleTray(pick(PROPS[35].colourways, cw)) },
  { id: 'caddy', name: 'Plant caddy', group: 'care', colourways: [['#c79a62', '#2f2f2f'], ['#e9e1d4', '#c9a45a']], build: (cw) => caddy(pick(PROPS[36].colourways, cw)) },
  { id: 'cloche', name: 'Cloche', group: 'care', colourways: [['#c9a45a', '#a87d4c']], build: (cw) => cloche(pick(PROPS[37].colourways, cw)) },
  { id: 'bug-spray', name: 'Bug spray', group: 'care', colourways: [['#f2c845', '#2f2f2f'], ['#a9c9b4', '#4f8a68']], build: (cw) => bugSpray(pick(PROPS[38].colourways, cw)) },
  // seeds, pests, treats
  { id: 'seeds', name: 'Seed packet', group: 'seeds', colourways: SEEDS.map(([n]) => [n]), build: (cw) => seedPacket(cw) },
  { id: 'pest-aphid', name: 'Aphid', group: 'pests', colourways: [['']], build: () => pest('aphid') },
  { id: 'pest-mite', name: 'Spider mite', group: 'pests', colourways: [['']], build: () => pest('mite') },
  { id: 'pest-mealybug', name: 'Mealybug', group: 'pests', colourways: [['']], build: () => pest('mealybug') },
  { id: 'pest-gnat', name: 'Fungus gnat', group: 'pests', colourways: [['']], build: () => pest('gnat') },
  { id: 'pest-scale', name: 'Scale', group: 'pests', colourways: [['']], build: () => pest('scale') },
  { id: 'pest-thrips', name: 'Thrips', group: 'pests', colourways: [['']], build: () => pest('thrips') },
  { id: 'pest-whitefly', name: 'Whitefly', group: 'pests', colourways: [['']], build: () => pest('whitefly') },
  { id: 'food-balls', name: 'Plant food pearls', group: 'treats', colourways: [['#7bc6e8', '#f2c845'], ['#f08a9a', '#4f8a68'], ['#f2c845', '#e8486a']], build: (cw) => foodBalls(pick(PROPS[47].colourways, cw)) },
  { id: 'treat', name: 'Plant treat', group: 'treats', colourways: [['#7bc6e8'], ['#f08a9a'], ['#f2c845'], ['#9be08a']], build: (cw) => treat(pick(PROPS[48].colourways, cw)) },
]

/** A hanger shown on a plain terracotta stand-in pot (for the gallery). */
/** A hanger shown on a stand-in terracotta pot (for the gallery). */
function hangerDemo(kind: HangerKind, c: string[]) {
  const g = new THREE.Group()
  const H = 0.5
  const R = 0.32
  const shape: PotShape = { height: H + 0.04, rimRadius: R * 1.06, bottomRadius: R * 0.8, radiusAt: (y) => (y >= H ? R * 1.06 : R * 0.8 + (R - R * 0.8) * (y / H)) }
  g.add(M(lathe([[0, 0], [R * 0.8, 0], [R, H], [R * 1.06, H], [R * 1.06, H + 0.04], [R * 0.95, H + 0.04], [0, H]]), mat('#c96f45', 0.9)))
  const hg = hanger(kind, shape, 0.5, c)
  g.add(hg)
  const r = rope(0.3)
  r.position.y = hg.userData.ringY + 0.3
  g.add(r)
  const hk = ceilingHook()
  hk.position.y = hg.userData.ringY + 0.3 + 0.17
  g.add(hk)
  return g
}
