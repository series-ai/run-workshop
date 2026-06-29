import type { HTMLAttributes, ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName, UiSkinRole } from './types'

type SkinBadgeVariant = 'status' | 'counter' | 'new' | 'currency' | 'value'

const ROLE_BY_VARIANT: Record<SkinBadgeVariant, UiSkinRole> = {
  status: 'badge.status',
  counter: 'badge.counter',
  new: 'badge.new',
  currency: 'chip.currency',
  value: 'chip.value',
}

export interface SkinBadgeProps extends HTMLAttributes<HTMLElement> {
  variant?: SkinBadgeVariant
  iconName?: UiSkinIconName
  children?: ReactNode
}

export function SkinBadge({
  variant = 'status',
  iconName,
  children,
  className,
  style,
  ...rest
}: SkinBadgeProps) {
  return (
    <span
      {...rest}
      className={joinClassName('ui-surface', 'ui-badge', className)}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role={ROLE_BY_VARIANT[variant]}
      data-variant={variant}
      style={style}
    >
      <span className="ui-badge__content">
        {iconName ? <SkinIcon name={iconName} size={variant === 'currency' || variant === 'value' ? 16 : 14} /> : null}
        {children}
      </span>
    </span>
  )
}
