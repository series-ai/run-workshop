/** Seeded sign designs share the existing atlas and sign batch. */
export const SIGN_SPECIES = ['glyph', 'pictogram', 'tube', 'emblem', 'figure', 'ticker'] as const;
export type SignSpecies = typeof SIGN_SPECIES[number];
export const SIGN_SHAPES = ['blade', 'blocks', 'corner', 'medallion', 'drum', 'chevron'] as const;
export type SignShape = typeof SIGN_SHAPES[number];
export interface SignDesign {
  readonly species: SignSpecies;
  readonly shape: SignShape;
  readonly cell: number;
}

function buildingHash(building: string): number {
  let hash = 2166136261;
  for (let i = 0; i < building.length; i += 1) hash = Math.imul(hash ^ building.charCodeAt(i), 16777619);
  return hash >>> 0;
}

/** Hero buildings reserve glyphs as one of their two species. */
export function planSignDesign(building: string, seed: number, vertical: boolean, heroBuilding: boolean): SignDesign {
  const hash = buildingHash(building);
  const primary = heroBuilding ? 0 : hash % SIGN_SPECIES.length;
  const secondary = (primary + 1 + ((hash >>> 8) % (SIGN_SPECIES.length - 1))) % SIGN_SPECIES.length;
  const split = primary === 0 ? 0.22 : secondary === 0 ? 0.78 : 0.32;
  const speciesIndex = seed < split ? primary : secondary;
  const first = vertical ? 17 : 4;
  const count = vertical ? 15 : 12;
  const cells: number[] = [];
  for (let cell = first; cell < first + count; cell += 1) {
    if ((cell - first) % SIGN_SPECIES.length === speciesIndex) cells.push(cell);
  }
  return { species: SIGN_SPECIES[speciesIndex]!, shape: SIGN_SHAPES[speciesIndex]!,
    cell: cells[Math.floor(seed * 997) % cells.length]! };
}

export function signCellSpecies(cell: number, vertical: boolean): SignSpecies {
  const first = vertical ? 17 : 4;
  return cell < first ? 'glyph' : SIGN_SPECIES[(cell - first) % SIGN_SPECIES.length]!;
}
