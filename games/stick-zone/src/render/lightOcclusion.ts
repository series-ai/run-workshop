/**
 * @file lightOcclusion.ts
 * Deterministic 2D raycast visibility and shadow volume generator for tactical flashlight beams.
 * Traces light rays against shipping containers and structures to produce occluded ground light meshes
 * and sharp graphic novel shadow edge contours.
 */

export interface ObstacleAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface LightOcclusionOptions {
  maxRange?: number;       // Max beam reach (meters), default 22.0
  halfAngle?: number;      // Half FOV cone (radians), default 0.48 (~27.5 deg)
  baseRayCount?: number;   // Base uniform ray count, default 40
  colorHex?: string;       // Beam color hex, default "#fffbeb"
  baseAlpha?: number;      // Center alpha, default 0.40
  groundY?: number;        // Ground plane altitude, default 0.03
}

export interface VisibilityPolygonData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
  edgeLines: Float32Array;
  vertexCount: number;
  triangleCount: number;
  edgeLineCount: number;
}

export function normalizeAngle(angle: number): number {
  let a = (angle + Math.PI) % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  const res = a - Math.PI;
  return Math.abs(res + Math.PI) < 1e-9 ? Math.PI : res;
}

export function rayAABBIntersection(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  box: ObstacleAABB,
  maxDist: number
): number {
  let tmin = 0;
  let tmax = maxDist;

  if (Math.abs(dirX) > 1e-6) {
    let t1 = (box.minX - ox) / dirX;
    let t2 = (box.maxX - ox) / dirX;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return maxDist;
  } else if (ox < box.minX || ox > box.maxX) {
    return maxDist;
  }

  if (Math.abs(dirZ) > 1e-6) {
    let t1 = (box.minZ - oz) / dirZ;
    let t2 = (box.maxZ - oz) / dirZ;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return maxDist;
  } else if (oz < box.minZ || oz > box.maxZ) {
    return maxDist;
  }

  return tmin > 0 && tmin < maxDist ? tmin : maxDist;
}

function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean.split("").map((c) => c + c).join("");
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) / 255, ((num >> 8) & 0xff) / 255, (num & 0xff) / 255];
}

export function computeVisibilityPolygon(
  ox: number,
  oz: number,
  facing: number,
  obstacles: readonly ObstacleAABB[],
  options: LightOcclusionOptions = {}
): VisibilityPolygonData {
  const maxRange = options.maxRange ?? 22.0;
  const halfAngle = options.halfAngle ?? 0.48;
  const baseRayCount = options.baseRayCount ?? 40;
  const baseAlpha = options.baseAlpha ?? 0.40;
  const groundY = options.groundY ?? 0.03;
  const [cr, cg, cb] = hexToRgb(options.colorHex ?? "#fffbeb");

  // Filter obstacles in beam range
  const relevantBoxes: ObstacleAABB[] = [];
  const searchDistSq = (maxRange + 8.0) * (maxRange + 8.0);
  for (const b of obstacles) {
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const dx = cx - ox;
    const dz = cz - oz;
    if (dx * dx + dz * dz <= searchDistSq) {
      relevantBoxes.push(b);
    }
  }

  const angleSet = new Set<number>();

  // 1. Uniform baseline rays across cone
  for (let i = 0; i <= baseRayCount; i++) {
    const frac = i / baseRayCount;
    angleSet.add(facing - halfAngle + frac * 2 * halfAngle);
  }

  // 2. Corner-directed rays for sharp shadow silhouettes
  const epsilon = 0.0008;
  for (const b of relevantBoxes) {
    const corners = [
      [b.minX, b.minZ],
      [b.maxX, b.minZ],
      [b.minX, b.maxZ],
      [b.maxX, b.maxZ],
    ];
    for (const [cx, cz] of corners) {
      const dx = cx - ox;
      const dz = cz - oz;
      const theta = Math.atan2(dx, dz);
      const diff = normalizeAngle(theta - facing);
      if (Math.abs(diff) < halfAngle - 0.003) {
        angleSet.add(theta - epsilon);
        angleSet.add(theta);
        angleSet.add(theta + epsilon);
      }
    }
  }

  // 3. Sort angles monotonically from -halfAngle to +halfAngle
  const sortedAngles = Array.from(angleSet).sort((a, b) => {
    return normalizeAngle(a - facing) - normalizeAngle(b - facing);
  });

  const numRays = sortedAngles.length;
  // Vertex 0 is light origin, followed by numRays perimeter vertices
  const totalVertices = numRays + 1;
  const positions = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 4);
  const indices = new Uint16Array((numRays - 1) * 3);

  // Set origin vertex
  positions[0] = ox;
  positions[1] = groundY;
  positions[2] = oz;
  colors[0] = cr;
  colors[1] = cg;
  colors[2] = cb;
  colors[3] = baseAlpha;

  const rayDistances: number[] = new Array(numRays);
  const perimeterPoints: Array<[number, number]> = new Array(numRays);

  for (let i = 0; i < numRays; i++) {
    const angle = sortedAngles[i];
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);

    let hitDist = maxRange;
    for (const b of relevantBoxes) {
      const d = rayAABBIntersection(ox, oz, dirX, dirZ, b, hitDist);
      if (d < hitDist) {
        hitDist = d;
      }
    }

    rayDistances[i] = hitDist;
    const px = ox + dirX * hitDist;
    const pz = oz + dirZ * hitDist;
    perimeterPoints[i] = [px, pz];

    const vIdx = i + 1;
    positions[vIdx * 3 + 0] = px;
    positions[vIdx * 3 + 1] = groundY;
    positions[vIdx * 3 + 2] = pz;

    // Attenuate alpha based on distance ratio
    const distRatio = hitDist / maxRange;
    const isObstacleStop = hitDist < maxRange - 0.2;
    // When stopping on a container, maintain high illumination splash
    const vertexAlpha = isObstacleStop
      ? Math.max(0.12, baseAlpha * (1.0 - Math.pow(distRatio, 1.8)))
      : Math.max(0.0, baseAlpha * (1.0 - Math.pow(distRatio, 1.2)));

    colors[vIdx * 4 + 0] = cr;
    colors[vIdx * 4 + 1] = cg;
    colors[vIdx * 4 + 2] = cb;
    colors[vIdx * 4 + 3] = vertexAlpha;
  }

  // Build triangle fan indices: (0, i, i+1)
  let triCount = 0;
  for (let i = 1; i < numRays; i++) {
    indices[triCount * 3 + 0] = 0;
    indices[triCount * 3 + 1] = i;
    indices[triCount * 3 + 2] = i + 1;
    triCount++;
  }

  // Collect sharp shadow boundary line segments where ray step discontinuity occurs
  const edgeLineCoords: number[] = [];
  for (let i = 1; i < numRays; i++) {
    const d1 = rayDistances[i - 1];
    const d2 = rayDistances[i];
    if (Math.abs(d1 - d2) > 0.8) {
      // Step discontinuity: shadow silhouette boundary
      const [p1x, p1z] = perimeterPoints[i - 1];
      const [p2x, p2z] = perimeterPoints[i];
      edgeLineCoords.push(p1x, groundY + 0.005, p1z, p2x, groundY + 0.005, p2z);
    }
  }

  return {
    positions,
    colors,
    indices,
    edgeLines: new Float32Array(edgeLineCoords),
    vertexCount: totalVertices,
    triangleCount: triCount,
    edgeLineCount: edgeLineCoords.length / 6,
  };
}
