import { useEffect } from 'react'
import { registerTunable } from './registry'
import type { TunableDescriptor } from './registry'

/**
 * Register a tunable from inside a React component (including R3F scenes).
 *
 * The hook re-registers whenever the descriptor id changes. Other descriptor
 * fields are captured via closure and are expected to stay stable across
 * renders for the same id; if you need to live-swap a getter or setter for
 * the same id, unmount/remount with a new id.
 */
export function useTunable(descriptor: TunableDescriptor): void {
  useEffect(() => {
    const dispose = registerTunable(descriptor)
    return () => {
      dispose()
    }
    // Re-register on id change. Other descriptor fields are closed over the
    // current render; callers are expected to keep id+type stable for a given
    // logical tunable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor.id])
}
