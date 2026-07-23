import { authoredRecipe } from '../constants/01'

export default authoredRecipe('reflect-impact', "Reflect impact", "Return-hit contact with mirror glints and rebound ring.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'reflect-impact-mirror-glints', tuning: { window: 0.28, lifeScale: 0.85, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'sparkle', gravity: 0, impactVector: [1, 0.6, 0], spreadAngle: 0.5, delay: 0.26 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'reflect-impact-rebound-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.1)
