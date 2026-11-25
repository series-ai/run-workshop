import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MachineDefense } from '../sim/game.js';
import { InklineModel } from './InklineModel.js';

interface MachineEnemyProps {
  machine: MachineDefense;
}

export const MachineEnemy: React.FC<MachineEnemyProps> = React.memo(({ machine }) => {
  const groupRef = useRef<THREE.Group>(null);
  const hudRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.Group>(null);

  const [turretLabelTex, setTurretLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [droneLabelTex, setDroneLabelTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const makeTex = (title: string, sub: string, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.roundRect(4, 4, 248, 56, 6);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.roundRect(4, 4, 248, 56, 6);
      ctx.stroke();

      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, 128, 24);

      ctx.font = '12px monospace';
      ctx.fillStyle = color;
      ctx.fillText(sub, 128, 44);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    setTurretLabelTex(makeTex('AUTOMATED VULCAN', 'SECTOR DEFENSE', '#ef4444'));
    setDroneLabelTex(makeTex('SCOUT DRONE', 'AERIAL RECON', '#38bdf8'));
  }, []);

  const maxHp = machine.type === 'turret' ? 120 : 60;
  const hpRatio = Math.max(0, Math.min(1, machine.health / maxHp));

  const lastShootTime = Math.max(
    machine.lastFiredAtMs || 0,
    (machine as any).lastFireTimestamp || 0
  );
  const flashElapsed = lastShootTime > 0 ? Date.now() - lastShootTime : 999999;
  const isMuzzleFlashActive = lastShootTime > 0 && flashElapsed >= 0 && flashElapsed <= 50;

  useFrame((state) => {
    if (typeof window !== "undefined" && Boolean((window as any).__STICK_ZONE_TEST__?.isPaused)) return;
    if (muzzleFlashRef.current) {
      muzzleFlashRef.current.visible = isMuzzleFlashActive;
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
        machine.y + (machine.type === 'turret' ? 2.4 : 1.6) + droneBob,
        machine.z
      );
      hudRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  if (!machine.isAlive) return null;

  return (
    <>
      <group ref={groupRef} position={[machine.x, machine.y, machine.z]}>
        {/* Real 3D Inkline Sci-Fi Machine Models */}
        {machine.type === 'turret' ? (
          <group position={[0, 0, 0]}>
            <InklineModel
              assetKey="turretAutomated"
              scale={2.2}
              position={[0, 0.2, 0]}
            />
          </group>
        ) : (
          <group position={[0, 1.0, 0]}>
            <InklineModel
              assetKey="droneScout"
              scale={2.0}
              position={[0, 0, 0]}
            />
          </group>
        )}

        {/* Dynamic Firing Muzzle Flash */}
        <group
          ref={muzzleFlashRef}
          visible={false}
          position={[0, machine.type === 'turret' ? 1.1 : 0.8, 1.2]}
        >
          <mesh>
            <sphereGeometry args={[0.22, 8, 8]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
          <pointLight color="#f97316" intensity={4.0} distance={15} />
        </group>

        {/* Tactical Red Targeting Laser telegraph */}
        {typeof (machine as any).targetDistance === "number" && (machine as any).targetDistance > 0 && (
          <group>
            {/* Outer crimson energy beam */}
            <mesh
              position={[0, machine.type === "turret" ? 1.1 : 0.8, 1.2 + ((machine as any).targetDistance || 10) / 2]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.06, 0.06, (machine as any).targetDistance || 10, 8]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.65} depthWrite={false} />
            </mesh>
            {/* Inner white-hot laser core */}
            <mesh
              position={[0, machine.type === "turret" ? 1.1 : 0.8, 1.2 + ((machine as any).targetDistance || 10) / 2]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.02, 0.02, (machine as any).targetDistance || 10, 6]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
            </mesh>
            {/* Ground Targeting Reticle at Target Position */}
            <mesh
              position={[0, 0.04, 1.2 + ((machine as any).targetDistance || 10)]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.3, 0.45, 16]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.85} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )}
      </group>

      {/* Silhouette Fill Light */}
      <pointLight
        position={[machine.x, machine.y + (machine.type === 'turret' ? 2.0 : 0.4), machine.z]}
        color={machine.type === 'turret' ? '#ef4444' : '#38bdf8'}
        intensity={machine.type === 'turret' ? 5.0 : 3.5}
        distance={6.0}
        decay={2}
      />

      {/* Camera-Facing Tactical Billboard HUD Placard */}
      <group ref={hudRef} position={[machine.x, machine.y + (machine.type === 'turret' ? 2.4 : 1.6), machine.z]}>
        {/* Background plate */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.6, 0.22]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        {/* Health Fill */}
        <mesh position={[-0.75 + 0.75 * hpRatio, 0, 0.01]}>
          <planeGeometry args={[1.5 * hpRatio, 0.16]} />
          <meshBasicMaterial
            color={hpRatio > 0.35 ? (machine.type === 'turret' ? '#ef4444' : '#38bdf8') : '#dc2626'}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Machine Unit Type Marker Tag */}
        <mesh position={[0, 0.28, 0]}>
          <planeGeometry args={[2.0, 0.38]} />
          {machine.type === 'turret' && turretLabelTex ? (
            <meshBasicMaterial map={turretLabelTex} transparent side={THREE.DoubleSide} />
          ) : machine.type === 'drone' && droneLabelTex ? (
            <meshBasicMaterial map={droneLabelTex} transparent side={THREE.DoubleSide} />
          ) : (
            <meshBasicMaterial color="#ef4444" transparent opacity={0.9} side={THREE.DoubleSide} />
          )}
        </mesh>
      </group>
    </>
  );
});
