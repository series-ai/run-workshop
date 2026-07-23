import { authoredRecipe } from '../constants/01'

export default authoredRecipe('leaf-idle', 'Leaf idle', 'Leaf idle with canopy drift and soft ground eddies.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'leaf-idle-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#3fb800', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'leaf-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#3fb800' } },
], 2, 0.81)
