/**
 * Offscreen route for `npm run thumbnails`: one RUN model on a fixed 512×512
 * stage with the Pirate Nation thumbnail lighting, background and yaw, so RUN
 * previews sit beside PN previews without a visual seam. Dev-only.
 */
import { StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import type { VoxelModelEntry } from '@rvx/contracts/catalog'
import { loadCatalogs } from './catalog'
import { Quaternion, Vector3 } from 'three'
import { FitCamera, getModelPreviewYaw, PackModel } from './pack3d'

declare global {
  interface Window {
    __thumbReady?: boolean
    __thumbError?: string
  }
}

const ROOT = 'thumb-model'
const ICON = new URLSearchParams(window.location.search).get('icon') === '1'
if (ICON) {
  // thumb.html paints a dark page; icons need a transparent page under the canvas.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
}

/** Icon pose: held items lie diagonally (working end up-right), seen flat; the rest use the preview yaw. */
function iconRotation(category: string): { rotationY: number; tilt?: Quaternion } {
  if (category !== 'held-items') return { rotationY: getModelPreviewYaw(category) }
  // Upright hand frame puts the working end on +X (rig forward); turn it to point up-right in view.
  const tilt = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4)
  return { rotationY: 0, tilt }
}

function Ready({ id }: { id: string }) {
  useEffect(() => {
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => (window.__thumbReady = true))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [id])
  return null
}

function ThumbApp() {
  const [entry, setEntry] = useState<VoxelModelEntry | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('model')
    if (!id) {
      window.__thumbError = 'missing ?model= parameter'
      return
    }
    loadCatalogs().then(
      (catalogs) => {
        const match = catalogs.flatMap((c) => c.models).find((m) => m.id === id)
        if (match) setEntry(match)
        else window.__thumbError = `unknown model id ${id}`
      },
      (error: Error) => (window.__thumbError = error.message),
    )
  }, [])
  if (!entry) return null
  // Held items read best lying diagonally in previews too.
  const pose = ICON || entry.category === 'held-items' ? iconRotation(entry.category) : { rotationY: getModelPreviewYaw(entry.category) }
  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true, alpha: ICON }}
      style={{ width: 512, height: 512, filter: ICON ? 'drop-shadow(0 0 1.5px #0b0f16) drop-shadow(0 0 1.5px #0b0f16) drop-shadow(0 3px 2px rgba(0,0,0,0.45))' : undefined }}
    >
      {!ICON && <color attach="background" args={['#10141c']} />}
      <ambientLight intensity={1.1} />
      <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <group quaternion={pose.tilt ?? new Quaternion()}>
          <PackModel entry={entry} name={ROOT} anchor="native" rotationY={pose.rotationY} clip={null} castShadow={false} />
        </group>
        <Ready id={entry.id} />
      </Suspense>
      <FitCamera rootName={ROOT} fitKey={entry.id} targetMode="center" margin={ICON ? 1.5 : 1.15} />
    </Canvas>
  )
}

// A model that fails its contract throws during render; report it instead of
// leaving an empty frame that would be saved as a blank thumbnail.
window.addEventListener('error', (event) => {
  window.__thumbError ??= event.message || 'render error'
})

createRoot(document.getElementById('thumb-root')!).render(
  <StrictMode>
    <ThumbApp />
  </StrictMode>,
)
