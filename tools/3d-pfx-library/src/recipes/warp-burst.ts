import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warp-burst', "Warp burst", "Spatial distortion burst with shear streaks and origin ring.", [
  { kind: 'particles', role: 'trail', opacity: 0.8, scale: 0.64, phase: 'warp-burst-shear-streak', tuning: { sprite: 'streak', stretch: 2.2, gravity: 0, lifeScale: 0.3, spinScale: 0, window: 0.2, countScale: 0.2, speedScale: 2, drag: 3, turbulenceScale: 0, size: [0.9, 0.6, 0.15], ramp: 'held' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.42, scale: 0.64, phase: 'warp-burst-origin-rim', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'aura', opacity: 0.52, scale: 0.54, phase: 'warp-burst-pixel-flecks', tuning: { delay: 0.14, window: 0.14, lifeScale: 0.6, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: 0, spinScale: 1.4, countScale: 0.88 } },
], 2, 1.4)
