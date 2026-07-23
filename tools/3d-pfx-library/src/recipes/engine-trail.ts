import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-trail', 'Engine trail', 'Mechanical carbon stream with heat haze and ignition flecks.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'engine-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#5a7ba8', ramp: 'dark', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0.4, spinScale: 0, blend: 'alpha' } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'engine-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#5a7ba8' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'engine-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#c8c8c8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.4)
