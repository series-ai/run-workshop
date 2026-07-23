import { authoredRecipe } from '../constants/01'

export default authoredRecipe('portal-trail', 'Portal trail', 'Spatial portal trail with vortex ribbon and orbiting motes.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'portal-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'magic', size: [0.5, 0.65, 0.4], colorOverride: '#7a1fff', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.7, scale: 0.75, phase: 'portal-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#7a1fff' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'portal-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#d8c8ff', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.1)
