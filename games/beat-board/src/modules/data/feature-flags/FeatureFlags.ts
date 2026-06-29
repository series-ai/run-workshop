import { create } from 'zustand'
import type { FeatureFlagDebugSnapshot, FeatureFlags, FlagStore } from './types'
import { defaultFeatureFlags } from './config'

interface FeatureFlagStoreState extends FlagStore {
  _baseFlags: FeatureFlags
  _overrides: FeatureFlags
}

function createDebugSnapshot(state: Pick<FeatureFlagStoreState, 'flags' | '_baseFlags' | '_overrides'>): FeatureFlagDebugSnapshot {
  return {
    flags: { ...state.flags },
    baseFlags: { ...state._baseFlags },
    overrides: { ...state._overrides },
  }
}

export const featureFlagStore = create<FeatureFlagStoreState>()((set, get) => ({
  _baseFlags: { ...defaultFeatureFlags },
  _overrides: {},
  flags: { ...defaultFeatureFlags },

  enable(key: string) {
    set((state) => {
      const flags = { ...state._baseFlags, [key]: true }
      return { _baseFlags: flags, flags: { ...flags, ...state._overrides } }
    })
  },

  disable(key: string) {
    set((state) => {
      const flags = { ...state._baseFlags, [key]: false }
      return { _baseFlags: flags, flags: { ...flags, ...state._overrides } }
    })
  },

  isEnabled(key: string): boolean {
    const { _overrides, _baseFlags } = get()
    const override = _overrides[key]
    if (override !== undefined) return override
    return _baseFlags[key] ?? false
  },

  override(key: string, value: boolean) {
    const devValue = import.meta.env['DEV']
    if (devValue !== true) {
      throw new Error(`[FeatureFlags] override() is only available in DEV mode`)
    }
    set((state) => {
      const overrides = { ...state._overrides, [key]: value }
      return { _overrides: overrides, flags: { ...state._baseFlags, ...overrides } }
    })
  },

  resetOverrides() {
    set((state) => ({
      _overrides: {},
      flags: { ...state._baseFlags },
    }))
  },

  getDebugSnapshot() {
    return createDebugSnapshot(get())
  },
}))
