/**
 * Frames whatever object currently sits in the scene under `rootName`.
 *
 * Model sizes vary by orders of magnitude across the pack (a buoy vs a
 * 16×16 kraken), so a fixed camera distance clips one asset and dwarfs the
 * next. This measures the object and fits the camera to it. Ported from the
 * game-bot `FitAvatarCamera` and generalized to any named root.
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, PerspectiveCamera, Vector3 } from 'three'

const DEGREES_TO_RADIANS = Math.PI / 180

export interface FitCameraProps {
  /** Scene name of the object to frame. */
  rootName: string
  /** Changing this refits, so pass a value derived from the subject. */
  fitKey: string
  /** Extra room around the subject. 1 is a tight fit. */
  margin?: number
}

export function FitCamera({ rootName, fitKey, margin = 1.25 }: FitCameraProps) {
  const { camera, scene, controls } = useThree()
  const pending = useRef(true)

  useEffect(() => {
    pending.current = true
  }, [fitKey])

  // The subject appears a frame or more after Suspense resolves, so poll until
  // it is in the scene and has non-zero bounds.
  useFrame(() => {
    if (!pending.current) return

    const subject = scene.getObjectByName(rootName)
    if (!subject) return

    const box = new Box3().setFromObject(subject)
    if (box.isEmpty()) return

    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    if (size.length() === 0) return

    const perspective = camera as PerspectiveCamera
    const verticalFov = perspective.fov * DEGREES_TO_RADIANS
    const fitHeightDistance = size.y / (2 * Math.tan(verticalFov / 2))
    const fitWidthDistance = size.x / (2 * Math.tan(verticalFov / 2) * perspective.aspect)
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * margin

    camera.position.set(center.x, center.y + size.y * 0.15, center.z + distance)
    // Keep the depth range tight around the subject: a far/near ratio past a
    // few thousand starves the depth buffer and shows up as z-fighting on the
    // pack's nested voxel shells.
    perspective.near = Math.max(0.01, distance / 50)
    perspective.far = distance * 50
    perspective.updateProjectionMatrix()

    const orbit = controls as { target?: Vector3; update?: () => void } | null
    if (orbit?.target) {
      orbit.target.copy(center)
      orbit.update?.()
    } else {
      camera.lookAt(center)
    }

    pending.current = false
  })

  return null
}
