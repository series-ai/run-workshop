import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('jump-beam', 'Jump beam', 'One-draw updraft accelerator with grounded induction rings, rising helical vanes, stepped lift arrows, and a crown aperture.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.97, scale: 0.78, phase: 'jump-beam-updraft-accelerator', tuning: { meshGeometry: 'jump-beam-updraft-accelerator' as PfxSurfaceTuning['meshGeometry'], lifecycle: 'jump-beam-lift-loop' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#2f9dff', positionOffset: [0, -0.52, 0], turbulenceScale: 0 } },
], 2, 0.9)
