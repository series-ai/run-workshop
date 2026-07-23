import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('debris-burst', 'Debris burst', 'A compact fractured mass snaps into asymmetric hero slabs, mid-size chips, and hard splinters, then arcs downward and darkens cleanly.', [
  { kind: 'impact-shards', role: 'impact', opacity: 0.98, scale: 0.85, phase: 'debris-burst-asymmetric-breakup', tuning: { meshGeometry: 'debris-burst-fractured-mass' as PfxSurfaceTuning['meshGeometry'], meshShader: 'debris-burst-ballistic-breakup' as PfxSurfaceTuning['meshShader'], lifecycle: 'debris-burst-fracture-eject-fall' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#7c8796', positionOffset: [0, -0.18, 0], turbulenceScale: 0 } },
], 2, 1.3)
