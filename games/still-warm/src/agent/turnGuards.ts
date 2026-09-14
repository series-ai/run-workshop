const DISTRESS_PATTERN =
  /^(please\s+)?(help(\s+me)?|where\s+are\s+you|are\s+you\s+there|hurry|it\s+hurts|ouch|lift\s+it|get\s+(this|it)\s+off(\s+me)?)(\s+please)?[.!?\s]*$/i;

export function isDistressUtterance(text: string): boolean {
  if (!text) return false;
  return DISTRESS_PATTERN.test(text.trim());
}

export interface LiftGateInput {
  turnStartedScared: boolean;
  reactedOutOfFear: boolean;
}

export type LiftGateResult =
  | { ok: true }
  | { ok: false; message: string };

export function evaluateLiftGate(input: LiftGateInput): LiftGateResult {
  if (input.turnStartedScared || input.reactedOutOfFear) {
    return {
      ok: false,
      message:
        "You were trembling in fear when your father spoke. You are still absorbing his voice and regaining your composure. Vocalize and let him hear you before attempting to heave the cabinet.",
    };
  }
  return { ok: true };
}
