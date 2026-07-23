import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxAcidIdleLifecycle(elapsedSeconds: number): {
  energy: number
  stage: 'simmer' | 'swell' | 'release'
} {
  const period = 0.8
  const phase = ((Math.max(0, elapsedSeconds) % period) + period) % period
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.2) return { energy: 0.05, stage: 'simmer' }
  if (phase < 0.32) return { energy: roundMetric(0.05 + smooth((phase - 0.2) / 0.12) * 0.95), stage: 'swell' }
  if (phase < 0.42) return { energy: 1, stage: 'swell' }
  if (phase < 0.62) return { energy: roundMetric(0.05 + (1 - smooth((phase - 0.42) / 0.2)) * 0.95), stage: 'release' }
  return { energy: 0.05, stage: 'simmer' }
}
