import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-idle', 'Water idle', 'Water idle with ripple body and small droplet beads.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.85, scale: 0.5, phase: 'water-idle-water-surface', tuning: { meshShader: 'water-flow', colorOverride: '#0095ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.5, phase: 'water-idle-bubbles', tuning: { motion: 'column-rise', sprite: 'bubble', size: [0.25, 0.4, 0.55], colorOverride: '#7fd8ff', ramp: 'held', countScale: 0.2, speedScale: 0.45, speedJitter: 0.35, spinScale: 0, turbulenceScale: 0.2, gravity: 0.25 } },
], 2, 0.8)
