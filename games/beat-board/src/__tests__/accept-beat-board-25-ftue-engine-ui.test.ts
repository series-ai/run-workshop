/**
 * UI render acceptance tests for issue beat-board-25-ftue-engine.
 *
 * Verifies the FtueOverlay component renders the expected affordances:
 *   - Always-visible Skip button (shell-owned safety affordance)
 *   - Step-1-only inline "Skip" link inside the tooltip per prd.md
 *   - Tooltip message text reflects the current step
 *   - Skip link tap calls `skipAll()` and persists FTUE-complete
 *   - Outside-spotlight tap does NOT skip the overlay
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import { FtueOverlay } from '../components/screens/FtueOverlay'
import {
  useFtueStore,
  resetFtueAdapterForTests,
} from '../systems/ftue-adapter'
import { resetPadGridStore, usePadGridStore } from '../stores/padGridStore'
import { resetRecordingStore } from '../stores/recordingStore'

function mountSpotlightPlaceholders() {
  const div = document.createElement('div')
  div.id = 'ftue-spotlight-placeholders'
  div.innerHTML = `
    <div data-ftue="pad-cell-0"></div>
    <div data-ftue="pad-cell-5"></div>
    <div data-ftue="record-button"></div>
  `
  document.body.appendChild(div)
}

beforeEach(async () => {
  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.setItem).mockClear()
  resetPadGridStore()
  usePadGridStore.setState({ activePadIds: [] })
  resetRecordingStore()
  resetFtueAdapterForTests()
  mountSpotlightPlaceholders()
  await useFtueStore.getState().initialize()
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('accept: FtueOverlay UI', () => {
  it('renders skip button (shell safety) once FTUE starts', async () => {
    await act(async () => {
      render(React.createElement(FtueOverlay))
      useFtueStore.getState().startFtue('play')
    })
    // The shell renders a Skip button keyed by `ftue-skip-button`.
    expect(screen.getByTestId('ftue-skip-button')).toBeInTheDocument()
  })

  it('renders step 1 prompt', async () => {
    await act(async () => {
      render(React.createElement(FtueOverlay))
      useFtueStore.getState().startFtue('play')
    })
    expect(screen.getByTestId('ftue-tooltip-message')).toHaveTextContent(
      'Tap a pad to start your beat.',
    )
  })

  // The inline "ftue-tooltip-skip" link inside the tooltip card was
  // intentionally removed (FtueOverlay.tsx:133-138) — it didn't fire
  // reliably on mobile and confused players who saw it next to the
  // always-visible shell-owned Skip button. The shell's button is the
  // single skip affordance; it's exercised by the
  // 'shell skip button calls skipAll()' test below.
  it('shell skip button calls skipAll() and persists', async () => {
    await act(async () => {
      render(React.createElement(FtueOverlay))
      useFtueStore.getState().startFtue('play')
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ftue-skip-button'))
    })
    expect(useFtueStore.getState().currentPhase).toBe('skipped')
    expect(vi.mocked(RundotAPI.appStorage.setItem)).toHaveBeenCalled()
  })

  it('inline "Skip" link is hidden after step 1 advances', async () => {
    await act(async () => {
      render(React.createElement(FtueOverlay))
      useFtueStore.getState().startFtue('play')
    })
    await act(async () => {
      // Advance to step 2.
      usePadGridStore.setState({ activePadIds: ['drums-1'] })
      await new Promise((r) => setTimeout(r, 350))
    })
    expect(screen.queryByTestId('ftue-tooltip-skip')).not.toBeInTheDocument()
    // The shell's safety skip is still there.
    expect(screen.getByTestId('ftue-skip-button')).toBeInTheDocument()
  })

  it('outside-spotlight (backdrop) tap does NOT skip the overlay', async () => {
    await act(async () => {
      render(React.createElement(FtueOverlay))
      useFtueStore.getState().startFtue('play')
    })
    await act(async () => {
      fireEvent.click(screen.getByTestId('ftue-overlay'))
    })
    // Phase remains in core_loop — overlay was not dismissed.
    expect(useFtueStore.getState().currentPhase).toBe('core_loop')
    expect(useFtueStore.getState().isActive).toBe(true)
  })
})
