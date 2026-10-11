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
import { globalCutaway } from "../render/cutaway.js";

interface SectorMapProps {
  crates: LootCrate[];
  onEnterAirlock?: () => void;
  lastDummyHitTick?: number;
  lastDummyHitSide?: "left" | "right";
}

export const SectorMap: React.FC<SectorMapProps> = React.memo(({ crates, lastDummyHitTick, lastDummyHitSide }) => {
  const mapRootRef = React.useRef<THREE.Group>(null);
  const [gateLabelTex, setGateLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [fobLabelTex, setFobLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [controlsDecalTex, setControlsDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [firingDecalTex, setFiringDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [lockerDecalTex, setLockerDecalTex] = useState<THREE.CanvasTexture | null>(null);
  const [airlockDecalTex, setAirlockDecalTex] = useState<THREE.CanvasTexture | null>(null);

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
      {/* FOB Outpost Elevated Foundation Slab (Solid 3D block at y=0.08, zero z-fighting with terrain) */}
      <mesh position={[0, 0.08, -63]} receiveShadow castShadow>
        <boxGeometry args={[15.6, 0.16, 21]} />
        <meshStandardMaterial color="#dde0e4" roughness={0.88} metalness={0.05} />
      </mesh>

      {/* FOB North Wall Behind Outpost */}
      <mesh position={[0, 2.5, -73]} receiveShadow castShadow>
        <boxGeometry args={[16, 5, 1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      {/* FOB Side Enclosure Walls (preventing stepping into empty space) */}
      <mesh position={[-8, 2.5, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 21]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[8, 2.5, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 21]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>

      {/* FOB Header Signboard Overhead */}
      <group position={[0, 2.2, -71]}>
        <mesh>
          <planeGeometry args={[8.0, 1.6]} />
          {fobLabelTex && <meshBasicMaterial map={fobLabelTex} transparent />}
        </mesh>
      </group>

      {/* FOB Perimeter Security Barriers (Flanking perimeter walls, leaving wide open central staging floor) */}
      <InklineModel assetKey="barrierConcrete" position={[-6.2, 0, -63.5]} rotation={[0, 0, 0]} scale={1.4} />
      <InklineModel assetKey="barrierConcrete" position={[6.2, 0, -63.5]} rotation={[0, 0, 0]} scale={1.4} />

      {/* Central Tactical Guidance Runway (Elevated cleanly atop FOB foundation slab) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.165, -61]} receiveShadow>
        <planeGeometry args={[3.2, 16]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.65} roughness={0.8} />
      </mesh>

      {/* Luminous Chevron Directional Ingress Stripes */}
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

            {/* FOB Ballistic Training Range & Target Dummies (Safe Weapon Practice Area) */}
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

      {/* FOB Floor Stencils (Cleanly positioned on sides, completely clear walkway) */}
      {firingDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4.8, 0.168, -58.5]} receiveShadow>
          <planeGeometry args={[3.2, 0.65]} />
          <meshBasicMaterial map={firingDecalTex} transparent opacity={0.88} />
        </mesh>
      )}

      {lockerDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[4.8, 0.168, -58.5]} receiveShadow>
          <planeGeometry args={[3.2, 0.65]} />
          <meshBasicMaterial map={lockerDecalTex} transparent opacity={0.88} />
        </mesh>
      )}

      {airlockDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.168, -54.2]} receiveShadow>
          <planeGeometry args={[4.2, 0.65]} />
          <meshBasicMaterial map={airlockDecalTex} transparent opacity={0.90} />
        </mesh>
      )}

      {/* Firing Range Distance Lines (5M and 10M from Dummies at z: -64) */}
      <group position={[-5.0, 0.166, -59]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.8, 0.15]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
      <group position={[-5.0, 0.166, -54]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[2.8, 0.15]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>

      {/* FOB Staging Terminal Consoles & Power Relays */}
      <InklineModel assetKey="terminalConsole" position={[-3.8, 0, -67]} scale={1.4} rotation={[0, Math.PI / 2, 0]} />
      <InklineModel assetKey="terminalConsole" position={[3.8, 0, -67]} scale={1.4} rotation={[0, -Math.PI / 2, 0]} />
      <InklineModel assetKey="powerCore" position={[-4.6, 0, -71]} scale={1.5} />
      <InklineModel assetKey="powerCore" position={[4.6, 0, -71]} scale={1.5} />

      {/* =========================================================================
          3. SPATIAL AIRLOCK GATEWAY (Bridge between FOB Hub & Depot Spoke at z: -52)
         ========================================================================= */}
      <group position={[0, 0, -52]}>
        {/* Gateway Teleporter Pad */}
        <InklineModel assetKey="teleporterPad" position={[0, 0.05, 0]} scale={2.6} />

        {/* Flanking Warp Beacons */}
        <InklineModel assetKey="warpBeacon" position={[-4.5, 0, 0]} scale={1.8} />
        <InklineModel assetKey="warpBeacon" position={[4.5, 0, 0]} scale={1.8} />

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
      {/* Real 3D Inkline Cargo Containers derived directly from unified MAP_CONTAINERS definition */}
      {MAP_CONTAINERS.map((c, idx) => (
        <InklineContainer key={c.id} position={c.position} rotation={c.rotation} index={idx} />
      ))}

      
      {/* =========================================================================
          4B. TACTICAL LEVEL DESIGN: INTERMEDIATE COVER, BARRELS & INDUSTRIAL CHICANES
         ========================================================================= */}
      {/* Western Freight CQB Alley (x: -35 to -15, z: -35 to 35) */}
      <InklineModel assetKey="barrierConcrete" position={[-25, 0, -18]} rotation={[0, Math.PI / 4, 0]} scale={1.3} />
      <InklineModel assetKey="barrel" position={[-23, 0, -16]} scale={1.3} />
      <InklineModel assetKey="barrel" position={[-22, 0, -17]} scale={1.3} />
      <InklineModel assetKey="dumpster" position={[-38, 0, 10]} rotation={[0, Math.PI / 2, 0]} scale={1.3} />
      <InklineModel assetKey="barrierConcrete" position={[-32, 0, 24]} scale={1.3} />
      <InklineModel assetKey="barrel" position={[-30, 0, 25.5]} scale={1.3} />

      {/* Central Logistics Highway Chicanes (Providing leap-frogging cover) */}
      <InklineModel assetKey="barrierConcrete" position={[-2.8, 0, -8]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrierConcrete" position={[2.8, 0, 16]} rotation={[0, 0, 0]} scale={1.25} />
      <InklineModel assetKey="barrierConcrete" position={[-2.8, 0, 40]} rotation={[0, 0, 0]} scale={1.25} />

      {/* Eastern Fuel & Power Yard (x: 18 to 45, z: -25 to 40) */}
      <InklineModel assetKey="watertankIndustrial" position={[35, 0, 10]} scale={1.7} />
      <InklineModel assetKey="barrel" position={[31.5, 0, 7]} scale={1.3} />
      <InklineModel assetKey="barrel" position={[33, 0, 8.5]} scale={1.3} />
      <InklineModel assetKey="barrierConcrete" position={[22, 0, -8]} rotation={[0, Math.PI / 3, 0]} scale={1.3} />
      <InklineModel assetKey="barrierConcrete" position={[42, 0, 28]} rotation={[0, -Math.PI / 4, 0]} scale={1.3} />

      {/* Fortified Emergency Bunker Compound Perimeter */}
      <InklineModel assetKey="barrierConcrete" position={[-40, 0, -41]} rotation={[0, Math.PI / 4, 0]} scale={1.35} />
      <InklineModel assetKey="barrel" position={[-42, 0, -38]} scale={1.2} />

      {/* Extraction LZ-01 Fortified Barrier Revetment */}
      <InklineModel assetKey="barrierConcrete" position={[40, 0, 41]} rotation={[0, Math.PI / 4, 0]} scale={1.35} />
      <InklineModel assetKey="barrel" position={[46, 0, 41]} scale={1.2} />
      <InklineModel assetKey="barrel" position={[41, 0, 46]} scale={1.2} />

            {/* =========================================================================
          4C. HEAVY INDUSTRIAL ARCHITECTURE & INKLINE CITY DISTRICT OVERHAUL
         ========================================================================= */}
      {/* --- West Compound: Logistics, Warehouses & Maintenance --- */}
      {/* West Warehouse Alpha (x: -26, z: 8) */}
      <InklineModel assetKey="warehouse" position={[-26, 0, 8]} scale={[1.75, 1.8, 1.75]} />
      <InklineModel assetKey="ventFan" position={[-26, 9.8, 8]} scale={2.0} />
      <InklineModel assetKey="ladder" position={[-20.2, 0, 8]} rotation={[0, Math.PI / 2, 0]} scale={1.8} />
      <InklineModel assetKey="electricalCabinet" position={[-20.2, 0, 11]} rotation={[0, -Math.PI / 2, 0]} scale={1.5} />
      <InklineModel assetKey="pipeStraight" position={[-20.4, 4.0, 8]} rotation={[Math.PI / 2, 0, 0]} scale={[1.5, 1.5, 3.0]} />

      {/* West Warehouse Beta (x: -26, z: -25) */}
      <InklineModel assetKey="warehouse" position={[-26, 0, -25]} scale={[1.75, 1.8, 1.75]} />
      <InklineModel assetKey="ventFan" position={[-26, 9.8, -25]} scale={2.0} />
      <InklineModel assetKey="electricalCabinet" position={[-20.2, 0, -22]} rotation={[0, -Math.PI / 2, 0]} scale={1.5} />

      {/* West Service Bay & Heavy Maintenance Yard (between warehouses) */}
      <InklineModel assetKey="serviceBayCanopy" position={[-30, 0, -8]} scale={2.0} />
      <InklineModel assetKey="serviceBayArch" position={[-30, 0, -8]} scale={2.0} />
      <InklineModel assetKey="serviceBayWorkbench" position={[-27, 0, -8]} rotation={[0, -Math.PI / 2, 0]} scale={1.6} />
      <InklineModel assetKey="cableSpool" position={[-33, 0, -5.5]} scale={1.8} />
      <InklineModel assetKey="barrelStack" position={[-33, 0, -10.5]} scale={1.6} />

      {/* West Loading Platform & Truck Dock (x: -36, z: 25) */}
      <InklineModel assetKey="loadingPlatform" position={[-36, 0, 25]} scale={[2.0, 1.8, 2.0]} />
      <InklineModel assetKey="loadingPlatformRamp" position={[-36, 0, 29.5]} rotation={[0, Math.PI, 0]} scale={[2.0, 1.8, 2.0]} />
      <InklineModel assetKey="loadingDockLadder" position={[-31.8, 0, 25]} rotation={[0, -Math.PI / 2, 0]} scale={1.8} />

      {/* Overhead Gantry Crane (spanning logistics alley) */}
      <InklineModel assetKey="gantryCrane" position={[-15, 0, -8]} scale={[2.0, 2.0, 2.0]} />

      {/* Elevated Catwalk & Stair System */}
      <InklineModel assetKey="stairFlight" position={[-20, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={1.6} />
      <InklineModel assetKey="catwalkBridge" position={[-26, 4.0, -8.5]} rotation={[0, 0, 0]} scale={[2.0, 1.8, 2.5]} />

      {/* --- East Compound: Fuel Processing, Chemical Storage & Power Substation --- */}
      {/* Twin Vertical Fuel Tanks (x: 35 & 43, z: -18) */}
      <InklineModel assetKey="tankVertical" position={[35, 0, -18]} scale={[2.2, 2.2, 2.2]} />
      <InklineModel assetKey="tankVertical" position={[43, 0, -18]} scale={[2.2, 2.2, 2.2]} />
      <InklineModel assetKey="pipeManifold" position={[39, 0, -16]} scale={2.0} />
      <InklineModel assetKey="pipeVerticalElbow" position={[35, 0, -15.5]} scale={1.8} />

      {/* Horizontal Pressure Tank (x: 38, z: 5) */}
      <InklineModel assetKey="tankHorizontal" position={[38, 0, 5]} scale={[2.2, 2.2, 2.2]} />

      {/* High-Pressure Spherical Storage Silo (x: 28, z: 22) */}
      <InklineModel assetKey="tankSpherical" position={[28, 0, 22]} scale={[2.2, 2.2, 2.2]} />

      {/* Diesel Generator & Electrical Transformer Substation (x: 42, z: -5) */}
      <InklineModel assetKey="generatorLarge" position={[42, 0, -5]} scale={2.0} />
      <InklineModel assetKey="machineTransformer" position={[42, 0, 2]} scale={1.8} />

      {/* Towering Industrial Smokestacks (x: 52, z: -32 & +38) */}
      <InklineModel assetKey="smokestackTall" position={[52, 0, -32]} scale={[2.2, 2.5, 2.2]} />
      <InklineModel assetKey="smokestackTall" position={[52, 0, 38]} scale={[2.2, 2.5, 2.2]} />

      {/* Heavy Conveyor Feed System */}
      <InklineModel assetKey="conveyor" position={[32, 0, -5]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="conveyorIncline" position={[32, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />

      {/* --- Tactical Lighting, Scatter & Security Fences --- */}
      {/* Strategic Perimeter Wire-Mesh & Access Gates */}
      <InklineModel assetKey="fenceWireMesh" position={[-48, 0, -10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceWireMesh" position={[-48, 0, 10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceWireMesh" position={[48, 0, -10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceWireMesh" position={[48, 0, 10]} rotation={[0, Math.PI / 2, 0]} scale={[2.2, 1.8, 2.0]} />
      <InklineModel assetKey="fenceGate" position={[0, 0, -48]} scale={2.2} />

      {/* High-Mast Street Lamps illuminating main combat intersections */}
      <InklineModel assetKey="streetLamp" position={[-12, 0, -20]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[-12, 0, 10]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[15, 0, -10]} scale={1.8} />
      <InklineModel assetKey="streetLamp" position={[15, 0, 20]} scale={1.8} />
      <InklineModel assetKey="securityCameraPole" position={[-4, 0, -50]} scale={1.8} />

      {/* Crate Stacks, Cable Spools, and Drainage Grates */}
      <InklineModel assetKey="crateStack" position={[-20, 0, -14]} scale={1.5} />
      <InklineModel assetKey="crateStack" position={[25, 0, -10]} scale={1.5} />
      <InklineModel assetKey="cableSpool" position={[30, 0, 14]} scale={1.7} />
      <InklineModel assetKey="grateDrain" position={[-6, 0.05, 0]} scale={1.8} />
      <InklineModel assetKey="grateDrain" position={[6, 0.05, 0]} scale={1.8} />

      {/* Depot Corner Floodlight Towers (Outside perimeter fence per R7) */}
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
