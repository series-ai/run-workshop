import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { Input } from '@modules/ui/skin/semantic'
import type { StringTunableDescriptor } from '../registry'
import { resumePolling, suspendPolling } from '../polling'
import { useTunablePolling } from '../useTunablePolling'

export interface StringControlProps {
  descriptor: StringTunableDescriptor
}

function safeRead(descriptor: StringTunableDescriptor): string {
  try {
    return descriptor.get()
  } catch (error) {
    RundotAPI.error(`tuning: get() threw for ${descriptor.id}`, { error })
    return descriptor.initialValue
  }
}

function safeWrite(descriptor: StringTunableDescriptor, value: string): void {
  try {
    descriptor.set(value)
  } catch (error) {
    RundotAPI.error(`tuning: set() threw for ${descriptor.id}`, { error })
  }
}

export function StringControl({ descriptor }: StringControlProps) {
  const [value, setValue] = useState<string>(() => safeRead(descriptor))
  const [draft, setDraft] = useState<string>(value)
  const focusedRef = useRef<boolean>(false)

  useEffect(() => {
    const next = safeRead(descriptor)
    setValue(next)
    setDraft(next)
  }, [descriptor])

  useEffect(() => {
    return () => {
      if (focusedRef.current) {
        resumePolling(descriptor.id)
        focusedRef.current = false
      }
    }
  }, [descriptor.id])

  const poll = useCallback(() => {
    if (focusedRef.current) return
    const next = safeRead(descriptor)
    setValue(next)
    setDraft(next)
  }, [descriptor])
  useTunablePolling(descriptor.id, poll)

  if (descriptor.options && descriptor.options.length > 0) {
    return (
      <Input.Select
        data-testid={`tuning-control-${descriptor.id}`}
        label={descriptor.label}
        value={value}
        onChange={(event) => {
          const next = event.target.value
          if (!descriptor.options?.includes(next)) {
            RundotAPI.error(
              `tuning: invalid option "${next}" for ${descriptor.id}`,
              { options: descriptor.options },
            )
            return
          }
          setValue(next)
          safeWrite(descriptor, next)
        }}
      >
        {descriptor.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Input.Select>
    )
  }

  const commit = () => {
    if (draft === value) {
      return
    }
    setValue(draft)
    safeWrite(descriptor, draft)
  }

  return (
    <Input
      data-testid={`tuning-control-${descriptor.id}`}
      label={descriptor.label}
      value={draft}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        setDraft(event.target.value)
      }}
      onFocus={() => {
        if (!focusedRef.current) {
          suspendPolling(descriptor.id)
          focusedRef.current = true
        }
      }}
      onBlur={() => {
        commit()
        if (focusedRef.current) {
          resumePolling(descriptor.id)
          focusedRef.current = false
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          commit()
        }
      }}
    />
  )
}
