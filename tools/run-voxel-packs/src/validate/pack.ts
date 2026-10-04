/**
 * Pack-level validation over a staged jam-layout pack dir:
 *   <stage>/<pack dir>/<leaf>/<category>/<id>.glb
 *   <stage>/<pack dir>/<leaf>/<category>/Previews/<id>.jpg
 *
 * `collectInventory` does the I/O; `checkLevel` is pure. Levels grow:
 * `asset` = every GLB passes its rules; `slice` = one of each group for the
 * style gate; `content` = release model/avatar counts only (no previews,
 * icons, UI or licences, which later tasks add); `release` = everything.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { avatarClipOwner } from '../../contracts/clips'
import { isCategory, type Category } from '../../contracts/categories'
import { LEAF_KINDS, leafFor, RVX_PACKS, type LeafKind, type RvxPackKey } from '../../contracts/packs'
import { AVATAR_SLOTS, parsePartNodeName } from '../../contracts/catalog'
import { inspectGlb, type SurfaceStats } from './inspect'
import { STYLE } from '../../contracts/style'
import { validateAsset, type Violation } from './rules'
import { avatarCompositeFights, COMPOSITE_MAX_AREA, rvxPartRules } from './composite'
import { piratePartRules } from '../catalog/pirate'
import { OUT_DIR, PIRATE_AVATAR_GLB, pirateModelsDir } from '../paths'
import { RVX_PACK_KEYS } from '../../contracts/packs'

export const LEVELS = ['asset', 'slice', 'content', 'release'] as const
export type Level = (typeof LEVELS)[number]

export interface GlbRecord {
  id: string
  leaf: LeafKind
  category: Category
  path: string
  violations: Violation[]
  clips: string[]
  partNodes: string[]
  hasPreview: boolean
  scaleClass: string | null
  surface: SurfaceStats | null
  /** Largest dimension in voxels (world: 1 unit, avatar space: 0.01). */
  size: number
}

export interface PackInventory {
  pack: RvxPackKey
  glbs: GlbRecord[]
  /** Leaves that exist on disk, and whether each has a License.txt. */
  leaves: { kind: LeafKind; hasLicense: boolean; pngCount: number }[]
  strayFiles: string[]
}

export interface LevelIssue {
  rule: string
  message: string
}

/** Per-file budget: keeps mobile loads sane (PN's largest non-avatar files are ~1 MB). */
export const MAX_GLB_BYTES = 1.5 * 1024 * 1024

export const RELEASE_COUNTS = {
  modelsMin: 95,
  modelsMax: 105,
  animatedMin: 20,
  partsMin: 30,
  clipsMin: 6,
  clipsMax: 8,
  skins: 6,
  heldItems: 16,
  iconsMin: 40,
  uiMin: 40,
} as const

const SLICE_GROUPS: readonly Category[] = [
  'props',
  'animated-props',
  'buildings',
  'terrain-nature',
  'creatures',
  'vehicles',
  'held-items',
  'characters-skins',
  'avatar',
]

