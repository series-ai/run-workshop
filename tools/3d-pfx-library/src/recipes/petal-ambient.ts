import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-ambient', 'Petal ambient', 'Gentle looping petal ambience for cozy scenes and reward spaces.', [
  { kind: 'impact-shards', role: 'volume', opacity: 1, scale: 0.82, phase: 'petal-ambient-sculpted-breeze', tuning: { meshGeometry: 'petal-ambient-drifting-blossoms', meshMotion: 'drift', lifecycle: 'petal-ambient-breeze-loop', blend: 'alpha', colorOverride: '#f47cab', positionOffset: [0, -0.08, 0] } },
], 2, 0.9)
