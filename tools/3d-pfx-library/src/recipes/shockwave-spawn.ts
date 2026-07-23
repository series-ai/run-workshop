import { authoredRecipe } from '../constants/01'

// A warm pressure collar and cool volumetric shards establish the source;
// the accented wavefront propagates first and delayed dust supplies grounded
// recovery. All three jobs remain inside the mobile three-draw budget.
export default authoredRecipe('shockwave-spawn', 'Shockwave spawn', 'Animated warm-cool shard burst, propagating pressure front, and delayed grounded dust kick.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.92, scale: 1.8, phase: 'shockwave-spawn-ground-arrival-flare', tuning: { meshGeometry: 'shockwave-spawn-arrival-flare', meshMotion: 'flash', lifecycle: 'shockwave-spawn-pressure-release', blend: 'additive', colorOverride: '#ff633d', positionOffset: [0, -0.08, 0] } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 1, scale: 2.8, phase: 'shockwave-spawn-ground-front', tuning: { meshGeometry: 'shockwave-spawn-pressure-front', meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ffd56a', delay: 0, window: 0.42, positionOffset: [0, -0.08, 0] } },
  // Keep the arrival fragments under the low-end concurrent screen budget
  // even with independently seeded particle lifetimes.
  { kind: 'particles', role: 'volume', opacity: 0.9, scale: 1.5, phase: 'shockwave-spawn-ground-fragments', tuning: { motion: 'shockwave-ground-burst', sprite: 'puff', blend: 'alpha', lifecycle: 'shockwave-spawn-arrival', window: 0.48, delay: 0.13, countScale: 1.5, speedScale: 2.4, speedJitter: 0.42, gravity: -0.55, drag: 1.4, depthScale: 3, spawnScale: 1.2, spawnLift: 0.06, size: [0.3, 0.68, 0.5], stretch: 0.08, spinScale: 0.4, ramp: 'dark', colorOverride: '#9b7568', lifeScale: 0.7, death: 'erode', turbulenceScale: 0.22, positionOffset: [0, -0.08, 0] } },
], 2, 1.4)
