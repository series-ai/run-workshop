import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxRewardTelegraphLifecycle(cycle: number): {
  energy: number
  scale: number
  stage: 'announce' | 'charge' | 'resolve' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const announce = smooth(phase / 0.12)
    return {
      energy: roundMetric(0.08 + announce * 0.2),
      scale: roundMetric(0.58 + announce * 0.18),
      stage: 'announce',
    }
  }
  if (phase < 0.68) {
    const charge = smooth((phase - 0.12) / 0.56)
    return {
      energy: roundMetric(0.28 + charge * 0.72),
      scale: roundMetric(0.76 + charge * 0.34),
      stage: 'charge',
    }
  }
  if (phase < 0.9) {
    const resolve = smooth((phase - 0.68) / 0.22)
    return {
      energy: roundMetric(1 - resolve),
      scale: roundMetric(1.1 + resolve * 0.42),
      stage: 'resolve',
    }
  }
  return { energy: 0, scale: 0, stage: 'rest' }
}
