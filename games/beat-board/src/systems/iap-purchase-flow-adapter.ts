/**
 * iapPurchaseFlowAdapter — BeatBoard's wrapper around the installed
 * `monetization/iap-purchase-flow` Zustand store.
 *
 * Issue beat-board-15-pack-purchase-sheet owns this file. The base store
 * (`src/modules/monetization/iap-purchase-flow/IapPurchaseFlow.ts`) is the
 * source of truth for purchase status (loading/error/lastOpenedAt/balance);
 * this adapter binds the BeatBoard-specific success handlers and analytics
 * fan-out called for from prd.md § Screen: PackPurchaseSheet:
 *
 *   - On `RundotAPI.iap.spendCurrency` success:
 *       1. Grant `pack_owned_<packId>` entitlement (via entitlementsStore)
 *       2. Switch active kit (`kitsStore.setActiveKit(packId)`)
 *       3. Show "{packName} unlocked!" toast
 *       4. Auto-switch to the Play tab via navigationStore
 *       5. Fire `iap_purchase_complete` (+ `first_purchase` on the first
 *          lifetime purchase, + `currency_spent`) canonical analytics events.
 *   - On failure:
 *       1. Surface a structured `{ ok: false, reason, message }` so the
 *          caller (PackPurchaseSheet) can render the right banner and the
 *          "Add Runbucks" link when appropriate.
 *       2. Fire `iap_purchase_failed` analytics with reason.
 *
 * The adapter NEVER catches and silently drops errors — every failure is
 * surfaced to the caller AND logged via `RundotAPI.error`. The base
 * `iapStore.spendCurrency` swallows errors into store.error, so this
 * adapter calls `RundotAPI.iap.spendCurrency` directly to preserve the
 * thrown error semantics needed for branchable failure handling.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { iapStore } from '../modules/monetization/iap-purchase-flow/IapPurchaseFlow'
import {
  useEntitlementsStore,
  PACK_OWNED_PREFIX,
} from '../stores/entitlementsStore'
import { useKitsStore } from '../stores/kitsStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useToastStore } from '../modules/ui/toast-notifications/ToastNotifications'
import { useWalletStore } from '../stores/walletStore'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'

// ── Types ─────────────────────────────────────────────────────────────────

export interface PurchaseInput {
  /** SDK product id (e.g. `pack_lofi_heights_pro`). */
  productId: string
  /** Runbucks price for analytics + UI binding. */
  priceRunbucks: number
  /** BeatBoard pack id (entitlement and kit-switch target). */
  packId: string
  /** Display name used in the success toast. */
  packName: string
}

export type PurchaseFailureReason = 'insufficient_balance' | 'error' | 'cancelled'

export type PurchaseResult =
  | { ok: true }
  | { ok: false; reason: PurchaseFailureReason; message?: string }

export interface IapPurchaseFlowAdapter {
  /** Begin a purchase. Resolves with the structured result. */
  purchase(input: PurchaseInput): Promise<PurchaseResult>
  /**
   * Open the platform Runbucks store (top-up flow). Forwarded to
   * `RundotAPI.iap.openStore()`. Refreshes the wallet balance on resolve so
   * the wallet chip updates without a manual refresh.
   */
  openStore(): Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Storage key under which we persist the install timestamp used to compute
 * `daysSinceInstall` for the `first_purchase` analytics event.
 */
const INSTALLED_AT_KEY = 'beatboard.installedAt'

let installedAtCacheMs: number | null = null

async function ensureInstalledAtMs(): Promise<number> {
  if (installedAtCacheMs !== null) return installedAtCacheMs
  try {
    const raw = await RundotAPI.appStorage.getItem(INSTALLED_AT_KEY)
    if (typeof raw === 'string' && raw.length > 0) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed > 0) {
        installedAtCacheMs = parsed
        return parsed
      }
    }
  } catch (err) {
    RundotAPI.error('iapPurchaseFlowAdapter: failed to read installedAt', { err: String(err) })
  }
  // First-ever read — stamp now and persist for future sessions.
  const now = Date.now()
  installedAtCacheMs = now
  try {
    await RundotAPI.appStorage.setItem(INSTALLED_AT_KEY, String(now))
  } catch (err) {
    RundotAPI.error('iapPurchaseFlowAdapter: failed to persist installedAt', { err: String(err) })
  }
  return now
}

function classifyError(err: unknown): { reason: PurchaseFailureReason; message: string } {
  const message = err instanceof Error ? err.message : String(err)
  // Insufficient-balance is the only branchable failure with explicit UI;
  // the SDK signals it via the literal substring or error.code === 'insufficient_balance'.
  if (
    typeof message === 'string' &&
    /insufficient.?balance|insufficient[_ ]?funds/i.test(message)
  ) {
    return { reason: 'insufficient_balance', message }
  }
  if (typeof message === 'string' && /cancel/i.test(message)) {
    return { reason: 'cancelled', message }
  }
  return { reason: 'error', message }
}

