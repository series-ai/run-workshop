import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AnimationClip,
  AnimationMixer,
  BufferAttribute,
  BufferGeometry,
  LoopOnce,
  LoopRepeat,
  Matrix4,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Sphere,
  Vector3,
  type Bone,
  type Object3D,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AvatarPartEntry, AvatarProportions, CharacterPreset, PackCatalog } from '../contracts/catalog'
import { leavesFor } from '../contracts/packs'
import {
  arachnidFlipLiftY,
  boneScaleFor,
  humanStatureFor,
  quadrupedRollLiftY,
  ual1FloorLiftY,
} from '../contracts/proportions'
import { ragdollGroupFor, type CharacterRagdollMetadata, type RagdollCapsule } from '../contracts/ragdoll'
import type { RigId } from '../contracts/rig'

// ---- Node-safe GLB loading (no DOM image decoder needed) ----

export function stripGlbTextures(file: Buffer): ArrayBuffer {
  const jsonLength = file.readUInt32LE(12)
  const doc = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as Record<string, unknown>
  for (const key of ['materials', 'textures', 'images', 'samplers']) delete doc[key]
  const meshes = doc.meshes as Array<{ primitives: Array<Record<string, unknown>> }> | undefined
  if (meshes) {
    for (const mesh of meshes) {
      for (const prim of mesh.primitives) delete prim.material
    }
  }
  let json = Buffer.from(JSON.stringify(doc), 'utf8')
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)])
  const binary = file.subarray(20 + jsonLength)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(20 + json.length + binary.length, 8)
  header.writeUInt32LE(json.length, 12)
  header.writeUInt32LE(0x4e4f534a, 16)
  const out = Buffer.concat([header, json, binary])
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
}

export async function loadGlbHeadless(path: string): Promise<GLTF> {
  const raw = readFileSync(path)
  return new GLTFLoader().parseAsync(stripGlbTextures(raw), '')
}

// ---- Exact skeletal proportion scaling (mirrors showcase proportionRig.ts) ----

interface BindCapture {
  inverses: Matrix4[]
  positions: Vector3[]
  inverseRotations: Quaternion[]
  parents: number[]
  scales: Vector3[]
  restPelvis: Vector3 | null
}

function captureBind(skeleton: Skeleton): BindCapture {
  const scratchMat = new Matrix4()
  const scratchScale = new Vector3()
  const inverses = skeleton.boneInverses.map((m) => m.clone())
  const positions: Vector3[] = []
  const inverseRotations: Quaternion[] = []
  for (const inv of inverses) {
    const pos = new Vector3()
    const rot = new Quaternion()
    scratchMat.copy(inv).invert().decompose(pos, rot, scratchScale)
    positions.push(pos)
    inverseRotations.push(rot.invert())
  }
  const parents = skeleton.bones.map((bone) =>
    bone.parent ? skeleton.bones.indexOf(bone.parent as (typeof skeleton.bones)[number]) : -1,
  )
  const pelvis = skeleton.bones.find((b) => b.name === 'pelvis' || b.name === 'body')
  return {
    inverses,
    positions,
    inverseRotations,
    parents,
    scales: skeleton.bones.map(() => new Vector3(1, 1, 1)),
    restPelvis: pelvis ? pelvis.position.clone() : null,
  }
}

function applyProportions(root: Object3D, skeleton: Skeleton, proportions: AvatarProportions, rigId: RigId): BindCapture {
  const bind = captureBind(skeleton)
  const { bones, boneInverses } = skeleton
  for (let i = 0; i < bones.length; i++) {
    boneScaleFor(bones[i]!.name, proportions, bind.scales[i]!, rigId)
  }
  const rootUniform = rigId === 'ual1' ? 1 : proportions.height
  const worldY = new Float64Array(bones.length)
  const mat = new Matrix4()
  const offset = new Vector3()
  let lowestSoleY = Infinity

  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i]!
    const scale = bind.scales[i]!
    const joint = bind.positions[i]!
    mat.makeScale(scale.x, scale.y, scale.z)
    mat.setPosition(joint.x - scale.x * joint.x, joint.y - scale.y * joint.y, joint.z - scale.z * joint.z)
    boneInverses[i]!.multiplyMatrices(bind.inverses[i]!, mat)

    if (bone.name === 'root') bone.scale.setScalar(rootUniform)
    const parent = bind.parents[i]!
    if (parent < 0 || bones[parent]!.name === 'root') {
      worldY[i] = joint.y
    } else {
      worldY[i] = worldY[parent]! + (joint.y - bind.positions[parent]!.y) * bind.scales[parent]!.y
      offset
        .copy(joint)
        .sub(bind.positions[parent]!)
        .multiply(bind.scales[parent]!)
        .applyQuaternion(bind.inverseRotations[parent]!)
      bone.position.copy(offset)
    }

    if (
      (rigId === 'ual1' && (bone.name === 'foot_l' || bone.name === 'foot_r')) ||
      (rigId === 'quadruped' && /^leg_(fl|fr|bl|br)_paw$/.test(bone.name)) ||
      (rigId === 'arachnid' && /^leg_[1-4]_[lr]_tibia$/.test(bone.name))
    ) {
      lowestSoleY = Math.min(lowestSoleY, worldY[i]! - scale.y * joint.y)
    }
  }
  if (Number.isFinite(lowestSoleY)) {
    const grounded = lowestSoleY * rootUniform
    root.position.y = Math.abs(grounded) < 1e-12 ? 0 : -grounded
  }
  return bind
}

const TRACK_EPSILON = 1e-4

export function optimizeClipForAudit(clip: AnimationClip, restBones: ReadonlyMap<string, Object3D>): AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const dot = track.name.lastIndexOf('.')
    const bone = restBones.get(track.name.slice(0, dot))
    const property = track.name.slice(dot + 1)
    if (!bone) return true
    if (property === 'quaternion') return true
    if (property !== 'position' && property !== 'scale') return true
    const rest = property === 'scale' ? bone.scale : bone.position
    const values = track.values
    for (let i = 0; i < values.length; i += 3) {
      if (
        Math.abs(values[i]! - rest.x) > TRACK_EPSILON ||
        Math.abs(values[i + 1]! - rest.y) > TRACK_EPSILON ||
        Math.abs(values[i + 2]! - rest.z) > TRACK_EPSILON
      ) {
        return true
      }
    }
    return false
  })
  return new AnimationClip(clip.name, clip.duration, tracks)
}

const appliedAuditLifts = new WeakMap<Object3D, { axis: 'y' | 'z'; amount: number }>()
const auditScratchQuat = new Quaternion()

