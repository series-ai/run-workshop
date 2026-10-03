import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { Toon } from './style/toonMaterial';
import type { UiTool } from './keyBindings';
import { feedbackEffect, torchVisual } from './toolFeedback';
import type { YardRender } from './presentation';
import { lerpAngle } from '../sim/math';

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
  const pilotFlameRef = useRef<THREE.Mesh>(null);
  const nozzleGlowRef = useRef<THREE.Mesh>(null);

  // Dynamic animation states
  const recoil = useRef(0);
  const lastKickFrame = useRef(-1);
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
    const isRiding = Boolean(localPlayer?.ridingVehicle);
    root.current.visible = !isRiding;
    const follow = 1 - Math.exp(-12 * delta);
    const recover = 1 - Math.exp(-14 * delta);

    // Calculate rotational camera velocity for spring sway
    const rotDeltaX = lerpAngle(prevCameraRot.current.y, camera.rotation.y, 1) - prevCameraRot.current.y;
    const rotDeltaY = lerpAngle(prevCameraRot.current.x, camera.rotation.x, 1) - prevCameraRot.current.x;
    prevCameraRot.current.copy(camera.rotation);

    swayX.current = THREE.MathUtils.lerp(swayX.current, -rotDeltaX * 0.14, follow);
    swayY.current = THREE.MathUtils.lerp(swayY.current, rotDeltaY * 0.14, follow);

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

    // Kick the viewmodel once per new tool result; punts and throws kick hardest.
    const feedback = localPlayer?.feedback;
    if (feedback && feedback.frame !== lastKickFrame.current) {
      lastKickFrame.current = feedback.frame;
      recoil.current = Math.max(recoil.current, feedbackEffect(feedback.result).recoil);
    }
    // Spring recoil recovery
    recoil.current = THREE.MathUtils.lerp(recoil.current, 0, recover);

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
        clawTop.current.rotation.x = THREE.MathUtils.lerp(clawTop.current.rotation.x, isGrabbing ? -0.38 : -0.16, follow);
      }
      if (clawLeft.current) {
        clawLeft.current.rotation.z = THREE.MathUtils.lerp(clawLeft.current.rotation.z, isGrabbing ? -0.52 : -0.28, follow);
      }
      if (clawRight.current) {
        clawRight.current.rotation.z = THREE.MathUtils.lerp(clawRight.current.rotation.z, isGrabbing ? 0.52 : 0.28, follow);
      }
      if (prongGroup.current) {
        prongGroup.current.scale.setScalar(THREE.MathUtils.lerp(prongGroup.current.scale.x, clawTarget, follow));
      }
    }

    // =========================================================================
    // OXY-ACETYLENE TORCH DYNAMICS
    // =========================================================================
    if (tool === 'torch') {
      // A stream lights the nozzle and the scene; a fizzle (nothing in range) only sputters.
      const visual = render !== null ? torchVisual(localPlayer?.feedback ?? null, render.frame) : null;
      const sputter = visual === 'fizzle' && Math.random() < 0.6;
      if (pilotFlameRef.current) {
        const pilotPulse = 0.9 + Math.sin(state.clock.elapsedTime * 15) * 0.15;
        pilotFlameRef.current.scale.set(pilotPulse, pilotPulse, pilotPulse);
      }
      if (nozzleGlowRef.current) {
        // High heat emissive surge
        const mat = nozzleGlowRef.current.material as THREE.MeshBasicMaterial;
        mat.color.set(visual === 'stream' ? '#fff1ca' : sputter ? '#ffb347' : '#ea580c');
      }
      if (torchLightRef.current) {
        // A quench still burns in the air above the water, but it is cut short.
        torchLightRef.current.intensity = visual === 'stream' ? 6.5 + Math.random() * 1.2
          : visual === 'quench' ? 3 + Math.random() * 0.8
            : sputter ? 0.8 + Math.random() * 1.4 : 0.5;
      }
    }

  });

  if (tool === 'orbit') return null;

  return (
    <group ref={root}>
      {/* Subtle Dedicated Studio Rim Light to make metallic bevels and textures pop */}
      <pointLight position={[0.25, 0.35, 0.1]} intensity={0.9} distance={1.4} color="#ffffff" />

      {tool === 'hand' ? (
        // =========================================================================
        // AAA TEARDOWN HEAVY INDUSTRIAL GRAVITY TRACTOR (GRAVITY GUN)
        // =========================================================================
        <group rotation={[0.07, -0.06, 0]}>
          {/* Main Milled Titanium Receiver Chassis */}
          <mesh castShadow position={[0, 0.01, -0.09]}>
            <boxGeometry args={[0.096, 0.115, 0.34]} />
            <Toon color="#1e242b" />
          </mesh>

          {/* Upper Heat-Sink Cooling Fins */}
          {[-0.14, -0.10, -0.06, -0.02, 0.02].map((z, idx) => (
            <mesh key={`fin-${idx}`} position={[0, 0.072, z]}>
              <boxGeometry args={[0.088, 0.012, 0.018]} />
              <Toon color="#334155" />
            </mesh>
          ))}

          {/* Retro-Futuristic Signal Orange Hazard Plates */}
          <mesh position={[0.05, 0.02, -0.08]}>
            <boxGeometry args={[0.004, 0.07, 0.22]} />
            <Toon color="#ea580c" />
          </mesh>
          <mesh position={[-0.05, 0.02, -0.08]}>
            <boxGeometry args={[0.004, 0.07, 0.22]} />
            <Toon color="#ea580c" />
          </mesh>

          {/* Ergonomic Molded Pistol Grip with Finger Grooves */}
          <mesh position={[0, -0.10, 0.05]} rotation={[-0.26, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.026, 0.15, 16]} />
            <Toon color="#0a0a0a" />
          </mesh>
          {/* Heavy Steel Trigger & Trigger Guard */}
          <mesh position={[0, -0.065, 0.01]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[0.008, 0.032, 0.012]} />
            <Toon color="#94a3b8" />
          </mesh>
          <mesh position={[0, -0.085, 0.0]}>
            <torusGeometry args={[0.028, 0.004, 8, 16, Math.PI]} />
            <Toon color="#1e293b" />
          </mesh>

          {/* Rear Digital Diagnostic Nixie / CRT Display (Faces Player) */}
          <group position={[0, 0.045, 0.082]} rotation={[-0.2, 0, 0]}>
            <mesh>
              <boxGeometry args={[0.065, 0.038, 0.008]} />
              <Toon color="#09090b" />
            </mesh>
            {/* Glowing Amber Nixie Screen */}
            <mesh position={[0, 0, 0.005]}>
              <planeGeometry args={[0.055, 0.028]} />
              <meshBasicMaterial
                color="#f59e0b"
                toneMapped={false}
              />
            </mesh>
            {/* Status Indicator LED Diodes */}
            <mesh position={[-0.022, 0.012, 0.006]}>
              <sphereGeometry args={[0.003, 8, 8]} />
              <meshBasicMaterial color="#22c55e" toneMapped={false} />
            </mesh>
            <mesh position={[0.022, 0.012, 0.006]}>
              <sphereGeometry args={[0.003, 8, 8]} />
              <meshBasicMaterial color="#ea580c" toneMapped={false} />
            </mesh>
          </group>

          {/* High-Current Braided Copper Induction Coils */}
          <mesh position={[0, -0.015, -0.03]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.046, 0.046, 0.11, 20]} />
            <Toon color="#b45309" />
          </mesh>
          <mesh position={[0, -0.015, -0.15]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.046, 0.046, 0.11, 20]} />
            <Toon color="#b45309" />
          </mesh>

          {/* Toughened Quartz Glass Containment Chamber Tube */}
          <mesh position={[0, 0.01, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.12, 20]} />
            <meshBasicMaterial
              color="#e0f2fe"
              transparent
              opacity={0.35}
            />
          </mesh>

          {/* Dual Counter-Rotating Magnetic Resonance Rings */}
          <group ref={rotorRing1} position={[0, 0.01, -0.08]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.048, 0.005, 12, 24]} />
              <meshBasicMaterial color="#f97316" toneMapped={false} />
            </mesh>
          </group>
          <group ref={rotorRing2} position={[0, 0.01, -0.16]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.048, 0.005, 12, 24]} />
              <meshBasicMaterial color="#fef08a" toneMapped={false} />
            </mesh>
          </group>

          {/* Concentric Dual-Stage Glowing Plasma Core */}
          <mesh ref={coreInnerRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.024, 20, 20]} />
            <meshBasicMaterial
              color="#38bdf8"
              toneMapped={false}
            />
          </mesh>
          <mesh ref={coreOuterRef} position={[0, 0.01, -0.12]}>
            <sphereGeometry args={[0.038, 20, 20]} />
            <meshBasicMaterial
              color="#ea580c"
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
                <Toon color="#475569" />
              </mesh>
              {/* Knuckle Joint */}
              <mesh position={[0, 0.025, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <Toon color="#94a3b8" />
              </mesh>
              {/* Beveled Titanium Talon */}
              <mesh position={[0, 0.02, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <Toon color="#1e293b" />
              </mesh>
              {/* Emitter Tip Lens */}
              <mesh position={[0, 0.028, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshBasicMaterial color="#f59e0b" toneMapped={false} />
              </mesh>
            </group>

            {/* Bottom Left Claw Assembly */}
            <group ref={clawLeft} position={[-0.042, -0.035, 0]} rotation={[0.15, -0.15, -0.32]}>
              <mesh position={[0, 0.015, -0.04]}>
                <cylinderGeometry args={[0.008, 0.008, 0.08, 12]} />
                <Toon color="#475569" />
              </mesh>
              <mesh position={[0, 0.02, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <Toon color="#94a3b8" />
              </mesh>
              <mesh position={[0, 0.015, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <Toon color="#1e242b" />
              </mesh>
              <mesh position={[0, 0.022, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshBasicMaterial color="#f59e0b" toneMapped={false} />
              </mesh>
            </group>

            {/* Bottom Right Claw Assembly */}
            <group ref={clawRight} position={[0.042, -0.035, 0]} rotation={[0.15, 0.15, 0.32]}>
              <mesh position={[0, 0.015, -0.04]}>
                <cylinderGeometry args={[0.008, 0.008, 0.08, 12]} />
                <Toon color="#475569" />
              </mesh>
              <mesh position={[0, 0.02, -0.08]}>
                <sphereGeometry args={[0.014, 12, 12]} />
                <Toon color="#94a3b8" />
              </mesh>
              <mesh position={[0, 0.015, -0.13]} rotation={[-0.15, 0, 0]}>
                <boxGeometry args={[0.024, 0.028, 0.12]} />
                <Toon color="#1e242b" />
              </mesh>
              <mesh position={[0, 0.022, -0.19]}>
                <sphereGeometry args={[0.010, 10, 10]} />
                <meshBasicMaterial color="#f59e0b" toneMapped={false} />
              </mesh>
            </group>
          </group>
        </group>
      ) : (
        // =========================================================================
        // AAA TEARDOWN HEAVY OXY-ACETYLENE CUTTING TORCH
        // =========================================================================
        <group rotation={[0.06, -0.08, 0]}>
          {/* Heavy Machined Brass Handle with Diamond Knurling Texture */}
          <mesh castShadow position={[0, -0.02, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.022, 0.025, 0.28, 24]} />
            <Toon color="#d97706" />
          </mesh>
          {/* Hexagonal Brass Connector Couplings */}
          <mesh position={[0, -0.02, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.027, 0.027, 0.03, 6]} />
            <Toon color="#b45309" />
          </mesh>
          <mesh position={[0, -0.02, -0.11]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.027, 0.027, 0.03, 6]} />
            <Toon color="#b45309" />
          </mesh>

          {/* Dual Analog Brass Pressure Gauges Facing First-Person View */}
          <group position={[0, 0.015, 0.02]} rotation={[-0.35, 0, 0]}>
            {/* Acetylene Gauge (Left) */}
            <group position={[-0.035, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.014, 20]} />
                <Toon color="#b45309" />
              </mesh>
              {/* Dial Face */}
              <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.018, 16]} />
                <Toon color="#f8fafc" />
              </mesh>
              {/* Red Dial Indicator Needle */}
              <mesh position={[0.004, 0.009, 0]} rotation={[0, 0, 0.8]}>
                <boxGeometry args={[0.014, 0.002, 0.001]} />
                <Toon color="#dc2626" />
              </mesh>
            </group>

            {/* Oxygen Gauge (Right) */}
            <group position={[0.035, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.022, 0.022, 0.014, 20]} />
                <Toon color="#b45309" />
              </mesh>
              {/* Dial Face */}
              <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.018, 16]} />
                <Toon color="#f8fafc" />
              </mesh>
              {/* Black Dial Indicator Needle */}
              <mesh position={[0.004, 0.009, 0]} rotation={[0, 0, 1.4]}>
                <boxGeometry args={[0.014, 0.002, 0.001]} />
                <Toon color="#0f172a" />
              </mesh>
            </group>
          </group>

          {/* Knurled Gas Adjustment Valves (Red Acetylene / Green Oxygen) */}
          <mesh position={[-0.042, -0.02, 0.09]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.017, 0.017, 0.026, 16]} />
            <Toon color="#dc2626" />
          </mesh>
          <mesh position={[0.042, -0.02, 0.09]} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.017, 0.017, 0.026, 16]} />
            <Toon color="#16a34a" />
          </mesh>

          {/* Drooping Heavy Rubber Supply Hoses Curving Off-Screen */}
          <mesh position={[-0.018, -0.15, 0.18]} rotation={[0.38, 0, 0.12]}>
            <cylinderGeometry args={[0.013, 0.013, 0.26, 12]} />
            <Toon color="#991b1b" />
          </mesh>
          <mesh position={[0.018, -0.15, 0.18]} rotation={[0.38, 0, -0.12]}>
            <cylinderGeometry args={[0.013, 0.013, 0.26, 12]} />
            <Toon color="#15803d" />
          </mesh>

          {/* Stainless Steel Curved Torch Neck */}
          <mesh position={[0, -0.01, -0.20]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.013, 0.017, 0.26, 20]} />
            <Toon color="#64748b" />
          </mesh>

          {/* Heat Temper Gradient Rings (Heat Discoloration Blue/Purple) */}
          <mesh position={[0, 0.005, -0.28]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.0145, 0.0145, 0.03, 16]} />
            <Toon color="#3b82f6" />
          </mesh>
          <mesh position={[0, 0.008, -0.31]} rotation={[Math.PI / 2 - 0.08, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.03, 16]} />
            <Toon color="#8b5cf6" />
          </mesh>

          {/* Incandescent Ceramic Nozzle Collar (White/Cherry Red Heat) */}
          <mesh ref={nozzleGlowRef} position={[0, 0.014, -0.35]}>
            <cylinderGeometry args={[0.017, 0.022, 0.055, 20]} />
            <meshBasicMaterial
              color="#ea580c"
              toneMapped={false}
            />
          </mesh>

          {/* Idle Pilot Flame (Soft Blue Glow Bead) */}
          <mesh ref={pilotFlameRef} position={[0, 0.014, -0.40]}>
            <sphereGeometry args={[0.008, 10, 10]} />
            <meshBasicMaterial color="#38bdf8" toneMapped={false} />
          </mesh>

          {/* The cutting flame is drawn in world space by TorchJet, as long as the torch reaches. */}
          {/* Dynamic Light Cast onto Environment Voxels */}
          <pointLight ref={torchLightRef} position={[0, 0.014, -0.76]} distance={9.0} color="#f97316" />
        </group>
      )}
    </group>
  );
}
