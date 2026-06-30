/**
 * Acceptance tests for issue beat-board-08-entitlements-and-trial-ttl.
 *
 * Each acceptance criterion in the issue body maps to one or more `it()`
 * blocks. Tests exercise the real `entitlementsStore` + `pack-trial-ttl`
 * engine directly with the SDK mocked (per __tests__/setup.ts) and a
 * controllable server-time clock — no React rendering, no Playwright.
 *
 * The store is a thin BeatBoard wrapper around the underlying
 * `monetization/entitlements-service` module:
 *   - `ownsPack` / `isTrialActive` / `trialRemainingSeconds` / `subscriberKitGranted`
 *   - `grantEntitlement('pack_owned_<id>')` permanent unlock
 *   - `grantEntitlement('pack_trial_<id>', { ttlSeconds })` 24h trial
 *   - revoke + analytics fan-out
 *
 * The TTL manager owns:
 *   - Per-pack remaining-seconds math (server-time aware)
 *   - 1h-before `trial_expiring` event (single-fire per trial)
 *   - Auto-revocation + `entitlement_consumed` analytics on expiry
 *   - `formatRemaining()` human-readable formatter
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_OWNED_PREFIX,
  PACK_TRIAL_PREFIX,
  TRIAL_TTL_SECONDS,
  SUBSCRIBER_KIT_ITEM_ID,
} from '../stores/entitlementsStore'
import {
  createPackTrialTtlManager,
  formatRemaining,
  TRIAL_EXPIRING_LEAD_SECONDS,
  TRIAL_EXPIRING_EVENT,
  TRIAL_EXPIRED_EVENT,
  type PackTrialTtlManager,
  type PackTrialTtlDeps,
} from '../systems/pack-trial-ttl'
import { analytics as analyticsModule } from '../modules/data/analytics-service/AnalyticsService'
import { subscriptionStore } from '../modules/monetization/subscription-vip/SubscriptionVip'

// ── Test helpers ─────────────────────────────────────────────────────────

function makeDeps(overrides?: Partial<PackTrialTtlDeps>): PackTrialTtlDeps & {
  setNowMs: (ms: number) => void
  events: Array<{ name: string; payload: { packId: string; itemId: string } }>
} {
  let nowMs = 1_700_000_000_000 // fixed epoch baseline
  const events: Array<{ name: string; payload: { packId: string; itemId: string } }> = []
  return {
    nowMs: () => nowMs,
    setNowMs(ms: number) {
      nowMs = ms
    },
    emit: (name, payload) => {
      events.push({ name, payload })
    },
    events,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetEntitlementsStore()
  subscriptionStore.getState().reset()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── ownership + trial wrappers ───────────────────────────────────────────

describe('accept: entitlementsStore typed wrappers', () => {
  it('ownsPack returns true for permanent pack_owned_<id> entitlement', () => {
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_OWNED_PREFIX}lofi_heights`)
    expect(useEntitlementsStore.getState().ownsPack('lofi_heights')).toBe(true)
    expect(useEntitlementsStore.getState().ownsPack('not_owned')).toBe(false)
  })

  it('isTrialActive is true while a pack_trial_<id> entitlement has remaining time', () => {
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })
    expect(useEntitlementsStore.getState().isTrialActive('trap_house')).toBe(true)
    expect(useEntitlementsStore.getState().isTrialActive('lofi_heights')).toBe(false)
  })

  it('trialRemainingSeconds counts down from the grant timestamp', () => {
    const nowMs = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })

    expect(useEntitlementsStore.getState().trialRemainingSeconds('trap_house')).toBe(
      TRIAL_TTL_SECONDS,
    )

    vi.spyOn(Date, 'now').mockReturnValue(nowMs + 60 * 60 * 1000) // +1h
    expect(
      useEntitlementsStore.getState().trialRemainingSeconds('trap_house'),
    ).toBeCloseTo(TRIAL_TTL_SECONDS - 3600, 0)
  })

  it('trialRemainingSeconds returns 0 for a non-trial / unknown pack', () => {
    expect(useEntitlementsStore.getState().trialRemainingSeconds('unknown')).toBe(0)
  })

  it('subscriberKitGranted reads from subscription benefit', () => {
    expect(useEntitlementsStore.getState().subscriberKitGranted()).toBe(false)
    subscriptionStore.getState().syncFromPlatform('CORE')
    expect(useEntitlementsStore.getState().subscriberKitGranted()).toBe(true)
  })
})

// ── grant + analytics ────────────────────────────────────────────────────

describe('accept: grantEntitlement analytics + TTL', () => {
  it('grantEntitlement(pack_owned_*) sets a permanent (no-TTL) entitlement', () => {
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_OWNED_PREFIX}lofi_heights`)
    const ent = useEntitlementsStore.getState().get(`${PACK_OWNED_PREFIX}lofi_heights`)
    expect(ent).toBeTruthy()
    expect(ent?.expiresAt).toBeNull()
    expect(ent?.consumable).toBe(false)
    expect(ent?.quantity).toBe(1)
  })

  it('grantEntitlement(pack_trial_*) writes a 24h TTL entitlement with absolute expiresAt', () => {
    const nowMs = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(nowMs)
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })
    const ent = useEntitlementsStore.getState().get(`${PACK_TRIAL_PREFIX}trap_house`)
    expect(ent?.expiresAt).toBe(nowMs + TRIAL_TTL_SECONDS * 1000)
    expect(ent?.consumable).toBe(true)
    expect(ent?.quantity).toBe(1)
  })

  it('grantEntitlement fires entitlement_granted analytics with itemId/quantity/source', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
      source: 'rewarded_ad',
    })
    expect(trackSpy).toHaveBeenCalledWith('entitlement_granted', {
      item_id: `${PACK_TRIAL_PREFIX}trap_house`,
      quantity: 1,
      source: 'rewarded_ad',
    })
  })

  it('revoke(itemId) removes the entitlement and fires entitlement_consumed analytics', () => {
    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })
    store.revoke(`${PACK_TRIAL_PREFIX}trap_house`, 'expired')
    expect(useEntitlementsStore.getState().get(`${PACK_TRIAL_PREFIX}trap_house`)).toBeUndefined()
    expect(trackSpy).toHaveBeenCalledWith('entitlement_consumed', {
      item_id: `${PACK_TRIAL_PREFIX}trap_house`,
      quantity: 1,
      reason: 'expired',
    })
  })
})

// ── formatRemaining ──────────────────────────────────────────────────────

describe('accept: formatRemaining edge cases', () => {
  it('formats hours + minutes for 1h-or-more remaining', () => {
    expect(formatRemaining(23 * 3600 + 42 * 60)).toBe('23h 42m left')
    expect(formatRemaining(60 * 60)).toBe('1h 0m left')
    expect(formatRemaining(60 * 60 + 1)).toBe('1h 0m left')
  })

  it('formats minutes only when remaining < 1h', () => {
    expect(formatRemaining(57 * 60)).toBe('57m left')
    expect(formatRemaining(60)).toBe('1m left')
  })

  it('returns "Less than 1m" for sub-minute remaining', () => {
    expect(formatRemaining(59)).toBe('Less than 1m')
    expect(formatRemaining(0)).toBe('Less than 1m')
    expect(formatRemaining(-10)).toBe('Less than 1m')
  })
})

// ── pack-trial-ttl manager ───────────────────────────────────────────────

describe('accept: pack-trial-ttl manager', () => {
  it('emits trial_expiring once, exactly 1 hour before TTL expires', () => {
    const deps = makeDeps()
    deps.setNowMs(1_700_000_000_000)
    const grantNow = deps.nowMs()
    vi.spyOn(Date, 'now').mockImplementation(() => deps.nowMs())

    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })

    const ttl: PackTrialTtlManager = createPackTrialTtlManager(deps)
    ttl.start()

    // Tick at +22h → still > 1h remaining; no event yet.
    deps.setNowMs(grantNow + 22 * 3600 * 1000)
    ttl.tick()
    expect(deps.events.filter((e) => e.name === TRIAL_EXPIRING_EVENT)).toHaveLength(0)

    // Tick at +23h01m → < 1h remaining; trial_expiring fires.
    deps.setNowMs(grantNow + (23 * 3600 + 60) * 1000)
    ttl.tick()
    const expiring = deps.events.filter((e) => e.name === TRIAL_EXPIRING_EVENT)
    expect(expiring).toHaveLength(1)
    expect(expiring[0].payload.packId).toBe('trap_house')
    expect(expiring[0].payload.itemId).toBe(`${PACK_TRIAL_PREFIX}trap_house`)

    // Tick again still < 1h — must NOT re-fire (single-shot per trial).
    deps.setNowMs(grantNow + (23 * 3600 + 30 * 60) * 1000)
    ttl.tick()
    expect(deps.events.filter((e) => e.name === TRIAL_EXPIRING_EVENT)).toHaveLength(1)

    ttl.stop()
  })

  it('TRIAL_EXPIRING_LEAD_SECONDS is 1 hour per prd.md', () => {
    expect(TRIAL_EXPIRING_LEAD_SECONDS).toBe(3600)
  })

  it('on expiry: revokes the entitlement, emits trial_expired, fires entitlement_consumed analytics', () => {
    const deps = makeDeps()
    deps.setNowMs(1_700_000_000_000)
    const grantNow = deps.nowMs()
    vi.spyOn(Date, 'now').mockImplementation(() => deps.nowMs())

    const store = useEntitlementsStore.getState()
    store.grantEntitlement(`${PACK_TRIAL_PREFIX}trap_house`, {
      ttlSeconds: TRIAL_TTL_SECONDS,
    })

    const trackSpy = vi.spyOn(analyticsModule, 'track')
    const ttl = createPackTrialTtlManager(deps)
    ttl.start()

    // Tick 1ms past expiry.
    deps.setNowMs(grantNow + (TRIAL_TTL_SECONDS + 1) * 1000)
    ttl.tick()

    expect(
      useEntitlementsStore.getState().get(`${PACK_TRIAL_PREFIX}trap_house`),
    ).toBeUndefined()
    expect(deps.events.find((e) => e.name === TRIAL_EXPIRED_EVENT)?.payload.packId).toBe(
      'trap_house',
    )
    expect(trackSpy).toHaveBeenCalledWith('entitlement_consumed', {
      item_id: `${PACK_TRIAL_PREFIX}trap_house`,
      quantity: 1,
      reason: 'expired',
    })
    ttl.stop()
  })

  it('decrements remainingSeconds across ticks', () => {
    const deps = makeDeps()
    deps.setNowMs(1_700_000_000_000)
    const grantNow = deps.nowMs()
    vi.spyOn(Date, 'now').mockImplementation(() => deps.nowMs())

    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )

    const ttl = createPackTrialTtlManager(deps)
    ttl.start()

    expect(ttl.remainingSeconds('trap_house')).toBe(TRIAL_TTL_SECONDS)

    deps.setNowMs(grantNow + 60 * 1000)
    expect(ttl.remainingSeconds('trap_house')).toBeCloseTo(TRIAL_TTL_SECONDS - 60, 0)

    deps.setNowMs(grantNow + 5 * 3600 * 1000)
    expect(ttl.remainingSeconds('trap_house')).toBeCloseTo(
      TRIAL_TTL_SECONDS - 5 * 3600,
      0,
    )

    ttl.stop()
  })

  it('start() schedules a once-per-minute interval (UI cadence per prd.md)', () => {
    vi.useFakeTimers()
    const deps = makeDeps()
    deps.setNowMs(1_700_000_000_000)
    const grantNow = deps.nowMs()
    vi.spyOn(Date, 'now').mockImplementation(() => deps.nowMs())

    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )

    const ttl = createPackTrialTtlManager(deps)
    ttl.start()

    // Advance fake time AND the deps clock so the engine sees the same wall.
    deps.setNowMs(grantNow + (23 * 3600 + 60) * 1000)
    vi.advanceTimersByTime(60_000)

    // After one minute the engine ticked at least once and the trial_expiring
    // event was emitted (we crossed the 1h-remaining threshold).
    expect(deps.events.filter((e) => e.name === TRIAL_EXPIRING_EVENT).length).toBeGreaterThan(
      0,
    )

    ttl.stop()
  })
})

// ── subscriber kit ───────────────────────────────────────────────────────

describe('accept: subscriber kit recurring entitlement', () => {
  it('subscriberKitGranted is gated on an active subscription tier', () => {
    expect(useEntitlementsStore.getState().subscriberKitGranted()).toBe(false)

    subscriptionStore.getState().syncFromPlatform('PLUS')
    expect(useEntitlementsStore.getState().subscriberKitGranted()).toBe(true)

    subscriptionStore.getState().syncFromPlatform(null)
    expect(useEntitlementsStore.getState().subscriberKitGranted()).toBe(false)
  })

  it('SUBSCRIBER_KIT_ITEM_ID is exported and stable', () => {
    expect(SUBSCRIBER_KIT_ITEM_ID).toMatch(/^subscriber_kit_/)
  })
})
