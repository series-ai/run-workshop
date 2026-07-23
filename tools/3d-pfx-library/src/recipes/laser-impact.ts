import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-impact', "Laser impact", "Hard-light laser contact with ricochet flecks.", [
  { kind: 'beam-column', role: 'body', opacity: 0.42, scale: 0.58, phase: 'laser-impact-hard-light-line', tuning: { meshMotion: 'flash', colorOverride: '#ff5d4d' } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'laser-impact-ricochet-flecks', tuning: { window: 0.2, lifeScale: 0.7, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'glow', gravity: -1.5, impactVector: [1, 0.4, 0], spreadAngle: 0.5, colorOverride: '#ff8a6e', delay: 0.14 } },
], 2, 2.1)
