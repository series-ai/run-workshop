import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

export const MYSTVALE_PACK = {
  id: 'series-ai/mystvale',
  version: '04811e1dd830',
} as const

let baseUrlPromise: Promise<string> | undefined
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
  baseUrlPromise = undefined
  initialization = undefined
}

export async function resolveAssetUrl(path: string): Promise<string> {
  await ensureInitialized()
  if (!baseUrlPromise) {
    baseUrlPromise = RundotGameAPI.assetLibrary
      .getPackBaseUrl(MYSTVALE_PACK.id, MYSTVALE_PACK.version)
      .then((url: string | null | undefined) => {
        if (!url) throw new Error('Asset library returned empty URL')
        return url.replace(/\/+$/, '')
      })
      .catch((error: unknown) => {
        baseUrlPromise = undefined
        throw error
      })
  }
  const cleanPath = path.replace(/^\/+/, '')
  const base = await baseUrlPromise
  return `${base}/${cleanPath}`
}
