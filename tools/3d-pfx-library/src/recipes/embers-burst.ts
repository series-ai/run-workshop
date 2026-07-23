import { authoredRecipe } from '../constants/01'

// Fire breakup is MATTER, not a generic ring: a tight ignition receipt
// launches long ballistic coals, followed by smaller cooling cinders that
// flicker and erode. Three surfaces preserve the low-tier mobile budget.
export default authoredRecipe('embers-burst', "Ember burst", "Particle-first fire breakup: a hot ignition pop throws uneven coals while a dark smoke handoff gives the cinders a visible resolution beat.", [
  {
    kind: 'particles', role: 'impact', opacity: 0.94, scale: 0.78, phase: 'embers-burst-particle-ignition-pop',
    tuning: {
      motion: 'impact-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff1b8', ramp: 'pinned-hot',
      lifecycle: 'embers-burst-particle-breakup', delay: 0, window: 0.12, lifeScale: 0.38,
      countScale: 0.3, speedScale: 3.3, speedJitter: 0.42, drag: 2.5, gravity: -0.2,
      spawnScale: 0.07, depthScale: 2.8, size: [0.16, 0.38, 0.12], spinScale: 0,
      death: 'erode', ease: 'snap', turbulenceScale: 0.02, positionOffset: [0, 0.28, 0],
      referenceSource: 'ember-ignition-core-and-CC0-glow-sprite-language',
      referenceAdaptation: 'the ignition seed becomes a compact additive pop that does not compete with the launched coals',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'impact', opacity: 0.96, scale: 1.16, phase: 'embers-burst-particle-ballistic-coals',
    tuning: {
      motion: 'cone-fountain', sprite: 'ember', blend: 'additive', colorOverride: '#ff5712', ramp: 'pinned-hot',
      lifecycle: 'embers-burst-particle-breakup', delay: 0.02, window: 0.42, lifeScale: 0.8,
      countScale: 0.82, speedScale: 3.7, speedJitter: 0.52, drag: 0.72, gravity: -2.7,
      spawnScale: 0.16, depthScale: 3, size: [0.1, 0.28, 0.08], spinScale: 0.7,
      stretch: 0.22, flicker: 1.5, death: 'erode', ease: 'snap', turbulenceScale: 0.06, positionOffset: [0, 0.28, 0],
      referenceSource: 'ember-ballistic-launch-and-CC0-ember-sprite-language',
      referenceAdaptation: 'hard fire shards become unequal ballistic coal arcs with speed jitter and gravity-driven falloff',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
  {
    kind: 'particles', role: 'volume', opacity: 0.62, scale: 1.12, phase: 'embers-burst-particle-cooling-smoke',
    tuning: {
      motion: 'drift-cloud', sprite: 'smoke-variants', blend: 'alpha', colorOverride: '#703326', ramp: 'dark',
      lifecycle: 'embers-burst-particle-breakup', delay: 0.16, window: 0.44, lifeScale: 1.02,
      countScale: 0.42, speedScale: 0.26, speedJitter: 0.44, drag: 1.4, gravity: 0.04,
      spawnScale: 0.68, spawnLift: 0.04, depthScale: 3.1, size: [0.28, 0.68, 0.5],
      spinScale: 0.28, death: 'erode', turbulenceScale: 0.22, positionOffset: [0, 0.18, 0],
      referenceSource: 'ember-cooling-cinders-and-CC0-smoke-variants',
      referenceAdaptation: 'cooling residue becomes a delayed dark smoke bed that keeps the fire breakup from vanishing as isolated dots',
      referenceLicense: 'repo-original-and-CC0-1.0',
    },
  },
], 2, 1.3)
