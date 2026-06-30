/**
 * RecordingReviewScreen — modal shown post-record (Save flow) and from
 * the Mixes tab (Replay flow).
 *
 * Sessions-based: replay drives the live audio engine via
 * `createReplaySession`. No media element, no blob URLs. Pads on the
 * Play screen visibly fire as the recorded events stream back.
 *
 * Layout principles (unchanged from prior pass):
 *   - Primary-action dominance — Save in post_record, Share+Play split in replay
 *   - Affordance proximity — title + Rename pencil + Delete trash share a row
 *   - Destructive demotion — Delete is a small red ghost, not a giant pill
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import {
  Button,
  Cluster,
  Icon,
  Input,
  Label,
  ModalOverlay,
  NavClose,
  Panel,
  Stack,
} from '@modules/ui/skin'
import { Pencil, Trash2 } from 'lucide-react'
import { useRecordingStore } from '../../stores/recordingStore'
import { useMixesStore } from '../../stores/mixesStore'
import { buildDefaultQueue, usePadGridStore } from '../../stores/padGridStore'
import { useNavigationStore } from '../../stores/navigationStore'
import { useKitsStore, getKitById, type KitMeta } from '../../stores/kitsStore'
import {
  saveMix,
  renameMix,
  deleteMix,
  getMixSession,
} from '../../stores/mixesStore'
import { getShareServiceAdapter } from '../../systems/share-service-adapter'
import {
  recordScreenViewed,
  trackBeatBoardFunnelStep,
} from '../../systems/analytics'
import {
  createReplaySession,
  formatDurationLabel,
  type ReplaySession,
  type ReplayState,
} from '../../systems/mixes'
import { useConfirmDialogStore } from '../../modules/ui/confirmation-dialog/ConfirmationDialog'
import { useBottomSheetStore } from '../../modules/ui/bottom-sheet/BottomSheet'
import { useToastStore } from '../../modules/ui/toast-notifications/ToastNotifications'
import { useAssetUrl } from '../../preload/assets'
import { getPadGridEngine } from '../../systems/pad-grid-engine'
import { forceResumeFromUserGesture } from '../../audio/audio-master'
import { getPadAudioGraph } from '../../audio/pad-audio-graph'
import { getBeatClock } from '../../audio/beat-clock'
import { loadKit } from '../../systems/loop-kit-catalog'
import RundotAPI from '@series-inc/rundot-game-sdk/api'

// ── Module-scoped session flags ─────────────────────────────────────────

let firstShareFiredThisSession = false

export function __resetRecordingReviewSessionState(): void {
  firstShareFiredThisSession = false
}

// ── Types ───────────────────────────────────────────────────────────────

export type RecordingReviewSource = 'post_record' | 'mixes'

export interface RecordingReviewScreenProps {
  source: RecordingReviewSource
  mixId?: string
}

interface ActionSetState {
  saved: boolean
  savedMixId: string | null
}

// ── Helpers ─────────────────────────────────────────────────────────────

function defaultTitle(kitName: string | undefined, now: Date = new Date()): string {
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yy = String(now.getFullYear()).slice(-2)
  const datePart = `${dd}-${mm}-${yy}`
  return kitName ? `${kitName} ${datePart}` : `BeatBoard ${datePart}`
}

// ── Component ───────────────────────────────────────────────────────────

export function RecordingReviewScreen({ source, mixId }: RecordingReviewScreenProps) {
  const status = useRecordingStore((s) => s.status)
  const pendingSession = useRecordingStore((s) => s.pendingSession)
  const recordingError = useRecordingStore((s) => s.error)
  const elapsedFromStore = useRecordingStore((s) => s.elapsedSeconds)
  const mixes = useMixesStore((s) => s.mixes)
  const closeModal = useNavigationStore((s) => s.closeModal)
  const activeKitId = useKitsStore((s) => s.activeKitId)
  const activeKit = getKitById(activeKitId)

  const [posterActivePadIds] = useState<string[]>(
    () => [...usePadGridStore.getState().activePadIds],
  )

  const [actionSet, setActionSet] = useState<ActionSetState>(() =>
    source === 'mixes' && mixId
      ? { saved: true, savedMixId: mixId }
      : { saved: false, savedMixId: null },
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [replayState, setReplayState] = useState<ReplayState>('idle')
  const [isPreparingReplay, setIsPreparingReplay] = useState(false)

  const existingMix = useMemo(
    () => (mixId ? mixes.find((m) => m.id === mixId) : undefined),
    [mixId, mixes],
  )

  const [title, setTitle] = useState(() =>
    existingMix?.title ?? defaultTitle(activeKit?.name),
  )
  const userEditedTitle = useRef(false)
  useEffect(() => {
    if (userEditedTitle.current) return
    if (source === 'post_record' && !actionSet.saved) {
      setTitle(defaultTitle(activeKit?.name))
    }
  }, [activeKit?.name, source, actionSet.saved])

  // Hard-cut pads on mount AND unmount.
  //   Mount: replay-from-Mixes can land with pads still active from a
  //          previous Play-screen interaction. Replay events are
  //          toggle-ish (`tapLoop`), so the engine MUST start from a
  //          synchronously-clean state or captured activations cancel
  //          themselves out. The per-pad `deactivate` schedules a
  //          bar-aligned fade — too slow; replay starts immediately
  //          on Play.
  //   Unmount: closing the modal should return the player to a clean
  //          Play screen, not "everything still looping after I closed
  //          the review."
  useEffect(() => {
    const silence = () => getPadGridEngine().stopAllImmediately()
    silence()
    return silence
  }, [])

  // Duration label: real elapsed for post_record, persisted for replay.
  const durationSeconds =
    source === 'mixes' && existingMix
      ? existingMix.durationSeconds
      : elapsedFromStore
  const durationLabel = formatDurationLabel(durationSeconds)

  const heroKit: KitMeta | undefined = useMemo(() => {
    if (source === 'mixes' && existingMix) {
      return getKitById(existingMix.kitId) ?? activeKit
    }
    return activeKit
  }, [source, existingMix, activeKit])

  // ── Replay engine ─────────────────────────────────────────────────
  // Build a ReplaySession from either the saved mix (replay mode) or the
  // pendingSession sitting in recordingStore (post_record mode). It's
  // OK if neither is available yet; play stays disabled.
  const replayRef = useRef<ReplaySession | null>(null)
  useEffect(() => {
    const sessionForReplay = (() => {
      if (source === 'mixes' && actionSet.savedMixId) {
        return getMixSession(actionSet.savedMixId)
      }
      if (pendingSession) {
        // Post-record preview wraps the pendingSession in a stub mix
        // shape so the replayer has a stable id/title.
        return {
          ...pendingSession,
          id: 'post-record-preview',
          title: 'Preview',
        }
      }
      return null
    })()
    if (!sessionForReplay) {
      replayRef.current?.dispose()
      replayRef.current = null
      setReplayState('idle')
      return
    }
    // Replay drives padGridStore directly. The recording observer is
    // already detached at this point (recording-capture cleared it on
    // stop / cancel), so engine actions WON'T be re-captured.
    const padState = usePadGridStore.getState()
    const replay = createReplaySession({
      session: sessionForReplay,
      engine: {
        tapLoop: (padId) => padState.tapLoop(padId),
        tapOneShot: (padId) => padState.tapOneShot(padId),
        deactivate: (padId) => padState.deactivate(padId),
        setCurrentBank: (bank) => padState.setCurrentBank(bank),
        toggleFxBypass: (bank, blockId) =>
          padState.toggleFxBypass(
            bank,
            blockId as Parameters<typeof padState.toggleFxBypass>[1],
          ),
      },
      clock: {
        nowMs: () => Date.now(),
        setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number,
        clearTimeout: (id) =>
          globalThis.clearTimeout(id as unknown as ReturnType<typeof globalThis.setTimeout>),
      },
    })
    const unsubscribe = replay.subscribe((p) => setReplayState(p.state))
    replayRef.current = replay
    return () => {
      unsubscribe()
      replay.dispose()
      replayRef.current = null
    }
  }, [source, actionSet.savedMixId, pendingSession])

  const isReplayPlaying = replayState === 'playing'
  // Derived from props/state instead of `replayRef.current` because ref
  // mutations don't trigger re-renders. Without this, the Play button's
  // `disabled` flag stays at its first-render value and stays disabled.
  const hasReplay =
    source === 'mixes' ? !!actionSet.savedMixId : !!pendingSession

  // Analytics — once per mount.
  const screenViewedFiredRef = useRef(false)
  useEffect(() => {
    if (screenViewedFiredRef.current) return
    screenViewedFiredRef.current = true
    recordScreenViewed({ screen: 'recording_review', source })
  }, [source])

  // ── Handlers ──────────────────────────────────────────────────────

  /**
   * Persist the pending session and return the saved id. Returns null
   * if there's nothing pending or a save's already in flight. Centralises
   * the toast on failure so both Save and Save & Share surface the same
   * error UX.
   */
  const persistPendingSession = useCallback(async (): Promise<string | null> => {
    const ready = pendingSession && !isSaving
    let savedId: string | null = null
    if (ready) {
      setIsSaving(true)
      try {
        const summary = await saveMix({
          title: title.trim() || defaultTitle(activeKit?.name),
          session: pendingSession,
        })
        setActionSet({ saved: true, savedMixId: summary.id })
        savedId = summary.id
      } catch (err) {
        RundotAPI.error('RecordingReviewScreen.handleSave failed', { err: String(err) })
        useToastStore.getState().show({
          message: `Save failed: ${err instanceof Error ? err.message : String(err)}`,
          severity: 'error',
          durationMs: 5000,
        })
      } finally {
        setIsSaving(false)
      }
    }
    return savedId
  }, [pendingSession, isSaving, title, activeKit])

  /**
   * Resolve a share for the given mix id and surface the result.
   * The Rundot host owns the share card/native sheet. BeatBoard only
   * mirrors RUN.tv's desktop fallback: copy the generated URL and toast
   * when there is no mobile share surface.
   */
  const shareById = useCallback(async (mixId: string): Promise<void> => {
    try {
      const result = await getShareServiceAdapter().shareMix(mixId)
      RundotAPI.log('RecordingReviewScreen.share succeeded', {
        mixId,
        url: result.url,
        bytes: result.payload.sessionJson.length,
      })

      if (result.copiedToClipboard) {
        useToastStore.getState().show({
          message: 'Share link copied — paste anywhere.',
          severity: 'success',
          durationMs: 3500,
        })
      }

      if (!firstShareFiredThisSession) {
        firstShareFiredThisSession = true
        trackBeatBoardFunnelStep('first_share')
      }
    } catch (err) {
      RundotAPI.error('RecordingReviewScreen.handleShare failed', { err: String(err) })
      useToastStore.getState().show({
        // The mix is persisted before this call runs (Save & Share
        // saves first; saved-state Share is by definition post-save),
        // so the user keeps the mix in their library and can retry
        // from the saved-state Share button.
        message: `Share failed: ${err instanceof Error ? err.message : String(err)} — mix is saved, tap Share to retry.`,
        severity: 'error',
        durationMs: 6000,
      })
    }
  }, [])

  const handleSave = useCallback(async () => {
    await persistPendingSession()
  }, [persistPendingSession])

  /** Atomic Save + Share for the post-record state. */
  const handleSaveAndShare = useCallback(async () => {
    const savedId = await persistPendingSession()
    if (savedId) await shareById(savedId)
  }, [persistPendingSession, shareById])

  const handleShare = useCallback(async () => {
    if (actionSet.savedMixId) {
      await shareById(actionSet.savedMixId)
    } else {
      useToastStore.getState().show({
        message: 'Save the mix first.',
        severity: 'warning',
        durationMs: 3000,
      })
    }
  }, [actionSet.savedMixId, shareById])

  const handleDiscard = useCallback(async () => {
    const confirmed = await useConfirmDialogStore.getState().show({
      title: 'Discard this mix?',
      message: 'You will lose what you just recorded. This cannot be undone.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    })
    if (!confirmed) return
    useRecordingStore.setState({
      status: 'idle',
      elapsedSeconds: 0,
      pendingSession: undefined,
      error: undefined,
    })
    closeModal()
    useBottomSheetStore.getState().close()
  }, [closeModal])

  const handleRenameSubmit = useCallback(
    async (next: string) => {
      if (!actionSet.savedMixId) return
      const trimmed = next.trim()
      if (trimmed.length === 0) {
        setIsRenameOpen(false)
        return
      }
      setTitle(trimmed)
      await renameMix(actionSet.savedMixId, trimmed)
      setIsRenameOpen(false)
    },
    [actionSet.savedMixId],
  )

  const handleDelete = useCallback(async () => {
    if (!actionSet.savedMixId) return
    const confirmed = await useConfirmDialogStore.getState().show({
      title: 'Delete this mix?',
      message: 'This mix will be permanently removed from your library.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      destructive: true,
    })
    if (!confirmed) return
    await deleteMix(actionSet.savedMixId)
    closeModal()
    useBottomSheetStore.getState().close()
  }, [actionSet.savedMixId, closeModal])

  const handleDismiss = useCallback(() => {
    if (source === 'post_record' && !actionSet.saved) {
      void handleDiscard()
      return
    }
    closeModal()
    useBottomSheetStore.getState().close()
  }, [source, actionSet.saved, handleDiscard, closeModal])

  const prepareReplayKit = useCallback(async () => {
    if (source !== 'mixes' || !existingMix) return true

    getPadGridEngine().stopAllImmediately()
    getPadAudioGraph().disposeAll()
    usePadGridStore.setState({
      activePadIds: [],
      latchedPadIds: [],
      queued: buildDefaultQueue(),
      oneShotWindows: {},
    })
    useKitsStore.getState().setActiveKit(existingMix.kitId)

    const kit = await loadKit(existingMix.kitId, {
      register: (padId, bufferUrl) =>
        getPadAudioGraph().registerPadBuffer(padId, bufferUrl),
    })
    if (kit.invalidMetadata || kit.pads.length === 0) {
      useToastStore.getState().show({
        message: "This mix's sound pack could not be loaded.",
        severity: 'error',
        durationMs: 4500,
      })
      return false
    }
    if (Number.isFinite(kit.bpm) && kit.bpm > 0) {
      getBeatClock().setBpm(kit.bpm)
    }
    return true
  }, [source, existingMix])

  const handleReplayToggle = useCallback(async () => {
    const replay = replayRef.current
    if (!replay) return
    // Browsers require AudioContext.resume() to be called synchronously
    // inside a user-gesture stack. Replay events fire from setTimeouts
    // (no gesture context); this click handler is the only place we can
    // unlock the context for the upcoming replay schedule.
    forceResumeFromUserGesture()
    if (isReplayPlaying) {
      replay.pause()
    } else {
      setIsPreparingReplay(true)
      const ready = await prepareReplayKit()
      setIsPreparingReplay(false)
      if (!ready) return
      // Hard-cut any lingering audio so replay tapLoop events fire
      // (activate) instead of toggling a still-fading pad off.
      getPadGridEngine().stopAllImmediately()
      replay.play()
    }
  }, [isReplayPlaying, prepareReplayKit])

  const handleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    userEditedTitle.current = true
    setTitle(event.target.value)
  }, [])

  const isErrorState =
    source === 'post_record' &&
    (status === 'error' || (!pendingSession && status !== 'idle' && recordingError))

  return (
    <ModalOverlay
      open
      onClose={handleDismiss}
      dismissible
      width="default"
      data-testid="recording-review-modal"
    >
      <Panel.Modal
        data-testid="recording-review-panel"
        data-skin-role="panel.modal"
      >
        <Stack space="md">
          <div
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              minHeight: 44,
            }}
          >
            <div
              role="button"
              tabIndex={0}
              data-testid="recording-review-handle"
              aria-label="Dismiss"
              onClick={handleDismiss}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleDismiss()
                }
              }}
              className="recording-review-handle"
              style={{
                position: 'absolute',
                top: 6,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
            <NavClose
              aria-label="Close"
              data-testid="recording-review-close"
              onClick={handleDismiss}
            />
          </div>

          {isErrorState ? (
            <ErrorPanel onBackToPad={handleDismiss} />
          ) : (
            <>
              <HeroCard kit={heroKit} durationLabel={durationLabel} />

              <TitleBlock
                kitName={heroKit?.name}
                title={title}
                durationLabel={durationLabel}
                isRenameOpen={isRenameOpen}
                onTitleChange={handleTitleChange}
                onRenameSubmit={() => void handleRenameSubmit(title)}
                onRenameCancel={() => setIsRenameOpen(false)}
                postRecord={source === 'post_record' && !actionSet.saved}
                onRenameOpen={() => setIsRenameOpen(true)}
                onDelete={() => void handleDelete()}
                showRowActions={actionSet.saved}
              />

              {!actionSet.saved && source === 'post_record' ? (
                <PostRecordActions
                  isSaving={isSaving}
                  onSave={() => void handleSave()}
                  onSaveAndShare={() => void handleSaveAndShare()}
                />
              ) : (
                <SavedActions
                  isPlaying={isReplayPlaying}
                  hasReplay={hasReplay}
                  isPreparing={isPreparingReplay}
                  onShare={() => void handleShare()}
                  onPlayToggle={() => void handleReplayToggle()}
                />
              )}

              <div
                data-testid="recording-review-poster-pads"
                data-pad-ids={posterActivePadIds.join(',')}
                style={{ display: 'none' }}
                aria-hidden
              />
            </>
          )}
        </Stack>
      </Panel.Modal>
    </ModalOverlay>
  )
}

