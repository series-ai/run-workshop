import { Matrix4, Vector3, type InstancedMesh, type Mesh } from 'three';

export type Point2 = readonly [number, number];
export type Point3 = readonly [number, number, number];
export type Segment = readonly [Point3, Point3];

export interface Board {
  readonly centre: Point3;
  readonly normal: Point2;
  readonly size: Point2;
}

export interface Solid {
  readonly footprint: readonly Point2[];
  readonly low: number;
  readonly high: number;
}

/** Compare transform witnesses without replacing the actual uploaded normal. */
export function normalTransformResidual(actual: Point2, expected: Point2, source: Point2) {
  if (![...actual, ...expected, ...source].every(Number.isFinite)) throw new Error('R37_FINITE_NORMAL_WITNESS');
  const operationAllowance = 16 * Number.EPSILON * Math.max(1, Math.abs(source[0]) + Math.abs(source[1]));
  const components = actual.map((value, axis) => {
    const magnitude = Math.max(Math.abs(value), Math.abs(expected[axis]!));
    const ulp = magnitude < 2 ** -126 ? 2 ** -149 : 2 ** (Math.floor(Math.log2(magnitude)) - 23);
    const limit = 2 * ulp + operationAllowance;
    const error = Math.abs(value - expected[axis]!);
    return { axis, actual: value, expected: expected[axis]!, error, limit, pass: error <= limit };
  });
  return { pass: components.every(component => component.pass), components };
}

export const BOARD_THICKNESS_M = 0.4;
export const ROOT_DISTANCE_M = 3;

function cross(a: Point2, b: Point2, p: Point2): number {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
}

const bits = new DataView(new ArrayBuffer(8));
function dyadic(value: number): { integer: bigint; exponent: number } {
  bits.setFloat64(0, value);
  const raw = bits.getBigUint64(0);
  const exponent = Number((raw >> 52n) & 2047n);
  const mantissa = raw & ((1n << 52n) - 1n);
  const integer = exponent === 0 ? mantissa : mantissa + (1n << 52n);
  return { integer: raw >> 63n ? -integer : integer, exponent: exponent === 0 ? -1074 : exponent - 1075 };
}

/** Use exact dyadic signs only when ordinary arithmetic cannot resolve the side. */
function orientationSign(a: Point2, b: Point2, p: Point2): number {
  const value = cross(a, b, p);
  const error = 8 * Number.EPSILON * (Math.abs((b[0] - a[0]) * (p[1] - a[1]))
    + Math.abs((b[1] - a[1]) * (p[0] - a[0])));
  if (Math.abs(value) > error) return Math.sign(value);
  const values = [...a, ...b, ...p].map(dyadic);
  const exponent = Math.min(...values.map(value => value.exponent));
  const integers = values.map(value => value.integer << BigInt(value.exponent - exponent));
  const [ax, az, bx, bz, px, pz] = integers;
  const exact = (bx! - ax!) * (pz! - az!) - (bz! - az!) * (px! - ax!);
  return exact > 0n ? 1 : exact < 0n ? -1 : 0;
}

export function solidFromMatrix(matrix: readonly number[]): Solid {
  if (matrix.length !== 16 || !matrix.every(Number.isFinite)
    || matrix[1] !== 0 || matrix[4] !== 0 || matrix[6] !== 0 || matrix[9] !== 0
    || matrix[3] !== 0 || matrix[7] !== 0 || matrix[11] !== 0 || matrix[15] !== 1) {
    throw new Error('R37_REAL_YAW_MATRIX_REQUIRED');
  }
  const m = new Matrix4().fromArray(matrix);
  const footprint = ([-0.5, 0.5] as const).flatMap((z, row) =>
    (row === 0 ? [-0.5, 0.5] : [0.5, -0.5]).map(x => {
      const p = new Vector3(x, 0, z).applyMatrix4(m);
      return [p.x, p.z] as const;
    }));
  return {
    footprint,
    low: matrix[13]! - Math.abs(matrix[5]!) / 2,
    high: matrix[13]! + Math.abs(matrix[5]!) / 2,
  };
}

