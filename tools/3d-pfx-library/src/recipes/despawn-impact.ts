import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('despawn-impact', 'Despawn impact', 'One-draw absence cage: a ground seal holds beneath three body-height contours while ten closed fragments pull inward, the void core lifts, and the whole displaced silhouette erases upward.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.94, scale: 0.9, phase: 'despawn-impact-absence-collapse', tuning: { meshGeometry: 'despawn-impact-absence-cage' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'break', lifecycle: 'despawn-impact-collapse' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#8fc8ef' } },
], 2, 0.8)
