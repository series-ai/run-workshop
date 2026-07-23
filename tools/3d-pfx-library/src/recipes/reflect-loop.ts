import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-loop', 'Reflect loop', 'Reflective defense loop with return wave and defensive shimmer.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.75, phase: 'reflect-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#4da6ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'reflect-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#4da6ff', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'reflect-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#4da6ff' } },
], 2, 0.8)
