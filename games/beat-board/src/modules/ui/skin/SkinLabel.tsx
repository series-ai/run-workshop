import type { HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'
import type { UiSkinRole } from './types'

type SkinLabelVariant = 'title' | 'section' | 'value'

const ROLE_BY_VARIANT: Record<SkinLabelVariant, UiSkinRole> = {
  title: 'label.title',
  section: 'label.section',
  value: 'label.value',
}

export interface SkinLabelProps extends HTMLAttributes<HTMLElement> {
  variant?: SkinLabelVariant
  children?: ReactNode
}

export function SkinLabel({
  variant = 'section',
  children,
  className,
  style,
  ...rest
}: SkinLabelProps) {
  return (
    <span
      {...rest}
      className={joinClassName('ui-label', className)}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role={ROLE_BY_VARIANT[variant]}
      data-variant={variant}
      style={style}
    >
      {children}
    </span>
  )
}

export function SkinTitleLabel(props: Omit<SkinLabelProps, 'variant'>) {
  return <SkinLabel {...props} variant="title" />
}

export function SkinSectionLabel(props: Omit<SkinLabelProps, 'variant'>) {
  return <SkinLabel {...props} variant="section" />
}

export function SkinValueLabel(props: Omit<SkinLabelProps, 'variant'>) {
  return <SkinLabel {...props} variant="value" />
}