export async function collectInventory(stageDir: string, pack: RvxPackKey): Promise<PackInventory> {
  const packDir = join(stageDir, RVX_PACKS[pack].dir)
  if (!existsSync(packDir)) throw new Error(`pack dir ${packDir} does not exist`)
  const glbs: GlbRecord[] = []
  const leaves: PackInventory['leaves'] = []
  const strayFiles: string[] = []

  for (const kind of LEAF_KINDS) {
    const leaf = leafFor(pack, kind)
    const leafDir = join(packDir, leaf.path)
    if (!existsSync(leafDir)) continue
    const hasLicense = existsSync(join(leafDir, 'License.txt'))
    if (kind === 'icons' || kind === 'ui') {
      const pngCount = readdirSync(leafDir).filter((name) => name.endsWith('.png') && name !== 'preview.png').length
      leaves.push({ kind, hasLicense, pngCount })
      continue
    }
    leaves.push({ kind, hasLicense, pngCount: 0 })
    for (const categoryName of readdirSync(leafDir)) {
      const categoryDir = join(leafDir, categoryName)
      if (!statSync(categoryDir).isDirectory()) continue
      if (!isCategory(categoryName)) {
        strayFiles.push(`${leaf.path}/${categoryName}`)
        continue
      }
      for (const file of readdirSync(categoryDir)) {
        if (file === 'Previews') continue
        if (!file.endsWith('.glb')) {
          strayFiles.push(`${leaf.path}/${categoryName}/${file}`)
          continue
        }
        const id = file.slice(0, -'.glb'.length)
        const path = join(categoryDir, file)
        const summary = await inspectGlb(new Uint8Array(readFileSync(path)), { zfight: true })
        const violations = validateAsset(summary, { profile: 'rvx', pack, category: categoryName })
        const bytes = statSync(path).size
        if (bytes > MAX_GLB_BYTES) violations.push({ rule: 'size.file', message: `GLB is ${(bytes / 1048576).toFixed(2)} MB (max ${MAX_GLB_BYTES / 1048576} MB)` })
        const partNodes = summary.nodeNames.filter((name) => {
          try {
            return parsePartNodeName(name).pack === pack
          } catch {
            return false
          }
        })
        glbs.push({
          id,
          leaf: kind,
          category: categoryName,
          path,
          violations,
          clips: summary.animations.map((animation) => animation.name),
          partNodes,
          hasPreview: existsSync(join(categoryDir, 'Previews', `${id}.jpg`)),
          scaleClass: summary.scaleClass,
          size: summary.bounds ? Math.max(...summary.bounds.max.map((x, i) => x - summary.bounds!.min[i]!)) / (summary.scaleClass ? 1 : 0.01) : 0,
          surface: summary.surface,
        })
      }
    }
  }
  strayFiles.push(...unexpectedFiles(packDir, pack))
  const parts = glbs.find((glb) => glb.category === 'avatar')
  if (parts) parts.violations.push(...(await compositeViolations(stageDir, pack)))
  return { pack, glbs, leaves, strayFiles: [...new Set(strayFiles)].sort() }
}

/** The staged avatar parts file of each RUN pack that has one. */
function stagedPartFiles(stageDir: string): { pack: RvxPackKey; path: string }[] {
  return RVX_PACK_KEYS.map((key) => ({ pack: key, path: join(stageDir, RVX_PACKS[key].dir, leafFor(key, 'characters').path, 'avatar', `${key}-avatar-parts.glb`) })).filter((file) => existsSync(file.path))
}

/**
 * `avatar.composite`: this pack's avatar parts, worn on the PN bodies with PN
 * parts and every other staged pack's parts, must not share a plane with any
 * part they can be worn with (src/validate/composite.ts).
 */
async function compositeViolations(stageDir: string, pack: RvxPackKey): Promise<Violation[]> {
  const files = stagedPartFiles(stageDir)
  const pirateAvatar = join(pirateModelsDir(), PIRATE_AVATAR_GLB)
  if (!existsSync(pirateAvatar)) throw new Error(`the avatar composite check needs the PN avatar at ${pirateAvatar} (set JAM_ASSETS_DIR)`)
  const rvx = rvxPartRules(join(OUT_DIR, 'meta'), files.map((file) => file.pack))
  const fights = await avatarCompositeFights(
    files.map((file) => file.path),
    pirateAvatar,
    (part) => {
      if (part.pack === 'pirate') return piratePartRules(part.slot, part.index)
      const rules = rvx.get(`${part.slot} ${part.pack}-${part.index}`)
      if (!rules) throw new Error(`no composition rules for ${part.slot} ${part.pack}-${part.index} in out/meta`)
      return rules
    },
    pack,
  )
  const bad = fights.filter((fight) => fight.area > COMPOSITE_MAX_AREA)
  if (bad.length === 0) return []
  const worst = bad.slice(0, 3).map((f) => `${f.part} × ${f.other} ${f.area.toFixed(1)} voxel² at (${f.at.map((x) => x.toFixed(1)).join(', ')})`).join('; ')
  return [{ rule: 'avatar.composite', message: `${bad.length} part pair(s) worn together share a plane and z-fight (worst: ${worst}); give the slots distinct layers (contracts/data/avatar-layers.json)` }]
}

