import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BUDGETS } from '@poly/contracts/budgets'
import {
  PROPORTION_DEFAULTS,
  type AvatarProportions,
  type AvatarSlot,
  type CharacterPreset,
  type PackCatalog,
} from '@poly/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES, EYE_PRESETS, HAIR_PRESETS, SKIN_PRESETS, type PaletteRegion } from '@poly/contracts/palette'
import { CONTEXT_PACK_KEYS } from '@poly/contracts/packs'
import { RIG_SPECS, type RigId } from '@poly/contracts/rig'
import { PolyAvatar } from '../avatar/PolyAvatar'
import {
  PolyPartIndex,
  createDefaultSelection,
  resolveVisibleParts,
  selectionFromPreset,
  type PolyAvatarSelection,
} from '../avatar/composePolyAvatar'
import { LabStage } from '../scenes/LabStage'
import { LAB_FOV_DEG, labFramingFor } from '../scenes/labFraming'
import { STUDIO_GL, StudioLights } from '../scenes/studio'

type InspectorTabId = 'quick' | 'slots' | 'body' | 'face' | 'palette' | 'all'

const COMPACT_QUERY = '(max-width: 920px)'

function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(COMPACT_QUERY).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(COMPACT_QUERY)
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return compact
}

interface ProportionSliderSpec {
  key: keyof AvatarProportions
  label: string
  min: number
  max: number
  step?: number
  format?: (value: number) => string
}

const SLIDERS_BY_RIG: Readonly<Record<RigId, ProportionSliderSpec[]>> = {
  ual1: [
    { key: 'height', label: 'Stature', min: 0.75, max: 1.45 },
    {
      key: 'build',
      label: 'Physique',
      min: -1,
      max: 1,
      step: 0.05,
      format: (v) => (v < -0.15 ? `Slim ${v.toFixed(2)}` : v > 0.15 ? `Heavy +${v.toFixed(2)}` : `Athl ${v.toFixed(2)}`),
    },
    { key: 'legRatio', label: 'Leg / Torso', min: 0.75, max: 1.3 },
    { key: 'shoulderWidth', label: 'Shoulders', min: 0.8, max: 1.55 },
    { key: 'torsoBulk', label: 'Chest Depth', min: 0.8, max: 1.5 },
    { key: 'waistScale', label: 'Waist', min: 0.8, max: 1.45 },
    { key: 'headScale', label: 'Head Scale', min: 0.8, max: 1.35 },
    { key: 'neckScale', label: 'Neck Width', min: 0.75, max: 1.4 },
    { key: 'limbThickness', label: 'Limb Mass', min: 0.8, max: 1.5 },
    { key: 'armLength', label: 'Arm Reach', min: 0.8, max: 1.45 },
    { key: 'handScale', label: 'Hand Size', min: 0.75, max: 1.4 },
    { key: 'footScale', label: 'Foot Size', min: 0.8, max: 1.35 },
  ],
  quadruped: [
    { key: 'height', label: 'Size', min: 0.7, max: 1.45 },
    { key: 'legRatio', label: 'Leg Height', min: 0.75, max: 1.35 },
    { key: 'bodyLength', label: 'Body Length', min: 0.75, max: 1.4 },
    { key: 'shoulderWidth', label: 'Chest & Ruff', min: 0.75, max: 1.55 },
    { key: 'torsoBulk', label: 'Rib Depth', min: 0.75, max: 1.55 },
    { key: 'waistScale', label: 'Haunches', min: 0.75, max: 1.45 },
    { key: 'headScale', label: 'Head & Snout', min: 0.75, max: 1.4 },
    { key: 'limbThickness', label: 'Leg Mass', min: 0.75, max: 1.5 },
  ],
  arachnid: [
    { key: 'height', label: 'Size', min: 0.7, max: 1.45 },
    { key: 'legRatio', label: 'Leg Span', min: 0.75, max: 1.4 },
    { key: 'bodyLength', label: 'Body Length', min: 0.75, max: 1.4 },
    { key: 'shoulderWidth', label: 'Carapace', min: 0.75, max: 1.55 },
    { key: 'torsoBulk', label: 'Abdomen', min: 0.7, max: 1.6 },
    { key: 'headScale', label: 'Fangs & Eyes', min: 0.75, max: 1.45 },
    { key: 'limbThickness', label: 'Leg Mass', min: 0.75, max: 1.5 },
  ],
}

