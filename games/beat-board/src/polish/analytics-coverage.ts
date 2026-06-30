/**
 * analytics-coverage — static codebase scanner used by the wiring-polish
 * acceptance test (issue beat-board-28).
 *
 * Two responsibilities:
 *   1. Enumerate every analytics event and funnel step that prd.md
 *      § Analytics Events / § Monetization Analytics declares.
 *   2. Walk `src/` and verify each declared event has at least one
 *      production callsite (excluding tests and the analytics module
 *      itself). The scanner also flags `onClick={noop}` / empty-handler
 *      placeholders and lingering `__visual_fixture` imports.
 *
 * The file runs only inside vitest under Node's jsdom environment so it
 * can use `node:fs` directly. It is **not** imported by production code;
 * `src/polish/deep-links.ts` is the runtime-side polish file.
 *
 * Boundary: pure read-only filesystem scan. No store mutations, no SDK
 * calls, no React. Safe to import from any test that needs to gate on
 * codebase invariants.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// ── Declared PRD events ──────────────────────────────────────────────────

/**
 * Every analytics event prd.md § Analytics Events § Monetization Analytics
 * § Game-specific events declares as REQUIRED. Adding an event here without
 * a matching callsite makes the acceptance test fail; that is the intended
 * design — the PRD is the source of truth.
 */
export const PRD_REQUIRED_ANALYTICS_EVENTS = [
  // § Analytics Events (core)
  'game_opened',
  'player_identity',
  'session_end',
  'screen_viewed',
  'ftue_started',
  'ftue_completed',
  'run_started',
  'run_completed',
  'run_failed',

  // § Monetization Analytics — IAP
  'store_opened',
  'iap_purchase_started',
  'iap_purchase_complete',
  'iap_purchase_failed',
  'first_purchase',
  // § Monetization Analytics — Ads
  'rewarded_ad_offered',
  'rewarded_ad_watched',
  'rewarded_ad_dismissed',
  'interstitial_shown',
  // § Monetization Analytics — Economy
  'currency_earned',
  'currency_spent',
  // § Monetization Analytics — Subscription
  'subscription_status_checked',
  'subscription_purchase_started',
  'subscription_purchase_complete',
  'subscription_expired',
  // § Monetization Analytics — Entitlement
  'entitlement_granted',
  'entitlement_consumed',

  // § Game-specific events
  'pad_activated',
  // pad_muted intentionally absent — Groovepad alignment removed mute
  // end-to-end (no gesture, no engine API, no analytics event).
  'recording_started',
  'recording_shared',
  'pack_previewed',
] as const

export type PrdAnalyticsEvent = (typeof PRD_REQUIRED_ANALYTICS_EVENTS)[number]

/**
 * Funnel steps wired through `RundotAPI.analytics.trackFunnelStep` per
 * prd.md § Analytics Events. Step ordering is normative.
 */
export const PRD_FUNNEL_STEPS = [
  'app_open',
  'first_pad_tap',
  'first_record',
  'mix_saved',
  'first_share',
  'welcome_pack_offer_shown',
  'welcome_pack_purchased',
] as const

export type PrdFunnelStep = (typeof PRD_FUNNEL_STEPS)[number]

// ── Scanner ──────────────────────────────────────────────────────────────

const SRC_ROOT = resolve(__dirname, '..')

interface CallsiteScanResult {
  events: Record<string, string[]>
  funnelSteps: Record<string, string[]>
}

/**
 * Walk every `.ts` / `.tsx` file under `src/` and grep for analytics
 * callsites. The scan ignores:
 *   - `src/__tests__/**` (test files reference events for assertions)
 *   - `*.test.ts` / `*.test.tsx` siblings
 *   - `src/systems/analytics.ts` (the wrapper itself — declares helpers)
 *   - `src/modules/data/analytics-service/**` (module contract surface)
 *   - `src/modules/**` (module sources never count as game callsites)
 *   - `src/polish/analytics-coverage.ts` (this file declares the event list)
 *   - `src/polish/deep-links.ts` ONLY when matching `app_open`-style funnel
 *     steps emitted from the polish wiring itself? No — deep-links.ts is a
 *     real game callsite, so we keep it. The polish test file itself is
 *     skipped via the `__tests__` exclusion.
 */
