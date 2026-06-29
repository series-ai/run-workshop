/**
 * Pure formatters for mix UI rows. No React, no store dependency — easy
 * to unit-test in isolation.
 */

/** Format a duration in seconds as "M:SS" (e.g. 23 → "0:23"). */
export function formatDurationLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format a relative timestamp anchored to `nowMs`. Returns:
 *  - "Just now" within 60s
 *  - "X min ago" within 60min
 *  - "X hr ago" within 24hr
 *  - locale date string beyond that
 *
 * `nowMs` is a parameter so tests can pin time without faking globals.
 */
export function formatRelativeTimestamp(createdAtMs: number, nowMs: number): string {
  const ageMs = Math.max(0, nowMs - createdAtMs)
  if (ageMs < 60_000) return 'Just now'
  if (ageMs < 3_600_000) {
    const m = Math.floor(ageMs / 60_000)
    return `${m} min ago`
  }
  if (ageMs < 86_400_000) {
    const h = Math.floor(ageMs / 3_600_000)
    return `${h} hr ago`
  }
  return new Date(createdAtMs).toLocaleDateString()
}

// `mediaElementForMime` lived here when mixes were mp4 blobs. The
// session-based replay uses the live audio engine, so no media element
// selection is needed.
