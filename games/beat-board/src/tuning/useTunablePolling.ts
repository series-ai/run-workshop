import { useEffect, useRef } from 'react'
import { isPollingSuspended } from './polling'

const DEFAULT_INTERVAL_MS = 250

/**
 * Drive a per-tunable value refresh on a coarse interval. Per PRD req 23 we
 * never use requestAnimationFrame here. The caller owns the get() callback and
 * handles the returned value (typically by writing it to local state). Polling
 * is skipped while the tunable id is flagged via suspendPolling() from
 * ./polling so in-progress user edits don't fight the interval tick.
 */
export function useTunablePolling(
  id: string,
  poll: () => void,
  options: { intervalMs?: number; enabled?: boolean } = {},
): void {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options
  const pollRef = useRef(poll)

  useEffect(() => {
    pollRef.current = poll
  }, [poll])

  useEffect(() => {
    if (!enabled) return undefined
    const handle = setInterval(() => {
      if (isPollingSuspended(id)) return
      pollRef.current()
    }, intervalMs)
    return () => {
      clearInterval(handle)
    }
  }, [id, enabled, intervalMs])
}

export const TUNING_POLLING_INTERVAL_MS = DEFAULT_INTERVAL_MS
