import { roundMetric } from '../constants/03'
import { createPfxHealingLeafProgress } from './healingLeaf'
import { createPfxHealingRestorationPulse } from './healingRestorationPulse'
import { createPfxHealingVinePoint } from './healingVinePoint'
import type { PfxHealingLeafHelixPose } from '../types/02'

export function createPfxHealingLeafHelixLayout(elapsedSeconds: number): PfxHealingLeafHelixPose[] {
  const pulse = createPfxHealingRestorationPulse(elapsedSeconds)
  const cadenceScale = 0.28 + pulse * 0.72
  const poses: PfxHealingLeafHelixPose[] = []
  for (let step = 0; step < 22; step++) {
    const rise = createPfxHealingLeafProgress(elapsedSeconds, step, 22)
    const angle = rise * Math.PI * 2.4 + elapsedSeconds * 0.7
    const [x, y, z] = createPfxHealingVinePoint(rise)
    const scaleHash = Math.sin((step + 3) * 31.763) * 17453.21
    const variation = scaleHash - Math.floor(scaleHash)
    const scale = (0.3 + variation * 0.22 + Math.sin(rise * Math.PI) * 0.07) * cadenceScale
    poses.push({
      position: [roundMetric(x), roundMetric(y), roundMetric(z)],
      rotation: [roundMetric((step % 2 === 0 ? 1 : -1) * (0.12 + rise * 0.18)), roundMetric(-angle + Math.PI / 2), step % 2 === 0 ? 0.38 : -0.38],
      scale: roundMetric(scale),
    })
  }
  return poses
}
