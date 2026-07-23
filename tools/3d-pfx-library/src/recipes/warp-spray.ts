import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('warp-spray', 'Warp spray', 'Mobile-safe hero warp: preserve the high-value vortex body and consolidate displaced space matter into one closed faceted batch without particles, ground-ring redundancy, or a separate snapshot pass.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.95, scale: 0.82, phase: 'warp-spray-hero-vortex', tuning: { meshShader: 'vortex-swirl', meshMotion: 'bloom', blend: 'alpha', colorOverride: '#7a1fff' } },
  { kind: 'impact-shards', role: 'aura', opacity: 0.82, scale: 0.72, phase: 'warp-spray-displaced-facets', tuning: { meshGeometry: 'warp-spray-displaced-facets' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'travel', lifecycle: 'impact-shard-burst', blend: 'alpha', colorOverride: '#76cfff' } },
], 2, 0.9)
