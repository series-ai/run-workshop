/**
 * useRunbucksIcon — returns a stable React component that renders the
 * platform Runbucks currency icon.
 *
 * Per prd.md § Product Strategy "Runbucks display rule", the platform
 * currency icon is rendered at runtime via this hook; it is never a static
 * asset reference. The icon component returned here is referentially stable
 * across hook calls and re-renders so consumers (RunbucksPriceChip,
 * KitCard, PackPurchaseSheet, WelcomePackOffer) avoid re-mount thrash.
 *
 * Data source: `useRunbucksIconUrl()` from
 * `@modules/monetization/iap-purchase-flow/useRunbucksIcon` returns a
 * base64 data URL fetched once via `RundotAPI.iap.getCurrencyIcon()`.
 *
 * Fallback: when the platform URL is unresolved (loading, missing, or
 * failed), the component renders the renderer's semantic `coin` icon so
 * the chip layout never collapses.
 */
import { createElement } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '@modules/ui/skin'
import { useRunbucksIcon as useRunbucksIconUrl } from '@modules/monetization/iap-purchase-flow/useRunbucksIcon'

export interface RunbucksIconProps {
  size?: number
  'aria-hidden'?: boolean
  style?: CSSProperties
  className?: string
}

/**
 * The single, stable React component identity returned by
 * `useRunbucksIcon()`. Defined once at module scope so the reference is
 * shared across every hook call.
 */
function RunbucksIcon({ size = 14, style, className, ...rest }: RunbucksIconProps) {
  const url = useRunbucksIconUrl()
  const dataAttrs = {
    'data-testid': 'runbucks-icon',
    'data-runbucks-icon-source': 'hook',
  }

  if (url) {
    return createElement('img', {
      ...dataAttrs,
      ...rest,
      src: url,
      width: size,
      height: size,
      alt: '',
      style: {
        display: 'inline-block',
        verticalAlign: 'middle',
        ...style,
      },
      className,
    })
  }

  // Fallback: renderer-provided coin glyph wrapped so the testid + source
  // marker propagate up. Wrapping in a span is necessary because
  // `Icon` in the skin layer renders an SVG and we need the data
  // attributes on a stable host element.
  return createElement(
    'span',
    {
      ...dataAttrs,
      ...rest,
      style: { display: 'inline-flex', alignItems: 'center', ...style },
      className,
      'aria-hidden': true,
    },
    createElement(Icon, { name: 'coin', size, 'aria-hidden': true }),
  )
}

/**
 * Returns a stable React component reference for the Runbucks icon.
 *
 * The returned component reads its data via the underlying
 * `useRunbucksIcon` hook from the iap-purchase-flow module; consumers
 * should treat the return value as a regular component (e.g. `<Icon />`).
 */
export function useRunbucksIcon(): typeof RunbucksIcon {
  return RunbucksIcon
}
