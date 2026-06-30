import RundotAPI from '@series-inc/rundot-game-sdk/api';

export type LifecycleState = 'initializing' | 'ready' | 'playing' | 'hidden' | 'paused';

export interface LifecycleCallbacks {
  onAwake?: () => void;
  onSleep?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onStateChange?: (state: LifecycleState) => void;
}

export interface LifecycleService {
  getState(): LifecycleState;
  register(callbacks?: LifecycleCallbacks): () => void;
  setState(state: LifecycleState): void;
}

export function createAppLifecycle(): LifecycleService {
  let state: LifecycleState = 'initializing';
  let disposed = false;
  let registered = false;
  let callbacks: LifecycleCallbacks | undefined;
  let cleanupFn: (() => void) | undefined;

  function transition(next: LifecycleState): void {
    if (disposed) {
      return;
    }

    state = next;
    callbacks?.onStateChange?.(next);
  }

  const service: LifecycleService = {
    getState() {
      return state;
    },

    register(nextCallbacks?: LifecycleCallbacks): () => void {
      if (registered) {
        return cleanupFn ?? (() => undefined);
      }

      registered = true;
      callbacks = nextCallbacks;

      RundotAPI.lifecycles.onAwake(() => {
        if (disposed) {
          return;
        }

        transition('playing');
        callbacks?.onAwake?.();
      });

      RundotAPI.lifecycles.onSleep(() => {
        if (disposed) {
          return;
        }

        transition('hidden');
        callbacks?.onSleep?.();
      });

      RundotAPI.lifecycles.onPause(() => {
        if (disposed) {
          return;
        }

        transition('paused');
        callbacks?.onPause?.();
      });

      RundotAPI.lifecycles.onResume(() => {
        if (disposed) {
          return;
        }

        transition('playing');
        callbacks?.onResume?.();
      });

      cleanupFn = () => {
        disposed = true;
      };

      return cleanupFn;
    },

    setState(next: LifecycleState): void {
      transition(next);
    },
  };

  return service;
}
