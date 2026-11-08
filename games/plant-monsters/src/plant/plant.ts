import * as THREE from 'three'
import { buildStalk, createLeaf, createNaturalLeaf, orientBlade } from './stalk'
import { paddedLeaf, profiles } from './leafShapes'
import { withPattern } from './leafPatterns'
import type { ProfileName } from './pothosVariegation'

/**
 * Plants that grow node by node, the way monstera and pothos really grow:
 *  - a stem (monstera) or vine (pothos) is drawn procedurally;
 *  - each node carries one leaf; leaves alternate sides in two ranks and then fan out;
 *  - a leaf's shape is fixed when it unfurls, so the plant keeps its history: small juvenile leaves at the oldest
 *    nodes, bigger and more open leaves at the newer ones, and a rolled leaf unfurling at the growing tip;
 *  - monstera grows as a clump: once a shoot carries a few leaves, the next leaf comes from a new shoot in the pot;
 *  - older nodes grow aerial roots (short thick nubs on monstera, small root tips on pothos).
 *
 * `age` is the number of nodes grown. Its fractional part is how far the newest leaf has unfurled.
 */

export type MonsteraType = 'fenestrated' | 'heavy' | 'heavybig' | 'skeleton'

export interface PlantAssets {
  /** Monstera blades by file name (no extension), stalk-free, origin at the attach point. */
  monstera: Map<string, THREE.Object3D>
  /** Pothos leaves (blade + its short stalk), origin where the stalk meets the vine. Ordered small -> large. */
  pothos: THREE.Object3D[]
  /** Optional variegated versions: pothosVariants[size][k]. A leaf picks one by its node, so every leaf differs. */
  pothosVariants?: THREE.Object3D[][]
  /** Kit texture material for stems, stalks and vines. */
  stalkMaterial: THREE.Material
  rootMaterial: THREE.Material
}

const UP = new THREE.Vector3(0, 1, 0)
/** Pothos vine colour strip on the kit texture (measured from the kit pothos vine). */
const POTHOS_UV = { u: 0.0562, vBase: 0.28, vTip: 0.39 }

/** Stable pseudo-random value in [-1, 1] for a given integer key (so a plant looks the same every rebuild). */
function jitter(key: number): number {
  const x = Math.sin(key * 127.1 + 311.7) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

/** Monstera leaf sequence by node index: juvenile hearts first, then progressively more fenestrated leaves. */
function monsteraLeafFor(type: MonsteraType, node: number): { file: string; scale: number; stalk: number } {
  const seq = [
    { file: 'monstera_baby_A', scale: 0.85, stalk: 0.55 },
    { file: 'monstera_baby_B', scale: 1.0, stalk: 0.7 },
    { file: 'monstera_baby_C', scale: 1.1, stalk: 0.8 },
    { file: `monstera_${type}_stage1`, scale: 0.6, stalk: 0.95 },
    { file: `monstera_${type}_stage2`, scale: 0.7, stalk: 1.05 },
    { file: `monstera_${type}_stage3`, scale: 0.82, stalk: 1.15 },
    { file: `monstera_${type}_stage4`, scale: 0.92, stalk: 1.25 },
    { file: `monstera_${type}_stage5`, scale: 1.02, stalk: 1.35 },
  ]
  return seq[Math.min(node, seq.length - 1)]
}

/** Thin brown aerial root (used for pothos node nubs). */
function aerialRoot(from: THREE.Vector3, outward: THREE.Vector3, length: number, material: THREE.Material): THREE.Mesh {
  const end = from.clone().addScaledVector(outward, length * 0.45).setY(from.y - length)
  const mid = from.clone().addScaledVector(outward, length * 0.35).add(new THREE.Vector3(0, -length * 0.2, 0))
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, end), 4, 0.01, 5, false), material)
}

/** Thick, short, tapering monstera root nub: comes out of a node and angles down into the soil. */
function rootNub(from: THREE.Vector3, outward: THREE.Vector3, length: number, material: THREE.Material): THREE.Mesh {
  const dir = outward.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, -1, 0)).normalize()
  const geo = new THREE.CylinderGeometry(0.009, 0.024, length, 6, 1)
  geo.translate(0, -length / 2, 0) // hang from the node
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.copy(from)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir)
  return mesh
}

