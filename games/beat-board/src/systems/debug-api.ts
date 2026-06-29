/**
 * BeatBoard debug API surface — `window.__GAME_DEBUG__.beatboard`.
 *
 * Issue beat-board-02-rundot-sdk-integrator owns this file. The baseline
 * `window.__GAME_DEBUG__` namespace (console, ui, tuning) is owned by the
 * scaffold's `src/dev/DebugApi.ts`; this module attaches the BeatBoard-
 * specific sub-namespaces required by smoke tests, FTUE bypass keys, and
 * SDK-mocked harnesses.
 *
 * Every namespace exposes a `reset()` method per the integrator contract so
 * Playwright can wipe state between specs. Methods that depend on a feature
 * shipped in a later issue throw `NotYetImplemented` rather than returning
 * fake data — this keeps the contract honest while still letting the e2e
 * harness assert the namespace shape on day one.
 *
 * See `.project/debug-console.md` and `.project/issues/beat-board-02-*` for
 * the full namespace catalogue.
 */

import { useKitsStore, resetKitsStore } from '../stores/kitsStore'
import { useMixesStore } from '../stores/mixesStore'
import { getMixLibrary } from './mixes'
import { usePadGridStore, resetPadGridStore } from '../stores/padGridStore'
import { useWalletStore } from '../stores/walletStore'
import { getBeatClock, __resetBeatClock } from '../audio/beat-clock'
import { isAudioMasterReady, disposeAudioMaster, readMasterDiagnostic } from '../audio/audio-master'
import { getPadAudioGraph, getPadAudioGraphSnapshot } from '../audio/pad-audio-graph'
import { getAudioTrace, resetAudioTrace } from '../audio/audio-trace'
import { getFxBus, getFxBusSnapshot, type FxEffect } from '../audio/fx-bus'
import { useFxStore } from '../audio/fx-state'
import type { PadBank, PadBlockId } from '../types/kit'
import {
  getShareServiceAdapter,
  __getLastShareEvent,
  __resetShareAdapterState,
} from './share-service-adapter'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  setPlatformEntitlementSyncForDebug,
  PACK_TRIAL_PREFIX,
  TRIAL_TTL_SECONDS,
} from '../stores/entitlementsStore'
import {
  getPackTrialTtlManager,
  __resetPackTrialTtlManager,
} from './pack-trial-ttl'
import {
  useSubscriptionStore,
  resetSubscriptionStore,
} from '../stores/subscriptionStore'
import {
  rewardedPlacements,
  __resetRewardedPlacements,
} from './rewarded-placements'
import {
  getRecordingCapture,
  __resetRecordingCapture,
} from './recording-capture'
import {
  iapPurchaseFlowAdapter,
  type PurchaseInput,
  type PurchaseResult,
} from './iap-purchase-flow-adapter'
import { useRecordingStore, resetRecordingStore } from '../stores/recordingStore'
import {
  useFtueStore,
  resetFtueAdapterPreservingListeners,
} from './ftue-adapter'
import { BEATBOARD_FTUE_STORAGE_KEY } from './ftue-config'
import {
  getDailyLoginBanner,
  __resetDailyLoginBanner,
} from './daily-login-banner'
import {
  welcomePackTrigger,
  __resetWelcomePackTrigger,
} from './welcome-pack-trigger'
import {
  getNotificationScheduler,
  __resetNotificationScheduler,
} from './notification-scheduler'
import type { PlatformTier } from '../modules/monetization/subscription-vip/types'
import { subscriptionStore as vipStore } from '../modules/monetization/subscription-vip/SubscriptionVip'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Namespace shapes ──────────────────────────────────────────────────────

export interface BeatBoardDebugWalletApi {
  getBalance: () => number
  setBalance: (balance: number) => void
  reset: () => void
}

export interface BeatBoardDebugKitsApi {
  list: () => Array<{ id: string; ownership: string; tier: string; name: string }>
  getActiveKitId: () => string
  setActiveKit: (kitId: string) => void
  setOwnership: (kitId: string, ownership: 'free' | 'owned' | 'trial' | 'paid', priceRunbucks?: number) => void
  purchasePack: (input: PurchaseInput) => Promise<PurchaseResult>
  reset: () => void
}

export interface BeatBoardDebugPadGridApi {
  getActivePadIds: () => string[]
  /**
   * Tap a looping pad — per-block lockout + bar-aligned crossfade. The
   * queued variant lights up with the circular sweep ring and takes over
   * at the next bar boundary.
   */
  tapLoop: (padId: string) => void
  /**
   * Fire a one-shot. Re-tap restarts. Per-block lockout retires any
   * currently-firing one-shot in the same block.
   */
  tapOneShot: (padId: string) => void
  /**
   * Snapshot of pad-grid state. `mutedPadIds` is preserved as an
   * always-empty array for back-compat with Playwright harnesses written
   * before mute was removed end-to-end (Groovepad alignment); new harnesses
   * should ignore it.
   */
  snapshot: () => {
    activePadIds: string[]
    mutedPadIds: string[]
    mode: 'idle' | 'recording' | 'replay'
    allMuted: boolean
  }
  reset: () => void
}

