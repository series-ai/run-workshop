import React, { useState, useEffect, useRef } from 'react'
import {
  AVATAR_LAYERS,
  DEFAULT_AVATAR_APPEARANCE,
  type AvatarAppearance,
} from '../catalog'
import {
  resolveAvatarLayers,
  generateRandomAppearance,
  applyTintToImageData,
} from '../avatar/avatar'
import { resolveAssetUrl } from '../assetLibrary'
import { Play, Pause, Shuffle, Copy, Check, User } from 'lucide-react'

const FRAME_WIDTH = 80
const FRAME_HEIGHT = 80
const SHEET_COLS = 6

const ANIMATIONS = {
  'idle-right': { name: 'Idle (Right)', frames: [12, 13, 14, 15, 16, 17], fps: 4 },
  'walk-right': { name: 'Walk (Right)', frames: [0, 1, 2, 3, 4, 5], fps: 8 },
  'run-right': { name: 'Run (Right)', frames: [6, 7, 8, 9, 10, 11], fps: 12 },
}

export const AvatarLab: React.FC = () => {
  const [appearance, setAppearance] = useState<AvatarAppearance>(DEFAULT_AVATAR_APPEARANCE)
  const [currentAnim, setCurrentAnim] = useState<keyof typeof ANIMATIONS>('idle-right')
  const [frameIndex, setFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [copied, setCopied] = useState(false)
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map())

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Preload and cache layer images
  useEffect(() => {
    const layers = resolveAvatarLayers(appearance)
    const newImages = new Map(loadedImages)
    let isSubscribed = true

    Promise.all(
      layers.map(async (layer) => {
        if (newImages.has(layer.path)) return
        try {
          const url = await resolveAssetUrl(layer.path)
          const img = new Image()
          img.crossOrigin = 'anonymous'
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = url
          })
          if (isSubscribed) {
            newImages.set(layer.path, img)
          }
        } catch {
          // Ignore missing frames in sandbox
        }
      }),
    ).then(() => {
      if (isSubscribed) {
        setLoadedImages(new Map(newImages))
      }
    })

    return () => {
      isSubscribed = false
    }
  }, [appearance])

  // Animation frame ticker
  useEffect(() => {
    if (!isPlaying) return
    const anim = ANIMATIONS[currentAnim]
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % anim.frames.length)
    }, 1000 / anim.fps)

    return () => clearInterval(interval)
  }, [isPlaying, currentAnim])

  // Draw avatar to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false

    const anim = ANIMATIONS[currentAnim]
    const currentFrame = anim.frames[frameIndex % anim.frames.length]
    const frameCol = currentFrame % SHEET_COLS
    const frameRow = Math.floor(currentFrame / SHEET_COLS)
    const sx = frameCol * FRAME_WIDTH
    const sy = frameRow * FRAME_HEIGHT

    const layers = resolveAvatarLayers(appearance)

    // Temporary canvas for tinting
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = FRAME_WIDTH
    tempCanvas.height = FRAME_HEIGHT
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })

    for (const layer of layers) {
      const img = loadedImages.get(layer.path)
      if (!img || !tempCtx) continue

      tempCtx.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
      tempCtx.drawImage(img, sx, sy, FRAME_WIDTH, FRAME_HEIGHT, 0, 0, FRAME_WIDTH, FRAME_HEIGHT)

      if (layer.tint) {
        try {
          const imgData = tempCtx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
          applyTintToImageData(imgData.data, layer.tint)
          tempCtx.putImageData(imgData, 0, 0)
        } catch {
          // Fallback if cross-origin tainted
        }
      }

      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height)
    }
  }, [appearance, currentAnim, frameIndex, loadedImages])

  const handleCopy = () => {
    navigator.clipboard?.writeText(JSON.stringify(appearance, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRandomize = () => {
    setAppearance(generateRandomAppearance())
  }

  const hairs = AVATAR_LAYERS.filter((l) => l.slot === 'hair')
  const clothes = AVATAR_LAYERS.filter((l) => l.slot === 'clothes')
  const eyes = AVATAR_LAYERS.filter((l) => l.slot === 'eyes')
  const accessories = AVATAR_LAYERS.filter((l) => l.slot === 'accessories')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            Avatar Lab
          </h2>
          <p className="text-slate-400 text-xs">
            Modular paper-doll character builder with real-time color tinting and animation playback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRandomize}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Randomize
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left: Canvas Stage */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
          <div className="relative w-64 h-64 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner overflow-hidden">
            {/* Retro grid background */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
            <canvas
              ref={canvasRef}
              width={240}
              height={240}
              className="relative z-10 pixelated w-56 h-56 object-contain"
            />
          </div>

          {/* Animation Controls */}
          <div className="mt-5 w-full space-y-3">
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800">
              <span className="text-xs font-medium text-slate-400">Animation</span>
              <div className="flex items-center gap-1">
                {(Object.keys(ANIMATIONS) as Array<keyof typeof ANIMATIONS>).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentAnim(key)
                      setFrameIndex(0)
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                      currentAnim === key
                        ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {ANIMATIONS[key].name.split(' ')[0]}
                  </button>
                ))}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition ml-1"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Customization Controls */}
        <div className="md:col-span-7 space-y-4">
          {/* Hair Style & Color */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Hair Style</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Tint:</span>
                <input
                  type="color"
                  value={appearance.tints.hair}
                  onChange={(e) =>
                    setAppearance({
                      ...appearance,
                      tints: { ...appearance.tints, hair: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {hairs.map((hair) => (
                <button
                  key={hair.id}
                  onClick={() =>
                    setAppearance({
                      ...appearance,
                      selections: { ...appearance.selections, hair: hair.id },
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
                    appearance.selections.hair === hair.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {hair.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clothes & Outfit */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Outfit & Clothes</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Dress Tint:</span>
                <input
                  type="color"
                  value={appearance.tints.clothes}
                  onChange={(e) =>
                    setAppearance({
                      ...appearance,
                      tints: { ...appearance.tints, clothes: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {clothes.map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    setAppearance({
                      ...appearance,
                      selections: { ...appearance.selections, clothes: c.id },
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
                    appearance.selections.clothes === c.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Skin & Face */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Face & Skin Tone</label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Skin Tone:</span>
                <input
                  type="color"
                  value={appearance.tints.skin}
                  onChange={(e) =>
                    setAppearance({
                      ...appearance,
                      tints: { ...appearance.tints, skin: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer border border-slate-700 bg-transparent p-0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {eyes.map((eye) => (
                <button
                  key={eye.id}
                  onClick={() =>
                    setAppearance({
                      ...appearance,
                      selections: { ...appearance.selections, eyes: eye.id },
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition ${
                    appearance.selections.eyes === eye.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {eye.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Accessories</label>
              {appearance.selections.accessories && (
                <button
                  onClick={() =>
                    setAppearance({
                      ...appearance,
                      selections: { ...appearance.selections, accessories: undefined },
                    })
                  }
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Remove Accessory
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {accessories.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() =>
                    setAppearance({
                      ...appearance,
                      selections: { ...appearance.selections, accessories: acc.id },
                    })
                  }
                  className={`px-3 py-2 rounded-lg text-xs font-medium border text-left truncate transition ${
                    appearance.selections.accessories === acc.id
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-semibold'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
