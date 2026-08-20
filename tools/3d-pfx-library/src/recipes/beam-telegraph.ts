import { authoredRecipe } from '../constants/01'

export default authoredRecipe('beam-telegraph', 'Beam telegraph', 'Particle-first threat lane: a dense orange range fill, stretched center flow, and a small cyan muzzle charge.', [
  {
    kind: 'particles', role: 'aura', opacity: 0.88, scale: 2.05, phase: 'beam-telegraph-particle-lane-bounds',
    tuning: {
      motion: 'beam-telegraph-flow', sprite: 'glow', blend: 'additive', colorOverride: '#ff6a3a', ramp: 'held',
      lifecycle: 'beam-telegraph-particle-countdown', delay: 0, window: 0.95, lifeScale: 1.7,
      countScale: 5.6, speedScale: 0.4, speedJitter: 0.12, drag: 1.8, gravity: 0,
      spawnScale: 2.6, depthScale: 2.4, size: [0.1, 0.22, 0.1], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.04, positionOffset: [0, -0.16, 0],
      referenceSource: 'beam-telegraph-lane-fill-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the closed lane volume becomes a dense orange particle fill from muzzle to range',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.98, scale: 2.15, phase: 'beam-telegraph-particle-threat-flow',
    tuning: {
      motion: 'beam-telegraph-flow', sprite: 'streak', blend: 'additive', colorOverride: '#f04418', ramp: 'held',
      lifecycle: 'beam-telegraph-particle-countdown', delay: 0, window: 0.95, lifeScale: 1.65,
      countScale: 5.0, speedScale: 2.2, speedJitter: 0.16, drag: 0.8, gravity: 0,
      spawnScale: 1.6, depthScale: 1.8, size: [0.08, 0.28, 0.08], spinScale: 0,
      stretch: 1.2, death: 'erode', flicker: 0.2, turbulenceScale: 0.03, positionOffset: [0, -0.14, 0],
      referenceSource: 'beam-telegraph-warning-lane-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the chevron slab becomes stretched center-flow streaks along a stable attack axis',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'body', opacity: 0.78, scale: 1.35, phase: 'beam-telegraph-particle-muzzle-charge',
    tuning: {
      motion: 'radial-burst', sprite: 'sparkle', blend: 'additive', colorOverride: '#8eefff', ramp: 'pinned-hot',
      lifecycle: 'beam-telegraph-particle-countdown', delay: 0, window: 0.9, lifeScale: 0.9,
      countScale: 0.55, speedScale: 1.1, speedJitter: 0.2, drag: 2.2, gravity: 0,
      spawnScale: 0.16, depthScale: 2.2, size: [0.12, 0.28, 0.08], spinScale: 0.12,
      stretch: 0, death: 'erode', flicker: 0.35, turbulenceScale: 0.04, positionOffset: [-1.85, -0.1, 0],
      referenceSource: 'beam-telegraph-source-aperture-and-CC0-sparkle-sprite-language',
      referenceAdaptation: 'the cyan gate becomes a small muzzle charge that stays behind the orange lane',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.05)