function unscalePelvisDisplacement(pelvis: Object3D | null, restPelvis: Vector3 | null, applied: Vector3): void {
  if (!pelvis || !restPelvis) return
  const lift = appliedAuditLifts.get(pelvis)
  if (lift && lift.amount !== 0) {
    pelvis.position[lift.axis] -= lift.amount
    appliedAuditLifts.set(pelvis, { axis: lift.axis, amount: 0 })
  }
  if (Math.abs(applied.x - 1) < 1e-4 && Math.abs(applied.y - 1) < 1e-4 && Math.abs(applied.z - 1) < 1e-4) {
    return
  }
  pelvis.position.x = restPelvis.x + (pelvis.position.x - restPelvis.x) / applied.x
  pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) / applied.y
  pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) / applied.z
  applied.set(1, 1, 1)
}

function scalePelvisDisplacement(
  pelvis: Object3D | null,
  restPelvis: Vector3 | null,
  proportions: AvatarProportions,
  rigId: RigId,
  applied: Vector3,
): void {
  if (!pelvis || !restPelvis) {
    applied.set(1, 1, 1)
    return
  }
  if (rigId === 'ual1') {
    const { legY } = humanStatureFor(proportions)
    const q = pelvis.parent ? auditScratchQuat.copy(pelvis.parent.quaternion).multiply(pelvis.quaternion) : pelvis.quaternion
    const localUpY = 1 - 2 * (q.x * q.x + q.z * q.z)
    const rawDropZ = Math.max(0, restPelvis.z - pelvis.position.z)
    const liftZ = ual1FloorLiftY(proportions, localUpY, rawDropZ)
    if (Math.abs(legY - 1) < 1e-4 && liftZ < 1e-4) {
      appliedAuditLifts.set(pelvis, { axis: 'z', amount: 0 })
      applied.set(1, 1, 1)
      return
    }
    const xz = 0.5 + 0.5 * legY
    pelvis.position.x = restPelvis.x + (pelvis.position.x - restPelvis.x) * xz
    pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) * xz
    pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) * legY + liftZ
    appliedAuditLifts.set(pelvis, { axis: 'z', amount: liftZ })
    applied.set(xz, xz, legY)
  } else if (rigId === 'quadruped') {
    const legY = proportions.legRatio ?? 1
    const bodyZ = proportions.bodyLength ?? 1
    const q = pelvis.quaternion
    const localSideY = 2 * (q.x * q.y + q.w * q.z)
    const rawDropY = Math.max(0, restPelvis.y - pelvis.position.y)
    const liftY = quadrupedRollLiftY(proportions, localSideY, rawDropY)
    if (Math.abs(legY - 1) < 1e-4 && Math.abs(bodyZ - 1) < 1e-4 && liftY < 1e-4) {
      appliedAuditLifts.set(pelvis, { axis: 'y', amount: 0 })
      applied.set(1, 1, 1)
      return
    }
    pelvis.position.y = restPelvis.y + (pelvis.position.y - restPelvis.y) * legY + liftY
    pelvis.position.z = restPelvis.z + (pelvis.position.z - restPelvis.z) * bodyZ
    appliedAuditLifts.set(pelvis, { axis: 'y', amount: liftY })
    applied.set(1, legY, bodyZ)
  } else {
    const q = pelvis.quaternion
    const localUpY = 1 - 2 * (q.x * q.x + q.z * q.z)
    const rawDropY = Math.max(0, restPelvis.y - pelvis.position.y)
    const liftY = arachnidFlipLiftY(proportions, localUpY, rawDropY)
    if (liftY > 0) pelvis.position.y += liftY
    appliedAuditLifts.set(pelvis, { axis: 'y', amount: liftY })
    applied.set(1, 1, 1)
  }
}

// ---- Exact geometry math: segment distance + Möller-Trumbore triangle intersection ----

type Vec3 = [number, number, number]

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function segmentSegmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const d1x = q1[0] - p1[0]
  const d1y = q1[1] - p1[1]
  const d1z = q1[2] - p1[2]
  const d2x = q2[0] - p2[0]
  const d2y = q2[1] - p2[1]
  const d2z = q2[2] - p2[2]
  const rx = p1[0] - p2[0]
  const ry = p1[1] - p2[1]
  const rz = p1[2] - p2[2]

  const a = d1x * d1x + d1y * d1y + d1z * d1z
  const e = d2x * d2x + d2y * d2y + d2z * d2z
  const f = d2x * rx + d2y * ry + d2z * rz

  let s = 0
  let t = 0
  if (a <= 1e-12 && e <= 1e-12) {
    return Math.hypot(rx, ry, rz)
  }
  if (a <= 1e-12) {
    t = clamp(f / e, 0, 1)
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz
    if (e <= 1e-12) {
      s = clamp(-c / a, 0, 1)
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z
      const denom = a * e - b * b
      s = denom !== 0 ? clamp((b * f - c * e) / denom, 0, 1) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp(-c / a, 0, 1)
      } else if (t > 1) {
        t = 1
        s = clamp((b - c) / a, 0, 1)
      }
    }
  }
  const dx = rx + d1x * s - d2x * t
  const dy = ry + d1y * s - d2y * t
  const dz = rz + d1z * s - d2z * t
  return Math.hypot(dx, dy, dz)
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function segTriIntersect(p0: Vec3, p1: Vec3, v0: Vec3, v1: Vec3, v2: Vec3): boolean {
  const dir = sub3(p1, p0)
  const e1 = sub3(v1, v0)
  const e2 = sub3(v2, v0)
  const h = cross3(dir, e2)
  const a = dot3(e1, h)
  if (Math.abs(a) < 1e-10) return false
  const f = 1 / a
  const s = sub3(p0, v0)
  const u = f * dot3(s, h)
  if (u < 1e-5 || u > 1 - 1e-5) return false
  const q = cross3(s, e1)
  const v = f * dot3(dir, q)
  if (v < 1e-5 || u + v > 1 - 1e-5) return false
  const t = f * dot3(e2, q)
  return t > 1e-5 && t < 1 - 1e-5
}

export function triTriIntersect(a0: Vec3, a1: Vec3, a2: Vec3, b0: Vec3, b1: Vec3, b2: Vec3): boolean {
  return (
    segTriIntersect(a0, a1, b0, b1, b2) ||
    segTriIntersect(a1, a2, b0, b1, b2) ||
    segTriIntersect(a2, a0, b0, b1, b2) ||
    segTriIntersect(b0, b1, a0, a1, a2) ||
    segTriIntersect(b1, b2, a0, a1, a2) ||
    segTriIntersect(b2, b0, a0, a1, a2)
  )
}

// ---- Audit Data Types ----