export interface BeatBoardDebugMixesApi {
  list: () => Array<{ id: string; title: string; isUnviewed: boolean }>
  getUnviewedCount: () => number
  markAllViewed: () => void
  reset: () => void
}

export interface BeatBoardDebugEntitlementsApi {
  list: () => Array<{ itemId: string; quantity: number; expiresAt: number | null }>
  /**
   * Grant a 24h pack trial entitlement (`pack_trial_<packId>`). Used by the
   * rewarded-ad smoke test to land in the trial state without watching a
   * real ad.
   */
  grantTrial: (packId: string) => void
  /** Revoke any entitlement by raw item id. Fires `entitlement_consumed`. */
  revoke: (itemId: string) => void
  /**
   * Force the named entitlement to expire immediately by setting its
   * `expiresAt` into the past, then ticking the TTL manager. Drives the
   * trial-expiring → trial-expired path end-to-end in tests.
   */
  expireNow: (itemId: string) => void
  reset: () => void
}

export interface BeatBoardDebugSubscriptionApi {
  isSubscribed: (tier?: string) => boolean
  /**
   * Force the BeatBoard subscription tier locally so e2e specs can land in
   * a CORE/PLUS state without round-tripping through the platform IAP flow.
   * Pass `'free'` (or `null`) to clear the subscription.
   */
  simulateTier: (tier: 'free' | 'CORE' | 'PLUS' | null) => void
  /**
   * Run the daily-login-banner claim flow directly. Returns the
   * Runbucks amount granted (0 when already claimed today or non-subscriber).
   */
  claimDailyLogin: () => Promise<number>
  /**
   * Simulate a subscription renewal cycle: clears today's claimed flag in
   * appStorage so the banner re-shows on the next visibility check, then
   * re-syncs the platform tier. Used by retention-loop e2e specs.
   */
  simulateRenewal: () => Promise<void>
  reset: () => void
}

export interface BeatBoardDebugFtueApi {
  isActive: () => boolean
  /**
   * Initialise + start the FTUE engine on the kit screen ('play'). Mirrors
   * the main.tsx bootstrap so smoke specs can re-anchor after a reset
   * without having to reload the page.
   */
  start: () => Promise<void>
  skip: () => void
  /**
   * Mark the core-loop FTUE complete and persist to `beatboard_ftue`
   * appStorage. Used by smoke specs after the mandatory UI-first FTUE
   * proof has already passed.
   */
  complete: () => Promise<void>
  /** Per-feature tutorial bypass keys per prd.md § FTUE Specification. */
  feature: {
    mutePad: { complete: () => void }
    packDrawer: { complete: () => void }
  }
  reset: () => Promise<void>
}

export interface BeatBoardDebugRewardedAdApi {
  /** Whether a rewarded ad is currently considered ready by the harness. */
  isReady: () => boolean
  /** Last placement that requested a rewarded ad. `null` until requested. */
  getLastPlacement: () => string | null
  /**
   * Force `rewardedPlacements.canShow(...)` to return false (or true) without
   * waiting on the SDK readiness probe. Owned by issue 14.
   */
  simulateReady: (ready: boolean | null) => void
  /**
   * Bypass the SDK and grant a 24h `pack_trial_<packId>` entitlement,
   * incrementing the daily counter as if a reward had been delivered. Owned
   * by issue 14.
   */
  simulateReward: (packId: string) => void
  /** Number of rewarded ads watched in the current server day. Owned by issue 14. */
  dailyCount: () => number
  reset: () => void
}

export interface BeatBoardDebugWelcomePackApi {
  isOfferShown: () => boolean
  isPurchased: () => boolean
  /**
   * Force the welcome-pack offer-shown marker into appStorage so e2e specs
   * can reach the post-icebreaker state without driving a real recording
   * end-to-end. Owned by issue beat-board-23.
   */
  markShown: () => Promise<void>
  /**
   * Get the persisted offer-shown timestamp, or `null` when the offer has
   * never been shown. Owned by issue beat-board-23.
   */
  getOfferShownAt: () => Promise<number | null>
  /**
   * Increment the in-memory `recordingsThisSession` counter so smoke tests
   * can satisfy the gate without driving the recording-capture pipeline.
   * Owned by issue beat-board-23.
   */
  noteRecordingCompleted: () => void
  /**
   * Reads `welcome-pack-trigger.shouldShow()` so e2e specs can probe the
   * full gating logic deterministically. Owned by issue beat-board-23.
   */
  shouldShow: () => Promise<boolean>
  reset: () => Promise<void>
}

