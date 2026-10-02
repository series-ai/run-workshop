import type { GameState } from "../game/model";

export function SceneLighting({
  state,
  inspection = false,
}: {
  state?: GameState;
  inspection?: boolean;
}) {
  const stage = state?.stage;
  const posture = state?.posture;
  const lanternLit = state?.environment?.lanternLit ?? false;

  // When the cabinet is lifted off:
  // Cool pale cellar light spills down from the collapsed ceiling opening.
  const isFreed = stage !== undefined && stage !== "pinned";
  const isProneFreed = isFreed && posture === "prone";
  const isSupineFreed = isFreed && posture === "supine";

  return (
    <group name="cellar-lighting">
      <ambientLight
        intensity={
          inspection
            ? 0.55
            : isProneFreed
              ? 0.24
              : isSupineFreed
                ? 0.16
                : lanternLit
                  ? 0.12
                  : 0.08
        }
        color={isProneFreed || isSupineFreed ? "#8295a3" : "#8b9075"}
      />
      {inspection && (
        <directionalLight
          position={[-1, 2, -1]}
          intensity={2}
          color="#d1bd8d"
        />
      )}
      {/* Light filtering down from the ceiling breach when prone */}
      {isProneFreed && (
        <>
          <directionalLight
            position={[0.3, 2.2, 0.4]}
            intensity={1.8}
            color="#8fa3b0"
            castShadow
          />
          <pointLight
            position={[0, -0.65, -0.2]}
            intensity={1.2}
            distance={2.8}
            color="#728c9e"
          />
        </>
      )}
      {/* Light illuminating the creature and ceiling breach when rolled supine */}
      {isSupineFreed && (
        <>
          <directionalLight
            position={[0.2, 2.6, 0.3]}
            intensity={1.6}
            color="#9ab3c4"
            castShadow
          />
          <pointLight
            position={[0, 0.1, 0.4]}
            intensity={0.9}
            distance={3.2}
            color="#a89b87"
          />
        </>
      )}
    </group>
  );
}
