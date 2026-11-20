import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BUDGETS } from '@chisel/contracts/budgets'
import {
  AVATAR_SLOTS,
  type AvatarPartEntry,
  type AvatarSlot,
  type CharacterPreset,
  type HeldItemEntry,
  type PackCatalog,
  type WorldPropEntry,
} from '@chisel/contracts/catalog'
import { leafFor, POLY_PACK_KEYS, type PolyPackKey } from '@chisel/contracts/packs'
import { RIG_SPECS } from '@chisel/contracts/rig'
import type { PolyPartIndex } from '../avatar/composePolyAvatar'
import { GalleryStageContent, type GalleryItem } from '../avatar/SinglePartPreview'
import { previewRef } from '../catalog'
import { STUDIO_GL, StudioLights } from '../scenes/studio'
import { useAssetUrl } from '../useAssetUrl'

type FilterKind = 'all' | 'preset' | AvatarSlot | 'held' | 'prop'

const PAGE_SIZE = 60

interface CatalogRow {
  key: string
  id: string
  label: string
  pack: PolyPackKey
  kindLabel: string
  filterKind: Exclude<FilterKind, 'all'>
  item: GalleryItem
  previewSource: { id: string; pack: PolyPackKey; leaf: 'characters' | 'world'; relativePath: string } | null
}

function buildRows(catalogs: PackCatalog[], index: PolyPartIndex): CatalogRow[] {
  const rows: CatalogRow[] = []
  for (const cat of catalogs) {
    for (const p of cat.presets) {
      const rep =
        (p.pack !== 'core' && p.torso ? index.partsById.get(p.torso) : undefined) ??
        index.partsById.get(p.body) ??
        null
      rows.push({
        key: `preset:${p.id}`,
        id: p.id,
        label: p.label,
        pack: p.pack,
        kindLabel: p.rigId === 'ual1' ? 'Preset' : `Creature (${p.rigId})`,
        filterKind: 'preset',
        item: { kind: 'preset', entry: p },
        previewSource: rep,
      })
    }
    for (const part of cat.parts) {
      rows.push({
        key: `part:${part.id}`,
        id: part.id,
        label: part.label,
        pack: part.pack,
        kindLabel: part.slot,
        filterKind: part.slot,
        item: { kind: 'part', entry: part },
        previewSource: part,
      })
    }
    for (const held of cat.heldItems) {
      rows.push({
        key: `held:${held.id}`,
        id: held.id,
        label: held.label,
        pack: held.pack,
        kindLabel: `held (${held.hand === 'hand_r' ? 'R' : 'L'})`,
        filterKind: 'held',
        item: { kind: 'held', entry: held },
        previewSource: held,
      })
    }
    for (const prop of cat.props) {
      rows.push({
        key: `prop:${prop.id}`,
        id: prop.id,
        label: prop.label,
        pack: prop.pack,
        kindLabel: prop.clips?.length ? `prop (${prop.clips.length} clips)` : 'prop',
        filterKind: 'prop',
        item: { kind: 'prop', entry: prop },
        previewSource: prop,
      })
    }
  }
  return rows
}

function GalleryThumb({ source }: { source: CatalogRow['previewSource'] }) {
  const ref = useMemo(() => (source ? previewRef(source) : null), [source])
  const url = useAssetUrl(ref)
  const [failed, setFailed] = useState(false)
  if (!url || failed) {
    return <span className="gallery-card-thumb gallery-card-thumb-empty">3D</span>
  }
  return <img className="gallery-card-thumb" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
}

const FILTER_OPTIONS: readonly { id: FilterKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'preset', label: 'Presets' },
  ...AVATAR_SLOTS.map((slot) => ({ id: slot as FilterKind, label: slot[0]!.toUpperCase() + slot.slice(1) })),
  { id: 'held', label: 'Held' },
  { id: 'prop', label: 'Props' },
]

