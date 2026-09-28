import type * as THREE from 'three';
import { PLAYER_EYE_OFFSET } from '../sim/constants';
import type { PlayerRenderPose } from './presentation';

/** First-person muzzle offset from the camera: right, up, forward (m). */
const VIEWMODEL_MUZZLE = [0.24, -0.2, 0.85] as const;

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
): void {
  if (firstPerson) {
    camera.getWorldDirection(aim);
    scratch.right.crossVectors(aim, camera.up).normalize();
    scratch.up.crossVectors(scratch.right, aim).normalize();
    muzzle.copy(camera.position)
      .addScaledVector(scratch.right, VIEWMODEL_MUZZLE[0])
      .addScaledVector(scratch.up, VIEWMODEL_MUZZLE[1])
      .addScaledVector(aim, VIEWMODEL_MUZZLE[2]);
    return;
  }
  const cosPitch = Math.cos(player.pitch);
  aim.set(-Math.sin(player.yaw) * cosPitch, Math.sin(player.pitch), -Math.cos(player.yaw) * cosPitch);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  muzzle.set(
    player.position[0] + aim.x * 0.5 + rightX * 0.25,
    player.position[1] + PLAYER_EYE_OFFSET - 0.2 + aim.y * 0.5,
    player.position[2] + aim.z * 0.5 + rightZ * 0.25,
  );
}