export interface MonsteraOptions {
  /** Radius inside the pot where shoots may come up. */
  potRadius: number
  /** Leaves a shoot carries before the plant starts a new shoot elsewhere in the pot. */
  leavesPerShoot?: number
  /** How far stems sink into the soil so they look seated. */
  sink?: number
  /** Blade tilt on its stalk (negative tips the leaf forward). */
  bladePitch?: number
  /** Variegated cultivar (monsteraAlbo / monsteraThai): each leaf gets one of 12 assembled patterns. */
  variegation?: ProfileName
  /** A sport: only the newest leaf comes in variegated with this pattern (a plain plant throwing one odd leaf). */
  sport?: ProfileName
  /** Which of the profile's 12 patterns the sport leaf gets. */
  sportIx?: number
}

/**
 * Monstera as a clump of shoots. Each shoot is a short stem whose nodes each carry one leaf (two ranks, fanning out);
 * once a shoot has `leavesPerShoot` leaves, the next leaf comes from a new shoot elsewhere in the pot.
 * Leaf maturity follows the plant's overall node count, so later shoots open with more mature leaves (new shoots start
 * a couple of stages behind, as young suckers do).
 */
export function growMonstera(assets: PlantAssets, type: MonsteraType, age: number, options: MonsteraOptions): THREE.Group {
  const plant = new THREE.Group()
  if (age <= 0) return plant
  const per = options.leavesPerShoot ?? 4
  const sink = options.sink ?? 0.05
  const pitch = options.bladePitch ?? -0.45
  const total = Math.floor(age)
  const unfurl = age - total
  const internode = 0.13 // a stretch of bare stem between leaf nodes
  const golden = 2.39996

  for (let k = 0; k * per <= total; k++) {
    const first = k * per // global index of this shoot's first node
    const count = Math.min(per, total - first + 1) // nodes on this shoot (last one may be unfurling)
    const shootIsGrowing = first + count - 1 === total
    // Shoot position in the pot: first shoot near the middle, later ones around it.
    const ang = k * golden + 0.6
    const rad = k === 0 ? options.potRadius * 0.15 : options.potRadius * (0.62 + 0.12 * (k % 2))
    const base = new THREE.Vector3(Math.sin(ang) * rad, -sink, Math.cos(ang) * rad)
    const outAng = k === 0 ? 0.6 : ang // later shoots lean away from the middle
    const stemLen = sink + Math.max(0.04, (count - 1 + (shootIsGrowing ? unfurl : 1)) * internode)
    const stem = buildStalk({ length: stemLen, baseRadius: 0.06, tipRadius: 0.048, lean: 0.1, arch: 0.05, heading: outAng, segments: 4 })
    const stemMesh = new THREE.Mesh(stem.geometry, assets.stalkMaterial)
    stemMesh.position.copy(base)
    plant.add(stemMesh)
    const along = (d: number) => {
      const pts = stem.points
      const f = THREE.MathUtils.clamp(d / stemLen, 0, 1) * (pts.length - 1)
      const i = Math.min(pts.length - 2, Math.floor(f))
      return pts[i].clone().lerp(pts[i + 1], f - i).add(base)
    }

    for (let j = 0; j < count; j++) {
      const g = first + j // global node index -> leaf maturity
      const isNewest = g === total
      const nodePos = along(sink + j * internode + 0.02)
      // Two ranks that fan out, biased away from the pot middle for outer shoots.
      const fan = k === 0 ? 0.75 + 0.35 * j : 0.55 + 0.25 * j
      const heading = outAng + (j % 2 === 0 ? -1 : 1) * fan + (k === 0 ? (j % 2) * Math.PI : 0) + 0.25 * jitter(g * 7 + 1)
      const stage = Math.max(0, g - 2 * k)
      const leaf = monsteraLeafFor(type, stage)

      if (isNewest && unfurl < 0.5) {
        if (unfurl <= 0.05) break
        const grow = THREE.MathUtils.smoothstep(unfurl, 0.05, 0.5)
        plant.add(positioned(createLeaf(assets.monstera.get('monstera_rolled')!, { length: leaf.stalk * (0.35 + 0.45 * grow), lean: 0.08, arch: 0.05, heading, baseRadius: 0.03, tipRadius: 0.024 }, assets.stalkMaterial, 0.5 + 0.4 * grow), nodePos))
        continue
      }
      const expand = isNewest ? 0.7 + 0.3 * THREE.MathUtils.smoothstep(unfurl, 0.5, 1) : 1
      const stalkLen = leaf.stalk * expand * (1 + 0.08 * jitter(g * 7 + 3))
      const reach = Math.min(1, stalkLen / 1.35)
      // Older leaves (lower on the shoot) splay out further and droop more; the newest stand up in the middle.
      const age01 = (count - 1 - j) / Math.max(1, per - 1)
      const lean = 0.2 + 0.35 * age01 + 0.12 * reach + 0.06 * jitter(g * 7 + 2)
      const drop = -0.1 + 0.55 * age01 + 0.25 * reach + 0.12 * jitter(g * 7 + 6)
      const r = THREE.MathUtils.clamp(stalkLen * 0.016, 0.012, 0.024)
      const pattern = options.sport && isNewest ? options.sport : options.variegation
      // the sport's leaf: pattern 0 of the profile (a bold one), seeded apart from the cultivar's own leaves
      const patternIx = options.sport && isNewest ? options.sportIx ?? 0 : g % 12
      const leafGroup = positioned(
          createNaturalLeaf(
            // baby leaves are small: bigger freckles/daubs so they stay readable
            pattern ? withPattern(assets.monstera.get(leaf.file)!, `var:${pattern}:${patternIx}:${leaf.file.includes('baby') ? 1.4 : 1}`, leaf.file, 'planar') : assets.monstera.get(leaf.file)!,
            { length: stalkLen, lean, arch: 0.12 + 0.1 * jitter(g * 7 + 4), heading, baseRadius: r, tipRadius: r * 0.75 },
            { heading, drop, roll: 0.15 * jitter(g * 7 + 8) },
            assets.stalkMaterial,
            leaf.scale * expand * (1 + 0.07 * jitter(g * 7 + 5)),
          ),
          nodePos,
        )
      if (options.sport && isNewest) leafGroup.userData.sport = true
      plant.add(leafGroup)
    }
    // Root nubs on the lower nodes of older shoots, angled down into the soil.
    if (count >= 3) {
      for (let j = 0; j < count - 2; j++) {
        const at = along(sink + j * internode + 0.01)
        const out = new THREE.Vector3(Math.sin(outAng + j * 2.1), 0, Math.cos(outAng + j * 2.1))
        plant.add(rootNub(at.addScaledVector(out, 0.045), out, 0.05 + at.y * 1.2 + 0.06, assets.rootMaterial))
      }
    }
  }
  return plant
}

