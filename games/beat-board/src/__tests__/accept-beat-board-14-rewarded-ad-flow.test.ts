/**
 * Acceptance tests for issue beat-board-14-rewarded-ad-flow.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks. Tests exercise the real `rewarded-placements` system, the real
 * `entitlementsStore` / `subscriptionStore` / `kitsStore` / `navigationStore`
 * stores, and the `RewardedAdConfirmSheet` UI directly with the SDK mocked
 * (per __tests__/setup.ts).
 *
 * Scope:
 *   - rewarded-placements.canShow: four-condition gate (SDK ready, daily cap,
 *     subscriber exemption, owned-or-trial-already-active).
 *   - rewarded-placements.rewardedAdFlow: { show({ placementId, rewardId }),
 *     dailyCount(), simulateReady(boolean), simulateReward(packId), reset() }.
 *   - Daily cap = 3, resets at user-local midnight via data/server-time.
 *   - RewardedAdConfirmSheet UI: title/body/cap chip/watch/cancel/loading/error.
 *   - On reward complete: entitlements granted, sheet dismissed, toast shown,
 *     play tab activated, active kit set.
 *   - Analytics: rewarded_ad_offered, rewarded_ad_watched, rewarded_ad_dismissed.
 *   - DebugApi: simulateReady, simulateReward(packId), dailyCount.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  rewardedPlacements,
  REWARDED_DAILY_LIMIT,
  REWARDED_PLACEMENT_ID,
  REWARDED_TRIAL_TTL_SECONDS,
  BONUS_COST_RUN_BITS,
  bonusMethod,
  bonusProductIdForPack,
  rewardIdForPack,
  __resetRewardedPlacements,
} from '../systems/rewarded-placements'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_OWNED_PREFIX,
} from '../stores/entitlementsStore'
import {
  useSubscriptionStore,
  resetSubscriptionStore,
} from '../stores/subscriptionStore'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useNavigationStore } from '../stores/navigationStore'
import { subscriptionStore as vipStore } from '../modules/monetization/subscription-vip/SubscriptionVip'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { useToastStore, resetToastStore } from '../modules/ui/toast-notifications/ToastNotifications'
import { adsService } from '../modules/monetization/ads-service/AdsService'

import { RewardedAdConfirmSheet } from '../components/sheets/RewardedAdConfirmSheet'
import { NAVIGATION } from '../tabs/tabConfig'

const h = React.createElement

// Constants used across tests
const TRIAL_PACK_ID = 'mellow-trap'

beforeEach(() => {
  vi.clearAllMocks()
  __resetRewardedPlacements()
  resetEntitlementsStore()
  resetSubscriptionStore()
  resetKitsStore()
  resetToastStore()
  vipStore.getState().reset()
  // Re-bind navigation config after store reset (configure is a no-op idempotent).
  useNavigationStore.getState().configure(NAVIGATION)
  // Default mocks — ads are ready, ad watch resolves true.
  vi.mocked(RundotAPI.ads.isRewardedAdReadyAsync).mockResolvedValue(true)
  vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── canShow gate ───────────────────────────────────────────────────────────

describe('accept: rewarded-placements.canShow gate', () => {
  it('returns true when SDK is ready, daily count < 3, not subscribed, and pack not owned', async () => {
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(true)
  })

  it('returns false when isRewardedAdReadyAsync resolves false', async () => {
    vi.mocked(RundotAPI.ads.isRewardedAdReadyAsync).mockResolvedValueOnce(false)
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })

  it('returns false when dailyCount() has reached the cap of 3', async () => {
    // Simulate three successful watches to hit the cap.
    for (let i = 0; i < REWARDED_DAILY_LIMIT; i++) {
      rewardedPlacements.rewardedAdFlow.simulateReward(TRIAL_PACK_ID)
    }
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(REWARDED_DAILY_LIMIT)
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })

  it('returns false for active CORE subscribers (subscriber exemption)', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })

  it('returns false when the player already owns the pack', async () => {
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${TRIAL_PACK_ID}`)
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })

  it('returns false when the player has an active trial on the pack', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReward(TRIAL_PACK_ID)
    // After simulateReward the trial entitlement is active for 24h.
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })

  it('exposes daily cap = 3 (PRD § Rewarded Ads)', () => {
    expect(REWARDED_DAILY_LIMIT).toBe(3)
  })

  it('exposes the canonical placement id', () => {
    expect(REWARDED_PLACEMENT_ID).toBe('rewarded_pack_trial')
  })

  it('rewardIdForPack composes the pack_trial_<packId> reward id', () => {
    expect(rewardIdForPack(TRIAL_PACK_ID)).toBe(`pack_trial_${TRIAL_PACK_ID}`)
  })
})

// ── rewardedAdFlow.show pipes through SDK and grants entitlement ───────────

describe('accept: rewarded-placements.rewardedAdFlow.show', () => {
  it('show({ placementId, rewardId }) invokes RundotAPI.ads.showRewardedAdAsync', async () => {
    const showSpy = vi.mocked(RundotAPI.ads.showRewardedAdAsync)
    showSpy.mockResolvedValueOnce(true)
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
    })
    expect(result.watched).toBe(true)
    expect(showSpy).toHaveBeenCalledTimes(1)
  })

  it('on watched=true: increments dailyCount and grants pack_trial_<packId> for 24h', async () => {
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(0)
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
    })
    expect(result.watched).toBe(true)
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(1)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
    const remaining = useEntitlementsStore.getState().trialRemainingSeconds(TRIAL_PACK_ID)
    expect(remaining).toBeGreaterThan(REWARDED_TRIAL_TTL_SECONDS - 60)
    expect(remaining).toBeLessThanOrEqual(REWARDED_TRIAL_TTL_SECONDS)
  })

  it('on watched=false: does not increment dailyCount and does not grant entitlement', async () => {
    vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockResolvedValueOnce(false)
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
    })
    expect(result.watched).toBe(false)
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(0)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(false)
  })

  it('emits rewarded_ad_watched analytics on successful reward', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
    })
    const watchedCall = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_watched')
    expect(watchedCall).toBeTruthy()
    expect(watchedCall![1]).toMatchObject({
      placement: REWARDED_PLACEMENT_ID,
      reward: rewardIdForPack(TRIAL_PACK_ID),
    })
  })

  it('emits rewarded_ad_dismissed analytics when watched=false', async () => {
    vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockResolvedValueOnce(false)
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
    })
    const call = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_dismissed')
    expect(call).toBeTruthy()
  })

  it('simulateReward(packId) grants entitlement and bumps dailyCount without invoking SDK', () => {
    const showSpy = vi.mocked(RundotAPI.ads.showRewardedAdAsync)
    rewardedPlacements.rewardedAdFlow.simulateReward(TRIAL_PACK_ID)
    expect(showSpy).not.toHaveBeenCalled()
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(1)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
  })

  it('simulateReady(false) flips canShow() to false even when SDK mock resolves true', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(false)
    const result = await rewardedPlacements.canShow(TRIAL_PACK_ID)
    expect(result).toBe(false)
  })
})

// ── RewardedAdConfirmSheet UI ─────────────────────────────────────────────

describe('accept: RewardedAdConfirmSheet UI', () => {
  it('renders title, body copy, daily cap chip', async () => {
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    expect(screen.getByText(/Try Mellow Trap for 24 hours/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Watch a short ad to unlock 24 hours of access to this pack/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Watch up to 3 ads per day/i),
    ).toBeInTheDocument()
    const chip = screen.getByTestId('rewarded-sheet-cap-chip')
    expect(chip.textContent).toMatch(/0\s*\/\s*3/)
  })

  it('renders Watch ad and Cancel buttons', async () => {
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    expect(screen.getByTestId('rewarded-sheet-watch')).toBeInTheDocument()
    expect(screen.getByTestId('rewarded-sheet-cancel')).toBeInTheDocument()
  })

  it('Watch ad tap invokes rewardedAdFlow.show with correct placement and rewardId', async () => {
    const showSpy = vi.spyOn(rewardedPlacements.rewardedAdFlow, 'show')
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const btn = screen.getByTestId('rewarded-sheet-watch')
    await act(async () => {
      fireEvent.click(btn)
    })
    expect(showSpy).toHaveBeenCalledWith({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
      packId: TRIAL_PACK_ID,
      packName: 'Mellow Trap',
    })
  })

  it('on reward complete: grants 24h entitlement, dismisses, shows toast, switches to Play tab, sets active kit', async () => {
    // Switch active tab away from play to verify the auto-switch happens.
    useNavigationStore.getState().setActiveTab('packs')
    expect(useNavigationStore.getState().activeTab).toBe('packs')
    const onClose = vi.fn()
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose,
      }),
    )
    await act(async () => {})
    const btn = screen.getByTestId('rewarded-sheet-watch')
    await act(async () => {
      fireEvent.click(btn)
    })
    // Allow the show() promise chain to resolve.
    await act(async () => {})

    // Entitlement granted with 24h TTL.
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)

    // Sheet dismissed.
    expect(onClose).toHaveBeenCalled()

    // Toast queued.
    const toasts = useToastStore.getState().toasts
    expect(toasts.length).toBeGreaterThan(0)
    expect(toasts[0]!.message).toMatch(/Mellow Trap.*24h/i)

    // Switched to Play tab.
    expect(useNavigationStore.getState().activeTab).toBe('play')

    // Active kit set.
    expect(useKitsStore.getState().activeKitId).toBe(TRIAL_PACK_ID)
  })

  it('on Cancel tap: closes the sheet without granting entitlement', async () => {
    const onClose = vi.fn()
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose,
      }),
    )
    await act(async () => {})
    const cancelBtn = screen.getByTestId('rewarded-sheet-cancel')
    await act(async () => {
      fireEvent.click(cancelBtn)
    })
    expect(onClose).toHaveBeenCalled()
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(false)
  })

  it('on dismiss before reward (Cancel after Watch starts): no entitlement granted; rewarded_ad_dismissed fires', async () => {
    // Force the SDK to resolve as not-watched (user dismissed mid-ad).
    vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockResolvedValueOnce(false)
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const onClose = vi.fn()
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    // No entitlement.
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(false)
    // rewarded_ad_dismissed analytics fired.
    const dismissedCall = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_dismissed')
    expect(dismissedCall).toBeTruthy()
  })

  it('Watch button shows disabled/loading state while ad is being shown', async () => {
    // Mock SDK to take time so the loading state is observable.
    let resolveAd: (v: boolean) => void = () => {}
    vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAd = resolve
        }),
    )
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const watch = screen.getByTestId('rewarded-sheet-watch')
    await act(async () => {
      fireEvent.click(watch)
    })
    // Mid-flight: the watch button is disabled.
    expect((watch as HTMLButtonElement).disabled).toBe(true)
    // Resolve the ad promise to unblock cleanup.
    await act(async () => {
      resolveAd(true)
    })
  })

  it('error state: shows inline message when ad is not available', async () => {
    vi.mocked(RundotAPI.ads.isRewardedAdReadyAsync).mockResolvedValue(false)
    rewardedPlacements.rewardedAdFlow.simulateReady(false)
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    expect(
      screen.getByText(/Ad not available right now — try again later/i),
    ).toBeInTheDocument()
  })

  it('emits rewarded_ad_offered analytics when canShow passes and the sheet mounts', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const offered = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_offered')
    expect(offered).toBeTruthy()
    expect(offered![1]).toMatchObject({ pack_id: TRIAL_PACK_ID })
  })

  it('cap chip reflects the current daily count', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReward('some-other-pack')
    rewardedPlacements.rewardedAdFlow.simulateReward('yet-another-pack')
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const chip = screen.getByTestId('rewarded-sheet-cap-chip')
    expect(chip.textContent).toMatch(/2\s*\/\s*3/)
  })
})

// ── Daily counter resets at user-local midnight via server-time ────────────

describe('accept: daily counter resets at user-local midnight', () => {
  it('resetDailyIfNewDay() drops the counter to 0 when the dayKey changes', () => {
    rewardedPlacements.rewardedAdFlow.simulateReward(TRIAL_PACK_ID)
    rewardedPlacements.rewardedAdFlow.simulateReward('another-pack')
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(2)

    // Force a new day.
    rewardedPlacements.__forceDayKey('2099-01-01')
    rewardedPlacements.rewardedAdFlow.resetDailyIfNewDay()
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(0)
  })
})

// ── Debug API exposure ─────────────────────────────────────────────────────

describe('accept: debug API beatboard.rewardedAd registers helpers', () => {
  it('registers simulateReady, simulateReward, dailyCount on window.__GAME_DEBUG__.beatboard.rewardedAd', async () => {
    const { installBeatBoardDebugApi, __resetBeatBoardDebugInstall } = await import(
      '../systems/debug-api'
    )
    __resetBeatBoardDebugInstall()
    const { installDebugApi } = await import('../dev/DebugApi')
    installDebugApi()
    const api = installBeatBoardDebugApi()
    expect(typeof api.rewardedAd.simulateReady).toBe('function')
    expect(typeof api.rewardedAd.simulateReward).toBe('function')
    expect(typeof api.rewardedAd.dailyCount).toBe('function')
  })

  it('rewardedAd.simulateReward(packId) grants the trial entitlement', async () => {
    const { installBeatBoardDebugApi, __resetBeatBoardDebugInstall } = await import(
      '../systems/debug-api'
    )
    __resetBeatBoardDebugInstall()
    const { installDebugApi } = await import('../dev/DebugApi')
    installDebugApi()
    const api = installBeatBoardDebugApi()
    api.rewardedAd.simulateReward(TRIAL_PACK_ID)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
    expect(api.rewardedAd.dailyCount()).toBe(1)
  })
})

// ── No-ads channel (capabilities.ads === false): RUN Bit bonus path ───────
//
// On channels that do not allow ads (e.g. the Steam build), the same 24h
// pack trial is paid for with 1 Runbuck via RundotAPI.iap.spendCurrency
// instead of a rewarded ad — and the UI must never reference ads.

describe('accept: no-ads channel — Runbucks bonus path', () => {
  beforeEach(() => {
    // Force the no-ads channel for this block.
    vi.spyOn(adsService, 'areAdsAvailable').mockReturnValue(false)
    vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValue({ success: true })
  })

  afterEach(() => {
    vi.mocked(adsService.areAdsAvailable).mockRestore()
  })

  it('bonusMethod() reports run_bits when ads are unavailable', () => {
    expect(bonusMethod()).toBe('run_bits')
  })

  it('canShow() is true even when ads are not ready and the daily cap is hit', async () => {
    vi.mocked(RundotAPI.ads.isRewardedAdReadyAsync).mockResolvedValue(false)
    for (let i = 0; i < REWARDED_DAILY_LIMIT; i++) {
      // Even after maxing the ad cap, the paid path stays available.
      rewardedPlacements.rewardedAdFlow.simulateReward('other-pack')
    }
    expect(await rewardedPlacements.canShow(TRIAL_PACK_ID)).toBe(true)
  })

  it('canShow() still respects subscriber + owned/trial gating', async () => {
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${TRIAL_PACK_ID}`)
    expect(await rewardedPlacements.canShow(TRIAL_PACK_ID)).toBe(false)
  })

  it('show() spends 1 Runbuck and grants the 24h trial on success', async () => {
    const spendSpy = vi.mocked(RundotAPI.iap.spendCurrency)
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
      packId: TRIAL_PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.watched).toBe(true)
    expect(spendSpy).toHaveBeenCalledWith(
      bonusProductIdForPack(TRIAL_PACK_ID),
      BONUS_COST_RUN_BITS,
      expect.objectContaining({ description: expect.stringContaining('Mellow Trap') }),
    )
    // No rewarded ad was shown.
    expect(vi.mocked(RundotAPI.ads.showRewardedAdAsync)).not.toHaveBeenCalled()
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
  })

  it('show() does NOT grant the trial when the spend is declined (insufficient funds)', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValueOnce({
      success: false,
      error: 'insufficient_balance',
    })
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
      packId: TRIAL_PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.watched).toBe(false)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(false)
    // A non-cancel failure is reported.
    expect(
      trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_dismissed'),
    ).toBeTruthy()
  })

  it('show() is a silent no-op when the player cancels the spend dialog', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValueOnce({
      success: false,
      error: 'USER_CANCELLED',
    })
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const result = await rewardedPlacements.rewardedAdFlow.show({
      placementId: REWARDED_PLACEMENT_ID,
      rewardId: rewardIdForPack(TRIAL_PACK_ID),
      packId: TRIAL_PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.watched).toBe(false)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(false)
    // USER_CANCELLED is silent — no dismissal analytic.
    expect(
      trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_dismissed'),
    ).toBeFalsy()
  })

  it('RewardedAdConfirmSheet renders the Runbucks CTA and never references ads', async () => {
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const sheet = screen.getByTestId('rewarded-ad-confirm-sheet')
    expect(sheet).toHaveAttribute('data-bonus-method', 'run_bits')
    // Button reads "Spend 1 Runbuck", not "Watch ad".
    expect(screen.getByTestId('rewarded-sheet-watch')).toHaveTextContent(
      `Spend ${BONUS_COST_RUN_BITS} Runbuck`,
    )
    // No ad copy anywhere in the sheet, and no daily-cap chip.
    expect(within(sheet).queryByText(/\bad\b/i)).toBeNull()
    expect(screen.queryByTestId('rewarded-sheet-cap-chip')).toBeNull()
  })

  it('RewardedAdConfirmSheet Watch tap spends Runbucks and grants the trial', async () => {
    const onClose = vi.fn()
    render(
      h(RewardedAdConfirmSheet, {
        packId: TRIAL_PACK_ID,
        packName: 'Mellow Trap',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    expect(vi.mocked(RundotAPI.iap.spendCurrency)).toHaveBeenCalledTimes(1)
    expect(useEntitlementsStore.getState().isTrialActive(TRIAL_PACK_ID)).toBe(true)
    expect(onClose).toHaveBeenCalled()
  })
})
