import { authoredRecipe } from '../constants/01'

export default authoredRecipe('wind-idle', 'Wind idle', 'Air current idle with ribbon-like streak flow and a soft drifting haze.', [
  { kind: 'cloud-volume', role: 'volume', opacity: 0.3, scale: 0.55, phase: 'wind-idle-current-haze', tuning: { meshMotion: 'drift', blend: 'alpha', colorOverride: '#00d9a8' } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.62, phase: 'wind-idle-ribbon-flow', tuning: { sprite: 'streak', blend: 'additive', size: [0.7, 0.5, 0.15], colorOverride: '#00d9a8', ramp: 'held', countScale: 0.3, speedScale: 0.7, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', stretch: 2, gravity: 0, spinScale: 0 } },
], 2, 0.81)
