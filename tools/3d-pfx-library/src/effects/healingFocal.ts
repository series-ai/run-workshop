import * as THREE from 'three'

export function createPfxHealingFocalMaterial(opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: '#68ffc0',
    emissive: '#37d98a',
    emissiveIntensity: 0.82,
    roughness: 0.2,
    metalness: 0,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: false,
    toneMapped: true,
  })
  material.userData['pfxHealingFocal'] = 'restorative-star'
  return material
}

export function createPfxHealingFocalGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  for (let point = 0; point < 8; point++) {
    const angle = -Math.PI / 2 + point * Math.PI / 4
    const radius = point % 2 === 0 ? 0.2 : 0.055
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (point === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.07,
    steps: 1,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  })
  geometry.translate(0, 0, -0.035)
  geometry.computeVertexNormals()
  return geometry
}
