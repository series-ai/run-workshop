import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-loop', 'Water loop', 'Persistent water motion with droplets, mist, and a small surface ring.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.85, scale: 0.7, phase: 'water-loop-ground-circle', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#0095ff' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.92, scale: 0.62, phase: 'water-loop-water-surface', tuning: { meshShader: 'water-flow', colorOverride: '#0095ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.55, phase: 'water-loop-bubbles', tuning: { motion: 'column-rise', sprite: 'bubble', size: [0.3, 0.45, 0.6], colorOverride: '#7fd8ff', ramp: 'held', countScale: 0.3, speedScale: 0.5, speedJitter: 0.35, spinScale: 0, turbulenceScale: 0.2, gravity: 0.3 } },
], 2, 0.95)
