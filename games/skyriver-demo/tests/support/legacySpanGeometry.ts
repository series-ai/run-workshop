import { buildingSeedOf, placeTrim, SKYRIVER_TRIM_GANTRY, SKYRIVER_TRIM_SKYBRIDGE, type SkyriverCityTrims, type SkyriverMass, type SkyriverTrimOwner } from '../../src/render/city';
import type { LegacyTrimGeometry, LegacyTrimSource } from './legacyTrimInventory';
import { massRoofBox, roofBoxesConflict, roofBoxTolerance, trimRoofBox, type RoofBox } from './rooftopDetailsGeometry';

export interface SpanPoint { readonly x: number; readonly y: number; readonly z: number }
export interface SpanWorldPath {
  readonly endpoints: readonly [SpanPoint, SpanPoint];
  readonly sourceLengthM: number; readonly worldLengthM: number; readonly exposedLengthM: number;
}
export interface SpanHost { readonly massIndex: number; readonly canonicalOwner: number; readonly anchorV: number }
export interface SpanContact { readonly crossOverlapM: number; readonly verticalOverlapM: number }
export interface SpanFacts extends SpanWorldPath {
  readonly alongZ: boolean; readonly crossWidthM: number;
  readonly endpointOwners: readonly [SkyriverTrimOwner, SkyriverTrimOwner];
  readonly box: RoofBox; readonly foreignOwners: readonly number[];
}
export interface SpanBaseline extends SpanWorldPath {
  readonly index: number; readonly drawn: boolean; readonly bothContacts: boolean;
  readonly foreignOwners: readonly number[];
}
export interface SpanClaim {
  readonly source: LegacyTrimSource; readonly geometry: LegacyTrimGeometry; readonly facts: SpanFacts;
  readonly hosts: readonly [SpanHost, SpanHost]; readonly endpointContacts: readonly [SpanContact, SpanContact];
  readonly oldWorld: SpanWorldPath; readonly newWorld: SpanWorldPath;
}
export const spanOwner = (owner: SkyriverTrimOwner): number => owner.materialOwner ?? buildingSeedOf(owner.x, owner.z);
export const spanMassOwner = (mass: SkyriverMass): number => mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
const footprintGap = (owner: SkyriverTrimOwner, x: number, z: number) => Math.max(Math.abs(x - owner.x) - owner.width / 2, Math.abs(z - owner.z) - owner.depth / 2);

/** Clip the real cross-width segment. Keep the existing two-ULP contact rule. */
export function spanEndContact(point: SpanPoint, vx: number, vz: number, halfWidth: number, halfHeight: number, box: RoofBox): { readonly touches: boolean; readonly measurement: SpanContact } {
  const tolerance = roofBoxTolerance(box);
  const vertical = Math.min(point.y + halfHeight, box.y + box.hy) - Math.max(point.y - halfHeight, box.y - box.hy);
  const dx = point.x - box.x, dz = point.z - box.z;
  const p = [dx * box.c - dz * box.s, dx * box.s + dz * box.c];
  const v = [vx * box.c - vz * box.s, vx * box.s + vz * box.c];
  function clip(padding: number): number {
    let low = -halfWidth, high = halfWidth;
    for (let axis = 0; axis < 2; axis++) {
      const extent = (axis === 0 ? box.hx : box.hz) + padding;
      if (Math.abs(v[axis]!) < 1e-12) { if (Math.abs(p[axis]!) > extent) return -1; }
      else {
        const a = (-extent - p[axis]!) / v[axis]!, b = (extent - p[axis]!) / v[axis]!;
        low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
        if (low > high) return -1;
      }
    }
    return high - low;
  }
  return { touches: vertical >= -tolerance && clip(tolerance) >= 0,
    measurement: { crossOverlapM: Math.max(0, clip(0)), verticalOverlapM: Math.max(0, vertical) } };
}

