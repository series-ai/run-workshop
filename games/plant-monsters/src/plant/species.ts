import * as THREE from 'three'
import { buildStalk, createNaturalLeaf } from './stalk'
import { leafVeins, paddedLeaf, type PaddedLeafOptions, type UVPatch, type VeinOptions } from './leafShapes'
import { withPattern, type PatternName } from './leafPatterns'
import type { ProfileName } from './pothosVariegation'

/**
 * Stalked-leaf species drawn in code (no kit model exists for them): peace lily, alocasia, calathea, bird of paradise.
 * They share one grower: leaves come up one at a time from crowns in the soil, the newest standing upright in the
 * middle with its tip up, older ones leaning out and drooping, blades mounted the natural way (see createNaturalLeaf).
 * Mature plants add flowers (peace lily, bird of paradise).
 */

/** The kit atlas is an 8 x 4 grid of vertical gradients; pick a slice of one swatch (glTF UV space). */
function swatch(col: number, row: number, from: number, to: number): UVPatch {
  return { u0: col * 0.125 + 0.03, u1: col * 0.125 + 0.095, vBase: (row + from) * 0.25, vTip: (row + to) * 0.25 }
}

export const PALETTE = {
  deepGreen: swatch(1, 1, 0.66, 0.3), // glossy dark green (peace lily)
  inkGreen: swatch(1, 1, 0.74, 0.46), // very dark green (alocasia); the swatch's light end is pale yellow-green for veins
  freshGreen: swatch(1, 1, 0.56, 0.2), // calathea green; the swatch's light end paints the stripes
  oliveGreen: swatch(6, 2, 0.88, 0.38), // grey-olive (bird of paradise)
  paleGreen: swatch(6, 2, 0.15, 0.05), // pale midribs
  stripe: swatch(6, 2, 0.32, 0.22), // calathea feathering: soft, a few shades lighter than the leaf
  white: swatch(3, 0, 0.05, 0.3),
  cream: swatch(0, 3, 0.35, 0.65),
  orange: swatch(0, 2, 0.25, 0.65),
  blue: swatch(4, 1, 0.45, 0.85),
  burgundy: swatch(5, 2, 0.7, 0.92),
  lavender: swatch(6, 1, 0.4, 0.7),
}

export const PROFILES = {
  peaceLily: (s: number) => 0.015 + 0.2 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.68)), 0.75),
  // Alocasia 'Frydek': long arrowhead (sagittate) with rounded back lobes, broad shoulders, convex sides, drawn-out tip
  alocasia: (s: number) =>
    s < 0.3
      ? 0.27 * (0.4 + 0.6 * Math.sqrt(Math.max(0, 1 - Math.pow((0.3 - s) / 0.3, 2)))) // rounded lobes
      : 0.27 * Math.pow(1 - (s - 0.3) / 0.7, 0.7) + 0.006, // near-straight sides to a long point
  calathea: (s: number) => 0.02 + 0.38 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.9)), 0.55),
  paddle: (s: number) => 0.012 + 0.16 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 0.5),
  spathe: (s: number) => 0.01 + 0.2 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.65)), 0.8),
}

