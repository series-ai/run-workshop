/**
 * Keyboard and button camera controls for a 3D viewer (WCAG: pointer-only
 * orbit is not enough). `ViewerFrame` is the focusable, labelled wrapper:
 * ←/→ orbit, ↑/↓ tilt, +/− zoom, 0 resets. `CameraCommands` lives inside the
 * Canvas and applies the commands to the default camera around the orbit
 * target.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Spherical, Vector3 } from 'three'

export type CameraCommand = 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset'

export interface CommandBus {
  queue: CameraCommand[]
}

export function useCommandBus(): CommandBus {
  return useRef<CommandBus>({ queue: [] }).current
}

const KEYS: Record<string, CameraCommand> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  '+': 'in',
  '=': 'in',
  '-': 'out',
  '0': 'reset',
}

export function ViewerFrame({ bus, label, onReset, children }: { bus: CommandBus; label: string; onReset: () => void; children: ReactNode }) {
  const send = useCallback(
    (command: CameraCommand) => {
      if (command === 'reset') onReset()
      else bus.queue.push(command)
    },
    [bus, onReset],
  )
  const onKeyDown = (event: KeyboardEvent) => {
    const command = KEYS[event.key]
    if (!command) return
    event.preventDefault()
    send(command)
  }
  return (
    <div className="viewer-frame" role="group" aria-label={`${label}. Arrow keys orbit, plus and minus zoom, 0 resets.`} tabIndex={0} onKeyDown={onKeyDown}>
      {children}
      <div className="camera-buttons" role="toolbar" aria-label="Camera">
        <button type="button" className="toggle" aria-label="Orbit left" onClick={() => send('left')}>⟲</button>
        <button type="button" className="toggle" aria-label="Orbit right" onClick={() => send('right')}>⟳</button>
        <button type="button" className="toggle" aria-label="Zoom in" onClick={() => send('in')}>+</button>
        <button type="button" className="toggle" aria-label="Zoom out" onClick={() => send('out')}>−</button>
        <button type="button" className="toggle" aria-label="Reset view" onClick={() => send('reset')}>⌂</button>
      </div>
    </div>
  )
}

const STEP = Math.PI / 12

export function CameraCommands({ bus }: { bus: CommandBus }) {
  const { camera, controls } = useThree()
  useFrame(() => {
    const command = bus.queue.shift()
    if (!command) return
    const orbit = controls as { target?: Vector3; update?: () => void } | null
    const target = orbit?.target ?? new Vector3()
    const offset = camera.position.clone().sub(target)
    const s = new Spherical().setFromVector3(offset)
    if (command === 'left') s.theta -= STEP
    if (command === 'right') s.theta += STEP
    if (command === 'up') s.phi = Math.max(0.1, s.phi - STEP)
    if (command === 'down') s.phi = Math.min(Math.PI - 0.1, s.phi + STEP)
    if (command === 'in') s.radius *= 0.8
    if (command === 'out') s.radius *= 1.25
    camera.position.copy(target).add(new Vector3().setFromSpherical(s))
    camera.lookAt(target)
    orbit?.update?.()
  })
  return null
}
