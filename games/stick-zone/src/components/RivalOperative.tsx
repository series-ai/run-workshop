import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OperativeState } from '../sim/game.js';
import { StickOperative } from './StickOperative.js';

interface RivalOperativeProps {
  rival: OperativeState;
}

export const RivalOperative: React.FC<RivalOperativeProps> = ({ rival }) => {
  if (!rival.isAlive || rival.isExtracted) {
    // Slumped casualty drop / loot bag
    return (
      <group position={[rival.x, 0.2, rival.z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.4, 0.8]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.7} />
        </mesh>
        {/* Loot indicator beacon */}
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 1.2, 8]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
    );
  }

  const isRogueAI = rival.badge === 'ROGUE AI OPERATOR';
  const tagColor = isRogueAI ? '#f59e0b' : '#ef4444';

  return (
    <group>
      <StickOperative
        operative={rival}
        accentColor={tagColor}
      />
    </group>
  );
};
