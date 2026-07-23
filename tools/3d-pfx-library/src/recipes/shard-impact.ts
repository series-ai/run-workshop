import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-impact', "Shard impact", "Angular shard impact with fragment glints and crack ring.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.6, scale: 0.5, phase: 'shard-impact-fragment-glints', tuning: { window: 0.05, lifeScale: 0.24, ease: 'snap', ramp: 'held', spinScale: 1.1, turbulenceScale: 0, sprite: 'twirl', blend: 'alpha', gravity: -3 } },
  { kind: 'particles', role: 'impact', opacity: 0.4, scale: 0.5, phase: 'shard-impact-small-splinters', tuning: { countScale: 0.34, delay: 0.12, window: 0.14, lifeScale: 0.58, ease: 'snap', turbulenceScale: 0, sprite: 'sparkle', gravity: -2 } },
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.45, scale: 0.55, phase: 'shard-impact-crack-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 2.0)
