// Shared layout map between the showcase app tree (public/assets) and the
// jam-ready-assets pack (run-inkline). The pack is the committed source of
// truth for asset bytes; the app tree is reconstructed from it by
// scripts/link-pack.ts, and scripts/export-pack.ts builds the pack from the
// app tree. Keep this module free of I/O so both directions can reuse it.

export const PACK_LEAVES = [
  '3D/characters',
  '3D/city',
  '3D/weapons',
  '3D/platformer',
  '3D/sports',
  '3D/space-scifi',
  '2D/misc',
] as const

// App model category -> pack leaf (characters always use the characters leaf).
export const CATEGORY_TO_LEAF: Record<string, string> = {
  standard: '3D/characters',
  athlete: '3D/characters',
  combat: '3D/characters',
  tall: '3D/characters',
  agile: '3D/characters',
  heavy: '3D/characters',
  scout: '3D/characters',
  utility: '3D/characters',
  tactical: '3D/characters',
  guardian: '3D/characters',
  weapons: '3D/weapons',
  parkour: '3D/platformer',
  sports: '3D/sports',
  'sci-fi': '3D/space-scifi',
  industrial: '3D/city',
  city: '3D/city',
}

// Flagship preview shown at each pack leaf root, by the app preview name it
// was copied from.
export const FLAGSHIP_PREVIEWS: Record<string, string> = {
  '3D/characters': 'stick-standard.png',
  '3D/city': 'warehouse.png',
  '3D/weapons': 'sword.png',
  '3D/platformer': 'vault-box.png',
  '3D/sports': 'basketball.png',
  '3D/space-scifi': 'sci-fi-rifle.png',
  '2D/misc': 'effect-punch-impact.png',
}

// Leaf flagship inverse: pack preview.png -> app preview name.
const FLAGSHIP_TO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(FLAGSHIP_PREVIEWS).map(([leaf, name]) => [`${leaf}/preview.png`, name]),
)

// Scene placement JSONs copied verbatim between the app root and city Source.
export const SCENE_LAYOUT_FILES = ['industrial-district', 'service-yard', 'roof-works'] as const

export interface CatalogReconstruction {
  /** Pack-relative source inside the committed pack. */
  readonly pack: string
  /** App-relative destination under public/assets. */
  readonly app: string
  readonly transform: 'manifest' | 'characters' | 'props' | 'atlas' | 'environmentLayouts'
}

// The catalogs that link-pack rebuilds from the pack's path-rewritten
// copies. characters.json and props.json are authored by the Blender
// exporters with Python float formatting, so they are committed in the app
// tree (catalog metadata, like the Pirate Nation showcase) and verified
// against the pack copies by the forward transform in link-pack instead.
export const CATALOG_RECONSTRUCTIONS: readonly CatalogReconstruction[] = [
  { pack: '3D/characters/Source/manifest.json', app: 'manifest.json', transform: 'manifest' },
  { pack: '2D/misc/atlas.json', app: 'effects/atlas.json', transform: 'atlas' },
  { pack: '3D/city/Source/environment-layouts.json', app: 'environment-layouts.json', transform: 'environmentLayouts' },
]

// App catalogs that are committed verbatim and must match the pack's
// rewritten copies through the exporter transform.
export const COMMITTED_CATALOG_CHECKS: readonly { app: string; pack: string; transform: 'characters' | 'props' }[] = [
  { app: 'characters.json', pack: '3D/characters/Source/characters.json', transform: 'characters' },
  { app: 'props.json', pack: '3D/city/Source/props.json', transform: 'props' },
]

