import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('dash-idle', 'Dash idle', 'One-draw directional readiness reservoir: six closed swept chevrons compress behind twin forward rails and a hard launch core across four depth lanes.', [
  { kind: 'impact-shards', role: 'aura', opacity: 0.94, scale: 0.72, phase: 'dash-idle-vector-reservoir', tuning: { meshGeometry: 'dash-idle-vector-reservoir' as PfxSurfaceTuning['meshGeometry'], lifecycle: 'dash-idle-readiness-loop' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#2f9dff', positionOffset: [-0.24, -0.18, 0], turbulenceScale: 0 } },
], 2, 0.81)
