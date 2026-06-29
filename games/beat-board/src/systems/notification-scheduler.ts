/**
 * notification-scheduler — BeatBoard's project-side wiring for the two
 * re-engagement notifications declared in prd.md § Local Notifications.
 *
 * Responsibilities (issue beat-board-26):
 *   1. `idle_after_first_record` — On `data/app-lifecycle.onBackground`,
 *      schedule a 24h reminder iff `mixesStore.mixes.length >= 1`. Cancel
 *      on `onForeground` if it has not yet fired.
 *   2. `pack_trial_expiring` — Subscribe to `entitlementsStore`. When a
 *      `pack_trial_<packId>` entitlement appears with a TTL, schedule a
 *      notification 1h before its `expiresAt`. Cancel when the entitlement
 *      is consumed, expired, or no longer present on foreground.
 *
 * Server-time alignment: the scheduler computes its "now" via injected
 * `deps.nowMs()` so the production wiring can route through
 * `data/server-time` (`getServerNow()` from `src/rundot/init.ts`) and tests
 * inject a controllable clock. Each `pack_trial_<packId>` carries an
 * absolute `expiresAt` from `entitlementsStore.grantEntitlement`; the
 * scheduler subtracts `deps.nowMs()` from that absolute timestamp so clock
 * skew between schedule-time and grant-time stays bounded.
 *
 * Platform push fallback: when `deps.isPlatformPushAvailable()` returns
 * `true`, the scheduler additionally calls `deps.firePlatformPush(notif)`
 * with the same payload. The local notification still schedules so the OS
 * delivers the reminder if the platform push silently drops (per prd.md §
 * Push Notifications § Implementation).
 *
 * Boundary: pure systems code. No React, no DOM, no R3F. Uses
 * `useEntitlementsStore.subscribe` and `useMixesStore.getState()` directly.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  useEntitlementsStore,
  PACK_TRIAL_PREFIX,
  trialPackIdFromItemId,
} from '../stores/entitlementsStore'
import { useMixesStore } from '../stores/mixesStore'
import { useKitsStore, getKitById } from '../stores/kitsStore'
import { getServerNow } from '../rundot/init'
import {
  createLocalNotifications,
  type LocalNotificationsService,
} from '../modules/data/local-notifications/LocalNotifications'
import { createAppLifecycle } from '../modules/data/app-lifecycle/AppLifecycle'

// ── Constants ────────────────────────────────────────────────────────────

/** Stable id used for the idle-after-first-record reminder (prefix-free). */
export const IDLE_REMINDER_ID = 'beatboard.idle_after_first_record'

/** prd.md § Local Notifications — 24h delay after backgrounding. */
export const IDLE_REMINDER_DELAY_SECONDS = 24 * 60 * 60

/** prd.md § Local Notifications — fire 1h before TTL ends. */
export const TRIAL_EXPIRING_LEAD_SECONDS = 60 * 60

/** Stable id pattern for trial expiring notifications. */
export function trialExpiringNotificationId(packId: string): string {
  return `beatboard.pack_trial_expiring.${packId}`
}

// ── Types ────────────────────────────────────────────────────────────────

export interface ScheduledNotification {
  /** Stable id used for cancellation. */
  id: string
  /** Notification title (≤1 emoji per prd.md tone). */
  title: string
  /** Notification body (sentence case, ≤50 chars where possible). */
  body: string
  /** Delay in seconds from "now" until the notification should fire. */
  delaySeconds: number
  /** Deep-link target string (`Play?packId=...`, `KitDetail?packId=...`). */
  deepLink: string
}

export interface NotificationSchedulerDeps {
  /**
   * Server-aware "now" in ms since epoch. Production wires this to
   * `getServerNow()`; tests inject a controllable clock.
   */
  nowMs: () => number
  /** Schedule a local notification. */
  schedule: (notif: ScheduledNotification) => Promise<void>
  /** Cancel a scheduled notification by id. */
  cancel: (id: string) => Promise<void>
  /** List currently scheduled notifications owned by this scheduler. */
  listScheduled: () => Promise<ScheduledNotification[]>
  /** Subscribe to background events. Returns unsubscribe. */
  onBackground: (cb: () => void) => () => void
  /** Subscribe to foreground events. Returns unsubscribe. */
  onForeground: (cb: () => void) => () => void
  /** Whether the platform push surface is available. */
  isPlatformPushAvailable: () => boolean
  /** Fire a real platform push with the same payload. */
  firePlatformPush: (notif: ScheduledNotification) => Promise<void>
}

