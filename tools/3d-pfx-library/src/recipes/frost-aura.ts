import { authoredRecipe } from '../constants/01'

export default authoredRecipe('frost-aura', 'Frost aura', 'Persistent two-draw chill field: a compact rime crescent, twenty-four ridged crystal segments, six chunky crust pieces, and three branched frost clusters form a character-wrapping double helix with an additive gem-edge pass.', [
  { kind: 'impact-shards', role: 'aura', opacity: 0.96, scale: 1.04, phase: 'frost-aura-crystal-crown', tuning: { meshGeometry: 'frost-aura-crystal-crown', meshMotion: 'pulse', lifecycle: 'frost-aura-breathing-loop', blend: 'alpha', colorOverride: '#b9efff', positionOffset: [0, -0.96, 0] } },
  { kind: 'impact-shards', role: 'aura', opacity: 0.62, scale: 1.025, phase: 'frost-aura-crystal-edge-glint', tuning: { meshGeometry: 'frost-aura-crystal-glint', meshMotion: 'pulse', lifecycle: 'frost-aura-breathing-loop', blend: 'additive', colorOverride: '#c8f8ff', positionOffset: [0, -0.96, 0] } },
], 2, 0.45)
