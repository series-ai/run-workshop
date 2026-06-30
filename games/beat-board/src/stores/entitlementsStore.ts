/**
 * entitlementsStore — BeatBoard's typed wrapper around the installed
 * `monetization/entitlements-service` module.
 *
 * Issue beat-board-08-entitlements-and-trial-ttl owns this file. The module
 * `monetization/entitlements-service` is the underlying server-authoritative
 * cache (`loadEntitlements()` / `consume()` / `getLedger()`); this store
 * adds BeatBoard-specific:
 *
 *   - Typed pack-ownership helpers — `ownsPack(packId)`, `isTrialActive(packId)`,
 *     `trialRemainingSeconds(packId)`, `subscriberKitGranted()`.
 *   - `grantEntitlement()` proxy that records a local active entitlement so
 *     the UI reflects rewarded-ad trial grants and shop purchases instantly.
 *     Permanent unlocks (`pack_owned_*`) carry no TTL; trials carry
 *     `expiresAt = nowMs + ttlSeconds * 1000`.
 *   - Analytics fan-out: every grant fires `entitlement_granted`; every
 *     revoke fires `entitlement_consumed`. Both run through the typed
 *     analytics module (snake_case property keys per prd.md).
 *
 * The store does NOT iterate trials or schedule expiry — that is owned by
 * `src/systems/pack-trial-ttl.ts`. Keeping the store passive lets debug and
 * smoke tests inject grants without spinning up a watcher.
 *
 * Subscriber kit handling: `subscriberKitGranted()` reads from the
 * `subscription-vip` module's `subscriptionStore` so the boolean is always
 * in sync with the latest tier — no separate `pack_owned_subscriber_kit_*`
 * entitlement is required.
 */

import { create } from 'zustand'
import {
  entitlementsStore as serviceStore,
} from '../modules/monetization/entitlements-service/EntitlementsService'
import type { Entitlement } from '../modules/monetization/entitlements-service/types'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { subscriptionStore } from '../modules/monetization/subscription-vip/SubscriptionVip'

// ── Constants ────────────────────────────────────────────────────────────

/** prd.md § Pack ownership and access tiers — permanent ownership prefix. */
export const PACK_OWNED_PREFIX = 'pack_owned_'

/** prd.md § Pack ownership and access tiers — 24h trial prefix. */
export const PACK_TRIAL_PREFIX = 'pack_trial_'

/** prd.md § Mechanics Detail § Pack ownership: 24 hours = 86400s. */
export const TRIAL_TTL_SECONDS = 24 * 60 * 60

/**
 * Stable item ID prefix for the recurring monthly subscriber-only kit. The
 * concrete kit ID rotates monthly via `subscription-vip`; the boolean check
 * `subscriberKitGranted()` does not need the rotated suffix because access
 * is gated on the active subscription tier, not on a per-kit grant.
 */
export const SUBSCRIBER_KIT_ITEM_ID = 'subscriber_kit_monthly'

let platformEntitlementSyncEnabled = true

// ── Types ────────────────────────────────────────────────────────────────

export interface GrantOptions {
  /** TTL in seconds. Required for `pack_trial_*` grants. */
  ttlSeconds?: number
  /**
   * Source attribution forwarded to the `entitlement_granted` analytics event
   * (`shop_purchase`, `rewarded_ad`, `welcome_pack_offer`, etc.).
   */
  source?: string
}

