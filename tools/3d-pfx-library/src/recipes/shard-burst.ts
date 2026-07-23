import { authoredRecipe } from '../constants/01'

export default authoredRecipe('shard-burst', "Shard burst", "Crisp fragment burst for glass, ice, barriers, and brittle breaks.", [
  { kind: 'impact-sparks', role: 'impact', opacity: 0.78, scale: 0.68, phase: 'shard-burst-fragment-fan', tuning: { window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'pinned-hot', spinScale: 1.1, turbulenceScale: 0, sprite: 'twirl', stretch: 0, gravity: -3, delay: 0.12 } },
  { kind: 'ring-field', role: 'impact', opacity: 0.5, scale: 0.58, phase: 'shard-burst-crack-ring', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  { kind: 'particles', role: 'impact', opacity: 0.52, scale: 0.48, phase: 'shard-burst-edge-glints', tuning: { window: 0.1, lifeScale: 0.4, ease: 'snap', ramp: 'pinned-hot', spinScale: 1.5, turbulenceScale: 0, sprite: 'sparkle', delay: 0.06, countScale: 0.88 } },
], 2, 1.35)
