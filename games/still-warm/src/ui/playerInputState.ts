export function isActionResolving(
  status: string,
  pendingAction: unknown | null,
  hasPendingNarration: boolean = false,
): boolean {
  return (
    ["thinking", "acting", "stopping"].includes(status) ||
    pendingAction !== null ||
    hasPendingNarration
  );
}

export interface SpeechEligibilityParams {
  active: boolean;
  openingComplete: boolean;
  mode: string;
  busy: boolean;
}

export function canPlayerSpeak(params: SpeechEligibilityParams): boolean {
  return (
    params.active &&
    params.openingComplete &&
    params.mode === "live" &&
    !params.busy
  );
}
