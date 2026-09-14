import { compileText } from "../text";

export interface WaitingTurn {
  readonly rawText: string;
  readonly cleanText: string;
  readonly animationComplete: boolean;
  readonly skipped: boolean;
  readonly pendingResponse: string | null;
}

export function createWaitingTurn(rawText: string): WaitingTurn {
  const cleanText = compileText(rawText).text.trim();
  return {
    rawText,
    cleanText,
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
 * If animation is still running, DO NOT interrupt it - buffer into pendingResponse.
 * If animation is already finished or skipped, transition immediately.
 */
export function onResponseArrived(
  current: WaitingTurn | null,
  responseText: string,
): TurnTransitionResult {
  if (!current) {
    return { turn: null, activeResponse: responseText };
  }
  if (!current.animationComplete) {
    // Animation is still playing: do not interrupt!
    return {
      turn: {
        ...current,
        pendingResponse: responseText,
      },
      activeResponse: null,
    };
  }
  // Animation already completed or skipped: transition immediately!
  return {
    turn: null,
    activeResponse: responseText,
  };
}

/**
 * When the user clicks to skip waiting text:
 * If response has already arrived, transition immediately to it.
 * Otherwise, complete the animation and start repeating dots at the end.
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
  // Result is not back yet: show full clean text with repeating dots.
  return {
    turn: {
      ...current,
      animationComplete: true,
      skipped: true,
    },
    activeResponse: null,
  };
}

/**
 * When the typewriter animation naturally finishes playing out:
 * If response has already arrived, transition immediately to it.
 * Otherwise, keep waiting with repeating dots at the end.
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
  // Response not back yet: keep waiting with repeating dots at the end.
  return {
    turn: {
      ...current,
      animationComplete: true,
    },
    activeResponse: null,
  };
}

/**
 * When a timeout or error occurs:
 */
export function onTimeoutOrError(): TurnTransitionResult {
  return { turn: null, activeResponse: null };
}

/**
 * Helper to compute the repeating dots string based on dot count (1 to 3).
 */
export function formatWaitingText(cleanText: string, dotCount: number): string {
  const dots = ".".repeat(Math.max(1, Math.min(3, dotCount)));
  return `${cleanText} ${dots}`;
}
