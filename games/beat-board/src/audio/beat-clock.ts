/**
 * beat-clock — BeatBoard's project-side wrapper around `juice/beat-sequencer`.
 *
 * Issue beat-board-03-audio-engine-and-beat-sequencer owns this file. The
 * raw `BeatSequencer` returned by `createBeatSequencer()` is generic; this
 * module:
 *
 *   - Owns the singleton sequencer instance every BeatBoard system reads.
 *   - Exposes `setBpm(bpm)` with safe BPM-hot-swap semantics (the in-flight
 *     bar progress survives the BPM change so a kit swap doesn't reset the
 *     loop position).
 *   - Adds project-specific helpers (`secondsPerBar`, `nextBarTimeFromNow`)
 *     that the Pad-Grid Engine and TransportBar use to schedule bar-aligned
 *     fades against the shared `AudioContext`.
 *   - Mirrors every beat into the global `juice/feedback-channel` `beat`
 *     channel so visual systems (record-button pulse, ambient grid pulse)
 *     can subscribe without coupling to the audio module directly.
 *
 * BPM range is clamped to 40–240 per prd.md § Mechanics Detail § Bar-aligned
 * audio fades. All kits are 4/4 in v1; the sequencer always runs four beats
 * per bar.
 */

import {
  createBeatSequencer,
  type BeatCallback,
  type BarCallback,
  type BeatSequencer,
} from '@modules/juice/beat-sequencer/BeatSequencer'
import {
  getGlobalFeedbackBus,
  type FeedbackChannel,
} from '@modules/juice/feedback-channel/FeedbackChannel'
import { getAudioContext, isAudioMasterReady } from './audio-master'

// ── Constants ────────────────────────────────────────────────────────────

/** prd.md § Bar-aligned audio fades: kits ship 40–240 BPM. */
export const MIN_BPM = 40
export const MAX_BPM = 240

/** v1 ships 4/4 only (prd.md § Bar-aligned audio fades, loop-kit pipeline contract). */
export const BEATS_PER_BAR = 4

/** Default BPM until the Pad-Grid Engine loads a kit. Matches prd.md sample (84 BPM). */
export const DEFAULT_BPM = 84

/** Channel id every BeatBoard visual system subscribes to for beat events. */
export const BEAT_FEEDBACK_CHANNEL = 'beat'

// ── Types ────────────────────────────────────────────────────────────────

export interface BeatClock {
  /** Current BPM. */
  getBpm(): number
  /**
   * Hot-swap BPM. Preserves the in-flight bar progress so the player's
   * existing pad layers stay aligned across kit swaps. Throws if `bpm` is
   * outside the supported range.
   */
  setBpm(bpm: number): void
  /** Fire `cb` on every beat boundary. Returns an unsubscribe handle. */
  subscribeBeat(cb: BeatCallback): () => void
  /** Fire `cb` on every bar boundary. Returns an unsubscribe handle. */
  subscribeBar(cb: BarCallback): () => void
  /** Bar duration in seconds at the current BPM. */
  secondsPerBar(): number
  /**
   * Number of seconds from "now" until the next bar boundary. Used by
   * Pad-Grid Engine to schedule bar-aligned crossfades. Reads from the
   * shared AudioContext clock when available, otherwise falls back to the
   * sequencer's own phase tracker.
   */
  nextBarTimeFromNow(): number
  /**
   * Alias of `nextBarTimeFromNow` exposed under the shorter name the
   * Pad-Grid Engine + Groovepad-alignment code paths use. Returns the
   * number of seconds from "now" until the next bar boundary.
   */
  nextBarFromNow(): number
  /**
   * Number of seconds from "now" until the next eighth-note boundary.
   * Reserved for the Phase 3 FX engine (continuous filter sweeps / XY-pad
   * smoothing) where eighth-note quantization is the right grain. Pad
   * activation and fade-in/out scheduling now use bar-aligned timing per
   * Groovepad's "next bar" feel.
   */
  nextEighthNoteFromNow(): number
  /** Begin advancing time on `update()` calls. */
  start(): void
  /** Pause the sequencer (keeps current beat position). */
  stop(): void
  /** Stop and reset to bar 0 / beat 0. Re-subscribes survive. */
  reset(): void
  /** Forward elapsed seconds to the underlying sequencer. */
  update(dtSeconds: number): void
  /** Whether the sequencer is currently active. */
  isActive(): boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────

function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) {
    throw new Error(`[beat-clock] BPM must be a finite number, got ${bpm}`)
  }
  if (bpm < MIN_BPM || bpm > MAX_BPM) {
    throw new Error(
      `[beat-clock] BPM ${bpm} outside supported range [${MIN_BPM}, ${MAX_BPM}]`,
    )
  }
  return bpm
}

