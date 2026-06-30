/**
 * Loop-kit data types.
 *
 * Issue beat-board-04-loop-kit-catalog owns this file. It defines the *runtime*
 * shape of a kit as ingested from the asset-bot loop-kit pipeline (PR #122):
 * a kit is a BPM + musical key + a list of pad descriptors, each pointing at
 * a per-layer wav buffer the audio engine decodes into the master graph.
 *
 * The pad-grid renderer reads these types via `getKitById(activeKitId)` and
 * uses `PadMeta.color` to enforce the harmonic-lockout rule (one active pad
 * per color family). prd.md § Mechanics Detail § Pad grid + harmonic lockout.
 */

/** Instrument family / column color. Drives palette tokens + per-block lockout. */
export type PadColor = 'drums' | 'bass' | 'melody' | 'vocals' | 'drumFills' | 'fx'

/**
 * A/B bank toggle (Groovepad parity — research/groovepad/features.md:29 +
 * direct user observation 2026-05-01). Each kit ships TWO interchangeable
 * banks of 24 pads. Portrait viewports show one bank at a time and expose a
 * top-bar A/B toggle to swap between them; landscape shows both banks
 * side-by-side with no toggle. Banks stack independently — switching banks
 * does NOT cancel currently-active loops in the off-screen bank, so the
 * player can latch a few drums in A, swap to B, and layer a B-bank lead on
 * top of A's drums.
 */
export type PadBank = 'A' | 'B'

/**
 * Stable identifier for one of the six 2×2 blocks within a bank. Each block
 * holds four variants of the same instrument family. Per-block lockout
 * means at most ONE variant per block plays at a time. The bottom two
 * blocks are one-shot blocks (`isOneShot: true` on every pad).
 *
 * Layout per bank (3 rows × 2 cols of blocks, 2×2 sound pads in each):
 *
 *     ┌──────────────┬──────────────┐
 *     │ block-0      │ block-1      │  drums + bass loops
 *     ├──────────────┼──────────────┤
 *     │ block-2      │ block-3      │  melody + keys loops
 *     ├──────────────┼──────────────┤
 *     │ block-4      │ block-5      │  drum-fills + fx one-shots
 *     └──────────────┴──────────────┘
 */
export type PadBlockId = 'block-0' | 'block-1' | 'block-2' | 'block-3' | 'block-4' | 'block-5'

/** All block ids in display order (left-to-right, top-to-bottom). */
export const ALL_BLOCK_IDS: readonly PadBlockId[] = [
  'block-0', 'block-1', 'block-2', 'block-3', 'block-4', 'block-5',
]

/** All bank ids in display order (A first). */
export const ALL_BANK_IDS: readonly PadBank[] = ['A', 'B']

/**
 * Per-pad metadata baked into the kit at content-authoring time.
 *
 *   - `color` drives the palette tint (purely cosmetic in this model — lockout
 *     is keyed off `blockId`, not color).
 *   - `bank` selects which A/B bank this pad lives in. Portrait shows one
 *     bank at a time; landscape shows both side-by-side.
 *   - `blockId` selects the 2×2 block within the bank. Per-block lockout:
 *     tapping a different variant in the same block swaps in at the next
 *     bar boundary (the queued variant shows a circular sweep ring while it
 *     waits to take over).
 *   - `variantIndex` is the pad's position within the block (0 = top-left,
 *     1 = top-right, 2 = bottom-left, 3 = bottom-right).
 *   - `isOneShot` distinguishes the bottom two blocks. One-shot pads tap-fire
 *     immediately, restart on re-tap, and have a different visual treatment
 *     (no queue ring, just a fire-flash).
 */
export interface PadMeta {
  /** Stable pad id (e.g. "A-block-0-0"). Unique within a kit. */
  padId: string
  /** Color family — palette tint only. Lockout is per-block, not per-color. */
  color: PadColor
  /** Which A/B bank this pad lives in. */
  bank: PadBank
  /** Which 2×2 block within the bank. */
  blockId: PadBlockId
  /** Position inside the block: 0 = TL, 1 = TR, 2 = BL, 3 = BR. */
  variantIndex: 0 | 1 | 2 | 3
  /**
   * One-shots tap-fire immediately, restart on re-tap, and visually flash
   * rather than queue. Looping pads enqueue at the next bar boundary.
   */
  isOneShot: boolean
  /** Layer id (e.g. "drum-loop-a"). */
  layerId: string
  /** Asset URL for the per-layer audio buffer. */
  bufferUrl: string
  /** Player-facing display label for the pad (e.g. "Kick + Hat"). */
  layerName: string
}

/**
 * Kit manifest as returned by the loop-kit pipeline. `bpm` is in the
 * supported 40–240 range; `key` is a musical-key string (e.g. "Cmin", "F#maj").
 */
export interface Kit {
  /** Stable kit id used by the catalog and entitlements. */
  id: string
  /** Display name. */
  name: string
  /** Beats per minute. Supported range 40–240 per loop-kit pipeline contract. */
  bpm: number
  /** Musical key (e.g. "Cmin", "F#maj"). All pads in a kit share this key. */
  key: string
  /** Pad descriptors (typically 16 in v1: 4 colors × 4 pads). */
  pads: PadMeta[]
  /**
   * Optional flag set on kits whose color metadata failed validation. When
   * true, the harmonic-lockout rule degrades to "any combination valid"
   * (prd.md § Mechanics Detail edge case "kit metadata missing").
   */
  invalidMetadata?: boolean
}

/** Index entry returned by the catalog index loader (`kits/index.json`). */
export interface KitIndexEntry {
  /** Stable kit id. */
  id: string
  /** Path to the per-kit manifest (relative to `src/content-assets/kits/`). */
  manifestPath: string
}
