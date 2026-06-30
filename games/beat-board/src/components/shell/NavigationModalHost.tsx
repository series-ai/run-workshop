/**
 * NavigationModalHost — consumes `useNavigationStore.modalStack` and renders
 * the topmost modal sheet using its registered component.
 *
 * Background: BeatBoard has TWO modal stacks. `useModalStore` (modal-stack
 * module) ships its own self-mounting `<ModalStackRoot />`. The navigation
 * store carries a parallel string-id stack used by screens that call
 * `navigationStore.openModal('settings' | 'packPurchase' | 'rewardedAdConfirm'
 * | 'welcomePackOffer' | 'credits' | 'recordingReview')`. Without this host,
 * those calls push onto `modalStack` but no consumer reads it — every modal
 * silently fails to open.
 *
 * Each registered modal renders inside a centered `<ModalOverlay>` so it is
 * visually distinguishable from inline UI. Sheet components handle their own
 * dismiss callback; the host wires `onClose → useNavigationStore.closeModal()`.
 */

import { ModalOverlay } from '@modules/ui/skin'
import { useNavigationStore } from '../../stores/navigationStore'
import { SettingsSheet } from '../sheets/SettingsSheet'
import { PackPurchaseSheet } from '../sheets/PackPurchaseSheet'
import { RewardedAdConfirmSheet } from '../sheets/RewardedAdConfirmSheet'
import { WelcomePackOfferSheet } from '../sheets/WelcomePackOfferSheet'
import { CreditsSheet } from '../sheets/CreditsSheet'
import { RecordingReviewScreen } from '../screens/RecordingReviewScreen'

type AnyParams = Record<string, unknown>

export function NavigationModalHost() {
  const modalStack = useNavigationStore((s) => s.modalStack)
  const modalParams = useNavigationStore((s) => s.modalParams)
  const closeModal = useNavigationStore((s) => s.closeModal)

  if (modalStack.length === 0) return null
  const top = modalStack[modalStack.length - 1] ?? null
  if (!top) return null

  const params = (modalParams[top] ?? {}) as AnyParams

  const sheet = renderSheet(top, params, closeModal)
  if (sheet === null) return null

  // Sheets that render their own ModalOverlay (RecordingReviewScreen,
  // PackPurchaseSheet, WelcomePackOfferSheet) must NOT be double-wrapped
  // here. Two stacked overlays produce two competing backdrops + two
  // competing onClose handlers, and on touch devices the inner overlay
  // can dismiss in time for the synthetic click event to land on the
  // pad underneath — visible as the "modal allows tap-through" bug.
  // For self-wrapping sheets we just render the sheet directly.
  if (SELF_WRAPPING_SHEETS.has(top)) {
    return sheet
  }

  return (
    <ModalOverlay
      data-testid={`navigation-modal-host-${top}`}
      data-modal-id={top}
      onClose={closeModal}
    >
      {sheet}
    </ModalOverlay>
  )
}

/**
 * Sheet ids whose component already mounts a `<ModalOverlay>` of its
 * own. Keep this list in sync with the actual sheet implementations —
 * a stale entry produces a sheet rendered without an overlay (no
 * dismiss, no centering), and a missing entry produces the double-
 * wrap bug.
 */
const SELF_WRAPPING_SHEETS = new Set<string>([
  'recordingReview',
  'packPurchase',
  'welcomePackOffer',
])

function renderSheet(
  id: string,
  params: AnyParams,
  closeModal: () => void,
): React.ReactNode {
  switch (id) {
    case 'settings':
      return <SettingsSheet onClose={closeModal} />
    case 'credits':
      return <CreditsSheet onClose={closeModal} />
    case 'welcomePackOffer':
      return <WelcomePackOfferSheet onClose={closeModal} />
    case 'rewardedAdConfirm': {
      const packId = String(params['packId'] ?? '')
      const packName = String(params['packName'] ?? '')
      if (packId === '') return null
      return (
        <RewardedAdConfirmSheet
          packId={packId}
          packName={packName}
          onClose={closeModal}
        />
      )
    }
    case 'packPurchase': {
      const packId = String(params['packId'] ?? '')
      const packName = String(params['packName'] ?? '')
      const productId = String(params['productId'] ?? '')
      const priceRunbucks = Number(params['priceRunbucks'] ?? 0)
      const whatsInside = String(params['whatsInside'] ?? '')
      if (packId === '' || productId === '') return null
      return (
        <PackPurchaseSheet
          packId={packId}
          packName={packName}
          productId={productId}
          priceRunbucks={priceRunbucks}
          whatsInside={whatsInside}
          onClose={closeModal}
        />
      )
    }
    case 'recordingReview': {
      const mixId = params['mixId']
      const mode = params['mode']
      const source = mode === 'replay' ? 'mixes' : 'post_record'
      return (
        <RecordingReviewScreen
          source={source}
          {...(typeof mixId === 'string' ? { mixId } : {})}
        />
      )
    }
    default:
      return null
  }
}
