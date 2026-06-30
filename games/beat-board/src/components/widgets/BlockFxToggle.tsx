/**
 * BlockFxToggle — small pill chip flush against one side of a 2×2 block.
 *
 *   - Idle: dim outline, small wand icon. Clearly reads as a control.
 *   - On:   saturated FX accent fill, gentle pulse animation, dot lit.
 *
 * Position depends on side:
 *   - left  → flush to the LEFT of the block, rounded on the right edge
 *   - right → flush to the RIGHT of the block, rounded on the left edge
 *
 * Always 28px wide (touch target). Vertically full-height to match the
 * 2×2 block; the icon is centered.
 */

import { type CSSProperties } from 'react'
import { Wand2 } from 'lucide-react'
import type { PadBank, PadBlockId } from '../../types/kit'
import { usePadGridStore } from '../../stores/padGridStore'

export interface BlockFxToggleProps {
  bank: PadBank
  blockId: PadBlockId
  side: 'left' | 'right'
  interactive: boolean
}

export function BlockFxToggle({ bank, blockId, side, interactive }: BlockFxToggleProps) {
  const isOn = usePadGridStore((s) => s.fxBypass[bank][blockId])
  const toggleFxBypass = usePadGridStore((s) => s.toggleFxBypass)

  const baseStyle: CSSProperties = {
    width: 28,
    minWidth: 28,
    flex: '0 0 28px',
    borderRadius:
      side === 'left' ? '12px 4px 4px 12px' : '4px 12px 12px 4px',
    border: `1px solid ${isOn
      ? 'var(--ui-color-accent, var(--ui-text-strong))'
      : 'var(--ui-color-border)'}`,
    background: isOn ? 'var(--ui-pad-fx-on)' : 'var(--ui-pad-fx-off)',
    color: isOn ? 'var(--ui-text-strong)' : 'var(--ui-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: interactive ? 'pointer' : 'default',
    padding: 0,
    transition:
      'background 220ms ease-out, ' +
      'border-color 220ms ease-out, ' +
      'color 220ms ease-out, ' +
      'box-shadow 220ms ease-out',
    boxShadow: isOn
      ? '0 0 12px var(--ui-color-accent-soft, var(--ui-pad-fx-on))'
      : 'none',
    animation: isOn ? 'pad-active-glow 1500ms ease-in-out infinite' : 'none',
  }

  return (
    <button
      type="button"
      data-testid={`block-fx-${bank}-${blockId}`}
      data-block-fx-on={isOn ? 'true' : 'false'}
      role="switch"
      aria-checked={isOn}
      aria-label={`Toggle FX for ${bank} ${blockId}`}
      disabled={!interactive}
      onClick={() => {
        if (!interactive) return
        toggleFxBypass(bank, blockId)
      }}
      style={baseStyle}
    >
      <Wand2 size={14} aria-hidden />
    </button>
  )
}
