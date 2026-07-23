import { authoredRecipe } from '../constants/01'

// Moving pressure wake: matter thrown BEHIND a traveling detonation —
// streaming flecks and a fading wake ribbon; the small after-ring pops
// where it passed. Dieted hard from the 675-particle skeleton.
export default authoredRecipe('blast-trail', 'Blast trail', 'Traveling detonation wake: streaming flecks behind the source.', [
  { kind: 'particles', role: 'trail', opacity: 0.95, scale: 0.68, phase: 'blast-trail-wake-stream', tuning: { motion: 'trail-stream', sprite: 'debris', size: [0.45, 0.55, 0.3], colorOverride: '#c2913f', ramp: 'held', countScale: 0.7, lifeScale: 0.7, speedScale: 6, speedJitter: 0.4, streamSpread: 0.12, turbulenceScale: 0, gravity: -1.5, spinScale: 0.85, blend: 'alpha' } },
  { kind: 'particles', role: 'aura', opacity: 0.6, scale: 0.45, phase: 'blast-trail-stragglers', tuning: { sprite: 'glow', colorOverride: '#e8d8b8', ramp: 'held', delay: 0.3, window: 0.55, lifeScale: 0.7, countScale: 0.12, speedScale: 0.4, spawnOffset: [-0.6, 0, 0], spawnScale: 0.2, turbulenceScale: 0.3, gravity: 0.2 } },
], 2, 1.4)