export interface NotificationScheduler {
  /** Wire lifecycle + entitlement subscriptions. Idempotent. */
  attach(): void
  /** Tear down subscriptions. */
  detach(): void
  /** Currently-scheduled notifications snapshot (for debug/ops). */
  list(): Promise<ScheduledNotification[]>
  /** Drive the same path as a real background event. */
  simulateBackground(): void
  /** Drive the same path as a real foreground event. */
  simulateForeground(): void
  /** Fire the idle reminder immediately (delaySeconds = 0). */
  fireIdleReminderNow(): void
}

// ── Copy ─────────────────────────────────────────────────────────────────

function buildIdleReminder(packId: string, delaySeconds: number): ScheduledNotification {
  return {
    id: IDLE_REMINDER_ID,
    title: '🎵 BeatBoard',
    body: 'Your beat is waiting. Come keep building.',
    delaySeconds,
    deepLink: `Play?packId=${packId}`,
  }
}

function buildTrialExpiring(
  packId: string,
  delaySeconds: number,
): ScheduledNotification {
  const kit = getKitById(packId)
  const friendlyName = kit?.name ?? humanizePackId(packId)
  return {
    id: trialExpiringNotificationId(packId),
    title: '⏰ Trial ending soon',
    body: `Your ${friendlyName} trial ends in 1 hour.`,
    delaySeconds,
    deepLink: `KitDetail?packId=${packId}`,
  }
}

/**
 * Fallback humanizer for kits that haven't been hydrated yet — turns
 * `lofi_heights` into `Lofi Heights`. The kit catalog `name` is preferred
 * when available.
 */
function humanizePackId(packId: string): string {
  return packId
    .split('_')
    .map((part) => {
      const head = part.charAt(0).toUpperCase()
      return head + part.slice(1)
    })
    .filter((part) => part.length > 0)
    .join(' ')
}

// ── Implementation ───────────────────────────────────────────────────────

