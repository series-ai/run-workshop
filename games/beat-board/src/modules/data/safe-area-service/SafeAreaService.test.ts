import { describe, it, expect } from 'vitest'
import { deriveSafeAreaPolicy } from './SafeAreaService'
import type { SafeAreaInsets } from './SafeAreaService'

describe('deriveSafeAreaPolicy', () => {
  const viewport = 390

  it('zero insets produce zero policy', () => {
    const policy = deriveSafeAreaPolicy({ top: 0, right: 0, bottom: 0, left: 0 }, viewport)
    expect(policy.topSafeStrip).toBe(0)
    expect(policy.hudTopShift).toBe(0)
    expect(policy.popupTopShift).toBe(0)
  })

  it('top inset maps to topSafeStrip', () => {
    const policy = deriveSafeAreaPolicy({ top: 44, right: 0, bottom: 34, left: 0 }, viewport)
    expect(policy.topSafeStrip).toBe(44)
  })

  it('negative top is clamped to 0', () => {
    const policy = deriveSafeAreaPolicy({ top: -10, right: 0, bottom: 0, left: 0 }, viewport)
    expect(policy.topSafeStrip).toBe(0)
  })
})

// normalizeSafeArea is an internal function tested indirectly via refreshFromHost.
// We test the pure deriveSafeAreaPolicy function directly.

describe('SafeAreaInsets type', () => {
  it('all fields are numbers', () => {
    const insets: SafeAreaInsets = { top: 44, right: 0, bottom: 34, left: 0 }
    expect(typeof insets.top).toBe('number')
    expect(typeof insets.bottom).toBe('number')
  })
})
