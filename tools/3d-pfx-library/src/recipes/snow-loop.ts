import { authoredRecipe } from '../constants/01'

export default authoredRecipe('snow-loop', 'Snow loop', 'Localized snowfall loop with soft flakes and a winter haze volume.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'snow-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#5ab8ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'snow-loop-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#5ab8ff', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.15, turbulenceScale: 0, motion: 'screen-fall', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'snow-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#5ab8ff' } },
], 2, 0.95)
