import { authoredRecipe } from '../constants/01'

// MIRROR of beam-burst (same discharge phenomenon), laser theme: hot
// red, tighter, faster.
export default authoredRecipe('laser-burst', 'Laser burst', 'Focused discharge mirroring the beam system: hot red lance pop, edge sparks, muzzle ring.', [
  { kind: 'beam-column', role: 'body', opacity: 0.7, scale: 0.75, phase: 'laser-burst-core-lance', tuning: { meshMotion: 'flash', colorOverride: '#ff5d4d', widthScale: 0.7 } },
  {
    kind: 'particles',
    role: 'body',
    opacity: 0.6,
    scale: 0.45,
    phase: 'laser-burst-edge-sparks',
    tuning: { sprite: 'streak', stretch: 1.8, gravity: 0, delay: 0.12, window: 0.14, lifeScale: 0.58, speedScale: 1.5, drag: 5, size: [1.1, 0.8, 0.16], spinScale: 0, ramp: 'pinned-hot', ease: 'snap', turbulenceScale: 0, colorOverride: '#ff8a6e' },
  },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.5, phase: 'laser-burst-muzzle-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave', colorOverride: '#ff5d4d' } },
], 2, 1.45)
