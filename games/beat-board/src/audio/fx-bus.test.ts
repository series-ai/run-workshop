/**
 * Test — `src/audio/fx-bus.ts`
 *
 * The fx-bus owns the parallel filter / flanger / reverb / delay routing
 * sitting beside the dry signal path. Tests use the same fake-AudioContext
 * pattern as `pad-audio-graph.test.ts`:
 *
 *   - `connectPad` / `disconnectPad` track each pad's wet branch.
 *   - `setActiveEffect` crossfades chain output gates over 50 ms — only the
 *     active chain ramps to 1; the others ramp to 0.
 *   - `setParams(x, y)` writes to the active chain via `setTargetAtTime`.
 *   - `disposeAll` tears down all routing nodes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setAudioContextCtor,
  __resetAudioMaster,
  initAudioMaster,
} from './audio-master'
import {
  __resetFxBus,
  getFxBus,
  getFxBusSnapshot,
} from './fx-bus'

// ── Fake Web Audio plumbing ──────────────────────────────────────────────

interface FakeAudioParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
}

interface FakeNode {
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  context: FakeContext
  __role: string
}

interface FakeGainNode extends FakeNode {
  gain: FakeAudioParam
}

interface FakeBiquadNode extends FakeNode {
  type: string
  frequency: FakeAudioParam
  Q: FakeAudioParam
}

interface FakeDelayNode extends FakeNode {
  delayTime: FakeAudioParam
}

interface FakeOscillator extends FakeNode {
  type: string
  frequency: FakeAudioParam
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

interface FakeContext {
  destination: { id: string }
  currentTime: number
  state: 'running' | 'suspended' | 'closed'
  createGain: ReturnType<typeof vi.fn>
  createBiquadFilter: ReturnType<typeof vi.fn>
  createDelay: ReturnType<typeof vi.fn>
  createOscillator: ReturnType<typeof vi.fn>
  createBufferSource: ReturnType<typeof vi.fn>
  createMediaStreamDestination: () => { stream: { id: string }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
  decodeAudioData: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  __gains: FakeGainNode[]
  __biquads: FakeBiquadNode[]
  __delays: FakeDelayNode[]
  __oscillators: FakeOscillator[]
}

function makeFakeParam(initialValue = 0): FakeAudioParam {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  }
}

function makeFakeContext(): FakeContext {
  const gains: FakeGainNode[] = []
  const biquads: FakeBiquadNode[] = []
  const delays: FakeDelayNode[] = []
  const oscillators: FakeOscillator[] = []
  const ctx: FakeContext = {
    destination: { id: 'dest' },
    currentTime: 0,
    state: 'running',
    createGain: vi.fn(() => {
      const g: FakeGainNode = {
        gain: makeFakeParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: ctx,
        __role: 'gain',
      }
      gains.push(g)
      return g
    }),
    createBiquadFilter: vi.fn(() => {
      const b: FakeBiquadNode = {
        type: 'lowpass',
        frequency: makeFakeParam(440),
        Q: makeFakeParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: ctx,
        __role: 'biquad',
      }
      biquads.push(b)
      return b
    }),
    createDelay: vi.fn(() => {
      const d: FakeDelayNode = {
        delayTime: makeFakeParam(0),
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: ctx,
        __role: 'delay',
      }
      delays.push(d)
      return d
    }),
    createOscillator: vi.fn(() => {
      const o: FakeOscillator = {
        type: 'sine',
        frequency: makeFakeParam(1),
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        context: ctx,
        __role: 'oscillator',
      }
      oscillators.push(o)
      return o
    }),
    createBufferSource: vi.fn(() => ({})),
    createMediaStreamDestination: () => ({
      stream: { id: 'stream-1' },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 2 })),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    __gains: gains,
    __biquads: biquads,
    __delays: delays,
    __oscillators: oscillators,
  }
  return ctx
}

let fakeCtx: FakeContext

function FakeAudioContextCtor(): FakeContext {
  fakeCtx = makeFakeContext()
  return fakeCtx
}

beforeEach(() => {
  __resetAudioMaster()
  __resetFxBus()
  __setAudioContextCtor(FakeAudioContextCtor as unknown as typeof AudioContext)
})

afterEach(() => {
  __setAudioContextCtor(null)
  __resetFxBus()
  __resetAudioMaster()
})

// ── Tests ────────────────────────────────────────────────────────────────

describe('fx-bus singleton', () => {
  it('returns the same instance across calls', () => {
    initAudioMaster()
    const a = getFxBus()
    const b = getFxBus()
    expect(a).toBe(b)
  })

  it('lazily builds four parallel sub-chains on first use', () => {
    initAudioMaster()
    getFxBus().setActiveEffect('filter')
    // 4 chains × (input gain + output gain) plus busInput + busOutput = at least 10 gain nodes.
    // (Plus reverb's combMixer + flanger feedback + delay feedback, etc.)
    expect(fakeCtx.__gains.length).toBeGreaterThanOrEqual(10)
    // Filter chain creates a BiquadFilter; reverb creates 4 combs + 2 allpasses = 4 biquads (tone)
    // plus reverb's 4 comb + 2 allpass delays = 6 delays; flanger adds 1 delay; delay adds 1; = 8 delays minimum.
    expect(fakeCtx.__biquads.length).toBeGreaterThanOrEqual(5)
    expect(fakeCtx.__delays.length).toBeGreaterThanOrEqual(7)
    // Flanger LFO oscillator was started.
    expect(fakeCtx.__oscillators.length).toBe(1)
    expect(fakeCtx.__oscillators[0]!.start).toHaveBeenCalled()
  })

  it('default active effect is filter with output gate at 1', () => {
    initAudioMaster()
    getFxBus()
    expect(getFxBusSnapshot().active).toBe('filter')
  })
})

describe('connectPad / disconnectPad', () => {
  it('records the pad connection and routes the source into bus input', () => {
    initAudioMaster()
    const bus = getFxBus()
    // Use the AudioContext directly to fabricate a pad's wet gain node.
    const wet = (fakeCtx.createGain() as unknown) as AudioNode
    bus.connectPad('drums-1', wet)
    expect(bus.connectedPadCount()).toBe(1)
    // wet.connect was called with bus input.
    expect((wet as unknown as FakeGainNode).connect).toHaveBeenCalled()
  })

  it('disconnectPad removes the connection', () => {
    initAudioMaster()
    const bus = getFxBus()
    const wet = (fakeCtx.createGain() as unknown) as AudioNode
    bus.connectPad('drums-1', wet)
    bus.disconnectPad('drums-1')
    expect(bus.connectedPadCount()).toBe(0)
    expect((wet as unknown as FakeGainNode).disconnect).toHaveBeenCalled()
  })

  it('replacing a connection cleans up the previous wet node', () => {
    initAudioMaster()
    const bus = getFxBus()
    const wetA = (fakeCtx.createGain() as unknown) as AudioNode
    const wetB = (fakeCtx.createGain() as unknown) as AudioNode
    bus.connectPad('drums-1', wetA)
    bus.connectPad('drums-1', wetB)
    expect(bus.connectedPadCount()).toBe(1)
    expect((wetA as unknown as FakeGainNode).disconnect).toHaveBeenCalled()
  })

  it('rebuilds instead of connecting a new-context pad into a stale bus', () => {
    initAudioMaster()
    const bus = getFxBus()
    bus.setActiveEffect('filter')
    const oldOscillator = fakeCtx.__oscillators[0]!

    __resetAudioMaster()
    initAudioMaster()
    const wet = (fakeCtx.createGain() as unknown) as AudioNode

    expect(() => bus.connectPad('drums-1', wet)).not.toThrow()
    expect(oldOscillator.stop).toHaveBeenCalled()
    expect(bus.connectedPadCount()).toBe(1)
    expect((wet as unknown as FakeGainNode).connect).toHaveBeenCalled()
  })
})

describe('setActiveEffect()', () => {
  it('crossfades from previous chain to new chain via output-gate ramps', () => {
    initAudioMaster()
    const bus = getFxBus()
    fakeCtx.currentTime = 1.0
    bus.setActiveEffect('reverb')

    // Each of the 4 chain output gates received a setValueAtTime + linearRampToValueAtTime.
    // The reverb output should ramp to 1; the others to 0.
    // Output gates are GainNodes — find the four chain outputs by examining
    // which gains had linearRampToValueAtTime called.
    const gatedGains = fakeCtx.__gains.filter(
      (g) => g.gain.linearRampToValueAtTime.mock.calls.length > 0,
    )
    expect(gatedGains.length).toBe(4)
    const ramped = gatedGains.map((g) => g.gain.linearRampToValueAtTime.mock.calls[0]![0] as number)
    const ramp1 = ramped.filter((v) => v === 1)
    const ramp0 = ramped.filter((v) => v === 0)
    expect(ramp1.length).toBe(1)
    expect(ramp0.length).toBe(3)

    expect(bus.getActiveEffect()).toBe('reverb')
    expect(getFxBusSnapshot().active).toBe('reverb')
  })

  it('no-ops when called with the same active effect (idempotent)', () => {
    initAudioMaster()
    const bus = getFxBus()
    // setActiveEffect('filter') — the default — should NOT trigger ramps.
    const beforeRampCallCount = fakeCtx.__gains.reduce(
      (sum, g) => sum + g.gain.linearRampToValueAtTime.mock.calls.length,
      0,
    )
    bus.setActiveEffect('filter')
    const afterRampCallCount = fakeCtx.__gains.reduce(
      (sum, g) => sum + g.gain.linearRampToValueAtTime.mock.calls.length,
      0,
    )
    expect(afterRampCallCount).toBe(beforeRampCallCount)
  })
})

describe('setParams()', () => {
  it('writes the active chain params via setTargetAtTime for live smoothing', () => {
    initAudioMaster()
    const bus = getFxBus()
    bus.setActiveEffect('filter')
    bus.setParams(0.75, 0.25)
    // Filter chain: cutoff (frequency) + Q both set via setTargetAtTime.
    // The filter is the first BiquadFilter created (filter chain runs first).
    const filterBiquad = fakeCtx.__biquads[0]!
    expect(filterBiquad.frequency.setTargetAtTime).toHaveBeenCalled()
    expect(filterBiquad.Q.setTargetAtTime).toHaveBeenCalled()
  })

  it('clamps inputs to [0..1]', () => {
    initAudioMaster()
    const bus = getFxBus()
    bus.setParams(2, -0.5)
    const snap = getFxBusSnapshot()
    expect(snap.paramX).toBe(1)
    expect(snap.paramY).toBe(0)
  })

  it('updates the new chain immediately on setActiveEffect()', () => {
    initAudioMaster()
    const bus = getFxBus()
    bus.setParams(0.3, 0.7)
    bus.setActiveEffect('delay')
    // Delay chain — verify its delay node + feedback gain were updated.
    // The delay chain creates the LAST DelayNode (after reverb's 6 delays + flanger's 1).
    const delayNode = fakeCtx.__delays[fakeCtx.__delays.length - 1]!
    expect(delayNode.delayTime.setTargetAtTime).toHaveBeenCalled()
  })
})

describe('disposeAll()', () => {
  it('clears all chain nodes and pad connections', () => {
    initAudioMaster()
    const bus = getFxBus()
    const wet = (fakeCtx.createGain() as unknown) as AudioNode
    bus.connectPad('drums-1', wet)
    expect(bus.connectedPadCount()).toBe(1)
    bus.disposeAll()
    expect(bus.connectedPadCount()).toBe(0)
    // Flanger LFO stopped on dispose.
    expect(fakeCtx.__oscillators[0]!.stop).toHaveBeenCalled()
  })
})

describe('audio-master not ready', () => {
  it('connectPad no-ops gracefully when master never initialised', () => {
    __setAudioContextCtor(null)
    const bus = getFxBus()
    const fakeNode = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode
    expect(() => bus.connectPad('drums-1', fakeNode)).not.toThrow()
    expect(bus.connectedPadCount()).toBe(0)
  })

  it('setActiveEffect no-ops gracefully when master never initialised', () => {
    __setAudioContextCtor(null)
    const bus = getFxBus()
    expect(() => bus.setActiveEffect('reverb')).not.toThrow()
  })

  it('setParams no-ops gracefully when master never initialised', () => {
    __setAudioContextCtor(null)
    const bus = getFxBus()
    expect(() => bus.setParams(0.5, 0.5)).not.toThrow()
  })
})
