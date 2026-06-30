import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export type ShopCardTint = 'subscription' | 'special' | 'chest' | 'currency' | 'default'
export type ShopCardRibbonPlacement = 'corner' | 'banner'

export interface SkinShopCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'name'> {
  tint?: ShopCardTint
  size?: 'standard' | 'featured'
  banner?: ReactNode
  header?: ReactNode
  artwork?: ReactNode
  quantity?: string
  name?: ReactNode
  price?: ReactNode
  badge?: ReactNode
  badgePosition?: 'top-right' | 'bottom-left'
  ribbon?: string
  ribbonPlacement?: ShopCardRibbonPlacement
}

export function SkinShopCard({
  tint = 'default',
  size = 'standard',
  banner,
  header,
  artwork,
  quantity,
  name,
  price,
  badge,
  badgePosition = 'top-right',
  ribbon,
  ribbonPlacement = 'corner',
  className,
  style,
  type = 'button',
  ...rest
}: SkinShopCardProps) {
  return (
    <button
      {...rest}
      className={joinClassName('ui-shop-card', className)}
      data-size={size}
      data-tint={tint}
      data-ui-skin-role="shop.card"
      data-ribbon={ribbon ? ribbonPlacement : undefined}
      data-ribbon-text={ribbon || undefined}
      style={style}
      type={type}
    >
      {badge ? <div className="ui-shop-card__badge" data-position={badgePosition} data-ui-slot="badge">{badge}</div> : null}
      {banner ? <div className="ui-shop-card__banner" data-ui-slot="banner">{banner}</div> : null}
      {header ? <div className="ui-shop-card__header" data-ui-slot="header">{header}</div> : null}
      <div className="ui-shop-card__artwork" data-ui-slot="artwork">
        {artwork}
        {quantity ? <span className="ui-shop-card__quantity" data-ui-slot="quantity">{quantity}</span> : null}
      </div>
      {name ? <div className="ui-shop-card__name" data-ui-slot="name">{name}</div> : null}
      {price ? <div className="ui-shop-card__price" data-ui-slot="price">{price}</div> : null}
    </button>
  )
}
