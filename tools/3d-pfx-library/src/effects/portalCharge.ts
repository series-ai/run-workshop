import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxPortalChargeLifecycle(cycle: number): {
  energy: number
  aperture: number
  stage: 'gather' | 'charged' | 'release' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.72) {
    const gather = smooth(phase / 0.72)
    return {
      energy: roundMetric(0.18 + gather * 0.82),
      aperture: roundMetric(0.25 + gather * 0.75),
      stage: 'gather',
    }
  }
  if (phase < 0.82) return { energy: 1, aperture: 1, stage: 'charged' }
  if (phase < 0.95) {
    const release = smooth((phase - 0.82) / 0.13)
    return {
      energy: roundMetric(1 - release),
      aperture: roundMetric(1 - release * 0.9),
      stage: 'release',
    }
  }
  return { energy: 0, aperture: 0, stage: 'rest' }
}
