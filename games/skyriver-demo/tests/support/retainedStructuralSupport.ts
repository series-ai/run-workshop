import { addedVolumeCells } from './towerAddedVolume';
import type { RoofBox } from './rooftopDetailsGeometry';
import { roofBoxesConflict, roofBoxTolerance } from './rooftopDetailsGeometry';

export interface RetainedBridgeRecord {
  readonly supportMassIndex: number;
  readonly childSourceIndex: number;
  readonly childFinalIndex: number;
  readonly hostMassIndex: number;
  readonly owner: number;
  readonly anchorV: number;
  readonly geometry: { readonly kind: 'strict-clear' } | { readonly kind: 'original-owner-contained'; readonly sourceMassIndices: readonly number[] };
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('R36_SUPPORT_RECORD_OBJECT');
  return Object.fromEntries(Object.entries(value));
}
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('R36_SUPPORT_RECORD_NUMBER'); return value; }
function index(value: unknown): number { const n = number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('R36_SUPPORT_RECORD_INDEX'); return n; }
export function readRetainedBridgeRecords(value: unknown): readonly RetainedBridgeRecord[] {
  if (!Array.isArray(value) || !Object.isFrozen(value)) throw new Error('R36_SUPPORT_RECORD_ARRAY');
  const records = value.map(item => {
    if (!Object.isFrozen(item)) throw new Error('R36_SUPPORT_RECORD_NOT_FROZEN');
    const r = object(item), g = object(r.geometry);
    if (!Object.isFrozen(r.geometry)) throw new Error('R36_SUPPORT_GEOMETRY_NOT_FROZEN');
    let geometry: RetainedBridgeRecord['geometry'];
    if (g.kind === 'strict-clear') { if ('sourceMassIndices' in g) throw new Error('R36_SUPPORT_CLEAR_UNION'); geometry = { kind: 'strict-clear' }; }
    else if (g.kind === 'original-owner-contained') {
      if (!Array.isArray(g.sourceMassIndices) || !Object.isFrozen(g.sourceMassIndices)) throw new Error('R36_SUPPORT_UNION_ARRAY');
      const ids = g.sourceMassIndices.map(index);
      if (!ids.length || new Set(ids).size !== ids.length) throw new Error('R36_SUPPORT_UNION_INDICES');
      geometry = { kind: 'original-owner-contained', sourceMassIndices: ids };
    } else throw new Error('R36_SUPPORT_GEOMETRY_KIND');
    return { supportMassIndex: index(r.supportMassIndex), childSourceIndex: index(r.childSourceIndex), childFinalIndex: index(r.childFinalIndex), hostMassIndex: index(r.hostMassIndex), owner: number(r.owner), anchorV: number(r.anchorV), geometry };
  });
  if (new Set(records.map(r => r.supportMassIndex)).size !== records.length) throw new Error('R36_SUPPORT_DUPLICATE_MASS');
  return records;
}