export function boardBasis(board: Board): { readonly normal: Point2; readonly tangent: Point2 } {
  const length = Math.hypot(...board.normal);
  if (!(length > 0) || !Number.isFinite(length)
    || !board.centre.every(Number.isFinite)
    || !board.size.every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('R37_REAL_BOARD_REQUIRED');
  }
  const normal: Point2 = [board.normal[0] / length, board.normal[1] / length];
  return { normal, tangent: [-normal[1], normal[0]] };
}

function clipPolygon(subject: readonly Point2[], clip: readonly Point2[]): readonly Point2[] {
  let result = subject;
  for (let edge = 0; edge < clip.length; edge += 1) {
    const a = clip[edge]!;
    const b = clip[(edge + 1) % clip.length]!;
    const input = result;
    const output: Point2[] = [];
    if (input.length === 0) break;
    let previous = input.at(-1)!;
    let previousDistance = cross(a, b, previous);
    for (const current of input) {
      const currentDistance = cross(a, b, current);
      if ((previousDistance >= 0) !== (currentDistance >= 0)) {
        const t = previousDistance / (previousDistance - currentDistance);
        output.push([
          previous[0] + t * (current[0] - previous[0]),
          previous[1] + t * (current[1] - previous[1]),
        ]);
      }
      if (currentDistance >= 0) output.push(current);
      previous = current;
      previousDistance = currentDistance;
    }
    result = output;
  }
  return result;
}

export function overlapVolume(board: Board, solid: Solid): number {
  const height = Math.min(board.centre[1] + board.size[1] / 2, solid.high)
    - Math.max(board.centre[1] - board.size[1] / 2, solid.low);
  if (!(height > 0)) return 0;
  const { normal, tangent } = boardBasis(board);
  const corners: readonly Point2[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
    u! * board.size[0] / 2 * tangent[0] + v! * BOARD_THICKNESS_M / 2 * normal[0],
    u! * board.size[0] / 2 * tangent[1] + v! * BOARD_THICKNESS_M / 2 * normal[1],
  ]);
  const localSolid = solid.footprint.map(p => [p[0] - board.centre[0], p[1] - board.centre[2]] as const);
  const polygon = clipPolygon(corners, localSolid);
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    twiceArea += a[0] * b[1] - a[1] * b[0];
  }
  return Math.abs(twiceArea) / 2 * height;
}

export function solidFromBoard(board: Board): Solid {
  const { normal, tangent } = boardBasis(board);
  return { low: board.centre[1] - board.size[1] / 2, high: board.centre[1] + board.size[1] / 2,
    footprint: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) => [
      board.centre[0] + along! * board.size[0] / 2 * tangent[0] + across! * BOARD_THICKNESS_M / 2 * normal[0],
      board.centre[2] + along! * board.size[0] / 2 * tangent[1] + across! * BOARD_THICKNESS_M / 2 * normal[1],
    ] as const).reverse() };
}

/** Same-row spacing exemptions do not permit positive board volume overlap. */
export function heroBoardOverlaps(boards: readonly Board[], compositionIds: readonly (string | null)[], heroCount: number) {
  const overlaps: { first: number; second: number; compositionId: string | null; volumeM3: number }[] = [];
  for (let first = 0; first < heroCount; first += 1) for (let second = first + 1; second < heroCount; second += 1) {
    if (compositionIds[first] !== compositionIds[second]) continue;
    const volumeM3 = overlapVolume(boards[first]!, solidFromBoard(boards[second]!));
    if (volumeM3 > 0) overlaps.push({ first, second, compositionId: compositionIds[first]!, volumeM3 });
  }
  return overlaps;
}

