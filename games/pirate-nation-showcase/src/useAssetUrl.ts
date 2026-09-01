import { useEffect, useState } from 'react'
import { resolveAssetUrl, type AssetReference } from './assetLibrary'

/**
 * Resolves a pack path to a URL for rendering. Returns `null` while the
 * resolution is in flight. A genuine resolution failure is rethrown during
 * render so the nearest error boundary shows it instead of the component
 * silently rendering nothing forever.
 */
export function useAssetUrl(reference: AssetReference | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const key = reference ? `${reference.pack}:${reference.path}` : ''

  useEffect(() => {
    if (!reference || !key) {
      setUrl(null)
      setError(null)
      return
    }
    let cancelled = false
    setUrl(null)
    // Clear any previous failure: a new path deserves a fresh attempt, and
    // without this one bad asset would latch the error for the session.
    setError(null)
    resolveAssetUrl(reference).then(
      (resolved) => {
        if (!cancelled) setUrl(resolved)
      },
      (cause) => {
        if (!cancelled) setError(cause as Error)
      },
    )
    return () => {
      cancelled = true
    }
  }, [key])

  if (error) throw error
  return url
}
