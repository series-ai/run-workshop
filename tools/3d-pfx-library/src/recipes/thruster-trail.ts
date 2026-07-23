import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('thruster-trail', 'Thruster trail', 'Closed engine plume with traveling compression bands and a hot source nozzle.', [
  { kind: 'muzzle-cone', role: 'trail', opacity: 0.92, scale: 0.9, phase: 'thruster-trail-volumetric-plume', tuning: { meshGeometry: 'thruster-trail-closed-plume' as PfxSurfaceTuning['meshGeometry'], meshShader: 'thruster-trail-plume', lifecycle: 'thruster-trail-ignite-sustain-cutoff' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#ff5a1f', positionOffset: [-0.4, 0.24, 0], turbulenceScale: 0 } },
  { kind: 'impact-core', role: 'body', opacity: 0.96, scale: 0.9, phase: 'thruster-trail-source-nozzle', tuning: { meshGeometry: 'thruster-trail-nozzle-disc' as PfxSurfaceTuning['meshGeometry'], meshShader: 'thruster-trail-nozzle', lifecycle: 'thruster-trail-ignite-sustain-cutoff' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#fff2cc', positionOffset: [0.86, 0.24, 0], turbulenceScale: 0 } },
], 2, 1.4)
