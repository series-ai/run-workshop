/**
 * Integration test — `src/audio/audio-master.ts`
 *
 * Issue beat-board-03-audio-engine-and-beat-sequencer. Asserts the master
 * Web Audio graph is initialised once at app boot, follows
 * `ui/settings-overlay`'s music/sound volume + enable toggles, and exposes
 * the AudioNode the recording-capture system (issue 17) consumes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initAudioMaster,
  getMasterDestination,
  getRecordingDestination,
  getAudioContext,
  isAudioMasterReady,
  disposeAudioMaster,
  __setAudioContextCtor,
  __resetAudioMaster,
} from '../../src/audio/audio-master'
import { useSettingsStore, resetSettingsStore } from '@modules/ui/settings-overlay/SettingsOverlay'

// ── Fake Web Audio plumbing ──────────────────────────────────────────────

interface FakeGainNode {
  gain: { value: number }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

interface FakeMediaStreamDest {
  stream: { id: string }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

interface FakeAudioContext {
  destination: { id: string }
  currentTime: number
  state: 'running' | 'suspended' | 'closed'
  createGain: () => FakeGainNode
  createMediaStreamDestination: () => FakeMediaStreamDest
  close: ReturnType<typeof vi.fn>
}

function makeFakeContext(): FakeAudioContext {
  const ctx: FakeAudioContext = {
    destination: { id: 'dest' },
    currentTime: 0,
    state: 'running',
    createGain: () => ({
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    createMediaStreamDestination: () => ({
      stream: { id: 'stream-1' },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }
  return ctx
}

let lastFakeCtx: FakeAudioContext | null = null

function FakeAudioContextCtor(): FakeAudioContext {
  lastFakeCtx = makeFakeContext()
  return lastFakeCtx
}

beforeEach(() => {
  __resetAudioMaster()
  resetSettingsStore()
  __setAudioContextCtor(FakeAudioContextCtor as unknown as typeof AudioContext)
  lastFakeCtx = null
})

afterEach(() => {
  __setAudioContextCtor(null)
  __resetAudioMaster()
})

describe('initAudioMaster()', () => {
  it('creates exactly one AudioContext + master GainNode and connects to destination', () => {
    const a = initAudioMaster()
    const b = initAudioMaster()

    expect(a).toBe(b) // singleton
    expect(isAudioMasterReady()).toBe(true)
    expect(a.context).toBe(lastFakeCtx)
    expect(a.masterGain).toBeDefined()
    // master gain must connect to context.destination (final stage of graph)
    const ctx = lastFakeCtx as unknown as FakeAudioContext
    expect(a.masterGain.connect).toHaveBeenCalledWith(ctx.destination)
  })

  it('binds master gain to settings-overlay music+sound volume on init', () => {
    useSettingsStore.setState({ soundVolume: 0.6, musicVolume: 0.4 })
    const master = initAudioMaster()
    // Master is capped at unity — compensation lives on per-pad pre-amp.
    expect(master.masterGain.gain.value).toBeCloseTo(0.4, 5)
  })

  it('updates master gain in realtime when settings-overlay volume changes', () => {
    const master = initAudioMaster()
    useSettingsStore.setState({ soundVolume: 0.9, musicVolume: 0.7 })
    expect(master.masterGain.gain.value).toBeCloseTo(0.7, 5)
    useSettingsStore.setState({ musicVolume: 0.2 })
    expect(master.masterGain.gain.value).toBeCloseTo(0.2, 5)
  })

  it('mutes master to 0 when soundEnabled or musicEnabled flips off', () => {
    const master = initAudioMaster()
    useSettingsStore.setState({ soundVolume: 1, musicVolume: 1 })
    expect(master.masterGain.gain.value).toBe(1)
    useSettingsStore.setState({ soundEnabled: false })
    expect(master.masterGain.gain.value).toBe(0)
    useSettingsStore.setState({ soundEnabled: true })
    expect(master.masterGain.gain.value).toBe(1)
    useSettingsStore.setState({ musicEnabled: false })
    expect(master.masterGain.gain.value).toBe(0)
  })
})

describe('getMasterDestination() / getAudioContext()', () => {
  it('returns the master gain AudioNode the recording capture system will consume', () => {
    const node = getMasterDestination()
    const master = initAudioMaster()
    expect(node).toBe(master.masterGain)
  })

  it('exposes the shared AudioContext for clock reads', () => {
    const ctx = getAudioContext()
    expect(ctx).toBe(lastFakeCtx)
  })
})

describe('getRecordingDestination()', () => {
  it('lazily creates a MediaStreamAudioDestinationNode tap on master gain', () => {
    initAudioMaster()
    const master = initAudioMaster()
    const tap = getRecordingDestination()
    expect(tap).toBeDefined()
    // master gain must connect to BOTH context.destination and the tap.
    const calls = (master.masterGain.connect as ReturnType<typeof vi.fn>).mock.calls
    const targets = calls.map((c) => c[0])
    expect(targets).toContain(tap)
  })

  it('returns the same MediaStreamAudioDestinationNode across calls', () => {
    const a = getRecordingDestination()
    const b = getRecordingDestination()
    expect(a).toBe(b)
  })
})

describe('disposeAudioMaster()', () => {
  it('closes the context, drops the singleton, and unsubscribes from settings', () => {
    const master = initAudioMaster()
    expect(isAudioMasterReady()).toBe(true)

    disposeAudioMaster()

    expect(isAudioMasterReady()).toBe(false)
    expect(master.context.close).toHaveBeenCalled()

    // After dispose, settings store changes must NOT crash (subscriber was
    // unhooked). Reinitialising with a fresh ctor proves the previous
    // subscription is gone — the previous masterGain.gain.value is no longer
    // mutated by the live settings store.
    const previousGain = master.masterGain
    useSettingsStore.setState({ soundVolume: 0.123, musicVolume: 0.123 })
    expect(previousGain.gain.value).not.toBe(0.123)
  })
})
