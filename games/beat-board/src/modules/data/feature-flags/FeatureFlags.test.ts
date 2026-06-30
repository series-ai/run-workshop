import { describe, it, expect, beforeEach } from 'vitest'
import { featureFlagStore } from './FeatureFlags'

beforeEach(() => {
  // Reset store to clean state between tests
  featureFlagStore.setState({
    _baseFlags: {},
    _overrides: {},
    flags: {},
  })
})

describe('FeatureFlags', () => {
  it('isEnabled returns false for unknown flags', () => {
    expect(featureFlagStore.getState().isEnabled('nonexistent')).toBe(false)
  })

  it('enable changes flag to true', () => {
    featureFlagStore.getState().enable('newFeature')
    expect(featureFlagStore.getState().isEnabled('newFeature')).toBe(true)
  })

  it('disable changes flag to false', () => {
    featureFlagStore.getState().enable('newFeature')
    featureFlagStore.getState().disable('newFeature')
    expect(featureFlagStore.getState().isEnabled('newFeature')).toBe(false)
  })

  it('override changes value (dev mode)', () => {
    featureFlagStore.getState().enable('someFlag')
    featureFlagStore.getState().override('someFlag', false)
    expect(featureFlagStore.getState().isEnabled('someFlag')).toBe(false)
  })

  it('resetOverrides removes overrides and restores base flags', () => {
    featureFlagStore.getState().enable('myFlag')
    featureFlagStore.getState().override('myFlag', false)
    expect(featureFlagStore.getState().isEnabled('myFlag')).toBe(false)
    featureFlagStore.getState().resetOverrides()
    expect(featureFlagStore.getState().isEnabled('myFlag')).toBe(true)
  })

  it('base flags set at creation time are respected', () => {
    featureFlagStore.setState({
      _baseFlags: { existingFlag: true },
      _overrides: {},
      flags: { existingFlag: true },
    })
    expect(featureFlagStore.getState().isEnabled('existingFlag')).toBe(true)
  })

  it('exposes a public debug snapshot without relying on private fields', () => {
    featureFlagStore.setState({
      _baseFlags: { economyV2: false },
      _overrides: { economyV2: true },
      flags: { economyV2: true },
    })

    expect(featureFlagStore.getState().getDebugSnapshot()).toEqual({
      baseFlags: { economyV2: false },
      overrides: { economyV2: true },
      flags: { economyV2: true },
    })
  })
})
