import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SectorDepotSimulation } from '../sim/game.js';
import { SectorMap } from './SectorMap.js';
import { StickOperative } from './StickOperative.js';
import { RivalOperative } from './RivalOperative.js';
import { MachineEnemy } from './MachineEnemy.js';
import { ExfilZone } from './ExfilZone.js';

interface GameCanvasProps {
  sim: SectorDepotSimulation;
}

const CameraController: React.FC<{ playerPos: { x: number; y: number; z: number } }> = ({ playerPos }) => {
  useFrame(({ camera }) => {
    // Top-down tactical isometric offset
    const targetCamX = playerPos.x;
    const targetCamY = playerPos.y + 18;
    const targetCamZ = playerPos.z + 14;

    camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.12);
    camera.lookAt(playerPos.x, playerPos.y, playerPos.z);
  });

  return null;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ sim }) => {
  return (
    <div className="canvas-container">
      <Canvas
        shadows
        camera={{ position: [sim.player.x, sim.player.y + 18, sim.player.z + 14], fov: 45 }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[40, 60, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={10}
          shadow-camera-far={120}
          shadow-camera-left={-60}
          shadow-camera-right={60}
          shadow-camera-top={60}
          shadow-camera-bottom={-60}
        />

        <CameraController playerPos={sim.player} />

        {/* Depot Environment */}
        <SectorMap crates={sim.crates} />

        {/* Extraction LZ Smoke & Countdown Ring */}
        <ExfilZone exfilState={sim.exfilController.getState()} />

        {/* Player Operative */}
        {sim.player.isAlive && !sim.player.isExtracted && (
          <StickOperative operative={sim.player} accentColor="#06b6d4" />
        )}

        {/* Squadmate Companion */}
        {sim.squadmate.isAlive && !sim.squadmate.isExtracted && (
          <StickOperative operative={sim.squadmate} accentColor="#0284c7" />
        )}

        {/* Rival Operatives (or Rogue AI) */}
        {sim.rivals.map((rival) => (
          <RivalOperative key={rival.id} rival={rival} />
        ))}

        {/* Automated Machine Defenses */}
        {sim.machines.map((machine) => (
          <MachineEnemy key={machine.id} machine={machine} />
        ))}
      </Canvas>
    </div>
  );
};
