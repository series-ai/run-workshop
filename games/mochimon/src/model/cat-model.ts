// The customer cats as 3D models: shared body, coats (fur patterns), accessories, tails,
// a waddle cycle, and the renderer that turns one into a one-bit sprite. Pure (no file
// access), so the build scripts and the in-browser cat previewer both use it.

import { Bitmap, CLEAR, INK, PAPER } from './bitmap.ts'
import { droop, ellipsoid, LIGHT, scene, shadeHits, traceIso, type Hit, type Material, type Sdf, type V3 } from './iso.ts'
import { ROLES, ROLE_NAMES, SPLITS, THEMES, catAssign, ramp, type ColorMode, type PaletteTheme, type Role } from './palette.ts'
export { ROLES, ROLE_NAMES, SPLITS, THEMES, catAssign, ramp, type ColorMode, type PaletteTheme, type Role }

const WHITE: [number, number, number, number] = [0, 0, 0, 0] // no halftone anywhere

// ---------------------------------------------------------------- shapes

export const capsule = (a: V3, b: V3, r: number): Sdf => ({
  mat: 'fur',
  d: (p) => {
    const pa: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const ba: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] ** 2 + ba[1] ** 2 + ba[2] ** 2)))
    return Math.hypot(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - r
  },
})
export const smooth = (k: number, ...parts: Sdf[]): Sdf => ({
  mat: 'fur',
  d: (p) => { let sum = 0; for (const s of parts) sum += Math.exp(-s.d(p) / k); return -k * Math.log(sum) },
})
export const roundBox = (c: V3, half: V3, r: number): Sdf => ({
  mat: 'fur',
  d: (p) => {
    const q: V3 = [Math.abs(p[0] - c[0]) - half[0] + r, Math.abs(p[1] - c[1]) - half[1] + r, Math.abs(p[2] - c[2]) - half[2] + r]
    return Math.hypot(Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)) + Math.min(Math.max(q[0], q[1], q[2]), 0) - r
  },
})
export const cutBelow = (s: Sdf, z: number): Sdf => ({ mat: s.mat, d: (p) => Math.max(s.d(p), z - p[2]) })
export const E = (c: V3, r: V3, mat = 'fur') => ellipsoid(c, r, mat)
export const asHead = (s: Sdf): Sdf => ({ mat: 'head', d: s.d })

// ---------------------------------------------------------------- body plans (cat faces +x, z up)

export interface Plan {
  name: string
  head: Sdf
  /** Head centre, front of the face (x), eye spacing (y), eye height (z): where the eyes get stamped. */
  face: { c: V3; front: number; eyeY: number; eyeZ: number }
  body: Sdf[]
  ears: Sdf[]
  /** Height the camera centres on. */
  mid: number
}

/** Small rounded ears on top of a head. */
const ears = (c: V3, y: number, z: number, size: number, x = -0.4): Sdf[] =>
  [-1, 1].map((s) => asHead(cutBelow(E([c[0] + x, s * y, z], [size * 0.9, size * 1.05, size * 1.6]), z - size * 0.8)))

/** A small sitting body: torso with stubby arms, feet and a tail, all blended into one soft mass. */
export function smallBody(top: number, w: number, k = 1.2): Sdf[] {
  return [smooth(k,
    E([0, 0, top * 0.5], [w * 0.8, w, top * 0.5]),
    ...[-1, 1].map((s) => capsule([0.4, s * w * 0.85, top * 0.75], [w * 0.8, s * w * 0.7, top * 0.3], w * 0.28)),
  ), ...[-1, 1].map((s) => E([w * 0.75, s * w * 0.48, 0.95], [w * 0.5, w * 0.4, 0.95], 'feet')), ...tail(w, top)]
}

export type TailStyle = 'swoop' | 'curl' | 'plume' | 'bolt' | 'none' | 'puff' | 'pig' | 'mouse' | 'fox' | 'dog' | 'lizard'

/** A tapered tube through `pts`, radius easing from r0 at the root to r1 at the tip. */
export function tube(pts: V3[], r0: number, r1: number): Sdf {
  const segs: Sdf[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const t = i / Math.max(1, pts.length - 2)
    segs.push(capsule(pts[i], pts[i + 1], r0 + (r1 - r0) * t))
  }
  return { mat: 'tail', d: smooth(0.35, ...segs).d }
}

/**
 * Tails, mostly seen from behind (the cat faces +x, so behind is -x):
 * swoop  a long S that sweeps out and up beside the body
 * curl   a question mark rising tall behind the head
 * plume  a fat bushy fox tail with a puff at the end
 * bolt   a zigzag lightning-bolt tail
 */
export function tail(w: number, top: number, style: TailStyle = 'swoop'): Sdf[] {
  // every tail swung round from straight out at the side to a diagonal toward the back
  const SWING = 0.55, cx = -1.4, cy = 1, c = Math.cos(-SWING), sn = Math.sin(-SWING)
  return tailShape(w, top, style).map((t) => ({ mat: t.mat, d: (p: V3) => t.d([cx + (p[0] - cx) * c - (p[1] - cy) * sn, cy + (p[0] - cx) * sn + (p[1] - cy) * c, p[2]]) }))
}
function tailShape(w: number, _top: number, style: TailStyle = 'swoop'): Sdf[] {
  // the big cube head is ~15 wide, so a tail has to sweep out past y = 8 to show at all
  const r = w * 0.42
  switch (style) {
    case 'curl': // a question mark standing beside the cat
      return [tube([[-1.4, 1, 1.4], [-2, 6, 1.8], [-2, 10, 4.6], [-2, 11.2, 8.6], [-2, 9.8, 11.6], [-2, 8.2, 10.6], [-2, 8.4, 9]], r, r * 0.85)]
    case 'plume': // a fat bushy fox tail with a puff at the end
      return [tube([[-1.4, 1, 1.4], [-2, 5, 1.8], [-2, 8.6, 4.4], [-2, 10.2, 8]], r, r * 1.8), E([-2, 10.4, 9.6], [2.2, 2.4, 2.8], 'tail')]
    case 'bolt': // a zigzag lightning bolt
      return [tube([[-1.4, 1, 1.4], [-2, 5.4, 1.6], [-2, 9.6, 3.2], [-2, 7.4, 6.6], [-2, 11.2, 8.2], [-2, 9.4, 12.4]], r, r * 0.8)]
    case 'none':
      return []
    case 'puff': // a round cotton-ball tail (bunny, bear)
      return [E([-2.4, 0, 2.2], [1.8, 1.8, 1.8], 'tail')]
    case 'pig': // a little corkscrew
      return [tube(Array.from({ length: 9 }, (_, k) => { const a = k * 0.85; return [-2.4 - k * 0.12, 0.5 + Math.cos(a) * 0.9, 3 + Math.sin(a) * 0.9 + k * 0.15] as V3 }), 0.45, 0.4)]
    case 'mouse': // long and thin, swinging out wide and up
      return [tube([[-1.4, 0.6, 1.2], [-2.6, 4, 0.8], [-2.6, 8.4, 1.4], [-2.2, 11.4, 4], [-2, 12, 7.4]], 0.45, 0.3)]
    case 'fox': // a huge bushy brush with a pale tip
      return [tube([[-1.4, 1, 1.6], [-2.4, 4.6, 2], [-2.4, 8, 4.4], [-2.2, 9.6, 7.6]], r * 1.2, r * 2.6), E([-2.2, 9.8, 8.8], [2.6, 2.8, 2.8], 'tail')]
    case 'dog': // a short tail up in a happy hook
      return [tube([[-1.4, 0.8, 2.2], [-2.6, 2.4, 3.6], [-3, 3.6, 6], [-2.4, 4.6, 7.4]], r * 1.1, r * 0.8)]
    case 'lizard': // a long heavy tail dragging out behind
      return [tube([[-1.4, 0, 1.6], [-3.6, 1.6, 1.2], [-5.4, 4.4, 0.9], [-6.2, 7.6, 0.7], [-6.4, 10.6, 0.6]], r * 1.5, r * 0.4)]
    default: // swoop: a long S
      return [tube([[-1.4, 1, 1.2], [-1.6, 5, 1.5], [-1.4, 9, 3.6], [-1.6, 10.4, 7.4], [-1.2, 8.8, 10.6], [-1.4, 9.8, 12.4]], r, r * 0.8)]
  }
}

/** Kept for per-cat tuning; dark areas are drawn as outlined paper now, with soft edge shading. */
export type Screen = 't25' | 't37' | 't50'

export const PLANS: Plan[] = [
  (() => {
    const c: V3 = [0, 0, 13.6]
    return { name: 'CUBE HEAD', head: asHead(roundBox(c, [5.6, 6.6, 5.4], 3)), face: { c, front: 5.6, eyeY: 2.6, eyeZ: 0.4 }, body: smallBody(8.4, 3.4), ears: ears(c, 4.4, c[2] + 5.2, 2.1), mid: 10.5 }
  })(),
  (() => {
    const c: V3 = [0, 0, 14.6]
    return { name: 'BALLOON', head: asHead(E(c, [6.4, 7.6, 6.4])), face: { c, front: 6.4, eyeY: 2.8, eyeZ: 0 }, body: smallBody(8.4, 2.8), ears: ears(c, 4.6, c[2] + 5.4, 2), mid: 11 }
  })(),
  (() => {
    const c: V3 = [0, 0, 14]
    return { name: 'BIG CUBE', head: asHead(roundBox(c, [6.2, 7.6, 6], 3.6)), face: { c, front: 6.2, eyeY: 3, eyeZ: 1.4 }, body: smallBody(7.6, 2.6), ears: ears(c, 5.2, c[2] + 5.8, 2.3), mid: 11.6 }
  })(),
  (() => {
    const c: V3 = [0, 0, 13.4]
    // head and body melt into one soft lump
    return { name: 'MOCHI', head: asHead(E(c, [5.6, 6.4, 5.2])), face: { c, front: 5.6, eyeY: 2.4, eyeZ: 0.2 }, body: [E([0, 0, 4.6], [4.4, 5.2, 4.6]), ...[-1, 1].map((s) => E([3.8, s * 2.6, 0.9], [1.8, 1.5, 0.9], 'feet')), capsule([-4.2, 0, 1.6], [-6.2, 1, 6], 1)], ears: ears(c, 3.8, c[2] + 4.6, 2), mid: 9.5 }
  })(),
  (() => {
    const c: V3 = [0, 0, 15.6]
    return { name: 'BEAN', head: asHead(E(c, [4.8, 5.4, 4.6])), face: { c, front: 4.8, eyeY: 2, eyeZ: 0 }, body: smallBody(11, 3.4, 1.4), ears: ears(c, 3.2, c[2] + 4, 1.8), mid: 10.5 }
  })(),
  (() => {
    const c: V3 = [0, 0, 12.8]
    return { name: 'POTATO', head: asHead(roundBox(c, [5.2, 6.2, 4.2], 2.6)), face: { c, front: 5.2, eyeY: 2.4, eyeZ: 0 }, body: [smooth(1.6, roundBox([0, 0, 4.4], [4, 5, 4.4], 2.6), ), ...[-1, 1].map((s) => E([3.6, s * 2.4, 0.9], [1.8, 1.5, 0.9], 'feet')), capsule([-3.6, 0, 1.4], [-5.6, 1, 5.6], 0.9)], ears: ears(c, 4.2, c[2] + 3.8, 1.9), mid: 9 }
  })(),
]

// ---------------------------------------------------------------- render

export const rot = (p: V3, a: number): V3 => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]]

// the iso camera from iso.ts, for projecting eye positions onto the sprite
const EL = Math.PI / 6
const CA = Math.cos(EL) / Math.SQRT2
const BZ = Math.sin(EL)
export const CAM_R: V3 = [Math.SQRT1_2, -Math.SQRT1_2, 0]
export const CAM_U: V3 = [-Math.SQRT1_2 * BZ, -Math.SQRT1_2 * BZ, 2 * Math.SQRT1_2 * CA]
export const CAM_D: V3 = [-CA, -CA, -BZ]
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * The face: idle (2x4 eyes), closed (blink / chewing), happy (^ ^), joy (^ ^ and an open mouth),
 * surprised (shrunk pupils, an o mouth), sleepy (half-lidded), dead (X eyes), fierce (slanted).
 */
export type Mood = 'idle' | 'closed' | 'happy' | 'joy' | 'surprised' | 'sleepy' | 'dead' | 'fierce'
export const MOODS: Mood[] = ['idle', 'closed', 'happy', 'joy', 'surprised', 'sleepy', 'dead', 'fierce']
// render box and world units per pixel; the game export draws bigger (see CATS_GAME)
export let W = 40
export let HH = 52
export let SCALE = 0.62
/** How far the render box's centre is raised (model units), to make room above the head. */
let LIFT = 0
/**
 * Change the render box (the game and previewer draw at 1.5x the concept sheets). `top` and
 * `bottom` add that many native rows above (tall hats) and below (cats rolling about); the cat
 * itself stays where it was.
 */
export function setRenderSize(w: number, h: number, scale: number, top = 0, bottom = 0): void {
  W = w; HH = h + top + bottom; SCALE = scale
  LIFT = ((top - bottom) / 2) * scale / CAM_U[2]
}

/** Native render, then halved (2x2 blocks, interior lines dropped, fresh silhouette outline), eyes stamped in. */
/** Gear for a dressed cat: 3D parts on the head, plus face marks stamped in 2D like the eyes. */
export type Coat = 'white' | 'black' | 'tux' | 'calico' | 'tabby' | 'tabbyInv' | 'siamese' | 'cow' | 'socks' | 'spots' | 'dots' | 'van' | 'mustache' | 'heart' | 'checker' | 'mitts' | 'tattoo' | 'halfback' | 'tortie' | 'tips' | 'skull' | 'irezumi' | 'tuxcal'
export interface Look {
  /** Bold: the coat is filled solid (black fur stays black) and the eyes go white. */
  bold?: boolean
  /** Tail colouring, independent of the coat. */
  tailTone?: 'black' | 'tip' | 'bands'
  /** A little shirt on the body. */
  shirt?: 'breton' | 'tee' | 'crop'
  /** The accessory covers the eyes (shades): don't draw them. */
  hideEyes?: boolean
  /** The accessory replaces the ears (a helmet that rises where they'd be): don't model them. */
  hideEars?: boolean
  coat?: Coat
  parts?: Sdf[]
  headDark?: boolean
  bodyDark?: boolean
  /** The clothes hang (capes, coats): on a build pinched in below, they fall from the widest point above rather than following it in. */
  hangs?: boolean
  face?: ('shades' | 'round' | 'surgical' | 'star' | 'patch' | 'mask' | 'nosering')[]
  tail?: TailStyle
  /** Swap the cat ears for another animal's. */
  ears?: EarStyle
  /** Feet or shoes. */
  feet?: FeetStyle
  /** The clothes' shapes (also in `parts`): accessory pixels inside these get the clothes colour. */
  clothes?: Sdf[]
  /** Body build: everything below the head (body, feet, tail root, clothes) widens to fit. */
  body?: BodyShape
  screen?: Screen
}

/** Within r of the polyline pts (in the plane of two coordinates). */
const nearPath = (u: number, v: number, pts: [number, number][], r: number) => pts.slice(1).some(([u1, v1], i) => {
  const [u0, v0] = pts[i]
  const du = u1 - u0, dv = v1 - v0
  const t = Math.max(0, Math.min(1, ((u - u0) * du + (v - v0) * dv) / (du * du + dv * dv)))
  return Math.hypot(u - u0 - du * t, v - v0 - dv * t) < r
})

/** Fur colours and markings, as solid ink regions (no halftone) in model space. */
export function coatMats(pl: Plan, look: Look): Record<string, Material> {
  const c = pl.face.c
  const coat = look.coat ?? (look.headDark ? 'black' : 'white')
  const ink = (on: boolean) => (on ? 1 : null)
  // accent markings: a second marking colour (2 = ink in one-bit, its own ramp in colour)
  const acc = (on: boolean) => (on ? 2 : null)
  // tortoiseshell: soft mottled patches of both marking colours over everything
  // tortoiseshell: main-colour coat broken up by round accent blotches
  const BLOTCH = [[5, -4, 4, 2.4], [3, 4.6, 7, 2.2], [-2, 7, 1, 3], [-6, -3, 5, 3], [-1, -7.4, -2, 2.6], [0, 1, 8, 2.4], [-6, 4, -3, 2.6], [4, 7, -2, 2], [-3, -2, 0, 2.4]]
  const mottle = (x: number, y: number, z: number) => (BLOTCH.some(([bx, by, bz, r]) => Math.hypot(x - bx, y - by, z - bz) < r) ? 2 : 1)
  const head = (p: V3): number | null => {
    const q: V3 = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    const front = q[0] > 2.6
    switch (coat) {
      case 'black': return 1
      case 'tux': return front && q[2] < -0.6 && Math.abs(q[1]) < 4.2 ? 0 : 1 // white muzzle
      // tortie tux: the tuxedo's white muzzle, the rest mostly the dark (accent) colour mottled with tortoiseshell
      // patches in the markings colour
      case 'tuxcal': return front && q[2] < -0.6 && Math.abs(q[1]) < 4.2 ? 0 : mottle(q[0], q[1], q[2]) === 2 ? 1 : 2
      // calico: a main-colour patch on one side (wrapping right round that eye, which goes white)
      // and an accent patch on the other
      case 'calico': return (q[1] > 0.8 && q[2] > 0.6) || (front && Math.hypot((q[1] - 3) / 2.7, (q[2] - 1.2) / 3.4) < 1) ? 1 : acc((q[1] < -3 && q[0] < 0 && q[2] > -2) || (q[1] < -2.6 && q[2] > 3.4))
      case 'tortie': return front && q[2] < 1.2 && Math.abs(q[1]) < 4 ? null : mottle(q[0], q[1], q[2])
      case 'tabby': return ink(q[2] > 2.2 && Math.abs(q[1]) < 4 && ((q[1] + 8) % 2.6) < 1.1 || (Math.abs(q[1]) > 6.4 && Math.abs(q[2] + 0.4) < 0.6))
      case 'tabbyInv':
        // black with white stripes; the lower head (from the eyes down) stays white
        if (q[2] < 3.2) return 0
        return q[2] > 5.4 && Math.abs(q[1]) < 4.4 && ((q[1] + 8) % 2.9) < 1.1 ? 0 : 1
      case 'socks': return 1
      case 'siamese': return ink(q[2] > 6 || (front && Math.hypot(q[1] / 3.4, (q[2] + 1.6) / 3) < 1))
      case 'cow': return ink(Math.hypot(q[1] + 3.4, q[2] - 3) < 2.8 || Math.hypot(q[1] - 4, q[0] + 2, q[2] + 1) < 3)
      // big bold spots, all round the head (none across the eyes)
      // (every other spot is in the accent colour)
      case 'spots': { const k = [[4.2, -5.2, 6, 2.6], [1.4, 3.6, 6, 2.6], [-1.6, 7.6, 0.4, 2.8], [-6.2, -2.4, 1.6, 3], [-0.4, -7.6, -2.6, 2.4], [6.2, 4.8, -3.6, 1.8]].findIndex(([x, y, z, r]) => Math.hypot(q[0] - x, q[1] - y, q[2] - z) < r); return k < 0 ? null : k % 2 === 0 ? 1 : 2 }
      // lots of little spots, like a leopard kitten
      // tattoo: a Ziggy lightning bolt slashed down the face over one eye
      case 'tattoo': return ink(front && nearPath(q[1], q[2], [[-0.6, 7], [-3.8, 1.8], [-1.8, 1.6], [-5, -4.4]], 1.05))
      // irezumi: the face stays clean, the tattoos are all on the body
      case 'irezumi': return null
      // skull: a black cat (in the accent colour, so it stays dark in any palette) with a plain white skull
      // painted on its face: a round cranium and a narrower jaw, the cat's own dark eyes, a little nose, a
      // stitched grin. Nothing else, so it reads at sprite size.
      case 'skull': {
        const face = front && (Math.hypot(q[1] / 5.4, (q[2] - 1.2) / 4.4) < 1 || (Math.abs(q[1]) < 3.4 && q[2] > -4.4 && q[2] < 0))
        if (!face) return 2
        const nose = q[2] < -0.8 && q[2] > -2 && Math.abs(q[1]) < (q[2] + 2) * 0.8
        const grin = Math.abs(q[1]) < 3 && (Math.abs(q[2] + 3.2) < 0.4 || (Math.abs(q[2] + 3.2) < 1 && Math.abs(Math.abs(q[1]) - 1.5) < 0.35) || (Math.abs(q[2] + 3.2) < 1 && Math.abs(q[1]) < 0.35))
        return acc(nose || grin)
      }
      // halftone back: a dot screen that grows denser toward the back of the head
      case 'halfback': {
        if (q[0] > -1) return null
        const r = Math.min(1, (-q[0] - 1) / 5) * 0.75
        return ink(Math.hypot(((q[1] + 41.2) % 2.4) - 1.2, ((q[2] + 41.2) % 2.4) - 1.2) < r)
      }
      // mitts: white, with black ears (plus black paws and tail)
      case 'mitts': return ink(q[2] > 6.4)
      // just the tips of the ears dark
      case 'tips': return ink(q[2] > 8.4)
      // van: colour only on the very top of the head (and the tail)
      case 'van': return ink(q[2] > 4.4)
      // a curly black handlebar mustache under the nose
      case 'mustache': return ink(front && Math.abs(q[1]) > 0.5 && Math.abs(q[1]) < 5 && Math.abs(q[2] - (-2.6 + 0.16 * (Math.abs(q[1]) - 2.6) ** 2)) < 0.65)
      // a heart-shaped patch on the forehead
      case 'heart': {
        if (!front) return null
        // a big bold heart round one eye (the eye shines white inside it)
        const x = (q[1] - 3.2) / 3.4
        const y = (q[2] - 2.2) / 3.2
        return ink((x * x + y * y - 1) ** 3 - x * x * y * y * y < 0)
      }
      // a punk checkerboard band round the top of the head
      case 'checker': return ink(q[2] > 3.6 && q[2] < 6.6 && (Math.floor((q[0] + 40) / 1.8) + Math.floor((q[1] + 40) / 1.8) + Math.floor((q[2] + 40) / 1.8)) % 2 === 0)
      case 'dots': return ink(!(front && Math.abs(q[2] - 1.4) < 2.4) && Math.hypot(((q[0] + 41) % 4) - 2, ((q[1] + 41) % 4) - 2, ((q[2] + 41) % 4) - 2) < 1.25)
      default: return null
    }
  }
  const body = (p: V3): number | null => {
    if (look.bodyDark) return 1
    if (look.shirt === 'tee') return 1
    // a crop top: the tee's dark over the chest and shoulders, belly showing below
    if (look.shirt === 'crop' && p[2] > 3.4) return 1
    if (look.shirt === 'breton') return ((p[2] + 20) % 1.9) < 0.75 ? 1 : 0
    switch (coat) {
      case 'black': return 1
      case 'tux': return p[0] > 1.2 && Math.abs(p[1]) < 1.4 ? 0 : 1 // white bib
      case 'tuxcal': return p[0] > 1.2 && Math.abs(p[1]) < 1.4 ? 0 : mottle(p[0] * 1.4, p[1] * 1.4, p[2] + 2) === 2 ? 1 : 2
      // irezumi: the body covered in bold flowing wave tattoos
      // (two big bold swooping bands, not lots of little waves)
      case 'irezumi': return ink(((p[2] * 0.7 + Math.sin(p[1] * 0.6 + p[0] * 0.3) * 1.6 + 20) % 4.6) < 2.3)
      // skeleton: a black body with white ribs across the chest
      case 'skull': return p[0] > 0.4 && p[2] > 2.2 && p[2] < 7 && ((p[2] + 20) % 1.5) < 0.7 && Math.abs(p[1]) < 2 ? 0 : 2
      case 'tabbyInv': return ((p[2] + 20) % 2.4) < 0.9 ? 0 : 1
      case 'socks': return 1
      case 'checker': return ink((Math.floor((p[1] + 40) / 1.6) + Math.floor((p[2] + 40) / 1.6)) % 2 === 0)
      // a heart tattoo on the chest with a banner across it
      case 'tattoo': {
        if (p[0] < 1.4) return null
        const x = p[1] / 1.4
        const y = (p[2] - 5.6) / 1.4
        return ink((x * x + y * y - 1) ** 3 - x * x * y * y * y < 0 || (Math.abs(p[2] - 5.2) < 0.35 && Math.abs(p[1]) < 2.4))
      }
      case 'halfback': {
        if (p[0] > 0) return null
        const r = Math.min(1, -p[0] / 2.6) * 0.6
        return ink(Math.hypot(((p[1] + 41) % 2) - 1, ((p[2] + 41) % 2) - 1) < r)
      }
      case 'calico': return p[1] < -0.6 && p[0] < 0.6 ? 2 : ink(p[1] > 0.8 && p[0] < -0.4 && p[2] > 3)
      case 'tortie': return mottle(p[0] * 1.4, p[1] * 1.4, p[2] + 2)
      case 'cow': return ink(Math.hypot(p[1] - 1.4, p[2] - 4) < 1.8)
      case 'spots': return Math.hypot(p[1] + 1.6, p[2] - 4.6) < 1.6 ? 1 : acc(Math.hypot(p[0] + 1.6, p[1] - 1.8, p[2] - 2.6) < 1.5)
      case 'dots': return ink(Math.hypot(((p[0] + 41) % 3.4) - 1.7, ((p[1] + 41) % 3.4) - 1.7, ((p[2] + 41) % 3.4) - 1.7) < 1.05)
      default: return null
    }
  }
  const darkTail = coat === 'black' || coat === 'tux' || coat === 'siamese' || coat === 'calico' || coat === 'tabbyInv' || coat === 'van' || coat === 'mitts'
  const tailTone = (p: V3): number | null => {
    // the tip is everything above z 8.6 (all the tails rise to ~10-12)
    if (coat === 'tortie') return p[2] > 8.6 ? 2 : 1
    if (coat === 'tuxcal') return p[2] > 8.6 ? 0 : 2 // dark, a white tip
    if (look.tailTone === 'tip' || coat === 'socks') return p[2] > 8.6 ? 0 : coat === 'calico' ? 2 : 1
    if (look.tailTone === 'bands' || coat === 'tabby') return ink((p[2] + 10) % 2.4 < 1)
    if (coat === 'skull') return 2
    if (look.tailTone === 'black') return 1
    return darkTail ? 1 : null
  }
  return {
    head: { dark: 0, pattern: head },
    fur: { dark: 0, pattern: body },
    feet: { dark: 0, pattern: () => (coat === 'black' || coat === 'siamese' || coat === 'tabbyInv' || coat === 'mitts' ? 1 : null) },
    tail: { dark: 0, pattern: tailTone },
    gearK: { dark: 1 },
    gearS: { dark: 1 },
    gearW: { dark: 0 },
  }
}

/**
 * A pose for animation, all about the cat's feet on the floor:
 * - bob: hop height; tilt: lean sideways (radians); squash: squash (negative stretches)
 * - lift: each foot's lift; tail: tail swing about its root, bending to tailTip at the tip (a tip that
 *   lags the root makes a swing flow like a whip); wrap (0..1): tail curled round the feet
 * - pitch: lean forward (radians, negative leans back) about the floor point x = pivot (default the
 *   front of the feet, 2.6)
 * - sit (0..1): fold the body down under the head, the head sinking with it
 * - yaw: twist the whole cat about its own upright axis (a body turn, for swings)
 * - dx, dy: slide the whole cat (to keep a cat that's fallen over in frame); noTail: tuck it away
 */
export interface Pose { bob: number; tilt: number; squash: number; lift: [number, number]; tail: number; pitch?: number; pivot?: number; sit?: number; wrap?: number; dx?: number; dy?: number; noTail?: boolean; tailTip?: number; yaw?: number }
const STILL: Pose = { bob: 0, tilt: 0, squash: 0, lift: [0, 0], tail: 0 }
const ease = (t: number) => t * t * (3 - 2 * t)

const NECK = 8 // the head's underside: below it is body, which `sit` folds down
const foldOf = (P: Pose) => (P.sit ?? 0) * (NECK - 0.9) / NECK // how much of the body's height goes
// a folded body squishes out sideways (a negative `sit` stretches the body taller: big builds)
const bulgeOf = (P: Pose) => 1 + Math.max(0, P.sit ?? 0) * 0.55
/** Model space -> posed: fold, squash, pitch, lean, slide/hop. */
export function poseForward(P: Pose, p: V3): V3 {
  const fold = foldOf(P), bulge = bulgeOf(P)
  const yw = P.yaw ?? 0
  let x = p[0] * Math.cos(yw) - p[1] * Math.sin(yw), y = p[0] * Math.sin(yw) + p[1] * Math.cos(yw)
  let z = p[2] < NECK ? p[2] * (1 - fold) : p[2] - NECK * fold
  if (p[2] < NECK) { x *= bulge; y *= bulge }
  z *= 1 - P.squash
  const pv = P.pivot ?? 2.6, ph = P.pitch ?? 0
  const cp = Math.cos(ph), sp = Math.sin(ph)
  const xx = pv + (x - pv) * cp + z * sp
  z = -(x - pv) * sp + z * cp
  const c = Math.cos(P.tilt), si = Math.sin(P.tilt)
  return [xx + (P.dx ?? 0), y * c - z * si + (P.dy ?? 0), y * si + z * c + P.bob]
}
/** Posed -> model space: the exact inverse of poseForward. */
export function poseInverse(P: Pose, p: V3): V3 {
  const fold = foldOf(P), bulge = bulgeOf(P)
  let z = p[2] - P.bob
  const py = p[1] - (P.dy ?? 0)
  const c = Math.cos(-P.tilt), si = Math.sin(-P.tilt)
  const y = py * c - z * si
  z = py * si + z * c
  const pv = P.pivot ?? 2.6, ph = P.pitch ?? 0
  const cp = Math.cos(-ph), sp = Math.sin(-ph)
  const px = p[0] - (P.dx ?? 0)
  const x = pv + (px - pv) * cp + z * sp
  z = -(px - pv) * sp + z * cp
  z /= 1 - P.squash
  const low = NECK * (1 - fold)
  const m: V3 = z < low ? [x / bulge, y / bulge, z / (1 - fold)] : [x, y, z + NECK * fold]
  const yw = -(P.yaw ?? 0)
  return [m[0] * Math.cos(yw) - m[1] * Math.sin(yw), m[0] * Math.sin(yw) + m[1] * Math.cos(yw), m[2]]
}
/** A direction (no fold or squash), posed: for the face's normal. */
const poseDir = (P: Pose, n0: V3): V3 => {
  const yw = P.yaw ?? 0
  const n: V3 = [n0[0] * Math.cos(yw) - n0[1] * Math.sin(yw), n0[0] * Math.sin(yw) + n0[1] * Math.cos(yw), n0[2]]
  const ph = P.pitch ?? 0
  const x = n[0] * Math.cos(ph) + n[2] * Math.sin(ph)
  const z = -n[0] * Math.sin(ph) + n[2] * Math.cos(ph)
  return [x, n[1] * Math.cos(P.tilt) - z * Math.sin(P.tilt), n[1] * Math.sin(P.tilt) + z * Math.cos(P.tilt)]
}
// a rough hull of the cat (head box, body, feet) for settling poses on the floor
const HULL: V3[] = [
  ...[-5.6, 5.6].flatMap((x) => [-7, 7].flatMap((y) => [9, 19.4].map((z): V3 => [x, y, z]))),
  ...[-6.2, 6.2].flatMap((x) => [-4, 4].map((y): V3 => [x, y, 14])),
  [0, -7.6, 14], [0, 7.6, 14],
  [2.4, -1.4, 0], [2.4, 1.4, 0], [-1.8, 0, 0.4], [0, -2.6, 3.8], [0, 2.6, 3.8],
]
/**
 * Keep a pose on the floor (and, if `center`, in frame): lifts it so its lowest point rests at
 * z = 0, then hops by `hop` on top; slides it back to the middle when it has fallen over.
 */
