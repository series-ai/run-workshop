import { authoredRecipe } from '../constants/01'

// Force gathering: the ring compresses inward while pressure motes are
// drawn in — the wave that has not happened yet.
export default authoredRecipe('shockwave-charge', 'Shockwave charge', 'Compressing force: inward-drawn pressure before the wave.', [
  { kind: 'shockwave-ring', role: 'impact', opacity: 0.65, scale: 0.85, phase: 'shockwave-charge-radius-load', tuning: { meshMotion: 'charge', ringPurpose: 'boundary' } },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.7,
    scale: 0.6,
    phase: 'shockwave-charge-dust-points',
    tuning: { motion: 'converge-center', sprite: 'puff', blend: 'alpha', countScale: 0.24, speedScale: 0.9, size: [0.45, 0.6, 0.3], ramp: 'held', spawnScale: 2, turbulenceScale: 0 },
  },
], 2, 0.9)
