import { useState, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { StoreApi } from 'zustand'
import type { MultiDayRewardStore, DayReward } from '@modules/monetization/multi-day-reward/MultiDayReward'
import { Button, Label, Tag } from '@modules/ui/skin/semantic'

// --- Types ---

type RewardStore = StoreApi<MultiDayRewardStore>

export interface RewardCalendarProps {
  store: RewardStore
  configId: string
  columns?: number
  onClaim?: (reward: DayReward) => void
}

export interface ClaimButtonProps {
  store: RewardStore
  configId: string
  onClaim?: (reward: DayReward) => void
  /**
   * When set, a "Double it!" button appears after claiming. Wire to
   * `rewarded-ad-flow` module's `showAd()` — resolve true if the ad
   * completed. The caller grants the extra reward; the component shows
   * the doubled amount in the UI.
   */
  onRequestAdDouble?: (reward: DayReward) => Promise<boolean>
  /** Label for the ad-double button. Default: "Double it!" */
  adDoubleLabel?: string
}

// --- useClaimCountdown Hook ---

export function useClaimCountdown(store: RewardStore, configId: string) {
  const canClaim = useSyncExternalStore(
    store.subscribe,
    () => store.getState().canClaim(configId),
  )

  const [timeRemaining, setTimeRemaining] = useState(() =>
    store.getState().getTimeUntilNextClaim(configId),
  )

  useEffect(() => {
    const tick = () => {
      setTimeRemaining(store.getState().getTimeUntilNextClaim(configId))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [store, configId])

  const totalSeconds = Math.ceil(timeRemaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { canClaim, timeRemaining, formatted }
}

// --- RewardCalendar ---

export function RewardCalendar({ store, configId, columns = 7, onClaim }: RewardCalendarProps) {
  const track = useSyncExternalStore(
    store.subscribe,
    () => store.getState().tracks[configId],
  )
  const config = useSyncExternalStore(
    store.subscribe,
    () => store.getState().configs[configId],
  )
  const canClaim = useSyncExternalStore(
    store.subscribe,
    () => store.getState().canClaim(configId),
  )

  if (!config) return null

  const claimedDays = track?.claimedDays ?? 0
  const todayDay = claimedDays + 1

  const handleClaim = (day: number) => {
    if (day !== todayDay || !canClaim) return
    const reward = store.getState().claim(configId)
    if (reward && onClaim) onClaim(reward)
  }

  return (
    <div
      data-testid="reward-calendar"
      className={`grid gap-2`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: config.totalDays }, (_, i) => {
        const day = i + 1
        const isClaimed = day <= claimedDays
        const isClaimable = day === todayDay && canClaim && !track?.isComplete

        const reward = config.dailyRewards.find(r => r.day === day)
        const rewardLabel = reward ? `${reward.rewardId}${reward.quantity ? ` x${reward.quantity}` : ''}` : undefined

        let cellTestId = `day-cell-${day}`
        let stateTestId = ''
        let tone: 'blue' | 'green' | 'yellow' | undefined
        let stateBadge: ReactNode

        if (isClaimed) {
          stateTestId = `day-claimed-${day}`
          tone = 'green'
          stateBadge = <Tag.Status data-testid={stateTestId} tone="green">Claimed</Tag.Status>
        } else if (isClaimable) {
          stateTestId = `day-claimable-${day}`
          tone = 'yellow'
          stateBadge = <Tag.Callout data-testid={stateTestId} tone="yellow">Today</Tag.Callout>
        } else {
          stateTestId = `day-locked-${day}`
          tone = 'blue'
          stateBadge = <Tag.Status data-testid={stateTestId} tone="blue">Locked</Tag.Status>
        }

        return (
          <Button.Stacked
            active={isClaimable}
            className="min-h-24"
            disabled={!isClaimable}
            highlighted={isClaimable}
            key={day}
            data-testid={cellTestId}
            leadingVisual={stateBadge}
            onClick={() => isClaimable && handleClaim(day)}
            supportingText={rewardLabel}
            tone={tone}
          >
            {`Day ${day}`}
          </Button.Stacked>
        )
      })}
    </div>
  )
}

// --- ClaimButton ---

export function ClaimButton({ store, configId, onClaim, onRequestAdDouble, adDoubleLabel = 'Double it!' }: ClaimButtonProps) {
  const { canClaim, formatted } = useClaimCountdown(store, configId)
  const [justClaimed, setJustClaimed] = useState<DayReward | null>(null)
  const [adState, setAdState] = useState<'idle' | 'loading' | 'doubled'>('idle')

  const track = useSyncExternalStore(
    store.subscribe,
    () => store.getState().tracks[configId],
  )

  const claimedDays = track?.claimedDays ?? 0
  const nextDay = claimedDays + 1

  const handleClick = () => {
    if (!canClaim) return
    const reward = store.getState().claim(configId)
    if (reward) {
      onClaim?.(reward)
      if (onRequestAdDouble) {
        setJustClaimed(reward)
        setAdState('idle')
      }
    }
  }

  const handleAdDouble = async () => {
    if (!justClaimed || adState !== 'idle') return
    setAdState('loading')
    const success = await onRequestAdDouble!(justClaimed)
    setAdState(success ? 'doubled' : 'idle')
  }

  return (
    <div>
      <Button.Primary
        data-testid={`claim-btn-${configId}`}
        disabled={!canClaim}
        onClick={handleClick}
        style={{ width: '100%' }}
        tone="yellow"
      >
        {canClaim ? `Claim Day ${nextDay}` : `Claim Day ${nextDay}`}
      </Button.Primary>
      {!canClaim && adState !== 'doubled' && !justClaimed && (
        <Label.Value
          data-testid={`claim-countdown-${configId}`}
          className="mt-2 block text-center"
        >
          Next claim in {formatted}
        </Label.Value>
      )}
      {justClaimed && adState === 'idle' && (
        <Button.Secondary
          data-testid={`ad-double-btn-${configId}`}
          onClick={handleAdDouble}
          style={{ width: '100%', marginTop: '0.5rem' }}
          tone="green"
        >
          {adDoubleLabel}
        </Button.Secondary>
      )}
      {adState === 'loading' && (
        <Label.Value
          data-testid={`ad-double-loading-${configId}`}
          className="mt-2 block text-center"
        >
          Watching ad…
        </Label.Value>
      )}
      {adState === 'doubled' && justClaimed && (
        <Tag.Callout
          data-testid={`ad-double-success-${configId}`}
          tone="green"
          className="mt-2 block text-center"
        >
          {justClaimed.rewardId} x{(justClaimed.quantity ?? 1) * 2} claimed!
        </Tag.Callout>
      )}
    </div>
  )
}
