/**
 * Pad-grid store — Groovepad 6-block-per-bank model.
 *
 * Layout per bank (research/groovepad/features.md:7,28-29 + user observation
 * 2026-05-01):
 *
 *   ┌─────────────┬─────────────┐
 *   │ block-0     │ block-1     │  drums + bass loops
 *   ├─────────────┼─────────────┤
 *   │ block-2     │ block-3     │  melody + keys loops
 *   ├─────────────┼─────────────┤
 *   │ block-4     │ block-5     │  drum-fills + fx one-shots
 *   └─────────────┴─────────────┘
 *
 * Each block holds 4 variants. Per-block lockout: at most ONE looping
 * variant per block plays at a time. Tapping a different variant in the
 * same loop block enqueues it; the queued variant takes over at the next
 * bar boundary (with a circular sweep ring while it waits). One-shot blocks
 * (4 + 5) tap-fire immediately and restart on re-tap.
 *
 * Banks A and B are interchangeable instrument sets. Portrait viewports
 * show one bank at a time and expose an A/B toggle in the top bar; landscape
 * shows both side-by-side. Switching banks does NOT cancel currently-active
 * loops in the off-screen bank — the player can latch a few drums in A,
 * swap to B, and layer a B lead on top.
 */

import { create } from 'zustand'
import { getPadGridEngine } from '../systems/pad-grid-engine'
import { notifyPadAction } from '../systems/mixes/sessions/record-session'
import type { PadBank, PadBlockId, PadColor, PadMeta } from '../types/kit'

export type PadState = 'idle' | 'queued' | 'active' | 'firing'
export type RecordingMode = 'idle' | 'recording' | 'replay'

/**
 * Per-bank-per-block FX-bypass flag map. `true` = the active variant in
 * that block routes through the FX bus; `false` = it routes dry. The FX
 * toggle button lives as a thin sliver next to each block.
 */
export type FxBypassMap = Record<PadBank, Record<PadBlockId, boolean>>

/**
 * Per-pad one-shot firing window — the AudioContext-time interval over
 * which a one-shot pad is audibly ringing out. The UI's PlayheadBar
 * reads `(startsAt, endsAt)` to render the horizontal fill that sweeps
 * across the cell during a one-shot. The engine writes here when
 * `tapOneShot` schedules a fire and clears the entry when the audio
 * settles via `tick()`.
 */
export interface OneShotWindow {
  startsAt: number
  endsAt: number
}

/**
 * Per-block queue state: the padId queued to take over at the next bar in
 * a given block, plus the audio-context time the queue was placed (used to
 * animate the circular sweep ring). `null` = nothing queued in that block.
 */
export interface BlockQueueEntry {
  padId: string
  /** AudioContext time the queue was placed. */
  queuedAt: number
  /** AudioContext time the queue will land (next bar boundary). */
  landsAt: number
}

export type BlockQueueMap = Record<PadBank, Record<PadBlockId, BlockQueueEntry | null>>

export interface PadGridState {
  /** Which bank is visible in portrait. Landscape ignores this and shows both. */
  currentBank: PadBank
  /** Active pad ids — currently audible (loops + ringing one-shots). */
  activePadIds: string[]
  /** Latched pad ids (subset of `activePadIds`). Loops are always latched. */
  latchedPadIds: string[]
  /** Per-block queue state — drives the circular-sweep visual. */
  queued: BlockQueueMap
  /** Per-pad one-shot firing window — drives the horizontal playhead bar. */
  oneShotWindows: Record<string, OneShotWindow>
  /** Master mute (transport-bar mute-all). */
  allMuted: boolean
  /** Transport mode. */
  mode: RecordingMode
  /** Recording bar 1..8; 0 when idle. */
  recordingBar: number
  /** BPM (visual-only — real BPM comes from kit metadata). */
  bpm: number
  /** Per-bank-per-block FX-bypass flags. */
  fxBypass: FxBypassMap

