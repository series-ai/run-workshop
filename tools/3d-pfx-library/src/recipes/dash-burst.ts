import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-burst', "Dash burst", "Movement burst for dodge starts and speed pickups.", [
  { kind: 'core-sphere', role: 'impact', opacity: 0.65, scale: 0.7, phase: 'dash-burst-speed-pop', tuning: { meshMotion: 'flash' } },
  { kind: 'particles', role: 'trail', opacity: 0.5, scale: 0.48, phase: 'dash-burst-speed-points', tuning: { delay: 0.14, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'streak', stretch: 1.8, gravity: 0, spinScale: 0 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.56, phase: 'dash-burst-origin-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.45)
