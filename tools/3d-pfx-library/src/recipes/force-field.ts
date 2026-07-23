import { authoredRecipe } from '../constants/01'

export default authoredRecipe('force-field', 'Shield bubble', 'Protective fresnel shell with boundary arc sparkle.', [
  // The fresnel sphere IS the shield — rim brightness comes from view
  // angle, so it reads as a volume instead of a flat ring decal.
  { kind: 'shield-shell', role: 'aura', opacity: 0.7, scale: 1.2, phase: 'shield-boundary', tuning: { meshShader: 'force-field-shell', positionOffset: [0, -0.2, 0] } },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.7,
    scale: 0.7,
    phase: 'surface-sparks',
    // orbit-ring + spawnScale 0.72: arcs ride the shell rim (radius match),
    // 'spark' multi-ray sprite reads as electric crackle.
    tuning: { turbulenceScale: 0, motion: 'orbit-ring', sprite: 'spark', drag: 4, stretch: 0, window: 1, lifeScale: 0.28, countScale: 0.15, colorIndex: 1, spawnScale: 0.55, size: [0.55, 0.75, 0.35], spinScale: 0.05 },
  },
  {
    kind: 'particles',
    role: 'aura',
    opacity: 0.85,
    scale: 0.7,
    phase: 'boundary-pulse',
    // Batch-01 Octopo pass: the shield was static — onset, peak, and decay
    // were identical frames. A slow orbiting band of bright cel motes gives
    // the boundary visible living energy at aura tempo (<60 BPM read).
    tuning: { turbulenceScale: 0, motion: 'orbit-ring', sprite: 'magic', window: 1, countScale: 0.45, speedScale: 0.4, spawnScale: 0.62, size: [0.5, 0.62, 0.4], ramp: 'pinned-hot', bands: 2, colorIndex: 1, spinScale: 0 },
  },
], 2, 1.0)
