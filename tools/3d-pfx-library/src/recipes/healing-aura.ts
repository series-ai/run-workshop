import { authoredRecipe } from '../constants/01'

// LOOP EXEMPLAR (spec: Loop VFX Spec — Auras, Status & Ambience).
// The aura anatomy: an actual RUNE CIRCLE orbiting the floor (R12 — the
// name promises runes, so runes it renders; ~40 RPM calm) plus rising glow
// motes and luminous restoration glyphs. A former fresnel sphere made the
// heal read as a shield/debug boundary and has no semantic job here.
// Heal cadence: ~36 BPM breathing — slower than a heartbeat reads SAFE.
// Temperament: ORDERED (jitter/turbulence near zero); motes are soft round
// lights that erode out near chest height (glyph shapes belong to the
// glyphs layer alone); the ring owns the brightness (R3 single focal).
export default authoredRecipe('healing-aura', 'Healing aura loop', 'Gentle recovery read with vertical motes and soft aura coverage.', [
  { kind: 'ring-field', role: 'aura', opacity: 0.95, scale: 1.3, phase: 'healing-aura-ground-boundary', tuning: { meshMotion: 'pulse', ringPurpose: 'reticle', colorOverride: '#2fd968' } },
  { kind: 'particles', role: 'aura', opacity: 0.72, scale: 0.9, phase: 'restoration-soft-rise', tuning: { motion: 'column-rise', sprite: 'glow', blend: 'additive', colorOverride: '#b7ffe0', countScale: 0.45, spawnScale: 0.55, size: [0.1, 0.18, 0.14], speedScale: 0.55, spinScale: 0, turbulenceScale: 0.18 } },
  { kind: 'healing-glyphs', role: 'aura', opacity: 0.94, scale: 1.0, phase: 'restoration-leaf-bloom-and-helix', tuning: { colorOverride: '#7dffad', positionOffset: [0, 0.18, 0], turbulenceScale: 0 } },
], 2, 1.0)
