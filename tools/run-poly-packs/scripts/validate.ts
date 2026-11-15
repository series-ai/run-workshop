import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { BUDGETS } from '../contracts/budgets'
import { packCatalogSchema, type AvatarPartEntry } from '../contracts/catalog'
import { leavesFor, POLY_PACK_KEYS } from '../contracts/packs'
import { UAL1_CLIPS, UAL1_JOINTS } from '../contracts/rig'
import { isIdentityTransform, nodeTriangleCount, parseGlb, readAccessor, type ParsedGlb } from '../src/glbInspect'
import { META_DIR, STAGE_DIR } from '../src/paths'

const buildManifestSchema = z.object({
  version: z.literal(1),
  packs: z.array(packCatalogSchema),
})

function assertFiniteWeightsAndPositions(glb: ParsedGlb, nodeName: string, isSkinned: boolean): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined) throw new Error(`Missing mesh node "${nodeName}"`)
  if (isSkinned && !isIdentityTransform(node)) {
    throw new Error(`Skinned node "${nodeName}" must have an identity local transform`)
  }
  const mesh = glb.doc.meshes?.[node.mesh]
  if (!mesh || mesh.primitives.length === 0) throw new Error(`Mesh "${nodeName}" has no primitives`)
  if (mesh.primitives.length > 1) {
    throw new Error(`Mesh "${nodeName}" has ${mesh.primitives.length} primitives (must be 1 shared material for S23 Ultra draw-call budget)`)
  }
  const prim = mesh.primitives[0]!
  const posIdx = prim.attributes.POSITION
  if (posIdx === undefined) throw new Error(`Mesh "${nodeName}" missing POSITION`)
  const positions = readAccessor(glb, posIdx)
  for (const row of positions) {
    if (row.some((v) => !Number.isFinite(v))) throw new Error(`Mesh "${nodeName}" has non-finite position`)
  }
  const uvIdx = prim.attributes.TEXCOORD_0
  if (uvIdx === undefined) throw new Error(`Mesh "${nodeName}" missing TEXCOORD_0 for 6-region UV palette`)
  const uvs = readAccessor(glb, uvIdx)
  for (const [u, v] of uvs) {
    if (!Number.isFinite(u) || !Number.isFinite(v) || u! < -0.01 || u! > 1.01 || v! < -0.01 || v! > 1.01) {
      throw new Error(`Mesh "${nodeName}" has out-of-range UV (${u}, ${v})`)
    }
  }
  if (isSkinned) {
    if (node.skin === undefined) throw new Error(`Part "${nodeName}" must reference a skin`)
    const jIdx = prim.attributes.JOINTS_0
    const wIdx = prim.attributes.WEIGHTS_0
    if (jIdx === undefined || wIdx === undefined) throw new Error(`Part "${nodeName}" missing JOINTS_0 or WEIGHTS_0`)
    const joints = readAccessor(glb, jIdx)
    const weights = readAccessor(glb, wIdx)
    for (let i = 0; i < weights.length; i++) {
      const wRow = weights[i]!
      const jRow = joints[i]!
      const sum = wRow.reduce((a, b) => a + b, 0)
      if (!Number.isFinite(sum) || Math.abs(sum - 1) > 1e-3 || wRow.some((w) => w < -1e-6)) {
        throw new Error(`Part "${nodeName}" vertex ${i} has unnormalized weights (sum=${sum})`)
      }
      if (jRow.some((j) => j < 0 || j >= 53)) {
        throw new Error(`Part "${nodeName}" vertex ${i} references out-of-range joint`)
      }
    }
  }
}

function assertUal1Skeleton(glb: ParsedGlb, fileLabel: string): void {
  const skins = glb.doc.skins ?? []
  if (skins.length !== 1) throw new Error(`${fileLabel}: expected exactly 1 skin, found ${skins.length}`)
  const joints = skins[0]!.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  if (joints.length !== UAL1_JOINTS.length) {
    throw new Error(`${fileLabel}: expected ${UAL1_JOINTS.length} joints, found ${joints.length}`)
  }
  for (let i = 0; i < UAL1_JOINTS.length; i++) {
    if (joints[i] !== UAL1_JOINTS[i]) {
      throw new Error(`${fileLabel}: joint[${i}] is "${joints[i]}", expected "${UAL1_JOINTS[i]}"`)
    }
  }
}

