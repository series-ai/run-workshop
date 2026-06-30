import { useEffect, useState, type ChangeEvent, type CSSProperties, type InputHTMLAttributes, type ReactNode } from 'react'
import { joinClassName } from './theme/classNames'

export interface SkinSliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type' | 'value' | 'defaultValue' | 'children'> {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  label?: ReactNode
  hint?: ReactNode
  showValue?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseNumericValue(value: number | readonly string[] | string | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

export function SkinSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  label,
  hint,
  showValue = false,
  className,
  disabled = false,
  onChange,
  style,
  ...rest
}: SkinSliderProps) {
  const initialValue = clamp(parseNumericValue(value ?? defaultValue, min), min, max)
  const [internalValue, setInternalValue] = useState(initialValue)
  const currentValue = value === undefined ? internalValue : clamp(value, min, max)
  const percent = max <= min ? 0 : ((currentValue - min) / (max - min)) * 100

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(clamp(value, min, max))
    }
  }, [max, min, value])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = clamp(Number(event.target.value), min, max)
    if (value === undefined) {
      setInternalValue(nextValue)
    }
    onChange?.(event)
  }

  return (
    <label
      className={joinClassName('ui-slider', className)}
      data-ui-renderer-backed="false"
      data-ui-renderer-mode="css-theme"
      data-ui-skin-role="progress.slider"
      style={style}
    >
      {label || showValue ? (
        <span className="ui-progress__meta">
          <span className="ui-slider__label">{label}</span>
          {showValue ? <span>{Math.round(currentValue)}</span> : null}
        </span>
      ) : null}
      <span
        className="ui-slider__shell"
        style={
          {
            '--ui-slider-percent': `${percent}%`,
            '--ui-slider-progress': `${percent / 100}`,
          } as CSSProperties
        }
      >
        <span className="ui-slider__track">
          <span className="ui-slider__bar">
            <span className="ui-slider__well" />
            <span className="ui-slider__fill-clip">
              <span className="ui-slider__fill" />
            </span>
          </span>
          <span className="ui-slider__thumb" />
        </span>
        <input
          {...rest}
          className="ui-slider__native"
          disabled={disabled}
          max={max}
          min={min}
          onChange={handleChange}
          step={step}
          type="range"
          value={currentValue}
        />
      </span>
      {hint ? <span className="ui-slider__hint">{hint}</span> : null}
    </label>
  )
}
