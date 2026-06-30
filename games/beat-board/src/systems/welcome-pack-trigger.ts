/**
 * welcome-pack-trigger — One-time icebreaker offer detection for the first
 * lifetime mp4 recording in the player's first session.
 *
 * Issue beat-board-23-welcome-pack-offer owns this file.
 *
 * PRD references:
 *   - § Mechanics Detail § Welcome Pack icebreaker — triggers after the first
 *     mp4 recording in the first session, banner above share actions in
 *     RecordingReview, one-time-only via appStorage `welcomePack.offerShownAt`.
 *   - § Custom Systems Required § Welcome Pack Offer Trigger — detection
 *     orchestration crossing Mixes / RecordingReview / appStorage.
 *
 * The system tracks `recordingsThisSession` in-memory (resets on a fresh app
 * boot — by design, since "first session" means the very first opening of the
 * app) and reads/writes the once-only marker through `data/storage-service`'s
 * appStorage scope. The marker key is `beatboard_welcome_pack` per the issue's
 * acceptance criterion `(c)`.
 *
 * `shouldShow()` is a pure read — it never mutates state. `markShown()`
 * writes the timestamp to appStorage and is idempotent: subsequent calls do
 * not overwrite an existing marker so the lifetime window stays anchored to
 * the first display.
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useMixesStore } from '../stores/mixesStore'
import { getServerNow } from '../rundot/init'

// ── Constants ────────────────────────────────────────────────────────────

/**
 * appStorage key for the once-per-lifetime offer-shown marker. Matches the
 * issue acceptance criterion `(c)` `data/storage-service` key
 * `beatboard_welcome_pack`. Stored value is the `serverNow()` timestamp at
 * which the offer first rendered (or was dismissed) in milliseconds.
 */
export const WELCOME_PACK_STORAGE_KEY = 'beatboard_welcome_pack'

// ── Types ────────────────────────────────────────────────────────────────

export interface WelcomePackOfferShownRecord {
  /** Server-now timestamp (ms) at which the offer was shown / dismissed. */
  offerShownAt: number
}

export interface WelcomePackTrigger {
  /** Increment the in-memory session counter. Called by recording-capture on success. */
  noteRecordingCompleted: () => void
  /**
   * True only when ALL of:
   *   (a) `mixesStore.mixes.length === 1` — first lifetime mix just saved
   *   (b) `recordingsThisSession >= 1` — current session already produced ≥1 mp4
   *   (c) `welcomePack.offerShownAt` is unset in appStorage
   *
   * Async because (c) round-trips through `RundotAPI.appStorage.getItem`.
   */
  shouldShow: () => Promise<boolean>
  /**
   * Persist the offer-shown marker so the offer never reappears. Idempotent:
   * if a marker already exists, the existing timestamp is preserved.
   */
  markShown: () => Promise<void>
  /** Read the persisted marker, or `null` when never shown. */
  getOfferShownAt: () => Promise<number | null>
  /**
   * Clear the marker — debug/test only. Used by `debug-api.welcomePack.reset()`
   * so e2e specs can re-enter the icebreaker state between cases.
   */
  reset: () => Promise<void>
  /** Current in-memory session counter. */
  recordingsThisSession: () => number
}

// ── Module-local state ────────────────────────────────────────────────────

let recordingsThisSessionCount = 0

// ── Helpers ──────────────────────────────────────────────────────────────

async function readMarker(): Promise<number | null> {
  try {
    const raw = await RundotAPI.appStorage.getItem(WELCOME_PACK_STORAGE_KEY)
    if (raw === null || raw === undefined) return null
    if (typeof raw !== 'string' || raw.length === 0) return null
    // The persisted value is a JSON record `{ offerShownAt: ms }`; we also
    // accept a plain number string for forward compatibility with simpler
    // writers (debug-api manual seeds).
    try {
      const parsed = JSON.parse(raw) as Partial<WelcomePackOfferShownRecord>
      if (typeof parsed?.offerShownAt === 'number' && Number.isFinite(parsed.offerShownAt)) {
        return parsed.offerShownAt
      }
    } catch {
      // Not JSON — fall through to numeric parse.
    }
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch (err) {
    RundotAPI.error('welcomePackTrigger.readMarker failed', { err: String(err) })
    return null
  }
}

async function writeMarker(timestampMs: number): Promise<void> {
  try {
    const record: WelcomePackOfferShownRecord = { offerShownAt: timestampMs }
    await RundotAPI.appStorage.setItem(WELCOME_PACK_STORAGE_KEY, JSON.stringify(record))
  } catch (err) {
    RundotAPI.error('welcomePackTrigger.writeMarker failed', { err: String(err) })
  }
}

async function clearMarker(): Promise<void> {
  try {
    await RundotAPI.appStorage.removeItem(WELCOME_PACK_STORAGE_KEY)
  } catch (err) {
    RundotAPI.error('welcomePackTrigger.clearMarker failed', { err: String(err) })
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const welcomePackTrigger: WelcomePackTrigger = {
  noteRecordingCompleted(): void {
    recordingsThisSessionCount += 1
  },

  async shouldShow(): Promise<boolean> {
    const mixes = useMixesStore.getState().mixes
    // (a) first lifetime mix just saved
    if (mixes.length !== 1) return false
    // (b) at least one recording in the current session
    if (recordingsThisSessionCount < 1) return false
    // (c) offer marker is unset
    const marker = await readMarker()
    return marker === null
  },

  async markShown(): Promise<void> {
    const existing = await readMarker()
    if (existing !== null) {
      // Idempotent — preserve the original lifetime timestamp.
      return
    }
    await writeMarker(getServerNow())
  },

  async getOfferShownAt(): Promise<number | null> {
    return readMarker()
  },

  async reset(): Promise<void> {
    recordingsThisSessionCount = 0
    await clearMarker()
  },

  recordingsThisSession(): number {
    return recordingsThisSessionCount
  },
}

// ── Test helpers ──────────────────────────────────────────────────────────

/**
 * Internal: drop the in-memory session counter without touching appStorage.
 * Used by vitest specs to isolate cases without round-tripping through the
 * SDK mock's `removeItem`.
 */
export function __resetWelcomePackSessionCounter(): void {
  recordingsThisSessionCount = 0
}

/**
 * Internal: fully wipe both the in-memory counter and the persisted marker.
 * The exported `reset()` wraps this so production callers (debug API) hit
 * one entry point.
 */
export async function __resetWelcomePackTrigger(): Promise<void> {
  recordingsThisSessionCount = 0
  await clearMarker()
}
