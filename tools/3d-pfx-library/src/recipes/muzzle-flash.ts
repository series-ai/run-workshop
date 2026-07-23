import { authoredRecipe } from '../constants/01'

// Micro-burst anatomy (burst spec + muzzle-flash references): a white-hot
// STAR at the barrel tip for 1-3 frames, a small SATURATED-ORANGE fire
// cone along the barrel axis, and a tight forward spark spray. The old
// build was a huge washed-cream splat with no axis (user round).
export default authoredRecipe('muzzle-flash', "Directional weapon flash", "Muzzle micro-burst: white-hot tip star, orange fire cone, forward sparks.", [
  { kind: 'muzzle-cone', role: 'body', opacity: 0.92, scale: 0.76, phase: 'directional-flame-cone', tuning: { meshMotion: 'flash', window: 0.11, startScale: 0.76, colorOverride: '#fff2b3', ramp: 'hot' } },
  { kind: 'impact-sparks', role: 'trail', opacity: 0.9, scale: 0.58, phase: 'forward-spark-chips', tuning: { sprite: 'ember', colorOverride: '#ffad35', delay: 0.05, window: 0.08, lifeScale: 0.24, countScale: 0.62, speedScale: 2, speedJitter: 0.32, drag: 2.4, gravity: 0, spinScale: 0.9, stretch: 0, turbulenceScale: 0, impactVector: [1, 0, 0], spreadAngle: 0.26, size: [0.18, 0.22, 0.08], ramp: 'held' } },
  { kind: 'particles', role: 'volume', opacity: 0.68, scale: 1.1, phase: 'smoke-wisp', tuning: { sprite: 'puff', motion: 'drift-cloud', blend: 'alpha', colorOverride: '#85817e', delay: 0.045, window: 0.11, lifeScale: 0.82, countScale: 0.72, speedScale: 0.2, speedJitter: 0.3, drag: 3.2, gravity: 0.14, spinScale: 0.65, stretch: 0, turbulenceScale: 0.32, spawnScale: 0.22, positionOffset: [0.1, 0, 0], size: [0.3, 0.58, 0.82], ramp: 'dark', death: 'erode' } },
], 2, 2.2)
