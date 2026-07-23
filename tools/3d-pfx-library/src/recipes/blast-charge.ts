import { authoredRecipe } from '../constants/01'

// INVERTED arc: a charge is anticipation itself — matter converges and
// compresses toward the core; the payoff belongs to blast-release.
// Deliberately slower than any burst (build tension, do not pop).
export default authoredRecipe('blast-charge', 'Blast charge', 'Gathering detonation energy: convergence and compression, no release.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.6, scale: 0.8, phase: 'blast-charge-pressure-build', tuning: { meshMotion: 'charge', ringPurpose: 'boundary' } },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.85,
    scale: 0.75,
    phase: 'blast-charge-debris-wake',
    tuning: { motion: 'converge-center', sprite: 'streak', countScale: 0.18, speedScale: 1.1, speedJitter: 0.45, size: [0.5, 0.7, 0.18], ramp: 'held', stretch: 1.4, spawnScale: 2.2, turbulenceScale: 0 },
  },
  { kind: 'cloud-volume', role: 'volume', opacity: 0.42, scale: 0.55, phase: 'blast-charge-smoke-core', tuning: { meshMotion: 'charge', blend: 'alpha' } },
], 2, 0.9)
