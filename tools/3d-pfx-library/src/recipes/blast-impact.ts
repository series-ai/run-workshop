import { authoredRecipe } from '../constants/01'

// On-hit blast: the snappiest, smallest read in the family — quick front,
// sharp chips, a fist-sized puff. Gone before the next hit lands.
export default authoredRecipe('blast-impact', 'Blast impact', 'On-hit blast: quick pressure front, sharp chips, small puff.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.9, scale: 0.85, phase: 'blast-impact-pressure-front', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.85,
    scale: 0.6,
    phase: 'blast-impact-debris-flecks',
    tuning: { sprite: 'debris', blend: 'alpha', window: 0.05, countScale: 0.18, speedScale: 1.9, gravity: -3.2, drag: 0.5, size: [0.26, 0.22, 0.14], lifeScale: 0.5, spinScale: 1.1, ramp: 'dark', death: 'erode', ease: 'snap', turbulenceScale: 0 },
  },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.3,
    scale: 0.5,
    phase: 'blast-impact-smoke-body',
    // Beat 3 — a small puff after the chips; gone fast (impact must clear).
    tuning: { sprite: 'puff', blend: 'alpha', window: 0.14, delay: 0.12, countScale: 0.12, speedScale: 0.6, drag: 2.4, size: [0.5, 0.75, 0.9], ramp: 'held', lifeScale: 0.6, death: 'erode', turbulenceScale: 0.4 },
  },
], 2, 1.8)
