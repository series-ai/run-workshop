/**
 * WelcomePackOfferSheet — modal sheet for the one-time first-record icebreaker
 * offer (99 Runbucks for the Lofi Heights Extended kit + 500 Runbucks).
 *
 * Issue beat-board-23-welcome-pack-offer owns this file.
 *
 * PRD references:
 *   - prd.md § Mechanics Detail § Welcome Pack icebreaker — one-time offer
 *     after the player's first lifetime mp4 recording in their first session.
 *   - prd.md § Screen: WelcomePackOffer — layout (hero banner, title, contents
 *     list, price chip, wallet chip, primary/tertiary CTAs, one-time footer).
 *   - prd.md § IAP Pricing Table — `welcome_pack` = 99 Runbucks bundles
 *     `lofi-heights-extended` + 500 Runbucks (server-side grant).
 *   - prd.md § Analytics Events — `welcome_pack_offer_shown` (mount),
 *     `welcome_pack_purchased` (purchase success), `currency_earned` for the
 *     500-Runbucks side-grant.
 *
 * The banner that opens this sheet lives in RecordingReview (issue 19); this
 * component is the modal surface itself plus the on-mount analytics + the
 * mark-shown side-effect that prevents re-display.
 *
 * Layout (top → bottom):
 *   1. Drag handle (tap to dismiss).
 *   2. Hero banner art (gift gradient).
 *   3. Title `Welcome Pack — for new producers`.
 *   4. Contents list (Lofi Heights Extended + 500 Runbucks).
 *   5. Price chip (cta variant, "99 {Runbucks}").
 *   6. Wallet chip (wallet variant, "Your balance: N {Runbucks}").
 *   7. Optional inline error banner.
 *   8. Button.Primary "Get Welcome Pack — 99 {Runbucks}".
 *   9. Button.Tertiary "Maybe later".
 *  10. Subtle "This offer is one-time only." footer.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Background,
  Button,
  Cluster,
  Icon,
  Label,
  ModalOverlay,
  NavClose,
  Panel,
  Stack,
} from '@modules/ui/skin'
import { RunbucksPriceChip } from '../widgets/RunbucksPriceChip'
import { useWalletStore } from '../../stores/walletStore'
import { iapPurchaseFlowAdapter } from '../../systems/iap-purchase-flow-adapter'
import { welcomePackTrigger } from '../../systems/welcome-pack-trigger'
import {
  recordCustomEvent,
  trackBeatBoardFunnelStep,
} from '../../systems/analytics'
import { useToastStore } from '../../modules/ui/toast-notifications/ToastNotifications'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Constants ────────────────────────────────────────────────────────────

/**
 * Welcome-pack SDK product id and price per prd.md § IAP Pricing Table.
 * The 99 Runbucks bundle grants `lofi-heights-extended` ownership AND credits
 * 500 Runbucks back to the player — both server-side via the Rundot IAP
 * fulfilment hook. The client emits the `currency_earned` analytics so the
 * warehouse funnel sees the credit, but never increments the wallet locally.
 */
export const WELCOME_PACK_PRODUCT_ID = 'welcome_pack'
export const WELCOME_PACK_PRICE_RUNBUCKS = 99
export const WELCOME_PACK_PACK_ID = 'lofi-heights-extended'
export const WELCOME_PACK_PACK_NAME = 'Lofi Heights · Extended'
export const WELCOME_PACK_GRANT_RUNBUCKS = 500

const HERO_GRADIENT: [string, string] = ['#ffd99e', '#ff9f6b']

// ── Types ────────────────────────────────────────────────────────────────

export interface WelcomePackOfferSheetProps {
  /** Called when the sheet should dismiss (success, dismiss tap, or X). */
  onClose: () => void
}

interface UiError {
  reason: 'insufficient_balance' | 'error' | 'cancelled'
  message: string
}

// ── Component ────────────────────────────────────────────────────────────

