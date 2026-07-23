import { authoredRecipe } from '../constants/01'

export default authoredRecipe('water-column', 'Water column', 'Two-draw volumetric geyser: three braided closed streams rise from asymmetric ground splashes into nine radial crown jets, with closed foam scallops and droplets carrying the crest and collapse.', [
  { kind: 'impact-shards', role: 'body', opacity: 0.8, scale: 0.94, phase: 'water-column-braided-geyser', tuning: { meshGeometry: 'water-column-churning-body', meshMotion: 'charge', lifecycle: 'water-column-eruption', blend: 'alpha', colorOverride: '#168fd1', positionOffset: [0, 0.02, 0] } },
  { kind: 'impact-shards', role: 'impact', opacity: 0.72, scale: 0.95, phase: 'water-column-radial-foam-spray', tuning: { meshGeometry: 'water-column-foam-spray', meshMotion: 'bloom', lifecycle: 'water-column-eruption', blend: 'additive', colorOverride: '#bdefff', positionOffset: [0, 0.02, 0] } },
], 2, 0.6)
