/** The axes of a box in canyon space. */
export interface BoxLocalFrame {
  readonly x: number;
  readonly z: number;
  readonly yawRad?: number;
}

export function boxLocalPoint(frame: BoxLocalFrame, x: number, z: number): { readonly x: number; readonly z: number } {
  const c = Math.cos(frame.yawRad ?? 0), s = Math.sin(frame.yawRad ?? 0);
  const dx = x - frame.x, dz = z - frame.z;
  return { x: frame.x + dx * c + dz * s, z: frame.z - dx * s + dz * c };
}

export function boxLocalCoordinates(frame: BoxLocalFrame, x: number, z: number): { readonly x: number; readonly z: number } {
  const c = Math.cos(frame.yawRad ?? 0), s = Math.sin(frame.yawRad ?? 0);
  const dx = x - frame.x, dz = z - frame.z;
  return { x: frame.x + dx * c - dz * s, z: frame.z + dx * s + dz * c };
}

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

export type FootprintPoint = readonly [number, number];

export interface RectangleLimit {
  readonly width: number;
  readonly depth: number;
  readonly maximum: number;
}

/** Select the largest rectangle area within linear size limits. */
export function fitRectangleDimensions(
  width: number, depth: number, limits: readonly RectangleLimit[],
): { readonly width: number; readonly depth: number } | undefined {
  const constraints = [...limits,
    { width: 1, depth: 0, maximum: width },
    { width: 0, depth: 1, maximum: depth }];
  const candidates: { width: number; depth: number }[] = [];
  for (const limit of constraints) {
    if (limit.width > 0 && limit.depth > 0) {
      candidates.push({ width: limit.maximum / (2 * limit.width), depth: limit.maximum / (2 * limit.depth) });
    }
  }
  for (let first = 0; first < constraints.length; first += 1) {
    for (let second = first + 1; second < constraints.length; second += 1) {
      const a = constraints[first]!, b = constraints[second]!;
      const determinant = a.width * b.depth - a.depth * b.width;
      if (Math.abs(determinant) < 1e-12) continue;
      candidates.push({
        width: (a.maximum * b.depth - a.depth * b.maximum) / determinant,
        depth: (a.width * b.maximum - a.maximum * b.width) / determinant,
      });
    }
  }
  return candidates.filter(candidate => candidate.width > 0 && candidate.depth > 0
    && constraints.every(limit => limit.width * candidate.width + limit.depth * candidate.depth <= limit.maximum + 1e-9))
    .sort((a, b) => b.width * b.depth - a.width * a.depth)[0];
}

/** Clip a convex polygon to one side of a directed edge. */
export function clipFootprintEdge(
  polygon: readonly FootprintPoint[], a: FootprintPoint, b: FootprintPoint, inside: boolean,
): FootprintPoint[] {
  const result: FootprintPoint[] = [];
  const distance = (p: FootprintPoint): number =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  for (let index = 0; index < polygon.length; index += 1) {
    const p = polygon[index]!, q = polygon[(index + 1) % polygon.length]!;
    const dp = distance(p), dq = distance(q);
    const pin = inside ? dp >= 0 : dp <= 0, qin = inside ? dq >= 0 : dq <= 0;
    if (pin) result.push(p);
    if (pin !== qin) {
      const t = dp / (dp - dq);
      result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return result;
}

/** Return disjoint convex pieces outside a counterclockwise convex cut. */
export function subtractFootprint(
  polygon: readonly FootprintPoint[], cut: readonly FootprintPoint[],
): FootprintPoint[][] {
  let remainder = [...polygon];
  const result: FootprintPoint[][] = [];
  for (let index = 0; index < cut.length && remainder.length >= 3; index += 1) {
    const a = cut[index]!, b = cut[(index + 1) % cut.length]!;
    const outside = clipFootprintEdge(remainder, a, b, false);
    if (outside.length >= 3) result.push(outside);
    remainder = clipFootprintEdge(remainder, a, b, true);
  }
  return result;
}

/** Fit a yaw rectangle inside the accepted rectangle and keep half of its long axis. */
export function fitCrownFootprint(width: number, depth: number, yawRad: number): { width: number; depth: number } | undefined {
  const c = Math.cos(yawRad), s = Math.abs(Math.sin(yawRad));
  const longX = width >= depth;
  const limits: readonly (readonly [number,number,number])[] = [
    [c,s,width],[s,c,depth],[1,0,width],[0,1,depth],
    longX ? [1,0,width*.5] : [0,1,depth*.5],
  ];
  const candidates: {width:number;depth:number}[] = [];
  for (const [a,b,k] of limits) {
    if (a > 0 && b > 0) candidates.push({width:k/(2*a),depth:k/(2*b)});
  }
  for (let i=0;i<limits.length;i+=1) for (let j=i+1;j<limits.length;j+=1) {
    const [a,b,k]=limits[i]!, [d,e,m]=limits[j]!;
    const determinant=a*e-b*d;
    if (Math.abs(determinant)<1e-12) continue;
    candidates.push({width:(k*e-b*m)/determinant,depth:(a*m-k*d)/determinant});
  }
  return candidates.filter(candidate => candidate.width>0 && candidate.depth>0
    && candidate.width<=width+1e-9 && candidate.depth<=depth+1e-9
    && c*candidate.width+s*candidate.depth<=width+1e-9
    && s*candidate.width+c*candidate.depth<=depth+1e-9
    && (longX ? candidate.width>=width*.5-1e-9 : candidate.depth>=depth*.5-1e-9))
    .sort((a,b)=>b.width*b.depth-a.width*a.depth)[0];
}