/**
 * Every file in the pack must be one of: a leaf's License.txt or preview.webp;
 * a model `<leaf>/<category>/<id>.glb` or its `Previews/<id>.jpg`; an icon or
 * UI `<leaf>/<name>.png`. Anything else (a stray GLB at a leaf root, a file in
 * an unknown leaf) would ship unchecked, so it is reported.
 */
export function unexpectedFiles(packDir: string, pack: RvxPackKey): string[] {
  const leafKinds = new Map(LEAF_KINDS.map((kind) => [leafFor(pack, kind).path, kind] as const))
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (!allowed(path.slice(packDir.length + 1))) out.push(path.slice(packDir.length + 1))
    }
  }
  const allowed = (rel: string): boolean => {
    for (const [leafPath, kind] of leafKinds) {
      if (!rel.startsWith(`${leafPath}/`)) continue
      const rest = rel.slice(leafPath.length + 1).split('/')
      if (rest.length === 1 && (rest[0] === 'License.txt' || rest[0] === 'preview.webp')) return true
      if (kind === 'icons' || kind === 'ui') return rest.length === 1 && rest[0]!.endsWith('.png')
      const [category, second, third] = rest
      if (!category || !isCategory(category)) return false
      if (rest.length === 2) return second!.endsWith('.glb')
      if (rest.length === 3 && second === 'Previews' && third!.endsWith('.jpg')) {
        return existsSync(join(packDir, leafPath, category, `${third!.slice(0, -4)}.glb`))
      }
      return false
    }
    return false
  }
  walk(packDir)
  return out
}

/** Allowed factor between an asset's largest dimension and the median of its group. */
export const SIZE_OUTLIER_FACTOR = 3

/**
 * `scale.outlier`: an asset far bigger or smaller than the pack's other
 * assets of its scale class (held items and skins: of their category).
 * Scale classes bound absolute size; this catches drift inside a class, e.g.
 * a rework that doubles a prop. Groups need three assets to have a median.
 */
export function sizeOutliers(glbs: Pick<GlbRecord, 'id' | 'category' | 'scaleClass' | 'size'>[]): LevelIssue[] {
  const groups = new Map<string, typeof glbs>()
  for (const glb of glbs) {
    if (glb.category === 'avatar' || glb.size <= 0) continue
    const key = glb.scaleClass ?? `category:${glb.category}`
    groups.set(key, [...(groups.get(key) ?? []), glb])
  }
  const out: LevelIssue[] = []
  for (const [key, group] of groups) {
    if (group.length < 3) continue
    const sizes = group.map((g) => g.size).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)]!
    for (const glb of group) {
      if (glb.size > median * SIZE_OUTLIER_FACTOR || glb.size < median / SIZE_OUTLIER_FACTOR) {
        out.push({ rule: 'scale.outlier', message: `${glb.id}: ${glb.size.toFixed(0)} voxels, the ${key.replace('category:', '')} median in this pack is ${median.toFixed(0)} (allowed ×${SIZE_OUTLIER_FACTOR})` })
      }
    }
  }
  return out
}

