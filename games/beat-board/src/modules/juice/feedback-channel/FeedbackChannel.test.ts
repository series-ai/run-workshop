import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createFeedbackChannel,
  getGlobalFeedbackBus,
  resetGlobalFeedbackBus,
  type FeedbackEvent,
} from './FeedbackChannel';

function requireAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`);
  }
  return item;
}

describe('FeedbackChannel', () => {
  describe('createFeedbackChannel', () => {
    it('emit delivers to matching channel handler', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('hit', handler);

      bus.emit({ channel: 'hit' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ channel: 'hit' });
    });

    it('emit does NOT deliver to different channel handler', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('hit', handler);

      bus.emit({ channel: 'miss' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('multiple handlers on same channel all called', () => {
      const bus = createFeedbackChannel();
      const h1 = vi.fn();
      const h2 = vi.fn();
      const h3 = vi.fn();
      bus.on('boom', h1);
      bus.on('boom', h2);
      bus.on('boom', h3);

      bus.emit({ channel: 'boom' });

      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
      expect(h3).toHaveBeenCalledTimes(1);
    });

    it('on() returns unsubscribe function that works', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      const unsub = bus.on('hit', handler);

      bus.emit({ channel: 'hit' });
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();
      bus.emit({ channel: 'hit' });
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('once() handler fires exactly once then auto-unsubscribes', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.once('hit', handler);

      bus.emit({ channel: 'hit' });
      bus.emit({ channel: 'hit' });
      bus.emit({ channel: 'hit' });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('off(channel, handler) removes specific handler', () => {
      const bus = createFeedbackChannel();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('hit', h1);
      bus.on('hit', h2);

      bus.off('hit', h1);
      bus.emit({ channel: 'hit' });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('off(channel) removes all handlers on channel', () => {
      const bus = createFeedbackChannel();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('hit', h1);
      bus.on('hit', h2);

      bus.off('hit');
      bus.emit({ channel: 'hit' });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('clear() removes everything', () => {
      const bus = createFeedbackChannel();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('hit', h1);
      bus.on('boom', h2);

      bus.clear();
      bus.emit({ channel: 'hit' });
      bus.emit({ channel: 'boom' });

      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it('unsubscribe after clear does not throw', () => {
      const bus = createFeedbackChannel();
      const unsub = bus.on('hit', vi.fn());
      bus.clear();

      expect(() => unsub()).not.toThrow();
    });

    it('event payload (intensity, duration, position) passed through correctly', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('shake', handler);

      const event: FeedbackEvent = {
        channel: 'shake',
        intensity: 0.7,
        duration: 300,
        position: { x: 1, y: 2, z: 3 },
      };
      bus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
      const received = requireAt(requireAt(handler.mock.calls, 0), 0) as FeedbackEvent;
      expect(received.intensity).toBe(0.7);
      expect(received.duration).toBe(300);
      expect(received.position).toEqual({ x: 1, y: 2, z: 3 });
    });

    it('string channels work', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('my-channel', handler);

      bus.emit({ channel: 'my-channel' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('number channels work', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on(42, handler);

      bus.emit({ channel: 42 });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('custom properties in event are accessible', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('custom', handler);

      bus.emit({ channel: 'custom', damage: 50, element: 'fire', combo: true });

      const received = requireAt(requireAt(handler.mock.calls, 0), 0) as FeedbackEvent;
      expect(received['damage']).toBe(50);
      expect(received['element']).toBe('fire');
      expect(received['combo']).toBe(true);
    });

    it('once() unsubscribe function works before event fires', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      const unsub = bus.once('hit', handler);

      unsub();
      bus.emit({ channel: 'hit' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('wildcard * handler receives events from any channel', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('*', handler);

      bus.emit({ channel: 'hit' });
      bus.emit({ channel: 'boom' });
      bus.emit({ channel: 42 });

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenCalledWith({ channel: 'hit' });
      expect(handler).toHaveBeenCalledWith({ channel: 'boom' });
      expect(handler).toHaveBeenCalledWith({ channel: 42 });
    });

    it('wildcard handler and channel-specific handler both fire', () => {
      const bus = createFeedbackChannel();
      const wildcardHandler = vi.fn();
      const specificHandler = vi.fn();
      bus.on('*', wildcardHandler);
      bus.on('hit', specificHandler);

      bus.emit({ channel: 'hit' });

      expect(wildcardHandler).toHaveBeenCalledTimes(1);
      expect(specificHandler).toHaveBeenCalledTimes(1);
    });

    it('wildcard handler does not fire when emitting on * channel itself', () => {
      const bus = createFeedbackChannel();
      const handler = vi.fn();
      bus.on('*', handler);

      bus.emit({ channel: '*' });

      // Should fire once via direct match, not via wildcard logic
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('handler unsubscribing during emit does not affect other handlers', () => {
      const bus = createFeedbackChannel();
      const results: string[] = [];
      // eslint-disable-next-line prefer-const
      let unsub2: () => void;

      bus.on('test', () => {
        results.push('first');
        unsub2(); // unsubscribe second handler during first handler's execution
      });
      unsub2 = bus.on('test', () => {
        results.push('second');
      });
      bus.on('test', () => {
        results.push('third');
      });

      bus.emit({ channel: 'test' });

      // All three should fire because we iterate a snapshot
      expect(results).toEqual(['first', 'second', 'third']);
    });
  });

  describe('global singleton', () => {
    beforeEach(() => {
      resetGlobalFeedbackBus();
    });

    it('getGlobalFeedbackBus returns same instance', () => {
      const a = getGlobalFeedbackBus();
      const b = getGlobalFeedbackBus();

      expect(a).toBe(b);
    });

    it('resetGlobalFeedbackBus creates fresh instance', () => {
      const a = getGlobalFeedbackBus();
      const handler = vi.fn();
      a.on('test', handler);

      resetGlobalFeedbackBus();
      const b = getGlobalFeedbackBus();

      expect(a).not.toBe(b);

      // Old handler should not fire on new bus
      b.emit({ channel: 'test' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
