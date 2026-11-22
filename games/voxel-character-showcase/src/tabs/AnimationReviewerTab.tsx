import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
} from 'react'
import { BUDGETS } from '@voxchar/contracts/budgets'
import {
  HUMANOID_PROPORTION_DEFAULTS,
  PROPORTION_DEFAULTS,
  type AvatarProportions,
  type CharacterPreset,
  type PackCatalog,
} from '@voxchar/contracts/catalog'
import { RIG_IDS, RIG_SPECS, type RigId } from '@voxchar/contracts/rig'
import { PolyAvatar, type PolyAvatarStats } from '../avatar/PolyAvatar'
import {
  CLIP_REVIEW_CATALOG,
  UAL1_REVIEW_CATEGORIES,
  clipReviewKey,
  formatReviewReportMarkdown,
  isLoopingByDefault,
  summarizeReviews,
  type AnimationCategory,
  type ClipReviewEntry,
  type ClipReviewSpec,
  type ReviewStatus,
} from '../avatar/animationReviewCatalog'
import {
  PolyPartIndex,
  createDefaultSelection,
  selectionFromPreset,
  type PolyAvatarSelection,
} from '../avatar/composePolyAvatar'
import { LabStage } from '../scenes/LabStage'
import { LAB_FOV_DEG, labAngleFramingFor, type ReviewCameraAngle } from '../scenes/labFraming'
import { STUDIO_GL, StudioLights } from '../scenes/studio'

const STORAGE_KEY = 'run.voxchar.animReview.v1'
const WALL_PAGE_SIZE = 9
const FPS_STEP = 30

type ViewMode = 'focus' | 'wall'
type StatusFilter = 'all' | ReviewStatus
type PhysiqueChoice = 'preset' | 'slim' | 'athletic' | 'heavy'

const CAMERA_ANGLE_OPTIONS: readonly { id: ReviewCameraAngle; label: string }[] = [
  { id: 'threeQuarter', label: '3/4' },
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
  { id: 'head', label: 'Head/Neck' },
  { id: 'feet', label: 'Feet' },
]

const WALL_YAW_OPTIONS: readonly { id: string; label: string; yaw: number }[] = [
  { id: 'front', label: 'Front', yaw: 0 },
  { id: 'threeQuarter', label: '3/4', yaw: 0.48 },
  { id: 'side', label: 'Side', yaw: Math.PI / 2 },
  { id: 'back', label: 'Back', yaw: Math.PI },
]

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5] as const

function loadStoredReviews(): Record<string, ClipReviewEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) // @rundot-ignore-storage
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, ClipReviewEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveStoredReviews(reviews: Record<string, ClipReviewEntry>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews)) // @rundot-ignore-storage
  } catch {
    // Ignore storage errors (private mode / opaque sandbox).
  }
}

function FramedReviewStage({
  rigId,
  proportions,
  angle,
  viewEpoch,
  turntable,
  children,
}: {
  rigId: RigId
  proportions: AvatarProportions
  angle: ReviewCameraAngle
  viewEpoch: number
  turntable: boolean
  children: ReactNode
}) {
  const aspect = useThree((state) => state.viewport.aspect)
  const framing = useMemo(
    () => labAngleFramingFor(rigId, proportions, aspect, angle),
    [rigId, proportions, aspect, angle],
  )
  return (
    <LabStage framing={framing} viewEpoch={viewEpoch} turntable={turntable} minDistance={0.65}>
      {children}
    </LabStage>
  )
}

