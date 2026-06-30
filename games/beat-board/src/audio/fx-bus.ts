/**
 * fx-bus — parallel-FX routing bus for BeatBoard.
 *
 * Issue beat-board-33-fx-engine (Phase 3 of `.project/plans/groovepad-alignment-plan-2026-04-29.md`)
 * owns this file. The fx-bus sits beside the dry signal path: every per-pad
 * `gain` node emits two sends — a constant dry send straight to master, and
 * a wet send that lands here. Inside the bus, four parallel sub-chains
 * (filter / flanger / reverb / delay) each gate their output gain to 0 and
 * crossfade the active chain to 1.
 *
 * Routing diagram per pad:
 *
 *     pad.gain ── dry ─────────────────────────────────▶ masterGain
 *                  │
 *                  └── wet ─▶ FX bus.input ─┬─ filter   ─▶ output
 *                                           ├─ flanger  ─▶ output
 *                                           ├─ reverb   ─▶ output
 *                                           └─ delay    ─▶ output  ─▶ masterGain
 *
 * Only ONE FX chain is "active" at a time — the others have output gain 0.
 * `setActiveEffect()` runs a 50 ms equal-power crossfade between the previous
 * active chain and the new one. The XY-pad axes drive two parameters on the
 * active chain via `setParams(x, y)` with `setTargetAtTime` smoothing so
 * drags feel live without zipper noise.
 *
 * Production code never instantiates the bus directly; use `getFxBus()`.
 *
 * In jsdom (vitest) Web Audio is unavailable; the master injects a stub via
 * `audio-master.__setAudioContextCtor`, and `__resetFxBus()` clears the
 * singleton between specs.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  getAudioContext,
  getMasterDestination,
  isAudioMasterReady,
  initAudioMaster,
} from './audio-master'
import { audioTrace } from './audio-trace'

// ── Types ────────────────────────────────────────────────────────────────

export type FxEffect = 'filter' | 'flanger' | 'reverb' | 'delay'

export interface FxBus {
  /** Connect a pad's wet branch to the FX bus input. */
  connectPad(padId: string, wetSource: AudioNode): void
  /** Detach a pad's wet branch. Used by `pad-audio-graph.disposePad()`. */
  disconnectPad(padId: string): void
  /** Set the active effect — crossfades chain output gates over 50 ms. */
  setActiveEffect(effect: FxEffect): void
  /** Set the active effect's two normalized parameters [0..1]. */
  setParams(x: number, y: number): void
  /** Read the current active effect (debug helpers). */
  getActiveEffect(): FxEffect
  /** Number of currently-connected pads. */
  connectedPadCount(): number
  /** Time constant (sec) for setParams smoothing. Defaults to 0.03. */
  paramSmoothingSeconds: number
  /** Tear down all routing nodes. Called by audio-master.dispose(). */
  disposeAll(): void
}

// ── Constants ────────────────────────────────────────────────────────────

const ACTIVE_CROSSFADE_SECONDS = 0.05
const DEFAULT_PARAM_SMOOTHING = 0.03

// Filter — lowpass cutoff (logarithmic 80 Hz – 8 kHz) + resonance Q (0.5 – 12)
const FILTER_CUTOFF_MIN_HZ = 80
const FILTER_CUTOFF_MAX_HZ = 8000
const FILTER_Q_MIN = 0.5
const FILTER_Q_MAX = 12

// Flanger — LFO rate (0.05 – 5 Hz) + feedback (0 – 0.85)
const FLANGER_LFO_MIN_HZ = 0.05
const FLANGER_LFO_MAX_HZ = 5
const FLANGER_FEEDBACK_MIN = 0
const FLANGER_FEEDBACK_MAX = 0.85
const FLANGER_BASE_DELAY_S = 0.005
const FLANGER_DEPTH_S = 0.003

// Reverb — Schroeder topology constants (4 combs in parallel + 2 allpasses in series)
const REVERB_COMB_DELAYS_S = [0.0297, 0.0371, 0.0411, 0.0437]
const REVERB_ALLPASS_DELAYS_S = [0.005, 0.0017]
const REVERB_FEEDBACK_MIN = 0.6
const REVERB_FEEDBACK_MAX = 0.95
const REVERB_TONE_MIN_HZ = 800
const REVERB_TONE_MAX_HZ = 8000
const REVERB_ALLPASS_FEEDBACK = 0.5

