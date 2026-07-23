import { authoredRecipe } from '../constants/01'

// The charge's payoff: instant violent front + debris thrown hard.
// No anticipation (that already happened in blast-charge), minimal tail.
export default authoredRecipe('blast-release', 'Blast release', 'Charged detonation payoff: instant front, hard-thrown debris.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.95, scale: 1.1, phase: 'blast-release-pressure-front', tuning: { meshMotion: 'shockwave', ringPurpose: 'shockwave' } },
  {
    kind: 'particles',
    role: 'impact',
    opacity: 0.85,
    scale: 0.7,
    phase: 'blast-release-debris-wake',
    tuning: { sprite: 'debris', blend: 'alpha', window: 0.05, countScale: 0.2, speedScale: 2.2, gravity: -3, drag: 0.45, size: [0.3, 0.26, 0.16], lifeScale: 0.6, spinScale: 1.1, ramp: 'dark', death: 'erode', ease: 'snap', turbulenceScale: 0 },
  },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.26,
    scale: 0.55,
    phase: 'blast-release-smoke-core',
    // Beat 3 — brief smoke inherit; the release must clear for gameplay.
    tuning: { sprite: 'smoke', blend: 'alpha', window: 0.16, delay: 0.14, countScale: 0.12, speedScale: 0.5, drag: 2.2, size: [0.7, 1, 1.2], ramp: 'held', lifeScale: 0.8, death: 'erode', turbulenceScale: 0.5 },
  },
], 2, 1.7)
