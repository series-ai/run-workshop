import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from '../debug-console/access'
import {
  clearTuningRegistryForTesting,
  registerTunable,
} from './registry'
import {
  resetTuningOverlayStateForTesting,
  setTuningOverlayEnabled,
} from './state'
import { TuningOverlay } from './TuningOverlay'

describe('tuning integration', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
  })

  it('registers a mock tunable, enables the overlay, and propagates slider changes to the setter', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    let remoteValue = 5
    const set = vi.fn((next: number) => {
      remoteValue = next
    })

    registerTunable({
      id: 'jump:height',
      label: 'Jump Height',
      folder: 'Jump',
      type: 'number',
      min: 0,
      max: 20,
      step: 0.5,
      initialValue: 5,
      get: () => remoteValue,
      set,
    })

    render(<TuningOverlay />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('tuning-overlay')).toBeInTheDocument()
    expect(screen.getByText('Jump Height')).toBeInTheDocument()

    const slider = screen.getByTestId('tuning-control-jump:height') as HTMLInputElement
    expect(slider.tagName).toBe('INPUT')
    expect(slider.type).toBe('range')

    fireEvent.change(slider, { target: { value: '12' } })

    expect(set).toHaveBeenCalledWith(12)
    expect(remoteValue).toBe(12)

    await act(async () => {
      await setTuningOverlayEnabled(false)
    })
  })
})
