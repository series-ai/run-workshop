import { SkinButton } from './SkinButton'
import type { SkinSelectionItem } from './SkinSelectionItem'

export type SkinToggleGroupItem = SkinSelectionItem

/**
 * Layout for a multi-select option row.
 *  - `segmented` (default): shared pill container, equal-width items, single
 *    row, no wrap. Active items show a leading `✓`. Best for 2–5 short labels.
 *  - `chips`: wrap-friendly. No shared container; each item is a content-width
 *    pill that wraps onto new rows as needed. Best for many options or
 *    variable-width labels. Selection semantics (role="group" /
 *    aria-pressed) are identical to the `segmented` layout.
 */
export type SkinToggleGroupLayout = 'segmented' | 'chips'

export interface SkinToggleGroupProps {
  items: SkinSelectionItem[]
  value: string[]
  onToggle?: (id: string) => void
  size?: 'default' | 'compact'
  disabled?: boolean
  layout?: SkinToggleGroupLayout
}

export function SkinToggleGroup({
  items,
  value,
  onToggle,
  size = 'default',
  disabled = false,
  layout = 'segmented',
}: SkinToggleGroupProps) {
  const isChips = layout === 'chips'
  return (
    <div
      className={isChips ? 'ui-choice-row' : 'ui-toggle-group'}
      data-size={size}
      data-layout={layout}
      data-selection-model="multi"
      data-ui-skin-role="nav.toggleGroup"
      data-ui-slot="group"
      role="group"
    >
      {items.map((item) => {
        const isSelected = value.includes(item.id)
        return (
          <SkinButton
            key={item.id}
            active={isSelected}
            aria-pressed={isSelected}
            disabled={disabled || item.disabled}
            iconName={item.iconName}
            onClick={() => onToggle?.(item.id)}
            data-ui-slot="button"
            size={size}
            variant={isChips ? 'pill' : 'toggle'}
          >
            {item.label}
          </SkinButton>
        )
      })}
    </div>
  )
}
