import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('blood-death', 'Blood death', 'One-draw pigment rupture: a compact wound contracts, six closed arterial jets and twelve clots break asymmetrically through five depth lanes, then settle into an integrated oxblood pool.', [
  { kind: 'impact-shards', role: 'impact', opacity: 1, scale: 1, phase: 'blood-death-pigment-rupture', tuning: { meshGeometry: 'blood-death-pigment-rupture' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'bloom', lifecycle: 'blood-death-ballistic-collapse' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#b5121f' } },
], 2, 1.3)
