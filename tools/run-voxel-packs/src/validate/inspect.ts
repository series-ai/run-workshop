/**
 * Reads a GLB into the plain summary the contract rules check. All glTF
 * access happens here; the rules stay pure functions over `GlbSummary`.
 */
import { getBounds, type Document, type Node } from '@gltf-transform/core'
import { PNG } from 'pngjs'
import { createIo } from '../gltfIo'
import { coplanarOverlaps, layerMisfits } from './zfight'
import { AVATAR_LAYER_VOXELS, parsePartNodeName } from '../../contracts/catalog'
import { POSITION_STEPS, QUANTIZED_NODE_SUFFIX } from '../build/finalize'

export interface SamplerSummary {
  magFilter: number | null
  minFilter: number | null
  wrapS: number
  wrapT: number
}

export interface MaterialSummary {
  name: string
  metallic: number
  roughness: number
  /** Width × height of the base color image, or null without a texture. */
  baseColorSize: [number, number] | null
  baseColorMime: string | null
  sampler: SamplerSummary | null
}

export interface SkinSummary {
  joints: string[]
  inverseBindMatrices: number[][]
  /** Per joint: rest world matrix (column-major) and the nearest ancestor that is also a joint. */
  worldMatrices: number[][]
  jointParents: (string | null)[]
}

export interface PrimitiveSummary {
  mesh: string
  /** Index into `materials`, or -1 when the primitive has no material. */
  material: number
  /** Every UV sits on a palette texel centre ((k + 0.5) / 256, 0.5). */
  paletteUvs: boolean
}

export interface AnimationSummary {
  name: string
  /** Names of the nodes the channels drive. */
  targets: string[]
  duration: number
  /**
   * The worst loop seam: how far a channel's last value is from its first
   * (rotation: degrees; translation: model units; scale: factor), with the
   * channel as `node.path`. Null when every channel ends where it starts.
   */
  seam: { channel: string; gap: number; path: 'rotation' | 'translation' | 'scale' } | null
}

/** Area-weighted surface measures of the painted texture (art direction rules F1, F2, C2). */
export interface SurfaceStats {
  triangles: number
  /** Share of surface area on faces that are not axis-aligned (diagonals). */
  diagonalShare: number
  /** Area-weighted median of world units per texel. */
  unitsPerTexel: number
  /** Share of painted area darker than HSV value 0.25. */
  darkShare: number
  /** Area-weighted mean HSV saturation of the painted area. */
  meanSaturation: number
}

export interface GlbSummary {
  materials: MaterialSummary[]
  primitives: PrimitiveSummary[]
  meshCount: number
  nodeNames: string[]
  skins: SkinSummary[]
  animations: AnimationSummary[]
  bounds: { min: [number, number, number]; max: [number, number, number] } | null
  vertexCount: number
  /** `extras.rvx.scale` of the default scene: the world scale class, if set. */
  scaleClass: string | null
  /** Null when no primitive samples a PNG texture. */
  surface: SurfaceStats | null
  /**
   * Visible z-fighting (src/validate/zfight.ts), in voxel²: the sum over node
   * pairs, or for avatar files (alternative parts, one shown per slot) the
   * worst part; `worst` names the worst node pair. Null unless asked for.
   */
  zfight: { area: number; worst: string | null } | null
  /**
   * Avatar part files (every mesh node named `<slot> …`): face area, in
   * voxel², that is not on its slot's layer (AVATAR_LAYER_VOXELS). Null for
   * every other file.
   */
  layers: { misfit: number; worst: string | null } | null
  /**
   * Nodes scaled away from 1 (or a quantization holder's 1/n) by more than
   * finalize's z-fight inset. A scaled part shows bigger or smaller voxels
   * than the rest of the pack.
   */
  scaledNodes: string[]
}

const io = createIo()

function pngSize(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0) !== 0x89504e47) throw new Error('base color image is not a PNG')
  return [view.getUint32(16), view.getUint32(20)]
}

export async function readGlb(bytes: Uint8Array): Promise<Document> {
  return io.readBinary(bytes)
}