  /**
   * Tap a looping pad → enqueue it. Engine handles per-block lockout and
   * the bar-aligned crossfade. If the same pad is already active, the
   * second tap deactivates it (toggle-off).
   */
  tapLoop: (padId: string) => void
  /** Fire a one-shot. Re-tap restarts. */
  tapOneShot: (padId: string) => void
  /** Optimistic deactivate (used by the engine + tests). */
  deactivate: (padId: string) => void
  /** Switch the visible portrait bank. */
  setCurrentBank: (bank: PadBank) => void
  /** Recording transport. */
  setMode: (mode: RecordingMode) => void
  /** Master mute toggle. */
  toggleAllMuted: () => void
  /** Toggle the FX-bypass flag for a (bank, blockId). */
  toggleFxBypass: (bank: PadBank, blockId: PadBlockId) => void
}

const ALL_BLOCK_IDS_LOCAL: readonly PadBlockId[] = [
  'block-0', 'block-1', 'block-2', 'block-3', 'block-4', 'block-5',
]

function buildEmptyBlockMap<T>(value: T): Record<PadBlockId, T> {
  return {
    'block-0': value,
    'block-1': value,
    'block-2': value,
    'block-3': value,
    'block-4': value,
    'block-5': value,
  }
}

function buildDefaultFxBypass(): FxBypassMap {
  return {
    A: buildEmptyBlockMap(false),
    B: buildEmptyBlockMap(false),
  }
}

export function buildDefaultQueue(): BlockQueueMap {
  return {
    A: buildEmptyBlockMap<BlockQueueEntry | null>(null),
    B: buildEmptyBlockMap<BlockQueueEntry | null>(null),
  }
}

/** Demo seed — a few pads latched on so the populated visual is visible without FTUE. */
export const DEMO_ACTIVE_PAD_IDS: readonly string[] = [
  'A-block-0-0', // drums Kick + Hat
  'A-block-1-1', // bass Walking
  'A-block-2-0', // melody Rhodes
]

export const usePadGridStore = create<PadGridState>((set) => ({
  currentBank: 'A',
  activePadIds: [],
  latchedPadIds: [],
  queued: buildDefaultQueue(),
  oneShotWindows: {},
  allMuted: false,
  mode: 'idle',
  recordingBar: 0,
  bpm: 84,
  fxBypass: buildDefaultFxBypass(),

  // Each mutating action notifies the registered MixRecorder observer
  // BEFORE invoking the engine. When recording is inactive the observer
  // is null and `notifyPadAction` is a no-op. Capturing here means every
  // call site (UI, debug API, future automations) gets recorded without
  // having to migrate each tap surface to a wrapper.
  tapLoop: (padId) => {
    notifyPadAction('onTapLoop', padId)
    getPadGridEngine().tapLoop(padId)
  },
  tapOneShot: (padId) => {
    notifyPadAction('onTapOneShot', padId)
    getPadGridEngine().tapOneShot(padId)
  },
  deactivate: (padId) => {
    notifyPadAction('onDeactivate', padId)
    getPadGridEngine().deactivate(padId)
  },
  setCurrentBank: (bank) => {
    notifyPadAction('onSetCurrentBank', bank)
    set(() => ({ currentBank: bank }))
  },
  setMode: (mode) =>
    set(() => ({
      mode,
      recordingBar: mode === 'recording' ? 3 : 0,
    })),
  toggleAllMuted: () => set((state) => ({ allMuted: !state.allMuted })),
  toggleFxBypass: (bank, blockId) => {
    notifyPadAction('onToggleFxBypass', bank, blockId)
    set((state) => ({
      fxBypass: {
        ...state.fxBypass,
        [bank]: {
          ...state.fxBypass[bank],
          [blockId]: !state.fxBypass[bank][blockId],
        },
      },
    }))
  },
}))

/**
 * Test/debug helper — restore the seeded baseline. `'demo'` lands the
 * populated visual; `'empty'` is the production fresh-launch state.
 */
export function resetPadGridStore(variant: 'demo' | 'empty' = 'demo'): void {
  const activePadIds = variant === 'demo' ? [...DEMO_ACTIVE_PAD_IDS] : []
  usePadGridStore.setState({
    currentBank: 'A',
    activePadIds,
    // In demo mode we treat every seeded active pad as a latched loop so
    // the screenshot-driven specs see the persistent saturated chrome.
    latchedPadIds: variant === 'demo' ? [...activePadIds] : [],
    queued: buildDefaultQueue(),
    oneShotWindows: {},
    allMuted: false,
    mode: 'idle',
    recordingBar: 0,
    bpm: 84,
    fxBypass: buildDefaultFxBypass(),
  })
}