function main(): void {
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error(`Missing build manifest: ${manifestPath}. Run npm run build first.`)
  const manifest = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))

  let totalModels = 0
  let totalParts = 0

  for (const pack of POLY_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const licPath = join(STAGE_DIR, leaf.id, 'License.txt')
      if (!existsSync(licPath)) throw new Error(`Missing License.txt in ${leaf.id}`)
    }
  }

  for (const cat of manifest.packs) {
    const charLeafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === 'characters')!.id)
    if (cat.pack === 'core') {
      if (!cat.rigModelPath) throw new Error('core pack missing rigModelPath')
      const rigPath = join(charLeafDir, cat.rigModelPath)
      const glb = parseGlb(rigPath)
      assertUal1Skeleton(glb, rigPath)
      const anims = new Set((glb.doc.animations ?? []).map((a) => a.name ?? ''))
      for (const reqClip of UAL1_CLIPS) {
        if (!anims.has(reqClip)) throw new Error(`core-rig.glb missing required UAL1 clip "${reqClip}"`)
      }
      if ((glb.doc.materials?.length ?? 0) > 1) {
        throw new Error(`core-rig.glb has ${glb.doc.materials?.length} materials; S23 Ultra budget allows 1`)
      }
    }

    const partsBySlot = new Map<string, AvatarPartEntry[]>()
    const glbCache = new Map<string, ParsedGlb>()
    const loadCached = (leafKind: 'characters' | 'world', rel: string): ParsedGlb => {
      const leafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === leafKind)!.id)
      const full = join(leafDir, rel)
      let hit = glbCache.get(full)
      if (!hit) {
        hit = parseGlb(full)
        glbCache.set(full, hit)
      }
      return hit
    }

    for (const part of cat.parts) {
      totalParts++
      const glb = loadCached(part.leaf, part.relativePath)
      assertUal1Skeleton(glb, part.relativePath)
      assertFiniteWeightsAndPositions(glb, part.nodeName, true)
      const node = glb.doc.nodes!.find((n) => n.name === part.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      const budget = BUDGETS.classes[part.slot]
      if (tris > budget.maxTriangles) {
        throw new Error(`Part "${part.id}" has ${tris} tris > budget ${budget.maxTriangles}`)
      }
      const arr = partsBySlot.get(part.slot) ?? []
      arr.push(part)
      partsBySlot.set(part.slot, arr)
    }

    for (const held of cat.heldItems) {
      totalModels++
      const glb = loadCached(held.leaf, held.relativePath)
      assertFiniteWeightsAndPositions(glb, held.nodeName, false)
      const node = glb.doc.nodes!.find((n) => n.name === held.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      if (tris > BUDGETS.classes.held.maxTriangles) {
        throw new Error(`Held "${held.id}" has ${tris} tris > budget ${BUDGETS.classes.held.maxTriangles}`)
      }
      const bytes = statSync(join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === held.leaf)!.id, held.relativePath)).size
      if (bytes > (BUDGETS.classes.held.maxBytes ?? Infinity)) {
        throw new Error(`Held "${held.id}" is ${bytes} bytes > budget`)
      }
    }

    for (const prop of cat.props) {
      totalModels++
      const glb = loadCached(prop.leaf, prop.relativePath)
      assertFiniteWeightsAndPositions(glb, prop.nodeName, false)
      const node = glb.doc.nodes!.find((n) => n.name === prop.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      if (tris > BUDGETS.classes.prop.maxTriangles) {
        throw new Error(`Prop "${prop.id}" has ${tris} tris > budget ${BUDGETS.classes.prop.maxTriangles}`)
      }
      if (Math.abs(prop.bounds.min[1]) > 0.015) {
        throw new Error(`Prop "${prop.id}" not grounded on y=0 (min.y=${prop.bounds.min[1]})`)
      }
    }

    // Check worst-case composed avatar triangle budget for context packs
    for (const preset of cat.presets) {
      const partIds = [preset.body, preset.head, preset.hair, preset.torso, preset.legs, preset.headwear, preset.back].filter(
        (x): x is string => Boolean(x),
      )
      const allParts = manifest.packs.flatMap((p) => p.parts)
      const sum = partIds.reduce((acc, id) => {
        const found = allParts.find((p) => p.id === id)
        if (!found) throw new Error(`Preset "${preset.id}" references missing part "${id}"`)
        return acc + found.triangles
      }, 0)
      if (sum > BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar) {
        throw new Error(`Preset "${preset.id}" composed triangles (${sum}) exceed S23 Ultra cap (${BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar})`)
      }
    }
  }

  console.log(`Validation passed: ${manifest.packs.length} packs, ${totalParts} avatar parts, ${totalModels} held/world models.`)
}

main()
