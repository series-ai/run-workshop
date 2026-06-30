/**
 * audio-master — singleton AudioContext + master gain graph for BeatBoard.
 *
 * Issue beat-board-03-audio-engine-and-beat-sequencer owns this file. It is
 * the project-side wrapper around the installed `audio/audio-manager` module:
 *
 *   - `audio-manager` provides the buffer cache + crossfade primitives via
 *     `createAudioEngine()` (consumed by the Pad-Grid Engine in a later issue).
 *   - This file owns the *master* graph: a single `AudioContext`, a single
 *     master `GainNode` bound to `ui/settings-overlay`'s music-volume slider
 *     and `soundEnabled`/`musicEnabled` toggles, and a `MediaStreamDestination`
 *     used later by the recording-capture system (issue 17).
 *
 * Initialisation MUST happen after a user gesture in production (the browser
 * suspends a freshly-created `AudioContext` until the first interaction). The
 * boot sequence in `src/main.tsx` calls `initAudioMaster()` lazily on the
 * first pad tap; we expose `getMasterDestination()` for downstream systems
 * once init has completed.
 *
 * In jsdom (vitest) `window.AudioContext` is undefined; tests inject a stub
 * via `__setAudioContextCtor()`. Production code must not call that hook.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useSettingsStore } from '@modules/ui/settings-overlay/SettingsOverlay'

// ── Types ────────────────────────────────────────────────────────────────

export interface AudioMaster {
  /** The shared AudioContext used by every BeatBoard audio node. */
  context: AudioContext
  /** Master gain node — final node before `context.destination`. */
  masterGain: GainNode
  /**
   * Recording-tap node consumed by the future recording-capture system.
   * It mirrors the signal flowing through `masterGain` so MediaRecorder can
   * pick it up without disturbing playback. Lazily created on first read.
   */
  getRecordingDestination: () => MediaStreamAudioDestinationNode
  /** Disconnect, close the context, and release graph references. */
  dispose: () => void
}

type AudioContextCtor = typeof AudioContext

// ── Module-local state ───────────────────────────────────────────────────

let master: AudioMaster | null = null
let unsubscribeSettings: (() => void) | null = null
let recordingDestination: MediaStreamAudioDestinationNode | null = null
let diagnosticAnalyser: AnalyserNode | null = null

/** Test-only: inject a fake AudioContext constructor (jsdom workaround). */
let testCtor: AudioContextCtor | null = null

function resolveAudioContextCtor(): AudioContextCtor {
  if (testCtor) {
    return testCtor
  }
  const w = globalThis as typeof globalThis & {
    AudioContext?: AudioContextCtor
    webkitAudioContext?: AudioContextCtor
  }
  const ctor = w.AudioContext ?? w.webkitAudioContext
  if (!ctor) {
    throw new Error(
      '[audio-master] AudioContext is not available in this environment.',
    )
  }
  return ctor
}

/**
 * `ui/settings-overlay` does not split `master` from `music`/`sound`; the
 * music volume slider is the loudest dial the player sees and pads play
 * music loops, so we treat `musicVolume` × enable-flags as the effective
 * master gain. Both flags must be true for the master to be audible — the
 * "Sound" toggle in the overlay still mutes everything game-side.
 */
/**
 * Master gain is capped at 1.0 (unity). Embedded browsers (ChatGPT/Claude
 * desktop webviews, Electron variants, Safari WKWebView) often push
 * post-master signal through an AGC/limiter that mutes if any node has
 * gain > 1.0. Loudness compensation lives on the per-pad pre-amp gain
 * (see `pad-audio-graph.ts:PAD_PREAMP_COMPENSATION`) — that node sits
 * BEFORE the dry/wet split, so any compensation happens early in the
 * chain and the master/destination output stays in [0, 1].
 */