export type AuditSeverity = 'error' | 'warning'
export type AuditIssueKind = 'self_collision' | 'floor_penetration' | 'loop_seam_break' | 'velocity_pop'

export interface SelfCollisionFinding {
  kind: 'self_collision'
  severity: AuditSeverity
  pair: [string, string]
  timeSec: number
  capsulePenetrationM: number
  intersectingTriangles: number
}

export interface FloorPenetrationFinding {
  kind: 'floor_penetration'
  severity: AuditSeverity
  timeSec: number
  minVertexY: number
  minCapsuleY: number
}

export interface LoopSeamFinding {
  kind: 'loop_seam_break'
  severity: AuditSeverity
  maxJointDeg: number
  maxPelvisDeltaM: number
  worstJoint: string
}

export interface VelocityPopFinding {
  kind: 'velocity_pop'
  severity: AuditSeverity
  timeSec: number
  bone: string
  angularStepDeg: number
  linearSpeedMps: number
}

export type AnimationAuditFinding =
  | SelfCollisionFinding
  | FloorPenetrationFinding
  | LoopSeamFinding
  | VelocityPopFinding

export interface ClipAuditReport {
  clip: string
  durationSec: number
  samples: number
  minVertexY: number
  maxFrameMinY: number
  endFrameMinY: number
  minCapsuleY: number
  worstSelfCollision: SelfCollisionFinding | null
  findings: AnimationAuditFinding[]
  errors: number
  warnings: number
}

export interface AnimationAuditOptions {
  rigId: RigId
  ragdoll: CharacterRagdollMetadata
  proportions?: AvatarProportions
  sampleHz?: number
  /** Clips allowed below y = 0 (e.g. underwater swim or airborne tuck). */
  allowBelowFloorClips?: ReadonlySet<string>
  /** Capsule + mesh pass-through threshold in metres for error (default 0.03m). */
  passThroughThresholdM?: number
  /** Floor penetration depth in metres for error (default -0.045m). */
  floorErrorThresholdM?: number
  /** Floor penetration depth in metres for warning (default -0.020m). */
  floorWarnThresholdM?: number
}

// ---- Core Audit Engine ----

const DEFAULT_BELOW_FLOOR_CLIPS = new Set(['Swim_Idle_Loop', 'Swim_Fwd_Loop', 'Jump_Start', 'Jump_Loop'])

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function normalizePair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

interface OwnedTri {
  i0: number
  i1: number
  i2: number
  owner: string
}

interface WorldCapsule {
  bone: string
  a: Vec3
  b: Vec3
  radius: number
}

function buildTriangleOwnership(
  mesh: SkinnedMesh,
  rigId: RigId,
  validGroups: ReadonlySet<string>,
): { byGroup: Map<string, OwnedTri[]>; posKeys: string[] } {
  const geo = mesh.geometry
  const pos = geo.getAttribute('position')
  const skinIdx = geo.getAttribute('skinIndex')
  const skinWt = geo.getAttribute('skinWeight')
  const idx = geo.getIndex()
  const joints = mesh.skeleton.bones.map((b) => ragdollGroupFor(rigId, b.name))

  const posKeys: string[] = new Array(pos.count)
  const vGroup: (string | null)[] = new Array(pos.count).fill(null)

  for (let vi = 0; vi < pos.count; vi++) {
    posKeys[vi] = `${Math.round(pos.getX(vi) * 1e4)},${Math.round(pos.getY(vi) * 1e4)},${Math.round(pos.getZ(vi) * 1e4)}`
    const acc = new Map<string, number>()
    const jArr = [skinIdx.getX(vi), skinIdx.getY(vi), skinIdx.getZ(vi), skinIdx.getW(vi)]
    const wArr = [skinWt.getX(vi), skinWt.getY(vi), skinWt.getZ(vi), skinWt.getW(vi)]
    for (let s = 0; s < 4; s++) {
      const w = wArr[s]!
      if (w <= 1e-4) continue
      const g = joints[jArr[s]!] ?? null
      if (!g || !validGroups.has(g)) continue
      acc.set(g, (acc.get(g) ?? 0) + w)
    }
    let bestG: string | null = null
    let bestW = 0
    for (const [g, w] of acc) {
      if (w > bestW) {
        bestW = w
        bestG = g
      }
    }
    if (bestW >= 0.45) vGroup[vi] = bestG
  }

  const byGroup = new Map<string, OwnedTri[]>()
  const triCount = idx ? idx.count / 3 : pos.count / 3
  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    const g0 = vGroup[i0]
    const g1 = vGroup[i1]
    const g2 = vGroup[i2]
    if (!g0 || g0 !== g1 || g1 !== g2) continue // Exclude seam bridge triangles
    let list = byGroup.get(g0)
    if (!list) {
      list = []
      byGroup.set(g0, list)
    }
    list.push({ i0, i1, i2, owner: g0 })
  }
  return { byGroup, posKeys }
}

function capsuleWorld(capsule: RagdollCapsule, mat: Matrix4): WorldCapsule & { bone: string } {
  const e = mat.elements
  const sx = Math.hypot(e[0]!, e[1]!, e[2]!)
  const sy = Math.hypot(e[4]!, e[5]!, e[6]!)
  const sz = Math.hypot(e[8]!, e[9]!, e[10]!)
  const va = new Vector3(...capsule.a).applyMatrix4(mat)
  const vb = new Vector3(...capsule.b).applyMatrix4(mat)
  const rScale = (sx + sy + sz) / 3
  return {
    bone: '',
    a: [va.x, va.y, va.z],
    b: [vb.x, vb.y, vb.z],
    radius: capsule.radius * rScale,
  }
}

export interface AuditProportionController {
  restoreRest: () => void
  unscalePelvis: () => void
  scalePelvis: () => void
}

