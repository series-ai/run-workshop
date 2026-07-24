import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-idle', 'Thruster idle', 'Thruster idle with ignition hum and small flame points.', [
  { kind: 'particles', role: 'body', opacity: 0.9, scale: 0.5, phase: 'thruster-idle-ignition-flicker', tuning: { sprite: 'flame', blend: 'additive', size: [0.4, 0.55, 0.3], colorOverride: '#ff6a00', ramp: 'hot', countScale: 0.25, speedScale: 0.7, speedJitter: 0.4, turbulenceScale: 0.2, motion: 'cone-fountain', gravity: -0.15, drag: 1.6, spinScale: 0, flicker: 1.6 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.55, scale: 0.32, phase: 'thruster-idle-nozzle-hum', tuning: { meshMotion: 'glow', blend: 'additive', colorOverride: '#ffb066', flicker: 1.4 } },
], 2, 0.81)
