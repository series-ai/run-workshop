/**
 * pad-audio-graph — phase-locked per-pad AudioBufferSourceNode + GainNode wiring.
 *
 * Issue beat-board-corrective-audio-playback owns this file. It implements
 * the Incredibox / Groovepad / Koala Sampler audio architecture:
 *
 *   ALL pad buffers start ONCE at kit-load, all `loop: true`, all phase-locked
 *   to a master start time at the next bar boundary. Each source flows through
 *   its own GainNode at gain=0. Tap = ramp the per-pad gain 0→1 over a short
 *   fade. Untap = ramp 1→0. Sources never `stop()` — they play silently.
 *
 *   ┌─ AudioBufferSourceNode (loop=true, started once at kitStartTime)
 *   │     │
 *   │     ▼
 *   │  GainNode (per-pad)              ← scheduleRamp targets gain.gain
 *   │     │
 *   │     ▼
 *   └▶ masterGain (audio-master) ─▶ context.destination
 *
 * Why this matters:
 *   - Layers sound musically aligned: pad B's bar 1 always lines up with
 *     pad A's continuous loop position.
 *   - First-tap latency is bounded by the fade-in start (an eighth note,
 *     not a full bar).
 *   - Re-tapping a pad doesn't restart its loop — the gain just ramps back
 *     up from wherever the playhead is.
 *
 * Kit lifecycle:
 *   - First `registerPadBuffer` of a kit computes `kitStartTime` (= ctx.currentTime
 *     plus a small lookahead). All buffers in the same kit are scheduled to
 *     start at that same timestamp, sharing phase.
 *   - If a buffer registers AFTER `kitStartTime` has passed (slow decode),
 *     it starts at the next multiple of `bufferDuration` so it falls back
 *     into phase.
 *   - On kit swap, `disposeAll()` retires the previous source pool. The new
 *     kit's `registerPadBuffer` calls install fresh phase-locked sources.
 *
 * In jsdom (vitest) `window.AudioContext` is undefined; the test seam
 * `__setFetchImpl` and `audio-master.__setAudioContextCtor` swap in stubs.
 * Production code never calls those hooks.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  getAudioContext,
  getMasterDestination,
  isAudioMasterReady,
  initAudioMaster,
} from './audio-master'
import { audioTrace } from './audio-trace'
import { getFxBus } from './fx-bus'
import { fetchRuntimeAssetBlob } from '../preload/core/runtimeAssetClient'

// ── Types ────────────────────────────────────────────────────────────────

export interface PadAudioGraph {
  registerPadBuffer(padId: string, bufferUrl: string): Promise<void>
  scheduleRamp(
    padId: string,
    fromGain: number,
    toGain: number,
    startAt: number,
    endAt: number,
  ): void
  setGain(padId: string, value: number): void
  /**
   * Set the wet-send gain for a pad (FX-bus routing). 1 = pad routes through
   * the active FX chain; 0 = pad bypasses FX (dry-only). Phase 3 of the
   * Groovepad alignment plan calls this from the per-row FX-bypass wiring.
   * Ramps over 50 ms to avoid clicks.
   */
  setPadWetSend(padId: string, value: number): void
  /**
   * Cancel any future scheduled gain automation events for `padId`
   * starting at `fromTime`, then re-anchor the gain at its current
   * value (so subsequent ramps reference the correct base). Used by
   * the engine when a re-tap should cancel a pending deactivate
   * fade-out — without this, the future 1→0 ramp scheduled at the
   * outgoing iteration end still fires, killing the loop the player
   * just asked to re-engage.
   */
  cancelGainRamps(padId: string, fromTime: number): void
  disposePad(padId: string): void
  disposeAll(): void
}

interface PadEntry {
  buffer: AudioBuffer | null
  /** Audibility gain — what scheduleRamp / setGain target. */
  gain: GainNode
  /** Constant dry send: gain → master at 1.0. */
  dryGain: GainNode
  /** Toggleable wet send: gain → fx-bus input. Defaults to 0 (FX off). */
  wetGain: GainNode
  source: AudioBufferSourceNode | null
  /**
   * AudioContext time the active source.start() was scheduled at. The
   * engine reads this to compute "end of current iteration" — the swap
   * point for queued loop replacements is the next integer multiple of
   * the buffer's duration past `lastStartedAt`. `null` if no source is
   * installed yet.
   */
  lastStartedAt: number | null
  /**
   * Cached per-column peak-amplitude arrays for the UI waveform widget,
   * keyed by column count. Computed once per (pad, columns) pair on
   * first read and reused thereafter — peaks are static for a decoded
   * buffer, so a single pass over the channel data is sufficient.
   */
  peakCache: Map<number, number[]>
}

