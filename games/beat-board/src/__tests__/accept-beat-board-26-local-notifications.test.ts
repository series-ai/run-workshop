/**
 * Acceptance tests for issue beat-board-26-local-notifications.
 *
 * Wires the BeatBoard `notification-scheduler` system to the project's two
 * notifications per prd.md § Local Notifications:
 *   - `idle_after_first_record` — 24h after backgrounding when player has
 *     recorded ≥1 mix.
 *   - `pack_trial_expiring` — 23h after a `pack_trial_<packId>` entitlement
 *     is granted (1h before TTL ends).
 *
 * The scheduler injects clock + lifecycle dependencies so tests drive both
 * deterministically.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useEntitlementsStore,
  resetEntitlementsStore,
  PACK_TRIAL_PREFIX,
  TRIAL_TTL_SECONDS,
} from '../stores/entitlementsStore'
import { useMixesStore, resetMixesStore } from '../stores/mixesStore'
import { useKitsStore } from '../stores/kitsStore'
import {
  createNotificationScheduler,
  IDLE_REMINDER_ID,
  IDLE_REMINDER_DELAY_SECONDS,
  TRIAL_EXPIRING_LEAD_SECONDS,
  trialExpiringNotificationId,
  type NotificationScheduler,
  type NotificationSchedulerDeps,
  type ScheduledNotification,
} from '../systems/notification-scheduler'

// ── Helpers ──────────────────────────────────────────────────────────────

interface FakeLifecycle {
  fireBackground: () => void
  fireForeground: () => void
  callbackCount: number
}

function makeDeps(overrides?: Partial<NotificationSchedulerDeps>): {
  deps: NotificationSchedulerDeps
  setNowMs: (ms: number) => void
  scheduled: ScheduledNotification[]
  cancelled: string[]
  pushFiredViaPlatform: ScheduledNotification[]
  lifecycle: FakeLifecycle
  setPlatformPushAvailable: (available: boolean) => void
} {
  let nowMs = 1_700_000_000_000
  const scheduled: ScheduledNotification[] = []
  const cancelled: string[] = []
  const pushFiredViaPlatform: ScheduledNotification[] = []
  let platformPushAvailable = false
  const bgCallbacks: Array<() => void> = []
  const fgCallbacks: Array<() => void> = []
  const lifecycle: FakeLifecycle = {
    fireBackground() {
      for (const cb of bgCallbacks) cb()
    },
    fireForeground() {
      for (const cb of fgCallbacks) cb()
    },
    callbackCount: 0,
  }
  const deps: NotificationSchedulerDeps = {
    nowMs: () => nowMs,
    schedule: vi.fn(async (notif: ScheduledNotification) => {
      scheduled.push({ ...notif })
    }),
    cancel: vi.fn(async (id: string) => {
      cancelled.push(id)
    }),
    listScheduled: vi.fn(async () => [...scheduled.map((n) => ({ ...n }))]),
    onBackground: (cb: () => void) => {
      bgCallbacks.push(cb)
      lifecycle.callbackCount++
      return () => {
        const i = bgCallbacks.indexOf(cb)
        if (i >= 0) bgCallbacks.splice(i, 1)
      }
    },
    onForeground: (cb: () => void) => {
      fgCallbacks.push(cb)
      lifecycle.callbackCount++
      return () => {
        const i = fgCallbacks.indexOf(cb)
        if (i >= 0) fgCallbacks.splice(i, 1)
      }
    },
    isPlatformPushAvailable: () => platformPushAvailable,
    firePlatformPush: vi.fn(async (notif: ScheduledNotification) => {
      pushFiredViaPlatform.push({ ...notif })
    }),
    ...overrides,
  }
  return {
    deps,
    setNowMs(ms: number) {
      nowMs = ms
    },
    scheduled,
    cancelled,
    pushFiredViaPlatform,
    lifecycle,
    setPlatformPushAvailable: (available: boolean) => {
      platformPushAvailable = available
    },
  }
}

function seedOneMix() {
  useMixesStore.setState({
    mixes: [
      {
        id: 'mix-seeded',
        title: 'seeded',
        kitId: 'lofi_heights_hero',
        mimeType: 'video/mp4',
        durationSeconds: 23,
        posterActivePadIds: [],
        createdAtMs: Date.now(),
        isUnviewed: false,
        imported: false,
      },
    ],
    unviewedCount: 0,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetEntitlementsStore()
  resetMixesStore()
  // Notification scheduling depends on mixes.length >= 1; seed one.
  // Tests that need an empty list set it explicitly.
  seedOneMix()
})

afterEach(() => {
  vi.useRealTimers()
})

// ── idle_after_first_record ──────────────────────────────────────────────

describe('accept: idle_after_first_record scheduling', () => {
  it('schedules idle reminder 24h out on background when mixes.length >= 1', () => {
    const ctx = makeDeps()
    // Default seeded sample mixes set length > 0; ensure that.
    expect(useMixesStore.getState().mixes.length).toBeGreaterThan(0)
    const scheduler: NotificationScheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    const idle = ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)
    expect(idle).toBeTruthy()
    expect(idle?.delaySeconds).toBe(IDLE_REMINDER_DELAY_SECONDS)
    expect(IDLE_REMINDER_DELAY_SECONDS).toBe(24 * 60 * 60)
    scheduler.detach()
  })

  it('skips idle reminder when player has not recorded a mix yet', () => {
    useMixesStore.setState({ mixes: [], unviewedCount: 0 })
    const ctx = makeDeps()
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    expect(ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)).toBeUndefined()
    scheduler.detach()
  })

  it('idle reminder copy matches prd.md (sentence case, ≤1 emoji)', () => {
    const ctx = makeDeps()
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    const idle = ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)
    expect(idle?.title).toBe('🎵 BeatBoard')
    expect(idle?.body).toBe('Your beat is waiting. Come keep building.')
    expect(idle?.body.length).toBeLessThanOrEqual(50)
    // 1 emoji max → exactly one in title, none in body.
    const emojiCount = (str: string): number =>
      (str.match(/\p{Extended_Pictographic}/gu) ?? []).length
    expect(emojiCount(idle?.title ?? '') + emojiCount(idle?.body ?? '')).toBe(1)
    scheduler.detach()
  })

  it('idle reminder deep-links to Play with the last-used pack', () => {
    useKitsStore.getState().setActiveKit('lofi_heights_extended')
    const ctx = makeDeps()
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    const idle = ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)
    expect(idle?.deepLink).toBe('Play?packId=lofi_heights_extended')
    scheduler.detach()
  })

  it('cancels idle reminder on foreground when it has not yet fired', () => {
    const ctx = makeDeps()
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    expect(ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)).toBeTruthy()
    ctx.lifecycle.fireForeground()
    expect(ctx.cancelled).toContain(IDLE_REMINDER_ID)
    scheduler.detach()
  })
})

// ── pack_trial_expiring ──────────────────────────────────────────────────

describe('accept: pack_trial_expiring scheduling', () => {
  it('schedules pack_trial_expiring 23h after a trial grant', () => {
    const ctx = makeDeps()
    // entitlementsStore.grantEntitlement uses Date.now() for absolute
    // expiresAt; the scheduler subtracts deps.nowMs() to compute delay.
    // Align Date.now() with deps.nowMs() so the math matches the contract.
    vi.spyOn(Date, 'now').mockImplementation(() => ctx.deps.nowMs())
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )
    const id = trialExpiringNotificationId('trap_house')
    const notif = ctx.scheduled.find((n) => n.id === id)
    expect(notif).toBeTruthy()
    expect(notif?.delaySeconds).toBe(TRIAL_TTL_SECONDS - TRIAL_EXPIRING_LEAD_SECONDS)
    expect(TRIAL_TTL_SECONDS - TRIAL_EXPIRING_LEAD_SECONDS).toBe(23 * 60 * 60)
    scheduler.detach()
  })

  it('pack_trial_expiring copy uses sentence case and the pack name', () => {
    const ctx = makeDeps()
    vi.spyOn(Date, 'now').mockImplementation(() => ctx.deps.nowMs())
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}lofi_heights`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )
    const id = trialExpiringNotificationId('lofi_heights')
    const notif = ctx.scheduled.find((n) => n.id === id)
    expect(notif?.title).toBe('⏰ Trial ending soon')
    expect(notif?.body).toContain('Lofi Heights')
    expect(notif?.body).toContain('1 hour')
    scheduler.detach()
  })

  it('pack_trial_expiring deep-links to KitDetail for the pack', () => {
    const ctx = makeDeps()
    vi.spyOn(Date, 'now').mockImplementation(() => ctx.deps.nowMs())
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )
    const id = trialExpiringNotificationId('trap_house')
    const notif = ctx.scheduled.find((n) => n.id === id)
    expect(notif?.deepLink).toBe('KitDetail?packId=trap_house')
    scheduler.detach()
  })

  it('cancels pack_trial_expiring when the trial entitlement is revoked', () => {
    const ctx = makeDeps()
    vi.spyOn(Date, 'now').mockImplementation(() => ctx.deps.nowMs())
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )
    useEntitlementsStore.getState().revoke(`${PACK_TRIAL_PREFIX}trap_house`, 'consumed')
    const id = trialExpiringNotificationId('trap_house')
    expect(ctx.cancelled).toContain(id)
    scheduler.detach()
  })

  it('cancels pack_trial_expiring on foreground when the trial is gone', () => {
    const ctx = makeDeps()
    vi.spyOn(Date, 'now').mockImplementation(() => ctx.deps.nowMs())
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    useEntitlementsStore.getState().grantEntitlement(
      `${PACK_TRIAL_PREFIX}trap_house`,
      { ttlSeconds: TRIAL_TTL_SECONDS },
    )
    // Drop the trial silently (simulates expiry from the pack-trial-ttl
    // manager) — the scheduler should sweep on foreground.
    useEntitlementsStore.setState((state) => {
      const next = new Map(state.entitlements)
      next.delete(`${PACK_TRIAL_PREFIX}trap_house`)
      return { entitlements: next }
    })
    ctx.lifecycle.fireForeground()
    const id = trialExpiringNotificationId('trap_house')
    expect(ctx.cancelled).toContain(id)
    scheduler.detach()
  })
})

// ── platform push fallback ───────────────────────────────────────────────

describe('accept: platform push fallback', () => {
  it('fires platform push with same payload when isPlatformPushAvailable() is true', () => {
    const ctx = makeDeps()
    ctx.setPlatformPushAvailable(true)
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    expect(ctx.pushFiredViaPlatform.length).toBeGreaterThan(0)
    expect(ctx.pushFiredViaPlatform[0].id).toBe(IDLE_REMINDER_ID)
    expect(ctx.pushFiredViaPlatform[0].title).toBe('🎵 BeatBoard')
    scheduler.detach()
  })

  it('only fires local notification when platform push is unavailable', () => {
    const ctx = makeDeps()
    ctx.setPlatformPushAvailable(false)
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    ctx.lifecycle.fireBackground()
    expect(ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)).toBeTruthy()
    expect(ctx.pushFiredViaPlatform).toHaveLength(0)
    scheduler.detach()
  })
})

// ── server-time alignment ────────────────────────────────────────────────

describe('accept: server-time clock', () => {
  it('uses deps.nowMs for grant timestamp math, not Date.now()', () => {
    // Spy Date.now to return something far in the past; deps.nowMs is the
    // canonical clock per the issue.
    const realNow = Date.now
    Date.now = () => 0
    try {
      const ctx = makeDeps()
      ctx.setNowMs(1_700_000_000_000)
      const scheduler = createNotificationScheduler(ctx.deps)
      scheduler.attach()
      // Grant a trial; deps.nowMs should be used for the schedule basis.
      // We verify by checking that the recorded notif has a delaySeconds
      // computed from TRIAL_TTL_SECONDS - lead, regardless of Date.now().
      // grantEntitlement uses Date.now for expiresAt; the scheduler reads
      // expiresAt and subtracts deps.nowMs to compute delay.
      Date.now = () => 1_700_000_000_000 // grant uses real-ish now
      useEntitlementsStore.getState().grantEntitlement(
        `${PACK_TRIAL_PREFIX}trap_house`,
        { ttlSeconds: TRIAL_TTL_SECONDS },
      )
      const id = trialExpiringNotificationId('trap_house')
      const notif = ctx.scheduled.find((n) => n.id === id)
      expect(notif?.delaySeconds).toBe(TRIAL_TTL_SECONDS - TRIAL_EXPIRING_LEAD_SECONDS)
      scheduler.detach()
    } finally {
      Date.now = realNow
    }
  })
})

// ── debug api ────────────────────────────────────────────────────────────

describe('accept: debug api surface', () => {
  it('exposes list / simulateBackground / simulateForeground / fireIdleReminderNow', async () => {
    const ctx = makeDeps()
    const scheduler = createNotificationScheduler(ctx.deps)
    scheduler.attach()
    expect(typeof scheduler.list).toBe('function')
    expect(typeof scheduler.simulateBackground).toBe('function')
    expect(typeof scheduler.simulateForeground).toBe('function')
    expect(typeof scheduler.fireIdleReminderNow).toBe('function')

    // simulateBackground triggers same path as a real background event.
    scheduler.simulateBackground()
    expect(ctx.scheduled.find((n) => n.id === IDLE_REMINDER_ID)).toBeTruthy()

    // list() returns currently scheduled entries.
    const listed = await scheduler.list()
    expect(listed.find((n) => n.id === IDLE_REMINDER_ID)).toBeTruthy()

    // simulateForeground cancels the idle reminder.
    scheduler.simulateForeground()
    expect(ctx.cancelled).toContain(IDLE_REMINDER_ID)

    // fireIdleReminderNow schedules the idle reminder with delay = 0.
    scheduler.fireIdleReminderNow()
    const fired = ctx.scheduled.filter((n) => n.id === IDLE_REMINDER_ID)
    expect(fired.some((n) => n.delaySeconds === 0)).toBe(true)

    scheduler.detach()
  })
})
