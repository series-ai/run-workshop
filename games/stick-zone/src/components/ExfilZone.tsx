import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SIM_CONFIG } from '../sim/config.js';
import type { ExfilState } from '../sim/airlock.js';

interface ExfilZoneProps {
  exfilState: ExfilState;
}

export const ExfilZone: React.FC<ExfilZoneProps> = ({ exfilState }) => {
  const smokeRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const zone = SIM_CONFIG.EXFIL_ZONE;

  const currentTicks = exfilState.kind === 'holding_zone' ? exfilState.currentTicks : 0;
  const progressRatio = Math.min(1, currentTicks / SIM_CONFIG.EXFIL_HOLD_TICKS);

  useFrame((state, delta) => {
    if (smokeRef.current) {
      smokeRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group position={[zone.x, 0, zone.z]}>
      {/* 6.0m Green Smoke Radius Boundary Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[zone.radius - 0.2, zone.radius, 64]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.7} />
      </mesh>

      {/* Progress Hold Arc / Ring */}
      {currentTicks > 0 && (
        <mesh
          ref={ringRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.06, 0]}
        >
          <ringGeometry args={[0.5, zone.radius - 0.4, 64, 1, 0, Math.PI * 2 * progressRatio]} />
          <meshBasicMaterial color="#4ade80" transparent opacity={0.35} />
        </mesh>
      )}

      {/* Green Smoke Particles / Beacons */}
      <group ref={smokeRef}>
        {[0, 1.2, 2.4, 3.6, 4.8].map((y, i) => (
          <mesh key={i} position={[Math.sin(i) * 1.5, y + 1.0, Math.cos(i) * 1.5]}>
            <sphereGeometry args={[1.2 + i * 0.3, 12, 12]} />
            <meshStandardMaterial
              color="#22c55e"
              transparent
              opacity={0.15 - i * 0.02}
              roughness={1}
            />
          </mesh>
        ))}
      </group>

      {/* Floodlight Tower Structure */}
      <group position={[zone.radius + 1.5, 0, 0]}>
        <mesh position={[0, 5, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.4, 10, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[-0.4, 10, 0]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.8, 0.5, 0.8]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={1.2} />
        </mesh>
        <spotLight
          position={[-0.4, 10, 0]}
          target-position={[0, 0, 0]}
          color="#4ade80"
          intensity={8}
          distance={25}
          angle={0.6}
        />
      </group>
    </group>
  );
};
