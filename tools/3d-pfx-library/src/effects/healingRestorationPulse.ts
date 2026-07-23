import { roundMetric } from '../constants/03'

export function createPfxHealingRestorationPulse(elapsedSeconds: number): number {
  const beat = (Math.max(0, elapsedSeconds) % 1.1) / 1.1
  const activeWindow = 0.36
  if (beat >= activeWindow) return 0
  const progress = Math.min(1, beat / activeWindow)
  const sine = Math.sin(progress * Math.PI)
  return roundMetric(Math.pow(sine, progress < 0.5 ? 0.55 : 2.2))
}
