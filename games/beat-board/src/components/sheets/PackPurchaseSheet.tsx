/**
 * PackPurchaseSheet — modal sheet for the Runbucks pack purchase CTA.
 *
 * Issue beat-board-15-pack-purchase-sheet owns this file.
 *
 * PRD references:
 *   - prd.md § Screen: PackPurchaseSheet — layout, copy, and interactions
 *   - prd.md § IAP Pricing Table — Runbucks prices (299/499/1499)
 *   - prd.md § Monetization Analytics — iap_purchase_started/complete/failed,
 *     first_purchase, currency_spent
 *
 * Layout (top → bottom):
 *   1. Drag handle (tap to dismiss) + close X button (top-right).
 *   2. Hero art panel (~120pt tall) sourced from pack metadata gradient.
 *   3. Pack name (title) + "What's inside" subtle line.
 *   4. Cluster: price chip (cta variant) + wallet chip (wallet variant).
 *   5. Optional inline error banner (insufficient balance / generic error).
 *   6. Button.Primary "Confirm purchase" — disabled-with-spinner during SDK call.
 *   7. Button.Ghost "Add Runbucks" — only when wallet < price (top-up entry).
 *   8. Button.Ghost "Cancel" — dismisses without invoking SDK.
 *
 * The actual SDK call + success side-effects are owned by
 * `src/systems/iap-purchase-flow-adapter.ts`. This component is the
 * presentation surface only.
 */

import { useState } from 'react'
import {
  Background,
  Button,
  Cluster,
  Label,
  ModalOverlay,
  NavClose,
  Panel,
  Stack,
} from '@modules/ui/skin'
import { RunbucksPriceChip } from '../widgets/RunbucksPriceChip'
import { useWalletStore } from '../../stores/walletStore'
import { useKitsStore } from '../../stores/kitsStore'
import { iapPurchaseFlowAdapter } from '../../systems/iap-purchase-flow-adapter'

export interface PackPurchaseSheetProps {
  /** BeatBoard pack id (entitlement key + active-kit target). */
  packId: string
  /** Display name shown in the sheet title and the success toast. */
  packName: string
  /** SDK product id passed to `RundotAPI.iap.spendCurrency`. */
  productId: string
  /** Resolved Runbucks price (299, 499, or 1499 per prd.md § IAP Pricing). */
  priceRunbucks: number
  /** "What's inside" tagline, e.g. "32 pads · 8 layers · BPM 80–95". */
  whatsInside: string
  /** Called when the sheet should dismiss (handle, X, cancel, or success). */
  onClose: () => void
}

interface UiError {
  reason: 'insufficient_balance' | 'error' | 'cancelled'
  message: string
}

export function PackPurchaseSheet({
  packId,
  packName,
  productId,
  priceRunbucks,
  whatsInside,
  onClose,
}: PackPurchaseSheetProps) {
  const walletBalance = useWalletStore((s) => s.balance)
  const kit = useKitsStore((s) => s.kits[packId])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<UiError | null>(null)

  const insufficient = walletBalance < priceRunbucks
  const showAddRunbucks = insufficient || error?.reason === 'insufficient_balance'

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await iapPurchaseFlowAdapter.purchase({
        productId,
        priceRunbucks,
        packId,
        packName,
      })
      if (result.ok) {
        onClose()
        return
      }
      setError({ reason: result.reason, message: errorMessage(result) })
    } finally {
      setBusy(false)
    }
  }

  const handleAddRunbucks = () => {
    void iapPurchaseFlowAdapter.openStore()
  }

  const handleCancel = () => {
    if (busy) return
    onClose()
  }

  const heroGradient = kit?.heroGradient ?? ['#cdb8ff', '#7e92e8']

  return (
    <ModalOverlay
      open
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      width="default"
      data-testid="pack-purchase-sheet"
    >
      <Panel.Modal
        data-testid="pack-purchase-sheet-panel"
        data-skin-role="panel.modal"
      >
        <Stack space="md">
          {/* Top affordances: drag handle (left) + close X (right). */}
          <Cluster justify="between" align="center">
            <button
              type="button"
              data-testid="pack-purchase-sheet-handle"
              aria-label="Dismiss"
              onClick={onClose}
              style={{
                width: 48,
                height: 6,
                borderRadius: 3,
                background: 'var(--ui-color-border, rgba(0,0,0,0.2))',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
            />
            <NavClose
              data-testid="pack-purchase-close"
              onClick={onClose}
              aria-label="Close pack purchase sheet"
            />
          </Cluster>

          {/* Hero art. */}
          <div
            data-testid="pack-purchase-sheet-hero"
            data-skin-role="panel.hero"
            aria-hidden
            style={{
              height: 120,
              borderRadius: 'var(--ui-radius-lg, 12px)',
              backgroundImage: `linear-gradient(135deg, ${heroGradient[0]}, ${heroGradient[1]})`,
            }}
          >
            <Background />
          </div>

          {/* Pack name + "What's inside". */}
          <Stack space="xs">
            <Label.Title data-testid="pack-purchase-name">{packName}</Label.Title>
            <Label.Section data-testid="pack-purchase-whats-inside">
              {whatsInside}
            </Label.Section>
          </Stack>

          {/* Price + wallet chips. */}
          <Cluster space="sm" align="center" justify="between">
            <span data-testid="pack-purchase-price-chip">
              <RunbucksPriceChip amount={priceRunbucks} variant="cta" />
            </span>
            <Cluster space="xs" align="center">
              <Label.Section>Your balance:</Label.Section>
              <span data-testid="pack-purchase-wallet-chip">
                <RunbucksPriceChip amount={walletBalance} variant="wallet" />
              </span>
            </Cluster>
          </Cluster>

          {/* Inline error banner. */}
          {error ? (
            <Panel.Section
              data-testid="pack-purchase-error-banner"
              data-skin-role="panel.section"
              role="alert"
            >
              <Label.Section>{errorBannerCopy(error)}</Label.Section>
            </Panel.Section>
          ) : null}

          {/* Primary CTA. */}
          <Button.Primary
            data-testid="pack-purchase-confirm"
            tone="yellow"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Processing…' : 'Confirm purchase'}
          </Button.Primary>

          {/* Top-up link — only visible when balance is short or the SDK
              told us so via the error path. */}
          {showAddRunbucks ? (
            <Button.Ghost
              data-testid="pack-purchase-add-runbucks"
              onClick={handleAddRunbucks}
              disabled={busy}
            >
              Add Runbucks
            </Button.Ghost>
          ) : null}

          {/* Cancel. */}
          <Button.Ghost
            data-testid="pack-purchase-cancel"
            onClick={handleCancel}
            disabled={busy}
          >
            Cancel
          </Button.Ghost>
        </Stack>
      </Panel.Modal>
    </ModalOverlay>
  )
}

function errorMessage(result: { reason: 'insufficient_balance' | 'error' | 'cancelled'; message?: string }): string {
  if (result.message && result.message.length > 0) return result.message
  switch (result.reason) {
    case 'insufficient_balance':
      return 'You do not have enough Runbucks for this pack.'
    case 'cancelled':
      return 'Purchase cancelled.'
    default:
      return 'Purchase failed. Please try again.'
  }
}

function errorBannerCopy(error: UiError): string {
  if (error.reason === 'insufficient_balance') {
    return `Not enough Runbucks. ${error.message}`
  }
  if (error.reason === 'cancelled') {
    return error.message
  }
  return `Purchase failed: ${error.message}`
}
