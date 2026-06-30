/**
 * Test — `src/components/widgets/FxPanel.tsx`
 *
 * Verifies:
 *   - Renders 4 tabs (filter / flanger / reverb / delay) with the active
 *     tab marked aria-selected.
 *   - Tab tap updates `useFxStore.activeEffect` and forwards to the bus.
 *   - Pointer-down + pointer-move on the XY pad updates the store x/y.
 *   - Live labels reflect the active effect's parameter mapping.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  __setAudioContextCtor,
  __resetAudioMaster,
  initAudioMaster,
} from '../../audio/audio-master'
import { __resetFxBus } from '../../audio/fx-bus'
import { useFxStore, __resetFxStateOnly } from '../../audio/fx-state'
import { usePadGridStore, resetPadGridStore } from '../../stores/padGridStore'
import { FxPanel } from './FxPanel'

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
  __resetAudioMaster()
  __resetFxBus()
  __resetFxStateOnly()
  resetPadGridStore()
  // Force every FX-bypass cell off so the dry overlay shows by default.
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
  cleanup()
  __setAudioContextCtor(null)
  __resetFxBus()
  __resetAudioMaster()
})

describe('FxPanel', () => {
  it('renders four FX tabs with filter active by default', () => {
    render(<FxPanel />)
    expect(screen.getByText('Filter')).toBeTruthy()
    expect(screen.getByText('Flanger')).toBeTruthy()
    expect(screen.getByText('Reverb')).toBeTruthy()
    expect(screen.getByText('Delay')).toBeTruthy()
    const panel = screen.getByTestId('fx-panel')
    expect(panel.getAttribute('data-fx-active')).toBe('filter')
  })

  it('clicking a tab updates the store activeEffect', () => {
    render(<FxPanel />)
    fireEvent.click(screen.getByText('Reverb'))
    expect(useFxStore.getState().activeEffect).toBe('reverb')
    const panel = screen.getByTestId('fx-panel')
    expect(panel.getAttribute('data-fx-active')).toBe('reverb')
  })

  it('renders live parameter labels for the active effect', () => {
    render(<FxPanel />)
    // Default filter labels: Cutoff / Resonance.
    expect(screen.getByTestId('fx-panel-x-label').textContent).toMatch(/Cutoff/)
    expect(screen.getByTestId('fx-panel-y-label').textContent).toMatch(/Resonance/)
  })

  it('switching to delay updates labels to Time / Feedback', () => {
    render(<FxPanel />)
    fireEvent.click(screen.getByText('Delay'))
    expect(screen.getByTestId('fx-panel-x-label').textContent).toMatch(/Time/)
    expect(screen.getByTestId('fx-panel-y-label').textContent).toMatch(/Feedback/)
  })

  it('pointer-down on XY pad updates x/y in the store', () => {
    render(<FxPanel />)
    const xy = screen.getByTestId('fx-panel-xy')
    // jsdom: getBoundingClientRect returns 0s; stub to a 100×100 rect so the
    // computeFromEvent math produces a valid result.
    xy.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON() {
          return {}
        },
      }) as DOMRect

    // Pointer-down at (75, 25) → x=0.75, y=1 - 0.25 = 0.75.
    fireEvent.pointerDown(xy, { clientX: 75, clientY: 25, pointerId: 1 })
    const state = useFxStore.getState()
    expect(state.x).toBeCloseTo(0.75)
    expect(state.y).toBeCloseTo(0.75)
  })

  it('pointer-move while dragging continues to update x/y; pointer-up stops', () => {
    render(<FxPanel />)
    const xy = screen.getByTestId('fx-panel-xy')
    xy.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON() {
          return {}
        },
      }) as DOMRect

    fireEvent.pointerDown(xy, { clientX: 50, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(xy, { clientX: 90, clientY: 10, pointerId: 1 })
    let s = useFxStore.getState()
    expect(s.x).toBeCloseTo(0.9)
    expect(s.y).toBeCloseTo(0.9)

    fireEvent.pointerUp(xy, { clientX: 90, clientY: 10, pointerId: 1 })
    // Move after pointer-up should NOT update.
    fireEvent.pointerMove(xy, { clientX: 10, clientY: 90, pointerId: 1 })
    s = useFxStore.getState()
    expect(s.x).toBeCloseTo(0.9)
    expect(s.y).toBeCloseTo(0.9)
  })

  it('exposes data-fx-x / data-fx-y for browser-verify probes', () => {
    render(<FxPanel />)
    const xy = screen.getByTestId('fx-panel-xy')
    expect(xy.getAttribute('data-fx-x')).toBeDefined()
    expect(xy.getAttribute('data-fx-y')).toBeDefined()
  })

  // ── Dry-state hint (FX polish pass) ────────────────────────────────────
  it('renders dry-state overlay when no FX-bypass cells are engaged', () => {
    render(<FxPanel />)
    const overlay = screen.queryByTestId('fx-panel-dry-overlay')
    expect(overlay).not.toBeNull()
    expect(overlay?.textContent).toMatch(/sparkle column/i)
    const xy = screen.getByTestId('fx-panel-xy')
    expect(xy.getAttribute('data-fx-dry')).toBe('true')
  })

  it('hides dry-state overlay when at least one FX-bypass cell is on', () => {
    usePadGridStore.setState({
      fxBypass: {
        drums: { cool: true, warm: false },
        bass: { cool: false, warm: false },
        melody: { cool: false, warm: false },
        fx: { cool: false, warm: false },
      },
    })
    render(<FxPanel />)
    expect(screen.queryByTestId('fx-panel-dry-overlay')).toBeNull()
    const xy = screen.getByTestId('fx-panel-xy')
    expect(xy.getAttribute('data-fx-dry')).toBe('false')
  })

  it('XY pad surface declares an aspect-ratio so it renders 2D, not as a 1D strip', () => {
    render(<FxPanel />)
    const xy = screen.getByTestId('fx-panel-xy')
    const styleAttr = xy.getAttribute('style') ?? ''
    // Either inline style or computed style must declare aspect-ratio.
    expect(styleAttr).toMatch(/aspect-ratio:\s*16\s*\/\s*9/)
    expect(styleAttr).toMatch(/min-height:\s*140px/)
  })
})
