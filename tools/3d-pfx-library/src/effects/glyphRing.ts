import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxGlyphRingLifecycle(cycle: number): {
  energy: number
  scale: number
  stage: 'inscribe' | 'seal' | 'release' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.2) {
    const inscribe = smooth(phase / 0.2)
    return {
      energy: roundMetric(0.28 + inscribe * 0.72),
      scale: roundMetric(0.52 + inscribe * 0.48),
      stage: 'inscribe',
    }
  }
  if (phase < 0.68) {
    const seal = (phase - 0.2) / 0.48
    return {
      energy: roundMetric(0.9 + Math.sin(seal * Math.PI * 2) * 0.1),
      scale: roundMetric(1 + Math.sin(seal * Math.PI) * 0.035),
      stage: 'seal',
    }
  }
  if (phase < 0.9) {
    const release = smooth((phase - 0.68) / 0.22)
    return {
      energy: roundMetric(0.9 * (1 - release)),
      scale: roundMetric(1 + release * 0.04),
      stage: 'release',
    }
  }
  return { energy: 0, scale: 0, stage: 'rest' }
}
