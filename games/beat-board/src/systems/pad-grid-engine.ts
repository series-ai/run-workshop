/**
 * pad-grid-engine — BeatBoard's audio orchestrator (Groovepad 6-block model).
 *
 *   1. **Per-block lockout** — at most one looping variant per block plays
 *      at a time. Tapping a different variant in the same block enqueues it;
 *      the queue lands at the next bar boundary. The outgoing variant fades
 *      out at the same bar boundary the incoming variant fades in.
 *
 *   2. **Queue → take-over animation** — between tap and bar boundary, the
 *      queued pad is in `padGridStore.queued[bank][blockId]`. The PadCell
 *      reads this to render a circular sweep ring whose stroke-dashoffset
 *      animates from 100% → 0 over the wait window.
 *
 *   3. **One-shot pads** — `isOneShot: true` blocks (4 + 5) tap-fire
 *      immediately (no bar wait). Re-tapping the same one-shot restarts
 *      from the start. One-shots auto-remove from `activePadIds` after
 *      their fade-out tail.
 *
 *   4. **First-tap-immediate** — when no pads are active, the first loop
 *      tap also fires immediately rather than waiting for a bar boundary
 *      (the grid has no rhythm to sync to yet).
 *
 *   5. **Toggle-off** — tapping an already-active loop toggles it off
 *      (deactivate) rather than re-enqueuing.
 *
 * The engine accepts injected dependencies (audio time, ramp scheduler,
 * beat-clock helpers, analytics sink) so tests exercise orchestration
 * without spinning up a real audio graph.
 */
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { analytics as analyticsModule } from '@modules/data/analytics-service/AnalyticsService'
import { getKitById, useKitsStore } from '../stores/kitsStore'
import { usePadGridStore, buildDefaultQueue } from '../stores/padGridStore'
import type { PadBlockId, PadMeta } from '../types/kit'
import { nextBarFromNow as defaultNextBarFromNow, getBeatClock } from '../audio/beat-clock'
import { getAudioContext, isAudioMasterReady, readMasterDiagnostic } from '../audio/audio-master'
import {
  getPadAudioGraph,
  getPadAudioGraphSnapshot,
  restartPadSource,
  getPadBufferDuration,
  getKitPhaseAnchor,
  setKitPhaseAnchor,
  nextBarFromKitAnchor,
} from '../audio/pad-audio-graph'
import { audioTrace } from '../audio/audio-trace'

export const LONG_PRESS_THRESHOLD_MS = 400
export const TAP_DEBOUNCE_MS = 200
export const ONE_SHOT_FADE_IN_FRACTION = 0.25
/**
 * Head delay applied when the audio device is already producing samples
 * (`kitPhaseAnchor` is set). Short enough to feel instant.
 */
export const FIRST_TAP_IMMEDIATE_HEAD_S = 0.01
/**
 * Head delay applied when no audible source has been started yet in the
 * session. The audio device has a wake-up latency after `ctx.resume()`
 * that can swallow the first ~50 ms of output; scheduling sample 0 of
 * the loop ~120 ms in the future guarantees the device is producing
 * audible samples by the time the source actually fires, so the player
 * hears the loop from the downbeat instead of mid-phrase.
 */
export const COLD_START_HEAD_S = 0.12

/**
 * Bar-boundary crossfade duration in seconds. The OUTGOING side gets a
 * 30 ms ramp because the pad's audio has been playing — without a soft
 * tail you'd hear a click when gain snaps to 0. The INCOMING side gets
 * a near-zero ramp (2 ms) because the source was just created and the
 * gain was 0 before swapAt — there's no prior signal to interpolate
 * from. A long incoming fade attenuates the FRONT of the loop's
 * attack (the kick on beat 1), which sounds like the loop "skips in"
 * softly before reaching full volume on iteration 2.
 */
export const BAR_CROSSFADE_SECONDS = 0.03
export const INCOMING_FADE_IN_SECONDS = 0.002

