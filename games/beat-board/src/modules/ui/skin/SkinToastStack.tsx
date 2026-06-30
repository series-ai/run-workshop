import type { CSSProperties, ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import { SkinSurface } from './SkinSurface'
import { joinClassName } from './theme/classNames'
import type { UiSkinToastSeverity } from './types'

export interface SkinToastItem {
  id: string
  title?: ReactNode
  message: ReactNode
  severity: UiSkinToastSeverity
  actionLabel?: string
  onAction?: () => void
  testId?: string
  dismissTestId?: string
  actionTestId?: string
  role?: string
  style?: CSSProperties
}

export interface SkinToastStackProps {
  items: SkinToastItem[]
  onDismiss?: (id: string) => void
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}

const ROLE_BY_SEVERITY = {
  info: 'toast.info',
  success: 'toast.success',
  warning: 'toast.warning',
  error: 'toast.error',
} as const

const ICON_BY_SEVERITY = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const

function stackStyle(position: NonNullable<SkinToastStackProps['position']>): CSSProperties {
  const style: CSSProperties = {
    position: 'fixed',
    zIndex: 500,
    display: 'grid',
    gap: '0.75rem',
    padding: '16px',
    pointerEvents: 'none',
    width: 'min(420px, calc(100vw - 24px))',
  }

  if (position.startsWith('top')) {
    style.top = 0
  } else {
    style.bottom = 0
  }

  if (position.endsWith('left')) {
    style.left = 0
  } else if (position.endsWith('right')) {
    style.right = 0
  } else {
    style.left = '50%'
    style.transform = 'translateX(-50%)'
  }

  return style
}

export interface SkinToastCardProps {
  item: SkinToastItem
  onDismiss?: (id: string) => void
}

export function SkinToastCard({ item, onDismiss }: SkinToastCardProps) {
  return (
    <SkinSurface
      as="article"
      className={joinClassName('ui-panel', 'ui-toast')}
      data-severity={item.severity}
      data-testid={item.testId}
      role={item.role}
      skinRole={ROLE_BY_SEVERITY[item.severity]}
      data-variant="section"
      style={{
        width: '100%',
        pointerEvents: 'auto',
        ...item.style,
      }}
    >
      <div className="ui-panel__content ui-toast__content">
        <div className="ui-toast__layout">
          <div className="ui-toast__main">
            <span aria-hidden="true" className="ui-toast__icon">
              <SkinIcon name={ICON_BY_SEVERITY[item.severity]} size={18} />
            </span>
            <div className="ui-toast__copy">
              {item.title ? (
                <div className="ui-panel__title">{item.title}</div>
              ) : null}
              <div className="ui-toast__message">{item.message}</div>
            </div>
          </div>
          <div className="ui-toast__actions">
            {item.actionLabel && item.onAction ? (
              <button
                className="ui-toast__action-button"
                data-testid={item.actionTestId}
                onClick={item.onAction}
                type="button"
              >
                {item.actionLabel}
              </button>
            ) : null}
            {onDismiss ? (
              <button
                aria-label="Dismiss toast"
                className="ui-toast__dismiss-button"
                data-testid={item.dismissTestId}
                onClick={() => onDismiss(item.id)}
                type="button"
              >
                x
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </SkinSurface>
  )
}

export function SkinToastStack({
  items,
  onDismiss,
  position = 'top-center',
}: SkinToastStackProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div style={stackStyle(position)}>
      {items.map((item) => (
        <SkinToastCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
