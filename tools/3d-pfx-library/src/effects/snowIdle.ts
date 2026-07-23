import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxSnowIdleLifecycle(cycle: number): {
  density: number
  fall: number
  gust: number
  stage: 'drift' | 'gust' | 'settle'
} {
  const phase = ((cycle % 1) + 1) % 1
  if (phase < 0.25 || phase >= 0.78) {
    return {
      density: roundMetric(0.7 + Math.max(0, Math.sin(phase * Math.PI * 2)) * 0.08),
      fall: roundMetric(0.34 + Math.cos(phase * Math.PI * 2) * 0.08),
      gust: roundMetric(0.16 + Math.sin(phase * Math.PI) * 0.1),
      stage: 'drift',
    }
  }
  if (phase < 0.5) {
    const gust = THREE.MathUtils.smoothstep(phase, 0.25, 0.5)
    return {
      density: roundMetric(0.82 + gust * 0.18),
      fall: roundMetric(0.38 + gust * 0.2),
      gust: roundMetric(0.34 + gust * 0.66),
      stage: 'gust',
    }
  }
  const settle = THREE.MathUtils.smoothstep(phase, 0.5, 0.78)
  return {
    density: roundMetric(1 - settle * 0.3),
    fall: roundMetric(0.58 - settle * 0.26),
    gust: roundMetric(0.82 - settle * 0.62),
    stage: 'settle',
  }
}
