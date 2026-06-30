import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinCircleFrameProps extends HTMLAttributes<HTMLDivElement> {
  color?: string
  size?: number
  children?: ReactNode
}

export function SkinCircleFrame({ color, size = 48, children, className, style, ...rest }: SkinCircleFrameProps) {
  return (
    <div
      {...rest}
      className={joinClassName('ui-circle-frame', className)}
      data-ui-skin-role="frame.circle"
      style={{
        '--ui-circle-frame-color': color ?? 'var(--ui-text-muted)',
        '--ui-circle-frame-size': `${size}px`,
        ...style,
      } as CSSProperties}
    >
      {children}
    </div>
  )
}
