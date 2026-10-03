import { BURNT_MATERIAL, SCORCH_MATERIAL } from './constants';

/** A cold scorch: hot voxels become burnt. The shape does not change, so the collider stays. */
export function coolVoxels(voxels: Uint8Array): Uint8Array {
  return voxels.map((value) => (value === SCORCH_MATERIAL ? BURNT_MATERIAL : value));
}
