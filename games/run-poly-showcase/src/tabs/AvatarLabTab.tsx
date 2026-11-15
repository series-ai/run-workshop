import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useState } from 'react'
import { BUDGETS } from '@poly/contracts/budgets'
import {
  PROPORTION_DEFAULTS,
  type AvatarProportions,
  type AvatarSlot,
  type CharacterPreset,
  type PackCatalog,
} from '@poly/contracts/catalog'
import { CONTEXT_DEFAULT_PALETTES, HAIR_PRESETS, SKIN_PRESETS, type PaletteRegion } from '@poly/contracts/palette'
import { UAL1_CLIPS } from '@poly/contracts/rig'
import { PolyAvatar } from '../avatar/PolyAvatar'
import {
  PolyPartIndex,
  createDefaultSelection,
  resolveVisibleParts,
  selectionFromPreset,
  type PolyAvatarSelection,
} from '../avatar/composePolyAvatar'

const PROPORTION_SLIDERS: { key: keyof AvatarProportions; label: string; min: number; max: number }[] = [
  { key: 'height', label: 'Height', min: 0.85, max: 1.15 },
  { key: 'shoulderWidth', label: 'Shoulders', min: 0.85, max: 1.3 },
  { key: 'torsoBulk', label: 'Torso Bulk', min: 0.85, max: 1.3 },
  { key: 'waistScale', label: 'Waist', min: 0.85, max: 1.25 },
  { key: 'headScale', label: 'Head Scale', min: 0.85, max: 1.25 },
  { key: 'limbThickness', label: 'Limb Mass', min: 0.85, max: 1.25 },
]

