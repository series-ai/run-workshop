import { ART_STYLE, deriveLightRig, YARD_LIGHTING } from "./style/artStyle";
import { Toon } from "./style/toonMaterial";
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WaterTankSpec } from 'voxel-kit';
import { FLOOR_Y, getTerrainHeightAt, TANK, TANK_SPEC, TERRAIN_COLS, TERRAIN_ROWS, TERRAIN_SPACING } from '../sim/constants';
import { SHELL_BOXES } from '../sim/shell';
import { openTankFrameBoxes, RIG, RIG_TORCH_Y, TANK_RIM, VEHICLE_RAMP } from '../sim/setPieces';
import { rigBeamTop } from '../sim/props';
import { RAMP_PARTS } from './rampParts';
import { SkyDome } from './SkyDome';
import { Skyline } from './Skyline';
import { AtmosphereDust } from './AtmosphereDust';
import { WaterCaustics, WaterSurface } from './Water';
import { isMobileDevice } from './DynamicDpr';
import type { YardRender } from './presentation';
import { FloodlightMasts, yardLightLevel } from './Floodlights';
import { brokenLampIds } from '../sim/floodlights';
import { useReducedMotionRef } from './reducedMotion';

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

const AQUARIUM_BASE_HEIGHT = 0.18;
function aquariumGlassGeometry() {
  const clearance = 0.004;
  const bottom = TANK.bottomY + AQUARIUM_BASE_HEIGHT + clearance;
  const height = TANK.surfaceY - bottom;
  const parts = openTankFrameBoxes(TANK.innerSize[0], TANK.innerSize[2], TANK.wallThickness, height).map(({ center, size }) => {
    // Keep each glass panel between the posts and above the lower rail.
    const panelSize: [number, number, number] = center[2] !== 0
      ? [TANK.innerSize[0] - clearance * 2, height, size[2]]
      : [size[0], height, TANK.innerSize[2] - clearance * 2];
    const panel = new THREE.BoxGeometry(...panelSize);
    panel.translate(TANK.center[0] + center[0], bottom + height / 2, TANK.center[2] + center[2]);
    return panel;
  });
  const geometry = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}
const TANK_WALL_GEOMETRY = aquariumGlassGeometry();
const TANK_RIM_GEOMETRY = tankFrameGeometry(TANK_RIM.thickness, TANK_RIM.height, TANK_RIM.centerY);
const TANK_FLOOR_BOX = (() => {
  const floor = SHELL_BOXES.find((box) => box.id === 'tank-floor');
  if (!floor) throw new Error('WRECK_YARD_TANK_FLOOR_MISSING');
  return floor;
})();

/** Solid lower rail and corner posts, inside the existing tank walls. */
function aquariumFrameGeometry() {
  const baseHeight = AQUARIUM_BASE_HEIGHT;
  const parts = [tankFrameGeometry(TANK.wallThickness, baseHeight, TANK.bottomY + baseHeight / 2)];
  const height = TANK.surfaceY - TANK.bottomY;
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const post = new THREE.BoxGeometry(TANK.wallThickness, height, TANK.wallThickness);
      post.translate(
        TANK.center[0] + sideX * (TANK.innerSize[0] + TANK.wallThickness) / 2,
        (TANK.surfaceY + TANK.bottomY) / 2,
        TANK.center[2] + sideZ * (TANK.innerSize[2] + TANK.wallThickness) / 2,
      );
      parts.push(post);
    }
  }
  const geometry = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  return geometry;
}
const AQUARIUM_FRAME_GEOMETRY = aquariumFrameGeometry();


/** Sparks per torch. Each one leaves the flame tip, arcs out, and lands on the floor. */
const SPARK_COUNT = 180;
/** Spark launches per second. Phases spread the sparks across the cycle. */
const SPARK_RATE = 1.6;
/** Each spark rises this far above its launch point before it falls (m). */
const SPARK_ARC = 0.32;
/** Sparks launch this far above the top of the work beam (m). */
const SPARK_CLEAR_OF_BEAM = 0.05;
/** Torch-local floor height. The torch sits RIG_TORCH_Y above the floor. */
const SPARK_FLOOR_Y = -0.69;