export function settle(P: Pose, hop = 0, center = true): Pose {
  const pts = HULL.map((h) => poseForward({ ...P, bob: 0, dx: 0, dy: 0 }, h))
  const low = Math.min(...pts.map((q) => q[2]))
  const mid = (k: 0 | 1) => (Math.min(...pts.map((q) => q[k])) + Math.max(...pts.map((q) => q[k]))) / 2
  return { ...P, bob: -low + hop, ...(center ? { dx: -mid(0) * 0.9, dy: -mid(1) * 0.9 } : {}) }
}

/** Keyframes: [t, pose] pairs (t in 0..1), eased between; the pose is merged over STILL. */
type Key = [number, Partial<Pose>]
function keyed(keys: Key[], lag = 0.08): (t: number) => Pose {
  const base = (t: number): Pose => {
    let i = 0
    while (i < keys.length - 1 && keys[i + 1][0] <= t) i++
    const [t0, a] = keys[i]
    const [t1, b] = keys[Math.min(i + 1, keys.length - 1)]
    const k = t1 === t0 ? 0 : ease(Math.min(1, (t - t0) / (t1 - t0)))
    const A = { ...STILL, ...a }, B = { ...STILL, ...b }
    const mix = (u: number, v: number) => u + (v - u) * k
    return {
      bob: mix(A.bob, B.bob), tilt: mix(A.tilt, B.tilt), squash: mix(A.squash, B.squash), tail: mix(A.tail, B.tail),
      lift: [mix(A.lift[0], B.lift[0]), mix(A.lift[1], B.lift[1])],
      pitch: mix(A.pitch ?? 0, B.pitch ?? 0), yaw: mix(A.yaw ?? 0, B.yaw ?? 0), pivot: A.pivot ?? B.pivot, noTail: k < 0.5 ? A.noTail : B.noTail, sit: mix(A.sit ?? 0, B.sit ?? 0), wrap: mix(A.wrap ?? 0, B.wrap ?? 0),
    }
  }
  // follow-through for free: the tail tip is where the root was a moment ago
  return (t) => ({ ...base(t), tailTip: base((t - lag + 1) % 1).tail })
}
const at = <T>(t: number, marks: [number, T][]): T => { let v = marks[0][1]; for (const [m, x] of marks) if (t >= m) v = x; return v }

/** An animation: frame count, the view it plays at, and its pose and face at t in [0, 1). */
export interface Anim { frames: number; angle: number; at: (t: number) => { pose: Pose; mood: Mood; fx?: Fx[] } }

// sack-race hop: crouch (anticipation), spring up stretched and leaning in, hang at the top,
// drop, land squashed and leaning back, settle. Feet together the whole way; the tail lags.
const sackHop = keyed([
  [0, { squash: 0.06, tail: -0.1 }],
  [0.12, { squash: 0.24, sit: 0.16, pitch: -0.06, tail: 0.2 }],
  [0.25, { squash: -0.16, bob: 2.2, pitch: 0.2, lift: [1.4, 1.4], tail: 0.4 }],
  [0.38, { squash: -0.06, bob: 4.6, pitch: 0.14, lift: [1.4, 1.4], tail: 0.1 }],
  [0.55, { squash: 0, bob: 5, pitch: 0.06, lift: [1.4, 1.4], tail: -0.3 }],
  [0.72, { squash: -0.1, bob: 1.8, pitch: -0.04, lift: [0.8, 0.8], tail: -0.5 }],
  [0.8, { squash: 0.26, bob: 0, pitch: -0.1, tail: -0.2 }],
  [1, { squash: 0.06, tail: -0.1 }],
])
// run: lean in, push off stretched, both feet off the floor, land squashed on the other foot
const runPose = (t: number): Pose => {
  const s = Math.sin(t * Math.PI * 2)
  const air = Math.max(0, Math.abs(s) - 0.35) / 0.65
  return { bob: air * 3, tilt: s * 0.1, squash: (1 - Math.abs(s)) ** 2 * 0.2 - air * 0.1, lift: [Math.min(1.4, Math.max(0, s) * 2.4 + air * 0.5), Math.min(1.4, Math.max(0, -s) * 2.4 + air * 0.5)], tail: -0.6 + Math.sin(t * Math.PI * 4 - 1.2) * 0.25, tailTip: -0.8 + Math.sin(t * Math.PI * 4 - 2.4) * 0.35, pitch: 0.2 + air * 0.06 }
}
// lying on its back: sit down, roll back (tail tucked under, feet kept underneath), doze, roll up
const lieKeys = keyed([
  [0, {}],
  [0.1, { sit: 0.45, squash: 0.06, tail: 0.3 }],
  [0.24, { sit: 0.45, pitch: -1.2, pivot: -2.2, noTail: true }],
  [0.3, { sit: 0.35, pitch: -1.62, pivot: -2.2, noTail: true }],
  [0.34, { sit: 0.3, pitch: -1.5, pivot: -2.2, squash: 0.05, noTail: true }],
  [0.74, { sit: 0.3, pitch: -1.5, pivot: -2.2, squash: 0.02, noTail: true }],
  [0.86, { sit: 0.4, pitch: -0.5, pivot: -2.2, noTail: true }],
  [0.94, { squash: 0.12 }],
  [1, {}],
])
// death: hit (recoil), stagger, topple onto its side (falling faster as it goes), bounce, lie still
const D = (k: number) => k / 20
const deathKeys = keyed([
  [0, {}],
  // whack: no wind-up, straight into the hit
  [D(1), { squash: 0.26, tilt: -0.22, pitch: -0.12, tail: 0.8 }],
  [D(2), { squash: 0.12, tilt: -0.1, tail: 0.5 }],
  // a dazed beat
  [D(3), { squash: 0.06, tilt: 0.02, tail: 0.2 }],
  [D(5), { squash: 0.05, tilt: 0.06, tail: 0.1 }],
  // then it sweeps down in one arc, gathering speed
  [D(6), { tilt: 0.3, lift: [0.3, 0], tail: -0.2 }],
  [D(7), { tilt: 0.75, lift: [0.8, 0.3], tail: -0.4 }],
  [D(8), { tilt: 1.25, lift: [1.2, 0.8], tail: -0.2 }],
  [D(9), { tilt: 1.62, lift: [1.4, 1.2], tail: 0.6 }],
  [D(10), { tilt: 1.5, lift: [1.4, 1.4], tail: 0.5 }],
  [D(11), { tilt: 1.57, lift: [1.2, 1.2], tail: 0.4 }],
  [1, { tilt: 1.57, lift: [1.2, 1.2], tail: 0.4 }],
], 0.06)
// thrown back dead: no wind-up; the hit lands, it's flung up and back, lands on its back, one
// bounce, still. `twist` adds a turn from a slash.
const thrownBack = (twist: number) => keyed([
  [0, {}],
  [D(1), { squash: 0.22, pitch: -0.45, yaw: twist, tail: 0.8, pivot: -2.2 }],
  [D(2), { squash: -0.14, pitch: -1.05, yaw: twist * 0.8, lift: [1.4, 1.4], tail: 1, pivot: -2.2 }],
  [D(3), { pitch: -1.5, yaw: twist * 0.5, lift: [1.4, 1.4], noTail: true, pivot: -2.2 }],
  [D(4), { pitch: -1.6, yaw: twist * 0.3, squash: 0.08, lift: [1.4, 1], noTail: true, pivot: -2.2 }],
  [D(5), { pitch: -1.48, yaw: twist * 0.2, lift: [1, 1.4], noTail: true, pivot: -2.2 }],
  [D(6), { pitch: -1.6, yaw: twist * 0.2, lift: [1.3, 1.2], noTail: true, pivot: -2.2 }],
  [D(7), { pitch: -1.57, yaw: twist * 0.2, lift: [1.2, 1.2], noTail: true, pivot: -2.2 }],
  [1, { pitch: -1.57, yaw: twist * 0.2, lift: [1.2, 1.2], noTail: true, pivot: -2.2 }],
], 0.08)
const slashDeathKeys = thrownBack(0.4)
const shotDeathKeys = thrownBack(0)
const thrownHop = (t: number) => at(Math.round(t * 20), [[0, 0], [1, 0.8], [2, 3.4], [3, 2.2], [4, 0], [5, 1], [6, 0]])
// knockback: a hit snaps it back, it's flung up and over (two frames in the air), slams onto its
// back, one bounce, then a little reverb wobble and still. Every frame is a key: snappy.
const BK = { pivot: -2.2 }
const KB = (k: number) => k / 10
const knockKeys = keyed([
  [0, {}],
  [KB(1), { squash: 0.26, pitch: -0.4, tail: 0.8, ...BK }],
  [KB(2), { squash: -0.14, pitch: -1.3, lift: [1.4, 1.4], noTail: true, ...BK }],
  [KB(3), { pitch: -1.57, squash: 0.12, lift: [1.4, 1], noTail: true, ...BK }],
  [KB(4), { pitch: -1.44, lift: [1, 1.4], noTail: true, ...BK }],
  [KB(5), { pitch: -1.63, lift: [1.4, 1.1], noTail: true, ...BK }],
  [KB(6), { pitch: -1.52, lift: [1.2, 1.3], noTail: true, ...BK }],
  [KB(7), { pitch: -1.59, lift: [1.2, 1.2], noTail: true, ...BK }],
  [KB(8), { pitch: -1.57, lift: [1.2, 1.2], noTail: true, ...BK }],
  [1, { pitch: -1.57, lift: [1.2, 1.2], noTail: true, ...BK }],
], 0.1)
const knockHop = (t: number) => at(Math.round(t * 10), [[0, 0], [2, 4.4], [3, 0], [4, 1.4], [5, 0], [6, 0.3], [7, 0]])
// faceplant (exasperated): a big sigh (sag, eyes drop), a slow teeter back and forth, then it just
// tips over onto its face, slowly at first, plop, and lies there still
const FP = (k: number) => k / 24
const faceplantKeys = keyed([
  [0, {}],
  [FP(3), { squash: 0.12, sit: 0.1, tail: -0.3 }],
  [FP(5), { squash: 0.08, sit: 0.08, pitch: 0.06, tail: -0.2 }],
  [FP(7), { squash: 0.08, sit: 0.08, pitch: -0.05, tail: -0.1 }],
  [FP(9), { squash: 0.08, sit: 0.08, pitch: 0.1, tail: -0.2 }],
  [FP(11), { squash: 0.06, sit: 0.06, pitch: 0.24, tail: -0.3 }],
  [FP(12), { squash: 0.04, pitch: 0.45, tail: -0.3 }],
  [FP(13), { pitch: 0.85, lift: [0.4, 0.4], tail: -0.1 }],
  [FP(14), { pitch: 1.35, lift: [0.8, 0.8], tail: 0.4 }],
  [FP(15), { pitch: 1.57, lift: [0.5, 0.5], tail: 0.2 }],
  [1, { pitch: 1.57, lift: [0.5, 0.5], tail: 0.2 }],
], 0.06)
// the bounce on top of the floor contact: knocked up by the hit, two bounces after landing
const deathHop = (t: number) => at(Math.round(t * 20), [[0, 0], [1, 0.6], [2, 0], [10, 1], [11, 0]])
// slash: neutral, wind up, strike (fast, 1 frame), follow-through hold, slow recover
const slashKeys = keyed([
  [0, {}],
  [2 / 14, { tilt: -0.16, pitch: -0.2, squash: 0.12, sit: 0.12, tail: -0.4 }],
  [3 / 14, { tilt: 0.1, pitch: 0.3, squash: -0.14, bob: 0.8, tail: 0.3 }],
  [4 / 14, { tilt: 0.16, pitch: 0.36, squash: -0.04, bob: 0.3, tail: 0.6 }],
  [7 / 14, { tilt: 0.14, pitch: 0.32, squash: 0.04, tail: 0.5 }],
  [11 / 14, { tilt: 0, pitch: 0.04, squash: 0.06 }],
  [1, {}],
], 0.07)
const sweepKeys = keyed([
  [0, {}],
  [2 / 16, { yaw: -0.6, squash: 0.08, tilt: -0.06, tail: -0.5 }],
  [3 / 16, { yaw: -0.95, squash: 0.16, sit: 0.14, tilt: -0.1, pitch: -0.08, tail: -0.8 }],
  [4 / 16, { yaw: 0.2, squash: -0.12, pitch: 0.12, bob: 0.5, tail: 0 }],
  [5 / 16, { yaw: 0.85, squash: -0.04, pitch: 0.16, tail: 0.7 }],
  [6 / 16, { yaw: 1.05, squash: 0.04, pitch: 0.14, tilt: 0.06, tail: 0.9 }],
  [10 / 16, { yaw: 0.95, squash: 0.06, pitch: 0.1, tilt: 0.04, tail: 0.7 }],
  [13 / 16, { yaw: 0.1, squash: 0.04 }],
  [1, {}],
], 0.07)
const slash2Keys = keyed([
  [0, {}],
  [2 / 14, { yaw: -0.55, squash: 0.12, sit: 0.1, tilt: -0.08, tail: -0.6 }],
  [3 / 14, { yaw: 0.45, squash: -0.1, pitch: 0.16, bob: 0.6, tail: 0.2 }],
  [4 / 14, { yaw: 0.62, squash: -0.02, pitch: 0.18, tail: 0.6 }],
  [7 / 14, { yaw: 0.55, squash: 0.05, pitch: 0.12, tail: 0.5 }],
  [11 / 14, { yaw: 0.05, squash: 0.04 }],
  [1, {}],
], 0.07)
const punchKeys = keyed([
  [0, {}],
  [1 / 12, { pitch: -0.12, squash: 0.08, tail: 0.3 }],
  [2 / 12, { pitch: -0.24, squash: 0.18, sit: 0.12, yaw: -0.25, tail: 0.5 }],
  [3 / 12, { pitch: 0.34, squash: -0.16, bob: 0.8, yaw: 0.2, tail: -0.2 }],
  [4 / 12, { pitch: 0.42, squash: -0.06, bob: 0.4, yaw: 0.3, tail: -0.5 }],
  [5 / 12, { pitch: 0.38, squash: 0.04, yaw: 0.25 }],
  [7 / 12, { pitch: 0.36, squash: 0.03, yaw: 0.22 }],
  [9 / 12, { pitch: 0.06, squash: 0.06 }],
  [1, {}],
], 0.07)
// one-two, left then right: the jab off one shoulder, then load the other and throw the cross
const punch2Keys = keyed([
  [0, {}],
  [1 / 16, { pitch: -0.1, squash: 0.1, yaw: 0.1, tail: 0.3 }],
  [2 / 16, { pitch: 0.24, squash: -0.1, bob: 0.4, yaw: 0.38, tail: -0.1 }],
  [3 / 16, { pitch: 0.26, squash: -0.02, yaw: 0.36 }],
  [4 / 16, { pitch: 0.06, squash: 0.06, yaw: 0.2 }],
  [5 / 16, { pitch: -0.18, squash: 0.16, sit: 0.1, yaw: 0.45, tail: 0.5 }],
  [6 / 16, { pitch: 0.3, squash: -0.16, bob: 0.9, yaw: -0.18, tail: -0.3 }],
  [7 / 16, { pitch: 0.3, squash: -0.05, bob: 0.4, yaw: -0.24, tail: -0.6 }],
  [10 / 16, { pitch: 0.26, squash: 0.03, yaw: -0.18 }],
  [13 / 16, { pitch: 0.05, squash: 0.06 }],
  [1, {}],
], 0.07)
const chomp = (k: number): Key[] => [
  [k / 16, { pitch: 0.2, squash: -0.04, bob: 0.3, tail: 0.3 }],
  [(k + 1) / 16, { pitch: 0.08, squash: 0.14, tail: 0.1 }],
  [(k + 2) / 16, { pitch: 0.12, squash: 0.06, tail: -0.1 }],
  [(k + 3) / 16, { pitch: 0.1, squash: 0.1, tail: 0 }],
]
const eatKeys = keyed([...chomp(0), ...chomp(4), ...chomp(8), ...chomp(12), [1, {}]], 0.06)
const spearKeys = keyed([
  [0, {}],
  [2 / 14, { yaw: -0.45, pitch: -0.3, squash: 0.14, sit: 0.08, tail: -0.5 }],
  [3 / 14, { yaw: -0.5, pitch: -0.34, squash: 0.16, sit: 0.1, tail: -0.6 }],
  [4 / 14, { yaw: 0.4, pitch: 0.38, squash: -0.16, bob: 0.8, lift: [0, 1], tail: 0.3 }],
  [5 / 14, { yaw: 0.5, pitch: 0.42, squash: -0.04, bob: 0.3, lift: [0, 0.6], tail: 0.6 }],
  [8 / 14, { yaw: 0.4, pitch: 0.34, squash: 0.04, tail: 0.5 }],
  [11 / 14, { yaw: 0.05, pitch: 0.04, squash: 0.05 }],
  [1, {}],
], 0.07)
// sweeping with a broom: lean in over it and twist side to side with each stroke, a little dip at the
// end of every stroke (the push), the tail swishing the other way
const broomKeys = keyed([
  [0, { yaw: -0.3, pitch: 0.16, squash: 0.04, tail: 0.4 }],
  [3 / 16, { yaw: 0.3, pitch: 0.2, squash: 0.08, bob: -0.3, tail: -0.4 }],
  [4 / 16, { yaw: 0.34, pitch: 0.18, squash: 0.04, tail: -0.5 }],
  [7 / 16, { yaw: -0.3, pitch: 0.2, squash: 0.08, bob: -0.3, tail: 0.4 }],
  [8 / 16, { yaw: -0.34, pitch: 0.18, squash: 0.04, tail: 0.5 }],
  [11 / 16, { yaw: 0.3, pitch: 0.2, squash: 0.08, bob: -0.3, tail: -0.4 }],
  [12 / 16, { yaw: 0.34, pitch: 0.18, squash: 0.04, tail: -0.5 }],
  [15 / 16, { yaw: -0.3, pitch: 0.2, squash: 0.08, bob: -0.3, tail: 0.4 }],
  [1, { yaw: -0.3, pitch: 0.16, squash: 0.04, tail: 0.4 }],
], 0.08)
// party: two quick peppy hops, twisting to each side and firing into the air at the top of each
const partyKeys = keyed([
  [0, { squash: 0.08 }],
  [2 / 16, { squash: 0.22, sit: 0.1, tail: 0.2 }],
  [4 / 16, { squash: -0.14, bob: 3.2, pitch: -0.12, yaw: 0.2, lift: [1.2, 1.2], tail: 0.5 }],
  [6 / 16, { squash: -0.04, bob: 3.6, pitch: -0.08, yaw: 0.22, lift: [1.2, 1.2], tail: 0.2 }],
  [8 / 16, { squash: 0.22, tail: -0.2 }],
  [10 / 16, { squash: 0.22, sit: 0.1, tail: -0.2 }],
  [12 / 16, { squash: -0.14, bob: 3.2, pitch: -0.12, yaw: -0.2, lift: [1.2, 1.2], tail: -0.5 }],
  [14 / 16, { squash: -0.04, bob: 3.6, pitch: -0.08, yaw: -0.22, lift: [1.2, 1.2], tail: -0.2 }],
  [1, { squash: 0.08 }],
], 0.06)
// a little spell: lean back and wiggle while the wand loops, then flick it forward
const wandKeys = keyed([
  [0, {}],
  [3 / 16, { pitch: -0.15, yaw: -0.2, bob: 0.6, tail: 0.3 }],
  [6 / 16, { pitch: -0.1, yaw: 0.2, bob: 1, tail: -0.3 }],
  [9 / 16, { pitch: -0.18, yaw: -0.15, bob: 0.8, tail: 0.3 }],
  [11 / 16, { pitch: 0.25, yaw: 0.1, squash: 0.12, tail: -0.4 }],
  [13 / 16, { pitch: 0.15, squash: 0.04 }],
  [1, {}],
], 0.07)
// watering: leaning over the can, a slow sway as the water goes along the row
const waterKeys = (t: number): Pose => ({ ...STILL, pitch: 0.22 + Math.sin(t * Math.PI * 2) * 0.03, yaw: Math.sin(t * Math.PI * 2) * 0.18, squash: 0.04, tail: Math.sin(t * Math.PI * 2 - 1) * 0.3 })
// digging: heave the hoe up (lean back, up on the toes), chop it down (lean in, squash)
const digKeys = keyed([
  [0, {}],
  [3 / 12, { pitch: -0.3, bob: 1.4, squash: -0.1, tail: 0.4 }],
  [5 / 12, { pitch: -0.34, bob: 1.6, squash: -0.12, tail: 0.5 }],
  [6 / 12, { pitch: 0.42, squash: 0.22, tail: -0.4 }],
  [8 / 12, { pitch: 0.36, squash: 0.12, tail: -0.3 }],
  [1, {}],
], 0.06)
// chopping: twist right back, swing round hard, follow through
const chopKeys = keyed([
  [0, {}],
  [3 / 12, { yaw: -0.5, pitch: -0.1, squash: 0.12, tail: -0.4 }],
  [4 / 12, { yaw: -0.55, pitch: -0.12, squash: 0.14, tail: -0.5 }],
  [5 / 12, { yaw: 0.45, pitch: 0.2, squash: -0.1, tail: 0.5 }],
  [7 / 12, { yaw: 0.4, pitch: 0.15, tail: 0.3 }],
  [1, {}],
], 0.06)
// fishing: rear back, cast, wait (a little bob), the bite (jolt back), settle
const fishKeys = keyed([
  [0, {}],
  [3 / 24, { pitch: -0.3, yaw: -0.2, bob: 0.8, tail: 0.5 }],
  [5 / 24, { pitch: 0.3, yaw: 0.15, squash: 0.1, tail: -0.4 }],
  [7 / 24, { pitch: 0.12, squash: 0.02 }],
  [16 / 24, { pitch: 0.1, squash: 0.03 }],
  [18 / 24, { pitch: -0.25, bob: 1, squash: -0.1, tail: 0.5 }],
  [21 / 24, { pitch: -0.1 }],
  [1, {}],
], 0.07)
// a jump: crouch, spring high, hang, land squashed
const jumpKeys = keyed([
  [0, {}],
  [2 / 12, { squash: 0.28, sit: 0.15, tail: 0.2 }],
  [4 / 12, { squash: -0.2, bob: 6, pitch: -0.1, lift: [1.4, 1.4], tail: 0.5 }],
  [6 / 12, { squash: -0.05, bob: 9, lift: [1.4, 1.4], tail: 0.2 }],
  [8 / 12, { squash: -0.1, bob: 5, lift: [1, 1], tail: -0.3 }],
  [9 / 12, { squash: 0.3, tail: -0.4 }],
  [11 / 12, { squash: 0.05 }],
  [1, {}],
], 0.06)
// hurt: a flinch back from a hit, then shake it off
const hurtKeys = keyed([
  [0, {}],
  [1 / 10, { pitch: -0.32, squash: -0.12, dx: -1.5, tail: 0.6 }],
  [3 / 10, { pitch: -0.2, squash: 0.06, dx: -1, tail: 0.3 }],
  [6 / 10, { pitch: 0.05, squash: 0.04 }],
  [1, {}],
], 0.06)
// a gentle sway for the feelings
const swayKeys = (t: number, amt = 1): Pose => ({ ...STILL, yaw: Math.sin(t * Math.PI * 2) * 0.12 * amt, tilt: Math.sin(t * Math.PI * 2) * 0.05 * amt, squash: Math.sin(t * Math.PI * 4) * 0.03, tail: Math.sin(t * Math.PI * 2 - 1) * 0.35 })
const fireballKeys = keyed([
  [0, {}],
  [1 / 14, { yaw: -0.2, pitch: -0.1, squash: 0.08, tail: -0.3 }],
  [3 / 14, { yaw: -0.5, pitch: -0.28, squash: 0.2, sit: 0.12, tail: -0.6 }],
  [4 / 14, { yaw: 0.35, pitch: 0.4, squash: -0.18, bob: 0.9, tail: 0.5 }],
  [5 / 14, { yaw: 0.45, pitch: 0.44, squash: -0.05, bob: 0.4, tail: 0.7 }],
  [8 / 14, { yaw: 0.38, pitch: 0.34, squash: 0.04, tail: 0.5 }],
  [11 / 14, { yaw: 0.05, pitch: 0.04, squash: 0.06 }],
  [1, {}],
], 0.07)
const beamKeys = keyed([
  [0, {}],
  [2 / 24, { pitch: -0.2, sit: 0.3, squash: 0.12, yaw: -0.3, tail: -0.4 }],
  [8 / 24, { pitch: -0.26, sit: 0.36, squash: 0.16, yaw: -0.36, tilt: 0.04, tail: -0.5 }],
  [9 / 24, { pitch: -0.3, sit: 0.4, squash: 0.18, yaw: -0.4, tilt: -0.04, tail: -0.6 }],
  [10 / 24, { pitch: 0.34, sit: 0.2, squash: -0.12, yaw: 0.2, tail: 0.6 }],
  [11 / 24, { pitch: 0.2, sit: 0.25, squash: 0.04, yaw: 0.15, tail: 0.8 }],
  [13 / 24, { pitch: 0.24, sit: 0.24, squash: 0.02, yaw: 0.16, tilt: 0.04, tail: 0.7 }],
  [15 / 24, { pitch: 0.2, sit: 0.25, squash: 0.04, yaw: 0.15, tilt: -0.04, tail: 0.8 }],
  [19 / 24, { pitch: 0.22, sit: 0.24, yaw: 0.15, tail: 0.6 }],
  [21 / 24, { pitch: 0.04, squash: 0.08 }],
  [1, {}],
], 0.07)
// shoot: three recoils, then a look down at the hands to reload, then back up
// Every frame is its own key (frames sample exactly on keys), so nothing gets smoothed away:
// coil back (anticipation), snap forward to aim, then blam blam blam: each shot one hard kick
// frame, one frame back past centre, one settle. The last kick is the biggest. Reload: duck to
// the hands, slap (click), pop back up, settle with a little bounce.
const F = (k: number) => k / 24
const kick = (k: number, size: number): Key[] => [
  [F(k), { pitch: -0.34 * size, squash: 0.2 * size, bob: 0.7 * size, tilt: -0.05, tail: 0.5 }],
  [F(k + 1), { pitch: 0.12, squash: -0.05, tail: 0.1 }],
  [F(k + 2), { pitch: 0.06, squash: 0.02 }],
]
const shootKeys = keyed([
  [0, {}],
  [F(1), { pitch: -0.14, squash: 0.16, sit: 0.12, tail: 0.3 }],
  [F(2), { pitch: -0.16, squash: 0.18, sit: 0.14, tail: 0.35 }],
  [F(3), { pitch: 0.14, squash: -0.08, bob: 0.4, tail: -0.1 }],
  ...kick(4, 1), ...kick(7, 1), ...kick(10, 1.3),
  [F(13), { pitch: 0.05 }],
  [F(14), { pitch: 0.24, sit: 0.14, squash: 0.06 }],
  [F(15), { pitch: 0.3, sit: 0.16 }],
  [F(17), { pitch: 0.3, sit: 0.16 }],
  [F(18), { pitch: 0.2, sit: 0.1, squash: 0.18 }],
  [F(19), { pitch: -0.04, squash: -0.1, bob: 0.9 }],
  [F(20), { squash: 0.1 }],
  [F(21), { squash: -0.03, bob: 0.2 }],
  [F(22), {}],
  [1, {}],
], 0.05)
export const ANIMS: Record<string, Anim> = {
  // standing, breathing, blinking once
  idle: { frames: 16, angle: -0.5, at: (t) => ({ pose: { ...STILL, squash: Math.sin(t * Math.PI * 2) * 0.03, tail: Math.sin(t * Math.PI * 2 - 0.8) * 0.25, tailTip: Math.sin(t * Math.PI * 2 - 1.8) * 0.4 }, mood: t > 0.62 && t < 0.7 ? 'closed' : 'idle' }) },
  run: { frames: 8, angle: -0.9, at: (t) => ({ pose: runPose(t), mood: 'idle' }) },
  // a peppier celebration: two quick hops, firing into the air at the top of each (pa-pa!)
  party: { frames: 16, angle: -0.6, at: (t) => {
    const k = Math.round(t * 16) % 16
    const fx: Fx[] = []
    for (const [shot, side] of [[4, -1], [12, 1]]) { const d = k - shot; if (d >= 0 && d <= 3) fx.push({ kind: 'bang', t: d / 3, side }) }
    return { pose: partyKeys(t), mood: 'joy', fx }
  } },
  // a little spell: a wand waved in loops, sparkles off the tip, flicked forward into a burst of stars
  wand: { frames: 16, angle: -0.5, at: (t) => ({ pose: wandKeys(t), mood: t > 0.66 && t < 0.86 ? 'closed' : t >= 0.86 ? 'happy' : 'idle', fx: [{ kind: 'wand', t }] }) },
  // watering the garden
  water: { frames: 16, angle: -0.5, at: (t) => ({ pose: waterKeys(t), mood: 'happy', fx: [{ kind: 'drops', t }] }) },
  // digging with a hoe
  dig: { frames: 12, angle: -0.6, at: (t) => {
    const k = Math.round(t * 12) % 12
    const fx: Fx[] = k >= 6 && k <= 9 ? [{ kind: 'clods', t: (k - 6) / 3 }] : []
    if (k === 6 || k === 7) fx.push({ kind: 'dust', t: (k - 6) / 2 })
    return { pose: digKeys(t), mood: k >= 3 && k <= 6 ? 'fierce' : 'idle', fx }
  } },
  // chopping wood
  chop: { frames: 12, angle: -0.6, at: (t) => {
    const k = Math.round(t * 12) % 12
    const fx: Fx[] = []
    if (k === 5 || k === 6) fx.push({ kind: 'slash', flat: true, t: k === 5 ? 0.2 : 0.6 })
    if (k >= 6 && k <= 9) fx.push({ kind: 'chips', t: (k - 6) / 3 })
    return { pose: chopKeys(t), mood: k >= 3 && k <= 6 ? 'fierce' : 'idle', fx }
  } },
  // fishing: cast, wait, a bite!
  fish: { frames: 24, angle: -0.6, at: (t) => {
    const k = Math.round(t * 24) % 24
    const bite = k >= 16 && k <= 19
    const fx: Fx[] = [{ kind: 'rod', t, bite }]
    return { pose: fishKeys(t), mood: bite ? 'surprised' : k >= 20 ? 'happy' : 'idle', fx }
  } },
  // fast asleep, curled on its back, breathing
  sleep: { frames: 24, angle: -0.9, at: (t) => {
    const p = settle(lieKeys(0.6))
    return { pose: { ...p, squash: (p.squash ?? 0) + Math.sin(t * Math.PI * 2) * 0.04 }, mood: 'closed', fx: [{ kind: 'zzz', t }] }
  } },
  // waving hello
  wave: { frames: 12, angle: -0.4, at: (t) => ({ pose: swayKeys(t), mood: 'happy', fx: [{ kind: 'paw', t }] }) },
  // feelings
  love: { frames: 16, angle: -0.4, at: (t) => ({ pose: swayKeys(t), mood: 'happy', fx: [{ kind: 'emote', what: 'heart', t }] }) },
  angry: { frames: 12, angle: -0.4, at: (t) => {
    const k = Math.round(t * 12) % 12
    return { pose: { ...STILL, squash: 0.06, dx: k % 2 === 0 ? 0.4 : -0.4, pitch: 0.06, tail: k % 2 === 0 ? 0.5 : 0.3 }, mood: 'fierce', fx: [{ kind: 'emote', what: 'anger', t }] }
  } },
  sad: { frames: 16, angle: -0.3, at: (t) => ({ pose: { ...STILL, pitch: 0.04, squash: 0.05 + Math.sin(t * Math.PI * 2) * 0.02, sit: 0.06, tail: -0.6 }, mood: 'sleepy', fx: [{ kind: 'emote', what: 'tears', t }] }) },
  surprised: { frames: 12, angle: -0.4, at: (t) => {
    const k = Math.round(t * 12) % 12
    const hop = k >= 1 && k <= 4 ? Math.sin(((k - 1) / 3) * Math.PI) : 0
    return { pose: { ...STILL, bob: hop * 2.4, squash: k === 0 ? 0.1 : k === 5 ? 0.14 : -hop * 0.12, lift: [hop, hop], tail: 0.7 }, mood: 'surprised' }
  } },
  // alert: something caught its eye! a jolt and a big '!' pops up and holds
  alert: { frames: 12, angle: -0.4, at: (t) => {
    const k = Math.round(t * 12) % 12
    const jolt = k === 1 ? 1 : k === 2 ? 0.5 : 0
    return { pose: { ...STILL, bob: jolt * 1.2, squash: k === 1 ? -0.12 : k === 3 ? 0.06 : 0, pitch: -jolt * 0.12, tail: k >= 1 ? 0.6 : 0 }, mood: k >= 1 ? 'surprised' : 'idle' }
  } },
  confused: { frames: 16, angle: -0.4, at: (t) => ({ pose: { ...swayKeys(t, 0.5), tilt: 0.14 + Math.sin(t * Math.PI * 2) * 0.03 }, mood: 'idle' }) },
  talk: { frames: 16, angle: -0.4, at: (t) => {
    const k = Math.round(t * 16) % 16
    return { pose: { ...STILL, bob: k % 4 < 2 ? 0.4 : 0, squash: k % 4 < 2 ? -0.03 : 0.03, tail: Math.sin(t * Math.PI * 2) * 0.3 }, mood: k % 4 < 2 ? 'happy' : 'idle' }
  } },
  dance: { frames: 16, angle: -0.4, at: (t) => {
    const s = Math.sin(t * Math.PI * 4)
    return { pose: { ...STILL, bob: Math.abs(s) * 1.6, yaw: Math.sin(t * Math.PI * 2) * 0.28, tilt: Math.sin(t * Math.PI * 2) * 0.09, squash: (1 - Math.abs(s)) * 0.12 - 0.04, lift: [Math.max(0, s) * 1.2, Math.max(0, -s) * 1.2], tail: Math.sin(t * Math.PI * 4 - 1) * 0.5 }, mood: 'joy', fx: [{ kind: 'emote', what: 'notes', t }] }
  } },
  // platformer basics
  jump: { frames: 12, angle: -0.5, at: (t) => {
    const k = Math.round(t * 12) % 12
    return { pose: jumpKeys(t), mood: k >= 4 && k <= 8 ? 'joy' : 'idle', fx: k >= 9 && k <= 11 ? [{ kind: 'dust', t: (k - 9) / 2 }] : [] }
  } },
  hurt: { frames: 10, angle: -0.5, at: (t) => {
    const k = Math.round(t * 10) % 10
    return { pose: hurtKeys(t), mood: k >= 1 && k <= 4 ? 'closed' : 'idle', fx: k === 1 || k === 2 ? [{ kind: 'chest', t: (k - 1) / 2 }] : [] }
  } },
  // sweep the floor with a broom: four strokes, side to side, a puff of dust off the end of each
  broom: { frames: 16, angle: -0.5, at: (t) => {
    const k = Math.round(t * 16) % 16
    // the head sweeps across in three frames and rests a beat at the end of each stroke
    const stroke = Math.floor(k / 4), u = Math.min(1, (k % 4) / 3)
    const from = stroke % 2 === 0 ? -1 : 1
    const sw = from + (-2 * from) * (u * u * (3 - 2 * u))
    const fx: Fx[] = [{ kind: 'broom', s: sw, from: k % 4 === 0 ? undefined : from, puff: k % 4 === 3 ? 0.2 : k % 4 === 0 ? 0.75 : undefined }]
    return { pose: broomKeys(t), mood: 'idle', fx }
  } },
  // a celebration: a sack-race hop forward, feet together
  celebrate: { frames: 12, angle: -0.7, at: (t) => ({ pose: sackHop(t), mood: t > 0.2 && t < 0.78 ? 'joy' : 'happy' }) },
  // bend over to pick something up off the floor, hold, straighten up
  'pick up': { frames: 16, angle: -0.7, at: (t) => {
    const down = t < 0.35 ? ease(t / 0.35) : t < 0.6 ? 1 : ease(1 - (t - 0.6) / 0.4)
    return { pose: { ...STILL, pitch: down * 0.32, sit: down * 0.38, squash: down * 0.05, tail: down * 0.5 }, mood: down > 0.8 ? 'closed' : 'idle' }
  } },
  // sit down like a cat, the tail curling round its feet; stay a while; get back up
  sit: { frames: 24, angle: -0.5, at: (t) => {
    const s = t < 0.22 ? ease(t / 0.22) : t < 0.82 ? 1 : ease(1 - (t - 0.82) / 0.18)
    // the tail starts curling as it settles and takes its time; it uncurls before it stands
    const w = t < 0.1 ? 0 : t < 0.5 ? (t - 0.1) / 0.4 : t < 0.7 ? 1 : t < 0.86 ? 1 - (t - 0.7) / 0.16 : 0
    return { pose: { ...STILL, sit: s * 0.5, wrap: w }, mood: s > 0.9 && t > 0.56 && t < 0.62 ? 'closed' : 'idle' }
  } },
  // lie down on its back, feet up, doze off, roll back up
  'lie down': { frames: 24, angle: -0.9, at: (t) => ({ pose: settle(lieKeys(t)), mood: at(t, [[0, 'idle'], [0.3, 'happy'], [0.42, 'sleepy'], [0.5, 'closed'], [0.74, 'idle']]) }) },
  // a sword slash with an invisible blade: wind up (twist back), strike (lunge, stretch) as a white
  // crescent sweeps round the front, hold the follow-through while the arc thins and breaks up
  slash: { frames: 14, angle: -0.7, at: (t) => {
    const k = Math.round(t * 14)
    const fx: Fx[] = []
    const arc = (k - 3) / 5
    if (arc >= 0 && arc <= 1.05) fx.push({ kind: 'slash', t: arc })
    if (k === 3 || k === 4) fx.push({ kind: 'speed', t: (k - 3) / 2 })
    return { pose: slashKeys(t), mood: k >= 2 && k <= 8 ? 'fierce' : 'idle', fx }
  } },
  // a flat sweep: twist away (wind up), whip round (one frame), hold the follow-through
  swipe: { frames: 14, angle: -0.5, at: (t) => {
    const k = Math.round(t * 14)
    const fx: Fx[] = []
    const arc = (k - 3) / 5
    if (arc >= 0 && arc <= 1.05) fx.push({ kind: 'slash', t: arc, flat: true })
    if (k === 3 || k === 4) fx.push({ kind: 'speed', t: (k - 3) / 2 })
    return { pose: slash2Keys(t), mood: k >= 2 && k <= 8 ? 'fierce' : 'idle', fx }
  } },
  // a punch: wind up (lean back, squash), throw it (a one-frame lunge, stretched, speed lines),
  // POW on contact, hold the extended pose, pull back
  punch: { frames: 12, angle: -0.6, at: (t) => {
    const k = Math.round(t * 12)
    const fx: Fx[] = []
    if (k === 3) fx.push({ kind: 'speed', t: 0 })
    if (k >= 4 && k <= 6) fx.push({ kind: 'pow', t: (k - 4) / 2 })
    return { pose: punchKeys(t), mood: k >= 2 && k <= 7 ? 'fierce' : 'idle', fx }
  } },
  // a one-two: a quick jab (small pow), then pull round the other way and throw the big cross
  'one-two': { frames: 16, angle: -0.6, at: (t) => {
    const k = Math.round(t * 16)
    const fx: Fx[] = []
    if (k === 2) fx.push({ kind: 'speed', t: 0.5 })
    if (k >= 3 && k <= 4) fx.push({ kind: 'pow', t: (k - 3) / 2, small: true, side: 1 })
    if (k === 6) fx.push({ kind: 'speed', t: 0 })
    if (k >= 7 && k <= 9) fx.push({ kind: 'pow', t: (k - 7) / 2, side: -1 })
    return { pose: punch2Keys(t), mood: k >= 1 && k <= 10 ? 'fierce' : 'idle', fx }
  } },
  // a spear throw: draw back (twist away, lean back, squash), whip forward (stretch, one frame), the
  // spear streaks off; follow through leaning in, recover
  spear: { frames: 14, angle: -0.6, at: (t) => {
    const k = Math.round(t * 14)
    const fx: Fx[] = []
    if (k >= 4 && k <= 6) fx.push({ kind: 'spear', t: (k - 4) / 2 })
    if (k === 4) fx.push({ kind: 'speed', t: 0 })
    return { pose: spearKeys(t), mood: k >= 1 && k <= 7 ? 'fierce' : 'idle', fx }
  } },
  // eating: four chomps, leaning in with the mouth wide, biting down with happy eyes, crumbs flying
  eat: { frames: 16, angle: -0.3, at: (t) => {
    const k = Math.round(t * 16)
    const fx: Fx[] = []
    const bite = k % 4 // 0 lean in (open), 1 bite, 2-3 chew
    if (k < 15 && bite >= 1 && bite <= 3) fx.push({ kind: 'crumbs', t: (bite - 1) / 2.4 + 0.15, seed: Math.floor(k / 4) })
    return { pose: eatKeys(t), mood: k >= 15 ? 'happy' : bite === 0 ? 'joy' : 'happy', fx }
  } },
  // fireball: wind up (twist back, crouch, a little ball gathering at the hands), snap forward and
  // KAPOW: a big burst at the hands as one big fireball launches; follow through, recover
  fireball: { frames: 14, angle: -0.6, at: (t) => {
    const k = Math.round(t * 14)
    const fx: Fx[] = []
    if (k >= 1 && k <= 3) fx.push({ kind: 'charge', t: k / 4 })
    if (k === 4) fx.push({ kind: 'flash', big: true }, { kind: 'speed', t: 0 })
    if (k === 5) fx.push({ kind: 'pow', t: 0, small: true }, { kind: 'flash', big: false })
    if (k === 6) fx.push({ kind: 'pow', t: 0.7, small: true })
    // fully charged, it's gone: across the frame in three frames
    if (k >= 5 && k <= 7) fx.push({ kind: 'orb', t: [0.12, 0.55, 1.05][k - 5], lane: 1 })
    return { pose: fireballKeys(t), mood: k >= 1 && k <= 9 ? 'fierce' : 'idle', fx }
  } },
  // the big beam: crouch and gather (energy ball grows, specks sucked in), then thrust and fire a
  // huge beam, braced against the push, hold it, let it die, stand up
  beam: { frames: 24, angle: -0.6, at: (t) => {
    const k = Math.round(t * 24)
    const fx: Fx[] = []
    if (k >= 2 && k <= 9) fx.push({ kind: 'charge', t: (k - 2) / 7 })
    if (k >= 10 && k <= 19) fx.push({ kind: 'beam', t: (k - 10) / 9 })
    return { pose: beamKeys(t), mood: k < 2 ? 'idle' : k < 10 ? 'closed' : k < 20 ? 'fierce' : 'happy', fx }
  } },
  // a long blade swung flat: a big wind-up turning right away, one whip round through the front
  // (the arc reaching most of the way round), a long held follow-through, back
  sweep: { frames: 16, angle: -0.5, at: (t) => {
    const k = Math.round(t * 16)
    const fx: Fx[] = []
    const arc = (k - 4) / 6
    if (arc >= 0 && arc <= 1.05) fx.push({ kind: 'slash', t: arc, flat: true, long: true })
    if (k === 4 || k === 5) fx.push({ kind: 'speed', t: (k - 4) / 2 })
    return { pose: sweepKeys(t), mood: k >= 2 && k <= 10 ? 'fierce' : 'idle', fx }
  } },
  // a little gun that isn't drawn: aim, three shots (recoil, flash, tracer, a shell flying out,
  // a puff of smoke), drop the magazine, slap in a new one (click), ready
  shoot: { frames: 24, angle: -0.7, at: (t) => {
    const k = Math.round(t * 24)
    const fx: Fx[] = []
    for (const shot of [4, 7, 10]) {
      const d = k - shot
      if (d === 0) fx.push({ kind: 'flash', big: true }, { kind: 'tracer', t: 0 })
      if (d === 1) fx.push({ kind: 'flash', big: false }, { kind: 'tracer', t: 0.6 }, { kind: 'shell', t: 0.25 }, { kind: 'smoke', t: 0.1 })
      if (d === 2) fx.push({ kind: 'shell', t: 0.65 }, { kind: 'smoke', t: 0.5 })
    }
    if (k >= 14 && k <= 16) fx.push({ kind: 'mag', t: (k - 14) / 2 })
    if (k === 18) fx.push({ kind: 'click' })
    return { pose: shootKeys(t), mood: k < 13 ? 'fierce' : k < 18 ? 'idle' : k < 21 ? 'happy' : 'idle', fx }
  } },
  // knockback: hit, flung up and over backwards, slam down on its back, bounce, reverb, dazed
  knockback: { frames: 10, angle: -0.5, at: (t) => {
    const k = Math.round(t * 10)
    const fx: Fx[] = []
    if (k === 1) fx.push({ kind: 'pow', t: 0, small: true })
    if (k >= 3 && k <= 5) fx.push({ kind: 'dust', t: (k - 3) / 2 })
    return { pose: settle(knockKeys(t), knockHop(t)), mood: at(k, [[0, 'idle'], [1, 'surprised'], [3, 'closed']]), fx }
  } },
  // faceplant: an exasperated sigh, a teeter, and down it goes onto its face (the eyes in the floor)
  faceplant: { frames: 24, angle: 0.5, at: (t) => {
    const k = Math.round(t * 24)
    return { pose: settle(faceplantKeys(t)), mood: at(k, [[0, 'idle'], [2, 'sleepy'], [6, 'closed'], [8, 'sleepy'], [11, 'closed']]) }
  } },
  // slashed dead: a short white gash on the chest as it's flung back (turning from the blow),
  // lands on its back, X eyes
  'slashed': { frames: 20, angle: -0.5, at: (t) => {
    const k = Math.round(t * 20)
    return { pose: settle(slashDeathKeys(t), thrownHop(t)), mood: at(k, [[0, 'idle'], [1, 'surprised'], [4, 'dead']]), fx: k >= 1 && k <= 2 ? [{ kind: 'chest', t: (k - 1) / 2, cut: true }] : [] }
  } },
  // shot dead: a white flash right in the chest as it's flung back, lands on its back, X eyes
  'shot': { frames: 20, angle: -0.5, at: (t) => {
    const k = Math.round(t * 20)
    return { pose: settle(shotDeathKeys(t), thrownHop(t)), mood: at(k, [[0, 'idle'], [1, 'surprised'], [4, 'dead']]), fx: k >= 1 && k <= 2 ? [{ kind: 'chest', t: (k - 1) / 2 }] : [] }
  } },
  // flop over dead: whack (no wind-up), a dazed beat, then one sweep down onto its side, X eyes
  death: { frames: 20, angle: -0.4, at: (t) => {
    const k = Math.round(t * 20)
    return { pose: settle(deathKeys(t), deathHop(t)), mood: at(k, [[0, 'idle'], [1, 'surprised'], [3, 'closed'], [8, 'dead']]) }
  } },
}

