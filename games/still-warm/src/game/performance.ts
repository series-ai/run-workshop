import type { PhysicalAction } from "./model";

export const APPROACH_SECONDS = 4;
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
        reverse: false,
        hold: true,
      } as const;
    case "combine":
    case "break":
      return {
        clip: "collect",
        seconds: COLLECT_SECONDS,
        reverse: false,
        hold: false,
      } as const;
    case "place":
      return {
        clip: "pickup",
        seconds: PICKUP_SECONDS,
        reverse: true,
        hold: false,
      } as const;
    case "pick_up":
    case "lift_debris":
      return {
        clip: "pickup",
        seconds: PICKUP_SECONDS,
        reverse: false,
        hold: false,
      } as const;
  }
}
