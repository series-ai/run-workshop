/**
 * Acceptance: beat-board-28-wiring-polish
 *
 * Cross-feature wiring polish:
 *   - Both PRD-defined deep-link types resolve to the correct screen.
 *   - No `onClick={noop}` placeholders or fixture-store imports remain in
 *     production code.
 *   - Every PRD analytics event has at least one `recordCustomEvent` /
 *     `analyticsModule.track` callsite.
 *   - The first-session conversion funnel is wired end-to-end.
 *
 * The "no placeholders" and "analytics coverage" sweeps are implemented as
 * a static codebase scan in `src/polish/analytics-coverage.ts`. The tests
 * call those scanners and assert empty/expected results.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useNavigationStore } from '../stores/navigationStore'
import { useMixesStore } from '../stores/mixesStore'
import { useKitsStore } from '../stores/kitsStore'
import {
  PRD_REQUIRED_ANALYTICS_EVENTS,
  PRD_FUNNEL_STEPS,
  scanProductionCallsites,
  scanForNoopHandlers,
  scanForVisualFixtureImports,
  routeNotificationDeepLink,
  consumeBootDeepLinks,
} from '../polish/analytics-coverage'

beforeEach(() => {
  // Reset navigation store to a known state.
  useNavigationStore.getState().configure({
    initial: 'play',
    screens: {
      play: { id: 'play', type: 'tab', render: () => null },
      mixes: { id: 'mixes', type: 'tab', render: () => null },
      packs: { id: 'packs', type: 'tab', render: () => null },
    },
  })
  useNavigationStore.setState({
    activeTab: 'play',
    stack: [],
    modalStack: [],
    focusedMixId: null,
    importedFocusedMix: false,
  })
  // Clear mixes store
  useMixesStore.setState({ mixes: [], unviewedCount: 0 })
})

// ── Deep-link routing ─────────────────────────────────────────────────────

describe.skip('accept: deep-link routing', () => {
  it('idle_reminder notification id routes to Play tab', () => {
    useKitsStore.getState().setActiveKit('lofi_heights')
    routeNotificationDeepLink('beatboard.idle_after_first_record')
    expect(useNavigationStore.getState().activeTab).toBe('play')
  })

  it('share_link_received via consumeBootDeepLinks routes to Mixes', async () => {
    // Simulate a boot-time share launch intent with an incoming share payload.
    const sharePayload = {
      mixId: 'mix-import-1',
      kitId: 'lofi_heights',
      durationSeconds: 16,
    }
    vi.mocked(RundotAPI.app.resolveLaunchIntent).mockResolvedValue({
      kind: 'share',
      shareLinkId: 'share-link-1',
      params: {
        mixId: sharePayload.mixId,
        kitId: sharePayload.kitId,
        durationSeconds: String(sharePayload.durationSeconds),
      },
    })

    await consumeBootDeepLinks()

    expect(useNavigationStore.getState().activeTab).toBe('mixes')
    expect(useNavigationStore.getState().focusedMixId).toBe('mix-import-1')
    expect(useNavigationStore.getState().importedFocusedMix).toBe(true)
  })

  it('routeNotificationDeepLink ignores unknown ids without throwing', () => {
    expect(() => routeNotificationDeepLink('unknown.id')).not.toThrow()
  })
})

// ── Placeholder sweep ─────────────────────────────────────────────────────

describe.skip('accept: placeholder sweep', () => {
  it('no onClick={noop} placeholders remain in src/components/**', () => {
    const offenders = scanForNoopHandlers()
    expect(offenders).toEqual([])
  })

  it('no __visual_fixture imports remain in production paths', () => {
    const offenders = scanForVisualFixtureImports()
    expect(offenders).toEqual([])
  })
})

// ── Analytics coverage ────────────────────────────────────────────────────

describe.skip('accept: analytics coverage', () => {
  it('every PRD-required analytics event has at least one production callsite', () => {
    const callsites = scanProductionCallsites()
    const missing: string[] = []
    for (const eventName of PRD_REQUIRED_ANALYTICS_EVENTS) {
      const sites = callsites.events[eventName] ?? []
      if (sites.length === 0) missing.push(eventName)
    }
    expect(missing).toEqual([])
  })

  it('every funnel step in the BeatBoard first-session funnel has a callsite', () => {
    const callsites = scanProductionCallsites()
    const missing: string[] = []
    for (const step of PRD_FUNNEL_STEPS) {
      const sites = callsites.funnelSteps[step] ?? []
      if (sites.length === 0) missing.push(step)
    }
    expect(missing).toEqual([])
  })

  it('app_open funnel step fires on boot', async () => {
    const trackFunnelSpy = RundotAPI.analytics.trackFunnelStep as unknown as ReturnType<
      typeof vi.fn
    >
    trackFunnelSpy.mockClear()

    // The wiring publishes `app_open` from src/polish/deep-links.ts on import.
    // Re-import to drive the side effect under fresh mocks.
    vi.resetModules()
    const mod = await import('../polish/deep-links')
    mod.fireAppOpenFunnelStep()

    const calls = trackFunnelSpy.mock.calls.filter((c) => c[1] === 'app_open')
    expect(calls.length).toBeGreaterThanOrEqual(1)
  })

  it('interstitial_shown has a guarded production callsite (never reached in v1)', () => {
    const callsites = scanProductionCallsites()
    const sites = callsites.events['interstitial_shown'] ?? []
    expect(sites.length).toBeGreaterThanOrEqual(1)
  })

  it('recording_started game-specific event has a production callsite', () => {
    const callsites = scanProductionCallsites()
    const sites = callsites.events['recording_started'] ?? []
    expect(sites.length).toBeGreaterThanOrEqual(1)
  })
})
