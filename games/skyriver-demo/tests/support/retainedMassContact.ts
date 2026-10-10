import { createHash } from 'node:crypto';
import type { SkyriverMass } from '../../src/render/city';
import { roofBoxTolerance, type RoofBox } from './rooftopDetailsGeometry';

export type RetainedMassBaselineClass = 'foundation' | 'supported' | 'inherited-unsupported' | 'edge-only';
export interface RetainedMassSourceRecord {
  readonly originalIndex: number; readonly identitySha256: string;
  readonly baselineClass: RetainedMassBaselineClass; readonly witnessHostIndex: number | null;
  readonly oldSameOwnerContact: boolean;
}
export interface RetainedMassMatched {
  readonly record: RetainedMassSourceRecord; readonly finalIndex: number; readonly mass: SkyriverMass;
}
export const retainedMassIdentity = (mass: SkyriverMass): string => createHash('sha256').update(JSON.stringify(mass)).digest('hex');
function checkedBytes(input: { readonly count: number; readonly sha256: string; readonly base64: string }, width: number): Buffer {
  if (!Number.isInteger(input.count) || input.count < 0 || !/^[a-f0-9]{64}$/.test(input.sha256)) throw new Error('R36_CHILD_FIXTURE_HEADER');
  const bytes = Buffer.from(input.base64, 'base64');
  if (bytes.length !== input.count * width || createHash('sha256').update(bytes).digest('hex') !== input.sha256) throw new Error('R36_CHILD_FIXTURE_BYTES');
  return bytes;
}
export function readRetainedMassRecords(input: Parameters<typeof checkedBytes>[0], originalCount: number): readonly RetainedMassSourceRecord[] {
  const bytes = checkedBytes(input, 41), records: RetainedMassSourceRecord[] = [];
  for (let i = 0; i < input.count; i++) {
    const offset = i * 41, originalIndex = bytes.readUInt32LE(offset), flags = bytes.readUInt8(offset + 36), witness = bytes.readInt32LE(offset + 37);
    if (originalIndex >= originalCount || (records.length > 0 && originalIndex <= records[records.length - 1]!.originalIndex) || flags > 7 || witness < -1 || witness >= originalCount || witness === originalIndex) throw new Error('R36_CHILD_FIXTURE_RECORD');
    const cls = flags & 3;
    const baselineClass: RetainedMassBaselineClass = cls === 0 ? 'foundation' : cls === 1 ? 'supported' : cls === 2 ? 'inherited-unsupported' : 'edge-only';
    if ((baselineClass === 'supported') !== (witness >= 0)) throw new Error('R36_CHILD_FIXTURE_WITNESS');
    records.push({ originalIndex, identitySha256: bytes.subarray(offset + 4, offset + 36).toString('hex'), baselineClass, witnessHostIndex: witness < 0 ? null : witness, oldSameOwnerContact: (flags & 4) !== 0 });
  }
  return records;
}
export function readRetainedMassHosts(input: Parameters<typeof checkedBytes>[0], originalCount: number): ReadonlyMap<number, RoofBox> {
  const bytes = checkedBytes(input, 68), hosts = new Map<number, RoofBox>();
  for (let i = 0; i < input.count; i++) {
    const offset = i * 68, index = bytes.readUInt32LE(offset);
    if (index >= originalCount || hosts.has(index)) throw new Error('R36_CHILD_FIXTURE_HOST_INDEX');
    const values = Array.from({ length: 8 }, (_, component) => bytes.readDoubleLE(offset + 4 + component * 8));
    if (!values.every(Number.isFinite)) throw new Error('R36_CHILD_FIXTURE_HOST_VALUE');
    const [x, y, z, hx, hy, hz, c, s] = values;
    if (hx! <= 0 || hy! <= 0 || hz! <= 0 || Math.abs(c! * c! + s! * s! - 1) > 1e-12) throw new Error('R36_CHILD_FIXTURE_HOST_BOX');
    hosts.set(index, { x: x!, y: y!, z: z!, hx: hx!, hy: hy!, hz: hz!, c: c!, s: s! });
  }
  return hosts;
}