export function createNotificationScheduler(
  deps: NotificationSchedulerDeps,
): NotificationScheduler {
  let attached = false
  let unsubBackground: (() => void) | null = null
  let unsubForeground: (() => void) | null = null
  let unsubEntitlements: (() => void) | null = null
  // Track pack ids we have an outstanding `pack_trial_expiring` notification
  // for so revocations cancel the right id.
  const trackedTrialPackIds = new Set<string>()

  function safeSchedule(notif: ScheduledNotification): void {
    // Fire local schedule + platform push in parallel so callers observing
    // the deps mock see both effects in the same tick. Errors are logged
    // but never thrown — these are best-effort re-engagement reminders, not
    // critical paths. Wrap each call in try/catch so a synchronous throw
    // (some hosts surface platform errors before the promise wraps them)
    // does not propagate up the entitlement-subscriber chain and crash
    // unrelated UI surfaces.
    try {
      void Promise.resolve(deps.schedule(notif)).catch((err) => {
        RundotAPI.error('[notification-scheduler] schedule failed', {
          id: notif.id,
          err: String(err),
        })
      })
    } catch (err) {
      RundotAPI.error('[notification-scheduler] schedule threw synchronously', {
        id: notif.id,
        err: String(err),
      })
    }
    if (deps.isPlatformPushAvailable()) {
      try {
        void Promise.resolve(deps.firePlatformPush(notif)).catch((err) => {
          RundotAPI.error('[notification-scheduler] platform push failed', {
            id: notif.id,
            err: String(err),
          })
        })
      } catch (err) {
        RundotAPI.error('[notification-scheduler] platform push threw synchronously', {
          id: notif.id,
          err: String(err),
        })
      }
    }
  }

  function safeCancel(id: string): void {
    void (async () => {
      try {
        await deps.cancel(id)
      } catch (err) {
        RundotAPI.error('[notification-scheduler] cancel failed', {
          id,
          err: String(err),
        })
      }
    })()
  }

  function handleBackground(): void {
    const mixCount = useMixesStore.getState().mixes.length
    if (mixCount < 1) {
      // Too cold a touch — see prd.md § Push Notifications.
      return
    }
    const activeKitId = useKitsStore.getState().activeKitId
    safeSchedule(buildIdleReminder(activeKitId, IDLE_REMINDER_DELAY_SECONDS))
  }

  function handleForeground(): void {
    // Cancel idle reminder unconditionally on foreground — if it already
    // fired, the cancel is a no-op.
    safeCancel(IDLE_REMINDER_ID)

    // Sweep tracked trials: any pack id whose trial is no longer present
    // (consumed or expired) gets its scheduled notification cancelled.
    const entitlements = useEntitlementsStore.getState().entitlements
    const stillActive = new Set<string>()
    for (const ent of entitlements.values()) {
      if (!ent.itemId.startsWith(PACK_TRIAL_PREFIX)) continue
      const packId = trialPackIdFromItemId(ent.itemId)
      if (!packId) continue
      if (ent.expiresAt !== null && ent.expiresAt > deps.nowMs()) {
        stillActive.add(packId)
      }
    }
    for (const packId of [...trackedTrialPackIds]) {
      if (!stillActive.has(packId)) {
        safeCancel(trialExpiringNotificationId(packId))
        trackedTrialPackIds.delete(packId)
      }
    }
  }

  function reconcileTrialFromEntitlements(): void {
    const entitlements = useEntitlementsStore.getState().entitlements
    const seen = new Set<string>()
    for (const ent of entitlements.values()) {
      if (!ent.itemId.startsWith(PACK_TRIAL_PREFIX)) continue
      if (ent.expiresAt === null) continue
      const packId = trialPackIdFromItemId(ent.itemId)
      if (!packId) continue
      seen.add(packId)
      if (!trackedTrialPackIds.has(packId)) {
        // New trial grant — schedule the expiring notification.
        const remainingMs = ent.expiresAt - deps.nowMs()
        const leadMs = TRIAL_EXPIRING_LEAD_SECONDS * 1000
        const delayMs = Math.max(0, remainingMs - leadMs)
        const delaySeconds = Math.floor(delayMs / 1000)
        trackedTrialPackIds.add(packId)
        safeSchedule(buildTrialExpiring(packId, delaySeconds))
      }
    }
    // Cancel any tracked id whose entitlement disappeared.
    for (const packId of [...trackedTrialPackIds]) {
      if (!seen.has(packId)) {
        safeCancel(trialExpiringNotificationId(packId))
        trackedTrialPackIds.delete(packId)
      }
    }
  }

  return {
    attach(): void {
      if (attached) return
      attached = true
      unsubBackground = deps.onBackground(handleBackground)
      unsubForeground = deps.onForeground(handleForeground)
      // Reconcile once on attach so any trial granted before we wired up
      // gets scheduled, then subscribe for future grants/revokes.
      reconcileTrialFromEntitlements()
      unsubEntitlements = useEntitlementsStore.subscribe(() => {
        reconcileTrialFromEntitlements()
      })
    },
    detach(): void {
      if (!attached) return
      attached = false
      unsubBackground?.()
      unsubForeground?.()
      unsubEntitlements?.()
      unsubBackground = null
      unsubForeground = null
      unsubEntitlements = null
      trackedTrialPackIds.clear()
    },
    list(): Promise<ScheduledNotification[]> {
      return deps.listScheduled()
    },
    simulateBackground(): void {
      handleBackground()
    },
    simulateForeground(): void {
      handleForeground()
    },
    fireIdleReminderNow(): void {
      const activeKitId = useKitsStore.getState().activeKitId
      safeSchedule(buildIdleReminder(activeKitId, 0))
    },
  }
}

// ── Production singleton ─────────────────────────────────────────────────

let singleton: NotificationScheduler | null = null

/** Stable id prefix used for the BeatBoard notification namespace. */
export const NOTIFICATION_ID_PREFIX = 'beatboard.'

