import React from "react";
import type { LootCrate } from "../sim/game.js";

interface SectorMapProps {
  crates: LootCrate[];
}

export const SectorMap: React.FC<SectorMapProps> = ({ crates }) => {
  return (
    <group>
      {/* Crisp Tactical Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#223046" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* High-Contrast Grid Line Overlays */}
      <gridHelper args={[160, 32, "#64748b", "#334155"]} position={[0, 0.01, 0]} />

      {/* Perimeter Boundary Walls */}
      <mesh position={[0, 2, -80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[0, 2, 80]} receiveShadow castShadow>
        <boxGeometry args={[160, 4, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[-80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>
      <mesh position={[80, 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[1, 4, 160]} />
        <meshStandardMaterial color="#334155" roughness={0.5} />
      </mesh>

      {/* Shipping Containers (Depot Maze & Physical Cover - Exactly Aligned with DEPOT_CONTAINERS AABB Collision Geometry) */}
      <ContainerStack position={[-20, 0, -30]} width={7.0} depth={4.0} color="#0ea5e9" />
      <ContainerStack position={[-35, 0, -10]} width={4.0} depth={7.0} color="#f97316" />
      <ContainerStack position={[10, 0, -40]} width={6.0} depth={3.0} color="#22c55e" />
      <ContainerStack position={[30, 0, -20]} width={6.0} depth={5.0} color="#ef4444" />
      <ContainerStack position={[-15, 0, 15]} width={4.0} depth={7.0} color="#0ea5e9" />
      <ContainerStack position={[5, 0, 30]} width={6.0} depth={3.0} color="#f97316" />
      <ContainerStack position={[-45, 0, 35]} width={7.0} depth={4.0} color="#22c55e" />

      {/* Loot Crates */}
      {crates.map((crate) => (
        <group key={crate.id} position={[crate.x, 0.4, crate.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.2, 0.8, 1.2]} />
            <meshStandardMaterial
              color={crate.opened ? "#475569" : "#fbbf24"}
              metalness={0.6}
              roughness={0.3}
              emissive={crate.opened ? "#000000" : "#d97706"}
              emissiveIntensity={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

const ContainerStack: React.FC<{
  position: [number, number, number];
  width: number;
  depth: number;
  color: string;
}> = ({
  position,
  width,
  depth,
  color,
}) => {
  return (
    <group position={position}>
      {/* Lower shipping container */}
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 2.6, depth]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Upper stacked container - centered on collision box */}
      <mesh position={[0, 3.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 2.6, depth]} />
        <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
};
