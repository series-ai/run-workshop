import { authoredRecipe } from '../constants/01'

// Sustained pressure column (cinematic tier): a held energy beam with a
// pulsing foot ring and sparse rising debris. Sustained = loop cadence,
// NOT a burst; dieted hard from the 675-particle skeleton.
export default authoredRecipe('blast-beam', 'Blast beam', 'Sustained source-to-target attack with a warm destructive core inside a cool containment corona.', [
  { kind: 'beam-column', role: 'aura', opacity: 0.4, scale: 1.2, phase: 'blast-beam-directed-corona', tuning: { meshShader: 'energy-column', meshMotion: 'pulse', lifecycle: 'blast-beam-sustain', widthScale: 1, blend: 'additive', colorOverride: '#006da8', positionOffset: [0, 0.58, 0] } },
  { kind: 'beam-column', role: 'body', opacity: 0.98, scale: 1.2, phase: 'blast-beam-hot-core', tuning: { meshShader: 'energy-column', meshMotion: 'pulse', lifecycle: 'blast-beam-sustain', widthScale: 0.26, blend: 'additive', colorOverride: '#ff9d18', positionOffset: [0, 0.58, 0] } },
], 2, 1.0)
