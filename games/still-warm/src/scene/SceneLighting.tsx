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

  // When the cabinet is lifted off but the patient is still prone:
  // Cool pale cellar light spills down from the collapsed ceiling opening,
  // illuminating the cold stone floor, cracks, and drainage grill before his eyes.
  const isProneFreed =
    stage !== undefined && stage !== "pinned" && posture === "prone";

  return (
    <group name="cellar-lighting">
      <ambientLight
        intensity={
          inspection
            ? 0.55
            : isProneFreed
              ? 0.24
              : lanternLit
                ? 0.08
                : 0.025
        }
        color={isProneFreed ? "#788a96" : "#8b9075"}
      />
      {inspection && (
        <directionalLight
          position={[-1, 2, -1]}
          intensity={2}
          color="#d1bd8d"
        />
      )}
      {/* Light filtering down to illuminate the floor when the cabinet is heaved off */}
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
    </group>
  );
}
