import windowDeltas from '../fixtures/r43b-window-shader-deltas.json';
import materialChromaDeltas from '../fixtures/r43b-material-chroma-shader-deltas.json';

/** Remove only the frozen added material chroma slices. Keep all old shader bytes checked. */
export function withoutR43bMaterialChroma(source: string, key: string): string {
  const deltas = key === 'towerFragment' ? materialChromaDeltas.towerFragment : [];
  for (const { approved } of deltas) {
    if (source.split(approved).length !== 2) {
      throw new Error(`R43B_MATERIAL_CHROMA_DELTA_CHANGED:${key}`);
    }
  }
  for (const { approved, original } of deltas) source = source.replace(approved, original);
  return source;
}

/** Restore only the frozen R43b window changes before the R29 shader hash check. */
export function withoutR43bWindowCells(source: string, key: string): string {
  const deltas = key === 'towerVertex' ? windowDeltas.towerVertex
    : key === 'towerFragment' ? windowDeltas.towerFragment : [];
  for (const { approved } of deltas) {
    if (source.split(approved).length !== 2) {
      throw new Error(`R43B_WINDOW_DELTA_CHANGED:${key}`);
    }
  }
  for (const { approved, original } of deltas) source = source.replace(approved, original);
  return source;
}
