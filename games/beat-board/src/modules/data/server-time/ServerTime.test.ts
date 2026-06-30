import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { createServerTimeService } from './ServerTime'

describe('ServerTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Set local time to 2026-02-27 10:00:00 UTC
    vi.setSystemTime(new Date('2026-02-27T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('sync', () => {
    it('stores offset from server time', async () => {
      const localTime = Date.now()
      const serverTime = localTime + 5000 // server is 5s ahead

      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime,
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      expect(svc.getOffset()).toBe(5000)
      expect(svc.isSynced()).toBe(true)
    })

    it('keeps offset at 0 on failure', async () => {
      vi.mocked(RundotAPI.requestTimeAsync).mockRejectedValue(
        new Error('Network error'),
      )

      const svc = createServerTimeService()
      await svc.sync()

      expect(svc.getOffset()).toBe(0)
      expect(svc.isSynced()).toBe(false)
    })
  })

  describe('isSynced', () => {
    it('returns false before sync', () => {
      const svc = createServerTimeService()
      expect(svc.isSynced()).toBe(false)
    })
  })

  describe('now', () => {
    it('returns adjusted time after sync', async () => {
      const localTime = Date.now()
      const serverTime = localTime + 3000

      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime,
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      // now() = Date.now() + offset (3000)
      expect(svc.now()).toBe(Date.now() + 3000)
    })

    it('returns Date.now() before sync (offset 0)', () => {
      const svc = createServerTimeService()
      expect(svc.now()).toBe(Date.now())
    })
  })

  describe('secondsUntilDailyReset', () => {
    it('calculates seconds until midnight UTC', async () => {
      // Local time is 10:00 UTC → next midnight is 14 hours away
      const localTime = Date.now()
      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime: localTime, // no offset
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      const seconds = svc.secondsUntilDailyReset(0)
      expect(seconds).toBe(14 * 60 * 60) // 14 hours in seconds
    })

    it('calculates seconds until custom reset hour', async () => {
      // Local time is 10:00 UTC → next 12:00 UTC is 2 hours away
      const localTime = Date.now()
      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime: localTime,
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      const seconds = svc.secondsUntilDailyReset(12)
      expect(seconds).toBe(2 * 60 * 60)
    })

    it('wraps to next day when reset hour already passed', async () => {
      // Local time is 10:00 UTC → next 6:00 UTC is 20 hours away (next day)
      const localTime = Date.now()
      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime: localTime,
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      const seconds = svc.secondsUntilDailyReset(6)
      expect(seconds).toBe(20 * 60 * 60)
    })
  })

  describe('getDayKey', () => {
    it('returns YYYY-MM-DD for current server day', () => {
      const svc = createServerTimeService()
      expect(svc.getDayKey()).toBe('2026-02-27')
    })

    it('adjusts for timezone offset', () => {
      // 10:00 UTC + 15h offset = next day
      const svc = createServerTimeService()
      expect(svc.getDayKey(15)).toBe('2026-02-28')
    })

    it('uses server offset in day calculation', async () => {
      // Set server 15 hours ahead → pushes to next day
      const localTime = Date.now()
      vi.mocked(RundotAPI.requestTimeAsync).mockResolvedValue({
        serverTime: localTime + 15 * 60 * 60 * 1000,
        localTime,
        timezoneOffset: 0,
        formattedTime: '',
        locale: 'en-US',
      })

      const svc = createServerTimeService()
      await svc.sync()

      expect(svc.getDayKey()).toBe('2026-02-28')
    })
  })

  describe('getDebugDiagnostics', () => {
    it('captures sync timestamps and error state', async () => {
      vi.mocked(RundotAPI.requestTimeAsync).mockRejectedValue(new Error('offline'))

      const svc = createServerTimeService()
      await svc.sync()

      expect(svc.getDebugDiagnostics()).toEqual({
        synced: false,
        offsetMs: 0,
        now: Date.now(),
        dayKeyUtc: '2026-02-27',
        lastSyncAt: expect.any(Number),
        lastSyncError: 'requestTimeAsync failed',
      })
    })
  })
})