/**
 * Pothos: a vine that climbs out of the soil, spills over the rim at `rimRadius`, and trails down the outside of the pot.
 * Leaves alternate along it; leaf size ramps up along the vine, and the growing tip carries a small new leaf.
 */
export function growPothos(assets: PlantAssets, age: number, rimRadius: number, rimHeight: number, heading = 0, internode = 0.17): THREE.Group {
  const plant = new THREE.Group()
  if (age <= 0) return plant
  const nodes = Math.floor(age)
  const unfurl = age - nodes
  const len = (nodes + unfurl) * internode + 0.05 + rimRadius * 0.6
  const out = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))

  // Vine path: up from the soil, over the rim, then down the outside of the pot, curling slightly.
  const path = new THREE.CatmullRomCurve3([
    out.clone().multiplyScalar(rimRadius * 0.3).setY(-0.03),
    out.clone().multiplyScalar(rimRadius * 0.45).setY(0.12),
    out.clone().multiplyScalar(rimRadius * 1.05).setY(0.1),
    out.clone().multiplyScalar(rimRadius * 1.3).setY(-rimHeight * 0.35),
    out.clone().multiplyScalar(rimRadius * 1.35).add(new THREE.Vector3(0, -rimHeight * 0.85, 0)).applyAxisAngle(UP, 0.25),
    out.clone().multiplyScalar(rimRadius * 1.3).add(new THREE.Vector3(0, -rimHeight * 1.3, 0)).applyAxisAngle(UP, 0.45),
  ])
  const full = path.getLength()
  const used = Math.min(len, full)
  const tEnd = used / full
  // Only the grown part of the path becomes vine.
  const nSeg = Math.max(4, Math.ceil(used / 0.05))
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= nSeg; i++) pts.push(path.getPointAt((i / nSeg) * tEnd))
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length - 1, 0.018, 5, false)
  setStripUV(tube, 0.0562, 0.28, 0.39)
  plant.add(new THREE.Mesh(tube, assets.stalkMaterial))

  // No leaves on the stretch climbing out of the soil: nodes start near the rim.
  let startLen = 0
  for (let d = 0; d < full; d += 0.01) {
    const q = path.getPointAt(d / full)
    if (Math.hypot(q.x, q.z) >= rimRadius * 0.35) { startLen = d; break }
  }
  for (let n = 0; n <= nodes; n++) {
    const s = (startLen + n * internode) / full
    if (s > tEnd) break
    const isNewest = n === nodes
    const p = path.getPointAt(s)
    const t = path.getTangentAt(s)
    // Leaf pose: on top of the pot leaves sit fairly flat, face up, tip pointing outward; on the trailing vine they
    // perk out from the pot (tips out and a little down, faces turned up and out) rather than hanging flat against it.
    const radial = new THREE.Vector3(p.x, 0, p.z)
    if (radial.lengthSq() < 1e-6) radial.copy(out)
    radial.normalize()
    const hang = THREE.MathUtils.smoothstep(-p.y, -0.02, rimHeight * 0.3)
    const alt = n % 2 === 0 ? 1 : -1
    const leafHeading = Math.atan2(radial.x, radial.z) + alt * (0.55 - 0.25 * hang) + 0.2 * jitter(n * 13 + heading * 7)
    const drop = THREE.MathUtils.lerp(-0.15, 0.45, hang) + 0.15 * jitter(n * 13 + heading * 7 + 1)
    const face = UP.clone().multiplyScalar(1 - 0.55 * hang).addScaledVector(radial, 0.25 + 0.8 * hang).normalize()
    const upPerp = UP.clone().addScaledVector(t, -UP.dot(t))
    if (upPerp.lengthSq() < 1e-4) upPerp.copy(out)
    upPerp.normalize()
    const facing = radial
    // Size by distance from the growing tip: tip leaves small, older leaves full size.
    const fromTip = nodes - n
    const sizeIdx = fromTip <= 1 ? 0 : fromTip <= 3 ? 1 : 2
    let scale = 0.85
    const vars = assets.pothosVariants?.[sizeIdx]
    let leafObj = vars ? vars[Math.floor((n * 7 + heading * 13) % vars.length + vars.length) % vars.length] : assets.pothos[sizeIdx]
    if (isNewest) {
      leafObj = assets.pothosVariants?.[0]?.[n % (assets.pothosVariants?.[0]?.length ?? 1)] ?? assets.pothos[0]
      scale = 0.35 + 0.5 * unfurl // the newest leaf is small and still opening
    }
    const leaf = orientBlade(leafObj, { heading: leafHeading, drop, face, roll: 0.15 * jitter(n * 13 + heading * 7 + 2) })
    leaf.position.copy(p)
    leaf.scale.setScalar(scale)
    plant.add(leaf)
    plant.add(petiole(leaf, leafObj, assets.stalkMaterial))
    // Aerial root nub on the underside of each older node.
    if (!isNewest && n % 2 === 1) plant.add(aerialRoot(p, facing.clone().negate(), 0.05, assets.rootMaterial))
  }
  return plant
}

