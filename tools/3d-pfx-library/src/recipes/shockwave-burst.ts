import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('shockwave-burst', 'Shockwave burst', 'A compact pressure lens releases one bowed segmented force front with hard flecks, then attenuates into clean air.', [
  { kind: 'impact-shards', role: 'impact', opacity: 0.98, scale: 0.96, phase: 'shockwave-burst-bowed-pressure-front', tuning: { meshGeometry: 'shockwave-burst-broken-pressure-dome' as PfxSurfaceTuning['meshGeometry'], meshShader: 'shockwave-burst-pressure-front' as PfxSurfaceTuning['meshShader'], lifecycle: 'shockwave-burst-compress-expand-attenuate' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', ringPurpose: 'shockwave', colorOverride: '#ff7a18', positionOffset: [0, 0.18, 0], turbulenceScale: 0 } },
], 2, 1.7)