/** One step of the waddle cycle, t in [0, 1): two hops per cycle, one per foot. */
export function walkPose(t: number): Pose {
  const s = Math.sin(t * Math.PI * 2)
  const hop = Math.abs(s)
  return { bob: hop * 1.6, tilt: s * 0.14, squash: (1 - hop) ** 3 * 0.1, lift: [Math.min(1.4, Math.max(0, s) * 2), Math.min(1.4, Math.max(0, -s) * 2)], tail: Math.sin(t * Math.PI * 2 + 0.8) * 0.45, tailTip: Math.sin(t * Math.PI * 2) * 0.6 }
}

const rotZAbout = (p: V3, c: V3, a: number): V3 => {
  const x = p[0] - c[0], y = p[1] - c[1]
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a), p[2]]
}

/** Filled in by draw() for the colour modes: everything needed to paint the sprite with a palette. */
export interface ColorInfo {
  /** The one-bit sprite before the dither shading and eyes went on (outlines and dark fills only). */
  base?: Bitmap
  /** Eye pixels, as drawn. */
  eyePx?: [number, number][]
  /** Per pixel: which part of the cat it is and how lit it is (0 dark .. 1 lit), or null outside. */
  at?: (x: number, y: number) => { role: Role; light: number } | null
}

// ---------------------------------------------------------------- body builds
// One warp, so every coat, outfit and pair of feet fits every build: below the head the body is
// stretched sideways (x front-back, y left-right) by an amount that swells around `peak`
// (0 = floor, 1 = neck) and fades out under the head.

export type BodyShape = 'petite' | 'cozy' | 'curvy' | 'round' | 'tall' | 'wasp' | 'strong' | 'mochi' | 'teardrop' | 'beanbag'
export const BODIES: BodyShape[] = ['petite', 'cozy', 'curvy', 'round', 'tall', 'wasp', 'strong', 'mochi', 'teardrop', 'beanbag']
/** x, y: how much wider at the swell; peak (0 floor .. 1 neck) and spread of the swell; tall: how much
 * taller the body grows (the head rides up on it, so it looks smaller). */
const BUILD: Record<BodyShape, { x: number; y: number; peak: number; spread: number; tall?: number; chest?: number; profile?: (t: number) => number; blob?: [number, number]; blobShape?: 'ball' | 'drop' | 'sack' }> = {
  petite: { x: 0, y: 0, peak: 0.5, spread: 1 },
  // a round little belly
  cozy: { x: 0.55, y: 0.8, peak: 0.45, spread: 0.8 },
  // big, round and pillowy: the whole body swells into a soft wide oval, a little taller too
  // (the body itself is a real round blob; x/y/peak only fit the clothes over it)
  round: { x: 1.35, y: 1.85, peak: 0.45, spread: 0.62, tall: 0.15, blob: [5.4, 7] },
  // tall: a long skinny body, the head riding high
  tall: { x: -0.15, y: -0.2, peak: 0.5, spread: 2, tall: 0.85 },
  // wasp: tall, full at the hips and the chest, cinched to a tiny waist between
  wasp: { x: 0.55, y: 0.85, peak: 0.5, spread: 1, tall: 0.8,
    // bust, a very skinny waist, high hips, then tapering in a little again to the feet
    profile: (t) => 0.3 * g(t, 0, 0.12) + 1.1 * g(t, 0.34, 0.11) + 0.85 * g(t, 0.8, 0.14) - 0.62 * g(t, 0.57, 0.09) },
  // mochi: a huge soft round blob, far wider than the head and squat, the head perched small on top
  mochi: { x: 3.8, y: 4.4, peak: 0.45, spread: 0.6, tall: 0.55, blob: [10.6, 12.6] },
  // teardrop: as big, but round and heavy at the bottom, narrowing up to a slim neck
  teardrop: { x: 3.2, y: 3.8, peak: 0.3, spread: 0.45, tall: 0.85, blob: [10, 11.8], blobShape: 'drop' },
  // beanbag: a big soft sack, slumped a little wider at the bottom, gathered in toward the top
  beanbag: { x: 3, y: 3.8, peak: 0.35, spread: 0.6, tall: 0.65, blob: [8.8, 10.6], blobShape: 'sack' },
  // curvy: an hourglass: fuller at the hips and the chest, nipped in at the waist, a soft swell at
  // the front of the chest
  curvy: { x: 0.5, y: 0.75, peak: 0.45, spread: 0.8, chest: 0.4, tall: 0.12,
    profile: (t) => g(t, 0.2, 0.17) + 0.85 * g(t, 0.74, 0.15) - 0.35 * g(t, 0.47, 0.1) },
  // strong: a high wide chest tapering down to a narrow base, a little taller
  strong: { x: 1.3, y: 2.4, peak: 0.72, spread: 0.36, tall: 0.45 },
}
const g = (t: number, at: number, spread: number) => Math.exp(-(((t - at) / spread) ** 2))
/** How far a build moves the feet: forward and apart, by how much the body grew down by the floor. */
export const buildFeet = (shape: BodyShape | undefined): [number, number] => {
  const b = BUILD[shape ?? 'petite'] ?? BUILD.petite
  const t = 1.2 / 7.6
  const w = b.profile !== undefined ? b.profile(t) : g(t, b.peak, b.spread)
  return [2.1 * b.x * w * 0.8, 1.3 * b.y * w * 0.6]
}
/** A build whose body is a blob: its shape in model space (the floor to the neck, z 0..8): undefined for most. */
export function buildBlob(shape: BodyShape | undefined): Sdf | undefined {
  const b = BUILD[shape ?? 'petite'] ?? BUILD.petite
  if (b.blob === undefined) return undefined
  const [rx, ry] = b.blob
  // the big ones are deep as well as wide (round all the way down, not a flat disc), and their top
  // comes up round the head so it sits down into them
  const h = 1 + Math.max(0, rx - 5.4) * 0.1
  switch (b.blobShape ?? 'ball') {
    case 'drop': // a big round bottom, drawn up into a slim neck
      return smooth(3.2, E([0, 0, 2.8 * h], [rx, ry, 2.9 * h]), E([0, 0, 6.2 * h], [rx * 0.3, ry * 0.3, 2.6 * h]))
    case 'sack': // a soft slumped sack: a round body, a wider saggy bottom, gathered in at the top
      return smooth(2.6, E([0, 0, 3.8 * h], [rx * 0.92, ry * 0.92, 3.6 * h]), E([0, 0, 1.9 * h], [rx, ry, 1.9 * h]), E([0, 0, 6.8 * h], [rx * 0.45, ry * 0.45, 1.5 * h]))
    default:
      return E([0, 0, 4.15 * h - 0.15], [rx, ry, 4.15 * h], 'fur')
  }
}
/** How much taller a build makes the body (0 for most). */
export const buildTall = (shape: BodyShape | undefined) => (BUILD[shape ?? 'petite'] ?? BUILD.petite).tall ?? 0
/** Map a point to where it was on the petite body (the inverse of the build's stretch; body half-size 2.1 x 2.6). */
export function unbuild(shape: BodyShape | undefined, hang = false): ((p: V3) => V3) | null {
  const b = BUILD[shape ?? 'petite'] ?? BUILD.petite
  if (b.x === 0 && b.y === 0 && !b.chest) return null
  // inside the body it scales; outside (clothes) it shifts out by the same amount the body grew,
  // so a wide skirt grows by the body's growth rather than in proportion
  const axis = (v: number, half: number, grow: number) => {
    const r = Math.abs(v)
    const g = half * grow
    return Math.sign(v) * (r <= half + g ? r * half / (half + g) : r - g)
  }
  if (b.blob !== undefined) return blobFit(shape!)
  const wAt = (t: number) => (b.profile !== undefined ? b.profile(t) : Math.exp(-(((t - b.peak) / b.spread) ** 2)))
  // hanging clothes: as wide as the body gets anywhere above (to the shoulders), so they fall straight
  const HANG: number[] = []
  if (hang) for (let i = 40; i >= 0; i--) HANG[i] = Math.max(wAt(i / 40), HANG[i + 1] ?? -Infinity)
  return (p) => {
    const t = Math.max(0, p[2]) / 7.6
    const w = hang ? HANG[Math.max(0, Math.min(40, Math.round(t * 40)))] : wAt(t)
    // the chest: a soft forward swell high on the front only
    const c = p[0] > 0 && b.chest ? b.chest * Math.exp(-(((t - 0.7) / 0.2) ** 2)) * Math.exp(-((p[1] / 2.4) ** 2)) : 0
    return [axis(p[0], 2.1, b.x * w + c), axis(p[1], 2.6, b.y * w), p[2]]
  }
}
/**
 * Clothes on a blob body: the small cat's body (0..7.6 high) is stretched up to the blob's real top,
 * and at each height clothes are pushed out to the widest the blob gets at or above it, so a coat
 * hangs from the belly like cloth rather than shrinking in round the bottom.
 */
const blobFits = new Map<BodyShape, (p: V3) => V3>()
function blobFit(shape: BodyShape): (p: V3) => V3 {
  const hit = blobFits.get(shape)
  if (hit !== undefined) return hit
  const blob = buildBlob(shape)!
  const STEP = 0.25, N = 80
  const reach = (z: number, ux: number, uy: number) => {
    let r = 0
    if (blob.d([0, 0, z]) > 0) return 0
    while (r < 30 && blob.d([r * ux, r * uy, z]) < 0) r += 0.1
    return r
  }
  const ex: number[] = [], ey: number[] = []
  for (let i = 0; i < N; i++) { ex.push(reach(i * STEP, 1, 0)); ey.push(reach(i * STEP, 0, 1)) }
  let top = 0
  for (let i = 0; i < N; i++) if (ex[i] > 0) top = i * STEP
  // hang from the widest point above
  for (let i = N - 2; i >= 0; i--) { ex[i] = Math.max(ex[i], ex[i + 1]); ey[i] = Math.max(ey[i], ey[i + 1]) }
  const at = (e: number[], z: number) => e[Math.max(0, Math.min(N - 1, Math.round(z / STEP)))]
  // radially (round stays round): inside the blob it scales down to the small body, outside it
  // shifts in by however much bigger the blob is in that direction
  const H = 7.6
  const f = (p: V3): V3 => {
    const z = p[2] <= top ? p[2] * H / top : p[2] - (top - H)
    const rho = Math.hypot(p[0], p[1])
    if (rho < 1e-6) return [0, 0, z]
    const c = p[0] / rho, s = p[1] / rho
    const rad = (a: number, b: number) => 1 / Math.hypot(c / a, s / b) // an ellipse's radius that way
    const big = Math.max(rad(at(ex, p[2]) || 0.01, at(ey, p[2]) || 0.01), rad(2.1, 2.6)), small = rad(2.1, 2.6)
    const r = rho <= big ? rho * small / big : rho - (big - small)
    return [c * r, s * r, z]
  }
  blobFits.set(shape, f)
  return f
}
/**
 * Where a blob build moves the tail to: out along the root's direction to the blob's surface at its
 * widest (and up a little, onto the bulge), so the tail sticks out of a big body, not into it.
 */
