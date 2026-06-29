/**
 * Local notifications service — schedule-on-start re-engagement notifications.
 *
 * Strategy on every app load:
 * 1. Cancel all pending notifications owned by this prefix
 * 2. Schedule fresh notifications from config
 *
 * OS permission is handled by the Rundot platform — games do not prompt or
 * gate scheduling on it. Keep scheduling unconditional; the platform decides
 * whether the notification is ultimately delivered.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NotificationEntry {
  /** Unique identifier — prefixed with config.idPrefix automatically */
  id: string
  /** Default delay in seconds from now */
  delaySeconds: number
  /** Notification title */
  title: string
  /** Notification body text */
  body: string
  /** If provided, only schedule when this returns true */
  shouldSchedule?: () => boolean
  /** If provided and returns a number, overrides delaySeconds */
  getDelayOverride?: () => number | undefined
}

export interface LocalNotificationsConfig {
  /** Prefix prepended to all notification IDs to avoid cross-game conflicts */
  idPrefix: string
  /** The notification schedule entries */
  schedule: ReadonlyArray<NotificationEntry>
  /** Optional callback after refresh completes (e.g. for analytics) */
  onRefreshed?: (result: RefreshResult) => void
}

export interface RefreshResult {
  scheduledCount: number
  failedCount: number
}

export interface ScheduledNotification {
  id?: string
}

export interface LocalNotificationsDebugDiagnostics {
  idPrefix: string
  configuredEntryCount: number
  pendingNotificationIds: string[]
  pendingNotificationCount: number
  lastRefreshResult: RefreshResult | null
}

export interface LocalNotificationsService {
  cancelAll(): Promise<number>
  scheduleAll(): Promise<{ scheduledCount: number; failedCount: number }>
  refresh(): Promise<RefreshResult>
  getDebugDiagnostics(): Promise<LocalNotificationsDebugDiagnostics>
}

// ── Service ───────────────────────────────────────────────────────────────────

export function createLocalNotifications(config: LocalNotificationsConfig): LocalNotificationsService {
  const { idPrefix, schedule, onRefreshed } = config
  let lastRefreshResult: RefreshResult | null = null

  function prefixedId(id: string): string {
    return `${idPrefix}${id}`
  }

  /**
   * Cancel all notifications matching our prefix.
   * Returns the number of notifications cancelled.
   */
  async function cancelAll(): Promise<number> {
    const pending: ScheduledNotification[] =
      await RundotAPI['notifications'].getAllScheduledLocalNotifications()
    const ours = pending.filter((n) => n.id?.startsWith(idPrefix))

    for (const notif of ours) {
      if (notif.id) {
        await RundotAPI['notifications'].cancelNotification(notif.id)
      }
    }

    return ours.length
  }

  /**
   * Schedule all notifications from the config schedule.
   * Skips entries whose shouldSchedule() returns false.
   * Uses getDelayOverride() when provided.
   */
  async function scheduleAll(): Promise<{ scheduledCount: number; failedCount: number }> {
    let scheduledCount = 0
    let failedCount = 0

    for (const entry of schedule) {
      if (entry.shouldSchedule && !entry.shouldSchedule()) {
        continue
      }

      const dynamicDelay = entry.getDelayOverride?.()
      const delaySeconds = dynamicDelay ?? entry.delaySeconds

      try {
        await RundotAPI['notifications'].scheduleAsync(
          entry.title,
          entry.body,
          delaySeconds,
          prefixedId(entry.id),
        )
        scheduledCount++
      } catch {
        failedCount++
      }
    }

    return { scheduledCount, failedCount }
  }

  /**
   * Main entry point: cancel existing → schedule fresh.
   * Call this after app initialization is complete (non-blocking).
   */
  async function refresh(): Promise<RefreshResult> {
    await cancelAll()
    const result = await scheduleAll()
    lastRefreshResult = result
    onRefreshed?.(result)
    return result
  }

  async function getDebugDiagnostics(): Promise<LocalNotificationsDebugDiagnostics> {
    let pending: ScheduledNotification[] = []
    try {
      pending = await RundotAPI['notifications'].getAllScheduledLocalNotifications()
    } catch {
      pending = []
    }

    const ours = pending
      .filter((notification) => notification.id?.startsWith(idPrefix))
      .map((notification) => notification.id ?? '')
      .filter(Boolean)
      .sort()

    return {
      idPrefix,
      configuredEntryCount: schedule.length,
      pendingNotificationIds: ours,
      pendingNotificationCount: ours.length,
      lastRefreshResult,
    }
  }

  return { cancelAll, scheduleAll, refresh, getDebugDiagnostics }
}
