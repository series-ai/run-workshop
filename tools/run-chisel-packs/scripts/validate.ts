import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { AnimationMixer, Euler, Matrix4, Mesh, Quaternion, SkinnedMesh, Vector3, type Object3D } from 'three'
import { z } from 'zod'
import { BUDGETS } from '../contracts/budgets'
import { packCatalogSchema, type AvatarPartEntry, type AvatarProportions, type CharacterPreset, type HeldItemEntry, type PackCatalog } from '../contracts/catalog'
import { leavesFor, POLY_PACK_KEYS } from '../contracts/packs'
import { PALETTE_REGION_U } from '../contracts/palette'
import { armThicknessFactorFor, heldSocketOffsetFor, isArmShieldHeldItem } from '../contracts/proportions'
import { RAGDOLL_RIG_TEMPLATES } from '../contracts/ragdoll'
import { RIG_SPECS, UAL1_RIG, type RigId } from '../contracts/rig'
import {
  auditRigClips,
  createAuditProportionController,
  loadGlbHeadless,
  loadPresetForAudit,
  optimizeClipForAudit,
  serializeReportSummary,
  triTriIntersect,
} from '../src/animationAudit'
import { isIdentityTransform, nodeTriangleCount, parseGlb, readAccessor, type ParsedGlb } from '../src/glbInspect'
import { META_DIR, STAGE_DIR } from '../src/paths'

const buildManifestSchema = z.object({
  version: z.literal(1),
  packs: z.array(packCatalogSchema),
})

function assertFiniteWeightsAndPositions(glb: ParsedGlb, nodeName: string, isSkinned: boolean, jointCount: number): void {
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
  const normIdx = prim.attributes.NORMAL
  if (normIdx === undefined) throw new Error(`Mesh "${nodeName}" missing NORMAL`)
  const normals = readAccessor(glb, normIdx)
  for (const row of normals) {
    const len = Math.hypot(row[0] ?? 0, row[1] ?? 0, row[2] ?? 0)
    if (!Number.isFinite(len) || Math.abs(len - 1) > 0.05) {
      throw new Error(`Mesh "${nodeName}" has non-unit normal (len=${len})`)
    }
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
      if (jRow.some((j) => j < 0 || j >= jointCount)) {
        throw new Error(`Part "${nodeName}" vertex ${i} references out-of-range joint`)
      }
    }
  }
}

const partExtrasSchema = z
  .object({
    polyRegions: z.record(z.string(), z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).optional(),
    polyCovers: z.array(z.string().min(1)).optional(),
  })
  .passthrough()

/**
 * A part must not carry a region tag that it covers itself. The runtime removes every covered region,
 * so such a part removes its own boots or gauntlets.
 */
function assertNoSelfCover(glb: ParsedGlb, nodeName: string): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node) throw new Error(`Missing mesh node "${nodeName}"`)
  const extras = partExtrasSchema.parse(node.extras ?? {})
  const own = Object.keys(extras.polyRegions ?? {}).filter((tag) => (extras.polyCovers ?? []).includes(tag))
  if (own.length > 0) {
    throw new Error(`Part "${nodeName}" covers its own regions (${own.join(', ')}). The runtime then hides them.`)
  }
}

function collectGlbFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectGlbFiles(full, out)
    else if (entry.name.endsWith('.glb')) out.push(full)
  }
  return out
}

function assertNoOrphanGlbs(manifest: z.infer<typeof buildManifestSchema>): void {
  const expected = new Set<string>()
  for (const cat of manifest.packs) {
    const charLeafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === 'characters')!.id)
    const worldLeaf = leavesFor(cat.pack).find((l) => l.kind === 'world')
    const worldLeafDir = worldLeaf ? join(STAGE_DIR, worldLeaf.id) : null
    if (cat.rigModelPath) expected.add(join(charLeafDir, cat.rigModelPath))
    for (const cr of cat.creatureRigs ?? []) expected.add(join(charLeafDir, cr.rigModelPath))
    for (const part of cat.parts) {
      const dir = part.leaf === 'characters' ? charLeafDir : worldLeafDir!
      expected.add(join(dir, part.relativePath))
    }
    for (const held of cat.heldItems) {
      const dir = held.leaf === 'characters' ? charLeafDir : worldLeafDir!
      expected.add(join(dir, held.relativePath))
    }
    for (const prop of cat.props) {
      const dir = prop.leaf === 'characters' ? charLeafDir : worldLeafDir!
      expected.add(join(dir, prop.relativePath))
    }
  }
  const actual = collectGlbFiles(STAGE_DIR)
  const orphans = actual.filter((p) => !expected.has(p)).map((p) => relative(STAGE_DIR, p))
  if (orphans.length > 0) {
    throw new Error(`Found unreferenced stale GLB files in out/jam-stage: ${orphans.join(', ')}`)
  }
}

function assertCoveredRegionContinuity(glb: ParsedGlb, part: AvatarPartEntry): void {
  if ((part.rigId ?? 'ual1') !== 'ual1') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined) return
  const extras = partExtrasSchema.parse(node.extras ?? {})
  const covers = extras.polyCovers ?? []
  const positions = readAccessor(glb, glb.doc.meshes![node.mesh]!.primitives[0]!.attributes.POSITION!)
  const hasXBand = (lo: number, hi: number) => positions.some((p) => Math.abs(p[0] ?? 0) >= lo && Math.abs(p[0] ?? 0) <= hi)
  const hasYBand = (lo: number, hi: number) => positions.some((p) => (p[1] ?? 0) >= lo && (p[1] ?? 0) <= hi)
  if (covers.includes('upperarm') && (!hasXBand(0.16, 0.28) || !hasXBand(0.28, 0.40))) {
    throw new Error(`Part "${part.id}" declares cover "upperarm" without covering upperarm X span [0.16..0.40]`)
  }
  if (covers.includes('forearm') && (!hasXBand(0.42, 0.54) || !hasXBand(0.54, 0.65))) {
    throw new Error(`Part "${part.id}" declares cover "forearm" without covering full forearm X span [0.42..0.65]`)
  }
  if (covers.includes('thigh') && (!hasYBand(0.76, 0.94) || !hasYBand(0.58, 0.76))) {
    throw new Error(`Part "${part.id}" declares cover "thigh" without covering full thigh Y span [0.58..0.94]`)
  }
  if (covers.includes('shin') && (!hasYBand(0.32, 0.52) || !hasYBand(0.12, 0.32))) {
    throw new Error(`Part "${part.id}" declares cover "shin" without covering full shin Y span [0.12..0.52]`)
  }
}

function assertChestCollarCoverage(glb: ParsedGlb, nodeName: string): void {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined) return
  const extras = partExtrasSchema.parse(node.extras ?? {})
  if (!(extras.polyCovers ?? []).includes('chest')) return
  const positions = readAccessor(glb, glb.doc.meshes![node.mesh]!.primitives[0]!.attributes.POSITION!)
  const maxY = positions.reduce((m, row) => Math.max(m, row[1] ?? -Infinity), -Infinity)
  if (maxY < 1.59) {
    throw new Error(`Part "${nodeName}" covers "chest" (up to neck_base y=1.606) but ends at y=${maxY.toFixed(3)}`)
  }
}

type Vec3Tuple = [number, number, number]

function maxFrontRaycastZ(positions: Vec3Tuple[], tris: number[], x: number, y: number): number | null {
  let best = -Infinity
  for (const t of tris) {
    const base = t * 3
    const p0 = positions[base]!
    const p1 = positions[base + 1]!
    const p2 = positions[base + 2]!
    const minX = Math.min(p0[0], p1[0], p2[0])
    const maxX = Math.max(p0[0], p1[0], p2[0])
    if (x < minX - 1e-5 || x > maxX + 1e-5) continue
    const minY = Math.min(p0[1], p1[1], p2[1])
    const maxY = Math.max(p0[1], p1[1], p2[1])
    if (y < minY - 1e-5 || y > maxY + 1e-5) continue
    const det = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
    if (Math.abs(det) < 1e-10) continue
    const w0 = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / det
    const w1 = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / det
    const w2 = 1 - w0 - w1
    if (w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) {
      const z = w0 * p0[2] + w1 * p1[2] + w2 * p2[2]
      if (z > 0 && z > best) best = z
    }
  }
  return Number.isFinite(best) ? best : null
}

function assertChestFrontAppliqueClearance(glb: ParsedGlb, part: AvatarPartEntry): void {
  if (part.slot !== 'torso' || (part.rigId ?? 'ual1') !== 'ual1') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined) return
  const extras = partExtrasSchema.parse(node.extras ?? {})
  if (!(extras.polyCovers ?? []).includes('chest')) return

  const mesh = glb.doc.meshes![node.mesh]!
  const prim = mesh.primitives[0]!
  const basePos = readAccessor(glb, prim.attributes.POSITION!) as Vec3Tuple[]
  const uvs = readAccessor(glb, prim.attributes.TEXCOORD_0!) as [number, number][]
  const indices = prim.indices !== undefined ? readAccessor(glb, prim.indices).map((r) => r[0]!) : basePos.map((_, i) => i)
  const triCount = Math.floor(indices.length / 3)

  // Group triangles into welded vertex islands (equivalent to polykit groups)
  const parent = Array.from({ length: triCount }, (_, i) => i)
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]!]!
      a = parent[a]!
    }
    return a
  }
  const union = (a: number, b: number): void => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }
  const firstTriByVertKey = new Map<string, number>()
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const p = basePos[indices[t * 3 + k]!]!
      const key = `${Math.round(p[0] * 10000)},${Math.round(p[1] * 10000)},${Math.round(p[2] * 10000)}`
      const prev = firstTriByVertKey.get(key)
      if (prev === undefined) firstTriByVertKey.set(key, t)
      else union(prev, t)
    }
  }

  const islands = new Map<number, number[]>()
  for (let t = 0; t < triCount; t++) {
    const root = find(t)
    let arr = islands.get(root)
    if (!arr) {
      arr = []
      islands.set(root, arr)
    }
    arr.push(t)
  }

  interface IslandBounds {
    tris: number[]
    minX: number
    maxX: number
    minY: number
    maxY: number
    maxZ: number
  }
  const measured: IslandBounds[] = []
  for (const tris of islands.values()) {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const p = basePos[indices[t * 3 + k]!]!
        if (p[0] < minX) minX = p[0]
        if (p[0] > maxX) maxX = p[0]
        if (p[1] < minY) minY = p[1]
        if (p[1] > maxY) maxY = p[1]
        if (p[2] > maxZ) maxZ = p[2]
      }
    }
    measured.push({ tris, minX, maxX, minY, maxY, maxZ })
  }

  const shell = measured
    .filter((i) => i.minX < -0.1 && i.maxX > 0.1 && i.minY < 1.3 && i.maxY > 1.55)
    .sort((a, b) => b.tris.length - a.tris.length)[0]
  if (!shell) throw new Error(`Torso "${part.id}" missing main torso shell island`)

  // The sleeves share the armhole edges with the chest. Cast only against the chest wall.
  const skin = glb.doc.skins![node.skin!]!
  const armBones = new Set(skin.joints.flatMap((n, i) =>
    /^(upperarm|lowerarm|hand)_/.test(glb.doc.nodes![n]!.name ?? '') ? [i] : [],
  ))
  const joints = readAccessor(glb, prim.attributes.JOINTS_0!)
  const weights = readAccessor(glb, prim.attributes.WEIGHTS_0!)
  const onArm = joints.map((row, i) => row.some((j, k) => armBones.has(j) && weights[i]![k]! > 0))
  const chestTris = shell.tris.filter((t) => indices.slice(t * 3, t * 3 + 3).every((v) => !onArm[v]))

  const frontAppliques = measured.filter(
    (i) =>
      i !== shell &&
      Math.max(Math.abs(i.minX), Math.abs(i.maxX)) <= 0.22 &&
      i.minY < 1.56 &&
      i.maxY > 1.2 &&
      i.maxZ > 0.02 &&
      i.minX < 0.15 &&
      i.maxX > -0.15,
  )

  const targetNames = mesh.extras?.targetNames ?? []
  const targetDeltas = (prim.targets ?? []).map((t) =>
    t.POSITION !== undefined ? (readAccessor(glb, t.POSITION) as Vec3Tuple[]) : null,
  )
  const poses: { label: string; triVerts: Vec3Tuple[] }[] = [
    {
      label: 'base',
      triVerts: indices.map((vi) => basePos[vi]!),
    },
  ]
  for (let mi = 0; mi < targetNames.length; mi++) {
    const delta = targetDeltas[mi]
    if (!delta) continue
    poses.push({
      label: targetNames[mi]!,
      triVerts: indices.map((vi) => {
        const b = basePos[vi]!
        const d = delta[vi]!
        return [b[0] + d[0], b[1] + d[1], b[2] + d[2]]
      }),
    })
  }

  for (const pose of poses) {
    for (const app of frontAppliques) {
      const x0 = Math.max(-0.15, app.minX)
      const x1 = Math.min(0.15, app.maxX)
      const y0 = Math.max(1.2, app.minY)
      const y1 = Math.min(1.56, app.maxY)
      let minClear = Infinity
      let worst: [number, number] = [0, 0]
      let hits = 0
      for (let x = x0; x <= x1 + 1e-5; x += 0.006) {
        for (let y = y0; y <= y1 + 1e-5; y += 0.006) {
          const sz = maxFrontRaycastZ(pose.triVerts, chestTris, x, y)
          const az = maxFrontRaycastZ(pose.triVerts, app.tris, x, y)
          if (sz !== null && az !== null) {
            hits++
            const diff = az - sz
            if (diff < minClear) {
              minClear = diff
              worst = [x, y]
            }
          }
        }
      }
      if (hits > 0 && minClear < 0.0005) {
        throw new Error(
          `Torso "${part.id}" [${pose.label}] chest appliqué penetrates torso shell (minClear=${(minClear * 1000).toFixed(2)}mm at x=${worst[0].toFixed(3)}, y=${worst[1].toFixed(3)})`,
        )
      }
    }

    if (part.id === 'torso_sim_blazer') {
      const shirtTris: number[] = []
      const tieTris: number[] = []
      for (let t = 0; t < triCount; t++) {
        const i0 = indices[t * 3]!
        const u = uvs[i0]![0]!
        const xs = [pose.triVerts[t * 3]![0], pose.triVerts[t * 3 + 1]![0], pose.triVerts[t * 3 + 2]![0]]
        const ys = [pose.triVerts[t * 3]![1], pose.triVerts[t * 3 + 1]![1], pose.triVerts[t * 3 + 2]![1]]
        const maxAbsX = Math.max(...xs.map(Math.abs))
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        if (Math.abs(u - PALETTE_REGION_U.metal) < 0.04 && minY >= 1.28 && maxY <= 1.62 && maxAbsX <= 0.06) {
          shirtTris.push(t)
        } else if (Math.abs(u - PALETTE_REGION_U.accent) < 0.04 && minY >= 1.3 && maxY <= 1.62 && maxAbsX <= 0.03) {
          tieTris.push(t)
        }
      }
      if (shirtTris.length === 0 || tieTris.length === 0) {
        throw new Error(`torso_sim_blazer [${pose.label}] missing chest shirt/tie geometry`)
      }
      let tieHits = 0
      for (let x = -0.02; x <= 0.0201; x += 0.005) {
        for (let y = 1.33; y <= 1.59; y += 0.005) {
          const tz = maxFrontRaycastZ(pose.triVerts, tieTris, x, y)
          const shz = maxFrontRaycastZ(pose.triVerts, shirtTris, x, y)
          if (tz !== null && shz !== null) {
            tieHits++
            const minReq = Math.abs(x) <= 0.008 ? 0.006 : 0
            if (tz - shz < minReq) {
              throw new Error(
                `torso_sim_blazer [${pose.label}] tie clips shirt (diff=${((tz - shz) * 1000).toFixed(2)}mm < ${(minReq * 1000).toFixed(1)}mm at x=${x.toFixed(3)}, y=${y.toFixed(3)})`,
              )
            }
          }
        }
      }
      if (tieHits < 10) {
        throw new Error(`torso_sim_blazer [${pose.label}] tie overlap sample count too small (${tieHits})`)
      }
    }
  }
}

