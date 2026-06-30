import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { createDebugConsoleAccess } from '../access'
import {
  resetTuningOverlayStateForTesting,
  getTuningOverlayState,
  TUNING_OVERLAY_STORAGE_KEY,
} from '../../tuning/state'
import { createDebugConsoleModule } from './tuning.debug-console'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from '../access'
import {
  clearTuningRegistryForTesting,
  registerTunable,
} from '../../tuning/registry'

describe('tuning.debug-console module', () => {
  beforeEach(() => {
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    clearTuningRegistryForTesting()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
  })

  it('exposes a toggle-tuning-overlay command', () => {
    const bootstrap = {
      getAccess: () => createDebugConsoleAccess('editor'),
      getCurrentScreen: () => 'home',
      getBinding: () => undefined,
    }

    const module = createDebugConsoleModule(bootstrap)
    expect(Array.isArray(module)).toBe(false)
    expect(module).toBeTruthy()

    const singleModule = Array.isArray(module) ? module[0] : module
    const toggle = singleModule?.commands?.find(
      (cmd) => cmd.id === 'set-tuning-overlay',
    )

    expect(toggle).toBeTruthy()
    expect(singleModule?.minimumRole).toBe('editor')
    expect(toggle?.minimumRole).toBeUndefined() // inherits from module
  })

  it('toggle command persists the new state to deviceCache', async () => {
    setDebugConsoleAccessOverride('editor')
    const bootstrap = {
      getAccess: () => createDebugConsoleAccess('editor'),
      getCurrentScreen: () => 'home',
      getBinding: () => undefined,
    }

    const module = createDebugConsoleModule(bootstrap)
    const singleModule = Array.isArray(module) ? module[0] : module
    const toggle = singleModule?.commands?.find(
      (cmd) => cmd.id === 'set-tuning-overlay',
    )

    if (!toggle) {
      throw new Error('toggle command missing')
    }

    await toggle.execute(
      { enabled: 'on' },
      {
        access: createDebugConsoleAccess('editor'),
        currentScreen: 'home',
      },
    )

    expect(getTuningOverlayState().userEnabled).toBe(true)
    expect(vi.mocked(RundotAPI.deviceCache.setItem)).toHaveBeenCalledWith(
      TUNING_OVERLAY_STORAGE_KEY,
      'true',
    )
  })

  it('exposes a reset-all-tunables command that invokes each setter with its initialValue', async () => {
    const set = vi.fn()
    registerTunable({
      id: 'demo:value',
      label: 'Value',
      folder: 'Demo',
      type: 'number',
      min: 0,
      max: 10,
      step: 1,
      initialValue: 7,
      get: () => 0,
      set,
    })

    const bootstrap = {
      getAccess: () => createDebugConsoleAccess('editor'),
      getCurrentScreen: () => 'home',
      getBinding: () => undefined,
    }
    const module = createDebugConsoleModule(bootstrap)
    const singleModule = Array.isArray(module) ? module[0] : module
    const reset = singleModule?.commands?.find(
      (cmd) => cmd.id === 'reset-all-tunables',
    )

    if (!reset) {
      throw new Error('reset-all-tunables command missing')
    }

    await reset.execute(
      {},
      {
        access: createDebugConsoleAccess('editor'),
        currentScreen: 'home',
      },
    )

    expect(set).toHaveBeenCalledWith(7)
  })
})
