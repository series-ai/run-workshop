/**
 * Pad-grid engine — timing contract tests.
 *
 * Verifies the documented behaviour for "when does a tapped loop fire?":
 *
 *   • First tap on an empty grid (cold start, no anchor) → fires at
 *     `ctxNow + COLD_START_HEAD_S` (≈ 120 ms) and SETS the kit phase
 *     anchor to that timestamp.
 *
 *   • First tap on an empty grid (warm — anchor exists from prior
 *     session, all loops were toggled off) → fires at
 *     `ctxNow + FIRST_TAP_IMMEDIATE_HEAD_S` (≈ 10 ms) and RESETS the
 *     anchor to the new timestamp.
 *
 *   • Cross-block tap with active loops → fires at
 *     `nextBarFromKitAnchor(ctxNow, secondsPerBar)`, i.e. the next
 *     1-bar boundary on the kit's audible bar grid. Anchor unchanged.
 *
 *   • Same-block swap (outgoing variant playing) → fires at
 *     `nextBarFromKitAnchor(ctxNow, secondsPerBar)`, the next 1-bar
 *     boundary on the kit grid. Outgoing's phrase position is irrelevant;
 *     loops are composed so every bar is a clean entry point.
 *
 *   • Toggle-off (re-tap an active loop) → schedules fade-out at the
 *     END of self's current iteration with category-appropriate tail
 *     fade (1 bar for multi-bar loops, 30 ms for 1-bar loops).
 *
 *   • One-shot tap → fires at `ctxNow + head` (cold or warm) and only
 *     anchors if cold (must not disrupt a running kit's phase grid).
 *
 *   • Per-block lockout — same-block tap schedules outgoing's fade-out
 *     at the same swapAt as incoming's fade-in.
 *
 *   • Tap debounce — taps within `TAP_DEBOUNCE_MS` are ignored.
 *
 * The engine imports `pad-audio-graph` for anchor + buffer-info reads;
 * we mock those to control the timing inputs deterministically.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock pad-audio-graph (anchor + buffer info) ──────────────────────────

const mocks = vi.hoisted(() => ({
  anchor: null as number | null,
  /** Per-pad buffer duration mock; key = padId, fallback null. */
  bufferDurations: new Map<string, number>(),
  /** Per-pad next-loop-end mock; key = padId, fallback null. */
  loopEnds: new Map<string, number>(),
  /** Per-pad lastStartedAt mock for completeness. */
  lastStartedAt: new Map<string, number>(),
}))

vi.mock('../audio/pad-audio-graph', () => ({
  getKitPhaseAnchor: () => mocks.anchor,
  setKitPhaseAnchor: (t: number | null) => {
    mocks.anchor = t
  },
  nextBarFromKitAnchor: (ctxNow: number, barSeconds: number): number => {
    if (!Number.isFinite(barSeconds) || barSeconds <= 0) return ctxNow
    if (mocks.anchor === null) return ctxNow + barSeconds
    if (ctxNow < mocks.anchor) return mocks.anchor
    const elapsed = ctxNow - mocks.anchor
    const cycles = Math.floor(elapsed / barSeconds)
    return mocks.anchor + (cycles + 1) * barSeconds
  },
  restartPadSource: vi.fn(() => true),
  nextLoopEndForPad: (padId: string, _ctxNow: number) =>
    mocks.loopEnds.get(padId) ?? null,
  getPadBufferDuration: (padId: string) => mocks.bufferDurations.get(padId) ?? null,
  getPadAudioGraphSnapshot: () => ({
    contextState: 'running' as const,
    registeredPads: 0,
    pads: [],
  }),
  getPadPlaybackInfo: (padId: string) => {
    const dur = mocks.bufferDurations.get(padId)
    const started = mocks.lastStartedAt.get(padId)
    if (dur === undefined || started === undefined) return null
    return { lastStartedAt: started, duration: dur }
  },
}))

// ── Mock audio-master (the engine reads it via the pad-graph snapshot) ──

vi.mock('../audio/audio-master', () => ({
  isAudioMasterReady: () => true,
  getAudioContext: () => ({ currentTime: 0, state: 'running' }),
  readMasterDiagnostic: () => ({
    ready: true,
    contextState: 'running' as const,
    currentTime: 0,
    masterGainValue: 1,
    computedMasterGain: 1,
    rmsEnergy: 0,
    peakEnergy: 0,
    settings: { soundEnabled: true, musicEnabled: true, musicVolume: 1 },
  }),
}))

