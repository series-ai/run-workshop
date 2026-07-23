import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('barrier-column', 'Barrier column', 'One-draw fortified sentinel with six closed defensive panels, vertical braces, energy rails, and crown pylons.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.96, scale: 0.78, phase: 'barrier-column-fortified-pillar', tuning: { meshGeometry: 'barrier-column-fortified-pillar' as PfxSurfaceTuning['meshGeometry'], lifecycle: 'barrier-column-sentinel-loop' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#2f8fe8', positionOffset: [0, -0.78, 0] } },
], 2, 0.7)