export function createAuditProportionController(
  root: Object3D,
  meshes: readonly SkinnedMesh[],
  rigId: RigId,
  proportions?: AvatarProportions,
): AuditProportionController {
  const primarySkel = meshes[0]!.skeleton
  const extraInverses = meshes.slice(1).map((m) => m.skeleton.boneInverses.map((inv) => inv.clone()))
  const bind = proportions ? applyProportions(root, primarySkel, proportions, rigId) : captureBind(primarySkel)
  if (proportions) {
    const extraMat = new Matrix4()
    for (let mi = 1; mi < meshes.length; mi++) {
      const skel = meshes[mi]!.skeleton
      const srcInv = extraInverses[mi - 1]!
      for (let i = 0; i < skel.bones.length; i++) {
        const bName = skel.bones[i]!.name
        const pIdx = primarySkel.bones.findIndex((b) => b.name === bName)
        if (pIdx >= 0) {
          const scale = bind.scales[pIdx]!
          const joint = bind.positions[pIdx]!
          extraMat.makeScale(scale.x, scale.y, scale.z)
          extraMat.setPosition(joint.x - scale.x * joint.x, joint.y - scale.y * joint.y, joint.z - scale.z * joint.z)
          skel.boneInverses[i]!.multiplyMatrices(srcInv[i]!, extraMat)
        }
      }
    }
  }
  const pelvis = primarySkel.bones.find((b) => b.name === 'pelvis' || b.name === 'body') ?? null
  const appliedPelvisScale = new Vector3(1, 1, 1)
  const scaledRestTransforms = primarySkel.bones.map((b) => ({
    bone: b,
    pos: b.position.clone(),
    quat: b.quaternion.clone(),
    scale: b.scale.clone(),
  }))
  return {
    restoreRest: () => {
      for (const s of scaledRestTransforms) {
        s.bone.position.copy(s.pos)
        s.bone.quaternion.copy(s.quat)
        s.bone.scale.copy(s.scale)
      }
      appliedPelvisScale.set(1, 1, 1)
      if (pelvis) appliedAuditLifts.set(pelvis, { axis: rigId === 'ual1' ? 'z' : 'y', amount: 0 })
    },
    unscalePelvis: () => {
      if (proportions) unscalePelvisDisplacement(pelvis, bind.restPelvis, appliedPelvisScale)
    },
    scalePelvis: () => {
      if (proportions) scalePelvisDisplacement(pelvis, bind.restPelvis, proportions, rigId, appliedPelvisScale)
    },
  }
}

