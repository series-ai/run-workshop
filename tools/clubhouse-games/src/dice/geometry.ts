import * as THREE from 'three'
import { DIE_FACES } from './pipFaces'
import { DieKind } from './kinds'

export interface DieFaceGeom {
  normal: THREE.Vector3
  centroid: THREE.Vector3
  value: number
}

function pushTri(
  positions: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
}

// Pentagonal trapezohedron (standard d10), y-up. Two staggered pentagon
// rings plus poles; each kite is two triangles.
export function createD10Geometry(radius: number): THREE.BufferGeometry {
  const poles = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]
  const ring: THREE.Vector3[] = []
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10
    const y = i % 2 === 0 ? 0.105 : -0.105
    ring.push(new THREE.Vector3(Math.cos(a), y, Math.sin(a)))
  }
  const positions: number[] = []
  for (let i = 0; i < 10; i++) {
    const curr = ring[i]
    const next = ring[(i + 1) % 10]
    pushTri(positions, poles[0], curr, next)
    pushTri(positions, poles[1], next, curr)
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.computeVertexNormals()
  geom.scale(radius, radius, radius)
  return geom
}

export function dieGeometry(kind: DieKind, radius: number): THREE.BufferGeometry {
  switch (kind) {
    case 4: return new THREE.TetrahedronGeometry(radius)
    case 6: return new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2)
    case 8: return new THREE.OctahedronGeometry(radius)
    case 10: return createD10Geometry(radius)
    case 12: return new THREE.DodecahedronGeometry(radius)
    case 20: return new THREE.IcosahedronGeometry(radius)
  }
}

export function extractFaceClusters(geom: THREE.BufferGeometry): Omit<DieFaceGeom, 'value'>[] {
  const pos = geom.getAttribute('position')
  const idx = geom.getIndex()
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const ab = new THREE.Vector3()
  const ac = new THREE.Vector3()
  const triangles: Omit<DieFaceGeom, 'value'>[] = []
  for (let i = 0; i < triCount; i++) {
    const ia = idx ? idx.getX(i * 3) : i * 3
    const ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1
    const ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2
    a.fromBufferAttribute(pos, ia)
    b.fromBufferAttribute(pos, ib)
    c.fromBufferAttribute(pos, ic)
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const normal = new THREE.Vector3().crossVectors(ab, ac).normalize()
    const centroid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3)
    triangles.push({ normal, centroid })
  }

  const used = new Array(triangles.length).fill(false)
  const clusters: Omit<DieFaceGeom, 'value'>[] = []
  for (let i = 0; i < triangles.length; i++) {
    if (used[i]) continue
    const n = triangles[i].normal.clone()
    const centroid = triangles[i].centroid.clone()
    let count = 1
    used[i] = true
    for (let j = i + 1; j < triangles.length; j++) {
      if (used[j]) continue
      if (triangles[i].normal.dot(triangles[j].normal) > 0.92) {
        n.add(triangles[j].normal)
        centroid.add(triangles[j].centroid)
        count += 1
        used[j] = true
      }
    }
    n.normalize()
    centroid.multiplyScalar(1 / count)
    clusters.push({ normal: n, centroid })
  }
  return clusters
}

function assignValues(kind: DieKind, faces: Omit<DieFaceGeom, 'value'>[]): DieFaceGeom[] {
  if (kind === 6) {
    return faces.map((f) => {
      const ax = Math.abs(f.normal.x)
      const ay = Math.abs(f.normal.y)
      const az = Math.abs(f.normal.z)
      let value = DIE_FACES.py
      if (ax >= ay && ax >= az) value = f.normal.x >= 0 ? DIE_FACES.px : DIE_FACES.nx
      else if (ay >= ax && ay >= az) value = f.normal.y >= 0 ? DIE_FACES.py : DIE_FACES.ny
      else value = f.normal.z >= 0 ? DIE_FACES.pz : DIE_FACES.nz
      return { ...f, value }
    })
  }

  if (kind === 4 || faces.length % 2 !== 0) {
    return faces.map((f, i) => ({ ...f, value: i + 1 }))
  }

  const unused = faces.map((_, i) => i)
  const out: DieFaceGeom[] = new Array(faces.length)
  let low = 1
  const n = faces.length
  while (unused.length >= 2) {
    const ai = unused.pop()!
    let bestK = 0
    let bestDot = 2
    for (let k = 0; k < unused.length; k++) {
      const d = faces[ai].normal.dot(faces[unused[k]].normal)
      if (d < bestDot) {
        bestDot = d
        bestK = k
      }
    }
    const bi = unused.splice(bestK, 1)[0]
    out[ai] = { ...faces[ai], value: low }
    out[bi] = { ...faces[bi], value: n + 1 - low }
    low += 1
  }
  if (unused.length === 1) {
    out[unused[0]] = { ...faces[unused[0]], value: low }
  }
  return out
}

const faceCache = new Map<DieKind, DieFaceGeom[]>()

export function facesForDie(kind: DieKind, radius = 1): DieFaceGeom[] {
  let unit = faceCache.get(kind)
  if (!unit) {
    const geom = dieGeometry(kind, 1)
    const clusters = extractFaceClusters(geom)
    if (clusters.length !== kind) {
      throw new Error(`d${kind} geometry produced ${clusters.length} faces, expected ${kind}`)
    }
    unit = assignValues(kind, clusters)
    faceCache.set(kind, unit)
    geom.dispose()
  }
  if (radius === 1) return unit
  return unit.map((f) => ({
    normal: f.normal.clone(),
    centroid: f.centroid.clone().multiplyScalar(radius),
    value: f.value,
  }))
}

const vertexCache = new Map<DieKind, THREE.Vector3[]>()

// Corner points of the solid, used as the contact set for the toss physics.
export function dieVertices(kind: DieKind, radius = 1): THREE.Vector3[] {
  let unit = vertexCache.get(kind)
  if (!unit) {
    const geom = dieGeometry(kind, 1)
    const pos = geom.getAttribute('position')
    const seen: THREE.Vector3[] = []
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i)
      if (!seen.some((s) => s.distanceToSquared(v) < 1e-8)) seen.push(v)
    }
    if (seen.length === 0) throw new Error(`d${kind} geometry produced no vertices`)
    unit = seen
    vertexCache.set(kind, unit)
    geom.dispose()
  }
  return unit.map((v) => v.clone().multiplyScalar(radius))
}

// Distance from the center to a face, which is how high the center sits when
// the die lies flat. A cube gives back its half-size; a d20 sits much lower
// than its circumradius.
export function dieRestHeight(kind: DieKind, radius = 1): number {
  const faces = facesForDie(kind, 1)
  let min = Infinity
  for (const f of faces) {
    const d = Math.abs(f.centroid.dot(f.normal))
    if (d < min) min = d
  }
  return min * radius
}

// Scalar moment of inertia for a unit-mass solid. A cube of half-size a is
// exactly (2/3)a²; the rounder solids are close to a sphere's (2/5)r².
export function dieInertia(kind: DieKind, radius: number): number {
  return (kind === 6 ? 2 / 3 : 0.4) * radius * radius
}
