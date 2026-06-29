import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinPromoBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'value' | 'best' | 'special' | 'default'
  children: ReactNode
}

export function SkinPromoBadge({ tone = 'default', children, className, ...rest }: SkinPromoBadgeProps) {
  return (
    <span
      {...rest}
      className={joinClassName('ui-promo-badge', className)}
      data-tone={tone}
      data-ui-skin-role="shop.promoBadge"
    >
      {children}
    </span>
  )
}
