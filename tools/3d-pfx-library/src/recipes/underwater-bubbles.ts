import { authoredRecipe } from '../constants/01'

export default authoredRecipe('underwater-bubbles', 'Bubble column loop', 'Low-intensity water motion using vertical bubble particles.', [
  { kind: 'bubble-shells', role: 'body', opacity: 0.92, scale: 1.02, phase: 'bubble-rim-column', tuning: { meshMotion: 'pulse', meshShader: 'bubble-surface', colorOverride: '#43c9ff' } },
  { kind: 'particles', role: 'body', opacity: 0.58, scale: 0.62, phase: 'bubble-rise', tuning: { motion: 'column-rise', sprite: 'glow', blend: 'alpha', countScale: 0.35, speedScale: 0.55, size: [0.12, 0.22, 0.08], ramp: 'held', colorOverride: '#b9efff', speedJitter: 0.4, spinScale: 0, turbulenceScale: 0.2, gravity: 0.3 } },
], 2, 0.9)
