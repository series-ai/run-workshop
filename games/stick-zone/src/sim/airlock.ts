/**
 * @file airlock.ts
 * SyncHub staged admission adapter and dedicated ExfilController wrapper.
 */

import {
  ExfilController,
  CorridorPresentationInProgressError,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
} from '@series-inc/rundot-syncplay/extensions/hub';
import { SIM_CONFIG } from './config.js';

export {
  ExfilController,
  CorridorPresentationInProgressError,
  type ExfilState,
  type SettlementReceipt,
  verifyReceiptIntegrity,
};

export type IngressState =
  | { kind: 'idle' }
  | { kind: 'corridor_entered'; startedAtMs: number }
  | { kind: 'hydrating'; snapshotTick: number }
  | { kind: 'waiting_squad'; ackCount: number; targetSquadSize: number }
  | { kind: 'confirmed_active'; activationTick: number };

export class StagedIngressController {
  private state: IngressState = { kind: 'idle' };
  private clock: { now(): number };

  constructor(clock?: { now(): number }) {
    this.clock = clock ?? { now: () => Date.now() };
  }

  public getState(): IngressState {
    return this.state;
  }

  public enterCorridor(currentTick: number): boolean {
    if (currentTick > SIM_CONFIG.INGRESS_WINDOW_TICKS) {
      return false; // Ingress window closed
    }
    this.state = { kind: 'corridor_entered', startedAtMs: this.clock.now() };
    return true;
  }

  public startHydration(snapshotTick: number): void {
    if (this.state.kind !== 'corridor_entered') return;
    this.state = { kind: 'hydrating', snapshotTick };
  }

  public squadAck(ackCount: number, targetSquadSize: number): void {
    if (this.state.kind !== 'hydrating' && this.state.kind !== 'waiting_squad') return;
    this.state = { kind: 'waiting_squad', ackCount, targetSquadSize };
  }

  public activate(activationTick: number): void {
    this.state = { kind: 'confirmed_active', activationTick };
  }
}

export function createExfilController(clock?: { now(): number }): ExfilController {
  return new ExfilController({
    targetHoldTicks: SIM_CONFIG.EXFIL_HOLD_TICKS,
    corridorDurationMs: SIM_CONFIG.AIRLOCK_CORRIDOR_DURATION_MS,
    clock,
  });
}
