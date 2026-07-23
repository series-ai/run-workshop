import { authoredRecipe } from '../constants/01'

// Spawn spec grunt tier (low budget, 3 layers): anchor ring builds via its
// charge motion -> 1-3 frame conceal flash at peak -> dust settles.
export default authoredRecipe('spawn-marker', 'Spawn placement marker', 'Grunt spawn: charge ring marks WHERE, conceal flash, dust settles.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 1.15, phase: 'spawn-marker-spawn-circle', tuning: { ringPurpose: 'reticle', colorOverride: '#9d5bff' } },
  { kind: 'core-sphere', role: 'impact', opacity: 0.98, scale: 0.78, phase: 'spawn-marker-conceal-flash', tuning: { meshMotion: 'flash', colorOverride: '#f4e8ff', positionOffset: [0, 0.22, 0], delay: 0.12, window: 0.16, startScale: 0.42 } },
  { kind: 'particles', role: 'impact', opacity: 0.84, scale: 0.7, phase: 'spawn-marker-settle-dust', tuning: { motion: 'cone-fountain', sprite: 'puff', blend: 'alpha', ramp: 'dark', colorOverride: '#7a68a8', positionOffset: [0, -0.5, 0], delay: 0.2, window: 0.38, lifeScale: 0.7, countScale: 0.68, speedScale: 1.4, speedJitter: 0.35, drag: 1.6, gravity: -1.4, spawnScale: 0.8, spreadAngle: 0.9, spinScale: 0, turbulenceScale: 0.15, size: [0.5, 0.82, 0.9], death: 'erode' } },
], 2, 1.6)
