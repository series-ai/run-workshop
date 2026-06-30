/**
 * Share Service Adapter — BeatBoard's wrapper around the installed
 * `data/share-service` module.
 *
 * Sessions-based: the share payload carries the entire `MixSession`
 * timeline (a few KB of JSON, well under the SDK's ~100 KB shareParams
 * cap). Recipients reconstitute the mix through `MixLibrary.importShared()`
 * and replay it through the live audio engine — no audio bytes cross the wire.
 *
 * Responsibilities:
 *   1. Build the share metadata (title, description, imageUrl) for the
 *      social-card preview.
 *   2. Pack the session into `shareParams` and call `shareLinkAsync`.
 *   3. Receive incoming share links: parse the session and import it
 *      into `MixLibrary` so the recipient sees a saved mix on Mixes.
 *   4. Fire `recording_shared` analytics on share success.
 *   5. Surface a `simulateIncoming(payload)` debug hook for e2e tests.
 *
 * The adapter never touches `RundotAPI.social.*` directly — every SDK
 * call routes through `createShareService()` which is the single SDK
 * boundary.
 */

import {
  createShareService,
  type ShareParams,
} from '@modules/data/share-service/ShareService'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import {
  MIX_SESSION_VERSION,
  type MixSession,
  getMixLibrary,
} from './mixes'
import { importSharedMix } from '../stores/mixesStore'
import { useNavigationStore } from '../stores/navigationStore'

// ── Public types ──────────────────────────────────────────────────────────

/**
 * Wire format embedded in `shareParams`. The session JSON is encoded as
 * a single string field so the SDK's `Record<string, string>` shape is
 * preserved.
 */
export interface SharePayload {
  /** Session id of the source mix (kept for analytics + dedupe). */
  sourceMixId: string
  /** Source kit id. The recipient needs the kit to replay correctly. */
  kitId: string
  /** JSON.stringify(session). Must round-trip back to a `MixSession`. */
  sessionJson: string
  /** Schema version string. Recipients reject mismatches. */
  v: string
}

export interface ShareMixResult {
  url: string
  payload: SharePayload
  copiedToClipboard: boolean
}

export interface ShareServiceAdapter {
  shareMix(mixId: string): Promise<ShareMixResult>
  handleIncomingShare(payload: SharePayload): Promise<void>
  hasIncomingShare(): Promise<boolean>
  consumeIncomingShare(): Promise<SharePayload | null>
}

// ── Constants ─────────────────────────────────────────────────────────────

/** Hard cap from the SDK — shareParams must stay under this. */
const SHARE_PARAMS_MAX_BYTES = 90_000

// ── Internal state ────────────────────────────────────────────────────────

interface LastShareEvent {
  mixId: string
  url: string
  payload: SharePayload
}

let lastShareEvent: LastShareEvent | null = null

export function __resetShareAdapterState(): void {
  lastShareEvent = null
}

export function __getLastShareEvent(): LastShareEvent | null {
  return lastShareEvent
}

// ── Helpers ───────────────────────────────────────────────────────────────

function payloadToParams(payload: SharePayload): ShareParams {
  return {
    sourceMixId: payload.sourceMixId,
    kitId: payload.kitId,
    sessionJson: payload.sessionJson,
    v: payload.v,
  }
}

function parsePayload(params: ShareParams | null): SharePayload | null {
  if (!params) return null
  const { sourceMixId, kitId, sessionJson, v } = params
  if (typeof sourceMixId !== 'string' || sourceMixId.length === 0) return null
  if (typeof kitId !== 'string' || kitId.length === 0) return null
  if (typeof sessionJson !== 'string' || sessionJson.length === 0) return null
  if (typeof v !== 'string' || v.length === 0) return null
  return { sourceMixId, kitId, sessionJson, v }
}

function tryParseSession(json: string): MixSession | null {
  try {
    const parsed = JSON.parse(json) as MixSession
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.events)) return null
    if (parsed.version !== MIX_SESSION_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

// ── Adapter factory ───────────────────────────────────────────────────────

export interface ShareServiceAdapterConfig {
  shareService?: ReturnType<typeof createShareService>
}

export function createShareServiceAdapter(
  config?: ShareServiceAdapterConfig,
): ShareServiceAdapter {
  const shareService = config?.shareService ?? createShareService()

  return {
    async shareMix(mixId) {
      const session = getMixLibrary().getSession(mixId)
      if (!session) {
        throw new Error(`[share-service-adapter] unknown mixId "${mixId}"`)
      }

      const sessionJson = JSON.stringify(session)
      if (sessionJson.length > SHARE_PARAMS_MAX_BYTES) {
        throw new Error(
          `[share-service-adapter] session too large to share (${sessionJson.length} bytes > ${SHARE_PARAMS_MAX_BYTES})`,
        )
      }

      const payload: SharePayload = {
        sourceMixId: mixId,
        kitId: session.kitId,
        sessionJson,
        v: String(MIX_SESSION_VERSION),
      }
      // Keep the AppsFlyer OneLink request minimal. The mix itself travels in
      // shareParams; rich preview metadata is optional and has caused prod
      // share-link 500s when platform validation rejects a field.
      const result = await shareService.shareLinkWithDesktopFallback(payloadToParams(payload))

      analyticsModule.track('recording_shared', {
        mix_id: mixId,
        share_target: 'system_sheet',
        bytes: sessionJson.length,
      })

      lastShareEvent = { mixId, url: result.shareUrl, payload }
      return { url: result.shareUrl, payload, copiedToClipboard: result.copiedToClipboard }
    },

    async handleIncomingShare(payload) {
      const session = tryParseSession(payload.sessionJson)
      if (!session) {
        useNavigationStore.getState().handleDeepLink({
          kind: 'share_link_received',
          mixId: payload.sourceMixId,
        })
        return
      }
      const library = getMixLibrary()
      if (!library.isHydrated()) {
        await library.hydrate()
      }
      const imported = await importSharedMix({
        sourceMixId: payload.sourceMixId,
        title: session.title || 'Shared mix',
        session,
      })
      useNavigationStore.getState().handleDeepLink({
        kind: 'share_link_received',
        mixId: imported.id,
      })
    },

    async hasIncomingShare() {
      return parsePayload(await shareService.getIncomingShareParams()) !== null
    },

    async consumeIncomingShare() {
      const payload = parsePayload(await shareService.getIncomingShareParams())
      if (!payload) return null
      await this.handleIncomingShare(payload)
      return payload
    },
  }
}

// ── Singleton + debug-api hook ────────────────────────────────────────────

let singletonAdapter: ShareServiceAdapter | null = null

export function getShareServiceAdapter(): ShareServiceAdapter {
  if (!singletonAdapter) {
    singletonAdapter = createShareServiceAdapter()
  }
  return singletonAdapter
}

export function __resetShareServiceAdapterSingleton(): void {
  singletonAdapter = null
}
