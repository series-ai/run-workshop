/**
 * Where asset bytes come from. `local` serves `/jam/<leaf id>/<path>` from the
 * RUN voxel stage and a jam-ready-assets checkout (dev, local-preview);
 * `pinned` resolves published pack versions through the RUN asset library.
 * The mode is fixed at build time by vite.config.ts.
 */
import { PINS } from './pins'

declare const __RVX_ASSET_MODE__: 'local' | 'pinned'

export type AssetSource =
  | { kind: 'pinned'; pins: Readonly<Record<string, string>> }
  | { kind: 'local'; base: string }

export interface AssetRef {
  leafId: string
  /** Path inside the leaf. */
  path: string
}

export const ASSET_SOURCE: AssetSource =
  __RVX_ASSET_MODE__ === 'pinned' ? { kind: 'pinned', pins: PINS } : { kind: 'local', base: 'jam' }

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/')
}

/** Pin for a leaf; throws naming the leaf when it has none. */
export function pinFor(source: Extract<AssetSource, { kind: 'pinned' }>, leafId: string): string {
  const version = source.pins[leafId]
  if (!version) throw new Error(`no published pin for pack leaf "${leafId}"`)
  return version
}

const baseUrls = new Map<string, Promise<string>>()

export async function resolveAssetUrl(ref: AssetRef, source: AssetSource = ASSET_SOURCE): Promise<string> {
  if (source.kind === 'local') return `${source.base}/${encodePath(ref.leafId)}/${encodePath(ref.path)}`
  const version = pinFor(source, ref.leafId)
  let base = baseUrls.get(ref.leafId)
  if (!base) {
    // Loaded on demand: local mode never touches the SDK (and it needs a DOM).
    base = import('@series-inc/rundot-game-sdk/api')
      .then(({ default: RundotGameAPI }) => RundotGameAPI.assetLibrary.getPackBaseUrl(ref.leafId, version))
      .then((url) => {
        if (!url) throw new Error(`asset library returned an empty URL for ${ref.leafId}`)
        return url.replace(/\/+$/, '')
      })
      .catch((error: unknown) => {
        baseUrls.delete(ref.leafId)
        throw error
      })
    baseUrls.set(ref.leafId, base)
  }
  return `${await base}/${encodePath(ref.path)}`
}
