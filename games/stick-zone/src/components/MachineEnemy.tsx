
function createLabelTexture(text: string, color: string): THREE.CanvasTexture | null {
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
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 48);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  } catch {
    return null;
  }
}

let cachedTurretLabel: THREE.CanvasTexture | null = null;
let cachedDroneLabel: THREE.CanvasTexture | null = null;
function getTurretLabel(): THREE.CanvasTexture | null {
  if (!cachedTurretLabel) cachedTurretLabel = createLabelTexture("[DEFENSE: VULCAN TURRET]", "#ef4444");
  return cachedTurretLabel;
}
function getDroneLabel(): THREE.CanvasTexture | null {
  if (!cachedDroneLabel) cachedDroneLabel = createLabelTexture("[DEFENSE: PATROL DRONE]", "#38bdf8");
  return cachedDroneLabel;
}

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type MachineDefense, DEPOT_CONTAINERS } from '../sim/game.js';

interface MachineEnemyProps {
  machine: MachineDefense;
}

export const MachineEnemy: React.FC<MachineEnemyProps> = ({ machine }) => {
  const muzzleFlashRef = useRef<THREE.Group>(null);
  const isMuzzleFlashActive =
    machine.isAlive &&
    machine.health > 0 &&
    typeof machine.lastFiredAtMs === "number" &&
    Date.now() - machine.lastFiredAtMs <= 50;

  const tracerLength = useMemo(() => {
    let maxDist = (machine as any).targetDistance || (machine.type === "turret" ? 20.0 : 25.0);
    const sinF = Math.sin(machine.facing);
    const cosF = Math.cos(machine.facing);
    const targetY = (machine as any).targetY ?? 1.28;
    for (const box of DEPOT_CONTAINERS) {
      const containerHeight = (box as any).height || 5.2;
      if (machine.y > containerHeight && targetY > containerHeight) {
        continue;
      }
      let tmin = 0;
      let tmax = maxDist;
      if (Math.abs(sinF) > 0.0001) {
        let t1 = (box.minX - machine.x) / sinF;
        let t2 = (box.maxX - machine.x) / sinF;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      } else if (machine.x < box.minX || machine.x > box.maxX) {
        continue;
      }
      if (Math.abs(cosF) > 0.0001) {
        let t1 = (box.minZ - machine.z) / cosF;
        let t2 = (box.maxZ - machine.z) / cosF;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
      } else if (machine.z < box.minZ || machine.z > box.maxZ) {
        continue;
      }
      if (tmax >= tmin && tmin > 0.5 && tmin < maxDist) {
        const rayYAtEntry = machine.y + (tmin / maxDist) * (targetY - machine.y);
        if (rayYAtEntry <= containerHeight) {
          maxDist = tmin;
        }
      }
    }
    return maxDist;
  }, [machine.x, machine.z, machine.facing, machine.type, (machine as any).targetY, (machine as any).targetDistance]);
  const groupRef = useRef<THREE.Group>(null);
  const hudRef = useRef<THREE.Group>(null);
  const maxHp = machine.type === "turret" ? 120 : (machine.type === "drone" ? 75 : 100);
  const hpRatio = Math.max(0, Math.min(1, machine.health / maxHp));

  useFrame((state, delta) => {
    if (muzzleFlashRef.current) {
      const isFlash = machine.isAlive && machine.health > 0 && typeof machine.lastFiredAtMs === "number" && (Date.now() - machine.lastFiredAtMs >= 0) && (Date.now() - machine.lastFiredAtMs <= 50);
      muzzleFlashRef.current.visible = !!isFlash;
    }
    if (!machine.isAlive) return;

    if (groupRef.current) {
      groupRef.current.position.set(machine.x, machine.y, machine.z);
      groupRef.current.rotation.y = machine.facing;

      if (machine.type === 'drone') {
        groupRef.current.position.y = machine.y + Math.sin(state.clock.elapsedTime * 3) * 0.25;
      }
    }

    if (hudRef.current) {
      const droneBob = machine.type === 'drone' ? Math.sin(state.clock.elapsedTime * 3) * 0.25 : 0;
      hudRef.current.position.set(
        machine.x,
        machine.y + (machine.type === 'turret' ? 2.3 : 1.5) + droneBob,
        machine.z
      );
      // Billboard: Always orient placard directly facing the active camera to eliminate edge-on and reversed text
      hudRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  if (!machine.isAlive) {
    return (
      <group position={[machine.x, 0.2, machine.z]}>
        <mesh>
          <boxGeometry args={[1.0, 0.3, 1.0]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  return (
    <>
      {/* 3D Machine Physical Model & Facing Rotation */}
      <group ref={groupRef} position={[machine.x, machine.y, machine.z]}>
        {machine.type === 'turret' ? (
          <TurretModel cooldown={machine.cooldownTicks} />
        ) : (
          <DroneModel cooldown={machine.cooldownTicks} />
        )}

        {/* Dynamic Firing Muzzle Flash with frame-level 50ms removal */}
        <group ref={muzzleFlashRef} visible={false} position={[0, machine.type === "turret" ? 0.9 : 0, machine.type === "turret" ? 1.5 : 0.6]}>
            <mesh>
              <sphereGeometry args={[0.22, 8, 8]} />
              <meshBasicMaterial color="#fbbf24" />
            </mesh>
            <pointLight color="#f97316" intensity={4.0} distance={15} />
        </group>

        {/* Sleek Tactical Laser Tracer Line covering full attack trajectory (20m turret, 25m drone descending) */}
        {isMuzzleFlashActive && (() => {
          const muzzleY = machine.y + (machine.type === "turret" ? 0.9 : 0);
          const targetY = (machine as any).targetY ?? (machine.type === "drone" ? 1.0 : muzzleY);
          const fullDist = Math.max(0.1, (machine as any).targetDistance || (machine.type === "turret" ? 20.0 : 25.0));
          const dy = targetY - muzzleY;
          const dyClipped = (dy / fullDist) * tracerLength;
          const pitchAngle = Math.PI / 2 - Math.atan2(dy, fullDist);
          const dyCenter = dyClipped / 2;
          const actualLength = Math.hypot(tracerLength, dyClipped);
          return (
            <group position={[0, machine.type === "turret" ? 0.9 : 0, 0]}>
              <mesh
                rotation={[pitchAngle, 0, 0]}
                position={[0, dyCenter, tracerLength / 2]}
              >
                <cylinderGeometry args={[0.012, 0.012, actualLength, 8]} />
                <meshBasicMaterial
                  color="#ef4444"
                  transparent
                  opacity={0.85}
                />
              </mesh>
            </group>
          );
        })()}
      </group>

      {/* Machine Fill Light: silhouette edge definition against the dark depot so the
          body/shapes read without labels (turrets: cool steel-cyan rim; drones: cyan) */}
      <pointLight
        position={[machine.x, machine.y + (machine.type === 'turret' ? 2.0 : 0.4), machine.z]}
        color={machine.type === 'turret' ? '#5ee7ff' : '#38bdf8'}
        intensity={machine.type === 'turret' ? 6.0 : 3.5}
        distance={machine.type === 'turret' ? 7.0 : 5.0}
        decay={2}
      />

      {/* Camera-Facing Tactical Billboard HUD Placard (Always Faces Viewport) */}
      <group ref={hudRef} position={[machine.x, machine.y + (machine.type === "turret" ? 2.3 : 1.5), machine.z]}>
        {/* Background plate */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.6, 0.22]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* Health Fill (Strictly Normalized against maxHp) */}
        <mesh position={[-0.75 + (0.75 * hpRatio), 0, 0.01]}>
          <planeGeometry args={[1.5 * hpRatio, 0.16]} />
          <meshBasicMaterial color={hpRatio > 0.35 ? "#ef4444" : "#dc2626"} side={THREE.DoubleSide} />
        </mesh>
        {/* Machine Unit Type Marker Tag */}
        <mesh position={[0, 0.26, 0]}>
          <planeGeometry args={[2.0, 0.35]} />
          {machine.type === "turret" && getTurretLabel() ? (
            <meshBasicMaterial map={getTurretLabel()!} transparent side={THREE.DoubleSide} />
          ) : machine.type === "drone" && getDroneLabel() ? (
            <meshBasicMaterial map={getDroneLabel()!} transparent side={THREE.DoubleSide} />
          ) : (
            <meshBasicMaterial color={machine.type === "turret" ? "#ef4444" : "#38bdf8"} transparent opacity={0.9} side={THREE.DoubleSide} />
          )}
        </mesh>
      </group>
    </>
  );
};

const TurretModel: React.FC<{ cooldown: number }> = ({ cooldown }) => {
  return (
    <group>
      {/* Heavy Steel Turret Bunker Base */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.0, 1.3, 0.8, 8]} />
        <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Swivel Mount */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.48, 16, 16]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Twin Vulcan Barrels */}
      <mesh position={[0.2, 0.9, 0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 1.2, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[-0.2, 0.9, 0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 1.2, 8]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Red Optical Targeting Eye */}
      <mesh position={[0, 1.1, 0.38]}>
        <sphereGeometry args={[0.13, 12, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={cooldown > 0 ? 2.0 : 1.0} />
      </mesh>
    </group>
  );
};

const DroneModel: React.FC<{ cooldown: number }> = ({ cooldown }) => {
  return (
    <group>
      {/* Drone Aerodynamic Core */}
      <mesh castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#536179" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Rotor Struts */}
      <mesh position={[0.55, 0.1, 0.55]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#3b4a5f" emissive="#0f2233" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.55, 0.1, 0.55]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#3b4a5f" emissive="#0f2233" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0.55, 0.1, -0.55]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#3b4a5f" emissive="#0f2233" emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[-0.55, 0.1, -0.55]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#3b4a5f" emissive="#0f2233" emissiveIntensity={0.35} />
      </mesh>

      {/* Sensor Blaster Pod */}
      <mesh position={[0, -0.25, 0.22]}>
        <boxGeometry args={[0.18, 0.2, 0.42]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={cooldown > 0 ? 2.0 : 0.8} />
      </mesh>
    </group>
  );
};
