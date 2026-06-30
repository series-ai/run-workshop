import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { RewardCalendar, ClaimButton, useClaimCountdown } from './MultiDayRewardUI'
import { createMultiDayRewardStore } from '@modules/monetization/multi-day-reward/MultiDayReward'
import type { MultiDayRewardConfig } from '@modules/monetization/multi-day-reward/MultiDayReward'

const TEST_CONFIGS: MultiDayRewardConfig[] = [
  {
    id: 'login',
    totalDays: 7,
    cooldownMs: 86400000,
    dailyRewards: [
      { day: 1, rewardId: 'coins', quantity: 100 },
      { day: 2, rewardId: 'coins', quantity: 200 },
      { day: 3, rewardId: 'gem', quantity: 1 },
      { day: 4, rewardId: 'coins', quantity: 300 },
      { day: 5, rewardId: 'coins', quantity: 400 },
      { day: 6, rewardId: 'gem', quantity: 2 },
      { day: 7, rewardId: 'chest', quantity: 1 },
    ],
  },
]

function createTestStore() {
  const store = createMultiDayRewardStore(TEST_CONFIGS)
  store.getState().activate('login', 1000)
  return store
}

describe('RewardCalendar', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders correct number of day cells', () => {
    const store = createTestStore()
    render(<RewardCalendar store={store} configId="login" />)
    expect(screen.getByTestId('reward-calendar')).toBeTruthy()
    for (let d = 1; d <= 7; d++) {
      expect(screen.getByTestId(`day-cell-${d}`)).toBeTruthy()
    }
  })

  it('shows claimed state for past days', () => {
    const store = createTestStore()
    store.getState().claim('login', 2000)
    store.getState().claim('login', 2000 + 86400000)

    render(<RewardCalendar store={store} configId="login" />)
    expect(screen.getByTestId('day-claimed-1')).toBeTruthy()
    expect(screen.getByTestId('day-claimed-2')).toBeTruthy()
  })

  it('shows claimable state for current day', () => {
    const store = createTestStore()
    render(<RewardCalendar store={store} configId="login" />)
    expect(screen.getByTestId('day-claimable-1')).toBeTruthy()
    expect(screen.getByTestId('day-cell-1').getAttribute('data-ui-skin-role')).toBe('button.primary')
    expect(screen.getByTestId('day-cell-1').getAttribute('data-state')).toBe('active')
  })

  it('shows locked state for future days', () => {
    const store = createTestStore()
    render(<RewardCalendar store={store} configId="login" />)
    for (let d = 2; d <= 7; d++) {
      expect(screen.getByTestId(`day-locked-${d}`)).toBeTruthy()
      expect(screen.getByTestId(`day-cell-${d}`).getAttribute('data-state')).toBe('disabled')
    }
  })

  it('calls onClaim when claimable day is clicked', () => {
    const store = createTestStore()
    const onClaim = vi.fn()
    render(<RewardCalendar store={store} configId="login" onClaim={onClaim} />)

    fireEvent.click(screen.getByTestId('day-cell-1'))
    expect(onClaim).toHaveBeenCalledWith({ day: 1, rewardId: 'coins', quantity: 100 })
  })
})

