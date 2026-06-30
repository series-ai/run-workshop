/**
 * subscriptionStore — BeatBoard's typed proxy on top of the installed
 * `monetization/subscription-sdk` (RundotAPI.iap.* surface) and
 * `monetization/subscription-vip` (tier→benefit mapping) modules.
 *
 * Issue beat-board-13-subscription-and-daily-login owns this file.
 *
 * BeatBoard surfaces only `'free' | 'CORE' | 'PLUS'` to product code per
 * prd.md § Subscription Products: "PRIME and ULTIMATE are not used in v1".
 * The platform tier hierarchy is still respected when checking
 * `isSubscribed(tier)` (a PLUS holder satisfies a `CORE` gate) but the store
 * never resolves to PRIME/ULTIMATE on its own — those values exist only in
 * `monetization/subscription-sdk`'s `SubscriptionTier` type for type safety.
 *
 * Store responsibilities:
 *   - Fan-out `subscription_status_checked` analytics on every `isSubscribed`
 *     resolution (prd.md § Monetization Analytics).
 *   - Fan-out `subscription_purchase_started` / `subscription_purchase_complete`
 *     analytics on `purchaseSubscription`.
 *   - Detect tier transitions and emit `subscription_expired` when an active
 *     tier flips back to free.
 *
 * Derives state from the underlying `subscription-vip` `subscriptionStore`
 * singleton — when that store changes (via `setSubscription` or
 * `syncFromPlatform`), this proxy reads from it on demand.
 */

import { create } from 'zustand'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { subscriptionStore as vipStore } from '../modules/monetization/subscription-vip/SubscriptionVip'
import type {
  SubscriptionTier as PlatformSubscriptionTier,
  SubscriptionInterval,
} from '../modules/monetization/subscription-sdk/types'
import type { PlatformTier } from '../modules/monetization/subscription-vip/types'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

// ── Types ────────────────────────────────────────────────────────────────

/**
 * The tier surface BeatBoard product code consumes. Internally the store
 * still understands platform-tier hierarchy via `subscription-vip`, but
 * the public `tier` field collapses everything to `'free' | 'CORE' | 'PLUS'`.
 */
export type GameSubscriptionTier = 'free' | 'CORE' | 'PLUS'

export interface SubscriptionState {
  /**
   * Public tier surface for product UI. `'free'` when no active subscription;
   * `'CORE'` for an active CORE subscription; `'PLUS'` for an active PLUS or
   * higher subscription (PRIME/ULTIMATE collapse to PLUS in v1 because we do
   * not differentiate their benefits — see prd.md § Subscription Products).
   */
  tier: GameSubscriptionTier
  /**
   * True when the player is being treated as a subscriber by the SDK. Mirror
   * of `vipStore.isActive()` so React components can subscribe to it without
   * pulling in the underlying VIP store directly.
   */
  isActive: boolean
  /**
   * Returns true when the player holds the requested tier OR a higher tier
   * (CORE < PLUS hierarchy per prd.md § Subscription Products). Calling
   * `isSubscribed()` with no argument returns true when ANY tier is active.
   *
   * Side effect: emits `subscription_status_checked` per prd.md § Monetization
   * Analytics on every call.
   */
  isSubscribed: (tier?: PlatformSubscriptionTier) => boolean
  /**
   * Initiate a subscription purchase. Delegates to
   * `RundotAPI.iap.purchaseSubscription(tier, interval)` and emits the
   * `subscription_purchase_started` and (on success) `subscription_purchase_complete`
   * analytics events.
   */
  purchaseSubscription: (
    tier: PlatformSubscriptionTier,
    interval: SubscriptionInterval,
  ) => Promise<{ success: boolean }>
  /**
   * Sync the public store from the platform tier. Called by the SDK
   * integrator after `RundotAPI.iap.isUserSubscribed(...)` resolves on boot
   * and after each renewal/cancellation lifecycle event. Pass `null` to
   * reflect a non-subscriber player.
   */
  syncFromPlatform: (tier: PlatformTier | null) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────

function platformTierFromVip(): GameSubscriptionTier {
  const vipTier = vipStore.getState().tier
  if (vipTier === 'none') return 'free'
  if (vipTier === 'CORE') return 'CORE'
  // PLUS / PRIME / ULTIMATE collapse to PLUS in BeatBoard v1.
  return 'PLUS'
}

function isVipActive(): boolean {
  return vipStore.getState().isActive()
}

function emitStatusChecked(tier: PlatformSubscriptionTier | undefined, isSubscribed: boolean): void {
  analyticsModule.track('subscription_status_checked', {
    tier: tier ?? 'any',
    is_subscribed: isSubscribed,
  })
}

// ── Store ────────────────────────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: platformTierFromVip(),
  isActive: isVipActive(),

  isSubscribed(tier?: PlatformSubscriptionTier): boolean {
    const active = isVipActive()
    let result: boolean
    if (!tier) {
      result = active
    } else {
      // Honour CORE < PLUS < PRIME < ULTIMATE hierarchy: any active higher
      // tier satisfies a lower-tier gate. We compare via the VIP store's
      // current tier.
      const HIERARCHY: Record<PlatformSubscriptionTier, number> = {
        CORE: 1,
        PLUS: 2,
        PRIME: 3,
        ULTIMATE: 4,
      }
      const vipTier = vipStore.getState().tier
      if (!active || vipTier === 'none') {
        result = false
      } else {
        result = HIERARCHY[vipTier as PlatformSubscriptionTier] >= HIERARCHY[tier]
      }
    }
    emitStatusChecked(tier, result)
    return result
  },

  async purchaseSubscription(
    tier: PlatformSubscriptionTier,
    interval: SubscriptionInterval,
  ): Promise<{ success: boolean }> {
    analyticsModule.track('subscription_purchase_started', { tier, interval })
    try {
      const result = await RundotAPI.iap.purchaseSubscription(tier, interval)
      if (result.success) {
        analyticsModule.track('subscription_purchase_complete', { tier, interval })
        // Sync local state from the new subscription tier so UI updates immediately.
        const platformTier: PlatformTier = tier
        get().syncFromPlatform(platformTier)
      }
      return result
    } catch (err) {
      RundotAPI.error('subscriptionStore.purchaseSubscription failed', { tier, interval, err: String(err) })
      return { success: false }
    }
  },

  syncFromPlatform(tier: PlatformTier | null): void {
    const wasActive = isVipActive()
    const previousVipTier = vipStore.getState().tier
    vipStore.getState().syncFromPlatform(tier)
    const nowActive = isVipActive()
    set({
      tier: platformTierFromVip(),
      isActive: nowActive,
    })
    // subscription_expired fires on the active→expired transition.
    if (wasActive && !nowActive && previousVipTier !== 'none') {
      analyticsModule.track('subscription_expired', { tier: previousVipTier })
    }
  },
}))

/** Test/debug helper — wipe both the proxy and the underlying VIP store. */
export function resetSubscriptionStore(): void {
  vipStore.getState().reset()
  useSubscriptionStore.setState({
    tier: 'free',
    isActive: false,
  })
}
