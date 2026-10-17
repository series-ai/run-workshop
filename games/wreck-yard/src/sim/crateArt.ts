import type { CrateArrow, CrateFace, CrateFaces } from './state';

/** The default crate: a light crate with the arrow up. */
export const LIGHT_UP: CrateFace = { tone: 'light', arrow: 'up' };
/** A dark crate with no label. It makes one pixel, or one wall. */
export const DARK_PLAIN: CrateFace = { tone: 'dark' };
/** A crate with the default light face on both visible sides, and a light frame. */
export const LIGHT_FACES: CrateFaces = { east: LIGHT_UP, south: LIGHT_UP, frame: 'light' };

/**
 * Front art: the worried crate, on the south face. It spans all 8 columns and
 * it is centred. Rows run top to bottom. `#` is a dark crate. `.` is a light crate.
 */
const FRONT_ART = [
  '........',
  '........',
  '.##..##.',
  '.##..##.',
  '........',
  '........',
  '..####..',
  '.#....#.',
  '........',
  '........',
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
 * The visible faces of one storage crate. `column` runs along x (west to east),
 * `row` along z (north to south), and `tier` up. The east face shows the arrow
 * maze. The south face shows the front art. Each face takes its own art cell.
 * A face with no art takes the tone of the other face, so a dark crate never
 * shows a light labelled face when a player knocks its neighbour away.
 */
export function storageCrateFaces(column: number, row: number, tier: number, grid: StorageGrid): CrateFaces {
  const onEastColumn = column === grid.columns - 1;
  const onFrontRow = row === grid.rows - 1;
  const eastArt = onEastColumn ? faceOf(artCell(EAST_ART, grid.tiers - 1 - tier, grid.rows - 1 - row)) : null;
  const southArt = onFrontRow ? faceOf(artCell(FRONT_ART, grid.tiers - 1 - tier, column)) : null;
  const plainLike = (other: CrateFace | null): CrateFace => (other?.tone === 'dark' ? DARK_PLAIN : LIGHT_UP);
  const east = eastArt ?? plainLike(southArt);
  const south = southArt ?? plainLike(eastArt);
  return { east, south, frame: onFrontRow ? south.tone : east.tone };
}

/**
 * A crate is dark when either visible face is dark. Its plain faces follow it,
 * the top and north faces included, so that a cut dark crate keeps its tone. The
 * dark tops of the maze walls are a chosen result of this rule.
 */
export function crateTone(faces: CrateFaces): CrateFace['tone'] {
  return toneOfFaces(faces.east.tone, faces.south.tone);
}

/** The crate tone from the tones of its two visible faces: dark when either one is dark. */
export function toneOfFaces(east: CrateFace['tone'], south: CrateFace['tone']): CrateFace['tone'] {
  return east === 'dark' || south === 'dark' ? 'dark' : 'light';
}