export function pointSegmentDistance(p: Point3, segment: Segment): number {
  const a = new Vector3(...segment[0]);
  const b = new Vector3(...segment[1]);
  const point = new Vector3(...p);
  const axis = b.sub(a);
  const lengthSq = axis.lengthSq();
  if (lengthSq === 0) return point.distanceTo(a);
  if (!Number.isFinite(lengthSq)) throw new Error('R37_FINITE_EDGE_REQUIRED');
  const t = Math.max(0, Math.min(1, point.clone().sub(a).dot(axis) / lengthSq));
  return point.distanceTo(a.addScaledVector(axis, t));
}

export function segmentDistance(a: Segment, b: Segment): number {
  if (a[0][1] !== a[1][1] || b[0][1] !== b[1][1]) {
    throw new Error('R37_HORIZONTAL_ROOT_AND_EDGE_REQUIRED');
  }
  const flatten = (p: Point3): Point3 => [p[0], 0, p[2]];
  const aa: Segment = [flatten(a[0]), flatten(a[1])];
  const bb: Segment = [flatten(b[0]), flatten(b[1])];
  const p: Point2 = [a[0][0], a[0][2]];
  const q: Point2 = [a[1][0], a[1][2]];
  const r: Point2 = [b[0][0], b[0][2]];
  const s: Point2 = [b[1][0], b[1][2]];
  const denominator = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]);
  let horizontal = Math.min(
    pointSegmentDistance(aa[0], bb), pointSegmentDistance(aa[1], bb),
    pointSegmentDistance(bb[0], aa), pointSegmentDistance(bb[1], aa),
  );
  if (denominator !== 0) {
    const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / denominator;
    const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) horizontal = 0;
  }
  return Math.hypot(horizontal, a[0][1] - b[0][1]);
}

export function boardRoot(board: Board, mode: 'panel' | 'blade', edge: Segment): Segment {
  const { normal, tangent } = boardBasis(board);
  const y = board.centre[1] - board.size[1] / 2;
  const lower = (along: number, across: number): Point3 => [
    board.centre[0] + tangent[0] * along + normal[0] * across,
    y,
    board.centre[2] + tangent[1] * along + normal[1] * across,
  ];
  if (mode === 'panel') {
    return [lower(-board.size[0] / 2, -BOARD_THICKNESS_M / 2), lower(board.size[0] / 2, -BOARD_THICKNESS_M / 2)];
  }
  const ends = [-board.size[0] / 2, board.size[0] / 2].map(along => [
    lower(along, -BOARD_THICKNESS_M / 2), lower(along, BOARD_THICKNESS_M / 2),
  ] as const);
  return segmentDistance(ends[0]!, edge) <= segmentDistance(ends[1]!, edge) ? ends[0]! : ends[1]!;
}

export interface PhysicalHost { readonly kind: 'mass' | 'trim'; readonly index: number; }
export interface PhysicalSolid extends Solid { readonly host: PhysicalHost; }
export interface PhysicalMount {
  readonly mode: 'panel' | 'blade';
  readonly host: PhysicalHost;
  readonly edgeIndex: number;
  readonly edge: Segment;
  readonly root?: Segment;
}

function hostKey(host: PhysicalHost): string { return host.kind + ':' + host.index; }

