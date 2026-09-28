import { ART_STYLE, deriveLightRig, YARD_LIGHTING } from "./style/artStyle";
import { Toon } from "./style/toonMaterial";
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WaterTankSpec } from 'voxel-kit';
import { FLOOR_Y, getTerrainHeightAt, TANK, TANK_SPEC, TERRAIN_COLS, TERRAIN_ROWS, TERRAIN_SPACING } from '../sim/constants';
import { SHELL_BOXES } from '../sim/shell';
import { BALES_ORIGIN, FLOODLIGHT_MASTS, MAST_LAMP_HEIGHT, mastYaw, openTankFrameBoxes, TANK_RIM, VEHICLE_RAMP } from '../sim/setPieces';
import { RAMP_PARTS } from './rampParts';
import { glowTexture } from './style/glowTexture';
import { SkyDome } from './SkyDome';
import { Skyline } from './Skyline';
import { AtmosphereDust } from './AtmosphereDust';
import { InvertedHullMesh } from './style/InvertedHullMesh';
import { YardDressing } from './dressing/YardDressing';
import { WaterCaustics, WaterSurface } from './Water';
import { isMobileDevice } from './DynamicDpr';
import type { YardRender } from './presentation';

const noRaycast = () => null;
const tuple3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

function DemolitionTerrainMesh() {
  const geom = useMemo(() => {
    const plane = new THREE.PlaneGeometry((TERRAIN_COLS - 1) * TERRAIN_SPACING, (TERRAIN_ROWS - 1) * TERRAIN_SPACING, TERRAIN_COLS - 1, TERRAIN_ROWS - 1);
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
        color.set(ART_STYLE.palette.concreteShade);
      } else if (vy > FLOOR_Y + 0.7) {
        // Sloped berms & ridges
        color.set(ART_STYLE.palette.concreteLit);
      } else {
        // Main yard floor: dark asphalt, so props and orange steel read against it
        color.set(ART_STYLE.palette.floor);
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


function tankFrameGeometry(thickness: number, height: number, centerY: number) {
  const parts = openTankFrameBoxes(TANK.innerSize[0], TANK.innerSize[2], thickness, height).map(({ center, size }) => {
    const part = new THREE.BoxGeometry(...size);
    part.translate(TANK.center[0] + center[0], centerY, TANK.center[2] + center[2]);
    return part;
  });
  const geometry = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}

const TANK_WALL_GEOMETRY = tankFrameGeometry(TANK.wallThickness, TANK.surfaceY - TANK.bottomY, (TANK.surfaceY + TANK.bottomY) / 2);
const TANK_RIM_GEOMETRY = tankFrameGeometry(TANK_RIM.thickness, TANK_RIM.height, TANK_RIM.centerY);

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

const CONTAINER_BOX_GEOM = new THREE.BoxGeometry(6.0, 2.5, 2.38);

function createContainerBodyGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  geoms.push(new THREE.BoxGeometry(6.0, 2.5, 2.38));
  const ribOffsets = [-2.4, -1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8, 2.4];
  for (const rx of ribOffsets) {
    const r1 = new THREE.BoxGeometry(0.16, 2.35, 0.05);
    r1.translate(rx, 0, 1.2);
    geoms.push(r1);

    const r2 = new THREE.BoxGeometry(0.16, 2.35, 0.05);
    r2.translate(rx, 0, -1.2);
    geoms.push(r2);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

function createContainerFrameGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  const posts = [
    [-2.95, -1.15],
    [-2.95, 1.15],
    [2.95, -1.15],
    [2.95, 1.15],
  ];
  for (const [cx, cz] of posts) {
    const post = new THREE.BoxGeometry(0.18, 2.58, 0.18);
    post.translate(cx, 0, cz);
    geoms.push(post);
  }

  const rimTop = new THREE.BoxGeometry(6.04, 0.08, 2.42);
  rimTop.translate(0, 1.26, 0);
  geoms.push(rimTop);

  const rimBottom = new THREE.BoxGeometry(6.04, 0.08, 2.42);
  rimBottom.translate(0, -1.26, 0);
  geoms.push(rimBottom);

  for (const dz of [-0.45, 0.45]) {
    const rod = new THREE.CylinderGeometry(0.025, 0.025, 2.3, 8);
    rod.translate(3.01, 0, dz);
    geoms.push(rod);
  }

  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

const CONTAINER_BODY_GEOM = createContainerBodyGeometry();
const CONTAINER_FRAME_GEOM = createContainerFrameGeometry();

/** Pilaster offsets along each wall (m). */
const WALL_PILASTERS = Array.from({ length: 13 }, (_, i) => -24 + i * 4);
const wallTrimCache = new Map<string, THREE.BufferGeometry>();

/** One merged mesh per wall size: pilasters and a panel line on the local +x face. */
function wallTrimGeometry(size: readonly [number, number, number]): THREE.BufferGeometry {
  const key = size.join(',');
  const cached = wallTrimCache.get(key);
  if (cached) return cached;
  // Pilasters protrude 7 cm, within the wall collider's contact margin.
  const parts = WALL_PILASTERS.map((z) => new THREE.BoxGeometry(0.1, size[1], 0.35).translate(size[0] / 2 + 0.02, 0, z));
  parts.push(new THREE.BoxGeometry(0.04, 0.08, size[2]).translate(size[0] / 2 + 0.02, size[1] * 0.2, 0));
  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  wallTrimCache.set(key, merged);
  return merged;
}
const FLOODLIGHT_COLOR = '#ffe5a3';
/** Lens color above 1.0 in the HDR target, so the bloom picks it up. */
const FLOODLIGHT_LENS = new THREE.Color(FLOODLIGHT_COLOR).multiplyScalar(3);

function createMastSteelGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  const mast = new THREE.CylinderGeometry(0.2, 0.35, 11, 8);
  mast.translate(0, 5.5, 0);
  geoms.push(mast);

  const head = new THREE.BoxGeometry(2.4, 0.4, 0.6);
  head.translate(0, MAST_LAMP_HEIGHT, 0);
  geoms.push(head);

  for (const lx of [-0.8, 0, 0.8]) {
    const b1 = new THREE.BoxGeometry(0.55, 0.3, 0.2);
    b1.rotateX(0.45);
    b1.translate(lx, MAST_LAMP_HEIGHT + 0.15, 0.32);
    geoms.push(b1);

    const b2 = new THREE.BoxGeometry(0.55, 0.3, 0.2);
    b2.rotateX(0.45);
    b2.translate(lx, MAST_LAMP_HEIGHT - 0.15, 0.32);
    geoms.push(b2);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

function createMastLensesGeometry(): THREE.BufferGeometry {
  const geoms: THREE.BufferGeometry[] = [];
  for (const lx of [-0.8, 0, 0.8]) {
    const l1 = new THREE.PlaneGeometry(0.5, 0.24);
    l1.rotateX(0.45);
    l1.translate(lx, MAST_LAMP_HEIGHT + 0.15, 0.32 + 0.11);
    geoms.push(l1);

    const l2 = new THREE.PlaneGeometry(0.5, 0.24);
    l2.rotateX(0.45);
    l2.translate(lx, MAST_LAMP_HEIGHT - 0.15, 0.32 + 0.11);
    geoms.push(l2);
  }
  const merged = BufferGeometryUtils.mergeGeometries(geoms);
  geoms.forEach((g) => g.dispose());
  return merged;
}

const MAST_STEEL_GEOM = createMastSteelGeometry();
const MAST_LENSES_GEOM = createMastLensesGeometry();

function ShippingContainer({
  position,
  rotation = [0, 0, 0],
  color,
  hasHazardDecal = true,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  hasHazardDecal?: boolean;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={CONTAINER_BODY_GEOM} castShadow receiveShadow raycast={noRaycast}>
        <Toon color={color} />
      </mesh>
      <mesh geometry={CONTAINER_FRAME_GEOM} raycast={noRaycast}>
        <Toon color={ART_STYLE.palette.ink} />
      </mesh>
      <InvertedHullMesh geometry={CONTAINER_BOX_GEOM} thickness={0.02} color={ART_STYLE.palette.ink} />
      {/* Astra Teardown Soft Contact Grounding Shadow */}
      <mesh position={[0, -1.24, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <planeGeometry args={[6.2, 2.58]} />
        <meshBasicMaterial color="#0d131a" opacity={0.32} transparent depthWrite={false} />
      </mesh>
      {hasHazardDecal && (
        <mesh position={[0, 0.55, 1.22]} raycast={noRaycast}>
          <planeGeometry args={[1.5, 0.45]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
      )}
    </group>
  );
}

function GravityHopper({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[
        [-1.8, -1.8],
        [-1.8, 1.8],
        [1.8, -1.8],
        [1.8, 1.8],
      ].map(([lx, lz], idx) => (
        <mesh key={`leg-${idx}`} position={[lx, 0, lz]} raycast={noRaycast}>
          <boxGeometry args={[0.3, 5.0, 0.3]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>
      ))}
      {[-1.5, 0.5].map((yOffset, yIdx) => (
        <group key={`tier-${yIdx}`} position={[0, yOffset, 0]}>
          <mesh position={[0, 0, 1.8]} raycast={noRaycast}>
            <boxGeometry args={[3.8, 0.16, 0.16]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[0, 0, -1.8]} raycast={noRaycast}>
            <boxGeometry args={[3.8, 0.16, 0.16]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[1.8, 0, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
            <boxGeometry args={[3.8, 0.16, 0.16]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh position={[-1.8, 0, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
            <boxGeometry args={[3.8, 0.16, 0.16]} />
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.45, 0]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[4.1, 0.22, 4.1]} />
        <Toon color={ART_STYLE.palette.rust} />
      </mesh>
      <mesh position={[0, 2.9, 1.95]} rotation={[-0.25, 0, 0]} raycast={noRaycast}>
        <boxGeometry args={[3.9, 0.8, 0.1]} />
        <Toon color={ART_STYLE.palette.signalOrange} />
      </mesh>
      <mesh position={[0, 2.9, -1.95]} rotation={[0.25, 0, 0]} raycast={noRaycast}>
        <boxGeometry args={[3.9, 0.8, 0.1]} />
        <Toon color={ART_STYLE.palette.signalOrange} />
      </mesh>
      <mesh position={[-1.95, 2.9, 0]} rotation={[0, 0, 0.25]} raycast={noRaycast}>
        <boxGeometry args={[0.1, 0.8, 3.9]} />
        <Toon color={ART_STYLE.palette.signalOrange} />
      </mesh>
      <group position={[2.5, 1.4, 0]} rotation={[0, 0, -0.42]}>
        <mesh receiveShadow raycast={noRaycast}>
          <boxGeometry args={[2.8, 0.12, 1.4]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
        {[-0.65, 0.65].map((rz, idx) => (
          <mesh key={`chute-rail-${idx}`} position={[0, 0.22, rz]} raycast={noRaycast}>
            <boxGeometry args={[2.8, 0.32, 0.08]} />
            <Toon color={ART_STYLE.palette.mustard} />
          </mesh>
        ))}
      </group>
      <mesh position={[-0.8, 2.85, 2.0]} raycast={noRaycast}>
        <boxGeometry args={[2.4, 0.55, 0.08]} />
        <Toon color={ART_STYLE.palette.mustard} />
      </mesh>
    </group>
  );
}

const TIRE_BARRIER_GEOMETRY = (() => {
  const parts: THREE.BufferGeometry[] = [];
  for (const x of [-1.2, -0.4, 0.4, 1.2]) {
    for (const [row, y] of [0.14, 0.42, 0.70].entries()) {
      const tire = new THREE.TorusGeometry(0.38, 0.14, 8, 14);
      tire.rotateX(Math.PI / 2);
      tire.translate(x, y, row % 2 === 0 ? 0.04 : -0.04);
      parts.push(tire);
    }
  }
  const geometry = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
})();

function ScrapTireBarrier({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation} geometry={TIRE_BARRIER_GEOMETRY} raycast={noRaycast}>
      <Toon color="#1a1c1a" />
    </mesh>
  );
}

function ScrapMetalBales({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[1.0, 0.9, 1.0]} />
        <Toon color={ART_STYLE.palette.rust} />
      </mesh>
      <mesh position={[0.95, 0.4, 0.1]} rotation={[0, 0.1, 0]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.9, 0.8, 0.9]} />
        <Toon color={ART_STYLE.palette.teal} />
      </mesh>
      <mesh position={[0.3, 1.25, 0.05]} rotation={[0, -0.15, 0]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.85, 0.75, 0.85]} />
        <Toon color={ART_STYLE.palette.concreteLit} />
      </mesh>
    </group>
  );
}

export function YardShell({ renderRef }: { renderRef?: React.MutableRefObject<YardRender | null> }) {
  const isMobile = isMobileDevice();
  const waterLayout = computeWaterVisualLayout(TANK_SPEC);
  const lightRig = deriveLightRig(ART_STYLE);

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const lastPoseBuffer = useRef<Float32Array>(new Float32Array(64 * 3));
  const lastBodyCount = useRef(-1);
  const framesSinceUpdate = useRef(0);

  useFrame(() => {
    if (isMobile || !dirLightRef.current) return;
    const shadow = dirLightRef.current.shadow;
    if (!shadow) return;
    shadow.autoUpdate = false;

    const render = renderRef?.current;
    if (!render) {
      if (framesSinceUpdate.current === 0) {
        shadow.needsUpdate = true;
        framesSinceUpdate.current = 1;
      }
      return;
    }

    let needsUpdate = false;
    if (lastBodyCount.current !== render.bodies.length) {
      lastBodyCount.current = render.bodies.length;
      needsUpdate = true;
    }

    if (!needsUpdate) {
      const bodies = render.bodies;
      if (lastPoseBuffer.current.length < bodies.length * 3) {
        lastPoseBuffer.current = new Float32Array(bodies.length * 3);
        needsUpdate = true;
      }
      const buf = lastPoseBuffer.current;
      let offset = 0;
      for (let i = 0; i < bodies.length; i++) {
        const pose = render.poses.get(bodies[i]!.id);
        if (!pose) continue;
        const dx = buf[offset] - pose.position[0];
        const dy = buf[offset + 1] - pose.position[1];
        const dz = buf[offset + 2] - pose.position[2];
        if (dx * dx + dy * dy + dz * dz > 0.0001) {
          needsUpdate = true;
          break;
        }
        offset += 3;
      }
    }

    if (needsUpdate || framesSinceUpdate.current > 60) {
      shadow.needsUpdate = true;
      framesSinceUpdate.current = 0;
      const bodies = render.bodies;
      const buf = lastPoseBuffer.current;
      let offset = 0;
      for (let i = 0; i < bodies.length; i++) {
        const pose = render.poses.get(bodies[i]!.id);
        if (!pose) continue;
        buf[offset] = pose.position[0];
        buf[offset + 1] = pose.position[1];
        buf[offset + 2] = pose.position[2];
        offset += 3;
      }
    } else {
      framesSinceUpdate.current += 1;
    }
  });

  return (
    <>
      {/* Retro-industrial stepped Sky Dome */}
      <SkyDome />

      {/* Retro-industrial 2-layer silhouette skyline backdrop */}
      <Skyline />

      {/* Ambient atmospheric dust motes & diesel haze */}
      <AtmosphereDust />

      {/* Retro-industrial cel light rig derived from ART_STYLE */}
      <fog attach="fog" args={[ART_STYLE.palette.haze, 30, 150]} />
      {/* Astra Teardown Lighting Rig: Dual-Hemisphere Skylight & Ground Bounce + Low-Angle Sun */}
      <ambientLight
        intensity={Math.PI * 0.42}
        color={new THREE.Color(...YARD_LIGHTING.ambientFloor)}
      />
      <hemisphereLight
        args={[
          new THREE.Color(...YARD_LIGHTING.sky),
          new THREE.Color(...YARD_LIGHTING.ground),
          Math.PI * 0.5,
        ]}
        position={[0, 1, 0]}
      />
      <directionalLight
        ref={dirLightRef}
        position={[...lightRig.key.position]}
        intensity={Math.PI * 1.05}
        color={new THREE.Color(...YARD_LIGHTING.sun)}
        castShadow={!isMobile}
        shadow-mapSize-width={isMobile ? 512 : 1024}
        shadow-mapSize-height={isMobile ? 512 : 1024}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-far={70}
        shadow-bias={-0.0003}
        shadow-normalBias={0.035}
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
      <group position={[-21, FLOOR_Y + 0.5, 0]}>
        <mesh receiveShadow castShadow raycast={noRaycast}>
          <boxGeometry args={[6, 1.0, 30]} />
          <Toon color={ART_STYLE.palette.concreteLit} />
        </mesh>
        {/* Retaining Wall Face Curb with Yellow Stripes */}
        <mesh position={[3.02, 0.35, 0]} raycast={noRaycast}>
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

      {/* High-mast floodlights at the four corners, turned to face the yard */}
      {FLOODLIGHT_MASTS.map(([x, z]) => (
        <group key={`mast-${x}-${z}`} position={[x, FLOOR_Y, z]} rotation={[0, mastYaw(x, z), 0]}>
          <mesh position={[0, 0.6, 0]} castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[2.0, 1.2, 2.0]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
          <mesh geometry={MAST_STEEL_GEOM} castShadow raycast={noRaycast}>
            <Toon color={ART_STYLE.palette.ink} />
          </mesh>
          <mesh geometry={MAST_LENSES_GEOM} raycast={noRaycast}>
            <meshBasicMaterial color={FLOODLIGHT_LENS} toneMapped={false} />
          </mesh>
          <sprite position={[0, MAST_LAMP_HEIGHT, 0.9]} scale={[6, 6, 1]} raycast={noRaycast}>
            <spriteMaterial
              color={FLOODLIGHT_COLOR}
              map={glowTexture()}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
              toneMapped={false}
            />
          </sprite>
        </group>
      ))}

      {/* ========================================================================= */}
      {/* CONCRETE RETAINING WALLS & SLAB JOINTS (D6 SPEC)                          */}
      {/* ========================================================================= */}
      {SHELL_BOXES.filter((box) => box.id.startsWith('wall-')).map((box) => {
        const alongX = box.size[0] > box.size[2];
        // Local +x is the wall normal. Turn it so +x faces the yard.
        const inward = alongX ? -Math.sign(box.center[2]) : -Math.sign(box.center[0]);
        return {
          pos: [...box.center] as [number, number, number],
          rot: alongX ? (inward > 0 ? -Math.PI / 2 : Math.PI / 2) : (inward > 0 ? 0 : Math.PI),
          size: tuple3(alongX ? box.size[2] : box.size[0], box.size[1], alongX ? box.size[0] : box.size[2]),
        };
      }).map((wall, idx) => (
        <group key={`wall-${idx}`} position={wall.pos as [number, number, number]} rotation={[0, wall.rot, 0]}>
          {/* Main Concrete Retaining Wall */}
          <mesh receiveShadow castShadow raycast={noRaycast}>
            <boxGeometry args={wall.size as [number, number, number]} />
            <Toon color={ART_STYLE.palette.concreteLit} />
          </mesh>
          {/* Panel pilasters every 4 m and a panel line, on the yard face */}
          <mesh geometry={wallTrimGeometry(wall.size)} raycast={noRaycast}>
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
          {/* Concrete cap band, flush with the collider top */}
          <mesh position={[0, wall.size[1] / 2 - 0.15, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.7, 0.3, 52]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
          </mesh>
        </group>
      ))}


      {/* ========================================================================= */}
      {/* AUTHENTIC TEARDOWN SALVAGE SET PIECES (CONTAINERS, BARRIERS, PALLETS)     */}
      {/* ========================================================================= */}
      {/* ISO Shipping Container 1: Weathered Oxide Red [-16, FLOOR_Y + 1.3, -4] */}
      <group position={[-22, FLOOR_Y + 2.3, -4]} rotation={[0, 0.15, 0]}>
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
      <group position={[21.5, FLOOR_Y + 1.3, -15]} rotation={[0, -0.3, 0]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[2.4, 2.6, 6.0]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
      </group>

      {/* Drums and pallets are dynamic bodies (sim/presets.ts), drawn by VoxelBodies. */}
      {/* Concrete Highway Jersey Barriers - Positioned as outer circuit crash barriers */}
      {[
        { pos: [20.5, FLOOR_Y + 0.45, 6.0], rot: 0 },
        { pos: [20.5, FLOOR_Y + 0.45, 12.0], rot: 0 },
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

      {/* Stunt launch ramp: safety-orange deck with inset hazard curbs */}
      <group position={[...VEHICLE_RAMP.center]} rotation={[VEHICLE_RAMP.pitch, 0, 0]}>
        {RAMP_PARTS.map((part) => (
          <mesh key={part.name} position={[...part.center]} castShadow={part.name === 'deck'} receiveShadow raycast={noRaycast}>
            <boxGeometry args={[...part.size]} />
            <Toon color={ART_STYLE.palette[part.color]} />
          </mesh>
        ))}
      </group>

      {/* Seesaw Fulcrum Pivot Stand */}
      <group position={[-14, FLOOR_Y + 0.45, -6]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.2, 0.9, 1.2]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
        <mesh position={[0, 0.48, 0]} rotation={[0, 0, Math.PI / 2]} raycast={noRaycast}>
          <cylinderGeometry args={[0.12, 0.12, 1.3, 12]} />
          <Toon color={ART_STYLE.palette.ink} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* RECOGNIZABLE CRUSHED CAR SILHOUETTES & SALVAGE STACKS (ASTRA DIRECTIVE)   */}
      {/* ========================================================================= */}
      {/* Stacked Wreck 1: Faded Teal Vehicle on Loading Deck */}
      <group position={[-21, FLOOR_Y + 1.45, 6.0]} rotation={[0.04, 0.2, -0.05]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[3.8, 0.9, 1.8]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
        {/* Crushed Cabin & Window Openings */}
        <mesh position={[0.2, 0.65, 0]} rotation={[0.08, 0, -0.1]} raycast={noRaycast}>
          <boxGeometry args={[2.0, 0.55, 1.6]} />
          <Toon color={ART_STYLE.palette.teal} />
        </mesh>
        {/* Wheels */}
        {[-1.2, 1.2].map((wx, widx) => (
          <mesh key={`scw1-${widx}`} position={[wx, -0.3, 0.92]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.32, 0.32, 0.2, 12]} />
            <Toon color={ART_STYLE.palette.rust} />
          </mesh>
        ))}
      </group>

      {/* Stacked Wreck 2: Compacted Oxidized Red Vehicle Stacked Above Wreck 1 */}
      <group position={[-20.7, FLOOR_Y + 2.5, 6.2]} rotation={[-0.08, -0.15, 0.12]}>
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
      <group position={[-5, FLOOR_Y, -17]}>
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
            {/* Local Cutting Glow (Astra Round 9: #FFAA36, range 5.8m, intensity 65) */}
            <pointLight position={[0, -0.35, 0]} intensity={8} distance={3.0} color="#ffaa36" />

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


      </group>

      {/* ========================================================================= */}
      {/* STATIC SALVAGE DRESSING (D6 SPEC: CAR ROWS, BLOCK CLUSTERS, DEBRIS CHIPS)  */}
      {/* ========================================================================= */}
      <YardDressing />

      {/* ========================================================================= */}
      {/* 20FT INDUSTRIAL INTERMODAL SHIPPING CONTAINERS (TEARDOWN YARD SIGNATURE) */}
      {/* ========================================================================= */}
      {/* Container Stack 1: Northwest Perimeter - 2-Tier Stack (Teal Base / Safety Orange Top) */}
      <ShippingContainer position={[-21, FLOOR_Y + 2.26, -11.0]} color={ART_STYLE.palette.teal} />
      <ShippingContainer position={[-21, FLOOR_Y + 4.82, -11.0]} color={ART_STYLE.palette.signalOrange} />

      {/* Container Stack 2: East Perimeter - Heavy Oxidized Rust Container Angled */}
      <ShippingContainer position={[22, FLOOR_Y + 1.26, -7.5]} rotation={[0, 0.28, 0]} color={ART_STYLE.palette.rust} />

      {/* Container Stack 3: Southwest Perimeter - Weathered Industrial Concrete Container */}
      <ShippingContainer position={[-21, FLOOR_Y + 1.26, 19]} rotation={[0, -0.22, 0]} color={ART_STYLE.palette.concreteLit} />

      {/* Container Stack 4: Southeast Perimeter - Heavy Mustard Salvage Container */}
      <ShippingContainer position={[21.5, FLOOR_Y + 1.26, 15.0]} rotation={[0, 0.14, 0]} color={ART_STYLE.palette.mustard} />

      {/* ========================================================================= */}
      {/* SECTOR A DRESSING: COMPACTED SCRAP BALES                                  */}
      {/* ========================================================================= */}
      <ScrapMetalBales position={BALES_ORIGIN} />

      {/* ========================================================================= */}
      {/* SECTOR C: OPEN GRAVITY BALL HOPPER & ROLLER CHUTE [-12, FLOOR_Y + 2.5, 12] */}
      {/* ========================================================================= */}
      <GravityHopper position={[-12, FLOOR_Y + 2.5, 12]} />

      {/* ========================================================================= */}
      {/* SECTOR D: VEHICLE TEST STAGING SLAB & PAD [12, FLOOR_Y + 0.02, 12]        */}
      {/* ========================================================================= */}
      <group position={[12, FLOOR_Y + 0.02, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[5.2, 0.04, 7.2]} />
          <Toon color={ART_STYLE.palette.concreteShade} />
        </mesh>
        {/* Yellow Chevron Staging Pad Border Stripes */}
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[5.0, 0.25]} />
          <Toon color={ART_STYLE.palette.mustard} />
        </mesh>
      </group>
      {/* Scrap Tire Buffer Wall flanking vehicle staging pad */}
      <ScrapTireBarrier position={[20, FLOOR_Y, 8.0]} />
      <ScrapTireBarrier position={[20, FLOOR_Y, 19.0]} />

      {/* ========================================================================= */}
      {/* TEARDOWN WATER BASIN: Translucent Crystal Tank & Luminous Turquoise Water */}
      {/* ========================================================================= */}
      <mesh geometry={TANK_WALL_GEOMETRY} raycast={noRaycast}>
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.16} roughness={0.25} metalness={0.1} depthWrite={false} />
      </mesh>
      <mesh geometry={TANK_RIM_GEOMETRY} castShadow receiveShadow raycast={noRaycast}>
        <Toon color={ART_STYLE.palette.concreteShade} />
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
