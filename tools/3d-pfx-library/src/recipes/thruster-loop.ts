import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-loop', 'Thruster loop', 'Sustained thruster plume with stable nozzle core and ion flecks.', [
  { kind: 'particles', role: 'body', opacity: 0.95, scale: 0.62, phase: 'thruster-loop-sustained-plume', tuning: { sprite: 'flame', blend: 'additive', size: [0.5, 0.7, 0.35], colorOverride: '#ff6a00', ramp: 'hot', countScale: 0.4, speedScale: 0.9, speedJitter: 0.3, turbulenceScale: 0.15, motion: 'cone-fountain', gravity: -0.2, drag: 1.4, spinScale: 0, flicker: 1.2 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.65, scale: 0.34, phase: 'thruster-loop-nozzle-core', tuning: { meshMotion: 'glow', blend: 'additive', colorOverride: '#ffb066' } },
  { kind: 'particles', role: 'aura', opacity: 0.8, scale: 0.55, phase: 'thruster-loop-ion-flecks', tuning: { sprite: 'streak', blend: 'additive', size: [0.3, 0.2, 0.1], colorOverride: '#ffd166', ramp: 'pinned-hot', countScale: 0.2, speedScale: 1.5, speedJitter: 0.5, turbulenceScale: 0.1, motion: 'cone-fountain', stretch: 2, gravity: -0.3, drag: 0.8, spinScale: 0 } },
], 2, 0.95)
