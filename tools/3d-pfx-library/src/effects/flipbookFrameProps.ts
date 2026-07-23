import { roundMetric } from '../constants/03'
import { flipbookFrameCount } from '../constants/04'
import type { PfxControls } from '../types/01'
import type { PfxFlipbookFrameProps } from '../types/02'

export function getPfxFlipbookFrameProps(
  controls: Pick<PfxControls, 'flipbook' | 'timing'>,
  elapsedSeconds: number,
): PfxFlipbookFrameProps {
  const frameCount = flipbookFrameCount(controls.flipbook)
  if (frameCount === 1) {
    return {
      frameCount,
      frameIndex: 0,
      uvOffset: [0, 0],
      uvScale: [1, 1],
      opacityMultiplier: 1,
      sizeMultiplier: 1,
    }
  }
  const columns = controls.flipbook === 'magic-12' ? 4 : controls.flipbook === 'impact-6' ? 3 : 4
  const rows = Math.ceil(frameCount / columns)
  const frameRate = controls.flipbook === 'impact-6' ? 18 : controls.flipbook === 'smoke-8' ? 10 : 14
  const frameIndex = Math.floor(Math.max(0, elapsedSeconds) * frameRate * controls.timing) % frameCount
  const column = frameIndex % columns
  const row = Math.floor(frameIndex / columns)
  const phase = frameIndex / Math.max(1, frameCount - 1)

  return {
    frameCount,
    frameIndex,
    uvOffset: [roundMetric(column / columns), roundMetric(row / rows)],
    uvScale: [roundMetric(1 / columns), roundMetric(1 / rows)],
    opacityMultiplier: roundMetric(0.72 + Math.sin(phase * Math.PI) * 0.28),
    sizeMultiplier: roundMetric(0.9 + phase * 0.18),
  }
}
