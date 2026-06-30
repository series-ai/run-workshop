/**
 * replay-session — schedules a `MixSession` against a pad-grid action
 * surface so the live audio engine plays back the recorded take.
 *
 * The scheduler is timer-driven: at construction it computes each
 * event's wall-clock fire-time relative to a `play()` call, then uses
 * `setTimeout` to deliver each action to the engine at the right
 * moment. Pause / resume / seek work by recomputing the fire times
 * from the current position.
 *
 * No audio bytes anywhere in this file. The engine handles all sound;
 * the replayer is just a metronome that reissues recorded actions.
 *
 * Test seam: callers inject `clock` (now/setTimeout/clearTimeout) so
 * unit tests can step time deterministically without spinning real
 * timers.
 */

import type { MixEvent, MixSession, PadBankLabel } from './types'
import { beatsToSeconds } from './types'

/**
 * Pad-grid action surface the replayer drives. Mirrors padGridStore's
 * mutating actions; replay re-issues recorded events into this engine.
 *
 * Replay does NOT go through the recorder observer — it talks directly
 * to the engine so its actions don't get re-captured into a new session.
 */
export interface PadActionEngine {
  tapLoop: (padId: string) => void
  tapOneShot: (padId: string) => void
  deactivate: (padId: string) => void
  setCurrentBank: (bank: PadBankLabel) => void
  toggleFxBypass: (bank: PadBankLabel, blockId: string) => void
}

export interface ReplayClock {
  nowMs: () => number
  setTimeout: (cb: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

export type ReplayState = 'idle' | 'playing' | 'paused' | 'completed'

export interface ReplayProgress {
  /** State machine — 'completed' fires after the last event + tail. */
  state: ReplayState
  /** Beats since `play()`. Pauses freeze this; seek jumps it. */
  positionBeats: number
  /** Total duration in beats (cached from the session). */
  durationBeats: number
}

export interface ReplaySession {
  play: () => void
  pause: () => void
  /** Stop and reset to beat 0. */
  stop: () => void
  /** Jump to a beat offset. Safe to call while playing or paused. */
  seek: (beats: number) => void
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe: (listener: (progress: ReplayProgress) => void) => () => void
  /** Snapshot of the current progress. */
  getProgress: () => ReplayProgress
  /** Tear down — clears timers, drops listeners. */
  dispose: () => void
}

export interface ReplayOptions {
  session: MixSession
  engine: PadActionEngine
  clock: ReplayClock
  /**
   * Ticks the listeners every `progressTickMs` while playing so the
   * scrubber can update without coupling to event boundaries.
   * Default 100 ms (10Hz).
   */
  progressTickMs?: number
}

interface ScheduledHandle {
  index: number
  timer: number
}

export function createReplaySession(options: ReplayOptions): ReplaySession {
  const { session, engine, clock } = options
  const tickMs = options.progressTickMs ?? 100

  let state: ReplayState = 'idle'
  let positionBeats = 0
  /** Wall-clock ms at which beat 0 of the current run "started". */
  let runStartedAtMs = 0
  let scheduled: ScheduledHandle[] = []
  let progressTimer: number | null = null
  let completionTimer: number | null = null
  const listeners = new Set<(p: ReplayProgress) => void>()

  function emit(): void {
    const snapshot: ReplayProgress = {
      state,
      positionBeats,
      durationBeats: session.durationBeats,
    }
    for (const cb of listeners) cb(snapshot)
  }

  function clearScheduled(): void {
    for (const handle of scheduled) clock.clearTimeout(handle.timer)
    scheduled = []
    if (progressTimer !== null) {
      clock.clearTimeout(progressTimer)
      progressTimer = null
    }
    if (completionTimer !== null) {
      clock.clearTimeout(completionTimer)
      completionTimer = null
    }
  }

  function fireEvent(event: MixEvent): void {
    switch (event.type) {
      case 'pad_activate':
        engine.tapLoop(event.padId)
        return
      case 'pad_deactivate':
        engine.deactivate(event.padId)
        return
      case 'one_shot':
        engine.tapOneShot(event.padId)
        return
      case 'bank_switch':
        engine.setCurrentBank(event.bank)
        return
      case 'fx_bypass_toggle':
        engine.toggleFxBypass(event.bank, event.blockId)
        return
    }
  }

  function scheduleFromPosition(): void {
    clearScheduled()
    const now = clock.nowMs()
    runStartedAtMs = now - beatsToSeconds(positionBeats, session.bpm) * 1000

    for (let i = 0; i < session.events.length; i++) {
      const event = session.events[i]!
      if (event.t < positionBeats) continue
      const offsetMs = beatsToSeconds(event.t - positionBeats, session.bpm) * 1000
      const timer = clock.setTimeout(() => {
        fireEvent(event)
      }, offsetMs)
      scheduled.push({ index: i, timer })
    }

    // Schedule completion at durationBeats. If we're seeked past it,
    // complete immediately on the next tick.
    const remainingBeats = Math.max(0, session.durationBeats - positionBeats)
    const completionDelayMs = beatsToSeconds(remainingBeats, session.bpm) * 1000
    completionTimer = clock.setTimeout(() => {
      state = 'completed'
      positionBeats = session.durationBeats
      clearScheduled()
      emit()
    }, completionDelayMs)

    // Tick the progress emitter while playing.
    function tick(): void {
      if (state !== 'playing') return
      const elapsedMs = clock.nowMs() - runStartedAtMs
      positionBeats = Math.min(
        session.durationBeats,
        (elapsedMs / 1000) * (session.bpm / 60),
      )
      emit()
      if (state === 'playing') {
        progressTimer = clock.setTimeout(tick, tickMs)
      }
    }
    progressTimer = clock.setTimeout(tick, tickMs)
  }

  return {
    play(): void {
      if (state === 'playing') return
      if (state === 'completed') {
        // Replay-from-end semantics: rewind to 0.
        positionBeats = 0
      }
      state = 'playing'
      scheduleFromPosition()
      emit()
    },

    pause(): void {
      if (state !== 'playing') return
      const elapsedMs = clock.nowMs() - runStartedAtMs
      positionBeats = Math.min(
        session.durationBeats,
        (elapsedMs / 1000) * (session.bpm / 60),
      )
      state = 'paused'
      clearScheduled()
      emit()
    },

    stop(): void {
      state = 'idle'
      positionBeats = 0
      clearScheduled()
      emit()
    },

    seek(beats: number): void {
      const clamped = Math.max(0, Math.min(session.durationBeats, beats))
      positionBeats = clamped
      if (state === 'playing') {
        scheduleFromPosition()
      }
      emit()
    },

    subscribe(listener): () => void {
      listeners.add(listener)
      listener({ state, positionBeats, durationBeats: session.durationBeats })
      return () => {
        listeners.delete(listener)
      }
    },

    getProgress(): ReplayProgress {
      return { state, positionBeats, durationBeats: session.durationBeats }
    },

    dispose(): void {
      clearScheduled()
      listeners.clear()
      state = 'idle'
      positionBeats = 0
    },
  }
}
