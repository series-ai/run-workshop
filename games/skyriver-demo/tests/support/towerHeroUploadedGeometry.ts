import { type SkyriverFacadeFace, type SkyriverMass } from '../../src/render/city';
import { ART_HERO_MARGIN_M, type ActualHeroRoot } from './towerCrownCarve';
import { facadeCoordinates, physicalFacadeRectangles, sectionUnionArea } from './towerProfileGeometry';
import { type RoofBox } from './rooftopDetailsGeometry';

export interface UploadedHeroHost { readonly mass: SkyriverMass; readonly box: RoofBox }

/** Convert real uploaded world coordinates to the source facade frame. */
export function heroFacadeCoordinates(face: SkyriverFacadeFace, x: number, z: number): { readonly x: number; readonly z: number } {
  return facadeCoordinates(face, x, z);
}

/** Only the existing two-Float32-ULP geometry tolerance applies to uploaded boxes. */
export function uploadedHeroRootFailures(root: ActualHeroRoot, face: SkyriverFacadeFace, hosts: readonly UploadedHeroHost[]): readonly string[] {
  const requested = { x0: root.u0 - ART_HERO_MARGIN_M, x1: root.u1 + ART_HERO_MARGIN_M, z0: root.y0 - ART_HERO_MARGIN_M, z1: root.y1 + ART_HERO_MARGIN_M };
  const area = (requested.x1 - requested.x0) * (requested.z1 - requested.z0);
  if (!(area > 0) || !Object.values(requested).every(Number.isFinite)) return ['root-area'];
  const { rectangles, tolerance } = physicalFacadeRectangles(face, hosts, requested);
  const errors: string[] = [];
  if (requested.x0 < face.u0 - tolerance || requested.x1 > face.u1 + tolerance || requested.z0 < face.y0 - tolerance || requested.z1 > face.y1 + tolerance) errors.push('uploaded-face-fit');
  if (Math.abs(sectionUnionArea(rectangles) - area) > Math.max(1e-7, area * 1e-10)) errors.push('uploaded-real-surface-fit');
  return errors;
}
