import {
  createInstalledRuntimeAdapter,
  decodeKinetixSessionConfig,
  encodeKinetixSessionConfig,
  kinetixRuntimeIdentitiesEqual,
  kinetixSessionConfigDigest,
  type KinetixRuntime,
  type KinetixRuntimeIdentity,
} from '@series-inc/rundot-syncplay/core/runtime';
import generated from './identity.generated.json';
import { decodeState, encodeState } from './codec';
import type { YardInput } from './input';
import { createInitialState } from './presets';
import { SESSION_CONFIG_SCHEMA, type YardSessionConfig } from './session-config';
import type { YardState } from './state';
import { stepYard } from './step';

const productIdentity = generated.runtimeIdentity as KinetixRuntimeIdentity;

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

export type YardRuntime = KinetixRuntime<YardState, YardInput>;

export function createYardRuntime(identity: KinetixRuntimeIdentity, sessionConfigBytes: Uint8Array): YardRuntime {
  if (!kinetixRuntimeIdentitiesEqual(identity, productIdentity)) {
    throw new Error('WRECK_YARD_RUNTIME_IDENTITY_MISMATCH');
  }
  const config = decodeYardSessionConfig(sessionConfigBytes);
  let state = createInitialState(config.playerCount);
  return createInstalledRuntimeAdapter<YardState, YardInput>({
    identity,
    sessionConfigBytes,
    captureState: () => state,
    restoreState: (restored) => {
      state = restored;
    },
    frameOf: (candidate) => candidate.frame,
    capturedStateIsDetached: true,
    step: (inputs) => {
      state = stepYard(state, inputs);
    },
    serializeState: encodeState,
    hydrateState: (_frame, bytes) => decodeState(bytes),
    checksumBytes: encodeState,
    projectState: (presented) => presented,
  });
}

export interface YardRoomOptions {
  readonly maxPlayers: number;
  readonly runtimeIdentity: KinetixRuntimeIdentity;
  readonly sessionConfigBytes: Uint8Array;
  readonly sessionConfigDigest: string;
}

export function yardRoomOptions(playerCount: number): YardRoomOptions {
  const sessionConfigBytes = encodeYardSessionConfig({ playerCount });
  return {
    maxPlayers: playerCount,
    runtimeIdentity: yardIdentity(),
    sessionConfigBytes,
    sessionConfigDigest: kinetixSessionConfigDigest(sessionConfigBytes),
  };
}