// ── Hero card ───────────────────────────────────────────────────────────

function HeroCard({
  kit,
  durationLabel,
}: {
  kit: KitMeta | undefined
  durationLabel: string
}) {
  const coverUrl = useAssetUrl(kit?.coverArt ?? null)

  const heroBackground = coverUrl
    ? `center / cover no-repeat url(${JSON.stringify(coverUrl)})`
    : kit
    ? `linear-gradient(135deg, ${kit.heroGradient[0]}, ${kit.heroGradient[1]})`
    : 'var(--ui-panel-card-fill)'

  const heroStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    aspectRatio: '16 / 10',
    borderRadius: 'var(--ui-radius-md, 14px)',
    overflow: 'hidden',
    background: heroBackground,
    border: '1px solid var(--ui-panel-card-border)',
    boxShadow: 'var(--ui-panel-card-shadow)',
  }

  const durationBadgeStyle: CSSProperties = {
    position: 'absolute',
    bottom: 10,
    right: 12,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    color: 'var(--ui-button-primary-text)',
    background: 'var(--ui-panel-card-fill)',
    border: '1px solid var(--ui-panel-card-border)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    letterSpacing: 0.4,
  }

  return (
    <div data-testid="recording-review-hero" data-skin-role="panel.hero" style={heroStyle}>
      <span data-testid="recording-review-duration" style={durationBadgeStyle}>
        {durationLabel}
      </span>
    </div>
  )
}

