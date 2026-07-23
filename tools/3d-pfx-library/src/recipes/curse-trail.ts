import { authoredRecipe } from '../constants/01'

export default authoredRecipe('curse-trail', 'Curse trail', 'Dark curse trail with hex smoke and falling runes.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'curse-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#9d2bff', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'curse-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#9d2bff' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'curse-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#d8a8ff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.0)
