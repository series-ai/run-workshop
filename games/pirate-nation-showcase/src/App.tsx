/**
 * App shell: tab router across the six showcase surfaces. Tabs are plain
 * state — the pack is remote, with session-only progress tracking.
 */
import { useState } from 'react'
import { AudioRoom } from './tabs/AudioRoom'
import { AvatarLab } from './tabs/AvatarLab'
import { Dashboard, type ExploreTab } from './tabs/Dashboard'
import { ModelGallery } from './tabs/ModelGallery'
import { SceneStage } from './tabs/SceneStage'
import { SpriteLibrary } from './tabs/SpriteLibrary'

const TABS = [
  { id: 'dashboard', label: 'Home', Component: Dashboard },
  { id: 'models', label: 'Models', Component: ModelGallery },
  { id: 'scene', label: 'Scene', Component: SceneStage },
  { id: 'avatar', label: 'Avatar Lab', Component: AvatarLab },
  { id: 'sprites', label: 'Sprites', Component: SpriteLibrary },
  { id: 'audio', label: 'Audio', Component: AudioRoom },
] as const

type TabId = (typeof TABS)[number]['id']

export function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [visited, setVisited] = useState<Set<ExploreTab>>(new Set())

  const navigate = (next: TabId) => {
    setTab(next)
    if (next !== 'dashboard') {
      setVisited((previous) => new Set(previous).add(next))
    }
  }

  const active = TABS.find((entry) => entry.id === tab) ?? TABS[0]

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pirate Nation Art Showcase</h1>
        <nav className="tab-bar">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === tab ? 'tab active' : 'tab'}
              onClick={() => navigate(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        {active.id === 'dashboard' ? (
          <Dashboard onNavigate={navigate} visited={visited} />
        ) : (
          <active.Component />
        )}
      </main>

      <footer className="app-footer">
        Pirate Nation art © 2026 Proof of Play, Inc. — MIT license. Thank you to Proof of Play for
        sharing this work so others can build with it.{' '}
        <a href="https://github.com/proofofplay/piratenation-game">View the source release</a>.
      </footer>
    </div>
  )
}