// ── Title block ─────────────────────────────────────────────────────────

function TitleBlock({
  kitName,
  title,
  durationLabel,
  isRenameOpen,
  postRecord,
  showRowActions,
  onTitleChange,
  onRenameSubmit,
  onRenameCancel,
  onRenameOpen,
  onDelete,
}: {
  kitName: string | undefined
  title: string
  durationLabel: string
  isRenameOpen: boolean
  postRecord: boolean
  showRowActions: boolean
  onTitleChange: (event: ChangeEvent<HTMLInputElement>) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
  onRenameOpen: () => void
  onDelete: () => void
}) {
  const subtitle = kitName ? `${kitName} · ${durationLabel}` : durationLabel

  if (postRecord || isRenameOpen) {
    return (
      <Stack space="xs">
        <Label.Section data-skin-role="label.section">Title</Label.Section>
        <Input.Text
          data-skin-role="input.text"
          data-testid="recording-review-title"
          value={title}
          onChange={onTitleChange}
          onBlur={onRenameSubmit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onRenameSubmit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onRenameCancel()
            }
          }}
          aria-label="Mix title"
          autoFocus={isRenameOpen}
        />
      </Stack>
    )
  }

  return (
    <Stack space="xs">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Label.Title
          data-skin-role="label.title"
          data-testid="recording-review-title-heading"
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {title}
        </Label.Title>
        {showRowActions ? (
          <>
            <Button.Ghost
              data-skin-role="button.ghost"
              data-testid="recording-review-rename"
              aria-label="Rename mix"
              onClick={onRenameOpen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                borderRadius: 999,
              }}
            >
              <Pencil size={16} aria-hidden />
            </Button.Ghost>
            <Button.Ghost
              data-skin-role="button.ghost"
              data-testid="recording-review-delete"
              aria-label="Delete mix"
              onClick={onDelete}
              tone="red"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                padding: 0,
                borderRadius: 999,
              }}
            >
              <Trash2 size={16} aria-hidden />
            </Button.Ghost>
          </>
        ) : null}
      </div>
      <Label.Section
        data-skin-role="label.section"
        data-testid="recording-review-subtitle"
      >
        {subtitle}
      </Label.Section>
    </Stack>
  )
}

