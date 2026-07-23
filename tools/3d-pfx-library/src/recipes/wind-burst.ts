import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('wind-burst', 'Wind burst', 'Two-draw directional air-pressure release: nine closed helical airfoil bodies unfurl from an axial compression knot while eighteen curved vapor wisps expose the corkscrewing atmospheric flow across six depth lanes.', [
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 0.9, phase: 'wind-burst-helical-pressure-rosette', tuning: { meshGeometry: 'wind-burst-pressure-rosette' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'wind-burst-release' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#dff9ff', positionOffset: [-1.02, 0, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 0.94, scale: 0.9, phase: 'wind-burst-curved-vapor-wisps', tuning: { meshGeometry: 'wind-burst-wake-wisps' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'wind-burst-release' as PfxSurfaceTuning['lifecycle'], blend: 'additive', colorOverride: '#72cde8', positionOffset: [-1.02, 0, 0] } },
], 2, 1.15)