function computeMasterGain(): number {
  const state = useSettingsStore.getState()
  if (!state.soundEnabled) return 0
  if (!state.musicEnabled) return 0
  return Math.min(state.soundVolume, state.musicVolume)
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Lazily initialise the master audio graph. Idempotent — repeated calls
 * return the same `AudioMaster`. The first call must happen inside a user
 * gesture in production browsers; the resulting context starts in `running`
 * state because `AudioContext.resume()` is awaited internally on the first
 * tap.
 */
export function initAudioMaster(): AudioMaster {
  if (master) return master

  const Ctor = resolveAudioContextCtor()
  const context = new Ctor()
  // Browsers create AudioContexts in `suspended` state until a user gesture
  // unlocks them. resume() is idempotent — safe to call when already running
  // or under a jsdom stub that doesn't implement it. Without this call, no
  // audio reaches the speakers even though the graph is wired correctly.
  if (typeof (context as AudioContext & { resume?: () => Promise<void> }).resume === 'function') {
    void (context as AudioContext).resume().catch((err: unknown) => {
      RundotAPI.error('[audio-master] context.resume failed', { error: String(err) })
    })
  }
  const masterGain = context.createGain()
  masterGain.gain.value = computeMasterGain()

  // Post-master limiter — a DynamicsCompressorNode tuned as a brickwall
  // limiter at -1 dB. Without this, summing multiple simultaneous loops
  // (e.g. drums + bass + melody all at unity gain) can push the
  // destination input above ±1.0, which the device clamps as hard
  // clipping — audible as "choppy" / "crunchy" output. The limiter
  // softly compresses peaks instead of clipping them.
  let outputNode: AudioNode = masterGain
  try {
    if (typeof (context as AudioContext).createDynamicsCompressor === 'function') {
      const limiter = context.createDynamicsCompressor()
      limiter.threshold.value = -1.0   // dB — start limiting just below 0 dBFS
      limiter.knee.value = 0            // hard knee for brickwall behavior
      limiter.ratio.value = 20          // 20:1 = effectively a limiter
      limiter.attack.value = 0.003      // 3 ms attack — catch transients
      limiter.release.value = 0.1       // 100 ms release — natural recovery
      masterGain.connect(limiter)
      limiter.connect(context.destination)
      outputNode = limiter
    } else {
      masterGain.connect(context.destination)
    }
  } catch {
    masterGain.connect(context.destination)
  }
  void outputNode

  // Diagnostic analyser tap — reads RMS energy of the signal that reaches
  // the destination, exposed via `beatboard.audio.diagnose()` so we can
  // verify whether audio is actually flowing to the speakers when the
  // graph state looks correct but the user hears nothing. Connected as a
  // parallel branch — does not affect playback. Wrapped in try/catch
  // because vitest stubs don't implement `createAnalyser`.
  try {
    if (typeof (context as AudioContext).createAnalyser === 'function') {
      diagnosticAnalyser = context.createAnalyser()
      diagnosticAnalyser.fftSize = 2048
      masterGain.connect(diagnosticAnalyser)
    }
  } catch {
    diagnosticAnalyser = null
  }

  RundotAPI.log('[audio-master] init', {
    contextState: context.state,
    sampleRate: context.sampleRate,
    currentTime: context.currentTime,
    masterGainValue: masterGain.gain.value,
    soundEnabled: useSettingsStore.getState().soundEnabled,
    musicEnabled: useSettingsStore.getState().musicEnabled,
    soundVolume: useSettingsStore.getState().soundVolume,
    musicVolume: useSettingsStore.getState().musicVolume,
  })

  // Subscribe to settings-overlay changes so the master gain follows the
  // slider in realtime. Unsubscribe is captured for `dispose()`.
  unsubscribeSettings = useSettingsStore.subscribe((state, prev) => {
    if (
      state.soundEnabled !== prev.soundEnabled ||
      state.musicEnabled !== prev.musicEnabled ||
      state.soundVolume !== prev.soundVolume ||
      state.musicVolume !== prev.musicVolume
    ) {
      masterGain.gain.value = computeMasterGain()
    }
  })

  master = {
    context,
    masterGain,
    getRecordingDestination(): MediaStreamAudioDestinationNode {
      if (!recordingDestination) {
        recordingDestination = context.createMediaStreamDestination()
        // Mirror master output into the recording tap. masterGain stays
        // connected to context.destination for live playback; this second
        // connect creates the parallel branch the recorder consumes.
        masterGain.connect(recordingDestination)
      }
      return recordingDestination
    },
    dispose(): void {
      try {
        masterGain.disconnect()
      } catch (err) {
        RundotAPI.error('[audio-master] disconnect failed', { error: String(err) })
      }
      if (recordingDestination) {
        try {
          recordingDestination.disconnect()
        } catch {
          // already disconnected — non-fatal
        }
        recordingDestination = null
      }
      try {
        // close() returns Promise<void>; ignore the result, the dispose
        // contract is synchronous from the caller's perspective.
        void context.close()
      } catch (err) {
        RundotAPI.error('[audio-master] context.close failed', { error: String(err) })
      }
      if (unsubscribeSettings) {
        unsubscribeSettings()
        unsubscribeSettings = null
      }
      master = null
    },
  }

  return master
}

/**
 * Return the current master AudioContext destination for downstream systems
 * (Pad-Grid Engine, recording capture). Lazily initialises the master graph
 * on first call.
 */
export function getMasterDestination(): AudioNode {
  return initAudioMaster().masterGain
}

/** Return the recording tap. The first call lazily creates the node. */
export function getRecordingDestination(): MediaStreamAudioDestinationNode {
  return initAudioMaster().getRecordingDestination()
}

/** Read-only access to the shared context (used by beat-clock for `currentTime`). */
export function getAudioContext(): AudioContext {
  return initAudioMaster().context
}

/** Whether the master graph has been initialised. */
export function isAudioMasterReady(): boolean {
  return master !== null
}

/**
 * Diagnostic: play a single buffer DIRECTLY to AudioContext.destination
 * for `durationSeconds`, bypassing the entire BeatBoard graph. Used to
 * isolate "is the AudioContext + buffer working at all" from "is our
 * graph routing dropping the signal somewhere." Returns true if the
 * playback was scheduled.
 */
export function playBufferDirectly(
  buffer: AudioBuffer,
  durationSeconds: number,
): boolean {
  if (!master) return false
  try {
    const ctx = master.context
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(ctx.destination)
    const startAt = ctx.currentTime + 0.05
    src.start(startAt)
    src.stop(startAt + durationSeconds)
    return true
  } catch (err) {
    RundotAPI.error('[audio-master] playBufferDirectly failed', { error: String(err) })
    return false
  }
}

/**
 * Force-resume the AudioContext from inside a user-gesture stack. Browsers
 * (Chrome / Safari / Firefox) require `AudioContext.resume()` to be called
 * synchronously inside a click / pointerdown / keydown handler — if the
 * context was created earlier (e.g. by a non-gesture init at module-load
 * time) it stays in 'suspended' state until a gesture-driven resume()
 * unlocks it. Idempotent — safe to call repeatedly. Returns true if the
 * context is running after the call.
 */
export function forceResumeFromUserGesture(): boolean {
  if (!master) return false
  try {
    const ctx = master.context as AudioContext & { resume?: () => Promise<void> }
    if (ctx.state !== 'running' && typeof ctx.resume === 'function') {
      void ctx.resume().catch((err: unknown) => {
        RundotAPI.error('[audio-master] forceResume failed', { error: String(err) })
      })
    }
    return master.context.state === 'running'
  } catch (err) {
    RundotAPI.error('[audio-master] forceResume threw', { error: String(err) })
    return false
  }
}


/**
 * Diagnostic master-output snapshot — readable by the debug API. Returns
 * the current master gain value, AudioContext state, and a recent-window
 * RMS energy reading from the analyser tap. RMS > 0.001 means audio is
 * actually flowing to the destination.
 */
export function readMasterDiagnostic(): {
  ready: boolean
  contextState: string | null
  currentTime: number | null
  sampleRate: number | null
  masterGainValue: number | null
  computedMasterGain: number
  rmsEnergy: number | null
  peakEnergy: number | null
  settings: {
    soundEnabled: boolean
    musicEnabled: boolean
    soundVolume: number
    musicVolume: number
  }
} {
  const settings = useSettingsStore.getState()
  const settingsSnap = {
    soundEnabled: settings.soundEnabled,
    musicEnabled: settings.musicEnabled,
    soundVolume: settings.soundVolume,
    musicVolume: settings.musicVolume,
  }
  const computed = computeMasterGain()
  if (!master) {
    return {
      ready: false,
      contextState: null,
      currentTime: null,
      sampleRate: null,
      masterGainValue: null,
      computedMasterGain: computed,
      rmsEnergy: null,
      peakEnergy: null,
      settings: settingsSnap,
    }
  }
  let rms: number | null = null
  let peak: number | null = null
  if (diagnosticAnalyser) {
    const buf = new Float32Array(diagnosticAnalyser.fftSize)
    try {
      diagnosticAnalyser.getFloatTimeDomainData(buf)
      let sum = 0
      let p = 0
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i] ?? 0
        sum += v * v
        const a = Math.abs(v)
        if (a > p) p = a
      }
      rms = Math.sqrt(sum / buf.length)
      peak = p
    } catch {
      // analyser may not be wired in jsdom — non-fatal
    }
  }
  return {
    ready: true,
    contextState: master.context.state,
    currentTime: master.context.currentTime,
    sampleRate: master.context.sampleRate,
    masterGainValue: master.masterGain.gain.value,
    computedMasterGain: computed,
    rmsEnergy: rms,
    peakEnergy: peak,
    settings: settingsSnap,
  }
}

/** Tear down the master graph. Used by tests + lifecycle teardown. */
export function disposeAudioMaster(): void {
  if (master) {
    master.dispose()
  }
}

// ── Test hooks ───────────────────────────────────────────────────────────

/**
 * Test-only: inject a fake AudioContext constructor. jsdom does not ship
 * Web Audio, so vitest cases pass a hand-rolled stub. Production code must
 * never call this.
 */
export function __setAudioContextCtor(ctor: AudioContextCtor | null): void {
  testCtor = ctor
}

/** Test-only: clear the singleton without invoking the (possibly-fake) close path. */
export function __resetAudioMaster(): void {
  if (unsubscribeSettings) {
    unsubscribeSettings()
    unsubscribeSettings = null
  }
  recordingDestination = null
  master = null
}
