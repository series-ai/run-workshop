import type { Emotion, Stage } from "./model";

export type TempoState = "calm" | "buildup" | "peak" | "lull";

export interface TempoTracker {
  stagnantTurns: number;
  state: TempoState;
  lastStage: Stage;
}

export function createInitialTempo(stage: Stage = "pinned"): TempoTracker {
  return {
    stagnantTurns: 0,
    state: "calm",
    lastStage: stage,
  };
}

export interface TurnProgressInput {
  actionSucceeded: boolean;
  gateFailed?: boolean;
  stateBefore: {
    stage: Stage;
    emotion: Emotion;
    disposition: { trust: number; agitation: number; confidence: number };
    holding: string | null;
  };
  stateAfter: {
    stage: Stage;
    emotion: Emotion;
    disposition: { trust: number; agitation: number; confidence: number };
    holding: string | null;
  };
}

/**
 * Determines whether a turn was productive using dual-track criteria:
 * 1. Physical Track: stage changed, action succeeded, or item pickup/use occurred.
 * 2. Emotional Track: agitation dropped by >= 8, trust increased by >= 8, or left 'scared'.
 * Note: If an explicit gate failed (e.g. lift blocked by fear), the intended action failed,
 * so the turn is non-productive.
 */
export function isTurnProductive(input: TurnProgressInput): boolean {
  if (input.gateFailed) {
    return false;
  }

  // Physical progress: stage advanced
  if (input.stateAfter.stage !== input.stateBefore.stage) {
    return true;
  }

  // Physical progress: explicit action succeeded
  if (input.actionSucceeded) {
    return true;
  }

  // Physical progress: holding item changed
  if (input.stateAfter.holding !== input.stateBefore.holding) {
    return true;
  }

  // Emotional progress: transitioned out of scared
  if (
    input.stateBefore.emotion === "scared" &&
    input.stateAfter.emotion !== "scared"
  ) {
    return true;
  }

  // Emotional progress: significant calming or trust building
  const agitationDrop =
    input.stateBefore.disposition.agitation -
    input.stateAfter.disposition.agitation;
  const trustGain =
    input.stateAfter.disposition.trust - input.stateBefore.disposition.trust;

  if (agitationDrop >= 8 || trustGain >= 8) {
    return true;
  }

  return false;
}

/**
 * Calculates the next tempo state based on stagnant turns count.
 * Rhythm:
 * - 0 stagnant turns: 'calm'
 * - 1-2 stagnant turns: 'buildup'
 * - 3-4 stagnant turns: 'peak' (triggers somatic telegraph)
 * - 5+ stagnant turns: 'lull' (pressure relief wave to avoid cognitive exhaustion)
 */
export function calculateTempoState(stagnantTurns: number): TempoState {
  if (stagnantTurns <= 0) return "calm";
  if (stagnantTurns <= 2) return "buildup";
  if (stagnantTurns <= 4) return "peak";
  return "lull";
}

/**
 * Updates the tempo tracker given the outcome of a turn.
 */
export function updateTempo(
  currentTempo: TempoTracker,
  progress: TurnProgressInput,
): TempoTracker {
  const productive = isTurnProductive(progress);

  let nextStagnant = productive ? 0 : currentTempo.stagnantTurns + 1;
  // If in lull for more than 2 turns without progress, cycle back to buildup
  if (nextStagnant > 6) {
    nextStagnant = 1; // cycle wave
  }

  return {
    stagnantTurns: nextStagnant,
    state: calculateTempoState(nextStagnant),
    lastStage: progress.stateAfter.stage,
  };
}
