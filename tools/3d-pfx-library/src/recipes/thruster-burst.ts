import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-burst', "Thruster burst", "Directional thrust start with a readable plume and ionized rim.", [
  { kind: 'particles', role: 'trail', opacity: 0.9, scale: 0.7, phase: 'thruster-burst-plume-streak', tuning: { sprite: 'fire', spinScale: 0, gravity: 0, lifeScale: 0.5, window: 0.5, stretch: 1.2, countScale: 0.3, speedScale: 2, drag: 1.5, turbulenceScale: 0, impactVector: [1, 0.12, 0], spreadAngle: 0.25, size: [0.9, 0.7, 0.2], ramp: 'held' } },
  { kind: 'core-sphere', role: 'body', opacity: 0.52, scale: 0.24, phase: 'thruster-burst-nozzle-core', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'trail', opacity: 0.48, scale: 0.46, phase: 'thruster-burst-ion-flecks', tuning: { delay: 0, window: 0.45, lifeScale: 0.62, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: 0, flicker: 1.2, countScale: 0.8 } },
], 2, 1.35)