const REQUIRED_BODY_MORPHS = ['body_slim', 'body_heavy', 'body_orc', 'body_troll']
const REQUIRED_HEAD_MORPHS = ['head_orc', 'head_troll']

function assertMorphAndLayerContracts(glb: ParsedGlb, part: AvatarPartEntry): void {
  if ((part.rigId ?? 'ual1') !== 'ual1') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined) return
  const mesh = glb.doc.meshes?.[node.mesh]
  const targetNames = new Set(mesh?.extras?.targetNames ?? [])
  const extras = partExtrasSchema.parse(node.extras ?? {})

  if (part.slot === 'torso' || part.slot === 'legs' || part.slot === 'back') {
    const missing = REQUIRED_BODY_MORPHS.filter((name) => !targetNames.has(name))
    if (missing.length > 0) {
      throw new Error(`Part "${part.id}" (${part.slot}) is missing body morph targets: ${missing.join(', ')}`)
    }
  }
  if (part.slot === 'headwear' || (part.slot === 'hair' && part.id !== 'hair_orc_mohawk')) {
    const missing = REQUIRED_HEAD_MORPHS.filter((name) => !targetNames.has(name))
    if (missing.length > 0) {
      throw new Error(`Part "${part.id}" (${part.slot}) is missing head-fit morph targets: ${missing.join(', ')}`)
    }
  }
  if (part.slot === 'hair' && !(extras.polyCovers ?? []).includes('hair')) {
    throw new Error(`Hair part "${part.id}" must cover "hair" so monster head crests are culled`)
  }
  if (part.slot === 'legs' && !('legs_waist' in (extras.polyRegions ?? {}))) {
    throw new Error(`Legs part "${part.id}" must tag its waistband/buckle as "legs_waist"`)
  }
  if (part.id === 'head_troll' && !('hair' in (extras.polyRegions ?? {}))) {
    throw new Error('head_troll must tag its crest tufts as "hair" for hidesHair headwear culling')
  }
}

function assertCreatureLegSides(glb: ParsedGlb, nodeName: string, rigId: RigId): void {
  if (rigId === 'ual1' || rigId === 'serpent') return
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined || node.skin === undefined) return
  const skin = glb.doc.skins?.[node.skin]
  if (!skin) return
  const jointNames = skin.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  const prim = glb.doc.meshes![node.mesh]!.primitives[0]!
  const positions = readAccessor(glb, prim.attributes.POSITION!)
  const joints = readAccessor(glb, prim.attributes.JOINTS_0!)
  const weights = readAccessor(glb, prim.attributes.WEIGHTS_0!)
  const leftPattern =
    rigId === 'quadruped'
      ? /^leg_[fb]l_/
      : rigId === 'arachnid'
        ? /^leg_\d+_l_/
        : rigId === 'avian'
          ? /^(?:wing|leg)_.*_l$|^foot_l$/
          : rigId === 'dragon'
            ? /^(?:wing|foreleg|hindleg)_.*_l$/
            : rigId === 'kaiju'
              ? /^(?:arm|leg)_.*_l$|^(?:hand|foot)_l$/
              : /^(?:pelvic_)?fin_l$/
  const rightPattern =
    rigId === 'quadruped'
      ? /^leg_[fb]r_/
      : rigId === 'arachnid'
        ? /^leg_\d+_r_/
        : rigId === 'avian'
          ? /^(?:wing|leg)_.*_r$|^foot_r$/
          : rigId === 'dragon'
            ? /^(?:wing|foreleg|hindleg)_.*_r$/
            : rigId === 'kaiju'
              ? /^(?:arm|leg)_.*_r$|^(?:hand|foot)_r$/
              : /^(?:pelvic_)?fin_r$/
  let checkedLeft = 0
  let checkedRight = 0
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i]![0]!
    const jRow = joints[i]!
    const wRow = weights[i]!
    for (let slot = 0; slot < 4; slot++) {
      if ((wRow[slot] ?? 0) < 0.5) continue
      const jName = jointNames[jRow[slot] ?? -1] ?? ''
      if (leftPattern.test(jName)) {
        checkedLeft++
        if (x <= 0.01) {
          throw new Error(`Part "${nodeName}" left limb vertex (${jName}) has non-positive x=${x.toFixed(3)}`)
        }
      } else if (rightPattern.test(jName)) {
        checkedRight++
        if (x >= -0.01) {
          throw new Error(`Part "${nodeName}" right limb vertex (${jName}) has non-negative x=${x.toFixed(3)}`)
        }
      }
    }
  }
  if (checkedLeft === 0 || checkedRight === 0) {
    throw new Error(`Part "${nodeName}" (${rigId}) missing left/right limb vertices (L=${checkedLeft}, R=${checkedRight})`)
  }
}

function assertHeldPalmClearance(glb: ParsedGlb, held: HeldItemEntry): void {
  if (held.id === 'held_heater_shield' || held.id === 'held_spiked_buckler') return
  const node = glb.doc.nodes?.find((n) => n.name === held.nodeName)
  if (!node || node.mesh === undefined) return
  const posIdx = glb.doc.meshes![node.mesh]!.primitives[0]!.attributes.POSITION!
  const positions = readAccessor(glb, posIdx)
  let minX = Infinity
  let maxX = -Infinity
  for (const [x, y, z] of positions) {
    if (Math.abs(y!) <= 0.078 && z! >= -0.080 && z! <= 0.025) {
      if (x! < minX) minX = x!
      if (x! > maxX) maxX = x!
    }
  }
  if (held.hand === 'hand_r' && minX < -0.032) {
    throw new Error(`Held "${held.id}" (${held.hand}) penetrates palm back (minX=${minX.toFixed(4)} < -0.032)`)
  }
  if (held.hand === 'hand_l' && maxX > 0.032) {
    throw new Error(`Held "${held.id}" (${held.hand}) penetrates palm back (maxX=${maxX.toFixed(4)} > 0.032)`)
  }
}

async function assertHeldPresetClips(
  presets: CharacterPreset[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const heldPresets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1' && (p.heldRight || p.heldLeft))
  if (heldPresets.length === 0) return
  const coreRel = '3D/characters/core-rig.glb'
  const corePath = join(STAGE_DIR, 'run-chisel-core', coreRel)
  let coreGltf = auditCache.get(corePath)
  if (!coreGltf) {
    coreGltf = await loadGlbHeadless(corePath)
    auditCache.set(corePath, coreGltf)
  }
  const root = coreGltf.scene
  const handR = root.getObjectByName('hand_r')
  const handL = root.getObjectByName('hand_l')
  const mid3R = root.getObjectByName('middle_03_r')
  const mid3L = root.getObjectByName('middle_03_l')
  if (!handR || !handL || !mid3R || !mid3L) throw new Error('core-rig.glb missing hand/finger bones for held audit')
  const sockets = UAL1_RIG.heldSockets
  const dummyR = new Mesh()
  dummyR.position.fromArray(sockets.hand_r.palmOffset)
  dummyR.rotation.set(sockets.hand_r.rotationEuler[0], sockets.hand_r.rotationEuler[1], sockets.hand_r.rotationEuler[2], 'XYZ')
  const dummyL = new Mesh()
  dummyL.position.fromArray(sockets.hand_l.palmOffset)
  dummyL.rotation.set(sockets.hand_l.rotationEuler[0], sockets.hand_l.rotationEuler[1], sockets.hand_l.rotationEuler[2], 'XYZ')
  handR.add(dummyR)
  handL.add(dummyL)
  const mixer = new AnimationMixer(root)
  const pR = new Vector3()
  const pL = new Vector3()
  const tip = new Vector3()
  try {
    for (const preset of heldPresets) {
      const clip = coreGltf.animations.find((c) => c.name === preset.clip)
      if (!clip) throw new Error(`Preset "${preset.id}" references missing clip "${preset.clip}"`)
      for (let step = 0; step < 8; step++) {
        mixer.stopAllAction()
        mixer.clipAction(clip).reset().play()
        mixer.setTime((clip.duration * step) / 8)
        root.updateMatrixWorld(true)
        dummyR.getWorldPosition(pR)
        dummyL.getWorldPosition(pL)
        if (preset.heldRight) {
          mid3R.getWorldPosition(tip).applyMatrix4(dummyR.matrixWorld.clone().invert())
          if (tip.z > 0.05) {
            throw new Error(`Preset "${preset.id}" holds ${preset.heldRight} in open-hand clip "${preset.clip}" (mid3.z=${tip.z.toFixed(3)})`)
          }
        }
        if (preset.heldLeft && preset.heldLeft !== 'held_heater_shield' && preset.heldLeft !== 'held_spiked_buckler') {
          mid3L.getWorldPosition(tip).applyMatrix4(dummyL.matrixWorld.clone().invert())
          if (tip.z > 0.05) {
            throw new Error(`Preset "${preset.id}" holds ${preset.heldLeft} in open-hand clip "${preset.clip}" (mid3.z=${tip.z.toFixed(3)})`)
          }
        }
        if (preset.heldRight && preset.heldLeft) {
          const dist = pR.distanceTo(pL)
          if (dist < 0.25) {
            throw new Error(`Preset "${preset.id}" two-handed clip "${preset.clip}" brings held sockets too close (${dist.toFixed(3)}m < 0.25m)`)
          }
        }
      }
    }
  } finally {
    mixer.stopAllAction()
    handR.remove(dummyR)
    handL.remove(dummyL)
  }
}

function assertShoulderSocketUniformity(glb: ParsedGlb, part: AvatarPartEntry): void {
  if ((part.rigId ?? 'ual1') !== 'ual1') return
  if (part.slot !== 'body' && part.slot !== 'torso') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined || node.skin === undefined) return
  const skin = glb.doc.skins?.[node.skin]
  if (!skin) return
  const jointNames = skin.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  const prim = glb.doc.meshes![node.mesh]!.primitives[0]!
  const positions = readAccessor(glb, prim.attributes.POSITION!)
  const joints = readAccessor(glb, prim.attributes.JOINTS_0!)
  const weights = readAccessor(glb, prim.attributes.WEIGHTS_0!)
  if (part.slot === 'body') {
    // Flat shading splits vertices. Match both position and weights at each edge.
    const keys = positions.map((p, i) => [p, joints[i], weights[i]].join('/'))
    const indices = prim.indices === undefined ? positions.map((_, i) => i) : readAccessor(glb, prim.indices).map((r) => r[0]!)
    const regions = partExtrasSchema.parse(node.extras ?? {}).polyRegions
    const edges = (region: string) => {
      const [start, length] = regions?.[region] ?? [0, 0]
      const result = new Set<string>()
      for (let t = start; t < start + length; t += 3) {
        for (let j = 0; j < 3; j++) {
          const a = keys[indices[t + j]!]!
          const b = keys[indices[t + (j + 1) % 3]!]!
          result.add(a < b ? a + '|' + b : b + '|' + a)
        }
      }
      return result
    }
    const chestEdges = edges('chest')
    const socketEdges = [...edges('upperarm')].filter((edge) => chestEdges.has(edge))
    if (socketEdges.length !== 12) {
      throw new Error(`Body "${part.id}" has an open or split shoulder seam`)
    }
  }
  const rings = new Map<string, number[]>()
  for (let i = 0; i < positions.length; i++) {
    const [x, y] = positions[i]!
    if (Math.abs(x!) < 0.08 || Math.abs(x!) > 0.25 || y! < 1.38 || y! > 1.62) continue
    let upperW = 0
    let hasArm = false
    for (let s = 0; s < 4; s++) {
      const w = weights[i]![s]!
      if (w < 1e-4) continue
      const jn = jointNames[joints[i]![s]!] ?? ''
      if (jn.startsWith('upperarm_')) {
        upperW += w
        hasArm = true
      }
    }
    if (!hasArm) continue
    const side = x! >= 0 ? 'L' : 'R'
    const key = `${side}:${(Math.round(Math.abs(x!) * 200) / 200).toFixed(3)}`
    const arr = rings.get(key) ?? []
    arr.push(upperW)
    rings.set(key, arr)
  }
  for (const [ringKey, ws] of rings) {
    if (ws.length < 4) continue
    const minW = Math.min(...ws)
    const maxW = Math.max(...ws)
    if (maxW - minW > 0.15) {
      throw new Error(
        `Part "${part.id}" shoulder socket ring ${ringKey} has non-uniform upperarm weights [${minW.toFixed(2)}..${maxW.toFixed(2)}]`,
      )
    }
  }
}

interface UniqueVert {
  pos: Vec3Tuple
  weights: Map<string, number>
}

function collectUniquePartVerts(glb: ParsedGlb, nodeName: string): UniqueVert[] {
  const node = glb.doc.nodes?.find((n) => n.name === nodeName)
  if (!node || node.mesh === undefined || node.skin === undefined) return []
  const skin = glb.doc.skins?.[node.skin]
  if (!skin) return []
  const jointNames = skin.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  const prim = glb.doc.meshes![node.mesh]!.primitives[0]!
  const positions = readAccessor(glb, prim.attributes.POSITION!)
  const joints = readAccessor(glb, prim.attributes.JOINTS_0!)
  const weights = readAccessor(glb, prim.attributes.WEIGHTS_0!)
  const seen = new Set<string>()
  const out: UniqueVert[] = []
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i]!
    const key = `${Math.round(p[0]! * 1e4)},${Math.round(p[1]! * 1e4)},${Math.round(p[2]! * 1e4)}`
    if (seen.has(key)) continue
    seen.add(key)
    const wMap = new Map<string, number>()
    for (let s = 0; s < 4; s++) {
      const w = weights[i]![s]!
      if (w < 1e-4) continue
      const jn = jointNames[joints[i]![s]!] ?? ''
      if (jn) wMap.set(jn, (wMap.get(jn) ?? 0) + w)
    }
    out.push({ pos: [p[0]!, p[1]!, p[2]!], weights: wMap })
  }
  return out
}

