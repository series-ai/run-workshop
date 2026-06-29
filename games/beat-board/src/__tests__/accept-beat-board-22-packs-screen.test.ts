/**
 * Acceptance tests for issue beat-board-22-packs-screen.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. The PackDrawerScreen is a tab that wires:
 *   - kitsStore               — pack catalog + active kit
 *   - entitlementsStore       — pack_owned_<id> / pack_trial_<id> grants
 *   - subscriptionStore       — CORE+ gating for the subscriber section
 *   - walletStore             — Runbucks balance for the top-right chip
 *   - navigationStore         — pushScreen / openModal / setActiveTab
 *   - ui/bottom-sheet         — Credits modal portal
 *   - data/analytics-service  — screen_viewed / store_opened / rewarded_ad_offered
 *
 * Authored as `.test.ts` (no JSX) per the `owns:` declaration; React elements
 * are constructed via React.createElement.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { PackDrawerScreen } from '../components/screens/PackDrawerScreen'
import {
  useKitsStore,
  resetKitsStore,
} from '../stores/kitsStore'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_OWNED_PREFIX,
  PACK_TRIAL_PREFIX,
} from '../stores/entitlementsStore'
import { useSubscriptionStore, resetSubscriptionStore } from '../stores/subscriptionStore'
import { useWalletStore, resetWalletStore } from '../stores/walletStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useBottomSheetStore } from '../modules/ui/bottom-sheet/BottomSheet'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { NAVIGATION } from '../tabs/tabConfig'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

const h = React.createElement

const HERO_KIT_ID = 'lofi_heights_hero'
const PAID_KIT_ID = 'mellow-trap'
const THEMED_KIT_ID = 'midnight-synthwave'
const SUBSCRIBER_KIT_ID = 'subscriber-april'

beforeEach(() => {
  vi.clearAllMocks()
  resetKitsStore()
  resetEntitlementsStore()
  resetWalletStore()
  // Reset subscription proxy AND underlying VIP store baseline so
  // isSubscribed('CORE') doesn't leak between tests.
  resetSubscriptionStore()
  // Reset navigation to a clean play tab + empty stacks.
  useNavigationStore.getState().configure(NAVIGATION)
  useNavigationStore.setState({ modalStack: [], modalParams: {}, stack: [] })
  // Close the bottom sheet between tests.
  useBottomSheetStore.setState({ isOpen: false, snapPoint: 'closed', content: null })
  // Pin the test catalog so structural assertions don't drift with the
  // production catalog. Three things matter to these tests:
  //   - PAID_KIT_ID must be `paid` + visible (not coming-soon). Current
  //     mellow-trap ships with `comingSoon: true` because the audio for
  //     that genre hasn't been generated yet.
  //   - THEMED_KIT_ID must be `paid` + tier `themed` so the long-press
  //     rewarded-ad-trial path engages. midnight-synthwave ships
  //     `ownership: owned` in the live catalog; the tests need a
  //     paid+themed entry to assert the gate.
  //   - SUBSCRIBER_KIT_ID must be visible so the subscriber section
  //     populates when isSubscribed('CORE') is true. subscriber-april
  //     ships with comingSoon: true.
  const kits = useKitsStore.getState().kits
  const overrides: Record<string, Partial<typeof kits[string]>> = {
    [PAID_KIT_ID]: { comingSoon: false, ownership: 'paid', tier: 'genre' },
    [THEMED_KIT_ID]: { comingSoon: false, ownership: 'paid', tier: 'themed' },
    [SUBSCRIBER_KIT_ID]: { comingSoon: false, ownership: 'paid', tier: 'subscriber' },
  }
  const patched: typeof kits = { ...kits }
  for (const [id, patch] of Object.entries(overrides)) {
    if (patched[id]) patched[id] = { ...patched[id], ...patch }
  }
  useKitsStore.setState({ kits: patched })
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Wallet chip ───────────────────────────────────────────────────────────

describe('accept: PackDrawerScreen — wallet chip', () => {
  it('renders Runbucks balance via walletStore', () => {
    useWalletStore.setState({ balance: 1280 })
    render(h(PackDrawerScreen))
    const chip = screen.getByTestId('pack-drawer-wallet')
    expect(chip.textContent ?? '').toMatch(/1[,.]?280|1\.28K/)
  })

  it('refreshes balance from RundotAPI.iap.getHardCurrencyBalance() on mount', async () => {
    const mockBalance = 4242
    ;(RundotAPI.iap.getHardCurrencyBalance as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockBalance)
    render(h(PackDrawerScreen))
    await waitFor(() => {
      expect(useWalletStore.getState().balance).toBe(mockBalance)
    })
  })

  it('tap on wallet chip calls RundotAPI.iap.openStore()', () => {
    render(h(PackDrawerScreen))
    const chip = screen.getByTestId('pack-drawer-wallet')
    act(() => {
      fireEvent.click(chip)
    })
    expect(RundotAPI.iap.openStore).toHaveBeenCalled()
  })

  it('tap on wallet chip emits store_opened { source: "runbucks_chip" }', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(PackDrawerScreen))
    const chip = screen.getByTestId('pack-drawer-wallet')
    act(() => {
      fireEvent.click(chip)
    })
    const call = trackSpy.mock.calls.find(
      ([name, props]) =>
        name === 'store_opened' &&
        (props as Record<string, unknown> | undefined)?.['source'] === 'runbucks_chip',
    )
    expect(call).toBeDefined()
    trackSpy.mockRestore()
  })
})

// ── Owned section ────────────────────────────────────────────────────────

describe('accept: PackDrawerScreen — Owned section', () => {
  it('renders the Owned section with the hero pack always present', () => {
    render(h(PackDrawerScreen))
    expect(screen.getByTestId('pack-section-owned')).toBeInTheDocument()
    expect(screen.getByTestId(`kit-card-${HERO_KIT_ID}`)).toBeInTheDocument()
  })

  it('renders kits with pack_owned_<id> entitlements in Owned', () => {
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${PAID_KIT_ID}`, {
      source: 'shop_purchase',
    })
    render(h(PackDrawerScreen))
    const ownedSection = screen.getByTestId('pack-section-owned')
    expect(ownedSection.querySelector(`[data-testid="kit-card-${PAID_KIT_ID}"]`)).not.toBeNull()
  })

  it('renders kits with active pack_trial_<id> entitlements in Owned with trial chip', () => {
    useEntitlementsStore.getState().grantEntitlement(`${PACK_TRIAL_PREFIX}${PAID_KIT_ID}`, {
      ttlSeconds: 60 * 60 * 8,
      source: 'rewarded_ad',
    })
    render(h(PackDrawerScreen))
    const ownedSection = screen.getByTestId('pack-section-owned')
    const card = ownedSection.querySelector(`[data-testid="kit-card-${PAID_KIT_ID}"]`)
    expect(card).not.toBeNull()
    // KitCard exposes data-kit-ownership on its root.
    expect(card?.getAttribute('data-kit-ownership')).toBe('trial')
  })

  it('expired trial entitlement does NOT pin the kit to Owned', () => {
    // Grant a trial that expires immediately by manipulating the entitlement
    // record directly so isTrialActive() returns false.
    const ent = useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}${PAID_KIT_ID}`,
      { ttlSeconds: 60, source: 'rewarded_ad' },
    )
    // Force expiry by rewriting the record's expiresAt into the past.
    useEntitlementsStore.setState((state) => {
      const next = new Map(state.entitlements)
      next.set(ent.itemId, { ...ent, expiresAt: Date.now() - 1000 })
      return { entitlements: next }
    })
    render(h(PackDrawerScreen))
    const ownedSection = screen.getByTestId('pack-section-owned')
    expect(ownedSection.querySelector(`[data-testid="kit-card-${PAID_KIT_ID}"]`)).toBeNull()
  })
})

// ── Available section ────────────────────────────────────────────────────

describe('accept: PackDrawerScreen — Available section', () => {
  it('renders paid kits not owned in the Available section', () => {
    render(h(PackDrawerScreen))
    const availableSection = screen.getByTestId('pack-section-available')
    // mellow-trap and midnight-synthwave both have ownership='paid'.
    expect(availableSection.querySelector(`[data-testid="kit-card-${PAID_KIT_ID}"]`)).not.toBeNull()
    expect(availableSection.querySelector(`[data-testid="kit-card-${THEMED_KIT_ID}"]`)).not.toBeNull()
  })

  it('removes a kit from Available once a pack_owned entitlement is granted', () => {
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${PAID_KIT_ID}`, {
      source: 'shop_purchase',
    })
    render(h(PackDrawerScreen))
    const availableSection = screen.getByTestId('pack-section-available')
    expect(availableSection.querySelector(`[data-testid="kit-card-${PAID_KIT_ID}"]`)).toBeNull()
  })

  it('sorts the themed-pack feature first among Available', () => {
    render(h(PackDrawerScreen))
    const availableSection = screen.getByTestId('pack-section-available')
    const cards = availableSection.querySelectorAll('[data-testid^="kit-card-"]')
    expect(cards.length).toBeGreaterThanOrEqual(2)
    // The first card in the Available scroller should be the themed kit.
    expect(cards[0]?.getAttribute('data-testid')).toBe(`kit-card-${THEMED_KIT_ID}`)
  })
})

// ── Subscriber Exclusive section ─────────────────────────────────────────

describe('accept: PackDrawerScreen — Subscriber Exclusive section', () => {
  it('hides Subscriber Exclusive when player is not subscribed', () => {
    useSubscriptionStore.setState({ tier: 'free', isActive: false })
    render(h(PackDrawerScreen))
    expect(screen.queryByTestId('pack-section-subscriber')).toBeNull()
  })

  it('renders Subscriber Exclusive when subscriptionStore.isSubscribed("CORE") is true', async () => {
    const vipStore = await import('../modules/monetization/subscription-vip/SubscriptionVip')
    vipStore.subscriptionStore.getState().syncFromPlatform('CORE')
    useSubscriptionStore.setState({ tier: 'CORE', isActive: true })
    render(h(PackDrawerScreen))
    expect(screen.getByTestId('pack-section-subscriber')).toBeInTheDocument()
    expect(
      screen.getByTestId('pack-section-subscriber').querySelector(
        `[data-testid="kit-card-${SUBSCRIBER_KIT_ID}"]`,
      ),
    ).not.toBeNull()
  })
})

// ── KitCard tap → KitDetail ──────────────────────────────────────────────

describe('accept: PackDrawerScreen — KitCard tap navigation', () => {
  it('tapping a KitCard pushes kit-detail with { kitId }', () => {
    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${PAID_KIT_ID}`)
    act(() => {
      fireEvent.click(card)
    })
    const navState = useNavigationStore.getState()
    expect(navState.stack).toContain('kit-detail')
    const params = navState.getModalParams('kit-detail') ?? {}
    expect(params).toMatchObject({ kitId: PAID_KIT_ID })
  })

  it('tapping a KitCard emits store_opened { source: "kit_card_tap" }', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${PAID_KIT_ID}`)
    act(() => {
      fireEvent.click(card)
    })
    const call = trackSpy.mock.calls.find(
      ([name, props]) =>
        name === 'store_opened' &&
        (props as Record<string, unknown> | undefined)?.['source'] === 'kit_card_tap',
    )
    expect(call).toBeDefined()
    trackSpy.mockRestore()
  })
})

// ── Long-press themed pack → rewarded ad sheet ───────────────────────────

describe('accept: PackDrawerScreen — long-press themed pack', () => {
  it('long-press on a themed pack opens rewardedAdConfirm modal', async () => {
    // Make rewarded ad ready so the offered analytics can fire.
    const { rewardedPlacements } = await import('../systems/rewarded-placements')
    rewardedPlacements.rewardedAdFlow.simulateReady(true)

    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${THEMED_KIT_ID}`)
    act(() => {
      fireEvent.pointerDown(card)
    })
    // Wait the real long-press threshold + a tick to let canShow's async path
    // (sync simulateReady=true microtask) resolve and openModal land.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    expect(useNavigationStore.getState().modalStack).toContain('rewardedAdConfirm')
    const params = useNavigationStore.getState().getModalParams('rewardedAdConfirm') ?? {}
    expect(params).toMatchObject({ packId: THEMED_KIT_ID })
    rewardedPlacements.rewardedAdFlow.simulateReady(null)
  })

  it('long-press emits rewarded_ad_offered { placement: "rewarded_pack_trial" } only when the readiness check passes', async () => {
    const { rewardedPlacements } = await import('../systems/rewarded-placements')
    rewardedPlacements.rewardedAdFlow.simulateReady(true)

    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${THEMED_KIT_ID}`)
    act(() => {
      fireEvent.pointerDown(card)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    const call = trackSpy.mock.calls.find(
      ([name]) => name === 'rewarded_ad_offered',
    )
    expect(call).toBeDefined()
    expect(call?.[1]).toMatchObject({ placement: 'rewarded_pack_trial' })
    trackSpy.mockRestore()
    rewardedPlacements.rewardedAdFlow.simulateReady(null)
  })

  it('long-press does NOT open the sheet or emit rewarded_ad_offered when the rewarded ad is not ready', async () => {
    const { rewardedPlacements } = await import('../systems/rewarded-placements')
    rewardedPlacements.rewardedAdFlow.simulateReady(false)

    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${THEMED_KIT_ID}`)
    act(() => {
      fireEvent.pointerDown(card)
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    expect(useNavigationStore.getState().modalStack).not.toContain('rewardedAdConfirm')
    const offeredCall = trackSpy.mock.calls.find(
      ([name]) => name === 'rewarded_ad_offered',
    )
    expect(offeredCall).toBeUndefined()
    trackSpy.mockRestore()
    rewardedPlacements.rewardedAdFlow.simulateReady(null)
  })

  it('short tap (under threshold) does NOT open the rewarded sheet', async () => {
    const { rewardedPlacements } = await import('../systems/rewarded-placements')
    rewardedPlacements.rewardedAdFlow.simulateReady(true)

    render(h(PackDrawerScreen))
    const card = screen.getByTestId(`kit-card-${THEMED_KIT_ID}`)
    act(() => {
      fireEvent.pointerDown(card)
      fireEvent.pointerUp(card)
    })
    // Wait past the threshold; the cancel via pointerUp should have aborted.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600))
    })
    expect(useNavigationStore.getState().modalStack).not.toContain('rewardedAdConfirm')
    rewardedPlacements.rewardedAdFlow.simulateReady(null)
  })
})

// ── Credits footer link removed ──────────────────────────────────────────
// The Credits surface lives in the Settings tab → About → Credits row
// (PRD § Screen: Credits). The Packs screen no longer duplicates that link
// in its footer; tests covering the Settings path own the Credits contract.

// ── Loading and error states ─────────────────────────────────────────────

describe('accept: PackDrawerScreen — loading + error states', () => {
  it('renders skeleton placeholders while the catalog is loading', () => {
    // Empty kits map → loading state (no kits hydrated yet).
    useKitsStore.setState({ kits: {} })
    render(h(PackDrawerScreen))
    expect(screen.getByTestId('pack-drawer-skeleton')).toBeInTheDocument()
  })

  it('renders the error banner with retry when both the catalog AND entitlements fail to load', async () => {
    // Banner shows only when (a) entitlements rejected AND (b) the catalog
    // (kits store) is empty. A successful kit catalog with a transient
    // entitlements failure is NOT a "catalog load" failure — the screen
    // continues to render kits with their seeded ownership state.
    useKitsStore.setState({ kits: {} })
    const loadSpy = vi
      .spyOn(useEntitlementsStore.getState(), 'loadEntitlements')
      .mockRejectedValueOnce(new Error('network'))
    render(h(PackDrawerScreen))
    await waitFor(() => {
      expect(screen.getByTestId('pack-drawer-error-banner')).toBeInTheDocument()
    })
    expect(screen.getByTestId('pack-drawer-error-retry')).toBeInTheDocument()
    loadSpy.mockRestore()
  })

  it('does NOT show the error banner when entitlements fail but the catalog renders', async () => {
    // Regression: dev sandbox would show "Couldn't load pack catalog" any
    // time the SDK entitlements fetch had a hiccup, even though the catalog
    // (kits) was statically seeded and rendering correctly.
    const loadSpy = vi
      .spyOn(useEntitlementsStore.getState(), 'loadEntitlements')
      .mockRejectedValueOnce(new Error('network'))
    render(h(PackDrawerScreen))
    await waitFor(() => {
      expect(screen.queryByTestId('pack-drawer-skeleton')).not.toBeInTheDocument()
    })
    expect(screen.queryByTestId('pack-drawer-error-banner')).not.toBeInTheDocument()
    loadSpy.mockRestore()
  })
})

// ── Analytics: screen_viewed ─────────────────────────────────────────────

describe('accept: PackDrawerScreen — analytics screen_viewed', () => {
  it('fires screen_viewed { screen: "packs" } once on mount', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'trackCanonical')
    render(h(PackDrawerScreen))
    const call = trackSpy.mock.calls.find(([name]) => name === 'screen_viewed')
    expect(call).toBeDefined()
    expect(call?.[1]).toMatchObject({ screen: 'packs' })
    trackSpy.mockRestore()
  })

  it('fires store_opened { source: "tab_tap" } on mount (Packs becomes visible)', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(PackDrawerScreen))
    const call = trackSpy.mock.calls.find(
      ([name, props]) =>
        name === 'store_opened' &&
        (props as Record<string, unknown> | undefined)?.['source'] === 'tab_tap',
    )
    expect(call).toBeDefined()
    trackSpy.mockRestore()
  })
})

// ── FTUE feature tutorial seedState ──────────────────────────────────────

describe('accept: PackDrawerScreen — FTUE feature tutorial', () => {
  it('exposes data-ftue spotlight target on the screen so the FTUE engine can find it', () => {
    render(h(PackDrawerScreen))
    // The Packs screen owns a stable `[data-ftue="pack-drawer-root"]` anchor
    // for the contextual feature tutorial. The tab-bar `[data-ftue="tab-packs"]`
    // anchor is owned by the tab bar (issue 05). This screen-side anchor
    // gives the FTUE engine a fallback target when the player has already
    // landed on the Packs tab.
    const anchor = document.querySelector('[data-ftue="pack-drawer-root"]')
    expect(anchor).not.toBeNull()
  })
})
