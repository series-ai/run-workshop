/**
 * Test — `src/audio/fx-state.ts`
 *
 * Drives the fx-state store through its actions and verifies they delegate
 * to the fx-bus singleton. Uses the real fx-bus + fake-AudioContext stack
 * so the test exercises the live wiring path rather than mocking the bus.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __setAudioContextCtor,
  __resetAudioMaster,
  initAudioMaster,
} from './audio-master'
import { __resetFxBus, getFxBus } from './fx-bus'
import { useFxStore, __resetFxStateOnly } from './fx-state'

interface FakeAudioParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
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
  return {
    destination: { id: 'dest' },
    currentTime: 0,
    state: 'running',
    createGain: vi.fn(() => ({
      gain: makeFakeParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: makeFakeParam(440),
      Q: makeFakeParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createDelay: vi.fn(() => ({
      delayTime: makeFakeParam(0),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: makeFakeParam(1),
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({})),
    createMediaStreamDestination: () => ({
      stream: { id: 'stream-1' },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 2 })),
    resume: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  }
}

let fakeCtx: FakeContext

function FakeAudioContextCtor(): FakeContext {
  fakeCtx = makeFakeContext()
  return fakeCtx
}

beforeEach(() => {
  __resetAudioMaster()
  __resetFxBus()
  __resetFxStateOnly()
  __setAudioContextCtor(FakeAudioContextCtor as unknown as typeof AudioContext)
})

afterEach(() => {
  __setAudioContextCtor(null)
  __resetFxBus()
  __resetAudioMaster()
})

describe('fx-state defaults', () => {
  it('starts with filter / 0.5 / 0.5', () => {
    const s = useFxStore.getState()
    expect(s.activeEffect).toBe('filter')
    expect(s.x).toBe(0.5)
    expect(s.y).toBe(0.5)
  })
})

describe('setActiveEffect', () => {
  it('updates store state and forwards to fx-bus', () => {
    initAudioMaster()
    // Touch the bus once to lock in the initial state.
    getFxBus()
    useFxStore.getState().setActiveEffect('reverb')
    expect(useFxStore.getState().activeEffect).toBe('reverb')
    expect(getFxBus().getActiveEffect()).toBe('reverb')
  })
})

describe('setParams', () => {
  it('clamps x/y to [0..1] and forwards to fx-bus', () => {
    initAudioMaster()
    useFxStore.getState().setParams(2, -0.5)
    const s = useFxStore.getState()
    expect(s.x).toBe(1)
    expect(s.y).toBe(0)
  })

  it('updates store state without changing activeEffect', () => {
    initAudioMaster()
    useFxStore.getState().setActiveEffect('delay')
    useFxStore.getState().setParams(0.3, 0.7)
    const s = useFxStore.getState()
    expect(s.activeEffect).toBe('delay')
    expect(s.x).toBe(0.3)
    expect(s.y).toBe(0.7)
  })
})

describe('reset', () => {
  it('restores store defaults and resets the bus', () => {
    initAudioMaster()
    useFxStore.getState().setActiveEffect('flanger')
    useFxStore.getState().setParams(0.9, 0.1)
    useFxStore.getState().reset()
    const s = useFxStore.getState()
    expect(s.activeEffect).toBe('filter')
    expect(s.x).toBe(0.5)
    expect(s.y).toBe(0.5)
    expect(getFxBus().getActiveEffect()).toBe('filter')
  })
})
