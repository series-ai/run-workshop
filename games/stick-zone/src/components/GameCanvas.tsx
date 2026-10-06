import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SectorDepotSimulation } from "../sim/game.js";
import { SectorMap } from "./SectorMap.js";
import { StickOperative } from "./StickOperative.js";
import { RivalOperative } from "./RivalOperative.js";
import { MachineEnemy } from "./MachineEnemy.js";
import { ExfilZone } from "./ExfilZone.js";

interface GameCanvasProps {
  sim: SectorDepotSimulation;
}

const CameraController: React.FC<{
  playerPos: { x: number; y: number; z: number };
  isCorridorActive?: boolean;
  sim: SectorDepotSimulation;
}> = ({ playerPos, isCorridorActive, sim }) => {
  useFrame(({ camera }, delta) => {
    const lerpFactor = 1 - Math.exp(-6 * Math.min(delta, 0.1));
    if (isCorridorActive) {
      // Cinematic low-angle dramatic corridor exfil camera
      const targetCamX = playerPos.x + 3.0;
      const targetCamY = playerPos.y + 4.0;
      const targetCamZ = playerPos.z + 5.5;
      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), lerpFactor);
      camera.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);
    } else {
      // Frame-independent smooth return to isometric view without snapping
      const targetCamX = playerPos.x;
      const targetCamY = playerPos.y + 13;
      const targetCamZ = playerPos.z + 10.5;
      camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), lerpFactor);
      camera.lookAt(playerPos.x, playerPos.y + 1, playerPos.z);
    }
    sim.cameraPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    sim.cameraTarget = isCorridorActive ? { x: playerPos.x, y: playerPos.y + 1.2, z: playerPos.z } : { x: playerPos.x, y: playerPos.y + 1, z: playerPos.z };
  });

  return null;
};

export const GameCanvas: React.FC<GameCanvasProps> = ({ sim }) => {
  return (
    <div className="canvas-container">
      <Canvas
        shadows
        camera={{ position: [sim.player.x, sim.player.y + 13, sim.player.z + 10.5], fov: 48 }}
      >
        {/* Crisp illumination to eliminate dark scenes */}
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[30, 50, 20]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={5}
          shadow-camera-far={100}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        {/* Dynamic tactical fill light focused on operative */}
        <pointLight
          position={[sim.player.x, sim.player.y + 5, sim.player.z]}
          intensity={3.0}
          distance={35}
          color="#38bdf8"
        />

        <CameraController playerPos={sim.player} isCorridorActive={sim.exfilController.getState().kind === "corridor_presentation" || sim.exfilController.getState().kind === "submitting_settlement" || sim.exfilController.getState().kind === "extracted"} sim={sim} />

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
