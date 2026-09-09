import { MathUtils } from "three";
import type { GameState } from "../game/model";
import { CABINET_GRIP } from "./Cabinet";
import type { LiveHandSocket } from "./types";

export function supportMotion(state: GameState, socket: LiveHandSocket) {
  const lifting = state.pending?.action.kind === "lift_debris";
  const lift =
    lifting && socket.isTracking && socket.actionContact
      ? MathUtils.clamp(socket.gripPosition.y - CABINET_GRIP[1], 0, 0.85)
      : 0;
  const cleared =
    state.stage !== "pinned" ||
    (lifting && (state.pending?.progress ?? 0) > 0.8);
  return { lift, cleared };
}
