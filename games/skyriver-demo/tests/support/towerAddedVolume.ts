import type { SkyriverMass } from '../../src/render/city';
import { warpRigid } from '../../src/render/city';
import { roofBoxTolerance, type RoofBox } from './rooftopDetailsGeometry';

export interface ArtVolumeBox {
  readonly x: number; readonly z: number; readonly y0: number;
  readonly width: number; readonly depth: number; readonly height: number;
  readonly owner: number; readonly anchorV: number;
  readonly yawRad?: number;
  readonly yawAnchor?: { readonly x: number; readonly z: number };
}
type FootprintPoint = readonly [x: number, z: number];
export interface AddedVolumeCell extends ArtVolumeBox {
  readonly volumeM3: number;
  /** The clipped physical footprint in the common canyon frame. */
  readonly footprint: readonly FootprintPoint[];
}
export function readArtVolumeBox(values: readonly number[]): ArtVolumeBox {
  if (values.length !== 8 || !values.every(Number.isFinite)) throw new Error('R36_ART_VOLUME_BOX');
  const [x, z, y0, width, depth, height, owner, anchorV] = values;
  if (x === undefined || z === undefined || y0 === undefined || width === undefined || depth === undefined || height === undefined || owner === undefined || anchorV === undefined || Math.min(width, depth, height) <= 0) throw new Error('R36_ART_VOLUME_DIMENSIONS');
  return { x, z, y0, width, depth, height, owner, anchorV };
}
export function artVolumeBox(mass: SkyriverMass, owner: number): ArtVolumeBox {
  return { x: mass.x, z: mass.z, y0: mass.y0, width: mass.width, depth: mass.depth, height: mass.height, owner, anchorV: mass.anchorV ?? mass.z,
    ...(mass.yawRad === undefined ? {} : { yawRad: mass.yawRad }),
    ...(mass.yawAnchor === undefined ? {} : { yawAnchor: mass.yawAnchor }) };
}
interface Bounds { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly z0: number; readonly z1: number; }
function axisBounds(box: ArtVolumeBox): Bounds { return { x0: box.x - box.width / 2, x1: box.x + box.width / 2, y0: box.y0, y1: box.y0 + box.height, z0: box.z - box.depth / 2, z1: box.z + box.depth / 2 }; }

