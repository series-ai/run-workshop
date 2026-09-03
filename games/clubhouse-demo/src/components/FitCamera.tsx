import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'

// Keeps a fitWidth x fitHeight world-space rect fully visible by pushing the
// perspective camera back as the viewport narrows (used by the Deck and
// Backs grids).
export function FitCamera({ fitWidth, fitHeight }: { fitWidth: number; fitHeight: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useEffect(() => {
    const cam = camera as PerspectiveCamera
    const halfFov = (cam.fov * Math.PI) / 360
    const forHeight = fitHeight / 2 / Math.tan(halfFov)
    const forWidth = fitWidth / 2 / (Math.tan(halfFov) * (size.width / size.height))
    cam.position.z = Math.max(forHeight, forWidth) * 1.08
    cam.updateProjectionMatrix()
  }, [camera, size, fitWidth, fitHeight])
  return null
}