export interface PadGridEngineDeps {
  getCurrentTime(): number
  scheduleRamp(
    padId: string,
    fromGain: number,
    toGain: number,
    startAt: number,
    endAt: number,
  ): void
  setGain(padId: string, value: number): void
  /**
   * Cancel future scheduled gain automation for `padId` starting at
   * `fromTime` and re-anchor the gain at its current value. Required
   * by the re-tap-during-deactivate path so a pending fade-out doesn't
   * kill the loop the player just re-engaged.
   */
  cancelGainRamps(padId: string, fromTime: number): void
  nextBarFromNow(): number
  secondsPerBar(): number
  now(): number
}

export interface PadGridEngine {
  /**
   * Tap a looping pad. If the pad is already active it deactivates
   * (toggle-off). Otherwise: enqueue at next bar boundary (or immediately
   * if the grid is empty), apply per-block lockout against the previously
   * active loop in this block, schedule fades.
   */
  tapLoop(padId: string): void
  /**
   * Fire a one-shot. Re-tap restarts. Per-block lockout still applies —
   * tapping a one-shot retires any currently-firing one-shot in the same
   * block.
   */
  tapOneShot(padId: string): void
  /**
   * Explicitly deactivate a loop. Schedules a 1 → 0 fade at the next bar
   * boundary; pad removed from the store on tick().
   */
  deactivate(padId: string): void
  /** Drain settled pending-removals at audio-context time `t`. */
  tick(audioContextTime: number): void
  /**
   * Hard-cut every active pad: cancel scheduled fades, slam gain to 0,
   * clear the store's active/latched/queued/oneShotWindows. Used by the
   * recording-review modal so a session can replay from a known-clean
   * engine state — replay tapLoop events are toggle-ish, so any pad
   * still mid-fade-out at replay-start would cancel its incoming
   * activation instead of firing.
   */
  stopAllImmediately(): void
}

interface PendingRemoval {
  padId: string
  removeAfter: number
}

/**
 * Audio-chain self-diagnostic. The first time the player taps a pad we
 * snapshot the master graph, the pad audio graph, and a one-line audible-
 * energy report, and write it to RundotAPI.log so the player can copy it
 * out of the console if no sound is reaching the speakers. After ~1.5s
 * we sample the analyser tap a second time so the log captures whether
 * RMS energy actually rose.
 */
let firstTapDiagnosticLogged = false
function maybeLogFirstTapDiagnostic(padId: string, kind: 'loop' | 'one-shot'): void {
  if (firstTapDiagnosticLogged) return
  firstTapDiagnosticLogged = true
  const stamp = (label: string) => {
    const master = readMasterDiagnostic()
    const padGraph = getPadAudioGraphSnapshot()
    const padEntry = padGraph.pads.find((p) => p.padId === padId)
    RundotAPI.log(`[audio-diagnose] ${label}`, {
      padId,
      kind,
      master: {
        ready: master.ready,
        contextState: master.contextState,
        currentTime: master.currentTime,
        masterGainValue: master.masterGainValue,
        computedMasterGain: master.computedMasterGain,
        rmsEnergy: master.rmsEnergy,
        peakEnergy: master.peakEnergy,
        soundEnabled: master.settings.soundEnabled,
        musicEnabled: master.settings.musicEnabled,
        musicVolume: master.settings.musicVolume,
      },
      pad: padEntry,
      registeredPads: padGraph.registeredPads,
    })
  }
  stamp('first-tap:before-ramp')
  setTimeout(() => stamp('first-tap:after-1500ms'), 1500)
}

function getActiveKitInvalid(): boolean {
  const kit = getKitById(useKitsStore.getState().activeKitId)
  return Boolean(kit?.invalidMetadata)
}

function getActiveKitId(): string {
  return useKitsStore.getState().activeKitId
}

function getPadMeta(padId: string): PadMeta | undefined {
  const kit = getKitById(useKitsStore.getState().activeKitId)
  return kit?.pads.find((p) => p.padId === padId)
}

function layerIdOf(padId: string): string {
  return getPadMeta(padId)?.layerId ?? padId
}

function blockOf(padId: string): { bank: PadMeta['bank']; blockId: PadBlockId } | null {
  const meta = getPadMeta(padId)
  if (!meta) return null
  return { bank: meta.bank, blockId: meta.blockId }
}

