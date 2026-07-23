import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxLevelUpSurgeLifecycle(cycle: number): {
  energy: number
  stage: 'gather' | 'surge' | 'payout' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  if (phase < 0.18) {
    const p = phase / 0.18
    return { energy: roundMetric(0.1 + p * p * 0.22), stage: 'gather' }
  }
  if (phase < 0.4) {
    const p = (phase - 0.18) / 0.22
    const rise = Math.sin(p * Math.PI * 0.5)
    return { energy: roundMetric(0.22 + rise * 0.78), stage: 'surge' }
  }
  if (phase < 0.5) return { energy: 1, stage: 'surge' }
  if (phase < 0.8) {
    const p = (phase - 0.5) / 0.3
    const release = 1 - p * p * (3 - 2 * p)
    return { energy: roundMetric(0.16 + release * 0.84), stage: 'payout' }
  }
  return { energy: 0, stage: 'rest' }
}
