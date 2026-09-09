import type { PhysicalAction } from "./model";

export const APPROACH_SECONDS = 4;
export const WALK_SECONDS = 4;
export const PICKUP_SECONDS = 217 / 30;
export const COLLECT_SECONDS = 181 / 30;

export function actionPerformance(action: PhysicalAction) {
  switch (action.kind) {
    case "use":
    case "adjust_lamp":
    case "light_lantern":
      return {
        clip: "pickup",
        seconds: PICKUP_SECONDS,
      } as const;
    case "combine":
    case "break":
      return {
        clip: "collect",
        seconds: COLLECT_SECONDS,
      } as const;
    case "roll_patient":
      return {
        clip: "collect",
        seconds: COLLECT_SECONDS,
      } as const;
    case "place":
      return {
        clip: "pickup",
        seconds: PICKUP_SECONDS,
      } as const;
    case "pick_up":
    case "lift_debris":
      return {
        clip: "pickup",
        seconds: PICKUP_SECONDS,
      } as const;
    case "move_to":
      return {
        clip: "walk",
        seconds: WALK_SECONDS,
      } as const;
  }
}
