import { forwardRef, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react'
import { UI_GEOMETRY_CONTRACT, type UiLayoutGap, type UiResponsiveGridKind, type UiResponsiveGridMin } from './theme/geometry-contract'

type LayoutElement = 'div' | 'section' | 'nav' | 'header' | 'footer' | 'main' | 'ul' | 'ol'
type LayoutAlign = 'start' | 'center' | 'end' | 'stretch'
type LayoutJustify = 'start' | 'center' | 'end' | 'between'

interface BaseLayoutProps extends Omit<ComponentPropsWithoutRef<'div'>, 'as'> {
  as?: LayoutElement
  children?: ReactNode
  space?: UiLayoutGap
}

export interface StackProps extends BaseLayoutProps {
  align?: LayoutAlign
}

export interface ClusterProps extends BaseLayoutProps {
  align?: Exclude<LayoutAlign, 'stretch'>
  justify?: LayoutJustify
}

export interface ActionBarProps extends BaseLayoutProps {
  align?: Exclude<LayoutAlign, 'stretch'>
  justify?: LayoutJustify
}

export interface ResponsiveGridProps extends BaseLayoutProps {
  kind?: UiResponsiveGridKind
  min?: UiResponsiveGridMin
  align?: LayoutAlign
}

const GRID_MIN_BY_KIND = UI_GEOMETRY_CONTRACT.responsiveGridKindMin

function cx(...parts: Array<string | undefined>): string | undefined {
  const className = parts.filter(Boolean).join(' ')
  return className.length > 0 ? className : undefined
}

function layoutProps(
  primitive: 'stack' | 'cluster' | 'action-bar' | 'responsive-grid',
  className: string | undefined,
  baseClassName: string,
) {
  return {
    className: cx('ui-layout', baseClassName, className),
    'data-ui-layout': primitive,
    'data-layout-primitive': primitive,
  }
}

function renderLayout(
  as: LayoutElement | undefined,
  props: ComponentPropsWithoutRef<'div'>,
) {
  const Element = (as ?? 'div') as ElementType
  return <Element {...props} />
}

export const Stack = forwardRef<HTMLElement, StackProps>(function Stack(
  { as, className, children, space = 'md', align = 'stretch', ...props },
  ref,
) {
  return renderLayout(as, {
    ...props,
    ...layoutProps('stack', className, 'ui-stack'),
    ref,
    'data-space': space,
    'data-align': align,
    children,
  } as ComponentPropsWithoutRef<'div'>)
})
export const Cluster = forwardRef<HTMLElement, ClusterProps>(function Cluster(
  { as, className, children, space = 'md', align = 'center', justify = 'start', ...props },
  ref,
) {
  return renderLayout(as, {
    ...props,
    ...layoutProps('cluster', className, 'ui-cluster'),
    ref,
    'data-space': space,
    'data-align': align,
    'data-justify': justify,
    children,
  } as ComponentPropsWithoutRef<'div'>)
})

export const ActionBar = forwardRef<HTMLElement, ActionBarProps>(function ActionBar(
  { as, className, children, space = 'md', align = 'center', justify = 'between', ...props },
  ref,
) {
  return renderLayout(as, {
    ...props,
    ...layoutProps('action-bar', className, 'ui-action-bar'),
    ref,
    'data-space': space,
    'data-align': align,
    'data-justify': justify,
    children,
  } as ComponentPropsWithoutRef<'div'>)
})

export const ResponsiveGrid = forwardRef<HTMLElement, ResponsiveGridProps>(function ResponsiveGrid(
  { as, className, children, space = 'md', kind = 'card', min, align = 'stretch', ...props },
  ref,
) {
  const resolvedMin = min ?? GRID_MIN_BY_KIND[kind]
  return renderLayout(as, {
    ...props,
    ...layoutProps('responsive-grid', className, 'ui-responsive-grid'),
    ref,
    'data-space': space,
    'data-grid-kind': kind,
    'data-grid-min': resolvedMin,
    'data-align': align,
    children,
  } as ComponentPropsWithoutRef<'div'>)
})
