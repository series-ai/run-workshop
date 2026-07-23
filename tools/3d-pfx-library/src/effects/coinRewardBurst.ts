import * as THREE from 'three'

export function createPfxCoinRewardBurstGeometry(): THREE.BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const white: readonly [number, number, number] = [1, 1, 0.94]
  const gold: readonly [number, number, number] = [1, 0.9, 0.38]
  const amber: readonly [number, number, number] = [1, 0.68, 0.1]
  const rays = [
    { direction: [1, 0.08, 0.12], length: 1.05, width: 0.075 },
    { direction: [-0.82, 0.2, 0.2], length: 0.72, width: 0.065 },
    { direction: [0.15, 1, 0.15], length: 0.92, width: 0.07 },
    { direction: [-0.18, -1, -0.15], length: 0.62, width: 0.06 },
    { direction: [0.72, 0.72, 0.08], length: 0.8, width: 0.065 },
    { direction: [-0.7, 0.74, -0.08], length: 0.68, width: 0.06 },
    { direction: [0.74, -0.68, -0.06], length: 0.58, width: 0.055 },
    { direction: [-0.68, -0.72, 0.08], length: 0.5, width: 0.052 },
    { direction: [0.04, 0.08, 1], length: 0.84, width: 0.07 },
    { direction: [-0.06, 0.04, -1], length: 0.76, width: 0.065 },
    { direction: [1, 0.12, 1], length: 0.7, width: 0.06 },
    { direction: [-1, 0.16, 1], length: 0.62, width: 0.058 },
    { direction: [1, -0.14, -1], length: 0.56, width: 0.054 },
    { direction: [-1, -0.1, -1], length: 0.48, width: 0.05 },
    { direction: [0.08, 0.72, 1], length: 0.68, width: 0.058 },
    { direction: [-0.08, -0.72, 1], length: 0.58, width: 0.054 },
    { direction: [0.06, 0.7, -1], length: 0.62, width: 0.056 },
    { direction: [-0.06, -0.7, -1], length: 0.52, width: 0.052 },
  ] as const
  const segmentCount = 4
  const worldUp = new THREE.Vector3(0, 1, 0)
  const worldDepth = new THREE.Vector3(0, 0, 1)
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
  for (const ray of rays) {
    const direction = new THREE.Vector3(...ray.direction).normalize()
    const reference = Math.abs(direction.dot(worldUp)) > 0.86 ? worldDepth : worldUp
    const tangent = new THREE.Vector3().crossVectors(direction, reference).normalize()
    const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize()
    const rootCenter = direction.clone().multiplyScalar(0.48)
    const shoulderCenter = direction.clone().multiplyScalar(0.48 + ray.length * 0.3)
    const tip = direction.clone().multiplyScalar(0.48 + ray.length)
    const ring = (center: THREE.Vector3, radius: number, phase: number) =>
      Array.from({ length: segmentCount }, (_, segment) => {
        const angle = phase + (segment / segmentCount) * Math.PI * 2
        return center.clone()
          .addScaledVector(tangent, Math.cos(angle) * radius)
          .addScaledVector(bitangent, Math.sin(angle) * radius)
      })
    const root = ring(rootCenter, ray.width * 0.4, Math.PI * 0.25)
    const shoulder = ring(shoulderCenter, ray.width, 0)
    for (let side = 0; side < segmentCount; side += 1) {
      const next = (side + 1) % segmentCount
      triangle(root[side]!, root[next]!, shoulder[next]!, white, white, gold)
      triangle(root[side]!, shoulder[next]!, shoulder[side]!, white, gold, gold)
      triangle(shoulder[side]!, shoulder[next]!, tip, gold, amber, amber)
      triangle(rootCenter, root[next]!, root[side]!, white, white, white)
    }
  }
  // Eight closed diamond chips echo the medallion crest in the surrounding
  // burst. Their staggered XYZ positions keep the signature recognizable
  // from side cameras without adding another material or draw call.
  const chips = [
    [0.52, 0.34, 0.46], [-0.48, 0.28, -0.5], [0.38, -0.42, -0.46], [-0.56, -0.32, 0.4],
    [0.12, 0.62, 0.5], [-0.15, -0.58, -0.52], [0.62, 0.02, -0.34], [-0.6, 0.08, 0.32],
  ] as const
  for (const [x, y, z] of chips) {
    const center = new THREE.Vector3(x, y, z)
    const radius = 0.065
    const top = center.clone().add(new THREE.Vector3(0, radius * 1.45, 0))
    const bottom = center.clone().add(new THREE.Vector3(0, -radius * 1.45, 0))
    const equator = [
      center.clone().add(new THREE.Vector3(radius, 0, 0)),
      center.clone().add(new THREE.Vector3(0, 0, radius)),
      center.clone().add(new THREE.Vector3(-radius, 0, 0)),
      center.clone().add(new THREE.Vector3(0, 0, -radius)),
    ]
    for (let side = 0; side < equator.length; side += 1) {
      const next = (side + 1) % equator.length
      triangle(top, equator[side]!, equator[next]!, white, gold, amber)
      triangle(bottom, equator[next]!, equator[side]!, amber, gold, white)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  const normalizedDirections = rays.map((ray) => new THREE.Vector3(...ray.direction).normalize())
  geometry.userData['pfxCoinRewardBurstGeometry'] = 'single-draw-closed-radial-reward-corona'
  geometry.userData['pfxCoinRewardBurstDrawCalls'] = 1
  geometry.userData['pfxCoinRewardBurstRayCount'] = rays.length
  geometry.userData['pfxCoinRewardBurstDepthRayCount'] = normalizedDirections.filter((direction) => Math.abs(direction.z) >= 0.65).length
  geometry.userData['pfxCoinRewardBurstLengthRatio'] = Math.max(...rays.map((ray) => ray.length)) / Math.min(...rays.map((ray) => ray.length))
  geometry.userData['pfxCoinRewardBurstSecondaryChipCount'] = chips.length
  geometry.userData['pfxCoinRewardBurstClosedFaces'] = true
  return geometry
}

export function createPfxCoinRewardBurstMaterial(
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
    emissive: '#fff1b8',
    emissiveIntensity: 0.78,
    roughness: 0.22,
    metalness: 0.42,
    flatShading: true,
    toneMapped: false,
  })
  material.userData['pfxCoinRewardBurstMaterial'] = 'faceted-gold-white-reward-corona'
  return material
}
