import { authoredRecipe } from '../constants/01'

// Craft guide §7/§10: drag-stalled streak lanes carry the wind read; a
// low-alpha haze volume fuses the field; sparse twinkle dust stays subordinate.
export default authoredRecipe('wind-loop', 'Wind loop', 'Continuous wind field with streaked motion and sparse dust points.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.65, phase: 'wind-loop-ambient-haze', tuning: { meshMotion: 'drift', blend: 'alpha', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.68, phase: 'wind-loop-streak-lanes', tuning: { sprite: 'streak', blend: 'additive', size: [1.0, 0.65, 0.2], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.55, speedScale: 1.0, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', stretch: 3, gravity: 0, drag: 2, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.6, phase: 'wind-loop-sparse-dust', tuning: { sprite: 'twinkle', blend: 'additive', size: [0.24, 0.34, 0.14], colorOverride: '#9fd8c4', ramp: 'held', countScale: 0.22, speedScale: 0.3, speedJitter: 0.4, turbulenceScale: 0.3, motion: 'dust-loop', gravity: 0, drag: 2.5, spinScale: 0.2 } },
], 2, 0.95)
