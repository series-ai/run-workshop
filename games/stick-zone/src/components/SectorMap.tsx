// Animated FOB Target Dummy with Spring Recoil Physics
const FOBTargetDummy: React.FC<{
  position: [number, number, number];
  color: string;
  side: "left" | "right";
  lastHitTick?: number;
  hitSide?: "left" | "right";
}> = ({ position, color, side, lastHitTick, hitSide }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wobbleAmpRef = useRef(0);
  const lastProcessedTickRef = useRef(0);

  useEffect(() => {
    if (lastHitTick && lastHitTick > lastProcessedTickRef.current && hitSide === side) {
      lastProcessedTickRef.current = lastHitTick;
      wobbleAmpRef.current = 1.0;
    }
  }, [lastHitTick, hitSide, side]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (wobbleAmpRef.current > 0.005) {
      const decay = Math.exp(-delta * 8.5);
      wobbleAmpRef.current *= decay;
      groupRef.current.rotation.x = -Math.sin(Date.now() * 0.025) * wobbleAmpRef.current * 0.4;
      groupRef.current.rotation.z = Math.cos(Date.now() * 0.03) * wobbleAmpRef.current * 0.15;
    } else {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
    }
  });

  return (
    <group position={position}>
      {/* Heavy Steel Base Mount */}
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.2, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Base Anchor Bolts */}
      {[-0.35, 0.35].map((bx) =>
        [-0.35, 0.35].map((bz) => (
          <mesh key={"bolt_" + bx + "_" + bz} position={[bx, 0.21, bz]}>
            <cylinderGeometry args={[0.04, 0.04, 0.04, 6]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.8} />
          </mesh>
        ))
      )}

      {/* Dynamic Wobbling Upper Rig */}
      <group ref={groupRef} position={[0, 0.2, 0]}>
        {/* Spring Shock Absorber */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.32, 12]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Heavy Steel Support Pole */}
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.1, 8]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Silhouette Torso Plate */}
        <mesh position={[0, 1.35, 0]} castShadow>
          <boxGeometry args={[0.62, 0.82, 0.09]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>

        {/* Concentric Bullseye Scoring Rings */}
        <mesh position={[0, 1.4, 0.052]} material={SharedMaterials.pureWhite}>
          <circleGeometry args={[0.24, 24]} />
        </mesh>
        <mesh position={[0, 1.4, 0.054]} material={SharedMaterials.darkNavy}>
          <circleGeometry args={[0.18, 24]} />
        </mesh>
        <mesh position={[0, 1.4, 0.056]} material={SharedMaterials.redDamage}>
          <circleGeometry args={[0.12, 24]} />
        </mesh>
        <mesh position={[0, 1.4, 0.058]} material={SharedMaterials.targetYellow}>
          <circleGeometry args={[0.05, 16]} />
        </mesh>

        {/* Silhouette Head Plate */}
        <mesh position={[0, 1.88, 0]} castShadow>
          <boxGeometry args={[0.32, 0.3, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        {/* Head Lethal Hit Ring */}
        <mesh position={[0, 1.88, 0.052]} material={SharedMaterials.redDamage}>
          <circleGeometry args={[0.09, 16]} />
        </mesh>
        <mesh position={[0, 1.88, 0.054]} material={SharedMaterials.targetYellow}>
          <circleGeometry args={[0.04, 16]} />
        </mesh>
      </group>
    </group>
  );
};

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SharedMaterials } from "../render/materials.js";
import type { LootCrate } from "../sim/game.js";
import { MAP_CONTAINERS } from "../sim/game.js";
import { InklineModel } from "./InklineModel.js";
import { FOB_PREFABS, SPOKE_PREFABS, PREFAB_CATALOG, type PrefabInstance } from "../sim/prefabs.js";
import { globalCutaway } from "../render/cutaway.js";

interface SectorMapProps {
  crates: LootCrate[];
  onEnterAirlock?: () => void;
  lastDummyHitTick?: number;
  lastDummyHitSide?: "left" | "right";
}


/**
 * Reusable PrefabModel component that renders any PrefabInstance in 3D.
 * Connects directly to the authoritative PREFAB_CATALOG so visual props
 * and physical collision geometry always stay in 100% sync.
 */
