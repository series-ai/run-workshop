import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSnowBurstLifecycle(cycle: number): {
  energy: number
  compression: number
  spread: number
  powder: number
  stage: 'compress' | 'burst' | 'drift' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const compress = smooth(phase / 0.1)
    return {
      energy: roundMetric(0.48 + compress * 0.42),
      compression: roundMetric(1 - compress * 0.18),
      spread: roundMetric(0.06 + compress * 0.18),
      powder: roundMetric(0.12 + compress * 0.18),
      stage: 'compress',
    }
  }
  if (phase < 0.38) {
    const burst = smooth((phase - 0.1) / 0.28)
    const fastSpread = smooth((phase - 0.1) / 0.12)
    return {
      energy: roundMetric(0.9 + Math.sin(burst * Math.PI) * 0.1),
      compression: roundMetric(0.82 * (1 - burst)),
      spread: roundMetric(0.24 + fastSpread * 0.76),
      powder: roundMetric(0.3 + Math.sin(Math.min(1, burst * 1.35) * Math.PI * 0.5) * 0.7),
      stage: 'burst',
    }
  }
  if (phase < 0.86) {
    const drift = smooth((phase - 0.38) / 0.48)
    return {
      energy: roundMetric(0.9 * Math.pow(1 - drift, 1.15)),
      compression: 0,
      spread: roundMetric(1 - drift * 0.12),
      powder: roundMetric(0.94 * Math.pow(1 - drift, 0.72)),
      stage: 'drift',
    }
  }
  return { energy: 0, compression: 0, spread: 0, powder: 0, stage: 'rest' }
}
