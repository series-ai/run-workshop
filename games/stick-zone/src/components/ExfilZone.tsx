import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SIM_CONFIG } from "../sim/config.js";
import type { ExfilState } from "../sim/airlock.js";
import { InklineModel } from "./InklineModel.js";

interface ExfilZoneProps {
  exfilState: ExfilState;
}

export const ExfilZone: React.FC<ExfilZoneProps> = ({ exfilState }) => {
  const ringsRef = useRef<THREE.Group>(null);
  const smokeGroupRef = useRef<THREE.Group>(null);
  const zone = SIM_CONFIG.EXFIL_ZONE;

  const currentTicks = exfilState.kind === "holding_zone" ? exfilState.currentTicks : 0;
  const progressRatio = Math.min(1, currentTicks / SIM_CONFIG.EXFIL_HOLD_TICKS);

  useFrame((_state, delta) => {
    if (typeof window !== "undefined" && Boolean((window as any).__STICK_ZONE_TEST__?.isPaused)) return;
    if (ringsRef.current) {
      ringsRef.current.rotation.z += delta * 0.4;
    }
    if (smokeGroupRef.current) {
      smokeGroupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={[zone.x, 0, zone.z]}>
      {/* 3D Inkline Extraction Teleporter Pad Structure */}
      <InklineModel
        assetKey="teleporterPad"
        position={[0, 0.05, 0]}
        scale={3.6}
      />

      {/* Flanking Warp Beacons & Tarkov Green Flare Exfil Smoke */}
      <InklineModel assetKey="warpBeacon" position={[-zone.radius + 0.8, 0, 0]} scale={1.8} />
      <InklineModel assetKey="warpBeacon" position={[zone.radius - 0.8, 0, 0]} scale={1.8} />

      <pointLight position={[-zone.radius + 0.8, 1.2, 0]} color="#22c55e" intensity={currentTicks > 0 ? 4.5 : 1.2} distance={10} />
      <pointLight position={[zone.radius - 0.8, 1.2, 0]} color="#22c55e" intensity={currentTicks > 0 ? 4.5 : 1.2} distance={10} />

      <group ref={smokeGroupRef}>
        <mesh position={[-zone.radius + 0.8, 1.6, 0]}>
          <cylinderGeometry args={[0.25, 0.5, 3.2, 16]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={currentTicks > 0 ? 0.4 : 0.12} />
        </mesh>
        <mesh position={[zone.radius - 0.8, 1.6, 0]}>
          <cylinderGeometry args={[0.25, 0.5, 3.2, 16]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={currentTicks > 0 ? 0.4 : 0.12} />
        </mesh>
      </group>

      {/* INKLINE Graphic Perimeter Ring (#151716 Pitch Black Ink) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[zone.radius - 0.25, zone.radius, 64]} />
        <meshBasicMaterial color="#151716" />
      </mesh>

      {/* INKLINE Concentric Graphic Dash Ring */}
      <group ref={ringsRef} position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <ringGeometry args={[zone.radius - 0.8, zone.radius - 0.65, 32]} />
          <meshBasicMaterial color="#494c46" />
        </mesh>
        <mesh>
          <ringGeometry args={[zone.radius - 1.8, zone.radius - 1.65, 24]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
        <mesh>
          <ringGeometry args={[1.2, 1.35, 16]} />
          <meshBasicMaterial color="#d45538" />
        </mesh>
      </group>

      {/* Progress Hold Arc / Ring */}
      {currentTicks > 0 && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.09, 0]}
        >
          <ringGeometry args={[0.6, zone.radius - 0.3, 64, 1, 0, Math.PI * 2 * progressRatio]} />
          <meshBasicMaterial color="#d45538" transparent opacity={0.65} />
        </mesh>
      )}

      {/* Floodlight Tower Structure (Edge linework without neon beam) */}
      <group position={[zone.radius + 1.5, 0, 0]}>
        <InklineModel assetKey="floodlightTower" scale={1.2} />
      </group>
    </group>
  );
};
