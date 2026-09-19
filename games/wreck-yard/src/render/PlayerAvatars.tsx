import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Toon } from './style/toonMaterial';
import type { YardRender, PlayerRenderPose } from './presentation';

const PLAYER_COLORS = [
  { suit: '#4a5338', visor: '#facc15', glow: '#fef08a', flame: '#f59e0b' }, // Salvage Olive / Gold
  { suit: '#78350f', visor: '#fbbf24', glow: '#fef3c7', flame: '#ea580c' }, // Industrial Amber
  { suit: '#134e4a', visor: '#2dd4bf', glow: '#ccfbf1', flame: '#0d9488' }, // Marine Teal
  { suit: '#7f1d1d', visor: '#f87171', glow: '#fee2e2', flame: '#ef4444' }, // Hazard Red
];

function RemoteAvatar({ player, renderRef }: { player: PlayerRenderPose; renderRef: MutableRefObject<YardRender | null> }) {
  const root = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const toolRef = useRef<THREE.Group>(null);
  const drivingArmsRef = useRef<THREE.Group>(null);
  const jetpackRef = useRef<THREE.Group>(null);
  const leftFlame = useRef<THREE.Mesh>(null);
  const rightFlame = useRef<THREE.Mesh>(null);

  const colors = PLAYER_COLORS[player.slot % PLAYER_COLORS.length]!;

  useFrame(() => {
    if (!root.current) return;
    const current = renderRef.current?.players.find((p) => p.slot === player.slot);
    if (!current) return;

    const isRiding = Boolean(current.ridingVehicle);

    root.current.position.set(current.position[0], current.position[1], current.position[2]);
    root.current.rotation.y = current.yaw;

    if (bodyRef.current) {
      bodyRef.current.position.y = isRiding ? 0.32 : 0.75;
      bodyRef.current.scale.set(1, isRiding ? 0.75 : 1.0, 1);
    }

    if (head.current) {
      head.current.position.y = isRiding ? 0.82 : 1.45;
      head.current.rotation.x = isRiding ? 0.05 : current.pitch;
    }

    if (toolRef.current) {
      toolRef.current.visible = !isRiding;
    }

    if (drivingArmsRef.current) {
      drivingArmsRef.current.visible = isRiding;
    }

    if (jetpackRef.current) {
      jetpackRef.current.position.y = isRiding ? 0.45 : 0.82;
      jetpackRef.current.position.z = isRiding ? -0.18 : -0.26;
    }

    const flameScale = (!isRiding && current.jetpackActive) ? 0.8 + Math.random() * 0.4 : 0;
    if (leftFlame.current) {
      leftFlame.current.scale.set(flameScale, flameScale, flameScale);
      leftFlame.current.visible = !isRiding && current.jetpackActive;
    }
    if (rightFlame.current) {
      rightFlame.current.scale.set(flameScale, flameScale, flameScale);
      rightFlame.current.visible = !isRiding && current.jetpackActive;
    }
  });

  return (
    <group ref={root} position={player.position}>
      {/* Body / Suit (adapts between standing and seated driving posture) */}
      <mesh ref={bodyRef} position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.65, 8, 16]} />
        <Toon color={colors.suit} />
      </mesh>

      {/* Head and Visor with pitch tilt */}
      <group ref={head} position={[0, 1.45, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 16, 16]} />
          <Toon color="#1e293b" />
        </mesh>
        {/* Glowing Visor */}
        <mesh position={[0, 0.04, 0.16]}>
          <boxGeometry args={[0.28, 0.16, 0.14]} />
          <meshBasicMaterial
            color={colors.glow}
            toneMapped={false}
          />
        </mesh>

        {/* Held tool (in direction of pitch, hidden while driving) */}
        <group ref={toolRef} position={[0.34, -0.22, 0.35]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.45, 8]} />
            <Toon color="#334155" />
          </mesh>
          <mesh position={[0, 0, 0.24]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial
              color={player.activeTool === 'torch' ? '#ea580c' : '#0891b2'}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>

      {/* Driving Arms (reaching forward to hold steering wheel when riding) */}
      <group ref={drivingArmsRef} visible={false}>
        <mesh position={[-0.20, 0.48, 0.22]} rotation={[0.42, 0.2, -0.15]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.42, 8]} />
          <Toon color={colors.suit} />
        </mesh>
        <mesh position={[0.20, 0.48, 0.22]} rotation={[0.42, -0.2, 0.15]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.42, 8]} />
          <Toon color={colors.suit} />
        </mesh>
      </group>

      {/* Jetpack Module on back */}
      <group ref={jetpackRef} position={[0, 0.82, -0.26]}>
        <mesh castShadow>
          <boxGeometry args={[0.38, 0.46, 0.16]} />
          <Toon color="#475569" />
        </mesh>
        {/* Left Thruster Nozzle */}
        <mesh position={[-0.14, -0.26, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.12, 8]} />
          <Toon color="#1e293b" />
        </mesh>
        {/* Right Thruster Nozzle */}
        <mesh position={[0.14, -0.26, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.12, 8]} />
          <Toon color="#1e293b" />
        </mesh>
        {/* Thruster Flames */}
        <mesh ref={leftFlame} position={[-0.14, -0.42, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.08, 0.35, 8]} />
          <meshBasicMaterial color={colors.flame} transparent opacity={0.85} />
        </mesh>
        <mesh ref={rightFlame} position={[0.14, -0.42, 0]} rotation={[Math.PI, 0, 0]} visible={false}>
          <coneGeometry args={[0.08, 0.35, 8]} />
          <meshBasicMaterial color={colors.flame} transparent opacity={0.85} />
        </mesh>
      </group>
    </group>
  );
}

export function PlayerAvatars({ renderRef, tool }: { renderRef: MutableRefObject<YardRender | null>; tool?: string }) {
  const render = renderRef.current;
  if (!render || !render.players) return null;

  // In orbit camera mode, render all players including local player so they can see themselves driving!
  const visiblePlayers = tool === 'orbit'
    ? render.players
    : render.players.filter((p) => p.slot !== render.localSlot);

  return (
    <>
      {visiblePlayers.map((player) => (
        <RemoteAvatar key={player.slot} player={player} renderRef={renderRef} />
      ))}
    </>
  );
}
