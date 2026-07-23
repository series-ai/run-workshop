import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxWindBurstLifecycle(cycle: number): {
  energy: number
  compression: number
  release: number
  curl: number
  stage: 'compress' | 'release' | 'curl' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const compress = smooth(phase / 0.1)
    return {
      energy: roundMetric(0.44 + compress * 0.46),
      compression: roundMetric(1 - compress * 0.12),
      release: roundMetric(0.04 + compress * 0.18),
      curl: roundMetric(compress * 0.08),
      stage: 'compress',
    }
  }
  if (phase < 0.4) {
    const release = smooth((phase - 0.1) / 0.3)
    const fastRelease = smooth((phase - 0.1) / 0.11)
    return {
      energy: roundMetric(0.9 + Math.sin(release * Math.PI) * 0.1),
      compression: roundMetric(0.88 * (1 - release)),
      release: roundMetric(0.22 + fastRelease * 0.78),
      curl: roundMetric(0.08 + release * 0.58),
      stage: 'release',
    }
  }
  if (phase < 0.86) {
    const curl = smooth((phase - 0.4) / 0.46)
    return {
      energy: roundMetric(0.92 * Math.pow(1 - curl, 0.9)),
      compression: 0,
      release: roundMetric(1 - curl * 0.14),
      curl: roundMetric(0.66 + Math.sin(curl * Math.PI) * 0.34),
      stage: 'curl',
    }
  }
  return { energy: 0, compression: 0, release: 0, curl: 0, stage: 'rest' }
}
