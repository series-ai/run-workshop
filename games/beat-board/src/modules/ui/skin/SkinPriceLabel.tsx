import type { HTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinPriceLabelProps extends HTMLAttributes<HTMLSpanElement> {
  amount: string
  iconName?: UiSkinIconName
  size?: 'default' | 'large'
}

export function SkinPriceLabel({ amount, iconName, size = 'default', className, ...rest }: SkinPriceLabelProps) {
  return (
    <span
      {...rest}
      className={joinClassName('ui-price-label', className)}
      data-size={size}
      data-ui-skin-role="shop.price"
    >
      {iconName ? <SkinIcon className="ui-price-label__icon" name={iconName} size={size === 'large' ? 22 : 16} /> : null}
      <span className="ui-price-label__amount">{amount}</span>
    </span>
  )
}
