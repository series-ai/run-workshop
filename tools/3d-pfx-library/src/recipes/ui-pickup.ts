import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('ui-pickup', 'UI pickup', 'One-quad HUD receipt with an angular token, +1 readout, and upward deposit chevrons.', [
  { kind: 'screen-plane', role: 'screen', opacity: 0.96, scale: 0.52, phase: 'ui-pickup-token-rise-receipt', tuning: { meshGeometry: 'screen-space-pickup-receipt-quad' as PfxSurfaceTuning['meshGeometry'], meshShader: 'ui-pickup-receipt', lifecycle: 'ui-pickup-collect-rise-deposit' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#ffcf4d', positionOffset: [1.35, 1.45, 0], turbulenceScale: 0 } },
], 2, 1.85)