// ── Engine + stores ──────────────────────────────────────────────────────

import {
  createPadGridEngine,
  COLD_START_HEAD_S,
  FIRST_TAP_IMMEDIATE_HEAD_S,
  INCOMING_FADE_IN_SECONDS,
  BAR_CROSSFADE_SECONDS,
  TAP_DEBOUNCE_MS,
  type PadGridEngine,
  type PadGridEngineDeps,
} from '../systems/pad-grid-engine'
import { usePadGridStore, resetPadGridStore } from '../stores/padGridStore'
import { useKitsStore } from '../stores/kitsStore'
import { DEFAULT_BPM } from '../audio/beat-clock'

const SECONDS_PER_BAR = (60 / DEFAULT_BPM) * 4 // 2.857142857 s
const EIGHT_BAR_DURATION = 8 * SECONDS_PER_BAR // 22.857142857 s

// ── Test scaffolding ─────────────────────────────────────────────────────

interface CapturedRamp {
  padId: string
  from: number
  to: number
  startAt: number
  endAt: number
}

function makeDeps(initialCtxNow = 4.0): {
  deps: PadGridEngineDeps
  audio: {
    ramps: CapturedRamp[]
    advance: (sec: number) => void
    setNow: (t: number) => void
  }
} {
  let ctxNow = initialCtxNow
  let wallNow = 100_000 // arbitrary wall-time, well past any debounce window
  const ramps: CapturedRamp[] = []
  const deps: PadGridEngineDeps = {
    getCurrentTime: () => ctxNow,
    scheduleRamp: vi.fn((padId, from, to, startAt, endAt) => {
      ramps.push({ padId, from, to, startAt, endAt })
    }),
    setGain: vi.fn(),
    cancelGainRamps: vi.fn(),
    nextBarFromNow: () => SECONDS_PER_BAR / 2, // sequencer fallback (should be unused on hot paths)
    secondsPerBar: () => SECONDS_PER_BAR,
    now: () => wallNow,
  }
  return {
    deps,
    audio: {
      ramps,
      advance: (sec) => {
        ctxNow += sec
        wallNow += sec * 1000
      },
      setNow: (t) => {
        ctxNow = t
        wallNow = 100_000 + t * 1000
      },
    },
  }
}

function rampsFor(ramps: CapturedRamp[], padId: string): CapturedRamp[] {
  return ramps.filter((r) => r.padId === padId)
}

beforeEach(() => {
  // Reset to TRULY empty grid — the default 'demo' variant seeds
  // DEMO_ACTIVE_PAD_IDS, which would invalidate every "first tap on
  // empty grid" assertion below.
  resetPadGridStore('empty')
  // Reset mock state between tests.
  mocks.anchor = null
  mocks.bufferDurations.clear()
  mocks.loopEnds.clear()
  mocks.lastStartedAt.clear()
  // Hero kit is preloaded in kitsStore; reset selection just in case.
  useKitsStore.setState({ activeKitId: 'lofi_heights_hero' })
})

// Pad-id helpers — matches the catalog's `${bank}-${blockId}-${variantIndex}`.
const DRUM_A0 = 'A-block-0-0' // drums variant 0
const DRUM_A1 = 'A-block-0-1' // drums variant 1 (same block as A0)
const BASS_A0 = 'A-block-1-0' // bass variant 0 (different block from A0)
const MELODY_A0 = 'A-block-2-0' // melody variant 0 (different block)
const FILL_A0 = 'A-block-4-0' // one-shot drumFill

// ── Tests ────────────────────────────────────────────────────────────────

describe('engine.tapLoop — first tap on empty grid', () => {
  it('cold-start: fires at ctxNow + COLD_START_HEAD_S and sets the anchor', () => {
    const { deps, audio } = makeDeps(4.0)
    const engine: PadGridEngine = createPadGridEngine(deps)
    expect(mocks.anchor).toBe(null)

    engine.tapLoop(DRUM_A0)

    const r = rampsFor(audio.ramps, DRUM_A0)[0]!
    expect(r.from).toBe(0)
    expect(r.to).toBe(1)
    expect(r.startAt).toBeCloseTo(4.0 + COLD_START_HEAD_S, 6)
    expect(r.endAt - r.startAt).toBeCloseTo(INCOMING_FADE_IN_SECONDS, 6)
    expect(mocks.anchor).toBeCloseTo(4.0 + COLD_START_HEAD_S, 6)
  })

  it('warm: anchor exists, grid empty → uses fast head and PRESERVES the anchor', () => {
    mocks.anchor = 1.0 // pre-existing kit-load / first-tap anchor
    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A0)

    const r = rampsFor(audio.ramps, DRUM_A0)[0]!
    expect(r.startAt).toBeCloseTo(10.0 + FIRST_TAP_IMMEDIATE_HEAD_S, 6)
    // Anchor MUST stay at 1.0 — re-anchoring on every clear-and-retap was
    // shifting the bar grid mid-session, which made layered loops feel
    // like they were "dropping in randomly" relative to the prior loops.
    expect(mocks.anchor).toBe(1.0)
  })
})

