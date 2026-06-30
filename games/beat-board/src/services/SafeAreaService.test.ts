import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@series-inc/rundot-game-sdk/api', () => ({
  default: {},
}))

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { refreshSafeArea } from './SafeAreaService'

describe('refreshSafeArea', () => {
  beforeEach(() => {
    const root = document.documentElement
    for (const key of ['--safe-top', '--safe-right', '--safe-bottom', '--safe-left']) {
      root.style.removeProperty(key)
    }
    delete (RundotAPI as unknown as { system?: unknown }).system
  })

  it('writes zeros when host does not implement getSafeArea', () => {
    const insets = refreshSafeArea()
    expect(insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('0px')
  })

  it('publishes the host insets as CSS variables', () => {
    ;(RundotAPI as unknown as { system: { getSafeArea: () => unknown } }).system = {
      getSafeArea: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
    }
    const insets = refreshSafeArea()
    expect(insets).toEqual({ top: 47, right: 0, bottom: 34, left: 0 })
    expect(document.documentElement.style.getPropertyValue('--safe-top')).toBe('47px')
    expect(document.documentElement.style.getPropertyValue('--safe-bottom')).toBe('34px')
  })

  it('clamps negative or non-finite values to zero', () => {
    ;(RundotAPI as unknown as { system: { getSafeArea: () => unknown } }).system = {
      getSafeArea: () => ({ top: -5, right: Number.NaN, bottom: 34, left: Infinity }),
    }
    const insets = refreshSafeArea()
    expect(insets).toEqual({ top: 0, right: 0, bottom: 34, left: 0 })
  })

  it('tolerates a throwing host method', () => {
    ;(RundotAPI as unknown as { system: { getSafeArea: () => unknown } }).system = {
      getSafeArea: () => {
        throw new Error('host not ready')
      },
    }
    expect(() => refreshSafeArea()).toThrow('host not ready')
    // Documented: we do not swallow host errors. Caller decides.
  })
})