const FACE_SLIDERS: readonly ProportionSliderSpec[] = [
  { key: 'faceJaw', label: 'Jaw Width', min: -1, max: 1, step: 0.05 },
  { key: 'faceNose', label: 'Nose Bridge', min: -1, max: 1, step: 0.05 },
  { key: 'faceBrow', label: 'Brow Tilt', min: -1, max: 1, step: 0.05 },
  { key: 'faceSmile', label: 'Smile / Mood', min: -1, max: 1, step: 0.05 },
  { key: 'faceBlink', label: 'Eye Squint', min: 0, max: 1, step: 0.05 },
]

interface BodyPresetSpec {
  id: string
  label: string
  patch: Partial<AvatarProportions>
}

const EXPRESSION_PRESETS: readonly BodyPresetSpec[] = [
  { id: 'neutral', label: 'Neutral', patch: { faceJaw: 0, faceNose: 0, faceBrow: 0, faceSmile: 0, faceBlink: 0 } },
  { id: 'happy', label: 'Cheerful', patch: { faceBrow: 0.45, faceSmile: 0.9, faceBlink: 0.1 } },
  { id: 'fierce', label: 'Fierce', patch: { faceJaw: 0.65, faceBrow: -0.9, faceSmile: -0.7, faceBlink: 0.2 } },
  { id: 'heroic', label: 'Heroic', patch: { faceJaw: 0.85, faceNose: 0.45, faceBrow: -0.25, faceSmile: 0.35, faceBlink: 0 } },
  { id: 'blink', label: 'Squint', patch: { faceBrow: -0.3, faceSmile: 0.3, faceBlink: 0.85 } },
]

const BODY_PRESETS_BY_RIG: Readonly<Record<RigId, BodyPresetSpec[]>> = {
  ual1: [
    { id: 'heroic', label: 'Heroic', patch: { ...PROPORTION_DEFAULTS, shoulderWidth: 1.12, torsoBulk: 1.08, waistScale: 0.96 } },
    { id: 'slender', label: 'Slender', patch: { ...PROPORTION_DEFAULTS, height: 1.04, build: -0.85, legRatio: 1.06, shoulderWidth: 0.92, torsoBulk: 0.88, waistScale: 0.88, limbThickness: 0.88 } },
    { id: 'stocky', label: 'Stocky', patch: { ...PROPORTION_DEFAULTS, height: 0.86, build: 0.7, legRatio: 0.84, shoulderWidth: 1.24, torsoBulk: 1.22, waistScale: 1.18, limbThickness: 1.24 } },
    { id: 'colossus', label: 'Colossus', patch: { ...PROPORTION_DEFAULTS, height: 1.28, build: 0.9, legRatio: 0.96, shoulderWidth: 1.32, torsoBulk: 1.26, waistScale: 1.12, limbThickness: 1.3, armLength: 1.06 } },
    { id: 'lanky', label: 'Lanky', patch: { ...PROPORTION_DEFAULTS, height: 1.18, build: -0.65, legRatio: 1.14, shoulderWidth: 0.96, torsoBulk: 0.9, waistScale: 0.88, limbThickness: 0.86, armLength: 1.08 } },
  ],
  quadruped: [
    { id: 'timber', label: 'Timber', patch: { ...PROPORTION_DEFAULTS } },
    { id: 'alpha', label: 'Dire Alpha', patch: { ...PROPORTION_DEFAULTS, height: 1.2, legRatio: 1.1, bodyLength: 1.14, shoulderWidth: 1.26, torsoBulk: 1.22, headScale: 1.14, limbThickness: 1.22 } },
    { id: 'hound', label: 'Lean Hound', patch: { ...PROPORTION_DEFAULTS, height: 0.95, legRatio: 1.18, bodyLength: 1.12, shoulderWidth: 0.86, torsoBulk: 0.84, waistScale: 0.84, limbThickness: 0.84 } },
  ],
  arachnid: [
    { id: 'hunter', label: 'Hunter', patch: { ...PROPORTION_DEFAULTS } },
    { id: 'brood', label: 'Broodmother', patch: { ...PROPORTION_DEFAULTS, height: 1.22, legRatio: 1.15, shoulderWidth: 1.2, torsoBulk: 1.48, headScale: 1.15, limbThickness: 1.25 } },
    { id: 'skitter', label: 'Skitterling', patch: { ...PROPORTION_DEFAULTS, height: 0.78, legRatio: 1.2, bodyLength: 0.88, torsoBulk: 0.78, limbThickness: 0.82 } },
  ],
}

