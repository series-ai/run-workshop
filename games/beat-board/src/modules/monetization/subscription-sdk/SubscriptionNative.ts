import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { NativeSubscriptionState, SubscriptionTier, SubscriptionInterval } from './types'

interface NativeSubscriptionStore extends NativeSubscriptionState {
  checkStatus(tier: SubscriptionTier): Promise<void>
  fetchSubscriptions(tier?: SubscriptionTier): Promise<void>
  purchase(tier: SubscriptionTier, interval: SubscriptionInterval): Promise<{ success: boolean }>
  reset(): void
}

const initialState: NativeSubscriptionState = {
  isSubscribed: false,
  currentTier: null,
  subscriptions: {},
  isLoading: false,
  error: null,
}

export const subscriptionNativeStore = create<NativeSubscriptionStore>((set) => ({
  ...initialState,

  async checkStatus(tier: SubscriptionTier): Promise<void> {
    set({ isLoading: true, error: null })
    try {
      const subscribed = await RundotAPI['iap']['isUserSubscribed'](tier)
      set({
        isSubscribed: subscribed,
        currentTier: subscribed ? tier : null,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Failed to check status' })
    }
  },

  async fetchSubscriptions(tier?: SubscriptionTier): Promise<void> {
    set({ isLoading: true, error: null })
    try {
      const subscriptions = await RundotAPI['iap']['getSubscriptions'](tier)
      set({ subscriptions, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Failed to fetch subscriptions' })
    }
  },

  async purchase(tier: SubscriptionTier, interval: SubscriptionInterval): Promise<{ success: boolean }> {
    set({ isLoading: true, error: null })
    try {
      const result = await RundotAPI['iap']['purchaseSubscription'](tier, interval)
      set({ isLoading: false })
      if (result.success) {
        set({ isSubscribed: true, currentTier: tier })
      }
      return result
    } catch (err) {
      set({ isLoading: false, error: (err as Error).message ?? 'Purchase failed' })
      return { success: false }
    }
  },

  reset(): void {
    set(initialState)
  },
}))
