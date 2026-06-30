import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'
import type { UiSkinRole } from './types'

export type SkinTagVariant = 'status' | 'callout' | 'value'
export type SkinTagTone = 'blue' | 'green' | 'purple' | 'yellow' | 'orange'

const ROLE_BY_VARIANT: Record<SkinTagVariant, UiSkinRole> = {
  status: 'tag.status',
  callout: 'tag.callout',
  value: 'tag.value',
}

export interface SkinTagProps extends HTMLAttributes<HTMLElement> {
  variant?: SkinTagVariant
  tone?: SkinTagTone
  children?: ReactNode
}

export function SkinTag({
  variant = 'status',
  tone,
  children,
  className,
  style,
  ...rest
}: SkinTagProps) {
  return (
    <span
      {...rest}
      className={joinClassName('ui-surface', 'ui-tag', className)}
      data-tone={tone}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role={ROLE_BY_VARIANT[variant]}
      data-variant={variant}
      style={style}
    >
      <span className="ui-tag__content">{children}</span>
    </span>
  )
}