/**
 * Default deps wired to the live SDK + Zustand stores. Mounted by the
 * integrator boot sequence after `RundotAPI.initializeAsync()` resolves.
 *
 * Module integrations:
 *   - `data/local-notifications` provides the `LocalNotificationsService`
 *     used to scrub stale notifications and to introspect the pending list
 *     by prefix. Its static-schedule path is unused because BeatBoard
 *     schedules dynamically (per-pack trial expiries can't be enumerated at
 *     boot), so the service runs with an empty `schedule` and we tap its
 *     `cancelAll()` and the underlying `RundotAPI.notifications.scheduleAsync`
 *     directly for per-event scheduling.
 *   - `data/app-lifecycle` provides `createAppLifecycle()`. The shared
 *     project lifecycle service in `src/services/lifecycle.ts` only allows
 *     a single `register()` per process; recording-capture already owns
 *     that subscription. We therefore stand up a private lifecycle service
 *     here so notifications get a fresh callback set, then bridge its
 *     callbacks to the scheduler's deps.
 */
function defaultDeps(): NotificationSchedulerDeps {
  const localNotifications: LocalNotificationsService = createLocalNotifications({
    idPrefix: NOTIFICATION_ID_PREFIX,
    schedule: [], // event-driven; static schedule unused.
  })
  const lifecycle = createAppLifecycle()
  let lifecycleRegistered = false
  const bgCallbacks: Array<() => void> = []
  const fgCallbacks: Array<() => void> = []

  function ensureLifecycleRegistered(): void {
    if (lifecycleRegistered) return
    lifecycleRegistered = true
    lifecycle.register({
      onSleep: () => {
        for (const cb of bgCallbacks) cb()
      },
      onPause: () => {
        for (const cb of bgCallbacks) cb()
      },
      onAwake: () => {
        for (const cb of fgCallbacks) cb()
      },
      onResume: () => {
        for (const cb of fgCallbacks) cb()
      },
    })
  }

  return {
    nowMs: () => getServerNow(),
    schedule: async (notif: ScheduledNotification) => {
      // Use the SDK call directly with the module's prefix so all writes
      // are reachable by `localNotifications.cancelAll()` later.
      await RundotAPI.notifications.scheduleAsync(
        notif.title,
        notif.body,
        notif.delaySeconds,
        notif.id,
      )
    },
    cancel: async (id: string) => {
      await RundotAPI.notifications.cancelNotification(id)
    },
    listScheduled: async () => {
      try {
        // Round-trip through the module so the prefix-based filtering is
        // canonical and any future bookkeeping (RefreshResult etc.) lands
        // in one place.
        const diag = await localNotifications.getDebugDiagnostics()
        return diag.pendingNotificationIds.map((id: string) => ({
          id,
          title: '',
          body: '',
          delaySeconds: 0,
          deepLink: '',
        }))
      } catch {
        return []
      }
    },
    onBackground: (cb: () => void) => {
      ensureLifecycleRegistered()
      bgCallbacks.push(cb)
      return () => {
        const i = bgCallbacks.indexOf(cb)
        if (i >= 0) bgCallbacks.splice(i, 1)
      }
    },
    onForeground: (cb: () => void) => {
      ensureLifecycleRegistered()
      fgCallbacks.push(cb)
      return () => {
        const i = fgCallbacks.indexOf(cb)
        if (i >= 0) fgCallbacks.splice(i, 1)
      }
    },
    isPlatformPushAvailable: () => {
      // The Rundot SDK has not yet shipped a true platform-push surface; the
      // local notification API is the canonical path. This hook exists so a
      // future platform-push capability check can flip the flag without
      // touching the scheduler. Keep this `false` until the platform exposes
      // the capability.
      return false
    },
    firePlatformPush: async (_notif: ScheduledNotification) => {
      // No-op until the platform push surface is available.
      return
    },
  }
}

/**
 * Lazily-constructed production scheduler. Idempotent across HMR. The
 * integrator boot sequence calls `attach()` after server-time has synced.
 */
export function getNotificationScheduler(): NotificationScheduler {
  if (singleton === null) {
    singleton = createNotificationScheduler(defaultDeps())
  }
  return singleton
}

/** Test-only: drop the singleton so each spec gets a fresh scheduler. */
export function __resetNotificationScheduler(): void {
  if (singleton !== null) {
    singleton.detach()
  }
  singleton = null
}
