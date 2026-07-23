import { authoredRecipe } from '../constants/01'

export default authoredRecipe('scan-trail', 'Scan trail', 'Data scan trail with sweep ribbon and point samples.', [
  { kind: 'particles', role: 'trail', opacity: 0.9, scale: 0.6, phase: 'scan-trail-mote-wake', tuning: { motion: 'trail-stream', sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#00d9b0', ramp: 'held', countScale: 0.35, lifeScale: 0.7, speedScale: 5, speedJitter: 0.15, streamSpread: 0.1, spinScale: 0, turbulenceScale: 0, gravity: 0, flicker: 0.8 } },
  { kind: 'tapered-trail', role: 'trail', opacity: 0.6, scale: 0.7, phase: 'scan-trail-taper-body', tuning: { meshShader: 'trail-flow', colorOverride: '#00d9b0' } },
  { kind: 'particles', role: 'aura', opacity: 0.65, scale: 0.42, phase: 'scan-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#bff2e8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.1, speedScale: 0.35, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.25, gravity: 0.15 } },
], 2, 1.4)
