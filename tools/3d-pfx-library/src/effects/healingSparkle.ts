import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { createPfxHealingVinePoint } from './healingVinePoint'
import type { PfxHealingSparklePose } from '../types/02'

export function createPfxHealingSparkleGeometry(): THREE.OctahedronGeometry {
  return new THREE.OctahedronGeometry(0.055, 0)
}

export function createPfxHealingSparkleLayout(elapsedSeconds: number): PfxHealingSparklePose[] {
  return Array.from({ length: 12 }, (_, index) => {
    const rise = (elapsedSeconds / 1.2 + index / 12) % 1
    const [baseX, y, baseZ] = createPfxHealingVinePoint(rise)
    const side = index % 2 === 0 ? 1 : -1
    return {
      position: [roundMetric(baseX * side), y, roundMetric(baseZ * side)],
      rotation: [roundMetric(elapsedSeconds * 1.7 + index), roundMetric(index * 0.71), roundMetric(elapsedSeconds * 2.1)],
      scale: roundMetric(0.45 + Math.sin(rise * Math.PI) * 0.22),
    }
  })
}
