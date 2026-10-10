import { buildingSeedOf, type SkyriverFacadeFace, type SkyriverMass } from '../../src/render/city';
import { FACADE_FACE_EDGE_MARGIN_M } from '../../src/render/facadeGeometry';
import { massSection, intersectSection, sectionUnionArea } from './towerProfileGeometry';
import { massRoofBox, roofBoxTolerance, roofSupportFailures } from './rooftopDetailsGeometry';

export const ART_CROWN_HEIGHT_M = 200;
export const ART_HERO_MARGIN_M = FACADE_FACE_EDGE_MARGIN_M + 0.25;
export interface ActualHeroRoot { readonly u0: number; readonly u1: number; readonly y0: number; readonly y1: number }

/** Grade actual crown geometry. The old outer top stays fixed. */
export function crownCarveFailures(crown: SkyriverMass, oldGeometry: readonly number[], hosts: readonly SkyriverMass[]): readonly string[] {
  if (oldGeometry.length !== 8 || !oldGeometry.every(Number.isFinite)) throw new Error('R36_ART_OLD_CROWN');
  const errors: string[] = [], tolerance = roofBoxTolerance(massRoofBox(crown));
  const actual = [crown.x, crown.z, crown.y0, crown.width, crown.depth, crown.height, crown.materialOwner ?? crown.building ?? buildingSeedOf(crown.x, crown.z), crown.anchorV ?? crown.z];
  for (const index of [0, 1, 3, 4, 6, 7]) if (actual[index] !== oldGeometry[index]) errors.push(`fixed-field-${index}`);
  if (crown.height !== ART_CROWN_HEIGHT_M) errors.push('prototype-height');
  if (Math.abs(crown.y0 + crown.height - (oldGeometry[2]! + oldGeometry[5]!)) > tolerance) errors.push('outer-top');
  const contacts = hosts.filter(host => roofSupportFailures(massRoofBox(crown), massRoofBox(host), 0).length === 0);
  if (contacts.length === 0) errors.push('actual-roof-contact');
  if (hosts.some(host => host.y0 + host.height > crown.y0 + tolerance)) errors.push('body-not-lowered');
  return errors;
}

/** The final root plus its existing margin must fit real emitted facade surfaces. */
export function actualHeroRootFailures(root: ActualHeroRoot, face: SkyriverFacadeFace, masses: readonly SkyriverMass[]): readonly string[] {
  const canonical = face.owner.materialOwner ?? buildingSeedOf(face.owner.x, face.owner.z);
  const requested = { x0: root.u0 - ART_HERO_MARGIN_M, x1: root.u1 + ART_HERO_MARGIN_M, z0: root.y0 - ART_HERO_MARGIN_M, z1: root.y1 + ART_HERO_MARGIN_M };
  const area = (requested.x1 - requested.x0) * (requested.z1 - requested.z0), errors: string[] = [];
  if (!(area > 0)) return ['root-area'];
  if (requested.x0 < face.u0 || requested.x1 > face.u1 || requested.z0 < face.y0 || requested.z1 > face.y1) errors.push('face-fit');
  const rectangles = masses.flatMap(mass => {
    if ((mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z)) !== canonical || (mass.anchorV ?? mass.z) !== face.owner.anchorV) return [];
    const b = massSection(mass), axisX = face.planeAxis === 'x', a = axisX ? b.x0 : b.z0, c = axisX ? b.x1 : b.z1;
    if (Math.min(Math.abs(face.plane - a), Math.abs(face.plane - c)) > 1e-7) return [];
    const rectangle = intersectSection(requested, { x0: axisX ? b.z0 : b.x0, x1: axisX ? b.z1 : b.x1, z0: mass.y0, z1: mass.y0 + mass.height });
    return rectangle === null ? [] : [rectangle];
  });
  if (Math.abs(sectionUnionArea(rectangles) - area) > Math.max(1e-7, area * 1e-10)) errors.push('real-surface-fit');
  return errors;
}

/** A retained crown must equal the resolved authority and keep real roof support. */
export function retainedCrownFailures(crown: SkyriverMass, oldGeometry: readonly number[], hosts: readonly SkyriverMass[]): readonly string[] {
  if (oldGeometry.length !== 8 || !oldGeometry.every(Number.isFinite)) throw new Error('R36_ART_OLD_CROWN');
  const actual = [crown.x, crown.z, crown.y0, crown.width, crown.depth, crown.height, crown.materialOwner ?? crown.building ?? buildingSeedOf(crown.x, crown.z), crown.anchorV ?? crown.z];
  const errors: string[] = [];
  if (actual.some((value, index) => value !== oldGeometry[index])) errors.push('resolved-geometry');
  if (!hosts.some(host => roofSupportFailures(massRoofBox(crown), massRoofBox(host), 0).length === 0)) errors.push('actual-roof-contact');
  return errors;
}