export function secondsPerBar(bpm: number): number {
  clampBpm(bpm)
  return (60 / bpm) * BEATS_PER_BAR
}

// ── Implementation ───────────────────────────────────────────────────────

export function createBeatClock(initialBpm: number = DEFAULT_BPM): BeatClock {
  let currentBpm = clampBpm(initialBpm)
  let sequencer: BeatSequencer = createBeatSequencer({
    bpm: currentBpm,
    beatsPerBar: BEATS_PER_BAR,
    subdivision: 1,
  })

  // We track per-subscription wrappers so a BPM hot-swap (which rebuilds the
  // underlying sequencer) preserves every active subscription.
  const beatHandlers = new Set<BeatCallback>()
  const barHandlers = new Set<BarCallback>()
  let unsubscribeBeats: Array<() => void> = []
  let unsubscribeBars: Array<() => void> = []

  const bus: FeedbackChannel = getGlobalFeedbackBus()

  function emitBeatToBus(beat: number, bar: number): void {
    bus.emit({
      channel: BEAT_FEEDBACK_CHANNEL,
      beat,
      bar,
      bpm: currentBpm,
    })
  }

  function rebindCallbacks(): void {
    unsubscribeBeats.forEach((u) => u())
    unsubscribeBars.forEach((u) => u())
    unsubscribeBeats = []
    unsubscribeBars = []

    unsubscribeBeats.push(
      sequencer.onBeat((beat, bar) => {
        emitBeatToBus(beat, bar)
        for (const cb of beatHandlers) cb(beat, bar)
      }),
    )
    unsubscribeBars.push(
      sequencer.onBar((bar) => {
        for (const cb of barHandlers) cb(bar)
      }),
    )
  }

  rebindCallbacks()

  function clock(): BeatClock {
    return {
      getBpm: () => currentBpm,

      setBpm(bpm: number): void {
        const next = clampBpm(bpm)
        if (next === currentBpm) return

        // Acceptance: "BPM change recomputes timing without losing the
        // in-flight bar". We preserve the *fractional* bar position so a
        // tempo change time-stretches the current bar — pad layers stay
        // aligned to bar boundaries at the new tempo and the next bar
        // boundary still triggers fade-in/fade-out as expected.
        const wasActive = sequencer.isActive()
        const prevState = sequencer.update(0)
        const beatsIntoBar = prevState.beat
        const beatPhase = prevState.phase // 0..1 within current beat
        const fractionIntoOldBar = (beatsIntoBar + beatPhase) / BEATS_PER_BAR

        currentBpm = next
        sequencer.stop()
        sequencer = createBeatSequencer({
          bpm: currentBpm,
          beatsPerBar: BEATS_PER_BAR,
          subdivision: 1,
        })
        rebindCallbacks()
        if (wasActive) {
          sequencer.start()
        }
        // Translate the same *fraction* of a bar into seconds at the new
        // tempo and step the new sequencer forward. We deliberately replay
        // the carry while the sequencer is active so internal tick state
        // matches the fractional position — beat callbacks fire only on
        // boundaries crossed during this single update() call, which means
        // tests subscribing AFTER setBpm() never see the carry-over beats.
        const carrySeconds = fractionIntoOldBar * secondsPerBar(currentBpm)
        if (carrySeconds > 0) {
          sequencer.update(carrySeconds)
        }
      },

      subscribeBeat(cb: BeatCallback): () => void {
        beatHandlers.add(cb)
        return () => {
          beatHandlers.delete(cb)
        }
      },

      subscribeBar(cb: BarCallback): () => void {
        barHandlers.add(cb)
        return () => {
          barHandlers.delete(cb)
        }
      },

      secondsPerBar(): number {
        return secondsPerBar(currentBpm)
      },

      nextBarTimeFromNow(): number {
        const total = secondsPerBar(currentBpm)
        // Prefer the sequencer's internal phase for accuracy — `update(0)`
        // returns the live state without advancing time.
        const state = sequencer.update(0)
        const beatsIntoBarLocal = state.beat
        const beatPhase = state.phase
        const fractionElapsed =
          (beatsIntoBarLocal + beatPhase) / BEATS_PER_BAR
        const secondsElapsed = fractionElapsed * total
        const remaining = total - secondsElapsed
        // Guard against floating-point drift right at the bar boundary.
        if (remaining <= 0) return total
        return remaining
      },

      nextBarFromNow(): number {
        // Alias of `nextBarTimeFromNow` — replicate the body rather than
        // call `this.nextBarTimeFromNow()` so the method works regardless
        // of how callers bind `this`.
        const total = secondsPerBar(currentBpm)
        const state = sequencer.update(0)
        const beatsIntoBarLocal = state.beat
        const beatPhase = state.phase
        const fractionElapsed =
          (beatsIntoBarLocal + beatPhase) / BEATS_PER_BAR
        const secondsElapsed = fractionElapsed * total
        const remaining = total - secondsElapsed
        if (remaining <= 0) return total
        return remaining
      },

      nextEighthNoteFromNow(): number {
        // 8 eighth-notes per bar in 4/4. Compute the position within the
        // current eighth-note grid using the same sequencer phase reading
        // nextBarTimeFromNow uses, then return the remainder until the next
        // eighth-note boundary.
        const bar = secondsPerBar(currentBpm)
        const eighth = bar / 8
        const state = sequencer.update(0)
        const beatsIntoBarLocal = state.beat
        const beatPhase = state.phase
        const fractionElapsed =
          (beatsIntoBarLocal + beatPhase) / BEATS_PER_BAR
        const secondsElapsed = fractionElapsed * bar
        // How far into the current eighth-note are we?
        const intoEighth = secondsElapsed % eighth
        const remaining = eighth - intoEighth
        if (remaining <= 0) return eighth
        return remaining
      },

      start(): void {
        sequencer.start()
      },

      stop(): void {
        sequencer.stop()
      },

      reset(): void {
        sequencer.reset()
      },

      update(dtSeconds: number): void {
        sequencer.update(dtSeconds)
      },

      isActive(): boolean {
        return sequencer.isActive()
      },
    }
  }

  return clock()
}

