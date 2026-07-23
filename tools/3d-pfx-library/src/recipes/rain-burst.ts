import { authoredRecipe } from '../constants/01'
import type { PfxSurfaceTuning } from '../types/02'

export default authoredRecipe('rain-burst', 'Rain burst', 'Two-draw wet impact: twenty-four gently bowed rain trails cross six depth lanes into a continuous closed nine-peak water crown, releasing rounded droplets while bright contact foam bridges a domed refractive puddle and two irregular surface ripples.', [
  { kind: 'impact-shards', role: 'impact', opacity: 1, scale: 0.78, phase: 'rain-burst-grounded-water-crown', tuning: { meshGeometry: 'rain-burst-water-crown' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'rain-burst-impact' as PfxSurfaceTuning['lifecycle'], blend: 'alpha', colorOverride: '#2d8fd3', positionOffset: [0, -0.88, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 1, scale: 0.78, phase: 'rain-burst-convergent-rain-foam', tuning: { meshGeometry: 'rain-burst-rain-foam' as PfxSurfaceTuning['meshGeometry'], meshMotion: 'flash', lifecycle: 'rain-burst-impact' as PfxSurfaceTuning['lifecycle'], blend: 'additive', colorOverride: '#c7f5ff', delay: 0.18, positionOffset: [0, -0.88, 0] } },
], 2, 1.1)