/**
 * Where a pothos blade really starts (its base, in the blade's own space). The kit's pothos blades aren't seated at their
 * origin: the smaller ones sit a little way off it, as if on a petiole that isn't in the model. Measured once per blade:
 * the blade vertex nearest the origin.
 */
const bladeBase = new WeakMap<THREE.Object3D, THREE.Vector3>()
function baseOf(src: THREE.Object3D) {
  let b = bladeBase.get(src)
  if (b) return b
  src.updateMatrixWorld(true)
  const inv = src.matrixWorld.clone().invert()
  let best = Infinity
  b = new THREE.Vector3()
  const v = new THREE.Vector3()
  src.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || m.renderOrder === 1) return
    const pos = m.geometry.getAttribute('position')
    const mat = inv.clone().multiply(m.matrixWorld)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mat)
      const d = v.lengthSq()
      if (d < best) (best = d), b!.copy(v)
    }
  })
  bladeBase.set(src, b)
  return b
}
/**
 * The petiole joining a placed pothos leaf to its node: from the leaf's origin (on the vine) to where its blade starts,
 * scaled and turned with the leaf, so the leaf stays attached at any size.
 */
function petiole(leaf: THREE.Object3D, src: THREE.Object3D, mat: THREE.Material) {
  const end = baseOf(src).clone().multiplyScalar(leaf.scale.x).applyQuaternion(leaf.quaternion)
  const g = new THREE.Group()
  if (end.length() < 0.01) return g
  const start = leaf.position.clone()
  const tip = start.clone().add(end)
  const mid = start.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, end.length() * 0.18, 0)) // a gentle arch
  const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, tip]), 8, 0.012 + 0.006 * leaf.scale.x, 5, false)
  setStripUV(tube, 0.0562, 0.28, 0.39)
  g.add(new THREE.Mesh(tube, mat))
  return g
}

