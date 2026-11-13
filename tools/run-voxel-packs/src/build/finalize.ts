/**
 * Post-export fixes Blender's glTF exporter cannot express:
 * - every texture samples nearest/nearest with clamp. Blender writes
 *   NEAREST_MIPMAP_NEAREST for "Closest", and the mip levels of a 256×1
 *   palette blend neighbouring colours, so distant models would change colour.
 * - world-space meshes are stored with KHR_mesh_quantization: positions as
 *   int16 steps of 1/2 … 1/64 voxel (the coarsest step that is exact for the
 *   mesh) under a child node that scales them back, normals as int8, UVs as
 *   uint16. Lossless for positions and normals, and half the vertex size.
 * - parts that fight: when two parts have coplanar faces that overlap and
 *   show different paint (src/validate/zfight.ts), the smaller part moves
 *   PART_INSET voxel back along the faces' normal (a node translation), so
 *   the larger part wins the depth test. Repeats until no fight is left.
 * - skinned meshes (avatar parts and skins) store normals as int8, UVs as
 *   uint16 and rigid (0 or 1) skin weights as uint8, all normalized under
 *   KHR_mesh_quantization: exact for voxel normals and rigid weights; part
 *   files come out about 40% smaller.
 * - the scene carries `extras.rvx.scale`, the asset's world scale class.
 * Idempotent: finalizing a finalized file changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { Accessor, TextureInfo, type Document, type Mesh, type Node, type Primitive } from '@gltf-transform/core'
import { KHRMeshQuantization } from '@gltf-transform/extensions'
import { createIo } from '../gltfIo'
import { coplanarOverlaps } from '../validate/zfight'

const io = createIo()

/** Positions are stored in steps of 1 / n voxel, n the first of these that is exact for the mesh. */
export const POSITION_STEPS = [2, 4, 8, 16, 32, 64] as const
/** How far (voxels) the smaller of two fighting parts moves back: clear of the depth test, too small to see. */
export const PART_INSET = 1 / 16
/** Name suffix of the child node that holds a quantized mesh. */
export const QUANTIZED_NODE_SUFFIX = '-voxels'

function defined<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`glTF constant ${name} is undefined`)
  return value
}

const NEAREST_MAG = defined(TextureInfo.MagFilter.NEAREST, 'MagFilter.NEAREST')
const NEAREST_MIN = defined(TextureInfo.MinFilter.NEAREST, 'MinFilter.NEAREST')
const CLAMP = defined(TextureInfo.WrapMode.CLAMP_TO_EDGE, 'WrapMode.CLAMP_TO_EDGE')

export interface FinalizeOptions {
  /** World scale class (contracts/data/scale.json); omitted for avatar-space assets. */
  scale?: string
  /** Quantize meshes; only for world-space assets, whose voxels are 1 unit. */
  quantize?: boolean
  /**
   * Voxel size in model units, to inset fighting parts (1 for world assets,
   * 0.01 for held items); omitted = no inset (avatar part files, whose parts
   * overlap by design).
   */
  insetUnit?: number
}

function replaceAttribute(doc: Document, prim: Primitive, semantic: string, array: Int8Array | Uint8Array | Int16Array | Uint16Array, normalized: boolean): void {
  const old = prim.getAttribute(semantic)
  if (!old) throw new Error(`primitive has no ${semantic}`)
  const next = doc.createAccessor().setType(old.getType()).setArray(array).setNormalized(normalized).setBuffer(old.getBuffer())
  prim.setAttribute(semantic, next)
  if (old.listParents().every((parent) => parent === doc.getRoot())) old.dispose()
}

