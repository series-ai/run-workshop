import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('teleport-hit', 'Teleport hit', 'One-draw spatial arrival scar: a grounded broken aperture catches the landing while twin vertical afterimage spines, eight radial fractures, and four cardinal pylons resolve the displaced volume.', [
  { kind: 'impact-shards', role: 'impact', opacity: 0.96, scale: 0.92, phase: 'teleport-hit-arrival-scar', tuning: { meshGeometry: 'teleport-hit-arrival-scar' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'teleport-hit-arrival' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#54bfff' } },
], 2, 0.72)
