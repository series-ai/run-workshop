import * as THREE from 'three'

export function createPfxSnowSpawnCradleGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const shardCount = 12
  for (let shard = 0; shard < shardCount; shard += 1) {
    const axis = shard % 6
    const band = Math.floor(shard / 6)
    const angle = axis / 6 * Math.PI * 2 + band * 0.12
    const inner = band === 0 ? 0.14 : 0.47
    const outer = band === 0 ? 0.44 : 0.82
    const halfWidth = band === 0 ? 0.075 : 0.055
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    const tangent = new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle))
    const center = radial.clone().multiplyScalar((inner + outer) * 0.5)
    const base = positions.length / 3
    const points = [
      radial.clone().multiplyScalar(inner),
      center.clone().addScaledVector(tangent, halfWidth),
      radial.clone().multiplyScalar(outer),
      center.clone().addScaledVector(tangent, -halfWidth),
    ]
    for (const [pointIndex, point] of points.entries()) {
      positions.push(point.x, 0, point.z)
      const hot = pointIndex === 2 ? 1 : band === 0 ? 0.82 : 0.62
      colors.push(0.32 * hot, 0.86 * hot, 1)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData['pfxSnowSpawnGeometry'] = 'single-draw-sixfold-separated-frost-shards'
  geometry.userData['pfxSnowSpawnDrawCalls'] = 1
  geometry.userData['pfxSnowSpawnRadialShardCount'] = shardCount
  geometry.userData['pfxSnowSpawnSymmetry'] = 6
  geometry.userData['pfxSnowSpawnContinuousRing'] = false
  geometry.userData['pfxSnowSpawnGrounded'] = true
  return geometry
}

export function createPfxSnowSpawnCradleMaterial(opacity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: THREE.MathUtils.clamp(opacity, 0, 1),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
  material.userData['pfxSnowSpawnMaterial'] = 'sixfold-ice-crystal-cradle'
  return material
}
