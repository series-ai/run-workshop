export interface DayReward {
  day: number
  rewardId: string
  quantity?: number
}

export interface MultiDayRewardConfig {
  id: string
  totalDays: number
  instantRewardId?: string
  dailyRewards: DayReward[]
  cooldownMs?: number
}

export interface MultiDayRewardState {
  configId: string
  activatedAt: number
  claimedDays: number
  lastClaimAt: number | null
  isComplete: boolean
}
