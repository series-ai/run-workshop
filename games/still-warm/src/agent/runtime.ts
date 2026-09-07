import run from '@series-inc/rundot-game-sdk/api';

let initialization: Promise<typeof run> | undefined;

export function initializeRun(): Promise<typeof run> {
  initialization ??= run
    .initializeAsync()
    .then(() => run)
    .catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
