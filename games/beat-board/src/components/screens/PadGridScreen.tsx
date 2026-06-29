/**
 * PadGridScreen — primary gameplay surface (PRD § Screen: Play).
 *
 * Layout (post-2026-04-26 simplification):
 *   ┌──────────────────────────────────────────┐
 *   │            [4×4 PadCellGrid]             │  ← hero (top row removed)
 *   │                                          │
 *   ├──────────────────────────────────────────┤
 *   │  Inline FTUE hint when empty             │
 *   ├──────────────────────────────────────────┤
 *   │  [TransportBar]                          │  ← bottom rail (kit name lives here)
 *   └──────────────────────────────────────────┘
 *
 * The previous top row carried a pack-name chip (left) and a Settings gear
 * (right). Both moved out:
 *   - Settings is now a 4th bottom-nav tab (`tabConfig.tsx → settings`).
 *   - The pack name still appears on the bottom transport rail and the
 *     Packs tab in bottom-nav is the path for swapping kits — the redundant
 *     top-left chip was removed to give the grid + FX panel + transport
 *     more vertical room on a 390×844 portrait.
 *
 * Wires three stores to the visual scaffold:
 *   - kitsStore         → active kit (name, BPM, pads availability)
 *   - padGridStore      → activePadIds (drives empty/populated state)
 *   - recordingStore    → status (auto-pushes RecordingReview on 'completing')
 *
 * Local screen state owns the kit-load lifecycle (loading / ready / error)
 * because the kits store ships visual catalog metadata only — the
 * loop-kit-catalog system handles the actual decode+register flow.
 *
 * Analytics:
 *   - `screen_viewed { screen: 'play' }` once per mount (idempotent on
 *      strict-mode double-render via instance guard)
 *   - `game_opened` once per launch (module-scope guard)
 *   - `trackFunnelStep('first_pad_tap', { pack_id })` once per launch on the
 *     first lifetime pad activation
 *
 * data-skin-role coverage: pad cells use button.grid, transport uses
 * button.primary / button.icon / chip.currency / badge.counter, the empty
 * hint is ftue.callout (via Ftue.Callout). Surface uses panel.card via
 * ScreenChrome.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ScreenChrome } from '@modules/ui/skin'
import { FtueOverlay } from './FtueOverlay'
import { ResponsivePadSurface, useShouldHideBankToggle } from '../widgets/ResponsivePadSurface'
import { CollapsibleFxPanel } from '../widgets/CollapsibleFxPanel'
import { PadTopBar } from '../widgets/PadTopBar'
import { DailyLoginBanner } from '../banners/DailyLoginBanner'
import { useKitsStore, getKitById } from '../../stores/kitsStore'
import { usePadGridStore, buildDefaultQueue } from '../../stores/padGridStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { useRecordingStore } from '../../stores/recordingStore'
import { loadKit, HERO_KIT_ID } from '../../systems/loop-kit-catalog'
import { useConfirmDialogStore } from '../../modules/ui/confirmation-dialog/ConfirmationDialog'
import {
  consumePendingSession,
  installSessionPersistence,
} from '../../systems/session-persistence'
import { getPadAudioGraph } from '../../audio/pad-audio-graph'
import { getBeatClock } from '../../audio/beat-clock'
import { audioTrace } from '../../audio/audio-trace'
import { syncFxBypassWetSends } from '../../audio/fx-bypass-wiring'
// recording-capture and the kit-load triggerLoad are wired into the screen
// elsewhere — recording is now driven from PadTopBar's record button.
import {
  recordCustomEvent,
  recordGameOpened,
  recordScreenViewed,
  trackBeatBoardFunnelStep,
} from '../../systems/analytics'
import { useFtueStore } from '../../systems/ftue-adapter'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Module-scoped session flags ──────────────────────────────────────────
//
// These guards are intentionally module-scoped (per JS bundle, not per React
// instance) because the criteria are "first lifetime …" — they should fire
// at most once per app launch even if the screen unmounts and remounts.
// Tests reset these via `__resetPadGridScreenSessionState`.

let gameOpenedFired = false
let firstPadTapFired = false

/**
 * Test/debug helper — restore module-scope session flags. Used by the
 * acceptance test suite to start each scenario from a clean baseline.
 */
export function __resetPadGridScreenSessionState(): void {
  gameOpenedFired = false
  firstPadTapFired = false
}

type KitLoadStatus = 'ready' | 'loading' | 'error'

