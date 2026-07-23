import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-loop', 'Leaf loop', 'Cozy environmental leaf loop for forest paths and calm reward spaces.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'leaf-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#3fb800' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'leaf-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#3fb800', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'leaf-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#3fb800' } },
], 2, 0.95)
