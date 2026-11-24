import * as THREE from 'three'

/**
 * Procedural leaf stalks (petioles).
 *
 * Blades are exported without stalks: each blade's origin is its attach point, the stalk direction at the
 * tip is the blade's local +Y, and the blade hangs out toward local +Z. A stalk is a tapered tube along a
 * curve that lives in one vertical plane: it leaves the soil at `lean` from vertical and turns by `arch`
 * along its length, so long stalks can hook over the way the Tiny Treats monstera stalks do.
 */

/** Where the stalk's colour comes from on the shared kit texture (glTF UV space). */
export interface StalkUV {
  u: number
  vBase: number
  vTip: number
}

/** UV strip of the Tiny Treats monstera stalk (measured from the kit model). */
export const KIT_STALK_UV: StalkUV = { u: 0.16209, vBase: 0.44614, vTip: 0.33626 }

export interface StalkOptions {
  /** Length along the curve. */
  length: number
  /** Radius at the soil. Defaults to 3% of the length, clamped to a sensible range. */
  baseRadius?: number
  /** Radius where the blade attaches. Defaults to 75% of the base radius. */
  tipRadius?: number
  /** Angle from vertical where the stalk leaves the soil, in radians. */
  lean?: number
  /** Extra angle the stalk turns by its tip, in radians (positive arches outward and over). */
  arch?: number
  /** How late along the stalk the arch happens: 1 is even, higher bends mostly near the tip. */
  archPower?: number
  /** Direction the stalk leans toward, in radians around +Y (0 points along +Z). */
  heading?: number
  /** Tube sides (6 matches the kit's low-poly look). */
  sides?: number
  /** Segments along the length. */
  segments?: number
  uv?: StalkUV
}

export interface Stalk {
  geometry: THREE.BufferGeometry
  /** Where the blade's origin goes. */
  tipPosition: THREE.Vector3
  /** Orientation for the blade: blade +Y along the stalk tip, blade +Z toward the outside of the arch. */
  tipQuaternion: THREE.Quaternion
  /** Centreline points, base to tip (handy for debugging or sway). */
  points: THREE.Vector3[]
}

const UP = new THREE.Vector3(0, 1, 0)

export function buildStalk(options: StalkOptions): Stalk {
  const length = options.length
  const baseRadius = options.baseRadius ?? THREE.MathUtils.clamp(length * 0.03, 0.012, 0.06)
  const tipRadius = options.tipRadius ?? baseRadius * 0.75
  const lean = options.lean ?? 0.15
  const arch = options.arch ?? 0.9
  const archPower = options.archPower ?? 1.8
  const heading = options.heading ?? 0
  const sides = Math.max(3, options.sides ?? 6)
  const segments = Math.max(2, options.segments ?? 10)
  const uv = options.uv ?? KIT_STALK_UV

  // Plane of the curve: `out` is the horizontal lean direction, `side` is perpendicular to the plane.
  const out = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading))
  const side = new THREE.Vector3().crossVectors(out, UP).normalize()

  const angleAt = (s: number) => lean + arch * Math.pow(s, archPower)
  const tangentAt = (a: number) => out.clone().multiplyScalar(Math.sin(a)).addScaledVector(UP, Math.cos(a))

  // Centreline: integrate the angle profile (midpoint rule keeps the length exact for any segment count).
  const points: THREE.Vector3[] = [new THREE.Vector3()]
  const step = length / segments
  for (let i = 1; i <= segments; i++) {
    const a = angleAt((i - 0.5) / segments)
    points.push(points[i - 1].clone().addScaledVector(tangentAt(a), step))
  }

  const ringVerts = sides + 1 // duplicate seam column so the UVs don't wrap
  const positions = new Float32Array((segments + 1) * ringVerts * 3)
  const normals = new Float32Array((segments + 1) * ringVerts * 3)
  const uvs = new Float32Array((segments + 1) * ringVerts * 2)
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (let i = 0; i <= segments; i++) {
    const s = i / segments
    const t = tangentAt(angleAt(s))
    const inPlane = new THREE.Vector3().crossVectors(side, t).normalize() // perpendicular to t, inside the plane
    const r = THREE.MathUtils.lerp(baseRadius, tipRadius, s)
    for (let j = 0; j < ringVerts; j++) {
      const th = (j / sides) * Math.PI * 2
      n.copy(inPlane).multiplyScalar(Math.cos(th)).addScaledVector(side, Math.sin(th))
      p.copy(points[i]).addScaledVector(n, r)
      const k = i * ringVerts + j
      positions.set([p.x, p.y, p.z], k * 3)
      normals.set([n.x, n.y, n.z], k * 3)
      uvs.set([uv.u, THREE.MathUtils.lerp(uv.vBase, uv.vTip, s)], k * 2)
    }
  }

  const indices: number[] = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * ringVerts + j
      const b = a + 1
      const c = a + ringVerts
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  // Blade frame at the tip (same definition the blade exporter measured on the kit leaves):
  //   +Y = stalk tangent at the tip, +Z = outside of the arch = (tip - base) with the tangent component removed.
  // On the kit, blades hang down from the tip along that outside, so this reproduces the kit's droop.
  const tipTangent = tangentAt(angleAt(1))
  const chord = points[segments].clone().sub(points[0])
  const hang = chord.addScaledVector(tipTangent, -chord.dot(tipTangent))
  if (hang.lengthSq() < 1e-8) hang.copy(out).addScaledVector(tipTangent, -out.dot(tipTangent))
  hang.normalize()
  const xAxis = new THREE.Vector3().crossVectors(tipTangent, hang).normalize()
  const tipQuaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, tipTangent, hang))

  return { geometry, tipPosition: points[segments].clone(), tipQuaternion, points }
}

