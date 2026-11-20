import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Object3D,
  Skeleton,
  Sphere,
  Vector3,
  type Bone,
  type Mesh,
  type SkinnedMesh,
} from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { RIG_SPECS, type RigId } from '@chisel/contracts/rig'

/**
 * Shared rig data of run-chisel-core and the geometry merge for composed avatars.
 *
 * One avatar is one skinned draw call: all visible parts go into one geometry.
 * Every part GLB uses the UAL1 joint order, so the joint indices need no change.
 */

// ---- GLB cache ---------------------------------------------------------------

type GltfEntry =
  | { status: 'pending'; promise: Promise<void> }
  | { status: 'ready'; gltf: GLTF }
  | { status: 'failed'; error: unknown }

const gltfCache = new Map<string, GltfEntry>()
const gltfLoader = new GLTFLoader()

/**
 * Read a GLB in a component body. The component suspends until the file is ready.
 * Each URL loads one time, so all avatars share its geometries and clips (performance rule P4).
 */
export function readGltf(url: string): GLTF {
  let entry = gltfCache.get(url)
  if (!entry) {
    const promise = gltfLoader.loadAsync(url).then(
      (gltf) => void gltfCache.set(url, { status: 'ready', gltf }),
      (error: unknown) => void gltfCache.set(url, { status: 'failed', error }),
    )
    entry = { status: 'pending', promise }
    gltfCache.set(url, entry)
  }
  if (entry.status === 'pending') throw entry.promise
  if (entry.status === 'failed') throw entry.error
  return entry.gltf
}

// ---- clips ----------------------------------------------------------------

const TRACK_EPSILON = 1e-4

/**
 * Remove the tracks that only hold the rest value (all scale tracks and all translation tracks
 * but the pelvis in the UAL1 clips). The mixer then writes about a third of the properties, and
 * the proportion rig owns bone scale and joint offsets.
 */
export function optimizeClip(clip: AnimationClip, restBones: ReadonlyMap<string, Object3D>): AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const dot = track.name.lastIndexOf('.')
    const bone = restBones.get(track.name.slice(0, dot))
    const property = track.name.slice(dot + 1)
    if (!bone) throw new Error(`Clip "${clip.name}" animates the unknown node "${track.name}".`)
    if (property === 'quaternion') return true
    if (property !== 'position' && property !== 'scale') {
      throw new Error(`Clip "${clip.name}" has an unsupported track "${track.name}".`)
    }
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

// ---- core rig ---------------------------------------------------------------

export interface CoreRig {
  /** Bone hierarchy without meshes. Each avatar clones it. */
  template: Object3D
  inverseBinds: readonly Matrix4[]
  clips: ReadonlyMap<string, AnimationClip>
}

export interface RigInstance {
  root: Object3D
  bones: Bone[]
  skeleton: Skeleton
  handR: Bone | null
  handL: Bone | null
  pelvis: Bone | null
  restPelvis: Vector3 | null
}

const coreRigs = new WeakMap<GLTF, CoreRig>()

export function getCoreRig(gltf: GLTF, rigId: RigId = 'ual1'): CoreRig {
  const cached = coreRigs.get(gltf)
  if (cached) return cached
  const expectedJoints = RIG_SPECS[rigId].joints
  let skinned: SkinnedMesh | undefined
  gltf.scene.traverse((object) => {
    if (!skinned && (object as SkinnedMesh).isSkinnedMesh) skinned = object as SkinnedMesh
  })
  if (!skinned) throw new Error(`${rigId} rig GLB has no skinned mesh.`)
  const { bones, boneInverses } = skinned.skeleton
  if (bones.length !== expectedJoints.length || bones.some((bone, i) => bone.name !== expectedJoints[i])) {
    throw new Error(`${rigId} rig GLB does not match the ${expectedJoints.length}-joint contract.`)
  }
  // Only the bones go into the template. The meshes of the core GLB stay in the loader cache.
  const template = new Object3D()
  template.name = rigId === 'ual1' ? 'UAL1_Rig' : `${rigId}_Rig`
  template.add(cloneSkeleton(bones[0]!))
  const rest = new Map<string, Object3D>(bones.map((bone) => [bone.name, bone]))
  const clips = new Map(gltf.animations.map((clip) => [clip.name, optimizeClip(clip, rest)]))
  const rig: CoreRig = { template, inverseBinds: boneInverses.map((matrix) => matrix.clone()), clips }
  coreRigs.set(gltf, rig)
  return rig
}