export function summarize(doc: Document, options: { zfight?: boolean } = {}): GlbSummary {
  const root = doc.getRoot()
  const materials = root.listMaterials().map((material): MaterialSummary => {
    const texture = material.getBaseColorTexture()
    const info = material.getBaseColorTextureInfo()
    const image = texture?.getImage() ?? null
    const mime = texture?.getMimeType() ?? null
    return {
      name: material.getName(),
      metallic: material.getMetallicFactor(),
      roughness: material.getRoughnessFactor(),
      baseColorSize: image && mime === 'image/png' ? pngSize(image) : null,
      baseColorMime: mime,
      sampler: info
        ? {
            magFilter: info.getMagFilter(),
            minFilter: info.getMinFilter(),
            wrapS: info.getWrapS(),
            wrapT: info.getWrapT(),
          }
        : null,
    }
  })

  const skins = root.listSkins().map((skin): SkinSummary => {
    const joints = skin.listJoints()
    const array = skin.getInverseBindMatrices()?.getArray()
    if (!array) throw new Error(`skin "${skin.getName()}" has no inverse bind matrices`)
    const jointSet = new Set(joints)
    const parentOf = (node: Node): Node | null => root.listNodes().find((n) => n.listChildren().includes(node)) ?? null
    return {
      joints: joints.map((joint) => joint.getName()),
      inverseBindMatrices: joints.map((_, i) => Array.from(array.slice(i * 16, i * 16 + 16))),
      worldMatrices: joints.map((joint) => Array.from(joint.getWorldMatrix())),
      jointParents: joints.map((joint) => {
        for (let p = parentOf(joint); p; p = parentOf(p)) if (jointSet.has(p)) return p.getName()
        return null
      }),
    }
  })

  const animations = root.listAnimations().map((animation): AnimationSummary => {
    let duration = 0
    for (const sampler of animation.listSamplers()) {
      const input = sampler.getInput()?.getArray()
      if (input && input.length > 0) duration = Math.max(duration, input[input.length - 1] ?? 0)
    }
    const targets = new Set<string>()
    let seam: AnimationSummary['seam'] = null
    const tolerance = { rotation: 1, translation: 0.02, scale: 0.01 }
    for (const channel of animation.listChannels()) {
      const node: Node | null = channel.getTargetNode()
      if (node) targets.add(node.getName())
      const path = channel.getTargetPath() as 'rotation' | 'translation' | 'scale' | 'weights'
      const output = channel.getSampler()?.getOutput()
      if (!node || !output || path === 'weights' || output.getCount() < 2) continue
      const a = output.getElement(0, [])
      const b = output.getElement(output.getCount() - 1, [])
      const gap =
        path === 'rotation'
          ? (2 * Math.acos(Math.min(1, Math.abs(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!))) * 180) / Math.PI
          : Math.hypot(...a.map((v, i) => v - b[i]!))
      // Translation is judged relative to the node's scale-space unit by the rule; keep the raw gap here.
      if (gap > tolerance[path] && (!seam || gap / tolerance[path] > seam.gap / tolerance[seam.path])) seam = { channel: `${node.getName()}.${path}`, gap, path }
    }
    return { name: animation.getName(), targets: [...targets], duration, seam }
  })

  const materialList = root.listMaterials()
  const primitives: PrimitiveSummary[] = []
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const material = primitive.getMaterial()
      const uv = primitive.getAttribute('TEXCOORD_0')
      let paletteUvs = !!uv && uv.getCount() > 0
      const e: number[] = [0, 0]
      for (let i = 0; uv && i < uv.getCount() && paletteUvs; i += 1) {
        uv.getElement(i, e) // decodes normalized (quantized) UVs
        const u = e[0]! * 256 - 0.5
        // 0.01 texel: uint16-quantized UVs land within 0.002 texel of the centre.
        if (!Number.isFinite(u) || Math.abs(u - Math.round(u)) > 1e-2 || Math.abs(e[1]! - 0.5) > 1e-3) paletteUvs = false
      }
      primitives.push({ mesh: mesh.getName(), material: material ? materialList.indexOf(material) : -1, paletteUvs })
    }
  }

  let vertexCount = 0
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      vertexCount += primitive.getAttribute('POSITION')?.getCount() ?? 0
    }
  }

  const scene = root.getDefaultScene() ?? root.listScenes()[0]
  let bounds: GlbSummary['bounds'] = null
  if (scene && root.listMeshes().length > 0) {
    // Unskinned files: exact bounds of the world-space vertices (tilted parts
    // would inflate a box of transformed corners). Skinned files keep the
    // accessor bounds, as the PN rig tools expect.
    const box = root.listSkins().length === 0 ? vertexBounds(doc) : getBounds(scene)
    bounds = {
      min: [box.min[0], box.min[1], box.min[2]],
      max: [box.max[0], box.max[1], box.max[2]],
    }
  }

  const surface = surfaceStats(doc)
  const extras = (root.getDefaultScene() ?? root.listScenes()[0])?.getExtras() as { rvx?: { scale?: unknown } } | undefined
  const scaleClass = typeof extras?.rvx?.scale === 'string' ? extras.rvx.scale : null
  // World assets carry a scale class (1 unit per voxel); avatar-space files are 0.01.
  // Avatar part files overlap parts of one slot by design: only a part against itself counts.
  const unit = scaleClass ? 1 : 0.01
  const pairs = new Map<string, number>()
  for (const o of options.zfight ? coplanarOverlaps(doc, unit, { sameNodeOnly: skins.length > 0 }) : []) {
    if (o.facing !== 'same' || o.mismatch === 0) continue
    const key = [...o.nodes].sort().join(' × ')
    pairs.set(key, (pairs.get(key) ?? 0) + (o.area * o.mismatch) / unit / unit)
  }
  const worst = [...pairs].sort((a, b) => b[1] - a[1])[0]
  // An avatar file holds alternative parts and shows one per slot, so its measure is the worst part; other files sum.
  const area = skins.length > 0 ? (worst?.[1] ?? 0) : [...pairs.values()].reduce((a, b) => a + b, 0)
  const zfight = options.zfight ? { area, worst: worst ? `${worst[0]} (${worst[1].toFixed(2)} voxel²)` : null } : null

  const meshNodes = root.listNodes().filter((node) => node.getMesh())
  const partFile = meshNodes.length > 0 && meshNodes.every((node) => /^[a-z]+ (?:[a-z]+-)?\d+$/.test(node.getName()))
  let layers: GlbSummary['layers'] = null
  if (partFile) {
    const misfits = [...layerMisfits(doc, 0.01, (name) => AVATAR_LAYER_VOXELS[parsePartNodeName(name).slot])].sort((a, b) => b[1].area - a[1].area)
    const top = misfits[0]
    layers = { misfit: misfits.reduce((a, [, m]) => a + m.area, 0), worst: top ? `${top[0]} (${top[1].area.toFixed(1)} voxel² at ${top[1].offset.toFixed(3)} voxel)` : null }
  }

  // Finalize scales two kinds of nodes on purpose: quantization holders (`-voxels`, 1/n) and fighting
  // parts it insets by 1/16 voxel (a scale a few percent under 1 on one axis). Anything else, or a
  // larger change, is a rescaled part.
  const INSET_TOLERANCE = 0.1
  const scaledNodes = root.listNodes().filter((node) => {
    const base = node.getName().endsWith(QUANTIZED_NODE_SUFFIX) ? POSITION_STEPS.map((n) => 1 / n) : [1]
    return node.getScale().some((x) => !base.some((b) => Math.abs(x / b - 1) <= INSET_TOLERANCE))
  }).map((node) => node.getName())

  return {
    scaleClass,
    surface,
    zfight,
    layers,
    scaledNodes,
    materials,
    primitives,
    meshCount: root.listMeshes().length,
    nodeNames: root.listNodes().map((node) => node.getName()),
    skins,
    animations,
    bounds,
    vertexCount,
  }
}

