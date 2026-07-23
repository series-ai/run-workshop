import { authoredRecipe } from '../constants/01'

export default authoredRecipe('petal-idle', 'Petal idle', 'Blossom petal idle with falling petals and soft perfume haze.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'petal-idle-element-traffic', tuning: { sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#ff3d8a', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'petal-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#ff3d8a' } },
], 2, 0.81)
