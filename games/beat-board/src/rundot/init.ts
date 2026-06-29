/**
 * Rundot init — BeatBoard's app-boot integration with the Rundot SDK.
 *
 * This module owns the post-`initializeAsync()` SDK wiring sequence:
 *   1. Sync server time so daily-reset / notification scheduling has an
 *      accurate clock offset.
 *   2. Resolve the player profile and emit `player_identity` analytics.
 *   3. Subscribe to `lifecycles.onSleep`/`onPause` to fire `session_end`
 *      analytics with `{ duration_seconds }` whenever the host backgrounds
 *      the app.
 *
 * The SDK is initialised in `src/main.tsx`. This module is invoked once
 * after `RundotAPI.initializeAsync()` resolves and before the React tree
 * mounts so analytics + server-time are ready for the first paint.
 *
 * Owners:
 *   - `src/systems/analytics.ts` — typed analytics surface
 *   - `src/modules/data/server-time/ServerTime.ts` — server time service
 */

import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { createServerTimeService, type ServerTimeService } from '@modules/data/server-time/ServerTime'
import { recordPlayerIdentity, recordSessionEnd } from '../systems/analytics'

// ── Module-local state ────────────────────────────────────────────────────

let serverTime: ServerTimeService | null = null
let sessionStartedAt: number | null = null
let lifecycleSubscriptions: Array<{ unsubscribe(): void }> = []

/**
 * Optional override for the screen reported in `session_end` analytics. The
 * navigation store updates this whenever the active screen changes; if it
 * isn't set we fall back to `'unknown'` so the event still ships.
 */
let activeScreenProvider: () => string = () => 'unknown'

// ── Public configuration ──────────────────────────────────────────────────

/**
 * Allow other modules (the navigation store, App.tsx, etc.) to provide the
 * current screen ID for `session_end` analytics without creating a circular
 * import.
 */
export function setActiveScreenProvider(provider: () => string): void {
  activeScreenProvider = provider
}

// ── Server time ───────────────────────────────────────────────────────────

/**
 * Returns the lazily-created server-time service. The first call constructs
 * the singleton; subsequent calls reuse it. Tests can call `__resetRundotInit`
 * to wipe state between cases.
 */
export function getServerTimeService(): ServerTimeService {
  if (!serverTime) {
    serverTime = createServerTimeService()
  }
  return serverTime
}

/**
 * Returns the current server-adjusted timestamp (ms since epoch). Falls back
 * to `Date.now()` until the first sync completes — callers tolerant of the
 * fallback should use this directly rather than checking `isSynced()`.
 */
export function getServerNow(): number {
  return getServerTimeService().now()
}

// ── Boot ──────────────────────────────────────────────────────────────────

export interface InitializeRundotResult {
  serverTimeSynced: boolean
  profileResolved: boolean
  isSignedIn: boolean
}

/**
 * Run the post-initializeAsync() boot sequence. Idempotent: subsequent calls
 * reuse the same lifecycle subscriptions and re-sync server time.
 */
export async function initializeRundot(): Promise<InitializeRundotResult> {
  if (sessionStartedAt === null) {
    sessionStartedAt = Date.now()
  }

  // 1. Server time sync — fire-and-forget shape but await to surface offset
  //    before notification scheduling that runs in subsequent boot stages.
  const time = getServerTimeService()
  await time.sync()

  // 2. Profile + player_identity analytics. `getProfile()` is synchronous
  //    against the cached host handshake (per .rundot-docs/api/PROFILE.md).
  let isSignedIn = false
  let profileResolved = false
  try {
    const profile = RundotAPI.getProfile()
    profileResolved = Boolean(profile)
    isSignedIn = profile ? !profile.isAnonymous : false
    recordPlayerIdentity({
      isSignedIn,
      hasProfileName: profile ? Boolean(profile.username) : false,
    })
  } catch (error) {
    RundotAPI.error('[init] getProfile failed', { error: String(error) })
  }

  // 3. Lifecycle → session_end. Subscribe once; later boots are no-ops.
  if (lifecycleSubscriptions.length === 0) {
    lifecycleSubscriptions = [
      RundotAPI.lifecycles.onSleep(() => {
        emitSessionEnd('background_sleep')
      }),
      RundotAPI.lifecycles.onPause(() => {
        emitSessionEnd('background_pause')
      }),
      RundotAPI.lifecycles.onQuit(() => {
        emitSessionEnd('quit')
      }),
    ]
  }

  return {
    serverTimeSynced: time.isSynced(),
    profileResolved,
    isSignedIn,
  }
}

/**
 * Mark a fresh "session start" timestamp. Called by `initializeRundot()` and
 * also exposed for `lifecycles.onAwake/onResume` if a downstream module wants
 * to reset the duration window after a background→foreground cycle.
 */
export function markSessionStart(): void {
  sessionStartedAt = Date.now()
}

function emitSessionEnd(trigger: string): void {
  const startedAt = sessionStartedAt ?? Date.now()
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000))
  recordSessionEnd({
    screen: safeActiveScreen(),
    trigger,
    durationSeconds,
  })
  // Reset so a background/foreground cycle reports duration since last awake.
  sessionStartedAt = Date.now()
}

function safeActiveScreen(): string {
  try {
    return activeScreenProvider() || 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────

/** Internal: wipe module state between vitest cases. */
export function __resetRundotInit(): void {
  serverTime = null
  sessionStartedAt = null
  for (const sub of lifecycleSubscriptions) {
    try {
      sub.unsubscribe()
    } catch {
      // ignore — best-effort cleanup for tests
    }
  }
  lifecycleSubscriptions = []
  activeScreenProvider = () => 'unknown'
}
