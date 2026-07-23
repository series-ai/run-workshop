import { authoredRecipe } from '../constants/01'

export default authoredRecipe('smoke-puff', 'Soft impact smoke', 'Low-overdraw impact cloud with drifting particulate breakup.', [
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.62,
    scale: 1,
    phase: 'puff-bloom',
    // Hero body: eight CC0 smoke shapes are selected per particle inside
    // one draw call. A few large cards bloom from a tight seed into one
    // readable silhouette; shape variety prevents a repeated trefoil stamp.
    tuning: {
      turbulenceScale: 0,
      motion: 'drift-cloud',
      sprite: 'smoke-variants',
      blend: 'alpha',
      colorOverride: '#7a828b',
      window: 0.22,
      countScale: 0.22,
      speedScale: 1.6,
      drag: 1.5,
      spawnScale: 0.3,
      size: [0.3, 1.55, 2.8],
      ramp: 'held',
      spinScale: 0.35,
      ease: 'snap',
    },
  },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.46,
    scale: 0.78,
    phase: 'impact-condensation',
    // Compact dark condensation gives the onset a small decisive seed;
    // it hands off quickly instead of co-firing as another full cloud.
    tuning: {
      turbulenceScale: 0,
      motion: 'radial-burst',
      sprite: 'smoke-variants',
      blend: 'alpha',
      colorOverride: '#555d66',
      window: 0.08,
      countScale: 0.1,
      speedScale: 0.45,
      drag: 3,
      spawnScale: 0.12,
      size: [0.18, 0.7, 1.08],
      ramp: 'dark',
      spinScale: 0.6,
      lifeScale: 0.55,
      ease: 'snap',
    },
  },
  {
    kind: 'particles',
    role: 'volume',
    opacity: 0.5,
    scale: 1.05,
    phase: 'wisp-breakup',
    // Late, small rising cards break the round hero silhouette and carry
    // recovery upward; this layer does not exist during the impact seed.
    tuning: {
      turbulenceScale: 0.2,
      motion: 'column-rise',
      sprite: 'smoke-variants',
      blend: 'alpha',
      colorOverride: '#8a929b',
      window: 0.22,
      delay: 0.16,
      countScale: 0.12,
      speedScale: 0.9,
      gravity: 0.45,
      drag: 1.4,
      spawnScale: 0.55,
      size: [0.2, 0.55, 0.88],
      ramp: 'held',
      spinScale: 1.2,
      lifeScale: 1,
    },
  },
], 2, 1.0)
