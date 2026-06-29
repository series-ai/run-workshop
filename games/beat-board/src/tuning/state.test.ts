import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from '../debug-console/access'
import {
  TUNING_OVERLAY_STORAGE_KEY,
  getTuningOverlayState,
  loadTuningOverlayPreference,
  resetTuningOverlayStateForTesting,
  setTuningOverlayEnabled,
  subscribeToTuningOverlayState,
} from './state'

describe('tuning overlay state', () => {
  beforeEach(() => {
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
  })

  it('defaults to hidden before the deviceCache preference is loaded', () => {
    expect(getTuningOverlayState().visible).toBe(false)
  })

  it('becomes visible after loadTuningOverlayPreference resolves true for an editor', async () => {
    setDebugConsoleAccessOverride('editor')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    await loadTuningOverlayPreference()

    expect(getTuningOverlayState().visible).toBe(true)
    expect(vi.mocked(RundotAPI.deviceCache.getItem)).toHaveBeenCalledWith(
      TUNING_OVERLAY_STORAGE_KEY,
    )
  })

  it('stays hidden when deviceCache is true but the user is below editor access', async () => {
    setDebugConsoleAccessOverride('player')
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue('true')

    await loadTuningOverlayPreference()

    expect(getTuningOverlayState().visible).toBe(false)
  })

  it('setTuningOverlayEnabled(true) flips visible immediately and persists to deviceCache', async () => {
    setDebugConsoleAccessOverride('editor')

    await setTuningOverlayEnabled(true)

    expect(getTuningOverlayState().visible).toBe(true)
    expect(vi.mocked(RundotAPI.deviceCache.setItem)).toHaveBeenCalledWith(
      TUNING_OVERLAY_STORAGE_KEY,
      'true',
    )
  })

  it('notifies subscribers when the visible flag changes', async () => {
    setDebugConsoleAccessOverride('editor')
    const listener = vi.fn()
    const unsubscribe = subscribeToTuningOverlayState(listener)

    await setTuningOverlayEnabled(true)

    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('does not let a late deviceCache restore overwrite an early setTuningOverlayEnabled call', async () => {
    setDebugConsoleAccessOverride('editor')

    // Hold the deviceCache get pending so setEnabled fires first.
    let resolveGet: ((value: string | null) => void) | undefined
    vi.mocked(RundotAPI.deviceCache.getItem).mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          resolveGet = resolve
        }),
    )

    const loadPromise = loadTuningOverlayPreference()
    await setTuningOverlayEnabled(true)

    expect(getTuningOverlayState().visible).toBe(true)

    // Now resolve deviceCache with the pre-existing 'false' value.
    resolveGet?.(null)
    await loadPromise

    // Bridge override wins — visible stays true.
    expect(getTuningOverlayState().visible).toBe(true)
    expect(getTuningOverlayState().userEnabled).toBe(true)
    expect(getTuningOverlayState().preferenceLoaded).toBe(true)
  })
})
