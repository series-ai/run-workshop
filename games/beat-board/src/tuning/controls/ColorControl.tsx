import RundotAPI from '@series-inc/rundot-game-sdk/api'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import type { ColorTunableDescriptor } from '../registry'
import { resumePolling, suspendPolling } from '../polling'
import { normalizeHex } from '../validation'
import { useTunablePolling } from '../useTunablePolling'

export interface ColorControlProps {
  descriptor: ColorTunableDescriptor
}

interface ColorParts {
  rgb: string // '#rrggbb'
  alpha: number // 0-255
}

function splitHex(hex: string, alpha: boolean): ColorParts {
  const lowered = hex.toLowerCase()
  if (alpha && lowered.length === 9) {
    return {
      rgb: lowered.slice(0, 7),
      alpha: Number.parseInt(lowered.slice(7), 16),
    }
  }
  return { rgb: lowered.slice(0, 7), alpha: 255 }
}

function combineHex(parts: ColorParts, alpha: boolean): string {
  if (!alpha) return parts.rgb
  return `${parts.rgb}${parts.alpha.toString(16).padStart(2, '0')}`
}

function safeRead(descriptor: ColorTunableDescriptor): string {
  try {
    const raw = descriptor.get()
    const normalized = normalizeHex(raw, { alpha: descriptor.alpha ?? false })
    return normalized ?? descriptor.initialValue
  } catch (error) {
    RundotAPI.error(`tuning: get() threw for ${descriptor.id}`, { error })
    return descriptor.initialValue
  }
}

function safeWrite(descriptor: ColorTunableDescriptor, value: string): void {
  const normalized = normalizeHex(value, { alpha: descriptor.alpha ?? false })
  if (normalized === null) {
    RundotAPI.error(
      `tuning: refused to write malformed hex ${value} to ${descriptor.id}`,
    )
    return
  }
  try {
    descriptor.set(normalized)
  } catch (error) {
    RundotAPI.error(`tuning: set() threw for ${descriptor.id}`, { error })
  }
}

export function ColorControl({ descriptor }: ColorControlProps) {
  const alpha = descriptor.alpha ?? false
  const [value, setValue] = useState<string>(() => safeRead(descriptor))
  const [open, setOpen] = useState<boolean>(false)
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

  const togglePopover = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next) {
        suspendPolling(descriptor.id)
        suspendedRef.current = true
      } else {
        resumePolling(descriptor.id)
        suspendedRef.current = false
        setValue(safeRead(descriptor))
      }
      return next
    })
  }, [descriptor])

  const parts = splitHex(value, alpha)

  const handleRgbChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rgb = event.target.value.toLowerCase()
    const nextValue = combineHex({ rgb, alpha: parts.alpha }, alpha)
    setValue(nextValue)
    safeWrite(descriptor, nextValue)
  }

  const handleAlphaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextAlpha = Number.parseInt(event.target.value, 10)
    if (!Number.isFinite(nextAlpha)) return
    const nextValue = combineHex(
      { rgb: parts.rgb, alpha: Math.max(0, Math.min(255, nextAlpha)) },
      alpha,
    )
    setValue(nextValue)
    safeWrite(descriptor, nextValue)
  }

  return (
    <div className="tuning-control tuning-control--color">
      <button
        type="button"
        className="tuning-color__swatch"
        data-testid={`tuning-control-${descriptor.id}`}
        data-color-open={open ? 'true' : 'false'}
        aria-label={`${descriptor.label} color swatch`}
        aria-expanded={open}
        onClick={togglePopover}
        style={{ backgroundColor: parts.rgb }}
      >
        <span className="tuning-color__label">{descriptor.label}</span>
        <span className="tuning-color__value">{value}</span>
      </button>
      {open ? (
        <div
          className="tuning-color__popover"
          data-testid={`tuning-color-popover-${descriptor.id}`}
          role="dialog"
          aria-label={`${descriptor.label} color picker`}
        >
          <input
            type="color"
            value={parts.rgb}
            onChange={handleRgbChange}
            data-testid={`tuning-color-input-${descriptor.id}`}
          />
          {alpha ? (
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={parts.alpha}
              onChange={handleAlphaChange}
              data-testid={`tuning-color-alpha-${descriptor.id}`}
              aria-label="Opacity"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