/** A blob build's widest reach forward/back and to the sides (null for the others). */
const widths = new Map<BodyShape, [number, number]>()
export function blobWidest(shape: BodyShape | undefined): [number, number] | null {
  const b = BUILD[shape ?? 'petite'] ?? BUILD.petite
  if (b.blob === undefined || shape === undefined) return null
  const hit = widths.get(shape)
  if (hit !== undefined) return hit
  const blob = buildBlob(shape)!
  const reach = (z: number, ux: number, uy: number) => {
    let r = 0
    while (r < 30 && blob.d([r * ux, r * uy, z]) < 0) r += 0.1
    return r
  }
  let wx = 0, wy = 0
  for (let z = 0; z < 16; z += 0.25) if (blob.d([0, 0, z]) < 0) { wx = Math.max(wx, reach(z, -1, 0)); wy = Math.max(wy, reach(z, 0, 1)) }
  const v: [number, number] = [wx, wy]
  widths.set(shape, v)
  return v
}
const tailShifts = new Map<string, { shift: V3; root: V3; scale: number }>()
export function blobTailShift(shape: BodyShape | undefined, style: TailStyle = 'swoop'): { shift: V3; root: V3; scale: number } | null {
  const b = BUILD[shape ?? 'petite'] ?? BUILD.petite
  if (b.blob === undefined || shape === undefined) return null
  const key = `${shape}|${style}`
  const hit = tailShifts.get(key)
  if (hit !== undefined) return hit
  const blob = buildBlob(shape)!
  // where the tail grows from: straight out the back for the little ones, back-and-side for the rest
  const ROOT: V3 = style === 'puff' || style === 'pig' ? [-2.4, 0, 2.6] : style === 'lizard' ? [-1.4, 0, 1.6] : [-1.4, 1, 1.4]
  const rl = Math.hypot(ROOT[0], ROOT[1]), ux = ROOT[0] / rl, uy = ROOT[1] / rl
  let best = 0, bestZ = ROOT[2]
  for (let z = 0; z < 16; z += 0.25) {
    let r = 0
    if (blob.d([0, 0, z]) > 0) continue
    while (r < 30 && blob.d([r * ux, r * uy, z]) < 0) r += 0.1
    if (r > best) { best = r; bestZ = z }
  }
  // as far out as the blob is bigger than the small body that way, so it sits on the surface as it does there
  const small = 1 / Math.hypot(ux / 2.1, uy / 2.6)
  // the little round ones grow with the body too (a pea on a beanbag doesn't read), and sit a bit proud
  const stub = style === 'puff' || style === 'pig'
  const scale = stub ? 1 + (best / small - 1) * 0.28 : 1
  const out = Math.max(0, best - small + (stub ? 0.6 * scale : -0.4))
  const v = { shift: [ux * out, uy * out, Math.max(0, (bestZ - ROOT[2]) * 0.6)] as V3, root: ROOT, scale }
  tailShifts.set(key, v)
  return v
}
const built = (s: Sdf, inv: (p: V3) => V3): Sdf => ({ mat: s.mat, d: (p) => s.d(inv(p)) * 0.8 })

// ---------------------------------------------------------------- attack effects
// 2D one-bit effects stamped over the sprite, placed from the cat's (posed) body: the weapons are
// never drawn, the effects do the work. Paper shapes get an ink outline so they read on anything.
export type Fx =
  | { kind: 'slash'; t: number; flat?: boolean; long?: boolean } // a crescent sweeping round the front (or flat across it): grows, then thins away
  | { kind: 'speed'; t: number; back?: boolean } // lunge lines trailing behind (back: in front, flying backwards)
  | { kind: 'dust'; t: number } // puffs kicked up along the floor by a landing
  | { kind: 'spear'; t: number } // a thrown spear: a long white streak with a point, flying off
  | { kind: 'orb'; t: number; lane: number } // a thrown fireball on its way out
  | { kind: 'crumbs'; t: number; seed: number } // bits of food spraying out of the mouth
  | { kind: 'chest'; t: number; cut?: boolean } // a hit landing on the chest: a white flash (or a short slash gash)
  | { kind: 'charge'; t: number } // energy gathering at the hands: a growing ball, specks sucked in
  | { kind: 'beam'; t: number } // the big beam: a fat white blast to the edge of the frame
  | { kind: 'flash'; big: boolean } // muzzle flash: a starburst
  | { kind: 'tracer'; t: number } // a bullet streak heading off
  | { kind: 'shell'; t: number } // a casing flipping up and back
  | { kind: 'smoke'; t: number } // a puff drifting up from the muzzle
  | { kind: 'mag'; t: number } // a magazine dropping from the hands
  | { kind: 'click' } // reload sparks at the hands
  | { kind: 'pow'; t: number; small?: boolean; side?: number } // a punch landing: a round burst in front (of one shoulder, with side)
  | { kind: 'bang'; t: number; side: number } // a shot fired into the air above the head (side -1/1): a starburst, confetti drifting down
  | { kind: 'wand'; t: number } // a little wand waved in loops over the head, sparkles trailing off its tip; flicked forward into a burst of stars
  | { kind: 'drops'; t: number } // watering: drops arcing from the hands down to the ground out front
  | { kind: 'clods'; t: number } // digging: clods of earth flung up where the hoe bit
  | { kind: 'chips'; t: number } // chopping: wood chips flying off in front
  | { kind: 'rod'; t: number; bite?: boolean } // fishing: rod, line, bobber (cast at t 0.21-0.33, then floating; bite: it dips)
  | { kind: 'zzz'; t: number } // asleep: Zs drifting up
  | { kind: 'paw'; t: number } // waving hello: a paw up by the head, waggling
  | { kind: 'emote'; what: 'heart' | 'anger' | 'tears' | 'notes'; t: number } // a feeling on or over the head (words and marks like ! and ? are the bubble kit's: Mochimon)
  | { kind: 'broom'; s: number; from?: number; puff?: number } // a broom stick held at the side, its end on the floor out front at side s (-1..1); from: where this stroke started (a smear trails back to it); puff: dust kicked out ahead (0..1)

function drawFx(o: Bitmap, fx: Fx[], at: (m: V3) => [number, number], mark: (x: number, y: number) => void, atLevel: (m: V3) => [number, number] = at): void {
  // the cat as drawn (body, outfit and all): effects keep clear of it rather than landing on it
  const sil = new Uint8Array(o.w * o.h)
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) sil[y * o.w + x] = o.get(x, y) === CLEAR ? 0 : 1
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < o.w && y < o.h && sil[y * o.w + x] === 1
  /** Is any of the cat within `r` of (x, y)? */
  const near = (x: number, y: number, r: number) => {
    for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) if (dx * dx + dy * dy <= r * r && solid(Math.round(x + dx), Math.round(y + dy))) return true
    return false
  }
  /** Slide (x, y) along (ux, uy) until a circle of radius `r` there is off the cat. */
  const clearOf = ([x, y]: [number, number], r: number, ux: number, uy: number): [number, number] => {
    for (let i = 0; i < 80 && near(x, y, r); i++) { x += ux; y += uy }
    return [Math.round(x), Math.round(y)]
  }
  const put = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < o.w && y < o.h) { o.set(x, y, v); mark(x, y) } }
  const centre = at([0.5, 0, 9])
  const fwd = at([7.5, 0, 6])[0] >= centre[0] ? 1 : -1 // which way the cat faces on screen
  // the facing direction projected onto the screen, as a unit vector (for things fired straight out)
  // (from the cat's level facing, not its lean: a throw that pitches forward still fires straight)
  const ahead = atLevel([40, 0, 3.4]), base = atLevel([0, 0, 3.4])
  const dl = Math.hypot(ahead[0] - base[0], ahead[1] - base[1]) || 1
  const dir: [number, number] = [(ahead[0] - base[0]) / dl, (ahead[1] - base[1]) / dl]
  // thrown things lob a little upward rather than skimming the floor
  const upA = atLevel([40, 0, 3.4 + 21])
  const ul = Math.hypot(upA[0] - base[0], upA[1] - base[1]) || 1
  const lob: [number, number] = [(upA[0] - base[0]) / ul, (upA[1] - base[1]) / ul]
  /** (along, across) for a pixel relative to an origin, in the facing direction. */
  const local = (x: number, y: number, ox: number, oy: number): [number, number] => [(x - ox) * dir[0] + (y - oy) * dir[1], -(x - ox) * dir[1] + (y - oy) * dir[0]]
  // the hands and the gun sit just in front of the body, however big it or its outfit is
  const muzzle = clearOf(at([5.4, -1, 4.4]), 1, dir[0], dir[1])
  const hands = clearOf(at([3.2, 0, 3.4]), 1, dir[0], dir[1])
  const mouth = at([FRONT + 0.5, 0, EYE[2] - 3])
  // a set of pixels drawn as paper with an ink rim
  const blob = (inside: (x: number, y: number) => boolean, x0: number, y0: number, x1: number, y1: number) => {
    const fill: [number, number][] = []
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) fill.push([x, y])
    for (const [x, y] of fill) put(x, y, [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside(x + dx, y + dy)) ? INK : PAPER)
  }
  const line = (x0: number, y0: number, x1: number, y1: number, skip = 0) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= n; i++) if (skip === 0 || i % skip !== skip - 1) put(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), INK)
  }
  /** A little glyph centred on (cx, cy): '#' ink, '.' paper, with a paper halo so it reads over the cat. */
  const stamp = (rows: string[], cx: number, cy: number) => {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length))
    const x0 = cx - Math.floor(w / 2), y0 = cy - Math.floor(h / 2)
    const isInk = (x: number, y: number) => rows[y]?.[x] === '#'
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const c = rows[y]?.[x]
      if (c === '#' || c === '.') continue
      if (isInk(x - 1, y) || isInk(x + 1, y) || isInk(x, y - 1) || isInk(x, y + 1)) put(x0 + x, y0 + y, PAPER)
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = rows[y][x]; if (c === '#') put(x0 + x, y0 + y, INK); else if (c === '.') put(x0 + x, y0 + y, PAPER) }
  }
  /** A four-point sparkle of arm length s (0 = a dot), with a paper halo. */
  const sparkle = (x: number, y: number, s: number) => {
    const pts: [number, number][] = [[0, 0]]
    for (let i = 1; i <= s; i++) pts.push([i, 0], [-i, 0], [0, i], [0, -i])
    for (const [dx, dy] of pts) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!pts.some(([px, py]) => px === dx + ex && py === dy + ey)) put(x + dx + ex, y + dy + ey, PAPER)
    for (const [dx, dy] of pts) put(x + dx, y + dy, INK)
  }
  for (const f of fx) {
    switch (f.kind) {
      case 'slash': {
        // screen angles (y down): from up-and-behind round the front to down-in-front
        // a fat solid white crescent; it thins away from the tail end rather than breaking up.
        // Upright: from up-and-behind over the head round to the front. Flat: a squashed ring
        // sweeping across the front at chest height, from behind to the far side.
        // long: a long blade swung flat: a bigger, flatter, thinner arc reaching most of the way round
        let R = f.long ? 21 : f.flat ? 19 : 18
        const sy = f.long ? 0.4 : f.flat ? 0.5 : 1
        const tip = f.long ? 0.22 * fwd : f.flat ? 0.38 * fwd : 0 // the flat sweep's plane tipped down toward the front
        const a0 = f.long ? -3.6 : f.flat ? -2.9 : -2.5, a1 = f.long ? 1.4 : f.flat ? 0.5 : 0.75
        const head = a0 + (a1 - a0) * Math.min(1, f.t / 0.35)
        const tail = a0 + (a1 - a0) * Math.max(0, (f.t - 0.3) / 0.75)
        const W0 = f.long ? 9 : f.flat ? 13 : 10
        const W = W0 * (1 - Math.max(0, f.t - 0.5) * 1.6)
        const [cx, cy0] = centre
        const cy = f.long ? cy0 + 1 : f.flat ? cy0 - 3 : cy0
        const ring = (x: number, y: number, R: number, from: number, to: number, w: number) => {
          const rx = (x - cx) * Math.cos(tip) + (y - cy) * Math.sin(tip), ry = -(x - cx) * Math.sin(tip) + (y - cy) * Math.cos(tip)
          const dx = rx * fwd, dy = ry / sy
          const th = f.flat ? -Math.atan2(dy, dx) : Math.atan2(dy, dx)
          if (th < from || th > to) return false
          const rr = Math.hypot(dx, dy)
          return rr <= R + 1 && rr >= R - w - 1
        }
        // big bodies and big outfits: the arc swings wider, so the whole sweep (at its fattest) is off the cat
        const hits = (R: number) => {
          for (let y = Math.floor(cy - R * sy - 2); y <= cy + R * sy + 2; y++) for (let x = cx - R - 2; x <= cx + R + 2; x++) if (solid(x, y) && ring(x, y, R, a0, a1, W0)) return true
          return false
        }
        while (R < 60 && hits(R)) R++
        const inside = (x: number, y: number) => {
          const rx = (x - cx) * Math.cos(tip) + (y - cy) * Math.sin(tip), ry = -(x - cx) * Math.sin(tip) + (y - cy) * Math.cos(tip)
          const dx = rx * fwd, dy = ry / sy
          // flat: angles run the other way round (behind -> front -> away)
          const th = f.flat ? -Math.atan2(dy, dx) : Math.atan2(dy, dx)
          if (th < tail || th > head) return false
          const w = W * Math.pow((th - tail) / Math.max(0.01, head - tail), 0.6)
          const rr = Math.hypot(dx, dy)
          return rr <= R && rr >= R - w
        }
        blob(inside, cx - R - 2, Math.floor(cy - R * sy - 2), cx + R + 2, Math.ceil(cy + R * sy + 2))
        break
      }
      case 'speed': {
        const [cx, cy] = centre
        const dir = f.back ? -1 : 1
        for (const [dy, len] of [[-6, 6], [-1, 9], [4, 5]]) {
          let x0 = cx - fwd * dir * 9
          while (Math.abs(x0 - cx) < o.w && (solid(x0, cy + dy) || solid(x0, cy + dy - 1) || solid(x0, cy + dy + 1) || solid(x0 - fwd * dir, cy + dy))) x0 -= fwd * dir
          x0 -= fwd * dir * f.t * 4
          line(x0, cy + dy, x0 - fwd * dir * len, cy + dy)
        }
        break
      }
      case 'spear': {
        const [hx, hy] = hands
        const d = 8 + f.t * 34
        const hx2 = hx + lob[0] * d, hy2 = hy - 5 + lob[1] * d
        const len = 22
        blob((x, y) => {
          const u0 = (x - hx2) * lob[0] + (y - hy2) * lob[1], v = -(x - hx2) * lob[1] + (y - hy2) * lob[0]
          const u = -u0 // 0 at the tip, len at the butt
          if (u < 0 || u > len) return false
          return Math.abs(v) <= (u < 5 ? u * 0.45 : 1)
        }, Math.floor(Math.min(hx2, hx2 - lob[0] * len) - 3), Math.floor(Math.min(hy2, hy2 - lob[1] * len) - 3), Math.ceil(Math.max(hx2, hx2 - lob[0] * len) + 3), Math.ceil(Math.max(hy2, hy2 - lob[1] * len) + 3))
        for (const dv of [-2, 2]) {
          const bx = hx2 - lob[0] * (len + 2) - lob[1] * dv, by = hy2 - lob[1] * (len + 2) + lob[0] * dv
          line(Math.round(bx), Math.round(by), Math.round(bx - lob[0] * 4), Math.round(by - lob[1] * 4), 3)
        }
        break
      }
      case 'orb': {
        // a big cartoon fireball: a fat round white head, a flame tail licking out behind (two tongues
        // swapping frame to frame), an ink swirl inside, sparks falling off the tail
        const [hx, hy] = hands
        const lanes = [-7, 0, 6]
        const d = 6 + f.t * 34
        const ox = hx + lob[0] * d - lob[1] * lanes[f.lane % 3] * Math.sin(f.t * Math.PI) * 0.8
        const oy = hy - 4 + lob[1] * d + lob[0] * lanes[f.lane % 3] * Math.sin(f.t * Math.PI) * 0.8
        const flick = Math.round(f.t * 6 + f.lane) % 2
        const R = 4.6, TL = 14
        const inside = (x: number, y: number) => {
          const u0 = (x - ox) * lob[0] + (y - oy) * lob[1], v = -(x - ox) * lob[1] + (y - oy) * lob[0]
          const u = -u0 // behind the head is +u
          if (Math.hypot(u, v) <= R) return true
          if (u <= 0 || u > TL) return false
          const half = R * (1 - u / TL) + Math.sin(u * 0.9 + flick * Math.PI) * 1.1
          return Math.abs(v + (flick ? 1 : -1) * (u / TL) * 2.4) <= half
        }
        blob(inside, Math.floor(ox - TL - 4), Math.floor(oy - TL - 4), Math.ceil(ox + TL + 4), Math.ceil(oy + TL + 4))
        // the ink swirl in the head
        for (let k = 0; k < 6; k++) {
          const a = k * 0.9 + flick
          put(Math.round(ox + Math.cos(a) * (2.4 - k * 0.3)), Math.round(oy + Math.sin(a) * (2.4 - k * 0.3)), INK)
        }
        for (let k = 0; k < 2; k++) {
          const sx = ox - lob[0] * (TL + 2 + k * 3), sy = oy - lob[1] * (TL + 2 + k * 3) + ((k + flick) % 2) * 2 - 1
          blob((x, y) => Math.hypot(x - sx, y - sy) <= 1, Math.floor(sx - 2), Math.floor(sy - 2), Math.ceil(sx + 2), Math.ceil(sy + 2))
        }
        break
      }
      case 'charge': {
        const [cx, cy] = clearOf([hands[0] + fwd * 4, hands[1] - 2], 4.4, fwd, 0)
        const rr = 1 + f.t * 3.2
        blob((x, y) => Math.hypot(x - cx, y - cy) <= rr, Math.floor(cx - 5), Math.floor(cy - 5), Math.ceil(cx + 5), Math.ceil(cy + 5))
        // specks being sucked in from all round
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + f.t * 2
          const d = 12 - f.t * 7
          put(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.8), INK)
          put(Math.round(cx + Math.cos(a) * (d + 1.5)), Math.round(cy + Math.sin(a) * (d + 1.5) * 0.8), INK)
        }
        break
      }
      case 'beam': {
        // a fat white blast from a big ball at the hands, straight out the way the cat faces, to the
        // edge of the frame; it swells, wobbles, then thins away
        const [cx, cy] = clearOf([hands[0] + dir[0] * 4, hands[1] + dir[1] * 4 - 2], 6.8, dir[0], dir[1])
        // heavy the whole time, then it snaps to a thin line for a moment and is gone
        if (f.t > 0.92) break
        const w = (f.t < 0.12 ? 0.4 + f.t / 0.2 : f.t <= 0.8 ? 1 : 0.18) * 5
        const wob = Math.sin(f.t * 40) * 0.6
        blob((x, y) => {
          if (Math.hypot(x - cx, y - cy) <= w + 1.6) return true
          const [u, v] = local(x, y, cx, cy)
          return u >= 0 && Math.abs(v) <= w + wob * (u / 30) - 0.4 + Math.min(1, u / 10)
        }, 0, 0, o.w - 1, o.h - 1)
        break
      }
      case 'chest': {
        // right on the chest, a moment: a white flash burst with ink rays, or a short white gash
        const [hx, hy] = at([3.6, 0, 5])
        if (f.cut) {
          const L = 6 * (1 - f.t * 0.3), W = 1.8 * (1 - f.t * 0.6)
          blob((x, y) => {
            const u = ((x - hx) * fwd + (y - hy)) / Math.SQRT2, v = (-(x - hx) * fwd + (y - hy)) / Math.SQRT2
            return Math.abs(u) <= L && Math.abs(v) <= W * (1 - Math.abs(u) / L) + 0.3
          }, hx - 8, hy - 8, hx + 8, hy + 8)
        } else {
          const rr = 3.6 * (1 - f.t * 0.6)
          blob((x, y) => Math.hypot(x - hx, y - hy) <= rr, hx - 5, hy - 5, hx + 5, hy + 5)
          if (f.t < 0.5) for (const a of [0.4, 1.6, 2.8, 4, 5.2]) line(Math.round(hx + Math.cos(a) * 5), Math.round(hy + Math.sin(a) * 5), Math.round(hx + Math.cos(a) * 7), Math.round(hy + Math.sin(a) * 7))
        }
        break
      }
      case 'crumbs': {
        // big chunky crumbs flung out of the mouth: white lumps with ink rims, arcing and falling
        const [mx, my] = mouth
        for (let k = 0; k < 3; k++) {
          const a = -1 + ((k * 37 + f.seed * 11) % 10) / 10 * 1.4
          const sp = 11 + ((k * 13 + f.seed * 7) % 5)
          const side = k === 1 ? -fwd * 0.7 : fwd
          const x = mx + side * Math.cos(a) * sp * f.t, y = my + Math.sin(a) * sp * f.t + 10 * f.t * f.t
          const rr = [3.2, 2.5, 1.9][k] * (1 - f.t * 0.2)
          const squish = (k + f.seed) % 2 === 0 ? 1.3 : 0.8 // lumpy, not perfect circles
          blob((px, py) => Math.hypot((px - x) / squish, py - y) <= rr, Math.floor(x - 4), Math.floor(y - 4), Math.ceil(x + 4), Math.ceil(y + 4))
        }
        break
      }
      case 'dust': {
        // round puffs rolling out both ways along the floor from under the cat
        const [fx0, fy] = at([0, 0, 0])
        for (const [side, rr] of [[-1, 2], [1, 1.8], [-1, 1.2], [1, 1.1]] as [number, number][]) {
          const big = rr > 1.5
          const sx = fx0 + side * (big ? 7 : 11) + side * f.t * 4, sy = fy - (big ? 1 : 0) - f.t * 2
          const r0 = rr * (1 - f.t * 0.45)
          blob((x, y) => Math.hypot(x - sx, y - sy) <= r0, Math.floor(sx - 3), Math.floor(sy - 3), Math.ceil(sx + 3), Math.ceil(sy + 3))
        }
        break
      }
      case 'flash': {
        // a cluster of round puffs with a little white space between, biggest at the muzzle
        const [mx, my] = muzzle
        const puffs: [number, number, number][] = f.big ? [[3, 0, 3], [8, -1, 2.1], [12, 0, 1.4], [5, -5, 1.3], [5, 5, 1.3]] : [[2.5, 0, 2], [6.5, -1, 1.2]]
        for (const [ox, oy, rr] of puffs) {
          const sx = mx + fwd * ox, sy = my + oy
          blob((x, y) => Math.hypot(x - sx, y - sy) <= rr, Math.floor(sx - rr - 1), Math.floor(sy - rr - 1), Math.ceil(sx + rr + 1), Math.ceil(sy + rr + 1))
        }
        break
      }
      case 'tracer': {
        // a rounded streak
        const [mx, my] = muzzle
        const x0 = mx + fwd * (14 + f.t * 6)
        blob((x, y) => { const u = (x - x0) * fwd; return u >= 0 && u <= 6 && Math.abs(y - my) <= (u < 1 || u > 5 ? 0.5 : 1) }, Math.min(x0, x0 + fwd * 6) - 1, my - 2, Math.max(x0, x0 + fwd * 6) + 1, my + 2)
        break
      }
      case 'shell': {
        const [mx, my] = muzzle
        const sx = mx - fwd * (2 + f.t * 9), sy = my - 3 - f.t * 12 + f.t * f.t * 12
        blob((x, y) => Math.hypot(x - sx, (y - sy) * 1.3) <= 1.3, Math.floor(sx - 2), Math.floor(sy - 2), Math.ceil(sx + 2), Math.ceil(sy + 2))
        break
      }
      case 'smoke': {
        const [mx, my] = muzzle
        for (const [ox, oy, rr] of [[3, 0, 1.4], [5, -3, 1.1]]) {
          const sx = mx + fwd * (ox + f.t * 2), sy = my + oy - f.t * 6, r = rr + f.t * 1.2
          blob((x, y) => Math.hypot(x - sx, y - sy) <= r, Math.floor(sx - 3), Math.floor(sy - 3), Math.ceil(sx + 3), Math.ceil(sy + 3))
        }
        break
      }
      case 'mag': {
        const [hx, hy] = hands
        const sx = hx - fwd * f.t, sy = hy + 2 + f.t * 7
        blob((x, y) => Math.hypot((x - sx) * 1.4, (y - sy) * 0.8) <= 1.8, Math.floor(sx - 2), Math.floor(sy - 3), Math.ceil(sx + 2), Math.ceil(sy + 3))
        break
      }
      case 'click': {
        // three little round sparks popping off the hands
        const [hx, hy] = hands
        for (const [dx, dy] of [[-3, -3], [0, -4], [3, -3]]) blob((x, y) => Math.hypot(x - hx - dx, y - hy - dy) <= 1, hx + dx - 2, hy + dy - 2, hx + dx + 2, hy + dy + 2)
        break
      }
      case 'bang': {
        // pa! a starburst up in the air off to one side, confetti drifting down from it, a wisp of smoke
        const [ox0, oy0] = at([1, f.side * 7, 23])
        // up off the head, however high the hop took it
        const [ox, oy] = clearOf([ox0 + f.side * 4, oy0 - 3], 4.5, 0, -1)
        if (f.t < 0.7) {
          const rr = 2.6 * (1 - f.t * 0.6)
          blob((x, y) => Math.hypot(x - ox, y - oy) <= rr, Math.floor(ox - 4), Math.floor(oy - 4), Math.ceil(ox + 4), Math.ceil(oy + 4))
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.2
            const r0 = 3.4 + f.t * 4, r1 = r0 + (i % 2 === 0 ? 3 : 1.6) * (1 - f.t * 0.7)
            line(Math.round(ox + Math.cos(a) * r0), Math.round(oy + Math.sin(a) * r0), Math.round(ox + Math.cos(a) * r1), Math.round(oy + Math.sin(a) * r1))
          }
        } else {
          const sx = ox + f.side, sy = oy - 3, r0 = 1.4 + (f.t - 0.7) * 2
          blob((x, y) => Math.hypot(x - sx, y - sy) <= r0, Math.floor(sx - 3), Math.floor(sy - 3), Math.ceil(sx + 3), Math.ceil(sy + 3))
        }
        // confetti: little bits fluttering down and out
        for (const [dx, vy, fl] of [[-5, 1, 0], [-2, 1.4, 1], [2.5, 1.2, 0], [5.5, 0.9, 1]] as [number, number, number][]) {
          const x = Math.round(ox + dx * (0.6 + f.t * 0.8)), y = Math.round(oy + 2 + f.t * f.t * 11 * vy)
          if ((fl + Math.round(f.t * 3)) % 2 === 0) { put(x, y, INK); put(x + 1, y, INK) } else { put(x, y, INK); put(x, y + 1, INK) }
        }
        break
      }
      case 'wand': {
        // the wand: a short stick up from the hands, its tip looping over the head (sparkles trailing off it),
        // then flicked forward into a burst of stars
        const [hx, hy] = hands
        const bx = hx, by = hy - 3
        const tipAt = (t: number): [number, number] => {
          if (t < 0.65) { const th = (t / 0.65) * Math.PI * 3; return [bx + fwd * (4 + Math.cos(th) * 4), by - 9 - Math.sin(th) * 3] }
          const u = Math.min(1, (t - 0.65) / 0.08)
          return [bx + fwd * (4 + 7 * u), by - 9 + 5 * u]
        }
        const [tx, ty] = tipAt(f.t)
        blob((x, y) => {
          const vx = tx - bx, vy = ty - by, l2 = vx * vx + vy * vy || 1
          const k = Math.max(0, Math.min(1, ((x - bx) * vx + (y - by) * vy) / l2))
          return Math.hypot(x - bx - vx * k, y - by - vy * k) <= 0.8
        }, Math.floor(Math.min(bx, tx)) - 2, Math.floor(Math.min(by, ty)) - 2, Math.ceil(Math.max(bx, tx)) + 2, Math.ceil(Math.max(by, ty)) + 2)
        sparkle(Math.round(tx), Math.round(ty), 2)
        for (let j = 1; j <= 3; j++) { const [sx, sy] = tipAt(Math.max(0, f.t - j * 0.05)); if (f.t - j * 0.05 > 0 && f.t < 0.75) sparkle(Math.round(sx), Math.round(sy), j < 2 ? 1 : 0) }
        if (f.t >= 0.7 && f.t < 0.98) {
          const u = (f.t - 0.7) / 0.28
          const cx = bx + fwd * 16, cy = by - 6
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + 0.3
            sparkle(Math.round(cx + Math.cos(a) * (2 + u * 9)), Math.round(cy + Math.sin(a) * (2 + u * 7)), u < 0.6 ? 2 : 1)
          }
        }
        break
      }
      case 'drops': {
        // water arcing from the hands to the ground out front, a little splash where it lands
        const [hx, hy] = hands
        const sx = hx + fwd * 6, sy = hy - 5
        const [fl0, fy0] = atLevel([16, 0, 0])
        const fx0 = fl0 + fwd * 8
        for (let i = 0; i < 4; i++) {
          const u = (f.t * 3 + i / 4) % 1
          const x = sx + (fx0 - sx) * u, y = sy + (fy0 - sy) * u - Math.sin(u * Math.PI) * 3
          blob((px, py) => Math.hypot((px - x) * 1.1, (py - y) * (py < y ? 0.7 : 1)) <= 1.6, Math.floor(x - 3), Math.floor(y - 3), Math.ceil(x + 3), Math.ceil(y + 3))
        }
        for (const s of [-1, 1]) { put(Math.round(fx0 + s * 2), Math.round(fy0 - 1), INK); put(Math.round(fx0 + s * 3), Math.round(fy0 - 2 - (Math.round(f.t * 8) % 2)), INK) }
        break
      }
      case 'clods': {
        // clods of earth flung up out of the ground where the hoe bit
        const [gx, gy] = atLevel([12, 0, 0.3])
        for (const [dx, h, rr] of [[-1.2, 14, 2.2], [-0.4, 18, 1.6], [0.6, 15, 2], [1.4, 10, 1.4]] as [number, number, number][]) {
          const x = gx + fwd * dx * (0.3 + f.t) * 7, y = gy - (4 * (0.15 + f.t * 0.85) - 4 * (0.15 + f.t * 0.85) ** 2) * h
          for (let py = Math.floor(y - rr); py <= y + rr; py++) for (let px = Math.floor(x - rr); px <= x + rr; px++) if (Math.hypot(px - x, py - y) <= rr) put(px, py, INK)
        }
        break
      }
      case 'chips': {
        // wood chips flying off where the axe struck
        const [px0, py0] = clearOf(at([8, 0, 4.5]), 2, fwd, 0)
        for (const [vx, vy, sz] of [[1, 7, 1.6], [1.6, 4, 1.2], [0.6, 9, 1.2], [2, 2, 1]] as [number, number, number][]) {
          const x = px0 + fwd * (2 + vx * f.t * 8), y = py0 - (5 * f.t - 7 * f.t * f.t) * vy * 0.6
          const flip = Math.round(f.t * 4 + vx) % 2
          blob((qx, qy) => Math.abs(qx - x) <= (flip ? sz : sz * 0.6) && Math.abs(qy - y) <= (flip ? sz * 0.6 : sz), Math.floor(x - 3), Math.floor(y - 3), Math.ceil(x + 3), Math.ceil(y + 3))
        }
        break
      }
      case 'rod': {
        // a fishing rod (just a stick) up from the hands, the line out to a bobber on the water in front
        const [hx, hy] = hands
        const cast = f.t >= 5 / 24
        const tx = hx + fwd * (cast ? 7 : -6), ty = hy - (cast ? 11 : 12)
        line(Math.round(hx), Math.round(hy), Math.round(tx), Math.round(ty))
        const far: [number, number] = [tx + fwd * 16, hy + 8]
        let bx: number, by: number
        if (!cast) { bx = tx; by = ty + 5 }
        else if (f.t < 8 / 24) { const u = (f.t - 5 / 24) / (3 / 24); bx = tx + (far[0] - tx) * u; by = ty + (far[1] - ty) * u - Math.sin(u * Math.PI) * 6 }
        else { bx = far[0]; by = far[1] + (f.bite ? 2 : Math.round(Math.sin(f.t * 40) * 0.6)) }
        // the line: a dotted sag from the rod tip to the bobber
        for (let i = 1; i < 12; i++) { const u = i / 12; if (i % 2 === 0) put(Math.round(tx + (bx - tx) * u), Math.round(ty + (by - ty) * u + Math.sin(u * Math.PI) * (cast ? 3 : 0)), INK) }
        blob((x, y) => Math.hypot(x - bx, y - by) <= 1.6, Math.floor(bx - 3), Math.floor(by - 3), Math.ceil(bx + 3), Math.ceil(by + 3))
        if (cast && f.t >= 8 / 24) {
          // ripples round it (or a splash when it bites)
          const ring = f.bite ? 3 : 2.5 + ((f.t * 24) % 4) * 0.6
          for (let a = 0; a < Math.PI * 2; a += 0.35) { const x = Math.round(bx + Math.cos(a) * ring * 1.6), y = Math.round(by + 1 + Math.sin(a) * ring * 0.5); if (Math.sin(a) > -0.2) put(x, y, INK) }
          if (f.bite) for (const s of [-1, 1]) { put(Math.round(bx + s * 2), Math.round(by - 3), INK); put(Math.round(bx + s * 3), Math.round(by - 5), INK) }
        }
        break
      }
      case 'zzz': {
        // Zs drifting up off the sleeping head, small then big
        // from above the head, off to the side, so they never sit on the face
        const [hx0, hy0] = at([0.5, 3, 17])
        const [ox, oy] = clearOf([hx0 + fwd * 3, hy0 - 4], 3, 0, -1)
        const SMALL = ['###', ' # ', '###'], BIG = ['####', '  # ', ' #  ', '####']
        for (let i = 0; i < 3; i++) {
          const u = (f.t + i / 3) % 1
          if (u > 0.92) continue
          stamp(u < 0.4 ? SMALL : BIG, Math.round(ox + 3 + u * 7 + Math.sin(u * 6) * 1.5), Math.round(oy - 3 - u * 13))
        }
        break
      }
      case 'paw': {
        // a paw raised beside the head, waggling, with little motion ticks
        const a = at([3, 8, 15]), b = at([3, -8, 15])
        const [px0, py0] = (a[0] - b[0]) * fwd > 0 ? a : b
        const sw = Math.sin(f.t * Math.PI * 4) * 2.5
        const x = px0 + sw, y = py0 - 2
        blob((qx, qy) => Math.hypot(qx - x, (qy - y) * 1.1) <= 2.4, Math.floor(x - 4), Math.floor(y - 4), Math.ceil(x + 4), Math.ceil(y + 4))
        const side = sw > 0 ? 1 : -1
        for (const dy of [-2, 0, 2]) put(Math.round(x + side * 4.5), Math.round(y + dy), INK)
        break
      }
      case 'emote': {
        // a feeling over (or on) the head
        const [ox, oy] = at([0.5, 0, 23])
        if (f.what === 'heart') {
          const HEART = [' ## ## ', '#######', '#######', ' ##### ', '  ###  ', '   #   '] // solid
          for (let i = 0; i < 2; i++) { const u = (f.t + i / 2) % 1; if (u < 0.9) stamp(HEART, Math.round(ox + (i === 0 ? -4 : 4) + Math.sin(u * 7) * 1.5), Math.round(oy - u * 10)) }
        } else if (f.what === 'anger') {
          // the cross-shaped vein on the brow, throbbing, and puffs of steam off the head
          const VEIN = [' # # ', '## ##', '     ', '## ##', ' # # ']
          const [vx, vy] = at([1, -5, 19])
          if (Math.round(f.t * 12) % 4 < 3) stamp(VEIN, Math.round(vx), Math.round(vy))
          for (const s of [-1, 1]) {
            const u = (f.t * 2 + (s > 0 ? 0.5 : 0)) % 1
            const [sx, sy] = at([0.5, s * 7, 19])
            const x = sx + s * u * 3, y = sy - u * 8, rr = 1 + u * 1.2
            blob((qx, qy) => Math.hypot(qx - x, qy - y) <= rr, Math.floor(x - 3), Math.floor(y - 3), Math.ceil(x + 3), Math.ceil(y + 3))
          }
        } else if (f.what === 'tears') {
          // tears streaming: a ribbon pouring from under each eye down the cheek to the chin, ripples running down it
          for (const sd of [-1, 1]) {
            const [ex, ey] = at([FRONT + 0.6, sd * EYE[1], EYE[2] - 1.4])
            const y0 = Math.round(ey) + 2, len = 6
            const xAt = (y: number) => ex + Math.sin((y - y0) * 0.5 + sd) * 0.5
            blob((qx, qy) => qy >= y0 && qy <= y0 + len && Math.abs(qx - xAt(qy)) <= 0.9, Math.floor(ex - 3), y0 - 1, Math.ceil(ex + 3), y0 + len + 1)
            // the flow: little ink ripples sliding down the ribbon
            for (let yy = y0 + 1; yy < y0 + len; yy++) if ((((yy - y0 - f.t * 12) % 4) + 4) % 4 < 1) put(Math.round(xAt(yy)), yy, INK)
          }
        } else if (f.what === 'notes') {
          const NOTE = ['  ##', '  # ', '  # ', '### ', '### ']
          for (let i = 0; i < 2; i++) { const u = (f.t + i / 2) % 1; if (u < 0.9) stamp(NOTE, Math.round(ox + (i === 0 ? -6 : 6) + Math.sin(u * 6) * 2), Math.round(oy + 4 - u * 12)) }
        }
        break
      }
      case 'broom': {
        // a broom, figuratively: just the stick, held at the cat's side, coming up to about its chin, its end on
        // the floor out front (on the level: the floor doesn't lean). No broom head: the sweep is drawn as a smear.
        const head = atLevel([9, 3 + f.s * 7, 0.6])
        const grip = at([3.6, 7.2, 4.6])
        // the top: up from the hands on screen (so it stays steep however the cat turns), leaning back from the floor end
        const lean = Math.sign(grip[0] - head[0]) || -1
        const top: [number, number] = [grip[0] + lean * 4, grip[1] - 11]
        const [bx, by] = head
        // the smear: the white wedge the stick's lower half sweeps through, from where the stroke began to where it
        // is now, fullest at the stick and thinning back to a sliver along the floor (so it reads as a sweep)
        if (f.from !== undefined && Math.abs(f.s - f.from) > 0.2) {
          const prev = atLevel([9, 3 + (f.s + (f.from - f.s) * 1.5) * 7, 0.6]) // exaggerated: a smear reads bigger than the move
          const aCur = Math.atan2(by - top[1], bx - top[0]), aPrev = Math.atan2(prev[1] - top[1], prev[0] - top[0])
          let span = aPrev - aCur
          if (span > Math.PI) span -= Math.PI * 2
          if (span < -Math.PI) span += Math.PI * 2
          const lCur = Math.hypot(bx - top[0], by - top[1]), lPrev = Math.hypot(prev[0] - top[0], prev[1] - top[1])
          const smear = (x: number, y: number) => {
            let a = Math.atan2(y - top[1], x - top[0]) - aCur
            if (a > Math.PI) a -= Math.PI * 2
            if (a < -Math.PI) a += Math.PI * 2
            const k = a / span // 0 at the stick, 1 back where the stroke began
            if (k < -0.04 || k > 1) return false
            const r = Math.hypot(x - top[0], y - top[1])
            const reach = lCur + (lPrev - lCur) * Math.max(0, k)
            // most of the way up the stick at the stick, down to the floor at the far end
            return r <= reach + 0.6 && r >= reach * (0.22 + 0.72 * Math.pow(Math.max(0, k), 0.7))
          }
          blob(smear, Math.floor(Math.min(top[0], bx, prev[0])) - 3, Math.floor(Math.min(top[1], by, prev[1])) - 3, Math.ceil(Math.max(top[0], bx, prev[0])) + 3, Math.ceil(Math.max(by, prev[1])) + 3)
        }
        // the stick over the smear: a thin white pole with an ink rim; its top passes behind the cat
        const vx = bx - top[0], vy = by - top[1], len2 = vx * vx + vy * vy || 1
        blob((x, y) => {
          // it stops short of the floor: the sweep below it is the smear's
          const t = Math.max(0, Math.min(0.62, ((x - top[0]) * vx + (y - top[1]) * vy) / len2))
          if (t < 0.4 && solid(x, y)) return false
          return Math.hypot(x - top[0] - vx * t, y - top[1] - vy * t) <= 1
        }, Math.floor(Math.min(top[0], bx)) - 2, Math.floor(Math.min(top[1], by)) - 2, Math.ceil(Math.max(top[0], bx)) + 2, Math.ceil(Math.max(top[1], by)) + 2)
        // dust: round puffs kicked out ahead of the stroke, drifting up as they go
        if (f.puff !== undefined) {
          const dirS = Math.sign(f.s) || 1
          for (const [dx, dy, rr] of [[6, -1, 1.8], [9.5, -3, 1.3], [7.5, -5.5, 1]] as [number, number, number][]) {
            const sx = bx + dirS * (dx + f.puff * 3), sy = by + dy - f.puff * 2, r0 = rr * (1 - f.puff * 0.4)
            blob((x, y) => Math.hypot(x - sx, y - sy) <= r0, Math.floor(sx - 3), Math.floor(sy - 3), Math.ceil(sx + 3), Math.ceil(sy + 3))
          }
        }
        break
      }
      case 'pow': {
        // a punch landing: a big round burst of puffs in front, a ring of little ones round it
        const [cx, cy] = centre
        // in front of the cat, or in front of the shoulder that threw it
        // ... and always clear of the cat, ring and all (a big body or a big coat pushes it further out)
        const [px, py] = clearOf(f.side !== undefined ? at([10, f.side * 4, 5]) : [cx + fwd * (f.small ? 12 : 14), cy + (f.small ? -1 : 2)], f.small ? 6 : 8, fwd, 0)
        const big = (f.small ? 2.4 : 3.6) * (1 - f.t * 0.5)
        blob((x, y) => Math.hypot(x - px, y - py) <= big, Math.floor(px - 5), Math.floor(py - 5), Math.ceil(px + 5), Math.ceil(py + 5))
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + 0.3
          const d = (f.small ? 4 : 5.5) + f.t * 4, rr = (f.small ? 1 : 1.4) * (1 - f.t * 0.6)
          const sx = px + Math.cos(a) * d, sy = py + Math.sin(a) * d * 0.8
          blob((x, y) => Math.hypot(x - sx, y - sy) <= rr, Math.floor(sx - 2), Math.floor(sy - 2), Math.ceil(sx + 2), Math.ceil(sy + 2))
        }
        break
      }
    }
  }
}

