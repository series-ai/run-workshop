/**
 * animation-timing — central registry for BeatBoard motion durations.
 *
 * Issue beat-board-27-animation-polish owns this file. Every motion-bearing
 * widget/screen reads its own timing from these named constants so a single
 * tuning pass touches one file. PRD § Visual Style § Motion level captures
 * the design intent; this file is the runtime source of truth.
 *
 * Conventions:
 *   - All durations are milliseconds (ms) unless suffixed `_S` (seconds).
 *   - Names match the acceptance criteria in the issue body verbatim:
 *     `BAR_FADE_MS_AT_84BPM`, `PAD_PUNCH_MS`, `KIT_CARD_PUNCH_MS`,
 *     `MODAL_SLIDE_MS`, `BREATH_PERIOD_MS`, `BLOOM_MS`.
 *   - Helper exports (`secondsPerBeat`, `padPunchConfig`, `kitCardPunchConfig`)
 *     keep call-site arithmetic / juice-config wiring DRY.
 *
 * Non-goals:
 *   - This file does NOT centralize easing curves — those stay with the
 *     juice modules (`juice/punch`, `juice/ui-spring`) so motion shape
 *     remains module-owned.
 *   - It does NOT define CSS keyframes; the project's `style.css` and the
 *     active renderer's `theme.css` own keyframes.
 */

// ── Pad-cell motion ─────────────────────────────────────────────────────

/**
 * One bar of fade-in at 84 BPM (the default kit tempo).
 *   secondsPerBar(84) = (60 / 84) * 4 ≈ 2.857 s → ~2857ms.
 *
 * The `pad-activation-bloom` keyframe runs `1400ms` historically, which
 * tracks ~half a bar. Both values are kept available so call sites can
 * choose: the visual bloom uses the shorter half-bar value for snap; the
 * audio engine uses the full-bar value for its crossfade ramp.
 */
export const BAR_FADE_MS_AT_84BPM = 2857

/**
 * Half-bar visual bloom duration. Used by the saturation fade-in overlay
 * on `PadCell` so the bloom finishes before the next bar's beat one.
 */
export const PAD_ACTIVATION_BLOOM_MS = 1400

/**
 * Pad scale-pulse duration (juice/punch). PRD § Component Translation
 * Table § PadCell (active): "scale 1.0 → 1.08 → 1.0 over 180ms".
 */
export const PAD_PUNCH_MS = 180

/**
 * KitCard tap-punch duration. PRD § Component Translation Table § KitCard:
 * "Tap → 0.97 scale punch (80ms ease-out)".
 */
export const KIT_CARD_PUNCH_MS = 80

/**
 * Slide-up duration for modal sheets (Settings, PackPurchaseSheet,
 * WelcomePackOffer, RewardedAdConfirmSheet, Credits).
 * PRD § Component Translation Table § Settings modal: "Sheet slide-up
 * (240ms ease-out)".
 */
export const MODAL_SLIDE_MS = 240

/**
 * RecordingReview poster breath cycle. PRD § Component Translation Table
 * § RecordingReview poster: "slow 1.05 → 1.0 breath every 4s".
 */
export const BREATH_PERIOD_MS = 4000

/**
 * Full-grid bloom duration on first record completion. PRD § Visual Style
 * § Motion level (spectacle moments): "first record completion (a soft
 * full-grid bloom)" — ~800ms total per the issue acceptance criteria.
 */
export const BLOOM_MS = 800

/**
 * First-pad-of-session radial bloom duration. PRD § Visual Style § Motion
 * level (spectacle moments): "first pad tap (single bloom on the pad)" —
 * 600ms via juice/ui-spring per the issue acceptance criteria.
 */
export const FIRST_PAD_BLOOM_MS = 600

/**
 * Tab-bar active-icon scale-up duration. PRD § Component Translation
 * Table § Tab bar: "Active tab icon scales 1.0 → 1.1 on switch".
 * Matched to the modal slide so transitions read as one cohesive system.
 */
export const TAB_ICON_SCALE_MS = 240

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Period of one beat in seconds at the supplied BPM. Used by call sites
 * that drive the record-button beat pulse — the CSS animation duration is
 * `60 / bpm` seconds per the acceptance criterion.
 */
export function secondsPerBeat(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 60 / 84
  return 60 / bpm
}

/**
 * `juice/punch` config for the PadCell tap animation. Strength is the
 * displacement from rest; with a vibrato of 1 + elasticity 0.4 the pad
 * scales 1.0 → 1.08 → 1.0 over `PAD_PUNCH_MS`.
 */
export const padPunchConfig = {
  strength: 0.08,
  duration: PAD_PUNCH_MS,
  vibrato: 1,
  elasticity: 0.4,
} as const

/**
 * `juice/punch` config for the KitCard tap animation. Strength `1 - 0.97`
 * lands at the prd-mandated 0.97 target scale; vibrato 0.5 + elasticity 0
 * keeps it a single half-oscillation so it feels like a tap, not a bounce.
 */
export const kitCardPunchConfig = {
  property: 'scale' as const,
  strength: 0.03, // 1 - 0.97
  vibrato: 0.5,
  elasticity: 0,
  duration: KIT_CARD_PUNCH_MS,
} as const
