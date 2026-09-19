import { ART_STYLE, deriveLightRig } from "./style/artStyle";
import { Toon } from "./style/toonMaterial";
import { useMemo } from 'react';
import * as THREE from 'three';
import type { WaterTankSpec } from 'voxel-kit';
import { FLOOR_Y, getTerrainHeightAt, TANK, TANK_SPEC } from '../sim/constants';
import { SkyDome } from './SkyDome';
import { Skyline } from './Skyline';
import { YardDressing } from './dressing/YardDressing';
import { WaterCaustics, WaterSurface } from './Water';

const noRaycast = () => null;
const tuple3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

function DemolitionTerrainMesh() {
  const geom = useMemo(() => {
    const plane = new THREE.PlaneGeometry(51.2, 51.2, 32, 32);
    plane.rotateX(-Math.PI / 2);
    const pos = plane.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i);
      const vy = FLOOR_Y + getTerrainHeightAt(vx, vz);
      pos.setY(i, vy);

      const centerDist = Math.hypot(vx, vz);
      const waterDist = Math.hypot(vx - 11, vz - (-11));

      if (waterDist < 7.0) {
        // Wet quarry basin & shoreline
        color.set(ART_STYLE.palette.floor);
      } else if (centerDist < 6.5) {
        // Central work pad / concrete apron
        color.set(ART_STYLE.palette.concreteLit);
      } else if (vy > FLOOR_Y + 0.7) {
        // Sloped berms & ridges
        color.set(ART_STYLE.palette.concreteLit);
      } else {
        // Main yard concrete floor
        color.set(ART_STYLE.palette.concreteShade);
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    plane.computeVertexNormals();
    return plane;
  }, []);

  return (
    <mesh geometry={geom} receiveShadow raycast={noRaycast}>
      <Toon color="#ffffff" vertexColors />
    </mesh>
  );
}

export type WaterVisualLayout = {
  tankHeight: number;
  tankCenterY: number;
  fillDepth: number;
  fillCenterY: number;
  fillTopY: number;
  surfaceY: number;
  surfaceClearance: number;
  fillSize: [number, number, number];
  surfaceSize: [number, number];
};

function getWaveAmplitudeBudget(tank: WaterTankSpec): number {
  return (tank.waveAmplitude ?? 0.035) + (tank.secondaryWaveAmplitude ?? 0.02);
}

export function computeWaterVisualLayout(tank: WaterTankSpec): WaterVisualLayout {
  const tankHeight = tank.surfaceY - tank.bottomY;
  const tankCenterY = tank.bottomY + tankHeight * 0.5;
  const surfaceClearance = Math.max(0.07, getWaveAmplitudeBudget(tank) + 0.01);
  const fillDepth = Math.max(0.02, tankHeight - surfaceClearance);
  const fillCenterY = tank.bottomY + fillDepth * 0.5;
  const fillTopY = tank.bottomY + fillDepth;

  return {
    tankHeight,
    tankCenterY,
    fillDepth,
    fillCenterY,
    fillTopY,
    surfaceY: tank.surfaceY,
    surfaceClearance,
    fillSize: [tank.innerSize[0] - 0.06, fillDepth, tank.innerSize[2] - 0.06],
    surfaceSize: [tank.innerSize[0] - 0.12, tank.innerSize[2] - 0.12],
  };
}