/**
 * Resolve a pad's visual state given the store snapshot. Order:
 *   - `'queued'` if the pad is queued in its block (waiting to take over)
 *   - `'firing'` if it's a one-shot ringing out
 *   - `'active'` if it's a latched loop
 *   - `'idle'` otherwise
 *
 * The pad's own `isOneShot` flag distinguishes `'active'` (loop latched)
 * from `'firing'` (one-shot ringing). `'queued'` only applies to loops.
 */
export function padStateFor(
  pad: Pick<PadMeta, 'padId' | 'bank' | 'blockId' | 'isOneShot'>,
  state: Pick<PadGridState, 'activePadIds' | 'latchedPadIds' | 'queued'>,
): PadState {
  const queueEntry = state.queued[pad.bank][pad.blockId]
  if (queueEntry?.padId === pad.padId) return 'queued'
  if (state.activePadIds.includes(pad.padId)) {
    if (pad.isOneShot) return 'firing'
    return 'active'
  }
  return 'idle'
}

/**
 * Per-instrument color identity (drums red, bass purple, melody yellow,
 * keys mint, drumFills orange, fx teal). The active fill paints the saturated
 * gradient on `--ui-button-fill`; the idle ring is a soft outline tint.
 */
export interface PadPalette {
  activeBg: string
  activeRing: string
  idleRing: string
  dot: string
  label: string
}

/**
 * Neon Arcade palette: four neon hues mapped onto six instrument families.
 * Drums + vocals share rose, melody + drumFills share amber, bass uses
 * violet, fx uses cyan — matches the source mock (neon-arcade/app.jsx).
 *
 * `activeBg` is a subtle 22% top-down gradient bleeding into transparency
 * (mock-style — the cell's dark base shows through, the accent only
 * "tints" it). `activeRing` carries the full glow color used by the
 * outer halo + inset border. `idleRing` is the corner-accent / dim
 * outline color when the cell is at rest.
 */
const NEON = {
  rose: '#FF3CB6',
  violet: '#B05CFF',
  amber: '#FFD23C',
  cyan: '#3CE5FF',
} as const

function neonGradient(hex: string): string {
  // 22 ≈ 13% alpha in hex. Mock uses `${hex}22` directly which Web inputs
  // accept on modern browsers; we keep the same form for fidelity.
  return `linear-gradient(180deg, ${hex}22 0%, transparent 75%)`
}

export const PAD_PALETTE: Record<PadColor, PadPalette> = {
  drums: {
    activeBg: neonGradient(NEON.rose),
    activeRing: NEON.rose,
    idleRing: 'rgba(255, 60, 182, 0.55)',
    dot: NEON.rose,
    label: 'Drums',
  },
  bass: {
    activeBg: neonGradient(NEON.violet),
    activeRing: NEON.violet,
    idleRing: 'rgba(176, 92, 255, 0.55)',
    dot: NEON.violet,
    label: 'Bass',
  },
  melody: {
    activeBg: neonGradient(NEON.amber),
    activeRing: NEON.amber,
    idleRing: 'rgba(255, 210, 60, 0.55)',
    dot: NEON.amber,
    label: 'Melody',
  },
  vocals: {
    activeBg: neonGradient(NEON.rose),
    activeRing: NEON.rose,
    idleRing: 'rgba(255, 60, 182, 0.55)',
    dot: NEON.rose,
    label: 'Vocals',
  },
  drumFills: {
    activeBg: neonGradient(NEON.amber),
    activeRing: NEON.amber,
    idleRing: 'rgba(255, 210, 60, 0.55)',
    dot: NEON.amber,
    label: 'Fills',
  },
  fx: {
    activeBg: neonGradient(NEON.cyan),
    activeRing: NEON.cyan,
    idleRing: 'rgba(60, 229, 255, 0.55)',
    dot: NEON.cyan,
    label: 'FX',
  },
}

/** All blockIds in display order. */
export const BLOCK_IDS_IN_ORDER: readonly PadBlockId[] = ALL_BLOCK_IDS_LOCAL
