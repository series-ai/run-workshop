import { authoredRecipe } from '../constants/01'

export default authoredRecipe('barrier-column', 'Barrier column', 'Particle-first defensive sentinel: a tight ground lock, a narrow rising body, and overlapping rails.', [
  {
    kind: 'particles', role: 'impact', opacity: 0.7, scale: 1.85, phase: 'barrier-column-particle-ground-lock',
    tuning: {
      motion: 'ground-ring', sprite: 'glow', blend: 'additive', colorOverride: '#8ecfff', ramp: 'held',
      lifecycle: 'barrier-column-particle-sentinel', delay: 0, window: 1, lifeScale: 1.35,
      countScale: 2.4, speedScale: 0.35, speedJitter: 0.12, drag: 2.0, gravity: 0,
      spawnScale: 0.82, depthScale: 2.0, size: [0.06, 0.12, 0.06], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, 0, 0],
      referenceSource: 'barrier-column-base-lock-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the cage floor becomes a tight glow ring instead of scattered stars',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.86, scale: 2.35, phase: 'barrier-column-particle-energy-body',
    tuning: {
      motion: 'column-rise', sprite: 'glow', blend: 'additive', colorOverride: '#b7e4ff', ramp: 'held',
      lifecycle: 'barrier-column-particle-sentinel', delay: 0, window: 0.96, lifeScale: 1.75,
      countScale: 4.6, speedScale: 2.4, speedJitter: 0.14, drag: 1.25, gravity: 0,
      spawnScale: 0.85, depthScale: 2.2, size: [0.08, 0.18, 0.08], spinScale: 0.06,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, -0.32, 0],
      referenceSource: 'barrier-column-energy-volume-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the cage volume becomes a narrow rising glow body',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.94, scale: 2.55, phase: 'barrier-column-particle-energy-bands',
    tuning: {
      motion: 'column-rise', sprite: 'streak', blend: 'additive', colorOverride: '#7ec8ff', ramp: 'held',
      lifecycle: 'barrier-column-particle-sentinel', delay: 0, window: 0.95, lifeScale: 1.75,
      countScale: 4.2, speedScale: 2.8, speedJitter: 0.16, drag: 1.25, gravity: 0,
      spawnScale: 0.95, depthScale: 2.4, size: [0.08, 0.26, 0.08], spinScale: 0.08,
      stretch: 0.72, death: 'erode', flicker: 0.16, turbulenceScale: 0.04, positionOffset: [0, -0.3, 0],
      referenceSource: 'barrier-column-energy-rails-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the cage panels become narrow overlapping rails inside the body',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.92)