export interface BeatBoardDebugRecordingApi {
  isRecording: () => boolean
  getCurrentMode: () => 'idle' | 'recording' | 'replay'
  /**
   * Recording capture status — `'idle'|'pending-bar'|'capturing'|'completing'|'error'`.
   * Owned by issue beat-board-17-recording-capture-system.
   */
  getStatus: () => 'idle' | 'pending-bar' | 'capturing' | 'completing' | 'error'
  /**
   * Begin a new 8-bar recording via the real recording-capture system.
   * Owned by issue beat-board-17-recording-capture-system.
   */
  start: () => Promise<void>
  /**
   * Stop the current capture and finalise it (writes pendingSession,
   * opens RecordingReview). Used by smoke specs that drive recording
   * through the debug API instead of waiting on the FTUE Record CTA.
   */
  stop: () => void
  /** Abort the in-flight capture. Owned by issue beat-board-17. */
  cancel: () => void
  /**
   * Force a media-recorder-error code path for browser-verify probes.
   * Owned by issue beat-board-17.
   */
  simulateError: () => void
  reset: () => void
}

export interface BeatBoardDebugNotificationsApi {
  /**
   * Currently-scheduled notifications. Returns the `id` and a `type`
   * derived from the id (`idle_after_first_record` → `idle`,
   * `pack_trial_expiring.<packId>` → `trial_expiring`). Owned by
   * issue beat-board-26.
   */
  list: () => Promise<Array<{ id: string; type: string }>>
  /**
   * Drive the same path as a real `data/app-lifecycle.onBackground`
   * event — schedules `idle_after_first_record` if the player has
   * recorded ≥1 mix. Owned by issue beat-board-26.
   */
  simulateBackground: () => void
  /**
   * Drive the same path as a real `data/app-lifecycle.onForeground`
   * event — cancels the idle reminder and sweeps tracked trial
   * notifications whose entitlements have expired. Owned by issue
   * beat-board-26.
   */
  simulateForeground: () => void
  /**
   * Schedule the idle reminder with `delaySeconds = 0` so the OS
   * delivers it immediately. Used by smoke specs to drive the deep
   * link without waiting 24h. Owned by issue beat-board-26.
   */
  fireIdleReminderNow: () => void
  reset: () => void
}

export interface BeatBoardDebugShareApi {
  getLastShareUrl: () => string | null
  /**
   * Simulate an incoming share-link payload. The session JSON must
   * round-trip back to a `MixSession`; the share-service-adapter
   * imports it through `MixLibrary.save`. The recipient sees a real
   * saved mix on Mixes once the call resolves.
   */
  simulateIncoming: (payload: {
    sourceMixId: string
    kitId: string
    sessionJson: string
    v: string
  }) => Promise<void>
  reset: () => void
}

export interface BeatBoardDebugFxApi {
  /** Set the active FX tab (filter / flanger / reverb / delay). */
  setActiveEffect: (effect: FxEffect) => void
  /** Set the XY-pad axes [0..1]. Clamped before forwarded to the bus. */
  setParams: (x: number, y: number) => void
  /** Snapshot of FX state — store + bus. */
  snapshot: () => {
    activeEffect: FxEffect
    x: number
    y: number
    busConnections: number
  }
  /**
   * Toggle the FX-bypass flag for a (category, side) — the flanking
   * FX-toggle column on the pad grid. Forwards to the padGridStore action
   * which is observed by `fx-bypass-wiring` and routed to per-pad wet
   * sends. Owned by Phase 3 of the Groovepad alignment plan.
   */
  toggleBypass: (bank: PadBank, blockId: PadBlockId) => void
  reset: () => void
}

export interface BeatBoardDebugAudioApi {
  /** Whether the master Web Audio graph has been initialised. */
  isMasterReady: () => boolean
  /** Per-pad audio graph snapshot (registered buffers, sources, gain). */
  graphSnapshot: () => {
    contextState: string | null
    registeredPads: number
    pads: Array<{ padId: string; hasBuffer: boolean; hasSource: boolean; gainValue: number }>
  }
  /** Recent audio-chain trace events. Tail of in-memory ring buffer. */
  trace: () => Array<{ ts: number; tag: string; detail?: unknown }>
  /** Clear the audio trace ring buffer. */
  traceReset: () => void
  /**
   * One-shot diagnostic — logs every relevant audio-chain piece of state
   * to the console and returns a structured report. Use when audio isn't
   * audible to figure out where the chain is breaking.
   */
  diagnose: () => unknown
  /** Current sequencer BPM. */
  getBpm: () => number
  /** Hot-swap BPM (clamped to [40, 240]). */
  setBpm: (bpm: number) => void
  /** Bar duration in seconds at the current BPM. */
  getSecondsPerBar: () => number
  /** Whether the beat sequencer is currently advancing. */
  isClockActive: () => boolean
  /** Start the beat clock. */
  startClock: () => void
  /** Stop the beat clock. */
  stopClock: () => void
  /**
   * Reset both the master audio graph and the beat clock to their fresh
   * pre-init states. Used between e2e specs to guarantee isolation.
   */
  reset: () => void
}

