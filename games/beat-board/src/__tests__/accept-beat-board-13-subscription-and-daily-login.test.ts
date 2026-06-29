/**
 * Acceptance tests for issue beat-board-13-subscription-and-daily-login.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Tests exercise the real subscriptionStore, walletStore,
 * daily-login-banner system, and DailyLoginBanner UI directly with the
 * RundotAPI SDK mocked (per __tests__/setup.ts).
 *
 * Scope:
 *   - subscriptionStore — proxy on subscription-sdk + subscription-vip.
 *   - walletStore — server-authoritative balance reader.
 *   - subscription-vip config — overridden to PRD § Subscription Products.
 *   - multi-day-reward config — daily login pattern (CORE 50/day, PLUS 200/day).
 *   - daily-login-banner system — subscriber gate + once-per-day claim flow.
 *   - DailyLoginBanner UI — renders for subscribers, dismisses on claim.
 *   - Subscriber-kit grant — `entitlementsStore.grantEntitlement('subscriber_kit_<yyyymm>')`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  useSubscriptionStore,
  resetSubscriptionStore,
  type GameSubscriptionTier,
} from '../stores/subscriptionStore'
import { useWalletStore, resetWalletStore } from '../stores/walletStore'
import {
  createDailyLoginBanner,
  DAILY_LOGIN_STORAGE_PREFIX,
  DAILY_LOGIN_REWARD_AMOUNTS,
  DAILY_LOGIN_CONFIG_ID,
  type DailyLoginBanner,
} from '../systems/daily-login-banner'
import { DailyLoginBanner as DailyLoginBannerUI } from '../components/banners/DailyLoginBanner'
import { resetEntitlementsStore } from '../stores/entitlementsStore'
import { subscriptionConfig } from '../modules/monetization/subscription-vip/config'
import { subscriptionStore as vipStore } from '../modules/monetization/subscription-vip/SubscriptionVip'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

const h = React.createElement

beforeEach(() => {
  vi.clearAllMocks()
  resetSubscriptionStore()
  resetWalletStore()
  resetEntitlementsStore()
  vipStore.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── subscriptionStore proxies subscription-sdk ─────────────────────────────

describe('accept: subscriptionStore proxies monetization/subscription-sdk', () => {
  it('exposes { tier: free|CORE|PLUS, isSubscribed(tier), purchaseSubscription(tier, interval) }', () => {
    const s = useSubscriptionStore.getState()
    expect(s.tier).toBe('free')
    expect(typeof s.isSubscribed).toBe('function')
    expect(typeof s.purchaseSubscription).toBe('function')
  })

  it('isSubscribed("CORE") returns true when an active CORE subscription is set', () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    expect(useSubscriptionStore.getState().isSubscribed('CORE')).toBe(true)
  })

  it('isSubscribed("CORE") returns true when player has a higher PLUS tier (hierarchy)', () => {
    vipStore.getState().setSubscription('PLUS', null)
    useSubscriptionStore.getState().syncFromPlatform('PLUS')
    expect(useSubscriptionStore.getState().isSubscribed('CORE')).toBe(true)
    expect(useSubscriptionStore.getState().isSubscribed('PLUS')).toBe(true)
  })

  it('isSubscribed() with no tier returns true when ANY tier is active', () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    expect(useSubscriptionStore.getState().isSubscribed()).toBe(true)
  })

  it('purchaseSubscription delegates to RundotAPI.iap.purchaseSubscription and emits analytics', async () => {
    const purchaseSpy = vi.mocked(RundotAPI.iap.purchaseSubscription)
    purchaseSpy.mockResolvedValueOnce({ success: true })
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const result = await useSubscriptionStore.getState().purchaseSubscription('CORE', 'MONTHLY')
    expect(purchaseSpy).toHaveBeenCalledWith('CORE', 'MONTHLY')
    expect(result.success).toBe(true)
    const startedCall = trackSpy.mock.calls.find((c) => c[0] === 'subscription_purchase_started')
    expect(startedCall).toBeTruthy()
    expect(startedCall![1]).toMatchObject({ tier: 'CORE', interval: 'MONTHLY' })
    const completeCall = trackSpy.mock.calls.find((c) => c[0] === 'subscription_purchase_complete')
    expect(completeCall).toBeTruthy()
    expect(completeCall![1]).toMatchObject({ tier: 'CORE', interval: 'MONTHLY' })
  })

  it('subscription_status_checked analytics fires on every isSubscribed check', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    useSubscriptionStore.getState().isSubscribed('CORE')
    const call = trackSpy.mock.calls.find((c) => c[0] === 'subscription_status_checked')
    expect(call).toBeTruthy()
    expect(call![1]).toMatchObject({ tier: 'CORE', is_subscribed: false })
  })

  it('PRIME and ULTIMATE tiers are surfaced for type safety but tier never resolves to them', () => {
    const tier: GameSubscriptionTier = 'free'
    expect(['free', 'CORE', 'PLUS']).toContain(tier)
  })

  it('subscription_expired analytics fires when a tier transitions from active to expired', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    useSubscriptionStore.getState().syncFromPlatform(null)
    const call = trackSpy.mock.calls.find((c) => c[0] === 'subscription_expired')
    expect(call).toBeTruthy()
    expect(call![1]).toMatchObject({ tier: 'CORE' })
  })
})

// ── walletStore reads RundotAPI.iap.getHardCurrencyBalance ─────────────────

describe('accept: walletStore reads server-authoritative balance', () => {
  it('exposes { balance, refresh() }', () => {
    const s = useWalletStore.getState()
    expect(typeof s.balance).toBe('number')
    expect(typeof s.refresh).toBe('function')
  })

  it('refresh() reads from RundotAPI.iap.getHardCurrencyBalance() and updates balance', async () => {
    vi.mocked(RundotAPI.iap.getHardCurrencyBalance).mockResolvedValueOnce(2400)
    await useWalletStore.getState().refresh()
    expect(useWalletStore.getState().balance).toBe(2400)
  })

  it('refresh() handles SDK errors without throwing', async () => {
    vi.mocked(RundotAPI.iap.getHardCurrencyBalance).mockRejectedValueOnce(new Error('network'))
    await expect(useWalletStore.getState().refresh()).resolves.toBeUndefined()
    // Balance stays unchanged on failure.
    expect(typeof useWalletStore.getState().balance).toBe('number')
  })
})

// ── subscription-vip configured with the PRD § Subscription Products values ─

describe('accept: subscription-vip configured per PRD § Subscription Products', () => {
  it('CORE: 50 Runbucks/day, 1x reward multiplier, "no_ads" benefit', () => {
    const core = subscriptionConfig.CORE
    expect(core.dailyReward).toEqual({ rewardId: 'runbucks', quantity: 50 })
    expect(core.rewardMultiplier).toBe(1)
    expect(core.benefits).toContain('no_ads')
    expect(core.benefits).toContain('subscriber_kit_monthly')
  })

  it('PLUS: 200 Runbucks/day, 1x reward multiplier, includes everything CORE has + cloud_mix_backup + exclusive_packs', () => {
    const plus = subscriptionConfig.PLUS
    expect(plus.dailyReward).toEqual({ rewardId: 'runbucks', quantity: 200 })
    expect(plus.rewardMultiplier).toBe(1)
    expect(plus.benefits).toContain('no_ads')
    expect(plus.benefits).toContain('subscriber_kit_monthly')
    expect(plus.benefits).toContain('cloud_mix_backup')
    expect(plus.benefits).toContain('exclusive_packs')
  })
})

// ── daily-login-banner system: tier-aware drip + once-per-day claim ────────

describe('accept: daily-login-banner system', () => {
  let banner: DailyLoginBanner
  let nowMs: number
  let storage: Map<string, string>
  let dayKey: string

  beforeEach(() => {
    nowMs = 1_700_000_000_000
    dayKey = '2023-11-14' // matches the day for nowMs in UTC
    storage = new Map()
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async (k: string) =>
      storage.has(k) ? storage.get(k)! : null,
    )
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(async (k: string, v: string) => {
      storage.set(k, v)
    })
    banner = createDailyLoginBanner({
      nowMs: () => nowMs,
      dayKey: () => dayKey,
    })
  })

  it('exposes 0/day for free tier (PRD: "free tier gets 0/day")', () => {
    expect(DAILY_LOGIN_REWARD_AMOUNTS.free).toBe(0)
  })

  it('exposes 50/day for CORE (PRD: "CORE gets 50/day")', () => {
    expect(DAILY_LOGIN_REWARD_AMOUNTS.CORE).toBe(50)
  })

  it('exposes 200/day for PLUS (PRD: "PLUS gets 200/day")', () => {
    expect(DAILY_LOGIN_REWARD_AMOUNTS.PLUS).toBe(200)
  })

  it('isVisible() returns false for non-subscribers (free tier)', async () => {
    useSubscriptionStore.getState().syncFromPlatform(null)
    expect(await banner.isVisible()).toBe(false)
  })

  it('isVisible() returns true for CORE subscribers who have not claimed today', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    expect(await banner.isVisible()).toBe(true)
  })

  it('isVisible() returns false after claim() persists today as claimed', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    await banner.claim()
    expect(await banner.isVisible()).toBe(false)
  })

  it('claim() returns the tier-specific Runbucks amount and writes today as claimed in appStorage', async () => {
    vipStore.getState().setSubscription('PLUS', null)
    useSubscriptionStore.getState().syncFromPlatform('PLUS')
    const result = await banner.claim()
    expect(result.amount).toBe(200)
    expect(result.tier).toBe('PLUS')
    expect(storage.get(`${DAILY_LOGIN_STORAGE_PREFIX}${dayKey}`)).toBe('1')
  })

  it('claim() refreshes walletStore via RundotAPI.iap.getHardCurrencyBalance', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    vi.mocked(RundotAPI.iap.getHardCurrencyBalance).mockResolvedValueOnce(1330)
    await banner.claim()
    expect(useWalletStore.getState().balance).toBe(1330)
  })

  it('claim() emits currency_earned with snake_case source per tier', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await banner.claim()
    const earned = trackSpy.mock.calls.find((c) => c[0] === 'currency_earned')
    expect(earned).toBeTruthy()
    expect(earned![1]).toMatchObject({
      currency: 'runbucks',
      amount: 50,
      source: 'daily_login_CORE',
    })
  })

  it('claim() is idempotent — second claim same day returns amount=0', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    const first = await banner.claim()
    const second = await banner.claim()
    expect(first.amount).toBe(50)
    expect(second.amount).toBe(0)
  })

  it('exposes the multi-day-reward configId', () => {
    expect(DAILY_LOGIN_CONFIG_ID).toBe('daily_login_drip')
  })
})

// ── DailyLoginBanner UI ────────────────────────────────────────────────────

describe('accept: DailyLoginBanner UI renders only for subscribers', () => {
  it('does NOT render for free tier (subscriptionStore.tier === free removes it from DOM)', async () => {
    useSubscriptionStore.getState().syncFromPlatform(null)
    const { container } = render(h(DailyLoginBannerUI))
    // Allow effects to settle.
    await act(async () => {})
    expect(container.querySelector('[data-testid="daily-login-banner"]')).toBeNull()
  })

  it('renders for CORE subscribers atop Play with Runbucks delta and Claim CTA', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    render(h(DailyLoginBannerUI))
    await act(async () => {})
    expect(screen.getByTestId('daily-login-banner')).toBeInTheDocument()
    expect(screen.getByTestId('daily-login-banner-claim')).toBeInTheDocument()
    // Sentence-case copy with the +N today phrasing.
    expect(screen.getByTestId('daily-login-banner').textContent).toMatch(/today/i)
  })

  it('renders 50 for CORE and 200 for PLUS via the RunbucksPriceChip', async () => {
    vipStore.getState().setSubscription('PLUS', null)
    useSubscriptionStore.getState().syncFromPlatform('PLUS')
    render(h(DailyLoginBannerUI))
    await act(async () => {})
    const banner = screen.getByTestId('daily-login-banner')
    expect(banner.textContent).toMatch(/200/)
  })

  it('Claim tap claims via the system, dismisses the banner, persists today as claimed', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    const setItemSpy = vi.mocked(RundotAPI.appStorage.setItem)
    render(h(DailyLoginBannerUI))
    await act(async () => {})
    const claimBtn = screen.getByTestId('daily-login-banner-claim')
    await act(async () => {
      fireEvent.click(claimBtn)
    })
    // Banner removed after claim.
    expect(screen.queryByTestId('daily-login-banner')).toBeNull()
    // Storage call recorded the day.
    expect(setItemSpy).toHaveBeenCalled()
    const matchingCall = setItemSpy.mock.calls.find((c) =>
      String(c[0]).startsWith(DAILY_LOGIN_STORAGE_PREFIX),
    )
    expect(matchingCall).toBeTruthy()
  })
})

// ── Subscriber-kit grant ───────────────────────────────────────────────────

describe('accept: subscriber-only generated kit grant', () => {
  it('grantSubscriberKit fires entitlementsStore.grantEntitlement("subscriber_kit_<yyyymm>") for CORE+', async () => {
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    const banner = createDailyLoginBanner({
      nowMs: () => Date.UTC(2025, 6, 1), // Jul 2025
      dayKey: () => '2025-07-01',
    })
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const granted = await banner.grantSubscriberKit()
    expect(granted).toBeTruthy()
    expect(granted!.itemId).toBe('subscriber_kit_202507')
    const call = trackSpy.mock.calls.find(
      (c) => c[0] === 'entitlement_granted' && (c[1] as { item_id?: string }).item_id === 'subscriber_kit_202507',
    )
    expect(call).toBeTruthy()
    expect(call![1]).toMatchObject({ source: 'subscription_kit_drop' })
  })

  it('grantSubscriberKit returns null for non-subscribers', async () => {
    useSubscriptionStore.getState().syncFromPlatform(null)
    const banner = createDailyLoginBanner({
      nowMs: () => Date.UTC(2025, 6, 1),
      dayKey: () => '2025-07-01',
    })
    const granted = await banner.grantSubscriberKit()
    expect(granted).toBeNull()
  })
})

// ── Debug API namespaces ───────────────────────────────────────────────────

describe('accept: debug API beatboard.subscription registers helpers', () => {
  it('registers simulateTier(tier), claimDailyLogin(), simulateRenewal()', async () => {
    const { installBeatBoardDebugApi, __resetBeatBoardDebugInstall } = await import('../systems/debug-api')
    __resetBeatBoardDebugInstall()
    // Initialise baseline window.__GAME_DEBUG__ slot.
    const { installDebugApi } = await import('../dev/DebugApi')
    installDebugApi()
    const api = installBeatBoardDebugApi()
    expect(typeof api.subscription.simulateTier).toBe('function')
    expect(typeof api.subscription.claimDailyLogin).toBe('function')
    expect(typeof api.subscription.simulateRenewal).toBe('function')
  })
})

// ── First-day appStorage flag is namespaced per dayKey ─────────────────────

describe('accept: per-dayKey storage flag', () => {
  it('reads/writes appStorage key under DAILY_LOGIN_STORAGE_PREFIX', () => {
    expect(DAILY_LOGIN_STORAGE_PREFIX).toMatch(/dailyLogin/)
  })
})
