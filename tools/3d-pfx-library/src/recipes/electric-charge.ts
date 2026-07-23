import { authoredRecipe } from '../constants/01'

// CHARGE EXEMPLAR (spec: Charge VFX Spec — Anticipation Moments).
// Six-layer stack compressed to five: ignition pop (<100ms agency cue) →
// arc inflow (the identity: intermittent bolts converge from 2.2× radius)
// → core swell (compressing envelope, flicker = hold pulse) → ground arcs
// (threat anchor, electric-burst mirror) → release snap (late inward
// contraction — the cue before the paired release effect's payoff).
export default authoredRecipe('electric-charge', 'Electric charge', 'Voltage gathering: intermittent arcs converge and crawl the ground until the core snaps.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'electric-charge-ignition-pop', tuning: { meshMotion: 'flash', colorOverride: '#8fd0ff' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'electric-charge-voltage-inflow', tuning: { motion: 'converge-center', sprite: 'arc', stretch: 1.3, colorOverride: '#3f9dff', ramp: 'held', spawnScale: 2.2, countScale: 0.12, speedScale: 1.2, speedJitter: 0.55, flicker: 2.2, turbulenceScale: 0, gravity: 0, spinScale: 0 } },
  { kind: 'core-sphere', role: 'body', opacity: 0.75, scale: 0.5, phase: 'electric-charge-core-swell', tuning: { meshMotion: 'charge', colorOverride: '#4da6ff', flicker: 1.8 } },
  { kind: 'particles', role: 'impact', opacity: 0.7, scale: 0.55, phase: 'electric-charge-ground-arcs', tuning: { motion: 'ground-scuff', sprite: 'arc', stretch: 1.2, colorOverride: '#3f9dff', ramp: 'held', flicker: 2.4, countScale: 0.3, delay: 0.3, window: 0.5, lifeScale: 0.5, speedJitter: 0.6, gravity: 0, spinScale: 0, turbulenceScale: 0 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.9, scale: 0.5, phase: 'electric-charge-release-snap', tuning: { motion: 'converge-center', sprite: 'glow', delay: 0.88, window: 0.08, lifeScale: 0.14, ease: 'snap', speedScale: 2, spawnScale: 1.2, colorOverride: '#9fd8ff', turbulenceScale: 0, gravity: 0 } },
], 2, 1.1)
