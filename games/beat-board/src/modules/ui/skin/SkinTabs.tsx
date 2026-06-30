import { forwardRef, useRef, type ButtonHTMLAttributes, type KeyboardEvent } from 'react'
import { SkinBadge } from './SkinBadge'
import { SkinButton } from './SkinButton'
import type { SkinSelectionItem } from './SkinSelectionItem'
import { joinClassName } from './theme/classNames'

export type SkinTabItem = SkinSelectionItem

export interface SkinTabButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onSelect'> {
  item: SkinTabItem
  active?: boolean
  onSelect?: (id: string) => void
}

export const SkinTabButton = forwardRef<HTMLButtonElement, SkinTabButtonProps>(function SkinTabButton(
  { item, active = false, onSelect, className, style, ...rest }: SkinTabButtonProps,
  ref,
) {
  const hasBadge = Boolean(item.badgeCount && item.badgeCount > 0)

  return (
    <SkinButton
      {...rest}
      active={active}
      className={joinClassName('ui-tab-button', className)}
      disabled={item.disabled}
      floatingBadge={hasBadge ? <SkinBadge className="ui-tab-button__badge" variant="counter">{item.badgeCount}</SkinBadge> : null}
      iconName={item.iconName}
      onClick={() => onSelect?.(item.id)}
      ref={ref}
      style={{ width: '100%', ...style }}
      variant="tab"
    >
      <span className="ui-tab-button__label" data-ui-slot="label">{item.label}</span>
    </SkinButton>
  )
})

export interface SkinTabsProps {
  items: SkinTabItem[]
  activeId: string
  onSelect?: (id: string) => void
  orientation?: 'horizontal' | 'vertical'
}

export function SkinTabs({
  items,
  activeId,
  onSelect,
  orientation = 'horizontal',
}: SkinTabsProps) {
  const orderedEnabledItemIds = items.filter((item) => !item.disabled).map((item) => item.id)
  const buttonRefs = useRef(new Map<string, HTMLButtonElement | null>())

  const focusTab = (id: string) => {
    const target = buttonRefs.current.get(id)
    if (target) {
      target.focus()
    }
  }

  const getNextTabId = (currentId: string, step: -1 | 1) => {
    if (orderedEnabledItemIds.length === 0) {
      return null
    }

    const currentIndex = orderedEnabledItemIds.indexOf(currentId)
    const safeIndex = currentIndex === -1 ? 0 : currentIndex
    const nextIndex = (safeIndex + step + orderedEnabledItemIds.length) % orderedEnabledItemIds.length
    return orderedEnabledItemIds[nextIndex] ?? null
  }

  const handleKeyDown = (itemId: string) => (event: KeyboardEvent<HTMLButtonElement>) => {
    let targetId: string | null = null

    if (event.key === 'Home') {
      targetId = orderedEnabledItemIds[0] ?? null
    } else if (event.key === 'End') {
      targetId = orderedEnabledItemIds[orderedEnabledItemIds.length - 1] ?? null
    } else if (orientation === 'horizontal' && event.key === 'ArrowRight') {
      targetId = getNextTabId(itemId, 1)
    } else if (orientation === 'horizontal' && event.key === 'ArrowLeft') {
      targetId = getNextTabId(itemId, -1)
    } else if (orientation === 'vertical' && event.key === 'ArrowDown') {
      targetId = getNextTabId(itemId, 1)
    } else if (orientation === 'vertical' && event.key === 'ArrowUp') {
      targetId = getNextTabId(itemId, -1)
    }

    if (!targetId || targetId === itemId) {
      return
    }

    event.preventDefault()
    onSelect?.(targetId)
    focusTab(targetId)
  }

  return (
    <div
      aria-orientation={orientation}
      className="ui-tabs"
      data-orientation={orientation}
      data-ui-skin-role="nav.tabBar"
      data-ui-slot="tablist"
      role="tablist"
    >
      {items.map((item) => (
        <SkinTabButton
          key={item.id}
          active={item.id === activeId}
          aria-selected={item.id === activeId}
          item={item}
          onKeyDown={handleKeyDown(item.id)}
          onSelect={onSelect}
          ref={(node) => {
            buttonRefs.current.set(item.id, node)
          }}
          data-ui-slot="tab"
          role="tab"
          tabIndex={item.id === activeId ? 0 : -1}
        />
      ))}
    </div>
  )
}

export const SkinTabBar = SkinTabs
