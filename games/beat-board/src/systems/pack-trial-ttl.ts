/**
 * pack-trial-ttl — BeatBoard's Pack Trial TTL Manager.
 *
 * Issue beat-board-08-entitlements-and-trial-ttl owns this file. The custom
 * system implements the "Rewarded ad → 24h pack trial" mechanic per prd.md
 * § Mechanics Detail § Pack ownership and access tiers and § Custom Systems
 * Required § Pack Trial TTL Manager.
 *
 * Responsibilities:
 *   - Watch active `pack_trial_<packId>` entitlements held by the
 *     `entitlementsStore` wrapper around `monetization/entitlements-service`.
 *   - Compute `remainingSeconds` from grant timestamp + TTL using a server-
 *     time-aware "now" function (defaults to the rundot init server clock).
 *   - Emit a single-shot `trial_expiring` event 1 hour before TTL expires,
 *     consumed by `data/local-notifications` to schedule the
 *     `pack_trial_expiring` user notification.
 *   - On expiry: revoke the entitlement (which fans out to
 *     `entitlement_consumed` analytics with `reason: 'expired'`) and emit
 *     a `trial_expired` event.
 *   - `formatRemaining(seconds)` — human-readable countdown copy used by
 *     the trial badge (UI updates once per minute per prd.md).
 *
 * UI cadence: prd.md § Pack ownership and access tiers explicitly notes
 * that the countdown UI updates once per minute (not once per second), so
 * `start()` schedules a 60s tick rather than a beat-clock-aligned tick.
 *
 * Boundary: this module is pure systems code. No React, no DOM, no R3F.
 */

import { getServerNow } from '../rundot/init'
import { analytics as analyticsModule } from '@modules/data/analytics-service/AnalyticsService'
import {
  useEntitlementsStore,
  PACK_TRIAL_PREFIX,
  trialPackIdFromItemId,
} from '../stores/entitlementsStore'

// ── Constants ────────────────────────────────────────────────────────────

/** prd.md § Pack ownership and access tiers — 1 hour before expiry. */
export const TRIAL_EXPIRING_LEAD_SECONDS = 3600

/** prd.md — UI updates once per minute. */
export const TRIAL_TICK_INTERVAL_MS = 60_000

/** Event name fired 1h before TTL expires. Consumed by local-notifications. */
export const TRIAL_EXPIRING_EVENT = 'trial_expiring' as const

/** Event name fired the moment TTL hits 0 (or below). */
export const TRIAL_EXPIRED_EVENT = 'trial_expired' as const

// ── Types ────────────────────────────────────────────────────────────────

export interface TrialEventPayload {
  packId: string
  itemId: string
}

export type TrialEventName = typeof TRIAL_EXPIRING_EVENT | typeof TRIAL_EXPIRED_EVENT

export interface PackTrialTtlDeps {
  /**
   * Server-aware "now" in milliseconds since epoch. Production wires this to
   * `getServerNow()` from `src/rundot/init.ts` so the countdown survives
   * device clock skew. Tests inject a controllable clock.
   */
  nowMs: () => number
  /**
   * Receive `trial_expiring` (1h before) and `trial_expired` (at expiry).
   * Production wires this to the `juice/feedback-channel` global bus or a
   * `data/local-notifications` adapter. Tests collect the calls.
   */
  emit: (name: TrialEventName, payload: TrialEventPayload) => void
}

export interface PackTrialTtlManager {
  /** Begin the once-per-minute polling loop. */
  start(): void
  /** Manually drive the watcher (used by tests + manual debug-api ticks). */
  tick(): void
  /** Stop the polling loop and clear scheduled timers. */
  stop(): void
  /**
   * Remaining seconds for the named pack. Returns 0 when there is no active
   * trial entitlement for that pack (callers should pair with
   * `entitlementsStore.isTrialActive()` before showing the chip).
   */
  remainingSeconds(packId: string): number
}

// ── formatRemaining ──────────────────────────────────────────────────────

/**
 * Human-readable trial-remaining string. Examples:
 *   formatRemaining(23 * 3600 + 42 * 60) → "23h 42m left"
 *   formatRemaining(57 * 60)             → "57m left"
 *   formatRemaining(30)                  → "Less than 1m"
 *
 * Per prd.md the chip reads "Trial — 23h 42m left"; this helper returns the
 * suffix after the en-dash (the chip composes the prefix in the UI).
 */
