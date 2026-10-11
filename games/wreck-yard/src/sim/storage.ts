import { DT, FLOOR_Y, VOXEL_SIZE } from './constants';
import { ELEVATOR, STORAGE, STORAGE_BOUNDS, type AttractionState } from './attractions';
import type { Vec3 } from './math';
import type { YardBody } from './state';

export interface CrateSpawn { readonly body: YardBody; readonly position: Vec3; readonly rotation: readonly [number, number, number, number] }
const CRATE_DIMS = { x: 12, y: 12, z: 12 };
const CRATE_VOXELS = new Uint8Array(12 ** 3).fill(2);
export function createCrateSpawns(bay: 'storage' | 'returns'): CrateSpawn[] {
  const [columns, rows, tiers, cx, cz] = bay === 'storage'
    ? [STORAGE.columns, STORAGE.rows, STORAGE.tiers, STORAGE.center[0], STORAGE.center[2]]
    : [3, 3, 4, 11, -17.8];
  const result: CrateSpawn[] = [];
  for (let tier = 0; tier < tiers; tier++) for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const index = (tier * rows + row) * columns + col;
    result.push({
      body: { id: `shipping-${bay}-${index}`, label: 'Shipping Crate', dims: CRATE_DIMS, voxels: CRATE_VOXELS,
        motion: 'dynamic', buoyancy: 0.2, anchorFaces: [], impactCooldownUntil: 0, heat: null,
        storageBay: bay, renderModel: 'shipping-crate' },
      position: [cx + (col - (columns - 1) / 2) * STORAGE.spacing, FLOOR_Y + STORAGE.size / 2 + tier * STORAGE.spacing, cz + (row - (rows - 1) / 2) * STORAGE.spacing],
      rotation: [0, 0, 0, 1],
    });
  }
  return result;
}
export function spawnInAttractionZone(position: Vec3, dims: YardBody['dims']): boolean {
  const radius = Math.hypot(dims.x, dims.z) * VOXEL_SIZE / 2;
  const overlaps = (minX: number, maxX: number, minZ: number, maxZ: number) => position[0] + radius > minX && position[0] - radius < maxX && position[2] + radius > minZ && position[2] - radius < maxZ;
  return overlaps(STORAGE_BOUNDS.min[0], ELEVATOR.x + 2, STORAGE_BOUNDS.min[2], STORAGE_BOUNDS.max[2] + 1.4)
    || overlaps(-4.7, 0.7, 17, 23)
    || overlaps(4.3, 9.7, -23, -15)
    || overlaps(-8.6, 7.5, -22.6, -19.6)
    || overlaps(9.4, 12.6, -19.4, -16.2);
}
/** Choose the next platform velocity. Read its actual height after the native step. */
export function elevatorMotion(elevator: AttractionState['elevator']): AttractionState['elevator'] {
  const distance = ELEVATOR.floors[elevator.target] - elevator.y;
  if (Math.abs(distance) < 0.00001) return { ...elevator, velocity: 0, status: 'ready' };
  const wanted = Math.sign(distance) * Math.min(ELEVATOR.speed, Math.sqrt(2 * ELEVATOR.acceleration * Math.abs(distance)));
  const change = Math.max(-ELEVATOR.acceleration * DT, Math.min(ELEVATOR.acceleration * DT, wanted - elevator.velocity));
  const accelerated = elevator.velocity + change;
  const reachesTarget = Math.sign(accelerated) === Math.sign(distance) && Math.abs(accelerated * DT) >= Math.abs(distance);
  const velocity = reachesTarget ? distance / DT : accelerated;
  return { ...elevator, velocity, status: 'moving' };
}