/** Same pseudo-random as plant.ts (stable per key). */
function jitter(key: number): number {
  const x = Math.sin(key * 127.1 + 311.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

const UP = new THREE.Vector3(0, 1, 0)
const bladeCache = new Map<string, THREE.Object3D>()
/** The plain (unpatterned) version of each cached blade, by key, for previews and re-patterning. */
export const plainBlades = new Map<string, THREE.Object3D>()

/** A padded blade (plus optional veins) with its origin at the stalk attach point; cached by key. */
/** A plain pillow blade (gradient only) with an optional pattern layer on top; cached by key. */
function blade(key: string, leaf: PaddedLeafOptions, material: THREE.Material, pattern: PatternName | null = null, veins?: VeinOptions): THREE.Object3D {
  const hit = bladeCache.get(`${key}|${pattern}`)
  if (hit) return hit
  let g = plainBlades.get(key)
  if (!g) {
    g = new THREE.Group()
    const { pattern: _ignored, ...plain } = leaf
    void _ignored
    g.add(new THREE.Mesh(paddedLeaf(plain), material))
    if (veins) g.add(new THREE.Mesh(leafVeins(plain, veins), material))
    plainBlades.set(key, g)
  }
  const out = withPattern(g, pattern, key) // one plain blade shared by every pattern variant
  bladeCache.set(`${key}|${pattern}`, out)
  return out
}

/** Variegated cultivar: leaf `g` gets one of 12 assembled two-halves patterns of that profile. */
function variegated(profile: ProfileName | undefined, g: number, fallback: PatternName | null): PatternName | null {
  return profile ? `var:${profile}:${g % 12}` : fallback
}

export interface ClumpSpec {
  /** Leaves per crown before a new crown comes up elsewhere in the pot. */
  perCrown: number
  /** Blade for a leaf of maturity `m` (0..1). Return the blade and its scale. */
  /** `roll` 0..1: how rolled up the blade still is (young / unfurling leaves). */
  blade: (m: number, g: number, roll: number) => { obj: THREE.Object3D; scale: number }
  /** Stalk length for maturity `m`. */
  stalk: (m: number) => number
  /** Leaves until full maturity. */
  matureAt: number
  /** Lean from vertical: newest -> oldest in a crown. */
  lean: [number, number]
  /** Blade drop below horizontal: newest -> oldest (negative = tip up). */
  drop: [number, number]
  stalkRadius: number
  arch?: number
  /** Flower for crown `k` once the plant has `g` leaves (or null). */
  flower?: (k: number, g: number, tallest: number, heading: number) => THREE.Object3D | null
}

export function growClump(spec: ClumpSpec, age: number, potRadius: number, stalkMaterial: THREE.Material): THREE.Group {
  const plant = new THREE.Group()
  if (age <= 0) return plant
  const total = Math.floor(age)
  const unfurl = age - total
  const golden = 2.39996
  for (let k = 0; k * spec.perCrown <= total; k++) {
    const first = k * spec.perCrown
    const count = Math.min(spec.perCrown, total - first + 1)
    const ang = k * golden + 0.7
    const rad = k === 0 ? potRadius * 0.15 : potRadius * (0.62 + 0.15 * (k % 2))
    const base = new THREE.Vector3(Math.sin(ang) * rad, -0.03, Math.cos(ang) * rad)
    let tallest = 0
    for (let j = 0; j < count; j++) {
      const g = first + j
      const isNewest = g === total
      const grow = isNewest ? 0.45 + 0.55 * unfurl : 1
      const m = Math.min(1, g / spec.matureAt)
      const age01 = (count - 1 - j) / Math.max(1, spec.perCrown - 1) // 0 = newest in the crown
      const heading = ang + j * golden + 0.25 * jitter(g * 7)
      const len = spec.stalk(m) * grow * (1 + 0.08 * jitter(g * 7 + 1))
      tallest = Math.max(tallest, len)
      const lean = THREE.MathUtils.lerp(spec.lean[0], spec.lean[1], age01) + (k ? 0.1 : 0) + 0.05 * jitter(g * 7 + 2)
      const drop = THREE.MathUtils.lerp(spec.drop[0], spec.drop[1], age01) + 0.1 * jitter(g * 7 + 3)
      // young leaves come up rolled and open as they grow; the newest unrolls as it unfurls
      const roll = Math.min(0.9, 0.45 * Math.pow(1 - m, 2) + (isNewest ? 0.8 * (1 - unfurl) : 0))
      const b = spec.blade(m, g, Math.round(roll * 8) / 8) // quantised: a handful of cached rolled blades
      const leaf = createNaturalLeaf(
        b.obj,
        { length: len, lean, arch: (spec.arch ?? 0.15) + 0.08 * jitter(g * 7 + 4), heading, baseRadius: spec.stalkRadius, tipRadius: spec.stalkRadius * 0.7 },
        // upright (tip-up) leaves face outward like in the photos; spreading leaves face up
        { heading, drop, roll: 0.12 * jitter(g * 7 + 5), face: UP.clone().addScaledVector(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)), 0.3 + 1.6 * Math.max(0, -drop)).normalize() },
        stalkMaterial,
        b.scale * grow,
      )
      leaf.position.copy(base)
      plant.add(leaf)
    }
    const f = spec.flower?.(k, total, tallest, ang + 1.3)
    if (f) {
      f.position.add(base)
      plant.add(f)
    }
  }
  return plant
}

/** Basis helper: local +X/+Y/+Z -> given world directions. */
function basis(obj: THREE.Object3D, x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3) {
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
}

function flowerStalk(length: number, heading: number, lean: number, material: THREE.Material) {
  const stalk = buildStalk({ length, baseRadius: 0.014, tipRadius: 0.011, lean, arch: 0.1, heading, segments: 6 })
  return { mesh: new THREE.Mesh(stalk.geometry, material), tip: stalk.tipPosition }
}

// ---------------------------------------------------------------------------------------------------------------

export function peaceLily(leafMat: THREE.Material, variegation?: ProfileName): ClumpSpec {
  return {
    perCrown: 8,
    matureAt: 8,
    stalkRadius: 0.012,
    lean: [0.1, 0.55],
    drop: [-1.0, 0.25],
    arch: 0.25,
    stalk: (m) => 0.2 + 0.28 * m,
    blade: (m, g, roll) => {
      const v = g % 2
      const obj = blade(`pl${v}r${roll}`, {
        length: 0.85 + 0.1 * v, halfWidth: PROFILES.peaceLily, uv: PALETTE.deepGreen, cup: -0.045, bend: 0.2, roll,
      }, leafMat, variegated(variegation, g, null))
      return { obj, scale: 0.5 + 0.5 * m }
    },
    flower: (k, g, tallest, heading) => {
      if (g < 9 + k * 3) return null
      const grp = new THREE.Group()
      const st = flowerStalk(tallest + 0.75, heading, 0.14, leafMat)
      grp.add(st.mesh)
      const spatheOpts = { length: 0.36, halfWidth: PROFILES.spathe, uv: PALETTE.white, cup: 0.06, bend: -0.04, thickness: 0.02 }
      const spathe = new THREE.Mesh(paddedLeaf(spatheOpts), leafMat)
      const spadix = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.09, 3, 6), leafMat)
      setUV(spadix.geometry, PALETTE.cream)
      spadix.position.set(0, 0.075, 0.03)
      const head = new THREE.Group()
      head.add(spathe, spadix)
      const out = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
      const yDir = UP.clone().addScaledVector(out, 0.35).normalize()
      const zDir = out.clone().addScaledVector(yDir, -out.dot(yDir)).normalize()
      basis(head, new THREE.Vector3().crossVectors(yDir, zDir), yDir, zDir)
      head.position.copy(st.tip)
      grp.add(head)
      return grp
    },
  }
}

