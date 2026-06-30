/**
 * PadTopBar — record button wiring tests.
 *
 * The button is the only player-facing entry to the recording pipeline.
 * These tests verify the Groovepad-style toggle behaviour: tap to start,
 * tap again to stop, button mirrors the live status (not a separate flag).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'

import { PadTopBar } from '../PadTopBar'
import { useRecordingStore, resetRecordingStore } from '../../../stores/recordingStore'
import { useKitsStore } from '../../../stores/kitsStore'

const h = React.createElement

// Stub the recording capture singleton so we can intercept start/stop without
// a real MediaRecorder.
let startSpy: ReturnType<typeof vi.fn>
let stopSpy: ReturnType<typeof vi.fn>
let cancelSpy: ReturnType<typeof vi.fn>

vi.mock('../../../systems/recording-capture', async () => {
  const actual = await vi.importActual<typeof import('../../../systems/recording-capture')>(
    '../../../systems/recording-capture',
  )
  return {
    ...actual,
    getRecordingCapture: () => ({
      start: (...args: unknown[]) => startSpy(...args),
      stop: (...args: unknown[]) => stopSpy(...args),
      cancel: (...args: unknown[]) => cancelSpy(...args),
      simulateError: () => {},
    }),
  }
})

beforeEach(async () => {
  startSpy = vi.fn().mockResolvedValue(undefined)
  stopSpy = vi.fn(() => {
    useRecordingStore.setState({ status: 'idle' })
  })
  cancelSpy = vi.fn()
  resetRecordingStore()
  useKitsStore.setState({ activeKitId: 'kit_alpha' })
  // Mark the FTUE complete so the record gate is open. Without this the
  // button reads as disabled (gate stays true until tap_second_pad
  // completes), and click handlers are no-ops.
  const { moduleFtueStore, resetFtueAdapterForTests } = await import(
    '../../../systems/ftue-adapter'
  )
  resetFtueAdapterForTests()
  moduleFtueStore.setState({ currentPhase: 'completed' })
})

afterEach(() => {
  cleanup()
  resetRecordingStore()
})

describe('PadTopBar — record button wiring', () => {
  it('renders with data-ftue="record-button" so the FTUE spotlight has a target', () => {
    render(h(PadTopBar))
    const btn = screen.getByTestId('pad-top-bar-record')
    expect(btn).toHaveAttribute('data-ftue', 'record-button')
  })

  it('idle state — aria-label is "Start recording"', () => {
    render(h(PadTopBar))
    const btn = screen.getByTestId('pad-top-bar-record')
    expect(btn).toHaveAttribute('aria-label', 'Start recording')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  it('tapping while idle calls recordingStore.start', () => {
    render(h(PadTopBar))
    fireEvent.click(screen.getByTestId('pad-top-bar-record'))
    expect(startSpy).toHaveBeenCalledTimes(1)
  })

  it('mirrors recordingStore.status — capturing flips aria + pressed state', () => {
    render(h(PadTopBar))
    act(() => {
      useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 2 })
    })
    const btn = screen.getByTestId('pad-top-bar-record')
    expect(btn).toHaveAttribute('aria-label', 'Stop recording')
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('tapping while capturing calls recordingStore.stop', () => {
    render(h(PadTopBar))
    act(() => {
      useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 5 })
    })
    fireEvent.click(screen.getByTestId('pad-top-bar-record'))
    expect(stopSpy).toHaveBeenCalledTimes(1)
    expect(startSpy).not.toHaveBeenCalled()
  })

  it('elapsed counter is hidden while idle', () => {
    render(h(PadTopBar))
    expect(screen.queryByTestId('recording-elapsed')).not.toBeInTheDocument()
  })

  it('elapsed counter appears + ticks while capturing', () => {
    render(h(PadTopBar))
    act(() => {
      useRecordingStore.setState({ status: 'capturing', elapsedSeconds: 5 })
    })
    expect(screen.getByTestId('recording-elapsed')).toHaveTextContent('0:05')
    act(() => {
      useRecordingStore.setState({ elapsedSeconds: 65 })
    })
    expect(screen.getByTestId('recording-elapsed')).toHaveTextContent('1:05')
  })

  it('record button is disabled while the FTUE record gate is closed', async () => {
    const { moduleFtueStore, resetFtueAdapterForTests } = await import(
      '../../../systems/ftue-adapter'
    )
    resetFtueAdapterForTests()
    // currentPhase 'idle' + tap_second_pad not in completed → gate is closed.
    moduleFtueStore.setState({
      currentPhase: 'idle',
      completedSteps: new Set(),
    })
    render(h(PadTopBar))
    const btn = screen.getByTestId('pad-top-bar-record')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(startSpy).not.toHaveBeenCalled()
  })
})
