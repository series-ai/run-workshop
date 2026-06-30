import { SkinButton } from './SkinButton'
import type { SkinSelectionItem } from './SkinSelectionItem'

export type SkinSegmentItem = SkinSelectionItem

/**
 * Layout for a single-select option row.
 *  - `segmented` (default): iOS-style. Shared pill container, equal-width
 *    segments (`flex: 1`), single row, no wrap. Best for 2–5 short labels.
 *  - `chips`: wrap-friendly. No shared container; each item is a content-width
 *    pill that wraps onto new rows as needed. Best for many options or
 *    variable-width labels. Selection semantics (radiogroup / radio /
 *    aria-checked) are identical to the `segmented` layout.
 */
export type SkinSegmentedControlLayout = 'segmented' | 'chips'

export interface SkinSegmentedControlProps {
  items: SkinSelectionItem[]
  activeId: string
  onSelect?: (id: string) => void
  size?: 'default' | 'compact'
  disabled?: boolean
  layout?: SkinSegmentedControlLayout
}

export function SkinSegmentedControl({
  items,
  activeId,
  onSelect,
  size = 'default',
  disabled = false,
  layout = 'segmented',
}: SkinSegmentedControlProps) {
  const isChips = layout === 'chips'
  return (
    <div
      className={isChips ? 'ui-choice-row' : 'ui-segmented-control'}
      data-size={size}
      data-layout={layout}
      data-selection-model="single"
      data-ui-skin-role="nav.segmentedControl"
      data-ui-slot="radiogroup"
      role="radiogroup"
    >
      {items.map((item) => (
        <SkinButton
          key={item.id}
          active={item.id === activeId}
          aria-checked={item.id === activeId}
          disabled={disabled || item.disabled}
          iconName={item.iconName}
          onClick={() => onSelect?.(item.id)}
          data-ui-slot="radio"
          role="radio"
          size={size}
          variant={isChips ? 'pill' : 'segment'}
        >
          {item.label}
        </SkinButton>
      ))}
    </div>
  )
}