function WallGridStage({
  rigId,
  pageKey,
  specs,
  baseSelection,
  index,
  autoProp,
  yaw,
  playbackRate,
  paused,
  showSkeleton,
  selectedClip,
  reviews,
  onSelectClip,
  onQuickVerdict,
}: {
  rigId: RigId
  pageKey: string
  specs: readonly ClipReviewSpec[]
  baseSelection: PolyAvatarSelection
  index: PolyPartIndex
  autoProp: boolean
  yaw: number
  playbackRate: number
  paused: boolean
  showSkeleton: boolean
  selectedClip: string
  reviews: Readonly<Record<string, ClipReviewEntry>>
  onSelectClip: (clipName: string) => void
  onQuickVerdict: (clipName: string, status: ReviewStatus) => void
}) {
  const camera = useThree((state) => state.camera)
  const aspect = useThree((state) => state.viewport.aspect)
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)

  const isSmallAnimal = rigId === 'corgi' || rigId === 'pug' || rigId === 'cat'
  const isWideAnimal = rigId === 'dragon' || rigId === 'avian'
  const isLargeAnimal = rigId === 'horse' || rigId === 'kaiju' || rigId === 'aquatic' || rigId === 'serpent'
  const dx = rigId === 'ual1' ? 2.75 : isWideAnimal ? 4.8 : isLargeAnimal ? 4.2 : isSmallAnimal ? 2.2 : 3.1
  const dy = rigId === 'ual1' ? 2.2 : isWideAnimal || isLargeAnimal ? 2.5 : isSmallAnimal ? 1.45 : 1.75
  const dz = rigId === 'ual1' ? 1.15 : isWideAnimal || isLargeAnimal ? 1.65 : isSmallAnimal ? 0.95 : 1.35
  const targetY = rigId === 'ual1' ? 3.05 : isWideAnimal || isLargeAnimal ? 3.35 : isSmallAnimal ? 2.0 : 2.25
  const baseDist = rigId === 'ual1' ? 12.6 : isWideAnimal ? 18.8 : isLargeAnimal ? 16.5 : isSmallAnimal ? 9.2 : 12.0
  const distance = baseDist / Math.max(0.5, Math.min(1, aspect / 1.18))

  useLayoutEffect(() => {
    camera.position.set(0, targetY + 0.85, distance)
    if (controls.current) {
      controls.current.target.set(0, targetY, 0)
      controls.current.update()
    } else {
      camera.lookAt(0, targetY, 0)
    }
  }, [camera, rigId, pageKey, targetY, distance])

  const padRadius = rigId === 'ual1' ? 0.78 : isWideAnimal ? 1.95 : isLargeAnimal ? 1.65 : isSmallAnimal ? 0.58 : 0.98

  return (
    <>
      {specs.map((spec, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        const x = (col - 1) * dx
        const y = (2 - row) * dy
        const z = (row - 1) * dz
        const isSelected = spec.name === selectedClip
        const review = reviews[clipReviewKey(spec.rigId, spec.name)]
        const status: ReviewStatus = review?.status ?? 'todo'
        const tileSelection: PolyAvatarSelection = {
          ...baseSelection,
          clip: spec.name,
          ...(autoProp && rigId === 'ual1'
            ? {
                heldRight:
                  spec.suggestedHeldRight !== undefined ? spec.suggestedHeldRight : baseSelection.heldRight,
                heldLeft:
                  spec.suggestedHeldLeft !== undefined ? spec.suggestedHeldLeft : baseSelection.heldLeft,
              }
            : {}),
        }

        const badgeColor =
          status === 'pass'
            ? '#4ade80'
            : status === 'issue'
              ? '#f87171'
              : spec.auditNote
                ? '#fbbf24'
                : '#93a4bc'

        return (
          <group key={spec.name} position={[x, y, z]}>
            <mesh
              position={[0, -0.04, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onSelectClip(spec.name)
              }}
            >
              <cylinderGeometry args={[padRadius, padRadius + 0.08, 0.08, 10]} />
              <meshStandardMaterial
                color={isSelected ? '#b9803f' : status === 'issue' ? '#5e2c32' : status === 'pass' ? '#244736' : '#2a3342'}
                roughness={0.85}
                flatShading
              />
            </mesh>
            <group rotation={[0, yaw, 0]}>
              <PolyAvatar
                selection={tileSelection}
                index={index}
                blobShadow
                loopMode="repeat"
                playbackRate={playbackRate}
                paused={paused}
                showSkeleton={showSkeleton}
              />
            </group>
            <Html position={[0, -0.22, 0]} center>
              <div className={`wall-chip ${isSelected ? 'selected' : ''} status-${status}`}>
                <button
                  className="wall-chip-open"
                  title={`Inspect ${spec.name} in Focus mode`}
                  onClick={() => onSelectClip(spec.name)}
                >
                  <span className="wall-dot" style={{ background: badgeColor }} />
                  <span className="wall-clip-name">{spec.name}</span>
                </button>
                <button
                  className={`wall-mark ${status === 'pass' ? 'active-pass' : ''}`}
                  title="Mark Pass"
                  onClick={() => onQuickVerdict(spec.name, status === 'pass' ? 'todo' : 'pass')}
                >
                  ✓
                </button>
                <button
                  className={`wall-mark ${status === 'issue' ? 'active-issue' : ''}`}
                  title="Mark Issue"
                  onClick={() => onQuickVerdict(spec.name, status === 'issue' ? 'todo' : 'issue')}
                >
                  ✕
                </button>
              </div>
            </Html>
          </group>
        )
      })}
      <OrbitControls ref={controls} minDistance={4} maxDistance={28} maxPolarAngle={Math.PI / 1.85} />
    </>
  )
}

