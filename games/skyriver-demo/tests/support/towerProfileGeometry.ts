import { buildingSeedOf, warpRigid, type SkyriverFacadeFace, type SkyriverMass, type SkyriverTrimOwner } from '../../src/render/city';
import { physicalFootprint, clippedFootprint } from './towerAddedVolume';
import { roofBoxesConflict, roofBoxTolerance, type RoofBox } from './rooftopDetailsGeometry';

export interface TowerSection {
  readonly x0: number; readonly x1: number;
  readonly z0: number; readonly z1: number;
}

export function sourceBoxSection(mass: Pick<SkyriverMass, 'x' | 'z' | 'width' | 'depth'>): TowerSection {
  return { x0: mass.x - mass.width / 2, x1: mass.x + mass.width / 2,
    z0: mass.z - mass.depth / 2, z1: mass.z + mass.depth / 2 };
}

/** Measure the actual +Y footprint in the common canyon X/Z frame. */
export function massSection(mass: Pick<SkyriverMass, 'x' | 'z' | 'width' | 'depth' | 'yawRad' | 'yawAnchor'>): TowerSection {
  if ((mass.yawRad ?? 0) === 0) return sourceBoxSection(mass);
  const polygon = physicalFootprint({ ...mass, y0: 0, height: 1, owner: 0, anchorV: mass.z });
  return { x0: Math.min(...polygon.map(p => p[0])), x1: Math.max(...polygon.map(p => p[0])),
    z0: Math.min(...polygon.map(p => p[1])), z1: Math.max(...polygon.map(p => p[1])) };
}

export function sectionUnionBounds(sections: readonly TowerSection[]): TowerSection {
  if (sections.length === 0) throw new Error('R36_EMPTY_STAGE');
  return { x0: Math.min(...sections.map(s => s.x0)), x1: Math.max(...sections.map(s => s.x1)),
    z0: Math.min(...sections.map(s => s.z0)), z1: Math.max(...sections.map(s => s.z1)) };
}

/** Exact union area for source rectangles and facade surface rectangles. */
export function sectionUnionArea(sections: readonly TowerSection[]): number {
  const xs = [...new Set(sections.flatMap(s => [s.x0, s.x1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1]!, b = xs[i]!, mid = (a + b) / 2;
    const spans = sections.filter(s => s.x0 < mid && s.x1 > mid).map(s => [s.z0, s.z1] as const).sort((u, v) => u[0] - v[0]);
    let top = -Infinity;
    for (const [low, high] of spans) { area += (b - a) * Math.max(0, high - Math.max(low, top)); top = Math.max(top, high); }
  }
  return area;
}

/** Positive volume excludes face contact. All dimensions come from actual mass records. */
export function massIntersectsPrism(mass: SkyriverMass, prism: TowerSection & { readonly y0: number; readonly y1: number }): boolean {
  const centre = independentBoxPoint(mass, mass.x, mass.z), yaw = mass.yawRad ?? 0;
  return roofBoxesConflict({ x: centre.x, z: centre.z, y: mass.y0 + mass.height / 2, hx: mass.width / 2, hy: mass.height / 2, hz: mass.depth / 2, c: Math.cos(yaw), s: Math.sin(yaw) },
    { x: (prism.x0 + prism.x1) / 2, z: (prism.z0 + prism.z1) / 2, y: (prism.y0 + prism.y1) / 2, hx: (prism.x1 - prism.x0) / 2, hy: (prism.y1 - prism.y0) / 2, hz: (prism.z1 - prism.z0) / 2, c: 1, s: 0 });
}

/** Geometry only. Do not add identity, tint, material seed, or draw index to this value. */
export function normalizedTowerGeometry(masses: readonly SkyriverMass[], tower: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number }): readonly (readonly number[])[] {
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  return masses.map(m => [q((m.x - tower.x) / tower.width), q((m.z - tower.z) / tower.depth),
    q(m.y0 / tower.height), q(m.width / tower.width), q(m.height / tower.height), q(m.depth / tower.depth)])
    .sort((a, b) => { for (let i = 0; i < a.length; i++) { const d = a[i]! - b[i]!; if (d !== 0) return d; } return 0; });
}

export function intersectSection(a: TowerSection, b: TowerSection): TowerSection | null {
  const result = { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) };
  return result.x1 > result.x0 && result.z1 > result.z0 ? result : null;
}

