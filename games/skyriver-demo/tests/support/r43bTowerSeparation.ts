import windowDeltas from '../fixtures/r43b-window-shader-deltas.json';

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