function CuttingRigSparks() {
  // Users who ask for less motion see the spray frozen at its start phase. The flag follows the system setting.
  const reducedMotion = useReducedMotionRef();
  const frozen = useRef(false);
  const { geom, positionAttr, colorAttr, seeds, baseColors, startY } = useMemo(() => {
    // Torch-local launch height: just above the top of the work beam.
    const startY = rigBeamTop() - (RIG[1] + RIG_TORCH_Y) + SPARK_CLEAR_OF_BEAM;
    const positions = new Float32Array(SPARK_COUNT * 3);
    const baseColors = new Float32Array(SPARK_COUNT * 3);
    // Per spark: launch angle, landing reach, and phase. The golden ratio spreads them evenly.
    const seeds = new Float32Array(SPARK_COUNT * 3);
    const cGlow = new THREE.Color(ART_STYLE.palette.glow);
    const cSpark = new THREE.Color(ART_STYLE.palette.spark);

    for (let i = 0; i < SPARK_COUNT; i++) {
      seeds[i * 3] = i * 2.39996;
      seeds[i * 3 + 1] = 0.25 + 0.7 * ((i * 0.618034) % 1);
      seeds[i * 3 + 2] = (i * 0.754877) % 1;
      positions[i * 3 + 1] = startY;

      const col = i % 3 === 0 ? cSpark : cGlow;
      baseColors[i * 3] = col.r;
      baseColors[i * 3 + 1] = col.g;
      baseColors[i * 3 + 2] = col.b;
    }

    const positionAttr = new THREE.BufferAttribute(positions, 3);
    const colorAttr = new THREE.BufferAttribute(new Float32Array(baseColors), 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', positionAttr);
    g.setAttribute('color', colorAttr);
    return { geom: g, positionAttr, colorAttr, seeds, baseColors, startY };
  }, []);

  const writeSparks = (time: number) => {
    for (let i = 0; i < SPARK_COUNT; i++) {
      const life = (time * SPARK_RATE + seeds[i * 3 + 2]!) % 1;
      const angle = seeds[i * 3]!;
      const reach = seeds[i * 3 + 1]! * life;
      // Each spark rises, then falls under gravity to the floor.
      const height = startY + SPARK_ARC * 4 * life * (1 - life) - (startY - SPARK_FLOOR_Y) * life * life;
      positionAttr.setXYZ(i, Math.cos(angle) * reach, height, Math.sin(angle) * reach);
      // Sparks fade to black as they cool. Additive blending makes black invisible.
      const cool = 1 - life;
      colorAttr.setXYZ(i, baseColors[i * 3]! * cool, baseColors[i * 3 + 1]! * cool, baseColors[i * 3 + 2]! * cool);
    }
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  };

  useFrame(({ clock }) => {
    if (reducedMotion.current) {
      // The frozen spray is written once. Further frames would write the same values.
      if (frozen.current) return;
      writeSparks(0);
      frozen.current = true;
      return;
    }
    frozen.current = false;
    // Read the clock without advancing it. R3F advances it once per frame.
    writeSparks(clock.elapsedTime);
  });

  return (
    <points geometry={geom} raycast={noRaycast} frustumCulled={false}>
      <pointsMaterial
        size={0.06}
        vertexColors
        toneMapped={false}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** Pilaster offsets along each wall (m). */
const WALL_PILASTERS = Array.from({ length: 13 }, (_, i) => -24 + i * 4);
/**
 * The cap band is the only top surface of a wall: it sits WALL_CAP_LIFT above
 * the wall box and runs a little past its ends, so no two faces share a plane
 * (coplanar faces z-fight). The pilasters stop under the cap.
 */
const WALL_CAP = { height: 0.3, width: 0.7, lift: 0.03, overhang: 0.05 } as const;
const wallTrimCache = new Map<string, THREE.BufferGeometry>();

/** One merged mesh per wall size: pilasters and a panel line on the local +x face. */
function wallTrimGeometry(size: readonly [number, number, number]): THREE.BufferGeometry {
  const key = size.join(',');
  const cached = wallTrimCache.get(key);
  if (cached) return cached;
  // Pilasters protrude 7 cm, within the wall collider's contact margin, and end at the cap's underside.
  const pilasterHeight = size[1] - WALL_CAP.height + WALL_CAP.lift;
  const parts = WALL_PILASTERS.map((z) => new THREE.BoxGeometry(0.1, pilasterHeight, 0.35).translate(size[0] / 2 + 0.02, (pilasterHeight - size[1]) / 2, z));
  parts.push(new THREE.BoxGeometry(0.04, 0.08, size[2]).translate(size[0] / 2 + 0.02, size[1] * 0.2, 0));
  const merged = BufferGeometryUtils.mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  wallTrimCache.set(key, merged);
  return merged;
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

export function YardShell({ renderRef }: { renderRef?: React.MutableRefObject<YardRender | null> }) {
  const isMobile = isMobileDevice();
  const waterLayout = computeWaterVisualLayout(TANK_SPEC);
  const lightRig = deriveLightRig(ART_STYLE);

  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const skyLightRef = useRef<THREE.HemisphereLight>(null);
  const lightLevel = useRef({ key: 1, sky: 1 });

  // The yard dims as lamps break (Floodlights.tsx yardLightLevel). The change eases in over about half a second.
  useFrame((_, delta) => {
    const render = renderRef?.current;
    const lit = render ? render.contraptions.lamps.length - brokenLampIds(render.contraptions).length : 4;
    const target = yardLightLevel(lit);
    const ease = 1 - Math.exp(-delta * 4);
    const level = lightLevel.current;
    level.key += (target.key - level.key) * ease;
    level.sky += (target.sky - level.sky) * ease;
    if (dirLightRef.current) dirLightRef.current.intensity = Math.PI * 1.05 * level.key;
    if (skyLightRef.current) skyLightRef.current.intensity = Math.PI * 0.5 * level.sky;
  });
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
        ref={skyLightRef}
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

      {SHELL_BOXES.filter((box) => box.id.startsWith('plinth-')).map((box) => (
        <mesh key={box.id} name={box.id} position={[...box.center]} rotation={box.rotation ? [...box.rotation] : undefined} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[...box.size]} />
          <Toon color={ART_STYLE.palette.concreteLit} />
        </mesh>
      ))}

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

      {/* High-mast floodlights at the four corners. A hit can break each lens. */}
      <FloodlightMasts renderRef={renderRef} />

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
          {/* Concrete cap band, the wall's only top surface (see WALL_CAP) */}
          <mesh position={[0, wall.size[1] / 2 + WALL_CAP.lift - WALL_CAP.height / 2, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[WALL_CAP.width, WALL_CAP.height, wall.size[2] + WALL_CAP.overhang * 2]} />
            <Toon color={ART_STYLE.palette.concreteShade} />
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
      {/* HERO DEMOLITION CUTTING RIG & ACTIVE TORCH INCANDESCENCE (ASTRA FOCAL)    */}
      {/* Origin and collider share RIG in sim/setPieces.ts.                        */}
      {/* ========================================================================= */}
      <group position={[...RIG]}>
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
      </group>

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
      {/* ========================================================================= */}
      {/* Open aquarium tank with a solid base and clear side panels. */}
      {/* ========================================================================= */}
      <mesh name="aquarium-base" position={[...TANK_FLOOR_BOX.center]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[...TANK_FLOOR_BOX.size]} />
        <Toon color={ART_STYLE.palette.concreteLit} />
      </mesh>
      <mesh name="aquarium-frame" geometry={AQUARIUM_FRAME_GEOMETRY} castShadow receiveShadow raycast={noRaycast}>
        <Toon color={ART_STYLE.palette.metal} />
      </mesh>
      <mesh name="aquarium-glass" geometry={TANK_WALL_GEOMETRY} raycast={noRaycast}>
        <meshStandardMaterial color="#b8e1de" transparent opacity={0.24} roughness={0.18} metalness={0.05} depthWrite={false} />
      </mesh>
      <mesh name="aquarium-rim" geometry={TANK_RIM_GEOMETRY} castShadow receiveShadow raycast={noRaycast}>
        <Toon color={ART_STYLE.palette.metal} />
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
