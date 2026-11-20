import { Canvas } from '@react-three/fiber'
import { Component, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { PolyPartIndex } from './avatar/composePolyAvatar'
import { GalleryStageContent, LineupStageContent, type GalleryItem } from './avatar/SinglePartPreview'
import { loadAllCatalogs, type PolyCatalogBundle } from './catalog'
import { STUDIO_GL, StudioLights } from './scenes/studio'

declare global {
  interface Window {
    __thumbReady?: boolean
    __thumbError?: string
  }
}

class ThumbErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }
  componentDidCatch(error: unknown): void {
    window.__thumbError = error instanceof Error ? error.message : String(error)
  }
  render(): ReactNode {
    return this.state.hasError ? null : this.props.children
  }
}

function resolveAnyItem(bundle: PolyCatalogBundle, token: string): GalleryItem {
  const colon = token.indexOf(':')
  const kind = colon > 0 ? token.slice(0, colon) : null
  const id = colon > 0 ? token.slice(colon + 1) : token
  const kinds = kind ? [kind] : ['preset', 'part', 'held', 'prop']
  for (const k of kinds) {
    for (const cat of bundle.ordered) {
      if (k === 'part') {
        const hit = cat.parts.find((p) => p.id === id)
        if (hit) return { kind: 'part', entry: hit }
      } else if (k === 'held') {
        const hit = cat.heldItems.find((h) => h.id === id)
        if (hit) return { kind: 'held', entry: hit }
      } else if (k === 'prop') {
        const hit = cat.props.find((p) => p.id === id)
        if (hit) return { kind: 'prop', entry: hit }
      } else if (k === 'preset') {
        const hit = cat.presets.find((p) => p.id === id)
        if (hit) return { kind: 'preset', entry: hit }
      }
    }
  }
  throw new Error(`Unknown thumbnail/lineup target "${token}"`)
}

const PROP_THUMB_CLIP_ORDER = [
  'Opening',
  'Hatch',
  'Raise',
  'SlideOpen',
  'Activate',
  'Erupt',
  'Snap',
  'Dispense',
  'Alert',
  'Drop',
  'Fire',
  'Swing',
  'Hit',
  'Hack',
  'Shatter',
  'Pop',
  'Open',
  'Loop',
  'Spin',
  'Hover',
  'Sweep',
  'Pulse',
  'Active',
  'Idle',
]

function pickPreviewPropClip(clips?: readonly string[]): string | null {
  if (!clips || clips.length === 0) return null
  for (const name of PROP_THUMB_CLIP_ORDER) {
    if (clips.includes(name)) return name
  }
  return clips[0] ?? null
}

function ThumbApp() {
  const [bundle, setBundle] = useState<PolyCatalogBundle | null>(null)
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const kind = params.get('kind') ?? 'part'
  const id = params.get('id') ?? ''
  const lineupRaw = params.get('lineup')
  const clip = params.get('clip')
  const phaseRaw = params.get('phase')
  const hasExplicitPhase = phaseRaw !== null && Number.isFinite(Number(phaseRaw))
  const explicitPhase = hasExplicitPhase ? Number(phaseRaw) : 0.18
  const yawRaw = params.get('yaw')
  const yawDeg = yawRaw !== null && Number.isFinite(Number(yawRaw)) ? Number(yawRaw) : 36
  const pitchRaw = params.get('pitch')
  const pitchDeg = pitchRaw !== null && Number.isFinite(Number(pitchRaw)) ? Number(pitchRaw) : 18

  useEffect(() => {
    window.__thumbReady = false
    window.__thumbError = undefined
    loadAllCatalogs()
      .then(setBundle)
      .catch((err: unknown) => {
        window.__thumbError = err instanceof Error ? err.message : String(err)
      })
  }, [])

  const resolved = useMemo(() => {
    if (!bundle) return null
    try {
      const index = new PolyPartIndex(bundle.ordered)
      const presets = bundle.ordered.flatMap((c) => c.presets)
      if (lineupRaw) {
        const tokens = lineupRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        const items = tokens.map((t) => resolveAnyItem(bundle, t))
        return { mode: 'lineup' as const, index, presets, items }
      }
      const item = resolveAnyItem(bundle, `${kind}:${id}`)
      return { mode: 'single' as const, index, presets, item }
    } catch (err) {
      window.__thumbError = err instanceof Error ? err.message : String(err)
      return null
    }
  }, [bundle, kind, id, lineupRaw])

  const markReady = useCallback(() => {
    window.__thumbReady = true
  }, [])

  if (!resolved) return null

  const singlePropDefaultClip =
    resolved.mode === 'single' && resolved.item.kind === 'prop' ? pickPreviewPropClip(resolved.item.entry.clips) : null
  const effectiveClip = clip ?? singlePropDefaultClip
  const effectivePhase =
    !hasExplicitPhase && resolved.mode === 'single' && resolved.item.kind === 'prop' && resolved.item.entry.clips?.length
      ? 0.55
      : explicitPhase

  return (
    <ThumbErrorBoundary>
      <Canvas style={{ width: '100%', height: '100%' }} dpr={1} gl={STUDIO_GL} camera={{ fov: 38, near: 0.02, far: 100 }}>
        <StudioLights reach={resolved.mode === 'lineup' ? 2.8 : 1.6} />
        <Suspense fallback={null}>
          {resolved.mode === 'lineup' ? (
            <LineupStageContent
              items={resolved.items}
              index={resolved.index}
              presets={resolved.presets}
              clipOverride={clip}
              holdPhase={explicitPhase}
              onReady={markReady}
            />
          ) : (
            <GalleryStageContent
              item={resolved.item}
              index={resolved.index}
              presets={resolved.presets}
              clipOverride={effectiveClip}
              holdPhase={effectivePhase}
              yawDeg={yawDeg}
              pitchDeg={pitchDeg}
              onReady={markReady}
            />
          )}
        </Suspense>
      </Canvas>
    </ThumbErrorBoundary>
  )
}

createRoot(document.getElementById('thumb-root')!).render(<ThumbApp />)
