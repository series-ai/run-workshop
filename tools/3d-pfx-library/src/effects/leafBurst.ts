import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxLeafBurstLifecycle(cycle: number): {
  energy: number
  bud: number
  spread: number
  flutter: number
  stage: 'bud' | 'burst' | 'flutter' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.1) {
    const bud = smooth(phase / 0.1)
    return { energy: roundMetric(0.46 + bud * 0.4), bud: roundMetric(1 - bud * 0.12), spread: roundMetric(0.06 + bud * 0.16), flutter: roundMetric(bud * 0.08), stage: 'bud' }
  }
  if (phase < 0.4) {
    const burst = smooth((phase - 0.1) / 0.3)
    const fastSpread = smooth((phase - 0.1) / 0.11)
    return { energy: roundMetric(0.86 + Math.sin(burst * Math.PI) * 0.14), bud: roundMetric(0.88 * (1 - burst)), spread: roundMetric(0.22 + fastSpread * 0.78), flutter: roundMetric(0.08 + burst * 0.48), stage: 'burst' }
  }
  if (phase < 0.86) {
    const flutter = smooth((phase - 0.4) / 0.46)
    return { energy: roundMetric(0.92 * Math.pow(1 - flutter, 0.92)), bud: 0, spread: roundMetric(1 - flutter * 0.12), flutter: roundMetric(0.56 + Math.sin(flutter * Math.PI) * 0.44), stage: 'flutter' }
  }
  return { energy: 0, bud: 0, spread: 0, flutter: 0, stage: 'rest' }
}
