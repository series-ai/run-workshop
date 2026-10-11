import React, { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OperativeState } from "../sim/game.js";
import { DEPOT_CONTAINERS } from "../sim/game.js";
import { InklineStickCharacter } from "./InklineStickCharacter.js";
import { DynamicFlashlightOcclusion } from "./DynamicFlashlightOcclusion.js";

interface StickOperativeProps {
  operative: OperativeState;
  isCurrentPlayer?: boolean;
  onSampleBones?: (bones: { footR: THREE.Vector3; handR: THREE.Vector3 }) => void;
}

export const StickOperative: React.FC<StickOperativeProps> = ({
  operative,
  isCurrentPlayer = true,
  onSampleBones,
}) => {
  const rootGroupRef = useRef<THREE.Group>(null);
  const groundHaloRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);
  const [labelTexture, setLabelTexture] = useState<THREE.CanvasTexture | null>(null);

  const lastPosRef = useRef({ x: operative.x, z: operative.z });
  const speedRef = useRef(0);
  const isMovingLocallyRef = useRef(false);
  const moveAngleRef = useRef<number | undefined>(undefined);
  const lastHealthRef = useRef(operative.health);
  const lastArmorRef = useRef(operative.armor || 0);
  const hitFlashUntilRef = useRef(0);
  const lastShootTimeRef = useRef(0);
  const [currentWeapon, setCurrentWeapon] = useState<string>(() => operative.weapon || "rifle");
  const weaponRef = useRef(operative.weapon || "rifle");

  const isAlly = operative.squad === "alpha" || operative.id === "op_squadmate" || isCurrentPlayer;
  const accentColor = isAlly ? "#38bdf8" : "#f97316";

  useEffect(() => {
    if (isCurrentPlayer) {
      setLabelTexture(null);
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 320, 48);
    // Sleek cyan text with glowing tactical chevron, NO dark opaque card
    ctx.font = "900 18px monospace";
    ctx.fillStyle = "#51E5F0";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText(`◇ ${operative.name || "VIPER-2"}`, 160, 24);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    setLabelTexture(tex);

    return () => {
      tex.dispose();
    };
  }, [operative.name, isCurrentPlayer]);

  useFrame((state, delta) => {
    if (typeof window !== "undefined" && Boolean((window as any).__STICK_ZONE_TEST__?.isPaused)) return;
    if (!rootGroupRef.current) return;

    const lerpFactor = 1 - Math.exp(-25 * Math.min(delta, 0.1));
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

    if (groundHaloRef.current) {
      const pulseSpeed = operative.isInvulnerable ? 8 : 4;
      const baseScale = 1.0 + Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.06;
      groundHaloRef.current.scale.set(baseScale, baseScale, baseScale);
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
    if (operative.weapon && operative.weapon !== weaponRef.current) {
      weaponRef.current = operative.weapon;
      setCurrentWeapon(operative.weapon);
    }
    const flashElapsed =
      lastShootTimeRef.current > 0 ? Date.now() - lastShootTimeRef.current : 999999;



    // Billboard label orienting towards camera
    if (labelRef.current) {
      labelRef.current.position.set(
        rootGroupRef.current.position.x,
        rootGroupRef.current.position.y + 2.15,
        rootGroupRef.current.position.z
      );
      labelRef.current.quaternion.copy(state.camera.quaternion);
    }
  });

  const isMoving = isMovingLocallyRef.current || operative.action === "walk" || operative.action === "sprint";
  const flashElapsed = lastShootTimeRef.current > 0 ? Date.now() - lastShootTimeRef.current : 999999;
  const isFiring = flashElapsed >= 0 && flashElapsed <= 70;

  const characterAssetKey = isCurrentPlayer
    ? "playerStickman"
    : operative.isRival
    ? "rivalStickman"
    : "squadmateStickman";

  return (
    <>
      {/* Tactical Label Billboard (Only for squadmates/rivals - never for local player) */}
      {!isCurrentPlayer && labelTexture && (
        <group ref={labelRef}>
          <mesh>
            <planeGeometry args={[0.9, 0.16]} />
            <meshBasicMaterial map={labelTexture} transparent depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {/* Tactical Dynamic Flashlight Beam with Container Occlusion */}
      {operative.isAlive && (
        <DynamicFlashlightOcclusion
          operative={operative}
          origin={{ x: operative.x, y: operative.y || 0, z: operative.z }}
          facing={operative.facing}
          isActive={operative.isFlashlightOn ?? true}
          colorHex={isCurrentPlayer ? "#fffbeb" : "#93c5fd"}
          maxRange={isCurrentPlayer ? 22.0 : 16.0}
          halfAngle={0.48}
          showSpotLight={isCurrentPlayer}
        />
      )}

      <group ref={rootGroupRef} position={[operative.x, operative.y || 0, operative.z]}>
        {/* Ground Tactical Halo & Aim Direction Indicator */}
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <mesh ref={groundHaloRef}>
            <ringGeometry args={[0.55, 0.68, 32]} />
            <meshBasicMaterial
              color={accentColor}
              transparent
              opacity={operative.isInvulnerable ? 0.95 : 0.75}
              side={THREE.DoubleSide}
            />
          </mesh>

        </group>

        {/* Rigged Animated Inkline 3D Stick Character */}
        <InklineStickCharacter
          operative={operative}
          assetKey={characterAssetKey}
          isCurrentPlayer={isCurrentPlayer}
          weapon={currentWeapon as any}
          isMoving={isMoving}
          isFiring={isFiring}
          flashElapsed={flashElapsed}
          isAlive={operative.isAlive}
          isRolling={operative.isRolling}
          isBleeding={operative.isBleeding}
          facing={operative.facing}
          accentColor={accentColor}
          hasWeapon={true}
          speed={speedRef.current}
          moveAngle={moveAngleRef.current}
          action={operative.action}
          onSampleBones={onSampleBones}
          onMuzzleSample={(muzzle) => {
            operative.muzzlePos = { x: muzzle.pos.x, y: muzzle.pos.y, z: muzzle.pos.z };
            operative.muzzleDir = { x: muzzle.dir.x, y: muzzle.dir.y, z: muzzle.dir.z };
          }}
        />


      </group>
    </>
  );
};
