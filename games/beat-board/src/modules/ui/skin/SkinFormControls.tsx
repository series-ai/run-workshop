import type { ChangeEventHandler, ReactNode, SelectHTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import { SkinInput } from './SkinInput'
import type { UiSkinIconName } from './types'

export interface SkinSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode
  hint?: ReactNode
  leadingVisual?: ReactNode
  leadingIconName?: UiSkinIconName
}

export function SkinSelect({ label, hint, children, leadingVisual, leadingIconName, style, ...rest }: SkinSelectProps) {
  const isDisabled = Boolean(rest.disabled)
  const resolvedLeadingVisual = leadingVisual ?? (leadingIconName ? <SkinIcon name={leadingIconName} size={18} /> : null)

  return (
    <label className="ui-input" data-disabled={isDisabled ? 'true' : 'false'} style={style}>
      {label ? <span className="ui-input__label">{label}</span> : null}
      <span
        className="ui-input-shell"
        data-disabled={isDisabled ? 'true' : 'false'}
        data-ui-renderer-backed="false"
        data-ui-renderer-mode="css-theme"
        data-ui-skin-role="input.select"
      >
        <span className="ui-input-shell__content ui-input-shell__content--select" data-has-leading-visual={resolvedLeadingVisual ? 'true' : 'false'}>
          {resolvedLeadingVisual ? <span className="ui-input__visual">{resolvedLeadingVisual}</span> : null}
          <select {...rest} className="ui-select__field">
            {children}
          </select>
          <span className="ui-select__chevron">
            <SkinIcon name="back" size={14} />
          </span>
        </span>
      </span>
      {hint ? <span className="ui-input__hint">{hint}</span> : null}
    </label>
  )
}

export interface SkinCheckboxProps {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  label?: ReactNode
  hint?: ReactNode
  name?: string
  onChange?: ChangeEventHandler<HTMLInputElement>
}

export function SkinCheckbox(props: SkinCheckboxProps) {
  return <SkinInput {...props} kind="checkbox" />
}

export interface SkinRadioProps extends SkinCheckboxProps {
  value?: string
}

export function SkinRadio({
  checked,
  defaultChecked,
  disabled = false,
  label,
  hint,
  name,
  onChange,
  value,
}: SkinRadioProps) {
  return (
    <label className="ui-control">
      <span className="ui-control__row">
        <input
          {...(checked === undefined ? { defaultChecked } : { checked })}
          className="ui-control__native"
          disabled={disabled}
          name={name}
          onChange={onChange}
          type="radio"
          value={value}
        />
        <span
          className="ui-radio"
          data-ui-renderer-backed="false"
          data-ui-renderer-mode="css-theme"
          data-ui-skin-role="input.radio"
        >
          <span className="ui-radio__dot" />
        </span>
        {label ? <span className="ui-control__label">{label}</span> : null}
      </span>
      {hint ? <span className="ui-control__hint">{hint}</span> : null}
    </label>
  )
}

export interface SkinSwitchProps extends SkinCheckboxProps {}

export function SkinSwitch(props: SkinSwitchProps) {
  return <SkinInput {...props} kind="switch" />
}
