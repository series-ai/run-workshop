import { roundMetric } from '../constants/03'

export function createPfxProjectileWakeEnvelope(cycle: number): number {
  const p = Math.max(0, Math.min(1, cycle))
  const pulse = (p * 6) % 1
  if (pulse < 0.35) {
    const grow = pulse / 0.35
    return roundMetric(0.08 + (grow * grow * (3 - 2 * grow)) * 0.92)
  }
  if (pulse <= 0.55) return 1
  const recovery = Math.max(0, Math.min(1, (pulse - 0.55) / 0.3))
  return roundMetric(1 - recovery * recovery * (3 - 2 * recovery))
}
