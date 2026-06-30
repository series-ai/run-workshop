/**
 * BeatBoard FTUE configuration.
 *
 * Issue beat-board-25-ftue-engine owns this file. Source-of-truth is
 * prd.md § FTUE Specification. The config drives the
 * `onboarding/ftue-engine` module via `ftue-adapter.ts`.
 *
 * Subsection A (core-loop FTUE): three linear steps that fire on Play.
 *   - Step 1: highlight pad-cell-0 (top-left), wait for `pad_activated`.
 *   - Step 2: highlight pad-cell-5 (different color), wait until
 *     `activePadIds.length >= 2`.
 *   - Step 3: highlight record button, wait for `recording_started`.
 *
 * Subsection B (per-feature contextual tutorials): two `on_unlock` steps
 * bridged via `progressive-unlocks.subscribeUnlock`.
 *   - mute_pad — latch hint after step 2 completes. Feature key retained
 *     as `mute_pad` for FTUE persistence/seedState compatibility; copy
 *     and meaning have been updated to the latch gesture (Groovepad
 *     alignment — there is no mute gesture).
 *   - pack_drawer — packs-tab hint after step 3 + 60s of Play.
 *
 * Tutorial mode is **clean** (positioned tooltips, no character avatar) per
 * prd.md § FTUE Specification — BeatBoard is an app-like creative tool.
 */

import type { FtueConfig } from '../modules/onboarding/ftue-engine/types'

/** appStorage key the engine persists FTUE progress under. */
export const BEATBOARD_FTUE_STORAGE_KEY = 'beatboard_ftue'

/** Variant tag emitted on `ftue_started` / `ftue_completed`. */
export const BEATBOARD_FTUE_VARIANT = 'beatboard_v1'

/** The kit / primary-tab screen the FTUE runs on. */
export const BEATBOARD_FTUE_KIT_SCREEN = 'play'

/** Feature keys that drive contextual tutorials. */
export const BEATBOARD_FTUE_FEATURE_KEYS = ['mute_pad', 'pack_drawer'] as const

/**
 * Condition keys exposed by `ftue-adapter.ts`. Every key here must have a
 * matching evaluator in the adapter's `conditions` map. `validateFtueConfig`
 * throws at init if any is missing.
 */
export const BEATBOARD_FTUE_CONDITION_KEYS = [
  'pad_activated',
  'second_pad_activated',
] as const

export const BEATBOARD_FTUE_CONFIG: FtueConfig = {
  storageKey: BEATBOARD_FTUE_STORAGE_KEY,
  kitScreen: BEATBOARD_FTUE_KIT_SCREEN,
  alwaysShowSkip: true,
  phases: [
    { id: 'core_loop', mode: 'linear', completesWhen: 'all_non_stub' },
    { id: 'feature_loops', mode: 'contextual' },
  ],
  steps: [
    // ── Subsection A: core-loop linear steps ───────────────────────────
    {
      id: 'tap_first_pad',
      phase: 'core_loop',
      spotlight: '[data-ftue="pad-cell-0"]',
      message: 'Tap a pad to start your beat.',
      tooltipPosition: 'bottom',
      // Polled condition — `pad_activated` evaluates ctx.activePadIds.length >= 1.
      // `allowPointerThrough` drops the backdrop's pointer-events so the
      // player can tap ANY pad (not just the spotlighted pad-cell-0) and
      // complete the step. Without this, `handleBackdropClick` swallows
      // every tap outside the spotlight rect with stopPropagation +
      // preventDefault, which reads as "the pad just doesn't respond."
      completion: { type: 'pad_activated', params: { allowPointerThrough: true } },
      gates: [{ name: 'step1_active', opensOn: 'reach' }],
    },
    {
      id: 'tap_second_pad',
      phase: 'core_loop',
      spotlight: '[data-ftue="pad-cell-5"]',
      message: 'Add another. Layers always sound good together.',
      tooltipPosition: 'bottom',
      // Same allowPointerThrough rationale as tap_first_pad.
      completion: { type: 'second_pad_activated', params: { allowPointerThrough: true } },
      gates: [{ name: 'step2_active', opensOn: 'reach' }],
    },
    {
      id: 'tap_record_button',
      phase: 'core_loop',
      spotlight: '[data-ftue="record-button"]',
      message: 'Tap Record when it sounds good.',
      tooltipPosition: 'top',
      // Event-driven completion — `recording.start()` fires `recording_started`.
      // Pointer-through so the player can keep tinkering with pads while
      // the spotlight points at the record button.
      completion: { type: 'event', params: { eventName: 'recording_started', allowPointerThrough: true } },
      gates: [{ name: 'step3_active', opensOn: 'reach' }],
    },
    // ── Subsection B: per-feature contextual tutorials ──────────────────
    {
      id: 'mute_pad_hint',
      phase: 'feature_loops',
      spotlight: '[data-ftue="pad-cell-active-any"]',
      // Copy intentionally describes the latch gesture (Groovepad has no
      // mute — research/groovepad/features.md:7,30). Step id + featureKey
      // remain `mute_pad` so existing FTUE persistence + seedState bypass
      // keys (`ftue.feature.mute_pad.complete`) keep working.
      message: 'Press and hold a pad to lock it on.',
      tooltipPosition: 'bottom',
      completion: { type: 'manual' },
      dismissible: true,
      featureKey: 'mute_pad',
      trigger: { mode: 'on_unlock', featureKey: 'mute_pad' },
    },
    {
      id: 'pack_drawer_hint',
      phase: 'feature_loops',
      spotlight: '[data-ftue="tab-packs"]',
      message: 'More packs live in the Packs tab.',
      tooltipPosition: 'top',
      completion: { type: 'manual' },
      dismissible: true,
      featureKey: 'pack_drawer',
      trigger: { mode: 'on_unlock', featureKey: 'pack_drawer' },
    },
  ],
}
