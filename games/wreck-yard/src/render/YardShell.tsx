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
      <color attach="background" args={['#242a30']} />
      <fog attach="fog" args={['#242a30', 22, 54]} />

      <ambientLight intensity={0.35} color="#94a3b8" />
      <directionalLight
        position={[18, 26, 12]}
        intensity={2.8}
        color="#fef08a"
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
      <pointLight position={[0, 8, 0]} intensity={12} distance={30} color="#38bdf8" />
      <pointLight position={[-12, 6, 12]} intensity={9} distance={20} color="#f59e0b" />
      <pointLight position={[12, 6, 12]} intensity={9} distance={20} color="#10b981" />

      {/* Main Arena Floor: 52m x 52m */}
      <mesh position={[0, FLOOR_Y - 0.1, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 0.2, 52]} />
        <meshStandardMaterial color="#334155" roughness={0.88} metalness={0.12} />
      </mesh>

      {/* Floor Grid Accents */}
      <gridHelper args={[52, 52, '#475569', '#1e293b']} position={[0, FLOOR_Y + 0.005, 0]} />

      {/* Perimeter Walls: West, East, North, South */}
      <mesh position={[-26, 3.0, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 8, 52]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.2} />
      </mesh>
      <mesh position={[26, 3.0, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 8, 52]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.0, -26]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 8, 0.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.2} />
      </mesh>
      <mesh position={[0, 3.0, 26]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 8, 0.8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Sector B: Seesaw Fulcrum Stand [-8, FLOOR_Y + 0.45, -6] */}
      <group position={[-8, FLOOR_Y + 0.45, -6]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.2, 0.9, 1.2]} />
          <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.16, 0.16, 1.4, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* Sector C: Ball Drop Hopper Scaffolding [-12, FLOOR_Y + 2.5, 12] */}
      <group position={[-12, FLOOR_Y + 2.5, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4, 5.0, 4]} />
          <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.3} />
        </mesh>
        {/* Guard Rails */}
        <mesh position={[0, 2.7, 1.9]} castShadow raycast={noRaycast}>
          <boxGeometry args={[3.8, 0.4, 0.1]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} metalness={0.7} />
        </mesh>
      </group>

      {/* Sector D: Vehicle Ramp & Test Pad [12, FLOOR_Y + 0.4, 12] */}
      <group position={[12, FLOOR_Y + 0.4, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4, 0.8, 6]} />
          <meshStandardMaterial color="#475569" roughness={0.85} metalness={0.2} />
        </mesh>
      </group>

      {/* Spawn Pads (Slots 0 to 3) */}
      {[
        { pos: [-2, FLOOR_Y + 0.01, 4], color: '#38bdf8' },
        { pos: [2, FLOOR_Y + 0.01, 4], color: '#f59e0b' },
        { pos: [-2, FLOOR_Y + 0.01, 8], color: '#10b981' },
        { pos: [2, FLOOR_Y + 0.01, 8], color: '#f43f5e' },
      ].map((pad, idx) => (
        <group key={idx} position={pad.pos as [number, number, number]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow raycast={noRaycast}>
            <ringGeometry args={[0.7, 0.85, 32]} />
            <meshBasicMaterial color={pad.color} />
          </mesh>
        </group>
      ))}

      {/* Water Tank */}
      <mesh position={[TANK.center[0], waterLayout.tankCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={[TANK.innerSize[0] + TANK.wallThickness * 2, waterLayout.tankHeight, TANK.innerSize[2] + TANK.wallThickness * 2]} />
        <meshPhysicalMaterial color="#94a3b8" transparent opacity={0.15} roughness={0.06} metalness={0} transmission={0.4} thickness={0.2} />
      </mesh>
      <mesh position={[TANK.center[0], waterLayout.fillCenterY, TANK.center[2]]} raycast={noRaycast}>
        <boxGeometry args={waterLayout.fillSize} />
        <meshPhysicalMaterial color="#0284c7" transparent opacity={0.3} roughness={0.14} metalness={0.02} depthWrite={false} />
      </mesh>
      <WaterCaustics position={tuple3(TANK.center[0], TANK.bottomY + 0.018, TANK.center[2])} size={waterLayout.surfaceSize} />
      <WaterSurface position={tuple3(TANK.center[0], waterLayout.surfaceY, TANK.center[2])} size={waterLayout.surfaceSize} />
    </>
  );
}