/** Consume each actual identity occurrence once. Keep original index order. */
export function matchRetainedMassOccurrences(records: readonly RetainedMassSourceRecord[], masses: readonly SkyriverMass[]): { readonly matched: readonly RetainedMassMatched[]; readonly missing: readonly number[] } {
  const byIdentity = new Map<string, number[]>();
  for (const [index, mass] of masses.entries()) {
    const key = retainedMassIdentity(mass), indices = byIdentity.get(key) ?? []; indices.push(index); byIdentity.set(key, indices);
  }
  const matched: RetainedMassMatched[] = [], missing: number[] = [];
  for (const record of records) {
    const finalIndex = byIdentity.get(record.identitySha256)?.shift();
    if (finalIndex === undefined) missing.push(record.originalIndex);
    else matched.push({ record, finalIndex, mass: masses[finalIndex]! });
  }
  return { matched, missing };
}
const corners = (box: RoofBox): readonly (readonly [number, number])[] => ([-1, 1] as const).flatMap(u => ([-1, 1] as const).map(v => [box.x + u * box.hx * box.c + v * box.hz * box.s, box.z - u * box.hx * box.s + v * box.hz * box.c] as const));
// Use perimeter order for each actual rectangle.
const perimeter = (box: RoofBox) => { const points = corners(box); return [points[0]!, points[2]!, points[3]!, points[1]!] as const; };

/** Positive volume or positive face area. A corner or edge is insufficient. */
export function retainedMassContact(a: RoofBox, b: RoofBox): 'volume' | 'roof-face' | 'side-face' | null {
  const epsilon = Math.max(roofBoxTolerance(a), roofBoxTolerance(b));
  const vertical = Math.min(a.y + a.hy, b.y + b.hy) - Math.max(a.y - a.hy, b.y - b.hy);
  if (vertical < -epsilon) return null;
  const dx = b.x - a.x, dz = b.z - a.z;
  const overlaps = [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]].map(([x, z]) => {
    const ra = a.hx * Math.abs(a.c * x! - a.s * z!) + a.hz * Math.abs(a.s * x! + a.c * z!);
    const rb = b.hx * Math.abs(b.c * x! - b.s * z!) + b.hz * Math.abs(b.s * x! + b.c * z!);
    return ra + rb - Math.abs(dx * x! + dz * z!);
  });
  const minimum = Math.min(...overlaps);
  if (minimum < -epsilon) return null;
  if (vertical > epsilon && minimum > epsilon) return 'volume';
  if (Math.abs(vertical) <= epsilon && minimum > epsilon) return 'roof-face';
  if (vertical <= epsilon) return null;
  const aa = perimeter(a), bb = perimeter(b);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const a0 = aa[i]!, a1 = aa[(i + 1) % 4]!, b0 = bb[j]!, b1 = bb[(j + 1) % 4]!;
    const ax = a1[0] - a0[0], az = a1[1] - a0[1], al = Math.hypot(ax, az), bx = b1[0] - b0[0], bz = b1[1] - b0[1], bl = Math.hypot(bx, bz);
    if (Math.abs((ax * bz - az * bx) / (al * bl)) > 1e-8) continue;
    if (Math.abs(((b0[0] - a0[0]) * az - (b0[1] - a0[1]) * ax) / al) > epsilon) continue;
    const t0 = ((b0[0] - a0[0]) * ax + (b0[1] - a0[1]) * az) / al, t1 = ((b1[0] - a0[0]) * ax + (b1[1] - a0[1]) * az) / al;
    if (Math.min(al, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > epsilon) return 'side-face';
  }
  return null;
}

/** Extent-expanded cells select candidates. The actual OBB test decides contact. */
export function retainedMassContactQuery(boxes: readonly RoofBox[]): (box: RoofBox, exclude: number) => readonly number[] {
  const cells = new Map<string, number[]>(), cell = 160, epsilon = Math.max(...boxes.map(roofBoxTolerance));
  const range = (box: RoofBox) => {
    const rx = Math.abs(box.c) * box.hx + Math.abs(box.s) * box.hz + epsilon;
    const rz = Math.abs(box.s) * box.hx + Math.abs(box.c) * box.hz + epsilon;
    return [Math.floor((box.x - rx) / cell), Math.floor((box.x + rx) / cell), Math.floor((box.z - rz) / cell), Math.floor((box.z + rz) / cell)] as const;
  };
  for (const [index, box] of boxes.entries()) {
    const [x0, x1, z0, z1] = range(box);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const key = `${x}:${z}`, indices = cells.get(key) ?? []; indices.push(index); cells.set(key, indices); }
  }
  return (box, exclude) => {
    const [x0, x1, z0, z1] = range(box), seen = new Set<number>(), hits: number[] = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (const index of cells.get(`${x}:${z}`) ?? []) {
      if (index === exclude || seen.has(index)) continue;
      seen.add(index); if (retainedMassContact(box, boxes[index]!)) hits.push(index);
    }
    return hits.sort((a, b) => a - b);
  };
}