/** Clip against each full world box, then subtract the interval union once. */
export function spanExposedLength(endpoints: readonly [SpanPoint, SpanPoint], boxes: readonly RoofBox[]): number {
  const a = endpoints[0], b = endpoints[1], length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), intervals: [number, number][] = [];
  for (const box of boxes) {
    const dx = a.x - box.x, dz = a.z - box.z;
    const p = [dx * box.c - dz * box.s, a.y - box.y, dx * box.s + dz * box.c];
    const vx = b.x - a.x, vz = b.z - a.z;
    const v = [vx * box.c - vz * box.s, b.y - a.y, vx * box.s + vz * box.c], extents = [box.hx, box.hy, box.hz];
    let low = 0, high = 1, hit = true;
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(v[axis]!) < 1e-12) { if (Math.abs(p[axis]!) >= extents[axis]!) { hit = false; break; } }
      else {
        const t0 = (-extents[axis]! - p[axis]!) / v[axis]!, t1 = (extents[axis]! - p[axis]!) / v[axis]!;
        low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
        if (low >= high) { hit = false; break; }
      }
    }
    if (hit) intervals.push([low, high]);
  }
  intervals.sort((x, y) => x[0] - y[0]);
  let covered = 0, low = -1, high = -1;
  for (const interval of intervals) {
    if (interval[0] > high) { if (high >= 0) covered += high - low; [low, high] = interval; }
    else high = Math.max(high, interval[1]);
  }
  if (high >= 0) covered += high - low;
  return Math.max(0, 1 - covered) * length;
}

export function spanFacts(trims: SkyriverCityTrims, index: number, masses: readonly SkyriverMass[]): SpanFacts {
  const owner = trims.owner[index], to = trims.spanTo[index];
  if (!owner || !to) throw new Error('R36_D3_SPAN_OWNER');
  const alongZ = trims.sz[index]! >= trims.sx[index]!, sourceLengthM = alongZ ? trims.sz[index]! : trims.sx[index]!;
  const lowX = trims.cx[index]! - (alongZ ? 0 : sourceLengthM / 2), lowZ = trims.cz[index]! - (alongZ ? sourceLengthM / 2 : 0);
  const endpointOwners: readonly [SkyriverTrimOwner, SkyriverTrimOwner] = footprintGap(owner, lowX, lowZ) <= footprintGap(to, lowX, lowZ) ? [owner, to] : [to, owner];
  const placed = placeTrim(trims, index, { x: 0, z: 0, heading: 0, length: 0 });
  const lx = alongZ ? Math.sin(placed.heading) : Math.cos(placed.heading), lz = alongZ ? Math.cos(placed.heading) : -Math.sin(placed.heading);
  const endpoints: readonly [SpanPoint, SpanPoint] = [
    { x: placed.x - lx * placed.length / 2, y: trims.cy[index]!, z: placed.z - lz * placed.length / 2 },
    { x: placed.x + lx * placed.length / 2, y: trims.cy[index]!, z: placed.z + lz * placed.length / 2 },
  ];
  const box = trimRoofBox(trims, index), ownerSet = new Set(endpointOwners.map(spanOwner));
  const foreignOwners = [...new Set(masses.filter(m => !ownerSet.has(spanMassOwner(m)) && roofBoxesConflict(box, massRoofBox(m))).map(spanMassOwner))].sort((a, b) => a - b);
  return { alongZ, sourceLengthM, worldLengthM: placed.length, endpoints, endpointOwners, box,
    crossWidthM: alongZ ? trims.sx[index]! : trims.sz[index]!, foreignOwners, exposedLengthM: spanExposedLength(endpoints, masses.map(massRoofBox)) };
}
export function spanContactAt(facts: SpanFacts, endpoint: 0 | 1, box: RoofBox): ReturnType<typeof spanEndContact> {
  const vx = facts.alongZ ? facts.box.c : facts.box.s, vz = facts.alongZ ? -facts.box.s : facts.box.c;
  return spanEndContact(facts.endpoints[endpoint], vx, vz, facts.crossWidthM / 2, facts.box.hy, box);
}

