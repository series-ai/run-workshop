import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import type { SkinButtonTone } from './SkinButton'
import { joinClassName } from './theme/classNames'

export interface SkinProgressProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  value: number
  max?: number
  label?: ReactNode
  showValue?: boolean
  tone?: SkinButtonTone
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function SkinProgress({
  value,
  max = 100,
  label,
  showValue = false,
  tone,
  className,
  style,
  ...rest
}: SkinProgressProps) {
  const percent = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100)

  return (
    <div
      {...rest}
      className={joinClassName('ui-progress', className)}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="progress.bar"
      data-tone={tone}
      style={style}
    >
      <div className="ui-progress__track" style={{ '--ui-progress-percent': `${percent}%` } as CSSProperties}>
        <div className="ui-progress__bar">
          <div className="ui-progress__well" />
          <div className="ui-progress__fill-clip">
            <div className="ui-progress__fill" />
          </div>
        </div>
        {label || showValue ? (
          <div className="ui-progress__overlay">
            {label ? <span className="ui-progress__label">{label}</span> : null}
            {showValue ? <span className="ui-progress__value">{Math.round(percent)}%</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