function quantizePrimitive(doc: Document, mesh: Mesh, prim: Primitive, steps: number): void {
  const position = prim.getAttribute('POSITION')
  const normal = prim.getAttribute('NORMAL')
  const uv = prim.getAttribute('TEXCOORD_0')
  if (!position || !normal || !uv) throw new Error(`mesh "${mesh.getName()}" needs POSITION, NORMAL and TEXCOORD_0`)
  if (position.getComponentType() !== Accessor.ComponentType.FLOAT) throw new Error(`mesh "${mesh.getName()}" is already quantized`)

  const p = position.getArray()!
  const q = new Int16Array(p.length)
  for (let i = 0; i < p.length; i += 1) {
    const v = p[i]! * steps
    const r = Math.round(v)
    if (Math.abs(r) > 32767) throw new Error(`mesh "${mesh.getName()}" is too large for int16 positions`)
    q[i] = r
  }
  replaceAttribute(doc, prim, 'POSITION', q, false)

  const n = normal.getArray()!
  const qn = new Int8Array(n.length)
  for (let i = 0; i < n.length; i += 1) qn[i] = Math.round(n[i]! * 127)
  replaceAttribute(doc, prim, 'NORMAL', qn, true)

  const t = uv.getArray()!
  const qt = new Uint16Array(t.length)
  for (let i = 0; i < t.length; i += 1) qt[i] = Math.round(t[i]! * 65535)
  replaceAttribute(doc, prim, 'TEXCOORD_0', qt, true)
}

/** Compact vertex attributes of skinned meshes (positions stay float: a skin ignores its node transform). */
function compactSkinnedMeshes(doc: Document): void {
  const root = doc.getRoot()
  const skinned = new Set(root.listNodes().filter((node) => node.getSkin() && node.getMesh()).map((node) => node.getMesh()!))
  let compacted = false
  for (const mesh of skinned) {
    for (const prim of mesh.listPrimitives()) {
      const normal = prim.getAttribute('NORMAL')
      if (normal && normal.getComponentType() === Accessor.ComponentType.FLOAT) {
        const n = normal.getArray()!
        const qn = new Int8Array(n.length)
        for (let i = 0; i < n.length; i += 1) qn[i] = Math.round(n[i]! * 127)
        replaceAttribute(doc, prim, 'NORMAL', qn, true)
        compacted = true
      }
      const uv = prim.getAttribute('TEXCOORD_0')
      if (uv && uv.getComponentType() === Accessor.ComponentType.FLOAT) {
        const t = uv.getArray()!
        const qt = new Uint16Array(t.length)
        for (let i = 0; i < t.length; i += 1) {
          if (t[i]! < 0 || t[i]! > 1) throw new Error(`mesh "${mesh.getName()}" has a UV outside 0..1`)
          qt[i] = Math.round(t[i]! * 65535)
        }
        replaceAttribute(doc, prim, 'TEXCOORD_0', qt, true)
        compacted = true
      }
      const weights = prim.getAttribute('WEIGHTS_0')
      if (weights && weights.getComponentType() === Accessor.ComponentType.FLOAT) {
        const w = weights.getArray() as Float32Array
        // Only rigid skinning packs exactly; blended weights stay float.
        if (w.every((x) => Math.abs(x) < 1e-6 || Math.abs(x - 1) < 1e-6)) {
          replaceAttribute(doc, prim, 'WEIGHTS_0', Uint8Array.from(w, (x: number) => (x > 0.5 ? 255 : 0)), true)
          compacted = true
        }
      }
    }
  }
  if (compacted) doc.createExtension(KHRMeshQuantization).setRequired(true)
}

/** The coarsest step count for which every position is a whole number of steps within int16, or null. */
function gridSteps(mesh: Mesh): number | null {
  const steps: number | undefined = POSITION_STEPS.find((n) =>
    mesh.listPrimitives().every((prim) => {
      const p = prim.getAttribute('POSITION')?.getArray()
      if (!p) return false
      for (let i = 0; i < p.length; i += 1) {
        const v = p[i]! * n
        if (Math.abs(v - Math.round(v)) > 1e-3 || Math.abs(v) > 32767) return false
      }
      return true
    }),
  )
  return steps ?? null
}

/**
 * Meshes off the half-voxel grid stay float, so the file is still correct;
 * the validator's voxel.grid rule then reports them.
 */
