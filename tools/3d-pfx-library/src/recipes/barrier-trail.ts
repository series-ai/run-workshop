import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-trail', 'Barrier trail', 'Barrier wake with wall shimmer and crackle points.', [
  { kind: 'particles', role: 'trail', opacity: 0.9, scale: 0.6, phase: 'barrier-trail-mote-wake', tuning: { motion: 'trail-stream', sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#4da6ff', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 5, speedJitter: 0.15, streamSpread: 0.1, spinScale: 0, turbulenceScale: 0, gravity: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.6, scale: 0.7, phase: 'barrier-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.65, scale: 0.42, phase: 'barrier-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#dff2ff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.1, speedScale: 0.35, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.25, gravity: 0.15 } },
], 2, 1.2)
