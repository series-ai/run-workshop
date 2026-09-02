import { useState, useEffect } from 'react'
import { resolveAssetUrl } from './assetLibrary'

const memoryCache = new Map<string, string>()

export function useAssetUrl(path: string | undefined | null): {
  url: string | null
  loading: boolean
  error: Error | null
} {
  const [url, setUrl] = useState<string | null>(path ? memoryCache.get(path) ?? null : null)
  const [loading, setLoading] = useState<boolean>(Boolean(path && !memoryCache.has(path)))
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!path) {
      setUrl(null)
      setLoading(false)
      setError(null)
      return
    }

    if (memoryCache.has(path)) {
      setUrl(memoryCache.get(path)!)
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    resolveAssetUrl(path)
      .then((resolved) => {
        if (!active) return
        memoryCache.set(path, resolved)
        setUrl(resolved)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [path])

  return { url, loading, error }
}