function positioned(obj: THREE.Object3D, at: THREE.Vector3) {
  obj.position.copy(at)
  return obj
}

/** Map a tube's UVs onto a single texel column of the kit gradient (like the kit stalks). */
function setStripUV(geo: THREE.BufferGeometry, u: number, v0: number, v1: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u, THREE.MathUtils.lerp(v0, v1, uv.getX(i)))
  uv.needsUpdate = true
}

/**
 * Pothos crown: the upright part of a potted pothos. Short shoots rise from the soil and hold leaves up and out above
 * the pot (the vines spill over from here). `age` is in the same node units as the vines; shoots appear over time.
 */
export function growPothosCrown(assets: PlantAssets, age: number, potRadius: number): THREE.Group {
  const crown = new THREE.Group()
  if (age <= 0) return crown
  const shoots = Math.min(9, Math.floor(age / 1.3) + 1)
  const golden = 2.39996
  for (let k = 0; k < shoots; k++) {
    const grown = THREE.MathUtils.clamp(age / 1.3 - k, 0, 1) // the newest shoot is still coming up
    const ang = k * golden + 0.4
    const rad = potRadius * (k === 0 ? 0.1 : 0.25 + 0.35 * ((k * 0.37) % 1))
    const base = new THREE.Vector3(Math.sin(ang) * rad, -0.03, Math.cos(ang) * rad)
    const height = (0.32 + 0.4 * ((k * 0.61) % 1)) * (0.4 + 0.6 * grown)
    const stem = buildStalk({ length: height, baseRadius: 0.016, tipRadius: 0.012, lean: 0.12 + 0.35 * (rad / potRadius), arch: 0.2, heading: ang, segments: 5, uv: POTHOS_UV })
    const mesh = new THREE.Mesh(stem.geometry, assets.stalkMaterial)
    mesh.position.copy(base)
    crown.add(mesh)
    // Two or three leaves along each shoot, alternating, held up and out.
    const leaves = 3 + (k % 2)
    for (let j = 0; j < leaves; j++) {
      const t = (j + 1) / leaves
      const pts = stem.points
      const f = t * (pts.length - 1)
      const i = Math.min(pts.length - 2, Math.floor(f))
      const at = pts[i].clone().lerp(pts[i + 1], f - i).add(base)
      const heading = ang + (j % 2 === 0 ? 1 : -1) * (0.7 + 0.3 * jitter(k * 31 + j)) + 0.3 * jitter(k * 31 + j + 9)
      const isTip = j === leaves - 1
      const size = isTip ? 1 : 2
      const pv = assets.pothosVariants?.[Math.min(assets.pothos.length - 1, size)]
      const leaf = orientBlade(pv ? pv[(k * 5 + j * 3) % pv.length] : assets.pothos[Math.min(assets.pothos.length - 1, size)], {
        heading,
        drop: isTip ? -0.55 : -0.2 + 0.2 * jitter(k * 31 + j + 3), // the youngest leaf at a shoot's tip stands up
        face: new THREE.Vector3(Math.sin(heading), 1.2, Math.cos(heading)).normalize(),
        roll: 0.2 * jitter(k * 31 + j + 5),
      })
      leaf.position.copy(at)
      leaf.scale.setScalar(1.0 * (0.5 + 0.5 * grown))
      crown.add(leaf)
      crown.add(petiole(leaf, pv ? pv[(k * 5 + j * 3) % pv.length] : assets.pothos[Math.min(assets.pothos.length - 1, size)], assets.stalkMaterial))
    }
  }
  return crown
}

