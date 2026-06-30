/**
 * fx-bypass-wiring — bridge `padGridStore.fxBypass` (per-bank-per-block) to
 * per-pad wet sends.
 *
 * Each block's FX-toggle button flips a single boolean in `fxBypass[bank][blockId]`.
 * When it flips ON, every pad in that block routes through the active FX bus
 * (wet = 1); when OFF, those pads bypass FX (wet = 0).
 */

import { usePadGridStore } from '../stores/padGridStore'
import { useKitsStore, getKitById } from '../stores/kitsStore'
import { getPadAudioGraph } from './pad-audio-graph'
import type { FxBypassMap } from '../stores/padGridStore'
import type { PadBank, PadBlockId, PadMeta } from '../types/kit'
import { audioTrace } from './audio-trace'

let unsubscribe: (() => void) | null = null
let isInstalled = false
let hasAutoEngaged = false

const ALL_BLOCK_IDS: readonly PadBlockId[] = [
  'block-0', 'block-1', 'block-2', 'block-3', 'block-4', 'block-5',
]
const ALL_BANKS: readonly PadBank[] = ['A', 'B']

/**
 * Discoverability default — when no block has FX engaged yet, flip
 * `A.block-0` (drums) ON so the first XY-pad drag is audible. The FX system
 * is silent by default; without auto-engage the player taps an effect tab,
 * drags the XY pad, and concludes the FX system is broken.
 */
function maybeAutoEngageDefaults(map: FxBypassMap): boolean {
  if (hasAutoEngaged) return false
  hasAutoEngaged = true
  for (const bank of ALL_BANKS) {
    for (const blockId of ALL_BLOCK_IDS) {
      if (map[bank][blockId]) {
        audioTrace('fx-bypass-wiring:auto-engage:skip-existing', {})
        return false
      }
    }
  }
  audioTrace('fx-bypass-wiring:auto-engage', { cell: 'A.block-0' })
  usePadGridStore.getState().toggleFxBypass('A', 'block-0')
  return true
}

function getActiveKitPads(): readonly PadMeta[] {
  const kit = getKitById(useKitsStore.getState().activeKitId)
  return kit?.pads ?? []
}

function applyAllPadWetSends(fxBypass: FxBypassMap): void {
  for (const pad of getActiveKitPads()) {
    const wetTarget = fxBypass[pad.bank][pad.blockId] ? 1 : 0
    getPadAudioGraph().setPadWetSend(pad.padId, wetTarget)
  }
}

interface DiffEntry { bank: PadBank; blockId: PadBlockId }

function diffBypass(prev: FxBypassMap, next: FxBypassMap): DiffEntry[] {
  const diffs: DiffEntry[] = []
  for (const bank of ALL_BANKS) {
    for (const blockId of ALL_BLOCK_IDS) {
      if (prev[bank][blockId] !== next[bank][blockId]) diffs.push({ bank, blockId })
    }
  }
  return diffs
}

export function installFxBypassWiring(): void {
  if (isInstalled) return
  isInstalled = true

  // NOTE: do NOT call `applyAllPadWetSends` here — that would invoke
  // `setPadWetSend` → `ensureMaster` → `initAudioMaster` BEFORE any user
  // gesture, creating a suspended AudioContext that browsers won't let us
  // resume. Instead, the initial sync runs from inside the first
  // user-gesture stack, via `syncFxBypassWetSends()` exported below
  // (called after the screen's `forceResumeFromUserGesture()` lands the
  // context in 'running' state). Auto-engage flips the store but the
  // wet-send routing is applied on the next subscribe-driven update or
  // explicit sync.
  maybeAutoEngageDefaults(usePadGridStore.getState().fxBypass)

  let lastFxBypass = usePadGridStore.getState().fxBypass
  unsubscribe = usePadGridStore.subscribe((state) => {
    const next = state.fxBypass
    if (next === lastFxBypass) return
    const diffs = diffBypass(lastFxBypass, next)
    lastFxBypass = next
    if (diffs.length === 0) return

    audioTrace('fx-bypass-wiring:flip', {
      diffs: diffs.map((d) => `${d.bank}.${d.blockId}`),
    })

    const pads = getActiveKitPads()
    for (const { bank, blockId } of diffs) {
      const wetTarget = next[bank][blockId] ? 1 : 0
      for (const pad of pads) {
        if (pad.bank !== bank || pad.blockId !== blockId) continue
        getPadAudioGraph().setPadWetSend(pad.padId, wetTarget)
      }
    }
  })

  useKitsStore.subscribe((state, prev) => {
    if (state.activeKitId === prev.activeKitId) return
    audioTrace('fx-bypass-wiring:kit-swap-resync', { from: prev.activeKitId, to: state.activeKitId })
    applyAllPadWetSends(usePadGridStore.getState().fxBypass)
  })
}

export function syncFxBypassWetSends(): void {
  applyAllPadWetSends(usePadGridStore.getState().fxBypass)
  audioTrace('fx-bypass-wiring:sync', {})
}

export function __resetFxBypassWiring(): void {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  isInstalled = false
  hasAutoEngaged = false
}

export function __hasFxAutoEngaged(): boolean {
  return hasAutoEngaged
}