describe('engine.tapLoop — cross-block tap with active loop', () => {
  it('schedules at next 1-bar boundary on the kit phase grid (not sequencer clock)', () => {
    // Anchor at 4.18 (arbitrary first-tap landing).
    mocks.anchor = 4.18
    // Pretend a drum is active so the new bass tap takes the cross-block path.
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(BASS_A0)

    const r = rampsFor(audio.ramps, BASS_A0)[0]!
    // Expected: anchor + 1 * bar = 4.18 + 2.857 = 7.037
    expect(r.startAt).toBeCloseTo(4.18 + SECONDS_PER_BAR, 5)
    // Anchor unchanged (we don't re-anchor on cross-block taps).
    expect(mocks.anchor).toBe(4.18)
  })

  it('three sequential cross-block taps land on the SAME bar grid', () => {
    mocks.anchor = 4.18
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(BASS_A0)
    audio.advance(0.4) // ctx 5.4
    engine.tapLoop(MELODY_A0)
    audio.advance(0.5) // ctx 5.9

    // All three (drum already active + bass + melody) should be on the
    // anchor grid: anchor + N · bar.
    const bassStartAt = rampsFor(audio.ramps, BASS_A0)[0]!.startAt
    const melodyStartAt = rampsFor(audio.ramps, MELODY_A0)[0]!.startAt

    expect(bassStartAt).toBeCloseTo(4.18 + SECONDS_PER_BAR, 5)
    expect(melodyStartAt).toBeCloseTo(4.18 + SECONDS_PER_BAR, 5)
    // Both land on the SAME bar boundary (since both ctxNow values were
    // within the same bar window past the anchor).
    expect(bassStartAt).toBeCloseTo(melodyStartAt, 5)
    // (anchor + N · bar) - anchor must be an integer multiple of bar.
    const offset = bassStartAt - 4.18
    expect(offset / SECONDS_PER_BAR - Math.round(offset / SECONDS_PER_BAR)).toBeCloseTo(0, 5)
  })
})

describe('engine.tapLoop — same-block swap', () => {
  // Groovepad-faithful contract: same-block swap fires on the NEXT
  // 1-bar boundary on the kit phase grid, not at outgoing's iteration
  // end. A tap mid-bar 5 of an 8-bar drum swaps in at bar 6.
  it('schedules at next 1-bar boundary on the kit phase grid', () => {
    mocks.anchor = 4.18
    // Outgoing is mid-iteration of an 8-bar loop — but that's irrelevant.
    mocks.loopEnds.set(DRUM_A0, 4.18 + EIGHT_BAR_DURATION)
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A1)

    const r = rampsFor(audio.ramps, DRUM_A1)[0]!
    // ctxNow=10, anchor=4.18, bar=2.857 → cycles=floor(5.82/2.857)=2,
    // next bar = 4.18 + 3·2.857 = 12.751
    expect(r.startAt).toBeCloseTo(4.18 + 3 * SECONDS_PER_BAR, 5)
    // Crucially NOT the outgoing's iteration end at 4.18 + 8·bar = 27.04.
    expect(r.startAt).toBeLessThan(20)
  })

  it('same-block and cross-block swaps land on identical bar grids', () => {
    mocks.anchor = 4.18
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    // Same-block tap (DRUM_A1) and cross-block tap (BASS_A0) at the
    // SAME ctxNow must land on the same bar boundary.
    engine.tapLoop(DRUM_A1)
    engine.tapLoop(BASS_A0)

    const drumStart = rampsFor(audio.ramps, DRUM_A1)[0]!.startAt
    const bassStart = rampsFor(audio.ramps, BASS_A0)[0]!.startAt
    expect(drumStart).toBeCloseTo(bassStart, 5)
  })
})

