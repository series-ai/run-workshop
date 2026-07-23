import { authoredRecipe } from '../constants/01'

export default authoredRecipe('parry-impact', "Parry impact", "Timing contact with counter spark, ticks, and compact shock ring.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.62, scale: 0.5, phase: 'parry-impact-counter-spark', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'streak', stretch: 2.2, gravity: 0, colorOverride: '#ffcf4d', bands: 3, impactVector: [1, 0.4, 0], spreadAngle: 0.55 } },
  { kind: 'particles', role: 'impact', opacity: 0.42, scale: 0.5, phase: 'parry-impact-timing-ticks', tuning: { countScale: 0.26, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: -1.8 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'parry-impact-counter-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.2)
