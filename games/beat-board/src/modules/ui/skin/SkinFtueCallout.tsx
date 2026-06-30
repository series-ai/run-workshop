import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { SkinButton } from './SkinButton'
import { SkinSurface } from './SkinSurface'
import type { UiSkinRole } from './types'

type SkinFtueVariant = 'callout' | 'step-card' | 'gate-banner'

const ROLE_BY_VARIANT: Record<SkinFtueVariant, UiSkinRole> = {
  callout: 'ftue.callout',
  'step-card': 'ftue.stepCard',
  'gate-banner': 'ftue.gateBanner',
}

export interface SkinFtueCalloutProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  variant?: SkinFtueVariant
  title: ReactNode
  message: ReactNode
  highlight?: ReactNode
  actionLabel?: ReactNode
  onAction?: () => void
  actionProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> &
    Partial<Record<`data-${string}`, string | number | undefined>>
}

export function SkinFtueCallout({
  variant = 'callout',
  title,
  message,
  highlight,
  actionLabel,
  onAction,
  actionProps,
  style,
  ...rest
}: SkinFtueCalloutProps) {
  return (
    <SkinSurface
      {...rest}
      as="section"
      skinRole={ROLE_BY_VARIANT[variant]}
      className="ui-panel"
      data-variant="card"
      style={{
        width: '100%',
        ...style,
      }}
    >
      <div className="ui-panel__content">
        <div className="ui-panel__body" style={{ display: 'grid', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gap: '0.25rem' }}>
            <div className="ui-panel__title">{title}</div>
            <div className="ui-panel__subtitle" style={{ lineHeight: 1.5 }}>{message}</div>
          </div>
          {highlight ? (
            <SkinSurface
              as="div"
              skinRole="ftue.highlightFrame"
              className="ui-panel"
              data-variant="section"
              style={{ width: '100%' }}
            >
              <div className="ui-panel__content">
                <div className="ui-panel__body">{highlight}</div>
              </div>
            </SkinSurface>
          ) : null}
          {actionLabel && onAction ? (
            <div>
              <SkinButton {...actionProps} onClick={onAction} variant="primary">
                {actionLabel}
              </SkinButton>
            </div>
          ) : null}
        </div>
      </div>
    </SkinSurface>
  )
}
