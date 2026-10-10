import type { SkyriverMass } from '../../src/render/city';
import { massRoofBox, type RoofBox } from './rooftopDetailsGeometry';

export interface ArtVolumeBox {
  readonly x: number; readonly z: number; readonly y0: number;
  readonly width: number; readonly depth: number; readonly height: number;
  readonly owner: number; readonly anchorV: number;
}
export interface AddedVolumeCell extends ArtVolumeBox { readonly volumeM3: number; }
export function readArtVolumeBox(values: readonly number[]): ArtVolumeBox {
  if (values.length !== 8 || !values.every(Number.isFinite)) throw new Error('R36_ART_VOLUME_BOX');
  const [x, z, y0, width, depth, height, owner, anchorV] = values;
  if (x === undefined || z === undefined || y0 === undefined || width === undefined || depth === undefined || height === undefined || owner === undefined || anchorV === undefined || Math.min(width, depth, height) <= 0) throw new Error('R36_ART_VOLUME_DIMENSIONS');
  return { x, z, y0, width, depth, height, owner, anchorV };
}
export function artVolumeBox(mass: SkyriverMass, owner: number): ArtVolumeBox {
  return { x: mass.x, z: mass.z, y0: mass.y0, width: mass.width, depth: mass.depth, height: mass.height, owner, anchorV: mass.anchorV ?? mass.z };
}
interface Bounds { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly z0: number; readonly z1: number; }
function bounds(box: ArtVolumeBox): Bounds { return { x0: box.x - box.width / 2, x1: box.x + box.width / 2, y0: box.y0, y1: box.y0 + box.height, z0: box.z - box.depth / 2, z1: box.z + box.depth / 2 }; }

/** Every open coordinate cell is inside or outside the complete old box union. */
export function addedVolumeCells(candidate: ArtVolumeBox, oldUnion: readonly ArtVolumeBox[]): readonly AddedVolumeCell[] {
  if (oldUnion.some(box => box.owner !== candidate.owner || box.anchorV !== candidate.anchorV)) throw new Error('R36_ART_OLD_UNION_FRAME');
  const p = bounds(candidate), relevant = oldUnion.map(bounds).filter(b => b.x1 > p.x0 && b.x0 < p.x1 && b.y1 > p.y0 && b.y0 < p.y1 && b.z1 > p.z0 && b.z0 < p.z1);
  const cuts = (low: number, high: number, values: readonly number[]) => [...new Set([low, high, ...values.filter(value => value > low && value < high)])].sort((a, b) => a - b);
  const xs = cuts(p.x0, p.x1, relevant.flatMap(b => [b.x0, b.x1])), ys = cuts(p.y0, p.y1, relevant.flatMap(b => [b.y0, b.y1])), zs = cuts(p.z0, p.z1, relevant.flatMap(b => [b.z0, b.z1]));
  const cells: AddedVolumeCell[] = [];
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) for (let k = 1; k < zs.length; k++) {
    const x0 = xs[i - 1]!, x1 = xs[i]!, y0 = ys[j - 1]!, y1 = ys[j]!, z0 = zs[k - 1]!, z1 = zs[k]!;
    const x = (x0 + x1) / 2, y = (y0 + y1) / 2, z = (z0 + z1) / 2;
    if (relevant.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1)) continue;
    const width = x1 - x0, height = y1 - y0, depth = z1 - z0;
    cells.push({ x, z, y0, width, height, depth, owner: candidate.owner, anchorV: candidate.anchorV, volumeM3: width * height * depth });
  }
  return cells;
}
export function addedCellRoofBox(cell: ArtVolumeBox): RoofBox { return massRoofBox({ x: cell.x, z: cell.z, y0: cell.y0, width: cell.width, depth: cell.depth, height: cell.height, anchorV: cell.anchorV, tint: 0 }); }
export function addedVolumeConflicts(cells: readonly AddedVolumeCell[], query: (box: RoofBox) => readonly number[], excludedIds: ReadonlySet<number>): readonly { readonly cell: AddedVolumeCell; readonly blockerIndex: number }[] {
  return cells.flatMap(cell => query(addedCellRoofBox(cell)).filter(index => !excludedIds.has(index)).map(blockerIndex => ({ cell, blockerIndex })));
}
