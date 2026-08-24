/**
 * App shell: tab router across the five showcase surfaces. Tabs are plain
 * state — the pack is local, so there is nothing worth deep-linking yet.
 */
import { useState } from 'react'
import { AudioRoom } from './tabs/AudioRoom'
import { AvatarLab } from './tabs/AvatarLab'
import { Dashboard } from './tabs/Dashboard'
import { ModelGallery } from './tabs/ModelGallery'
import { SpriteLibrary } from './tabs/SpriteLibrary'

const TABS = [
  { id: 'dashboard', label: 'Overview', Component: Dashboard },
  { id: 'models', label: 'Models', Component: ModelGallery },
  { id: 'avatar', label: 'Avatar Lab', Component: AvatarLab },
  { id: 'sprites', label: 'Sprites', Component: SpriteLibrary },
  { id: 'audio', label: 'Audio', Component: AudioRoom },
] as const

type TabId = (typeof TABS)[number]['id']

export function App() {
  const [tab, setTab] = useState<TabId>('dashboard')
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
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <active.Component />
      </main>

      <footer className="app-footer">
        Pirate Nation art © 2026 Proof of Play, Inc. — MIT license. Allowlisted extract of{' '}
        <a href="https://github.com/proofofplay/piratenation-game">
          github.com/proofofplay/piratenation-game
        </a>
        .
      </footer>
    </div>
  )
}
