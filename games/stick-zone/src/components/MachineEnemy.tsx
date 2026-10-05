import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MachineDefense } from '../sim/game.js';

interface MachineEnemyProps {
  machine: MachineDefense;
}

export const MachineEnemy: React.FC<MachineEnemyProps> = ({ machine }) => {
  const groupRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (!groupRef.current || !machine.isAlive) return;

    groupRef.current.position.set(machine.x, machine.y, machine.z);
    groupRef.current.rotation.y = machine.facing;

    if (machine.type === 'drone') {
      // Gentle aerial hover bobbing
      groupRef.current.position.y = machine.y + Math.sin(state.clock.elapsedTime * 3) * 0.3;
    }
  });

  if (!machine.isAlive) {
    // Wreckage smoking on ground
    return (
      <group position={[machine.x, 0.2, machine.z]}>
        <mesh>
          <boxGeometry args={[1.0, 0.3, 1.0]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[machine.x, machine.y, machine.z]}>
      {machine.type === 'turret' ? (
        <TurretModel cooldown={machine.cooldownTicks} />
      ) : (
        <DroneModel cooldown={machine.cooldownTicks} />
      )}

      {/* Red Targeting Sensor Cone */}
      <mesh
        ref={laserRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, machine.type === 'turret' ? 0.6 : 0, 7.5]}
      >
        <coneGeometry args={[2.5, 15, 16, 1, true]} />
        <meshBasicMaterial
          color="#ef4444"
          transparent
          opacity={machine.cooldownTicks > 0 ? 0.35 : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const TurretModel: React.FC<{ cooldown: number }> = ({ cooldown }) => {
  return (
    <group>
      {/* Heavy Steel Turret Bunker Base */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.2, 0.8, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Swivel Mount */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Twin Vulcan Barrels */}
      <mesh position={[0.18, 0.9, 0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.1, 8]} />
        <meshStandardMaterial color="#020617" metalness={0.95} roughness={0.1} />
      </mesh>
      <mesh position={[-0.18, 0.9, 0.8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.1, 8]} />
        <meshStandardMaterial color="#020617" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Red Optical Targeting Eye */}
      <mesh position={[0, 1.1, 0.35]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={cooldown > 0 ? 1.5 : 0.8} />
      </mesh>
    </group>
  );
};

const DroneModel: React.FC<{ cooldown: number }> = ({ cooldown }) => {
  return (
    <group>
      {/* Drone Aerodynamic Core */}
      <mesh castShadow>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Rotor Struts */}
      <mesh position={[0.5, 0.1, 0.5]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.5, 0.1, 0.5]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.5, 0.1, -0.5]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.5, 0.1, -0.5]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Sensor Blaster Pod */}
      <mesh position={[0, -0.25, 0.2]}>
        <boxGeometry args={[0.16, 0.2, 0.4]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={cooldown > 0 ? 1.5 : 0.6} />
      </mesh>
    </group>
  );
};
