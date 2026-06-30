import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { subscriptionNativeStore } from './SubscriptionNative'

beforeEach(() => {
  subscriptionNativeStore.getState().reset()
  vi.clearAllMocks()
})

describe('SubscriptionNative', () => {
  describe('checkStatus', () => {
    it('updates store when user is subscribed', async () => {
      vi.mocked(RundotAPI['iap']['isUserSubscribed']).mockResolvedValueOnce(true)

      await subscriptionNativeStore.getState().checkStatus('PLUS')
      const state = subscriptionNativeStore.getState()
      expect(state.isSubscribed).toBe(true)
      expect(state.currentTier).toBe('PLUS')
      expect(state.isLoading).toBe(false)
    })

    it('clears subscription when user is not subscribed', async () => {
      vi.mocked(RundotAPI['iap']['isUserSubscribed']).mockResolvedValueOnce(false)

      await subscriptionNativeStore.getState().checkStatus('PLUS')
      const state = subscriptionNativeStore.getState()
      expect(state.isSubscribed).toBe(false)
      expect(state.currentTier).toBeNull()
    })

    it('handles error', async () => {
      vi.mocked(RundotAPI['iap']['isUserSubscribed']).mockRejectedValueOnce(new Error('Network'))

      await subscriptionNativeStore.getState().checkStatus('PLUS')
      expect(subscriptionNativeStore.getState().error).toBe('Network')
      expect(subscriptionNativeStore.getState().isLoading).toBe(false)
    })
  })

  describe('fetchSubscriptions', () => {
    it('fetches and stores subscriptions', async () => {
      const mockResponse = {
        PLUS: [
          { interval: 'MONTHLY' as const, price: 4.99, currencyCode: 'USD', description: 'Monthly Plus' },
          { interval: 'ANNUAL' as const, price: 39.99, currencyCode: 'USD', description: 'Annual Plus' },
        ],
      }
      vi.mocked(RundotAPI['iap']['getSubscriptions']).mockResolvedValueOnce(mockResponse)

      await subscriptionNativeStore.getState().fetchSubscriptions('PLUS')
      expect(subscriptionNativeStore.getState().subscriptions).toEqual(mockResponse)
      expect(subscriptionNativeStore.getState().isLoading).toBe(false)
    })

    it('fetches all tiers when no tier specified', async () => {
      const mockResponse = {
        CORE: [{ interval: 'MONTHLY' as const, price: 2.99, currencyCode: 'USD', description: 'Monthly Core' }],
        PLUS: [{ interval: 'MONTHLY' as const, price: 4.99, currencyCode: 'USD', description: 'Monthly Plus' }],
      }
      vi.mocked(RundotAPI['iap']['getSubscriptions']).mockResolvedValueOnce(mockResponse)

      await subscriptionNativeStore.getState().fetchSubscriptions()
      expect(subscriptionNativeStore.getState().subscriptions).toEqual(mockResponse)
    })

    it('handles error', async () => {
      vi.mocked(RundotAPI['iap']['getSubscriptions']).mockRejectedValueOnce(new Error('Timeout'))

      await subscriptionNativeStore.getState().fetchSubscriptions('PLUS')
      expect(subscriptionNativeStore.getState().error).toBe('Timeout')
    })
  })

  describe('purchase', () => {
    it('purchases subscription and updates state', async () => {
      vi.mocked(RundotAPI['iap']['purchaseSubscription']).mockResolvedValueOnce({ success: true })

      const result = await subscriptionNativeStore.getState().purchase('PLUS', 'MONTHLY')
      expect(result.success).toBe(true)
      expect(subscriptionNativeStore.getState().isSubscribed).toBe(true)
      expect(subscriptionNativeStore.getState().currentTier).toBe('PLUS')
    })

    it('does not update state on failed purchase', async () => {
      vi.mocked(RundotAPI['iap']['purchaseSubscription']).mockResolvedValueOnce({ success: false })

      const result = await subscriptionNativeStore.getState().purchase('PLUS', 'MONTHLY')
      expect(result.success).toBe(false)
      expect(subscriptionNativeStore.getState().isSubscribed).toBe(false)
    })

    it('handles purchase error', async () => {
      vi.mocked(RundotAPI['iap']['purchaseSubscription']).mockRejectedValueOnce(new Error('Cancelled'))

      const result = await subscriptionNativeStore.getState().purchase('PLUS', 'MONTHLY')
      expect(result.success).toBe(false)
      expect(subscriptionNativeStore.getState().error).toBe('Cancelled')
    })
  })

  it('reset clears state', async () => {
    vi.mocked(RundotAPI['iap']['isUserSubscribed']).mockResolvedValueOnce(true)
    await subscriptionNativeStore.getState().checkStatus('PLUS')
    subscriptionNativeStore.getState().reset()

    const state = subscriptionNativeStore.getState()
    expect(state.isSubscribed).toBe(false)
    expect(state.currentTier).toBeNull()
    expect(state.subscriptions).toEqual({})
  })
})
