export function isActionResolving(
  status: string,
  pendingAction: unknown | null,
): boolean {
  return (
    ["thinking", "acting", "stopping"].includes(status) ||
    pendingAction !== null
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
