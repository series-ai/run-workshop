import type { MultiDayRewardConfig } from './types'

export const DEFAULT_MULTI_DAY_REWARD_CONFIG: MultiDayRewardConfig = {
  id: 'login_bonus',
  totalDays: 7,
  dailyRewards: [
    { day: 1, rewardId: 'coins', quantity: 100 },
    { day: 2, rewardId: 'coins', quantity: 200 },
    { day: 3, rewardId: 'gem', quantity: 1 },
    { day: 4, rewardId: 'coins', quantity: 300 },
    { day: 5, rewardId: 'gem', quantity: 2 },
    { day: 6, rewardId: 'coins', quantity: 500 },
    { day: 7, rewardId: 'rare_chest', quantity: 1 },
  ],
  cooldownMs: 86400000,
}
