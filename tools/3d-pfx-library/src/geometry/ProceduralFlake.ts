import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Sphere,
  Vector3,
} from 'three'

/**
 * Deterministic knapped obsidian / void flake geometry generator.
 * Adapted from Chiro's VoidSlash ability (MIT License).
 *
 * Each flake is an irregular polygon in the XZ plane with off-center apexes
 * on both sides to form an asymmetric, non-indexed faceted crystal flake.
 * Non-indexed triangles carry crisp face normals and barycentric coordinates
 * for sharp facet rendering and hairline edge highlights without texture overhead.
 */

const HUGE_BOUNDS = /* @__PURE__ */ new Sphere(new Vector3(), 1e4)
const _e1 = /* @__PURE__ */ new Vector3()
const _e2 = /* @__PURE__ */ new Vector3()
const _n = /* @__PURE__ */ new Vector3()

const BARY: readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

export interface ProceduralFlakeOptions {
  readonly sides?: number
  readonly nose?: number
  readonly thick?: number
  readonly jitter?: number
  readonly seed?: number
  readonly capacity?: number
  readonly indexOffset?: number
}

function hash11(p: number): number {
  const fract = (Math.sin(p * 12.9898) * 43758.5453123) % 1
  return fract < 0 ? fract + 1 : fract
}

export function createVoidFlakeGeometry({
  sides = 6,
  nose = 1.3,
  thick = 0.14,
  jitter = 0.35,
  seed = 5,
  capacity = 256,
  indexOffset = 0,
}: ProceduralFlakeOptions = {}): InstancedBufferGeometry {
  const n = Math.max(3, Math.round(sides))
  const count = Math.max(1, Math.round(capacity))

  const ring: Vector3[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 1 + (hash11(seed * 13.7 + i * 2.3) - 0.5) * 2 * jitter
    const stretch = i === 0 ? nose : 1
    ring.push(new Vector3(Math.cos(a) * r * stretch, 0, Math.sin(a) * r))
  }

  const ax = (hash11(seed * 3.1 + 0.7) - 0.5) * 0.7
  const az = (hash11(seed * 5.3 + 1.9) - 0.5) * 0.5
  const apexTop = new Vector3(ax, thick, az)
  const apexBottom = new Vector3(-ax * 0.6, -thick * 0.7, -az * 0.6)

  const triangles = n * 2
  const positions = new Float32Array(triangles * 3 * 3)
  const normals = new Float32Array(triangles * 3 * 3)
  const barys = new Float32Array(triangles * 3 * 3)

  let p = 0

  const pushTriangle = (a: Vector3, b: Vector3, c: Vector3) => {
    _e1.subVectors(b, a)
    _e2.subVectors(c, a)
    _n.crossVectors(_e1, _e2).normalize()
    const tri = [a, b, c] as const
    for (let v = 0; v < 3; v++) {
      positions[p + 0] = tri[v].x
      positions[p + 1] = tri[v].y
      positions[p + 2] = tri[v].z
      normals[p + 0] = _n.x
      normals[p + 1] = _n.y
      normals[p + 2] = _n.z
      barys[p + 0] = BARY[v][0]
      barys[p + 1] = BARY[v][1]
      barys[p + 2] = BARY[v][2]
      p += 3
    }
  }

  for (let i = 0; i < n; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    pushTriangle(a, apexTop, b)
    pushTriangle(b, apexBottom, a)
  }

  const flakeIndex = new Float32Array(count)
  for (let i = 0; i < count; i++) flakeIndex[i] = i + indexOffset

  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('aBary', new BufferAttribute(barys, 3))
  geometry.setAttribute('aFlake', new InstancedBufferAttribute(flakeIndex, 1))
  geometry.instanceCount = count
  geometry.boundingSphere = HUGE_BOUNDS
  return geometry
}
