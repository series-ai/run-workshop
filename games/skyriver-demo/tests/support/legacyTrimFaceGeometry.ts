import { buildingSeedOf, type SkyriverMass, type SkyriverTrimOwner } from '../../src/render/city';
import { retainedMassContact } from './retainedMassContact';
import { roofBoxTolerance } from './rooftopDetailsGeometry';
import type { RetainedBridgeRecord } from './retainedStructuralSupport';
import type { LegacyTrimGeometry } from './legacyTrimInventory';
import { independentMassRoofBox, independentBoxPoint, intersectSection, sectionUnionArea, type TowerSection } from './towerProfileGeometry';

/** Verify the published auxiliary geometry before removing any facade host ID. */
export function verifiedSupportNonHostIds(records: readonly RetainedBridgeRecord[], masses: readonly SkyriverMass[]): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const record of records) {
    const support = masses[record.supportMassIndex], child = masses[record.childFinalIndex], host = masses[record.hostMassIndex];
    if (!support || !child || !host || ids.has(record.supportMassIndex) || support.supportRole !== 'retained-child-bridge' || support.baseRecord !== undefined || !(support.height > 0 && support.height <= 4)) throw new Error('R36_AUXILIARY_HOST_RECORD');
    const key = (mass: SkyriverMass) => [mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z), mass.anchorV ?? mass.z];
    if ([support, host].some(mass => { const [owner, anchor] = key(mass); return owner !== record.owner || anchor !== record.anchorV; }) || retainedMassContact(independentMassRoofBox(support), independentMassRoofBox(child)) === null || retainedMassContact(independentMassRoofBox(support), independentMassRoofBox(host)) === null) throw new Error('R36_AUXILIARY_HOST_GEOMETRY');
    ids.add(record.supportMassIndex);
  }
  return ids;
}

/** Contact is measured on the real inward X boundary, after nearer owner boxes cover it. */
export function legacyTrimExposedContact(
  trim: LegacyTrimGeometry, owner: SkyriverTrimOwner, masses: readonly SkyriverMass[], requiredMassIndex?: number, nonHostMassIndices: ReadonlySet<number> = new Set(),
): { readonly area: number; readonly hostMassIndices: readonly number[] } {
  const canonical = owner.materialOwner ?? buildingSeedOf(owner.x, owner.z);
  const body = masses.map((mass, index) => ({ mass, index })).filter(({ mass }) =>
    (mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z)) === canonical
    && (mass.anchorV ?? mass.z) === owner.anchorV);
  const requested: TowerSection = {
    x0: Math.max(trim.cz - trim.sz / 2, owner.z - owner.depth / 2),
    x1: Math.min(trim.cz + trim.sz / 2, owner.z + owner.depth / 2),
    z0: trim.cy - trim.sy / 2, z1: trim.cy + trim.sy / 2,
  };
  const side = Math.sign(trim.cx), hosts: number[] = [];
  const toFrame = (mass: SkyriverMass) => {
    const pivot = owner.yawAnchor ?? owner, c = Math.cos(owner.yawRad ?? 0), s = Math.sin(owner.yawRad ?? 0);
    // Both bodies have the same canyon anchor. Its rigid transform cancels exactly.
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const point = independentBoxPoint(mass, mass.x + u! * mass.width / 2, mass.z + v! * mass.depth / 2);
      if ((owner.yawRad ?? 0) === 0) return point;
      const dx = point.x - pivot.x, dz = point.z - pivot.z;
      return { x: pivot.x + c * dx - s * dz, z: pivot.z + s * dx + c * dz };
    });
  };
  const polygons = new Map(body.map(({ mass, index }) => [index, toFrame(mass)]));
  let area = 0;
  for (const { mass, index } of body) {
    if (nonHostMassIndices.has(index)) continue;
    if (requiredMassIndex !== undefined && index !== requiredMassIndex) continue;
    const polygon = polygons.get(index)!, a = polygon[side > 0 ? 3 : 1]!, b = polygon[side > 0 ? 0 : 2]!;
    const dx = b.x - a.x, dz = b.z - a.z, epsilon = roofBoxTolerance(independentMassRoofBox(mass));
    let low = 0, high = 1;
    const clipInterval = (origin: number, delta: number, min: number, max: number) => {
      if (Math.abs(delta) < 1e-12) { if (!(origin > min && origin < max)) high = -1; return; }
      const first = (min - origin) / delta, last = (max - origin) / delta;
      low = Math.max(low, Math.min(first, last)); high = Math.min(high, Math.max(first, last));
    };
    clipInterval(a.x, dx, trim.cx - trim.sx / 2, trim.cx + trim.sx / 2);
    clipInterval(a.z, dz, requested.x0, requested.x1);
    if ((high - low) * Math.hypot(dx, dz) <= epsilon || Math.abs(dz) <= epsilon) continue;
    const za = a.z + low * dz, zb = a.z + high * dz;
    const contact = intersectSection(requested, { x0: Math.min(za, zb), x1: Math.max(za, zb), z0: mass.y0, z1: mass.y0 + mass.height });
    if (contact === null) continue;
    const covered: TowerSection[] = [];
    for (const other of body) {
      if (other.index === index) continue;
      const points = polygons.get(other.index)!, clipped: { x: number; z: number }[] = [];
      const distance = (p: { x: number; z: number }) => -side * (p.x - a.x - (p.z - a.z) * dx / dz);
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!, q = points[(i + 1) % points.length]!, dp = distance(p), dq = distance(q);
        if (dp > epsilon) clipped.push(p);
        if ((dp > epsilon && dq <= epsilon) || (dp <= epsilon && dq > epsilon)) {
          const t = (dp - epsilon) / (dp - dq);
          clipped.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
        }
      }
      if (clipped.length < 3) continue;
      const rectangle = intersectSection(contact, { x0: Math.min(...clipped.map(p => p.z)), x1: Math.max(...clipped.map(p => p.z)), z0: other.mass.y0, z1: other.mass.y0 + other.mass.height });
      if (rectangle) covered.push(rectangle);
    }
    const exposed = (contact.x1 - contact.x0) * (contact.z1 - contact.z0) - sectionUnionArea(covered);
    if (exposed > Math.max(1e-7, trim.sy * trim.sz * 1e-10)) { area += exposed * Math.hypot(dx, dz) / Math.abs(dz); hosts.push(index); }
  }
  return { area, hostMassIndices: hosts };
}
