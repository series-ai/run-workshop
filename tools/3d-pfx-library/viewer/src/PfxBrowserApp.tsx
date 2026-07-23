import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type WheelEvent as ReactWheelEvent } from 'react'
import { MathUtils, Vector3, type Group } from 'three'
import {
  ART_STYLE_CLUSTERS,
  AUTHORED_EFFECT_RECIPES,
  PFX_BEHAVIOR_ROLE_REVIEW_ORDER,
  EFFECT_TYPE_FILTERS,
  GamePfx,
  PFX_CONTROL_DEFINITIONS,
  PFX_MOBILE_RUNTIME_POLICY,
  createPfxStructuralQualityAudit,
  createPfxProductionReadinessReport,
  createPfxStressScenario,
  createPfxPreset,
  exportPfxComponentSnippet,
  exportPfxDeveloperDocsMarkdown,
  exportPfxPreviewManifestJson,
  exportPfxPresetJson,
  filterPfxCatalog,
  getPfxBurstCycleSeconds,
  getPfxComputedMobileSafety,
  summarizePfxPerformance,
  type ArtStyleCluster,
  type EffectSpace,
  type EffectType,
  type LoopMode,
  type PerformanceTier,
  type PfxAcceptanceStatus,
  type PfxCatalogItem,
  type PfxControls,
  type PfxPresetOverrides,
  type PfxAuthoredRecipe,
  type PfxProductionReadinessEffect,
} from '@pfx'
import {
  PFX_TRANSPORT_SPEEDS,
  PFX_TRANSPORT_STEP_SECONDS,
  advancePfxTransport,
  createPfxTransportState,
  pfxTransportPreviewSeconds,
  restartPfxTransport,
  scrubPfxTransport,
  stopPfxTransport,
  togglePfxTransport,
  type PfxTransportState,
} from './transport'
import {
  createBrowserProfileReport,
  createUnavailableWebglProfile,
  isChromeAndroidRealDeviceUserAgent,
  isMobileSafariRealDeviceUserAgent,
  sustainedDeviceTelemetryPasses,
  summarizeFrameSamples,
  type BrowserProfileCapture,
  type BrowserProfileInput,
  type BrowserProfileReport,
  type BrowserProfileCapturePlatform,
  type WebglProfile,
} from './profiling'

const TIERS: PerformanceTier[] = ['low', 'medium', 'high', 'cinematic']
const LOOP_MODES: LoopMode[] = ['burst', 'loop']
const SPACES: EffectSpace[] = ['world', 'ui']
const COVERAGE: PfxAcceptanceStatus[] = ['authored-preview', 'profile-backed']
const AUTO_UPLOAD_MIN_FRAME_SAMPLES = 60
const FEED_COLUMNS = 3
const FEED_TILE_HEIGHT_PX = 240
export const PFX_REVIEW_WEAPON_MAX_METALNESS = 0.45
type PfxReviewFraming = 'isolated' | 'gameplay-context'

export function createPfxReviewReferencePosition(effectId?: string): [number, number, number] {
  if (effectId === 'muzzle-flash') return [-2.3, -0.48, -0.45]
  if (effectId === 'healing-aura' || effectId === 'frost-aura' || effectId === 'shield-break' || effectId === 'barrier-low-health' || effectId === 'flame-charge' || effectId === 'electric-critical') return [0, -0.48, 0]
  // Put the near arm on the origin so contact effects prove an actual hit
  // rather than floating between the effect and a distant scale mannequin.
  if (effectId === 'hit-spark' || effectId === 'ghost-critical') return [-0.28, -0.48, -0.18]
  return [1.55, -0.48, -0.75]
}

export function createPfxReviewEffectPosition(
  effectId: string | undefined,
  framing: PfxReviewFraming,
): [number, number, number] {
  if (framing === 'gameplay-context' && effectId === 'ghost-critical') return [0.32, 0.38, 0]
  if (framing === 'gameplay-context' && effectId === 'hit-spark') return [0, 0.55, 0]
  if (framing === 'gameplay-context' && effectId === 'electric-critical') return [0.78, 0.48, 0.14]
  // Flame charge is a held combat tell. Put its crucible at the forward hand
  // so scale and gameplay intent remain legible in the acceptance fixture.
  if (framing === 'gameplay-context' && effectId === 'flame-charge') return [0.56, 0.24, 0.1]
  // Character-bound defensive effects must visibly enclose the scale fixture;
  // staging them beside it falsely presents a detached world-space orb.
  if (framing === 'gameplay-context' && (effectId === 'shield-break' || effectId === 'barrier-low-health')) return [0, 0.65, 0]
  // Small ground-contact effects are authored below the world origin. When
  // isolated auto-framing zooms them for inspection, that semantic offset
  // otherwise pushes the whole effect below the screenshot rather than
  // revealing more detail. Gameplay context keeps the true ground anchor.
  if (framing === 'isolated' && effectId === 'footstep-dust') return [0, 0.78, 0]
  return [0, 0.05, 0]
}

/**
 * Gallery scope for the infinite scroller: optionally filter to a behavior-role
 * group, then keep the full scoped list so virtualized scroll covers everything.
 * Pure so the feed contract is testable without the browser.
 */
export function createPfxFeedScope<T extends { effect: { role: string } }>(
  items: readonly T[],
  role: string,
): { items: T[]; scopedCount: number } {
  const scoped = role === 'all' ? [...items] : items.filter((item) => item.effect.role === role)
  return {
    items: scoped,
    scopedCount: scoped.length,
  }
}
const PFX_STAGE_TARGET = new Vector3(0, 0.15, 0)

interface PfxOrbitState {
  yaw: number
  pitch: number
  distance: number
}

function OrbitCameraRig({ orbit, autoRotate }: { orbit: RefObject<PfxOrbitState>; autoRotate: boolean }) {
  const { camera } = useThree()
  useFrame((_, delta) => {
    const current = orbit.current
    if (!current) return
    if (autoRotate) current.yaw += delta * 0.12
    const horizontal = Math.cos(current.pitch) * current.distance
    camera.position.set(
      Math.sin(current.yaw) * horizontal,
      PFX_STAGE_TARGET.y + Math.sin(current.pitch) * current.distance,
      Math.cos(current.yaw) * horizontal,
    )
    camera.lookAt(PFX_STAGE_TARGET)
    camera.updateProjectionMatrix()
  })
  return null
}

