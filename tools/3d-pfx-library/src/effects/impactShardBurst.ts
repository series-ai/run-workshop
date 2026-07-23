import * as THREE from 'three'

export function createPfxImpactShardBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const hot: readonly [number, number, number] = [1, 1, 0.94]
  const gold: readonly [number, number, number] = [1, 0.82, 0.24]
  const ember: readonly [number, number, number] = [1, 0.34, 0.025]
  const shards = [
    { origin: [0.08, 0.015, 0], direction: [1, 0.1, 0.02], length: 1.25, width: 0.085 },
    { origin: [0.06, 0.02, 0.05], direction: [0.76, 0.5, 0.42], length: 0.92, width: 0.075 },
    { origin: [0.055, -0.025, -0.02], direction: [0.72, -0.42, -0.32], length: 0.72, width: 0.062 },
    { origin: [0.07, 0.01, -0.025], direction: [0.48, 0.2, -0.75], length: 0.6, width: 0.056 },
    { origin: [0.025, -0.015, -0.1], direction: [0.48, 0.1, 0.86], length: 0.78, width: 0.06 },
    // Compact closed chips carry the secondary breakup inside the same draw.
    // Their crossed depth vectors survive camera changes without the sparse,
    // disconnected scratch lines produced by the old particle emitter.
    { origin: [-0.035, 0.01, 0.06], direction: [0.52, 0.68, -0.25], length: 0.42, width: 0.055 },
    { origin: [-0.03, -0.02, -0.055], direction: [0.5, -0.62, 0.35], length: 0.38, width: 0.055 },
    { origin: [-0.06, 0.045, -0.015], direction: [0.42, 0.18, 0.74], length: 0.34, width: 0.055 },
  ] as const
  const push = (point: THREE.Vector3, color: readonly [number, number, number]) => {
    positions.push(point.x, point.y, point.z)
    colors.push(...color)
  }
  const triangle = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    aColor: readonly [number, number, number],
    bColor: readonly [number, number, number],
    cColor: readonly [number, number, number],
  ) => {
    push(a, aColor)
    push(b, bColor)
    push(c, cColor)
  }
  const worldUp = new THREE.Vector3(0, 1, 0)
  const worldDepth = new THREE.Vector3(0, 0, 1)
  const segmentCount = 4
  for (const shard of shards) {
    const direction = new THREE.Vector3(...shard.direction).normalize()
    const reference = Math.abs(direction.dot(worldUp)) > 0.86 ? worldDepth : worldUp
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
    const origin = new THREE.Vector3(...shard.origin)
    const rootCenter = origin.clone().addScaledVector(direction, shard.length * 0.04)
    const shoulderCenter = origin.clone().addScaledVector(direction, shard.length * 0.3)
    const tip = origin.clone().addScaledVector(direction, shard.length)
    const ring = (center: THREE.Vector3, radius: number, phase: number) =>
      Array.from({ length: segmentCount }, (_, segment) => {
        const angle = phase + (segment / segmentCount) * Math.PI * 2
        return center.clone()
          .addScaledVector(tangent, Math.cos(angle) * radius)
          .addScaledVector(bitangent, Math.sin(angle) * radius)
      })
    const root = ring(rootCenter, shard.width * 0.48, Math.PI * 0.12)
    const shoulder = ring(shoulderCenter, shard.width, Math.PI * 0.28)
    for (let side = 0; side < segmentCount; side += 1) {
      const next = (side + 1) % segmentCount
      triangle(root[side]!, root[next]!, shoulder[next]!, hot, hot, gold)
      triangle(root[side]!, shoulder[next]!, shoulder[side]!, hot, gold, gold)
      triangle(shoulder[side]!, shoulder[next]!, tip, gold, ember, ember)
      triangle(rootCenter, root[next]!, root[side]!, hot, hot, hot)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const normalizedDirections = shards.map((shard) => new THREE.Vector3(...shard.direction).normalize())
  geometry.userData['pfxImpactShardBurstGeometry'] = 'single-draw-closed-forward-splinter-fan'
  geometry.userData['pfxImpactShardBurstDrawCalls'] = 1
  geometry.userData['pfxImpactShardBurstShardCount'] = shards.length
  geometry.userData['pfxImpactShardBurstSecondaryShardCount'] = 3
  geometry.userData['pfxImpactShardBurstClosedFaces'] = true
  geometry.userData['pfxImpactShardBurstRadialSegments'] = segmentCount
  geometry.userData['pfxImpactShardBurstMinimumForwardAlignment'] = Math.min(...normalizedDirections.map((direction) => direction.x))
  geometry.userData['pfxImpactShardBurstLengthRatio'] = Math.max(...shards.map((shard) => shard.length)) / Math.min(...shards.map((shard) => shard.length))
  geometry.userData['pfxImpactShardBurstMinimumWidth'] = Math.min(...shards.map((shard) => shard.width))
  geometry.userData['pfxImpactShardBurstMaximumWidth'] = Math.max(...shards.map((shard) => shard.width))
  geometry.userData['pfxImpactShardBurstDepthCrossingCount'] = normalizedDirections.filter((direction) => Math.abs(direction.z) > Math.abs(direction.x)).length
  geometry.userData['pfxImpactShardBurstRootDepthSpan'] = Math.max(...shards.map((shard) => shard.origin[2])) - Math.min(...shards.map((shard) => shard.origin[2]))
  geometry.userData['pfxImpactShardBurstExactOppositePairCount'] = normalizedDirections.reduce((count, direction, index) =>
    count + normalizedDirections.slice(index + 1).filter((candidate) => direction.dot(candidate) < -0.999).length,
  0)
  return geometry
}

export function createPfxImpactShardBurstMaterial(
  opacity: number,
  color: THREE.ColorRepresentation,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    transparent: true,
    opacity: Math.max(0, Math.min(1, opacity)),
    blending: THREE.NormalBlending,
    depthWrite: true,
    side: THREE.FrontSide,
    emissive: '#ff5b08',
    emissiveIntensity: 0.56,
    roughness: 0.34,
    metalness: 0.16,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxImpactShardBurstMaterial'] = 'solid-faceted-heat-ramp'
  return material
}
