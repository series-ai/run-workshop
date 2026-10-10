import { buildingSeedOf, type SkyriverMass, type SkyriverTrimOwner } from '../../src/render/city';
import { retainedMassContact } from './retainedMassContact';
import { massRoofBox } from './rooftopDetailsGeometry';
import type { RetainedBridgeRecord } from './retainedStructuralSupport';
import type { LegacyTrimGeometry } from './legacyTrimInventory';
import { intersectSection, sectionUnionArea, type TowerSection } from './towerProfileGeometry';

/** Verify the published auxiliary geometry before removing any facade host ID. */
export function verifiedSupportNonHostIds(records: readonly RetainedBridgeRecord[], masses: readonly SkyriverMass[]): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const record of records) {
    const support = masses[record.supportMassIndex], child = masses[record.childFinalIndex], host = masses[record.hostMassIndex];
    if (!support || !child || !host || ids.has(record.supportMassIndex) || support.supportRole !== 'retained-child-bridge' || support.baseRecord !== undefined || !(support.height > 0 && support.height <= 4)) throw new Error('R36_AUXILIARY_HOST_RECORD');
    const key = (mass: SkyriverMass) => [mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z), mass.anchorV ?? mass.z];
    if ([support, host].some(mass => { const [owner, anchor] = key(mass); return owner !== record.owner || anchor !== record.anchorV; }) || retainedMassContact(massRoofBox(support), massRoofBox(child)) === null || retainedMassContact(massRoofBox(support), massRoofBox(host)) === null) throw new Error('R36_AUXILIARY_HOST_GEOMETRY');
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
  let area = 0;
  for (const { mass, index } of body) {
    if (nonHostMassIndices.has(index)) continue;
    if (requiredMassIndex !== undefined && index !== requiredMassIndex) continue;
    const plane = mass.x - side * mass.width / 2;
    if (!(trim.cx - trim.sx / 2 < plane && trim.cx + trim.sx / 2 > plane)) continue;
    const contact = intersectSection(requested, {
      x0: mass.z - mass.depth / 2, x1: mass.z + mass.depth / 2,
      z0: mass.y0, z1: mass.y0 + mass.height,
    });
    if (contact === null) continue;
    const covered: TowerSection[] = [];
    for (const other of body) {
      if (other.index === index) continue;
      const otherPlane = other.mass.x - side * other.mass.width / 2;
      if (side * otherPlane >= side * plane) continue;
      const rectangle = intersectSection(contact, {
        x0: other.mass.z - other.mass.depth / 2, x1: other.mass.z + other.mass.depth / 2,
        z0: other.mass.y0, z1: other.mass.y0 + other.mass.height,
      });
      if (rectangle) covered.push(rectangle);
    }
    const exposed = (contact.x1 - contact.x0) * (contact.z1 - contact.z0) - sectionUnionArea(covered);
    if (exposed > Math.max(1e-7, trim.sy * trim.sz * 1e-10)) { area += exposed; hosts.push(index); }
  }
  return { area, hostMassIndices: hosts };
}
