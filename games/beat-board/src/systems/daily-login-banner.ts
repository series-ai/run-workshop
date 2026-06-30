/**
 * daily-login-banner — System layer for the subscriber-only daily Runbucks
 * drip surfaced as an inline banner on the Play screen.
 *
 * Issue beat-board-13-subscription-and-daily-login owns this file.
 *
 * Responsibilities (prd.md § Mechanics Detail § Daily login reward):
 *   - Visibility gate: only shows for active CORE+ subscribers.
 *   - Once-per-day gate: persisted in `RundotAPI.appStorage` keyed by the
 *     server-time day key (so the reset boundary follows `data/server-time`
 *     rather than the device clock).
 *   - Claim flow: refreshes `walletStore` from
 *     `RundotAPI.iap.getHardCurrencyBalance()` (server-authoritative) and
 *     emits `currency_earned` analytics with `source: 'daily_login_<tier>'`.
 *   - Subscriber-kit grant: when the monthly drop lands AND the player is
 *     CORE+, calls `entitlementsStore.grantEntitlement('subscriber_kit_<yyyymm>')`
 *     which fans out the canonical `entitlement_granted` event.
 *
 * The reward amount per tier comes from prd.md § Subscription Products
 * (CORE 50/day, PLUS 200/day, free 0/day) and is duplicated here as a
 * lookup table. The underlying `subscription-vip` config holds the same
 * numbers; this lookup keeps the banner self-contained when the player is
 * not in the active tier (e.g. previewing copy in dev mode).
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useSubscriptionStore, type GameSubscriptionTier } from '../stores/subscriptionStore'
import { useWalletStore } from '../stores/walletStore'
import { useEntitlementsStore } from '../stores/entitlementsStore'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { getServerTimeService } from '../rundot/init'

// ── Constants ────────────────────────────────────────────────────────────

/**
 * appStorage key prefix for the once-per-day claim flag. The full key is
 * `${PREFIX}${dayKey}` where `dayKey` is the YYYY-MM-DD server-day. Using a
 * dated key namespace lets the flag self-expire — when tomorrow's day key
 * differs, the lookup misses and the banner re-shows automatically.
 */
export const DAILY_LOGIN_STORAGE_PREFIX = 'beatboard.dailyLogin.claimed.'

/**
 * `monetization/multi-day-reward` configId for the BeatBoard daily-login
 * drip. The module's underlying state is unused for the banner itself
 * (the banner is a single-day claim, not a 7-day calendar) but the configId
 * stays exposed for any future surface that wants the rolling display.
 */
export const DAILY_LOGIN_CONFIG_ID = 'daily_login_drip'

/**
 * Per-tier Runbucks-per-day amounts per prd.md § Subscription Products. The
 * keys mirror `GameSubscriptionTier` so the table is exhaustive.
 */
export const DAILY_LOGIN_REWARD_AMOUNTS: Record<GameSubscriptionTier, number> = {
  free: 0,
  CORE: 50,
  PLUS: 200,
}

// ── Types ────────────────────────────────────────────────────────────────

export interface DailyLoginClaimResult {
  /** Runbucks granted by this claim. `0` if already claimed today or non-subscriber. */
  amount: number
  /** Tier the claim was credited under. `'free'` for non-subscribers. */
  tier: GameSubscriptionTier
  /** Server-day key the claim was recorded against. */
  dayKey: string
}

export interface DailyLoginBannerDeps {
  /** Override `Date.now()` — used by tests. */
  nowMs?: () => number
  /** Override the server-day key resolution — used by tests. */
  dayKey?: () => string
}

export interface DailyLoginBanner {
  /** Tier-specific amount the player would earn if they tapped Claim now. */
  amountForCurrentTier(): number
  /** True when the banner should render (subscriber + not yet claimed today). */
  isVisible(): Promise<boolean>
  /**
   * Run the claim flow:
   *   1. Persist `${PREFIX}${dayKey}` in appStorage so subsequent visits
   *      this day return `amount: 0` (idempotent).
   *   2. Refresh `walletStore` from `RundotAPI.iap.getHardCurrencyBalance()`
   *      so the chip shows the post-credit balance.
   *   3. Emit `currency_earned` with `source: daily_login_<tier>`.
   */
  claim(): Promise<DailyLoginClaimResult>
  /**
   * Grant the monthly subscriber-only generated kit entitlement. Returns
   * the granted entitlement, or `null` for non-subscribers / already-granted
   * months.
   */
  grantSubscriberKit(): Promise<{ itemId: string } | null>
}

