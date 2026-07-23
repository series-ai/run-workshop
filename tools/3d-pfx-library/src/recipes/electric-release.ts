import { authoredRecipe } from '../constants/01'

// RELEASE EXEMPLAR (spec: Release VFX Spec — Cast & Launch Moments).
// The paired payoff of electric-charge: near-white launch flash (dies
// first) → branched arc fan ALONG the launch vector → backblast sparks
// opposite it (Newton) → late ground re-arcs (electric residue signature)
// → demoted anchor wisp (dies last, never chases the payload).
export default authoredRecipe('electric-release', 'Electric release', 'Voltage payoff: white snap, arc fan down the launch vector, re-arcs settle at the anchor.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.95, scale: 0.55, phase: 'electric-release-launch-flash', tuning: { meshMotion: 'flash', colorOverride: '#dff1ff' } },
  { kind: 'particles', role: 'impact', opacity: 0.9, scale: 0.6, phase: 'electric-release-arc-fan', tuning: { spawnScale: 0.45, motion: 'radial-burst', sprite: 'arc', stretch: 1.8, impactVector: [1, 0.15, 0], spreadAngle: 0.3, speedScale: 2.2, window: 0.05, lifeScale: 0.25, ease: 'snap', colorOverride: '#3f9dff', ramp: 'held', flicker: 2.2, countScale: 0.3, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.45, phase: 'electric-release-backblast-sparks', tuning: { motion: 'radial-burst', sprite: 'glow', impactVector: [-1, 0.25, 0], spreadAngle: 0.8, speedScale: 1.2, delay: 0.03, window: 0.1, lifeScale: 0.3, ease: 'snap', colorOverride: '#9fd8ff', ramp: 'held', countScale: 0.15, turbulenceScale: 0, gravity: -2 } },
  { kind: 'particles', role: 'impact', opacity: 0.65, scale: 0.55, phase: 'electric-release-ground-re-arcs', tuning: { motion: 'ground-scuff', sprite: 'arc', stretch: 1.2, delay: 0.35, window: 0.45, lifeScale: 0.6, colorOverride: '#3f9dff', ramp: 'held', flicker: 2.4, countScale: 0.15, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'particles', role: 'aura', opacity: 0.5, scale: 0.4, phase: 'electric-release-anchor-wisp', tuning: { sprite: 'glow', blend: 'alpha', delay: 0.15, window: 0.85, lifeScale: 0.6, speedScale: 0.2, gravity: 0.3, colorOverride: '#6a8fc0', ramp: 'dark', countScale: 0.1, turbulenceScale: 0.3 } },
], 2, 1.8)
