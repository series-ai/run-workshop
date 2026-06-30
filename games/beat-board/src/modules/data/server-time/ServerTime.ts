/**
 * Server Time
 *
 * Server time synchronization using RundotAPI.requestTimeAsync().
 * Stores the clock offset and provides adjusted timestamps,
 * daily-reset scheduling, and day-key formatting.
 *
 * Source:
 *   venus-content/H5/daily-word-challenge/script.js
 *   venus-content/H5/zen-word-search/src/venus-api/systems/time.js
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Types ─────────────────────────────────────────────────────────────────

export interface ServerTimeService {
  /** Fetch server time and compute offset. Offset stays 0 if sync fails. */
  sync(): Promise<void>
  /** Adjusted timestamp: Date.now() + offset */
  now(): number
  /** Raw offset value in ms (server - local) */
  getOffset(): number
  /** True after a successful sync() */
  isSynced(): boolean
  /** Seconds until the next daily reset at the given UTC hour (default 0 = midnight) */
  secondsUntilDailyReset(resetHourUtc?: number): number
  /** YYYY-MM-DD key for the current server day */
  getDayKey(tzOffsetHours?: number): string
  /** Serializable diagnostics for support/debug tooling */
  getDebugDiagnostics(): {
    synced: boolean
    offsetMs: number
    now: number
    dayKeyUtc: string
    lastSyncAt: number | null
    lastSyncError: string | null
  }
}

// ── Service ───────────────────────────────────────────────────────────────

export function createServerTimeService(): ServerTimeService {
  let offset = 0
  let synced = false
  let lastSyncAt: number | null = null
  let lastSyncError: string | null = null

  return {
    async sync(): Promise<void> {
      try {
        const result = await RundotAPI['requestTimeAsync']()
        offset = result.serverTime - result.localTime
        synced = true
        lastSyncAt = Date.now()
        lastSyncError = null
      } catch {
        // sync failed — keep offset at 0
        lastSyncAt = Date.now()
        lastSyncError = 'requestTimeAsync failed'
      }
    },

    now(): number {
      return Date.now() + offset
    },

    getOffset(): number {
      return offset
    },

    isSynced(): boolean {
      return synced
    },

    secondsUntilDailyReset(resetHourUtc = 0): number {
      const nowMs = Date.now() + offset
      const now = new Date(nowMs)
      const resetToday = new Date(now)
      resetToday.setUTCHours(resetHourUtc, 0, 0, 0)

      let resetMs = resetToday.getTime()
      if (resetMs <= nowMs) {
        resetMs += 24 * 60 * 60 * 1000
      }
      return Math.ceil((resetMs - nowMs) / 1000)
    },

    getDayKey(tzOffsetHours = 0): string {
      const nowMs = Date.now() + offset + tzOffsetHours * 60 * 60 * 1000
      const d = new Date(nowMs)
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },

    getDebugDiagnostics() {
      return {
        synced,
        offsetMs: offset,
        now: Date.now() + offset,
        dayKeyUtc: this.getDayKey(),
        lastSyncAt,
        lastSyncError,
      }
    },
  }
}
