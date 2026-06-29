/**
 * Test — `src/audio/pad-audio-graph.ts`
 *
 * The pad audio graph owns the phase-locked per-pad source pool the Pad-Grid
 * Engine schedules ramps against. This spec drives the singleton with an
 * injectable AudioContext stub (jsdom has no Web Audio) and asserts:
 *
 *   - `registerPadBuffer(padId, url)` fetches + decodes the buffer once,
 *     installs a looping `AudioBufferSourceNode`, and starts it at the
 *     shared kit-start time.
 *   - All pads registered in the same kit share `source.start(startAt)` so
 *     loops are phase-locked.
 *   - `scheduleRamp(padId, from, to, startAt, endAt)` only schedules a gain
 *     ramp on the per-pad gain param — sources stay alive for the kit's
 *     lifetime.
 *   - `setGain(padId, value)` writes immediately via `setValueAtTime`.
 *   - `disposePad` / `disposeAll` tear down sources + gains cleanly.
 *   - `disposeAll` resets the kit-start clock so the next kit picks up a
 *     fresh phase anchor.
 *   - When the master graph isn't ready, the graph no-ops loudly via
 *     `RundotAPI.error` instead of crashing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setAudioContextCtor,
  __resetAudioMaster,
  initAudioMaster,
} from './audio-master'
import {
  __resetPadAudioGraph,
  __setFetchImpl,
  getPadAudioGraph,
  getKitPhaseAnchor,
  setKitPhaseAnchor,
  nextBarFromKitAnchor,
  reinstallAllSourcesAfterResumeReturning,
  restartPadSource,
  getPadPeakSamples,
} from './pad-audio-graph'
import { __resetFxBus } from './fx-bus'

// ── Fake Web Audio plumbing ──────────────────────────────────────────────

interface FakeAudioParam {
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
  value: number
}

interface FakeGainNode {
  gain: FakeAudioParam
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

interface FakeBufferSource {
  buffer: { duration: number } | null
  loop: boolean
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

interface FakeContext {
  destination: { id: string }
  currentTime: number
  state: 'running' | 'suspended' | 'closed'
  createGain: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  createMediaStreamDestination: () => { stream: { id: string }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
  decodeAudioData: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  __sources: FakeBufferSource[]
  __gains: FakeGainNode[]
}

function makeFakeParam(initialValue = 1): FakeAudioParam {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

function makeFakeGain(): FakeGainNode {
  return {
    gain: makeFakeParam(0),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

function makeFakeBufferSource(): FakeBufferSource {
  return {
    buffer: null,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

function makeFakeContext(): FakeContext {
  const sources: FakeBufferSource[] = []
  const gains: FakeGainNode[] = []
  const ctx: FakeContext = {
    destination: { id: 'dest' },
    currentTime: 0,
    state: 'running',
    createGain: vi.fn(() => {
      const g = makeFakeGain()
      gains.push(g)
      return g
    }),
    createBufferSource: vi.fn(() => {
      const s = makeFakeBufferSource()
      sources.push(s)
      return s
    }),
    createMediaStreamDestination: () => ({
      stream: { id: 'stream-1' },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn(async (_data: ArrayBuffer) => ({ duration: 2 })),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    __sources: sources,
    __gains: gains,
  }
  return ctx
}

let fakeCtx: FakeContext
let fakeContexts: FakeContext[] = []

function FakeAudioContextCtor(): FakeContext {
  fakeCtx = makeFakeContext()
  fakeContexts.push(fakeCtx)
  return fakeCtx
}

beforeEach(() => {
  fakeContexts = []
  __resetAudioMaster()
  __resetPadAudioGraph()
  __resetFxBus()
  __setAudioContextCtor(FakeAudioContextCtor as unknown as typeof AudioContext)
  __setFetchImpl(async () => new ArrayBuffer(8))
})

afterEach(() => {
  __setFetchImpl(null)
  __setAudioContextCtor(null)
  __resetPadAudioGraph()
  __resetFxBus()
  __resetAudioMaster()
})

describe('pad-audio-graph singleton', () => {
  it('returns the same instance across calls (binding to audio-master)', () => {
    initAudioMaster()
    const a = getPadAudioGraph()
    const b = getPadAudioGraph()
    expect(a).toBe(b)
  })
})

describe('registerPadBuffer()', () => {
  it('fetches, decodes, and caches the buffer under padId', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'cdn-assets/kits/x/drums-1.wav')
    expect(fakeCtx.decodeAudioData).toHaveBeenCalledTimes(1)
  })

  it('creates a per-pad GainNode wired through dryGain into masterGain on first register', async () => {
    const master = initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')
    // After buildEntry: gain → dryGain → master, gain → wetGain → fxBus.
    // The pad audibility gain is the first gain created in buildEntry; its
    // dryGain connects to master.
    const masterGain = master.masterGain
    const dryGain = fakeCtx.__gains.find((g) =>
      g.connect.mock.calls.some((c) => c[0] === masterGain),
    )
    expect(dryGain).toBeTruthy()
  })

  it('builds dry and wet sends per pad — wetGain initialised to 0', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    const gainCountBefore = fakeCtx.__gains.length
    await graph.registerPadBuffer('drums-1', 'url')
    // buildEntry creates: gain + dryGain + wetGain = +3 gains.
    expect(fakeCtx.__gains.length).toBeGreaterThanOrEqual(gainCountBefore + 3)
    const snap = (await import('./pad-audio-graph')).getPadAudioGraphSnapshot()
    const drums1 = snap.pads.find((p) => p.padId === 'drums-1')
    expect(drums1).toBeTruthy()
    expect(drums1!.wetGainValue).toBe(0)
  })

  it('installs a looping AudioBufferSourceNode and starts it at kit-start', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    // Source created during registration, not lazily on the first ramp.
    expect(fakeCtx.__sources.length).toBe(1)
    const src = fakeCtx.__sources[0]!
    expect(src.loop).toBe(true)
    expect(src.start).toHaveBeenCalledTimes(1)
  })

  it('phase-locks every pad in the same kit to a single start time', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()

    await graph.registerPadBuffer('drums-1', 'url-a')
    await graph.registerPadBuffer('bass-1', 'url-b')
    await graph.registerPadBuffer('melody-1', 'url-c')

    // Three sources, each `start(startAt)` invoked with the SAME timestamp.
    expect(fakeCtx.__sources.length).toBe(3)
    const startAtTimes = fakeCtx.__sources.map(
      (s) => s.start.mock.calls[0]![0] as number,
    )
    expect(startAtTimes[0]).toBeGreaterThan(0)
    for (const t of startAtTimes) {
      expect(t).toBe(startAtTimes[0])
    }
  })

  it('replaces the buffer and re-installs a phase-locked source on re-register (kit-internal swap)', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url-a')
    await graph.registerPadBuffer('drums-1', 'url-b')
    // decodeAudioData fired twice — the second registration replaced the
    // cached buffer rather than short-circuiting.
    expect(fakeCtx.decodeAudioData).toHaveBeenCalledTimes(2)
    // First source was stopped and a fresh source installed.
    expect(fakeCtx.__sources.length).toBe(2)
    expect(fakeCtx.__sources[0]!.stop).toHaveBeenCalled()
    expect(fakeCtx.__sources[1]!.start).toHaveBeenCalled()
  })

  it('logs and skips the pad on fetch failure (does not crash)', async () => {
    initAudioMaster()
    __setFetchImpl(async () => {
      throw new Error('404 not found')
    })
    const graph = getPadAudioGraph()
    // Must not throw — defensive contract for missing assets.
    await expect(graph.registerPadBuffer('drums-1', 'url')).resolves.toBeUndefined()
    expect(fakeCtx.decodeAudioData).not.toHaveBeenCalled()
    // No source installed when the fetch never produced bytes.
    expect(fakeCtx.__sources.length).toBe(0)
  })

  it('wires decoded buffers into the live AudioContext when the master resets mid-load', async () => {
    initAudioMaster()
    const firstCtx = fakeCtx
    let releaseFetch!: (buffer: ArrayBuffer) => void
    __setFetchImpl(
      () =>
        new Promise<ArrayBuffer>((resolve) => {
          releaseFetch = resolve
        }),
    )

    const pending = getPadAudioGraph().registerPadBuffer('drums-1', 'url')
    __resetAudioMaster()
    initAudioMaster()
    const secondCtx = fakeCtx

    releaseFetch(new ArrayBuffer(8))
    await pending

    expect(fakeContexts).toHaveLength(2)
    expect(firstCtx.decodeAudioData).toHaveBeenCalledTimes(1)
    expect(firstCtx.__sources).toHaveLength(0)
    expect(secondCtx.__sources).toHaveLength(1)
    expect(secondCtx.__sources[0]!.start).toHaveBeenCalledTimes(1)
  })
})

describe('scheduleRamp()', () => {
  it('schedules a gain ramp on the per-pad gain param without restarting the source', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    const sourcesAfterRegister = fakeCtx.__sources.length
    graph.scheduleRamp('drums-1', 0, 1, 0.5, 2.5)

    // No new source — sources are installed once per kit, not per ramp.
    expect(fakeCtx.__sources.length).toBe(sourcesAfterRegister)

    // The per-pad audibility gain is the gain that received the source via
    // source.connect(entry.gain). Identify it by finding the source's
    // connect target.
    const src = fakeCtx.__sources[0]!
    const padGain = src.connect.mock.calls[0]![0] as FakeGainNode
    expect(padGain.gain.setValueAtTime).toHaveBeenCalledWith(0, 0.5)
    expect(padGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, 2.5)
  })

  it('does NOT stop the source on a fade-to-zero ramp (loops stay alive)', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    // Activate, then deactivate — the source must remain running.
    graph.scheduleRamp('drums-1', 0, 1, 0.5, 2.5)
    graph.scheduleRamp('drums-1', 1, 0, 3, 5)

    const src = fakeCtx.__sources[0]!
    expect(src.stop).not.toHaveBeenCalled()
  })

  it('reuses the same source across fade-in / fade-out / fade-in cycles', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    graph.scheduleRamp('drums-1', 0, 1, 0, 1)
    graph.scheduleRamp('drums-1', 1, 0, 1, 2)
    graph.scheduleRamp('drums-1', 0, 1, 2, 3)

    // Exactly one source for the kit's lifetime.
    expect(fakeCtx.__sources.length).toBe(1)
  })

  it('no-ops when the pad has no registered buffer', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    graph.scheduleRamp('drums-1', 0, 1, 0, 1)
    expect(fakeCtx.createBufferSource).not.toHaveBeenCalled()
  })
})

describe('setGain()', () => {
  it('writes immediately via setValueAtTime on the per-pad gain', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    graph.setGain('drums-1', 0.7)

    const src = fakeCtx.__sources[0]!
    const padGain = src.connect.mock.calls[0]![0] as FakeGainNode
    expect(padGain.gain.setValueAtTime).toHaveBeenCalled()
    const last = padGain.gain.setValueAtTime.mock.calls.at(-1)!
    expect(last[0]).toBe(0.7)
  })

  it('no-ops when the pad has no registered buffer', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    // Should not throw on unregistered pad.
    expect(() => graph.setGain('drums-1', 0.5)).not.toThrow()
  })
})

describe('setPadWetSend()', () => {
  it('ramps the pad wet-send gain to the target value', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')
    fakeCtx.currentTime = 1.0

    graph.setPadWetSend('drums-1', 1)

    // The wetGain is the LAST gain created during buildEntry: gain → dryGain → wetGain.
    // Find it by reading the snapshot's wetGainValue indirectly via a known-target.
    // We track wet-gain ramps via linearRampToValueAtTime calls with target=1.
    const ramped = fakeCtx.__gains.find((g) =>
      g.gain.linearRampToValueAtTime.mock.calls.some((c) => c[0] === 1),
    )
    expect(ramped).toBeTruthy()
  })

  it('clamps the value to [0..1]', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    graph.setPadWetSend('drums-1', 5)
    // The ramp target should be clamped to 1.
    const ramped = fakeCtx.__gains.find((g) =>
      g.gain.linearRampToValueAtTime.mock.calls.length > 0,
    )
    const calls = ramped!.gain.linearRampToValueAtTime.mock.calls
    const lastTarget = calls[calls.length - 1]![0] as number
    expect(lastTarget).toBe(1)
  })

  it('no-ops when the pad has no registered buffer', () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    expect(() => graph.setPadWetSend('not-registered', 1)).not.toThrow()
  })
})

describe('audio-master not ready', () => {
  it('no-ops gracefully on registerPadBuffer when master graph not initialised', async () => {
    // Don't call initAudioMaster — graph still requests context which would
    // initialise it. To force a "not ready" branch we replace the context
    // ctor with one that throws.
    __setAudioContextCtor(null)
    const graph = getPadAudioGraph()
    await expect(graph.registerPadBuffer('drums-1', 'url')).resolves.toBeUndefined()
  })

  it('no-ops gracefully on scheduleRamp when master graph not initialised', () => {
    __setAudioContextCtor(null)
    const graph = getPadAudioGraph()
    expect(() => graph.scheduleRamp('drums-1', 0, 1, 0, 1)).not.toThrow()
  })
})

describe('disposePad / disposeAll', () => {
  it('disposePad disconnects gain + stops live source', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')

    const src = fakeCtx.__sources[0]!
    const padGain = src.connect.mock.calls[0]![0] as FakeGainNode
    graph.disposePad('drums-1')

    expect(padGain.disconnect).toHaveBeenCalled()
    expect(src.stop).toHaveBeenCalled()
  })

  it('disposeAll wipes every registered pad and resets the kit-start clock', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')
    await graph.registerPadBuffer('bass-1', 'url')

    const firstStartAt = fakeCtx.__sources[0]!.start.mock.calls[0]![0] as number

    // Advance the clock so a fresh kit anchor differs from the first one,
    // then dispose and re-register.
    fakeCtx.currentTime = 5

    graph.disposeAll()

    const gainsBefore = fakeCtx.__gains.length
    await graph.registerPadBuffer('drums-1', 'url')
    expect(fakeCtx.__gains.length).toBeGreaterThan(gainsBefore)

    // The new kit picked a fresh phase anchor — strictly greater than the
    // old kit's start time because we advanced ctx.currentTime.
    const newSrc = fakeCtx.__sources.at(-1)!
    const newStartAt = newSrc.start.mock.calls[0]![0] as number
    expect(newStartAt).toBeGreaterThan(firstStartAt)
  })
})

describe('kitPhaseAnchor — user-audible bar grid', () => {
  // The anchor is the AudioContext time of the first audible source restart
  // in a session. It defines the bar grid that every cross-block tap aligns
  // to so loops layered into other blocks share a single musical downbeat.
  it('starts unset, set/get round-trips, and survives across reads', () => {
    initAudioMaster()
    expect(getKitPhaseAnchor()).toBe(null)
    setKitPhaseAnchor(4.18)
    expect(getKitPhaseAnchor()).toBe(4.18)
    setKitPhaseAnchor(null)
    expect(getKitPhaseAnchor()).toBe(null)
  })

  it('nextBarFromKitAnchor falls back to ctxNow + bar when anchor is null', () => {
    initAudioMaster()
    setKitPhaseAnchor(null)
    expect(nextBarFromKitAnchor(10, 2.857)).toBeCloseTo(12.857, 5)
  })

  it('nextBarFromKitAnchor returns the anchor itself when anchor is in the future', () => {
    initAudioMaster()
    setKitPhaseAnchor(5.0)
    expect(nextBarFromKitAnchor(4.5, 2.857)).toBe(5.0)
  })

  it('nextBarFromKitAnchor returns the next bar past ctxNow on the anchor grid', () => {
    initAudioMaster()
    setKitPhaseAnchor(4.18)
    // 1.43 s elapsed → next bar is anchor + 1*bar.
    expect(nextBarFromKitAnchor(5.61, 2.857)).toBeCloseTo(4.18 + 2.857, 5)
    // Right at the anchor → first bar boundary.
    expect(nextBarFromKitAnchor(4.18, 2.857)).toBeCloseTo(4.18 + 2.857, 5)
    // 5.82 s elapsed → 2 cycles complete, next bar is anchor + 3*bar.
    expect(nextBarFromKitAnchor(10.0, 2.857)).toBeCloseTo(4.18 + 3 * 2.857, 5)
  })

  it('nextBarFromKitAnchor returns ctxNow on non-finite or non-positive bar duration', () => {
    initAudioMaster()
    setKitPhaseAnchor(4.18)
    expect(nextBarFromKitAnchor(10, 0)).toBe(10)
    expect(nextBarFromKitAnchor(10, -1)).toBe(10)
    expect(nextBarFromKitAnchor(10, Number.NaN)).toBe(10)
  })

  it('restartPadSource sets the anchor on first audible restart only', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')
    expect(getKitPhaseAnchor()).toBe(null)

    fakeCtx.currentTime = 4.06
    const ok = restartPadSource('drums-1', 4.18)
    expect(ok).toBe(true)
    expect(getKitPhaseAnchor()).toBe(4.18)

    // Second restart on the same pad does NOT move the anchor — the engine
    // owns explicit re-anchoring (only does so when the grid empties).
    fakeCtx.currentTime = 6.0
    restartPadSource('drums-1', 7.04)
    expect(getKitPhaseAnchor()).toBe(4.18)
  })

  it('disposeAll resets the anchor', async () => {
    initAudioMaster()
    setKitPhaseAnchor(4.18)
    getPadAudioGraph().disposeAll()
    expect(getKitPhaseAnchor()).toBe(null)
  })

  it('reinstallAllSourcesAfterResumeReturning resets the anchor', async () => {
    initAudioMaster()
    const graph = getPadAudioGraph()
    await graph.registerPadBuffer('drums-1', 'url')
    setKitPhaseAnchor(4.18)
    reinstallAllSourcesAfterResumeReturning()
    expect(getKitPhaseAnchor()).toBe(null)
  })
})

describe('getPadPeakSamples — UI waveform extraction', () => {
  // The waveform widget reads peak amplitudes per column from each pad's
  // decoded buffer. We swap in a fuller fake buffer for these tests
  // because the shared mock uses `{ duration: 2 }` (no channel data).
  function installFakeBuffer(): void {
    const length = 100
    fakeCtx.decodeAudioData = vi.fn(async () => {
      const arr = new Float32Array(length)
      // Half-period sine: peak at sample 50, zero crossings at 0 and 99.
      for (let i = 0; i < length; i++) arr[i] = Math.sin((i / length) * Math.PI)
      return {
        duration: 1,
        length,
        numberOfChannels: 1,
        sampleRate: 44100,
        getChannelData: () => arr,
      } as unknown as AudioBuffer
    })
  }

  it('returns null when the pad is not registered', () => {
    initAudioMaster()
    expect(getPadPeakSamples('nope', 10)).toBeNull()
  })

  it('extracts and normalises N peaks from the decoded buffer', async () => {
    initAudioMaster()
    installFakeBuffer()
    await getPadAudioGraph().registerPadBuffer('drums-1', 'url')
    const peaks = getPadPeakSamples('drums-1', 10)
    expect(peaks).not.toBeNull()
    expect(peaks!.length).toBe(10)
    // Largest column normalised to 1.0; quietest never below 0.05.
    expect(Math.max(...peaks!)).toBeCloseTo(1, 5)
    expect(Math.min(...peaks!)).toBeGreaterThanOrEqual(0.05)
  })

  it('caches per-column-count results across calls', async () => {
    initAudioMaster()
    installFakeBuffer()
    await getPadAudioGraph().registerPadBuffer('drums-1', 'url')
    const a = getPadPeakSamples('drums-1', 10)
    const b = getPadPeakSamples('drums-1', 10)
    expect(a).toBe(b)
    // Different column count → fresh array.
    const c = getPadPeakSamples('drums-1', 20)
    expect(c).not.toBe(a)
    expect(c!.length).toBe(20)
  })
})
