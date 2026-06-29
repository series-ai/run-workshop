import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import type { Vec3TunableDescriptor, Vec3Value } from '../registry'
import { resumePolling, suspendPolling } from '../polling'
import { clampAndSnap } from '../validation'
import { useTunablePolling } from '../useTunablePolling'

export interface Vec3ControlProps {
  descriptor: Vec3TunableDescriptor
}

const AXES = ['x', 'y', 'z'] as const

function safeRead(descriptor: Vec3TunableDescriptor): Vec3Value {
  try {
    const raw = descriptor.get()
    if (!raw || typeof raw !== 'object') {
      return descriptor.initialValue
    }
    return {
      x: Number.isFinite(raw.x) ? raw.x : descriptor.initialValue.x,
      y: Number.isFinite(raw.y) ? raw.y : descriptor.initialValue.y,
      z: Number.isFinite(raw.z) ? raw.z : descriptor.initialValue.z,
    }
  } catch (error) {
    RundotAPI.error(`tuning: get() threw for ${descriptor.id}`, { error })
    return descriptor.initialValue
  }
}

function safeWrite(descriptor: Vec3TunableDescriptor, value: Vec3Value): void {
  const snapped: Vec3Value = {
    x: clampAndSnap(value.x, descriptor),
    y: clampAndSnap(value.y, descriptor),
    z: clampAndSnap(value.z, descriptor),
  }
  try {
    descriptor.set(snapped)
  } catch (error) {
    RundotAPI.error(`tuning: set() threw for ${descriptor.id}`, { error })
  }
}

export function Vec3Control({ descriptor }: Vec3ControlProps) {
  const [value, setValue] = useState<Vec3Value>(() => safeRead(descriptor))
  const suspendedRef = useRef<boolean>(false)

  useEffect(() => {
    setValue(safeRead(descriptor))
  }, [descriptor])

  useEffect(() => {
    return () => {
      if (suspendedRef.current) {
        resumePolling(descriptor.id)
        suspendedRef.current = false
      }
    }
  }, [descriptor.id])

  const poll = useCallback(() => {
    setValue(safeRead(descriptor))
  }, [descriptor])
  useTunablePolling(descriptor.id, poll)

  const commit = (next: Vec3Value) => {
    setValue(next)
    safeWrite(descriptor, next)
  }

  const startEditing = () => {
    if (!suspendedRef.current) {
      suspendPolling(descriptor.id)
      suspendedRef.current = true
    }
  }

  const stopEditing = () => {
    if (suspendedRef.current) {
      resumePolling(descriptor.id)
      suspendedRef.current = false
    }
    setValue(safeRead(descriptor))
  }

  return (
    <div
      className="tuning-control tuning-control--vec3"
      data-testid={`tuning-control-${descriptor.id}`}
    >
      <div className="tuning-control__label">{descriptor.label}</div>
      <div className="tuning-control__vec3-row">
        {AXES.map((axis) => (
          <label key={axis} className="tuning-control__vec3-field">
            <span className="tuning-control__vec3-axis">{axis}</span>
            <input
              type="number"
              data-testid={`tuning-vec3-${descriptor.id}-${axis}`}
              min={descriptor.min}
              max={descriptor.max}
              step={descriptor.step}
              value={value[axis]}
              onFocus={startEditing}
              onBlur={stopEditing}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const raw = Number(event.target.value)
                if (!Number.isFinite(raw)) return
                commit({ ...value, [axis]: raw })
              }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
