import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRewardedAdStore, type AdsProvider } from './RewardedAdFlow'

let mockAds: AdsProvider
let store: ReturnType<typeof createRewardedAdStore>

beforeEach(() => {
  mockAds = { showRewarded: vi.fn().mockResolvedValue(true) }
  store = createRewardedAdStore(mockAds, 'test-placement')
})

describe('RewardedAdFlow', () => {
  it('showAd calls ads.showRewarded when can show', async () => {
    const result = await store.getState().showAd()
    expect(result.watched).toBe(true)
    expect(mockAds.showRewarded).toHaveBeenCalledWith('test-placement')
  })

  it('watchCount increments on watch', async () => {
    await store.getState().showAd()
    expect(store.getState().watchCount).toBe(1)
  })

  it('showAd returns watched: false when ads.showRewarded returns false', async () => {
    vi.mocked(mockAds.showRewarded).mockResolvedValueOnce(false)
    const result = await store.getState().showAd()
    expect(result.watched).toBe(false)
  })

  it('showAd returns watched: false when daily limit reached', async () => {
    store.setState({ watchCount: 5 })
    const result = await store.getState().showAd()
    expect(result.watched).toBe(false)
  })

  it('canShowAd false when at limit', () => {
    store.setState({ watchCount: 5 })
    expect(store.getState().canShowAd()).toBe(false)
  })

  it('canShowAd true when below limit', () => {
    expect(store.getState().canShowAd()).toBe(true)
  })

  it('watchCount does not increment when ad not watched', async () => {
    vi.mocked(mockAds.showRewarded).mockResolvedValueOnce(false)
    await store.getState().showAd()
    expect(store.getState().watchCount).toBe(0)
  })
})
