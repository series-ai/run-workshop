import type { CSSProperties, HTMLAttributes } from 'react'
import { joinClassName } from './theme/classNames'

export type SkinScrollBarOrientation = 'horizontal' | 'vertical'

export interface SkinScrollBarProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  value: number
  max?: number
  thumbSizePercent?: number
  orientation?: SkinScrollBarOrientation
  active?: boolean
  disabled?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function SkinScrollBar({
  value,
  max = 100,
  thumbSizePercent = 28,
  orientation = 'horizontal',
  active = false,
  disabled = false,
  className,
  style,
  ...rest
}: SkinScrollBarProps) {
  const resolvedMax = max > 0 ? max : 100
  const normalizedValue = clamp(value, 0, resolvedMax)
  const valuePercent = clamp((normalizedValue / resolvedMax) * 100, 0, 100)
  const resolvedThumbPercent = clamp(thumbSizePercent, 10, 100)
  const travelPercent = Math.max(0, 100 - resolvedThumbPercent)
  const thumbStartPercent = (valuePercent / 100) * travelPercent
  const state = disabled ? 'disabled' : active ? 'active' : 'default'

  return (
    <div
      {...rest}
      aria-disabled={disabled || undefined}
      aria-orientation={orientation}
      aria-valuemax={resolvedMax}
      aria-valuemin={0}
      aria-valuenow={Math.round(normalizedValue)}
      className={joinClassName('ui-scrollbar', className)}
      data-orientation={orientation}
      data-state={state}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.scrollbar"
      role="scrollbar"
      style={{
        '--ui-scrollbar-thumb-span': `${resolvedThumbPercent}%`,
        '--ui-scrollbar-thumb-start': `${thumbStartPercent}%`,
        ...style,
      } as CSSProperties}
    >
      <div className="ui-scrollbar__track">
        <div className="ui-scrollbar__thumb" />
      </div>
    </div>
  )
}
