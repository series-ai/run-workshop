import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function getPfxLaserSprayShotVisibility(cycle: number, sequence: number): number {
  const normalizedSequence = THREE.MathUtils.clamp(sequence, 0, 1)
  const shotStart = 0.005 + normalizedSequence * 0.22
  const shotAttack = THREE.MathUtils.smoothstep(cycle, shotStart, shotStart + 0.035)
  const shotRelease = 1 - THREE.MathUtils.smoothstep(cycle, 0.5, 0.66)
  const recoveryGhost = THREE.MathUtils.smoothstep(cycle, 0.6, 0.68)
    * (1 - THREE.MathUtils.smoothstep(cycle, 0.68, 0.8))
    * 0.28
  return roundMetric(Math.max(shotAttack * shotRelease, recoveryGhost))
}