// ---------------------------------------------------------------------------------------------------------------
// Rosette / clump plants: sansevieria (snake plant) and ZZ.

export type SansevieriaKind = 'common' | 'cylindrical' | 'whale' | 'classic'

export interface ClumpAssets {
  /** Kit sansevieria leaves by size: [small[], medium[], large[]] (origin at the base, growing up +Y). */
  sansevieria: THREE.Object3D[][]
  /** Kit ZZ compound leaves (stem + leaflets) by size: [small[], medium[], large[]]. */
  zz: THREE.Object3D[][]
  /** Kit texture material (for procedurally drawn leaves). */
  leafMaterial: THREE.Material
}

/** Muted sansevieria green on the kit atlas (sampled from the kit leaf's UVs; the atlas gradients run along v). */
const SANSEVIERIA_UV = { u0: 0.8, u1: 0.82, vBase: 0.66, vTip: 0.6 }
/** Deep teal-green (the kit monstera swatch) for whale fin's dark paddles. */
const WHALE_UV = { u0: 0.17, u1: 0.21, vBase: 0.43, vTip: 0.37 }

/** How rolled a leaf still is: young plants' leaves a little, the newest leaf a lot until it unfurls (quantised). */
function youngRoll(maturity: number, unfurl: number): number {
  const r = Math.min(0.9, 0.45 * Math.pow(1 - maturity, 2) + 0.85 * (1 - unfurl))
  return Math.round(r * 8) / 8
}

/** Classic snake plant: pale grey-green pillow swords with the dark zigzag cross-bands on both faces (cached). */
const SWORD_UV = { u0: 0.17, u1: 0.21, vBase: 0.36, vTip: 0.32 }
const swordLeaves = new Map<string, THREE.Object3D>()
function swordLeaf(n: number, roll: number, material: THREE.Material): THREE.Object3D {
  let leaf = swordLeaves.get(`${n}|${roll}`)
  if (!leaf) {
    // slightly channelled (edges up), stiff, a touch of twist from the variants' bend
    const geo = paddedLeaf({ length: 1, halfWidth: profiles.sword, uv: SWORD_UV, cup: 0.03, bend: 0.015 + 0.01 * n, thickness: 0.07, samples: 16, roll })
    leaf = withPattern(new THREE.Mesh(geo, material), 'trifasciata', `sword${n}r${roll}`, 'contour', true)
    swordLeaves.set(`${n}|${roll}`, leaf)
  }
  return leaf
}

/** Unit-length whale fin paddle with variegation variant `n` (cached; scaled to length when planted). */
const whaleLeaves = new Map<string, THREE.Object3D>()
function whaleLeaf(n: number, roll: number, material: THREE.Material): THREE.Object3D {
  let leaf = whaleLeaves.get(`${n}|${roll}`)
  if (!leaf) {
    leaf = withPattern(new THREE.Mesh(paddedLeaf({ length: 1, halfWidth: profiles.whaleFin, uv: WHALE_UV, cup: -0.04, bend: 0.06, roll }), material), `var:whaleFin:${n}`)
    whaleLeaves.set(`${n}|${roll}`, leaf)
  }
  return leaf
}

/** Round, tapering spear leaf (Sansevieria cylindrica), drawn as a tube with a closed point. Grows up +Y, curving toward +Z. */
function cylinderLeaf(length: number, radius: number, curve: number, material: THREE.Material): THREE.Mesh {
  const seg = 10
  const sides = 7
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= seg; i++) {
    const s = i / seg
    // centreline: a circular arc of total turn `curve`, so the leaf keeps its length as it bends outward (+Z)
    const cy = curve === 0 ? s * length : (length / curve) * Math.sin(curve * s)
    const cz = curve === 0 ? 0 : (length / curve) * (1 - Math.cos(curve * s))
    const r = radius * (s < 0.88 ? 1 - 0.25 * s : (1 - 0.25 * 0.88) * Math.sqrt(Math.max(0, 1 - ((s - 0.88) / 0.12) ** 2))) + 0.0005 // thick finger, rounded tip
    for (let j = 0; j <= sides; j++) {
      const th = (j / sides) * Math.PI * 2
      pos.push(Math.cos(th) * r, cy, cz + Math.sin(th) * r)
      uv.push(THREE.MathUtils.lerp(SANSEVIERIA_UV.u0, SANSEVIERIA_UV.u1, j / sides), THREE.MathUtils.lerp(SANSEVIERIA_UV.vBase, SANSEVIERIA_UV.vTip, s))
    }
  }
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j
      idx.push(a, a + sides + 1, a + 1, a + 1, a + sides + 1, a + sides + 2)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return new THREE.Mesh(g, material)
}

