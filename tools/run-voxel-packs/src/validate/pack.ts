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
          surface: summary.surface,
        })
      }
    }
  }
  strayFiles.push(...unexpectedFiles(packDir, pack))
  return { pack, glbs, leaves, strayFiles: [...new Set(strayFiles)].sort() }
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

export function checkLevel(inventory: PackInventory, level: Level): LevelIssue[] {
  const issues: LevelIssue[] = []
  for (const glb of inventory.glbs) {
    for (const violation of glb.violations) issues.push({ rule: violation.rule, message: `${glb.id}: ${violation.message}` })
    const expectedLeaf = glb.category === 'characters-skins' || glb.category === 'avatar' ? 'characters' : 'world'
    if (glb.leaf !== expectedLeaf) issues.push({ rule: 'layout.leaf', message: `${glb.id}: ${glb.category} belongs in the ${expectedLeaf} leaf` })
  }
  for (const stray of inventory.strayFiles) issues.push({ rule: 'layout.stray', message: `unexpected entry ${stray}` })
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
