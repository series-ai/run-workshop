import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxPetalBurstLifecycle(cycle: number): {
  energy: number
  bud: number
  spread: number
  flutter: number
  stage: 'bud' | 'bloom' | 'flutter' | 'rest'
} {
  const phase = THREE.MathUtils.clamp(cycle, 0, 1)
  const smooth = (value: number) => {
    const clamped = THREE.MathUtils.clamp(value, 0, 1)
    return clamped * clamped * (3 - 2 * clamped)
  }
  if (phase < 0.12) {
    const bud = smooth(phase / 0.12)
    return { energy: roundMetric(0.5 + bud * 0.4), bud: roundMetric(1 - bud * 0.1), spread: roundMetric(0.08 + bud * 0.16), flutter: roundMetric(bud * 0.06), stage: 'bud' }
  }
  if (phase < 0.42) {
    const bloom = smooth((phase - 0.12) / 0.3)
    const fastSpread = smooth((phase - 0.12) / 0.1)
    return { energy: roundMetric(0.9 + Math.sin(bloom * Math.PI) * 0.1), bud: roundMetric(0.9 * (1 - bloom)), spread: roundMetric(0.24 + fastSpread * 0.76), flutter: roundMetric(0.06 + bloom * 0.48), stage: 'bloom' }
  }
  if (phase < 0.88) {
    const flutter = smooth((phase - 0.42) / 0.46)
    return { energy: roundMetric(0.94 * Math.pow(1 - flutter, 0.88)), bud: 0, spread: roundMetric(1 - flutter * 0.08), flutter: roundMetric(0.54 + Math.sin(flutter * Math.PI) * 0.46), stage: 'flutter' }
  }
  return { energy: 0, bud: 0, spread: 0, flutter: 0, stage: 'rest' }
}
