import { roundMetric } from '../constants/03'

export function createPfxHealingLeafProgress(elapsedSeconds: number, index: number, count: number): number {
  const safeCount = Math.max(1, Math.floor(count))
  const hash = Math.sin((index + 1) * 12.9898) * 43758.5453
  const jitter = (hash - Math.floor(hash) - 0.5) * 0.035
  const progress = elapsedSeconds / 1.5 + index / safeCount + jitter
  return roundMetric(((progress % 1) + 1) % 1)
}
