import { authoredRecipe } from '../constants/01'

export default authoredRecipe('slime-idle', 'Slime idle', 'Elastic slime idle with ooze breath and bead orbit.', [
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'slime-idle-element-traffic', tuning: { sprite: 'splat', size: [0.55, 0.7, 0.4], colorOverride: '#00d926', ramp: 'pigment', countScale: 0.3, speedScale: 0.8, speedJitter: 0.35, turbulenceScale: 0.25, motion: 'screen-fall', gravity: 0, blend: 'alpha', spinScale: 0.85 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.45, scale: 0.4, phase: 'slime-idle-core-presence', tuning: { meshMotion: 'glow', colorOverride: '#00d926' } },
], 2, 1.15)