/** Place an upright leaf (origin at its base, growing +Y) at `at`, leaning `lean` toward `heading`, twisted by `twist`. */
function plantUpright(obj: THREE.Object3D, at: THREE.Vector3, heading: number, lean: number, twist: number, scale: THREE.Vector3 | number): THREE.Object3D {
  const o = obj.clone()
  o.position.copy(at)
  // twist about its own axis, then lean toward the heading
  const q = new THREE.Quaternion().setFromAxisAngle(UP, heading)
  q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), lean))
  q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, twist))
  o.quaternion.copy(q)
  if (typeof scale === 'number') o.scale.setScalar(scale)
  else o.scale.copy(scale)
  return o
}

/**
 * Sansevieria: clumps (rosettes) of upright leaves. Each clump adds leaves from its centre in a spiral; the newest stand
 * straight up, older outer ones lean out a little. After a few leaves a new offshoot clump comes up nearby.
 *  - common: kit sword leaves, ~6 per clump
 *  - whale: two or three huge broad paddles per clump (kit leaf stretched wide)
 *  - cylindrical: round spear leaves in a flat fan that arches outward
 */
export function growSansevieria(assets: ClumpAssets, kind: SansevieriaKind, age: number, potRadius: number): THREE.Group {
  const plant = new THREE.Group()
  if (age <= 0) return plant
  const per = kind === 'whale' ? 2 : kind === 'cylindrical' ? 5 : kind === 'classic' ? 6 : 7
  const total = Math.floor(age)
  const grow = age - total
  const golden = 2.39996
  for (let k = 0; k * per <= total; k++) {
    const first = k * per
    const count = Math.min(per, total - first + 1)
    const ang = k * golden + 0.9
    const rad = k === 0 ? potRadius * 0.2 : potRadius * (0.78 + 0.12 * (k % 2))
    const base = new THREE.Vector3(Math.sin(ang) * rad, -0.02, Math.cos(ang) * rad)
    const fanDir = ang + 0.4 * jitter(k * 17)
    for (let j = 0; j < count; j++) {
      const g = first + j
      const isNewest = g === total
      const up = isNewest ? 0.25 + 0.75 * grow : 1 // newest leaf is still coming up
      const ageInClump = (count - 1 - j) / Math.max(1, per - 1) // 0 = newest
      const sizeIdx = Math.min(2, Math.floor((g / 4) * 1) + (j >= 2 ? 1 : 0))
      if (kind === 'cylindrical') {
        // Fan: alternate to either side in one plane, older leaves splaying further out.
        const side = j % 2 === 0 ? 1 : -1
        const heading = fanDir + (side > 0 ? 0 : Math.PI)
        const lean = 0.06 + 0.4 * ageInClump + 0.05 * jitter(g * 5)
        const len = (0.7 + 0.5 * Math.min(1, g / 6) + 0.1 * jitter(g * 5 + 1)) * up
        const leaf = withPattern(cylinderLeaf(len, 0.05 + 0.015 * Math.min(1, g / 6), 0.15 + 0.2 * ageInClump, assets.leafMaterial), 'rings', undefined, 'planar')
        plant.add(plantUpright(leaf, base, heading, lean, 0, 1))
      } else {
        const heading = j * golden + ang + 0.3 * jitter(g * 5)
        const variants = assets.sansevieria[sizeIdx]
        const src = variants[(g + k) % variants.length]
        // newest stand straight up in the middle; older outer leaves splay out (vase shape), outer clumps lean away from the middle
        const outward = k === 0 ? 0 : 0.12
        const lean = (kind === 'whale' ? 0.05 + 0.25 * ageInClump : 0.06 + 0.36 * ageInClump) + outward + 0.06 * jitter(g * 5 + 2)
        const twist = 1.2 * jitter(g * 5 + 3)
        if (kind === 'classic') {
          // Rosettes of stiff upright swords: newest straight up in the middle, older ones splaying a little.
          const len = (1.6 + 1.1 * Math.min(1, g / 10) + 0.3 * jitter(g * 5 + 4)) * up
          plant.add(plantUpright(swordLeaf(g % 3, youngRoll(Math.min(1, g / 10), isNewest ? grow : 1), assets.leafMaterial), base, heading, lean * 0.8, twist, len))
          continue
        }
        if (kind === 'whale') {
          // Masoniana: one or two huge upright paddles per shoot, back to back in one plane and splaying apart (so they
          // never cut through each other), each from its own spot at the base. Tall: a couple of times the pot height.
          const side = j % 2 === 0 ? 1 : -1
          const h = fanDir + (side > 0 ? 0 : Math.PI) + 0.2 * jitter(g * 5 + 6)
          const len = (2.3 + 0.9 * Math.min(1, g / 4) + 0.2 * jitter(g * 5 + 4)) * up
          const at = base.clone().add(new THREE.Vector3(Math.sin(h), 0, Math.cos(h)).multiplyScalar(0.05))
          plant.add(plantUpright(whaleLeaf(g % 12, youngRoll(Math.min(1, g / 4), isNewest ? grow : 1), assets.leafMaterial), at, h, 0.2 + 0.12 * ageInClump + outward * 0.6 + 0.04 * jitter(g * 5 + 2), 0.15 * jitter(g * 5 + 3), len))
          continue
        }
        const sc = new THREE.Vector3(0.82, up * (1.25 + 0.2 * jitter(g * 5 + 4)), 0.82) // taller, slimmer swords
        plant.add(plantUpright(src, base, heading, lean, twist, sc))
      }
    }
  }
  return plant
}

