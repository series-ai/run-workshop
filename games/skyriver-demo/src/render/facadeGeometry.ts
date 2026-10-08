/** Geometry checks shared by facade fitting, spacing audits, and pane-step masking. */
export interface FacadeRect {
  readonly u0: number;
  readonly u1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface FacadeFace extends FacadeRect {
  readonly id: string;
  readonly buildingId: string;
  readonly side: -1 | 1;
  readonly planeAxis: 'x' | 'z';
  readonly plane: number;
  readonly outward: -1 | 1;
  readonly stepBottom: boolean;
  readonly stepTop: boolean;
}

export interface FacadeReservation extends FacadeRect {
  readonly side: -1 | 1;
  readonly buildingId: string;
  readonly heightM: number;
  readonly compositionId: string;
  readonly role: 'ordinary' | 'hero';
}

export interface FacadeFit {
  readonly face: FacadeFace;
  readonly rect: FacadeRect;
  readonly offsetM: number;
}

export const FACADE_FACE_EDGE_MARGIN_M = 4;
export const FACADE_STEP_MASK_BAND_M = 12;

export function facadeFaceContains(face: FacadeFace, rect: FacadeRect, marginM = FACADE_FACE_EDGE_MARGIN_M): boolean {
  return rect.u0 >= face.u0 + marginM
    && rect.u1 <= face.u1 - marginM
    && rect.y0 >= face.y0 + marginM
    && rect.y1 <= face.y1 - marginM;
}

/** Fits a fixed-size rectangle on the nearest face and moves its centre only as far as needed. */
export function fitOnNearestFacadeFace(
  faces: readonly FacadeFace[],
  centreU: number,
  centreY: number,
  halfU: number,
  halfY: number,
  marginM = FACADE_FACE_EDGE_MARGIN_M,
): FacadeFit | undefined {
  let best: FacadeFit | undefined;
  for (const face of faces) {
    const minU = face.u0 + halfU + marginM;
    const maxU = face.u1 - halfU - marginM;
    const minY = face.y0 + halfY + marginM;
    const maxY = face.y1 - halfY - marginM;
    if (minU > maxU || minY > maxY) continue;
    const u = Math.max(minU, Math.min(maxU, centreU));
    const y = Math.max(minY, Math.min(maxY, centreY));
    const offsetM = Math.hypot(u - centreU, y - centreY);
    if (best === undefined || offsetM < best.offsetM
      || (offsetM === best.offsetM && face.id < best.face.id)) {
      best = { face, rect: { u0: u - halfU, u1: u + halfU, y0: y - halfY, y1: y + halfY }, offsetM };
    }
  }
  return best;
}

function axisGap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, a0 - b1, b0 - a1);
}

export function facadeRectEdgeDistance(a: FacadeRect, b: FacadeRect, periodM = 0): number {
  let nearest = Infinity;
  for (const shift of periodM > 0 ? [-periodM, 0, periodM] : [0]) {
    const du = axisGap(a.u0, a.u1, b.u0 + shift, b.u1 + shift);
    const dy = axisGap(a.y0, a.y1, b.y0, b.y1);
    nearest = Math.min(nearest, Math.hypot(du, dy));
  }
  return nearest;
}

export function facadeReservationsConflict(a: FacadeReservation, b: FacadeReservation, periodM: number): boolean {
  if (a.side !== b.side) return false;
  if (a.role === 'hero' && b.role === 'hero'
    && a.compositionId === b.compositionId
    && a.compositionId.startsWith('hero-row-')) return false;
  const distance = facadeRectEdgeDistance(a, b, periodM);
  const required = a.role === 'ordinary' && b.role === 'ordinary'
    ? 2 * Math.max(a.heightM, b.heightM)
    : a.role === 'hero' && b.role === 'hero'
      ? 1.5 * Math.max(a.heightM, b.heightM)
      : 1.5 * (a.role === 'hero' ? a.heightM : b.heightM);
  return distance < required;
}

/** Returns 0 for an entire pane cell that touches a real tier edge, else 1. */
export function facadePaneStepMask(
  faceHalfHeightM: number,
  cellY: number,
  cellHeightM: number,
  stepBottom: boolean,
  stepTop: boolean,
  bandM = FACADE_STEP_MASK_BAND_M,
): number {
  const bottomClearance = faceHalfHeightM + cellY * cellHeightM;
  const topClearance = faceHalfHeightM - (cellY + 1) * cellHeightM;
  if (stepBottom && bottomClearance < bandM) return 0;
  if (stepTop && topClearance < bandM) return 0;
  return 1;
}
