import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxWindBeamLifecycle(cycle: number): {
  energy: number
  reach: number
  twist: number
  scatter: number
  stage: 'compress' | 'surge' | 'fray' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.06) {
    const compress = smooth(phase / 0.06)
    return {
      energy: roundMetric(0.72 + compress * 0.25),
      reach: roundMetric(0.28 + compress * 0.5),
      twist: roundMetric(0.08 + compress * 0.34),
      scatter: 0,
      stage: 'compress',
    }
  }
  if (phase < 0.14) {
    const surge = smooth((phase - 0.06) / 0.02)
    return {
      energy: roundMetric(0.96 + Math.sin(surge * Math.PI) * 0.04),
      reach: roundMetric(0.38 + surge * 0.62),
      twist: roundMetric(0.42 + surge * 0.58),
      scatter: 0,
      stage: 'surge',
    }
  }
  if (phase < 0.42) {
    const fray = smooth((phase - 0.14) / 0.28)
    return {
      energy: roundMetric(0.27 + Math.pow(1 - fray, 3) * 0.73),
      reach: roundMetric(1 + fray * 0.08),
      twist: roundMetric(0.16 + Math.pow(1 - fray, 1.6) * 0.84),
      scatter: roundMetric(Math.min(1, fray * 1.5)),
      stage: 'fray',
    }
  }
  return { energy: 0, reach: 0, twist: 0, scatter: 0, stage: 'rest' }
}
