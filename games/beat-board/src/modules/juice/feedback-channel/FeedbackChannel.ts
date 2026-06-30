// --- Types ---

export interface FeedbackEvent {
  channel: string | number;
  /** Intensity 0–1. Default: 1 */
  intensity?: number;
  /** Duration in ms */
  duration?: number;
  /** World-space position for range-based attenuation */
  position?: { x: number; y: number; z: number };
  /** Extensible payload */
  [key: string]: unknown;
}

export type FeedbackHandler = (event: FeedbackEvent) => void;

export interface FeedbackChannel {
  /** Emit a feedback event to all handlers on its channel. */
  emit(event: FeedbackEvent): void;
  /** Subscribe to a channel. Returns an unsubscribe function. */
  on(channel: string | number, handler: FeedbackHandler): () => void;
  /** Subscribe to a channel for a single event. Returns an unsubscribe function. */
  once(channel: string | number, handler: FeedbackHandler): () => void;
  /** Remove a specific handler, or all handlers on a channel if no handler given. */
  off(channel: string | number, handler?: FeedbackHandler): void;
  /** Remove all handlers on all channels. */
  clear(): void;
}

// --- Implementation ---

export function createFeedbackChannel(): FeedbackChannel {
  const listeners = new Map<string | number, Set<FeedbackHandler>>();

  function getOrCreate(channel: string | number): Set<FeedbackHandler> {
    let set = listeners.get(channel);
    if (!set) {
      set = new Set();
      listeners.set(channel, set);
    }
    return set;
  }

  const bus: FeedbackChannel = {
    emit(event: FeedbackEvent): void {
      const set = listeners.get(event.channel);
      if (set) {
        // Iterate a snapshot so handlers can safely unsubscribe during iteration
        const snapshot = [...set];
        for (const handler of snapshot) {
          handler(event);
        }
      }
      // Wildcard '*' handlers receive all events
      const wildcardSet = listeners.get('*');
      if (wildcardSet && event.channel !== '*') {
        const snapshot = [...wildcardSet];
        for (const handler of snapshot) {
          handler(event);
        }
      }
    },

    on(channel: string | number, handler: FeedbackHandler): () => void {
      const set = getOrCreate(channel);
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },

    once(channel: string | number, handler: FeedbackHandler): () => void {
      const wrapper: FeedbackHandler = (event) => {
        set.delete(wrapper);
        handler(event);
      };
      const set = getOrCreate(channel);
      set.add(wrapper);
      return () => {
        set.delete(wrapper);
      };
    },

    off(channel: string | number, handler?: FeedbackHandler): void {
      if (handler === undefined) {
        // Remove all handlers on this channel
        listeners.delete(channel);
      } else {
        const set = listeners.get(channel);
        if (set) {
          set.delete(handler);
        }
      }
    },

    clear(): void {
      listeners.clear();
    },
  };

  return bus;
}

// --- Global Singleton ---

let _globalBus: FeedbackChannel | null = null;

/** Lazy-initialized global feedback bus singleton. */
export function getGlobalFeedbackBus(): FeedbackChannel {
  if (!_globalBus) {
    _globalBus = createFeedbackChannel();
  }
  return _globalBus;
}

/** Reset the global bus. Use in test teardown for isolation. */
export function resetGlobalFeedbackBus(): void {
  _globalBus = null;
}
