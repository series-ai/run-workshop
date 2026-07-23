import { authoredRecipe } from '../constants/01'

export default authoredRecipe('marker-idle', 'Marker idle', 'Marker idle with anchor pulse and placement pips.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'marker-idle-element-traffic', tuning: { sprite: 'sparkle', size: [0.35, 0.5, 0.3], colorOverride: '#0080ff', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.15, turbulenceScale: 0, motion: 'column-rise', gravity: 0.3, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'marker-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#0080ff' } },
], 2, 0.68)