/** Map a pack-relative file to its app-relative path under public/assets. */
export function packPathToApp(packRel: string): string | null {
  const parts = packRel.split('/')
  if (parts[0] !== '3D' && parts[0] !== '2D') return null
  const leaf = parts.length > 1 ? `${parts[0]}/${parts[1]}` : ''

  // Characters leaf
  if (packRel === '3D/characters/License.txt') return 'License.txt'
  if (leaf === '3D/characters') {
    const rest = parts.slice(2)
    if (rest.length === 1 && rest[0].endsWith('.glb')) return `characters/${rest[0]}`
    if (rest[0] === 'previews') return `previews/${rest[1]}`
    if (rest[0] === 'preview.png') return `previews/${FLAGSHIP_PREVIEWS['3D/characters']}`
    if (rest[0] === 'Source') {
      if (rest[1] === 'characters.blend') return 'source/characters.blend'
      if (rest[1] === 'sample-pose-metrics.json') return 'sample-pose-metrics.json'
      if (rest[1] === 'character-roles.json') return 'character-roles.json'
    }
    return null
  }

  // City leaf extras: scene samples, scene placement JSONs, blends
  if (leaf === '3D/city') {
    const rest = parts.slice(2)
    if (rest[0] === 'Samples' && rest[1]?.endsWith('.glb')) return `scenes/${rest[1]}`
    if (rest[0] === 'Source') {
      const name = rest[1]
      if (name === 'industrial.blend') return 'source/industrial.blend'
      if (name?.endsWith('.blend')) return `source/${name}`
      if ((SCENE_LAYOUT_FILES as readonly string[]).includes(name?.replace(/\.json$/, '') ?? '')) {
        return `${name}`
      }
      if (name === 'effects.json') return 'effects.json'
    }
  }

  // Prop leaves: GLBs and model previews
  if (['3D/weapons', '3D/platformer', '3D/sports', '3D/space-scifi'].includes(leaf)) {
    const rest = parts.slice(2)
    if (rest.length === 1 && rest[0].endsWith('.glb')) return `props/${rest[0]}`
    if (rest[0] === 'previews') return `previews/${rest[1]}`
    if (rest[0] === 'preview.png' && FLAGSHIP_TO_APP[packRel]) return `previews/${FLAGSHIP_TO_APP[packRel]}`
    return null
  }
  if (leaf === '3D/city') {
    const rest = parts.slice(2)
    if (rest.length === 1 && rest[0].endsWith('.glb')) return `props/${rest[0]}`
    if (rest[0] === 'previews') return `previews/${rest[1]}`
    if (rest[0] === 'preview.png' && FLAGSHIP_TO_APP[packRel]) return `previews/${FLAGSHIP_TO_APP[packRel]}`
    return null
  }

  // Effects leaf
  if (leaf === '2D/misc') {
    const rest = parts.slice(2)
    if (rest.length === 1 && rest[0] === 'preview.png' && FLAGSHIP_TO_APP[packRel]) {
      return `previews/${FLAGSHIP_TO_APP[packRel]}`
    }
    if (rest.length === 1 && rest[0].endsWith('.png')) return `effects/${rest[0]}`
    if (rest[0] === 'previews') return `previews/${rest[1]}`
    if (rest[0] === 'effects.json') return 'effects.json'
    return null
  }
  return null
}

// ---- Catalog reconstruction (pack -> app paths) -------------------------

interface PathedModel {
  id: string
  file: string
  thumbnail: string
  [key: string]: unknown
}

function packModelPathsToApp(model: PathedModel): void {
  const fileLeaf = model.file.match(/^(3D\/[^/]+)\//)
  if (fileLeaf) {
    model.file = fileLeaf[1] === '3D/characters'
      ? `assets/characters/${model.file.split('/').pop()}`
      : `assets/props/${model.file.split('/').pop()}`
  }
  if (model.thumbnail.includes('/previews/')) {
    model.thumbnail = `assets/previews/${model.thumbnail.split('/').pop()}`
  }
}

type Json = Record<string, unknown>

/** Rebuild the app catalog bytes from the pack's rewritten catalog. */
export function reconstructCatalog(transform: CatalogReconstruction['transform'], packJson: Json): string {
  const copy = JSON.parse(JSON.stringify(packJson)) as Json
  switch (transform) {
    case 'manifest':
    case 'characters':
    case 'props': {
      const models = copy.models as PathedModel[]
      for (const model of models) packModelPathsToApp(model)
      const text = JSON.stringify(copy, null, 2)
      // characters.json is written by the Blender exporter without a trailing
      // newline; the other two catalogs carry one.
      return transform === 'characters' ? text : `${text}\n`
    }
    case 'atlas': {
      const effects = copy.effects as { file: string }[]
      for (const effect of effects) effect.file = `effects/${effect.file.split('/').pop()}`
      return `${JSON.stringify(copy, null, 2)}\n`
    }
    case 'environmentLayouts': {
      const layouts = copy.layouts as { file: string; source: string; layout: string }[]
      for (const layout of layouts) {
        layout.file = `scenes/${layout.file.split('/').pop()}`
        layout.source = `source/${layout.source.split('/').pop()}`
        layout.layout = `${layout.layout.split('/').pop()}`
      }
      return `${JSON.stringify(copy, null, 2)}\n`
    }
  }
}

// ---- Catalog forward check (app -> pack bytes) ----------------------------

/**
 * Render the exporter's pack form of a committed app catalog. The result must
 * equal the committed pack copy byte for byte; link-pack enforces this for
 * characters.json and props.json, whose app originals are authored by the
 * Blender exporters (Python float formatting) and committed in the app tree.
 */
export function forwardCatalog(transform: 'characters' | 'props', appJson: Json): string {
  const copy = JSON.parse(JSON.stringify(appJson)) as Json
  const models = copy.models as (PathedModel & { kind: string; category: string })[]
  for (const model of models) {
    const base = (name: string) => name.split('/').pop() as string
    const leaf = model.kind === 'character'
      ? '3D/characters'
      : CATEGORY_TO_LEAF[model.category] ?? '3D/city'
    model.file = `${leaf}/${base(model.file)}`
    model.thumbnail = `${leaf}/previews/${base(model.thumbnail)}`
  }
  return `${JSON.stringify(copy, null, 2)}\n`
}
