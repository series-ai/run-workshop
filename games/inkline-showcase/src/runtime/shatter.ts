import * as THREE from 'three'
import { architecturalMaterial, figureMaterial } from './assets'
import { THREAT } from './palette'

interface Shard {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  rotSpeed: THREE.Vector3
  life: number
  maxLife: number
  initialScale: number
  /** Height of the support surface under the burst. */
  floor: number
  /** Body pieces own their geometry; crystal sparks share it. */
  ownsGeometry: boolean
}

/** One piece of a broken figure: its triangles (world space, centred on `center`) and its centre. */
export interface FigurePiece { center: THREE.Vector3; positions: Float32Array }

/**
 * Group world-space triangles into pieces by the grid cell of each triangle's centroid.
 * A cell near the limb width cuts each limb into short segments and the head into a few caps.
 */
export function chunkTriangles(input: Float32Array, cell: number): FigurePiece[] {
  if (input.length % 9 !== 0) throw new Error('Triangle data must hold three xyz vertices per triangle.')
  if (!(cell > 0)) throw new Error('Piece cell size must be positive.')
  // Cut long triangles at the midpoint of their longest edge until every edge fits a cell, so a limb
  // tube breaks into short solid segments instead of long spinning slivers.
  const cut: number[] = []
  const stack: number[][] = []
  for (let t = 0; t < input.length; t += 9) stack.push(Array.from(input.subarray(t, t + 9)))
  while (stack.length) {
    const v = stack.pop()!
    const edge = (i: number, j: number) => Math.hypot(v[i] - v[j], v[i + 1] - v[j + 1], v[i + 2] - v[j + 2])
    const lengths = [edge(0, 3), edge(3, 6), edge(6, 0)]
    const longest = lengths.indexOf(Math.max(...lengths))
    if (lengths[longest] <= cell) { cut.push(...v); continue }
    const a = longest * 3, b = ((longest + 1) % 3) * 3, c = ((longest + 2) % 3) * 3
    const m = [(v[a] + v[b]) / 2, (v[a + 1] + v[b + 1]) / 2, (v[a + 2] + v[b + 2]) / 2]
    const p = (i: number) => [v[i], v[i + 1], v[i + 2]]
    stack.push([...p(a), ...m, ...p(c)], [...m, ...p(b), ...p(c)])
  }
  const triangles = new Float32Array(cut)
  const buckets = new Map<string, number[]>()
  for (let t = 0; t < triangles.length; t += 9) {
    const cx = (triangles[t] + triangles[t + 3] + triangles[t + 6]) / 3
    const cy = (triangles[t + 1] + triangles[t + 4] + triangles[t + 7]) / 3
    const cz = (triangles[t + 2] + triangles[t + 5] + triangles[t + 8]) / 3
    const key = `${Math.floor(cx / cell)},${Math.floor(cy / cell)},${Math.floor(cz / cell)}`
    let bucket = buckets.get(key)
    if (!bucket) buckets.set(key, bucket = [])
    for (let i = 0; i < 9; i++) bucket.push(triangles[t + i])
  }
  return [...buckets.values()].map(values => {
    const center = new THREE.Vector3()
    for (let i = 0; i < values.length; i += 3) center.x += values[i], center.y += values[i + 1], center.z += values[i + 2]
    center.divideScalar(values.length / 3)
    const positions = new Float32Array(values.length)
    for (let i = 0; i < values.length; i += 3) {
      positions[i] = values[i] - center.x; positions[i + 1] = values[i + 1] - center.y; positions[i + 2] = values[i + 2] - center.z
    }
    return { center, positions }
  })
}

/** Posed (skinned) triangles of every figure skin under `root`, in world space. */
function figureTriangles(root: THREE.Object3D): Float32Array {
  root.updateMatrixWorld(true)
  const out: number[] = []
  const vertex = new THREE.Vector3()
  root.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh) || object.userData.inkContour) return
    const index = object.geometry.index
    const count = index ? index.count : object.geometry.getAttribute('position').count
    for (let i = 0; i < count; i++) {
      object.getVertexPosition(index ? index.getX(i) : i, vertex)
      vertex.applyMatrix4(object.matrixWorld)
      out.push(vertex.x, vertex.y, vertex.z)
    }
  })
  if (!out.length) throw new Error('The figure has no skinned surface to shatter.')
  return new Float32Array(out)
}

/** Threat reds only. Faceted key-light shading makes each spark read as a cut crystal. */
const RUBY_COLORS = ['#ff2212', '#fa1a0a', '#8a0c14', '#b8141f', '#ff6a4d']
const PIECE_CELL = .11

export class CrystalShatterSystem {
  readonly group = new THREE.Group()
  private shards: Shard[] = []
  private readonly sparkGeometries: THREE.BufferGeometry[]
  private readonly sparkMaterials: THREE.Material[]
  /** The threat's own cel material, double-sided so the open cuts of a piece stay solid. */
  private readonly pieceMaterial = figureMaterial('threat', THREAT)

