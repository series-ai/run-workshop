/**
 * App shell: loads every staged pack catalog once, then routes between the
 * Home, Models, Scene, Avatar Lab, PFX and Sprites tabs.
 */
import { useEffect, useState } from 'react'
import type { PackCatalog } from '@rvx/contracts/catalog'
import { loadCatalogs } from './catalog'
import { AvatarLab } from './tabs/AvatarLab'
import { Home, type TabId } from './tabs/Home'
import { ModelGallery } from './tabs/ModelGallery'
import { PfxStage } from './tabs/PfxStage'
import { SceneStage } from './tabs/SceneStage'
import { SpriteLibrary } from './tabs/SpriteLibrary'

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'models', label: 'Models', Component: ModelGallery },
  { id: 'scene', label: 'Scene', Component: SceneStage },
  { id: 'avatar', label: 'Avatar Lab', Component: AvatarLab },
  { id: 'pfx', label: 'PFX', Component: PfxStage },
  { id: 'sprites', label: 'Sprites', Component: SpriteLibrary },
] as const satisfies readonly { id: TabId; label: string; Component?: unknown }[]

export function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [catalogs, setCatalogs] = useState<PackCatalog[] | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    loadCatalogs().then(setCatalogs, (cause: unknown) => setError(cause as Error))
  }, [])

  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  return (
    <div className="app">
      <header className="app-header">
        <h1>RUN Voxel Packs</h1>
        <nav className="tab-bar" aria-label="Sections">
          {TABS.map((entry) => (
            <button key={entry.id} type="button" className={entry.id === tab ? 'tab active' : 'tab'} aria-current={entry.id === tab ? 'page' : undefined} onClick={() => setTab(entry.id)}>
              {entry.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {error ? (
          <div className="load-error" role="alert">
            {error.name}: {error.message}
          </div>
        ) : catalogs ? (
          'Component' in active ? <active.Component catalogs={catalogs} /> : <Home catalogs={catalogs} onNavigate={setTab} />
        ) : (
          <div className="loading">Loading pack catalogs…</div>
        )}
      </main>
      <footer className="app-footer">
        RUN voxel packs and this showcase © 2026 Series Entertainment, Inc. — RUN License (RUN Repository Supplemental License v1.0). Pirate Nation art and avatar armature © 2026 Proof of Play, Inc. — MIT license.
      </footer>
    </div>
  )
}