function PfxGameplayContext({ effectId }: { effectId?: string }) {
  if (effectId === 'hit-spark') {
    return (
      <group name="pfx-hit-contact-fixture">
        <mesh name="pfx-hit-incoming-strike" position={[-0.58, 0.55, 0.12]} rotation={[0, 0, -Math.PI / 2]}>
          <capsuleGeometry args={[0.045, 0.9, 5, 10]} />
          <meshStandardMaterial color="#475569" roughness={0.58} metalness={0.18} />
        </mesh>
        <mesh name="pfx-hit-target-plate" position={[0.05, 0.55, -0.12]}>
          <boxGeometry args={[0.5, 0.58, 0.06]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} metalness={0.32} />
        </mesh>
        <mesh name="pfx-hit-contact-inset" position={[0.05, 0.55, -0.085]} scale={[0.23, 0.27, 0.02]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#334155" roughness={0.62} metalness={0.16} />
        </mesh>
      </group>
    )
  }
  if (effectId !== 'muzzle-flash') return null
  return (
    <group name="muzzle-barrel-origin" position={[0, 0.05, 0]}>
      <mesh name="review-weapon-muzzle-brake" position={[-0.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.085, 0.16, 16]} />
        <meshStandardMaterial color="#7c8da3" roughness={0.28} metalness={0.42} />
      </mesh>
      <mesh name="review-weapon-barrel" position={[-0.43, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.052, 0.06, 0.62, 16]} />
        <meshStandardMaterial color="#66768a" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh name="review-weapon-handguard" position={[-0.73, 0, 0]} scale={[0.31, 0.13, 0.15]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#53647a" roughness={0.4} metalness={0.35} />
      </mesh>
      <mesh name="review-weapon-receiver" position={[-1.12, -0.01, 0]} scale={[0.42, 0.2, 0.18]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#44566e" roughness={0.36} metalness={0.32} />
      </mesh>
      <mesh name="review-weapon-stock" position={[-1.62, -0.02, 0]} rotation={[0, 0, -0.08]} scale={[0.56, 0.23, 0.16]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#35475e" roughness={0.48} metalness={0.22} />
      </mesh>
      <mesh name="review-weapon-grip" position={[-1.16, -0.31, 0]} rotation={[0, 0, -0.28]} scale={[0.13, 0.34, 0.13]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#303b4b" roughness={0.64} metalness={0.12} />
      </mesh>
      <mesh name="review-weapon-magazine" position={[-0.9, -0.29, 0]} rotation={[0, 0, 0.12]} scale={[0.15, 0.32, 0.15]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#46576c" roughness={0.52} metalness={0.25} />
      </mesh>
      <mesh name="review-weapon-top-rail" position={[-0.96, 0.18, 0]} scale={[0.58, 0.045, 0.09]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#8392a7" roughness={0.32} metalness={0.4} />
      </mesh>
      <mesh name="review-weapon-sight" position={[-0.78, 0.27, 0]} scale={[0.08, 0.13, 0.08]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#a8b6c9" roughness={0.28} metalness={0.45} />
      </mesh>
    </group>
  )
}

function PfxStageEnvironment({ effectId, reviewFraming }: { effectId?: string; reviewFraming: PfxReviewFraming }) {
  const referencePosition = createPfxReviewReferencePosition(effectId)
  return (
    <>
      <color attach="background" args={['#111827']} />
      <fog attach="fog" args={['#111827', 7, 15]} />
      <hemisphereLight args={['#c7d2fe', '#111827', 1.15]} />
      <directionalLight position={[4, 6, 3]} intensity={2.1} color="#f8fafc" />
      <directionalLight position={[-3, 2, -4]} intensity={0.8} color={effectId === 'muzzle-flash' ? '#f59e0b' : '#38bdf8'} />
      {reviewFraming === 'gameplay-context' ? (
        <>
          <mesh position={[0, -1.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[4.8, 64]} />
            <meshStandardMaterial color="#111827" roughness={0.82} metalness={0.12} />
          </mesh>
          <gridHelper args={[8, 16, '#334155', '#1e293b']} position={[0, -1.065, 0]} />
          <group name="pfx-scale-reference" position={referencePosition}>
            <mesh name="review-character-torso" position={[0, 0.65, 0]}>
              <capsuleGeometry args={[0.22, 0.72, 6, 12]} />
              <meshStandardMaterial color="#64748b" transparent opacity={0.72} roughness={0.7} />
            </mesh>
            <mesh name="review-character-head" position={[0, 1.35, 0]}>
              <sphereGeometry args={[0.24, 16, 12]} />
              <meshStandardMaterial color="#94a3b8" transparent opacity={0.72} roughness={0.7} />
            </mesh>
            <mesh name="review-character-left-arm" position={[-0.32, 0.76, 0]} rotation={[0, 0, -0.18]}>
              <capsuleGeometry args={[0.075, 0.55, 5, 10]} />
              <meshStandardMaterial color="#64748b" transparent opacity={0.72} roughness={0.7} />
            </mesh>
            <mesh name="review-character-right-arm" position={[0.32, 0.76, 0]} rotation={[0, 0, 0.18]}>
              <capsuleGeometry args={[0.075, 0.55, 5, 10]} />
              <meshStandardMaterial color="#64748b" transparent opacity={0.72} roughness={0.7} />
            </mesh>
          </group>
        </>
      ) : null}
    </>
  )
}

function PfxGalleryTileStage() {
  return (
    <>
      {/* Floor matches the runtime ground-anchor offset (y = -0.88) — a
          higher tile floor made ground markers render underground. */}
      <mesh position={[0, -0.89, -0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.95, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.18} />
      </mesh>
      <gridHelper args={[1.9, 8, '#475569', '#263244']} position={[0, -0.88, -0.08]} />
    </>
  )
}

function FeedTiles({
  items,
  reducedMotion,
  scrollTopRef,
  firstRow,
  lastRow,
}: {
  items: PfxCatalogItem[]
  reducedMotion: boolean
  scrollTopRef: RefObject<number>
  firstRow: number
  lastRow: number
}) {
  const { viewport, size } = useThree()
  const groupRef = useRef<Group>(null)
  const worldPerPx = viewport.height / size.height
  const tileWorldWidth = viewport.width / FEED_COLUMNS
  const tileWorldHeight = FEED_TILE_HEIGHT_PX * worldPerPx
  const visible = useMemo(
    () => items.slice(firstRow * FEED_COLUMNS, (lastRow + 1) * FEED_COLUMNS).map((item, sliceIndex) => ({
      item,
      index: firstRow * FEED_COLUMNS + sliceIndex,
      preset: createPfxPreset(item.effect.id, { seed: item.preset.seed }),
    })),
    [firstRow, items, lastRow],
  )
  useFrame(() => {
    if (!groupRef.current) return
    // Scroll-link: the DOM scroller owns scrolling; the canvas world shifts to
    // keep each tile aligned with its DOM cell.
    groupRef.current.position.y = (scrollTopRef.current ?? 0) * worldPerPx
  })
  return (
    <group ref={groupRef}>
      {visible.map(({ item, index, preset }) => {
        const column = index % FEED_COLUMNS
        const row = Math.floor(index / FEED_COLUMNS)
        const x = ((column + 0.5) / FEED_COLUMNS - 0.5) * viewport.width
        // Content-space y: row centers march downward from the canvas top;
        // 0.45 leaves room for each cell's bottom label.
        const y = viewport.height / 2 - (row + 0.45) * tileWorldHeight
        const scale = Math.min(tileWorldWidth, tileWorldHeight) * 0.3
        return (
          <group key={item.effect.id} position={[x, y, 0]} scale={scale}>
            <PfxGalleryTileStage />
            {/* Gallery tiles: billboard-only for screen effects — a full
                camera pin drags every ui-space tile onto one spot. */}
            <GamePfx preset={preset} reducedMotion={reducedMotion} screenAnchor={false} />
          </group>
        )
      })}
    </group>
  )
}

function PfxFeed({
  items,
  reducedMotion,
  onSelect,
  epoch = 0,
  mobileSafeIds,
  markFilter,
}: {
  items: PfxCatalogItem[]
  reducedMotion: boolean
  onSelect: (effectId: string) => void
  /** Bumping remounts the shared canvas, restarting every tile from t=0. */
  epoch?: number
  mobileSafeIds: ReadonlySet<string>
  markFilter: PfxMarkFilter | null
}) {
  const scrollTopRef = useRef(0)
  const [rowRange, setRowRange] = useState({ first: 0, last: 8 })
  const rows = Math.ceil(items.length / FEED_COLUMNS)
  const updateRange = (element: HTMLDivElement) => {
    scrollTopRef.current = element.scrollTop
    const first = Math.max(0, Math.floor(element.scrollTop / FEED_TILE_HEIGHT_PX) - 1)
    const last = Math.min(
      Math.max(0, rows - 1),
      Math.ceil((element.scrollTop + element.clientHeight) / FEED_TILE_HEIGHT_PX) + 1,
    )
    setRowRange((current) => (current.first === first && current.last === last ? current : { first, last }))
  }
  return (
    <div className="pfx-feed" data-testid="pfx-feed">
      <div className="pfx-feed-canvas">
        <Canvas
          key={epoch}
          camera={{ position: [0.8, 0.55, 4.2], fov: 46 }}
          dpr={PFX_MOBILE_RUNTIME_POLICY.canvasDprRange}
          gl={{
            antialias: PFX_MOBILE_RUNTIME_POLICY.webgl.antialias,
            alpha: PFX_MOBILE_RUNTIME_POLICY.webgl.alpha,
            powerPreference: PFX_MOBILE_RUNTIME_POLICY.webgl.powerPreference,
          }}
        >
          <color attach="background" args={['#111827']} />
          <hemisphereLight args={['#dbeafe', '#0f172a', 1.25]} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <FeedTiles
            items={items}
            reducedMotion={reducedMotion}
            scrollTopRef={scrollTopRef}
            firstRow={rowRange.first}
            lastRow={rowRange.last}
          />
        </Canvas>
      </div>
      <div className="pfx-feed-scroll" onScroll={(event) => updateRange(event.currentTarget)}>
        <div className="pfx-feed-rows" style={{ height: rows * FEED_TILE_HEIGHT_PX }}>
          {items.map((item, index) => (
            <button
              key={item.effect.id}
              type="button"
              className="pfx-feed-cell pfx-row"
              data-effect-id={item.effect.id}
              style={{
                top: Math.floor(index / FEED_COLUMNS) * FEED_TILE_HEIGHT_PX,
                left: `${(index % FEED_COLUMNS) * (100 / FEED_COLUMNS)}%`,
              }}
              onClick={() => onSelect(item.effect.id)}
            >
              {markFilter?.ids.has(item.effect.id) ? (
                <span className="pfx-feed-mark" data-testid="pfx-feed-mark">
                  {markFilter.label}
                </span>
              ) : null}
              <span className="pfx-feed-label">
                {item.effect.name}
                <span className="pfx-feed-type">
                  {item.effect.role} · {item.effect.effectType}
                  {mobileSafeIds.has(item.effect.id) ? '' : ' · '}
                  {mobileSafeIds.has(item.effect.id) ? null : (
                    <span className="pfx-feed-unsafe">not mobile-safe</span>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
// Behavioral review-role hierarchy: one manual pass per ROLE (what the
// effect does), then group recipes transfer. Roles are behavior-derived in
// the library taxonomy — never from the theme word in the name.
const PFX_ROLE_REVIEW_RANK = new Map(PFX_BEHAVIOR_ROLE_REVIEW_ORDER.map((role, index) => [role as string, index]))

const PFX_DOD_QUICK_SEARCHES = [
  { label: 'Force field', query: 'force field', effectId: 'force-field', mobileSafeOnly: true },
  { label: 'Fireball', query: 'fireball', effectId: 'fireball', mobileSafeOnly: true },
  { label: 'Cozy pickup sparkle', query: 'cozy pickup sparkle', effectId: 'coin-pickup-sparkle', mobileSafeOnly: true },
  { label: 'Mobile-safe hit impact', query: 'mobile-safe hit impact', effectId: 'hit-spark', mobileSafeOnly: true },
] as const



interface PfxEmitterEdit {
  opacity?: number
  scale?: number
  tuning: Record<string, unknown>
}

const EMITTER_NUMERIC_FIELDS: Array<{ key: string; label: string; step: number }> = [
  { key: 'delay', label: 'delay', step: 0.01 },
  { key: 'window', label: 'window', step: 0.01 },
  { key: 'lifeScale', label: 'life', step: 0.05 },
  { key: 'countScale', label: 'count', step: 0.05 },
  { key: 'speedScale', label: 'speed', step: 0.05 },
  { key: 'gravity', label: 'gravity', step: 0.1 },
  { key: 'drag', label: 'drag', step: 0.1 },
  { key: 'spinScale', label: 'spin', step: 0.1 },
  { key: 'stretch', label: 'stretch', step: 0.1 },
  { key: 'spawnScale', label: 'spawn', step: 0.05 },
  { key: 'spawnLift', label: 'lift', step: 0.05 },
  { key: 'flicker', label: 'flicker', step: 0.05 },
  { key: 'turbulenceScale', label: 'turb', step: 0.05 },
]

const EMITTER_ENUM_FIELDS: Array<{ key: string; label: string; options: string[] }> = [
  { key: 'blend', label: 'blend', options: ['default', 'additive', 'alpha'] },
  { key: 'ramp', label: 'ramp', options: ['default', 'hot', 'held', 'pinned-hot', 'dark'] },
  { key: 'bands', label: 'bands', options: ['off', '2', '3'] },
  { key: 'death', label: 'death', options: ['default', 'erode'] },
  { key: 'ease', label: 'ease', options: ['default', 'snap'] },
]

// Per-layer inspector: every emitter of the selected effect, toggleable and
// editable in place. Edits build a working recipe copy that drives the live
// render via recipeOverride — nothing here mutates the library.
function PfxEmitterPanel({
  recipe,
  edits,
  disabled,
  onToggle,
  onEdit,
  onReset,
}: {
  recipe: PfxAuthoredRecipe
  edits: Record<string, PfxEmitterEdit>
  disabled: ReadonlySet<string>
  onToggle: (phase: string) => void
  onEdit: (phase: string, field: string, value: unknown, level: 'surface' | 'tuning') => void
  onReset: () => void
}) {
  const [copied, setCopied] = useState(false)
  const hasChanges = Object.keys(edits).length > 0 || disabled.size > 0
  return (
    <section className="pfx-emitters" data-testid="pfx-emitter-panel" aria-label="Emitters">
      <div className="pfx-emitters-header">
        <h2>Emitters ({recipe.surfaces.length})</h2>
        <div>
          <button
            type="button"
            data-testid="pfx-emitter-copy"
            onClick={(event) => {
              event.preventDefault()
              const working = {
                ...recipe,
                surfaces: recipe.surfaces
                  .filter((surface) => !disabled.has(surface.phase ?? surface.kind))
                  .map((surface) => applyEmitterEdit(surface, edits[surface.phase ?? surface.kind])),
              }
              navigator.clipboard?.writeText(JSON.stringify(working, null, 2)).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
          >
            {copied ? 'Copied ✓' : 'Copy recipe JSON'}
          </button>
          {hasChanges ? (
            <button type="button" data-testid="pfx-emitter-reset" onClick={onReset}>
              Reset edits
            </button>
          ) : null}
        </div>
      </div>
      {recipe.surfaces.map((surface) => {
        const phase = surface.phase ?? surface.kind
        const edit = edits[phase]
        const effective = applyEmitterEdit(surface, edit)
        const off = disabled.has(phase)
        return (
          <details key={phase} className={off ? 'pfx-emitter pfx-emitter-off' : 'pfx-emitter'}>
            <summary>
              <input
                type="checkbox"
                className="pfx-emitter-toggle"
                data-testid={`pfx-emitter-toggle-${phase}`}
                aria-label={`Toggle ${phase}`}
                checked={!off}
                onClick={(event) => event.stopPropagation()}
                onChange={() => onToggle(phase)}
              />
              <span className="pfx-emitter-name">{phase}</span>
              <span className="pfx-emitter-kind">
                {surface.kind} / {surface.role}
                {edit ? ' · edited' : ''}
              </span>
            </summary>
            <div className="pfx-emitter-fields">
              <label>
                <span>opacity</span>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  max={1}
                  value={round2(effective.opacity)}
                  onChange={(event) => onEdit(phase, 'opacity', Number(event.target.value), 'surface')}
                />
              </label>
              <label>
                <span>scale</span>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={round2(effective.scale)}
                  onChange={(event) => onEdit(phase, 'scale', Number(event.target.value), 'surface')}
                />
              </label>
              {/* Manual placement: ADDS to the semantic anchor. Copy the
                  working recipe (button above) to hand tuned values back. */}
              {[0, 1, 2].map((axis) => {
                const current = ((effective.tuning as Record<string, unknown> | undefined)?.['positionOffset'] as number[] | undefined) ?? [0, 0, 0]
                return (
                  <label key={`pos-${axis}`}>
                    <span>{['pos x', 'pos y', 'pos z'][axis]}</span>
                    <input
                      type="number"
                      step={0.05}
                      value={round2(current[axis] ?? 0)}
                      onChange={(event) => {
                        const next = [...current]
                        next[axis] = Number(event.target.value)
                        onEdit(phase, 'positionOffset', next, 'tuning')
                      }}
                    />
                  </label>
                )
              })}
              {Array.isArray((effective.tuning as Record<string, unknown> | undefined)?.['spawnOffset'])
                ? (((effective.tuning as Record<string, unknown>)['spawnOffset'] as number[]).map((component, index) => (
                    <label key={`spawn-${index}`}>
                      <span>{['spawn x', 'spawn y', 'spawn z'][index]}</span>
                      <input
                        type="number"
                        step={0.05}
                        value={round2(component)}
                        onChange={(event) => {
                          const next = [...((effective.tuning as Record<string, unknown>)['spawnOffset'] as number[])]
                          next[index] = Number(event.target.value)
                          onEdit(phase, 'spawnOffset', next, 'tuning')
                        }}
                      />
                    </label>
                  )))
                : null}
              {EMITTER_NUMERIC_FIELDS.map(({ key, label, step }) => {
                const raw = (effective.tuning as Record<string, unknown> | undefined)?.[key]
                if (raw === undefined && edit?.tuning[key] === undefined && !(key in (surface.tuning ?? {}))) {
                  // Only show fields the layer actually uses, plus always-core timing.
                  if (key !== 'delay' && key !== 'window' && key !== 'lifeScale') return null
                }
                return (
                  <label key={key}>
                    <span>{label}</span>
                    <input
                      type="number"
                      step={step}
                      value={round2(typeof raw === 'number' ? raw : 0)}
                      onChange={(event) => onEdit(phase, key, Number(event.target.value), 'tuning')}
                    />
                  </label>
                )
              })}
              {Array.isArray((effective.tuning as Record<string, unknown> | undefined)?.['size'])
                ? ((effective.tuning as Record<string, unknown>)['size'] as number[]).map((component, index) => (
                    <label key={`size-${index}`}>
                      <span>{['size from', 'size mid', 'size to'][index]}</span>
                      <input
                        type="number"
                        step={0.05}
                        value={round2(component)}
                        onChange={(event) => {
                          const next = [...((effective.tuning as Record<string, unknown>)['size'] as number[])]
                          next[index] = Number(event.target.value)
                          onEdit(phase, 'size', next, 'tuning')
                        }}
                      />
                    </label>
                  ))
                : null}
              {EMITTER_ENUM_FIELDS.map(({ key, label, options }) => {
                const raw = (effective.tuning as Record<string, unknown> | undefined)?.[key]
                const value = raw === undefined ? options[0]! : String(raw)
                return (
                  <label key={key}>
                    <span>{label}</span>
                    <select
                      value={value}
                      onChange={(event) => {
                        const selected = event.target.value
                        const parsed =
                          selected === 'default' || selected === 'off'
                            ? undefined
                            : key === 'bands'
                              ? Number(selected)
                              : selected
                        onEdit(phase, key, parsed, 'tuning')
                      }}
                    >
                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              })}
            </div>
          </details>
        )
      })}
    </section>
  )
}

function round2(value: number | undefined): number {
  return Math.round(((value ?? 0) + Number.EPSILON) * 100) / 100
}

function applyEmitterEdit(
  surface: PfxAuthoredRecipe['surfaces'][number],
  edit: PfxEmitterEdit | undefined,
): PfxAuthoredRecipe['surfaces'][number] {
  if (!edit) return surface
  return {
    ...surface,
    opacity: edit.opacity ?? surface.opacity,
    scale: edit.scale ?? surface.scale,
    tuning: { ...surface.tuning, ...edit.tuning } as typeof surface.tuning,
  }
}

function PfxTransportBar({
  transport,
  onChange,
}: {
  transport: PfxTransportState
  onChange: (next: PfxTransportState) => void
}) {
  const playing = transport.status === 'playing'
  return (
    <div className="pfx-transport" data-testid="pfx-transport" role="group" aria-label="Preview transport">
      <button
        type="button"
        className="pfx-transport-play"
        aria-label={playing ? 'Pause' : 'Play'}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        onClick={() => onChange(togglePfxTransport(transport))}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button type="button" aria-label="Stop" title="Stop — park at t=0" onClick={() => onChange(stopPfxTransport(transport))}>
        ■
      </button>
      <button type="button" aria-label="Restart" title="Restart (R)" onClick={() => onChange(restartPfxTransport(transport))}>
        ↻
      </button>
      <input
        type="range"
        aria-label="Timeline"
        min={0}
        max={transport.windowSeconds}
        step={PFX_TRANSPORT_STEP_SECONDS}
        value={transport.status === 'live' ? 0 : transport.timeSeconds}
        onChange={(event) => onChange(scrubPfxTransport(transport, Number(event.target.value)))}
      />
      <span className="pfx-transport-time">
        {transport.status === 'live' ? 'live' : `${transport.timeSeconds.toFixed(2)}s`}
      </span>
      <label className="pfx-transport-speed">
        <span>Speed</span>
        <select
          aria-label="Speed"
          value={transport.speed}
          onChange={(event) => onChange({ ...transport, speed: Number(event.target.value) })}
        >
          {PFX_TRANSPORT_SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </select>
      </label>
      <label className="pfx-transport-loop">
        <input
          type="checkbox"
          checked={transport.loop}
          onChange={(event) => onChange({ ...transport, loop: event.target.checked })}
        />
        <span>Loop</span>
      </label>
      <button
        type="button"
        className="pfx-transport-live"
        aria-pressed={transport.status === 'live'}
        title="Return to free-running live clock"
        onClick={() => onChange(createPfxTransportState())}
      >
        Live
      </button>
    </div>
  )
}

export function PfxBrowserApp() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const orbitRef = useRef<PfxOrbitState>(createInitialPfxOrbitState())
  const orbitDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const reviewCameraLocked = readReviewCamera() !== null
  const reviewFraming = readReviewFraming()
  const reviewTimeSeconds = readReviewTimeSeconds()
  const initialProfileEffectIds = useMemo(() => readProfileEffectIds(), [])
  const initialProfileEffectId = initialProfileEffectIds?.[0]
  const initialProfileConcurrency = useMemo(() => readProfileConcurrency(), [])
  const markFilter = useMemo(() => readPfxMarkFilter(), [])
  const [frameSamples, setFrameSamples] = useState<number[]>([])
  const [query, setQuery] = useState(initialProfileEffectId ?? '')
  const [style, setStyle] = useState<ArtStyleCluster | 'all'>('all')
  const [effectType, setEffectType] = useState<EffectType | 'all'>('all')
  const [tier, setTier] = useState<PerformanceTier | 'all'>('all')
  const [coverage, setCoverage] = useState<PfxAcceptanceStatus | 'all'>('all')
  const [loopMode, setLoopMode] = useState<LoopMode | 'all'>('all')
  const [space, setSpace] = useState<EffectSpace | 'all'>('all')
  const [useCase, setUseCase] = useState<string>('all')
  const [emotionMood, setEmotionMood] = useState<string>('all')
  const [colorFamily, setColorFamily] = useState<string>('all')
  const [assetRequirement, setAssetRequirement] = useState<string>('all')
  // Everything is viewable by default — non-mobile-safe effects are shown
  // with an explicit badge instead of being silently filtered out. The
  // Mobile safe checkbox remains as an opt-in filter.
  const [mobileSafeOnly, setMobileSafeOnly] = useState(false)
  // Badges tell the COMPUTED truth (benchmark-screened estimated cost), not
  // the legacy name-based taxonomy tag — post-diet effects earn their badge
  // back. The Mobile safe checkbox still filters by the legacy tag until the
  // catalog-wide perf pass replaces it everywhere.
  const mobileSafeIds = useMemo(
    () => new Set(filterPfxCatalog({}).filter((item) => getPfxComputedMobileSafety(item.effect.id) === 'safe').map((item) => item.effect.id)),
    [],
  )
  // Capture/profile URLs must open on the exact single-effect detail scene;
  // plain visits open on the browsing feed.
  const [view, setView] = useState<'feed' | 'detail'>(initialProfileEffectId ? 'detail' : 'feed')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOrder, setSortOrder] = useState<'role' | 'name' | 'rank'>('role')
  const [previewMode, setPreviewMode] = useState<'single' | 'stress'>(initialProfileConcurrency ? 'stress' : 'single')
  const [exportFormat, setExportFormat] = useState<'component' | 'json' | 'manifest' | 'docs'>('component')
  const [concurrentEffects, setConcurrentEffects] = useState(initialProfileConcurrency ?? 20)
  const [selectedId, setSelectedId] = useState(initialProfileEffectId ?? 'force-field')
  const [controlOverrides, setControlOverrides] = useState<PfxPresetOverrides>({})
  const [transport, setTransport] = useState<PfxTransportState>(() => createPfxTransportState())
  const [presetCopied, setPresetCopied] = useState(false)
  const [feedEpoch, setFeedEpoch] = useState(0)
  useEffect(() => setPresetCopied(false), [selectedId, exportFormat, controlOverrides])
  const profileEffectIds = initialProfileEffectIds
  const realDeviceCapture = useMemo(() => readRealDeviceProfileCapture(), [])
  const reducedMotion = usePrefersReducedMotion()
  const beginOrbit = (event: ReactPointerEvent<HTMLDivElement>) => {
    orbitDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const updateOrbit = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = orbitDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const current = orbitRef.current
    current.yaw -= (event.clientX - drag.x) * 0.009
    current.pitch = MathUtils.clamp(current.pitch + (event.clientY - drag.y) * 0.007, -0.12, 1.18)
    drag.x = event.clientX
    drag.y = event.clientY
  }
  const endOrbit = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (orbitDragRef.current?.pointerId !== event.pointerId) return
    orbitDragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const zoomOrbit = (event: ReactWheelEvent<HTMLDivElement>) => {
    orbitRef.current.distance = MathUtils.clamp(orbitRef.current.distance + event.deltaY * 0.004, 3.2, 10)
  }

  const allItems = useMemo(() => filterPfxCatalog({}), [])
  const useCases = useMemo(
    () => [...new Set(allItems.flatMap((item) => item.effect.gameplayUseCases))].sort(),
    [allItems],
  )
  const emotionMoods = useMemo(
    () => [...new Set(allItems.flatMap((item) => item.effect.emotionMood))].sort(),
    [allItems],
  )
  const colorFamilies = useMemo(
    () => [...new Set(allItems.flatMap((item) => item.effect.colorFamily))].sort(),
    [allItems],
  )
  const assetRequirements = useMemo(
    () => [...new Set(allItems.flatMap((item) => item.effect.assetRequirements))].sort(),
    [allItems],
  )
  const productionReadiness = useMemo(() => createPfxProductionReadinessReport(), [])
  const structuralQuality = useMemo(() => createPfxStructuralQualityAudit(), [])
  const activeQuery = useMemo(
    () => ({
      query,
      style: style === 'all' ? undefined : [style],
      effectType: effectType === 'all' ? undefined : [effectType],
      performanceTier: tier === 'all' ? undefined : [tier],
      coverage: coverage === 'all' ? undefined : [coverage],
      loopMode: loopMode === 'all' ? undefined : [loopMode],
      space: space === 'all' ? undefined : [space],
      gameplayUseCase: useCase === 'all' ? undefined : [useCase],
      emotionMood: emotionMood === 'all' ? undefined : [emotionMood],
      colorFamily: colorFamily === 'all' ? undefined : [colorFamily],
      assetRequirements: assetRequirement === 'all' ? undefined : [assetRequirement],
      mobileSafeOnly,
    }),
    [
      assetRequirement,
      colorFamily,
      coverage,
      effectType,
      emotionMood,
      loopMode,
      mobileSafeOnly,
      query,
      space,
      style,
      tier,
      useCase,
    ],
  )
  const activeFilterChips = [
    effectType !== 'all' ? { key: 'type', label: `Type: ${effectType}`, clear: () => setEffectType('all') } : null,
    style !== 'all' ? { key: 'style', label: `Style: ${style}`, clear: () => setStyle('all') } : null,
    tier !== 'all' ? { key: 'tier', label: `Tier: ${tier}`, clear: () => setTier('all') } : null,
    coverage !== 'all' ? { key: 'coverage', label: `Coverage: ${coverage}`, clear: () => setCoverage('all') } : null,
    useCase !== 'all' ? { key: 'useCase', label: `Use case: ${useCase}`, clear: () => setUseCase('all') } : null,
    emotionMood !== 'all' ? { key: 'mood', label: `Mood: ${emotionMood}`, clear: () => setEmotionMood('all') } : null,
    colorFamily !== 'all' ? { key: 'color', label: `Color: ${colorFamily}`, clear: () => setColorFamily('all') } : null,
    assetRequirement !== 'all'
      ? { key: 'assets', label: `Assets: ${assetRequirement}`, clear: () => setAssetRequirement('all') }
      : null,
    loopMode !== 'all' ? { key: 'loop', label: `Loop: ${loopMode}`, clear: () => setLoopMode('all') } : null,
    space !== 'all' ? { key: 'space', label: `Space: ${space}`, clear: () => setSpace('all') } : null,
    mobileSafeOnly ? { key: 'mobileSafe', label: 'Mobile safe', clear: () => setMobileSafeOnly(false) } : null,
  ].filter((chip): chip is { key: string; label: string; clear: () => void } => chip !== null)

  const allMatchingItems = useMemo(() => filterPfxCatalog(activeQuery), [activeQuery])
  // Searching with Mobile safe on silently hid matches (e.g. "explosion"
  // returned zero results) — surface how many hits the filter is hiding.
  const mobileSafeHiddenMatches = useMemo(() => {
    if (!mobileSafeOnly || query.trim() === '') return 0
    return filterPfxCatalog({ ...activeQuery, mobileSafeOnly: false }).length - allMatchingItems.length
  }, [activeQuery, allMatchingItems.length, mobileSafeOnly, query])
  // 'type' groups by the review-order hierarchy (one manual pass per group,
  // then group recipes); 'name' is A-Z lookup; 'rank' is catalog order. The
  // same ordering drives the gallery, prev/next flipping, and the counter.
  const items = useMemo(() => {
    if (sortOrder === 'name') {
      return [...allMatchingItems].sort((left, right) => left.effect.name.localeCompare(right.effect.name))
    }
    if (sortOrder === 'role') {
      return [...allMatchingItems].sort((left, right) => {
        const leftRank = PFX_ROLE_REVIEW_RANK.get(left.effect.role) ?? 99
        const rightRank = PFX_ROLE_REVIEW_RANK.get(right.effect.role) ?? 99
        return leftRank - rightRank || left.effect.name.localeCompare(right.effect.name)
      })
    }
    return allMatchingItems
  }, [allMatchingItems, sortOrder])
  const [feedRole, setFeedRole] = useState<string>('all')
  const markedItems = useMemo(() => applyPfxMarkFilter(items, markFilter), [items, markFilter])
  const markedMatchCount = useMemo(
    () => (markFilter ? items.filter((item) => markFilter.ids.has(item.effect.id)).length : 0),
    [items, markFilter],
  )
  const feedRoleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of markedItems) counts.set(item.effect.role, (counts.get(item.effect.role) ?? 0) + 1)
    return counts
  }, [markedItems])
  const feed = useMemo(() => createPfxFeedScope(markedItems, feedRole), [feedRole, markedItems])
  const selected = items.find((item) => item.effect.id === selectedId) ?? items[0]
  const selectedIndex = selected ? items.findIndex((item) => item.effect.id === selected.effect.id) : -1
  const transportPreviewSeconds = pfxTransportPreviewSeconds(transport)
  const [emitterEdits, setEmitterEdits] = useState<Record<string, PfxEmitterEdit>>({})
  const [disabledEmitters, setDisabledEmitters] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    setEmitterEdits({})
    setDisabledEmitters(new Set())
  }, [selectedId])
  const authoredRecipe = selected ? (AUTHORED_EFFECT_RECIPES[selected.effect.id] ?? null) : null
  // The working recipe the live render actually plays: authored layers minus
  // toggled-off emitters, with inspector edits applied on top.
  const editedRecipe = useMemo(
    () =>
      authoredRecipe
        ? {
            ...authoredRecipe,
            surfaces: authoredRecipe.surfaces
              .filter((surface) => !disabledEmitters.has(surface.phase ?? surface.kind))
              .map((surface) => applyEmitterEdit(surface, emitterEdits[surface.phase ?? surface.kind])),
          }
        : undefined,
    [authoredRecipe, disabledEmitters, emitterEdits],
  )
  // Emitter toggles mute the SAME-named layer on both sides of the compare
  // so a layer can be isolated before vs after. Value edits stay AFTER-only:
  // they are proposed changes, and the baseline must keep rendering the
  // frozen truth.
  // Flipping swaps only the effect: camera orbit, transport mode/speed/loop,
  // filters, and control overrides all survive so effects stay comparable.
  // While playing, the new effect restarts from t=0 (fresh burst on arrival).
  const flipSelectedEffect = (direction: 1 | -1) => {
    if (items.length === 0) return
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0
    const nextIndex = (currentIndex + direction + items.length) % items.length
    setSelectedId(items[nextIndex]!.effect.id)
    setTransport((current) => (current.status === 'playing' ? restartPfxTransport(current) : current))
  }

  useEffect(() => {
    if (transport.status !== 'playing') return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - last) / 1000, 0.25)
      last = now
      setTransport((current) => advancePfxTransport(current, deltaSeconds))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [transport.status])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tag = target?.tagName ?? ''
      // Never hijack typing or native widget keyboard behavior.
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return
      switch (event.key === ' ' ? ' ' : event.key.toLowerCase()) {
        case ' ':
          event.preventDefault()
          setTransport((current) => togglePfxTransport(current))
          break
        case 'r':
          setTransport((current) => restartPfxTransport(current))
          break
        case '[':
          flipSelectedEffect(-1)
          break
        case ']':
          flipSelectedEffect(1)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })
  const selectedReadiness = selected
    ? productionReadiness.effects.find((effect) => effect.effectId === selected.effect.id)
    : undefined
  const selectedStructuralQuality = selected
    ? structuralQuality.effects.find((effect) => effect.effectId === selected.effect.id)
    : undefined
  const preset = useMemo(() => {
    if (!selected) return null
    return createPfxPreset(selected.effect.id, {
      seed: selected.preset.seed,
      ...controlOverrides,
    })
  }, [controlOverrides, selected])
  // A single play covers exactly ONE burst cycle — from first spawn to the
  // last particle gone — so the timeline window follows the selected
  // effect's real cycle duration instead of a fixed 2s.
  const cycleSeconds = preset ? getPfxBurstCycleSeconds(preset) : null
  useEffect(() => {
    if (cycleSeconds && Math.abs(cycleSeconds) > 0.001) {
      setTransport((current) =>
        Math.abs(current.windowSeconds - cycleSeconds) < 0.001
          ? current
          : { ...current, windowSeconds: cycleSeconds, timeSeconds: Math.min(current.timeSeconds, cycleSeconds) },
      )
    }
  }, [cycleSeconds])
  const stressScenario = useMemo(
    () =>
      createPfxStressScenario({
        id: 'browser-stress-preview',
        query: activeQuery,
        concurrentEffects,
        effectIds: profileEffectIds,
        repeatExplicitEffects: true,
      }),
    [activeQuery, concurrentEffects, profileEffectIds],
  )
  const profile = preset
    ? previewMode === 'stress'
      ? stressScenario.summary
      : summarizePfxPerformance([preset])
    : null
  const liveFrame = useMemo(() => summarizeFrameSamples(frameSamples), [frameSamples])
  const browserReport = useMemo<BrowserProfileReport | null>(() => {
    if (!profile || typeof window === 'undefined') return null
    const canvas = stageRef.current?.querySelector('canvas')
    const canvasProfile = canvas
      ? profileCanvasFromBrowserReadback(canvas, profile.totalParticles)
      : createEstimatedCanvasProfile(1, 1, profile.totalParticles)

    return createBrowserProfileReport({
      capturedAt: new Date().toISOString(),
      url: browserProfileReportUrl(window.location.href, realDeviceCapture),
      userAgent: window.navigator.userAgent,
      capture: realDeviceCapture,
      device: collectBrowserDeviceProfile(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        deviceScaleFactor: window.devicePixelRatio || 1,
        isMobile: window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 640,
      },
      scenario: {
        id:
          previewMode === 'stress'
            ? stressScenario.id
            : realDeviceCapture
              ? `mobile-${selected?.effect.id ?? 'none'}-single`
              : selected?.effect.id ?? 'none',
        mode: previewMode,
        effectCount: profile.effectCount,
        totalParticles: profile.totalParticles,
        totalDrawCalls: profile.totalDrawCalls,
        textureMemoryKb: profile.textureMemoryKb,
      },
      frameSamplesMs: frameSamples,
      webgl: canvas ? collectBrowserWebglProfile(canvas) : undefined,
      canvas: canvasProfile,
    })
  }, [frameSamples, previewMode, profile, realDeviceCapture, selected?.effect.id, stressScenario.id])
  const exportText = preset
    ? exportFormat === 'manifest'
      ? exportPfxPreviewManifestJson(allMatchingItems.map((item) => item.preset))
      : exportFormat === 'docs'
        ? exportPfxDeveloperDocsMarkdown(preset, {
            componentName: preset.componentName,
            importPath: 'tools/3d-pfx-library/src',
          })
      : exportFormat === 'json'
        ? exportPfxPresetJson(preset)
        : exportPfxComponentSnippet(preset, {
            componentName: preset.componentName,
            importPath: 'tools/3d-pfx-library/src',
          })
    : ''
  const applyDodQuickSearch = (search: (typeof PFX_DOD_QUICK_SEARCHES)[number]) => {
    setQuery(search.query)
    setStyle('all')
    setEffectType('all')
    setTier('all')
    setCoverage('all')
    setLoopMode('all')
    setSpace('all')
    setUseCase('all')
    setEmotionMood('all')
    setColorFamily('all')
    setAssetRequirement('all')
    setMobileSafeOnly(search.mobileSafeOnly)
    setPreviewMode('single')
    setSelectedId(search.effectId)
  }

  useEffect(() => {
    let frame = 0
    let last = performance.now()
    let raf = 0
    const samples: number[] = []

    const tick = (now: number) => {
      const delta = now - last
      last = now
      if (frame > 4) samples.push(delta)
      frame += 1
      if (samples.length < 90) {
        raf = requestAnimationFrame(tick)
      } else {
        setFrameSamples(samples.map((sample) => Math.round(sample * 10) / 10))
      }
    }

    setFrameSamples([])
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [activeQuery, concurrentEffects, controlOverrides, previewMode])

  return (
    <main className={`pfx-shell pfx-shell-${view}`}>
      {view === 'detail' ? (
        <button type="button" className="pfx-back" onClick={() => setView('feed')}>
          ← Back to gallery
        </button>
      ) : null}
      {view === 'feed' ? (
      <section className="pfx-browser" aria-label="PFX catalog browser">
        <div className="pfx-toolbar">
          <div className="pfx-toolbar-bar">
            <label className="pfx-search">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className="pfx-active-filters" aria-label="Active filters">
              {markFilter ? (
                <span className="pfx-filter-chip pfx-filter-chip-static" data-testid="pfx-mark-chip">
                  {markFilter.label}: {markedMatchCount}
                  {markFilter.only ? ' (only)' : ''}
                </span>
              ) : null}
              {activeFilterChips.map((chip) => (
                <button key={chip.key} type="button" className="pfx-filter-chip" onClick={chip.clear}>
                  {chip.label} ✕
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pfx-filters-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filters
            </button>
          </div>
          {filtersOpen ? (
            <div className="pfx-filter-popover" aria-label="Filter options">
          <label>
            Type
            <select value={effectType} onChange={(event) => setEffectType(event.target.value as EffectType | 'all')}>
              <option value="all">All types</option>
              {EFFECT_TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Style
            <select value={style} onChange={(event) => setStyle(event.target.value as ArtStyleCluster | 'all')}>
              <option value="all">All styles</option>
              {ART_STYLE_CLUSTERS.map((cluster) => (
                <option key={cluster} value={cluster}>
                  {cluster}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tier
            <select value={tier} onChange={(event) => setTier(event.target.value as PerformanceTier | 'all')}>
              <option value="all">All tiers</option>
              {TIERS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Coverage
            <select value={coverage} onChange={(event) => setCoverage(event.target.value as PfxAcceptanceStatus | 'all')}>
              <option value="all">All coverage</option>
              {COVERAGE.map((value) => (
                <option key={value} value={value}>
                  {value === 'authored-preview' ? 'Authored preview' : 'Profile backed'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Use case
            <select value={useCase} onChange={(event) => setUseCase(event.target.value)}>
              <option value="all">All use cases</option>
              {useCases.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mood
            <select value={emotionMood} onChange={(event) => setEmotionMood(event.target.value)}>
              <option value="all">All moods</option>
              {emotionMoods.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Color family
            <select value={colorFamily} onChange={(event) => setColorFamily(event.target.value)}>
              <option value="all">All colors</option>
              {colorFamilies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assets
            <select value={assetRequirement} onChange={(event) => setAssetRequirement(event.target.value)}>
              <option value="all">All assets</option>
              {assetRequirements.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loop
            <select value={loopMode} onChange={(event) => setLoopMode(event.target.value as LoopMode | 'all')}>
              <option value="all">All loop modes</option>
              {LOOP_MODES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Space
            <select value={space} onChange={(event) => setSpace(event.target.value as EffectSpace | 'all')}>
              <option value="all">All spaces</option>
              {SPACES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="pfx-check">
            <input
              type="checkbox"
              checked={mobileSafeOnly}
              onChange={(event) => setMobileSafeOnly(event.target.checked)}
            />
            Mobile safe
          </label>
          <div className="pfx-quick-searches" aria-label="Definition of done quick searches">
            {PFX_DOD_QUICK_SEARCHES.map((search) => (
              <button key={search.effectId} type="button" onClick={() => applyDodQuickSearch(search)}>
                {search.label}
              </button>
            ))}
          </div>
            </div>
          ) : null}
        </div>
        <div className="pfx-result-count">
          Showing {feed.scopedCount}
          {feedRole === 'all' ? ' matches' : ` ${feedRole} effects`} ({allMatchingItems.length} total)
          {mobileSafeHiddenMatches > 0 ? (
            <button
              type="button"
              className="pfx-hidden-matches"
              data-testid="pfx-hidden-matches"
              title="These matches are hidden by the Mobile safe filter — click to clear it"
              onClick={() => setMobileSafeOnly(false)}
            >
              +{mobileSafeHiddenMatches} hidden by Mobile safe — show
            </button>
          ) : null}
          <label className="pfx-sort">
            <span>Type</span>
            <select
              data-testid="pfx-feed-role"
              value={feedRole}
              onChange={(event) => setFeedRole(event.target.value)}
            >
              <option value="all">All types</option>
              {PFX_BEHAVIOR_ROLE_REVIEW_ORDER.map((role) => (
                <option key={role} value={role}>
                  {role} ({feedRoleCounts.get(role) ?? 0})
                </option>
              ))}
            </select>
          </label>
          <label className="pfx-sort">
            <span>Sort</span>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'role' | 'name' | 'rank')}>
              <option value="role">By role (review order)</option>
              <option value="name">A–Z</option>
              <option value="rank">Catalog rank</option>
            </select>
          </label>
          <button
            type="button"
            className="pfx-feed-replay"
            data-testid="pfx-feed-replay"
            title="Restart every visible effect from t=0"
            onClick={() => setFeedEpoch((current) => current + 1)}
          >
            ↻ Replay all
          </button>
        </div>
        {feed.items.length > 0 ? (
          <PfxFeed
            items={feed.items}
            reducedMotion={reducedMotion}
            epoch={feedEpoch}
            mobileSafeIds={mobileSafeIds}
            markFilter={markFilter}
            onSelect={(effectId) => {
              setSelectedId(effectId)
              setView('detail')
            }}
          />
        ) : (
          <p className="pfx-empty">No matching effects.</p>
        )}
      </section>
      ) : null}

      {view === 'detail' ? (
      <section className="pfx-preview" aria-label="PFX preview and export">
        <div
          className="pfx-stage"
          ref={stageRef}
          data-testid="pfx-3d-stage"
          role="application"
          tabIndex={0}
          aria-label="Orbit 3D preview"
          onPointerDown={beginOrbit}
          onPointerMove={updateOrbit}
          onPointerUp={endOrbit}
          onPointerCancel={endOrbit}
          onWheel={zoomOrbit}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') orbitRef.current.yaw -= 0.12
            if (event.key === 'ArrowRight') orbitRef.current.yaw += 0.12
            if (event.key === 'ArrowUp') orbitRef.current.pitch = MathUtils.clamp(orbitRef.current.pitch + 0.08, -0.12, 1.18)
            if (event.key === 'ArrowDown') orbitRef.current.pitch = MathUtils.clamp(orbitRef.current.pitch - 0.08, -0.12, 1.18)
          }}
        >
          <Canvas
            camera={{ position: [3.6, 2.4, 4.8], fov: 44, near: 0.05, far: 80 }}
            dpr={PFX_MOBILE_RUNTIME_POLICY.canvasDprRange}
            gl={{
              antialias: PFX_MOBILE_RUNTIME_POLICY.webgl.antialias,
              alpha: PFX_MOBILE_RUNTIME_POLICY.webgl.alpha,
              powerPreference: PFX_MOBILE_RUNTIME_POLICY.webgl.powerPreference,
              preserveDrawingBuffer: Boolean(realDeviceCapture),
            }}
          >
            <PfxStageEnvironment effectId={selected?.effect.id} reviewFraming={reviewFraming} />
            {reviewFraming !== 'isolated' ? <PfxGameplayContext effectId={selected?.effect.id} /> : null}
            <OrbitCameraRig orbit={orbitRef} autoRotate={!reducedMotion && !reviewCameraLocked && orbitDragRef.current == null} />
            {preset && previewMode === 'single' ? (
              <group position={createPfxReviewEffectPosition(selected?.effect.id, reviewFraming)}>
                {/* The review pipeline's frozen frame (reviewTimeMs) always
                    wins over the interactive transport. */}
                <GamePfx
                  preset={preset}
                  reducedMotion={reducedMotion}
                  previewTimeSeconds={reviewTimeSeconds ?? transportPreviewSeconds}
                  recipeOverride={editedRecipe}
                />
              </group>
            ) : null}
            
            {previewMode === 'stress'
              ? stressScenario.presets.map((stressPreset, index) => (
                  <GamePfx
                    key={`${stressPreset.id}-${index}`}
                    preset={stressPreset}
                    reducedMotion={reducedMotion}
                    previewTimeSeconds={transportPreviewSeconds}
                    position={stressScenario.positions[index] ?? [0, 0, 0]}
                  />
                ))
              : null}
          </Canvas>
          {!reviewCameraLocked ? <span className="pfx-stage-hint">Drag to orbit · Wheel to zoom · Human reference = 1.8m</span> : null}
        </div>
        
        <PfxTransportBar transport={transport} onChange={setTransport} />
        

        {selected && preset ? (
          <div className="pfx-detail">
            <div className="pfx-detail-header">
              <div>
                <h1>{selected.effect.name}</h1>
                <p>
                  {selected.effect.effectType} / {selected.effect.loopMode} / {selected.effect.space} /{' '}
                  {preset.performance.tier}
                  {mobileSafeIds.has(selected.effect.id) ? null : (
                    <span className="pfx-detail-unsafe">not mobile-safe</span>
                  )}
                </p>
              </div>
              <div className="pfx-effect-flip" role="group" aria-label="Flip between effects">
                <button
                  type="button"
                  data-testid="pfx-effect-flip-prev"
                  title="Previous effect ( [ )"
                  onClick={() => flipSelectedEffect(-1)}
                >
                  ← Prev
                </button>
                <span data-testid="pfx-effect-flip-position" className="pfx-effect-flip-position">
                  {selectedIndex + 1} / {items.length}
                </span>
                <button
                  type="button"
                  data-testid="pfx-effect-flip-next"
                  title="Next effect ( ] )"
                  onClick={() => flipSelectedEffect(1)}
                >
                  Next →
                </button>
              </div>
            </div>
            {authoredRecipe ? (
              <PfxEmitterPanel
                recipe={authoredRecipe}
                edits={emitterEdits}
                disabled={disabledEmitters}
                onToggle={(phase) =>
                  setDisabledEmitters((current) => {
                    const next = new Set(current)
                    if (next.has(phase)) next.delete(phase)
                    else next.add(phase)
                    return next
                  })
                }
                onEdit={(phase, field, value, level) =>
                  setEmitterEdits((current) => {
                    const entry = current[phase] ?? { tuning: {} }
                    const next: PfxEmitterEdit =
                      level === 'surface'
                        ? { ...entry, [field]: value }
                        : { ...entry, tuning: { ...entry.tuning, [field]: value } }
                    return { ...current, [phase]: next }
                  })
                }
                onReset={() => {
                  setEmitterEdits({})
                  setDisabledEmitters(new Set())
                }}
              />
            ) : null}
            <div className="pfx-controls">
              <label>
                <span>Preview mode</span>
                <select
                  value={previewMode}
                  onChange={(event) => setPreviewMode(event.target.value as 'single' | 'stress')}
                >
                  <option value="single">Single effect</option>
                  <option value="stress">Stress scene</option>
                </select>
              </label>
              <Range
                label="Stress count"
                value={concurrentEffects}
                min={1}
                max={40}
                step={1}
                onChange={(value) => setConcurrentEffects(Math.round(value))}
              />
              {PFX_CONTROL_DEFINITIONS.map((definition) => (
                <div
                  key={definition.key}
                  className={
                    definition.key in controlOverrides ? 'pfx-control-row pfx-control-row-modified' : 'pfx-control-row'
                  }
                >
                  <ControlEditor
                    definition={definition}
                    value={preset.controls[definition.key]}
                    onChange={(value) =>
                      setControlOverrides((current) => ({
                        ...current,
                        [definition.key]: value,
                      }))
                    }
                  />
                  {definition.key in controlOverrides ? (
                    <button
                      type="button"
                      className="pfx-control-reset"
                      aria-label={`Reset ${definition.label}`}
                      title={`Reset ${definition.label} to the preset default`}
                      onClick={() =>
                        setControlOverrides((current) => {
                          const next = { ...current }
                          delete next[definition.key]
                          return next
                        })
                      }
                    >
                      ↺
                    </button>
                  ) : null}
                </div>
              ))}
              {Object.keys(controlOverrides).length > 0 ? (
                <button
                  type="button"
                  className="pfx-controls-reset-all"
                  data-testid="pfx-controls-reset-all"
                  onClick={() => setControlOverrides({})}
                >
                  Reset all tuned values ({Object.keys(controlOverrides).length})
                </button>
              ) : null}
            </div>
            <dl className="pfx-metrics">
              <div>
                <dt>Effects</dt>
                <dd>{profile?.effectCount}</dd>
              </div>
              <div>
                <dt>Particles</dt>
                <dd>{profile?.totalParticles}</dd>
              </div>
              <div>
                <dt>Draw calls</dt>
                <dd>{profile?.totalDrawCalls}</dd>
              </div>
              <div>
                <dt>Frame ms</dt>
                <dd>{profile?.expectedFrameCostMs}</dd>
              </div>
              <div>
                <dt>Texture KB</dt>
                <dd>{profile?.textureMemoryKb}</dd>
              </div>
              <div>
                <dt>Overdraw</dt>
                <dd>{profile?.overdrawRisk}</dd>
              </div>
              <div>
                <dt>Mobile</dt>
                <dd>{profile?.mobileSafe ? 'safe' : 'risk'}</dd>
              </div>
              <div>
                <dt>Live fps</dt>
                <dd>{liveFrame.fps || '...'}</dd>
              </div>
              <div>
                <dt>P95 ms</dt>
                <dd>{liveFrame.p95FrameMs || '...'}</dd>
              </div>
              <div>
                <dt>Live est.</dt>
                <dd>{browserReport?.thresholds.mobileLowTier.pass ? 'pass' : 'wait'}</dd>
              </div>
              <div>
                <dt>Quality</dt>
                <dd>
                  {preset.quality.total}/{preset.quality.max}
                </dd>
              </div>
              <div>
                <dt>3D structure</dt>
                <dd>
                  {selectedStructuralQuality?.structuredMesh ? 'mesh' : 'particle-led'} /{' '}
                  {selectedStructuralQuality?.meshSpawnSource ? 'mesh emitter' : 'analytic emitter'}
                </dd>
              </div>
              <div>
                <dt>Ring discipline</dt>
                <dd>{selectedStructuralQuality?.ringSurfaceCount ?? 0} purposeful ring surfaces</dd>
              </div>
              <div>
                <dt>CC0 sprite</dt>
                <dd>{selectedStructuralQuality?.cc0AssetBacked ? 'curated asset backed' : 'procedural primitive'}</dd>
              </div>
              <div>
                <dt>Style render</dt>
                <dd>
                  {preset.styleRender.materialTreatment} / {preset.styleRender.silhouette}
                </dd>
              </div>
              <div>
                <dt>Market sources</dt>
                <dd title={selected.effect.marketSourceUrls.join('\n')}>
                  {selected.effect.marketSourceFamilies.length} families / {selected.effect.marketSourceUrls.length} URLs
                </dd>
              </div>
              <div>
                <dt>Production gate</dt>
                <dd>{selectedReadiness?.readinessStatus ?? 'unknown'}</dd>
              </div>
            </dl>
            {selectedReadiness ? (
               <ProductionReadinessPanel
                 readiness={selectedReadiness}
                 effectsRequiringDecision={productionReadiness.summary.effectsRequiringDecision}
                 productionImplementedEffects={productionReadiness.summary.productionImplementedEffects}
               />
            ) : null}
            {browserReport ? (
              <script
                type="application/json"
                data-profile-json="r3f-pfx-browser"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(browserReport) }}
              />
            ) : null}
            {browserReport?.capture.deviceClass === 'real-device' ? (
              <>
                <script
                  type="application/json"
                  data-profile-json="r3f-pfx-real-device"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(browserReport) }}
                />
                <RealDeviceCapturePanel
                  report={browserReport}
                  reportJson={JSON.stringify(browserReport, null, 2)}
                  fileName={profileArtifactNameForSelectedEffect(selected.effect.id)}
                />
              </>
            ) : null}
            <label className="pfx-export">
              <span className="pfx-export-title">
                Export
                <select
                  value={exportFormat}
                  onChange={(event) =>
                    setExportFormat(event.target.value as 'component' | 'json' | 'manifest' | 'docs')
                  }
                >
                  <option value="component">R3F component</option>
                  <option value="json">JSON preset</option>
                  <option value="manifest">Preview manifest</option>
                  <option value="docs">Developer docs</option>
                </select>
                <button
                  type="button"
                  data-testid="pfx-copy-preset"
                  title="Copy the export text (tuned values included) to the clipboard"
                  onClick={(event) => {
                    event.preventDefault()
                    const copied = navigator.clipboard?.writeText(exportText)
                    if (copied) {
                      copied.then(
                        () => setPresetCopied(true),
                        () => setPresetCopied(false),
                      )
                    }
                  }}
                >
                  {presetCopied ? 'Copied ✓' : 'Copy'}
                </button>
              </span>
              <textarea readOnly value={exportText} />
            </label>
          </div>
        ) : (
          <p className="pfx-empty">No matching effects.</p>
        )}
      </section>
      ) : null}
      {view === 'detail' ? (
        <>
          <RealDeviceCaptureQueuePanel />
          <ExternalEvidenceHandoffPanel />
        </>
      ) : null}
    </main>
  )
}

function ExternalEvidenceHandoffPanel() {
  const [handoff, setHandoff] = useState<ExternalEvidenceHandoff | null>(null)
  const [handoffHealth, setHandoffHealth] = useState<ExternalEvidenceHandoffHealth | null>(null)
  const [deviceLabel, setDeviceLabel] = useState(readProfileDeviceLabel() ?? '')

  useEffect(() => {
    void loadExternalEvidenceHandoff().then(setHandoff)
    void loadExternalEvidenceHandoffHealth().then(setHandoffHealth)
  }, [])

  if (!handoff) return null

  const nextReadyWorkItem = handoff.summary.nextReadyWorkItem
  const approvalStatus = handoff.instructions.approvalStatus
  const realDeviceHealth = handoffHealth?.summary.realDevice
  const externalHealth = handoffHealth?.summary.externalEvidence
  const objectiveReadiness = handoffHealth?.summary.objectiveReadiness
  const redTeamHealth = handoffHealth?.summary.redTeamReview
  const productionApprovalHealth = handoffHealth?.summary.productionApproval
  const externalHandoffDeviceLabelReady = deviceLabel.trim().length > 0

  return (
    <section className="pfx-capture" data-testid="external-evidence-handoff" aria-label="External evidence handoff">
      <strong>External evidence handoff</strong>
      <span>{approvalStatus}</span>
      <span data-testid="external-evidence-final-acceptance-status">
        Final acceptance blocked until real-device profiling, red-team signoff, and final production approvals are
        complete.
      </span>
      {productionApprovalHealth ? (
        <span data-testid="external-evidence-final-acceptance-blocker-counts">
          Final blockers: Safari {productionApprovalHealth.missingMobileSafariProfiles ?? 'unknown'}; Android{' '}
          {productionApprovalHealth.missingChromeAndroidProfiles ?? 'unknown'}; red-team{' '}
          {productionApprovalHealth.missingRedTeamSignoff ?? 'unknown'}; approvals{' '}
          {productionApprovalHealth.pendingMetadataApprovals ?? 'unknown'}
        </span>
      ) : null}
      <span>
        Ready {handoff.summary.readyWorkItems}/{handoff.summary.totalOpenWorkItems}; blocked {handoff.summary.blockedWorkItems}
      </span>
      <label>
        Device label
        <input
          data-testid="external-evidence-handoff-device-label"
          value={deviceLabel}
          onChange={(event) => setDeviceLabel(event.currentTarget.value)}
        />
      </label>
      <span data-testid="external-evidence-handoff-device-label-status">
        {externalHandoffDeviceLabelReady ? 'device-labeled' : 'missing device label'}
      </span>
      {externalHealth ? (
        <>
          <span data-testid="external-evidence-handoff-health">
            Phone-ready {externalHealth.readyForPhoneCapture ? 'yes' : 'no'}; capture URLs{' '}
            {externalHealth.networkReachableCaptureUrlItems}/{externalHealth.captureUrlItems}; batch auto-upload{' '}
            {externalHealth.readyBatchScopedAutoUploadUrlItems}/{externalHealth.batchScopedAutoUploadUrlItems}; missing{' '}
            {externalHealth.missingBatchScopedAutoUploadUrlItems}
          </span>
          {typeof externalHealth.mobileSafariCaptureItems === 'number' &&
          typeof externalHealth.chromeAndroidCaptureItems === 'number' &&
          typeof externalHealth.redTeamReviewItems === 'number' &&
          typeof externalHealth.finalApprovalItems === 'number' ? (
            <span data-testid="external-evidence-work-item-breakdown">
              Work items: taxonomy {externalHealth.taxonomyReviewItems ?? 'unknown'}; implementation{' '}
              {externalHealth.productionImplementationItems ?? 'unknown'}; Safari{' '}
              {externalHealth.mobileSafariCaptureItems}; Android {externalHealth.chromeAndroidCaptureItems}; red-team{' '}
              {externalHealth.redTeamReviewItems}; approval {externalHealth.finalApprovalItems}
            </span>
          ) : null}
          {typeof externalHealth.autoUploadRequiresDeviceLabelItems === 'number' ? (
            <span data-testid="external-evidence-auto-upload-device-label-status">
              Auto-upload device labels required {externalHealth.autoUploadRequiresDeviceLabelItems}
            </span>
          ) : null}
          {externalHealth.indexPath ? (
            <span data-testid="external-evidence-handoff-index-path">
              External evidence index: <code>{externalHealth.indexPath}</code>
            </span>
          ) : null}
          {externalHealth.bulkCommand ? (
            <span data-testid="external-evidence-handoff-bulk-command">
              External evidence command: <code>{externalHealth.bulkCommand}</code>
            </span>
          ) : null}
        </>
      ) : null}
      {objectiveReadiness ? (
        <>
          <span data-testid="objective-readiness-handoff-status">
            Objective readiness {objectiveReadiness.locallySatisfiedRequirements}/{objectiveReadiness.totalRequirements} local;{' '}
            {objectiveReadiness.externalEvidenceRequiredRequirements} external; {objectiveReadiness.blockedRequirements} blocked
          </span>
	          {objectiveReadiness.operatorLaunchUrl ? (
	            <span data-testid="objective-readiness-operator-launch">
	              Objective operator:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(objectiveReadiness.operatorLaunchUrl, deviceLabel)}
	                label="operator launch"
	              />
	            </span>
	          ) : null}
	          {objectiveReadiness.operatorStatusUrl ? (
	            <span data-testid="objective-readiness-operator-status">
	              Objective status:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(objectiveReadiness.operatorStatusUrl, deviceLabel)}
	                label="status JSON"
	              />
	            </span>
	          ) : null}
	        </>
	      ) : null}
      {realDeviceHealth ? (
        <>
          <span data-testid="real-device-handoff-health">
            Real-device queue {realDeviceHealth.totalItems} items in {realDeviceHealth.totalBatches} batches; index{' '}
            {realDeviceHealth.indexPassed ? 'yes' : 'no'}; files {realDeviceHealth.filesPassed ? 'yes' : 'no'}
          </span>
          {typeof realDeviceHealth.validCaptures === 'number' &&
          typeof realDeviceHealth.requiredCaptures === 'number' ? (
            <span data-testid="real-device-handoff-capture-status">
              Real-device captures {realDeviceHealth.validCaptures}/{realDeviceHealth.requiredCaptures}; missing{' '}
              {realDeviceHealth.missingCaptures ?? 'unknown'}; fully captured effects{' '}
              {realDeviceHealth.fullyCapturedEffects ?? 'unknown'}
            </span>
          ) : null}
          {realDeviceHealth.autoUploadRequiresDeviceLabel ? (
            <span data-testid="real-device-auto-upload-device-label-status">
              Real-device auto-upload requires profileDeviceLabel
            </span>
          ) : null}
          {realDeviceHealth.nextBatchId ? (
            <span data-testid="real-device-handoff-next-batch">
              Next batch {realDeviceHealth.nextBatchId} ({realDeviceHealth.nextBatchPlatform ?? 'unknown platform'});{' '}
              {realDeviceHealth.nextBatchAutoUploadQueueUrl ? (
                <RequiredDeviceLabelAutoUploadLink
                  href={withRequiredProfileDeviceLabel(realDeviceHealth.nextBatchAutoUploadQueueUrl, deviceLabel)}
                  label="batch auto-run"
                />
              ) : (
                'batch auto-run missing'
              )}
              {realDeviceHealth.autoDetectAutoUploadQueueUrl ? (
                <>
                  {' '}
                  <RequiredDeviceLabelAutoUploadLink
                    href={withRequiredProfileDeviceLabel(realDeviceHealth.autoDetectAutoUploadQueueUrl, deviceLabel)}
                    label="auto-detect auto-run"
                  />
                </>
              ) : null}
              {realDeviceHealth.nextCaptureOutputFile ? <> output {realDeviceHealth.nextCaptureOutputFile}</> : null}
            </span>
          ) : null}
          {realDeviceHealth.indexPath ? (
            <span data-testid="real-device-handoff-index-path">
              Real-device index: <code>{realDeviceHealth.indexPath}</code>
            </span>
          ) : null}
          {realDeviceHealth.bulkCommand ? (
            <span data-testid="real-device-handoff-bulk-command">
              Real-device command: <code>{realDeviceHealth.bulkCommand}</code>
            </span>
          ) : null}
        </>
      ) : null}
      {redTeamHealth ? (
        <>
          <span data-testid="red-team-review-handoff-health">
            Red-team queue {redTeamHealth.totalItems} items in {redTeamHealth.totalBatches} batches; index{' '}
            {redTeamHealth.indexPassed ? 'yes' : 'no'}; files {redTeamHealth.filesPassed ? 'yes' : 'no'}
          </span>
          {typeof redTeamHealth.signedOffEffects === 'number' && typeof redTeamHealth.blockedEffects === 'number' ? (
            <span data-testid="red-team-review-manifest-status">
              Red-team signed off {redTeamHealth.signedOffEffects}; blocked {redTeamHealth.blockedEffects}
            </span>
          ) : null}
          {typeof redTeamHealth.mobileSafariBlockedEffects === 'number' &&
          typeof redTeamHealth.chromeAndroidBlockedEffects === 'number' ? (
            <span data-testid="red-team-review-platform-blockers">
              Red-team mobile blockers: Safari {redTeamHealth.mobileSafariBlockedEffects}; Android{' '}
              {redTeamHealth.chromeAndroidBlockedEffects}
            </span>
          ) : null}
	          {redTeamHealth.operatorLaunchUrl ? (
	            <span data-testid="red-team-review-operator-launch">
	              Red-team operator:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(redTeamHealth.operatorLaunchUrl, deviceLabel)}
	                label="launch"
	              />
	            </span>
	          ) : null}
	          {redTeamHealth.operatorStatusUrl ? (
	            <span data-testid="red-team-review-operator-status">
	              Red-team status:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(redTeamHealth.operatorStatusUrl, deviceLabel)}
	                label="status JSON"
	              />
	            </span>
	          ) : null}
	          {redTeamHealth.indexPath ? (
            <span data-testid="red-team-review-handoff-index-path">
              Red-team index: <code>{redTeamHealth.indexPath}</code>
            </span>
          ) : null}
          {redTeamHealth.bulkCommand ? (
            <span data-testid="red-team-review-handoff-bulk-command">
              Red-team command: <code>{redTeamHealth.bulkCommand}</code>
            </span>
          ) : null}
        </>
      ) : null}
      {productionApprovalHealth ? (
        <>
          <span data-testid="production-approval-handoff-health">
            Production approval queue {productionApprovalHealth.totalItems} items in {productionApprovalHealth.totalBatches}{' '}
            batches; index {productionApprovalHealth.indexPassed ? 'yes' : 'no'}; files{' '}
            {productionApprovalHealth.filesPassed ? 'yes' : 'no'}
          </span>
          {typeof productionApprovalHealth.submittedApprovals === 'number' &&
          typeof productionApprovalHealth.pendingMetadataApprovals === 'number' ? (
            <span data-testid="production-approval-manifest-status">
              Approval manifest {productionApprovalHealth.approvalStatus ?? 'unknown'}; submitted{' '}
              {productionApprovalHealth.submittedApprovals}; pending metadata{' '}
              {productionApprovalHealth.pendingMetadataApprovals}
            </span>
          ) : null}
          {typeof productionApprovalHealth.readyForApprovalEffects === 'number' &&
          typeof productionApprovalHealth.missingPrerequisiteEffects === 'number' ? (
            <span data-testid="production-approval-readiness-status">
              Approval readiness {productionApprovalHealth.readyForApprovalEffects} ready;{' '}
              {productionApprovalHealth.missingPrerequisiteEffects} missing prerequisites
            </span>
          ) : null}
          {typeof productionApprovalHealth.missingMobileSafariProfiles === 'number' &&
          typeof productionApprovalHealth.missingChromeAndroidProfiles === 'number' ? (
            <span data-testid="production-approval-platform-blockers">
              Approval mobile blockers: Safari {productionApprovalHealth.missingMobileSafariProfiles}; Android{' '}
              {productionApprovalHealth.missingChromeAndroidProfiles}
            </span>
          ) : null}
          {typeof productionApprovalHealth.missingRedTeamSignoff === 'number' ? (
            <span data-testid="production-approval-red-team-blockers">
              Approval red-team blockers {productionApprovalHealth.missingRedTeamSignoff}
            </span>
          ) : null}
	          {productionApprovalHealth.operatorLaunchUrl ? (
	            <span data-testid="production-approval-operator-launch">
	              Approval operator:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(productionApprovalHealth.operatorLaunchUrl, deviceLabel)}
	                label="launch"
	              />
	            </span>
	          ) : null}
	          {productionApprovalHealth.operatorStatusUrl ? (
	            <span data-testid="production-approval-operator-status">
	              Approval status:{' '}
	              <RequiredDeviceLabelAutoUploadLink
	                href={withRequiredProfileDeviceLabel(productionApprovalHealth.operatorStatusUrl, deviceLabel)}
	                label="status JSON"
	              />
	            </span>
	          ) : null}
	          {productionApprovalHealth.indexPath ? (
            <span data-testid="production-approval-handoff-index-path">
              Production approval index: <code>{productionApprovalHealth.indexPath}</code>
            </span>
          ) : null}
          {productionApprovalHealth.bulkCommand ? (
            <span data-testid="production-approval-handoff-bulk-command">
              Production approval command: <code>{productionApprovalHealth.bulkCommand}</code>
            </span>
          ) : null}
        </>
      ) : null}
      {realDeviceHealth ? (
        <span data-testid="external-evidence-next-platform-captures">
          Next platform captures:
          {realDeviceHealth.nextMobileSafariCaptureUrl ? (
            <>
              {' '}
              <a
                data-testid="external-evidence-next-mobile-safari-capture"
                href={withProfileDeviceLabel(realDeviceHealth.nextMobileSafariCaptureUrl, deviceLabel)}
              >
                Safari
              </a>
            </>
          ) : null}
          {realDeviceHealth.nextMobileSafariAutoUploadUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                  data-testid="external-evidence-next-mobile-safari-auto-upload"
                href={withRequiredProfileDeviceLabel(realDeviceHealth.nextMobileSafariAutoUploadUrl, deviceLabel)}
                label="Safari auto-upload"
              />
            </>
          ) : null}
          {realDeviceHealth.nextChromeAndroidCaptureUrl ? (
            <>
              {' '}
              <a
                data-testid="external-evidence-next-chrome-android-capture"
                href={withProfileDeviceLabel(realDeviceHealth.nextChromeAndroidCaptureUrl, deviceLabel)}
              >
                Android
              </a>
            </>
          ) : null}
          {realDeviceHealth.nextChromeAndroidAutoUploadUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="external-evidence-next-chrome-android-auto-upload"
                href={withRequiredProfileDeviceLabel(realDeviceHealth.nextChromeAndroidAutoUploadUrl, deviceLabel)}
                label="Android auto-upload"
              />
            </>
          ) : null}
        </span>
      ) : null}
      {nextReadyWorkItem ? (
        <span data-testid="external-evidence-next-ready">
          Next ready {nextReadyWorkItem.name} / {nextReadyWorkItem.label}: <code>{nextReadyWorkItem.outputFile}</code>
          {nextReadyWorkItem.captureUrl ? (
            <>
              {' '}
              <a href={withProfileDeviceLabel(nextReadyWorkItem.captureUrl, deviceLabel)}>open capture</a>
            </>
          ) : null}
          {nextReadyWorkItem.autoUploadUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="external-evidence-next-ready-auto-upload"
                href={withRequiredProfileDeviceLabel(nextReadyWorkItem.autoUploadUrl, deviceLabel)}
                label="auto-upload"
              />
            </>
          ) : null}
        </span>
      ) : null}
      <code data-testid="external-evidence-final-acceptance-command">
        {handoff.instructions.finalAcceptanceCommand}
      </code>
    </section>
  )
}

function RealDeviceCaptureQueuePanel() {
  const [serverProgress, setServerProgress] = useState<RealDeviceCaptureServerProgress | null>(null)
  const [deviceLabel, setDeviceLabel] = useState(readProfileDeviceLabel() ?? '')
  const realDeviceCaptureQueueDeviceLabelReady = deviceLabel.trim().length > 0

  useEffect(() => {
    void loadCaptureServerProgress().then(setServerProgress)
  }, [])

  if (!serverProgress) return null

  return (
    <section className="pfx-capture" data-testid="real-device-capture-queue" aria-label="Real-device capture queue">
      <strong>Real-device capture queue</strong>
      <span>
        Captured {serverProgress.validCaptures}/{serverProgress.totalCaptures}; missing {serverProgress.missingCaptures}
      </span>
      <RealDevicePlatformProgressLine progress={serverProgress} deviceLabel={deviceLabel} />
      {serverProgress.nextCaptureProfileUrl ? (
        <>
          <label>
            Device label
            <input
              data-testid="real-device-capture-queue-device-label"
              value={deviceLabel}
              onChange={(event) => setDeviceLabel(event.currentTarget.value)}
            />
          </label>
          <span data-testid="real-device-capture-queue-device-label-status">
            {realDeviceCaptureQueueDeviceLabelReady ? 'device-labeled' : 'missing device label'}
          </span>
          {serverProgress.autoUploadRequiresDeviceLabel ? (
            <span data-testid="real-device-capture-queue-auto-upload-device-label-status">
              Auto-upload requires profileDeviceLabel
            </span>
          ) : null}
          <a
            data-testid="real-device-capture-queue-next"
            href={createRealDeviceCaptureQueueLink(undefined, false, deviceLabel) ?? undefined}
          >
            Next pending {serverProgress.nextCaptureEffectId}
          </a>
          <a
            data-testid="real-device-capture-queue-next-auto"
            href={createRealDeviceCaptureQueueLink('auto', false, deviceLabel) ?? undefined}
          >
            Next for this device
          </a>
          {serverProgress.nextCaptureAutoUploadUrl ? (
            <RequiredDeviceLabelAutoUploadLink
              data-testid="real-device-capture-queue-next-exact-auto"
              href={withRequiredProfileDeviceLabel(serverProgress.nextCaptureAutoUploadUrl, deviceLabel)}
              label="Next exact auto-upload"
            />
          ) : null}
          {serverProgress.nextBatchAutoUploadQueueUrl ? (
            <RequiredDeviceLabelAutoUploadLink
              data-testid="real-device-capture-current-batch-auto-run"
              href={withRequiredProfileDeviceLabel(serverProgress.nextBatchAutoUploadQueueUrl, deviceLabel)}
              label="Auto-run current batch"
            />
          ) : null}
          <a
            data-testid="real-device-capture-queue-next-safari"
            href={createRealDeviceCaptureQueueLink('mobile-safari', false, deviceLabel) ?? undefined}
          >
            Next Safari
          </a>
          <a
            data-testid="real-device-capture-queue-next-android"
            href={createRealDeviceCaptureQueueLink('chrome-android', false, deviceLabel) ?? undefined}
          >
            Next Android
          </a>
          <RequiredDeviceLabelAutoUploadLink
            data-testid="real-device-capture-queue-auto-run"
            href={createRealDeviceCaptureQueueLink('auto', true, deviceLabel)}
            label="Auto-run this device"
          />
          <RequiredDeviceLabelAutoUploadLink
            data-testid="real-device-capture-queue-auto-run-safari"
            href={createRealDeviceCaptureQueueLink('mobile-safari', true, deviceLabel)}
            label="Auto-run Safari"
          />
          <RequiredDeviceLabelAutoUploadLink
            data-testid="real-device-capture-queue-auto-run-android"
            href={createRealDeviceCaptureQueueLink('chrome-android', true, deviceLabel)}
            label="Auto-run Android"
          />
        </>
      ) : null}
    </section>
  )
}

function ProductionReadinessPanel({
  readiness,
  effectsRequiringDecision,
  productionImplementedEffects,
}: {
  readiness: PfxProductionReadinessEffect
  effectsRequiringDecision: number
  productionImplementedEffects: number
}) {
  return (
    <section className="pfx-readiness" aria-label="Production readiness">
      <div>
        <strong>Production gate</strong>
        <span>{effectsRequiringDecision} effects still need implementation or approved deferral</span>
        <span>{productionImplementedEffects} production implementations credited</span>
      </div>
      <ul>
        {readiness.requiredActions.map((requiredAction) => (
          <li key={requiredAction}>{requiredAction}</li>
        ))}
      </ul>
    </section>
  )
}

function RealDeviceCapturePanel({
  report,
  reportJson,
  fileName,
}: {
  report: BrowserProfileReport
  reportJson: string
  fileName: string
}) {
  const downloadHref = createCaptureDownloadHref(reportJson)
  const autoUpload = readProfileAutoUpload()
  const deviceLabel = readProfileDeviceLabel()
  const autoUploadStatus = autoUploadStatusForReport(report)
  const captureBlockingFinding = realDeviceCaptureBlockingFinding(report)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'uploaded' | 'failed'>('idle')
  const [uploadResultStatus, setUploadResultStatus] = useState<RealDeviceCaptureUploadResult['status'] | null>(null)
  const [uploadOutputFile, setUploadOutputFile] = useState<string | null>(null)
  const [nextProfileUrl, setNextProfileUrl] = useState<string | null>(null)
  const [nextProfileAutoUploadUrl, setNextProfileAutoUploadUrl] = useState<string | null>(null)
  const [nextBatchAutoUploadQueueUrl, setNextBatchAutoUploadQueueUrl] = useState<string | null>(null)
  const [nextBatchAutoUploadQueueReadyUrl, setNextBatchAutoUploadQueueReadyUrl] = useState<string | null>(null)
  const [uploadFindings, setUploadFindings] = useState<string[]>([])
  const [captureProgress, setCaptureProgress] = useState<RealDeviceCaptureUploadProgress | null>(null)
  const [serverProgress, setServerProgress] = useState<RealDeviceCaptureServerProgress | null>(null)
  const [autoUploadAttempted, setAutoUploadAttempted] = useState(false)
  const nextCaptureHref = nextProfileUrl
    ? autoUpload ? withRequiredProfileDeviceLabel(withProfileAutoUpload(nextProfileUrl), deviceLabel) : withProfileDeviceLabel(nextProfileUrl, deviceLabel)
    : null
  const nextAutoUploadCaptureHref = nextProfileAutoUploadUrl ??
    (nextProfileUrl ? withRequiredProfileDeviceLabel(withProfileAutoUpload(nextProfileUrl), deviceLabel) : null)
  const serverProgressNextCaptureHref = serverProgress?.nextCaptureAutoUploadUrl
    ? withRequiredProfileDeviceLabel(serverProgress.nextCaptureAutoUploadUrl, deviceLabel)
    : serverProgress?.nextCaptureProfileUrl
      ? withProfileDeviceLabel(serverProgress.nextCaptureProfileUrl, deviceLabel)
    : null

  const uploadCapture = async (continueAfterUpload = false) => {
    setUploadStatus('uploading')
    setUploadResultStatus(null)
    setUploadOutputFile(null)
    setNextProfileUrl(null)
    setNextProfileAutoUploadUrl(null)
    setNextBatchAutoUploadQueueUrl(null)
    setNextBatchAutoUploadQueueReadyUrl(null)
    setUploadFindings([])
    setCaptureProgress(null)
    try {
      const response = await fetch('/__r3f-pfx-capture', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: reportJson,
      })
      const result = (await response.json().catch(() => null)) as RealDeviceCaptureUploadResult | null
      setUploadResultStatus(result?.status ?? null)
      setUploadOutputFile(result?.outputFile ?? null)
      setNextProfileUrl(result?.nextProfileUrl ?? null)
      setNextProfileAutoUploadUrl(result?.nextProfileAutoUploadUrl ?? null)
      setNextBatchAutoUploadQueueUrl(result?.nextBatchAutoUploadQueueUrl ?? null)
      setNextBatchAutoUploadQueueReadyUrl(result?.nextBatchAutoUploadQueueReadyUrl ?? null)
      setUploadFindings(result?.findings ?? [])
      setCaptureProgress(response.ok && result ? captureProgressFromUploadResult(result) : null)
      if (response.ok) {
        setServerProgress(await loadCaptureServerProgress())
        const nextUploadContinuationUrl = result?.nextProfileUrl ?? result?.nextBatchAutoUploadQueueUrl
        if (continueAfterUpload && nextUploadContinuationUrl && typeof window !== 'undefined') {
          const nextUploadContinuationHref = autoUpload
            ? result?.nextProfileAutoUploadUrl ?? result?.nextBatchAutoUploadQueueReadyUrl ?? withRequiredProfileDeviceLabel(withProfileAutoUpload(nextUploadContinuationUrl), deviceLabel)
            : withProfileDeviceLabel(nextUploadContinuationUrl, deviceLabel)
          if (nextUploadContinuationHref) window.location.assign(nextUploadContinuationHref)
        }
      }
      setUploadStatus(response.ok ? 'uploaded' : 'failed')
    } catch {
      setUploadFindings(['Upload request failed before the capture server returned validation details.'])
      setUploadStatus('failed')
    }
  }

  useEffect(() => {
    if (!autoUpload || autoUploadAttempted || uploadStatus !== 'idle' || !isCaptureReportReadyForAutoUpload(report)) return
    setAutoUploadAttempted(true)
    void uploadCapture(true)
  }, [autoUpload, autoUploadAttempted, report, uploadStatus])

  const refreshCaptureProgress = async () => {
    setServerProgress(await loadCaptureServerProgress())
  }

  return (
    <section className="pfx-capture" data-testid="real-device-capture-panel" aria-label="Real-device capture">
      <div>
        <strong>Real-device capture</strong>
        <span>
          {report.capture?.platform ?? 'unknown'} / {fileName}
        </span>
      </div>
      <a
        data-testid="real-device-capture-download"
        download={fileName}
        href={downloadHref}
      >
        Download JSON
      </a>
      <button
        type="button"
        data-testid="real-device-capture-upload"
        disabled={uploadStatus === 'uploading' || Boolean(captureBlockingFinding)}
        onClick={() => void uploadCapture()}
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload JSON'}
      </button>
      <button
        type="button"
        data-testid="real-device-capture-upload-continue"
        disabled={uploadStatus === 'uploading' || Boolean(captureBlockingFinding)}
        onClick={() => void uploadCapture(true)}
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload and continue'}
      </button>
      {captureBlockingFinding ? (
        <span data-testid="real-device-capture-blocking-finding">
          This browser capture is not valid final real-device evidence: {captureBlockingFinding}
        </span>
      ) : null}
      <span data-testid="real-device-capture-upload-status">{uploadStatus}</span>
      {autoUpload ? (
        <span data-testid="real-device-capture-auto-upload-status">
          {autoUploadStatus.message}
        </span>
      ) : null}
      {uploadResultStatus ? (
        <span data-testid="real-device-capture-upload-result-status">
          {uploadResultStatus}
        </span>
      ) : null}
      {uploadOutputFile ? (
        <code data-testid="real-device-capture-upload-output-file">
          {uploadOutputFile}
        </code>
      ) : null}
      {uploadFindings.length > 0 ? (
        <ul data-testid="real-device-capture-upload-findings">
          {uploadFindings.map((finding) => (
            <li key={finding}>{finding}</li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        data-testid="real-device-capture-progress-refresh"
        onClick={() => void refreshCaptureProgress()}
      >
        Refresh progress
      </button>
      {captureProgress ? (
        <span data-testid="real-device-capture-progress">
          Batch {captureProgress.batchId}: capture {captureProgress.captureIndex}/{captureProgress.captureCount},{' '}
          {captureProgress.capturesRemainingInBatch} remaining
        </span>
      ) : null}
      {serverProgress ? (
        <span data-testid="real-device-capture-server-progress">
          Captured {serverProgress.validCaptures}/{serverProgress.totalCaptures}; missing {serverProgress.missingCaptures}
          <RealDevicePlatformProgressLine progress={serverProgress} deviceLabel={deviceLabel} />
          {serverProgressNextCaptureHref ? (
            <>
              {' '}
              <a href={serverProgressNextCaptureHref}>Next pending {serverProgress.nextCaptureEffectId}</a>
            </>
          ) : null}
        </span>
      ) : null}
      {nextCaptureHref ? (
        <a data-testid="real-device-capture-next" href={nextCaptureHref}>
          Next capture
        </a>
      ) : null}
      {nextAutoUploadCaptureHref ? (
        <a data-testid="real-device-capture-next-auto-upload" href={nextAutoUploadCaptureHref}>
          Next auto-upload capture
        </a>
      ) : null}
      {uploadStatus === 'uploaded' && captureProgress && !nextCaptureHref ? (
        <span data-testid="real-device-capture-run-complete">
          Capture run complete: captured all rows in this scoped run
        </span>
      ) : null}
      {uploadStatus === 'uploaded' && captureProgress && !nextCaptureHref && nextBatchAutoUploadQueueUrl ? (
        <RequiredDeviceLabelAutoUploadLink
          data-testid="real-device-capture-next-batch-auto-run"
          href={nextBatchAutoUploadQueueReadyUrl ?? withRequiredProfileDeviceLabel(nextBatchAutoUploadQueueUrl, deviceLabel)}
          label="Next batch auto-run"
        />
      ) : null}
      <textarea
        readOnly
        data-testid="real-device-capture-json"
        value={reportJson}
      />
    </section>
  )
}

interface RealDeviceCaptureUploadResult {
  status?: 'imported' | 'already-imported' | 'invalid'
  outputFile?: string | null
  nextProfileUrl?: string | null
  nextProfileAutoUploadUrl?: string | null
  nextBatchAutoUploadQueueUrl?: string | null
  nextBatchAutoUploadQueueReadyUrl?: string | null
  batchId?: string | null
  captureIndex?: number | null
  captureCount?: number | null
  capturesRemainingInBatch?: number | null
  findings?: string[]
}

interface RealDeviceCaptureUploadProgress {
  batchId: string
  captureIndex: number
  captureCount: number
  capturesRemainingInBatch: number
}

interface RealDeviceCaptureServerProgressResult {
  summary?: {
    totalCaptures?: number
    validCaptures?: number
    missingCaptures?: number
    platformProgress?: Partial<Record<'mobile-safari' | 'chrome-android', RealDeviceCapturePlatformProgress>>
    nextCaptureEffectId?: string | null
    nextCaptureProfileUrl?: string | null
    nextCaptureAutoUploadUrl?: string | null
    nextCaptureAutoUploadUrlTemplate?: string | null
    nextBatchAutoUploadQueueUrl?: string | null
    nextBatchAutoUploadQueueUrlTemplate?: string | null
    autoDetectAutoUploadQueueUrl?: string | null
    autoDetectAutoUploadQueueUrlTemplate?: string | null
    autoUploadRequiresDeviceLabel?: boolean
  }
}

interface RealDeviceCapturePlatformProgress {
  totalCaptures: number
  validCaptures: number
  missingCaptures: number
  invalidCaptures: number
  nextCaptureEffectId: string | null
  nextCaptureName: string | null
  nextCaptureProfileUrl: string | null
  nextCaptureAutoUploadUrl: string | null
  nextCaptureAutoUploadUrlTemplate?: string | null
  autoUploadQueueUrl: string | null
  autoUploadQueueUrlTemplate?: string | null
  autoUploadRequiresDeviceLabel?: boolean
  nextBatchId: string | null
  nextBatchAutoUploadQueueUrl: string | null
  nextBatchAutoUploadQueueUrlTemplate?: string | null
  nextCaptureOutputFile: string | null
}

interface RealDeviceCaptureServerProgress {
  totalCaptures: number
  validCaptures: number
  missingCaptures: number
  mobileSafari: RealDeviceCapturePlatformProgress
  chromeAndroid: RealDeviceCapturePlatformProgress
  nextCaptureEffectId: string | null
  nextCaptureProfileUrl: string | null
  nextCaptureAutoUploadUrl: string | null
  nextCaptureAutoUploadUrlTemplate: string | null
  nextBatchAutoUploadQueueUrl: string | null
  nextBatchAutoUploadQueueUrlTemplate: string | null
  autoDetectAutoUploadQueueUrl: string | null
  autoDetectAutoUploadQueueUrlTemplate: string | null
  autoUploadRequiresDeviceLabel: boolean
}

interface ExternalEvidenceHandoff {
  schema: 'game-bot.r3f-pfx-external-evidence-work-order.v1'
  summary: {
    totalOpenWorkItems: number
    readyWorkItems: number
    blockedWorkItems: number
    nextReadyWorkItem?: {
      effectId: string
      rank: number
      name: string
      workItemId: string
      label: string
      outputFile: string
      evidenceReference: string
      captureUrl?: string | null
      autoUploadUrl?: string | null
      captureUrlReachability?: string | null
    } | null
  }
  instructions: {
    approvalStatus: 'non-approving-external-evidence-work-order'
    finalAcceptanceCommand: string
  }
}

interface ExternalEvidenceHandoffHealth {
  schema: 'game-bot.r3f-pfx-evidence-handoff-health.v1'
  summary: {
    realDevice: {
      nextMobileSafariCaptureUrl?: string
      nextMobileSafariAutoUploadUrl?: string
      nextMobileSafariAutoUploadUrlTemplate?: string
      nextChromeAndroidCaptureUrl?: string
      nextChromeAndroidAutoUploadUrl?: string
      nextChromeAndroidAutoUploadUrlTemplate?: string
      requiredCaptures?: number
      validCaptures?: number
      missingCaptures?: number
      invalidCaptures?: number
      fullyCapturedEffects?: number
      nextBatchId?: string
      nextBatchPlatform?: string
      nextBatchAutoUploadQueueUrl?: string
      nextBatchAutoUploadQueueUrlTemplate?: string
      autoDetectAutoUploadQueueUrl?: string
      autoDetectAutoUploadQueueUrlTemplate?: string
      autoUploadRequiresDeviceLabel?: boolean
      nextCaptureOutputFile?: string
    } & HandoffQueueHealth
    externalEvidence: {
      indexPath?: string
      readyForPhoneCapture: boolean
      taxonomyReviewItems?: number
      productionImplementationItems?: number
      mobileSafariCaptureItems?: number
      chromeAndroidCaptureItems?: number
      redTeamReviewItems?: number
      finalApprovalItems?: number
      captureUrlItems: number
      networkReachableCaptureUrlItems: number
      autoUploadRequiresDeviceLabelItems?: number
      batchScopedAutoUploadUrlItems: number
      readyBatchScopedAutoUploadUrlItems: number
      missingBatchScopedAutoUploadUrlItems: number
      bulkCommand?: string
    }
    objectiveReadiness: {
      totalRequirements: number
      locallySatisfiedRequirements: number
      externalEvidenceRequiredRequirements: number
      blockedRequirements: number
	      operatorLaunchUrl?: string
	      operatorLaunchUrlTemplate?: string
	      operatorStatusUrl?: string
	      operatorStatusUrlTemplate?: string
	      nextActions?: string[]
    }
    redTeamReview: HandoffQueueHealth & {
      signedOffEffects?: number
      approvedDeferrals?: number
      pendingEffects?: number
      blockedEffects?: number
      mobileSafariBlockedEffects?: number
      chromeAndroidBlockedEffects?: number
    }
    productionApproval: HandoffQueueHealth & {
      submittedApprovals?: number
      pendingMetadataApprovals?: number
      approvalStatus?: string
      readyForApprovalEffects?: number
      alreadyApprovedEffects?: number
      missingPrerequisiteEffects?: number
      missingMobileSafariProfiles?: number
      missingChromeAndroidProfiles?: number
      missingRedTeamSignoff?: number
      approvalBlockers?: {
        missingMobileSafariProfiles: number
        missingChromeAndroidProfiles: number
        missingRedTeamSignoff: number
        pendingFinalApprovals: number
      }
    }
  }
}

interface HandoffQueueHealth {
  indexPath?: string
  totalBatches: number
  totalItems: number
  indexPassed: boolean
  filesPassed: boolean
  bulkCommand?: string
	  operatorLaunchUrl?: string
	  operatorLaunchUrlTemplate?: string
	  operatorStatusUrl?: string
	  operatorStatusUrlTemplate?: string
	}

function captureProgressFromUploadResult(result: RealDeviceCaptureUploadResult): RealDeviceCaptureUploadProgress | null {
  if (
    !result.batchId ||
    typeof result.captureIndex !== 'number' ||
    typeof result.captureCount !== 'number' ||
    typeof result.capturesRemainingInBatch !== 'number'
  ) {
    return null
  }
  return {
    batchId: result.batchId,
    captureIndex: result.captureIndex,
    captureCount: result.captureCount,
    capturesRemainingInBatch: result.capturesRemainingInBatch,
  }
}

function serverProgressFromProgressResult(result: RealDeviceCaptureServerProgressResult): RealDeviceCaptureServerProgress | null {
  if (
    !result.summary ||
    typeof result.summary.totalCaptures !== 'number' ||
    typeof result.summary.validCaptures !== 'number' ||
    typeof result.summary.missingCaptures !== 'number'
  ) {
    return null
  }
  return {
    totalCaptures: result.summary.totalCaptures,
    validCaptures: result.summary.validCaptures,
    missingCaptures: result.summary.missingCaptures,
    mobileSafari: normalizeCapturePlatformProgress(result.summary.platformProgress?.['mobile-safari']),
    chromeAndroid: normalizeCapturePlatformProgress(result.summary.platformProgress?.['chrome-android']),
    nextCaptureEffectId: result.summary.nextCaptureEffectId ?? null,
    nextCaptureProfileUrl: result.summary.nextCaptureProfileUrl ?? null,
    nextCaptureAutoUploadUrl: result.summary.nextCaptureAutoUploadUrl ?? null,
    nextCaptureAutoUploadUrlTemplate: result.summary.nextCaptureAutoUploadUrlTemplate ?? null,
    nextBatchAutoUploadQueueUrl: result.summary.nextBatchAutoUploadQueueUrl ?? null,
    nextBatchAutoUploadQueueUrlTemplate: result.summary.nextBatchAutoUploadQueueUrlTemplate ?? null,
    autoDetectAutoUploadQueueUrl: result.summary.autoDetectAutoUploadQueueUrl ?? null,
    autoDetectAutoUploadQueueUrlTemplate: result.summary.autoDetectAutoUploadQueueUrlTemplate ?? null,
    autoUploadRequiresDeviceLabel: result.summary.autoUploadRequiresDeviceLabel === true,
  }
}

function normalizeCapturePlatformProgress(progress: RealDeviceCapturePlatformProgress | undefined): RealDeviceCapturePlatformProgress {
  return {
    totalCaptures: progress?.totalCaptures ?? 0,
    validCaptures: progress?.validCaptures ?? 0,
    missingCaptures: progress?.missingCaptures ?? 0,
    invalidCaptures: progress?.invalidCaptures ?? 0,
    nextCaptureEffectId: progress?.nextCaptureEffectId ?? null,
    nextCaptureName: progress?.nextCaptureName ?? null,
    nextCaptureProfileUrl: progress?.nextCaptureProfileUrl ?? null,
    nextCaptureAutoUploadUrl: progress?.nextCaptureAutoUploadUrl ?? null,
    nextCaptureAutoUploadUrlTemplate: progress?.nextCaptureAutoUploadUrlTemplate ?? null,
    autoUploadQueueUrl: progress?.autoUploadQueueUrl ?? null,
    autoUploadQueueUrlTemplate: progress?.autoUploadQueueUrlTemplate ?? null,
    autoUploadRequiresDeviceLabel: progress?.autoUploadRequiresDeviceLabel === true,
    nextBatchId: progress?.nextBatchId ?? null,
    nextBatchAutoUploadQueueUrl: progress?.nextBatchAutoUploadQueueUrl ?? null,
    nextBatchAutoUploadQueueUrlTemplate: progress?.nextBatchAutoUploadQueueUrlTemplate ?? null,
    nextCaptureOutputFile: progress?.nextCaptureOutputFile ?? null,
  }
}

function RequiredDeviceLabelAutoUploadLink({
  'data-testid': testId,
  href,
  label,
}: {
  'data-testid'?: string
  href: string | null
  label: string
}) {
  return href ? (
    <a {...(testId ? { 'data-testid': testId } : {})} href={href}>
      {label}
    </a>
  ) : (
    <span {...(testId ? { 'data-testid': testId } : {})} aria-disabled="true">
      {label}
    </span>
  )
}

function RealDevicePlatformProgressLine({
  progress,
  deviceLabel,
}: {
  progress: RealDeviceCaptureServerProgress
  deviceLabel: string
}) {
  return (
    <span data-testid="real-device-capture-platform-progress">
      Safari {progress.mobileSafari.validCaptures}/{progress.mobileSafari.totalCaptures}
      {progress.autoDetectAutoUploadQueueUrl ? (
        <>
          {' '}
          <RequiredDeviceLabelAutoUploadLink
            data-testid="real-device-capture-auto-detect-auto-run"
            href={withRequiredProfileDeviceLabel(progress.autoDetectAutoUploadQueueUrl, deviceLabel)}
            label="auto-detect auto-run"
          />
        </>
      ) : null}
      {progress.mobileSafari.nextCaptureName && progress.mobileSafari.nextCaptureProfileUrl ? (
        <>
          , next{' '}
          <a
            data-testid="real-device-capture-platform-next-safari"
            href={withProfileDeviceLabel(progress.mobileSafari.nextCaptureProfileUrl, deviceLabel)}
          >
            {progress.mobileSafari.nextCaptureName}
          </a>
          {progress.mobileSafari.nextCaptureAutoUploadUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-next-auto-safari"
                href={withRequiredProfileDeviceLabel(progress.mobileSafari.nextCaptureAutoUploadUrl, deviceLabel)}
                label="auto-upload"
              />
            </>
          ) : null}
          {progress.mobileSafari.autoUploadQueueUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-auto-run-safari"
                href={withRequiredProfileDeviceLabel(progress.mobileSafari.autoUploadQueueUrl, deviceLabel)}
                label="auto-run"
              />
            </>
          ) : null}
          {progress.mobileSafari.nextBatchAutoUploadQueueUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-batch-auto-run-safari"
                href={withRequiredProfileDeviceLabel(progress.mobileSafari.nextBatchAutoUploadQueueUrl, deviceLabel)}
                label="batch auto-run"
              />
            </>
          ) : null}
          {progress.mobileSafari.nextCaptureOutputFile ? (
            <>
              {' '}
              <code data-testid="real-device-capture-platform-output-safari">
                {progress.mobileSafari.nextCaptureOutputFile}
              </code>
            </>
          ) : null}
        </>
      ) : (
        ', complete'
      )}
      ; Android{' '}
      {progress.chromeAndroid.validCaptures}/{progress.chromeAndroid.totalCaptures}
      {progress.chromeAndroid.nextCaptureName && progress.chromeAndroid.nextCaptureProfileUrl ? (
        <>
          , next{' '}
          <a
            data-testid="real-device-capture-platform-next-android"
            href={withProfileDeviceLabel(progress.chromeAndroid.nextCaptureProfileUrl, deviceLabel)}
          >
            {progress.chromeAndroid.nextCaptureName}
          </a>
          {progress.chromeAndroid.nextCaptureAutoUploadUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-next-auto-android"
                href={withRequiredProfileDeviceLabel(progress.chromeAndroid.nextCaptureAutoUploadUrl, deviceLabel)}
                label="auto-upload"
              />
            </>
          ) : null}
          {progress.chromeAndroid.autoUploadQueueUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-auto-run-android"
                href={withRequiredProfileDeviceLabel(progress.chromeAndroid.autoUploadQueueUrl, deviceLabel)}
                label="auto-run"
              />
            </>
          ) : null}
          {progress.chromeAndroid.nextBatchAutoUploadQueueUrl ? (
            <>
              {' '}
              <RequiredDeviceLabelAutoUploadLink
                data-testid="real-device-capture-platform-batch-auto-run-android"
                href={withRequiredProfileDeviceLabel(progress.chromeAndroid.nextBatchAutoUploadQueueUrl, deviceLabel)}
                label="batch auto-run"
              />
            </>
          ) : null}
          {progress.chromeAndroid.nextCaptureOutputFile ? (
            <>
              {' '}
              <code data-testid="real-device-capture-platform-output-android">
                {progress.chromeAndroid.nextCaptureOutputFile}
              </code>
            </>
          ) : null}
        </>
      ) : (
        ', complete'
      )}
    </span>
  )
}

async function loadCaptureServerProgress(): Promise<RealDeviceCaptureServerProgress | null> {
  try {
    const response = await fetch('/__r3f-pfx-capture-progress')
    const result = response.ok ? ((await response.json()) as RealDeviceCaptureServerProgressResult) : null
    return result ? serverProgressFromProgressResult(result) : null
  } catch {
    return null
  }
}

async function loadExternalEvidenceHandoff(): Promise<ExternalEvidenceHandoff | null> {
  try {
    const response = await fetch('/__r3f-pfx-evidence-handoff')
    const result = response.ok ? ((await response.json()) as ExternalEvidenceHandoff) : null
    return result?.schema === 'game-bot.r3f-pfx-external-evidence-work-order.v1' ? result : null
  } catch {
    return null
  }
}

async function loadExternalEvidenceHandoffHealth(): Promise<ExternalEvidenceHandoffHealth | null> {
  try {
    const response = await fetch('/__r3f-pfx-evidence-handoff-health')
    const result = response.ok ? ((await response.json()) as ExternalEvidenceHandoffHealth) : null
    return result?.schema === 'game-bot.r3f-pfx-evidence-handoff-health.v1' ? result : null
  } catch {
    return null
  }
}

function createCaptureDownloadHref(reportJson: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(reportJson)}`
}

function profileArtifactNameForSelectedEffect(effectId: string): string {
  return `${effectId}.json`
}

function isCaptureReportReadyForAutoUpload(report: BrowserProfileReport): boolean {
  return (
    report.frame.samples >= AUTO_UPLOAD_MIN_FRAME_SAMPLES &&
    report.thresholds.mobileLowTier.pass &&
    realDeviceCaptureBlockingFinding(report) == null
  )
}

function autoUploadStatusForReport(report: BrowserProfileReport):
  | { state: 'measuring'; message: string }
  | { state: 'blocked'; message: string }
  | { state: 'ready'; message: string } {
  if (report.frame.samples < AUTO_UPLOAD_MIN_FRAME_SAMPLES) {
    return {
      state: 'measuring',
      message: `Auto-upload measuring ${report.frame.samples}/${AUTO_UPLOAD_MIN_FRAME_SAMPLES}`,
    }
  }
  if (!report.thresholds.mobileLowTier.pass) {
    return {
      state: 'blocked',
      message: `Auto-upload blocked: ${report.thresholds.mobileLowTier.failures.join('; ')}`,
    }
  }
  const captureBlockingFinding = realDeviceCaptureBlockingFinding(report)
  if (captureBlockingFinding) {
    return {
      state: 'blocked',
      message: `Auto-upload blocked: ${captureBlockingFinding}`,
    }
  }
  return {
    state: 'ready',
    message: 'Auto-upload ready',
  }
}

function realDeviceCaptureBlockingFinding(report: BrowserProfileReport): string | null {
  if (report.capture?.deviceClass !== 'real-device') return null
  if (!sustainedDeviceTelemetryPasses(report.sustained)) {
    return 'sustained external-device-profiler telemetry must be attached before upload'
  }
  if (report.device.maxTouchPoints <= 0 || !report.device.pointerCoarse || !report.device.hoverNone) {
    return 'device touch metadata must prove real touch hardware'
  }
  if (report.capture.platform === 'mobile-safari' && !isMobileSafariRealDeviceUserAgent(report.userAgent)) {
    return 'userAgent must be Mobile Safari on iPhone or iPad hardware'
  }
  if (report.capture.platform === 'chrome-android' && !isChromeAndroidRealDeviceUserAgent(report.userAgent)) {
    return 'userAgent must be Chrome Android on Android hardware'
  }
  const deviceLabel = report.capture.deviceLabel?.trim().toLowerCase()
  if (
    !deviceLabel ||
    deviceLabel === 'unspecified real device' ||
    deviceLabel === 'unknown device' ||
    deviceLabel === 'unknown' ||
    deviceLabel === '{profiledevicelabel}' ||
    deviceLabel === 'profiledevicelabel' ||
    deviceLabel === 'replace_with_device_label'
  ) {
    return 'capture.deviceLabel must identify the concrete real device used for profiling'
  }
  return null
}

export interface PfxMarkFilter {
  ids: ReadonlySet<string>
  label: string
  /** When true, the gallery is filtered down to only the marked effects. */
  only: boolean
}

/**
 * URL-driven review marker: `?mark=id1,id2&markLabel=REDO&markOnly=1` tags
 * every matching gallery cell with a visible badge so audit findings can be
 * shared as a link. `markOnly=1` additionally narrows the gallery to the
 * marked set. Pure parsing so the contract is testable without the browser.
 */
export function readPfxMarkFilter(search?: string): PfxMarkFilter | null {
  const rawSearch = search ?? (typeof window === 'undefined' ? '' : window.location.search)
  const params = new URLSearchParams(rawSearch)
  const raw = params.get('mark')
  if (!raw) return null
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  if (ids.length === 0) return null
  const label = params.get('markLabel')?.trim() || 'MARKED'
  return { ids: new Set(ids), label, only: params.get('markOnly') === '1' }
}

export function applyPfxMarkFilter<T extends { effect: { id: string } }>(
  items: readonly T[],
  markFilter: PfxMarkFilter | null,
): T[] {
  if (!markFilter?.only) return [...items]
  return items.filter((item) => markFilter.ids.has(item.effect.id))
}

function readProfileEffectIds(): string[] | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('profileEffectIds')
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return ids.length > 0 ? ids : undefined
}

function readProfileConcurrency(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('profileConcurrency')
  if (raw === null) return undefined
  const concurrency = Number.parseInt(raw, 10)
  return Number.isFinite(concurrency) && concurrency >= 1 && concurrency <= 20 ? concurrency : undefined
}

function readReviewCamera(): 'front' | 'three-quarter' | 'side' | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('reviewCamera')
  return value === 'front' || value === 'three-quarter' || value === 'side' ? value : null
}

function readReviewCameraDistance(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('reviewCameraDistance')
  if (raw === null) return undefined
  const distance = Number(raw)
  return Number.isFinite(distance) && distance >= 1.2 && distance <= 8 ? distance : undefined
}

function readReviewFraming(): PfxReviewFraming {
  if (typeof window === 'undefined') return 'gameplay-context'
  const value = new URLSearchParams(window.location.search).get('reviewFraming')
  return value === 'isolated' ? 'isolated' : 'gameplay-context'
}

function readReviewTimeSeconds(): number | undefined {
  if (typeof window === 'undefined') return undefined
  const raw = new URLSearchParams(window.location.search).get('reviewTimeMs')
  if (raw === null) return undefined
  const milliseconds = Number(raw)
  return Number.isFinite(milliseconds) && milliseconds >= 0 ? milliseconds / 1000 : undefined
}

function createInitialPfxOrbitState(): PfxOrbitState {
  const reviewCamera = readReviewCamera()
  const reviewCameraDistance = readReviewCameraDistance()
  if (reviewCamera === 'front') return { yaw: 0, pitch: 0.18, distance: reviewCameraDistance ?? 5 }
  if (reviewCamera === 'side') return { yaw: Math.PI / 2, pitch: 0, distance: reviewCameraDistance ?? 5.2 }
  if (reviewCamera === 'three-quarter') return { yaw: 0.72, pitch: 0.34, distance: reviewCameraDistance ?? 5.2 }
  return { yaw: 0.64, pitch: 0.34, distance: 5.2 }
}

function readProfileAutoUpload(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('profileAutoUpload') === '1'
}

function readProfileDeviceLabel(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('profileDeviceLabel')
}

export function createRealDeviceCaptureQueueLink(
  platform: BrowserProfileCapturePlatform | 'auto' | undefined,
  autoUpload: boolean,
  deviceLabel: string,
): string | null {
  const trimmedDeviceLabel = concreteProfileDeviceLabel(deviceLabel)
  if (autoUpload && !trimmedDeviceLabel) return null
  const url = new URL('/__r3f-pfx-capture-next', 'http://r3f-pfx.local')
  if (platform) url.searchParams.set('platform', platform)
  if (autoUpload) url.searchParams.set('profileAutoUpload', '1')
  if (trimmedDeviceLabel) url.searchParams.set('profileDeviceLabel', trimmedDeviceLabel)
  return `${url.pathname}${url.search}`
}

export function withRequiredProfileDeviceLabel(profileUrl: string | null | undefined, deviceLabel?: string | null): string | null {
  const trimmedDeviceLabel = concreteProfileDeviceLabel(deviceLabel)
  if (!profileUrl || !trimmedDeviceLabel) return null
  const url = new URL(profileUrl)
  url.searchParams.set('profileDeviceLabel', trimmedDeviceLabel)
  return url.toString()
}

export function withProfileDeviceLabel(profileUrl: string, deviceLabel?: string | null): string {
  const trimmedDeviceLabel = concreteProfileDeviceLabel(deviceLabel)
  if (!trimmedDeviceLabel) return profileUrl
  const url = new URL(profileUrl)
  url.searchParams.set('profileDeviceLabel', trimmedDeviceLabel)
  return url.toString()
}

export function withProfileAutoUpload(profileUrl: string, deviceLabel?: string | null): string {
  const url = new URL(profileUrl)
  url.searchParams.set('profileAutoUpload', '1')
  const trimmedDeviceLabel = concreteProfileDeviceLabel(deviceLabel)
  if (trimmedDeviceLabel) url.searchParams.set('profileDeviceLabel', trimmedDeviceLabel)
  return url.toString()
}

function concreteProfileDeviceLabel(deviceLabel?: string | null): string | null {
  const trimmedDeviceLabel = deviceLabel?.trim()
  if (!trimmedDeviceLabel) return null
  const normalized = trimmedDeviceLabel.toLowerCase()
  if (
    normalized === 'unspecified real device' ||
    normalized === 'unknown device' ||
    normalized === 'unknown' ||
    normalized === '{profiledevicelabel}' ||
    normalized === 'profiledevicelabel' ||
    normalized === 'replace_with_device_label'
  ) {
    return null
  }
  return trimmedDeviceLabel
}

export function canonicalRealDeviceProfileReportUrl(profileUrl: string): string {
  const url = new URL(profileUrl)
  const canonicalParams = new URLSearchParams()
  for (const key of ['profileEffectIds', 'profilePlatform', 'profileConcurrency', 'profileBatchId']) {
    const value = url.searchParams.get(key)
    if (value) canonicalParams.set(key, value)
  }
  url.search = canonicalParams.toString()
  return url.toString()
}

export function browserProfileReportUrl(
  profileUrl: string,
  capture: Pick<BrowserProfileCapture, 'platform'> | undefined,
): string {
  return capture?.platform === 'mobile-safari' || capture?.platform === 'chrome-android'
    ? canonicalRealDeviceProfileReportUrl(profileUrl)
    : profileUrl
}

function readRealDeviceProfileCapture(): BrowserProfileCapture | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const profilePlatform = params.get('profilePlatform') as BrowserProfileCapturePlatform | null
  if (profilePlatform !== 'mobile-safari' && profilePlatform !== 'chrome-android') return undefined
  return {
    deviceClass: 'real-device',
    platform: profilePlatform,
    deviceLabel: params.get('profileDeviceLabel') ?? 'Unspecified real device',
    runner: 'manual-real-device-browser',
    notes: [
      'Generated in browser from an explicit profilePlatform URL parameter; verifier still requires matching mobile user agent, mobile viewport, WebGL, and passing thresholds.',
    ],
  }
}

function collectBrowserDeviceProfile(): BrowserProfileInput['device'] {
  if (typeof window === 'undefined') {
    return {
      maxTouchPoints: 0,
      pointerCoarse: false,
      hoverNone: false,
    }
  }
  return {
    maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
    pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
    hoverNone: window.matchMedia('(hover: none)').matches,
  }
}

export function profileCanvasFromBrowserReadback(
  canvas: HTMLCanvasElement,
  totalParticles: number,
): BrowserProfileInput['canvas'] {
  const width = Math.max(1, Math.round(canvas.width || canvas.clientWidth || 1))
  const height = Math.max(1, Math.round(canvas.height || canvas.clientHeight || 1))
  const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as
    | WebGL2RenderingContext
    | WebGLRenderingContext
    | null

  if (!gl) return createEstimatedCanvasProfile(canvas.clientWidth || width, canvas.clientHeight || height, totalParticles)

  try {
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    return {
      width,
      height,
      nonBackgroundPixels: countNonBackgroundReadbackPixels(pixels),
      measurementSource: 'screenshot-readback',
    }
  } catch {
    return createEstimatedCanvasProfile(canvas.clientWidth || width, canvas.clientHeight || height, totalParticles)
  }
}

function createEstimatedCanvasProfile(width: number, height: number, totalParticles: number): BrowserProfileInput['canvas'] {
  const canvasWidth = Math.max(1, Math.round(width))
  const canvasHeight = Math.max(1, Math.round(height))
  return {
    width: canvasWidth,
    height: canvasHeight,
    nonBackgroundPixels: Math.min(canvasWidth * canvasHeight, totalParticles * 96),
    measurementSource: 'browser-estimate',
  }
}

function countNonBackgroundReadbackPixels(pixels: Uint8Array): number {
  let count = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0
    if (alpha === 0) continue
    const red = pixels[index] ?? 0
    const green = pixels[index + 1] ?? 0
    const blue = pixels[index + 2] ?? 0
    if (Math.abs(red - 17) > 8 || Math.abs(green - 24) > 8 || Math.abs(blue - 39) > 8) {
      count += 1
    }
  }
  return count
}

function collectBrowserWebglProfile(canvas: HTMLCanvasElement): WebglProfile {
  const webgl2 = canvas.getContext('webgl2')
  const webgl = webgl2 ?? canvas.getContext('webgl')
  if (!webgl) return createUnavailableWebglProfile('webgl context unavailable in browser capture')

  const debugInfo = webgl.getExtension('WEBGL_debug_renderer_info') as
    | { UNMASKED_VENDOR_WEBGL: number; UNMASKED_RENDERER_WEBGL: number }
    | null
  const timerQueryExtension =
    webgl2 && webgl.getExtension('EXT_disjoint_timer_query_webgl2')
      ? 'EXT_disjoint_timer_query_webgl2'
      : webgl.getExtension('EXT_disjoint_timer_query')
        ? 'EXT_disjoint_timer_query'
        : 'unavailable'

  return {
    context: webgl2 ? 'webgl2' : 'webgl',
    vendor: String(debugInfo ? webgl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : webgl.getParameter(webgl.VENDOR)),
    renderer: String(debugInfo ? webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : webgl.getParameter(webgl.RENDERER)),
    version: String(webgl.getParameter(webgl.VERSION)),
    shadingLanguageVersion: String(webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION)),
    timerQueryExtension,
    gpuTimerStatus: 'unsupported',
    gpuTimerMs: null,
    notes: timerQueryExtension === 'unavailable' ? ['GPU timer extension unavailable in browser capture.'] : [],
  }
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(media.matches)
    const update = () => setReducedMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reducedMotion
}


function ControlEditor({
  definition,
  value,
  onChange,
}: {
  definition: (typeof PFX_CONTROL_DEFINITIONS)[number]
  value: PfxControls[typeof definition.key]
  onChange: (value: PfxControls[typeof definition.key]) => void
}) {
  if (definition.kind === 'range') {
    return (
      <Range
        label={definition.label}
        value={Number(value)}
        min={definition.min ?? 0}
        max={definition.max ?? 1}
        step={definition.step ?? 0.05}
        onChange={(next) => onChange(next as PfxControls[typeof definition.key])}
      />
    )
  }

  if (definition.kind === 'number') {
    return (
      <label>
        <span>{definition.label}</span>
        <input
          type="number"
          value={Number(value)}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          onChange={(event) => onChange(Number(event.currentTarget.value) as PfxControls[typeof definition.key])}
        />
      </label>
    )
  }

  if (definition.kind === 'select') {
    return (
      <label>
        <span>{definition.label}</span>
        <select
          value={String(value)}
          onChange={(event) => onChange(event.currentTarget.value as PfxControls[typeof definition.key])}
        >
          {definition.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (definition.kind === 'multi-select') {
    const selected = Array.isArray(value) ? value.map(String) : []
    return (
      <label>
        <span>{definition.label}</span>
        <select
          multiple
          value={selected}
          onChange={(event) =>
            onChange(
              Array.from(event.currentTarget.selectedOptions, (option) => option.value) as PfxControls[typeof definition.key],
            )
          }
        >
          {definition.options?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const colors = Array.isArray(value) ? value : []
  return (
    <label className="pfx-color-list">
      <span>{definition.label}</span>
      <span>
        {colors.slice(0, 3).map((color, index) => (
          <input
            key={index}
            type="color"
            value={color}
            onChange={(event) => {
              const next = [...colors]
              next[index] = event.currentTarget.value
              onChange(next as PfxControls[typeof definition.key])
            }}
          />
        ))}
      </span>
    </label>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label>
      <span>
        {label} {value.toFixed(2)}
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}