// ── Action footers ─────────────────────────────────────────────────────

function PostRecordActions({
  isSaving,
  onSave,
  onSaveAndShare,
}: {
  isSaving: boolean
  onSave: () => void
  onSaveAndShare: () => void
}) {
  // Symmetric two-button row: Save (left/secondary) + Save & Share
  // (right/primary). Save & Share is the funnel-driving action so it
  // gets the filled primary; Save is the bail-out for users who don't
  // want to commit to sharing yet. Discard lives on the close X / drag
  // handle / backdrop tap and confirms via a destructive dialog —
  // there's no inline Discard button so the action row stays focused
  // on the two save flavours.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        width: '100%',
      }}
    >
      <Button.Secondary
        data-skin-role="button.secondary"
        data-testid="recording-review-save"
        onClick={onSave}
        disabled={isSaving}
        aria-busy={isSaving}
        style={{ width: '100%' }}
      >
        {isSaving ? 'Saving…' : 'Save'}
      </Button.Secondary>
      <Button.Primary
        data-skin-role="button.primary"
        data-testid="recording-review-save-and-share"
        onClick={onSaveAndShare}
        disabled={isSaving}
        aria-busy={isSaving}
        style={{ width: '100%' }}
      >
        <Icon name="share" size={16} aria-hidden /> {isSaving ? 'Saving…' : 'Save & Share'}
      </Button.Primary>
    </div>
  )
}

