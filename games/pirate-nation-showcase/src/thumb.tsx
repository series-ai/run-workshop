/**
 * Offscreen render route used by `npm run thumbnails`. It draws exactly one
 * model on a fixed 320x320 stage with no UI, then sets `window.__thumbReady`
 * so the capture script knows the frame is on screen. Dev-only: nothing in the
 * app links to it and it is not an entry of the production build.
 */
import { StrictMode, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { FitCamera } from './components/FitCamera'
import { MODEL_VIEWER_ROOT_NAME } from './components/ModelViewer'
import { loadModels, runtimeAssetPath, type PirateNationModelEntry } from './catalog'
import { useAssetUrl } from './useAssetUrl'

declare global {
  interface Window {
    __thumbReady?: boolean
    __thumbError?: string
  }
}

function LoadedModel({ url, id }: { url: string; id: string }) {
  const { scene } = useGLTF(url)

  useEffect(() => {
    // FitCamera needs a frame to measure the subject, so signal readiness two
    // frames after the scene mounts - by then the fitted view has been drawn.
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.__thumbReady = true
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [scene])

  return (
    <>
      {/* FitCamera always frames from straight ahead, so yaw the model
          instead: a three-quarter view reads far better in a grid than a
          front elevation, and FitCamera measures the rotated bounds. */}
      <group name={MODEL_VIEWER_ROOT_NAME} rotation={[0, -Math.PI / 5, 0]}>
        <primitive object={scene} />
      </group>
      <FitCamera rootName={MODEL_VIEWER_ROOT_NAME} fitKey={id} />
    </>
  )
}

function ThumbModel({ entry }: { entry: PirateNationModelEntry }) {
  const url = useAssetUrl(runtimeAssetPath(entry))
  if (!url) return null
  return <LoadedModel url={url} id={entry.id} />
}

function ThumbApp() {
  const [entry, setEntry] = useState<PirateNationModelEntry | null>(null)

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('model')
    if (!id) {
      window.__thumbError = 'missing ?model= parameter'
      return
    }
    loadModels().then(
      (models) => {
        const match = models.find((model) => model.id === id)
        if (match) {
          setEntry(match)
        } else {
          window.__thumbError = `unknown model id ${id}`
        }
      },
      (error: Error) => {
        window.__thumbError = error.message
      },
    )
  }, [])

  if (!entry) return null

  return (
    <Canvas
      camera={{ position: [0, 2, 5], fov: 45 }}
      // Same lighting and depth settings as the in-app viewer, so a thumbnail
      // matches what the stage shows. The pack's nested shells z-fight
      // without the logarithmic depth buffer.
      gl={{ preserveDrawingBuffer: true, antialias: true, logarithmicDepthBuffer: true }}
      style={{ width: 320, height: 320 }}
    >
      <color attach="background" args={['#10141c']} />
      <ambientLight intensity={1.1} />
      <hemisphereLight intensity={0.6} groundColor="#26303f" color="#ffffff" />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <ThumbModel entry={entry} />
      </Suspense>
    </Canvas>
  )
}

createRoot(document.getElementById('thumb-root')!).render(
  <StrictMode>
    <ThumbApp />
  </StrictMode>,
)
