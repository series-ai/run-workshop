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


// Pre-allocated static scratch buffers to eliminate runtime heap allocations and GC spikes in useFrame
const MAX_SCRATCH_RAYS = 384;
const MAX_SCRATCH_VERTS = MAX_SCRATCH_RAYS + 1;
const _scratchPositions = new Float32Array(MAX_SCRATCH_VERTS * 3);
const _scratchColors = new Float32Array(MAX_SCRATCH_VERTS * 4);
const _scratchIndices = new Uint16Array((MAX_SCRATCH_RAYS - 1) * 3);
const _scratchEdgeLines = new Float32Array(MAX_SCRATCH_RAYS * 6);
const _scratchAngles: number[] = [];
const _scratchSortedAngles: number[] = [];
const _scratchRelevantBoxes: ObstacleAABB[] = [];
const _scratchRayDistances: number[] = [];
const _scratchPerimeterPoints: Array<[number, number]> = Array.from({ length: MAX_SCRATCH_RAYS }, () => [0, 0]);


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

  // Reuse pre-allocated scratch arrays
  _scratchRelevantBoxes.length = 0;
  _scratchAngles.length = 0;
  _scratchSortedAngles.length = 0;
  _scratchRayDistances.length = 0;

  // Filter obstacles in beam range and cone angle
  const searchDistSq = (maxRange + 8.0) * (maxRange + 8.0);
  for (let i = 0; i < obstacles.length; i++) {
    const b = obstacles[i];
    const cx = (b.minX + b.maxX) * 0.5;
    const cz = (b.minZ + b.maxZ) * 0.5;
    const dx = cx - ox;
    const dz = cz - oz;
    const distSq = dx * dx + dz * dz;
    if (distSq <= searchDistSq) {
      const halfDiag = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) * 0.5;
      const dist = Math.sqrt(distSq);
      const angRadius = dist > halfDiag ? Math.asin(halfDiag / dist) : Math.PI;
      const angToCenter = Math.atan2(dx, dz);
      const angDiff = Math.abs(normalizeAngle(angToCenter - facing));
      if (angDiff <= halfAngle + angRadius + 0.08) {
        _scratchRelevantBoxes.push(b);
      }
    }
  }

  // 1. Uniform baseline rays across cone
  for (let i = 0; i <= baseRayCount; i++) {
    const frac = i / baseRayCount;
    _scratchAngles.push(facing - halfAngle + frac * 2 * halfAngle);
  }

  // 2. Corner-directed rays for sharp shadow silhouettes
  const epsilon = 0.0008;
  for (let i = 0; i < _scratchRelevantBoxes.length; i++) {
    const b = _scratchRelevantBoxes[i];
    // Inline corner evaluation to avoid allocating sub-arrays
    const c0x = b.minX; const c0z = b.minZ;
    const c1x = b.maxX; const c1z = b.minZ;
    const c2x = b.minX; const c2z = b.maxZ;
    const c3x = b.maxX; const c3z = b.maxZ;

    const cornersX = [c0x, c1x, c2x, c3x];
    const cornersZ = [c0z, c1z, c2z, c3z];

    for (let c = 0; c < 4; c++) {
      const dx = cornersX[c] - ox;
      const dz = cornersZ[c] - oz;
      const theta = Math.atan2(dx, dz);
      const diff = normalizeAngle(theta - facing);
      if (Math.abs(diff) < halfAngle - 0.003) {
        _scratchAngles.push(theta - epsilon);
        _scratchAngles.push(theta);
        _scratchAngles.push(theta + epsilon);
      }
    }
  }

  // 3. Sort angles monotonically from -halfAngle to +halfAngle and deduplicate in-place
  _scratchAngles.sort((a, b) => normalizeAngle(a - facing) - normalizeAngle(b - facing));

  for (let i = 0; i < _scratchAngles.length; i++) {
    const a = _scratchAngles[i];
    if (i === 0 || Math.abs(a - _scratchAngles[i - 1]) > 1e-6) {
      _scratchSortedAngles.push(a);
      if (_scratchSortedAngles.length >= MAX_SCRATCH_RAYS) break;
    }
  }

  const numRays = _scratchSortedAngles.length;
  const totalVertices = numRays + 1;

  // Set origin vertex
  _scratchPositions[0] = ox;
  _scratchPositions[1] = groundY;
  _scratchPositions[2] = oz;
  _scratchColors[0] = cr;
  _scratchColors[1] = cg;
  _scratchColors[2] = cb;
  _scratchColors[3] = baseAlpha;

  for (let i = 0; i < numRays; i++) {
    const angle = _scratchSortedAngles[i];
    const dirX = Math.sin(angle);
    const dirZ = Math.cos(angle);

    let hitDist = maxRange;
    for (let b = 0; b < _scratchRelevantBoxes.length; b++) {
      const d = rayAABBIntersection(ox, oz, dirX, dirZ, _scratchRelevantBoxes[b], hitDist);
      if (d < hitDist) {
        hitDist = d;
      }
    }

    _scratchRayDistances.push(hitDist);
    const px = ox + dirX * hitDist;
    const pz = oz + dirZ * hitDist;
    _scratchPerimeterPoints[i][0] = px;
    _scratchPerimeterPoints[i][1] = pz;

    const vIdx = i + 1;
    _scratchPositions[vIdx * 3 + 0] = px;
    _scratchPositions[vIdx * 3 + 1] = groundY;
    _scratchPositions[vIdx * 3 + 2] = pz;

    const distRatio = hitDist / maxRange;
    const isObstacleStop = hitDist < maxRange - 0.2;
    const vertexAlpha = isObstacleStop
      ? Math.max(0.12, baseAlpha * (1.0 - Math.pow(distRatio, 1.8)))
      : Math.max(0.0, baseAlpha * (1.0 - Math.pow(distRatio, 1.2)));

    _scratchColors[vIdx * 4 + 0] = cr;
    _scratchColors[vIdx * 4 + 1] = cg;
    _scratchColors[vIdx * 4 + 2] = cb;
    _scratchColors[vIdx * 4 + 3] = vertexAlpha;
  }

  // Build triangle fan indices: (0, i, i+1)
  let triCount = 0;
  for (let i = 1; i < numRays; i++) {
    _scratchIndices[triCount * 3 + 0] = 0;
    _scratchIndices[triCount * 3 + 1] = i;
    _scratchIndices[triCount * 3 + 2] = i + 1;
    triCount++;
  }

  // Detect shadow step edges along obstacle silhouettes
  let edgeCount = 0;
  const shadowDistStepThreshold = 1.2;
  for (let i = 0; i < numRays - 1; i++) {
    const d1 = _scratchRayDistances[i];
    const d2 = _scratchRayDistances[i + 1];
    if (Math.abs(d1 - d2) > shadowDistStepThreshold) {
      const nearIdx = d1 < d2 ? i : i + 1;
      const farIdx = d1 < d2 ? i + 1 : i;

      const pNear = _scratchPerimeterPoints[nearIdx];
      const pFar = _scratchPerimeterPoints[farIdx];

      const eOffset = edgeCount * 6;
      _scratchEdgeLines[eOffset + 0] = pNear[0];
      _scratchEdgeLines[eOffset + 1] = groundY + 0.005;
      _scratchEdgeLines[eOffset + 2] = pNear[1];

      _scratchEdgeLines[eOffset + 3] = pFar[0];
      _scratchEdgeLines[eOffset + 4] = groundY + 0.005;
      _scratchEdgeLines[eOffset + 5] = pFar[1];

      edgeCount++;
      if (edgeCount >= MAX_SCRATCH_RAYS) break;
    }
  }

  return {
    positions: _scratchPositions.subarray(0, totalVertices * 3),
    colors: _scratchColors.subarray(0, totalVertices * 4),
    indices: _scratchIndices.subarray(0, triCount * 3),
    edgeLines: _scratchEdgeLines.subarray(0, edgeCount * 6),
    vertexCount: totalVertices,
    triangleCount: triCount,
    edgeLineCount: edgeCount,
  };
}
