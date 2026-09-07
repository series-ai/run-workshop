export interface FloorPoint {
  x: number;
  z: number;
}

export interface ContactStance {
  position: FloorPoint;
  yaw: number;
  waypoints: FloorPoint[];
}

interface ContactStanceInput {
  target: FloorPoint;
  palm: FloorPoint;
  scale: number;
  start: FloorPoint;
  home: FloorPoint;
  preferredYaw: number;
  candidateYaws: readonly number[];
}

const PATIENT_ZONE = {
  minX: -0.48,
  maxX: 0.48,
  minZ: -0.62,
  maxZ: 1.25,
} as const;
const ROOM_BOUNDS = {
  minX: -1.85,
  maxX: 1.85,
  minZ: -0.72,
  maxZ: 2.4,
} as const;
const ROUTE_CLEARANCE = 0.12;
const ROOM_EDGE_CLEARANCE = 0.01;

function distance(a: FloorPoint, b: FloorPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function angleDistance(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function isInsidePatientZone(point: FloorPoint): boolean {
  return (
    point.x >= PATIENT_ZONE.minX &&
    point.x <= PATIENT_ZONE.maxX &&
    point.z >= PATIENT_ZONE.minZ &&
    point.z <= PATIENT_ZONE.maxZ
  );
}

function isInsideRoom(point: FloorPoint): boolean {
  return (
    point.x >= ROOM_BOUNDS.minX &&
    point.x <= ROOM_BOUNDS.maxX &&
    point.z >= ROOM_BOUNDS.minZ &&
    point.z <= ROOM_BOUNDS.maxZ
  );
}

export function segmentCrossesPatient(
  start: FloorPoint,
  end: FloorPoint,
): boolean {
  let near = 0;
  let far = 1;
  const clip = (origin: number, delta: number, min: number, max: number) => {
    if (Math.abs(delta) < 1e-9) return origin >= min && origin <= max;
    const first = (min - origin) / delta;
    const second = (max - origin) / delta;
    near = Math.max(near, Math.min(first, second));
    far = Math.min(far, Math.max(first, second));
    return near <= far;
  };
  return (
    clip(start.x, end.x - start.x, PATIENT_ZONE.minX, PATIENT_ZONE.maxX) &&
    clip(start.z, end.z - start.z, PATIENT_ZONE.minZ, PATIENT_ZONE.maxZ)
  );
}

function findSafeRoute(
  start: FloorPoint,
  end: FloorPoint,
): FloorPoint[] | null {
  if (!segmentCrossesPatient(start, end)) return [];
  const left = Math.max(
    PATIENT_ZONE.minX - ROUTE_CLEARANCE,
    ROOM_BOUNDS.minX + ROOM_EDGE_CLEARANCE,
  );
  const right = Math.min(
    PATIENT_ZONE.maxX + ROUTE_CLEARANCE,
    ROOM_BOUNDS.maxX - ROOM_EDGE_CLEARANCE,
  );
  const head = Math.max(
    PATIENT_ZONE.minZ - ROUTE_CLEARANCE,
    ROOM_BOUNDS.minZ + ROOM_EDGE_CLEARANCE,
  );
  const foot = Math.min(
    PATIENT_ZONE.maxZ + ROUTE_CLEARANCE,
    ROOM_BOUNDS.maxZ - ROOM_EDGE_CLEARANCE,
  );
  const corners = [
    { x: left, z: head },
    { x: right, z: head },
    { x: left, z: foot },
    { x: right, z: foot },
  ].filter(isInsideRoom);
  const points = [start, end, ...corners];
  const costs = points.map(() => Number.POSITIVE_INFINITY);
  const previous = points.map(() => -1);
  const visited = points.map(() => false);
  costs[0] = 0;
  for (let count = 0; count < points.length; count++) {
    let current = -1;
    for (let index = 0; index < points.length; index++) {
      if (
        !visited[index] &&
        (current < 0 || costs[index] < costs[current])
      ) {
        current = index;
      }
    }
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) break;
    visited[current] = true;
    for (let next = 0; next < points.length; next++) {
      if (
        next === current ||
        visited[next] ||
        segmentCrossesPatient(points[current], points[next])
      ) {
        continue;
      }
      const cost = costs[current] + distance(points[current], points[next]);
      if (cost < costs[next]) {
        costs[next] = cost;
        previous[next] = current;
      }
    }
  }
  if (!Number.isFinite(costs[1])) return null;
  const route: FloorPoint[] = [];
  for (let current = previous[1]; current > 0; current = previous[current]) {
    route.unshift(points[current]);
  }
  return route;
}

export function planSafeRoute(
  start: FloorPoint,
  end: FloorPoint,
): FloorPoint[] {
  const route = findSafeRoute(start, end);
  if (!route) throw new Error("No safe route around the patient is available.");
  return route;
}

function routeDistance(
  start: FloorPoint,
  waypoints: readonly FloorPoint[],
  end: FloorPoint,
): number {
  let total = 0;
  let previous = start;
  for (const point of [...waypoints, end]) {
    total += distance(previous, point);
    previous = point;
  }
  return total;
}

export function selectContactStance(input: ContactStanceInput): ContactStance {
  const candidates = input.candidateYaws
    .map((yaw) => {
      const cosine = Math.cos(yaw);
      const sine = Math.sin(yaw);
      const offsetX = input.scale * (input.palm.x * cosine + input.palm.z * sine);
      const offsetZ = input.scale * (-input.palm.x * sine + input.palm.z * cosine);
      const position = {
        x: input.target.x - offsetX,
        z: input.target.z - offsetZ,
      };
      const waypoints = findSafeRoute(input.start, position);
      const score =
        routeDistance(input.start, waypoints ?? [], position) +
        distance(input.home, position) * 0.35 +
        angleDistance(yaw, input.preferredYaw) * 0.12;
      return { position, yaw, waypoints, score };
    })
    .filter(
      ({ position, waypoints }) =>
        waypoints !== null &&
        !isInsidePatientZone(position) &&
        isInsideRoom(position) &&
        waypoints.every(isInsideRoom),
    )
    .sort((a, b) => a.score - b.score);
  const stance = candidates[0];
  if (!stance) throw new Error("No safe contact stance is available.");
  return {
    position: stance.position,
    yaw: stance.yaw,
    waypoints: stance.waypoints!,
  };
}
