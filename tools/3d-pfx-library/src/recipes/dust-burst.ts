import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('dust-burst', 'Dust burst', 'A compressed ground contact rolls into one radial pigment crown with a low skirt and hard grit, then settles without a smoke column or radius ring.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.94, scale: 0.84, phase: 'dust-burst-radial-rolling-crown', tuning: { meshGeometry: 'dust-burst-grounded-crown' as PfxSurfaceTuning['meshGeometry'], meshShader: 'dust-burst-pigment-roll' as PfxSurfaceTuning['meshShader'], lifecycle: 'dust-burst-compress-roll-settle' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#b99764', positionOffset: [0, -0.42, 0], turbulenceScale: 0 } },
], 2, 1.15)
