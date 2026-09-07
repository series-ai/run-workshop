type RunApi = typeof import("@series-inc/rundot-game-sdk/api").default;
let initialization: Promise<RunApi> | undefined;

export function initializeRun(): Promise<RunApi> {
  initialization ??= import("@series-inc/rundot-game-sdk/api")
    .then(async ({ default: run }) => {
      await run.initializeAsync();
      return run;
    })
    .catch((error) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
}