  constructor() {
    this.group.name = 'crystal-shatters'
    this.pieceMaterial.side = THREE.DoubleSide
    this.sparkGeometries = [new THREE.TetrahedronGeometry(.07), new THREE.OctahedronGeometry(.06), new THREE.TetrahedronGeometry(.045)]
    this.sparkMaterials = RUBY_COLORS.map(color => architecturalMaterial(new THREE.Color(color), THREE.DoubleSide))
  }

  /**
   * Break a posed figure into pieces of its own surface. Pieces fly along `impulse` and out from the body
   * centre, spin, bounce on `floor`, and shrink away. Small crystal sparks start on the pieces.
   * Hide the source figure after this call. Returns the piece count.
   */
  shatterFigure(figure: THREE.Object3D, impulse: THREE.Vector3, floor: number, sparks = 14): number {
    const force = impulse.clone().normalize()
    if (force.lengthSq() < .01) force.set(0, 0, -1)
    const pieces = chunkTriangles(figureTriangles(figure), PIECE_CELL)
    const body = pieces.reduce((sum, piece) => sum.add(piece.center), new THREE.Vector3()).divideScalar(pieces.length)
    for (const piece of pieces) {
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(piece.positions, 3))
      geometry.computeVertexNormals()
      const mesh = new THREE.Mesh(geometry, this.pieceMaterial)
      mesh.position.copy(piece.center)
      const outward = piece.center.clone().sub(body).normalize()
      const velocity = force.clone().multiplyScalar(1.6 + Math.random() * 2.2)
        .addScaledVector(outward, .6 + Math.random() * 1.4)
        .add(new THREE.Vector3((Math.random() - .5) * .8, .6 + Math.random() * 1.6, (Math.random() - .5) * .8))
      this.push(mesh, velocity, 10, 1.3 + Math.random() * .6, 1, floor, true)
    }
    for (let i = 0; i < sparks; i++) {
      const from = pieces[Math.floor(Math.random() * pieces.length)].center
      const mesh = new THREE.Mesh(this.sparkGeometries[i % this.sparkGeometries.length], this.sparkMaterials[i % this.sparkMaterials.length])
      mesh.position.copy(from)
      const scale = .6 + Math.random() * .7
      mesh.scale.setScalar(scale)
      const velocity = force.clone().multiplyScalar(2 + Math.random() * 3).add(new THREE.Vector3((Math.random() - .5) * 3.4, 1 + Math.random() * 2.6, (Math.random() - .5) * 3.4))
      this.push(mesh, velocity, 16, 1.1 + Math.random() * .5, scale, floor, false)
    }
    return pieces.length
  }

  private push(mesh: THREE.Mesh, velocity: THREE.Vector3, spin: number, life: number, scale: number, floor: number, ownsGeometry: boolean): void {
    mesh.rotation.set(Math.random() * .4, Math.random() * .4, Math.random() * .4)
    const rotSpeed = new THREE.Vector3((Math.random() - .5) * spin, (Math.random() - .5) * spin, (Math.random() - .5) * spin)
    this.shards.push({ mesh, velocity, rotSpeed, life, maxLife: life, initialScale: scale, floor, ownsGeometry })
    this.group.add(mesh)
  }

  update(delta: number): void {
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i]
      s.life -= delta
      if (s.life <= 0) { this.remove(s); this.shards.splice(i, 1); continue }
      s.velocity.y -= 9.8 * delta
      s.velocity.x *= .985
      s.velocity.z *= .985
      s.mesh.position.addScaledVector(s.velocity, delta)
      s.mesh.rotation.x += s.rotSpeed.x * delta
      s.mesh.rotation.y += s.rotSpeed.y * delta
      s.mesh.rotation.z += s.rotSpeed.z * delta
      if (s.mesh.position.y < s.floor + .04) {
        s.mesh.position.y = s.floor + .04
        s.velocity.y = -s.velocity.y * .35
        s.velocity.x *= .72
        s.velocity.z *= .72
        s.rotSpeed.multiplyScalar(.7)
      }
      const progress = s.life / s.maxLife
      if (progress < .35) s.mesh.scale.setScalar(s.initialScale * Math.max(.01, progress / .35))
    }
  }

  private remove(shard: Shard): void {
    this.group.remove(shard.mesh)
    if (shard.ownsGeometry) shard.mesh.geometry.dispose()
  }

  clear(): void {
    for (const shard of this.shards) this.remove(shard)
    this.shards = []
  }

  dispose(): void {
    this.clear()
    this.sparkGeometries.forEach(geometry => geometry.dispose())
    this.sparkMaterials.forEach(material => material.dispose())
    this.pieceMaterial.dispose()
    this.group.removeFromParent()
  }
}
