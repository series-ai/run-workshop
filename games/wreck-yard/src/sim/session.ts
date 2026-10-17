import {
  createInstalledRuntimeAdapter,
  decodeKinetixSessionConfig,
  encodeKinetixSessionConfig,
  kinetixRuntimeIdentitiesEqual,
  kinetixSessionConfigDigest,
  type KinetixRuntimeIdentity,
  type KinetixRuntimeLease,
  type OwnedKinetixRuntime,
} from '@series-inc/rundot-syncplay/core/runtime';
import generated from './identity.generated.json';
import type { YardInput } from './input';
import { CHECKPOINT_BUDGET } from './physics';
import { SESSION_CONFIG_SCHEMA, type YardSessionConfig } from './session-config';
import { YardSim, type YardSave } from './sim';
import type { YardState } from './state';

const productIdentity = generated.runtimeIdentity as KinetixRuntimeIdentity;

/** Keep the same input contract in the runner and room metadata. */
export const YARD_INPUT_OWNERSHIP = 'copy' as const;

export function yardIdentity(): KinetixRuntimeIdentity {
  return { ...productIdentity };
}

export function encodeYardSessionConfig(config: YardSessionConfig): Uint8Array {
  return encodeKinetixSessionConfig(SESSION_CONFIG_SCHEMA, { playerCount: config.playerCount });
}

export function decodeYardSessionConfig(bytes: Uint8Array): YardSessionConfig {
  const decoded = decodeKinetixSessionConfig(SESSION_CONFIG_SCHEMA, bytes);
  const playerCount = decoded['playerCount'];
  if (typeof playerCount !== 'number') throw new Error('WRECK_YARD_SESSION_CONFIG_INVALID');
  return { playerCount };
}

export type YardRuntime = OwnedKinetixRuntime<YardState, YardInput>;

/**
 * An owned runtime: Syncplay holds the full save history. The sim keeps recent
 * physics saves as native checkpoints and stores older saves as bytes.
 * The runner disposes the lease; that releases every save, then the world.
 */
export function createYardRuntime(identity: KinetixRuntimeIdentity, sessionConfigBytes: Uint8Array): KinetixRuntimeLease<YardRuntime> {
  if (!kinetixRuntimeIdentitiesEqual(identity, productIdentity)) {
    throw new Error('WRECK_YARD_RUNTIME_IDENTITY_MISMATCH');
  }
  const config = decodeYardSessionConfig(sessionConfigBytes);
  const sim = YardSim.create(config.playerCount);
  let lease: KinetixRuntimeLease<YardRuntime>;
  try {
    lease = createInstalledRuntimeAdapter<YardState, YardInput, never, YardState, YardSave>({
      identity,
      sessionConfigBytes,
      step: (inputs) => {
        sim.step(inputs);
      },
      stateStorage: {
        kind: 'owned',
        checkpointBudget: CHECKPOINT_BUDGET,
        captureState: () => sim.save(),
        restoreState: (save) => sim.restore(save),
        releaseState: (save) => sim.release(save),
        frameOf: (save) => save.state.frame,
        inspectState: (save) => save.state,
        serializeState: (save) => sim.encode(save),
        hydrateState: (frame, bytes) => {
          const save = YardSim.decode(bytes);
          if (save.state.frame !== frame) throw new Error(`WRECK_YARD_STATE_FRAME_MISMATCH: bytes ${save.state.frame}, expected ${frame}`);
          return save;
        },
        checksumStateBytes: (save) => sim.checksumBytes(save),
        readLiveRevision: () => sim.revision,
        projectState: (save) => save.state,
      },
    });
  } catch (error) {
    sim.dispose();
    throw error;
  }
  return {
    runtime: lease.runtime,
    dispose: async () => {
      try {
        await lease.dispose();
      } finally {
        sim.dispose();
      }
    },
  };
}

export interface YardRoomOptions {
  readonly inputOwnership: typeof YARD_INPUT_OWNERSHIP;
  readonly maxPlayers: number;
  readonly runtimeIdentity: KinetixRuntimeIdentity;
  readonly sessionConfigBytes: Uint8Array;
  readonly sessionConfigDigest: string;
}

export function yardRoomOptions(playerCount: number): YardRoomOptions {
  const sessionConfigBytes = encodeYardSessionConfig({ playerCount });
  return {
    inputOwnership: YARD_INPUT_OWNERSHIP,
    maxPlayers: playerCount,
    runtimeIdentity: yardIdentity(),
    sessionConfigBytes,
    sessionConfigDigest: kinetixSessionConfigDigest(sessionConfigBytes),
  };
}
