import type { ReactNode } from 'react'
import { Background } from '../semantic'
import { NavBack, NavClose } from '../semantic'
import { usePreviewViewport, isWidePreviewViewport, getScreenChromeInset } from './viewport'

export function ScreenChrome({ back, close, currency, title, banner, tabs, footer, scrollClassName, children, onBack, onClose }: {
  back?: boolean
  close?: boolean
  currency?: ReactNode
  title?: ReactNode
  banner?: ReactNode
  tabs?: ReactNode
  footer?: ReactNode
  scrollClassName?: string
  children: ReactNode
  /** Click handler for the back nav icon (rendered when `back` is true). */
  onBack?: () => void
  /** Click handler for the close nav icon (rendered when `close` is true). */
  onClose?: () => void
}) {
  const viewport = usePreviewViewport()
  const hasNav = back || close || currency || title
  const ownsPrimaryHeader = Boolean(banner || hasNav)
  const inset = getScreenChromeInset(viewport)
  const gap = viewport.family === 'phone' ? 6 : isWidePreviewViewport(viewport) ? 14 : 12
  const rows = [
    banner || hasNav ? 'auto' : null,
    tabs ? 'auto' : null,
    'minmax(0, 1fr)',
    footer ? 'auto' : null,
  ].filter(Boolean).join(' ')
  return (
    <Background
      data-screen-chrome={ownsPrimaryHeader ? 'primary-header-owner' : 'content-only'}
      data-ui-screen-chrome={ownsPrimaryHeader ? 'primary-header-owner' : 'content-only'}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 16,
        // Honour the host safe area on the sides so UI controls
        // anchored to the edge (e.g. the per-block FX slivers on the
        // pad grid) don't get hidden under a phone's curved corners
        // or system gestures. SafeAreaService publishes --safe-* at
        // boot from RundotAPI.system.getSafeArea(); env(safe-area-
        // inset-*) is the browser fallback when the host hasn't
        // populated the vars yet.
        paddingTop: `${inset}px`,
        paddingBottom: `max(${Math.max(6, inset - 2)}px, var(--safe-bottom, 0px), env(safe-area-inset-bottom, 0px))`,
        paddingLeft: `max(${inset}px, var(--safe-left, 0px), env(safe-area-inset-left, 0px))`,
        paddingRight: `max(${inset}px, var(--safe-right, 0px), env(safe-area-inset-right, 0px))`,
        display: 'grid',
        gridTemplateRows: rows,
        gap,
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {banner ? (
        <div data-ui-screen-chrome-slot="header" style={{ position: 'relative', display: 'grid', justifyItems: 'center', minWidth: 0, margin: `0 -${inset}px` }}>
          <div style={{ position: 'absolute', top: 4, left: 4, right: 4, zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>{back ? <NavBack onClick={onBack} /> : <div />}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
              {currency}
              {close ? <NavClose onClick={onClose} /> : null}
            </div>
          </div>
          {banner}
        </div>
      ) : hasNav ? (
        <div data-ui-screen-chrome-slot="header" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, minHeight: 28 }}>
          <div>{back ? <NavBack onClick={onBack} /> : <div />}</div>
          {title ? (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'calc(100% - 80px)', pointerEvents: 'none' }}>{title}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {currency}
            {close ? <NavClose onClick={onClose} /> : null}
          </div>
        </div>
      ) : null}
      {tabs ? <div style={{ minWidth: 0 }}>{tabs}</div> : null}
      <div
        className={scrollClassName}
        data-ui-screen-chrome-slot="content"
        style={{ display: 'flex', flexDirection: 'column', gap, minWidth: 0, minHeight: 0, overflowX: 'hidden', alignItems: 'stretch' }}
      >
        {children}
      </div>
      {footer ? <div data-ui-screen-chrome-slot="footer" style={{ minWidth: 0 }}>{footer}</div> : null}
    </Background>
  )
}