/**
 * The sitting tail as a chain of 12 bones from the root at the back of the body. At w = 0 it
 * rises behind in a soft swoop; at w = 1 it hugs the bottom of the body all the way round like a
 * band. Each bone moves a little after the one before it (root first, tip last).
 */
function tailChain(w: number, rx = 2.3, ry = 2.7): V3[] {
  const N = 12
  // rest: a soft swoop rising behind
  const rest: V3[] = [[-1.7, 0.4, 1.7]]
  for (let i = 0; i < N; i++) {
    const el = 0.25 + (i / N) * 1.25, yaw = Math.PI - 0.25, L = 0.85
    const [x, y, z] = rest[rest.length - 1]
    rest.push([x + Math.cos(yaw) * Math.cos(el) * L, y + Math.sin(yaw) * Math.cos(el) * L, z + Math.sin(el) * L])
  }
  // wrapped: hugging the bottom of the body all the way round (back, side, front, other side)
  const wrap = rest.map((_, i): V3 => {
    const th = Math.PI - (i / N) * 5.2
    return [Math.cos(th) * rx, Math.sin(th) * ry, 1 + (i === N ? 0.3 : 0)]
  })
  // each bone moves a beat after the one before it: the root leads, the tip follows
  return rest.map((p, i) => {
    const k = ease(Math.max(0, Math.min(1, w * 1.6 - (i / N) * 0.6)))
    return [p[0] + (wrap[i][0] - p[0]) * k, p[1] + (wrap[i][1] - p[1]) * k, p[2] + (wrap[i][2] - p[2]) * k]
  })
}

export function draw(pl: Plan, a: number, mood: Mood, look: Look = {}, pose?: Pose, info?: ColorInfo, fx?: Fx[]): Bitmap {
  let body = look.tail === undefined ? pl.body : [...pl.body.filter((b) => b.mat !== 'tail'), ...tail(2.6, 7.6, look.tail)]
  if (pose !== undefined && (pose.wrap ?? 0) > 0) {
    // sitting like a cat: the tail is a chain of bones that curls down and round the front of the
    // feet, the root leading and each bone following a beat behind (so it rolls round, not snaps)
    // (round a big blob body, out at its widest so it shows)
    const wide = blobWidest(look.body)
    body = [...body.filter((b) => b.mat !== 'tail'), { mat: 'tail', d: tube(wide === null ? tailChain(pose.wrap!) : tailChain(pose.wrap!, wide[0] + 0.5, wide[1] + 0.5), 0.85, 0.7).d }]
  } else if (pose !== undefined && pose.noTail) {
    body = body.filter((b) => b.mat !== 'tail')
  } else if (pose !== undefined) {
    // swing the tail about its root
    const root: V3 = [-1.4, 1, 1.4]
    // bend along its length: the root turns by `tail`, the tip by `tailTip`, smoothly between
    const a0 = pose.tail, a1 = pose.tailTip ?? pose.tail
    const bend = (p: V3) => a0 + (a1 - a0) * Math.min(1, Math.hypot(p[0] - root[0], p[1] - root[1], p[2] - root[2]) / 9)
    body = [
      ...body.filter((b) => b.mat !== 'tail'),
      ...body.filter((b) => b.mat === 'tail').map((t) => ({ mat: t.mat, d: (p: V3) => t.d(rotZAbout(p, root, -bend(p))) * 0.85 })),
    ]
  }
  // feet: the chosen style, each lifted (and its toe flopped up) by the walk cycle
  body = [...body.filter((b) => b.mat !== 'feet'), ...feetShapes(look.feet ?? 'nubs', pose?.lift ?? [0, 0])]
  // body build: stretch the body and the clothes (head, head accessories and tail stay put)
  const inv = unbuild(look.body)
  const clothesSet = new Set(look.clothes ?? [])
  const fit = (s: Sdf) => (inv === null ? s : built(s, inv))
  const invC = look.hangs ? unbuild(look.body, true) : inv
  const fitC = (s: Sdf) => (invC === null ? s : built(s, invC))
  // feet keep their size: they only move out with the body (forward, and apart)
  const [fgx, fgy] = buildFeet(look.body)
  const footFit = (s: Sdf): Sdf => (fgx === 0 && fgy === 0 ? s : { mat: s.mat, d: (p) => s.d([p[0] - fgx, p[1] - Math.sign(p[1]) * fgy, p[2]]) })
  // a blob build: the torso is a plain ball (a soft egg once a tall build stretches it), not warped
  const blobBody = buildBlob(look.body) ?? null
  // ... and its tail comes out of the blob's side, not from deep inside it
  const ts = (pose?.wrap ?? 0) > 0 ? null : blobTailShift(look.body, look.tail)
  const tailFit = (s: Sdf): Sdf => {
    if (ts === null) return s
    const { shift: [sx, sy, sz], root: [rx, ry, rz], scale: k } = ts
    // moved out, and scaled about where it grows from
    return { mat: s.mat, d: (p) => s.d([rx + (p[0] - sx - rx) / k, ry + (p[1] - sy - ry) / k, rz + (p[2] - sz - rz) / k]) * k }
  }
  const posed = scene(pl.head, ...body.map((s) => (s.mat === 'tail' ? tailFit(s) : s.mat === 'feet' ? footFit(s) : blobBody !== null && s.mat === 'fur' ? blobBody : fit(s))), ...(look.hideEars ? [] : look.ears === undefined || look.ears === 'cat' ? pl.ears : earShapes(look.ears)), ...(look.parts ?? []).map((s) => (clothesSet.has(s) ? fitC(s) : s)))
  // the whole cat hops, leans and squashes about its feet
  // posed <-> model (see poseForward); the folds and stretches shrink distances, so step carefully
  // a tall build stretches the body up (a negative sit) and the head rides up on it
  const tall = buildTall(look.body)
  const P0: Pose = tall > 0 ? { ...(pose ?? STILL), sit: (pose?.sit ?? 0) - tall } : pose ?? STILL
  const unpose = (p: V3) => poseInverse(P0, p)
  const poseFwd = (p: V3) => poseForward(P0, p)
  const lip = Math.min(1, 1 - foldOf(P0), 1 - P0.squash) / bulgeOf(P0)
  const sdf = (p: V3) => { const h = posed(unpose(p)); return lip === 1 ? h : { d: h.d * lip, mat: h.mat } }
  const turn = Math.PI / 4 + a
  const center: V3 = [0, 0, pl.mid + LIFT]
  const mats = coatMats(pl, look)
  const m2: Record<string, Material> = {}
  const onBody = (k: string) => inv !== null && (k === 'fur' || k === 'feet')
  for (const [k, m] of Object.entries(mats)) m2[k] = { ...m, pattern: m.pattern === undefined ? undefined : onBody(k) ? (p, n) => m.pattern!(inv!(unpose(rot(p, -turn))), rot(n, -turn)) : (p, n) => m.pattern!(unpose(rot(p, -turn)), rot(n, -turn)) }
  // trace the scene once; every pass below shades these same hits
  const hits = traceIso((p) => sdf(rot(p, -turn)), W, HH, SCALE, center)
  // the same geometry at sprite size (one sample per 2x2 block), for shading and colour
  const halfHits: (Hit | null)[] = []
  for (let y = 0; y < HH / 2; y++) for (let x = 0; x < W / 2; x++) halfHits.push(hits[(2 * y + 1) * W + 2 * x + 1])
  const native = shadeHits(hits, W, HH, SCALE, m2, WHITE)
  // halve
  const o = new Bitmap(W / 2, HH / 2)
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    let solid = 0
    let ink = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const v = native.get(2 * x + dx, 2 * y + dy)
      if (v !== CLEAR) solid++
      if (v === INK) ink++
    }
    if (solid >= 2) o.set(x, y, ink >= 2 ? INK : PAPER)
  }
  // clean the silhouette: fill one-pixel notches, drop one-pixel spurs (two passes)
  for (let pass = 0; pass < 2; pass++) {
    const m = o.px.slice()
    const solidAt = (x: number, y: number) => x >= 0 && y >= 0 && x < o.w && y < o.h && m[y * o.w + x] !== CLEAR
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => solidAt(x + dx, y + dy)).length
      if (!solidAt(x, y) && n >= 3) o.set(x, y, PAPER)
      else if (solidAt(x, y) && n <= 1) o.set(x, y, CLEAR)
    }
  }
  // drop stray interior specks: a lone ink pixel with no ink around it
  {
    const m = o.px.slice()
    const inkAt = (x: number, y: number) => x >= 0 && y >= 0 && x < o.w && y < o.h && m[y * o.w + x] === INK
    for (let y = 1; y < o.h - 1; y++) for (let x = 1; x < o.w - 1; x++) {
      if (!inkAt(x, y)) continue
      let k = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inkAt(x + dx, y + dy)) k++
      if (k === 0) o.set(x, y, PAPER)
    }
  }
  const src = o.px.slice()
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    if (src[y * o.w + x] === CLEAR) continue
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx; const yy = y + dy; return xx < 0 || yy < 0 || xx >= o.w || yy >= o.h || src[yy * o.w + xx] === CLEAR })) o.set(x, y, INK)
  }
  // Big dark areas go to halftone: any ink pixel with ink all round it becomes a dot screen, so a
  // dark coat or hat keeps a solid ink rim (its outline) and its middle is a light 25% dot screen.
  // Only the true-black accents (material gearS, e.g. the mohawk) stay solid.
  const solidMats: Record<string, Material> = {}
  for (const k of Object.keys(m2)) solidMats[k] = k === 'gearS' ? { dark: 1 } : (look.bold && !k.startsWith('gear')) || (k === 'tail' && (look.tailTone !== undefined || look.coat === 'socks')) || (k === 'fur' && (look.shirt !== undefined || look.bodyDark)) ? m2[k] : { dark: 0 }
  const solidRender = shadeHits(hits, W, HH, SCALE, solidMats, WHITE)
  const keepSolid = (x: number, y: number) => {
    let n = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (solidRender.get(2 * x + dx, 2 * y + dy) === INK) n++
    return n >= 3
  }
  const inked = o.px.slice()
  const isInk = (x: number, y: number) => x >= 0 && y >= 0 && x < o.w && y < o.h && inked[y * o.w + x] === INK
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
    if (!isInk(x, y) || keepSolid(x, y)) continue
    if (isInk(x - 1, y) && isInk(x + 1, y) && isInk(x, y - 1) && isInk(x, y + 1)) o.set(x, y, PAPER)
  }
  // where the eyes land (only the sides of the face turned toward us)
  const f = pl.face
  const seen: Record<number, [number, number]> = {}
  const eyeWhite = new Map<string, boolean>()
  for (const s of [-1, 1]) {
    const local: V3 = [f.c[0] + f.front * 0.96, f.c[1] + s * f.eyeY, f.c[2] + f.eyeZ]
    // the big cube head has a flat face, so an eye shows for as long as the face plane does
    // (just a hint of the side tilt, so the far eye goes a touch before the near one)
    const n = rot(poseDir(P0, [1, s * 0.12, 0]), turn)
    if (dot(n, CAM_D) > -0.06) continue
    const P = rot(poseFwd(local), turn)
    const rel: V3 = [P[0] - center[0], P[1] - center[1], P[2] - center[2]]
    seen[s] = [Math.round((W / 2 + dot(rel, CAM_R) / SCALE) / 2 - 0.5), Math.round((HH / 2 - dot(rel, CAM_U) / SCALE) / 2 - 0.5)]
    // white eye or black eye: decided in 3D from the coat right at the eye (a solid dark marking
    // there means white eyes), so it can't flicker as the head turns
    const mark = mats.head.pattern?.(local, [1, 0, 0])
    eyeWhite.set(seen[s].join(','), look.bold === true && mark !== null && mark !== undefined && mark >= 0.5)
  }
  const eyes = Object.values(seen)
  // the joy mouth: a long open D (flat top, straight sides, rounded bottom corners) painted on the face plane like a
  // card, projected the same way as the eyes, so it narrows and slides round with the face as the head turns
  const joyMouth: [number, number][] = []
  if (mood === 'joy' && !look.hideEyes && eyes.length > 0) {
    const n = rot(poseDir(P0, [1, 0, 0]), turn)
    if (dot(n, CAM_D) < -0.12) {
      const px = new Set<string>()
      const top = f.c[2] + f.eyeZ - 2.3, bottom = f.c[2] + f.eyeZ - 4.5, half = 2.4, r = 0.9
      for (let z = bottom; z <= top; z += 0.12) for (let yy = -half; yy <= half; yy += 0.12) {
        const cx = Math.max(0, Math.abs(yy) - (half - r)), cz = Math.max(0, bottom + r - z)
        if (cx * cx + cz * cz > r * r) continue
        const P = rot(poseFwd([f.c[0] + f.front * 0.97, f.c[1] + yy, z]), turn)
        const rel: V3 = [P[0] - center[0], P[1] - center[1], P[2] - center[2]]
        px.add(`${Math.round((W / 2 + dot(rel, CAM_R) / SCALE) / 2 - 0.5)},${Math.round((HH / 2 - dot(rel, CAM_U) / SCALE) / 2 - 0.5)}`)
      }
      for (const k of px) { const [mx, my] = k.split(',').map(Number); joyMouth.push([mx, my]) }
    }
  }
  // the eye zone: always clean paper, nothing drawn into it (gear stamped later may frame it)
  const inEyeZone = (x: number, y: number) => eyes.length > 0 && x >= Math.min(...eyes.map((e) => e[0])) - 2 && x <= Math.max(...eyes.map((e) => e[0])) + 3 && y >= eyes[0][1] - 3 && y <= eyes[0][1] + 3
  // which pixels are accessory (so the eye-zone clean-up leaves 3D glasses, masks etc. alone)
  const gearMats: Record<string, Material> = {}
  for (const k of Object.keys(m2)) gearMats[k] = { dark: k.startsWith('gear') ? 1 : 0 }
  const gearRender = shadeHits(hits, W, HH, SCALE, gearMats, WHITE, false)
  const isGear = (x: number, y: number) => {
    let n = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (gearRender.get(2 * x + dx, 2 * y + dy) === INK) n++
    return n >= 1
  }
  // mostly covered by gear (3 of the 4 native pixels): what it takes to hide an eye
  const underGear = (x: number, y: number) => {
    let n = 0
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (gearRender.get(2 * x + dx, 2 * y + dy) === INK) n++
    return n >= 3
  }
  {
    const m = o.px.slice()
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      if (!inEyeZone(x, y) || m[y * o.w + x] !== INK || isGear(x, y) || keepSolid(x, y)) continue
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (m[(y + dy) * o.w + x + dx] ?? CLEAR) === CLEAR)
      if (!edge) o.set(x, y, PAPER)
    }
  }
  if (info !== undefined) info.base = new Bitmap(o.w, o.h).draw(o, 0, 0)
  // soft light: just a touch of dither tucked into the shadowed edges, never more than two
  // pixels in from the silhouette, never in the eye zone
  const lit = shadeHits(halfHits, W / 2, HH / 2, SCALE * 2, {}, [0, 0, 0, 0.3], false)
  const fin = o.px.slice()
  const clearAt = (x: number, y: number) => x < 0 || y < 0 || x >= o.w || y >= o.h || fin[y * o.w + x] === CLEAR
  for (let y = 1; y < o.h - 1; y++) for (let x = 1; x < o.w - 1; x++) {
    if (fin[y * o.w + x] !== PAPER || inEyeZone(x, y) || isGear(x, y)) continue
    const touching = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => clearAt(x + dx, y + dy))
    const near = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, 1], [1, -1], [-1, -1]].some(([dx, dy]) => clearAt(x + dx, y + dy))
    if (!touching && near && lit.get(x, y) === INK) o.set(x, y, INK)
  }
  // eyes: 2 wide x 4 tall, a flat 3-wide line when happy
  for (const [x, y] of look.hideEyes ? [] : eyes) {
    // an eye stays hidden only when an accessory really covers its middle
    if (underGear(x, y + 1) && underGear(x + 1, y + 1)) continue
    const eyeColor = eyeWhite.get(`${x},${y}`) === true ? PAPER : INK
    // never punch a white eye through a dark accessory (a mask, a hood)
    if (eyeColor === PAPER && (isGear(x, y + 1) || isGear(x + 1, y + 1))) continue
    const eye: [number, number][] =
      mood === 'closed' ? [[x - 1, y + 1], [x, y + 1], [x + 1, y + 1], [x + 2, y + 1]]
      : mood === 'happy' || mood === 'joy' ? [[x - 1, y + 1], [x, y], [x + 1, y], [x + 2, y + 1]] // ^
      : mood === 'surprised' ? [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] // shrunk to dots
      : mood === 'dead' ? [[x - 1, y - 1], [x + 2, y - 1], [x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1], [x - 1, y + 2], [x + 2, y + 2]] // X
      : mood === 'fierce' ? [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1], [x, y + 2], [x + 1, y + 2], [eyes.length > 1 && x < Math.max(...eyes.map((e) => e[0])) ? x : x + 1, y - 1]] // slanted: outer corner up
      : mood === 'sleepy' ? [[x - 1, y + 1], [x, y + 1], [x + 1, y + 1], [x + 2, y + 1], [x, y + 2], [x + 1, y + 2]] // lids half down
      : [[x, y - 1], [x + 1, y - 1], [x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1], [x, y + 2], [x + 1, y + 2]]
    for (const [ex, ey] of eye) o.set(ex, ey, eyeColor)
    if (info !== undefined) (info.eyePx ??= []).push(...eye)
  }
  // face gear, stamped around the eyes so it stays crisp
  const L = seen[1] ?? seen[-1]
  const Rr = seen[-1] ?? seen[1]
  if (L !== undefined && Rr !== undefined) {
    const x0 = Math.min(L[0], Rr[0])
    const x1 = Math.max(L[0], Rr[0])
    const y = L[1]
    const face = look.face ?? []
    if (joyMouth.length > 0 && !joyMouth.some(([mx, my]) => isGear(mx, my))) {
      const ink = joyMouth.some(([mx, my]) => keepSolid(mx, my)) ? PAPER : INK
      for (const [mx, my] of joyMouth) o.set(mx, my, ink)
      if (info !== undefined) (info.eyePx ??= []).push(...joyMouth)
    }
    // the surprised mouth: a little o centred under the eyes (only when the face is square on)
    if (mood === 'surprised' && !look.hideEyes && seen[1] !== undefined && seen[-1] !== undefined) {
      const mid = Math.floor((x0 + x1 + 1) / 2)
      const mouth: [number, number][] = [[mid, y + 3], [mid + 1, y + 3], [mid, y + 4], [mid + 1, y + 4]]
      if (!mouth.some(([mx, my]) => isGear(mx, my))) {
        const ink = mouth.some(([mx, my]) => keepSolid(mx, my)) ? PAPER : INK
        for (const [mx, my] of mouth) o.set(mx, my, ink)
        if (info !== undefined) (info.eyePx ??= []).push(...mouth)
      }
    }
    if (face.includes('shades')) {
      // big dramatic shades: two lenses wider and taller than the eyes, a bridge, a glint in each
      for (const ex of [x0, x1]) {
        for (let dx = -2; dx <= 3; dx++) for (let dy = -2; dy <= 3; dy++) {
          const corner = (dx === -2 || dx === 3) && (dy === 3 || dy === -2)
          if (!corner) o.set(ex + dx, y + dy, INK)
        }
        o.set(ex - 1, y - 1, PAPER)
        o.set(ex, y - 1, PAPER)
      }
      for (let x = x0 + 3; x <= x1 - 2; x++) o.set(x, y - 2, INK)
    }
    if (face.includes('round')) {
      // big round glasses: a thin ring round each eye, a bridge, arms back to the edge of the face
      for (const ex of [x0, x1]) {
        const cx = ex + 0.5
        const cy = y + 0.5
        for (let yy = y - 4; yy <= y + 5; yy++) for (let xx = ex - 4; xx <= ex + 5; xx++) {
          const d = Math.hypot(xx + 0.5 - cx - 0.5, yy + 0.5 - cy - 0.5)
          if (d > 3.3 && d < 4.3) o.set(xx, yy, INK)
        }
      }
      for (let x = x0 + 4; x <= x1 - 3; x++) o.set(x, y - 1, INK)
    }
    if (face.includes('surgical')) {
      // a white surgical mask over the mouth: outlined, a pleat, ear loops
      const top = y + 4
      for (let x = x0 - 3; x <= x1 + 4; x++) for (let yy = top; yy <= top + 4; yy++) {
        const rim = x === x0 - 3 || x === x1 + 4 || yy === top || yy === top + 4
        o.set(x, yy, rim ? INK : PAPER)
      }
      for (let x = x0 - 1; x <= x1 + 2; x += 2) o.set(x, top + 2, INK)
      o.set(x0 - 4, top + 1, INK)
      o.set(x1 + 5, top + 1, INK)
    }
    if (face.includes('star')) {
      const sx = x1 + 3
      const sy = y + 4
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) o.set(sx + dx, sy + dy, INK)
    }
    if (face.includes('patch') && seen[-1] !== undefined) {
      const [px, py] = seen[-1]
      for (let dx = -1; dx <= 2; dx++) for (let dy = -1; dy <= 3; dy++) o.set(px + dx, py + dy, INK)
      o.set(px + 2, py - 2, INK)
      o.set(px + 3, py - 3, INK)
    }
    if (face.includes('nosering')) { const cx = Math.round((x0 + x1) / 2); o.set(cx, y + 4, INK); o.set(cx, y + 5, INK) }
  }
  if (info !== undefined) {
    // what's under each sprite pixel: material (fur / marking / accessory / clothes) and light
    info.at = (x, y) => {
      const h = x < 0 || y < 0 || x >= o.w || y >= o.h ? null : halfHits[y * o.w + x]
      if (h === null) return null
      const light = Math.max(0, Math.min(1, (h.n[0] * LIGHT[0] + h.n[1] * LIGHT[1] + h.n[2] * LIGHT[2] + 0.25) / 1.15))
      if (h.mat.startsWith('gear')) {
        const q = unpose(rot(h.p, -turn))
        // clothes by shape when we know them; otherwise anything below the head
        if (look.clothes !== undefined ? look.clothes.some((c) => c.d(invC === null ? q : invC(q)) < 0.4) : q[2] < pl.face.c[2] - 5.4) return { role: 'clothes', light }
        return { role: h.mat === 'gearW' ? 'gearLight' : 'gear', light }
      }
      const pat = m2[h.mat]?.pattern?.(h.p, h.n)
      const dark = (m2[h.mat]?.dark ?? 0) >= 0.5 || (pat !== null && pat !== undefined && pat >= 0.5)
      return { role: pat !== null && pat !== undefined && pat >= 1.5 ? 'accent' : dark ? 'mark' : 'fur', light }
    }
  }
  // attack effects over everything (painted like the eyes: ink in the eye colour, paper light)
  if (fx !== undefined && fx.length > 0) {
    const project = (m: V3, posed = true): [number, number] => {
      const P = rot(posed ? poseFwd(m) : poseForward({ ...STILL, yaw: P0.yaw }, m), turn)
      const rel: V3 = [P[0] - center[0], P[1] - center[1], P[2] - center[2]]
      return [Math.round((W / 2 + dot(rel, CAM_R) / SCALE) / 2 - 0.5), Math.round((HH / 2 - dot(rel, CAM_U) / SCALE) / 2 - 0.5)]
    }
    drawFx(o, fx, (m) => project(m), (x, y) => { if (info !== undefined) (info.eyePx ??= []).push([x, y]) }, (m) => project(m, false))
  }
  return o
}