export function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 60) {
    return 'Less than 1m'
  }
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes - hours * 60
  if (hours >= 1) {
    return `${hours}h ${minutes}m left`
  }
  return `${minutes}m left`
}

// ── Manager ──────────────────────────────────────────────────────────────

export function createPackTrialTtlManager(
  deps: PackTrialTtlDeps,
): PackTrialTtlManager {
  // Pack-id-keyed set so each trial fires `trial_expiring` exactly once.
  const expiringFiredFor = new Set<string>()
  let intervalHandle: ReturnType<typeof setInterval> | null = null

  function listActiveTrialItems(): Array<{ itemId: string; packId: string; expiresAt: number }> {
    const entitlements = useEntitlementsStore.getState().entitlements
    const items: Array<{ itemId: string; packId: string; expiresAt: number }> = []
    for (const ent of entitlements.values()) {
      if (!ent.itemId.startsWith(PACK_TRIAL_PREFIX)) continue
      if (ent.expiresAt === null) continue
      const packId = trialPackIdFromItemId(ent.itemId)
      if (!packId) continue
      items.push({ itemId: ent.itemId, packId, expiresAt: ent.expiresAt })
    }
    return items
  }

  function tickInternal(): void {
    const now = deps.nowMs()
    for (const trial of listActiveTrialItems()) {
      const remainingMs = trial.expiresAt - now
      if (remainingMs <= 0) {
        // Expired — revoke (which fires entitlement_consumed analytics) and
        // emit the `trial_expired` event. Drop the firing record so a re-grant
        // of the same pack starts fresh.
        useEntitlementsStore.getState().revoke(trial.itemId, 'expired')
        deps.emit(TRIAL_EXPIRED_EVENT, { packId: trial.packId, itemId: trial.itemId })
        expiringFiredFor.delete(trial.itemId)
        continue
      }

      // Fire the lead-time warning exactly once per trial.
      if (
        remainingMs <= TRIAL_EXPIRING_LEAD_SECONDS * 1000 &&
        !expiringFiredFor.has(trial.itemId)
      ) {
        expiringFiredFor.add(trial.itemId)
        deps.emit(TRIAL_EXPIRING_EVENT, { packId: trial.packId, itemId: trial.itemId })
      }
    }
  }

  return {
    start(): void {
      if (intervalHandle !== null) return
      // Tick once immediately so we surface trial state on mount, then every
      // minute thereafter (prd.md UI cadence).
      tickInternal()
      intervalHandle = setInterval(tickInternal, TRIAL_TICK_INTERVAL_MS)
    },
    tick(): void {
      tickInternal()
    },
    stop(): void {
      if (intervalHandle !== null) {
        clearInterval(intervalHandle)
        intervalHandle = null
      }
    },
    remainingSeconds(packId: string): number {
      const itemId = `${PACK_TRIAL_PREFIX}${packId}`
      const ent = useEntitlementsStore.getState().get(itemId)
      if (!ent || ent.expiresAt === null) return 0
      const remaining = Math.max(0, Math.floor((ent.expiresAt - deps.nowMs()) / 1000))
      return remaining
    },
  }
}

// ── Production singleton ─────────────────────────────────────────────────

let singleton: PackTrialTtlManager | null = null

/**
 * Lazily-constructed production manager wired to the server-time clock and
 * the analytics module's custom-event surface for the `trial_expiring` /
 * `trial_expired` events. Mounted by `App.tsx` (or the integrator boot
 * sequence) once the SDK has finished initialising.
 */
export function getPackTrialTtlManager(): PackTrialTtlManager {
  if (singleton === null) {
    singleton = createPackTrialTtlManager({
      nowMs: () => getServerNow(),
      emit: (name, payload) => {
        analyticsModule.track(name, {
          item_id: payload.itemId,
          pack_id: payload.packId,
        })
      },
    })
  }
  return singleton
}

/** Test-only: drop the singleton between specs. */
export function __resetPackTrialTtlManager(): void {
  if (singleton !== null) {
    singleton.stop()
  }
  singleton = null
}
