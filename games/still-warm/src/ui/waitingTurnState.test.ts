import { describe, expect, it } from "vitest";
import {
  createWaitingTurn,
  formatWaitingDots,
  onAnimationFinished,
  onResponseArrived,
  onSkipWaiting,
  onCancelOrStop,
  onTimeoutOrError,
} from "./waitingTurnState";

describe("waitingTurnState", () => {
  const sampleRaw = "My voice echoes in the darkness...{{pause(2.2)}} Silence presses back.{{pause(2.5)}}";

  it("creates initial waiting turn with animation not complete", () => {
    const turn = createWaitingTurn(sampleRaw);
    expect(turn.animationComplete).toBe(false);
    expect(turn.skipped).toBe(false);
    expect(turn.pendingResponse).toBe(null);
    expect(turn.cleanText).toBe("My voice echoes in the darkness... Silence presses back.");
  });

  it("does NOT interrupt playing animation when response arrives early", () => {
    const turn = createWaitingTurn(sampleRaw);
    const result = onResponseArrived(turn, "A trembling sound answers from the dark.");

    // Turn is not cleared - animation still plays
    expect(result.turn).not.toBeNull();
    expect(result.turn?.animationComplete).toBe(false);
    expect(result.turn?.pendingResponse).toBe("A trembling sound answers from the dark.");
    expect(result.activeResponse).toBeNull();
  });

  it("transitions immediately when animation completes if response already arrived", () => {
    const turn = createWaitingTurn(sampleRaw);
    const withResponse = onResponseArrived(turn, "A trembling sound answers from the dark.");

    const completed = onAnimationFinished(withResponse.turn);
    expect(completed.turn).toBeNull();
    expect(completed.activeResponse).toBe("A trembling sound answers from the dark.");
  });

  it("starts waiting mode with repeating dots if animation finishes before response arrives", () => {
    const turn = createWaitingTurn(sampleRaw);
    const completed = onAnimationFinished(turn);

    expect(completed.turn).not.toBeNull();
    expect(completed.turn?.animationComplete).toBe(true);
    expect(completed.turn?.pendingResponse).toBeNull();
    expect(completed.activeResponse).toBeNull();

    // Now when response arrives, transitions immediately
    const afterResponse = onResponseArrived(completed.turn, "A trembling sound answers.");
    expect(afterResponse.turn).toBeNull();
    expect(afterResponse.activeResponse).toBe("A trembling sound answers.");
  });

  it("skips animation immediately on user click and shows repeating dots if response not back yet", () => {
    const turn = createWaitingTurn(sampleRaw);
    const skipped = onSkipWaiting(turn);

    expect(skipped.turn).not.toBeNull();
    expect(skipped.turn?.animationComplete).toBe(true);
    expect(skipped.turn?.skipped).toBe(true);
    expect(skipped.activeResponse).toBeNull();
  });

  it("transitions immediately on user click if response already arrived during animation", () => {
    const turn = createWaitingTurn(sampleRaw);
    const withResponse = onResponseArrived(turn, "Response ready");

    const skipped = onSkipWaiting(withResponse.turn);
    expect(skipped.turn).toBeNull();
    expect(skipped.activeResponse).toBe("Response ready");
  });

  it("clears turn on cancel or stop", () => {
    const result = onCancelOrStop();
    expect(result.turn).toBeNull();
    expect(result.activeResponse).toBeNull();
  });

  it("clears turn on timeout or error", () => {
    const result = onTimeoutOrError();
    expect(result.turn).toBeNull();
    expect(result.activeResponse).toBeNull();
  });

  it("formats repeating dots correctly (1 to 3 dots)", () => {
    expect(formatWaitingDots(1)).toBe(".");
    expect(formatWaitingDots(2)).toBe("..");
    expect(formatWaitingDots(3)).toBe("...");
    // Clamped
    expect(formatWaitingDots(4)).toBe("...");
    expect(formatWaitingDots(0)).toBe(".");
  });
});
