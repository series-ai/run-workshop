import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-telegraph', 'Beam telegraph', 'A crisp constant-width threat lane counts down through four integrated closed-volume chevrons while an open cyan muzzle bracket anchors the beam origin.', [
  { kind: 'impact-shards', role: 'aura', opacity: 0.98, scale: 1.32, phase: 'beam-telegraph-raised-warning-lane', tuning: { meshGeometry: 'beam-telegraph-warning-lane', meshMotion: 'countdown', lifecycle: 'beam-telegraph-countdown', blend: 'alpha', colorOverride: '#f04418', positionOffset: [0, -0.68, 0] } },
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 1.15, phase: 'beam-telegraph-source-aperture', tuning: { meshGeometry: 'beam-telegraph-source-aperture', meshMotion: 'countdown', lifecycle: 'beam-telegraph-countdown', blend: 'alpha', colorOverride: '#8eefff', positionOffset: [-2.16, -0.36, 0] } },
], 2, 0.8)
