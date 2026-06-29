import type { HTMLAttributes } from 'react'
import { SkinBadge } from './SkinBadge'
import { SkinIcon } from './SkinIcon'
import { joinClassName } from './theme/classNames'
import type { UiSkinIconName } from './types'

export interface SkinTabBarItem {
  id: string
  label: string
  iconName: UiSkinIconName
  badgeCount?: number
  disabled?: boolean
}

export interface SkinTabBarProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  items: SkinTabBarItem[]
  activeId: string
  onSelect?: (id: string) => void
}

export function SkinTabBar({ items, activeId, onSelect, className, ...rest }: SkinTabBarProps) {
  return (
    <nav {...rest} className={joinClassName('ui-tab-bar', className)} data-ui-skin-role="nav.bottomBar">
      {items.map((item) => {
        const isActive = item.id === activeId
        const hasBadge = Boolean(item.badgeCount && item.badgeCount > 0)

        return (
          <button
            key={item.id}
            className="ui-tab-bar__item"
            data-state={isActive ? 'active' : 'default'}
            data-tab-id={item.id}
            data-ftue={`tab-${item.id}`}
            disabled={item.disabled}
            type="button"
            onClick={() => onSelect?.(item.id)}
          >
            <span className="ui-tab-bar__icon-wrap">
              <SkinIcon className="ui-tab-bar__icon" name={item.iconName} size={22} />
            </span>
            <span className="ui-tab-bar__label">{item.label}</span>
            {hasBadge ? (
              <SkinBadge className="ui-tab-bar__badge" variant="counter">{item.badgeCount}</SkinBadge>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
