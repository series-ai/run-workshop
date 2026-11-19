import { PINS } from './pins'

declare const __POLY_ASSET_MODE__: 'local' | 'pinned'

export type AssetSource =
  | { kind: 'pinned'; pins: Readonly<Record<string, string>> }
  | { kind: 'local'; base: string }

export interface AssetRef {
  leafId: string
  path: string
}

export const ASSET_SOURCE: AssetSource =
  typeof __POLY_ASSET_MODE__ !== 'undefined' && __POLY_ASSET_MODE__ === 'pinned'
    ? { kind: 'pinned', pins: PINS }
    : { kind: 'local', base: 'jam' }

function encodePath(path: string): string {
  return path
    .split('/')
    .map((s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/')
}

const baseUrls = new Map<string, Promise<string>>()

export async function resolveAssetUrl(ref: AssetRef, source: AssetSource = ASSET_SOURCE): Promise<string> {
  if (source.kind === 'local') {
    return `${source.base}/${encodePath(ref.leafId)}/${encodePath(ref.path)}`
  }
  const version = source.pins[ref.leafId]
  if (!version) throw new Error(`No published jam-ready-assets pin for "${ref.leafId}"`)
  let base = baseUrls.get(ref.leafId)
  if (!base) {
    base = import('@series-inc/rundot-game-sdk/api')
      .then(({ default: RundotGameAPI }) => RundotGameAPI.assetLibrary.getPackBaseUrl(ref.leafId, version))
      .then((url) => {
        if (!url) throw new Error(`Asset library returned empty URL for ${ref.leafId}`)
        return url.replace(/\/+$/, '')
      })
      .catch((err: unknown) => {
        baseUrls.delete(ref.leafId)
        throw err
      })
    baseUrls.set(ref.leafId, base)
  }
  return `${await base}/${encodePath(ref.path)}`
}