/**
 * ZZ plant: many compound-leaf stems (kit ZZ leaves) rising from the soil in a vase shape. New stems come up from the
 * soil near the middle and unfurl; stems get taller as the plant matures; older outer stems lean out more.
 */
const ravenCache = new WeakMap<THREE.Object3D, THREE.Object3D>()
/** ZZ 'Raven': the same leaves, a glossy near-black purple-green (new growth comes up lime first in life; kept simple). */
function raven(src: THREE.Object3D) {
  let r = ravenCache.get(src)
  if (!r) {
    r = src.clone(true)
    r.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!m) return
      const d = m.clone()
      d.color = new THREE.Color('#5d6a5c')
      d.roughness = 0.3
      ;(o as THREE.Mesh).material = d
    })
    ravenCache.set(src, r)
  }
  return r
}
export function growZZ(assets: ClumpAssets, age: number, potRadius: number, variegated: boolean | 'raven' = false): THREE.Group {
  const plant = new THREE.Group()
  if (age <= 0) return plant
  const total = Math.floor(age)
  const grow = age - total
  const golden = 2.39996
  for (let g = 0; g <= total; g++) {
    const isNewest = g === total
    const up = isNewest ? 0.3 + 0.7 * grow : 1
    const ang = g * golden + 0.2
    const rad = potRadius * Math.min(0.85, 0.18 + 0.12 * Math.sqrt(g) * 1.6) * (0.65 + 0.35 * ((g * 0.37) % 1))
    const base = new THREE.Vector3(Math.sin(ang) * rad, -0.02, Math.cos(ang) * rad)
    const relAge = (total - g) / Math.max(1, total) // older stems = bigger lean
    const sizeIdx = g < 2 ? 0 : g < 5 ? 1 : 2
    const variants = assets.zz[sizeIdx]
    const plain = variants[g % variants.length]
    // ZZ 'Variegata': leaflets are small, so freckles and daubs are drawn bigger (scale 1.4)
    const src = variegated === 'raven' ? raven(plain) : variegated ? withPattern(plain, `var:zzVariegata:${g % 12}:1.4`, `zz${sizeIdx}${g % variants.length}`, 'planar') : plain
    const lean = 0.12 + 0.45 * relAge + 0.25 * (rad / potRadius) + 0.06 * jitter(g * 11)
    plant.add(plantUpright(src, base, ang, lean, 1.5 * jitter(g * 11 + 1), new THREE.Vector3(1, up, 1).multiplyScalar(0.9 + 0.15 * jitter(g * 11 + 2))))
  }
  return plant
}
