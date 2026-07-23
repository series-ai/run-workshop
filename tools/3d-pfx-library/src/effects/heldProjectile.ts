import { roundMetric } from '../constants/03'

export function createPfxHeldProjectileLifecycle(elapsedSeconds: number): {
  energy: number
  stage: 'ignite' | 'settle' | 'sustain'
} {
  const elapsed = Math.max(0, elapsedSeconds)
  if (elapsed < 0.2) {
    const progress = elapsed / 0.2
    return {
      energy: roundMetric(0.22 + Math.pow(progress, 2.2) * 0.78),
      stage: 'ignite',
    }
  }
  if (elapsed < 0.36) {
    const progress = (elapsed - 0.2) / 0.16
    const eased = progress * progress * (3 - 2 * progress)
    return {
      energy: roundMetric(1 - eased * 0.52),
      stage: 'settle',
    }
  }
  return {
    energy: roundMetric(0.52 + Math.sin((elapsed - 0.36) * 3.7) * 0.025),
    stage: 'sustain',
  }
}