export function WelcomePackOfferSheet({ onClose }: WelcomePackOfferSheetProps) {
  const walletBalance = useWalletStore((s) => s.balance)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<UiError | null>(null)

  // ── Analytics — welcome_pack_offer_shown funnel step on first mount ─────
  // Also calls markShown() so the offer never reappears regardless of the
  // outcome the player chooses (purchase / Maybe later / dismiss).
  const mountFiredRef = useRef(false)
  useEffect(() => {
    if (mountFiredRef.current) return
    mountFiredRef.current = true
    trackBeatBoardFunnelStep('welcome_pack_offer_shown')
    void welcomePackTrigger.markShown()
  }, [])

  const handleGet = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await iapPurchaseFlowAdapter.purchase({
        productId: WELCOME_PACK_PRODUCT_ID,
        priceRunbucks: WELCOME_PACK_PRICE_RUNBUCKS,
        packId: WELCOME_PACK_PACK_ID,
        packName: WELCOME_PACK_PACK_NAME,
      })
      if (result.ok) {
        // Server-side IAP fulfilment grants the 500 Runbucks; the client emits
        // the analytics so the warehouse funnel sees the credit without ever
        // modifying the wallet locally.
        recordCustomEvent('currency_earned', {
          currency: 'runbucks',
          amount: WELCOME_PACK_GRANT_RUNBUCKS,
          source: 'welcome_pack_grant',
        })
        trackBeatBoardFunnelStep('welcome_pack_purchased')
        // Success toast per prd.md § Screen: WelcomePackOffer — appears on top
        // of the auto-switch to Play that the IAP adapter triggers.
        useToastStore.getState().show({
          severity: 'success',
          message: `Welcome Pack unlocked! +${WELCOME_PACK_GRANT_RUNBUCKS} Runbucks`,
          durationMs: 4000,
        })
        onClose()
        return
      }
      setError({ reason: result.reason, message: errorMessage(result) })
    } catch (err) {
      RundotAPI.error('WelcomePackOfferSheet.handleGet failed', { err: String(err) })
      setError({ reason: 'error', message: 'Purchase failed. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const handleMaybeLater = () => {
    if (busy) return
    // markShown() already fired on mount, so the offer is already permanently
    // suppressed for this player. Just dismiss the sheet.
    onClose()
  }

  return (
    <ModalOverlay
      open
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      width="default"
      data-testid="welcome-pack-offer-sheet"
    >
      <Panel.Modal
        data-testid="welcome-pack-offer-panel"
        data-skin-role="panel.modal"
      >
        <Stack space="md">
          {/* Top affordances: drag handle + close X. */}
          <Cluster justify="between" align="center">
            <button
              type="button"
              data-testid="welcome-pack-offer-handle"
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
              data-testid="welcome-pack-offer-close"
              onClick={onClose}
              aria-label="Close welcome pack offer"
            />
          </Cluster>

          {/* Hero banner — gift gradient with a centered icon. */}
          <div
            data-testid="welcome-pack-offer-hero"
            data-skin-role="panel.hero"
            aria-hidden
            style={{
              height: 120,
              borderRadius: 'var(--ui-radius-lg, 12px)',
              backgroundImage: `linear-gradient(135deg, ${HERO_GRADIENT[0]}, ${HERO_GRADIENT[1]})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Background />
            <Icon name="gift" size={48} aria-hidden />
          </div>

          {/* Title. */}
          <Stack space="xs">
            <Label.Title data-testid="welcome-pack-offer-title">
              Welcome Pack — for new producers
            </Label.Title>
          </Stack>

          {/* Contents list. */}
          <Panel.Section
            data-testid="welcome-pack-offer-contents"
            data-skin-role="panel.section"
          >
            <Stack space="xs">
              <Cluster space="xs" align="center">
                <Icon name="shop" size={14} aria-hidden />
                <Label.Section data-testid="welcome-pack-offer-content-kit">
                  Lofi Heights · Extended Edition (8 extra pads, 2 extra layers)
                </Label.Section>
              </Cluster>
              <Cluster space="xs" align="center">
                <Icon name="gift" size={14} aria-hidden />
                <Label.Section data-testid="welcome-pack-offer-content-runbucks">
                  +{WELCOME_PACK_GRANT_RUNBUCKS} Runbucks
                </Label.Section>
              </Cluster>
            </Stack>
          </Panel.Section>

          {/* Price + wallet chips. */}
          <Cluster space="sm" align="center" justify="between">
            <span data-testid="welcome-pack-offer-price-chip">
              <RunbucksPriceChip
                amount={WELCOME_PACK_PRICE_RUNBUCKS}
                variant="cta"
              />
            </span>
            <Cluster space="xs" align="center">
              <Label.Section>Your balance:</Label.Section>
              <span data-testid="welcome-pack-offer-wallet-chip">
                <RunbucksPriceChip amount={walletBalance} variant="wallet" />
              </span>
            </Cluster>
          </Cluster>

          {/* Inline error banner. */}
          {error ? (
            <Panel.Section
              data-testid="welcome-pack-offer-error-banner"
              data-skin-role="panel.section"
              role="alert"
            >
              <Label.Section>{errorBannerCopy(error)}</Label.Section>
            </Panel.Section>
          ) : null}

          {/* Primary CTA. */}
          <Button.Primary
            data-testid="welcome-pack-offer-get"
            tone="yellow"
            onClick={() => {
              void handleGet()
            }}
            disabled={busy}
            aria-busy={busy}
          >
            {busy
              ? 'Processing…'
              : `Get Welcome Pack — ${WELCOME_PACK_PRICE_RUNBUCKS} Runbucks`}
          </Button.Primary>

          {/* Tertiary dismiss — `Button.Ghost` is the closest semantic to
              the spec's "Tertiary" tone and matches PackPurchaseSheet's
              cancel control. */}
          <Button.Ghost
            data-testid="welcome-pack-offer-maybe-later"
            onClick={handleMaybeLater}
            disabled={busy}
          >
            Maybe later
          </Button.Ghost>

          {/* One-time footer copy — rendered as muted Section label since
              the skin does not expose a `Text.Subtle` primitive. */}
          <Cluster justify="center" align="center">
            <Label.Section
              data-testid="welcome-pack-offer-once-only"
              data-skin-role="text.subtle"
            >
              This offer is one-time only.
            </Label.Section>
          </Cluster>
        </Stack>
      </Panel.Modal>
    </ModalOverlay>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function errorMessage(result: {
  reason: 'insufficient_balance' | 'error' | 'cancelled'
  message?: string
}): string {
  if (result.message && result.message.length > 0) return result.message
  switch (result.reason) {
    case 'insufficient_balance':
      return 'You do not have enough Runbucks for this offer.'
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
