import { useEffect, useState } from 'react'
import { loadMicroRtsCatalog, type MicroRtsCatalog } from './catalog'
import { BuildingsTab } from './tabs/BuildingsTab'
import { EnvironmentTab } from './tabs/EnvironmentTab'
import { RosterTab } from './tabs/RosterTab'
import { SkirmishTab } from './tabs/SkirmishTab'
import { UiSpecTab } from './tabs/UiSpecTab'
import { VfxTab } from './tabs/VfxTab'

export type TabId = 'skirmish' | 'roster' | 'buildings' | 'environment' | 'vfx' | 'ui'

export function App() {
  const [tab, setTab] = useState<TabId>('skirmish')
  const [catalog, setCatalog] = useState<MicroRtsCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMicroRtsCatalog()
      .then(setCatalog)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-badge">RUN Micro-RTS</span>
          <h1>8×8 Pixel-Art RTS Workshop &amp; Sandbox</h1>
        </div>
        <nav className="tabs" aria-label="Micro-RTS showcase sections">
          <button className={`tab-btn ${tab === 'skirmish' ? 'active' : ''}`} onClick={() => setTab('skirmish')}>
            Live Skirmish
          </button>
          <button className={`tab-btn ${tab === 'roster' ? 'active' : ''}`} onClick={() => setTab('roster')}>
            84-Unit Roster<span className="hide-compact"> &amp; 2-Layer</span>
          </button>
          <button className={`tab-btn ${tab === 'buildings' ? 'active' : ''}`} onClick={() => setTab('buildings')}>
            Buildings<span className="hide-compact"> (7 States)</span>
          </button>
          <button className={`tab-btn ${tab === 'environment' ? 'active' : ''}`} onClick={() => setTab('environment')}>
            Biomes &amp; Objects
          </button>
          <button className={`tab-btn ${tab === 'vfx' ? 'active' : ''}`} onClick={() => setTab('vfx')}>
            Combat VFX<span className="hide-compact"> Lab</span>
          </button>
          <button className={`tab-btn ${tab === 'ui' ? 'active' : ''}`} onClick={() => setTab('ui')}>
            UI Chrome &amp; Spec
          </button>
        </nav>
      </header>

      <main className="main-area">
        {error && (
          <div style={{ padding: 24, color: 'var(--bad)' }}>
            Failed to load RUN Micro-RTS manifests: {error}. In local dev, ensure{' '}
            <code>run-micro-rts</code> is staged into <code>~/dev/jam-ready-assets</code> (run{' '}
            <code>npm run build:all &amp;&amp; npm run stage -- --target ~/dev/jam-ready-assets</code> inside{' '}
            <code>tools/micro-rts</code>).
          </div>
        )}
        {!error && !catalog && (
          <div style={{ padding: 24, color: 'var(--muted)' }}>Loading RUN Micro-RTS asset manifests…</div>
        )}
        {catalog && (
          <>
            {tab === 'skirmish' && <SkirmishTab catalog={catalog} />}
            {tab === 'roster' && <RosterTab catalog={catalog} />}
            {tab === 'buildings' && <BuildingsTab catalog={catalog} />}
            {tab === 'environment' && <EnvironmentTab catalog={catalog} />}
            {tab === 'vfx' && <VfxTab catalog={catalog} />}
            {tab === 'ui' && <UiSpecTab catalog={catalog} />}
          </>
        )}
      </main>
    </div>
  )
}