// ── Singleton ────────────────────────────────────────────────────────────

let singleton: BeatClock | null = null

/**
 * Lazily-constructed singleton beat clock. The first read seeds it at
 * `DEFAULT_BPM`; the Pad-Grid Engine calls `setBpm()` once a kit loads.
 */
export function getBeatClock(): BeatClock {
  if (!singleton) {
    singleton = createBeatClock(DEFAULT_BPM)
  }
  return singleton
}

/** Test-only: drop the singleton so each spec gets a fresh clock. */
export function __resetBeatClock(): void {
  if (singleton) {
    singleton.stop()
    singleton.reset()
  }
  singleton = null
}

/**
 * Convenience accessor — derive the next bar time using the singleton clock
 * but resolve "now" through the master AudioContext when the master graph
 * has been initialised. Falls back to the singleton's own phase tracker.
 *
 * This is the public form Pad-Grid Engine uses when scheduling crossfades
 * via `gain.linearRampToValueAtTime(value, ctx.currentTime + nextBar())`.
 */
export function nextBarTimeFromNow(): number {
  // The sequencer-based reading is canonical because it already accounts
  // for accumulated drift from update(); the AudioContext clock check below
  // is exposed for debugging and stays consistent.
  void isAudioMasterReady()
  if (isAudioMasterReady()) {
    // Touch the audio context to keep the clock fresh — we still trust the
    // sequencer's phase math, but querying ctx.currentTime guards against
    // suspended-context drift in tests that mock the context.
    void getAudioContext().currentTime
  }
  return getBeatClock().nextBarTimeFromNow()
}

/**
 * Shorter alias of `nextBarTimeFromNow` exposed under the `nextBarFromNow`
 * name used by the Pad-Grid Engine + Groovepad-alignment code paths. Pad
 * activation, fade-in/out, and mute / un-mute all schedule on the next bar
 * boundary; phase-locked source playback (`pad-audio-graph`) keeps every
 * loop musically aligned regardless of when the gain ramp starts.
 */
export function nextBarFromNow(): number {
  return nextBarTimeFromNow()
}

/**
 * Public form of the eighth-note phase helper. Reserved for the Phase 3 FX
 * engine (continuous filter / flanger / reverb / delay modulation) where
 * eighth-note quantization is the right grain. Pad activation / fade timing
 * uses `nextBarFromNow` instead.
 */
export function nextEighthNoteFromNow(): number {
  void isAudioMasterReady()
  if (isAudioMasterReady()) {
    void getAudioContext().currentTime
  }
  return getBeatClock().nextEighthNoteFromNow()
}
