/**
 * Acceptance tests for issue beat-board-32-smoke-rewarded-ad-trial.
 *
 * Smoke companion: validates the underlying contract that the rewarded-ad
 * → 24h pack-trial smoke spec relies on, before the Playwright lane
 * (`e2e/playwright/smoke-rewarded-ad-trial.spec.ts`) drives the full UI
 * flow.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Acceptance criteria the smoke spec will verify through the
 * UI:
 *   - [ui] After seeding ftue.complete via debug API, Packs displays a
 *     Themed Pack. (The themed pack the kits store ships with is
 *     `midnight-synthwave`. `pack_themed_neon_nights` is the Runbucks
 *     product id from prd.md § IAP Pricing Table.)
 *   - [ui] Tapping the Themed Pack pushes KitDetail; with simulated
 *     ad-ready, the secondary "Try for 24h — Watch ad" button is visible.
 *   - [ui] Tapping the secondary button opens RewardedAdConfirmSheet
 *     showing "Today: 0/3 watched".
 *   - [ui] Tapping "Watch ad" with `simulateReward(packId)` grants
 *     `pack_trial_<packId>` entitlement; sheet dismisses; toast
 *     "[Pack] unlocked for 24h" appears.
 *   - [ui] After grant, KitDetail re-renders with "Trial — 24h Nm left"
 *     + "Buy permanently" CTAs; the rewarded-ad button hides.
 *   - [ui] After 3 simulated watches in one day, the rewarded-ad
 *     affordance hides and the daily-cap chip displays "Today: 3/3 watched".
 *   - [ui] Subscriber-exemption: when `subscription.simulateTier('CORE')`
 *     is set, the rewarded-ad affordance does not render on KitDetail.
 *   - [state] Analytics `rewarded_ad_offered` event fires when the
 *     affordance is mounted; `rewarded_ad_watched` event fires after grant;
 *     `entitlement_granted` event fires for the trial.
 *
 * The core debug-API surface used by the spec
 * (`beatboard.ftue.complete`, `beatboard.rewardedAd.simulateReady`,
 * `beatboard.rewardedAd.simulateReward`, `beatboard.rewardedAd.dailyCount`,
 * `beatboard.subscription.simulateTier`, `beatboard.entitlements.list`)
 * is also pinned here so a missing endpoint surfaces in vitest before the
 * Playwright lane fails opaquely.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  rewardedPlacements,
  REWARDED_DAILY_LIMIT,
  REWARDED_PLACEMENT_ID,
  rewardIdForPack,
  __resetRewardedPlacements,
} from '../systems/rewarded-placements'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_TRIAL_PREFIX,
} from '../stores/entitlementsStore'
import {
  useSubscriptionStore,
  resetSubscriptionStore,
} from '../stores/subscriptionStore'
import { subscriptionStore as vipStore } from '../modules/monetization/subscription-vip/SubscriptionVip'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useNavigationStore } from '../stores/navigationStore'
import {
  useToastStore,
  resetToastStore,
} from '../modules/ui/toast-notifications/ToastNotifications'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

import { KitDetailScreen } from '../components/screens/KitDetailScreen'
import { RewardedAdConfirmSheet } from '../components/sheets/RewardedAdConfirmSheet'
import { NAVIGATION } from '../tabs/tabConfig'
import { installDebugApi } from '../dev/DebugApi'
import {
  installBeatBoardDebugApi,
  __resetBeatBoardDebugInstall,
  __resetBeatBoardDebugStubState,
} from '../systems/debug-api'

const h = React.createElement

// The themed pack the kits store ships with. The smoke spec navigates to
// this card; `pack_themed_neon_nights` is the prd.md product id, but the
// kit catalog v1 ships `midnight-synthwave` as the themed-tier rotation
// slot (see kitsStore seeds).
const THEMED_PACK_ID = 'midnight-synthwave'
const THEMED_PACK_NAME = 'Midnight Synthwave'

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.ads.isRewardedAdReadyAsync).mockResolvedValue(true)
  vi.mocked(RundotAPI.ads.showRewardedAdAsync).mockResolvedValue(true)

  __resetRewardedPlacements()
  resetEntitlementsStore()
  resetSubscriptionStore()
  resetKitsStore()
  resetToastStore()
  vipStore.getState().reset()
  useNavigationStore.getState().configure(NAVIGATION)
  useNavigationStore.setState({ modalStack: [], modalParams: {}, stack: [] })

  __resetBeatBoardDebugInstall()
  __resetBeatBoardDebugStubState()
  installDebugApi()
  installBeatBoardDebugApi()

  // Pin midnight-synthwave to a `paid` themed-tier entry so the
  // rewarded-trial CTA lights up. The catalog ships it as
  // `ownership: "owned"` (audio is shipped, default-unlocked) which
  // suppresses the trial path. Tests need a paid + non-owned kit; this
  // override gives them one without altering the production catalog.
  const kits = useKitsStore.getState().kits
  if (kits[THEMED_PACK_ID]) {
    useKitsStore.setState({
      kits: {
        ...kits,
        [THEMED_PACK_ID]: {
          ...kits[THEMED_PACK_ID],
          ownership: 'paid',
          tier: 'themed',
          comingSoon: false,
        },
      },
    })
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function pushKitDetail(kitId: string): void {
  useNavigationStore.getState().pushScreen('kit-detail', { kitId })
}

// ── Debug API surface pin ─────────────────────────────────────────────────

describe('accept: smoke-rewarded-ad-trial — debug API surface used by the spec', () => {
  it('window.__GAME_DEBUG__.beatboard exposes ftue.complete, rewardedAd.{simulateReady,simulateReward,dailyCount}, subscription.simulateTier, entitlements.list', () => {
    const beat = window.__GAME_DEBUG__.beatboard
    expect(beat).toBeDefined()
    if (!beat) return
    expect(typeof beat.ftue.complete).toBe('function')
    expect(typeof beat.rewardedAd.simulateReady).toBe('function')
    expect(typeof beat.rewardedAd.simulateReward).toBe('function')
    expect(typeof beat.rewardedAd.dailyCount).toBe('function')
    expect(typeof beat.subscription.simulateTier).toBe('function')
    expect(typeof beat.entitlements.list).toBe('function')
  })

  it('rewardedAd.simulateReward(packId) grants the trial entitlement and bumps dailyCount', () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    expect(beat.rewardedAd.dailyCount()).toBe(0)
    beat.rewardedAd.simulateReward(THEMED_PACK_ID)
    expect(useEntitlementsStore.getState().isTrialActive(THEMED_PACK_ID)).toBe(true)
    expect(beat.rewardedAd.dailyCount()).toBe(1)
  })

  it('subscription.simulateTier("CORE") flips isSubscribed("CORE") to true', () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    beat.subscription.simulateTier('CORE')
    expect(useSubscriptionStore.getState().isSubscribed('CORE')).toBe(true)
  })

  it('entitlements.list reflects pack_trial_<packId> after simulateReward', () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    beat.rewardedAd.simulateReward(THEMED_PACK_ID)
    const list = beat.entitlements.list()
    const trial = list.find((e) => e.itemId === `${PACK_TRIAL_PREFIX}${THEMED_PACK_ID}`)
    expect(trial).toBeTruthy()
    expect(trial?.expiresAt).toBeTruthy()
  })
})

// ── Themed pack catalog presence ──────────────────────────────────────────

describe('accept: smoke-rewarded-ad-trial — themed pack catalog presence', () => {
  it('kitsStore seeds at least one themed-tier pack', () => {
    const themed = Object.values(useKitsStore.getState().kits).filter(
      (k) => k.tier === 'themed',
    )
    expect(themed.length).toBeGreaterThan(0)
  })

  it('the themed pack used by the spec is present and not yet owned', () => {
    const kit = useKitsStore.getState().kits[THEMED_PACK_ID]
    expect(kit).toBeTruthy()
    expect(kit?.tier).toBe('themed')
    expect(useEntitlementsStore.getState().ownsPack(THEMED_PACK_ID)).toBe(false)
  })
})

// ── KitDetail rewarded affordance — visibility gating ─────────────────────

describe('accept: smoke-rewarded-ad-trial — rewarded affordance gating on KitDetail', () => {
  it('shows the "Try for 24h — Watch ad" button when ad is ready, no subscription, not owned/trial', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    pushKitDetail(THEMED_PACK_ID)
    render(h(KitDetailScreen))
    // Allow the canShow async probe to resolve.
    await act(async () => {})
    const btn = screen.queryByTestId('kit-detail-cta-rewarded')
    expect(btn).toBeInTheDocument()
    expect(btn?.textContent ?? '').toMatch(/Try for 24h/i)
  })

  it('hides the rewarded button when CORE subscription is active', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    vipStore.getState().setSubscription('CORE', null)
    useSubscriptionStore.getState().syncFromPlatform('CORE')
    pushKitDetail(THEMED_PACK_ID)
    render(h(KitDetailScreen))
    await act(async () => {})
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).not.toBeInTheDocument()
  })

  it('hides the rewarded button after 3 simulated rewards (cap reached)', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    // Burn the daily cap on three OTHER packs so the THEMED pack is still
    // not owned/trialled but the cap is exhausted.
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-1')
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-2')
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-3')
    expect(rewardedPlacements.rewardedAdFlow.dailyCount()).toBe(REWARDED_DAILY_LIMIT)
    pushKitDetail(THEMED_PACK_ID)
    render(h(KitDetailScreen))
    await act(async () => {})
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).not.toBeInTheDocument()
  })

  it('hides the rewarded button after the trial entitlement lands and shows the trial CTA cluster', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReady(true)
    pushKitDetail(THEMED_PACK_ID)
    const { rerender } = render(h(KitDetailScreen))
    await act(async () => {})
    // Affordance visible before the grant.
    expect(screen.getByTestId('kit-detail-cta-rewarded')).toBeInTheDocument()
    // Simulate the grant.
    await act(async () => {
      rewardedPlacements.rewardedAdFlow.simulateReward(THEMED_PACK_ID)
    })
    rerender(h(KitDetailScreen))
    await act(async () => {})
    // Rewarded button is gone, trial CTA renders, buy-permanently renders.
    expect(screen.queryByTestId('kit-detail-cta-rewarded')).not.toBeInTheDocument()
    expect(screen.getByTestId('kit-detail-cta-trial')).toBeInTheDocument()
    expect(screen.getByTestId('kit-detail-cta-buy-permanent')).toBeInTheDocument()
    // Trial copy formatted as "Nh Mm left".
    expect(screen.getByTestId('kit-detail-cta-trial').textContent ?? '').toMatch(
      /Trial\s*—\s*\d+h\s+\d+m\s+left/i,
    )
  })
})

// ── RewardedAdConfirmSheet → grant flow ───────────────────────────────────

describe('accept: smoke-rewarded-ad-trial — confirm sheet daily-cap chip + grant + toast', () => {
  it('renders "Today: 0/3 watched" cap chip on first mount', async () => {
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const chip = screen.getByTestId('rewarded-sheet-cap-chip')
    expect(chip.textContent ?? '').toMatch(/Today:\s*0\s*\/\s*3\s*watched/i)
  })

  it('after Watch ad → reward delivered: grants entitlement, dismisses, toasts "[Pack] unlocked for 24h"', async () => {
    const onClose = vi.fn()
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    expect(useEntitlementsStore.getState().isTrialActive(THEMED_PACK_ID)).toBe(true)
    expect(onClose).toHaveBeenCalled()
    const toasts = useToastStore.getState().toasts
    const unlockToast = toasts.find((t) => /unlocked for 24h/i.test(t.message))
    expect(unlockToast).toBeTruthy()
    expect(unlockToast?.message ?? '').toMatch(new RegExp(THEMED_PACK_NAME))
  })

  it('cap chip reflects 3/3 after three simulated watches', async () => {
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-1')
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-2')
    rewardedPlacements.rewardedAdFlow.simulateReward('cap-burn-3')
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const chip = screen.getByTestId('rewarded-sheet-cap-chip')
    expect(chip.textContent ?? '').toMatch(/3\s*\/\s*3/)
  })
})

// ── Analytics ─────────────────────────────────────────────────────────────

describe('accept: smoke-rewarded-ad-trial — analytics chain', () => {
  it('rewarded_ad_offered fires when the confirm sheet mounts', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const offered = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_offered')
    expect(offered).toBeTruthy()
    expect(offered![1]).toMatchObject({
      placement: REWARDED_PLACEMENT_ID,
      pack_id: THEMED_PACK_ID,
    })
  })

  it('rewarded_ad_watched fires after a successful Watch ad → reward delivered', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    const watched = trackSpy.mock.calls.find((c) => c[0] === 'rewarded_ad_watched')
    expect(watched).toBeTruthy()
    expect(watched![1]).toMatchObject({
      placement: REWARDED_PLACEMENT_ID,
      reward: rewardIdForPack(THEMED_PACK_ID),
    })
  })

  it('entitlement_granted fires for the pack_trial_<packId> grant', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    const granted = trackSpy.mock.calls.find(
      (c) =>
        c[0] === 'entitlement_granted' &&
        (c[1] as { item_id: string }).item_id === `${PACK_TRIAL_PREFIX}${THEMED_PACK_ID}`,
    )
    expect(granted).toBeTruthy()
  })

  it('rewarded_ad_offered fires BEFORE rewarded_ad_watched (mount order)', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(
      h(RewardedAdConfirmSheet, {
        packId: THEMED_PACK_ID,
        packName: THEMED_PACK_NAME,
        onClose: () => {},
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('rewarded-sheet-watch'))
    })
    await act(async () => {})
    const orders = trackSpy.mock.calls.map((c, i) => ({
      name: c[0] as string,
      order: trackSpy.mock.invocationCallOrder[i] ?? 0,
    }))
    const offered = orders.find((e) => e.name === 'rewarded_ad_offered')?.order
    const watched = orders.find((e) => e.name === 'rewarded_ad_watched')?.order
    expect(offered).toBeDefined()
    expect(watched).toBeDefined()
    if (offered === undefined || watched === undefined) return
    expect(offered).toBeLessThan(watched)
  })
})
