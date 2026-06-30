import type { ButtonHTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinRole } from './types'

const ROLE_BY_VARIANT: Record<SkinNavIconProps['variant'], UiSkinRole> = {
  back: 'button.back',
  close: 'button.close',
}

export interface SkinNavIconProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'back' | 'close'
}

export function SkinNavIcon({ variant, className, style, ...rest }: SkinNavIconProps) {
  return (
    <button
      {...rest}
      className={joinClassName('ui-nav-icon', className)}
      data-ui-skin-role={ROLE_BY_VARIANT[variant]}
      data-variant={variant}
      style={{
        minWidth: 'var(--ui-nav-icon-hit-size, var(--ui-geometry-touch-target-min, 44px))',
        width: 'var(--ui-nav-icon-hit-size, var(--ui-geometry-touch-target-min, 44px))',
        minHeight: 'var(--ui-nav-icon-hit-size, var(--ui-geometry-touch-target-min, 44px))',
        height: 'var(--ui-nav-icon-hit-size, var(--ui-geometry-touch-target-min, 44px))',
        ...style,
      }}
      type="button"
    >
      <SkinIcon name={variant === 'back' ? 'back' : 'close'} size={16} />
    </button>
  )
}

export function NavBack(props: Omit<SkinNavIconProps, 'variant'>) {
  return <SkinNavIcon {...props} variant="back" aria-label={props['aria-label'] ?? 'Back'} />
}

export function NavClose(props: Omit<SkinNavIconProps, 'variant'>) {
  return <SkinNavIcon {...props} variant="close" aria-label={props['aria-label'] ?? 'Close'} />
}