export function AvatarLabTab({ catalogs, index }: { catalogs: PackCatalog[]; index: PolyPartIndex }) {
  const allPresets = useMemo<CharacterPreset[]>(() => catalogs.flatMap((c) => c.presets), [catalogs])
  const [selection, setSelection] = useState<PolyAvatarSelection>(() =>
    allPresets[0] ? selectionFromPreset(allPresets[0]) : createDefaultSelection(index, 'medieval'),
  )
  const [liveStats, setLiveStats] = useState<{ triangles: number; drawCalls: number; activeBones: number } | null>(null)

  const resolved = useMemo(() => resolveVisibleParts(selection, index), [selection, index])
  const headwearHidesHair = selection.headwear ? index.getPart(selection.headwear).rules.hidesHair : false
  const heldRightItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_r'), [index])
  const heldLeftItems = useMemo(() => [...index.heldById.values()].filter((h) => h.hand === 'hand_l'), [index])

  const setSlot = (slot: AvatarSlot, value: string | null) => {
    setSelection((prev) => ({ ...prev, [slot]: value }))
  }

  const setPaletteColor = (region: PaletteRegion, hex: string) => {
    setSelection((prev) => ({ ...prev, palette: { ...prev.palette, [region]: hex } }))
  }

  const setProportion = (key: keyof AvatarProportions, val: number) => {
    setSelection((prev) => ({ ...prev, proportions: { ...prev.proportions, [key]: val } }))
  }

  const triBudgetOk = resolved.totalTriangles <= BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar

  return (
    <div className="split-lab">
      <aside className="sidebar">
        <div className="section-card">
          <h3 className="section-title">Context Presets</h3>
          <div className="preset-pills">
            {allPresets.map((p) => (
              <button key={p.id} className="pill-btn" onClick={() => setSelection(selectionFromPreset(p))}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title">Animation Clip (UAL1 · {UAL1_CLIPS.length})</h3>
          <div className="field-row">
            <label>Clip</label>
            <select value={selection.clip} onChange={(e) => setSelection((s) => ({ ...s, clip: e.target.value }))}>
              {UAL1_CLIPS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="section-card">
          <h3 className="section-title">Modular Slots (Cross-Pack)</h3>
          {(['body', 'head', 'hair', 'torso', 'legs', 'headwear', 'back'] as const).map((slot) => {
            const options = index.partsBySlot.get(slot) ?? []
            const optional = slot === 'hair' || slot === 'headwear' || slot === 'back'
            const disabled = slot === 'hair' && headwearHidesHair
            return (
              <div key={slot} className="field-row">
                <label style={{ textTransform: 'capitalize' }}>{slot}</label>
                <select
                  disabled={disabled}
                  value={disabled ? '' : (selection[slot] ?? '')}
                  onChange={(e) => setSlot(slot, e.target.value === '' ? null : e.target.value)}
                >
                  {disabled && <option value="">— hidden by headwear —</option>}
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
              value={selection.heldRight ?? ''}
              onChange={(e) => setSelection((s) => ({ ...s, heldRight: e.target.value || null }))}
            >
              <option value="">— empty —</option>
              {heldRightItems.map((h) => (
                <option key={h.id} value={h.id}>
                  [{h.pack}] {h.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <label>Hand L</label>
            <select
              value={selection.heldLeft ?? ''}
              onChange={(e) => setSelection((s) => ({ ...s, heldLeft: e.target.value || null }))}
            >
              <option value="">— empty —</option>
              {heldLeftItems.map((h) => (
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
              onClick={() => setSelection((s) => ({ ...s, proportions: { ...PROPORTION_DEFAULTS } }))}
            >
              Reset
            </button>
          </div>
          {PROPORTION_SLIDERS.map((sl) => (
            <div key={sl.key} className="field-row">
              <label>
                {sl.label} ({selection.proportions[sl.key].toFixed(2)})
              </label>
              <input
                type="range"
                min={sl.min}
                max={sl.max}
                step={0.02}
                value={selection.proportions[sl.key]}
                onChange={(e) => setProportion(sl.key, Number(e.target.value))}
              />
            </div>
          ))}
        </div>

        <div className="section-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">6-Region UV Shader Palette</h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['medieval', 'ww2', 'sim'] as const).map((ctx) => (
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
            {(['skin', 'hair', 'primary', 'secondary', 'accent', 'metal'] as const).map((reg) => (
              <label key={reg} className="color-chip">
                <span style={{ textTransform: 'capitalize' }}>{reg}</span>
                <input
                  type="color"
                  value={selection.palette[reg]}
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
          </div>
        </div>
      </aside>

      <div className="viewport-wrap">
        <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} camera={{ position: [0, 1.45, 3.6], fov: 36 }}>
          <color attach="background" args={['#0d131d']} />
          <hemisphereLight args={['#dce8ff', '#2b3342', 0.95]} />
          <directionalLight position={[3, 5, 4]} intensity={1.35} />
          <directionalLight position={[-3, 2, -2]} intensity={0.45} color="#8ab4f8" />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
            <circleGeometry args={[1.9, 32]} />
            <meshStandardMaterial color="#182130" roughness={0.95} />
          </mesh>
          <gridHelper args={[6, 12, '#2a3950', '#182233']} />
          <Suspense fallback={null}>
            <PolyAvatar selection={selection} index={index} blobShadow onStats={setLiveStats} />
          </Suspense>
          <OrbitControls target={[0, 1.0, 0]} minDistance={1.8} maxDistance={8} />
        </Canvas>

        <div className="hud-overlay">
          <div className="hud-card">
            <div className="metric">
              <span className="metric-label">Avatar Triangles</span>
              <span className={`metric-val ${triBudgetOk ? 'good' : 'warn'}`}>
                {liveStats?.triangles ?? resolved.totalTriangles} / {BUDGETS.mobilePolicy.maxTrianglesPerComposedAvatar}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Mesh Draw Calls</span>
              <span className="metric-val good">{liveStats?.drawCalls ?? '—'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Skeleton Bones</span>
              <span className="metric-val">{liveStats?.activeBones ?? 53}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Shadow Mode</span>
              <span className="metric-val good">Blob (0 passes)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
