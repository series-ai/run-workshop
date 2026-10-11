import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OperativeState } from "../sim/game.js";
import { InklineStickCharacter } from "./InklineStickCharacter.js";
import { DynamicFlashlightOcclusion } from "./DynamicFlashlightOcclusion.js";

interface RivalOperativeProps {
  operative: OperativeState;
}

export const RivalOperative: React.FC<RivalOperativeProps> = ({ operative }) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<THREE.Group>(null);
  const [labelTexture, setLabelTexture] = useState<THREE.CanvasTexture | null>(null);
  const barkRef = useRef<THREE.Group>(null);
  const [barkTexture, setBarkTexture] = useState<THREE.CanvasTexture | null>(null);
  const [barkVisible, setBarkVisible] = useState(false);

  const lastPosRef = useRef({ x: operative.x, z: operative.z });
  const speedRef = useRef(0);
  const isMovingLocallyRef = useRef(false);
  const moveAngleRef = useRef<number | undefined>(undefined);
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

  useEffect(() => {
    if (!operative.barkText) {
      setBarkTexture(null);
      setBarkVisible(false);
      return;
    }
    setBarkVisible(true);

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 72);

    const isBossEnemy = operative.badge === "SECTOR BOSS";
    ctx.fillStyle = isBossEnemy ? "#FF3366" : "#FACC15";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;

    const bx = 6, by = 6, bw = 244, bh = 46, br = 8;
    ctx.beginPath();
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(138, by + bh);
    ctx.lineTo(128, by + bh + 14);
    ctx.lineTo(118, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = "900 18px monospace";
    ctx.fillStyle = isBossEnemy ? "#FFFFFF" : "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(operative.barkText, 128, by + bh / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    setBarkTexture(tex);

    const timer = setTimeout(() => {
      setBarkVisible(false);
    }, 1800);

    return () => {
      clearTimeout(timer);
      tex.dispose();
    };
  }, [operative.barkText, operative.barkTick]);

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
    const measuredSpeed = distMoved / Math.max(0.001, delta);
    speedRef.current = THREE.MathUtils.lerp(speedRef.current, measuredSpeed, 0.25);
    isMovingLocallyRef.current = distMoved > 0.012;
    const dx = rootGroupRef.current.position.x - lastPosRef.current.x;
    const dz = rootGroupRef.current.position.z - lastPosRef.current.z;
    moveAngleRef.current = distMoved > 0.012 ? Math.atan2(dx, dz) : undefined;
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

    if (barkRef.current) {
      barkRef.current.position.set(
        rootGroupRef.current.position.x,
        rootGroupRef.current.position.y + 2.2,
        rootGroupRef.current.position.z
      );
      barkRef.current.quaternion.copy(state.camera.quaternion);
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

      {barkVisible && barkTexture && (
        <group ref={barkRef}>
          <mesh>
            <planeGeometry args={[1.5, 0.42]} />
            <meshBasicMaterial map={barkTexture} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Scav & Boss Dynamic Tactical Searchlight with Container Occlusion */}
      {operative.isAlive && (
        <DynamicFlashlightOcclusion
          origin={{ x: operative.x, y: operative.y || 0, z: operative.z }}
          facing={operative.facing}
          isActive={true}
          colorHex={isBoss ? "#ef4444" : "#f59e0b"}
          maxRange={isBoss ? 20.0 : 15.0}
          halfAngle={isBoss ? 0.52 : 0.42}
          baseAlpha={isBoss ? 0.32 : 0.24}
          showSpotLight={false}
        />
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
          speed={speedRef.current}
          moveAngle={moveAngleRef.current}
          action={operative.action}
          onMuzzleSample={(muzzle) => {
            operative.muzzlePos = { x: muzzle.pos.x, y: muzzle.pos.y, z: muzzle.pos.z };
            operative.muzzleDir = { x: muzzle.dir.x, y: muzzle.dir.y, z: muzzle.dir.z };
          }}
        />
      </group>
    </>
  );
};
