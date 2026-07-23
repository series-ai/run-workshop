import { authoredRecipe } from '../constants/01'

// Persistent electrical contact is a CADENCE, not a held orb: a closed
// zig-zag fork snaps across real depth, hot pips kick off the contact, then
// a compact contact light holds the source through the recovery beat.
export default authoredRecipe('spark-loop', 'Spark loop', 'Persistent contact electricity: fork snap, hot pips, hot source, then rest.', [
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 1.24, phase: 'spark-gap-fork-volume', tuning: { meshMotion: 'glow', lifecycle: 'spark-gap-loop', colorOverride: '#ffb000', positionOffset: [0, 0.42, 0] } },
  { kind: 'particles', role: 'impact', opacity: 1, scale: 0.88, phase: 'spark-gap-contact-pips', tuning: { motion: 'radial-burst', sprite: 'glow', blend: 'additive', colorOverride: '#fff1ad', ramp: 'pinned-hot', countScale: 1, speedScale: 2.1, speedJitter: 0.44, spawnScale: 0.08, depthScale: 2.6, positionOffset: [0, 0.42, 0], gravity: -1.6, drag: 2.2, spinScale: 0, stretch: 0, turbulenceScale: 0.08, flicker: 2.8, size: [0.15, 0.25, 0.08] } },
  { kind: 'core-sphere', role: 'body', opacity: 0.78, scale: 0.3, phase: 'spark-gap-contact-core', tuning: { meshMotion: 'glow', lifecycle: 'spark-gap-loop', colorOverride: '#fff0a8', positionOffset: [0, 0.42, 0] } },
], 2, 1.0)
