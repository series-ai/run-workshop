import { create } from 'zustand'
import type { DailyReward, PlatformTier, SubscriptionState, SubscriptionTier, TierBenefits } from './types'
import { subscriptionConfig } from './config'
import type { PersistenceManager } from '@modules/data/storage-service/PersistenceManager'

// NOTE: At the game-install-module step, this import path gets rewritten to:
// import type { PersistenceManager } from '../services/PersistenceManager'

interface SubscriptionStore extends SubscriptionState {
  setSubscription: (tier: PlatformTier, expiresAt: number | null) => void
  syncFromPlatform: (tier: PlatformTier | null) => void
  isActive: () => boolean
  hasBenefit: (benefit: string) => boolean
  getMultiplier: (type: 'rewards') => number
  getSubscriptionRewards: () => TierBenefits | null
  canClaimDaily: (now?: number) => boolean
  claimDaily: (now?: number) => DailyReward | null
  getTimeUntilDailyClaim: (now?: number) => number
  reset: () => void
}

const PERSIST_KEY = 'subscription-vip:v1'
const DAILY_COOLDOWN_MS = 86400000

let _pm: PersistenceManager | undefined

const initialState: SubscriptionState = {
  tier: 'none',
  expiresAt: null,
  benefits: [],
  lastDailyClaimAt: null,
}

/** Map legacy tier names from older persisted data to platform tiers. */
function migrateTier(tier: string): SubscriptionTier {
  if (tier === 'basic') return 'CORE'
  if (tier === 'premium') return 'PLUS'
  return tier as SubscriptionTier
}

export const subscriptionStore = create<SubscriptionStore>((set, get) => ({
  ...initialState,

  setSubscription(tier: PlatformTier, expiresAt: number | null) {
    const config = subscriptionConfig[tier]
    set({ tier, expiresAt, benefits: config?.benefits ?? [] })
    _pm?.markDirty(PERSIST_KEY)
  },

  syncFromPlatform(tier: PlatformTier | null) {
    if (tier === null) {
      set({ tier: 'none', expiresAt: null, benefits: [] })
    } else {
      const config = subscriptionConfig[tier]
      set({ tier, expiresAt: null, benefits: config?.benefits ?? [] })
    }
    _pm?.markDirty(PERSIST_KEY)
  },

  isActive() {
    const { tier, expiresAt } = get()
    if (tier === 'none') return false
    if (expiresAt === null) return true
    return Date.now() < expiresAt
  },

  hasBenefit(benefit: string) {
    return get().benefits.includes(benefit)
  },

  getMultiplier(_type: 'rewards') {
    const { tier } = get()
    if (tier === 'none') return 1
    return subscriptionConfig[tier]?.rewardMultiplier ?? 1
  },

  getSubscriptionRewards(): TierBenefits | null {
    const { tier } = get()
    if (tier === 'none') return null
    if (!get().isActive()) return null
    return subscriptionConfig[tier] ?? null
  },

  canClaimDaily(now?: number) {
    const t = now ?? Date.now()
    if (!get().isActive()) return false
    const { lastDailyClaimAt } = get()
    if (lastDailyClaimAt === null) return true
    return t - lastDailyClaimAt >= DAILY_COOLDOWN_MS
  },

  claimDaily(now?: number) {
    const t = now ?? Date.now()
    if (!get().canClaimDaily(t)) return null
    const { tier } = get()
    if (tier === 'none') return null
    const reward = subscriptionConfig[tier]?.dailyReward
    if (!reward) return null
    set({ lastDailyClaimAt: t })
    _pm?.markDirty(PERSIST_KEY)
    return { ...reward }
  },

  getTimeUntilDailyClaim(now?: number) {
    const t = now ?? Date.now()
    if (get().canClaimDaily(t)) return 0
    const { lastDailyClaimAt } = get()
    if (lastDailyClaimAt === null) return 0
    return DAILY_COOLDOWN_MS - (t - lastDailyClaimAt)
  },

  reset() {
    set(initialState)
    _pm?.markDirty(PERSIST_KEY)
  },
}))

export function setupPersistence(pm: PersistenceManager): void {
  _pm = pm
  pm.register(PERSIST_KEY, {
    serialize: () => {
      const { tier, expiresAt, benefits, lastDailyClaimAt } = subscriptionStore.getState()
      return { tier, expiresAt, benefits, lastDailyClaimAt }
    },
    deserialize: (data: Pick<SubscriptionState, 'tier' | 'expiresAt' | 'benefits' | 'lastDailyClaimAt'>) => {
      subscriptionStore.setState({ ...data, tier: migrateTier(data.tier) })
    },
  })
}
