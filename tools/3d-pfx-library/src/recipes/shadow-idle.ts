import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shadow-idle', 'Shadow idle', 'Void idle with dark breath and ink wake.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'shadow-idle-element-traffic', tuning: { sprite: 'twirl', size: [0.5, 0.6, 0.35], colorOverride: '#6a26e8', ramp: 'held', countScale: 0.3, speedScale: 0.8, speedJitter: 0.5, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'shadow-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#6a26e8', flicker: 1.4 } },
], 2, 1.15)
