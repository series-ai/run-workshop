import {
  buildingSeedOf, skyriverTrimBlocksHero,
  SKYRIVER_TRIM_ANTENNA, SKYRIVER_TRIM_ROOF_PLANT, SKYRIVER_TRIM_RIB, SKYRIVER_TRIM_BAND,
  type SkyriverCityTrims, type SkyriverMass, type SkyriverHeroBlade,
} from '../../src/render/city';
import { legacyTrimExposedContact } from './legacyTrimFaceGeometry';
import { massRoofBox, roofSupportFailures, trimRoofBox } from './rooftopDetailsGeometry';
import { intersectSection, sectionUnionArea, type TowerSection } from './towerProfileGeometry';

export interface LegacyTrimSupportGroup {
  readonly owner: number;
  readonly kind: number;
  readonly seedBits: number;
  readonly valid: readonly number[];
  readonly invalid: readonly number[];
  readonly invalidIdentities: readonly string[];
}

/** Position and footprint can change during rehosting. These identity fields cannot. */
export function legacyTrimSupportKey(owner: number, kind: number, seedBits: number): string {
  return `${owner}/${kind}/${seedBits}`;
}

export function trimSeedBits(seed: number): number {
  return new Uint32Array(new Float32Array([seed]).buffer)[0]!;
}

/** Use this only to resolve a mixed valid/invalid seed collision. */
export function legacyTrimPhysicalIdentity(trims: SkyriverCityTrims, index: number): string {
  const owner = trims.owner[index]!;
  return JSON.stringify([owner.x, owner.z, owner.width, owner.depth, owner.anchorV ?? owner.z,
    trims.cx[index], trims.cy[index], trims.cz[index], trims.sx[index], trims.sy[index], trims.sz[index]]);
}

/** Clip deliberate band end overhang to its owner's footprint. */
export function legacySideContactArea(trims: SkyriverCityTrims, index: number, masses: readonly SkyriverMass[]): number {
  const owner = trims.owner[index]!;
  if ((owner.yawRad ?? 0) !== 0 || masses.some(mass => (mass.yawRad ?? 0) !== 0)) {
    return legacyTrimExposedContact({ cx: trims.cx[index]!, cy: trims.cy[index]!, cz: trims.cz[index]!,
      sx: trims.sx[index]!, sy: trims.sy[index]!, sz: trims.sz[index]! }, owner, masses).area;
  }
  const requested: TowerSection = {
    x0: Math.max(trims.cz[index]! - trims.sz[index]! / 2, owner.z - owner.depth / 2),
    x1: Math.min(trims.cz[index]! + trims.sz[index]! / 2, owner.z + owner.depth / 2),
    z0: trims.cy[index]! - trims.sy[index]! / 2,
    z1: trims.cy[index]! + trims.sy[index]! / 2,
  };
  if (requested.x1 <= requested.x0) return 0;
  const x0 = trims.cx[index]! - trims.sx[index]! / 2;
  const x1 = trims.cx[index]! + trims.sx[index]! / 2;
  const rectangles: TowerSection[] = [];
  for (const mass of masses) {
    if ((mass.anchorV ?? mass.z) !== (owner.anchorV ?? owner.z)) continue;
    if (Math.min(x1, mass.x + mass.width / 2) <= Math.max(x0, mass.x - mass.width / 2)) continue;
    const contact = intersectSection(requested, {
      x0: mass.z - mass.depth / 2, x1: mass.z + mass.depth / 2,
      z0: mass.y0, z1: mass.y0 + mass.height,
    });
    if (contact) rectangles.push(contact);
  }
  return sectionUnionArea(rectangles);
}

/** Real prefix geometry after the renderer's hero filter. No declared support flag is used. */
export function inspectLegacyTrimSupport(
  masses: readonly SkyriverMass[], trims: SkyriverCityTrims, prefix: number,
  heroes: readonly SkyriverHeroBlade[], ordinaryOwners: ReadonlySet<number>,
): { roof: ReadonlyMap<string, LegacyTrimSupportGroup>; side: ReadonlyMap<string, LegacyTrimSupportGroup> } {
  const byOwner = new Map<number, SkyriverMass[]>();
  for (const mass of masses) {
    const owner = mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
    const list = byOwner.get(owner) ?? []; list.push(mass); byOwner.set(owner, list);
  }
  const roof = new Map<string, LegacyTrimSupportGroup>();
  const side = new Map<string, LegacyTrimSupportGroup>();
  for (let i = 0; i < prefix; i++) {
    const on = trims.owner[i]!;
    const owner = on.materialOwner ?? buildingSeedOf(on.x, on.z);
    const kind = trims.kind[i]!;
    if (!ordinaryOwners.has(owner) || trims.spanTo[i] !== null || skyriverTrimBlocksHero(trims, i, heroes)) continue;
    const isRoof = kind === SKYRIVER_TRIM_ANTENNA || kind === SKYRIVER_TRIM_ROOF_PLANT;
    const isSide = kind === SKYRIVER_TRIM_RIB || kind === SKYRIVER_TRIM_BAND;
    if (!isRoof && !isSide) continue;
    const body = byOwner.get(owner) ?? [];
    const prop = isRoof ? trimRoofBox(trims, i) : null;
    const area = trims.sz[i]! * trims.sy[i]!;
    const valid = prop !== null
      ? body.some(mass => roofSupportFailures(prop, massRoofBox(mass), 0).length === 0)
      : legacySideContactArea(trims, i, body) > Math.max(1e-7, area * 1e-10);
    const seedBits = trimSeedBits(trims.seedValue[i]!);
    const key = legacyTrimSupportKey(owner, kind, seedBits);
    const target = isRoof ? roof : side;
    const group = target.get(key);
    target.set(key, {
      owner, kind, seedBits,
      valid: [...(group?.valid ?? []), ...(valid ? [i] : [])],
      invalid: [...(group?.invalid ?? []), ...(valid ? [] : [i])],
      invalidIdentities: [...(group?.invalidIdentities ?? []), ...(valid ? [] : [legacyTrimPhysicalIdentity(trims, i)])],
    });
  }
  return { roof, side };
}
