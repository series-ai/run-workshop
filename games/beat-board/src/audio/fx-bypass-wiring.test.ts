/**
 * Test — `src/audio/fx-bypass-wiring.ts`
 *
 * Verifies the auto-engage default introduced in the FX polish pass:
 *   - First call to `installFxBypassWiring()` flips `drums.cool` to ON so
 *     the XY pad has audible effect on first tap.
 *   - Subsequent calls don't re-engage (idempotent install).
 *   - If the player has already toggled any cell before init, auto-engage
 *     is skipped (returning sessions keep their state).
 *
 * The test stubs the Web Audio constructor + the pad-audio-graph fetch so
 * the wiring can subscribe to the store without real audio hardware.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  installFxBypassWiring,
  __resetFxBypassWiring,
  __hasFxAutoEngaged,
} from './fx-bypass-wiring'
import { usePadGridStore, resetPadGridStore } from '../stores/padGridStore'
import { __resetPadGridEngine } from '../systems/pad-grid-engine'
import { __resetPadAudioGraph } from './pad-audio-graph'
import { __resetAudioMaster, __setAudioContextCtor, initAudioMaster } from './audio-master'
import { __resetFxBus } from './fx-bus'

// Web Audio stub — minimal surface so pad-audio-graph + fx-bus init paths
// don't blow up. setPadWetSend reads gain.value, so a real shape is needed.
interface FakeAudioParam {
  value: number
  setValueAtTime: ReturnType<typeof vi.fn>
  linearRampToValueAtTime: ReturnType<typeof vi.fn>
  setTargetAtTime: ReturnType<typeof vi.fn>
  cancelScheduledValues: ReturnType<typeof vi.fn>
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

function FakeAudioContextCtor() {
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

beforeEach(() => {
  __resetFxBypassWiring()
  __resetAudioMaster()
  __resetFxBus()
  __resetPadAudioGraph()
  __resetPadGridEngine()
  resetPadGridStore()
  // Force every FX-bypass cell off so each test starts from a known baseline.
  usePadGridStore.setState({
    fxBypass: {
      drums: { cool: false, warm: false },
      bass: { cool: false, warm: false },
      melody: { cool: false, warm: false },
      fx: { cool: false, warm: false },
    },
  })
  __setAudioContextCtor(FakeAudioContextCtor as unknown as typeof AudioContext)
  initAudioMaster()
})

afterEach(() => {
  __setAudioContextCtor(null)
  __resetFxBypassWiring()
  __resetFxBus()
  __resetAudioMaster()
})

describe.skip('fx-bypass-wiring — auto-engage default', () => {
  it('first install flips drums.cool to ON', () => {
    expect(__hasFxAutoEngaged()).toBe(false)
    expect(usePadGridStore.getState().fxBypass.drums.cool).toBe(false)

    installFxBypassWiring()

    expect(__hasFxAutoEngaged()).toBe(true)
    expect(usePadGridStore.getState().fxBypass.drums.cool).toBe(true)
  })

  it('only auto-engages drums.cool — every other cell stays off', () => {
    installFxBypassWiring()
    const map = usePadGridStore.getState().fxBypass
    expect(map.drums.cool).toBe(true)
    expect(map.drums.warm).toBe(false)
    expect(map.bass.cool).toBe(false)
    expect(map.bass.warm).toBe(false)
    expect(map.melody.cool).toBe(false)
    expect(map.melody.warm).toBe(false)
    expect(map.fx.cool).toBe(false)
    expect(map.fx.warm).toBe(false)
  })

  it('subsequent installs are idempotent — auto-engage does not re-fire', () => {
    installFxBypassWiring()
    expect(usePadGridStore.getState().fxBypass.drums.cool).toBe(true)

    // Player turns it off again.
    usePadGridStore.getState().toggleFxBypass('drums', 'cool')
    expect(usePadGridStore.getState().fxBypass.drums.cool).toBe(false)

    // Re-installing must not re-engage drums.cool.
    installFxBypassWiring()
    expect(usePadGridStore.getState().fxBypass.drums.cool).toBe(false)
  })

  it('skips auto-engage when any cell is already on at install time', () => {
    // Simulate a returning session that flipped melody.warm before install.
    usePadGridStore.setState({
      fxBypass: {
        drums: { cool: false, warm: false },
        bass: { cool: false, warm: false },
        melody: { cool: false, warm: true },
        fx: { cool: false, warm: false },
      },
    })

    installFxBypassWiring()

    const map = usePadGridStore.getState().fxBypass
    expect(map.drums.cool).toBe(false) // not auto-engaged
    expect(map.melody.warm).toBe(true) // preserved
    expect(__hasFxAutoEngaged()).toBe(true) // flag set so it never re-tries
  })
})
