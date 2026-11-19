import { readFileSync } from 'node:fs'

export interface GlbNode {
  name?: string
  mesh?: number
  skin?: number
  children?: number[]
  translation?: [number, number, number]
  rotation?: [number, number, number, number]
  scale?: [number, number, number]
  matrix?: number[]
  extras?: unknown
}

export interface GlbPrimitive {
  attributes: Record<string, number>
  indices?: number
  material?: number
  targets?: Record<string, number>[]
}

export interface GlbDocument {
  nodes?: GlbNode[]
  meshes?: { name?: string; primitives: GlbPrimitive[]; extras?: { targetNames?: string[] } }[]
  skins?: { name?: string; joints: number[]; inverseBindMatrices?: number }[]
  animations?: { name?: string }[]
  materials?: { name?: string }[]
  accessors?: {
    bufferView?: number
    byteOffset?: number
    componentType: number
    count: number
    type: string
  }[]
  bufferViews?: {
    byteOffset?: number
    byteLength: number
    byteStride?: number
  }[]
}

export interface ParsedGlb {
  doc: GlbDocument
  bin: Buffer
  byteLength: number
}

export function parseGlb(path: string): ParsedGlb {
  const buf = readFileSync(path)
  if (buf.length < 28 || buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(4) !== 2) {
    throw new Error(`Invalid GLB header: ${path}`)
  }
  const jsonLen = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error(`Missing GLB JSON chunk: ${path}`)
  }
  const doc = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GlbDocument
  const binOff = 20 + jsonLen
  const binLen = buf.readUInt32LE(binOff)
  if (buf.readUInt32LE(binOff + 4) !== 0x004e4942) {
    throw new Error(`Missing GLB BIN chunk: ${path}`)
  }
  const bin = buf.subarray(binOff + 8, binOff + 8 + binLen)
  return { doc, bin, byteLength: buf.length }
}

const COMP_INFO: Record<number, { size: number; read: (b: Buffer, o: number) => number }> = {
  5120: { size: 1, read: (b, o) => b.readInt8(o) },
  5121: { size: 1, read: (b, o) => b.readUInt8(o) },
  5122: { size: 2, read: (b, o) => b.readInt16LE(o) },
  5123: { size: 2, read: (b, o) => b.readUInt16LE(o) },
  5125: { size: 4, read: (b, o) => b.readUInt32LE(o) },
  5126: { size: 4, read: (b, o) => b.readFloatLE(o) },
}

const TYPE_COUNTS: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT4: 16,
}

export function readAccessor(glb: ParsedGlb, accessorIndex: number): number[][] {
  const acc = glb.doc.accessors?.[accessorIndex]
  if (!acc || acc.bufferView === undefined) throw new Error(`Invalid accessor ${accessorIndex}`)
  const view = glb.doc.bufferViews?.[acc.bufferView]
  if (!view) throw new Error(`Missing bufferView ${acc.bufferView}`)
  const info = COMP_INFO[acc.componentType]
  const count = TYPE_COUNTS[acc.type]
  if (!info || !count) throw new Error(`Unsupported accessor format ${acc.componentType}/${acc.type}`)
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const stride = view.byteStride ?? info.size * count
  const rows: number[][] = []
  for (let i = 0; i < acc.count; i++) {
    const row: number[] = []
    for (let c = 0; c < count; c++) {
      row.push(info.read(glb.bin, base + i * stride + c * info.size))
    }
    rows.push(row)
  }
  return rows
}

export function nodeTriangleCount(glb: ParsedGlb, node: GlbNode): number {
  if (node.mesh === undefined) return 0
  const mesh = glb.doc.meshes?.[node.mesh]
  if (!mesh) return 0
  let tris = 0
  for (const prim of mesh.primitives) {
    if (prim.indices !== undefined) {
      tris += Math.floor((glb.doc.accessors?.[prim.indices]?.count ?? 0) / 3)
    } else if (prim.attributes.POSITION !== undefined) {
      tris += Math.floor((glb.doc.accessors?.[prim.attributes.POSITION]?.count ?? 0) / 3)
    }
  }
  return tris
}

export function isIdentityTransform(node: GlbNode, eps = 1e-4): boolean {
  if (node.matrix) {
    const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    return node.matrix.every((v, i) => Number.isFinite(v) && Math.abs(v - id[i]!) <= eps)
  }
  const t = node.translation ?? [0, 0, 0]
  const r = node.rotation ?? [0, 0, 0, 1]
  const s = node.scale ?? [1, 1, 1]
  const rNorm = r[3] < 0 ? r.map((v) => -v) : r
  return (
    t.every((v) => Number.isFinite(v) && Math.abs(v) <= eps) &&
    [0, 0, 0, 1].every((target, i) => Number.isFinite(rNorm[i]!) && Math.abs(rNorm[i]! - target) <= eps) &&
    s.every((v) => Number.isFinite(v) && Math.abs(v - 1) <= eps)
  )
}
