import type { WaterTankSpec } from 'voxel-kit';
import { FLOOR_Y, TANK, TANK_SPEC } from '../sim/constants';
import { SkyDome } from './SkyDome';
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
      {/* Teardown Dynamic Golden Hour Sky Dome */}
      <SkyDome />

      {/* Atmospheric Depth Fog */}
      <fog attach="fog" args={['#1c1917', 26, 76]} />

      {/* Dramatic Golden Hour Sun & Shadows */}
      <ambientLight intensity={0.42} color="#94a3b8" />
      <directionalLight
        position={[16, 24, 12]}
        intensity={3.4}
        color="#ffe8cc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-far={65}
        shadow-bias={-0.00016}
      />

      {/* High-Mast Yard Floodlight 1 (West Tower) */}
      <spotLight
        position={[-21, 14, -21]}
        target-position={[0, 0, 0]}
        intensity={24}
        distance={45}
        angle={0.65}
        penumbra={0.7}
        color="#fef3c7"
      />
      {/* High-Mast Yard Floodlight 2 (East Tower) */}
      <spotLight
        position={[21, 14, 21]}
        target-position={[0, 0, 0]}
        intensity={22}
        distance={45}
        angle={0.65}
        penumbra={0.7}
        color="#fef3c7"
      />

      {/* Warm Fill / Secondary Bounce */}
      <pointLight position={[0, 6, 0]} intensity={14} distance={28} color="#fed7aa" />

      {/* ========================================================================= */}
      {/* DEMOLITION YARD FLOOR: 52m x 52m Layered Weathered Heavy Asphalt & Paving */}
      {/* ========================================================================= */}
      <mesh position={[0, FLOOR_Y - 0.1, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[52, 0.2, 52]} />
        <meshStandardMaterial color="#202226" roughness={0.88} metalness={0.12} />
      </mesh>

      {/* Central Heavy Concrete Slab with Expansion Joints */}
      <mesh position={[0, FLOOR_Y - 0.08, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[32, 0.2, 32]} />
        <meshStandardMaterial color="#30333a" roughness={0.92} metalness={0.06} />
      </mesh>

      {/* Wet Reflective Rain Puddles (Teardown Wet Sheen Benchmark) */}
      {[
        { pos: [-4, FLOOR_Y + 0.008, 2], size: [4.2, 2.8], rot: 0.2 },
        { pos: [7, FLOOR_Y + 0.008, -6], size: [5.5, 3.2], rot: -0.4 },
        { pos: [-10, FLOOR_Y + 0.008, -8], size: [3.8, 2.6], rot: 0.6 },
        { pos: [3, FLOOR_Y + 0.008, 9], size: [4.8, 2.4], rot: 0.1 },
      ].map((puddle, idx) => (
        <mesh
          key={`puddle-${idx}`}
          position={[puddle.pos[0], puddle.pos[1], puddle.pos[2]]}
          rotation={[-Math.PI / 2, 0, puddle.rot]}
          receiveShadow
          raycast={noRaycast}
        >
          <planeGeometry args={[puddle.size[0], puddle.size[1]]} />
          <meshStandardMaterial
            color="#141820"
            roughness={0.06}
            metalness={0.3}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Steel Trench Drain Grates Across Center Yard */}
      <mesh position={[0, FLOOR_Y + 0.006, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 0.015, 32]} />
        <meshStandardMaterial color="#1e242b" roughness={0.4} metalness={0.85} />
      </mesh>
      <mesh position={[0, FLOOR_Y + 0.006, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow raycast={noRaycast}>
        <boxGeometry args={[0.8, 0.015, 32]} />
        <meshStandardMaterial color="#1e242b" roughness={0.4} metalness={0.85} />
      </mesh>

      {/* ========================================================================= */}
      {/* CORRUGATED INDUSTRIAL WAREHOUSE WALLS & STEEL STRUCTURAL I-BEAMS          */}
      {/* ========================================================================= */}
      {/* North, South, East, West Corrugated Siding Panels */}
      {[
        { pos: [-26, 3.2, 0], rot: 0, size: [0.6, 7.5, 52] },
        { pos: [26, 3.2, 0], rot: 0, size: [0.6, 7.5, 52] },
        { pos: [0, 3.2, -26], rot: Math.PI / 2, size: [0.6, 7.5, 52] },
        { pos: [0, 3.2, 26], rot: Math.PI / 2, size: [0.6, 7.5, 52] },
      ].map((wall, idx) => (
        <group key={`wall-${idx}`} position={wall.pos as [number, number, number]} rotation={[0, wall.rot, 0]}>
          {/* Main Wall Panel */}
          <mesh receiveShadow castShadow raycast={noRaycast}>
            <boxGeometry args={wall.size as [number, number, number]} />
            <meshStandardMaterial color="#1f242d" roughness={0.75} metalness={0.35} />
          </mesh>
          {/* Concrete Footing Base */}
          <mesh position={[0, -3.2, 0]} receiveShadow raycast={noRaycast}>
            <boxGeometry args={[1.2, 1.2, 52]} />
            <meshStandardMaterial color="#374151" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Heavy Steel Top Cap Rail */}
          <mesh position={[0, 3.8, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[1.0, 0.3, 52]} />
            <meshStandardMaterial color="#111827" roughness={0.5} metalness={0.8} />
          </mesh>
          {/* Yellow Hazard Baseboard Stripes */}
          <mesh position={[0.31, -2.4, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.02, 0.4, 52]} />
            <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Structural Steel I-Beam Columns Spaced Around Perimeter */}
      {[-20, -12, -4, 4, 12, 20].map((coord, idx) => (
        <group key={`col-${idx}`}>
          <mesh position={[-25.6, 3.2, coord]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.7, 7.5, 0.45]} />
            <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.85} />
          </mesh>
          <mesh position={[25.6, 3.2, coord]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.7, 7.5, 0.45]} />
            <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.85} />
          </mesh>
          <mesh position={[coord, 3.2, -25.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.45, 7.5, 0.7]} />
            <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.85} />
          </mesh>
          <mesh position={[coord, 3.2, 25.6]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.45, 7.5, 0.7]} />
            <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.85} />
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
            <meshStandardMaterial color="#4b5563" roughness={0.9} metalness={0.1} />
          </mesh>
          {/* Steel Lattice Mast (14m Tall) */}
          <mesh position={[0, FLOOR_Y + 7.5, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[0.55, 13, 0.55]} />
            <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.85} />
          </mesh>
          {/* Headframe Platform */}
          <mesh position={[0, FLOOR_Y + 14.1, 0]} castShadow raycast={noRaycast}>
            <boxGeometry args={[2.4, 0.3, 1.2]} />
            <meshStandardMaterial color="#111827" roughness={0.3} metalness={0.9} />
          </mesh>
          {/* Glowing Floodlight Cluster Lenses */}
          {[-0.8, -0.25, 0.25, 0.8].map((lx, lidx) => (
            <group key={`lamp-${lidx}`} position={[lx, FLOOR_Y + 14.3, 0.4]}>
              <mesh rotation={[0.4, 0, 0]} raycast={noRaycast}>
                <boxGeometry args={[0.45, 0.35, 0.25]} />
                <meshStandardMaterial color="#374151" metalness={0.8} />
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
          <meshStandardMaterial color="#991b1b" roughness={0.7} metalness={0.4} />
        </mesh>
        {/* Door Frame & Corner Posts */}
        <mesh position={[0, 0, 3.01]} raycast={noRaycast}>
          <planeGeometry args={[2.3, 2.5]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.8} metalness={0.3} />
        </mesh>
        {/* White Stenciled Hazard Placard */}
        <mesh position={[1.21, 0.4, 0.5]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
        </mesh>
      </group>

      {/* ISO Shipping Container 2: Maritime Blue [15, FLOOR_Y + 1.3, -15] */}
      <group position={[15, FLOOR_Y + 1.3, -15]} rotation={[0, -0.3, 0]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[2.4, 2.6, 6.0]} />
          <meshStandardMaterial color="#0369a1" roughness={0.65} metalness={0.45} />
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
          <meshStandardMaterial color="#78350f" roughness={0.9} metalness={0.05} />
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
          <meshStandardMaterial color={drum.color} roughness={0.45} metalness={0.7} />
        </mesh>
      ))}

      {/* Concrete Highway Jersey Barriers with Yellow Safety Stripes */}
      {[
        { pos: [10, FLOOR_Y + 0.45, 8.5], rot: 0 },
        { pos: [10, FLOOR_Y + 0.45, 15.5], rot: 0 },
        { pos: [-8, FLOOR_Y + 0.45, TANK.center[2] - 4], rot: Math.PI / 2 },
      ].map((barrier, idx) => (
        <group key={`barrier-${idx}`} position={barrier.pos as [number, number, number]} rotation={[0, barrier.rot, 0]}>
          <mesh castShadow receiveShadow raycast={noRaycast}>
            <boxGeometry args={[0.6, 0.9, 3.2]} />
            <meshStandardMaterial color="#64748b" roughness={0.88} metalness={0.1} />
          </mesh>
          <mesh position={[0.31, 0, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.02, 0.2, 3.0]} />
            <meshStandardMaterial color="#facc15" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* Heavy Overhead Industrial Crane Gantry Spanning Center Runway */}
      <group position={[0, FLOOR_Y + 8.5, 0]}>
        {/* Main Double Crane Bridge Girders */}
        <mesh position={[0, 0, -1.2]} castShadow raycast={noRaycast}>
          <boxGeometry args={[28, 0.85, 0.4]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.65} />
        </mesh>
        <mesh position={[0, 0, 1.2]} castShadow raycast={noRaycast}>
          <boxGeometry args={[28, 0.85, 0.4]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} metalness={0.65} />
        </mesh>
        {/* Gantry Hoist Trolley & Hook */}
        <mesh position={[3, -0.3, 0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[2.2, 0.6, 2.8]} />
          <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.85} />
        </mesh>
        <mesh position={[3, -2.5, 0]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.04, 0.04, 4.0, 8]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* SECTOR B: SEESAW FULCRUM STAND [-8, FLOOR_Y + 0.45, -6]                   */}
      {/* ========================================================================= */}
      <group position={[-8, FLOOR_Y + 0.45, -6]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[1.4, 0.9, 1.4]} />
          <meshStandardMaterial color="#374151" roughness={0.6} metalness={0.7} />
        </mesh>
        {/* Heavy Greased Steel Pivot Axle */}
        <mesh position={[0, 0.46, 0]} rotation={[0, 0, Math.PI / 2]} castShadow raycast={noRaycast}>
          <cylinderGeometry args={[0.18, 0.18, 1.6, 16]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.25} metalness={0.95} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* SECTOR C: BALL DROP HOPPER SCAFFOLDING [-12, FLOOR_Y + 2.5, 12]           */}
      {/* ========================================================================= */}
      <group position={[-12, FLOOR_Y + 2.5, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4.2, 5.0, 4.2]} />
          <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.75} />
        </mesh>
        {/* Industrial Steel Pipe Railings */}
        <mesh position={[0, 2.7, 2.0]} castShadow raycast={noRaycast}>
          <boxGeometry args={[4.0, 0.45, 0.12]} />
          <meshStandardMaterial color="#eab308" roughness={0.4} metalness={0.6} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* SECTOR D: VEHICLE TEST RAMP & PAD [12, FLOOR_Y + 0.4, 12]                 */}
      {/* ========================================================================= */}
      <group position={[12, FLOOR_Y + 0.4, 12]}>
        <mesh castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[4.4, 0.8, 6.4]} />
          <meshStandardMaterial color="#475569" roughness={0.88} metalness={0.15} />
        </mesh>
        {/* Yellow Chevron Ramp Edge Stripes */}
        <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <planeGeometry args={[4.2, 0.3]} />
          <meshStandardMaterial color="#eab308" roughness={0.5} />
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
        <meshStandardMaterial color="#374151" roughness={0.85} metalness={0.15} />
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
