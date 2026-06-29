import type { HTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'

export interface SkinCountdownProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  time: string
}

export function SkinCountdown({ label = 'Resets in', time, className, ...rest }: SkinCountdownProps) {
  return (
    <div
      {...rest}
      className={joinClassName('ui-countdown', className)}
      data-ui-skin-role="display.countdown"
    >
      <SkinIcon className="ui-countdown__icon" name="clock" size={16} />
      <span className="ui-countdown__label">{label}</span>
      <span className="ui-countdown__time">{time}</span>
    </div>
  )
}
