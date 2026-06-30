import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isPollingSuspended,
  resetPollingSuspensionForTesting,
  suspendPolling,
} from './polling'
import { useTunablePolling } from './useTunablePolling'

describe('useTunablePolling', () => {
  beforeEach(() => {
    resetPollingSuspensionForTesting()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('invokes poll on a coarse interval', () => {
    const poll = vi.fn()
    renderHook(() => useTunablePolling('id', poll, { intervalMs: 100 }))

    expect(poll).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(poll).toHaveBeenCalledTimes(2)
  })

  it('skips poll while the id is suspended', () => {
    const poll = vi.fn()
    renderHook(() => useTunablePolling('id', poll, { intervalMs: 100 }))

    suspendPolling('id')
    expect(isPollingSuspended('id')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(poll).not.toHaveBeenCalled()
  })

  it('does not schedule when disabled', () => {
    const poll = vi.fn()
    renderHook(() =>
      useTunablePolling('id', poll, { intervalMs: 100, enabled: false }),
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(poll).not.toHaveBeenCalled()
  })
})