/** Canonical union removes hidden rectangle edges. */
export function canonicalSectionUnion(sections: readonly TowerSection[]): readonly (readonly number[])[] {
  const xs = [...new Set(sections.flatMap(s => [s.x0, s.x1]))].sort((a, b) => a - b);
  const strips: number[][] = [];
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1]!, x1 = xs[i]!, mid = (x0 + x1) / 2;
    const spans = sections.filter(s => s.x0 < mid && s.x1 > mid).map(s => [s.z0, s.z1]).sort((a, b) => a[0]! - b[0]!);
    const union: number[][] = [];
    for (const span of spans) {
      const last = union.at(-1);
      if (last && span[0]! <= last[1]!) last[1] = Math.max(last[1]!, span[1]!);
      else union.push([...span]);
    }
    const tail = union.flat();
    const last = strips.at(-1);
    if (last && last[1] === x0 && JSON.stringify(last.slice(2)) === JSON.stringify(tail)) last[1] = x1;
    else if (tail.length > 0) strips.push([x0, x1, ...tail]);
  }
  return strips;
}

/** Fingerprint the exposed body union below the original roof. */
export function normalizedExposedTowerGeometry(masses: readonly SkyriverMass[], tower: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly height: number }): readonly (readonly number[])[] {
  const ys = [...new Set([0, tower.height, ...masses.flatMap(m => [Math.max(0, Math.min(tower.height, m.y0)), Math.max(0, Math.min(tower.height, m.y0 + m.height))])])].sort((a, b) => a - b);
  const bands: number[][] = [];
  const q = (v: number) => Math.round(v * 1e6) / 1e6;
  for (let i = 1; i < ys.length; i++) {
    const y0 = ys[i - 1]!, y1 = ys[i]!, mid = (y0 + y1) / 2;
    const members = masses.filter(m => m.y0 < mid && m.y0 + m.height > mid);
    const shape = canonicalPhysicalSectionUnion(members).flatMap(row => [row.length, ...row.map((value, j) => q(j < 2 ? (value - tower.x) / tower.width : (value - tower.z) / tower.depth))]);
    const last = bands.at(-1);
    if (last && last[1] === q(y0 / tower.height) && JSON.stringify(last.slice(2)) === JSON.stringify(shape)) last[1] = q(y1 / tower.height);
    else bands.push([q(y0 / tower.height), q(y1 / tower.height), ...shape]);
  }
  return bands;
}

/** Apply +Y yaw independently of the production box helpers. */
export function independentBoxPoint(frame: Pick<SkyriverTrimOwner, 'x' | 'z' | 'yawRad' | 'yawAnchor'>, x: number, z: number): { readonly x: number; readonly z: number } {
  const pivot = frame.yawAnchor ?? frame, c = Math.cos(frame.yawRad ?? 0), s = Math.sin(frame.yawRad ?? 0);
  const dx = x - pivot.x, dz = z - pivot.z;
  return { x: pivot.x + c * dx + s * dz, z: pivot.z - s * dx + c * dz };
}

/** Use the original canyon transform after the independent box rotation. */
export function independentMassRoofBox(mass: SkyriverMass): RoofBox {
  const local = independentBoxPoint(mass, mass.x, mass.z);
  const point = warpRigid(local.x, local.z, mass.anchorV ?? mass.z, { x: 0, z: 0, heading: 0 });
  const heading = point.heading + (mass.yawRad ?? 0);
  return { x: point.x, z: point.z, y: mass.y0 + mass.height / 2, hx: mass.width / 2, hy: mass.height / 2, hz: mass.depth / 2, c: Math.cos(heading), s: Math.sin(heading) };
}

