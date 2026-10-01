import type { PhysicsCheckpoint3D } from '@series-inc/rundot-syncplay/physics/3d';
import { decodeState, encodeState } from './codec';
import type { YardInput } from './input';
import { readWorldState, setBodyNames, type OpenYardPhysicsWorld } from './physics';
import { createInitialYard } from './presets';
import type { YardState } from './state';
import { stepYard } from './step';

/**
 * The physics part of a save. A save made by this sim holds a native
 * checkpoint in its live world; a save decoded from bytes (late join, replay)
 * holds the bytes until it is restored.
 */
export type YardPhysicsSave =
  | { readonly kind: 'checkpoint'; readonly checkpoint: PhysicsCheckpoint3D }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array };

export interface YardSave {
  readonly state: YardState;
  readonly physics: YardPhysicsSave;
}

/**
 * The live yard: one physics world that each tick steps in place, and the
 * state it is at. Rollback restores a save; nothing serializes the world
 * unless a peer needs the bytes. Syncplay drives it through session.ts.
 */
export class YardSim {
  readonly physics: OpenYardPhysicsWorld;
  #state: YardState;
  #revision = 0n;
  #released = new WeakSet<YardSave>();
  #disposed = false;

  private constructor(physics: OpenYardPhysicsWorld, state: YardState) {
    this.physics = physics;
    this.#state = state;
  }

  static create(playerCount: number): YardSim {
    const { physics, state } = createInitialYard(playerCount);
    return new YardSim(physics, state);
  }

  static decode(bytes: Uint8Array): YardSave {
    const { state, checkpoint } = decodeState(bytes);
    return { state, physics: { kind: 'bytes', bytes: checkpoint } };
  }

  get state(): YardState {
    this.#assertLive();
    return this.#state;
  }

  /** Goes up by one on each change to the live world: a step, a restore, or an edit. */
  get revision(): bigint {
    return this.#revision;
  }

  step(inputs: readonly YardInput[]): YardState {
    this.#assertLive();
    this.#state = stepYard(this.physics, this.#state, inputs);
    this.#revision += 1n;
    return this.#state;
  }

  /** Changes the live world outside a tick (tests and debug tools), then reads the new body motion. */
  edit(change: (physics: OpenYardPhysicsWorld) => void): void {
    this.#assertLive();
    change(this.physics);
    this.#state = { ...this.#state, world: { ...readWorldState(this.physics), fluidInteractions: this.#state.world.fluidInteractions } };
    this.#revision += 1n;
  }

  save(): YardSave {
    this.#assertLive();
    return { state: this.#state, physics: { kind: 'checkpoint', checkpoint: this.physics.world.captureCheckpoint() } };
  }

  restore(save: YardSave): void {
    this.#assertLive();
    this.#assertHeld(save);
    const { physics } = save;
    switch (physics.kind) {
      case 'checkpoint':
        this.physics.world.restoreCheckpoint(physics.checkpoint);
        break;
      case 'bytes':
        this.physics.world.restore(physics.bytes);
        break;
      default: {
        const unreachable: never = physics;
        throw new Error(`WRECK_YARD_SAVE_KIND_INVALID: ${String(unreachable)}`);
      }
    }
    setBodyNames(this.physics, save.state.world.bodyIds);
    this.#state = save.state;
    this.#revision += 1n;
  }

  release(save: YardSave): void {
    this.#assertHeld(save);
    this.#released.add(save);
    if (save.physics.kind === 'checkpoint' && !this.#disposed) this.physics.world.releaseCheckpoint(save.physics.checkpoint);
  }

  encode(save: YardSave): Uint8Array {
    this.#assertLive();
    this.#assertHeld(save);
    const checkpoint = save.physics.kind === 'checkpoint'
      ? this.physics.world.serializeCheckpoint(save.physics.checkpoint)
      : save.physics.bytes;
    return encodeState({ state: save.state, checkpoint });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.physics.world.dispose();
  }

  #assertLive(): void {
    if (this.#disposed) throw new Error('WRECK_YARD_SIM_DISPOSED');
  }

  #assertHeld(save: YardSave): void {
    if (this.#released.has(save)) throw new Error(`WRECK_YARD_SAVE_RELEASED: frame ${save.state.frame}`);
  }
}
