/**
 * Acceptance tests for issue beat-board-31-smoke-pack-purchase.
 *
 * Smoke companion: validates the underlying contract that the
 * pack-purchase + welcome-pack-icebreaker smoke spec relies on, before the
 * Playwright lane (`e2e/playwright/smoke-pack-purchase.spec.ts`) drives the
 * full UI flow.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks below. Acceptance criteria the smoke spec will verify through the
 * UI:
 *   - [ui] Welcome Pack banner gating: ftue.complete + 1 lifetime mix +
 *     recordingsThisSession ≥ 1 + offer marker unset → `shouldShow()` true.
 *   - [ui] Tapping the banner opens WelcomePackOfferSheet (vitest exercises
 *     the welcome-pack-trigger marker write — Playwright exercises the
 *     navigation route through the modal stack).
 *   - [ui] Maybe-later persists `welcomePack.offerShownAt` and suppresses
 *     future banners.
 *   - [ui] KitDetail "Get [Pack]" CTA wires through PackPurchaseSheet via
 *     `iapPurchaseFlowAdapter.purchase`; on success, the entitlement and
 *     active-kit switch land.
 *   - [state] Analytics events fire in the documented order:
 *     `welcome_pack_offer_shown` → `iap_purchase_started` (or
 *     `welcome_pack_offer_shown` + the maybe-later dismiss, no
 *     `iap_purchase_started`).
 *   - [state] `entitlements.list()` includes `pack_owned_<packId>` after
 *     a Genre Pack purchase.
 *   - [state] `iap_purchase_complete` fires with `{ first_purchase: true }`
 *     for the first lifetime purchase.
 *
 * The core debug-API surface used by the spec
 * (`beatboard.ftue.complete`, `beatboard.recording.start`,
 * `beatboard.welcomePack.reset`, `beatboard.entitlements.list`,
 * `beatboard.wallet.setBalance`) is also pinned here so a missing endpoint
 * surfaces in vitest before the Playwright lane fails opaquely.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_OWNED_PREFIX,
} from '../stores/entitlementsStore'
import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useMixesStore } from '../stores/mixesStore'
import { useWalletStore } from '../stores/walletStore'
import { useNavigationStore } from '../stores/navigationStore'
import {
  useToastStore,
  resetToastStore,
} from '../modules/ui/toast-notifications/ToastNotifications'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { trackBeatBoardFunnelStep } from '../systems/analytics'
import { NAVIGATION } from '../tabs/tabConfig'
import { installDebugApi } from '../dev/DebugApi'
import {
  installBeatBoardDebugApi,
  __resetBeatBoardDebugInstall,
  __resetBeatBoardDebugStubState,
} from '../systems/debug-api'

// Genre Pack used by the spec (per prd.md § IAP Pricing Table — paid Genre
// Pack at 299 Runbucks).
const GENRE_PACK_ID = 'mellow-trap'
const GENRE_PACK_PRODUCT_ID = 'pack_mellow_trap'
const GENRE_PACK_PRICE = 299
const GENRE_PACK_NAME = 'Mellow Trap'

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

  vi.mocked(RundotAPI.appStorage.getItem).mockResolvedValue(null)
  vi.mocked(RundotAPI.appStorage.setItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.appStorage.removeItem).mockResolvedValue(undefined)
  vi.mocked(RundotAPI.iap.spendCurrency).mockResolvedValue({ success: true })
  vi.mocked(RundotAPI.iap.openStore).mockResolvedValue({
    purchased: false,
    newBalance: 0,
  })
  vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValue(false)

  await __resetWelcomePackTrigger()
  __resetIapPurchaseFlowAdapter()
  resetEntitlementsStore()
  resetKitsStore()
  resetToastStore()
  useMixesStore.setState({ mixes: [], unviewedCount: 0 })
  useWalletStore.setState({ balance: 1280 })
  iapStore.getState().reset()
  useNavigationStore.getState().configure(NAVIGATION)

  __resetBeatBoardDebugInstall()
  __resetBeatBoardDebugStubState()
  installDebugApi()
  installBeatBoardDebugApi()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── Debug API surface pin ─────────────────────────────────────────────────

describe('accept: smoke-pack-purchase — debug API surface used by the spec', () => {
  it('window.__GAME_DEBUG__.beatboard exposes ftue.complete, recording.start, welcomePack.reset, entitlements.list, wallet.setBalance', () => {
    const beat = window.__GAME_DEBUG__.beatboard
    expect(beat).toBeDefined()
    if (!beat) return
    expect(typeof beat.ftue.complete).toBe('function')
    expect(typeof beat.recording.start).toBe('function')
    expect(typeof beat.welcomePack.reset).toBe('function')
    expect(typeof beat.welcomePack.markShown).toBe('function')
    expect(typeof beat.welcomePack.shouldShow).toBe('function')
    expect(typeof beat.welcomePack.noteRecordingCompleted).toBe('function')
    expect(typeof beat.entitlements.list).toBe('function')
    expect(typeof beat.wallet.setBalance).toBe('function')
    expect(typeof beat.wallet.getBalance).toBe('function')
  })

  it('wallet.setBalance round-trips through the wallet store', () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    beat.wallet.setBalance(2500)
    expect(beat.wallet.getBalance()).toBe(2500)
    expect(useWalletStore.getState().balance).toBe(2500)
  })
})

// ── Welcome Pack banner gating ────────────────────────────────────────────

describe('accept: smoke-pack-purchase — Welcome Pack banner gating', () => {
  it('shouldShow() is true after seeding ftue.complete + recording one mix (first lifetime, marker unset)', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()
    expect(await welcomePackTrigger.shouldShow()).toBe(true)
  })

  it('Maybe-later → markShown() persists offerShownAt under beatboard_welcome_pack', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()

    // Round-trip captured writes back into the read mock so the marker
    // behaves like a real SDK appStorage entry.
    let stored: string | null = null
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(
      async (_k: string, v: string) => {
        stored = v
      },
    )
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async () => stored)

    await welcomePackTrigger.markShown()

    // Persisted under the canonical key with an offerShownAt timestamp.
    const setSpy = vi.mocked(RundotAPI.appStorage.setItem)
    const wrote = setSpy.mock.calls.find(([key]) => key === WELCOME_PACK_STORAGE_KEY)
    expect(wrote).toBeTruthy()
    if (!wrote) return
    const [, value] = wrote as [string, string]
    expect(value).toMatch(/offerShownAt/)
  })

  it('subsequent records do not surface the banner once Maybe-later persisted the marker', async () => {
    seedSingleLifetimeMix()
    welcomePackTrigger.noteRecordingCompleted()

    let stored: string | null = null
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(
      async (_k: string, v: string) => {
        stored = v
      },
    )
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async () => stored)

    await welcomePackTrigger.markShown()

    // Even a second recording in the same session does not re-open the gate.
    welcomePackTrigger.noteRecordingCompleted()
    expect(await welcomePackTrigger.shouldShow()).toBe(false)
  })

  it('debug API beatboard.welcomePack.shouldShow mirrors welcome-pack-trigger.shouldShow', async () => {
    seedSingleLifetimeMix()
    const beat = window.__GAME_DEBUG__.beatboard!
    beat.welcomePack.noteRecordingCompleted()
    expect(await beat.welcomePack.shouldShow()).toBe(true)
  })

  it('debug API beatboard.welcomePack.reset clears the marker and re-opens the gate', async () => {
    seedSingleLifetimeMix()
    const beat = window.__GAME_DEBUG__.beatboard!

    let stored: string | null = null
    vi.mocked(RundotAPI.appStorage.setItem).mockImplementation(
      async (_k: string, v: string) => {
        stored = v
      },
    )
    vi.mocked(RundotAPI.appStorage.removeItem).mockImplementation(async () => {
      stored = null
    })
    vi.mocked(RundotAPI.appStorage.getItem).mockImplementation(async () => stored)

    beat.welcomePack.noteRecordingCompleted()
    await beat.welcomePack.markShown()
    expect(await beat.welcomePack.shouldShow()).toBe(false)

    await beat.welcomePack.reset()
    // After reset the in-memory counter is also wiped, so we re-prime it
    // before re-checking the gate (mirrors what the spec does after reset).
    beat.welcomePack.noteRecordingCompleted()
    expect(await beat.welcomePack.shouldShow()).toBe(true)
  })
})

// ── KitDetail → PackPurchaseSheet → entitlement grant ─────────────────────

describe('accept: smoke-pack-purchase — Genre Pack purchase grants pack_owned entitlement', () => {
  it('iapPurchaseFlowAdapter.purchase grants pack_owned_<packId> on success', async () => {
    const result = await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })
    expect(result.ok).toBe(true)
    expect(useEntitlementsStore.getState().ownsPack(GENRE_PACK_ID)).toBe(true)
  })

  it('debug API beatboard.entitlements.list reports pack_owned_<packId> after purchase', async () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })
    const list = beat.entitlements.list()
    const owned = list.find((e) => e.itemId === `${PACK_OWNED_PREFIX}${GENRE_PACK_ID}`)
    expect(owned).toBeTruthy()
  })

  it('purchase success switches to Play with the new pack as the active kit', async () => {
    useNavigationStore.getState().setActiveTab('packs')
    await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })
    expect(useNavigationStore.getState().activeTab).toBe('play')
    expect(useKitsStore.getState().activeKitId).toBe(GENRE_PACK_ID)
  })

  it('purchase success shows "[Pack] unlocked!" toast', async () => {
    await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })
    const toasts = useToastStore.getState().toasts
    const unlockToast = toasts.find((t) => t.message === `${GENRE_PACK_NAME} unlocked!`)
    expect(unlockToast).toBeTruthy()
  })

  it('debug API beatboard.wallet.setBalance simulates sufficient balance for the spec', () => {
    const beat = window.__GAME_DEBUG__.beatboard!
    beat.wallet.setBalance(GENRE_PACK_PRICE * 4)
    expect(beat.wallet.getBalance()).toBeGreaterThanOrEqual(GENRE_PACK_PRICE)
  })
})

// ── Analytics ordering: welcome_pack_offer_shown → iap_purchase_started ──

describe('accept: smoke-pack-purchase — analytics event ordering', () => {
  it('welcome_pack_offer_shown funnel step fires BEFORE iap_purchase_started when the player taps Get on the welcome pack offer', async () => {
    const trackFunnelSpy = vi.spyOn(analyticsModule, 'trackFunnel')
    const trackSpy = vi.spyOn(analyticsModule, 'track')

    // Simulate the on-mount funnel step the WelcomePackOfferSheet fires.
    trackBeatBoardFunnelStep('welcome_pack_offer_shown')

    // Then the player taps "Get" — iap_purchase_started fires.
    await iapPurchaseFlowAdapter.purchase({
      productId: 'welcome_pack',
      priceRunbucks: 99,
      packId: 'lofi-heights-extended',
      packName: 'Lofi Heights · Extended',
    })

    // Map call indices to invocation timeline order so we can compare a
    // trackFunnel call against a track call.
    const funnelOrders = trackFunnelSpy.mock.calls.map((c, i) => ({
      stepName: c[1] as string,
      order: trackFunnelSpy.mock.invocationCallOrder[i] ?? 0,
    }))
    const trackOrders = trackSpy.mock.calls.map((c, i) => ({
      name: c[0] as string,
      order: trackSpy.mock.invocationCallOrder[i] ?? 0,
    }))
    const offerShownOrder = funnelOrders.find(
      (e) => e.stepName === 'welcome_pack_offer_shown',
    )?.order
    const iapStartedOrder = trackOrders.find(
      (e) => e.name === 'iap_purchase_started',
    )?.order
    expect(offerShownOrder).toBeDefined()
    expect(iapStartedOrder).toBeDefined()
    if (offerShownOrder === undefined || iapStartedOrder === undefined) return
    expect(offerShownOrder).toBeLessThan(iapStartedOrder)
  })

  it('Maybe-later path fires welcome_pack_offer_shown WITHOUT iap_purchase_started', async () => {
    const trackFunnelSpy = vi.spyOn(analyticsModule, 'trackFunnel')
    const trackSpy = vi.spyOn(analyticsModule, 'track')

    // Simulate the on-mount welcome-pack offer.
    trackBeatBoardFunnelStep('welcome_pack_offer_shown')

    // Player chooses Maybe later — no purchase, so iap_purchase_started never fires.
    await welcomePackTrigger.markShown()

    const offerShownCall = trackFunnelSpy.mock.calls.find(
      (c) => c[1] === 'welcome_pack_offer_shown',
    )
    const iapStartedCall = trackSpy.mock.calls.find(
      (c) => c[0] === 'iap_purchase_started',
    )
    expect(offerShownCall).toBeTruthy()
    expect(iapStartedCall).toBeUndefined()
  })

  it('iap_purchase_complete fires with first_purchase: true on the first lifetime purchase', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValueOnce(false)

    await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })

    const completeCall = trackSpy.mock.calls.find(
      (c) => c[0] === 'iap_purchase_complete',
    )
    expect(completeCall).toBeTruthy()
    if (!completeCall) return
    const [, properties] = completeCall as [string, Record<string, unknown>]
    expect(properties.first_purchase).toBe(true)
    expect(properties.product_id).toBe(GENRE_PACK_PRODUCT_ID)
    expect(properties.price_runbucks).toBe(GENRE_PACK_PRICE)
  })

  it('iap_purchase_complete fires with first_purchase: false for subsequent purchases', async () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    vi.mocked(RundotAPI.iap.hasUserMadePurchase).mockResolvedValueOnce(true)

    await iapPurchaseFlowAdapter.purchase({
      productId: GENRE_PACK_PRODUCT_ID,
      priceRunbucks: GENRE_PACK_PRICE,
      packId: GENRE_PACK_ID,
      packName: GENRE_PACK_NAME,
    })

    const completeCall = trackSpy.mock.calls.find(
      (c) => c[0] === 'iap_purchase_complete',
    )
    expect(completeCall).toBeTruthy()
    if (!completeCall) return
    const [, properties] = completeCall as [string, Record<string, unknown>]
    expect(properties.first_purchase).toBe(false)
  })
})
