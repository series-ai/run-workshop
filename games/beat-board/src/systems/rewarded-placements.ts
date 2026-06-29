/**
 * rewarded-placements — single source of truth for the BeatBoard rewarded
 * ad flow.
 *
 * Issue beat-board-14-rewarded-ad-flow owns this file.
 *
 * PRD references:
 *   - prd.md § Rewarded Ads — placement table, daily cap, subscriber exemption
 *   - prd.md § Pack ownership and access tiers — 24h trial entitlement
 *
 * Responsibilities:
 *   - canShow(packId): the four-condition gate used by KitDetail to decide
 *     whether to render the "Try for 24h — Watch ad" affordance:
 *       (a) `RundotAPI.ads.isRewardedAdReadyAsync()` resolves true
 *       (b) `rewardedAdFlow.dailyCount() < 3`
 *       (c) `subscriptionStore.isSubscribed('CORE') === false`
 *       (d) the player does not already own or have an active trial on the
 *           pack.
 *   - rewardedAdFlow.show({ placementId, rewardId }): drives the rewarded
 *     ad through `monetization/rewarded-ad-flow` (which wraps adsService and
 *     RundotAPI.ads.showRewardedAdAsync). On success it grants the
 *     `pack_trial_<packId>` entitlement (24h TTL) via `entitlementsStore`
 *     and emits `rewarded_ad_watched`. On dismiss it emits
 *     `rewarded_ad_dismissed`.
 *   - Daily-cap reset at user-local midnight via `data/server-time`'s day
 *     key. The cap counter persists for the current day; calling
 *     `resetDailyIfNewDay()` rolls it over when the day key changes.
 *   - simulateReady / simulateReward — debug-API hooks that bypass the SDK
 *     so e2e specs can land in known states deterministically.
 *
 * The implementation extends the installed `monetization/rewarded-ad-flow`
 * module's store rather than reimplementing the cap logic; it overrides the
 * default `dailyLimit: 5` to BeatBoard's 3 per prd.md § Rewarded Ads.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  createRewardedAdStore,
  type AdsProvider,
} from '../modules/monetization/rewarded-ad-flow/RewardedAdFlow'
import { adsService } from '../modules/monetization/ads-service/AdsService'
import {
  useEntitlementsStore,
  PACK_TRIAL_PREFIX,
  TRIAL_TTL_SECONDS,
} from '../stores/entitlementsStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { useWalletStore } from '../stores/walletStore'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { getServerTimeService } from '../rundot/init'

// ── Constants ─────────────────────────────────────────────────────────────

/** prd.md § Rewarded Ads — single placement id used for the pack-trial flow. */
export const REWARDED_PLACEMENT_ID = 'rewarded_pack_trial'

/** prd.md § Rewarded Ads — "maximum 3 rewarded ad views per day". */
export const REWARDED_DAILY_LIMIT = 3

/** prd.md § Pack ownership and access tiers — trial duration is 24 hours. */
export const REWARDED_TRIAL_TTL_SECONDS = TRIAL_TTL_SECONDS

/**
 * Cost of the pack-trial bonus on no-ads channels, in Runbucks (the game's
 * hard currency / RUN Bits). One unit per the SDK no-ads guidance.
 */
export const BONUS_COST_RUN_BITS = 1

/**
 * How the pack-trial bonus is paid for on the current channel.
 *   - `'ad'`       → watch a rewarded ad (ads-enabled channels: web / mobile)
 *   - `'run_bits'` → spend 1 Runbuck (no-ads channels such as the Steam build)
 *
 * Channel-static for the session — derived from the SDK `capabilities.ads`
 * flag through the ads service. UI uses this to pick player-facing copy so a
 * no-ads channel never references ads.
 */
export type BonusMethod = 'ad' | 'run_bits'

export function bonusMethod(): BonusMethod {
  return adsService.areAdsAvailable() ? 'ad' : 'run_bits'
}

// ── Reward id helper ──────────────────────────────────────────────────────

/** Compose the canonical reward id for a pack-trial grant. */
export function rewardIdForPack(packId: string): string {
  return `${PACK_TRIAL_PREFIX}${packId}`
}

/**
 * SDK product id used when paying for a pack trial with Runbucks. Mirrors the
 * `pack_<id>` purchase-catalog convention but kept distinct (`pack_trial_<id>`)
 * so trial spends are attributed separately from permanent purchases.
 */
export function bonusProductIdForPack(packId: string): string {
  return `pack_trial_${packId.replace(/-/g, '_')}`
}

// ── Underlying module store ───────────────────────────────────────────────
//
// We bridge the installed `rewarded-ad-flow` module store rather than
// reimplementing watch-counter logic. The module's `showAd()` runs the
// readiness check + counter increment via adsService.

const adsProvider: AdsProvider = {
  showRewarded(placement: string): Promise<boolean> {
    return adsService.showRewarded(placement)
  },
}