export function checkLevel(inventory: PackInventory, level: Level): LevelIssue[] {
  const issues: LevelIssue[] = []
  for (const glb of inventory.glbs) {
    for (const violation of glb.violations) issues.push({ rule: violation.rule, message: `${glb.id}: ${violation.message}` })
    const expectedLeaf = glb.category === 'characters-skins' || glb.category === 'avatar' ? 'characters' : 'world'
    if (glb.leaf !== expectedLeaf) issues.push({ rule: 'layout.leaf', message: `${glb.id}: ${glb.category} belongs in the ${expectedLeaf} leaf` })
  }
  for (const stray of inventory.strayFiles) issues.push({ rule: 'layout.stray', message: `unexpected entry ${stray}` })
  issues.push(...sizeOutliers(inventory.glbs))
  if (level === 'asset') return issues

  const byCategory = (category: Category) => inventory.glbs.filter((glb) => glb.category === category)
  const partNodes = inventory.glbs.flatMap((glb) => glb.partNodes)
  const partSlots = new Set(partNodes.map((name) => parsePartNodeName(name).slot))
  const avatarClips = new Set(
    [...byCategory('avatar'), ...byCategory('characters-skins')].flatMap((glb) => glb.clips).filter((clip) => {
      try {
        return avatarClipOwner(clip) === inventory.pack
      } catch {
        return false
      }
    }),
  )

  if (level === 'slice') {
    for (const group of SLICE_GROUPS) {
      if (byCategory(group).length === 0) issues.push({ rule: 'slice.group', message: `slice needs at least one ${group} asset` })
    }
    if (partSlots.size < 5) issues.push({ rule: 'slice.parts', message: `slice needs parts in ≥5 slots, has ${partSlots.size}` })
    if (avatarClips.size < 2) issues.push({ rule: 'slice.clips', message: `slice needs ≥2 avatar clips, has ${avatarClips.size}` })
    return issues
  }

  // Pack look (C2): the pack as a whole matches its PN theme, while single
  // assets may be grey stone or dark iron as PN's own are.
  const stats = inventory.glbs.filter((glb) => glb.leaf === 'world' && glb.surface).map((glb) => glb.surface!)
  if (stats.length > 0) {
    const sats = stats.map((s) => s.meanSaturation).sort((a, b) => a - b)
    const median = sats[Math.floor(sats.length / 2)]!
    const wantSat = STYLE.pack.medianSaturation[inventory.pack] ?? 0
    if (median < wantSat) issues.push({ rule: 'style.pack', message: `median saturation of the world assets is ${median.toFixed(2)}, the ${inventory.pack} theme needs ≥${wantSat}` })
    const dark = stats.reduce((sum, s) => sum + s.darkShare, 0) / stats.length
    if (dark > STYLE.pack.meanDarkMax) issues.push({ rule: 'style.pack', message: `mean dark area of the world assets is ${(dark * 100).toFixed(0)}%, max ${(STYLE.pack.meanDarkMax * 100).toFixed(0)}%` })
  }

  const c = RELEASE_COUNTS
  const release = level === 'release'
  const models = inventory.glbs.length
  if (models < c.modelsMin || models > c.modelsMax) issues.push({ rule: 'release.models', message: `${models} GLBs, expected ${c.modelsMin}–${c.modelsMax}` })
  const animated = inventory.glbs.filter((glb) => glb.leaf === 'world' && glb.clips.length > 0).length
  if (animated < c.animatedMin) issues.push({ rule: 'release.animated', message: `${animated} animated world models, expected ≥${c.animatedMin}` })
  if (partNodes.length < c.partsMin) issues.push({ rule: 'release.parts', message: `${partNodes.length} avatar parts, expected ≥${c.partsMin}` })
  if (avatarClips.size < c.clipsMin || avatarClips.size > c.clipsMax) issues.push({ rule: 'release.clips', message: `${avatarClips.size} avatar clips, expected ${c.clipsMin}–${c.clipsMax}` })
  if (byCategory('characters-skins').length !== c.skins) issues.push({ rule: 'release.skins', message: `${byCategory('characters-skins').length} skins, expected ${c.skins}` })
  if (byCategory('held-items').length !== c.heldItems) issues.push({ rule: 'release.held-items', message: `${byCategory('held-items').length} held items, expected ${c.heldItems}` })
  if (!AVATAR_SLOTS.some((slot) => partSlots.has(slot))) issues.push({ rule: 'release.parts', message: 'no part uses a PN slot' })
  if (!release) return issues
  for (const glb of inventory.glbs) if (!glb.hasPreview) issues.push({ rule: 'release.preview', message: `${glb.id}: missing Previews/${glb.id}.jpg` })
  for (const kind of LEAF_KINDS) {
    const leaf = inventory.leaves.find((entry) => entry.kind === kind)
    if (!leaf) {
      issues.push({ rule: 'release.leaf', message: `leaf ${kind} is missing` })
      continue
    }
    if (!leaf.hasLicense) issues.push({ rule: 'release.license', message: `leaf ${kind} has no License.txt` })
    if (kind === 'icons' && leaf.pngCount < c.iconsMin) issues.push({ rule: 'release.icons', message: `${leaf.pngCount} icons, expected ≥${c.iconsMin}` })
    if (kind === 'ui' && leaf.pngCount < c.uiMin) issues.push({ rule: 'release.ui', message: `${leaf.pngCount} UI images, expected ≥${c.uiMin}` })
  }
  return issues
}
