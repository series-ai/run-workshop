import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { SkinBadge } from './SkinBadge'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinRailItem {
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

export interface SkinRailButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onSelect'> {
  item: SkinRailItem
  active?: boolean
  onSelect?: (id: string) => void
}

export function SkinRailButton({ item, active = false, onSelect, className, style, ...rest }: SkinRailButtonProps) {
  const state = item.disabled ? 'disabled' : active ? 'active' : 'default'

  return (
    <button
      {...rest}
      className={joinClassName('ui-surface', 'ui-rail-button', className)}
      data-state={state}
      data-tab-id={item.id}
      data-ftue={`tab-${item.id}`}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.railButton"
      data-testid={item.testId}
      disabled={item.disabled}
      onClick={() => onSelect?.(item.id)}
      style={style}
      type="button"
    >
      <span className="ui-rail-button__content">
        <span className="ui-rail-button__top">
          {item.icon ? (
            <span aria-hidden="true" className="ui-rail-button__icon">
              {item.icon}
            </span>
          ) : item.iconName ? (
            <SkinIcon aria-hidden="true" className="ui-rail-button__icon" name={item.iconName} size={24} />
          ) : null}
          <span className="ui-rail-button__label">{item.label}</span>
        </span>
        <span className="ui-rail-button__meta">
          {item.isNew ? (
            <SkinBadge data-testid={item.newIndicatorTestId} variant="new">
              NEW
            </SkinBadge>
          ) : null}
          {item.badgeCount && item.badgeCount > 0 ? (
            <SkinBadge data-testid={item.badgeTestId} variant="counter">
              {item.badgeCount}
            </SkinBadge>
          ) : null}
        </span>
      </span>
    </button>
  )
}

export interface SkinNavRailProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  items: SkinRailItem[]
  activeId?: string | null
  onSelect?: (id: string) => void
  children?: ReactNode
}

export function SkinNavRail({
  items,
  activeId = null,
  onSelect,
  children,
  className,
  style,
  ...rest
}: SkinNavRailProps) {
  const content =
    children ??
    items.map((item) => (
      <SkinRailButton key={item.id} active={item.id === activeId} item={item} onSelect={onSelect} />
    ))

  return (
    <nav
      {...rest}
      className={joinClassName('ui-nav-rail', className)}
      data-has-shell={children ? 'false' : 'true'}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.sideRail"
      data-item-count={items.length}
      style={style}
    >
      {content}
    </nav>
  )
}