const moduleStore = createRewardedAdStore(adsProvider, REWARDED_PLACEMENT_ID)

// Override the default daily limit (5) with BeatBoard's cap of 3.
moduleStore.setState({ dailyLimit: REWARDED_DAILY_LIMIT })

// ── Day-key tracking for midnight reset ───────────────────────────────────

let lastSeenDayKey: string | null = null
let forcedDayKey: string | null = null

function currentDayKey(): string {
  if (forcedDayKey) return forcedDayKey
  try {
    return getServerTimeService().getDayKey()
  } catch {
    // Fallback to UTC-day key if server-time has not been initialised yet.
    const d = new Date()
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

// Capture the day key at module load so the first cap rollover happens on
// the next day boundary, not immediately.
lastSeenDayKey = currentDayKey()

// ── Public API ────────────────────────────────────────────────────────────

interface ShowArgs {
  placementId: string
  rewardId: string
  /** Pack the trial unlocks — used by the Runbucks path for the spend id. */
  packId: string
  /** Display name shown in the host's Runbucks spend-confirmation dialog. */
  packName: string
}

interface ShowResult {
  watched: boolean
}

interface RewardedAdFlowApi {
  /** Drive a rewarded ad watch + grant. Returns `{ watched: true }` on reward. */
  show(args: ShowArgs): Promise<ShowResult>
  /** Number of rewarded ads watched in the current server day. */
  dailyCount(): number
  /** True when the SDK reports a rewarded ad as ready AND simulateReady is not falsified. */
  isReady(): Promise<boolean>
  /** Reset the daily counter if the server-time day key has rolled over. */
  resetDailyIfNewDay(): void
  /**
   * Debug hook — force the readiness flag to a fixed value. Set to `null` to
   * clear the override and fall back to the SDK readiness call.
   */
  simulateReady(ready: boolean | null): void
  /**
   * Debug hook — bypass the SDK and grant a trial directly, bumping the
   * daily counter. Used by e2e specs to land in the post-reward state
   * without watching a real ad.
   */
  simulateReward(packId: string): void
  /** Reset module-local state (counter, simulate flags). */
  reset(): void
}

let simulatedReady: boolean | null = null

/**
 * No-ads bonus path — charge 1 Runbuck for the same 24h pack trial. The host
 * renders its own spend-confirmation dialog; on success we grant the trial
 * entitlement exactly like the rewarded-ad reward and refresh the wallet chip.
 *
 * `RundotAPI.iap.spendCurrency` resolves with `{ success, error }` (it does
 * not throw for a declined or insufficient-funds spend), so we branch on the
 * result. `USER_CANCELLED` is a silent no-op; other failures are logged.
 */
async function showViaRunBits({
  placementId,
  rewardId,
  packId,
  packName,
}: ShowArgs): Promise<ShowResult> {
  const productId = bonusProductIdForPack(packId)
  let result: { success: boolean; error?: string }
  try {
    result = await RundotAPI.iap.spendCurrency(productId, BONUS_COST_RUN_BITS, {
      description: `Unlock ${packName} for 24 hours`,
    })
  } catch (err) {
    RundotAPI.error('rewardedPlacements.showViaRunBits spendCurrency threw', {
      packId,
      err: String(err),
    })
    return { watched: false }
  }

  if (!result.success) {
    if (result.error !== 'USER_CANCELLED') {
      analyticsModule.track('rewarded_ad_dismissed', {
        placement: placementId,
        reward: rewardId,
        method: 'run_bits',
        reason: result.error ?? 'spend_failed',
      })
      RundotAPI.error('rewardedPlacements.showViaRunBits spend failed', {
        packId,
        error: result.error ?? 'unknown',
      })
    }
    return { watched: false }
  }

  // Grant the same 24h trial entitlement the ad path grants.
  useEntitlementsStore.getState().grantEntitlement(rewardId, {
    ttlSeconds: REWARDED_TRIAL_TTL_SECONDS,
    source: 'run_bits_bonus',
  })

  analyticsModule.track('currency_spent', {
    currency: 'runbucks',
    amount: BONUS_COST_RUN_BITS,
    sink: productId,
  })
  analyticsModule.track('rewarded_ad_watched', {
    placement: placementId,
    reward: rewardId,
    method: 'run_bits',
  })

  // Reflect the post-spend balance in the wallet chip.
  void useWalletStore.getState().refresh()

  return { watched: true }
}

const rewardedAdFlow: RewardedAdFlowApi = {
  async show({ placementId, rewardId, packId, packName }: ShowArgs): Promise<ShowResult> {
    // No-ads channel: there is no ad to watch, so the same 24h trial is paid
    // for with 1 Runbuck instead. No daily cap or ad-readiness applies — the
    // host's spend-confirmation dialog is the gate.
    if (!adsService.areAdsAvailable()) {
      return showViaRunBits({ placementId, rewardId, packId, packName })
    }

    // Roll over the daily counter if the day has changed since the last call.
    rewardedAdFlow.resetDailyIfNewDay()

    if (moduleStore.getState().watchCount >= REWARDED_DAILY_LIMIT) {
      analyticsModule.track('rewarded_ad_dismissed', {
        placement: placementId,
        reward: rewardId,
        reason: 'cap_reached',
      })
      return { watched: false }
    }

    // The module store's showAd() goes through adsService.showRewarded(),
    // which calls RundotAPI.ads.isRewardedAdReadyAsync() then
    // RundotAPI.ads.showRewardedAdAsync({...}). On success the counter
    // increments inside the module store.
    const result = await moduleStore.getState().showAd()

    if (!result.watched) {
      analyticsModule.track('rewarded_ad_dismissed', {
        placement: placementId,
        reward: rewardId,
      })
      return { watched: false }
    }

    // Grant the 24h trial entitlement. `rewardId` is the full
    // `pack_trial_<packId>` item id we want stored.
    useEntitlementsStore.getState().grantEntitlement(rewardId, {
      ttlSeconds: REWARDED_TRIAL_TTL_SECONDS,
      source: 'rewarded_ad',
    })

    analyticsModule.track('rewarded_ad_watched', {
      placement: placementId,
      reward: rewardId,
    })

    return { watched: true }
  },

  dailyCount(): number {
    return moduleStore.getState().watchCount
  },

  async isReady(): Promise<boolean> {
    if (simulatedReady !== null) return simulatedReady
    try {
      return await RundotAPI.ads.isRewardedAdReadyAsync()
    } catch (err) {
      RundotAPI.error('rewardedPlacements.isReady failed', { err: String(err) })
      return false
    }
  },

  resetDailyIfNewDay(): void {
    const today = currentDayKey()
    if (lastSeenDayKey !== today) {
      lastSeenDayKey = today
      moduleStore.getState().resetDailyCount()
    }
  },

  simulateReady(ready: boolean | null): void {
    simulatedReady = ready
  },

  simulateReward(packId: string): void {
    // Defensive boundary — simulateReward is invoked from debug surfaces and
    // smoke tests where downstream subscribers (notification scheduler,
    // analytics sinks) may not be fully wired. A throw here would mask the
    // grant from any caller that handles the void-return synchronously.
    try {
      rewardedAdFlow.resetDailyIfNewDay()
      if (moduleStore.getState().watchCount >= REWARDED_DAILY_LIMIT) return
      // Mirror the production path: increment the counter and grant the trial
      // entitlement, but skip the SDK call.
      moduleStore.setState((state) => ({
        watchCount: state.watchCount + 1,
        lastWatchedAt: Date.now(),
      }))
      useEntitlementsStore.getState().grantEntitlement(rewardIdForPack(packId), {
        ttlSeconds: REWARDED_TRIAL_TTL_SECONDS,
        source: 'debug',
      })
    } catch (err) {
      RundotAPI.error('rewardedPlacements.simulateReward failed', {
        packId,
        err: String(err),
      })
    }
  },

  reset(): void {
    moduleStore.getState().reset()
    moduleStore.setState({ dailyLimit: REWARDED_DAILY_LIMIT })
    simulatedReady = null
  },
}

/**
 * Decide whether the "Try for 24h — Watch ad" affordance should render for
 * a given pack on KitDetail. This is the single source of truth — no other
 * call site should duplicate the readiness/cap/subscriber/owned logic.
 */
async function canShow(packId: string): Promise<boolean> {
  // Roll over the day if it just changed.
  rewardedAdFlow.resetDailyIfNewDay()

  // (c) Subscriber exemption — CORE+ subscribers do not see the rewarded
  // affordance per prd.md § Rewarded Ads.
  if (useSubscriptionStore.getState().isSubscribed('CORE')) return false

  // (d) Already owned or active trial.
  const ent = useEntitlementsStore.getState()
  if (ent.ownsPack(packId) || ent.isTrialActive(packId)) return false

  // No-ads channel: the bonus is a paid 1-Runbuck unlock, so the ad-specific
  // gates (daily cap + SDK ad readiness) do not apply. The affordance shows
  // for any eligible, not-yet-owned pack.
  if (!adsService.areAdsAvailable()) return true

  // (b) Daily cap.
  if (rewardedAdFlow.dailyCount() >= REWARDED_DAILY_LIMIT) return false

  // (a) SDK readiness.
  const ready = await rewardedAdFlow.isReady()
  if (!ready) return false

  return true
}

export const rewardedPlacements = {
  canShow,
  rewardedAdFlow,
  /** Internal: force the resolved day key (vitest only). */
  __forceDayKey(dayKey: string | null): void {
    forcedDayKey = dayKey
  },
}

/** Internal: vitest helper to drop singleton state between cases. */
export function __resetRewardedPlacements(): void {
  rewardedAdFlow.reset()
  forcedDayKey = null
  lastSeenDayKey = currentDayKey()
}
