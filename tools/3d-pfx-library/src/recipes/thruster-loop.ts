import { authoredRecipe } from '../constants/01'

// Reference (docs/reference-recipes-casual-space.md B1 Engine Exhaust):
// 30-60/s stretched streak plume (stretch 2-4x), white-hot pinned nozzle
// core, spark shed accents. No gravity, minimal drag — the genre's vacuum.
export default authoredRecipe('thruster-loop', 'Thruster loop', 'Sustained thruster plume with stable nozzle core and ion flecks.', [
  { kind: 'core-sphere', role: 'body', opacity: 0.75, scale: 0.34, phase: 'thruster-loop-nozzle-core', tuning: { meshMotion: 'glow', blend: 'additive', colorOverride: '#ffd9b0', flicker: 1.2 } },
  { kind: 'particles', role: 'body', opacity: 0.95, scale: 0.62, phase: 'thruster-loop-sustained-plume', tuning: { sprite: 'fire', blend: 'additive', size: [0.7, 0.45, 0.14], colorOverride: '#ff6a00', ramp: 'hot', countScale: 0.55, speedScale: 1.7, speedJitter: 0.3, turbulenceScale: 0.12, motion: 'cone-fountain', stretch: 4, gravity: 0, drag: 0.4, spinScale: 0, flicker: 1.1 } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.55, phase: 'thruster-loop-ion-flecks', tuning: { sprite: 'spark', blend: 'additive', size: [0.26, 0.18, 0.08], colorOverride: '#ffd166', ramp: 'pinned-hot', countScale: 0.28, speedScale: 2.1, speedJitter: 0.5, turbulenceScale: 0.1, motion: 'cone-fountain', stretch: 2, gravity: 0, drag: 0.8, spinScale: 0 } },
], 2, 0.95)
