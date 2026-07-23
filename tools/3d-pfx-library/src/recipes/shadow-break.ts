import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('shadow-break', 'Shadow break', 'One-draw shadow rupture: a faceted ink shell gathers, splits along a cold-lilac void seam, then twelve asymmetric closed fragments disperse through five depth lanes before the residue pinches shut.', [
  { kind: 'impact-shards', role: 'impact', opacity: 1, scale: 1, phase: 'shadow-break-rupture-cluster', tuning: { meshGeometry: 'shadow-break-rupture-cluster' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'bloom', lifecycle: 'shadow-break-rupture' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#7a3fc2' } },
], 2, 1.3)
