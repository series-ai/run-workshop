import * as THREE from 'three';
import type { WaterTankSpec } from 'voxel-kit';
import { FLOOR_Y, TANK, TANK_SPEC } from '../sim/constants';
import { WaterCaustics, WaterSurface } from './Water';

const noRaycast = () => null;
const tuple3 = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

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

export function YardShell() {
  const waterLayout = computeWaterVisualLayout(TANK_SPEC);

  return (
    <>
      {/* Classic Warm Salvage Yard Atmosphere & Depth Fog */}
      <color attach="background" args={['#666056']} />
      <fog attach="fog" args={['#666056', 15, 42]} />

      {/* Warm Sunlight & Salvage Floodlighting */}
      <ambientLight intensity={0.25} color="#cfd7e0" />
      <directionalLight
        position={[14, 18, 10]}
        intensity={2.65}
        color="#ffe9c9"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-far={60}
        shadow-bias={-0.00018}
      />
      {/* Warm tungsten salvage floodlights */}
      <pointLight position={[2.7, 3.8, 0.3]} intensity={14} distance={18} color="#ffd79c" />
      <pointLight position={[-4.4, 3.5, -3.7]} intensity={7.5} distance={20} color="#bfd4ff" />
      <spotLight
        position={[8.8, 7.5, -4.8]}
        angle={0.48}
        penumbra={0.6}
        intensity={14}
        distance={25}
        color="#ffe2b8"
      />

      {/* Main Yard Floor: 52m x 52m Warm Weathered Concrete */}
      <mesh position={[0, FLOOR_Y - 0.1, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 0.2, 52]} />
        <meshStandardMaterial color="#777167" roughness={0.95} metalness={0.04} />
      </mesh>

      {/* Subtle Concrete Slab Grid Lines */}
      <gridHelper args={[52, 26, '#5e584d', '#6d675b']} position={[0, FLOOR_Y + 0.005, 0]} />

      {/* Weathered Warehouse Perimeter Walls */}
      <mesh position={[-26, 2.5, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 7, 52]} />
        <meshStandardMaterial color="#3e433f" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[26, 2.5, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 7, 52]} />
        <meshStandardMaterial color="#3e433f" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[0, 2.5, -26]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 7, 0.8]} />
        <meshStandardMaterial color="#48463f" roughness={0.82} metalness={0.14} />
      </mesh>
      <mesh position={[0, 2.5, 26]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 7, 0.8]} />
        <meshStandardMaterial color="#48463f" roughness={0.82} metalness={0.14} />
      </mesh>

      {/* Rusted Wall Coping Cap Rails */}
      <mesh position={[-26, 6.05, 0]} castShadow raycast={noRaycast}>
        <boxGeometry args={[1.0, 0.15, 52]} />
        <meshStandardMaterial color="#8d7148" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[26, 6.05, 0]} castShadow raycast={noRaycast}>
        <boxGeometry args={[1.0, 0.15, 52]} />
        <meshStandardMaterial color="#8d7148" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, 6.05, -26]} castShadow raycast={noRaycast}>
        <boxGeometry args={[52, 0.15, 1.0]} />
        <meshStandardMaterial color="#8d7148" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[0, 6.05, 26]} castShadow raycast={noRaycast}>
        <boxGeometry args={[52, 0.15, 1.0]} />
        <meshStandardMaterial color="#8d7148" roughness={0.65} metalness={0.25} />
      </mesh>

      {/* Authentic Original Concrete Platforms & Steps */}
      <mesh position={[1.0, FLOOR_Y + 0.24, 0.9]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[3.1, 0.48, 3.8]} />
        <meshStandardMaterial color="#66655d" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh position={[-2.35, FLOOR_Y + 0.2, -1.4]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[2.3, 0.4, 2.3]} />
        <meshStandardMaterial color="#5e5a52" roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Original Rusted Timber & Steel Gantry Crane Framing */}
      <mesh position={[-2.1, 1.55, -2.3]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[2.8, 0.16, 0.16]} />
        <meshStandardMaterial color="#8d7148" roughness={0.65} metalness={0.18} />
      </mesh>
      <mesh position={[-2.1, 2.4, -2.3]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.14, 1.85, 0.14]} />
        <meshStandardMaterial color="#8d7148" roughness={0.68} metalness={0.18} />
      </mesh>
      <mesh position={[-0.7, 2.4, -2.3]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.14, 1.85, 0.14]} />
        <meshStandardMaterial color="#8d7148" roughness={0.68} metalness={0.18} />
      </mesh>

      {/* Overhead Salvage Crane Runway Girder & Support Columns */}
      <mesh position={[1.8, 3.05, -1.2]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[8.2, 0.18, 0.24]} />
        <meshStandardMaterial color="#706a60" roughness={0.82} metalness={0.22} />
      </mesh>
      <mesh position={[3.7, 2.28, -1.2]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.24, 1.75, 0.24]} />
        <meshStandardMaterial color="#706a60" roughness={0.82} metalness={0.22} />
      </mesh>
      <mesh position={[0.05, 2.28, -1.2]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.24, 1.75, 0.24]} />
        <meshStandardMaterial color="#706a60" roughness={0.82} metalness={0.22} />
      </mesh>

      {/* Yard Floodlight Work Post & Glowing Glass Diffuser */}
      <mesh position={[5.4, 1.15, 3.15]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.86, 1.12, 0.86]} />
        <meshStandardMaterial color="#776c5d" roughness={0.88} metalness={0.12} />
      </mesh>
      <mesh position={[5.55, 2.15, 3.15]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.16, 0.74, 0.16]} />
        <meshStandardMaterial color="#7b6d55" roughness={0.65} metalness={0.16} />
      </mesh>
      <mesh position={[5.22, 2.15, 3.15]} castShadow receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.16, 0.74, 0.16]} />
        <meshStandardMaterial color="#7b6d55" roughness={0.65} metalness={0.16} />
      </mesh>
      <mesh position={[5.38, 1.92, 3.16]} raycast={noRaycast}>
        <planeGeometry args={[0.68, 0.92]} />
        <meshBasicMaterial color="#ffe3af" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>

      {/* Sector B: Seesaw Heavy Cast-Iron Fulcrum Stand [-8, FLOOR_Y + 0.45, -6] */}
      <group position={[-8, FLOOR_Y + 0.45, -6]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.2, 0.9, 1.2]} />
          <meshStandardMaterial color="#3e433f" roughness={0.75} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.16, 0.16, 1.4, 16]} />
          <meshStandardMaterial color="#8d7148" roughness={0.4} metalness={0.7} />
        </mesh>
      </group>

      {/* Sector C: Ball Drop Hopper Scaffolding [-12, FLOOR_Y + 2.5, 12] */}
      <group position={[-12, FLOOR_Y + 2.5, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4, 5.0, 4]} />
          <meshStandardMaterial color="#5e5a52" roughness={0.85} metalness={0.18} />
        </mesh>
        {/* Weathered Steel Railing */}
        <mesh position={[0, 2.7, 1.9]} castShadow raycast={noRaycast}>
          <boxGeometry args={[3.8, 0.4, 0.1]} />
          <meshStandardMaterial color="#8d7148" roughness={0.5} metalness={0.6} />
        </mesh>
      </group>

      {/* Sector D: Vehicle Ramp & Test Pad [12, FLOOR_Y + 0.4, 12] */}
      <group position={[12, FLOOR_Y + 0.4, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4, 0.8, 6]} />
          <meshStandardMaterial color="#66655d" roughness={0.9} metalness={0.1} />
        </mesh>
      </group>

      {/* Spawn Markers (Industrial Floor Insets) */}
      {[
        { pos: [-2, FLOOR_Y + 0.01, 4], color: '#9bbc0f' },
        { pos: [2, FLOOR_Y + 0.01, 4], color: '#eab308' },
        { pos: [-2, FLOOR_Y + 0.01, 8], color: '#38bdf8' },
        { pos: [2, FLOOR_Y + 0.01, 8], color: '#f43f5e' },
      ].map((pad, idx) => (
        <group key={idx} position={pad.pos as [number, number, number]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={noRaycast}>
            <ringGeometry args={[0.7, 0.85, 32]} />
            <meshBasicMaterial color={pad.color} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

      {/* Authentic Salvage Water Tank: Clear Glass & Emerald Salvage Pool */}
      <mesh position={[TANK.center[0], waterLayout.tankCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={[TANK.innerSize[0] + TANK.wallThickness * 2, waterLayout.tankHeight, TANK.innerSize[2] + TANK.wallThickness * 2]} />
        <meshPhysicalMaterial color="#d4ddd8" transparent opacity={0.14} roughness={0.06} metalness={0} transmission={0.34} thickness={0.2} />
      </mesh>
      <mesh position={[TANK.center[0], waterLayout.fillCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={waterLayout.fillSize} />
        <meshPhysicalMaterial color="#447d6f" transparent opacity={0.25} roughness={0.14} metalness={0.02} depthWrite={false} />
      </mesh>
      <WaterCaustics position={tuple3(TANK.center[0], TANK.bottomY + 0.018, TANK.center[2])} size={waterLayout.surfaceSize} />
      <WaterSurface position={tuple3(TANK.center[0], waterLayout.surfaceY, TANK.center[2])} size={waterLayout.surfaceSize} />
    </>
  );
}
