import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ASSET_PATHS } from '../assetLibrary.js';
import type { OperativeState } from '../sim/game.js';

interface StickOperativeProps {
  operative: OperativeState;
  modelUrl?: string;
  accentColor?: string;
}

export const StickOperative: React.FC<StickOperativeProps> = ({
  operative,
  modelUrl = ASSET_PATHS.playerStickman,
  accentColor = '#06b6d4',
}) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth position interpolation
    groupRef.current.position.lerp(new THREE.Vector3(operative.x, operative.y, operative.z), 18 * delta);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, operative.facing, 20 * delta);

    // Kinetic animation postures (slide lean, combat roll spin, melee kick)
    if (operative.action === 'slide') {
      groupRef.current.rotation.x = 0.55; // Lean backwards into slide
      groupRef.current.position.y = 0.4;
    } else if (operative.action === 'roll') {
      groupRef.current.rotation.x += delta * 14; // Forward roll rotation
      groupRef.current.position.y = 0.6;
    } else {
      groupRef.current.rotation.x = 0;
      groupRef.current.position.y = 0;
    }
  });

  return (
    <group ref={groupRef} position={[operative.x, operative.y, operative.z]}>
      {/* Tactical Aura / Floor Chevron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.9, 1.15, 32]} />
        <meshBasicMaterial
          color={accentColor}
          transparent
          opacity={operative.isInvulnerable ? 0.9 : 0.6}
        />
      </mesh>

      {/* Stylized Stick Figure Geometry fallback / wrapper */}
      <StickFigureModel operative={operative} accentColor={accentColor} />

      {/* Overhead Operator Badge */}
      <group position={[0, 2.4, 0]}>
        {/* Billboard health pip */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.2, 0.12]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>
        <mesh position={[((operative.health / 100) - 1) * 0.6, 0, 0.01]}>
          <planeGeometry args={[(operative.health / 100) * 1.2, 0.1]} />
          <meshBasicMaterial color={operative.health > 40 ? accentColor : '#ef4444'} />
        </mesh>
      </group>
    </group>
  );
};

// Procedural stylized inkline stickman (with animated joints)
const StickFigureModel: React.FC<{ operative: OperativeState; accentColor: string }> = ({
  operative,
  accentColor,
}) => {
  return (
    <group>
      {/* Head Sphere */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Tactical Visor Band */}
      <mesh position={[0, 1.87, 0.16]} castShadow>
        <boxGeometry args={[0.24, 0.08, 0.1]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.6} />
      </mesh>

      {/* Torso Spine */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.06, 0.85, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>

      {/* Armor Vest Plate */}
      <mesh position={[0, 1.35, 0.04]} castShadow>
        <boxGeometry args={[0.34, 0.45, 0.22]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Left & Right Legs */}
      <mesh position={[-0.15, 0.5, 0]} rotation={[operative.action === 'walk' ? 0.3 : 0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.95, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.15, 0.5, 0]} rotation={[operative.action === 'walk' ? -0.3 : 0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.04, 0.95, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* Weapon in Hand */}
      <group position={[0.3, 1.2, 0.35]}>
        <mesh castShadow>
          <boxGeometry args={[0.1, 0.14, 0.8]} />
          <meshStandardMaterial color="#090d16" roughness={0.2} metalness={0.9} />
        </mesh>
        {/* Barrel glow when shooting */}
        {operative.action === 'shoot' && (
          <mesh position={[0, 0, 0.45]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#f59e0b" />
          </mesh>
        )}
      </group>
    </group>
  );
};