function assertHingeJointRingProximity(glb: ParsedGlb, part: AvatarPartEntry, fail: (msg: string) => void): void {
  if ((part.rigId ?? 'ual1') !== 'ual1') return
  const node = glb.doc.nodes?.find((n) => n.name === part.nodeName)
  if (!node || node.mesh === undefined) return
  const extras = partExtrasSchema.parse(node.extras ?? {})
  const covers = extras.polyCovers ?? []
  const verts = collectUniquePartVerts(glb, part.nodeName)
  if (verts.length === 0) return

  // 1. Ankle rings & leg cuffs on bodies and shin-covering legs
  if (part.slot === 'body' || (part.slot === 'legs' && covers.includes('shin'))) {
    const leftLegVerts = verts.filter((v) => v.pos[0] > 0.025 && !(v.pos[2] > 0.015 && v.pos[1] < 0.148))
    const ankleHi = leftLegVerts.filter((v) => v.pos[1] >= 0.180 && v.pos[1] <= 0.245)
    const ankle = leftLegVerts.filter((v) => v.pos[1] >= 0.140 && v.pos[1] < 0.180)
    const ankleIn = leftLegVerts.filter((v) => v.pos[1] >= 0.106 && v.pos[1] < 0.140)
    if (ankleHi.length < 6) {
      fail(`Part "${part.id}" missing upper ankle ring in y=[0.180..0.245] (found ${ankleHi.length} verts)`)
    } else {
      const meanCalf = ankleHi.reduce((acc, v) => acc + (v.weights.get('calf_l') ?? 0), 0) / ankleHi.length
      if (meanCalf < 0.68) {
        fail(`Part "${part.id}" upper ankle ring mean calf_l weight ${meanCalf.toFixed(2)} < 0.68`)
      }
    }
    if (ankle.length < 6) {
      fail(`Part "${part.id}" missing ankle hinge ring in y=[0.140..0.180] (found ${ankle.length} verts)`)
    }
    if (ankleIn.length < 6) {
      fail(`Part "${part.id}" missing tucked lower ankle ring in y=[0.106..0.140] (found ${ankleIn.length} verts)`)
    } else {
      const minZ = Math.min(...ankleIn.map((v) => v.pos[2]))
      if (minZ < -0.092) {
        fail(`Part "${part.id}" lower ankle ring protrudes behind heel (minZ=${minZ.toFixed(4)} < -0.092)`)
      }
    }
    if (part.slot === 'legs' && (!covers.includes('foot') || part.id === 'legs_sim_jeans')) {
      const hemBand = leftLegVerts.filter((v) => v.pos[1] >= 0.115 && v.pos[1] <= 0.165)
      if (hemBand.length >= 8) {
        const cx = 0.09428
        const cz = -0.06148
        const radii = hemBand.map((v) => Math.hypot(v.pos[0] - cx, v.pos[2] - cz))
        const diff = Math.max(...radii) - Math.min(...radii)
        if (diff < 0.005) {
          fail(`Part "${part.id}" shin cuff has no closed inward return ring (maxR-minR=${(diff * 1000).toFixed(1)}mm < 5mm)`)
        }
      }
    }
  }

  // 2. Wrist centering, closed forearm cuffs, elbow rings, and pelvis-thigh containment
  if (part.slot === 'body' || (part.slot === 'torso' && covers.includes('forearm'))) {
    const leftArm = verts.filter((v) => v.pos[0] > 0.05 && v.pos[1] >= 1.38 && v.pos[1] <= 1.64)
    const wristArmVerts = leftArm.filter(
      (v) => v.pos[0] >= 0.630 && v.pos[0] <= 0.680 && (v.weights.get('lowerarm_l') ?? 0) >= 0.45,
    )
    if (wristArmVerts.length === 0) {
      fail(`Part "${part.id}" missing forearm wrist ring in x=[0.630..0.680]`)
    } else {
      const meanZ = wristArmVerts.reduce((acc, v) => acc + v.pos[2], 0) / wristArmVerts.length
      if (Math.abs(meanZ - 0.04765) > 0.003) {
        fail(`Part "${part.id}" wrist centerline Z=${meanZ.toFixed(4)} off WRIST.z=0.04765 by ${((meanZ - 0.04765) * 1000).toFixed(1)}mm`)
      }
    }

    if (part.slot === 'torso' && covers.includes('forearm') && !covers.includes('hand')) {
      const distalCuff = leftArm.filter((v) => v.pos[0] >= 0.635)
      if (distalCuff.length < 6) {
        fail(`Part "${part.id}" distal sleeve cuff too short/missing (verts x>=0.635: ${distalCuff.length})`)
      } else {
        const minLowerW = Math.min(...distalCuff.map((v) => v.weights.get('lowerarm_l') ?? 0))
        if (minLowerW < 0.98) {
          fail(`Part "${part.id}" distal sleeve cuff blends with hand_l (min lowerarm_l=${minLowerW.toFixed(2)} < 0.98)`)
        }
        const maxX = Math.max(...distalCuff.map((v) => v.pos[0]))
        const endVerts = distalCuff.filter((v) => v.pos[0] >= maxX - 0.025)
        const radii = endVerts.map((v) => Math.hypot(v.pos[1] - 1.52357, v.pos[2] - 0.04765))
        const diff = radii.length > 0 ? Math.max(...radii) - Math.min(...radii) : 0
        if (diff < 0.005) {
          fail(`Part "${part.id}" sleeve cuff is an open hollow tube (maxR-minR=${(diff * 1000).toFixed(1)}mm < 5mm)`)
        }
      }
    }

    if (part.slot === 'body' || (part.slot === 'torso' && covers.includes('upperarm') && covers.includes('forearm'))) {
      const aboveElbow = leftArm.filter((v) => v.pos[0] >= 0.365 && v.pos[0] <= 0.412)
      const belowElbow = leftArm.filter((v) => v.pos[0] >= 0.426 && v.pos[0] <= 0.468)
      if (aboveElbow.length < 6) {
        fail(`Part "${part.id}" missing above-elbow ring in x=[0.365..0.412] (${aboveElbow.length} verts)`)
      } else {
        const meanU = aboveElbow.reduce((acc, v) => acc + (v.weights.get('upperarm_l') ?? 0), 0) / aboveElbow.length
        if (meanU < 0.70) fail(`Part "${part.id}" above-elbow ring mean upperarm_l=${meanU.toFixed(2)} < 0.70`)
      }
      if (belowElbow.length < 6) {
        fail(`Part "${part.id}" missing below-elbow ring in x=[0.426..0.468] (${belowElbow.length} verts)`)
      } else {
        const meanL = belowElbow.reduce((acc, v) => acc + (v.weights.get('lowerarm_l') ?? 0), 0) / belowElbow.length
        if (meanL < 0.70) fail(`Part "${part.id}" below-elbow ring mean lowerarm_l=${meanL.toFixed(2)} < 0.70`)
      }
    }
  }

  if (part.slot === 'body') {
    const handRoot = verts.filter((v) => v.pos[0] > 0.60 && (v.weights.get('hand_l') ?? 0) >= 0.90)
    const forearmEnd = verts.filter(
      (v) => v.pos[0] >= 0.660 && v.pos[0] <= 0.685 && (v.weights.get('lowerarm_l') ?? 0) >= 0.90,
    )
    if (handRoot.length === 0) {
      fail(`Body "${part.id}" missing 100% hand_l hand root`)
    } else {
      const handMinX = Math.min(...handRoot.map((v) => v.pos[0]))
      if (handMinX > 0.662) {
        fail(`Body "${part.id}" hand root not tucked inside forearm (minX=${handMinX.toFixed(4)} > 0.662)`)
      }
      if (forearmEnd.length >= 6) {
        const handRootVerts = handRoot.filter((v) => v.pos[0] <= handMinX + 0.010)
        const handMaxR = Math.max(...handRootVerts.map((v) => Math.hypot(v.pos[1] - 1.52357, v.pos[2] - 0.04765)))
        const armMinR = Math.min(...forearmEnd.map((v) => Math.hypot(v.pos[1] - 1.52357, v.pos[2] - 0.04765)))
        if (armMinR < handMaxR - 0.001) {
          fail(`Body "${part.id}" forearm end (${(armMinR * 1000).toFixed(1)}mm) narrower than hand root (${(handMaxR * 1000).toFixed(1)}mm)`)
        }
      }
    }

    const hipsVerts = verts.filter((v) => v.pos[1] >= 1.035 && v.pos[1] <= 1.055 && Math.abs(v.pos[0]) > 0.04 && (v.weights.get('pelvis') ?? 0) >= 0.5)
    const thighTop = verts.filter((v) => v.pos[1] >= 1.050 && v.pos[1] <= 1.070 && v.pos[0] > 0.03 && (v.weights.get('thigh_l') ?? 0) >= 0.5)
    if (hipsVerts.length >= 6 && thighTop.length >= 6) {
      const hipsMaxX = Math.max(...hipsVerts.map((v) => v.pos[0]))
      const hipsMinZ = Math.min(...hipsVerts.map((v) => v.pos[2]))
      const thighMaxX = Math.max(...thighTop.map((v) => v.pos[0]))
      const thighMinZ = Math.min(...thighTop.map((v) => v.pos[2]))
      if (thighMaxX > hipsMaxX + 0.002) {
        fail(`Body "${part.id}" thigh top X=${thighMaxX.toFixed(4)} protrudes outside pelvis hips X=${hipsMaxX.toFixed(4)}`)
      }
      if (thighMinZ < hipsMinZ - 0.002) {
        fail(`Body "${part.id}" thigh top Z=${thighMinZ.toFixed(4)} protrudes behind pelvis hips Z=${hipsMinZ.toFixed(4)}`)
      }
    }
  }
}

function minorAxisRmsRadius(points: Vec3Tuple[]): number {
  const n = points.length
  if (n < 4) return 0
  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of points) {
    cx += p[0]
    cy += p[1]
    cz += p[2]
  }
  cx /= n
  cy /= n
  cz /= n
  const a = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const p of points) {
    const dx = p[0] - cx
    const dy = p[1] - cy
    const dz = p[2] - cz
    a[0]![0]! += dx * dx
    a[0]![1]! += dx * dy
    a[0]![2]! += dx * dz
    a[1]![1]! += dy * dy
    a[1]![2]! += dy * dz
    a[2]![2]! += dz * dz
  }
  a[1]![0] = a[0]![1]!
  a[2]![0] = a[0]![2]!
  a[2]![1] = a[1]![2]!
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a[i]![j]! /= n

  // 3x3 Jacobi eigenvalue iteration
  for (let iter = 0; iter < 24; iter++) {
    let p = 0
    let q = 1
    let maxOff = Math.abs(a[0]![1]!)
    if (Math.abs(a[0]![2]!) > maxOff) {
      maxOff = Math.abs(a[0]![2]!)
      p = 0
      q = 2
    }
    if (Math.abs(a[1]![2]!) > maxOff) {
      maxOff = Math.abs(a[1]![2]!)
      p = 1
      q = 2
    }
    if (maxOff < 1e-14) break
    const app = a[p]![p]!
    const aqq = a[q]![q]!
    const apq = a[p]![q]!
    const tau = (aqq - app) / (2 * apq)
    const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau))
    const c = 1 / Math.sqrt(1 + t * t)
    const s = t * c
    a[p]![p] = app - t * apq
    a[q]![q] = aqq + t * apq
    a[p]![q] = 0
    a[q]![p] = 0
    for (let r = 0; r < 3; r++) {
      if (r === p || r === q) continue
      const arp = a[r]![p]!
      const arq = a[r]![q]!
      a[r]![p] = c * arp - s * arq
      a[p]![r] = a[r]![p]!
      a[r]![q] = s * arp + c * arq
      a[q]![r] = a[r]![q]!
    }
  }
  const eigs = [a[0]![0]!, a[1]![1]!, a[2]![2]!].sort((x, y) => x - y)
  return Math.sqrt(Math.max(0, eigs[1]!))
}

