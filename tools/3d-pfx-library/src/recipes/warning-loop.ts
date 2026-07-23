import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('warning-loop', 'Warning loop', 'Persistent octagonal hazard boundary with contained warning glyph and restrained alert beacon.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.9, scale: 0.88, phase: 'warning-loop-octagonal-boundary', tuning: { meshGeometry: 'warning-loop-panel-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'warning-loop-panel', lifecycle: 'warning-loop-inhale-alert-exhale' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#ff5b35', positionOffset: [0, 0.025, 0], turbulenceScale: 0 } },
  { kind: 'screen-plane', role: 'aura', opacity: 0.88, scale: 0.58, phase: 'warning-loop-alert-beacon', tuning: { meshGeometry: 'warning-loop-beacon-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'warning-loop-beacon', lifecycle: 'warning-loop-inhale-alert-exhale' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#ffd166', positionOffset: [0, 0.68, 0], turbulenceScale: 0 } },
], 2, 1.35)