/** Exact world-space bounds of every mesh vertex at rest. */
export function vertexBounds(doc: Document): { min: [number, number, number]; max: [number, number, number] } {
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  const v = [0, 0, 0]
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      for (let i = 0; i < pos.getCount(); i += 1) {
        pos.getElement(i, v)
        for (let r = 0; r < 3; r += 1) {
          const w = m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]!
          if (w < min[r]!) min[r] = w
          if (w > max[r]!) max[r] = w
        }
      }
    }
  }
  return { min, max }
}

function hsv(r: number, g: number, b: number): [number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return [max === 0 ? 0 : (max - min) / max, max / 255]
}

/**
 * Walks every triangle once: counts triangles and diagonal area, measures
 * world units per texel, and rasterizes each triangle in texture space to
 * weigh the painted colours by the world area they cover.
 */
export function surfaceStats(doc: Document): SurfaceStats | null {
  const decoded = new Map<unknown, PNG>()
  let triangles = 0
  let area = 0
  let diagonal = 0
  let painted = 0
  let dark = 0
  let saturation = 0
  const density: [number, number][] = []
  const a = [0, 0, 0]
  const e = [0, 0]
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const m = node.getWorldMatrix()
    const world = (v: number[]) => [0, 1, 2].map((r) => m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]!)
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (!pos) continue
      const idx = prim.getIndices()
      const count = idx ? idx.getCount() : pos.getCount()
      const texture = prim.getMaterial()?.getBaseColorTexture()
      const uv = prim.getAttribute('TEXCOORD_0')
      let png: PNG | null = null
      if (texture && texture.getMimeType() === 'image/png') {
        png = decoded.get(texture) ?? PNG.sync.read(Buffer.from(texture.getImage()!))
        decoded.set(texture, png)
      }
      for (let i = 0; i + 2 < count; i += 3) {
        const P: number[][] = []
        const T: number[][] = []
        for (let k = 0; k < 3; k += 1) {
          const j = idx ? idx.getScalar(i + k) : i + k
          P.push(world(pos.getElement(j, a)))
          if (png && uv) {
            uv.getElement(j, e)
            T.push([e[0]! * png.width, e[1]! * png.height])
          }
        }
        const u = [0, 1, 2].map((q) => P[1]![q]! - P[0]![q]!)
        const v = [0, 1, 2].map((q) => P[2]![q]! - P[0]![q]!)
        const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]
        const len = Math.hypot(...n)
        if (len < 1e-9) continue
        const wa = len / 2
        triangles += 1
        area += wa
        if (!n.some((c) => Math.abs(c) / len > 0.999)) diagonal += wa
        if (!png || T.length !== 3) continue
        const ta = Math.abs((T[1]![0]! - T[0]![0]!) * (T[2]![1]! - T[0]![1]!) - (T[2]![0]! - T[0]![0]!) * (T[1]![1]! - T[0]![1]!)) / 2
        if (ta > 1e-9) density.push([Math.sqrt(wa / ta), wa])
        const area2 = (T[1]![0]! - T[0]![0]!) * (T[2]![1]! - T[0]![1]!) - (T[2]![0]! - T[0]![0]!) * (T[1]![1]! - T[0]![1]!)
        const texels: number[] = []
        if (Math.abs(area2) > 1e-9) {
          const x0 = Math.floor(Math.min(T[0]![0]!, T[1]![0]!, T[2]![0]!)), x1 = Math.ceil(Math.max(T[0]![0]!, T[1]![0]!, T[2]![0]!))
          const y0 = Math.floor(Math.min(T[0]![1]!, T[1]![1]!, T[2]![1]!)), y1 = Math.ceil(Math.max(T[0]![1]!, T[1]![1]!, T[2]![1]!))
          for (let y = y0; y < y1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
              const px = x + 0.5, py = y + 0.5
              const w0 = ((T[1]![0]! - px) * (T[2]![1]! - py) - (T[2]![0]! - px) * (T[1]![1]! - py)) / area2
              const w1 = ((T[2]![0]! - px) * (T[0]![1]! - py) - (T[0]![0]! - px) * (T[2]![1]! - py)) / area2
              if (w0 >= -1e-6 && w1 >= -1e-6 && 1 - w0 - w1 >= -1e-6) texels.push((Math.min(png.height - 1, Math.max(0, y)) * png.width + Math.min(png.width - 1, Math.max(0, x))) * 4)
            }
          }
        }
        if (texels.length === 0) {
          const cx = Math.min(png.width - 1, Math.max(0, Math.floor((T[0]![0]! + T[1]![0]! + T[2]![0]!) / 3)))
          const cy = Math.min(png.height - 1, Math.max(0, Math.floor((T[0]![1]! + T[1]![1]! + T[2]![1]!) / 3)))
          texels.push((cy * png.width + cx) * 4)
        }
        const w = wa / texels.length
        for (const o of texels) {
          const [sat, val] = hsv(png.data[o]!, png.data[o + 1]!, png.data[o + 2]!)
          painted += w
          saturation += sat * w
          if (val < 0.25) dark += w
        }
      }
    }
  }
  if (painted === 0 || area === 0) return null
  density.sort((x, y) => x[0] - y[0])
  const half = density.reduce((sum, d) => sum + d[1], 0) / 2
  let acc = 0
  let median = density[0]?.[0] ?? 0
  for (const [k, w] of density) {
    acc += w
    if (acc >= half) {
      median = k
      break
    }
  }
  return { triangles, diagonalShare: diagonal / area, unitsPerTexel: median, darkShare: dark / painted, meanSaturation: saturation / painted }
}

export async function inspectGlb(bytes: Uint8Array, options: { zfight?: boolean } = {}): Promise<GlbSummary> {
  return summarize(await readGlb(bytes), options)
}