const MORPH_BASE_COORD: Record<string, number> = { body_slim: -1, body_athletic: 0, body_heavy: 1 }

/** The lab stage with the framing for the current viewport shape. */
function FramedLabStage({
  rigId,
  proportions,
  viewEpoch,
  turntable,
  children,
}: {
  rigId: RigId
  proportions: AvatarProportions
  viewEpoch: number
  turntable: boolean
  children: ReactNode
}) {
  const aspect = useThree((state) => state.viewport.aspect)
  const framing = useMemo(() => labFramingFor(rigId, proportions, aspect), [rigId, proportions, aspect])
  return (
    <LabStage framing={framing} viewEpoch={viewEpoch} turntable={turntable}>
      {children}
    </LabStage>
  )
}

export function AvatarLabTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const allPresets = useMemo<CharacterPreset[]>(() => catalogs.flatMap((c) => c.presets), [catalogs])
  const initialPreset = useMemo(() => allPresets.find((p) => p.pack !== 'core') ?? allPresets[0], [allPresets])
  const [selection, setSelection] = useState<PolyAvatarSelection>(() =>
    initialPreset ? selectionFromPreset(initialPreset) : createDefaultSelection(index, 'medieval'),
  )
  const [activePresetId, setActivePresetId] = useState<string | null>(initialPreset?.id ?? null)
  const [liveStats, setLiveStats] = useState<{ triangles: number; drawCalls: number; activeBones: number } | null>(null)
  // A new epoch frames the subject again: a preset click, a rig change or the Reset View button.
  const [viewEpoch, setViewEpoch] = useState(0)
  const [turntable, setTurntable] = useState(false)
  const [holdPhase, setHoldPhase] = useState<number | null>(null)
  const isCompact = useIsCompactViewport()
  const [inspectorTab, setInspectorTab] = useState<InspectorTabId>('quick')
  const [expanded3D, setExpanded3D] = useState(false)
  const reframe = () => setViewEpoch((epoch) => epoch + 1)

  useEffect(() => {
    if (selection.rigId !== 'ual1' && inspectorTab === 'face') {
      setInspectorTab('body')
    }
  }, [selection.rigId, inspectorTab])

  const toggleExpand3D = () => {
    setExpanded3D((prev) => !prev)
    window.setTimeout(reframe, 70)
  }

  const showAll = !isCompact || inspectorTab === 'all'
  const showQuick = showAll || inspectorTab === 'quick'
  const showSlots = showAll || inspectorTab === 'slots'
  const showBody = showAll || inspectorTab === 'body'
  const showFace = showAll || inspectorTab === 'face'
  const showPalette = showAll || inspectorTab === 'palette'

  const inspectorTabs: { id: InspectorTabId; label: string }[] = [
    { id: 'quick', label: 'Quick' },
    { id: 'slots', label: 'Slots' },
    { id: 'body', label: 'Body' },
    ...(selection.rigId === 'ual1' ? [{ id: 'face' as const, label: 'Face' }] : []),
    { id: 'palette', label: 'Palette' },
    { id: 'all', label: 'All' },
  ]

  const resolved = useMemo(() => resolveVisibleParts(selection, index), [selection, index])
  const heldTris =
    selection.rigId === 'ual1'
      ? (selection.heldRight ? index.getHeld(selection.heldRight).triangles : 0) +
        (selection.heldLeft ? index.getHeld(selection.heldLeft).triangles : 0)
      : 0
  const totalBudgetTris = resolved.totalTriangles + heldTris
  const headwearHidesHair = selection.headwear ? index.getPart(selection.headwear).rules.hidesHair : false
  const heldRightItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_r'), [index])
  const heldLeftItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_l'), [index])
  const rigClips = RIG_SPECS[selection.rigId].clips

  const setSlot = (slot: AvatarSlot, value: string | null) => {
    if (slot === 'body' && value) {
      const part = index.getPart(value)
      const nextRig = part.rigId ?? 'ual1'
      if (nextRig !== selection.rigId) reframe()
      setSelection((prev) => {
        if (nextRig === prev.rigId) {
          const resetBuild = !(value in MORPH_BASE_COORD) ? { build: 0 } : {}
          return { ...prev, body: value, proportions: { ...prev.proportions, ...resetBuild } }
        }
        if (nextRig !== 'ual1') {
          return {
            ...prev,
            rigId: nextRig,
            body: value,
            head: null,
            hair: null,
            torso: null,
            legs: null,
            headwear: null,
            back: null,
            heldRight: null,
            heldLeft: null,
            clip: RIG_SPECS[nextRig].clips[0]!,
          }
        }
        const fallback = createDefaultSelection(index, 'medieval')
        return {
          ...fallback,
          rigId: 'ual1',
          body: value,
          palette: prev.palette,
          proportions: prev.proportions,
        }
      })
      return
    }
    setSelection((prev) => ({ ...prev, [slot]: value }))
  }

  const setPaletteColor = (region: PaletteRegion, hex: string) => {
    setSelection((prev) => ({ ...prev, palette: { ...prev.palette, [region]: hex } }))
  }

  const setProportion = (key: keyof AvatarProportions, val: number) => {
    setSelection((prev) => {
      if (key === 'build' && prev.body in MORPH_BASE_COORD) {
        return { ...prev, body: 'body_athletic', proportions: { ...prev.proportions, build: val } }
      }
      return { ...prev, proportions: { ...prev.proportions, [key]: val } }
    })
  }

  const applyBodyPreset = (patch: Partial<AvatarProportions>) => {
    setSelection((prev) => ({
      ...prev,
      ...(prev.rigId === 'ual1' && prev.body in MORPH_BASE_COORD && patch.build !== undefined ? { body: 'body_athletic' } : {}),
      proportions: {
        ...prev.proportions,
        ...patch,
        ...(prev.rigId === 'ual1' && !(prev.body in MORPH_BASE_COORD) ? { build: 0 } : {}),
      },
    }))
  }

  const sliders = SLIDERS_BY_RIG[selection.rigId]
  const bodyPresets = BODY_PRESETS_BY_RIG[selection.rigId]
  const isMorphableHumanBody = selection.body in MORPH_BASE_COORD
  const effectivePhysique = isMorphableHumanBody
    ? Math.max(-1, Math.min(1, MORPH_BASE_COORD[selection.body]! + (selection.proportions.build ?? 0)))
    : 0

  const triBudgetOk = totalBudgetTris <= BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar

  return (
    <div className={`split-lab ${isCompact && expanded3D ? 'expanded-3d' : ''}`}>
      <aside className="sidebar">
        {isCompact && (
          <nav className="inspector-tabs" aria-label="Inspector sections">
            {inspectorTabs.map((item) => (
              <button
                key={item.id}
                className={`pill-btn ${inspectorTab === item.id ? 'active' : ''}`}
                onClick={() => setInspectorTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {showQuick && (
          <div className="section-card">
            <h3 className="section-title">Context Presets</h3>
            <div className="preset-pills">
              {allPresets.map((p) => (
                <button
                  key={p.id}
                  className={`pill-btn ${activePresetId === p.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelection(selectionFromPreset(p))
                    setActivePresetId(p.id)
                    reframe()
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showQuick && (
          <div className="section-card">
            <h3 className="section-title">
              Animation Clip ({selection.rigId.toUpperCase()} · {rigClips.length})
            </h3>
            <div className="field-row">
              <label>Clip</label>
              <select value={selection.clip} onChange={(e) => setSelection((s) => ({ ...s, clip: e.target.value }))}>
                {rigClips.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-row">
              <label>
                <input
                  type="checkbox"
                  aria-label="Hold pose"
                  checked={holdPhase !== null}
                  onChange={(e) => setHoldPhase(e.target.checked ? 0.5 : null)}
                />{' '}
                Hold pose
              </label>
              <input
                type="range"
                aria-label="Pose phase"
                min={0}
                max={1}
                step={0.01}
                disabled={holdPhase === null}
                value={holdPhase ?? 0}
                onChange={(e) => setHoldPhase(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {showSlots && (
          <div className="section-card">
            <h3 className="section-title">Modular Slots (Cross-Pack)</h3>
            {(['body', 'head', 'hair', 'torso', 'legs', 'headwear', 'back'] as const).map((slot) => {
              const options = (index.partsBySlot.get(slot) ?? []).filter(
                (opt) => slot === 'body' || opt.rigId === selection.rigId,
              )
              const optional = slot === 'hair' || slot === 'headwear' || slot === 'back'
              const isCreatureSlotDisabled = selection.rigId !== 'ual1' && slot !== 'body'
              const disabled = isCreatureSlotDisabled || (slot === 'hair' && headwearHidesHair)
              return (
                <div key={slot} className="field-row">
                  <label style={{ textTransform: 'capitalize' }}>{slot}</label>
                  <select
                    disabled={disabled}
                    value={disabled ? '' : (selection[slot] ?? '')}
                    onChange={(e) => setSlot(slot, e.target.value === '' ? null : e.target.value)}
                  >
                    {isCreatureSlotDisabled && <option value="">— n/a on {selection.rigId} rig —</option>}
                    {!isCreatureSlotDisabled && disabled && <option value="">— hidden by headwear —</option>}
                    {!disabled && optional && <option value="">— none —</option>}
                    {!disabled &&
                      options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          [{opt.pack}] {opt.label} ({opt.triangles}△)
                        </option>
                      ))}
                  </select>
                </div>
              )
            })}

            <div className="field-row">
              <label>Hand R</label>
              <select
                disabled={selection.rigId !== 'ual1'}
                value={selection.rigId !== 'ual1' ? '' : (selection.heldRight ?? '')}
                onChange={(e) => setSelection((s) => ({ ...s, heldRight: e.target.value || null }))}
              >
                <option value="">{selection.rigId !== 'ual1' ? '— n/a —' : '— empty —'}</option>
                {selection.rigId === 'ual1' &&
                  heldRightItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.pack}] {h.label}
                    </option>
                  ))}
              </select>
            </div>

            <div className="field-row">
              <label>Hand L</label>
              <select
                disabled={selection.rigId !== 'ual1'}
                value={selection.rigId !== 'ual1' ? '' : (selection.heldLeft ?? '')}
                onChange={(e) => setSelection((s) => ({ ...s, heldLeft: e.target.value || null }))}
              >
                <option value="">{selection.rigId !== 'ual1' ? '— n/a —' : '— empty —'}</option>
                {selection.rigId === 'ual1' &&
                  heldLeftItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      [{h.pack}] {h.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {showBody && (
          <div className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title">Parametric Proportions</h3>
              <button
                className="pill-btn"
                onClick={() => setSelection((s) => ({ ...s, proportions: { ...PROPORTION_DEFAULTS } }))}
              >
                Reset
              </button>
            </div>
            <div className="preset-pills">
              {bodyPresets.map((bp) => (
                <button key={bp.id} className="pill-btn" onClick={() => applyBodyPreset(bp.patch)}>
                  {bp.label}
                </button>
              ))}
            </div>
            {sliders.map((sl) => {
              const isBuild = sl.key === 'build'
              const disabled = isBuild && !isMorphableHumanBody
              const val = isBuild
                ? effectivePhysique
                : (selection.proportions[sl.key] ?? (PROPORTION_DEFAULTS[sl.key] as number))
              const readout = disabled ? 'Sculpted' : sl.format ? sl.format(val) : val.toFixed(2)
              return (
                <div key={sl.key} className="field-row prop-row">
                  <label title={disabled ? 'Orc and Troll use custom sculpted torsos' : undefined}>
                    {sl.label} ({readout})
                  </label>
                  <input
                    type="range"
                    aria-label={sl.label}
                    min={sl.min}
                    max={sl.max}
                    step={sl.step ?? 0.01}
                    disabled={disabled}
                    value={val}
                    onChange={(e) => setProportion(sl.key, Number(e.target.value))}
                  />
                </div>
              )
            })}
          </div>
        )}

        {showFace && selection.rigId === 'ual1' && (
          <div className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="section-title">Face &amp; Expression</h3>
              <button
                className="pill-btn"
                onClick={() => applyBodyPreset({ faceJaw: 0, faceNose: 0, faceBrow: 0, faceSmile: 0, faceBlink: 0 })}
              >
                Reset
              </button>
            </div>
            <div className="preset-pills">
              {EXPRESSION_PRESETS.map((ep) => (
                <button key={ep.id} className="pill-btn" onClick={() => applyBodyPreset(ep.patch)}>
                  {ep.label}
                </button>
              ))}
            </div>
            {FACE_SLIDERS.map((sl) => {
              const isHumanHead = selection.head === 'head_hero' || selection.head === 'head_stern' || selection.head === 'head_cheerful'
              const val = selection.proportions[sl.key] ?? (PROPORTION_DEFAULTS[sl.key] as number)
              return (
                <div key={sl.key} className="field-row prop-row">
                  <label title={!isHumanHead ? 'Orc and Troll use sculpted creature heads' : undefined}>
                    {sl.label} ({!isHumanHead ? 'Sculpted' : val.toFixed(2)})
                  </label>
                  <input
                    type="range"
                    aria-label={sl.label}
                    min={sl.min}
                    max={sl.max}
                    step={sl.step ?? 0.05}
                    disabled={!isHumanHead}
                    value={val}
                    onChange={(e) => setProportion(sl.key, Number(e.target.value))}
                  />
                </div>
              )
            })}
          </div>
        )}

        {showPalette && (
          <div className="section-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h3 className="section-title">7-Region UV Shader Palette</h3>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CONTEXT_PACK_KEYS.map((ctx) => (
                  <button
                    key={ctx}
                    className="pill-btn"
                    onClick={() => setSelection((s) => ({ ...s, palette: { ...CONTEXT_DEFAULT_PALETTES[ctx] } }))}
                  >
                    {ctx}
                  </button>
                ))}
              </div>
            </div>
            <div className="palette-grid">
              {(['skin', 'hair', 'eye', 'primary', 'secondary', 'accent', 'metal'] as const).map((reg) => (
                <label key={reg} className="color-chip">
                  <span style={{ textTransform: 'capitalize' }}>{reg}</span>
                  <input
                    type="color"
                    value={selection.palette[reg] ?? '#1f2634'}
                    onChange={(e) => setPaletteColor(reg, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {SKIN_PRESETS.map((sp) => (
                <button
                  key={sp.name}
                  title={`Skin: ${sp.name}`}
                  onClick={() => setPaletteColor('skin', sp.hex)}
                  style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #445', background: sp.hex, cursor: 'pointer' }}
                />
              ))}
              <span style={{ width: 8 }} />
              {HAIR_PRESETS.map((hp) => (
                <button
                  key={hp.name}
                  title={`Hair: ${hp.name}`}
                  onClick={() => setPaletteColor('hair', hp.hex)}
                  style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid #445', background: hp.hex, cursor: 'pointer' }}
                />
              ))}
              <span style={{ width: 8 }} />
              {EYE_PRESETS.map((ep) => (
                <button
                  key={ep.name}
                  title={`Eye: ${ep.name}`}
                  onClick={() => setPaletteColor('eye', ep.hex)}
                  style={{ width: 20, height: 20, borderRadius: '50%', border: '1px solid #667', background: ep.hex, cursor: 'pointer' }}
                />
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="viewport-wrap">
        <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ fov: LAB_FOV_DEG, near: 0.1, far: 60 }}>
          <StudioLights />
          <FramedLabStage
            rigId={selection.rigId}
            proportions={selection.proportions}
            viewEpoch={viewEpoch}
            turntable={turntable}
          >
            <Suspense fallback={null}>
              <PolyAvatar selection={selection} index={index} blobShadow onStats={setLiveStats} holdPhase={holdPhase} />
            </Suspense>
          </FramedLabStage>
        </Canvas>

        <div className="hud-overlay">
          {isCompact ? (
            <>
              <div className="hud-card hud-compact-pill">
                <span className={`compact-stat ${triBudgetOk ? 'good' : 'warn'}`}>
                  {(liveStats?.triangles ?? totalBudgetTris).toLocaleString()}△
                </span>
                <span className="compact-sep">·</span>
                <span className="compact-stat good">{liveStats?.drawCalls ?? '—'}d</span>
                <span className="compact-sep">·</span>
                <span className="compact-stat">
                  {liveStats?.activeBones ?? RIG_SPECS[selection.rigId].joints.length}b
                </span>
              </div>
              <div className="hud-card hud-compact-actions">
                <button
                  className={`pill-btn ${turntable ? 'active' : ''}`}
                  aria-label={`Turntable: ${turntable ? 'On' : 'Off'}`}
                  onClick={() => setTurntable((on) => !on)}
                >
                  {turntable ? 'Spin On' : 'Spin'}
                </button>
                <button className="pill-btn" onClick={reframe}>
                  Reset View
                </button>
                <button className={`pill-btn ${expanded3D ? 'active' : ''}`} onClick={toggleExpand3D}>
                  {expanded3D ? 'Split' : 'Expand'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="hud-card">
                <div className="metric">
                  <span className="metric-label">Avatar Triangles</span>
                  <span className={`metric-val ${triBudgetOk ? 'good' : 'warn'}`}>
                    {liveStats?.triangles ?? totalBudgetTris} / {BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Mesh Draw Calls</span>
                  <span className="metric-val good">{liveStats?.drawCalls ?? '—'}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Skeleton Bones</span>
                  <span className="metric-val">
                    {liveStats?.activeBones ?? RIG_SPECS[selection.rigId].joints.length} ({selection.rigId})
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Shadow Mode</span>
                  <span className="metric-val good">Blob (0 passes)</span>
                </div>
              </div>
              <div className="hud-card" style={{ alignItems: 'center' }}>
                <button className={`pill-btn ${turntable ? 'active' : ''}`} onClick={() => setTurntable((on) => !on)}>
                  Turntable: {turntable ? 'On' : 'Off'}
                </button>
                <button className="pill-btn" onClick={reframe}>
                  Reset View
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
