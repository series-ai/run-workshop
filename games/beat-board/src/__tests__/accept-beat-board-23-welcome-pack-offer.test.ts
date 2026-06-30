/**
 * Acceptance tests for issue beat-board-23-welcome-pack-offer.
 *
 * Covers:
 *   - welcome-pack-trigger.shouldShow gating logic (mixes.length === 1,
 *     recordingsThisSession >= 1, marker unset)
 *   - welcome-pack-trigger.markShown persistence + idempotence
 *   - WelcomePackOfferSheet UI: hero, title, contents list, price chip,
 *     wallet chip, primary/tertiary CTAs, one-time footer
 *   - Purchase flow → iapPurchaseFlowAdapter.purchase + analytics
 *   - "Maybe later" / dismiss → markShown(); offer never reappears
 *
 * RundotAPI is mocked via __tests__/setup.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  welcomePackTrigger,
  WELCOME_PACK_STORAGE_KEY,
  __resetWelcomePackTrigger,
} from '../systems/welcome-pack-trigger'
import {
  iapPurchaseFlowAdapter,
  __resetIapPurchaseFlowAdapter,
} from '../systems/iap-purchase-flow-adapter'
import { iapStore } from '../modules/monetization/iap-purchase-flow/IapPurchaseFlow'
import { useMixesStore } from '../stores/mixesStore'
import { useWalletStore } from '../stores/walletStore'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
} from '../stores/entitlementsStore'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useNavigationStore } from '../stores/navigationStore'
import {
  useToastStore,
  resetToastStore,
} from '../modules/ui/toast-notifications/ToastNotifications'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { NAVIGATION } from '../tabs/tabConfig'

import {
  WelcomePackOfferSheet,
  WELCOME_PACK_PACK_ID,
  WELCOME_PACK_PRICE_RUNBUCKS,
  WELCOME_PACK_PRODUCT_ID,
  WELCOME_PACK_GRANT_RUNBUCKS,
} from '../components/sheets/WelcomePackOfferSheet'

const h = React.createElement

function seedSingleLifetimeMix(): void {
  useMixesStore.setState({
    mixes: [
      {
        id: 'mix-first',
        title: 'First Beat',
        timestampLabel: 'Just now',
        durationLabel: '0:23',
        sourceKitId: 'lofi_heights_hero',
        posterActivePadIds: ['drums-1', 'bass-2'],
        isUnviewed: true,
        blobUrl: null,
      },
    ],
    unviewedCount: 1,
  })
}

beforeEach(async () => {
  vi.clearAllMocks()
  await __resetWelcomePackTrigger()
  __resetIapPurchaseFlowAdapter()
  resetEntitlementsStore()
  resetKitsStore()
  resetToastStore()
  useWalletStore.setState({ balance: 1280 })
  iapStore.getState().reset()
  useNavigationStore.getState().configure(NAVIGATION)
  // SDK mock baseline.
  vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValue({ success: true })
  vi.mocked(RundotAPI.iap.openStore).mockResolvedValue({ purchased: false, newBalance: 0 })
  vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValue(false)
  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── welcome-pack-trigger.shouldShow ─────────────────────────────────────

describe('accept: welcome-pack-trigger.shouldShow gating logic', () => {
  it('returns false when no mixes saved yet', async () => {
    useMixesStore.setState({ mixes: [], unviewedCount: 0 })
    welcomePackTrigger.noteRecordingCompleted()
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('returns false when more than one lifetime mix exists', async () => {
    useMixesStore.setState({
      mixes: [
        {
          id: 'a',
          title: 'a',
          timestampLabel: '',
          durationLabel: '0:23',
          sourceKitId: 'lofi_heights_hero',
          posterActivePadIds: [],
          isUnviewed: false,
          blobUrl: null,
        },
        {
          id: 'b',
          title: 'b',
          timestampLabel: '',
          durationLabel: '0:23',
          sourceKitId: 'lofi_heights_hero',
          posterActivePadIds: [],
          isUnviewed: false,
          blobUrl: null,
        },
      ],
      unviewedCount: 0,
    })
    welcomePackTrigger.noteRecordingCompleted()
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('returns false when recordingsThisSession === 0 (e.g. cross-session import only)', async () => {
    seedSingleLifetimeMix()
    // No noteRecordingCompleted() — counter stays 0.
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('returns false when offer marker is already set in appStorage', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()
    vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({ offerShownAt: 1700000000000 }),
    )
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('returns true when all three conditions are met', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()
    expect(await welcomePackTrigger.shouldShow()).toBe(true)
  })
})

// ── welcome-pack-trigger.markShown ──────────────────────────────────────

describe('accept: welcome-pack-trigger.markShown persistence', () => {
  it('writes to appStorage under the canonical key', async () => {
    await welcomePackTrigger.markShown()
    const setSpy = vi.mocked(RundotAPI.appStorage.setItem)
    expect(setSpy).toHaveBeenCalled()
    const [key, value] = setSpy.mock.calls[setSpy.mock.calls.length - 1]!
    expect(key).toBe(WELCOME_PACK_STORAGE_KEY)
    expect(value).toMatch(/offerShownAt/)
  })

  it('makes shouldShow() return false on the next read', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()
    // Capture writes back into the read mock so the marker round-trips through
    // appStorage like a real SDK.
    let stored: string | null = null
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(
      async (_k: string, v: string) => {
        stored = v
      },
    )
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async () => stored)
    await welcomePackTrigger.markShown()
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('is idempotent — second call does not overwrite the first timestamp', async () => {
    let stored: string | null = null
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(
      async (_k: string, v: string) => {
        stored = v
      },
    )
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async () => stored)
    await welcomePackTrigger.markShown()
    const firstWrite = stored
    expect(firstWrite).not.toBeNull()
    // Second call: the read returns existing marker so write is skipped.
    await welcomePackTrigger.markShown()
    expect(stored).toBe(firstWrite)
  })

  it('getOfferShownAt returns the persisted timestamp', async () => {
    vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValueOnce(
      JSON.stringify({ offerShownAt: 42 }),
    )
    expect(await welcomePackTrigger.getOfferShownAt()).toBe(42)
  })
})

// ── WelcomePackOfferSheet UI ────────────────────────────────────────────

describe('accept: WelcomePackOfferSheet UI', () => {
  it('renders hero banner, title, and one-time footer', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    expect(screen.getByTestId('welcome-pack-offer-hero')).toBeInTheDocument()
    expect(screen.getByTestId('welcome-pack-offer-title').textContent).toMatch(
      /Welcome Pack — for new producers/,
    )
    expect(
      screen.getByTestId('welcome-pack-offer-once-only').textContent,
    ).toMatch(/one-time only/i)
  })

  it('renders contents list (Lofi Heights Extended + 500 Runbucks)', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    expect(
      screen.getByTestId('welcome-pack-offer-content-kit').textContent,
    ).toMatch(/Lofi Heights · Extended Edition.*8 extra pads.*2 extra layers/)
    expect(
      screen.getByTestId('welcome-pack-offer-content-runbucks').textContent,
    ).toMatch(/\+500 Runbucks/)
  })

  it('renders price chip with 99 and wallet chip with current balance', async () => {
    useWalletStore.setState({ balance: 1280 })
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    expect(
      screen.getByTestId('welcome-pack-offer-price-chip').textContent,
    ).toMatch(/99/)
    const walletText = screen.getByTestId('welcome-pack-offer-wallet-chip').textContent ?? ''
    expect(walletText).toMatch(/1[,.]?280|1\.28?K|1\.3K/)
  })

  it('renders the primary "Get Welcome Pack — 99 Runbucks" CTA', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    const cta = screen.getByTestId('welcome-pack-offer-get')
    expect(cta).toBeInTheDocument()
    expect(cta.textContent).toMatch(/Get Welcome Pack.*99/)
  })

  it('renders the tertiary "Maybe later" dismiss button', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    const dismiss = screen.getByTestId('welcome-pack-offer-maybe-later')
    expect(dismiss).toBeInTheDocument()
    expect(dismiss.textContent).toMatch(/Maybe later/i)
  })

  it('fires welcome_pack_offer_shown funnel step on mount', async () => {
    const trackFunnelSpy = vi.spyOn(analyticsModule, 'trackFunnel')
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    const shownCall = trackFunnelSpy.mock.calls.find(
      (c) => c[1] === 'welcome_pack_offer_shown',
    )
    expect(shownCall).toBeTruthy()
  })

  it('calls markShown() on mount so the offer never reappears', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    const setSpy = vi.mocked(RundotAPI.appStorage.setItem)
    const writes = setSpy.mock.calls.filter(
      (c) => c[0] === WELCOME_PACK_STORAGE_KEY,
    )
    expect(writes.length).toBeGreaterThan(0)
  })

  it('"Maybe later" tap dismisses without invoking spendCurrency', async () => {
    const onClose = vi.fn()
    render(h(WelcomePackOfferSheet, { onClose }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-maybe-later'))
    })
    expect(onClose).toHaveBeenCalled()
    expect(vi.mocked(RundotAPI.iap.spendCurrency)).not.toHaveBeenCalled()
  })

  it('X button dismisses the sheet', async () => {
    const onClose = vi.fn()
    render(h(WelcomePackOfferSheet, { onClose }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-close'))
    })
    expect(onClose).toHaveBeenCalled()
  })
})

// ── Purchase flow ───────────────────────────────────────────────────────

describe('accept: WelcomePackOfferSheet — purchase flow', () => {
  it('"Get" tap calls iapPurchaseFlowAdapter.purchase with welcome_pack/99', async () => {
    const spendSpy = vi.mocked(RundotAPI.iap.spendCurrency)
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    expect(spendSpy).toHaveBeenCalledWith(
      WELCOME_PACK_PRODUCT_ID,
      WELCOME_PACK_PRICE_RUNBUCKS,
      expect.objectContaining({ description: expect.any(String) }),
    )
  })

  it('grants pack_owned_lofi-heights-extended entitlement on success', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    expect(useEntitlementsStore.getState().ownsPack(WELCOME_PACK_PACK_ID)).toBe(true)
  })

  it('switches to Play tab and dismisses on success', async () => {
    useNavigationStore.getState().setActiveTab('packs')
    const onClose = vi.fn()
    render(h(WelcomePackOfferSheet, { onClose }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    expect(useNavigationStore.getState().activeTab).toBe('play')
    expect(onClose).toHaveBeenCalled()
  })

  it('emits currency_earned for the +500 Runbucks server-side grant', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    const earnedCall = trackSpy.mock.calls.find((c) => c[0] === 'currency_earned')
    expect(earnedCall).toBeTruthy()
    expect(earnedCall![1]).toMatchObject({
      currency: 'runbucks',
      amount: WELCOME_PACK_GRANT_RUNBUCKS,
      source: 'welcome_pack_grant',
    })
  })

  it('fires welcome_pack_purchased funnel step on purchase success', async () => {
    const trackFunnelSpy = vi.spyOn(analyticsModule, 'trackFunnel')
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    const purchasedCall = trackFunnelSpy.mock.calls.find(
      (c) => c[1] === 'welcome_pack_purchased',
    )
    expect(purchasedCall).toBeTruthy()
  })

  it('shows "Welcome Pack unlocked! +500 Runbucks" toast on success', async () => {
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    const toasts = useToastStore.getState().toasts
    const welcomeToast = toasts.find((t) => /Welcome Pack/i.test(t.message))
    expect(welcomeToast).toBeTruthy()
    expect(welcomeToast!.message).toMatch(/\+500 Runbucks/)
  })

  it('renders error banner when SDK reports insufficient_balance', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(
      new Error('insufficient_balance'),
    )
    render(h(WelcomePackOfferSheet, { onClose: () => {} }))
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('welcome-pack-offer-get'))
    })
    expect(
      screen.getByTestId('welcome-pack-offer-error-banner'),
    ).toBeInTheDocument()
  })
})

// Reference unused imports so the strict-noUnused checker stays quiet when
// the helpers are used only inside conditional branches.
void useKitsStore
void iapPurchaseFlowAdapter