export function createRigInstance(core: CoreRig, rigId: RigId = 'ual1'): RigInstance {
  const expectedJoints = RIG_SPECS[rigId].joints
  const root = cloneSkeleton(core.template)
  const byName = new Map<string, Bone>()
  root.traverse((object) => {
    if ((object as Bone).isBone) byName.set(object.name, object as Bone)
  })
  const bones = expectedJoints.map((name) => {
    const bone = byName.get(name)
    if (!bone) throw new Error(`The ${rigId} rig clone has no bone "${name}".`)
    return bone
  })
  const skeleton = new Skeleton(bones, core.inverseBinds.map((matrix) => matrix.clone()))
  const pelvis = byName.get(rigId === 'arachnid' ? 'body' : 'pelvis') ?? null
  return {
    root,
    bones,
    skeleton,
    handR: byName.get('hand_r') ?? null,
    handL: byName.get('hand_l') ?? null,
    pelvis,
    restPelvis: pelvis ? pelvis.position.clone() : null,
  }
}

// ---- part lookup ------------------------------------------------------------

export function findSkinnedPart(gltf: GLTF, nodeName: string, rigId: RigId = 'ual1'): SkinnedMesh {
  const expectedJoints = RIG_SPECS[rigId].joints
  const found = gltf.scene.getObjectByName(nodeName) as SkinnedMesh | undefined
  if (!found?.isSkinnedMesh) throw new Error(`"${nodeName}" is not a skinned mesh in its GLB.`)
  const names = found.skeleton.bones
  if (names.length !== expectedJoints.length || names.some((bone, i) => bone.name !== expectedJoints[i])) {
    throw new Error(`"${nodeName}" does not use the ${rigId} joint order.`)
  }
  return found
}

export function findStaticMesh(gltf: GLTF, nodeName: string): Mesh {
  const found = gltf.scene.getObjectByName(nodeName) as Mesh | undefined
  if (!found?.isMesh) throw new Error(`"${nodeName}" is not a mesh in its GLB.`)
  return found
}

// ---- geometry merge -----------------------------------------------------------

interface MorphBlend {
  attr: BufferAttribute
  weight: number
}