export function up(b: Bitmap, n: number): Bitmap {
  const o = new Bitmap(b.w * n, b.h * n)
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.set(x, y, b.get(Math.floor(x / n), Math.floor(y / n)))
  return o
}


// ---------------------------------------------------------------- the punks, on the big-cube body

export const CUBE = PLANS.find((p) => p.name === 'BIG CUBE')!
/** The same cat with a much rounder head (corners nearly as round as they can be): for the big cats. */
export const ROUND_CUBE: Plan = { ...CUBE, name: 'ROUND CUBE', head: asHead(roundBox(CUBE.face.c, [6.2, 7.6, 6], 5.6)) }
export const HC = CUBE.face.c // head centre; head half-size [6.2, 7.6, 6], top at z = HC[2] + 6
export const TOPZ = HC[2] + 6
export const gear = (mat: 'gearK' | 'gearW' | 'gearS', s: Sdf): Sdf => ({ mat, d: s.d })

export const hood = (mat: 'gearK' | 'gearW'): Sdf => ({ mat, d: (p) => Math.max(roundBox(HC, [7.2, 8.8, 7], 4).d(p), -roundBox(HC, [6.4, 7.8, 6.2], 3.6).d(p), p[0] - 5.2) })

// ---- accessory kit: every piece is a real 3D volume that turns with the head

export const FRONT = 6.2 // the face plane (head half-depth)
export const EYE: V3 = [FRONT, 3, HC[2] + 1.4] // right eye (y +3); left is y -3
/** Torus facing +x (a ring you look through), centre c, ring radius R, tube r. */
export const ringX = (c: V3, R: number, r: number): Sdf => ({ mat: 'gearS', d: (p) => Math.hypot(Math.hypot(p[1] - c[1], p[2] - c[2]) - R, p[0] - c[0]) - r })
export const tubeS = (mat: 'gearS' | 'gearW', pts: V3[], r0: number, r1 = r0): Sdf => ({ mat, d: tube(pts, r0, r1).d })
/** A shell hugging the head, `t` thick, kept where `keep(p) < 0`. */
export const headShell = (mat: 'gearS' | 'gearW', t: number, keep: (p: V3) => number, grow = 0.4): Sdf =>
  ({ mat, d: (p) => Math.max(Math.abs(roundBox(HC, [6.2 + grow, 7.6 + grow, 6 + grow], 3.6 + grow).d(p)) - t, keep(p)) })
export const cone = (base: V3, tip: V3, r: number, mat: 'gearS' | 'gearW' = 'gearS'): Sdf => ({ mat, d: tube([base, tip], r, 0.15).d })

/** Where the big-cube cat's ears are, so a hat can leave holes for them. */
export const earAt = (s: number): V3 => [HC[0] - 0.4, s * 5.2, HC[2] + 5.8]
export const awayFromEars = (d: number, p: V3) => Math.max(d, -Math.min(...[-1, 1].map((s) => { const e = earAt(s); return Math.hypot((p[0] - e[0]) / 2.6, (p[1] - e[1]) / 2.9, (p[2] - e[2]) / 4.2) - 1 })) * 2)

export const PUNKS: [string, Look][] = [
  ['MOHAWK', { tail: 'bolt', parts: [gear('gearS', roundBox([-0.4, 0, TOPZ + 2.4], [5.8, 1.4, 3.6], 1.2))] }],
  ['PHONES', { tail: 'swoop', parts: [
    gear('gearS', roundBox([-0.4, 0, TOPZ + 1.4], [1.8, 9, 1.4], 1.2)),
    ...[-1, 1].map((s) => gear('gearS', roundBox([-0.4, s * 9.4, HC[2] + 0.2], [3.6, 2.2, 4.6], 1.8))),
  ] }],
  ['GLASSES', { tail: 'curl', coat: 'calico', parts: [
    ...[-1, 1].map((s) => ringX([FRONT + 0.9, s * EYE[1], EYE[2]], 2.6, 0.42)),
    tubeS('gearS', [[FRONT + 0.9, -0.5, EYE[2] + 0.9], [FRONT + 1.1, 0, EYE[2] + 1.2], [FRONT + 0.9, 0.5, EYE[2] + 0.9]], 0.35),
    ...[-1, 1].map((s) => tubeS('gearS', [[FRONT + 0.7, s * 5.6, EYE[2] + 0.4], [FRONT - 1, s * 7.9, EYE[2] + 0.4], [-1, s * 8, EYE[2] + 0.2]], 0.35)),
  ] }],
  // a forward cap: domed crown, a rounder, softer bill
  ['CAP', { tail: 'bolt', coat: 'tabby', parts: [
    gear('gearS', cutBelow(E([-0.4, 0, TOPZ - 1], [7.2, 8.6, 5.2]), TOPZ - 0.6)),
    // the bill sits up on the brow and tips up a touch, so from the front it doesn't cross the eyes
    gear('gearS', droop(cutBelow(E([FRONT + 0.6, 0, TOPZ + 1.2], [4.2, 6.2, 1.1]), TOPZ + 0.5), 0.02, 0)),
    gear('gearW', E([-0.4, 0, TOPZ + 3.9], [1.1, 1.1, 0.9])),
  ] }],
  // a black fabric mask over the lower face, its strap running right round the back of the head
  ['MASK', { tail: 'plume', parts: [
    headShell('gearS', 0.5, (p) => Math.max(p[2] - (HC[2] - 0.4), HC[2] - 5.4 - p[2], 2.2 - p[0])),
    headShell('gearS', 0.35, (p) => Math.max(Math.abs(p[2] - (HC[2] - 0.6)) - 0.45, p[0] - 2.4), 0.25),
  ] }],
  // shades: two chunky lenses with a white gap at the nose, a thin bridge up high, thick arms
  ['SHADES', { tail: 'plume', hideEyes: true, parts: [
    ...[-1, 1].map((s) => gear('gearS', roundBox([FRONT + 0.9, s * 3.6, EYE[2] + 0.4], [0.7, 2.5, 2.2], 0.8))),
    tubeS('gearS', [[FRONT + 1, -1.2, EYE[2] + 2.1], [FRONT + 1.1, 0, EYE[2] + 2.4], [FRONT + 1, 1.2, EYE[2] + 2.1]], 0.3),
    ...[-1, 1].map((s) => tubeS('gearS', [[FRONT + 0.4, s * 6, EYE[2] + 1.4], [FRONT - 1.4, s * 8, EYE[2] + 1.4], [-1, s * 8.1, EYE[2] + 1.2]], 0.45)),
  ] }],
  // the sun hat: a soft crown and a wide brim sloping down all round
  ['SUN HAT', { tail: 'curl', coat: 'cow', parts: [
    gear('gearW', cutBelow(E([0, 0, TOPZ - 0.4], [6.8, 8.2, 4.4]), TOPZ - 1.6)),
    { mat: 'gearW', d: (p) => Math.max(Math.abs(Math.hypot(p[0] / 1.18, p[1] / 1.08) * 0.42 + p[2] - (TOPZ + 1.4)) - 0.5, Math.hypot(p[0] / 1.18, p[1] / 1.08) - 11.6, 6.2 - Math.hypot(p[0] / 1.18, p[1] / 1.08)) },
  ] }],
  // a black hoodie: hood up and black body, the white face, ears and tail showing
  ['HOOD', { tail: 'curl', bodyDark: true, parts: [{ ...hood('gearK'), mat: 'gearS' }] }],
  // ---- more concepts
  // a brimless knit cap with a fat folded cuff, ears poking out through it
  ['KNIT CAP', { tail: 'swoop', coat: 'siamese', parts: [
    { mat: 'gearW', d: (p) => awayFromEars(Math.max(roundBox([-0.4, 0, TOPZ - 0.2], [6.9, 8.3, 3.4], 3.2).d(p), TOPZ - 3 - p[2]), p) },
    // a fat rolled cuff, fully rounded like a pillow
    { mat: 'gearS', d: (p) => awayFromEars(roundBox([0, 0, TOPZ - 2.7], [7.6, 9, 1.75], 1.75).d(p), p) },
  ] }],
  // the pompadour, with the hair carried back between the ears
  ['POMP', { tail: 'plume', coat: 'cow', parts: [gear('gearS', smooth(1.2,
    E([3.6, 0, TOPZ + 1.6], [6, 7.2, 3.6]), E([7.4, 0, TOPZ + 3.4], [2.6, 5, 2.2]),
    roundBox([-2.4, 0, TOPZ + 0.2], [4.6, 3.4, 1.6], 1.4), roundBox([-6.4, 0, TOPZ - 2.6], [1.4, 3.6, 3.6], 1.3)))] }],
  // a beret: a flat soft disc tipped to one side, with a little stalk
  ['BERET', { tail: 'bolt', parts: [
    gear('gearS', E([-0.6, -1.4, TOPZ + 1.4], [7.6, 8.6, 2.2])),
    // a big cartoon stalk on top: thick at the root, curling over, with a round knob at the end
    gear('gearS', tube([[-0.6, -1.4, TOPZ + 3], [-0.9, -1.8, TOPZ + 6.4], [-0.2, -3.2, TOPZ + 8.8], [1.2, -4.4, TOPZ + 9.2]], 1, 0.8)),
    gear('gearS', E([1.6, -4.8, TOPZ + 8.8], [1.5, 1.5, 1.5])),
  ] }],
  ['TABBY', { tail: 'swoop', coat: 'tabby', tailTone: 'bands', parts: [] }],
  ['HACHIMAKI', { tail: 'swoop', parts: [
    headShell('gearS', 0.6, (p) => Math.abs(p[2] - (TOPZ - 1.4)) - 1, 0.5),
    gear('gearS', E([-7.4, 1.4, TOPZ - 1.2], [1.6, 2, 1.6])),
    ...[-1, 1].map((s) => tubeS('gearS', [[-7.6, 1.4, TOPZ - 1.2], [-9.6, 1.4 + s * 3, TOPZ - 2.6], [-10.8, 1.4 + s * 5, TOPZ - 5.4]], 0.7, 0.4)),
  ] }],
  ['HORNS', { tail: 'bolt', tailTone: 'black', parts: [-1, 1].map((s) => tubeS('gearS', [[1, s * 4.4, TOPZ - 1], [0.6, s * 5.6, TOPZ + 2.4], [1.8, s * 6.6, TOPZ + 4.6], [3.2, s * 6.4, TOPZ + 5.6]], 1.4, 0.3)) }],
  ['BOW', { tail: 'curl', parts: [
    gear('gearS', E([-0.6, 5.2, TOPZ + 1.6], [1.4, 1.4, 1.4])),
    ...[-1, 1].map((s) => gear('gearS', E([-0.6, 5.2 + s * 3, TOPZ + 2.4 + s * 0.6], [1.2, 2.8, 2]))),
  ] }],
  // a crown with just four big points
  ['CROWN', { tail: 'plume', parts: [
    headShell('gearW', 0.5, (p) => Math.max(p[2] - (TOPZ + 0.8), TOPZ - 2.2 - p[2]), 0.3),
    ...[[6.6, 0], [0, 8.2], [-6.6, 0], [0, -8.2]].map(([x, y]) => cone([x, y, TOPZ + 0.4], [x * 1.04, y * 1.04, TOPZ + 5.2], 1.8, 'gearW')),
  ] }],
  // ---- bold coats: filled black, white eyes
  ['BLACK CAT', { tail: 'swoop', coat: 'black', bold: true, parts: [] }],
  ['INV TABBY', { tail: 'curl', coat: 'tabbyInv', bold: true, parts: [] }],
  ['TUXEDO', { tail: 'bolt', coat: 'tux', bold: true, parts: [] }],
  ['SOCKS', { tail: 'swoop', coat: 'socks', bold: true, parts: [] }],
  // ---- little shirts
  ['BRETON', { tail: 'curl', shirt: 'breton', parts: [] }],
  ['TEE', { tail: 'plume', coat: 'calico', shirt: 'tee', tailTone: 'tip', parts: [] }],
  // ---- spotted cats
  ['CALICO', { tail: 'plume', coat: 'calico', bold: true, tailTone: 'tip', parts: [] }],
  ['SPOTS', { tail: 'swoop', coat: 'spots', bold: true, tailTone: 'bands', parts: [] }],
  ['LEOPARD', { tail: 'curl', coat: 'dots', bold: true, tailTone: 'bands', parts: [] }],
]

// ---------------------------------------------------------------- the editor's two halves
// A cat is a coat (fur colour and pattern) plus one accessory, plus a tail shape.

export type Fur = Pick<Look, 'coat' | 'bold' | 'tailTone'>
export const COATS: [string, Fur][] = [
  ['PLAIN', {}],
  ['SOLID', { coat: 'black', bold: true }],
  ['TUXEDO', { coat: 'tux', bold: true }],
  ['CALICO', { coat: 'calico', bold: true, tailTone: 'tip' }],
  ['TORTIE TUX', { coat: 'tuxcal', bold: true, tailTone: 'tip' }],
  ['TABBY', { coat: 'tabby', tailTone: 'bands' }],
  ['REVERSE TABBY', { coat: 'tabbyInv', bold: true }],
  ['SIAMESE', { coat: 'siamese', bold: true }],
  ['COW', { coat: 'cow', bold: true }],
  ['SPOTS', { coat: 'spots', bold: true, tailTone: 'bands' }],
  ['LEOPARD', { coat: 'dots', bold: true, tailTone: 'bands' }],
  ['TORTIE', { coat: 'tortie', bold: true }],
  ['SOCKS', { coat: 'socks', bold: true }],
  ['VAN', { coat: 'van', bold: true }],
  ['MITTS', { coat: 'mitts', bold: true }],
  ['EAR TIPS', { coat: 'tips', bold: true }],
  ['MOUSTACHE', { coat: 'mustache', bold: true }],
  ['HEART', { coat: 'heart', bold: true, tailTone: 'tip' }],
  ['CHECKER', { coat: 'checker', bold: true }],
  ['BOLT', { coat: 'tattoo', bold: true }],
  ['SKULL', { coat: 'skull', bold: true, tailTone: 'black' }],
  ['IREZUMI', { coat: 'irezumi', bold: true, tailTone: 'black' }],
  ['DOTTED BACK', { coat: 'halfback', bold: true }],
  ['TUXEDO OUTLINE', { coat: 'tux' }],
  ['CALICO OUTLINE', { coat: 'calico' }],
]

