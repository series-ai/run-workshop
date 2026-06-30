import { create } from 'zustand'
import type { DayReward, MultiDayRewardConfig, MultiDayRewardState } from './types'
import type { PersistenceManager } from '@modules/data/storage-service/PersistenceManager'

// NOTE: At the game-install-module step, this import path gets rewritten to:
// import type { PersistenceManager } from '../services/PersistenceManager'

export type { DayReward, MultiDayRewardConfig, MultiDayRewardState } from './types'

const DEFAULT_COOLDOWN_MS = 86400000 // 24 hours

// --- Store ---

interface MultiDayRewardStoreState {
  tracks: Record<string, MultiDayRewardState>
  configs: Record<string, MultiDayRewardConfig>
}

interface MultiDayRewardStoreActions {
  activate(configId: string, now?: number): { instantRewardId?: string }
  canClaim(configId: string, now?: number): boolean
  claim(configId: string, now?: number): DayReward | null
  isActive(configId: string): boolean
  isComplete(configId: string): boolean
  getDaysRemaining(configId: string): number
  getTimeUntilNextClaim(configId: string, now?: number): number
  reset(): void
}

export type MultiDayRewardStore = MultiDayRewardStoreState & MultiDayRewardStoreActions

export function createMultiDayRewardStore(configs: MultiDayRewardConfig[], persistenceManager?: PersistenceManager) {
  const configMap: Record<string, MultiDayRewardConfig> = {}
  for (const c of configs) {
    configMap[c.id] = c
  }

  const PERSIST_KEY = 'multi-day-reward:v1'

  const initialState: MultiDayRewardStoreState = {
    tracks: {},
    configs: configMap,
  }

  const store = create<MultiDayRewardStore>()((set, get) => ({
    ...initialState,

    activate(configId: string, now?: number): { instantRewardId?: string } {
      const { configs, tracks } = get()
      const config = configs[configId]
      if (!config) return {}

      if (tracks[configId]) return {}

      const timestamp = now ?? Date.now()

      set(state => ({
        tracks: {
          ...state.tracks,
          [configId]: {
            configId,
            activatedAt: timestamp,
            claimedDays: 0,
            lastClaimAt: null,
            isComplete: false,
          },
        },
      }))
      persistenceManager?.markDirty(PERSIST_KEY)

      return { instantRewardId: config.instantRewardId }
    },

    canClaim(configId: string, now?: number): boolean {
      const { tracks, configs } = get()
      const track = tracks[configId]
      if (!track || track.isComplete) return false

      const config = configs[configId]
      if (!config) return false

      if (track.lastClaimAt === null) return true

      const cooldown = config.cooldownMs ?? DEFAULT_COOLDOWN_MS
      const timestamp = now ?? Date.now()
      return timestamp - track.lastClaimAt >= cooldown
    },

    claim(configId: string, now?: number): DayReward | null {
      const state = get()
      if (!state.canClaim(configId, now)) return null

      const track = state.tracks[configId]
      const config = state.configs[configId]
      if (!track || !config) return null

      const nextDay = track.claimedDays + 1
      const reward = config.dailyRewards.find(r => r.day === nextDay) ?? null

      const timestamp = now ?? Date.now()
      const isComplete = nextDay >= config.totalDays

      set(s => ({
        tracks: {
          ...s.tracks,
          [configId]: {
            ...track,
            claimedDays: nextDay,
            lastClaimAt: timestamp,
            isComplete,
          },
        },
      }))
      persistenceManager?.markDirty(PERSIST_KEY)

      return reward
    },

    isActive(configId: string): boolean {
      return configId in get().tracks
    },

    isComplete(configId: string): boolean {
      const track = get().tracks[configId]
      return track?.isComplete ?? false
    },

    getDaysRemaining(configId: string): number {
      const { tracks, configs } = get()
      const track = tracks[configId]
      const config = configs[configId]
      if (!track || !config) return 0
      return config.totalDays - track.claimedDays
    },

    getTimeUntilNextClaim(configId: string, now?: number): number {
      const { tracks, configs } = get()
      const track = tracks[configId]
      const config = configs[configId]
      if (!track || !config || track.isComplete) return 0

      if (track.lastClaimAt === null) return 0

      const cooldown = config.cooldownMs ?? DEFAULT_COOLDOWN_MS
      const timestamp = now ?? Date.now()
      const elapsed = timestamp - track.lastClaimAt
      return Math.max(0, cooldown - elapsed)
    },

    reset(): void {
      set({ tracks: {} })
      persistenceManager?.markDirty(PERSIST_KEY)
    },
  }))

  if (persistenceManager) {
    persistenceManager.register(PERSIST_KEY, {
      serialize: () => {
        const { tracks } = store.getState()
        return { tracks }
      },
      deserialize: (data: { tracks: Record<string, MultiDayRewardState> }) => {
        store.setState({ tracks: data.tracks })
      },
    })
  }

  return store
}
