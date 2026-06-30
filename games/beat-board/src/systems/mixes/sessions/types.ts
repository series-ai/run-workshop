/**
 * MixSession — the timeline-of-events representation of a saved mix.
 *
 * Replaces the mp4-blob model. A mix is a sequence of pad-grid actions
 * (tap, deactivate, bank switch, FX toggle) keyed by their bar-relative
 * offset from the recording start. Replay is "fire each event at its
 * beat into the live audio engine" — which means the recipient hears
 * the take through their own audio graph, with their own master volume,
 * FX state, and kit content. No audio bytes are stored.
 *
 * Why bar-relative time (not ms): the kit's BPM is stable; storing
 * `t` in beats keeps replay deterministic regardless of the recording
 * device's wall-clock jitter, and keeps share-link payloads compact
 * even if we later support tempo changes mid-take. `bpm` on the
 * session is the authoritative clock for converting beats to seconds.
 *
 * Storage: serialised as JSON, written to `appStorage` (cloud-synced
 * for PLUS players). A typical 30s take is ~1–4 KB — fits comfortably
 * inside the SDK's `shareParams` payload cap (~100 KB).
 */

/** Stable id for a mix. Caller-supplied or library-generated. */
export type MixId = string

/** Bank label in the pad-grid (UI-facing). */
export type PadBankLabel = 'A' | 'B'

/**
 * A single recorded event. `t` is beats since recording start.
 * Events are sorted ascending by `t` and replayed in order.
 */
export type MixEvent =
  | { t: number; type: 'pad_activate'; padId: string }
  | { t: number; type: 'pad_deactivate'; padId: string }
  | { t: number; type: 'one_shot'; padId: string }
  | { t: number; type: 'bank_switch'; bank: PadBankLabel }
  | { t: number; type: 'fx_bypass_toggle'; bank: PadBankLabel; blockId: string }

/**
 * A complete recording. Pure data — JSON-serialisable.
 *
 * `events` are sorted ascending by `t`. `durationBeats` is the total
 * length the player held the recorder open for, in beats — replay uses
 * it for the scrubber and the duration label even when the last event
 * is well before the end.
 */
export interface MixSession {
  id: MixId
  /**
   * Original mix id from a share link. Present only for imported mixes;
   * used to make repeated imports of the same shared mix idempotent.
   */
  sourceMixId?: MixId
  title: string
  kitId: string
  /** BPM of the kit at recording time. Drives beat→seconds conversion. */
  bpm: number
  /** Total recording length in beats (including silence after last event). */
  durationBeats: number
  /** ms since epoch, anchored to client clock at save. */
  createdAtMs: number
  /** Sorted ascending by `t`. */
  events: MixEvent[]
  /**
   * Schema version. Bumped when MixEvent shapes change. Replay refuses
   * sessions with a version it doesn't understand rather than silently
   * dropping events.
   */
  version: 1
}

/** Latest known schema version. */
export const MIX_SESSION_VERSION = 1 as const

/** Convert a beat-offset to seconds at the given BPM. */
export function beatsToSeconds(beats: number, bpm: number): number {
  if (bpm <= 0) return 0
  return (beats * 60) / bpm
}

/** Convert a seconds-offset to beats at the given BPM. */
export function secondsToBeats(seconds: number, bpm: number): number {
  if (bpm <= 0) return 0
  return (seconds * bpm) / 60
}

/** Total duration in seconds — purely derived from `durationBeats` + `bpm`. */
export function sessionDurationSeconds(session: MixSession): number {
  return beatsToSeconds(session.durationBeats, session.bpm)
}