export interface SourceSolid { readonly index: number; readonly x: number; readonly y0: number; readonly z: number; readonly width: number; readonly height: number; readonly depth: number }
export function sourceSolid(values: readonly number[]): SourceSolid {
  if (values.length !== 7 || values.some(v => !Number.isFinite(v))) throw new Error('R36_SUPPORT_SOURCE_SOLID');
  const [i, x, y0, z, width, height, depth] = values;
  if (i === undefined || x === undefined || y0 === undefined || z === undefined || width === undefined || height === undefined || depth === undefined || !Number.isSafeInteger(i) || i < 0 || width <= 0 || height <= 0 || depth <= 0) throw new Error('R36_SUPPORT_SOURCE_SOLID');
  return { index: i, x, y0, z, width, height, depth };
}
/** Partition every open cell at actual box faces in the common source frame. */
export function uncoveredSupportVolume(piece: Omit<SourceSolid, 'index'> & { readonly yawRad?: number; readonly yawAnchor?: { readonly x: number; readonly z: number } }, solids: readonly SourceSolid[]): number {
  if ((piece.yawRad ?? 0) !== 0) {
    const frame = { owner: 0, anchorV: 0 };
    return addedVolumeCells({ ...piece, ...frame }, solids.map(solid => ({ ...solid, ...frame })))
      .reduce((volume, cell) => volume + cell.volumeM3, 0);
  }
  const p = [piece.x - piece.width / 2, piece.x + piece.width / 2, piece.y0, piece.y0 + piece.height, piece.z - piece.depth / 2, piece.z + piece.depth / 2];
  const boxes = solids.map(b => [b.x - b.width / 2, b.x + b.width / 2, b.y0, b.y0 + b.height, b.z - b.depth / 2, b.z + b.depth / 2]).filter(b => b[1]! > p[0]! && b[0]! < p[1]! && b[3]! > p[2]! && b[2]! < p[3]! && b[5]! > p[4]! && b[4]! < p[5]!);
  const axes = [0, 2, 4].map(k => [...new Set([p[k]!, p[k + 1]!, ...boxes.flatMap(b => [Math.max(p[k]!, b[k]!), Math.min(p[k + 1]!, b[k + 1]!)])])].sort((a, b) => a - b));
  let uncovered = 0;
  for (let i = 0; i < axes[0]!.length - 1; i++) for (let j = 0; j < axes[1]!.length - 1; j++) for (let k = 0; k < axes[2]!.length - 1; k++) {
    const low = [axes[0]![i]!, axes[1]![j]!, axes[2]![k]!], high = [axes[0]![i + 1]!, axes[1]![j + 1]!, axes[2]![k + 1]!];
    const c = low.map((v, a) => (v + high[a]!) / 2);
    if (!boxes.some(b => c[0]! > b[0]! && c[0]! < b[1]! && c[1]! > b[2]! && c[1]! < b[3]! && c[2]! > b[4]! && c[2]! < b[5]!)) uncovered += (high[0]! - low[0]!) * (high[1]! - low[1]!) * (high[2]! - low[2]!);
  }
  return uncovered;
}
/** Full OBB test after an extent-expanded spatial lookup. */
export function supportConflictQuery(boxes: readonly (RoofBox | null)[]): (box: RoofBox) => readonly number[] {
  const grid = new Map<string, number[]>(), cell = 160;
  const bounds = (b: RoofBox) => { const x = Math.abs(b.c) * b.hx + Math.abs(b.s) * b.hz, z = Math.abs(b.s) * b.hx + Math.abs(b.c) * b.hz; return [Math.floor((b.x - x) / cell), Math.floor((b.x + x) / cell), Math.floor((b.z - z) / cell), Math.floor((b.z + z) / cell)]; };
  boxes.forEach((box, index) => { if (!box) return; const b = bounds(box); for (let x = b[0]!; x <= b[1]!; x++) for (let z = b[2]!; z <= b[3]!; z++) { const key = `${x}:${z}`, ids = grid.get(key) ?? []; ids.push(index); grid.set(key, ids); } });
  return box => { const b = bounds(box), seen = new Set<number>(), hits: number[] = []; for (let x = b[0]!; x <= b[1]!; x++) for (let z = b[2]!; z <= b[3]!; z++) for (const index of grid.get(`${x}:${z}`) ?? []) { if (seen.has(index)) continue; seen.add(index); const other = boxes[index]; if (other && roofBoxesConflict(box, other)) hits.push(index); } return hits; };
}

/** A support cannot cross the open interior of an actual R27 roof plane. */
export function supportCrossesRoofPlane(support: RoofBox, roof: RoofBox): boolean {
  const roofY = roof.y + roof.hy;
  const tolerance = Math.max(roofBoxTolerance(support), roofBoxTolerance(roof));
  if (roofY - (support.y - support.hy) <= tolerance || support.y + support.hy - roofY <= tolerance) return false;
  return roofBoxesConflict(support, { ...roof, y: support.y, hy: support.hy });
}
