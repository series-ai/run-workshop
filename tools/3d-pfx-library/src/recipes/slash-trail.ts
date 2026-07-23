import { authoredRecipe } from '../constants/01'

// TRAIL EXEMPLAR (spec: Trail VFX Spec — Wakes & Slash Arcs).
// User-tuned via the placement controls (2026-07-12): the arc carries the
// whole strike read (racing hot edge, age-graded body erosion). The former
// separate spark burst detached at onset and broke into a blocky decay
// artifact, so the shader's integrated hot edge owns the accent (R18).
export default authoredRecipe('slash-trail', 'Melee slash arc', 'Readable directional melee sweep with trailing contact sparks.', [
  { kind: 'trail-ribbon', role: 'trail', opacity: 0.95, scale: 1.18, phase: 'blade-arc', tuning: { meshShader: 'arc-sweep', colorOverride: '#4da6ff' } },
  {
    kind: 'impact-sparks',
    role: 'impact',
    opacity: 0.72,
    scale: 1,
    phase: 'edge-contact-tick',
    tuning: { sprite: 'streak', stretch: 2, speedScale: 0.35, drag: 5, size: [0.18, 0.12, 0.05], countScale: 0.18, lifeScale: 0.12, spinScale: 0, ramp: 'pinned-hot', bands: 2, ease: 'snap', colorOverride: '#ffe0a3', delay: 0.22, window: 0.05, turbulenceScale: 0, spawnScale: 0.08, impactVector: [-0.8, 0.25, 0.1], spreadAngle: 0.28, positionOffset: [-0.95, 0, 0.05] },
  },
], 2, 2.2)
