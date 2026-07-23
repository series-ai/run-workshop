import { authoredRecipe } from '../constants/01'

export default authoredRecipe('engine-loop', 'Engine loop', 'Mechanical idle loop with hot core and subtle exhaust haze.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'engine-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#5a7ba8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'engine-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#5a7ba8', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'column-rise', gravity: 0.3, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'engine-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5a7ba8' } },
], 2, 0.95)
