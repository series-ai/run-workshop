import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxAcidBurstLifecycle(cycle: number): {
  energy: number
  pool: number
  eruption: number
  collapse: number
  stage: 'pool' | 'eruption' | 'collapse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const pool = smooth(phase / 0.1)
    return { energy: roundMetric(0.58 + pool * 0.34), pool: roundMetric(1 - pool * 0.12), eruption: roundMetric(0.05 + pool * 0.16), collapse: 0, stage: 'pool' }
  }
  if (phase < 0.42) {
    const eruption = smooth((phase - 0.1) / 0.32)
    const fastEruption = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.92 + Math.sin(eruption * Math.PI) * 0.08), pool: roundMetric(0.88 * (1 - eruption)), eruption: roundMetric(0.21 + fastEruption * 0.79), collapse: roundMetric(eruption * 0.18), stage: 'eruption' }
  }
  if (phase < 0.86) {
    const collapse = smooth((phase - 0.42) / 0.44)
    return { energy: roundMetric(0.9 * Math.pow(1 - collapse, 0.84)), pool: 0, eruption: roundMetric(1 - collapse * 0.1), collapse: roundMetric(0.64 + Math.sin(collapse * Math.PI) * 0.36), stage: 'collapse' }
  }
  return { energy: 0, pool: 0, eruption: 0, collapse: 0, stage: 'rest' }
}
