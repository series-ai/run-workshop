/**
 * BlockPanel — Groovepad-style rounded container that groups one block's
 * FX-toggle sliver + 2×2 of pads as a single visual unit.
 *
 *   ┌───────────────────────────────────┐
 *   │┌──┐┌─────────┐┌─────────┐         │
 *   ││FX││ pad TL  ││ pad TR  │         │
 *   │└──┘└─────────┘└─────────┘         │
 *   │    ┌─────────┐┌─────────┐         │
 *   │    │ pad BL  ││ pad BR  │         │
 *   │    └─────────┘└─────────┘         │
 *   └───────────────────────────────────┘
 *
 * Border color is derived from the block's instrument-category palette,
 * but DIM at idle and SATURATED when the FX-bypass toggle is on for this
 * block (matches the Groovepad reference: fully-saturated outline frames
 * the active FX panel). When FX is off the panel reads as a quiet group.
 */

import { type CSSProperties } from 'react'
import { Wand2 } from 'lucide-react'
import type { PadBank, PadBlockId, PadMeta } from '../../types/kit'
import { PAD_PALETTE, usePadGridStore } from '../../stores/padGridStore'
import { PadBlock } from './PadBlock'

export interface BlockPanelProps {
  bank: PadBank
  blockId: PadBlockId
  pads: PadMeta[]
  /** Sliver position relative to the block — left or right of the 2×2. */
  side: 'left' | 'right'
  interactive: boolean
}

export function BlockPanel({ bank, blockId, pads, side, interactive }: BlockPanelProps) {
  const isFxOn = usePadGridStore((s) => s.fxBypass[bank][blockId])
  const toggleFxBypass = usePadGridStore((s) => s.toggleFxBypass)
  const palette = pads[0] ? PAD_PALETTE[pads[0].color] : PAD_PALETTE.drums

  const panelStyle: CSSProperties = {
    flex: '1 1 0',
    display: 'flex',
    flexDirection: side === 'left' ? 'row' : 'row-reverse',
    minWidth: 0,
    minHeight: 0,
    gap: 6,
    padding: 6,
    borderRadius: 14,
    // Neon Arcade panel: translucent purple-black with a 1px stroke at
    // idle, 1.5px category accent + outer glow when FX is engaged for
    // this block. The translucent fill lets the radial-gradient backdrop
    // bleed through.
    border: `${isFxOn ? 1.5 : 1}px solid ${isFxOn ? palette.activeRing : 'var(--ls-stroke-strong)'}`,
    background: 'var(--ls-bg-translucent)',
    boxShadow: isFxOn ? `0 0 28px -6px ${palette.activeRing}99` : 'none',
    transition: 'border-color 220ms ease-out, box-shadow 220ms ease-out',
  }

  const sliverStyle: CSSProperties = {
    flex: '0 0 22px',
    width: 22,
    minWidth: 22,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
    padding: 0,
    borderRadius: 8,
    border: `1px solid ${isFxOn ? palette.activeRing : 'var(--ls-stroke-strong)'}`,
    // FX-on: full neon fill, dark text. FX-off: transparent with the
    // category color at half-alpha (mock-style "off" affordance).
    background: isFxOn ? palette.activeRing : 'transparent',
    color: isFxOn ? 'var(--ls-bg-page)' : palette.idleRing,
    cursor: interactive ? 'pointer' : 'default',
    fontSize: 8,
    fontWeight: 800,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    transition: 'background 220ms ease-out, color 220ms ease-out, border-color 220ms ease-out',
  }

  return (
    <div data-testid={`block-panel-${bank}-${blockId}`} data-block-fx-on={isFxOn ? 'true' : 'false'} style={panelStyle}>
      {/* The FX ON/OFF sliver is a player-only affordance. Poster mode
          (`interactive={false}`, used by MyMixesScreen mini-grid posters)
          should render just the pad shapes — the sliver's text shows up
          as a "OFF/OFF" stripe at thumbnail scale and reads as a layout
          bug. */}
      {interactive ? (
        <button
          type="button"
          data-testid={`block-fx-${bank}-${blockId}`}
          role="switch"
          aria-checked={isFxOn}
          aria-label={`Toggle FX for ${bank} ${blockId}`}
          onClick={() => {
            toggleFxBypass(bank, blockId)
          }}
          style={sliverStyle}
        >
          <Wand2 size={11} aria-hidden />
          <span>{isFxOn ? 'ON' : 'OFF'}</span>
        </button>
      ) : null}
      <PadBlock pads={pads} interactive={interactive} />
    </div>
  )
}
