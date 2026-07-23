import { authoredRecipe } from '../constants/01'

export default authoredRecipe('sand-idle', 'Sand idle', 'Low sand idle with grain haze and crawling surface pips.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'sand-idle-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#c2913f', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'sand-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#c2913f' } },
], 2, 0.81)
