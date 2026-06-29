import type { PlatformTier, TierBenefits } from './types'

/**
 * BeatBoard tier-to-benefit mapping per `prd.md` § Subscription Products.
 *
 *   CORE  — 50 Runbucks/day, 1x reward multiplier, no_ads, subscriber_kit_monthly.
 *   PLUS  — 200 Runbucks/day, 1x reward multiplier, + cloud_mix_backup,
 *           + exclusive_packs (cumulative — PLUS includes everything CORE has).
 *   PRIME / ULTIMATE — surfaced for type safety only. Not offered for purchase
 *           in v1 (see prd.md § Subscription Products: "No PRIME or ULTIMATE
 *           tier in v1"). Mapped to a stub identical to PLUS to keep the
 *           Record<PlatformTier, TierBenefits> shape complete.
 *
 * Daily reward `rewardId: 'runbucks'` matches the platform hard currency
 * key emitted in the `currency_earned` analytics event source `daily_login_<tier>`.
 */
export const subscriptionConfig: Record<PlatformTier, TierBenefits> = {
  CORE: {
    benefits: ['no_ads', 'subscriber_kit_monthly'],
    dailyReward: { rewardId: 'runbucks', quantity: 50 },
    rewardMultiplier: 1,
  },
  PLUS: {
    benefits: ['no_ads', 'subscriber_kit_monthly', 'cloud_mix_backup', 'exclusive_packs'],
    dailyReward: { rewardId: 'runbucks', quantity: 200 },
    rewardMultiplier: 1,
  },
  // Not offered for purchase. Mirrors PLUS so any accidental status check
  // still yields a sane benefit record rather than an empty stub.
  PRIME: {
    benefits: ['no_ads', 'subscriber_kit_monthly', 'cloud_mix_backup', 'exclusive_packs'],
    dailyReward: { rewardId: 'runbucks', quantity: 200 },
    rewardMultiplier: 1,
  },
  ULTIMATE: {
    benefits: ['no_ads', 'subscriber_kit_monthly', 'cloud_mix_backup', 'exclusive_packs'],
    dailyReward: { rewardId: 'runbucks', quantity: 200 },
    rewardMultiplier: 1,
  },
}
