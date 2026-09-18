import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { UiTool } from './PointerInput';
import type { YardRender } from './presentation';

const noRaycast = () => null;

export function FirstPersonTool({
  tool,
  renderRef,
}: {
  tool: UiTool;
  renderRef: React.MutableRefObject<YardRender | null>;
}) {
  const { camera } = useThree();
  const root = useRef<THREE.Group>(null);

  // Gravity Gun Refs
  const coreInnerRef = useRef<THREE.Mesh>(null);
  const coreOuterRef = useRef<THREE.Mesh>(null);
  const coreLightRef = useRef<THREE.PointLight>(null);
  const rotorRing1 = useRef<THREE.Group>(null);
  const rotorRing2 = useRef<THREE.Group>(null);
  const prongGroup = useRef<THREE.Group>(null);
  const clawTop = useRef<THREE.Group>(null);
  const clawLeft = useRef<THREE.Group>(null);
  const clawRight = useRef<THREE.Group>(null);

  // Torch Refs
  const torchLightRef = useRef<THREE.PointLight>(null);
  const innerFlameRef = useRef<THREE.Mesh>(null);
  const outerFlameRef = useRef<THREE.Mesh>(null);
  const pilotFlameRef = useRef<THREE.Mesh>(null);
  const nozzleGlowRef = useRef<THREE.Mesh>(null);

  // Cockpit Refs
  const steeringWheelRef = useRef<THREE.Group>(null);

  // Dynamic animation states
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
    const isRiding = Boolean(localPlayer?.ridingVehicle);

    // Calculate rotational camera velocity for spring sway
    const rotDeltaX = camera.rotation.y - prevCameraRot.current.y;
    const rotDeltaY = camera.rotation.x - prevCameraRot.current.x;
    prevCameraRot.current.copy(camera.rotation);

    swayX.current = THREE.MathUtils.lerp(swayX.current, -rotDeltaX * 0.14, delta * 12);
    swayY.current = THREE.MathUtils.lerp(swayY.current, rotDeltaY * 0.14, delta * 12);

    // Walking / flying bob based on position displacement
    let speed = 0;
    if (localPlayer) {
      const dx = localPlayer.position[0] - prevPlayerPos.current.x;
      const dz = localPlayer.position[2] - prevPlayerPos.current.z;
      speed = Math.hypot(dx, dz);
      prevPlayerPos.current.set(localPlayer.position[0], localPlayer.position[1], localPlayer.position[2]);
    }
    const isMoving = speed > 0.003 || Boolean(localPlayer?.jetpackActive);
    bobTime.current += delta * (isMoving ? 10 : 2.5);

    // Natural figure-8 weapon bob
    const bobX = Math.sin(bobTime.current * 0.5) * (isMoving ? 0.007 : 0.0015);
    const bobY = Math.abs(Math.cos(bobTime.current)) * (isMoving ? 0.009 : 0.002);

    // Spring recoil recovery
    recoil.current = THREE.MathUtils.lerp(recoil.current, 0, delta * 14);

    // Compute viewmodel world position: offset relative to camera
    camera.getWorldDirection(forward.current);
    right.current.crossVectors(forward.current, camera.up).normalize();
    up.current.crossVectors(right.current, forward.current).normalize();

    // Natural first-person stance: offset slightly lower-right
    const stanceX = isRiding ? 0 : 0.24 + bobX + swayX.current;
    const stanceY = isRiding ? -0.16 : -0.20 - bobY + swayY.current;
    const stanceZ = isRiding ? 0.28 : 0.44 - recoil.current;

    toolPos.current
      .copy(camera.position)
      .addScaledVector(right.current, stanceX)
      .addScaledVector(up.current, stanceY)
      .addScaledVector(forward.current, stanceZ);

    root.current.position.copy(toolPos.current);
    root.current.quaternion.copy(camera.quaternion);

    // =========================================================================
    // GRAVITY GUN DYNAMICS
    // =========================================================================
    if (tool === 'hand') {
      const spinRate = isGrabbing ? 14 : 3.5;
      if (rotorRing1.current) rotorRing1.current.rotation.z += delta * spinRate;
      if (rotorRing2.current) rotorRing2.current.rotation.z -= delta * spinRate * 1.25;

      // Plasma Core Pulsing
      const time = state.clock.elapsedTime;
      if (coreInnerRef.current) {
        const pulse = isGrabbing ? 1.25 + Math.sin(time * 24) * 0.25 : 1.0 + Math.sin(time * 6) * 0.08;
        coreInnerRef.current.scale.set(pulse, pulse, pulse);
      }
      if (coreOuterRef.current) {
        const pulseOuter = isGrabbing ? 1.35 + Math.cos(time * 18) * 0.3 : 1.05 + Math.cos(time * 4) * 0.06;
        coreOuterRef.current.scale.set(pulseOuter, pulseOuter, pulseOuter);
      }
      if (coreLightRef.current) {
        coreLightRef.current.intensity = isGrabbing ? 4.5 + Math.random() * 0.6 : 0.9;
      }

      // Claw articulators: flare open when tractor lock engages
      const clawTarget = isGrabbing ? 1.35 : 1.0;
      if (clawTop.current) {
        clawTop.current.rotation.x = THREE.MathUtils.lerp(clawTop.current.rotation.x, isGrabbing ? -0.38 : -0.16, delta * 12);
      }
      if (clawLeft.current) {
        clawLeft.current.rotation.z = THREE.MathUtils.lerp(clawLeft.current.rotation.z, isGrabbing ? -0.52 : -0.28, delta * 12);
      }
      if (clawRight.current) {
        clawRight.current.rotation.z = THREE.MathUtils.lerp(clawRight.current.rotation.z, isGrabbing ? 0.52 : 0.28, delta * 12);
      }
      if (prongGroup.current) {
        prongGroup.current.scale.lerp(new THREE.Vector3(clawTarget, clawTarget, clawTarget), delta * 12);
      }
    }

    // =========================================================================
    // OXY-ACETYLENE TORCH DYNAMICS
    // =========================================================================
    if (tool === 'torch') {
      const flameActive = isTorching;
      if (innerFlameRef.current && outerFlameRef.current) {
        innerFlameRef.current.visible = flameActive;
        outerFlameRef.current.visible = flameActive;
        if (flameActive) {
          const jitter = 0.88 + Math.random() * 0.24;
          innerFlameRef.current.scale.set(jitter, 1.0 + Math.random() * 0.15, jitter);
          outerFlameRef.current.scale.set(jitter * 1.15, 1.0 + Math.random() * 0.35, jitter * 1.15);
        }
      }
      if (pilotFlameRef.current) {
        const pilotPulse = 0.9 + Math.sin(state.clock.elapsedTime * 15) * 0.15;
        pilotFlameRef.current.scale.set(pilotPulse, pilotPulse, pilotPulse);
      }
      if (nozzleGlowRef.current) {
        // High heat emissive surge
        const mat = nozzleGlowRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = flameActive ? 5.5 : 1.8;
      }
      if (torchLightRef.current) {
        torchLightRef.current.intensity = flameActive ? 6.5 + Math.random() * 1.2 : 0.5;
      }
    }

    // =========================================================================
    // VEHICLE COCKPIT STEERING
    // =========================================================================
    if (isRiding && steeringWheelRef.current) {
      const steer = swayX.current * 4.5;
      steeringWheelRef.current.rotation.z = THREE.MathUtils.lerp(steeringWheelRef.current.rotation.z, steer, delta * 15);
    }
  });

  if (tool === 'orbit') return null;

  const render = renderRef.current;
  const localPlayer = render?.players?.find((p) => p.slot === render?.localSlot);
  const isRiding = Boolean(localPlayer?.ridingVehicle);

  return (
    <group ref={root}>
      {/* Subtle Dedicated Studio Rim Light to make metallic bevels and textures pop */}
      <pointLight position={[0.25, 0.35, 0.1]} intensity={0.9} distance={1.4} color="#ffffff" />

      {isRiding ? (
        // =========================================================================
        // AAA TEARDOWN INDUSTRIAL BUGGY DRIVING COCKPIT
        // =========================================================================
        <group position={[0, -0.16, -0.22]}>
          {/* Main Curved Dashboard Console */}
          <mesh position={[0, -0.12, 0.06]}>
            <boxGeometry args={[0.74, 0.16, 0.32]} />
            <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh position={[0, -0.04, 0.20]}>
            <boxGeometry args={[0.72, 0.04, 0.08]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>

          {/* Heavy Tubular Steel Roll Cage Framing Viewport */}
          <mesh position={[-0.34, 0.22, 0]} rotation={[0.18, 0, -0.18]}>
            <cylinderGeometry args={[0.024, 0.024, 0.7, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0.34, 0.22, 0]} rotation={[0.18, 0, 0.18]}>
            <cylinderGeometry args={[0.024, 0.024, 0.7, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.48, 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.024, 0.024, 0.68, 12]} />
            <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.85} />
          </mesh>

          {/* Steering Column Assembly */}
          <mesh position={[0, -0.04, 0.16]} rotation={[-0.55, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.24, 16]} />
            <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.7} />
          </mesh>

          {/* 3-Spoke Perforated Leather Rally Steering Wheel */}
          <group ref={steeringWheelRef} position={[0, 0.04, 0.25]} rotation={[-0.55, 0, 0]}>
            {/* Outer Rim */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.135, 0.018, 16, 32]} />
              <meshStandardMaterial color="#09090b" roughness={0.88} />
            </mesh>
            {/* Red 12-o'clock centering stripe */}
            <mesh position={[0, 0.135, 0]}>
              <boxGeometry args={[0.035, 0.03, 0.035]} />
              <meshStandardMaterial color="#ef4444" roughness={0.4} />
            </mesh>
            {/* Milled Brushed Aluminum Spokes */}
            <mesh>
              <boxGeometry args={[0.25, 0.022, 0.012]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
            </mesh>
            <mesh position={[0, -0.065, 0]}>
              <boxGeometry args={[0.022, 0.13, 0.012]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.9} />
            </mesh>
            {/* Central Boss & Horn */}
            <mesh position={[0, 0, 0.01]}>
              <cylinderGeometry args={[0.034, 0.034, 0.016, 24]} />
              <meshStandardMaterial color="#18181b" roughness={0.4} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.02]}>
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
            </mesh>
          </group>

          {/* Backlit Instrument Cluster (Speedometer & Turbo Boost Gauge) */}
          <mesh position={[-0.14, -0.03, 0.13]} rotation={[-0.55, 0, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.012, 20]} />
            <meshStandardMaterial color="#0284c7" emissive="#0284c7" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[0.14, -0.03, 0.13]} rotation={[-0.55, 0, 0]}>
            <cylinderGeometry args={[0.036, 0.036, 0.012, 20]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={1.2} />
          </mesh>

          {/* Dashboard Toggle Switches */}
          {[-0.05, 0, 0.05].map((x, i) => (
            <mesh key={`sw-${i}`} position={[x, -0.05, 0.14]} rotation={[-0.3, 0, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.025, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ) : tool === 'hand' ? (
        // =========================================================================
        // SPIDER-VERSE / MOEBIUS ANGULAR SCI-FI GRAVITY TRACTOR
        // =========================================================================
        <group rotation={[0.07, -0.06, 0]}>
          {/* Main Angular Matte Graphite Receiver Chassis */}
          <mesh castShadow position={[0, 0.01, -0.09]}>
            <boxGeometry args={[0.098, 0.118, 0.34]} />
            <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* Fine Pen Ink Outline Shell */}
          <mesh position={[0, 0.01, -0.09]} raycast={noRaycast}>
            <boxGeometry args={[0.104, 0.124, 0.346]} />
            <meshBasicMaterial color="#020617" side={THREE.BackSide} />
          </mesh>

          {/* Upper Heat-Sink / Angular Fin Racks */}
          {[-0.14, -0.10, -0.06, -0.02, 0.02].map((z, idx) => (
            <mesh key={`fin-${idx}`} position={[0, 0.074, z]}>
              <boxGeometry args={[0.092, 0.014, 0.018]} />
              <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.85} />
            </mesh>
          ))}

          {/* Electric Cyan Neon Power Conduit Rails */}
          <mesh position={[0.051, 0.025, -0.08]}>
            <boxGeometry args={[0.006, 0.024, 0.24]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={4.8} toneMapped={false} />
          </mesh>
          <mesh position={[-0.051, 0.025, -0.08]}>
            <boxGeometry args={[0.006, 0.024, 0.24]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={4.8} toneMapped={false} />
          </mesh>

          {/* Ergonomic Molded Pistol Grip with Finger Grooves */}
          <mesh position={[0, -0.10, 0.05]} rotation={[-0.26, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.026, 0.15, 16]} />
            <meshStandardMaterial color="#09090b" roughness={0.92} />
          </mesh>
          {/* Electric Cyan Mechanical Trigger */}
          <mesh position={[0, -0.065, 0.01]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.010, 0.034, 0.014]} />
            <meshStandardMaterial color="#06b6d4" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.085, 0.0]}>
            <torusGeometry args={[0.028, 0.004, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#020617" metalness={0.7} />
          </mesh>

          {/* Glowing Vacuum Tubes with Cyan Plasma Filaments */}
          {[-0.022, 0.022].map((x, idx) => (
            <group key={`tube-${idx}`} position={[x, 0.082, -0.04]}>
              {/* Glass Envelope */}
              <mesh>
                <cylinderGeometry args={[0.013, 0.013, 0.042, 16]} />
                <meshStandardMaterial
                  color="#cffafe"
                  roughness={0.05}
                  metalness={0.1}
                  transparent
                  opacity={0.45}
                />
              </mesh>
              {/* Glowing Cyan Plasma Filament */}
              <mesh position={[0, 0.002, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.028, 8]} />
                <meshStandardMaterial
                  color="#00f0ff"
                  emissive="#00f0ff"
                  emissiveIntensity={5.5}
                  toneMapped={false}
                />
              </mesh>
              {/* Ceramic Base */}
              <mesh position={[0, -0.022, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.008, 16]} />
                <meshStandardMaterial color="#1e293b" roughness={0.6} />
              </mesh>
            </group>
          ))}

          {/* High-Tech Induction Coils */}
          {[-0.10, -0.02].map((z, idx) => (
            <mesh key={`coil-${idx}`} position={[0, 0.01, z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.062, 0.008, 12, 28]} />
              <meshStandardMaterial color="#38bdf8" roughness={0.25} metalness={0.9} emissive="#0284c7" emissiveIntensity={1.2} />
            </mesh>
          ))}

          {/* Rear Digital Diagnostic HUD Display (Faces Player) */}
          <group position={[0, 0.045, 0.082]} rotation={[-0.2, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.068, 0.040, 0.008]} />
              <meshStandardMaterial color="#020617" roughness={0.7} />
            </mesh>
            {/* Glowing CRT Screen */}
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={[0.058, 0.030]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#0284c7"
                emissiveIntensity={2.5}
                toneMapped={false}
              />
            </mesh>
            {/* Status Indicator LED Diodes */}
            <mesh position={[-0.022, 0.012, 0.006]}>
              <sphereGeometry args={[0.003, 8, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={3.0} />
            </mesh>
            <mesh position={[0.022, 0.012, 0.006]}>
              <sphereGeometry args={[0.003, 8, 8]} />
              <meshStandardMaterial color="#f97316" emissive="#f97316" emissiveIntensity={3.0} />
            </mesh>
          </group>

          {/* High-Current Braided Copper Induction Coils */}
          <mesh position={[0, -0.015, -0.03]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.048, 0.048, 0.11, 20]} />
            <meshStandardMaterial color="#d97706" roughness={0.25} metalness={0.95} />
          </mesh>
          <mesh position={[0, -0.015, -0.15]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.048, 0.048, 0.11, 20]} />
            <meshStandardMaterial color="#d97706" roughness={0.25} metalness={0.95} />
          </mesh>

          {/* Toughened Quartz Glass Containment Chamber Tube */}
          <mesh position={[0, 0.01, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.043, 0.043, 0.12, 20]} />
            <meshStandardMaterial
              color="#e0f2fe"
              roughness={0.05}
              metalness={0.1}
              transparent
              opacity={0.35}
            />
          </mesh>

          {/* Dual Counter-Rotating Magnetic Resonance Rings */}
          <group ref={rotorRing1} position={[0, 0.01, -0.08]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.049, 0.005, 12, 24]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={2.2} metalness={0.9} />
            </mesh>
          </group>
          <group ref={rotorRing2} position={[0, 0.01, -0.16]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.049, 0.005, 12, 24]} />
              <meshStandardMaterial color="#f97316" emissive="#ea580c" emissiveIntensity={2.2} metalness={0.9} />
            </mesh>
          </group>

          {/* Concentric Dual-Stage Glowing Plasma Core */}
          <mesh ref={coreInnerRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.024, 20, 20]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#38bdf8"
              emissiveIntensity={5.0}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={coreOuterRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.038, 20, 20]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#ea580c"
              emissiveIntensity={3.2}
              transparent
              opacity={0.8}
              toneMapped={false}
            />
          </mesh>
          <pointLight ref={coreLightRef} position={[0, 0.01, -0.12]} distance={3.2} color="#f59e0b" />

          {/* 3 Heavy Articulating Industrial Claws with Hydraulic Cylinders */}
          <group ref={prongGroup} position={[0, 0.01, -0.27]}>
            {/* Top Claw Assembly */}
            <group ref={clawTop} position={[0, 0.045, 0]} rotation={[-0.18, 0, 0]}>
              {/* Hydraulic Piston Barrel */}
              <mesh position={[0, 0.02, -0.04]}>
                <cylinderGeometry args={[0.008, 0.008, 0.08, 12]} />
                <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.9} />
              </mesh>
              {/* Knuckle Joint */}
              <mesh position={[0, 0.025, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
              </mesh>
              {/* Beveled Titanium Talon */}
              <mesh position={[0, 0.02, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.85} />
              </mesh>
              {/* Emitter Tip Lens */}
              <mesh position={[0, 0.028, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={4.2} toneMapped={false} />
              </mesh>
            </group>

            {/* Bottom Left Claw Assembly */}
            <group ref={clawLeft} position={[-0.042, -0.035, 0]} rotation={[0.15, -0.15, -0.32]}>
              <mesh position={[0, 0.015, -0.04]}>
                <cylinderGeometry args={[0.008, 0.008, 0.08, 12]} />
                <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.9} />
              </mesh>
              <mesh position={[0, 0.02, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
              </mesh>
              <mesh position={[0, 0.015, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <meshStandardMaterial color="#1e242b" roughness={0.3} metalness={0.85} />
              </mesh>
              <mesh position={[0, 0.022, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={4.2} toneMapped={false} />
              </mesh>
            </group>

            {/* Bottom Right Claw Assembly */}
            <group ref={clawRight} position={[0.042, -0.035, 0]} rotation={[0.15, 0.15, 0.32]}>
              <mesh position={[0, 0.015, -0.04]}>
                <cylinderGeometry args={[0.008, 0.008, 0.08, 12]} />
                <meshStandardMaterial color="#475569" roughness={0.3} metalness={0.9} />
              </mesh>
              <mesh position={[0, 0.02, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.2} metalness={0.95} />
              </mesh>
              <mesh position={[0, 0.015, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <meshStandardMaterial color="#1e242b" roughness={0.3} metalness={0.85} />
              </mesh>
              <mesh position={[0, 0.022, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={4.2} toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      ) : (
        // =========================================================================
        // SPIDER-VERSE / MOEBIUS ANGULAR SCI-FI PLASMA CUTTER
        // =========================================================================
        <group rotation={[0.06, -0.08, 0]}>
          {/* Main Angular Matte Graphite Chassis */}
          <mesh castShadow position={[0, -0.01, 0.0]}>
            <boxGeometry args={[0.048, 0.074, 0.28]} />
            <meshStandardMaterial color="#0f172a" roughness={0.32} metalness={0.85} />
          </mesh>
          {/* Fine Comic Ink Outline Shell */}
          <mesh position={[0, -0.01, 0.0]} raycast={noRaycast}>
            <boxGeometry args={[0.054, 0.080, 0.286]} />
            <meshBasicMaterial color="#020617" side={THREE.BackSide} />
          </mesh>

          {/* Electric Cyan Neon Power Conduit Running Along Top Spine */}
          <mesh position={[0, 0.032, 0.0]}>
            <boxGeometry args={[0.014, 0.012, 0.26]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={5.2} toneMapped={false} />
          </mesh>

          {/* Lateral Electric Cyan Accent Insets */}
          <mesh position={[0.025, -0.005, 0.02]}>
            <boxGeometry args={[0.004, 0.020, 0.18]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={4.8} toneMapped={false} />
          </mesh>
          <mesh position={[-0.025, -0.005, 0.02]}>
            <boxGeometry args={[0.004, 0.020, 0.18]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={4.8} toneMapped={false} />
          </mesh>

          {/* Tactical Angled Ergonomic Grip */}
          <mesh position={[0, -0.09, 0.06]} rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[0.036, 0.12, 0.042]} />
            <meshStandardMaterial color="#1e293b" roughness={0.88} />
          </mesh>
          <mesh position={[0, -0.055, 0.03]} rotation={[-0.32, 0, 0]}>
            <boxGeometry args={[0.010, 0.028, 0.012]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={4.0} toneMapped={false} />
          </mesh>

          {/* Forward Angled Shroud / Recessed Heat-Sink Barrel */}
          <mesh position={[0, 0.005, -0.18]} rotation={[0.06, 0, 0]}>
            <boxGeometry args={[0.038, 0.054, 0.14]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.9} />
          </mesh>
          {/* Shroud Outline Shell */}
          <mesh position={[0, 0.005, -0.18]} rotation={[0.06, 0, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.044, 0.060, 0.144]} />
            <meshBasicMaterial color="#020617" side={THREE.BackSide} />
          </mesh>

          {/* Cyan Recessed Barrel Heat Vents */}
          {[-0.22, -0.18, -0.14].map((z, idx) => (
            <mesh key={`vent-${idx}`} position={[0, 0.034, z]}>
              <boxGeometry args={[0.026, 0.006, 0.014]} />
              <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={3.5} toneMapped={false} />
            </mesh>
          ))}

          {/* Heat Temper Gradient Rings (Heat Discoloration Blue/Purple) */}
          <mesh position={[0, 0.005, -0.28]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.0145, 0.0145, 0.03, 16]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.008, -0.31]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.03, 16]} />
            <meshStandardMaterial color="#8b5cf6" roughness={0.2} metalness={0.9} />
          </mesh>

          {/* Incandescent Ceramic Nozzle Collar with Cyan Pre-Ionization */}
          <mesh ref={nozzleGlowRef} position={[0, 0.014, -0.35]}>
            <cylinderGeometry args={[0.017, 0.022, 0.055, 20]} />
            <meshStandardMaterial
              color="#00f0ff"
              emissive="#00f0ff"
              emissiveIntensity={2.8}
              roughness={0.2}
            />
          </mesh>

          {/* Idle Pilot Plasma Arc (Electric Cyan Bead) */}
          <mesh ref={pilotFlameRef} position={[0, 0.014, -0.40]}>
            <sphereGeometry args={[0.009, 12, 12]} />
            <meshStandardMaterial color="#00f0ff" emissive="#00f0ff" emissiveIntensity={5.0} toneMapped={false} />
          </mesh>

          {/* Multi-Stage Active Cutting Flame: Intense White/Blue Core + Fiery Plume */}
          <mesh ref={innerFlameRef} position={[0, 0.014, -0.56]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.006, 0.018, 0.38, 10]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <mesh ref={outerFlameRef} position={[0, 0.014, -0.74]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
            <cylinderGeometry args={[0.012, 0.042, 0.72, 12]} />
            <meshStandardMaterial
              color="#ffedd5"
              emissive="#f97316"
              emissiveIntensity={6.0}
              transparent
              opacity={0.88}
              toneMapped={false}
            />
          </mesh>

          {/* Dynamic Light Cast onto Environment Voxels */}
          <pointLight ref={torchLightRef} position={[0, 0.014, -0.76]} distance={9.0} color="#f97316" />
        </group>
      )}
    </group>
  );
}
