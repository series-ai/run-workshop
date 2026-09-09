import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import type { GameState } from "../game/model";

export interface PatientPose {
  roll: number;
}
export const PRONE_EYES = [0, -0.77, -0.5] as const;
export const BODY_ROLL_AXIS_Y = -0.75;

export function PatientPoseController({
  state,
  pose,
}: {
  state: GameState;
  pose: PatientPose;
}) {
  useFrame(() => {
    if (state.paused) return;
    if (state.stage === "pinned") pose.roll = 0;
    else if (state.posture === "supine") pose.roll = 1;
    else if (state.pending?.action.kind === "roll_patient") {
      // A stopped roll holds its visual position until the next instruction.
      pose.roll = Math.max(
        pose.roll,
        MathUtils.smoothstep(state.pending.progress, 0.45, 0.92),
      );
    }
  });
  return null;
}
