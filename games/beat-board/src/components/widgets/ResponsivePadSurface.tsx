/**
 * ResponsivePadSurface — chooses between the portrait single-bank layout and
 * the landscape / desktop dual-bank layout based on viewport width.
 *
 *   - width < LANDSCAPE_BREAKPOINT_PX → portrait: render the *current* bank
 *     only; A/B toggle in the top bar drives the swap.
 *   - width ≥ LANDSCAPE_BREAKPOINT_PX → landscape/desktop: render both banks
 *     side-by-side with a vertical seam between them; A/B toggle hidden.
 *
 * The breakpoint is the same one `PadTopBar` uses to decide whether to
 * render the A/B toggle.
 */

import { useEffect, useState, type CSSProperties } from 'react'
import { PadBlockGrid } from './PadBlockGrid'
import { usePadGridStore } from '../../stores/padGridStore'

export const LANDSCAPE_BREAKPOINT_PX = 760

export interface ResponsivePadSurfaceProps {
  interactive: boolean
}

function useIsLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= LANDSCAPE_BREAKPOINT_PX
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => {
      setIsLandscape(window.innerWidth >= LANDSCAPE_BREAKPOINT_PX)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isLandscape
}

export function ResponsivePadSurface({ interactive }: ResponsivePadSurfaceProps) {
  const isLandscape = useIsLandscape()
  const currentBank = usePadGridStore((s) => s.currentBank)

  if (!isLandscape) {
    return <PadBlockGrid bank={currentBank} interactive={interactive} />
  }

  const sideBySideStyle: CSSProperties = {
    display: 'flex',
    flex: '1 1 auto',
    minHeight: 0,
    gap: 16,
  }

  const halfStyle: CSSProperties = {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
  }

  return (
    <div data-testid="responsive-pad-surface-landscape" style={sideBySideStyle}>
      <div style={halfStyle}>
        <BankLabel label="Bank A" />
        <PadBlockGrid bank="A" interactive={interactive} />
      </div>
      <div style={halfStyle}>
        <BankLabel label="Bank B" />
        <PadBlockGrid bank="B" interactive={interactive} />
      </div>
    </div>
  )
}

function BankLabel({ label }: { label: string }) {
  const labelStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'var(--ui-text-muted)',
    paddingLeft: 8,
    paddingBottom: 4,
  }
  return <div style={labelStyle}>{label}</div>
}

/**
 * Hook for the top-bar to know whether the A/B toggle should be visible.
 * Hidden when both banks render side-by-side (landscape / desktop).
 */
export function useShouldHideBankToggle(): boolean {
  return useIsLandscape()
}
