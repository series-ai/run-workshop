import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHealingBurstLifecycle(cycle: number): {
  energy: number
  seed: number
  bloom: number
  lift: number
  stage: 'seed' | 'bloom' | 'lift' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const seed = smooth(phase / 0.1)
    return { energy: roundMetric(0.56 + seed * 0.34), seed: roundMetric(1 - seed * 0.1), bloom: roundMetric(0.04 + seed * 0.16), lift: 0, stage: 'seed' }
  }
  if (phase < 0.4) {
    const bloom = smooth((phase - 0.1) / 0.3)
    const fastBloom = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.9 + Math.sin(bloom * Math.PI) * 0.1), seed: roundMetric(0.9 * (1 - bloom)), bloom: roundMetric(0.2 + fastBloom * 0.8), lift: roundMetric(bloom * 0.2), stage: 'bloom' }
  }
  if (phase < 0.86) {
    const lift = smooth((phase - 0.4) / 0.46)
    return { energy: roundMetric(0.92 * Math.pow(1 - lift, 0.82)), seed: 0, bloom: roundMetric(1 - lift * 0.12), lift: roundMetric(0.64 + Math.sin(lift * Math.PI) * 0.36), stage: 'lift' }
  }
  return { energy: 0, seed: 0, bloom: 0, lift: 0, stage: 'rest' }
}