async function assertJointRingPreservation(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
  fail: (msg: string) => void,
): Promise<void> {
  const targetPresetIds = ['core_athletic', 'medieval_knight', 'ww2_rifleman', 'ww2_officer', 'sim_executive', 'monster_orc_warlord', 'monster_troll_brute']
  const checkClips = ['Sword_Attack', 'Ranged_2H_Aiming', 'Ranged_2H_Shoot', 'Pistol_Idle_Loop', 'Melee_Hook', 'Jog_Fwd_Loop', 'Sitting_Idle_Loop', 'Shield_Dash']

  for (const presetId of targetPresetIds) {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) continue
    const loaded = await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
    const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, 'ual1', preset.proportions)

    interface MonitoredRing {
      mesh: SkinnedMesh
      label: string
      indices: number[]
      restMinor: number
    }
    const monitored: MonitoredRing[] = []

    const addRings = (mesh: SkinnedMesh | undefined, kind: 'body' | 'torso' | 'legs') => {
      if (!mesh) return
      const pos = mesh.geometry.getAttribute('position')
      const ji = mesh.geometry.getAttribute('skinIndex')
      const wi = mesh.geometry.getAttribute('skinWeight')
      const bones = mesh.skeleton.bones
      const uniqueByPos = new Map<string, number>()
      for (let i = 0; i < pos.count; i++) {
        const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
        if (!uniqueByPos.has(key)) uniqueByPos.set(key, i)
      }
      const weightOf = (vi: number, prefix: string) => {
        let w = 0
        for (let s = 0; s < 4; s++) {
          if (bones[ji.getComponent(vi, s)]?.name.startsWith(prefix)) w += wi.getComponent(vi, s)
        }
        return w
      }
      const makeRing = (label: string, pred: (vi: number, x: number, y: number, z: number) => boolean) => {
        const idxs: number[] = []
        for (const vi of uniqueByPos.values()) {
          if (pred(vi, pos.getX(vi), pos.getY(vi), pos.getZ(vi))) idxs.push(vi)
        }
        if (idxs.length < 5) return
        // Group tightly along primary axis if multiple rings landed in band: take slice closest to median
        const pts: Vec3Tuple[] = idxs.map((vi) => [pos.getX(vi), pos.getY(vi), pos.getZ(vi)])
        const minor = minorAxisRmsRadius(pts)
        if (minor > 0.008) monitored.push({ mesh, label: `${mesh.name}:${label}`, indices: idxs, restMinor: minor })
      }
      if (kind === 'body' || kind === 'torso') {
        for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
          makeRing(`wrist_${side}`, (vi, x, y) => x * sgn >= 0.658 && x * sgn <= 0.680 && y >= 1.45 && y <= 1.60 && weightOf(vi, 'lowerarm_') >= 0.45)
          makeRing(`elbow_hi_${side}`, (vi, x, y) => x * sgn >= 0.370 && x * sgn <= 0.405 && y >= 1.45 && y <= 1.60 && weightOf(vi, 'upperarm_') >= 0.5)
          makeRing(`elbow_lo_${side}`, (vi, x, y) => x * sgn >= 0.440 && x * sgn <= 0.470 && y >= 1.45 && y <= 1.60 && weightOf(vi, 'lowerarm_') >= 0.5)
        }
      }
      if (kind === 'body' || kind === 'legs') {
        for (const [side, sgn] of [['L', 1], ['R', -1]] as const) {
          makeRing(`ankle_${side}`, (vi, x, y, z) => x * sgn >= 0.025 && y >= 0.145 && y <= 0.178 && z <= 0.015 && weightOf(vi, 'calf_') >= 0.40)
          makeRing(`knee_hi_${side}`, (_vi, x, y) => x * sgn >= 0.025 && y >= 0.670 && y <= 0.700)
          makeRing(`knee_lo_${side}`, (_vi, x, y) => x * sgn >= 0.025 && y >= 0.570 && y <= 0.600)
        }
      }
    }

    addRings(loaded.meshes.find((m) => m.name.startsWith('body_')), 'body')
    addRings(loaded.meshes.find((m) => m.name.startsWith('torso_')), 'torso')
    addRings(loaded.meshes.find((m) => m.name.startsWith('legs_')), 'legs')
    if (monitored.length === 0) continue

    // Recompute restMinor in scaled/morphed bind pose so proportions don't skew rest radius
    propCtrl.restoreRest()
    propCtrl.scalePelvis()
    loaded.root.updateMatrixWorld(true)
    const restSkinned = new Map<SkinnedMesh, Vec3Tuple[]>()
    for (const m of new Set(monitored.map((r) => r.mesh))) restSkinned.set(m, skinMeshPositions(m))
    for (const r of monitored) {
      const sk = restSkinned.get(r.mesh)!
      r.restMinor = minorAxisRmsRadius(r.indices.map((vi) => sk[vi]!))
    }

    const restBones = new Map<string, Object3D>()
    loaded.root.traverse((obj) => {
      if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
    })
    const mixer = new AnimationMixer(loaded.root)
    try {
      for (const clipName of checkClips) {
        const rawClip = loaded.clips.find((c) => c.name === clipName)
        if (!rawClip) continue
        const clip = optimizeClipForAudit(rawClip, restBones)
        for (let step = 0; step < 8; step++) {
          propCtrl.unscalePelvis()
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          const t = (clip.duration * step) / 8
          mixer.setTime(t)
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const animCache = new Map<SkinnedMesh, Vec3Tuple[]>()
          for (const r of monitored) {
            let sk = animCache.get(r.mesh)
            if (!sk) {
              sk = skinMeshPositions(r.mesh)
              animCache.set(r.mesh, sk)
            }
            const animMinor = minorAxisRmsRadius(r.indices.map((vi) => sk[vi]!))
            const ratio = animMinor / Math.max(r.restMinor, 1e-6)
            if (ratio < 0.75) {
              fail(
                `Preset "${presetId}" [${clipName}@${t.toFixed(2)}s] ${r.label} collapses/pinches (minorRatio=${ratio.toFixed(2)} < 0.75)`,
              )
              break
            }
          }
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  }
}

async function assertConnectionSeamContainment(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
  fail: (msg: string) => void,
): Promise<void> {
  const heldById = new Map<string, HeldItemEntry>()
  for (const pack of packs) {
    for (const h of pack.heldItems) heldById.set(h.id, h)
  }
  const loadHeldPositions = (entry: HeldItemEntry): Vec3Tuple[] => {
    const leafDir = join(STAGE_DIR, leavesFor(entry.pack).find((l) => l.kind === entry.leaf)!.id)
    const glb = parseGlb(join(leafDir, entry.relativePath))
    const node = glb.doc.nodes!.find((n) => n.name === entry.nodeName)!
    return readAccessor(glb, glb.doc.meshes![node.mesh!]!.primitives[0]!.attributes.POSITION!) as Vec3Tuple[]
  }

  const ual1Presets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1')
  for (const preset of ual1Presets) {
    const loaded = await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
    const bodyMesh = loaded.meshes.find((m) => m.name.startsWith('body_'))
    const torsoMesh = loaded.meshes.find((m) => m.name.startsWith('torso_'))
    const legsMesh = loaded.meshes.find((m) => m.name.startsWith('legs_'))
    if (!bodyMesh) continue

    // 1. Sleeve cuff vs hand root overlap & radial containment
    if (torsoMesh) {
      const tPos = torsoMesh.geometry.getAttribute('position')
      const bPos = bodyMesh.geometry.getAttribute('position')
      const bJi = bodyMesh.geometry.getAttribute('skinIndex')
      const bWi = bodyMesh.geometry.getAttribute('skinWeight')
      const bBones = bodyMesh.skeleton.bones
      let sleeveMaxX = -Infinity
      const sleeveCuffRadii: number[] = []
      for (let i = 0; i < tPos.count; i++) {
        const x = tPos.getX(i)
        if (x > 0.635 && x < 0.72) {
          sleeveMaxX = Math.max(sleeveMaxX, x)
          if (x >= 0.655) sleeveCuffRadii.push(Math.hypot(tPos.getY(i) - 1.52357, tPos.getZ(i) - 0.04765))
        }
      }
      let handMinX = Infinity
      const handRootRadii: number[] = []
      for (let i = 0; i < bPos.count; i++) {
        const x = bPos.getX(i)
        if (x < 0.60) continue
        let hw = 0
        for (let s = 0; s < 4; s++) {
          if (bBones[bJi.getComponent(i, s)]?.name === 'hand_l') hw += bWi.getComponent(i, s)
        }
        if (hw >= 0.90) {
          handMinX = Math.min(handMinX, x)
          if (x <= 0.665) handRootRadii.push(Math.hypot(bPos.getY(i) - 1.52357, bPos.getZ(i) - 0.04765))
        }
      }
      if (sleeveMaxX > -Infinity && handMinX < Infinity && sleeveCuffRadii.length >= 4 && handRootRadii.length >= 4) {
        if (sleeveMaxX < handMinX + 0.004) {
          fail(`Preset "${preset.id}" sleeve cuff (maxX=${sleeveMaxX.toFixed(4)}) does not overlap hand root (minX=${handMinX.toFixed(4)}) by >= 4mm`)
        }
        const outerSleeveR = Math.max(...sleeveCuffRadii)
        const maxHandR = Math.max(...handRootRadii)
        if (outerSleeveR < maxHandR) {
          fail(`Preset "${preset.id}" sleeve cuff radius (${(outerSleeveR * 1000).toFixed(1)}mm) < hand root (${(maxHandR * 1000).toFixed(1)}mm)`)
        }
      }
    }

    // 2. Ankle/leg vs foot heel containment
    if (legsMesh) {
      const legsCovers = (legsMesh.userData?.polyCovers as string[] | undefined) ?? []
      const footSourceMesh = legsCovers.includes('foot') ? legsMesh : bodyMesh
      const lPos = legsMesh.geometry.getAttribute('position')
      const fPos = footSourceMesh.geometry.getAttribute('position')
      let minLegZ = Infinity
      let minFootZ = Infinity
      for (let i = 0; i < lPos.count; i++) {
        if (lPos.getX(i) < 0.025) continue
        const y = lPos.getY(i)
        const z = lPos.getZ(i)
        if (y >= 0.100 && y <= 0.145 && z <= 0.015) minLegZ = Math.min(minLegZ, z)
      }
      for (let i = 0; i < fPos.count; i++) {
        if (fPos.getX(i) < 0.025) continue
        if (fPos.getY(i) < 0.095) minFootZ = Math.min(minFootZ, fPos.getZ(i))
      }
      if (minLegZ < Infinity && minFootZ < Infinity && minLegZ < minFootZ + 0.002) {
        fail(`Preset "${preset.id}" shin/ankle (minZ=${minLegZ.toFixed(4)}) sticks behind boot/foot heel (minZ=${minFootZ.toFixed(4)})`)
      }
    }

    // 3. Held-item grip contact & back-of-hand protrusion across base + handScale extremes
    for (const [hand, heldId] of [['hand_r', preset.heldRight], ['hand_l', preset.heldLeft]] as const) {
      if (!heldId || isArmShieldHeldItem(heldId)) continue
      const entry = heldById.get(heldId)
      if (!entry) continue
      const heldVerts = loadHeldPositions(entry)
      const gripVerts = heldVerts.filter((v) => Math.abs(v[1]) <= 0.045 && Math.abs(v[2]) <= 0.035)
      if (gripVerts.length === 0) continue

      const sock = UAL1_RIG.heldSockets[hand]
      const sockQuat = new Quaternion().setFromEuler(new Euler(sock.rotationEuler[0], sock.rotationEuler[1], sock.rotationEuler[2], 'XYZ'))
      const handSideSign = hand === 'hand_r' ? -1 : 1
      const baseHandScale = preset.proportions.handScale ?? 1

      for (const hScale of [baseHandScale, 0.8, 1.3]) {
        const testProps: AvatarProportions = { ...preset.proportions, handScale: hScale }
        const loadedTest =
          hScale === baseHandScale ? loaded : await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
        const testBodyMesh = loadedTest.meshes.find((m) => m.name.startsWith('body_'))!
        const testTorsoMesh = loadedTest.meshes.find((m) => m.name.startsWith('torso_'))
        const testHandMesh: SkinnedMesh =
          hand === 'hand_r' || !testTorsoMesh
            ? testBodyMesh
            : testTorsoMesh
        const propCtrl = createAuditProportionController(loadedTest.root, loadedTest.meshes, 'ual1', testProps)
        propCtrl.restoreRest()
        propCtrl.scalePelvis()
        loadedTest.root.updateMatrixWorld(true)

        const handBone = loadedTest.root.getObjectByName(hand)!
        const armFactor = armThicknessFactorFor(preset.body, testProps.build ?? 0)
        const offset = heldSocketOffsetFor(sock.palmOffset, armFactor, testProps.limbThickness, new Vector3(), hScale)
        const localMat = new Matrix4().compose(offset, sockQuat, new Vector3(1, 1, 1))
        const gripWorldMat = new Matrix4().multiplyMatrices(handBone.matrixWorld, localMat)
        const gripInvMat = gripWorldMat.clone().invert()

        const checkPalmMesh = (mesh: SkinnedMesh) => {
          const pos = skinMeshPositions(mesh)
          const ji = mesh.geometry.getAttribute('skinIndex')
          const wi = mesh.geometry.getAttribute('skinWeight')
          const bones = mesh.skeleton.bones
          const palmPts: Vec3Tuple[] = []
          const v = new Vector3()
          for (let i = 0; i < pos.length; i++) {
            let hw = 0
            for (let s = 0; s < 4; s++) {
              const bn = bones[ji.getComponent(i, s)]?.name ?? ''
              if (bn === hand || bn.endsWith(`_${hand === 'hand_r' ? 'r' : 'l'}`)) {
                if (/^(hand|thumb|index|middle|ring|pinky)/.test(bn)) hw += wi.getComponent(i, s)
              }
            }
            if (hw < 0.5) continue
            v.set(pos[i]![0], pos[i]![1], pos[i]![2]).applyMatrix4(gripInvMat)
            if (Math.abs(v.y) <= 0.045 && Math.abs(v.z) <= 0.040 && v.x * handSideSign > -0.05) {
              palmPts.push([v.x, v.y, v.z])
            }
          }
          return palmPts
        }

        const palmPts = checkPalmMesh(testBodyMesh)
        if (palmPts.length < 4 && testHandMesh !== testBodyMesh) palmPts.push(...checkPalmMesh(testHandMesh))
        if (palmPts.length < 4) continue

        // In grip space: for hand_r, palm is on -X side of handle (handle center x=0), back of hand is further -X.
        // Wait: in hand_r grip space, +X is toward body (thumb/index? Wait: check signed X of palm vs handle).
        const gripMinX = Math.min(...gripVerts.map((p) => p[0]))
        const gripMaxX = Math.max(...gripVerts.map((p) => p[0]))
        const palmXs = palmPts.map((p) => p[0])
        const palmMinX = Math.min(...palmXs)
        const palmMaxX = Math.max(...palmXs)
        // Compute air gap or back-of-hand protrusion depending on side
        if (hand === 'hand_r') {
          // On hand_r: palm surface facing handle is palmMaxX (closer to 0 from -X), dorsal back is palmMinX
          const gap = gripMinX - palmMaxX
          const backProtrusion = palmMinX - gripMinX
          if (gap > 0.008) {
            fail(`Preset "${preset.id}" (handScale=${hScale}) ${heldId} handle floats ${(gap * 1000).toFixed(1)}mm off right palm`)
          }
          if (backProtrusion > 0.003) {
            fail(`Preset "${preset.id}" (handScale=${hScale}) ${heldId} protrudes ${(backProtrusion * 1000).toFixed(1)}mm through back of right hand`)
          }
        } else {
          // On hand_l: handle is on -X side or +X side? Let's measure distance between intervals
          const gap = palmMinX - gripMaxX
          const backProtrusion = gripMaxX - palmMaxX
          if (gap > 0.008) {
            fail(`Preset "${preset.id}" (handScale=${hScale}) ${heldId} handle floats ${(gap * 1000).toFixed(1)}mm off left palm`)
          }
          if (backProtrusion > 0.003) {
            fail(`Preset "${preset.id}" (handScale=${hScale}) ${heldId} protrudes ${(backProtrusion * 1000).toFixed(1)}mm through back of left hand`)
          }
        }
      }
    }
  }
}

function maxArmRayX(tris: [Vec3Tuple, Vec3Tuple, Vec3Tuple][], sideSign: number, y: number, z: number): number | null {
  let best = -Infinity
  for (const [p0, p1, p2] of tris) {
    const minY = Math.min(p0[1], p1[1], p2[1])
    const maxY = Math.max(p0[1], p1[1], p2[1])
    if (y < minY - 1e-5 || y > maxY + 1e-5) continue
    const minZ = Math.min(p0[2], p1[2], p2[2])
    const maxZ = Math.max(p0[2], p1[2], p2[2])
    if (z < minZ - 1e-5 || z > maxZ + 1e-5) continue
    const det = (p1[2] - p2[2]) * (p0[1] - p2[1]) + (p2[1] - p1[1]) * (p0[2] - p2[2])
    if (Math.abs(det) < 1e-10) continue
    const w0 = ((p1[2] - p2[2]) * (y - p2[1]) + (p2[1] - p1[1]) * (z - p2[2])) / det
    const w1 = ((p2[2] - p0[2]) * (y - p2[1]) + (p0[1] - p2[1]) * (z - p2[2])) / det
    const w2 = 1 - w0 - w1
    if (w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) {
      const x = (w0 * p0[0] + w1 * p1[0] + w2 * p2[0]) * sideSign
      if (x > best) best = x
    }
  }
  return Number.isFinite(best) ? best : null
}

function rayZSpan(tris: [Vec3Tuple, Vec3Tuple, Vec3Tuple][], x: number, y: number): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  for (const [p0, p1, p2] of tris) {
    const minX = Math.min(p0[0], p1[0], p2[0])
    const maxX = Math.max(p0[0], p1[0], p2[0])
    if (x < minX - 1e-5 || x > maxX + 1e-5) continue
    const minY = Math.min(p0[1], p1[1], p2[1])
    const maxY = Math.max(p0[1], p1[1], p2[1])
    if (y < minY - 1e-5 || y > maxY + 1e-5) continue
    const det = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1])
    if (Math.abs(det) < 1e-10) continue
    const w0 = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / det
    const w1 = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / det
    const w2 = 1 - w0 - w1
    if (w0 >= -1e-5 && w1 >= -1e-5 && w2 >= -1e-5) {
      const z = w0 * p0[2] + w1 * p1[2] + w2 * p2[2]
      if (z < lo) lo = z
      if (z > hi) hi = z
    }
  }
  return Number.isFinite(hi) ? [lo, hi] : null
}

