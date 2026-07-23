import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSpawnScreenLifecycle(cycle: number): {
  energy: number
  aperture: number
  stage: 'acquire' | 'materialize' | 'confirm' | 'release' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.18) {
    const acquire = smooth(phase / 0.18)
    return {
      energy: roundMetric(0.46 + acquire * 0.54),
      aperture: roundMetric(0.68 + acquire * 0.32),
      stage: 'acquire',
    }
  }
  if (phase < 0.5) {
    const materialize = (phase - 0.18) / 0.32
    return {
      energy: roundMetric(0.92 + Math.sin(materialize * Math.PI * 3) * 0.08),
      aperture: roundMetric(1 + Math.sin(materialize * Math.PI) * 0.04),
      stage: 'materialize',
    }
  }
  if (phase < 0.64) {
    const confirm = (phase - 0.5) / 0.14
    return {
      energy: roundMetric(1 - confirm * 0.08),
      aperture: roundMetric(1.06 + Math.sin(confirm * Math.PI) * 0.08),
      stage: 'confirm',
    }
  }
  if (phase < 0.92) {
    const release = smooth((phase - 0.64) / 0.28)
    return {
      energy: roundMetric(0.85 * (1 - release)),
      aperture: roundMetric(1.08 + release * 0.28),
      stage: 'release',
    }
  }
  return { energy: 0, aperture: 0, stage: 'rest' }
}
