import type { PhysicsCheckpoint3D } from '@series-inc/rundot-syncplay/physics/3d';
import { decodeState, encodeState, encodeChecksumState } from './codec';
import type { YardInput } from './input';
import { setBodyNames, type OpenYardPhysicsWorld } from './physics';
import { createInitialYard } from './presets';
import type { YardState } from './state';
import { stepYard } from './step';

/**
 * The physics part of a save. A save made by this sim holds a native
 * checkpoint in its live world until it leaves the native window. Older saves
 * and saves decoded from bytes hold raw physics bytes until they are restored.
 */
export type YardPhysicsSave =
  | { readonly kind: 'checkpoint'; readonly checkpoint: PhysicsCheckpoint3D }
  | { readonly kind: 'bytes'; readonly bytes: Uint8Array };

export interface YardSave {
  readonly state: YardState;
  readonly physics: YardPhysicsSave;
}

/** Change storage without replacing the public save handle or its state. */
interface OwnedYardSave {
  readonly state: YardState;
  physics: YardPhysicsSave;
}

const MAX_NATIVE_CHECKPOINTS = 32;

/**
 * The live yard: one physics world that each tick steps in place, and the
 * state it is at. Recent saves use native checkpoints. Older saves use raw
 * physics bytes. Syncplay drives it through session.ts.
 */
export class YardSim {
  readonly physics: OpenYardPhysicsWorld;
  #state: YardState;
  #revision = 0n;
  #released = new WeakSet<YardSave>();
  #disposed = false;
  #nativeSaves = new Set<OwnedYardSave>();

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

  /** Goes up by one on each step or restore of the live world. */
  get revision(): bigint {
    return this.#revision;
  }

  step(inputs: readonly YardInput[]): YardState {
    this.#assertLive();
    this.#state = stepYard(this.physics, this.#state, inputs);
    this.#revision += 1n;
    return this.#state;
  }

  save(): YardSave {
    this.#assertLive();
    this.#makeCheckpointRoom();
    const checkpoint = this.physics.world.captureCheckpoint();
    const save: OwnedYardSave = { state: this.#state, physics: { kind: 'checkpoint', checkpoint } };
    this.#nativeSaves.add(save);
    return save;
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
    if (save.physics.kind === 'checkpoint' && !this.#disposed) {
      this.physics.world.releaseCheckpoint(save.physics.checkpoint);
      this.#nativeSaves.delete(save);
    }
    this.#released.add(save);
  }

  encode(save: YardSave): Uint8Array {
    this.#assertLive();
    this.#assertHeld(save);
    const checkpoint = save.physics.kind === 'checkpoint'
      ? this.physics.world.serializeCheckpoint(save.physics.checkpoint)
      : save.physics.bytes;
    return encodeState({ state: save.state, checkpoint });
  }

  /** Hash game fields and the SDK checkpoint digest without compressing a late-join packet each tick. */
  checksumBytes(save: YardSave): Uint8Array {
    this.#assertLive();
    this.#assertHeld(save);
    const checkpoint = save.physics.kind === 'checkpoint'
      ? save.physics.checkpoint : this.physics.world.importCheckpoint(save.physics.bytes);
    let bytes!: Uint8Array;
    try {
      const digestBytes = new Uint8Array(8);
      new DataView(digestBytes.buffer).setBigUint64(0, this.physics.world.digestCheckpoint(checkpoint));
      bytes = encodeChecksumState({ state: save.state, checkpoint: digestBytes });
    } finally {
      if (save.physics.kind === 'bytes') this.physics.world.releaseCheckpoint(checkpoint);
    }
    return bytes;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.physics.world.dispose();
    this.#nativeSaves.clear();
  }

  #makeCheckpointRoom(): void {
    if (this.#nativeSaves.size < MAX_NATIVE_CHECKPOINTS) return;
    // Set order follows capture order, including captures after a rollback.
    const oldest = this.#nativeSaves.values().next().value;
    if (!oldest || oldest.physics.kind !== 'checkpoint') throw new Error('WRECK_YARD_NATIVE_SAVE_INVALID');
    const bytes = this.physics.world.serializeCheckpoint(oldest.physics.checkpoint);
    this.physics.world.releaseCheckpoint(oldest.physics.checkpoint);
    oldest.physics = { kind: 'bytes', bytes };
    this.#nativeSaves.delete(oldest);
  }

  #assertLive(): void {
    if (this.#disposed) throw new Error('WRECK_YARD_SIM_DISPOSED');
  }

  #assertHeld(save: YardSave): void {
    if (this.#released.has(save)) throw new Error(`WRECK_YARD_SAVE_RELEASED: frame ${save.state.frame}`);
  }
}
