import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('marker-release', 'Marker release', 'Ground clamps open around a diamond anchor while a checked confirmation badge lifts clear.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.92, scale: 0.86, phase: 'marker-release-opening-clamps', tuning: { meshGeometry: 'marker-release-ground-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'marker-release-ground', lifecycle: 'marker-release-clamp-confirm-lift-settle' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#d8e8ff', positionOffset: [0, 0.03, 0], turbulenceScale: 0 } },
  { kind: 'screen-plane', role: 'aura', opacity: 0.96, scale: 0.62, phase: 'marker-release-lifted-confirmation', tuning: { meshGeometry: 'marker-release-badge-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'marker-release-badge', lifecycle: 'marker-release-clamp-confirm-lift-settle' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#60a5fa', positionOffset: [0, 0.42, 0], turbulenceScale: 0 } },
], 2, 1.7)
