import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxElectricTrailLifecycle(cycle: number): {
  reach: number
  decay: number
  intensity: number
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => value * value * (3 - 2 * value)
  if (phase < 0.065) {
    const rise = smooth(phase / 0.065)
    return {
      reach: roundMetric(0.32 + rise * 0.68),
      decay: 0,
      intensity: roundMetric(0.65 + rise * 0.35),
    }
  }
  if (phase < 0.09) return { reach: 1, decay: 0, intensity: 1 }
  if (phase < 0.2) {
    const recovery = smooth((phase - 0.09) / 0.11)
    return {
      reach: 1,
      decay: roundMetric(recovery),
      intensity: roundMetric(1 - recovery),
    }
  }
  return { reach: 0.08, decay: 1, intensity: 0 }
}
