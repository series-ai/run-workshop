import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import type { RewardedAdState } from './types'
import { rewardedAdConfig } from './config'

/** Minimal interface for the ads dependency. Matches adsService.showRewarded(). */
export interface AdsProvider {
  showRewarded(placement: string): Promise<boolean>
}

interface RewardedAdStore extends RewardedAdState {
  showAd: () => Promise<{ watched: boolean }>
  canShowAd: () => boolean
  resetDailyCount: () => void
  getWatchCount: () => number
  reset: () => void
}

const initialState: RewardedAdState = {
  isAvailable: true,
  isLoading: false,
  watchCount: 0,
  lastWatchedAt: 0,
  dailyLimit: rewardedAdConfig.dailyLimit,
}

/**
 * Factory that creates a rewarded-ad Zustand store.
 *
 * @param ads — An object with `showRewarded(placement)`. Pass `adsService` from
 *   the `ads-service` module, or any adapter that wraps your SDK calls.
 * @param placement — Ad placement identifier for analytics (default: 'rewarded')
 */
export function createRewardedAdStore(
  ads: AdsProvider,
  placement = 'rewarded',
) {
  return create<RewardedAdStore>((set, get) => ({
    ...initialState,

    async showAd() {
      if (!get().canShowAd()) return { watched: false }
      set({ isLoading: true })
      try {
        const watched = await ads.showRewarded(placement)
        if (watched) {
          set(state => ({
            isLoading: false,
            watchCount: state.watchCount + 1,
            lastWatchedAt: Date.now(),
          }))
          return { watched: true }
        }
        set({ isLoading: false })
        return { watched: false }
      } catch (err) {
        RundotAPI.error('RewardedAdFlow.showAd:', err)
        set({ isLoading: false })
        return { watched: false }
      }
    },

    canShowAd() {
      const { watchCount, dailyLimit, isLoading } = get()
      return !isLoading && watchCount < dailyLimit
    },

    resetDailyCount() {
      set({ watchCount: 0 })
    },

    getWatchCount() {
      return get().watchCount
    },

    reset() {
      set(initialState)
    },
  }))
}
