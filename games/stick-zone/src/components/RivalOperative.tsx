import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OperativeState } from "../sim/game.js";
import { InklineStickCharacter } from "./InklineStickCharacter.js";

interface RivalOperativeProps {
  operative: OperativeState;
}

export const RivalOperative: React.FC<RivalOperativeProps> = ({ operative }) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const [labelTexture, setLabelTexture] = useState<THREE.CanvasTexture | null>(null);

  const lastPosRef = useRef({ x: operative.x, z: operative.z });
  const isMovingLocallyRef = useRef(false);
  const lastShootTimeRef = useRef(0);

  

  const isThreatAI = operative.isAI || operative.badge === "SECTOR BOSS" || operative.badge === "SCAV PATROL";
  const isBoss = operative.badge === "SECTOR BOSS";
  const accentColor = isBoss ? "#FF365E" : isThreatAI ? "#f97316" : "#38bdf8";

  useEffect(() => {
    if (!isBoss) {
      setLabelTexture(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 320, 48);
    // Only boss gets a minimal transparent crown mark, NO opaque card
    ctx.font = "900 18px monospace";
    ctx.fillStyle = "#FF365E";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText("👑 WARLORD (SECTOR BOSS)", 160, 24);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    setLabelTexture(tex);

    return () => {
      tex.dispose();
    };
  }, [isBoss]);

  useFrame((state, delta) => {
    if (typeof window !== "undefined" && Boolean((window as any).__STICK_ZONE_TEST__?.isPaused)) return;
    if (!rootGroupRef.current) return;

    const lerpFactor = 1 - Math.exp(-20 * Math.min(delta, 0.1));
    rootGroupRef.current.position.x = THREE.MathUtils.lerp(
      rootGroupRef.current.position.x,
      operative.x,
      lerpFactor
    );
    rootGroupRef.current.position.z = THREE.MathUtils.lerp(
      rootGroupRef.current.position.z,
      operative.z,
      lerpFactor
    );
    rootGroupRef.current.position.y = operative.y || 0;

    const distMoved = Math.hypot(
      rootGroupRef.current.position.x - lastPosRef.current.x,
      rootGroupRef.current.position.z - lastPosRef.current.z
    );
    isMovingLocallyRef.current = distMoved > 0.015;
    lastPosRef.current = {
      x: rootGroupRef.current.position.x,
      z: rootGroupRef.current.position.z,
    };

    const distinctFireTime = Math.max(
      (operative as any).lastFiredAtMs || 0,
      (operative as any).lastFireTimestamp || 0
    );
    if (distinctFireTime > 0 && distinctFireTime > lastShootTimeRef.current) {
      lastShootTimeRef.current = distinctFireTime;
    }

    if (labelRef.current) {
      labelRef.current.position.set(
        rootGroupRef.current.position.x,
        rootGroupRef.current.position.y + 2.5,
        rootGroupRef.current.position.z
      );
      labelRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  if (!operative.isAlive) return null;

  const isMoving = isMovingLocallyRef.current || operative.action === "walk" || operative.action === "sprint";
  const flashElapsed = lastShootTimeRef.current > 0 ? Date.now() - lastShootTimeRef.current : 999999;
  const isFiring = flashElapsed >= 0 && flashElapsed <= 70;

  return (
    <>
      {isBoss && labelTexture && (
        <group ref={labelRef}>
          <mesh>
            <planeGeometry args={[1.0, 0.18]} />
            <meshBasicMaterial map={labelTexture} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      <group ref={rootGroupRef} position={[operative.x, operative.y || 0, operative.z]}>
        {/* Ground Tactical Halo */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.55, 0.68, 32]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.75} />
        </mesh>

        {/* Rigged Animated Inkline 3D Stick Striker or Scav */}
        <InklineStickCharacter
          assetKey={
            operative.badge === 'SECTOR BOSS'
              ? 'scavBoss'
              : operative.badge === 'SCAV PATROL'
              ? 'scavRunner'
              : 'rivalStickman'
          }
          weapon={operative.weapon || 'rifle'}
          isMoving={isMoving}
          isFiring={isFiring}
          isAlive={operative.isAlive}
          facing={operative.facing}
          accentColor={accentColor}
          hasWeapon={true}
        />
      </group>
    </>
  );
};
