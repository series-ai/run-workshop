import { describe, it, expect, vi, beforeEach } from 'vitest'
import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { createAppLifecycle, type LifecycleState } from './AppLifecycle'

type LifecycleCallback = () => void

describe('AppLifecycle', () => {
  // Capture the SDK callback registrations so we can invoke them in tests.
  let sdkCallbacks: {
    onAwake: (() => void) | null
    onSleep: (() => void) | null
    onPause: (() => void) | null
    onResume: (() => void) | null
  }

  beforeEach(() => {
    sdkCallbacks = { onAwake: null, onSleep: null, onPause: null, onResume: null }

    vi.mocked(RundotAPI.lifecycles.onAwake).mockImplementation((cb: LifecycleCallback) => {
      sdkCallbacks.onAwake = cb
    })
    vi.mocked(RundotAPI.lifecycles.onSleep).mockImplementation((cb: LifecycleCallback) => {
      sdkCallbacks.onSleep = cb
    })
    vi.mocked(RundotAPI.lifecycles.onPause).mockImplementation((cb: LifecycleCallback) => {
      sdkCallbacks.onPause = cb
    })
    vi.mocked(RundotAPI.lifecycles.onResume).mockImplementation((cb: LifecycleCallback) => {
      sdkCallbacks.onResume = cb
    })
  })

  it('starts in initializing state', () => {
    const lifecycle = createAppLifecycle()
    expect(lifecycle.getState()).toBe('initializing')
  })

  describe('register()', () => {
    it('wires all four SDK lifecycle callbacks', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      expect(RundotAPI.lifecycles.onAwake).toHaveBeenCalledOnce()
      expect(RundotAPI.lifecycles.onSleep).toHaveBeenCalledOnce()
      expect(RundotAPI.lifecycles.onPause).toHaveBeenCalledOnce()
      expect(RundotAPI.lifecycles.onResume).toHaveBeenCalledOnce()
    })

    it('returns a cleanup function', () => {
      const lifecycle = createAppLifecycle()
      const cleanup = lifecycle.register()
      expect(typeof cleanup).toBe('function')
    })
  })

  describe('state transitions from SDK callbacks', () => {
    it('onAwake sets state to playing', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      sdkCallbacks.onAwake!()
      expect(lifecycle.getState()).toBe('playing')
    })

    it('onSleep sets state to hidden', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      sdkCallbacks.onSleep!()
      expect(lifecycle.getState()).toBe('hidden')
    })

    it('onPause sets state to paused', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      sdkCallbacks.onPause!()
      expect(lifecycle.getState()).toBe('paused')
    })

    it('onResume sets state to playing', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      // First pause, then resume
      sdkCallbacks.onPause!()
      expect(lifecycle.getState()).toBe('paused')

      sdkCallbacks.onResume!()
      expect(lifecycle.getState()).toBe('playing')
    })
  })

  describe('user callbacks', () => {
    it('fires user onAwake callback on awake', () => {
      const lifecycle = createAppLifecycle()
      const onAwake = vi.fn()
      lifecycle.register({ onAwake })

      sdkCallbacks.onAwake!()
      expect(onAwake).toHaveBeenCalledOnce()
    })

    it('fires user onSleep callback on sleep', () => {
      const lifecycle = createAppLifecycle()
      const onSleep = vi.fn()
      lifecycle.register({ onSleep })

      sdkCallbacks.onSleep!()
      expect(onSleep).toHaveBeenCalledOnce()
    })

    it('fires user onPause callback on pause', () => {
      const lifecycle = createAppLifecycle()
      const onPause = vi.fn()
      lifecycle.register({ onPause })

      sdkCallbacks.onPause!()
      expect(onPause).toHaveBeenCalledOnce()
    })

    it('fires user onResume callback on resume', () => {
      const lifecycle = createAppLifecycle()
      const onResume = vi.fn()
      lifecycle.register({ onResume })

      sdkCallbacks.onResume!()
      expect(onResume).toHaveBeenCalledOnce()
    })
  })

  describe('onStateChange', () => {
    it('fires onStateChange on every SDK-driven transition', () => {
      const lifecycle = createAppLifecycle()
      const onStateChange = vi.fn()
      lifecycle.register({ onStateChange })

      sdkCallbacks.onAwake!()
      expect(onStateChange).toHaveBeenLastCalledWith('playing')

      sdkCallbacks.onSleep!()
      expect(onStateChange).toHaveBeenLastCalledWith('hidden')

      sdkCallbacks.onPause!()
      expect(onStateChange).toHaveBeenLastCalledWith('paused')

      sdkCallbacks.onResume!()
      expect(onStateChange).toHaveBeenLastCalledWith('playing')

      expect(onStateChange).toHaveBeenCalledTimes(4)
    })

    it('fires onStateChange on manual setState()', () => {
      const lifecycle = createAppLifecycle()
      const onStateChange = vi.fn()
      lifecycle.register({ onStateChange })

      lifecycle.setState('ready')
      expect(onStateChange).toHaveBeenCalledWith('ready')
    })
  })

  describe('cleanup / disposed flag', () => {
    it('suppresses SDK callbacks after cleanup', () => {
      const lifecycle = createAppLifecycle()
      const onAwake = vi.fn()
      const onStateChange = vi.fn()
      const cleanup = lifecycle.register({ onAwake, onStateChange })

      cleanup()

      // SDK fires awake after dispose — should be suppressed
      sdkCallbacks.onAwake!()
      expect(onAwake).not.toHaveBeenCalled()
      expect(onStateChange).not.toHaveBeenCalled()
      // State should remain unchanged (initializing)
      expect(lifecycle.getState()).toBe('initializing')
    })

    it('suppresses all four SDK callbacks after cleanup', () => {
      const lifecycle = createAppLifecycle()
      const onSleep = vi.fn()
      const onPause = vi.fn()
      const onResume = vi.fn()
      const cleanup = lifecycle.register({ onSleep, onPause, onResume })

      cleanup()

      sdkCallbacks.onSleep!()
      sdkCallbacks.onPause!()
      sdkCallbacks.onResume!()

      expect(onSleep).not.toHaveBeenCalled()
      expect(onPause).not.toHaveBeenCalled()
      expect(onResume).not.toHaveBeenCalled()
    })

    it('setState becomes a no-op after cleanup', () => {
      const lifecycle = createAppLifecycle()
      const onStateChange = vi.fn()
      const cleanup = lifecycle.register({ onStateChange })

      lifecycle.setState('ready')
      expect(lifecycle.getState()).toBe('ready')

      cleanup()

      lifecycle.setState('playing')
      // State should not change after disposal
      expect(lifecycle.getState()).toBe('ready')
      // onStateChange should have been called once (for 'ready'), not for 'playing'
      expect(onStateChange).toHaveBeenCalledTimes(1)
    })
  })

  describe('double-register guard', () => {
    it('second register() call is a no-op', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.register()

      // Clear mock call counts
      vi.mocked(RundotAPI.lifecycles.onAwake).mockClear()
      vi.mocked(RundotAPI.lifecycles.onSleep).mockClear()
      vi.mocked(RundotAPI.lifecycles.onPause).mockClear()
      vi.mocked(RundotAPI.lifecycles.onResume).mockClear()

      lifecycle.register()

      // SDK methods should NOT have been called again
      expect(RundotAPI.lifecycles.onAwake).not.toHaveBeenCalled()
      expect(RundotAPI.lifecycles.onSleep).not.toHaveBeenCalled()
      expect(RundotAPI.lifecycles.onPause).not.toHaveBeenCalled()
      expect(RundotAPI.lifecycles.onResume).not.toHaveBeenCalled()
    })

    it('second register() returns the same cleanup function', () => {
      const lifecycle = createAppLifecycle()
      const cleanup1 = lifecycle.register()
      const cleanup2 = lifecycle.register({ onAwake: vi.fn() })

      expect(cleanup1).toBe(cleanup2)
    })
  })

  describe('setState() for manual transitions', () => {
    it('sets state to ready', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.setState('ready')
      expect(lifecycle.getState()).toBe('ready')
    })

    it('sets state to playing', () => {
      const lifecycle = createAppLifecycle()
      lifecycle.setState('playing')
      expect(lifecycle.getState()).toBe('playing')
    })

    it('allows arbitrary transitions', () => {
      const lifecycle = createAppLifecycle()
      const states: LifecycleState[] = ['ready', 'playing', 'paused', 'hidden', 'playing']

      for (const s of states) {
        lifecycle.setState(s)
        expect(lifecycle.getState()).toBe(s)
      }
    })
  })
})