function quantizeMeshes(doc: Document): void {
  const root = doc.getRoot()
  const nodes = root.listNodes()
  for (const mesh of root.listMeshes()) {
    const users = nodes.filter((node) => node.getMesh() === mesh)
    if (users.some((node) => node.getSkin())) continue
    const prims = mesh.listPrimitives()
    if (prims.every((prim) => prim.getAttribute('POSITION')?.getComponentType() !== Accessor.ComponentType.FLOAT)) continue
    const steps = gridSteps(mesh)
    if (steps === null) continue
    for (const prim of prims) quantizePrimitive(doc, mesh, prim, steps)
    for (const node of users) {
      const holder = doc
        .createNode(`${node.getName()}${QUANTIZED_NODE_SUFFIX}`)
        .setScale([1 / steps, 1 / steps, 1 / steps])
        .setMesh(mesh)
      node.setMesh(null)
      node.addChild(holder)
    }
  }
  if (root.listMeshes().some((mesh) => mesh.listPrimitives().some((prim) => prim.getAttribute('POSITION')?.getComponentType() !== Accessor.ComponentType.FLOAT))) {
    doc.createExtension(KHRMeshQuantization).setRequired(true)
  }
}

/** A mesh node's own bounds (mesh space) and the linear part of its world matrix as rows. */
function meshFrame(node: Node): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const v = [0, 0, 0]
  for (const prim of node.getMesh()!.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')!
    for (let i = 0; i < pos.getCount(); i += 1) {
      pos.getElement(i, v)
      for (let r = 0; r < 3; r += 1) {
        min[r] = Math.min(min[r]!, v[r]!)
        max[r] = Math.max(max[r]!, v[r]!)
      }
    }
  }
  return { min, max }
}

/** Volume of a node's mesh bounds in model units. */
function worldVolume(node: Node): number {
  const { min, max } = meshFrame(node)
  const m = node.getWorldMatrix()
  const scale = [0, 1, 2].map((c) => Math.hypot(m[c * 4]!, m[c * 4 + 1]!, m[c * 4 + 2]!))
  return [0, 1, 2].reduce((vol, r) => vol * Math.max(1e-6, (max[r]! - min[r]!) * scale[r]!), 1)
}

/** A plain (unrotated, childless) holder for a node's mesh, made if the node is not one. */
function holderOf(doc: Document, node: Node): Node {
  const plain = node.listChildren().length === 0 && node.getRotation().every((q, i) => Math.abs(q - (i === 3 ? 1 : 0)) < 1e-9)
  if (plain && (node.getName().endsWith(QUANTIZED_NODE_SUFFIX) || node.getName().endsWith('-inset'))) return node
  const holder = doc.createNode(`${node.getName()}-inset`).setMesh(node.getMesh())
  node.setMesh(null)
  node.addChild(holder)
  return holder
}

/**
 * Moves a holder's faces off the fighting planes, by `step` model units:
 * - a world axis the part fights on at both ends (its left and right sides):
 *   shrink the mesh along it about its centre, so both end faces move in;
 * - any other fight normal n: move the mesh by -n, so that face moves back
 *   wherever it lies in the mesh.
 */
