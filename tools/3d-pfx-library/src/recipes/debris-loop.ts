import { authoredRecipe } from '../constants/01'

export default authoredRecipe('debris-loop', 'Debris loop', 'Persistent destruction ambience with floating chips and low dust.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'debris-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#8f6d33' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'debris-loop-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#8f6d33', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'debris-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#8f6d33' } },
], 2, 0.95)
