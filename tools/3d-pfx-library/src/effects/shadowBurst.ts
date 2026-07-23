import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxShadowBurstLifecycle(cycle: number): {
  energy: number
  compression: number
  rupture: number
  disperse: number
  stage: 'compress' | 'rupture' | 'disperse' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.11) {
    const compression = smooth(phase / 0.11)
    return { energy: roundMetric(0.42 + compression * 0.38), compression: roundMetric(1 - compression * 0.12), rupture: roundMetric(compression * 0.3), disperse: 0, stage: 'compress' }
  }
  if (phase < 0.43) {
    const rupture = smooth((phase - 0.11) / 0.32)
    const snap = smooth((phase - 0.11) / 0.12)
    return { energy: roundMetric(0.86 + Math.sin(rupture * Math.PI) * 0.14), compression: roundMetric(0.88 * (1 - rupture)), rupture: roundMetric(0.3 + snap * 0.7), disperse: roundMetric(rupture * 0.38), stage: 'rupture' }
  }
  if (phase < 0.93) {
    const disperse = smooth((phase - 0.43) / 0.5)
    return { energy: roundMetric(0.96 * Math.pow(1 - disperse, 0.78)), compression: 0, rupture: roundMetric(1 - disperse * 0.12), disperse: roundMetric(0.72 + Math.sin(disperse * Math.PI) * 0.28), stage: 'disperse' }
  }
  return { energy: 0, compression: 0, rupture: 0, disperse: 0, stage: 'rest' }
}
