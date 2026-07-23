import * as THREE from 'three'
import { roundMetric } from '../constants/03'
import { createPfxHealingRestorationPulse } from './healingRestorationPulse'
import type { PfxHealingGlyphPose } from '../types/02'

export function createPfxHealingGlyphMaterial(opacity: number, color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.55,
    roughness: 0.38,
    metalness: 0,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  })
  material.userData['pfxHealingGlyph'] = 'restoration-leaf-bloom'
  material.userData['pfxHealingGlyphGeometry'] = 'beveled-life-leaf'
  return material
}

export function createPfxHealingGlyphLayout(elapsedSeconds: number): PfxHealingGlyphPose[] {
  const pulse = createPfxHealingRestorationPulse(elapsedSeconds)
  const heroScale = Math.max(0.025, pulse * 1.05)
  return [{
    role: 'hero',
    position: [0, -0.1, 0],
    rotationY: elapsedSeconds * 0.18,
    scale: roundMetric(heroScale),
  }]
}

export function createPfxHealingGlyphGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.bezierCurveTo(0.2, 0.12, 0.18, 0.42, 0, 0.58)
  shape.bezierCurveTo(-0.18, 0.42, -0.2, 0.12, 0, 0)
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.055,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.014,
    bevelThickness: 0.014,
    curveSegments: 8,
  })
  geometry.translate(0, 0, -0.0275)
  geometry.computeVertexNormals()
  return geometry
}