function skinMeshPositions(mesh: SkinnedMesh): Vec3Tuple[] {
  mesh.skeleton.update()
  const pos = mesh.geometry.getAttribute('position')
  const ji = mesh.geometry.getAttribute('skinIndex')
  const wi = mesh.geometry.getAttribute('skinWeight')
  const morphPos = mesh.geometry.morphAttributes.position
  const infl = mesh.morphTargetInfluences
  const activeMorphs: { attr: NonNullable<typeof morphPos>[number]; weight: number }[] = []
  if (morphPos && infl) {
    for (let m = 0; m < morphPos.length; m++) {
      const weight = infl[m] ?? 0
      if (Math.abs(weight) > 1e-6) activeMorphs.push({ attr: morphPos[m]!, weight })
    }
  }
  const boneMats = mesh.skeleton.boneMatrices
  const out: Vec3Tuple[] = []
  const mat = new Matrix4()
  const v = new Vector3()
  const acc = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    let bx = pos.getX(i)
    let by = pos.getY(i)
    let bz = pos.getZ(i)
    for (const { attr, weight } of activeMorphs) {
      bx += attr.getX(i) * weight
      by += attr.getY(i) * weight
      bz += attr.getZ(i) * weight
    }
    v.set(bx, by, bz).applyMatrix4(mesh.bindMatrix)
    bx = v.x
    by = v.y
    bz = v.z
    acc.set(0, 0, 0)
    for (let s = 0; s < 4; s++) {
      const w = wi.getComponent(i, s)
      if (w <= 0) continue
      mat.fromArray(boneMats, ji.getComponent(i, s) * 16)
      v.set(bx, by, bz).applyMatrix4(mat).multiplyScalar(w)
      acc.add(v)
    }
    out.push([acc.x, acc.y, acc.z])
  }
  return out
}

function buildMeshVertClassification(mesh: SkinnedMesh, side?: 'r' | 'l') {
  const posAttr = mesh.geometry.getAttribute('position')
  const jiAttr = mesh.geometry.getAttribute('skinIndex')
  const wiAttr = mesh.geometry.getAttribute('skinWeight')
  const idxAttr = mesh.geometry.getIndex()
  const bones = mesh.skeleton.bones
  const excludeIdx = new Set<number>()
  if (side) {
    const handRe = new RegExp(`^(hand|thumb_0[1-3]|index_0[1-3]|middle_0[1-3]|ring_0[1-3]|pinky_0[1-3])_${side}$`)
    bones.forEach((b, idx) => {
      if (handRe.test(b.name)) excludeIdx.add(idx)
    })
  }
  const isExcludedVert = new Uint8Array(posAttr.count)
  for (let i = 0; i < posAttr.count; i++) {
    let w = 0
    for (let s = 0; s < 4; s++) {
      if (excludeIdx.has(jiAttr.getComponent(i, s))) w += wiAttr.getComponent(i, s)
    }
    if (w >= 0.25) isExcludedVert[i] = 1
  }
  const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3
  const tris: [number, number, number][] = []
  for (let t = 0; t < triCount; t++) {
    const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3
    const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1
    const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2
    if (isExcludedVert[i0] || isExcludedVert[i1] || isExcludedVert[i2]) continue
    tris.push([i0, i1, i2])
  }
  return tris
}

async function assertAnimatedShoulderSleeveIntegrity(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const basePresets = [
    'sim_varsity',
    'ww2_sapper',
    'medieval_guard',
    'sim_executive',
    'sim_student',
    'ww2_rifleman',
    'ww2_officer',
    'medieval_squire',
    'monster_troll_brute',
  ]
  const cases: { preset: CharacterPreset; label: string; proportions: AvatarProportions }[] = basePresets.map((id) => {
    const p = presets.find((x) => x.id === id)
    if (!p) throw new Error(`Missing sleeve-audit preset "${id}"`)
    return { preset: p, label: p.id, proportions: p.proportions }
  })
  const varsity = presets.find((p) => p.id === 'sim_varsity')!
  cases.push({
    preset: { ...varsity, proportions: { ...varsity.proportions, build: 1, shoulderWidth: 0.8, torsoBulk: 1.5, limbThickness: 0.8 } },
    label: 'sim_varsity(extreme_bulk_narrow_shoulder)',
    proportions: { ...varsity.proportions, build: 1, shoulderWidth: 0.8, torsoBulk: 1.5, limbThickness: 0.8 },
  })

  const checkClips = ['Dance_Loop', 'Walk_Loop', 'Idle_Loop', 'Jog_Fwd_Loop']
  for (const item of cases) {
    const loaded = await loadPresetForAudit(item.preset, packs, STAGE_DIR, auditCache)
    const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, loaded.rigId, item.proportions)
    const mesh = loaded.meshes.find((m) => m.name.startsWith('torso_'))
    if (!mesh) continue
    const posAttr = mesh.geometry.getAttribute('position')
    const jiAttr = mesh.geometry.getAttribute('skinIndex')
    const wiAttr = mesh.geometry.getAttribute('skinWeight')
    const idxAttr = mesh.geometry.getIndex()
    const bones = mesh.skeleton.bones
    const armJointIdx = new Set<number>()
    bones.forEach((b, idx) => {
      if (/^(upperarm|lowerarm|hand)_[lr]$/.test(b.name)) armJointIdx.add(idx)
    })
    const isArmVert = new Uint8Array(posAttr.count)
    const isDistalArmVert = new Uint8Array(posAttr.count)
    const sideVerts: number[] = []
    const distalSleeveVerts: number[] = []
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i)
      const y = posAttr.getY(i)
      let armW = 0
      for (let s = 0; s < 4; s++) {
        if (armJointIdx.has(jiAttr.getComponent(i, s))) armW += wiAttr.getComponent(i, s)
      }
      if (armW >= 0.45) isArmVert[i] = 1
      if (armW >= 0.55 && Math.abs(x) >= 0.165) isDistalArmVert[i] = 1
      if (armW < 0.25 && Math.abs(x) >= 0.12 && Math.abs(x) <= 0.25 && y >= 1.34 && y <= 1.58) sideVerts.push(i)
      if (armW >= 0.55 && Math.abs(x) >= 0.165 && Math.abs(x) <= 0.28 && y >= 1.32 && y <= 1.60) {
        distalSleeveVerts.push(i)
      }
    }
    const triCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3
    const sleeveTris: [number, number, number, number][] = []
    const torsoTris: [number, number, number][] = []
    const torsoChestTris: [number, number, number][] = []
    const distalSleeveTris: [number, number, number][] = []
    for (let t = 0; t < triCount; t++) {
      const i0 = idxAttr ? idxAttr.getX(t * 3) : t * 3
      const i1 = idxAttr ? idxAttr.getX(t * 3 + 1) : t * 3 + 1
      const i2 = idxAttr ? idxAttr.getX(t * 3 + 2) : t * 3 + 2
      const c = isArmVert[i0]! + isArmVert[i1]! + isArmVert[i2]!
      if (c >= 2) {
        const avgX = (posAttr.getX(i0) + posAttr.getX(i1) + posAttr.getX(i2)) / 3
        sleeveTris.push([i0, i1, i2, avgX >= 0 ? 1 : -1])
        if (isDistalArmVert[i0] && isDistalArmVert[i1] && isDistalArmVert[i2]) {
          distalSleeveTris.push([i0, i1, i2])
        }
      } else if (c === 0) {
        torsoTris.push([i0, i1, i2])
        const minY = Math.min(posAttr.getY(i0), posAttr.getY(i1), posAttr.getY(i2))
        const maxY = Math.max(posAttr.getY(i0), posAttr.getY(i1), posAttr.getY(i2))
        if (maxY >= 1.30 && minY <= 1.58) {
          torsoChestTris.push([i0, i1, i2])
        }
      }
    }
    if (sleeveTris.length === 0) continue

    const restBones = new Map<string, Object3D>()
    loaded.root.traverse((obj) => {
      if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
    })
    const mixer = new AnimationMixer(loaded.root)
    try {
      for (const clipName of checkClips) {
        const rawClip = loaded.clips.find((c) => c.name === clipName)
        if (!rawClip) continue
        const clip = optimizeClipForAudit(rawClip, restBones)
        propCtrl.restoreRest()
        let firstFrame: Vec3Tuple[] | null = null
        let movedVerts = 0
        for (let step = 0; step < 12; step++) {
          propCtrl.unscalePelvis()
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          mixer.setTime((clip.duration * step) / 12)
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const skinned = skinMeshPositions(mesh)
          if (!firstFrame) {
            firstFrame = skinned
          } else if (movedVerts === 0) {
            for (let vi = 0; vi < skinned.length; vi++) {
              const a = firstFrame[vi]!
              const b = skinned[vi]!
              if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 0.015) movedVerts++
            }
          }
          const trisL: [Vec3Tuple, Vec3Tuple, Vec3Tuple][] = []
          const trisR: [Vec3Tuple, Vec3Tuple, Vec3Tuple][] = []
          for (const [i0, i1, i2, s] of sleeveTris) {
            const tri: [Vec3Tuple, Vec3Tuple, Vec3Tuple] = [skinned[i0]!, skinned[i1]!, skinned[i2]!]
            if (s > 0) trisL.push(tri)
            else trisR.push(tri)
          }
          const tTris: [Vec3Tuple, Vec3Tuple, Vec3Tuple][] = torsoTris.map(([i0, i1, i2]) => [
            skinned[i0]!,
            skinned[i1]!,
            skinned[i2]!,
          ])
          for (const vi of sideVerts) {
            const sideSign = posAttr.getX(vi) >= 0 ? 1 : -1
            const p = skinned[vi]!
            const sleeveMaxX = maxArmRayX(sideSign > 0 ? trisL : trisR, sideSign, p[1], p[2])
            if (sleeveMaxX !== null && p[0] * sideSign - sleeveMaxX > 0.002) {
              const msg = `Preset "${item.label}" [${clipName}] torso side wall pierces outside sleeve (+${((p[0] * sideSign - sleeveMaxX) * 1000).toFixed(1)}mm)`
              if (process.env.VALIDATE_ALL === '1') {
                console.error('SLEEVE:', msg)
                break
              }
              throw new Error(msg)
            }
          }
          for (const vi of distalSleeveVerts) {
            const p = skinned[vi]!
            const zb = rayZSpan(tTris, p[0], p[1])
            if (zb && p[2] > zb[0] + 0.004 && p[2] < zb[1] - 0.004) {
              const msg = `Preset "${item.label}" [${clipName}] sleeve vertex buried inside chest wall at (${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)})`
              if (process.env.VALIDATE_ALL === '1') {
                console.error('SLEEVE:', msg)
                break
              }
              throw new Error(msg)
            }
          }
          let hitTri = false
          for (const [si0, si1, si2] of distalSleeveTris) {
            if (hitTri) break
            const a0 = skinned[si0]!
            const a1 = skinned[si1]!
            const a2 = skinned[si2]!
            const sxMin = Math.min(a0[0], a1[0], a2[0])
            const sxMax = Math.max(a0[0], a1[0], a2[0])
            const syMin = Math.min(a0[1], a1[1], a2[1])
            const syMax = Math.max(a0[1], a1[1], a2[1])
            const szMin = Math.min(a0[2], a1[2], a2[2])
            const szMax = Math.max(a0[2], a1[2], a2[2])
            for (const [ti0, ti1, ti2] of torsoChestTris) {
              const b0 = skinned[ti0]!
              const b1 = skinned[ti1]!
              const b2 = skinned[ti2]!
              if (
                sxMax < Math.min(b0[0], b1[0], b2[0]) ||
                sxMin > Math.max(b0[0], b1[0], b2[0]) ||
                syMax < Math.min(b0[1], b1[1], b2[1]) ||
                syMin > Math.max(b0[1], b1[1], b2[1]) ||
                szMax < Math.min(b0[2], b1[2], b2[2]) ||
                szMin > Math.max(b0[2], b1[2], b2[2])
              ) {
                continue
              }
              if (triTriIntersect(a0, a1, a2, b0, b1, b2)) {
                const msg = `Preset "${item.label}" [${clipName}] sleeve triangle intersects torso chest triangle`
                if (process.env.VALIDATE_ALL === '1') {
                  console.error('SLEEVE:', msg)
                  hitTri = true
                  break
                }
                throw new Error(msg)
              }
            }
          }
        }
        if (clipName !== 'Idle_Loop' && movedVerts === 0) {
          throw new Error(`Preset "${item.label}" [${clipName}] skinning audit saw 0 moving vertices`)
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  }
}

