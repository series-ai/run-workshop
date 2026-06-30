import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { SkinPanel } from './SkinPanel'

type SkinSheetSide = 'bottom' | 'left' | 'right'

export interface SkinSheetProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  open?: boolean
  side?: SkinSheetSide
  contained?: boolean
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children?: ReactNode
  onBackdropClick?: () => void
}

function wrapperStyle(side: SkinSheetSide, contained: boolean): CSSProperties {
  const base: CSSProperties = {
    position: contained ? 'absolute' : 'fixed',
    inset: 0,
    zIndex: 590,
    display: 'flex',
    background: 'rgba(6, 12, 24, 0.48)',
    padding: '16px',
  }

  if (side === 'bottom') {
    base.alignItems = 'flex-end'
    base.justifyContent = 'center'
    return base
  }

  base.alignItems = 'stretch'
  base.justifyContent = side === 'right' ? 'flex-end' : 'flex-start'
  return base
}

function sheetStyle(side: SkinSheetSide): CSSProperties {
  // Do not set `overflowY: 'auto'` here. The panel's rounded chrome clips via
  // `.ui-panel { overflow: hidden }`, and scroll moves to `.ui-panel__body` on
  // overlay variants so the sticky header (and close button) never scrolls off.
  if (side === 'bottom') {
    return {
      width: 'min(720px, 100%)',
      maxHeight: 'min(72vh, 100%)',
    }
  }

  return {
    width: 'min(420px, 100%)',
    height: '100%',
    maxHeight: '100%',
  }
}

export function SkinSheet({
  open = true,
  side = 'bottom',
  contained = false,
  title,
  subtitle,
  actions,
  children,
  onBackdropClick,
  style,
  ...rest
}: SkinSheetProps) {
  if (!open) {
    return null
  }

  return (
    <div
      data-ui-sheet-contained={contained ? 'true' : 'false'}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdropClick?.()
        }
      }}
      style={wrapperStyle(side, contained)}
    >
      <SkinPanel
        {...rest}
        title={title}
        subtitle={subtitle}
        actions={actions}
        variant="sheet"
        style={{
          ...sheetStyle(side),
          ...style,
        }}
      >
        {children}
      </SkinPanel>
    </div>
  )
}
