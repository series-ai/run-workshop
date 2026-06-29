import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinPaginationDotItem {
  id: string
  label?: string
  disabled?: boolean
}

export interface SkinPaginationDotProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'> {
  active?: boolean
  onSelect?: () => void
}

export function SkinPaginationDot({
  active = false,
  disabled = false,
  onSelect,
  className,
  style,
  type = 'button',
  ...rest
}: SkinPaginationDotProps) {
  const surfaceState = disabled ? 'disabled' : active ? 'active' : 'default'

  return (
    <button
      {...rest}
      aria-current={active ? 'page' : undefined}
      className={joinClassName('ui-surface', 'ui-pagination-dot', className)}
      data-state={surfaceState}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="nav.paginationDot"
      disabled={disabled}
      onClick={onSelect}
      style={style}
      type={type}
    >
      <span className="ui-pagination-dot__content" />
    </button>
  )
}

export interface SkinPaginationDotsProps extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  items: SkinPaginationDotItem[]
  activeId?: string | null
  onSelect?: (id: string) => void
}

export function SkinPaginationDots({
  items,
  activeId = null,
  onSelect,
  style,
  ...rest
}: SkinPaginationDotsProps) {
  return (
    <div
      {...rest}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.6rem',
        alignItems: 'center',
        ...style,
      }}
    >
      {items.map((item) => (
        <SkinPaginationDot
          key={item.id}
          aria-label={item.label ?? item.id}
          data-testid={`pagination-dot-${item.id}`}
          disabled={item.disabled}
          active={item.id === activeId}
          onSelect={() => onSelect?.(item.id)}
        />
      ))}
    </div>
  )
}
