import React, { useState } from 'react'
import { Dashboard } from './tabs/Dashboard'
import { AvatarLab } from './tabs/AvatarLab'
import { CropExplorer } from './tabs/CropExplorer'
import { UiExplorer } from './tabs/UiExplorer'
import { WorldStage } from './tabs/WorldStage'
import { AudioRoom } from './tabs/AudioRoom'
import { Sparkles, User, Sprout, Layout, Globe, Volume2, Shield } from 'lucide-react'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard')

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: Sparkles },
    { id: 'avatar', label: 'Avatar Lab', icon: User },
    { id: 'crops', label: 'Crops & Farm', icon: Sprout },
    { id: 'ui', label: 'UI & Icons', icon: Layout },
    { id: 'world', label: 'World Stage', icon: Globe },
    { id: 'audio', label: 'Audio Room', icon: Volume2 },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-pixel text-xs">
              M
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Mystvale
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                  v1.0
                </span>
              </div>
              <div className="text-[10px] text-slate-500">Asset Library & Showcase</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex items-center gap-1 overflow-x-auto py-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && <Dashboard onSelectTab={setActiveTab} />}
        {activeTab === 'avatar' && <AvatarLab />}
        {activeTab === 'crops' && <CropExplorer />}
        {activeTab === 'ui' && <UiExplorer />}
        {activeTab === 'world' && <WorldStage />}
        {activeTab === 'audio' && <AudioRoom />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 bg-slate-950/40 px-6 py-4 text-center text-xs text-slate-500 flex flex-wrap items-center justify-between max-w-6xl mx-auto w-full gap-2">
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Open Source MIT License • Series AI, Inc.</span>
        </div>
        <div className="font-mono text-[11px] text-slate-600">
          pack: series-ai/mystvale@04811e1dd830
        </div>
      </footer>
    </div>
  )
}
