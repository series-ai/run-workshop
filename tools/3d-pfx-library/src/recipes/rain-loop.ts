import { authoredRecipe } from '../constants/01'

export default authoredRecipe('rain-loop', 'Rain loop', 'Localized rainfall loop with streaks and subdued splash points.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.4, scale: 0.6, phase: 'rain-loop-ambient-haze', tuning: { meshMotion: 'bloom', blend: 'alpha', colorOverride: '#0095ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.9, scale: 0.62, phase: 'rain-loop-element-traffic', tuning: { sprite: 'streak', size: [0.7, 0.5, 0.15], colorOverride: '#0095ff', ramp: 'held', countScale: 0.45, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.5, scale: 0.4, phase: 'rain-loop-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0095ff' } },
], 2, 0.95)
