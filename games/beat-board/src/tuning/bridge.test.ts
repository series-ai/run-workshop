import { beforeEach, describe, expect, it, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  clearTuningRegistryForTesting,
  registerTunable,
} from './registry'
import { tuningBridge } from './bridge'
import {
  resetTuningOverlayStateForTesting,
  getTuningOverlayState,
} from './state'
import {
  clearDebugConsoleAccessOverride,
  setDebugConsoleAccessOverride,
} from '../debug-console/access'

describe('tuning bridge', () => {
  beforeEach(() => {
    clearTuningRegistryForTesting()
    resetTuningOverlayStateForTesting()
    clearDebugConsoleAccessOverride()
    vi.mocked(RundotAPI.error).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.setItem).mockReset()
    vi.mocked(RundotAPI.deviceCache.getItem).mockResolvedValue(null)
    vi.mocked(RundotAPI.deviceCache.setItem).mockResolvedValue(undefined)
  })

  it('setEnabled flips overlay visibility', async () => {
    setDebugConsoleAccessOverride('editor')
    await tuningBridge.setEnabled(true)
    expect(getTuningOverlayState().userEnabled).toBe(true)
    expect(tuningBridge.isEnabled()).toBe(true)
  })

  it('setValue for number clamps and snaps to step', () => {
    const set = vi.fn()
    registerTunable({
      id: 'gravity',
      label: 'Gravity',
      folder: 'Physics',
      type: 'number',
      min: 0,
      max: 10,
      step: 0.5,
      initialValue: 5,
      get: () => 5,
      set,
    })

    tuningBridge.setValue('gravity', 100)
    expect(set).toHaveBeenLastCalledWith(10)

    tuningBridge.setValue('gravity', 3.7)
    expect(set).toHaveBeenLastCalledWith(3.5)
  })

  it('setValue for vec3 clamps and snaps each component and forwards the full object', () => {
    const set = vi.fn()
    registerTunable({
      id: 'pos',
      label: 'Pos',
      folder: 'Scene',
      type: 'vec3',
      min: -5,
      max: 5,
      step: 1,
      initialValue: { x: 0, y: 0, z: 0 },
      get: () => ({ x: 0, y: 0, z: 0 }),
      set,
    })

    tuningBridge.setValue('pos', { x: 100, y: -100, z: 2.3 })

    expect(set).toHaveBeenCalledWith({ x: 5, y: -5, z: 2 })
  })

  it('setValue normalizes color hex to lowercase and rejects malformed values', () => {
    const set = vi.fn()
    registerTunable({
      id: 'tint',
      label: 'Tint',
      folder: 'Color',
      type: 'color',
      initialValue: '#ff00aa',
      get: () => '#ff00aa',
      set,
    })

    tuningBridge.setValue('tint', '#AABBCC')
    expect(set).toHaveBeenLastCalledWith('#aabbcc')

    tuningBridge.setValue('tint', 'red')
    expect(set).toHaveBeenCalledTimes(1) // still just the first call
    expect(vi.mocked(RundotAPI.error)).toHaveBeenCalled()
  })

  it('setValue rejects string values not in options for a select-type descriptor', () => {
    const set = vi.fn()
    registerTunable({
      id: 'mode',
      label: 'Mode',
      folder: 'Settings',
      type: 'string',
      options: ['easy', 'hard'],
      initialValue: 'easy',
      get: () => 'easy',
      set,
    })

    tuningBridge.setValue('mode', 'impossible')

    expect(set).not.toHaveBeenCalled()
    expect(vi.mocked(RundotAPI.error)).toHaveBeenCalled()
  })

  it('setValue logs and returns for an unknown id', () => {
    tuningBridge.setValue('nonexistent', 42)
    expect(vi.mocked(RundotAPI.error)).toHaveBeenCalled()
  })

  it('getRegisteredIds returns a snapshot of registered ids', () => {
    registerTunable({
      id: 'a',
      label: 'A',
      folder: 'X',
      type: 'number',
      min: 0,
      max: 1,
      step: 1,
      initialValue: 0,
      get: () => 0,
      set: () => undefined,
    })
    registerTunable({
      id: 'b',
      label: 'B',
      folder: 'X',
      type: 'boolean',
      initialValue: false,
      get: () => false,
      set: () => undefined,
    })

    expect(tuningBridge.getRegisteredIds()).toEqual(['a', 'b'])
  })

  it('getValue invokes the descriptor get callback and returns undefined on throw', () => {
    registerTunable({
      id: 'ok',
      label: 'Ok',
      folder: 'X',
      type: 'number',
      min: 0,
      max: 10,
      step: 1,
      initialValue: 5,
      get: () => 7,
      set: () => undefined,
    })
    registerTunable({
      id: 'bad',
      label: 'Bad',
      folder: 'X',
      type: 'number',
      min: 0,
      max: 10,
      step: 1,
      initialValue: 5,
      get: () => {
        throw new Error('boom')
      },
      set: () => undefined,
    })

    expect(tuningBridge.getValue('ok')).toBe(7)
    expect(tuningBridge.getValue('bad')).toBeUndefined()
    expect(tuningBridge.getValue('missing')).toBeUndefined()
  })
})
