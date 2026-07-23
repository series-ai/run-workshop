import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-impact', "Dash impact", "Fast movement contact with speed pop and afterimage flecks.", [
  { kind: 'core-sphere', role: 'trail', opacity: 0.8, scale: 0.55, phase: 'dash-impact-speed-pop', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'impact', opacity: 0.44, scale: 0.5, phase: 'dash-impact-afterimage-flecks', tuning: { countScale: 0.26, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'streak', stretch: 1.6, gravity: 0, impactVector: [1, 0.1, 0], spreadAngle: 0.35, spinScale: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'dash-impact-origin-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.1)
