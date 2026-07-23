import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('petal-burst', 'Petal burst', 'Two-draw botanical bloom: forty crowned heart, teardrop, and ruffled petals open from a folded corolla through five depth shells while sixteen curved stamens, sixteen pollen grains, and a closed calyx core preserve a luminous floral center through the fluttering fall.', [
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 0.54, phase: 'petal-burst-three-species-corolla', tuning: { meshGeometry: 'petal-burst-sculpted-corolla' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'petal-burst-botanical-bloom' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#e85d9e', positionOffset: [0, -0.24, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 0.9, scale: 0.54, phase: 'petal-burst-stamen-pollen-calyx', tuning: { meshGeometry: 'petal-burst-stamen-pollen-calyx' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'petal-burst-botanical-bloom' as PfxSurfaceTuning['lifecycle'], blend: 'additive', colorOverride: '#ffe4d6', delay: 0.18, positionOffset: [0, -0.24, 0] } },
], 2, 1.05)
