import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useMemo, useState, type ReactNode } from 'react'
import { BUDGETS } from '@voxchar/contracts/budgets'
import {
  HUMANOID_PROPORTION_DEFAULTS,
  PROPORTION_DEFAULTS,
  type AvatarProportions,
  type AvatarSlot,
  type CharacterPreset,
  type PackCatalog,
} from '@voxchar/contracts/catalog'
import {
  CONTEXT_DEFAULT_PALETTES,
  HAIR_PRESETS,
  PALETTE_REGIONS,
  SKIN_PRESETS,
  resolvePaletteColors,
  type PaletteRegion,
} from '@voxchar/contracts/palette'
import { CONTEXT_PACK_KEYS } from '@voxchar/contracts/packs'
import { RIG_SPECS, type RigId } from '@voxchar/contracts/rig'
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

interface ProportionSliderSpec {
  key: keyof AvatarProportions
  label: string
  min: number
  max: number
  step?: number
  format?: (value: number) => string
}

const ANIMAL_SLIDERS: ProportionSliderSpec[] = [{ key: 'height', label: 'Size', min: 0.6, max: 1.5 }]

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
    { key: 'limbThickness', label: 'Limb Mass', min: 0.8, max: 1.5 },
    { key: 'armLength', label: 'Arm Reach', min: 0.8, max: 1.45 },
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
  fox: ANIMAL_SLIDERS,
  horse: ANIMAL_SLIDERS,
  wolf: ANIMAL_SLIDERS,
  corgi: ANIMAL_SLIDERS,
  pug: ANIMAL_SLIDERS,
  gsd: ANIMAL_SLIDERS,
  cat: ANIMAL_SLIDERS,
}

interface BodyPresetSpec {
  id: string
  label: string
  patch: Partial<AvatarProportions>
}

/**
 * Body presets of the UAL1 rig. `height`, `legRatio`, `shoulderWidth` and `armLength` are offsets from `base`,
 * the neutral proportions of the body: the voxel humans are sculpted for `HUMANOID_PROPORTION_DEFAULTS`.
 */
function humanBodyPresets(base: AvatarProportions): BodyPresetSpec[] {
  const offset = (key: 'height' | 'legRatio' | 'shoulderWidth' | 'armLength', delta: number) => (base[key] ?? 1) + delta
  return [
    { id: 'heroic', label: 'Heroic', patch: { ...base, shoulderWidth: offset('shoulderWidth', 0.06), torsoBulk: 1.08, waistScale: 0.96 } },
    { id: 'slender', label: 'Slender', patch: { ...base, height: offset('height', 0.04), build: -0.85, legRatio: offset('legRatio', 0.06), shoulderWidth: offset('shoulderWidth', -0.04), torsoBulk: 0.88, waistScale: 0.88, limbThickness: 0.88 } },
    { id: 'stocky', label: 'Stocky', patch: { ...base, height: offset('height', -0.14), build: 0.7, legRatio: offset('legRatio', -0.1), shoulderWidth: offset('shoulderWidth', 0.08), torsoBulk: 1.22, waistScale: 1.18, limbThickness: 1.24 } },
    { id: 'colossus', label: 'Colossus', patch: { ...base, height: offset('height', 0.28), build: 0.9, legRatio: offset('legRatio', -0.04), shoulderWidth: offset('shoulderWidth', 0.09), torsoBulk: 1.26, waistScale: 1.12, limbThickness: 1.3, armLength: offset('armLength', 0.06) } },
    { id: 'lanky', label: 'Lanky', patch: { ...base, height: offset('height', 0.18), build: -0.65, legRatio: offset('legRatio', 0.14), shoulderWidth: offset('shoulderWidth', -0.02), torsoBulk: 0.9, waistScale: 0.88, limbThickness: 0.86, armLength: offset('armLength', 0.08) } },
  ]
}

const ANIMAL_SIZE_PRESETS: BodyPresetSpec[] = [
  { id: 'standard', label: 'Standard', patch: { ...PROPORTION_DEFAULTS, height: 1 } },
  { id: 'large', label: 'Large (1.2×)', patch: { ...PROPORTION_DEFAULTS, height: 1.2 } },
  { id: 'compact', label: 'Compact (0.8×)', patch: { ...PROPORTION_DEFAULTS, height: 0.8 } },
]

