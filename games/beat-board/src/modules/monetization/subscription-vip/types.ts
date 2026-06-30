export type PlatformTier = 'CORE' | 'PLUS' | 'PRIME' | 'ULTIMATE'
export type SubscriptionTier = 'none' | PlatformTier

export interface DailyReward { rewardId: string; quantity: number }

export interface TierBenefits {
  benefits: string[]
  dailyReward: DailyReward
  rewardMultiplier: number
}

export interface SubscriptionState {
  tier: SubscriptionTier
  expiresAt: number | null
  benefits: string[]
  lastDailyClaimAt: number | null
}
