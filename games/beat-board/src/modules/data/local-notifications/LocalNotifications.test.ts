import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  createLocalNotifications,
  type LocalNotificationsConfig,
  type NotificationEntry,
} from './LocalNotifications'

// ── Helpers ───────────────────────────────────────────────────────────────────

const notifs = {
  getAllScheduledLocalNotifications: vi.mocked(
    RundotAPI['notifications'].getAllScheduledLocalNotifications,
  ),
  cancelNotification: vi.mocked(RundotAPI['notifications'].cancelNotification),
  scheduleAsync: vi.mocked(RundotAPI['notifications'].scheduleAsync),
}
type PendingNotification = Awaited<
  ReturnType<typeof notifs.getAllScheduledLocalNotifications>
>[number]

function makeSchedule(overrides?: Partial<NotificationEntry>[]): NotificationEntry[] {
  const defaults: NotificationEntry[] = [
    { id: '4h', delaySeconds: 14400, title: 'App', body: 'Come back!' },
    { id: '24h', delaySeconds: 86400, title: 'App', body: 'Daily rewards await!' },
  ]
  if (!overrides) return defaults
  return defaults.map((d, i) => ({ ...d, ...overrides[i] }))
}

function makeConfig(partial?: Partial<LocalNotificationsConfig>): LocalNotificationsConfig {
  return {
    idPrefix: 'test-',
    schedule: makeSchedule(),
    ...partial,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LocalNotifications', () => {
  beforeEach(() => {
    notifs.getAllScheduledLocalNotifications.mockResolvedValue([])
    notifs.cancelNotification.mockResolvedValue(undefined)
    notifs.scheduleAsync.mockResolvedValue('scheduled-id')
  })

  describe('cancelAll', () => {
    it('cancels only notifications matching the prefix', async () => {
      notifs.getAllScheduledLocalNotifications.mockResolvedValue([
        { id: 'test-4h' },
        { id: 'test-24h' },
        { id: 'other-app-reminder' },
      ])

      const svc = createLocalNotifications(makeConfig())
      const count = await svc.cancelAll()

      expect(count).toBe(2)
      expect(notifs.cancelNotification).toHaveBeenCalledTimes(2)
      expect(notifs.cancelNotification).toHaveBeenCalledWith('test-4h')
      expect(notifs.cancelNotification).toHaveBeenCalledWith('test-24h')
    })

    it('returns 0 when no pending notifications exist', async () => {
      const svc = createLocalNotifications(makeConfig())
      const count = await svc.cancelAll()

      expect(count).toBe(0)
      expect(notifs.cancelNotification).not.toHaveBeenCalled()
    })

    it('skips notifications with no id', async () => {
      notifs.getAllScheduledLocalNotifications.mockResolvedValue([
        { id: 'test-4h' },
        {} as unknown as PendingNotification,
      ])

      const svc = createLocalNotifications(makeConfig())
      await svc.cancelAll()

      expect(notifs.cancelNotification).toHaveBeenCalledTimes(1)
      expect(notifs.cancelNotification).toHaveBeenCalledWith('test-4h')
    })
  })

  describe('scheduleAll', () => {
    it('schedules all entries with prefixed IDs', async () => {
      const svc = createLocalNotifications(makeConfig())
      const { scheduledCount, failedCount } = await svc.scheduleAll()

      expect(scheduledCount).toBe(2)
      expect(failedCount).toBe(0)
      expect(notifs.scheduleAsync).toHaveBeenCalledWith('App', 'Come back!', 14400, 'test-4h')
      expect(notifs.scheduleAsync).toHaveBeenCalledWith('App', 'Daily rewards await!', 86400, 'test-24h')
    })

    it('skips entries where shouldSchedule returns false', async () => {
      const schedule = makeSchedule()
      const firstEntry = schedule[0]!
      firstEntry.shouldSchedule = () => false

      const svc = createLocalNotifications(makeConfig({ schedule }))
      const { scheduledCount } = await svc.scheduleAll()

      expect(scheduledCount).toBe(1)
      expect(notifs.scheduleAsync).toHaveBeenCalledTimes(1)
      expect(notifs.scheduleAsync).toHaveBeenCalledWith('App', 'Daily rewards await!', 86400, 'test-24h')
    })

    it('includes entries where shouldSchedule returns true', async () => {
      const schedule = makeSchedule()
      const firstEntry = schedule[0]!
      firstEntry.shouldSchedule = () => true

      const svc = createLocalNotifications(makeConfig({ schedule }))
      const { scheduledCount } = await svc.scheduleAll()

      expect(scheduledCount).toBe(2)
    })

    it('uses getDelayOverride when it returns a number', async () => {
      const schedule = makeSchedule()
      const firstEntry = schedule[0]!
      firstEntry.getDelayOverride = () => 600

      const svc = createLocalNotifications(makeConfig({ schedule }))
      await svc.scheduleAll()

      expect(notifs.scheduleAsync).toHaveBeenCalledWith('App', 'Come back!', 600, 'test-4h')
    })

    it('falls back to delaySeconds when getDelayOverride returns undefined', async () => {
      const schedule = makeSchedule()
      const firstEntry = schedule[0]!
      firstEntry.getDelayOverride = () => undefined

      const svc = createLocalNotifications(makeConfig({ schedule }))
      await svc.scheduleAll()

      expect(notifs.scheduleAsync).toHaveBeenCalledWith('App', 'Come back!', 14400, 'test-4h')
    })

    it('counts failures without throwing', async () => {
      notifs.scheduleAsync
        .mockResolvedValueOnce('scheduled-id')
        .mockRejectedValueOnce(new Error('SDK error'))

      const svc = createLocalNotifications(makeConfig())
      const { scheduledCount, failedCount } = await svc.scheduleAll()

      expect(scheduledCount).toBe(1)
      expect(failedCount).toBe(1)
    })

    it('handles empty schedule', async () => {
      const svc = createLocalNotifications(makeConfig({ schedule: [] }))
      const { scheduledCount, failedCount } = await svc.scheduleAll()

      expect(scheduledCount).toBe(0)
      expect(failedCount).toBe(0)
      expect(notifs.scheduleAsync).not.toHaveBeenCalled()
    })
  })

  describe('refresh', () => {
    it('cancels then schedules and returns result', async () => {
      notifs.getAllScheduledLocalNotifications.mockResolvedValue([{ id: 'test-old' }])

      const svc = createLocalNotifications(makeConfig())
      const result = await svc.refresh()

      expect(notifs.cancelNotification).toHaveBeenCalledWith('test-old')
      expect(notifs.scheduleAsync).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ scheduledCount: 2, failedCount: 0 })
    })

    it('calls onRefreshed callback with result', async () => {
      const onRefreshed = vi.fn()
      const svc = createLocalNotifications(makeConfig({ onRefreshed }))
      const result = await svc.refresh()

      expect(onRefreshed).toHaveBeenCalledWith(result)
    })
  })

  describe('getDebugDiagnostics', () => {
    it('reports pending notifications and last refresh state', async () => {
      notifs.getAllScheduledLocalNotifications.mockResolvedValue([
        { id: 'test-4h' },
        { id: 'other-24h' },
      ])

      const svc = createLocalNotifications(makeConfig())
      await svc.refresh()

      expect(await svc.getDebugDiagnostics()).toEqual({
        idPrefix: 'test-',
        configuredEntryCount: 2,
        pendingNotificationIds: ['test-4h'],
        pendingNotificationCount: 1,
        lastRefreshResult: {
          scheduledCount: 2,
          failedCount: 0,
        },
      })
    })
  })
})
