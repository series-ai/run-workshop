import type { KinetixSeatState } from '@series-inc/rundot-syncplay/core/runtime';
import { createInitialPlayer, type PlayerState } from './state';

/** Apply the seat state supplied for this simulation frame. */
export function applyPlayerSeats(players: readonly PlayerState[], seats: readonly KinetixSeatState[]): readonly PlayerState[] {
  if (seats.length === 0) return players;
  const bySlot = new Map<number, KinetixSeatState>();
  for (const seat of seats) {
    if (!Number.isInteger(seat.slot) || seat.slot < 0 || seat.slot >= players.length || bySlot.has(seat.slot)) {
      throw new Error('WRECK_YARD_SEATS_INVALID: invalid or duplicate slot');
    }
    if (!Number.isSafeInteger(seat.controlEpoch) || seat.controlEpoch < 0) {
      throw new Error('WRECK_YARD_SEATS_INVALID: invalid control epoch');
    }
    bySlot.set(seat.slot, seat);
  }
  if (bySlot.size !== players.length) throw new Error('WRECK_YARD_SEATS_INVALID: missing slot');
  return players.map((player) => {
    const seat = bySlot.get(player.slot)!;
    const active = seat.kind === 'human';
    if (player.active === active && player.controlEpoch === seat.controlEpoch) return player;
    return { ...createInitialPlayer(player.slot), active, controlEpoch: seat.controlEpoch };
  });
}
