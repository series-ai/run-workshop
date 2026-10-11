import type * as THREE from 'three';
import { ROBOT_SLOTS, ROBOT_TOOL_LENGTH } from './avatars/robotSlots';
import type { PlayerRenderPose } from './presentation';

/**
 * First-person muzzle offset from the camera: right, up, forward (m). The torch
 * value is its nozzle tip (the pilot flame), measured in the live viewmodel.
 */
const VIEWMODEL_MUZZLE = {
  gun: [0.24, -0.2, 0.85],
  torch: [0.273, -0.164, 0.837],
} as const;
export type MuzzleTool = keyof typeof VIEWMODEL_MUZZLE;

/**
 * World-space muzzle and aim direction of a player's tool. Your own view uses
 * the camera (the first-person viewmodel); other players and orbit view use the avatar.
 */
export function toolMuzzleAndAim(
  player: PlayerRenderPose,
  firstPerson: boolean,
  camera: THREE.Camera,
  muzzle: THREE.Vector3,
  aim: THREE.Vector3,
  scratch: { right: THREE.Vector3; up: THREE.Vector3 },
  muzzleTool: MuzzleTool = 'gun',
): void {
  if (firstPerson) {
    const offset = VIEWMODEL_MUZZLE[muzzleTool];
    camera.getWorldDirection(aim);
    scratch.right.crossVectors(aim, camera.up).normalize();
    scratch.up.crossVectors(scratch.right, aim).normalize();
    muzzle.copy(camera.position)
      .addScaledVector(scratch.right, offset[0])
      .addScaledVector(scratch.up, offset[1])
      .addScaledVector(aim, offset[2]);
    return;
  }
  const cosPitch = Math.cos(player.pitch);
  aim.set(-Math.sin(player.yaw) * cosPitch, Math.sin(player.pitch), -Math.cos(player.yaw) * cosPitch);
  const [x, y, z] = ROBOT_SLOTS[player.slot]!.toolGrip;
  const heading = player.yaw + Math.PI;
  muzzle.set(
    player.position[0] + x * Math.cos(heading) + z * Math.sin(heading) + aim.x * ROBOT_TOOL_LENGTH,
    player.position[1] + y + aim.y * ROBOT_TOOL_LENGTH,
    player.position[2] - x * Math.sin(heading) + z * Math.cos(heading) + aim.z * ROBOT_TOOL_LENGTH,
  );
}
