import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Slider } from '@modules/ui/skin/semantic'
import type { NumberTunableDescriptor } from '../registry'
import { resumePolling, suspendPolling } from '../polling'
import { useTunablePolling } from '../useTunablePolling'

export interface NumberControlProps {
  descriptor: NumberTunableDescriptor
}

function safeRead(descriptor: NumberTunableDescriptor): number {
  try {
    return descriptor.get()
  } catch (error) {
    RundotAPI.error(`tuning: get() threw for ${descriptor.id}`, { error })
    return descriptor.initialValue
  }
}

function safeWrite(descriptor: NumberTunableDescriptor, value: number): void {
  try {
    descriptor.set(value)
  } catch (error) {
    RundotAPI.error(`tuning: set() threw for ${descriptor.id}`, { error })
  }
}

export function NumberControl({ descriptor }: NumberControlProps) {
  const [value, setValue] = useState<number>(() => safeRead(descriptor))
  const draggingRef = useRef<boolean>(false)

  useEffect(() => {
    setValue(safeRead(descriptor))
  }, [descriptor])

  useEffect(() => {
    return () => {
      if (draggingRef.current) {
        resumePolling(descriptor.id)
        draggingRef.current = false
      }
    }
  }, [descriptor.id])

  const poll = useCallback(() => {
    setValue(safeRead(descriptor))
  }, [descriptor])
  useTunablePolling(descriptor.id, poll)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value)
    if (!Number.isFinite(next)) {
      return
    }
    setValue(next)
    safeWrite(descriptor, next)
  }

  const startDrag = () => {
    if (!draggingRef.current) {
      suspendPolling(descriptor.id)
      draggingRef.current = true
    }
  }

  const endDrag = () => {
    if (draggingRef.current) {
      resumePolling(descriptor.id)
      draggingRef.current = false
      setValue(safeRead(descriptor))
    }
  }

  return (
    <Slider
      data-testid={`tuning-control-${descriptor.id}`}
      label={descriptor.label}
      min={descriptor.min}
      max={descriptor.max}
      step={descriptor.step}
      value={value}
      showValue
      onChange={handleChange}
      onPointerDown={startDrag}
      onPointerUp={endDrag}
      onBlur={endDrag}
    />
  )
}