async function assertHeldBodyCollisionFree(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const heldById = new Map<string, HeldItemEntry>()
  for (const pack of packs) {
    for (const h of pack.heldItems) heldById.set(h.id, h)
  }
  const heldMeshTrisCache = new Map<string, [Vec3Tuple, Vec3Tuple, Vec3Tuple][]>()
  const loadHeldTris = (entry: HeldItemEntry): [Vec3Tuple, Vec3Tuple, Vec3Tuple][] => {
    let cached = heldMeshTrisCache.get(entry.id)
    if (cached) return cached
    const leafDir = join(STAGE_DIR, leavesFor(entry.pack).find((l) => l.kind === entry.leaf)!.id)
    const glb = parseGlb(join(leafDir, entry.relativePath))
    const node = glb.doc.nodes!.find((n) => n.name === entry.nodeName)!
    const prim = glb.doc.meshes![node.mesh!]!.primitives[0]!
    const positions = readAccessor(glb, prim.attributes.POSITION!) as Vec3Tuple[]
    const indices = prim.indices !== undefined ? readAccessor(glb, prim.indices).map((r) => r[0]!) : positions.map((_, i) => i)
    cached = []
    for (let t = 0; t + 2 < indices.length; t += 3) {
      cached.push([positions[indices[t]!]!, positions[indices[t + 1]!]!, positions[indices[t + 2]!]!])
    }
    heldMeshTrisCache.set(entry.id, cached)
    return cached
  }

  const ual1HeldPresets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1' && (p.heldRight || p.heldLeft))
  const vTmp = new Vector3()
  const handPosR = new Vector3()
  const handPosL = new Vector3()
  const upVec = new Vector3()

  for (const preset of ual1HeldPresets) {
    const loaded = await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
    const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, loaded.rigId, preset.proportions)
    const handR = loaded.root.getObjectByName('hand_r')
    const handL = loaded.root.getObjectByName('hand_l')
    if (!handR || !handL) throw new Error(`Preset "${preset.id}" missing hand bones`)

    const restBones = new Map<string, Object3D>()
    loaded.root.traverse((obj) => {
      if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
    })

    const clipsForHeld = (heldId: string): Set<string> => {
      const set = new Set<string>([preset.clip])
      if (isArmShieldHeldItem(heldId) || /sword|katana|cleaver|club/.test(heldId)) {
        set.add('Sword_Idle')
        set.add('Sword_Attack')
      } else if (heldId === 'held_torch') {
        set.add('Idle_Torch_Loop')
      } else if (heldId === 'held_rifle') {
        set.add('Idle_Loop')
        set.add('Walk_Loop')
        set.add('Ranged_2H_Aiming')
        set.add('Ranged_2H_Shoot')
        set.add('Ranged_2H_Shooting')
        set.add('Ranged_2H_Reload')
        set.add('Pistol_Idle_Loop')
        set.add('Pistol_Shoot')
      } else if (heldId === 'held_smg' || heldId === 'held_smart_smg' || heldId === 'held_pistol') {
        set.add('Idle_Loop')
        set.add('Walk_Loop')
        set.add('Pistol_Idle_Loop')
        set.add('Pistol_Shoot')
      } else {
        set.add('Idle_Loop')
        set.add('Walk_Loop')
        set.add('Jog_Fwd_Loop')
        set.add('Walk_Formal_Loop')
      }
      return set
    }
    const rightClips = preset.heldRight ? clipsForHeld(preset.heldRight) : new Set<string>()
    const leftClips = preset.heldLeft ? clipsForHeld(preset.heldLeft) : new Set<string>()
    const clipNames = new Set<string>([...rightClips, ...leftClips])

    const meshBodyTrisR = loaded.meshes.map((m) => buildMeshVertClassification(m, 'r'))
    const meshBodyTrisL = loaded.meshes.map((m) => buildMeshVertClassification(m, 'l'))
    const armFactor = armThicknessFactorFor(preset.body, preset.proportions.build ?? 0)
    const limbThickness = preset.proportions.limbThickness
    const lowerMass = armFactor * (1 + 0.8 * (limbThickness - 1))

    const buildHeldMat = (hand: 'hand_r' | 'hand_l', heldId: string): Matrix4 => {
      const sock = UAL1_RIG.heldSockets[hand]
      const offset = heldSocketOffsetFor(sock.palmOffset, armFactor, limbThickness, new Vector3(), preset.proportions.handScale ?? 1)
      const quat = new Quaternion().setFromEuler(new Euler(sock.rotationEuler[0], sock.rotationEuler[1], sock.rotationEuler[2], 'XYZ'))
      const localMat = new Matrix4().compose(offset, quat, new Vector3(1, 1, 1))
      if (isArmShieldHeldItem(heldId)) {
        localMat.multiply(new Matrix4().makeTranslation(Math.max(0, lowerMass - 1) * 0.085, 0, 0))
      }
      const bone = hand === 'hand_r' ? handR : handL
      return new Matrix4().multiplyMatrices(bone.matrixWorld, localMat)
    }

    const transformTris = (tris: [Vec3Tuple, Vec3Tuple, Vec3Tuple][], mat: Matrix4): [Vec3Tuple, Vec3Tuple, Vec3Tuple][] =>
      tris.map(([a, b, c]) => {
        const va = vTmp.set(a[0], a[1], a[2]).applyMatrix4(mat)
        const ta: Vec3Tuple = [va.x, va.y, va.z]
        const vb = vTmp.set(b[0], b[1], b[2]).applyMatrix4(mat)
        const tb: Vec3Tuple = [vb.x, vb.y, vb.z]
        const vc = vTmp.set(c[0], c[1], c[2]).applyMatrix4(mat)
        const tc: Vec3Tuple = [vc.x, vc.y, vc.z]
        return [ta, tb, tc]
      })

    const mixer = new AnimationMixer(loaded.root)
    try {
      for (const clipName of clipNames) {
        const rawClip = loaded.clips.find((c) => c.name === clipName)
        if (!rawClip) continue
        const clip = optimizeClipForAudit(rawClip, restBones)
        propCtrl.restoreRest()
        for (let step = 0; step < 8; step++) {
          propCtrl.unscalePelvis()
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          const t = (clip.duration * step) / 8
          mixer.setTime(t)
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          handR.getWorldPosition(handPosR)
          handL.getWorldPosition(handPosL)
          const skinnedMeshes = loaded.meshes.map((m) => skinMeshPositions(m))

          for (const [hand, heldId, bodyTrisList, handWorldPos, itemClips] of [
            ['hand_r', preset.heldRight, meshBodyTrisR, handPosR, rightClips] as const,
            ['hand_l', preset.heldLeft, meshBodyTrisL, handPosL, leftClips] as const,
          ]) {
            if (!heldId || !itemClips.has(clipName)) continue
            const entry = heldById.get(heldId)
            if (!entry) continue
            const worldMat = buildHeldMat(hand, heldId)
            if (heldId === 'held_coffee_cup' && (clipName === 'Idle_Loop' || clipName === 'Jog_Fwd_Loop')) {
              upVec.set(0, 0.8660254, -0.5).transformDirection(worldMat)
              if (upVec.y < 0.45) {
                const msg = `Preset "${preset.id}" [${clipName}] held_coffee_cup is tilted sideways/downward (up.y=${upVec.y.toFixed(3)} < 0.45)`
                if (process.env.VALIDATE_ALL === '1') {
                  console.error('HELD TILT:', msg)
                  break
                }
                throw new Error(msg)
              }
            }
            const hTris = transformTris(loadHeldTris(entry), worldMat)
            let hxMin = Infinity
            let hyMin = Infinity
            let hzMin = Infinity
            let hxMax = -Infinity
            let hyMax = -Infinity
            let hzMax = -Infinity
            for (const [a, b, c] of hTris) {
              for (const p of [a, b, c]) {
                if (p[0] < hxMin) hxMin = p[0]
                if (p[1] < hyMin) hyMin = p[1]
                if (p[2] < hzMin) hzMin = p[2]
                if (p[0] > hxMax) hxMax = p[0]
                if (p[1] > hyMax) hyMax = p[1]
                if (p[2] > hzMax) hzMax = p[2]
              }
            }
            let hits = 0
            let sampleHit = ''
            const hitMeshes = new Map<string, number>()
            for (let mi = 0; mi < loaded.meshes.length; mi++) {
              const sk = skinnedMeshes[mi]!
              const meshName = loaded.meshes[mi]!.name
              for (const [i0, i1, i2] of bodyTrisList[mi]!) {
                const b0 = sk[i0]!
                const b1 = sk[i1]!
                const b2 = sk[i2]!
                // Ignore wrist seam within 6.5cm centroid or any vertex within 5.5cm of palm bone
                const cx = (b0[0] + b1[0] + b2[0]) / 3 - handWorldPos.x
                const cy = (b0[1] + b1[1] + b2[1]) / 3 - handWorldPos.y
                const cz = (b0[2] + b1[2] + b2[2]) / 3 - handWorldPos.z
                if (cx * cx + cy * cy + cz * cz <= 0.065 * 0.065) continue
                const d0Sq = (b0[0] - handWorldPos.x) ** 2 + (b0[1] - handWorldPos.y) ** 2 + (b0[2] - handWorldPos.z) ** 2
                const d1Sq = (b1[0] - handWorldPos.x) ** 2 + (b1[1] - handWorldPos.y) ** 2 + (b1[2] - handWorldPos.z) ** 2
                const d2Sq = (b2[0] - handWorldPos.x) ** 2 + (b2[1] - handWorldPos.y) ** 2 + (b2[2] - handWorldPos.z) ** 2
                if (Math.min(d0Sq, d1Sq, d2Sq) <= 0.055 * 0.055) continue
                if (
                  hxMax < Math.min(b0[0], b1[0], b2[0]) ||
                  hxMin > Math.max(b0[0], b1[0], b2[0]) ||
                  hyMax < Math.min(b0[1], b1[1], b2[1]) ||
                  hyMin > Math.max(b0[1], b1[1], b2[1]) ||
                  hzMax < Math.min(b0[2], b1[2], b2[2]) ||
                  hzMin > Math.max(b0[2], b1[2], b2[2])
                ) {
                  continue
                }
                const bxMin = Math.min(b0[0], b1[0], b2[0])
                const bxMax = Math.max(b0[0], b1[0], b2[0])
                const byMin = Math.min(b0[1], b1[1], b2[1])
                const byMax = Math.max(b0[1], b1[1], b2[1])
                const bzMin = Math.min(b0[2], b1[2], b2[2])
                const bzMax = Math.max(b0[2], b1[2], b2[2])
                for (const [a0, a1, a2] of hTris) {
                  if (
                    bxMax < Math.min(a0[0], a1[0], a2[0]) ||
                    bxMin > Math.max(a0[0], a1[0], a2[0]) ||
                    byMax < Math.min(a0[1], a1[1], a2[1]) ||
                    byMin > Math.max(a0[1], a1[1], a2[1]) ||
                    bzMax < Math.min(a0[2], a1[2], a2[2]) ||
                    bzMin > Math.max(a0[2], a1[2], a2[2])
                  ) {
                    continue
                  }
                  if (triTriIntersect(a0, a1, a2, b0, b1, b2)) {
                    hits++
                    hitMeshes.set(meshName, (hitMeshes.get(meshName) ?? 0) + 1)
                    if (!sampleHit) {
                      const hc = [
                        ((a0[0] + a1[0] + a2[0]) / 3).toFixed(3),
                        ((a0[1] + a1[1] + a2[1]) / 3).toFixed(3),
                        ((a0[2] + a1[2] + a2[2]) / 3).toFixed(3),
                      ].join(',')
                      sampleHit = ` @(${hc})`
                    }
                  }
                }
              }
            }
            if (hits > 0) {
              const detail = [...hitMeshes.entries()].map(([n, c]) => `${n}:${c}`).join(', ')
              const msg = `Preset "${preset.id}" [${clipName}@${t.toFixed(2)}s] ${heldId} intersects body/garment (${hits} tris: ${detail}${sampleHit})`
              if (process.env.VALIDATE_ALL === '1') {
                console.error('HELD COLLISION:', msg)
                break
              }
              throw new Error(msg)
            }
          }
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  }
}

function collectRestYBandTriangles(mesh: SkinnedMesh, restYMin: number, restYMax: number): [number, number, number][] {
  const pos = mesh.geometry.getAttribute('position')
  const idx = mesh.geometry.getIndex()
  const triCount = idx ? idx.count / 3 : pos.count / 3
  const tris: [number, number, number][] = []
  for (let t = 0; t < triCount; t++) {
    const a = idx ? idx.getX(t * 3) : t * 3
    const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
    const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
    const minY = Math.min(pos.getY(a), pos.getY(b), pos.getY(c))
    const maxY = Math.max(pos.getY(a), pos.getY(b), pos.getY(c))
    if (minY >= restYMin && maxY <= restYMax) tris.push([a, b, c])
  }
  return tris
}

function countTriangleIntersections(
  posA: Vec3Tuple[],
  trisA: [number, number, number][],
  posB: Vec3Tuple[],
  trisB: [number, number, number][],
): number {
  let hits = 0
  for (const [a0, a1, a2] of trisA) {
    const p0 = posA[a0]!
    const p1 = posA[a1]!
    const p2 = posA[a2]!
    const axMin = Math.min(p0[0], p1[0], p2[0])
    const axMax = Math.max(p0[0], p1[0], p2[0])
    const ayMin = Math.min(p0[1], p1[1], p2[1])
    const ayMax = Math.max(p0[1], p1[1], p2[1])
    const azMin = Math.min(p0[2], p1[2], p2[2])
    const azMax = Math.max(p0[2], p1[2], p2[2])
    for (const [b0, b1, b2] of trisB) {
      const q0 = posB[b0]!
      const q1 = posB[b1]!
      const q2 = posB[b2]!
      if (
        axMax < Math.min(q0[0], q1[0], q2[0]) ||
        axMin > Math.max(q0[0], q1[0], q2[0]) ||
        ayMax < Math.min(q0[1], q1[1], q2[1]) ||
        ayMin > Math.max(q0[1], q1[1], q2[1]) ||
        azMax < Math.min(q0[2], q1[2], q2[2]) ||
        azMin > Math.max(q0[2], q1[2], q2[2])
      ) {
        continue
      }
      if (triTriIntersect(p0, p1, p2, q0, q1, q2)) {
        hits++
        break
      }
    }
  }
  return hits
}

async function assertGarmentLegClearance(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const ual1Presets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1')
  const presetClips = [
    'Idle_Loop',
    'Walk_Loop',
    'Jog_Fwd_Loop',
    'Sitting_Idle_Loop',
    'Sword_Idle',
    'Sword_Attack',
    'Pistol_Idle_Loop',
    'Ranged_2H_Aiming',
    'Dance_Loop',
  ]
  const failOrLog = (msg: string) => {
    if (process.env.VALIDATE_ALL === '1') console.error('GARMENT CLIP:', msg)
    else throw new Error(msg)
  }

  for (const preset of ual1Presets) {
    const loaded = await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
    const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, loaded.rigId, preset.proportions)
    const torso = loaded.meshes.find((m) => m.name.startsWith('torso_'))
    const legs = loaded.meshes.find((m) => m.name.startsWith('legs_'))
    const body = loaded.meshes.find((m) => m.name.startsWith('body_'))
    if (!torso || !legs || !body) continue

    const tp = torso.geometry.getAttribute('position')
    let minY = Infinity
    for (let i = 0; i < tp.count; i++) minY = Math.min(minY, tp.getY(i))
    const tTris = collectRestYBandTriangles(torso, minY - 0.01, 1.16)
    const lTris = collectRestYBandTriangles(legs, Math.max(0.60, minY + 0.012), 1.135)
    const bTris = collectRestYBandTriangles(body, Math.max(0.60, minY + 0.012), 1.135)

    propCtrl.restoreRest()
    propCtrl.scalePelvis()
    loaded.root.updateMatrixWorld(true)
    const bindTorso = skinMeshPositions(torso)
    const bindLegs = skinMeshPositions(legs)
    const bindBody = skinMeshPositions(body)
    const bindLegHits = countTriangleIntersections(bindLegs, lTris, bindTorso, tTris)
    const bindBodyHits = countTriangleIntersections(bindBody, bTris, bindTorso, tTris)
    if (bindLegHits > 0 || bindBodyHits > 0) {
      failOrLog(`Preset "${preset.id}" [bind] torso clips lower body (legs=${bindLegHits}, body=${bindBodyHits})`)
    }

    const checkMonsterKilt = preset.id === 'monster_orc_warlord' || preset.id === 'monster_troll_brute'
    const kiltBodyTris = checkMonsterKilt ? collectRestYBandTriangles(body, 0.0, 1.14) : []
    const kiltLegTris = checkMonsterKilt ? collectRestYBandTriangles(legs, 0.55, 1.14) : []
    if (checkMonsterKilt) {
      const bindKiltHits = countTriangleIntersections(bindBody, kiltBodyTris, bindLegs, kiltLegTris)
      if (bindKiltHits > 0) {
        failOrLog(`Preset "${preset.id}" [bind] kilt/wraps clips body (${bindKiltHits} tris)`)
      }
    }

    const restBones = new Map<string, Object3D>()
    loaded.root.traverse((obj) => {
      if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
    })
    const mixer = new AnimationMixer(loaded.root)
    try {
      for (const clipName of presetClips) {
        const rawClip = loaded.clips.find((c) => c.name === clipName)
        if (!rawClip) continue
        const clip = optimizeClipForAudit(rawClip, restBones)
        for (let step = 0; step < 8; step++) {
          propCtrl.unscalePelvis()
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          const t = (clip.duration * step) / 8
          mixer.setTime(t)
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const pLegs = skinMeshPositions(legs)
          const pTorso = skinMeshPositions(torso)
          const hits = countTriangleIntersections(pLegs, lTris, pTorso, tTris)
          if (hits > 0) {
            failOrLog(`Preset "${preset.id}" [${clipName}@${t.toFixed(2)}s] torso clips legs (${hits} tris)`)
            break
          }
          if (checkMonsterKilt) {
            const pBody = skinMeshPositions(body)
            const kh = countTriangleIntersections(pBody, kiltBodyTris, pLegs, kiltLegTris)
            if (kh > 0) {
              failOrLog(`Preset "${preset.id}" [${clipName}@${t.toFixed(2)}s] kilt/wraps clips body (${kh} tris)`)
              break
            }
          }
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  }

  // Cross-pack garment compatibility matrix (bind + animated poses across bodies, legs, and build slider).
  const template = ual1Presets[0]!
  const baseProp: AvatarProportions = {
    height: 1,
    legRatio: 1,
    build: 0,
    shoulderWidth: 1,
    torsoBulk: 1,
    waistScale: 1,
    headScale: 1,
    limbThickness: 1,
    armLength: 1,
    bodyLength: 1,
  }
  const matrixTorsos = ['torso_medieval_tunic', 'torso_ww2_trenchcoat', 'torso_medieval_knight']
  const matrixBodies = ['body_athletic', 'body_heavy', 'body_slim', 'body_orc', 'body_troll']
  const matrixLegs = [
    'legs_core_shorts',
    'legs_medieval_greaves',
    'legs_medieval_breeches',
    'legs_ww2_field_trousers',
    'legs_sim_jeans',
    'legs_sim_shorts',
  ]
  const animLegsSet = new Set(['legs_medieval_greaves', 'legs_ww2_field_trousers'])
  const animClips = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sitting_Idle_Loop', 'Sword_Idle']

  for (const torsoId of matrixTorsos) {
    for (const bodyId of matrixBodies) {
      for (const legsId of matrixLegs) {
        const builds = bodyId === 'body_orc' || bodyId === 'body_troll' ? [0] : [0, -1, 1]
        for (const build of builds) {
          const custom: CharacterPreset = {
            ...template,
            id: `${torsoId}+${bodyId}+${legsId}+b${build}`,
            rigId: 'ual1',
            body: bodyId,
            head: 'head_hero',
            hair: 'hair_short_part',
            torso: torsoId,
            legs: legsId,
            heldRight: null,
            heldLeft: null,
            proportions: { ...baseProp, build },
          }
          const loaded = await loadPresetForAudit(custom, packs, STAGE_DIR, auditCache)
          const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, 'ual1', custom.proportions)
          const torso = loaded.meshes.find((m) => m.name.startsWith('torso_'))!
          const legs = loaded.meshes.find((m) => m.name.startsWith('legs_'))!
          const body = loaded.meshes.find((m) => m.name.startsWith('body_'))!
          const tp = torso.geometry.getAttribute('position')
          let minY = Infinity
          for (let i = 0; i < tp.count; i++) minY = Math.min(minY, tp.getY(i))
          const tTris = collectRestYBandTriangles(torso, minY - 0.01, 1.16)
          const lTris = collectRestYBandTriangles(legs, Math.max(0.60, minY + 0.012), 1.135)
          const bTris = collectRestYBandTriangles(body, Math.max(0.60, minY + 0.012), 1.135)

          propCtrl.restoreRest()
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const pTorso = skinMeshPositions(torso)
          const bl = countTriangleIntersections(skinMeshPositions(legs), lTris, pTorso, tTris)
          const bb = countTriangleIntersections(skinMeshPositions(body), bTris, pTorso, tTris)
          if (bl > 0 || bb > 0) {
            failOrLog(`Cross-pack [bind] ${custom.id}: torso clips lower body (legs=${bl}, body=${bb})`)
          }

          if (build === 0 && animLegsSet.has(legsId) && bodyId !== 'body_slim') {
            const restBones = new Map<string, Object3D>()
            loaded.root.traverse((obj) => {
              if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
            })
            const mixer = new AnimationMixer(loaded.root)
            try {
              for (const clipName of animClips) {
                const rawClip = loaded.clips.find((c) => c.name === clipName)
                if (!rawClip) continue
                const clip = optimizeClipForAudit(rawClip, restBones)
                for (let step = 0; step < 8; step++) {
                  propCtrl.unscalePelvis()
                  mixer.stopAllAction()
                  mixer.clipAction(clip).reset().play()
                  const t = (clip.duration * step) / 8
                  mixer.setTime(t)
                  propCtrl.scalePelvis()
                  loaded.root.updateMatrixWorld(true)
                  const hits = countTriangleIntersections(skinMeshPositions(legs), lTris, skinMeshPositions(torso), tTris)
                  if (hits > 0) {
                    failOrLog(`Cross-pack [${clipName}@${t.toFixed(2)}s] ${custom.id}: torso clips legs (${hits} tris)`)
                    break
                  }
                }
              }
            } finally {
              mixer.stopAllAction()
            }
          }
        }
      }
    }
  }
}

async function assertNeckHeadAlignment(
  presets: CharacterPreset[],
  packs: PackCatalog[],
  auditCache: Map<string, Awaited<ReturnType<typeof loadGlbHeadless>>>,
): Promise<void> {
  const ual1Presets = presets.filter((p) => (p.rigId ?? 'ual1') === 'ual1')
  const template = ual1Presets[0]
  if (!template) return
  const baseProp: AvatarProportions = {
    height: 1,
    legRatio: 1,
    build: 0,
    shoulderWidth: 1,
    torsoBulk: 1,
    waistScale: 1,
    headScale: 1,
    limbThickness: 1,
    armLength: 1,
    bodyLength: 1,
  }
  const bodies = ['body_athletic', 'body_heavy', 'body_slim', 'body_orc', 'body_troll']
  const heads = ['head_hero', 'head_stern', 'head_cheerful', 'head_orc', 'head_troll']

  const outerHeadBaseTris = (headMesh: SkinnedMesh) => {
    const pos = headMesh.geometry.getAttribute('position')
    return collectRestYBandTriangles(headMesh, 1.676, 1.770).filter(([a, b, c]) => {
      const y0 = pos.getY(a)
      const y1 = pos.getY(b)
      const y2 = pos.getY(c)
      const minY = Math.min(y0, y1, y2)
      const maxY = Math.max(y0, y1, y2)
      return maxY >= 1.690 || maxY - minY > 0.003
    })
  }

  for (const bodyId of bodies) {
    for (const headId of heads) {
      const builds = bodyId === 'body_orc' || bodyId === 'body_troll' ? [0] : [0, -1, 1]
      for (const build of builds) {
        const custom: CharacterPreset = {
          ...template,
          id: `${bodyId}+${headId}+b${build}`,
          rigId: 'ual1',
          body: bodyId,
          head: headId,
          hair: null,
          headwear: null,
          torso: null,
          legs: null,
          back: null,
          heldRight: null,
          heldLeft: null,
          proportions: { ...baseProp, build },
        }
        const loaded = await loadPresetForAudit(custom, packs, STAGE_DIR, auditCache)
        const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, 'ual1', custom.proportions)
        const bodyMesh = loaded.meshes.find((m) => m.name === bodyId)
        const headMesh = loaded.meshes.find((m) => m.name === headId)
        if (!bodyMesh || !headMesh) throw new Error(`Missing ${bodyId} or ${headId} in neck-head alignment audit`)

        const neckTris = collectRestYBandTriangles(bodyMesh, 1.608, 1.700)
        const headTris = outerHeadBaseTris(headMesh)
        const jawIdx = headMesh.morphTargetDictionary?.['jaw']

        for (const jaw of jawIdx !== undefined ? [0, -1] : [0]) {
          if (jawIdx !== undefined && headMesh.morphTargetInfluences) {
            headMesh.morphTargetInfluences[jawIdx] = jaw
          }
          propCtrl.restoreRest()
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const hits = countTriangleIntersections(skinMeshPositions(bodyMesh), neckTris, skinMeshPositions(headMesh), headTris)
          if (hits > 0) {
            throw new Error(`Neck/head polygon mismatch on ${custom.id} (jaw=${jaw}): ${hits} intersecting tris`)
          }
        }
      }
    }
  }

  const headMotionClips = ['Idle_Loop', 'Walk_Loop', 'Sword_Attack', 'Dance_Loop']
  for (const preset of ual1Presets) {
    const loaded = await loadPresetForAudit(preset, packs, STAGE_DIR, auditCache)
    const propCtrl = createAuditProportionController(loaded.root, loaded.meshes, 'ual1', preset.proportions)
    const bodyMesh = loaded.meshes.find((m) => m.name.startsWith('body_'))
    const headMesh = loaded.meshes.find((m) => m.name.startsWith('head_'))
    if (!bodyMesh || !headMesh) continue

    const neckTris = collectRestYBandTriangles(bodyMesh, 1.608, 1.700)
    const headTris = outerHeadBaseTris(headMesh)
    const restBones = new Map<string, Object3D>()
    loaded.root.traverse((obj) => {
      if (obj.name && obj.type === 'Bone') restBones.set(obj.name, obj)
    })
    const mixer = new AnimationMixer(loaded.root)
    try {
      for (const clipName of headMotionClips) {
        const rawClip = loaded.clips.find((c) => c.name === clipName)
        if (!rawClip) continue
        const clip = optimizeClipForAudit(rawClip, restBones)
        for (let step = 0; step < 4; step++) {
          propCtrl.unscalePelvis()
          mixer.stopAllAction()
          mixer.clipAction(clip).reset().play()
          const t = (clip.duration * step) / 4
          mixer.setTime(t)
          propCtrl.scalePelvis()
          loaded.root.updateMatrixWorld(true)
          const hits = countTriangleIntersections(skinMeshPositions(bodyMesh), neckTris, skinMeshPositions(headMesh), headTris)
          if (hits > 0) {
            throw new Error(`Preset "${preset.id}" [${clipName}@${t.toFixed(2)}s] neck intersects outer head shell (${hits} tris)`)
          }
        }
      }
    } finally {
      mixer.stopAllAction()
    }
  }
}

function assertRigSkeleton(glb: ParsedGlb, fileLabel: string, rigId: RigId): void {
  const expected = RIG_SPECS[rigId].joints
  const skins = glb.doc.skins ?? []
  if (skins.length !== 1) throw new Error(`${fileLabel}: expected exactly 1 skin, found ${skins.length}`)
  const joints = skins[0]!.joints.map((idx) => glb.doc.nodes?.[idx]?.name ?? '')
  if (joints.length !== expected.length) {
    throw new Error(`${fileLabel} (${rigId}): expected ${expected.length} joints, found ${joints.length}`)
  }
  for (let i = 0; i < expected.length; i++) {
    if (joints[i] !== expected[i]) {
      throw new Error(`${fileLabel} (${rigId}): joint[${i}] is "${joints[i]}", expected "${expected[i]}"`)
    }
  }
}

interface BudgetPart {
  part: AvatarPartEntry
  triangles: number
  covers: string[]
  regions: [string, number][]
}

function assertComposedSlotBudget(parts: BudgetPart[], held: HeldItemEntry[]): void {
  const slots = ['body', 'headwear', 'hair', 'head', 'torso', 'legs', 'back']
  const options = slots.map((slot) => parts.filter((p) => p.part.slot === slot))
  const heldTriangles = ['hand_l', 'hand_r'].reduce(
    (sum, hand) => sum + Math.max(0, ...held.filter((h) => h.hand === hand).map((h) => h.triangles)), 0,
  )
  const chosen: BudgetPart[] = []
  let worst = 0
  let worstParts: string[] = []
  function visit(slot: number, covered: Set<string>, hideHair: boolean): void {
    if (slot === slots.length) {
      let total = heldTriangles
      for (const p of chosen) {
        total += p.triangles
        for (const [tag, triangles] of p.regions) if (covered.has(tag)) total -= triangles
      }
      if (total > worst) {
        worst = total
        worstParts = chosen.map((p) => p.part.id)
      }
      return
    }
    if (slots[slot] !== 'body') visit(slot + 1, covered, hideHair)
    if (hideHair && slots[slot] === 'hair') return
    for (const p of options[slot]!) {
      chosen.push(p)
      visit(slot + 1, new Set([...covered, ...p.covers]), hideHair || p.part.rules.hidesHair)
      chosen.pop()
    }
  }
  visit(0, new Set(), false)
  const limit = BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar
  if (worst > limit) throw new Error(`Composed slot mix exceeds ${limit}: ${worst} triangles (${worstParts.join(', ')})`)
  console.log(`Worst visible UAL1 slot mix with both hands: ${worst} / ${limit} triangles`)
}

async function main(): Promise<void> {
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error(`Missing build manifest: ${manifestPath}. Run npm run build first.`)
  const manifest = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
  assertNoOrphanGlbs(manifest)

  let totalModels = 0
  let totalParts = 0

  for (const pack of POLY_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const licPath = join(STAGE_DIR, leaf.id, 'License.txt')
      if (!existsSync(licPath)) throw new Error(`Missing License.txt in ${leaf.id}`)
    }
  }

  const budgetParts: BudgetPart[] = []
  const allParts = manifest.packs.flatMap((p) => p.parts)
  const allHeld = manifest.packs.flatMap((p) => p.heldItems)

  for (const cat of manifest.packs) {
    const charLeafDir = join(STAGE_DIR, leavesFor(cat.pack).find((l) => l.kind === 'characters')!.id)
    if (cat.pack === 'core') {
      if (!cat.rigModelPath) throw new Error('core pack missing rigModelPath')
      const rigPath = join(charLeafDir, cat.rigModelPath)
      const glb = parseGlb(rigPath)
      assertRigSkeleton(glb, rigPath, 'ual1')
      const anims = new Set((glb.doc.animations ?? []).map((a) => a.name ?? ''))
      for (const reqClip of RIG_SPECS.ual1.clips) {
        if (!anims.has(reqClip)) throw new Error(`core-rig.glb missing required UAL1 clip "${reqClip}"`)
      }
      if ((glb.doc.materials?.length ?? 0) > 1) {
        throw new Error(`core-rig.glb has ${glb.doc.materials?.length} materials; S23 Ultra budget allows 1`)
      }
    }

    for (const creatureRig of cat.creatureRigs ?? []) {
      const rigPath = join(charLeafDir, creatureRig.rigModelPath)
      const glb = parseGlb(rigPath)
      assertRigSkeleton(glb, rigPath, creatureRig.rigId)
      const anims = new Set((glb.doc.animations ?? []).map((a) => a.name ?? ''))
      for (const reqClip of RIG_SPECS[creatureRig.rigId].clips) {
        if (!anims.has(reqClip)) {
          throw new Error(`${creatureRig.rigModelPath} missing required ${creatureRig.rigId} clip "${reqClip}"`)
        }
      }
      if ((glb.doc.materials?.length ?? 0) > 1) {
        throw new Error(`${creatureRig.rigModelPath} has ${glb.doc.materials?.length} materials; S23 Ultra budget allows 1`)
      }
    }

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
      const rigId = part.rigId ?? 'ual1'
      const glb = loadCached(part.leaf, part.relativePath)
      assertRigSkeleton(glb, part.relativePath, rigId)
      assertFiniteWeightsAndPositions(glb, part.nodeName, true, RIG_SPECS[rigId].joints.length)
      assertNoSelfCover(glb, part.nodeName)
      assertCoveredRegionContinuity(glb, part)
      assertChestCollarCoverage(glb, part.nodeName)
      assertChestFrontAppliqueClearance(glb, part)
      assertMorphAndLayerContracts(glb, part)
      assertCreatureLegSides(glb, part.nodeName, rigId)
      assertShoulderSocketUniformity(glb, part)
      const failPart = (msg: string) => {
        if (process.env.VALIDATE_ALL === '1') console.error('PART STRUCT:', msg)
        else throw new Error(msg)
      }
      assertHingeJointRingProximity(glb, part, failPart)
      if (!part.ragdollColliders || Object.keys(part.ragdollColliders).length === 0) {
        throw new Error(`Part "${part.id}" is missing mesh-measured ragdollColliders`)
      }
      if (part.slot === 'body') {
        const expectedBodies = RAGDOLL_RIG_TEMPLATES[rigId].bodies.length
        const foundBodies = Object.keys(part.ragdollColliders).length
        if (foundBodies !== expectedBodies) {
          throw new Error(`Body part "${part.id}" (${rigId}) has ${foundBodies} ragdollColliders, expected ${expectedBodies}`)
        }
      }
      const node = glb.doc.nodes!.find((n) => n.name === part.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      const budget = BUDGETS.classes[part.slot]
      if (tris > budget.maxTriangles) {
        throw new Error(`Part "${part.id}" has ${tris} tris > budget ${budget.maxTriangles}`)
      }
      if (rigId === 'ual1') {
        const extras = partExtrasSchema.parse(node.extras ?? {})
        const covers = extras.polyCovers ?? []
        if (part.rules.hidesLegsUpper) covers.push('legs_waist')
        if (part.rules.hidesHair) covers.push('hair')
        budgetParts.push({
          part, triangles: tris, covers,
          regions: Object.entries(extras.polyRegions ?? {}).map(([tag, [, count]]) => [tag, count / 3]),
        })
      }
    }

    for (const held of cat.heldItems) {
      totalModels++
      const glb = loadCached(held.leaf, held.relativePath)
      assertFiniteWeightsAndPositions(glb, held.nodeName, false, 0)
      assertHeldPalmClearance(glb, held)
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
      assertFiniteWeightsAndPositions(glb, prop.nodeName, false, 0)
      const node = glb.doc.nodes!.find((n) => n.name === prop.nodeName)!
      const tris = nodeTriangleCount(glb, node)
      if (tris > BUDGETS.classes.prop.maxTriangles) {
        throw new Error(`Prop "${prop.id}" has ${tris} tris > budget ${BUDGETS.classes.prop.maxTriangles}`)
      }
      if (Math.abs(prop.bounds.min[1]) > 0.015) {
        throw new Error(`Prop "${prop.id}" not grounded on y=0 (min.y=${prop.bounds.min[1]})`)
      }
    }

    // Check composed avatar triangle budget INCLUDING held items and complete ragdoll metadata for every preset
    for (const preset of cat.presets) {
      const rigId = preset.rigId ?? 'ual1'
      if (!preset.ragdoll) {
        throw new Error(`Preset "${preset.id}" is missing ragdoll physics metadata`)
      }
      const expectedBodies = RAGDOLL_RIG_TEMPLATES[rigId].bodies.length
      if (preset.ragdoll.rigId !== rigId || preset.ragdoll.bodies.length !== expectedBodies) {
        throw new Error(
          `Preset "${preset.id}" ragdoll has ${preset.ragdoll.bodies.length} bodies (${preset.ragdoll.rigId}), expected ${expectedBodies} (${rigId})`,
        )
      }
      const seenBodies = new Set<string>()
      for (const body of preset.ragdoll.bodies) {
        if (body.parentBody && !seenBodies.has(body.parentBody)) {
          throw new Error(`Preset "${preset.id}" ragdoll body "${body.bone}" references unknown/out-of-order parent "${body.parentBody}"`)
        }
        seenBodies.add(body.bone)
      }

      const headwear = preset.headwear ? allParts.find((p) => p.id === preset.headwear) : undefined
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
      let sum = partIds.reduce((acc, id) => {
        const found = allParts.find((p) => p.id === id)
        if (!found) throw new Error(`Preset "${preset.id}" references missing part "${id}"`)
        return acc + found.triangles
      }, 0)
      for (const heldId of [preset.heldRight, preset.heldLeft]) {
        if (!heldId) continue
        const found = allHeld.find((h) => h.id === heldId)
        if (!found) throw new Error(`Preset "${preset.id}" references missing held item "${heldId}"`)
        sum += found.triangles
      }
      if (sum > BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar) {
        throw new Error(
          `Preset "${preset.id}" composed triangles with held (${sum}) exceed S23 Ultra cap (${BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar})`,
        )
      }
    }
  }

  assertComposedSlotBudget(budgetParts, allHeld)

  // Geometry-accurate animation audits on creature clips and UAL1 presets
  const auditCache = new Map<string, Awaited<ReturnType<typeof import('../src/animationAudit').loadGlbHeadless>>>()
  const allPresets = manifest.packs.flatMap((p) => p.presets)
  await assertHeldPresetClips(allPresets, auditCache)
  await assertHeldBodyCollisionFree(allPresets, manifest.packs, auditCache)
  await assertAnimatedShoulderSleeveIntegrity(allPresets, manifest.packs, auditCache)
  await assertGarmentLegClearance(allPresets, manifest.packs, auditCache)
  await assertNeckHeadAlignment(allPresets, manifest.packs, auditCache)
  const failAudit = (tag: string) => (msg: string) => {
    if (process.env.VALIDATE_ALL === '1') console.error(`${tag}:`, msg)
    else throw new Error(msg)
  }
  await assertJointRingPreservation(allPresets, manifest.packs, auditCache, failAudit('RING PRESERVE'))
  await assertConnectionSeamContainment(allPresets, manifest.packs, auditCache, failAudit('SEAM CONTAIN'))

  const GROUNDED_EVERY_FRAME_CLIPS = new Set([
    'Idle',
    'Walk',
    'Howl',
    'A_TPose',
    'Idle_Loop',
    'Walk_Loop',
    'Walk_Formal_Loop',
    'Sword_Idle',
    'Pistol_Idle_Loop',
    'Crouch_Idle_Loop',
    'Ranged_2H_Aiming',
    'Ranged_2H_Shooting',
    'Ranged_2H_Reload',
    'Idle_Shield_Loop',
    'Idle_TalkingPhone_Loop',
    'Idle_FoldArms_Loop',
    'Zombie_Idle_Loop',
  ])
  const cleanClipChecks: { presetId: string; clips?: string[] }[] = [
    { presetId: 'monster_dire_wolf' },
    { presetId: 'monster_warhorse' },
    { presetId: 'monster_giant_spider' },
    { presetId: 'monster_frost_eagle' },
    { presetId: 'monster_ember_drake' },
    { presetId: 'monster_tyrant_rex' },
    { presetId: 'monster_basilisk' },
    { presetId: 'monster_abyssal_shark' },
    {
      presetId: 'core_athletic',
      clips: [
        'A_TPose',
        'Idle_Loop',
        'Walk_Loop',
        'Jog_Fwd_Loop',
        'Crouch_Idle_Loop',
        'Sword_Idle',
        'Sword_Attack',
        'Spell_Simple_Idle_Loop',
        'Spell_Simple_Shoot',
        'Pistol_Idle_Loop',
        'Death01',
        'Consume',
        'Farm_Harvest',
        'Idle_Shield_Loop',
        'Idle_TalkingPhone_Loop',
        'LayToIdle',
        'Shield_OneShot',
        'Sword_Regular_A',
        'Sword_Regular_B',
        'TreeChopping_Loop',
        'Zombie_Idle_Loop',
        'Zombie_Walk_Fwd_Loop',
        'Ranged_2H_Aiming',
        'Ranged_2H_Reload',
        'Ranged_2H_Shoot',
        'Ranged_2H_Shooting',
      ],
    },
    { presetId: 'medieval_knight', clips: ['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Sword_Regular_A_Rec', 'Idle_Shield_Loop', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'medieval_squire', clips: ['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Jog_Fwd_Loop', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'medieval_guard', clips: ['A_TPose', 'Sword_Idle', 'Idle_Shield_Loop', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'ww2_rifleman', clips: ['A_TPose', 'Ranged_2H_Aiming', 'Ranged_2H_Shoot', 'Ranged_2H_Shooting', 'Ranged_2H_Reload', 'Pistol_Idle_Loop', 'Walk_Loop'] },
    { presetId: 'ww2_sapper', clips: ['A_TPose', 'Ranged_2H_Aiming', 'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop'] },
    {
      presetId: 'ww2_officer',
      clips: [
        'A_TPose',
        'Pistol_Idle_Loop',
        'Pistol_Aim_Neutral',
        'Pistol_Aim_Up',
        'Pistol_Aim_Down',
        'Pistol_Shoot',
        'Pistol_Reload',
        'Walk_Loop',
        'Idle_Loop',
      ],
    },
    { presetId: 'sim_executive', clips: ['A_TPose', 'Walk_Formal_Loop', 'Idle_TalkingPhone_Loop', 'Idle_Loop'] },
    { presetId: 'sim_varsity', clips: ['A_TPose', 'Dance_Loop', 'Walk_Loop', 'Idle_Loop'] },
    { presetId: 'sim_student', clips: ['A_TPose', 'Jog_Fwd_Loop', 'Idle_TalkingPhone_Loop', 'Idle_Loop'] },
    { presetId: 'cyber_edgerunner', clips: ['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'cyber_netrunner', clips: ['A_TPose', 'Idle_TalkingPhone_Loop', 'Jog_Fwd_Loop', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'cyber_enforcer', clips: ['A_TPose', 'Pistol_Idle_Loop', 'Pistol_Shoot', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'cyber_ronin', clips: ['A_TPose', 'Sword_Attack', 'Sword_Idle', 'Jog_Fwd_Loop', 'Idle_Loop'] },
    { presetId: 'monster_orc_warlord', clips: ['A_TPose', 'Sword_Attack', 'Idle_Shield_Loop', 'Idle_Loop', 'Walk_Loop'] },
    { presetId: 'monster_troll_brute', clips: ['A_TPose', 'Sword_Idle', 'Sword_Attack', 'Idle_Loop', 'Walk_Loop'] },
  ]
  const STATIONARY_GROUNDED_CLIPS = new Set([
    'A_TPose',
    'Idle_Loop',
    'Sword_Idle',
    'Pistol_Idle_Loop',
    'Crouch_Idle_Loop',
    'Ranged_2H_Aiming',
    'Idle_Shield_Loop',
    'Idle_TalkingPhone_Loop',
    'Idle_FoldArms_Loop',
    'Zombie_Idle_Loop',
  ])
  for (const check of cleanClipChecks) {
    const preset = allPresets.find((p) => p.id === check.presetId)
    if (!preset) throw new Error(`Missing audit preset "${check.presetId}"`)
    const loaded = await loadPresetForAudit(preset, manifest.packs, STAGE_DIR, auditCache)
    const clips = check.clips ? loaded.clips.filter((c) => check.clips!.includes(c.name)) : loaded.clips
    const reports = auditRigClips(loaded.root, loaded.meshes, clips, {
      rigId: loaded.rigId,
      ragdoll: loaded.ragdoll,
      proportions: preset.proportions,
      sampleHz: 24,
    })
    for (const report of reports) {
      if (report.errors > 0) {
        const msg = `Animation audit failed on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('CLIP ERROR:', msg)
        else throw new Error(msg)
      }
      const floorLimit = STATIONARY_GROUNDED_CLIPS.has(report.clip) ? -0.008 : -0.025
      if (report.minVertexY < floorLimit) {
        const msg = `Animation floor penetration on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('FLOOR PEN:', msg)
        else throw new Error(msg)
      }
      if (loaded.rigId !== 'aquatic' && GROUNDED_EVERY_FRAME_CLIPS.has(report.clip) && report.maxFrameMinY > 0.018) {
        const msg = `Animation floating above y=0 on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('FLOATING:', msg)
        else throw new Error(msg)
      }
      if (report.clip === 'Attack' && (report.minVertexY > 0.018 || Math.abs(report.endFrameMinY) > 0.025)) {
        const msg = `Attack clip not grounded on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('ATTACK FLOAT:', msg)
        else throw new Error(msg)
      }
      if (report.clip === 'Run' && report.minVertexY > 0.018) {
        const msg = `Run clip never touches y=0 on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('RUN FLOAT:', msg)
        else throw new Error(msg)
      }
      if ((report.clip === 'Death' || report.clip.startsWith('Death')) && Math.abs(report.endFrameMinY) > 0.025) {
        const msg = `Death clip end frame not grounded on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('DEATH END:', msg)
        else throw new Error(msg)
      }
    }
  }

  // Also audit creature and UAL1 animations under extreme parametric sliders.
  const extremeCreatureProportions = {
    height: 1.45,
    legRatio: 0.75,
    build: 0,
    shoulderWidth: 1.55,
    torsoBulk: 1.55,
    waistScale: 0.75,
    headScale: 1.4,
    limbThickness: 1.5,
    armLength: 1,
    bodyLength: 1.4,
  }
  for (const presetId of [
    'monster_dire_wolf',
    'monster_warhorse',
    'monster_giant_spider',
    'monster_frost_eagle',
    'monster_ember_drake',
    'monster_tyrant_rex',
    'monster_basilisk',
    'monster_abyssal_shark',
  ]) {
    const preset = allPresets.find((p) => p.id === presetId)!
    const loaded = await loadPresetForAudit(preset, manifest.packs, STAGE_DIR, auditCache)
    const reports = auditRigClips(loaded.root, loaded.meshes, loaded.clips, {
      rigId: loaded.rigId,
      ragdoll: loaded.ragdoll,
      proportions: extremeCreatureProportions,
      sampleHz: 12,
    })
    for (const report of reports) {
      if (report.errors > 0 || report.minVertexY < -0.04) {
        const msg = `Extreme proportion animation audit failed on ${preset.id} ${serializeReportSummary(report)}`
        if (process.env.VALIDATE_ALL === '1') console.error('EXTREME CREATURE:', msg)
        else throw new Error(msg)
      }
    }
  }

  const extremeUal1Proportions = {
    height: 1.45,
    legRatio: 0.75,
    build: 1,
    shoulderWidth: 1.55,
    torsoBulk: 1.55,
    waistScale: 0.75,
    headScale: 1.4,
    limbThickness: 1.5,
    armLength: 1.3,
    bodyLength: 1,
  }
  const coreAthletic = allPresets.find((p) => p.id === 'core_athletic')!
  const coreLoaded = await loadPresetForAudit(coreAthletic, manifest.packs, STAGE_DIR, auditCache)
  const extremeUal1Reports = auditRigClips(
    coreLoaded.root,
    coreLoaded.meshes,
    coreLoaded.clips.filter((c) => ['Idle_Loop', 'Walk_Loop', 'Crouch_Idle_Loop', 'Death01'].includes(c.name)),
    {
      rigId: coreLoaded.rigId,
      ragdoll: coreLoaded.ragdoll,
      proportions: extremeUal1Proportions,
      sampleHz: 12,
    },
  )
  for (const report of extremeUal1Reports) {
    if (report.errors > 0 || report.minVertexY < -0.03) {
      const msg = `Extreme UAL1 proportion animation audit failed on core_athletic ${serializeReportSummary(report)}`
      if (process.env.VALIDATE_ALL === '1') console.error('EXTREME UAL1:', msg)
      else throw new Error(msg)
    }
  }

  console.log(`Validation passed: ${manifest.packs.length} packs, ${totalParts} avatar parts, ${totalModels} held/world models, ${allPresets.length} presets audited.`)
}

void main()