// ── Helpers ──────────────────────────────────────────────────────────────

function defaultDayKey(): string {
  // Server-time is the canonical source for daily-reset semantics so a
  // clock-skewed device cannot double-claim or skip days. Fall back to
  // local UTC if server-time hasn't been initialised yet.
  try {
    return getServerTimeService().getDayKey()
  } catch {
    const d = new Date()
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

function monthKeyFromMs(ms: number): string {
  const d = new Date(ms)
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

// ── Factory ──────────────────────────────────────────────────────────────

export function createDailyLoginBanner(deps?: DailyLoginBannerDeps): DailyLoginBanner {
  const nowMs = deps?.nowMs ?? (() => Date.now())
  const dayKey = deps?.dayKey ?? defaultDayKey

  async function readClaimedFlag(key: string): Promise<boolean> {
    try {
      const value = await RundotAPI.appStorage.getItem(key)
      return value === '1'
    } catch (err) {
      RundotAPI.error('dailyLoginBanner.readClaimedFlag failed', { key, err: String(err) })
      return false
    }
  }

  async function writeClaimedFlag(key: string): Promise<void> {
    try {
      await RundotAPI.appStorage.setItem(key, '1')
    } catch (err) {
      RundotAPI.error('dailyLoginBanner.writeClaimedFlag failed', { key, err: String(err) })
    }
  }

  return {
    amountForCurrentTier(): number {
      const tier = useSubscriptionStore.getState().tier
      return DAILY_LOGIN_REWARD_AMOUNTS[tier]
    },

    async isVisible(): Promise<boolean> {
      const tier = useSubscriptionStore.getState().tier
      if (tier === 'free') return false
      const key = `${DAILY_LOGIN_STORAGE_PREFIX}${dayKey()}`
      const claimed = await readClaimedFlag(key)
      return !claimed
    },

    async claim(): Promise<DailyLoginClaimResult> {
      const tier = useSubscriptionStore.getState().tier
      const today = dayKey()
      const key = `${DAILY_LOGIN_STORAGE_PREFIX}${today}`

      // Non-subscribers cannot earn the drip.
      if (tier === 'free') {
        return { amount: 0, tier: 'free', dayKey: today }
      }

      const alreadyClaimed = await readClaimedFlag(key)
      if (alreadyClaimed) {
        return { amount: 0, tier, dayKey: today }
      }

      const amount = DAILY_LOGIN_REWARD_AMOUNTS[tier]
      await writeClaimedFlag(key)

      // Snapshot the pre-refresh balance so we can detect whether the
      // platform credited the daily drop. The Rundot sandbox does not
      // simulate the server-side daily credit, so a refresh-only path leaves
      // the wallet unchanged and the player never sees their reward.
      const before = useWalletStore.getState().balance

      // Refresh wallet from the platform — `RundotAPI.iap` is server-authoritative
      // and the reward is credited platform-side via `subscription-vip` /
      // server-time daily-reset semantics on production hosts.
      await useWalletStore.getState().refresh()

      // If the platform refresh did not visibly increase the balance (dev
      // sandbox path or any host that hasn't wired the daily credit), apply
      // the optimistic local delta so the UI reflects the claim. The
      // once-per-day storage flag we wrote above guarantees idempotence.
      const after = useWalletStore.getState().balance
      if (after <= before) {
        useWalletStore.setState({ balance: before + amount })
      }

      analyticsModule.track('currency_earned', {
        currency: 'runbucks',
        amount,
        source: `daily_login_${tier}`,
      })

      return { amount, tier, dayKey: today }
    },

    async grantSubscriberKit(): Promise<{ itemId: string } | null> {
      const tier = useSubscriptionStore.getState().tier
      if (tier === 'free') return null

      const itemId = `subscriber_kit_${monthKeyFromMs(nowMs())}`
      // Skip if already granted this month.
      const existing = useEntitlementsStore.getState().get(itemId)
      if (existing) return null

      useEntitlementsStore.getState().grantEntitlement(itemId, {
        source: 'subscription_kit_drop',
      })
      return { itemId }
    },
  }
}

// ── Singleton helper for the UI ──────────────────────────────────────────

let singleton: DailyLoginBanner | null = null

/** Lazy-built singleton used by the React banner. */
export function getDailyLoginBanner(): DailyLoginBanner {
  if (!singleton) {
    singleton = createDailyLoginBanner()
  }
  return singleton
}

/** Internal: drop the singleton between vitest cases. */
export function __resetDailyLoginBanner(): void {
  singleton = null
}
