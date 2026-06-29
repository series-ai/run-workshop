/**
 * deep-links — runtime wiring for BeatBoard's two PRD-defined deep links.
 *
 * Issue beat-board-28-wiring-polish owns this file.
 *
 * Per prd.md § Navigation Architecture § Deep links:
 *   - `idle_reminder` (notification tap) → `Play` with the player's last-used
 *      pack still active.
 *   - `share_link_received` (incoming share) → `Mixes` with the imported mix
 *      focused (playback-only — license-safe).
 *
 * Two responsibilities:
 *   1. `consumeBootDeepLinks()` is invoked once from `main.tsx` after SDK
 *      init completes. It resolves the host launch intent via
 *      `RundotAPI.app.resolveLaunchIntent()` and dispatches whichever payload
 *      is present (notification taps win over share imports when both surface,
 *      but in practice the host resolves a single intent kind).
 *   2. `routeNotificationDeepLink(id)` is the synchronous routing helper
 *      callers use when they already have a notification id (e.g. the
 *      debug API simulating a tap). The id format matches the values
 *      `notification-scheduler.ts` writes:
 *        - `beatboard.idle_after_first_record`
 *        - `beatboard.pack_trial_expiring.<packId>`
 *      The scheduler also embeds a structured `deepLink` field
 *      (`Play?packId=...`, `KitDetail?packId=...`); we accept both shapes
 *      so a future SDK that surfaces the deep-link string directly will
 *      route without code changes.
 *
 * `fireAppOpenFunnelStep()` emits the first-session funnel anchor
 * (`app_open`). It is called from `main.tsx` immediately after
 * `recordGameOpened` so the funnel chain `app_open → first_pad_tap →
 * first_record → mix_saved → first_share → welcome_pack_offer_shown →
 * welcome_pack_purchased` is wired end-to-end.
 *
 * Boundary: pure systems-style code. No React, no R3F, no DOM. Imports
 * the share-service-adapter and navigation store directly so the entry
 * call from `main.tsx` is a single function with no boot-time hooks.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useNavigationStore } from '../stores/navigationStore'
import {
  IDLE_REMINDER_ID,
  trialExpiringNotificationId,
} from '../systems/notification-scheduler'
import { getShareServiceAdapter } from '../systems/share-service-adapter'
import { recordCustomEvent, trackBeatBoardFunnelStep } from '../systems/analytics'
import { useKitsStore } from '../stores/kitsStore'

// ── Interstitial schema completeness ─────────────────────────────────────

/**
 * BeatBoard does NOT show interstitial ads in v1 (per prd.md § Monetization
 * Analytics — `interstitial_shown` is included "for compliance schema
 * completeness; never fires"). The call-site exists so warehouse schemas
 * see the event surface registered, gated behind a flag that is never
 * truthy in production. If a future BeatBoard release does add interstitial
 * placements, flip the gate at the call site rather than reintroducing the
 * event from scratch.
 */
const INTERSTITIALS_ENABLED_IN_V1 = false as const

/** Reachable callsite for `interstitial_shown` per prd.md compliance note. */
function maybeRecordInterstitialShown(placement: string, sessionDepth: number): void {
  if (INTERSTITIALS_ENABLED_IN_V1) {
    recordCustomEvent('interstitial_shown', {
      placement,
      sessionDepth,
    })
  }
}

/**
 * Public hook so a future ads integration can call into the gated emitter
 * without re-deriving the gate. v1 callers MUST NOT invoke this (the gate
 * is `false` and the call is a no-op), but the surface stays exported so
 * the analytics event has a discoverable callsite.
 */
export function recordInterstitialShownIfEnabled(
  placement: string,
  sessionDepth: number,
): void {
  maybeRecordInterstitialShown(placement, sessionDepth)
}

// ── Funnel anchor ────────────────────────────────────────────────────────

/**
 * Fire the `app_open` funnel step. Called once on boot from `main.tsx`
 * after `recordGameOpened`. Idempotent at the SDK level — multiple calls
 * within a session would double-count, so callers MUST gate on first-launch
 * boot only (not screen mounts).
 */
export function fireAppOpenFunnelStep(): void {
  trackBeatBoardFunnelStep('app_open')
}

// ── Notification deep-link routing ───────────────────────────────────────

/**
 * Route a notification id to the corresponding screen per prd.md § Local
 * Notifications + § Navigation Architecture § Deep links.
 *
 * `idle_after_first_record` → Play tab (the player's last-used pack is
 * already in `kitsStore.activeKitId`, so no extra payload is needed).
 *
 * `pack_trial_expiring.<packId>` → KitDetail for that pack. KitDetail is a
 * pushed screen inside the Packs tab, so we switch to the Packs tab first
 * and then push KitDetail with the pack id as a param.
 *
 * Unknown ids are silently ignored — the scheduler only writes the two
 * shapes above, but we don't want a stray host-side id to crash boot.
 */
