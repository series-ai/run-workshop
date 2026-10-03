/**
 * 5 x 7 pixel font for the yard's LED signs. Each glyph is seven rows of five
 * cells; '#' is a lit cell.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;

/** Lit cells of a text line: rows of booleans, one blank column between glyphs. Fails on unknown characters. */
export function pixelText(text: string): boolean[][] {
  const glyphs = [...text].map((char) => {
    const glyph = GLYPHS[char];
    if (!glyph) throw new Error(`WRECK_YARD_PIXEL_GLYPH_MISSING: ${JSON.stringify(char)}`);
    return glyph;
  });
  return Array.from({ length: GLYPH_HEIGHT }, (_, row) =>
    glyphs.flatMap((glyph, index) => [...[...glyph[row]!].map((cell) => cell === '#'), ...(index < glyphs.length - 1 ? [false] : [])]));
}

/**
 * Draws lines of pixel text centered on a canvas as round LED dots. Unlit
 * cells draw as dim dots so the panel reads as an LED board.
 */
export function drawLedText(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  options: { readonly cell: number; readonly lit: string; readonly unlit: string; readonly background: string; readonly lineGap: number },
): void {
  const { width, height } = context.canvas;
  context.fillStyle = options.background;
  context.fillRect(0, 0, width, height);
  const grids = lines.map(pixelText);
  const totalRows = grids.length * GLYPH_HEIGHT + (grids.length - 1) * options.lineGap;
  const columns = Math.floor(width / options.cell);
  const rows = Math.floor(height / options.cell);
  const top = Math.floor((rows - totalRows) / 2);
  const litCells = new Set<string>();
  grids.forEach((grid, line) => {
    const left = Math.floor((columns - grid[0]!.length) / 2);
    const rowOffset = top + line * (GLYPH_HEIGHT + options.lineGap);
    grid.forEach((cells, row) => cells.forEach((lit, column) => {
      if (lit) litCells.add(`${left + column},${rowOffset + row}`);
    }));
  });
  const radius = options.cell * 0.38;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      context.fillStyle = litCells.has(`${column},${row}`) ? options.lit : options.unlit;
      context.beginPath();
      context.arc((column + 0.5) * options.cell, (row + 0.5) * options.cell, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}
