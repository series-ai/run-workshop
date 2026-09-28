import type { YardBody } from '../sim/state';

/** Keep camera angles inside the range of the network input codec. */
export function wrapYaw(yaw: number): number {
  return Math.atan2(Math.sin(yaw), Math.cos(yaw));
}

/** Pose changes do not require React work. Voxel edits do. */
export function bodyGeometryChanged(previous: readonly YardBody[] | null, current: readonly YardBody[]): boolean {
  return previous === null || previous.length !== current.length || previous.some((body, index) => {
    const next = current[index]!;
    return body.id !== next.id || body.voxels !== next.voxels ||
      body.dims.x !== next.dims.x || body.dims.y !== next.dims.y || body.dims.z !== next.dims.z;
  });
}
