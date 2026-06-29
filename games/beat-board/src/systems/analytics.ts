/**
 * Analytics — BeatBoard's typed wrapper around `data/analytics-service`.
 *
 * Issue beat-board-02-rundot-sdk-integrator owns this file. Every analytics
 * call in BeatBoard product code MUST go through this module — never reach
 * directly into `RundotAPI.analytics`. This is the single funnel where:
 *   - PRD § Analytics Events / § Monetization Analytics shapes are enforced.
 *   - Property keys are normalised to `snake_case` per PRD footnote.
 *   - The first-session conversion funnel step ordering is centralized.
 *
 * The implementation re-uses the installed `data/analytics-service` module so
 * shared Game-Bot reporting (warehouse aggregations, canonical event groups)
 * stays consistent across generated games. PRD-specific schemas are enforced
 * via thin `record*` helpers that fan out to the module's `track*` calls.
 */

import {
  analytics as analyticsModule,
  COMMON_ANALYTICS_EVENT_GROUPS,
  isCanonicalAnalyticsEventName,
  normalizeAnalyticsProperties,
} from '@modules/data/analytics-service/AnalyticsService'
import type {
  AnalyticsProperties,
  AnalyticsPropertyValue,
  CanonicalAnalyticsEventName,
  PlayerIdentityEventProperties,
  SessionEndEventProperties,
} from '@modules/data/analytics-service/types'

// ── Funnel ────────────────────────────────────────────────────────────────

/** Funnel name used by `RundotAPI.analytics.trackFunnelStep`. */
export const BEATBOARD_FUNNEL_NAME = 'beatboard_first_session' as const

/**
 * First-session conversion funnel per PRD § Analytics Events. Step ordering
 * is normative — never reorder without updating prd.md and the warehouse
 * dashboards that read `funnel_step` ordering.
 */
export const BEATBOARD_FUNNEL_STEPS = {
  app_open: 1,
  first_pad_tap: 2,
  first_record: 3,
  mix_saved: 4,
  first_share: 5,
  welcome_pack_offer_shown: 6,
  welcome_pack_purchased: 7,
} as const

export type BeatBoardFunnelStepName = keyof typeof BEATBOARD_FUNNEL_STEPS

// ── Recorded event shapes ─────────────────────────────────────────────────

/** PRD § Analytics Events — `game_opened`. */
export interface GameOpenedProperties extends AnalyticsProperties {
  entry_point: 'cold_start' | 'deep_link' | 'push' | string
}

/** PRD § Analytics Events — `screen_viewed`. */
export interface ScreenViewedProperties extends AnalyticsProperties {
  screen: string
  source?: string
}

/** PRD § Analytics Events — `ftue_started` / `ftue_completed`. */
export interface FtueStartedProperties extends AnalyticsProperties {
  ftue_variant: string
}

export interface FtueCompletedProperties extends AnalyticsProperties {
  ftue_variant: string
  duration_seconds: number
  skipped: boolean
}

// ── Public surface ────────────────────────────────────────────────────────

/**
 * Record a custom analytics event. Property keys are forwarded as-is — callers
 * must already use `snake_case` per the PRD footnote. Use the typed `record*`
 * helpers below for canonical events to get type-checked property shapes.
 */
export function recordCustomEvent(
  name: string,
  properties?: AnalyticsProperties,
): void {
  analyticsModule.track(name, properties)
}

/**
 * Track a step in a named funnel. Defaults to the BeatBoard first-session
 * funnel; pass an explicit funnel name for ad-hoc funnels (rare).
 */
export function trackFunnelStep(
  step: number,
  stepName: string,
  funnelName: string = BEATBOARD_FUNNEL_NAME,
): void {
  analyticsModule.trackFunnel(step, stepName, funnelName)
}

/**
 * Track a step in the BeatBoard first-session funnel using its symbolic name.
 * Strongly preferred over passing raw step numbers from product code.
 */
export function trackBeatBoardFunnelStep(stepName: BeatBoardFunnelStepName): void {
  trackFunnelStep(BEATBOARD_FUNNEL_STEPS[stepName], stepName, BEATBOARD_FUNNEL_NAME)
}

/** PRD § Analytics Events — `game_opened`. */
export function recordGameOpened(properties: GameOpenedProperties): void {
  analyticsModule.trackCanonical('game_opened', properties)
}

/** PRD § Analytics Events — `screen_viewed`. */
export function recordScreenViewed(properties: ScreenViewedProperties): void {
  analyticsModule.trackCanonical('screen_viewed', properties)
}

/** PRD § Analytics Events — `ftue_started`. */
export function recordFtueStarted(properties: FtueStartedProperties): void {
  analyticsModule.trackCanonical('ftue_started', properties)
}

/** PRD § Analytics Events — `ftue_completed`. */
export function recordFtueCompleted(properties: FtueCompletedProperties): void {
  analyticsModule.trackCanonical('ftue_completed', properties)
}

/** PRD § Analytics Events — `session_end`. */
export function recordSessionEnd(properties: SessionEndEventProperties): void {
  analyticsModule.trackSessionEnd(properties)
}

/** PRD § Analytics Events — `player_identity`. */
export function recordPlayerIdentity(properties: PlayerIdentityEventProperties): void {
  analyticsModule.trackPlayerIdentity(properties)
}

// ── Re-exports ────────────────────────────────────────────────────────────

export {
  COMMON_ANALYTICS_EVENT_GROUPS,
  isCanonicalAnalyticsEventName,
  normalizeAnalyticsProperties,
}

export type {
  AnalyticsProperties,
  AnalyticsPropertyValue,
  CanonicalAnalyticsEventName,
  PlayerIdentityEventProperties,
  SessionEndEventProperties,
}