describe('ClaimButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('enabled when canClaim is true', () => {
    const store = createTestStore()
    render(<ClaimButton store={store} configId="login" />)

    const btn = screen.getByTestId('claim-btn-login') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    expect(btn.textContent).toContain('Claim Day 1')
  })

  it('disabled during cooldown', () => {
    const store = createTestStore()
    const claimTime = 10000
    store.getState().claim('login', claimTime)

    vi.setSystemTime(claimTime + 1000) // 1s after claim, well within cooldown
    render(<ClaimButton store={store} configId="login" />)

    const btn = screen.getByTestId('claim-btn-login') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('shows countdown text when disabled', () => {
    const store = createTestStore()
    store.getState().claim('login', 2000)

    vi.setSystemTime(2000)
    render(<ClaimButton store={store} configId="login" />)

    const countdown = screen.getByTestId('claim-countdown-login')
    expect(countdown).toBeTruthy()
    expect(countdown.getAttribute('data-ui-skin-role')).toBe('label.value')
    expect(countdown.textContent).toContain(':')
  })

  it('calls onClaim when clicked and claimable', () => {
    const store = createTestStore()
    const onClaim = vi.fn()
    render(<ClaimButton store={store} configId="login" onClaim={onClaim} />)

    fireEvent.click(screen.getByTestId('claim-btn-login'))
    expect(onClaim).toHaveBeenCalledWith({ day: 1, rewardId: 'coins', quantity: 100 })
  })

  it('does not show ad-double button without onRequestAdDouble', () => {
    const store = createTestStore()
    render(<ClaimButton store={store} configId="login" />)

    fireEvent.click(screen.getByTestId('claim-btn-login'))
    expect(screen.queryByTestId('ad-double-btn-login')).toBeNull()
  })

  it('shows ad-double button after claim when onRequestAdDouble is set', () => {
    const store = createTestStore()
    const onAdDouble = vi.fn().mockResolvedValue(true)
    render(<ClaimButton store={store} configId="login" onRequestAdDouble={onAdDouble} />)

    fireEvent.click(screen.getByTestId('claim-btn-login'))
    expect(screen.getByTestId('ad-double-btn-login')).toBeTruthy()
  })

  it('shows doubled reward after successful ad', async () => {
    const store = createTestStore()
    let resolveAd: (v: boolean) => void
    const onAdDouble = vi.fn().mockImplementation(() => new Promise<boolean>(r => { resolveAd = r }))
    render(<ClaimButton store={store} configId="login" onRequestAdDouble={onAdDouble} />)

    fireEvent.click(screen.getByTestId('claim-btn-login'))
    fireEvent.click(screen.getByTestId('ad-double-btn-login'))

    expect(screen.getByTestId('ad-double-loading-login')).toBeTruthy()

    resolveAd!(true)
    // Wait for state update
    await vi.waitFor(() => {
      expect(screen.getByTestId('ad-double-success-login')).toBeTruthy()
    })
    expect(screen.getByTestId('ad-double-success-login').textContent).toContain('x200')
  })

  it('shows custom ad-double label', () => {
    const store = createTestStore()
    const onAdDouble = vi.fn().mockResolvedValue(true)
    render(<ClaimButton store={store} configId="login" onRequestAdDouble={onAdDouble} adDoubleLabel="Watch Ad" />)

    fireEvent.click(screen.getByTestId('claim-btn-login'))
    expect(screen.getByTestId('ad-double-btn-login').textContent).toContain('Watch Ad')
  })
})

describe('useClaimCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  function HookHarness({ store, configId }: { store: ReturnType<typeof createMultiDayRewardStore>; configId: string }) {
    const result = useClaimCountdown(store, configId)
    return (
      <div>
        <span data-testid="can-claim">{String(result.canClaim)}</span>
        <span data-testid="formatted">{result.formatted}</span>
        <span data-testid="time-remaining">{result.timeRemaining}</span>
      </div>
    )
  }

  it('returns canClaim true when no cooldown active', () => {
    const store = createTestStore()
    render(<HookHarness store={store} configId="login" />)

    expect(screen.getByTestId('can-claim').textContent).toBe('true')
    expect(screen.getByTestId('formatted').textContent).toBe('00:00:00')
  })

  it('returns canClaim false during cooldown with formatted time', () => {
    const store = createTestStore()
    const claimTime = 10000
    store.getState().claim('login', claimTime)

    vi.setSystemTime(claimTime)
    render(<HookHarness store={store} configId="login" />)

    expect(screen.getByTestId('can-claim').textContent).toBe('false')
    expect(screen.getByTestId('formatted').textContent).toBe('24:00:00')
  })
})