/** Detect positive-length edge intervals inside the footprint. */
export function edgeInteriorLength(edge: Segment, polygon: readonly Point2[], range: Point2 = [0, 1]): number {
  const a: Point2 = [edge[0][0], edge[0][2]], b: Point2 = [edge[1][0], edge[1][2]];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const cuts = [range[0], range[1]];
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!;
    const ex = q[0] - p[0], ez = q[1] - p[1];
    const denominator = dx * ez - dz * ex;
    if (denominator === 0) continue;
    const t = ((p[0] - a[0]) * ez - (p[1] - a[1]) * ex) / denominator;
    const u = ((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / denominator;
    if (t > range[0] && t < range[1] && u >= 0 && u <= 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  let fraction = 0;
  for (let i = 1; i < cuts.length; i += 1) {
    const lo = cuts[i - 1]!, hi = cuts[i]!;
    if (!(hi > lo)) continue;
    const parameter = (lo + hi) / 2;
    const inside = polygon.every((p, j) => {
      const q = polygon[(j + 1) % polygon.length]!;
      const first = orientationSign(p, q, a), last = orientationSign(p, q, b);
      if (first === 0 && last === 0) return false;
      if (first >= 0 && last >= 0) return true;
      if (first <= 0 && last <= 0) return false;
      return (1 - parameter) * cross(p, q, a) + parameter * cross(p, q, b) > 0;
    });
    if (inside) fraction += hi - lo;
  }
  return fraction * Math.hypot(dx, dz);
}

/** Infer the supported portion from the board itself and the finite ledge. */
export function supportedBoardRoot(board: Board, mode: 'panel' | 'blade', edge: Segment): Segment {
  const full = boardRoot(board, mode, edge);
  const a = new Vector3(...full[0]), axis = new Vector3(...full[1]).sub(a);
  const length = axis.length();
  axis.divideScalar(length);
  const projected = edge.map(point => new Vector3(...point).sub(a).dot(axis));
  const lo = Math.max(0, Math.min(...projected));
  const hi = Math.min(length, Math.max(...projected));
  const point = (distance: number): Point3 => a.clone().addScaledVector(axis, distance).toArray() as [number, number, number];
  if (hi >= lo) return [point(lo), point(hi)];
  const nearest = projected.every(value => value < 0) ? full[0] : full[1];
  return [nearest, nearest];
}

export function physicalMountFailures(board: Board, mount: PhysicalMount, solids: readonly PhysicalSolid[]) {
  const failures: string[] = [];
  const host = solids.find(solid => hostKey(solid.host) === hostKey(mount.host));
  if (!host) return { failures: ['drawn-host-missing'], distanceM: Infinity, endpointDistanceM: Infinity };
  if (!Number.isInteger(mount.edgeIndex) || mount.edgeIndex < 0 || mount.edgeIndex >= host.footprint.length) {
    return { failures: ['physical-edge-index'], distanceM: Infinity, endpointDistanceM: Infinity };
  }
  const p = host.footprint[mount.edgeIndex]!, q = host.footprint[(mount.edgeIndex + 1) % host.footprint.length]!;
  const fullEdge: Segment = [[p[0], host.high, p[1]], [q[0], host.high, q[1]]];
  // Keep the existing 0.05 m owner placement limit for coordinate conversion.
  if (mount.edge.some(point => pointSegmentDistance(point, fullEdge) >= 0.05)) failures.push('edge-not-on-drawn-host');
  if (!mount.edge.every(point => point.every(Number.isFinite))
    || Math.hypot(...mount.edge[0].map((value, axis) => value - mount.edge[1][axis]!)) === 0) {
    return { failures: ['finite-edge-required'], distanceM: Infinity, endpointDistanceM: Infinity };
  }
  // Recover the exact host segment after the canonical owner conversion.
  const edgeAxis = new Vector3(...fullEdge[1]).sub(new Vector3(...fullEdge[0]));
  const edgeLengthSq = edgeAxis.lengthSq();
  const edgeFractions = mount.edge.map(point => Math.max(0, Math.min(1,
    new Vector3(...point).sub(new Vector3(...fullEdge[0])).dot(edgeAxis) / edgeLengthSq)));
  const physicalEdge = mount.edge.map((point, index) => {
    const fraction = edgeFractions[index]!;
    const endpointError = 16 * Number.EPSILON * Math.max(1, ...point.map(Math.abs));
    if (pointSegmentDistance(point, [fullEdge[0], fullEdge[0]]) <= endpointError) return fullEdge[0];
    if (pointSegmentDistance(point, [fullEdge[1], fullEdge[1]]) <= endpointError) return fullEdge[1];
    return new Vector3(...fullEdge[0]).addScaledVector(edgeAxis, fraction).toArray() as [number, number, number];
  }) as [Point3, Point3];
  const fullRoot = boardRoot(board, mount.mode, physicalEdge);
  const root = supportedBoardRoot(board, mount.mode, physicalEdge);
  const distanceM = segmentDistance(root, physicalEdge);
  const endpointDistanceM = Math.max(...root.map(point => pointSegmentDistance(point, physicalEdge)));
  if (!(distanceM <= ROOT_DISTANCE_M)) failures.push('root-off-finite-edge');
  if (!(Math.hypot(...root[0].map((value, axis) => value - root[1][axis]!)) > 0)) failures.push('supported-root-missing');
  if (endpointDistanceM > ROOT_DISTANCE_M) failures.push('supported-root-endpoint-off-edge');
  if (mount.root?.some(point => pointSegmentDistance(point, fullRoot) >= 0.05)) failures.push('metadata-root-off-board');
  if (mount.root?.some(point => pointSegmentDistance(point, root) >= 0.05)) failures.push('metadata-root-outside-support');
  const { normal } = boardBasis(board);
  const edgeLength = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const alongNormal = Math.abs((normal[0] * (q[0] - p[0]) + normal[1] * (q[1] - p[1])) / edgeLength);
  const orientationError = mount.mode === 'panel' ? alongNormal : Math.abs(1 - alongNormal);
  if (orientationError > 1e-5) failures.push('root-orientation');
  const exposureWitnesses = [];
  for (const other of solids) {
    if (other === host || other.high <= host.high || other.low > host.high) continue;
    const intervalLengthM = edgeInteriorLength(fullEdge, other.footprint,
      [Math.min(...edgeFractions), Math.max(...edgeFractions)]);
    const rawIntervalLengthM = edgeInteriorLength(mount.edge, other.footprint);
    if (intervalLengthM > 0 || rawIntervalLengthM > 0) exposureWitnesses.push({ host: other.host,
      intervalLengthM, rawIntervalLengthM,
      transformErrorM: Math.max(...mount.edge.map((point, index) => pointSegmentDistance(point, [physicalEdge[index]!, physicalEdge[index]!]))),
      signedEndpointDistancesM: other.footprint.map((a, index) => {
        const b = other.footprint[(index + 1) % other.footprint.length]!;
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return mount.edge.map(point => cross(a, b, [point[0], point[2]]) / length);
      }) });
    if (intervalLengthM > 0 && !failures.includes('buried-ledge-edge')) failures.push('buried-ledge-edge');
  }
  return { failures, distanceM, endpointDistanceM, root, fullRoot, fullEdge, physicalEdge, exposureWitnesses };
}

/** Check every board against every drawn solid. No host is excluded. */
export function physicalSignAudit(boards: readonly Board[], mounts: readonly PhysicalMount[], solids: readonly PhysicalSolid[]) {
  const overlaps: { sign: number; host: PhysicalHost; volumeM3: number }[] = [];
  const roots: { sign: number; failures: string[]; distanceM: number; endpointDistanceM: number }[] = [];
  const bounds = solids.map(solid => ({ solid,
    minX: Math.min(...solid.footprint.map(p => p[0])), maxX: Math.max(...solid.footprint.map(p => p[0])),
    minZ: Math.min(...solid.footprint.map(p => p[1])), maxZ: Math.max(...solid.footprint.map(p => p[1])),
  }));
  for (const [sign, board] of boards.entries()) {
    const { normal, tangent } = boardBasis(board);
    const halfX = Math.abs(tangent[0]) * board.size[0] / 2 + Math.abs(normal[0]) * BOARD_THICKNESS_M / 2;
    const halfZ = Math.abs(tangent[1]) * board.size[0] / 2 + Math.abs(normal[1]) * BOARD_THICKNESS_M / 2;
    for (const entry of bounds) {
      const solid = entry.solid;
      if (board.centre[1] + board.size[1] / 2 <= solid.low || board.centre[1] - board.size[1] / 2 >= solid.high
        || board.centre[0] + halfX <= entry.minX || board.centre[0] - halfX >= entry.maxX
        || board.centre[2] + halfZ <= entry.minZ || board.centre[2] - halfZ >= entry.maxZ) continue;
      const volumeM3 = overlapVolume(board, solid);
      if (volumeM3 > 0) overlaps.push({ sign, host: solid.host, volumeM3 });
    }
    const mount = mounts[sign];
    if (!mount) roots.push({ sign, failures: ['mount-missing'], distanceM: Infinity, endpointDistanceM: Infinity });
    else roots.push({ sign, ...physicalMountFailures(board, mount, solids) });
  }
  return { boards: boards.length, solids: solids.length, pairsConsidered: boards.length * solids.length,
    overlaps, roots, maxRootDistanceM: Math.max(...roots.map(root => root.distanceM)),
    maxRootEndpointDistanceM: Math.max(...roots.map(root => root.endpointDistanceM)) };
}
export interface CanonicalSignPoint { readonly x: number; readonly y: number; readonly z: number; }
export interface CanonicalSignMount {
  readonly mode: 'panel' | 'blade';
  readonly host: PhysicalHost;
  readonly edgeIndex: number;
  readonly edge: readonly [CanonicalSignPoint, CanonicalSignPoint];
  readonly root: readonly [CanonicalSignPoint, CanonicalSignPoint];
}
interface CanonicalSigns<Owner> {
  readonly count: number;
  readonly cx: Float32Array; readonly cy: Float32Array; readonly cz: Float32Array;
  readonly nx: Float32Array; readonly nz: Float32Array;
  readonly sw: Float32Array; readonly sh: Float32Array;
  readonly owner: readonly (Owner | null)[];
  readonly mount: readonly CanonicalSignMount[];
}
interface RawDrawnSolid {
  readonly host: PhysicalHost;
  readonly footprint: readonly Point2[];
  readonly y0: number;
  readonly y1: number;
}

/** Read raw placement outputs. Geometry acceptance remains in the independent oracle. */
export function canonicalPhysicalScene<Owner>(signs: CanonicalSigns<Owner>, rawSolids: readonly RawDrawnSolid[],
  place: (owner: Owner, cx: number, cy: number, cz: number, nx: number, nz: number) => CanonicalSignPoint & { readonly nx: number; readonly nz: number },
  worldPoint: (owner: Owner, point: CanonicalSignPoint) => Point3) {
  const boards: Board[] = [];
  const mounts: PhysicalMount[] = [];
  for (let index = 0; index < signs.count; index += 1) {
    const owner = signs.owner[index];
    const mount = signs.mount[index];
    if (!owner || !mount) throw new Error('R37_COMPLETE_PHYSICAL_MOUNT_REQUIRED:' + index);
    const pose = place(owner, signs.cx[index]!, signs.cy[index]!, signs.cz[index]!, signs.nx[index]!, signs.nz[index]!);
    boards.push({ centre: [pose.x, pose.y, pose.z], normal: [pose.nx, pose.nz], size: [signs.sw[index]!, signs.sh[index]!] });
    mounts.push({ mode: mount.mode, host: mount.host, edgeIndex: mount.edgeIndex,
      edge: mount.edge.map(point => worldPoint(owner, point)) as [Point3, Point3],
      root: mount.root.map(point => worldPoint(owner, point)) as [Point3, Point3] });
  }
  const solids: PhysicalSolid[] = rawSolids.map(solid => ({ host: solid.host, footprint: solid.footprint,
    low: solid.y0, high: solid.y1 }));
  return { boards, mounts, solids };
}

export function uploadedBoards(centres: readonly number[], normals: readonly number[], sizes: readonly number[], count: number): Board[] {
  if (centres.length !== count * 3 || normals.length !== count * 2 || sizes.length !== count * 2) throw new Error('R37_UPLOADED_BOARD_ARRAY_LENGTH');
  return Array.from({ length: count }, (_, index) => ({
    centre: [centres[index * 3]!, centres[index * 3 + 1]!, centres[index * 3 + 2]!] as Point3,
    normal: [normals[index * 2]!, normals[index * 2 + 1]!] as Point2,
    size: [sizes[index * 2]!, sizes[index * 2 + 1]!] as Point2,
  }));
}

export function uploadedSolids(matrices: readonly number[], sourceIndices: readonly number[], kind: PhysicalHost['kind']): PhysicalSolid[] {
  if (matrices.length !== sourceIndices.length * 16 || sourceIndices.some(index => !Number.isInteger(index) || index < 0)
    || new Set(sourceIndices).size !== sourceIndices.length) throw new Error('R37_UPLOADED_SOLID_MAPPING');
  return sourceIndices.map((index, slot) => ({ ...solidFromMatrix(matrices.slice(slot * 16, slot * 16 + 16)), host: { kind, index } }));
}

/** Read the actual CPU upload arrays. The clipping oracle remains independent. */
export function uploadedPhysicalScene<Owner>(signs: CanonicalSigns<Owner>,
  draw: { readonly towers: readonly number[]; readonly trims: readonly number[] },
  batches: { readonly towers: InstancedMesh; readonly trims: InstancedMesh; readonly signs: Mesh },
  place: (owner: Owner, cx: number, cy: number, cz: number, nx: number, nz: number) => CanonicalSignPoint & { readonly nx: number; readonly nz: number },
  worldPoint: (owner: Owner, point: CanonicalSignPoint) => Point3) {
  if (batches.towers.count !== draw.towers.length || batches.trims.count !== draw.trims.length
    || !('instanceCount' in batches.signs.geometry)
    || batches.signs.geometry.instanceCount !== signs.count) throw new Error('R37_REAL_UPLOAD_COUNTS');
  const attribute = (name: string) => {
    const attr = batches.signs.geometry.getAttribute(name);
    return Array.from(attr.array, Number).slice(0, signs.count * attr.itemSize);
  };
  const boards = uploadedBoards(attribute('aCentre'), attribute('aNormal'), attribute('aSize'), signs.count);
  const solids = [...uploadedSolids(Array.from(batches.towers.instanceMatrix.array).slice(0, draw.towers.length * 16), draw.towers, 'mass'),
    ...uploadedSolids(Array.from(batches.trims.instanceMatrix.array).slice(0, draw.trims.length * 16), draw.trims, 'trim')];
  const canonical = canonicalPhysicalScene(signs, solids.map(solid => ({ ...solid, y0: solid.low, y1: solid.high })), place, worldPoint);
  return { boards, solids, mounts: canonical.mounts };
}

/** Convert an existing yaw roof witness to its full physical solid. */
export function solidFromRoofWitness(box: { readonly x: number; readonly y: number; readonly z: number;
  readonly hx: number; readonly hy: number; readonly hz: number; readonly c: number; readonly s: number }): Solid {
  return { low: box.y - box.hy, high: box.y + box.hy,
    footprint: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
      box.x + u! * box.hx * box.c + v! * box.hz * box.s,
      box.z - u! * box.hx * box.s + v! * box.hz * box.c,
    ] as const) };
}

export interface BuildingKey {
  readonly buildingId: string;
  readonly materialOwner: number;
  readonly anchorV: number;
}

/** Compare building identity separately from the selected coordinate frame. */
export function buildingMembershipFailures(source: BuildingKey, host: Omit<BuildingKey, 'buildingId'>,
  sourceFaceBuildingId: string): string[] {
  const failures: string[] = [];
  if (source.buildingId !== sourceFaceBuildingId) failures.push('source-building-mismatch');
  if (source.materialOwner !== host.materialOwner) failures.push('host-material-owner-mismatch');
  if (source.anchorV !== host.anchorV) failures.push('host-building-anchor-mismatch');
  return failures;
}

export interface MountedReservation {
  readonly sign: number;
  readonly side: -1 | 1;
  readonly role: 'ordinary' | 'hero';
  readonly compositionId: string;
  readonly u0: number; readonly u1: number;
  readonly y0: number; readonly y1: number;
  readonly heightM: number;
}

/** Grade the fixed spacing limits on complete mounted composition unions. */
export function mountedSpacingFailures(rows: readonly MountedReservation[], periodM: number) {
  const grouped = new Map<string, MountedReservation>();
  for (const row of rows) {
    const key = row.role === 'hero' ? row.side + ':' + row.compositionId : 'ordinary:' + row.sign;
    const previous = grouped.get(key);
    grouped.set(key, previous === undefined ? row : { ...row,
      u0: Math.min(previous.u0, row.u0), u1: Math.max(previous.u1, row.u1),
      y0: Math.min(previous.y0, row.y0), y1: Math.max(previous.y1, row.y1),
      heightM: Math.max(previous.heightM, row.heightM) });
  }
  const unions = [...grouped.values()];
  const failures: { first: string; second: string; distanceM: number; requiredM: number }[] = [];
  for (let i = 0; i < unions.length; i += 1) for (let j = i + 1; j < unions.length; j += 1) {
    const a = unions[i]!, b = unions[j]!;
    if (a.side !== b.side) continue;
    const vertical = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
    const distanceM = Math.min(...[-periodM, 0, periodM].map(shift => Math.hypot(vertical,
      Math.max(0, a.u0 - b.u1 - shift, b.u0 + shift - a.u1))));
    const requiredM = a.role === 'ordinary' && b.role === 'ordinary' ? 2 * Math.max(a.heightM, b.heightM)
      : a.role === 'hero' && b.role === 'hero' ? 1.5 * Math.max(a.heightM, b.heightM)
        : 1.5 * (a.role === 'hero' ? a.heightM : b.heightM);
    if (distanceM < requiredM) failures.push({ first: a.compositionId, second: b.compositionId, distanceM, requiredM });
  }
  return { unions, failures };
}

interface SourceArtworkHero {
  readonly kind: 'blade' | 'panel' | 'brand';
  readonly faceId: string;
  readonly x: number; readonly y: number; readonly z: number;
  readonly width: number; readonly height: number;
  readonly owner: { readonly anchorV: number };
}
interface SourceArtworkPose { x: number; z: number; heading: number }

/** Reconstruct the unchanged padded source artwork in its original bend frame. */
export function sourceArtworkBoxes(heroes: readonly SourceArtworkHero[],
  faces: readonly { readonly id: string; readonly outward: number }[],
  anchors: readonly { readonly side: number; readonly radius: number; readonly v: number }[],
  rigid: (x: number, z: number, anchorV: number, out: SourceArtworkPose) => unknown,
  canyon: (x: number, z: number, out: SourceArtworkPose) => unknown) {
  const byId = new Map(faces.map(face => [face.id, face]));
  return heroes.map(hero => {
    const face = byId.get(hero.faceId);
    if (!face) throw new Error(`R37_SOURCE_ARTWORK_FACE_MISSING:${hero.faceId}`);
    const point = { x: 0, z: 0, heading: 0 };
    let nx = hero.kind === 'panel' ? face.outward : 0;
    let nz = hero.kind === 'blade' ? 1 : 0;
    if (hero.kind === 'brand') {
      nx = 0;
      nz = -1;
      const anchor = anchors.find(apex => Math.abs(apex.v - hero.z) < 300);
      if (anchor) {
        const anchorX = anchor.side * anchor.radius * 0.995;
        canyon(anchorX, anchor.v, point);
        const dx = hero.x - anchorX, dz = hero.z - anchor.v;
        point.x += dx * Math.cos(point.heading) + dz * Math.sin(point.heading);
        point.z += -dx * Math.sin(point.heading) + dz * Math.cos(point.heading);
      } else {
        rigid(hero.x, hero.z, hero.owner.anchorV, point);
      }
    } else {
      rigid(hero.x, hero.z, hero.owner.anchorV, point);
    }
    const normalX = nx * Math.cos(point.heading) + nz * Math.sin(point.heading);
    const normalZ = -nx * Math.sin(point.heading) + nz * Math.cos(point.heading);
    return { x: point.x, y: hero.y, z: point.z, hx: hero.width / 2 + 14,
      hy: hero.height / 2 + 18, hz: 14, c: normalZ, s: normalX };
  });
}
