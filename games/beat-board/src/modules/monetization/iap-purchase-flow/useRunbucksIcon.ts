import { useEffect, useState } from 'react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

let cachedIconUrl: string | null = null

/**
 * React hook that fetches and caches the Runbucks platform currency icon.
 * Returns a base64 data URL string (or null while loading).
 *
 * The icon is fetched once per app session and cached in memory.
 * Use this everywhere a Runbucks price is displayed (shop, kit pack, bundles).
 */
export function useRunbucksIcon(): string | null {
  const [iconUrl, setIconUrl] = useState<string | null>(cachedIconUrl)

  useEffect(() => {
    if (cachedIconUrl) return

    let cancelled = false
    RundotAPI['iap'].getCurrencyIcon().then((response: { base64Data?: string | null }) => {
      if (cancelled) return
      const url = response.base64Data
        ? `data:image/png;base64,${response.base64Data}`
        : null
      cachedIconUrl = url
      setIconUrl(url)
    }).catch(() => {
      // Silently fall back to null — UI shows Lucide icon fallback
    })

    return () => { cancelled = true }
  }, [])

  return iconUrl
}

/** Non-hook version for use outside React components (e.g., in store actions) */
export async function fetchRunbucksIconUrl(): Promise<string | null> {
  if (cachedIconUrl) return cachedIconUrl
  try {
    const response = await RundotAPI['iap'].getCurrencyIcon()
    cachedIconUrl = response.base64Data
      ? `data:image/png;base64,${response.base64Data}`
      : null
    return cachedIconUrl
  } catch {
    return null
  }
}

/** Reset cache (for testing) */
export function resetRunbucksIconCache(): void {
  cachedIconUrl = null
}
