import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxArcSweepWindow(cycle: number): { progress: number; lead: number; erode: number; visibleSpan: number } {
  const progress = THREE.MathUtils.clamp(cycle / 0.62, 0, 1)
  const smoothstep = (start: number, end: number): number => {
    const amount = THREE.MathUtils.clamp((progress - start) / (end - start), 0, 1)
    return amount * amount * (3 - 2 * amount)
  }
  const lead = smoothstep(0, 0.48)
  const erode = smoothstep(0.42, 1)
  return {
    progress: roundMetric(progress),
    lead: roundMetric(lead),
    erode: roundMetric(erode),
    visibleSpan: roundMetric(Math.max(0, lead - erode)),
  }
}