// Delay — time (10 ms – 1000 ms) + feedback (0 – 0.85)
const DELAY_TIME_MIN_S = 0.01
const DELAY_TIME_MAX_S = 1.0
const DELAY_FEEDBACK_MIN = 0
const DELAY_FEEDBACK_MAX = 0.85
const DELAY_MAX_BUFFER_S = 1.5

// ── Helpers ──────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** Logarithmic interpolation between min and max for natural-feeling Hz scales. */
function lerpLog(t: number, min: number, max: number): number {
  const lo = Math.log(min)
  const hi = Math.log(max)
  return Math.exp(lo + (hi - lo) * clamp01(t))
}

function lerp(t: number, min: number, max: number): number {
  return min + (max - min) * clamp01(t)
}

// ── Sub-chain shapes ─────────────────────────────────────────────────────

interface SubChain {
  /** Input — every pad's wet send connects in parallel into this node. */
  input: GainNode
  /** Output — gated 0/1 for active state; sums into the bus output. */
  output: GainNode
  /** Apply the XY parameters [0..1] to this chain. */
  applyParams(x: number, y: number, smoothing: number): void
  /** Tear down internal nodes. */
  dispose(): void
}

function buildFilterChain(ctx: AudioContext): SubChain {
  const input = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0
  const biquad = ctx.createBiquadFilter()
  biquad.type = 'lowpass'
  biquad.frequency.value = FILTER_CUTOFF_MAX_HZ
  biquad.Q.value = 1
  input.connect(biquad)
  biquad.connect(output)
  return {
    input,
    output,
    applyParams(x: number, y: number, smoothing: number): void {
      const cutoff = lerpLog(x, FILTER_CUTOFF_MIN_HZ, FILTER_CUTOFF_MAX_HZ)
      const q = lerp(y, FILTER_Q_MIN, FILTER_Q_MAX)
      const now = ctx.currentTime
      try {
        biquad.frequency.setTargetAtTime(cutoff, now, smoothing)
        biquad.Q.setTargetAtTime(q, now, smoothing)
      } catch (err) {
        RundotAPI.error('[fx-bus] filter setTargetAtTime failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    dispose(): void {
      try {
        input.disconnect()
        biquad.disconnect()
        output.disconnect()
      } catch {
        // best-effort teardown
      }
    },
  }
}

function buildFlangerChain(ctx: AudioContext): SubChain {
  const input = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0
  const delay = ctx.createDelay(0.05)
  delay.delayTime.value = FLANGER_BASE_DELAY_S
  const feedback = ctx.createGain()
  feedback.gain.value = FLANGER_FEEDBACK_MIN
  const lfo = ctx.createOscillator()
  lfo.frequency.value = FLANGER_LFO_MIN_HZ
  const lfoGain = ctx.createGain()
  lfoGain.gain.value = FLANGER_DEPTH_S
  // input -> delay -> output (and feedback loop)
  input.connect(delay)
  input.connect(output)
  delay.connect(output)
  delay.connect(feedback)
  feedback.connect(delay)
  // LFO modulates delayTime around the base delay.
  lfo.connect(lfoGain)
  lfoGain.connect(delay.delayTime)
  try {
    lfo.start()
  } catch (err) {
    RundotAPI.error('[fx-bus] flanger LFO start failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return {
    input,
    output,
    applyParams(x: number, y: number, smoothing: number): void {
      const rate = lerp(x, FLANGER_LFO_MIN_HZ, FLANGER_LFO_MAX_HZ)
      const fb = lerp(y, FLANGER_FEEDBACK_MIN, FLANGER_FEEDBACK_MAX)
      const now = ctx.currentTime
      try {
        lfo.frequency.setTargetAtTime(rate, now, smoothing)
        feedback.gain.setTargetAtTime(fb, now, smoothing)
      } catch (err) {
        RundotAPI.error('[fx-bus] flanger setTargetAtTime failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    dispose(): void {
      try {
        lfo.stop()
      } catch {
        // already stopped
      }
      try {
        input.disconnect()
        delay.disconnect()
        feedback.disconnect()
        lfoGain.disconnect()
        lfo.disconnect()
        output.disconnect()
      } catch {
        // best-effort
      }
    },
  }
}

interface ReverbCombHandles {
  combFeedbacks: GainNode[]
  toneFilters: BiquadFilterNode[]
}

function buildReverbChain(ctx: AudioContext): SubChain & ReverbCombHandles {
  const input = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0
  const combMixer = ctx.createGain()
  combMixer.gain.value = 1 / REVERB_COMB_DELAYS_S.length
  const combFeedbacks: GainNode[] = []
  const toneFilters: BiquadFilterNode[] = []

  for (const delaySec of REVERB_COMB_DELAYS_S) {
    const combDelay = ctx.createDelay(0.5)
    combDelay.delayTime.value = delaySec
    const combFeedback = ctx.createGain()
    combFeedback.gain.value = REVERB_FEEDBACK_MIN
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = REVERB_TONE_MAX_HZ
    tone.Q.value = 0.7
    // input -> combDelay -> tone -> combFeedback -> combDelay (feedback loop)
    input.connect(combDelay)
    combDelay.connect(tone)
    tone.connect(combFeedback)
    combFeedback.connect(combDelay)
    // Send the combDelay's output into the mixer (tap before feedback gain).
    combDelay.connect(combMixer)
    combFeedbacks.push(combFeedback)
    toneFilters.push(tone)
  }

  // Two allpass filters in series on the comb mix.
  let allpassChainHead: AudioNode = combMixer
  for (const apDelaySec of REVERB_ALLPASS_DELAYS_S) {
    const apDelay = ctx.createDelay(0.05)
    apDelay.delayTime.value = apDelaySec
    const apFeedback = ctx.createGain()
    apFeedback.gain.value = REVERB_ALLPASS_FEEDBACK
    allpassChainHead.connect(apDelay)
    apDelay.connect(apFeedback)
    apFeedback.connect(apDelay)
    allpassChainHead = apDelay
  }
  allpassChainHead.connect(output)

  return {
    input,
    output,
    combFeedbacks,
    toneFilters,
    applyParams(x: number, y: number, smoothing: number): void {
      const decay = lerp(x, REVERB_FEEDBACK_MIN, REVERB_FEEDBACK_MAX)
      const tone = lerpLog(y, REVERB_TONE_MIN_HZ, REVERB_TONE_MAX_HZ)
      const now = ctx.currentTime
      try {
        for (const fb of combFeedbacks) {
          fb.gain.setTargetAtTime(decay, now, smoothing)
        }
        for (const filter of toneFilters) {
          filter.frequency.setTargetAtTime(tone, now, smoothing)
        }
      } catch (err) {
        RundotAPI.error('[fx-bus] reverb setTargetAtTime failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    dispose(): void {
      try {
        input.disconnect()
        combMixer.disconnect()
        output.disconnect()
        for (const fb of combFeedbacks) fb.disconnect()
        for (const t of toneFilters) t.disconnect()
      } catch {
        // best-effort
      }
    },
  }
}

function buildDelayChain(ctx: AudioContext): SubChain {
  const input = ctx.createGain()
  const output = ctx.createGain()
  output.gain.value = 0
  const delayNode = ctx.createDelay(DELAY_MAX_BUFFER_S)
  delayNode.delayTime.value = 0.25
  const feedback = ctx.createGain()
  feedback.gain.value = DELAY_FEEDBACK_MIN
  // input -> delay -> output (and feedback)
  input.connect(delayNode)
  delayNode.connect(output)
  delayNode.connect(feedback)
  feedback.connect(delayNode)
  return {
    input,
    output,
    applyParams(x: number, y: number, smoothing: number): void {
      const time = lerp(x, DELAY_TIME_MIN_S, DELAY_TIME_MAX_S)
      const fb = lerp(y, DELAY_FEEDBACK_MIN, DELAY_FEEDBACK_MAX)
      const now = ctx.currentTime
      try {
        delayNode.delayTime.setTargetAtTime(time, now, smoothing)
        feedback.gain.setTargetAtTime(fb, now, smoothing)
      } catch (err) {
        RundotAPI.error('[fx-bus] delay setTargetAtTime failed', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    dispose(): void {
      try {
        input.disconnect()
        delayNode.disconnect()
        feedback.disconnect()
        output.disconnect()
      } catch {
        // best-effort
      }
    },
  }
}

// ── Module-local singleton state ─────────────────────────────────────────

interface FxBusInternal {
  ctx: AudioContext
  busInput: GainNode
  busOutput: GainNode
  chains: Record<FxEffect, SubChain>
  active: FxEffect
  paramX: number
  paramY: number
  paramSmoothing: number
  padConnections: Map<string, AudioNode>
}

let internal: FxBusInternal | null = null

function ensureMaster(): { ctx: AudioContext; master: AudioNode } | null {
  try {
    initAudioMaster()
  } catch (err) {
    audioTrace('fx-bus:initAudioMaster:throw', { error: String(err) })
    RundotAPI.error('[fx-bus] audio master init failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
  if (!isAudioMasterReady()) return null
  try {
    return { ctx: getAudioContext(), master: getMasterDestination() }
  } catch (err) {
    audioTrace('fx-bus:read-master:throw', { error: String(err) })
    return null
  }
}

function buildInternal(ctx: AudioContext, master: AudioNode): FxBusInternal {
  const busInput = ctx.createGain()
  const busOutput = ctx.createGain()
  busOutput.connect(master)

  const chains: Record<FxEffect, SubChain> = {
    filter: buildFilterChain(ctx),
    flanger: buildFlangerChain(ctx),
    reverb: buildReverbChain(ctx),
    delay: buildDelayChain(ctx),
  }
  // Wire input fan-out and output sum.
  for (const key of ['filter', 'flanger', 'reverb', 'delay'] as FxEffect[]) {
    busInput.connect(chains[key].input)
    chains[key].output.connect(busOutput)
  }

  const state: FxBusInternal = {
    ctx,
    busInput,
    busOutput,
    chains,
    active: 'filter',
    paramX: 0.5,
    paramY: 0.5,
    paramSmoothing: DEFAULT_PARAM_SMOOTHING,
    padConnections: new Map(),
  }

  // Default: filter chain audible at gain 1, others at 0.
  try {
    chains.filter.output.gain.setValueAtTime(1, ctx.currentTime)
    chains.flanger.output.gain.setValueAtTime(0, ctx.currentTime)
    chains.reverb.output.gain.setValueAtTime(0, ctx.currentTime)
    chains.delay.output.gain.setValueAtTime(0, ctx.currentTime)
  } catch (err) {
    audioTrace('fx-bus:default-gate-set-fail', { error: String(err) })
  }
  // Initial param application uses the active chain.
  chains.filter.applyParams(state.paramX, state.paramY, state.paramSmoothing)

  audioTrace('fx-bus:built', { active: state.active })
  return state
}

function ensureInternal(): FxBusInternal | null {
  if (internal) return internal
  const ready = ensureMaster()
  if (!ready) return null
  internal = buildInternal(ready.ctx, ready.master)
  return internal
}

function getNodeContext(node: AudioNode): BaseAudioContext | null {
  return (node as AudioNode & { context?: BaseAudioContext }).context ?? null
}

// ── Public singleton ─────────────────────────────────────────────────────

const singleton: FxBus = {
  paramSmoothingSeconds: DEFAULT_PARAM_SMOOTHING,

  connectPad(padId: string, wetSource: AudioNode): void {
    let inner = ensureInternal()
    if (!inner) {
      audioTrace('fx-bus:connectPad:no-master', { padId })
      return
    }
    const sourceContext = getNodeContext(wetSource)
    if (sourceContext && inner.ctx !== sourceContext) {
      audioTrace('fx-bus:connectPad:stale-context', { padId })
      singleton.disposeAll()
      inner = ensureInternal()
      if (!inner) return
      if (inner.ctx !== sourceContext) {
        audioTrace('fx-bus:connectPad:context-mismatch', { padId })
        return
      }
    }
    // Replace any prior connection for the same padId.
    const prev = inner.padConnections.get(padId)
    if (prev) {
      try {
        prev.disconnect(inner.busInput)
      } catch {
        // already disconnected — fine
      }
    }
    try {
      wetSource.connect(inner.busInput)
      inner.padConnections.set(padId, wetSource)
      audioTrace('fx-bus:connectPad', { padId, total: inner.padConnections.size })
    } catch (err) {
      audioTrace('fx-bus:connectPad:fail', { padId, error: String(err) })
      RundotAPI.error('[fx-bus] connectPad failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  disconnectPad(padId: string): void {
    if (!internal) return
    const node = internal.padConnections.get(padId)
    if (!node) return
    try {
      node.disconnect(internal.busInput)
    } catch {
      // already disconnected — fine
    }
    internal.padConnections.delete(padId)
    audioTrace('fx-bus:disconnectPad', { padId, remaining: internal.padConnections.size })
  },

  setActiveEffect(effect: FxEffect): void {
    const inner = ensureInternal()
    if (!inner) {
      audioTrace('fx-bus:setActiveEffect:no-master', { effect })
      return
    }
    if (inner.active === effect) return
    const now = inner.ctx.currentTime
    const fadeEnd = now + ACTIVE_CROSSFADE_SECONDS
    const prev = inner.active
    inner.active = effect
    const order: FxEffect[] = ['filter', 'flanger', 'reverb', 'delay']
    for (const key of order) {
      const target = key === effect ? 1 : 0
      const param = inner.chains[key].output.gain
      try {
        param.cancelScheduledValues(now)
        param.setValueAtTime(param.value, now)
        param.linearRampToValueAtTime(target, fadeEnd)
      } catch (err) {
        audioTrace('fx-bus:setActiveEffect:ramp-fail', { key, error: String(err) })
      }
    }
    // Apply current XY params to the new active chain immediately so the
    // first audible sound reflects the slider position.
    inner.chains[effect].applyParams(inner.paramX, inner.paramY, singleton.paramSmoothingSeconds)
    audioTrace('fx-bus:setActiveEffect', { from: prev, to: effect })
  },

  setParams(x: number, y: number): void {
    const inner = ensureInternal()
    if (!inner) {
      audioTrace('fx-bus:setParams:no-master', { x, y })
      return
    }
    inner.paramX = clamp01(x)
    inner.paramY = clamp01(y)
    inner.paramSmoothing = singleton.paramSmoothingSeconds
    inner.chains[inner.active].applyParams(
      inner.paramX,
      inner.paramY,
      singleton.paramSmoothingSeconds,
    )
  },

  getActiveEffect(): FxEffect {
    return internal?.active ?? 'filter'
  },

  connectedPadCount(): number {
    return internal?.padConnections.size ?? 0
  },

  disposeAll(): void {
    if (!internal) return
    for (const padId of Array.from(internal.padConnections.keys())) {
      singleton.disconnectPad(padId)
    }
    for (const key of ['filter', 'flanger', 'reverb', 'delay'] as FxEffect[]) {
      try {
        internal.chains[key].dispose()
      } catch (err) {
        audioTrace('fx-bus:dispose:chain-fail', { key, error: String(err) })
      }
    }
    try {
      internal.busInput.disconnect()
      internal.busOutput.disconnect()
    } catch {
      // best-effort
    }
    internal = null
    audioTrace('fx-bus:disposeAll')
  },
}

/** Production accessor. The bus is a process-singleton bound to audio-master. */
export function getFxBus(): FxBus {
  return singleton
}

/** Diagnostic snapshot for the debug API. */
export function getFxBusSnapshot(): {
  active: FxEffect
  paramX: number
  paramY: number
  connectedPadCount: number
} {
  if (!internal) {
    return { active: 'filter', paramX: 0.5, paramY: 0.5, connectedPadCount: 0 }
  }
  return {
    active: internal.active,
    paramX: internal.paramX,
    paramY: internal.paramY,
    connectedPadCount: internal.padConnections.size,
  }
}

/** Test-only: drop the singleton between specs. */
export function __resetFxBus(): void {
  if (internal) {
    try {
      singleton.disposeAll()
    } catch {
      // best-effort teardown
    }
  }
  internal = null
  singleton.paramSmoothingSeconds = DEFAULT_PARAM_SMOOTHING
}
