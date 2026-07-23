import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('portal-telegraph', 'Portal telegraph', 'One-draw arrival warning: a stable closed danger boundary surrounds a recessed aperture while eight inward wedges count down between four raised cardinal pylons before the breach flashes.', [
  { kind: 'impact-shards', role: 'aura', opacity: 1, scale: 1, phase: 'portal-telegraph-countdown-aperture', tuning: { meshGeometry: 'portal-telegraph-countdown-aperture' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'countdown', lifecycle: 'portal-telegraph-countdown' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#8d46ff' } },
], 2, 0.6)
