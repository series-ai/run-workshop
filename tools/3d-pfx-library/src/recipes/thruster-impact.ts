import { authoredRecipe } from '../constants/01'

export default authoredRecipe('thruster-impact', "Thruster impact", "Thruster ignition contact with hot pop and exhaust wake.", [
  { kind: 'core-sphere', role: 'body', opacity: 0.6, scale: 0.5, phase: 'thruster-impact-ignition-pop', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'trail', opacity: 0.45, scale: 0.55, phase: 'thruster-impact-exhaust-wake', tuning: { sprite: 'soft', blend: 'alpha', delay: 0.26, window: 0.28, lifeScale: 0.8, countScale: 0.3, speedScale: 0.5, gravity: 0.6, turbulenceScale: 0.4 } },
  { kind: 'particles', role: 'impact', opacity: 0.48, scale: 0.5, phase: 'thruster-impact-hot-flecks', tuning: { countScale: 0.21, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', flicker: 1.2, gravity: 0 } },
], 2, 1.9)
