import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-loop', 'Wind loop', 'Continuous wind field with streaked motion and sparse dust points.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.35, scale: 0.6, phase: 'wind-loop-ambient-haze', tuning: { meshMotion: 'drift', blend: 'alpha', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'wind-loop-streak-lanes', tuning: { sprite: 'streak', blend: 'additive', size: [0.8, 0.55, 0.15], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.4, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', stretch: 2, gravity: 0, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.5, scale: 0.6, phase: 'wind-loop-sparse-dust', tuning: { sprite: 'soft', blend: 'alpha', size: [0.2, 0.3, 0.12], colorOverride: '#9fd8c4', ramp: 'held', countScale: 0.2, speedScale: 0.25, speedJitter: 0.4, turbulenceScale: 0.3, motion: 'dust-loop', gravity: 0, spinScale: 0.2 } },
], 2, 0.95)