const CREATURE_BODY_PRESETS: Readonly<Partial<Record<Exclude<RigId, 'ual1'>, BodyPresetSpec[]>>> = {
  quadruped: [
    { id: 'timber', label: 'Guard Hound', patch: { ...PROPORTION_DEFAULTS } },
    { id: 'alpha', label: 'Dire Alpha', patch: { ...PROPORTION_DEFAULTS, height: 1.2, legRatio: 1.1, bodyLength: 1.14, shoulderWidth: 1.26, torsoBulk: 1.22, headScale: 1.14, limbThickness: 1.22 } },
    { id: 'hound', label: 'Lean Hound', patch: { ...PROPORTION_DEFAULTS, height: 0.95, legRatio: 1.18, bodyLength: 1.12, shoulderWidth: 0.86, torsoBulk: 0.84, waistScale: 0.84, limbThickness: 0.84 } },
  ],
  arachnid: [
    { id: 'hunter', label: 'Scrap Spider', patch: { ...PROPORTION_DEFAULTS } },
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
    initialPreset ? selectionFromPreset(initialPreset) : createDefaultSelection(index, 'heist'),
  )
  const [activePresetId, setActivePresetId] = useState<string | null>(initialPreset?.id ?? null)
  const [liveStats, setLiveStats] = useState<{ triangles: number; drawCalls: number; activeBones: number } | null>(null)
  // A new epoch frames the subject again: a preset click, a rig change or the Reset View button.
  const [viewEpoch, setViewEpoch] = useState(0)
  const [turntable, setTurntable] = useState(false)
  const [holdPhase, setHoldPhase] = useState<number | null>(null)
  const reframe = () => setViewEpoch((epoch) => epoch + 1)

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
        const fallback = createDefaultSelection(index, 'heist')
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
  const isMorphableHumanBody = selection.body in MORPH_BASE_COORD
  // The voxel humans are sculpted for the humanoid defaults. The Scrap Bot and the creatures are sculpted at 1.0.
  const baseProportions: AvatarProportions = isMorphableHumanBody ? HUMANOID_PROPORTION_DEFAULTS : PROPORTION_DEFAULTS
  const bodyPresets =
    selection.rigId === 'ual1'
      ? humanBodyPresets(baseProportions)
      : (CREATURE_BODY_PRESETS[selection.rigId] ?? ANIMAL_SIZE_PRESETS)
  const effectivePhysique = isMorphableHumanBody
    ? Math.max(-1, Math.min(1, MORPH_BASE_COORD[selection.body]! + (selection.proportions.build ?? 0)))
    : 0

  const triBudgetOk = totalBudgetTris <= BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar

  return (
    <div className="split-lab">
      <aside className="sidebar">
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

        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">Parametric Proportions</h3>
            <button
              className="pill-btn"
              onClick={() => setSelection((s) => ({ ...s, proportions: { ...baseProportions } }))}
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
                <label title={disabled ? 'Scrap Bot and creatures use custom sculpted bodies' : undefined}>
                  {sl.label} ({readout})
                </label>
                <input
                  type="range"
                  aria-label={sl.label}
                  min={sl.min}
                  max={sl.max}
                  step={sl.step ?? 0.02}
                  disabled={disabled}
                  value={val}
                  onChange={(e) => setProportion(sl.key, Number(e.target.value))}
                />
              </div>
            )
          })}
        </div>

        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">10-Region UV Shader Palette</h3>
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
            {PALETTE_REGIONS.map((reg) => {
              const resolvedPalette = resolvePaletteColors(selection.palette)
              return (
                <label key={reg} className="color-chip">
                  <span style={{ textTransform: 'capitalize' }}>{reg}</span>
                  <input
                    type="color"
                    value={resolvedPalette[reg]}
                    onChange={(e) => setPaletteColor(reg, e.target.value)}
                  />
                </label>
              )
            })}
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
          </div>
        </div>
      </aside>

      <div className="viewport-wrap">
        <Canvas shadows dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ fov: LAB_FOV_DEG, near: 0.1, far: 60 }}>
          <StudioLights heroShadows />
          <FramedLabStage
            rigId={selection.rigId}
            proportions={selection.proportions}
            viewEpoch={viewEpoch}
            turntable={turntable}
          >
            <Suspense fallback={null}>
              <PolyAvatar selection={selection} index={index} castShadow onStats={setLiveStats} holdPhase={holdPhase} />
            </Suspense>
          </FramedLabStage>
        </Canvas>

        <div className="hud-overlay">
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
              <span className="metric-val good">Hero Cast (Focus)</span>
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
        </div>
      </div>
    </div>
  )
}
