import { authoredRecipe } from '../constants/01'

export default authoredRecipe('landing-loop', 'Landing loop', 'Grounded landing aftermath loop with dust bed and pressure ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'landing-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#b0761f' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'landing-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#b0761f', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'landing-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#b0761f' } },
], 2, 0.95)
