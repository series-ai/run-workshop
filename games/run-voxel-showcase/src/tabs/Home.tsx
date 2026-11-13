/**
 * Home: what is in each loaded pack, and a route into every tab.
 */
import type { PackCatalog, VoxelModelEntry } from '@rvx/contracts/catalog'
import { PACK_COLORS, previewRef } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'

/** One showpiece per pack: its first building, else its first animated prop. */
function showpiece(catalog: PackCatalog): VoxelModelEntry | undefined {
  return catalog.models.find((m) => m.category === 'buildings' && m.pack !== 'pirate') ??
    catalog.models.find((m) => m.category === 'ships') ??
    catalog.models.find((m) => m.category === 'animated-props')
}

function Showpiece({ entry }: { entry: VoxelModelEntry }) {
  const url = useAssetUrl(previewRef(entry))
  return url ? <img className="landing-showpiece" src={url} alt={entry.name} /> : <span className="landing-showpiece" />
}

export type TabId = 'home' | 'models' | 'scene' | 'avatar' | 'pfx' | 'sprites'

const ROUTES: { tab: TabId; title: string; body: string }[] = [
  { tab: 'models', title: 'Models', body: 'Every model of every pack, with clips and bound effects.' },
  { tab: 'scene', title: 'Scene', body: 'Mixed packs on one ground at their shared native scale.' },
  { tab: 'avatar', title: 'Avatar Lab', body: 'Dress one avatar from every pack; play any pack’s clip.' },
  { tab: 'pfx', title: 'PFX', body: 'The themed effects of each pack, on their own and on models.' },
  { tab: 'sprites', title: 'Sprites', body: 'Icons and UI tiles for each pack.' },
]

export function Home({ catalogs, onNavigate }: { catalogs: PackCatalog[]; onNavigate: (tab: TabId) => void }) {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker">RUN voxel packs</span>
          <h2>Four new voxel packs that snap into Pirate Nation</h2>
          <p>Same voxel scale, palette discipline and rig: props share one ground plane, parts from every pack fit one avatar, and every clip plays on every avatar.</p>
          <div className="landing-actions">
            <button type="button" className="primary-action" onClick={() => onNavigate('models')}>
              Explore models
            </button>
            <button type="button" className="toggle" onClick={() => onNavigate('avatar')}>
              Open the Avatar Lab
            </button>
          </div>
          <div className="landing-showpieces">
            {catalogs.map((c) => {
              const entry = showpiece(c)
              return entry ? <Showpiece key={c.pack} entry={entry} /> : null
            })}
          </div>
        </div>
        <div className="landing-stats">
          {catalogs.map((c) => (
            <div key={c.pack} className="landing-pack" style={{ borderColor: PACK_COLORS[c.pack] }}>
              <strong style={{ color: PACK_COLORS[c.pack] }}>{c.label}</strong>
              <span>{c.models.filter((m) => !m.id.endsWith('-collision')).length} models</span>
              <span>{c.avatar.parts.length} avatar parts · {c.avatar.clips.length} clips</span>
              <span>{c.sprites.length} sprites · {c.pfx.effects.length} bound effects</span>
            </div>
          ))}
        </div>
      </section>
      <section className="landing-explore">
        <div className="landing-route-grid">
          {ROUTES.map((route) => (
            <button key={route.tab} type="button" className="landing-route" onClick={() => onNavigate(route.tab)}>
              <strong>{route.title}</strong>
              <span>{route.body}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
