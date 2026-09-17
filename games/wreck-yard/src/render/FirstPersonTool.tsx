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
  const coreLightRef = useRef<THREE.PointLight>(null);
  const torchLightRef = useRef<THREE.PointLight>(null);
  const innerFlameRef = useRef<THREE.Mesh>(null);
  const outerFlameRef = useRef<THREE.Mesh>(null);
  const prongGroup = useRef<THREE.Group>(null);

  const recoil = useRef(0);
  const bobTime = useRef(0);
  const swayX = useRef(0);
  const swayY = useRef(0);
  const prevCameraRot = useRef(new THREE.Euler());
  const prevPlayerPos = useRef(new THREE.Vector3());

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

    // Calculate rotational camera velocity for spring sway
    const rotDeltaX = camera.rotation.y - prevCameraRot.current.y;
    const rotDeltaY = camera.rotation.x - prevCameraRot.current.x;
    prevCameraRot.current.copy(camera.rotation);

    swayX.current = THREE.MathUtils.lerp(swayX.current, -rotDeltaX * 0.12, delta * 10);
    swayY.current = THREE.MathUtils.lerp(swayY.current, rotDeltaY * 0.12, delta * 10);

    // Walking / flying bob based on position displacement
    let speed = 0;
    if (localPlayer) {
      const dx = localPlayer.position[0] - prevPlayerPos.current.x;
      const dz = localPlayer.position[2] - prevPlayerPos.current.z;
      speed = Math.hypot(dx, dz);
      prevPlayerPos.current.set(localPlayer.position[0], localPlayer.position[1], localPlayer.position[2]);
    }
    const isMoving = speed > 0.003 || Boolean(localPlayer?.jetpackActive);
    bobTime.current += delta * (isMoving ? 10 : 3);
    const bobX = Math.sin(bobTime.current * 0.5) * (isMoving ? 0.008 : 0.002);
    const bobY = Math.abs(Math.cos(bobTime.current)) * (isMoving ? 0.010 : 0.003);

    // Recoil recovery
    recoil.current = THREE.MathUtils.lerp(recoil.current, 0, delta * 14);

    // Compute viewmodel world position: offset relative to camera
    camera.getWorldDirection(forward.current);
    right.current.crossVectors(forward.current, camera.up).normalize();
    up.current.crossVectors(right.current, forward.current).normalize();

    // Natural lower-right first-person stance: [0.25, -0.22, 0.46]
    toolPos.current
      .copy(camera.position)
      .addScaledVector(right.current, 0.25 + bobX + swayX.current)
      .addScaledVector(up.current, -0.21 - bobY + swayY.current)
      .addScaledVector(forward.current, 0.46 - recoil.current);

    root.current.position.copy(toolPos.current);
    root.current.quaternion.copy(camera.quaternion);

    // Gravity Gun Core Pulsation & Dynamic Light
    if (coreRef.current) {
      const pulse = isGrabbing ? 1.35 + Math.sin(state.clock.elapsedTime * 20) * 0.35 : 1.0;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }
    if (coreLightRef.current) {
      coreLightRef.current.intensity = isGrabbing ? 4.2 : 0.8;
    }

    // Prong twitch when grabbing
    if (prongGroup.current) {
      const open = isGrabbing ? 1.25 : 1.0;
      prongGroup.current.scale.set(open, open, open);
    }

    // Blowtorch flame dynamic flickering & tip lighting
    const flameActive = tool === 'torch' && isTorching;
    if (innerFlameRef.current && outerFlameRef.current) {
      innerFlameRef.current.visible = flameActive;
      outerFlameRef.current.visible = flameActive;
      if (flameActive) {
        const jitter = 0.85 + Math.random() * 0.3;
        innerFlameRef.current.scale.set(jitter, 1.0, jitter);
        outerFlameRef.current.scale.set(jitter * 1.1, 1.0 + Math.random() * 0.2, jitter * 1.1);
      }
    }
    if (torchLightRef.current) {
      torchLightRef.current.intensity = flameActive ? 6.5 : 0.6;
    }
  });

  if (tool === 'orbit') return null;

  return (
    <group ref={root}>
      {tool === 'hand' ? (
        // =========================================================================
        // TEARDOWN-STYLE HEAVY INDUSTRIAL GRAVITY TRACTOR VIEWMODEL
        // =========================================================================
        <group rotation={[0.07, -0.06, 0]}>
          {/* Main Heavy Cast Steel Receiver */}
          <mesh castShadow position={[0, 0, -0.1]}>
            <boxGeometry args={[0.09, 0.11, 0.36]} />
            <meshStandardMaterial color="#1f242b" roughness={0.5} metalness={0.8} />
          </mesh>
          {/* Olive Drab Heavy Armor Shroud */}
          <mesh position={[0, 0.045, -0.08]}>
            <boxGeometry args={[0.102, 0.038, 0.26]} />
            <meshStandardMaterial color="#374151" roughness={0.7} metalness={0.4} />
          </mesh>
          {/* Ergonomic Textured Rubber Handle Grip */}
          <mesh position={[0, -0.09, 0.05]} rotation={[-0.25, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.024, 0.14, 12]} />
            <meshStandardMaterial color="#111827" roughness={0.9} />
          </mesh>
          {/* Dual Heavy Copper Magnetic Induction Coils */}
          <mesh position={[0, -0.02, -0.04]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.11, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.3} metalness={0.9} />
          </mesh>
          <mesh position={[0, -0.02, -0.16]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.042, 0.042, 0.11, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.3} metalness={0.9} />
          </mesh>
          {/* Amber Energy Core Sphere & Point Light */}
          <mesh ref={coreRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.036, 16, 16]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#ea580c"
              emissiveIntensity={3.2}
              roughness={0.1}
            />
          </mesh>
          <pointLight ref={coreLightRef} position={[0, 0.01, -0.12]} distance={2.5} color="#f59e0b" />

          {/* 3 Heavy Articulating Industrial Salvage Claws */}
          <group ref={prongGroup} position={[0, 0, -0.28]}>
            {/* Top Claw */}
            <mesh position={[0, 0.055, -0.06]} rotation={[-0.22, 0, 0]}>
              <boxGeometry args={[0.022, 0.026, 0.14]} />
              <meshStandardMaterial color="#4b5563" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.07, -0.13]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.5} />
            </mesh>

            {/* Bottom Left Claw */}
            <mesh position={[-0.048, -0.042, -0.06]} rotation={[0.16, -0.16, -0.42]}>
              <boxGeometry args={[0.022, 0.026, 0.14]} />
              <meshStandardMaterial color="#4b5563" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[-0.058, -0.052, -0.13]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.5} />
            </mesh>

            {/* Bottom Right Claw */}
            <mesh position={[0.048, -0.042, -0.06]} rotation={[0.16, 0.16, 0.42]}>
              <boxGeometry args={[0.022, 0.026, 0.14]} />
              <meshStandardMaterial color="#4b5563" metalness={0.9} roughness={0.25} />
            </mesh>
            <mesh position={[0.058, -0.052, -0.13]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={3.5} />
            </mesh>
          </group>
        </group>
      ) : (
        // =========================================================================
        // TEARDOWN-STYLE HEAVY INDUSTRIAL OXY-ACETYLENE BLOWTORCH
        // =========================================================================
        <group rotation={[0.06, -0.08, 0]}>
          {/* Heavy Machined Brass Torch Body */}
          <mesh castShadow position={[0, -0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.026, 0.28, 16]} />
            <meshStandardMaterial color="#b45309" roughness={0.35} metalness={0.85} />
          </mesh>
          {/* Dual Knurled Gas Needle Valves (Red Acetylene / Green Oxygen) */}
          <mesh position={[-0.035, -0.02, 0.11]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.022, 12]} />
            <meshStandardMaterial color="#dc2626" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0.035, -0.02, 0.11]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.016, 0.016, 0.022, 12]} />
            <meshStandardMaterial color="#16a34a" roughness={0.5} metalness={0.4} />
          </mesh>

          {/* Drooping Rubber Supply Hoses (Red & Green) Curving Off-Screen */}
          <mesh position={[-0.018, -0.14, 0.16]} rotation={[0.4, 0, 0.1]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#991b1b" roughness={0.8} />
          </mesh>
          <mesh position={[0.018, -0.14, 0.16]} rotation={[0.4, 0, -0.1]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#15803d" roughness={0.8} />
          </mesh>

          {/* Heavy Stainless Steel Torch Neck (Angled Forward) */}
          <mesh position={[0, -0.01, -0.18]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.018, 0.24, 16]} />
            <meshStandardMaterial color="#6b7280" roughness={0.25} metalness={0.9} />
          </mesh>

          {/* Incandescent Ceramic Nozzle Collar (Glowing Red-Hot) */}
          <mesh position={[0, 0.01, -0.32]}>
            <cylinderGeometry args={[0.018, 0.024, 0.05, 16]} />
            <meshStandardMaterial
              color="#ea580c"
              emissive="#ea580c"
              emissiveIntensity={3.5}
              roughness={0.2}
            />
          </mesh>

          {/* Teardown Dual-Cone Flame: Intense Blue/White Core + Fiery Orange Plume */}
          {/* White-Hot Blue Core Cone */}
          <mesh ref={innerFlameRef} position={[0, 0.01, -0.52]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.006, 0.018, 0.35, 8]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          {/* Fiery Orange Cutting Plume */}
          <mesh ref={outerFlameRef} position={[0, 0.01, -0.68]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.012, 0.038, 0.65, 8]} />
            <meshStandardMaterial
              color="#ffedd5"
              emissive="#f97316"
              emissiveIntensity={5.0}
              transparent
              opacity={0.85}
              toneMapped={false}
            />
          </mesh>

          {/* Dynamic Light Cast by the Cutting Flame onto Nearby Voxels */}
          <pointLight ref={torchLightRef} position={[0, 0.01, -0.7]} distance={8.0} color="#f97316" />
        </group>
      )}
    </group>
  );
}