/** This rotation does not call the production box placement functions. */
export function physicalFootprint(box: ArtVolumeBox): readonly FootprintPoint[] {
  const c = Math.cos(box.yawRad ?? 0), s = Math.sin(box.yawRad ?? 0);
  const pivot = box.yawAnchor ?? box;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const dx = box.x + u! * box.width / 2 - pivot.x;
    const dz = box.z + v! * box.depth / 2 - pivot.z;
    return [pivot.x + c * dx + s * dz, pivot.z - s * dx + c * dz];
  });
}
function footprintArea(polygon: readonly FootprintPoint[]): number {
  if (polygon.length < 3) return 0;
  const [x, z] = polygon[0]!;
  let area = 0;
  for (let i = 1; i + 1 < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[i + 1]!;
    area += (a[0] - x) * (b[1] - z) - (a[1] - z) * (b[0] - x);
  }
  return Math.abs(area) / 2;
}
function clipAxis(polygon: readonly FootprintPoint[], axis: 0 | 1, limit: number, sign: -1 | 1): readonly FootprintPoint[] {
  const result: FootprintPoint[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
    if (da >= 0) result.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const t = da / (da - db);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}
export function clippedFootprint(polygon: readonly FootprintPoint[], x0: number, x1: number, z0: number, z1: number): readonly FootprintPoint[] {
  return clipAxis(clipAxis(clipAxis(clipAxis(polygon, 0, x0, 1), 0, x1, -1), 1, z0, 1), 1, z1, -1);
}

/** Old box faces partition the candidate. Each outside cell keeps its true clipped area. */
export function addedVolumeCells(candidate: ArtVolumeBox, oldUnion: readonly ArtVolumeBox[]): readonly AddedVolumeCell[] {
  if (oldUnion.some(box => box.owner !== candidate.owner || box.anchorV !== candidate.anchorV || (box.yawRad ?? 0) !== 0)) throw new Error('R36_ART_OLD_UNION_FRAME');
  const footprint = physicalFootprint(candidate);
  const p: Bounds = { x0: Math.min(...footprint.map(v => v[0])), x1: Math.max(...footprint.map(v => v[0])),
    y0: candidate.y0, y1: candidate.y0 + candidate.height,
    z0: Math.min(...footprint.map(v => v[1])), z1: Math.max(...footprint.map(v => v[1])) };
  const relevant = oldUnion.map(axisBounds).filter(b => b.x1 > p.x0 && b.x0 < p.x1 && b.y1 > p.y0 && b.y0 < p.y1 && b.z1 > p.z0 && b.z0 < p.z1);
  const cuts = (low: number, high: number, values: readonly number[]) => [...new Set([low, high, ...values.filter(value => value > low && value < high)])].sort((a, b) => a - b);
  const xs = cuts(p.x0, p.x1, relevant.flatMap(b => [b.x0, b.x1])), ys = cuts(p.y0, p.y1, relevant.flatMap(b => [b.y0, b.y1])), zs = cuts(p.z0, p.z1, relevant.flatMap(b => [b.z0, b.z1]));
  const cells: AddedVolumeCell[] = [];
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) for (let k = 1; k < zs.length; k++) {
    const x0 = xs[i - 1]!, x1 = xs[i]!, y0 = ys[j - 1]!, y1 = ys[j]!, z0 = zs[k - 1]!, z1 = zs[k]!;
    const x = (x0 + x1) / 2, y = (y0 + y1) / 2, z = (z0 + z1) / 2;
    if (relevant.some(b => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && z > b.z0 && z < b.z1)) continue;
    const polygon = clippedFootprint(footprint, x0, x1, z0, z1), area = footprintArea(polygon);
    if (!(area > 0)) continue;
    const width = x1 - x0, height = y1 - y0, depth = z1 - z0;
    cells.push({ x, z, y0, width, height, depth, owner: candidate.owner, anchorV: candidate.anchorV, footprint: polygon, volumeM3: area * height });
  }
  return cells;
}
export function addedCellRoofBox(cell: ArtVolumeBox): RoofBox {
  const point = warpRigid(cell.x, cell.z, cell.anchorV, { x: 0, z: 0, heading: 0 });
  return { x: point.x, z: point.z, y: cell.y0 + cell.height / 2, hx: cell.width / 2, hy: cell.height / 2, hz: cell.depth / 2, c: Math.cos(point.heading), s: Math.sin(point.heading) };
}
function cellWorldFootprint(cell: AddedVolumeCell): readonly FootprintPoint[] {
  return cell.footprint.map(([x, z]) => { const p = warpRigid(x, z, cell.anchorV, { x: 0, z: 0, heading: 0 }); return [p.x, p.z]; });
}
function blockerFootprint(box: RoofBox): readonly FootprintPoint[] {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [box.x + u! * box.hx * box.c + v! * box.hz * box.s,
    box.z - u! * box.hx * box.s + v! * box.hz * box.c]);
}
/** Positive separating-axis overlap uses the existing two-Float32-ULP tolerance. */
export function exactCellConflict(cell: AddedVolumeCell, blocker: RoofBox): boolean {
  const broad = addedCellRoofBox(cell), tolerance = Math.max(roofBoxTolerance(broad), roofBoxTolerance(blocker));
  if (Math.min(cell.y0 + cell.height, blocker.y + blocker.hy) - Math.max(cell.y0, blocker.y - blocker.hy) <= tolerance) return false;
  const a = cellWorldFootprint(cell), b = blockerFootprint(blocker);
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!;
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length === 0) continue;
    const nx = -(q[1] - p[1]) / length, nz = (q[0] - p[0]) / length;
    // Subtract one origin before projection to keep large world coordinates stable.
    const project = (points: readonly FootprintPoint[]) => points.map(v => (v[0] - p[0]) * nx + (v[1] - p[1]) * nz);
    const pa = project(a), pb = project(b);
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= tolerance) return false;
  }
  return true;
}
export function addedVolumeConflicts(cells: readonly AddedVolumeCell[], query: (box: RoofBox) => readonly number[], excludedIds: ReadonlySet<number>, actualBoxes?: readonly (RoofBox | null)[]): readonly { readonly cell: AddedVolumeCell; readonly blockerIndex: number }[] {
  return cells.flatMap(cell => query(addedCellRoofBox(cell)).filter(index => {
    if (excludedIds.has(index)) return false;
    if (actualBoxes === undefined) return true;
    const blocker = actualBoxes[index];
    return blocker !== null && blocker !== undefined && exactCellConflict(cell, blocker);
  }).map(blockerIndex => ({ cell, blockerIndex })));
}
