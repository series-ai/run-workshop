import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { SkinBadge } from './SkinBadge'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinDrawerItem {
  id: string
  label: ReactNode
  iconName?: UiSkinIconName
  icon?: ReactNode
  badgeCount?: number
  isNew?: boolean
  disabled?: boolean
  testId?: string
  badgeTestId?: string
  newIndicatorTestId?: string
}

export interface SkinDrawerButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onSelect'> {
  item: SkinDrawerItem
  active?: boolean
  onSelect?: (id: string) => void
}

export function SkinDrawerButton({ item, active = false, onSelect, className, style, ...rest }: SkinDrawerButtonProps) {
  const state = item.disabled ? 'disabled' : active ? 'active' : 'default'

  return (
    <button
      {...rest}
      className={joinClassName('ui-surface', 'ui-drawer-button', className)}
      data-state={state}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.drawerButton"
      data-testid={item.testId}
      disabled={item.disabled}
      onClick={() => onSelect?.(item.id)}
      style={style}
      type="button"
    >
      <span className="ui-drawer-button__content">
        {item.icon ? (
          <span aria-hidden="true" className="ui-drawer-button__icon">
            {item.icon}
          </span>
        ) : item.iconName ? (
          <SkinIcon aria-hidden="true" className="ui-drawer-button__icon" name={item.iconName} size={24} />
        ) : null}
        <span className="ui-drawer-button__label">{item.label}</span>
      </span>
      {item.isNew ? (
        <SkinBadge className="ui-drawer-button__badge" data-testid={item.newIndicatorTestId} variant="new">
          NEW
        </SkinBadge>
      ) : null}
      {item.badgeCount && item.badgeCount > 0 ? (
        <SkinBadge className="ui-drawer-button__badge" data-testid={item.badgeTestId} variant="counter">
          {item.badgeCount}
        </SkinBadge>
      ) : null}
    </button>
  )
}

export interface SkinNavDrawerProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  items: SkinDrawerItem[]
  activeId?: string | null
  onSelect?: (id: string) => void
  children?: ReactNode
}

export function SkinNavDrawer({
  items,
  activeId = null,
  onSelect,
  children,
  className,
  style,
  ...rest
}: SkinNavDrawerProps) {
  const content =
    children ??
    items.map((item) => (
      <SkinDrawerButton key={item.id} active={item.id === activeId} item={item} onSelect={onSelect} />
    ))

  return (
    <nav
      {...rest}
      className={joinClassName('ui-nav-drawer', className)}
      data-has-shell={children ? 'false' : 'true'}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.sideDrawer"
      data-item-count={items.length}
      style={style}
    >
      {content}
    </nav>
  )
}
