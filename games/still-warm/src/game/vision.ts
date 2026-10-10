import type { GameState, Posture, Stage } from "./model";

/**
 * What the trapped father can actually see. The game's narrative contract:
 * he lies face down in the dark until the cabinet is lifted, and he cannot
 * see the boy at all until he is rolled onto his back under light. Narration
 * must never describe sight the state does not allow.
 */
export type Vision =
  /** Face down under the cabinet: hearing and touch only. */
  | "dark"
  /** Face down but freed from the cabinet: the flagstones ahead, never the boy. */
  | "floor"
  /** On his back under light: the boy and the room. */
  | "room";

export interface VisionInput {
  posture: Posture;
  stage: Stage;
  lamp: "wound" | "face" | "away";
  candleLit: boolean;
  lanternLit: boolean;
  fire: number;
}

export function resolveVision(input: VisionInput): Vision {
  const lit =
    input.lanternLit ||
    input.candleLit ||
    input.lamp !== "away" ||
    input.fire > 0;

  if (input.posture === "supine") {
    return lit ? "room" : "dark";
  }
  return input.stage === "pinned" ? "dark" : "floor";
}

export function visionOf(state: GameState): Vision {
  return resolveVision({
    posture: state.posture,
    stage: state.stage,
    lamp: state.lamp,
    candleLit: state.candleLit,
    lanternLit: state.environment.lanternLit,
    fire: state.environment.fire,
  });
}
