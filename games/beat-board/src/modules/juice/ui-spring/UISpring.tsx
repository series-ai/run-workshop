import { useState, useRef, useCallback, useEffect } from 'react'

// --- Spring internals (local, not imported cross-module) ---

interface InternalSpring {
  value: number
  velocity: number
  target: number
}

const DEFAULT_DAMPING = 0.5
const DEFAULT_FREQUENCY = 3
const SETTLE_THRESHOLD = 0.001

function updateSpring(s: InternalSpring, damping: number, frequency: number, dt: number): void {
  const omega = 2 * Math.PI * frequency
  const maxDt = 0.5 / omega
  const steps = Math.ceil(dt / maxDt)
  const subDt = dt / steps

  for (let i = 0; i < steps; i++) {
    const displacement = s.value - s.target
    const springForce = -omega * omega * displacement
    const dampingForce = -2 * damping * omega * s.velocity
    s.velocity += (springForce + dampingForce) * subDt
    s.value += s.velocity * subDt
  }

  if (Math.abs(s.value - s.target) < SETTLE_THRESHOLD && Math.abs(s.velocity) < SETTLE_THRESHOLD) {
    s.value = s.target
    s.velocity = 0
  }
}

function isSpringSettled(s: InternalSpring): boolean {
  return (
    Math.abs(s.value - s.target) < SETTLE_THRESHOLD && Math.abs(s.velocity) < SETTLE_THRESHOLD
  )
}

// --- Hook ---

export interface UISpringConfig {
  damping?: number
  frequency?: number
  clampMin?: number
  clampMax?: number
}

export interface UISpringTarget {
  x?: number
  y?: number
  scale?: number
  rotate?: number
  opacity?: number
}

export interface UseUISpringReturn {
  style: React.CSSProperties
  moveTo(target: UISpringTarget): void
  bump(velocity: { x?: number; y?: number; scale?: number; rotate?: number }): void
  isSettled: boolean
}

export function useUISpring(config?: UISpringConfig): UseUISpringReturn {
  const damping = config?.damping ?? DEFAULT_DAMPING
  const frequency = config?.frequency ?? DEFAULT_FREQUENCY

  const springsRef = useRef({
    x: { value: 0, velocity: 0, target: 0 } as InternalSpring,
    y: { value: 0, velocity: 0, target: 0 } as InternalSpring,
    scale: { value: 1, velocity: 0, target: 1 } as InternalSpring,
    rotate: { value: 0, velocity: 0, target: 0 } as InternalSpring,
    opacity: { value: 1, velocity: 0, target: 1 } as InternalSpring,
  })

  const rafRef = useRef(0)
  const lastTimeRef = useRef(0)
  const runningRef = useRef(false)

  const [styleState, setStyleState] = useState<React.CSSProperties>({
    transform: 'translate(0px, 0px) scale(1) rotate(0deg)',
    opacity: 1,
  })
  const [settled, setSettled] = useState(true)

  const computeStyle = useCallback((): React.CSSProperties => {
    const s = springsRef.current
    return {
      transform: `translate(${s.x.value}px, ${s.y.value}px) scale(${s.scale.value}) rotate(${s.rotate.value}deg)`,
      opacity: s.opacity.value,
    }
  }, [])

  const tick = useCallback(
    (now: number) => {
      if (!runningRef.current) return

      const dt = lastTimeRef.current === 0 ? 1 / 60 : (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      const s = springsRef.current
      updateSpring(s.x, damping, frequency, dt)
      updateSpring(s.y, damping, frequency, dt)
      updateSpring(s.scale, damping, frequency, dt)
      updateSpring(s.rotate, damping, frequency, dt)
      updateSpring(s.opacity, damping, frequency, dt)

      const allSettled =
        isSpringSettled(s.x) &&
        isSpringSettled(s.y) &&
        isSpringSettled(s.scale) &&
        isSpringSettled(s.rotate) &&
        isSpringSettled(s.opacity)

      setStyleState(computeStyle())
      setSettled(allSettled)

      if (allSettled) {
        runningRef.current = false
        lastTimeRef.current = 0
      } else {
        rafRef.current = requestAnimationFrame(tick)
      }
    },
    [damping, frequency, computeStyle],
  )

  const startLoop = useCallback(() => {
    if (!runningRef.current) {
      runningRef.current = true
      lastTimeRef.current = 0
      setSettled(false)
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      runningRef.current = false
    }
  }, [])

  const moveTo = useCallback(
    (target: UISpringTarget) => {
      const s = springsRef.current
      if (target.x !== undefined) s.x.target = target.x
      if (target.y !== undefined) s.y.target = target.y
      if (target.scale !== undefined) s.scale.target = target.scale
      if (target.rotate !== undefined) s.rotate.target = target.rotate
      if (target.opacity !== undefined) s.opacity.target = target.opacity
      startLoop()
    },
    [startLoop],
  )

  const bump = useCallback(
    (velocity: { x?: number; y?: number; scale?: number; rotate?: number }) => {
      const s = springsRef.current
      if (velocity.x !== undefined) s.x.velocity += velocity.x
      if (velocity.y !== undefined) s.y.velocity += velocity.y
      if (velocity.scale !== undefined) s.scale.velocity += velocity.scale
      if (velocity.rotate !== undefined) s.rotate.velocity += velocity.rotate
      startLoop()
    },
    [startLoop],
  )

  return { style: styleState, moveTo, bump, isSettled: settled }
}
