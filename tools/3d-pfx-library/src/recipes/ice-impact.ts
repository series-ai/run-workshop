import { authoredRecipe } from '../constants/01'

export default authoredRecipe('ice-impact', 'Ice impact', 'Single-draw directional cold contact: forward truncated splinters, ground-hugging rime plates, and seven faceted airborne chips merged into one closed crystal mesh.', [
  { kind: 'impact-shards', role: 'impact', opacity: 1, scale: 1.32, phase: 'ice-impact-grounded-strike', tuning: { meshGeometry: 'ice-impact-grounded-splinters', meshMotion: 'flash', lifecycle: 'ice-impact-contact', blend: 'alpha', colorOverride: '#bfe8ff', positionOffset: [0, -0.56, 0] } },
], 2, 2.0)
