import type { ComponentType, ReactNode, SVGProps } from 'react'
import type { UiSkinIconName, UiSkinIconAssetId } from '../types'

export interface UiSkinResolvedIconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  size?: number
}

export type UiSkinResolvedIconComponent = ComponentType<UiSkinResolvedIconProps>

export interface UiSkinIconPack {
  id: UiSkinIconAssetId
  label: string
  icons: Readonly<Partial<Record<UiSkinIconName, UiSkinResolvedIconComponent>>>
}

export function createUiSkinSvgIcon(
  body: ReactNode,
  options: {
    viewBox?: string
    fill?: string
    strokeWidth?: number
  } = {},
): UiSkinResolvedIconComponent {
  const {
    viewBox = '0 0 24 24',
    fill = 'none',
    strokeWidth = 1.8,
  } = options

  return function UiSkinSvgIcon({
    size,
    width = size ?? 18,
    height = size ?? 18,
    color = 'currentColor',
    ...rest
  }: UiSkinResolvedIconProps) {
    return (
      <svg
        aria-hidden="true"
        fill={fill}
        height={height}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        viewBox={viewBox}
        width={width}
        {...rest}
      >
        {body}
      </svg>
    )
  }
}

export function createUiSkinIconPack(definition: UiSkinIconPack): UiSkinIconPack {
  return Object.freeze(definition)
}

export function adaptUiSkinExternalIcon<Props extends Record<string, unknown>>(
  Component: ComponentType<Props>,
  options: {
    extraProps?: Readonly<Partial<Props>>
  } = {},
): UiSkinResolvedIconComponent {
  const { extraProps } = options

  return function UiSkinExternalIcon({
    size,
    width = size ?? 18,
    height = size ?? 18,
    color = 'currentColor',
    ...rest
  }: UiSkinResolvedIconProps) {
    const resolvedSize = size ?? (typeof width === 'number' && width === height ? width : 18)

    return (
      <Component
        aria-hidden="true"
        color={color}
        height={height}
        size={resolvedSize}
        width={width}
        {...(extraProps as Props)}
        {...(rest as unknown as Props)}
      />
    )
  }
}
