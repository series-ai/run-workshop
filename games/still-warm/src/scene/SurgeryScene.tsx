import { useMemo, type FC } from "react";
import { PatientPoseController, type PatientPose } from "./PatientPose";
import { createHandSocket } from "./types";
import { Canvas } from "@react-three/fiber";
import type { GameState } from "../game/model";
import { COLORS } from "./palette";
import { CellarStory } from "./CellarStory";
import { SceneLighting } from "./SceneLighting";
import { Room } from "./Room";
import { PatientTorso } from "./PatientTorso";
import { Lamp } from "./Lamp";
import { Tools } from "./Tools";
import { GeneratedAssistant } from "./GeneratedAssistant";
import { CameraController } from "./CameraController";
import { DitherBridge } from "./DitherBridge";
import { Debris } from "./Debris";
import type { LookInput } from "./look";
import type { CreatureCall } from "../audio/creatureVoice";

interface SurgerySceneProps {
  state: GameState;
  look: LookInput;
  reducedMotion?: boolean;
  onInspectItem?: (item: string) => void;
  call?: CreatureCall | null;
}

// ── SurgeryScene: First-Person Gothic Horror Operating Cellar ──
export const SurgeryScene: FC<SurgerySceneProps> = ({
  state,
  look,
  reducedMotion = false,
  onInspectItem,
  call = null,
}) => {
  const socket = useMemo(createHandSocket, []);
  const pose = useMemo<PatientPose>(
    () => ({ roll: state.posture === "supine" ? 1 : 0 }),
    [],
  );
  const patient = state.patient;
  const isPaused = state.paused;
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

        {/* Player-controlled first-person view */}
        <PatientPoseController state={state} pose={pose} />
        <CameraController look={look} pose={pose} paused={isPaused} />

        <SceneLighting />
        <CellarStory
          lit={lit}
          paused={isPaused}
          reducedMotion={reducedMotion}
        />

        {/* Cellar Room: Tiled walls, gothic ribs, table, cabinet, tray, environmental fire & door */}
        <Room
          paused={isPaused}
          environment={state.environment}
          reducedMotion={reducedMotion}
        />

        {/* Reclined Patient Torso, Legs, and Dynamic Stage Wound */}
        <PatientTorso
          pose={pose}
          state={state}
          socket={socket}
          reducedMotion={reducedMotion}
        />

        <Debris state={state} socket={socket} />

        {/* Articulated Surgical Lamp with Dynamic Aim following state.lamp */}
        <Lamp
          lit={lit && state.lamp !== "away"}
          paused={isPaused}
          mode={state.lamp}
          reducedMotion={reducedMotion}
        />

        {/* Reanimated Assistant: loads the assembled GLB when ready, fallback to procedural corpse */}
        <GeneratedAssistant
          socket={socket}
          state={state}
          reducedMotion={reducedMotion}
          call={call}
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
