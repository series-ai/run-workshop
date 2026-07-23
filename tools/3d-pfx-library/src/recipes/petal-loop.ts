import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-loop', 'Petal loop', 'Gentle petal field for cozy rewards, gardens, and magical ambience.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'petal-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#ff3d8a' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'petal-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#ff3d8a', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'petal-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff3d8a' } },
], 2, 0.95)
