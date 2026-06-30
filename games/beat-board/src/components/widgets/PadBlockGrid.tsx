/**
 * PadBlockGrid — pad surface for one bank.
 *
 * Layout (3 rows × 2 cols of blocks, each block is a 2×2 of pads):
 *
 *   ┌──┬───────────────┬───────────────┬──┐
 *   │FX│ block-0       │ block-1       │FX│  ← drums + bass loops
 *   ├──┼───────────────┼───────────────┼──┤
 *   │FX│ block-2       │ block-3       │FX│  ← melody + vocals loops
 *   ├──┼───────────────┼───────────────┼──┤
 *   │FX│ block-4       │ block-5       │FX│  ← drum-fills + fx one-shots
 *   └──┴───────────────┴───────────────┴──┘
 *
 * Used by `ResponsivePadSurface`:
 *   - Portrait viewport → render ONE PadBlockGrid for the active bank, with
 *     the A/B toggle in the top bar exposed.
 *   - Landscape / desktop viewport → render TWO PadBlockGrids side-by-side
 *     (banks A and B), with the A/B toggle hidden.
 */

import { useMemo, type CSSProperties } from 'react'
import type { PadBank, PadBlockId, PadMeta } from '../../types/kit'
import { useKitsStore, getKitById } from '../../stores/kitsStore'
import { BlockPanel } from './BlockPanel'

export interface PadBlockGridProps {
  /** Which bank to render. */
  bank: PadBank
  /** True for the active player surface. False for poster / disabled / preview. */
  interactive: boolean
}

const BLOCK_ROWS: ReadonlyArray<readonly [PadBlockId, PadBlockId]> = [
  ['block-0', 'block-1'],
  ['block-2', 'block-3'],
  ['block-4', 'block-5'],
]

export function PadBlockGrid({ bank, interactive }: PadBlockGridProps) {
  const activeKitId = useKitsStore((s) => s.activeKitId)
  const allPads: readonly PadMeta[] = useMemo(() => {
    const kit = getKitById(activeKitId)
    return kit?.pads ?? []
  }, [activeKitId])

  const padsByBlock = useMemo(() => {
    const map: Record<PadBlockId, PadMeta[]> = {
      'block-0': [], 'block-1': [], 'block-2': [],
      'block-3': [], 'block-4': [], 'block-5': [],
    }
    for (const pad of allPads) {
      if (pad.bank !== bank) continue
      map[pad.blockId].push(pad)
    }
    for (const blockId of Object.keys(map) as PadBlockId[]) {
      map[blockId].sort((a, b) => a.variantIndex - b.variantIndex)
    }
    return map
  }, [allPads, bank])

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 auto',
    minHeight: 0,
    // Bigger gap between block-rows than within a block; helps the eye
    // parse "this is a different instrument category."
    gap: 10,
  }

  const rowStyle: CSSProperties = {
    display: 'flex',
    flex: '1 1 0',
    minHeight: 0,
    gap: 6,
    alignItems: 'stretch',
  }

  return (
    <div data-testid={`pad-block-grid-${bank}`} data-bank={bank} style={containerStyle}>
      {BLOCK_ROWS.map(([leftBlockId, rightBlockId]) => (
        <div key={`row-${leftBlockId}-${rightBlockId}`} style={rowStyle}>
          <BlockPanel
            bank={bank}
            blockId={leftBlockId}
            pads={padsByBlock[leftBlockId]}
            side="left"
            interactive={interactive}
          />
          <BlockPanel
            bank={bank}
            blockId={rightBlockId}
            pads={padsByBlock[rightBlockId]}
            side="right"
            interactive={interactive}
          />
        </div>
      ))}
    </div>
  )
}