function separate(holder: Node, normals: number[][], step: number): void {
  const pm = holder.getParentNode()?.getWorldMatrix() ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  // The holder has no rotation; its parent maps holder axes to world axes (maybe rotated).
  const axes = [0, 1, 2].map((c) => [pm[c * 4]!, pm[c * 4 + 1]!, pm[c * 4 + 2]!])
  const S = holder.getScale()
  const T = holder.getTranslation()
  const nextS = [...S] as [number, number, number]
  const nextT = [...T] as [number, number, number]
  const { min, max } = meshFrame(holder)
  const matched = new Set<number>()
  const along = (n: number[]) => axes.findIndex((a) => Math.abs(n[0]! * a[0]! + n[1]! * a[1]! + n[2]! * a[2]!) / Math.hypot(a[0]!, a[1]!, a[2]!) > 0.999)
  for (let i = 0; i < normals.length; i += 1) {
    for (let j = i + 1; j < normals.length; j += 1) {
      const a = normals[i]!
      const b = normals[j]!
      const axis = along(a)
      if (axis >= 0 && a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! < -0.999 && !matched.has(i) && !matched.has(j)) {
        matched.add(i)
        matched.add(j)
        const unit = Math.hypot(...axes[axis]!) * S[axis]!
        const size = (max[axis]! - min[axis]!) * unit
        if (size <= 4 * step) continue
        const k = (size - 2 * step) / size
        const c = (min[axis]! + max[axis]!) / 2
        nextS[axis] = S[axis]! * k
        nextT[axis] = T[axis]! + S[axis]! * c * (1 - k)
      }
    }
  }
  for (let i = 0; i < normals.length; i += 1) {
    if (matched.has(i)) continue
    const n = normals[i]!
    // World delta -n·step into parent space: component along each parent axis over its length².
    for (let r = 0; r < 3; r += 1) {
      const a = axes[r]!
      const l2 = a[0]! * a[0]! + a[1]! * a[1]! + a[2]! * a[2]!
      nextT[r] = nextT[r]! - (step * (n[0]! * a[0]! + n[1]! * a[1]! + n[2]! * a[2]!)) / l2
    }
  }
  holder.setScale(nextS).setTranslation(nextT)
}

/**
 * For every pair of parts that fight, moves the smaller part's faces
 * PART_INSET voxel off the fighting planes (see separate), so the larger
 * part wins the depth test. Repeats until no fight is left between parts
 * (or the round limit).
 */
function separateFightingParts(doc: Document, unit: number): void {
  const byName = new Map(doc.getRoot().listNodes().filter((n) => n.getMesh()).map((n) => [n.getName(), n]))
  for (let round = 0; round < 6; round += 1) {
    const fights = coplanarOverlaps(doc, unit).filter((o) => o.facing === 'same' && o.nodes[0] !== o.nodes[1] && o.mismatch > 0)
    if (fights.length === 0) return
    const pairs = new Map<string, { nodes: [string, string]; normals: number[][] }>()
    for (const fight of fights) {
      const key = [...fight.nodes].sort().join('|')
      const entry = pairs.get(key) ?? { nodes: fight.nodes, normals: [] }
      if (!entry.normals.some((n) => n[0]! * fight.normal[0] + n[1]! * fight.normal[1] + n[2]! * fight.normal[2] > 0.999)) entry.normals.push(fight.normal)
      pairs.set(key, entry)
    }
    for (const { nodes, normals } of pairs.values()) {
      const [a, b] = nodes.map((name) => byName.get(name)) as [Node | undefined, Node | undefined]
      if (!a || !b || a.getSkin() || b.getSkin()) continue
      const target = worldVolume(a) <= worldVolume(b) ? a : b
      const holder = holderOf(doc, target)
      separate(holder, normals, PART_INSET * unit)
      // The fight names the mesh's node; after a move that is the holder, under either name.
      byName.set(holder.getName(), holder)
      byName.set(target.getName(), holder)
    }
  }
}

export async function finalizeGlb(path: string, options: FinalizeOptions = {}): Promise<void> {
  const doc = await io.readBinary(new Uint8Array(readFileSync(path)))
  for (const material of doc.getRoot().listMaterials()) {
    const info = material.getBaseColorTextureInfo()
    if (!info) continue
    info.setMagFilter(NEAREST_MAG)
    info.setMinFilter(NEAREST_MIN)
    info.setWrapS(CLAMP)
    info.setWrapT(CLAMP)
  }
  if (options.quantize) quantizeMeshes(doc)
  compactSkinnedMeshes(doc)
  if (options.insetUnit) separateFightingParts(doc, options.insetUnit)
  if (options.scale) {
    for (const scene of doc.getRoot().listScenes()) scene.setExtras({ ...scene.getExtras(), rvx: { scale: options.scale } })
  }
  doc.getRoot().getAsset().generator = 'run-voxel-packs (Blender glTF exporter + finalize)'
  writeFileSync(path, await io.writeBinary(doc))
}
