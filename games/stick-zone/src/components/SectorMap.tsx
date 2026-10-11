import React, { useEffect, useState } from "react";
import * as THREE from "three";
import type { LootCrate } from "../sim/game.js";
import { MAP_CONTAINERS } from "../sim/game.js";
import { InklineModel } from "./InklineModel.js";

interface SectorMapProps {
  crates: LootCrate[];
  onEnterAirlock?: () => void;
}

export const SectorMap: React.FC<SectorMapProps> = ({ crates }) => {
  const [gateLabelTex, setGateLabelTex] = useState<THREE.CanvasTexture | null>(null);
  const [fobLabelTex, setFobLabelTex] = useState<THREE.CanvasTexture | null>(null);

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

    setGateLabelTex(makeTex("SECTOR 7 COMBAT AIRLOCK", "COMBAT ZONE // WEAPONS HOT", "#d45538"));
    setFobLabelTex(makeTex("FORWARD OPERATING BASE", "SECTOR 7 STAGING OUTPOST", "#151716"));
  }, []);

  return (
    <group>
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
        <meshBasicMaterial color="#1e293b" transparent opacity={0.65} />
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
      <group position={[-5.0, 0, -64]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
          <meshStandardMaterial color="#151716" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[0.55, 0.75, 0.08]} />
          <meshStandardMaterial color="#d97706" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.45, 0.05]}>
          <circleGeometry args={[0.16, 16]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      </group>

      <group position={[5.0, 0, -64]}>
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <cylinderGeometry args={[0.5, 0.6, 0.2, 16]} />
          <meshStandardMaterial color="#151716" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
          <meshStandardMaterial color="#64748b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <boxGeometry args={[0.55, 0.75, 0.08]} />
          <meshStandardMaterial color="#0284c7" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.45, 0.05]}>
          <circleGeometry args={[0.16, 16]} />
          <meshBasicMaterial color="#ef4444" />
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
