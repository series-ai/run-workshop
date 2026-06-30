import RundotAPI from '@series-inc/rundot-game-sdk/api'
import { useEffect, useState } from 'react'
import { Switch } from '@modules/ui/skin/semantic'
import type { BooleanTunableDescriptor } from '../registry'

export interface BooleanControlProps {
  descriptor: BooleanTunableDescriptor
}

function safeRead(descriptor: BooleanTunableDescriptor): boolean {
  try {
    return descriptor.get()
  } catch (error) {
    RundotAPI.error(`tuning: get() threw for ${descriptor.id}`, { error })
    return descriptor.initialValue
  }
}

function safeWrite(descriptor: BooleanTunableDescriptor, value: boolean): void {
  try {
    descriptor.set(value)
  } catch (error) {
    RundotAPI.error(`tuning: set() threw for ${descriptor.id}`, { error })
  }
}

export function BooleanControl({ descriptor }: BooleanControlProps) {
  const [value, setValue] = useState<boolean>(() => safeRead(descriptor))

  useEffect(() => {
    setValue(safeRead(descriptor))
  }, [descriptor])

  return (
    <label
      className="tuning-control tuning-control--boolean"
      data-testid={`tuning-control-${descriptor.id}`}
    >
      <span className="tuning-control__label">{descriptor.label}</span>
      <Switch
        checked={value}
        onChange={(event) => {
          const next = event.target.checked
          setValue(next)
          safeWrite(descriptor, next)
        }}
      />
    </label>
  )
}
