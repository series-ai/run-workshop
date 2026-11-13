/**
 * @file synchub.ts
 * The one typed boundary between the game and SyncHub extraction.
 *
 * Replaces the untyped window/global reads in the old src/sdk.ts path:
 * callers get an ExtractionApi, parse confirmed RaidState at the boundary,
 * and see every failure as a thrown error. Nothing here falls back to a
 * local result.
 */
import type {
  ActiveAirlockSession,
  ActiveSpokeSession,
  ExtractionApi,
  PrepareRaidOptions,
} from "@series-inc/rundot-game-sdk";
import type { RaidState } from "@series-inc/rundot-syncplay/modules/extraction";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Confirmed state arrives as `unknown` from the spoke callback. Validate
 * the fields the adapter reads and fail loud on any other shape.
 */
export function parseConfirmedState(value: unknown): RaidState {
  if (!isRecord(value)) {
    throw new Error("[synchub] confirmed state is not an object");
  }
  if (!Number.isInteger(value.tick) || (value.tick as number) < 0) {
    throw new Error(`[synchub] confirmed state has an invalid tick: ${String(value.tick)}`);
  }
  for (const field of ["actors", "items", "corpses", "worldPickups"] as const) {
    if (!isRecord(value[field])) {
      throw new Error(`[synchub] confirmed state field ${field} is not a record`);
    }
  }
  if (!isRecord(value.config)) {
    throw new Error("[synchub] confirmed state is missing its rules config");
  }
  return value as unknown as RaidState;
}

export interface ConfirmedSubscription {
  spoke: ActiveSpokeSession;
  unsubscribe: () => void;
}

export interface SyncHubClient {
  prepare(options: PrepareRaidOptions): Promise<ActiveAirlockSession>;
  enterAndSubscribe(
    airlock: ActiveAirlockSession,
    onConfirmed: (tick: number, state: RaidState) => void,
  ): Promise<ConfirmedSubscription>;
  cancel(airlock: ActiveAirlockSession): Promise<{ refunded: boolean }>;
}

export function createSyncHubClient(api: ExtractionApi): SyncHubClient {
  return {
    async prepare(options: PrepareRaidOptions): Promise<ActiveAirlockSession> {
      if (!options.sector || options.sector.trim().length === 0) {
        throw new Error("[synchub] prepare requires a non-empty sector (released mode key)");
      }
      return api.prepareRaidAsync(options);
    },

    async enterAndSubscribe(
      airlock: ActiveAirlockSession,
      onConfirmed: (tick: number, state: RaidState) => void,
    ): Promise<ConfirmedSubscription> {
      const spoke = await airlock.enterAsync();
      const unsubscribe = spoke.onConfirmedTick((tick, state) => {
        onConfirmed(tick, parseConfirmedState(state));
      });
      return { spoke, unsubscribe };
    },

    async cancel(airlock: ActiveAirlockSession): Promise<{ refunded: boolean }> {
      return airlock.cancelAsync();
    },
  };
}

let sharedClientPromise: Promise<SyncHubClient> | undefined;

/**
 * The app-wide client. The SDK api module builds a browser singleton at
 * import time, so it loads lazily on first use. Initialization is shared
 * and idempotent; a failed init clears the cache so a later explicit
 * action can retry.
 */
export function getSyncHubClient(): Promise<SyncHubClient> {
  if (!sharedClientPromise) {
    sharedClientPromise = (async () => {
      const { default: RundotGameAPI } = await import("@series-inc/rundot-game-sdk/api");
      await RundotGameAPI.initializeAsync();
      return createSyncHubClient(RundotGameAPI.extraction);
    })().catch((error: unknown) => {
      sharedClientPromise = undefined;
      throw error;
    });
  }
  return sharedClientPromise;
}
