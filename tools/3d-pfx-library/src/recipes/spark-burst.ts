import { authoredRecipe } from '../constants/01'

export default authoredRecipe('spark-burst', "Spark burst", "Compact starburst for machinery, hits, and small electrical feedback.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.86, scale: 0.62, phase: 'spark-burst-star-pop', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'pinned-hot', spinScale: 0, turbulenceScale: 0, sprite: 'streak', stretch: 2.2, gravity: 0 } },
  { kind: 'particles', role: 'impact', opacity: 0.62, scale: 0.5, phase: 'spark-burst-hot-pinpoints', tuning: { delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'glow', gravity: -2.5, drag: 1.2, size: [0.5, 0.4, 0.14] } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.5, scale: 0.5, phase: 'spark-burst-contact-glint', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.4)
