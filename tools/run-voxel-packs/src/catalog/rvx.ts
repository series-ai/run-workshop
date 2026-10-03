/**
 * Builds a RUN pack's catalog from the jam stage (GLBs, PNGs) and the build
 * metadata sidecars (`out/meta/<pack>/<id>.json`). Every entry is parsed with
 * the shared schema and every path must exist; a gap throws, naming it.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  packCatalogSchema,
  partNodeName,
  rvxModelEntrySchema,
  spriteEntrySchema,
  type AvatarPartEntry,
  type PackCatalog,
  type SpriteEntry,
  type VoxelModelEntry,
} from '../../contracts/catalog'
import { isCategory } from '../../contracts/categories'
import { leafFor, RVX_PACKS, type LeafKind, type RvxPackKey } from '../../contracts/packs'
import { inspectGlb } from '../validate/inspect'
import { TOOL_ROOT } from '../paths'
import { rvxEffects } from './pfxIds'

const RUN_COPYRIGHT = 'Copyright (c) 2026 Series Entertainment, Inc.; RUN License (RUN Repository Supplemental License v1.0)'
/** Avatar-space files also carry the Pirate Nation armature, a third-party material under MIT. */
const RIG_NOTICE = '; avatar rig data Copyright (c) 2026 Proof of Play, Inc., MIT License'
export function rvxCopyright(leaf: LeafKind): string {
  return leaf === 'characters' ? RUN_COPYRIGHT + RIG_NOTICE : RUN_COPYRIGHT
}

interface BuildMeta {
  id: string
  pack: string
  category: string
  name: string
  clips: string[]
  sockets: string[]
  pfx: VoxelModelEntry['pfx']
  route: 'code' | 'generated'
  source: string
  parts?: { nodeName: string; slot: string; index: number; name: string; rules: AvatarPartEntry['rules'] }[]
  avatarClips?: string[]
}

const round = (v: number) => Math.round(v * 1e4) / 1e4

export async function rvxCatalog(stageDir: string, metaDir: string, pack: RvxPackKey): Promise<PackCatalog> {
  const packDir = join(stageDir, RVX_PACKS[pack].dir)
  const models: VoxelModelEntry[] = []
  let avatar: PackCatalog['avatar'] | null = null

  for (const kind of ['world', 'characters'] as const satisfies readonly LeafKind[]) {
    const leaf = leafFor(pack, kind)
    const leafDir = join(packDir, leaf.path)
    if (!existsSync(leafDir)) continue
    for (const category of readdirSync(leafDir).sort()) {
      const dir = join(leafDir, category)
      if (!statSync(dir).isDirectory() || !isCategory(category)) continue
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()) {
        const id = file.slice(0, -4)
        const metaPath = join(metaDir, pack, `${id}.json`)
        if (!existsSync(metaPath)) throw new Error(`${id}: no build metadata at ${metaPath}; rebuild the pack`)
        const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as BuildMeta
        if (meta.id !== id) throw new Error(`${id}: build metadata names ${meta.id}`)
        if (!existsSync(join(TOOL_ROOT, meta.source))) throw new Error(`${id}: its source ${meta.source} no longer exists; rebuild the pack`)
        const glbPath = join(dir, file)
        const summary = await inspectGlb(new Uint8Array(readFileSync(glbPath)))
        const min = summary.bounds?.min ?? [0, 0, 0]
        const max = summary.bounds?.max ?? [0, 0, 0]
        const relativePath = relative(leafDir, glbPath)
        models.push(
          rvxModelEntrySchema.parse({
            id,
            pack,
            name: meta.name,
            category,
            filename: file,
            relativePath,
            leaf: kind,
            sizeBytes: statSync(glbPath).size,
            bounds: { min: min.map(round), max: max.map(round), size: max.map((v, i) => round(v - (min[i] ?? 0))) },
            normalizedShift: 0,
            space: category === 'held-items' || kind === 'characters' ? 'avatar' : 'world',
            clips: summary.animations.map((a) => a.name),
            sockets: summary.nodeNames.filter((n) => n.startsWith('socket-')).sort(),
            pfx: meta.pfx,
            route: meta.route,
            license: leaf.license,
            copyright: rvxCopyright(kind),
          }),
        )
        if (category === 'avatar') {
          if (avatar) throw new Error(`${pack}: more than one avatar parts GLB`)
          if (!meta.parts) throw new Error(`${id}: avatar metadata has no parts`)
          avatar = {
            pack,
            partsModelPath: relativePath,
            clipsModelPath: relativePath,
            leaf: 'characters',
            parts: meta.parts.map((part) => {
              const ref = { pack, slot: part.slot, index: part.index } as AvatarPartEntry['ref']
              if (partNodeName(ref) !== part.nodeName) throw new Error(`${id}: part node ${part.nodeName} breaks the naming convention`)
              return { ref, nodeName: part.nodeName, name: part.name, tints: [], rules: part.rules }
            }),
            clips: meta.avatarClips ?? [],
          }
        }
      }
    }
  }
  if (!avatar) throw new Error(`${pack}: no avatar parts GLB in ${packDir}`)

  const sprites: SpriteEntry[] = []
  for (const kind of ['icons', 'ui'] as const) {
    const leaf = leafFor(pack, kind)
    const dir = join(packDir, leaf.path)
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.png') && f !== 'preview.png').sort()) {
      const id = file.slice(0, -4)
      sprites.push(
        spriteEntrySchema.parse({
          id,
          pack,
          name: id.replace(/^(icon|ui)-[a-z]+-/, '').replace(/-/g, ' '),
          category: kind,
          subCategory: id.split('-')[2] ?? kind,
          relativePath: file,
          leaf: kind,
          sizeBytes: statSync(join(dir, file)).size,
          license: leaf.license,
          copyright: rvxCopyright(kind),
        }),
      )
    }
  }

  const effects = [...new Set(models.flatMap((m) => m.pfx.map((p) => p.effectId)))].sort()
  // Bindings use this pack's RUN voxel effects only: they share the pack's
  // theme colours and the nominal-size convention that `size` relies on.
  const rvx = rvxEffects()
  const problems: string[] = []
  for (const m of models) {
    for (const p of m.pfx) {
      const where = `${m.id} → ${p.effectId}`
      if (!p.effectId.startsWith(`rvx-${pack}-`)) problems.push(`${where}: not a rvx-${pack}- effect`)
      else if (!rvx.has(p.effectId)) problems.push(`${where}: unknown effect (npm run effect-ids in tools/3d-pfx-library?)`)
      else if (p.at !== undefined && rvx.get(p.effectId)) problems.push(`${where}: \`at\` is for one-shots, and this effect loops`)
      if (p.socket && !m.sockets.includes(p.socket)) problems.push(`${where}: socket ${p.socket} is not in the file`)
      if (p.trigger.startsWith('clip:') && !m.clips.includes(p.trigger.slice(5))) problems.push(`${where}: no clip ${p.trigger.slice(5)}`)
    }
  }
  if (problems.length > 0) throw new Error(`${pack}: bad PFX bindings:\n  ${problems.join('\n  ')}`)
  return packCatalogSchema.parse({ pack, label: RVX_PACKS[pack].label, models, avatar, sprites, pfx: { pack, effects } })
}
