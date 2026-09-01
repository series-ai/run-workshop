import { authoredRecipe } from '../constants/01'

// Reference (docs/reference-recipes-casual-space.md B1 Engine Exhaust): the
// plume read is stretch, not count — streak sprites stretched 2-4x with a
// white-hot pinned core flickering ±20% at the nozzle.
export default authoredRecipe('thruster-idle', 'Thruster idle', 'Thruster idle with ignition hum and small flame points.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.7, scale: 0.3, phase: 'thruster-idle-nozzle-hum', tuning: { meshMotion: 'glow', blend: 'additive', colorOverride: '#ffd9b0', flicker: 1.3 } },
  { kind: 'particles', role: 'body', opacity: 0.95, scale: 0.5, phase: 'thruster-idle-ignition-flicker', tuning: { sprite: 'fire', blend: 'additive', size: [0.55, 0.4, 0.14], colorOverride: '#ff6a00', ramp: 'hot', countScale: 0.4, speedScale: 1.2, speedJitter: 0.4, turbulenceScale: 0.15, motion: 'cone-fountain', stretch: 3, gravity: 0, drag: 0.6, spinScale: 0, flicker: 1.4 } },
], 2, 0.81)
