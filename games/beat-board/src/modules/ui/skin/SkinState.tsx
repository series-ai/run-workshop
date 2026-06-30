import type { HTMLAttributes, ReactNode } from 'react'
import { SkinButton } from './SkinButton'
import { SkinIcon } from './SkinIcon'
import { SkinSurface } from './SkinSurface'
import type { UiSkinIconName, UiSkinRole } from './types'

type SkinStateVariant = 'empty' | 'loading' | 'error'

const ROLE_BY_VARIANT: Record<SkinStateVariant, UiSkinRole> = {
  empty: 'state.empty',
  loading: 'state.loading',
  error: 'state.error',
}

const ICON_BY_VARIANT: Record<SkinStateVariant, UiSkinIconName> = {
  empty: 'info',
  loading: 'success',
  error: 'error',
}

export interface SkinStateProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  variant?: SkinStateVariant
  /** Override the variant-based icon with a specific icon name */
  iconName?: UiSkinIconName
  title: ReactNode
  /** Alias: use `message` or `description` — both map to the subtitle slot */
  message?: ReactNode
  description?: ReactNode
  actionLabel?: ReactNode
  onAction?: () => void
}

export function SkinState({
  variant = 'empty',
  iconName,
  title,
  message,
  description,
  actionLabel,
  onAction,
  style,
  ...rest
}: SkinStateProps) {
  const resolvedMessage = message ?? description
  const resolvedIcon = iconName ?? ICON_BY_VARIANT[variant]
  return (
    <SkinSurface
      {...rest}
      as="section"
      skinRole={ROLE_BY_VARIANT[variant]}
      className="ui-panel"
      data-variant="section"
      style={{
        width: '100%',
        ...style,
      }}
    >
      <div className="ui-panel__content">
        <div
          className="ui-panel__body"
          style={{
            display: 'grid',
            justifyItems: 'center',
            gap: '0.75rem',
            textAlign: 'center',
          }}
        >
          <SkinIcon name={resolvedIcon} size={24} />
          <div className="ui-panel__title">{title}</div>
          {resolvedMessage ? (
            <div className="ui-panel__subtitle" style={{ lineHeight: 1.5 }}>
              {resolvedMessage}
            </div>
          ) : null}
          {actionLabel && onAction ? (
            <SkinButton onClick={onAction} variant={variant === 'error' ? 'secondary' : 'primary'}>
              {actionLabel}
            </SkinButton>
          ) : null}
        </div>
      </div>
    </SkinSurface>
  )
}

export function SkinEmptyState(props: Omit<SkinStateProps, 'variant'>) {
  return <SkinState {...props} variant="empty" />
}

export function SkinLoadingState(props: Omit<SkinStateProps, 'variant'>) {
  return <SkinState {...props} variant="loading" />
}

export function SkinErrorState(props: Omit<SkinStateProps, 'variant'>) {
  return <SkinState {...props} variant="error" />
}
