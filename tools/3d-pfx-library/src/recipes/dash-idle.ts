import { authoredRecipe } from '../constants/01'

export default authoredRecipe('dash-idle', 'Dash idle', 'Particle-first directional readiness: a small held core, tight forward streaks, and a connected wake that loops without a blank frame.', [
  {
    kind: 'particles', role: 'body', opacity: 0.88, scale: 1.45, phase: 'dash-idle-particle-launch-core',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#9ee7ff', ramp: 'held',
      lifecycle: 'dash-idle-particle-readiness', delay: 0, window: 1, lifeScale: 1.25,
      countScale: 0.5, speedScale: 0.45, speedJitter: 0.08, drag: 2.4, gravity: 0,
      spawnScale: 0.08, depthScale: 2.0, size: [0.1, 0.2, 0.1], spinScale: 0,
      stretch: 0, death: 'erode', flicker: 0.12, turbulenceScale: 0.03, positionOffset: [0.06, -0.06, 0],
      referenceSource: 'dash-idle-launch-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the launch core becomes a small held point instead of a lamp',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'aura', opacity: 0.92, scale: 2.15, phase: 'dash-idle-particle-forward-chevrons',
    tuning: {
      motion: 'trail-stream', sprite: 'streak', blend: 'additive', colorOverride: '#2f9dff', ramp: 'held',
      lifecycle: 'dash-idle-particle-readiness', delay: 0, window: 1, lifeScale: 1.35,
      countScale: 1.8, speedScale: 1.6, speedJitter: 0.12, drag: 1.3, gravity: 0,
      spawnScale: 1.15, depthScale: 1.8, size: [0.08, 0.28, 0.08], spinScale: 0,
      stretch: 0.78, streamSpread: 0.22, death: 'erode', flicker: 0.08, turbulenceScale: 0.03,
      positionOffset: [-0.12, -0.06, 0],
      referenceSource: 'dash-idle-swept-chevrons-and-CC0-streak-sprite-language',
      referenceAdaptation: 'the chevron reservoir becomes a tight forward streak cone',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'trail', opacity: 0.62, scale: 1.95, phase: 'dash-idle-particle-ready-wake',
    tuning: {
      motion: 'trail-stream', sprite: 'glow', blend: 'additive', colorOverride: '#7ec8ff', ramp: 'held',
      lifecycle: 'dash-idle-particle-readiness', delay: 0, window: 1, lifeScale: 1.3,
      countScale: 1.2, speedScale: 1.2, speedJitter: 0.12, drag: 1.5, gravity: 0,
      spawnScale: 1.05, depthScale: 1.9, size: [0.06, 0.16, 0.08], spinScale: 0.08,
      stretch: 0, streamSpread: 0.28, death: 'erode', flicker: 0.1, turbulenceScale: 0.04,
      positionOffset: [-0.22, -0.06, 0],
      referenceSource: 'dash-idle-depth-lanes-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the wake stays connected and loops without star flashes',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 0.81)
