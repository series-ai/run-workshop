import * as THREE from 'three'

/**
 * Leaves drawn in code in the Tiny Treats style: a soft "pillow" made of a front and a back sheet that bulge most
 * along the midrib and meet in a rounded edge, smooth-shaded, coloured from a kit gradient that runs base -> tip and is
 * lighter along the midrib. No hard bevels, no flat slabs.
 *
 * The leaf grows along +Y from where the stalk attaches (the origin), its upper face toward +Z, `length` long.
 */

/** A patch of the kit atlas: u across the swatch, v along its gradient (glTF UV space). */
export interface UVPatch {
  u0: number
  u1: number
  vBase: number
  vTip: number
}

export interface PaddedLeafOptions {
  length: number
  /** Half-width at s (0 = base, 1 = tip), as a fraction of `length`. */
  halfWidth: (s: number) => number
  uv: UVPatch
  /** Pillow thickness as a fraction of length (kit leaves are ~0.02-0.03). */
  thickness?: number
  /** Edges droop below the midrib (negative) or curl up (positive), as a fraction of length. */
  cup?: number
  /** Tip bends away from the face (droop), as a fraction of length. */
  bend?: number
  /** Rows along the length. */
  samples?: number
  /** Sinus depth as a fraction of length: the stalk attaches this far up, base lobes extend behind it (arrowheads). */
  notch?: number
  /** Patch for the underside (default: same as `uv`). */
  backUV?: UVPatch
  /** How much lighter the midrib is than the edges (0..1 of the gradient). */
  sheen?: number
  /** Soft painted veins/stripes: blends the face colour toward `v` (an atlas v in the same swatch) along vein lines. */
  pattern?: {
    v: number
    count: number
    /** How far a vein climbs toward the tip from midrib to edge (fraction of length). */
    rise?: number
    from?: number
    to?: number
    /** 0..1, how wide each stripe is relative to the spacing. */
    width?: number
    strength?: number
    /** Paint the midrib too. */
    midrib?: boolean
  }
  /** Columns across each half (more = smoother stripes). */
  cols?: number
  /** 0..1: young leaves are rolled up around the midrib (upper face inside), unrolling as they grow. */
  roll?: number
}

interface Mapping {
  L: number
  maxW: number
  /** Leaf-space point and surface heights for half `side` at (s, a); a = 0 midrib, 1 edge. */
  at: (side: number, s: number, a: number) => { x: number; y: number; zFront: number; zBack: number }
}

function mapping(o: PaddedLeafOptions): Mapping {
  const L = o.length
  const notch = o.notch ?? 0
  const notchY = notch * L
  let maxW = 0
  for (let i = 0; i <= 40; i++) maxW = Math.max(maxW, o.halfWidth(i / 40) * L)
  const thick = (o.thickness ?? 0.1) * L
  const cup = (o.cup ?? -0.04) * L
  const bend = (o.bend ?? 0.08) * L
  const at = (side: number, s: number, a: number) => {
    const hw = o.halfWidth(s) * L
    // arrowhead lobes: below the sinus each half is a separate lobe starting away from the midrib
    const inner = notch > 0 && s < notch ? hw * 0.6 * Math.pow(1 - s / notch, 0.7) : 0 // wide lobe bottoms read as rounded
    const x = side * (inner + a * (hw - inner))
    const local = (hw - inner) / Math.max(1e-6, maxW)
    const ends = Math.pow(Math.min(1, 5 * s, 5 * (1 - s)), 0.35) // closes the pillow at base and tip, rounded
    const bulge = thick * Math.min(1, local * 1.8) * ends * Math.pow(Math.max(0, 1 - Math.pow(a, 2.5)), 0.32) // full almost to the edge, then rolls over
    const across = Math.abs(x) / Math.max(1e-6, maxW)
    const fold = -0.05 * L * across // soft V along the midrib, like the kit leaves
    const lift = cup * across * across + fold
    const droop = -bend * s * s
    const roll = o.roll ?? 0
    if (roll > 0.001 && hw > 1e-6) {
      // wrap the cross-section around a tube above the midrib: the edges curl up over the face toward each other
      const span = roll * Math.PI * 0.92
      const R = hw / span
      const th = (x / hw) * span
      const [sn, cs] = [Math.sin(th), Math.cos(th)]
      const px = R * sn
      const pz = R * (1 - cs)
      const zf = lift + bulge * 0.6
      const zb = lift - bulge * 0.4
      // offsets along the surface normal (-sin, cos); x of front and back differ slightly, average them
      return { x: px - ((zf + zb) / 2) * sn, y: s * L - notchY, zFront: pz + zf * cs + droop, zBack: pz + zb * cs + droop }
    }
    return { x, y: s * L - notchY, zFront: lift + droop + bulge * 0.6, zBack: lift + droop - bulge * 0.4 }
  }
  return { L, maxW, at }
}

