import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-burst', "Frost burst", "Soft freezing pop for chill status and environmental cold.", [
  { kind: 'particles', role: 'volume', opacity: 0.3, scale: 0.66, phase: 'frost-burst-frost-cloud', tuning: { sprite: 'puff', blend: 'alpha', window: 0.3, countScale: 0.25, speedScale: 0.4, gravity: 0.3, drag: 1.6, size: [0.8, 1.15, 1.3], ramp: 'dark', lifeScale: 0.9, death: 'erode', turbulenceScale: 0.5 } },
  { kind: 'particles', role: 'volume', opacity: 0.56, scale: 0.58, phase: 'frost-burst-crystal-pop', tuning: { window: 0.14, lifeScale: 0.6, ease: 'snap', ramp: 'pinned-hot', spinScale: 1.2, turbulenceScale: 0, sprite: 'sparkle', gravity: -0.8, delay: 0.12 } },
  { kind: 'ring-field', role: 'aura', opacity: 0.5, scale: 0.62, phase: 'frost-burst-chill-boundary', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
], 2, 1.0)
