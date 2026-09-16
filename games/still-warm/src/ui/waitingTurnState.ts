import { compileText } from "../text";

export type WaitingPhase = "typing" | "fading" | "dots";

export interface WaitingTurn {
  readonly rawText: string;
  readonly cleanText: string;
  readonly phase: WaitingPhase;
  readonly animationComplete: boolean;
  readonly skipped: boolean;
  readonly pendingResponse: string | null;
}

export function createWaitingTurn(rawText: string): WaitingTurn {
  const cleanText = compileText(rawText).text.trim();
  return {
    rawText,
    cleanText,
    phase: "typing",
    animationComplete: false,
    skipped: false,
    pendingResponse: null,
  };
}

export interface TurnTransitionResult {
  turn: WaitingTurn | null;
  activeResponse: string | null;
}

/**
 * When connection.response arrives:
 * If animation is still playing (typing phase and not complete), DO NOT interrupt it - buffer into pendingResponse.
 * If animation is already finished, fading, or in dots phase, transition immediately.
 */
export function onResponseArrived(
  current: WaitingTurn | null,
  responseText: string,
): TurnTransitionResult {
  if (!current) {
    return { turn: null, activeResponse: responseText };
  }
  if (current.phase === "typing" && !current.animationComplete) {
    // Animation is still playing: do not interrupt!
    return {
      turn: {
        ...current,
        pendingResponse: responseText,
      },
      activeResponse: null,
    };
  }
  // Animation already completed, fading, or in dots: transition immediately!
  return {
    turn: null,
    activeResponse: responseText,
  };
}

/**
 * When the user clicks to skip waiting text:
 * If response has already arrived, transition immediately to it.
 * Otherwise, skip the line completely and show repeating dots until response returns.
 */
export function onSkipWaiting(current: WaitingTurn | null): TurnTransitionResult {
  if (!current) {
    return { turn: null, activeResponse: null };
  }
  if (current.pendingResponse !== null) {
    // Result is already back! Transition to it immediately.
    return {
      turn: null,
      activeResponse: current.pendingResponse,
    };
  }
  // Result is not back yet: skip the line and show repeating dots.
  return {
    turn: {
      ...current,
      phase: "dots",
      animationComplete: true,
      skipped: true,
    },
    activeResponse: null,
  };
}

/**
 * When the typewriter animation naturally finishes playing out:
 * If response has already arrived, transition immediately to it.
 * Otherwise, start fading out the pre-gen text before showing dots.
 */
export function onAnimationFinished(current: WaitingTurn | null): TurnTransitionResult {
  if (!current) {
    return { turn: null, activeResponse: null };
  }
  if (current.pendingResponse !== null) {
    // Response arrived while animation was playing! Transition now that animation finished.
    return {
      turn: null,
      activeResponse: current.pendingResponse,
    };
  }
  // Response not back yet: start fading out pre-gen text.
  return {
    turn: {
      ...current,
      phase: "fading",
      animationComplete: true,
    },
    activeResponse: null,
  };
}

/**
 * When the fade-out of the pre-gen text completes:
 * If response arrived while fading, transition immediately to it.
 * Otherwise, show the repeating dots animation.
 */
export function onFadeComplete(current: WaitingTurn | null): TurnTransitionResult {
  if (!current) {
    return { turn: null, activeResponse: null };
  }
  if (current.pendingResponse !== null) {
    return {
      turn: null,
      activeResponse: current.pendingResponse,
    };
  }
  return {
    turn: {
      ...current,
      phase: "dots",
    },
    activeResponse: null,
  };
}

/**
 * When cancelled, stopped, timed out, or an error occurs:
 */
export function onCancelOrStop(): TurnTransitionResult {
  return { turn: null, activeResponse: null };
}

export function onTimeoutOrError(): TurnTransitionResult {
  return onCancelOrStop();
}

/**
 * Format repeating dots string based on dot count (1 to 3).
 */
export function formatWaitingDots(dotCount: number): string {
  const count = Math.max(1, Math.min(3, dotCount));
  return ".".repeat(count);
}
