import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxWindImpactLifecycle(cycle: number): {
  energy: number
  stage: 'compress' | 'release' | 'recovery' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => value * value * (3 - 2 * value)
  if (phase < 0.06) {
    const rise = smooth(phase / 0.06)
    return { energy: roundMetric(0.38 + rise * 0.62), stage: 'compress' }
  }
  if (phase < 0.1) return { energy: 1, stage: 'release' }
  if (phase < 0.36) {
    const recovery = THREE.MathUtils.clamp((phase - 0.1) / 0.26, 0, 1)
    return { energy: roundMetric(0.12 + Math.pow(1 - recovery, 2) * 0.88), stage: 'recovery' }
  }
  return { energy: 0, stage: 'rest' }
}
