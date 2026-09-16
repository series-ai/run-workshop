import { deterministicSin, rotateVector } from './deterministicMath';

export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];
export type VoxelDims = { x: number; y: number; z: number };

export type BuoyancyVolumeSample = {
  localCenter: Vec3Tuple;
  localHalfExtents: Vec3Tuple;
  volume: number;
};

export type WaterTankSpec = {
  center: Vec3Tuple;
  innerSize: Vec3Tuple;
  bottomY: number;
  surfaceY: number;
  margin?: number;
  waveAmplitude?: number;
  secondaryWaveAmplitude?: number;
  waveFrequency?: number;
  secondaryWaveFrequency?: number;
};

export type BuoyancyBodyState = {
  position: Vec3Tuple;
  linearVelocity: Vec3Tuple;
  angularVelocity: Vec3Tuple;
  halfExtents: Vec3Tuple;
  buoyancy: number;
  mass?: number;
  gravity?: number;
  fluidDensity?: number;
  rotation?: QuatTuple;
  time?: number;
  volumeSamples?: BuoyancyVolumeSample[];
};

export type BuoyancyResponse = {
  inside: boolean;
  submerged: number;
  floating: boolean;
  force: Vec3Tuple;
  torque: Vec3Tuple;
  angularDamping: Vec3Tuple;
  targetY: number;
  surfaceY: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getWaveAmplitudeBudget(tank: WaterTankSpec): number {
  return (tank.waveAmplitude ?? 0.035) + (tank.secondaryWaveAmplitude ?? 0.02);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function estimateBodyMass(halfExtents: Vec3Tuple, buoyancy: number): number {
  const volume = halfExtents[0] * halfExtents[1] * halfExtents[2] * 8;
  const densityScale = lerp(1.5, 0.45, Math.sqrt(clamp(buoyancy, 0, 1)));
  return Math.max(0.05, volume * densityScale);
}

function getProjectedHalfExtents(halfExtents: Vec3Tuple, [x, y, z, w]: QuatTuple): Vec3Tuple {
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  const m00 = 1 - 2 * (yy + zz);
  const m01 = 2 * (xy - wz);
  const m02 = 2 * (xz + wy);
  const m10 = 2 * (xy + wz);
  const m11 = 1 - 2 * (xx + zz);
  const m12 = 2 * (yz - wx);
  const m20 = 2 * (xz - wy);
  const m21 = 2 * (yz + wx);
  const m22 = 1 - 2 * (xx + yy);

  const hx = halfExtents[0];
  const hy = halfExtents[1];
  const hz = halfExtents[2];

  return [
    Math.abs(m00) * hx + Math.abs(m01) * hy + Math.abs(m02) * hz,
    Math.abs(m10) * hx + Math.abs(m11) * hy + Math.abs(m12) * hz,
    Math.abs(m20) * hx + Math.abs(m21) * hy + Math.abs(m22) * hz,
  ];
}

function getDefaultVolumeSamples(halfExtents: Vec3Tuple): BuoyancyVolumeSample[] {
  return [
    {
      localCenter: [0, 0, 0],
      localHalfExtents: [...halfExtents],
      volume: halfExtents[0] * halfExtents[1] * halfExtents[2] * 8,
    },
  ];
}

export function buildVoxelBuoyancySamples(
  voxels: Uint8Array,
  dims: VoxelDims,
  voxelSize: number,
): BuoyancyVolumeSample[] {
  const cellHalf = voxelSize * 0.5;
  const samples: BuoyancyVolumeSample[] = [];

  for (let z = 0; z < dims.z; z += 1) {
    for (let y = 0; y < dims.y; y += 1) {
      for (let x = 0; x < dims.x; x += 1) {
        const index = x + y * dims.x + z * dims.x * dims.y;
        if (voxels[index] === 0) {
          continue;
        }

        samples.push({
          localCenter: [
            (x + 0.5 - dims.x * 0.5) * voxelSize,
            (y + 0.5 - dims.y * 0.5) * voxelSize,
            (z + 0.5 - dims.z * 0.5) * voxelSize,
          ],
          localHalfExtents: [cellHalf, cellHalf, cellHalf],
          volume: voxelSize * voxelSize * voxelSize,
        });
      }
    }
  }

  return samples;
}

export function sampleTankWaveHeight(
  tank: WaterTankSpec,
  point: [number, number],
  time = 0,
): number {
  const primaryAmplitude = tank.waveAmplitude ?? 0.035;
  const secondaryAmplitude = tank.secondaryWaveAmplitude ?? 0.02;
  const primaryFrequency = tank.waveFrequency ?? 2;
  const secondaryFrequency = tank.secondaryWaveFrequency ?? 2.6;
  const localX = point[0] - tank.center[0];
  const localZ = point[1] - tank.center[2];

  return (
    tank.surfaceY +
    deterministicSin(localX * primaryFrequency + time * 1.1) * primaryAmplitude +
    deterministicSin(localZ * secondaryFrequency + time * 0.9) * secondaryAmplitude
  );
}

export function computeTankBuoyancyResponse(
  tank: WaterTankSpec,
  body: BuoyancyBodyState,
): BuoyancyResponse {
  const rotation = body.rotation ?? [0, 0, 0, 1];
  const projectedHalfExtents = getProjectedHalfExtents(body.halfExtents, rotation);
  const margin = tank.margin ?? 0.12;
  const tankHalfWidth = tank.innerSize[0] * 0.5 - margin;
  const tankHalfDepth = tank.innerSize[2] * 0.5 - margin;
  const horizontalOverlap =
    Math.abs(body.position[0] - tank.center[0]) <= tankHalfWidth + projectedHalfExtents[0] &&
    Math.abs(body.position[2] - tank.center[2]) <= tankHalfDepth + projectedHalfExtents[2];

  const height = body.halfExtents[1] * 2;
  const centerSurfaceY = sampleTankWaveHeight(tank, [body.position[0], body.position[2]], body.time ?? 0);
  const buoyancyFactor = clamp(body.buoyancy, 0, 1);
  const fallbackMass = body.mass ?? estimateBodyMass(body.halfExtents, buoyancyFactor);
  const volumeSamples = body.volumeSamples ?? getDefaultVolumeSamples(body.halfExtents);
  const totalBodyVolume = volumeSamples.reduce((sum, sample) => sum + sample.volume, 0);
  const fluidDensity = body.fluidDensity ?? 1;
  const equilibriumSubmerged = clamp(
    fallbackMass / Math.max(totalBodyVolume * fluidDensity, 1e-4),
    0.05,
    1.0,
  );
  const flatTargetY = tank.surfaceY + height * (0.5 - equilibriumSubmerged);
  const mass = fallbackMass;
  const gravity = body.gravity ?? 13.5;
  const tankMinX = tank.center[0] - tankHalfWidth;
  const tankMaxX = tank.center[0] + tankHalfWidth;
  const tankMinZ = tank.center[2] - tankHalfDepth;
  const tankMaxZ = tank.center[2] + tankHalfDepth;

  if (!horizontalOverlap) {
    return {
      inside: false,
      submerged: 0,
      floating: false,
      force: [0, 0, 0],
      torque: [0, 0, 0],
      angularDamping: [0, 0, 0],
      targetY: flatTargetY,
      surfaceY: centerSurfaceY,
    };
  }

  const bottom = body.position[1] - projectedHalfExtents[1];
  const top = body.position[1] + projectedHalfExtents[1];
  const maxSurfaceY = tank.surfaceY + getWaveAmplitudeBudget(tank);
  if (top <= tank.bottomY || bottom >= maxSurfaceY + 0.04) {
    return {
      inside: true,
      submerged: 0,
      floating: false,
      force: [0, 0, 0],
      torque: [0, 0, 0],
      angularDamping: [0, 0, 0],
      targetY: flatTargetY,
      surfaceY: centerSurfaceY,
    };
  }

  let sampledSurfaceY = 0;
  let surfaceSampleCount = 0;
  let submergedVolume = 0;
  let centroidX = 0;
  let centroidY = 0;
  let centroidZ = 0;
  let torqueX = 0;
  let torqueY = 0;
  let torqueZ = 0;

  for (const sample of volumeSamples) {
    const worldCenterOffset = rotateVector(sample.localCenter, rotation);
    const worldCenterX = body.position[0] + worldCenterOffset[0];
    const worldCenterY = body.position[1] + worldCenterOffset[1];
    const worldCenterZ = body.position[2] + worldCenterOffset[2];
    const worldHalf = getProjectedHalfExtents(sample.localHalfExtents, rotation);
    const sampleMinX = worldCenterX - worldHalf[0];
    const sampleMaxX = worldCenterX + worldHalf[0];
    const sampleMinY = worldCenterY - worldHalf[1];
    const sampleMaxY = worldCenterY + worldHalf[1];
    const sampleMinZ = worldCenterZ - worldHalf[2];
    const sampleMaxZ = worldCenterZ + worldHalf[2];

    const overlapX = Math.max(0, Math.min(sampleMaxX, tankMaxX) - Math.max(sampleMinX, tankMinX));
    const overlapZ = Math.max(0, Math.min(sampleMaxZ, tankMaxZ) - Math.max(sampleMinZ, tankMinZ));
    if (overlapX <= 1e-5 || overlapZ <= 1e-5) {
      continue;
    }

    const sampleSurfaceY = sampleTankWaveHeight(
      tank,
      [clamp(worldCenterX, tankMinX, tankMaxX), clamp(worldCenterZ, tankMinZ, tankMaxZ)],
      body.time ?? 0,
    );
    sampledSurfaceY += sampleSurfaceY;
    surfaceSampleCount += 1;

    const overlapY = Math.max(0, Math.min(sampleMaxY, sampleSurfaceY) - Math.max(sampleMinY, tank.bottomY));
    if (overlapY <= 1e-5) {
      continue;
    }

    const cellAabbVolume = Math.max((worldHalf[0] * 2) * (worldHalf[1] * 2) * (worldHalf[2] * 2), 1e-6);
    const submergedFraction = clamp((overlapX * overlapY * overlapZ) / cellAabbVolume, 0, 1);
    const sampleSubmergedVolume = sample.volume * submergedFraction;
    submergedVolume += sampleSubmergedVolume;

    centroidX += (Math.max(sampleMinX, tankMinX) + Math.min(sampleMaxX, tankMaxX)) * 0.5 * sampleSubmergedVolume;
    centroidY += (Math.max(sampleMinY, tank.bottomY) + Math.min(sampleMaxY, sampleSurfaceY)) * 0.5 * sampleSubmergedVolume;
    centroidZ += (Math.max(sampleMinZ, tankMinZ) + Math.min(sampleMaxZ, tankMaxZ)) * 0.5 * sampleSubmergedVolume;
  }

  const surfaceY = surfaceSampleCount > 0 ? sampledSurfaceY / surfaceSampleCount : centerSurfaceY;
  const submerged = clamp(submergedVolume / Math.max(totalBodyVolume, 1e-6), 0, 1);
  const targetY = surfaceY + height * (0.5 - equilibriumSubmerged);
  const hasCentroid = submergedVolume > 1e-6;
  const centroid: Vec3Tuple = hasCentroid
    ? [centroidX / submergedVolume, centroidY / submergedVolume, centroidZ / submergedVolume]
    : [body.position[0], body.position[1], body.position[2]];

  let forceX = -body.linearVelocity[0] * fluidDensity * submergedVolume * 5.5;
  let forceY = -body.linearVelocity[1] * fluidDensity * submergedVolume * 8.4;
  let forceZ = -body.linearVelocity[2] * fluidDensity * submergedVolume * 5.5;
  forceY += -Math.sign(body.linearVelocity[1]) * body.linearVelocity[1] * body.linearVelocity[1] * fluidDensity * submergedVolume * 3.6;

  const buoyantY = fluidDensity * submergedVolume * gravity;
  if (buoyantY > 0) {
    forceY += buoyantY;
    const rx = centroid[0] - body.position[0];
    const rz = centroid[2] - body.position[2];
    torqueX += -rz * buoyantY;
    torqueZ += rx * buoyantY;
  }

  torqueX += -body.angularVelocity[0] * fluidDensity * submergedVolume * 1.4;
  torqueY += -body.angularVelocity[1] * fluidDensity * submergedVolume * 0.75;
  torqueZ += -body.angularVelocity[2] * fluidDensity * submergedVolume * 1.4;

  return {
    inside: true,
    submerged,
    floating: submerged >= 0.08 && buoyantY >= mass * gravity * 0.6,
    force: [forceX, forceY, forceZ],
    torque: [torqueX, torqueY, torqueZ],
    angularDamping: [submerged * 3.1, submerged * 1.9, submerged * 3.1],
    targetY,
    surfaceY,
  };
}
