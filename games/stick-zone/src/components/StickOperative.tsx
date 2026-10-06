function createOperativeLabelTexture(text: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.fillRect(0, 0, 512, 96);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 88);
    ctx.fillStyle = color;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48);
    return new THREE.CanvasTexture(canvas);
  } catch {
    return null;
  }
}

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type OperativeState, DEPOT_CONTAINERS } from '../sim/game.js';

interface StickOperativeProps {
  operative: OperativeState;
  modelUrl?: string;
  accentColor?: string;
}

export const StickOperative: React.FC<StickOperativeProps> = ({
  operative,
  accentColor = '#06b6d4',
}) => {
    const labelText = operative.name ? `[${operative.name.toUpperCase()}]` : `[${operative.badge}]`;
  const labelTexture = useMemo(() => {
    return createOperativeLabelTexture(labelText, accentColor);
  }, [labelText, accentColor]);
  const rootGroupRef = useRef<THREE.Group>(null);
  const groundHaloRef = useRef<THREE.Mesh>(null);
  const bodyPivotRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftKneeRef = useRef<THREE.Group>(null);
  const rightKneeRef = useRef<THREE.Group>(null);
  const leftElbowRef = useRef<THREE.Group>(null);
  const rightElbowRef = useRef<THREE.Group>(null);
  const weaponRef = useRef<THREE.Group>(null);
  const tracerMeshRef = useRef<THREE.Mesh>(null);
  const muzzleFlashRef = useRef<THREE.Group>(null);
  const lastShootTimeRef = useRef<number>(0);
  const lastHealthRef = useRef<number>(operative.health);
  const lastArmorRef = useRef<number>(operative.armor || 0);
  const hitFlashUntilRef = useRef<number>(0);
  const labelRef = useRef<THREE.Group>(null);
  const initializedRef = useRef(false);

  // Laser beam geometry extending 30m forward from weapon
  const laserPoints = useMemo(() => {
    return [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 35)];
  }, []);
  const laserGeo = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(laserPoints);
  }, [laserPoints]);
  const laserMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.75 });
  }, [accentColor]);
  const laserLine = useMemo(() => {
    return new THREE.Line(laserGeo, laserMaterial);
  }, [laserGeo, laserMaterial]);

  useEffect(() => {
    return () => {
      labelTexture?.dispose();
      laserGeo.dispose();
      laserMaterial.dispose();
    };
  }, [labelTexture, laserGeo, laserMaterial]);

  useFrame((state, delta) => {
    if (!rootGroupRef.current || !bodyPivotRef.current) return;

    if (!initializedRef.current) {
      rootGroupRef.current.position.set(operative.x, operative.y, operative.z);
      rootGroupRef.current.rotation.y = operative.facing;
      initializedRef.current = true;
    }

    // Smooth frame-rate independent position & rotation interpolation bounded strictly <= 1.0
    const posAlpha = Math.min(1.0, 1 - Math.exp(-22 * delta));
    const rotAlpha = Math.min(1.0, 1 - Math.exp(-24 * delta));
    rootGroupRef.current.position.lerp(new THREE.Vector3(operative.x, operative.y, operative.z), posAlpha);

    if (groundHaloRef.current && rootGroupRef.current) {
      // Pin ground tactical halo strictly to ground plane Y=0.05 regardless of operative jump height
      groundHaloRef.current.position.y = 0.05 - rootGroupRef.current.position.y;
    }

    // Shortest-arc angular interpolation across ±π boundary
    let diff = (operative.facing - rootGroupRef.current.rotation.y) % (2 * Math.PI);
    if (diff < -Math.PI) diff += 2 * Math.PI;
    else if (diff > Math.PI) diff -= 2 * Math.PI;
    rootGroupRef.current.rotation.y += diff * rotAlpha;

    const time = state.clock.getElapsedTime();
    const isSlidingMotion =
      operative.action === 'slide' ||
      !!operative.isSliding ||
      (typeof operative.slideTicksRemaining === 'number' && operative.slideTicksRemaining > 0);

    const prevPos = (rootGroupRef.current as any)?._prevPos || { x: operative.x, z: operative.z };
    const distMoved = Math.hypot(operative.x - prevPos.x, operative.z - prevPos.z);
    if (rootGroupRef.current) (rootGroupRef.current as any)._prevPos = { x: operative.x, z: operative.z };
    const isMovingLocally = distMoved > 0.005;

    // Kinetic Animation State Machine centered on hip/body pivot (Y=1.1)
    if (operative.action === 'kick') {
      const kickProgress = THREE.MathUtils.clamp((42 - (operative.actionTicks || 0)) / 42, 0, 1);
      const kickArc = Math.sin(kickProgress * Math.PI);
      bodyPivotRef.current.rotation.x = 0.25 * kickArc; // Torso dynamic lean back into kick
      bodyPivotRef.current.position.y = 1.28;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 0;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.45 * kickArc;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.25 * kickArc;
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 0.5 * kickArc;
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = -0.3 * kickArc;
    } else if (isSlidingMotion) {
      // Kinetic Slide: Lean backwards with front leg extended; min vertex Y is strictly >= +0.077m (zero floor penetration)
      bodyPivotRef.current.rotation.x = 0.42;
      bodyPivotRef.current.position.y = 1.30;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 0;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.30;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0.20;
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 0.6;
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = 0.5;
    } else if (operative.action === 'roll') {
      // Rotate around body-center pivot with tucked limbs to guarantee head/bones never clip floor
      bodyPivotRef.current.rotation.x += delta * 16;
      bodyPivotRef.current.position.y = 1.35;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 0;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -1.4;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -1.4;
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 1.2;
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = 1.2;
    } else if (operative.action === 'walk' || operative.action === 'sprint' || (operative.action === 'shoot' && isMovingLocally)) {
      bodyPivotRef.current.rotation.x = 0;
      bodyPivotRef.current.position.y = 1.28 + Math.abs(Math.sin(time * 14)) * 0.08;
      const isSprinting = operative.action === 'sprint' || (operative.action === 'shoot' && distMoved > 0.08);
      const swingSpeed = isSprinting ? 20 : 12;
      const swingAmp = isSprinting ? 0.75 : 0.45;
      if (leftLegRef.current) leftLegRef.current.rotation.x = Math.sin(time * swingSpeed) * swingAmp;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -Math.sin(time * swingSpeed) * swingAmp;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = Math.max(0, -Math.sin(time * swingSpeed) * swingAmp * 1.1);
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = Math.max(0, Math.sin(time * swingSpeed) * swingAmp * 1.1);
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 0.3 + Math.max(0, -Math.sin(time * swingSpeed) * swingAmp * 0.5);
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = 0.4 + Math.max(0, Math.sin(time * swingSpeed) * swingAmp * 0.4);
    } else if (operative.action === "crouch" || (operative as any).isCrouching) {
      // Articulated tactical crouch: lowered torso, bent hips backwards, knee pivot bent forwards
      bodyPivotRef.current.rotation.x = 0.28;
      bodyPivotRef.current.position.y = 1.16;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -0.55;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -0.55;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 1.15;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 1.15;
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 0.45;
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = 0.50;
    } else {
      // Idle breathing
      bodyPivotRef.current.rotation.x = 0;
      bodyPivotRef.current.position.y = 1.28 + Math.sin(time * 2.5) * 0.03;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftKneeRef.current) leftKneeRef.current.rotation.x = 0;
      if (rightKneeRef.current) rightKneeRef.current.rotation.x = 0;
      if (leftElbowRef.current) leftElbowRef.current.rotation.x = 0.2 + Math.sin(time * 2.5) * 0.05;
      if (rightElbowRef.current) rightElbowRef.current.rotation.x = 0.3 + Math.sin(time * 2.5) * 0.05;
    }

    if (operative.health < lastHealthRef.current || (operative.armor || 0) < lastArmorRef.current) {
      hitFlashUntilRef.current = Date.now() + 180;
    }
    lastHealthRef.current = operative.health;
    lastArmorRef.current = operative.armor || 0;

    const distinctFireTime = Math.max(
      (operative as any).lastFiredAtMs || 0,
      (operative as any).lastFireTimestamp || 0
    );

    if (distinctFireTime > 0 && distinctFireTime > lastShootTimeRef.current) {
      lastShootTimeRef.current = distinctFireTime;
    }

    const flashElapsed = lastShootTimeRef.current > 0 ? (Date.now() - lastShootTimeRef.current) : 999999;
    const isFiring = flashElapsed >= 0 && flashElapsed <= 80;

    // Weapon recoil on shoot & strictly horizontal world-pitch alignment matching simulation raycast
    if (weaponRef.current) {
      const elbowRotX = rightElbowRef.current ? rightElbowRef.current.rotation.x : 0;
      const bodyRotX = bodyPivotRef.current ? bodyPivotRef.current.rotation.x : 0;
      weaponRef.current.rotation.x = -(elbowRotX + bodyRotX);
      if (isFiring) {
        weaponRef.current.position.z = 0.22; // Recoil kickback
      } else {
        weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.4, Math.min(1.0, 15 * delta));
      }
      weaponRef.current.updateWorldMatrix(true, false);
    }

    // Raycast laser beam length from weapon world transform against shipping containers for optical physical cover
    let wepOriginX = operative.x;
    let wepOriginY = 1.1;
    let wepOriginZ = operative.z;
    let dirX = Math.sin(operative.facing);
    let dirZ = Math.cos(operative.facing);

    if (weaponRef.current) {
      const laserStart = new THREE.Vector3(0, 0.09, 0.4);
      weaponRef.current.localToWorld(laserStart);
      const laserEnd = new THREE.Vector3(0, 0.09, 1.4);
      weaponRef.current.localToWorld(laserEnd);
      const worldDir = new THREE.Vector3().subVectors(laserEnd, laserStart).normalize();
      if (Number.isFinite(laserStart.x) && Number.isFinite(laserStart.z) && Number.isFinite(laserStart.y)) {
        wepOriginX = laserStart.x;
        wepOriginY = laserStart.y;
        wepOriginZ = laserStart.z;
      }
      if (Number.isFinite(worldDir.x) && Number.isFinite(worldDir.z) && worldDir.lengthSq() > 0.001) {
        dirX = worldDir.x;
        dirZ = worldDir.z;
      }
    }

    let isInside = false;
    for (const box of DEPOT_CONTAINERS) {
      if (wepOriginY >= 0 && wepOriginY <= 5.2) {
        if (wepOriginX >= box.minX && wepOriginX <= box.maxX && wepOriginZ >= box.minZ && wepOriginZ <= box.maxZ) {
          isInside = true;
          break;
        }
      }
    }

    let laserLen = 35.0;
    if (isInside) {
      laserLen = 0;
      laserLine.visible = false;
      laserLine.scale.set(0, 0, 0);
    } else {
      for (const box of DEPOT_CONTAINERS) {
        if (wepOriginY < 0 || wepOriginY > 5.2) continue; // Container height bounds [0, 5.2]

        let tmin = 0;
        let tmax = laserLen;
        if (Math.abs(dirX) > 0.0001) {
          let t1 = (box.minX - wepOriginX) / dirX;
          let t2 = (box.maxX - wepOriginX) / dirX;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
        } else if (wepOriginX < box.minX || wepOriginX > box.maxX) {
          continue;
        }
        if (Math.abs(dirZ) > 0.0001) {
          let t1 = (box.minZ - wepOriginZ) / dirZ;
          let t2 = (box.maxZ - wepOriginZ) / dirZ;
          if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
        } else if (wepOriginZ < box.minZ || wepOriginZ > box.maxZ) {
          continue;
        }
        if (tmax >= tmin) {
          if (tmin > 0 && tmin < laserLen) {
            laserLen = tmin;
          } else if (tmin <= 0 && tmax > 0) {
            laserLen = 0;
            break;
          }
        }
      }
      if (laserLen <= 0) {
        laserLine.visible = false;
        laserLine.scale.set(0, 0, 0);
      } else {
        laserLine.visible = true;
        laserLine.scale.set(1, 1, laserLen / 35.0);
      }
    }

    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = lastShootTimeRef.current > 0 && flashElapsed >= 0 && flashElapsed <= 50;
    }
    if (tracerMeshRef.current) {
      if (laserLen <= 0) {
        tracerMeshRef.current.visible = false;
      } else {
        tracerMeshRef.current.visible = true;
        const clampedLen = Math.max(0.01, Math.min(35.0, laserLen));
        tracerMeshRef.current.scale.set(1, clampedLen / 12, 1);
        tracerMeshRef.current.position.set(0, 0, 0.4 + clampedLen / 2);
      }
    }

    // Billboard: Always orient operative label placard directly facing the active camera
    if (labelRef.current) {
      labelRef.current.position.set(
        rootGroupRef.current.position.x,
        rootGroupRef.current.position.y + 2.7,
        rootGroupRef.current.position.z
      );
      labelRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  return (
    <>
      {/* Operative Tactical Name Banner (Billboard facing active camera, independent of operative facing) */}
      <group ref={labelRef}>
        <mesh>
          <planeGeometry args={[2.2, 0.42]} />
          {labelTexture ? (
            <meshBasicMaterial map={labelTexture} transparent side={THREE.DoubleSide} />
          ) : (
            <meshBasicMaterial color="#0f172a" transparent opacity={0.85} side={THREE.DoubleSide} />
          )}
        </mesh>
      </group>

      <group ref={rootGroupRef}>
        {/* High-Contrast Ground Tactical Halo (Stays strictly on ground plane, independent of roll rotations) */}
        <mesh ref={groundHaloRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.1, 1.45, 32]} />
          <meshBasicMaterial
            color={accentColor}
            transparent
            opacity={operative.isInvulnerable ? 0.95 : 0.75}
          />
        </mesh>

      {/* Body-Center Pivoting Group (Rotates around hip/body center Y=1.1) */}
      <group ref={bodyPivotRef} position={[0, 1.1, 0]}>
        {/* Head Sphere (Offset +0.85 from hip center) */}
        <mesh position={[0, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.15} metalness={0.85} />
        </mesh>

        {/* Tactical Glowing Visor */}
        <mesh position={[0, 0.87, 0.18]} castShadow>
          <boxGeometry args={[0.3, 0.1, 0.12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1.8} />
        </mesh>

        {/* Directional Hit Impact Sparks / Shield Flash on Damage */}
        {Date.now() < hitFlashUntilRef.current && (
          <group position={[0, 0.35, 0]}>
            <mesh>
              <sphereGeometry args={[0.35, 8, 8]} />
              <meshBasicMaterial color="#ef4444" wireframe transparent opacity={0.65} />
            </mesh>
            <mesh position={[0, 0, -0.15]}>
              <coneGeometry args={[0.15, 0.4, 6]} />
              <meshBasicMaterial color="#f97316" transparent opacity={0.8} />
            </mesh>
          </group>
        )}

        {/* Torso Spine (Centered at +0.22 from hip) */}
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.08, 0.85, 12]} />
          <meshStandardMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.2} roughness={0.25} metalness={0.7} />
        </mesh>

        {/* Left Arm: Articulated Shoulder, Upper Arm, Elbow, Forearm */}
        <group position={[-0.32, 0.32, 0.05]}>
          <mesh position={[0, -0.15, 0.08]} rotation={[0.4, 0, -0.15]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.35, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.32, 0.15]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
          </mesh>
          <group ref={leftElbowRef} position={[0, -0.32, 0.15]} rotation={[0.3, 0, -0.1]}>
            <mesh position={[0, -0.15, 0.05]} castShadow>
              <cylinderGeometry args={[0.045, 0.04, 0.32, 8]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.32, 0.08]}>
              <sphereGeometry args={[0.048, 6, 6]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>
          </group>
        </group>

        {/* Right Arm & Tactical Weapon: Articulated Shoulder, Upper Arm, Elbow, Forearm */}
        <group position={[0.32, 0.32, 0]}>
          <mesh position={[0, -0.15, 0.08]} rotation={[0.45, 0, 0.15]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.35, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.32, 0.15]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
          </mesh>
          <group ref={rightElbowRef} position={[0, -0.32, 0.15]}>
            <mesh position={[0, -0.12, 0.12]} rotation={[0.5, 0, 0]} castShadow>
              <cylinderGeometry args={[0.045, 0.04, 0.32, 8]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.6} />
            </mesh>
            {/* Right Hand Mesh */}
            <mesh position={[0, -0.22, 0.2]} castShadow>
              <sphereGeometry args={[0.048, 6, 6]} />
              <meshStandardMaterial color="#94a3b8" />
            </mesh>

            {/* Weapon with Dynamic Recoil Group */}
            <group ref={weaponRef} position={[0, -0.1, 0.25]}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <boxGeometry args={[0.12, 0.7, 0.14]} />
                <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
              </mesh>

              {/* Tactical Holographic Laser Sighting Module */}
              <mesh position={[0, 0.09, 0.35]}>
                <boxGeometry args={[0.06, 0.08, 0.16]} />
                <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.5} />
              </mesh>

              {/* Tactical Thin Laser Aiming Beam */}
              <primitive object={laserLine} position={[0, 0.09, 0.4]} />

              {/* Muzzle Flash Discharge & Ballistic Tracer with frame-level 50ms visibility */}
              <group ref={muzzleFlashRef} visible={false}>
                <mesh position={[0, 0, 0.75]}>
                  <sphereGeometry args={[0.16, 10, 10]} />
                  <meshBasicMaterial color="#fef08a" />
                </mesh>
                <mesh ref={tracerMeshRef} position={[0, 0, 6.4]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 12, 6]} />
                  <meshBasicMaterial color="#fef08a" transparent opacity={0.85} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Left Leg: Articulated Thigh, Knee Joint, Shin, and Foot */}
        <group ref={leftLegRef} position={[-0.2, -0.55, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.05, 0.32, 8]} />
            <meshStandardMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.2} roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
          </mesh>
          <group ref={leftKneeRef} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <cylinderGeometry args={[0.048, 0.042, 0.35, 8]} />
              <meshStandardMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.2} roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.38, 0.06]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.08, 0.05, 0.16]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
          </group>
        </group>

        {/* Right Leg: Articulated Thigh, Knee Joint, Shin, and Foot */}
        <group ref={rightLegRef} position={[0.2, -0.55, 0]}>
          <mesh position={[0, -0.15, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.05, 0.32, 8]} />
            <meshStandardMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.2} roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.32, 0]}>
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} metalness={0.8} />
          </mesh>
          <group ref={rightKneeRef} position={[0, -0.32, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow>
              <cylinderGeometry args={[0.048, 0.042, 0.35, 8]} />
              <meshStandardMaterial color="#f1f5f9" emissive="#ffffff" emissiveIntensity={0.2} roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, -0.38, 0.06]}>
              <boxGeometry args={[0.08, 0.05, 0.16]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
    </>
  );
};