/**
 * A stalk with a blade mounted on its tip. Stalk length and blade size are independent, so any blade can sit on
 * any stalk: grow the stalk and swap or scale the blade separately as the leaf matures.
 */
export function createLeaf(blade: THREE.Object3D, stalkOptions: StalkOptions, stalkMaterial: THREE.Material, bladeScale = 1, bladePitch = 0): THREE.Group {
  const group = new THREE.Group()
  const stalk = buildStalk(stalkOptions)
  group.add(new THREE.Mesh(stalk.geometry, stalkMaterial))
  const mounted = blade.clone()
  mounted.position.copy(stalk.tipPosition)
  // bladePitch rotates the blade about the attach hinge (blade local X): negative tips the leaf forward (blade held out, face up).
  mounted.quaternion.copy(stalk.tipQuaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), bladePitch))
  mounted.scale.setScalar(bladeScale)
  group.add(mounted)
  return group
}

/** Midrib direction (attach point -> leaf tip) and upper-face normal of a blade, in the blade's own space. */
interface BladeAxes {
  midrib: THREE.Vector3
  normal: THREE.Vector3
}

const axesCache = new WeakMap<THREE.Object3D, BladeAxes>()

/** Measure a blade once: tip = farthest vertex from the attach point; the upper face is the side the midrib domes toward. */
export function bladeAxes(blade: THREE.Object3D): BladeAxes {
  const cached = axesCache.get(blade)
  if (cached) return cached
  blade.updateMatrixWorld(true)
  const inv = blade.matrixWorld.clone().invert()
  const pts: THREE.Vector3[] = []
  blade.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    const m = inv.clone().multiply(mesh.matrixWorld)
    for (let i = 0; i < pos.count; i += 1) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m))
  })
  // tip = far from both the leaf's centre and the attach point (a heart's basal lobe can be farther from the attach
  // point than its tip, so distance from the attach point alone isn't enough)
  const centre = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length)
  const score = (p: THREE.Vector3) => p.distanceTo(centre) + 0.6 * p.length()
  const tip = pts.reduce((a, b) => (score(b) > score(a) ? b : a))
  const midrib = tip.clone().normalize()
  const perp = (p: THREE.Vector3) => p.clone().addScaledVector(midrib, -p.dot(midrib))
  const widest = pts.reduce((a, b) => (perp(b).lengthSq() > perp(a).lengthSq() ? b : a))
  const across = perp(widest).normalize()
  const normal = new THREE.Vector3().crossVectors(midrib, across).normalize()
  // Leaf edges droop below the midrib: points near the midrib sit on the upper side of points out at the edges.
  const maxW = perp(widest).length()
  let mid = 0
  let midN = 0
  let edge = 0
  let edgeN = 0
  for (const p of pts) {
    const w = perp(p).length() / maxW
    const h = p.dot(normal)
    if (w < 0.25) (mid += h), midN++
    else if (w > 0.7) (edge += h), edgeN++
  }
  if (midN && edgeN && mid / midN < edge / edgeN) normal.negate()
  const axes = { midrib, normal }
  axesCache.set(blade, axes)
  return axes
}

export interface NaturalMount {
  /** Horizontal direction the leaf faces out toward (radians around +Y; 0 = +Z). */
  heading: number
  /** How far the midrib points below horizontal, in radians (negative holds the tip up). */
  drop: number
  /** Twist around the midrib, in radians. */
  roll?: number
  /** Preferred direction for the leaf's upper face (default: up). Hanging leaves face outward instead. */
  face?: THREE.Vector3
}

/** Clone a blade and orient it: midrib along `heading` dropped by `drop`, upper face toward `face` (default up). */
export function orientBlade(blade: THREE.Object3D, mount: NaturalMount): THREE.Object3D {
  const { midrib, normal } = bladeAxes(blade)
  const out = new THREE.Vector3(Math.sin(mount.heading), 0, Math.cos(mount.heading))
  const mW = out.clone().multiplyScalar(Math.cos(mount.drop)).addScaledVector(UP, -Math.sin(mount.drop)).normalize()
  const pref = (mount.face ?? UP).clone()
  let nW = pref.addScaledVector(mW, -pref.dot(mW))
  if (nW.lengthSq() < 1e-6) nW = out.clone().addScaledVector(mW, -out.dot(mW))
  nW.normalize().applyAxisAngle(mW, mount.roll ?? 0)
  const local = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(midrib, normal).normalize(), midrib, normal)
  const world = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(mW, nW).normalize(), mW, nW)
  const mounted = blade.clone()
  mounted.quaternion.setFromRotationMatrix(world.multiply(local.transpose()))
  return mounted
}

/**
 * A stalk with the blade mounted the way real aroid leaves hang: the blade bends at a "knee" on top of the stalk,
 * its midrib points outward (heading) and droops by `drop`, and the upper face looks up. Independent of the stalk curve.
 */
export function createNaturalLeaf(blade: THREE.Object3D, stalkOptions: StalkOptions, mount: NaturalMount, stalkMaterial: THREE.Material, bladeScale = 1): THREE.Group {
  const group = new THREE.Group()
  const stalk = buildStalk(stalkOptions)
  group.add(new THREE.Mesh(stalk.geometry, stalkMaterial))
  const mounted = orientBlade(blade, mount)
  mounted.position.copy(stalk.tipPosition)
  mounted.scale.setScalar(bladeScale)
  group.add(mounted)
  return group
}
