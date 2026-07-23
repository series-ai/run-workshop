import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxCurseBurstLifecycle(cycle: number): {
  energy: number
  mark: number
  rupture: number
  escape: number
  stage: 'mark' | 'rupture' | 'escape' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const mark = smooth(phase / 0.1)
    return { energy: roundMetric(0.38 + mark * 0.5), mark: roundMetric(1 - mark * 0.08), rupture: roundMetric(mark * 0.22), escape: 0, stage: 'mark' }
  }
  if (phase < 0.4) {
    const rupture = smooth((phase - 0.1) / 0.3)
    const fastRupture = smooth((phase - 0.1) / 0.1)
    return { energy: roundMetric(0.9 + Math.sin(rupture * Math.PI) * 0.1), mark: roundMetric(0.92 * (1 - rupture)), rupture: roundMetric(0.24 + fastRupture * 0.76), escape: roundMetric(rupture * 0.18), stage: 'rupture' }
  }
  if (phase < 0.92) {
    const escape = smooth((phase - 0.4) / 0.52)
    return { energy: roundMetric(0.94 * Math.pow(1 - escape, 0.82)), mark: 0, rupture: roundMetric(1 - escape * 0.16), escape: roundMetric(0.7 + Math.sin(escape * Math.PI) * 0.3), stage: 'escape' }
  }
  return { energy: 0, mark: 0, rupture: 0, escape: 0, stage: 'rest' }
}
