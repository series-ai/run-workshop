// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useRunbucksIcon, fetchRunbucksIconUrl, resetRunbucksIconCache } from './useRunbucksIcon'

beforeEach(() => {
  resetRunbucksIconCache()
  vi.clearAllMocks()
})

describe('useRunbucksIcon', () => {
  it('fetches icon from SDK and returns base64 data URL', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockResolvedValueOnce({
      base64Data: 'iVBORw0KGgo=',
    })

    const { result } = renderHook(() => useRunbucksIcon())
    expect(result.current).toBeNull()

    await waitFor(() => {
      expect(result.current).toBe('data:image/png;base64,iVBORw0KGgo=')
    })
  })

  it('returns null when SDK call fails', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockRejectedValueOnce(new Error('fail'))

    const { result } = renderHook(() => useRunbucksIcon())

    // Wait for the promise to settle
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current).toBeNull()
  })

  it('caches icon across multiple hook instances', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockResolvedValueOnce({
      base64Data: 'abc123',
    })

    const { result: result1 } = renderHook(() => useRunbucksIcon())
    await waitFor(() => {
      expect(result1.current).toBe('data:image/png;base64,abc123')
    })

    // Second instance should return cached value immediately
    const { result: result2 } = renderHook(() => useRunbucksIcon())
    expect(result2.current).toBe('data:image/png;base64,abc123')
    expect(vi.mocked(RundotAPI.iap.getCurrencyIcon)).toHaveBeenCalledTimes(1)
  })

  it('returns null when base64Data is empty', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockResolvedValueOnce({
      base64Data: '',
    })

    const { result } = renderHook(() => useRunbucksIcon())
    await new Promise((r) => setTimeout(r, 10))
    expect(result.current).toBeNull()
  })
})

describe('fetchRunbucksIconUrl', () => {
  it('fetches and returns base64 data URL', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockResolvedValueOnce({
      base64Data: 'xyz789',
    })

    const url = await fetchRunbucksIconUrl()
    expect(url).toBe('data:image/png;base64,xyz789')
  })

  it('returns cached value on subsequent calls', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockResolvedValueOnce({
      base64Data: 'cached',
    })

    await fetchRunbucksIconUrl()
    const url = await fetchRunbucksIconUrl()
    expect(url).toBe('data:image/png;base64,cached')
    expect(vi.mocked(RundotAPI.iap.getCurrencyIcon)).toHaveBeenCalledTimes(1)
  })

  it('returns null on error', async () => {
    vi.mocked(RundotAPI.iap.getCurrencyIcon).mockRejectedValueOnce(new Error('fail'))

    const url = await fetchRunbucksIconUrl()
    expect(url).toBeNull()
  })
})
