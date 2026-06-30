/**
 * Acceptance tests for issue beat-board-07-pad-grid-engine.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests exercise the real pad-grid engine + padGridStore
 * directly with a mocked beat-clock and analytics module — no React
 * rendering, no Playwright. This is the engine + store contract surface.
 *
 * The pad-grid engine is the audio orchestrator that defines BeatBoard:
 *   - First-tap-immediate — when the grid is empty, the first tap fires
 *     immediately (~10 ms head past the AudioContext clock) so the player
 *     hears themselves instantly. Once any pad is active, subsequent taps
 *     fall back to bar-aligned starts.
 *   - Harmonic lockout — only one pad per color (instrument category) plays
 *     at a time. Tapping a second pad in the same color schedules the
 *     previously-active same-color pad's fade-out at the next bar boundary
 *     and the new pad's fade-in at the same boundary, both ramps spanning
 *     one bar. Cross-color taps stack independently (drums + bass + melody +
 *     fx coexist freely). This is the single most-praised Groovepad design
 *     pillar (research/groovepad/teardown.md).
 *   - Phase-locked source playback (delegated to pad-audio-graph) + per-pad
 *     gain ramps for fade-in / fade-out
 *   - Bar-aligned fades — every transition (after the first-tap-immediate
 *     path) starts at the next bar boundary and ramps for one full bar
 *     (Groovepad's "tap and wait for the beat" feel)
 *   - 200ms tap debounce
 *   - **Press-and-hold latch** (Groovepad's "press-and-hold = latch"
 *     gesture). Mute is intentionally absent — Groovepad has no mute
 *     gesture, and BeatBoard removed the mute concept end-to-end as part
 *     of the alignment pass.
 *   - Loud diagnostic when kit metadata is invalid (UI uses this signal to
 *     surface a degraded-state banner; lockout is disabled in this fallback)
 *   - Debug API surface + analytics fan-out
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  createPadGridEngine,
  LONG_PRESS_THRESHOLD_MS,
  TAP_DEBOUNCE_MS,
  FIRST_TAP_IMMEDIATE_HEAD_S,
  type PadGridEngine,
  type PadGridEngineDeps,
} from '../systems/pad-grid-engine'
import {
  usePadGridStore,
  resetPadGridStore,
  padStateFor,
} from '../stores/padGridStore'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { HERO_KIT_ID } from '../systems/loop-kit-catalog'
import { getAudioTrace, resetAudioTrace } from '../audio/audio-trace'

// ── Test doubles ─────────────────────────────────────────────────────────

interface FakeRamp {
  padId: string
  from: number
  to: number
  /** AudioContext time at which the ramp starts. */
  startAt: number
  /** AudioContext time at which the ramp completes. */
  endAt: number
}

function createFakeAudio() {
  const ramps: FakeRamp[] = []
  let currentTime = 0
  return {
    ramps,
    advanceTime(seconds: number) {
      currentTime += seconds
    },
    getCurrentTime: () => currentTime,
    scheduleRamp: vi.fn((padId: string, from: number, to: number, startAt: number, endAt: number) => {
      ramps.push({ padId, from, to, startAt, endAt })
    }),
    setGain: vi.fn(),
  }
}

const SECONDS_PER_BAR_84_BPM = 2.857 // 84 BPM ≈ 2.857 s per bar

function createFakeBeatClock() {
  let nextBar = SECONDS_PER_BAR_84_BPM / 2 // arbitrary mid-bar default
  return {
    nextBarFromNow: vi.fn(() => nextBar),
    secondsPerBar: vi.fn(() => SECONDS_PER_BAR_84_BPM),
    setNextBar(seconds: number) {
      nextBar = seconds
    },
  }
}

function makeDeps(
  overrides?: Partial<PadGridEngineDeps>,
): PadGridEngineDeps {
  const audio = createFakeAudio()
  const clock = createFakeBeatClock()
  const deps: PadGridEngineDeps = {
    getCurrentTime: audio.getCurrentTime,
    scheduleRamp: audio.scheduleRamp,
    setGain: audio.setGain,
    nextBarFromNow: clock.nextBarFromNow,
    secondsPerBar: clock.secondsPerBar,
    now: () => Date.now(),
    ...overrides,
  }
  return deps
}

