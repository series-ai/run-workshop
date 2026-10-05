import React from 'react';
import { useGLTF } from '@react-three/drei';
import { ASSET_PATHS } from '../assetLibrary.js';
import type { LootCrate } from '../sim/game.js';

interface SectorMapProps {
  crates: LootCrate[];
}

export const SectorMap: React.FC<SectorMapProps> = ({ crates }) => {
  return (
    <group>
      {/* Asphalt Depot Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#0d131f" roughness={0.85} metalness={0.2} />
      </mesh>

      {/* Grid line overlays */}
      <gridHelper args={[160, 32, '#1e293b', '#0f172a']} position={[0, 0.01, 0]} />

      {/* Perimeter Boundary Walls */}
      <mesh position={[0, 2, -80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      <mesh position={[0, 2, 80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      <mesh position={[-80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      <mesh position={[80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#172033" />
      </mesh>

      {/* Shipping Containers (Depot Maze & Cover) */}
      <ContainerStack position={[-20, 0, -30]} rotation={[0, 0.3, 0]} color="#0284c7" />
      <ContainerStack position={[-35, 0, -10]} rotation={[0, 1.57, 0]} color="#ea580c" />
      <ContainerStack position={[10, 0, -40]} rotation={[0, 0, 0]} color="#16a34a" />
      <ContainerStack position={[30, 0, -20]} rotation={[0, 0.7, 0]} color="#dc2626" />
      <ContainerStack position={[-15, 0, 15]} rotation={[0, 1.57, 0]} color="#0284c7" />
      <ContainerStack position={[5, 0, 30]} rotation={[0, 0, 0]} color="#ea580c" />
      <ContainerStack position={[-45, 0, 35]} rotation={[0, 0.4, 0]} color="#16a34a" />

      {/* Loot Crates */}
      {crates.map((crate) => (
        <group key={crate.id} position={[crate.x, 0.4, crate.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 1.2]} />
            <meshStandardMaterial
              color={crate.opened ? '#334155' : '#f59e0b'}
              metalness={0.6}
              roughness={0.3}
              emissive={crate.opened ? '#000000' : '#b45309'}
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const ContainerStack: React.FC<{ position: [number, number, number]; rotation?: [number, number, number]; color: string }> = ({
  position,
  rotation = [0, 0, 0],
  color,
}) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Lower shipping container */}
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.0, 2.6, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Upper stacked container */}
      <mesh position={[0.4, 3.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[6.0, 2.6, 2.4]} />
        <meshStandardMaterial color="#334155" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
};