export function auditRigClips(
  root: Object3D,
  meshes: SkinnedMesh[],
  clips: AnimationClip[],
  options: AnimationAuditOptions,
): ClipAuditReport[] {
  const {
    rigId,
    ragdoll,
    proportions,
    sampleHz = 24,
    allowBelowFloorClips = DEFAULT_BELOW_FLOOR_CLIPS,
    passThroughThresholdM = 0.030,
    floorErrorThresholdM = -0.045,
    floorWarnThresholdM = -0.020,
  } = options

  if (meshes.length === 0) throw new Error('auditRigClips requires at least one SkinnedMesh.')

  const clonedRoot = cloneSkeleton(root)
  const boneByNameRoot = new Map<string, Bone>()
  const staleMeshes: SkinnedMesh[] = []
  clonedRoot.traverse((obj) => {
    if ((obj as Bone).isBone) boneByNameRoot.set(obj.name, obj as Bone)
    if ((obj as SkinnedMesh).isSkinnedMesh) staleMeshes.push(obj as SkinnedMesh)
  })

  // Check if all caller meshes actually live inside `root`
  const areInsideRoot = meshes.every((m) => {
    let cur: Object3D | null = m
    while (cur) {
      if (cur === root) return true
      cur = cur.parent
    }
    return false
  })

  const clonedMeshes: SkinnedMesh[] = []
  if (areInsideRoot) {
    const wantedNames = new Set(meshes.map((m) => m.name))
    for (const sm of staleMeshes) {
      if (wantedNames.has(sm.name)) clonedMeshes.push(sm)
    }
  }
  if (clonedMeshes.length !== meshes.length) {
    // Strip any unrelated template meshes (e.g., core-rig mannequin) and bind caller meshes cleanly to clonedRoot bones
    clonedMeshes.length = 0
    for (const sm of staleMeshes) sm.parent?.remove(sm)
    for (const srcMesh of meshes) {
      const m = new SkinnedMesh(srcMesh.geometry, srcMesh.material)
      m.name = srcMesh.name
      const mapped = srcMesh.skeleton.bones.map((b) => {
        const bone = boneByNameRoot.get(b.name)
        if (!bone) throw new Error(`Skeleton clone missing bone "${b.name}"`)
        return bone
      })
      const skel = new Skeleton(mapped, srcMesh.skeleton.boneInverses.map((inv) => inv.clone()))
      m.bind(skel, new Matrix4())
      clonedRoot.add(m)
      clonedMeshes.push(m)
    }
  }

  const primarySkel = clonedMeshes[0]!.skeleton
  const restBones = new Map<string, Object3D>()
  clonedRoot.traverse((obj) => {
    if (obj.name && (obj as Bone).isBone) restBones.set(obj.name, obj)
  })
  const optimizedClips = clips.map((clip) => optimizeClipForAudit(clip, restBones))

  const propCtrl = createAuditProportionController(clonedRoot, clonedMeshes, rigId, proportions)

  const pelvis = primarySkel.bones.find((b) => b.name === 'pelvis' || b.name === 'body') ?? null
  const boneByName = new Map<string, Bone>()
  for (const b of primarySkel.bones) boneByName.set(b.name, b)

  const ignoreSet = new Set<string>(ragdoll.ignoreCollisionPairs.map(([a, b]) => pairKey(a, b)))
  const validGroups = new Set(ragdoll.bodies.map((b) => b.bone))
  const meshData = clonedMeshes.map((m) => ({
    mesh: m,
    ownership: buildTriangleOwnership(m, rigId, validGroups),
    posed: new Float64Array(m.geometry.getAttribute('position').count * 3),
  }))

  const evaluateFrame = () => {
    propCtrl.scalePelvis()
    clonedRoot.updateMatrixWorld(true)
    for (const md of meshData) {
      md.mesh.skeleton.update()
      const v = new Vector3()
      const count = md.mesh.geometry.getAttribute('position').count
      for (let i = 0; i < count; i++) {
        md.mesh.getVertexPosition(i, v).applyMatrix4(md.mesh.matrixWorld)
        md.posed[i * 3] = v.x
        md.posed[i * 3 + 1] = v.y
        md.posed[i * 3 + 2] = v.z
      }
    }
  }

  const detectCollisionsAtCurrentPose = (timeSec: number): SelfCollisionFinding[] => {
    // Compute world capsules and posed AABBs per ragdoll body
    const worldCaps = new Map<string, WorldCapsule>()
    const groupTris = new Map<string, { mdIdx: number; tris: OwnedTri[]; box: [number, number, number, number, number, number] }[]>()
    for (const body of ragdoll.bodies) {
      const bone = boneByName.get(body.bone)
      if (!bone) continue
      const wc = capsuleWorld(body.collider, bone.matrixWorld)
      wc.bone = body.bone
      worldCaps.set(body.bone, wc)
    }

    for (let mi = 0; mi < meshData.length; mi++) {
      const md = meshData[mi]!
      for (const [grp, tris] of md.ownership.byGroup) {
        let minX = Infinity
        let minY = Infinity
        let minZ = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        let maxZ = -Infinity
        for (const tri of tris) {
          for (const vi of [tri.i0, tri.i1, tri.i2]) {
            const x = md.posed[vi * 3]!
            const y = md.posed[vi * 3 + 1]!
            const z = md.posed[vi * 3 + 2]!
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (z < minZ) minZ = z
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
            if (z > maxZ) maxZ = z
          }
        }
        let arr = groupTris.get(grp)
        if (!arr) {
          arr = []
          groupTris.set(grp, arr)
        }
        arr.push({ mdIdx: mi, tris, box: [minX, minY, minZ, maxX, maxY, maxZ] })
      }
    }

    const hits: SelfCollisionFinding[] = []
    const bodies = ragdoll.bodies
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bA = bodies[i]!.bone
        const bB = bodies[j]!.bone
        if (ignoreSet.has(pairKey(bA, bB))) continue

        const capA = worldCaps.get(bA)
        const capB = worldCaps.get(bB)
        let capDepth = 0
        if (capA && capB) {
          const dist = segmentSegmentDistance(capA.a, capA.b, capB.a, capB.b)
          capDepth = capA.radius + capB.radius - dist
        }

        // Fast AABB check on actual posed triangles belonging to bA and bB
        const listA = groupTris.get(bA) ?? []
        const listB = groupTris.get(bB) ?? []
        let aabbOverlap = false
        for (const ga of listA) {
          for (const gb of listB) {
            if (
              ga.box[0] <= gb.box[3] &&
              ga.box[3] >= gb.box[0] &&
              ga.box[1] <= gb.box[4] &&
              ga.box[4] >= gb.box[1] &&
              ga.box[2] <= gb.box[5] &&
              ga.box[5] >= gb.box[2]
            ) {
              aabbOverlap = true
              break
            }
          }
          if (aabbOverlap) break
        }

        if (!aabbOverlap && capDepth <= passThroughThresholdM) continue

        let triHits = 0
        if (aabbOverlap) {
          for (const ga of listA) {
            const pA = meshData[ga.mdIdx]!.posed
            const kA = meshData[ga.mdIdx]!.ownership.posKeys
            for (const gb of listB) {
              const pB = meshData[gb.mdIdx]!.posed
              const kB = meshData[gb.mdIdx]!.ownership.posKeys
              const sameMesh = ga.mdIdx === gb.mdIdx
              for (const tA of ga.tris) {
                const a0: Vec3 = [pA[tA.i0 * 3]!, pA[tA.i0 * 3 + 1]!, pA[tA.i0 * 3 + 2]!]
                const a1: Vec3 = [pA[tA.i1 * 3]!, pA[tA.i1 * 3 + 1]!, pA[tA.i1 * 3 + 2]!]
                const a2: Vec3 = [pA[tA.i2 * 3]!, pA[tA.i2 * 3 + 1]!, pA[tA.i2 * 3 + 2]!]
                const axMin = Math.min(a0[0], a1[0], a2[0])
                const axMax = Math.max(a0[0], a1[0], a2[0])
                const ayMin = Math.min(a0[1], a1[1], a2[1])
                const ayMax = Math.max(a0[1], a1[1], a2[1])
                const azMin = Math.min(a0[2], a1[2], a2[2])
                const azMax = Math.max(a0[2], a1[2], a2[2])
                for (const tB of gb.tris) {
                  if (
                    sameMesh &&
                    (kA[tA.i0] === kB[tB.i0] ||
                      kA[tA.i0] === kB[tB.i1] ||
                      kA[tA.i0] === kB[tB.i2] ||
                      kA[tA.i1] === kB[tB.i0] ||
                      kA[tA.i1] === kB[tB.i1] ||
                      kA[tA.i1] === kB[tB.i2] ||
                      kA[tA.i2] === kB[tB.i0] ||
                      kA[tA.i2] === kB[tB.i1] ||
                      kA[tA.i2] === kB[tB.i2])
                  ) {
                    continue
                  }
                  const b0: Vec3 = [pB[tB.i0 * 3]!, pB[tB.i0 * 3 + 1]!, pB[tB.i0 * 3 + 2]!]
                  const b1: Vec3 = [pB[tB.i1 * 3]!, pB[tB.i1 * 3 + 1]!, pB[tB.i1 * 3 + 2]!]
                  const b2: Vec3 = [pB[tB.i2 * 3]!, pB[tB.i2 * 3 + 1]!, pB[tB.i2 * 3 + 2]!]
                  if (
                    axMax < Math.min(b0[0], b1[0], b2[0]) ||
                    axMin > Math.max(b0[0], b1[0], b2[0]) ||
                    ayMax < Math.min(b0[1], b1[1], b2[1]) ||
                    ayMin > Math.max(b0[1], b1[1], b2[1]) ||
                    azMax < Math.min(b0[2], b1[2], b2[2]) ||
                    azMin > Math.max(b0[2], b1[2], b2[2])
                  ) {
                    continue
                  }
                  if (triTriIntersect(a0, a1, a2, b0, b1, b2)) {
                    triHits++
                  }
                }
              }
            }
          }
        }

        if (triHits > 0) {
          const isPassThrough =
            (triHits >= 2 && capDepth >= passThroughThresholdM) ||
            (triHits >= 1 && capDepth >= passThroughThresholdM * 1.65) ||
            (triHits >= 16 && capDepth > -0.04)
          hits.push({
            kind: 'self_collision',
            severity: isPassThrough ? 'error' : 'warning',
            pair: normalizePair(bA, bB),
            timeSec: Math.round(timeSec * 1000) / 1000,
            capsulePenetrationM: Math.round(capDepth * 10000) / 10000,
            intersectingTriangles: triHits,
          })
        }
      }
    }
    return hits
  }

  // Record bind-pose baseline intersections (if a custom asset has pre-touching neighbors)
  propCtrl.restoreRest()
  evaluateFrame()
  const bindIgnored = new Set<string>()
  for (const hit of detectCollisionsAtCurrentPose(0)) {
    bindIgnored.add(pairKey(hit.pair[0], hit.pair[1]))
  }

  const mixer = new AnimationMixer(clonedRoot)
  const reports: ClipAuditReport[] = []

  for (const clip of optimizedClips) {
    propCtrl.restoreRest()
    const action = mixer.clipAction(clip)
    const isDeath = clip.name === 'Death' || clip.name.startsWith('Death')
    action.reset()
    action.setLoop(isDeath ? LoopOnce : LoopRepeat, isDeath ? 1 : Infinity)
    action.clampWhenFinished = isDeath
    action.play()
    const duration = Math.max(clip.duration, 1 / sampleHz)
    const steps = Math.max(2, Math.ceil(duration * sampleHz))
    const isCyclic = clip.name.endsWith('_Loop') || (rigId !== 'ual1' && ['Idle', 'Walk', 'Run'].includes(clip.name))

    let clipMinY = Infinity
    let clipMaxMinY = -Infinity
    let clipEndMinY = 0
    let clipMinCapY = Infinity
    let floorWorstTime = 0
    const bestPerPair = new Map<string, SelfCollisionFinding>()
    const findings: AnimationAuditFinding[] = []

    const startQuats = new Map<string, Quaternion>()
    const prevQuats = new Map<string, Quaternion>()
    const startPelvisPos = new Vector3()
    const prevBoneWorldPos = new Map<string, Vector3>()
    let worstPop: VelocityPopFinding | null = null
    let prevT = 0

    for (let s = 0; s <= steps; s++) {
      const t = s === steps ? clip.duration : (s / steps) * clip.duration
      propCtrl.unscalePelvis()
      action.time = t
      mixer.update(0)
      evaluateFrame()

      // Floor penetration
      let frameMinY = Infinity
      let frameMinCapY = Infinity
      for (const md of meshData) {
        const len = md.posed.length / 3
        for (let vi = 0; vi < len; vi++) {
          const y = md.posed[vi * 3 + 1]!
          if (y < frameMinY) frameMinY = y
        }
      }
      for (const body of ragdoll.bodies) {
        const bone = boneByName.get(body.bone)
        if (!bone) continue
        const wc = capsuleWorld(body.collider, bone.matrixWorld)
        const low = Math.min(wc.a[1], wc.b[1]) - wc.radius
        if (low < frameMinCapY) frameMinCapY = low
      }
      if (frameMinY < clipMinY) {
        clipMinY = frameMinY
        floorWorstTime = t
      }
      if (frameMinY > clipMaxMinY) clipMaxMinY = frameMinY
      if (s === steps) clipEndMinY = frameMinY
      if (frameMinCapY < clipMinCapY) {
        clipMinCapY = frameMinCapY
      }

      // Self-collisions (ignoring bind-pose touching pairs)
      for (const hit of detectCollisionsAtCurrentPose(t)) {
        const pk = pairKey(hit.pair[0], hit.pair[1])
        if (bindIgnored.has(pk)) continue
        const prev = bestPerPair.get(pk)
        if (
          !prev ||
          (hit.severity === 'error' && prev.severity !== 'error') ||
          (hit.severity === prev.severity &&
            (hit.capsulePenetrationM > prev.capsulePenetrationM ||
              (hit.capsulePenetrationM === prev.capsulePenetrationM && hit.intersectingTriangles > prev.intersectingTriangles)))
        ) {
          bestPerPair.set(pk, hit)
        }
      }

      // Loop start & Velocity pop tracking
      const dt = t - prevT
      for (const bone of primarySkel.bones) {
        if (bone.name === 'root') continue
        const wp = bone.getWorldPosition(new Vector3())
        if (s === 0) {
          startQuats.set(bone.name, bone.quaternion.clone())
          prevQuats.set(bone.name, bone.quaternion.clone())
          prevBoneWorldPos.set(bone.name, wp)
          if (bone === pelvis) startPelvisPos.copy(bone.position)
        } else {
          const pq = prevQuats.get(bone.name)!
          const pp = prevBoneWorldPos.get(bone.name)!
          const dot = Math.min(1, Math.abs(pq.dot(bone.quaternion)))
          const deg = (2 * Math.acos(dot) * 180) / Math.PI
          const speed = dt > 1e-4 ? wp.distanceTo(pp) / dt : 0
          const maxSpeedMps = 35 * Math.max(1, (proportions?.height ?? 1) * (proportions?.armLength ?? 1))
          // Flag instantaneous single-step discontinuity pops (> 75 deg in one step or bone teleport)
          if (deg > 75 || speed > maxSpeedMps) {
            const score = Math.max(deg / 75, speed / maxSpeedMps)
            const prevScore = worstPop ? Math.max(worstPop.angularStepDeg / 75, worstPop.linearSpeedMps / maxSpeedMps) : 0
            if (!worstPop || score > prevScore) {
              worstPop = {
                kind: 'velocity_pop',
                severity: 'error',
                timeSec: Math.round(t * 1000) / 1000,
                bone: bone.name,
                angularStepDeg: Math.round(deg * 10) / 10,
                linearSpeedMps: Math.round(speed * 10) / 10,
              }
            }
          }
          pq.copy(bone.quaternion)
          pp.copy(wp)
        }
      }
      prevT = t
    }

    // Loop seam continuity check at t = duration
    if (isCyclic && clip.duration > 0) {
      let maxJointDeg = 0
      let worstJoint = 'pelvis'
      for (const bone of primarySkel.bones) {
        if (bone.name === 'root') continue
        const q0 = startQuats.get(bone.name)
        if (!q0) continue
        const dot = Math.min(1, Math.abs(q0.dot(bone.quaternion)))
        const deg = (2 * Math.acos(dot) * 180) / Math.PI
        if (deg > maxJointDeg) {
          maxJointDeg = deg
          worstJoint = bone.name
        }
      }
      const maxPelvisDelta = pelvis ? pelvis.position.distanceTo(startPelvisPos) : 0
      if (maxJointDeg > 3 || maxPelvisDelta > 0.01) {
        findings.push({
          kind: 'loop_seam_break',
          severity: maxJointDeg > 8 || maxPelvisDelta > 0.025 ? 'error' : 'warning',
          maxJointDeg: Math.round(maxJointDeg * 100) / 100,
          maxPelvisDeltaM: Math.round(maxPelvisDelta * 10000) / 10000,
          worstJoint,
        })
      }
    }

    if (worstPop) findings.push(worstPop)

    if (!allowBelowFloorClips.has(clip.name) && clipMinY < floorWarnThresholdM) {
      findings.push({
        kind: 'floor_penetration',
        severity: clipMinY < floorErrorThresholdM ? 'error' : 'warning',
        timeSec: Math.round(floorWorstTime * 1000) / 1000,
        minVertexY: Math.round(clipMinY * 10000) / 10000,
        minCapsuleY: Math.round(clipMinCapY * 10000) / 10000,
      })
    }

    let worstSelf: SelfCollisionFinding | null = null
    for (const hit of bestPerPair.values()) {
      findings.push(hit)
      if (
        !worstSelf ||
        (hit.severity === 'error' && worstSelf.severity !== 'error') ||
        (hit.severity === worstSelf.severity && hit.capsulePenetrationM > worstSelf.capsulePenetrationM)
      ) {
        worstSelf = hit
      }
    }

    action.stop()
    const errors = findings.filter((f) => f.severity === 'error').length
    const warnings = findings.filter((f) => f.severity === 'warning').length
    reports.push({
      clip: clip.name,
      durationSec: Math.round(clip.duration * 1000) / 1000,
      samples: steps + 1,
      minVertexY: Math.round(clipMinY * 10000) / 10000,
      maxFrameMinY: Math.round(clipMaxMinY * 10000) / 10000,
      endFrameMinY: Math.round(clipEndMinY * 10000) / 10000,
      minCapsuleY: Math.round(clipMinCapY * 10000) / 10000,
      worstSelfCollision: worstSelf,
      findings,
      errors,
      warnings,
    })
  }

  mixer.stopAllAction()
  return reports
}

