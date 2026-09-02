import React, { useState } from 'react'
import { CROPS, type CropDef } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { Sprout, Sun, Droplets, Shovel, Sparkles, RefreshCw, Package } from 'lucide-react'

interface PlotState {
  tilled: boolean
  watered: boolean
  cropId?: string
  stage: number
}

const CropCard: React.FC<{ crop: CropDef; isSelected: boolean; onSelect: () => void }> = ({
  crop,
  isSelected,
  onSelect,
}) => {
  const harvestUrl = useAssetUrl(crop.harvestSprite)
  const matureStageUrl = useAssetUrl(crop.stageSprites[crop.stageSprites.length - 1])

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
        isSelected
          ? 'bg-amber-500/10 border-amber-500 text-amber-300 font-semibold shadow-md shadow-amber-950/40'
          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
      }`}
    >
      <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center p-1 overflow-hidden shrink-0">
        {harvestUrl.url ? (
          <img src={harvestUrl.url} alt={crop.name} className="w-8 h-8 object-contain pixelated" />
        ) : matureStageUrl.url ? (
          <img src={matureStageUrl.url} alt={crop.name} className="w-8 h-8 object-contain pixelated" />
        ) : (
          <Sprout className="w-5 h-5 text-amber-500/50" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate text-white">{crop.name}</div>
        <div className="text-[11px] text-slate-400">
          {crop.stages} stages • {crop.growDays} days
        </div>
      </div>
    </div>
  )
}

const StageItem: React.FC<{ spritePath: string; stageIndex: number; isMature: boolean }> = ({
  spritePath,
  stageIndex,
  isMature,
}) => {
  const { url } = useAssetUrl(spritePath)

  return (
    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col items-center justify-center text-center space-y-2">
      <div className="w-16 h-16 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-center p-2">
        {url ? (
          <img src={url} alt={`Stage ${stageIndex}`} className="w-12 h-12 object-contain pixelated" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        )}
      </div>
      <div>
        <span className="text-[11px] font-semibold text-slate-200 block">
          Stage {stageIndex + 1}
        </span>
        <span className="text-[10px] text-slate-500">
          {stageIndex === 0 ? 'Seed' : isMature ? 'Mature' : 'Growth'}
        </span>
      </div>
    </div>
  )
}

const HarvestItem: React.FC<{ harvestSprite: string; sellPrice: number }> = ({
  harvestSprite,
  sellPrice,
}) => {
  const { url } = useAssetUrl(harvestSprite)

  return (
    <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col items-center justify-center text-center space-y-2">
      <div className="w-16 h-16 rounded-lg bg-slate-900/60 border border-amber-500/20 flex items-center justify-center p-2">
        {url ? (
          <img src={url} alt="Harvest Item" className="w-12 h-12 object-contain pixelated" />
        ) : (
          <Package className="w-6 h-6 text-amber-400" />
        )}
      </div>
      <div>
        <span className="text-[11px] font-semibold text-amber-300 block">Harvest Item</span>
        <span className="text-[10px] text-amber-400/70">{sellPrice} gold</span>
      </div>
    </div>
  )
}

const StageDisplay: React.FC<{ crop: CropDef }> = ({ crop }) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sprout className="w-4 h-4 text-amber-400" />
            {crop.name} Growth Progression
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Yields {crop.harvestAmount}x {crop.name} • Sells for {crop.sellPrice}g (Seed: {crop.seedPrice}g)
            {crop.regrows && ' • Regrows after harvest'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
        {crop.stageSprites.map((spritePath, idx) => (
          <StageItem
            key={spritePath}
            spritePath={spritePath}
            stageIndex={idx}
            isMature={idx === crop.stageSprites.length - 1}
          />
        ))}
        <HarvestItem harvestSprite={crop.harvestSprite} sellPrice={crop.sellPrice} />
      </div>
    </div>
  )
}

const PlotTile: React.FC<{
  plot: PlotState
  index: number
  onClick: () => void
}> = ({ plot, index, onClick }) => {
  const crop = plot.cropId ? CROPS.find((c) => c.id === plot.cropId) : undefined
  const spritePath = crop ? crop.stageSprites[Math.min(plot.stage, crop.stageSprites.length - 1)] : undefined
  const { url } = useAssetUrl(spritePath)
  const isMature = crop && plot.stage >= crop.stages - 1

  return (
    <div
      onClick={onClick}
      className={`h-24 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer transition relative overflow-hidden select-none ${
        !plot.tilled
          ? 'bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700'
          : plot.watered
          ? 'bg-amber-950/80 border-cyan-500/70 shadow-inner'
          : 'bg-amber-950/40 border-amber-900/60 hover:border-amber-700'
      }`}
    >
      {/* Plot State Badge */}
      <div className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-500">
        #{index + 1}
      </div>

      {url ? (
        <img src={url} alt="Crop" className="w-12 h-12 object-contain pixelated z-10" />
      ) : plot.tilled ? (
        <div className="text-[10px] text-amber-700 font-medium">Tilled</div>
      ) : (
        <div className="text-[10px] text-emerald-800 font-medium">Grass</div>
      )}

      {/* Water drop indicator */}
      {plot.watered && (
        <Droplets className="w-3 h-3 text-cyan-400 absolute bottom-1 right-1" />
      )}

      {/* Mature glow */}
      {isMature && (
        <div className="absolute inset-0 bg-amber-400/10 border-2 border-amber-400 rounded-xl animate-pulse" />
      )}
    </div>
  )
}

export const CropExplorer: React.FC = () => {
  const [selectedCropId, setSelectedCropId] = useState<string>('wheat')
  const [selectedTool, setSelectedTool] = useState<'hoe' | 'water' | 'plant' | 'harvest'>('plant')
  const [plots, setPlots] = useState<PlotState[]>(() =>
    Array(9).fill(null).map((_, i) => ({
      tilled: i < 6,
      watered: i % 2 === 0,
      cropId: i < 3 ? 'wheat' : i < 6 ? 'carrot' : undefined,
      stage: i < 3 ? (i % 3) : 0,
    })),
  )
  const [inventory, setInventory] = useState<Record<string, number>>({})

  const selectedCrop = CROPS.find((c) => c.id === selectedCropId) ?? CROPS[0]

  const handlePlotClick = (index: number) => {
    setPlots((prev) => {
      const next = [...prev]
      const p = { ...next[index] }

      if (selectedTool === 'hoe') {
        p.tilled = true
      } else if (selectedTool === 'water') {
        if (p.tilled) p.watered = true
      } else if (selectedTool === 'plant') {
        if (p.tilled && !p.cropId) {
          p.cropId = selectedCrop.id
          p.stage = 0
        }
      } else if (selectedTool === 'harvest') {
        if (p.cropId) {
          const c = CROPS.find((item) => item.id === p.cropId)
          if (c && p.stage >= c.stages - 1) {
            setInventory((inv) => ({
              ...inv,
              [c.name]: (inv[c.name] ?? 0) + c.harvestAmount,
            }))
            if (c.regrows) {
              p.stage = Math.max(0, c.stages - 2)
            } else {
              p.cropId = undefined
              p.stage = 0
            }
          }
        }
      }

      next[index] = p
      return next
    })
  }

  const handleAdvanceDay = () => {
    setPlots((prev) =>
      prev.map((p) => {
        if (!p.cropId || !p.watered) {
          return { ...p, watered: false }
        }
        const crop = CROPS.find((c) => c.id === p.cropId)
        const maxStage = crop ? crop.stages - 1 : 0
        return {
          ...p,
          stage: Math.min(maxStage, p.stage + 1),
          watered: false,
        }
      }),
    )
  }

  const handleResetPlots = () => {
    setPlots(
      Array(9).fill(null).map(() => ({
        tilled: true,
        watered: false,
        stage: 0,
      })),
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sprout className="w-5 h-5 text-amber-400" />
            Crop & Farm Simulator
          </h2>
          <p className="text-slate-400 text-xs">
            Visual stage progression across all 14 crops with an interactive 3x3 farming plot.
          </p>
        </div>
      </div>

      {/* Main Grid: Crop Catalog & Progression */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 14-crop selector list */}
        <div className="lg:col-span-4 space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">
            14 Selectable Crops ({CROPS.length})
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-1 gap-2 max-h-[520px] overflow-y-auto pr-1">
            {CROPS.map((crop) => (
              <CropCard
                key={crop.id}
                crop={crop}
                isSelected={selectedCrop.id === crop.id}
                onSelect={() => setSelectedCropId(crop.id)}
              />
            ))}
          </div>
        </div>

        {/* Right: Stage Progression + Interactive 3x3 Plot */}
        <div className="lg:col-span-8 space-y-6">
          <StageDisplay crop={selectedCrop} />

          {/* Interactive Plot Simulator */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Interactive 3x3 Farm Plot
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Select a tool, click plots to farm, and advance days to watch crops grow.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAdvanceDay}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-md transition"
                >
                  <Sun className="w-3.5 h-3.5" />
                  Advance Day (Grow)
                </button>
                <button
                  onClick={handleResetPlots}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                  title="Reset plots"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool Toolbar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
              <span className="text-xs text-slate-400 mr-1">Active Tool:</span>
              <button
                onClick={() => setSelectedTool('plant')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  selectedTool === 'plant'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Sprout className="w-3.5 h-3.5" />
                Plant {selectedCrop.name}
              </button>
              <button
                onClick={() => setSelectedTool('water')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  selectedTool === 'water'
                    ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                Water
              </button>
              <button
                onClick={() => setSelectedTool('hoe')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  selectedTool === 'hoe'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Shovel className="w-3.5 h-3.5" />
                Till Soil
              </button>
              <button
                onClick={() => setSelectedTool('harvest')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                  selectedTool === 'harvest'
                    ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-semibold'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                Harvest
              </button>
            </div>

            {/* 3x3 Plot Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto p-4 rounded-xl bg-slate-950 border border-slate-800">
              {plots.map((plot, i) => (
                <PlotTile
                  key={i}
                  plot={plot}
                  index={i}
                  onClick={() => handlePlotClick(i)}
                />
              ))}
            </div>

            {/* Harvested Inventory */}
            {Object.keys(inventory).length > 0 && (
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2 flex-wrap text-xs text-slate-300">
                <span className="font-semibold text-emerald-400">Harvested:</span>
                {Object.entries(inventory).map(([name, count]) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-[11px]"
                  >
                    {name}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