describe('engine.tapLoop — per-block lockout', () => {
  it('schedules outgoing fade-out at the same swapAt as incoming fade-in', () => {
    mocks.anchor = 4.18
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A1)

    const incomingRamp = rampsFor(audio.ramps, DRUM_A1)[0]!
    const outgoingRamps = rampsFor(audio.ramps, DRUM_A0)
    expect(outgoingRamps.length).toBe(1)
    const outgoingRamp = outgoingRamps[0]!

    expect(outgoingRamp.from).toBe(1)
    expect(outgoingRamp.to).toBe(0)
    expect(outgoingRamp.startAt).toBeCloseTo(incomingRamp.startAt, 5)
    expect(outgoingRamp.endAt - outgoingRamp.startAt).toBeCloseTo(BAR_CROSSFADE_SECONDS, 5)
  })

  it('cross-block tap does NOT schedule a fade-out on pads in other blocks', () => {
    mocks.anchor = 4.18
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(BASS_A0)

    expect(rampsFor(audio.ramps, DRUM_A0).length).toBe(0)
    expect(rampsFor(audio.ramps, BASS_A0).length).toBe(1)
  })
})

describe('engine.deactivate — toggle-off timing', () => {
  // Toggle-off matches same-block-swap semantics: schedule fade-out at
  // the next 1-bar boundary with a uniform 30 ms tail. No phrase-length-
  // aware behaviour. Tap to stop = stops within ≤ 1 bar regardless of
  // whether the loop was 1, 4, or 8 bars long.
  it('schedules fade-out at next 1-bar boundary', () => {
    mocks.anchor = 4.18
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.deactivate(DRUM_A0)

    const r = rampsFor(audio.ramps, DRUM_A0)[0]!
    expect(r.from).toBe(1)
    expect(r.to).toBe(0)
    // ctxNow=10, anchor=4.18, bar=2.857 → next bar = 4.18 + 3·2.857 = 12.751
    expect(r.startAt).toBeCloseTo(4.18 + 3 * SECONDS_PER_BAR, 5)
  })

  it('uses a uniform 30 ms tail fade regardless of loop length', () => {
    mocks.anchor = 4.18
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION) // multi-bar
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.deactivate(DRUM_A0)

    const r = rampsFor(audio.ramps, DRUM_A0)[0]!
    expect(r.endAt - r.startAt).toBeCloseTo(BAR_CROSSFADE_SECONDS, 5)
  })

  it('1-bar loop also gets a 30 ms tail fade (parity with multi-bar)', () => {
    mocks.anchor = 4.18
    mocks.bufferDurations.set(DRUM_A0, SECONDS_PER_BAR)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    engine.deactivate(DRUM_A0)

    const r = rampsFor(audio.ramps, DRUM_A0)[0]!
    expect(r.endAt - r.startAt).toBeCloseTo(BAR_CROSSFADE_SECONDS, 5)
  })

  it('re-tapping an active loop deactivates (toggle behaviour)', () => {
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + EIGHT_BAR_DURATION)
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A0)

    // Single ramp recorded: the deactivate fade-out (1 → 0).
    const r = rampsFor(audio.ramps, DRUM_A0)
    expect(r.length).toBe(1)
    expect(r[0]!.from).toBe(1)
    expect(r[0]!.to).toBe(0)
  })
})

describe('engine.tapOneShot — one-shot timing', () => {
  it('cold-start: fires at ctxNow + COLD_START_HEAD_S and sets the anchor', () => {
    const { deps, audio } = makeDeps(4.0)
    const engine = createPadGridEngine(deps)
    mocks.bufferDurations.set(FILL_A0, 1.0) // arbitrary one-shot length

    expect(mocks.anchor).toBe(null)
    engine.tapOneShot(FILL_A0)

    const fadeIn = audio.ramps.find(
      (r) => r.padId === FILL_A0 && r.from === 0 && r.to === 1,
    )
    expect(fadeIn).toBeDefined()
    expect(fadeIn!.startAt).toBeCloseTo(4.0 + COLD_START_HEAD_S, 6)
    expect(mocks.anchor).toBeCloseTo(4.0 + COLD_START_HEAD_S, 6)
  })

  it('warm: anchor exists → uses fast head and does NOT change the anchor', () => {
    // Critical invariant: a one-shot tapped while loops are running must
    // never reset the kit phase anchor — that would un-sync every other
    // active loop.
    mocks.anchor = 4.18
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })
    mocks.bufferDurations.set(FILL_A0, 1.0)

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapOneShot(FILL_A0)

    const fadeIn = audio.ramps.find(
      (r) => r.padId === FILL_A0 && r.from === 0 && r.to === 1,
    )
    expect(fadeIn!.startAt).toBeCloseTo(10.0 + FIRST_TAP_IMMEDIATE_HEAD_S, 6)
    // Anchor must be unchanged.
    expect(mocks.anchor).toBe(4.18)
  })
})

