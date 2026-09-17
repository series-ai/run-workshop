import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { UiTool } from './PointerInput';
import type { YardRender } from './presentation';

export function FirstPersonTool({
  tool,
  renderRef,
}: {
  tool: UiTool;
  renderRef: React.MutableRefObject<YardRender | null>;
}) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const prongGroup = useRef<THREE.Group>(null);

  const recoil = useRef(0);
  const bobTime = useRef(0);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3());
  const toolPos = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    if (!root.current || tool === 'orbit') return;

    const render = renderRef.current;
    const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
    const isGrabbing = Boolean(localPlayer?.grabbing);
    const isTorching = Boolean(localPlayer?.torching);

    // Weapon sway / bobbing based on movement
    bobTime.current += delta * 8;
    const bobX = Math.sin(bobTime.current * 0.5) * 0.006;
    const bobY = Math.abs(Math.cos(bobTime.current)) * 0.008;

    // Recoil recovery
    recoil.current = THREE.MathUtils.lerp(recoil.current, 0, delta * 12);

    // Compute viewmodel world position: offset relative to camera
    camera.getWorldDirection(forward.current);
    right.current.crossVectors(forward.current, camera.up).normalize();
    up.current.crossVectors(right.current, forward.current).normalize();

    // Default right-hand stance: [0.26, -0.22, 0.48]
    toolPos.current
      .copy(camera.position)
      .addScaledVector(right.current, 0.24 + bobX)
      .addScaledVector(up.current, -0.20 - bobY)
      .addScaledVector(forward.current, 0.44 - recoil.current);

    root.current.position.copy(toolPos.current);
    root.current.quaternion.copy(camera.quaternion);

    // Animate Gravity Gun core pulsation
    if (coreRef.current) {
      const pulse = isGrabbing ? 1.5 + Math.sin(state.clock.elapsedTime * 18) * 0.4 : 1.0;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    // Prong twitch when grabbing
    if (prongGroup.current) {
      const open = isGrabbing ? 1.25 : 1.0;
      prongGroup.current.scale.set(open, open, open);
    }

    // Cutting beam visibility
    if (beamRef.current) {
      beamRef.current.visible = tool === 'torch' && isTorching;
      if (beamRef.current.visible) {
        beamRef.current.scale.set(
          1.0 + Math.random() * 0.3,
          1.0,
          1.0 + Math.random() * 0.3,
        );
      }
    }
  });

  if (tool === 'orbit') return null;

  return (
    <group ref={root}>
      {tool === 'hand' ? (
        // --- GRAVITY CLAMP / SALVAGE TRACTOR VIEWMODEL ---
        <group rotation={[0.08, -0.05, 0]}>
          {/* Main Heavy Cast Iron Chassis */}
          <mesh castShadow position={[0, 0, -0.1]}>
            <boxGeometry args={[0.095, 0.115, 0.35]} />
            <meshStandardMaterial color="#2d2926" roughness={0.7} metalness={0.65} />
          </mesh>
          {/* Olive Drab Reinforced Armor Casing Plate */}
          <mesh position={[0, 0.045, -0.1]}>
            <boxGeometry args={[0.105, 0.04, 0.26]} />
            <meshStandardMaterial color="#3e4836" roughness={0.8} metalness={0.2} />
          </mesh>
          {/* Copper Induction Windings / Coils */}
          <mesh position={[0, -0.02, -0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.11, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0, -0.02, -0.16]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.11, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.35} metalness={0.85} />
          </mesh>
          {/* Amber Plasma Containment Core */}
          <mesh ref={coreRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.038, 16, 16]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#d97706"
              emissiveIntensity={2.5}
              roughness={0.1}
            />
          </mesh>
          {/* 3 Heavy Salvage Articulating Claw Prongs */}
          <group ref={prongGroup} position={[0, 0, -0.28]}>
            {/* Top Clamp Jaw */}
            <mesh position={[0, 0.055, -0.06]} rotation={[-0.22, 0, 0]}>
              <boxGeometry args={[0.022, 0.025, 0.13]} />
              <meshStandardMaterial color="#524c46" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.07, -0.12]}>
              <sphereGeometry args={[0.013, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.0} />
            </mesh>

            {/* Bottom Left Clamp Jaw */}
            <mesh position={[-0.048, -0.042, -0.06]} rotation={[0.16, -0.16, -0.42]}>
              <boxGeometry args={[0.022, 0.025, 0.13]} />
              <meshStandardMaterial color="#524c46" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[-0.058, -0.052, -0.12]}>
              <sphereGeometry args={[0.013, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.0} />
            </mesh>

            {/* Bottom Right Clamp Jaw */}
            <mesh position={[0.048, -0.042, -0.06]} rotation={[0.16, 0.16, 0.42]}>
              <boxGeometry args={[0.022, 0.025, 0.13]} />
              <meshStandardMaterial color="#524c46" metalness={0.85} roughness={0.3} />
            </mesh>
            <mesh position={[0.058, -0.052, -0.12]}>
              <sphereGeometry args={[0.013, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.0} />
            </mesh>
          </group>
        </group>
      ) : (
        // --- OXY-PLASMA CUTTING TORCH VIEWMODEL ---
        <group rotation={[0.06, -0.08, 0]}>
          {/* Brass Main Torch Handle */}
          <mesh castShadow position={[0, -0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.026, 0.28, 16]} />
            <meshStandardMaterial color="#a16207" roughness={0.45} metalness={0.75} />
          </mesh>
          {/* Dual Gas Feed Knobs (Red Acetylene & Green Oxygen) */}
          <mesh position={[-0.035, -0.02, 0.12]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
            <meshStandardMaterial color="#991b1b" roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh position={[0.035, -0.02, 0.12]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.02, 12]} />
            <meshStandardMaterial color="#166534" roughness={0.6} metalness={0.3} />
          </mesh>
          {/* High-Pressure Heavy Steel Forward Barrel */}
          <mesh position={[0, -0.01, -0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.018, 0.22, 16]} />
            <meshStandardMaterial color="#44403c" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Incandescent Ceramic Nozzle Collar */}
          <mesh position={[0, -0.01, -0.3]}>
            <cylinderGeometry args={[0.02, 0.024, 0.04, 16]} />
            <meshStandardMaterial
              color="#ea580c"
              emissive="#ea580c"
              emissiveIntensity={2.8}
              roughness={0.3}
            />
          </mesh>
          {/* Fiery Cutting Plasma Jet Flame */}
          <mesh ref={beamRef} position={[0, -0.01, -0.6]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.008, 0.025, 0.6, 8]} />
            <meshStandardMaterial
              color="#ffedd5"
              emissive="#f97316"
              emissiveIntensity={4.5}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}
