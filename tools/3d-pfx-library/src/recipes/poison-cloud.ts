import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-cloud', 'Poison area cloud', 'Hazard-loop silhouette with murky volume and drifting motes.', [
  { kind: 'toxic-pool', role: 'volume', opacity: 0.78, scale: 1.32, phase: 'toxic-ground-pool', tuning: { meshShader: 'toxic-pool', colorOverride: '#3fe800', positionOffset: [0, 0.7, 0] } },
  { kind: 'particles', role: 'volume', opacity: 0.74, scale: 1.15, phase: 'spore-drift', tuning: { sprite: 'smoke', blend: 'alpha', motion: 'drift-cloud', countScale: 0.9, speedScale: 0.28, spawnScale: 1.65, depthScale: 3.2, size: [0.55, 1.1, 0.78], ramp: 'pigment', colorOverride: '#55b832', death: 'erode', turbulenceScale: 0.58, gravity: 0.16, speedJitter: 0.45, spinScale: 0.25 } },
  { kind: 'particles', role: 'volume', opacity: 0.9, scale: 1.12, phase: 'toxic-spore-motes', tuning: { sprite: 'glow', blend: 'additive', motion: 'drift-cloud', countScale: 0.14, speedScale: 0.22, spawnScale: 1.7, depthScale: 3.2, size: [0.1, 0.2, 0.14], ramp: 'held', colorOverride: '#b8ff58', turbulenceScale: 0.42, gravity: 0.08, speedJitter: 0.5, spinScale: 0, flicker: 0.8 } },
], 2, 1.3)
