import { authoredRecipe } from '../constants/01'

export default authoredRecipe('laser-spray', 'Laser spray', 'Five thick sequenced core-and-halo bolts fan asymmetrically from an open faceted muzzle, carrying their own endpoint energy without detached sprite clutter.', [
  { kind: 'impact-shards', role: 'body', opacity: 1, scale: 1.08, phase: 'laser-spray-volumetric-nozzle', tuning: { meshGeometry: 'laser-spray-volumetric-nozzle', meshMotion: 'flash', lifecycle: 'laser-spray-salvo', blend: 'alpha', colorOverride: '#8cf6ff', positionOffset: [-1.62, -0.24, 0] } },
  { kind: 'impact-shards', role: 'trail', opacity: 1, scale: 1.12, phase: 'laser-spray-sequenced-bolt-rack', tuning: { meshGeometry: 'laser-spray-bolt-rack', meshMotion: 'travel', lifecycle: 'laser-spray-salvo', blend: 'alpha', colorOverride: '#ff3d1f', positionOffset: [0, -0.2, 0] } },
], 2, 1.2)
