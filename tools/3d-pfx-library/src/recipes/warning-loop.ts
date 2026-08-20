import { authoredRecipe } from '../constants/01'

export default authoredRecipe('warning-loop', 'Warning loop', 'Particle-first hazard boundary that restarts clean: a closed ground ring, a small held beacon, and a steady tick pulse.', [
  {
    kind: 'particles', role: 'aura', opacity: 0.8, scale: 2.05, phase: 'warning-loop-particle-ground-boundary',
    tuning: {
      motion: 'ground-ring', sprite: 'sparkle', blend: 'additive', colorOverride: '#ff5b35', ramp: 'held',
      lifecycle: 'warning-loop-particle-alert', delay: 0, window: 1, lifeScale: 1.5,
      countScale: 3.4, speedScale: 0.22, speedJitter: 0.06, drag: 2.2, gravity: 0,
      spawnScale: 1.05, depthScale: 2.0, size: [0.05, 0.1, 0.05], spinScale: 0.06,
      stretch: 0, death: 'erode', flicker: 0.18, turbulenceScale: 0.02, positionOffset: [0, 0, 0],
      referenceSource: 'warning-loop-octagonal-boundary-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the hazard panel becomes a closed ring that stays present across the loop',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.74, scale: 1.35, phase: 'warning-loop-particle-alert-beacon',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#ffd166', ramp: 'held',
      lifecycle: 'warning-loop-particle-alert', delay: 0, window: 1, lifeScale: 1.25,
      countScale: 0.55, speedScale: 0.28, speedJitter: 0.06, drag: 2.5, gravity: 0,
      spawnScale: 0.08, depthScale: 2.0, size: [0.08, 0.16, 0.08], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 0.28, turbulenceScale: 0.02, positionOffset: [0, 0.42, 0],
      referenceSource: 'warning-loop-alert-beacon-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the beacon stays as a small held core so the loop restart has no pop',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.68, scale: 1.75, phase: 'warning-loop-particle-alert-flecks',
    tuning: {
      motion: 'radial-burst', sprite: 'streak', blend: 'additive', colorOverride: '#ff8a4a', ramp: 'held',
      lifecycle: 'warning-loop-particle-alert', delay: 0, window: 1, lifeScale: 0.9,
      countScale: 0.7, speedScale: 0.9, speedJitter: 0.1, drag: 1.9, gravity: 0,
      spawnScale: 0.16, depthScale: 2.0, size: [0.05, 0.14, 0.05], spinScale: 0.08,
      stretch: 0.4, randomizeAzimuth: true, death: 'erode', flicker: 0.45, turbulenceScale: 0.03,
      positionOffset: [0, 0.08, 0],
      referenceSource: 'warning-loop-alert-ticks-and-CC0-streak-sprite-language',
      referenceAdaptation: 'warning ticks run for the full loop so the first and last frames match',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.35)
