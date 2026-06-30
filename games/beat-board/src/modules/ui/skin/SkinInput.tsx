import type { InputHTMLAttributes, ReactNode } from 'react'
import { SkinIcon } from './SkinIcon'
import type { UiSkinIconName } from './types'

type SkinInputKind = 'text' | 'checkbox' | 'switch'

export interface SkinInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  kind?: SkinInputKind
  label?: ReactNode
  hint?: ReactNode
  leadingVisual?: ReactNode
  leadingIconName?: UiSkinIconName
}

export function SkinInput({
  kind = 'text',
  label,
  hint,
  leadingVisual,
  leadingIconName,
  checked,
  defaultChecked,
  style,
  ...rest
}: SkinInputProps) {
  const isDisabled = Boolean(rest.disabled)
  const resolvedLeadingVisual = leadingVisual ?? (leadingIconName ? <SkinIcon name={leadingIconName} size={18} /> : null)

  if (kind === 'checkbox') {
    return (
      <label className="ui-control" style={style}>
        <span className="ui-control__row">
          <input
            {...rest}
            {...(checked === undefined ? { defaultChecked } : { checked })}
            className="ui-control__native"
            type="checkbox"
          />
          <span
            className="ui-checkbox"
            data-ui-renderer-backed="false"
            data-ui-renderer-mode="css-theme"
            data-ui-skin-role="input.checkbox"
          >
            <span className="ui-checkbox__check">
              <SkinIcon name="check" size={14} />
            </span>
          </span>
          {label ? <span className="ui-control__label">{label}</span> : null}
        </span>
        {hint ? <span className="ui-control__hint">{hint}</span> : null}
      </label>
    )
  }

  if (kind === 'switch') {
    return (
      <label className="ui-control" style={style}>
        <span className="ui-control__row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <input
            {...rest}
            {...(checked === undefined ? { defaultChecked } : { checked })}
            className="ui-control__native"
            type="checkbox"
          />
          {label ? <span className="ui-control__label">{label}</span> : <span />}
          <span
            className="ui-switch"
            data-ui-renderer-backed="false"
            data-ui-renderer-mode="css-theme"
            data-ui-skin-role="input.switch"
          >
            <span className="ui-switch__thumb" />
          </span>
        </span>
        {hint ? <span className="ui-control__hint">{hint}</span> : null}
      </label>
    )
  }

  return (
    <label className="ui-input" data-disabled={isDisabled ? 'true' : 'false'} style={style}>
      {label ? <span className="ui-input__label">{label}</span> : null}
      <span
        className="ui-input-shell"
        data-disabled={isDisabled ? 'true' : 'false'}
        data-ui-renderer-backed="false"
        data-ui-renderer-mode="css-theme"
        data-ui-skin-role="input.text"
      >
        <span className="ui-input-shell__content" data-has-leading-visual={resolvedLeadingVisual ? 'true' : 'false'}>
          {resolvedLeadingVisual ? <span className="ui-input__visual">{resolvedLeadingVisual}</span> : null}
          <input type="text" {...rest} className="ui-input__field" />
        </span>
      </span>
      {hint ? <span className="ui-input__hint">{hint}</span> : null}
    </label>
  )
}
