import { useEffect, useState } from 'react'
import { resolveAssetUrl, type AssetRef } from './assetSource'

export function useAssetUrls(refs: readonly AssetRef[]): string[] | null {
  const key = refs.map((r) => `${r.leafId}:${r.path}`).join('|')
  const [urls, setUrls] = useState<string[] | null>(null)

  useEffect(() => {
    let alive = true
    setUrls(null)
    Promise.all(refs.map((r) => resolveAssetUrl(r)))
      .then((resolved) => {
        if (alive) setUrls(resolved)
      })
      .catch((err) => {
        console.error('Failed to resolve asset URLs:', err)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return urls
}
