/**
 * Acceptance tests for issue beat-board-15-pack-purchase-sheet.
 *
 * Covers:
 *   - iapPurchaseFlowAdapter.purchase(productId, priceRunbucks) which wraps
 *     the installed `monetization/iap-purchase-flow` store and adds
 *     BeatBoard-specific success handlers (entitlement grant, kit switch,
 *     toast, navigation) and analytics fan-out.
 *   - PackPurchaseSheet UI: hero, name, "What's inside", price chip, wallet
 *     chip, primary CTA, "Add Runbucks" link surfacing on insufficient
 *     balance, error banner, cancel.
 *
 * RundotAPI is mocked via __tests__/setup.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

import {
  iapPurchaseFlowAdapter,
  __resetIapPurchaseFlowAdapter,
} from '../systems/iap-purchase-flow-adapter'
import { iapStore } from '../modules/monetization/iap-purchase-flow/IapPurchaseFlow'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
} from '../stores/entitlementsStore'
import { useWalletStore } from '../stores/walletStore'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useToastStore, resetToastStore } from '../modules/ui/toast-notifications/ToastNotifications'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { NAVIGATION } from '../tabs/tabConfig'

import { PackPurchaseSheet } from '../components/sheets/PackPurchaseSheet'

const h = React.createElement

const PACK_ID = 'mellow-trap'
const PRODUCT_ID = 'pack_mellow_trap'
const PRICE = 299

beforeEach(() => {
  vi.clearAllMocks()
  __resetIapPurchaseFlowAdapter()
  resetEntitlementsStore()
  resetKitsStore()
  resetToastStore()
  useWalletStore.setState({ balance: 1000 })
  iapStore.getState().reset()
  useNavigationStore.getState().configure(NAVIGATION)
  // Default: ad/iap mocks succeed.
  vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValue({ success: true })
  vi.mocked(RundotAPI.iap.openStore).mockResolvedValue({ purchased: false, newBalance: 0 })
  vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValue(false)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ── iapPurchaseFlowAdapter.purchase ────────────────────────────────────────

describe('accept: iapPurchaseFlowAdapter.purchase success path', () => {
  it('invokes RundotAPI.iap.spendCurrency with the product id and amount', async () => {
    const spy = vi.mocked(RundotAPI.iap.spendCurrency)
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(spy).toHaveBeenCalledWith(
      PRODUCT_ID,
      PRICE,
      expect.objectContaining({ description: expect.any(String) }),
    )
  })

  it('returns { ok: true } when SDK resolves without error', async () => {
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.ok).toBe(true)
  })

  it('grants pack_owned_<packId> entitlement on success', async () => {
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(useEntitlementsStore.getState().ownsPack(PACK_ID)).toBe(true)
  })

  it('switches active kit to <packId> on success', async () => {
    useKitsStore.getState().setActiveKit('lofi_heights_hero')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(useKitsStore.getState().activeKitId).toBe(PACK_ID)
  })

  it('shows a "{Pack} unlocked!" toast on success', async () => {
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const toasts = useToastStore.getState().toasts
    expect(toasts.length).toBeGreaterThan(0)
    expect(toasts[0]!.message).toMatch(/Mellow Trap.*unlocked/i)
  })

  it('switches navigation to Play tab on success', async () => {
    useNavigationStore.getState().setActiveTab('packs')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(useNavigationStore.getState().activeTab).toBe('play')
  })

  it('emits iap_purchase_started analytics with productId + priceRunbucks', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const startedCall = trackSpy.mock.calls.find((c) => c[0] === 'iap_purchase_started')
    expect(startedCall).toBeTruthy()
    expect(startedCall![1]).toMatchObject({
      product_id: PRODUCT_ID,
      price_runbucks: PRICE,
    })
  })

  it('emits iap_purchase_complete analytics on success with firstPurchase flag', async () => {
    vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValueOnce(false)
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const completeCall = trackSpy.mock.calls.find((c) => c[0] === 'iap_purchase_complete')
    expect(completeCall).toBeTruthy()
    expect(completeCall![1]).toMatchObject({
      product_id: PRODUCT_ID,
      price_runbucks: PRICE,
      first_purchase: true,
    })
  })

  it('emits first_purchase analytics on the first lifetime spendCurrency success', async () => {
    vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValueOnce(false)
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const firstCall = trackSpy.mock.calls.find((c) => c[0] === 'first_purchase')
    expect(firstCall).toBeTruthy()
    expect(firstCall![1]).toMatchObject({ product_id: PRODUCT_ID })
    expect(typeof firstCall![1]!.days_since_install).toBe('number')
  })

  it('does not emit first_purchase when player has already purchased before', async () => {
    vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValueOnce(true)
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const firstCall = trackSpy.mock.calls.find((c) => c[0] === 'first_purchase')
    expect(firstCall).toBeUndefined()
  })

  it('emits currency_spent on success with sink=<productId>', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const spent = trackSpy.mock.calls.find((c) => c[0] === 'currency_spent')
    expect(spent).toBeTruthy()
    expect(spent![1]).toMatchObject({
      currency: 'runbucks',
      amount: PRICE,
      sink: PRODUCT_ID,
    })
  })
})

describe('accept: iapPurchaseFlowAdapter.purchase failure paths', () => {
  it('returns { ok: false, reason: "insufficient_balance" } when SDK throws insufficient', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('insufficient_balance'))
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('insufficient_balance')
  })

  it('returns { ok: false, reason: "error", message } on generic error', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('network down'))
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('error')
      expect(result.message).toMatch(/network down/)
    }
  })

  it('does not grant entitlement on failure', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('boom'))
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(useEntitlementsStore.getState().ownsPack(PACK_ID)).toBe(false)
  })

  // SDK ≥5.23: a declined spend RESOLVES with { success: false } instead of
  // throwing. The adapter must treat that as a failure — not silently grant
  // the pack for free.
  it('returns { ok: false } and grants nothing when spendCurrency resolves { success: false }', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValueOnce({
      success: false,
      error: 'insufficient_balance',
    })
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('insufficient_balance')
    expect(useEntitlementsStore.getState().ownsPack(PACK_ID)).toBe(false)
  })

  it('maps a resolved USER_CANCELLED spend to reason "cancelled" without granting', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValueOnce({
      success: false,
      error: 'USER_CANCELLED',
    })
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('cancelled')
    expect(useEntitlementsStore.getState().ownsPack(PACK_ID)).toBe(false)
  })

  it('emits iap_purchase_failed with reason on generic error', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('network down'))
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    await iapPurchaseFlowAdapter.purchase({
      productId: PRODUCT_ID,
      priceRunbucks: PRICE,
      packId: PACK_ID,
      packName: 'Mellow Trap',
    })
    const failCall = trackSpy.mock.calls.find((c) => c[0] === 'iap_purchase_failed')
    expect(failCall).toBeTruthy()
    expect(failCall![1]).toMatchObject({
      product_id: PRODUCT_ID,
    })
    expect(typeof failCall![1]!.reason).toBe('string')
  })
})

// ── PackPurchaseSheet UI ───────────────────────────────────────────────────

describe('accept: PackPurchaseSheet UI', () => {
  it('renders drag handle, hero, pack name, and "what\'s inside" line', async () => {
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    expect(screen.getByTestId('pack-purchase-sheet-handle')).toBeInTheDocument()
    expect(screen.getByTestId('pack-purchase-sheet-hero')).toBeInTheDocument()
    expect(screen.getByText(/Mellow Trap/)).toBeInTheDocument()
    expect(screen.getByText(/32 pads · 8 layers · BPM 80–95/)).toBeInTheDocument()
  })

  it('renders the price chip with the resolved Runbucks price', async () => {
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const priceChip = screen.getByTestId('pack-purchase-price-chip')
    expect(priceChip).toBeInTheDocument()
    expect(priceChip.textContent).toMatch(/299/)
  })

  it('renders the wallet chip with the current balance', async () => {
    useWalletStore.setState({ balance: 1280 })
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const walletChip = screen.getByTestId('pack-purchase-wallet-chip')
    expect(walletChip).toBeInTheDocument()
    // formatBalance() in the price chip abbreviates 1280 → "1.3K".
    expect(walletChip.textContent).toMatch(/1[,.]?280|1\.28?K|1\.3K/)
  })

  it('renders the primary Confirm purchase CTA', async () => {
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const cta = screen.getByTestId('pack-purchase-confirm')
    expect(cta).toBeInTheDocument()
    expect(cta.textContent).toMatch(/Confirm purchase/i)
  })

  it('shows "Add Runbucks" link only when balance < price; tap calls openStore', async () => {
    useWalletStore.setState({ balance: 100 })
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const addLink = screen.getByTestId('pack-purchase-add-runbucks')
    expect(addLink).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(addLink)
    })
    expect(vi.mocked(RundotAPI.iap.openStore)).toHaveBeenCalled()
  })

  it('hides "Add Runbucks" link when balance >= price', async () => {
    useWalletStore.setState({ balance: 1000 })
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    expect(screen.queryByTestId('pack-purchase-add-runbucks')).toBeNull()
  })

  it('Cancel tap dismisses the sheet without invoking spendCurrency', async () => {
    const onClose = vi.fn()
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-cancel'))
    })
    expect(onClose).toHaveBeenCalled()
    expect(vi.mocked(RundotAPI.iap.spendCurrency)).not.toHaveBeenCalled()
  })

  it('X button (close affordance) dismisses the sheet', async () => {
    const onClose = vi.fn()
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-close'))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('drag handle is keyboard/touch reachable and dismisses on activation', async () => {
    const onClose = vi.fn()
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-sheet-handle'))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('Confirm tap → success: spendCurrency called, sheet dismissed, kit set, navigated to Play', async () => {
    useNavigationStore.getState().setActiveTab('packs')
    const onClose = vi.fn()
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose,
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-confirm'))
    })
    await act(async () => {})
    expect(vi.mocked(RundotAPI.iap.spendCurrency)).toHaveBeenCalledWith(
      PRODUCT_ID,
      PRICE,
      expect.objectContaining({ description: expect.any(String) }),
    )
    expect(useEntitlementsStore.getState().ownsPack(PACK_ID)).toBe(true)
    expect(useKitsStore.getState().activeKitId).toBe(PACK_ID)
    expect(useNavigationStore.getState().activeTab).toBe('play')
    expect(onClose).toHaveBeenCalled()
  })

  it('Confirm CTA shows disabled/loading state during the SDK call', async () => {
    let resolveSpend: () => void = () => {}
    vi.mocked(RundotAPI.iap.spendCurrency).mockImplementationOnce(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveSpend = () => resolve({ success: true })
        }),
    )
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    const cta = screen.getByTestId('pack-purchase-confirm') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(cta)
    })
    expect(cta.disabled).toBe(true)
    await act(async () => {
      resolveSpend()
    })
  })

  it('insufficient balance error: shows banner + reveals Add Runbucks link', async () => {
    useWalletStore.setState({ balance: 100 })
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('insufficient_balance'))
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-confirm'))
    })
    await act(async () => {})
    const banner = screen.getByTestId('pack-purchase-error-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toMatch(/balance|enough|runbucks/i)
    // Add Runbucks link still present (balance < price).
    expect(screen.getByTestId('pack-purchase-add-runbucks')).toBeInTheDocument()
  })

  it('generic purchase error: shows banner with copy-able diagnostic', async () => {
    vi.mocked(RundotAPI.iap.spendCurrency).mockRejectedValueOnce(new Error('network failure'))
    render(
      h(PackPurchaseSheet, {
        packId: PACK_ID,
        packName: 'Mellow Trap',
        productId: PRODUCT_ID,
        priceRunbucks: PRICE,
        whatsInside: '32 pads · 8 layers · BPM 80–95',
        onClose: () => {},
      }),
    )
    await act(async () => {})
    await act(async () => {
      fireEvent.click(screen.getByTestId('pack-purchase-confirm'))
    })
    await act(async () => {})
    const banner = screen.getByTestId('pack-purchase-error-banner')
    expect(banner).toBeInTheDocument()
    expect(banner.textContent).toMatch(/network failure/)
  })
})
