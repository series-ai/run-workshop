import { useMemo, type FC } from "react";
import { createHandSocket } from "./types";
import { Canvas } from "@react-three/fiber";
import type { GameState } from "../game/model";
import { COLORS } from "./palette";
import { Room } from "./Room";
import { PatientTorso } from "./PatientTorso";
import { Lamp } from "./Lamp";
import { WorkbenchLantern } from "./WorkbenchLantern";
import { Tools } from "./Tools";
import { GeneratedAssistant } from "./GeneratedAssistant";
import { CameraController } from "./CameraController";
import { DitherBridge } from "./DitherBridge";
import { Debris } from "./Debris";
import type { LookInput } from "./look";

export { GeneratedAssistant } from "./GeneratedAssistant";
export { ProceduralAssistant } from "./ProceduralAssistant";
export { ASSISTANT_READY, ASSET_PATHS } from "./assets";
export { PALETTE, COLORS } from "./palette";
export type {
  SurgerySceneProps,
  ExtendedGameState,
  CreatureEmotion,
} from "./types";

export interface SurgeryScenePropsInterface {
  state: GameState;
  look: LookInput;
  reducedMotion?: boolean;
  onInspectItem?: (item: string) => void;
}

// ── SurgeryScene: First-Person Gothic Horror Operating Cellar ──
export const SurgeryScene: FC<SurgeryScenePropsInterface> = ({
  state,
  look,
  reducedMotion = false,
  onInspectItem,
}) => {
  const socket = useMemo(createHandSocket, []);
  const patient = state.patient ?? {
    health: 100,
    pain: 0,
    sedation: 0,
    blood: 100,
    blackoutRemaining: 0,
    blackoutCount: 0,
  };

  const isPaused = state.paused ?? false;
  const lit = state.environment.lanternLit;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        backgroundColor: COLORS.bg,
        overflow: "hidden",
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.48, -0.38], fov: 55, near: 0.05, far: 20 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Background & Atmospheric Cellar Fog */}
        <color attach="background" args={[COLORS.bg]} />
        <fog attach="fog" args={[COLORS.fog, 2.5, 9]} />

        {/* First-person camera positioning & pain/sedation response */}
        <CameraController
          look={look}
          elapsed={state.elapsed}
          started={state.phase !== "ready"}
          paused={isPaused}
          patient={patient}
          reducedMotion={reducedMotion}
        />

        {/* ── Scene Illumination (Balanced so scene is never pitch dark) ── */}
        <ambientLight intensity={lit ? 0.45 : 0.12} color="#8c9277" />
        <pointLight
          position={[0.1, 0.45, -0.65]}
          intensity={lit ? 0.6 : 0.04}
          color="#bcc4a3"
          distance={3.5}
          decay={1.5}
        />
        <pointLight
          position={[-0.35, 1.15, -1.2]}
          intensity={lit ? 3.2 : 0.04}
          color="#bcc3a6"
          distance={6}
          decay={2}
        />
        <pointLight
          position={[-1.8, 1.5, 1.2]}
          intensity={lit ? 1.2 : 0}
          color="#b49968"
          distance={5}
          decay={2}
        />
        <directionalLight
          position={[-2.5, 3, 2]}
          intensity={lit ? 0.3 : 0.1}
          color="#68745d"
        />
        <pointLight
          position={[0, -0.6, 0.4]}
          intensity={lit ? 0.1 : 0}
          color="#35373d"
          distance={2.5}
        />

        {/* Cellar Room: Tiled walls, gothic ribs, table, cabinet, tray, environmental fire & door */}
        <Room
          paused={isPaused}
          environment={state.environment}
          reducedMotion={reducedMotion}
        />

        {/* Reclined Patient Torso, Legs, and Dynamic Stage Wound */}
        <PatientTorso state={state} reducedMotion={reducedMotion} />

        <Debris state={state} />

        {/* Articulated Surgical Lamp with Dynamic Aim following state.lamp */}
        <WorkbenchLantern lit={lit} paused={isPaused} />
        <Lamp
          lit={lit && state.lamp !== "away"}
          paused={isPaused}
          mode={state.lamp ?? "wound"}
          reducedMotion={reducedMotion}
        />

        {/* Reanimated Assistant: loads the assembled GLB when ready, fallback to procedural corpse */}
        <GeneratedAssistant
          socket={socket}
          state={state}
          reducedMotion={reducedMotion}
        />

        {/* Identifiable 3D Instruments with Smooth Position Interpolation */}
        <Tools
          socket={socket}
          state={state}
          onInspectItem={onInspectItem}
          reducedMotion={reducedMotion}
        />

        {/* Dither-Kit Palette GPU Post-Processing with Sedation Ghosting */}
        <DitherBridge patient={patient} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
};

export default SurgeryScene;
