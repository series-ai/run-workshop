// Animated FOB Target Dummy with Spring Recoil Physics
const FOBTargetDummy: React.FC<{
  position: [number, number, number];
  color: string;
  side: "left" | "right";
  lastHitTick?: number;
  hitSide?: "left" | "right";
}> = ({ position, color, side, lastHitTick, hitSide }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [wobbleAmp, setWobbleAmp] = useState(0);
  const lastProcessedTickRef = useRef(0);

  useEffect(() => {
    if (lastHitTick && lastHitTick > lastProcessedTickRef.current && hitSide === side) {
      lastProcessedTickRef.current = lastHitTick;
      setWobbleAmp(1.0);
    }
  }, [lastHitTick, hitSide, side]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (wobbleAmp > 0.005) {
      const decay = Math.exp(-delta * 8.5);
      const nextAmp = wobbleAmp * decay;
      setWobbleAmp(nextAmp);
      groupRef.current.rotation.x = -Math.sin(Date.now() * 0.025) * nextAmp * 0.4;
      groupRef.current.rotation.z = Math.cos(Date.now() * 0.03) * nextAmp * 0.15;
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
        <mesh position={[0, 1.4, 0.052]}>
          <circleGeometry args={[0.24, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 1.4, 0.054]}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 1.4, 0.056]}>
          <circleGeometry args={[0.12, 24]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, 1.4, 0.058]}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>

        {/* Silhouette Head Plate */}
        <mesh position={[0, 1.88, 0]} castShadow>
          <boxGeometry args={[0.32, 0.3, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        {/* Head Lethal Hit Ring */}
        <mesh position={[0, 1.88, 0.052]}>
          <circleGeometry args={[0.09, 16]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, 1.88, 0.054]}>
          <circleGeometry args={[0.04, 16]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      </group>
    </group>
  );
};