/** Smooth normals by position, so the front/back seam and the midrib seam shade softly. */
function smoothNormals(geo: THREE.BufferGeometry) {
  geo.computeVertexNormals()
  const pos = geo.getAttribute('position')
  const nrm = geo.getAttribute('normal')
  const acc = new Map<string, THREE.Vector3>()
  const key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`
  for (let i = 0; i < pos.count; i++) {
    const k = key(i)
    const v = acc.get(k) ?? new THREE.Vector3()
    v.x += nrm.getX(i)
    v.y += nrm.getY(i)
    v.z += nrm.getZ(i)
    acc.set(k, v)
  }
  for (let i = 0; i < pos.count; i++) {
    const v = acc.get(key(i))!.clone().normalize()
    nrm.setXYZ(i, v.x, v.y, v.z)
  }
  nrm.needsUpdate = true
}

/** 0..1 how strongly a point sits on a painted vein (soft falloff, no hard lines). */
function veinAmount(p: NonNullable<PaddedLeafOptions['pattern']>, s: number, a: number): number {
  const from = p.from ?? 0.12
  const to = p.to ?? 0.88
  const rise = p.rise ?? 0.18
  const strength = p.strength ?? 0.7
  const width = p.width ?? 0.35
  let v = 0
  if (p.midrib !== false) v = Math.max(v, Math.exp(-Math.pow(a / 0.12, 2)))
  const phase = ((s - rise * a - from) / Math.max(1e-6, to - from)) * Math.max(1, p.count - 1)
  if (phase > -0.5 && phase < p.count - 0.5) {
    const d = phase - Math.round(phase)
    v = Math.max(v, Math.exp(-Math.pow(d / width, 2)) * (1 - 0.5 * a * a))
  }
  return v * strength
}

export function paddedLeaf(o: PaddedLeafOptions): THREE.BufferGeometry {
  const map = mapping(o)
  const rows = o.samples ?? 14
  const cols = o.cols ?? 6
  const sheen = o.sheen ?? 0 // plain gradient base -> tip; detail goes in the pattern layer
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const uvOf = (p: UVPatch, s: number, a: number) => [
    THREE.MathUtils.lerp(p.u0, p.u1, 0.5 + 0.5 * a),
    THREE.MathUtils.lerp(p.vBase, p.vTip, THREE.MathUtils.clamp(s * (1 - sheen) + (1 - a) * sheen, 0, 1)),
  ]
  for (const side of [1, -1]) {
    for (const face of [1, -1]) {
      const start = pos.length / 3
      for (let i = 0; i <= rows; i++) {
        const s = i / rows
        for (let j = 0; j <= cols; j++) {
          const a = 1 - Math.pow(1 - j / cols, 1.6) // more columns near the edge, where it rolls over
          const p = map.at(side, s, a)
          pos.push(p.x, p.y, face > 0 ? p.zFront : p.zBack)
          const t = face > 0 ? uvOf(o.uv, s, a) : uvOf(o.backUV ?? o.uv, s, a)
          if (face > 0 && o.pattern) t[1] = THREE.MathUtils.lerp(t[1], o.pattern.v, veinAmount(o.pattern, s, a))
          uv.push(...t)
        }
      }
      // winding: front faces +Z, back faces -Z; the mirrored half flips
      const flip = (face > 0) !== (side > 0)
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const a = start + i * (cols + 1) + j
          const b = a + 1
          const c = a + cols + 1
          const d = c + 1
          if (flip) idx.push(a, c, b, b, c, d)
          else idx.push(a, b, c, b, d, c)
        }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  smoothNormals(geo)
  return geo
}

export interface VeinOptions {
  /** Side veins per side. */
  count: number
  /** Angle of side veins from the midrib, radians. */
  angle?: number
  /** Vein width as a fraction of length. */
  width?: number
  /** Draw the midrib too. */
  midrib?: boolean
  uv: UVPatch
  /** Where along the leaf the side veins start / end (fractions of length). */
  from?: number
  to?: number
}

/** Soft vein strips lying on the pillow's upper surface, tapering toward the edge (midrib + side veins). */
export function leafVeins(o: PaddedLeafOptions, v: VeinOptions): THREE.BufferGeometry {
  const map = mapping(o)
  const lift = 0.0025 * map.L
  const w0 = (v.width ?? 0.012) * map.L
  const pos: number[] = []
  const uv: number[] = []
  const uvAt = (s: number) => [(v.uv.u0 + v.uv.u1) / 2, THREE.MathUtils.lerp(v.uv.vBase, v.uv.vTip, s)]
  const strip = (side: number, pts: [number, number][]) => {
    const P = pts.map(([s, a]) => map.at(side, s, a))
    for (let i = 0; i < P.length - 1; i++) {
      const [p, q] = [P[i], P[i + 1]]
      const dx = q.x - p.x
      const dy = q.y - p.y
      const l = Math.hypot(dx, dy) || 1
      const nx = -dy / l
      const ny = dx / l
      const wa = (w0 * (1 - 0.8 * (i / (P.length - 1)))) / 2
      const wb = (w0 * (1 - 0.8 * ((i + 1) / (P.length - 1)))) / 2
      const quad = [
        [p.x + nx * wa, p.y + ny * wa, p.zFront, pts[i][0]],
        [p.x - nx * wa, p.y - ny * wa, p.zFront, pts[i][0]],
        [q.x - nx * wb, q.y - ny * wb, q.zFront, pts[i + 1][0]],
        [q.x + nx * wb, q.y + ny * wb, q.zFront, pts[i + 1][0]],
      ]
      for (const k of [0, 1, 2, 0, 2, 3]) {
        const [x, y, z, s] = quad[k]
        pos.push(x, y, z + lift)
        uv.push(...uvAt(s))
      }
    }
  }
  const notch = o.notch ?? 0
  if (v.midrib !== false) strip(1, Array.from({ length: 12 }, (_, i) => [notch + (0.95 - notch) * (i / 11), 0] as [number, number]))
  const from = v.from ?? 0.15
  const to = v.to ?? 0.85
  const rise = Math.cos(v.angle ?? 0.9) * 0.22
  for (let k = 0; k < v.count; k++) {
    const s0 = from + (to - from) * (k / Math.max(1, v.count - 1))
    for (const side of [1, -1]) strip(side, Array.from({ length: 7 }, (_, i) => [Math.min(0.97, s0 + rise * (i / 6)), 0.85 * (i / 6)] as [number, number]))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const n = new Float32Array(pos.length)
  for (let i = 2; i < n.length; i += 3) n[i] = 1 // strips lie on the face: shade them like the face
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3))
  return g
}

/** Common width profiles (half-width as a fraction of length). */
export const profiles = {
  /** Sansevieria 'Hahnii' (bird's nest): short broad leaf with a quick point, in a tight round rosette. */
  hahnii: (s: number) => 0.03 + 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(s, 0.7))), 0.7) * (s > 0.8 ? Math.max(0.05, 1 - (s - 0.8) * 4.6) : 1),
  /** Classic snake plant sword: narrow stalk-like base, long straight blade, drawn-out point. */
  sword: (s: number) => 0.012 + 0.068 * Math.min(1, s / 0.18) ** 0.6 * Math.pow(Math.max(0, 1 - Math.max(0, s - 0.55) / 0.45), 0.85),
  /** Whale fin sansevieria: narrow base, very broad paddle, short rounded point. */
  whaleFin: (s: number) => 0.02 + 0.13 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(s, 0.85))), 0.6) * (s > 0.85 ? Math.max(0.05, 1 - (s - 0.85) * 5.5) : 1),
}
