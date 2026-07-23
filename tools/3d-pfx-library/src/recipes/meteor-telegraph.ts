import { authoredRecipe } from '../constants/01'

// TELEGRAPH EXEMPLAR (spec: Telegraph VFX Spec — Danger Indicators).
// The contract: bright edge ring = EXACT area (brightest element), interior
// fill stays transparent so safe space reads, marker stamps in with a snap,
// urgency embers rise as the timer runs, and a 1-3 frame snapshot flash
// fires at resolve — the paired impact owns everything after.
export default authoredRecipe('meteor-telegraph', 'Meteor telegraph', 'Lethal ground marker: stamped ring, transparent kill-zone fill, rising cinders, resolve snapshot.', [
  { kind: 'core-sphere', role: 'impact', opacity: 0.85, scale: 0.4, phase: 'meteor-telegraph-ground-stamp', tuning: { meshMotion: 'flash', colorOverride: '#ffb27a' } },
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 0.82, phase: 'meteor-telegraph-warning-ring', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#ff2600' } },
  { kind: 'telegraph-disc', role: 'aura', opacity: 0.3, scale: 0.78, phase: 'meteor-telegraph-warning-fill', tuning: { colorOverride: '#ff3d00' } },
  { kind: 'particles', role: 'aura', opacity: 0.85, scale: 0.62, phase: 'meteor-telegraph-ground-cinders', tuning: { motion: 'column-rise', sprite: 'glow', colorOverride: '#ff4d00', ramp: 'pigment', flicker: 1.6, delay: 0.12, window: 0.78, lifeScale: 1.0, countScale: 0.35, speedScale: 0.5, speedJitter: 0.4, spawnScale: 1.6, turbulenceScale: 0.2, gravity: 0.8 } },
  { kind: 'impact-sparks', role: 'impact', opacity: 0.95, scale: 0.55, phase: 'meteor-telegraph-ground-snapshot', tuning: { sprite: 'glow', delay: 0.9, window: 0.07, lifeScale: 0.12, ease: 'snap', speedScale: 1.8, colorOverride: '#fff1d8', ramp: 'held', countScale: 0.4, turbulenceScale: 0, gravity: 0 } },
], 2, 0.5)
