/**
 * Browsable grid over the pack's 355 visual models (collision GLBs surface as
 * a viewer toggle, not as cards) with search, category filters, and sort;
 * selecting a model opens the 3D viewer + provenance detail panel.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  buildCollisionIndex,
  formatBytes,
  gridFootprint,
  isCollisionModel,
  loadModels,
  runtimeAssetUrl,
  type PirateNationModelEntry,
} from '../catalog'
import { ModelViewer } from '../components/ModelViewer'
import { ViewerErrorBoundary } from '../components/ViewerErrorBoundary'

type SortKey = 'name' | 'size-desc' | 'size-asc' | 'footprint'

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'name', label: 'Name A–Z' },
  { id: 'size-desc', label: 'Largest first' },
  { id: 'size-asc', label: 'Smallest first' },
  { id: 'footprint', label: 'Footprint (largest)' },
]

function footprintArea(entry: PirateNationModelEntry): number {
  return entry.bounds.size[0] * entry.bounds.size[2]
}

function sortModels(models: PirateNationModelEntry[], sort: SortKey): PirateNationModelEntry[] {
  const sorted = [...models]
  switch (sort) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'size-desc':
      sorted.sort((a, b) => b.sizeBytes - a.sizeBytes)
      break
    case 'size-asc':
      sorted.sort((a, b) => a.sizeBytes - b.sizeBytes)
      break
    case 'footprint':
      sorted.sort((a, b) => footprintArea(b) - footprintArea(a))
      break
  }
  return sorted
}

export function filterModels(
  models: PirateNationModelEntry[],
  search: string,
  category: string | null,
): PirateNationModelEntry[] {
  const needle = search.trim().toLowerCase()
  return models.filter((entry) => {
    if (category && entry.category !== category) return false
    if (!needle) return true
    return (
      entry.name.toLowerCase().includes(needle) ||
      entry.id.toLowerCase().includes(needle) ||
      entry.category.includes(needle)
    )
  })
}

function formatDims(entry: PirateNationModelEntry): string {
  const [x, y, z] = entry.bounds.size
  return `${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)}`
}

function ModelDetail({
  entry,
  collisionEntry,
}: {
  entry: PirateNationModelEntry
  collisionEntry: PirateNationModelEntry | null
}) {
  const footprint = gridFootprint(entry.id)
  return (
    <div className="model-detail">
      <ViewerErrorBoundary>
        <ModelViewer entry={entry} collisionEntry={collisionEntry} />
      </ViewerErrorBoundary>

      <dl className="metadata">
        <div>
          <dt>Category</dt>
          <dd>{entry.category}</dd>
        </div>
        <div>
          <dt>Dimensions</dt>
          <dd>{formatDims(entry)} units</dd>
        </div>
        {footprint && (
          <div>
            <dt>Grid footprint</dt>
            <dd>{footprint}</dd>
          </div>
        )}
        <div>
          <dt>File size</dt>
          <dd>{formatBytes(entry.sizeBytes)}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd className="mono">{entry.sourceRelativePath}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>
            {entry.license} — {entry.copyright}
          </dd>
        </div>
      </dl>

      <a className="download-link" href={runtimeAssetUrl(entry)} download={entry.filename}>
        Download {entry.filename}
      </a>
    </div>
  )
}

export function ModelGallery() {
  const [models, setModels] = useState<PirateNationModelEntry[] | null>(null)
  const [collisionIndex, setCollisionIndex] = useState<Map<string, PirateNationModelEntry>>(
    new Map(),
  )
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('name')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    loadModels().then((all) => {
      // Collision GLBs are not browsable entries; they surface as a viewer
      // toggle on their visual counterpart (see ModelViewer).
      setCollisionIndex(buildCollisionIndex(all))
      setModels(all.filter((entry) => !isCollisionModel(entry)))
    }, (err: Error) => setError(err.message))
  }, [])

  const categories = useMemo(() => {
    if (!models) return []
    const counts = new Map<string, number>()
    for (const entry of models) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [models])

  const visible = useMemo(() => {
    if (!models) return []
    return sortModels(filterModels(models, search, category), sort)
  }, [models, search, category, sort])

  const selected = models?.find((entry) => entry.id === selectedId) ?? null

  if (error) return <div className="load-error">Could not load the model catalog: {error}</div>
  if (!models) return <div className="loading">Loading model catalog…</div>

  return (
    <div className={selected ? 'gallery with-detail' : 'gallery'}>
      <section className="gallery-list">
        <div className="gallery-toolbar">
          <input
            type="search"
            placeholder={`Search ${models.length} models…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {SORTS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="chip-row">
          <button
            type="button"
            className={category === null ? 'chip active' : 'chip'}
            onClick={() => setCategory(null)}
          >
            All ({models.length})
          </button>
          {categories.map(([name, count]) => (
            <button
              key={name}
              type="button"
              className={category === name ? 'chip active' : 'chip'}
              onClick={() => setCategory(category === name ? null : name)}
            >
              {name} ({count})
            </button>
          ))}
        </div>

        <div className="model-grid">
          {visible.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === selectedId ? 'model-card selected' : 'model-card'}
              onClick={() => setSelectedId(entry.id === selectedId ? null : entry.id)}
            >
              <span className="model-card-name">{entry.name}</span>
              <span className="model-card-meta">
                {entry.category} · {formatDims(entry)}
                {gridFootprint(entry.id) ? ` · ${gridFootprint(entry.id)}` : ''} ·{' '}
                {formatBytes(entry.sizeBytes)}
              </span>
            </button>
          ))}
          {visible.length === 0 && <p className="empty">No models match this filter.</p>}
        </div>
      </section>

      {selected && (
        <aside className="gallery-detail">
          <div className="gallery-detail-header">
            <h2>{selected.name}</h2>
            <button type="button" className="chip" onClick={() => setSelectedId(null)}>
              Close
            </button>
          </div>
          <ModelDetail entry={selected} collisionEntry={collisionIndex.get(selected.id) ?? null} />
        </aside>
      )}
    </div>
  )
}
