import { useFrame } from '@react-three/fiber';
import { useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import type { YardRender, PlayerRenderPose } from './presentation';

const PLAYER_COLORS = [
  { suit: '#0284c7', visor: '#38bdf8', glow: '#7dd3fc', flame: '#38bdf8' }, // Cyan
  { suit: '#d97706', visor: '#fbbf24', glow: '#fde68a', flame: '#f59e0b' }, // Amber
  { suit: '#059669', visor: '#34d399', glow: '#a7f3d0', flame: '#10b981' }, // Emerald
  { suit: '#e11d48', visor: '#fb7185', glow: '#fecdd3', flame: '#f43f5e' }, // Rose
];

function RemoteAvatar({ player, renderRef }: { player: PlayerRenderPose; renderRef: MutableRefObject<YardRender | null> }) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const leftFlame = useRef<THREE.Mesh>(null);
  const rightFlame = useRef<THREE.Mesh>(null);

  const colors = PLAYER_COLORS[player.slot % PLAYER_COLORS.length]!;

  useFrame(() => {
    if (!root.current) return;
    const current = renderRef.current?.players.find((p) => p.slot === player.slot);
    if (!current) return;

    root.current.position.set(current.position[0], current.position[1], current.position[2]);
    root.current.rotation.y = current.yaw;

    if (head.current) {
      head.current.rotation.x = current.pitch;
    }

    const flameScale = current.jetpackActive ? 0.8 + Math.random() * 0.4 : 0;
    if (leftFlame.current) {
      leftFlame.current.scale.set(flameScale, flameScale, flameScale);
      leftFlame.current.visible = current.jetpackActive;
    }
    if (rightFlame.current) {
      rightFlame.current.scale.set(flameScale, flameScale, flameScale);
      rightFlame.current.visible = current.jetpackActive;
    }
  });

  return (
    <group ref={root} position={player.position}>
      {/* Body / Suit */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.65, 8, 16]} />
        <meshStandardMaterial color={colors.suit} roughness={0.6} metalness={0.2} />
      </mesh>

      {/* Head and Visor with pitch tilt */}
      <group ref={head} position={[0, 1.45, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* Glowing Visor */}
        <mesh position={[0, 0.04, 0.16]}>
          <boxGeometry args={[0.28, 0.16, 0.14]} />
          <meshStandardMaterial
            color={colors.visor}
            emissive={colors.glow}
            emissiveIntensity={0.8}
            roughness={0.1}
            metalness={0.8}
          />
        </mesh>

        {/* Held tool (in direction of pitch) */}
        <group position={[0.34, -0.22, 0.35]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.05, 0.45, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.24]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color={player.activeTool === 'torch' ? '#f97316' : '#06b6d4'}
              emissive={player.activeTool === 'torch' ? '#ea580c' : '#0891b2'}
              emissiveIntensity={1.2}
            />
          </mesh>
        </group>
      </group>

      {/* Jetpack Module on back */}
      <group position={[0, 0.82, -0.26]}>
        <mesh castShadow>
          <boxGeometry args={[0.38, 0.46, 0.16]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Left Thruster Nozzle */}
        <mesh position={[-0.14, -0.26, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.12, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.9} />
        </mesh>
        {/* Right Thruster Nozzle */}
        <mesh position={[0.14, -0.26, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.12, 8]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.9} />
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

export function PlayerAvatars({ renderRef }: { renderRef: MutableRefObject<YardRender | null> }) {
  const render = renderRef.current;
  if (!render || !render.players) return null;

  // Render remote players only (local player is in first-person camera)
  const remotes = render.players.filter((p) => p.slot !== render.localSlot);

  return (
    <>
      {remotes.map((player) => (
        <RemoteAvatar key={player.slot} player={player} renderRef={renderRef} />
      ))}
    </>
  );
}
