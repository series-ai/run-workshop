import type { CrateArrow, CrateFace } from './state';

/** The default crate: a light crate with the arrow up. */
export const LIGHT_UP: CrateFace = { tone: 'light', arrow: 'up' };
/** A dark crate with no label. It makes one pixel, or one wall. */
export const DARK_PLAIN: CrateFace = { tone: 'dark' };

/**
 * Front art: the worried crate. It covers columns 0-6 of the front row. Rows run
 * top to bottom. `#` is a dark crate. `.` is a light crate.
 */
const FRONT_ART = [
  '.......',
  '.......',
  '.##.##.',
  '.##.##.',
  '.......',
  '.......',
  '..###..',
  '.#...#.',
  '.......',
  '.......',
];

/**
 * Arrow maze: the east column, 5 crates wide and 10 tiers tall. Rows run top to
 * bottom, and columns run from the left of the view to the right. `W` is a dark
 * wall. `U`, `R`, and `L` are light crates. Their arrows point up, right, and left.
 * Following the arrows from the bottom-left crate leads out at the top-right.
 */
const EAST_ART = [
  'WWWWU',
  'RRRRU',
  'UWWWW',
  'ULLLL',
  'WWWWU',
  'RRRRU',
  'UWWWW',
  'ULLLL',
  'WWWWU',
  'RRRRU',
];

const ARROW_OF: Record<'U' | 'R' | 'L', CrateArrow> = { U: 'up', R: 'right', L: 'left' };

function faceOf(cell: string): CrateFace {
  if (cell === 'W' || cell === '#') return DARK_PLAIN;
  if (cell === '.') return LIGHT_UP;
  if (cell === 'U' || cell === 'R' || cell === 'L') return { tone: 'light', arrow: ARROW_OF[cell] };
  throw new Error(`WRECK_YARD_CRATE_ART_CELL:${cell}`);
}

/** One cell of an art. A cell outside the art means the art and the grid disagree. */
function artCell(art: readonly string[], y: number, x: number): string {
  const cell = art[y]?.[x];
  if (cell === undefined) throw new Error(`WRECK_YARD_CRATE_ART_OUT_OF_RANGE:${y}:${x}`);
  return cell;
}

export interface StorageGrid { readonly columns: number; readonly rows: number; readonly tiers: number }

/**
 * The face of one storage crate. `column` runs along x (west to east), `row` along
 * z (north to south), and `tier` up. The south face shows the front art. The east
 * face shows the arrow maze, which wins at the shared corner. Other faces are plain.
 */
export function storageCrateFace(column: number, row: number, tier: number, grid: StorageGrid): CrateFace {
  if (column === grid.columns - 1) {
    // Viewed from the east, the north side (small row) is on the right.
    return faceOf(artCell(EAST_ART, grid.tiers - 1 - tier, grid.rows - 1 - row));
  }
  if (row === grid.rows - 1 && column < FRONT_ART[0]!.length) {
    return faceOf(artCell(FRONT_ART, grid.tiers - 1 - tier, column));
  }
  return LIGHT_UP;
}
