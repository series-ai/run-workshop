import React from 'react'
import { PACK_METRICS, CROPS, AVATAR_LAYERS, AUDIO_TRACKS, ICON_REGISTRY, AUTOTILE_TERRAINS } from '../catalog'
import { Sparkles, User, Sprout, Layout, Globe, Volume2, ShieldCheck, Database, GitBranch, ArrowRight } from 'lucide-react'

interface DashboardProps {
  onSelectTab: (tab: string) => void
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectTab }) => {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/20 p-8 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            MIT Open Source Game Pack
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Mystvale Asset Showcase
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">
            A comprehensive 2D cozy fantasy RPG asset package with modular paper-doll avatars, 14 growth-stage crops, autotile terrains, 9-slice UI panels, 84 icons, and native soundscapes.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onSelectTab('avatar')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition shadow-lg shadow-emerald-900/30"
            >
              Launch Avatar Lab
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSelectTab('crops')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm transition"
            >
              Explore Farm & Crops
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Database className="w-4 h-4 text-emerald-400" />
            Pack ID
          </div>
          <div className="text-sm font-semibold text-slate-100 truncate font-mono">
            {PACK_METRICS.packId}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">ver: {PACK_METRICS.version}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Total Files
          </div>
          <div className="text-xl font-bold text-slate-100">
            {PACK_METRICS.totalFiles} assets
          </div>
          <div className="text-[11px] text-slate-500">{(PACK_METRICS.totalBytes / 1024 / 1024).toFixed(1)} MB total</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Licensing
          </div>
          <div className="text-xl font-bold text-slate-100">
            {PACK_METRICS.license}
          </div>
          <div className="text-[11px] text-slate-500">Series AI, Inc.</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
            <GitBranch className="w-4 h-4 text-purple-400" />
            Upstream
          </div>
          <a
            href={PACK_METRICS.upstreamUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-indigo-400 hover:underline truncate"
          >
            series-ai/gtm-mystvale
          </a>
          <div className="text-[11px] text-slate-500">Open source</div>
        </div>
      </div>

      {/* Feature Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Pack Categories & Previewers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            onClick={() => onSelectTab('avatar')}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition">
                <User className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-1">Avatar Lab</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Layered paper-doll compositor with real-time color tinting, animation frame playback, and random generator.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>{AVATAR_LAYERS.length} Modular Layers</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>

          <div
            onClick={() => onSelectTab('crops')}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-110 transition">
                <Sprout className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-1">Crop & Farm Explorer</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Visual stage browser across all 14 crops (seed, sprout, mid, mature, harvest) plus interactive 3x3 plot simulator.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>{CROPS.length} Unique Crops</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>

          <div
            onClick={() => onSelectTab('ui')}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition">
                <Layout className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-1">UI & Icons Explorer</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Interactive 9-slice panel scale sliders, button interaction states, and searchable 84-sprite icon registry.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-cyan-400 font-medium">
              <span>{ICON_REGISTRY.length} Categorized Icons</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>

          <div
            onClick={() => onSelectTab('world')}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-1">World & Scene Stage</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                4-bit autotile terrain painter and placeable environment objects with toggleable collision bounding box overlays.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-indigo-400 font-medium">
              <span>{AUTOTILE_TERRAINS.length} Terrain Biomes</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>

          <div
            onClick={() => onSelectTab('audio')}
            className="group cursor-pointer p-5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-800/80 transition flex flex-col justify-between shadow-sm"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-3 group-hover:scale-110 transition">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-100 text-base mb-1">Audio Room</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Native .ogg soundscapes: background music player, day/night ambient loops, and categorized SFX soundboard.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-pink-400 font-medium">
              <span>{AUDIO_TRACKS.length} Soundtracks & SFX</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
