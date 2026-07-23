import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxJumpPickupLifecycle(cycle: number): {
  energy: number
  height: number
  compression: number
  stage: 'crouch' | 'lift' | 'collect' | 'release' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.14) {
    const crouch = smooth(phase / 0.14)
    return {
      energy: roundMetric(0.4 + crouch * 0.6),
      height: 0,
      compression: roundMetric(0.68 - crouch * 0.16),
      stage: 'crouch',
    }
  }
  if (phase < 0.44) {
    const lift = smooth((phase - 0.14) / 0.3)
    return {
      energy: roundMetric(1 - lift * 0.05),
      height: roundMetric(lift * 1.08),
      compression: roundMetric(0.52 + lift * 0.66),
      stage: 'lift',
    }
  }
  if (phase < 0.62) {
    const collect = (phase - 0.44) / 0.18
    return {
      energy: roundMetric(0.95 + Math.sin(collect * Math.PI) * 0.05),
      height: roundMetric(1.08 + Math.sin(collect * Math.PI) * 0.12),
      compression: roundMetric(1.18 - collect * 0.1),
      stage: 'collect',
    }
  }
  if (phase < 0.9) {
    const release = smooth((phase - 0.62) / 0.28)
    return {
      energy: roundMetric(0.86 * (1 - release)),
      height: roundMetric(1.08 + release * 0.28),
      compression: roundMetric(1.08 - release * 0.42),
      stage: 'release',
    }
  }
  return { energy: 0, height: 0, compression: 0, stage: 'rest' }
}
