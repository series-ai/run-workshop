import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSandSprayLifecycle(cycle: number): {
  energy: number
  spread: number
  stage: 'kick' | 'fan' | 'settle' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.16) {
    const kick = smooth(phase / 0.16)
    return {
      energy: roundMetric(0.5 + kick * 0.5),
      spread: roundMetric(0.48 + kick * 0.52),
      stage: 'kick',
    }
  }
  if (phase < 0.62) {
    const fan = (phase - 0.16) / 0.46
    return {
      energy: roundMetric(0.9 + Math.sin(fan * Math.PI) * 0.1),
      spread: roundMetric(1 + fan * 0.12),
      stage: 'fan',
    }
  }
  if (phase < 0.94) {
    const settle = smooth((phase - 0.62) / 0.32)
    return {
      energy: roundMetric(0.82 * (1 - settle * 0.62)),
      spread: roundMetric(1.12 - settle * 0.22),
      stage: 'settle',
    }
  }
  return { energy: 0, spread: 0, stage: 'rest' }
}
