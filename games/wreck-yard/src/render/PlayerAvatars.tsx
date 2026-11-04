import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { YardRender, PlayerRenderPose } from './presentation';
import { showsLocalAvatar } from './chaseCamera';
import type { UiTool } from './keyBindings';
import { ROBOT_DESIGNS, type RobotPose } from './avatars/robots';
import { TICK_RATE } from '../sim/constants';

function PlayerAvatar({ player, renderRef, tool }: { player: PlayerRenderPose; renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const root = useRef<THREE.Group>(null);
  const seat = useRef<THREE.Group>(null);
  const travel = useRef(0);
  const lastPosition = useRef(new THREE.Vector3(...player.position));
  const forwardCorrection = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), []);
  const design = ROBOT_DESIGNS[player.slot]!;
  // Pose getters read the current frame without a React update on each frame.
  const pose = useMemo<RobotPose>(() => {
    const current = () => renderRef.current?.players.find(p => p.slot === player.slot) ?? player;
    return {
      get time() { return (renderRef.current?.frame ?? 0) / TICK_RATE; },
      get jet() { return current().jetpackActive && !current().ridingVehicle; },
      get tool() { return current().activeTool === 'torch' ? 'torch' : 'hand'; },
      get pitch() { return current().pitch; },
      get driving() { return current().ridingVehicle; },
      get travel() { return travel.current; },
    };
  }, [player, renderRef]);

  useFrame(() => {
    if (!root.current || !seat.current) return;
    const render = renderRef.current;
    const current = render?.players.find(p => p.slot === player.slot);
    root.current.visible = Boolean(current && (current.slot !== render?.localSlot || showsLocalAvatar(tool, current.ridingVehicle)));
    root.current.userData.portalLocalAvatar = current?.slot === render?.localSlot;
    if (!current) return;

    const previous = lastPosition.current;
    const dx = current.position[0] - previous.x;
    const dz = current.position[2] - previous.z;
    // A respawn does not spin the wheel or tracks across the arena.
    if (!current.ridingVehicle && Math.hypot(dx, dz) < 1) {
      travel.current += dx * -Math.sin(current.yaw) + dz * -Math.cos(current.yaw);
    }
    previous.set(...current.position);

    const chassis = current.ridingVehicle ? render?.poses.get('vehicle-chassis') : undefined;
    if (chassis) {
      root.current.position.set(...chassis.position);
      root.current.quaternion.set(...chassis.rotation).multiply(forwardCorrection);
      seat.current.position.set(0, design.seatOffsetY, 0);
      seat.current.scale.setScalar(0.6);
    } else {
      root.current.position.set(...current.position);
      root.current.rotation.set(0, current.yaw + Math.PI, 0);
      seat.current.position.set(0, 0, 0);
      seat.current.scale.setScalar(1);
    }
  });

  return (
    <group ref={root} visible={false} position={player.position} name={`player-robot-${player.slot}`} userData={{ slot: player.slot, robot: design.id }}>
      <group ref={seat} name="robot-seat">
        <design.Component colors={design.colors} pose={pose} number={player.slot + 1} />
      </group>
    </group>
  );
}

export function PlayerAvatars({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool: UiTool }) {
  const render = renderRef.current;
  if (!render) return null;
  return <>{render.players.map(player => <PlayerAvatar key={`${player.slot}:${player.controlEpoch ?? 'solo'}`} player={player} renderRef={renderRef} tool={tool} />)}</>;
}
