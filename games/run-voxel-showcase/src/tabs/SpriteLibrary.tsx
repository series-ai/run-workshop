/**
 * Sprites: each pack's icons and UI tiles, with dark / light / checker
 * backdrops for alpha art and nearest-neighbour zoom.
 */
import { useMemo, useState } from 'react'
import type { PackCatalog, SpriteEntry } from '@rvx/contracts/catalog'
import { spriteRef } from '../catalog'
import { PackBadge, PackFilter, type PackChoice } from '../PackFilter'
import { useAssetUrl } from '../useAssetUrl'

const PAGE = 120
type Backdrop = 'dark' | 'light' | 'checker'

function SpriteTile({ entry, catalog }: { entry: SpriteEntry; catalog: PackCatalog }) {
  const url = useAssetUrl(spriteRef(entry))
  return (
    <figure className="sprite-tile" data-sprite-id={entry.id}>
      <div className="sprite-canvas">{url && <img src={url} alt={entry.name} loading="lazy" style={{ maxWidth: '100%', maxHeight: 160 }} />}</div>
      <figcaption>
        <span className="sprite-name" title={entry.name}>{entry.name}</span>
        <PackBadge catalog={catalog} />
      </figcaption>
    </figure>
  )
}

export function SpriteLibrary({ catalogs }: { catalogs: PackCatalog[] }) {
  const [pack, setPack] = useState<PackChoice>('all')
  const [category, setCategory] = useState<'all' | SpriteEntry['category']>('all')
  const [backdrop, setBackdrop] = useState<Backdrop>('checker')
  const [shown, setShown] = useState(PAGE)
  const [tileSize, setTileSize] = useState(112)
  const byPack = useMemo(() => new Map(catalogs.map((c) => [c.pack, c])), [catalogs])
  const sprites = useMemo(
    () => catalogs.filter((c) => pack === 'all' || c.pack === pack).flatMap((c) => c.sprites).filter((s) => category === 'all' || s.category === category),
    [catalogs, pack, category],
  )
  return (
    <div className={`sprite-library backdrop-${backdrop}`}>
      <PackFilter catalogs={catalogs} value={pack} onChange={(p) => (setPack(p), setShown(PAGE))} />
      <div className="chip-row sprite-toolbar" role="group" aria-label="Sprite category">
        {(['all', 'icons', 'ui', 'branding'] as const).map((c) => (
          <button key={c} type="button" className={c === category ? 'chip active' : 'chip'} aria-pressed={c === category} onClick={() => (setCategory(c), setShown(PAGE))}>
            {c}
          </button>
        ))}
        <span className="count">{sprites.length} sprites</span>
        <label className="zoom-control">
          <span>Tile size</span>
          <input type="range" min={48} max={256} step={8} value={tileSize} onChange={(e) => setTileSize(Number(e.target.value))} />
        </label>
        {(['dark', 'light', 'checker'] as const).map((b) => (
          <button key={b} type="button" className={b === backdrop ? 'toggle active' : 'toggle'} aria-pressed={b === backdrop} onClick={() => setBackdrop(b)}>
            {b}
          </button>
        ))}
      </div>
      {sprites.length === 0 ? (
        <div className="empty">No sprites in this pack yet.</div>
      ) : (
        <div className="sprite-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}>
          {sprites.slice(0, shown).map((s) => (
            <SpriteTile key={`${s.pack}:${s.id}`} entry={s} catalog={byPack.get(s.pack)!} />
          ))}
        </div>
      )}
      {shown < sprites.length && (
        <button type="button" className="toggle gallery-more" onClick={() => setShown((n) => n + PAGE)}>
          Show more ({sprites.length - shown})
        </button>
      )}
    </div>
  )
}