export interface BeatBoardDebugApi {
  wallet: BeatBoardDebugWalletApi
  kits: BeatBoardDebugKitsApi
  padGrid: BeatBoardDebugPadGridApi
  mixes: BeatBoardDebugMixesApi
  entitlements: BeatBoardDebugEntitlementsApi
  subscription: BeatBoardDebugSubscriptionApi
  ftue: BeatBoardDebugFtueApi
  rewardedAd: BeatBoardDebugRewardedAdApi
  welcomePack: BeatBoardDebugWelcomePackApi
  recording: BeatBoardDebugRecordingApi
  notifications: BeatBoardDebugNotificationsApi
  share: BeatBoardDebugShareApi
  audio: BeatBoardDebugAudioApi
  fx: BeatBoardDebugFxApi
  reset: () => void
}

// ── Window typing ─────────────────────────────────────────────────────────
//
// The `beatboard` slot on `window.__GAME_DEBUG__` is declared inside
// `src/dev/DebugApi.ts` (the owner of the baseline namespace) so we don't
// collide with its declare-global statement. Here we only attach the
// `__BEATBOARD_DEBUG__` alias used by some smoke harnesses.

declare global {
  interface Window {
    __BEATBOARD_DEBUG__?: BeatBoardDebugApi
  }
}

// ── Module-local stub state (kept until owning features ship) ─────────────
//
// Everything here is intentionally stub-shaped per the issue scope:
//   "[stub namespaces]: each gets concrete methods in later issues".
// The state lives at module scope so reset() returns the same instance to a
// known-clean baseline rather than reallocating sub-objects.

interface StubState {
  rewardedAdLastPlacement: string | null
  rewardedAdReady: boolean
  welcomePackOfferShown: boolean
  welcomePackPurchased: boolean
  ftueActive: boolean
  lastShareUrl: string | null
  scheduledNotifications: Array<{ id: string; type: string }>
  entitlements: Array<{ itemId: string; quantity: number }>
  subscriptionTiers: Set<string>
}

function defaultStubState(): StubState {
  return {
    rewardedAdLastPlacement: null,
    rewardedAdReady: true,
    welcomePackOfferShown: false,
    welcomePackPurchased: false,
    ftueActive: false,
    lastShareUrl: null,
    scheduledNotifications: [],
    entitlements: [],
    subscriptionTiers: new Set<string>(),
  }
}

let stubState: StubState = defaultStubState()

/**
 * Test/feature hook — later issues replace these stub state slots with real
 * store reads. Exporting a named setter keeps that integration explicit.
 */
export function __setBeatBoardDebugStubState(partial: Partial<StubState>): void {
  stubState = { ...stubState, ...partial }
}

/** Internal: full reset for vitest cases that exercise the API. */
export function __resetBeatBoardDebugStubState(): void {
  stubState = defaultStubState()
}

// ── API construction ──────────────────────────────────────────────────────

/**
 * Fund the sandbox mock IAP wallet so debug/e2e purchase flows can afford a
 * spend. The sandbox SDK uses an in-memory mock whose own hard-currency
 * balance now gates `spendCurrency` (SDK ≥5.23) — seeding only the local
 * `walletStore` is not enough; the mock would still reject the spend.
 *
 * Debug-surface only. The production `HttpIapApi` spends against the server,
 * so this inherited field has no effect there; guarded + best-effort.
 */
function syncSandboxWalletBalance(balance: number): void {
  try {
    const iap = RundotAPI.iap as unknown as { hardCurrency?: number }
    if (typeof iap.hardCurrency === 'number') {
      iap.hardCurrency = balance
    }
  } catch (err) {
    // best-effort: sandbox-only affordance, never block the debug seed.
    RundotAPI.error('debugApi.wallet.syncSandboxWalletBalance failed', {
      err: String(err),
    })
  }
}

