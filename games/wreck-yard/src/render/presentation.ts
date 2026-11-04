import type { AttractionState } from '../sim/attractions';
import type { SyncplayRunnerStatus } from '@series-inc/rundot-syncplay/browser';
import { lerp, lerpAngle, quatNlerp, type Quat, type Vec3 } from '../sim/math';
import { isShell } from '../sim/physics';
import type { BuggyWheelState, ContraptionState, Impact, YardBody, YardState, YardStats, ToolFeedback } from '../sim/state';
import { TANK_SPEC } from '../sim/constants';
import type { SoundMotion } from '../audio/cues';
import { beginPhase, endPhase, perfActive, perfCount } from '../perf/recorder';

export interface RenderPose {
  readonly teleportCounter?: number;
  readonly position: Vec3;
  readonly rotation: Quat;
}

export interface PlayerRenderPose {
  readonly controlEpoch?: number | null;
  readonly portalTeleports?: number;
  readonly slot: number;
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly fuel: number;
  readonly activeTool: string;
  readonly jetpackActive: boolean;
  readonly grabbing: string | null;
  readonly ridingVehicle: boolean;
  readonly feedback: ToolFeedback | null;
  readonly soundPosition?: Vec3;
  readonly grounded?: boolean;
  readonly velocity?: Vec3;
}

export interface YardRender {
  readonly portalStraddlers?: YardState['world']['portalStraddlers'];
  readonly attractions: AttractionState;
  /** Native motion for audio. Interpolation does not change these tick samples. */
  readonly soundMotions?: ReadonlyMap<string, SoundMotion>;
  readonly buggyWheels?: readonly BuggyWheelState[];
  readonly frame: number;
  readonly bodies: readonly YardBody[];
  readonly poses: ReadonlyMap<string, RenderPose>;
  readonly players: readonly PlayerRenderPose[];
  readonly localSlot: number;
  readonly stats: YardStats;
  readonly contraptions: ContraptionState;
  /** Hard contacts of the last few ticks (sim/impacts.ts): hit sounds and hit effects. */
  readonly impacts: readonly Impact[];
  readonly floating: number;
}

export function projectYard(state: YardState, context: { readonly localSlot: number; readonly status: SyncplayRunnerStatus }): YardRender {
  const phaseStart = beginPhase('render.project');
  const poses = new Map<string, RenderPose>();
  const soundMotions = new Map<string, SoundMotion>();
  const submergedBodyIds = new Set<string>();
  if (state.world.fluidInteractions) {
    for (const interaction of state.world.fluidInteractions) {
      if (interaction.submergedVolume > 1e-4) {
        submergedBodyIds.add(interaction.bodyId);
      }
    }
  }

  let floating = 0;
  for (const physics of state.world.bodies) {
    if (isShell(physics.id)) continue;
    const rotation: Quat = physics.orientation
      ? [physics.orientation.x, physics.orientation.y, physics.orientation.z, physics.orientation.w]
      : [0, 0, 0, 1];
    poses.set(physics.id, { teleportCounter: physics.teleportCounter, position: [physics.x, physics.y, physics.z], rotation });
    soundMotions.set(physics.id, {
      position: [physics.x, physics.y, physics.z],
      velocity: [physics.vx, physics.vy, physics.vz],
      submerged: submergedBodyIds.has(physics.id),
    });
    const isSubmerged = submergedBodyIds.size > 0
      ? submergedBodyIds.has(physics.id)
      : (physics.kind === 'dynamic' && physics.y < TANK_SPEC.surfaceY + 0.3 && physics.y > TANK_SPEC.bottomY
        && Math.abs(physics.x - TANK_SPEC.center[0]) < TANK_SPEC.innerSize[0] * 0.5
        && Math.abs(physics.z - TANK_SPEC.center[2]) < TANK_SPEC.innerSize[2] * 0.5);
    if (isSubmerged) {
      floating += 1;
    }
  }

  const players: PlayerRenderPose[] = state.players.filter((p) => p.active).map((p) => ({
    slot: p.slot,
    controlEpoch: p.controlEpoch,
    portalTeleports: p.portalTeleports,
    position: [p.x, p.y, p.z],
    soundPosition: [p.x, p.y, p.z],
    yaw: p.yaw,
    pitch: p.pitch,
    fuel: p.fuel,
    activeTool: p.activeTool,
    jetpackActive: p.jetpackActive,
    grabbing: p.grab?.bodyId ?? null,
    ridingVehicle: Boolean(p.ridingVehicle),
    feedback: p.feedback,
    grounded: p.grounded,
    velocity: [p.vx, p.vy, p.vz],
  }));

  const render: YardRender = {
    soundMotions,
    portalStraddlers: state.world.portalStraddlers,
    frame: state.frame,
    buggyWheels: state.buggyWheels,
    bodies: state.bodies,
    poses,
    players,
    localSlot: context.localSlot,
    stats: state.stats,
    contraptions: state.contraptions,
    impacts: state.impacts,
    attractions: state.attractions,
    floating,
  };
  endPhase('render.project', phaseStart);
  return render;
}

export function interpolateYard(previous: YardRender, current: YardRender, alpha: number): YardRender {
  const phaseStart = beginPhase('render.interpolate');
  if (perfActive()) perfCount('render.interpolations', 1);
  const poses = new Map<string, RenderPose>();
  for (const [id, pose] of current.poses) {
    const before = previous.poses.get(id);
    if (!before || before.teleportCounter !== pose.teleportCounter || alpha === 1
      || (before.position.every((value, axis) => value === pose.position[axis])
        && before.rotation.every((value, axis) => value === pose.rotation[axis]))) {
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
      teleportCounter: pose.teleportCounter,
    });
  }
  const players = current.players.map((curr) => {
    const prev = previous.players?.find((p) => p.slot === curr.slot);
    if (!prev || prev.controlEpoch !== curr.controlEpoch || prev.portalTeleports !== curr.portalTeleports) return curr;
    return {
      ...curr,
      position: [
        lerp(prev.position[0], curr.position[0], alpha),
        lerp(prev.position[1], curr.position[1], alpha),
        lerp(prev.position[2], curr.position[2], alpha),
      ] as Vec3,
      yaw: lerpAngle(prev.yaw, curr.yaw, alpha),
      pitch: lerpAngle(prev.pitch, curr.pitch, alpha),
      fuel: lerp(prev.fuel, curr.fuel, alpha),
    };
  });
  const buggyWheels = current.buggyWheels?.map((wheel, index) => {
    const before = previous.buggyWheels?.[index];
    return before ? {
      ...wheel,
      compression: lerp(before.compression, wheel.compression, alpha),
      steerAngleTurns: lerp(before.steerAngleTurns, wheel.steerAngleTurns, alpha),
      spinTurns: lerp(before.spinTurns, wheel.spinTurns, alpha),
    } : wheel;
  });
  const render = { ...current, poses, players, buggyWheels };
  endPhase('render.interpolate', phaseStart);
  return render;
}