/** Smoothing ramp for setPadWetSend to avoid click artefacts on toggle. */
const WET_SEND_RAMP_SECONDS = 0.05

// ── Test seams ───────────────────────────────────────────────────────────

type FetchImpl = (url: string) => Promise<ArrayBuffer>
let testFetch: FetchImpl | null = null

/** Test-only: inject a fake fetch implementation. */
export function __setFetchImpl(impl: FetchImpl | null): void {
  testFetch = impl
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  // Route through the Rundot CDN client so audio is served from the
  // deployed CDN in production (and from public/cdn-assets/ in dev).
  // Plain `fetch(url)` works locally but 404s in production where the
  // host does not serve `public/cdn-assets/...` directly.
  const blob = await fetchRuntimeAssetBlob(url)
  return blob.arrayBuffer()
}

function fetchBuffer(url: string): Promise<ArrayBuffer> {
  return (testFetch ?? defaultFetch)(url)
}

// ── Module-local state ───────────────────────────────────────────────────

let pads: Map<string, PadEntry> | null = null
/**
 * The AudioContext time at which the current kit's buffers were collectively
 * scheduled to start. Set once when the first pad of a kit registers; reused
 * for all subsequent registrations in the same kit so all loops share phase.
 * Cleared by `disposeAll()` on kit swap.
 */
let kitStartTime: number | null = null
/**
 * AudioContext time anchoring the user-audible bar grid. Set to the
 * `swapAt` of the first audible source restart in a session (i.e. the
 * first user tap that produces sound). All cross-block taps from then
 * on schedule at integer multiples of the bar past this anchor, so every
 * loop layers on the same musical grid. Distinct from `kitStartTime`
 * (which anchors the silent phase-locked source pool at kit-load).
 *
 * Cleared on `disposeAll`, `__resetPadAudioGraph`, and
 * `reinstallAllSourcesAfterResumeReturning` (any of these invalidates
 * the previous AudioContext clock that the anchor referenced).
 */
let kitPhaseAnchor: number | null = null
/**
 * Lookahead before scheduling the kit's master start. Gives every buffer a
 * narrow window to finish decoding before the shared start time without
 * forcing a full bar wait. 100 ms is comfortably within Web Audio's scheduling
 * resolution and small enough to be imperceptible.
 */