function buildBeatBoardDebugApi(): BeatBoardDebugApi {
  const api: BeatBoardDebugApi = {
    wallet: {
      getBalance: () => useWalletStore.getState().balance,
      setBalance: (balance: number) => {
        useWalletStore.setState({ balance })
        syncSandboxWalletBalance(balance)
      },
      reset: () => {
        useWalletStore.setState({ balance: 1280 })
        syncSandboxWalletBalance(1280)
      },
    },
    kits: {
      list: () =>
        Object.values(useKitsStore.getState().kits).map((k) => ({
          id: k.id,
          ownership: k.ownership,
          tier: k.tier,
          name: k.name,
        })),
      getActiveKitId: () => useKitsStore.getState().activeKitId,
      setActiveKit: (kitId: string) => {
        useKitsStore.getState().setActiveKit(kitId)
      },
      setOwnership: (kitId, ownership, priceRunbucks) => {
        useKitsStore.setState((state) => {
          const kit = state.kits[kitId]
          if (!kit) return state
          return {
            kits: {
              ...state.kits,
              [kitId]: {
                ...kit,
                ownership,
                priceRunbucks: priceRunbucks ?? kit.priceRunbucks,
                comingSoon: false,
              },
            },
          }
        })
      },
      purchasePack: (input) => iapPurchaseFlowAdapter.purchase(input),
      reset: () => {
        resetKitsStore()
      },
    },
    padGrid: {
      getActivePadIds: () => [...usePadGridStore.getState().activePadIds],
      tapLoop: (padId: string) => {
        usePadGridStore.getState().tapLoop(padId)
      },
      tapOneShot: (padId: string) => {
        usePadGridStore.getState().tapOneShot(padId)
      },
      snapshot: () => {
        const s = usePadGridStore.getState()
        return {
          activePadIds: [...s.activePadIds],
          latchedPadIds: [...s.latchedPadIds],
          mutedPadIds: [],
          currentBank: s.currentBank,
          mode: s.mode,
          allMuted: s.allMuted,
        }
      },
      reset: () => {
        // Restore the seeded baseline via the store-side reset helper
        // (issue 07 replaces the inline reset with the canonical action).
        resetPadGridStore()
      },
    },
    mixes: {
      list: () =>
        useMixesStore.getState().mixes.map((m) => ({
          id: m.id,
          title: m.title,
          isUnviewed: m.isUnviewed,
        })),
      getUnviewedCount: () => useMixesStore.getState().unviewedCount,
      markAllViewed: () => {
        useMixesStore.getState().markAllViewed()
      },
      reset: () => {
        // Wipe every saved mix from MixLibrary + appStorage so smoke specs
        // start from a clean library. Without this, persisted mixes from
        // earlier runs accumulate and break "expect length === 1" probes.
        const ids = useMixesStore.getState().mixes.map((m) => m.id)
        const lib = getMixLibrary()
        void Promise.allSettled(ids.map((id) => lib.delete(id)))
        useMixesStore.getState().markAllViewed()
      },
    },
    entitlements: {
      list: () =>
        Array.from(useEntitlementsStore.getState().entitlements.values()).map((e) => ({
          itemId: e.itemId,
          quantity: e.quantity,
          expiresAt: e.expiresAt,
        })),
      grantTrial: (packId: string) => {
        useEntitlementsStore.getState().grantEntitlement(`${PACK_TRIAL_PREFIX}${packId}`, {
          ttlSeconds: TRIAL_TTL_SECONDS,
          source: 'debug',
        })
      },
      revoke: (itemId: string) => {
        useEntitlementsStore.getState().revoke(itemId, 'debug')
      },
      expireNow: (itemId: string) => {
        const ent = useEntitlementsStore.getState().get(itemId)
        if (!ent) return
        // Stamp the entitlement with a past expiresAt and let the TTL
        // manager's tick run the canonical revoke-on-expiry path so any
        // listening code sees the same `trial_expired` event the production
        // tick would emit.
        useEntitlementsStore.setState((state) => {
          const next = new Map(state.entitlements)
          next.set(itemId, { ...ent, expiresAt: Date.now() - 1000 })
          return { entitlements: next }
        })
        getPackTrialTtlManager().tick()
      },
      reset: () => {
        resetEntitlementsStore()
        setPlatformEntitlementSyncForDebug(false)
        __resetPackTrialTtlManager()
      },
    },
    subscription: {
      isSubscribed: (tier?: string) => {
        // Delegate to the real subscriptionStore (issue beat-board-13).
        if (!tier) return useSubscriptionStore.getState().isActive
        return useSubscriptionStore.getState().isSubscribed(tier as PlatformTier)
      },
      simulateTier: (tier) => {
        if (tier === 'free' || tier === null) {
          useSubscriptionStore.getState().syncFromPlatform(null)
        } else {
          useSubscriptionStore.getState().syncFromPlatform(tier as PlatformTier)
        }
      },
      claimDailyLogin: async () => {
        // Debug-API contract: this helper always credits the wallet so e2e
        // specs and browser-verify can drive the daily-login flow regardless
        // of session state. We:
        //   1. Force-upgrade to CORE if the player is currently 'free' so the
        //      banner module skips its non-subscriber early-return.
        //   2. Clear today's claimed flag so a previous tap-claim from the
        //      banner does not turn this into a 0-amount no-op.
        //   3. Delegate to `daily-login-banner.claim()` which owns the local
        //      wallet credit shim (the Rundot sandbox does not simulate the
        //      server-side daily credit so the shim is the only path that
        //      visibly increases the balance).
        const subscription = useSubscriptionStore.getState()
        if (!subscription.isActive) {
          subscription.syncFromPlatform('CORE')
        }
        const today = new Date()
        const year = today.getUTCFullYear()
        const month = String(today.getUTCMonth() + 1).padStart(2, '0')
        const day = String(today.getUTCDate()).padStart(2, '0')
        const dayKey = `${year}-${month}-${day}`
        try {
          await RundotAPI.appStorage.removeItem(`beatboard.dailyLogin.claimed.${dayKey}`)
        } catch (err) {
          RundotAPI.error('debugApi.subscription.claimDailyLogin: removeItem failed', { err: String(err) })
        }
        const result = await getDailyLoginBanner().claim()
        return result.amount
      },
      simulateRenewal: async () => {
        // Clear today's claimed flag so the banner reappears, then nudge a
        // sync so any listening hooks re-evaluate.
        const today = new Date()
        const year = today.getUTCFullYear()
        const month = String(today.getUTCMonth() + 1).padStart(2, '0')
        const day = String(today.getUTCDate()).padStart(2, '0')
        const dayKey = `${year}-${month}-${day}`
        try {
          await RundotAPI.appStorage.removeItem(`beatboard.dailyLogin.claimed.${dayKey}`)
        } catch (err) {
          RundotAPI.error('debugApi.subscription.simulateRenewal: removeItem failed', { err: String(err) })
        }
        // Re-sync from the underlying VIP store to refresh the proxy fields.
        const vipTier = vipStore.getState().tier
        useSubscriptionStore.getState().syncFromPlatform(vipTier === 'none' ? null : (vipTier as PlatformTier))
      },
      reset: () => {
        resetSubscriptionStore()
        __resetDailyLoginBanner()
      },
    },
    ftue: {
      isActive: () => useFtueStore.getState().isActive,
      /**
       * Initialise + start the FTUE engine on the kit screen. Mirrors the
       * `main.tsx` bootstrap so smoke specs can re-anchor to step 1 after
       * a `ftue.reset()` without having to reload the page.
       */
      start: async () => {
        const store = useFtueStore.getState()
        if (!store.isInitialized) {
          await store.initialize()
        }
        useFtueStore.getState().startFtue('play')
      },
      skip: () => {
        useFtueStore.getState().skipAll()
      },
      complete: async () => {
        // Make sure the engine has been initialised so persistence + step
        // graph are wired before we mark every step complete.
        const store = useFtueStore.getState()
        if (!store.isInitialized) {
          await store.initialize()
        }
        // skipAll() sets currentPhase = 'skipped' which the engine treats as
        // FTUE-done (gates open, overlay never reactivates) and persists.
        useFtueStore.getState().skipAll()
      },
      feature: {
        mutePad: {
          complete: () => {
            useFtueStore.getState().markFeatureTutorialComplete('mute_pad')
          },
        },
        packDrawer: {
          complete: () => {
            useFtueStore.getState().markFeatureTutorialComplete('pack_drawer')
          },
        },
      },
      reset: async () => {
        // Wipe in-memory state SYNCHRONOUSLY before anything else, so a
        // caller that does `ftue.reset(); ftue.start()` (no await) sees
        // a freshly-reset engine on the next tick. Doing the state
        // reset AFTER an awaited removeItem would let `start()` race
        // ahead of the mutation and land on a stale store.
        //
        // Uses the listener-preserving reset because this runs in the
        // LIVE app (debug API). The React tree subscribed recordGate +
        // mixSavedToast at mount; the destructive
        // `resetFtueAdapterForTests` would orphan those subscriptions
        // and leave the record button disabled forever after the reset.
        resetFtueAdapterPreservingListeners()
        try {
          await RundotAPI.appStorage.removeItem(BEATBOARD_FTUE_STORAGE_KEY)
        } catch (err) {
          RundotAPI.error('debugApi.ftue.reset: removeItem failed', { err: String(err) })
        }
      },
    },
    rewardedAd: {
      isReady: () => stubState.rewardedAdReady,
      getLastPlacement: () => stubState.rewardedAdLastPlacement,
      simulateReady: (ready: boolean | null) => {
        rewardedPlacements.rewardedAdFlow.simulateReady(ready)
        // Mirror into the legacy stub flag so older harnesses see the change.
        if (ready === null) {
          stubState.rewardedAdReady = true
        } else {
          stubState.rewardedAdReady = ready
        }
      },
      simulateReward: (packId: string) => {
        rewardedPlacements.rewardedAdFlow.simulateReward(packId)
        stubState.rewardedAdLastPlacement = 'rewarded_pack_trial'
      },
      dailyCount: () => rewardedPlacements.rewardedAdFlow.dailyCount(),
      reset: () => {
        stubState.rewardedAdLastPlacement = null
        stubState.rewardedAdReady = true
        __resetRewardedPlacements()
      },
    },
    welcomePack: {
      isOfferShown: () => stubState.welcomePackOfferShown,
      isPurchased: () => stubState.welcomePackPurchased,
      markShown: async () => {
        await welcomePackTrigger.markShown()
        stubState.welcomePackOfferShown = true
      },
      getOfferShownAt: () => welcomePackTrigger.getOfferShownAt(),
      noteRecordingCompleted: () => {
        welcomePackTrigger.noteRecordingCompleted()
      },
      shouldShow: () => welcomePackTrigger.shouldShow(),
      reset: async () => {
        stubState.welcomePackOfferShown = false
        stubState.welcomePackPurchased = false
        await __resetWelcomePackTrigger()
      },
    },
    recording: {
      isRecording: () => useRecordingStore.getState().status === 'capturing',
      getCurrentMode: () => usePadGridStore.getState().mode,
      getStatus: () => useRecordingStore.getState().status,
      start: () => useRecordingStore.getState().start(),
      stop: () => useRecordingStore.getState().stop(),
      cancel: () => useRecordingStore.getState().cancel(),
      simulateError: () => {
        getRecordingCapture().simulateError()
      },
      reset: () => {
        // Cancel any in-flight capture, clear the singleton, and reset the
        // store back to the seeded baseline.
        try {
          getRecordingCapture().cancel()
        } catch {
          // No active run — fine to ignore.
        }
        usePadGridStore.getState().setMode('idle')
        resetRecordingStore()
        __resetRecordingCapture()
      },
    },
    notifications: {
      list: async () => {
        const scheduler = getNotificationScheduler()
        const entries = await scheduler.list()
        return entries.map((entry) => ({
          id: entry.id,
          type: entry.id.startsWith('beatboard.pack_trial_expiring')
            ? 'trial_expiring'
            : entry.id === 'beatboard.idle_after_first_record'
              ? 'idle'
              : 'unknown',
        }))
      },
      simulateBackground: () => {
        getNotificationScheduler().simulateBackground()
      },
      simulateForeground: () => {
        getNotificationScheduler().simulateForeground()
      },
      fireIdleReminderNow: () => {
        getNotificationScheduler().fireIdleReminderNow()
      },
      reset: () => {
        stubState.scheduledNotifications = []
        __resetNotificationScheduler()
      },
    },
    share: {
      getLastShareUrl: () => __getLastShareEvent()?.url ?? stubState.lastShareUrl,
      simulateIncoming: async (payload) => {
        await getShareServiceAdapter().handleIncomingShare(payload)
      },
      reset: () => {
        stubState.lastShareUrl = null
        __resetShareAdapterState()
      },
    },
    fx: {
      setActiveEffect: (effect: FxEffect) => {
        useFxStore.getState().setActiveEffect(effect)
      },
      setParams: (x: number, y: number) => {
        useFxStore.getState().setParams(x, y)
      },
      snapshot: () => {
        const snap = getFxBusSnapshot()
        const state = useFxStore.getState()
        return {
          activeEffect: state.activeEffect,
          x: state.x,
          y: state.y,
          busConnections: snap.connectedPadCount,
        }
      },
      toggleBypass: (bank: PadBank, blockId: PadBlockId) => {
        usePadGridStore.getState().toggleFxBypass(bank, blockId)
      },
      reset: () => {
        useFxStore.getState().reset()
        // Detach pad connections from the bus so the wiring sees a clean
        // surface on the next install. The fx-bus singleton lazily rebuilds
        // on the next setActiveEffect / setParams.
        try {
          getFxBus().disposeAll()
        } catch {
          // best-effort
        }
      },
    },
    audio: {
      isMasterReady: () => isAudioMasterReady(),
      graphSnapshot: () => getPadAudioGraphSnapshot(),
      trace: () => getAudioTrace(),
      traceReset: () => {
        resetAudioTrace()
      },
      diagnose: () => {
        const master = readMasterDiagnostic()
        const padGraph = getPadAudioGraphSnapshot()
        const padState = usePadGridStore.getState()
        const fxBypass = padState.fxBypass
        // Pads currently active in the store but maybe with gain=0 = candidates.
        const activeWithLowGain = (padGraph.pads ?? []).filter((p) =>
          padState.activePadIds.includes(p.padId) && p.gainValue < 0.5,
        )
        const activeWithGain = (padGraph.pads ?? []).filter((p) =>
          padState.activePadIds.includes(p.padId) && p.gainValue >= 0.5,
        )
        const trace = getAudioTrace()
        const recent = trace.slice(-50)
        const report = {
          master,
          padState: {
            activePadIds: [...padState.activePadIds],
            latchedPadIds: [...padState.latchedPadIds],
            currentBank: padState.currentBank,
            allMuted: padState.allMuted,
          },
          fxBypass,
          padGraph: {
            contextState: padGraph.contextState,
            registeredPads: padGraph.registeredPads,
            pads: padGraph.pads,
          },
          activePadsAudibleSummary: {
            withGain: activeWithGain.map((p) => p.padId),
            withLowGain: activeWithLowGain.map((p) => p.padId),
          },
          recentTraceTags: recent.map((e) => e.tag),
          // Loud, structured log for the browser console — easy to copy-paste.
          help:
            'Audio diagnose — paste this whole object into chat. Key fields:\n' +
            ' • master.contextState=running and master.computedMasterGain>0 means context is unlocked.\n' +
            ' • activePadsAudibleSummary.withGain should list the pad you tapped (gain≥0.5).\n' +
            ' • master.rmsEnergy > 0.001 ≈ audio is reaching the destination.\n' +
            ' • fxBypass[bank][blockId]=true means that block routes wet through FX bus too.',
        }
        RundotAPI.log('[audio-diagnose]', report)
        return report
      },
      getBpm: () => getBeatClock().getBpm(),
      setBpm: (bpm: number) => {
        getBeatClock().setBpm(bpm)
      },
      getSecondsPerBar: () => getBeatClock().secondsPerBar(),
      isClockActive: () => getBeatClock().isActive(),
      startClock: () => {
        getBeatClock().start()
      },
      stopClock: () => {
        getBeatClock().stop()
      },
      reset: () => {
        getPadAudioGraph().disposeAll()
        if (isAudioMasterReady()) {
          disposeAudioMaster()
        }
        __resetBeatClock()
      },
    },
    reset: () => {
      api.wallet.reset()
      api.kits.reset()
      api.padGrid.reset()
      api.mixes.reset()
      api.entitlements.reset()
      api.subscription.reset()
      api.ftue.reset()
      api.rewardedAd.reset()
      // welcomePack.reset() is async (clears appStorage marker); fire-and-forget
      // is acceptable here because the master reset() itself is documented as
      // sync best-effort cleanup for between-spec hygiene.
      void api.welcomePack.reset()
      api.recording.reset()
      api.notifications.reset()
      api.share.reset()
      api.audio.reset()
      api.fx.reset()
    },
  }
  return api
}

