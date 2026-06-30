import type { DynamicMusicQualityTier } from './types'

export const dynamicMusicTierRank: Record<DynamicMusicQualityTier, number> = {
  fallback: 0,
  reduced: 1,
  full: 2,
}

export const defaultDynamicMusicConfig = {
  smoothingFactor: 0.25,
  rampSeconds: 0.12,
  scheduleHeadSeconds: 0.05,
  defaultTier: 'reduced' as DynamicMusicQualityTier,
}