function SavedActions({
  isPlaying,
  hasReplay,
  isPreparing,
  onShare,
  onPlayToggle,
}: {
  isPlaying: boolean
  hasReplay: boolean
  isPreparing: boolean
  onShare: () => void
  onPlayToggle: () => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        width: '100%',
      }}
    >
      <Button.Secondary
        data-skin-role="button.secondary"
        data-testid="recording-review-share"
        onClick={onShare}
        style={{ width: '100%' }}
      >
        <Icon name="share" size={16} aria-hidden /> Share
      </Button.Secondary>
      <Button.Primary
        data-skin-role="button.primary"
        data-testid="recording-review-play"
        onClick={onPlayToggle}
        disabled={!hasReplay || isPreparing}
        aria-pressed={isPlaying}
        aria-busy={isPreparing}
        style={{ width: '100%' }}
      >
        <Icon name={isPlaying ? 'close' : 'play'} size={16} aria-hidden />{' '}
        {isPreparing ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
      </Button.Primary>
    </div>
  )
}

// ── Error state ─────────────────────────────────────────────────────────

function ErrorPanel({ onBackToPad }: { onBackToPad: () => void }) {
  return (
    <Stack space="md">
      <div
        data-testid="recording-review-error"
        data-skin-role="panel.hero"
        role="alert"
        className="recording-review-error-panel"
      >
        <Stack space="xs">
          <Label.Title data-skin-role="label.title">Recording failed — try again</Label.Title>
          <Label.Section data-skin-role="label.section">
            We couldn&apos;t finish capturing this mix. Head back to the pad grid and start a new recording.
          </Label.Section>
        </Stack>
      </div>
      <Button.Primary
        data-skin-role="button.primary"
        data-testid="recording-review-back-to-pad-grid"
        onClick={onBackToPad}
      >
        Back to Pad Grid
      </Button.Primary>
    </Stack>
  )
}

// Cluster import kept for symmetry with prior versions; not used in the
// current layout but `<Cluster>` may return for the action footer in
// future revisions.
void Cluster
