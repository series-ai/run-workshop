import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-beam', 'Wind beam', 'Two-draw directional gust: one bright hero current leads three subordinate pressure lanes and two narrow ground wakes while ten compact olive, sage, and rust leaves ride the middle flow before scattering.', [
  { kind: 'wind-streaks', role: 'body', opacity: 1, scale: 1.75, phase: 'wind-beam-pressure-surge', tuning: { meshGeometry: 'wind-beam-pressure-ribbons', meshMotion: 'flash', lifecycle: 'wind-beam-surge', blend: 'alpha', colorOverride: '#ffffff', positionOffset: [-1.2, -0.18, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 1, scale: 1.35, phase: 'wind-beam-flow-caught-leaves', tuning: { meshGeometry: 'wind-beam-debris-leaves', meshMotion: 'drift', lifecycle: 'wind-beam-surge', blend: 'alpha', colorOverride: '#9aaa57', positionOffset: [-1.2, -0.18, 0] } },
], 2, 0.85)
