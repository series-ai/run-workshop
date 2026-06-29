/**
 * PreviewProvider — applies preview URL params in local Vite dev.
 *
 * Reads `?preview=<screen-id>` or `?screen=<screen-id>` from the URL and
 * opens the corresponding screen via the debug API. Also reacts to browser
 * back/forward navigation.
 */

import { type ReactNode, useEffect } from 'react'
import { applyPreviewSelection } from './preview'

interface PreviewProviderProps {
  children: ReactNode
}

export function PreviewProvider({ children }: PreviewProviderProps) {
  useEffect(() => {
    const applyRequestedPreview = () => {
      applyPreviewSelection(window.location.search)
    }

    applyRequestedPreview()
    window.addEventListener('popstate', applyRequestedPreview)

    return () => {
      window.removeEventListener('popstate', applyRequestedPreview)
    }
  }, [])

  return <>{children}</>
}
