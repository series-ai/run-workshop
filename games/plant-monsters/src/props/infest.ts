import * as THREE from 'three'
import { pest, type PestKind } from './props'

/**
 * Pests on a plant: a few bugs of one kind sitting on the tops of the leaves. Each bug is parented to the leaf mesh it
 * sits on, so it rides along when the leaves waggle. Plants get one kind at a time; how many is usually 1–3, sometimes
 * none, at most 5.
 */

export const PEST_KINDS: [PestKind, string][] = [
  ['aphid', 'aphids'], ['mite', 'spider mites'], ['mealybug', 'mealybugs'], ['gnat', 'fungus gnats'],
  ['scale', 'scale'], ['thrips', 'thrips'], ['whitefly', 'whiteflies'],
]
export const MAX_PESTS = 5

function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** How many bugs a plant has, picked the way the game would: mostly 1–3, sometimes none, rarely 4 or 5. */
export function rollPestCount(seed: number) {
  const r = rng(seed * 7919 + 13)()
  const weights = [0.15, 0.3, 0.25, 0.18, 0.08, 0.04]
  let acc = 0
  for (let n = 0; n < weights.length; n++) if (r < (acc += weights[n])) return n
  return 1
}

interface Spot { mesh: THREE.Mesh; p: THREE.Vector3; n: THREE.Vector3; world: THREE.Vector3 }

/** Upward-facing triangles on the plant's leaves (world normal mostly up), area-weighted, as candidate perches. */
function leafSpots(plant: THREE.Object3D, minUp: number) {
  plant.updateMatrixWorld(true)
  const tris: { mesh: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; n: THREE.Vector3; area: number }[] = []
  const nm = new THREE.Matrix3()
  plant.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.pest) return
    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!pos) return
    const idx = mesh.geometry.getIndex()
    const count = idx ? idx.count : pos.count
    nm.getNormalMatrix(mesh.matrixWorld)
    const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i)
    for (let i = 0; i + 2 < count; i += 3) {
      const a = v(i), b = v(i + 1), c = v(i + 2)
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
      const area = n.length() / 2
      if (area < 1e-9) continue
      n.normalize()
      const wn = n.clone().applyMatrix3(nm).normalize()
      if (wn.y < 0) (n.negate(), wn.negate()) // leaves are double-sided: perch on whichever face is on top
      if (wn.y < minUp) continue // stalks, edges, steep leaves
      const wa = a.clone().applyMatrix4(mesh.matrixWorld), wb = b.clone().applyMatrix4(mesh.matrixWorld), wc = c.clone().applyMatrix4(mesh.matrixWorld)
      const warea = new THREE.Vector3().subVectors(wb, wa).cross(new THREE.Vector3().subVectors(wc, wa)).length() / 2
      tris.push({ mesh, a, b, c, n, area: warea })
    }
  })
  return tris
}

/**
 * Put `count` bugs of `kind` on `plant`'s leaves (replacing any already there). `size` is a bug's length in world
 * units. Spots are spread out so they don't pile up.
 */
export function infest(plant: THREE.Object3D, kind: PestKind | null, count: number, seed = 1, size = 0.09) {
  clearPests(plant)
  if (!kind || count <= 0) return [] as THREE.Object3D[]
  // flattest leaf tops first; upright plants (snake plant) fall back to steeper faces
  let tris = leafSpots(plant, 0.45)
  if (tris.length < 20) tris = leafSpots(plant, 0.15)
  if (!tris.length) return []
  // not down in the crown, where they'd be buried among the stems
  const bb = new THREE.Box3()
  plant.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.pest) bb.expandByObject(o, true)
  })
  const floor = bb.min.y + (bb.max.y - bb.min.y) * 0.25
  const high = tris.filter((t) => new THREE.Vector3().add(t.a).add(t.b).add(t.c).multiplyScalar(1 / 3).applyMatrix4(t.mesh.matrixWorld).y > floor)
  if (high.length > 10) tris = high
  const total = tris.reduce((s, t) => s + t.area, 0)
  const rand = rng(seed)
  const spots: Spot[] = []
  const minGap = size * 2.2
  for (let tries = 0; spots.length < Math.min(count, MAX_PESTS) && tries < 400; tries++) {
    let r = rand() * total
    const t = tris.find((x) => (r -= x.area) <= 0) ?? tris[tris.length - 1]
    let u = rand(), w = rand()
    if (u + w > 1) (u = 1 - u), (w = 1 - w)
    const p = t.a.clone().multiplyScalar(1 - u - w).addScaledVector(t.b, u).addScaledVector(t.c, w)
    const world = p.clone().applyMatrix4(t.mesh.matrixWorld)
    if (spots.some((s) => s.world.distanceTo(world) < minGap)) continue
    spots.push({ mesh: t.mesh, p, n: t.n, world })
  }
  const out: THREE.Object3D[] = []
  for (const s of spots) {
    const bug = pest(kind)
    const len = new THREE.Box3().setFromObject(bug).getSize(new THREE.Vector3())
    const k = size / Math.max(len.x, len.z, 1e-3)
    const ws = new THREE.Vector3()
    s.mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws)
    bug.scale.set(k / ws.x, k / ws.y, k / ws.z)
    bug.position.copy(s.p)
    bug.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), s.n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2))
    bug.userData.pest = kind
    bug.traverse((o) => ((o.userData.pest = kind), (o.castShadow = true)))
    s.mesh.add(bug)
    out.push(bug)
  }
  return out
}

export function clearPests(plant: THREE.Object3D) {
  const bugs: THREE.Object3D[] = []
  plant.traverse((o) => {
    if (o.userData.pest && !o.parent?.userData.pest) bugs.push(o)
  })
  for (const b of bugs) b.removeFromParent()
}
