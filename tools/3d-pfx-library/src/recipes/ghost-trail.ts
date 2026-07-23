import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('ghost-trail', 'Ghost trail', 'One-draw spectral procession: a faceted lead mask pulls seven closed tapered ectoplasm veils through five depth lanes while five subordinate soul motes haunt the negative-X wake.', [
  { kind: 'impact-shards', role: 'trail', opacity: 1, scale: 0.72, phase: 'ghost-trail-spectral-procession', tuning: { meshGeometry: 'ghost-trail-spectral-procession' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'travel', lifecycle: 'ghost-trail-procession' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#68e8ff' } },
], 2, 1.0)
