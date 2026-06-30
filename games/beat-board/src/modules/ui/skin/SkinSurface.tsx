import { createElement } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import type { UiSkinRole, UiSkinState } from './types'

type SkinSurfaceElement = 'article' | 'button' | 'div' | 'header' | 'label' | 'nav' | 'section' | 'span'

export interface SkinSurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: SkinSurfaceElement
  skinRole: UiSkinRole
  surfaceState?: UiSkinState
  children?: ReactNode
  disabled?: boolean
  type?: 'button' | 'reset' | 'submit'
  htmlFor?: string
}

function joinClassName(...values: Array<string | undefined>): string | undefined {
  const joined = values.filter(Boolean).join(' ').trim()
  return joined || undefined
}

export function SkinSurface({
  as = 'div',
  skinRole,
  surfaceState = 'default',
  className,
  children,
  disabled = false,
  style,
  ...rest
}: SkinSurfaceProps) {
  return createElement(
    as,
    {
      ...rest,
      className: joinClassName('ui-surface', className),
      'data-ui-renderer-backed': 'false',
      'data-ui-renderer-mode': 'css-theme',
      'data-ui-skin-role': skinRole,
      'data-ui-surface-state': surfaceState,
      'data-ui-disabled': disabled ? 'true' : 'false',
      ...(as === 'button' ? { disabled } : {}),
      style: style as CSSProperties,
    },
    children,
  )
}
