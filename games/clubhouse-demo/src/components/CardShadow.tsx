import * as THREE from 'three'

// Shared soft elliptical shadow: a radial-gradient canvas texture on a plane.
// One texture is shared by every shadow mesh in the app.
let shadowTexture: THREE.CanvasTexture | null = null

function getShadowTexture(): THREE.CanvasTexture {
  if (!shadowTexture) {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,0.5)')
    g.addColorStop(0.7, 'rgba(0,0,0,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
    shadowTexture = new THREE.CanvasTexture(c)
  }
  return shadowTexture
}

interface CardShadowProps {
  // World-space size; defaults slightly larger than a 1x card (2.5 x 3.5).
  width?: number
  height?: number
  position?: [number, number, number]
}

// Drop shadow behind a card. Keep it OUTSIDE any flipping group — it should
// stay planted while the card turns.
export function CardShadow({ width = 2.9, height = 4, position = [0.07, -0.1, -0.04] }: CardShadowProps) {
  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={getShadowTexture()} transparent depthWrite={false} />
    </mesh>
  )
}
