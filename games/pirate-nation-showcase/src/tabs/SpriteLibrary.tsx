/**
 * Browses the pack's 513 sprites: game icons, UI frames/buttons/portraits,
 * and branding art. Sprites have alpha, so a backdrop toggle (dark / light /
 * checkerboard) keeps light art readable. Images lazy-load.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  formatBytes,
  loadSprites,
  spriteAssetReference,
  type PirateNationSpriteEntry,
} from '../catalog'
import { useAssetUrl } from '../useAssetUrl'

type Backdrop = 'dark' | 'light' | 'checker'

const BACKDROPS: { id: Backdrop; label: string }[] = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'checker', label: 'Checker' },
]

const CATEGORY_LABELS: Record<string, string> = {
  icons: 'Game Icons',
  ui: 'UI Sprites',
  branding: 'Branding',
}

function groupBySubCategory(
  sprites: PirateNationSpriteEntry[],
): Map<string, PirateNationSpriteEntry[]> {
  const groups = new Map<string, PirateNationSpriteEntry[]>()
  for (const sprite of sprites) {
    const key = sprite.subCategory || 'other'
    const list = groups.get(key)
    if (list) list.push(sprite)
    else groups.set(key, [sprite])
  }
  return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length))
}

function SpriteImage({
  sprite,
  tileSize,
}: {
  sprite: PirateNationSpriteEntry
  tileSize: number
}) {
  const src = useAssetUrl(spriteAssetReference(sprite))
  if (!src) return null
  return (
    <img
      src={src}
      alt={sprite.name}
      loading="lazy"
      style={{ maxWidth: tileSize - 24, maxHeight: tileSize - 24 }}
    />
  )
}

export function SpriteLibrary() {
  const [sprites, setSprites] = useState<PirateNationSpriteEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [backdrop, setBackdrop] = useState<Backdrop>('dark')
  const [tileSize, setTileSize] = useState(96)

  useEffect(() => {
    loadSprites().then(setSprites, (err: Error) => setError(err.message))
  }, [])

  const visible = useMemo(() => {
    if (!sprites) return []
    const needle = search.trim().toLowerCase()
    return sprites.filter((sprite) => {
      if (category && sprite.category !== category) return false
      if (!needle) return true
      return (
        sprite.name.toLowerCase().includes(needle) ||
        sprite.id.toLowerCase().includes(needle) ||
        sprite.subCategory.toLowerCase().includes(needle)
      )
    })
  }, [sprites, search, category])

  const categories = useMemo(() => {
    if (!sprites) return []
    const counts = new Map<string, number>()
    for (const sprite of sprites) counts.set(sprite.category, (counts.get(sprite.category) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [sprites])

  const grouped = useMemo(() => groupBySubCategory(visible), [visible])

  if (error) return <div className="load-error">Could not load the sprite catalog: {error}</div>
  if (!sprites) return <div className="loading">Loading sprite catalog…</div>

  return (
    <section className="sprite-library">
      <div className="gallery-toolbar">
        <input
          type="search"
          placeholder={`Search ${sprites.length} sprites…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="zoom-control">
          <span>Tile size</span>
          <input
            type="range"
            min={48}
            max={192}
            step={8}
            value={tileSize}
            onChange={(event) => setTileSize(Number(event.target.value))}
          />
        </label>
        <div className="chip-row">
          {BACKDROPS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={backdrop === option.id ? 'chip active' : 'chip'}
              onClick={() => setBackdrop(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={category === null ? 'chip active' : 'chip'}
          onClick={() => setCategory(null)}
        >
          All ({sprites.length})
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            type="button"
            className={category === name ? 'chip active' : 'chip'}
            onClick={() => setCategory(category === name ? null : name)}
          >
            {CATEGORY_LABELS[name] ?? name} ({count})
          </button>
        ))}
      </div>

      {[...grouped.entries()].map(([subCategory, items]) => (
        <section key={subCategory} className="sprite-section">
          <h3>
            {subCategory} <span className="count">{items.length}</span>
          </h3>
          <div
            className={`sprite-grid backdrop-${backdrop}`}
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
          >
            {items.map((sprite) => (
              <figure key={sprite.id} className="sprite-tile" title={sprite.sourceRelativePath}>
                <div className="sprite-canvas">
                  <SpriteImage sprite={sprite} tileSize={tileSize} />
                </div>
                <figcaption>
                  <span className="sprite-name">{sprite.name}</span>
                  <span className="sprite-meta">{formatBytes(sprite.sizeBytes)}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
      {visible.length === 0 && <p className="empty">No sprites match this filter.</p>}
    </section>
  )
}
