import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHolyBurstLifecycle(cycle: number): {
  energy: number
  consecration: number
  burst: number
  ascent: number
  stage: 'consecrate' | 'burst' | 'ascend' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const consecration = smooth(phase / 0.1)
    return { energy: roundMetric(0.6 + consecration * 0.32), consecration: roundMetric(1 - consecration * 0.08), burst: roundMetric(0.06 + consecration * 0.18), ascent: 0, stage: 'consecrate' }
  }
  if (phase < 0.4) {
    const burst = smooth((phase - 0.1) / 0.3)
    const fastBurst = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.92 + Math.sin(burst * Math.PI) * 0.08), consecration: roundMetric(0.92 * (1 - burst)), burst: roundMetric(0.24 + fastBurst * 0.76), ascent: roundMetric(burst * 0.2), stage: 'burst' }
  }
  if (phase < 0.92) {
    const ascent = smooth((phase - 0.4) / 0.52)
    return { energy: roundMetric(0.94 * Math.pow(1 - ascent, 0.8)), consecration: 0, burst: roundMetric(1 - ascent * 0.12), ascent: roundMetric(0.68 + Math.sin(ascent * Math.PI) * 0.32), stage: 'ascend' }
  }
  return { energy: 0, consecration: 0, burst: 0, ascent: 0, stage: 'rest' }
}
