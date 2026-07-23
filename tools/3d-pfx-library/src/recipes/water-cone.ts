import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-cone', 'Water cone', 'Source-anchored conical liquid sheet with directional droplet breakup.', [
  { kind: 'water-cone-sheet', role: 'body', opacity: 0.78, scale: 1.16, phase: 'water-cone-connected-sheet', tuning: { meshShader: 'water-flow', meshMotion: 'travel', lifecycle: 'water-cone-surge', blend: 'alpha', colorOverride: '#2aaee8', positionOffset: [0, 0.42, 0] } },
  { kind: 'particles', role: 'body', opacity: 0.9, scale: 0.86, phase: 'water-cone-target-droplets', tuning: { sprite: 'glow', blend: 'additive', lifecycle: 'water-cone-surge', colorOverride: '#b9f4ff', ramp: 'pinned-hot', death: 'erode', delay: 0.06, window: 0.62, lifeScale: 0.68, countScale: 0.72, speedScale: 1.05, speedJitter: 0.26, drag: 0.68, gravity: -3.4, spawnScale: 0.48, spawnLift: 0.16, depthScale: 1.5, turbulenceScale: 0.08, spinScale: 0, impactVector: [1, 0.18, 0], spreadAngle: 0.55, size: [0.14, 0.28, 0.08], positionOffset: [1.18, 0.4, 0] } },
], 2, 0.92)