/** Check a real claim with the c6 path as the independent authority. */
export function legacySpanClaimFailures(claim: SpanClaim, masses: readonly SkyriverMass[], baseline: SpanBaseline, roofBoxes: readonly RoofBox[], heroBoxes: readonly RoofBox[], voidBoxes: readonly RoofBox[], prefixBoxes: readonly (RoofBox | null)[] = []): readonly string[] {
  const { source, geometry, facts } = claim, errors: string[] = [], tolerance = roofBoxTolerance(facts.box);
  if (!source.spanTo) return ['source-span-missing'];
  if (geometry.sy !== source.sy) errors.push('height-changed');
  const oldAlongZ = source.sz >= source.sx;
  if (oldAlongZ !== facts.alongZ) errors.push('source-axis-changed');
  const oldWidth = oldAlongZ ? source.sx : source.sz;
  if (source.kind === SKYRIVER_TRIM_GANTRY && (facts.crossWidthM !== oldWidth || facts.sourceLengthM > 300)) errors.push('gantry-dimensions');
  if (source.kind === SKYRIVER_TRIM_SKYBRIDGE && (geometry.cy < 2700 || (facts.crossWidthM !== oldWidth && !(facts.crossWidthM >= 20 && facts.crossWidthM <= 30)))) errors.push('skybridge-dimensions');
  for (const end of [0, 1] as const) {
    const host = claim.hosts[end], actual = masses[host.massIndex], owner = facts.endpointOwners[end];
    if (!actual) { errors.push(`host${end}-missing`); continue; }
    if (host.canonicalOwner !== spanOwner(owner) || host.anchorV !== owner.anchorV || spanMassOwner(actual) !== spanOwner(owner) || (actual.anchorV ?? actual.z) !== owner.anchorV) errors.push(`host${end}-identity`);
    const contact = spanContactAt(facts, end, massRoofBox(actual));
    if (!contact.touches) errors.push(`endpoint${end}-contact`);
    for (const key of ['crossOverlapM', 'verticalOverlapM'] as const) if (!Number.isFinite(claim.endpointContacts[end][key]) || Math.abs(claim.endpointContacts[end][key] - contact.measurement[key]) > tolerance) errors.push(`endpoint${end}-measurement`);
  }
  for (const [label, declared, actual] of [['old', claim.oldWorld, baseline], ['new', claim.newWorld, facts]] as const) {
    for (const end of [0, 1] as const) for (const key of ['x', 'y', 'z'] as const) if (!Number.isFinite(declared.endpoints[end][key]) || Math.abs(declared.endpoints[end][key] - actual.endpoints[end][key]) > tolerance) errors.push(`${label}-world-endpoint`);
    for (const key of ['sourceLengthM', 'worldLengthM', 'exposedLengthM'] as const) if (!Number.isFinite(declared[key]) || Math.abs(declared[key] - actual[key]) > tolerance) errors.push(`${label}-world-${key}`);
  }
  if (facts.foreignOwners.some(owner => !baseline.foreignOwners.includes(owner))) errors.push('new-foreign-owner');
  if (baseline.exposedLengthM > tolerance && facts.exposedLengthM <= tolerance) errors.push('buried-path');
  if (prefixBoxes.some((box, index) => box !== null && index !== source.sourceIndex && roofBoxesConflict(facts.box, box))) errors.push('prefix-collision');
  if (roofBoxes.some(box => roofBoxesConflict(facts.box, box))) errors.push('roof-collision');
  if (heroBoxes.some(box => roofBoxesConflict(facts.box, box))) errors.push('hero-collision');
  if (voidBoxes.some(box => roofBoxesConflict(facts.box, box))) errors.push('reserved-air-collision');
  return errors;
}
