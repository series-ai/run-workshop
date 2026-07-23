import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('exhaust-telegraph', 'Exhaust telegraph', 'A stable directional hazard lane counts down toward a mechanical source vent before release.', [
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.94, scale: 0.92, phase: 'exhaust-telegraph-danger-lane', tuning: { meshGeometry: 'exhaust-telegraph-warning-lane' as PfxSurfaceTuning['meshGeometry'], meshShader: 'exhaust-telegraph-lane', lifecycle: 'exhaust-telegraph-arm-countdown-vent' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#ff8a3d', positionOffset: [-0.28, 0.025, 0], turbulenceScale: 0 } },
  { kind: 'impact-core', role: 'body', opacity: 0.9, scale: 0.92, phase: 'exhaust-telegraph-source-vent', tuning: { meshGeometry: 'exhaust-telegraph-source-vent' as PfxSurfaceTuning['meshGeometry'], meshShader: 'exhaust-telegraph-vent', lifecycle: 'exhaust-telegraph-arm-countdown-vent' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#6f7782', positionOffset: [1.05, 0.28, 0], turbulenceScale: 0 } },
], 2, 1.25)
