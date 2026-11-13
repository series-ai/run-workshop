import { useEffect, useState } from 'react'
import { resolveAssetUrl, type AssetRef } from './assetSource'

const keyOf = (refs: readonly AssetRef[]) => refs.map((ref) => `${ref.leafId}:${ref.path}`).join('|')

/**
 * Resolves references to URLs; `null` until every one resolves. The result is
 * tagged with the request key, so a render after the refs change never pairs
 * new refs with the previous URLs. A failure is rethrown during render for the
 * nearest error boundary.
 */
export function useAssetUrls(refs: readonly AssetRef[]): string[] | null {
  const key = keyOf(refs)
  const [state, setState] = useState<{ key: string; urls?: string[]; error?: Error } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all(refs.map((ref) => resolveAssetUrl(ref))).then(
      (urls) => !cancelled && setState({ key, urls }),
      (cause: unknown) => !cancelled && setState({ key, error: cause as Error }),
    )
    return () => {
      cancelled = true
    }
  }, [key])

  if (!state || state.key !== key) return null
  if (state.error) throw state.error
  return state.urls ?? null
}

export function useAssetUrl(ref: AssetRef | null): string | null {
  const urls = useAssetUrls(ref ? [ref] : [])
  return ref && urls ? (urls[0] ?? null) : null
}
