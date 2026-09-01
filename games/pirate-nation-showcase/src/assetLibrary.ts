import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

export const PIRATE_PACKS = {
  models: {
    id: '3D/pirate/proofofplay-pirate-nation-models',
    version: '2ae870ead5c1',
  },
  icons: {
    id: 'ui/proofofplay-pirate-nation-icons',
    version: 'ec3e46dfcd27',
  },
  ui: {
    id: 'ui/proofofplay-pirate-nation-ui',
    version: '97835c36f9f1',
  },
  audio: {
    id: 'audio/proofofplay-pirate-nation-audio',
    version: '064b51d95ed5',
  },
} as const

export type PiratePackKey = keyof typeof PIRATE_PACKS

export interface AssetReference {
  pack: PiratePackKey
  path: string
}

const baseUrls = new Map<PiratePackKey, Promise<string>>()
let initialization: Promise<void> | undefined

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function ensureInitialized(): Promise<void> {
  if (!initialization) {
    initialization = RundotGameAPI.initializeAsync()
      .then(() => undefined)
      .catch((error) => {
        initialization = undefined
        throw error
      })
  }
  return initialization
}

export function clearAssetLibraryCacheForTests(): void {
  baseUrls.clear()
  initialization = undefined
}

export async function resolveAssetUrl(reference: AssetReference): Promise<string> {
  await ensureInitialized()
  const pack = PIRATE_PACKS[reference.pack]
  let base = baseUrls.get(reference.pack)
  if (!base) {
    base = RundotGameAPI.assetLibrary
      .getPackBaseUrl(pack.id, pack.version)
      .then((url) => {
        if (!url) throw new Error('Asset library returned an empty pack URL')
        return url.replace(/\/+$/, '')
      })
      .catch((error) => {
        baseUrls.delete(reference.pack)
        throw error
      })
    baseUrls.set(reference.pack, base)
  }
  const path = reference.path.split('/').map(encodePathSegment).join('/')
  return `${await base}/${path}`
}
