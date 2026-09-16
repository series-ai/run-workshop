import type { SyncplayRunnerStatus } from '@series-inc/rundot-syncplay/browser';
import { lerp, quatNlerp, type Quat, type Vec3 } from '../sim/math';
import { isShell } from '../sim/physics';
import type { YardBody, YardState, YardStats } from '../sim/state';
import { TANK_SPEC } from '../sim/constants';

export interface RenderPose {
  readonly position: Vec3;
  readonly rotation: Quat;
}

export interface YardRender {
  readonly frame: number;
  readonly bodies: readonly YardBody[];
  readonly poses: ReadonlyMap<string, RenderPose>;
  readonly stats: YardStats;
  readonly floating: number;
  readonly grabbed: readonly (string | null)[];
  readonly torching: readonly (string | null)[];
}

export function projectYard(state: YardState, _context: { readonly localSlot: number; readonly status: SyncplayRunnerStatus }): YardRender {
  const poses = new Map<string, RenderPose>();
  let floating = 0;
  for (const physics of state.world.bodies) {
    if (isShell(physics.id)) continue;
    const rotation: Quat = physics.orientation
      ? [physics.orientation.x, physics.orientation.y, physics.orientation.z, physics.orientation.w]
      : [0, 0, 0, 1];
    poses.set(physics.id, { position: [physics.x, physics.y, physics.z], rotation });
    if (physics.kind === 'dynamic' && physics.y < TANK_SPEC.surfaceY + 0.3 && physics.y > TANK_SPEC.bottomY
      && Math.abs(physics.x - TANK_SPEC.center[0]) < TANK_SPEC.innerSize[0] * 0.5
      && Math.abs(physics.z - TANK_SPEC.center[2]) < TANK_SPEC.innerSize[2] * 0.5) {
      floating += 1;
    }
  }
  return {
    frame: state.frame,
    bodies: state.bodies,
    poses,
    stats: state.stats,
    floating,
    grabbed: state.players.map((p) => p.grab?.bodyId ?? null),
    torching: state.players.map((p) => p.torch?.bodyId ?? null),
  };
}

export function interpolateYard(previous: YardRender, current: YardRender, alpha: number): YardRender {
  const poses = new Map<string, RenderPose>();
  for (const [id, pose] of current.poses) {
    const before = previous.poses.get(id);
    if (!before) {
      poses.set(id, pose);
      continue;
    }
    poses.set(id, {
      position: [
        lerp(before.position[0], pose.position[0], alpha),
        lerp(before.position[1], pose.position[1], alpha),
        lerp(before.position[2], pose.position[2], alpha),
      ],
      rotation: quatNlerp(before.rotation, pose.rotation, alpha),
    });
  }
  return { ...current, poses };
}
