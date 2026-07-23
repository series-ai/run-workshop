import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('footstep-ambient', 'Footstep ambient', 'One-draw alternating ground cadence with four heel-toe impressions, kicked clods, and backward wake fins.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.88, scale: 0.8, phase: 'footstep-ambient-cadence-wake', tuning: { meshGeometry: 'footstep-ambient-cadence-wake' as PfxSurfaceTuning['meshGeometry'], lifecycle: 'footstep-ambient-cadence-loop' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#a98a52', positionOffset: [0, 0, 0], turbulenceScale: 0 } },
], 2, 0.9)
