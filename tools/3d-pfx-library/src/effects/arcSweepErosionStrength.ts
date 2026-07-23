import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxArcSweepErosionStrength(cycle: number): number {
  const progress = THREE.MathUtils.clamp(cycle / 0.45, 0, 1)
  const ramp = THREE.MathUtils.clamp((progress - 0.45) / (0.88 - 0.45), 0, 1)
  return roundMetric(ramp * ramp * (3 - 2 * ramp))
}