// ── Adapter ───────────────────────────────────────────────────────────────

/**
 * Singleton adapter. Tests reset state between cases via
 * `__resetIapPurchaseFlowAdapter()`.
 */
export const iapPurchaseFlowAdapter: IapPurchaseFlowAdapter = {
  async purchase(input: PurchaseInput): Promise<PurchaseResult> {
    const { productId, priceRunbucks, packId, packName } = input

    // PRD § Monetization Analytics — `iap_purchase_started`.
    analyticsModule.track('iap_purchase_started', {
      product_id: productId,
      price_runbucks: priceRunbucks,
    })

    // Mirror loading state into the underlying iap-purchase-flow store so any
    // listening UI (debug console, etc.) sees the same surface.
    iapStore.setState({ isLoading: true, error: null })

    // Snapshot the "has the player ever purchased before?" flag BEFORE the
    // call resolves — the SDK flips this to true after success, so reading
    // afterward would always return true.
    let firstPurchase = false
    try {
      const hasPurchased = await RundotAPI.iap.hasUserMadePurchase()
      firstPurchase = !hasPurchased
    } catch (err) {
      // Non-blocking — first_purchase analytics defaults to false on error.
      RundotAPI.error('iapPurchaseFlowAdapter: hasUserMadePurchase failed', { err: String(err) })
    }

    // SDK ≥5.23: spendCurrency resolves with `{ success, error }` for a
    // declined or insufficient-funds spend instead of throwing — so a failed
    // spend must be detected from the result, NOT just the catch block.
    // Treating a resolved `{ success: false }` as success here would grant the
    // pack for free. Network/host faults can still throw, so we handle both.
    const fail = (rawError: unknown): PurchaseResult => {
      const { reason, message } = classifyError(rawError)
      iapStore.setState({ isLoading: false, error: message })
      analyticsModule.track('iap_purchase_failed', {
        product_id: productId,
        reason,
      })
      RundotAPI.error('iapPurchaseFlowAdapter: spendCurrency failed', {
        productId,
        priceRunbucks,
        reason,
        message,
      })
      return { ok: false, reason, message }
    }

    let spendResult: { success: boolean; error?: string }
    try {
      spendResult = await RundotAPI.iap.spendCurrency(productId, priceRunbucks, {
        description: `Unlock ${packName}`,
      })
    } catch (err) {
      return fail(err)
    }
    if (!spendResult.success) {
      return fail(spendResult.error ?? 'error')
    }

    iapStore.setState({ isLoading: false, error: null })

    // ── Success side-effects ───────────────────────────────────────────────

    // 1. Grant pack ownership entitlement.
    useEntitlementsStore.getState().grantEntitlement(`${PACK_OWNED_PREFIX}${packId}`, {
      source: 'shop_purchase',
    })

    // 2. Switch active kit.
    useKitsStore.getState().setActiveKit(packId)

    // 3. Toast.
    useToastStore.getState().show({
      severity: 'success',
      message: `${packName} unlocked!`,
      durationMs: 4000,
    })

    // 4. Auto-switch to Play tab.
    try {
      useNavigationStore.getState().setActiveTab('play')
    } catch (err) {
      RundotAPI.error('iapPurchaseFlowAdapter: setActiveTab(play) failed', { err: String(err) })
    }

    // 5. Refresh wallet so the chip reflects the post-spend balance.
    void useWalletStore.getState().refresh()

    // ── Analytics: completion + first-purchase + currency_spent ────────────

    analyticsModule.track('iap_purchase_complete', {
      product_id: productId,
      price_runbucks: priceRunbucks,
      first_purchase: firstPurchase,
    })

    analyticsModule.track('currency_spent', {
      currency: 'runbucks',
      amount: priceRunbucks,
      sink: productId,
    })

    if (firstPurchase) {
      const installedAt = await ensureInstalledAtMs()
      const daysSinceInstall = Math.max(
        0,
        Math.floor((Date.now() - installedAt) / (24 * 60 * 60 * 1000)),
      )
      analyticsModule.track('first_purchase', {
        product_id: productId,
        days_since_install: daysSinceInstall,
      })
    }

    return { ok: true }
  },

  async openStore(): Promise<void> {
    try {
      const result = await RundotAPI.iap.openStore()
      if (typeof result?.newBalance === 'number' && Number.isFinite(result.newBalance)) {
        useWalletStore.setState({ balance: result.newBalance })
      } else {
        // Fallback: re-read balance through the wallet store.
        await useWalletStore.getState().refresh()
      }
    } catch (err) {
      RundotAPI.error('iapPurchaseFlowAdapter: openStore failed', { err: String(err) })
    }
  },
}

// ── Test helpers ──────────────────────────────────────────────────────────

/** Drop the cached `installedAt` so vitest cases start from a clean state. */
export function __resetIapPurchaseFlowAdapter(): void {
  installedAtCacheMs = null
}
