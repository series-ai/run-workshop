import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('snow-burst', 'Snow burst', 'Two-draw cold impact: twelve three-plane dendrite sculptures and readable diamond powder open through three radial depth shells, then settle under gravity into irregular ground contact.', [
  { kind: 'impact-shards', role: 'impact', opacity: 1, scale: 0.82, phase: 'snow-burst-radial-crystal-bloom', tuning: { meshGeometry: 'snow-burst-crystal-bloom' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'snow-burst-impact' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#edfaff', positionOffset: [0, -0.28, 0] } },
  { kind: 'impact-shards', role: 'volume', opacity: 0.92, scale: 0.82, phase: 'snow-burst-volumetric-powder-drift', tuning: { meshGeometry: 'snow-burst-powder-drift' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'snow-burst-impact' as PfxSurfaceTuning['lifecycle'], blend: 'additive', colorOverride: '#5bbde8', positionOffset: [0, -0.28, 0] } },
], 2, 1.1)
