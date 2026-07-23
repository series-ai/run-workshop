import * as THREE from 'three'
import { createPfxHealingVinePoint } from './healingVinePoint'

export function createPfxHealingVineMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const vineColor = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  vineColor.getHSL(hsl)
  vineColor.setHSL(hsl.h, Math.max(0.72, hsl.s), Math.min(0.42, hsl.l * 0.72))
  const material = new THREE.MeshStandardMaterial({
    color: vineColor,
    emissive: vineColor,
    emissiveIntensity: 0.38,
    roughness: 0.34,
    metalness: 0,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)) * 0.9,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  })
  material.userData['pfxHealingVolume'] = 'single-life-vine'
  return material
}

export function createPfxHealingVineGeometry(): THREE.TubeGeometry {
  const points: THREE.Vector3[] = []
  for (let step = 0; step <= 32; step++) {
    const progress = step / 32
    points.push(new THREE.Vector3(...createPfxHealingVinePoint(progress)))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.034, 8, false)
}
