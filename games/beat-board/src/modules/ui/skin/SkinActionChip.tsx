import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinActionChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  iconName: UiSkinIconName
  label?: ReactNode
}

export function SkinActionChip({ iconName, label, className, ...rest }: SkinActionChipProps) {
  return (
    <button
      {...rest}
      className={joinClassName('ui-action-chip', className)}
      data-has-label={label ? 'true' : 'false'}
      type="button"
    >
      <SkinIcon className="ui-action-chip__icon" name={iconName} size={label ? 14 : 16} />
      {label ? <span className="ui-action-chip__label">{label}</span> : null}
    </button>
  )
}