const KIT_START_LOOKAHEAD_SECONDS = 0.1

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureMaster(): { ctx: AudioContext; master: AudioNode } | null {
  try {
    initAudioMaster()
  } catch (err) {
    audioTrace('graph:initAudioMaster:throw', { error: String(err) })
    RundotAPI.error('[pad-audio-graph] audio master init failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
  if (!isAudioMasterReady()) {
    audioTrace('graph:not-ready-after-init')
    return null
  }
  let ctx: AudioContext
  let master: AudioNode
  try {
    ctx = getAudioContext()
    master = getMasterDestination()
  } catch (err) {
    audioTrace('graph:read-master:throw', { error: String(err) })
    RundotAPI.error('[pad-audio-graph] audio master not ready', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
  audioTrace('graph:ensureMaster', { ctxState: ctx.state })
  if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
    audioTrace('graph:resume:call')
    void ctx.resume().then(() => {
      audioTrace('graph:resume:resolved', { ctxState: ctx.state })
    }).catch((err: unknown) => {
      audioTrace('graph:resume:reject', { error: String(err) })
      RundotAPI.error('[pad-audio-graph] context.resume failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }
  return { ctx, master }
}

function getPadMap(): Map<string, PadEntry> {
  if (!pads) pads = new Map()
  return pads
}

function getNodeContext(node: AudioNode): BaseAudioContext | null {
  return (node as AudioNode & { context?: BaseAudioContext }).context ?? null
}

function entryBelongsToContext(entry: PadEntry, ctx: AudioContext): boolean {
  const gainContext = getNodeContext(entry.gain)
  if (gainContext && gainContext !== ctx) return false
  const dryContext = getNodeContext(entry.dryGain)
  if (dryContext && dryContext !== ctx) return false
  const wetContext = getNodeContext(entry.wetGain)
  if (wetContext && wetContext !== ctx) return false
  return true
}

/**
 * Per-pad pre-amp. Set to unity (1.0) — the previous 2.5× compensation
 * was a band-aid for an apparent attenuation that turned out to be the
 * analyser reading mp3 quiet-tail artifacts, not real chain loss. With
 * unity per-pad gain, two simultaneous loops sum to 2.0 amplitude max
 * before master, which is then handled by a post-master limiter (see
 * `audio-master.ts`) so peaks above 1.0 are softly compressed instead
 * of hard-clipped. Hard-clipping IS what the user heard as "choppy"
 * with multiple loops playing — the destination's ±1.0 clamp.
 */
const PAD_PREAMP_COMPENSATION = 1.0

function buildEntry(ctx: AudioContext, master: AudioNode, padId: string): PadEntry {
  const gain = ctx.createGain()
  // Start silent — every fade-in begins with an explicit setValueAtTime(0, …)
  // before the linear ramp, but we initialise to 0 so an unscheduled ramp
  // collision can't briefly hold the previous gain value.
  gain.gain.value = 0
  // Split: gain → dryGain (compensation) → master, and gain → wetGain (0 by default) → FX bus.
  // The compensation lives on dryGain so it stays out of the wet path
  // (FX bus has its own per-chain output gates). When the per-pad ramp
  // sets `gain.gain` to 1, dryGain × master = PAD_PREAMP_COMPENSATION × master.
  const dryGain = ctx.createGain()
  dryGain.gain.value = PAD_PREAMP_COMPENSATION
  gain.connect(dryGain)
  dryGain.connect(master)
  const wetGain = ctx.createGain()
  wetGain.gain.value = 0
  gain.connect(wetGain)
  // Connect the wet branch into the FX bus. The bus is bound to the same
  // audio-master, so this no-ops if the master isn't ready.
  try {
    getFxBus().connectPad(padId, wetGain)
  } catch (err) {
    audioTrace('graph:fxBus:connect-fail', { padId, error: String(err) })
    RundotAPI.error('[pad-audio-graph] fx-bus connectPad failed', {
      padId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return {
    buffer: null,
    gain,
    dryGain,
    wetGain,
    source: null,
    lastStartedAt: null,
    peakCache: new Map(),
  }
}

function teardownSource(entry: PadEntry, atTime: number): void {
  if (!entry.source) return
  try {
    entry.source.stop(atTime)
  } catch (err) {
    // stop() throws if start() was never called or the source already stopped;
    // both are recoverable.
    RundotAPI.error('[pad-audio-graph] source.stop failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
  entry.source = null
}

/**
 * Compute the audio-context time at which `entry`'s source should start so
 * its loop position is phase-locked to the kit's other pads. If this is the
 * first registration of a new kit, set `kitStartTime` to a small lookahead
 * past `now`. If the kit-start has already passed (slow decode), advance by
 * whole-buffer multiples so the new pad falls into phase at the next
 * loop boundary.
 */
function resolvePhaseLockedStart(
  ctx: AudioContext,
  bufferDuration: number,
): { startAt: number; latePhase: boolean } {
  const now = ctx.currentTime
  if (kitStartTime === null) {
    kitStartTime = now + KIT_START_LOOKAHEAD_SECONDS
    audioTrace('graph:kit-start-set', { kitStartTime, now })
    return { startAt: kitStartTime, latePhase: false }
  }
  if (now <= kitStartTime) {
    // Still inside the lookahead — start at the shared kit-start.
    return { startAt: kitStartTime, latePhase: false }
  }
  // Late registration. Advance the kit-start by whole-buffer multiples until
  // it lands strictly in the future. Web Audio rejects start times in the
  // past, and rounding up by `bufferDuration` keeps the new source phase-
  // aligned with the looping pads that started earlier.
  if (!Number.isFinite(bufferDuration) || bufferDuration <= 0) {
    return { startAt: now + KIT_START_LOOKAHEAD_SECONDS, latePhase: true }
  }
  const elapsed = now - kitStartTime
  const cyclesToSkip = Math.ceil(elapsed / bufferDuration) + 1
  const startAt = kitStartTime + cyclesToSkip * bufferDuration
  return { startAt, latePhase: true }
}

function installSource(
  ctx: AudioContext,
  entry: PadEntry,
): void {
  if (!entry.buffer) return
  const source = ctx.createBufferSource()
  source.buffer = entry.buffer
  source.loop = true
  // Asset-bot trims every loop to an exact integer-bar length (1 bar for
  // most pads; 4 bars for vocal pads). The whole buffer is the musical
  // loop, so leaving loopStart=0 + loopEnd at the default (buffer end) is
  // what we want — no trailing silence to skip. The phase-locked start
  // time still uses 1 bar as the kit-wide phase reference; longer loops
  // (vocals) align on every multi-bar boundary which is musically valid
  // because their length is an integer multiple of the bar.
  const ONE_BAR_AT_DEFAULT_BPM_S = (60 / 84) * 4
  source.connect(entry.gain)
  const { startAt, latePhase } = resolvePhaseLockedStart(ctx, ONE_BAR_AT_DEFAULT_BPM_S)
  try {
    source.start(startAt)
    if (latePhase) {
      audioTrace('graph:source:installed-late-rephased', { startAt, ctxNow: ctx.currentTime })
    } else {
      audioTrace('graph:source:installed-at-kit-start', { startAt, ctxNow: ctx.currentTime })
    }
  } catch (err) {
    audioTrace('graph:source:start-fail', { error: String(err) })
    RundotAPI.error('[pad-audio-graph] source.start failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return
  }
  entry.source = source
  entry.lastStartedAt = startAt
}

// ── Public singleton ─────────────────────────────────────────────────────

const singleton: PadAudioGraph = {
  async registerPadBuffer(padId: string, bufferUrl: string): Promise<void> {
    audioTrace('graph:register:start', { padId, bufferUrl })
    const ready = ensureMaster()
    if (!ready) {
      audioTrace('graph:register:no-master', { padId })
      return
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await fetchBuffer(bufferUrl)
      audioTrace('graph:register:fetched', { padId, bytes: arrayBuffer.byteLength })
    } catch (err) {
      audioTrace('graph:register:fetch-fail', { padId, bufferUrl, error: String(err) })
      RundotAPI.error('[pad-audio-graph] buffer fetch failed', {
        padId,
        bufferUrl,
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }

    let decoded: AudioBuffer
    try {
      decoded = await ready.ctx.decodeAudioData(arrayBuffer)
      audioTrace('graph:register:decoded', { padId, durationSec: decoded.duration, channels: decoded.numberOfChannels })
    } catch (err) {
      audioTrace('graph:register:decode-fail', { padId, bufferUrl, error: String(err) })
      RundotAPI.error('[pad-audio-graph] decodeAudioData failed', {
        padId,
        bufferUrl,
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }

    const liveReady = ensureMaster()
    if (!liveReady) {
      audioTrace('graph:register:no-live-master-after-decode', { padId })
      return
    }
    if (liveReady.ctx !== ready.ctx) {
      audioTrace('graph:register:context-refreshed-after-decode', { padId })
    }

    const map = getPadMap()
    let existing = map.get(padId)
    if (existing && !entryBelongsToContext(existing, liveReady.ctx)) {
      audioTrace('graph:register:drop-stale-entry-context', { padId })
      singleton.disposePad(padId)
      existing = undefined
    }
    if (existing) {
      // Kit-internal re-register (same kit, swapped buffer URL): tear down the
      // old source and install a freshly phase-locked one with the new buffer.
      // Cross-kit swaps go through disposeAll() first.
      teardownSource(existing, liveReady.ctx.currentTime)
      existing.buffer = decoded
      installSource(liveReady.ctx, existing)
      audioTrace('graph:register:replace', { padId })
      return
    }
    const entry = buildEntry(liveReady.ctx, liveReady.master, padId)
    entry.buffer = decoded
    installSource(liveReady.ctx, entry)
    map.set(padId, entry)
    audioTrace('graph:register:stored', { padId, mapSize: map.size })
  },

  scheduleRamp(
    padId: string,
    fromGain: number,
    toGain: number,
    startAt: number,
    endAt: number,
  ): void {
    audioTrace('graph:scheduleRamp:enter', { padId, fromGain, toGain, startAt, endAt })
    const ready = ensureMaster()
    if (!ready) {
      audioTrace('graph:scheduleRamp:no-master', { padId })
      return
    }

    const entry = getPadMap().get(padId)
    if (!entry || !entry.buffer) {
      audioTrace('graph:scheduleRamp:no-buffer', { padId, hasEntry: Boolean(entry) })
      return
    }

    if (!entry.source) {
      // Defensive — registerPadBuffer normally installs the source. If a tap
      // somehow lands before the install (e.g. a buffer entry was kept across
      // a teardown), install one now so the ramp has something to gain on.
      audioTrace('graph:scheduleRamp:source-missing', { padId })
      installSource(ready.ctx, entry)
      if (!entry.source) return
    }

    const gainParam = entry.gain.gain
    try {
      gainParam.setValueAtTime(fromGain, startAt)
      gainParam.linearRampToValueAtTime(toGain, endAt)
      audioTrace('graph:gain:ramp', { padId, fromGain, toGain, startAt, endAt })
    } catch (err) {
      audioTrace('graph:gain:ramp-fail', { padId, error: String(err) })
      RundotAPI.error('[pad-audio-graph] gain ramp failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
      return
    }

    // Sources stay alive for the kit's lifetime — never stop on fade-to-zero.
    // Phase-locked playback is the whole point.
  },

  setGain(padId: string, value: number): void {
    const ready = ensureMaster()
    if (!ready) return
    const entry = getPadMap().get(padId)
    if (!entry) return
    try {
      entry.gain.gain.setValueAtTime(value, ready.ctx.currentTime)
    } catch (err) {
      RundotAPI.error('[pad-audio-graph] setGain failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  cancelGainRamps(padId: string, fromTime: number): void {
    const ready = ensureMaster()
    if (!ready) return
    const entry = getPadMap().get(padId)
    if (!entry) return
    try {
      entry.gain.gain.cancelScheduledValues(fromTime)
      // Re-anchor at the current value so future ramps interpolate from
      // here rather than from a stale older event.
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, fromTime)
      audioTrace('graph:gain:cancel-ramps', { padId, fromTime })
    } catch (err) {
      audioTrace('graph:gain:cancel-fail', { padId, error: String(err) })
      RundotAPI.error('[pad-audio-graph] cancelGainRamps failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  setPadWetSend(padId: string, value: number): void {
    const ready = ensureMaster()
    if (!ready) return
    const entry = getPadMap().get(padId)
    if (!entry) return
    const target = Math.max(0, Math.min(1, value))
    const now = ready.ctx.currentTime
    try {
      entry.wetGain.gain.cancelScheduledValues(now)
      entry.wetGain.gain.setValueAtTime(entry.wetGain.gain.value, now)
      entry.wetGain.gain.linearRampToValueAtTime(target, now + WET_SEND_RAMP_SECONDS)
      audioTrace('graph:wet-send:ramp', { padId, target, now })
    } catch (err) {
      audioTrace('graph:wet-send:ramp-fail', { padId, error: String(err) })
      RundotAPI.error('[pad-audio-graph] setPadWetSend failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },

  disposePad(padId: string): void {
    const map = getPadMap()
    const entry = map.get(padId)
    if (!entry) return
    const ctx = isAudioMasterReady() ? getAudioContext() : null
    if (entry.source) {
      teardownSource(entry, ctx?.currentTime ?? 0)
    }
    // Detach the wet send from the FX bus before tearing down nodes so the
    // bus's pad-connection map stays consistent.
    try {
      getFxBus().disconnectPad(padId)
    } catch (err) {
      audioTrace('graph:fxBus:disconnect-fail', { padId, error: String(err) })
    }
    try {
      entry.wetGain.disconnect()
    } catch {
      // best-effort
    }
    try {
      entry.dryGain.disconnect()
    } catch {
      // best-effort
    }
    try {
      entry.gain.disconnect()
    } catch (err) {
      RundotAPI.error('[pad-audio-graph] gain.disconnect failed', {
        padId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    map.delete(padId)
  },

  disposeAll(): void {
    const map = getPadMap()
    for (const padId of Array.from(map.keys())) {
      singleton.disposePad(padId)
    }
    // Reset the kit-start clock so the next kit picks up a fresh phase anchor.
    kitStartTime = null
    kitPhaseAnchor = null
    audioTrace('graph:disposeAll')
  },
}

/** Production accessor. The graph is process-singleton bound to audio-master. */
export function getPadAudioGraph(): PadAudioGraph {
  return singleton
}

/**
 * Diagnostic snapshot for the debug API. Returns enough state to answer
 * "why don't I hear anything?" without a debugger — context state, registered
 * pads + their buffer presence, current per-pad gain values.
 */
export function getPadAudioGraphSnapshot(): {
  contextState: string | null
  registeredPads: number
  pads: Array<{
    padId: string
    hasBuffer: boolean
    hasSource: boolean
    gainValue: number
    /**
     * Per-pad wet-send gain (0 = dry-only, 1 = full FX-bus routing). Drives
     * the audio-trace harness's verification that every pad's wet branch is
     * present in the routing graph.
     */
    wetGainValue: number
    bufferDuration: number
    bufferChannels: number
  }>
} {
  const map = pads ?? new Map<string, PadEntry>()
  const ctxState = (() => {
    try {
      return isAudioMasterReady() ? getAudioContext().state : null
    } catch {
      return null
    }
  })()
  return {
    contextState: ctxState,
    registeredPads: map.size,
    pads: Array.from(map.entries()).map(([padId, entry]) => ({
      padId,
      hasBuffer: entry.buffer !== null,
      hasSource: entry.source !== null,
      gainValue: entry.gain.gain.value,
      wetGainValue: entry.wetGain.gain.value,
      bufferDuration: entry.buffer ? entry.buffer.duration : 0,
      bufferChannels: entry.buffer ? entry.buffer.numberOfChannels : 0,
    })),
  }
}

/**
 * Restart a single pad's BufferSourceNode so it begins from sample 0 at
 * `startAt` (an AudioContext time). Used by the engine when a player
 * taps a loop pad — we want the loop to be heard from its musical top,
 * not from wherever the phase-locked source happens to be in its cycle.
 *
 * Stops + disconnects the existing source (if any), creates a fresh
 * BufferSourceNode connected to `entry.gain`, schedules its `start()` at
 * `startAt`, and updates `entry.lastStartedAt` so loop-progress UI
 * reads from the new clock.
 *
 * Idempotent in the no-buffer / no-context-ready cases — returns false
 * so callers can fall back. Returns true on success.
 */
/**
 * Module-level one-shot detune (cents). Updated by the pitch store via
 * `setOneShotDetuneCents`. Loops are unaffected — detuning a looping
 * source also changes its playback rate, which would break the kit's
 * bar-aligned mix. One-shots play once, so they can carry pitch shift
 * without sync consequences.
 */
let oneShotDetuneCents = 0

export function setOneShotDetuneCents(cents: number): void {
  oneShotDetuneCents = cents
}

export function getOneShotDetuneCents(): number {
  return oneShotDetuneCents
}

export function restartPadSource(
  padId: string,
  startAt: number,
  options: { loop?: boolean } = {},
): boolean {
  if (!isAudioMasterReady()) return false
  let ctx: AudioContext
  try {
    ctx = getAudioContext()
  } catch {
    return false
  }
  if (ctx.state !== 'running') return false
  const map = pads ?? new Map<string, PadEntry>()
  const entry = map.get(padId)
  if (!entry || !entry.buffer) return false

  // Stop the old source. We pass `startAt` so the old source produces
  // audio up to startAt and goes silent precisely when the new source
  // starts, avoiding any glitch.
  if (entry.source) {
    try {
      entry.source.stop(startAt)
    } catch {
      // already stopped — non-fatal
    }
    try {
      entry.source.disconnect()
    } catch {
      // already disconnected — non-fatal
    }
    entry.source = null
  }

  const source = ctx.createBufferSource()
  source.buffer = entry.buffer
  // One-shot pads pass `loop: false` so the buffer plays once and stops at
  // its natural decay end. Without this, generated audio outputs that
  // pad their tail with silence (e.g. a 1.5 s "snare crescendo" file
  // whose actual content ends at 1.0 s) wrap from the silence back to
  // the attack, and the player hears a "the sound drops for half a
  // second at the end" artefact while the engine's gain ramp silences
  // the second iteration. Loop pads keep the default `loop: true`.
  source.loop = options.loop ?? true
  // One-shots respect the global detune slider; loops never do (would
  // also change the source's playback rate and break the kit's bar
  // grid). `detune` is in cents (1 semitone = 100 cents).
  if (source.loop === false && oneShotDetuneCents !== 0) {
    try {
      source.detune.setValueAtTime(oneShotDetuneCents, startAt)
    } catch (err) {
      audioTrace('graph:source:detune-fail', { padId, error: String(err) })
    }
  }
  source.connect(entry.gain)
  try {
    source.start(startAt)
    audioTrace('graph:source:restart', {
      padId,
      startAt,
      ctxNow: ctx.currentTime,
      loop: source.loop,
    })
  } catch (err) {
    audioTrace('graph:source:restart-fail', { padId, error: String(err) })
    RundotAPI.error('[pad-audio-graph] restartPadSource failed', {
      padId,
      error: err instanceof Error ? err.message : String(err),
    })
    return false
  }
  entry.source = source
  entry.lastStartedAt = startAt
  // First audible source restart of the session anchors the bar grid that
  // every subsequent cross-block tap aligns to. The engine may also call
  // `setKitPhaseAnchor` explicitly when the grid empties out and the next
  // tap should re-anchor.
  if (kitPhaseAnchor === null) {
    kitPhaseAnchor = startAt
    audioTrace('graph:phase-anchor:set-on-restart', { startAt })
  }
  return true
}

/**
 * Re-install every pad's BufferSourceNode against the current AudioContext
 * clock. Called from inside the first user-gesture handler after the
 * context resumes — sources that were started while the context was in
 * `suspended` state may not actually play once the context resumes,
 * because their queued startTime references the pre-resume clock. This
 * stops any existing source and creates a fresh one that starts at the
 * current AudioContext time + a short lookahead, guaranteeing audible
 * playback.
 *
 * Returns the count of sources reinstalled so callers can log a verdict.
 */
export function reinstallAllSourcesAfterResumeReturning(): number {
  if (!isAudioMasterReady()) return 0
  let ctx: AudioContext
  try {
    ctx = getAudioContext()
  } catch {
    return 0
  }
  if (ctx.state !== 'running') return 0
  const map = pads ?? new Map<string, PadEntry>()
  // Reset the kit-start phase reference so resolvePhaseLockedStart picks a
  // fresh shared phase from the now-running clock (every reinstalled
  // source aligns on the new shared start). The user-audible bar anchor
  // is also cleared — its previous value referenced the pre-resume clock,
  // which is no longer valid for scheduling decisions.
  kitStartTime = null
  kitPhaseAnchor = null
  let count = 0
  for (const entry of map.values()) {
    if (!entry.buffer) continue
    if (entry.source) {
      try {
        entry.source.stop(ctx.currentTime)
      } catch {
        // already stopped — non-fatal
      }
      try {
        entry.source.disconnect()
      } catch {
        // already disconnected — non-fatal
      }
      entry.source = null
    }
    installSource(ctx, entry)
    count++
  }
  audioTrace('graph:reinstall-sources', { count, ctxNow: ctx.currentTime })
  return count
}

/** Back-compat shim — old callsites used the void variant. */
export function reinstallAllSourcesAfterResume(): void {
  reinstallAllSourcesAfterResumeReturning()
}

/** Diagnostic: hand back a pad's decoded buffer for direct-play tests. */
export function getPadBuffer(padId: string): AudioBuffer | null {
  if (!pads) return null
  return pads.get(padId)?.buffer ?? null
}

/**
 * Compute the next AudioContext time at which this pad's currently-playing
 * buffer will complete an integer number of full iterations (i.e. end of
 * the current iteration). Used by the engine to schedule queue swaps and
 * deactivate fades at the end of the OUTGOING loop's natural cycle, not
 * the next 1-bar grid point.
 *
 * Returns `null` if the pad has no installed source / buffer (caller
 * should fall back to next-bar scheduling in that case).
 */
export function nextLoopEndForPad(padId: string, ctxNow: number): number | null {
  if (!pads) return null
  const entry = pads.get(padId)
  if (!entry || !entry.buffer || entry.lastStartedAt === null) return null
  const dur = entry.buffer.duration
  if (!Number.isFinite(dur) || dur <= 0) return null
  const elapsed = ctxNow - entry.lastStartedAt
  if (elapsed < 0) {
    // Source hasn't started yet — first iteration ends at lastStartedAt + dur.
    return entry.lastStartedAt + dur
  }
  const cyclesCompleted = Math.floor(elapsed / dur)
  return entry.lastStartedAt + (cyclesCompleted + 1) * dur
}

/**
 * Compute (or return cached) per-column peak amplitudes from this pad's
 * decoded buffer. Used by the UI waveform widget to draw real spectro-
 * thumbnails. Each column samples `floor(samples / columns)` consecutive
 * frames and keeps the maximum absolute value across all channels;
 * results are normalised so the loudest column reads 1.0 and the
 * quietest reads at least 0.05 (so the waveform stays visible during
 * quiet passages).
 *
 * Returns `null` if the buffer hasn't decoded yet — callers should fall
 * back to a placeholder shape and retry once decoding completes.
 */
export function getPadPeakSamples(
  padId: string,
  columns: number,
): number[] | null {
  if (!pads || columns <= 0) return null
  const entry = pads.get(padId)
  if (!entry || !entry.buffer) return null
  const cached = entry.peakCache.get(columns)
  if (cached) return cached
  const buffer = entry.buffer
  const total = buffer.length
  if (total === 0) return null
  const channelCount = Math.max(1, buffer.numberOfChannels)
  const channels: Float32Array[] = []
  for (let c = 0; c < channelCount; c++) channels.push(buffer.getChannelData(c))
  const windowSize = Math.max(1, Math.floor(total / columns))
  const peaks = new Array<number>(columns)
  let globalMax = 0
  for (let col = 0; col < columns; col++) {
    const start = col * windowSize
    const end = col === columns - 1 ? total : Math.min(total, start + windowSize)
    let peak = 0
    for (let i = start; i < end; i++) {
      let v = 0
      for (let c = 0; c < channelCount; c++) {
        const s = channels[c]?.[i] ?? 0
        const abs = s < 0 ? -s : s
        if (abs > v) v = abs
      }
      if (v > peak) peak = v
    }
    peaks[col] = peak
    if (peak > globalMax) globalMax = peak
  }
  const MIN_VISIBLE = 0.05
  if (globalMax > 0) {
    for (let i = 0; i < columns; i++) {
      const normalised = (peaks[i] ?? 0) / globalMax
      peaks[i] = normalised < MIN_VISIBLE ? MIN_VISIBLE : normalised
    }
  } else {
    for (let i = 0; i < columns; i++) peaks[i] = MIN_VISIBLE
  }
  entry.peakCache.set(columns, peaks)
  return peaks
}

/** Hand back a pad's buffer duration in seconds (or null). */
export function getPadBufferDuration(padId: string): number | null {
  if (!pads) return null
  const entry = pads.get(padId)
  return entry?.buffer?.duration ?? null
}

/**
 * UI-facing playback info — `lastStartedAt` is the AudioContext time the
 * currently-installed source.start() was scheduled at, `duration` is the
 * buffer length in seconds. Combined with the AudioContext clock, the UI
 * computes "how far into the current iteration is this pad?".
 *
 * Returns `null` if the pad isn't installed or has no buffer.
 */
export function getPadPlaybackInfo(
  padId: string,
): { lastStartedAt: number; duration: number } | null {
  if (!pads) return null
  const entry = pads.get(padId)
  if (!entry || !entry.buffer || entry.lastStartedAt === null) return null
  return { lastStartedAt: entry.lastStartedAt, duration: entry.buffer.duration }
}

/**
 * Return the user-audible bar grid anchor, or `null` if no audible source
 * has been started in this session. The engine reads this to decide
 * whether the next tap is a cold start (no anchor → use a longer head
 * to outrun audio-device wake-up latency) or a warm tap (anchor exists →
 * snap immediately and align to the existing grid).
 */
export function getKitPhaseAnchor(): number | null {
  return kitPhaseAnchor
}

/**
 * Set or reset the user-audible bar anchor. The engine calls this only
 * when the grid was empty before the new tap (cold start, or all loops
 * had been deactivated and a fresh phase reference is needed). Cross-
 * block taps with active loops elsewhere never reset the anchor — they
 * just align to it.
 */
export function setKitPhaseAnchor(t: number | null): void {
  kitPhaseAnchor = t
}

/**
 * Compute the next bar boundary on the kit's audible bar grid past
 * `ctxNow`. If the anchor is unset (no audible source ever started) or
 * the anchor is in the future (just-set on a same-tick path) we fall
 * back to a plain bar wait so callers always receive a finite future
 * time. Bar boundaries land at `anchor + N * barSeconds` for positive
 * integer N.
 */
export function nextBarFromKitAnchor(ctxNow: number, barSeconds: number): number {
  if (!Number.isFinite(barSeconds) || barSeconds <= 0) return ctxNow
  if (kitPhaseAnchor === null) return ctxNow + barSeconds
  if (ctxNow < kitPhaseAnchor) return kitPhaseAnchor
  const elapsed = ctxNow - kitPhaseAnchor
  const cyclesCompleted = Math.floor(elapsed / barSeconds)
  return kitPhaseAnchor + (cyclesCompleted + 1) * barSeconds
}

/** UI-facing accessor for the live AudioContext currentTime. */
export function getAudioContextNow(): number | null {
  if (!isAudioMasterReady()) return null
  try {
    return getAudioContext().currentTime
  } catch {
    return null
  }
}

/** Test-only: clear the per-pad map between specs. */
export function __resetPadAudioGraph(): void {
  if (pads) {
    for (const entry of pads.values()) {
      if (entry.source) {
        try {
          entry.source.stop(0)
        } catch {
          // ignore — test teardown
        }
      }
      try {
        entry.wetGain.disconnect()
      } catch {
        // ignore — test teardown
      }
      try {
        entry.dryGain.disconnect()
      } catch {
        // ignore — test teardown
      }
      try {
        entry.gain.disconnect()
      } catch {
        // ignore — test teardown
      }
    }
  }
  pads = null
  kitStartTime = null
  kitPhaseAnchor = null
}
