import { roundMetric } from '../constants/03'
import { flipbookFrameCount } from '../constants/04'
import type { PfxLayerAnimationMode } from '../materials/atlas'
import type { PfxControls } from '../types/01'
import type { PfxFlipbookFrameProps } from '../types/02'

// Legacy pulse. The four old `controls.flipbook` names have no animation
// sheet; no renderer samples these frame UVs. The active surface renderer
// uses only the opacity and size multipliers, as a brightness and size pulse.
// The UI calls this field "Legacy pulse". Real atlas playback is
// `material.frameAnimation` (materials/atlas.ts).

/** No pulse: a layer with explicit frame animation, or no legacy name. */
export const PFX_NO_LEGACY_PULSE: PfxFlipbookFrameProps = Object.freeze({
  frameCount: 1,
  frameIndex: 0,
  uvOffset: Object.freeze([0, 0] as const),
  uvScale: Object.freeze([1, 1] as const),
  opacityMultiplier: 1,
  sizeMultiplier: 1,
})

/**
 * Legacy pulse values for one layer. Only `frame-animation` mode (an explicit
 * `material.frameAnimation`) removes the pulse, so atlas playback and the
 * pulse never both apply. Every other layer keeps the pulse unchanged.
 */
export function getPfxFlipbookFrameProps(
  controls: Pick<PfxControls, 'flipbook' | 'timing'>,
  elapsedSeconds: number,
  animationMode: PfxLayerAnimationMode = 'legacy-pulse',
): PfxFlipbookFrameProps {
  if (animationMode === 'frame-animation') return PFX_NO_LEGACY_PULSE
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
