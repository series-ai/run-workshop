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
      <color attach="background" args={['#666056']} />
      <fog attach="fog" args={['#666056', 10.5, 21]} />

      <ambientLight intensity={0.22} color="#cfd7e0" />
      <directionalLight
        position={[8.5, 10, 4.6]}
        intensity={2.55}
        color="#ffe9c9"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-far={22}
        shadow-bias={-0.00018}
      />
      <pointLight position={[2.7, 3.3, 0.3]} intensity={13.5} distance={9} color="#ffd79c" />
      <pointLight position={[-2.4, 2.7, -1.7]} intensity={5.8} distance={10} color="#bfd4ff" />
      <spotLight
        position={[5.8, 4.7, -2.8]}
        angle={0.42}
        penumbra={0.55}
        intensity={11}
        distance={15}
        color="#ffe2b8"
      />

      <mesh position={[0, FLOOR_Y - 0.1, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[18, 0.2, 18]} />
        <meshStandardMaterial color="#777167" roughness={0.95} metalness={0.04} />
      </mesh>
      <mesh position={[-4.55, 1.25, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.7, 4.4, 18]} />
        <meshStandardMaterial color="#3e433f" roughness={0.82} metalness={0.18} />
      </mesh>
      <mesh position={[0, 1.25, -4.55]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[18, 4.4, 0.7]} />
        <meshStandardMaterial color="#48463f" roughness={0.82} metalness={0.14} />
      </mesh>
      <mesh position={[1.0, FLOOR_Y + 0.24, 0.9]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[3.1, 0.48, 3.8]} />
        <meshStandardMaterial color="#66655d" roughness={0.9} metalness={0.08} />
      </mesh>
      <mesh position={[-2.35, FLOOR_Y + 0.2, -1.4]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[2.3, 0.4, 2.3]} />
        <meshStandardMaterial color="#5e5a52" roughness={0.92} metalness={0.05} />
      </mesh>
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
        <meshBasicMaterial color="#ffe3af" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[TANK.center[0], waterLayout.tankCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={[TANK.innerSize[0] + TANK.wallThickness * 2, waterLayout.tankHeight, TANK.innerSize[2] + TANK.wallThickness * 2]} />
        <meshPhysicalMaterial color="#d4ddd8" transparent opacity={0.13} roughness={0.06} metalness={0} transmission={0.34} thickness={0.2} />
      </mesh>
      <mesh position={[TANK.center[0], waterLayout.fillCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={waterLayout.fillSize} />
        <meshPhysicalMaterial color="#447d6f" transparent opacity={0.24} roughness={0.14} metalness={0.02} depthWrite={false} />
      </mesh>
      <WaterCaustics position={tuple3(TANK.center[0], TANK.bottomY + 0.018, TANK.center[2])} size={waterLayout.surfaceSize} />
      <WaterSurface position={tuple3(TANK.center[0], waterLayout.surfaceY, TANK.center[2])} size={waterLayout.surfaceSize} />
    </>
  );
}