// ── Install hook ──────────────────────────────────────────────────────────

let installed = false

/**
 * Install the BeatBoard debug namespace onto `window.__GAME_DEBUG__.beatboard`.
 * Idempotent: subsequent calls reuse the existing namespace so HMR-triggered
 * App.tsx re-runs do not blow away test state.
 *
 * Must run AFTER `installDebugApi()` from `src/dev/DebugApi.ts` so the
 * baseline namespace already exists.
 */
export function installBeatBoardDebugApi(): BeatBoardDebugApi {
  if (typeof window === 'undefined') {
    // SSR / vitest before jsdom — return a freshly built API so callers can
    // still introspect the shape during tests.
    return buildBeatBoardDebugApi()
  }

  if (installed && window.__GAME_DEBUG__?.beatboard) {
    return window.__GAME_DEBUG__.beatboard
  }

  if (!window.__GAME_DEBUG__) {
    throw new Error(
      '[debug-api] window.__GAME_DEBUG__ is not initialised. ' +
        'Ensure src/dev/DebugApi.ts → installDebugApi() runs before installBeatBoardDebugApi().',
    )
  }

  const api = buildBeatBoardDebugApi()
  window.__GAME_DEBUG__.beatboard = api
  // Game-specific alias used by some e2e harnesses.
  window.__BEATBOARD_DEBUG__ = api
  installed = true
  return api
}

/** Internal: drop the install flag so vitest cases can re-install. */
export function __resetBeatBoardDebugInstall(): void {
  installed = false
}