export function alocasia(leafMat: THREE.Material, variegation?: ProfileName): ClumpSpec {
  // Frydek / Polly: a few big arrowheads on long, thick, nearly straight petioles that stand well above the pot; each
  // blade hangs off its stalk tip, tip pointing out and down. Few leaves at a time (old ones die back).
  return {
    perCrown: 3,
    matureAt: 5,
    stalkRadius: 0.032,
    lean: [0.12, 0.5],
    drop: [0.25, 0.85],
    arch: 0.08,
    stalk: (m) => 0.55 + 0.75 * m,
    blade: (m, g, roll) => {
      const v = g % 2
      const opts = { length: 1.0 + 0.08 * v, halfWidth: PROFILES.alocasia, uv: PALETTE.inkGreen, cup: -0.03, bend: 0.06, notch: 0.3, roll }
      const obj = blade(`al${v}r${roll}`, opts, leafMat, variegated(variegation, g, 'polly'))
      return { obj, scale: 0.6 + 0.55 * m }
    },
  }
}

export function calathea(leafMat: THREE.Material, variegation?: ProfileName): ClumpSpec {
  return {
    perCrown: 7,
    matureAt: 7,
    stalkRadius: 0.012,
    lean: [0.1, 0.6],
    drop: [-0.9, 0.35],
    arch: 0.22,
    stalk: (m) => 0.22 + 0.3 * m,
    blade: (m, g, roll) => {
      const v = g % 2
      const opts = { length: 0.68 + 0.06 * v, halfWidth: PROFILES.calathea, uv: PALETTE.freshGreen, backUV: PALETTE.deepGreen, cup: -0.04, bend: 0.08, roll }
      const obj = blade(`ca${v}r${roll}`, opts, leafMat, variegated(variegation, g, 'orbifolia'))
      return { obj, scale: 0.55 + 0.45 * m }
    },
  }
}

export function birdOfParadise(leafMat: THREE.Material): ClumpSpec {
  return {
    perCrown: 6,
    matureAt: 6,
    stalkRadius: 0.024,
    lean: [0.06, 0.45],
    drop: [-1.0, -0.15], // long stalks, paddles held up high, older ones opening out
    arch: 0.08,
    stalk: (m) => 0.5 + 0.75 * m,
    blade: (m, g, roll) => {
      const v = g % 2
      const obj = blade(`bp${v}r${roll}`, {
        length: 0.95 + 0.1 * v, halfWidth: PROFILES.paddle, uv: PALETTE.oliveGreen, cup: -0.025, bend: 0.03, roll,
      }, leafMat, null)
      return { obj, scale: 0.5 + 0.5 * m }
    },
    flower: (k, g, tallest, heading) => {
      if (g < 9 + k * 4) return null
      const grp = new THREE.Group()
      const st = flowerStalk(tallest * 0.95, heading, 0.2, leafMat)
      grp.add(st.mesh)
      const head = new THREE.Group()
      // beak (bract): a long horizontal pod pointing outward along +X
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.32, 6), leafMat)
      setUV(beak.geometry, PALETTE.lavender)
      beak.rotation.z = -Math.PI / 2
      beak.position.x = 0.12
      head.add(beak)
      // orange sepals fanning up out of the beak, blue tongue pointing forward
      for (let i = 0; i < 3; i++) {
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.2, 5), leafMat)
        setUV(petal.geometry, PALETTE.orange)
        petal.position.set(0.02 + i * 0.03, 0.09, (i - 1) * 0.02)
        petal.rotation.z = -0.35 - i * 0.25
        head.add(petal)
      }
      const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.16, 5), leafMat)
      setUV(tongue.geometry, PALETTE.blue)
      tongue.position.set(0.1, 0.06, 0)
      tongue.rotation.z = -0.9
      head.add(tongue)
      head.rotation.y = heading - Math.PI / 2
      head.scale.setScalar(1.8)
      head.position.copy(st.tip)
      grp.add(head)
      return grp
    },
  }
}

function setUV(geo: THREE.BufferGeometry, p: UVPatch) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.u0 + p.u1) / 2, THREE.MathUtils.lerp(p.vBase, p.vTip, uv.getY(i)))
  uv.needsUpdate = true
}