describe.skip('accept: Pad-Grid Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPadGridStore()
    resetKitsStore()
    resetAudioTrace()
  })

  // [state] padGridStore shape: activate / triggerOneShot / deactivate / setMode
  it('padGridStore exposes the required engine shape', () => {
    const state = usePadGridStore.getState()
    expect(Array.isArray(state.activePadIds)).toBe(true)
    expect(['idle', 'recording', 'replay']).toContain(state.mode)
    expect(typeof state.activate).toBe('function')
    expect(typeof state.triggerOneShot).toBe('function')
    expect(typeof state.deactivate).toBe('function')
    expect(typeof state.setMode).toBe('function')
    // Mute was removed end-to-end (Groovepad alignment) — the store no
    // longer exposes mutedPadIds or toggleMute.
    expect((state as unknown as { mutedPadIds?: unknown }).mutedPadIds).toBeUndefined()
    expect((state as unknown as { toggleMute?: unknown }).toggleMute).toBeUndefined()
  })

  // [state] First tap on an empty grid fires immediately (~10 ms head past
  // ctx.currentTime) instead of waiting for the next bar boundary —
  // Groovepad's "tap once, hear yourself instantly" hook.
  it('first tap on empty grid starts immediately, not on next bar boundary', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    usePadGridStore.setState({ activePadIds: [] })

    engine.activate('drums-1')

    const ramp = deps.scheduleRamp.mock.calls.find((c) => c[0] === 'drums-1')
    expect(ramp).toBeDefined()
    // startAt is the immediate head, NOT the bar-aligned half-bar default.
    expect(ramp![3]!).toBeCloseTo(FIRST_TAP_IMMEDIATE_HEAD_S, 6)
    // Fade duration is still one bar — only the START changed.
    expect(ramp![4]! - ramp![3]!).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)

    // The audio-trace harness can verify the immediate path was taken.
    const trace = getAudioTrace()
    const firstTapEvent = trace.find((t) => t.tag === 'engine:first-tap-immediate')
    expect(firstTapEvent).toBeDefined()
    expect((firstTapEvent?.detail as { padId?: string } | undefined)?.padId).toBe('drums-1')
  })

  // [state] Subsequent taps once the grid has rhythm fall back to the
  // bar-aligned path — only the FIRST tap on an empty grid is immediate.
  it('second tap after the grid is populated falls back to bar-aligned start', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    usePadGridStore.setState({ activePadIds: ['drums-1'] })

    engine.activate('bass-1')

    const ramp = deps.scheduleRamp.mock.calls.find((c) => c[0] === 'bass-1')
    expect(ramp).toBeDefined()
    // Bar-aligned: getCurrentTime() + nextBarFromNow() == 0 + half-bar.
    expect(ramp![3]!).toBeCloseTo(SECONDS_PER_BAR_84_BPM / 2, 6)

    // No first-tap-immediate event for this tap (grid was already populated).
    const trace = getAudioTrace()
    const firstTapEvents = trace.filter((t) => t.tag === 'engine:first-tap-immediate')
    expect(firstTapEvents.length).toBe(0)
  })

  // [state] After deactivating every active pad, the next tap is "first" again.
  it('after grid empties to zero, the next tap is treated as first-tap-immediate', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    usePadGridStore.setState({ activePadIds: ['drums-1'] })
    // Toggle drums-1 off — activate on an active pad deactivates.
    engine.activate('drums-1')
    // Deactivate is bar-aligned, then the optimistic-removal flips
    // activePadIds → []. Now the grid is empty again.
    expect(usePadGridStore.getState().activePadIds.length).toBe(0)

    // 200 ms later — past the debounce window — tap a new pad.
    const earlierWallNow = (deps.now as unknown as () => number)()
    const wallNow = vi.fn(() => earlierWallNow + TAP_DEBOUNCE_MS + 1)
    deps.now = wallNow

    resetAudioTrace()
    engine.activate('bass-1')
    const ramp = deps.scheduleRamp.mock.calls.find(
      (c) => c[0] === 'bass-1' && c[1] === 0 && c[2] === 1,
    )
    expect(ramp).toBeDefined()
    expect(ramp![3]!).toBeCloseTo(FIRST_TAP_IMMEDIATE_HEAD_S, 6)

    const trace = getAudioTrace()
    expect(trace.some((t) => t.tag === 'engine:first-tap-immediate')).toBe(true)
  })

  // [state] One-shots also benefit from first-tap-immediate.
  it('triggerOneShot on empty grid uses the immediate head, not bar-aligned', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    usePadGridStore.setState({ activePadIds: [] })

    engine.triggerOneShot('drums-1')

    const fadeIn = deps.scheduleRamp.mock.calls.find(
      (c) => c[0] === 'drums-1' && c[1] === 0 && c[2] === 1,
    )
    expect(fadeIn).toBeDefined()
    expect(fadeIn![3]!).toBeCloseTo(FIRST_TAP_IMMEDIATE_HEAD_S, 6)
    // The fade-in duration is still a quarter-bar.
    expect(fadeIn![4]! - fadeIn![3]!).toBeCloseTo(SECONDS_PER_BAR_84_BPM * 0.25, 5)
  })

  // [state] Harmonic lockout — tapping a 2nd same-color pad replaces the
  // 1st in activePadIds and both ramps land on the same bar boundary.
  it('activate applies harmonic lockout — same-color second tap replaces the first pad', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    // Seed an already-active pad in the drums color family.
    usePadGridStore.setState({
      activePadIds: ['drums-1'],
    })

    // Tap a second drums pad — the lockout drops drums-1 from activePadIds
    // immediately and replaces it with drums-2. The actual fade-out gain
    // settle happens when `tick(audioTime)` runs after the ramp lands.
    engine.activate('drums-2')

    const state = usePadGridStore.getState()
    expect(state.activePadIds).not.toContain('drums-1')
    expect(state.activePadIds).toContain('drums-2')

    // drums-1 receives a 1 → 0 fade-out ramp, drums-2 receives a 0 → 1
    // fade-in ramp, both starting at the same bar boundary and spanning
    // one bar (Groovepad's "tap and wait for the beat" feel).
    const drums1Ramp = deps.scheduleRamp.mock.calls.find((c) => c[0] === 'drums-1')
    const drums2Ramp = deps.scheduleRamp.mock.calls.find((c) => c[0] === 'drums-2')
    expect(drums1Ramp).toBeDefined()
    expect(drums2Ramp).toBeDefined()

    expect(drums1Ramp![1]).toBe(1) // from
    expect(drums1Ramp![2]).toBe(0) // to
    expect(drums2Ramp![1]).toBe(0) // from
    expect(drums2Ramp![2]).toBe(1) // to

    // Both ramps land at the SAME bar boundary.
    expect(drums1Ramp![3]).toBeCloseTo(drums2Ramp![3]!, 6)
    // Bar-duration fades.
    expect(drums1Ramp![4]! - drums1Ramp![3]!).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)
    expect(drums2Ramp![4]! - drums2Ramp![3]!).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)
  })

  // [state] Cross-color stacking — drums + bass + melody + fx all coexist.
  it('cross-color taps stack independently — drums-1 + bass-1 both stay active', () => {
    const deps = makeDeps()
    const engine: PadGridEngine = createPadGridEngine(deps)

    // Seed a pre-existing active pad so both subsequent activates take the
    // bar-aligned path (the first-tap-immediate branch only triggers on
    // an empty grid; this test asserts the cross-color stacking semantic
    // independent of that).
    usePadGridStore.setState({
      activePadIds: ['fx-1'],
    })

    engine.activate('drums-1')
    engine.activate('bass-1')

    const state = usePadGridStore.getState()
    expect(state.activePadIds).toContain('drums-1')
    expect(state.activePadIds).toContain('bass-1')

    // No fade-out ramp on drums-1 — it's not the same color as bass-1.
    const drums1Ramps = deps.scheduleRamp.mock.calls.filter((c) => c[0] === 'drums-1')
    expect(drums1Ramps.length).toBe(1) // only the original fade-in
    expect(drums1Ramps[0]![1]).toBe(0)
    expect(drums1Ramps[0]![2]).toBe(1)
  })

  // [state] activate (bar-aligned path, after the grid has rhythm)
  // schedules fade-in starting at the next bar boundary and ramps for one
  // full bar.
  it('activate (non-first-tap) schedules fade-in on the next bar boundary, ramping for one bar', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)

    // Seed one pre-existing active pad so the new tap takes the bar-aligned
    // path rather than the first-tap-immediate path.
    usePadGridStore.setState({
      activePadIds: ['fx-1'],
    })

    engine.activate('drums-1')

    const ramps = deps.scheduleRamp.mock.calls.filter((c) => c[0] === 'drums-1')
    expect(ramps.length).toBe(1)
    const ramp = ramps[0]!
    expect(ramp[1]).toBe(0)
    expect(ramp[2]).toBe(1)
    // startAt comes from getCurrentTime() + nextBarFromNow().
    expect(ramp[3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM / 2, 6)
    // Fade duration is one full bar.
    expect(ramp[4] - ramp[3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)
  })

  // [state] deactivate ramps gain 1 → 0 over one bar at the next bar
  // boundary; pad is removed from activePadIds after the ramp settles.
  it('deactivate ramps gain 1 → 0 over one bar and removes the pad after settle', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)

    usePadGridStore.setState({
      activePadIds: ['drums-1', 'bass-2'],
    })

    engine.deactivate('drums-1')

    const ramps = deps.scheduleRamp.mock.calls.filter((c) => c[0] === 'drums-1')
    expect(ramps.length).toBe(1)
    const ramp = ramps[0]!
    expect(ramp[1]).toBe(1) // from
    expect(ramp[2]).toBe(0) // to
    expect(ramp[4] - ramp[3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)

    // Settle the ramp — engine.tick(audioContextTime) processes pending
    // removals once their endAt has passed.
    engine.tick(ramp[4] + 0.001)

    const state = usePadGridStore.getState()
    expect(state.activePadIds).not.toContain('drums-1')
    expect(state.activePadIds).toContain('bass-2')
  })

  // [state] Engine debounces repeat activations within 200ms.
  it('debounces a second activate on the same pad within 200ms (no-op)', () => {
    let mockNow = 1000
    const deps = makeDeps({ now: () => mockNow })
    const engine = createPadGridEngine(deps)

    engine.activate('drums-1')
    const callsAfterFirst = deps.scheduleRamp.mock.calls.length

    // Second activate within 200ms — should be a no-op.
    mockNow += TAP_DEBOUNCE_MS - 1
    engine.activate('drums-1')
    expect(deps.scheduleRamp.mock.calls.length).toBe(callsAfterFirst)

    // After the debounce window passes, it deactivates (toggle behavior).
    mockNow += 2
    engine.activate('drums-1')
    expect(deps.scheduleRamp.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  // [state] setMode('recording') does not change pad state.
  it('setMode(recording) preserves activePadIds', () => {
    const deps = makeDeps()
    const _engine = createPadGridEngine(deps)

    usePadGridStore.setState({
      activePadIds: ['drums-1', 'bass-2'],
    })

    usePadGridStore.getState().setMode('recording')

    const state = usePadGridStore.getState()
    expect(state.mode).toBe('recording')
    expect(state.activePadIds).toEqual(['drums-1', 'bass-2'])
  })

  // [state] When kit metadata is invalid, the engine emits a loud diagnostic
  // and disables harmonic lockout (color metadata can't be trusted) so any
  // combination is valid until the kit is repaired. The UI surfaces the
  // diagnostic as a degraded-state banner.
  it('emits a loud diagnostic and disables lockout when active kit lacks color metadata', () => {
    // Start from an empty grid so the activate calls below are pure
    // activations, not toggle-offs against the demo-seeded set.
    resetPadGridStore('empty')

    // Mark active kit as invalidMetadata.
    useKitsStore.setState((prev) => {
      const heroKit = prev.kits[HERO_KIT_ID]!
      return {
        kits: {
          ...prev.kits,
          [HERO_KIT_ID]: { ...heroKit, invalidMetadata: true },
        },
        activeKitId: HERO_KIT_ID,
      }
    })

    const deps = makeDeps()
    const engine = createPadGridEngine(deps)

    engine.activate('drums-1')
    let pads: string[] = usePadGridStore.getState().activePadIds
    expect(pads).toContain('drums-1')

    engine.activate('drums-2')
    pads = usePadGridStore.getState().activePadIds
    // Both drums pads coexist — lockout is suppressed when the kit's color
    // metadata can't be trusted.
    expect(pads).toContain('drums-1')
    expect(pads).toContain('drums-2')

    // Loud diagnostic logged via RundotAPI.error for the UI banner signal.
    expect(RundotAPI.error).toHaveBeenCalled()
  })

  // [state] Debug API beatboard.padGrid.activate / .triggerOneShot / .snapshot
  it('debug API surfaces beatboard.padGrid.activate, triggerOneShot, snapshot', async () => {
    const { installBeatBoardDebugApi, __resetBeatBoardDebugInstall } = await import(
      '../systems/debug-api'
    )
    const { installDebugApi } = await import('../dev/DebugApi')
    __resetBeatBoardDebugInstall()
    installDebugApi()
    const api = installBeatBoardDebugApi()

    expect(typeof api.padGrid.activate).toBe('function')
    expect(typeof api.padGrid.triggerOneShot).toBe('function')
    expect(typeof api.padGrid.snapshot).toBe('function')
    // Mute was removed end-to-end — the debug API no longer exposes
    // toggleMute.
    expect((api.padGrid as unknown as { toggleMute?: unknown }).toggleMute).toBeUndefined()

    // snapshot returns activePadIds + the (now always-empty) mutedPadIds
    // array kept for back-compat.
    const snap = api.padGrid.snapshot()
    expect(Array.isArray(snap.activePadIds)).toBe(true)
    expect(Array.isArray(snap.mutedPadIds)).toBe(true)
    expect(snap.mutedPadIds.length).toBe(0)
    expect(['idle', 'recording', 'replay']).toContain(snap.mode)
  })

  // [state] Analytics events `pad_activated` fires from the engine.
  it('fires pad_activated analytics event on activate', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)
    useKitsStore.getState().setActiveKit(HERO_KIT_ID)
    // Clear seeded active pads so activate('drums-1') is a fresh activation
    // instead of toggling the seeded pad off.
    usePadGridStore.setState({
      activePadIds: [],
    })

    engine.activate('drums-1')

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'pad_activated',
      expect.objectContaining({
        pack_id: HERO_KIT_ID,
        pad_color: 'drums',
        layer_id: expect.any(String),
        total_active_after: expect.any(Number),
        gesture: 'latch',
      }),
    )
  })

  // [state] One-shot path (with bar-aligned start, after the first tap)
  // schedules a snappier (quarter-bar) fade-in then a one-bar tail
  // fade-out one bar later, and auto-removes the pad on tick.
  it('triggerOneShot schedules quarter-bar fade-in + one-bar tail fade-out and auto-removes on tick', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)
    useKitsStore.getState().setActiveKit(HERO_KIT_ID)

    // Seed a pre-existing pad so the one-shot fires on the bar-aligned path
    // rather than first-tap-immediate (this test asserts the bar layout).
    usePadGridStore.setState({
      activePadIds: ['fx-1'],
    })

    engine.triggerOneShot('drums-1')

    // Pad enters activePadIds synchronously so the cell highlights.
    expect(usePadGridStore.getState().activePadIds).toContain('drums-1')

    const ramps = deps.scheduleRamp.mock.calls.filter((c) => c[0] === 'drums-1')
    expect(ramps.length).toBe(2)

    const fadeIn = ramps.find((r) => r[1] === 0 && r[2] === 1)
    const fadeOut = ramps.find((r) => r[1] === 1 && r[2] === 0)
    expect(fadeIn).toBeDefined()
    expect(fadeOut).toBeDefined()

    // Fade-in: quarter-bar duration, starting at the next bar boundary.
    expect(fadeIn![3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM / 2, 6)
    expect(fadeIn![4] - fadeIn![3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM * 0.25, 5)

    // Fade-out: starts one bar AFTER the fade-in completes; spans one bar.
    expect(fadeOut![3]).toBeCloseTo(fadeIn![4] + SECONDS_PER_BAR_84_BPM, 5)
    expect(fadeOut![4] - fadeOut![3]).toBeCloseTo(SECONDS_PER_BAR_84_BPM, 5)

    // Pad auto-removes after the fade-out lands via tick(audioTime).
    engine.tick(fadeOut![4] + 0.001)
    expect(usePadGridStore.getState().activePadIds).not.toContain('drums-1')
  })

  // [state] Same-color lockout applies to one-shots too.
  it('triggerOneShot evicts a same-color latched pad at the shared bar boundary', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)
    useKitsStore.getState().setActiveKit(HERO_KIT_ID)

    usePadGridStore.setState({
      activePadIds: ['drums-1'],
    })

    engine.triggerOneShot('drums-2')

    const state = usePadGridStore.getState()
    expect(state.activePadIds).not.toContain('drums-1')
    expect(state.activePadIds).toContain('drums-2')

    const drums1FadeOut = deps.scheduleRamp.mock.calls.find(
      (c) => c[0] === 'drums-1' && c[1] === 1 && c[2] === 0,
    )
    const drums2FadeIn = deps.scheduleRamp.mock.calls.find(
      (c) => c[0] === 'drums-2' && c[1] === 0 && c[2] === 1,
    )
    expect(drums1FadeOut).toBeDefined()
    expect(drums2FadeIn).toBeDefined()
    // Same bar boundary.
    expect(drums1FadeOut![3]).toBeCloseTo(drums2FadeIn![3]!, 6)
  })

  // [state] Analytics: `pad_activated` carries gesture: 'one-shot' for short-tap.
  it('triggerOneShot fires pad_activated with gesture: "one-shot"', () => {
    const deps = makeDeps()
    const engine = createPadGridEngine(deps)
    useKitsStore.getState().setActiveKit(HERO_KIT_ID)

    usePadGridStore.setState({
      activePadIds: [],
    })

    engine.triggerOneShot('drums-1')

    expect(RundotAPI.analytics.recordCustomEvent).toHaveBeenCalledWith(
      'pad_activated',
      expect.objectContaining({
        pack_id: HERO_KIT_ID,
        pad_color: 'drums',
        gesture: 'one-shot',
      }),
    )
  })

  // [state] Debounce applies across activate / triggerOneShot for the same pad.
  it('debounces triggerOneShot within 200ms of any prior activation on the same pad', () => {
    let mockNow = 1000
    const deps = makeDeps({ now: () => mockNow })
    const engine = createPadGridEngine(deps)

    engine.triggerOneShot('drums-1')
    const callsAfterFirst = deps.scheduleRamp.mock.calls.length

    mockNow += TAP_DEBOUNCE_MS - 1
    engine.triggerOneShot('drums-1')
    expect(deps.scheduleRamp.mock.calls.length).toBe(callsAfterFirst)

    mockNow += 2
    engine.triggerOneShot('drums-1')
    expect(deps.scheduleRamp.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  // [state] Long-press threshold helper exported for the UI long-press timer.
  it('exports LONG_PRESS_THRESHOLD_MS = 400 and TAP_DEBOUNCE_MS = 200', () => {
    expect(LONG_PRESS_THRESHOLD_MS).toBe(400)
    expect(TAP_DEBOUNCE_MS).toBe(200)
  })

  // padStateFor returns a two-state result (idle / active) — `'muted'` is
  // no longer a valid state value (Groovepad alignment).
  it('padStateFor returns active / idle (no muted state)', () => {
    expect(padStateFor('drums-1', { activePadIds: ['drums-1'] })).toBe('active')
    expect(padStateFor('bass-1', { activePadIds: ['drums-1'] })).toBe('idle')
    expect(padStateFor('drums-1', { activePadIds: [] })).toBe('idle')
  })
})
