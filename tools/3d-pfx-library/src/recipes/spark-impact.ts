import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-impact', "Spark impact", "Crisp spark impact with contact ticks and small ring.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.72, scale: 0.52, phase: 'spark-impact-contact-star', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 0, turbulenceScale: 0, sprite: 'streak', stretch: 2.0, gravity: 0, colorOverride: '#ffcf4d', bands: 3 } },
  { kind: 'particles', role: 'impact', opacity: 0.42, scale: 0.5, phase: 'spark-impact-glitter-points', tuning: { countScale: 0.38, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: -2.5 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'spark-impact-contact-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.0)
