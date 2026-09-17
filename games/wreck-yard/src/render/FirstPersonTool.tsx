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
        // --- GRAVITY GUN VIEWMODEL ---
        <group rotation={[0.08, -0.05, 0]}>
          {/* Main Chassis */}
          <mesh castShadow position={[0, 0, -0.1]}>
            <boxGeometry args={[0.09, 0.11, 0.34]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Upper Heat Vents */}
          <mesh position={[0, 0.06, -0.1]}>
            <boxGeometry args={[0.07, 0.02, 0.22]} />
            <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.7} />
          </mesh>
          {/* Gravity Energy Core Sphere */}
          <mesh ref={coreRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.038, 16, 16]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={2.0}
              roughness={0.1}
            />
          </mesh>
          {/* 3 Forward Magnetic Prongs */}
          <group ref={prongGroup} position={[0, 0, -0.28]}>
            {/* Top Prong */}
            <mesh position={[0, 0.05, -0.06]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.018, 0.02, 0.12]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.065, -0.12]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.5} />
            </mesh>

            {/* Bottom Left Prong */}
            <mesh position={[-0.045, -0.04, -0.06]} rotation={[0.15, -0.15, -0.4]}>
              <boxGeometry args={[0.018, 0.02, 0.12]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[-0.055, -0.05, -0.12]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.5} />
            </mesh>

            {/* Bottom Right Prong */}
            <mesh position={[0.045, -0.04, -0.06]} rotation={[0.15, 0.15, 0.4]}>
              <boxGeometry args={[0.018, 0.02, 0.12]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0.055, -0.05, -0.12]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={2.5} />
            </mesh>
          </group>
        </group>
      ) : (
        // --- PLASMA TORCH VIEWMODEL ---
        <group rotation={[0.06, -0.04, 0]}>
          {/* Torch Barrel */}
          <mesh castShadow position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.032, 0.04, 0.32, 16]} />
            <meshStandardMaterial color="#292524" roughness={0.4} metalness={0.7} />
          </mesh>
          {/* Brass Collar */}
          <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.038, 0.038, 0.05, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.25} metalness={0.85} />
          </mesh>
          {/* Ceramic Nozzle */}
          <mesh position={[0, 0, -0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.03, 0.08, 16]} />
            <meshStandardMaterial
              color="#f97316"
              emissive="#ea580c"
              emissiveIntensity={1.2}
              roughness={0.2}
            />
          </mesh>
          {/* Cutting Plasma Laser Beam */}
          <mesh ref={beamRef} position={[0, 0, -3.2]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.02, 0.03, 5.8, 8]} />
            <meshBasicMaterial color="#ffedd5" transparent opacity={0.9} />
          </mesh>
        </group>
      )}
    </group>
  );
}