/** Invert canyon placement and then yaw about the actual owner pivot. */
export function facadeCoordinates(face: Pick<SkyriverFacadeFace, 'owner'>, x: number, z: number): { readonly x: number; readonly z: number } {
  const frame = face.owner, anchor = frame.anchorV;
  const origin = warpRigid(0, anchor, anchor, { x: 0, z: 0, heading: 0 });
  const dx = x - origin.x, dz = z - origin.z, c = Math.cos(origin.heading), s = Math.sin(origin.heading);
  const localX = dx * c - dz * s, localZ = anchor + dx * s + dz * c;
  const pivot = frame.yawAnchor ?? frame, cy = Math.cos(frame.yawRad ?? 0), sy = Math.sin(frame.yawRad ?? 0);
  return { x: pivot.x + cy * (localX - pivot.x) - sy * (localZ - pivot.z), z: pivot.z + sy * (localX - pivot.x) + cy * (localZ - pivot.z) };
}

export interface PhysicalFacadeHost { readonly mass: SkyriverMass; readonly box: RoofBox }

/** An actual flat edge must lie on the face plane. A corner at the plane is insufficient. */
export function physicalFacadeRectangles(face: SkyriverFacadeFace, hosts: readonly PhysicalFacadeHost[], requested: TowerSection): { readonly rectangles: readonly TowerSection[]; readonly tolerance: number } {
  const canonical = face.owner.materialOwner ?? buildingSeedOf(face.owner.x, face.owner.z), axisX = face.planeAxis === 'x';
  const rectangles: TowerSection[] = [];
  let tolerance = 0;
  for (const { mass, box } of hosts) {
    if ((mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z)) !== canonical || (mass.anchorV ?? mass.z) !== face.owner.anchorV) continue;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => facadeCoordinates(face,
      box.x + u! * box.hx * box.c + v! * box.hz * box.s, box.z - u! * box.hx * box.s + v! * box.hz * box.c));
    const epsilon = roofBoxTolerance(box);
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i]!, b = corners[(i + 1) % corners.length]!;
      if (Math.abs((axisX ? a.x : a.z) - face.plane) > epsilon || Math.abs((axisX ? b.x : b.z) - face.plane) > epsilon) continue;
      const ua = axisX ? a.z : a.x, ub = axisX ? b.z : b.x;
      if (Math.abs(ub - ua) <= epsilon) continue;
      tolerance = Math.max(tolerance, epsilon);
      const clipped = intersectSection(requested, { x0: Math.min(ua, ub) - epsilon, x1: Math.max(ua, ub) + epsilon, z0: box.y - box.hy - epsilon, z1: box.y + box.hy + epsilon });
      if (clipped) rectangles.push(clipped);
    }
  }
  return { rectangles, tolerance };
}

/** Recover the documented deterministic yaw from the saved stage role. */
export function expectedTowerYaw(seed: number, tower: { readonly x: number; readonly z: number }, salt: number, grime: boolean): number {
  const sample = (offset: number) => {
    const n = seed * .0001 + tower.x * .0173 + tower.z * .00911 + offset * 37.19;
    const value = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  };
  return (sample(salt + 1000) < .5 ? -1 : 1) * ((grime ? 8 : 2) + (grime ? 4 : 10) * sample(salt)) * Math.PI / 180;
}

/** The largest uniform scale keeps the rotated box inside its original rectangle. */
export function expectedInscribedDimensions(width: number, depth: number, yawRad: number): { readonly width: number; readonly depth: number } {
  const c = Math.cos(yawRad), s = Math.abs(Math.sin(yawRad));
  const scale = 1 / Math.max((c * width + s * depth) / width, (s * width + c * depth) / depth);
  return { width: width * scale, depth: depth * scale };
}