describe('engine.tapLoop — debounce', () => {
  it('ignores second tap on the same pad within TAP_DEBOUNCE_MS', () => {
    const { deps, audio } = makeDeps(4.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A0)
    // Advance only 100 ms (< 200 ms debounce) — second tap must no-op.
    audio.advance((TAP_DEBOUNCE_MS / 2) / 1000)
    engine.tapLoop(DRUM_A0)

    expect(rampsFor(audio.ramps, DRUM_A0).length).toBe(1)
  })

  it('accepts second tap on the same pad past TAP_DEBOUNCE_MS', () => {
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + EIGHT_BAR_DURATION)
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A0)
    // Past debounce + still in active state → second tap is a toggle-off.
    audio.advance((TAP_DEBOUNCE_MS + 50) / 1000)
    engine.tapLoop(DRUM_A0)

    // Two ramps total: fade-in from first tap + fade-out from toggle-off.
    expect(rampsFor(audio.ramps, DRUM_A0).length).toBe(2)
  })
})

describe('engine — cross-bank isolation', () => {
  it('per-block lockout does NOT cross banks (A-block-0 vs B-block-0)', () => {
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + EIGHT_BAR_DURATION)
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    // B-block-0-0 is the SAME blockId as DRUM_A0 but different bank.
    // Lockout must not fire because banks are independent surfaces.
    engine.tapLoop('B-block-0-0')

    expect(rampsFor(audio.ramps, DRUM_A0).length).toBe(0)
    const incoming = rampsFor(audio.ramps, 'B-block-0-0')[0]
    expect(incoming).toBeDefined()
    expect(incoming!.from).toBe(0)
    expect(incoming!.to).toBe(1)
  })
})

describe('engine — re-tap during in-flight deactivate', () => {
  // The bug we're guarding against: deactivate scheduled a future 1 → 0
  // ramp at the outgoing iteration end. A naive re-tap (= calling
  // deactivate again) doesn't cancel that pending ramp, so the loop
  // dies even though the player re-engaged it. The fix is
  // `cancelGainRamps(padId, ctxNow)` plus a sentinel identity ramp
  // (1 → 1) that re-anchors the gain at full and overrides any prior
  // automation events.
  it('re-tap during pending-removal CANCELS the fade-out and re-engages the loop', () => {
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + EIGHT_BAR_DURATION)
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(10.0)
    const engine = createPadGridEngine(deps)

    engine.tapLoop(DRUM_A0) // toggle-off → schedules 1→0 at iteration end
    audio.advance(0.5)
    engine.tapLoop(DRUM_A0) // re-engage → must cancel + identity-ramp

    // cancelGainRamps must have been called for this pad.
    expect(deps.cancelGainRamps).toHaveBeenCalledWith(DRUM_A0, expect.any(Number))

    // No SECOND fade-out was scheduled (the original 1→0 from the first
    // tap is still in the ramp log but cancelled in-flight).
    const fadeOuts = rampsFor(audio.ramps, DRUM_A0).filter(
      (r) => r.from === 1 && r.to === 0,
    )
    expect(fadeOuts.length).toBe(1)

    // An identity 1→1 ramp marks the re-engagement (the gain never
    // dropped — re-engagement is "stay at 1", not "fade up from 0").
    const identity = rampsFor(audio.ramps, DRUM_A0).find(
      (r) => r.from === 1 && r.to === 1,
    )
    expect(identity).toBeDefined()

    // Pad stays in activePadIds (no pending-removal will pop it).
    expect(usePadGridStore.getState().activePadIds).toContain(DRUM_A0)
  })
})

