import { buildingSeedOf, warpRigid, type SkyriverFacadeFace, type SkyriverMass } from '../../src/render/city';
import { ART_HERO_MARGIN_M, type ActualHeroRoot } from './towerCrownCarve';
import { intersectSection, sectionUnionArea } from './towerProfileGeometry';
import { roofBoxTolerance, roofCorners, type RoofBox } from './rooftopDetailsGeometry';

export interface UploadedHeroHost { readonly mass: SkyriverMass; readonly box: RoofBox }

/** Convert real uploaded world coordinates to the source facade frame. */
export function heroFacadeCoordinates(face: SkyriverFacadeFace, x: number, z: number): { readonly x: number; readonly z: number } {
  const anchor = face.owner.anchorV, origin = warpRigid(0, anchor, anchor, { x: 0, z: 0, heading: 0 });
  const dx = x - origin.x, dz = z - origin.z, c = Math.cos(origin.heading), s = Math.sin(origin.heading);
  return { x: dx * c - dz * s, z: anchor + dx * s + dz * c };
}

/** Only the existing two-Float32-ULP geometry tolerance applies to uploaded boxes. */
export function uploadedHeroRootFailures(root: ActualHeroRoot, face: SkyriverFacadeFace, hosts: readonly UploadedHeroHost[]): readonly string[] {
  const requested = { x0: root.u0 - ART_HERO_MARGIN_M, x1: root.u1 + ART_HERO_MARGIN_M, z0: root.y0 - ART_HERO_MARGIN_M, z1: root.y1 + ART_HERO_MARGIN_M };
  const area = (requested.x1 - requested.x0) * (requested.z1 - requested.z0);
  if (!(area > 0) || !Object.values(requested).every(Number.isFinite)) return ['root-area'];
  const canonical = face.owner.materialOwner ?? buildingSeedOf(face.owner.x, face.owner.z), axisX = face.planeAxis === 'x';
  let tolerance = 0;
  const rectangles = hosts.flatMap(({ mass, box }) => {
    if ((mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z)) !== canonical || (mass.anchorV ?? mass.z) !== face.owner.anchorV) return [];
    const corners = roofCorners(box).map(([x, , z]) => heroFacadeCoordinates(face, x, z));
    const xs = corners.map(p => p.x), zs = corners.map(p => p.z);
    const a = Math.min(...(axisX ? xs : zs)), b = Math.max(...(axisX ? xs : zs)), epsilon = roofBoxTolerance(box);
    if (Math.min(Math.abs(face.plane - a), Math.abs(face.plane - b)) > epsilon) return [];
    tolerance = Math.max(tolerance, epsilon);
    const us = axisX ? zs : xs;
    const rectangle = intersectSection(requested, { x0: Math.min(...us) - epsilon, x1: Math.max(...us) + epsilon, z0: box.y - box.hy - epsilon, z1: box.y + box.hy + epsilon });
    return rectangle === null ? [] : [rectangle];
  });
  const errors: string[] = [];
  if (requested.x0 < face.u0 - tolerance || requested.x1 > face.u1 + tolerance || requested.z0 < face.y0 - tolerance || requested.z1 > face.y1 + tolerance) errors.push('uploaded-face-fit');
  if (Math.abs(sectionUnionArea(rectangles) - area) > Math.max(1e-7, area * 1e-10)) errors.push('uploaded-real-surface-fit');
  return errors;
}
