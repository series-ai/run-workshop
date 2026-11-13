import { useEffect, useRef } from 'react'
import type { PackManifest, StageSettings, StageStats } from '../types'
import { InklineRenderer } from '../runtime/renderer'

export interface StageProps { settings: StageSettings; manifest: PackManifest; onStats: (stats: StageStats) => void }
export function Stage({ settings, manifest, onStats }: StageProps) {
  const container = useRef<HTMLDivElement>(null)
  const renderer = useRef<InklineRenderer | null>(null)
  const currentSettings = useRef(settings)
  const callback = useRef(onStats)
  currentSettings.current = settings; callback.current = onStats
  useEffect(() => {
    if (!container.current) return
    try {
      renderer.current = new InklineRenderer(container.current, manifest, currentSettings.current, stats => callback.current(stats))
    } catch (error) {
      callback.current({ fps: 0, frameMs: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, elapsed: 0,
        figures: 0, effects: 0, score: 0, message: '', loading: false, error: error instanceof Error ? error.message : 'WebGL is unavailable.' })
    }
    return () => { renderer.current?.dispose(); renderer.current = null }
  }, [manifest])
  useEffect(() => renderer.current?.update(settings), [settings])
  return <div ref={container} className="stage-canvas" style={{ width: '100%', height: '100%', minHeight: 280 }} />
}