import React, { useEffect, useState, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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

export const SectorMap: React.FC<SectorMapProps> = ({ crates, lastDummyHitTick, lastDummyHitSide }) => {
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
      ctx.fillStyle = "#f3f4f6";
      ctx.roundRect(4, 4, 504, 88, 4);
      ctx.fill();

      ctx.strokeStyle = "#151716";
      ctx.lineWidth = 4;
      ctx.roundRect(4, 4, 504, 88, 4);
      ctx.stroke();

      ctx.font = "bold 26px monospace";
      ctx.fillStyle = "#151716";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(title, 256, 36);

      ctx.font = "16px monospace";
      ctx.fillStyle = accent;
      ctx.fillText(sub, 256, 68);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    const makeDecalTex = (
      width: number,
      height: number,
      mainText: string,
      subText: string,
      accentColor: string,
      bgColor = "rgba(15, 23, 42, 0.94)"
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.clearRect(0, 0, width, height);

      // Card Background
      ctx.fillStyle = bgColor;
      ctx.roundRect(4, 4, width - 8, height - 8, 8);
      ctx.fill();

      // Bold Comic Border
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 5;
      ctx.roundRect(4, 4, width - 8, height - 8, 8);
      ctx.stroke();

      // Diagonal Hazard Slash Corners
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(6, 32);
      ctx.lineTo(32, 6);
      ctx.lineTo(44, 6);
      ctx.lineTo(6, 44);
      ctx.closePath();
      ctx.fill();

      // Main Text
      ctx.font = "900 " + Math.floor(height * 0.36) + "px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(mainText, width / 2, height * 0.38);

      // Sub Text
      ctx.font = "bold " + Math.floor(height * 0.22) + "px monospace";
      ctx.fillStyle = accentColor;
      ctx.fillText(subText, width / 2, height * 0.74);

      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    };

    setGateLabelTex(makeTex("SECTOR 7 COMBAT AIRLOCK", "COMBAT ZONE // WEAPONS HOT", "#d45538"));
    setFobLabelTex(makeTex("FORWARD OPERATING BASE", "SECTOR 7 STAGING OUTPOST", "#151716"));
    setControlsDecalTex(
      makeDecalTex(1024, 192, "[WASD] MOVE  •  [SHIFT] SPRINT  •  [C] SLIDE  •  [SPACE] ROLL", "FOB AGILITY TRAINING GROUND // FREE MOVEMENT", "#38bdf8")
    );
    setFiringDecalTex(
      makeDecalTex(1024, 192, "➔ FIRING RANGE // [LEFT CLICK / J] FIRE • [R] RELOAD", "BALLISTIC CALIBRATION LANE // 5M - 10M TARGETS", "#f59e0b")
    );
    setLockerDecalTex(
      makeDecalTex(1024, 192, "➔ TRAINING SUPPLY LOCKER // [E / F] LOOT CACHES", "QUICK-LOOT PRACTICE // TAKE STARTER AMMO & STIMS", "#10b981")
    );
    setAirlockDecalTex(
      makeDecalTex(1024, 192, "▲▲▲ SECTOR 7 COMBAT GATEWAY // STEP THROUGH TO RAID ▲▲▲", "EXTRACTION ZONE DEPLOYMENT // HOSTILES PRESENT // WEAPONS HOT", "#ef4444")
    );
  }, []);

  return (
    <group ref={mapRootRef}>
      {/* =========================================================================
          1. MAIN DEPOT FLOOR & PERIMETER WALLS (Spoke Area z: -50 to +80)
         ========================================================================= */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 10]} receiveShadow>
        <planeGeometry args={[160, 140]} />
        <meshStandardMaterial color="#dde0e4" roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Central Tactical Logistics Runway (Concrete Slabs) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 17]} receiveShadow>
        <planeGeometry args={[22, 126]} />
        <meshStandardMaterial color="#dde0e4" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Flanking Pitch-Black Ink Linework Strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-11.2, 0.02, 17]} receiveShadow>
        <planeGeometry args={[0.5, 126]} />
        <meshBasicMaterial color="#151716" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[11.2, 0.02, 17]} receiveShadow>
        <planeGeometry args={[0.5, 126]} />
        <meshBasicMaterial color="#151716" />
      </mesh>

      {/* Transverse Heavy-Vehicle Runway Ink Markers */}
      {[-35, -15, 5, 25, 45, 65].map((zPos) => (
        <mesh key={zPos} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, zPos]} receiveShadow>
          <planeGeometry args={[16, 0.8]} />
          <meshBasicMaterial color="#151716" />
        </mesh>
      ))}

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
        <meshStandardMaterial color="#dde0e4" roughness={0.8} metalness={0.08} />
      </mesh>

      {/* FOB North Wall Behind Outpost */}
      <mesh position={[0, 2.5, -73]} receiveShadow castShadow>
        <boxGeometry args={[16, 5, 1]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      {/* FOB Side Enclosure Walls (preventing stepping into empty space) */}
      <mesh position={[-8, 2.5, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 21]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
      </mesh>
      <mesh position={[8, 2.5, -62.5]} receiveShadow castShadow>
        <boxGeometry args={[1, 5, 21]} />
        <meshStandardMaterial color="#64748b" roughness={0.8} />
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

      {/* FOB Floor Graphic Manga Decals & Stencils */}
      {controlsDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.168, -67.5]} receiveShadow>
          <planeGeometry args={[5.2, 1.1]} />
          <meshBasicMaterial map={controlsDecalTex} transparent opacity={0.92} />
        </mesh>
      )}

      {firingDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3.6, 0.168, -60.5]} receiveShadow>
          <planeGeometry args={[4.2, 0.95]} />
          <meshBasicMaterial map={firingDecalTex} transparent opacity={0.92} />
        </mesh>
      )}

      {lockerDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.6, 0.168, -60.5]} receiveShadow>
          <planeGeometry args={[4.2, 0.95]} />
          <meshBasicMaterial map={lockerDecalTex} transparent opacity={0.92} />
        </mesh>
      )}

      {airlockDecalTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.168, -54.8]} receiveShadow>
          <planeGeometry args={[5.4, 1.0]} />
          <meshBasicMaterial map={airlockDecalTex} transparent opacity={0.95} />
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
      {MAP_CONTAINERS.map((c) => (
        <InklineContainer key={c.id} position={c.position} rotation={c.rotation} />
      ))}

      {/* Depot Corner Floodlight Towers (Outside perimeter fence per R7) */}
      <InklineModel assetKey="floodlightTower" position={[-86, 0, 86]} scale={2.0} />
      <InklineModel assetKey="floodlightTower" position={[86, 0, 86]} scale={2.0} />
      <InklineModel assetKey="floodlightTower" position={[-86, 0, -86]} scale={2.0} />
      <InklineModel assetKey="floodlightTower" position={[86, 0, -86]} scale={2.0} />

      {/* =========================================================================
          5. MODULAR DISTRICT STRUCTURES (Strictly outside playable bounds |x| > 82 or |z| > 82)
         ========================================================================= */}
      <InklineModel assetKey="floodlightTower" position={[95, 0, 0]} scale={2.0} />
      <InklineModel assetKey="cargoContainer" position={[95, 0, 20]} scale={2.0} />
      <InklineModel assetKey="floodlightTower" position={[-95, 0, 0]} scale={2.0} />
      <InklineModel assetKey="cargoContainer" position={[-95, 0, -20]} scale={2.0} />
      <InklineModel assetKey="barrierConcrete" position={[0, 0, 95]} scale={3.0} />
      <InklineModel assetKey="barrierConcrete" position={[0, 0, -95]} scale={3.0} />

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
};

const InklineContainer: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Ground Container */}
      <InklineModel
        assetKey="cargoContainer"
        position={[0, 0, 0]}
        scale={[1.15, 1.0, 1.3]}
      />
      {/* Upper Stacked Container */}
      <InklineModel
        assetKey="cargoContainer"
        position={[0, 2.6, 0]}
        scale={[1.15, 1.0, 1.3]}
      />
    </group>
  );
};
