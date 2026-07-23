import { authoredRecipe } from '../constants/01'

export default authoredRecipe('exhaust-loop', 'Exhaust loop', 'Continuous exhaust loop with light smoke and heat wake.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'exhaust-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#6a7888' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'exhaust-loop-element-traffic', tuning: { sprite: 'smoke', size: [0.6, 0.8, 0.5], colorOverride: '#6a7888', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, blend: 'alpha', spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'exhaust-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#6a7888' } },
], 2, 0.95)
