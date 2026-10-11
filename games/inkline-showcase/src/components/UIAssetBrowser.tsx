import { useState, useMemo, type FC, type ChangeEvent } from 'react'
import type { PackManifest, ModelEntry, ModelKind } from '../types'
import {
  IconSearch,
  IconDownload,
  IconChevronLeft,
  IconChevronRight,
  IconReset,
} from './UIIcons'

export interface AssetBrowserProps {
  manifest: PackManifest | null
  selectedModelId: string
  onSelectModel: (id: string) => void
  isLoading: boolean
  error: string | null
  onRetry: () => void
}

type SortOption = 'name-asc' | 'name-desc' | 'triangles-asc' | 'triangles-desc' | 'category-asc'

const ITEMS_PER_PAGE = 18

export const UIAssetBrowser: FC<AssetBrowserProps> = ({
  manifest,
  selectedModelId,
  onSelectModel,
  isLoading,
  error,
  onRetry,
}) => {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | ModelKind>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('name-asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})

  // Distinct categories
  const categories = useMemo(() => {
    if (!manifest?.models) return []
    const cats = new Set<string>()
    manifest.models.forEach((m) => {
      if (m.category) cats.add(m.category)
    })
    return Array.from(cats).sort()
  }, [manifest])

  // Filtered & sorted models
  const filteredModels = useMemo(() => {
    if (!manifest?.models) return []

    const q = search.trim().toLowerCase()
    return manifest.models
      .filter((m) => {
        if (kindFilter !== 'all' && m.kind !== kindFilter) return false
        if (categoryFilter !== 'all' && m.category !== categoryFilter) return false
        if (q) {
          const matchLabel = m.label.toLowerCase().includes(q)
          const matchId = m.id.toLowerCase().includes(q)
          const matchDesc = m.description.toLowerCase().includes(q)
          const matchTags = m.tags.some((t) => t.toLowerCase().includes(q))
          if (!matchLabel && !matchId && !matchDesc && !matchTags) return false
        }
        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name-asc':
            return a.label.localeCompare(b.label)
          case 'name-desc':
            return b.label.localeCompare(a.label)
          case 'triangles-asc':
            return a.triangles - b.triangles
          case 'triangles-desc':
            return b.triangles - a.triangles
          case 'category-asc':
            return a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
          default:
            return 0
        }
      })
  }, [manifest, search, kindFilter, categoryFilter, sortBy])

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredModels.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedModels = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE
    return filteredModels.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredModels, safePage])

  // Currently selected model
  const selectedModel: ModelEntry | undefined = useMemo(() => {
    if (!manifest?.models) return undefined
    return manifest.models.find((m) => m.id === selectedModelId) ?? manifest.models[0]
  }, [manifest, selectedModelId])

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }))
  }

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setCurrentPage(1)
  }

  const handleKindChange = (kind: 'all' | ModelKind) => {
    setKindFilter(kind)
    setCurrentPage(1)
  }

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat)
    setCurrentPage(1)
  }

  const getGlbUrl = (file: string) => {
    return `./${file}`
  }

  if (isLoading) {
    return (
      <div className="ink-catalog-panel ink-loading-state" role="status">
        <div className="ink-spinner" aria-hidden="true" />
        <h2 className="ink-state-title">Loading Asset Catalog</h2>
        <p className="ink-state-desc">Fetching manifest metadata from ./assets/manifest.json...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ink-catalog-panel ink-error-state" role="alert">
        <div className="ink-error-badge">ASSET BOUNDARY ERROR</div>
        <h2 className="ink-state-title">Catalog Unavailable</h2>
        <p className="ink-state-desc">{error}</p>
        <button type="button" className="ink-btn ink-btn-primary" onClick={onRetry}>
          <IconReset size={16} /> Retry Fetching Manifest
        </button>
      </div>
    )
  }

  return (
    <div className="ink-catalog-panel">
      {/* Search and Filter Bar */}
      <div className="ink-catalog-header">
        <div className="ink-search-bar">
          <IconSearch size={16} className="ink-search-icon" aria-hidden="true" />
          <input
            type="search"
            className="ink-search-input"
            placeholder="Search models, tags, descriptions..."
            value={search}
            onChange={handleSearchChange}
            aria-label="Search models"
          />
          {search && (
            <button
              type="button"
              className="ink-search-clear"
              onClick={() => {
                setSearch('')
                setCurrentPage(1)
              }}
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Kind Filters */}
        <div className="ink-filter-row">
          <div className="ink-segmented-control" role="group" aria-label="Filter by kind">
            <button
              type="button"
              className={`ink-segmented-btn ${kindFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleKindChange('all')}
              aria-pressed={kindFilter === 'all'}
            >
              All ({manifest?.models.length ?? 0})
            </button>
            <button
              type="button"
              className={`ink-segmented-btn ${kindFilter === 'character' ? 'active' : ''}`}
              onClick={() => handleKindChange('character')}
              aria-pressed={kindFilter === 'character'}
            >
              Characters
            </button>
            <button
              type="button"
              className={`ink-segmented-btn ${kindFilter === 'prop' ? 'active' : ''}`}
              onClick={() => handleKindChange('prop')}
              aria-pressed={kindFilter === 'prop'}
            >
              Props & Kit
            </button>
          </div>

          {/* Sort selector */}
          <div className="ink-sort-wrap">
            <label htmlFor="ink-sort-select" className="ink-field-label">
              Sort:
            </label>
            <select
              id="ink-sort-select"
              className="ink-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="triangles-asc">Polycount (Low → High)</option>
              <option value="triangles-desc">Polycount (High → Low)</option>
              <option value="category-asc">Category</option>
            </select>
          </div>
        </div>

        {/* Category Chips */}
        {categories.length > 0 && (
          <div className="ink-category-chips" role="group" aria-label="Filter by category">
            <button
              type="button"
              className={`ink-chip ${categoryFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleCategoryChange('all')}
              aria-pressed={categoryFilter === 'all'}
            >
              ALL CATEGORIES
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`ink-chip ${categoryFilter === cat ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat)}
                aria-pressed={categoryFilter === cat}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model Grid */}
      <div className="ink-catalog-body">
        {filteredModels.length === 0 ? (
          <div className="ink-empty-state">
            <p className="ink-empty-title">No matching models found</p>
            <p className="ink-empty-desc">
              Try adjusting your search criteria or resetting category filters.
            </p>
            <button
              type="button"
              className="ink-btn ink-btn-secondary"
              onClick={() => {
                setSearch('')
                setKindFilter('all')
                setCategoryFilter('all')
                setCurrentPage(1)
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="ink-grid" role="listbox" aria-label="3D Model Catalog">
            {pagedModels.map((entry) => {
              const isSelected = entry.id === selectedModelId
              const hasImgError = imageErrors[entry.id] || !entry.thumbnail

              return (
                <button
                  key={entry.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ink-grid-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelectModel(entry.id)}
                  title={`${entry.label} — ${entry.category}`}
                >
                  <div className="ink-card-thumb-wrap">
                    {!hasImgError ? (
                      <img
                        src={entry.thumbnail}
                        alt={entry.label}
                        className="ink-card-thumb"
                        loading="lazy"
                        onError={() => handleImageError(entry.id)}
                      />
                    ) : (
                      <div className="ink-card-thumb-fallback">
                        <span className="ink-fallback-code">{entry.id}</span>
                        <span className="ink-fallback-dim">
                          {entry.dimensions[0].toFixed(1)}×{entry.dimensions[1].toFixed(1)}×
                          {entry.dimensions[2].toFixed(1)}m
                        </span>
                      </div>
                    )}
                    <span className="ink-card-kind-badge">{entry.kind}</span>
                  </div>

                  <div className="ink-card-info">
                    <span className="ink-card-label">{entry.label}</span>
                    <div className="ink-card-meta">
                      <span className="ink-card-category">{entry.category}</span>
                      <span className="ink-card-tris">{entry.triangles.toLocaleString()} ▲</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="ink-pagination-bar" aria-label="Catalog Pagination">
          <span className="ink-pagination-info">
            Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safePage * ITEMS_PER_PAGE, filteredModels.length)} of {filteredModels.length}{' '}
            models
          </span>

          <div className="ink-pagination-actions">
            <button
              type="button"
              className="ink-btn-icon"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous Page"
            >
              <IconChevronLeft size={16} />
            </button>

            <span className="ink-page-indicator">
              Page {safePage} / {totalPages}
            </span>

            <button
              type="button"
              className="ink-btn-icon"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next Page"
            >
              <IconChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Selected Model Detail Panel */}
      {selectedModel && (
        <div className="ink-model-detail-card" aria-label="Selected Model Inspector">
          <div className="ink-detail-header">
            <div className="ink-detail-title-group">
              <span className="ink-detail-id">{selectedModel.id}</span>
              <h3 className="ink-detail-label">{selectedModel.label}</h3>
            </div>
            <a
              href={getGlbUrl(selectedModel.file)}
              download={`${selectedModel.id}.glb`}
              className="ink-btn ink-btn-primary ink-btn-sm"
              title="Download original glTF/GLB binary file"
            >
              <IconDownload size={14} /> Download GLB
            </a>
          </div>

          <p className="ink-detail-desc">{selectedModel.description || 'No description provided.'}</p>

          <div className="ink-metrics-table">
            <div className="ink-metric-cell">
              <span className="ink-cell-key">TRIANGLES</span>
              <span className="ink-cell-val">{selectedModel.triangles.toLocaleString()}</span>
            </div>
            <div className="ink-metric-cell">
              <span className="ink-cell-key">VERTICES</span>
              <span className="ink-cell-val">{selectedModel.vertices.toLocaleString()}</span>
            </div>
            <div className="ink-metric-cell">
              <span className="ink-cell-key">MATERIALS</span>
              <span className="ink-cell-val">{selectedModel.materials}</span>
            </div>
            <div className="ink-metric-cell">
              <span className="ink-cell-key">BOUNDS (X/Y/Z)</span>
              <span className="ink-cell-val">
                {selectedModel.dimensions[0].toFixed(2)} × {selectedModel.dimensions[1].toFixed(2)} ×{' '}
                {selectedModel.dimensions[2].toFixed(2)}m
              </span>
            </div>
          </div>

          {selectedModel.tags && selectedModel.tags.length > 0 && (
            <div className="ink-tags-row">
              <span className="ink-tags-label">TAGS:</span>
              {selectedModel.tags.map((tag) => (
                <span key={tag} className="ink-tag-badge">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
