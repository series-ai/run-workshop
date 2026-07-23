import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxMudBurstLifecycle(cycle: number): {
  energy: number
  compression: number
  eruption: number
  settle: number
  stage: 'impact' | 'eruption' | 'settle' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const impact = smooth(phase / 0.1)
    return { energy: roundMetric(0.58 + impact * 0.34), compression: roundMetric(1 - impact * 0.14), eruption: roundMetric(0.06 + impact * 0.16), settle: 0, stage: 'impact' }
  }
  if (phase < 0.4) {
    const eruption = smooth((phase - 0.1) / 0.3)
    const fastEruption = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.92 + Math.sin(eruption * Math.PI) * 0.08), compression: roundMetric(0.86 * (1 - eruption)), eruption: roundMetric(0.22 + fastEruption * 0.78), settle: roundMetric(eruption * 0.18), stage: 'eruption' }
  }
  if (phase < 0.86) {
    const settle = smooth((phase - 0.4) / 0.46)
    return { energy: roundMetric(0.9 * Math.pow(1 - settle, 0.9)), compression: 0, eruption: roundMetric(1 - settle * 0.1), settle: roundMetric(0.58 + Math.sin(settle * Math.PI) * 0.42), stage: 'settle' }
  }
  return { energy: 0, compression: 0, eruption: 0, settle: 0, stage: 'rest' }
}
