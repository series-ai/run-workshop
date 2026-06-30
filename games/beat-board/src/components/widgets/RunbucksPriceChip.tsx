/**
 * RunbucksPriceChip — inline pill rendering "{Runbucks icon} {amount}".
 *
 * Reused on KitCard, KitDetail purchase CTAs, PackPurchaseSheet, and
 * WelcomePackOffer banners. Per prd.md § Product Strategy "Runbucks
 * display rule" + § Component Translation Table § RunbucksPriceChip:
 *
 *   - currency icon left, amount right
 *   - icon comes from `useRunbucksIcon()` (platform-resolved at runtime)
 *   - amount formatted via `formatBalance()` (handles K/M/B abbreviation)
 *   - static — no animation in v1
 *
 * Variants:
 *   - default → standard inline price chip
 *   - cta     → bold weight for purchase CTAs ("Get Pack — 299 {icon}")
 *   - wallet  → muted treatment for balance display ("Your balance: N")
 *
 * data-skin-role coverage: chip.currency (via SkinChip.Currency).
 */

import type { CSSProperties } from 'react'
import { Chip } from '@modules/ui/skin'
import { formatBalance } from '@modules/ui/currency-indicator/CurrencyIndicator'
import { useRunbucksIcon } from '../../lib/use-runbucks-icon'

export type RunbucksPriceChipVariant = 'default' | 'cta' | 'wallet'

export interface RunbucksPriceChipProps {
  amount: number
  /** Visual treatment. Defaults to 'default'. */
  variant?: RunbucksPriceChipVariant
  /** Optional override; defaults to "Runbucks". */
  label?: string
}

const AMOUNT_STYLE_BY_VARIANT: Record<RunbucksPriceChipVariant, CSSProperties> = {
  default: { fontWeight: 600 },
  cta: { fontWeight: 800 },
  wallet: { fontWeight: 500, opacity: 0.75 },
}

const ICON_SIZE_BY_VARIANT: Record<RunbucksPriceChipVariant, number> = {
  default: 14,
  cta: 16,
  wallet: 14,
}

export function RunbucksPriceChip({
  amount,
  variant = 'default',
  label = 'Runbucks',
}: RunbucksPriceChipProps) {
  const RunbucksIcon = useRunbucksIcon()
  const formatted = formatBalance(amount)
  const ariaLabel = `${formatted} ${label}`

  return (
    <Chip.Currency
      data-testid="runbucks-price-chip"
      data-runbucks-variant={variant}
      aria-label={ariaLabel}
    >
      <RunbucksIcon size={ICON_SIZE_BY_VARIANT[variant]} aria-hidden />
      <span
        data-testid="runbucks-price-chip-amount"
        style={AMOUNT_STYLE_BY_VARIANT[variant]}
      >
        {formatted}
      </span>
    </Chip.Currency>
  )
}