function itemDetails(
  row: CatalogRow,
  catalogByPack: ReadonlyMap<PolyPackKey, PackCatalog>,
): {
  leaf: string
  triangles: number | string
  license: string
  metaLines: string[]
  clips: readonly string[]
  defaultClip: string | null
} {
  const cat = catalogByPack.get(row.pack)!
  const license = cat.license === 'CC0-1.0' ? 'CC0-1.0' : 'RUN Supp. v1.0'
  if (row.item.kind === 'part') {
    const e: AvatarPartEntry = row.item.entry
    const isBody = e.slot === 'body'
    const clips = isBody ? (e.rigId === 'ual1' ? cat.clips : RIG_SPECS[e.rigId].clips) : []
    const rules = [e.rules.hidesHair ? 'hidesHair' : null, e.rules.hidesLegsUpper ? 'hidesLegsUpper' : null].filter(Boolean)
    return {
      leaf: leafFor(e.pack, e.leaf).id,
      triangles: e.triangles,
      license,
      metaLines: [
        `Slot: ${e.slot}`,
        `Rig: ${e.rigId}`,
        `Node: ${e.nodeName}`,
        ...(rules.length > 0 ? [`Rules: ${rules.join(', ')}`] : []),
      ],
      clips,
      defaultClip: isBody ? (e.rigId === 'ual1' ? 'Idle_Loop' : 'Idle') : null,
    }
  }
  if (row.item.kind === 'held') {
    const e: HeldItemEntry = row.item.entry
    return {
      leaf: leafFor(e.pack, e.leaf).id,
      triangles: e.triangles,
      license,
      metaLines: [`Socket: ${e.hand}`, `Node: ${e.nodeName}`],
      clips: [],
      defaultClip: null,
    }
  }
  if (row.item.kind === 'prop') {
    const e: WorldPropEntry = row.item.entry
    const size = e.bounds.size.map((n) => `${n.toFixed(2)}m`).join(' × ')
    const clips = e.clips ?? []
    return {
      leaf: leafFor(e.pack, e.leaf).id,
      triangles: e.triangles,
      license,
      metaLines: [
        `Size: ${size}`,
        `Node: ${e.nodeName}`,
        `Animation: ${clips.length > 0 ? `Animated (${clips.length} clips)` : 'Static'}`,
      ],
      clips,
      defaultClip: clips[0] ?? null,
    }
  }
  const p: CharacterPreset = row.item.entry
  const clips = p.rigId === 'ual1' ? cat.clips : RIG_SPECS[p.rigId].clips
  const equipped = [p.head, p.hair, p.torso, p.legs, p.headwear, p.back, p.heldRight, p.heldLeft].filter(Boolean)
  return {
    leaf: leafFor(p.pack, 'characters').id,
    triangles: 'Composed',
    license,
    metaLines: [`Rig: ${p.rigId}`, `Body: ${p.body}`, `Slots: ${equipped.length} equipped`],
    clips,
    defaultClip: p.clip,
  }
}

