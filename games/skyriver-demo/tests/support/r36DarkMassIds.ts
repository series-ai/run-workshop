import { deriveFacadeFaces, deriveHeroBlades, type SkyriverMass, type SkyriverTowerProfileRow } from '../../src/render/city';
import { fixedArtBackingFailures, verifiedYawRoofCapIds, yawSpanLedgeFailures, approvedYawHostEnvelope } from './towerCrownCarve';
import type { presentCityLayout } from '../../src/render/presentationLayout';
import type { RetainedBridgeRecord } from './retainedStructuralSupport';
import { verifiedSupportNonHostIds } from './legacyTrimFaceGeometry';
import { massRoofBox, roofSupportFailures } from './rooftopDetailsGeometry';

/** Dark roles require actual published members and physical contact. */
export function verifiedR36DarkMassIds(
  layout: ReturnType<typeof presentCityLayout>, masses: readonly SkyriverMass[],
  profiles: readonly SkyriverTowerProfileRow[], records: readonly RetainedBridgeRecord[],
): ReadonlySet<number> {
  const bridges = verifiedSupportNonHostIds(records, masses), crowns = new Set<number>();
  for (const row of profiles) {
    if (row.eligibility.kind !== 'eligible' || !('stages' in row)) continue;
    const source = layout.towers[row.towerIndex], last = row.stages.at(-1);
    if (!source || !last) throw new Error('R36_DARK_CROWN_PROFILE');
    for (const index of row.crown.massIndices) {
      const mass = masses[index];
      if (!mass) throw new Error('R36_DARK_CROWN_INDEX');
      if (Reflect.get(mass, 'crownRole') !== 'ordinary-dark-crown') continue;
      if (crowns.has(index) || bridges.has(index) || mass.baseRecord || mass.supportRole
        || mass.materialOwner !== row.materialOwner || mass.building !== row.building
        || (mass.anchorV ?? mass.z) !== source.z
        || ![mass.x, mass.z, mass.y0, mass.width, mass.height, mass.depth].every(Number.isFinite)
        || !(mass.width > 0 && mass.height > 0 && mass.depth > 0)) throw new Error('R36_DARK_CROWN_IDENTITY');
      const supported = last.massIndices.some(hostIndex => {
        const host = masses[hostIndex];
        return host !== undefined && host.materialOwner === row.materialOwner
          && (host.anchorV ?? host.z) === source.z
          && roofSupportFailures(massRoofBox(mass), massRoofBox(host), 0).length === 0;
      });
      if (!supported) throw new Error('R36_DARK_CROWN_CONTACT');
      crowns.add(index);
    }
  }
  for (const [index, mass] of masses.entries()) {
    if (Reflect.get(mass, 'crownRole') === 'ordinary-dark-crown' && !crowns.has(index)) throw new Error('R36_DARK_CROWN_UNPUBLISHED');
    if (mass.supportRole === 'retained-child-bridge' && !bridges.has(index)) throw new Error('R36_DARK_BRIDGE_UNPUBLISHED');
  }
  const auxiliary = new Set(verifiedYawRoofCapIds(profiles, masses, layout.seed));
  for (const [index, mass] of masses.entries()) {
    if (mass.artBacking) {
      if (fixedArtBackingFailures(mass, masses, deriveFacadeFaces(layout), deriveHeroBlades(layout)).length) throw new Error('R36_DARK_ART_BACKING');
      auxiliary.add(index);
    }
    if (mass.supportRole === 'yaw-span-ledge') {
      const host = masses[mass.supportHostMassIndex!];
      if (!host || yawSpanLedgeFailures(mass, host, approvedYawHostEnvelope(host, mass.supportHostMassIndex!, profiles, layout.seed, masses)).length) throw new Error('R36_DARK_SPAN_LEDGE');
      auxiliary.add(index);
    }
  }
  return new Set([...bridges, ...crowns, ...auxiliary]);
}
