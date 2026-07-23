import { authoredRecipe } from '../constants/01'

export default authoredRecipe('mud-idle', 'Mud idle', 'Wet mud idle with settling splat and slow bubbles.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'mud-idle-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#7a3d0d', ramp: 'pigment', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'mud-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#7a3d0d' } },
], 2, 1.15)