const MORPH_BODY_COORD: Record<string, number> = {
  body_slim: -1,
  body_athletic: 0,
  body_heavy: 1,
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function resolveAuditMorphs(
  mesh: SkinnedMesh,
  bodyId: string,
  build: number,
  headId: string | null,
): { attr: BufferAttribute; weight: number }[] {
  const dict = mesh.morphTargetDictionary
  const positions = mesh.geometry.morphAttributes.position
  if (!dict || !positions) return []
  const out: { attr: BufferAttribute; weight: number }[] = []

  if (!(bodyId in MORPH_BODY_COORD)) {
    const idx = dict[bodyId]
    const attr = idx === undefined ? undefined : (positions[idx] as BufferAttribute | undefined)
    if (attr) out.push({ attr, weight: 1 })
  } else {
    const targetCoord = Math.max(-1, Math.min(1, MORPH_BODY_COORD[bodyId]! + build))
    const wSlim = targetCoord < 0 ? -targetCoord : 0
    const wHeavy = targetCoord > 0 ? targetCoord : 0
    const wAthletic = 1 - wSlim - wHeavy
    for (const [name, weight] of [
      ['body_slim', wSlim],
      ['body_athletic', wAthletic],
      ['body_heavy', wHeavy],
    ] as const) {
      if (weight <= 1e-4) continue
      const idx = dict[name]
      const attr = idx === undefined ? undefined : (positions[idx] as BufferAttribute | undefined)
      if (attr) out.push({ attr, weight })
    }
  }

  if (headId) {
    const idx = dict[headId]
    const attr = idx === undefined ? undefined : (positions[idx] as BufferAttribute | undefined)
    if (attr) out.push({ attr, weight: 1 })
  }
  return out
}

function buildCulledMorphedGeometry(
  meshes: readonly SkinnedMesh[],
  bodyId: string,
  buildWeight: number,
  headId: string | null,
  extraCovered: readonly string[],
): BufferGeometry {
  const covered = new Set([...meshes.flatMap((m) => stringList(m.userData.polyCovers)), ...extraCovered])
  let vertexTotal = 0
  let indexTotal = 0
  const partInputs = meshes.map((mesh) => {
    const geo = mesh.geometry
    const index = geo.getIndex()
    if (!index) throw new Error(`Part "${mesh.name}" has no index buffer.`)
    const keep = new Uint8Array(index.count / 3).fill(1)
    const regions = mesh.userData.polyRegions as Record<string, [number, number]> | undefined
    if (regions) {
      for (const [tag, [start, count]] of Object.entries(regions)) {
        if (covered.has(tag)) keep.fill(0, start / 3, (start + count) / 3)
      }
    }
    const morphs = resolveAuditMorphs(mesh, bodyId, buildWeight, headId)
    vertexTotal += geo.getAttribute('position').count
    indexTotal += index.count
    return { mesh, keep, morphs }
  })

  const positions = new Float32Array(vertexTotal * 3)
  const normals = new Float32Array(vertexTotal * 3)
  const uvs = new Float32Array(vertexTotal * 2)
  const skinIndices = new Uint16Array(vertexTotal * 4)
  const skinWeights = new Float32Array(vertexTotal * 4)
  const indices = new Uint32Array(indexTotal)
  let vertexCount = 0
  let indexCount = 0

  for (const { mesh, keep, morphs } of partInputs) {
    const geo = mesh.geometry
    const position = geo.getAttribute('position')
    const normal = geo.getAttribute('normal')
    const uv = geo.getAttribute('uv')
    const skinIndex = geo.getAttribute('skinIndex')
    const skinWeight = geo.getAttribute('skinWeight')
    const index = geo.getIndex()!
    const remap = new Int32Array(position.count).fill(-1)

    for (let tri = 0; tri < keep.length; tri++) {
      if (!keep[tri]) continue
      for (let corner = 0; corner < 3; corner++) {
        const src = index.getX(tri * 3 + corner)
        let dst = remap[src]!
        if (dst < 0) {
          dst = vertexCount++
          remap[src] = dst
          let px = position.getX(src)
          let py = position.getY(src)
          let pz = position.getZ(src)
          for (const { attr, weight } of morphs) {
            px += attr.getX(src) * weight
            py += attr.getY(src) * weight
            pz += attr.getZ(src) * weight
          }
          positions[dst * 3] = px
          positions[dst * 3 + 1] = py
          positions[dst * 3 + 2] = pz
          if (normal) {
            normals[dst * 3] = normal.getX(src)
            normals[dst * 3 + 1] = normal.getY(src)
            normals[dst * 3 + 2] = normal.getZ(src)
          }
          if (uv) {
            uvs[dst * 2] = uv.getX(src)
            uvs[dst * 2 + 1] = uv.getY(src)
          }
          for (let slot = 0; slot < 4; slot++) {
            skinIndices[dst * 4 + slot] = skinIndex.getComponent(src, slot)
            skinWeights[dst * 4 + slot] = skinWeight.getComponent(src, slot)
          }
        }
        indices[indexCount++] = dst
      }
    }
  }

  const merged = new BufferGeometry()
  merged.setAttribute('position', new BufferAttribute(positions.slice(0, vertexCount * 3), 3))
  merged.setAttribute('normal', new BufferAttribute(normals.slice(0, vertexCount * 3), 3))
  merged.setAttribute('uv', new BufferAttribute(uvs.slice(0, vertexCount * 2), 2))
  merged.setAttribute('skinIndex', new BufferAttribute(skinIndices.slice(0, vertexCount * 4), 4))
  merged.setAttribute('skinWeight', new BufferAttribute(skinWeights.slice(0, vertexCount * 4), 4))
  const used = indices.subarray(0, indexCount)
  merged.setIndex(new BufferAttribute(vertexCount < 65536 ? Uint16Array.from(used) : used.slice(), 1))
  merged.boundingSphere = new Sphere(new Vector3(0, 1, 0), 2.8)
  return merged
}

/**
 * Compose modular parts for audit by culling covered body/head regions (`polyCovers`)
 * and baking `body`/`build`/`head` morph targets onto a primary-skeleton-bound SkinnedMesh.
 */
export function mergeSkinnedGeometriesForAudit(
  meshes: SkinnedMesh[],
  bodyId: string,
  buildWeight: number,
  headId: string | null,
  extraCovered: readonly string[] = [],
): SkinnedMesh {
  if (meshes.length === 0) throw new Error('mergeSkinnedGeometriesForAudit requires at least one SkinnedMesh.')
  const geo = buildCulledMorphedGeometry(meshes, bodyId, buildWeight, headId, extraCovered)
  const out = new SkinnedMesh(geo, meshes[0]!.material)
  out.bind(meshes[0]!.skeleton, new Matrix4())
  return out
}

export interface LoadedPresetAuditRig {
  root: Object3D
  meshes: SkinnedMesh[]
  clips: AnimationClip[]
  rigId: RigId
  ragdoll: CharacterRagdollMetadata
}

export async function loadPresetForAudit(
  preset: CharacterPreset,
  catalogs: readonly PackCatalog[],
  stageDir: string,
  cache?: Map<string, GLTF>,
): Promise<LoadedPresetAuditRig> {
  if (!preset.ragdoll) {
    throw new Error(`Preset "${preset.id}" is missing resolved ragdoll metadata.`)
  }
  const rigId: RigId = preset.rigId ?? 'ual1'
  const partsById = new Map<string, AvatarPartEntry>()
  const packMap = new Map<string, PackCatalog>()
  for (const cat of catalogs) {
    packMap.set(cat.pack, cat)
    for (const part of cat.parts) partsById.set(part.id, part)
  }

  const glbCache = cache ?? new Map<string, GLTF>()
  const loadPath = async (path: string): Promise<GLTF> => {
    let gltf = glbCache.get(path)
    if (!gltf) {
      gltf = await loadGlbHeadless(path)
      glbCache.set(path, gltf)
    }
    return gltf
  }

  // Load rig GLB with clips
  let rigGlbPath: string
  if (rigId === 'ual1') {
    const corePack = packMap.get('core')
    const leafDir = join(stageDir, leavesFor('core').find((l) => l.kind === 'characters')!.id)
    rigGlbPath = join(leafDir, corePack?.rigModelPath ?? 'core-rig.glb')
  } else {
    let foundPath: string | null = null
    for (const cat of catalogs) {
      const cr = cat.creatureRigs?.find((c) => c.rigId === rigId)
      if (cr) {
        const leafDir = join(stageDir, leavesFor(cat.pack).find((l) => l.kind === 'characters')!.id)
        foundPath = join(leafDir, cr.rigModelPath)
        break
      }
    }
    if (!foundPath) throw new Error(`Missing creature rig GLB for rigId "${rigId}".`)
    rigGlbPath = foundPath
  }
  const rigGlb = await loadPath(rigGlbPath)

  const headwear = preset.headwear ? partsById.get(preset.headwear) : undefined
  const hideHair = headwear?.rules.hidesHair ?? false
  const partIds = [
    preset.body,
    preset.head,
    hideHair ? null : preset.hair,
    preset.torso,
    preset.legs,
    preset.headwear,
    preset.back,
  ].filter((x): x is string => Boolean(x))

  const partMeshes: SkinnedMesh[] = []
  for (const id of partIds) {
    const part = partsById.get(id)
    if (!part) throw new Error(`Preset "${preset.id}" references missing part "${id}".`)
    const leafDir = join(stageDir, leavesFor(part.pack).find((l) => l.kind === part.leaf)!.id)
    const gltf = await loadPath(join(leafDir, part.relativePath))
    const found = gltf.scene.getObjectByName(part.nodeName) as SkinnedMesh | undefined
    if (!found?.isSkinnedMesh) throw new Error(`Part "${part.id}" node "${part.nodeName}" is not a SkinnedMesh.`)
    partMeshes.push(found)
  }

  const rigRoot = cloneSkeleton(rigGlb.scene)
  const rigBonesByName = new Map<string, Bone>()
  rigRoot.traverse((obj) => {
    if ((obj as Bone).isBone) rigBonesByName.set(obj.name, obj as Bone)
  })

  const covered = new Set(partMeshes.flatMap((m) => stringList(m.userData.polyCovers)))
  const bakedParts = partMeshes.map((mesh) => {
    const geo = buildCulledMorphedGeometry([mesh], preset.body, preset.proportions.build ?? 0, preset.head ?? null, [
      ...covered,
    ])
    const sm = new SkinnedMesh(geo, mesh.material)
    sm.name = mesh.name
    const mappedBones = mesh.skeleton.bones.map((b) => {
      const target = rigBonesByName.get(b.name)
      if (!target) throw new Error(`Rig "${rigId}" missing bone "${b.name}" for part "${mesh.name}"`)
      return target
    })
    const skel = new Skeleton(
      mappedBones,
      mesh.skeleton.boneInverses.map((inv) => inv.clone()),
    )
    sm.bind(skel, new Matrix4())
    rigRoot.add(sm)
    return sm
  })

  return {
    root: rigRoot,
    meshes: bakedParts,
    clips: rigGlb.animations,
    rigId,
    ragdoll: preset.ragdoll,
  }
}

export function serializeReportSummary(report: ClipAuditReport): string {
  const parts = report.findings.map((f) => {
    if (f.kind === 'self_collision') {
      return `${f.severity}:${f.pair[0]}+${f.pair[1]}@${f.timeSec}s(cap=${f.capsulePenetrationM}m,tris=${f.intersectingTriangles})`
    }
    if (f.kind === 'floor_penetration') {
      return `${f.severity}:floor@${f.timeSec}s(y=${f.minVertexY}m)`
    }
    if (f.kind === 'loop_seam_break') {
      return `${f.severity}:seam(${f.worstJoint}=${f.maxJointDeg}deg,pelvis=${f.maxPelvisDeltaM}m)`
    }
    return `${f.severity}:pop(${f.bone}@${f.timeSec}s,${f.angularStepDeg}deg)`
  })
  return `[${report.clip}] minY=${report.minVertexY}m maxMinY=${report.maxFrameMinY}m endY=${report.endFrameMinY}m errors=${report.errors} warnings=${report.warnings}${parts.length ? ' -> ' + parts.join(', ') : ''}`
}

export function groupLookupForPack(catalogs: readonly PackCatalog[]) {
  const parts = new Map<string, PackCatalog['parts'][number]>()
  const presets: CharacterPreset[] = []
  for (const cat of catalogs) {
    for (const p of cat.parts) parts.set(p.id, p)
    for (const pr of cat.presets) presets.push(pr)
  }
  return { parts, presets }
}