/** A head accessory: shapes on the head only (it never colours the body). */
export type Gear = Pick<Look, 'parts' | 'hideEyes' | 'hideEars'>
const accessoryOf = (name: string): Gear => {
  const l = PUNKS.find(([n]) => n === name)![1]
  return { parts: l.parts, hideEyes: l.hideEyes }
}
/** A helmet: a white shell with an opening cut through it and black inside, plus extras. */
function helm(shell: (p: V3) => number, opening: (p: V3) => number, extra: Sdf[]): Sdf[] {
  return [
    { mat: 'gearW', d: (p) => Math.max(shell(p), -opening(p)) },
    // the opening filled solid black, flush with the steel: no white walls, no fur showing through
    { mat: 'gearS', d: (p) => Math.max(shell(p), opening(p)) },
    ...extra,
  ]
}
const astroBubble = (p: V3) => E([-0.2, 0, 16.6], [10.4, 11.2, 10.2]).d(p)
const astroWindow = (p: V3) => Math.max(Math.hypot(p[1] / 7.8, (p[2] - 16.4) / 5) - 1, 2 - p[0])
/** A braid down a path: chunky beads, alternating side to side, a white tie and a little tuft. */
function braid(path: V3[], fat = 1.5): Sdf[] {
  const pts: V3[] = []
  const N = 9
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * (path.length - 1)
    const j = Math.min(path.length - 2, Math.floor(u)), f = u - j
    pts.push([0, 1, 2].map((c) => path[j][c] + (path[j + 1][c] - path[j][c]) * f) as V3)
  }
  const beads = pts.slice(0, -1).map((p, i) => {
    // strands alternating side to side, so the outline scallops like a braid
    const side = (i % 2 === 0 ? 0.45 : -0.45) * (fat > 2 ? 2.2 : 1)
    return gear('gearS', E([p[0], p[1] + side * fat / 1.5, p[2]], [fat, fat, fat * 0.83]))
  })
  const end = pts[pts.length - 1]
  const k = fat / 1.5
  return [...beads, gear('gearW', E([end[0], end[1], end[2] + 0.4 * k], [0.9 * k, 0.9 * k, 0.55 * k])), gear('gearS', E([end[0], end[1], end[2] - 0.9 * k], [k, k, 1.1 * k]))]
}
// a mask's tie: a thin band from its sides right round the back of the head
const maskLoops: Sdf[] = [headShell('gearS', 0.3, (p) => Math.max(Math.abs(p[2] - (HC[2] - 2.4)) - 0.45, p[0] - FRONT + 0.4), 0.3)]
/** A jester's bell hanging at p: a big white ball with a little nub under it. */
const bell = (p: V3): Sdf[] => [gear('gearW', E([p[0], p[1], p[2] - 1.6], [1.9, 1.9, 1.9])), gear('gearS', E([p[0], p[1], p[2] - 3.7], [0.7, 0.7, 0.7]))]
/** Tip parts back (the front up) by `a` radians about a point: a hat worn pushed back off the face. */
const tiltBack = (a: number, [cx, , cz]: V3, parts: Sdf[]): Sdf[] => parts.map((sh) => ({ mat: sh.mat, d: (p) => {
  const x = p[0] - cx, z = p[2] - cz, c = Math.cos(a), sn = Math.sin(a)
  return sh.d([cx + x * c - z * sn, p[1], cz + x * sn + z * c])
} }))
const ACCESSORY_DEFS: [string, Gear][] = [
  ['NONE', { parts: [] }],
  ...['MOHAWK'].map((n) => [n, accessoryOf(n)] as [string, Gear]),
  // a long mohawk: a fin from the forehead over the top and down the back of the head
  ['LONG MOHAWK', { parts: [{ mat: 'gearS', d: (p) => {
    const h = roundBox(HC, [6.2, 7.6, 6], 3.6).d(p)
    // full height over the top, tapering down close to the head by the base of the skull
    const tall = p[0] > -2 ? 3.4 : 0.9 + 2.5 * Math.max(0, Math.min(1, (p[2] - (HC[2] - 4.4)) / 9))
    return Math.max(Math.abs(p[1]) - 1.3, h - tall, -h - 0.5, p[0] - 4.6, HC[2] - 4.4 - p[2])
  } }] }],
  // liberty spikes: three big spikes up top, then smaller ones running down the back of the head
  ['LIBERTY SPIKES', { parts: [
    ...[-1, 0, 1].map((k) => {
      const a = k * 0.5
      const base: V3 = [0.6 + Math.sin(a) * 4, 0, TOPZ - 1 + Math.cos(a) * 0.6]
      return cone(base, [base[0] + Math.sin(a) * 7, 0, base[2] + Math.cos(a) * 7 + 0.4], 1.9)
    }),
    // a diagonal one bridging the top three and the little ones down the back
    cone([-3, 0, TOPZ - 1], [-3 + Math.sin(-1.05) * 6, 0, TOPZ - 1 + Math.cos(-1.05) * 6], 1.7),
    ...[[-5, TOPZ - 2.4, 3.6], [-6.8, HC[2] + 1.6, 2.6], [-7.2, HC[2] - 2.2, 1.8]].map(([x, z, len]) => cone([x + 1.2, 0, z], [x - len, 0, z + len * 0.25], 1.3)),
  ] }],
  // the regular mohawk with a long braid hanging from the back of it, a white tie at the end
  ['MOHAWK BRAID', { parts: [
    gear('gearS', roundBox([-0.4, 0, TOPZ + 2.4], [5.8, 1.4, 3.6], 1.2)),
    ...braid([[-5.6, 0, TOPZ + 1], [-7.6, 0, TOPZ - 3], [-8.4, 0, HC[2] - 2], [-8, 0, HC[2] - 7.6]]),
  ] }],
  ['HEADPHONES', accessoryOf('PHONES')],
  ['CAP', accessoryOf('CAP')],
  // masks sit on the front of the face only, tied with a thin band round the back of the head
  // a surgical mask: a flat pleated panel over the muzzle
  ['SURGICAL MASK', { parts: [
    gear('gearS', roundBox([FRONT + 0.4, 0, HC[2] - 3.8], [0.6, 4.8, 2.1], 0.6)),
    ...[-0.8, 0.6].map((dz) => gear('gearW', roundBox([FRONT + 1.05, 0, HC[2] - 3.8 + dz], [0.2, 4, 0.3], 0.15))),
    ...maskLoops,
  ] }],
  // a KN95: a beak that juts out from the face, folded down a centre spine
  ['KN95', { parts: [
    { mat: 'gearS', d: (p) => {
      // the beak juts most at the middle, easing back to the face toward the top
      const jut = 2.4 * Math.max(0, 1 - Math.abs(p[1]) / 5.2) * (1 - Math.max(0, p[2] - (HC[2] - 3.4)) / 5)
      const shape = Math.min(
        Math.hypot(p[1] / 5, (p[2] - (HC[2] - 3.8)) / 2.4) - 1,
        // a narrow tab running up the bridge of the nose, between the eyes
        Math.max(Math.abs(p[1]) - 1.5 * (1 - Math.max(0, p[2] - (HC[2] - 2)) / 4.4), p[2] - (HC[2] + 1.4), HC[2] - 2.6 - p[2]),
      )
      return Math.max(Math.abs(p[0] - (FRONT + 0.2 + jut)) - 0.45, shape)
    } },
    tubeS('gearW', [[FRONT + 0.9, 0, HC[2] + 0.8], [FRONT + 2.2, 0, HC[2] - 1.8], [FRONT + 2.9, 0, HC[2] - 3.8], [FRONT + 2.6, 0, HC[2] - 5.8]], 0.25),
    ...maskLoops,
  ] }],
  ...['SUN HAT'].map((n) => [n, accessoryOf(n)] as [string, Gear]),
  // a rice hat: a wide shallow white cone, a faint ring and a few thin broken lines from the peak
  ['KASA', { hideEars: true, parts: [
    { mat: 'gearW', d: (p) => { const rr = Math.hypot(p[0] + 0.4, p[1]); return Math.max(Math.abs(p[2] - (TOPZ + 6.4 - rr * 0.5)) - 0.5, rr - 13) } },
    { mat: 'gearS', d: (p) => {
      const rr = Math.hypot(p[0] + 0.4, p[1])
      const on = Math.abs(p[2] - (TOPZ + 6.4 - rr * 0.5)) - 0.62
      const a = Math.atan2(p[1], p[0] + 0.4)
      // a faint broken ring halfway out, and thin broken lines running down from the peak
      const ring = Math.abs(rr - 7.4) - 0.16 + (((a * 7) % 1 + 1) % 1 < 0.35 ? 1 : 0)
      const stripe = rr < 4.2 ? 1 : Math.abs(((a / (Math.PI * 2) * 6) % 1 + 1) % 1 - 0.5) * (Math.PI * 2 / 6) * rr - 0.13 + ((rr % 3) < 0.9 ? 1 : 0)
      return Math.max(on, Math.min(ring, stripe), rr - 13)
    } },
    gear('gearS', E([-0.4, 0, TOPZ + 6.5], [0.8, 0.8, 0.6])),
  ] }],
  ...['HOOD'].map((n) => [n, accessoryOf(n)] as [string, Gear]),
  // a medieval pointy hood: the hood, its long point rising off the top and trailing down the back
  ['POINTY HOOD', { parts: [
    { ...hood('gearK'), mat: 'gearS' },
    tubeS('gearS', [[-1.6, 0, TOPZ + 0.4], [-3.6, 0, TOPZ + 3.6], [-6.8, 0, TOPZ + 3.8], [-9, 0, TOPZ - 0.6], [-9.6, 0, HC[2] - 5.4]], 2.8, 0.55),
  ] }],
  ...['KNIT CAP', 'BERET', 'HACHIMAKI', 'BOW', 'CROWN'].map((n) => [n, accessoryOf(n)] as [string, Gear]),
  ['POMPADOUR', accessoryOf('POMP')],
  // ---- horns
  // a unicorn horn: a tall striped cone standing up off the forehead
  ['UNICORN HORN', { parts: [0, 1, 2, 3].map((k) => {
    // striped segments up the cone, white and black in turn, each slanted a little like a spiral
    const base: V3 = [0.4, 0, TOPZ - 0.8], tip: V3 = [1.8, 0, TOPZ + 11]
    const at = (t: number): V3 => [base[0] + (tip[0] - base[0]) * t, 0, base[2] + (tip[2] - base[2]) * t]
    const t0 = k / 4, t1 = (k + 1) / 4
    return tubeS(k % 2 === 0 ? 'gearW' : 'gearS', [at(t0), at(t1)], 2.6 * (1 - t0) + 0.8 * t0, 2.6 * (1 - t1) + 0.8 * t1)
  }) }],
  // little devil horns on the brow, between the ears
  ['LITTLE HORNS', { parts: [-1, 1].map((s) => tubeS('gearS', [[2.6, s * 2.8, TOPZ - 0.6], [2.9, s * 3.4, TOPZ + 2.2], [2.5, s * 4.4, TOPZ + 4.6], [2, s * 5, TOPZ + 5.6]], 1.35, 0.02)) }], // tapering to a sharp point
  // big bull horns sunk into the upper sides of the head, sweeping out and up at the tips
  ['BULL HORNS', { parts: [-1, 1].map((s) => tubeS('gearW', [[-0.2, s * 6.4, TOPZ - 2.6], [0.4, s * 9.2, TOPZ - 1.6], [1.2, s * 11.2, TOPZ + 0.6], [1.9, s * 11.6, TOPZ + 3.8]], 1.7, 0.35)) }],
  // curly ram horns: a fat spiral from the upper side of the head, coiling down beside it
  ['RAM HORNS', { parts: [-1, 1].map((s) => {
    const pts: V3[] = []
    for (let k = 0; k <= 10; k++) {
      const th = 0.5 * Math.PI + (k / 10) * 1.7 * Math.PI // from the top, round the back and down to the front
      const rad = 3.6 - k * 0.24
      pts.push([0.2 - Math.cos(th) * rad * 1.1, s * (7 + k * 0.22), TOPZ - 3.4 + Math.sin(th) * rad])
    }
    return tubeS('gearW', pts, 1.5, 0.55)
  }) }],
  // a tall black top hat with a white band and a wide brim
  ['TOP HAT', { parts: [
    gear('gearS', roundBox([-0.4, 0, TOPZ + 0.5], [8, 9.2, 0.45], 0.4)),
    gear('gearS', roundBox([-0.4, 0, TOPZ + 3.8], [4.6, 5.4, 3.2], 1)),
    gear('gearW', roundBox([-0.4, 0, TOPZ + 1.9], [4.75, 5.55, 0.8], 0.6)),
  ] }],
  // a big flower tucked over one ear: white petals round a black centre
  ['FLOWER', { parts: [
    ...[0, 1, 2, 3, 4].map((k) => {
      const a = (k / 5) * Math.PI * 2
      return gear('gearW', E([3.6, 5.6 + Math.cos(a) * 2.8, TOPZ + 1.2 + Math.sin(a) * 2.8], [1.4, 2, 2]))
    }),
    gear('gearS', E([4.6, 5.6, TOPZ + 1.2], [1.2, 1.5, 1.5])),
  ] }],
  // long girl hair: blunt bangs above the eyes, a cap over the top and back, long side locks
  ['LONG HAIR', { parts: [
    headShell('gearS', 0.8, (p) => Math.max(HC[2] + 3.2 - p[2], p[0] - FRONT - 1), 0.6),
    headShell('gearS', 0.8, (p) => Math.max(HC[2] - 4.6 - p[2], p[0] - 1.2), 0.6),
    ...[-1, 1].map((s) => gear('gearS', roundBox([0.8, s * 8.4, HC[2] - 2], [3.6, 0.9, 6.4], 0.8))),
  ] }],
  // a high fade: a tall flat-top block of hair between the ears, the sides shaved clean
  ['FLAT TOP', { parts: [gear('gearS', roundBox([-0.2, 0, TOPZ + 2], [5.6, 4.2, 3.2], 1.4))] }],
  ['CURLY', { parts: [[-3.6, -4.4], [-3.6, 0], [-3.6, 4.4], [0.4, -5.6], [0.4, -1.8], [0.4, 1.8], [0.4, 5.6], [4, -3.6], [4, 0], [4, 3.6], [-6.6, -2.2], [-6.6, 2.2]].map(([x, y]) => gear('gearS', E([x, y, TOPZ + 0.8 - Math.abs(x) * 0.12], [2, 2, 1.9]))) }],
  // dreads: a cap and big fat locs all round: two by the cheeks, two at the sides behind, and three hanging down the back
  ['LOCS', { parts: [
    headShell('gearS', 0.7, (p) => HC[2] + 3.6 - p[2], 0.5),
    ...[[2.2, -1], [2.2, 1], [-4.2, -1], [-4.2, 1]].map(([x, s]) => tubeS('gearS', [[x * 0.6, s * 4.6, TOPZ + 0.6], [x, s * 8.2, HC[2] + 2.6], [x * 1.05, s * 8.8, HC[2] - 2], [x * 1.1, s * 8.9, HC[2] - 6.4]], 2, 1.6)),
    ...[-3, 0, 3].map((y) => tubeS('gearS', [[-4.4, y, TOPZ + 0.4], [-7.4, y * 1.1, HC[2] + 2.4], [-8, y * 1.15, HC[2] - 2.2], [-8.1, y * 1.2, HC[2] - 6.2]], 2, 1.5)),
  ] }],
  // a high ponytail: hair swept up to a white tie on top, the tail arcing up and falling behind
  ['PONYTAIL', { parts: [
    headShell('gearS', 0.6, (p) => Math.max(EYE[2] + 2.4 - p[2], p[0] - FRONT + 1.4), 0.5),
    tubeS('gearS', [[-2.4, 0, TOPZ + 1.4], [-3.4, 0, TOPZ + 4.4], [-6.2, 0, TOPZ + 5.2], [-8.6, 0, TOPZ + 2.4], [-9.4, 0, TOPZ - 2.6]], 1.9, 0.7),
    { mat: 'gearW', d: (p) => Math.hypot(Math.hypot(p[0] + 2.6, p[1]) - 1.9, p[2] - (TOPZ + 1.9)) - 0.55 },
  ] }],
  // pigtails: a cap and two bunches sticking out low at the sides, white ties
  ['PIGTAILS', { parts: [
    headShell('gearS', 0.6, (p) => Math.max(EYE[2] + 2.4 - p[2], p[0] - FRONT + 1.4), 0.5),
    ...[-1, 1].flatMap((s) => [
      tubeS('gearS', [[-2, s * 7.6, HC[2] + 1], [-2.6, s * 10.4, HC[2] - 0.6], [-3, s * 11.4, HC[2] - 4]], 1.8, 0.8),
      gear('gearW', E([-2, s * 8.2, HC[2] + 0.8], [1.1, 0.6, 1.1])),
    ]),
  ] }],
  // big braid: long girl hair with blunt bangs, and one huge chunky braid over the shoulder
  ['BIG BRAID', { parts: [
    headShell('gearS', 0.8, (p) => Math.max(HC[2] + 3.2 - p[2], p[0] - FRONT - 1), 0.6),
    headShell('gearS', 0.8, (p) => Math.max(HC[2] - 3 - p[2], p[0] - 1.2), 0.6),
    ...braid([[-2.6, 8.6, HC[2] + 0.6], [0.6, 10.6, HC[2] - 3], [3.2, 10.4, HC[2] - 7], [4.6, 9.4, HC[2] - 11]], 2.3),
  ] }],
  // a braid: hair over the top and one fat braid swinging forward over the shoulder, white tie
  ['BRAID', { parts: [
    headShell('gearS', 0.6, (p) => Math.max(EYE[2] + 2.4 - p[2], p[0] - FRONT + 1.4), 0.5),
    ...braid([[-2.4, 7.4, HC[2] + 2.4], [0, 8.6, HC[2] - 2], [2.2, 8.2, HC[2] - 5.6], [3.4, 7.4, HC[2] - 9]]),
  ] }],
  // a bowl cut: a round helmet of hair, cut straight across above the eyes and dipping lower at the back
  ['BOWL CUT', { parts: [headShell('gearS', 0.8, (p) => EYE[2] + 2.3 - Math.max(0, 1 - p[0]) * 0.75 - p[2], 0.7)] }],
  // emo hair: a shaggy cap coming low at the back, a big flat fringe combed from the middle of the crown down to a point
  // on one cheek (over that eye, the other one clear), choppy spikes flicking out at the nape, a sharp lock down that cheek
  ['SIDE FRINGE', { parts: [
    headShell('gearS', 0.6, (p) => Math.max(EYE[2] + 2.4 - p[2] - Math.max(0, -p[0] - 1) * 0.9, p[0] - FRONT + 1.4), 0.5),
    { mat: 'gearS', d: (p) => {
      // the sweep: flat blobs lying on the face, big where it starts and tapering to a point
      const path: [number, number, number, number][] = [[-0.6, TOPZ - 0.8, 2.6, 2.2], [-2.1, EYE[2] + 3.6, 1.9, 1.9], [-3.3, EYE[2] + 1, 1.9, 2.5], [-4.7, EYE[2] - 1.8, 1.1, 1.5]]
      let d = Infinity
      for (const [y, z, ry, rz] of path) {
        const e = Math.hypot((p[0] - FRONT + 0.15) / 0.8, (p[1] - y) / ry, (p[2] - z) / rz) - 1
        const k = 0.6, v = e * Math.min(0.9, ry, rz)
        d = d === Infinity ? v : Math.min(d, v) - Math.max(0, k - Math.abs(d - v)) ** 2 / (4 * k) // smooth union
      }
      return d
    } },
    ...[-5.2, -1.8, 1.8, 5.2].map((y) => tubeS('gearS', [[-4.6, y, HC[2] - 1], [-6.8, y * 1.15, HC[2] - 3.4], [-7.6, y * 1.25, HC[2] - 5.2]], 1.6, 0.25)),
    // a sharp lock down the cheek on the fringe's side (the clear eye's side stays open)
    tubeS('gearS', [[2.4, -6.4, EYE[2] + 1.6], [3.4, -6.9, EYE[2] - 1.2], [3.8, -6.8, EYE[2] - 3.2]], 1.1, 0.2),
  ] }],
  // ---- fantasy
  // a wizard hat: wide brim, a tall cone that bends back and flops over at the tip
  ['WIZARD HAT', { parts: [
    gear('gearS', E([0, 0, TOPZ + 0.3], [9.4, 10.4, 0.6])),
    tubeS('gearS', [[-0.4, 0, TOPZ + 0.6], [-1.6, 0.4, TOPZ + 3.8], [-4, 1.6, TOPZ + 6.2], [-7.4, 3.6, TOPZ + 6.6], [-9.4, 5.6, TOPZ + 4.6]], 5.4, 0.6),
    gear('gearW', roundBox([-0.4, 0, TOPZ + 1.3], [5.3, 5.3, 0.55], 0.5)),
  ] }],
  // knight helms replace the ears. Openings are cut right through the steel with black behind,
  // so a slit reads as a dark hole, not a stripe painted on.
  // KNIGHT: straight sides up to the brow, a tall dome, a big T opening, a black plume
  ['KNIGHT', { hideEyes: true, hideEars: true, parts: helm(
    (p) => p[2] < HC[2] + 3 ? roundBox([-0.2, 0, HC[2] - 1], [7.2, 8.4, 4], 2.4).d(p) : E([-0.2, 0, HC[2] + 3], [7.2, 8.4, 7.6]).d(p),
    (p) => Math.min(roundBox([7, 0, EYE[2] + 0.5], [3, 5.6, 1.5], 0.5).d(p), roundBox([7, 0, HC[2] - 2.6], [3, 1.6, 3.2], 0.5).d(p)),
    [tubeS('gearS', [[-1.6, 0, HC[2] + 10.2], [-4, 0, HC[2] + 12.4], [-7.4, 0, HC[2] + 11.8], [-9.6, 0, HC[2] + 8.6]], 2, 0.9)],
  ) }],
  // SPARTAN: a dome with a Y opening down the face and a huge black crest front to back
  ['SPARTAN', { hideEyes: true, hideEars: true, parts: helm(
    (p) => p[2] < HC[2] + 3 ? roundBox([-0.2, 0, HC[2] - 1], [7.2, 8.4, 4], 2.4).d(p) : E([-0.2, 0, HC[2] + 3], [7.2, 8.4, 7.6]).d(p),
    (p) => Math.min(roundBox([7, -2.6, EYE[2] + 0.2], [3, 2.2, 1.4], 0.8).d(p), roundBox([7, 2.6, EYE[2] + 0.2], [3, 2.2, 1.4], 0.8).d(p), roundBox([7, 0, HC[2] - 3], [3, 1.6, 3], 0.6).d(p)),
    [{ mat: 'gearS', d: (p) => Math.max(Math.abs(p[1]) - 1, Math.hypot((p[0] + 1) / 9.6, (p[2] - (HC[2] + 7)) / 7.4) - 1, HC[2] + 8.6 - p[2]) }],
  ) }],
  // BASCINET: a pointed dome and a pig-faced visor jutting forward, slit across it
  ['BASCINET', { hideEyes: true, hideEars: true, parts: [
    ...helm(
      (p) => Math.min(p[2] < HC[2] + 3 ? roundBox([-0.2, 0, HC[2] - 1], [7.2, 8.4, 4], 2.4).d(p) : E([-0.2, 0, HC[2] + 3], [7.2, 8.4, 8.6]).d(p), smooth(1.2, E([4.6, 0, HC[2] - 0.4], [4.4, 5.6, 4.8]), cone([7.4, 0, HC[2] - 0.8], [11.2, 0, HC[2] - 1.4], 3, 'gearW')).d(p)),
      (p) => roundBox([9.6, 0, EYE[2] + 0.2], [5, 4.6, 0.75], 0.3).d(p),
      [],
    ),
    ...[[-1, -1], [1, -1], [0, -2.4]].map(([y, z]) => gear('gearS', E([9.8, y * 0.9, HC[2] + z], [0.6, 0.5, 0.5]))),
  ] }],
  // TIN HAT: a WWI soldier's helmet: a low steel bowl and a wide flat brim all round, chin strap
  ['TIN HAT', { hideEars: true, parts: [
    { mat: 'gearS', d: (p) => Math.max(E([-0.4, 0, TOPZ - 1.6], [6.6, 7.6, 4.6]).d(p), TOPZ - 2.2 - p[2]) },
    { mat: 'gearS', d: (p) => Math.max(Math.hypot((p[0] + 0.4) / 11, p[1] / 12) - 1, Math.abs(p[2] - (TOPZ - 2.2 + Math.hypot(p[0] + 0.4, p[1]) * 0.05)) - 0.45) },
    ...[-1, 1].map((s) => tubeS('gearS', [[0.4, s * 7.6, TOPZ - 2.4], [1.6, s * 7.4, HC[2] - 4], [3.4, s * 4.6, HC[2] - 6.4], [4.2, 0, HC[2] - 6.8]], 0.4)),
  ] }],
  // a Viking helmet: a round steel cap with a band and two big curving horns
  // (a tall dome that replaces the ears, a nose guard down between the eyes)
  ['VIKING', { hideEars: true, parts: [
    { mat: 'gearW', d: (p) => Math.max(E([-0.4, 0, TOPZ - 2.6], [7.4, 8.8, 6.6]).d(p), TOPZ - 3 - p[2]) },
    { mat: 'gearS', d: (p) => Math.max(E([-0.4, 0, TOPZ - 2.6], [7.9, 9.3, 7]).d(p), Math.abs(p[2] - (TOPZ - 2.3)) - 0.75) },
    gear('gearS', roundBox([7.3, 0, TOPZ - 4.4], [0.5, 0.7, 2], 0.3)),
    ...[-1, 1].map((s) => tubeS('gearW', [[0, s * 8.4, TOPZ - 0.8], [0.6, s * 11, TOPZ + 0.8], [1.4, s * 11.8, TOPZ + 4], [2.2, s * 10.6, TOPZ + 6.6]], 1.6, 0.3)),
  ] }],
  // a big chunky halo floating above the head
  ['HALO', { parts: [{ mat: 'gearW', d: (p) => Math.hypot(Math.hypot(p[0] + 0.4, p[1]) - 4, (p[2] - (TOPZ + 7.2)) * 1.1) - 2.1 }] }],
  // a jester's cap: three floppy points curling out, each with a bell
  ['JESTER HAT', { parts: [
    headShell('gearS', 0.6, (p) => TOPZ - 1.8 - p[2], 0.7),
    // two big floppy points falling off the sides of the head, one curling up at the back, each
    // with a big bell and the bell's little nub at the bottom
    ...[-1, 1].flatMap((s) => {
      const tip: V3 = [0.8, s * 12.6, TOPZ - 5]
      return [tubeS('gearS', [[-0.6, s * 4, TOPZ + 0.8], [-0.4, s * 9, TOPZ + 3.2], [0.4, s * 12.4, TOPZ - 1.6], tip], 3.2, 0.8), ...bell(tip)]
    }),
    tubeS('gearS', [[-2, 0, TOPZ + 1], [-5.6, 0, TOPZ + 5.6], [-9.6, 0, TOPZ + 5.2], [-10.6, 0, TOPZ + 2]], 3.2, 0.8),
    ...bell([-10.6, 0, TOPZ + 1.4]),
  ] }],
  // a samurai kabuto: dark bowl, a flared neck guard behind, and a golden crescent crest
  ['KABUTO', { hideEars: true, parts: [
    // a tall dark bowl
    { mat: 'gearS', d: (p) => Math.max(E([-0.4, 0, TOPZ - 2.4], [7.2, 8.6, 6]).d(p), TOPZ - 0.9 - p[2]) },
    // a wide flared neck guard sweeping out round the back and sides: three stepped lames,
    // black, white, black
    ...[0, 1, 2].map((k): Sdf => ({ mat: k === 1 ? 'gearW' : 'gearS', d: (p) => {
      const z0 = TOPZ - 2.4 - k * 1.5
      return Math.max(Math.abs(Math.hypot(p[0] + 0.4, p[1] / 1.08) - (8 + k * 1.3)) - 0.5, Math.abs(p[2] - z0) - 0.7, p[0] - 2.4)
    } })),
    // a peak over the brow
    // a peak over the brow, kept above the eyes
    { mat: 'gearS', d: (p) => Math.max(E([2.4, 0, TOPZ - 0.7], [6.4, 8, 0.45]).d(p), 1 - p[0]) },
    // the huge golden crescent horns, rising well above the head, and a crest disc between
    ...[-1, 1].map((s) => tubeS('gearW', [[FRONT + 1, s * 0.6, TOPZ + 0.4], [FRONT + 1.6, s * 3.4, TOPZ + 2], [FRONT + 1.2, s * 6.8, TOPZ + 5.6], [FRONT, s * 8.4, TOPZ + 10]], 1.6, 0.55)),
    gear('gearW', E([FRONT + 1.4, 0, TOPZ + 0.8], [0.6, 1.9, 1.9])),
  ] }],
  // a slim tiara band with one point in the middle
  ['TIARA', { parts: [
    headShell('gearW', 0.4, (p) => Math.max(Math.abs(p[2] - (TOPZ - 0.6)) - 0.5, -p[0]), 0.4),
    cone([FRONT - 0.6, 0, TOPZ - 0.6], [FRONT - 0.4, 0, TOPZ + 2.6], 1.6, 'gearW'),
    gear('gearS', E([FRONT + 0.2, 0, TOPZ + 0.4], [0.6, 0.8, 0.9])),
  ] }],
  // ---- sci-fi
  // an astronaut helmet: a big round bubble sitting high over the head, a wide window for the face
  ['SPACE HELMET', { hideEars: true, parts: [
    // the bubble sits high, its bottom just under the chin; a big window for the face
    { mat: 'gearW', d: (p) => Math.max(Math.abs(astroBubble(p)) - 0.55, -astroWindow(p)) },
    // a dark seam round the window, a seam over the top, and a collar ring with white bolts
    { mat: 'gearS', d: (p) => Math.max(Math.abs(astroBubble(p)) - 0.75, Math.abs(Math.hypot(p[1] / 7.8, (p[2] - 16.4) / 5) - 1) * 7 - 0.45, 2 - p[0]) },
    { mat: 'gearS', d: (p) => Math.max(Math.abs(astroBubble(p)) - 0.7, Math.abs(p[1]) - 0.4, HC[2] + 5.5 - p[2]) },
    { mat: 'gearS', d: (p) => Math.hypot(Math.hypot((p[0] + 0.2) / 1.05, p[1] / 1.1) - 6.4, p[2] - 7.4) - 1.2 },
    ...[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + 0.5; return gear('gearW', E([-0.2 + Math.cos(a) * 6.9, Math.sin(a) * 7.3, 7.6], [0.55, 0.55, 0.55])) }),
    tubeS('gearS', [[-3.6, -6.6, TOPZ + 4.4], [-4.2, -7.4, TOPZ + 7.4]], 0.35),
    gear('gearS', E([-4.2, -7.4, TOPZ + 7.8], [0.7, 0.7, 0.7])),
  ] }],
  // robot bits: an antenna with a ball, bolts out of both sides of the head
  ['ROBOT BOLTS', { parts: [
    tubeS('gearS', [[-0.4, 0, TOPZ - 0.4], [-0.4, 0, TOPZ + 5.4]], 0.5),
    gear('gearW', E([-0.4, 0, TOPZ + 6.2], [1.5, 1.5, 1.5])),
    ...[-1, 1].map((s) => gear('gearS', roundBox([-0.4, s * 8.6, HC[2] + 0.4], [2.2, 1.4, 2.2], 0.6))),
    ...[-1, 1].map((s) => gear('gearW', roundBox([-0.4, s * 10, HC[2] + 0.4], [1.2, 0.5, 1.2], 0.3))),
  ] }],
  // a cyber visor: a dark curved lens across the eyes, thin light rims, tabs at the sides
  ['VISOR', { hideEyes: true, parts: [
    // the lens: a dark curved strip across the front of the face, eyes to eyes
    { mat: 'gearS', d: (p) => Math.max(Math.abs(E([0.2, 0, EYE[2] + 0.4], [6.9, 8.3, 6.2]).d(p)) - 0.45, Math.abs(p[2] - (EYE[2] + 0.4)) - 1.4, 2.4 - p[0]) },
    // a thin light rim along its top and bottom edges, and a tab at each side where it meets the head
    { mat: 'gearW', d: (p) => Math.max(Math.abs(E([0.2, 0, EYE[2] + 0.4], [7.05, 8.45, 6.35]).d(p)) - 0.4, Math.abs(Math.abs(p[2] - (EYE[2] + 0.4)) - 1.65) - 0.3, 2 - p[0]) },
    ...[-1, 1].map((sd) => gear('gearW', roundBox([0.6, sd * 7.9, EYE[2] + 0.4], [1.2, 0.6, 1.6], 0.5))),
  ] }],
  // alien antennae: two bobbly stalks
  ['ANTENNAE', { parts: [-1, 1].flatMap((s) => [
    tubeS('gearS', [[0.4, s * 3, TOPZ - 0.4], [1.4, s * 4.4, TOPZ + 3.4], [3.2, s * 5.6, TOPZ + 5.8]], 0.5, 0.35),
    gear('gearS', E([3.6, s * 5.8, TOPZ + 6.4], [1.4, 1.4, 1.4])),
  ]) }],
  // ---- more genres
  // a chef's toque: a tall white column as wide as the head, straight up, pleat lines all the way
  // round it, a band at the bottom
  ['CHEF HAT', { parts: [
    headShell('gearW', 0.5, (p) => Math.max(TOPZ - 1.3 - p[2], p[2] - TOPZ), 0.5),
    gear('gearW', roundBox([-0.2, 0, TOPZ + 3.6], [6.6, 8, 4.6], 2.4)),
    // the pleats: thin dark lines up each face
    ...[
      ...[-4.8, -1.6, 1.6, 4.8].map((y): V3 => [6.45, y, 0]),
      ...[-3.4, 3.4].flatMap((x) => [-1, 1].map((sy): V3 => [-0.2 + x, sy * 7.85, 1])),
      ...[-3.2, 0, 3.2].map((y): V3 => [-6.85, y, 0]),
    ].map(([x, y, side]) => gear('gearS', roundBox([x, y, TOPZ + 4.4], side ? [0.22, 0.24, 2.9] : [0.24, 0.22, 2.9], 0.2))),
  ] }],
  // ---- big fancy hats
  // a pirate captain's hat: a huge black half-moon worn side to side, its points out past the
  // head, a white trim round the edge and a big skull on the front
  ['PIRATE HAT', { hideEars: true, parts: [
    gear('gearS', cutBelow(E([-0.4, 0, TOPZ - 1.6], [6.6, 7.8, 4]), TOPZ - 2)),
    { mat: 'gearS', d: (p) => Math.max(Math.abs(p[0] + 0.4) - 1.6, Math.hypot(p[1] / 11, (p[2] - (TOPZ - 2)) / 10.5) * 7 - 7, TOPZ - 2.4 - p[2]) },
    { mat: 'gearW', d: (p) => Math.max(Math.abs(p[0] + 0.4) - 1.75, Math.abs(Math.hypot(p[1] / 11, (p[2] - (TOPZ - 2)) / 10.5) * 7 - 6.6) - 0.45, TOPZ - 2.4 - p[2]) },
    gear('gearW', E([2, 0, TOPZ + 3.4], [1.2, 4, 3.6])),
    gear('gearW', roundBox([1.8, 0, TOPZ + 0.4], [1, 2.2, 1.2], 0.5)),
    ...[-1, 1].map((s) => gear('gearS', E([3.2, s * 1.5, TOPZ + 3.4], [0.7, 1, 1.2]))),
  ] }],
  // a bicorne worn fore and aft: a huge black half-moon front to back, white trim, a cockade, tipped back off the face
  ['BICORNE', { hideEars: true, parts: tiltBack(0.28, [-0.4, 0, TOPZ - 2], [
    gear('gearS', cutBelow(E([-0.4, 0, TOPZ - 1.6], [6.6, 7.8, 4]), TOPZ - 2)),
    { mat: 'gearS', d: (p) => Math.max(Math.abs(p[1]) - 1.6, Math.hypot((p[0] + 0.4) / 12, (p[2] - (TOPZ - 2)) / 9.5) * 7 - 7, TOPZ - 2.4 - p[2]) },
    { mat: 'gearW', d: (p) => Math.max(Math.abs(p[1]) - 1.75, Math.abs(Math.hypot((p[0] + 0.4) / 12, (p[2] - (TOPZ - 2)) / 9.5) * 7 - 6.6) - 0.45, TOPZ - 2.4 - p[2]) },
    gear('gearW', E([0.6, -2, TOPZ + 2.4], [2.2, 0.8, 2.2])),
    gear('gearS', E([0.6, -2.6, TOPZ + 2.4], [0.9, 0.5, 0.9])),
  ]) }],
  // a cavalier hat: a wide brim pinned up on one side, a big white plume sweeping over the back
  ['CAVALIER', { parts: [
    gear('gearS', roundBox([-0.4, 0, TOPZ + 2], [5, 5.8, 2.8], 2)),
    { mat: 'gearS', d: (p) => E([-0.4, 0, TOPZ - 0.2 + Math.max(0, p[1]) * 0.55], [10.4, 11.6, 0.6]).d(p) },
    tubeS('gearW', [[2, 4.6, TOPZ + 2.4], [0, 6.2, TOPZ + 6.4], [-4.4, 4.6, TOPZ + 8], [-8.6, 1, TOPZ + 6], [-10.4, -2.4, TOPZ + 2.4]], 2.4, 0.6),
  ] }],
  // a sombrero: an enormous brim curling up at the edge and a tall rounded crown
  ['WIDE BRIM', { hideEars: true, parts: [
    gear('gearW', smooth(0.8, cutBelow(E([-0.4, 0, TOPZ + 0.4], [5.2, 5.8, 6.8]), TOPZ - 1.6))),
    { mat: 'gearW', d: (p) => { const rr = Math.hypot(p[0] + 0.4, p[1] / 1.05); return Math.max(Math.abs(p[2] - (TOPZ - 1.2 + Math.max(0, rr - 9) ** 2 * 0.5)) - 0.55, rr - 12.4) } },
    { mat: 'gearS', d: (p) => Math.max(Math.abs(Math.hypot(p[0] + 0.4, p[1] / 1.05) - 5.3) - 0.4, Math.abs(p[2] - (TOPZ + 0.6)) - 0.8) },
  ] }],
  // a cowboy hat: a creased crown and a wide brim curling up at the sides
  ['COWBOY HAT', { parts: [
    gear('gearW', roundBox([-0.4, 0, TOPZ + 1.8], [4.8, 5.8, 2.8], 2)),
    { mat: 'gearW', d: (p) => E([-0.4, 0, TOPZ - 0.2 + 0.028 * p[1] * p[1]], [9.6, 11.6, 0.6]).d(p) },
    gear('gearS', roundBox([-0.4, 0, TOPZ + 0.4], [4.9, 5.9, 0.5], 0.4)),
  ] }],
  // a graduation cap: a flat square board and a tassel
  // a graduation cap: a big flat board on a skullcap, a white button and a fat white tassel
  // hanging off the front corner beside the face
  ['GRAD CAP', { parts: [
    headShell('gearS', 0.5, (p) => TOPZ - 1.6 - p[2], 0.5),
    gear('gearS', roundBox([-0.4, 0, TOPZ + 1.6], [8.6, 8.6, 0.55], 0.3)),
    gear('gearW', E([-0.4, 0, TOPZ + 2.2], [1.1, 1.1, 0.6])),
    tubeS('gearW', [[-0.4, 0, TOPZ + 2.3], [7.8, 7.8, TOPZ + 2.3], [8.6, 8.6, TOPZ + 1.4], [8.8, 8.8, TOPZ - 2.6]], 0.5),
    gear('gearW', E([8.8, 8.8, TOPZ - 4], [1.5, 1.5, 2.4])),
  ] }],
  // a little sprout growing out of the top of the head: a thin stem and two plump round leaves
  ['SPROUT', { parts: [
    tubeS('gearS', [[-0.4, 0, TOPZ - 0.4], [-0.1, 0.2, TOPZ + 3.4], [-0.4, 0, TOPZ + 6.2]], 0.5, 0.4),
    ...[-1, 1].map((s) => gear('gearS', E([-0.4, s * 2.5, TOPZ + 7.8], [1.4, 2.3, 1.7]))),
  ] }],
  // a ninja hood: the whole head wrapped, an eye slit, knot and tails at the back
  ['NINJA HOOD', { parts: [
    // the hood covers the ears too, so no white ear tips poke out of the black
    ...CUBE.ears.map((e): Sdf => ({ mat: 'gearS', d: (p) => e.d(p) - 0.5 })),
    // a tall eye slit that wraps round the sides, so the eyes keep paper round them as it turns
    headShell('gearS', 0.6, (p) => -Math.max(Math.abs(p[2] - (EYE[2] - 0.1)) - 3.7, 0.6 - p[0]), 0.6),
    gear('gearS', E([-7.4, 0, TOPZ - 2], [1.4, 1.6, 1.4])),
    ...[-1, 1].map((s) => tubeS('gearS', [[-7.6, 0, TOPZ - 2], [-9.6, s * 2.4, TOPZ - 3.6], [-10.6, s * 3.6, TOPZ - 6.4]], 0.6, 0.35)),
  ] }],
  // a party hat: a striped cone tipped to one side with a pompom
  ['PARTY HAT', { parts: [
    ...[0, 1, 2, 3].map((k) => {
      const z0 = TOPZ - 0.4 + k * 2
      return tubeS(k % 2 === 0 ? 'gearW' : 'gearS', [[-0.4 + k * 0.4, k * 1.1, z0], [-0.4 + (k + 1) * 0.4, (k + 1) * 1.1, z0 + 2]], 4.6 - k * 1.1, 4.6 - (k + 1) * 1.1)
    }),
    gear('gearW', E([1.2, 4.6, TOPZ + 8], [1.6, 1.6, 1.6])),
  ] }],
]
export const TAILS: TailStyle[] = ['none', 'swoop', 'curl', 'plume', 'bolt', 'puff', 'pig', 'mouse', 'fox', 'dog', 'lizard']

