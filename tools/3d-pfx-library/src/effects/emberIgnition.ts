import * as THREE from 'three'

export function createPfxEmberIgnitionGeometry(): THREE.BufferGeometry {
  const source = new THREE.IcosahedronGeometry(0.19, 1)
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const colors: number[] = []
  const point = new THREE.Vector3()
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).normalize()
    const heat = THREE.MathUtils.clamp(0.48 + point.y * 0.28 + point.x * 0.18, 0, 1)
    colors.push(1, 0.08 + heat * 0.68, 0.005 + heat * 0.08)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxEmberIgnitionGeometry'] = 'closed-faceted-self-lit-coal-seed'
  geometry.userData['pfxEmberIgnitionDrawCalls'] = 1
  source.dispose()
  return geometry
}

export function createPfxEmberIgnitionMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    toneMapped: false,
  })
  material.userData['pfxEmberIgnitionMaterial'] = 'self-lit-orange-red-coal-seed'
  return material
}
