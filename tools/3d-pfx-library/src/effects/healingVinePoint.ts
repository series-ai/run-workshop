import * as THREE from 'three'
import { roundMetric } from '../constants/03'

export function createPfxHealingVinePoint(progress: number): [number, number, number] {
  const normalized = THREE.MathUtils.clamp(progress, 0, 1)
  const angle = normalized * Math.PI * 2.3
  const radius = 0.22 + Math.sin(normalized * Math.PI) * 0.56
  const depthRadius = radius * 0.55
  return [
    roundMetric(Math.cos(angle) * radius),
    roundMetric(-0.82 + normalized * 1.72),
    roundMetric(Math.sin(angle) * depthRadius),
  ]
}