export function GalleryTab({
  catalogs,
  index,
  onInspectInLab,
}: {
  catalogs: PackCatalog[]
  index: PolyPartIndex
  onInspectInLab?: (presetId: string) => void
}) {
  const [pack, setPack] = useState<'all' | PolyPackKey>('all')
  const [kind, setKind] = useState<FilterKind>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE_SIZE)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [clipOverride, setClipOverride] = useState<string | null>(null)
  const [holdPose, setHoldPose] = useState(false)
  const [resetSeq, setResetSeq] = useState(0)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const catalogByPack = useMemo(() => new Map(catalogs.map((c) => [c.pack, c])), [catalogs])
  const allRows = useMemo(() => buildRows(catalogs, index), [catalogs, index])
  const presets = useMemo(() => catalogs.flatMap((c) => c.presets), [catalogs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allRows.filter((r) => {
      if (pack !== 'all' && r.pack !== pack) return false
      if (kind !== 'all' && r.filterKind !== kind) return false
      if (q && !r.label.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q) && !r.kindLabel.toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [allRows, pack, kind, query])

  const selected = useMemo(() => filtered.find((r) => r.key === selectedKey) ?? filtered[0] ?? null, [filtered, selectedKey])
  const details = useMemo(() => (selected ? itemDetails(selected, catalogByPack) : null), [selected, catalogByPack])

  const selectRow = (key: string) => {
    setSelectedKey(key)
    setClipOverride(null)
    if (window.matchMedia('(max-width: 920px)').matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }
  }

  return (
    <div className="gallery-layout">
      <section className="gallery-browser">
        <div className="gallery-filters">
          <div className="preset-pills" role="group" aria-label="Pack filter">
            <button
              type="button"
              className={`pill-btn ${pack === 'all' ? 'active' : ''}`}
              onClick={() => {
                setPack('all')
                setShown(PAGE_SIZE)
              }}
            >
              All Packs ({allRows.length})
            </button>
            {POLY_PACK_KEYS.map((k) => {
              const c = catalogByPack.get(k)
              if (!c) return null
              const count = allRows.filter((r) => r.pack === k).length
              return (
                <button
                  key={k}
                  type="button"
                  className={`pill-btn ${pack === k ? 'active' : ''}`}
                  onClick={() => {
                    setPack(k)
                    setShown(PAGE_SIZE)
                  }}
                >
                  {c.label} ({count})
                </button>
              )
            })}
          </div>

          <div className="preset-pills" role="group" aria-label="Slot and type filter">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`pill-btn ${kind === opt.id ? 'active' : ''}`}
                onClick={() => {
                  setKind(opt.id)
                  setShown(PAGE_SIZE)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="gallery-toolbar">
            <input
              type="text"
              aria-label="Search assets"
              placeholder="Search assets by name, id, or slot…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE_SIZE)
              }}
            />
            <span className="gallery-count">{filtered.length} assets</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="gallery-empty">No matching Chisel assets. Clear your search or switch pack/slot filters.</div>
        ) : (
          <div className="gallery-grid">
            {filtered.slice(0, shown).map((row) => (
              <button
                key={row.key}
                type="button"
                data-asset-key={row.key}
                className={`gallery-card ${selected?.key === row.key ? 'selected' : ''}`}
                aria-pressed={selected?.key === row.key}
                onClick={() => selectRow(row.key)}
              >
                <GalleryThumb source={row.previewSource} />
                <div className="gallery-card-meta">
                  <span className="gallery-card-name">{row.label}</span>
                  <span className="gallery-card-sub">
                    <span>{row.pack}</span>
                    <span>·</span>
                    <span>{row.kindLabel}</span>
                  </span>
                </div>
              </button>
            ))}
            {shown < filtered.length && (
              <button type="button" className="btn-secondary gallery-more" onClick={() => setShown((n) => n + PAGE_SIZE)}>
                Show more ({filtered.length - shown} remaining)
              </button>
            )}
          </div>
        )}
      </section>

      <aside className="gallery-inspector" ref={detailRef}>
        {selected && details ? (
          <>
            <div className="gallery-inspector-head">
              <div>
                <h2>{selected.label}</h2>
                <code className="gallery-id">{selected.id}</code>
              </div>
              <span className="brand-badge">{catalogByPack.get(selected.pack)?.label ?? selected.pack}</span>
            </div>

            <div className="gallery-canvas-wrap">
              <Canvas dpr={[1, BUDGETS.mobilePolicy.maxDpr]} gl={STUDIO_GL} camera={{ fov: 38, near: 0.02, far: 100 }}>
                <StudioLights reach={1.6} />
                <Suspense fallback={null}>
                  <GalleryStageContent
                    key={selected.key}
                    item={selected.item}
                    index={index}
                    presets={presets}
                    clipOverride={clipOverride}
                    holdPhase={holdPose ? 0.25 : null}
                    controlsRef={controlsRef}
                    resetSeq={resetSeq}
                  />
                </Suspense>
                <OrbitControls ref={controlsRef} makeDefault enablePan={false} />
              </Canvas>

              <div className="gallery-canvas-actions">
                <button type="button" className="pill-btn" onClick={() => setResetSeq((n) => n + 1)}>
                  Reset View
                </button>
                {selected.item.kind === 'preset' && onInspectInLab && (
                  <button
                    type="button"
                    className="pill-btn active"
                    onClick={() => onInspectInLab(selected.id)}
                  >
                    Open in Lab
                  </button>
                )}
              </div>
            </div>

            {details.clips.length > 0 && (
              <div className="section-card">
                <div className="field-row">
                  <label htmlFor="gallery-clip-select">Clip</label>
                  <select
                    id="gallery-clip-select"
                    value={clipOverride ?? details.defaultClip ?? details.clips[0] ?? ''}
                    onChange={(e) => setClipOverride(e.target.value)}
                  >
                    {details.clips.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-row">
                  <label htmlFor="gallery-hold-pose">Pose</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)' }}>
                    <input
                      id="gallery-hold-pose"
                      type="checkbox"
                      checked={holdPose}
                      onChange={(e) => setHoldPose(e.target.checked)}
                    />
                    Freeze pose (0.25 phase)
                  </label>
                </div>
              </div>
            )}

            <div className="section-card">
              <h3 className="section-title">Asset Contract</h3>
              <div className="gallery-specs">
                <div>
                  <span>Leaf ID</span>
                  <code>{details.leaf}</code>
                </div>
                <div>
                  <span>Triangles</span>
                  <strong>{details.triangles}</strong>
                </div>
                <div>
                  <span>License</span>
                  <strong>{details.license}</strong>
                </div>
                {details.metaLines.map((line) => {
                  const [k, ...rest] = line.split(': ')
                  return (
                    <div key={line}>
                      <span>{k}</span>
                      <strong>{rest.join(': ')}</strong>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="gallery-empty">Select an asset to inspect it in 3D.</div>
        )}
      </aside>
    </div>
  )
}
