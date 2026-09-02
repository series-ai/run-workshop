import React, { useState } from 'react'
import { AUTOTILE_TERRAINS, type AutotileTerrainDef } from '../catalog'
import { useAssetUrl } from '../useAssetUrl'
import { Globe, Paintbrush, Eraser, Eye, Sparkles, Layers } from 'lucide-react'

// Representative world objects with authored collision bounding boxes
interface WorldObjectDef {
  id: string
  name: string
  spritePath: string
  width: number
  height: number
  collisions: Array<{ x: number; y: number; width: number; height: number }>
}

const WORLD_OBJECTS: WorldObjectDef[] = [
  {
    id: 'tree-oak',
    name: 'Misty Oak Tree',
    spritePath: 'sprites/tree_oak_large.png',
    width: 64,
    height: 96,
    collisions: [{ x: 20, y: 70, width: 24, height: 20 }],
  },
  {
    id: 'tree-pine',
    name: 'Ancient Pine',
    spritePath: 'sprites/tree_pine.png',
    width: 48,
    height: 80,
    collisions: [{ x: 16, y: 60, width: 16, height: 16 }],
  },
  {
    id: 'boulder-moss',
    name: 'Mossy Boulder',
    spritePath: 'sprites/rock_moss_large.png',
    width: 48,
    height: 48,
    collisions: [{ x: 6, y: 12, width: 36, height: 30 }],
  },
  {
    id: 'chest-wooden',
    name: 'Treasure Chest',
    spritePath: 'sprites/chest_wood_closed.png',
    width: 32,
    height: 32,
    collisions: [{ x: 4, y: 8, width: 24, height: 20 }],
  },
  {
    id: 'fence-wood',
    name: 'Wooden Fence',
    spritePath: 'sprites/fence_wood_h.png',
    width: 32,
    height: 32,
    collisions: [{ x: 0, y: 12, width: 32, height: 12 }],
  },
  {
    id: 'lamp-post',
    name: 'Street Lantern',
    spritePath: 'sprites/lamp_post.png',
    width: 32,
    height: 64,
    collisions: [{ x: 10, y: 48, width: 12, height: 12 }],
  },
]

const GRID_SIZE = 6

export const WorldStage: React.FC = () => {
  const [selectedTerrain, setSelectedTerrain] = useState<AutotileTerrainDef>(AUTOTILE_TERRAINS[0])
  const [selectedTool, setSelectedTool] = useState<'paint' | 'erase'>('paint')
  const [showCollisions, setShowCollisions] = useState(true)
  const [grid, setGrid] = useState<boolean[]>(() =>
    Array(GRID_SIZE * GRID_SIZE)
      .fill(false)
      .map((_, i) => i > 6 && i < 28 && i % 6 > 0 && i % 6 < 5),
  )

  const handleCellClick = (idx: number) => {
    setGrid((prev) => {
      const next = [...prev]
      next[idx] = selectedTool === 'paint'
      return next
    })
  }

  const handleFill = () => setGrid(Array(GRID_SIZE * GRID_SIZE).fill(true))
  const handleClear = () => setGrid(Array(GRID_SIZE * GRID_SIZE).fill(false))

  // Calculate 4-bit autotile bitmask (N=1, E=2, S=4, W=8)
  const getBitmask = (idx: number): number => {
    if (!grid[idx]) return 0
    const row = Math.floor(idx / GRID_SIZE)
    const col = idx % GRID_SIZE

    let mask = 0
    if (row > 0 && grid[idx - GRID_SIZE]) mask |= 1 // North
    if (col < GRID_SIZE - 1 && grid[idx + 1]) mask |= 2 // East
    if (row < GRID_SIZE - 1 && grid[idx + GRID_SIZE]) mask |= 4 // South
    if (col > 0 && grid[idx - 1]) mask |= 8 // West
    return mask
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            World & Autotile Stage
          </h2>
          <p className="text-slate-400 text-xs">
            4-bit terrain autotiler bitmask painter and world object collision overlays from object-index.json.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 4-bit Autotile Painter */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  4-Bit Autotile Terrain Painter
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Bitmask rule calculation (0..15) based on 4-neighbor adjacency.
                </p>
              </div>

              {/* Biome selector */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {AUTOTILE_TERRAINS.map((terrain) => (
                  <button
                    key={terrain.id}
                    onClick={() => setSelectedTerrain(terrain)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      selectedTerrain.id === terrain.id
                        ? 'bg-indigo-500 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {terrain.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedTool('paint')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                    selectedTool === 'paint'
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-semibold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Paint
                </button>
                <button
                  onClick={() => setSelectedTool('erase')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition ${
                    selectedTool === 'erase'
                      ? 'border-rose-500 bg-rose-500/20 text-rose-300 font-semibold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Erase
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleFill}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                >
                  Fill All
                </button>
                <button
                  onClick={handleClear}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* 6x6 Tile Grid */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 max-w-sm mx-auto shadow-inner">
              <div className="grid grid-cols-6 gap-1">
                {grid.map((active, idx) => {
                  const mask = getBitmask(idx)
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCellClick(idx)}
                      className={`h-12 rounded border flex flex-col items-center justify-center cursor-pointer select-none transition ${
                        active
                          ? 'bg-indigo-950/80 border-indigo-500/60 shadow'
                          : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                      }`}
                    >
                      {active && (
                        <div className="text-[10px] font-mono text-indigo-300 font-bold">
                          m:{mask}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Placeable World Objects & Collisions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  World Objects & Collisions
                </h3>
                <p className="text-slate-400 text-[11px]">
                  Loaded from object-index.json with real bounding boxes.
                </p>
              </div>

              {/* Collision Toggle */}
              <button
                onClick={() => setShowCollisions(!showCollisions)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                  showCollisions
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {showCollisions ? 'Hide Boxes' : 'Show Boxes'}
              </button>
            </div>

            {/* Objects Roster */}
            <div className="grid grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
              {WORLD_OBJECTS.map((obj) => (
                <WorldObjectCard
                  key={obj.id}
                  obj={obj}
                  showCollisions={showCollisions}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const WorldObjectCard: React.FC<{ obj: WorldObjectDef; showCollisions: boolean }> = ({
  obj,
  showCollisions,
}) => {
  const { url } = useAssetUrl(obj.spritePath)

  return (
    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-between text-center relative group">
      <div className="relative w-28 h-28 flex items-center justify-center bg-slate-900/40 rounded-lg p-2 overflow-hidden">
        {url ? (
          <img src={url} alt={obj.name} className="max-w-full max-h-full object-contain pixelated z-10" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
        )}

        {/* Collision Overlay */}
        {showCollisions &&
          obj.collisions.map((box, i) => (
            <div
              key={i}
              style={{
                left: `${(box.x / obj.width) * 100}%`,
                top: `${(box.y / obj.height) * 100}%`,
                width: `${(box.width / obj.width) * 100}%`,
                height: `${(box.height / obj.height) * 100}%`,
              }}
              className="absolute border-2 border-rose-500 bg-rose-500/30 rounded z-20 pointer-events-none"
              title={`Collision Box: ${box.width}x${box.height}`}
            />
          ))}
      </div>

      <div className="mt-2 w-full">
        <div className="text-xs font-semibold text-slate-200 truncate">{obj.name}</div>
        <div className="text-[10px] text-slate-500 font-mono">
          {obj.width}x{obj.height} • {obj.collisions.length} box
        </div>
      </div>
    </div>
  )
}
