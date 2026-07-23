import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxPoisonBurstLifecycle(cycle: number): {
  energy: number
  seed: number
  rupture: number
  disperse: number
  stage: 'seed' | 'rupture' | 'disperse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const seed = smooth(phase / 0.1)
    return { energy: roundMetric(0.54 + seed * 0.34), seed: roundMetric(1 - seed * 0.12), rupture: roundMetric(0.05 + seed * 0.15), disperse: 0, stage: 'seed' }
  }
  if (phase < 0.42) {
    const rupture = smooth((phase - 0.1) / 0.32)
    const fastRupture = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.88 + Math.sin(rupture * Math.PI) * 0.12), seed: roundMetric(0.88 * (1 - rupture)), rupture: roundMetric(0.2 + fastRupture * 0.8), disperse: roundMetric(rupture * 0.2), stage: 'rupture' }
  }
  if (phase < 0.86) {
    const disperse = smooth((phase - 0.42) / 0.44)
    return { energy: roundMetric(0.9 * Math.pow(1 - disperse, 0.86)), seed: 0, rupture: roundMetric(1 - disperse * 0.12), disperse: roundMetric(0.62 + Math.sin(disperse * Math.PI) * 0.38), stage: 'disperse' }
  }
  return { energy: 0, seed: 0, rupture: 0, disperse: 0, stage: 'rest' }
}