export function AnimationReviewerTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const allPresets = useMemo<CharacterPreset[]>(() => catalogs.flatMap((c) => c.presets), [catalogs])
  const [rigId, setRigId] = useState<RigId>('ual1')
  const [presetId, setPresetId] = useState<string>(() => {
    const preferred = allPresets.find((p) => p.rigId === 'ual1' && p.pack !== 'core') ?? allPresets[0]
    return preferred?.id ?? ''
  })
  const [physique, setPhysique] = useState<PhysiqueChoice>('preset')
  const [autoProp, setAutoProp] = useState(true)
  const [heldRightOverride, setHeldRightOverride] = useState<string | null | 'auto'>('auto')
  const [heldLeftOverride, setHeldLeftOverride] = useState<string | null | 'auto'>('auto')

  const [viewMode, setViewMode] = useState<ViewMode>('focus')
  const [cameraAngle, setCameraAngle] = useState<ReviewCameraAngle>('threeQuarter')
  const [viewEpoch, setViewEpoch] = useState(0)
  const [turntable, setTurntable] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const [wallYaw, setWallYaw] = useState(0.48)
  const [wallPage, setWallPage] = useState(0)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | AnimationCategory>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [selectedClip, setSelectedClip] = useState<string>('Idle_Loop')
  const [paused, setPaused] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [loopAll, setLoopAll] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [seek, setSeek] = useState<{ seq: number; phase: number } | null>(null)
  const seekSeqRef = useRef(0)
  const [progress, setProgress] = useState<{ time: number; duration: number; phase: number }>({
    time: 0,
    duration: 2.5,
    phase: 0,
  })

  const [reviews, setReviews] = useState<Record<string, ClipReviewEntry>>(loadStoredReviews)
  const [copiedReport, setCopiedReport] = useState(false)
  const [liveStats, setLiveStats] = useState<PolyAvatarStats | null>(null)

  const rigPresets = useMemo(() => allPresets.filter((p) => (p.rigId ?? 'ual1') === rigId), [allPresets, rigId])
  const activePreset = useMemo(
    () => rigPresets.find((p) => p.id === presetId) ?? rigPresets[0] ?? null,
    [rigPresets, presetId],
  )

  const rigSpecs = CLIP_REVIEW_CATALOG[rigId]
  const activeClipSpec = useMemo(
    () => rigSpecs.find((c) => c.name === selectedClip) ?? rigSpecs[0]!,
    [rigSpecs, selectedClip],
  )

  const filteredSpecs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rigSpecs.filter((spec) => {
      if (categoryFilter !== 'all' && spec.category !== categoryFilter) return false
      const revStatus: ReviewStatus = reviews[clipReviewKey(spec.rigId, spec.name)]?.status ?? 'todo'
      if (statusFilter !== 'all' && revStatus !== statusFilter) return false
      if (q && !spec.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [rigSpecs, categoryFilter, statusFilter, search, reviews])

  const pageCount = Math.max(1, Math.ceil(filteredSpecs.length / WALL_PAGE_SIZE))
  const safePage = Math.min(wallPage, pageCount - 1)
  const wallSlice = useMemo(
    () => filteredSpecs.slice(safePage * WALL_PAGE_SIZE, (safePage + 1) * WALL_PAGE_SIZE),
    [filteredSpecs, safePage],
  )

  const baseSelection = useMemo<PolyAvatarSelection>(() => {
    const raw = activePreset ? selectionFromPreset(activePreset) : createDefaultSelection(index, 'heist')
    if (rigId !== 'ual1') return raw
    let nextBody = raw.body
    let nextProportions = { ...raw.proportions }
    if (physique !== 'preset' && (raw.body === 'body_slim' || raw.body === 'body_athletic' || raw.body === 'body_heavy')) {
      nextBody = 'body_athletic'
      nextProportions = {
        ...(raw.proportions ?? HUMANOID_PROPORTION_DEFAULTS),
        build: physique === 'slim' ? -1 : physique === 'heavy' ? 1 : 0,
      }
    }
    return {
      ...raw,
      body: nextBody,
      proportions: nextProportions,
    }
  }, [activePreset, index, rigId, physique])

  const effectiveSelection = useMemo<PolyAvatarSelection>(() => {
    if (rigId !== 'ual1') {
      return { ...baseSelection, clip: activeClipSpec.name }
    }
    const resolveAutoRight =
      autoProp && activeClipSpec.suggestedHeldRight !== undefined
        ? activeClipSpec.suggestedHeldRight
        : baseSelection.heldRight
    const resolveAutoLeft =
      autoProp && activeClipSpec.suggestedHeldLeft !== undefined
        ? activeClipSpec.suggestedHeldLeft
        : baseSelection.heldLeft

    return {
      ...baseSelection,
      clip: activeClipSpec.name,
      heldRight: heldRightOverride === 'auto' ? resolveAutoRight : heldRightOverride,
      heldLeft: heldLeftOverride === 'auto' ? resolveAutoLeft : heldLeftOverride,
    }
  }, [baseSelection, rigId, activeClipSpec, autoProp, heldRightOverride, heldLeftOverride])

  const heldRightItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_r'), [index])
  const heldLeftItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_l'), [index])

  const selectRig = useCallback(
    (nextRig: RigId) => {
      if (nextRig === rigId) return
      setRigId(nextRig)
      const nextPreset = allPresets.find((p) => (p.rigId ?? 'ual1') === nextRig && p.pack !== 'core')
        ?? allPresets.find((p) => (p.rigId ?? 'ual1') === nextRig)
      if (nextPreset) setPresetId(nextPreset.id)
      setCategoryFilter('all')
      setStatusFilter('all')
      setSearch('')
      setWallPage(0)
      const nextFirstClip = CLIP_REVIEW_CATALOG[nextRig][0]?.name ?? ''
      setSelectedClip(nextRig === 'ual1' ? 'Idle_Loop' : nextFirstClip)
      setCameraAngle('threeQuarter')
      setViewEpoch((v) => v + 1)
    },
    [rigId, allPresets],
  )

  const selectClip = useCallback(
    (clipName: string, switchToFocus = false) => {
      setSelectedClip(clipName)
      const spec = CLIP_REVIEW_CATALOG[rigId].find((c) => c.name === clipName)
      setProgress({ time: 0, duration: spec?.duration ?? 1, phase: 0 })
      setSeek(null)
      if (switchToFocus) setViewMode('focus')
    },
    [rigId],
  )

  const stepClip = useCallback(
    (delta: number) => {
      const list = filteredSpecs.length > 0 ? filteredSpecs : rigSpecs
      const curIdx = list.findIndex((c) => c.name === activeClipSpec.name)
      const nextIdx = (curIdx + delta + list.length) % list.length
      const nextSpec = list[nextIdx]
      if (nextSpec) selectClip(nextSpec.name)
    },
    [filteredSpecs, rigSpecs, activeClipSpec.name, selectClip],
  )

  const setReviewStatus = useCallback(
    (targetRig: RigId, clipName: string, status: ReviewStatus) => {
      const key = clipReviewKey(targetRig, clipName)
      setReviews((prev) => {
        const existing = prev[key]
        const next: Record<string, ClipReviewEntry> = { ...prev }
        if (status === 'todo' && (!existing || !existing.note.trim())) {
          delete next[key]
        } else {
          next[key] = {
            status,
            note: existing?.note ?? '',
            updatedAt: new Date().toISOString(),
          }
        }
        saveStoredReviews(next)
        return next
      })
    },
    [],
  )

  const setReviewNote = useCallback(
    (targetRig: RigId, clipName: string, note: string) => {
      const key = clipReviewKey(targetRig, clipName)
      setReviews((prev) => {
        const existing = prev[key]
        const status = existing?.status ?? 'todo'
        const next: Record<string, ClipReviewEntry> = { ...prev }
        if (status === 'todo' && !note.trim()) {
          delete next[key]
        } else {
          next[key] = {
            status,
            note,
            updatedAt: new Date().toISOString(),
          }
        }
        saveStoredReviews(next)
        return next
      })
    },
    [],
  )

  const seekPhase = useCallback((nextPhase: number) => {
    const clamped = Math.max(0, Math.min(1, nextPhase))
    seekSeqRef.current += 1
    setSeek({ seq: seekSeqRef.current, phase: clamped })
    setProgress((prev) => ({
      ...prev,
      phase: clamped,
      time: clamped * prev.duration,
    }))
  }, [])

  const stepFrame = useCallback(
    (frames: number) => {
      setPaused(true)
      const dur = Math.max(0.01, progress.duration || activeClipSpec.duration)
      const stepPhase = frames / (dur * FPS_STEP)
      const raw = progress.phase + stepPhase
      const wrapped = loopAll || !activeClipSpec.isOneShot ? ((raw % 1) + 1) % 1 : Math.max(0, Math.min(1, raw))
      seekPhase(wrapped)
    },
    [progress.duration, progress.phase, activeClipSpec, loopAll, seekPhase],
  )

  // Reset progress duration when active clip changes
  useEffect(() => {
    setProgress((prev) =>
      prev.duration === activeClipSpec.duration ? prev : { time: 0, duration: activeClipSpec.duration, phase: 0 },
    )
  }, [activeClipSpec.name, activeClipSpec.duration])

  // Keyboard review workflow shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'ArrowDown' || e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        stepClip(1)
      } else if (e.key === 'ArrowUp' || e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        stepClip(-1)
      } else if (e.key === '[') {
        e.preventDefault()
        stepFrame(-1)
      } else if (e.key === ']') {
        e.preventDefault()
        stepFrame(1)
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        setReviewStatus(rigId, activeClipSpec.name, 'pass')
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        setReviewStatus(rigId, activeClipSpec.name, 'issue')
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        setShowSkeleton((s) => !s)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stepClip, stepFrame, setReviewStatus, rigId, activeClipSpec.name])

  const summary = useMemo(() => summarizeReviews(rigSpecs, reviews), [rigSpecs, reviews])
  const allSummary = useMemo(
    () =>
      summarizeReviews(
        RIG_IDS.flatMap((id) => CLIP_REVIEW_CATALOG[id]),
        reviews,
      ),
    [reviews],
  )

  const currentReview = reviews[clipReviewKey(rigId, activeClipSpec.name)]
  const currentStatus: ReviewStatus = currentReview?.status ?? 'todo'
  const currentNote = currentReview?.note ?? ''
  const loopMode = loopAll ? 'repeat' : 'auto'
  const nativeLoop = isLoopingByDefault(rigId, activeClipSpec.name)

  const totalFrames = Math.max(1, Math.round(activeClipSpec.duration * FPS_STEP))
  const currentFrame = Math.min(totalFrames, Math.max(0, Math.round(progress.phase * totalFrames)))

  const handleCopyReport = async () => {
    const md = formatReviewReportMarkdown({
      rigId,
      presetLabel: activePreset?.label ?? rigId,
      specs: rigSpecs,
      reviews,
    })
    try {
      await navigator.clipboard.writeText(md)
    } catch {
      // Fallback ignored if clipboard blocked in headless mode.
    }
    setCopiedReport(true)
    window.setTimeout(() => setCopiedReport(false), 2000)
  }

  return (
    <div className="split-lab">
      <aside className="sidebar">
        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">View Mode &amp; Rig</h3>
            <span className="review-progress-pill">
              {allSummary.pass + allSummary.issue}/{allSummary.total} reviewed
            </span>
          </div>
          <div className="segmented-row">
            <button
              className={`pill-btn ${viewMode === 'focus' ? 'active' : ''}`}
              onClick={() => setViewMode('focus')}
            >
              Focus Inspector
            </button>
            <button
              className={`pill-btn ${viewMode === 'wall' ? 'active' : ''}`}
              onClick={() => setViewMode('wall')}
            >
              Clip Wall (3&times;3)
            </button>
          </div>
          <div className="preset-pills">
            {RIG_IDS.map((id) => {
              const shortLabel =
                id === 'ual1'
                  ? 'UAL1'
                  : id === 'gsd'
                    ? 'GSD'
                    : id.charAt(0).toUpperCase() + id.slice(1)
              return (
                <button
                  key={id}
                  className={`pill-btn ${rigId === id ? 'active' : ''}`}
                  onClick={() => selectRig(id)}
                >
                  {shortLabel} ({CLIP_REVIEW_CATALOG[id].length})
                </button>
              )
            })}
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title">Test Character</h3>
          <div className="field-row">
            <label>Preset</label>
            <select
              value={activePreset?.id ?? ''}
              onChange={(e) => {
                setPresetId(e.target.value)
                setViewEpoch((v) => v + 1)
              }}
            >
              {rigPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.pack}] {p.label}
                </option>
              ))}
            </select>
          </div>
          {rigId === 'ual1' && (
            <>
              <div className="field-row">
                <label>Physique</label>
                <div className="preset-pills">
                  {(['preset', 'slim', 'athletic', 'heavy'] as const).map((choice) => (
                    <button
                      key={choice}
                      className={`pill-btn ${physique === choice ? 'active' : ''}`}
                      style={{ textTransform: 'capitalize' }}
                      onClick={() => setPhysique(choice)}
                    >
                      {choice === 'athletic' ? 'Athl' : choice}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-row">
                <label>
                  <input
                    type="checkbox"
                    checked={autoProp}
                    onChange={(e) => setAutoProp(e.target.checked)}
                  />{' '}
                  Auto-prop
                </label>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Pairs pistol, wrench, torch, or walkie automatically
                </span>
              </div>
              <div className="field-row">
                <label>Hand R</label>
                <select
                  value={heldRightOverride ?? ''}
                  onChange={(e) => setHeldRightOverride(e.target.value === 'auto' ? 'auto' : e.target.value || null)}
                >
                  <option value="auto">Auto ({effectiveSelection.heldRight ?? 'empty'})</option>
                  <option value="">— empty —</option>
                  {heldRightItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field-row">
                <label>Hand L</label>
                <select
                  value={heldLeftOverride ?? ''}
                  onChange={(e) => setHeldLeftOverride(e.target.value === 'auto' ? 'auto' : e.target.value || null)}
                >
                  <option value="auto">Auto ({effectiveSelection.heldLeft ?? 'empty'})</option>
                  <option value="">— empty —</option>
                  {heldLeftItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="section-card review-browser-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">
              Clip Queue ({filteredSpecs.length}/{rigSpecs.length})
            </h3>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--good)' }}>{summary.pass}✓</strong>{' '}
              <strong style={{ color: 'var(--bad)' }}>{summary.issue}✕</strong>{' '}
              <span>{summary.todo}○</span>
            </span>
          </div>

          <input
            type="text"
            placeholder="Filter clips (e.g. Pistol, Walk, Roll)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setWallPage(0)
            }}
          />

          {rigId === 'ual1' && (
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value as 'all' | AnimationCategory)
                setWallPage(0)
              }}
            >
              <option value="all">All Categories ({rigSpecs.length})</option>
              {UAL1_REVIEW_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({rigSpecs.filter((s) => s.category === cat).length})
                </option>
              ))}
            </select>
          )}

          <div className="preset-pills">
            {(['all', 'todo', 'pass', 'issue'] as const).map((st) => (
              <button
                key={st}
                className={`pill-btn ${statusFilter === st ? 'active' : ''}`}
                style={{ textTransform: 'capitalize' }}
                onClick={() => {
                  setStatusFilter(st)
                  setWallPage(0)
                }}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="clip-list" role="listbox" aria-label="Animation clips">
            {filteredSpecs.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--muted)' }}>
                No clips match the current filter.
              </div>
            )}
            {filteredSpecs.map((spec) => {
              const rev = reviews[clipReviewKey(spec.rigId, spec.name)]
              const st: ReviewStatus = rev?.status ?? 'todo'
              const isSelected = spec.name === activeClipSpec.name
              return (
                <button
                  key={spec.name}
                  role="option"
                  aria-selected={isSelected}
                  className={`clip-row ${isSelected ? 'active' : ''} status-${st}`}
                  onClick={() => selectClip(spec.name)}
                >
                  <span className={`clip-status-badge status-${st}`}>
                    {st === 'pass' ? '✓' : st === 'issue' ? '✕' : '○'}
                  </span>
                  <span className="clip-row-name">{spec.name}</span>
                  <span className="clip-row-meta">
                    {spec.auditNote && <span className="clip-badge-warn" title={spec.auditNote}>!</span>}
                    {spec.isOneShot && <span className="clip-badge-shot">1-shot</span>}
                    <span>{spec.duration.toFixed(2)}s</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={handleCopyReport}>
              {copiedReport ? 'Copied MD Report!' : 'Copy MD Report'}
            </button>
            <button
              className="btn-secondary"
              title="Clear saved Pass/Issue marks"
              onClick={() => {
                setReviews({})
                saveStoredReviews({})
              }}
            >
              Clear Marks
            </button>
          </div>
        </div>
      </aside>

      <div className="review-main">
        <div className="viewport-wrap">
          <Canvas shadows dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ fov: LAB_FOV_DEG, near: 0.1, far: 75 }}>
            <StudioLights reach={viewMode === 'wall' ? 2.4 : 1} heroShadows={viewMode === 'focus'} />
            <Suspense fallback={null}>
              {viewMode === 'focus' ? (
                <FramedReviewStage
                  rigId={rigId}
                  proportions={effectiveSelection.proportions}
                  angle={cameraAngle}
                  viewEpoch={viewEpoch}
                  turntable={turntable}
                >
                  <PolyAvatar
                    selection={effectiveSelection}
                    index={index}
                    castShadow
                    playbackRate={playbackRate}
                    paused={paused}
                    loopMode={loopMode}
                    replayKey={replayKey}
                    seek={seek}
                    showSkeleton={showSkeleton}
                    onStats={setLiveStats}
                    onProgress={setProgress}
                  />
                </FramedReviewStage>
              ) : (
                <WallGridStage
                  rigId={rigId}
                  pageKey={`${rigId}-${safePage}-${categoryFilter}-${statusFilter}-${search}`}
                  specs={wallSlice}
                  baseSelection={baseSelection}
                  index={index}
                  autoProp={autoProp}
                  yaw={wallYaw}
                  playbackRate={playbackRate}
                  paused={paused}
                  showSkeleton={showSkeleton}
                  selectedClip={activeClipSpec.name}
                  reviews={reviews}
                  onSelectClip={(name) => selectClip(name, true)}
                  onQuickVerdict={(name, st) => setReviewStatus(rigId, name, st)}
                />
              )}
            </Suspense>
          </Canvas>

          <div className="hud-overlay">
            <div className="hud-card">
              {viewMode === 'focus' ? (
                <>
                  <div className="metric">
                    <span className="metric-label">{activeClipSpec.category}</span>
                    <span className="metric-val" style={{ color: 'var(--accent)' }}>
                      {activeClipSpec.name}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Frame (30fps)</span>
                    <span className="metric-val">
                      {currentFrame} / {totalFrames}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Mesh / Bones</span>
                    <span className="metric-val">
                      {liveStats?.triangles ?? '—'}△ · {liveStats?.activeBones ?? RIG_SPECS[rigId].joints.length}j
                    </span>
                  </div>
                  {activeClipSpec.auditNote && (
                    <div className="metric" style={{ maxWidth: 280 }}>
                      <span className="metric-label" style={{ color: 'var(--warn)' }}>
                        Audit Note
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--warn)', lineHeight: 1.3 }}>
                        {activeClipSpec.auditNote}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="metric">
                    <span className="metric-label">3&times;3 Clip Wall</span>
                    <span className="metric-val" style={{ color: 'var(--accent)' }}>
                      Page {safePage + 1} / {pageCount} ({wallSlice.length} shown)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="pill-btn"
                      disabled={safePage === 0}
                      onClick={() => setWallPage((p) => Math.max(0, p - 1))}
                    >
                      &lsaquo; Prev Page
                    </button>
                    <button
                      className="pill-btn"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setWallPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next Page &rsaquo;
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="hud-card" style={{ alignItems: 'center', gap: 8 }}>
              {viewMode === 'focus' ? (
                <>
                  {CAMERA_ANGLE_OPTIONS.map((cam) => (
                    <button
                      key={cam.id}
                      className={`pill-btn ${cameraAngle === cam.id ? 'active' : ''}`}
                      onClick={() => {
                        setCameraAngle(cam.id)
                        setViewEpoch((v) => v + 1)
                      }}
                    >
                      {cam.label}
                    </button>
                  ))}
                  <button
                    className={`pill-btn ${turntable ? 'active' : ''}`}
                    onClick={() => setTurntable((t) => !t)}
                  >
                    Turntable
                  </button>
                </>
              ) : (
                <>
                  {WALL_YAW_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`pill-btn ${Math.abs(wallYaw - opt.yaw) < 0.01 ? 'active' : ''}`}
                      onClick={() => setWallYaw(opt.yaw)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              )}
              <button
                className={`pill-btn ${showSkeleton ? 'active' : ''}`}
                title="Toggle Bone Skeleton overlay (B)"
                onClick={() => setShowSkeleton((s) => !s)}
              >
                Skeleton: {showSkeleton ? 'On' : 'Off'}
              </button>
              {viewMode === 'wall' && (
                <button className="pill-btn" onClick={() => setPaused((p) => !p)}>
                  {paused ? 'Play All' : 'Pause All'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="review-dock">
          <div className="review-transport-row">
            <button className="pill-btn" title="Previous Clip (K / Up)" onClick={() => stepClip(-1)}>
              &lsaquo; Prev
            </button>
            <button
              className="btn-primary"
              style={{ minWidth: 74 }}
              title="Play / Pause (Space)"
              onClick={() => {
                if (paused && progress.phase >= 0.99 && !loopAll && !nativeLoop) {
                  setReplayKey((k) => k + 1)
                }
                setPaused((p) => !p)
              }}
            >
              {paused ? 'Play' : 'Pause'}
            </button>
            <button
              className="pill-btn"
              title="Restart clip from frame 0"
              onClick={() => {
                setReplayKey((k) => k + 1)
                setPaused(false)
              }}
            >
              Replay
            </button>
            <button className="pill-btn" title="Step -1 frame ([)" onClick={() => stepFrame(-1)}>
              -1f
            </button>
            <button className="pill-btn" title="Step +1 frame (])" onClick={() => stepFrame(1)}>
              +1f
            </button>

            <input
              type="range"
              aria-label="Clip timeline"
              min={0}
              max={1}
              step={0.002}
              value={progress.phase}
              style={{ flex: 1, minWidth: 140 }}
              onChange={(e) => {
                setPaused(true)
                seekPhase(Number(e.target.value))
              }}
            />

            <span className="review-timecode">
              {progress.time.toFixed(2)}s / {activeClipSpec.duration.toFixed(2)}s
            </span>

            <div className="preset-pills">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  className={`pill-btn ${playbackRate === spd ? 'active' : ''}`}
                  onClick={() => setPlaybackRate(spd)}
                >
                  {spd}&times;
                </button>
              ))}
            </div>

            <button
              className={`pill-btn ${loopAll ? 'active' : ''}`}
              title="Force one-shot clips (Death, Roll, Shoot) to repeat continuously"
              onClick={() => setLoopAll((l) => !l)}
            >
              {loopAll ? 'Loop: All' : nativeLoop ? 'Loop: Auto' : 'Loop: 1-Shot'}
            </button>

            <button className="pill-btn" title="Next Clip (J / Down)" onClick={() => stepClip(1)}>
              Next &rsaquo;
            </button>
          </div>

          <div className="review-verdict-row">
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Verdict:</span>
            <button
              className={`pill-btn ${currentStatus === 'pass' ? 'verdict-pass-active' : ''}`}
              title="Mark clip Pass (P)"
              onClick={() => setReviewStatus(rigId, activeClipSpec.name, currentStatus === 'pass' ? 'todo' : 'pass')}
            >
              ✓ Pass
            </button>
            <button
              className={`pill-btn ${currentStatus === 'issue' ? 'verdict-issue-active' : ''}`}
              title="Mark clip Issue (I)"
              onClick={() => setReviewStatus(rigId, activeClipSpec.name, currentStatus === 'issue' ? 'todo' : 'issue')}
            >
              ✕ Issue
            </button>
            <input
              type="text"
              placeholder={`Notes for ${activeClipSpec.name} (saved locally)...`}
              value={currentNote}
              onChange={(e) => setReviewNote(rigId, activeClipSpec.name, e.target.value)}
              style={{ flex: 1 }}
            />
            <span className="review-shortcuts-hint">
              Space Play/Pause · [ / ] Frame · ↑/↓ Clip · P Pass · I Issue · B Bones
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