export interface EntitlementsState {
  entitlements: Map<string, Entitlement>
  loadEntitlements: () => Promise<void>
  /**
   * Local optimistic grant. Permanent grants (`pack_owned_*`) carry
   * `expiresAt: null`; trials (`pack_trial_*`) carry `expiresAt = nowMs + ttlSeconds*1000`.
   * Server-authoritative grants still flow through the SDK; this method is
   * for the UI to reflect grants it just learned about (rewarded-ad reward,
   * just-completed purchase callback).
   */
  grantEntitlement: (itemId: string, options?: GrantOptions) => Entitlement
  /** Revoke an entitlement and fire `entitlement_consumed` analytics. */
  revoke: (itemId: string, reason?: string) => void
  /** Returns true when `pack_owned_<packId>` is held with quantity > 0. */
  ownsPack: (packId: string) => boolean
  /** Returns true when `pack_trial_<packId>` is held and not yet expired. */
  isTrialActive: (packId: string) => boolean
  /** Remaining trial seconds for `<packId>`, or 0 if no active trial. */
  trialRemainingSeconds: (packId: string) => number
  /** Returns true when an active subscription tier grants the monthly kit. */
  subscriberKitGranted: () => boolean
  /** Get the raw entitlement record by itemId. */
  get: (itemId: string) => Entitlement | undefined
  reset: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Strip the `pack_trial_` prefix from a trial item id. Returns `null` for
 * an item id that is NOT a trial entitlement so callers can early-out.
 */
export function trialPackIdFromItemId(itemId: string): string | null {
  if (!itemId.startsWith(PACK_TRIAL_PREFIX)) return null
  return itemId.slice(PACK_TRIAL_PREFIX.length)
}

/**
 * Strip the `pack_owned_` prefix from a permanent ownership item id. Returns
 * `null` for unrelated item ids.
 */
export function ownedPackIdFromItemId(itemId: string): string | null {
  if (!itemId.startsWith(PACK_OWNED_PREFIX)) return null
  return itemId.slice(PACK_OWNED_PREFIX.length)
}

function buildEntitlement(
  itemId: string,
  expiresAt: number | null,
): Entitlement {
  // Trials are consumable so the SDK can revoke them; permanent ownership is
  // non-consumable per the entitlements API docs.
  const isTrial = itemId.startsWith(PACK_TRIAL_PREFIX)
  return {
    entitlementId: `local:${itemId}:${Date.now()}`,
    itemId,
    quantity: 1,
    consumable: isTrial,
    status: 'active',
    expiresAt,
  }
}

// ── Store ────────────────────────────────────────────────────────────────

export const useEntitlementsStore = create<EntitlementsState>((set, get) => ({
  entitlements: new Map(),

  async loadEntitlements(): Promise<void> {
    if (!platformEntitlementSyncEnabled) {
      serviceStore.getState().reset()
      set({ entitlements: new Map() })
      return
    }
    await serviceStore.getState().loadEntitlements()
    // Mirror the service-store cache into our local map so the synchronous
    // helpers (`ownsPack`, `isTrialActive`, `trialRemainingSeconds`) never
    // need to await the service. The service store is the source of truth
    // for SDK-known entitlements; local grants from `grantEntitlement()`
    // overlay on top until `loadEntitlements()` reconciles.
    const next = new Map(get().entitlements)
    for (const [k, v] of serviceStore.getState().entitlements.entries()) {
      next.set(k, v)
    }
    set({ entitlements: next })
  },

  grantEntitlement(itemId: string, options?: GrantOptions): Entitlement {
    const ttlSeconds = options?.ttlSeconds
    const expiresAt =
      typeof ttlSeconds === 'number' && ttlSeconds > 0
        ? Date.now() + ttlSeconds * 1000
        : null
    const ent = buildEntitlement(itemId, expiresAt)
    set((state) => {
      const next = new Map(state.entitlements)
      next.set(itemId, ent)
      return { entitlements: next }
    })
    // Analytics track is best-effort — a missing SDK namespace must not
    // unwind the grant write, which has already mutated state above.
    try {
      analyticsModule.track('entitlement_granted', {
        item_id: itemId,
        quantity: 1,
        source: options?.source ?? 'unknown',
      })
    } catch (err) {
      // Avoid pulling in RundotAPI.error here (would create another path
      // that could fail). console.error is intentional and the only site
      // in this store.
      // eslint-disable-next-line no-console
      console.error('[entitlementsStore] grantEntitlement analytics failed', err)
    }
    return ent
  },

  revoke(itemId: string, reason?: string): void {
    const had = get().entitlements.has(itemId)
    if (!had) return
    set((state) => {
      const next = new Map(state.entitlements)
      next.delete(itemId)
      return { entitlements: next }
    })
    analyticsModule.track('entitlement_consumed', {
      item_id: itemId,
      quantity: 1,
      reason: reason ?? 'revoked',
    })
  },

  ownsPack(packId: string): boolean {
    const ent = get().entitlements.get(`${PACK_OWNED_PREFIX}${packId}`)
    return Boolean(ent && ent.quantity > 0 && ent.status === 'active')
  },

  isTrialActive(packId: string): boolean {
    const ent = get().entitlements.get(`${PACK_TRIAL_PREFIX}${packId}`)
    if (!ent) return false
    if (ent.expiresAt === null) return false
    return ent.expiresAt > Date.now() && ent.status === 'active'
  },

  trialRemainingSeconds(packId: string): number {
    const ent = get().entitlements.get(`${PACK_TRIAL_PREFIX}${packId}`)
    if (!ent || ent.expiresAt === null) return 0
    const remainingMs = ent.expiresAt - Date.now()
    if (remainingMs <= 0) return 0
    return Math.floor(remainingMs / 1000)
  },

  subscriberKitGranted(): boolean {
    // Subscriber kit access is gated on an active subscription tier; the
    // `subscription-vip` store flips back to 'none' on platform expiry, so we
    // simply ask the canonical store. No local entitlement record is kept —
    // the boolean is always live.
    return subscriptionStore.getState().isActive()
  },

  get(itemId: string): Entitlement | undefined {
    return get().entitlements.get(itemId)
  },

  reset(): void {
    set({ entitlements: new Map() })
  },
}))

/** Test/debug helper — drop the entire local entitlement cache. */
export function resetEntitlementsStore(): void {
  platformEntitlementSyncEnabled = true
  useEntitlementsStore.getState().reset()
  serviceStore.getState().reset()
}

export function setPlatformEntitlementSyncForDebug(enabled: boolean): void {
  platformEntitlementSyncEnabled = enabled
}