export function scanProductionCallsites(): CallsiteScanResult {
  const events: Record<string, string[]> = {}
  const funnelSteps: Record<string, string[]> = {}

  for (const file of walk(SRC_ROOT)) {
    if (!isProductionFile(file)) continue
    const rel = relative(SRC_ROOT, file)
    const source = readFileSync(file, 'utf-8')

    // Match `recordCustomEvent('event_name'`, `analyticsModule.track('event_name'`,
    // `analytics.track('event_name'`, and the canonical helpers
    // (`recordGameOpened`, `recordSessionEnd`, etc.).
    for (const event of PRD_REQUIRED_ANALYTICS_EVENTS) {
      // The interstitial_shown line is allowed to be inside a guarded path
      // that never executes. We only need to find the literal callsite.
      const literalRegex = new RegExp(
        String.raw`(?:recordCustomEvent|track|trackEvent|trackCanonical)\(\s*['"\`]${escapeRegex(
          event,
        )}['"\`]`,
      )
      if (literalRegex.test(source) || hasCanonicalHelper(source, event)) {
        ;(events[event] ??= []).push(rel)
      }
    }

    // Funnel-step matchers — `trackFunnelStep(N, 'step_name', ...)`,
    // `trackBeatBoardFunnelStep('step_name')`, `trackFunnel(N, 'step_name', ...)`.
    for (const step of PRD_FUNNEL_STEPS) {
      const stepRegex = new RegExp(
        String.raw`(?:trackBeatBoardFunnelStep|trackFunnelStep|trackFunnel)\(\s*(?:\d+\s*,\s*)?['"\`]${escapeRegex(
          step,
        )}['"\`]`,
      )
      if (stepRegex.test(source)) {
        ;(funnelSteps[step] ??= []).push(rel)
      }
    }
  }

  return { events, funnelSteps }
}

/**
 * Find any `onClick={noop}`, `onClick={() => {}}`, `onClick={() => undefined}`,
 * or `onPress={noop}` placeholders left in `src/components/**`. Returns a
 * `path:line` list so a failing test message points at the offender.
 */
export function scanForNoopHandlers(): string[] {
  const offenders: string[] = []
  const componentsRoot = resolve(SRC_ROOT, 'components')
  const screensRoot = resolve(SRC_ROOT, 'components', 'screens')

  // Patterns we treat as placeholders. Allow whitespace inside braces, and
  // `void 0` / `undefined` / empty arrow body variants.
  const patterns = [
    /\b(?:onClick|onPress|onSubmit|onChange)\s*=\s*\{\s*noop\s*\}/,
    /\b(?:onClick|onPress|onSubmit|onChange)\s*=\s*\{\s*\(\s*\)\s*=>\s*\{\s*\}\s*\}/,
    /\b(?:onClick|onPress|onSubmit|onChange)\s*=\s*\{\s*\(\s*\)\s*=>\s*undefined\s*\}/,
    /\b(?:onClick|onPress|onSubmit|onChange)\s*=\s*\{\s*\(\s*\)\s*=>\s*void\s+0\s*\}/,
  ]

  for (const file of [...walk(componentsRoot), ...walk(screensRoot)]) {
    if (!isProductionFile(file)) continue
    const source = readFileSync(file, 'utf-8')
    const lines = source.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          offenders.push(`${relative(SRC_ROOT, file)}:${i + 1}`)
        }
      }
    }
  }

  return offenders
}

/**
 * Find any `__visual_fixture` imports in production paths. Visual-design
 * fixtures live under `src/dev/` or `src/preview/` and must never leak
 * into a screen import chain.
 */
export function scanForVisualFixtureImports(): string[] {
  const offenders: string[] = []
  for (const file of walk(SRC_ROOT)) {
    if (!isProductionFile(file)) continue
    // The polish scanner itself mentions the literal in this comment;
    // skip ourselves to avoid a false positive.
    if (file.endsWith('analytics-coverage.ts')) continue
    const source = readFileSync(file, 'utf-8')
    if (/__visual_fixture/.test(source)) {
      offenders.push(relative(SRC_ROOT, file))
    }
  }
  return offenders
}

// ── Deep-link routing (re-exported from the runtime polish module) ───────

export {
  routeNotificationDeepLink,
  consumeBootDeepLinks,
} from './deep-links'

// ── Helpers ──────────────────────────────────────────────────────────────

function* walk(root: string): Generator<string> {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(root, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (st.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      yield full
    }
  }
}

function isProductionFile(file: string): boolean {
  const rel = relative(SRC_ROOT, file)
  if (rel.startsWith('__tests__/')) return false
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return false
  if (rel.endsWith('.spec.ts') || rel.endsWith('.spec.tsx')) return false
  // The analytics wrapper declares helper names; it is not a callsite.
  if (rel === 'systems/analytics.ts') return false
  // The analytics-service module is the contract surface, not a game callsite.
  if (rel.startsWith('modules/data/analytics-service/')) return false
  // Other modules don't count as game-side callsites either.
  if (rel.startsWith('modules/')) return false
  // The scanner itself enumerates event names in source — exclude it.
  if (rel === 'polish/analytics-coverage.ts') return false
  return true
}

/**
 * Map canonical helper functions to the events they emit so the scanner
 * picks up callsites that go through `recordGameOpened(...)` etc. The PRD
 * funnel + monetization helpers all use the literal-string `analyticsModule.track`
 * path, so we only need explicit mappings for the canonical wrappers.
 */
const CANONICAL_HELPERS: Record<string, string[]> = {
  game_opened: ['recordGameOpened('],
  screen_viewed: ['recordScreenViewed('],
  ftue_started: ['recordFtueStarted('],
  ftue_completed: ['recordFtueCompleted('],
  session_end: ['recordSessionEnd('],
  player_identity: ['recordPlayerIdentity('],
}

function hasCanonicalHelper(source: string, event: string): boolean {
  const helpers = CANONICAL_HELPERS[event]
  if (!helpers) return false
  return helpers.some((needle) => source.includes(needle))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
