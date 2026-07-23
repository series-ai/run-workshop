import { authoredRecipe } from '../constants/01'

export default authoredRecipe('poison-trail', 'Poison trail', 'Toxic movement trail with vapor stream and spore motes.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'poison-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'glow', size: [0.45, 0.6, 0.35], colorOverride: '#3fe800', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0, flicker: 0.8 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'poison-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#3fe800' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'poison-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#baff8a', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.1)
