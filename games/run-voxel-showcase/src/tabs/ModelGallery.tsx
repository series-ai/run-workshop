/**
 * Models: a thumbnail grid over every pack with pack, category and text
 * filters, and a stage that plays any clip of the selected model.
 */
import { OrbitControls } from '@react-three/drei'
import { Suspense, useMemo, useRef, useState } from 'react'
import type { PackCatalog, VoxelModelEntry } from '@rvx/contracts/catalog'
import { UNITS_PER_VOXEL } from '@rvx/contracts/categories'
import { isCollision, previewRef } from '../catalog'
import { PackBadge, PackFilter, type PackChoice } from '../PackFilter'
import { CameraCommands, displayBounds, FitCamera, getModelPreviewYaw, PackCanvas, PackModel, useCommandBus, ViewerErrorBoundary, ViewerFrame } from '../pack3d'
import { useAssetUrl } from '../useAssetUrl'

const PAGE = 60
const ROOT = 'gallery-model'

function Thumb({ entry }: { entry: VoxelModelEntry }) {
  const url = useAssetUrl(previewRef(entry))
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <span className="model-card-thumb model-card-thumb-empty" />
  return <img className="model-card-thumb" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
}

function Viewer({ entry }: { entry: VoxelModelEntry }) {
  const [clip, setClip] = useState<string | null>(entry.clips.includes('idle') ? 'idle' : (entry.clips[0] ?? null))
  const [pfx, setPfx] = useState(entry.pfx.length > 0)
  const bus = useCommandBus()
  const [resets, setResets] = useState(0)
  const size = displayBounds(entry).size.map((v) => Math.round(v / UNITS_PER_VOXEL[entry.space]))
  return (
    <div className="model-detail">
      <div className="model-viewer">
        <ViewerFrame bus={bus} label={`3D view of ${entry.name}`} onReset={() => setResets((n) => n + 1)}>
        <ViewerErrorBoundary resetKey={entry.id}>
          <PackCanvas>
            <Suspense fallback={null}>
              <PackModel key={entry.id} entry={entry} name={ROOT} anchor="native" rotationY={getModelPreviewYaw(entry.category)} clip={clip} pfx={pfx} />
            </Suspense>
            <OrbitControls makeDefault />
            <CameraCommands bus={bus} />
            <FitCamera rootName={ROOT} fitKey={`${entry.id}:${resets}`} targetMode="center" margin={1.5} />
          </PackCanvas>
        </ViewerErrorBoundary>
        </ViewerFrame>
        {(entry.clips.length > 0 || entry.pfx.length > 0) && (
          <div className="viewer-controls">
            {entry.pfx.length > 0 && (
              <button type="button" className={pfx ? 'toggle active' : 'toggle'} aria-pressed={pfx} onClick={() => setPfx((v) => !v)}>
                PFX: {entry.pfx.map((p) => p.effectId).join(', ')}
              </button>
            )}
            {entry.clips.length > 0 && <label className="viewer-control">
              <span>Clip</span>
              <select aria-label="Clip" value={clip ?? ''} onChange={(e) => setClip(e.target.value || null)}>
                <option value="">Rest pose</option>
                {entry.clips.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>}
          </div>
        )}
      </div>
      <div className="viewer-readout" data-testid="bounds-readout">
        {size.join(' × ')} voxels · {entry.category} · {LICENSE_LABELS[entry.license]}
      </div>
    </div>
  )
}

/** Readable names for the catalog's SPDX ids. */
const LICENSE_LABELS: Record<VoxelModelEntry['license'], string> = {
  'LicenseRef-RUN-Repository-Supplemental-1.0': 'RUN License',
  MIT: 'MIT',
}

export function ModelGallery({ catalogs }: { catalogs: PackCatalog[] }) {
  const [pack, setPack] = useState<PackChoice>('all')
  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLHeadingElement>(null)
  const select = (id: string) => {
    setSelectedId(id)
    // On phones the viewer sits above the grid: bring it into view and move focus to it.
    if (window.matchMedia('(max-width: 900px)').matches) {
      requestAnimationFrame(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        detailRef.current?.focus({ preventScroll: true })
      })
    }
  }

  const labels = useMemo(() => new Map(catalogs.map((c) => [c.pack, c])), [catalogs])
  const inPack = useMemo(
    () => catalogs.filter((c) => pack === 'all' || c.pack === pack).flatMap((c) => c.models.filter((m) => !isCollision(m))),
    [catalogs, pack],
  )
  const categories = useMemo(() => [...new Set(inPack.map((m) => m.category))].sort(), [inPack])
  const models = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inPack.filter((m) => (category === 'all' || m.category === category) && (!q || m.name.toLowerCase().includes(q) || m.id.includes(q)))
  }, [inPack, category, query])
  const selected = models.find((m) => m.id === selectedId) ?? models[0] ?? null

  return (
    <div className="gallery with-detail">
      <section className="gallery-list">
        <PackFilter
          catalogs={catalogs}
          value={pack}
          onChange={(next) => {
            setPack(next)
            setCategory('all')
            setShown(PAGE)
          }}
        />
        <div className="chip-row category-filter" role="group" aria-label="Category filter">
          {['all', ...categories].map((c) => (
            <button key={c} type="button" className={c === category ? 'chip active' : 'chip'} aria-pressed={c === category} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="gallery-toolbar">
          <input type="search" aria-label="Search models" placeholder="Search models" value={query} onChange={(e) => setQuery(e.target.value)} />
          <span className="count">{models.length} models</span>
        </div>
        {models.length === 0 ? (
          <div className="empty">No models match. Clear the search or pick another pack.</div>
        ) : (
          <div className="model-grid">
            {models.slice(0, shown).map((m) => (
              <button key={m.id} type="button" data-model-id={m.id} className={m.id === selected?.id ? 'model-card selected' : 'model-card'} aria-pressed={m.id === selected?.id} onClick={() => select(m.id)}>
                <Thumb entry={m} />
                <span className="model-card-name">{m.name}</span>
                <PackBadge catalog={labels.get(m.pack)!} />
              </button>
            ))}
            {shown < models.length && (
              <button type="button" className="toggle gallery-more" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({models.length - shown})
              </button>
            )}
          </div>
        )}
      </section>
      <aside className="gallery-detail">
        {selected ? (
          <>
            <div className="gallery-detail-header">
              <h2 ref={detailRef} tabIndex={-1}>{selected.name}</h2>
              <PackBadge catalog={labels.get(selected.pack)!} />
            </div>
            <Viewer key={selected.id} entry={selected} />
          </>
        ) : (
          <div className="empty">Nothing selected</div>
        )}
      </aside>
    </div>
  )
}