export function createPadGridEngine(deps: PadGridEngineDeps): PadGridEngine {
  const lastTapAt = new Map<string, number>()
  const pendingRemovals: PendingRemoval[] = []

  function barFadeSeconds(): number {
    // The crossfade window now lives at the bar boundary, NOT spanning a
    // whole bar. Returns the short crossfade duration used for both the
    // incoming fade-in and outgoing fade-out.
    return BAR_CROSSFADE_SECONDS
  }

  function scheduleFadeIn(padId: string, startAt: number, durationSeconds: number): void {
    deps.scheduleRamp(padId, 0, 1, startAt, startAt + durationSeconds)
  }

  function scheduleFadeOut(padId: string, startAt: number, durationSeconds: number): void {
    deps.scheduleRamp(padId, 1, 0, startAt, startAt + durationSeconds)
  }

  /**
   * Compute the start time for a new tap. First-tap-immediate when the grid
   * is empty so the player hears themselves instantly; once any pad is
   * active, taps fall back to bar-aligned starts.
   */
  /**
   * Compute when the SWAP should fire when a new loop pad is tapped.
   *
   *   - First tap on an empty grid → start immediately (10 ms head, or
   *     120 ms cold). The player hears themselves on the first
   *     interaction; this also defines the kit's bar grid (anchor).
   *   - Every other tap (same-block swap OR cross-block layer add) →
   *     fire at the **next 1-bar boundary** on the kit phase grid. This
   *     is the Groovepad "clean cut on any of the 8 stage boundaries"
   *     model: a tap mid-bar 5 of an 8-bar outgoing swaps in at bar 6,
   *     not at the outgoing's iteration end. Loops are composed so
   *     every bar is a clean entry point, so the cut sounds intentional.
   */
  function computeSwapAt(newPadId: string): number {
    const ctxNow = deps.getCurrentTime()
    const state = usePadGridStore.getState()
    const isFirstTap = state.activePadIds.length === 0
    if (isFirstTap) {
      // Cold start (no anchor) → 120 ms head so the audio device finishes
      // wake-up before sample 0 plays + anchor the kit's bar grid here.
      // Warm-but-empty (anchor exists, grid emptied via deactivate-all) →
      // 10 ms snap-tap head, anchor LEFT ALONE so subsequent taps still
      // align to the original kit grid. Re-anchoring on every clear-and-
      // retap was the cause of the "drops feel random within the same
      // session" complaint: the bar grid kept shifting under the player
      // every time the grid emptied, so a layered loop's bar-1 didn't
      // match the prior loop's bar-1.
      const isCold = getKitPhaseAnchor() === null
      const head = isCold ? COLD_START_HEAD_S : FIRST_TAP_IMMEDIATE_HEAD_S
      const swapAt = ctxNow + head
      if (isCold) setKitPhaseAnchor(swapAt)
      audioTrace('engine:first-tap-immediate', { padId: newPadId, isCold, head })
      return swapAt
    }
    return nextBarFromKitAnchor(ctxNow, deps.secondsPerBar())
  }

  /**
   * Per-block lockout: any other LATCHED looping pad in the same block
   * is scheduled for fade-out at `swapAt` (the outgoing's natural end).
   * The pad stays in `activePadIds` until the audio actually settles,
   * tracked via `pendingRemovals` so the UI can keep rendering it as
   * "outgoing" (still playing) while the queue sweep counts down.
   */
  function applyBlockLockout(
    newPadId: string,
    swapAt: number,
    fadeDuration: number,
  ): string[] {
    if (getActiveKitInvalid()) return []
    const newBlock = blockOf(newPadId)
    if (!newBlock) return []
    const state = usePadGridStore.getState()
    const evicted: string[] = []
    for (const padId of state.activePadIds) {
      if (padId === newPadId) continue
      const otherBlock = blockOf(padId)
      if (!otherBlock) continue
      if (otherBlock.bank !== newBlock.bank) continue
      if (otherBlock.blockId !== newBlock.blockId) continue
      scheduleFadeOut(padId, swapAt, fadeDuration)
      pendingRemovals.push({ padId, removeAfter: swapAt + fadeDuration })
      evicted.push(padId)
    }
    return evicted
  }

  function tapLoop(padId: string): void {
    audioTrace('engine:tap-loop:enter', { padId })
    maybeLogFirstTapDiagnostic(padId, 'loop')
    const wallNow = deps.now()
    const last = lastTapAt.get(padId) ?? -Infinity
    if (wallNow - last < TAP_DEBOUNCE_MS) {
      audioTrace('engine:tap-loop:debounced', { padId, deltaMs: wallNow - last })
      return
    }
    lastTapAt.set(padId, wallNow)

    const meta = getPadMeta(padId)
    if (!meta || meta.isOneShot) {
      audioTrace('engine:tap-loop:wrong-kind', { padId, kind: meta?.isOneShot ? 'one-shot' : 'unknown' })
      return
    }

    const state = usePadGridStore.getState()
    const isAlreadyActive = state.activePadIds.includes(padId)
    if (isAlreadyActive) {
      // Re-tap during a pending fade-out: cancel the deactivate and
      // keep the loop running. Without this, the future scheduled
      // 1 → 0 ramp at the outgoing iteration end still fires and
      // silences the pad the player just re-engaged.
      const hasPendingRemoval = pendingRemovals.some((p) => p.padId === padId)
      if (hasPendingRemoval) {
        audioTrace('engine:tap-loop:cancel-deactivate', { padId })
        cancelDeactivate(padId)
        return
      }
      audioTrace('engine:tap-loop:toggle-off', { padId })
      deactivate(padId)
      return
    }

    const swapAt = computeSwapAt(padId)
    const fadeDuration = barFadeSeconds()
    audioTrace('engine:tap-loop:scheduling', { padId, swapAt, fadeDuration, ctxNow: deps.getCurrentTime() })

    if (getActiveKitInvalid()) {
      RundotAPI.error('[pad-grid-engine] kit has invalid metadata; falling back to any-combination-valid mode', {
        kitId: getActiveKitId(),
        padId,
      })
    }

    // Schedule the same-block outgoing pad's fade-out at swapAt. The
    // outgoing pad stays in activePadIds (and its UI cell stays bright)
    // until the audio settles via tick(); evicted ids aren't returned
    // because we no longer optimistically remove them.
    applyBlockLockout(padId, swapAt, fadeDuration)

    // Restart the new pad's source so it plays from sample 0 starting
    // at swapAt. Without this, we'd be opening the gain on a phase-
    // locked source that's somewhere mid-loop — the player would hear
    // the loop cut in mid-phrase instead of from its musical top
    // (kick on beat 1, vocal phrase from word 1, etc.). Combined with
    // bar-aligned swap times this is the Groovepad behavior: tap →
    // hear the loop from the beginning, on-beat.
    restartPadSource(padId, swapAt)

    // Incoming gain ramps from 0 → 1 over a near-zero (2 ms) window
    // starting AT swapAt. The source was just created so there's no
    // prior signal to interpolate from — a longer fade would just
    // attenuate the loop's downbeat attack (the kick at sample 0
    // sounds like a "skip in" instead of hitting cleanly).
    const ctxNow = deps.getCurrentTime()
    scheduleFadeIn(padId, swapAt, INCOMING_FADE_IN_SECONDS)

    // Place a queue entry so the UI can show the countdown ring/bar
    // animating over the actual wait window. Skip placement on the
    // first-tap-immediate path — its head can run up to COLD_START_HEAD_S
    // (120 ms), which is below the threshold of being worth a sweep ring
    // and would otherwise flash a brief countdown before the loop fires.
    // Cross-block bar-aligned waits start at one full bar (~2.857 s at
    // 84 BPM), well above this threshold.
    const queueWindowMs = (swapAt - ctxNow) * 1000
    const placeQueue = queueWindowMs > COLD_START_HEAD_S * 1000 + 50

    usePadGridStore.setState((prev) => {
      // The OUTGOING pad stays in `activePadIds` and `latchedPadIds`
      // until the audio settles. tick() removes it via pendingRemovals
      // when the fade-out lands. This lets the UI keep rendering the
      // outgoing pad as "still playing" through its remaining iteration,
      // matching Groovepad's behavior.
      const alreadyActive = prev.activePadIds.includes(padId)
      const nextActive = alreadyActive ? prev.activePadIds : [...prev.activePadIds, padId]
      const alreadyLatched = prev.latchedPadIds.includes(padId)
      const nextLatched = alreadyLatched ? prev.latchedPadIds : [...prev.latchedPadIds, padId]
      let nextQueued = prev.queued
      if (placeQueue) {
        nextQueued = {
          ...prev.queued,
          [meta.bank]: {
            ...prev.queued[meta.bank],
            [meta.blockId]: { padId, queuedAt: ctxNow, landsAt: swapAt },
          },
        }
      } else {
        nextQueued = {
          ...prev.queued,
          [meta.bank]: {
            ...prev.queued[meta.bank],
            [meta.blockId]: null,
          },
        }
      }
      return { activePadIds: nextActive, latchedPadIds: nextLatched, queued: nextQueued }
    })

    // Schedule queue clear when the ramp lands (audio time-based).
    if (placeQueue) {
      pendingRemovals.push({
        padId: `__queue-clear:${meta.bank}:${meta.blockId}:${padId}`,
        removeAfter: swapAt,
      })
    }

    analyticsModule.track('pad_activated', {
      pack_id: getActiveKitId(),
      pad_color: meta.color,
      layer_id: layerIdOf(padId),
      total_active_after: usePadGridStore.getState().activePadIds.length,
      gesture: 'latch',
    })
  }

  function tapOneShot(padId: string): void {
    audioTrace('engine:tap-one-shot:enter', { padId })
    maybeLogFirstTapDiagnostic(padId, 'one-shot')
    const wallNow = deps.now()
    const last = lastTapAt.get(padId) ?? -Infinity
    if (wallNow - last < TAP_DEBOUNCE_MS) {
      audioTrace('engine:tap-one-shot:debounced', { padId, deltaMs: wallNow - last })
      return
    }
    lastTapAt.set(padId, wallNow)

    const meta = getPadMeta(padId)
    if (!meta || !meta.isOneShot) {
      audioTrace('engine:tap-one-shot:wrong-kind', { padId, kind: meta?.isOneShot ? 'one-shot' : 'unknown' })
      return
    }

    // One-shots fire IMMEDIATELY — no bar wait. Per-block lockout does
    // NOT apply; one-shots stack freely (multiple variants in the same
    // block can ring out simultaneously). Re-tapping the SAME pad
    // restarts it: cancel pending ramps, schedule a fresh fade-in/out
    // window from scratch (covered by the ramp-cancel inside
    // `scheduleRamp` on most graphs; we also drop the previous
    // pending-removal entry so the auto-remove doesn't fire mid-ring).
    const ctxNow = deps.getCurrentTime()
    // Same cold-vs-warm logic as `computeSwapAt`: the very first audible
    // event of a session needs the longer head to outrun audio-device
    // wake-up latency. We anchor on cold-only — once loops are running
    // we must not touch the grid anchor or cross-block taps would drift.
    const isCold = getKitPhaseAnchor() === null
    const startAt =
      ctxNow + (isCold ? COLD_START_HEAD_S : FIRST_TAP_IMMEDIATE_HEAD_S)
    if (isCold) setKitPhaseAnchor(startAt)
    // One-shots play their FULL buffer at unity gain. A short attack
    // (50 ms) suppresses any click on retrigger; the natural audio
    // envelope (decay, reverb tail, etc.) handles the ring-out, then a
    // 30 ms tail fade at the end of the buffer suppresses any boundary
    // click on auto-removal. This lets a 5-second crescendo snare roll
    // actually play through to its peak instead of being cut off mid-roll
    // by an arbitrary bar-length window.
    const bufferDuration = getPadBufferDuration(padId) ?? 1.0
    const ATTACK_S = 0.05
    const TAIL_S = 0.03
    const fadeInEnd = startAt + ATTACK_S
    const fadeOutStart = startAt + Math.max(ATTACK_S, bufferDuration - TAIL_S)
    const fadeOutEnd = startAt + bufferDuration
    audioTrace('engine:tap-one-shot:scheduling', { padId, startAt, fadeInEnd, fadeOutStart, fadeOutEnd, bufferDuration })

    if (getActiveKitInvalid()) {
      RundotAPI.error('[pad-grid-engine] kit has invalid metadata; falling back to any-combination-valid mode', {
        kitId: getActiveKitId(),
        padId,
      })
    }

    // Drop any prior pending-removal for THIS pad (re-tap restart) so the
    // old auto-remove doesn't yank gain to 0 in the middle of the new
    // ring-out. Other one-shots in the same block remain untouched —
    // multiple one-shots can stack freely.
    for (let i = pendingRemovals.length - 1; i >= 0; i--) {
      if (pendingRemovals[i]!.padId === padId) pendingRemovals.splice(i, 1)
    }

    // Restart the source so the one-shot plays from sample 0 — a kick or
    // sting needs to fire from its attack, not from wherever a phase-
    // locked source happened to be in its cycle. `loop: false` so the
    // buffer plays once and stops at its natural decay end; otherwise
    // a buffer with a silent tail (common in generated SFX outputs)
    // wraps back to the attack and the player hears a half-second
    // "drop" artefact while the engine's gain ramp silences the
    // wrapped iteration.
    restartPadSource(padId, startAt, { loop: false })

    deps.scheduleRamp(padId, 0, 1, startAt, fadeInEnd)
    deps.scheduleRamp(padId, 1, 0, fadeOutStart, fadeOutEnd)
    pendingRemovals.push({ padId, removeAfter: fadeOutEnd })

    usePadGridStore.setState((prev) => {
      const alreadyActive = prev.activePadIds.includes(padId)
      const nextActive = alreadyActive ? prev.activePadIds : [...prev.activePadIds, padId]
      // One-shots do NOT enter the latched set; latched is loop-only.
      // Record the firing window so the UI can drive its playhead bar.
      const nextOneShotWindows = {
        ...prev.oneShotWindows,
        [padId]: { startsAt: startAt, endsAt: fadeOutEnd },
      }
      return { activePadIds: nextActive, oneShotWindows: nextOneShotWindows }
    })

    analyticsModule.track('pad_activated', {
      pack_id: getActiveKitId(),
      pad_color: meta.color,
      layer_id: layerIdOf(padId),
      total_active_after: usePadGridStore.getState().activePadIds.length,
      gesture: 'one-shot',
    })
  }

  function deactivate(padId: string): void {
    const state = usePadGridStore.getState()
    if (!state.activePadIds.includes(padId)) return

    const ctxNow = deps.getCurrentTime()
    // Toggle-off lands on the next 1-bar boundary on the kit phase grid,
    // matching same-block swap behaviour. A 30 ms tail fade prevents a
    // wrap click; the cut still reads as "on the beat" because the audio
    // is essentially gone within one block of audio frames after swapAt.
    // Phrase-length-aware tail fades were dropped — Groovepad's "clean
    // cut" UX is consistent regardless of how long the underlying loop
    // is, and players hate "I tapped to stop, and it kept going for 4
    // bars" feedback on multi-bar pads.
    const swapAt = nextBarFromKitAnchor(ctxNow, deps.secondsPerBar())
    const fadeDuration = barFadeSeconds()
    scheduleFadeOut(padId, swapAt, fadeDuration)
    pendingRemovals.push({ padId, removeAfter: swapAt + fadeDuration })

    audioTrace('engine:deactivate:queued-at-next-bar', {
      padId, swapAt, ctxNow, fadeDuration,
    })
    // Visually mark the pad as "outgoing" — keep it in activePadIds + the
    // queue map so the cell shows the countdown to its handoff. tick()
    // removes it from activePadIds once the audio actually settles.
    const meta = getPadMeta(padId)
    if (meta) {
      const queueWindowMs = (swapAt - ctxNow) * 1000
      const placeQueue = queueWindowMs > 50
      usePadGridStore.setState((prev) => {
        let nextQueued = prev.queued
        if (placeQueue) {
          // Use a sentinel padId — the QueueFillBar will see "no incoming
          // padId in this block" and treat it as a deactivate countdown.
          nextQueued = {
            ...prev.queued,
            [meta.bank]: {
              ...prev.queued[meta.bank],
              [meta.blockId]: { padId: `__deactivate:${padId}`, queuedAt: ctxNow, landsAt: swapAt },
            },
          }
        }
        return { queued: nextQueued }
      })
    }
  }

  /**
   * Re-tap recovery for a pad that's mid-deactivate. Two scenarios:
   *
   *   A. **User-deactivate cancel** — player tapped A to stop, then
   *      re-tapped A. Queue entry holds the `__deactivate:A` sentinel.
   *      Drop the pending-removal, cancel the scheduled fade-out, and
   *      anchor gain at 1.
   *
   *   B. **Same-block swap cancel** — player tapped A→B, then re-tapped
   *      A before swapAt fired. Queue entry holds B's padId (the
   *      incoming). Per-block lockout requires at most one variant per
   *      block at gain 1, so we ALSO undo the swap: cancel B's pending
   *      fade-in, drop B from active/latched sets, and clear the queue.
   */
  function cancelDeactivate(padId: string): void {
    const ctxNow = deps.getCurrentTime()
    for (let i = pendingRemovals.length - 1; i >= 0; i--) {
      if (pendingRemovals[i]!.padId === padId) pendingRemovals.splice(i, 1)
    }
    deps.cancelGainRamps(padId, ctxNow)
    // Identity ramp anchors gain at 1 and acts as a no-op fade-in event,
    // matching the schedule semantics of a regular tap so downstream
    // observers see a 0 → 1 (well, 1 → 1) "engagement" event.
    deps.scheduleRamp(padId, 1, 1, ctxNow, ctxNow + INCOMING_FADE_IN_SECONDS)

    // If this pad's block has a same-block swap-incoming queued (queue
    // entry padId is NOT the `__deactivate:` sentinel), the re-tap must
    // also undo that swap to keep the per-block lockout invariant.
    let incomingId: string | null = null
    const meta = getPadMeta(padId)
    if (meta) {
      const queueEntry = usePadGridStore.getState().queued[meta.bank][meta.blockId]
      if (queueEntry && !queueEntry.padId.startsWith('__deactivate:')) {
        incomingId = queueEntry.padId
      }
    }
    if (incomingId !== null) {
      // Drop incoming's pending-removal (set by applyBlockLockout against
      // padId — already removed above; defensive in case the engine ever
      // schedules incoming-side removals separately).
      for (let i = pendingRemovals.length - 1; i >= 0; i--) {
        if (pendingRemovals[i]!.padId === incomingId) pendingRemovals.splice(i, 1)
      }
      // Cancel incoming's scheduled fade-in. The source-restart already
      // happened, so the fresh source is running silently — we just
      // never let its gain ramp up.
      deps.cancelGainRamps(incomingId, ctxNow)
    }

    // Clear queue indicators in this pad's block, regardless of branch.
    usePadGridStore.setState((prev) => {
      let nextQueued = prev.queued
      for (const bank of ['A', 'B'] as const) {
        for (const blockId of [
          'block-0',
          'block-1',
          'block-2',
          'block-3',
          'block-4',
          'block-5',
        ] as const) {
          const cur = nextQueued[bank][blockId]
          if (
            cur &&
            (cur.padId === `__deactivate:${padId}` ||
              (incomingId !== null && cur.padId === incomingId))
          ) {
            nextQueued = {
              ...nextQueued,
              [bank]: { ...nextQueued[bank], [blockId]: null },
            }
          }
        }
      }
      // If we cancelled an incoming swap, also drop it from active /
      // latched sets so the UI stops rendering it.
      let nextActive = prev.activePadIds
      let nextLatched = prev.latchedPadIds
      if (incomingId !== null) {
        nextActive = nextActive.filter((id) => id !== incomingId)
        nextLatched = nextLatched.filter((id) => id !== incomingId)
      }
      return {
        activePadIds: nextActive,
        latchedPadIds: nextLatched,
        queued: nextQueued,
      }
    })
  }

  function tick(audioContextTime: number): void {
    if (pendingRemovals.length === 0) return
    const settledIds: string[] = []
    const queueClears: Array<{ bank: 'A' | 'B'; blockId: PadBlockId; padId: string }> = []
    for (let i = pendingRemovals.length - 1; i >= 0; i--) {
      const entry = pendingRemovals[i]!
      if (audioContextTime < entry.removeAfter) continue
      pendingRemovals.splice(i, 1)
      if (entry.padId.startsWith('__queue-clear:')) {
        const [, bank, blockId, padId] = entry.padId.split(':')
        queueClears.push({ bank: bank as 'A' | 'B', blockId: blockId as PadBlockId, padId: padId! })
      } else {
        settledIds.push(entry.padId)
      }
    }
    if (settledIds.length === 0 && queueClears.length === 0) return

    usePadGridStore.setState((prev) => {
      const nextActive = settledIds.length
        ? prev.activePadIds.filter((id) => !settledIds.includes(id))
        : prev.activePadIds
      const nextLatched = settledIds.length
        ? prev.latchedPadIds.filter((id) => !settledIds.includes(id))
        : prev.latchedPadIds
      let nextQueued = prev.queued
      for (const { bank, blockId, padId } of queueClears) {
        const cur = nextQueued[bank][blockId]
        if (cur && cur.padId === padId) {
          nextQueued = {
            ...nextQueued,
            [bank]: { ...nextQueued[bank], [blockId]: null },
          }
        }
      }
      // Also clear any `__deactivate:<padId>` queue entries whose target
      // pad just settled — a deactivate completes when the pad's audio
      // ramp lands, and we use the queue entry to drive the countdown UI.
      for (const settledPadId of settledIds) {
        for (const bank of ['A', 'B'] as const) {
          for (const blockId of [
            'block-0', 'block-1', 'block-2',
            'block-3', 'block-4', 'block-5',
          ] as const) {
            const cur = nextQueued[bank][blockId]
            if (cur && cur.padId === `__deactivate:${settledPadId}`) {
              nextQueued = {
                ...nextQueued,
                [bank]: { ...nextQueued[bank], [blockId]: null },
              }
            }
          }
        }
      }
      // Drop one-shot firing windows for pads that just settled.
      let nextOneShotWindows = prev.oneShotWindows
      if (settledIds.length > 0) {
        const draft = { ...nextOneShotWindows }
        for (const id of settledIds) delete draft[id]
        nextOneShotWindows = draft
      }
      return {
        activePadIds: nextActive,
        latchedPadIds: nextLatched,
        queued: nextQueued,
        oneShotWindows: nextOneShotWindows,
      }
    })
  }

  function stopAllImmediately(): void {
    const ctxNow = deps.getCurrentTime()
    const state = usePadGridStore.getState()
    for (const padId of state.activePadIds) {
      deps.cancelGainRamps(padId, ctxNow)
      deps.setGain(padId, 0)
    }
    pendingRemovals.length = 0
    lastTapAt.clear()
    usePadGridStore.setState({
      activePadIds: [],
      latchedPadIds: [],
      queued: buildDefaultQueue(),
      oneShotWindows: {},
    })
    audioTrace('engine:stop-all-immediately', { count: state.activePadIds.length })
  }

  return { tapLoop, tapOneShot, deactivate, tick, stopAllImmediately }
}

function defaultDeps(): PadGridEngineDeps {
  return {
    getCurrentTime() {
      if (!isAudioMasterReady()) return 0
      try {
        return getAudioContext().currentTime
      } catch {
        return 0
      }
    },
    nextBarFromNow: () => defaultNextBarFromNow(),
    secondsPerBar: () => getBeatClock().secondsPerBar(),
    now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
    scheduleRamp: (padId, fromGain, toGain, startAt, endAt) => {
      getPadAudioGraph().scheduleRamp(padId, fromGain, toGain, startAt, endAt)
    },
    setGain: (padId, value) => {
      getPadAudioGraph().setGain(padId, value)
    },
    cancelGainRamps: (padId, fromTime) => {
      getPadAudioGraph().cancelGainRamps(padId, fromTime)
    },
  }
}

let singleton: PadGridEngine | null = null

export function getPadGridEngine(): PadGridEngine {
  if (!singleton) singleton = createPadGridEngine(defaultDeps())
  return singleton
}

export function __resetPadGridEngine(): void {
  singleton = null
}
