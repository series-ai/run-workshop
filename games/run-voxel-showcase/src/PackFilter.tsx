import type { PackCatalog } from '@rvx/contracts/catalog'
import type { PackKey } from '@rvx/contracts/packs'
import { PACK_COLORS } from './catalog'

export type PackChoice = PackKey | 'all'

/** Pack chips; packs that are not staged in this build do not appear. */
export function PackFilter({ catalogs, value, onChange }: { catalogs: readonly PackCatalog[]; value: PackChoice; onChange: (next: PackChoice) => void }) {
  return (
    <div className="chip-row pack-filter" role="group" aria-label="Pack filter">
      <button type="button" className={value === 'all' ? 'chip active' : 'chip'} aria-pressed={value === 'all'} onClick={() => onChange('all')}>
        All
      </button>
      {catalogs.map((catalog) => (
        <button key={catalog.pack} type="button" className={value === catalog.pack ? 'chip active' : 'chip'} aria-pressed={value === catalog.pack} onClick={() => onChange(catalog.pack)}>
          <span className="pack-dot" style={{ background: PACK_COLORS[catalog.pack] }} />
          {catalog.label}
        </button>
      ))}
    </div>
  )
}

export function PackBadge({ catalog }: { catalog: Pick<PackCatalog, 'pack' | 'label'> }) {
  return (
    <span className="pack-badge" style={{ background: PACK_COLORS[catalog.pack] }}>
      {catalog.label}
    </span>
  )
}