/** Sweep actual polygon edges. Hidden source edges do not enter the fingerprint. */
export function canonicalPhysicalSectionUnion(masses: readonly SkyriverMass[], clip?: TowerSection): readonly (readonly number[])[] {
  const polygons = masses.map(mass => {
    const polygon = physicalFootprint({ ...mass, owner: 0, anchorV: mass.anchorV ?? mass.z });
    return clip ? clippedFootprint(polygon, clip.x0, clip.x1, clip.z0, clip.z1) : polygon;
  }).filter(polygon => polygon.length >= 3);
  const edges = polygons.flatMap(polygon => polygon.map((point, index) => ({ a: point, b: polygon[(index + 1) % polygon.length]! })));
  const cuts = polygons.flatMap(polygon => polygon.map(point => point[0]));
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const a = edges[i]!, b = edges[j]!, ax = a.b[0] - a.a[0], az = a.b[1] - a.a[1], bx = b.b[0] - b.a[0], bz = b.b[1] - b.a[1];
    const determinant = ax * bz - az * bx;
    if (Math.abs(determinant) < 1e-12) continue;
    const dx = b.a[0] - a.a[0], dz = b.a[1] - a.a[1], u = (dx * bz - dz * bx) / determinant, v = (dx * az - dz * ax) / determinant;
    if (u > 0 && u < 1 && v > 0 && v < 1) cuts.push(a.a[0] + u * ax);
  }
  const xs = [...new Set(cuts)].sort((a, b) => a - b), rows: number[][] = [];
  const zAt = (edge: typeof edges[number], x: number) => edge.a[1] + (edge.b[1] - edge.a[1]) * (x - edge.a[0]) / (edge.b[0] - edge.a[0]);
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1]!, x1 = xs[i]!, mid = (x0 + x1) / 2;
    if (x1 - x0 <= 1e-10) continue;
    const spans = polygons.flatMap(polygon => {
      const crossing = polygon.flatMap((point, index) => {
        const edge = { a: point, b: polygon[(index + 1) % polygon.length]! };
        return Math.min(edge.a[0], edge.b[0]) < mid && Math.max(edge.a[0], edge.b[0]) > mid ? [edge] : [];
      }).sort((a, b) => zAt(a, mid) - zAt(b, mid));
      return crossing.length < 2 ? [] : [{ low: crossing[0]!, high: crossing.at(-1)! }];
    }).sort((a, b) => zAt(a.low, mid) - zAt(b.low, mid));
    const union: typeof spans = [];
    for (const span of spans) {
      const last = union.at(-1);
      if (last && zAt(span.low, mid) <= zAt(last.high, mid) + 1e-10) { if (zAt(span.high, mid) > zAt(last.high, mid)) last.high = span.high; }
      else union.push({ ...span });
    }
    if (union.length === 0) continue;
    const row = [x0, x1, ...union.flatMap(span => [zAt(span.low, x0), zAt(span.high, x0), zAt(span.low, x1), zAt(span.high, x1)])], last = rows.at(-1);
    const sameBoundary = last && last.length === row.length && Math.abs(last[1]! - x0) <= 1e-8 && union.every((_, j) => {
      const offset = 2 + j * 4;
      return [0, 1].every(k => Math.abs(last[offset + 2 + k]! - row[offset + k]!) <= 1e-8 && Math.abs((last[offset + 2 + k]! - last[offset + k]!) / (last[1]! - last[0]!) - (row[offset + 2 + k]! - row[offset + k]!) / (x1 - x0)) <= 1e-8);
    });
    if (sameBoundary) { last[1] = x1; union.forEach((_, j) => { last[4 + j * 4] = row[4 + j * 4]!; last[5 + j * 4] = row[5 + j * 4]!; }); }
    else rows.push(row);
  }
  return rows;
}

export function physicalSectionUnionArea(masses: readonly SkyriverMass[], clip?: TowerSection): number {
  return canonicalPhysicalSectionUnion(masses, clip).reduce((area, row) => {
    let strip = 0;
    for (let i = 2; i < row.length; i += 4) strip += (row[i + 1]! - row[i]! + row[i + 3]! - row[i + 2]!) * (row[1]! - row[0]!) / 2;
    return area + strip;
  }, 0);
}

export interface IndependentSizeLimit { readonly width: number; readonly depth: number; readonly maximum: number }
/** Clip the feasible size polygon, then maximize area on each of its edges. */
export function independentMaximumAreaSize(width: number, depth: number, limits: readonly IndependentSizeLimit[]) {
  let polygon: readonly (readonly [number, number])[] = [[0, 0], [width, 0], [width, depth], [0, depth]];
  for (const limit of limits) {
    const output: (readonly [number, number])[] = [], distance = (point: readonly [number, number]) => limit.maximum - limit.width * point[0] - limit.depth * point[1];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!, da = distance(a), db = distance(b);
      if (da >= 0) output.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
    }
    polygon = output;
  }
  const candidates = [...polygon];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
    if (dx * dz >= 0) continue;
    const t = -(dx * a[1] + dz * a[0]) / (2 * dx * dz);
    if (t > 0 && t < 1) candidates.push([a[0] + dx * t, a[1] + dz * t]);
  }
  const best = candidates.filter(point => point[0] > 0 && point[1] > 0).sort((a, b) => b[0] * b[1] - a[0] * a[1])[0];
  if (!best) throw new Error('INDEPENDENT_SIZE_NO_FEASIBLE_AREA');
  return { width: best[0], depth: best[1] };
}