function CuttingRigSparks() {
  const geom = useMemo(() => {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const cGlow = new THREE.Color(ART_STYLE.palette.glow);
    const cSpark = new THREE.Color(ART_STYLE.palette.spark);

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const r = 0.08 + (i % 13) * 0.09;
      const dy = -0.16 - (i % 16) * 0.12;
      const sx = Math.cos(ang) * r * 0.75;
      const sz = Math.sin(ang) * r * 0.75;
      positions[i * 3] = sx;
      positions[i * 3 + 1] = dy;
      positions[i * 3 + 2] = sz;

      const col = i % 3 === 0 ? cSpark : cGlow;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, []);

  return (
    <points geometry={geom} raycast={noRaycast}>
      <pointsMaterial
        size={0.06}
        vertexColors
        toneMapped={false}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export function YardShell() {
  const waterLayout = computeWaterVisualLayout(TANK_SPEC);
  const lightRig = deriveLightRig(ART_STYLE);

  return (
    <>
      {/* Retro-industrial stepped Sky Dome */}
      <SkyDome />

      {/* Retro-industrial 2-layer silhouette skyline backdrop */}
      <Skyline />

      {/* Retro-industrial cel light rig derived from ART_STYLE */}
      <fog attach="fog" args={[ART_STYLE.palette.skyLow, 36, 120]} />
      <ambientLight
        intensity={lightRig.ambient.intensity}
        color={new THREE.Color(...lightRig.ambient.color)}
      />
      <directionalLight
        position={[...lightRig.key.position]}
        intensity={lightRig.key.intensity}
        color={new THREE.Color(...lightRig.key.color)}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-far={70}
        shadow-bias={-0.0003}
      />

      {/* ========================================================================= */}
      {/* DEMOLITION YARD TERRAIN: Syncplay Heightfield Topography                  */}
      {/* ========================================================================= */}
      <DemolitionTerrainMesh />

      {/* Demolition Yard Sub-Base: Cool Blue-Charcoal Asphalt (Astra Round 7: #3A464C) */}
      <mesh position={[0, FLOOR_Y - 0.25, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52.4, 0.2, 52.4]} />
        <Toon color={ART_STYLE.palette.ink} />
      </mesh>

      {/* Elevated Concrete Loading Deck & Retaining Wall (Astra Round 8 Warm Gray #A69F8B) */}
      <group position={[-17, FLOOR_Y + 0.5, 0]}>
        <mesh receiveShadow castShadow raycast={noRaycast}>
          <boxGeometry args={[10, 1.0, 30]} />
          <Toon color={ART_STYLE.palette.concreteLit} />
        </mesh>
        {/* Retaining Wall Face Curb with Yellow Stripes */}
        <mesh position={[5.02, 0.35, 0]} raycast={noRaycast}>
          <boxGeometry args={[0.04, 0.3, 30]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
      </group>

      {/* Perimeter Concrete Retaining Divider Bays (Astra Warm Gray #A69F8B) */}
      {[-12, -4, 4, 12].map((bz, bidx) => (
        <group key={`bay-${bidx}`} position={[-19.5, FLOOR_Y + 0.6, bz]}>
          <mesh receiveShadow castShadow raycast={noRaycast}>
            <boxGeometry args={[5.0, 1.2, 0.4]} />
            <Toon color={ART_STYLE.palette.concreteLit} />
          </mesh>
        </group>
      ))}

      {/* High-Mast Floodlight Towers with 6 Glowing Lenses (#FFE5A3) */}
      {[
        { pos: [-21, FLOOR_Y, -20], rot: 0.8 },
        { pos: [21, FLOOR_Y, -18], rot: -0.8 },
        { pos: [-21, FLOOR_Y, 18], rot: 2.2 },
      ].map((pole, pidx) => (
        <group key={`mast-${pidx}`} position={[pole.pos[0], pole.pos[1], pole.pos[2]]} rotation={[0, pole.rot, 0]}>
          {/* Steel Mast Pole */}
          <mesh position={[0, 5.5, 0]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.2, 0.35, 11, 8]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Crossbar Head */}
          <mesh position={[0, 11.2, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[2.4, 0.4, 0.6]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* 6 Emissive Lamp Discs in #FFE5A3 */}
          {[-0.8, 0, 0.8].map((lx, lidx) => (
            <group key={`lamp-${lidx}`} position={[lx, 11.2, 0.32]} rotation={[0.45, 0, 0]}>
              <mesh position={[0, 0.15, 0]} raycast={noRaycast}>
                <boxGeometry args={[0.55, 0.3, 0.2]} />
                <Toon color={ART_STYLE.palette.ink} />
              </mesh>
              <mesh position={[0, 0.15, 0.11]} raycast={noRaycast}>
                <planeGeometry args={[0.5, 0.24]} />
                <meshBasicMaterial color="#ffe5a3" toneMapped={false} />
              </mesh>
              <mesh position={[0, -0.15, 0]} raycast={noRaycast}>
                <boxGeometry args={[0.55, 0.3, 0.2]} />
                <Toon color={ART_STYLE.palette.ink} />
              </mesh>
              <mesh position={[0, -0.15, 0.11]} raycast={noRaycast}>
                <planeGeometry args={[0.5, 0.24]} />
                <meshBasicMaterial color="#ffe5a3" toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* ========================================================================= */}
      {/* CONCRETE RETAINING WALLS & SLAB JOINTS (D6 SPEC)                          */}
      {/* ========================================================================= */}
      {[
        { pos: [-26, 2.0, 0], rot: 0, size: [0.6, 4.0, 52] },
        { pos: [26, 2.0, 0], rot: 0, size: [0.6, 4.0, 52] },
        { pos: [0, 1.0, -26], rot: Math.PI / 2, size: [0.6, 2.0, 52] }, // Low north parapet opening skyline
        { pos: [0, 2.0, 26], rot: Math.PI / 2, size: [0.6, 4.0, 52] },
      ].map((wall, idx) => (
        <group key={`wall-${idx}`} position={wall.pos as [number, number, number]} rotation={[0, wall.rot, 0]}>
          {/* Main Concrete Retaining Wall */}
          <mesh receiveShadow castShadow raycast={noRaycast}>
            <boxGeometry args={wall.size as [number, number, number]} />
            <Toon color={ART_STYLE.palette.concreteLit} />
          </mesh>
          {/* Recessed vertical slab joints every 8m for ink seams */}
          {[-16, -8, 0, 8, 16].map((sx, sidx) => (
            <mesh key={`seam-${sidx}`} position={[0.31, 0, sx]} raycast={noRaycast}>
              <boxGeometry args={[0.02, wall.size[1], 0.08]} />
              <Toon color={ART_STYLE.palette.concreteShade} />
            </mesh>
          ))}
          {/* Concrete Cap Rail */}
          <mesh position={[0, wall.size[1] / 2 + 0.15, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.9, 0.3, 52]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
        </group>
      ))}

      {/* Structural Steel I-Beam Columns Spaced Around Perimeter */}
      {[-20, -12, -4, 4, 12, 20].map((coord, idx) => (
        <group key={`col-${idx}`}>
          <mesh position={[-25.6, 3.2, coord]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.7, 7.5, 0.45]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[25.6, 3.2, coord]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.7, 7.5, 0.45]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[coord, 3.2, -25.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.45, 7.5, 0.7]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[coord, 3.2, 25.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.45, 7.5, 0.7]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
        </group>
      ))}

      {/* ========================================================================= */}
      {/* HIGH-MAST INDUSTRIAL FLOODLIGHT TOWERS                                    */}
      {/* ========================================================================= */}
      {[
        { pos: [-22, 0, -22], angle: 0.78 },
        { pos: [22, 0, 22], angle: -2.35 },
      ].map((tower, idx) => (
        <group key={`tower-${idx}`} position={tower.pos as [number, number, number]} rotation={[0, tower.angle, 0]}>
          {/* Heavy Concrete Base Pier */}
          <mesh position={[0, FLOOR_Y + 0.6, 0]} castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[2.0, 1.2, 2.0]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
          {/* Steel Lattice Mast (14m Tall) */}
          <mesh position={[0, FLOOR_Y + 7.5, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.55, 13, 0.55]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Headframe Platform */}
          <mesh position={[0, FLOOR_Y + 14.1, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[2.4, 0.3, 1.2]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Glowing Floodlight Cluster Lenses */}
          {[-0.8, -0.25, 0.25, 0.8].map((lx, lidx) => (
            <group key={`lamp-${lidx}`} position={[lx, FLOOR_Y + 14.3, 0.4]}>
              <mesh rotation={[0.4, 0, 0]} raycast={noRaycast}>
                <boxGeometry args={[0.45, 0.35, 0.25]} />
                <Toon color={ART_STYLE.palette.ink} />
              </mesh>
              <mesh position={[0, -0.05, 0.14]} rotation={[0.4, 0, 0]} raycast={noRaycast}>
                <planeGeometry args={[0.4, 0.3]} />
                <meshBasicMaterial color="#fffbeb" toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
      ))}

      {/* ========================================================================= */}
      {/* AUTHENTIC TEARDOWN SALVAGE SET PIECES (CONTAINERS, BARRIERS, PALLETS)     */}
      {/* ========================================================================= */}
      {/* ISO Shipping Container 1: Weathered Oxide Red [-16, FLOOR_Y + 1.3, -4] */}
      <group position={[-16, FLOOR_Y + 1.3, -4]} rotation={[0, 0.15, 0]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[2.4, 2.6, 6.0]} />
          <Toon color={ART_STYLE.palette.rust} />
        </mesh>
        {/* Door Frame & Corner Posts */}
        <mesh position={[0, 0, 3.01]} raycast={noRaycast}>
          <planeGeometry args={[2.3, 2.5]} />
          <Toon color={ART_STYLE.palette.rust} />
        </mesh>
        {/* White Stenciled Hazard Placard */}
        <mesh position={[1.21, 0.4, 0.5]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.6, 0.6]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
      </group>

      {/* ISO Shipping Container 2: Maritime Blue [15, FLOOR_Y + 1.3, -15] */}
      <group position={[15, FLOOR_Y + 1.3, -15]} rotation={[0, -0.3, 0]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[2.4, 2.6, 6.0]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
      </group>

      {/* Stacked Wooden Cargo Pallets */}
      {[
        { pos: [-16, FLOOR_Y + 0.12, 1.5], rot: 0.1 },
        { pos: [-16, FLOOR_Y + 0.36, 1.5], rot: 0.05 },
        { pos: [14, FLOOR_Y + 0.12, 4], rot: -0.2 },
      ].map((pallet, idx) => (
        <mesh key={`pallet-${idx}`} position={pallet.pos as [number, number, number]} rotation={[0, pallet.rot, 0]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.2, 0.22, 1.2]} />
          <Toon color={ART_STYLE.palette.rust} />
        </mesh>
      ))}

      {/* Industrial 55-Gallon Steel Oil Drums (Teardown signature prop) */}
      {[
        { pos: [-14.5, FLOOR_Y + 0.5, 1.2], color: '#eab308' },
        { pos: [-14.5, FLOOR_Y + 0.5, 2.1], color: '#1e3a8a' },
        { pos: [-13.7, FLOOR_Y + 0.5, 1.6], color: '#b91c1c' },
        { pos: [13.2, FLOOR_Y + 0.5, 4.8], color: '#047857' },
      ].map((drum, idx) => (
        <mesh key={`drum-${idx}`} position={drum.pos as [number, number, number]} castShadow receiveShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.3, 0.3, 1.0, 16]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
      ))}

      {/* Concrete Highway Jersey Barriers with Yellow Safety Stripes (#999382) */}
      {[
        { pos: [10, FLOOR_Y + 0.45, 8.5], rot: 0 },
        { pos: [10, FLOOR_Y + 0.45, 15.5], rot: 0 },
        { pos: [-8, FLOOR_Y + 0.45, TANK.center[2] - 4], rot: Math.PI / 2 },
      ].map((barrier, idx) => (
        <group key={`barrier-${idx}`} position={barrier.pos as [number, number, number]} rotation={[0, barrier.rot, 0]}>
          <mesh castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[0.6, 0.9, 3.2]} />
            <Toon color={ART_STYLE.palette.concreteLit} />
          </mesh>
          <mesh position={[0.31, 0, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.02, 0.2, 3.0]} />
            <Toon color={ART_STYLE.palette.mustard} />
          </mesh>
        </group>
      ))}

      {/* ========================================================================= */}
      {/* RECOGNIZABLE CRUSHED CAR SILHOUETTES & SALVAGE STACKS (ASTRA DIRECTIVE)   */}
      {/* ========================================================================= */}
      {/* Stacked Wreck 1: Faded Teal Vehicle on Loading Deck */}
      <group position={[-16.5, FLOOR_Y + 1.45, 6.0]} rotation={[0.04, 0.2, -0.05]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.8, 0.9, 1.8]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
        {/* Crushed Cabin & Window Openings */}
        <mesh position={[0.2, 0.65, 0]} rotation={[0.08, 0, -0.1]} castShadow raycast={noRaycast}>
          <boxGeometry args={[2.0, 0.55, 1.6]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
        {/* Wheels */}
        {[-1.2, 1.2].map((wx, widx) => (
          <mesh key={`scw1-${widx}`} position={[wx, -0.3, 0.92]} rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
            <Toon color={ART_STYLE.palette.rust} />
          </mesh>
        ))}
      </group>

      {/* Stacked Wreck 2: Compacted Oxidized Red Vehicle Stacked Above Wreck 1 */}
      <group position={[-16.2, FLOOR_Y + 2.5, 6.2]} rotation={[-0.08, -0.15, 0.12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.4, 0.75, 1.7]} />
          <Toon color={ART_STYLE.palette.rust} />
        </mesh>
        <mesh position={[-0.2, 0.5, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[1.8, 0.45, 1.5]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
      </group>

      {/* Stacked Wreck 3: Dirty Mustard Salvage Sedan in Foreground Bay */}
      <group position={[-11.5, FLOOR_Y + 0.48, 8.5]} rotation={[0.06, 0.45, -0.04]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.6, 0.85, 1.8]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
        <mesh position={[0.3, 0.6, 0]} rotation={[0.05, 0, -0.08]} castShadow raycast={noRaycast}>
          <boxGeometry args={[1.9, 0.52, 1.55]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
      </group>

      {/* Heavy Overhead Industrial Crane Gantry Spanning Center Runway - Framed in Upper 15-25% */}
      <group position={[0, FLOOR_Y + 8.8, -1.5]}>
        {/* Main Crane Bridge Double I-Beams: Flanges (#EF8737) & Center Webs (#D96320 Crane Orange) */}
        {[-1.5, 1.5].map((bz, bidx) => (
          <group key={`crane-beam-${bidx}`} position={[0, 0, bz]}>
            {/* Top Flange */}
            <mesh position={[0, 0.45, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[52, 0.12, 0.65]} />
              <Toon color={ART_STYLE.palette.signalOrange} />
            </mesh>
            {/* Recessed Center Web - Now Vivid Crane Orange (#D96320) per Astra Round 9 */}
            <mesh position={[0, 0, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[52, 0.78, 0.16]} />
              <Toon color={ART_STYLE.palette.signalOrange} />
            </mesh>
            {/* Bottom Flange */}
            <mesh position={[0, -0.45, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[52, 0.12, 0.65]} />
              <Toon color={ART_STYLE.palette.signalOrange} />
            </mesh>
            {/* Dark Steel Crane Rail on Top */}
            <mesh position={[0, 0.54, 0]} castShadow raycast={noRaycast}>
              <boxGeometry args={[52, 0.10, 0.18]} />
              <Toon color={ART_STYLE.palette.ink} />
            </mesh>
          </group>
        ))}

        {/* Sloped Haunch Gussets Framing Gantry Arch (D6 spec) */}
        <mesh position={[-11.5, -1.4, 0]} rotation={[0, 0, Math.PI / 4]} castShadow raycast={noRaycast}>
          <boxGeometry args={[3.2, 0.45, 1.2]} />
          <Toon color={ART_STYLE.palette.signalOrange} />
        </mesh>
        <mesh position={[11.5, -1.4, 0]} rotation={[0, 0, -Math.PI / 4]} castShadow raycast={noRaycast}>
          <boxGeometry args={[3.2, 0.45, 1.2]} />
          <Toon color={ART_STYLE.palette.signalOrange} />
        </mesh>

        {/* Left Primary Gantry A-Frame Tower - Anchors the Left Viewport (Astra Directive) */}
        <group position={[-13.5, -4.4, 0]}>
          {/* North Leg */}
          <mesh position={[0, 0, -2.2]} rotation={[-0.14, 0, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.9, 9.0, 0.9]} />
            <Toon color={ART_STYLE.palette.signalOrange} />
          </mesh>
          {/* South Leg */}
          <mesh position={[0, 0, 2.2]} rotation={[0.14, 0, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.9, 9.0, 0.9]} />
            <Toon color={ART_STYLE.palette.signalOrange} />
          </mesh>
          {/* Diagonal Cross-Bracing Struts (#424B49 Structural Steel) */}
          {[-1.8, 0.6, 2.6].map((by, bidx) => (
            <group key={`gantry-brace-${bidx}`} position={[0, by, 0]}>
              <mesh rotation={[0.42, 0, 0]} castShadow raycast={noRaycast}>
                <boxGeometry args={[0.3, 2.8, 0.3]} />
                <Toon color={ART_STYLE.palette.ink} />
              </mesh>
              <mesh rotation={[-0.42, 0, 0]} castShadow raycast={noRaycast}>
                <boxGeometry args={[0.3, 2.8, 0.3]} />
                <Toon color={ART_STYLE.palette.ink} />
              </mesh>
              {/* Horizontal Tie Beam */}
              <mesh position={[0, 0, 0]} castShadow raycast={noRaycast}>
                <boxGeometry args={[0.6, 0.35, 3.4]} />
                <Toon color={ART_STYLE.palette.signalOrange} />
              </mesh>
            </group>
          ))}
          {/* Heavy Ground Rail Bogie with Steel Rail Wheels */}
          <mesh position={[0, -4.2, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[1.4, 0.7, 5.4]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
        </group>

        {/* Right Perimeter Column */}
        <group position={[24.8, -4.4, 0]}>
          <mesh castShadow raycast={noRaycast}>
            <boxGeometry args={[1.2, 9.0, 3.6]} />
            <Toon color={ART_STYLE.palette.signalOrange} />
          </mesh>
          <mesh position={[-1.2, 3.2, 0]} rotation={[0, 0, 0.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.3, 3.0, 0.3]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
        </group>

        {/* Suspended Operator Control Cabin (#343C3D) with Amber Window */}
        <group position={[-11.5, -1.5, -1.5]}>
          <mesh castShadow raycast={noRaycast}>
            <boxGeometry args={[2.4, 2.0, 2.0]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[0, 0.1, 1.01]} raycast={noRaycast}>
            <planeGeometry args={[2.0, 1.1]} />
            <meshBasicMaterial color="#f59e0b" toneMapped={false} />
          </mesh>
        </group>

        {/* Gantry Hoist Trolley, Cables & Heavy Hook (#D96320 / #343C3D) */}
        <group position={[3.5, 0, 0]}>
          <mesh position={[0, -0.3, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[2.8, 0.6, 3.2]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Dual Hoist Steel Cables */}
          {[-0.6, 0.6].map((cx, cidx) => (
            <mesh key={`cable-${cidx}`} position={[cx, -2.6, 0]} castShadow raycast={noRaycast}>
              <cylinderGeometry args={[0.035, 0.035, 4.6, 8]} />
              <Toon color={ART_STYLE.palette.ink} />
            </mesh>
          ))}
          {/* Heavy Block & Industrial Crane Hook */}
          <mesh position={[0, -5.0, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[1.1, 0.9, 0.9]} />
            <Toon color={ART_STYLE.palette.signalOrange} />
          </mesh>
          <mesh position={[0, -5.6, 0]} rotation={[0, 0, 0.2]} castShadow raycast={noRaycast}>
            <torusGeometry args={[0.4, 0.09, 8, 16, Math.PI * 1.5]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
        </group>
      </group>

      {/* ========================================================================= */}
      {/* HERO DEMOLITION CUTTING RIG & ACTIVE TORCH INCANDESCENCE (ASTRA FOCAL)    */}
      {/* Positioned in Mid-Right Midground (65-72% Screen Width)                   */}
      {/* ========================================================================= */}
      <group position={[6.5, FLOOR_Y, 1.2]}>
        {/* Tracked Demolition Excavator Carriage - Astra Round 8 Dirty Mustard (#BA8C2D) */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.2, 0.8, 2.6]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
        {/* Crawler Tracks */}
        <mesh position={[0, 0.25, -1.3]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.6, 0.5, 0.6]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>
        <mesh position={[0, 0.25, 1.3]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.6, 0.5, 0.6]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>

        {/* Articulated Hydraulic Boom Arm - Astra Dielectric Safety Orange (#EA701F) */}
        <group position={[-0.8, 0.8, 0]}>
          <mesh position={[-0.9, 0.7, 0]} rotation={[0, 0, 0.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[2.2, 0.35, 0.35]} />
            <Toon color={ART_STYLE.palette.orangeShade} />
          </mesh>
          {/* Hydraulic Cylinder */}
          <mesh position={[-0.7, 0.35, 0.22]} rotation={[0, 0, 0.5]} castShadow raycast={noRaycast}>
            <cylinderGeometry args={[0.06, 0.06, 1.4, 8]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
          {/* Secondary Arm extending down to work beam */}
          <mesh position={[-1.9, 0.4, 0]} rotation={[0, 0, -0.4]} castShadow raycast={noRaycast}>
            <boxGeometry args={[1.6, 0.28, 0.28]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>

          {/* Cutting Torch Nozzle Head with Intense Emissive Core (#FFF2BC) & Additive Glow Card */}
          <group position={[-2.6, -0.1, 0]}>
            <mesh raycast={noRaycast}>
              <boxGeometry args={[0.4, 0.3, 0.3]} />
              <Toon color={ART_STYLE.palette.signalOrange} />
            </mesh>
            {/* Brilliant White-Gold Flame Core (Astra Round 7: #FFF2BC) */}
            <mesh position={[0, -0.22, 0]} raycast={noRaycast}>
              <coneGeometry args={[0.12, 0.46, 8]} />
              <meshBasicMaterial color="#fff2bc" toneMapped={false} />
            </mesh>
            {/* Outer Flame Envelope (Astra Round 7: #FFC042) */}
            <mesh position={[0, -0.32, 0]} raycast={noRaycast}>
              <coneGeometry args={[0.24, 0.65, 8]} />
              <meshBasicMaterial color="#ffc042" transparent opacity={0.75} toneMapped={false} />
            </mesh>
            {/* Additive Glow Halo Billboard Card - Creates Rich Work Light Glow Without Bloom */}
            <mesh position={[0, -0.25, 0]} rotation={[0.4, -0.3, 0]} raycast={noRaycast}>
              <planeGeometry args={[1.8, 1.8]} />
              <meshBasicMaterial
                color="#ff9a32"
                transparent
                opacity={0.55}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            {/* Local Cutting Glow (Astra Round 9: #FFAA36, range 5.8m, intensity 65) */}
            <pointLight position={[0, -0.35, 0]} intensity={65} distance={5.8} color="#ffaa36" />

            {/* Additive Glow Halo Billboard Card - Creates Rich Work Light Glow Without Bloom */}
            <mesh position={[0, -0.25, 0]} rotation={[0.3, -0.2, 0]} raycast={noRaycast}>
              <planeGeometry args={[2.4, 2.4]} />
              <meshBasicMaterial
                color="#ffaa36"
                transparent
                opacity={0.65}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            {/* Downward Cascading Sparks in single draw call */}
            <CuttingRigSparks />
          </group>
        </group>

        {/* Work Industrial Steel I-Beam Being Cut (Astra Round 5: Structural Steel #424B49) */}
        <group position={[-2.6, 0.75, 0]}>
          <mesh castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[3.2, 0.45, 0.55]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Molten Severed Cut Seam (#FFF1B0 Core) */}
          <mesh position={[0, 0, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.06, 0.48, 0.58]} />
            <meshBasicMaterial color={ART_STYLE.palette.spark} toneMapped={false} />
          </mesh>
        </group>

        {/* Target Vehicle Beside Rig: Salvage Teal (Astra Round 5: #527E78) */}
        <group position={[-3.6, 0.5, 0]} rotation={[0.06, 0.25, -0.04]}>
          <mesh castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[3.8, 1.05, 1.85]} />
            <Toon color={ART_STYLE.palette.teal} />
          </mesh>
          {/* Crumpled Roof & Glazing Apertures */}
          <mesh position={[0.35, 0.72, 0]} rotation={[0.08, 0, -0.12]} castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[2.1, 0.62, 1.65]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          {/* Rusted Wheels */}
          {[-1.2, 1.2].map((wx, widx) => (
            <mesh key={`cw-${widx}`} position={[wx, -0.35, 0.94]} rotation={[Math.PI / 2, 0, 0]} castShadow raycast={noRaycast}>
              <cylinderGeometry args={[0.36, 0.36, 0.24, 12]} />
              <Toon color={ART_STYLE.palette.rust} />
            </mesh>
          ))}
        </group>

        {/* Flat Ground Scorch Rings (D6 Spec: glow and spark colors) */}
        <group position={[-2.6, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0.2]}>
          <mesh raycast={noRaycast}>
            <ringGeometry args={[0.48, 0.95, 24]} />
            <meshBasicMaterial color={ART_STYLE.palette.glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.001]} raycast={noRaycast}>
            <circleGeometry args={[0.48, 20]} />
            <meshBasicMaterial color={ART_STYLE.palette.spark} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* ========================================================================= */}
      {/* STATIC SALVAGE DRESSING (D6 SPEC: CAR ROWS, BLOCK CLUSTERS, DEBRIS CHIPS)  */}
      {/* ========================================================================= */}
      <YardDressing />
      {/* ========================================================================= */}
      {/* SECTOR B: SEESAW FULCRUM STAND [-8, FLOOR_Y + 0.45, -6]                   */}
      {/* ========================================================================= */}
      <group position={[-8, FLOOR_Y + 0.45, -6]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.4, 0.9, 1.4]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>
        {/* Heavy Greased Steel Pivot Axle */}
        <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.18, 0.18, 1.6, 16]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* SECTOR C: BALL DROP HOPPER SCAFFOLDING [-12, FLOOR_Y + 2.5, 12]           */}
      {/* ========================================================================= */}
      <group position={[-12, FLOOR_Y + 2.5, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4.2, 5.0, 4.2]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>
        {/* Industrial Steel Pipe Railings */}
        <mesh position={[0, 2.7, 2.0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[4.0, 0.45, 0.12]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* SECTOR D: VEHICLE TEST RAMP & PAD [12, FLOOR_Y + 0.4, 12]                 */}
      {/* ========================================================================= */}
      <group position={[12, FLOOR_Y + 0.4, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4.4, 0.8, 6.4]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
        {/* Yellow Chevron Ramp Edge Stripes */}
        <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[4.2, 0.3]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* TEARDOWN WATER BASIN: Translucent Crystal Tank & Luminous Turquoise Water */}
      {/* ========================================================================= */}
      <mesh position={[TANK.center[0], waterLayout.tankCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={[TANK.innerSize[0] + TANK.wallThickness * 2, waterLayout.tankHeight, TANK.innerSize[2] + TANK.wallThickness * 2]} />
        <meshPhysicalMaterial
          color="#94a3b8"
          transparent
          opacity={0.18}
          roughness={0.04}
          metalness={0.1}
          transmission={0.65}
          thickness={0.3}
        />
      </mesh>
      {/* Concrete Rim Curb with Yellow Safety Striping */}
      <mesh position={[TANK.center[0], TANK.surfaceY + 0.05, TANK.center[2]]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[TANK.innerSize[0] + 0.8, 0.1, TANK.innerSize[2] + 0.8]} />
        <Toon color={ART_STYLE.palette.ink} />
      </mesh>
      {/* Luminous Subsurface Water Mass */}
      <mesh position={[TANK.center[0], waterLayout.fillCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={waterLayout.fillSize} />
        <meshPhysicalMaterial
          color="#0d9488"
          transparent
          opacity={0.38}
          roughness={0.12}
          metalness={0.05}
          depthWrite={false}
        />
      </mesh>
      <WaterCaustics position={tuple3(TANK.center[0], TANK.bottomY + 0.018, TANK.center[2])} size={waterLayout.surfaceSize} />
      <WaterSurface position={tuple3(TANK.center[0], waterLayout.surfaceY, TANK.center[2])} size={waterLayout.surfaceSize} />
    </>
  );
}
