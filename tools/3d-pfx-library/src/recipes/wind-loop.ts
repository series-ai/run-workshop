import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-loop', 'Wind loop', 'Continuous wind field with streaked motion and sparse dust points.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'wind-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'wind-loop-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.45, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'orbit-ring', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'wind-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d9a8' } },
], 2, 0.95)