export interface IndependentStageFitContext {
  readonly parent: TowerSection;
  readonly axis: 'x' | 'z';
  readonly direction?: number;
  readonly skipParent?: boolean;
  readonly broadAxis?: 'x' | 'z';
  readonly next?: { readonly axis: 'x' | 'z'; readonly centre: number; readonly direction: number };
}
export function expectedBoundedStageFit(original: Pick<SkyriverMass, 'x' | 'z' | 'width' | 'depth'>, yawRad: number, context?: IndependentStageFitContext) {
  const uniform = expectedInscribedDimensions(original.width, original.depth, yawRad);
  if (!context) return { x: original.x, z: original.z, ...uniform };
  const c = Math.cos(yawRad), s = Math.abs(Math.sin(yawRad));
  type Boundary = { readonly base: number; readonly width: number; readonly depth: number };
  const intervals: Record<'x' | 'z', { low: Boundary[]; high: Boundary[] }> = {
    x: { low: [{ base: original.x - original.width / 2, width: c / 2, depth: s / 2 }], high: [{ base: original.x + original.width / 2, width: -c / 2, depth: -s / 2 }] },
    z: { low: [{ base: original.z - original.depth / 2, width: s / 2, depth: c / 2 }], high: [{ base: original.z + original.depth / 2, width: -s / 2, depth: -c / 2 }] },
  };
  const parent = context.parent, axis = context.axis;
  const centre = axis === 'x' ? (parent.x0 + parent.x1) / 2 : (parent.z0 + parent.z1) / 2;
  const span = axis === 'x' ? parent.x1 - parent.x0 : parent.z1 - parent.z0;
  const direction = context.direction ?? Math.sign(original[axis] - centre);
  const endpoints = [.08, .33].map(ratio => centre + direction * span * ratio);
  if (!context.skipParent) {
    intervals[axis].low.push({ base: Math.min(...endpoints), width: 0, depth: 0 });
    intervals[axis].high.push({ base: Math.max(...endpoints), width: 0, depth: 0 });
  }
  if (context.next) {
    const child = context.next, widths = child.axis === 'x' ? [c, s] : [s, c];
    const ratios = child.direction > 0 ? [-.33, -.08] : [.08, .33];
    intervals[child.axis].low.push({ base: child.centre, width: ratios[0]! * widths[0]!, depth: ratios[0]! * widths[1]! });
    intervals[child.axis].high.push({ base: child.centre, width: ratios[1]! * widths[0]!, depth: ratios[1]! * widths[1]! });
  }
  const limits: IndependentSizeLimit[] = Object.values(intervals).flatMap(interval => interval.low.flatMap(low => interval.high.map(high => ({ width: low.width - high.width, depth: low.depth - high.depth, maximum: high.base - low.base }))));
  const broadLost = context.broadAxis !== undefined && c * uniform.width + s * uniform.depth <= parent.x1 - parent.x0 + 1e-8 && s * uniform.width + c * uniform.depth <= parent.z1 - parent.z0 + 1e-8;
  if (broadLost) limits.push(context.broadAxis === 'x' ? { width: -c, depth: -s, maximum: -(parent.x1 - parent.x0 + .001) } : { width: -s, depth: -c, maximum: -(parent.z1 - parent.z0 + .001) });
  const size = limits.every(limit => limit.width * uniform.width + limit.depth * uniform.depth <= limit.maximum + 1e-9) ? uniform : independentMaximumAreaSize(original.width, original.depth, limits);
  const evaluate = (boundary: Boundary) => boundary.base + boundary.width * size.width + boundary.depth * size.depth;
  const fittedCentre = (axis: 'x' | 'z') => Math.max(...intervals[axis].low.map(evaluate), Math.min(original[axis], ...intervals[axis].high.map(evaluate)));
  return { x: fittedCentre('x'), z: fittedCentre('z'), ...size };
}