/** Put a cat together from the two halves. */
// ---------------------------------------------------------------- clothes: the lower-body half
// The body is a small torso (z 0..7.6, about 2.1 deep and 2.6 wide either side of centre)
// under the big head (bottom at z 8). Clothes change its silhouette.

/** The torso shape, inflated by `g`: for clothes that hug the body. */
const torso = (g: number): Sdf => ({ mat: 'x', d: (p) => E([0, 0, 3.8], [2.08 + g, 2.6 + g, 3.8 + g * 0.5]).d(p) })
const shellOf = (s: Sdf, t: number, mat: 'gearS' | 'gearW', keep: (p: V3) => number): Sdf => ({ mat, d: (p) => Math.max(Math.abs(s.d(p)) - t, keep(p)) })

/** Lower-body clothes: shapes on the body, and/or a body colour (dark, or a striped shirt). */
// long silhouettes: shared shapes
/** A cloth cone hanging from the shoulders: radius r0 at the collar (z 7.6) growing by `flare`
 * per unit down, its centre drifting back by `trail` per unit below z 4 (a train on the floor). */
const drape = (r0: number, flare: number, trail: number) => (p: V3) => {
  const z = Math.max(0, Math.min(7.6, p[2]))
  const cx = -Math.max(0, 4 - z) * trail
  return { radial: Math.hypot((p[0] - cx) / 1.0, p[1] / 1.12), r: r0 + (7.6 - z) * flare }
}
export interface Clothes { parts: Sdf[]; bodyDark?: boolean; shirt?: Look['shirt']; hang?: boolean }
export const CLOTHES: [string, Clothes][] = [
  ['NONE', { parts: [] }],
  ['T-SHIRT', { parts: [], shirt: 'tee' }],
  ['STRIPED TOP', { parts: [], shirt: 'breton' }],
  // a black hoodie: dark body, the hood down round the neck, white drawstrings
  ['HOODIE', { parts: [
    shellOf(torso(0.5), 0.5, 'gearS', () => -1),
    // the hood down: a fat roll round the neck under the head, bunched up thicker at the back
    { mat: 'gearS', d: (p) => {
      const back = Math.max(0, -p[0]) / 3
      return Math.hypot(Math.hypot(p[0] / 1.1, p[1] / 1.2) - 3.3 - back * 0.6, p[2] - 7.2) - 1.5 - back * 0.5
    } },
    ...[-1, 1].map((s) => tubeS('gearW', [[3.2, s * 0.9, 6.6], [3.2, s * 1.1, 3.8]], 0.45, 0.4)),
  ] }],
  // a kimono top: dark, wrapped open in a deep V that shows the chest, a white collar band
  // along the V, wide sleeves at the sides
  ['KIMONO', { parts: [
    { mat: 'gearS', d: (p) => {
      const shell = Math.abs(torso(0.7).d(p)) - 0.6
      const v = p[0] > 0.6 && Math.abs(p[1]) < Math.max(0, p[2] - 2.4) * 0.5 ? 1 : -1 // the open V
      return Math.max(shell, 2.2 - p[2], v)
    } },
    { mat: 'gearW', d: (p) => Math.max(Math.abs(torso(0.7).d(p)) - 0.75, Math.abs(Math.abs(p[1]) - Math.max(0, p[2] - 2.4) * 0.5 - 0.35) - 0.4, 0.6 - p[0], 2.6 - p[2]) },
    ...[-1, 1].map((s) => gear('gearS', E([0.2, s * 3.5, 4.8], [2.1, 1.7, 2.3]))),
  ] }],
  // the kimono slipped off one shoulder: that whole side bare, tattooed shoulder and arm showing
  ['KIMONO OFF SHOULDER', { parts: [
    { mat: 'gearS', d: (p) => {
      const shell = Math.abs(torso(0.7).d(p)) - 0.6
      const v = p[0] > 0.6 && Math.abs(p[1]) < Math.max(0, p[2] - 2.4) * 0.5 ? 1 : -1
      // the bare side: everything on +y above the waist sash
      const bare = p[1] > -0.2 && p[2] > 3 ? 1 : -1
      return Math.max(shell, 2.2 - p[2], v, bare)
    } },
    { mat: 'gearW', d: (p) => Math.max(Math.abs(torso(0.7).d(p)) - 0.75, Math.abs(Math.abs(p[1]) - Math.max(0, p[2] - 2.4) * 0.5 - 0.35) - 0.4, 0.6 - p[0], 2.6 - p[2], p[1]) },
    gear('gearS', E([0.2, -3.5, 4.8], [2.1, 1.7, 2.3])),
    // the sleeve hanging loose at the waist on the bare side
    gear('gearS', E([-0.2, 3.2, 2.6], [2, 1.6, 1.1])),
  ] }],
  // a crop top: like the T-shirt (same dark, same colour), over the chest and shoulders only, belly showing
  ['CROP TOP', { parts: [], shirt: 'crop' }],
  // a long coat that flares from the shoulders to the floor, open down the front, collar up
  ['LONG COAT', { hang: true, parts: [
    { mat: 'gearS', d: (p) => {
      const r = 2.9 + (7.4 - Math.max(0, Math.min(7.4, p[2]))) * 0.42
      const radial = Math.hypot(p[0] / 1.0, p[1] / 1.12)
      const open = Math.abs(Math.atan2(p[1], p[0])) - 0.45 // a gap down the front
      return Math.max(Math.abs(radial - r) - 0.5, p[2] - 7.6, 0.1 - p[2], -open * 3)
    } },
    ...[-1, 1].map((s) => gear('gearS', roundBox([1.2, s * 2.4, 8.1], [0.5, 1.4, 1.4], 0.4))),
  ] }],
  // the long coat, white, open over a dark body (in colour: coat and body take different ramps)
  ['OPEN COAT', { hang: true, bodyDark: true, parts: [
    { mat: 'gearW', d: (p) => {
      const r = 2.9 + (7.4 - Math.max(0, Math.min(7.4, p[2]))) * 0.42
      const open = Math.abs(Math.atan2(p[1], p[0])) - 0.6
      return Math.max(Math.abs(Math.hypot(p[0], p[1] / 1.12) - r) - 0.5, p[2] - 7.6, 0.1 - p[2], -open * 3)
    } },
    ...[-1, 1].map((s) => gear('gearW', roundBox([1.2, s * 2.4, 8.1], [0.5, 1.4, 1.4], 0.4))),
  ] }],
  // a cape wrapped round the back and sides, falling straight to the floor
  ['CAPE', { hang: true, parts: [{ mat: 'gearS', d: (p) => {
    const { radial, r } = drape(3.2, 0.36, 0)(p)
    const back = Math.abs(Math.atan2(p[1], -p[0])) - 1.75
    return Math.max(Math.abs(radial - r) - 0.45, p[2] - 7.8, 0.15 - p[2], back * 3)
  } }] }],
  // a cape with a deep cowl draped round the neck, dipping low on the chest
  ['COWL CAPE', { hang: true, parts: [
    { mat: 'gearS', d: (p) => {
      const { radial, r } = drape(3.2, 0.36, 0.5)(p)
      const back = Math.abs(Math.atan2(p[1], -p[0])) - 1.6
      return Math.max(Math.abs(radial - r) - 0.45, p[2] - 7.8, 0.15 - p[2], back * 3)
    } },
    { mat: 'gearW', d: (p) => {
      const R = Math.hypot(p[0] / 1.05, p[1] / 1.15)
      const dip = 7.2 - Math.max(0, p[0]) * 0.75
      return Math.hypot(R - 3.1, p[2] - dip) - 1.35
    } },
  ] }],
  // a dress: a fitted bodice, then a tall bell skirt flaring to the floor, a white frill at the hem
  ['DRESS', { parts: [
    shellOf(torso(0.5), 0.5, 'gearS', (p) => 5 - p[2]),
    { mat: 'gearS', d: (p) => Math.max(Math.hypot(p[0], p[1] / 1.1) - (2.7 + (5.2 - Math.max(0, Math.min(5.2, p[2]))) * 0.5), p[2] - 5.2, 1 - p[2]) },
    { mat: 'gearW', d: (p) => Math.max(Math.hypot(p[0], p[1] / 1.1) - (5.3 + Math.cos(Math.atan2(p[1], p[0]) * 12) * 0.25), p[2] - 1.1, 0.15 - p[2]) },
  ] }],
  // a long black robe with a train sweeping out behind along the floor, a white sash
  ['LONG ROBE', { hang: true, parts: [
    { mat: 'gearS', d: (p) => {
      const { radial, r } = drape(2.9, 0.3, 1.15)(p)
      return Math.max(radial - r, p[2] - 7.6, 0.15 - p[2])
    } },
    { mat: 'gearW', d: (p) => {
      const { radial, r } = drape(2.9, 0.3, 1.15)(p)
      return Math.max(radial - r - 0.3, Math.abs(p[2] - 4.8) - 0.5)
    } },
  ] }],
  // a neckerchief: a triangle hanging on the chest, knotted at the back of the neck
  ['BANDANA', { parts: [
    { mat: 'gearS', d: (p) => Math.max(Math.abs(p[0] - 2.9 + (7.6 - p[2]) * 0.12) - 0.45, Math.abs(p[1]) - (p[2] - 2.2) * 0.85, p[2] - 7.6, 2.2 - p[2]) },
    gear('gearS', roundBox([0, 0, 7.3], [2.8, 3.1, 0.7], 0.6)),
    ...[-1, 1].map((s) => tubeS('gearS', [[-2.6, s * 0.8, 7.3], [-3.6, s * 1.8, 5.8]], 0.55, 0.4)),
  ] }],
  // a scout's neckerchief: rolled round the neck, knotted in front through a little light woggle, the two short ends
  // splaying down from it
  ['NECKERCHIEF', { parts: [
    { mat: 'gearS', d: (p) => Math.hypot(Math.hypot(p[0] / 1.05, p[1] / 1.15) - 2.85, p[2] - 7.2) - 0.55 },
    gear('gearW', E([3.25, 0, 6.6], [0.75, 0.95, 0.75])),
    ...[-1, 1].map((sd) => tubeS('gearS', [[3.3, sd * 0.45, 6.2], [3.7, sd * 1.4, 5], [3.9, sd * 2.1, 3.9]], 0.7, 0.55)),
  ] }],
  // a fat chunky scarf round the neck with one end hanging down the front
  ['SCARF', { parts: [
    { mat: 'gearS', d: (p) => Math.hypot(Math.hypot(p[0] / 1.05, p[1] / 1.15) - 2.8, p[2] - 6.6) - 1.5 },
    tubeS('gearS', [[3, 1.6, 6.4], [4, 2.4, 3.6], [4.2, 2.8, 1.2]], 1.2, 1.1),
  ] }],
  // just a necktie: a fat knot under the chin and the blade hanging down the chest, widening to a point (no shirt,
  // no jacket: the office in one thing)
  ['TIE', { parts: [
    gear('gearS', E([3, 0, 7], [0.8, 1.05, 0.8])),
    { mat: 'gearS', d: (p) => {
      const w = Math.min(0.75 + (6.6 - p[2]) * 0.1, (p[2] - 1.9) * 1.1)
      return Math.max(Math.abs(p[0] - (2.95 - (7 - p[2]) * 0.1)) - 0.45, Math.abs(p[1]) - w, p[2] - 6.8, 1.9 - p[2])
    } },
  ] }],
]

// ---------------------------------------------------------------- eyewear
// Its own slot, so glasses go with any hat. Lenses that are opaque hide the eyes (no eyes to
// lose behind a frame as the head turns).
const lens = (s: number): V3 => [FRONT + 0.9, s * EYE[1], EYE[2]]
// bridge and arms for round frames; and the heavier ones for square frames
const frameBits: Sdf[] = [
  tubeS('gearS', [[FRONT + 0.9, -0.6, EYE[2] + 0.8], [FRONT + 1.1, 0, EYE[2] + 1.1], [FRONT + 0.9, 0.6, EYE[2] + 0.8]], 0.3),
  ...[-1, 1].map((s) => tubeS('gearS', [[FRONT + 0.7, s * 5.4, EYE[2] + 0.4], [FRONT - 1, s * 7.9, EYE[2] + 0.4], [-1, s * 8, EYE[2] + 0.2]], 0.3)),
]
const squareBits: Sdf[] = [
  tubeS('gearS', [[FRONT + 1, -1.2, EYE[2] + 2.1], [FRONT + 1.1, 0, EYE[2] + 2.4], [FRONT + 1, 1.2, EYE[2] + 2.1]], 0.3),
  ...[-1, 1].map((s) => tubeS('gearS', [[FRONT + 0.4, s * 6, EYE[2] + 1.4], [FRONT - 1.4, s * 8, EYE[2] + 1.4], [-1, s * 8.1, EYE[2] + 1.2]], 0.45)),
]
/**
 * The head accessories in the order the editors list them: grouped, so things are easy to find. NONE, hair, hats,
 * hoods, helmets, little things (bows to halos), horns, masks. Every one defined above must be listed here.
 */
const ACCESSORY_ORDER = [
  'NONE',
  'MOHAWK', 'LONG MOHAWK', 'LIBERTY SPIKES', 'MOHAWK BRAID', 'POMPADOUR', 'FLAT TOP', 'CURLY', 'SIDE FRINGE', 'BOWL CUT', 'LONG HAIR', 'PONYTAIL', 'PIGTAILS', 'BRAID', 'BIG BRAID', 'LOCS',
  'CAP', 'KNIT CAP', 'BERET', 'HACHIMAKI', 'SUN HAT', 'WIDE BRIM', 'COWBOY HAT', 'KASA', 'TOP HAT', 'CHEF HAT', 'GRAD CAP', 'PARTY HAT', 'WIZARD HAT', 'JESTER HAT', 'PIRATE HAT', 'BICORNE', 'CAVALIER',
  'HOOD', 'POINTY HOOD', 'NINJA HOOD',
  'KNIGHT', 'SPARTAN', 'BASCINET', 'TIN HAT', 'VIKING', 'KABUTO', 'SPACE HELMET',
  'BOW', 'FLOWER', 'SPROUT', 'TIARA', 'CROWN', 'HALO', 'HEADPHONES', 'VISOR', 'ANTENNAE', 'ROBOT BOLTS',
  'LITTLE HORNS', 'BULL HORNS', 'RAM HORNS', 'UNICORN HORN',
  'SURGICAL MASK', 'KN95',
]
export const ACCESSORIES: [string, Gear][] = ACCESSORY_ORDER.map((n) => {
  const hit = ACCESSORY_DEFS.find(([k]) => k === n)
  if (!hit) throw new Error(`ACCESSORY_ORDER: no accessory called ${n}`)
  return hit
})
{ const missing = ACCESSORY_DEFS.filter(([n]) => !ACCESSORY_ORDER.includes(n)).map(([n]) => n); if (missing.length) throw new Error(`ACCESSORY_ORDER is missing ${missing.join(', ')}`) }

export const EYEWEAR: [string, Gear][] = [
  ['NONE', { parts: [] }],
  // round glasses: thin round frames, white lenses
  ['ROUND GLASSES', { hideEyes: true, parts: [
    ...[-1, 1].map((s) => ringX(lens(s), 2.5, 0.35)),
    ...[-1, 1].map((s) => gear('gearW', E(lens(s), [0.45, 2.4, 2.4]))),
    ...frameBits,
  ] }],
  // round shades: thin frames, solid black round lenses
  ['ROUND SHADES', { hideEyes: true, parts: [
    ...[-1, 1].map((s) => gear('gearS', E(lens(s), [0.5, 2.5, 2.5]))),
    ...frameBits,
  ] }],
  // big round shades: oversized round black lenses
  ['BIG ROUND SHADES', { hideEyes: true, parts: [
    ...[-1, 1].map((s) => gear('gearS', E([FRONT + 0.9, s * 3.7, EYE[2] + 0.3], [0.55, 2.6, 2.5]))),
    // a glint in each lens
    ...[-1, 1].map((s) => gear('gearW', E([FRONT + 1.4, s * 3.7 - 0.9, EYE[2] + 1.2], [0.3, 0.6, 0.6]))),
    tubeS('gearS', [[FRONT + 0.9, -0.5, EYE[2] + 1.2], [FRONT + 1.1, 0, EYE[2] + 1.5], [FRONT + 0.9, 0.5, EYE[2] + 1.2]], 0.35),
    ...[-1, 1].map((s) => tubeS('gearS', [[FRONT + 0.7, s * 6.2, EYE[2] + 0.6], [FRONT - 1, s * 8, EYE[2] + 0.6], [-1, s * 8.1, EYE[2] + 0.4]], 0.35)),
  ] }],
  // square glasses: chunky black square frames, white lenses
  ['SQUARE GLASSES', { hideEyes: true, parts: [
    ...[-1, 1].map((s) => gear('gearS', roundBox([FRONT + 0.8, s * 3.6, EYE[2] + 0.4], [0.6, 2.6, 2.3], 0.8))),
    ...[-1, 1].map((s) => gear('gearW', roundBox([FRONT + 1.15, s * 3.6, EYE[2] + 0.4], [0.5, 1.9, 1.6], 0.6))),
    ...squareBits,
  ] }],
  // square shades: the big black ones
  ['SQUARE SHADES', accessoryOf('SHADES')],
  // a scouter: a ring over one eye, an arm back to an earpiece
  ['SCOUTER', { parts: [
    ringX([FRONT + 1, EYE[1], EYE[2] + 0.2], 2.6, 0.5),
    tubeS('gearS', [[FRONT + 0.8, EYE[1] + 2.4, EYE[2] + 0.4], [2, 7.9, EYE[2] + 0.4]], 0.45),
    gear('gearS', roundBox([0.6, 8, EYE[2]], [2, 0.8, 2.4], 0.6)),
  ] }],
  // an eye patch over one eye, its strap running diagonally round the head
  ['EYE PATCH', { parts: [
    gear('gearS', E([FRONT + 0.6, -EYE[1], EYE[2] + 0.2], [0.7, 2.3, 2.5])),
    // the strap wraps the head on a smooth rounded band (no square corners), rising from the patch
    // diagonally across the forehead
    { mat: 'gearS', d: (p) => Math.max(Math.abs(roundBox(HC, [7.1, 8.5, 6.9], 5.8).d(p)) - 0.3, Math.abs(p[2] - (EYE[2] + 1.4 + (p[1] + EYE[1]) * 0.45)) - 0.38) },
  ] }],
]

/** Put a cat together: coat, head accessory, clothes, tail. */
export function compose(fur: Fur, gearPick: Gear, tailStyle: TailStyle, clothes: Clothes = { parts: [] }, earStyle: EarStyle = 'cat', feetStyle: FeetStyle = 'nubs', bodyShape: BodyShape = 'petite', eyewear: Gear = { parts: [] }): Look {
  return { ...fur, ...gearPick, hideEyes: gearPick.hideEyes || eyewear.hideEyes, parts: [...(gearPick.parts ?? []), ...(eyewear.parts ?? []), ...clothes.parts], clothes: clothes.parts, bodyDark: clothes.bodyDark, hangs: clothes.hang, shirt: clothes.shirt, tail: tailStyle, ears: earStyle, feet: feetStyle, body: bodyShape }
}

// ---------------------------------------------------------------- feet and shoes
// South Park / Game Boy Pokemon style: standing, the feet are flat pads tucked under the
// body where you can't see them. As a foot steps, it swings up on a hinge at the front of
// the body until it stands flat against the front, like a paddle flipped up toward you,
// then folds back down. Nubs are the plain always-visible little feet.

export type FeetStyle = 'nubs' | 'boots'
export const FEET: FeetStyle[] = ['nubs', 'boots']

/**
 * A pad hinged at (hx, y, hz), lying back under the body at rest (length `len` toward -x);
 * `a` (0..1) swings it up to stand flat against the front. Evaluated by rotating the query
 * point the other way about the hinge.
 */
function hinged(s: Sdf, hx: number, hz: number, a: number): Sdf {
  const th = a * Math.PI / 2
  const c = Math.cos(th), si = Math.sin(th)
  return { mat: s.mat, d: (p) => {
    const x = p[0] - hx, z = p[2] - hz
    // inverse of the swing: a point standing up in front (x ~ 0, z = L) maps back to the
    // pad lying behind the hinge (x = -L, z ~ 0)
    return s.d([hx + x * c - z * si, p[1], hz + x * si + z * c])
  } }
}

const as = (mat: string, s: Sdf): Sdf => ({ mat, d: s.d })

export function feetShapes(style: FeetStyle, lift: [number, number]): Sdf[] {
  if (style === 'nubs') return [-1, 1].map((s, i) => E([1.95, s * 1.25, 0.95 + lift[i]], [1.3, 1.04, 0.95], 'feet'))
  const HX = 2.6 // the hinge: just in front of the body, at the floor
  const HZ = 0.4
  return [-1, 1].flatMap((s, i) => {
    const a = Math.min(1, lift[i] / 1.1) // 0 flat under the body .. 1 flipped up flat
    if (a < 0.08) return [] // a foot that's down isn't drawn at all
    // apart enough to leave a pixel between the two boots
    const y = s * 2.25
    // pads lie from the hinge back under the body (x from HX - len to HX)
    const pad = (mat: string, len: number, wide: number, thick: number, z = 0) =>
      as(mat, roundBox([HX - len / 2, y, HZ + z], [len / 2, wide, thick], Math.min(thick, wide) * 0.9))
    // boots: a black boot with a white platform sole; short enough that, flipped up, the toe
    // stops a couple of pixels below the chin
    return [
      hinged(pad('gearS', 3.6, 1.25, 0.55, 0.5), HX, HZ, a),
      hinged(pad('gearW', 3.8, 1.35, 0.3, -0.05), HX, HZ, a),
    ]
  })
}


// ---------------------------------------------------------------- colour modes
// 2 colours is the one-bit look. Above that, a palette is a set of colour ramps plus an outline
// colour, and each part of the cat (its role) is assigned a ramp. The palettes, splits and roles
// live in src/palette.ts (shared with the game); they're re-exported here under the same names.

/**
 * Paint a sprite by role. Returns a code per pixel: 255 transparent, 0 outline, 1 eye, and
 * 2 + role * 8 + shade for everything else (shade 0 = lightest of `shades`). The editor maps
 * codes to colours through the palette and the role assignments.
 */
export function colorize(b: Bitmap, info: ColorInfo, shades: number): Uint8Array {
  const out = new Uint8Array(b.w * b.h).fill(255)
  const base = info.base ?? b
  const eyes = new Set((info.eyePx ?? []).map(([x, y]) => y * b.w + x))
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const v = b.get(x, y)
    if (v === CLEAR) continue
    const i = y * b.w + x
    // ink eyes take the eye colour; white eyes (on a solid coat) the fur's lightest shade
    if (eyes.has(i)) { out[i] = v === INK ? 1 : 2; continue }
    const hit = info.at?.(x, y) ?? null
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.get(x + dx, y + dy) === CLEAR)
    if (hit === null || edge) { out[i] = 0; continue }
    const filled = hit.role === 'mark' || hit.role === 'accent' || hit.role === 'gear' || hit.role === 'clothes'
    // a line in the one-bit base that isn't a dark fill is a drawn line: keep it as outline
    if (base.get(x, y) === INK && !filled) { out[i] = 0; continue }
    out[i] = 2 + ROLES.indexOf(hit.role) * 8 + Math.min(shades - 1, Math.floor((1 - hit.light) * shades))
  }
  // eyes: one-bit has to turn an eye white inside a black patch, or it would vanish. In colour the patch is a colour
  // (orange, pink...) that a dark eye reads fine on, so the eyes stay dark, unless the patch round them is one of the
  // dark colours (the accent or dark accessories), where they stay light
  const DARK_ROLES = new Set([ROLES.indexOf('accent'), ROLES.indexOf('gear')])
  for (const i of eyes) {
    if (out[i] !== 2) continue
    const x = i % b.w, y = Math.floor(i / b.w)
    let dark = 0, other = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx, Y = y + dy
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue
      const j = Y * b.w + X
      if (eyes.has(j)) continue
      const c = out[j]
      if (c < 2 || c === 255) continue
      if (DARK_ROLES.has((c - 2) >> 3)) dark++
      else other++
    }
    if (other >= dark) out[i] = 1
  }
  // clean-up: a tiny cluster of one colour (one or two pixels) is noise where shading bands or parts meet: a dark dot
  // in a shadow, a stray pixel of one part inside another. It takes the colour most common round it. Lines one pixel
  // wide run on for more than two pixels, so they stay.
  const fixed = out.slice()
  const seen = new Uint8Array(b.w * b.h)
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let start = 0; start < out.length; start++) {
    const v = out[start]
    if (seen[start] || v < 2 || v === 255) continue
    // the cluster of this colour, stopping once it's clearly not tiny
    const cluster = [start]
    seen[start] = 1
    for (let k = 0; k < cluster.length && cluster.length <= 2; k++) {
      const cx = cluster[k] % b.w, cy = Math.floor(cluster[k] / b.w)
      for (const [dx, dy] of N4) {
        const X = cx + dx, Y = cy + dy
        if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue
        const j = Y * b.w + X
        if (!seen[j] && out[j] === v) { seen[j] = 1; cluster.push(j) }
      }
    }
    if (cluster.length > 2) continue
    const fills: number[] = []
    for (const c of cluster) for (const [dx, dy] of N4) {
      const X = (c % b.w) + dx, Y = Math.floor(c / b.w) + dy
      if (X < 0 || Y < 0 || X >= b.w || Y >= b.h) continue
      const n = out[Y * b.w + X]
      if (n >= 2 && n !== 255 && n !== v) fills.push(n)
    }
    if (fills.length < 2) continue
    let best = fills[0], bestN = 0
    for (const n of fills) { const k = fills.filter((m) => m === n).length; if (k > bestN) { best = n; bestN = k } }
    for (const c of cluster) fixed[c] = best
  }
  return fixed
}

// ---------------------------------------------------------------- other animals: swap the ears
// Same big cube head; ears are 'head' material so they take the coat like cat ears do.
// The head top is z = TOPZ (20), its sides y = +-7.6, its face x = 6.2.

export type EarStyle = 'cat' | 'bunny' | 'lop' | 'bear' | 'mouse' | 'dog' | 'fox' | 'pig' | 'monkey' | 'frog' | 'deer' | 'none'
const headPart = (s: Sdf): Sdf => ({ mat: 'head', d: s.d })
export function earShapes(style: EarStyle): Sdf[] {
  const H = HC
  const sides = (f: (s: number) => Sdf) => [-1, 1].map((s) => headPart(f(s)))
  switch (style) {
    case 'bunny': // two tall upright ears
      return sides((s) => cutBelow(E([-0.6, s * 3.6, TOPZ + 4.6], [1.5, 1.8, 6]), TOPZ - 1))
    case 'lop': // bunny ears flopped down the sides
      return sides((s) => ({ mat: 'head', d: (p) => tube([[-0.4, s * 5.6, TOPZ - 0.2], [0, s * 8.6, TOPZ - 1.2], [0.6, s * 9.2, H[2] - 2.4], [0.8, s * 8.8, H[2] - 4.6]], 1.6, 1.4).d(p) }))
    case 'bear': // round little bumps on the corners
      return sides((s) => cutBelow(E([-0.6, s * 5.6, TOPZ + 1.4], [2.6, 2.8, 2.8]), TOPZ - 1))
    case 'mouse': // big round flat discs
      return sides((s) => E([-0.8, s * 6.6, TOPZ + 1.8], [0.9, 3.4, 3.4]))
    case 'dog': // floppy ears hanging down the sides
      return sides((s) => ({ mat: 'head', d: (p) => tube([[-0.6, s * 6.4, TOPZ - 0.4], [-0.2, s * 8.6, TOPZ - 2], [0.2, s * 8.8, H[2] - 1.6]], 1.9, 1.6).d(p) }))
    case 'fox': // big tall pointy ears
      return sides((s) => cutBelow(E([-0.6, s * 5, TOPZ + 2.6], [2.4, 2.8, 4.8]), TOPZ - 1))
    case 'pig': // small triangle ears folded forward
      return sides((s) => ({ mat: 'head', d: (p) => tube([[-1, s * 5, TOPZ - 0.2], [0.8, s * 5.8, TOPZ + 2.6], [3.2, s * 6.2, TOPZ + 2.8]], 2.4, 0.7).d(p) }))
    case 'monkey': // round ears out on the sides at eye height
      return sides((s) => E([-0.8, s * 9, H[2] + 1.2], [1.2, 2.8, 3.2]))
    case 'frog': // two big eye bumps on top
      return sides((s) => cutBelow(E([2.2, s * 4, TOPZ + 1.4], [3, 3, 2.8]), TOPZ - 1))
    case 'deer': // little ears out sideways, and two branching antlers
      return [
        ...sides((s) => E([-0.6, s * 8.4, TOPZ - 0.6], [0.9, 2.6, 1.2])),
        ...sides((s) => ({ mat: 'head', d: (p) => Math.min(
          tube([[-0.6, s * 3, TOPZ - 0.4], [-0.8, s * 4, TOPZ + 3], [-0.6, s * 5.6, TOPZ + 5.6]], 0.7, 0.5).d(p),
          tube([[-0.8, s * 3.8, TOPZ + 2.4], [0.8, s * 3.4, TOPZ + 4.6]], 0.5, 0.4).d(p),
        ) })),
      ]
    case 'none':
      return []
    default:
      return CUBE.ears
  }
}
export const EARS: EarStyle[] = ['none', 'cat', 'bunny', 'lop', 'bear', 'mouse', 'dog', 'fox', 'pig', 'monkey', 'frog', 'deer']

/** One-tap animals: ears + tail (+ a coat that suits them). */
export const ANIMALS: [string, EarStyle, TailStyle, string][] = [
  ['CAT', 'cat', 'swoop', 'PLAIN'], ['BUNNY', 'bunny', 'puff', 'PLAIN'], ['LOP', 'lop', 'puff', 'CALICO'], ['BEAR', 'bear', 'puff', 'PLAIN'],
  ['PANDA', 'bear', 'puff', 'MITTS'], ['MOUSE', 'mouse', 'mouse', 'PLAIN'], ['PUP', 'dog', 'dog', 'SPOTS'], ['FOX', 'fox', 'fox', 'VAN'],
  ['PIG', 'pig', 'pig', 'PLAIN'], ['MONKEY', 'monkey', 'swoop', 'PLAIN'], ['FROG', 'frog', 'none', 'PLAIN'], ['DEER', 'deer', 'puff', 'SPOTS'],
  ['DINO', 'none', 'lizard', 'CHECKER'],
]
