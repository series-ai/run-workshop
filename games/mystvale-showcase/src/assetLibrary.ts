import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

export const MYSTVALE_PACKS = {
  '2d': {
    id: 'series-ai-mystvale/2D/top-down-rpg',
    version: '772c5adf50fb',
  },
  ui: {
    id: 'series-ai-mystvale/ui',
    version: '15af28714f4d',
  },
  icons: {
    id: 'series-ai-mystvale/icons',
    version: 'f4d3822f6da3',
  },
  audio: {
    id: 'series-ai-mystvale/audio',
    version: '700bc6650a6d',
  },
} as const

export type MystvalePackKey = keyof typeof MYSTVALE_PACKS

export const MYSTVALE_PACK = MYSTVALE_PACKS['2d']

export interface AssetReference {
  pack: MystvalePackKey
  path: string
}

const baseUrls = new Map<MystvalePackKey, Promise<string>>()
let initialization: Promise<unknown> | undefined

function ensureInitialized(): Promise<unknown> {
  if (!initialization) {
    initialization = RundotGameAPI.initializeAsync().catch((err: unknown) => {
      initialization = undefined
      throw err
    })
  }
  return initialization
}

export function clearAssetLibraryCacheForTests(): void {
  baseUrls.clear()
  initialization = undefined
}

export function inferPackAndPath(inputPath: string): { pack: MystvalePackKey; relativePath: string } {
  const clean = inputPath.replace(/^\/+/, '')
  if (clean.startsWith('ui/')) {
    return { pack: 'ui', relativePath: clean.slice(3) }
  }
  if (clean.startsWith('icons/')) {
    return { pack: 'icons', relativePath: clean.slice(6) }
  }
  if (clean.startsWith('audio/')) {
    return { pack: 'audio', relativePath: clean.slice(6) }
  }
  return { pack: '2d', relativePath: clean }
}

export async function resolveAssetUrl(input: string | AssetReference): Promise<string> {
  await ensureInitialized()
  const ref =
    typeof input === 'string'
      ? inferPackAndPath(input)
      : { pack: input.pack, relativePath: input.path.replace(/^\/+/, '') }
  const pack = MYSTVALE_PACKS[ref.pack]
  let base = baseUrls.get(ref.pack)
  if (!base) {
    base = RundotGameAPI.assetLibrary
      .getPackBaseUrl(pack.id, pack.version)
      .then((url: string | null | undefined) => {
        if (!url) throw new Error(`Asset library returned empty URL for pack ${pack.id}`)
        return url.replace(/\/+$/, '')
      })
      .catch((error: unknown) => {
        baseUrls.delete(ref.pack)
        throw error
      })
    baseUrls.set(ref.pack, base)
  }
  const resolvedBase = await base
  return `${resolvedBase}/${ref.relativePath}`
}
