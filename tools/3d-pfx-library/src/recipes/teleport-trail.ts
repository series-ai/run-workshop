import { authoredRecipe } from '../constants/01'

export default authoredRecipe('teleport-trail', 'Teleport trail', 'Teleport afterimage trail with anchor pips and space flecks.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'teleport-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0077ff', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'teleport-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#0077ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'teleport-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#ffffff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.4)
