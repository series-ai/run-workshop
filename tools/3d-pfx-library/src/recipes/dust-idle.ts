import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dust-idle', 'Dust idle', 'Settled ground haze with tiny drifting grains.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'dust-idle-element-traffic', tuning: { sprite: 'puff', size: [0.6, 0.8, 0.5], colorOverride: '#b0761f', ramp: 'held', countScale: 0.3, speedScale: 0.6, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'drift-cloud', gravity: 0.1, blend: 'alpha', spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'dust-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#b0761f' } },
], 2, 0.81)
