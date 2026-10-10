import {
  buildingSeedOf, placeTrim, skyriverTrimBlocksHero,
  type SkyriverCityTrims, type SkyriverHeroBlade, type SkyriverMass, type SkyriverTrimOwner,
} from '../../src/render/city';
import { massRoofBox, roofBoxDistance, roofBoxTolerance, type RoofBox } from './rooftopDetailsGeometry';
import { trimSeedBits } from './legacyTrimSupport';

export interface SpanEndpointContact {
  readonly x: number;
  readonly z: number;
  readonly canonicalOwner: number;
  readonly contactMassIndices: readonly number[];
  readonly nearestMassIndex: number | null;
  readonly centreDistanceM: number;
}

export interface LegacySpanContactRecord {
  readonly index: number;
  readonly key: string;
  readonly kind: number;
  readonly bothContacts: boolean;
  readonly ends: readonly SpanEndpointContact[];
}

/** Clip the full vertical end face against an actual upright box. */
function faceContactsBox(
  x: number, z: number, vx: number, vz: number,
  halfWidth: number, y: number, halfHeight: number, box: RoofBox,
): boolean {
  const tolerance = roofBoxTolerance(box);
  if (Math.min(y + halfHeight, box.y + box.hy) < Math.max(y - halfHeight, box.y - box.hy) - tolerance) return false;
  const dx = x - box.x, dz = z - box.z;
  const p = [dx * box.c - dz * box.s, dx * box.s + dz * box.c];
  const v = [vx * box.c - vz * box.s, vx * box.s + vz * box.c];
  const extents = [box.hx + tolerance, box.hz + tolerance];
  let low = -halfWidth, high = halfWidth;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(v[axis]!) < 1e-12) {
      if (Math.abs(p[axis]!) > extents[axis]!) return false;
    } else {
      const a = (-extents[axis]! - p[axis]!) / v[axis]!;
      const b = (extents[axis]! - p[axis]!) / v[axis]!;
      low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
      if (low > high) return false;
    }
  }
  return true;
}

const ownerSeed = (owner: SkyriverTrimOwner) => owner.materialOwner ?? buildingSeedOf(owner.x, owner.z);
const footprintGap = (owner: SkyriverTrimOwner, x: number, z: number) =>
  Math.max(Math.abs(x - owner.x) - owner.width / 2, Math.abs(z - owner.z) - owner.depth / 2);

/** Identity includes both canonical endpoints, kind and exact uploaded seed bits. */
export function legacySpanContactKey(owner: number, to: number, kind: number, seedBits: number): string {
  return [Math.min(owner, to), Math.max(owner, to), kind, seedBits].join('/');
}

export function inspectLegacySpanContacts(
  masses: readonly SkyriverMass[], trims: SkyriverCityTrims, prefix: number, heroes: readonly SkyriverHeroBlade[],
): readonly LegacySpanContactRecord[] {
  const byOwner = new Map<number, { readonly index: number; readonly box: RoofBox }[]>();
  for (const [index, mass] of masses.entries()) {
    const owner = mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
    const list = byOwner.get(owner) ?? []; list.push({ index, box: massRoofBox(mass) }); byOwner.set(owner, list);
  }
  const records: LegacySpanContactRecord[] = [];
  for (let i = 0; i < prefix; i++) {
    const to = trims.spanTo[i];
    if (!to || skyriverTrimBlocksHero(trims, i, heroes)) continue;
    const owner = trims.owner[i]!;
    const along = trims.sz[i]! >= trims.sx[i]!;
    const half = (along ? trims.sz[i]! : trims.sx[i]!) / 2;
    const e0x = along ? trims.cx[i]! : trims.cx[i]! - half;
    const e0z = along ? trims.cz[i]! - half : trims.cz[i]!;
    const ownerAtLow = footprintGap(owner, e0x, e0z) <= footprintGap(to, e0x, e0z);
    const owners = ownerAtLow ? [owner, to] : [to, owner];
    const placed = placeTrim(trims, i, { x: 0, z: 0, heading: 0, length: 0 });
    const lx = along ? Math.sin(placed.heading) : Math.cos(placed.heading);
    const lz = along ? Math.cos(placed.heading) : -Math.sin(placed.heading);
    const sx = along ? Math.cos(placed.heading) : Math.sin(placed.heading);
    const sz = along ? -Math.sin(placed.heading) : Math.cos(placed.heading);
    const ends = [-1, 1].map((sign, j): SpanEndpointContact => {
      const x = placed.x + sign * lx * placed.length / 2;
      const z = placed.z + sign * lz * placed.length / 2;
      const canonicalOwner = ownerSeed(owners[j]!);
      const body = byOwner.get(canonicalOwner) ?? [];
      const contactMassIndices: number[] = [];
      let nearestMassIndex: number | null = null, centreDistanceM = Infinity;
      for (const { index, box } of body) {
        if (faceContactsBox(x, z, sx, sz, (along ? trims.sx[i]! : trims.sz[i]!) / 2,
          trims.cy[i]!, trims.sy[i]! / 2, box)) contactMassIndices.push(index);
        const distance = roofBoxDistance(box, x, trims.cy[i]!, z);
        if (distance < centreDistanceM) { nearestMassIndex = index; centreDistanceM = distance; }
      }
      return { x, z, canonicalOwner, contactMassIndices, nearestMassIndex, centreDistanceM };
    });
    records.push({ index: i, kind: trims.kind[i]!,
      key: legacySpanContactKey(ownerSeed(owner), ownerSeed(to), trims.kind[i]!, trimSeedBits(trims.seedValue[i]!)),
      bothContacts: ends.every(end => end.contactMassIndices.length > 0), ends });
  }
  return records;
}