interface PartData {
  mesh: SkinnedMesh
  /** Triangle is kept (1) or hidden below an outfit (0). */
  keep: Uint8Array
  morphs: MorphBlend[]
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

const MORPH_BODY_COORD: Record<string, number> = {
  body_slim: -1,
  body_athletic: 0,
  body_heavy: 1,
}

function resolveBodyMorphs(mesh: SkinnedMesh, bodyId: string, build: number): MorphBlend[] {
  const dict = mesh.morphTargetDictionary
  const positions = mesh.geometry.morphAttributes.position
  if (!dict || !positions) return []

  // Non-standard bodies (orc, troll) only use discrete morph fallback at build === 0.
  if (!(bodyId in MORPH_BODY_COORD)) {
    const idx = dict[bodyId]
    const attr = idx === undefined ? undefined : (positions[idx] as BufferAttribute | undefined)
    return attr ? [{ attr, weight: 1 }] : []
  }

  const baseCoord = MORPH_BODY_COORD[bodyId]!
  const targetCoord = Math.max(-1, Math.min(1, baseCoord + build))
  const wSlim = targetCoord < 0 ? -targetCoord : 0
  const wHeavy = targetCoord > 0 ? targetCoord : 0
  const wAthletic = 1 - wSlim - wHeavy

  const targets: [string, number][] = [
    ['body_slim', wSlim],
    ['body_athletic', wAthletic],
    ['body_heavy', wHeavy],
  ]
  const out: MorphBlend[] = []
  for (const [name, weight] of targets) {
    if (weight <= 1e-4) continue
    const idx = dict[name]
    if (idx === undefined) continue
    const attr = positions[idx] as BufferAttribute | undefined
    if (attr) out.push({ attr, weight })
  }
  return out
}

export interface FaceMorphWeights {
  faceJaw?: number
  faceNose?: number
  faceBrow?: number
  faceSmile?: number
  faceBlink?: number
}

const FACE_MORPH_KEYS: readonly [keyof FaceMorphWeights, string][] = [
  ['faceJaw', 'face_jaw'],
  ['faceNose', 'face_nose'],
  ['faceBrow', 'face_brow'],
  ['faceSmile', 'face_smile'],
  ['faceBlink', 'face_blink'],
]

function resolveMorphs(
  mesh: SkinnedMesh,
  bodyId: string,
  build: number,
  headId: string | null,
  face?: FaceMorphWeights,
): MorphBlend[] {
  const out = resolveBodyMorphs(mesh, bodyId, build)
  const dict = mesh.morphTargetDictionary
  const positions = mesh.geometry.morphAttributes.position
  if (headId) {
    const idx = dict?.[headId]
    const attr = idx === undefined ? undefined : (positions?.[idx] as BufferAttribute | undefined)
    if (attr) out.push({ attr, weight: 1 })
  }
  if (face && dict && positions) {
    for (const [propKey, targetName] of FACE_MORPH_KEYS) {
      const w = face[propKey] ?? 0
      if (Math.abs(w) <= 1e-4) continue
      const idx = dict[targetName]
      const attr = idx === undefined ? undefined : (positions[idx] as BufferAttribute | undefined)
      if (attr) out.push({ attr, weight: w })
    }
  }
  return out
}

/**
 * Merge skinned parts into one geometry.
 *   - `bodyId` + `build` (-1 Slim .. 0 Athletic .. +1 Heavy) interpolate morph targets smoothly
 *     across both the base body and every outfit. The blended shape is baked so no GPU morph runs.
 *   - `headId` activates monster head-fit morph targets (`head_orc`, `head_troll`) on headwear and hair.
 *   - `face` applies parametric facial structure & expression morphs (`face_jaw`, `face_nose`, `face_brow`, `face_smile`, `face_blink`).
 *   - Body regions that an outfit covers (`polyCovers` + `extraCovered` against `polyRegions`) are left out.
 */
export function mergeParts(
  meshes: readonly SkinnedMesh[],
  bodyId: string,
  build = 0,
  headId: string | null = null,
  extraCovered: readonly string[] = [],
  face?: FaceMorphWeights,
): BufferGeometry {
  const covered = new Set([...meshes.flatMap((mesh) => stringList(mesh.userData.polyCovers)), ...extraCovered])
  const parts: PartData[] = []
  let vertexTotal = 0
  let indexTotal = 0
  for (const mesh of meshes) {
    const geometry = mesh.geometry
    const index = geometry.getIndex()
    if (!index) throw new Error(`Part "${mesh.name}" has no index buffer.`)
    const keep = new Uint8Array(index.count / 3).fill(1)
    const regions = mesh.userData.polyRegions as Record<string, [number, number]> | undefined
    if (regions) {
      for (const [tag, [start, count]] of Object.entries(regions)) {
        if (covered.has(tag)) keep.fill(0, start / 3, (start + count) / 3)
      }
    }
    const morphs = resolveMorphs(mesh, bodyId, build, headId, face)
    parts.push({ mesh, keep, morphs })
    vertexTotal += geometry.getAttribute('position').count
    indexTotal += index.count
  }

  const positions = new Float32Array(vertexTotal * 3)
  const normals = new Float32Array(vertexTotal * 3)
  const uvs = new Float32Array(vertexTotal * 2)
  const skinIndices = new Uint16Array(vertexTotal * 4)
  const skinWeights = new Float32Array(vertexTotal * 4)
  const indices = new Uint32Array(indexTotal)
  let vertexCount = 0
  let indexCount = 0
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()

  for (const { mesh, keep, morphs } of parts) {
    const geometry = mesh.geometry
    const position = geometry.getAttribute('position')
    const normal = geometry.getAttribute('normal')
    const uv = geometry.getAttribute('uv')
    const skinIndex = geometry.getAttribute('skinIndex')
    const skinWeight = geometry.getAttribute('skinWeight')
    const index = geometry.getIndex()!
    if (!normal || !uv || !skinIndex || !skinWeight) throw new Error(`Part "${mesh.name}" lacks a vertex attribute.`)
    const remap = new Int32Array(position.count).fill(-1)
    const firstVertex = vertexCount
    const firstIndex = indexCount
    for (let triangle = 0; triangle < keep.length; triangle++) {
      if (!keep[triangle]) continue
      for (let corner = 0; corner < 3; corner++) {
        const source = index.getX(triangle * 3 + corner)
        let target = remap[source]!
        if (target < 0) {
          target = vertexCount++
          remap[source] = target
          let px = position.getX(source)
          let py = position.getY(source)
          let pz = position.getZ(source)
          for (let m = 0; m < morphs.length; m++) {
            const { attr, weight } = morphs[m]!
            px += attr.getX(source) * weight
            py += attr.getY(source) * weight
            pz += attr.getZ(source) * weight
          }
          positions[target * 3] = px
          positions[target * 3 + 1] = py
          positions[target * 3 + 2] = pz
          normals[target * 3] = normal.getX(source)
          normals[target * 3 + 1] = normal.getY(source)
          normals[target * 3 + 2] = normal.getZ(source)
          uvs[target * 2] = uv.getX(source)
          uvs[target * 2 + 1] = uv.getY(source)
          for (let slot = 0; slot < 4; slot++) {
            skinIndices[target * 4 + slot] = skinIndex.getComponent(source, slot)
            skinWeights[target * 4 + slot] = skinWeight.getComponent(source, slot)
          }
        }
        indices[indexCount++] = target
      }
    }
    if (morphs.length > 0) {
      // The morph moved the facets. Each polygon has its own vertices, so a sum of face normals stays flat.
      normals.fill(0, firstVertex * 3, vertexCount * 3)
      for (let i = firstIndex; i < indexCount; i += 3) {
        const ia = indices[i]!
        const ib = indices[i + 1]!
        const ic = indices[i + 2]!
        a.fromArray(positions, ia * 3)
        b.fromArray(positions, ib * 3).sub(a)
        c.fromArray(positions, ic * 3).sub(a)
        b.cross(c)
        for (const vertex of [ia, ib, ic]) {
          normals[vertex * 3] = normals[vertex * 3]! + b.x
          normals[vertex * 3 + 1] = normals[vertex * 3 + 1]! + b.y
          normals[vertex * 3 + 2] = normals[vertex * 3 + 2]! + b.z
        }
      }
      for (let vertex = firstVertex; vertex < vertexCount; vertex++) {
        a.fromArray(normals, vertex * 3).normalize().toArray(normals, vertex * 3)
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
  // A fixed sphere is cheaper than a skinned bound and holds every clip and creature scale of the library.
  merged.boundingSphere = new Sphere(new Vector3(0, 1, 0), 2.8)
  return merged
}

// ---- merged geometry cache ------------------------------------------------------

const mergedCache = new Map<string, { geometry: BufferGeometry; users: number }>()

/** Avatars with the same parts and body share one GPU geometry (performance rule P4). */
export function acquireMergedGeometry(key: string, build: () => BufferGeometry): BufferGeometry {
  let entry = mergedCache.get(key)
  if (!entry) {
    entry = { geometry: build(), users: 0 }
    mergedCache.set(key, entry)
  }
  entry.users++
  return entry.geometry
}

export function releaseMergedGeometry(key: string): void {
  const entry = mergedCache.get(key)
  if (!entry) throw new Error(`Merged geometry "${key}" was released more than it was acquired.`)
  entry.users--
  if (entry.users === 0) {
    entry.geometry.dispose()
    mergedCache.delete(key)
  }
}