export function PadGridScreen() {
  const activeKitId = useKitsStore((s) => s.activeKitId)
  const activeKit = getKitById(activeKitId)
  const activePadIds = usePadGridStore((s) => s.activePadIds)
  // currentBank is read inside ResponsivePadSurface now.
  // navigateTo unused after PadTopBar took over the pack-chip + record buttons.
  const openModal = useNavigationStore((s) => s.openModal)
  const recordingStatus = useRecordingStore((s) => s.status)

  const hideBankToggle = useShouldHideBankToggle()

  // FTUE record-button gate is now subscribed inside `PadTopBar` (which
  // owns the record affordance). The screen no longer needs to track it.

  // ── Kit-load lifecycle (loading / ready / error) ──────────────────────
  // Declared BEFORE the FTUE bootstrap effect because that effect gates the
  // start on `loadStatus === 'ready'` so the spotlight target exists in the
  // DOM when the runner first checks for it.
  const initialStatus: KitLoadStatus =
    activeKit && activeKit.pads.length > 0 && !activeKit.invalidMetadata ? 'ready' : 'loading'
  const [loadStatus, setLoadStatus] = useState<KitLoadStatus>(initialStatus)
  const inFlightLoadRef = useRef<string | null>(null)

  // ── FTUE bootstrap ────────────────────────────────────────────────────
  // Initialise the engine on first mount and start the FTUE on the Play
  // screen. Both calls are idempotent — `initialize()` no-ops once
  // `isInitialized`, and `startFtue('play')` no-ops if FTUE has already
  // started (currentScreen mismatch or progress already persisted).
  //
  // Wiring note: the engine's condition runner subscribes to game-state
  // stores (padGrid/recording/navigation), NOT to local component state
  // like `loadStatus`. If we start the FTUE while the SkeletonGrid is
  // rendered, `[data-ftue="pad-cell-0"]` does not exist in the DOM and
  // the runner's spotlight guard hides the step (isStepHidden=true).
  // Once load completes and PadCellGrid mounts, no game-state store
  // changes, so the runner never re-evaluates and the overlay stays
  // null. Gating the start on `loadStatus === 'ready'` guarantees the
  // spotlight target exists at start time.
  const initializeFtue = useFtueStore((s) => s.initialize)
  const startFtue = useFtueStore((s) => s.startFtue)
  const showStep = useFtueStore((s) => s.showStep)
  const ftueIsInitialized = useFtueStore((s) => s.isInitialized)
  const ftueIsActive = useFtueStore((s) => s.isActive)
  const ftueCurrentPhase = useFtueStore((s) => s.currentPhase)
  useEffect(() => {
    void (async () => {
      if (!ftueIsInitialized) {
        await initializeFtue()
      }
      // Wait until the pad grid is rendered so spotlight selectors resolve.
      // If the kit is still decoding, the SkeletonGrid is in the DOM and
      // [data-ftue="pad-cell-0"] does not exist yet.
      if (loadStatus !== 'ready') return

      const ftue = useFtueStore.getState()
      const phase = ftue.currentPhase

      // Start only if no progress persisted (currentPhase still core_loop) and
      // we haven't already activated the first step.
      if (
        !ftue.isActive &&
        phase !== 'completed' &&
        phase !== 'skipped' &&
        ftue.currentStepId === null &&
        ftue.completedSteps.size === 0
      ) {
        startFtue('play')
        return
      }

      // Recovery: if the FTUE started while the grid was still loading and
      // the runner's spotlight guard hid the active step, re-show it now
      // that the spotlight target is mounted. showStep() is a no-op if the
      // step is already completed or the config is missing.
      if (
        ftue.isActive &&
        ftue.currentStepId !== null &&
        phase !== 'completed' &&
        phase !== 'skipped'
      ) {
        // Read the latest hidden flag straight from the bridge state.
        const hidden = (useFtueStore.getState() as { isStepHidden?: boolean })
          .isStepHidden
        if (hidden) {
          showStep(ftue.currentStepId)
        }
      }
    })()
  }, [
    ftueIsInitialized,
    ftueIsActive,
    ftueCurrentPhase,
    loadStatus,
    initializeFtue,
    startFtue,
    showStep,
  ])

  const triggerLoad = useCallback(
    (kitId: string, options: { skipLoadingState?: boolean } = {}) => {
      // Guard against concurrent loads for the same kit.
      if (inFlightLoadRef.current === kitId) return
      inFlightLoadRef.current = kitId
      if (!options.skipLoadingState) setLoadStatus('loading')
      audioTrace('screen:loadKit:start', { kitId, skipLoadingState: Boolean(options.skipLoadingState) })
      // Retire the previous kit's phase-locked source pool BEFORE registering
      // new buffers. This resets the kit-start clock in pad-audio-graph so
      // every pad in the new kit shares a fresh phase anchor; without it,
      // the new kit's loops would inherit the old kit's start time and
      // play out of phase with each other on slow decode.
      getPadAudioGraph().disposeAll()
      // Always reset the pad-grid UI activation state on triggerLoad.
      // activePadIds / latchedPadIds / queued / oneShotWindows are all
      // keyed to a specific kit's bank+block layout; reusing them
      // across kits would render stale "lit" cells against the new
      // kit's pads. Initial loads start from the default empty state
      // anyway, so the reset is a no-op there.
      usePadGridStore.setState({
        activePadIds: [],
        latchedPadIds: [],
        queued: buildDefaultQueue(),
        oneShotWindows: {},
      })
      // Wire the per-pad audio graph as the buffer registrar so loadKit
      // actually decodes + caches each pad's loop. Without this, the engine's
      // scheduleRamp would no-op because `pads` map stays empty.
      void loadKit(kitId, {
        register: (padId, bufferUrl) =>
          getPadAudioGraph().registerPadBuffer(padId, bufferUrl),
      })
        .then((kit) => {
          // Only apply the result if the active kit hasn't changed.
          if (inFlightLoadRef.current !== kitId) return
          inFlightLoadRef.current = null
          audioTrace('screen:loadKit:resolved', {
            kitId,
            padCount: kit.pads.length,
            invalid: kit.invalidMetadata,
          })
          if (kit.invalidMetadata || kit.pads.length === 0) {
            setLoadStatus('error')
          } else {
            // Hot-swap the beat-clock BPM to match the loaded kit. Without
            // this every kit would schedule pad swaps and render waveform
            // ticks against the lofi-default 84 BPM — so a 120 BPM kit
            // would visibly "tick" 11 cells across a 16-bar phrase.
            if (Number.isFinite(kit.bpm) && kit.bpm > 0) {
              getBeatClock().setBpm(kit.bpm)
            }
            // Push the current fxBypass state into the freshly-registered
            // pads' wet sends. installFxBypassWiring runs at app boot, BEFORE
            // pads are registered, so the auto-engage at install time never
            // lands on the audio graph without this explicit sync. Idempotent
            // and cheap (16 setValueAtTime calls).
            syncFxBypassWetSends()
            if (!options.skipLoadingState) {
              setLoadStatus('ready')
            }
          }
        })
        .catch((err: unknown) => {
          // loadKit normally returns an error Kit instead of throwing — this
          // is a defensive branch.
          if (inFlightLoadRef.current !== kitId) return
          inFlightLoadRef.current = null
          RundotAPI.error('[PadGridScreen] loadKit threw', {
            kitId,
            error: err instanceof Error ? err.message : String(err),
          })
          if (!options.skipLoadingState) setLoadStatus('error')
        })
    },
    [],
  )

  // Reset transport mode on mount so reviewers always land on the idle state.
  const setMode = usePadGridStore((s) => s.setMode)
  useEffect(() => {
    setMode('idle')
  }, [setMode])

  // Trigger an initial load when the active kit has no pads (or is flagged
  // invalid). Already-loaded kits short-circuit to 'ready'.
  useEffect(() => {
    if (!activeKit) {
      setLoadStatus('error')
      return
    }
    if (activeKit.invalidMetadata) {
      setLoadStatus('error')
      return
    }
    if (activeKit.pads.length === 0) {
      triggerLoad(activeKitId)
    } else {
      // Pre-seeded kit (e.g. hero): the grid is renderable now so the FTUE
      // spotlight + empty-hint UI must mount synchronously. We STILL need to
      // register buffers in the audio graph — taps would otherwise hit
      // `scheduleRamp` with no buffer to play. Trigger the buffer
      // registration without flipping back into the 'loading' UI state.
      setLoadStatus('ready')
      triggerLoad(activeKitId, { skipLoadingState: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKitId, activeKit?.id, triggerLoad])

  // Surface kit-load failures as a centered confirmation dialog rather than
  // an inline banner. The banner pushed Bank A pads off-frame and read as
  // "the kit screen but with a stripe of error text on top"; a popup makes
  // the failure feel terminal-until-action and stays out of the pad grid's
  // way. Retry → re-trigger load. Cancel → fall back to the hero kit so
  // the player isn't stranded on a permanently-error'd kit.
  const errorShownForKitRef = useRef<string | null>(null)
  const setActiveKit = useKitsStore((s) => s.setActiveKit)
  useEffect(() => {
    if (loadStatus !== 'error') {
      errorShownForKitRef.current = null
      return
    }
    if (errorShownForKitRef.current === activeKitId) return
    errorShownForKitRef.current = activeKitId
    const kitName = activeKit?.name ?? 'this kit'
    void useConfirmDialogStore
      .getState()
      .show({
        title: `Couldn't load ${kitName}`,
        message:
          'The audio for this pack didn\'t finish loading. Retry, or jump back to the hero pack.',
        confirmLabel: 'Retry',
        cancelLabel: 'Hero pack',
      })
      .then((retried) => {
        if (retried) {
          triggerLoad(activeKitId)
        } else {
          setActiveKit(HERO_KIT_ID)
        }
      })
  }, [loadStatus, activeKitId, activeKit?.name, triggerLoad, setActiveKit])

  // Session persistence install. Boot-time `hydrateSession` already
  // restored `activeKitId`; we just install the subscription that
  // writes future kit changes back to storage. Done once per mount
  // when the current kit is ready. We deliberately do NOT auto-restore
  // active pads — every previous attempt at "remember which pads were
  // playing" has tangled with the audio context's user-gesture
  // requirement and silenced the engine. The pack restores; the
  // groove is the player's to rebuild.
  const sessionResolvedRef = useRef(false)
  useEffect(() => {
    if (sessionResolvedRef.current) return
    if (loadStatus !== 'ready') return
    sessionResolvedRef.current = true
    consumePendingSession()
    installSessionPersistence()
  }, [loadStatus])

  // Auto-push RecordingReview when a capture transitions through 'completing'.
  // Guard against double-push: recording-capture.ts also calls openModal as a
  // belt-and-braces path; we only push if the modal isn't already in stack.
  useEffect(() => {
    if (recordingStatus !== 'completing') return
    const modalStack = useNavigationStore.getState().modalStack
    if (modalStack.includes('recordingReview')) return
    openModal('recordingReview')
  }, [recordingStatus, openModal])

  // Analytics — screen_viewed + game_opened on mount (with idempotency
  // guards covering React StrictMode double-render and remount cycles).
  const screenViewedFiredThisMountRef = useRef(false)
  useEffect(() => {
    if (!screenViewedFiredThisMountRef.current) {
      screenViewedFiredThisMountRef.current = true
      recordScreenViewed({ screen: 'play' })
    }
    if (!gameOpenedFired) {
      gameOpenedFired = true
      // best-effort: resolve the launch source from the async launch intent
      // (replaces the deprecated RundotAPI.context.launchParams snapshot). An
      // RPC failure must not block the game_opened analytics event.
      void (async () => {
        let launchSource = ''
        try {
          const intent = await RundotAPI.app.resolveLaunchIntent()
          if (intent.kind === 'deeplink') {
            launchSource = (intent.params['source'] ?? '') as string
          }
        } catch (err) {
          RundotAPI.log('resolveLaunchIntent failed', err)
        }
        recordGameOpened({ entry_point: launchSource || 'cold_start' })
      })()
    }
  }, [])

  // Funnel — first_pad_tap on the first lifetime pad activation.
  useEffect(() => {
    if (firstPadTapFired) return
    if (activePadIds.length === 0) return
    firstPadTapFired = true
    trackBeatBoardFunnelStep('first_pad_tap')
    recordCustomEvent('first_pad_tap', { pack_id: activeKitId })
  }, [activePadIds.length, activeKitId])

  return (
    <>
    <ScreenChrome>
      <div
        data-testid="pad-grid-stage"
        data-load-status={loadStatus}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: 0,
          padding: '6px 4px 0',
        }}
      >
        {loadStatus === 'loading' ? null : <PadTopBar hideBankToggle={hideBankToggle} />}

        <DailyLoginBanner />

        {loadStatus === 'loading' ? (
          <div data-testid="pad-grid-skeleton" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="pad-grid-skeleton-bar" />
            <div className="pad-grid-skeleton-bar" />
            <div className="pad-grid-skeleton-bar" />
          </div>
        ) : (
          // Pads are always interactive on the Play screen. The FTUE's
          // record-button gate (`recordDisabled`) is for the Record CTA
          // ONLY — applying it to the pads themselves locks the player
          // out of FTUE step 1 ("Tap a pad"), since the gate stays
          // true until step 2 completes. PadTopBar reads the gate
          // directly via `subscribeRecordGate`.
          <ResponsivePadSurface interactive={true} />
        )}

{/* Empty-state callout removed — it was popping in/out as the grid
            emptied between taps. The pads themselves teach the interaction. */}

        {/*
         * FX panel — collapsible by default. The toggle button at the top
         * of the panel expands the four-effect XY surface; closed state
         * just shows the toggle so the grid above absorbs the freed space.
         */}
        {loadStatus !== 'loading' ? <CollapsibleFxPanel /> : null}
      </div>
    </ScreenChrome>
    <FtueOverlay />
    </>
  )
}