describe('engine — re-tap during in-flight same-block swap', () => {
  // Per-block lockout invariant: at most ONE looping variant in a block
  // plays at full volume at a time. When user taps A→B (B queued to
  // take over), then re-taps A before swapAt fires, the cancellation
  // must back out BOTH A's fade-out AND B's pending fade-in — otherwise
  // both end up at gain 1 simultaneously.
  it('re-tapping outgoing during swap also cancels the incoming pad', () => {
    mocks.anchor = 4.18
    mocks.bufferDurations.set(DRUM_A0, EIGHT_BAR_DURATION)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    // Tap the same-block variant — schedules a swap.
    engine.tapLoop(DRUM_A1)
    audio.advance(0.3)
    // Re-tap original — should undo the swap entirely.
    engine.tapLoop(DRUM_A0)

    // cancelGainRamps must have been called for BOTH pads.
    expect(deps.cancelGainRamps).toHaveBeenCalledWith(DRUM_A0, expect.any(Number))
    expect(deps.cancelGainRamps).toHaveBeenCalledWith(DRUM_A1, expect.any(Number))

    // After cancellation, only DRUM_A0 stays in activePadIds.
    const state = usePadGridStore.getState()
    expect(state.activePadIds).toContain(DRUM_A0)
    expect(state.activePadIds).not.toContain(DRUM_A1)
  })
})

describe('engine — re-tap one-shot before its tail settles', () => {
  it('drops the prior pending-removal so the old auto-remove does not cut the new ring-out', () => {
    // Engine drops pendingRemovals for the pad when re-tapped — verify by
    // forcing tick() at the OLD removeAfter and confirming the pad is still
    // active (because the new firing window extends past it).
    const { deps, audio } = makeDeps(4.0)
    const engine = createPadGridEngine(deps)
    mocks.bufferDurations.set(FILL_A0, 1.0)

    engine.tapOneShot(FILL_A0)
    const firstFadeOut = audio.ramps.find(
      (r) => r.padId === FILL_A0 && r.from === 1 && r.to === 0,
    )
    expect(firstFadeOut).toBeDefined()
    const firstRemoveAfter = firstFadeOut!.endAt

    // Past debounce, second tap before first window ends.
    audio.advance((TAP_DEBOUNCE_MS + 50) / 1000)
    engine.tapOneShot(FILL_A0)

    // Tick at the FIRST removeAfter — pad must still be active because
    // the second tap restarted the firing window.
    engine.tick(firstRemoveAfter + 0.001)
    expect(usePadGridStore.getState().activePadIds).toContain(FILL_A0)
  })
})

describe('engine — first tap with NO active loops but mid-deactivate ghost', () => {
  // After deactivating every loop, pads stay in activePadIds until tick()
  // runs (so the UI keeps the cell bright through the tail fade). During
  // that window, isFirstTap (= activePadIds.length === 0) is FALSE, so the
  // engine takes the cross-block path with the existing anchor. Verify
  // the tap lands on the anchor's bar grid (i.e. is musically synchronised
  // with the still-fading-out groove).
  it('cross-block tap during a pending-removal window aligns to the existing anchor', () => {
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + SECONDS_PER_BAR)
    mocks.bufferDurations.set(DRUM_A0, SECONDS_PER_BAR)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps, audio } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    // Toggle drums off (still in activePadIds during fade).
    engine.tapLoop(DRUM_A0)
    expect(usePadGridStore.getState().activePadIds).toContain(DRUM_A0)

    // Tap a cross-block pad before the drums tick out.
    audio.advance(0.5) // ctx 5.5
    engine.tapLoop(BASS_A0)

    const r = rampsFor(audio.ramps, BASS_A0)[0]!
    // Must align to the anchor grid (4.18 + N · bar), not be immediate.
    const offset = r.startAt - 4.18
    const cycles = offset / SECONDS_PER_BAR
    expect(cycles - Math.round(cycles)).toBeCloseTo(0, 5)
  })
})

describe('engine.tick — pending-removal cleanup', () => {
  it('removes settled pads from activePadIds at or past their fade-out end', () => {
    // Set up a deactivate so a pendingRemovals entry is queued, then tick
    // past the removal time.
    mocks.anchor = 4.18
    mocks.loopEnds.set(DRUM_A0, 4.18 + SECONDS_PER_BAR)
    mocks.bufferDurations.set(DRUM_A0, SECONDS_PER_BAR)
    usePadGridStore.setState({ activePadIds: [DRUM_A0], latchedPadIds: [DRUM_A0] })

    const { deps } = makeDeps(5.0)
    const engine = createPadGridEngine(deps)

    engine.deactivate(DRUM_A0)
    expect(usePadGridStore.getState().activePadIds).toContain(DRUM_A0)

    // Tick at fade-out end + small epsilon.
    engine.tick(4.18 + SECONDS_PER_BAR + BAR_CROSSFADE_SECONDS + 0.01)

    expect(usePadGridStore.getState().activePadIds).not.toContain(DRUM_A0)
    expect(usePadGridStore.getState().latchedPadIds).not.toContain(DRUM_A0)
  })
})
