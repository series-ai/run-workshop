import React, { useState } from 'react'
import { ICON_REGISTRY, type IconDef } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { Layout, Search, Sliders, Copy, Check, Sparkles } from 'lucide-react'

export const UiExplorer: React.FC = () => {
  const [panelWidth, setPanelWidth] = useState(280)
  const [panelHeight, setPanelHeight] = useState(160)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedPath, setCopiedPath] = useState<string | null>(null)

  const handleCopyPath = (path: string) => {
    navigator.clipboard?.writeText(path)
    setCopiedPath(path)
    setTimeout(() => setCopiedPath(null), 2000)
  }

  const categories = ['all', 'tool', 'crop', 'resource', 'weapon', 'fish']

  const filteredIcons = ICON_REGISTRY.filter((icon) => {
    const matchesCategory = selectedCategory === 'all' || icon.category === selectedCategory
    const matchesQuery =
      icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      icon.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesQuery
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-cyan-400" />
            UI & Icon Explorer
          </h2>
          <p className="text-slate-400 text-xs">
            9-slice responsive panel scalers, button interaction states, and categorized 32x32 sprite icons.
          </p>
        </div>
      </div>

      {/* 9-Slice Scaling Interactive Showcase */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              9-Slice Panel Slicing & Scaling Preview
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Adjust sliders to test dynamic corner preservation and center stretching.
            </p>
          </div>

          {/* Size Sliders */}
          <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Width:</span>
              <input
                type="range"
                min={160}
                max={440}
                value={panelWidth}
                onChange={(e) => setPanelWidth(Number(e.target.value))}
                className="w-24 accent-cyan-500 cursor-pointer"
              />
              <span className="font-mono text-cyan-300 w-10 text-right">{panelWidth}px</span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Height:</span>
              <input
                type="range"
                min={100}
                max={260}
                value={panelHeight}
                onChange={(e) => setPanelHeight(Number(e.target.value))}
                className="w-24 accent-cyan-500 cursor-pointer"
              />
              <span className="font-mono text-cyan-300 w-10 text-right">{panelHeight}px</span>
            </div>
          </div>
        </div>

        {/* Scaled Panels Preview */}
        <div className="flex flex-wrap gap-6 items-start justify-center p-6 rounded-xl bg-slate-950 border border-slate-800/80 min-h-[280px]">
          {/* Wood Panel */}
          <div
            style={{ width: `${panelWidth}px`, height: `${panelHeight}px` }}
            className="p-4 rounded-xl bg-amber-950/40 border-2 border-amber-800/70 shadow-lg flex flex-col justify-between transition-all duration-75 relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-amber-800/60 pb-2">
              <span className="font-pixel text-[10px] text-amber-300">WOOD FRAME</span>
              <span className="text-[10px] font-mono text-amber-500/80">9-slice</span>
            </div>
            <p className="text-xs text-amber-200/80 leading-relaxed">
              Cozy wooden dialog container. Preserves 12px border corners while expanding to fill any dimension.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-amber-800/40">
              <button className="px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white text-[11px] font-semibold transition">
                Accept
              </button>
            </div>
          </div>

          {/* Parchment Panel */}
          <div
            style={{ width: `${panelWidth}px`, height: `${panelHeight}px` }}
            className="p-4 rounded-xl bg-yellow-950/30 border-2 border-yellow-700/60 shadow-lg flex flex-col justify-between transition-all duration-75 relative overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-yellow-700/50 pb-2">
              <span className="font-pixel text-[10px] text-yellow-300">PARCHMENT</span>
              <span className="text-[10px] font-mono text-yellow-500/80">16-slice</span>
            </div>
            <p className="text-xs text-yellow-100/80 leading-relaxed italic">
              "A mystical scroll detailing the ancient ruins of Mystvale..."
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-yellow-700/40">
              <button className="px-3 py-1 rounded bg-yellow-700 hover:bg-yellow-600 text-white text-[11px] font-semibold transition">
                Read Quest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 84-Sprite Icon Registry */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Categorized 32x32 Icon Registry ({ICON_REGISTRY.length} items)
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              Click any icon to copy its pack-relative asset path.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search icons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize transition ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Icon Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 pt-2">
          {filteredIcons.map((icon) => (
            <IconItem
              key={icon.id}
              icon={icon}
              isCopied={copiedPath === icon.path}
              onCopy={() => handleCopyPath(icon.path)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const IconItem: React.FC<{ icon: IconDef; isCopied: boolean; onCopy: () => void }> = ({
  icon,
  isCopied,
  onCopy,
}) => {
  const { url } = useAssetUrl(icon.path)

  return (
    <div
      onClick={onCopy}
      className="group relative p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition flex flex-col items-center justify-center text-center cursor-pointer select-none"
    >
      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-center p-1 group-hover:scale-110 transition">
        {url ? (
          <img src={url} alt={icon.name} className="w-8 h-8 object-contain pixelated" />
        ) : (
          <div className="w-3 h-3 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        )}
      </div>
      <span className="text-[11px] font-medium text-slate-300 truncate w-full mt-2 group-hover:text-cyan-300">
        {icon.name}
      </span>
      <span className="text-[9px] text-slate-500 capitalize">{icon.category}</span>

      {/* Copy overlay */}
      <div className="absolute inset-0 bg-slate-900/90 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
        {isCopied ? (
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" /> Copied
          </span>
        ) : (
          <span className="text-[10px] text-cyan-300 font-medium flex items-center gap-1">
            <Copy className="w-3 h-3" /> Copy
          </span>
        )}
      </div>
    </div>
  )
}