const PrefabModel: React.FC<{
  instance: PrefabInstance;
  bulletTrapTex?: THREE.CanvasTexture | null;
}> = ({ instance, bulletTrapTex }) => {
  const def = PREFAB_CATALOG[instance.prefabKey];

  if (def?.assetKey) {
    return (
      <InklineModel
        assetKey={def.assetKey}
        position={instance.position}
        rotation={instance.rotation}
        scale={instance.scale ?? def.defaultScale}
      />
    );
  }

  if (instance.prefabKey === "bulletTrapBackstop") {
    return (
      <group position={instance.position}>
        <mesh position={[0, 1.4, 0]} rotation={[-0.15, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 2.6, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} metalness={0.6} />
        </mesh>
        {bulletTrapTex && (
          <mesh position={[0, 2.6, 0.12]}>
            <planeGeometry args={[3.0, 0.6]} />
            <meshBasicMaterial map={bulletTrapTex} transparent />
          </mesh>
        )}
      </group>
    );
  }

  if (instance.prefabKey === "treeOak") {
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Solid Oak Bark Trunk (Hard Bullet & Movement Cover) */}
        <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.35, 0.42, 3.2, 10]} />
          <meshStandardMaterial color="#382414" roughness={0.88} metalness={0.08} />
        </mesh>
        {/* Root Flaring */}
        <mesh position={[0, 0.2, 0]} receiveShadow>
          <cylinderGeometry args={[0.42, 0.65, 0.4, 8]} />
          <meshStandardMaterial color="#2d1c10" roughness={0.92} />
        </mesh>
        {/* Stylized Multi-Tiered Foliage Canopy (Soft Visual Cover) */}
        <group position={[0, 3.6, 0]}>
          {/* Main Central Crown */}
          <mesh castShadow receiveShadow>
            <dodecahedronGeometry args={[1.85, 1]} />
            <meshStandardMaterial color="#15803d" roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Upper Tier Accent */}
          <mesh position={[0.2, 0.85, -0.2]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1.2, 1]} />
            <meshStandardMaterial color="#16a34a" roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Flanking Side Lobe West */}
          <mesh position={[-0.65, -0.25, 0.35]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1.35, 1]} />
            <meshStandardMaterial color="#14532d" roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Flanking Side Lobe East */}
          <mesh position={[0.7, -0.2, -0.3]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1.25, 1]} />
            <meshStandardMaterial color="#15803d" roughness={0.7} metalness={0.05} />
          </mesh>
        </group>
      </group>
    );
  }

  if (instance.prefabKey === "treePine") {
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Slender Pine Trunk */}
        <mesh position={[0, 2.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.3, 4.2, 8]} />
          <meshStandardMaterial color="#231709" roughness={0.9} />
        </mesh>
        {/* 3-Tiered Conical Pine Fronds */}
        <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
          <coneGeometry args={[1.7, 2.1, 7]} />
          <meshStandardMaterial color="#065f46" roughness={0.7} />
        </mesh>
        <mesh position={[0, 3.4, 0]} castShadow receiveShadow>
          <coneGeometry args={[1.3, 1.8, 7]} />
          <meshStandardMaterial color="#047857" roughness={0.7} />
        </mesh>
        <mesh position={[0, 4.3, 0]} castShadow receiveShadow>
          <coneGeometry args={[0.85, 1.5, 7]} />
          <meshStandardMaterial color="#059669" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  if (instance.prefabKey === "foliageBush") {
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Low Dense Foliage Cluster (Soft Cover / Crouched Concealment) */}
        <mesh position={[0, 0.55, 0]} receiveShadow>
          <dodecahedronGeometry args={[0.75, 1]} />
          <meshStandardMaterial color="#16a34a" roughness={0.75} />
        </mesh>
        <mesh position={[0.4, 0.45, 0.2]} receiveShadow>
          <dodecahedronGeometry args={[0.55, 1]} />
          <meshStandardMaterial color="#22c55e" roughness={0.75} />
        </mesh>
        <mesh position={[-0.35, 0.45, -0.3]} receiveShadow>
          <dodecahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color="#15803d" roughness={0.75} />
        </mesh>
      </group>
    );
  }

  if (instance.prefabKey === "warehouseWall4m" || instance.prefabKey === "warehouseWall2m") {
    const width = instance.prefabKey === "warehouseWall4m" ? 4.0 : 2.0;
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Heavy Concrete Footing */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.5, 0.5]} />
          <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Corrugated Reinforced Metal Wall Panel */}
        <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 2.6, 0.4]} />
          <meshStandardMaterial color="#1e293b" roughness={0.65} metalness={0.4} />
        </mesh>
        {/* Top Steel Coping Lintel */}
        <mesh position={[0, 3.15, 0]} castShadow>
          <boxGeometry args={[width + 0.1, 0.1, 0.5]} />
          <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.6} />
        </mesh>
        {/* Vertical Flange Ribs */}
        {[-width / 2 + 0.15, width / 2 - 0.15].map((fx, i) => (
          <mesh key={i} position={[fx, 1.8, 0]} castShadow>
            <boxGeometry args={[0.15, 2.6, 0.46]} />
            <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
          </mesh>
        ))}
      </group>
    );
  }

  if (instance.prefabKey === "bridgeRail") {
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Reinforced Curb Barrier */}
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[7.0, 0.4, 0.35]} />
          <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.3} />
        </mesh>
        {/* Tubular Guardrails */}
        <mesh position={[0, 0.65, 0]} castShadow>
          <boxGeometry args={[7.0, 0.08, 0.08]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[7.0, 0.1, 0.1]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Vertical Uprights */}
        {[-3.2, -1.6, 0, 1.6, 3.2].map((ux, i) => (
          <mesh key={i} position={[ux, 0.65, 0]} castShadow>
            <boxGeometry args={[0.12, 0.9, 0.12]} />
            <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    );
  }

  if (instance.prefabKey === "bridgeDeck") {
    const [scaleX, , scaleZ] = Array.isArray(instance.scale) ? instance.scale : [instance.scale ?? 1, 1, instance.scale ?? 1];
    return (
      <group position={instance.position} rotation={instance.rotation}>
        {/* Heavy Steel Roadbed Deck */}
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <boxGeometry args={[scaleX, 0.1, scaleZ]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.3} />
        </mesh>
        {/* Concrete Safety Curb Borders */}
        <mesh position={[-scaleX / 2 + 0.2, 0.12, 0]}>
          <boxGeometry args={[0.35, 0.12, scaleZ]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
        <mesh position={[scaleX / 2 - 0.2, 0.12, 0]}>
          <boxGeometry args={[0.35, 0.12, scaleZ]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
        {/* Tactical Center Line */}
        <mesh position={[0, 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.2, scaleZ * 0.9]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
      </group>
    );
  }

  if (instance.prefabKey === "shootingRestBench") {
    return (
      <group position={instance.position}>
        <mesh position={[0, 0.85, 0]} receiveShadow castShadow>
          <boxGeometry args={[1.8, 0.08, 0.7]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.4} />
        </mesh>
        {[-0.75, 0.75].map((lx) =>
          [-0.25, 0.25].map((lz) => (
            <mesh key={`leg_${lx}_${lz}`} position={[lx, 0.42, lz]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.84, 8]} />
              <meshStandardMaterial color="#0f172a" metalness={0.7} />
            </mesh>
          ))
        )}
      </group>
    );
  }

  return null;
};


/**
 * 3D River Canal separating North and South Sector 7 districts.
 * Spans z in [16.5, 21.5] with water drag mechanics, concrete retaining walls,
 * edge foam, and bridge cutaways for the 3 tactical bridge choke points.
 */
const RiverCanal: React.FC = () => {
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (waterRef.current) {
      const t = clock.getElapsedTime();
      waterRef.current.position.y = 0.03 + Math.sin(t * 1.5) * 0.012;
    }
  });

  return (
    <group>
      {/* 1. Recessed Canal Bed / Deep Trench */}
      <mesh position={[0, -0.15, 19]} receiveShadow>
        <boxGeometry args={[150, 0.3, 5.0]} />
        <meshStandardMaterial color="#042f2e" roughness={0.9} />
      </mesh>

      {/* 2. Murky Industrial Water Surface */}
      <mesh
        ref={waterRef}
        position={[0, 0.03, 19]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[150, 5.0]} />
        <meshStandardMaterial
          color="#0f766e"
          roughness={0.2}
          metalness={0.3}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 3. Water Edge Foam Ribbons (North & South Embankments) */}
      <mesh position={[0, 0.045, 16.7]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 0.35]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.35} />
      </mesh>
      <mesh position={[0, 0.045, 21.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 0.35]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.35} />
      </mesh>

      {/* 4. North Concrete Retaining Wall Embankment (z = 16.5) */}
      <mesh position={[-59.5, 0.15, 16.5]} castShadow receiveShadow>
        <boxGeometry args={[31, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[-21.25, 0.15, 16.5]} castShadow receiveShadow>
        <boxGeometry args={[33.5, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[20.25, 0.15, 16.5]} castShadow receiveShadow>
        <boxGeometry args={[31.5, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[58.5, 0.15, 16.5]} castShadow receiveShadow>
        <boxGeometry args={[33, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* 5. South Concrete Retaining Wall Embankment (z = 21.5) */}
      <mesh position={[-59.5, 0.15, 21.5]} castShadow receiveShadow>
        <boxGeometry args={[31, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[-21.25, 0.15, 21.5]} castShadow receiveShadow>
        <boxGeometry args={[33.5, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[20.25, 0.15, 21.5]} castShadow receiveShadow>
        <boxGeometry args={[31.5, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[58.5, 0.15, 21.5]} castShadow receiveShadow>
        <boxGeometry args={[33, 0.35, 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
      </mesh>

      {/* 6. Concrete Embankment Stencil Linework */}
      <mesh position={[0, 0.33, 16.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 0.1]} />
        <meshBasicMaterial color="#151716" />
      </mesh>
      <mesh position={[0, 0.33, 21.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[150, 0.1]} />
        <meshBasicMaterial color="#151716" />
      </mesh>
    </group>
  );
};

export const SectorMap: React.FC<SectorMapProps> = React.memo(({ crates, lastDummyHitTick, lastDummyHitSide }) => {
  const mapRootRef = React.useRef<THREE.Group>(null);
  const [gateLabelTex, setGateLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [fobLabelTex, setFobLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [controlsDecalTex, setControlsDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [firingDecalTex, setFiringDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [lockerDecalTex, setLockerDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [airlockDecalTex, setAirlockDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [armorySignTex, setArmorySignTex] = useState<THREE.CanvasTexture | null>(null);
  const [commsSignTex, setCommsSignTex] = useState<THREE.CanvasTexture | null>(null);
  const [hologramMapTex, setHologramMapTex] = useState<THREE.CanvasTexture | null>(null);
  const [hazardStripeTex, setHazardStripeTex] = useState<THREE.CanvasTexture | null>(null);
  const [bulletTrapTex, setBulletTrapTex] = useState<THREE.CanvasTexture | null>(null);
  const [cqbSignTex, setCqbSignTex] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (mapRootRef.current) {
      globalCutaway.apply(mapRootRef.current);
    }
  }, []);

  useEffect(() => {
    const makeTex = (title: string, sub: string, accent: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, 512, 96);
      ctx.fillStyle = "rgba(22, 28, 24, 0.94)";
      ctx.roundRect(4, 4, 504, 88, 4);
      ctx.fill();

      ctx.strokeStyle = "rgba(173, 197, 139, 0.6)";
      ctx.lineWidth = 3;
      ctx.roundRect(4, 4, 504, 88, 4);
      ctx.stroke();

      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#adc58b";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, 256, 36);

      ctx.font = "14px monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(sub, 256, 68);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const makeStencilTex = (
      width: number,
      height: number,
      mainText: string,
      subText: string,
      accentColor: string
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, width, height);

      // Clean stenciled corner brackets
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      const bl = 24;
      ctx.beginPath();
      // TL
      ctx.moveTo(6, 6 + bl); ctx.lineTo(6, 6); ctx.lineTo(6 + bl, 6);
      // TR
      ctx.moveTo(width - 6 - bl, 6); ctx.lineTo(width - 6, 6); ctx.lineTo(width - 6, 6 + bl);
      // BL
      ctx.moveTo(6, height - 6 - bl); ctx.lineTo(6, height - 6); ctx.lineTo(6 + bl, height - 6);
      // BR
      ctx.moveTo(width - 6 - bl, height - 6); ctx.lineTo(width - 6, height - 6); ctx.lineTo(width - 6, height - 6 - bl);
      ctx.stroke();

      // Main Text
      ctx.font = "900 " + Math.floor(height * 0.40) + "px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
      ctx.shadowBlur = 6;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mainText, width / 2, height * 0.38);

      // Sub Text
      ctx.font = "bold " + Math.floor(height * 0.24) + "px monospace";
      ctx.fillStyle = accentColor;
      ctx.fillText(subText, width / 2, height * 0.74);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    setGateLabelTex(makeTex("SECTOR 7 COMBAT AIRLOCK", "COMBAT ZONE // WEAPONS HOT", "#d45538"));
    setFobLabelTex(makeTex("FORWARD OPERATING BASE", "SECTOR 7 STAGING OUTPOST", "#151716"));
    setControlsDecalTex(null);
    setFiringDecalTex(
      makeStencilTex(800, 160, "➔ LANE 01 // BALLISTIC RANGE", "5M - 10M TARGET CALIBRATION", "#f59e0b")
    );
    setLockerDecalTex(
      makeStencilTex(800, 160, "➔ CACHE 02 // SUPPLY LOCKER", "QUICK-LOOT STARTER CRATE", "#10b981")
    );
    setAirlockDecalTex(
      makeStencilTex(1024, 160, "▲ SECTOR 7 GATEWAY ▲", "EXTRACTION ZONE DEPLOYMENT", "#ef4444")
    );
    setArmorySignTex(
      makeTex("ARMORY // BAY 01", "WEAPONS CALIBRATION & MUNITIONS", "#f59e0b")
    );
    setCommsSignTex(
      makeTex("TACTICAL OPERATIONS", "SECTOR 7 SAT-LINK & TELEMETRY", "#38bdf8")
    );
    setBulletTrapTex(
      makeStencilTex(800, 160, "BALLISTIC RETARDER // AP TRAP", "LIVE FIRE BACKSTOP - EAR PRO REQ", "#ef4444")
    );
    setCqbSignTex(
      makeStencilTex(800, 160, "CQB STRIKE CAGE // MELEE RANGE", "STRIKE PAD IMPACT CALIBRATION", "#0284c7")
    );

    // Hazard Stripes Texture
    const hazardCanvas = document.createElement("canvas");
    hazardCanvas.width = 256;
    hazardCanvas.height = 64;
    const hctx = hazardCanvas.getContext("2d");
    if (hctx) {
      hctx.fillStyle = "#0f172a";
      hctx.fillRect(0, 0, 256, 64);
      hctx.fillStyle = "#f59e0b";
      const sw = 24;
      for (let x = -64; x < 320; x += sw * 2) {
        hctx.beginPath();
        hctx.moveTo(x, 0);
        hctx.lineTo(x + sw, 0);
        hctx.lineTo(x + sw + 64, 64);
        hctx.lineTo(x + 64, 64);
        hctx.closePath();
        hctx.fill();
      }
      const htex = new THREE.CanvasTexture(hazardCanvas);
      htex.wrapS = THREE.RepeatWrapping;
      htex.wrapT = THREE.RepeatWrapping;
      htex.repeat.set(6, 1);
      htex.needsUpdate = true;
      setHazardStripeTex(htex);
    }

    // Holographic Radar/Map Canvas Texture
    const holoCanvas = document.createElement("canvas");
    holoCanvas.width = 512;
    holoCanvas.height = 512;
    const sctx = holoCanvas.getContext("2d");
    if (sctx) {
      sctx.fillStyle = "rgba(11, 24, 39, 0.92)";
      sctx.fillRect(0, 0, 512, 512);

      // Grid
      sctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
      sctx.lineWidth = 1;
      for (let p = 32; p < 512; p += 32) {
        sctx.beginPath(); sctx.moveTo(p, 0); sctx.lineTo(p, 512); sctx.stroke();
        sctx.beginPath(); sctx.moveTo(0, p); sctx.lineTo(512, p); sctx.stroke();
      }

      // Radar Concentric Rings
      sctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      sctx.lineWidth = 2;
      sctx.beginPath(); sctx.arc(256, 256, 70, 0, Math.PI * 2); sctx.stroke();
      sctx.beginPath(); sctx.arc(256, 256, 140, 0, Math.PI * 2); sctx.stroke();
      sctx.beginPath(); sctx.arc(256, 256, 210, 0, Math.PI * 2); sctx.stroke();

      // Heading and coordinates
      sctx.font = "bold 18px monospace";
      sctx.fillStyle = "#38bdf8";
      sctx.textAlign = "center";
      sctx.fillText("SECTOR 7 TACTICAL TOPOLOGY", 256, 32);

      // Zone markers
      sctx.font = "bold 13px monospace";
      sctx.fillStyle = "#4ade80";
      sctx.fillText("● LOGISTICS DEPOT [CTR]", 256, 220);
      sctx.fillText("▲ CRUDE REFINERY [NW]", 130, 130);
      sctx.fillText("■ FREIGHT TERMINAL [NE]", 380, 130);
      sctx.fillText("✦ POWER SUBSTATION [SW]", 130, 390);
      sctx.fillText("▼ LZ-01 EXFIL REDOUBT [SE]", 380, 390);

      // Telemetry Box
      sctx.strokeStyle = "#38bdf8";
      sctx.strokeRect(30, 440, 452, 50);
      sctx.fillStyle = "#fbbf24";
      sctx.font = "12px monospace";
      sctx.fillText("STATUS: HOSTILE ZONE // EXTRACTION BEACONS ACTIVE", 256, 465);
      sctx.fillStyle = "#94a3b8";
      sctx.fillText("SURVEILLANCE: 7 SCAV COMBATANTS // TURRET DEFENSES", 256, 482);

      const stex = new THREE.CanvasTexture(holoCanvas);
      stex.needsUpdate = true;
      setHologramMapTex(stex);
    }
  }, []);

  const mergedSeamsGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    let vertOffset = 0;

    function addQuad(minX: number, maxX: number, minZ: number, maxZ: number, y: number) {
      positions.push(
        minX, y, minZ,
        maxX, y, minZ,
        maxX, y, maxZ,
        minX, y, maxZ
      );
      indices.push(
        vertOffset, vertOffset + 1, vertOffset + 2,
        vertOffset, vertOffset + 2, vertOffset + 3
      );
      vertOffset += 4;
    }

    // 27 Z seams
    for (let i = 0; i < 27; i++) {
      const z = -80 + i * 6;
      addQuad(-80, 80, z - 0.025, z + 0.025, -0.045);
    }
    // 27 X seams
    for (let i = 0; i < 27; i++) {
      const x = -80 + i * 6;
      addQuad(x - 0.025, x + 0.025, -80, 80, -0.045);
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  const mergedRunwayMarkersGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    let vertOffset = 0;

    function addQuad(minX: number, maxX: number, minZ: number, maxZ: number, y: number) {
      positions.push(
        minX, y, minZ,
        maxX, y, minZ,
        maxX, y, maxZ,
        minX, y, maxZ
      );
      indices.push(
        vertOffset, vertOffset + 1, vertOffset + 2,
        vertOffset, vertOffset + 2, vertOffset + 3
      );
      vertOffset += 4;
    }

    // Flanking guide strips (-11.2 and +11.2)
    addQuad(-11.35, -11.05, -46, 80, 0.02);
    addQuad(11.05, 11.35, -46, 80, 0.02);

    // 6 transverse vehicle markers
    const markers = [-35, -15, 5, 25, 45, 65];
    for (const z of markers) {
      addQuad(-8, 8, z - 0.3, z + 0.3, 0.025);
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  return (
    <group ref={mapRootRef}>
      {/* =========================================================================
          1. MAIN DEPOT FLOOR & PERIMETER WALLS (Spoke Area z: -50 to +80)
         ========================================================================= */}
      {/* Heavy Industrial Ground Floor (Tactical Military Concrete Tarmac) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#dde0e4" roughness={0.90} metalness={0.05} />
      </mesh>

      {/* Concrete Slab Grid Joint Seams (Merged Geometry - 1 draw call) */}
      <mesh geometry={mergedSeamsGeometry} material={SharedMaterials.seamJoint} receiveShadow />

      {/* Central Tactical Logistics Runway (Concrete Slabs) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 17]} material={SharedMaterials.runwayConcrete} receiveShadow>
        <planeGeometry args={[22, 126]} />
      </mesh>

      {/* Flanking Guide Strips & Runway Vehicle Markers (Merged Geometry - 1 draw call) */}
      <mesh geometry={mergedRunwayMarkersGeometry} material={SharedMaterials.inkBlack} receiveShadow />

      {/* Spoke Perimeter Boundary Walls (Slate Metal with Ink Linework) */}
      <mesh position={[0, 2, 80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2, -80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[-80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>

      {/* =========================================================================
          2. SOCIAL PRESENCE HUB: FORWARD OPERATIONS BASE (FOB) OUTPOST (z: -85 to -50)
         ========================================================================= */}

      {/* --- FOB STRUCTURAL FOUNDATION & TACTICAL FLOORING --- */}
      {/* Heavy Industrial Slate Sub-Base */}
      <mesh position={[0, 0.04, -63]} receiveShadow castShadow>
        <boxGeometry args={[17.2, 0.1, 22.8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Elevated Reinforced Concrete Staging Deck */}
      <mesh position={[0, 0.10, -63]} receiveShadow castShadow>
        <boxGeometry args={[15.6, 0.12, 21.2]} />
        <meshStandardMaterial color="#334155" roughness={0.82} metalness={0.15} />
      </mesh>
      {/* West Firing Bay Floor Inset */}
      <mesh position={[-5.0, 0.11, -63]} receiveShadow>
        <boxGeometry args={[4.8, 0.122, 19.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.88} />
      </mesh>
      {/* East Ops & CQB Floor Inset */}
      <mesh position={[5.0, 0.11, -63]} receiveShadow>
        <boxGeometry args={[4.8, 0.122, 19.4]} />
        <meshStandardMaterial color="#1e293b" roughness={0.88} />
      </mesh>
      {/* Perimeter Safety Hazard Curb Strips */}
      {hazardStripeTex && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-7.5, 0.165, -63]} receiveShadow>
            <planeGeometry args={[0.35, 20.8]} />
            <meshBasicMaterial map={hazardStripeTex} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7.5, 0.165, -63]} receiveShadow>
            <planeGeometry args={[0.35, 20.8]} />
            <meshBasicMaterial map={hazardStripeTex} />
          </mesh>
        </>
      )}

      {/* --- NORTH REINFORCED BLAST HANGAR WALL (Behind Spawn at z = -73.0) --- */}
      <mesh position={[0, 3.2, -73.5]} receiveShadow castShadow>
        <boxGeometry args={[16.8, 6.4, 1.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.7, -73.0]} receiveShadow castShadow>
        <boxGeometry args={[6.4, 5.2, 0.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, 2.7, -72.7]}>
        <boxGeometry args={[0.06, 5.0, 0.2]} />
        <meshStandardMaterial color="#090d16" roughness={0.4} />
      </mesh>
      {[-2.0, -0.9, 0.9, 2.0].map((rx, idx) => (
        <mesh key={`door_rib_${idx}`} position={[rx, 2.7, -72.75]}>
          <boxGeometry args={[0.15, 4.8, 0.12]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}
      {hazardStripeTex && (
        <mesh position={[0, 5.2, -72.7]}>
          <planeGeometry args={[6.2, 0.45]} />
          <meshBasicMaterial map={hazardStripeTex} />
        </mesh>
      )}
      <group position={[-2.8, 5.2, -72.6]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.14, 0.25, 12]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.8} />
        </mesh>
        <pointLight color="#f59e0b" intensity={0.5} distance={6} />
      </group>
      <group position={[2.8, 5.2, -72.6]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.14, 0.25, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.8} />
        </mesh>
        <pointLight color="#ef4444" intensity={0.5} distance={6} />
      </group>
      <mesh position={[-8.0, 3.2, -73.0]} receiveShadow castShadow>
        <boxGeometry args={[1.2, 6.4, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>
      <mesh position={[8.0, 3.2, -73.0]} receiveShadow castShadow>
        <boxGeometry args={[1.2, 6.4, 1.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} />
      </mesh>
      <group position={[0, 4.4, -72.8]}>
        <mesh>
          <planeGeometry args={[8.0, 1.5]} />
          {fobLabelTex && <meshBasicMaterial map={fobLabelTex} transparent />}
        </mesh>
      </group>

      {/* --- EAST & WEST PERIMETER ENCLOSURE WALLS WITH STRUCTURAL RIBS & VENTS --- */}
      <mesh position={[-8.2, 3.2, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[0.8, 6.4, 21.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[8.2, 3.2, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[0.8, 6.4, 21.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {[-71.5, -67.0, -62.5, -58.0, -53.5].map((zCol, idx) => (
        <React.Fragment key={`buttress_${idx}`}>
          <mesh position={[-7.75, 3.2, zCol]} receiveShadow castShadow>
            <boxGeometry args={[0.3, 6.4, 0.6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
          </mesh>
          <mesh position={[7.75, 3.2, zCol]} receiveShadow castShadow>
            <boxGeometry args={[0.3, 6.4, 0.6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
          </mesh>
        </React.Fragment>
      ))}
      <InklineModel assetKey="ventFan" position={[-7.7, 4.2, -68.0]} rotation={[0, Math.PI / 2, 0]} scale={1.4} />
      <InklineModel assetKey="ventFan" position={[7.7, 4.2, -68.0]} rotation={[0, -Math.PI / 2, 0]} scale={1.4} />
      <InklineModel assetKey="ventFan" position={[-7.7, 4.2, -58.0]} rotation={[0, Math.PI / 2, 0]} scale={1.4} />
      <InklineModel assetKey="ventFan" position={[7.7, 4.2, -58.0]} rotation={[0, -Math.PI / 2, 0]} scale={1.4} />

      {/* --- OVERHEAD SERVICE BAY ARCHES & GANTRY CRANE TRUSS --- */}
      <InklineModel assetKey="serviceBayArch" position={[0, 0, -68.5]} scale={[1.9, 1.8, 1.8]} />
      <InklineModel assetKey="serviceBayArch" position={[0, 0, -57.0]} scale={[1.9, 1.8, 1.8]} />
      <mesh position={[0, 5.2, -63.0]} castShadow>
        <boxGeometry args={[0.3, 0.4, 18.0]} />
        <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.7} />
      </mesh>
      <spotLight position={[0, 5.0, -66.0]} target-position={[0, 0, -66.0]} color="#ffedd5" intensity={0.8} angle={0.8} penumbra={0.6} />
      <spotLight position={[0, 5.0, -54.0]} target-position={[0, 0, -54.0]} color="#bae6fd" intensity={0.85} angle={0.8} penumbra={0.6} />

      {/* =========================================================================
          AUTHORITATIVE FOB ENVIRONMENT PREFABS (Visual 3D & Physical Collision)
         ========================================================================= */}
      {FOB_PREFABS.map((inst) => (
        <PrefabModel key={inst.id} instance={inst} bulletTrapTex={bulletTrapTex} />
      ))}

      {/* Armory Wall Weapon Rack & Signboard */}
      <group position={[-5.6, 0, -72.6]}>
        <mesh position={[0, 1.8, 0]}>
          <boxGeometry args={[2.8, 1.6, 0.08]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.5} />
        </mesh>
        <InklineModel assetKey="rifle" position={[0, 2.25, 0.08]} rotation={[0, 0, 0]} scale={1.2} />
        <InklineModel assetKey="shotgun" position={[0, 1.65, 0.08]} rotation={[0, 0, 0]} scale={1.2} />
        <InklineModel assetKey="sword" position={[0, 1.10, 0.08]} rotation={[0, 0, 0]} scale={1.2} />
      </group>
      <InklineModel assetKey="electricalPanelWall" position={[-7.6, 1.6, -69.8]} rotation={[0, Math.PI / 2, 0]} scale={1.4} />
      <InklineModel assetKey="crateHeavyWooden" position={[-3.8, 0.72, -71.2]} scale={1.0} />
      <group position={[-5.6, 2.8, -69.8]}>
        <mesh>
          <planeGeometry args={[3.2, 0.7]} />
          {armorySignTex && <meshBasicMaterial map={armorySignTex} transparent />}
        </mesh>
      </group>

      {/* Tactical Holographic Map Display Table */}
      <group position={[5.1, 0, -67.2]}>
        <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[0.55, 0.65, 0.7, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.7} />
        </mesh>
        <mesh position={[0, 1.35, 0]} rotation={[-Math.PI / 4, 0, 0]}>
          <planeGeometry args={[2.2, 1.5]} />
          {hologramMapTex && <meshBasicMaterial map={hologramMapTex} transparent side={THREE.DoubleSide} />}
        </mesh>
        <pointLight position={[0, 1.35, 0]} color="#38bdf8" intensity={0.6} distance={4} />
      </group>
      <group position={[5.1, 2.8, -69.8]}>
        <mesh>
          <planeGeometry args={[3.2, 0.7]} />
          {commsSignTex && <meshBasicMaterial map={commsSignTex} transparent />}
        </mesh>
      </group>

      {/* Target Dummies with Spring Recoil (Dynamic hit detection & checklist progression) */}
      <FOBTargetDummy
        position={[-5.0, 0, -64]}
        color="#d97706"
        side="left"
        lastHitTick={lastDummyHitTick}
        hitSide={lastDummyHitSide}
      />
      <FOBTargetDummy
        position={[5.0, 0, -64]}
        color="#0284c7"
        side="right"
        lastHitTick={lastDummyHitTick}
        hitSide={lastDummyHitSide}
      />

      {/* Medical Station & Stencils */}
      <group position={[7.5, 1.8, -63.0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[0.3, 0.8, 0.6]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} />
        </mesh>
        <mesh position={[-0.16, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.35, 0.35]} />
          <meshBasicMaterial color="#10b981" />
        </mesh>
      </group>
      <InklineModel assetKey="palletMetal" position={[4.5, 0.08, -63.0]} scale={1.4} />

      {/* Floor Decals & Distance Markers */}
      {firingDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.8, 0.168, -58.8]} receiveShadow>
          <planeGeometry args={[3.2, 0.65]} />
          <meshBasicMaterial map={firingDecalTex} transparent opacity={0.88} />
        </mesh>
      )}
      <group position={[-5.0, 0.166, -59.0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.8, 0.15]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
      <group position={[-5.0, 0.166, -54.0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.8, 0.15]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
      {lockerDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.8, 0.168, -58.8]} receiveShadow>
          <planeGeometry args={[3.2, 0.65]} />
          <meshBasicMaterial map={lockerDecalTex} transparent opacity={0.88} />
        </mesh>
      )}
      {cqbSignTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.0, 0.168, -65.2]} receiveShadow>
          <planeGeometry args={[3.0, 0.6]} />
          <meshBasicMaterial map={cqbSignTex} transparent opacity={0.88} />
        </mesh>
      )}

      {/* Guidance Runway & Ingress Chevrons */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.165, -61]} receiveShadow>
        <planeGeometry args={[3.2, 16]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.75} roughness={0.8} />
      </mesh>
      {[-67, -64, -61, -58, -55].map((zPos, idx) => (
        <group key={`chevron_${idx}`} position={[0, 0.170, zPos]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[1.8, 0.28]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[-0.7, 0.2, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[0.5, 0.2]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={[0.7, 0.2, 0]} rotation={[0, 0, Math.PI / 4]}>
            <planeGeometry args={[0.5, 0.2]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      ))}

      {/* Hazard Warning Threshold & Airlock Decals */}
      {hazardStripeTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.169, -54.0]} receiveShadow>
          <planeGeometry args={[6.8, 0.8]} />
          <meshBasicMaterial map={hazardStripeTex} />
        </mesh>
      )}
      {airlockDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.170, -54.8]} receiveShadow>
          <planeGeometry args={[4.2, 0.65]} />
          <meshBasicMaterial map={airlockDecalTex} transparent opacity={0.92} />
        </mesh>
      )}
      <InklineModel assetKey="grateDrain" position={[-2.2, 0.08, -53.2]} scale={1.5} />
      <InklineModel assetKey="grateDrain" position={[2.2, 0.08, -53.2]} scale={1.5} />

      {/* =========================================================================
          3. SPATIAL AIRLOCK GATEWAY (Bridge between FOB Hub & Depot Spoke at z: -52)
         ========================================================================= */}
      <group position={[0, 0, -52]}>
        {/* Gateway Teleporter Pad */}
        <InklineModel assetKey="teleporterPad" position={[0, 0.05, 0]} scale={2.6} />

        {/* Warp Beacons rendered via authoritative FOB_PREFABS */}

        {/* Graphic Security Boundary Ring (#151716 Pitch Black Ink) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[2.8, 3.1, 32]} />
          <meshBasicMaterial color="#151716" side={THREE.DoubleSide} />
        </mesh>

        {/* Floating Spatial Airlock Banner */}
        <group position={[0, 3.8, 0]}>
          <mesh>
            <planeGeometry args={[4.2, 0.8]} />
            {gateLabelTex && <meshBasicMaterial map={gateLabelTex} transparent side={THREE.DoubleSide} />}
          </mesh>
        </group>
      </group>



      {/* =========================================================================
          4. INSTANCED RAID SPOKE: SECTOR 7 DEPOT CONTAINERS & COVER
         ========================================================================= */}
      
      {/* =========================================================================
          AUTHORITATIVE SECTOR 7 SPOKE PREFABS (Trees, Rooms, Bridges, Maze)
         ========================================================================= */}
      <RiverCanal />

      {/* Logistics Command Warehouse Floor Slab & Room Ground Linework */}
      <group position={[20.5, 0, -6.5]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[9.2, 0.04, 13.2]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.2} />
        </mesh>
        {/* Room Division Grid Decal */}
        <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[8.8, 12.8]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
      </group>

      {/* Pumping Station Bunker Floor Slab */}
      <group position={[-24, 0, 46]}>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <boxGeometry args={[12.2, 0.04, 12.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} metalness={0.3} />
        </mesh>
      </group>

      {/* Authoritative Prefab 3D Instances */}
      {SPOKE_PREFABS.map((inst) => (
        <PrefabModel key={inst.id} instance={inst} />
      ))}

      {/* Real 3D Inkline Cargo Containers derived directly from unified MAP_CONTAINERS definition */}
      {MAP_CONTAINERS.map((c, idx) => (
        <InklineContainer key={c.id} position={c.position} rotation={c.rotation} index={idx} />
      ))}

      
      {/* =========================================================================
          4B. SURVIV.IO SCALE TACTICAL LEVEL DESIGN & MULTI-ZONE INDUSTRIAL COMPLEX
         ========================================================================= */}

      {/* -------------------------------------------------------------------------
          ZONE 1: CENTRAL CONTESTED LOGISTICS DEPOT & CARGO PORT (x: -16..16, z: -15..25)
          ------------------------------------------------------------------------- */}
      {/* Overhead Gantry Crane spanning central logistics avenue */}
      <InklineModel assetKey="gantryCrane" position={[-14, 0, -5]} scale={[2.0, 2.0, 2.0]} />

      {/* Central Staging Cargo Platform with tactical cover crates */}
      <InklineModel assetKey="platformStaging" position={[12, 0, 5]} scale={[1.8, 1.4, 1.8]} />
      <InklineModel assetKey="cargoContainerOpen" position={[-12.5, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={1.2} />
      <InklineModel assetKey="cargoContainerShort" position={[12.5, 0, -11]} rotation={[0, Math.PI / 2, 0]} scale={1.2} />

      {/* Pallet Stacks and Heavy Cargo Caches */}
      <InklineModel assetKey="stackedPalletsTall" position={[-7, 0, -8]} scale={1.5} />
      <InklineModel assetKey="palletMetal" position={[7, 0, -8]} scale={1.6} />
      <InklineModel assetKey="crateHeavyWooden" position={[-7, 0, 8]} scale={1.4} />
      <InklineModel assetKey="crateMilitary" position={[7, 0, 8]} scale={1.4} />

      {/* Central Logistics Highway Chicanes (Providing leap-frogging cover down main avenue) */}
      <InklineModel assetKey="barrierConcrete" position={[-2.8, 0, -32]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrierWater" position={[-0.5, 0, -32]} scale={1.3} />

      <InklineModel assetKey="barrierConcrete" position={[2.8, 0, -18]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrel" position={[5.2, 0, -18]} scale={1.2} />

      <InklineModel assetKey="barrierConcrete" position={[-2.8, 0, -4]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="trafficCone" position={[-0.8, 0, -4]} scale={1.4} />

      <InklineModel assetKey="barrierConcrete" position={[2.8, 0, 14]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrierWater" position={[5.0, 0, 14]} scale={1.3} />

      <InklineModel assetKey="barrierConcrete" position={[-2.8, 0, 30]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrel" position={[-5.2, 0, 30]} scale={1.2} />

      <InklineModel assetKey="barrierConcrete" position={[2.8, 0, 46]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="trafficCone" position={[4.8, 0, 46]} scale={1.4} />

      {/* -------------------------------------------------------------------------
          ZONE 2: NORTHWEST CHEMICAL & FUEL REFINERY (x: -65..-20, z: -45..-5)
          ------------------------------------------------------------------------- */}
      {/* West Warehouse Beta */}
      <InklineModel assetKey="warehouse" position={[-28, 0, -26]} scale={[1.75, 1.8, 1.75]} />
      <InklineModel assetKey="ventFan" position={[-28, 9.8, -26]} scale={2.0} />
      <InklineModel assetKey="electricalCabinet" position={[-22.2, 0, -23]} rotation={[0, -Math.PI / 2, 0]} scale={1.5} />
      <InklineModel assetKey="ladder" position={[-22.2, 0, -26]} rotation={[0, Math.PI / 2, 0]} scale={1.8} />

      {/* Refinery Heavy Storage Tanks */}
      <InklineModel assetKey="tankVertical" position={[-46, 0, -20]} scale={[2.2, 2.2, 2.2]} />
      <InklineModel assetKey="tankHorizontal" position={[-46, 0, -35]} scale={[2.0, 2.0, 2.0]} />
      <InklineModel assetKey="tankSpherical" position={[-35, 0, -38]} scale={[2.2, 2.2, 2.2]} />
      <InklineModel assetKey="watertankIndustrial" position={[-22, 0, -40]} scale={1.8} />

      {/* Pipe Network & Manifolds */}
      <InklineModel assetKey="pipeManifold" position={[-40, 0, -28]} scale={2.0} />
      <InklineModel assetKey="pipeStraight" position={[-40, 3.5, -28]} rotation={[Math.PI / 2, 0, 0]} scale={[1.5, 1.5, 3.5]} />
      <InklineModel assetKey="valveWheel" position={[-36, 1.2, -28]} scale={1.6} />

      {/* Elevated Catwalk & Stairs connecting refinery to warehouse */}
      <InklineModel assetKey="catwalkBridge" position={[-28, 4.0, -14]} rotation={[0, 0, 0]} scale={[2.0, 1.8, 2.5]} />
      <InklineModel assetKey="stairFlight" position={[-22, 0, -14]} rotation={[0, Math.PI / 2, 0]} scale={1.6} />

      {/* Toxic Barrels & Heavy Cover */}
      <InklineModel assetKey="barrelToxic" position={[-42, 0, -16]} scale={1.4} />
      <InklineModel assetKey="barrelToxic" position={[-40.5, 0, -17]} scale={1.4} />
      <InklineModel assetKey="barrelStack" position={[-33, 0, -10.5]} scale={1.6} />
      <InklineModel assetKey="crateHeavyWooden" position={[-36, 0, -18]} scale={1.4} />

      {/* -------------------------------------------------------------------------
          ZONE 3: SOUTHWEST FREIGHT TERMINAL & HEAVY TRUCK DOCKS (x: -65..-20, z: 10..65)
          ------------------------------------------------------------------------- */}
      {/* West Warehouse Alpha & Annex Loading Bay */}
      <InklineModel assetKey="warehouse" position={[-28, 0, 10]} scale={[1.75, 1.8, 1.75]} />
      <InklineModel assetKey="warehouseBay" position={[-28, 0, 24]} scale={[1.75, 1.8, 1.75]} />
      <InklineModel assetKey="ventFan" position={[-28, 9.8, 10]} scale={2.0} />

      {/* Covered Service Bay & Heavy Maintenance Yard */}
      <InklineModel assetKey="serviceBayCanopy" position={[-30, 0, -2]} scale={2.0} />
      <InklineModel assetKey="serviceBayArch" position={[-30, 0, -2]} scale={2.0} />
      <InklineModel assetKey="serviceBayWorkbench" position={[-27, 0, -2]} rotation={[0, -Math.PI / 2, 0]} scale={1.6} />
      <InklineModel assetKey="machineHydraulicPress" position={[-33, 0, -2]} scale={1.8} />
      <InklineModel assetKey="cableSpoolMetal" position={[-34, 0, 4]} scale={1.7} />

      {/* Raised Loading Platform & Truck Dock */}
      <InklineModel assetKey="loadingPlatform" position={[-38, 0, 28]} scale={[2.0, 1.8, 2.0]} />
      <InklineModel assetKey="loadingPlatformRamp" position={[-38, 0, 32.5]} rotation={[0, Math.PI, 0]} scale={[2.0, 1.8, 2.0]} />
      <InklineModel assetKey="loadingDockLadder" position={[-33.8, 0, 28]} rotation={[0, -Math.PI / 2, 0]} scale={1.8} />

      {/* CQB Alleys: Dumpsters, Scrap Piles & Planters */}
      <InklineModel assetKey="dumpster" position={[-42, 0, 10]} rotation={[0, Math.PI / 2, 0]} scale={1.3} />
      <InklineModel assetKey="dumpster" position={[-48, 0, 30]} rotation={[0, Math.PI / 2, 0]} scale={1.3} />
      <InklineModel assetKey="debrisScrapPile" position={[-20, 0, 34]} scale={1.8} />
      <InklineModel assetKey="scrapIBeam" position={[-22, 0, 36]} scale={1.7} />
      <InklineModel assetKey="planterConcrete" position={[-18, 0, 16]} scale={1.5} />
      <InklineModel assetKey="planterConcrete" position={[-18, 0, 24]} scale={1.5} />
      <InklineModel assetKey="bollardHeavy" position={[-16, 0, 18]} scale={1.6} />
      <InklineModel assetKey="bollardHeavy" position={[-16, 0, 22]} scale={1.6} />

      {/* Fortified Emergency Bunker Compound Perimeter */}
      <InklineModel assetKey="barrierConcrete" position={[-40, 0, -41]} rotation={[0, Math.PI / 4, 0]} scale={1.35} />
      <InklineModel assetKey="barrel" position={[-42, 0, -38]} scale={1.2} />

      {/* -------------------------------------------------------------------------
          ZONE 4: NORTHEAST POWER SUBSTATION & HEAVY INDUSTRY (x: 20..65, z: -45..10)
          ------------------------------------------------------------------------- */}
      {/* High-Voltage Transformer Substation */}
      <InklineModel assetKey="machineTransformer" position={[38, 0, -18]} scale={2.0} />
      <InklineModel assetKey="generatorLarge" position={[46, 0, -18]} scale={2.0} />
      <InklineModel assetKey="electricalPanelWall" position={[42, 0, -10]} scale={1.8} />
      <InklineModel assetKey="cableSpoolMetal" position={[34, 0, -10]} scale={1.7} />
      <InklineModel assetKey="cableSpool" position={[30, 0, -14]} scale={1.7} />

      {/* Towering Smokestacks */}
      <InklineModel assetKey="smokestackTall" position={[56, 0, -32]} scale={[2.2, 2.5, 2.2]} />
      <InklineModel assetKey="smokestackTwin" position={[56, 0, -16]} scale={[2.0, 2.2, 2.0]} />

      {/* Heavy Conveyor Feed System */}
      <InklineModel assetKey="conveyor" position={[32, 0, -5]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="conveyorIncline" position={[32, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />

      {/* Substation Perimeter Security Fencing & Access Gate */}
      <InklineModel assetKey="fenceWireMesh" position={[48, 0, -10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceWireMesh" position={[48, 0, 10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceGate" position={[28, 0, -6]} scale={2.2} />

      {/* -------------------------------------------------------------------------
          ZONE 5: SOUTHEAST EXTRACTION REDOUBT & MILITARY LZ-01 (x: 20..65, z: 18..65)
          ------------------------------------------------------------------------- */}
      {/* Military LZ Checkpoint Shelter */}
      <InklineModel assetKey="busStopShelter" position={[30, 0, 26]} rotation={[0, Math.PI / 2, 0]} scale={1.5} />
      <InklineModel assetKey="securityCameraPole" position={[28, 0, 32]} scale={1.8} />
      <InklineModel assetKey="streetLampDouble" position={[42, 0, 26]} scale={1.8} />

      {/* Fortified LZ-01 Double Barrier Revetments */}
      <InklineModel assetKey="barrierConcrete" position={[34, 0, 36]} rotation={[0, 0, 0]} scale={1.35} />
      <InklineModel assetKey="barrierConcrete" position={[34, 0, 48]} rotation={[0, 0, 0]} scale={1.35} />
      <InklineModel assetKey="barrierConcrete" position={[50, 0, 36]} rotation={[0, 0, 0]} scale={1.35} />
      <InklineModel assetKey="barrierConcrete" position={[50, 0, 48]} rotation={[0, 0, 0]} scale={1.35} />

      {/* Barbed Wire Enclosure */}
      <InklineModel assetKey="fenceBarbed" position={[28, 0, 42]} rotation={[0, Math.PI / 2, 0]} scale={1.8} />
      <InklineModel assetKey="fenceBarbed" position={[54, 0, 42]} rotation={[0, Math.PI / 2, 0]} scale={1.8} />

      {/* Water Barriers & Traffic Cones lining the LZ entrance */}
      <InklineModel assetKey="barrierWater" position={[38, 0, 28]} scale={1.4} />
      <InklineModel assetKey="barrierWater" position={[46, 0, 28]} scale={1.4} />
      <InklineModel assetKey="trafficCone" position={[36, 0, 28]} scale={1.5} />
      <InklineModel assetKey="trafficCone" position={[48, 0, 28]} scale={1.5} />

      {/* Fuel Drums & Military Supplies */}
      <InklineModel assetKey="barrel" position={[46, 0, 42]} scale={1.2} />
      <InklineModel assetKey="barrel" position={[42, 0, 48]} scale={1.2} />
      <InklineModel assetKey="crateMilitary" position={[38, 0, 52]} scale={1.5} />
      <InklineModel assetKey="crateHeavyWooden" position={[44, 0, 52]} scale={1.5} />

      {/* -------------------------------------------------------------------------
          TACTICAL LIGHTING, CORNER TOWERS & DRAINAGE INFRASTRUCTURE
          ------------------------------------------------------------------------- */}
      {/* High-Mast Street Lamps at Key Intersections */}
      <InklineModel assetKey="streetLamp" position={[-12, 0, -20]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[-12, 0, 10]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[15, 0, -10]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[15, 0, 20]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[-12, 0, 40]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[15, 0, 40]} scale={1.8} />
      <InklineModel assetKey="securityCameraPole" position={[-4, 0, -50]} scale={1.8} />

      {/* Drainage Trench Grates along Highway Gutters */}
      <InklineModel assetKey="grateDrain" position={[-4, 0.05, -15]} scale={1.8} />
      <InklineModel assetKey="grateDrain" position={[4, 0.05, -15]} scale={1.8} />
      <InklineModel assetKey="grateDrain" position={[-4, 0.05, 20]} scale={1.8} />
      <InklineModel assetKey="grateDrain" position={[4, 0.05, 20]} scale={1.8} />

      {/* Perimeter Floodlight Towers */}
      <InklineModel assetKey="floodlightTower" position={[-86, 0, 86]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="floodlightTower" position={[86, 0, 86]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="floodlightTower" position={[-86, 0, -86]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="floodlightTower" position={[86, 0, -86]} scale={2.0} castShadow={false} />

      {/* =========================================================================
          5. MODULAR DISTRICT STRUCTURES (Strictly outside playable bounds |x| > 82 or |z| > 82)
          ========================================================================= */}
      <InklineModel assetKey="floodlightTower" position={[95, 0, 0]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="cargoContainer" position={[95, 0, 20]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="floodlightTower" position={[-95, 0, 0]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="cargoContainer" position={[-95, 0, -20]} scale={2.0} castShadow={false} />
      <InklineModel assetKey="barrierConcrete" position={[0, 0, 95]} scale={3.0} castShadow={false} />
      <InklineModel assetKey="barrierConcrete" position={[0, 0, -95]} scale={3.0} castShadow={false} />

      {/* =========================================================================
          6. TARKOV TACTICAL CONTAINERS & LOOT CRATES
         ========================================================================= */}
      {crates.map((crate) => (
        <group key={crate.id} position={[crate.x, 0, crate.z]}>
          {crate.containerType === "dumpster" ? (
            <group position={[0, 0, 0]}>
              <InklineModel assetKey="dumpster" scale={1.25} />
            </group>
          ) : crate.containerType === "barrel" ? (
            <group position={[0, 0, 0]}>
              <InklineModel assetKey="barrel" scale={1.3} />
            </group>
          ) : crate.containerType === "console" ? (
            <group position={[0, 0, 0]}>
              <InklineModel assetKey="terminalConsole" scale={1.1} />
            </group>
          ) : (
            <group position={[0, 0.4, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1.3, 0.75, 1.3]} />
                <meshStandardMaterial
                  color={crate.opened ? "#64748b" : "#494c46"}
                  metalness={0.1}
                  roughness={0.8}
                />
              </mesh>
            </group>
          )}

          {/* Tactical Container Ink Indicator Ring when unopened */}
          {!crate.opened && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
              <ringGeometry args={[1.4, 1.55, 24]} />
              <meshBasicMaterial
                color="#151716"
                transparent
                opacity={0.4}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* =========================================================================
          7. EMERGENCY BUNKER BLAST DOOR EXFIL (x: -45, z: -45)
         ========================================================================= */}
      <group position={[-45, 0, -45]}>
        {/* Reinforced Concrete Bunker Platform */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} metalness={0.1} />
        </mesh>

        {/* Hazard Perimeter Linework */}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.6, 4.85, 36]} />
          <meshBasicMaterial color="#151716" />
        </mesh>

        {/* Reinforced Bunker Bulkhead Frame */}
        <mesh position={[-3.2, 2.2, -2.5]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 4.4, 1.8]} />
          <meshStandardMaterial color="#494c46" roughness={0.8} />
        </mesh>
        <mesh position={[3.2, 2.2, -2.5]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 4.4, 1.8]} />
          <meshStandardMaterial color="#494c46" roughness={0.8} />
        </mesh>
        <mesh position={[0, 4.6, -2.9]} castShadow receiveShadow>
          <boxGeometry args={[7.6, 0.8, 0.7]} />
          <meshStandardMaterial color="#494c46" roughness={0.8} />
        </mesh>

        {/* Dual Heavy Armored Blast Doors */}
        <mesh position={[-1.35, 2.0, -2.4]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 3.8, 0.45]} />
          <meshStandardMaterial color="#64748b" roughness={0.6} />
        </mesh>
        <mesh position={[1.35, 2.0, -2.4]} castShadow receiveShadow>
          <boxGeometry args={[2.6, 3.8, 0.45]} />
          <meshStandardMaterial color="#64748b" roughness={0.6} />
        </mesh>

        {/* Keycard Terminal Console */}
        <InklineModel assetKey="terminalConsole" position={[0, 0, 0.2]} scale={1.2} />
      </group>
    </group>
  );
});

const CONTAINER_PALETTES = [
  { bottom: "#3d4a36", top: "#242b26" }, // Olive / Charcoal
  { bottom: "#5c4033", top: "#3d4a36" }, // Coyote Rust / Olive
  { bottom: "#b48228", top: "#242b26" }, // Safety Amber / Charcoal
  { bottom: "#2d3a3d", top: "#5c4033" }, // Industrial Navy / Rust
];

const InklineContainer: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  index?: number;
}> = ({ position, rotation = [0, 0, 0], index = 0 }) => {
  const palette = CONTAINER_PALETTES[Math.abs(index) % CONTAINER_PALETTES.length];
  return (
    <group position={position} rotation={rotation}>
      {/* Ground Container */}
      <InklineModel
        assetKey="cargoContainer"
        position={[0, 0, 0]}
        scale={[1.15, 1.0, 1.3]}
        tintColor={palette.bottom}
      />
      {/* Upper Stacked Container */}
      <InklineModel
        assetKey="cargoContainer"
        position={[0, 2.6, 0]}
        scale={[1.15, 1.0, 1.3]}
        tintColor={palette.top}
      />
    </group>
  );
};