export function routeNotificationDeepLink(notificationId: string): void {
  const nav = useNavigationStore.getState()

  if (notificationId === IDLE_REMINDER_ID) {
    nav.handleDeepLink({ kind: 'idle_reminder' })
    return
  }

  // pack_trial_expiring.<packId>
  // We probe by reconstructing each known active trial id and matching.
  // The scheduler's id is `beatboard.pack_trial_expiring.<packId>` — we
  // pull the packId out of the suffix when present.
  const trialPrefix = trialExpiringNotificationId('').replace(/\.$/, '')
  if (notificationId.startsWith(`${trialPrefix}.`)) {
    const packId = notificationId.slice(trialPrefix.length + 1)
    if (packId) {
      // Navigate to the Packs tab and push KitDetail with the pack id.
      nav.setActiveTab('packs')
      nav.pushScreen('kit-detail', { packId })
    }
    return
  }
}

// ── Boot-time deep-link consumption ──────────────────────────────────────

/**
 * Resolve the host launch intent on boot for any deep-link payloads and
 * dispatch. Called from `main.tsx` after `RundotAPI.initializeAsync()`
 * resolves and the navigation store is configured.
 *
 * The order is intentional: notification → share. A single host-launch
 * resolves one intent kind in practice, but if a notification intent
 * carries a screen target we route it first and then import the share
 * payload (which can co-exist with any tab).
 *
 * Async because `resolveLaunchIntent()` is an RPC. A resolution failure
 * must not crash boot — it only drives optional deep-link routing.
 */
export async function consumeBootDeepLinks(): Promise<void> {
  // 1) Notification tap — `RundotAPI.app.resolveLaunchIntent()` returns
  //    `kind === 'notification'` with a flat `params` payload. The
  //    scheduler embeds the id / `deepLink` fields inside those params; we
  //    accept either an `id`-style field or a structured `deepLink` string.
  try {
    const intent = await RundotAPI.app.resolveLaunchIntent()
    if (intent.kind === 'notification') {
      const params = intent.params as Record<string, unknown>
      const id = extractNotificationId(params)
      if (id) routeNotificationDeepLink(id)

      // Some hosts embed `deepLink: 'Play?packId=...'` — parse and route by
      // URL shape so a host that drops the id but keeps the link still
      // lands in the right place.
      const deepLink = extractDeepLinkString(params)
      if (deepLink) routeDeepLinkString(deepLink)
    }
  } catch (err) {
    RundotAPI.error('[deep-links] notification params route failed', {
      err: String(err),
    })
  }

  // 2) Incoming share — share-service-adapter resolves the launch intent's
  //    share params and writes the imported mix into `mixesStore`.
  try {
    const adapter = getShareServiceAdapter()
    if (await adapter.hasIncomingShare()) {
      await adapter.consumeIncomingShare()
    }
  } catch (err) {
    RundotAPI.error('[deep-links] share consumption failed', {
      err: String(err),
    })
  }
}

// ── URL-shape routing ────────────────────────────────────────────────────

/**
 * Route the structured `deepLink` strings the notification-scheduler
 * embeds (`Play?packId=...`, `KitDetail?packId=...`). Used as a fallback
 * when an SDK build surfaces the link string but not the id.
 */
function routeDeepLinkString(deepLink: string): void {
  const [target, query] = deepLink.split('?')
  const params = new URLSearchParams(query ?? '')
  const packId = params.get('packId') ?? undefined
  const nav = useNavigationStore.getState()

  if (target === 'Play') {
    if (packId) {
      // Best-effort: align the active kit so Play opens with the right pack.
      try {
        useKitsStore.getState().setActiveKit(packId)
      } catch {
        // Unknown pack id; fall through to plain Play deep-link.
      }
    }
    nav.handleDeepLink({ kind: 'idle_reminder' })
    return
  }

  if (target === 'KitDetail' && packId) {
    nav.setActiveTab('packs')
    nav.pushScreen('kit-detail', { packId })
    return
  }
}

function extractNotificationId(
  params: string | Record<string, unknown>,
): string | null {
  if (typeof params === 'string') return params || null
  const candidate =
    (params['id'] as string | undefined) ??
    (params['notificationId'] as string | undefined) ??
    (params['notification_id'] as string | undefined)
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

function extractDeepLinkString(
  params: string | Record<string, unknown>,
): string | null {
  if (typeof params === 'string') return null
  const candidate =
    (params['deepLink'] as string | undefined) ??
    (params['deep_link'] as string | undefined)
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}
