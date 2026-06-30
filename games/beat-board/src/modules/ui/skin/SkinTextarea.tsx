import type { CSSProperties, ReactNode, TextareaHTMLAttributes } from 'react'
import { SkinIcon } from './SkinIcon'
import type { UiSkinIconName } from './types'

export interface SkinTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  leadingVisual?: ReactNode
  leadingIconName?: UiSkinIconName
}

export function SkinTextarea({
  label,
  hint,
  leadingVisual,
  leadingIconName,
  rows = 4,
  style,
  ...rest
}: SkinTextareaProps) {
  const isDisabled = Boolean(rest.disabled)
  const resolvedLeadingVisual = leadingVisual ?? (leadingIconName ? <SkinIcon name={leadingIconName} size={18} /> : null)
  const textareaStyle: CSSProperties = {
    width: '100%',
    minHeight: '120px',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    ...style,
  }

  return (
    <label className="ui-input" data-disabled={isDisabled ? 'true' : 'false'} style={{ width: '100%' }}>
      {label ? <span className="ui-input__label">{label}</span> : null}
      <span
        className="ui-input-shell"
        data-disabled={isDisabled ? 'true' : 'false'}
        data-ui-renderer-backed="false"
        data-ui-renderer-mode="css-theme"
        data-ui-skin-role="input.textarea"
        style={textareaStyle}
      >
        <span
          className="ui-input-shell__content"
          data-has-leading-visual={resolvedLeadingVisual ? 'true' : 'false'}
          style={{ alignItems: resolvedLeadingVisual ? 'flex-start' : 'stretch' }}
        >
          {resolvedLeadingVisual ? <span className="ui-input__visual">{resolvedLeadingVisual}</span> : null}
          <textarea
            {...rest}
            className="ui-textarea__field"
            rows={rows}
            style={{
              minHeight: '96px',
              resize: 'vertical',
            }}
          />
        </span>
      </span>
      {hint ? (
        <span className="ui-input__hint">
          {hint}
        </span>
      ) : null}
    </label>
  )
}
